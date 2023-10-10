import React from 'react';
import { useSnackbar } from 'notistack';
import { makeDate, makeTime } from '../../util/AVADateTime';
import { getSlotList, writeSlot, makeSlotName, printOccurrenceSheet } from '../../util/AVACalendars';
import { getMemberList } from '../../util/AVAGroups';
import { cl, makeArray, dbClient } from '../../util/AVAUtilities';
import { makeName, getImage } from '../../util/AVAPeople';
import { sendMessages } from '../../util/AVAMessages';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import Button from '@material-ui/core/Button';
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
import CloseIcon from '@material-ui/icons/HighlightOff';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import SaveIcon from '@material-ui/icons/Save';
import IconButton from '@material-ui/core/IconButton';
import RadioButtonCheckedIcon from '@material-ui/icons/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';

import PersonFilter from '../forms/PersonFilter';
import AVATextInput from '../forms/AVATextInput';
import AVAConfirm from '../forms/AVAConfirm';
import useSession from '../../hooks/useSession';

import TextField from '@material-ui/core/TextField';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  page: {
    height: 950,
    maxWidth: 1000
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
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
  AVAButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    border: '0.75px solid gray',
    textTransform: 'none',
    textDecoration: 'none',
    textWrap: 'nowrap',
    fontWeight: 'bold',
    size: 'small',
  },
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  idText: {
    display: 'inline',
    marginTop: -5,
    marginRight: theme.spacing(1),
  },
  idTextNoSpacing: {
    display: 'inline',
  },
  inputRule: {
    display: 'inline',
    fontSize: theme.typography.fontSize * 1,
    padding: 0,
    margin: 0,
  },
  listItem: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  listItemLeft: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginLeft: 0,
    paddingLeft: theme.spacing(0.5),
  },
  listItemNarrow: {
    justifyContent: 'space-between',
    marginTop: '-15px',
    marginBottom: '-15px'
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
    variant: 'body1',
    marginRight: theme.spacing(1),
    paddingRight: theme.spacing(2),
    width: '100%'
  },
  standard: {
    variant: 'body1',
    marginRight: theme.spacing(1),
    paddingRight: theme.spacing(1),
    width: '100%'
  },
  lastName: {
    fontWeight: 'bold',
  }
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ pEventCode, peopleList, pPatient, pClient, pOccData, pPatientRec, onReset, pMode }) => {

  const { state } = useSession();

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const [eventSlotList, setEventSlotList] = React.useState([]);

  const [selectNewSlotOwner, setSelectNewSlotOwner] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [editIndex, setEditIndex] = React.useState();
  const [editSlot, setEditSlot] = React.useState();

  const [promptForMessage, setPromptForMessage] = React.useState('');
  const [recipient, setRecipient] = React.useState();
  const [messageType, setMessageType] = React.useState();
  const [choiceList, setChoiceList] = React.useState([]);

  const [editNoteNumber, setEditNoteNumber] = React.useState(-1);
  const [newNote, setNewNote] = React.useState('');

  const { enqueueSnackbar } = useSnackbar();

  const isEventOwner = pOccData?.owner?.includes(pPatient)
    || ['master', 'support'].includes(state.profile.account_class);
  const [loading, setLoading] = React.useState(true);

  const [ownerOfSlots, setOwnerOfSlots] = React.useState(false);
  const [firstAvailableSlot, setFirstAvailableSlot] = React.useState();

  const [reactData, setReactData] = React.useState({
    editEventInfo: false,
    editInfoErrorList: [],
    editOwnerInfo: false,
    cancelPending: false,
    numberOfOwnedSlots: 0
  });

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  var rowsWritten = 0;

  function isOwned(slotData) {
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

  const handlePrint = async (pEvent, pType) => {
    await printOccurrenceSheet({
      client_id: pClient,
      event_id: pEvent,
      requestor: pPatient,
      request_type: pType
    });
    return;
  };

  const getEventSlots = async (pEvent) => {
    let checkOwnership = false;
    reactData.numberOfOwnedSlots = 0;
    let firstAvailableChoice;
    if (!['time', 'seats'].includes(pOccData.signup_type)) { firstAvailableChoice = pPatient; }
    let slotInfo = await getSlotList({ "client": pClient, "event": pEvent });
    let slotList = Object.keys(slotInfo.slotObj).sort().map(o => {
      let first = "";
      let last = "";
      if (!slotInfo.slotObj[o].status || ['released', 'available'].includes(slotInfo.slotObj[o].status)) {
        slotInfo.slotObj[o].display_name = '';
        slotInfo.slotObj[o].owner = '';
        if (!firstAvailableChoice) { firstAvailableChoice = o; }
      }
      if (slotInfo.slotObj[o].display_name) {
        [first, last] = slotInfo.slotObj[o].display_name.split(/\s(.*)/);
      }
      let slotData = Object.assign(slotInfo.slotObj[o], {
        name: slotInfo.slotObj[o].display_name,
        id: o
      });
      if (!checkOwnership) { checkOwnership = isSlotOwner(slotData); }
      if (isOwned(slotData)) { reactData.numberOfOwnedSlots++; }
      return {
        event_key: slotInfo.occRec.event_key,
        first,
        last,
        display_name: slotInfo.slotObj[o].display_name,
        slotData,
        marked: slotInfo.slotObj[o].marked || false
      };
    });
    slotList.sort((a, b) => {
      if (a.slotData.id > b.slotData.id) { return 1; }
      else { return -1; }
    });
    setOwnerOfSlots(checkOwnership);
    setFirstAvailableSlot(firstAvailableChoice);
    setEventSlotList(slotList);
    setReactData(reactData);
    return slotList;
  };

  const handleSendMessage = async (pMessage, pRecipient = null) => {
    await sendMessages({
      client: pClient,
      author: pPatient,
      messageText: pMessage,
      recipientList: pRecipient,
      subject: pOccData.description
    });
    let sentTo;
    if (typeof pRecipient === 'string') { sentTo = await makeName(pRecipient); }
    else if (pRecipient.length === 1) { sentTo = await makeName(pRecipient[0]); }
    else {
      let random = Math.floor(Math.random() * pRecipient.length);
      let randomName = await makeName(pRecipient[random]);
      sentTo = `${pRecipient.length} people, including ${randomName}`;
    };
    enqueueSnackbar(`Your message was sent to ${sentTo}`, { variant: 'success' });
  };

  const handleAllocateSlot = async (body) => {
    let pPerson, pSlot, pRelease, pIndex;

    if (body.release) { pRelease = body.release; }
    else { pRelease = false; }
    if (body.hasOwnProperty('index')) { pIndex = body.index; }
    let workingList = eventSlotList;

    pPerson = makeArray(body.person);
    for (let p = 0; p < pPerson.length; p++) {
      let nArray = pPerson[p].split(':');
      if (body.slot) { pSlot = body.slot; }
      else { pSlot = nArray[Math.min(1, nArray.length - 1)]; }
      let newPersonName, newPersonID;
      if (nArray.length === 1) {
        newPersonID = nArray[0];
        newPersonName = await makeName(newPersonID);
      }
      else {
        newPersonID = nArray[1];
        newPersonName = nArray[0];
      }
      let [first, last] = newPersonName.split(/\s(.*)/);
      let writeRequest = {
        "client": pClient,
        "event": pEventCode,
        // "occurrence_date": <string or number>
        "owner": newPersonID,
        "override_name": newPersonName,
        "slot": pSlot || newPersonID,
        "status": (pRelease ? 'released' : 'selected'),
        "show_this_slot": ((pRelease && (pSlot === newPersonID)) ? false : true)
      };
      if (body.notes) { writeRequest.notes = body.notes; }
      let slotInfo = await writeSlot(writeRequest);

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
              owner: '',
              notes: ''
            }
          };
        }
        else {
          workingList.splice(pIndex, 1);
        }
      }
      else {
        // where in the displayed list of slots shoud this added entry go?
        let whereToGo;
        if (pIndex > -1) { whereToGo = pIndex; }   // we came here from a know spot in the slotList
        else {  // look at every workingList entry for something that matches the slot we just registered
          let foundIndex = workingList.findIndex(s => { return (s.slotData.id === writeRequest.slot); });
          if (foundIndex > -1) { whereToGo = foundIndex; }
        }
        if (whereToGo > -1) {
          workingList[whereToGo] = {
            event_key: slotInfo.event_key,
            first,
            last,
            display_name: newPersonName,
            slotData: {
              name: newPersonName,
              id: pSlot,
              owner: newPersonID,
              notes: body.notes
            }
          };
        }
        else {
          workingList.unshift({
            event_key: slotInfo.event_key,
            first,
            last,
            display_name: newPersonName,
            slotData: {
              name: newPersonName,
              id: newPersonID,
              owner: newPersonID,
              notes: body.notes
            }
          });
        }
      }
    }
    setEventSlotList(workingList);
    setForceRedisplay(!forceRedisplay);
    return workingList;
  };

  const handleUpdateEvent = async ([newDescription, newLocation, newDate, newTime]) => {
    let updateExpression = 'set';
    let expressionAttributeValues = {};
    let expressionAttributeNames = {};
    updateExpression += ' description = :d';
    expressionAttributeValues[':d'] = newDescription;
    updateExpression += ', #l = :l';
    expressionAttributeNames['#l'] = 'location';
    expressionAttributeValues[':l'] = newLocation;
    updateExpression += ', occurrence_date = :date';
    expressionAttributeValues[':date'] = makeDate(newDate).numeric$;
    updateExpression += ', #t = :t';
    expressionAttributeNames['#t'] = 'time';
    expressionAttributeValues[':t'] = { 'from': makeTime(newTime).time };
    let goodUpdate = true;
    await dbClient
      .update({
        Key: {
          "client": pClient,
          "event_key": `${pEventCode}`
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        TableName: "Calendar"
      })
      .promise()
      .catch(error => {
        cl(`caught error updating Calendar; error is: `, error);
        goodUpdate = false;
      });
    if (goodUpdate) {
      pOccData.description = newDescription;
      pOccData.location = newLocation;
      pOccData.date = makeDate(newDate).numeric$;
      let timeOut = makeTime(newTime);
      pOccData.time$ = timeOut.time;
      pOccData.time24 = timeOut.numeric24;
      enqueueSnackbar('Event info updated!', { variant: 'success' });
    }
    else {
      enqueueSnackbar('AVA could not update the Event info', { variant: 'error', persist: true });
    }
    return goodUpdate;
  };

  const handleCancelEvent = async () => {
    let updateExpression = 'set';
    let expressionAttributeValues = {};
    updateExpression += ' occurrence_date = :date';
    expressionAttributeValues[':date'] = '29991231';
    let goodUpdate = true;
    await dbClient
      .update({
        Key: {
          "client": pClient,
          "event_key": `${pEventCode}`
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        TableName: "Calendar"
      })
      .promise()
      .catch(error => {
        cl(`caught error updating Calendar; error is: `, error);
        goodUpdate = false;
      });
    if (goodUpdate) {
      pOccData.date = '29991231';
      enqueueSnackbar('Event cancelled!', { variant: 'success' });
    }
    else {
      enqueueSnackbar('AVA could not cancel the Event', { variant: 'error', persist: true });
    }
    return goodUpdate;
  };

  const handleUpdateOwner = async (newOwners) => {
    let eventKey = pEventCode.split('#')[0];
    let updateExpression = 'set';
    let expressionAttributeValues = {};
    let expressionAttributeNames = {};
    updateExpression += ' #eData.#e.#o = :o';
    expressionAttributeValues[':o'] = Object.keys(newOwners);
    expressionAttributeNames['#eData'] = 'eventData';
    expressionAttributeNames['#e'] = 'event_data';
    expressionAttributeNames['#o'] = 'owner';
    let goodUpdate = true;
    await dbClient
      .update({
        Key: {
          "client": pClient,
          "event_key": eventKey
        },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: expressionAttributeValues,
        ExpressionAttributeNames: expressionAttributeNames,
        TableName: "Calendar"
      })
      .promise()
      .catch(error => {
        cl(`caught error updating Calendar; error is: `, error);
        goodUpdate = false;
      });
    if (!goodUpdate) {
      enqueueSnackbar('AVA could not update the Event owners', { variant: 'error', persist: true });
    }
    else {
      pOccData.owner = Object.keys(newOwners);
      enqueueSnackbar('Event owners updated', { variant: 'success' });
    }
    return goodUpdate;
  };

  const handleChangeNotes = async (updatedIndex, pNote) => {
    eventSlotList[updatedIndex].slotData.notes = pNote;
    let slotUpdate = Object.assign(
      {},
      eventSlotList[updatedIndex],
      eventSlotList[updatedIndex].slotData,
      {
        event: eventSlotList[updatedIndex].event_key,
        client: pClient
      }
    );
    slotUpdate.status = 'notes';
    await writeSlot(slotUpdate);
    setEventSlotList(eventSlotList);
    setEditNoteNumber(-1);
    setForceRedisplay(!forceRedisplay);
    return eventSlotList;
  };

  function makeReadableName(pName) {
    let [pPrimary, pFirst] = pName.split(',');
    return (`${pFirst || ''} ${pPrimary}`).trim();
  }

  // ********************

  React.useEffect(() => {
    async function buildIt() {
      setLoading(true);
      await getEventSlots(pEventCode);
      setLoading(false);
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
        {/* Screen header - Description, Date, Location... */}
        {!loading &&
          <Box
            display='flex'
            className={classes.title}
            flexDirection='column'
            onContextMenu={async (e) => {
              e.preventDefault();
              enqueueSnackbar(`AVA event=${pEventCode}`, { variant: 'info', persist: true });
            }}
          >
            <Typography style={AVATextStyle({ size: 1.2 })} >{pOccData.description}</Typography>
            {pOccData.date &&
              <Typography className={classes.standardIndent} style={AVATextStyle({ margin: { left: 1, right: 1 } })} >
                {`${makeDate(pOccData.date).relative}${pOccData.time$ ? ' - ' + pOccData.time$ : ''}`}
              </Typography>
            }
            {pOccData.location &&
              <Typography className={classes.standardIndent} style={AVATextStyle({ margin: { left: 1, right: 1 } })} >
                {pOccData.location}
              </Typography>
            }
            <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
              {rowsWritten = 0}
            </Typography>
          </Box>
        }
        {/* Slots */}
        {eventSlotList && eventSlotList.length > 0 &&
          <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
            <List  >
              {eventSlotList.map((this_item, index) => (
                (!this_item.slotData.hasOwnProperty('show_this_slot') || this_item.slotData.show_this_slot) &&

                <Paper component={Box} elevation={0} key={this_item.slotData.owner + 'frag' + index} >
                  <ListItem
                    key={this_item.slotData.owner + 'r' + index}
                    className={classes.listItemLeft}
                    cols={1}
                  >
                    <Box display='flex' flexGrow={1} flexDirection='row' alignItems='center'>
                      <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                        {rowsWritten++}
                      </Typography>
                      {/* Mark an item - Radio button */}
                      {isEventOwner &&
                        <Box width={40} display='flex' mr={0} flexDirection='row' justifyContent='center' alignItems='center'>
                          {isOwned(this_item.slotData) &&
                            <Tooltip mr={0} ml={0} title={`Mark ${this_item.marked ? 'not ' : ''}attended`} >
                              <IconButton mr={0} ml={0} color='inherit'
                                onClick={async () => {
                                  await dbClient
                                    .update({
                                      Key: {
                                        "client": pClient,
                                        "event_key": `${pEventCode}#${this_item.slotData.id}`
                                      },
                                      UpdateExpression: 'set marked = :m',
                                      ExpressionAttributeValues: { ':m': !this_item.marked },
                                      TableName: "Calendar"
                                    })
                                    .promise()
                                    .catch(error => { cl(`caught error updating Calendar; error is: `, error); });
                                  eventSlotList[index].marked = !this_item.marked;
                                  setEventSlotList(eventSlotList);
                                  setForceRedisplay(!forceRedisplay);
                                }}
                              >
                                {this_item.marked ? <RadioButtonCheckedIcon mr={0} ml={0} /> : <RadioButtonUncheckedIcon mr={0} ml={0} />}
                              </IconButton>
                            </Tooltip>
                          }
                        </Box>
                      }
                      {/* Slot Name */}
                      {(this_item.slotData.id !== this_item.slotData.owner) ?
                        <Box display='flex' mr={1} ml={1} flexDirection='row' justifyContent='center' alignItems='center'>
                          <Typography style={AVATextStyle({ margin: { right: 1 } })} className={classes.standard} >{makeSlotName(this_item.slotData.id)}</Typography>
                        </Box>
                        :
                        <Box display='flex' mr={0} ml={0} flexDirection='row' justifyContent='center' alignItems='center'>
                          <Typography style={AVATextStyle({ margin: { right: 1 } })} className={classes.standard} ></Typography>
                        </Box>
                      }
                      {/* Image and Name */}
                      {isOwned(this_item.slotData) &&
                        <React.Fragment>
                          <Box
                            component="img"
                            mr={1}
                            minWidth={50}
                            maxWidth={50}
                            alt=''
                            src={getImage(this_item.slotData.owner)}
                          />
                          <Box display='flex' flexWrap='wrap' flexDirection='column' flexGrow={1}>
                            <Typography style={AVATextStyle({ size: 1.2, margin: { right: 1 } })}  >{makeReadableName(this_item.slotData.name)}</Typography>
                            {((this_item.slotData.notes && (isEventOwner || isSlotOwner(this_item.slotData))) || (editNoteNumber === index)) &&
                              (editNoteNumber === index ?
                                <Box display='flex' flexDirection='row' alignItems='center' flexGrow={1}>
                                  <TextField
                                    classes={{ root: classes.standard, input: classes.inputRule }}
                                    id={`prompt-msg`}
                                    key={`prompt-msg`}
                                    multiline
                                    inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                                    defaultValue={this_item.slotData.notes || ''}
                                    onChange={(event) => { setNewNote(event.target.value); }}
                                    autoComplete='off'
                                  />
                                  <SaveIcon
                                    aria-label="saveNote_icon"
                                    onClick={() => { handleChangeNotes(index, newNote); }}
                                    edge="end"
                                  />
                                  <CloseIcon
                                    aria-label="closeNote_icon"
                                    onClick={() => { setEditNoteNumber(-1); }}
                                    edge="end"
                                  />
                                </Box>
                                :
                                <Typography style={AVATextStyle({ margin: { right: 1 } })} className={classes.standard} >
                                  {this_item.slotData.notes}
                                </Typography>
                              )
                            }
                          </Box>
                        </React.Fragment>
                      }
                    </Box>
                    {isOwned(this_item.slotData) &&
                      (isEventOwner || isSlotOwner(this_item.slotData)) &&
                      (editNoteNumber === -1) &&
                      <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                        <Tooltip title={`Remove ${isEventOwner ? makeReadableName(this_item.slotData.name) : 'me'}`}>
                          <PersonAddDisabledIcon
                            onClick={async () => {
                              await handleAllocateSlot({
                                person: `${this_item.slotData.name}:${this_item.slotData.owner}`,
                                slot: this_item.slotData.id,
                                release: true,
                                index: (index || 0)
                              });
                            }}
                          />
                        </Tooltip>
                        <Tooltip title={`${this_item.slotData.notes ? 'Update' : 'Add a'} note...`}>
                          <EditIcon
                            onClick={() => {
                              setEditNoteNumber(index);
                            }}
                          />
                        </Tooltip>
                        {isEventOwner && !isSlotOwner(this_item.slotData) &&
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
                    {!isOwned(this_item.slotData) &&
                      (editNoteNumber === -1) &&
                      <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                        <Tooltip title={isEventOwner ? `Select someone` : `Add myself`}>
                          <PersonAddIcon
                            onClick={async () => {
                              if (isEventOwner) {
                                setEditIndex(index);
                                setEditSlot(true);
                                await setChoices(peopleList);
                                setSelectNewSlotOwner(true);
                              }
                              else {
                                let pName = await makeName(pPatient);
                                await handleAllocateSlot({
                                  person: `${pName}:${pPatient}`,
                                  slot: this_item.slotData.id,
                                  index: (index || 0)
                                });
                              }
                            }}
                          />
                        </Tooltip>
                      </Box>
                    }
                  </ListItem>
                </Paper>
              ))}
              {(rowsWritten === 0) &&
                <React.Fragment>
                  <Box display='flex' flexWrap='wrap' flexDirection='column' flexGrow={1}>
                    <Typography variant='h5' >'The List is Empty'</Typography>
                  </Box>
                </React.Fragment>
              }
            </List>
          </Paper>
        }
        {selectNewSlotOwner &&
          <PersonFilter
            prompt={'Who are you signing-up?'}
            peopleList={choiceList}
            multiSelect={!editSlot}
            onCancel={() => {
              setSelectNewSlotOwner(false);
            }}
            onSelect={async (selectedPerson) => {
              setSelectNewSlotOwner(false);
              let slotObj = { person: selectedPerson };
              if (editSlot) {
                slotObj.slot = eventSlotList[editIndex].slotData.id;
                slotObj.index = editIndex;
              }
              await handleAllocateSlot(slotObj);
            }}
          >
          </PersonFilter>
        }
        {promptForMessage &&
          <AVATextInput
            promptText={`Message to everyone signed up for ${pOccData.description}`}
            buttonText='Send'
            onCancel={() => { setPromptForMessage(false); }}
            onSave={(messageText) => {
              setPromptForMessage(false);
              handleSendMessage(messageText, recipient, messageType);
            }}
          />
        }
        {reactData.editEventInfo &&
          <AVATextInput
            titleText='Edit info for this Event'
            promptText={['Description', 'Location', 'Date', 'Time']}
            errorText={reactData.editInfoErrorList}
            valueText={[
              pOccData.description,
              pOccData.location || '',
              (pOccData.date ? makeDate(pOccData.date).absolute : null),
              (pOccData.date ? pOccData.time$ : null)
            ]}
            onCancel={() => {
              reactData.editInfoErrorList = [];
              reactData.editEventInfo = false;
              setReactData(reactData);
              setForceRedisplay(!forceRedisplay);
            }}
            onSave={async (messageText) => {
              reactData.editInfoErrorList = [];
              if (makeDate(messageText[2]).error) {
                reactData.editInfoErrorList = ['', '', 'Please enter a valid date'];
              }
              else {
                await handleUpdateEvent(messageText);
                reactData.editEventInfo = false;
              }
              setReactData(reactData);
              setForceRedisplay(!forceRedisplay);
            }}
          />
        }
        {reactData.editOwnerInfo &&
          <PersonFilter
            prompt={'Select owners'}
            peopleList={state.accessList[state.session.client_id].shortList}
            alreadyChecked={pOccData.owner}
            onCancel={() => {
              reactData.editOwnerInfo = false;
              setReactData(reactData);
              setForceRedisplay(!forceRedisplay);
            }}
            onSelect={async (selectedPeople) => {
              await handleUpdateOwner(selectedPeople);
              reactData.editOwnerInfo = false;
              setReactData(reactData);
              setForceRedisplay(!forceRedisplay);
            }}
            allowRandom={true}
            multiSelect={true}
            returnValue={'object'}
          />
        }
        {reactData.cancelPending &&
          <AVAConfirm
            promptText={[`Are you sure you want to cancel this event?`]}
            cancelText={`Do not cancel`}
            confirmText={`Yes, cancel the event`}
            onCancel={() => {
              reactData.cancelPending = false;
              setReactData(reactData);
              setForceRedisplay(!forceRedisplay);
            }
            }
            onConfirm={async () => {
              await handleCancelEvent();
              reactData.cancelPending = false;
              setReactData(reactData);
              setForceRedisplay(!forceRedisplay);
            }}
            allowCancel={true}
          />
        }
        {!loading &&
          <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
            <Box display='flex' flexDirection='column'>
              <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                <Tooltip title={`Exit`} placement='top'>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white', marginBottom: '-12px' }}
                    size='small'
                    onClick={() => { onReset(pOccData); }}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Done'}
                  </Button>
                </Tooltip>
              </Box>
              <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                {!ownerOfSlots &&
                  <Tooltip title={'Add myself to the list'} placement='top'>
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'blue', color: 'white', marginBottom: '-12px' }}
                      size='small'
                      onClick={async () => {
                        let pName = await makeName(pPatient);
                        let request = { person: `${pName}:${pPatient}` };
                        if (pOccData.signup_type !== 'none') { request.slot = firstAvailableSlot; }
                        await handleAllocateSlot(request);
                        setOwnerOfSlots(true);
                      }}
                      startIcon={<PersonAddIcon size="small" />}
                    >
                      {'Add myself'}
                    </Button>
                  </Tooltip>
                }
                {(pOccData.signup_type === 'none') && isEventOwner &&
                  <Tooltip title={'Add a person'} placement='top'>
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'blue', color: 'white', marginBottom: '-12px' }}
                      size='small'
                      onClick={async () => {
                        await setChoices(peopleList);
                        setEditIndex(false);
                        setEditSlot(false);
                        setSelectNewSlotOwner(true);
                      }}
                      startIcon={<PersonAddIcon size="small" />}
                    >
                      {'Add a person'}
                    </Button>
                  </Tooltip>
                }
              </Box>
              {isEventOwner &&
                <React.Fragment>
                  <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                    <Tooltip title={'Prepare Detail Report'} placement='top'>
                      <Button
                        className={AVAClass.AVAButton}
                        style={{ backgroundColor: 'blue', color: 'white', marginBottom: '-12px' }}
                        size='small'
                        onClick={async () => {
                          await handlePrint(pEventCode, 'full');
                        }}
                        startIcon={<PrintIcon size='small' />}
                      >
                        {'Detail report'}
                      </Button>
                    </Tooltip>
                    <Tooltip title={'Prepare Sign-up sheet'} placement='top'>
                      <Button
                        className={AVAClass.AVAButton}
                        style={{ backgroundColor: 'brown', color: 'white', marginBottom: '-12px' }}
                        size='small'
                        onClick={async () => {
                          await handlePrint(pEventCode, 'sign-up');
                        }}
                        startIcon={<StorageOutlined size='small' />}
                      >
                        {'Sign-up sheet'}
                      </Button>
                    </Tooltip>
                    {(reactData.numberOfOwnedSlots > 0) &&
                      <Tooltip title={'Send a message to everyone that is signed-up'} >
                        <Button
                          className={AVAClass.AVAButton}
                          style={{ backgroundColor: 'orange', color: 'white', marginBottom: '-12px' }}
                          size='small'
                          onClick={() => {
                            setPromptForMessage(true);
                            setMessageType('Group');
                            setRecipient(eventSlotList.map(e => { return e.slotData.id; }));
                          }}
                          startIcon={<SendIcon size='small' />}
                        >
                          {'Message all'}
                        </Button>
                      </Tooltip>
                    }
                  </Box>
                  <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                    <Box display='flex' flexDirection='column' paddingBottom={1} justifyContent='center' alignItems='center'>
                      <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                        <Tooltip title={'Change Description, Date, Location, or Time'} >
                          <Button
                            className={AVAClass.AVAButton}
                            style={{ backgroundColor: 'purple', color: 'white', marginBottom: '-12px' }}
                            size='small'
                            onClick={() => {
                              reactData.editEventInfo = true;
                              reactData.editInfoErrorList = [];
                              setReactData(reactData);
                              setForceRedisplay(!forceRedisplay);
                            }}
                            startIcon={<EditIcon size='small' />}
                          >
                            {'Update Event Info'}
                          </Button>
                        </Tooltip>
                        <Tooltip title={'Add event owners'} >
                          <Button
                            className={AVAClass.AVAButton}
                            style={{ backgroundColor: 'purple', color: 'white', marginBottom: '-12px' }}
                            size='small'
                            onClick={() => {
                              reactData.editOwnerInfo = true;
                              setReactData(reactData);
                              setForceRedisplay(!forceRedisplay);
                            }}
                            startIcon={<PersonAddIcon size='small' />}
                          >
                            {'Add Event Owners'}
                          </Button>
                        </Tooltip>
                      </Box>
                      <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                        <Tooltip title={'Add event owners'} >
                          <Button
                            className={AVAClass.AVAButton}
                            style={{ backgroundColor: 'red', color: 'white', marginBottom: '-12px' }}
                            size='small'
                            onClick={() => {
                              reactData.cancelPending = true;
                              setReactData(reactData);
                              setForceRedisplay(!forceRedisplay);
                            }}
                            startIcon={<DeleteIcon size='small' />}
                          >
                            {'Cancel Event'}
                          </Button>
                        </Tooltip>
                      </Box>
                    </Box>
                  </Box>
                </React.Fragment>
              }
            </Box>
          </DialogActions>
        }
      </React.Fragment>
    </Dialog >
  );
};