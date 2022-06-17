import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';

import GroupForm from '../forms/GroupForm';
import GroupFilter from '../forms/GroupFilter';

import useMediaQuery from '@material-ui/core/useMediaQuery';

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

  const [groupName, setGroupName] = React.useState();
  const [groupID, setGroupID] = React.useState();
  const [groupRole, setGroupRole] = React.useState();

  const classes = useStyles();

  const [changes, setChanges] = React.useState(false);
  if (changes) { }

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('sm')); // checks if current device is a smart phone
  if (isMobile) { }

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  const { enqueueSnackbar } = useSnackbar();

  const getGroupMemberList = async (pGroup) => {
    let invokeFailed = false;
    setGroupMemberList([]);
    params.Payload = JSON.stringify({
      action: "get_group_members",
      clientId: pSession.client_id,
      request: {
        "group_id": pGroup.group_id,
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while retrieving Group list.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let groupMemberList = JSON.parse(fResp.Payload);
      if (groupMemberList.status === 200) {
        setGroupMemberList(groupMemberList.body);
        return groupMemberList;
      }
    };
    enqueueSnackbar(`AVA encountered an error while retrieving Group list.`, {
      variant: 'error'
    });
    onClose();
    return [];
  };

  const getGroupsManagedObject = async (pPerson) => {
    let invokeFailed = false;
    params.Payload = JSON.stringify({
      action: "get_groups_managed",
      clientId: pSession.client_id,
      request: {
        "person_id": pPerson,
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while retrieving Group list.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let groupsManagedReturn = JSON.parse(fResp.Payload);
      if (groupsManagedReturn.status === 200) {
        setGroupsManagedObject(groupsManagedReturn.body);
        return groupsManagedReturn.body;
      }
    };
    return [];
  };

  const handleAbort = async () => {
    if (pGroup_id) { onClose(); }
    else {
      setChanges(false);
      await getGroupsManagedObject(pSession.patient_id);
      setShowGroupSelect(true);
    }
  };

  // **************************

  React.useEffect(() => {
    let response = (
      async () => {
        await getGroupsManagedObject(pSession.patient_id);
      }
    );
    if (pGroup_id) { 
      setShowGroupSelect(false);
      let [gID, gName, gRole] = pGroup_id.split('~');
      setGroupName(gName);
      setGroupID(gID);
      setGroupRole(gRole);
      getGroupMemberList({ 'group_id': pGroup_id.split('~')[0] });
    }
    else if (!groupsManagedObject || Object.keys(groupsManagedObject).length === 0) {
      if (pSession.patient_id) {
        response();
        setShowGroupSelect(true);
      }
    }
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
          {groupMemberList.length === 0 && groupID
            ?
            <Box display='flex' marginBottom={5} flexDirection='column' justifyContent='center' alignItems='center'>
              <Typography className={classes.formControl} variant='h5' >
                {'Building the Member List'}
              </Typography>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <CircularProgress />
              </div>
            </Box>
            :
            <GroupForm
              groupMemberList={groupMemberList}
              peopleList={peopleList}
              pPatient={pSession.patient_id}
              pClient={pSession.client_id}
              pGroup={groupID}
              pGroupName={groupName}
              pRole={groupRole}
              isMobile={isMobile}
              onReset={handleAbort}
            />
          }
        </DialogContent>
        {showGroupSelect &&
          <GroupFilter
            pSession={pSession}
            isMobile={isMobile}
            groupsManagedObject={groupsManagedObject}
            onCancel={() => {
              setShowGroupSelect(false);
              onClose();
            }}
            onSelect={(selectedGroup) => {
              setShowGroupSelect(false);
              setGroupName(selectedGroup);
              setGroupID(groupsManagedObject[selectedGroup].group_id);
              setGroupRole(groupsManagedObject[selectedGroup].role);
              getGroupMemberList(groupsManagedObject[selectedGroup]);
            }}
            onRefresh={async () => { 
              await getGroupsManagedObject(pSession.patient_id)
            }}
          >
          </GroupFilter>
        }
      </Dialog>
    )
  );
};
