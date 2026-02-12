import React from 'react';
import { useSnackbar } from 'notistack';
import { getAllGroups, getGroup, getRole, getMemberList } from '../../util/AVAGroups';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Typography from '@material-ui/core/Typography';

import GroupForm from '../forms/GroupForm';
import GroupFilter from '../forms/GroupFilter';
import GroupControl from '../forms/GroupControl';
import { makeArray, deepCopy } from '../../util/AVAUtilities';

import useSession from '../../hooks/useSession';

const useStyles = makeStyles(theme => ({
  formControl: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    paddingTop: 3,
  },
  pageHead: {
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  subDescriptionText: {
    marginLeft: theme.spacing(3),
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },
  freeInput: {
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 0,
    verticalAlign: 'middle',
    minHeight: theme.typography.fontSize * 2.8,
  },
  dialogBox: {
    minWidth: '100%',
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  load: {
    backgroundColor: theme.palette.warning[theme.palette.type],
  },
  confirm: {
    backgroundColor: 'green',
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ options, defaults, onClose, onAbort }) => {

  let { pSession, pGroup_id, pGroup_name, peopleList, showList, safeMode } = options;

  const [reactData, setReactData] = React.useState({
    groupMemberList: [],
    groupsManagedObject: [],
    showGroupSelect: false,
    safeMode: safeMode || false,
    groupName: pGroup_name,
    groupID: '',
    groupRole: '',
    groupRec: {},
    progressMessage: 'Building Group List',
    building: 'not started',
    updatesMade: false,
    newGroups: {}
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
  const classes = useStyles();

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const { enqueueSnackbar } = useSnackbar();

  async function getGroupMemberList(pGroupArray) {
    updateReactData({
      progressMessage: 'Getting accounts',
      building: 'in process'
    }, true);
    let memberInfo;
    let groupList = {};
    let tClient, tGroup;
    let peopleList = [];
    pGroupArray.forEach(this_group => {
      if (this_group.includes('//')) {
        [tClient, tGroup] = this_group.split('//');
      }
      else {
        tClient = state.session.client_id;
        tGroup = this_group;
      }
      if (!groupList.hasOwnProperty(tClient)) {
        groupList[tClient] = [];
      }
      groupList[tClient].push(tGroup);
    });

    // If groupList includes '*all', then we will present whatever accoutns you are authorized to view in this client
    // That list will be in state.accessList[state.session.client_id].list
    const this_client = state.session.client_id;
    if (groupList[this_client].includes('*all') && state.accessList?.[this_client]) {
      let thisList = state.accessList?.[this_client]?.list || ((this_client === state.session.client_id) ? state.session.last_state.list : []);
      peopleList = peopleList.concat(thisList);
      memberInfo = { peopleList };
    }
    else if (groupList[this_client].length > 0) {
      const groupPromises = groupList[this_client].map(this_group =>
        getMemberList(this_group, state.session.client_id, { "exclude": false })
      );
      const groupResponses = await Promise.all(groupPromises);

      const peopleById = new Map();
      groupResponses.forEach(resp => {
        (resp?.peopleList || []).forEach(person => {
          peopleById.set(person.person_id, person);
        });
      });

      const dedupedPeopleList = Array.from(peopleById.values()).sort((a, b) => {
        const lastA = a?.name?.last || '';
        const lastB = b?.name?.last || '';
        const lastCompare = lastA.localeCompare(lastB);
        if (lastCompare !== 0) return lastCompare;
        const firstA = a?.name?.first || '';
        const firstB = b?.name?.first || '';
        return firstA.localeCompare(firstB);
      });
      memberInfo = { peopleList: dedupedPeopleList };
    }
    else {
      enqueueSnackbar(`AVA is still loading.  Wait just a moment and try again, please.`, { variant: 'warning' });
      onAbort();
      return [];
    }
    let reactUpdater = {};
    if (memberInfo.peopleList.length === 0) {
      enqueueSnackbar(`Nobody found for you to view.`, { variant: 'error' });
    }
    reactUpdater.groupMemberList = deepCopy(memberInfo.peopleList);
    if (pGroupArray.length === 1) {
      if (pGroupArray[0] === '*all') {
        reactUpdater.groupID = '*all';
        reactUpdater.groupRole = 'responsible';
      }
      else if (pGroupArray[0] === '*viewAll') {
        reactUpdater.groupID = '*all';
        reactUpdater.groupRole = 'member';
      }
      else {
        reactUpdater.groupRec = await getGroup(pGroupArray[0], pSession.client_id);
        reactUpdater.groupID = reactUpdater.groupRec.group_id;
        if (reactData.groupsManagedObject[reactData.groupRec.name]) {
          reactUpdater.groupRole = reactData.groupsManagedObject[reactData.groupRec.name].role;
        }
        else {
          let resp = await getRole(reactUpdater.groupRec.group_id, pSession.patient_id);
          reactUpdater.groupRole = resp;
        }
      }
    }
    else {
      reactUpdater.groupRec = {};
      reactUpdater.groupID = [...pGroupArray];
      reactUpdater.groupRole = '';
    }
    reactUpdater.progressMessage = 'Complete!';
    reactUpdater.building = 'done';
    updateReactData(reactUpdater, true);
    return memberInfo.peopleList;
  };


  const prepareGroupObject = async (pGroupList) => {
    let selectAll = pGroupList.includes('*all');
    let selectOpen = pGroupList.includes('*all_open') || pGroupList.includes('*all_public');
    let selectPrivate = pGroupList.includes('*all_closed') || pGroupList.includes('*all_private');
    const selectMine = !pGroupList || (pGroupList.length === 0) || (pGroupList.includes('*user'));
    let allGroups = await getAllGroups(state.session.person_id || state.session.patient_id, state.session.client_id);
    const authorized_groups = state.accessList?.[state.session.client_id]?.groups || [];
    let gList = allGroups.adminHierarchy.filter(g => authorized_groups.includes(g.id));
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
    let otherGroups = [];
    for (let gID in state.groups.publicGroups) {
      if (!response[gID] && (authorized_groups.includes(gID)) && (selectAll || pGroupList.includes(gID) || selectOpen)) {
        otherGroups.push({
          group_name: state.groups.publicGroups[gID].group_name,
          group_id: gID,
          group_type: 'public',
          role: state.groups.publicGroups[gID].role,
          level: 0
        });
      }
    };
    for (let gID in state.groups.privateGroups) {
      if (!response[gID] && (authorized_groups.includes(gID)) && (selectAll || pGroupList.includes(gID) || selectPrivate)) {
        otherGroups.push({
          group_name: state.groups.privateGroups[gID].group_name,
          group_id: gID,
          group_type: 'private',
          role: state.groups.privateGroups[gID].role,
          level: 0
        });
      }
    };
    otherGroups.sort((a, b) => {
      return (a.group_name < b.group_name) ? -1 : 1;
    });
    for (let this_otherGroup of otherGroups) {
      response[this_otherGroup.group_id] = this_otherGroup;
    }
    return response;
  };

  const handleAbort = async (updatesMade) => {
    onClose(updatesMade);
  };

  async function initialize() {
    let reactUpdater = {};
    let groupList = makeArray(pGroup_id, /[~,;]/);
    if (groupList && groupList.length > 0) {
      reactUpdater.groupList = groupList;
      if (showList === 'select') {
        if (!state.groups || !state.groups.adminHierarchy || !state.groups.belongsTo || !state.accessList || !state.accessList.hasOwnProperty(state.session.client_id)) {
          enqueueSnackbar(`AVA is still loading.  Wait just a moment and try again, please.`, { variant: 'warning' });
          onAbort();
          return;
        }
        else {
          reactUpdater.groupsManagedObject = await prepareGroupObject(groupList);
          reactUpdater.showGroupSelect = true;
          reactUpdater.building = 'done';
        }
      }
      else {
        if (!state.accessList || !state.accessList.hasOwnProperty(state.session.client_id)) {
          enqueueSnackbar(`AVA is still loading.  Wait just a moment and try again, please.`, { variant: 'warning' });
          onAbort();
          return;
        }
        else {
          let mbrList = await getGroupMemberList(makeArray(pGroup_id, /[~,;]/));
          reactUpdater.showGroupSelect = (mbrList.length === 0);
        }
      }
    }
    else {
      // reactUpdater.groupsManagedObject = state.groups.belongsTo;
      reactUpdater.groupsManagedObject = await prepareGroupObject(groupList);
      reactUpdater.showGroupSelect = true;
      reactUpdater.building = 'done';
    }
    updateReactData(reactUpdater, true);
  }


  // **************************

  React.useEffect(() => {
    initialize();
  }, [pSession]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    (showList && (forceRedisplay || true) &&
      <Dialog
        open={forceRedisplay || true}
        onClose={() => {
          handleAbort(reactData.updatesMade);
        }}
        TransitionComponent={Transition}
        className={classes.pageHead}
        fullScreen
      >
        {!reactData.showGroupSelect &&
          <Box
            display='flex'
            grow={1}
            style={{ width: '90%' }}
            mb={0}
            flexDirection='column'
            justifyContent='center'
            alignItems='flex-start'
          >
            <Typography className={classes.formControl} variant='h5' >
              {reactData.groupName || 'Group Maintenance'}
            </Typography>
          </Box>
        }
        {!reactData.showGroupSelect &&
          <DialogContent dividers={true} className={classes.dialogBox}>
            {(reactData.building === 'done') &&
              <GroupForm
                options={Object.assign(options, {
                  groupMemberList: reactData.groupMemberList,
                  peopleList: peopleList,
                  pPatient: pSession.patient_id,
                  pPatientName: pSession.patient_display_name,
                  pClient: pSession.client_id,
                  pGroup: reactData.groupID,
                  pGroupRec: reactData.groupRec,
                  pGroupName: reactData.groupName,
                  pRole: reactData.groupRole,
                  pStyle: showList
                })}
                onReset={async ({ updatesMade, newGroupID, newGroupName, newMemberList }) => {
                  if (pGroup_id && (showList !== 'select')) {
                    handleAbort(updatesMade);
                  }
                  else {
                    let reactUpdater = {
                      showGroupSelect: true,
                      groupMemberList: [],
                    };
                    if (updatesMade) {
                      reactUpdater.updatesMade = true;
                      if (newGroupID) {
                        reactData.newGroups[newGroupID] = newMemberList;
                        let foundIndex = state.groups.adminHierarchy.findIndex(soughtGroup => {
                          return (soughtGroup.id === reactData.groupID);
                        });
                        let this_index = foundIndex + 1;
                        state.groups.adminHierarchy.splice(this_index, 0, {
                          belongs_to: reactData.groupID,
                          id: newGroupID,
                          level: state.groups.adminHierarchy[foundIndex].level + 1,
                          name: newGroupName,
                          selectable: false
                        });
                        let groupList = makeArray(pGroup_id, /[~,;]/);
                        groupList.push(newGroupID);
                        let gMObj = await prepareGroupObject(groupList);
                        updateReactData({
                          groupsManagedObject: gMObj,
                          showGroupSelect: true,
                          selectedIndex: foundIndex
                        }, true);
                      }
                      setForceRedisplay(!forceRedisplay);
                    }
                    updateReactData(reactUpdater, true);
                  }
                }}
              />
            }
          </DialogContent>
        }
        {reactData.showGroupSelect && !options.groupManagement && (reactData.building === 'done') &&
          <GroupFilter
            defaults={defaults}
            pSession={pSession}
            groupsManagedObject={reactData.groupsManagedObject}
            focusAt={reactData.selectedIndex || 0}
            onCancel={() => {
              updateReactData({
                showGroupSelect: false
              }, true);
              onClose(reactData.updatesMade);
            }}
            onSelect={async (selectedGroup, selectedIndex) => {
              updateReactData({
                selectedIndex: selectedIndex,
                showGroupSelect: false,
                groupName: reactData.groupsManagedObject[selectedGroup].group_name,
                groupID: reactData.groupsManagedObject[selectedGroup].group_id,
                groupRole: reactData.groupsManagedObject[selectedGroup].role
              }, false);
              await getGroupMemberList([reactData.groupsManagedObject[selectedGroup].group_id]);
              setForceRedisplay(!forceRedisplay);
            }}
            onRefresh={async (responseObj) => {
              let { newGroupID, newGroupName } = responseObj || { newGroupID: false, newGroupName: false };
              let reactUpdObj = { showGroupSelect: true };
              let groupList = makeArray(pGroup_id, /[~,;]/);
              if (newGroupID) {
                let newGroupObj = {
                  group_name: newGroupName,
                  group_id: newGroupID,
                  role: 'responsible'
                };
                reactData.groupsManagedObject[newGroupID] = newGroupObj;
                state.groups.publicGroups[newGroupID] = newGroupObj;
                reactUpdObj.groupsManagedObject = reactData.groupsManagedObject;
                reactUpdObj.selectedIndex = Object.keys(reactData.groupsManagedObject).length - 1;
                groupList.push(newGroupID);
              }
              reactUpdObj.groupsManagedObject = await prepareGroupObject(groupList);
              updateReactData(reactUpdObj, true);
            }}
          >
          </GroupFilter>
        }
        {reactData.showGroupSelect && options.groupManagement && (reactData.building === 'done') &&
          <GroupControl
            defaults={defaults}
            pSession={pSession}
            groupsManagedObject={reactData.groupsManagedObject}
            focusAt={reactData.selectedIndex || 0}
            renderAsDialog={false}
            onCancel={() => {
              updateReactData({
                showGroupSelect: false
              }, true);
              onClose(reactData.updatesMade);
            }}
            onSelect={async (selectedGroup, selectedIndex) => {
              updateReactData({
                selectedIndex: selectedIndex,
                showGroupSelect: false,
                groupName: reactData.groupsManagedObject[selectedGroup].group_name,
                groupID: reactData.groupsManagedObject[selectedGroup].group_id,
                groupRole: reactData.groupsManagedObject[selectedGroup].role
              }, false);
              await getGroupMemberList([reactData.groupsManagedObject[selectedGroup].group_id]);
              setForceRedisplay(!forceRedisplay);
            }}
            onRefresh={async (responseObj) => {
              let { newGroupID, newGroupName } = responseObj || { newGroupID: false, newGroupName: false };
              let reactUpdObj = { showGroupSelect: true };
              let groupList = makeArray(pGroup_id, /[~,;]/);
              if (newGroupID) {
                let newGroupObj = {
                  group_name: newGroupName,
                  group_id: newGroupID,
                  role: 'responsible'
                };
                reactData.groupsManagedObject[newGroupID] = newGroupObj;
                state.groups.publicGroups[newGroupID] = newGroupObj;
                reactUpdObj.groupsManagedObject = reactData.groupsManagedObject;
                reactUpdObj.selectedIndex = Object.keys(reactData.groupsManagedObject).length - 1;
                groupList.push(newGroupID);
              }
              reactUpdObj.groupsManagedObject = await prepareGroupObject(groupList);
              updateReactData(reactUpdObj, true);
            }}
          >
          </GroupControl>
        }

      </Dialog>
    )
  );
};
