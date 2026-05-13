import React from 'react';
import { useSnackbar } from 'notistack';
import { getRole } from '../../util/AVAGroups';

import Dialog from '@material-ui/core/Dialog';
import Slide from '@material-ui/core/Slide';

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

  const { state } = useSession();

  const { enqueueSnackbar } = useSnackbar();

  const prepareGroupObject = async (pGroupList) => {
    let selectAll = pGroupList.includes('*all');
    let selectOpen = pGroupList.includes('*all_open') || pGroupList.includes('*all_public');
    let selectPrivate = pGroupList.includes('*all_closed') || pGroupList.includes('*all_private');
    const selectMine = !pGroupList || (pGroupList.length === 0) || (pGroupList.includes('*user'));
    // Use already-loaded state.groups instead of re-fetching all groups from the DB
    const authorized_groups = state.accessList?.[state.session.client_id]?.groups || [];
    let gList = (state.groups?.adminHierarchy || []).filter(g => authorized_groups.includes(g.id));
    let response = {};
    for (let this_group of gList) {
      if ((this_group.level > 0)
        && (selectAll
          || selectMine
          || pGroupList.includes(this_group.id)
          || pGroupList.includes(this_group.belongs_to)
          || pGroupList.includes('*responsible'))
      ) {
        const foundGroup = state.groups.belongsTo[this_group.id];
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
    for (let gID in state.groups.publicGroups) {
      if (!response[gID] && (authorized_groups.includes(gID)) && (selectAll || pGroupList.includes(gID) || selectOpen)) {
        publicGroupList.push({
          group_name: state.groups.publicGroups[gID].group_name,
          group_id: gID,
          group_type: 'public',
          role: state.groups.publicGroups[gID].role,
          level: 2
        });
      }
    }
    publicGroupList.sort((a, b) => (a.group_name < b.group_name) ? -1 : 1);

    let privateGroupList = [];
    for (let gID in state.groups.privateGroups) {
      if (!response[gID] && (authorized_groups.includes(gID)) && (selectAll || pGroupList.includes(gID) || selectPrivate)) {
        privateGroupList.push({
          group_name: state.groups.privateGroups[gID].group_name,
          group_id: gID,
          group_type: 'private',
          role: state.groups.privateGroups[gID].role,
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
    return response;
  };

  const handleAbort = async (updatesMade) => {
    onClose(updatesMade);
  };

  async function initialize() {
    if (!state.groups?.adminHierarchy || !state.groups?.belongsTo || !state.accessList?.hasOwnProperty(state.session.client_id)) {
      enqueueSnackbar(`AVA is still loading.  Wait just a moment and try again, please.`, { variant: 'warning' });
      onAbort();
      return;
    }
    const groupList = makeArray(pGroup_id, /[~,;]/);
    const groupsManagedObject = await prepareGroupObject(groupList.length > 0 ? [...groupList] : []);

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

    updateReactData({ groupsManagedObject, preSelectedGroup, preSelectedFunction }, true);
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
      {reactData.groupsManagedObject &&
        <GroupControl
          key={`group_control_${reactData.groupControlKey}`}
          defaults={defaults}
          pSession={pSession}
          groupsManagedObject={reactData.groupsManagedObject}
          focusAt={0}
          preSelectedGroup={reactData.preSelectedGroup}
          preSelectedFunction={reactData.preSelectedFunction}
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
      }
    </Dialog>
  );
};
