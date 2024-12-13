import React from 'react';
import { useSnackbar } from 'notistack';
import { getGroup, getRole } from '../../util/AVAGroups';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Typography from '@material-ui/core/Typography';

import GroupForm from '../forms/GroupForm';
import GroupFilter from '../forms/GroupFilter';
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

export default ({ options, onClose, onAbort }) => {

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
    if ((state.hasOwnProperty('accessList') && state.accessList[state.session.client_id])) {
      Object.keys(groupList).forEach(this_client => {
        if (groupList[this_client].includes('*all') || (this_client !== state.session.client_id)) {
          let thisList = state.accessList?.[this_client]?.list || ((this_client === state.session.client_id) ? state.session.last_state.list : []);
          peopleList = peopleList.concat(thisList);
        }
        else {
          let newPeople = [];
          if (reactData.newGroups) {
            for (const this_group of groupList[this_client]) {
              if (reactData.newGroups.hasOwnProperty(this_group)) {
                newPeople.push(...reactData.newGroups[this_group]);
              }
            }
          }
          peopleList = peopleList.concat(state.accessList?.[this_client]?.list || ((this_client === state.session.client_id) ? state.session.last_state.list : [])).filter((p, pX) => {
            return makeArray(p.groups).some(g => {
              return groupList[this_client].includes(g) || newPeople.includes(p.person_id);
            });
          });
        }
      });
      memberInfo = { peopleList };
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
    let gList = state.groups.adminHierarchy;
    let response = {};
    for (let x = 0; x < gList.length; x++) {
      let g = gList[x];
      if ((g.level > 0)
        && (selectAll
          || pGroupList.includes(g.id)
          || pGroupList.includes(g.belongs_to)
          || pGroupList.includes('*responsible'))
      ) {
        let my_role = await getRole(g.id, state.session.person_id);
        if (pGroupList.includes('*responsible') && (my_role !== 'responsible')) {
          continue;
        }
        response[g.id] = {
          group_name: g.name,
          group_id: g.id,
          role: my_role,
          level: g.level
        };
        if (!pGroupList.includes(g.id)) {
          pGroupList.push(g.id);
        }
      }
    };
    for (let gID in state.groups.publicGroups) {
      if (selectAll || pGroupList.includes(gID) || selectOpen) {
        response[gID] = {
          group_name: state.groups.publicGroups[gID].group_name,
          group_id: gID,
          role: state.groups.publicGroups[gID].role,
          level: 0
        };
      }
    };
    for (let gID in state.groups.privateGroups) {
      if (selectAll || pGroupList.includes(gID) || selectPrivate) {
        response[gID] = {
          group_name: state.groups.privateGroups[gID].group_name,
          group_id: gID,
          role: state.groups.privateGroups[gID].role,
          level: 0
        };
      }
    };
    return response;
  };

  const handleAbort = async (updatesMade) => {
    onClose(updatesMade);
  };

  // **************************

  React.useEffect(() => {
    async function prepare() {
      let reactUpdater = {};
      let groupList = makeArray(pGroup_id, /[~,;]/);
      if (groupList && groupList.length > 0) {
        reactUpdater.groupList = groupList;
        if (showList === 'select') {
          if (!state.groups || !state.groups.adminHierarchy) {
            enqueueSnackbar(`AVA is still loading.  Wait just a moment and try again, please.`, { variant: 'warning' });
            onAbort();
            return;
          }
          else {
            reactUpdater.groupsManagedObject = await prepareGroupObject(groupList);
            reactUpdater.showGroupSelect = true;
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
        reactUpdater.groupsManagedObject = state.groups.belongsTo;
        reactUpdater.showGroupSelect = true;
      }
      updateReactData(reactUpdater, true);
    }
    prepare();
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
        <DialogContent dividers={true} className={classes.dialogBox}>
          {!reactData.showGroupSelect && (reactData.building === 'done') &&
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
        {reactData.showGroupSelect &&
          <GroupFilter
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
              // if (mbrList.length === 0) {
              //   reactData.showGroupSelect = true;
              //   setReactData(reactData);
              // }
              setForceRedisplay(!forceRedisplay);
            }}
            onRefresh={async ({ newGroupID, newGroupName }) => {
              if (newGroupID) {
                let newGroupObj = {
                  group_name: newGroupName,
                  group_id: newGroupID,
                  role: 'responsible'
                };
                reactData.groupsManagedObject[newGroupID] = newGroupObj;
                state.groups.publicGroups[newGroupID] = newGroupObj;
                updateReactData({
                  groupsManagedObject: reactData.groupsManagedObject,
                  showGroupSelect: true,
                  selectedIndex: Object.keys(reactData.groupsManagedObject).length - 1
                }, true);
                let groupList = makeArray(pGroup_id, /[~,;]/);
                groupList.push(newGroupID);
                await prepareGroupObject(groupList);
              }
              setForceRedisplay(!forceRedisplay);
            }}
          >
          </GroupFilter>
        }
      </Dialog>
    )
  );
};
