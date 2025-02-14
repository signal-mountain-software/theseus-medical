import React from 'react';
import { Auth } from '@aws-amplify/auth';
import { recordExists, isObject, cl, switchActiveAccount, makeArray, dbClient, lambda, deepCopy, getMarqueeMessage } from '../../util/AVAUtilities';
import { makeDate, makeTime } from '../../util/AVADateTime';
import { getImage } from '../../util/AVAPeople';
import { getActivity } from '../../util/AVAObservations';
import { getActivityDetail } from '../../util/AVAActivityLoader';
import { AVATextStyle, AVADefaults, hexToRgb, isDark } from '../../util/AVAStyles';

import Card from '@material-ui/core/Card';
import CardActionArea from '@material-ui/core/CardActionArea';
import CardContent from '@material-ui/core/CardContent';
import CardMedia from '@material-ui/core/CardMedia';

import { Snackbar } from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import AlertTitle from '@material-ui/lab/AlertTitle';

import makeStyles from '@material-ui/core/styles/makeStyles';
// import useMediaQuery from '@material-ui/core/useMediaQuery';
import Marquee from "react-fast-marquee";

import { useCookies } from 'react-cookie';
import { useIdleTimer } from 'react-idle-timer';
import useSession from '../../hooks/useSession';
import SwitchPatientDialog from '../dialogs/SwitchPatientDialog';
import PatientDialog from '../dialogs/PatientDialog';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import NewFactDialog from '../dialogs/NewFactDialog';
import MakeAVAMenu from '../../util/MakeAVAMenu';

import Box from '@material-ui/core/Box';
import Avatar from '@material-ui/core/Avatar';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import Dialog from '@material-ui/core/Dialog';

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import EditIcon from '@material-ui/icons/PersonOutlineOutlined';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import SubscriptionIcon from '@material-ui/icons/CardMembership';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import NewReleasesOutlinedIcon from '@material-ui/icons/NewReleasesOutlined';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import SearchIcon from '@material-ui/icons/Search';

import Tooltip from '@material-ui/core/Tooltip';
import QuickSearch from './QuickSearch';

const useStyles = makeStyles(theme => ({
  root: {
    maxWidth: 100,
    minWidth: 100,
    maxHeight: 100,
    minHeight: 100,
  },
  cardcontent: {
    height: 80,
    alignContent: 'center',

    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center'
  },
  cardcontentdetail: {
    height: 100,
    alignContent: 'center',
    padding: 0
  },
  media: {
    height: 20,
  },
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
    marginLeft: theme.spacing(1),
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

  const { state } = useSession();
  const { roles, session } = state;

  const [, , removeCookie] = useCookies(['AVAuser']);

  const [reactData, setReactData] = React.useState({
    mainMenu: [],
    greetingName: '',
    greetingWords: '',
    loading: 'Initializing',
    progress: 100,
    pWidth: 60,
    currentMenu: 'main',
    menuArray: ['main'],
    menuNames: [],
    selected: null,
    sectionOpen: false,
    current_time: new Date(),
    showPersonSelect: false,
    popupMenuOpen: false,
    showProfileEdit: false,
    showNewFactDialog: -1,
    showAddAccount: false,
    showQuickSearch: false,
    accessList: false,
    showProfileEdit_id: false,
    linkedPersonFilter: '',
    showPasswordEdit: false,
    groupData: {},
    anchorEl: null,
    lastActiveTime: new Date(),
    idleState: true,
    enteredIdleStateTime: new Date(),
    menu_reloaded: false,
    loadedMenuVersion: 1,
    marqueeData: [],
    marqueeVersion: 0,
    alert: false
  });
  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    newData.current_time = new Date();
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
        { message: `${reactData.greetingWords}, ${reactData.greetingName}!` },
        { message: `AVA for ${state.session.client_name}` }
      ];
      marqueeData.push(...(await getMarqueeMessage(session.client_id, options)));
      let urgentMessage = marqueeData.find(m => {
        return (m.criticalMessage || m.priorityMessage);
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
          updateReactData({
            alert: {
              severity: 'error',
              title: 'No internet',
              message: `There is no internet connection.`
            }
          }, true);
        }
        cl(`caught error getting People record; error is:`, error);
      });
    if (recordExists(menuRec) && (menuRec.Item.menu_version !== reactData.loadedMenuVersion)) {
      let reactUpdObj = {
        menu_reloaded: true,
        loadedMenuVersion: menuRec.Item.menu_version
      };
      if ((menuRec.Item.AVA_main_menu.length > 0)) {
        reactUpdObj.mainMenu = menuRec.Item.AVA_main_menu;
      }
      updateReactData(reactUpdObj, true);
    }
  };

  async function onAction() {
    let now = new Date();
    if ((reactData.idleState) || ((now.getTime() - reactData.lastActiveTime.getTime()) > oneMinute)) {
      cl(`Action/Update at ${now.toLocaleString()}.  Last active at ${reactData.lastActiveTime.toLocaleString()}`);
      let options = {
        belongsTo: (state.groups ? state.groups.belongsTo : {}),
        client_weather: state.session.client_weather
      };
      let marqueeData = [
        { message: `${reactData.greetingWords}, ${reactData.greetingName}!` },
        { message: `AVA for ${state.session.client_name}` }
      ];
      marqueeData.push(...(await getMarqueeMessage(session.client_id, options)));
      let urgentMessage = marqueeData.find(m => {
        return (m.criticalMessage || m.priorityMessage);
      });
      if (urgentMessage) {
        marqueeData = [urgentMessage];
      }
      updateReactData({
        lastActiveTime: now,
        idleState: false,
        marqueeData: marqueeData,
        marqueeVersion: reactData.marqueeVersion++
      }, true);
    }
    if (!reactData.menu_reloaded) {
      await checkReload();
    }
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
    let reactUpdObj = {
      sectionOpen: false
    };
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
          reactUpdObj.alert = {
            severity: 'error',
            title: 'No internet',
            message: `There is no internet connection.`
          };
        }
        else {
          reactUpdObj.alert = {
            severity: 'error',
            title: 'Unusual error',
            message: `When getting your menu history, an error occurred.  The error is ${error}`
          };
        }
      });
    if (recordExists(menuRec)) {
      reactUpdObj.loadedMenuVersion = menuRec.Item.menu_version;
      reactUpdObj.sectionOpen = false;
      if ((menuRec.Item.AVA_main_menu && (menuRec.Item.AVA_main_menu.length > 0)) && !reload) {
        reactUpdObj.mainMenu = menuRec.Item.AVA_main_menu;
        updateReactData(reactUpdObj, true);
        return menuRec.Item.AVA_main_menu;
      }
    }

    // we are going to have to build their menu for the first time...
    let forceRefresh = true;
    let wholeMenu = await MakeAVAMenu(patient, defaultClient, (beQuiet ? screenQuiet : screenStatus), null, forceRefresh, state);

    if (wholeMenu.length > 0) {
      await updateAVA(reactData.sectionOpen, wholeMenu);
      reactUpdObj.mainMenu = wholeMenu;
      updateReactData(reactUpdObj, true);
      return wholeMenu;
    }
    else {
      reactUpdObj.alert = {
        severity: 'info',
        title: 'Warning',
        message: `AVA didn't find any options for you.  Ask AVA Support to check on this.`
      };
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
      reactUpdObj.mainMenu = [helpRow];
      updateReactData(reactUpdObj, true);
    }
    // end
    return reactUpdObj.mainMenu;
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

  const screenQuiet = (statusMessage) => {
    return;
  };

  const screenStatus = (statusMessage, progressPct, progressWidth, interimMenu) => {
    let reactUpdObj = {
      loading: statusMessage,
      progress: progressPct,
      pWidth: progressWidth * 100
    };
    if (interimMenu) {
      reactUpdObj.mainMenu = interimMenu;
    }
    updateReactData(reactUpdObj, true);
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

        // set the value that will be written into the Fact table
        pFact.value = factValueType + '.' + valueArray.join(' ~ ');

        // write the Fact Table entry
        putFact(pFact, pFactName, pIndex);
      }
    };
    updateReactData({
      showNewFactDialog: -1
    }, true);
  };

  const onNextFact = async () => {
    updateReactData({
      showNewFactDialog: -1
    }, true);
  };

  React.useEffect(() => {
    if (subMenuHead && subMenuHead.current) {
      subMenuHead.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }
  }, [reactData.currentMenu]);

  React.useEffect(() => {
    let response = (
      async () => {
        let reactUpdObj = {};
        let tempName = (patient.hasOwnProperty('name') ? patient.name.first : (session.patient_display_name || pPerson));
        reactUpdObj.greetingName = (tempName || 'AVA User');
        reactUpdObj.greetingWords = makeGreeting();
        reactUpdObj.loading = 'Building your AVA menu';
        updateReactData(reactUpdObj, true);
        await buildMenu();
        let options = {
          belongsTo: (state.groups ? state.groups.belongsTo : {}),
          client_weather: state.session.client_weather
        };
        let marqueeData = [
          { message: `${reactUpdObj.greetingWords}, ${tempName}!` },
          { message: `AVA for ${state.session.client_name}` }
        ];
        marqueeData.push(...(await getMarqueeMessage(session.client_id, options)));
        let urgentMessage = marqueeData.find(m => {
          return (m.criticalMessage || m.priorityMessage);
        });
        if (urgentMessage) {
          marqueeData = [urgentMessage];
        }
        updateReactData({
          marqueeData: marqueeData,
          marqueeVersion: reactData.marqueeVersion++,
          loading: false
        }, true);
      }
    );
    if (reactData.mainMenu.length === 0) {
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
  };

  const putFact = async (pFact, pFactName, pIndex) => {
    let postTime = new Date().getTime();
    const newFact = {
      person_id: pFact.patient_id,
      activity_key: (pFact.client_id ? ((pFact.client_id) + '//') : '') + pFact.activity_key + '#' + postTime,
      value: pFact.value,
      status: 'recorded',
      user_id: pPerson,
      session_id: 'Confirmed',
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
  };

  /* function makeGreetingName(pString) {
    setGreetingName(pString || 'AVA User');
    return pString;
  }  */

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
      return session.custom_greeting;
    }
    else {
      return `Good ${makeTime(new Date()).dayPart}`;
    }
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

  // ******************

  return (
    <React.Fragment>
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
                  updateReactData({
                    alert: {
                      severity: 'warning',
                      title: 'Still loading Group information',
                      message: `AVA is still loading.  Wait just a moment and try again, please.`
                    }
                  }, true);
                }
                else {
                  pause();
                  updateReactData({
                    groupData: state.groups,
                    showPasswordEdit: false,
                    popupMenuOpen: false,
                    showProfileEdit: true
                  }, true);
                }
              }}
            >
              <Tooltip
                className={classes.avatar}
                title={
                  <Typography variant='caption'>
                    {session?.kiosk_mode ? 'View/Update not available' : `View/Update ${reactData.greetingName}'${reactData.greetingName.slice(-1) === 's' ? '' : 's'} Profile`}
                  </Typography>
                }
                placement='bottom-start'>
                <Avatar src={getImage(session.patient_id)} alt={reactData.greetingName} />
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
                  {`${reactData.greetingWords},`}
                </Typography>
                <Typography
                  style={AVATextStyle({ size: 1.5, margin: { right: 1 } })}
                  id='scroll-dialog-title'
                >
                  {`${reactData.greetingName}!`}
                </Typography>
              </Box>
            </Box>
            {/* AVA Logo and Pop-up Menu */}
            <Box
              display='flex'
              overflow='hidden'
              flexDirection='column'
              justifyContent={'center'}
              alignItems={'center'}
            >
              <Tooltip
                className={classes.avatar}
                style={{ marginBottom: '4px' }}
                onClick={(event) => {
                  updateReactData({
                    anchorEl: event.currentTarget,
                    popupMenuOpen: true
                  }, true);
                }}
                title={
                  <Typography variant='caption'>
                    {`Administration Menu`}
                  </Typography>
                }
                placement='bottom-start'>
                <Avatar
                  src={state.session?.client_logo || process.env.REACT_APP_AVA_LOGO}
                  alt={reactData.greetingName}
                />
              </Tooltip>
              {makeDate(reactData.current_time, { timeZone: state.session.client_timezone }).absolute.split(' at ').map((tLine, tX) => (
                <Typography
                  key={`time_${tX}`}
                  style={AVATextStyle({ align: 'center', size: 0.8 })}
                  id='scroll-dialog-title'
                >
                  {tLine}
                </Typography>
              ))}
            </Box>
            <Menu
              id='hidden-menu'
              anchorEl={reactData.anchorEl}
              open={reactData.popupMenuOpen}
              classes={{ paper: classes.clientPopUp }}
              onClose={() => {
                updateReactData({
                  popupMenuOpen: false
                }, true);
              }}
              keepMounted>
              <MenuList className={classes.popUpMenu}>
                {(session?.patient_id !== session?.user_id) && (
                  <MenuItem onClick={async () => {
                    updateReactData({
                      popupMenuOpen: false
                    }, true);
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
                {(session?.patient_id !== session?.user_id) && (
                  <MenuItem onClick={async () => {
                    //  let sessionObject = JSON.parse(sessionStorage.getItem('AVASessionData'));
                    updateReactData({
                      popupMenuOpen: false
                    }, true);
                    await switchActiveAccount(
                      session,
                      (session.client_id || session.user_homeClient),
                      {
                        id: session.patient_id,
                        name: reactData.greetingName
                      },
                      { resetUser: true }
                    );
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'switch2self'}
                    >
                      <HomeIcon />
                      <Typography className={classes.popUpMenuRow} >{`Reload as ${session?.patient_id}`}</Typography>
                    </Box>
                  </MenuItem>
                )}
                {!session?.kiosk_mode && (
                  <MenuItem onClick={async () => {
                    if (!state.hasOwnProperty('groups') || !state.groups.hasOwnProperty('adminHierarchy')) {
                      updateReactData({
                        alert: {
                          severity: 'warning',
                          title: 'Still loading Group information',
                          message: `AVA is still loading.  Wait just a moment and try again, please.`
                        }
                      }, true);
                    }
                    else {
                      pause();
                      updateReactData({
                        groupData: state.groups,
                        showPasswordEdit: true,
                        popupMenuOpen: false,
                        showProfileEdit: true
                      }, true);
                    }
                  }}>
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowSwitch'}
                    >
                      <EditIcon />
                      <Typography className={classes.popUpMenuRow} >
                        {`Manage ${(session.patient_id === session.user_id) ? 'my' : reactData.greetingName + "'" + ((reactData.greetingName.slice(-1) === 's') ? '' : 's')} Password`}
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
                    updateReactData({
                      showPersonSelect: true,
                      popupMenuOpen: false
                    }, true);
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
                    pause();
                    updateReactData({
                      groupData: state.groups,
                      showAddAccount: true,
                      popupMenuOpen: false
                    }, true);
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
                  pause();
                  updateReactData({
                    showQuickSearch: true,
                    popupMenuOpen: false
                  }, true);
                }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowCreate'}
                  >
                    <SearchIcon />
                    <Typography className={classes.popUpMenuRow} >{'Quick Search'}</Typography>
                  </Box>
                </MenuItem>
                <MenuItem onClick={async () => {
                  await accessLog(session.user_id, `*na*`, `Manual sign-out`);
                  removeCookie("AVAuser");
                  Auth.signOut().then(() => {
                    let jumpTo = window.location.origin;
                    window.location.replace(`${jumpTo}?client=${state.session.client_id}`);
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
                    key={'restart_menu_option'}
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
                      key={'use_beta_menu_option'}
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
                      key={'use_public_menu_option'}
                    >
                      <NewReleasesOutlinedIcon />
                      <Typography className={classes.popUpMenuRow} >{'Use Public Version'}</Typography>
                    </Box>
                  </MenuItem>
                }
                <MenuItem>
                  <Box
                    display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                    key={'menu_footer'}
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
          {reactData.mainMenu && reactData.mainMenu.length > 0 &&
            <Paper
              component={Box} className={classes.clientBackground} variant='outlined' overflow={'auto'}
              style={{ flexGrow: '1' }}
            >
              <Box
                display='flex' flexDirection='column'
                key={'master_connect_column'}
                flexWrap={'wrap'}
                mt={2} mb={2} ml={1} mr={1}
              >
                <Box
                  display='flex' flexDirection='row'
                  key={'vRowRefresh_cell_boxes'}
                  flexWrap={'wrap'}
                  mt={2} mb={2} ml={1} mr={1}
                >
                  {reactData.mainMenu.map((this_row, index) => (
                    ((this_row.menu_name === reactData.currentMenu) &&
                      <React.Fragment key={`master_cell_fragment_${index}`}>
                        {currentSection !== this_row.section_name &&
                          <Card className={classes.root}
                            key={`master_card_${index}`}
                            style={{
                              marginRight: '8px', marginLeft: '8px', marginTop: '16px',
                              borderRadius: ('30px 30px 30px 30px'),
                              borderWidth: 4,
                              boxShadow: (reactData.sectionOpen.index === index) ? ('10px 10px 10px') : null,
                              borderStyle: (reactData.sectionOpen.index === index) ? 'solid' : null,
                              borderColor: 'black',
                              backgroundColor: hexToRgb(this_row.section_color, 1),
                              textDecoration: 'none'
                            }}
                            onClick={async () => {
                              updateReactData({
                                sectionOpen: (reactData.sectionOpen && (reactData.sectionOpen.index === index))
                                  ? false
                                  : Object.assign({}, this_row, { index })
                              }, true);
                            }}
                          >
                            <CardActionArea>
                              <CardMedia
                                className={classes.media}
                                key={`master_card_media_${index}`}
                                image={this_row.section_icon}
                                title="Menu Media"
                              />
                              <CardContent className={classes.cardcontent}>
                                <Box
                                  display='flex' flexDirection='column'
                                  alignItems={'center'} justifyContent={'center'}
                                  key={`master_card_content_${index}`}
                                >
                                  <Typography
                                    className={classes.noDisplay}
                                    key={`master_card_content_hidden_${index}`}
                                    sx={{ display: 'none', visibility: 'hidden' }}
                                  >
                                    {(currentSection = this_row.section_name)}
                                  </Typography>
                                  <Typography
                                    key={`master_card_content_text_${index}`}
                                    style={AVATextStyle({ align: 'center', size: 1, bold: true, color: (isDark(this_row.section_color) ? 'cornsilk' : 'black') })}
                                  >
                                    {this_row.section_name.trim()}
                                  </Typography>
                                </Box>
                              </CardContent>
                            </CardActionArea>
                          </Card>
                        }
                      </React.Fragment>
                    )
                  ))}
                </Box>
                <Box
                  display='flex' flexDirection='row'
                  key={'vRowRefresh_lower_cells'}
                  flexWrap={'wrap'}
                  borderTop={reactData.sectionOpen ? 2 : 0}
                  borderColor={'black'}
                  mt={2} mb={2} ml={1} mr={1}
                >
                  {reactData.mainMenu.map((this_row, lower_index) => (
                    <React.Fragment key={`lower_card_fragement_${lower_index}`}>
                      {(reactData.sectionOpen.section_name === this_row.section_name) &&
                        <Card className={classes.root}
                          key={`lower_card_${lower_index}`}
                          style={{
                            marginRight: '8px', marginLeft: '8px', marginTop: '16px',
                            borderRadius: ('30px 30px 30px 30px'),
                            backgroundColor: hexToRgb(this_row.section_color, 1),
                            textDecoration: 'none'
                          }}
                          onContextMenu={async (e) => {
                            e.preventDefault();
                            updateReactData({
                              alert: {
                                severity: 'info',
                                title: this_row.activity_name,
                                message: <div>
                                  Activity Code: {this_row.activity_code}<br />
                                  Row Type: {this_row.row_type}<br />
                                  Why on Menu: {this_row.reason}</div>
                              }
                            }, true);
                          }}
                          onClick={async () => {
                            await activityLog(pPerson, this_row.activity_code, this_row.activity_name, reactData.sectionOpen.index);
                            reactData.mainMenu[reactData.sectionOpen.index].last_used = new Date().getTime();
                            let reactUpdObj = {
                              mainMenu: reactData.mainMenu
                            };
                            if (this_row.row_type !== 'document') {
                              if (this_row.subMenu_data) {
                                let subMenu = await MakeAVAMenu(patient, defaultClient, screenQuiet, this_row.subMenu_data);
                                delete reactData.mainMenu[reactData.sectionOpen.index].subMenu_data;
                                reactData.mainMenu.push(...subMenu);
                                reactUpdObj.mainMenu = reactData.mainMenu;
                              }
                              if (this_row.child_menu) {
                                reactUpdObj.currentMenu = this_row.child_menu;
                                reactData.menuArray.push(this_row.child_menu);
                                reactUpdObj.menuArray = reactData.menuArray;
                                reactData.menuNames.push((reactUpdObj.currentMenu === 'main') ? 'AVA Main Menu' : this_row.section_name);
                                reactUpdObj.menuNames = reactData.menuNames;
                              }
                              else {
                                let gad_response = await getActivityDetail(this_row, state);
                                reactUpdObj.selected = gad_response.activityRec;
                                reactUpdObj.loading = false;
                                if (gad_response.loadError) {
                                  updateReactData({
                                    alert: {
                                      severity: 'error',
                                      title: 'Activity error',
                                      message: `AVA could not load ${this_row.activity_name}.  This may resolve itself after AVA's data load completes.  Wait just a moment and try again, please.  If the error persists, contact Support (activity_code=${this_row.activity_name})`
                                    }
                                  }, true);
                                }
                                else {
                                  pause();
                                  reactUpdObj.showNewFactDialog = reactData.sectionOpen.index;
                                }
                              }
                            }
                            updateReactData(reactUpdObj, true);
                          }}
                        >
                          <CardActionArea
                            key={`vRowRefresh_lower_card_action_${lower_index}`}
                          >
                            <CardContent className={classes.cardcontentdetail}
                              key={`vRowRefresh_lower_card_content_${lower_index}`}
                            >
                              <Box
                                display='flex' flexDirection='column'
                                alignItems={'center'} justifyContent={'center'}
                                key={`vRowRefresh_lower_cell_${lower_index}`}
                              >
                                {this_row.row_type === 'document' ?
                                  <a href={this_row.default_value + (!this_row.default_value?.includes('?') ? ('?a=' + new Date().getTime()) : '')} style={{ color: 'inherit', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
                                    <Typography
                                      key={`lower_card_href_${lower_index}`}
                                      style={AVATextStyle({ align: 'center', size: 1, bold: true, color: (isDark(this_row.section_color) ? 'cornsilk' : 'black') })}
                                    >
                                      {this_row.activity_name}
                                    </Typography>
                                  </a>
                                  :
                                  <Typography
                                    key={`lower_card_text_${lower_index}`}
                                    style={AVATextStyle({ align: 'center', size: 1, bold: true, color: (isDark(this_row.section_color) ? 'cornsilk' : 'black') })}
                                  >
                                    {this_row.activity_name}
                                  </Typography>
                                }
                              </Box>
                            </CardContent>
                          </CardActionArea>
                        </Card>

                      }

                    </React.Fragment>
                  ))}
                </Box>
              </Box>
            </Paper>
          }

          {/* Message Box */}
          {reactData.mainMenu && reactData.mainMenu.length > 0 &&
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
                  {reactData.loading &&
                    <React.Fragment>
                      <Typography style={AVATextStyle({ size: 1.5, align: 'center' })}  >{`Loading AVA`}</Typography>
                      <Typography style={AVATextStyle({ size: 0.8, align: 'center' })} >
                        {`AVA version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}
                      </Typography>
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

          {reactData.showPersonSelect &&
            <SwitchPatientDialog
              open={reactData.showPersonSelect}
              roles={roles}
              onClose={() => {
                updateReactData({
                  showPersonSelect: false
                }, true);
              }}
            />
          }

          {reactData.showProfileEdit &&
            <React.Fragment>
              {!session.useOldVersion &&
                <PeopleMaintenance
                  patient={patient}
                  onClose={(updatedPerson) => {
                    if (updatedPerson || !reactData.menu_reloaded) {
                      sessionStorage.removeItem('AVASessionData');
                      window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
                    }
                    else {
                      updateReactData({
                        showProfileEdit: false
                      }, true);
                    }
                  }}
                />
              }
              {session.useOldVersion &&
                <PatientDialog
                  patient={patient}
                  groupData={reactData.groupData}
                  open={true}
                  options={{
                    scrollToPassword: reactData.showPasswordEdit
                  }}
                  onClose={(updatedPerson) => {
                    if (updatedPerson) {
                      sessionStorage.removeItem('AVASessionData');
                      window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
                    }
                    else {
                      updateReactData({
                        showProfileEdit: false
                      }, true);
                    }
                  }}
                />
              }
            </React.Fragment>
          }

          {reactData.showAddAccount &&
            <React.Fragment>
              {!session.useOldVersion &&
                <PeopleMaintenance
                  person_id={null}
                  initialValues={{
                    peopleRec: {
                      client_id: state.session.client_id,
                      groups: ['ALL', '__top__'],
                      address: {}
                    },
                    sessionRec: {
                      client_id: state.session.client_id
                    }
                  }}
                  onClose={() => {
                    reset();
                    sessionStorage.removeItem('AVASessionData');
                    window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
                  }}
                />
              }
              {session.useOldVersion &&
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
                  groupData={reactData.groupData}
                  open={true}
                  onClose={() => {
                    reset();
                    sessionStorage.removeItem('AVASessionData');
                    window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
                  }}
                />
              }
            </React.Fragment>
          }

          {reactData.showQuickSearch &&
            <QuickSearch
              reactData={reactData}
              updateReactData={updateReactData}
              onClose={() => {
                updateReactData({
                  showQuickSearch: false
                }, true);
              }}
            />
          }

          {/* Launch Children */}
          {(reactData.showNewFactDialog > -1) &&
            reactData.selected &&
            <NewFactDialog
              fact={reactData.selected}
              session={session}
              key={`launch_NFD`}
              open={true}
              fromHome={false}
              onClose={async (response) => {
                let reactUpdObj = {};
                if (session?.url_parameters && ('activity' in session.url_parameters) && ('user' in session.url_parameters)) {
                  let jumpTo = window.location.href.replace('theseus', 'thankyou').split('?')[0];
                  jumpTo += `?user=${session.url_parameters.user}`;
                  window.location.replace(jumpTo);
                }
                else if ((['continue', 'next'].includes(response))
                  && (reactData.mainMenu[reactData.showNewFactDialog].raw_data.hasOwnProperty('nextActivity'))) {
                  let nextActivityList = makeArray(reactData.mainMenu[reactData.showNewFactDialog].raw_data.nextActivity);
                  let nextActivityRec;
                  if (isObject(nextActivityList[0])) {
                    if (!nextActivityList[0].activity_code) {
                      reactUpdObj.showNewFactDialog = -1;
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
                  // the assign here "promotes" the default_value in the validation object up to the activityRec itself where getActivityDetails expects it to be
                  nextActivityRec.default_value = Object.assign({}, nextActivityRec.validation.default_value, nextActivityRec.default_value);
                  let gad_response = await getActivityDetail(nextActivityRec, state);
                  reactUpdObj.selected = gad_response.activityRec;
                }
                else {
                  if (response && response.hasOwnProperty('alert')) {
                    reactUpdObj.alert = response.alert;
                  }
                  reset();
                  reactUpdObj.showNewFactDialog = -1;
                }
                updateReactData(reactUpdObj, true);
              }}
              onSave={
                async (pResult) => {
                  reset();
                  if ('client_id' in reactData.selected) {
                    pResult.client_id = reactData.selected.client_id;
                  }
                  await onSaveFact(pResult, reactData.selected.name, reactData.showNewFactDialog);
                }
              }
              onNext={() => {
                reset();
                onNextFact();
              }}
              onSelected={() => { }}
            />
          }
        </React.Fragment >
      </Dialog >
      {reactData.alert &&
        <Snackbar
          open={!!reactData.alert}
          autoHideDuration={(reactData.alert.severity === 'success') ? 5000 : ((reactData.alert.severity === 'info') ? 150000 : null)}
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
            variant='filled'
            style={{ paddingLeft: '24px', paddingRight: '48px', borderRadius: '30px', borderWidth: 4, borderColor: 'black' }}
            onClose={() => {
              updateReactData({
                alert: false
              }, true);
            }}
          >
            {reactData.alert.title && <AlertTitle>{reactData.alert.title}</AlertTitle>}
            {reactData.alert.message}
          </Alert>
        </Snackbar>
      }
    </React.Fragment>
  );
};