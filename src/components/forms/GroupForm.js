import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import List from '@material-ui/core/List';

import Collapse from '@material-ui/core/Collapse';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import CloseIcon from '@material-ui/icons/HighlightOff';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import RemoveCircleOutlineIcon from '@material-ui/icons/RemoveCircleOutline';
import PhoneInTalkIcon from '@material-ui/icons/PhoneInTalk';

import TextSMSIcon from '@material-ui/icons/Textsms';
import CallIcon from '@material-ui/icons/Call';
import EmailIcon from '@material-ui/icons/Email';

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
  }
}));

const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: 'AKIAR2O24AQ2HGHS4SFF',
  secretAccessKey: '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'
});

export default ({ groupMemberList, peopleList, pPatient, pClient, pGroup, pGroupName, pRole, isMobile, onReset }) => {

  const classes = useStyles();

  const [person_filter, setPersonFilter] = React.useState('');
  const [person_filter_lower, setPersonFilterLower] = React.useState('');
  const [singleFilterDigit, setSingleFilterDigit] = React.useState(false);
  const [showAddPrompt, setShowAddPrompt] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [workingMemberList, setGroupMemberList] = React.useState(groupMemberList);
  const [editIndex, setEditIndex] = React.useState();

  const [deletePending, setDeletePending] = React.useState(false);
  const [personRec, setPersonRec] = React.useState();
  const [sessionRec, setSessionRec] = React.useState();
  const [showPatientDialog, setShowPatientDialog] = React.useState(false);
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const [confirmPerson, setConfirmPerson] = React.useState('');
  const [confirmIndex, setConfirmIndex] = React.useState('');
  const [promptForMessage, setPromptForMessage] = React.useState('');
  const [recipient, setRecipient] = React.useState();
  const [messageType, setMessageType] = React.useState();
  const [open, setOpen] = React.useState([]);

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
      setPersonFilter(null);
      setPersonFilterLower(null);
    }
    else {
      setPersonFilter(event.target.value);
      setPersonFilterLower(event.target.value.toLowerCase());
      setSingleFilterDigit(event.target.value.length === 1);
    }
    setRowLimit(scrollValue);
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
    else {
      nqMessage = `Sent "${pMessage}" via ${pMessageType === 'time_based' ? '' : (pMessageType === 'sms' ? 'text' : pMessageType)} to ${pRecipient.split(':')[0]}`;
    }
    let lambdaPayload = {
      "body": {
        "client": pClient,
        "author": pPatient,
        "values": pRecipient + ' ~ MessageText = ' + pMessage
      }
    };
    if (pMessageType.toLowerCase() === 'urgent group') { lambdaPayload.body.method = 'urgent'; }
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



  const getSessionInfo = async (pPerson) => {
    let invokeFailed = false;

    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance';
    params.Payload = JSON.stringify({
      action: "get_session_details",
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
      let returnedSession = JSON.parse(lambdaResponse.Payload);
      if (returnedSession.status === 200) {
        setSessionRec(returnedSession.body);
        return returnedSession.body;
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

  const toggleOpen = async (pIndex) => {
    let workingOpen = [];
    setSessionRec(null);
    if (!open[pIndex]) {
      workingOpen[pIndex] = true;
      if (pRole === 'admin' || pRole === 'responsible') {
        getSessionInfo(workingMemberList[pIndex].person_id);
      }
    }
    setOpen(workingOpen);
    setForceRedisplay(!forceRedisplay);
  };

  function formatPhone(pPhone) {
    let match = ('' + pPhone).replace(/\D/g, '').match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
    if (match) { return `(${match[2]}) ${match[3]}-${match[4]}`; }
    else { return pPhone; }
  }

  function filteredPerson(pName = { last: '*$*' }, pLoc, pMessaging = { sms: '*$*' }) {
    if (singleFilterDigit) {
      return (pName.last.toLowerCase().startsWith(person_filter_lower) || pLoc.toLowerCase().startsWith(person_filter_lower + '-'));
    }
    else {
      let searchString = [...Object.values(pName), pLoc, ...Object.values(pMessaging)].join(' ');
      return searchString.toLowerCase().includes(person_filter_lower);
    }
  }

  function makeLink(pMessaging, pPreference) {
    if (!pPreference || ('sms%email%voice'.includes(pPreference) && !pMessaging[pPreference])) {
      try { pPreference = Object.keys(pMessaging)[0] || 'AVA'; }
      catch (e) { pPreference = 'AVA'; }
    }

    switch (pPreference) {
      case 'sms': { return `sms:${pMessaging.sms}`; }
      case 'voice': { return `tel:${pMessaging.voice}`; }
      case 'email': { return `mailto:${pMessaging.email}`; }
      default: {
        return null;
      }
    }
  }

  function makeIcon(pMessaging, pPreference, pIndex) {
    if (!pPreference || ('sms%email%voice'.includes(pPreference) && !pMessaging[pPreference])) {
      try { pPreference = Object.keys(pMessaging)[0] || 'AVA'; }
      catch (e) { pPreference = 'AVA'; }
    }
    switch (pPreference) {
      case 'sms': { return (isMobile ? <TextSMSIcon className={classes.makeIconStyle} key={`sms-icon.${pIndex}`} /> : null); }
      case 'voice': { return (isMobile ? <CallIcon className={classes.makeIconStyle} key={`call-icon.${pIndex}`} /> : null); }
      case 'email': { return <EmailIcon className={classes.makeIconStyle} key={`email-icon.${pIndex}`} />; }
      default: {
        return null;
      }
    }
  }

  function makePreferenceLine(pMessaging, pPreference, pPerson) {
    if (!pPreference || ('sms%email%voice'.includes(pPreference) && !pMessaging[pPreference])) {
      try { pPreference = Object.keys(pMessaging)[0] || 'AVA'; }
      catch (e) { pPreference = 'AVA'; }
    }

    switch (pPreference) {
      case 'sms': { return ['prefers text', formatPhone(pMessaging.sms)]; }
      case 'voice': { return ['prefers voice call', formatPhone(pMessaging.voice)]; }
      case 'email': {
        let emailLines = [];
        if ((pMessaging.email.length < 30) || !isMobile) { emailLines.push(pMessaging.email); }
        else {
          emailLines = pMessaging.email.split('@');
          emailLines[0] += '@';
        }
        return ['prefers e-Mail', ...emailLines];
      }
      case 'time_based': { return ['preference varies by time']; }
      case 'AVA': { return ['AVA messages only']; }
      default: {
        return [`prefers ${pPreference}`];
      }
    }
  }

  function getImage(pPerson) { 
    return s3.getSignedUrl('getObject', {
      Bucket: imageBucket,
      Key: imageURI.replace('[person_id]', pPerson),
      Expires: 3600
    });
  }

  function makeNonPreferenceLine(pMessaging, pPreference, pPerson) {
    let returnArray = [];
    for (const messageType in pMessaging) {
      if (pPreference !== messageType) {
        switch (messageType) {
          case 'sms': {
            if (pMessaging.sms) {
              returnArray.push(`cell ${formatPhone(pMessaging.sms)}`);
            }
            break;
          }
          case 'voice': {
            if (pMessaging.voice) {
              returnArray.push(`home ${formatPhone(pMessaging.voice)}`);
            }
            break;
          }
          case 'email': {
            if (pMessaging.email) {
              let emailLines = [];
              if ((pMessaging.email.length < 30) || !isMobile) { returnArray.push(`e-Mail ${pMessaging.email}`); }
              else {
                emailLines = pMessaging.email.split('@');
                returnArray.push(`e-Mail ${emailLines[0]}@`);
                returnArray.push(`  ${emailLines[1]}`);
              }
            }
            break;
          }
          default: { break; }
        }
      }
    }
    if (returnArray.length > 0) { returnArray.unshift('~~~'); }
    return returnArray;
  }

  const getSession = (pPerson) => {
    if (sessionRec) {
      let lastVersion = null;
      let lastUse = null;
      if (sessionRec.status) { [, lastVersion, lastUse] = sessionRec.status.split(/=|~|\(/); };
      let sessionData = [
        '~~ Tech Info ~~',
        `User ID: ${pPerson}`,
        `Platform: ${sessionRec.platform}`,
        `Version: ${lastVersion || 'not recorded'}`,
        `Last use: ${lastUse || 'not recorded'}`,
        `Log in results: ${sessionRec.event_description || 'no data'}`,
        `Recent Transactions:`
      ];
      if (sessionRec.recentFacts && sessionRec.recentFacts.length > 0) {
        sessionRec.recentFacts.forEach(fact => {
          sessionData.push(fact);
        });
      }
      else {
        sessionData.push('None');
      }
      return sessionData;
    }
    else { return []; }
  };

  // ******************

  let myIndex = workingMemberList.findIndex(row => row.person_id === pPatient);

  return (
    <Dialog
      open={true || forceRedisplay}
      onScroll={onScroll}
      p={2}
      fullScreen
    >
      {workingMemberList && workingMemberList.length > 0 &&
        <React.Fragment>
          <DialogContentText
            className={classes.title}
            id='scroll-dialog-title'
          >
            {`Members of the ${pGroupName}${pGroupName.includes('roup') ? '' : ' Group'}`}
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
          <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
            <List  >
              <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                {rowsWritten = 0}
              </Typography>
              {workingMemberList.map((this_item, index) => (
                ((rowsWritten <= rowLimit) && (!person_filter || filteredPerson(this_item.name, this_item.location || '*na*', this_item.messaging)) ?
                  <Paper component={Box} variant='outlined' key={this_item.person_id + 'frag' + index} >
                    <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                      {rowsWritten++}
                    </Typography>
                    <Box display='flex' flexDirection='column'>
                      <Box
                        display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                        key={this_item.person_id + 'r' + index}
                        className={classes.listItem}
                        onClick={() => { toggleOpen(index); }}
                      >
                        <Box display='flex' flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'>
                          <Box display='flex' flexDirection='column'>
                            <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                              <Typography variant='h5' className={classes.lastName} >{this_item.name.last || this_item.display_name}</Typography>
                              {!isMobile && <Typography variant='h5' className={classes.firstName}>{this_item.name.first}</Typography>}
                            </Box>
                            {isMobile && <Typography variant='h5' className={classes.firstName}>{this_item.name.first}</Typography>}
                            {this_item.location && this_item.location.split('~').map((locLine, locIndex) => (<Typography key={`locationLine-${index}.${locIndex}`} className={classes.locationLine}>{locLine.trim()}</Typography>))}
                            <a href={makeLink(this_item.messaging, this_item.preferred_method)}
                              style={{ color: 'inherit', textDecoration: 'none' }}>
                              <Box
                                display='flex'
                                flexDirection='row'
                                justifyContent='flex-start'
                                alignItems='center'
                                key={`contactRows.${index}`}
                                onClick={() => { toggleOpen(index); }}
                              >
                                {makeIcon(this_item.messaging, this_item.preferred_method, index)}
                                <Box display='flex' flexDirection='column'>
                                  {makePreferenceLine(this_item.messaging, this_item.preferred_method, this_item).map((prefLine, prefIndex) => (
                                    <Typography
                                      key={`prefLine-${index}.${prefIndex}`}
                                      className={classes.preferenceLine}
                                    >
                                      {prefLine}
                                    </Typography>
                                  ))}
                                </Box>
                              </Box>
                            </a>
                            {open[index] &&
                              (makeNonPreferenceLine(this_item.messaging, this_item.preferred_method, this_item)
                                .map((prefLine, prefIndex) => (
                                  <Typography key={`prefLine-${index}.${prefIndex}`} className={classes.preferenceLine}>{prefLine}</Typography>
                                )))
                            }
                          </Box>
                        </Box>
                        <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
                          <Box
                            component="img"
                            ml={isMobile ? 2 : 5}
                            mr={1}
                            minWidth={isMobile ? 75 : 150}
                            maxWidth={isMobile ? 75 : 150}
                            alt=''
                            src={getImage(this_item.person_id)}
                          />
                        </Box>
                        {!open[index] ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                      </Box>
                      {open[index] &&
                        (pRole === 'admin' || pRole === 'responsible') &&
                        (getSession(this_item.person_id)
                          .map((sessLine, sessIndex) => (
                            <Typography
                              key={`prefLine-${index}.${sessIndex}`}
                              className={(sessIndex < 7) ? classes.techInfoLine : classes.techInfoLine2}
                            >
                              {sessLine}
                            </Typography>
                          )))
                      }
                      <Collapse in={open[index]} timeout="auto" unmountOnExit>
                        {
                          <Box display='flex' flexDirection='row' paddingTop={1} paddingBottom={1} justifyContent='center' alignItems='center'>
                            <Box display='flex' flexDirection='column'>
                              <Button
                                onClick={() => {
                                  setPromptForMessage(true);
                                  setMessageType(this_item.preferred_method);
                                  setRecipient(`${this_item.name.first} ${this_item.name.last || this_item.display_name}:` + this_item.person_id);
                                }}
                                className={classes.rowButtonGreen}
                                startIcon={<SendIcon fontSize="small" />}
                              >
                                Message
                              </Button>
                              <Box display='flex' flexDirection='row' paddingTop={1} paddingBottom={1} justifyContent='center' alignItems='center'>
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
                                {(pRole === 'admin' || pRole === 'responsible') &&
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
                            </Box>
                          </Box>
                        }
                      </Collapse>
                    </Box>
                  </Paper>
                  : null
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
                  workingMemberList[editIndex].preferred_method = updatedPerson.prefMethod;
                  workingMemberList[editIndex].home = updatedPerson.voice;
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
              promptText={`What should your ${messageType === 'time_based' ? '' : (messageType === 'sms' ? 'text' : messageType)} message to ${recipient.split(':')[0]} say?`}
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
                setDeletePending(false);
              }}
            >
            </AVAConfirm>
          }

          { // Command Area
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  <Button
                    className={classes.rowButtonGreen}
                    onClick={onReset}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Close'}
                  </Button>
                  {(pRole === 'non-member') ?
                    <Button
                      className={classes.rowButtonGreen}
                      onClick={() => {
                        handleAddPersonToGroup(pPatient, pGroup, 'you');
                      }}
                      startIcon={<AddCircleOutlineIcon size="small" />}
                    >
                      {'Add Myself'}
                    </Button>
                    :
                    <Button
                      className={classes.rowButtonGreen}
                      onClick={() => {
                        handleRemoveGroupMember(pPatient, myIndex);
                      }}
                      startIcon={<RemoveCircleOutlineIcon size="small" />}
                    >
                      {'Remove Myself'}
                    </Button>
                  }
                </Box>
                {(pRole === 'admin' || pRole === 'responsible') &&
                  <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                    <Button
                      className={classes.rowButtonGreen}
                      onClick={() => {
                        setShowAddPrompt(true);
                      }}
                      startIcon={<GroupAddIcon size="small" />}
                    >
                      {'Add Member'}
                    </Button>
                  </Box>
                }
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
                  </Box>
                }
                {(pRole === 'admin' || pRole === 'responsible') &&
                  <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
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
                  </Box>
                }
              </Box>
            </DialogActions>
          }
        </React.Fragment>
      }
    </Dialog >
  );
};;