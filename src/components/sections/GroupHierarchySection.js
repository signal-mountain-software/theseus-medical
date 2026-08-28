import React from 'react';

import { Box, Typography, Paper, TextField, IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';
import { dbClient, cl } from '../../util/AVAUtilities';
import AVAConfirm from '../forms/AVAConfirm';
import QuickSearch from './QuickSearch';

import SaveIcon from '@material-ui/icons/Save';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import OpenWithIcon from '@material-ui/icons/OpenWith';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import MoreVertIcon from '@material-ui/icons/MoreVert';

export default ({ currentValues, reactData, updateReactData, updateField }) => {

  const [tempName, setTempName] = React.useState("");
  const [tempBelongsTo, setTempBelongsTo] = React.useState(null);
  const [addRowSeed, setAddRowSeed] = React.useState(0);   // bumped after each add to force the (uncontrolled) name TextField to remount blank
  const [tempRenameTarget, setTempRenameTarget] = React.useState(null);
  const [tempRenameValue, setTempRenameValue] = React.useState("");
  const [confirmDeleteTarget, setConfirmDeleteTarget] = React.useState(null);
  // Single overflow menu (replaces 5 always-visible row icons) - anchorEl + which row it's for.
  const [actionMenuAnchor, setActionMenuAnchor] = React.useState(null);
  const [actionMenuTarget, setActionMenuTarget] = React.useState(null);
  // Shared "pick a new parent group" step for the upcoming Move / Duplicate features - QuickSearch
  // browses the FULL hierarchy (not just this section's visible target+descendants list), which is
  // the point: it lets a group be re-parented to (or duplicated under) a branch outside this view.
  const [groupParentPickerContext, setGroupParentPickerContext] = React.useState(null); // { sourceGroupId, mode: 'move' | 'duplicate' }
  const [groupParentPickerData, setGroupParentPickerData] = React.useState({ selections: [] });
  const [confirmMoveTarget, setConfirmMoveTarget] = React.useState(null); // { sourceGroupId, newParent } - gates Move behind a confirm prompt
  const anyEditActive = (tempBelongsTo !== null) || (tempRenameTarget !== null) || (groupParentPickerContext !== null) || (confirmMoveTarget !== null);

  React.useEffect(() => {

    async function initialize() {
      // 
    }

    initialize();
    return () => {
      // clean up function
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function rebuildGroupsManagedObject({ source, target }) {

    let OGGroupList = Object.keys(reactData.groupsManagedObject);
    let sourceAt = OGGroupList.indexOf(source);
    let sourceOGLevel = reactData.groupsManagedObject[source].level;

    // first, gather up everything form the source location until - but not including the next item at the same or high level than the source is at
    let sourceHierarchyLength = 1;
    for (let i = sourceAt + 1; i < OGGroupList.length; i++) {
      if (reactData.groupsManagedObject[OGGroupList[i]].level <= sourceOGLevel) {
        break;
      }
      sourceHierarchyLength++;
    }
    let beforeSourceHierarchy = OGGroupList.slice(0, sourceAt);
    let sourceHierarchy = OGGroupList.slice(sourceAt, sourceAt + sourceHierarchyLength);
    let afterSourceHierarchy = OGGroupList.slice(sourceAt + sourceHierarchyLength);

    let targetAt = OGGroupList.indexOf(target);
    if (targetAt > sourceAt && targetAt < (sourceAt + sourceHierarchyLength)) {
      // This is a problem.  An item cannot be moved to become its own child.  Do not update the group hierarchy and instead just return.
      return false;
    }

    // we need to reset the level numbers for all groups in the source hierarchy.
    const target_level = reactData.groupsManagedObject[OGGroupList[targetAt]].level;  // first, get the target's level
    const source_level = reactData.groupsManagedObject[OGGroupList[sourceAt]].level;  // now, get the source's level
    const level_diff = target_level - source_level + 1;  // now, we can loop through the source hierarchy and update the level numbers for each item in the source hierarchy
    sourceHierarchy.forEach((group_id) => {
      reactData.groupsManagedObject[group_id].level += level_diff;
    });

    let newGroupObject = {};
    let newGroupList = [];
    if (targetAt < sourceAt) {
      let upToTarget = beforeSourceHierarchy.slice(0, targetAt + 1);
      let afterTarget = beforeSourceHierarchy.slice(targetAt + 1);
      // new list is upToTarget + sourceHierarchy + afterTarget + afterSourceHierarchy
      newGroupList = upToTarget.concat(sourceHierarchy).concat(afterTarget).concat(afterSourceHierarchy);
    }
    else {  // we already ruled out target being IN the sourceHieracrhy, so the target must be after the source hierarchy.  In this case, we want to insert the source hierarchy after the target item, which means we want everything up to and including the target, then the source hierarchy, then everything after the target until we get to the source hierarchy, then everything after the source hierarchy.
      targetAt = targetAt - beforeSourceHierarchy.length - sourceHierarchy.length;  // we need to adjust the target index to account for the fact that the source hierarchy will be removed from the list before being reinserted at the target location.
      let upToTarget = afterSourceHierarchy.slice(0, targetAt + 1);
      let afterTarget = afterSourceHierarchy.slice(targetAt + 1);
      // new list is beforeSourceHierarchy + upToTarget + sourceHierarchy + afterTarget
      newGroupList = beforeSourceHierarchy.concat(upToTarget).concat(sourceHierarchy).concat(afterTarget);
    }

    // now, we need to full replace the groupsManagedObject with a new object that has the same items but in the new order and with the updated level numbers for the source hierarchy.
    newGroupList.forEach((group_id) => {
      newGroupObject[group_id] = reactData.groupsManagedObject[group_id];
    });
    return newGroupObject;

  }

  // True when candidateID is sourceID itself, or falls within sourceID's contiguous subtree run
  // groupsManagedObject is ordered as a flattened tree, so a group has children iff the very next
  // entry's level is greater than its own.
  function groupHasChildren(groupId) {
    const groupKeys = Object.keys(reactData.groupsManagedObject);
    const idx = groupKeys.indexOf(groupId);
    if ((idx < 0) || (idx === groupKeys.length - 1)) { return false; }
    return reactData.groupsManagedObject[groupKeys[idx + 1]].level > reactData.groupsManagedObject[groupId].level;
  }

  // in groupsManagedObject (same "contiguous run while level > source level" pattern used elsewhere
  // in this file) - either case would create a circular reference if candidateID became the new parent.
  function isSelfOrDescendant(sourceID, candidateID) {
    if (candidateID === sourceID) { return true; }
    const groupKeys = Object.keys(reactData.groupsManagedObject);
    const sourceIdx = groupKeys.indexOf(sourceID);
    const candidateIdx = groupKeys.indexOf(candidateID);
    if ((sourceIdx < 0) || (candidateIdx <= sourceIdx)) { return false; }
    const sourceLevel = reactData.groupsManagedObject[sourceID].level;
    for (let i = sourceIdx + 1; i <= candidateIdx; i++) {
      if (reactData.groupsManagedObject[groupKeys[i]].level <= sourceLevel) { return false; }
    }
    return true;
  }

  // Step 1 of Move/Duplicate: open QuickSearch scoped to groups-only, single-pick, initially
  // collapsed (QuickSearch's own default) so the user can browse the FULL hierarchy - including
  // branches outside this section's target+descendants view - to choose a new parent group.
  function openGroupParentPicker(sourceGroupId, mode) {
    if (anyEditActive) { return; }
    setGroupParentPickerData({ selections: [] });
    setGroupParentPickerContext({ sourceGroupId, mode });
  }

  async function handleGroupParentPicked(selections) {
    const { sourceGroupId, mode } = groupParentPickerContext || {};
    setGroupParentPickerContext(null);
    const picked = (selections || [])[0];
    if (!picked?.group_id || !sourceGroupId) { return; }
    // Cycle-check only applies to Move (rewrites belongs_to on an EXISTING group). Duplicate always
    // creates brand-new group_ids that only ever point outward to a real node, so nesting a duplicate
    // under its own source (or one of its descendants) is structurally fine - no cycle is possible.
    if ((mode === 'move') && isSelfOrDescendant(sourceGroupId, picked.group_id)) {
      await updateField({
        reactUpd: {
          alert: {
            severity: 'warning',
            title: 'Circular Reference',
            message: (picked.group_id === sourceGroupId)
              ? `"${reactData.groupsManagedObject[sourceGroupId]?.group_name}" can't be its own parent.`
              : `"${picked.group_name}" is already a descendant of "${reactData.groupsManagedObject[sourceGroupId]?.group_name}". Choose a different group.`,
          }
        }
      });
      return;
    }
    if (mode === 'move') {
      // Gate the actual move behind a confirmation prompt (mirrors the delete/reparent confirms elsewhere in this file)
      setConfirmMoveTarget({ sourceGroupId, newParent: picked });
    }
    else if (mode === 'duplicate') {
      await performDuplicateGroupTree(sourceGroupId, picked);
    }
  }

  // Re-parents sourceGroupId under newParent.group_id. Like add/rename in this file, this is staged
  // locally and only committed to the DB when the user hits Save back in GroupMaintenance - it is NOT
  // permanent yet (unlike Delete, which executes immediately).
  async function performMoveGroup(sourceGroupId, newParent) {
    const newGroupObject = rebuildGroupsManagedObject({ source: sourceGroupId, target: newParent.group_id });
    if (!newGroupObject) {
      // Defensive fallback - openGroupParentPicker's cycle check should already have caught this.
      await updateField({
        reactUpd: {
          alert: {
            severity: 'warning',
            title: 'Circular Reference',
            message: `A group cannot be moved to become its own child.`,
          }
        }
      });
      return;
    }

    // admin_list is checked per-group only (see AVAGroups.js's is_responsible) - it is never inherited
    // from an ancestor - so the new parent's admins need to be explicitly unioned onto the moved group
    // AND every one of its descendants, or they'd have no actual access to what they now structurally
    // own. Additive only: an existing admin is never removed as a side effect of a move.
    const newParentRec = await dbClient
      .get({ TableName: 'Groups', Key: { client_id: reactData.client_id, group_id: newParent.group_id } })
      .promise()
      .catch(() => null);
    if (!newParentRec?.Item) {
      await updateField({
        reactUpd: {
          alert: {
            severity: 'error',
            title: 'Move failed',
            message: `Couldn't load "${newParent.group_name}" from the database. Please try again.`,
          }
        }
      });
      return;
    }
    const newParentAdminList = newParentRec.Item.admin_list || [];

    const groupKeys = Object.keys(reactData.groupsManagedObject);
    const sourceIdx = groupKeys.indexOf(sourceGroupId);
    const sourceLevel = reactData.groupsManagedObject[sourceGroupId].level;
    const subtreeIds = [sourceGroupId];
    for (let i = sourceIdx + 1; i < groupKeys.length; i++) {
      if (reactData.groupsManagedObject[groupKeys[i]].level <= sourceLevel) { break; }
      subtreeIds.push(groupKeys[i]);
    }

    const pendingAdds = reactData.groupsToAdd || [];
    const resolved = await Promise.all(subtreeIds.map(async (id) => {
      const pending = pendingAdds.find((g) => (g.group_id === id));
      if (pending) { return { id, admin_list: pending.admin_list || [], via: 'pending' }; }
      if (id === currentValues.Groups.group_id) { return { id, admin_list: currentValues.Groups.admin_list || [], via: 'self' }; }
      const rec = await dbClient.get({ TableName: 'Groups', Key: { client_id: reactData.client_id, group_id: id } }).promise().catch(() => null);
      return { id, admin_list: rec?.Item?.admin_list || [], via: 'db' };
    }));
    const unionAdmins = (adminList) => Array.from(new Set([...adminList, ...newParentAdminList]));

    const movedGroupName = reactData.groupsManagedObject[sourceGroupId]?.group_name;
    const reactUpd = {
      groupsManagedObject: newGroupObject,
      alert: {
        severity: 'success',
        title: 'Move staged',
        message: `"${movedGroupName}" will move under "${newParent.group_name}" when you Save.`,
      }
    };

    // Pending (not-yet-saved) records get their admin_list patched in place.
    reactUpd.groupsToAdd = pendingAdds.map((g) => {
      const match = resolved.find((r) => ((r.id === g.group_id) && (r.via === 'pending')));
      return match ? { ...g, admin_list: unionAdmins(match.admin_list) } : g;
    });

    // Already-persisted descendants (and the root, when it's not routed through the two branches
    // below) get a targeted admin_list-only update, applied at Save time.
    const dbUpdates = resolved
      .filter((r) => (r.via === 'db'))
      .map((r) => ({ group_id: r.id, admin_list: unionAdmins(r.admin_list) }));
    reactUpd.groupsToUpdateAdmins = [
      ...(reactData.groupsToUpdateAdmins || []).filter((g) => !dbUpdates.some((d) => (d.group_id === g.group_id))),
      ...dbUpdates
    ];

    if (pendingAdds.some((g) => (g.group_id === sourceGroupId))) {
      // Not yet persisted (created earlier in this same editing session) - just update the pending record's parent.
      reactUpd.groupsToAdd = reactUpd.groupsToAdd.map((g) => ((g.group_id === sourceGroupId) ? { ...g, belongs_to: newParent.group_id } : g));
      await updateField({ reactUpd });
    }
    else if (sourceGroupId === currentValues.Groups.group_id) {
      // The group GroupMaintenance itself is editing - route through current.Groups.belongs_to/admin_list
      // so the normal og/current save diff picks it up.
      const selfMatch = resolved.find((r) => (r.via === 'self'));
      await updateField({
        updateList: [
          { tableName: 'Groups', fieldName: 'belongs_to', newData: newParent.group_id, refresh_onExit: true },
          { tableName: 'Groups', fieldName: 'admin_list', newData: unionAdmins(selfMatch?.admin_list || []) }
        ],
        reactUpd
      });
    }
    else {
      // An already-persisted descendant/other group - queue a targeted belongs_to update, applied at
      // Save time (see GroupMaintenance.js's saveChanges()), same pattern as groupsToRename.
      reactUpd.groupsToReparent = [
        ...(reactData.groupsToReparent || []).filter((g) => (g.group_id !== sourceGroupId)),
        { group_id: sourceGroupId, belongs_to: newParent.group_id }
      ];
      reactUpd.refresh_onExit = true;
      await updateField({ reactUpd });
    }
  }

  // Duplicates sourceGroupId AND its entire subtree as brand-new groups (fresh group_ids, same names),
  // nested under newParent the same way the source subtree was nested under its own original parent.
  // No cycle-check needed here (see handleGroupParentPicked): these are all new records, so this can
  // never rewrite an existing group's belongs_to into a loop - staged into groupsToAdd like a normal
  // "add group", only persisted when the user hits Save back in GroupMaintenance.
  async function performDuplicateGroupTree(sourceGroupId, newParent) {
    const groupKeys = Object.keys(reactData.groupsManagedObject);
    const sourceIdx = groupKeys.indexOf(sourceGroupId);
    const sourceLevel = reactData.groupsManagedObject[sourceGroupId].level;
    const subtreeIds = [sourceGroupId];
    for (let i = sourceIdx + 1; i < groupKeys.length; i++) {
      if (reactData.groupsManagedObject[groupKeys[i]].level <= sourceLevel) { break; }
      subtreeIds.push(groupKeys[i]);
    }

    // groupsManagedObject entries are a trimmed UI projection (group_name/group_type/level/role only -
    // no client_id, belongs_to, admin_list, group_rules, etc.), so the real Groups records have to be
    // fetched fresh here - spreading the local entry would silently write incomplete rows to the DB.
    const [fullRecords, newParentRec] = await Promise.all([
      Promise.all(subtreeIds.map((id) => dbClient
        .get({ TableName: 'Groups', Key: { client_id: reactData.client_id, group_id: id } })
        .promise()
        .catch(() => null))),
      dbClient.get({ TableName: 'Groups', Key: { client_id: reactData.client_id, group_id: newParent.group_id } }).promise().catch(() => null)
    ]);
    if (fullRecords.some((r) => !r?.Item) || !newParentRec?.Item) {
      await updateField({
        reactUpd: {
          alert: {
            severity: 'error',
            title: 'Duplicate failed',
            message: `Couldn't load one or more groups in this subtree from the database. Please try again.`,
          }
        }
      });
      return;
    }
    // admin_list is checked per-group only (never inherited from an ancestor - see AVAGroups.js's
    // is_responsible), so every duplicated group needs the new parent's admins unioned in, plus the
    // person doing the duplicating, alongside whatever admins the original group already had.
    const newParentAdminList = newParentRec.Item.admin_list || [];

    const newParentLevel = reactData.groupsManagedObject[newParent.group_id]?.level ?? sourceLevel - 1;
    const levelDiff = (newParentLevel + 1) - sourceLevel;
    const timestamp = new Date().getTime();
    const idMap = {}; // old group_id -> new group_id, filled in top-down order so parents resolve before their children

    const newGroups = subtreeIds.map((oldId, i) => {
      const original = fullRecords[i].Item;
      const slug = (original.group_name || original.name || 'group').toLowerCase().replace(/\s/g, '_');
      const newId = `${slug}_${timestamp}_${i}`;
      idMap[oldId] = newId;
      const newAdminSet = new Set([...(original.admin_list || []), ...newParentAdminList]);
      newAdminSet.add(reactData.user_id);
      newAdminSet.add(reactData.person_id);
      // `level` isn't a stored Groups column (it's derived by getGroupHierarchy from belongs_to
      // depth), so `original.level` here is always undefined — read it from the local UI tree instead.
      return {
        ...original,
        group_id: newId,
        belongs_to: (oldId === sourceGroupId) ? newParent.group_id : idMap[original.belongs_to],
        level: reactData.groupsManagedObject[oldId].level + levelDiff,
        admin_list: Array.from(newAdminSet),
      };
    });

    // Splice the new subtree into the local tree right after newParent's own last existing descendant.
    const newParentIdx = groupKeys.indexOf(newParent.group_id);
    let insertAfterIdx = newParentIdx;
    for (let i = newParentIdx + 1; i < groupKeys.length; i++) {
      if (reactData.groupsManagedObject[groupKeys[i]].level <= newParentLevel) { break; }
      insertAfterIdx = i;
    }
    const newGroupManagedObject = {};
    for (let i = 0; i <= insertAfterIdx; i++) { newGroupManagedObject[groupKeys[i]] = reactData.groupsManagedObject[groupKeys[i]]; }
    newGroups.forEach((g) => {
      // groupsManagedObject only ever needs the UI projection fields, not the full DB record.
      // Groups DB records store the name under `name` - `group_name` is a derived/UI-only field
      // (same "not actually a DB column" gotcha as `level`), so read it from `g.name` here.
      newGroupManagedObject[g.group_id] = { group_name: g.name, group_type: g.group_type, group_id: g.group_id, level: g.level };
    });
    for (let i = insertAfterIdx + 1; i < groupKeys.length; i++) { newGroupManagedObject[groupKeys[i]] = reactData.groupsManagedObject[groupKeys[i]]; }
    const subGroupCount = newGroups.length - 1;
    await updateField({
      reactUpd: {
        groupsManagedObject: newGroupManagedObject,
        groupsToAdd: [...(reactData.groupsToAdd || []), ...newGroups],
        alert: {
          severity: 'success',
          title: 'Duplicate staged',
          message: `"${reactData.groupsManagedObject[sourceGroupId]?.group_name}"${(subGroupCount > 0) ? ` (and its ${subGroupCount} sub-group${(subGroupCount === 1) ? '' : 's'})` : ''} will be duplicated under "${newParent.group_name}" when you Save.`,
        }
      }
    });
  }

  async function saveRenameGroup(group_id) {
    const newName = (tempRenameValue || '').trim();
    setTempRenameTarget(null);
    setTempRenameValue("");
    if (!newName || (newName === reactData.groupsManagedObject[group_id]?.group_name)) {
      return;
    }

    const updatedGMO = { ...reactData.groupsManagedObject };
    updatedGMO[group_id] = { ...updatedGMO[group_id], name: newName, group_name: newName };
    const reactUpd = { groupsManagedObject: updatedGMO };

    if ((reactData.groupsToAdd || []).some((g) => (g.group_id === group_id))) {
      // Not yet persisted (created earlier in this same editing session) - just update the pending record.
      reactUpd.groupsToAdd = reactData.groupsToAdd.map((g) => ((g.group_id === group_id) ? { ...g, name: newName, group_name: newName } : g));
    }
    else if (group_id !== currentValues.Groups.group_id) {
      // An already-persisted group other than the one GroupMaintenance itself was opened for - queue a
      // targeted rename to be applied at Save time (see GroupMaintenance.js's saveChanges()).
      reactUpd.groupsToRename = [
        ...(reactData.groupsToRename || []).filter((g) => (g.group_id !== group_id)),
        { group_id, name: newName }
      ];
    }

    if (group_id === currentValues.Groups.group_id) {
      // The group GroupMaintenance itself is editing - go through current.Groups.name so the header,
      // Profile section, and the normal og/current save diff all stay in sync.
      await updateField({
        updateList: [{ tableName: 'Groups', fieldName: 'name', newData: newName, keyChange: true }],
        reactUpd
      });
    }
    else {
      await updateField({ reactUpd });
    }
  }

  async function checkGroupHasMembers(group_id) {
    // Live existence check against PeopleGroups (status-index) - we only need to know if any
    // active member row exists, not who they are, so Limit:1 keeps this cheap.
    const cgid = `${reactData.client_id}~${group_id}`;
    const result = await dbClient
      .query({
        TableName: 'PeopleGroups',
        IndexName: 'status-index',
        KeyConditionExpression: 'client_group_id = :cgid AND membership_status = :active',
        ExpressionAttributeValues: { ':cgid': cgid, ':active': 'active' },
        Limit: 1
      })
      .promise()
      .catch((error) => { cl('GroupHierarchySection: membership check failed', error); return null; });
    return ((result?.Items?.length || 0) > 0);
  }

  async function requestDeleteGroup(group_id) {
    if (anyEditActive) {
      return;
    }
    const hasMembers = await checkGroupHasMembers(group_id);
    if (hasMembers) {
      await updateField({
        reactUpd: {
          alert: {
            severity: 'error',
            title: `${reactData.groupsManagedObject[group_id]?.group_name} has members`,
            message: `You can't remove this group unless it is empty.  Reassign or remove its members first.`,
          }
        }
      });
      return;
    }
    setConfirmDeleteTarget(group_id);
  }

  async function performDeleteGroup(group_id) {
    setConfirmDeleteTarget(null);

    const groupKeys = Object.keys(reactData.groupsManagedObject);
    const deleteAt = groupKeys.indexOf(group_id);
    const deleteLevel = reactData.groupsManagedObject[group_id].level;

    // gather this group's whole subtree - the contiguous run right after it whose level stays > deleteLevel
    let subtreeLength = 0;
    for (let i = deleteAt + 1; i < groupKeys.length; i++) {
      if (reactData.groupsManagedObject[groupKeys[i]].level <= deleteLevel) { break; }
      subtreeLength++;
    }
    // only the DIRECT children need their belongs_to reassigned - deeper descendants stay under their own parent
    const directChildIds = groupKeys
      .slice(deleteAt + 1, deleteAt + 1 + subtreeLength)
      .filter((id) => (reactData.groupsManagedObject[id].level === deleteLevel + 1));
    // the deleted group's own parent - nearest preceding entry with a shallower level
    let newParentForChildren = null;
    for (let i = deleteAt - 1; i >= 0; i--) {
      if (reactData.groupsManagedObject[groupKeys[i]].level < deleteLevel) {
        newParentForChildren = groupKeys[i];
        break;
      }
    }

    const isPendingNew = (reactData.groupsToAdd || []).some((g) => (g.group_id === group_id));
    if (!isPendingNew) {
      for (const childId of directChildIds) {
        await dbClient
          .update({
            TableName: 'Groups',
            Key: { client_id: reactData.client_id, group_id: childId },
            UpdateExpression: 'SET belongs_to = :b',
            ExpressionAttributeValues: { ':b': newParentForChildren }
          })
          .promise()
          .catch((error) => { cl('GroupHierarchySection: reparent-on-delete failed', error); });
      }
      await dbClient
        .delete({
          TableName: 'Groups',
          Key: { client_id: reactData.client_id, group_id }
        })
        .promise()
        .catch((error) => { cl('GroupHierarchySection: group delete failed', error); });
    }

    // rebuild the local list: drop the deleted entry, decrement level for the rest of its subtree
    const deletedGroupName = reactData.groupsManagedObject[group_id]?.group_name;
    const updatedGMO = {};
    groupKeys.forEach((key, i) => {
      if (key === group_id) { return; }
      updatedGMO[key] = ((i > deleteAt) && (i <= deleteAt + subtreeLength))
        ? { ...reactData.groupsManagedObject[key], level: reactData.groupsManagedObject[key].level - 1 }
        : reactData.groupsManagedObject[key];
    });

    await updateField({
      reactUpd: {
        groupsManagedObject: updatedGMO,
        groupsToAdd: (reactData.groupsToAdd || []).filter((g) => (g.group_id !== group_id)),
        groupsToRename: (reactData.groupsToRename || []).filter((g) => (g.group_id !== group_id)),
        refresh_onExit: true,
        alert: {
          severity: 'success',
          title: `${deletedGroupName} removed`,
          message: `${deletedGroupName} was successfully removed.`,
        }
      }
    });
  }

  // groupsManagedObject is a flattened, level-ordered tree of every group the caller has access to.
  // This section should only ever display the target group (currentValues.Groups.group_id) and its
  // descendants - the descendant run is the contiguous block of entries right after it whose level
  // is strictly greater than the target's level, ending at the first entry back at/above that level.
  // targetLevel is also used to rebase indentation so the target group renders as level 0.
  const { visibleGroupIds, targetLevel } = React.useMemo(() => {
    const groupKeys = Object.keys(reactData.groupsManagedObject);
    const targetID = currentValues.Groups.group_id;
    const targetIdx = groupKeys.indexOf(targetID);
    const level = reactData.groupsManagedObject[targetID]?.level ?? 0;
    if (targetIdx < 0) { return { visibleGroupIds: new Set(groupKeys), targetLevel: level }; }   // shouldn't happen - fail open rather than showing nothing
    const visible = new Set([targetID]);
    for (let i = targetIdx + 1; i < groupKeys.length; i++) {
      if (reactData.groupsManagedObject[groupKeys[i]].level <= level) { break; }
      visible.add(groupKeys[i]);
    }
    return { visibleGroupIds: visible, targetLevel: level };
  }, [reactData.groupsManagedObject, currentValues.Groups.group_id]);

  // Shared tight-spacing styles for the row action menu's items/icons.
  const actionMenuItemStyle = { paddingTop: '1px', paddingBottom: '1px', minHeight: 'auto' };
  const actionMenuIconStyle = { minWidth: '2rem' };

  return (
    <Box
      key={`profileSection_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Paper component={Box} elevation={0} overflow='auto' square
        style={{ scrollbarWidth: 'none', flexGrow: 1, display: 'flex' }}
      >
        <Box display='flex' flexDirection='column'
          key={`groupsManagedBox`}
          justifyContent='flex-start'
          alignItems='flex-start'
          style={{ width: '100%' }}
        >
          {Object.keys(reactData.groupsManagedObject).map((listEntry, listIndex) => (
            <React.Fragment key={`frag_${listIndex}`}>
              {visibleGroupIds.has(listEntry) &&
                (((reactData.groupsManagedObject[listEntry].level - targetLevel) < 3) ||
                !(reactData.levelHidden?.[listIndex] ?? false)) &&
                <Box
                  display='flex' flexDirection='column'
                  justifyContent='center'
                  alignItems='flex-start'
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderRadius: '8px',
                    backgroundColor: (actionMenuTarget === listEntry) ? '#e3f2fd' : 'transparent',
                    marginTop: 0.5, marginBottom: 0.5,
                  }}
                  key={`group-list_${listIndex}`}
                >
                  <Box
                    display='flex' flexDirection='row' alignItems='center' justifyContent='flex-start'
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      paddingLeft: ((reactData.groupsManagedObject[listEntry].level - targetLevel) * 1.5) + 'rem',
                    }}
                  >
                    <Box
                      display='flex' alignItems='center' justifyContent='center'
                      style={{ width: '2rem', flexShrink: 0 }}
                    >
                      {(tempRenameTarget !== listEntry) &&
                        <IconButton
                          size='small'
                          aria-label='group actions'
                          disabled={anyEditActive}
                          style={{ padding: '0.25rem', opacity: anyEditActive ? 0.3 : 1 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActionMenuAnchor(e.currentTarget);
                            setActionMenuTarget(listEntry);
                          }}
                        >
                          <MoreVertIcon style={{ fontSize: '1.1rem' }} />
                        </IconButton>
                      }
                    </Box>
                    <Box
                      display='flex' flexDirection='row' alignItems='center'
                      style={{
                        minWidth: 0,
                      }}
                    >
                      {(tempRenameTarget === listEntry) ?
                        <React.Fragment key={`rename_frag_${listIndex}`}>
                          <TextField
                            key={`rename_input_${listIndex}`}
                            defaultValue={reactData.groupsManagedObject[listEntry].group_name}
                            onChange={(e) => {
                              setTempRenameValue(e.target.value);
                            }}
                            style={AVATextStyle({ size: 1.0, margin: { top: -0.2, bottom: 0 } })}
                          />
                          <SaveIcon
                            style={{ fontSize: '0.9rem', marginLeft: '0.5rem', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              saveRenameGroup(listEntry);
                            }}
                          />
                          <HighlightOffIcon
                            style={{ fontSize: '0.9rem', marginLeft: '0.4rem', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setTempRenameTarget(null);
                              setTempRenameValue("");
                            }}
                          />
                        </React.Fragment>
                        :
                        <Typography
                          key={`g_text_${listIndex}`}
                          style={AVATextStyle({
                            size: 1.2,
                            margin: { top: 0.2 },
                            ...(currentValues.Groups.belongs_to === listEntry
                              ? { color: 'orange', bold: true }
                              : (currentValues.Groups.group_id === listEntry
                                ? { color: 'blue', bold: true }
                                : (((reactData.groupsToAdd || []).some((groupObj) => (groupObj.group_id === listEntry)))
                                  ? { color: 'green', bold: true }
                                  : {}
                                )
                              )
                            ),
                          })}
                        >
                          {reactData.groupsManagedObject[listEntry].group_name}
                        </Typography>
                      }
                    </Box>
                  </Box>
                  {tempBelongsTo === listEntry &&
                    <Box
                      display='flex' flexDirection='row'
                      justifyContent='flex-start'
                      alignItems='center'
                      style={{
                        marginLeft: '1.5rem',
                        marginTop: 0.5, marginBottom: 0.5,
                      }}
                      key={`group-list_${listIndex}`}
                    >
                      <TextField
                        key={`g_input_${listIndex}_${addRowSeed}`}
                        defaultValue={""}
                        onChange={(e) => {
                          setTempName(e.target.value);
                        }}
                        style={AVATextStyle({ size: 1.0, margin: { top: -0.2, bottom: 0 } })}
                      />
                      <SaveIcon
                        style={{ fontSize: '0.9rem', marginLeft: '0.5rem', cursor: 'pointer' }}
                        onClick={async (e) => {
                          e.stopPropagation();
                          // We will save the new name for the current group, but only if the tempName is not empty and is different from the current name.  If those conditions are not met, we will not make the update and instead just return.
                          if (tempName && tempName.trim() !== '') {
                            let timestamp = new Date().getTime();
                            const new_GroupID = `${tempName.toLowerCase().replace(/\s/g, '_')}_${timestamp}`;  // create a new group_id by taking the tempName, converting to lowercase, and replacing spaces with underscores
                            // groupsManagedObject is a trimmed UI projection with no admin_list - fetch the
                            // parent's real admin_list (from the pending add, or live from the DB) so it's
                            // actually inherited rather than always starting empty.
                            const pendingParent = (reactData.groupsToAdd || []).find((g) => (g.group_id === listEntry));
                            let parentAdminList = pendingParent?.admin_list;
                            if (!parentAdminList) {
                              const parentRec = await dbClient.get({ TableName: 'Groups', Key: { client_id: reactData.client_id, group_id: listEntry } }).promise().catch(() => null);
                              parentAdminList = parentRec?.Item?.admin_list || [];
                            }
                            const newAdminSet = new Set(parentAdminList);
                            newAdminSet.add(reactData.user_id);  // add the current user to the admin list for the new group, since they are creating the new group and should have admin permissions for it 
                            newAdminSet.add(reactData.person_id);  // also add the current person to the admin list for the new group, since they are creating the new group and should have admin permissions for it
                            const newGroupObject = {
                              group_id: new_GroupID,
                              "name": tempName,
                              group_name: tempName,
                              client_id: reactData.client_id,
                              belongs_to: listEntry,
                              group_type: 'admin',
                              admin_list: Array.from(newAdminSet),
                              level: reactData.groupsManagedObject[listEntry].level + 1,
                            };
                            reactData.groupsToAdd.push(newGroupObject);  // we need to add a new entry to the groupsToAdd array for the new group we are creating, which will be added to the database when the user clicks "Save Changes".  We can just push an empty object here because the group_id and name will be the same as the current group, which is being updated rather than a new group being created.  The important thing is that we are adding an entry to the groupsToAdd array so that the backend knows to update the group hierarchy for this group when we save changes.
                            const pendingAddIconGroups = [
                              ...(reactData.pendingAddIconGroups || []),
                              new_GroupID
                            ].filter((groupID, idx, arr) => arr.indexOf(groupID) === idx);
                            // Now, insert this group into the groupsManagedObject in the correct location based on its level number, which is one level below the current group.  To do this, we can loop through the groupsManagedObject and find the correct location to insert the new group based on its level number.  We want to insert it after the last group that has a level number less than or equal to the new group's level number.
                            // now, we need to full replace the groupsManagedObject with a new object that has the same items but in the new order and with the updated level numbers for the source hierarchy.
                            let newGroupManagedObject = {};
                            for (let i = 0; i <= listIndex; i++) {
                              let this_groupID = Object.keys(reactData.groupsManagedObject)[i];
                              newGroupManagedObject[this_groupID] = reactData.groupsManagedObject[this_groupID];
                            }
                            newGroupManagedObject[new_GroupID] = newGroupObject;
                            for (let i = listIndex + 1; i < Object.keys(reactData.groupsManagedObject).length; i++) {
                              let this_groupID = Object.keys(reactData.groupsManagedObject)[i];
                              newGroupManagedObject[this_groupID] = reactData.groupsManagedObject[this_groupID];
                            }
                            // Leave tempBelongsTo set to this same parent so the row stays open for adding
                            // another sibling - only the X icon (below) closes it and stops the proliferation.
                            setTempName("");
                            setAddRowSeed((seed) => seed + 1);
                            await updateField({
                              reactUpd: {
                                groupsManagedObject: newGroupManagedObject,
                                groupsToAdd: reactData.groupsToAdd,
                                pendingAddIconGroups,
                              }
                            });
                          }
                        }}
                      />
                      <HighlightOffIcon
                        style={{ fontSize: '0.9rem', marginLeft: '0.4rem', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTempBelongsTo(null);
                          setTempName("");
                        }}
                      />
                    </Box>
                  }
                </Box>
              }
            </React.Fragment>
          ))}
        </Box>
      </Paper >

      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={() => { setActionMenuAnchor(null); setActionMenuTarget(null); }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ style: { borderRadius: '30px', paddingTop: '16px', paddingBottom: '16px' } }}
        MenuListProps={{ dense: true, style: { paddingTop: 0, paddingBottom: 0 } }}
      >
        <MenuItem
          dense
          style={actionMenuItemStyle}
          onClick={() => {
            const target = actionMenuTarget;
            setActionMenuAnchor(null); setActionMenuTarget(null);
            setTempBelongsTo(target);
          }}
        >
          <ListItemIcon style={actionMenuIconStyle}><AddCircleOutlineIcon fontSize='small' /></ListItemIcon>
          <ListItemText primary='Add child group' />
        </MenuItem>
        <MenuItem
          dense
          style={actionMenuItemStyle}
          onClick={() => {
            const target = actionMenuTarget;
            setActionMenuAnchor(null); setActionMenuTarget(null);
            setTempRenameTarget(target);
            setTempRenameValue(reactData.groupsManagedObject[target]?.group_name);
          }}
        >
          <ListItemIcon style={actionMenuIconStyle}><EditIcon fontSize='small' /></ListItemIcon>
          <ListItemText primary='Rename' />
        </MenuItem>
        <MenuItem
          dense
          style={actionMenuItemStyle}
          onClick={() => {
            const target = actionMenuTarget;
            setActionMenuAnchor(null); setActionMenuTarget(null);
            openGroupParentPicker(target, 'move');
          }}
        >
          <ListItemIcon style={actionMenuIconStyle}><OpenWithIcon fontSize='small' /></ListItemIcon>
          <ListItemText primary='Move to a different parent' />
        </MenuItem>
        <MenuItem
          dense
          style={actionMenuItemStyle}
          onClick={() => {
            const target = actionMenuTarget;
            setActionMenuAnchor(null); setActionMenuTarget(null);
            openGroupParentPicker(target, 'duplicate');
          }}
        >
          <ListItemIcon style={actionMenuIconStyle}><FileCopyIcon fontSize='small' /></ListItemIcon>
          <ListItemText primary={groupHasChildren(actionMenuTarget) ? 'Duplicate this group tree' : 'Duplicate this group'} />
        </MenuItem>
        {(actionMenuTarget !== currentValues.Groups.group_id) &&
          <MenuItem
            dense
            style={actionMenuItemStyle}
            onClick={() => {
              const target = actionMenuTarget;
              setActionMenuAnchor(null); setActionMenuTarget(null);
              requestDeleteGroup(target);
            }}
          >
            <ListItemIcon style={actionMenuIconStyle}><DeleteIcon fontSize='small' /></ListItemIcon>
            <ListItemText primary='Delete' />
          </MenuItem>
        }
      </Menu>

      {(confirmMoveTarget !== null) &&
        <AVAConfirm
          promptText={[
            'Are you sure?',
            `Move "${reactData.groupsManagedObject?.[confirmMoveTarget.sourceGroupId]?.group_name || 'this group'}" to become a child of "${confirmMoveTarget.newParent.group_name}"? This won't take effect until you Save.`
          ]}
          cancelText={'Cancel'}
          confirmText={'Move'}
          onCancel={() => {
            setConfirmMoveTarget(null);
          }}
          onConfirm={async () => {
            const { sourceGroupId, newParent } = confirmMoveTarget;
            setConfirmMoveTarget(null);
            await performMoveGroup(sourceGroupId, newParent);
          }}
        />
      }

      {(confirmDeleteTarget !== null) &&
        <AVAConfirm
          promptText={[
            'Are you sure?',
            `Delete "${reactData.groupsManagedObject?.[confirmDeleteTarget]?.group_name || 'this group'}"? This cannot be undone.`
          ]}
          cancelText={'Cancel'}
          confirmText={'Delete'}
          onCancel={() => {
            setConfirmDeleteTarget(null);
          }}
          onConfirm={async () => {
            await performDeleteGroup(confirmDeleteTarget);
          }}
        />
      }

      {(groupParentPickerContext !== null) &&
        <QuickSearch
          reactData={groupParentPickerData}
          updateReactData={(newData) => {
            setGroupParentPickerData(prev => Object.assign({}, prev, newData));
          }}
          options={{
            title: (groupParentPickerContext.mode === 'duplicate')
              ? `Duplicate "${reactData.groupsManagedObject[groupParentPickerContext.sourceGroupId]?.group_name}" under which group?`
              : `Move "${reactData.groupsManagedObject[groupParentPickerContext.sourceGroupId]?.group_name}" to which new parent group?`,
            withGroups: true,
            withPreferred: false,
            hidePeople: true,
            showGroupList: true,
            showAll: true,
            pickOne: true,
          }}
          onClose={handleGroupParentPicked}
        />
      }

    </Box >
  );
};
