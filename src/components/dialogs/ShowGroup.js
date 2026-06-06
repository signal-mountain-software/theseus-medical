import React from 'react';
import { getRole, getAllGroups, getGroupsBelongTo, getPersonGroups, accountAccess } from '../../util/AVAGroups';
import { SET_GROUPS, SET_ACCESSLIST } from '../../contexts/Session/actions';

import Dialog from '@material-ui/core/Dialog';
import Slide from '@material-ui/core/Slide';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';

import GroupControl from '../forms/GroupControl';
import { makeArray } from '../../util/AVAUtilities';

import useSession from '../../hooks/useSession';

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ options, defaults, onClose, onAbort }) => {

  let { pSession, pGroup_id, showList } = options;  // eslint-disable-line no-unused-vars

  const [reactData, setReactData] = React.useState({
    groupsManagedObject: null,
    preSelectedGroup: null,
    preSelectedFunction: null,
    directoryGroupIds: null,
    groupControlKey: 0,
    updatesMade: false,
  });

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  const { state, dispatch } = useSession();

  const prepareGroupObject = async (pGroupList, localGroups = null, localAccessList = null) => {
    const groups = localGroups || state.groups;
    const accessList = localAccessList || state.accessList;
    let selectAll = pGroupList.includes('*all');
    let selectOpen = pGroupList.includes('*all_open') || pGroupList.includes('*all_public');
    let selectPrivate = pGroupList.includes('*all_closed') || pGroupList.includes('*all_private');
    const selectMine = !pGroupList || (pGroupList.length === 0) || (pGroupList.includes('*user'));
    const authorized_groups = accessList?.[state.session.client_id]?.groups || [];
    // When explicit group IDs are passed in pGroupList, treat them as implicitly authorized
    // so that callers can request a specific group's directory regardless of the user's own
    // membership.  Wildcards (*all, *user, etc.) are NOT treated as explicit IDs.
    const wildcards = ['*all', '*all_open', '*all_public', '*all_closed', '*all_private', '*user', '*responsible'];
    const explicitGroupIds = pGroupList.filter(id => !wildcards.includes(id));
    const effective_authorized = explicitGroupIds.length > 0
      ? [...new Set([...authorized_groups, ...explicitGroupIds])]
      : authorized_groups;
    let gList = (groups?.adminHierarchy || []).filter(g => effective_authorized.includes(g.id));
    let response = {};
    for (let this_group of gList) {
      if ((this_group.level > 0)
        && (selectAll
          || selectMine
          || pGroupList.includes(this_group.id)
          || pGroupList.includes(this_group.belongs_to)
          || pGroupList.includes('*responsible'))
      ) {
        const foundGroup = groups.belongsTo?.[this_group.id];
        let my_role;
        if (foundGroup) {
          my_role = foundGroup.role;
        }
        else {
          my_role = await getRole(this_group.id, state.session.person_id || state.session.patient_id);
        }
        if (pGroupList.includes('*responsible') && (my_role !== 'responsible')) {
          continue;
        }
        if (!selectMine || (my_role !== 'non-member')) {
          response[this_group.id] = {
            group_name: this_group.name,
            group_type: 'admin',
            group_id: this_group.id,
            role: my_role,
            level: this_group.level
          };
          if (!pGroupList.includes(this_group.id)) {
            pGroupList.push(this_group.id);
          }
        }
      }
    };
    let publicGroupList = [];
    for (let gID in groups.publicGroups) {
      if (!response[gID] && (effective_authorized.includes(gID)) && (selectAll || pGroupList.includes(gID) || selectOpen)) {
        publicGroupList.push({
          group_name: groups.publicGroups[gID].group_name,
          group_id: gID,
          group_type: 'public',
          role: groups.publicGroups[gID].role,
          level: 2
        });
      }
    }
    publicGroupList.sort((a, b) => (a.group_name < b.group_name) ? -1 : 1);

    let privateGroupList = [];
    for (let gID in groups.privateGroups) {
      if (!response[gID] && (effective_authorized.includes(gID)) && (selectAll || pGroupList.includes(gID) || selectPrivate)) {
        privateGroupList.push({
          group_name: groups.privateGroups[gID].group_name,
          group_id: gID,
          group_type: 'private',
          role: groups.privateGroups[gID].role,
          level: 2
        });
      }
    }
    privateGroupList.sort((a, b) => (a.group_name < b.group_name) ? -1 : 1);

    if (publicGroupList.length > 0) {
      response['__PUBLIC_GROUPS__'] = { group_id: '__PUBLIC_GROUPS__', group_name: 'Public Groups', group_type: 'header', role: 'header', level: 1 };
      for (let g of publicGroupList) { response[g.group_id] = g; }
    }
    if (privateGroupList.length > 0) {
      response['__PRIVATE_GROUPS__'] = { group_id: '__PRIVATE_GROUPS__', group_name: 'Private Groups', group_type: 'header', role: 'header', level: 1 };
      for (let g of privateGroupList) { response[g.group_id] = g; }
    }

    // For explicitly-requested group IDs still missing from response, add them unconditionally.
    // pGroup_id in a menu directive is a trusted instruction and should bypass all access filtering.
    for (const id of explicitGroupIds) {
      if (response[id]) { continue; }
      const adminEntry = (groups?.adminHierarchy || []).find(g => g.id === id);
      if (adminEntry) {
        response[id] = { group_name: adminEntry.name, group_type: 'admin', group_id: id, role: 'member', level: adminEntry.level || 2 };
        continue;
      }
      if (groups?.publicGroups?.[id]) {
        response[id] = { group_name: groups.publicGroups[id].group_name, group_id: id, group_type: 'public', role: groups.publicGroups[id].role || 'member', level: 2 };
        continue;
      }
      if (groups?.privateGroups?.[id]) {
        response[id] = { group_name: groups.privateGroups[id].group_name, group_id: id, group_type: 'private', role: groups.privateGroups[id].role || 'member', level: 2 };
      }
    }

    return response;
  };

  const handleAbort = async (updatesMade) => {
    onClose(updatesMade);
  };

  const buildGroupControlData = async (localGroups, localAccessList) => {
    const groupList = makeArray(pGroup_id, /[~,;]/);
    const groupsManagedObject = await prepareGroupObject(groupList.length > 0 ? [...groupList] : [], localGroups, localAccessList);

    // Determine pre-selection: explicit group IDs that exist in groupsManagedObject, not in 'select' mode
    let preSelectedGroup = null;
    let preSelectedFunction = null;
    const wildcards = ['*all', '*all_open', '*all_public', '*all_closed', '*all_private', '*user', '*responsible'];
    const explicitGroups = groupList.filter(id => !wildcards.includes(id) && groupsManagedObject[id]);
    if (explicitGroups.length > 0 && showList !== 'select') {
      preSelectedGroup = explicitGroups.length === 1 ? explicitGroups[0] : explicitGroups;
      // Auto-launch the function (only meaningful for a single group)
      if (options.preSelectedFunction) {
        preSelectedFunction = options.preSelectedFunction;
      }
      else if (explicitGroups.length > 0 && !options.groupManagement) {
        preSelectedFunction = 'directory';
      }
    }

    updateReactData({ groupsManagedObject, preSelectedGroup, preSelectedFunction, directoryGroupIds: explicitGroups }, true);
  };

  async function initialize() {
    // Fast path: paint GroupControl from in-memory session data first.
    if (state.groups && state.accessList) {
      await buildGroupControlData(state.groups, state.accessList);
    }

    // Background refresh: pull latest hierarchy/access and update GroupControl when ready.
    // This keeps initial open fast while still converging to fresh data.
    void (async () => {
    // Always fetch group structure fresh from DB — fast (structure only, no member lists).
    // This ensures GroupControl shows current groups/hierarchy without requiring an app restart.
    const [belongsTo, group_structure, memberGroupIds] = await Promise.all([
      getGroupsBelongTo(state.session.client_id, state.session.patient_id, { sort: true }),
      getAllGroups(state.session.patient_id, state.session.client_id),
      getPersonGroups(state.session.patient_id, state.session.client_id)
    ]);
    const localGroups = Object.assign({}, group_structure, { belongsTo, memberGroupIds });
    dispatch({ type: SET_GROUPS, payload: localGroups });

    // Build authorized_groups locally from the fresh hierarchy — avoids the heavyweight
    // accountAccess() call (which reads all members of all groups).
    // Admins/support/master see every group; everyone else sees only their member groups.
    let localAccessList = state.accessList;
    if (!localAccessList?.hasOwnProperty(state.session.client_id)) {
      // First time only: no accessList at all — must call accountAccess to bootstrap the full list
      localAccessList = await accountAccess(state.session.user_id, state.session.client_id);
      dispatch({ type: SET_ACCESSLIST, payload: localAccessList });
    } else {
      // accessList exists — keep the existing groups slice as-is (it includes accessible_to grants
      // that memberGroupIds alone would not cover). localAccessList stays pointing at state.accessList.
      // TODO (long-term): merge memberGroupIds into existing groups to pick up live membership changes:
      //   groups: [...new Set([...localAccessList[state.session.client_id].groups, ...(memberGroupIds || [])])]
    }

      await buildGroupControlData(localGroups, localAccessList);
    })();
  }


  // **************************

  React.useEffect(() => {
    initialize();
  }, [pSession]); // eslint-disable-line react-hooks/exhaustive-deps


  if (!showList) {
    return null;
  }

  return (
    <Dialog
      open={forceRedisplay || true}
      onClose={() => handleAbort(reactData.updatesMade)}
      TransitionComponent={Transition}
      fullScreen
    >
      {reactData.groupsManagedObject
        ? <GroupControl
          key={`group_control_${reactData.groupControlKey}`}
          defaults={defaults}
          pSession={pSession}
          groupsManagedObject={reactData.groupsManagedObject}
          focusAt={0}
          preSelectedGroup={reactData.preSelectedGroup}
          preSelectedFunction={reactData.preSelectedFunction}
          directoryGroupIds={reactData.directoryGroupIds}
          renderAsDialog={false}
          onCancel={() => handleAbort(reactData.updatesMade)}
          onRefresh={async (responseObj) => {
            const { newGroupID, newGroupName } = responseObj || {};
            let groupList = makeArray(pGroup_id, /[~,;]/);
            if (newGroupID) {
              state.groups.publicGroups[newGroupID] = {
                group_name: newGroupName,
                group_id: newGroupID,
                role: 'responsible'
              };
              groupList.push(newGroupID);
            }
            const newGMO = await prepareGroupObject(groupList);
            updateReactData({
              groupsManagedObject: newGMO,
              groupControlKey: reactData.groupControlKey + 1,
              updatesMade: true,
            }, true);
          }}
        />
        : <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center' style={{ height: '100%' }}>
            <CircularProgress size={48} />
            <Typography style={{ marginTop: 16 }}>{'Loading groups...'}</Typography>
          </Box>
      }
    </Dialog>
  );
};
