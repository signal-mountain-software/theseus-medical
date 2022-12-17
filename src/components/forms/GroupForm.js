import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import { SET_PATIENT, SET_SESSION } from '../../contexts/Session/actions';
import useSession from '../../hooks/useSession';

import List from '@material-ui/core/List';

// import Collapse from '@material-ui/core/Collapse';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import CloseIcon from '@material-ui/icons/HighlightOff';
import PhoneInTalkIcon from '@material-ui/icons/PhoneInTalk';
import ContactMailOutlinedIcon from '@material-ui/icons/ContactMailOutlined';

import SwapIcon from '@material-ui/icons/SwapHoriz';

import Button from '@material-ui/core/Button';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';

import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import PrintIcon from '@material-ui/icons/Print';
import StorageOutlined from '@material-ui/icons/StorageOutlined';
import SendIcon from '@material-ui/icons/Send';

import GroupAddIcon from '@material-ui/icons/GroupAdd';

import PatientDialog from '../dialogs/PatientDialog';
import PersonFilter from '../forms/PersonFilter';
import AVAConfirm from './AVAConfirm';
import AVATextInput from '../forms/AVATextInput';

const useStyles = makeStyles(theme => ({
  page: {
    height: 950,
    maxWidth: 1000
  },
  freeInput: {
    marginLeft: '25px',
    marginRight: 2,
    marginBottom: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: theme.spacing(1),
    width: '60%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  buttonArea: {
    maxWidth: 1000,
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  rowButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'contained',
    size: 'small'
  },
  rowButtonDefault: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.primary[theme.palette.type],
  },
  rowButtonRed: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    color: theme.palette.reject[theme.palette.type],
  },
  rowButtonGreen: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.confirm[theme.palette.type],
  },
  rowButtonBack: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    outlineColor: theme.palette.reject[theme.palette.type],
    outlineWidth: '2px',
    outlineStyle: 'auto',
    textTransform: 'none',
    size: 'small',
    color: theme.palette.reject[theme.palette.type],
  },
  rowButtonBlue: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.info[theme.palette.type],
  },
  listItem: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  makeIconStyle: {
    marginRight: theme.spacing(1),
  },
  locationLine: {
    fontSize: theme.typography.fontSize * 1.0,
  },
  preferenceLine: {
    fontSize: theme.typography.fontSize * 0.8,
  },
  techInfoLine: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(2),
  },
  techInfoLine2: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(4),
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  confirm: {
    backgroundColor: 'green',
  },
  firstName: {

  },
  lastName: {
    fontWeight: 'bold',
    marginRight: theme.spacing(1),
  },
  superSizeLast: {
    marginTop: theme.spacing(0),
    fontWeight: 'bold',
    fontSize: theme.typography.fontSize * 2.8
  },
  superSizeFirst: {
    marginTop: theme.spacing(-2.5),
    fontSize: theme.typography.fontSize * 2.8
  },
  upSizeLast: {
    marginTop: theme.spacing(0),
    fontSize: theme.typography.fontSize * 2.0
  },
  upSizeLocation: {
    marginTop: theme.spacing(-1.5),
    fontSize: theme.typography.fontSize * 2.0
  },
  superSizePreferenceLine1: {
    fontSize: theme.typography.fontSize * 2.0,
    marginRight: theme.spacing(1),
  },
  superSizePreferenceLine2: {
    fontSize: theme.typography.fontSize * 2.0,
    fontWeight: 'bold'
  },
  superSizePreferenceLine3: {
    marginTop: theme.spacing(-1.5),
    fontSize: theme.typography.fontSize * 2.0,
    fontWeight: 'bold'
  },
  superSizeArea: {
    minHeight: '100%'
  }
}));

const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

export default ({ groupMemberList, peopleList, pPatient, pPatientName, pClient, pGroup, pGroupRec, pGroupName, pRole, isMobile, onReset }) => {

  const classes = useStyles();
  const { dispatch } = useSession();

  const [person_filter, setPersonFilter] = React.useState(' ');
  const [person_filter_lower, setPersonFilterLower] = React.useState(' ');
  const [singleFilterDigit, setSingleFilterDigit] = React.useState(false);
  const [showAddPrompt, setShowAddPrompt] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [workingMemberList, setGroupMemberList] = React.useState(groupMemberList);
  const [editIndex, setEditIndex] = React.useState();

  const [deletePending, setDeletePending] = React.useState(false);
  const [personRec, setPersonRec] = React.useState();
  const [showPatientDialog, setShowPatientDialog] = React.useState(false);
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const [confirmPerson, setConfirmPerson] = React.useState('');
  const [confirmIndex, setConfirmIndex] = React.useState('');
  const [promptForMessage, setPromptForMessage] = React.useState('');
  const [showSuperSize, setshowSuperSize] = React.useState(false);
  const [superSizeData, setSuperSizeData] = React.useState(false);
  const [recipient, setRecipient] = React.useState();
  const [messageType, setMessageType] = React.useState();
  const [open, setOpen] = React.useState([]);

  const [overrideRole, setOverrideRole] = React.useState();

  const [rowLimit, setRowLimit] = React.useState(20);
  const [previousY, setCurrentY] = React.useState(0);
  const scrollValue = 20;
  var rowsWritten;

  const imageBucket = 'theseus-medical-storage';
  const imageURI = 'public/patients/[person_id].jpg';

  const { enqueueSnackbar } = useSnackbar();

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

  const handleChangePersonFilter = event => {
    if (event.target.value.length === 0) {
      setPersonFilter(' ');
      setPersonFilterLower(' ');
      setSingleFilterDigit(false);
    }
    else {
      setPersonFilter(event.target.value);
      setPersonFilterLower(event.target.value.toLowerCase());
      setSingleFilterDigit(event.target.value.length === 1);
    }
    setRowLimit(scrollValue);
  };

  const prepareSwitch = async (pUser, pSwitchTo, pSwitchName) => {
    let invokeFailed = false;
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:SwitchAccount';
    params.Payload = JSON.stringify({
      action: "prepare_switch",
      request: {
        current_session_user: pUser,
        switch_to_person: pSwitchTo,
        switch_to_name: pSwitchName
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
      let switchResponse = JSON.parse(fResp.Payload);
      if (switchResponse.status === 200) {
        if (Array.isArray(switchResponse.body[0].groups_managed)) {
          switchResponse.body[0].groups_managed = JSON.stringify(switchResponse.body[0].groups_managed);
        }
        return switchResponse.body;
      }
    };
    return [];
  };

  const handleAddPersonToGroup = async (pPerson, pGroup, pDisplayName) => {
    let invokeFailed = false;

    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance';
    params.Payload = JSON.stringify({
      action: "add_person_to_group",
      clientId: pClient,
      request: {
        "person_id": pPerson,
        "group_id": pGroup,
        "current_group_members": workingMemberList
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
      let workingMemberList = JSON.parse(fResp.Payload);
      if (workingMemberList.status === 200) {
        let pName = pDisplayName.split(',');
        enqueueSnackbar(`AVA added ${pName.length > 1 ? pName[1] : ''} ${pName[0]} to the group!`, {
          variant: 'success'
        });
        setGroupMemberList(workingMemberList.body);
        return workingMemberList;
      }
    };
    return [];
  };

  const handleRemoveGroupMember = async (pPerson, pIndex) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance';
    params.Payload = JSON.stringify({
      action: "remove_person_from_group",
      clientId: pClient,
      request: {
        "person_id": pPerson,
        "group_id": pGroup,
        "current_group_members": workingMemberList
      }
    });
    await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while deleting that item.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    let tempMemberList = workingMemberList;
    tempMemberList.splice(pIndex, 1);
    setGroupMemberList(tempMemberList);
    setForceRedisplay(!forceRedisplay);
    return tempMemberList;
  };

  const handlePrintDirectory = async (pGroup) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:printDirectory';
    params.Payload = JSON.stringify({
      "body": {
        "client_id": pClient,
        "requestor": pPatient,
        "report_title": pGroupName,
        "paperSize": [396, 612],
        "showImages": true,
        "group_id": pClient + '~' + pGroup
      }
    });
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while requesting a Group Directory.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    enqueueSnackbar(`Directory Print request for ${pGroupName} has been submitted.`, {
      variant: 'success'
    });
  };

  const handlePrintRoster = async (pGroup) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:group_roster';
    params.Payload = JSON.stringify({
      "body": {
        "client_id": pClient,
        "person_id": pPatient,
        "values": pGroupName + ':group=' + pClient + '~' + pGroup,
        "showCognito": "true"
      }
    });
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while requesting a Group Roster.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    enqueueSnackbar(`Roster report request for ${pGroupName} has been submitted.`, {
      variant: 'success'
    });
  };

  const handleSendMessage = async (pMessage, pRecipient = null, pMessageType) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:messageEngine';
    let nqMessage = '';
    if (!pRecipient) {
      pRecipient = pGroupName + ':group=' + pClient + '~' + pGroup;
      nqMessage = `Sent "${pMessage}" to everyone in ${pGroupName}`;
      if (pMessageType.toLowerCase() === 'urgent group') { nqMessage += ` as an URGENT (phone call preferred) message!`; }
    }
    else if (pMessageType !== 'AVA') {
      nqMessage = `Sent "${pMessage}" ${pMessageType === 'time_based' ? '' : (pMessageType === 'sms' ? 'via text' : ('via ' + pMessageType))} to ${pRecipient.split(':')[0]}`;
    }
    else {
      nqMessage = `Posted "${pMessage}" as an AVA alert for ${pRecipient.split(':')[0]}`;
    }
    if (pRecipient.includes('Administrator')) {
      pMessage = 'Message for ' + pRecipient.split(':')[0] + ' is: ' + pMessage;
    }
    let lambdaPayload = {
      "body": {
        "client": pClient,
        "author": pPatient,
        "values": pRecipient + ' ~ MessageText = ' + pMessage
      }
    };
    if (pMessageType.toLowerCase() === 'urgent group') { lambdaPayload.body.method = 'urgent'; }
    else if (pMessageType === 'AVA') { lambdaPayload.body.method = 'AVA'; }
    params.Payload = JSON.stringify(lambdaPayload);
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while sending a Message.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    enqueueSnackbar(nqMessage, {
      variant: 'success'
    });
  };

  const handlePatientEdit = async (pPerson) => {
    let invokeFailed = false;

    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance';
    params.Payload = JSON.stringify({
      action: "get_person_details",
      clientId: pClient,
      request: {
        "person_id": pPerson,
      }
    });
    let lambdaResponse = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let returnedPerson = JSON.parse(lambdaResponse.Payload);
      if (returnedPerson.status === 200) {
        setPersonRec(returnedPerson.body);
        setShowPatientDialog(true);
        return returnedPerson.body;
      }
    };
  };

  const onScroll = event => {
    if (rowLimit < workingMemberList.length) {
      let currentY = window.scrollY;
      if (currentY - (previousY + 50)) {
        setCurrentY(currentY);
        setRowLimit(rowLimit + scrollValue);
        setForceRedisplay(!forceRedisplay);
      }
    }
  };

  function formatPhone(pPhone) {
    let match = ('' + pPhone).replace(/\D/g, '').match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
    if (match) { return `(${match[2]}) ${match[3]}-${match[4]}`; }
    else { return pPhone; }
  }

  function okToShow(pItem) {
    if ((person_filter.length > 0) && !filteredPerson(pItem.name, pItem.location, pItem.messaging, pItem)) { return false; }
    if (pGroup.toLowerCase() === '*all') { return true; }
    if (['responsible', 'admin'].includes(pRole)) { return true; }
    if (pItem.directory_option !== 'exclude') { return true; };
    return false;
  }

  function filteredPerson(pName = { last: '*$*' }, pLoc = '*na*', pMessaging = { sms: '*$*' }, pPerson) {
    if (singleFilterDigit) {
      return (pName.last.toLowerCase().startsWith(person_filter_lower.trim()) || pLoc.toLowerCase().startsWith(person_filter_lower.trim() + '-'));
    }
    else {
      let searchString = [...Object.values(pName), pPerson.search_data, pLoc, ...Object.values(pMessaging)].join(' ');
      return searchString.toLowerCase().includes(person_filter_lower.trim());
    }
  }

  function getImage(pPerson, pIndex) {
    workingMemberList[pIndex].image =
      s3.getSignedUrl('getObject', {
        Bucket: imageBucket,
        Key: imageURI.replace('[person_id]', pPerson),
        Expires: 3600
      });
    return workingMemberList[pIndex];
  }

  function makeContactLines(pMessaging, pPreference, pPerson) {
    let returnArray = [];
    for (const messageType in pMessaging) {
      switch (messageType) {
        case 'sms': {
          if (pMessaging.sms && (!pMessaging.sms_private || (pGroup.toLowerCase() === '*all'))) {
            returnArray.push(`sms:${pMessaging.sms}~cell ${formatPhone(pMessaging.sms)}${pMessaging.sms_private ? ' *UNPUBLISHED*' : ''}`);
          }
          break;
        }
        case 'voice': {
          if (pMessaging.voice && (!pMessaging.voice_private || (pGroup.toLowerCase() === '*all'))) {
            returnArray.push(`tel:${pMessaging.voice}~home ${formatPhone(pMessaging.voice)}${pMessaging.voice_private ? ' *UNPUBLISHED*' : ''}`);
          }
          break;
        }
        case 'office': {
          if (pMessaging.office && (!pMessaging.office_private || (pGroup.toLowerCase() === '*all'))) {
            returnArray.push(`tel:${pMessaging.office}~work ${formatPhone(pMessaging.office)}${pMessaging.office_private ? ' *UNPUBLISHED*' : ''}`);
          }
          break;
        }
        case 'email': {
          if (pMessaging.email && (!pMessaging.email_private || (pGroup.toLowerCase() === '*all'))) {
            let emailLines = [];
            if ((pMessaging.email.length < 30) || !isMobile) { returnArray.push(`mailto:${pMessaging.email}~e-Mail ${pMessaging.email}${pMessaging.email_private ? ' *UNPUBLISHED*' : ''}`); }
            else {
              emailLines = pMessaging.email.split('@');
              returnArray.push(`mailto:${pMessaging.email}~e-Mail ${emailLines[0]}@`);
              returnArray.push(`mailto:${pMessaging.email}~  ${emailLines[1]}`);
            }
          }
          break;
        }
        default: { break; }
      }
    }
    return returnArray;
  }

  // ******************

  // let myIndex = workingMemberList.findIndex(row => row.person_id === pPatient);

  return (
    <Dialog
      open={true || forceRedisplay}
      onScroll={onScroll}
      p={2}
      fullScreen
    >
      {workingMemberList && workingMemberList.length > 0 &&
        <React.Fragment>
          {!showSuperSize &&
            <React.Fragment>
              <DialogContentText
                className={classes.title}
                id='scroll-dialog-title'
              >
                {(pGroup.toLowerCase() === '*all') ?
                  'Administrative View - All Accounts' :
                  `Members of the ${pGroupName}${pGroupName.includes('roup') ? '' : ' Group'}`
                }
              </DialogContentText>
              <TextField
                id='List Filter'
                value={person_filter}
                onChange={handleChangePersonFilter}
                className={classes.freeInput}
                label={isMobile ? 'Filter' : 'Type a few letters to filter the list'}
                variant={'standard'}
                autoComplete='off'
              />
            </React.Fragment>
          }
          <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
            <List>
              <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                {rowsWritten = 0}
              </Typography>
              {workingMemberList.map((this_item, index) => (
                ((rowsWritten <= rowLimit) && okToShow(this_item) &&
                  <Paper component={Box} variant='outlined' key={this_item.person_id + 'frag' + index} >
                    <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                      {rowsWritten++}
                    </Typography>
                    <Box display='flex' flexDirection='column'>
                      <Box
                        display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                        key={this_item.person_id + 'r' + index}
                        className={classes.listItem}
                      >
                        <Box display='flex' flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'>
                          <Box display='flex' flexDirection='column'>
                            <Box onClick={() => {
                              setshowSuperSize(true);
                              setSuperSizeData(this_item);
                            }}>
                              <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                <Typography variant='h5' className={classes.lastName} >{this_item.name.last || this_item.display_name}</Typography>
                                {!isMobile && <Typography variant='h5' className={classes.firstName}>{this_item.name.first}</Typography>}
                              </Box>
                              {isMobile && <Typography variant='h5' className={classes.firstName}>{this_item.name.first}</Typography>}
                            </Box>
                            {(this_item.member_of) &&
                              <Typography key={`member_of-${index}`} className={classes.lastName}>{this_item.member_of}</Typography>
                            }
                            {this_item.location && this_item.location.split('~').map((locLine, locIndex) => (
                              <Typography key={`locationLine-${index}.${locIndex}`} className={classes.locationLine}>{locLine.trim()}</Typography>
                            ))}
                            {(this_item.directory_option === 'exclude') &&
                              <Typography key={`excluded-${index}`} className={classes.locationLine}>{'** Excluded from Directory **'}</Typography>
                            }
                            <Box
                              display='flex'
                              flexDirection='row'
                              justifyContent='flex-start'
                              alignItems='center'
                              key={`contactRows.${index}`}
                            >
                              <Box display='flex' flexDirection='column'>
                                {(makeContactLines(this_item.messaging, this_item.preferred_method, this_item)
                                  .map((prefLine, prefIndex) => (
                                    <a href={prefLine.split('~')[0]}
                                      key={`prefLink-${index}.${prefIndex}`}
                                      style={{ color: 'inherit', textDecoration: 'none' }}>
                                      <Typography
                                        key={`prefLine-${index}.${prefIndex}`}
                                        className={classes.preferenceLine}
                                      >
                                        {prefLine.split('~')[1]}
                                      </Typography>
                                    </a>
                                  )))}
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                        <Box
                          display='flex'
                          flexDirection='row'
                          justifyContent='space-between'
                          alignItems='center'
                          onClick={() => {
                            if (pRole === 'admin' || pRole === 'responsible') {
                              open[index] = !open[index];
                              setOpen(open);
                              setForceRedisplay(!forceRedisplay);
                            }
                          }}
                        >
                          <Box>
                            <Box
                              component="img"
                              ml={isMobile ? 2 : 5}
                              mr={1}
                              minWidth={isMobile ? 100 : 150}
                              maxWidth={isMobile ? 100 : 150}
                              alt=''
                              src={this_item.image || getImage(this_item.person_id, index)}
                            />
                          </Box>
                          {(pRole === 'admin' || pRole === 'responsible') &&
                            (!open[index] ? <ExpandMoreIcon /> : <ExpandLessIcon />)
                          }
                        </Box>
                      </Box>
                      {open[index] &&
                        <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                          {(pRole === 'admin' || pRole === 'responsible') &&
                            <Button
                              onClick={async () => {
                                let switchData = await prepareSwitch(
                                  pPatient,
                                  this_item.person_id,
                                  `${this_item.name.first} ${this_item.name.last || this_item.display_name}:`
                                );
                                dispatch({ type: SET_SESSION, payload: switchData[0] });
                                dispatch({ type: SET_PATIENT, payload: switchData[1] });
                                let jumpTo = window.location.href.replace('refresh', 'theseus');
                                window.location.replace(jumpTo);
                              }}
                              className={classes.rowButtonGreen}
                              startIcon={<SwapIcon fontSize="small" />}
                            >
                              Switch to
                            </Button>
                          }
                          {pRole === 'responsible' &&
                            <Button
                              onClick={() => {
                                setEditIndex(index);
                                handlePatientEdit(this_item.person_id);
                              }}
                              className={classes.rowButtonDefault}
                              startIcon={<EditIcon fontSize="small" />}
                            >
                              View/Edit
                            </Button>
                          }
                          {(pRole === 'admin' || pRole === 'responsible') && (pGroup.toLowerCase() !== '*all') &&
                            <Button
                              onClick={() => {
                                setConfirmMessage(`Confirm removing ${this_item.name.first} ${this_item.name.last || this_item.display_name} from the ${pGroupName} ${pGroupName.includes('roup') ? '' : ' Group'}`);
                                setConfirmPerson(this_item.person_id);
                                setConfirmIndex(index);
                                setDeletePending(true);
                                setForceRedisplay(false);
                              }}
                              className={classes.rowButtonGreen}
                              startIcon={<DeleteIcon fontSize="small" />}
                            >
                              Remove from Group
                            </Button>
                          }
                        </Box>
                      }
                    </Box>
                  </Paper>
                )
              ))}
            </List>
          </Paper>
          {showPatientDialog &&
            <PatientDialog
              patient={personRec}
              picture={""}
              open={true}
              onClose={(updatedPerson) => {
                if (updatedPerson) {
                  workingMemberList[editIndex].preferred_method = updatedPerson.preferred_method;
                  workingMemberList[editIndex].home = updatedPerson.voice;
                  workingMemberList[editIndex].work = updatedPerson.office;
                  workingMemberList[editIndex].cell = updatedPerson.sms;
                  workingMemberList[editIndex].email = updatedPerson.email;
                  workingMemberList[editIndex].name = {
                    'last': updatedPerson.last,
                    'first': updatedPerson.first
                  };
                  workingMemberList[editIndex].location = updatedPerson.location;
                  workingMemberList[editIndex].search_data = updatedPerson.search_data.toLowerCase();
                }
                setShowPatientDialog(false);
              }}
            />
          }
          {showAddPrompt &&
            <PersonFilter
              prompt={'Tap the name of the person you wish to add'}
              peopleList={peopleList}
              onCancel={() => {
                setShowAddPrompt(false);
              }}
              onSelect={(selectedPerson) => {
                handleAddPersonToGroup(selectedPerson.split(':')[1], pGroup, selectedPerson.split(':')[0]);
              }}
            >
            </PersonFilter>
          }
          {promptForMessage &&
            <AVATextInput
              promptText={`What should your ${messageType === 'time_based' ? '' : (messageType === 'sms' ? 'text' : (!messageType ? 'AVA' : messageType))} message to ${recipient.split(':')[0]} say?`}
              buttonText='Send'
              onCancel={() => { setPromptForMessage(false); }}
              onSave={(messageText) => {
                setPromptForMessage(false);
                handleSendMessage(messageText, recipient, messageType);
              }}
            />
          }
          {deletePending &&
            <AVAConfirm
              promptText={confirmMessage}
              onCancel={() => {
                setDeletePending(false);
              }}
              onConfirm={() => {
                handleRemoveGroupMember(confirmPerson, confirmIndex);
                if (confirmPerson === pPatient) { setOverrideRole('non-member'); }
                setDeletePending(false);
              }}
            >
            </AVAConfirm>
          }

          {!showSuperSize &&    // Command Area
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  <Button
                    className={classes.rowButtonGreen}
                    onClick={() => {
                      setOverrideRole(null);
                      onReset();
                    }}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Close'}
                  </Button>
                  {(pRole === 'admin' || pRole === 'responsible') &&
                    <React.Fragment>
                      {(pGroup.toLowerCase() !== '*all') &&
                        <Button
                          className={classes.rowButtonGreen}
                          onClick={() => {
                            setShowAddPrompt(true);
                          }}
                          startIcon={<GroupAddIcon size="small" />}
                        >
                          {'Add Member'}
                        </Button>
                      }
                      <Button
                        className={classes.rowButtonDefault}
                        onClick={() => { handlePrintDirectory(pGroup); }}
                        startIcon={<PrintIcon size='small' />}
                      >
                        {'Directory'}
                      </Button>
                      <Button
                        onClick={() => { handlePrintRoster(pGroup); }}
                        className={classes.rowButtonGreen}
                        startIcon={<StorageOutlined size='small' />}
                      >
                        {'Roster'}
                      </Button>
                    </React.Fragment>
                  }
                  {(overrideRole === 'member' || (!overrideRole && (pRole === 'member'))) &&
                    <Button
                      onClick={() => {
                        setConfirmMessage(`Confirm removing ${pPatientName} from the ${pGroupName} ${pGroupName.includes('roup') ? '' : ' Group'}`);
                        setConfirmPerson(pPatient);
                        setConfirmIndex(workingMemberList.findIndex(m => { return m.person_id === pPatient; }));
                        setDeletePending(true);
                        setForceRedisplay(false);
                      }}
                      className={classes.rowButtonGreen}
                      startIcon={<DeleteIcon fontSize="small" />}
                    >
                      Remove me
                    </Button>
                  }
                  {(overrideRole === 'non-member' || (!overrideRole && (pRole === 'non-member'))) &&
                    <React.Fragment>
                      {(pGroup.toLowerCase() !== '*all') &&
                        <Button
                          className={classes.rowButtonGreen}
                          onClick={() => {
                            handleAddPersonToGroup(pPatient, pGroup, pPatientName);
                            setOverrideRole('member');
                          }}
                          startIcon={<GroupAddIcon sisetMessageTypeze="small" />}
                        >
                          {'Add Myself'}
                        </Button>
                      }
                    </React.Fragment>
                  }
                  {(pRole && (pRole !== 'admin') && (pRole !== 'responsible')) &&
                    <Button
                      onClick={() => {
                        setPromptForMessage(true);
                        setMessageType('');
                        let rKey = '';
                        pGroupRec.admin_list.forEach((g, i) => {
                          rKey += ((i > 0) ? ' ~ ' : '') + `${pGroupName}${pGroupName.includes('roup') ? '' : ' Group'} Administrator:${g}`;
                        });
                        setRecipient(rKey);
                      }}
                      className={classes.rowButtonGreen}
                      startIcon={<SendIcon size='small' />}
                    >
                      {`Msg Admin`}
                    </Button>
                  }
                </Box>
                {(pRole === 'admin' || pRole === 'responsible') &&
                  <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                    <Button
                      onClick={() => {
                        setPromptForMessage(true);
                        setMessageType('Group');
                        setRecipient(pGroupName + ':group=' + pClient + '~' + pGroup);
                      }}
                      className={classes.rowButtonGreen}
                      startIcon={<SendIcon size='small' />}
                    >
                      {`Group ${isMobile ? 'Msg' : 'Message'}`}
                    </Button>
                    <Button
                      onClick={() => {
                        setPromptForMessage(true);
                        setMessageType('URGENT Group');
                        setRecipient(pGroupName + ':group=' + pClient + '~' + pGroup);
                      }}
                      className={classes.rowButtonRed}
                      startIcon={<PhoneInTalkIcon size='small' />}
                    >
                      {`Urgent ${isMobile ? 'Msg' : 'Message'}`}
                    </Button>
                    <Button
                      onClick={() => {
                        setPromptForMessage(true);
                        setMessageType('AVA');
                        setRecipient(pGroupName + ':group=' + pClient + '~' + pGroup);
                      }}
                      className={classes.rowButtonGreen}
                      startIcon={<ContactMailOutlinedIcon size='small' />}
                    >
                      {`AVA alert ${isMobile ? 'Msg' : 'Message'}`}
                    </Button>
                  </Box>
                }
              </Box>
            </DialogActions>
          }
        </React.Fragment>
      }
      {showSuperSize &&
        <List classes={{ root: classes.superSizeArea }}   >
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center' >
            <Box>
              <Box
                component="img"
                mt={5}
                minWidth={250}
                maxWidth={250}
                alt=''
                src={superSizeData.image}
              />
            </Box>
            <Typography className={classes.superSizeLast} >{superSizeData.name.last || superSizeData.display_name}</Typography>
            <Typography className={classes.superSizeFirst}>{superSizeData.name.first}</Typography>
            {(superSizeData.member_of) &&
              <Typography key={`member_of-superSize`} className={classes.upSizeLast}>{superSizeData.member_of}</Typography>
            }
            {superSizeData.location && superSizeData.location.split('~').map((locLine, locIndex) => (
              <Typography key={`locationLine-superSize`} className={classes.upSizeLocation}>{locLine.trim()}</Typography>
            ))}
            {(superSizeData.directory_option === 'exclude') &&
              <Typography key={`excluded-superSize`} className={classes.upSizeLocation}>{'** Excluded from Directory **'}</Typography>
            }
            {(makeContactLines(superSizeData.messaging, superSizeData.preferred_method, superSizeData)
              .map((prefLine, prefIndex) => (
                <a href={prefLine.split('~')[0]}
                  key={`prefLink-superSize.${prefIndex}`}
                  style={{ color: 'inherit', textDecoration: 'none' }}>
                  {(prefLine.split('~')[1].split(' ')[0].trim() !== '')
                    ?
                    <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center' >
                      <Typography key={`prefLine-superSize.${prefIndex}`} className={classes.superSizePreferenceLine1}>
                        {prefLine.split('~')[1].split(' ')[0]}:
                      </Typography>
                      <Typography key={`prefLine-superSize.${prefIndex}`} className={classes.superSizePreferenceLine2}>
                        {prefLine.split('~')[1].replace(' ', '%%').split('%%')[1]}
                      </Typography>
                    </Box>
                    :
                    <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center' >
                      <Typography key={`prefLine-superSize.${prefIndex}`} className={classes.superSizePreferenceLine3}>
                        {prefLine.split('~')[1].replace(' ', '%%').split('%%')[1]}
                      </Typography>
                    </Box>
                  }
                </a>
              )))}
            <Button
              className={classes.rowButtonBack}
              onClick={() => {
                setshowSuperSize(false);
                setForceRedisplay(!forceRedisplay);
              }}
            >
              {'Back'}
            </Button>
          </Box>
        </List>
      }
    </Dialog >
  );
};;