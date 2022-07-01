import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';

import Collapse from '@material-ui/core/Collapse';
import MoreHorizIcon from '@material-ui/icons/MoreHoriz';
import CloseIcon from '@material-ui/icons/HighlightOff';

import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import Tooltip from '@material-ui/core/Tooltip';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';

import Slide from '@material-ui/core/Slide';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import PrintIcon from '@material-ui/icons/Print';
import StorageOutlined from '@material-ui/icons/StorageOutlined';
import SendIcon from '@material-ui/icons/Send';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import PersonAddDisabledIcon from '@material-ui/icons/PersonAddDisabled';
import UpdateIcon from '@material-ui/icons/Update';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';

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
    marginBottom: theme.spacing(1),
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
    // color: theme.palette.reject[theme.palette.type],
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
    marginBottom: theme.spacing(1)
  },
  preferenceLine: {
    fontSize: theme.typography.fontSize * 0.8,
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  confirm: {
    backgroundColor: 'green',
  },
  standardIndent: {
    marginLeft: theme.spacing(1),
  },
  lastName: {
    fontWeight: 'bold',
  }
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ pEventCode, peopleList, pPatient, pClient, pOccData, pPatientRec, onReset }) => {

  const classes = useStyles();
  const isMobile = useMediaQuery(theme => theme.breakpoints.down('sm')); // checks if current device is a smart phone

  const [occurrenceInfo, setOccurrenceInfo] = React.useState('');
  const [eventSlotList, setEventSlotList] = React.useState([]);

  const [selectNewSlotOwner, setSelectNewSlotOwner] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [addNewSlot, setAddNewSlot] = React.useState(false);

  const [editIndex, setEditIndex] = React.useState();

  const [deletePending, setDeletePending] = React.useState(false);
  const [removeSlotPending, setRemoveSlotPending] = React.useState(false);
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const [confirmIndex, setConfirmIndex] = React.useState('');
  const [promptForMessage, setPromptForMessage] = React.useState('');
  const [recipient, setRecipient] = React.useState();
  const [messageType, setMessageType] = React.useState();
  const [open, setOpen] = React.useState([]);

  const { enqueueSnackbar } = useSnackbar();

  const isOwner = pOccData?.owner?.includes(pPatient);

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  const handleReleaseSlot = async (pIndexOfSlot) => {
    let invokeFailed = false;

    let updateSlot = eventSlotList[pIndexOfSlot];
    let eventParts = updateSlot.event_key.split('#');

    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance';
    params.Payload = JSON.stringify({
      action: "update_slot",
      clientId: pClient,
      request: {
        event_key: eventParts[0] + '#' + eventParts[1],
        new_list_key: 'available#' + eventParts[1],
        slot_id: updateSlot.slotData.id,
        owner: 'available',
        requestor: '',
        display_name: ''
      }
    });
    let lambdaResponse = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let returnedSlot = JSON.parse(lambdaResponse.Payload);
      if (returnedSlot.status === 200) {
        let workingList = eventSlotList;
        workingList[pIndexOfSlot].slotData.owner = 'available';
        workingList[pIndexOfSlot].slotData.name = '';
        setEventSlotList(workingList);
        setForceRedisplay(!forceRedisplay);
        return workingList;
      }
    };
  };

  const handleRemoveSlot = async (pIndexOfSlot) => {
    let invokeFailed = false;
    let updateSlot = eventSlotList[pIndexOfSlot];

    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance';
    params.Payload = JSON.stringify({
      action: "allocate",
      clientId: pClient,
      sign_up: {
        event_key: pEventCode,
        slot_id: updateSlot.slotData.id.toString().padStart(4, '0'),
        owner: 'available',
        requestor: pPatient,
        display_name: '',
        new_list_key: 'release'
      }
    });
    await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let workingOpen = open;
      workingOpen[pIndexOfSlot] = false;
      let workingList = eventSlotList;
      workingList.splice(pIndexOfSlot, 1);
      setOpen(workingOpen);
      setEventSlotList(workingList);
      setForceRedisplay(!forceRedisplay);
      return workingList;
    };
  };

  const handlePrint = async (pEvent, pType) => {
    let invokeFailed = false;
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:printCalendar';
    params.Payload = JSON.stringify(
      {
        body:
        {
          client_id: pClient,
          event_id: pEvent,
          requestor: pPatient,
          request_type: pType
        }
      });
    let fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log("Problem printing the sign-up sheet.  Error is", JSON.stringify(err));
        enqueueSnackbar(`AVA couldn't print that sign-up sheet.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });

    if (!invokeFailed) {
      let fResponse = JSON.parse(fResp.Payload);
      if (fResponse.status === 200) {
        window.open(
          fResponse.body.Location,
          `Your requested ${pType}`,
          'noopener, noreferrer'
        );
      }
    };
    return;
  };

  const getEventSlots = async (pEvent) => {
    let invokeFailed = false;
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance';
    params.Payload = JSON.stringify({
      "action": "get_slots",
      "clientId": pClient,
      "request": { "event_id": pEvent }
    });
    let fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while requesting the entries.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    if (!invokeFailed) {
      let response = JSON.parse(fResp.Payload);
      if (response.status === 200) {
        let [occRec, slotList] = response.body;
        setOccurrenceInfo(occRec);
        setEventSlotList(slotList);
        return slotList;
      }
    };
    return [];
  };

  const handleSendMessage = async (pMessage, pRecipient = null) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:messageEngine';
    params.Payload = JSON.stringify({
      "body": {
        "client": pClient,
        "author": pPatient,
        "values": pRecipient + ' ~ MessageText = ' + pMessage
      }
    });
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while sending a Message.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    enqueueSnackbar(`Sent "${pMessage}" to everyone.`, {
      variant: 'success'
    });
  };

  const handleAddSlot = async (pSlotToAdd) => {
    let invokeFailed = false;
    let request = {};
    let eventParts = pEventCode.split('#');

    let slotIDNumber = makeTimeValue(pSlotToAdd);
    let slotIDString = slotIDNumber.toString();
    eventParts[2] = (slotIDString.length < 4 ? '0' : '') + slotIDString;
    request.minutesAfterMidnight = (Math.floor(slotIDNumber / 100) * 60) + (slotIDNumber % 100);

    request.calRec = {
      client: pClient,
      id: eventParts[0],
      event_key: eventParts[0] + '#' + eventParts[1],
      schedule_key: 'slot_data',
      list_key: 'available#' + eventParts[1]
    };

    request.slotData = {
      date: eventParts[1],
      id: eventParts[2],
      owner: 'available',
      name: null,
      reminder_minutes: 0
    };

    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance';
    params.Payload = JSON.stringify({
      action: "add_slot",
      clientId: pClient,
      request: request
    });
    let lambdaResponse = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let returnedSlot = JSON.parse(lambdaResponse.Payload);
      if (returnedSlot.status === 200) {
        await getEventSlots(pEventCode);
      }
    };
  };

  const handleChangeSlotOwner = async (pPerson, pIndexOfSlot) => {
    let invokeFailed = false;

    let updateSlot = eventSlotList[pIndexOfSlot];
    let [newPersonName, newPersonID] = pPerson.split(':');
    let eventParts = updateSlot.event_key.split('#');
    let slotIDString = updateSlot.slotData.id.toString();
    eventParts[2] = (slotIDString.length < 4 ? '0' : '') + slotIDString;

    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance';
    params.Payload = JSON.stringify({
      action: "update_slot",
      clientId: pClient,
      request: {
        event_key: eventParts[0] + '#' + eventParts[1],
        new_list_key: newPersonID + '#' + eventParts[1],
        slot_id: eventParts[2],
        owner: newPersonID,
        requestor: pPatient,
        display_name: newPersonName,
      }
    });
    let lambdaResponse = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let returnedSlot = JSON.parse(lambdaResponse.Payload);
      if (returnedSlot.status === 200) {
        let workingList = eventSlotList;
        workingList[pIndexOfSlot].slotData.owner = newPersonID;
        workingList[pIndexOfSlot].slotData.name = newPersonName;
        setEventSlotList(workingList);
        setForceRedisplay(!forceRedisplay);
        return workingList;
      }
    };
  };

  const handleAllocateSlot = async (pPerson, pRelease = false, pIndex = null) => {
    let invokeFailed = false;

    let [newPersonName, newPersonID] = pPerson.split(':');

    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance';
    params.Payload = JSON.stringify({
      action: "allocate",
      clientId: pClient,
      sign_up: {
        event_key: pEventCode,
        slot_id: newPersonID,
        owner: newPersonID,
        requestor: pPatient,
        display_name: newPersonName,
        new_list_key: (pRelease ? 'release' : newPersonID)
      }
    });
    let lambdaResponse = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let returnedSlot = JSON.parse(lambdaResponse.Payload);
      if (returnedSlot.status === 200) {
        let workingList = eventSlotList;
        if (!pRelease) {
          let slotObj = {
            slotData: {
              name: newPersonName,
              owner: newPersonID,
              id: newPersonID
            }
          };
          workingList.push(slotObj);
        }
        else {
          workingList.splice(pIndex, 1);
          let workingOpen = open;
          workingOpen[pIndex] = false;
          setOpen(workingOpen);
        }
        setEventSlotList(workingList);
        setForceRedisplay(!forceRedisplay);
        return workingList;
      }
    };
  };

  const toggleOpen = pIndex => {
    let workingOpen = open;
    workingOpen[pIndex] = !workingOpen[pIndex];
    setOpen(workingOpen);
    setForceRedisplay(!forceRedisplay);
  };

  function makeTimeValue(pTime) {
    let ampm = null;
    if (pTime.includes('p')) { ampm = 'pm'; }
    else if (pTime.includes('a')) { ampm = 'am'; };
    let [hh$, mm$] = pTime.split(':');
    let hh = Number(hh$.replace(/\D+/g, ''));
    let mm = 0;
    if (hh > 100) {
      if (!mm$) { mm = hh % 100; }
      hh = Math.floor(hh / 100);
    }
    if (mm$) { mm = Number(mm$.replace(/\D+/g, '')); }
    if (mm > 59) {
      let hAdd = Math.floor(mm / 60);
      mm -= (hAdd * 60);
      hh += hAdd;
    }
    if (hh >= 23) {
      hh = hh % 24;
    }
    if (hh >= 12) {
      hh -= 12;
      ampm = 'pm';
    }
    if (hh === 0) {
      hh = 12;
      ampm = 'pm';
    }
    if (!ampm) { ampm = ((hh > 6) && (hh < 12)) ? 'am' : 'pm'; }
    let returnTime = 0;   // numeric 24 hour clock version of time as hhmm
    if (ampm === 'pm') {
      returnTime = (hh < 12 ? ((hh + 12) * 100) : 1200) + mm;
    }
    else {
      returnTime = ((hh < 12 ? (hh * 100) : 0) + mm);
    }
    return returnTime;
  }

  function makeReadableName(pName) {
    let [pPrimary, pFirst] = pName.split(',');
    return (`${pFirst || ''} ${pPrimary}`).trim();
  }

  function makeReadableDate(pDateYMD) {
    let pDate = pDateYMD.toString();
    let yyyy = pDate.substr(0, 4);
    let mm = pDate.substr(4, 2);
    let dd = pDate.substr(6, 2);
    let dDate = new Date(yyyy, Number(mm) - 1, dd);
    return dDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function makeReadableTime(pTimeHM, withAMPM = false) {
    let pTime = Number(pTimeHM);
    let hh = Math.floor(pTime / 100);
    let mm = pTime % 100;
    let ampm = 'am';
    if (hh > 12) {
      hh -= 12;
      ampm = 'pm';
    }
    else if (hh === 12) {
      ampm = 'pm';
    }
    return `${hh}:${mm < 10 ? ('0' + mm) : mm}${withAMPM ? (' ' + ampm) : ''}`;
  }

  // ********************

  React.useEffect(() => {
    async function buildIt() {
      await getEventSlots(pEventCode);
    }
    buildIt();
  }, [pEventCode]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <Dialog
      open={true || forceRedisplay}
      p={2}
      fullWidth
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
    >

      <React.Fragment>
        <Box display='flex' className={classes.title} flexDirection='column'>
          <Typography variant='h5' >{pOccData.description}</Typography>
          <Typography className={classes.standardIndent} variant='body1'>
            {`${makeReadableDate(pOccData.date)} ${occurrenceInfo.time_from ? ('at ' + pOccData.time_from) : ''}`}
          </Typography>
        </Box>
        {eventSlotList && eventSlotList.length > 0 &&
          <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
            <List  >
              {eventSlotList.map((this_item, index) => (
                <Paper component={Box} elevation={0} key={this_item.slotData.owner + 'frag' + index} >
                  <ListItem
                    key={this_item.slotData.owner + 'r' + index}
                    className={classes.listItem}
                    cols={1}
                    onClick={() => {
                      if (this_item.slotData.owner && (this_item.slotData.owner !== 'available') && isOwner) {
                        toggleOpen(index);
                      }
                    }}
                  >
                    <Box display='flex' flexDirection='row' alignItems='center'>
                      {isNaN(Number(this_item.slotData.id)) ?
                        null :
                        (Number(this_item.slotData.id) >= 100 ?
                          <Box display='flex' width={60} flexDirection='row' justifyContent='center' alignItems='center'>
                            <Typography variant='body1' className={classes.standardIndent} >{makeReadableTime(this_item.slotData.id, false)}</Typography>
                          </Box>
                          :
                          <Box display='flex' width={10} flexDirection='row' justifyContent='center' alignItems='center'>
                            <Typography variant='body1' className={classes.standardIndent} >{this_item.slotData.id}</Typography>
                          </Box>
                        )
                      }
                      {this_item.slotData.owner && (this_item.slotData.owner !== 'available') &&
                        <Typography variant='h5' className={classes.standardIndent}>{makeReadableName(this_item.slotData.name)}</Typography>
                      }
                    </Box>
                    {
                      !open[index] ?
                        (
                          this_item.slotData.owner && (this_item.slotData.owner !== 'available') ?
                            (isOwner
                              ?
                              < MoreHorizIcon />
                              :
                              (this_item.slotData.owner === pPatient &&
                                <Tooltip title={`Remove myself from this slot`}>
                                  <PersonAddDisabledIcon
                                    onClick={() => {
                                      if (pOccData.signup_type === 'time') { handleReleaseSlot(index); }
                                      else {
                                        handleAllocateSlot(pPatientRec.patient_display_name + ':' + pPatient, true, index);
                                      }
                                      setDeletePending(false);
                                      let workingOpen = open;
                                      workingOpen[index] = false;
                                      setOpen(workingOpen);
                                    }}
                                  />
                                </Tooltip>
                              )
                            )
                            :
                            <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                              <Tooltip title={isOwner ? `Select someone for this slot` : `Add myself to this slot`}>
                                <PersonAddIcon
                                  onClick={() => {
                                    if (isOwner) {
                                      setEditIndex(index);
                                      setSelectNewSlotOwner(true);
                                    }
                                    else {
                                      if (pOccData.signup_type === 'time') { handleChangeSlotOwner(pPatientRec.patient_display_name + ':' + pPatient, index); }
                                      else { handleAllocateSlot(pPatientRec.patient_display_name + ':' + pPatient); }
                                    }
                                  }}
                                />
                              </Tooltip>
                              {Number(this_item.slotData.id) >= 100 && isOwner &&
                                <Tooltip title={`Remove the ${makeReadableTime(this_item.slotData.id, true)} time slot from this event`}>
                                  <DeleteIcon
                                    onClick={() => {
                                      let message = `Remove the ${makeReadableTime(this_item.slotData.id, true)} time slot from this event?`;
                                      setConfirmMessage(message);
                                      setConfirmIndex(index);
                                      setRemoveSlotPending(true);
                                      setForceRedisplay(false);
                                    }}
                                  />
                                </Tooltip>
                              }
                            </Box>
                        )
                        : null
                    }
                  </ListItem>
                  <Collapse in={open[index]} timeout="auto" unmountOnExit>
                    {!isMobile ?
                      <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                        <Tooltip title={this_item.slotData.owner && (this_item.slotData.owner !== 'available')
                          ? `Replace ${makeReadableName(this_item.slotData.name)} with someone else`
                          : `Add someone in this time slot`}
                        >
                          <Button
                            onClick={() => {
                              setEditIndex(index);
                              setSelectNewSlotOwner(true);
                            }}
                            className={classes.rowButtonDefault}
                            startIcon={
                              this_item.slotData.owner && (this_item.slotData.owner !== 'available')
                                ? <EditIcon fontSize="small" />
                                : <PersonAddIcon fontSize="small" />
                            }
                          >
                            {this_item.slotData.owner && (this_item.slotData.owner !== 'available') ? 'Change' : 'Add Person'}
                          </Button>
                        </Tooltip>
                        {this_item.slotData.owner && (this_item.slotData.owner !== 'available') &&
                          <React-Fragment>
                            <Tooltip title={`Remove ${makeReadableName(this_item.slotData.name)} from this event`} >
                              <Button
                                onClick={() => {
                                  let message;
                                  let mName = makeReadableName(this_item.slotData.name);
                                  message = `Remove ${mName} from this event?`;
                                  setConfirmMessage(message);
                                  setConfirmIndex(index);
                                  setDeletePending(true);
                                  setForceRedisplay(false);
                                }}
                                className={classes.rowButtonRed}
                                startIcon={<DeleteIcon fontSize="small" />}
                              >
                                Remove
                              </Button>
                            </Tooltip>
                            <Tooltip title={`Send a message to ${makeReadableName(this_item.slotData.name)}`} >
                              <Button
                                onClick={() => {
                                  setPromptForMessage(true);
                                  setMessageType('');
                                  setRecipient(`${makeReadableName(this_item.slotData.name)}:` + this_item.slotData.owner);
                                }}
                                className={classes.rowButtonGreen}
                                startIcon={<SendIcon fontSize="small" />}
                              >
                                Message
                              </Button>
                            </Tooltip>
                          </React-Fragment>
                        }
                        <Button
                          onClick={() => {
                            toggleOpen(index);
                          }}
                          className={classes.rowButtonBlue}
                          startIcon={<CloseIcon fontSize="small" />}
                        >
                          Hide this Menu
                        </Button>
                      </Box>
                      :
                      <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                        <Tooltip title={this_item.slotData.owner && (this_item.slotData.owner !== 'available')
                          ? `Replace ${makeReadableName(this_item.slotData.name)} with someone else`
                          : `Add someone in this time slot`}
                        >
                          <IconButton
                            onClick={() => {
                              setEditIndex(index);
                              setSelectNewSlotOwner(true);
                            }}
                            className={classes.rowButtonDefault}
                          >
                            {
                              this_item.slotData.owner && (this_item.slotData.owner !== 'available')
                                ? <EditIcon fontSize="small" />
                                : <PersonAddIcon fontSize="small" />
                            }
                          </IconButton>
                        </Tooltip>
                        {this_item.slotData.owner && (this_item.slotData.owner !== 'available') &&
                          <React-Fragment>
                            <Tooltip title={`Remove ${makeReadableName(this_item.slotData.name)} from this event`} >
                              <IconButton
                                onClick={() => {
                                  let message;
                                  let mName = makeReadableName(this_item.slotData.name);
                                  message = `Remove ${mName} from this event?`;
                                  setConfirmMessage(message);
                                  setConfirmIndex(index);
                                  setDeletePending(true);
                                  setForceRedisplay(false);
                                }}
                                className={classes.rowButtonRed}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={`Send a message to ${makeReadableName(this_item.slotData.name)}`} >
                              <IconButton
                                onClick={() => {
                                  setPromptForMessage(true);
                                  setMessageType(this_item.preferred_method);
                                  setRecipient(`${this_item.first} ${this_item.last || this_item.display_name}:` + this_item.slotData.owner);
                                }}
                                className={classes.rowButtonGreen}
                              >
                                <SendIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </React-Fragment>
                        }
                        <IconButton
                          onClick={() => {
                            toggleOpen(index);
                          }}
                          className={classes.rowButtonBlue}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    }
                  </Collapse>
                </Paper>
              ))}

            </List>
          </Paper>
        }
        {selectNewSlotOwner &&
          <PersonFilter
            peopleList={peopleList}
            onCancel={() => {
              setSelectNewSlotOwner(false);
            }}
            onSelect={(selectedPerson) => {
              setSelectNewSlotOwner(false);
              if (pOccData.signup_type === 'time') { handleChangeSlotOwner(selectedPerson, editIndex); }
              else { handleAllocateSlot(selectedPerson); }

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
        {addNewSlot &&
          <AVATextInput
            promptText={`What time slot do you want to add?`}
            buttonText='Add'
            onCancel={() => { setAddNewSlot(false); }}
            onSave={(slotToAdd) => {
              handleAddSlot(slotToAdd);
              setAddNewSlot(false);
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
              if (pOccData.signup_type === 'time') { handleReleaseSlot(confirmIndex); }
              else {
                let pPerson =
                  eventSlotList[confirmIndex].slotData.name +
                  ':' +
                  eventSlotList[confirmIndex].slotData.id;
                handleAllocateSlot(pPerson, true, confirmIndex);
              }
              setDeletePending(false);
              let workingOpen = open;
              workingOpen[confirmIndex] = false;
              setOpen(workingOpen);
            }}
          />
        }
        {removeSlotPending &&
          <AVAConfirm
            promptText={confirmMessage}
            onCancel={() => {
              setRemoveSlotPending(false);
            }}
            onConfirm={() => {
              handleRemoveSlot(confirmIndex);
              setRemoveSlotPending(false);
              let workingOpen = open;
              workingOpen[confirmIndex] = false;
              setOpen(workingOpen);
            }}
          />
        }
        {isMobile ?
          <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
            <Tooltip title={`Exit`} >
              <IconButton
                className={classes.rowButtonRed}
                onClick={onReset}
              >
                <CloseIcon size="small" />
              </IconButton>
            </Tooltip>
            {pOccData.signup_type === 'time' && isOwner &&
              <Tooltip title={`Add another time slot`} >
                <IconButton
                  className={classes.rowButtonGreen}
                  onClick={() => {
                    setAddNewSlot(true);
                  }}
                >
                  <UpdateIcon size="small" />
                </IconButton>
              </Tooltip>
            }
            {pOccData.signup_type !== 'time' &&
              <Tooltip title={
                isOwner ?
                  'Add a person'
                  :
                  'Add myself to the list'
              }
              >
                <IconButton
                  className={classes.rowButtonGreen}
                  onClick={() => {
                    if (isOwner) { setSelectNewSlotOwner(true); }
                    else { handleAllocateSlot(pPatientRec.patient_display_name + ':' + pPatient); }
                  }
                  }
                >
                  <PersonAddIcon size="small" />
                </IconButton>
              </Tooltip>
            }
            {isOwner &&
              <React.Fragment>
                <Tooltip title={`Prepare a sign-up sheet`} >
                  <IconButton
                    className={classes.rowButtonDefault}
                    onClick={async () => {
                      await handlePrint(pEventCode, 'sign-up');
                    }}
                  >
                    <StorageOutlined size='small' />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Prepare a report of all that have signed-up`} >
                  <IconButton
                    onClick={async () => {
                      await handlePrint(pEventCode, 'report');
                    }}
                    className={classes.rowButtonGreen}
                  >
                    <PrintIcon size='small' />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Send a message to everone that is signed-up`} >
                  <IconButton
                    onClick={() => {
                      setPromptForMessage(true);
                      setMessageType('Group');
                      setRecipient(`People signed-up for ${occurrenceInfo.description} on ${makeReadableDate(occurrenceInfo.date)}`
                        + ':' +
                        + (eventSlotList.map(e => { return e.slotData.id; })).join(' ~ '));
                    }}
                    className={classes.rowButtonGreen}
                  >
                    <SendIcon size='small' />
                  </IconButton>
                </Tooltip>
              </React.Fragment>
            }
          </DialogActions>
          :
          <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
            <Box display='flex' flexDirection='column'>
              <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                <Button
                  className={classes.rowButtonRed}
                  onClick={onReset}
                  startIcon={<ArrowBackIcon size="small" />}
                >
                  {'Back'}
                </Button>
                {pOccData.signup_type === 'time' && isOwner &&
                  <Button
                    className={classes.rowButtonGreen}
                    onClick={() => {
                      setAddNewSlot(true);
                    }}
                    startIcon={
                      <UpdateIcon size="small" />
                    }
                  >
                    {'Add time slot'}
                  </Button>
                }
                {pOccData.signup_type !== 'time' &&
                  <Button
                    className={classes.rowButtonGreen}
                    onClick={() => {
                      if (isOwner) { setSelectNewSlotOwner(true); }
                      else { handleAllocateSlot(pPatientRec.patient_display_name + ':' + pPatient); }
                    }}
                    startIcon={<PersonAddIcon size="small" />}
                  >
                    {isOwner ?
                      'Add a person'
                      :
                      'Add myself to the list'
                    }
                  </Button>
                }
                {isOwner &&
                  <Button
                    className={classes.rowButtonDefault}
                    onClick={async () => {
                      await handlePrint(pEventCode, 'report');
                    }}
                    startIcon={<PrintIcon size='small' />}
                  >
                    {'Detail report'}
                  </Button>
                }
              </Box>
              {isOwner &&
                <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                  <Button
                    onClick={async () => {
                      await handlePrint(pEventCode, 'sign-up');
                    }}
                    className={classes.rowButtonGreen}
                    startIcon={<StorageOutlined size='small' />}
                  >
                    {'Sign-up sheet'}
                  </Button>
                  <Button
                    onClick={() => {
                      setPromptForMessage(true);
                      setMessageType('Group');
                      setRecipient(`People signed-up for ${occurrenceInfo.description} on ${makeReadableDate(occurrenceInfo.date)}`
                        + ':' +
                        + (eventSlotList.map(e => { return e.slotData.id; })).join(' ~ '));
                    }}
                    className={classes.rowButtonGreen}
                    startIcon={<SendIcon size='small' />}
                  >
                    {'Message to all registrants'}
                  </Button>
                </Box>
              }
            </Box>
          </DialogActions>

        }
      </React.Fragment>
    </Dialog >
  );
};