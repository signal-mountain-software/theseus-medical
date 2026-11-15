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

let dbClient, getGroupAccessibleGroups;

// All belongs_to '__TOP__' unless noted. AllStaff is Nursing's parent.
const groups = [
  { client_id: 'client', group_id: 'AllStaff', belongs_to: '__TOP__', group_type: 'parent', name: 'All Staff' },
  { client_id: 'client', group_id: 'Nursing', belongs_to: 'AllStaff', group_type: 'admin', admin_class: 'local', name: 'Nursing' },
  { client_id: 'client', group_id: 'Admin', belongs_to: '__TOP__', group_type: 'admin', accessible_to: ['group:Nursing'], name: 'Admin' },
  { client_id: 'client', group_id: 'Kitchen', belongs_to: '__TOP__', group_type: 'admin', accessible_to: ['group:AllStaff'], name: 'Kitchen' },
  { client_id: 'client', group_id: 'FrontDesk', belongs_to: '__TOP__', group_type: 'public', name: 'Front Desk' },
  { client_id: 'client', group_id: 'Unrelated', belongs_to: '__TOP__', group_type: 'admin', accessible_to: ['group:Kitchen'], name: 'Unrelated' },
  { client_id: 'client', group_id: 'ITStaff', belongs_to: '__TOP__', group_type: 'admin', accessible_to: ['*admin'], name: 'IT Staff' },
  { client_id: 'client', group_id: 'PeopleNamedDirector', belongs_to: '__TOP__', group_type: 'admin', accessible_to: ['*all'], name: 'People Named Director' },
];

beforeEach(() => {
  jest.resetModules();
  ({ dbClient } = require('./AVAUtilities'));
  ({ getGroupAccessibleGroups } = require('./AVAGroups'));
  dbClient.query.mockImplementation(params => ({
    promise: async () => ({ Items: params.TableName === 'Groups' ? groups : [] }),
  }));
});

it('finds groups granted directly and inherited from a parent, excluding public/open groups', async () => {
  const result = await getGroupAccessibleGroups('client', 'Nursing');
  const ids = result.map(r => r.group_id).sort();
  expect(ids).toEqual(['Admin', 'Kitchen']);
});

it('excludes public/open groups as candidates - they are reachable by almost every group, so they are rarely a reasonable one-tap target', async () => {
  const result = await getGroupAccessibleGroups('client', 'Nursing');
  expect(result.map(r => r.group_id)).not.toContain('FrontDesk');
});

it('excludes groups whose accessible_to grants *all, for the same reason as public/open group_type', async () => {
  const result = await getGroupAccessibleGroups('client', 'Nursing');
  expect(result.map(r => r.group_id)).not.toContain('PeopleNamedDirector');
});

it('excludes groups not reachable by this group or its ancestors', async () => {
  const result = await getGroupAccessibleGroups('client', 'Nursing');
  expect(result.map(r => r.group_id)).not.toContain('Unrelated');
});

it('excludes *admin-restricted groups when the group is not an admin-class group', async () => {
  const result = await getGroupAccessibleGroups('client', 'Nursing');
  expect(result.map(r => r.group_id)).not.toContain('ITStaff');
});

it('never includes the group being maintained in its own candidate list', async () => {
  const result = await getGroupAccessibleGroups('client', 'Nursing');
  expect(result.map(r => r.group_id)).not.toContain('Nursing');
});

it('labels each candidate with a human-readable reason', async () => {
  const result = await getGroupAccessibleGroups('client', 'Nursing');
  const byId = Object.fromEntries(result.map(r => [r.group_id, r.reason]));
  expect(byId.Admin).toBe('Granted directly');
  expect(byId.Kitchen).toBe('Inherited from parent group "All Staff"');
});

it('returns every other group, labeled as admin-bypass, when the group itself is admin-class', async () => {
  const adminGroups = [
    ...groups,
    { client_id: 'client', group_id: 'SeniorStaff', belongs_to: '__TOP__', group_type: 'admin', admin_class: 'admin', name: 'Senior Staff' },
  ];
  dbClient.query.mockImplementation(params => ({
    promise: async () => ({ Items: params.TableName === 'Groups' ? adminGroups : [] }),
  }));
  const result = await getGroupAccessibleGroups('client', 'SeniorStaff');
  expect(result.map(r => r.group_id).sort()).toEqual(['Admin', 'AllStaff', 'FrontDesk', 'ITStaff', 'Kitchen', 'Nursing', 'PeopleNamedDirector', 'Unrelated']);
  expect(result.every(r => r.reason === 'Available because this group is an administrative/master group')).toBe(true);
});

// Reproduces the real-world scenario that originally revealed this: Marketing Staff grants
// access directly to Friends & Family, but Marketing Staff itself has its own children
// (Donors, First time donors, Legacy donors), and Friends & Family has its own descendants too
// (a grandchild, Cousin Group). Nobody granted anything to Marketing Staff's children or to
// Friends & Family's descendants specifically - both sets only become is_accessible via
// getGroupAccess's own descendant-cascade/ancestor-expansion passes, not any explicit rule.
describe('excludes grantor-side descendant-cascade noise while keeping grantee-side ancestor-inheritance', () => {
  const combinatorialGroups = [
    { client_id: 'client', group_id: 'MarketingStaff', belongs_to: '__TOP__', group_type: 'admin', name: 'Marketing Staff', accessible_to: ['group:FriendsFamily'] },
    { client_id: 'client', group_id: 'Donors', belongs_to: 'MarketingStaff', group_type: 'admin', name: 'Donors' },
    { client_id: 'client', group_id: 'FirstTimeDonors', belongs_to: 'MarketingStaff', group_type: 'admin', name: 'First time donors' },
    { client_id: 'client', group_id: 'LegacyDonors', belongs_to: 'MarketingStaff', group_type: 'admin', name: 'Legacy donors' },
    { client_id: 'client', group_id: 'FriendsFamily', belongs_to: '__TOP__', group_type: 'admin', admin_class: 'local', name: 'Friends & Family' },
    { client_id: 'client', group_id: 'ExtendedFamily', belongs_to: 'FriendsFamily', group_type: 'admin', admin_class: 'local', name: 'Extended Family' },
    { client_id: 'client', group_id: 'CousinGroup', belongs_to: 'ExtendedFamily', group_type: 'admin', admin_class: 'local', name: 'Cousin Group' },
  ];

  beforeEach(() => {
    dbClient.query.mockImplementation(params => ({
      promise: async () => ({ Items: params.TableName === 'Groups' ? combinatorialGroups : [] }),
    }));
  });

  it('shows only Marketing Staff (not its children) for the directly-granted group', async () => {
    const result = await getGroupAccessibleGroups('client', 'FriendsFamily');
    expect(result.map(r => r.group_id)).toEqual(['MarketingStaff']);
    expect(result[0].reason).toBe('Granted directly');
  });

  it('still shows Marketing Staff, via inheritance, for a grandchild of the granted group - but still excludes Marketing Staff\'s own children', async () => {
    const result = await getGroupAccessibleGroups('client', 'CousinGroup');
    expect(result.map(r => r.group_id)).toEqual(['MarketingStaff']);
    expect(result[0].reason).toBe('Inherited from parent group "Friends & Family"');
  });
});
