import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';
import { makeDate } from '../../util/AVADateTime';
import { getSlotList, writeSlot, makeSlotName } from '../../util/AVACalendars';
import { getMemberList } from '../../util/AVAGroups';
import { cl, makeArray } from '../../util/AVAUtilities';
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
import EditIcon from '@material-ui/icons/Edit';
import SaveIcon from '@material-ui/icons/Save';
import IconButton from '@material-ui/core/IconButton';
import RadioButtonCheckedIcon from '@material-ui/icons/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';

import PersonFilter from '../forms/PersonFilter';
import AVATextInput from '../forms/AVATextInput';

import Input from '@material-ui/core/Input';

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

  const classes = useStyles();

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

  const isEventOwner = pOccData?.owner?.includes(pPatient);
  const [browseMode, setBrowseMode] = React.useState((pMode === 'view') || isEventOwner);
  const [signupMode, setsignupMode] = React.useState((pMode !== 'view') && !isEventOwner);
  const [loading, setLoading] = React.useState(true);

  const [ownerOfSlots, setOwnerOfSlots] = React.useState(false);
  const [allSlotsEmpty, setAllSlotsEmpty] = React.useState(true);
  const [firstAvailableSlot, setFirstAvailableSlot] = React.useState();

  var rowsWritten = 0;

  const AWS = require('aws-sdk');
  const dbClient = new AWS.DynamoDB.DocumentClient({
    apiVersion: '2012-08-10',
    region: "us-east-1",
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY
  });

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
    let checkOwnership = false;
    let allSlotsEmpty_work = true;
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
      if (isOwned(slotData)) { allSlotsEmpty_work = false; }
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
    setAllSlotsEmpty(allSlotsEmpty_work);
    setFirstAvailableSlot(firstAvailableChoice);
    setEventSlotList(slotList);
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
            <Typography variant='h5' >{pOccData.description}</Typography>
            {pOccData.date &&
              <Typography className={classes.standardIndent} variant='body1'>
                {`${makeDate(pOccData.date).relative}${pOccData.time$ ? ' - ' + pOccData.time$ : ''}`}
              </Typography>
            }
            {pOccData.location &&
              <Typography className={classes.standardIndent} variant='body1'>
                {pOccData.location}
              </Typography>
            }
            <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
              {rowsWritten = 0}
            </Typography>
          </Box>
        }
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
                      {isEventOwner && !allSlotsEmpty &&
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
                      {(this_item.slotData.id !== this_item.slotData.owner) &&
                        <Box display='flex' mr={1} ml={1} flexDirection='row' justifyContent='center' alignItems='center'>
                          <Typography variant='body1' className={classes.standard} >{makeSlotName(this_item.slotData.id)}</Typography>
                        </Box>
                      }
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
                            <Typography variant='h5' >{makeReadableName(this_item.slotData.name)}</Typography>
                            {((this_item.slotData.notes && (isEventOwner || isSlotOwner(this_item.slotData))) || (editNoteNumber === index)) &&
                              (editNoteNumber === index ?
                                <Box display='flex' flexDirection='row' alignItems='center' flexGrow={1}>
                                  <Input classes={{ root: classes.standard, input: classes.inputRule }}
                                    multiline
                                    key={`noteData_${index}`}
                                    defaultValue={this_item.slotData.notes || ''}
                                    onChange={(event) => { setNewNote(event.target.value); }}
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
                                <Typography variant='body1' className={classes.standard} >
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
        {!loading && (rowsWritten === 0) && browseMode &&
          <AVATextInput
            titleText={`The list is empty`}
            promptText={[]}
            buttonText='Add Myself'
            onCancel={() => {
              onReset();
            }}
            onSave={() => {
              setBrowseMode(false);
              setsignupMode(true);
              setForceRedisplay(!forceRedisplay);
            }}
          />
        }
        {!loading && signupMode && !ownerOfSlots &&
          (['time', 'seats', 'direct'].includes(pOccData.signup_type)
            ?
            <AVATextInput
              titleText={`You are not on the list yet.  Tap "Add me" below.`}
              promptText={'(Optional) Notes or Additional Information'}
              buttonText={['Add me!', 'Not now']}
              onCancel={() => {
                setBrowseMode(true);
                setsignupMode(false);
                setForceRedisplay(!forceRedisplay);
              }}
              onSave={async (myNotes) => {
                let pName = await makeName(pPatient);
                let slotObj = { person: `${pName}:${pPatient}` };
                slotObj.slot = firstAvailableSlot || pPatient;
                if (myNotes) { slotObj.notes = myNotes; }
                await handleAllocateSlot(slotObj);
                setBrowseMode(true);
                setsignupMode(false);
                setForceRedisplay(!forceRedisplay);
              }}
            />
            :
            <AVATextInput
              titleText={`Want to learn more?  Send a message to the event sponsor...`}
              promptText={'Message Text'}
              buttonText={['Send', 'Not now']}
              onCancel={() => {
                setBrowseMode(true);
                setsignupMode(false);
                setForceRedisplay(!forceRedisplay);
              }}
              onSave={async (myMessage) => {
                await handleSendMessage(myMessage, pOccData.owner);
                onReset();
              }}
            />
          )
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
        {!loading &&
          <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
            <Box display='flex' flexDirection='column'>
              <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                <Tooltip title={`Exit`} placement='top'>
                  <Button
                    className={classes.rowButtonRed}
                    onClick={onReset}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Done'}
                  </Button>
                </Tooltip>
                {(pOccData.signup_type === 'none') && browseMode &&
                  <Tooltip title={(isEventOwner ? 'Add a person' : 'Add myself to the list')} placement='top'>
                    <Button
                      className={classes.rowButtonDefault}
                      onClick={async () => {
                        if (isEventOwner) {
                          await setChoices(peopleList);
                          setEditIndex(false);
                          setEditSlot(false);
                          setSelectNewSlotOwner(true);
                        }
                        else {
                          let pName = await makeName(pPatient);
                          await handleAllocateSlot({ person: `${pName}:${pPatient}` });
                        }
                      }}
                      startIcon={<PersonAddIcon size="small" />}
                    >
                      {isEventOwner ? 'Add a person' : 'Add myself to the list'}
                    </Button>
                  </Tooltip>
                }
                {isEventOwner && browseMode &&
                  <Tooltip title={'Prepare Detail Report'} placement='top'>
                    <Button
                      className={classes.rowButtonDefault}
                      onClick={async () => {
                        await handlePrint(pEventCode, 'report');
                      }}
                      startIcon={<PrintIcon size='small' />}
                    >
                      {'Detail report'}
                    </Button>
                  </Tooltip>
                }
              </Box>
              {isEventOwner && browseMode &&
                <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                  <Tooltip title={'Prepare Sign-up sheet'} placement='top'>
                    <Button
                      className={classes.rowButtonDefault}
                      onClick={async () => {
                        await handlePrint(pEventCode, 'sign-up');
                      }}
                      startIcon={<StorageOutlined size='small' />}
                    >
                      {'Sign-up sheet'}
                    </Button>
                  </Tooltip>
                  <Tooltip title={'Send a message to everyone that is signed-up'} >
                    <Button
                      className={classes.rowButtonDefault}
                      onClick={() => {
                        setPromptForMessage(true);
                        setMessageType('Group');
                        setRecipient(eventSlotList.map(e => { return e.slotData.id; }));
                      }}
                      startIcon={<SendIcon size='small' />}
                    >
                      {'Message to everyone on the list'}
                    </Button>
                  </Tooltip>
                </Box>
              }
            </Box>
          </DialogActions>
        }
      </React.Fragment>
    </Dialog >
  );
};