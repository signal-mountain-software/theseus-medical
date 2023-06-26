import React from 'react';
import { useSnackbar } from 'notistack';
import { getMemberList, getGroup, getRole, getGroupsBelongTo, getGroupsResponsibleFor } from '../../util/AVAGroups';

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

// import useMediaQuery from '@material-ui/core/useMediaQuery';

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

export default ({ pSession, pGroup_id, pGroup_name, peopleList, showList, onClose }) => {
  const [groupMemberList, setGroupMemberList] = React.useState([]);
  const [groupsManagedObject, setGroupsManagedObject] = React.useState([]);
  const [showGroupSelect, setShowGroupSelect] = React.useState(false);

  const [groupName, setGroupName] = React.useState(pGroup_name);
  const [groupID, setGroupID] = React.useState();
  const [groupRole, setGroupRole] = React.useState();
  const [groupRec, setGroupRec] = React.useState();

  const [progressMessage, setprogressMessage] = React.useState('Building Member List');

  const classes = useStyles();

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const { enqueueSnackbar } = useSnackbar();

  async function getGroupMemberList(inGroup) {
    setprogressMessage('Getting all accounts');
    let memberInfo = await getMemberList(inGroup, pSession.client_id, { "sort": true, "exclude": false });

    if (memberInfo.peopleList.length === 0) {
      enqueueSnackbar(`AVA couldn't find any accounts.`, { variant: 'error' });
      onClose();
      return [];
    }
    setGroupMemberList(memberInfo.peopleList);
    if (memberInfo.groupList.length === 1) {
      if (memberInfo.groupList[0] === '*all') {
        setGroupID('*all');
        setGroupRole('responsible');
      }
      else {
        let groupRec = await getGroup(memberInfo.groupList[0], pSession.client_id);
        setGroupRec(groupRec);
        setGroupID(groupRec.group_id);
        if (groupsManagedObject[groupRec.name]) {
          setGroupRole(groupsManagedObject[groupRec.name].role);
        }
        else { setGroupRole(await getRole(groupRec.group_id, pSession.patient_id)); }
      }
    }
    else {
      setGroupRec({});
      setGroupID(...inGroup);
      setGroupRole('');
    }
    return memberInfo.peopleList;
  };

  const getGroupsManagedObject = async (pPatient) => {
    let gList = await getGroupsResponsibleFor(pPatient);
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
    })
    setGroupsManagedObject(gManagedObj);
    return gManagedObj;
  };

  const handleAbort = async () => {
    onClose();
  };

  // **************************

  React.useEffect(() => {
    async function prepare() {
      if (pGroup_id) { 
        await getGroupMemberList(makeArray(pGroup_id));
        setShowGroupSelect(false);
      }
      else {
        let groupList = await getGroupsBelongTo(pSession.patient_id, { sort: true });
        setGroupsManagedObject(groupList);
        setShowGroupSelect(true);
      }
    }
    prepare();
  }, [pSession]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    (showList &&
      <Dialog
        open={showList}
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
            {groupName || 'Group Maintenance'}
          </Typography>
        </Box>
        <DialogContent dividers={true} className={classes.dialogBox}>
          {groupMemberList.length === 0 && groupID &&
            <Box display='flex' marginBottom={5} flexDirection='column' justifyContent='center' alignItems='center'>
              <Typography className={classes.formControl} variant='h5' >
                {progressMessage}
              </Typography>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
              </div>
            </Box>
          }
          {groupMemberList.length > 0 &&
            <GroupForm
              groupMemberList={groupMemberList}
              peopleList={peopleList}
              pPatient={pSession.patient_id}
              pPatientName={pSession.patient_display_name}
              pClient={pSession.client_id}
              pGroup={groupID}
              pGroupRec={groupRec}
              pGroupName={groupName}
              pRole={groupRole}
              onReset={handleAbort}
            />
          }
        </DialogContent>
        {showGroupSelect &&
          <GroupFilter
            pSession={pSession}
            groupsManagedObject={groupsManagedObject}
            onCancel={() => {
              setShowGroupSelect(false);
              onClose();
            }}
            onSelect={async (selectedGroup) => {
              setShowGroupSelect(false);
              setGroupName(groupsManagedObject[selectedGroup].group_name);
              setGroupID(groupsManagedObject[selectedGroup].group_id);
              setGroupRole(groupsManagedObject[selectedGroup].role);
              await getGroupMemberList([groupsManagedObject[selectedGroup].group_id]);
            }}
            onRefresh={async () => {
              setShowGroupSelect(true);
              await getGroupsManagedObject(pSession.patient_id);
            }}
          >
          </GroupFilter>
        }
      </Dialog>
    )
  );
};
