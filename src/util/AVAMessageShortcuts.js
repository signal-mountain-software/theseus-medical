import { dbClient, cl } from './AVAUtilities';

// Shared by both one-tap-message-shortcut edit surfaces (the per-row toggle on a group's own
// accessible_to list in GroupSecuritySection, and the reverse-lookup "Messaging Shortcuts"
// panel) - see the Group Security / Messaging Shortcuts design discussion. Both surfaces can
// toggle the SAME underlying MenuV3 record when they describe the same group<->group grant;
// that's intentional, not a bug - there is genuinely only one shared on/off switch per
// (granteeRule, targetGroupId) pair, exposed from two screens.
//
// granteeRule is one of the rule strings a group's accessible_to can contain - 'group:<id>',
// 'person:<id>', '*all', '*admin', '*support' - mirrored verbatim into the shortcut's
// available_to so it can never reach a broader audience than the access it's mirroring.
// targetGroupId is the group being messaged (recipients always resolve to that one group).

// Deterministic, so toggling is a plain put/delete by key - no scan needed to find an existing
// shortcut for a known (granteeRule, targetGroupId) pair. '~' matches the delimiter convention
// already used elsewhere in this codebase (e.g. PeopleGroups' client_group_id).
export function buildShortcutMenuId(granteeRule, targetGroupId) {
  return `msgshortcut~${granteeRule}~${targetGroupId}`;
}

// Creates (enabled=true) or removes (enabled=false) the one-tap shortcut for a single
// (granteeRule, targetGroupId) pair. Returns true/false reflecting the resulting on/off state,
// or null if the underlying DB operation failed.
export async function setMessageShortcut({ client_id, granteeRule, targetGroupId, targetGroupName, enabled }) {
  const menu_id = buildShortcutMenuId(granteeRule, targetGroupId);
  if (!enabled) {
    const result = await dbClient
      .delete({ TableName: 'MenuV3', Key: { client_id, menu_id } })
      .promise()
      .catch(error => { cl({ 'Error deleting message shortcut': error, menu_id }); return null; });
    return (result === null) ? null : false;
  }
  const label = targetGroupName ? `Message ${targetGroupName}` : 'Message';
  const result = await dbClient
    .put({
      TableName: 'MenuV3',
      Item: {
        client_id,
        menu_id,
        menu_itemType: 'function',
        available_to: [granteeRule],
        call: {
          target: 'MessageForm',
          params: { options: { newMessage: true, recipients: [{ group_id: targetGroupId }] } }
        },
        description: { short: label, long: label }
      }
    })
    .promise()
    .catch(error => { cl({ 'Error creating message shortcut': error, menu_id }); return null; });
  return (result === null) ? null : true;
}

// Bulk-checks which of a set of (granteeRule, targetGroupId) pairs currently have a shortcut,
// so a list UI (e.g. every accessible_to row, or every reverse-lookup candidate) can render its
// checkboxes' initial state in one round-trip (per 100 pairs - DynamoDB batchGet's own limit)
// instead of one GetItem per row.
export async function getExistingShortcutStates(client_id, pairs) {
  const menuIds = (pairs || []).map(p => buildShortcutMenuId(p.granteeRule, p.targetGroupId));
  const existing = new Set();
  for (let i = 0; i < menuIds.length; i += 100) {
    const chunk = menuIds.slice(i, i + 100);
    const batchResult = await dbClient
      .batchGet({
        RequestItems: {
          MenuV3: {
            Keys: chunk.map(menu_id => ({ client_id, menu_id })),
            ProjectionExpression: 'menu_id'
          }
        }
      })
      .promise()
      .catch(error => { cl({ 'Error batch-checking message shortcuts': error }); return null; });
    for (const rec of (batchResult?.Responses?.MenuV3 || [])) {
      existing.add(rec.menu_id);
    }
  }
  const states = {};
  (pairs || []).forEach(p => {
    states[buildShortcutMenuId(p.granteeRule, p.targetGroupId)] = existing.has(buildShortcutMenuId(p.granteeRule, p.targetGroupId));
  });
  return states;
}
