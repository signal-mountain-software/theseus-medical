import { makeName } from './AVAPeople';
import { resolveData } from './AVAUtilities';

jest.mock('./AVAPeople', () => ({ getPerson: jest.fn(), makeName: jest.fn() }));
jest.mock('./AVADateTime', () => ({ makeDate: jest.fn(), isDate: jest.fn() }));
jest.mock('./AVACalendars', () => ({ getOccurenceList: jest.fn() }));
jest.mock('aws-sdk', () => ({
  DynamoDB: { DocumentClient: jest.fn() },
  CognitoIdentityServiceProvider: jest.fn(),
  S3: jest.fn(),
  Polly: jest.fn(),
  Lambda: jest.fn(),
  CloudFront: jest.fn()
}));
jest.mock('aws-sdk/clients/mediaconvert', () => jest.fn());
jest.mock('aws-sdk/clients/stepfunctions', () => jest.fn());

describe('dictionary name resolution', () => {
  let lookup;

  beforeEach(() => {
    lookup = jest.fn(async id => {
      if (id === 'person123') {
        return { name: { first: 'Jane', last: 'Smith' } };
      }
      return null;
    });
    makeName.mockReset();
    makeName.mockImplementation(async id => {
      const person = await lookup(id);
      return person ? `${person.name.first} ${person.name.last}` : undefined;
    });
  });

  async function format(raw, type = 'name') {
    const [result] = await resolveData('client', 'owner', ['field'], {
      dictionaryCache: {
        'client::field': { type, fixed_value: raw }
      }
    });
    return result;
  }

  it('resolves mixed arrays in order using the string_list output shape', async () => {
    const raw = [
      'person123',
      'guest:Pat Jones',
      { first_name: 'Alex', last_name: 'Lee' },
      ' Prince ',
      'Mary   Brown',
      { full_name: 'Sam Taylor' }
    ];
    const values = ['Jane Smith', 'Pat Jones (guest)', 'Alex Lee', 'Prince', 'Mary Brown', 'Sam Taylor'];
    const result = await format(raw);
    const stringList = await format(values, 'string_list');

    expect(result.formatted).toEqual(stringList.formatted);
    expect(result.details).toEqual(stringList.details);
    expect(lookup.mock.calls).toEqual([['person123'], ['Prince']]);
  });

  it.each(['guest:Pat', 'guest:Pat Jones'])('labels %s without looking up an ID', async raw => {
    const result = await format(raw);
    expect(result.formatted).toBe(`${raw.slice(6)} (guest)`);
    expect(result.details.full).toBe(result.formatted);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('looks up scalar IDs and retains scalar name details', async () => {
    expect(await format('person123')).toMatchObject({
      formatted: 'Jane Smith',
      details: { first: 'Jane', last: 'Smith', full: 'Jane Smith' }
    });
  });

  it('falls back to a single-word name when no person is found', async () => {
    expect(await format('Prince')).toMatchObject({
      formatted: 'Prince',
      details: { first: 'Prince', last: '', full: 'Prince' }
    });
  });

  it.each([
    [' Mary   Brown ', 'Mary Brown'],
    [{ first: 'Mary', last: 'Brown' }, 'Mary Brown'],
    [{ displayName: 'Mary Brown' }, 'Mary Brown']
  ])('preserves normal name handling for %p', async (raw, expected) => {
    expect((await format(raw)).formatted).toBe(expected);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('omits blank or unsupported array entries just like string_list', async () => {
    expect(await format(['', '   ', null, {}, 42, { first: 'Alex', last: 'Lee' }]))
      .toMatchObject({
        formatted: ['Alex Lee'],
        details: { values: ['Alex Lee'], count: 1 }
      });
    expect(lookup).not.toHaveBeenCalled();
  });

  it('preserves empty scalar and empty array behavior', async () => {
    for (const raw of [null, '', []]) {
      expect(await format(raw)).toMatchObject({ formatted: null, details: null });
    }
  });

  it('does not silently treat lookup errors as literal names', async () => {
    lookup.mockRejectedValue(new Error('lookup failed'));
    await expect(format('person123')).rejects.toThrow('lookup failed');
  });
});
