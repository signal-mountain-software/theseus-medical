import React from 'react';
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import { API, graphqlOperation } from 'aws-amplify';
import { getPerson, getSession, makeName, makeSearchData, formatPhone } from '../../util/AVAPeople';
import { makeDate } from '../../util/AVADateTime';
import { getObject, cl, dbClient, s3, lambda, cloudfront, titleCase } from '../../util/AVAUtilities';
import { createPutFact } from '../../graphql/mutations';
import useSession from '../../hooks/useSession';

import { useSnackbar } from 'notistack';

import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Switch from '@material-ui/core/Switch';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import Checkbox from '@material-ui/core/Checkbox';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import Slider from '@material-ui/core/Slider';

import CircularProgress from '@material-ui/core/CircularProgress';
import HelpOutlineIcon from '@material-ui/icons/HelpOutline';

import ClientsSection from '../sections/ClientsSection';
import RelationshipSection from '../sections/RelationshipSection';
import LinkedAccountsSection from '../sections/LinkedAccountsSection';
import MessageRouting from '../sections/MessageRouting';

const useStyles = makeStyles(theme => ({
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    flexGrow: 1
  },
  boxWithRoom: {
    marginTop: 10,
    alignContent: 'center',
  },
  formControl: {
    margin: 0,
    paddingTop: 0,
  },
  formControlLbl: {
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  idText: {
    marginRight: theme.spacing(1),
  },
  picture: {
    width: theme.spacing(16),
    height: theme.spacing(16),
    [theme.breakpoints.down('xs')]: {
      width: theme.spacing(8),
      height: theme.spacing(8),
    },
  },
  photoButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    alignSelf: 'center',
    verticalAlign: 'middle'
  },
  defaultButton: {
    alignSelf: 'end',
    variant: 'outlined',
    verticalAlign: 'end',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  topButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  resetButton: {
    // backgroundColor: theme.palette.confirm[theme.palette.type],
    marginRight: 10,
  },
  infoButton: {
    variant: 'outlined',
    // backgroundColor: theme.palette.info[theme.palette.type],
    marginRight: 10,
    paddingRight: 10,
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioTextBold: {
    fontSize: theme.typography.fontSize * 0.8,
    fontWeight: 'bold',
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioTextWithTopMargin: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: theme.spacing(1),
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  lineTextWithTopMargin: {
    marginTop: theme.spacing(1),
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  local_boolean: {
    paddingTop: 16,
    paddingBottom: 16,
    marginRight: 32,
    fontSize: theme.typography.fontSize * 0.857,
    color: (true ? 'black' : '#0000008A')
  },
  local_tiny: {
    paddingTop: 16,
    paddingBottom: 16,
    fontSize: theme.typography.fontSize * 0.5
  },
  idText1: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  idText2: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 5,
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ patient, picture, groupData, options = {}, open, onClose }) => {
  const classes = useStyles();

  const [localData, setLocalData] = React.useState({});
  const [patientGroups, setPatientGroups] = React.useState();
  const [responsibleArray, setResponsibleArray] = React.useState();
  const [proxy, setProxy] = React.useState();

  const [refreshTrigger, setRefreshTrigger] = React.useState(false);

  const [patientPChange, setPatientPChange] = React.useState();
  const [patientSession, setPatientSession] = React.useState();
  const [sessionVersion, setSessionVersion] = React.useState(0);

  const [changes, setChanges] = React.useState(false);
  const [showQuestionMark, setShowQuestionMark] = React.useState(false);
  const [photoChanges, setPhotoChanges] = React.useState(false);
  const [resettingPwd, setResettingPwd] = React.useState(false);
  const [pwdConfirmed, setPwdConfirmed] = React.useState(false);
  const [fontFactorChanged, setFontFactorChanged] = React.useState(false);

  const [editPhotoKey, setEditPhotoKey] = React.useState();
  const [editPhoto, setEditPhoto] = React.useState(null);
  const [cropperInstance, setCropper] = React.useState();

  const { enqueueSnackbar } = useSnackbar();
  const { state } = useSession();

  const [user_fontSize, setUserFontSize] = React.useState(1);
  const [fontFactor, ] = React.useState(1);

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  React.useEffect(() => {
    async function initialize() {
      if (patient) {
        if (patient.person_id.startsWith('*NEW~')) {
          // every new account is automatically put in an inactive group, the groups name is
          // designated in the customizations table's "group_assignments" key
          let inactiveAssignment = state?.session?.group_assignments?.inactive;
          let inactiveGroup;
          if (!inactiveAssignment) {
            inactiveGroup = 'inactive';
          }
          else if (Array.isArray(inactiveAssignment)) {
            inactiveGroup = inactiveAssignment[0];
          }
          else {
            inactiveGroup = inactiveAssignment;
          }
          groupData.selectedID = inactiveGroup;
          // make sure this new person is not automatically put in any public or private groups
          groupData.privateGroups = {};
          for (let groupID in groupData.publicGroups) {
            groupData.publicGroups[groupID].role = "non-member";
          }
        }
        let localPersonRec = await getPersonRec(patient.person_id);
        setPatientGroups(localPersonRec.groups);
        if (localPersonRec.relationships) {
          localPersonRec.relationships.forEach(async (relationship, index) => {
            localPersonRec.relationships[index].name = makeName(relationship.person_id);
          });
        }
        let targetSession = await getSessionData(patient.person_id);
        if (targetSession.customizations && targetSession.customizations.font_size) {
          setUserFontSize(targetSession.customizations.font_size);
        }
        let respArray = [];
        if (!targetSession.hasOwnProperty('responsible_for') || !targetSession.responsible_for) { }
        else if (Array.isArray(targetSession.responsible_for)) { respArray.push(...targetSession.responsible_for); }
        else if (targetSession.responsible_for.startsWith('[')) { respArray = targetSession.responsible_for.replace(/[[\s\]]/g, '').split(','); }
        else { respArray.push(targetSession.responsible_for); }

        let workingGroupMemberList = [];
        let nameObj = {};
        if (!localData.hasOwnProperty('groupMemberList') || localData.groupMemberList.length === 0) {
          workingGroupMemberList = await getGroupMemberList();
          workingGroupMemberList.forEach(m => {
            nameObj[m.person_id] = `${m.name?.first.charAt(0).toUpperCase()}${m.name?.last.charAt(0).toUpperCase()}${m.name?.last.substring(1)}`;
          });
        }

        let finalRespArray = [];
        respArray.forEach(r => { if (nameObj.hasOwnProperty(r)) { finalRespArray.push(r); } });

        let workLocalData = {
          ready: true,
          patient_id: (localPersonRec.person_id || ''),
          firstName: (titleCase(localPersonRec.name?.first) || ''),
          lastName: (titleCase(localPersonRec.name?.last) || ''),
          email: (localPersonRec.messaging?.email || ''),
          cell: (localPersonRec.messaging?.sms ? formatPhone(localPersonRec.messaging?.sms) : ''),
          voice: (localPersonRec.messaging?.voice ? formatPhone(localPersonRec.messaging?.voice) : ''),
          office: (localPersonRec.messaging?.office ? formatPhone(localPersonRec.messaging?.office) : ''),
          email_private: localPersonRec.messaging?.email_private,
          sms_private: localPersonRec.messaging?.sms_private,
          voice_private: localPersonRec.messaging?.voice_private,
          office_private: localPersonRec.messaging?.office_private,
          searchTerm: (localPersonRec.search_data || ''),
          local_data: (localPersonRec.local_data || {}),
          local_data_display: prepareLocal(localPersonRec.local_data),
          location: (localPersonRec.location || ''),
          sessionClient: (targetSession.client_id || '#need'),
          sessionPatient: (targetSession.patient_id || '#need'),
          inputPWD: (targetSession.last_login || 'password'),
          priority_activities: localPersonRec.priority_activities,
          favorite_activities: localPersonRec.favorite_activities,
          favorite_blocked: localPersonRec.favorite_blocked,
          last_login: (targetSession.last_login || null),
          preferred_method: localPersonRec.preferred_method || 'AVA',
          respArray: (finalRespArray || []),
          nameObj: (nameObj || {}),
          photoURL: await getObject(`${patient.person_id}`, 'image'),
          requirePassword: (targetSession.hasOwnProperty('requirePassword') ? targetSession.requirePassword : false),
          storePassword: (targetSession.hasOwnProperty('storePassword') ? targetSession.storePassword : true),
          subscription_status: targetSession.subscription_status || 'na',
          groupMemberList: (workingGroupMemberList || []),
          directoryOption: (localPersonRec.directory_option || 'normal'),
          directoryPartner: (localPersonRec.directory_partner || 'na'),
          account_class: (localPersonRec.account_class || ''),
          patientGroups: (localPersonRec.groups)
        };
        if (isNaN(localPersonRec.messaging?.surrogate)) { workLocalData.surrogate = localPersonRec.messaging?.surrogate; }
        else { workLocalData.surrogate = (formatPhone('' + localPersonRec.messaging?.surrogate)); }
        setLocalData(workLocalData);

      }
    }
    initialize();
  }, [patient]);  // eslint-disable-line react-hooks/exhaustive-deps

  function prepareLocal(localObj) {
    // takes in {key: value, key2: value2, ...}
    // returns {key: value for display, key2: value for display, ...}
    if (!localObj) { return {}; }
    let oKeys = Object.keys(localObj);
    if (oKeys.length === 0) { return {}; }
    let returnObj = {};
    oKeys.forEach(k => {
      returnObj[k] = localObj[k];
    });
    if (!state.session.local_data) { return returnObj; }
    if (Object.keys(state.session.local_data).length === 0) { return returnObj; }
    for (let ldKey in state.session.local_data) {
      if (localObj.hasOwnProperty(ldKey)) {
        switch (state.session.local_data[ldKey]) {
          case 'phone': {
            returnObj[ldKey] = formatPhone(localObj[ldKey]);
            break;
          }
          case 'boolean': {
            returnObj[ldKey] = localObj[ldKey];
            break;
          }
          case 'date': {
            returnObj[ldKey] = makeDate(localObj[ldKey]).dateOnly;
            break;
          }
          case 'fulldate': {
            returnObj[ldKey] = makeDate(localObj[ldKey]).absolute;
            break;
          }
          default: { }
        }
      }
    }
    return returnObj;
  }

  const getPersonRec = async (pPerson) => {
    let pRec = await getPerson(pPerson, '*all', true);
    if (pRec) { return pRec; }
    else {
      return {
        "person_id": pPerson,
        "location": "",
        "client_id": state.session.client_id,
        "search_data": "",
        "clients": [
          {
            "groups": [],
            "id": state.session.client_id
          }
        ],
        "name": {
          "last": "",
          "first": ""
        },
        "directory_option": "normal",
        "display_name": "",
        "groups": [],
        "preferred_method": "AVA",
        "relationships": null,
        "roles": ["patient"],
        "messaging": {},
        "time_offset": -5,
      };
    };
  };

  const getSessionData = async (pWho) => {
    let sessionRec = await getSession(pWho);
    if (sessionRec.session_id) {
      setPatientSession(sessionRec);
      setPatientPChange(sessionRec.password_change_date);
      return sessionRec;
    }
    else {
      let temp_session = {
        "session_id": pWho,
        "patient_id": pWho,
        "user_id": pWho,
        "person_id": pWho,
        "patient_display_name": "New Account",
        "user_display_name": "New Account",
        "assigned_to": "",
        "client_id": state.session.client_id,
        "groups_managed": [],
        "kiosk_mode": false,
        "last_login": "",
        "method": "add_from_dialog",
        "password_change_date": "",
        "platform": "",
        "requirePassword": false,
        "responsible_for": [],
        "status": {},
        "storePassword": true,
        "subscription_status": "na",
        "url_parameters": {},
        "user_homeClient": state.session.client_id
      };
      setPatientSession(temp_session);
      return temp_session;
    }
  };

  const getGroupMemberList = async () => {
    let invokeFailed = false;
    // setGroupMemberList([]);
    params.Payload = JSON.stringify({
      action: "get_group_members",
      clientId: patient.client_id,
      request: {
        "group_id": '*ALL',
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        cl(`AVA encountered an error while retrieving Group list.  Error is ${err.message}`);
      });
    if (!invokeFailed) {
      let gML = JSON.parse(fResp.Payload);
      if (gML.status === 200) {
        // setGroupMemberList(gML.body);
        return gML.body;
      }
    };
    return [];
  };

  const hiddenFileInput = React.useRef(null);

  const handlePhotoUpload = event => {
    hiddenFileInput.current.click();
  };

  const removeTemporaryPhoto = async () => {
    if (editPhotoKey) {
      s3.deleteObject({
        Bucket: 'theseus-medical-storage',
        Key: editPhotoKey,
      }).promise();
      setEditPhotoKey();
    }
  };

  const handleAbort = () => {
    setResettingPwd(false);
    setPwdConfirmed(false);
    localData.inputPWD = (patientSession ? (patientSession.last_login || 'password') : 'password');
    setChanges(false);
    setPhotoChanges(false);
    if (editPhotoKey) { removeTemporaryPhoto(); };
    onClose();
  };

  async function prepareUserID() {
    if (patient.person_id.startsWith('*NEW~')) {
      if (localData.firstName && localData.lastName) {
        localData.patient_id = await newUserID(localData);
        setRefreshTrigger(!refreshTrigger);
      }
    }
  }

  async function newUserID(pLocal) {
    let tryAgain;
    let showWarning = false;
    let newID, namePart;
    let clientPart = `-${state.session.client_id.toLowerCase()}`;
    let numberPart = 1;
    if (pLocal.proposedID) {
      namePart = (pLocal.proposedID.match(/([\w-]*[^\d]+)(\d*)$/))[1];
      newID = pLocal.proposedID;
    }
    else {
      if (!pLocal.lastName) {
        if (!pLocal.firstName) {
          return patient.person_id;
        }
        namePart = pLocal.firstName.trim().toLowerCase();
      }
      else {
        namePart = pLocal.firstName.trim().substr(0, 1).toLowerCase() + pLocal.lastName.toLowerCase().replace(/\W/g, '');
      }
      newID = `${namePart}${clientPart}`;
    }
    do {
      tryAgain = false;
      let getSessionResult = await getSession(newID);
      if (getSessionResult.hasOwnProperty('session_id')) {
        if (pLocal.proposedID) {
          showWarning = true;
        }
        numberPart++;
        if (newID.includes(clientPart)) {
          newID = `${namePart.replace(clientPart, '')}${numberPart}${clientPart}`;
        }
        else {
          newID = `${namePart}${numberPart}`;
        }
        tryAgain = true;
      }
    } while (tryAgain);
    if (showWarning) {
      enqueueSnackbar(`User ID ${pLocal.proposedID} is not available; AVA proposes ${newID} instead`, { variant: 'error', persist: false });
      showWarning = false;
      setChanges(true);
    }
    return newID;
  }

  const handleUpdate = async () => {
    let updatePerson = {
      client_id: state.session.client_id,
      person_id: localData.patient_id || (patient.person_id.startsWith('*NEW~') ? await newUserID(localData) : patient.person_id),
      first: localData.firstName.substr(0, 1).toUpperCase() + localData.firstName.substr(1),
      last: localData.lastName.substr(0, 1).toUpperCase() + localData.lastName.substr(1),
      email: localData.email,
      sms: localData.cell ? '+1' + localData.cell.replace(/\D/g, '') : null,
      voice: localData.voice ? '+1' + localData.voice.replace(/\D/g, '') : null,
      office: localData.office ? '+1' + localData.office.replace(/\D/g, '') : null,
      email_private: (localData.email_private && 'true'),
      sms_private: (localData.sms_private && 'true'),
      voice_private: (localData.voice_private && 'true'),
      office_private: (localData.office_private && 'true'),
      surrogate: localData.surrogate || '',
      local_data: localData.local_data,
      search_data: makeSearchData([localData]),
      preferred_method: localData.preferred_method || 'AVA',
      requirePassword: localData.requirePassword,
      priority_activities: localData.priority_activities,
      favorite_activities: localData.favorite_activities,
      favorite_blocked: localData.favorite_blocked,
      storePassword: localData.storePassword,
      subscription_status: localData.subscription_status,
      directory_option: localData.directoryOption || 'normal',
      directory_partner: localData.directoryPartner || null,
      time_based_rules: patient.time_based_rules,
      account_class: localData.account_class || '',
      groups: patientGroups || ['inactive'],
      location: localData.location ? localData.location.replace(/,/g, '') : null,
      pwdReset: resettingPwd,
      newPassword: localData.inputPWD
    };
    let myClient = state.session.client_id;
    let putPerson = {
      person_id: updatePerson.person_id,
      client_id: myClient,
      "name": {
        first: updatePerson.first,
        last: updatePerson.last,
      },
      messaging: {
        email: updatePerson.email,
        sms: updatePerson.sms,
        voice: updatePerson.voice,
        office: updatePerson.office,
        email_private: !!updatePerson.email_private,
        sms_private: !!updatePerson.sms_private,
        voice_private: !!updatePerson.voice_private,
        office_private: !!updatePerson.office_private,
        surrogate: localData.surrogate,
      },
      search_data: updatePerson.search_data,
      local_data: updatePerson.local_data,
      preferred_method: localData.preferred_method || 'AVA',
      priority_activities: localData.priority_activities,
      favorite_activities: localData.favorite_activities,
      favorite_blocked: localData.favorite_blocked,
      requirePassword: localData.requirePassword,
      storePassword: localData.storePassword,
      subscription_status: localData.subscription_status || 'na',
      directory_option: localData.directoryOption || 'normal',
      directory_partner: localData.directoryPartner || 'na',
      time_based_rules: patient.time_based_rules,
      account_class: localData.account_class,
      clients: {
        id: myClient,
        groups: patientGroups || ['inactive']
      },
      groups: patientGroups || ['inactive'],
      location: localData.location ? localData.location.replace(/,/g, '') : null,
      pwdReset: resettingPwd,
      newPassword: localData.inputPWD
    };
    updatePerson.messaging = putPerson.messaging;
    updatePerson.name = putPerson.name;
    await dbClient
      .put({
        Item: putPerson,
        TableName: "People",
      })
      .promise()
      .catch(error => { cl(`caught error updating People; error is:`, error); });
     
    let updateString = 'newData.' + JSON.stringify(updatePerson);
    cl(updatePerson);
    let newFactData = {
      patient_id: updatePerson.person_id,
      activity_key: 'action.updateUser',
      value: updateString,
      qualifier: null,
      status: 'requested',
      session: {
        user_id: state.session.user_id,
        session_id: state.session.session_id,
      },
    };
    await API.graphql(graphqlOperation(createPutFact, { input: newFactData })).catch(error => {
      cl(error);
    });

    let sessionRec = await getSession(patient.person_id);
    sessionRec.session_id = localData.patient_id;
    sessionRec.person_id = localData.patient_id;
    sessionRec.user_id = localData.patient_id;
    sessionRec.status = {
      'version': `v${process.env.REACT_APP_AVA_VERSION}`,
      'environment': window.location.href.split('//')[1].charAt(0).toUpperCase(),
      'time': new Date().toString(),
      'action': 'Updated Person record',
      'source': 'patient_dialog'
    };
    if (proxy) {
      sessionRec.patient_id = proxy;
    }
    else {
      sessionRec.patient_id = localData.patient_id;
    }
    if (localData.last_login && !resettingPwd) {
      sessionRec.last_login = (localData.storePassword ? localData.last_login : '<not retained>');
    }
    if (resettingPwd) {
      sessionRec.last_login = (localData.storePassword ? localData.inputPWD : '<not retained>');
      sessionRec.password_change_date = new Date().toLocaleString();
    }
    sessionRec.requirePassword = localData.requirePassword;
    sessionRec.storePassword = localData.storePassword;
    sessionRec.subscription_status = localData.subscription_status;
    if (responsibleArray) {
      sessionRec.responsible_for = responsibleArray;
    }
    if ((localData.sessionClient !== myClient)
      || (localData.sessionPatient !== putPerson.person_id)
      || !sessionRec.client_id
      || (sessionRec.client_id === '')) {
      sessionRec.client_id = myClient;
    }
    if (fontFactorChanged) {
      if (!sessionRec.hasOwnProperty('customizations')) {
        sessionRec.customizations = {};
      }
      sessionRec.customizations.font_size = fontFactor * user_fontSize;
    }
    await dbClient
      .put({
        Item: sessionRec,
        TableName: "SessionsV2",
      })
      .promise()
      .catch(error => { cl(`caught error updating People; error is:`, error); });
    
    /*
    {
    let attributeValues = {
      ':s': JSON.stringify({
        'version': `v${process.env.REACT_APP_AVA_VERSION}`,
        'environment': window.location.href.split('//')[1].charAt(0).toUpperCase(),
        'time': new Date().toString(),
        'action': 'Updated Person record',
        'source': 'patient_dialog'
      })
    };
    let updateExpression = 'set #s = :s, ';
    let attributeNames = { "#s": "status" };
    if (responsibleArray) {
      attributeValues[':r'] = responsibleArray;
      updateExpression += 'responsible_for = :r, ';
    }
    if (proxy) {
      attributeValues[':pid'] = proxy;
      updateExpression += 'patient_id = :pid, ';
    }
    if (localData.last_login && !resettingPwd) {
      attributeValues[':ll'] = (localData.storePassword ? localData.last_login : '<not retained>');
      updateExpression += 'last_login = :ll, ';
    }
    if (resettingPwd) {
      attributeValues[':ll'] = (localData.storePassword ? localData.inputPWD : '<not retained>');
      attributeValues[':pcd'] = new Date().toLocaleString();
      updateExpression += 'last_login = :ll, password_change_date = :pcd, ';
    }
    attributeValues[':rp'] = localData.requirePassword;
    updateExpression += 'requirePassword = :rp, ';

    attributeValues[':sp'] = localData.storePassword;
    updateExpression += 'storePassword = :sp, ';

    attributeValues[':ss'] = localData.subscription_status;
    updateExpression += 'subscription_status = :ss, ';

    if ((localData.sessionClient !== myClient) || (localData.sessionPatient !== patient.person_id)) {
      attributeValues[':c'] = myClient;
      updateExpression += 'client_id = :c, ';
    }
    if (localData.sessionPatient !== patient.person_id) {
      attributeValues[':p'] = patient.person_id;
      updateExpression += 'person_id = :p, user_id = :p, ';
      if (!proxy) {
        updateExpression += 'patient_id = :p, ';
      }
    }
    if (fontFactorChanged) {
      attributeValues[':f'] = fontFactor * user_fontSize;
      attributeNames['#c'] = 'customizations';
      attributeNames['#f'] = 'font_size';
      updateExpression += '#c.#f = :f, ';
    }
    updateExpression = updateExpression.substring(0, updateExpression.length - 2);
    
    await dbClient
      .update({
        Key: { session_id: updatePerson.person_id },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: attributeValues,
        ExpressionAttributeNames: attributeNames,
        TableName: "SessionsV2",
      })
      .promise()
      .catch(async (error) => {
        let resolved = true;
        if ((error.code === 'ValidationException') && fontFactorChanged) {
          await dbClient
            .update({
              Key: { session_id: updatePerson.person_id },
              UpdateExpression: 'set #c = :m',
              ExpressionAttributeValues: { ':m': {} },
              ExpressionAttributeNames: { '#c': 'customizations' },
              TableName: "SessionsV2",
            })
            .promise()
            .catch(error => {
              resolved = false;
              cl(`caught error updating SessionsV2; error is: `, error);
            });
          if (resolved) {
            await dbClient
              .update({
                Key: { session_id: updatePerson.person_id },
                UpdateExpression: updateExpression,
                ExpressionAttributeValues: attributeValues,
                ExpressionAttributeNames: attributeNames,
                TableName: "SessionsV2",
              })
              .promise()
              .catch(error => {
                resolved = false;
                cl(`caught error updating SessionsV2; error is: `, error);
              });
          }
        }
        else {
          cl(`caught error updating SessionsV2; error is: `, error);
        }
      });
    }
    */

    // If we changed the person_id, make the original preon_id an inactive account
    if (putPerson.person_id !== patient.person_id) {
      let inactiveAssignment = state?.session?.group_assignments?.inactive;
      let inactiveGroup;
      if (!inactiveAssignment) {
        inactiveGroup = 'inactive';
      }
      else if (Array.isArray(inactiveAssignment)) {
        inactiveGroup = inactiveAssignment[0];
      }
      else {
        inactiveGroup = inactiveAssignment;
      }
      await dbClient
        .update({
          Key: { person_id: patient.person_id },
          UpdateExpression: 'set #g = :g, #c = :c',
          ExpressionAttributeValues: {
            ':g': [inactiveGroup],
            ':c': {
              'groups': [inactiveGroup],
              'id': state.session.client_id
            }
          },
          ExpressionAttributeNames: {
            '#g': 'groups',
            '#c': 'clients'
          },
          TableName: "People",
        })
        .promise()
        .catch(error => {
          cl(`caught error updating People; error is: `, error);
        });
      // copy photo
      let [fileID, extension] = localData.photoURL.split('/').pop().split('?').shift().split('.');
      let copy_response = await s3.copyObject({
        CopySource: `theseus-medical-storage/public/patients/${fileID}.${extension}`,
        Bucket: 'theseus-medical-storage',
        Key: `public/patients/${putPerson.person_id}.${extension}`,
        ACL: 'public-read-write',
      })
        .promise()
        .catch(err => {
          enqueueSnackbar(`AVA couldn't save the photo.  The reason is ${err.message}`, { variant: 'error', persist: true });
        });
      cl(copy_response);
      enqueueSnackbar(`ID changed to ${putPerson.person_id}.  Information updated!`, { variant: 'success', persist: false })
    }
    else {
      enqueueSnackbar(`Profile information updated!`, { variant: 'success', persist: false });
    }

    patient.name.first = localData.firstName;
    patient.name.last = localData.lastName;
    setChanges(false);
    setPhotoChanges(false);
    setResettingPwd(false);
    setPwdConfirmed(false);
    onClose(updatePerson);
  };

  const handleResetPassword1 = event => {
    setResettingPwd(true);
    setPwdConfirmed(false);
    // setInputPWD('password');
    localData.inputPWD = ((patientSession && patientSession.last_login) ? patientSession.last_login : 'password');
  };

  const handleResetPassword2 = event => {
    setPwdConfirmed(true);
  };

  const handleChangePartner = event => {
    localData.directoryPartner = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeUser = async event => {
    localData.patient_id = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    setShowQuestionMark(true);
    setChanges(false);
  };

  const handleBlurUser = async event => {
    if (event.target.value !== patient.person_id) {
      localData.patient_id = await newUserID({
        proposedID: event.target.value
      });
      setRefreshTrigger(!refreshTrigger);
      setShowQuestionMark(false);
      setChanges(true);
    }
  };

  const handleBlurName = async event => {
    await prepareUserID();
  };

  const handleChangeFirstName = async event => {
    localData.firstName = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeLastName = async event => {
    localData.lastName = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeEmail = event => {
    localData.email = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    // setEmail(event.target.value);
    setChanges(true);
  };

  const handleChangeCell = event => {
    localData.cell = formatPhone(event.target.value);
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeVoice = event => {
    localData.voice = formatPhone(event.target.value);
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };


  const handleChangeOffice = event => {
    localData.office = formatPhone(event.target.value);
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeSurrogate = event => {
    let checkNum = event.target.value.replace(/[\d\s\-()]/g, '');
    if (checkNum) { localData.surrogate = event.target.value; }
    else { localData.surrogate = formatPhone(event.target.value); }
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  async function handleSaveTemporaryPhoto(pTarget) {
    let pType;
    if (typeof (pTarget) === 'string') { pType = 'jpg'; }
    else { pType = pTarget.type; }
    let s3Resp = await s3
      .upload({
        Bucket: 'theseus-medical-storage',
        Key: `${patient.person_id}_original.jpg`,
        Body: pTarget,
        ACL: 'public-read-write',
        ContentType: pType
      })
      .promise()
      .catch(err => {
        enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
      });
    cl(s3Resp);
    setEditPhotoKey(s3Resp.Key);
    return s3Resp.Location;
  };

  async function handleSavePhoto(pTarget) {
    let extension = pTarget.type.split('/')[1];
    if (extension === 'jpeg') { extension = 'jpg'; }
    const pFile = {
      Bucket: 'theseus-medical-storage',
      Key: 'public/patients/' + patient.person_id + '.' + extension,
      Body: pTarget,
      ACL: 'public-read-write',
      ContentType: pTarget.type
    };
    await s3
      .upload(pFile)
      .promise()
      .catch(err => {
        enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
      });
    let cfParm = {
      DistributionId: 'E3DXPQ4WCODC8A',
      InvalidationBatch: {
        CallerReference: new Date().getTime().toString(),
        Paths: {
          Quantity: 1,
          Items: [`/${patient.person_id}.jpg`]
        }
      }
    };

    await cloudfront
      .createInvalidation(cfParm)
      .promise()
      .catch(err => {
        cl({
          'clearing cache - cloudfront invalidation error': {
            err, cfParm
          }
        });
        enqueueSnackbar(`The new image is saved, but you'll still see the old one for a little while`, { variant: 'warning', persist: false });
      });
    localData.photoURL = await getObject(patient.person_id, 'image');
    setLocalData(localData);
    return;
  };

  const handleChangeSearch = event => {
    localData.searchTerm = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeMethod = event => {
    localData.preferred_method = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeDirectoryOption = event => {
    localData.directoryOption = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeEmailPrivacy = event => {
    localData.email_private = !localData.email_private;
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeSmsPrivacy = event => {
    localData.sms_private = !localData.sms_private;
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeVoicePrivacy = event => {
    localData.voice_private = !localData.voice_private;
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeOfficePrivacy = event => {
    localData.office_private = !localData.office_private;
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeLocation = event => {
    localData.location = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangePassword = event => {
    localData.inputPWD = event.target.value;
    setRefreshTrigger(!refreshTrigger);
  };

  const handleChangeGroups = updatedGroupArray => {
    setPatientGroups(updatedGroupArray);
    setChanges(true);
  };

  const handleChangeLinkedAccounts = updatedResponsibleArray => {
    let finalRespArray = [];
    updatedResponsibleArray.forEach(r => { if (localData.nameObj.hasOwnProperty(r)) { finalRespArray.push(r); } });
    localData.respArray = finalRespArray;
    setResponsibleArray(updatedResponsibleArray);
    patientSession.responsible_for = updatedResponsibleArray;
    setSessionVersion(sessionVersion + 1);
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  const handleChangeProxy = event => {
    let newProxy = event.target.value;
    if (!newProxy || newProxy === '') { newProxy = patientSession.user_id; }
    setProxy(newProxy);
    patientSession.patient_id = newProxy;
    setSessionVersion(sessionVersion + 1);
    setChanges(true);
  };

  function handleChangeSubscriptionStatus(newStatus) {
    localData.subscription_status = newStatus;
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  }

  const onChangeMethod = tableRow => event => {
    patient.time_based_rules[tableRow].method = event.target.value;
    setChanges(true);
  };

  const onChangeEscalationType = tableRow => event => {
    patient.time_based_rules[tableRow].escalationType = event.target.value;
    setChanges(true);
  };

  const onChangeEscalationData = tableRow => event => {
    patient.time_based_rules[tableRow].escalationData = event.target.value;
    setChanges(true);
  };

  const onChangeWaitTime = tableRow => event => {
    patient.time_based_rules[tableRow].waitTime = event.target.value;
    setChanges(true);
  };

  const onChangeKeyWords = tableRow => event => {
    patient.time_based_rules[tableRow].keyWords = event.target.value;
    setChanges(true);
  };

  /*
  function recordExists(recordId) {
    if (!recordId) { return false; }
    if (recordId.hasOwnProperty('Count')) { return (recordId.Count > 0); }
    else { return ((recordId.hasOwnProperty("Item") || recordId.hasOwnProperty("Items"))); }
  }
  */

  return (
    (localData.ready && (open || refreshTrigger)) ?
      <Dialog open={open} onClose={handleAbort} TransitionComponent={Transition} fullScreen>
        <AppBar>
          <Toolbar>
            <IconButton color='inherit' edge='start' onClick={handleAbort}>
              <CloseIcon />
            </IconButton>
            <Typography variant='h6' className={classes.title}>
              {patient?.name?.first} {patient?.name?.last}
            </Typography>
            {(changes || pwdConfirmed || photoChanges) &&
              <Button
                onClick={async () => {
                    handleUpdate();
                }}
                variant='contained'
                className={classes.topButton}
              >
                {'Save'}
              </Button>}
          </Toolbar>
        </AppBar>
        <Toolbar />
        <Box m={2}>
          <Paper component={Box} variant={'outlined'}>
            <Box mt={1} py={1} px={3} borderBottom={2}>
              <Box flexGrow={1}>
                <Typography variant='h6'>Profile</Typography>
              </Box>
            </Box>
          </Paper>
          <Paper
            component={Box}
            p={3}
            variant='outlined'
            display='flex'
            flexDirection='row'
            justifyContent='center'
            alignItems='center'>
            <Box flexGrow={2} display='flex' flexDirection='column'>
              <Box display='flex' alignItems='center'
                justifyContent='flex-start' flexDirection='row'>
                <TextField classes={{ root: classes.idText }}
                  id='FirstName'
                  onChange={async (event) => { await handleChangeFirstName(event); }}
                  onBlur={async () => { await handleBlurName(); }}
                  value={localData.firstName}
                  helperText='First'
                />
                <TextField classes={{ root: classes.idText }}
                  id='LastName'
                  onChange={async (event) => { await handleChangeLastName(event); }}
                  onBlur={async () => { await handleBlurName(); }}
                  value={localData.lastName}
                  helperText='Last'
                />
              </Box>
              <Box display='flex' alignItems='flex-start'
                justifyContent='flex-start' flexDirection='row'>
                <TextField classes={{ root: classes.idText }}
                  id='UserID'
                  value={localData.patient_id}
                  fullWidth
                  onChange={async (event) => { await handleChangeUser(event); }}
                  onBlur={async (event) => { await handleBlurUser(event); }}
                  helperText='User ID'
                />
                {showQuestionMark && <HelpOutlineIcon sx={{alignSelf: 'start'}} />}
              </Box>
              <Box display='flex' alignItems='center'
                justifyContent='flex-start' flexDirection='row'>
                <TextField classes={{ root: classes.idText }}
                  id='address' value={localData.location} fullWidth onChange={handleChangeLocation} helperText='Location' />
              </Box>
              <Box display='flex' alignItems='center'
                justifyContent='flex-start' flexDirection='row'>
                <TextField classes={{ root: classes.idText }}
                  id='eMail' value={localData.email} fullWidth onChange={handleChangeEmail} helperText='e-Mail' />
              </Box>
              <Box display='flex' alignItems='center'
                justifyContent='flex-start' flexDirection='row'>
                <TextField classes={{ root: classes.idText }}
                  id='cell' value={localData.cell} onChange={handleChangeCell} helperText='cell phone' />
                <TextField classes={{ root: classes.idText }}
                  id='home' value={localData.voice} onChange={handleChangeVoice} helperText='home phone' />{'    '}
                <TextField classes={{ root: classes.idText }}
                  id='work' value={localData.office} onChange={handleChangeOffice} helperText='work phone' />
              </Box>
              <Box display='flex' alignItems='center'
                justifyContent='flex-start' flexDirection='row'>
                <TextField classes={{ root: classes.idText }}
                  id='surrogate' value={localData.surrogate || ''} fullWidth onChange={handleChangeSurrogate} helperText='on-site alternate contact' />
              </Box>
              {state.session.local_data &&
                (Object.keys(state.session.local_data).length > 0) &&
                <Box flexGrow={2} display='flex' flexDirection='column'>
                  {Object.keys(state.session.local_data).map((local, lX) => (
                    (state.session.local_data[local] !== 'boolean') ?
                      <TextField
                        key={`local_${lX}`}
                        classes={{ root: classes.idText }}
                        id={`loc-${local}`}
                        value={localData.local_data_display[local] || ' '}
                        inputProps={{ style: { color: 'black' } }}
                        FormHelperTextProps={{ style: { color: 'black' } }}
                        onChange={(event) => {
                          switch (state.session.local_data[local]) {
                            case 'phone': {
                              if (event.target.value) {
                                localData.local_data[local] = '+1' + Number(event.target.value.replace(/\D/g, '')).toString();
                              }
                              else {
                                localData.local_data[local] = '';
                              }
                              localData.local_data_display[local] = formatPhone(event.target.value);
                              break;
                            }
                            case 'fulldate':
                            case 'date': {
                              let lDate = makeDate(event.target.value);
                              if (!lDate.error) { localData.local_data[local] = lDate.numeric$; }
                              localData.local_data_display[local] = event.target.value;
                              break;
                            }
                            default: {
                              localData.local_data[local] = event.target.value.trim();
                              localData.local_data_display[local] = event.target.value;
                            }
                          }
                          setRefreshTrigger(!refreshTrigger);
                          setChanges(true);
                        }}
                        helperText={local}
                      />
                      :
                      <React.Fragment key={`bool-switch_${lX}`}>
                        <Box flexGrow={2} display='flex' alignItems='center'
                          justifyContent='flex-start' flexDirection='row'>
                          <Typography className={classes.local_boolean} >{local}</Typography>
                          <Box flexGrow={2} display='flex' alignItems='center'
                            justifyContent='flex-start' flexDirection='row'>
                            <Typography className={classes.local_tiny} >No</Typography>
                            <Switch
                              checked={localData.local_data && localData.local_data[local]}
                              onChange={() => {
                                if (!localData.local_data) {
                                  localData.local_data = {};
                                  localData.local_data[local] = true;
                                }
                                else {
                                  localData.local_data[local] = !localData.local_data[local];
                                }
                                setRefreshTrigger(!refreshTrigger);
                                setChanges(true);
                              }}
                              name={local}
                              color="primary"
                            />
                            <Typography className={classes.local_tiny} >Yes</Typography>
                          </Box>
                        </Box>
                      </React.Fragment>
                  ))}
                </Box>
              }
              <Box
                display="flex"
                pt={2}
                flexDirection='column'
                justifyContent="center"
              >
                <Typography className={classes.radioText}>Simple option - I prefer to always receive communications via...</Typography>
                {localData.preferred_method &&
                  <FormControl className={classes.formControl} component="fieldset">
                    <RadioGroup row defaultValue={localData.preferred_method} aria-label="PreferredMethod" name="method" value={localData.preferred_method} onChange={handleChangeMethod}>
                      <FormControlLabel className={classes.formControlLbl} value="AVA" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>AVA</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="sms" control={<Radio disabled={!localData.cell} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>text</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="email" control={<Radio disabled={!localData.email} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>e-Mail</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="voice" control={<Radio disabled={!localData.voice} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>home phone</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="office" control={<Radio disabled={!localData.office} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>work phone</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="surrogate" control={<Radio disabled={!localData.surrogate} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>surrogate</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="time_based" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>use rules to manage messages</Typography>} />
                    </RadioGroup>
                  </FormControl>
                }
                {localData.preferred_method !== 'time_based' &&
                  <Typography className={classes.radioText}>Urgent messages will re-try this method every 30 minutes for 2 hours</Typography>
                }

                <Typography className={classes.radioTextWithTopMargin}>With regard to the Directory...</Typography>
                {localData.directoryOption &&
                  <FormControl className={classes.formControl} component="fieldset">
                    <RadioGroup row={false} defaultValue={localData.directoryOption} aria-label="DirOptions" name="dirOption" value={localData.directoryOption} onChange={handleChangeDirectoryOption}>
                      <FormControlLabel className={classes.formControlLbl} value="normal" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>Include my info</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="exclude" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>Exclude me</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="alone" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>Do not print my info with anyone else's</Typography>} />
                      <FormControlLabel className={classes.formControlLbl} value="merge" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>Merge with another account for printing</Typography>} />
                    </RadioGroup>
                  </FormControl>
                }
                {(localData.directoryOption === 'merge') &&
                  <React.Fragment>
                    <Typography className={classes.radioTextWithTopMargin}>{(localData.respArray && (localData.respArray.length === 0)) ? 'To merge for printing, first link one or more Accounts in the "Linked Accounts" section below' : 'Merge with which linked Account?'}</Typography>
                    <FormControl className={classes.formControl} component="fieldset">
                      <RadioGroup row
                        defaultValue={localData.directoryPartner || ((localData.respArray.length === 1) ? localData.respArray[0] : localData.patient_id)}
                        aria-label="Mergeaccount"
                        name="directory_partner"
                        value={localData.directoryPartner}
                        onChange={handleChangePartner}
                      >
                        {localData.respArray &&
                          localData.respArray.map((presp) => (
                            <FormControlLabel
                              key={`nameNlinkdaccts+${presp}`}
                              className={classes.formControlLbl}
                              value={presp}
                              control={
                                <Radio disableRipple
                                  className={classes.radioButton}
                                  size='small' />
                              }
                              label={
                                <Typography
                                  className={classes.radioText}>
                                  {localData.nameObj[presp]}
                                </Typography>}
                            />
                          ))}
                      </RadioGroup>
                    </FormControl>
                  </React.Fragment>
                }
                <Typography className={classes.radioTextWithTopMargin}>Please don't share my...</Typography>
                <FormControlLabel className={classes.formControlLbl} onChange={handleChangeEmailPrivacy} control={<Checkbox disableRipple checked={localData.email_private} disabled={!localData.email} className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>e-Mail address</Typography>} />
                <FormControlLabel className={classes.formControlLbl} onChange={handleChangeSmsPrivacy} control={<Checkbox disableRipple checked={localData.sms_private} disabled={!localData.cell} className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>Cell number</Typography>} />
                <FormControlLabel className={classes.formControlLbl} onChange={handleChangeVoicePrivacy} control={<Checkbox disableRipple checked={localData.voice_private} disabled={!localData.voice} className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>Home number</Typography>} />
                <FormControlLabel className={classes.formControlLbl} onChange={handleChangeOfficePrivacy} control={<Checkbox disableRipple checked={localData.office_private} disabled={!localData.office} className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>Work number</Typography>} />

                <Box mt={3}>
                  <TextField id='searchTerm' value={localData.searchTerm} fullWidth onChange={handleChangeSearch} helperText='Additional search terms' />
                </Box>

              </Box>
            </Box>
          </Paper>
        </Box >
        {
          localData.preferred_method === 'time_based' &&
          <MessageRouting
            person={patient}
            updateSetChange={() => { setChanges(true); }}
            onChangeMethod={onChangeMethod}
            onChangeEscalationType={onChangeEscalationType}
            onChangeWaitTime={onChangeWaitTime}
            onChangeKeyWords={onChangeKeyWords}
            onChangeEscalationData={onChangeEscalationData}
            numberRows={patient.time_based_rules?.length || 1}
            session={patientSession}
          />
        }
        < Box m={2} >
          <Paper component={Box} variant={'outlined'}>
            <Box mt={1} py={1} px={3} borderBottom={2}>
              <Box flexGrow={1}>
                <Typography variant='h6'>Font size</Typography>
              </Box>
            </Box>
          </Paper>
          <Paper
            component={Box}
            p={3}
            variant='outlined'
            display='flex'
            flexDirection='row'
            justifyContent='center'
            alignItems='center'>
            <Box flexGrow={1} mr={3}
              display="flex"
              flexDirection='column'
              alignItems="center"
              justifyContent="center"
            >
              <Box width={300} >
                <Slider
                  value={user_fontSize}
                  onChange={(event, newValue) => {
                    // setFontFactor(newValue / user_fontSize);
                    setUserFontSize(newValue);
                    setChanges(true);
                    setFontFactorChanged(true);
                  }}
                  aria-labelledby="continuous-slider"
                  step={.1}
                  min={1}
                  max={5}
                />
              </Box>
              <Typography key={`default-fontsize`}
                style={{
                  fontSize: `${user_fontSize * 1.5 * (fontFactor || 1)}rem`,
                  lineHeight: 1.2,
                  overflow: ('hidden')
                }}
                className={classes.titleRow}>
                {`This is the default font size for ${patient?.name?.first} ${patient?.name?.last}`}
              </Typography>
            </Box>
          </Paper>
        </Box >

        < Box m={2} >
          <Paper component={Box} variant={'outlined'}>
            <Box mt={1} py={1} px={3} borderBottom={2}>
              <Box flexGrow={1}>
                <Typography variant='h6'>Photo</Typography>
              </Box>
            </Box>
          </Paper>
          <Paper
            component={Box}
            p={3}
            variant='outlined'
            display='flex'
            flexDirection='row'
            justifyContent='center'
            alignItems='center'>
            <Box flexGrow={1} mr={3}
              display="flex"
              flexDirection='column'
              alignItems="center"
              justifyContent="center"
            >
              <Box
                component="img"
                minWidth={150}
                maxWidth={150}
                minHeight={150}
                maxHeight={150}
                border={1}
                alt=''
                src={localData.photoURL}
              />
              <br />
              <Box display='flex'
                className={classes.photoButton}
                flexDirection='row'
                justifyContent='center'
                alignItems='center'>
                {!editPhoto &&
                  <React.Fragment>
                    <Button
                      className={classes.photoButton}
                      variant='outlined'
                      color='primary'
                      hidden={patient.person_id.startsWith('*NEW~')}
                      size='small'
                      onClick={() => {
                        handlePhotoUpload();
                      }}
                    >
                      <Typography>Upload new photo</Typography>
                    </Button>
                    {!patient.person_id.startsWith('*NEW~') &&
                      <Button
                        className={classes.photoButton}
                        variant='outlined'
                        color='primary'
                        hidden={patient.person_id.startsWith('*NEW~')}
                        size='small'
                        onClick={async () => {
                          setEditPhoto(localData.photoURL);
                        }}
                      >
                        <Typography>Edit this photo</Typography>
                      </Button>
                    }
                  </React.Fragment>
                }
                {editPhoto &&
                  <React.Fragment>
                    <Button
                      className={classes.photoButton}
                      variant='outlined'
                      color='primary'
                      size='small'
                      onClick={() => {
                        cropperInstance.rotate(90);
                      }}
                    >
                      <Typography>Rotate</Typography>
                    </Button>
                    <Button
                      className={classes.photoButton}
                      variant='outlined'
                      color='primary'
                      size='small'
                      onClick={() => {
                        cropperInstance.destroy();
                        setEditPhoto(null);
                        setPhotoChanges(false);
                        removeTemporaryPhoto();
                        setRefreshTrigger(!refreshTrigger);
                      }}
                    >
                      <Typography>Cancel Edits</Typography>
                    </Button>
                    <Button
                      className={classes.photoButton}
                      variant='outlined'
                      color='primary'
                      size='small'
                      onClick={async () => {
                        setEditPhoto(null);
                        setPhotoChanges(true);
                        cropperInstance
                          .getCroppedCanvas()
                          .toBlob((async (pBlob) => {
                            let editedPhoto = new File([pBlob], patient.person_id, { type: 'image/jpeg' });
                            await handleSavePhoto(editedPhoto);
                          }), 'image/jpeg');
                        setRefreshTrigger(!refreshTrigger);
                      }}
                    >
                      <Typography>Save Edits</Typography>
                    </Button>
                  </React.Fragment>
                }
              </Box>
              {editPhoto &&
                <Cropper
                  zoomTo={0.5}
                  style={{ width: "100%", height: "400px" }}
                  aspectRatio={1 / 1}
                  src={editPhoto}
                  viewMode={0}
                  minCropBoxHeight={150}
                  minCropBoxWidth={150}
                  background={false}
                  responsive={true}
                  dragMode={'move'}
                  movable={true}
                  autoCropArea={1}
                  checkOrientation={false}
                  onInitialized={(instance) => {
                    setCropper(instance);
                  }}
                />
              }
              <input
                type="file"
                style={{ display: 'none' }}
                ref={hiddenFileInput}
                onChange={async (target) => {
                  if (target.target.files.length > 0) {
                    setEditPhoto(await handleSaveTemporaryPhoto(target.target.files[0]));
                  }
                }}
              />
            </Box>
          </Paper>
        </Box >
        {((options && options.fullAccess) || (['master', 'support'].includes(state.user.account_class)))
          &&
          <React.Fragment>
            <ClientsSection
              person={patient}
              groupData={groupData}
              updateGroups={handleChangeGroups}
            />
            <RelationshipSection person={patient} />
            <LinkedAccountsSection
              groupMemberList={localData.groupMemberList}
              session={patientSession}
              updateSession={handleChangeLinkedAccounts}
              updateProxy={handleChangeProxy}
              updateSubscription={(newStatus) => { handleChangeSubscriptionStatus(newStatus); }}
              version={sessionVersion}
            />
          </React.Fragment>
        }
        <Box m={2}>
          <Paper component={Box} variant={'outlined'}>
            <Box mt={1} py={1} px={3} borderBottom={2}>
              <Box flexGrow={1}>
                <Typography variant='h6'>Log-in Management</Typography>
              </Box>
            </Box>
          </Paper>
          <Paper
            component={Box}
            p={3}
            variant='outlined'
            display='flex'
            flexDirection='row'
            justifyContent='center'
            alignItems='center'>
            <Box flexGrow={2} display='flex' flexDirection='column'>
              <form className={classes.root} noValidate autoComplete='off'>
                <div>
                  <Box
                    display="flex"
                    pt={2}
                    flexDirection='column'
                    justifyContent="center"
                  >
                    <Typography className={classes.lineTextWithTopMargin}>Require a password to log in?</Typography>
                    <Box flexGrow={2} display='flex' alignItems='center'
                      justifyContent='flex-start' marginTop={-1} marginBottom={2} flexDirection='row'>
                      <Typography className={localData.requirePassword ? classes.radioText : classes.radioTextBold}>Simplfied Log-in</Typography>
                      <Switch
                        checked={!!localData.requirePassword}
                        onChange={() => {
                          localData.requirePassword = !localData.requirePassword;
                          setRefreshTrigger(!refreshTrigger);
                          setChanges(true);
                        }} name="PWDrequired"
                        color="primary"
                      />
                      <Typography className={localData.requirePassword ? classes.radioTextBold : classes.radioText}>Password Required</Typography>
                    </Box>
                    <Typography className={classes.lineTextWithTopMargin}>Allow my password to be stored</Typography>
                    <Box flexGrow={2} display='flex' alignItems='center'
                      justifyContent='flex-start' marginTop={-1} marginBottom={2} flexDirection='row'>
                      <Typography className={localData.storePassword ? classes.radioText : classes.radioTextBold}>No</Typography>
                      <Switch
                        checked={localData.storePassword}
                        onChange={() => {
                          localData.storePassword = !localData.storePassword;
                          setRefreshTrigger(!refreshTrigger);
                          setChanges(true);
                        }}
                        name="PWDstored"
                        color="primary"
                      />
                      <Typography className={localData.storePassword ? classes.radioTextBold : classes.radioText}>Yes</Typography>
                    </Box>
                    {localData.last_login && localData.storePassword &&
                      <Typography className={classes.lineTextWithTopMargin}>{`Last known password: ${localData.last_login}`}</Typography>
                    }
                    {patientPChange &&
                      <Typography className={classes.lineTextWithTopMargin}>{`Password changed: ${patientPChange.split('GMT')[0]} GMT`}</Typography>
                    }
                  </Box>
                </div>
              </form>
              <Box flexGrow={2} display='flex' alignItems='center'
                justifyContent='flex-start' marginTop={2} marginBottom={2} flexDirection='row'>
                <Button
                  onClick={handleResetPassword1}
                  disabled={resettingPwd && !pwdConfirmed}
                  variant='outlined'
                  className={classes.infoButton}
                >
                  Reset?
                </Button>
                {resettingPwd &&
                  <React.Fragment>
                    <Button
                      onClick={handleResetPassword2}
                      disabled={!resettingPwd || pwdConfirmed}
                      hidden={!resettingPwd}
                      variant={pwdConfirmed ? 'contained' : 'outlined'}
                      className={classes.resetButton}
                    >
                      {pwdConfirmed ? 'Confirmed!' : 'Confirm?'}
                    </Button>
                    <TextField
                      id='password'
                      value={localData.inputPWD}
                      autoComplete='off'
                      type='text'
                      onChange={handleChangePassword}
                      helperText={'password'}
                    />
                  </React.Fragment>
                }
              </Box>
            </Box>
          </Paper>
        </Box>
      </Dialog >
      :
      <Dialog open={open} TransitionComponent={Transition} fullScreen>
        <AppBar>
          <Toolbar>
            <IconButton color='inherit' edge='start' onClick={handleAbort}>
              <CloseIcon />
            </IconButton>
            <Typography variant='h6' className={classes.title}>
              {patient?.name?.first} {patient?.name?.last}
            </Typography>
            {(changes || pwdConfirmed || photoChanges) && !editPhoto &&
              <Button
                onClick={handleUpdate}
                disabled={!changes && !pwdConfirmed}
                hidden={!changes && !pwdConfirmed}
                variant='contained'
                className={classes.topButton}
              >
                {'Save'}
              </Button>
            }
          </Toolbar>
        </AppBar>
        <Toolbar />
        <Box m={2}>
          <Paper component={Box} variant={'outlined'}>
            <Box mt={1} py={1} px={3} borderBottom={2}>
              <Box flexGrow={1}>
                <Typography variant='h6'>Profile</Typography>
              </Box>
            </Box>
          </Paper>
          <Paper
            component={Box}
            p={3}
            variant='outlined'
            display='flex'
            flexDirection='row'
            justifyContent='center'
            alignItems='center'>
            <Box flexGrow={2} display='flex' flexDirection='column'>
              <Box
                display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                key={'loadingBox'}
                ml={2} mr={2}
              >
                <Typography variant='h5' className={classes.lastName} >{`Loading`}</Typography>
                <CircularProgress />
              </Box>
            </Box>
          </Paper>
        </Box>
      </Dialog>
  );
};
