import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';
import { makeDate } from '../../util/AVADateTime';
import { getSlotList, writeSlot } from '../../util/AVACalendars';
import { getMemberList } from '../../util/AVAGroups';
import { cl } from '../../util/AVAUtilities';

import useMediaQuery from '@material-ui/core/useMediaQuery';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';

import CheckIcon from '@material-ui/icons/Check';

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

import PrintIcon from '@material-ui/icons/Print';
import StorageOutlined from '@material-ui/icons/StorageOutlined';
import SendIcon from '@material-ui/icons/Send';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import PersonAddDisabledIcon from '@material-ui/icons/PersonAddDisabled';

import PersonFilter from '../forms/PersonFilter';
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

export default ({ pEventCode, peopleList, pPatient, pClient, pOccData, pPatientRec, onReset, pName = null, pInfo = null }) => {

  const classes = useStyles();
  const isMobile = useMediaQuery(theme => theme.breakpoints.down('sm')); // checks if current device is a smart phone

  const [occurrenceInfo, setOccurrenceInfo] = React.useState('');
  const [eventSlotList, setEventSlotList] = React.useState([]);

  const [selectNewSlotOwner, setSelectNewSlotOwner] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [editIndex, setEditIndex] = React.useState();

  const [promptForMessage, setPromptForMessage] = React.useState('');
  const [recipient, setRecipient] = React.useState();
  const [messageType, setMessageType] = React.useState();
  const [choiceList, setChoiceList] = React.useState([]);

  const { enqueueSnackbar } = useSnackbar();

  const isEventOwner = pOccData?.owner?.includes(pPatient);

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

  function slotIsOccupied(slotData) {
    return (slotData.owner && (slotData.owner !== 'available'));
  }

  function isSlotOwner(slotData) {
    return (slotData.owner === pPatient);
  }

  const setChoices = async (inList) => {
    if (choiceList.length > 0) { return; }
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
  };
  /*
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
  */
  /*
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
      let workingList = eventSlotList;
      workingList.splice(pIndexOfSlot, 1);
      setEventSlotList(workingList);
      setForceRedisplay(!forceRedisplay);
      return workingList;
    };
  };
*/
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
    let slotInfo = await getSlotList({ "client": pClient, "event": pEvent });
    setOccurrenceInfo(slotInfo.occRec);
    let slotList = Object.keys(slotInfo.slotObj).map(o => {
      let first = "";
      let last = "";
      if (slotInfo.slotObj[o].status === 'released') {
        slotInfo.slotObj[o].display_name = '';
        slotInfo.slotObj[o].owner = ''
      }
      if (slotInfo.slotObj[o].display_name) {
          [first, last] = slotInfo.slotObj[o].display_name.split(/\s(.*)/);
      }
      return {
        event_key: slotInfo.occRec.event_key,
        first,
        last,
        display_name: slotInfo.slotObj[o].display_name,
        slotData: {
          show_this_slot: slotInfo.slotObj[o].show_this_slot,
          name: slotInfo.slotObj[o].display_name,
          id: o,
          owner: slotInfo.slotObj[o].owner
        }
      };
    });
    slotList.sort((a, b) => {
      if (a.slotData.id > b.slotData.id) { return 1; }
      else { return -1; }
    });
    setEventSlotList(slotList);
    return slotList;
  };
  /*    
    const oldGetEventSlots = async (pEvent) => {  
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
  */
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
/*
  const handleAddSlot = async (pSlotToAdd) => {
    let invokeFailed = false;
    let request = {};
    let eventParts = pEventCode.split('#');

    let slotIDNumber = makeTime(pSlotToAdd).hhmm;
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
  */
  /*
    const handleChangeSlotOwner = async (pPerson, pIndexOfSlot) => {
      let invokeFailed = false;
  
      let updateSlot = eventSlotList[pIndexOfSlot];
      let [newPersonName, newPersonID] = pPerson.split(':');
      let eventParts = updateSlot.event_key.split('#');
      let slotIDString = updateSlot.slotData.id.toString();
      eventParts[2] = (slotIDString.length < 4 ? '0' : '') + slotIDString;
  
      if (!newPersonID) {
        sendAVASupportAlert(`${pPatient} atempted null update to Calendar event ${eventParts[0] + '#' + eventParts[1]} at slot ${eventParts[2]}`);
      }
  
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
          display_name: (pName || newPersonName) + (pInfo ? ` (${pInfo})` : ''),
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
          workingList[pIndexOfSlot].slotData.name = (pName || newPersonName) + (pInfo ? ` (${pInfo})` : '');
          setEventSlotList(workingList);
          setForceRedisplay(!forceRedisplay);
          return workingList;
        }
      };
    };
  */
  /*
  const sendAVASupportAlert = async (pMessage) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:messageEngine';
    let lambdaPayload = {
      "body": {
        "client": 'SMSoft',
        "author": 'rsteele',
        "subject": 'AVA alert - Invalid Calendar update',
        "values": `AVA Support:ava_support ~ MessageText = ${pMessage}`
      }
    };
    params.Payload = JSON.stringify(lambdaPayload);
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while sending a Message.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
  };
*/
  const handleAllocateSlot = async (body) => {
    let pPerson, pSlot, pRelease, pIndex;
    pPerson = body.person;
    if (body.slot) { pSlot = body.slot; }
    else {
      let a1 = pPerson.split(':');
      pSlot = a1[Math.min(1, a1.length - 1)];
    }
    if (body.release) { pRelease = body.release; }
    else { pRelease = false; }
    if (body.index) { pIndex = body.index; }
    let [newPersonName, newPersonID] = pPerson.split(':');
    let [first, last] = newPersonName.split(/\s(.*)/);
    let slotInfo = await writeSlot({
      "client": pClient,
      "event": pEventCode,
      // "occurrence_date": <string or number>
      "owner": newPersonID,
      "override_name": newPersonName,
      "slot": pSlot || newPersonID,
      "status": (pRelease ? 'released' : 'selected'),
      "show_this_slot": ((pOccData.signup_type === 'time') ? true : !pRelease)
    });
    let workingList = eventSlotList;
    if (pRelease) {
      if (pSlot !== newPersonID) {
        workingList[pIndex] = {
          event_key: slotInfo.event_key,
          first,
          last,
          display_name: '',
          slotData: {
            name: '',
            id: pSlot,
            owner: ''
          }
        };
      }
      else {
        workingList.splice(pIndex, 1);
      }
    }
    else {
      if (!pIndex) {
        workingList.unshift({
          event_key: slotInfo.event_key,
          first,
          last,
          display_name: newPersonName,
          slotData: {
            name: newPersonName,
            id: newPersonID,
            owner: newPersonID
          }
        });
      }
      else { 
        workingList[pIndex] = {
          event_key: slotInfo.event_key,
          first,
          last,
          display_name: newPersonName,
          slotData: {
            name: newPersonName,
            id: pSlot,
            owner: newPersonID
          }
        };
      }
      
    }
    setEventSlotList(workingList);
    setForceRedisplay(!forceRedisplay);
    return workingList;

    /*
    // let invokeFailed = false;
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
    */
  };

  function makeReadableName(pName) {
    let [pPrimary, pFirst] = pName.split(',');
    return (`${pFirst || ''} ${pPrimary}`).trim();
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
            {`${makeDate(pOccData.date).relative}`}
          </Typography>
          {pOccData.location &&
            <Typography className={classes.standardIndent} variant='body1'>
              {pOccData.location}
            </Typography>
          }
        </Box>
        {eventSlotList && eventSlotList.length > 0 &&
          <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
            <List  >
              {eventSlotList.map((this_item, index) => (
                (!this_item.slotData.hasOwnProperty('show_this_slot') || this_item.slotData.show_this_slot) &&
                <Paper component={Box} elevation={0} key={this_item.slotData.owner + 'frag' + index} >
                  <ListItem
                    key={this_item.slotData.owner + 'r' + index}
                    className={classes.listItem}
                    cols={1}
                  >
                    <Box display='flex' flexDirection='row' alignItems='center'>
                      {isNaN(Number(this_item.slotData.id)) ?
                        null :
                        (Number(this_item.slotData.id) >= 100 ?    // Numbers that are times are in the range 100 through 1200; otherwise assume seat number 1, 2, 3, etc...
                          <Box display='flex' width={60} flexDirection='row' justifyContent='center' alignItems='center'>
                            <Typography variant='body1' className={classes.standardIndent} >{makeReadableTime(this_item.slotData.id, false)}</Typography>
                          </Box>
                          :
                          <Box display='flex' width={10} flexDirection='row' justifyContent='center' alignItems='center'>
                            <Typography variant='body1' className={classes.standardIndent} >{this_item.slotData.id}</Typography>
                          </Box>
                        )
                      }
                      {slotIsOccupied(this_item.slotData) &&
                        <Typography variant='h5' className={classes.standardIndent}>{makeReadableName(this_item.slotData.name)}</Typography>
                      }
                    </Box>
                    {slotIsOccupied(this_item.slotData) && (isEventOwner || isSlotOwner(this_item.slotData)) &&
                        <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                        <Tooltip title={`Remove ${isEventOwner ? makeReadableName(this_item.slotData.name) : 'me'}`}>
                          <PersonAddDisabledIcon
                            onClick={() => {
                              // if (pOccData.signup_type === 'time') { handleReleaseSlot(index); }
                              // else {
                              handleAllocateSlot({
                                person: `${this_item.slotData.name}:${this_item.slotData.owner}`,
                                slot: this_item.slotData.id,
                                release: true,
                                index
                              });
                              // }
                            }}
                          />
                          </Tooltip>
                          {isEventOwner &&
                            <Tooltip title={`Send a message to ${makeReadableName(this_item.slotData.name)}`} >
                              <SendIcon
                                onClick={() => {
                                  setPromptForMessage(true);
                                  setMessageType('');
                                  setRecipient(`${makeReadableName(this_item.slotData.name)}:` + this_item.slotData.owner);
                                }}                             
                              />
                            </Tooltip>
                          }
                      </Box>
                    }
                    {!slotIsOccupied(this_item.slotData) &&
                      <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                        <Tooltip title={isEventOwner ? `Select someone` : `Add myself`}>
                          <PersonAddIcon
                            onClick={async () => {
                              if (isEventOwner) {
                                setEditIndex(index);
                                await setChoices(peopleList);
                                setSelectNewSlotOwner(true);
                              }
                              else {
                                // if (pOccData.signup_type === 'time') { handleChangeSlotOwner(pPatientRec.patient_display_name + ':' + pPatient, index); }
                                // else { 
                                handleAllocateSlot({
                                  person: `${pPatientRec.patient_display_name}:${pPatient}`,
                                  slot: this_item.slotData.id,
                                  index
                                });
                                // }
                              }
                            }}
                          />
                        </Tooltip>
                      </Box>
                    }
                  </ListItem>
                </Paper>
              ))}

            </List>
          </Paper>
        }
        {selectNewSlotOwner &&
          <PersonFilter
            prompt={'Who are you signing-up?'}
            peopleList={choiceList}
            onCancel={() => {
              setSelectNewSlotOwner(false);
            }}
            onSelect={(selectedPerson) => {
              setSelectNewSlotOwner(false);
              // if (pOccData.signup_type === 'time') { handleChangeSlotOwner(selectedPerson, editIndex); }
              // else {
              let pSplit = selectedPerson.split(':');
              let slotObj = { person: `${pSplit[0]}:${pSplit[Math.min(1, pSplit.length - 1)]}` };
              if (editIndex) {
                slotObj.slot = eventSlotList[editIndex].slotData.id;
                slotObj.index = editIndex;
              }
              handleAllocateSlot(slotObj);
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
        {isMobile ?
          <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
            {isEventOwner ?
              <Tooltip title={`Exit`} >
                <IconButton
                  className={classes.rowButtonRed}
                  onClick={onReset}
                >
                  <CheckIcon size="small" />
                </IconButton>
              </Tooltip>
              :
              <Button
                className={classes.rowButtonRed}
                onClick={onReset}
                startIcon={<CheckIcon size="small" />}
              >
                {'Done'}
              </Button>
            }
            {pOccData.signup_type !== 'time' &&
              <Tooltip title={
                isEventOwner ?
                  'Add a person'
                  :
                  'Add myself to the list'
              }
              >
                <IconButton
                  onClick={async () => {
                    if (isEventOwner) {
                      await setChoices(peopleList);
                      setSelectNewSlotOwner(true);
                    }
                    else {
                      handleAllocateSlot({
                        person: `${pPatientRec.patient_display_name}:${pPatient}`
                      });
                    }
                  }}
                >
                  <PersonAddIcon size="small" />
                </IconButton>
              </Tooltip>
            }
            {isEventOwner &&
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
                  >
                    <PrintIcon size='small' />
                  </IconButton>
                </Tooltip>
                <Tooltip title={`Send a message to everone that is signed-up`} >
                  <IconButton
                    onClick={() => {
                      setPromptForMessage(true);
                      setMessageType('Group');
                      setRecipient(`People signed-up for ${occurrenceInfo.description} ${makeDate(occurrenceInfo.date).relative}`
                        + ':' +
                        + (eventSlotList.map(e => { return e.slotData.id; })).join(' ~ '));
                    }}
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
                  startIcon={<CheckIcon size="small" />}
                >
                  {'Done'}
                </Button>
                {pOccData.signup_type !== 'time' &&
                  <Button
                    onClick={async () => {
                      if (isEventOwner) {
                        await setChoices(peopleList);
                        setSelectNewSlotOwner(true);
                      }
                      else {
                        handleAllocateSlot({ person: `${pPatientRec.patient_display_name}:${pPatient}` })
                      }
                    }}
                    startIcon={<PersonAddIcon size="small" />}
                  >
                    {isEventOwner ?
                      'Add a person'
                      :
                      'Add myself to the list'
                    }
                  </Button>
                }
                {isEventOwner &&
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
              {isEventOwner &&
                <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                  <Button
                    onClick={async () => {
                      await handlePrint(pEventCode, 'sign-up');
                    }}
                    startIcon={<StorageOutlined size='small' />}
                  >
                    {'Sign-up sheet'}
                  </Button>
                  <Button
                    onClick={() => {
                      setPromptForMessage(true);
                      setMessageType('Group');
                      setRecipient(`People signed-up for ${occurrenceInfo.description} ${makeDate(occurrenceInfo.date).relative}`
                        + ':' +
                        + (eventSlotList.map(e => { return e.slotData.id; })).join(' ~ '));
                    }}
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