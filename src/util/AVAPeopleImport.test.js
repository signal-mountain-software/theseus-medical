jest.mock('./AVAUtilities', () => ({
  dbClient: { query: jest.fn(), get: jest.fn(), batchWrite: jest.fn() },
  putDb: jest.fn(),
  isEmpty: (v) => (v === undefined || v === null || v === ''),
  titleCase: (s) => String(s || '').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()),
  cl: jest.fn(),
}));
jest.mock('./AVAGroups', () => ({ addMember: jest.fn() }));

const { dbClient } = require('./AVAUtilities');
const { parseCreatePeopleRows, matchExistingPerson, toStoragePhone } = require('./AVAPeopleImport');

const promiseOf = (value) => ({ promise: () => Promise.resolve(value) });

describe('parseCreatePeopleRows', () => {
  it('reads first/last/email/cell columns and normalizes values', () => {
    const { people, errors, warnings, columnError } = parseCreatePeopleRows(
      ['First Name', 'Last Name', 'Email', 'Cell Phone'],
      [['jane', 'DOE', ' Jane@Example.com ', '(555) 123-4567']]
    );
    expect(columnError).toBeUndefined();
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(people).toEqual([{ rowIndex: 0, rowNum: 2, firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', cell: '+15551234567' }]);
  });

  it('supports a single Name column, and reports missing names and duplicates', () => {
    const { people, errors, warnings } = parseCreatePeopleRows(
      ['Name'],
      [['Doe, Jane'], ['Cher'], ['Jane Doe']]
    );
    expect(people.map((p) => `${p.firstName}|${p.lastName}`)).toEqual(['Jane|Doe']);
    expect(errors).toEqual([{ rowNum: 3, message: 'Row 3: missing first or last name — skipped.' }]);
    expect(warnings).toEqual(['Row 4 (Jane Doe): duplicate name in spreadsheet — skipped.']);
  });

  it('returns a column error when no name columns exist', () => {
    expect(parseCreatePeopleRows(['Email'], [['a@b.com']]).columnError).toMatch(/Could not find name columns/);
  });
});

describe('toStoragePhone', () => {
  it('formats US numbers', () => {
    expect(toStoragePhone('555.123.4567')).toBe('+15551234567');
    expect(toStoragePhone('15551234567')).toBe('+15551234567');
    expect(toStoragePhone('')).toBe('');
  });
});

describe('matchExistingPerson', () => {
  let accounts, people;
  beforeEach(() => {
    accounts = {};
    people = {};
    dbClient.query.mockImplementation((params) => promiseOf({ Items: accounts[params.ExpressionAttributeValues[':i']] || [] }));
    dbClient.get.mockImplementation((params) => promiseOf({ Item: people[params.Key.person_id] }));
  });

  const row = { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', cell: '+15551234567' };

  it('matches on email first, regardless of name', () => {
    accounts['jane@example.com'] = [{ person_id: 'jsmith', account_type: 'eMail' }];
    people.jsmith = { person_id: 'jsmith', client_id: 'c1', name: { first: 'Janet', last: 'Smith' } };
    return matchExistingPerson({ client_id: 'c1', ...row }).then((m) => {
      expect(m.person_id).toBe('jsmith');
      expect(m.matchedOn).toBe('email');
    });
  });

  it('ignores accounts from other clients and falls through to phone, then name', async () => {
    accounts['jane@example.com'] = [{ person_id: 'other', account_type: 'eMail' }];
    people.other = { person_id: 'other', client_id: 'c2', name: { first: 'Jane', last: 'Doe' } };
    accounts['5551234567'] = [{ person_id: 'jdoe', account_type: 'phone_number' }];
    people.jdoe = { person_id: 'jdoe', client_id: 'c1', name: { first: 'Jane', last: 'Doe' } };
    let m = await matchExistingPerson({ client_id: 'c1', ...row });
    expect(m).toMatchObject({ person_id: 'jdoe', matchedOn: 'phone' });

    delete accounts['5551234567'];
    accounts['jane doe c1'] = [{ person_id: 'jdoe', account_type: 'name' }];
    m = await matchExistingPerson({ client_id: 'c1', ...row });
    expect(m).toMatchObject({ person_id: 'jdoe', matchedOn: 'name' });
  });

  it('prefers the same-name account when several share an identifier, with a note', async () => {
    accounts['jane@example.com'] = [
      { person_id: 'jdoe-parent', account_type: 'eMail' },
      { person_id: 'jdoe', account_type: 'eMail' },
    ];
    people['jdoe-parent'] = { person_id: 'jdoe-parent', client_id: 'c1', name: { first: 'John', last: 'Doe' } };
    people.jdoe = { person_id: 'jdoe', client_id: 'c1', name: { first: 'Jane', last: 'Doe' } };
    const m = await matchExistingPerson({ client_id: 'c1', ...row });
    expect(m.person_id).toBe('jdoe');
    expect(m.note).toMatch(/2 accounts share this email/);
  });

  it('returns null when nothing matches', async () => {
    expect(await matchExistingPerson({ client_id: 'c1', ...row })).toBeNull();
  });
});
