import React from 'react';
import { Auth } from '@aws-amplify/auth';
import { useSnackbar } from 'notistack';
import { recordExists, isObject, cl, switchActiveAccount, makeArray, s3, dbClient, lambda, deepCopy, getMarqueeMessage } from '../../util/AVAUtilities';
import { makeDate, makeTime } from '../../util/AVADateTime';
import { getImage } from '../../util/AVAPeople';
import { getActivity } from '../../util/AVAObservations';
import { getActivityDetail } from '../../util/AVAActivityLoader';
import { AVATextStyle, AVADefaults, hexToRgb, isDark } from '../../util/AVAStyles';

import makeStyles from '@material-ui/core/styles/makeStyles';
// import useMediaQuery from '@material-ui/core/useMediaQuery';
import Marquee from "react-fast-marquee";

import { useCookies } from 'react-cookie';
import { useIdleTimer } from 'react-idle-timer';
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

import EditIcon from '@material-ui/icons/PersonOutlineOutlined';
import FavoriteIcon from '@material-ui/icons/FavoriteBorder';
import NotFavorite from '@material-ui/icons/DeleteForever';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import SubscriptionIcon from '@material-ui/icons/CardMembership';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import NewReleasesOutlinedIcon from '@material-ui/icons/NewReleasesOutlined';
// import CircularProgress from '@material-ui/core/CircularProgress';
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
  pendingBar: {
    marginRight: theme.spacing(2.2),
    marginTop: theme.spacing(1),
    backgroundColor: '#a3a0a0',
    color: '#000000',
    transition: 'none',
    height: '5px',
    alignSelf: 'flex-end'
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
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
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
  clientBackground: {
    backgroundColor: AVADefaults({ client_style: 'get' }) ? AVADefaults({ client_style: 'get' }).backgroundColor : null
  },
  clientPopUp: {
    borderRadius: '30px 30px 30px 30px',
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
  const [showPasswordEdit, setShowPasswordEdit] = React.useState(false);
  const [showAddAccount, setShowAddAccount] = React.useState(false);
  const [showNewFactDialog, setShowNewFactDialog] = React.useState(-1);
  const [needsConfirmation, setNeedsConfirmation] = React.useState(-1);
  const [toggleClick, setToggleClick] = React.useState(false);
  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [groupData, setGroupData] = React.useState({});

  const [loading, setLoading] = React.useState('Initializing');
  const [progress, setProgress] = React.useState(100);
  const [pWidth, setPWidth] = React.useState(60);

  const [reactData, setReactData] = React.useState({
    lastActiveTime: new Date(),
    idleState: true,
    enteredIdleStateTime: new Date(),
    menu_reloaded: false,
    loadedMenuVersion: 1,
    marqueeData: [],
    marqueeVersion: 0
  });
  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  let currentSection = '';

  const oneMinute = 1000 * 60;
  const oneHour = 60 * oneMinute;
  const msBeforeSleeping = 1 * oneMinute;

  const subMenuHead = React.useRef(null);

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  const avatarStyle = background_color => {
    if (isDark(background_color)) {
      return {
        width: `${(50 * user_fontSize)}px`,
        height: `${(50 * user_fontSize)}px`,
        padding: '10px',
        borderRadius: '30px',
        backgroundColor: 'cornsilk'
      };
    }
    else {
      return {
        width: `${(50 * user_fontSize)}px`,
        height: `${(50 * user_fontSize)}px`,
        padding: '10px',
        borderRadius: '30px',
        backgroundColor: `${background_color}b2`
      };
    }
  };

  const onIdle = async () => {
    let now = new Date();
    let minutesSinceActive = 0;
    if (!reactData.idleState) {
      cl(`Entering idle state at ${now.toLocaleString()}.`);
      updateReactData({
        idleState: true,
        enteredIdleStateTime: now,
      }, true);
    }
    else {
      minutesSinceActive = Math.floor((now.getTime() - reactData.enteredIdleStateTime.getTime()) / oneMinute);
      cl(`Still idle at ${new Date().toLocaleString()}.  Idle for ${minutesSinceActive} minutes.`);
    }
    if ((minutesSinceActive > 60) || (state.session?.kiosk_mode && state.profile?.kiosk_mode)) {
      window.location.replace(`${window.location.href.split('?')[0]}?rel=${now.getTime()}`);
    }
    else if (!reactData.menu_reloaded) {
      await checkReload();
    }
    else if ((now.getTime() - reactData.lastActiveTime.getTime()) > (5 * oneMinute)) {
      cl(`Update while idle at ${now.toLocaleString()}.`);
      let options = {
        belongsTo: (state.groups ? state.groups.belongsTo : {}),
        client_weather: state.session.client_weather
      };
      let marqueeData = [
        { message: `${greetingWords}, ${greetingName}!` },
        { message: `AVA for ${state.session.client_name}` }
      ];
      marqueeData.push(...(await getMarqueeMessage(session.client_id, options)));
      let urgentMessage = marqueeData.find(m => {
        return (m.criticalMessage);
      });
      if (urgentMessage) {
        marqueeData = [urgentMessage];
      }
      updateReactData({
        lastActiveTime: now,
        marqueeData: marqueeData,
        marqueeVersion: reactData.marqueeVersion++
      }, true);
    }
    reset();
  };

  const checkReload = async () => {
    let menuRec = await dbClient
      .get({
        Key: { person_id: `${state.session.patient_id}%%${state.session.user_id}` },
        TableName: "AVAMenu"
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
        }
        cl(`caught error getting People record; error is:`, error);
      });
    if (recordExists(menuRec) && (menuRec.Item.menu_version !== reactData.loadedMenuVersion)) {
      if ((menuRec.Item.AVA_main_menu.length > 0)) {
        setMainMenu(menuRec.Item.AVA_main_menu);
      }
      cl(`Completed AVA Menu reload`);
      updateReactData({
        menu_reloaded: true,
        loadedMenuVersion: menuRec.Item.menu_version
      }, true);
    }
  };

  async function onAction() {
    let now = new Date();
    let refresh = false;
    if ((reactData.idleState) || ((now.getTime() - reactData.lastActiveTime.getTime()) > oneMinute)) {
      cl(`Action/Update at ${now.toLocaleString()}.  Last active at ${reactData.lastActiveTime.toLocaleString()}`);
      let options = {
        belongsTo: (state.groups ? state.groups.belongsTo : {}),
        client_weather: state.session.client_weather
      };
      let marqueeData = [
        { message: `${greetingWords}, ${greetingName}!` },
        { message: `AVA for ${state.session.client_name}` }
      ];
      marqueeData.push(...(await getMarqueeMessage(session.client_id, options)));
      let urgentMessage = marqueeData.find(m => {
        return (m.criticalMessage);
      });
      if (urgentMessage) {
        marqueeData = [urgentMessage];
      }
      updateReactData({
        lastActiveTime: now,
        marqueeData: marqueeData,
        marqueeVersion: reactData.marqueeVersion++
      }, false);
      refresh = true;
    }
    if (!reactData.menu_reloaded) {
      await checkReload();
    }
    updateReactData({
      idleState: false,
    }, refresh);
    reset();
  };

  const { start, reset, pause } = useIdleTimer({
    onIdle,
    onAction,
    timeout: msBeforeSleeping,
    throttle: 500
  });

  let nowTime = new Date().getTime();

  const buildMenu = async (reload = false, beQuiet = null) => {
    setSectionOpen({});

    // reload = true;

    // AVA_section_open in People record, or (legacy code) current_event in SessionV2 record
    // is used to save what the screen looked like last time the user was in AVA
    let menuRec = await dbClient
      .get({
        Key: {
          person_id: `${state.session.patient_id}%%${state.session.user_id}`
        },
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
      updateReactData({ loadedMenuVersion: menuRec.Item.menu_version }, false);
      setSectionOpen(menuRec.Item.AVA_section_open || {});
      if ((menuRec.Item.AVA_main_menu.length > 0) && !reload) {
        setMainMenu(menuRec.Item.AVA_main_menu);
        return menuRec.Item.AVA_main_menu;
      }
    }

    // we are going to have to build their menu for the first time...
    let forceRefresh = true;
    let wholeMenu = await MakeAVAMenu(patient, defaultClient, (beQuiet ? screenQuiet : screenStatus), null, forceRefresh, state);

    if (wholeMenu.length > 0) {
      // cl(`Reloaded menu at ${new Date().toLocaleString()}.`);
      await updateAVA(sectionOpen, wholeMenu);
      setMainMenu(wholeMenu);
      return wholeMenu;
    }
    else {
      // cl(`Empty menu for ${patient} in ${defaultClient} at ${new Date().toLocaleString()}.`);
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
          Key: { person_id: `${state.session.patient_id}%%${state.session.user_id}` },
          UpdateExpression: 'set AVA_section_open = :o',
          ExpressionAttributeValues: {
            ':o': pOpen
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
    start();
  };

  async function putS3Object(pMediaData, pType) {
    /*
    pMediaData = {
      Bucket: 'theseus-medical-storage',
      Key: fName,
      Body: fObj,
      ACL: 'public-read-write',
      ContentType: fObj.type,
      Metadata: { 'Content-Type': fObj.type }
    }
    */
    let buff, buffer;
    let fileSize = 1;
    let forceSingle = false;
    try {
      buff = await pMediaData.Body.arrayBuffer();
      buffer = new Float32Array(buff, 4, 4);
      fileSize = buffer.length;
    }
    catch {
      enqueueSnackbar(`${pMediaData.Key} is really big.  This may take a few minutes...`, { variant: 'error', persist: false });
      forceSingle = true;
    }

    let uploadId;
    try {
      // Multipart upload will pass chunks of 10Mb
      let partSize = 10000000;
      let numberOfParts = 10;
      if (fileSize > (partSize * numberOfParts)) { partSize = fileSize / 10; }
      else { numberOfParts = Math.ceil(fileSize / partSize); }

      if ((numberOfParts === 1) || forceSingle) {
        enqueueSnackbar(`AVA is saving your ${pType.toLowerCase()} with the name ${pMediaData.Key}`, { variant: 'info', persist: false });
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
          enqueueSnackbar(`${pMediaData.Key} was saved successfully`, { variant: 'success', persist: true });
          return pMediaData.Key;
        };
        return null;
      }

      // this is a multi-part load
      enqueueSnackbar(`AVA broke your ${pType.toLowerCase()} with the name ${pMediaData.Key} into ${numberOfParts} pieces and is uploading them now`, { variant: 'info', persist: false });
      let upParms = {
        Bucket: pMediaData.Bucket,
        Key: pMediaData.Key,
        ACL: pMediaData.ACL,
        ContentType: pMediaData.ContentType,
        Metadata: pMediaData.MetaData
      };
      let mpUp = await s3.createMultipartUpload(upParms).promise();
      uploadId = mpUp.UploadId;

      const uploadPromises = [];
      // Upload each part.
      for (let i = 0; i < numberOfParts; i++) {
        const start = i * partSize;
        const end = start + partSize;
        let uPartParm = {
          Bucket: pMediaData.Bucket,
          Key: pMediaData.Key,
          UploadId: uploadId,
          Body: buffer.subarray(start, end),
          PartNumber: i + 1,
        };
        uploadPromises.push(s3.uploadPart(uPartParm).promise());
      }

      const uploadResults = await Promise.all(uploadPromises);
      let upDone = {
        Bucket: pMediaData.Bucket,
        Key: pMediaData.Key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: uploadResults.map(({ ETag }, i) => ({
            ETag,
            PartNumber: i + 1,
          })),
        }
      };
      let s3Resp = await s3.completeMultipartUpload(upDone).promise();
      enqueueSnackbar(`All parts of ${s3Resp.Key} were saved successfully to ${s3Resp.Location}`, { variant: 'success', persist: true });
      return pMediaData.Key;

      // Verify the output by downloading the file from the Amazon Simple Storage Service (Amazon S3) console.
      // Because the output is a 25 MB string, text editors might struggle to open the file.
    } catch (err) {
      console.error(err);
      enqueueSnackbar(`That didn't work.  ${err}`, { variant: 'error', persist: true });
      if (uploadId) {
        let s3Bad = await s3.abortMultipartUpload({
          Bucket: pMediaData.Bucket,
          Key: pMediaData.Key,
          UploadId: uploadId,
        }).promise();
        console.log(s3Bad);
      }
      return null;
    }
  };

  const screenQuiet = (statusMessage) => {
    return;
  };

  const screenStatus = (statusMessage, progressPct, progressWidth, interimMenu) => {
    setLoading(statusMessage);
    setProgress(progressPct);
    setPWidth(progressWidth * 100);
    setForceRedisplay(!forceRedisplay);
    if (interimMenu) {
      setMainMenu(interimMenu);
    }
  };

  const updateFavorites = async (pType, activityRowIndex) => {
    setLoading('Resetting your Favorites');
    setForceRedisplay(!forceRedisplay);
    makeGreeting();
    let activityRow = mainMenu[activityRowIndex];
    let activityLine = activityRow.raw_data;
    // let activityLine = activityRow.activity_code;
    // if (activityRow.default_value) { activityLine += `~[default=${activityRow.default_value}]`; }
    // if (activityRow.activity_name) { activityLine += `~[title=${activityRow.activity_name}]`; }
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
      let indexAt = favoriteList.findIndex(r => {
        if (typeof (r) === 'string') {
          return (r.split('~')[0] === activityRow.activity_code);
        }
        else {
          return (r.activity_code === activityRow.activity_code);
        }
      });
      if ((indexAt === -1) && (pType === 'add')) {
        favoriteList.unshift(activityLine);
        changeMade = true;
      }
      else if (pType === 'remove') {
        favoriteList.splice(indexAt, 1);
        changeMade = true;
      }
      // remove from the blockedList if it is in there
      let favoriteBlocked = [];
      if ('favorite_blocked' in personRec.Item) {
        favoriteBlocked = personRec.Item.favorite_blocked;
      }
      indexAt = favoriteBlocked.findIndex(r => {
        if (typeof (r) === 'string') {
          return (r.split('~')[0] === activityRow.activity_code);
        }
        else {
          return (r.activity_code === activityRow.activity_code);
        }
      });
      if ((indexAt === -1) && (pType === 'remove')) {
        favoriteBlocked.push(activityLine);
        changeMade = true;
      }
      else if (pType === 'add') {
        favoriteBlocked.splice(indexAt, 1);
        changeMade = true;
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
              : `My Favorites`
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
        };
      }
      window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
      setMainMenu(mainMenu);
      setLoading(false);
      setForceRedisplay(!forceRedisplay);
    };
    return;
  };

  const onSaveFact = async (pFact, pFactName, pIndex) => {
    if (pFact.activity_key.includes('//')) {
      [pFact.client_id, pFact.activity_key] = pFact.activity_key.split('//');
    }
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
          let fileType;
          let fileName;
          if (pFact.value.mediaData.Location) {
            fileName = pFact.value.mediaData.Location;
            fileType = fileExtension.startsWith('mp') ? 'video' : 'file';
          }
          else {
            fileType = ((pFact.value.mediaData.ContentType?.includes('video') || pFact.value.mediaData.Body?.type?.includes('video')) ? 'Video' : 'File');
            fileName = await putS3Object(pFact.value.mediaData, fileType);
          }
          valueArray.unshift(`s3file=${fileName}`, fileType, `userTag=${pFact.value.tag}`);
          factValueType = 'file_details';
        }

        // set the value that will be written into the Fact table
        pFact.value = factValueType + '.' + valueArray.join(' ~ ');

        // write the Fact Table entry
        putFact(pFact, pFactName, pIndex);
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
    if (subMenuHead && subMenuHead.current) {
      subMenuHead.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }
  }, [currentMenu]);

  React.useEffect(() => {
    let response = (
      async () => {
        setLoading('Getting your Information');
        setForceRedisplay(!forceRedisplay);
        let tempName = makeGreetingName(patient.hasOwnProperty('name') ? patient.name.first : (session.patient_display_name || pPerson));
        let tempGreeting = makeGreeting();
        setLoading('Building your AVA menu');
        setForceRedisplay(!forceRedisplay);
        await buildMenu();
        let options = {
          belongsTo: (state.groups ? state.groups.belongsTo : {}),
          client_weather: state.session.client_weather
        };
        let marqueeData = [
          { message: `${tempGreeting}, ${tempName}!` },
          { message: `AVA for ${state.session.client_name}` }
        ];
        marqueeData.push(...(await getMarqueeMessage(session.client_id, options)));
        let urgentMessage = marqueeData.find(m => {
          return (m.criticalMessage);
        });
        if (urgentMessage) {
          marqueeData = [urgentMessage];
        }
        updateReactData({
          marqueeData: marqueeData,
          marqueeVersion: reactData.marqueeVersion++
        }, false);
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

  const activityLog = async (pUser, pCode, pName, pIndex) => {
    let postTime = new Date().getTime();
    await dbClient
      .put({
        TableName: 'ActivityLog',
        Item: {
          timestamp: postTime,
          user_id: pUser,
          activity_code: pCode,
          activity_name: pName,
          AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
        }
      })
      .promise()
      .catch(error => {
        cl(`Bad put to ActivityLog - caught error is: ${error}`);
      });
    mainMenu[pIndex].last_used = postTime;
    setMainMenu(mainMenu);
  };

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
    if (pFact.value) {
      let valueArray = makeArray(pFact.value, '~');
      if (valueArray.length > 0) {
        newFact.valueObj = {};
        valueArray.forEach((val, ndx) => {
          if ((ndx === 0) && (val.includes('.'))) {
            val = val.split('.').slice(1).join('.');
          }
          let [key, value] = val.split(/=/);
          if (!value) {
            [key, value] = val.split(/:/);
          }
          if (!value) {
            value = key;
            key = `v_${ndx}`;
          }
          newFact.valueObj[key.trim()] = value.trim();
        });
      }
    }
    if (pFact.commonKey) {
      newFact.common_key = pFact.commonKey;
      newFact.request_id = pFact.commonKey;
    }
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
    else if (pFact.commonKey) {
      enqueueSnackbar(`Your request is on the way!`, { variant: 'success' });
    }
    else {
      enqueueSnackbar(`Done!`, { variant: 'success' });
    }
  };

  function makeGreetingName(pString) {
    setGreetingName(pString || 'AVA User');
    return pString;
  }

  function makeExpiration() {
    let cognito_expires = JSON.parse(sessionStorage.getItem('cognito_expires'));
    let sTime = new Date(cognito_expires ? (cognito_expires * 1000) : (nowTime + oneHour));
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

  function proxyAuthority() {
    if (state.accessList && state.accessList.hasOwnProperty(session.client_id) && state.accessList[session.client_id].hasOwnProperty('count')) {
      if ((state.accessList[session.client_id].count.proxy > 0) || (state.accessList[session.client_id].count.full > 0)) {
        return true;
      }
    }
    return false;
  }

  const createAccountAuthority = () => {
    if (state.accessList && state.accessList.hasOwnProperty(session.client_id) && state.accessList[session.client_id].hasOwnProperty('count')) {
      if (state.user?.account_class && (['master', 'support', 'admin'].includes(state.user.account_class))) {
        return true;
      }
    }
    return false;
  };

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  function rowIsOpen(pRow) {
    return (sectionOpen[pRow.section_name] || (currentMenu !== 'main'));
  }

  // ******************

  return (
    <Dialog
      open={(true || forceRedisplay)}
      p={2}
      classes={{ paper: classes.clientBackground }}
      fullScreen
    >
      <React.Fragment>
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
            onClick={async () => {
              if (!state.hasOwnProperty('groups') || !state.groups.hasOwnProperty('adminHierarchy')) {
                enqueueSnackbar(`AVA is still loading.  Wait just a moment and try again, please.`, { variant: 'warning' });
              }
              else {
                setPopupMenuOpen(false);
                setGroupData(state.groups);
                setShowProfileEdit(true);
                setShowPasswordEdit(false);
              }
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
                style={AVATextStyle({ size: 1.5, margin: { right: 1 } })}
                id='scroll-dialog-title'
              >
                {`${greetingWords},`}
              </Typography>
              <Typography
                style={AVATextStyle({ size: 1.5, margin: { right: 1 } })}
                id='scroll-dialog-title'
              >
                {`${greetingName}!`}
              </Typography>
            </Box>
          </Box>
          <Box
            display='flex'
            overflow='auto'
            justifySelf='flex-end'
            alignContent={'end'}
          >
            <Box
              display='flex'
              overflow='auto'
              justifySelf='flex-end'
              flexDirection='column'
            >
              <Typography
                style={AVATextStyle({ align: 'right', wrap: 'nowrap', size: 1.1, margin: { right: 0 } })}
                id='scroll-dialog-title'
              >
                {`${makeDate(new Date()).dateOnly.split(',').pop().trim()}`}
              </Typography>
              <Typography
                style={AVATextStyle({ align: 'right', size: 1.1, margin: { right: 0 } })}
                id='scroll-dialog-title'
              >
                {`${makeDate(new Date()).timeOnly.split(' ').join('').toLowerCase()}`}
              </Typography>
            </Box>
          </Box>
          {/* AVA Logo and Pop-up Menu */}
          <Box
            display='flex'
            ml={2}
            overflow='auto'
            flexDirection='column'
          >
            <Box
              component="img"
              ml={2}
              mr={2}
              aria-controls='hidden-menu'
              aria-haspopup='true'
              minWidth={50}
              maxWidth={50}
              alignSelf='flex-end'
              onClick={(event) => {
                handleClick(event);
                setPopupMenuOpen(true);
              }}
              alt=''
              src={process.env.REACT_APP_AVA_LOGO}
            />
            {!reactData.menu_reloaded &&
              <LinearProgress className={classes.pendingBar} style={{ width: 50 }} />
            }
          </Box>
          <Menu
            id='hidden-menu'
            anchorEl={anchorEl}
            open={popupMenuOpen}
            classes={{ paper: classes.clientPopUp }}
            onClose={() => { setPopupMenuOpen(false); }}
            keepMounted>
            <MenuList className={classes.popUpMenu}>
              {(session?.patient_id !== session?.user_id) && (
                <MenuItem onClick={async () => {
                  setPopupMenuOpen(false);
                  await switchActiveAccount(
                    session,
                    (session.user_homeClient || session.client_id),
                    {
                      id: session.user_id,
                      name: session.user_display_name
                    }
                  );
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
                <MenuItem onClick={async () => {
                  if (!state.hasOwnProperty('groups') || !state.groups.hasOwnProperty('adminHierarchy')) {
                    enqueueSnackbar(`AVA is still loading.  Wait just a moment and try again, please.`, { variant: 'warning' });
                  }
                  else {
                    setPopupMenuOpen(false);
                    setGroupData(state.groups);
                    setShowProfileEdit(true);
                    setShowPasswordEdit(true);
                  }
                }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowSwitch'}
                  >
                    <EditIcon />
                    <Typography className={classes.popUpMenuRow} >
                      {`Manage ${(session.patient_id === session.user_id) ? 'my' : greetingName + "'" + ((greetingName.slice(-1) === 's') ? '' : 's')} Password`}
                    </Typography>
                  </Box>
                </MenuItem>
              )
              }
              {(
                state.hasOwnProperty('accessList') &&
                state.accessList.hasOwnProperty('subscription') &&
                state.accessList.subscription.subscription_active
              )
                &&
                <MenuItem onClick={() => {
                  window.open(`https://families.avaseniorliving.com/p/login/9AQ4hT0kI91OcFidQQ`);
                }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowSwitch'}
                  >
                    <SubscriptionIcon />
                    <Typography className={classes.popUpMenuRow} >{'Manage Subscription'}</Typography>
                  </Box>
                </MenuItem>
              }
              {proxyAuthority()
                &&
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
              }
              {createAccountAuthority()
                &&
                <MenuItem onClick={async () => {
                  setGroupData(state.groups);
                  setPopupMenuOpen(false);
                  pause();
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
              }
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
                  window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
                }}>
                <Box
                  display='flex' flexDirection='row' alignItems={'center'}
                  key={'vRowRefresh'}
                >
                  <AutorenewIcon />
                  <Typography className={classes.popUpMenuRow} >{'Restart AVA'}</Typography>
                </Box>
              </MenuItem>
              {(window.location.href.split('//')[1].slice(0, 1).toUpperCase() !== 'T') &&
                <MenuItem
                  onClick={async () => {
                    window.location.replace(`https://test.smsoftware.io?rel=${new Date().getTime()}`);
                  }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowRefresh'}
                  >
                    <NewReleasesOutlinedIcon />
                    <Typography className={classes.popUpMenuRow} >{'Use Beta Version'}</Typography>
                  </Box>
                </MenuItem>
              }
              {(window.location.href.split('//')[1].slice(0, 1).toUpperCase() === 'T') &&
                <MenuItem
                  onClick={async () => {
                    window.location.replace(`https://dev.smsoftware.io?rel=${new Date().getTime()}`);
                  }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowRefresh'}
                  >
                    <NewReleasesOutlinedIcon />
                    <Typography className={classes.popUpMenuRow} >{'Use Public Version'}</Typography>
                  </Box>
                </MenuItem>
              }
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

        {/* AVA Menu */}
        {mainMenu && mainMenu.length > 0 &&
          <Paper component={Box} className={classes.clientBackground} variant='outlined' overflow={'auto'} >
            <Box
              display='flex' flexDirection='row'
              key={'vRowRefresh'}
            >
              <Box flex={2} overflow={'hidden'} >
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
                          <Box display='flex' ml={2} mr={5} flexGrow={1} flexDirection='row' justifyContent='center' alignItems='center'>
                            <Box display='flex' flexDirection='column'>
                              <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center' overflow='hidden'>
                                <Typography style={AVATextStyle({ size: 1.5 })} ref={subMenuHead}>{`Return to ${menuNames[menuNames.length - 1]}`}</Typography>
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
                          <Box
                            display='flex'
                            ml={2} mr={2} mt={1.5}
                            key={this_row.activity_code + 'section' + index}
                            style={{
                              borderRadius: ((sectionOpen[this_row.section_name] || (currentMenu !== 'main')) ? '30px 30px 0px 0px' : '30px 30px 30px 30px'),
                              backgroundColor: hexToRgb(this_row.section_color, 1),
                              textDecoration: 'none'
                            }}
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
                              <Box
                                borderRadius={'30px'} justifyContent='flex-start' alignItems='center'
                              >
                                <Avatar
                                  src={this_row.section_icon}
                                  style={avatarStyle(this_row.section_color)}
                                  alt=""
                                  variant="square"
                                />
                              </Box>
                              <Box display='flex' flex={4} justifyContent='center' alignItems='center' overflow='hidden'>
                                <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                                  {(currentSection = this_row.section_name)}
                                </Typography>
                                <Typography style={AVATextStyle({ size: 1.5, bold: true, align: 'center', color: (isDark(this_row.section_color) ? 'cornsilk' : 'black') })} >{this_row.section_name.trim()}</Typography>
                              </Box>
                              <Box display='flex' justifyContent='flex-end' alignItems='center'>
                                {(currentMenu !== 'main') ? null : (!sectionOpen[this_row.section_name] ? 'Show' : 'Hide')}
                              </Box>
                            </Box>
                          </Box>
                        }
                        {rowIsOpen(this_row) &&
                          <React.Fragment>
                            <Box
                              key={this_row.activity_code + 'detail' + index}
                              display='flex'
                              ml={2} mr={2} mt={.2} mb={.2}
                              style={{
                                backgroundColor: hexToRgb(this_row.row_color, 0.7),
                                textDecoration: 'none',
                                color: (isDark(this_row.section_color) ? 'cornsilk' : 'black')
                              }}
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
                                  enqueueSnackbar(<div>
                                    1. Func {this_row.activity_code}<br />
                                    2. Type {this_row.row_type}<br />
                                    3. Reas {this_row.reason}<br />
                                    4. Defs {isObject(this_row.default_value) ? `OBJ -> ${JSON.stringify(this_row.default_value)}` : this_row.default_value}</div>,
                                    { variant: 'info', persist: true });
                                }}
                              >
                                <Box
                                  display='flex'
                                  mr={2}
                                  flexGrow={1}
                                  flexDirection='row'
                                  justifyContent='space-between'
                                  alignItems='center'
                                  overflow={'hidden'}
                                  onClick={async () => {
                                    await activityLog(pPerson, this_row.activity_code, this_row.activity_name, index);
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
                                        setLoading('Loading');
                                        setForceRedisplay(!forceRedisplay);
                                        let gad_response = await getActivityDetail(this_row, state);
                                        setSelected(gad_response.activityRec);
                                        setLoading(false);
                                        if (gad_response.loadError) {
                                          enqueueSnackbar(`AVA is still loading.  Wait just a moment and try again, please.`, { variant: 'warning' });
                                        }
                                        else {
                                          pause();
                                          setShowNewFactDialog(index);
                                        }
                                      }
                                    }
                                    setToggleClick(false);
                                  }}
                                >
                                  {this_row.row_type === 'document' ?
                                    <a href={this_row.default_value + (!this_row.default_value?.includes('?') ? ('?a=' + new Date().getTime()) : '')} style={{ color: 'inherit', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
                                      <Typography style={AVATextStyle({ size: 1.5 })}>{this_row.activity_name}</Typography>
                                    </a>
                                    :
                                    <Typography style={AVATextStyle({ size: 1.5 })}>{this_row.activity_name}</Typography>
                                  }
                                </Box>
                                <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
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
                            {((index === (mainMenu.length - 1))
                              || (this_row.menu_name !== mainMenu[index + 1].menu_name)
                              || (this_row.section_name !== mainMenu[index + 1].section_name)
                            ) &&
                              <Box
                                display='flex'
                                style={{
                                  borderRadius: '0px 0px 30px 30px',
                                  backgroundColor: hexToRgb(this_row.row_color, 1),
                                  textDecoration: 'none'
                                }}
                                ml={2} mr={2}
                                justifyContent='center'
                                flexDirection='column'
                                height={30}
                              />}
                          </React.Fragment>
                        }
                      </React.Fragment>
                    )
                  ))}
                </List>
              </Box>
            </Box>
          </Paper>
        }

        {/* Message Box */}
        {mainMenu && mainMenu.length > 0 &&
          <Box
            display='flex' flexDirection='column' justifyContent='center' alignItems='center'
            key={'lowerloadingBoxWrapper'}
            id={'lowerloadingBoxWrapper'}
            ml={2} mr={2} mb={1} mt={1}
          >
            <React.Fragment>
              <Box
                display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                flexWrap='wrap' textOverflow='ellipsis' width='100%' overflow={'hidden'}
                key={'loadingBox'}
                id={'loadingBox'}
              >
                {loading &&
                  <React.Fragment>
                    <Typography style={AVATextStyle({ size: 1.5, align: 'center' })}  >{`Loading AVA`}</Typography>
                    <Typography style={AVATextStyle({ size: 0.8, align: 'center' })} >
                      {`AVA version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}
                    </Typography>
                    {loading.startsWith('Common activities')
                      ?
                      <Box
                        display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                        flexWrap='wrap' textOverflow='ellipsis' width='100%'
                        key={'groupActivitiesBox'}
                        id={'groupActivitiesBox'}
                      >
                        <Typography style={AVATextStyle({ size: 0.8 })}>{'Common activities for'}</Typography>
                        <Typography style={AVATextStyle({ size: 0.8 })}>{loading.split(' for ')[1]}</Typography>
                      </Box>
                      :
                      <Typography style={AVATextStyle({ size: 0.8 })}>{loading}</Typography>
                    }
                    <LinearProgress variant="determinate" className={classes.progressBar}
                      style={AVATextStyle({ width: pWidth, margin: { top: 1 } })}
                      value={progress} />
                  </React.Fragment>
                }
              </Box>
              <Marquee
                speed={75}
              >
                {reactData.marqueeData &&
                  reactData.marqueeData.map((marqueeLine, marqueeIndex) => (
                    <Typography
                      key={`marquee_${marqueeIndex}_${reactData.marqueeVersion}`}
                      style={AVATextStyle(Object.assign({ size: 2, margin: { top: 0.6, left: 20, bottom: 1.4 }, bold: true, align: 'center' }, marqueeLine.style))} >
                      {marqueeLine.message}
                    </Typography>
                  ))}
              </Marquee>
            </React.Fragment>
          </Box>
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

        {showProfileEdit &&
          <PatientDialog
            patient={patient}
            groupData={groupData}
            open={true}
            options={{
              scrollToPassword: showPasswordEdit
            }}
            onClose={(updatedPerson) => {
              setShowProfileEdit(false);
              if (updatedPerson) {
                sessionStorage.removeItem('AVASessionData');
                window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
              }
            }}
          />
        }

        {showAddAccount &&
          <PatientDialog
            patient={{
              "person_id": `*NEW~${new Date().getTime()}`,
              "client_id": state.session.client_id,
              "groups": [],
              "name": {
                "first": 'New',
                "last": 'Account'
              },
              "clients": [
                {
                  "groups": [],
                  "id": state.session.client_id
                }
              ],
            }}
            groupData={groupData}
            open={true}
            onClose={() => {
              reset();
              setShowAddAccount(false);
              sessionStorage.removeItem('AVASessionData');
              window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
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
            onClose={async (response) => {
              if (session?.url_parameters && ('activity' in session.url_parameters) && ('user' in session.url_parameters)) {
                let jumpTo = window.location.href.replace('theseus', 'thankyou').split('?')[0];
                jumpTo += `?user=${session.url_parameters.user}`;
                window.location.replace(jumpTo);
              }
              else if ((['continue', 'next'].includes(response))
                && (mainMenu[showNewFactDialog].raw_data.hasOwnProperty('nextActivity'))) {
                let nextActivityList = makeArray(mainMenu[showNewFactDialog].raw_data.nextActivity);
                let nextActivityRec;
                if (isObject(nextActivityList[0])) {
                  if (!nextActivityList[0].activity_code) {
                    setShowNewFactDialog(-1);
                  }
                  else {
                    let gotRec = await getActivity(state.session.client_id, nextActivityList[0].activity_code);
                    // default values passed in through the nextActivity will drop in
                    gotRec.default_value = Object.assign((gotRec.default_value || {}), nextActivityList[0].default_value);
                    nextActivityRec = deepCopy(gotRec);
                  }
                }
                else {
                  nextActivityRec = await getActivity(state.session.client_id, nextActivityList[0]);
                }
                // the assign here "promotes" and default_value in the validation object up to the activityRec itself where getActivityDetails expects it to be
                nextActivityRec.default_value = Object.assign({}, nextActivityRec.validation.default_value, nextActivityRec.default_value);
                let gad_response = await getActivityDetail(nextActivityRec, state);
                setSelected(gad_response.activityRec);
              }
              else {
                reset();
                setShowNewFactDialog(-1);
              }
            }}
            onSave={
              async (pResult) => {
                reset();
                if ('client_id' in selected) { pResult.client_id = selected.client_id; }
                await onSaveFact(pResult, selected.name, showNewFactDialog);
              }
            }
            onNext={() => {
              reset();
              onNextFact();
            }}
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
              await onSaveFact(pendingFact, selected.name, needsConfirmation);
              setNeedsConfirmation(-1);
            }}
          >
          </AVAConfirm>
        }
      </React.Fragment >
    </Dialog >
  );
};