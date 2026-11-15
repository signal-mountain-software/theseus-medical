jest.mock('./AVAUtilities', () => ({
  dbClient: { put: jest.fn(), delete: jest.fn(), batchGet: jest.fn() },
  cl: jest.fn(),
}));

const { dbClient } = require('./AVAUtilities');
const { buildShortcutMenuId, setMessageShortcut, getExistingShortcutStates } = require('./AVAMessageShortcuts');

beforeEach(() => {
  jest.clearAllMocks();
  dbClient.put.mockImplementation(() => ({ promise: async () => ({}) }));
  dbClient.delete.mockImplementation(() => ({ promise: async () => ({}) }));
  dbClient.batchGet.mockImplementation(() => ({ promise: async () => ({ Responses: { MenuV3: [] } }) }));
});

describe('buildShortcutMenuId', () => {
  it('is deterministic and round-trips the same inputs to the same id', () => {
    expect(buildShortcutMenuId('group:Nursing', 'Admin')).toBe(buildShortcutMenuId('group:Nursing', 'Admin'));
  });

  it('produces different ids for different grantee rules or target groups', () => {
    const base = buildShortcutMenuId('group:Nursing', 'Admin');
    expect(buildShortcutMenuId('group:Kitchen', 'Admin')).not.toBe(base);
    expect(buildShortcutMenuId('group:Nursing', 'Kitchen')).not.toBe(base);
  });

  it('resolves to the same id whether built from the grantor side (Group Security, mirroring one of its own accessible_to rows) or the grantee side (Messaging Shortcuts, reverse-lookup candidate)', () => {
    // Scenario: Admin's own accessible_to record contains the row 'group:Nursing', and Admin is
    // the group currently being maintained in GroupSecuritySection.
    const adminAccessibleToRow = 'group:Nursing';
    const groupBeingMaintainedInSecurityScreen = 'Admin';
    const fromGrantorScreen = buildShortcutMenuId(adminAccessibleToRow, groupBeingMaintainedInSecurityScreen);

    // Same scenario, viewed from GroupMessagingSection with Nursing as the group being
    // maintained - the reverse lookup surfaces Admin as a candidate (since Admin's own
    // accessible_to grants Nursing access), and the grantee rule is built from the group
    // currently being maintained (Nursing), not copied from anywhere.
    const groupBeingMaintainedInMessagingScreen = 'Nursing';
    const reverseLookupCandidate = 'Admin';
    const fromGranteeScreen = buildShortcutMenuId(`group:${groupBeingMaintainedInMessagingScreen}`, reverseLookupCandidate);

    expect(fromGrantorScreen).toBe(fromGranteeScreen);
  });
});

describe('setMessageShortcut', () => {
  it('creates a MenuV3 record mirroring the grantee rule, with recipients pointed at the target group', async () => {
    const result = await setMessageShortcut({
      client_id: 'client', granteeRule: 'group:Nursing', targetGroupId: 'Admin', targetGroupName: 'Admin Office', enabled: true
    });
    expect(result).toBe(true);
    expect(dbClient.put).toHaveBeenCalledWith({
      TableName: 'MenuV3',
      Item: {
        client_id: 'client',
        menu_id: buildShortcutMenuId('group:Nursing', 'Admin'),
        menu_itemType: 'function',
        available_to: ['group:Nursing'],
        call: { target: 'MessageForm', params: { options: { newMessage: true, recipients: [{ group_id: 'Admin' }] } } },
        description: { short: 'Message Admin Office', long: 'Message Admin Office' }
      }
    });
  });

  it('deletes the matching MenuV3 record when disabled', async () => {
    const result = await setMessageShortcut({ client_id: 'client', granteeRule: 'person:X', targetGroupId: 'Admin', enabled: false });
    expect(result).toBe(false);
    expect(dbClient.delete).toHaveBeenCalledWith({
      TableName: 'MenuV3',
      Key: { client_id: 'client', menu_id: buildShortcutMenuId('person:X', 'Admin') }
    });
    expect(dbClient.put).not.toHaveBeenCalled();
  });

  it('returns null without throwing when the write fails', async () => {
    dbClient.put.mockImplementation(() => ({ promise: async () => { throw new Error('offline'); } }));
    const result = await setMessageShortcut({ client_id: 'client', granteeRule: '*admin', targetGroupId: 'Admin', enabled: true });
    expect(result).toBeNull();
  });
});

describe('getExistingShortcutStates', () => {
  it('reports true only for pairs whose shortcut record exists', async () => {
    dbClient.batchGet.mockImplementation(() => ({
      promise: async () => ({ Responses: { MenuV3: [{ menu_id: buildShortcutMenuId('group:Nursing', 'Admin') }] } })
    }));
    const states = await getExistingShortcutStates('client', [
      { granteeRule: 'group:Nursing', targetGroupId: 'Admin' },
      { granteeRule: 'group:Kitchen', targetGroupId: 'Admin' },
    ]);
    expect(states[buildShortcutMenuId('group:Nursing', 'Admin')]).toBe(true);
    expect(states[buildShortcutMenuId('group:Kitchen', 'Admin')]).toBe(false);
  });

  it('chunks requests at 100 keys per batchGet call', async () => {
    const pairs = Array.from({ length: 150 }, (_, i) => ({ granteeRule: `group:G${i}`, targetGroupId: 'Admin' }));
    await getExistingShortcutStates('client', pairs);
    expect(dbClient.batchGet).toHaveBeenCalledTimes(2);
    expect(dbClient.batchGet.mock.calls[0][0].RequestItems.MenuV3.Keys).toHaveLength(100);
    expect(dbClient.batchGet.mock.calls[1][0].RequestItems.MenuV3.Keys).toHaveLength(50);
  });

  it('returns all-false without throwing when the batch lookup fails', async () => {
    dbClient.batchGet.mockImplementation(() => ({ promise: async () => { throw new Error('offline'); } }));
    const states = await getExistingShortcutStates('client', [{ granteeRule: 'group:Nursing', targetGroupId: 'Admin' }]);
    expect(states[buildShortcutMenuId('group:Nursing', 'Admin')]).toBe(false);
  });
});
