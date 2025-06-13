import React from 'react';
import { addDays, makeDate, makeTime } from '../../util/AVADateTime';
import { getSlotList, writeSlot, makeSlotName, myAvailability, printOccurrenceSheet } from '../../util/AVACalendars';
import { getMemberList } from '../../util/AVAGroups';
import { cl, makeArray, dbClient, isEmpty, deepCopy, titleCase, isMobile, recordExists } from '../../util/AVAUtilities';
import { makeName, getImage, getPerson } from '../../util/AVAPeople';
import { sendMessages } from '../../util/AVAMessages';
import { putServiceRequest } from '../../util/AVAServiceRequest';
import MakeMessage from './MakeMessage';
import FormFillB from './FormFillB';

import { Alert, AlertTitle } from '@material-ui/lab/';
import { Snackbar } from '@material-ui/core';

import { useGeolocated } from "react-geolocated";
import { SearchPlaceIndexForPositionCommand, LocationClient } from '@aws-sdk/client-location';
import { withAPIKey } from '@aws/amazon-location-utilities-auth-helper';

import List from '@material-ui/core/List';
import Button from '@material-ui/core/Button';
import Tooltip from '@material-ui/core/Tooltip';
import AlarmAddIcon from '@material-ui/icons/AlarmAdd';
import TimerOffIcon from '@material-ui/icons/TimerOff';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';

import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import Checkbox from '@material-ui/core/Checkbox';
import FormGroup from '@material-ui/core/FormGroup';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import PrintIcon from '@material-ui/icons/Print';
import StorageOutlined from '@material-ui/icons/StorageOutlined';
import SendIcon from '@material-ui/icons/Send';
import AssignmentTurnedInIcon from '@material-ui/icons/AssignmentTurnedIn';
import RestoreIcon from '@material-ui/icons/Restore';
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
  formControlDays: {
    margin: 0,
    marginLeft: '-8px',
    marginRight: '2px',
    paddingTop: 0,
    height: 1,
    fontSize: theme.typography.fontSize * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '10px',
    marginBottom: '25px',
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
    marginBottom: theme.spacing(1),
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
    margin: '10px'
  },
  clientPopUpWithPadding: {
    borderRadius: '30px 30px 30px 30px',
    padding: '10px'
  },
  messageArea: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(0.5),
    marginBottom: theme.spacing(0),
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
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

export default ({ pEventCode, pEvent, peopleList, pPatient, pSignUps, pViewOnly = false, pClient, pOccData, defaultValues, onReset, pMode }) => {

  const { state } = useSession();

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const [eventSlotList, setEventSlotList] = React.useState([]);

  const [selectNewSlotOwner, setSelectNewSlotOwner] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [editSlot, setEditSlot] = React.useState();

  const [editNoteNumber, setEditNoteNumber] = React.useState(-1);
  const [newNote, setNewNote] = React.useState('');

  const isEventOwner = pOccData?.owner?.includes(pPatient)
    || ['master', 'support'].includes(state.patient.account_class);

  const checkSignupWindow = () => {
    let response = {
      open: true,
      start: null,
      end: null
    };
    if (!isEmpty(pOccData.signup_window?.start)) {
      let windowStart = addDays(pOccData.date, -pOccData.signup_window.start);
      response.start = makeDate(windowStart).relative;
      if (windowStart > new Date()) {
        response.open = false;
        response.issue = 'start';
        return response;
      }
    }
    if (!isEmpty(pOccData.signup_window?.end)) {
      let windowEnd = addDays(pOccData.date, -pOccData.signup_window.end);
      response.end = makeDate(windowEnd).relative;
      if (windowEnd < new Date()) {
        response.open = false;
        response.issue = 'end';
        return response;
      }
    }
    return response;
  };

  const [loading, setLoading] = React.useState(true);

  const isWaitListed = (pPatient) => {
    return reactData.waitList.includes(pPatient);
  };

  const [ownerOfSlots, setOwnerOfSlots] = React.useState(false);
  const [firstAvailableSlot, setFirstAvailableSlot] = React.useState();

  const [reactData, setReactData] = React.useState({
    promptForMessage: '',
    messageType: null,
    recipient: null,
    messageRecipientIDs: false,
    messageRecipientNames: false,
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
    numberOfOwnedSlots: 0,
    signup_window: checkSignupWindow(),
    waitList: pOccData.wait_list || [],
    editWaitList: false,
    editForm: false
  });

  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  const [anchorEl, setAnchorEl] = React.useState(null);

  const {
    coords,
    getPosition,
    isGeolocationAvailable,
    isGeolocationEnabled,
    positionError,
  } = useGeolocated({
    positionOptions: {
      enableHighAccuracy: true,
    },
    userDecisionTimeout: 5000,
    watchLocationPermissionChange: true,
  });

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

  const setChoices = async ({ pGroups, noCurrent }) => {
    // if (reactData.choiceList.length > 0) { return; }
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
    let pLL = memberInfo.peopleList.length;
    for (let e = 0; e < pLL; e++) {
      let mInfo = {};
      let p = memberInfo.peopleList[e];
      if (noCurrent && reactData.slotOwnerList.includes(p.person_id)) {
        continue;
      }
      let searchString = [...Object.values(p.name), p.search_data, p.location].join(' ');
      if (p.messaging) {
        searchString += Object.values(p.messaging).join(' ');
      }
      try {
        mInfo.display_name = `${p.name.last}, ${p.name.first}`;
        let conflictInfo = [];
        if (reactData.signUpObject.hasOwnProperty(p.person_id)) {
          reactData.signUpObject[p.person_id].forEach(o => {
            if (o.occurrence_date === pOccData.date) {
              let timeText = '';
              if ((o.start_time24 === 0) && (o.end_time24 === 2359)) {
                timeText += 'All day';
              }
              else {
                if (o.start_time24 === 0) {
                  timeText += 'Until';
                }
                else {
                  timeText += `${makeTime(o.start_time24).short}`;
                }
                if (o.end_time24 !== 2359) {
                  timeText += `-${makeTime(o.end_time24).short}`;
                }
              }
              conflictInfo.push(`${timeText} ${o.event_description}`);
            }
          });
          if (conflictInfo) {
            mInfo.conflict = conflictInfo;
          }
        }
        mInfo.person_id = p.person_id;
        mInfo.searchString = searchString;
        response.push(deepCopy(mInfo));
      }
      catch (error) {
        cl(`response push error at index ${e} with ${mInfo}`);
      }
    };
    updateReactData({
      choiceList: response
    }, false);
  };

  async function getDoc(this_doc) {
    const docRec = await dbClient
      .get({
        Key: { document_id: this_doc },
        TableName: 'DocumentMaster'
      })
      .promise()
      .catch(error => {
        cl(`Bad get from DocumentMaster while building document list in form assignment. Error is: ${error}`);
      });
    if (recordExists(docRec)) {
      if (!docRec.Item.title && !docRec.Item.document_title) {
        const formRec = await dbClient
          .get({
            Key: {
              client_id: pClient,
              form_id: docRec.Item.form_type
            },
            TableName: 'Forms'
          })
          .promise()
          .catch(error => {
            cl(`Bad get from Forms while building document list in form assignment. Error is: ${error}`);
          });
        if (recordExists(formRec)) {
          docRec.Item.title = formRec.Item.form_name;
        }
        else {
          docRec.Item.title = docRec.Item.form_type;
        }
      }
      return docRec.Item;
    }
    else {
      return null;
    }
  }

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
    for (let this_owner in slotInfo.slotObj) {
      let docRecs = [];
      let docStatus = 'complete';
      if (slotInfo.slotObj[this_owner].documents && (slotInfo.slotObj[this_owner].documents.length > 0)) {
        for (let this_doc of slotInfo.slotObj[this_owner].documents) {
          let dR = await getDoc(this_doc);
          if (!isEmpty(dR)) {
            if (!dR.title && !dR.document_title) {
              const formRec = await dbClient
                .get({
                  Key: {
                    client_id: pClient,
                    form_id: dR.form_type
                  },
                  TableName: 'Forms'
                })
                .promise()
                .catch(error => {
                  cl(`Bad get from Forms while building document list in form assignment. Error is: ${error}`);
                });
              if (recordExists(formRec)) {
                dR.title = formRec.Item.form_name;
              }
              else {
                dR.title = formRec.Item.form_type;
              }
            }
            if (dR.status === 'not_started') {
              docStatus = 'not_started';
            }
            else if ((dR.status !== 'complete') && (docStatus !== 'not_started')) {
              docStatus = dR.status;
            }
            docRecs.push(dR);
          }
        }
      }
      slotInfo.slotObj[this_owner].docRecs = docRecs;
      slotInfo.slotObj[this_owner].docStatus = docStatus;
    }
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
    let slotOwnerList = slotList.map(this_slot => {
      return this_slot.slotData.owner;
    });
    updateReactData({
      slotOwnerList
    }, false);
    setOwnerOfSlots(checkOwnership);
    setFirstAvailableSlot(firstAvailableChoice);
    setEventSlotList(slotList);
    setReactData(reactData);
    return slotList;
  };

  const getMarker = async () => {
    getPosition();
    let newText;
    if (!isEmpty(positionError)) {
      newText = `Location Error ${JSON.stringify(positionError)}`;
    }
    else if (!isGeolocationAvailable) {
      newText = "Device doesn't support location ID";
    }
    else if (!isGeolocationEnabled) {
      newText = `User blocked location ID`;
    }
    else {
      newText = await reverseGeo({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy
      });
    }
    return {
      location: newText,
      timestamp: new Date().getTime()
    };
  };

  const reverseGeo = async ({ latitude, longitude, accuracy }) => {
    const authHelper =
      await withAPIKey("v1.public.eyJqdGkiOiJiOTFjN2E0My1mZTNlLTQxMzctYTIyMy00YWI2YTE2NjUxZDUifToPc5592CrSHhW1JSbATtnjGoJDzqJYD-7AK7ExQpcAtmfRb-ofIy9TciExqtsveXreYKYPBoGKj8IIpESh8jhu8WcHmPHzYyPwjdMLEj2oc78daTQeGqw41QI-okSYoUMVCRBwO9eGiLsU2adjFXwSNlcs85lz_XAaYLAAKZODPOFTKk4sgI2kJ5queq9aHj4HjOOJfPwWmJZAqP-oTs2TLp-N95yBVllyU7-_6S3QXOI97rSAy5ABj-7fJMZTtXRrb6zw6sv8pJPKjZegaeM8V2oP4fQBMC4bC746aYaNT6SiVtTzIU8tdmrYgHmgkzbSxw_VZSp-UF8_OQIiNwQ.ZWU0ZWIzMTktMWRhNi00Mzg0LTllMzYtNzlmMDU3MjRmYTkx");
    const locationClient = new LocationClient({
      region: "us-east-1",
      ...authHelper.getLocationClientConfig() // sets up the Location client to use the API Key defined above
    });
    let response = await locationClient.send(new SearchPlaceIndexForPositionCommand({
      IndexName: "explore.place.Here", // Place index resource to use
      Position: [longitude, latitude], // position to search near
      MaxResults: 3 // number of results to return
    }));
    if (!response || !response.Results || (response.Results.length === 0)) {
      return `at ${formatDegrees(latitude, false)}, ${formatDegrees(longitude, true)}`;
    }
    else {
      let selectedResponse = response.Results.find(result => {
        return (result.Place.AddressNumber);
      });
      if (!selectedResponse) {
        selectedResponse = response.Results[0];
      }
      let textResponse = 'At';
      let netAccuracy = selectedResponse.Distance + accuracy;
      if (netAccuracy > 10) {
        let calcAccuracyFeet = netAccuracy * 3.28;
        if (calcAccuracyFeet > 1000) {
          textResponse = `Within ${Math.round((calcAccuracyFeet / 5280) * 10) / 10} miles of`;
        }
        else {
          textResponse = `Within ${Math.round(calcAccuracyFeet)} feet of`;
        }
      }
      textResponse += ` ${selectedResponse.Place.Label}`;
      return textResponse;
    }
  };

  const getHistoryTimes = (this_item) => {
    let currentHistory = this_item.slotData.status.history;
    let foundTimes = ['no Value', 'no Value'];
    if (!currentHistory || isEmpty(currentHistory)) {
      return foundTimes;
    }
    currentHistory.some(h => {
      if (h.action === 'Checked out') {
        foundTimes[1] = makeDate(h.timestamp).timeOnly;
      }
      else if (h.action === 'Checked in') {
        foundTimes[0] = makeDate(h.timestamp).timeOnly;
        return true;
      }
      return false;
    });
    return foundTimes;
  };

  const getDirection = (degrees, isLongitude) =>
    degrees > 0 ? (isLongitude ? "E" : "N") : isLongitude ? "W" : "S";

  const formatDegrees = (degrees, isLongitude) =>
    `${0 | degrees}° ${0 | (((degrees < 0 ? (degrees = -degrees) : degrees) % 1) * 60)
    }' ${0 | (((degrees * 60) % 1) * 60)}" ${getDirection(
      degrees,
      isLongitude,
    )}`;

  const handleUpdateWaitList = async (waitList) => {
    let qQ = {
      Key: {
        "client": pClient,
        "event_key": pEventCode
      },
      UpdateExpression: `set wait_list = :w`,
      ExpressionAttributeValues: { ':w': waitList },
      TableName: "Calendar"
    };
    await dbClient
      .update(qQ)
      .promise()
      .catch(error => {
        cl(`caught error updating Calendar for ${qQ.Key.event_key}; error is: `, error);
      });
  };

  const determineMode = (docRec) => {
    if (docRec.hasOwnProperty('incomplete')) {
      if (typeof docRec.incomplete === 'boolean') {
        return 'incomplete';
      }
      else if ((docRec.incomplete === 'true')
        || (docRec.incomplete === 'incomplete')) {
        return 'incomplete';
      }
      else if (docRec.incomplete === 'not_started') {
        return 'not_started';
      }
    }
    return 'view';
  };

  const handleAllocateSlot = async (body) => {
    let pPerson, pSlot, pRelease, pIndex;

    if (body.release) { pRelease = body.release; }
    else { pRelease = false; }
    if (body.hasOwnProperty('index')) {
      pIndex = body.index;
    }
    let workingList = eventSlotList;
    let whereToGo = -1;
    pPerson = makeArray(body.person);
    for (let p = 0; p < pPerson.length; p++) {
      let nArray = pPerson[p].split(/:|%%/);
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
      if (body.guests) { writeRequest.guests = body.guests; }




      if (pEvent) {
        if (pEvent.hasOwnProperty('default_forms')) {
          writeRequest.default_forms = deepCopy(pEvent.default_forms);
        }
        if (pEvent.hasOwnProperty('customizations')) {
          writeRequest.customizations = deepCopy(pEvent.customizations);
        }
        if (!reactData.defaultValues.message_override) {
          writeRequest.no_messaging = false;
        }
        else {
          let overrideList = makeArray(reactData.defaultValues.message_override);
          if (overrideList.some(oItem => {
            return oItem.toLowerCase().startsWith('*none');
          })) {
            writeRequest.no_messaging = true;
          }
          else if (overrideList.some(oItem => {
            return oItem.toLowerCase().startsWith('*published');
          })) {
            if (!pEvent.published) {
              writeRequest.no_messaging = true;
            }
            else {
              // event is already published and this instruction asks to message people only when published...
              writeRequest.no_messaging = false;
              writeRequest.overrideRecipient = [];
              for (const this_person of overrideList) {
                let instruction = this_person.split('=');
                if (instruction[0].startsWith('*published')) {
                  instruction[0] = instruction[1];
                }
                if (instruction) {
                  if (instruction[0].startsWith('slot')) {
                    writeRequest.overrideRecipient.push(newPersonID);
                  }
                  else if (instruction[0].startsWith('event')) {
                    writeRequest.overrideRecipient.push(...makeArray(pEvent.owner));
                  }
                  else {
                    writeRequest.overrideRecipient.push(instruction[0]);
                  }
                }
              }
              if (writeRequest.overrideRecipient.length === 0) {
                writeRequest.overrideRecipient.push(newPersonID);
              }
              writeRequest.override_subject = `Changes have been made to ${pEvent.description} (${makeDate(pEvent.occurrence_date, { noTime: true }).absolute}) that affect you`;
              writeRequest.override_messageText = `${newPersonName} has been added to this event.`;
            }
          }
          else {
            writeRequest.no_messaging = false;
            writeRequest.overrideRecipient = overrideList;
          }
        }
      }
      let slotInfo = await writeSlot(writeRequest);
      whereToGo = -1;
      if (pRelease) {
        if (pSlot !== newPersonID) {
          let updatedSlotData = Object.assign(workingList[pIndex].slotData, {
            name: '',
            owner: '',
            notes: '',
            guests: (pEvent?.number_of_guests ? new Array(pEvent.number_of_guests) : [])
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
              guests: body.guests,
              slot_description: workingList[whereToGo].slotData.slot_description,
              slot_sort: workingList[whereToGo].slotData.slot_sort,
              documents: slotInfo.documents || null
            }
          };
        }
        else {
          whereToGo = workingList.push({
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
              notes: body.notes,
              guests: body.guests,
              documents: slotInfo.documents || null
            }
          });
          whereToGo--;
        }
      }
    };
    setEventSlotList(workingList);
    setForceRedisplay(!forceRedisplay);
    return whereToGo;
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
      let timeStart;
      let timeEnd;
      let delimiters = ['to', '-', 'through', 'thru', 'until'];
      let foundIt = delimiters.findIndex(d => newTime.toLowerCase().includes(` ${d} `));
      if (foundIt > -1) {
        let [newFrom, newTo] = newTime.toLowerCase().split(` ${delimiters[foundIt]} `);
        timeStart = makeTime(newFrom);
        timeEnd = makeTime(newTo);
        pOccData.time.duration = timeEnd.minutesSinceMidnight - timeStart.minutesSinceMidnight;
      }
      else {
        timeStart = makeTime(newTime);
        let tempEnd = timeStart.minutesSinceMidnight + (pOccData.time.duration || 0);
        let tempMM = tempEnd % 60;
        tempEnd -= tempMM;
        let tempHH = Math.trunc(tempEnd / 60) % 24;
        timeEnd = makeTime((tempHH * 100) + tempMM);
      }
      expressionAttributeValues[':t'] = {
        allDay: pOccData.time.allDay,
        duration: pOccData.time.duration,
        from_minutesSinceMidnight: timeStart.minutesSinceMidnight,
        from: timeStart.time,
        to: timeEnd.time
      };
      pOccData.time = {
        allDay: pOccData.time.allDay,
        duration: pOccData.time.duration,
        from_minutesSinceMidnight: timeStart.minutesSinceMidnight,
        from: timeStart.time,
        to: timeEnd.time
      };
      pOccData.time$ = `${timeStart.time} to ${timeEnd.time}`;
      pOccData.time24 = timeStart.numeric24;
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
      updateReactData({
        alert: {
          severity: 'success',
          message: `Event info updated!`,
        }
      }, true);
    }
    else {
      updateReactData({
        alert: {
          severity: 'error',
          message: `AVA could not update the Event info`,
        }
      }, true);
    }
    return (needsSlotUpdates || needsSlotTimeMessage);
  };

  const checkOtherOccurrences = async () => {
    let this_event = pEventCode;
    let [this_eventID, this_occurrence] = this_event.split('#');
    let other_occurrences = [];
    // does this event have other occurrences?

    let queryObj = {
      TableName: 'Calendar',
      KeyConditionExpression: 'client = :c and begins_with(event_key, :eV)',
      FilterExpression: 'record_type = :t',
      ExpressionAttributeValues: {
        ':c': pClient,
        ':eV': `${this_eventID}#`,
        ':t': 'occurrence'
      }
    };
    let queryResult = await dbClient
      .query(queryObj)
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          cl(`Security Violation or no Internet Connection`);
        }
        cl(`Error reading ${queryObj.TableName} id ${error}`);
      });
    if (recordExists(queryResult)) {
      for (let this_oRec of queryResult.Items) {
        if ((this_oRec.occurrence_date !== this_occurrence) && (!this_oRec.occurrence_cancelled)) {
          other_occurrences.push(this_oRec.occurrence_date);
        }
      }
    }
    return (other_occurrences.length > 0);
  };

  const handleCancelEvent = async () => {
    let updateExpression = 'set occurrence_cancelled = :true';
    let expressionAttributeValues = { ':true': true };
    let goodUpdate = true;
    await dbClient
      .update({
        Key: {
          "client": pClient,
          "event_key": pEventCode
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
    // remove all the slots
    if (goodUpdate) {
      if (eventSlotList && (eventSlotList.length > 0)) {
        let recipientList = [];
        for (const [index, this_item] of eventSlotList.entries()) {
          if (this_item.slotData?.status?.current?.selected) {
            recipientList.push(this_item.slotData.owner);
          }
          await handleAllocateSlot({
            person: `${this_item.slotData.name}%%${this_item.slotData.owner}`,
            slot: this_item.slotData.id,
            release: true,
            index: (index || 0)
          });
        };
        if (recipientList.length > 0) {
          let messageText = `${pOccData.description} ${makeDate(pOccData.date).relative} has been cancelled`;
          let messageObj = {
            client: state.session.client_id,
            author: state.session.patient_id,
            messageText: messageText,
            thread_id: `cancel_${pEventCode}`,
            recipientList: eventSlotList.map(),
            subject: `${pOccData.description} ${makeDate(pOccData.date).relative} has been cancelled`
          };
          await sendMessages(messageObj);
        }
      }
    }
    else {
      updateReactData({
        alert: {
          severity: 'error',
          message: `AVA could not cancel the Event`,
        }
      }, true);
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

  const handleChangeGuests = async (updatedIndex, pGuests) => {
    eventSlotList[updatedIndex].slotData.guests = pGuests;
    let slotUpdate = Object.assign(
      {},
      eventSlotList[updatedIndex],
      eventSlotList[updatedIndex].slotData,
      {
        event: eventSlotList[updatedIndex].event_key,
        client: pClient
      }
    );
    slotUpdate.status = 'guests';
    slotUpdate.no_messaging = true;
    await writeSlot(slotUpdate);
    setEventSlotList(eventSlotList);
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
      classes={{ paper: classes.clientPopUp }}
      p={2}
    >
      <React.Fragment>
        {/* Screen header - Description, Date, Location... */}

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
              updateReactData({
                alert: {
                  severity: 'notification',
                  message: `AVA event = ${pEventCode}`,
                }
              }, true);
            }}
          >
            {loading &&
              <Typography style={AVATextStyle({ size: 1.5, margin: { bottom: 2 } })} >{`Loading`}</Typography>
            }
            <Typography style={AVATextStyle({ size: 1.5, bold: true })} >
              {titleCase(pOccData.description)}
            </Typography>
            {pOccData.date &&
              <Typography className={classes.standardIndent} style={AVATextStyle({ margin: { left: 1, right: 1 } })} >
                {`${makeDate(pOccData.date).relative}${(!isEmpty(pOccData.time)) ? ' - ' + pOccData.time$ : ''}`}
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
            {(!isEventOwner && !reactData.signup_window.open) &&
              <Typography className={classes.standardIndent} style={AVATextStyle({ color: 'red', bold: true, margin: { left: 1, right: 1 } })} >
                {(reactData.signup_window.issue === 'start')
                  ? `Sign-up begins ${reactData.signup_window.start}`
                  : `Sign-up ended ${reactData.signup_window.end}`
                }
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
            minWidth={isMobile ? 30 : 50}
            minHeight={isMobile ? 30 : 50}
            maxHeight={isMobile ? 30 : 50}
            alignSelf={'flex-start'}
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
                      await setChoices({ pGroups: peopleList });
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
                      await setChoices({ pGroups: reactData.defaultValues.allowAssign });
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
                        return (e.slotData.status === 'selected');
                      });
                      updateReactData({
                        promptForMessage: true,
                        popupMenuOpen: false,
                        messageType: 'group',
                        recipient: (filteredList.map(e => {
                          return `${e.slotData.display_name}%%${e.slotData.owner}`;
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
                  onClick={async () => {
                    let othersExist = await checkOtherOccurrences();
                    if (!othersExist) {
                      updateReactData({
                        popupMenuOpen: false,
                        cancelPending: true,
                      }, true);
                    }
                    else {
                      updateReactData({
                        popupMenuOpen: false,
                        alert: {
                          severity: 'warning',
                          title: `This event has multiple occurences`,
                          message: <div>
                            How would you like to proceed?<br />
                            You may: <br />
                            Cancel <strong>only this event</strong> and leave the others alone<br />
                            Cancel <strong>all occurrences</strong>, or<br />
                            <strong>Don't cancel anything</strong> and go back</div>,
                          action: [
                            {
                              text: `Only this one`,
                              function: (async () => {
                                await handleCancelEvent();
                                reactData.cancelPending = false;
                                setReactData(reactData);
                                setForceRedisplay(!forceRedisplay);
                                onReset({ event_cancelled: true });
                              })
                            },
                            {
                              text: `All of them`,
                              function: (async () => {
                                await handleCancelEvent();
                                let eventID = pEventCode.split('#')[0];
                                for (let next_event of reactData.other_occurrences) {
                                  pEventCode = `${eventID}#${next_event}`;
                                  await handleCancelEvent();
                                }                                
                                reactData.cancelPending = false;
                                setReactData(reactData);
                                setForceRedisplay(!forceRedisplay);
                                onReset({ event_cancelled: true });
                              })
                            },
                            {
                              text: `Go Back`,
                              function: () => {
                                updateReactData({
                                  ask_cancelSeries: false,
                                  alert: false
                                }, true);
                              }
                            }
                          ]
                        }
                      }, true)
                    }
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

        {/* Slots */}
        <Paper component={Box} className={classes.page} elevation={0} overflow='auto' square>
          <List  >
            {eventSlotList && eventSlotList.length > 0 && eventSlotList.map((this_item, index) => (
              (!this_item.slotData.hasOwnProperty('show_this_slot') || this_item.slotData.show_this_slot) &&
              <Box display='flex' flexDirection='row' alignItems='center'
                key={`slotLine_${index}`}
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
                      flexDirection='row'
                      flexWrap='wrap'
                      justifyContent='space-between' alignItems='center'
                    >
                      <Box display='flex' mr={0} flexDirection='row' justifyContent='flex-start' alignItems='center'>
                        {/* Mark an item - Radio button */}

                        <Box minWidth={40} maxWidth={40} display='flex' mr={0} flexDirection='column' justifyContent='center' alignItems='center'>
                          {(isEventOwner || isSlotOwner(this_item.slotData)) && <Tooltip mr={0} ml={0} title={`Mark ${this_item.marked ? 'not ' : ''}attended`} >
                            <IconButton mr={0} ml={0}
                              onClick={async () => {
                                let { timestamp, location } = await getMarker();
                                let currentHistory = this_item.slotData.slotData.status.history;
                                if (!currentHistory || isEmpty(currentHistory)) {
                                  currentHistory = [];
                                }
                                currentHistory.unshift({
                                  timestamp,
                                  user: state.session.patient_id,
                                  action: `Checked ${this_item.marked ? 'out' : 'in'}`,
                                  location
                                });
                                await dbClient
                                  .update({
                                    Key: {
                                      "client": pClient,
                                      "event_key": `${pEventCode}#${this_item.slotData.id}`
                                    },
                                    UpdateExpression: 'set marked = :m, #sd.#st.#h = :h, check_in = :t',
                                    ExpressionAttributeValues: {
                                      ':m': !this_item.marked,
                                      ':h': currentHistory,
                                      ':t': (this_item.marked ? '' : timestamp)
                                    },
                                    ExpressionAttributeNames: {
                                      '#sd': 'slotData',
                                      '#st': 'status',
                                      '#h': 'history'
                                    },
                                    TableName: "Calendar"
                                  })
                                  .promise()
                                  .catch(error => { cl(`caught error updating Calendar; error is: `, error); });
                                if (this_item.marked) {
                                  eventSlotList[index].marked = false;
                                  eventSlotList[index].check_in = null;
                                }
                                else {
                                  eventSlotList[index].marked = true;
                                  eventSlotList[index].check_in = timestamp;
                                }
                                setEventSlotList(eventSlotList);
                                setForceRedisplay(!forceRedisplay);
                              }}
                            >
                              {this_item.marked
                                ? ((isSlotOwner(this_item.slotData)
                                  || (this_item.slotData.documents && (this_item.slotData.documents.length > 0)))
                                  ? <TimerOffIcon mr={0} ml={0} />
                                  : <RadioButtonCheckedIcon mr={0} ml={0} />
                                )
                                : ((isSlotOwner(this_item.slotData)
                                  || (this_item.slotData.documents && (this_item.slotData.documents.length > 0)))
                                  ? <AlarmAddIcon mr={0} ml={0} />
                                  : <RadioButtonUncheckedIcon mr={0} ml={0} />
                                )
                              }
                            </IconButton>
                          </Tooltip>}
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
                          {this_item.marked
                            && (isSlotOwner(this_item.slotData) || (this_item.slotData.documents && (this_item.slotData.documents.length > 0)))
                            && (this_item.check_in || this_item.slotData.check_in)
                            &&
                            <Typography style={AVATextStyle({
                              size: 0.5,
                              align: 'left',
                              color: 'red',
                              marginBottom: '3px'
                            })} className={classes.standard}
                            >
                              {`Checked in since ${makeDate(this_item.check_in || this_item.slotData.check_in).date.toLocaleString([], { hour: 'numeric', minute: '2-digit' })}`}
                            </Typography>
                          }
                          {/* There are notes and I am the event or slot owner 
                                OR You've asked to edit notes (which you only could do if you are the owner) */}
                          {((this_item.slotData.notes && (isEventOwner || isSlotOwner(this_item.slotData))) || (editNoteNumber === index)) &&
                            (editNoteNumber === index ?
                              <Box display='flex' mr={4} flexDirection='row' alignItems='center' flexGrow={1}>
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
                          {(isEventOwner || isSlotOwner(this_item.slotData)) &&
                            (editNoteNumber === -1) &&
                              <Box display='flex' mr={2} flexDirection='row' justifyContent='flex-start' alignItems='center'
                                key={`docTopBox_${index}_${this_item.slotData.docStatus}`}                              
                              >
                              {(isEventOwner || isSlotOwner(this_item.slotData)) &&
                                (this_item.slotData.documents) &&
                                (this_item.slotData.documents.length > 0) &&
                                <Box display='flex' mr={2}
                                  color={this_item.slotData.docStatus === 'not_started' ? 'red' : (this_item.slotData.docStatus === 'complete' ? 'green' : 'orange')}
                                    flexDirection='row' justifyContent='center' alignItems='center'
                                    key={`docMidBox_${index}_${this_item.slotData.docStatus}`}  
                                >
                                  <Tooltip title={`View documents`} >
                                    <AssignmentTurnedInIcon
                                      onClick={async () => {
                                        if (this_item.slotData.documents.length > 1) {
                                          let docRecs = [];
                                          for (const this_doc of this_item.slotData.documents) {
                                            let dR = await getDoc(this_doc);
                                            if (!isEmpty(dR)) {
                                              docRecs.push(dR);
                                            }
                                          }
                                          if (docRecs.length > 1) {
                                            updateReactData({
                                              selectForm: true,
                                              selectedDoc_id: docRecs,
                                              selectedSlotIndex: index
                                            }, true);
                                            return;
                                          }
                                          else if (docRecs.length === 1) {
                                            updateReactData({
                                              editForm: true,
                                              selectedDoc_id: docRecs[0].document_id,
                                              selectedPerson_id: docRecs[0].person_id,
                                              selectedDocMode: determineMode(docRecs[0]),
                                              selectedSlotIndex: index
                                            }, true);
                                          }
                                        }
                                        else {
                                          let docRec = await getDoc(this_item.slotData.documents[0]);
                                          if (!isEmpty(docRec)) {
                                            updateReactData({
                                              editForm: true,
                                              selectedDoc_id: this_item.slotData.documents[0],
                                              selectedPerson_id: docRec.person_id,
                                              selectedDocMode: determineMode(docRec),
                                              selectedSlotIndex: index
                                            }, true);
                                          }
                                        }
                                      }}
                                    />
                                  </Tooltip>
                                </Box>
                              }
                              {isEventOwner && !isSlotOwner(this_item.slotData) &&
                                <Box display='flex' mr={2} flexDirection='row' justifyContent='center' alignItems='center'>
                                  <Tooltip title={`Send a message to ${this_item.slotData.display_name}`} >
                                    <SendIcon
                                      onClick={() => {
                                        updateReactData({
                                          promptForMessage: true,
                                          messageType: '',
                                          recipient: (`${this_item.slotData.display_name}%%${this_item.slotData.owner}`)
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
                              {!pViewOnly &&
                                ((isEventOwner)
                                  || (isSlotOwner(this_item.slotData) && !reactData.defaultValues.prohibit_removeSelf)
                                ) &&
                                <Box display='flex' mr={2} flexDirection='row' justifyContent='center' alignItems='center'>
                                  <Tooltip title={`Remove ${isEventOwner ? this_item.slotData.display_name : 'me'}`}>
                                    <PersonAddDisabledIcon
                                      onClick={async () => {
                                        await handleAllocateSlot({
                                          person: `${this_item.slotData.name}%%${this_item.slotData.owner}`,
                                          slot: this_item.slotData.id,
                                          release: true,
                                          index: (index || 0)
                                        });
                                      }}
                                    />
                                  </Tooltip>
                                </Box>
                              }
                              {(isEventOwner && !pViewOnly) &&
                                (this_item.slotData.documents && (this_item.slotData.documents.length > 0)) &&
                                <Box display='flex' mr={2} flexDirection='row' justifyContent='center' alignItems='center'>
                                  <Tooltip title={`Update clock in/out times`}>
                                    <RestoreIcon
                                      onClick={async () => {
                                        updateReactData({
                                          editTimeEntries: Object.assign({},
                                            this_item.slotData,
                                            {
                                              index,
                                              title: `${pOccData.description} ${makeDate(pOccData.date).relative}${(!isEmpty(pOccData.time)) ? ' - ' + pOccData.time$ : ''}`,
                                              appointmentDateTimeStamp: makeDate(pOccData.date, { noTime: true }).timestamp
                                            }
                                          )
                                        }, true);
                                      }}
                                    />
                                  </Tooltip>
                                </Box>
                              }
                            </Box>
                          }
                          {/* Guests are allowed and I am the event or slot owner */}
                          {(((pOccData.number_of_guests && (pOccData.number_of_guests > 0))
                            && (isEventOwner || isSlotOwner(this_item.slotData)))) &&
                            <Box display={'flex'} flexDirection={'column'}>
                              <Typography style={AVATextStyle({ size: 0.8, margin: { top: 0.5, bottom: 0.5 } })} >
                                {`How many guests?`}
                              </Typography>
                              <Box display={'flex'} flexDirection={'row'} flexWrap={'wrap'} >
                                <FormControl className={classes.formControl} component="fieldset">
                                  <FormGroup row aria-label={`message_routedays_method`} name="method">
                                    {new Array(pOccData.number_of_guests + 1).fill('x').map((this_entry, gIndex) => (
                                      <FormControlLabel
                                        className={classes.formControlDays}
                                        key={`guest_label_${gIndex}`}
                                        control={
                                          <Checkbox
                                            className={classes.centerCenter}
                                            key={`guest_check_${gIndex}`}
                                            value={this_item.slotData.guests || 0}
                                            checked={(this_item.slotData.guests || 0) === gIndex}
                                            name={`guest_check_${gIndex}`}
                                            onClick={() => {
                                              this_item.slotData.guests = gIndex;
                                              handleChangeGuests(index, this_item.slotData.guests);
                                            }}
                                            disableRipple
                                            inputProps={{ 'aria-labelledby': `message_routing_0` }}
                                          />
                                        }
                                        label={
                                          <Typography style={AVATextStyle({ size: 0.8, margin: { top: -0.5 } })} >
                                            {gIndex}
                                          </Typography>}
                                        labelPlacement='bottom'
                                      />
                                    ))}
                                  </FormGroup>
                                </FormControl>
                              </Box>
                            </Box>
                          }
                        </Box>
                      </Box>
                    </Box>
                  }
                  {!isOwned(this_item.slotData) && (isEventOwner || (!pViewOnly && reactData.signup_window.open)) &&
                    (editNoteNumber === -1) &&
                    <Box display='flex' width='100%' pr={2} flexDirection='row' justifyContent='flex-end' alignItems='center'>
                      <Tooltip title={isEventOwner ? `Select someone` : `Add myself`}>
                        <PersonAddIcon
                          mr={2}
                          onClick={async () => {
                            if (isEventOwner) {
                              updateReactData({ editIndex: index }, false);
                              setEditSlot(true);
                              await setChoices({ pGroups: peopleList });
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
                            if (pOccData.notes_required) {
                              setEditNoteNumber(index);
                            }
                          }}
                        />
                      </Tooltip>
                    </Box>
                  }
                </Box>
              </Box>
            ))}
            {!loading && (!eventSlotList || (eventSlotList.length === 0) || (rowsWritten === 0)) &&
              <React.Fragment>
                <Box display='flex' flexWrap='wrap' flexDirection='column' flexGrow={1}>
                  <Typography style={AVATextStyle({ size: 1.8, align: 'center' })} >Nobody Yet!</Typography>
                  <Typography style={AVATextStyle({ size: 0.8, align: 'center' })} >
                    {isEventOwner ? `Tap "Add Someone" below` : `Tap "Add Myself" below`}
                  </Typography>
                </Box>
              </React.Fragment>
            }
          </List>
        </Paper>
        {reactData.editForm &&
          <FormFillB
            request={{
              document_id: reactData.selectedDoc_id,
              person_id: reactData.selectedPerson_id,
              mode: reactData.selectedDocMode,
            }}
          onClose={(response) => {
            console.log(response);
            if ((response === 'docAdded') && (reactData.selectedSlotIndex || (reactData.selectedSlotIndex === 0))) {
              eventSlotList[reactData.selectedSlotIndex].docStatus = 'complete';
            }
              updateReactData({
                editForm: false,
                selectedSlotIndex: false
              }, true);
            onReset({ no_change: true });
            }}
          />
        }
        {reactData.selectForm &&
          <AVATextInput
            titleText='Which form?'
            buttonText='Continue'
            promptText={reactData.selectedDoc_id.map(d => {
              return `[checkbox]${d.title || d.document_title}`;
            })}
            options={{ selectOne: true }}
            onCancel={() => {
              updateReactData({
                selectForm: false
              }, true);
            }}
            onSave={async (selectedForm) => {
              let ndx = selectedForm.findIndex(f => f === 'checked');
              let foundDoc = reactData.selectedDoc_id[ndx];
              updateReactData({
                selectForm: false,
                editForm: true,
                selectedDoc_id: foundDoc.document_id,
                selectedPerson_id: foundDoc.pertains_to || foundDoc.person_id || state.session.patient_id,
                selectedDocMode: determineMode(foundDoc)
              }, true);
            }}
          />
        }
        {selectNewSlotOwner &&
          <PersonFilter
            prompt={`Who are you adding?`}
            splitter={'%%'}
            peopleList={reactData.choiceList}
            multiSelect={!editSlot}
            onCancel={() => {
              setSelectNewSlotOwner(false);
            }}
            onSelect={async (selectedPerson) => {
              setSelectNewSlotOwner(false);
              let nArray = selectedPerson.split('%%');
              let pID = nArray[Math.min(1, nArray.length - 1)];
              let availability_list = await (myAvailability(
                {
                  check_date: pOccData.date,
                  check_person_id: pID,
                  check_client: state.session.client_id
                }
              ));
              console.log(availability_list);
              let slotObj = { person: selectedPerson };
              let newSlotStart24;
              let newSlotEnd24;
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
                  newSlotStart24 = 0;
                  newSlotEnd24 = 2359;
                }
                else {
                  slotObj.slot = eventSlotList[listIndex].slotData.id;
                  slotObj.index = listIndex;
                  newSlotStart24 = eventSlotList[listIndex].slotData.slot_start_time24;
                  newSlotEnd24 = eventSlotList[listIndex].slotData.slot_end_time24;
                }
                if (!reactData.signUpObject.hasOwnProperty(pID)) {
                  reactData.signUpObject[pID] = [];
                }
                reactData.signUpObject[pID].push(Object.assign({},
                  {
                    occurrence_date: pOccData.occurrence_date,
                    event_id: pOccData.event_id,
                    event_description: pOccData.description,
                    start_time24: newSlotStart24,
                    end_time24: newSlotEnd24
                  },
                ));
                updateReactData({
                  signUpObject: reactData.signUpObject
                }, false);
              }
              await handleAllocateSlot(slotObj);
            }}
          >
          </PersonFilter>
        }
        {reactData.promptForMessage &&
          (reactData.messageType !== 'group') &&
          <MakeMessage
            titleText={`Message to ${reactData.recipient.split('%%')[0]}`}
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
            pRecipientID={reactData.messageRecipientIDs
              || (Array.isArray(reactData.recipient)
                ? reactData.recipient.map(r => { return r.split('%%')[1]; })
                : [reactData.recipient.split('%%')[1]])
            }
            pRecipientName={reactData.messageRecipientNames
              || (Array.isArray(reactData.recipient)
                ? reactData.recipient.map(r => { return r.split('%%')[0]; })
                : [reactData.recipient.split('%%')[0]])
            }
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
            pRecipientID={reactData.messageRecipientIDs
              || (Array.isArray(reactData.recipient)
                ? reactData.recipient.map(r => { return r.split('%%')[1]; })
                : [reactData.recipient.split('%%')[1]])
            }
            pRecipientName={reactData.messageRecipientNames
              || (Array.isArray(reactData.recipient)
                ? reactData.recipient.map(r => { return r.split('%%')[0]; })
                : [reactData.recipient.split('%%')[0]])
            }
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
              (isEmpty(pOccData.time) ? null : pOccData.time$)
            ]}
            onCancel={() => {
              reactData.editInfoErrorList = [];
              reactData.editEventInfo = false;
              setReactData(reactData);
              setForceRedisplay(!forceRedisplay);
            }}
            onSave={async (updatedValues) => {
              reactData.editInfoErrorList = [];
              let updatedDate = makeDate(updatedValues[2], { noTime: true });
              let reactUpdates = {};
              if (updatedDate.error) {
                reactUpdates.editInfoErrorList = ['', '', 'Please enter a valid date'];
              }
              else {
                reactUpdates.editEventInfo = false;
                let newDescription = ((pOccData.description !== updatedValues[0]) ? updatedValues[0] : null);
                let newLocation = ((pOccData.location !== updatedValues[1]) ? updatedValues[1] : null);
                let OGDate = (pOccData.date ? makeDate(pOccData.date, { noTime: true }) : { error: true });
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
                      messageRecipientIDs: (filteredList.map(e => {
                        return e.slotData.id;
                      })),
                      messageRecipientNames: (filteredList.map(e => {
                        return e.slotData.display_name;
                      }))
                    });
                  }
                }
              }
              updateReactData(reactUpdates, true);
            }}
          />
        }
        {reactData.editTimeEntries &&
          <AVATextInput
            titleText={reactData.editTimeEntries.title}
            errorText={reactData.editTimeEntries.errors || []}
            promptText={['Clock in', 'Clock Out', 'Notes']}
            valueText={getHistoryTimes(reactData.editTimeEntries)}
            onCancel={() => {
              reactData.editInfoErrorList = [];
              reactData.editTimeEntries = false;
              setReactData(reactData);
              setForceRedisplay(!forceRedisplay);
            }}
            onSave={async ([newIn, newOut, newNote]) => {
              let errorFree = true;
              let currentHistory = reactData.editTimeEntries.slotData.status.history;
              const this_userName = await makeName(state.session.user_id);
              const nowTime = makeDate(new Date());
              let inTime = makeTime(newIn);
              if (inTime.good) {
                currentHistory.unshift({
                  timestamp: reactData.editTimeEntries.appointmentDateTimeStamp + (inTime.minutesSinceMidnight * 60000),
                  user: reactData.editTimeEntries.slotData.owner,
                  action: `Checked in`,
                  location: `by ${this_userName} ${nowTime.oaDate}`
                });
              }
              else {
                errorFree = false;
              }
              let outTime = makeTime(newOut);
              if (outTime.good) {
                if (outTime.minutesSinceMidnight < inTime.minutesSinceMidnight) {
                  outTime.minutesSinceMidnight += 1440;
                }
                currentHistory.unshift({
                  timestamp: reactData.editTimeEntries.appointmentDateTimeStamp + (outTime.minutesSinceMidnight * 60000),
                  user: reactData.editTimeEntries.slotData.owner,
                  action: `Checked out`,
                  location: `by ${this_userName} ${nowTime.oaDate}`,
                  note: newNote
                });
              }
              else {
                errorFree = false;
              }
              if (errorFree) {
                await dbClient
                  .update({
                    Key: {
                      "client": pClient,
                      "event_key": `${pEventCode}#${reactData.editTimeEntries.id}`
                    },
                    UpdateExpression: 'set #sd.#st.#h = :h, check_in = :null',
                    ExpressionAttributeValues: {
                      ':h': currentHistory,
                      ':null': ''
                    },
                    ExpressionAttributeNames: {
                      '#sd': 'slotData',
                      '#st': 'status',
                      '#h': 'history'
                    },
                    TableName: "Calendar"
                  })
                  .promise()
                  .catch(error => { cl(`caught error updating Calendar; error is: `, error); });
                eventSlotList[reactData.editTimeEntries.index].check_in = (newOut ? null : newIn.timestamp);
                eventSlotList[reactData.editTimeEntries.index].marked = (newOut ? false : (newIn ? true : false));
                setEventSlotList(eventSlotList);
                reactData.editTimeEntries = false;
              }
              else {
                reactData.editTimeEntries.errors = [
                  (inTime.good ? '' : 'Clock in time is invalid'),
                  (outTime.good ? '' : 'Clock out time is invalid'),
                ];
              }
              updateReactData({
                editTimeEntries: reactData.editTimeEntries
              }, true);
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
            }}
            onConfirm={async () => {
              await handleCancelEvent();
              reactData.cancelPending = false;
              setReactData(reactData);
              setForceRedisplay(!forceRedisplay);
              onReset({ event_cancelled: true });
            }}
            allowCancel={true}
          />
        }
        {reactData.selectAssignTo &&
          <PersonFilter
            prompt={'Assign to whom?'}
            peopleList={reactData.choiceList}
            multiSelect={false}
            splitter={'%%'}
            onCancel={() => {
              updateReactData({
                selectAssignTo: false,
                choiceList: []
              }, true);
            }}
            onSelect={async (selectedPerson) => {
              let currentTime = makeDate(new Date());
              let assigned_to = selectedPerson.split('%%')[1];
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
        {reactData.editWaitList &&
          <PersonFilter
            prompt={'Wait List'}
            peopleList={reactData.choiceList}
            alreadyChecked={reactData.waitList}
            multiSelect={true}
            splitter={'%%'}
            onCancel={() => {
              updateReactData({
                editWaitList: false,
              }, true);
            }}
            onSelect={async (selectedPerson) => {
              await handleUpdateWaitList(selectedPerson);
              updateReactData({
                waitList: selectedPerson,
                editWaitList: false
              }, true);
            }}
          />
        }
        {!loading &&
          <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
            <Box display='flex' flexDirection='column'>
              <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
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
                            summaryInfo.slot_owners[s.slotData.owner] = s.slotData.slot_description || s.slotData.id;
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
                {['time', 'seats'].includes(pOccData.signup_type) &&
                  (eventSlotList.length <= reactData.numberOfOwnedSlots) &&
                  (!ownerOfSlots || isEventOwner) &&
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'orange', color: 'white', marginBottom: '-12px', marginLeft: '16px', marginRight: '16px' }}
                    size='small'
                    onClick={async () => {
                      if (isEventOwner) {
                        await setChoices({ pGroups: peopleList, noCurrent: true });
                        updateReactData({
                          editWaitList: true
                        }, true);
                      }
                      else {
                        if (!isWaitListed(pPatient)) {
                          reactData.waitList.push(pPatient);
                        }
                        else {
                          let foundAt = reactData.waitList.findIndex(wl_entry => {
                            return (wl_entry === pPatient);
                          });
                          if (foundAt > -1) {
                            reactData.waitList.splice(foundAt, 1);
                          }
                        }
                        await handleUpdateWaitList(reactData.waitList);
                        updateReactData({
                          waitList: reactData.waitList,
                        }, true);
                      }
                    }}
                  >
                    {`${!isEventOwner ? (isWaitListed(pPatient) ? 'Remove me from ' : 'Add me to ') : ''}Wait List`}
                  </Button>
                }
                {((!ownerOfSlots && !pViewOnly) || isEventOwner) &&
                  (!['time', 'seats'].includes(pOccData.signup_type)) &&
                  (isEventOwner || (reactData.signup_window.open)) &&
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'blue', color: 'white', marginBottom: '-12px', marginLeft: '16px', marginRight: '16px' }}
                    size='small'
                    onClick={async () => {
                      console.log(firstAvailableSlot);
                      if (isEventOwner) {
                        setEditSlot(true);
                        await setChoices({ pGroups: peopleList });
                        setSelectNewSlotOwner(true);
                      }
                      else {
                        let pName = await makeName(pPatient);
                        let request = { person: `${pName}:${pPatient}` };
                        let addedIndexAt = await handleAllocateSlot(request);
                        setOwnerOfSlots(true);
                        if (pOccData.signup_type !== 'none') {
                          request.slot = firstAvailableSlot;
                        }
                        if (pOccData.notes_required) {
                          setEditNoteNumber(addedIndexAt);
                        }
                      }
                    }}
                    startIcon={<PersonAddIcon size="small" />}
                  >
                    {isEventOwner ? `Add someone` : `Add myself`}
                  </Button>
                }
              </Box>
            </Box>
          </DialogActions>
        }
      </React.Fragment>
      {reactData.alert &&
        <Snackbar
          style={{ zIndex: 2000 }}
          open={!!reactData.alert}
          px={3}
          key={`alert_wrapper`}
          autoHideDuration={(reactData.alert.severity === 'success') ? 15000 : ((reactData.alert.severity === 'info') ? 15000 : null)}
          onClose={() => {
            updateReactData({
              alert: false
            }, true);
          }}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center'
          }}
        >
          <Alert
            severity={reactData.alert.severity || 'info'}
            key={`alert_box`}
            icon={false}
            style={{
              flexDirection: 'column', borderRadius: '20px', border: 1, justifyContent: 'center', alignItems: 'center',
              marginLeft: '8px', marginRight: '8px', paddingLeft: '0px'
            }}
            action={(reactData.alert.action
              ?
              <Box
                display='flex'
                key={`alert_action`}
                overflow='auto'
                flexDirection='row'
              >
                {([reactData.alert.action].flat()).map((this_action, actionNdx) => (
                  <Button
                    key={`alert_button__${actionNdx}`}
                    className={AVAClass.AVAButton} color="inherit"
                    onClick={() => this_action.function()}
                  >
                    {this_action.text}
                  </Button>
                ))}
              </Box>
              : null
            )}
            variant='filled'
            onClose={() => {
              updateReactData({
                alert: false
              }, true);
            }}
          >
            <Box
              display='flex'
              key={`alert_message`}
              overflow='auto'
              alignItems={'center'}
              justifyContent={'center'}
              flexDirection='column'
            >
              {reactData.alert.title && <AlertTitle>{reactData.alert.title}</AlertTitle>}
              {reactData.alert.message}
            </Box>
          </Alert>
        </Snackbar >
      }
    </Dialog >
  );
};