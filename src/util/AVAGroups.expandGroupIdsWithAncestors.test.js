jest.mock('./AVAUtilities', () => ({
  dbClient: { query: jest.fn(), update: jest.fn(), put: jest.fn(), get: jest.fn() },
  cl: jest.fn(),
  clt: jest.fn(),
  makeArray: value => value == null ? [] : [value].flat(),
  recordExists: result => !!(result?.Item || result?.Items?.length),
  getCustomizations: async () => ({ customization_value: 'Client' }),
}));
jest.mock('./AVAPeople', () => ({ getPerson: jest.fn(), getSession: jest.fn() }));
jest.mock('./AVADateTime', () => ({ makeDate: () => ({ numeric: 20261103 }) }));

const { expandGroupIdsWithAncestors } = require('./AVAGroups');

// Parent <- Child <- Grandchild, plus an unrelated sibling tree (Other <- OtherLeaf),
// mirroring the shape adminHierarchy entries actually have: {id, belongs_to}.
const adminHierarchy = [
  { id: 'Parent', belongs_to: '__TOP__' },
  { id: 'Child', belongs_to: 'Parent' },
  { id: 'Grandchild', belongs_to: 'Child' },
  { id: 'Other', belongs_to: '__TOP__' },
  { id: 'OtherLeaf', belongs_to: 'Other' },
];

it('adds every ancestor of a given group, stopping at __TOP__', () => {
  const result = expandGroupIdsWithAncestors(['Grandchild'], adminHierarchy);
  expect(result).toEqual(new Set(['Grandchild', 'Child', 'Parent']));
});

it('does not pull in unrelated branches of the hierarchy', () => {
  const result = expandGroupIdsWithAncestors(['Grandchild'], adminHierarchy);
  expect(result.has('Other')).toBe(false);
  expect(result.has('OtherLeaf')).toBe(false);
});

it('expands every input id and de-duplicates shared ancestors', () => {
  const result = expandGroupIdsWithAncestors(['Grandchild', 'Child', 'OtherLeaf'], adminHierarchy);
  expect(result).toEqual(new Set(['Grandchild', 'Child', 'Parent', 'OtherLeaf', 'Other']));
});

it('returns the input unchanged for a top-level group with no belongs_to', () => {
  const result = expandGroupIdsWithAncestors(['Parent'], adminHierarchy);
  expect(result).toEqual(new Set(['Parent']));
});

it('tolerates groups missing from the hierarchy (e.g. public/private groups)', () => {
  const result = expandGroupIdsWithAncestors(['not_in_hierarchy'], adminHierarchy);
  expect(result).toEqual(new Set(['not_in_hierarchy']));
});

it('handles empty/missing inputs without throwing', () => {
  expect(expandGroupIdsWithAncestors([], adminHierarchy)).toEqual(new Set());
  expect(expandGroupIdsWithAncestors(null, adminHierarchy)).toEqual(new Set());
  expect(expandGroupIdsWithAncestors(['Grandchild'], null)).toEqual(new Set(['Grandchild']));
});

it('does not infinite-loop on a cyclical belongs_to chain', () => {
  const cyclical = [
    { id: 'A', belongs_to: 'B' },
    { id: 'B', belongs_to: 'A' },
  ];
  const result = expandGroupIdsWithAncestors(['A'], cyclical);
  expect(result).toEqual(new Set(['A', 'B']));
});

it('supports hierarchy entries keyed by group_id instead of id', () => {
  const altHierarchy = [
    { group_id: 'Parent', belongs_to: '__TOP__' },
    { group_id: 'Child', belongs_to: 'Parent' },
  ];
  const result = expandGroupIdsWithAncestors(['Child'], altHierarchy);
  expect(result).toEqual(new Set(['Child', 'Parent']));
});
