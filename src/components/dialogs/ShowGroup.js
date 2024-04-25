import React from 'react';
import { useSnackbar } from 'notistack';
import { getGroup, getRole, getGroupsResponsibleFor } from '../../util/AVAGroups';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';

import GroupForm from '../forms/GroupForm';
import GroupFilter from '../forms/GroupFilter';
import { makeArray } from '../../util/AVAUtilities';

import useSession from '../../hooks/useSession';

import { AVATextStyle } from '../../util/AVAStyles';

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

export default ({ pSession, pGroup_id, pGroup_name, peopleList, showList = 'full', onClose, onAbort }) => {

  const [reactData, setReactData] = React.useState({
    groupMemberList: [],
    groupsManagedObject: [],
    showGroupSelect: false,
    groupName: pGroup_name,
    groupID: '',
    groupRole: '',
    groupRec: {},
    progressMessage: 'Building Group List',
  });
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const { state } = useSession();
  const classes = useStyles();

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const { enqueueSnackbar } = useSnackbar();

  async function getGroupMemberList(pGroupArray) {
    reactData.progressMessage = 'Getting accounts';
    let memberInfo;
    if ((state.hasOwnProperty('accessList') && state.accessList[state.session.client_id])
      || (state.session.hasOwnProperty('last_state') && (state.session.client_id === pSession.client_id))) {
      if (pGroupArray.includes('*all')) {
        memberInfo = {
          peopleList: state.accessList?.[state.session.client_id]?.list || state.session.last_state.list
        };
      }
      else {
        memberInfo =
        {
          peopleList: (state.accessList?.[state.session.client_id]?.list || state.session.last_state.list).filter((p, pX) => {
            return makeArray(p.groups).some(g => {
              return pGroupArray.includes(g);
            });
          })
        };
      }
    }
    else {
      enqueueSnackbar(`AVA is still loading.  Wait just a moment and try again, please.`, { variant: 'warning' });
      onAbort();
      return [];
    }
    if (memberInfo.peopleList.length === 0) {
      enqueueSnackbar(`AVA couldn't find any members in that Group.`, { variant: 'error' });
      reactData.showGroupSelect = true;
      setReactData(reactData);
    }
    reactData.groupMemberList = memberInfo.peopleList;
    if (pGroupArray.length === 1) {
      if (pGroupArray[0] === '*all') {
        reactData.groupID = '*all';
        reactData.groupRole = 'responsible';
      }
      else {
        reactData.groupRec = await getGroup(pGroupArray[0], pSession.client_id);
        reactData.groupID = reactData.groupRec.group_id;
        if (reactData.groupsManagedObject[reactData.groupRec.name]) {
          reactData.groupRole = reactData.groupsManagedObject[reactData.groupRec.name].role;
        }
        else { reactData.groupRole = await getRole(reactData.groupRec.group_id, pSession.patient_id); }
      }
    }
    else {
      reactData.groupRec = {};
      reactData.groupID = [...pGroupArray];
      reactData.groupRole = '';
    }
    setReactData(reactData);
    return memberInfo.peopleList;
  };


  const prepareGroupObject = async (pGroupList) => {
    let selectAll = pGroupList.includes('*all');
    let gList = state.groups.adminHierarchy;
    let response = {};
    for (let x = 0; x < gList.length; x++) {
      let g = gList[x];
      if ((g.level > 0) && (selectAll || pGroupList.includes(g.id))) {
        response[g.id] = {
          group_name: g.name,
          group_id: g.id,
          role: await getRole(g.id, state.session.person_id),
          level: g.level
        };
      }
    }; 
    for (let gID in state.groups.publicGroups) {
      if (selectAll || pGroupList.includes(gID)) {
        response[gID] = {
          group_name: state.groups.publicGroups[gID].group_name,
          group_id: gID,
          role: state.groups.publicGroups[gID].role,
          level: 0
        };
      }
    }; 
    for (let gID in state.groups.privateGroups) {
      if (selectAll || pGroupList.includes(gID)) {
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

  const getGroupsManagedObject = async (pClient, pPatient, pGroupList) => {
    let [gList,] = await getGroupsResponsibleFor(pClient, pPatient);
    // sort by group name
    let gSort = [];
    let gObj = {};
    for (let gID in gList) {
      gSort.push(gList[gID].group_name);
      gObj[gList[gID].group_name] = gID;
    }
    gSort.sort();
    let gManagedObj = {};
    gSort.forEach(g => {
      let gData = gList[gObj[g]];
      gManagedObj[gObj[g]] = gData;
    });
    reactData.groupsManagedObject = gManagedObj;
    setReactData(reactData);
    return gManagedObj;
  };

  const handleAbort = async () => {
    onClose();
  };

  // **************************

  React.useEffect(() => {
    async function prepare() {
      let groupList = makeArray(pGroup_id, /[~,;]/);
      if (groupList && groupList.length > 0) {
        reactData.groupList = groupList;
        if (showList === 'select') {
          reactData.groupsManagedObject = await prepareGroupObject(groupList);
          reactData.showGroupSelect = true;
        }
        else {
          await getGroupMemberList(makeArray(pGroup_id, /[~,;]/));
          reactData.showGroupSelect = false;
        }
      }
      else {
        reactData.groupsManagedObject = state.groups.belongsTo;
        reactData.showGroupSelect = true;
      }
      setReactData(reactData);
      setForceRedisplay(!forceRedisplay);
    }
    prepare();
  }, [pSession]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    (showList && (forceRedisplay || true) &&
      <Dialog
        open={forceRedisplay || true}
        onClose={handleAbort}
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
          {reactData.groupMemberList.length === 0 && !reactData.showGroupSelect &&
            <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
              <Box
                display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                key={'loadingBox'}
                ml={2} mr={2} mb={2} mt={8}
              >
                <Box
                  component="img"
                  mb={2}
                  minWidth={150}
                  maxWidth={150}
                  alt=''
                  src={pSession.client_logo || process.env.REACT_APP_AVA_LOGO}
                />
                <React.Fragment>
                  <Box
                    display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                    flexWrap='wrap' textOverflow='ellipsis' width='100%'
                    key={'loadingBox'}
                    mb={2}
                  >
                    <Typography style={AVATextStyle({ size: 1.5, align: 'center' })} className={classes.lastName} >
                      {reactData.progressMessage}
                    </Typography>
                    <Typography style={AVATextStyle({ size: 0.8, align: 'center' })} >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                  </Box>
                  <CircularProgress />
                </React.Fragment>
              </Box>
            </DialogContent>
          }
          {reactData.groupMemberList.length > 0 &&
            <GroupForm
              groupMemberList={reactData.groupMemberList}
              peopleList={peopleList}
              pPatient={pSession.patient_id}
              pPatientName={pSession.patient_display_name}
              pClient={pSession.client_id}
              pGroup={reactData.groupID}
              pGroupRec={reactData.groupRec}
              pGroupName={reactData.groupName}
              pRole={reactData.groupRole}
              pStyle={showList}
              onReset={() => {
                if (pGroup_id && (showList !== 'select')) {
                  handleAbort();
                }
                else {
                  reactData.showGroupSelect = true;
                  reactData.groupMemberList = [];
                  setReactData(reactData);
                  setForceRedisplay(!forceRedisplay);
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
              reactData.showGroupSelect = false;
              setReactData(reactData);
              onClose();
            }}
            onSelect={async (selectedGroup, selectedIndex) => {
              reactData.selectedIndex = selectedIndex;
              reactData.showGroupSelect = false;
              reactData.groupName = reactData.groupsManagedObject[selectedGroup].group_name;
              reactData.groupID = reactData.groupsManagedObject[selectedGroup].group_id;
              reactData.groupRole = reactData.groupsManagedObject[selectedGroup].role;
              setReactData(reactData);
              await getGroupMemberList([reactData.groupsManagedObject[selectedGroup].group_id]);
              setForceRedisplay(!forceRedisplay);
            }}
            onRefresh={async () => {
              reactData.showGroupSelect = true;
              await getGroupsManagedObject(pSession.client_id, pSession.patient_id, reactData.groupList);
              setForceRedisplay(!forceRedisplay);
            }}
          >
          </GroupFilter>
        }
      </Dialog>
    )
  );
};
