import React from 'react';
import { Lambda } from 'aws-sdk';
import { Auth } from '@aws-amplify/auth';
import { useSnackbar } from 'notistack';
import { recordExists, cl, resolveVariables } from '../../util/AVAUtilities';
import { makeTime } from '../../util/AVADateTime';
import { getImage } from '../../util/AVAPeople';
import { makeObservationList } from '../../util/AVAObservations';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import { useCookies } from 'react-cookie';
import IdleTimer from 'react-idle-timer';
import useSession from '../../hooks/useSession';
import SwitchPatientDialog from '../dialogs/SwitchPatientDialog';
import PatientDialog from '../dialogs/PatientDialog';
import NewFactDialog from '../dialogs/NewFactDialog';
import AVAConfirm from '../forms/AVAConfirm';
import MakeAVAMenu from '../../util/MakeAVAMenu';

import List from '@material-ui/core/List';
import Box from '@material-ui/core/Box';
import Avatar from '@material-ui/core/Avatar';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import IconButton from '@material-ui/core/IconButton';
import Dialog from '@material-ui/core/Dialog';

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import Collapse from '@material-ui/core/Collapse';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import EditIcon from '@material-ui/icons/PersonOutlineOutlined';
import FavoriteIcon from '@material-ui/icons/FavoriteBorder';
import NotFavorite from '@material-ui/icons/DeleteForever';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import CircularProgress from '@material-ui/core/CircularProgress';
import LinearProgress from '@material-ui/core/LinearProgress';
import PersonAddIcon from '@material-ui/icons/PersonAdd';

import Tooltip from '@material-ui/core/Tooltip';

const useStyles = makeStyles(theme => ({
  page: {
    height: 950,
    maxWidth: 1000
  },
  progressBar: {
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
  avatar: {
    marginTop: 0,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    marginBottom: 0,
    height: 60,
    width: 60,
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
    marginTop: theme.spacing(1),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(2),
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
    fontSize: theme.typography.fontSize * 1.5,
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
    alignItems: 'center',
    justifyContent: 'center',
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

export default ({ pPerson, patient, defaultClient, onReset }) => {

  const classes = useStyles();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const { state } = useSession();
  const { roles, session } = state;

  const [selected, setSelected] = React.useState(null);

  const [, , removeCookie] = useCookies(['AVAuser']);

  const [mainMenu, setMainMenu] = React.useState([]);
  const [greetingName, setGreetingName] = React.useState('');
  const [greetingWords, setGreetingWords] = React.useState('');
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const [pendingFact, setPendingFact] = React.useState('');

  const [currentMenu, setCurrentMenu] = React.useState('main');
  const [menuArray, setMenuArray] = React.useState(['main']);
  const [menuNames, setMenuNames] = React.useState([]);
  const [sectionOpen, setSectionOpen] = React.useState();
  const [showPersonSelect, setShowPersonSelect] = React.useState(false);
  const [showProfileEdit, setShowProfileEdit] = React.useState(false);
  const [showAddAccount, setShowAddAccount] = React.useState(false);
  const [switchToSelf, setSwitchToSelf] = React.useState(false);
  const [showNewFactDialog, setShowNewFactDialog] = React.useState(-1);
  const [needsConfirmation, setNeedsConfirmation] = React.useState(-1);
  const [toggleClick, setToggleClick] = React.useState(false);
  const [rowOpen, setRowOpen] = React.useState(-1);
  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [loading, setLoading] = React.useState('Initializing');
  const [progress, setProgress] = React.useState(100);
  const [pWidth, setPWidth] = React.useState(60);

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [activityLogRecords, setActivityLogRecords] = React.useState([]);

  const [lastActive, setLastActive] = React.useState(new Date().getTime());

  let currentSection = '';

  const oneMinute = 1000 * 60;
  const oneHour = 60 * oneMinute;
  const msBeforeSleeping = 5 * oneMinute;

  let nowTime = new Date().getTime();
  let localLastActive = nowTime;

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  const buildMenu = async (reload = false, beQuiet = null) => {
    let nowTime = new Date().getTime();
    setLastActive(nowTime);
    localLastActive = nowTime;
    setSectionOpen({});

    // AVA_section_open in People record, or (legacy code) current_event in SessionV2 record
    // is used to save what the screen looked like last time the user was in AVA
    let menuRec = await dbClient
      .get({
        Key: { person_id: pPerson },
        TableName: "AVAMenu"
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
        }
        cl(`caught error getting People record; error is:`, error);
      });
    if (recordExists(menuRec)) {
      setSectionOpen(menuRec.Item.AVA_section_open || {});
      if ((menuRec.Item.AVA_main_menu.length > 0) && !reload) {
        cl(`Used cached menu at ${new Date().toLocaleString()}.`);
        setMainMenu(menuRec.Item.AVA_main_menu);
        return menuRec.Item.AVA_main_menu;
      }
    }
    
    let forceRefresh = true;
    let wholeMenu = await MakeAVAMenu(patient, defaultClient, (beQuiet ? screenQuiet : screenStatus), null, forceRefresh);

    if (wholeMenu.length > 0) {
      cl(`Reloaded menu at ${new Date().toLocaleString()}.`);
      await updateAVA(sectionOpen, wholeMenu);
      setMainMenu(wholeMenu);
      return wholeMenu;
    }
    else {
      cl(`Empty menu for ${patient} in ${defaultClient} at ${new Date().toLocaleString()}.`);
      enqueueSnackbar(`AVA didn't find any options for you.  Ask AVA Support to check on this.`,
        { variant: 'error', persist: true }
      );
      let helpRow = {
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
    }
    // end
    return mainMenu;
  };

  const updateAVA = async (pOpen, pMenu) => {
    if (pOpen) {
      dbClient
        .update({
          Key: { person_id: pPerson },
          UpdateExpression: 'set AVA_section_open = :o, AVA_main_menu = :m',
          ExpressionAttributeValues: {
            ':o': pOpen,
            ':m': pMenu
          },
          TableName: "AVAMenu",
        })
        .promise()
        .catch(error => {
          cl(`AVA couldn't update your Menu settings.  Error is ${error}`);
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
        .catch(error => { cl(`caught error updating SessionsV2; error is:`, error); });
    }
    putActivityLog();
  };

  async function putS3Object(pMediaData, pType) {
    enqueueSnackbar(`AVA is saving your ${pType.toLowerCase()} with the name ${pMediaData.Key}`, { variant: 'info', persist: true });
    let uploadOK = true;
    await s3
      .putObject(pMediaData)
      .promise()
      .catch(err => {
        uploadOK = false;
        enqueueSnackbar(`Uh oh!  AVA couldn't save that.  The reason is ${err.message}`,
          { variant: 'error', persist: true });
      });
    if (uploadOK) {
      closeSnackbar();
      enqueueSnackbar(`${pMediaData.Key} was saved successfully`, { variant: 'info', persist: false });
      return pMediaData.Key;
    };
    return null;
  }

  const screenQuiet = (statusMessage) => {
    return;
  };

  const screenStatus = (statusMessage, progressPct, progressWidth) => {
    setLoading(statusMessage);
    setProgress(progressPct);
    setPWidth(progressWidth * 100);
    setForceRedisplay(!forceRedisplay);
  };

  const updateFavorites = async (pType, activityRowIndex) => {
    setLoading('Resetting your Favorites');
    setForceRedisplay(!forceRedisplay);
    makeGreeting();
    let activityRow = mainMenu[activityRowIndex];
    let changeMade = false;
    let personRec = await dbClient
      .get({
        Key: { person_id: pPerson },
        TableName: "People"
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
        }
        cl(`caught error getting People record; error is:`, error);
      });
    if (recordExists(personRec)) {
      // add or remove from the favoriteList as appropriate
      let favoriteList = [];
      if ('favorite_activities' in personRec.Item) {
        favoriteList = personRec.Item.favorite_activities;
      }
      if (!favoriteList.includes(activityRow.activity_code)) {
        if (pType === 'add') {
          favoriteList.unshift(activityRow.activity_code);
          changeMade = true;
        }
      }
      else {
        if (pType === 'remove') {
          let indexAt = favoriteList.findIndex(r => { return (r === activityRow.activity_code); });
          if (indexAt > -1) {
            favoriteList.splice(indexAt, 1);
            changeMade = true;
          }
        }
      }
      // remove from the blockedList if it is in there
      let favoriteBlocked = [];
      if ('favorite_blocked' in personRec.Item) {
        favoriteBlocked = personRec.Item.favorite_blocked;
      }
      if (!favoriteBlocked.includes(activityRow.activity_code)) {
        if (pType === 'remove') {
          favoriteBlocked.push(activityRow.activity_code);
          changeMade = true;
        }
      }
      else {
        if (pType === 'add') {
          let indexAt = favoriteBlocked.findIndex(r => { return (r === activityRow.activity_code); });
          if (indexAt > -1) {
            favoriteBlocked.splice(indexAt, 1);
            changeMade = true;
          }
        }
      }
      // rewrite the People record with the new favorite and blocked lists
      if (changeMade) {
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
        if (pType === 'add') {
          mainMenu[activityRowIndex].is_favorite = true;
          mainMenu.unshift({
            menu_name: 'main',
            sort_key: `**2-0000`,
            section_name: (mainMenu[0].section_name.includes('favorites')
              ? mainMenu[0].section_name
              : `${personRec.name.first.trim()}'${personRec.name.first.trim().slice(-1) === 's' ? '' : 's'} favorites`
            ),
            section_color: '#6bb44b',
            section_icon: 'https://ava-icons.s3.amazonaws.com/icons8-favorite-50.png',
            row_color: '#6bb44b',
            activity_code: activityRow.activity_code,
            activity_name: activityRow.activity_name,
            activity_class: activityRow.activity_class,
            row_type: activityRow.row_type,
            default_value: activityRow.default_value || null,
            parent_menu: null,
            child_menu: activityRow.child_menu,
            reason: 'Favorite',
            last_used: activityRow.last_used,
            is_favorite: true
          });
        }
        else {
          mainMenu.splice(activityRowIndex, 1);
          let bIndex = mainMenu.findIndex(m => {
            return (m.activity_code === activityRow.activity_code);
          });
          if (bIndex > -1) { mainMenu[bIndex].is_favorite = false; }
        };
      }
      setMainMenu(mainMenu);
      setLoading(false);
      setForceRedisplay(!forceRedisplay);
    }
    return;
  };

  const onSaveFact = async (pFact, pFactName, pIndex) => {
    if (typeof (pFact.value) === 'string') { putFact(pFact, pFactName, pIndex); }
    else {
      let factFlavor = pFact.activity_key.split('.')[0];
      if (factFlavor !== 'action'
        && pFact.value.hasOwnProperty('selected')
      ) {
        setPendingFact(pFact);
        let foundText = [];
        let valueArray = pFact.value.selected.map(selection => {    // this adds anything that was selected (checkbox)
          // add qualifiers if applicable
          let constructedQualifier = '';
          if (pFact.value.qualifiers && (selection in pFact.value.qualifiers)) {
            let qArray = [];
            Object
              .keys(pFact.value.qualifiers[selection])
              .forEach(key => {
                if (pFact.value.qualifiers[selection][key].length > 0) {
                  qArray.push(`${key}: ${pFact.value.qualifiers[selection][key].join(' and ')}`);
                }
              });
            if (qArray.length > 0) { constructedQualifier = ` ( ${qArray.join('; ')} )`; }
          }
          if (pFact.value.freeText && pFact.value.freeText.hasOwnProperty(selection)) {
            let freeText = pFact.value.freeText[selection];
            foundText.push(selection);    // we might have free text that is NOT associated with a check box, use foundText to prevent duplication
            return `${selection} = ${freeText}${constructedQualifier}`;
          }
          else {
            return `${selection}${constructedQualifier}`;
          }
        });
        for (const key in pFact.value.freeText) {
          if (key !== '%filter%' && !foundText.includes(key)) {
            let constructedQualifier = '';
            if (pFact.value.qualifiers && (key in pFact.value.qualifiers)) {
              let qArray = [];
              Object
                .keys(pFact.value.qualifiers[key])
                .forEach(subkey => {
                  if (pFact.value.qualifiers[key][subkey].length > 0) {
                    return `${subkey}: ${pFact.value.qualifiers[key][subkey].join(' and ')}`;
                  }
                });
              if (qArray.length > 0) { constructedQualifier = ` ( ${qArray.join('; ')} )`; }
            }
            valueArray.push(`${key} = ${pFact.value.freeText[key]}${constructedQualifier}`);
          }
        }

        let factValueType = 'selection';

        // special cases include forms, messages, and media
        if (factFlavor === 'form' || factFlavor === 'message') {
          if (pFact.status !== 'confirmed') {
            let cMessage = [
              'Review & Confirm please',
              pFactName];
            if (valueArray.length > 0) {
              cMessage.push(
                '~~~~',
                'Your selections are:',
              );
              valueArray.forEach(v => {
                if (v.charAt(0) !== '~') { cMessage.push(v.split(/:/)[0]); }
              });
            }
            setConfirmMessage(cMessage);
            setNeedsConfirmation(pIndex);
            return;
          }
          else {
            factValueType = 'form_selections';
          }
        }
        if (pFact.value.mediaData) {
          let newName = pFact.value?.freeText?.Title || pFact.value.mediaData.Key;
          let fileExtension = pFact.value.mediaData.Key.split('.').pop();
          pFact.value.mediaData.Key = newName.trim().replace(/[\s/.]/g, '_') + '.' + fileExtension;
          let fileType = ((pFact.value.mediaData.ContentType?.includes('video') || pFact.value.mediaData.Body?.type?.includes('video')) ? 'Video' : 'File');
          let fileName = await putS3Object(pFact.value.mediaData, fileType);
          valueArray.unshift(`s3file=${fileName}`, fileType, `userTag=${pFact.value.tag}`);
          factValueType = 'file_details';
        }

        // set the value that will be written into the Fact table
        pFact.value = factValueType + '.' + valueArray.join(' ~ ');

        // write the Fact Table entry
        putFact(pFact, pFactName, pIndex);

        if (factValueType === 'file_details') {
          enqueueSnackbar(`The file upload is done!  AVA needs a minute or two to make it available on menus.`, { variant: 'success' });
        }
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
        makeGreetingName(session.patient_display_name || patient.name.first || pPerson);
        makeGreeting();
        setLoading('Building your AVA menu');
        setForceRedisplay(!forceRedisplay);
        await buildMenu();
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
        cl('Access log call failed.  Error is', JSON.stringify(err));
      });
  };

  const activityLog = (pUser, pCode, pName, pIndex) => {
    let postTime = new Date().getTime();
    let activityLogRec = {
      timestamp: postTime,
      user_id: pUser,
      activity_code: pCode,
      activity_name: pName,
      AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
    };
    let workLog = activityLogRecords;
    workLog.push(activityLogRec);
    setActivityLogRecords(workLog);
    mainMenu[pIndex].last_used = postTime;
    setMainMenu(mainMenu);
    putActivityLog();
  };

  async function putActivityLog() {
    if (activityLogRecords.length > 0) {
      let putObj = activityLogRecords.map(r => {
        return { PutRequest: { Item: r } };
      });
      await dbClient
        .batchWrite({
          RequestItems: { 'ActivityLog': putObj }
        })
        .promise()
        .catch(error => {
          cl(`Bad put to ActivityLog - caught error is: ${error}`);
        });
      setActivityLogRecords([]);
    }
  }

  const putFact = async (pFact, pFactName, pIndex) => {
    let postTime = new Date().getTime();
    const newFact = {
      person_id: pFact.patient_id,
      activity_key: (pFact.client_id ? ((pFact.client_id) + '//') : '') + pFact.activity_key + '#' + postTime,
      value: pFact.value,
      status: 'recorded',
      user_id: pPerson,
      session_id: ((needsConfirmation > -1) ? 'Confirmed' : 'Done'),
      method: 'AVAMenu',
      posted_time: postTime
    };
    if (pFact.commonKey) { newFact.common_key = pFact.commonKey; }
    await dbClient
      .put({
        TableName: 'Facts',
        Item: newFact
      })
      .promise()
      .catch(error => { console.error('Error adding a fact:', error.message); });
    if (pFactName.toLowerCase().includes('send a')) {
      enqueueSnackbar(`AVA is sending your ${pFactName.replace(/send a/i, '').trim()}.`, { variant: 'success' });
    }
    else {
      enqueueSnackbar(`Your ${pFactName.split(/[-/]/)[0]} is being processed by AVA.`, { variant: 'success' });
    }
  };

  const getActivityDetail = async (pActRec) => {
    let resolvedActivity = await makeObservationList(pActRec.activity_rec, session);
    resolvedActivity.activityRec.name = await resolveVariables(pActRec.activity_name, session);
    resolvedActivity.activityRec.default_value = await resolveVariables(pActRec.default_value, session);
    setSelected(resolvedActivity.activityRec);
    return resolvedActivity;
  };

  const getActivityHistory = async (pActivity) => {
    let invokeFailed = false;
    let cClient = defaultClient;
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
        if (err.code === 'NetworkingError') {
          enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
        }
        cl('Call for Activity details failed.  Error is', JSON.stringify(err));
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

  function makeGreetingName(pString) {
    let response = pString.split(':')[0].trim().split(/[\s]+/)[0];
    setGreetingName(response);
    return response;
  }

  function makeExpiration() {
    let sessionObject = JSON.parse(sessionStorage.getItem('AVASessionData'));
    let sTime = new Date((sessionObject?.cognitoSession?.accessToken?.payload?.exp * 1000) || (nowTime + oneHour));
    return `Sess exp ${sTime.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })}`;
  }

  function makeGreeting() {
    if (session?.custom_greeting) {
      setGreetingWords(session.custom_greeting);
      return session.custom_greeting;
    }
    let response = `Good ${makeTime(new Date()).dayPart}`;
    setGreetingWords(response);
    return response;
  }

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  let pendingColor;
  function setPending(pColor) {
    pendingColor = pColor;
    return pColor;
  };

  function clearPending(pColor) {
    pendingColor = null;
    return pColor;
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
          timeout={msBeforeSleeping}   // every "n" minutes
          onIdle={async () => {
            cl(`Idle fired at ${new Date().toLocaleString()}.  Last active at ${new Date(Math.max(lastActive, localLastActive)).toLocaleString()}`);
            makeGreeting();
            await updateAVA(sectionOpen, mainMenu);
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
              <Avatar src={getImage(session.patient_id)} alt={greetingName} />
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
                {`${greetingWords},${isMobile ? '' : (' ' + greetingName + '!')}`}
              </Typography>
              <Typography
                className={classes.hello}
                id='scroll-dialog-title'
              >
                {`${isMobile ? (greetingName + '!') : 'Welcome to AVA'}`}
              </Typography>
            </Box>
          </Box>
          <Box
            component="img"
            ml={isMobile ? 2 : 5}
            mr={2}
            aria-controls='hidden-menu'
            aria-haspopup='true'
            minWidth={isMobile ? 50 : 55}
            maxWidth={isMobile ? 50 : 55}
            onClick={(event) => {
              handleClick(event);
              setPopupMenuOpen(true);
            }}
            alt=''
            src={process.env.REACT_APP_AVA_LOGO}
          />
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
                      {(session.patient_id === session.user_id) ? `Edit your Profile` : `Edit ${greetingName}'${greetingName.slice(-1) === 's' ? '' : 's'} Profile`}
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
              {session?.responsible_for && (
                <MenuItem onClick={() => {
                  setPopupMenuOpen(false);
                  setShowAddAccount(true);
                }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowCreate'}
                  >
                    <PersonAddIcon />
                    <Typography className={classes.popUpMenuRow} >{'Create Account'}</Typography>
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
              <MenuItem
                onClick={async () => {
                  setPopupMenuOpen(false);
                  setLoading('Resetting greeting');
                  setForceRedisplay(!forceRedisplay);
                  makeGreeting();
                  setLoading('Restarting AVA');
                  setForceRedisplay(!forceRedisplay);
                  await updateAVA(sectionOpen, mainMenu);
                  await buildMenu(true);
                  setCurrentMenu('main');
                  setMenuArray(['main']);
                  setMenuNames([]);
                  setLoading(false);
                  setForceRedisplay(!forceRedisplay);
                }}>
                <Box
                  display='flex' flexDirection='row' alignItems={'center'}
                  key={'vRowRefresh'}
                >
                  <AutorenewIcon />
                  <Typography className={classes.popUpMenuRow} >{'Restart AVA'}</Typography>
                </Box>
              </MenuItem>
              <MenuItem>
                <Box
                  display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                  key={'vRowRefresh'}
                >
                  <Typography className={classes.popUpFooter} >{`AVA vers ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                  <Typography className={classes.popUpFooter} >{makeExpiration()}
                  </Typography>
                  <Typography className={classes.popUpFooter} >{`User ${session.user_id}${session.patient_id !== session.user_id ? (' (' + session.patient_id + ')') : ''}`}</Typography>
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
            ml={2} mr={2} mb={2} mt={8}
          >
            <Box
              component="img"
              mb={2}
              minWidth={isMobile ? 150 : 175}
              maxWidth={isMobile ? 150 : 175}
              alt=''
              src={session?.client_logo || process.env.REACT_APP_AVA_LOGO}
            />
            <React.Fragment>
              <Box
                display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                flexWrap='wrap' textOverflow='ellipsis' width='100%'
                key={'loadingBox'}
                mb={2}
              >
                <Typography variant='h5' className={classes.lastName} >{`Loading AVA`}</Typography>
                <Typography variant='caption' >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                {loading.startsWith('Common activities') ?
                  <Box
                    display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                    flexWrap='wrap' textOverflow='ellipsis' width='100%'
                    key={'loadingWordBox'}
                  >
                    <Typography>{'Common activities for'}</Typography>
                    <Typography>{loading.split(' for ')[1]}</Typography>
                  </Box>
                  :
                  <Typography>{loading}</Typography>
                }
              </Box>
              <LinearProgress variant="determinate" className={classes.progressBar} style={{ width: pWidth }} value={progress} />
              <CircularProgress />
            </React.Fragment>
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
                    style={{ borderRadius: '30px 30px 30px 30px', backgroundColor: clearPending('#d25958'), textDecoration: 'none' }}
                    ml={2} mr={2}
                    justifyContent='center'
                    flexDirection='column'
                    minHeight={80}
                    onClick={async () => {
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
                              backgroundColor: clearPending(lastColor),
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
                              await updateAVA(sectionOpen, mainMenu);
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
                                {(currentMenu !== 'main') ? null : (!sectionOpen[this_row.section_name] ? 'Show' : 'Hide')}
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
                          style={{ borderRadius: '0px 0px 0px 0px', backgroundColor: setPending(this_row.row_color), textDecoration: 'none' }}
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
                                  if (this_row.subMenu_data) {
                                    let subMenu = await MakeAVAMenu(patient, defaultClient, screenQuiet, this_row.subMenu_data);
                                    delete mainMenu[index].subMenu_data;
                                    mainMenu.push(...subMenu);
                                    setMainMenu(mainMenu);
                                  }
                                  if (this_row.child_menu) {
                                    setCurrentMenu(this_row.child_menu);
                                    menuArray.push(this_row.child_menu);
                                    setMenuArray(menuArray);
                                    menuNames.push((currentMenu === 'main') ? 'AVA Main Menu' : this_row.section_name);
                                    setMenuNames(menuNames);
                                    setForceRedisplay(!forceRedisplay);
                                  }
                                  else {
                                    await getActivityDetail(this_row);
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
                              {(this_row.is_favorite) ?
                                ((['Favorite', 'History'].includes(this_row.reason)) &&
                                  <IconButton
                                    aria-label='showActivities'
                                    size='small'
                                    onClick={async () => {
                                      await updateFavorites('remove', index);
                                      setForceRedisplay(!forceRedisplay);
                                    }}
                                  >
                                    <NotFavorite fontSize="small" />
                                  </IconButton>)
                                :
                                <IconButton
                                  aria-label='showActivities'
                                  size='small'
                                  onClick={async () => {
                                    await updateFavorites('add', index);
                                    setForceRedisplay(!forceRedisplay);
                                  }}
                                >
                                  <FavoriteIcon fontSize="small" />
                                </IconButton>
                              }
                            </Box>
                          </Box>
                        </Box>
                        <Collapse in={(rowOpen === index)} timeout="auto" unmountOnExit>
                          <Box
                            style={{ borderRadius: '0px 0px 0px 0px', backgroundColor: setPending(this_row.row_color), textDecoration: 'none' }}
                            display='flex'
                            flexDirection='row' paddingBottom={1} justifyContent='flex-start' alignItems='center'
                          >
                            {(rowOpen === index) &&
                              <Box display={'block'} ml={5} mr={2} pb={2}>
                                <Typography key={'nohistory'} variant='body2'>
                                  <strong> {`Last used ${new Date(this_row.last_used).toLocaleString()}`} </strong>
                                </Typography>
                              </Box>
                            }
                          </Box>
                        </Collapse>
                      </Paper>
                    }
                  </React.Fragment>
                )
              ))}
              {(rowIsOpen(mainMenu[mainMenu.length - 1]) || pendingColor) &&
                <Box
                  display='flex'
                  style={{
                    borderRadius: '0px 0px 30px 30px',
                    backgroundColor: clearPending(pendingColor || lastColor),
                    textDecoration: 'none'
                  }}
                  ml={2} mr={2}
                  justifyContent='center'
                  flexDirection='column'
                  height={30}
                />
              }
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
        {showAddAccount &&
          <PatientDialog
            patient={{
              "person_id": `*NEW~${new Date().getTime()}`,
              "client_id": defaultClient,
              "groups": [],
              "name": {
                "first": 'New',
                "last": 'Account'
              },
              "clients": [
                {
                  "groups": [],
                  "id": defaultClient
                }
              ],
            }}
            open={true}
            onClose={() => {
              setShowAddAccount(false);
            }}
          />
        }

        {/* Launch Children */}
        {(showNewFactDialog > -1) &&
          selected &&
          <NewFactDialog
            fact={selected}
            session={session}
            open={true}
            fromHome={false}
            onClose={async (oopsieMessage = null) => {
              oopsieMessage && (enqueueSnackbar(oopsieMessage, { variant: 'error' }));
              setShowNewFactDialog(-1);
              if (session?.url_parameters && ('activity' in session.url_parameters) && ('user' in session.url_parameters)) {
                let jumpTo = window.location.href.replace('theseus', 'thankyou').split('?')[0];
                jumpTo += `?user=${session.url_parameters.user}`;
                window.location.replace(jumpTo);
              }
            }}
            onSave={
              async (pResult) => {
                if ('client_id' in selected) { pResult.client_id = selected.client_id; }
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
};