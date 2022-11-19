import React from 'react';
import { Lambda } from 'aws-sdk';
import { Auth } from '@aws-amplify/auth';
import { useSnackbar } from 'notistack';
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
import AVATextInput from '../forms/AVATextInput';

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
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import CircularProgress from '@material-ui/core/CircularProgress';
import DeleteIcon from '@material-ui/icons/DeleteOutlineRounded';
import ReplyIcon from '@material-ui/icons/ReplyOutlined';
import PersonAddIcon from '@material-ui/icons/PersonAdd';

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

export default ({ pPerson, patient, pClient, onReset }) => {

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
  const [showAddAccount, setShowAddAccount] = React.useState(false);
  const [switchToSelf, setSwitchToSelf] = React.useState(false);
  const [showNewFactDialog, setShowNewFactDialog] = React.useState(-1);
  const [needsConfirmation, setNeedsConfirmation] = React.useState(-1);
  const [toggleClick, setToggleClick] = React.useState(false);
  const [rowOpen, setRowOpen] = React.useState(-1);
  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [promptForMessage, setPromptForMessage] = React.useState('');
  const [messageReplyRecipient, setMessageReplyRecipient] = React.useState('');

  const [loading, setLoading] = React.useState('Initializing');

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [activityLogRecords, setActivityLogRecords] = React.useState([]);

  const [lastMessageCheck, setLastMessageCheck] = React.useState(new Date().getTime());
  const [lastRefresh, setLastRefresh] = React.useState(new Date().getTime());
  const [lastActive, setLastActive] = React.useState(new Date().getTime());

  let currentSection = '';

  const oneMinute = 1000 * 60;
  const oneHour = 60 * oneMinute;
  const msBeforeSleeping = 5 * oneMinute;

  let nowTime = new Date().getTime();
  let localLastMessageCheck = nowTime;
  let localLastRefresh = nowTime;
  let localLastActive = nowTime;

  const imageBucket = 'theseus-medical-storage';
  const imageURI = 'public/patients/[person_id].jpg';

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  const buildMenu = async (beQuiet = null) => {
    let nowTime = new Date().getTime();
    setLastRefresh(nowTime);
    localLastRefresh = nowTime;
    setLastActive(nowTime);
    localLastActive = nowTime;
    console.log(`Refreshed at ${new Date().toLocaleString()}.`);
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
        console.log(`caught error getting People record; error is:`, error);
      });
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

    let wholeMenu = await MakeAVAMenu(patient, pClient, (beQuiet ? screenQuiet : screenStatus));

    if (wholeMenu.length > 0) {
      setMainMenu(wholeMenu);
      return wholeMenu;
    }
    else {
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
    }
    putActivityLog();
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
    setLastMessageCheck(now);
    localLastMessageCheck = now;
    console.log(`Last message check set to ${new Date(now).toLocaleString()}`);
    let mRecs = await dbClient
      .query({
        KeyConditionExpression: 'sender_id = :p and posted_time > :t',
        FilterExpression: 'common_key = :msr and recipient_address <> :s and delete_flag <> :true',
        ExpressionAttributeValues: {
          ':p': pPerson,
          ':t': now - (10 * oneMinute),
          ':msr': 'message_status_record',
          ':s': 'self',
          ':true': true
        },
        TableName: "Messages",
        IndexName: 'sender_id-index',
        ScanIndexForward: false,
        Limit: 10
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
        }
        console.log({ 'Error reading Messages': error });
      });
    if (!recordExists(mRecs)) {
      mRecs = await dbClient
        .query({
          KeyConditionExpression: 'recipient_id = :p and posted_time > :t',
          FilterExpression: 'delete_flag <> :true',
          ExpressionAttributeValues: {
            ':p': pPerson,
            ':t': now - (24 * oneHour),
            ':true': true
          },
          TableName: "Messages",
          IndexName: 'recipient_id-index',
          ScanIndexForward: false,
          Limit: 10
        })
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
          }
          console.log({ 'Error reading Messages': error });
        });
      if (recordExists(mRecs)) {
        // handle a received message
        let msg = mRecs.Items[0];
        let httpAt = msg.message_content.indexOf('http');
        if (httpAt > -1) {
          let lastSentenceAt = msg.message_content.lastIndexOf('.', httpAt);
          msg.message_content = msg.message_content.substring(0, lastSentenceAt + 1);
        }
        if (!msg.message_content.startsWith('Message from') && (msg.sender_id !== pPerson)) {
          msg.message_content = `From ${msg.sender_name}: ${msg.message_content}`;
        }
        let foundMessage = `${msg.posted_time}$~~$${new Date(Number(msg.posted_time)).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        })
          } - ${msg.message_content}$~~$${msg.message_id}$~~$to$~~$${msg.sender_name}:${msg.response_target || msg.sender_id}`;
        setMessageReplyRecipient(`${msg.sender_name}:${msg.response_target || msg.sender_id}`);
        setMessageText(foundMessage);
        return foundMessage;
      }
    }
    else {
      // handle a sent message
      let msg = mRecs.Items[0];
      let foundMessage = `${msg.posted_time}$~~$${msg.message_content}$~~$${msg.message_id}$~~$from$~~$${msg.sender_name}:${msg.response_target || msg.sender_id}`;
      setMessageText(foundMessage);
      return foundMessage;
    }
    setMessageText(null);
    setForceRedisplay(!forceRedisplay);
    return null;
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

  const screenStatus = (statusMessage) => {
    setLoading(statusMessage);
    setForceRedisplay(!forceRedisplay);
  };

  const updateFavorites = async (pType, activityRowIndex) => {
    setLoading('Resetting your Favorites');
    setForceRedisplay(!forceRedisplay);
    makeGreeting();
    await getMessage(pPerson);
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
        console.log(`caught error getting People record; error is:`, error);
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

        // add qualifiers if applicable
        if (pFact.value.hasOwnProperty('qualifiers') && Object.keys(pFact.value.qualifiers).length > 0) {
          pFact.qualifier = Object.keys(pFact.value.qualifiers).map(k => {
            return `${k}:${pFact.value.qualifiers[k]}`;
          });
        }

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
        getImage(session.patient_id || patient.person_id);
        makeName(session.patient_display_name || patient.name.first || pPerson);
        makeGreeting();
        setLoading('Getting recent messages');
        setForceRedisplay(!forceRedisplay);
        await getMessage(session.patient_id || patient.person_id);
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

  const handleSendMessage = async (pPatient, pMessage, pRecipient = null) => {
    // program expects pRecipient in the form <display name>:<id>
    lambda
      .invoke({
        FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:messageEngine',
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
        Payload: JSON.stringify({
          "body": {
            "client": pClient,
            "author": pPatient,
            "values": pRecipient + ' ~ MessageText = ' + pMessage
          }
        })
      })
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while sending a Message.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    enqueueSnackbar(`Sent "${pMessage}" to ${pRecipient.split(':')[0]}`, {
      variant: 'success'
    });
  };

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
      AVA_version: `22.11.18${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
    };
    let workLog = activityLogRecords;
    workLog.push(activityLogRec);
    setActivityLogRecords(workLog);
    mainMenu[pIndex].last_used = postTime;
    setMainMenu(mainMenu);
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
          console.log(`Bad put to ActivityLog - caught error is: ${error}`);
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
    setLastMessageCheck(0);   // this will force the next screen action to get messages
    localLastMessageCheck = 0;
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
        if (err.code === 'NetworkingError') {
          enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
        }
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
        if (err.code === 'NetworkingError') {
          enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
        }
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
    let current_hour = Number(new Date().toTimeString().split(':')[0]);
    let response = '';
    if (current_hour < 12) { response = 'morning'; }
    else if (current_hour < 17) { response = 'afternoon'; }
    else { response = 'evening'; }
    setGreetingTime(response);
    return response;
  }

  const handleClick = async (event) => {
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
          onAction={async (event) => {
            if (!showAddAccount && (showNewFactDialog === -1) && !showProfileEdit && !showPersonSelect) {
              let timeNow = new Date().getTime();
              if (Math.round(timeNow - Math.max(lastRefresh, localLastRefresh)) >= (msBeforeSleeping)) {
                closeSnackbar();
                await updateAVA(sectionOpen, mainMenu);
                makeGreeting();
                await getMessage(session.patient_id || patient.person_id);
                await buildMenu(true);
                setCurrentMenu('main');
                setMenuArray(['main']);
                setMenuNames([]);
                setForceRedisplay(!forceRedisplay);
              }
              else if (Math.round(((new Date().getTime()) - Math.max(lastMessageCheck, localLastMessageCheck)) / oneMinute) > 0) {
                console.log(`GetMessage fired at ${new Date().toLocaleString()}.  Last message check at ${new Date(lastMessageCheck).toLocaleString()}`);
                await getMessage(session.patient_id || patient.person_id);
              }
              setLastActive(timeNow);
              localLastActive = timeNow;
            }
          }}
          onIdle={async () => {
            console.log(`Idle fired at ${new Date().toLocaleString()}.  Last active at ${new Date(Math.max(lastActive, localLastActive)).toLocaleString()}`);
            makeGreeting();
            await getMessage(session.patient_id);
            await updateAVA(sectionOpen, mainMenu);
            enqueueSnackbar(`AVA is asleep.  ${isMobile ? 'Touch the screen' : 'Move your mouse'} or tap something to wake her up!`, { variant: 'info', persist: true });
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
              <Avatar src={imageURL} alt={greetingName} />
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
                {`${isMobile ? 'Hi' : ('Good ' + greetingTime)}, ${greetingName}!`}
              </Typography>
              <Typography
                className={classes.hello}
                id='scroll-dialog-title'
              >
                {`${(!isMobile ? 'Welcome to ' : '')}AVA`}
              </Typography>
            </Box>
          </Box>
          <Box
            paddingRight={2}
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
                await updateAVA(sectionOpen, mainMenu);
                await buildMenu();
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
                  display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                  key={'vRowRefresh'}
                >
                  <Typography className={classes.popUpFooter} >{`AVA vers 22.11.18${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                  <Typography className={classes.popUpFooter} >{makeExpiration()}
                  </Typography>
                  <Typography className={classes.popUpFooter} >{`User ${session.patient_id}`}</Typography>
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
            ml={2} mr={2} mb={2} mt={12}
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
                flexWrap='wrap' textOverflow='ellipsis' width='100%'
                key={'loadingBox'}
                mb={2}
              >
                <Typography variant='h5' className={classes.lastName} >{`Loading AVA`}</Typography>
                <Typography variant='caption' >{`version 22.11.18${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
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
              <CircularProgress />
            </React.Fragment>
          </Box>
        }

        {/* Message */}
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
                {messageText.split('$~~$')[1]}
              </Typography>
            </Box>
            <Box
              display='flex' flexDirection='row' justifyContent='center' alignItems='center'
            >
              <Button
                onClick={async () => {
                  // mTime,mContent,mID,mType,mSenderName:respondTo
                  await deleteMessage(messageText.split('$~~$')[2]);
                  setMessageText(null);
                  await getMessage(session.patient_id);
                  setForceRedisplay(!forceRedisplay);
                }}
                className={classes.rowButtonRed}
                startIcon={<DeleteIcon size='small' />}
              >
                {(messageText.split('$~~$')[3] !== 'to') ? 'Hide' : 'Delete'}
              </Button>
              {(messageText.split('$~~$')[3] === 'to') &&
                <Button
                  onClick={async () => {
                    setPromptForMessage(true);
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
                      await getMessage(session.patient_id);
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
                                  if (this_row.subMenu_data) {
                                    let subMenu = await MakeAVAMenu(patient, pClient, screenQuiet, this_row.subMenu_data);
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
                                    await getActivityDetail(this_row.activity_code);
                                    setShowNewFactDialog(index);
                                  }
                                }
                                setToggleClick(false);
                                await getMessage(session.patient_id);
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
                            style={{ borderRadius: '0px 0px 0px 0px', backgroundColor: this_row.row_color, textDecoration: 'none' }}
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
        {showAddAccount &&
          <PatientDialog
            patient={{
              "person_id": `*NEW~${new Date().getTime()}`,
              "client_id": pClient,
              "groups": [],
              "name": {
                "first": 'New',
                "last": 'Account'
              },
              "clients": [
                {
                  "groups": [],
                  "id": pClient
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
              await getMessage(pPerson);
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
        {promptForMessage &&
          <AVATextInput
            promptText={`What should your reply to ${messageReplyRecipient.split(':')[0]} say?`}
            buttonText='Send'
            onCancel={() => { setPromptForMessage(false); }}
            onSave={(messageText) => {
              setPromptForMessage(false);
              handleSendMessage(pPerson, messageText, messageReplyRecipient);
            }}
          />
        }
      </React.Fragment >
    </Dialog >
  );
};;