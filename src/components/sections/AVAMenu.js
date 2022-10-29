import React from 'react';
import { Lambda } from 'aws-sdk';
import { Auth } from '@aws-amplify/auth';
import { useSnackbar } from 'notistack';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { useCookies } from 'react-cookie';

import IdleTimer from 'react-idle-timer';
import avaAlert from '../../ava_alert.mp3';

import useSession from '../../hooks/useSession';
import SwitchPatientDialog from '../dialogs/SwitchPatientDialog';
import PatientDialog from '../dialogs/PatientDialog';
import NewFactDialog from '../dialogs/NewFactDialog';
import AVAConfirm from '../forms/AVAConfirm';

import List from '@material-ui/core/List';
import Box from '@material-ui/core/Box';
import Avatar from '@material-ui/core/Avatar';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import Dialog from '@material-ui/core/Dialog';
import Button from '@material-ui/core/Button';

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';
import Card from '@material-ui/core/Card';
import CardMedia from '@material-ui/core/CardMedia';

import Collapse from '@material-ui/core/Collapse';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import EditIcon from '@material-ui/icons/PersonOutlineOutlined';
import FavoriteIcon from '@material-ui/icons/FavoriteBorder';
import NotFavorite from '@material-ui/icons/DeleteForever';
import FaceIcon from '@material-ui/icons/Face';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import CircularProgress from '@material-ui/core/CircularProgress';
import DeleteIcon from '@material-ui/icons/DeleteOutlineRounded';
import ReplyIcon from '@material-ui/icons/ReplyOutlined';

import Tooltip from '@material-ui/core/Tooltip';

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
  avatar: {
    marginTop: 0,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    marginBottom: 0,
    paddingTop: 0,
    fontSize: '1.3rem',
  },
  logoSmall: {
    maxWidth: '100px',
    marginBottom: '15px'
  },
  popUpMenuButton: {
    alignContent: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    marginBottom: 0,
    paddingTop: 0,
    fontSize: '1.3rem',
  },
  popUpMenu: {
    marginRight: theme.spacing(3),
    paddingRight: 2,
  },
  title: {
    marginTop: 0,
    marginLeft: 0,
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  hello: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  messageScroll: {
    maxHeight: 100,
    marginTop: 1,
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: 0,
    fontSize: '0.8rem',
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
  },
  rowButtonBlue: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
  },
  listItem: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
  },
  sectionHeader: {
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
  messageArea: {
    alignItems: 'flex-start',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  profileArea: {
    alignItems: 'center'
  },
  popUpMenuRow: {
    marginLeft: theme.spacing(1),
    fontSize: theme.typography.fontSize * 1.0,
  },
  popUpFooter: {
    fontSize: theme.typography.fontSize * 0.8,
  },
  logoDisplay: {
    maxWidth: '600px',
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
  lastName: {
    fontWeight: 'bold',
    marginRight: theme.spacing(1),
  },
  boldCenter: {
    fontWeight: 'bold',
    textAlign: 'center'
  }
}));

const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

export default ({ pPerson, patient, pClient, isMobile, onReset }) => {

  const classes = useStyles();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const { state } = useSession();
  const { roles, session } = state;

  const [selected, setSelected] = React.useState(null);

  const [, , removeCookie] = useCookies(['AVAuser']);

  const [mainMenu, setMainMenu] = React.useState([]);
  const [messageText, setMessageText] = React.useState('');
  const [imageURL, setImageURL] = React.useState('');
  const [greetingName, setGreetingName] = React.useState('');
  const [greetingTime, setGreetingTime] = React.useState('');
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const [pendingFact, setPendingFact] = React.useState('');

  const [currentMenu, setCurrentMenu] = React.useState('main');
  const [menuArray, setMenuArray] = React.useState(['main']);
  const [menuNames, setMenuNames] = React.useState([]);
  const [sectionOpen, setSectionOpen] = React.useState();
  const [showPersonSelect, setShowPersonSelect] = React.useState(false);
  const [showProfileEdit, setShowProfileEdit] = React.useState(false);
  const [switchToSelf, setSwitchToSelf] = React.useState(false);
  const [showNewFactDialog, setShowNewFactDialog] = React.useState(-1);
  const [needsConfirmation, setNeedsConfirmation] = React.useState(-1);
  const [toggleClick, setToggleClick] = React.useState(false);
  const [rowOpen, setRowOpen] = React.useState(-1);
  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [loading, setLoading] = React.useState('Initializing');

  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  let currentSection = '';

  const oneHour = 1 * 1000 * 60 * 60;

  const imageBucket = 'theseus-medical-storage';
  const imageURI = 'public/patients/[person_id].jpg';

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let testMode = ['l', 't'].includes(session?.status?.environment);
  let params = {
    FunctionName: `arn:aws:lambda:us-east-1:125549937716:function:${testMode ? 'TestAVAMenu' : 'MakeAVAMenu'}`,
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  var idleTimer = null;

  const buildMenu = async (pFlavor = 'retrieve') => {
    let personRec = await dbClient
      .get({
        Key: { person_id: pPerson },
        TableName: "People"
      })
      .promise()
      .catch(error => { console.log(`caught error getting People record; error is:`, error); });
    if (!recordExists(personRec)) {
      enqueueSnackbar(`AVA encountered an error while retrieving your Menu information.`,
        { variant: 'error', persist: true }
      );
      return;
    }
    patient = personRec.Item;
    // AVA_section_open in People record, or (legacy code) current_event in SessionV2 record
    // is used to save what the screen looked like last time the user was in AVA
    let menuRec = await dbClient
      .get({
        Key: { person_id: pPerson },
        TableName: "AVAMenu"
      })
      .promise()
      .catch(error => { console.log(`caught error getting People record; error is:`, error); });
    if (recordExists(menuRec) && ('AVA_section_open' in menuRec.Item)) {
      setSectionOpen(menuRec.Item.AVA_section_open);
    }
    else {
      if (session?.current_event) {
        if (typeof (session?.current_event) === 'object') {
          setSectionOpen(session.current_event);
        }
        else {
          setSectionOpen(JSON.parse(session.current_event));
        }
      }
      else {
        setSectionOpen({});
      }
    }
    // 'retrieve' in pFlavor means "get AVA options as they were at the last load"
    if (pFlavor === 'retrieve' && recordExists(menuRec) && (menuRec.Item.AVA_main_menu.length > 0)) {
      setMainMenu(menuRec.Item.AVA_main_menu);
      return patient.AVA_main_menu;
    }
    // otherwise, reload from scratch, without regard to the prior stored menu options ('main_menu' in pFlavor forces this)
    let invokeFailed = false;
    testMode = ['l', 't'].includes(session?.status?.environment);
    params.FunctionName = `arn:aws:lambda:us-east-1:125549937716:function:${testMode ? 'TestAVAMenu' : 'MakeAVAMenu'}`;
    params.Payload = JSON.stringify({
      test: false,
      action: 'main_menu',
      client_id: pClient,
      request: {
        person_id: pPerson,
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while retrieving Menu.  Error is ${err.message}`,
          { variant: 'error', persist: true }
        );
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let MakeAVAMenuResponse = JSON.parse(fResp.Payload);
      if (MakeAVAMenuResponse.status === 200) {
        setMainMenu(MakeAVAMenuResponse.body);
        return MakeAVAMenuResponse.body;
      }
      else if (MakeAVAMenuResponse.status === 201) {
        enqueueSnackbar(`AVA didn't find any options for you.  Ask AVA Support to check on this.`,
          { variant: 'error', persist: true }
        );
        let helpRow = {
          activity_class: 'message',
          activity_code: 'message.chubbie_request',
          activity_name: 'Send a message to AVA Support',
          child_menu: null,
          default_value: null,
          menu_name: 'help',
          parent_menu: null,
          row_color: '#a1adb8',
          row_type: 'message',
          section_color: '#a1adb8',
          section_icon: 'https://ava-icons.s3.amazonaws.com/icons8-new-message-50.png',
          section_name: 'Get AVA Help',
          sort_key: 'Messages, Comments, and Feedback'
        };
        setSectionOpen({ 'Get AVA Help': true });
        setMainMenu([helpRow]);
        return [helpRow];
      }
    }
    // if we got here, we couldn't figure out what to return, so send back empty
    return [];
  };

  const updateSession = async (pOpen) => {
    dbClient
      .update({
        Key: { person_id: pPerson },
        UpdateExpression: 'set AVA_section_open = :o',
        ExpressionAttributeValues: {
          ':o': pOpen
        },
        TableName: "AVAMenu",
      })
      .promise()
      .catch(error => {
        console.log(`AVA couldn't update your Menu settings.  Error is ${error}`);
      });
    dbClient
      .update({
        Key: { session_id: session.user_id },
        UpdateExpression: 'set current_event = :e',
        ExpressionAttributeValues: {
          ':e': JSON.stringify(pOpen)
        },
        TableName: "SessionsV2",
      })
      .promise()
      .catch(error => { console.log(`caught error updating SessionsV2; error is:`, error); });
  };

  const replyToMessage = async (pMessage_id) => {
    return;
  };

  const deleteMessage = async (pMessage_id) => {
    await dbClient
      .update({
        Key: { message_id: pMessage_id },
        UpdateExpression: 'set delete_flag = :t',
        ExpressionAttributeValues: {
          ':t': true
        },
        TableName: "Messages",
      })
      .promise()
      .catch(error => {
        enqueueSnackbar(`AVA couldn't delete that message.  Error is ${error}`,
          { variant: 'error', persist: true }
        );
        return;
      });
  };

  const getMessage = async (pPerson) => {
    let now = new Date().getTime();
    let queryObj = {
      KeyConditionExpression: 'recipient_id = :p and posted_time > :t',
      ExpressionAttributeValues: {
        ':p': pPerson,
        ':t': now - (24 * oneHour),
      },
      TableName: "Messages",
      IndexName: 'recipient_id-index',
      ScanIndexForward: false,
      Limit: 10
    };
    let mRecs = await dbClient
      .query(queryObj)
      .promise()
      .catch(error => {
        console.log({ 'Error reading Messages': error });
        mRecs = { 'Count': 0 };
      });
    if (mRecs.Count === 0) { mRecs.Items = []; }
    queryObj = {
      KeyConditionExpression: 'sender_id = :p and posted_time > :t',
      FilterExpression: 'common_key = :msr and recipient_address <> :s',
      ExpressionAttributeValues: {
        ':p': pPerson,
        ':t': now - oneHour,
        ':msr': 'message_status_record',
        ':s': 'self'
      },
      TableName: "Messages",
      IndexName: 'sender_id-index',
      ScanIndexForward: false,
    };
    let sRecs = {};
    sRecs = await dbClient
      .query(queryObj)
      .promise()
      .catch(error => {
        console.log({ 'Error reading Messages': error });
      });
    if ('Items' in sRecs) {
      mRecs.Items.push(...(sRecs.Items));
      mRecs.Count += sRecs.Count;
      mRecs.Items.sort((a, b) => {
        if (a.posted_time > b.posted_time) { return -1; }
        else { return 1; }
      });
    }
    if (mRecs.Count > 0) {
      for (let mNum = 0; mNum < mRecs.Count; mNum++) {
        let msg = mRecs.Items[mNum];
        if (msg.hasOwnProperty('delete_flag') && !!msg.delete_flag) {
          continue;   // message marked for deletion.  Check next one.
        }
        let httpAt = msg.message_content.indexOf('http');
        if (httpAt > -1) {
          msg.message_content = msg.message_content.substring(0, httpAt);
        }
        if (!msg.message_content.startsWith('Message from') && (msg.sender_id !== pPerson)) {
          msg.message_content = `From ${msg.sender_name}: ${msg.message_content}`;
        }
        let foundMessage = msg.message_content + '$~~$' + msg.message_id + '$~~$' + ((msg.recipient_id === pPerson) ? 'to' : 'from');
        setMessageText(foundMessage);
        return foundMessage;
      }
    }
    if (messageText) {
      let [, mTime, mStatus] = messageText.split('$~~$');
      if ((mStatus !== 'status') || (Number(mTime) < (now - oneHour))) {
        setMessageText(null);
        return null;
      }
    }
    return messageText;
  };

  async function putMedia(newFact) {
    let newName = newFact.value?.freeText?.Title || newFact.value.mediaData.Key;
    if (newFact.value?.mediaData?.ContentType?.includes('video') || newFact.value?.mediaData?.Body?.type?.includes('video')) {
      let fileExtension = newFact.value.mediaData.Key.split('.').pop();
      let destinationName = newName.trim().replace(/[\s/]/g, '_').split('.')[0];
      newFact.value.mediaData.Key = destinationName + '.' + fileExtension;
    }
    let mediaData = newFact.value.mediaData;
    enqueueSnackbar(`AVA is saving ${newName}...`, { variant: 'info', persist: true });
    let uploadOK = true;
    let uploadResult = await s3
      .putObject(mediaData)
      .promise()
      .catch(err => {
        uploadOK = false;
        enqueueSnackbar(`Uh oh!  AVA couldn't save that.  The reason is ${err.message}`,
          { variant: 'error', persist: true });
      });
    if (uploadOK) {
      enqueueSnackbar(`${newName} is saved!`, { variant: 'success', persist: false });
      return uploadResult.Key;
    };
    return null;
  }

  const addToFavorites = async (activityRow) => {
    let personRec = await dbClient
      .get({
        Key: { person_id: pPerson },
        TableName: "People"
      })
      .promise()
      .catch(error => { console.log(`caught error getting People record; error is:`, error); });
    if (recordExists(personRec)) {
      let favoriteList = [];
      if ('favorite_activities' in personRec.Item) {
        favoriteList = personRec.Item.favorite_activities;
      }
      favoriteList.push(activityRow.activity_code);
      let favoriteBlocked = [];
      if ('favorite_blocked' in personRec.Item) {
        favoriteBlocked = personRec.Item.favorite_blocked;
        let indexAt = favoriteBlocked.findIndex(r => { return (r === activityRow.activity_code); });
        if (indexAt > -1) { favoriteBlocked.splice(indexAt, 1); }
      }
      await dbClient
        .update({
          Key: { person_id: pPerson },
          UpdateExpression: 'set favorite_activities = :f, favorite_blocked = :b',
          ExpressionAttributeValues: {
            ':f': favoriteList,
            ':b': favoriteBlocked
          },
          TableName: "People",
        })
        .promise()
        .catch(error => {
          enqueueSnackbar(`AVA couldn't update your Favorites.  Error is ${error}`,
            { variant: 'error', persist: true }
          );
          return;
        });
      setLoading('Resetting your Favorites');
      setForceRedisplay(!forceRedisplay);
      makeGreeting();
      await getMessage(pPerson);
      await buildMenu('main_menu');
      setLoading(false);
      setForceRedisplay(!forceRedisplay);
    }
    return;
  };

  const removeFromFavorites = async (activityRow) => {
    let personRec = await dbClient
      .get({
        Key: { person_id: pPerson },
        TableName: "People"
      })
      .promise()
      .catch(error => { console.log(`caught error getting People record; error is:`, error); });
    if (recordExists(personRec)) {
      let favoriteList = [];
      if ('favorite_activities' in personRec.Item) {
        favoriteList = personRec.Item.favorite_activities;
      }
      let indexAt = favoriteList.findIndex(r => { return (r === activityRow.activity_code); });
      if (indexAt > -1) { favoriteList.splice(indexAt, 1); }
      let favoriteBlocked = [];
      if ('favorite_blocked' in personRec.Item) {
        favoriteBlocked = personRec.Item.favorite_blocked;
      }
      favoriteBlocked.push(activityRow.activity_code);
      await dbClient
        .update({
          Key: { person_id: pPerson },
          UpdateExpression: 'set favorite_activities = :f, favorite_blocked = :b',
          ExpressionAttributeValues: {
            ':f': favoriteList,
            ':b': favoriteBlocked
          },
          TableName: "People",
        })
        .promise()
        .catch(error => {
          enqueueSnackbar(`AVA couldn't update your Favorites.  Error is ${error}`,
            { variant: 'error', persist: true }
          );
          return;
        });
      makeGreeting();
      await getMessage(pPerson);
      setLoading(`Removing ${activityRow.activity_name.substring(0, 15).trim()}... from Favorites`);
      setForceRedisplay(!forceRedisplay);
      await buildMenu('main_menu');
      setLoading(false);
      setForceRedisplay(!forceRedisplay);
    }
    return;
  };

  const onSaveFact = async (pFact, pFactName, pIndex) => {
    if (typeof (pFact.value) === 'string') { putFact(pFact, pFactName, pIndex); }
    else {
      let factFlavor = pFact.activity_key.split('.')[0];
      if (factFlavor === 'action' || !pFact.value.hasOwnProperty('selected')) { }
      else {
        setPendingFact(pFact);
        let foundText = [];
        let valueArray = pFact.value.selected.map(selection => {
          if (pFact.value.freeText.hasOwnProperty(selection)) {
            let freeText = pFact.value.freeText[selection];
            foundText.push(selection);
            return `${selection} = ${freeText}`;
          }
          else {
            return selection;
          }
        });
        for (const key in pFact.value.freeText) {
          if (key !== '%filter%' && !foundText.includes(key)) {
            valueArray.push(`${key} = ${pFact.value.freeText[key]}`);
          }
        }
        let isMedia = (pFact.value.hasOwnProperty('mediaData'));
        let isForm = (factFlavor === 'form' || factFlavor === 'message');
        if (isMedia) {
          let fileName = await putMedia(pFact);
          valueArray.unshift(`s3file=${fileName}`, 'Video', `userTag=${pFact.value.tag}`);
        }
        else if (isForm && pFact.status !== 'confirmed') {
          let cMessage = [
            'Review & Confirm please',
            pFactName];
          if (valueArray.length > 0) {
            cMessage.push(
              '~~~~',
              'Your selections are:',
              ...valueArray
            );
          }
          setConfirmMessage(cMessage);
          setNeedsConfirmation(pIndex);
          return;
        }
        pFact.value = (isForm ? 'form_selections' : (isMedia ? 'file_details' : 'selection')) + '.' + valueArray.join(' ~ ');
        if (pFact.value.hasOwnProperty('qualifiers') && Object.keys(pFact.value.qualifiers).length > 0) {
          pFact.qualifier = Object.keys(pFact.value.qualifiers).map(k => {
            return `${k}:${pFact.value.qualifiers[k]}`;
          });
        }
        putFact(pFact, pFactName, pIndex);
        enqueueSnackbar(`${pFactName} successfully completed!`, { variant: 'success' });
      }
    };
    setShowNewFactDialog(-1);
    setForceRedisplay(!forceRedisplay);
  };

  const onNextFact = async () => {
    setShowNewFactDialog(-1);
    setForceRedisplay(!forceRedisplay);
  };

  React.useEffect(() => {
    let response = (
      async () => {
        setLoading('Getting your Information');
        setForceRedisplay(!forceRedisplay);
        getImage(session.patient_id);
        makeName(session.patient_display_name);
        makeGreeting();
        setLoading('Getting recent messages');
        setForceRedisplay(!forceRedisplay);
        await getMessage(session.patient_id);
        setLoading('Building your AVA menu');
        setForceRedisplay(!forceRedisplay);
        await buildMenu('retrieve');
        setLoading(false);
        setForceRedisplay(!forceRedisplay);
      }
    );
    if (mainMenu.length === 0) {
      response();
    }
  }, [pPerson]); // eslint-disable-line react-hooks/exhaustive-deps

  const accessLog = async (pUser, pPwd, pMessage) => {
    var payload =
    {
      'test': false,
      'action': "add_entry",
      'request': {
        'attempted_user': pUser,
        'attempted_password': pPwd,
        'result': pMessage
      }
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:AccessLogMaintenance',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log('Access log call failed.  Error is', JSON.stringify(err));
      });
  };

  const activityLog = (pUser, pCode, pName, pIndex) => {
    let postTime = new Date().getTime();
    let activityLogRec = {
      timestamp: postTime,
      user_id: pUser,
      activity_code: pCode,
      activity_name: pName,
      AVA_version: `22.10.24${window.location.href.split('//')[1].slice(0, 1)}`
    };
    dbClient
      .put({
        Item: activityLogRec,
        TableName: "ActivityLog"
      })
      .promise()
      .catch(error => {
        console.log({ 'Bad put to ActivityLog - caught error is': error });
      });
    mainMenu[pIndex].last_used = postTime;
    resetMainMenu(mainMenu);
  };

  const resetMainMenu = async (pMenu) => {
    dbClient
      .update({
        Key: { person_id: pPerson },
        UpdateExpression: 'set AVA_main_menu = :m',
        ExpressionAttributeValues: {
          ':m': pMenu
        },
        TableName: "AVAMenu",
      })
      .promise()
      .catch(error => {
        console.log(`AVA couldn't update your Menu settings.  Error is ${error}`);
      });
    setMainMenu(pMenu);
  };

  const putFact = async (pFact, pFactName, pIndex) => {
    let postTime = new Date().getTime();
    const newFact = {
      person_id: pFact.patient_id,
      activity_key: (pFact.client_id ? ((pFact.client_id) + '//') : '') + pFact.activity_key,
      value: pFact.value,
      status: 'recorded',
      user_id: pPerson,
      session_id: ((needsConfirmation > -1) ? 'Confirmed' : 'Done'),
      method: 'AVAMenu',
      posted_time: postTime
    };
    if (pFactName.toLowerCase().includes('send a')) {
      setMessageText(`Your ${pFactName.replace(/send a/i, '').trim()} is being processed by AVA. $~~$${postTime}$--$status`);
    }
    else {
      setMessageText(`Your ${pFactName}${pFactName.toLowerCase().includes('request') ? '' : ' request'} is being processed by AVA. $~~$${postTime}$--$status`);
    }
    await dbClient
      .put({
        TableName: 'Facts',
        Item: newFact
      })
      .promise()
      .catch(error => { console.error('Error adding a fact:', error.message); });
  };

  const getActivityDetail = async (pActivity) => {
    let invokeFailed = false;
    let cClient = pClient;
    let cActivity = pActivity;
    if (pActivity.includes('//')) {
      [cClient, cActivity] = pActivity.split('//');
    }
    var payload =
    {
      'test': false,
      'body': {
        "clientId": cClient,
        "personId": pPerson,
        "activityType": `$$${cActivity}`,
        "limit": 100,
        "fact_data": false,
        "historyOnly": false,
        "use_short_date": true,
        "kiosk_mode": false
      }
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:thesesus-activityList',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    let fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log('Call for Activity details failed.  Error is', JSON.stringify(err));
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let activityResponse = JSON.parse(fResp.Payload);
      if (activityResponse.status === 200) {
        if (cClient !== pClient) {
          activityResponse.body.activityData[0].client_id = cClient;
        }
        setSelected(activityResponse.body.activityData[0]);
        return activityResponse.body.activityData[0];
      }
    };
    return [];
  };

  const getActivityHistory = async (pActivity) => {
    let invokeFailed = false;
    let cClient = pClient;
    let cActivity = pActivity;
    if (pActivity.includes('//')) {
      [cClient, cActivity] = pActivity.split('//');
    }
    var payload =
    {
      'test': false,
      'body': {
        "clientId": cClient,
        "personId": pPerson,
        "activityType": `$$${cActivity}`,
        "limit": 100,
        "fact_data": true,
        "historyOnly": true,
        "use_short_date": true,
        "kiosk_mode": false
      }
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:thesesus-activityList',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    let fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log('Call for Activity details failed.  Error is', JSON.stringify(err));
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let activityResponse = JSON.parse(fResp.Payload);
      if (activityResponse.status === 200) {
        setSelected(activityResponse.body.activityData[0]);
        return activityResponse.body.activityData[0];
      }
    };
    return [];
  };

  function getImage(pPerson) {
    setImageURL(s3.getSignedUrl('getObject', {
      Bucket: imageBucket,
      Key: imageURI.replace('[person_id]', pPerson),
      Expires: 3600
    }));
  }

  function recordExists(recordId) {
    if (!recordId) { return false; }
    if (recordId.hasOwnProperty('Count')) { return (recordId.Count > 0); }
    else { return ((recordId.hasOwnProperty("Item") || recordId.hasOwnProperty("Items"))); }
  }

  function makeName(pString) {
    let response = pString.split(':')[0].trim().split(/[\s]+/)[0];
    setGreetingName(response);
    return response;
  }

  function makeGreeting() {
    let current_hour = Number(new Date().toTimeString().split(':')[0]);
    let response = '';
    if (current_hour < 12) { response = 'morning'; }
    else if (current_hour < 17) { response = 'afternoon'; }
    else { response = 'evening'; }
    setGreetingTime(response);
    return response;
  }

  const handleClick = event => {
    setAnchorEl(event.currentTarget);
  };

  let lastColor, lastOpen;
  function rowIsOpen(pRow) {
    if (sectionOpen[pRow.section_name] || (currentMenu !== 'main')) {
      lastOpen = true;
      lastColor = pRow.row_color;
      return true;
    }
    else {
      lastOpen = false;
      return false;
    }
  }

  let idleSince = null;
  let idleStartTime = 0;
  let idleString = '';
  let msInAMinute = 1000 * 60;

  // ******************

  return (
    <Dialog
      open={(true || forceRedisplay)}
      p={2}
      fullScreen
    >
      <React.Fragment>
        {/* Idle timer always running */}
        <IdleTimer
          ref={ref => { idleTimer = ref; }}
          timeout={(session?.kiosk_mode ? 1 : 30) * msInAMinute}   // every "n" minutes
          onAction={(event) => {
            if (idleSince) {
              console.log(`Active at ${new Date().toLocaleString()} on ${event.type}`);
              idleSince = null;
            }
          }}
          onIdle={async () => {
            if (!idleSince) {
              idleSince = idleTimer.getLastActiveTime();
              idleString = new Date(idleSince).toLocaleString();
              idleStartTime = new Date(idleSince).getTime();
              console.log(`Idle since ${idleString}`);
            }
            else {
              console.log(`Still idle at ${new Date().toLocaleString()}`);
              if (session?.kiosk_mode) {
                let checkTime = new Date().getTime() - idleStartTime;
                if (checkTime > (4 * msInAMinute)) {
                  closeSnackbar();
                  await dbClient
                    .update({
                      Key: { session_id: session.user_id },
                      UpdateExpression: 'set patient_id = :p, patient_display_name = :d',
                      ExpressionAttributeValues: {
                        ':p': session.user_id,
                        ':d': session.user_display_name
                      },
                      TableName: "SessionsV2",
                    })
                    .promise()
                    .catch(error => { console.log(`caught error updating SessionsV2; error is:`, error); });
                  let jumpTo = window.location.href.replace('refresh', 'theseus');
                  window.location.replace(jumpTo);
                }
                else if (checkTime > (3 * msInAMinute)) {
                  closeSnackbar();
                  enqueueSnackbar(
                    `Are you still there?  AVA will end your session in 1 minute...`,
                    { variant: 'warning', persist: true }
                  );
                  try { new Audio(avaAlert).play(); }
                  catch (err) {
                    console.log('play sound failed due to browser');
                  }
                }
                else if (checkTime > (2 * msInAMinute)) {
                  closeSnackbar();
                  enqueueSnackbar(
                    `Are you still there?  AVA will end your session in 2 minutes...`,
                    { variant: 'info', persist: true }
                  );
                  try { new Audio(avaAlert).play(); }
                  catch (err) {
                    console.log('play sound failed due to browser');
                  }
                }
              }
              else {
                closeSnackbar();
                setLoading('Idle Time expired - Reloading');
                setForceRedisplay(!forceRedisplay);
                makeGreeting();
                await getMessage(session.patient_id);
                await buildMenu('main_menu');
                setCurrentMenu('main');
                setMenuArray(['main']);
                setMenuNames([]);
                setLoading(false);
                setForceRedisplay(!forceRedisplay);
              }
            }
          }}
          debounce={250}
        />
        {/* Header with Avatar, Message, and VertMenu */}
        <Box
          display='flex' flexDirection='row'
          className={classes.messageArea}
          key={'topBox'}
        >
          <Box
            display='flex' flexDirection='row'
            flexGrow={1}
            className={classes.profileArea}
            key={'personBox'}
            onClick={() => {
              setPopupMenuOpen(false);
              setShowProfileEdit(true);
            }}
          >
            <Tooltip
              className={classes.avatar}
              title={
                <Typography variant='caption'>
                  {session?.kiosk_mode ? 'View/Update not available' : `View/Update ${greetingName}'${greetingName.slice(-1) === 's' ? '' : 's'} Profile`}
                </Typography>
              }
              placement='bottom-start'>
              <Avatar src={imageURL}>
                <FaceIcon />
              </Avatar>
            </Tooltip>
            <Box
              flexGrow={1}
              display='flex'
              overflow='auto'
              flexDirection='column'>
              <Typography
                className={classes.hello}
                id='scroll-dialog-title'
              >
                {`Good ${greetingTime}, ${greetingName}!`}
              </Typography>
              <Typography
                className={classes.hello}
                id='scroll-dialog-title'
              >
                {`Welcome to AVA`}
              </Typography>
            </Box>
          </Box>
          <Box
            className={classes.popUpMenuButton}
            aria-controls='hidden-menu'
            aria-haspopup='true'
            onClick={(event) => {
              handleClick(event);
              setPopupMenuOpen(true);
            }}>
            <Avatar src={'https://ava-icons.s3.amazonaws.com/AVA+Logo.png'} />
          </Box>
          <Menu
            id='hidden-menu'
            anchorEl={anchorEl}
            open={popupMenuOpen}
            onClose={() => { setPopupMenuOpen(false); }}
            keepMounted>
            <MenuList className={classes.popUpMenu}>
              {(session?.patient_id !== session?.user_id) && (
                <MenuItem onClick={() => {
                  setPopupMenuOpen(false);
                  setSwitchToSelf(true);
                }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'switch2self'}
                  >
                    <HomeIcon />
                    <Typography className={classes.popUpMenuRow} >{`Switch to My Profile (${session.user_id})`}</Typography>
                  </Box>
                </MenuItem>
              )}
              {!session?.kiosk_mode && (
                <MenuItem onClick={() => {
                  setPopupMenuOpen(false);
                  setShowProfileEdit(true);
                }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowSwitch'}
                  >
                    <EditIcon />
                    <Typography className={classes.popUpMenuRow} >
                      {`Edit ${greetingName}'${greetingName.slice(-1) === 's' ? '' : 's'} Profile`}
                    </Typography>
                  </Box>
                </MenuItem>
              )
              }
              {session?.responsible_for && (
                <MenuItem onClick={() => {
                  setPopupMenuOpen(false);
                  setShowPersonSelect(true);
                }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowSwitch'}
                  >
                    <SwapHorizIcon />
                    <Typography className={classes.popUpMenuRow} >{'Switch Account'}</Typography>
                  </Box>
                </MenuItem>
              )}
              <MenuItem onClick={async () => {
                await accessLog(session.user_id, `*na*`, `Manual sign-out`);
                removeCookie("AVAuser");
                Auth.signOut().then(() => {
                  let jumpTo = window.location.origin;
                  window.location.replace(jumpTo);
                });
              }}>
                <Box
                  display='flex' flexDirection='row' alignItems={'center'}
                  key={'vRowSignOut'}
                >
                  <ExitToAppIcon />
                  <Typography className={classes.popUpMenuRow} >{'Sign Out'}</Typography>
                </Box>
              </MenuItem>
              <MenuItem onClick={async () => {
                setPopupMenuOpen(false);
                setLoading('Resetting greeting');
                setForceRedisplay(!forceRedisplay);
                makeGreeting();
                setLoading('Checking messages');
                setForceRedisplay(!forceRedisplay);
                await getMessage(session.patient_id);
                setLoading('Refreshing your AVA menu');
                setForceRedisplay(!forceRedisplay);
                await buildMenu('main_menu');
                setCurrentMenu('main');
                setMenuArray(['main']);
                setMenuNames([]);
                setLoading(false);
                setForceRedisplay(!forceRedisplay);
              }
              }>
                <Box
                  display='flex' flexDirection='row' alignItems={'center'}
                  key={'vRowRefresh'}
                >
                  <AutorenewIcon />
                  <Typography className={classes.popUpMenuRow} >{'Refresh'}</Typography>
                </Box>
              </MenuItem>
              <MenuItem>
                <Box
                  display='flex' flexDirection='row' alignItems={'center'}
                  key={'vRowRefresh'}
                >
                  <Typography className={classes.popUpFooter} >{`AVA v22.10.24${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                </Box>
              </MenuItem>
            </MenuList>
          </Menu>
        </Box>
        {/* Loading spinner */}
        {loading &&
          <Box
            display='flex' flexDirection='column' justifyContent='center' alignItems='center'
            key={'loadingBox'}
            ml={2} mr={2} mb={2} mt={20}
          >
            <Card
              className={classes.logoSmall}
              raised={false}
              variant='elevation' elevation={0}
            >
              <CardMedia
                component="img"
                image={'https://ava-icons.s3.amazonaws.com/AVA+Logo.png'}
                alt='AVA'
              />
            </Card>
            <React.Fragment>
              <Box
                display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                key={'loadingBox'}
                mb={2}
              >
                <Typography variant='h5' className={classes.lastName} >{`Loading AVA`}</Typography>
                <Typography variant='caption' >{`version 22.10.24${window.location.href.split('//')[1].slice(0, 1)}`}</Typography>
                <Typography >{loading}</Typography>
              </Box>
              <CircularProgress />
            </React.Fragment>
          </Box>
        }
        {!loading && messageText &&
          <Box
            display='flex' flexDirection='column' justifyContent='center' alignItems='center'
            key={'loadingBox'}
            ml={3} mb={1} mr={3}
          >
            <Box
              display='flex' mt={1} flexDirection='row' justifyContent='center' alignItems='center'
              key={'msgButtonBox'}
            >
              <Typography key={'message'} variant='subtitle2' className={classes.boldCenter}>
                {messageText.split('$~~$')[0]}
              </Typography>
            </Box>
            <Box
              display='flex' flexDirection='row' justifyContent='center' alignItems='center'
            >
              <Button
                onClick={async () => {
                  if (messageText.split('$~~$')[2] !== 'status') {
                    await deleteMessage(messageText.split('$~~$')[1]);
                  }
                  setMessageText(null);
                  getMessage(session.patient_id);
                  setForceRedisplay(!forceRedisplay);
                }}
                className={classes.rowButtonRed}
                startIcon={<DeleteIcon size='small' />}
              >
                {(messageText.split('$~~$')[2] !== 'to') ? 'Hide' : 'Delete'}
              </Button>
              {(messageText.split('$~~$')[2] === 'to') &&
                <Button
                  onClick={async () => {
                    await replyToMessage(messageText.split('$~~$')[1]);
                    getMessage(session.patient_id);
                    setForceRedisplay(!forceRedisplay);
                  }}
                  className={classes.rowButtonBlue}
                  startIcon={<ReplyIcon size='small' />}
                >
                  Reply
                </Button>
              }
            </Box>
          </Box>
        }
        {/* AVA Menu */}
        {mainMenu && mainMenu.length > 0 && !loading &&
          <Paper component={Box} variant='outlined' overflow='auto'>
            <List >
              {currentMenu !== 'main' &&
                <Paper mt={1.5} component={Box} elevation={0} key={'gobacksection'} >
                  <Box
                    display='flex'
                    style={{ borderRadius: '30px 30px 30px 30px', backgroundColor: '#d25958', textDecoration: 'none' }}
                    ml={2} mr={2}
                    justifyContent='center'
                    flexDirection='column'
                    minHeight={80}
                    onClick={async () => {
                      getMessage(session.patient_id);
                      menuArray.pop();
                      setCurrentMenu(menuArray[menuArray.length - 1]);
                      setMenuArray(menuArray);
                      menuNames.pop();
                      setMenuNames(menuNames);
                      setForceRedisplay(!forceRedisplay);
                    }}
                  >
                    <Box
                      display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                      key={'goback row'}
                      className={classes.sectionHeader}
                    >
                      <Avatar
                        src={`https://ava-icons.s3.amazonaws.com/back.png`}
                        sx={{ width: 30, height: 30 }}
                        alt=""
                        variant="square"
                      />
                      <Box display='flex' ml={2} mr={5} flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'>
                        <Box display='flex' flexDirection='column'>
                          <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                            <Typography variant='h5' className={classes.lastName} >{`Return to ${menuNames[menuNames.length - 1]}`}</Typography>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Paper>
              }
              {mainMenu.map((this_row, index) => (
                ((this_row.menu_name === currentMenu) &&
                  <React.Fragment
                    key={this_row.activity_code + 'fragment' + index}
                  >
                    {currentSection !== this_row.section_name &&
                      <React.Fragment
                        key={'on-section-break' + index}
                      >
                        {(index > 0) && lastOpen &&
                          <Box
                            display='flex'
                            style={{
                              borderRadius: '0px 0px 30px 30px',
                              backgroundColor: lastColor,
                              textDecoration: 'none'
                            }}
                            ml={2} mr={2}
                            justifyContent='center'
                            flexDirection='column'
                            height={30}
                          />}
                        <Paper ml={2} mr={2} mt={1.5} elevation={0} component={Box} key={this_row.activity_code + 'section' + index} >
                          <Box
                            display='flex'
                            style={{ borderRadius: ((sectionOpen[this_row.section_name] || (currentMenu !== 'main')) ? '30px 30px 0px 0px' : '30px 30px 30px 30px'), backgroundColor: this_row.section_color, textDecoration: 'none' }}
                            justifyContent='center'
                            flexDirection='column'
                            minHeight={80}
                            onClick={async () => {
                              sectionOpen[this_row.section_name] = !sectionOpen[this_row.section_name];
                              setSectionOpen(sectionOpen);
                              await updateSession(sectionOpen);
                              setForceRedisplay(!forceRedisplay);
                            }}
                          >
                            <Box
                              display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                              key={this_row.activity_code + 'r' + index}
                              className={classes.sectionHeader}
                            >
                              <Box flex={1} justifyContent='flex-start' alignItems='center'>
                                <Avatar
                                  src={this_row.section_icon}
                                  sx={{ width: 30, height: 30 }}
                                  alt=""
                                  variant="square"
                                />
                              </Box>
                              <Box display='flex' flex={4} justifyContent='center' alignItems='center'>
                                <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                                  {(currentSection = this_row.section_name)}
                                </Typography>
                                <Typography variant='h5' className={classes.boldCenter} >{this_row.section_name.trim()}</Typography>
                              </Box>
                              <Box flex={1} display='flex' justifyContent='flex-end' alignItems='center'>
                                {!sectionOpen[this_row.section_name] ? 'Show' : 'Hide'}
                              </Box>
                            </Box>
                          </Box>
                        </Paper>
                      </React.Fragment>
                    }
                    {rowIsOpen(this_row) &&
                      <Paper component={Box} elevation={0}
                        ml={2} mr={2} mt={.2} mb={.2} key={this_row.activity_code + 'detail' + index} >
                        <Box
                          display='flex'
                          style={{ borderRadius: '0px 0px 0px 0px', backgroundColor: this_row.row_color, textDecoration: 'none' }}
                          p={2}
                          justifyContent='center'
                          flexDirection='column'
                          minHeight={60}
                        >
                          <Box
                            display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                            key={this_row.activity_code + 'detailrow' + index}
                            className={classes.listItem}
                            onContextMenu={async (e) => {
                              e.preventDefault();
                              enqueueSnackbar(`AVA function=${this_row.activity_code} **** type=${this_row.row_type} **** reason=${this_row.reason} **** user=${session.user_id}`, { variant: 'info', persist: true });
                            }}
                          >
                            <Box
                              display='flex'
                              mr={2}
                              flexGrow={1}
                              flexDirection='row'
                              justifyContent='space-between'
                              alignItems='center'
                              onClick={async () => {
                                activityLog(pPerson, this_row.activity_code, this_row.activity_name, index);
                                if (!toggleClick && (this_row.row_type !== 'document')) {
                                  if (this_row.child_menu) {
                                    setCurrentMenu(this_row.child_menu);
                                    menuArray.push(this_row.child_menu);
                                    setMenuArray(menuArray);
                                    menuNames.push((currentMenu === 'main') ? 'AVA Main Menu' : this_row.section_name);
                                    setMenuNames(menuNames);
                                    setForceRedisplay(!forceRedisplay);
                                  }
                                  else {
                                    await getActivityDetail(this_row.activity_code);
                                    setShowNewFactDialog(index);
                                  }
                                }
                                setToggleClick(false);
                              }}
                            >
                              {this_row.row_type === 'document' ?
                                <a href={this_row.default_value + (!this_row.default_value?.includes('?') ? ('?a=' + new Date().getTime()) : '')} style={{ color: 'inherit', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
                                  <Typography variant='h5'>{this_row.activity_name}</Typography>
                                </a>
                                :
                                <Typography variant='h5'>{this_row.activity_name}</Typography>
                              }
                            </Box>
                            <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
                              {(this_row.last_used > -1) &&
                                <IconButton
                                  aria-label='showActivities'
                                  size='small'
                                  onClick={async () => {
                                    setToggleClick(true);
                                    if (rowOpen === index) {
                                      setRowOpen(-1);
                                    }
                                    else {
                                      await getActivityHistory(this_row.activity_code);
                                      setRowOpen(index);
                                    }
                                    setForceRedisplay(!forceRedisplay);
                                  }}
                                >
                                  {(rowOpen !== index) ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                                </IconButton>
                              }
                              <IconButton
                                aria-label='showActivities'
                                size='small'
                                onClick={async () => {
                                  (this_row.section_name.includes('favorites') ?
                                    await removeFromFavorites(this_row) :
                                    await addToFavorites(this_row));
                                  setForceRedisplay(!forceRedisplay);
                                }}
                              >
                                {this_row.section_name.includes('favorites') ?
                                  <NotFavorite fontSize="small" /> :
                                  <FavoriteIcon fontSize="small" />
                                }
                              </IconButton>
                            </Box>
                          </Box>
                        </Box>
                        <Collapse in={(rowOpen === index)} timeout="auto" unmountOnExit>
                          <Box
                            style={{ borderRadius: '0px 0px 0px 0px', backgroundColor: this_row.row_color, textDecoration: 'none' }}
                            display='flex'
                            flexDirection='row' paddingBottom={1} justifyContent='flex-start' alignItems='center'
                          >
                            {(rowOpen === index) &&
                              <Box display={'block'} ml={5} mr={2} pb={2}>
                                {(selected && ('fact_history' in selected) && (selected.fact_history.length > 0)) ?
                                  selected.fact_history.map((hItem, hNdx) => (
                                    <Typography key={selected.activity_key + 'h' + hNdx} variant='body2'>
                                      {hNdx > 0 ? <br /> : null}
                                      {new Date(hItem.posted_time).toLocaleString()} <br /> <strong> {hItem.value.replace('.', '^').split('^')[1]} </strong>
                                    </Typography>
                                  )) :
                                  <Typography key={'nohistory'} variant='body2'>
                                    <strong> {`Last used ${new Date(this_row.last_used).toLocaleString()}`} </strong>
                                  </Typography>
                                }
                              </Box>
                            }
                          </Box>
                        </Collapse>
                      </Paper>
                    }
                  </React.Fragment>
                )
              ))}
              {sectionOpen[mainMenu[mainMenu.length - 1].section_name] && <Box
                display='flex'
                style={{
                  borderRadius: '0px 0px 30px 30px',
                  backgroundColor: lastColor,
                  textDecoration: 'none'
                }}
                ml={2} mr={2}
                justifyContent='center'
                flexDirection='column'
                height={30}
              />}
            </List>
          </Paper>
        }
        {showPersonSelect &&
          <SwitchPatientDialog
            open={showPersonSelect}
            roles={roles}
            onClose={() => {
              setShowPersonSelect(false);
            }}
          />
        }
        {switchToSelf &&
          <SwitchPatientDialog
            forceSwitch={`${session.user_display_name}:${session.user_id}`}
            open={showPersonSelect}
            roles={roles}
            onClose={() => {
              setShowPersonSelect(false);
            }}
          />
        }
        {showProfileEdit &&
          <PatientDialog
            patient={patient}
            open={true}
            onClose={() => {
              setShowProfileEdit(false);
            }}
          />
        }
        {/* Launch Children */}
        {(showNewFactDialog > -1) &&
          <NewFactDialog
            fact={selected}
            session={session}
            open={true}
            fromHome={false}
            onClose={async (oopsieMessage = null) => {
              oopsieMessage && (enqueueSnackbar(oopsieMessage, { variant: 'error', persist: true }));
              setShowNewFactDialog(-1);
              if (session?.url_parameters && ('activity' in session.url_parameters) && ('user' in session.url_parameters)) {
                let jumpTo = window.location.href.replace('theseus', 'thankyou').split('?')[0];
                jumpTo += `?user=${session.url_parameters.user}`;
                window.location.replace(jumpTo);
              }
              await getMessage(pPerson);
            }}
            onSave={
              async (pResult) => {
                if ('client_id' in selected) { pResult.client_id = selected.client_id }
                onSaveFact(pResult, selected.name, showNewFactDialog);
              }
            }
            onNext={onNextFact}
            onSelected={() => { }}
          />
        }
        {/* Confirm Fact before saving */
          (needsConfirmation > -1) &&
          <AVAConfirm
            promptText={confirmMessage}
            onCancel={() => {
              setNeedsConfirmation(-1);
              setForceRedisplay(!forceRedisplay);
            }}
            onConfirm={async () => {
              pendingFact.status = 'confirmed';
              onSaveFact(pendingFact, selected.name, needsConfirmation);
              setNeedsConfirmation(-1);
            }}
          >
          </AVAConfirm>
        }
      </React.Fragment >
    </Dialog >
  );
};;