import React from 'react';
import { useSnackbar } from 'notistack';
import { makeDate, makeTime } from '../../util/AVADateTime';
import { getSlotList, writeSlot, makeSlotName, printOccurrenceSheet } from '../../util/AVACalendars';
import { getMemberList } from '../../util/AVAGroups';
import { cl, makeArray, dbClient, isEmpty } from '../../util/AVAUtilities';
import { makeName, getImage, getPerson } from '../../util/AVAPeople';
import { sendMessages } from '../../util/AVAMessages';
import { putServiceRequest } from '../../util/AVAServiceRequest';
import MakeMessage from './MakeMessage';

import List from '@material-ui/core/List';
import Button from '@material-ui/core/Button';
import Tooltip from '@material-ui/core/Tooltip';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';

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

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import TextField from '@material-ui/core/TextField';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';
import { getServiceRequests } from '../../util/AVAServiceRequest';

const useStyles = makeStyles(theme => ({
  page: {
    // minHeight: '950px',
    width: '100%'
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
    marginTop: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(2),
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
    paddingLeft: theme.spacing(2),
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
  popUpMenu: {
    marginRight: theme.spacing(3),
    paddingRight: 2,
  },
  clientPopUp: {
    borderRadius: '30px 30px 30px 30px',
  },
  popUpMenuRow: {
    marginLeft: theme.spacing(1),
    fontSize: theme.typography.fontSize * 1.0,
  },
  popUpFooter: {
    fontSize: theme.typography.fontSize * 0.8,
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

export default ({ pEventCode, peopleList, pPatient, pSignUps, pViewOnly = false, pClient, pOccData, defaultValues, onReset, pMode }) => {

  const { state } = useSession();

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const [eventSlotList, setEventSlotList] = React.useState([]);

  const [selectNewSlotOwner, setSelectNewSlotOwner] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [editSlot, setEditSlot] = React.useState();

  const [editNoteNumber, setEditNoteNumber] = React.useState(-1);
  const [newNote, setNewNote] = React.useState('');

  const { enqueueSnackbar } = useSnackbar();

  const isEventOwner = pOccData?.owner?.includes(pPatient)
    || ['master', 'support'].includes(state.patient.account_class);
  const [loading, setLoading] = React.useState(true);

  const [ownerOfSlots, setOwnerOfSlots] = React.useState(false);
  const [firstAvailableSlot, setFirstAvailableSlot] = React.useState();

  const [reactData, setReactData] = React.useState({
    promptForMessage: '',
    messageType: null,
    recipient: null,
    editEventInfo: false,
    editInfoErrorList: [],
    editOwnerInfo: false,
    editIndex: false,
    popupMenuOpen: false,
    choiceList: [],
    signUpObject: pSignUps || {},
    attachedSR: false,
    selectAssignTo: false,
    defaultValues: defaultValues || { "noDefaults": true },
    cancelPending: false,
    numberOfOwnedSlots: 0
  });

  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  const [anchorEl, setAnchorEl] = React.useState(null);

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  var rowsWritten = 0;

  function isOwned(slotData) {
    return (slotData.owner && (slotData.owner !== 'available'));
  }

  function isSlotOwner(slotData) {
    return (slotData.owner === pPatient);
  }

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  const setChoices = async (pGroups) => {
    if (reactData.choiceList.length > 0) { return; }
    let response = [];
    let gList = [];
    if (Array.isArray(pGroups)) {
      pGroups.forEach(grp => {
        grp = grp.replace('~group:', '');
        gList.push(...(grp.replace(/[[\]]/g, '').split(/,|~/g)));
      });
    }
    else if (pGroups.includes('[')) {
      pGroups = pGroups.replace('~group:', '');
      gList = pGroups.replace(/[[\]]/g, '').split(/,|~/g);
    }
    else { gList = [pGroups]; }
    if (pOccData.groups) {        // If this event is restricted to specific groups, only allow names from those groups
      pOccData.groups.forEach(g => {
        if (!gList.includes(g)) {
          gList.push(g);
        }
      });
    }
    let memberInfo = await getMemberList(gList, pClient, { "sort": true, "exclude": false });
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
      if (p.messaging) {
        searchString += Object.values(p.messaging).join(' ');
      }
      // list is of the form <name>:<id>:<search_string>
      try {
        mInfo = `${p.name.last}, ${p.name.first}`;
        if (reactData.signUpObject && reactData.signUpObject.hasOwnProperty(p.person_id)) {
          mInfo += ` (${reactData.signUpObject[p.person_id].length} scheduled)`;
        }
        mInfo += `:${p.person_id}:${searchString}`;
        if (reactData.signUpObject.hasOwnProperty(p.person_id) &&
          reactData.signUpObject[p.person_id].some(o => {
            return (o.occurrence_date === pOccData.date);
          })) {
          mInfo += '**CONFLICT**';
        }
        response.push(mInfo);
      }
      catch (error) {
        cl(`response push error at index ${e} with ${mInfo}`);
      }
    };
    updateReactData({
      choiceList: response
    }, false);
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
      if (!checkOwnership) {
        checkOwnership = isSlotOwner(slotData);
      }
      if (isOwned(slotData)) {
        reactData.numberOfOwnedSlots++;
      }
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
      if (a.slotData.slot_sort) {
        return ((a.slotData.slot_sort > b.slotData.slot_sort) ? 1 : -1);
      }
      else if (a.slotData.id > b.slotData.id) { return 1; }
      else { return -1; }
    });
    setOwnerOfSlots(checkOwnership);
    setFirstAvailableSlot(firstAvailableChoice);
    setEventSlotList(slotList);
    setReactData(reactData);
    return slotList;
  };

  const handleAllocateSlot = async (body) => {
    let pPerson, pSlot, pRelease, pIndex;

    if (body.release) { pRelease = body.release; }
    else { pRelease = false; }
    if (body.hasOwnProperty('index')) {
      pIndex = body.index;
    }
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
      let newPersonLocation = null;
      let this_person = await getPerson(newPersonID, '*all');
      if (this_person) {
        if (this_person.location) {
          newPersonLocation = this_person.location.trim();
        }
        if (this_person.name) {
          first = this_person.name.first;
          last = this_person.name.last;
        }
        newPersonName = (`${first || ''} ${last}`).trim();
      }
      let writeRequest = {
        "client": pClient,
        "person_id": state.session.patient_id,
        "event": pEventCode,
        "occurrence_date": pOccData.date,
        "owner": newPersonID,
        "override_name": newPersonName,
        "slot": pSlot || newPersonID,
        "status": (pRelease ? 'released' : 'selected'),
        "show_this_slot": ((pRelease && (pSlot === newPersonID)) ? false : true),
        "no_messaging": isEventOwner
      };
      if (pOccData.description) {
        writeRequest.override_description = pOccData.description;
      }
      if (body.notes) { writeRequest.notes = body.notes; }
      let slotInfo = await writeSlot(writeRequest);

      if (pRelease) {
        if (pSlot !== newPersonID) {
          let updatedSlotData = Object.assign(workingList[pIndex].slotData, {
            name: '',
            owner: '',
            notes: ''
          });
          workingList[pIndex] = {
            event_key: slotInfo.event_key,
            first,
            last,
            display_name: '',
            slotData: updatedSlotData
          };
        }
        else {
          workingList.splice(pIndex, 1);
        }
      }
      else {
        // where in the displayed list of slots should this added entry go?
        let whereToGo;
        if (pIndex > -1) { whereToGo = pIndex; }   // we came here from a know spot in the slotList
        else {  // look at every workingList entry for something that matches the slot we just registered
          let foundIndex = workingList.findIndex(s => { return (s.slotData.id === writeRequest.slot); });
          if (foundIndex > -1) { whereToGo = foundIndex; }
        }

        if ((whereToGo > -1) && (whereToGo < workingList.length)) {
          workingList[whereToGo] = {
            event_key: slotInfo.event_key,
            first,
            last,
            display_name: newPersonName,
            slotData: {
              name: newPersonName,
              display_name: newPersonName,
              id: pSlot,
              owner: newPersonID,
              owner_location: newPersonLocation,
              notes: body.notes,
              slot_description: workingList[whereToGo].slotData.slot_description,
              slot_sort: workingList[whereToGo].slotData.slot_sort
            }
          };
        }
        else {
          workingList.push({
            event_key: slotInfo.event_key,
            first,
            last,
            display_name: newPersonName,
            slotData: {
              name: newPersonName,
              id: newPersonID,
              display_name: newPersonName,
              owner: newPersonID,
              owner_location: newPersonLocation,
              notes: body.notes
            }
          });
        }
      }
    };
    setEventSlotList(workingList);
    setForceRedisplay(!forceRedisplay);
    return workingList;
  };

  const handleUpdateEvent = async ([newDescription, newLocation, newDate, newTime]) => {
    let updateExpression = 'set ';
    let expressionAttributeValues = {};
    let expressionAttributeNames = {};
    let previousEntry = false;

    if (newDescription) {
      updateExpression += 'description = :d';
      expressionAttributeValues[':d'] = newDescription;
      previousEntry = true;
      pOccData.description = newDescription;
    }

    if (newLocation) {
      updateExpression += `${previousEntry ? ', ' : ''}#l = :l`;
      expressionAttributeNames['#l'] = 'location';
      expressionAttributeValues[':l'] = newLocation;
      previousEntry = true;
      pOccData.location = newLocation;
    }

    let needsSlotUpdates = false;
    let dNumeric$;
    if (newDate) {
      updateExpression += `${previousEntry ? ', ' : ''}occurrence_date = :date`;
      dNumeric$ = makeDate(newDate).numeric$;
      expressionAttributeValues[':date'] = dNumeric$;
      previousEntry = true;
      pOccData.date = dNumeric$;
      needsSlotUpdates = (eventSlotList && (eventSlotList.length > 0));
    }

    let needsSlotTimeMessage = false;
    if (newTime) {
      updateExpression += `${previousEntry ? ', ' : ''}#t = :t`;
      expressionAttributeNames['#t'] = 'time';
      if (newTime.toLowerCase().includes(' to ')) {
        let [newFrom, newTo] = newTime.toLowerCase().split(' to ');
        let timeOut = makeTime(newFrom);
        expressionAttributeValues[':t'] = {
          from: timeOut.time,
          to: makeTime(newTo).time
        };
        pOccData.time$ = timeOut.time;
        pOccData.time24 = timeOut.numeric24;
      }
      else {
        let timeOut = makeTime(newTime);
        expressionAttributeValues[':t'] = {
          from: timeOut.time
        };
        pOccData.time$ = timeOut.time;
        pOccData.time24 = timeOut.numeric24;
      }
      needsSlotTimeMessage = (eventSlotList && (eventSlotList.length > 0));
    }

    let qQ = {
      Key: {
        "client": pClient,
        "event_key": pEventCode
      },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      TableName: "Calendar"
    };
    if (!isEmpty(expressionAttributeNames)) {
      qQ.ExpressionAttributeNames = expressionAttributeNames;
    }

    let goodUpdate = true;
    await dbClient
      .update(qQ)
      .promise()
      .catch(error => {
        cl(`caught error updating Calendar for ${qQ.Key.event_key}; error is: `, error);
        goodUpdate = false;
      });

    // if we have to update slots (because of a date change)
    if (needsSlotUpdates) {
      let qS = {
        Key: {
          "client": pClient,
        },
        UpdateExpression: `set occurrence_date = :date`,
        ExpressionAttributeValues: {
          ':date': dNumeric$
        },
        TableName: "Calendar"
      };
      for (let s = 0; s < eventSlotList.length; s++) {
        let this_slot = eventSlotList[s];
        qS.Key.event_key = `${pEventCode}#${this_slot.slotData.slot}`;
        await dbClient
          .update(qS)
          .promise()
          // eslint-disable-next-line
          .catch(error => {
            cl(`caught error updating Calendar for ${qS.Key.event_key}; error is: `, error);
            goodUpdate = false;
          });
      }
    }

    if (goodUpdate) {
      enqueueSnackbar('Event info updated!', { variant: 'success' });
    }
    else {
      enqueueSnackbar('AVA could not update the Event info', { variant: 'error', persist: true });
    }
    return (needsSlotUpdates || needsSlotTimeMessage);
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
    slotUpdate.no_messaging = true;
    await writeSlot(slotUpdate);
    setEventSlotList(eventSlotList);
    setEditNoteNumber(-1);
    setForceRedisplay(!forceRedisplay);
    return eventSlotList;
  };

  // ********************

  React.useEffect(() => {
    async function buildIt() {
      setLoading(true);
      await getEventSlots(pEventCode);
      let attachedRequest = await getServiceRequests({
        foreign_key: pEventCode,
        client_id: state.session.client_id
      });
      if (attachedRequest.length === 0) {
        updateReactData({
          attachedSR: false
        }, false);
      }
      else {
        attachedRequest[0].assigned_to_name = await makeName(attachedRequest[0].assigned_to);
        updateReactData({
          attachedSR: attachedRequest[0]
        }, false);
      }
      setLoading(false);
    }
    buildIt();
  }, [pEventCode]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog
      open={true || forceRedisplay}
      position={'relative'}
      fullWidth
      p={2}
    >
      <React.Fragment>
        {/* Screen header - Description, Date, Location... */}
        {!loading &&
          <Box
            display='flex' flexDirection='row'
            className={classes.messageArea}
            alignItems={'center'}
            key={'topBox'}
          >
            <Box
              display='flex'
              className={classes.title}
              flexDirection='column'
              flexGrow={1}
              onContextMenu={async (e) => {
                e.preventDefault();
                enqueueSnackbar(`AVA event=${pEventCode}`, { variant: 'info', persist: true });
              }}
            >
              <Typography style={AVATextStyle({ size: 1.5, bold: true })} >{pOccData.description}</Typography>
              {pOccData.date &&
                <Typography className={classes.standardIndent} style={AVATextStyle({ margin: { left: 1, right: 1 } })} >
                  {`${makeDate(pOccData.date).relative}${(pOccData.time$ && (pOccData.time$.trim() !== '')) ? ' - ' + pOccData.time$ : ''}`}
                </Typography>
              }
              {pOccData.location &&
                <Typography className={classes.standardIndent} style={AVATextStyle({ margin: { left: 1, right: 1 } })} >
                  {pOccData.location}
                </Typography>
              }
              {reactData.attachedSR &&
                <Typography className={classes.standardIndent} style={AVATextStyle({ margin: { left: 1, right: 1 } })} >
                  {`Assigned to ${reactData.attachedSR.assigned_to_name}`}
                </Typography>
              }
              <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                {rowsWritten = 0}
              </Typography>
            </Box>
            <Box
              component="img"
              m={2}
              aria-controls='hidden-menu'
              aria-haspopup='true'
              minWidth={50}
              minHeight={50}
              maxHeight={50}
              onClick={(event) => {
                handleClick(event);
                updateReactData({
                  popupMenuOpen: true
                }, true);
              }}
              alt=''
              src={state.session?.client_logo || process.env.REACT_APP_AVA_LOGO}
            />
            {isEventOwner &&
              <Menu
                id='hidden-menu'
                anchorEl={anchorEl}
              open={reactData.popupMenuOpen}
              classes={{ paper: classes.clientPopUp }}
                onClose={() => {
                  updateReactData({
                    popupMenuOpen: false
                  }, true);
                }}
                keepMounted>
                <MenuList className={classes.popUpMenu}>
                  {(pOccData.signup_type === 'none') && isEventOwner &&
                    <MenuItem
                      onClick={async () => {
                        await setChoices(peopleList);
                        updateReactData({
                          editIndex: false,
                          popupMenuOpen: false,
                        }, false);
                        setEditSlot(false);
                        setSelectNewSlotOwner(true);
                      }}
                    >
                      <Box
                        display='flex' flexDirection='row' alignItems={'center'}
                        key={'vRowHome'}
                      >
                        <PersonAddIcon />
                        <Typography className={classes.popUpMenuRow} >{'Add a person'}</Typography>
                      </Box>
                    </MenuItem>
                  }
                  {isEventOwner && reactData.defaultValues.allowAssign &&
                    <MenuItem
                      onClick={async () => {
                        await setChoices(reactData.defaultValues.allowAssign);
                        updateReactData({
                          selectAssignTo: true,
                          popupMenuOpen: false,
                        }, true);
                      }}
                    >
                      <Box
                        display='flex' flexDirection='row' alignItems={'center'}
                        key={'vRowHome'}
                      >
                        <PersonAddIcon />
                        <Typography className={classes.popUpMenuRow} >{'Assign'}</Typography>
                      </Box>
                    </MenuItem>
                  }
                  <MenuItem
                    onClick={async () => {
                      await handlePrint(pEventCode, 'full');
                      updateReactData({
                        popupMenuOpen: false,
                      }, true);
                    }}
                  >
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowHome'}
                    >
                      <PrintIcon />
                      <Typography className={classes.popUpMenuRow} >{'Detail report'}</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    onClick={async () => {
                      await handlePrint(pEventCode, 'sign-up');
                      updateReactData({
                        popupMenuOpen: false,
                      }, true);
                    }}
                  >
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowHome'}
                    >
                      <StorageOutlined />
                      <Typography className={classes.popUpMenuRow} > {'Sign-up sheet'}</Typography>
                    </Box>
                  </MenuItem>
                  {(reactData.numberOfOwnedSlots > 0) &&
                    <MenuItem
                      onClick={() => {
                        let filteredList = eventSlotList.filter(e => {
                          return (e.slotData.status !== 'released');
                        });
                        updateReactData({
                          promptForMessage: true,
                          popupMenuOpen: false,
                          messageType: 'group',
                          recipient: (filteredList.map(e => {
                            return `${e.slotData.display_name}:${e.slotData.id}`;
                          }))
                        }, true);
                      }}
                    >
                      <Box
                        display='flex' flexDirection='row' alignItems={'center'}
                        key={'vRowHome'}
                      >
                        <SendIcon />
                        <Typography className={classes.popUpMenuRow} > {'Message All'}</Typography>
                      </Box>
                    </MenuItem>
                  }
                  <MenuItem
                    onClick={() => {
                      updateReactData({
                        popupMenuOpen: false,
                        editEventInfo: true,
                        editInfoErrorList: []
                      }, true);
                    }}
                  >
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowHome'}
                    >
                      <EditIcon />
                      <Typography className={classes.popUpMenuRow} > {'Update event info'}</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      updateReactData({
                        popupMenuOpen: false,
                        cancelPending: true,
                      }, true);
                    }}
                  >
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowHome'}
                    >
                      <DeleteIcon />
                      <Typography className={classes.popUpMenuRow} > {'Cancel this event'}</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      updateReactData({
                        popupMenuOpen: false,
                        editOwnerInfo: true,
                      }, true);

                    }}
                  >
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowHome'}
                    >
                      <PersonAddIcon />
                      <Typography className={classes.popUpMenuRow} > {'Add owners'}</Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem>
                    <Box
                      display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                      key={'vRowRefresh'}
                    >
                      <Typography className={classes.popUpFooter} >{`AVA vers ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                      <Typography className={classes.popUpFooter} >{`User ${state.session.user_id}${state.session.patient_id !== state.session.user_id ? (' (' + state.session.patient_id + ')') : ''}`}</Typography>
                      <Typography className={classes.popUpFooter} >{`Event: ${pEventCode}`}</Typography>
                    </Box>
                  </MenuItem>
                </MenuList>
              </Menu>
            }
          </Box>
        }
        {/* Slots */}
        {eventSlotList && eventSlotList.length > 0 &&
          <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
            <List  >
              {eventSlotList.map((this_item, index) => (
                (!this_item.slotData.hasOwnProperty('show_this_slot') || this_item.slotData.show_this_slot) &&
                <Box display='flex' flexDirection='row' alignItems='center'
                  minHeight={50}
                  justifyContent={'space-between'} my={1} pl={2}
                >
                  <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                    {rowsWritten++}
                  </Typography>
                  {/* Slot Name above Slot owner info */}
                  <Box display='flex'
                    width='100%' flexDirection='column' justifyContent='center' alignItems='flex-start'>
                    {/* Slot Name */}
                    {(this_item.slotData.id !== this_item.slotData.owner) &&
                      <Box display='flex' mr={1} ml={0}
                        flexDirection='row' justifyContent='center' alignItems='center'
                      >
                        <Typography style={AVATextStyle({
                          size: 1,
                          align: 'left',
                        })} className={classes.standard} >
                          {this_item.slotData.hasOwnProperty('slot_description')
                            ? this_item.slotData.slot_description
                            : makeSlotName(this_item.slotData.id)
                          }
                        </Typography>
                      </Box>
                    }
                    {/* Slot Owner */}
                    {isOwned(this_item.slotData) &&
                      <Box display='flex' width='100%'
                        mt={(this_item.slotData?.slot_description ? 1 : 0)}
                        flexDirection='row' justifyContent='flex-start' alignItems='center'
                      >
                        {/* Mark an item - Radio button */}
                        <Box width={40} display='flex' mr={0} flexDirection='row' justifyContent='center' alignItems='center'>
                          {isEventOwner &&
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
                        {/* Image and Name */}
                        {(!(state.user.account_class
                          && ['family', 'guest', 'vendor', 'other'].includes(state.user.account_class)
                          && !(isEventOwner || isSlotOwner(this_item.slotData))
                        )) &&
                          <Box
                            component="img"
                            mr={1}
                            minWidth={50}
                            maxWidth={50}
                            minHeight={50}
                            maxHeight={50}
                            border={1}
                            alt=''
                            src={getImage(this_item.slotData.owner)}
                          />
                        }
                        <Box display='flex' flexDirection='column' width='100%'>
                          <Typography style={AVATextStyle({ size: 1.5, margin: { right: 1 } })}  >
                            {(state.user.account_class
                              && ['family', 'guest', 'vendor', 'other'].includes(state.user.account_class)
                              && !(isEventOwner || isSlotOwner(this_item.slotData))
                            ) ? 'Reserved' : this_item.slotData.display_name
                            }
                          </Typography>
                          {/* There are notes and I am the event or slot owner 
                                OR You've asked to edit notes (which you only could do if you are the owner) */}
                          {((this_item.slotData.notes && (isEventOwner || isSlotOwner(this_item.slotData))) || (editNoteNumber === index)) &&
                            (editNoteNumber === index ?
                              <Box display='flex' flexDirection='row' alignItems='center' flexGrow={1}>
                                <TextField
                                  classes={{ root: classes.standard }}
                                  id={`prompt-msg`}
                                  key={`prompt-msg`}
                                  multiline
                                  inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                                  defaultValue={this_item.slotData.notes || ''}
                                  onChange={(event) => { setNewNote(event.target.value); }}
                                  autoComplete='off'
                                />
                                {((pOccData.notes_required && newNote) || !pOccData.notes_required) &&
                                  <SaveIcon
                                    aria-label="saveNote_icon"
                                    onClick={() => {
                                      handleChangeNotes(index, newNote);
                                    }}
                                    edge="end"
                                  />
                                }
                                {(!pOccData.notes_required || this_item.slotData.notes) &&
                                  <CloseIcon
                                    aria-label="closeNote_icon"
                                    onClick={() => { setEditNoteNumber(-1); }}
                                    edge="end"
                                  />
                                }
                              </Box>
                              :
                              <Typography style={AVATextStyle({ margin: { right: 1 } })} className={classes.standard} >
                                {this_item.slotData.notes}
                              </Typography>
                            )
                          }
                          {pOccData.notes_required && (pOccData.notes_required !== '') && (editNoteNumber === index) &&
                            <Typography style={AVATextStyle({ size: 0.8, margin: { right: 1 } })} >
                              {pOccData.notes_required}
                            </Typography>
                          }
                        </Box>
                        {(isEventOwner || isSlotOwner(this_item.slotData)) &&
                          (editNoteNumber === -1) &&
                          <Box display='flex' mr={2} flexDirection='row' justifyContent='center' alignItems='center'>
                            {isEventOwner && !isSlotOwner(this_item.slotData) &&
                              <Box display='flex' mr={2} flexDirection='row' justifyContent='center' alignItems='center'>
                                <Tooltip title={`Send a message to ${this_item.slotData.display_name}`} >
                                  <SendIcon
                                    onClick={() => {
                                      updateReactData({
                                        promptForMessage: true,
                                        messageType: '',
                                        recipient: (`${this_item.slotData.display_name}:` + this_item.slotData.owner)
                                      }, true);
                                    }}
                                  />
                                </Tooltip>
                              </Box>
                            }
                            <Box display='flex' mr={2} flexDirection='row' justifyContent='center' alignItems='center'>
                              <Tooltip title={`${this_item.slotData.notes ? 'Update' : 'Add a'} note...`}>
                                <EditIcon
                                  onClick={() => {
                                    setEditNoteNumber(index);
                                  }}
                                />
                              </Tooltip>
                            </Box>
                            {(isEventOwner || !pViewOnly) &&
                              <Tooltip title={`Remove ${isEventOwner ? this_item.slotData.display_name : 'me'}`}>
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
                            }
                          </Box>
                        }
                      </Box>
                    }
                    {!isOwned(this_item.slotData) && (isEventOwner || !pViewOnly) &&
                      (editNoteNumber === -1) &&
                      <Box display='flex' width='100%' pr={2} flexDirection='row' justifyContent='flex-end' alignItems='center'>
                        <Tooltip title={isEventOwner ? `Select someone` : `Add myself`}>
                          <PersonAddIcon
                            mr={2}
                            onClick={async () => {
                              if (isEventOwner) {
                                updateReactData({ editIndex: index }, false);
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
                                if (pOccData.notes_required) {
                                  setEditNoteNumber(index);
                                }
                              }
                            }}
                          />
                        </Tooltip>
                      </Box>
                    }
                  </Box>
                </Box>
              ))}
              {(rowsWritten === 0) &&
                <React.Fragment>
                  <Box display='flex' flexWrap='wrap' flexDirection='column' flexGrow={1}>
                    <Typography style={AVATextStyle({ size: 1.8, align: 'center' })} >The List is Empty</Typography>
                    <Typography style={AVATextStyle({ size: 0.8, align: 'center' })} >Tap "Add Someone" below</Typography>
                  </Box>
                </React.Fragment>
              }
            </List>
          </Paper>
        }
        {selectNewSlotOwner &&
          <PersonFilter
            prompt={'Who are you adding?'}
            peopleList={reactData.choiceList}
            multiSelect={!editSlot}
            onCancel={() => {
              setSelectNewSlotOwner(false);
            }}
            onSelect={async (selectedPerson) => {
              setSelectNewSlotOwner(false);
              let nArray = selectedPerson.split(':');
              let pID = nArray[Math.min(1, nArray.length - 1)];
              if (!reactData.signUpObject.hasOwnProperty(pID)) {
                reactData.signUpObject[pID] = [];
              }
              reactData.signUpObject[pID].push(eventSlotList[reactData.editIndex]);
              updateReactData({
                signUpObject: reactData.signUpObject
              }, false);
              let slotObj = { person: selectedPerson };
              if (editSlot) {
                let listIndex = reactData.editIndex;
                if (!reactData.editIndex && (reactData.editIndex !== 0)) {
                  listIndex = eventSlotList.findIndex(slot => {
                    return (slot.slotData.status === 'available');
                  });
                }
                if ((listIndex < 0) || (!listIndex && (listIndex !== 0))) {   // no assigned slot
                  slotObj.slot = selectedPerson.person_id;
                  slotObj.index = eventSlotList.length;
                }
                else {
                  slotObj.slot = eventSlotList[listIndex].slotData.id;
                  slotObj.index = listIndex;
                }
              }
              await handleAllocateSlot(slotObj);
            }}
          >
          </PersonFilter>
        }
        {reactData.promptForMessage &&
          (reactData.messageType !== 'group') &&
          <MakeMessage
            titleText={`Message to ${reactData.recipient.split(':')[0]}`}
            promptText={['Subject', `What should your message say?`]}
            promptUse={['subject', 'message']}
            seedText={[
              (reactData.messageSubject || `${pOccData.description} ${pOccData.occurrence_date ? makeDate(pOccData.occurrence_date).relative : ''}`),
              (reactData.messageText || '')
            ]}
            buttonText={'Send'}
            sender={{
              "client_id": state.session.client_id,
              "patient_id": state.session.patient_id,
              "patient_display_name": state.session.patient_display_name
            }}
            pRecipientID={reactData.recipient.split(':')[1]}
            pRecipientName={reactData.recipient.split(':')[0]}
            onCancel={() => {
              updateReactData({
                promptForMessage: false
              }, true);
            }}
            onComplete={() => {
              updateReactData({
                promptForMessage: false
              }, true);
            }}
            setMethod={null}
            allowCancel={true}
          />
        }
        {reactData.promptForMessage &&
          (reactData.messageType === 'group') &&
          <MakeMessage
            titleText={`Message to everyone signed-up for ${pOccData.description} - ${pOccData.occurrence_date ? makeDate(pOccData.occurrence_date).relative : ''}`}
            promptText={['Subject', `What should your message say?`]}
            promptUse={['subject', 'message']}
            seedText={[
              (reactData.messageSubject || `${pOccData.description} ${pOccData.occurrence_date ? makeDate(pOccData.occurrence_date).relative : ''}`),
              (reactData.messageText || '')
            ]}
            buttonText={'Send'}
            sender={{
              "client_id": state.session.client_id,
              "patient_id": state.session.patient_id,
              "patient_display_name": state.session.patient_display_name
            }}
            pRecipientID={Array.isArray(reactData.recipient) ? reactData.recipient.map(r => { return r.split(':')[1]; }) : [reactData.recipient.split(':')[1]]}
            pRecipientName={Array.isArray(reactData.recipient) ? reactData.recipient.map(r => { return r.split(':')[0]; }) : [reactData.recipient.split(':')[0]]}
            onCancel={() => {
              updateReactData({
                promptForMessage: false
              }, true);
            }}
            onComplete={() => {
              updateReactData({
                promptForMessage: false
              }, true);
            }}
            setMethod={null}
            allowCancel={true}
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
            onSave={async (updatedValues) => {
              reactData.editInfoErrorList = [];
              let updatedDate = makeDate(updatedValues[2]);
              let reactUpdates = {};
              if (updatedDate.error) {
                reactUpdates.editInfoErrorList = ['', '', 'Please enter a valid date'];
              }
              else {
                reactUpdates.editEventInfo = false;
                let newDescription = ((pOccData.description !== updatedValues[0]) ? updatedValues[0] : null);
                let newLocation = ((pOccData.location !== updatedValues[1]) ? updatedValues[1] : null);
                let OGDate = (pOccData.date ? makeDate(pOccData.date) : { error: true });
                let newDate = ((OGDate.numeric$ !== updatedDate.numeric$) ? updatedDate.numeric$ : null);
                let newTime = ((pOccData.time$ !== updatedValues[3]) ? updatedValues[3] : null);
                if (newDescription || newLocation || newDate || newTime) {
                  let messageSubject = pOccData.description;
                  if (!OGDate.error) {
                    messageSubject += ` scheduled for ${OGDate.absolute}`;
                  }
                  let messageText = `The ${pOccData.description} has been rescheduled.  It is now scheduled for ${updatedValues[3] ? updatedValues[3] + ' ' : ''}${updatedDate.absolute_full}`;
                  let needsMessage = await handleUpdateEvent([newDescription, newLocation, newDate, newTime]);
                  if (needsMessage) {
                    let filteredList = eventSlotList.filter(e => {
                      return (e.slotData.status !== 'released');
                    });
                    Object.assign(reactUpdates, {
                      promptForMessage: true,
                      messageSubject: messageSubject,
                      messageText: messageText,
                      messageType: 'group',
                      recipient: (filteredList.map(e => {
                        return `${e.slotData.display_name}:${e.slotData.id}`;
                      }))
                    });
                  }
                }
              }
              updateReactData(reactUpdates, true);
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
        {reactData.selectAssignTo &&
          <PersonFilter
            prompt={'Assign to whom?'}
            peopleList={reactData.choiceList}
            multiSelect={false}
            onCancel={() => {
              updateReactData({
                selectAssignTo: false,
                choiceList: []
              }, true);
            }}
            onSelect={async (selectedPerson) => {
              let currentTime = makeDate(new Date());
              let assigned_to = selectedPerson.split(':')[1];
              let assigned_to_name = await makeName(assigned_to);
              let putSR = {
                client: state.session.client_id,
                author: state.session.patient_id,
                proxy_user: state.session.user_id,
                requestType: 'checklist',
                activity_key: "",
                onBehalfOf: state.session.patient_display_name,
                foreign_key: pEventCode,
                history: [`Checklist assigned to ${assigned_to_name} ${currentTime.oaDate}`],
                assign_to: assigned_to,
                last_status: 'assigned',
                request: {},
                messaging: {}
              };
              let result = await putServiceRequest(putSR);
              result.assigned_to_name = assigned_to_name;
              let messageText = `${state.session.patient_display_name} has assigned you to "${pOccData.description}" - ${makeDate(pOccData.date).relative}`;
              let messageObj = {
                client: state.session.client_id,
                author: state.session.patient_id,
                messageText: messageText,
                thread_id: `svc_checklist/${result.request_id}`,
                recipientList: [assigned_to],
                subject: `${pOccData.description} assigned to you`
              };
              await sendMessages(messageObj);
              updateReactData({
                selectAssignTo: false,
                popupMenuOpen: false,
                choiceList: [],
                attachedSR: result
              }, true);
            }}
          />
        }
        {!loading &&
          <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
            <Box display='flex' flexDirection='column'>
              <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                <Tooltip title={`Exit`} placement='top'>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white', marginBottom: '-12px', marginLeft: '16px', marginRight: '16px' }}
                    size='small'
                    onClick={() => {
                      let summaryInfo = {
                        totalSlots: 0,
                        ownedSlots: 0,
                        markedSlots: 0,
                        listComplete: false,
                        slot_owners: {}
                      };
                      if (eventSlotList) {
                        eventSlotList.forEach(s => {
                          if (s.slotData) {
                            summaryInfo.totalSlots++;
                            if (s.slotData.owner) {
                              summaryInfo.ownedSlots++;
                              summaryInfo.slot_owners[s.slotData.owner] = s.slotData.id;
                            }
                            if (s.marked) {
                              summaryInfo.markedSlots++;
                            }
                          }
                        });
                        summaryInfo.listComplete = ((summaryInfo.ownedSlots > 0) && (summaryInfo.markedSlots >= summaryInfo.ownedSlots));
                      }
                      pOccData.summaryInfo = summaryInfo;
                      onReset(pOccData);
                    }}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Done'}
                  </Button>
                </Tooltip>
                {((!ownerOfSlots && !pViewOnly) || isEventOwner) &&
                  (!['time', 'seats'].includes(pOccData.signup_type)) &&
                  <Tooltip title={'Add to the list'} placement='top'>
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'blue', color: 'white', marginBottom: '-12px', marginLeft: '16px', marginRight: '16px' }}
                      size='small'
                      onClick={async () => {
                        console.log(firstAvailableSlot);
                        if (isEventOwner) {
                          setEditSlot(true);
                          await setChoices(peopleList);
                          setSelectNewSlotOwner(true);
                        }
                        else {
                          let pName = await makeName(pPatient);
                          let request = { person: `${pName}:${pPatient}` };
                          await handleAllocateSlot(request);
                          setOwnerOfSlots(true);
                          if (pOccData.signup_type !== 'none') {
                            request.slot = firstAvailableSlot;
                          }
                        }
                      }}
                      startIcon={<PersonAddIcon size="small" />}
                    >
                      {isEventOwner ? `Add someone` : `Add myself`}
                    </Button>
                  </Tooltip>
                }
              </Box>
            </Box>
          </DialogActions>
        }
      </React.Fragment>
    </Dialog >
  );
};