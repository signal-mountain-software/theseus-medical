import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';

import GroupForm from '../forms/GroupForm';
import GroupFilter from '../forms/GroupFilter';
import PersonFilter from '../forms/PersonFilter';

import useMediaQuery from '@material-ui/core/useMediaQuery';

const useStyles = makeStyles(theme => ({
  pageHead: {
    paddingTop: theme.spacing(1),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    paddingBottom: theme.spacing(1),
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
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },
  freeInput: {
    marginLeft: 0,
    marginBottom: '10px',
    marginRight: '2px',
    paddingLeft: 0,
    paddingRight: 0,
    verticalAlign: 'middle',
    minHeight: theme.typography.fontSize * 2.8,
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
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
  const [showAddPrompt, setShowAddPrompt] = React.useState(false);

  const [groupName, setGroupName] = React.useState();
  const [groupID, setGroupID] = React.useState();

  const classes = useStyles();

  const [changes, setChanges] = React.useState(false);
  if (changes) { }

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
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
    params.Payload = JSON.stringify({
      action: "get_group_members",
      clientId: pSession.client_id,
      request: {
        "group_id": pGroup,
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
    return [];
  };

  const handleAddPersonToGroup = async (pPerson, pGroup) => { 
    let invokeFailed = false;
    params.Payload = JSON.stringify({
      action: "add_person_to_group",
      clientId: pSession.client_id,
      request: {
        "person_id": pPerson,
        "group_id": pGroup,
        "current_group_members": groupMemberList
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
    return [];
  }

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

  const handleAbort = () => {
    setChanges(false);
    setShowGroupSelect(true);
    // onClose();
  };

  // **************************

  React.useEffect(() => {
    let aList = [];
    let response = (
      async () => {
        aList = await getGroupsManagedObject(pSession.patient_id);
      }
    );
    if (!groupsManagedObject || Object.keys(groupsManagedObject).length === 0) {
      if (pSession.patient_id) {
        response();
        console.log(aList);
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
          mb={0}
          flexDirection='row'
          className={classes.pageHead}
          justifyContent='flex-start'
          alignItems='center'
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
            <DialogContentText className={classes.title} id='scroll-dialog-title'>
              {groupName || `Group Maintenance`}
            </DialogContentText>
            <DialogContentText className={classes.subDescriptionText}>
              {groupMemberList.length === 0 ? 'Getting Group' : ``}
            </DialogContentText>
          </Box>
        </Box>
        <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
          <GroupForm
            groupMemberList={groupMemberList}
            pClient={pSession.client_id}
            pGroup={groupID}
            onReset={async () => {
              await getGroupMemberList(groupID);
            }}
          />
        </DialogContent>
        <DialogActions style={{ justifyContent: 'center' }}>
          <Button className={classes.reject} size='small' variant='contained' onClick={handleAbort}>
            {'Done'}
          </Button>
          <Button
            className={classes.confirm}
            size='small'
            variant='contained'
            onClick={() => {
              setShowAddPrompt(true);
            }}>
            {'Add Member'}
          </Button>
        </DialogActions>
        {showGroupSelect &&
          <GroupFilter
            groupsManagedObject={groupsManagedObject}
            onCancel={() => {
              setShowGroupSelect(false);
              onClose();
            }}
            onSelect={(selectedGroup) => {
              setShowGroupSelect(false);
              setGroupName(selectedGroup);
              setGroupID(groupsManagedObject[selectedGroup]);
              getGroupMemberList(groupsManagedObject[selectedGroup]);
            }}
          >
          </GroupFilter>
        }
        {showAddPrompt &&
          <PersonFilter
            peopleList={peopleList}
            onCancel={() => {
              setShowAddPrompt(false);
            }}
            onSelect={(selectedPerson) => {
              setShowAddPrompt(false);
              handleAddPersonToGroup(selectedPerson.split(':')[1], groupID)
            }}
          >
          </PersonFilter>
        }
      </Dialog>
    )
  );
};
