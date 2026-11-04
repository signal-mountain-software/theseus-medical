jest.mock('./AVAUtilities', () => ({
  dbClient: { query: jest.fn(), update: jest.fn(), put: jest.fn(), get: jest.fn() },
  cl: jest.fn(),
  clt: jest.fn(),
  makeArray: value => value == null ? [] : [value].flat(),
  recordExists: result => !!(result?.Item || result?.Items?.length),
  getCustomizations: async () => ({ customization_value: 'Client' }),
}));
jest.mock('./AVAPeople', () => ({ getPerson: jest.fn() }));
jest.mock('./AVADateTime', () => ({ makeDate: () => ({ numeric: 20261103 }) }));

let dbClient, getPerson, removeMember, addMember, groups, memberships, people;
const ids = ['__TOP__', 'Parent', 'Child3', 'Branch', 'Grandchild', 'Other', 'OtherLeaf'];

beforeEach(() => {
  jest.resetModules();
  ({ dbClient } = require('./AVAUtilities'));
  ({ getPerson } = require('./AVAPeople'));
  ({ removeMember, addMember } = require('./AVAGroups'));
  groups = [
    { group_id: 'Parent', belongs_to: '__TOP__', group_type: 'parent', name: 'Parent' },
    ...['Child1', 'Child2', 'Child3', 'Branch'].map(group_id => ({
      group_id, belongs_to: 'Parent', group_type: 'admin', name: group_id,
    })),
    { group_id: 'Grandchild', belongs_to: 'Branch', group_type: 'private', name: 'Grandchild' },
    { group_id: 'Other', belongs_to: '__TOP__', group_type: 'parent', name: 'Other' },
    { group_id: 'OtherLeaf', belongs_to: 'Other', group_type: 'admin', name: 'OtherLeaf' },
  ];
  memberships = ids.map(id => ({ client_group_id: `client~${id}`, membership_status: 'active' }));
  people = { person_id: 'person', name: { first: 'Test', last: 'Person' }, groups: [...ids] };
  const stalePerson = { ...people, groups: [...ids] };
  getPerson.mockResolvedValue(stalePerson);
  dbClient.query.mockImplementation(params => ({
    promise: async () => ({ Items: params.TableName === 'Groups' ? groups : memberships }),
  }));
  dbClient.update.mockImplementation(params => ({
    promise: async () => {
      if (params.TableName === 'People') { people.groups = params.ExpressionAttributeValues[':g']; }
      return {};
    },
  }));
  dbClient.put.mockReturnValue({ promise: async () => ({}) });
  dbClient.get.mockReturnValue({ promise: async () => ({}) });
});

const removedIds = () => dbClient.update.mock.calls
  .map(([params]) => params)
  .filter(params => params.TableName === 'PeopleGroups')
  .map(params => params.Key.client_group_id.split('~')[1]);

it('removes joined descendants at every depth, preserving unrelated memberships', async () => {
  memberships.push({ client_group_id: 'differentClient~Child2' });
  const result = await removeMember('person', 'client', 'Parent', { includeDescendants: true });
  expect(result).toEqual(['__TOP__', 'Other', 'OtherLeaf']);
  expect(removedIds().sort()).toEqual(['Parent', 'Child3', 'Branch', 'Grandchild'].sort());
  expect(removedIds()).not.toContain('Child2');
  expect(people.groups).toEqual(result);
  expect(dbClient.get.mock.calls.map(([p]) => p.Key.group_id).sort()).toEqual(removedIds().sort());
});

it('deduplicates overlapping subtrees and removes newly orphaned ancestors', async () => {
  memberships = memberships.filter(row => !row.client_group_id.includes('Other'));
  const result = await removeMember('person', 'client', ['Parent', 'Branch', 'Grandchild'], { includeDescendants: true });
  expect(result).toEqual([]);
  expect(removedIds().sort()).toEqual(['Parent', 'Branch', 'Grandchild', 'Child3', '__TOP__'].sort());
});

it('preserves a shared parent when removing only one child', async () => {
  const result = await removeMember('person', 'client', 'Child3', { includeDescendants: true });
  expect(result).toEqual(ids.filter(id => id !== 'Child3'));
  expect(removedIds()).toEqual(['Child3']);
});

it.each([undefined, { includeDescendants: false }])('preserves named-only removal for legacy options %j', async options => {
  // Warm the hierarchy cache, then reset the write history and membership state.
  await removeMember('person', 'client', 'Child2', { includeDescendants: true });
  dbClient.update.mockClear();
  const result = await removeMember('person', 'client', 'Parent', options);
  expect(result).toEqual(ids.filter(id => id !== 'Parent'));
  expect(removedIds()).toEqual(['Parent']);
});

it('follows hierarchy and membership pagination before writing', async () => {
  const groupKey = { client_id: 'client', group_id: 'Branch' };
  const membershipKey = { person_id: 'person', client_group_id: 'client~Branch' };
  dbClient.query.mockImplementation(params => ({
    promise: async () => {
      const source = params.TableName === 'Groups' ? groups : memberships;
      const key = params.TableName === 'Groups' ? groupKey : membershipKey;
      return params.ExclusiveStartKey
        ? { Items: source.slice(4) }
        : { Items: source.slice(0, 4), LastEvaluatedKey: key };
    },
  }));
  await removeMember('person', 'client', 'Parent', { includeDescendants: true });
  expect(removedIds()).toContain('Grandchild');
  expect(dbClient.query.mock.calls).toHaveLength(4);
  expect(dbClient.query.mock.calls[1][0].ExclusiveStartKey).toEqual(groupKey);
  expect(dbClient.query.mock.calls[3][0].ExclusiveStartKey).toEqual(membershipKey);
});

it('refreshes a cached hierarchy to discover new descendants', async () => {
  await removeMember('person', 'client', 'Child2', { includeDescendants: true });
  groups.push({ group_id: 'NewChild', belongs_to: 'Parent' });
  memberships.push({ client_group_id: 'client~NewChild' });
  dbClient.update.mockClear();
  await removeMember('person', 'client', 'Parent', { includeDescendants: true });
  expect(removedIds()).toContain('NewChild');
});

it('awaits onRemove actions before resolving', async () => {
  let finishRule;
  const pending = new Promise(resolve => { finishRule = resolve; });
  dbClient.get.mockImplementation(params => ({
    promise: () => params.Key.group_id === 'Grandchild' ? pending : Promise.resolve({}),
  }));
  let completed = false;
  const removal = removeMember('person', 'client', 'Parent', { includeDescendants: true })
    .then(() => { completed = true; });
  for (let i = 0; i < 30; i++) { await Promise.resolve(); }
  expect(dbClient.get).toHaveBeenCalledWith(expect.objectContaining({ Key: { client_id: 'client', group_id: 'Grandchild' } }));
  expect(completed).toBe(false);
  finishRule({});
  await removal;
  expect(completed).toBe(true);
});

it('runs descendant onRemove rules with the post-removal membership context', async () => {
  dbClient.get.mockImplementation(params => ({
    promise: async () => params.Key.group_id === 'Grandchild' ? {
      Item: { group_rules: [{
        rule_type: 'onRemove',
        actions: [{ action: 'addMember', where: ['OtherLeaf'] }],
      }] },
    } : {},
  }));
  const personGroups = new Map();
  await removeMember('person', 'client', 'Parent', { includeDescendants: true, _personGroups: personGroups });
  expect(dbClient.put.mock.calls.map(([p]) => p.Item.client_group_id).sort())
    .toEqual(['client~OtherLeaf', 'client~Other', 'client~__TOP__'].sort());
  expect(personGroups.get('person')).toEqual(['__TOP__', 'Other', 'OtherLeaf']);
});

it('re-adds only the selected child and its ancestors despite cached People data', async () => {
  const personGroups = new Map();
  await removeMember('person', 'client', 'Parent', { includeDescendants: true, _personGroups: personGroups });
  await addMember('person', 'client', 'Child1', { _personGroups: personGroups });
  expect(people.groups.sort()).toEqual(['__TOP__', 'Other', 'OtherLeaf', 'Child1', 'Parent'].sort());
  expect(dbClient.put.mock.calls.map(([p]) => p.Item.client_group_id).sort())
    .toEqual(['client~Child1', 'client~Parent', 'client~__TOP__'].sort());
});

it.each(['Groups', 'PeopleGroups'])('rejects %s query failures before any removal writes', async table => {
  const originalQuery = dbClient.query.getMockImplementation();
  dbClient.query.mockImplementation(params => params.TableName === table
    ? { promise: async () => { throw new Error('Read failed'); } }
    : originalQuery(params));
  await expect(removeMember('person', 'client', 'Parent', { includeDescendants: true })).rejects.toThrow('Read failed');
  expect(dbClient.update).not.toHaveBeenCalled();
});

it.each(['People', 'PeopleGroups'])('rejects %s write failures instead of reporting completion', async table => {
  dbClient.update.mockImplementation(params => ({
    promise: async () => {
      if (params.TableName === table) { throw new Error('Write failed'); }
      return {};
    },
  }));
  await expect(removeMember('person', 'client', 'Parent', { includeDescendants: true })).rejects.toThrow('Write failed');
  expect(dbClient.get).not.toHaveBeenCalled();
});
