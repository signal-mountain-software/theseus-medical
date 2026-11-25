import { buildPersonSearchData } from './AVAPeople';

const mockGetCustomizations = jest.fn();
const mockResolveData = jest.fn();
jest.mock('./AVAUtilities', () => ({
  isPromise: () => false,
  cl: jest.fn(),
  recordExists: value => !!(value?.Item || value?.Items?.length),
  sentenceCase: value => value,
  titleCase: value => String(value || '').replace(/\b\w/g, c => c.toUpperCase()),
  isEmpty: value => !value,
  dbClient: { get: jest.fn(), query: jest.fn() },
  getObject: jest.fn(),
  getCustomizations: (...args) => mockGetCustomizations(...args),
  resolveData: (...args) => mockResolveData(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCustomizations.mockResolvedValue(false); // no client_id override - no extra DataDictionary fields
  mockResolveData.mockResolvedValue([]);
});

it('builds first name, last name, and cell phone by default', async () => {
  const personRec = {
    name: { first: 'Jane', last: 'Doe' },
    contact_info: { cell: { number: '+15551234567' } },
  };
  const result = await buildPersonSearchData({ personRec, client_id: 'client' });
  expect(result).toMatch(/jane/i);
  expect(result).toMatch(/doe/i);
  expect(result).toContain('5551234567');
});

it('excludes email by default (no configured DataDictionary fields, and name/cell are the only implicit fields)', async () => {
  const personRec = {
    name: { first: 'Jane', last: 'Doe' },
    contact_info: { email: { address: 'jane@example.com' } },
  };
  const result = await buildPersonSearchData({ personRec, client_id: 'client' });
  expect(result).not.toContain('jane@example.com');
  expect(mockResolveData).not.toHaveBeenCalled();
});

it('extends search_data with arbitrary DataDictionaryV3 fields configured via search_data_fields, resolved against the in-flight record rather than a stale DB copy', async () => {
  const personRec = { person_id: 'p1', name: { first: 'Jane', last: 'Doe' } };
  mockGetCustomizations.mockResolvedValue({ customization_value: ['custom_email', 'custom_tags', 'custom_flag', 'custom_notes'] });
  mockResolveData.mockResolvedValue([
    { formatted: 'jane@example.com' },
    { formatted: ['red', 'blue'] },
    { formatted: true },
    { formatted: { nested: 'object' } }, // not string-coercible - should be dropped, not JSON-stringified
  ]);

  const result = await buildPersonSearchData({ personRec, client_id: 'client' });

  expect(result).toContain('jane@example.com');
  expect(result).toMatch(/red/i);
  expect(result).toMatch(/blue/i);
  expect(result).toContain('true');
  expect(result).not.toMatch(/nested/i);
  expect(result).not.toMatch(/object/i);

  expect(mockResolveData).toHaveBeenCalledWith(
    'client',
    'p1',
    ['custom_email', 'custom_tags', 'custom_flag', 'custom_notes'],
    expect.objectContaining({
      address_lookup: false,
      resolve_address: false,
      recordOverrides: { People: personRec },
    })
  );
});

// Phone-type DataDictionary fields resolve to a human-display `formatted` string (punctuated)
// plus a `details.raw` digits-only form - prefer the latter so every phone number in search_data
// is a single contiguous digit run, consistent with the hardcoded cell-phone handling in
// makeSearchData(). Without this, a configured home/office phone would be stored with its
// "(444) 112-3456" formatting while cell phones are stored as "14441123456" - an inconsistency
// that broke dash-typed phone searches for one source but not the other.
it('prefers a phone field\'s digits-only details.raw over its punctuated formatted display', async () => {
  const personRec = { person_id: 'p1', name: { first: 'Jane', last: 'Doe' } };
  mockGetCustomizations.mockResolvedValue({ customization_value: ['home_phone'] });
  mockResolveData.mockResolvedValue([
    { formatted: '(444) 112-3456', raw: '4441123456', details: { raw: '4441123456', display: '(444) 112-3456' } },
  ]);

  const result = await buildPersonSearchData({ personRec, client_id: 'client' });

  expect(result).toContain('4441123456');
  expect(result).not.toContain('(444)');
  expect(result).not.toContain('112-3456');
});

// A non-phone configured field (no `details.raw`) should still fall back to `formatted`/`raw` as
// before - the preference for `details.raw` is additive, not a regression for other field types.
it('still falls back to formatted/raw for a resolved field with no details.raw (non-phone types)', async () => {
  const personRec = { person_id: 'p1', name: { first: 'Jane', last: 'Doe' } };
  mockGetCustomizations.mockResolvedValue({ customization_value: ['custom_notes'] });
  mockResolveData.mockResolvedValue([{ formatted: 'some note text', details: null }]);

  const result = await buildPersonSearchData({ personRec, client_id: 'client' });

  expect(result).toMatch(/some/i);
  expect(result).toMatch(/note/i);
});

it('skips DataDictionary field resolution when the person has no person_id yet', async () => {
  const personRec = { name: { first: 'Jane', last: 'Doe' } };
  mockGetCustomizations.mockResolvedValue({ customization_value: ['custom_email'] });
  const result = await buildPersonSearchData({ personRec, client_id: 'client' });
  expect(mockResolveData).not.toHaveBeenCalled();
  expect(result).toMatch(/jane/i);
});

it('fully recomputes rather than appending - a stale name does not survive a rename', async () => {
  const before = await buildPersonSearchData({
    personRec: { name: { first: 'John', last: 'Smith' } },
    client_id: 'client',
  });
  expect(before).toMatch(/john/i);

  // Simulate a rename: the caller always passes the CURRENT personRec, never the old
  // search_data string, so nothing from "before" should be able to leak into "after".
  const after = await buildPersonSearchData({
    personRec: { name: { first: 'Jonathan', last: 'Smith' }, search_data: before },
    client_id: 'client',
  });
  expect(after).toMatch(/jonathan/i);
  expect(after.toLowerCase().split(/\s+/)).not.toContain('john');
});

it('always preserves manually-entered search terms regardless of other fields', async () => {
  const personRec = {
    name: { first: 'William', last: 'Shakespeare' },
    search_data_manual: 'Bill Bob',
  };
  const result = await buildPersonSearchData({ personRec, client_id: 'client' });
  expect(result).toMatch(/bill/i);
  expect(result).toMatch(/bob/i);
});

it('folds in caller-supplied extraWords (e.g. family name/id)', async () => {
  const personRec = { name: { first: 'Jane', last: 'Doe' } };
  const result = await buildPersonSearchData({ personRec, client_id: 'client', extraWords: ['Smith Family', 'family_123'] });
  expect(result).toMatch(/smith/i);
  expect(result).toContain('family_123');
});

it('still includes the implicit name/cell fields, and never looks up DataDictionary config, when no client_id is supplied', async () => {
  const personRec = { name: { first: 'Jane', last: 'Doe' } };
  const result = await buildPersonSearchData({ personRec });
  expect(mockGetCustomizations).not.toHaveBeenCalled();
  expect(result).toMatch(/jane/i);
});
