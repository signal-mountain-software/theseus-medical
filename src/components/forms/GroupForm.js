import React from 'react';
import { dbClient, lambda } from '../../util/AVAUtilities';

import { useSnackbar } from 'notistack';
import { getImage, formatPhone } from '../../util/AVAPeople';
import { cl } from '../../util/AVAUtilities';
import { getMemberList, addMember } from '../../util/AVAGroups';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import { SET_PATIENT, SET_SESSION } from '../../contexts/Session/actions';
import useSession from '../../hooks/useSession';

import List from '@material-ui/core/List';

// import Collapse from '@material-ui/core/Collapse';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import CloseIcon from '@material-ui/icons/HighlightOff';
import PhoneInTalkIcon from '@material-ui/icons/PhoneInTalk';
import ContactMailOutlinedIcon from '@material-ui/icons/ContactMailOutlined';
import MenuUpdateIcon from '@material-ui/icons/MobileFriendly';

import CircularProgress from '@material-ui/core/CircularProgress';
import LinearProgress from '@material-ui/core/LinearProgress';

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
import MakeMessage from './MakeMessage';

const useStyles = makeStyles(theme => ({
  page: {
    height: 950,
    maxWidth: 1000
  },
  progressBar: {
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(3),
    backgroundColor: '#a3a0a0',
    color: '#000000',
    transition: 'none',
    height: '5px'
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
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
    outlineColor: theme.palette.reject[theme.palette.type],
    outlineWidth: '2px',
    outlineStyle: 'auto',
    textTransform: 'none',
    size: 'small',
  },
  rowButtonSend: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginTop: theme.spacing(4),
    marginBottom: theme.spacing(2),
    outlineColor: theme.palette.confirm[theme.palette.type],
    outlineWidth: '2px',
    outlineStyle: 'auto',
    textTransform: 'none',
    size: 'small',
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
  containerBox: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
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
    marginTop: theme.spacing(2),
    fontSize: theme.typography.fontSize * 2.0,
    flexGrow: 1,
    textAlign: 'center',
    lineHeight: `${theme.spacing(3)}px`,
  },
  upSizePreferenceBox: {
    marginTop: theme.spacing(2),
    lineHeight: `${theme.spacing(3)}px`,
  },
  superSizePreferenceLine1: {
    fontSize: theme.typography.fontSize * 2.0,
    marginRight: theme.spacing(1),
  },
  superSizePreferenceLine2: {
    lineHeight: `${theme.spacing(3)}px`,
    // marginTop: theme.spacing(0),
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

export default ({ groupMemberList, peopleList, pPatient, pPatientName, pClient, pGroup, pGroupRec, pGroupName, pRole, onReset }) => {

  const classes = useStyles();
  const { dispatch } = useSession();

  const [person_filter_lower, setPersonFilterLower] = React.useState(' ');
  const [singleFilterDigit, setSingleFilterDigit] = React.useState(false);
  const [filtering, setFiltering] = React.useState(false);
  const [showAddPrompt, setShowAddPrompt] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [workingMemberList, setGroupMemberList] = React.useState(groupMemberList);
  const [editIndex, setEditIndex] = React.useState();

  const [deletePending, setDeletePending] = React.useState(false);
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
  const [choiceList, setChoiceList] = React.useState([]);

  const [overrideRole, setOverrideRole] = React.useState();

  const [loading, setLoading] = React.useState(null);
  const [progress, setProgress] = React.useState(100);
  const [pWidth, setPWidth] = React.useState(60);

  const [rowLimit, setRowLimit] = React.useState(5);
  const [previousY, setCurrentY] = React.useState(0);
  const scrollValue = 5;
  var rowsWritten;
  let filterTimeOut;

  let allGroups = (pGroup && (pGroup.toLowerCase === '*all'));

  const { enqueueSnackbar } = useSnackbar();

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('sm')); // checks if current device is a smart phone

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  const handleChangePersonFilter = vCheck => {
    clearTimeout(filterTimeOut);
    cl(`set timeout with ${vCheck} at ${new Date().getTime()}`);
    filterTimeOut = setTimeout(() => {
      cl(`timeout ended ${vCheck} at ${new Date().getTime()}`);
      if (vCheck.length === 0) {
        setPersonFilterLower('');
        setSingleFilterDigit(false);
        setFiltering(false);
      }
      else {
        setPersonFilterLower(vCheck.toLowerCase());
        setSingleFilterDigit(vCheck.length === 1);
        setFiltering(true);
      }
      setRowLimit(scrollValue);
    }, 500);
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

  const handleAddPersonToGroup = async (pPerson, pGroup) => {
    for (let p = 0; p < pPerson.length; p++) {
      await addMember(pPerson[p], pClient, pGroup);
    }
    let memberInfo = await getMemberList(pGroup, pClient, { "sort": true, "exclude": false });
    setGroupMemberList(memberInfo.peopleList);
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

  async function handleMenuUpdate(memberList) {
    // What we actually do is wipe out the AVA_main_menu entry from the AVAMenu table, forcing a reload next time 
    let mL = memberList.length;
    let mLP = 1;
    let emptyMenu = [];
    if (mL > 100) { mLP = (100 / mL); }
    for (let m = 0; m < mL; m++) {
      let member = memberList[m];
      screenStatus('Updating Menus', ((m / mL) * 100), (((mL * mLP) / 40) + .75));
      await dbClient
        .update({
          Key: { person_id: member.person_id },
          UpdateExpression: 'set AVA_main_menu = :m',
          ExpressionAttributeValues: {
            ':m': emptyMenu
          },
          TableName: "AVAMenu",
        })
        .promise()
        .catch(error => {
          cl(`AVA couldn't update your Menu settings.  Error is ${error}`);
        });
    }
    setLoading(null);
    return;

    function screenStatus(statusMessage, progressPct, progressWidth) {
      setLoading(statusMessage);
      setProgress(progressPct);
      setPWidth(progressWidth * 100);
      setForceRedisplay(!forceRedisplay);
    };
  }

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

  const setChoices = async (inList) => {
    let response = [];
    let memberInfo = await getMemberList(inList, pClient, { "sort": true, "exclude": false });
    /* getMemberList returns
        {
          peopleList: [<People records of the members>],
          groupList: [<Group records for the selected groups>]
        }
    */
    let mInfo;
    let pLL = memberInfo.peopleList.length;
    for (let e = 0; e < pLL; e++) {
      let p = memberInfo.peopleList[e];
      let searchString = [...Object.values(p.name), p.search_data, p.location].join(' ');
      if (p.messaging) { searchString += Object.values(p.messaging).join(' '); }
      // list is of the form <name>:<id>:<search_string>
      try {
        mInfo = `${p.name.last}, ${p.name.first}:${p.person_id}:${searchString}`;
        response.push(mInfo);
      }
      catch (error) {
        cl(`response push error at index ${e} with ${mInfo}`);
      }
    };
    setChoiceList(response);
    setShowAddPrompt(true);
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

  function okToShow(pPerson) {
    try {
      if (singleFilterDigit) {
        return (pPerson.name.last.toLowerCase().startsWith(person_filter_lower.trim()) || pPerson.location.toLowerCase().startsWith(person_filter_lower.trim() + '-'));
      }
      else {
        let searchString = [...Object.values(pPerson.name), pPerson.search_data, pPerson.location].join(' ');
        if (pPerson.messaging) { searchString += Object.values(pPerson.messaging).join; }
        return searchString.toLowerCase().includes(person_filter_lower.trim());
      }
    }
    catch (error) {
      return false;
    }
  }

  function makeContactLines(pMessaging, pPreference, pPerson) {
    let returnArray = [];
    for (const messageType in pMessaging) {
      switch (messageType) {
        case 'sms': {
          if (pMessaging.sms && (!pMessaging.sms_private || allGroups)) {
            returnArray.push(`sms:${pMessaging.sms}~cell ${formatPhone(pMessaging.sms)}${pMessaging.sms_private ? ' *UNPUBLISHED*' : ''}`);
          }
          break;
        }
        case 'voice': {
          if (pMessaging.voice && (!pMessaging.voice_private || allGroups)) {
            returnArray.push(`tel:${pMessaging.voice}~home ${formatPhone(pMessaging.voice)}${pMessaging.voice_private ? ' *UNPUBLISHED*' : ''}`);
          }
          break;
        }
        case 'office': {
          if (pMessaging.office && (!pMessaging.office_private || allGroups)) {
            returnArray.push(`tel:${pMessaging.office}~work ${formatPhone(pMessaging.office)}${pMessaging.office_private ? ' *UNPUBLISHED*' : ''}`);
          }
          break;
        }
        case 'email': {
          if (pMessaging.email && (!pMessaging.email_private || allGroups)) {
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

  return (
    <React.Fragment>
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
                  {(!pGroup || allGroups) ?
                    'Administrative View - All Accounts' :
                    `Members of the ${pGroupName} Group`
                  }
                </DialogContentText>
                <TextField
                  id='List Filter'
                  onChange={event => (handleChangePersonFilter(event.target.value))}
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
                  ((rowsWritten <= rowLimit) && (!filtering || okToShow(this_item)) &&
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
                            <Box
                              onClick={() => {
                                setshowSuperSize(true);
                                setSuperSizeData(this_item);
                              }}
                              display='flex' flexDirection='column'>
                              <Box >
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
                                src={getImage(this_item.person_id)}
                              />
                            </Box>
                            <Button
                              onClick={() => {
                                setPromptForMessage(true);
                                setMessageType('');
                                let rKey = `${this_item.name.first || this_item.display_name} ${this_item.name.last}:${this_item.person_id}`;
                                setRecipient(rKey.trim());
                              }}
                              className={classes.rowButtonGreen}
                              startIcon={<SendIcon fontSize="small" />}
                            >
                            </Button>
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
                                  setShowPatientDialog(true);
                                }}
                                className={classes.rowButtonDefault}
                                startIcon={<EditIcon fontSize="small" />}
                              >
                                View/Edit
                              </Button>
                            }
                            {(pRole === 'admin' || pRole === 'responsible') && !allGroups &&
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
                patient={workingMemberList[editIndex]}
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
                peopleList={choiceList}
                onCancel={() => {
                  setShowAddPrompt(false);
                }}
                onSelect={async (selectedPerson) => {
                  await handleAddPersonToGroup(selectedPerson, pGroup);
                  setShowAddPrompt(false);
                }}
                multiSelect={true}
              >
              </PersonFilter>
            }
            {promptForMessage &&
              <MakeMessage
                titleText={(messageType.includes('URGENT')) ? 'AVA will attempt to voice call all phones' : null}
                promptText={`What should your ${messageType.includes('Group') ? 'group ' : ''}message to ${recipient.split(':')[0]} say?`}
                buttonText={'Send'}
                sender={{
                  "client_id": pClient,
                  "patient_id": pPatient,
                  "patient_display_name": pPatientName
                }}
                pRecipientID={recipient.split(':')[1]}
                pRecipientName={recipient.split(':')[0]}
                onCancel={() => { setPromptForMessage(false); }}
                onComplete={() => { setPromptForMessage(false); }}
                setMethod={(messageType === 'AVA') ? 'AVA' : (messageType.includes('URGENT') ? 'voice' : null)}
                allowCancel={true}
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
                        {!allGroups &&
                          <Button
                            className={classes.rowButtonGreen}
                            onClick={async () => {
                              await setChoices(peopleList);
                            }}
                            startIcon={<GroupAddIcon size="small" />}
                          >
                            {'Add Members'}
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
                        {!allGroups &&
                          <Button
                            className={classes.rowButtonGreen}
                            onClick={async () => {
                              await handleAddPersonToGroup([pPatient], pGroup);
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
                          setRecipient(pGroupName + ':GRP//' + pClient + '/' + pGroup);
                        }}
                        className={classes.rowButtonGreen}
                        startIcon={<SendIcon size='small' />}
                      >
                        {`Group Msg`}
                      </Button>
                      <Button
                        onClick={() => {
                          setPromptForMessage(true);
                          setMessageType('URGENT Group');
                          setRecipient(pGroupName + ':GRP//' + pClient + '/' + pGroup);
                        }}
                        className={classes.rowButtonRed}
                        startIcon={<PhoneInTalkIcon size='small' />}
                      >
                        {`Call`}
                      </Button>
                      <Button
                        onClick={() => {
                          setPromptForMessage(true);
                          setMessageType('AVA');
                          setRecipient(pGroupName + ':GRP//' + pClient + '/' + pGroup);
                        }}
                        className={classes.rowButtonGreen}
                        startIcon={<ContactMailOutlinedIcon size='small' />}
                      >
                        {`Notify`}
                      </Button>
                      <Button
                        onClick={async () => { await handleMenuUpdate(workingMemberList); }}
                        className={classes.rowButtonGreen}
                        startIcon={<MenuUpdateIcon size='small' />}
                      >
                        {'Menu Upd'}
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
                <Typography key={`locationLine-superSize_${locIndex}`} className={classes.upSizeLocation}>{locLine.trim()}</Typography>
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
                      <Box className={classes.upSizePreferenceBox} display='flex' flexDirection='column' justifyContent='flex-start' alignItems='center' >
                        <Typography key={`prefLine-superSize.${prefIndex}a`} className={classes.superSizePreferenceLine1}>
                          {prefLine.split('~')[1].split(' ')[0]}:
                        </Typography>
                        <Typography key={`prefLine-superSize.${prefIndex}b`} className={classes.superSizePreferenceLine2}>
                          {prefLine.split('~')[1].replace(' ', '%%').split('%%')[1]}
                        </Typography>
                      </Box>
                      :
                      <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center' >
                        <Typography key={`prefLine-superSize.${prefIndex}c`} className={classes.superSizePreferenceLine3}>
                          {prefLine.split('~')[1].replace(' ', '%%').split('%%')[1]}
                        </Typography>
                      </Box>
                    }
                  </a>
                )))}
              <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center' >
                <Button
                  className={classes.rowButtonBack}
                  onClick={() => {
                    setshowSuperSize(false);
                    setForceRedisplay(!forceRedisplay);
                  }}
                >
                  {'Back'}
                </Button>
                <Button
                  onClick={() => {
                    setPromptForMessage(true);
                    setMessageType('');
                    let rKey = `${superSizeData.name.first} ${superSizeData.name.last}:${superSizeData.person_id}`;
                    setRecipient(rKey.trim());
                  }}
                  className={classes.rowButtonSend}
                >
                  {`Send Msg`}
                </Button>
              </Box>
            </Box>
          </List>
        }
      </Dialog >
      <Dialog open={!!loading} fullWidth p={20} className={classes.containerBox}>
        <Box
          display='flex' flexDirection='column' justifyContent='center' alignItems='center'
          flexWrap='wrap' textOverflow='ellipsis' width='100%'
          key={'loadingBox'}
          mt={10} mb={10}
        >
          <Typography variant='h5' className={classes.lastName} >{`Updating Menus`}</Typography>
          <Typography className={classes.lastName}>{loading}</Typography>
          <LinearProgress variant="determinate" className={classes.progressBar} style={{ width: pWidth }} value={progress} />
          <CircularProgress />
        </Box>
      </Dialog>
    </React.Fragment>
  );
};;