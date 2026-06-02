import React from 'react';

import useSession from '../../hooks/useSession';
import { useIdleTimer } from 'react-idle-timer';

import useSound from 'use-sound';
import AVA_AlertSound from '../../ava_alert.mp3';
import { Alert, AlertTitle } from '@material-ui/lab/';

import LinearProgress from '@material-ui/core/LinearProgress';

import PersonFilter from './PersonFilter';
import AVAConfirm from './AVAConfirm';

import { makeName, getImage, getPerson } from '../../util/AVAPeople';
import { deepCopy, titleCase, sentenceCase, makeArray, s3, isObject, isEmpty, dbClient, cl } from '../../util/AVAUtilities';
import { getActivity } from '../../util/AVAObservations';
import { makeDate } from '../../util/AVADateTime';
import { buildDisplayRows, buildQualifiers } from '../../util/AVAActivityLoader';
import { putServiceRequest, getServiceRequests, updateServiceRequest, formatServiceRequestDetails, validRequestStatus } from '../../util/AVAServiceRequest';
import { mealTicketFormat, prepareMessage, sendMessages, resolveMessageVariables } from '../../util/AVAMessages';

import makeStyles from '@material-ui/core/styles/makeStyles';
import { AVAclasses, AVADefaults, AVATextStyle } from '../../util/AVAStyles';

import { Card, CardActions } from '@material-ui/core';
import { Button, IconButton, TextField } from '@material-ui/core';
import { Dialog } from '@material-ui/core';
import { Box, Paper, Typography, Checkbox, Radio, Avatar, Snackbar } from '@material-ui/core';
import { Menu, MenuList, MenuItem } from '@material-ui/core';

import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import CloseIcon from '@material-ui/icons/HighlightOff';
import CheckIcon from '@material-ui/icons/Check';
import DeleteIcon from '@material-ui/icons/Delete';
import GroupAddIcon from '@material-ui/icons/GroupAdd';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import CheckBoxIcon from '@material-ui/icons/CheckBox';
import CheckBoxOutlineBlankIcon from '@material-ui/icons/CheckBoxOutlineBlank';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';

const useStyles = makeStyles(theme => ({
  smallTextLine: {
    fontSize: theme.typography.fontSize * 1.0,
    flexGrow: 0,
    lineHeight: 1.25,
    whiteSpace: 'break-spaces'
  },
  messageArea: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popUpFooter: {
    fontSize: theme.typography.fontSize * 0.8,
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
  },
  freeInput: {
    marginLeft: theme.spacing(1),
    paddingLeft: 0,
    paddingRight: 0,
    flexGrow: 2,
    width: '95%',
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  rootNoPadding: {
    paddingBottom: 0,
    paddingTop: 0,
  },
  inputRow: {
    marginTop: theme.spacing(1.5),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
  listItem: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  backGroundRed: {
    backgroundColor: 'red'
  },
  backGroundGreen: {
    backgroundColor: 'green'
  },
  backGroundNone: {
  },
  hiddenItem: {
    display: 'none',
    visibility: 'hidden'
  },
  listTopRow: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  listItemSticky: {   // keep
    position: 'sticky',
    top: 0,
    opacity: 1,
    zIndex: 1,
    width: '100%',
  },
  page: {
    // height: 950,
  },
  buttonArea: {
    maxWidth: 1000,
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  }
}));

export default ({ fact, factName, defaultValue, prompt, pClient, qualifiers, listValues, onSave, onClose }) => {

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { state } = useSession();

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [cancelPending, setCancelPending] = React.useState(false);
  const [confirmStatus, setConfirmStatus] = React.useState('');
  const [confirmPrompt, setConfirmPrompt] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [morePeople, setMorePeople] = React.useState(false);

  const nowObj = new Date();

  const [reactData, setReactData] = React.useState({
    initialLoadComplete: false,
    defaultPerson: null,
    defaultQualSelections: {},
    defaultRequestType: null,
    titleName: {
      display: null,
      remembered: []
    },
    columnList: [],
    loadProgress: [],
    attachmentList: [],
    idleState: false,
    lastActiveTime: nowObj,
    version: 1,
    viewOnly: false,
    allowAttachments: false,
    errorOnScreen: false,
    factName: factName,
    expanded: []
  });

  const [records2Update, setRecords2Update] = React.useState([]);
  const [allowAddPeople, setAllowAddPeople] = React.useState(false);
  const [allowRemovePeople, setAllowRemovePeople] = React.useState(true);

  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [selectedColumn, setSelectedColumn] = React.useState(0);

  const factType = fact.activity_key.split('.')[0];

  const [play] = useSound(AVA_AlertSound, { volume: 1 });

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  /* value                       | meaning                                  | example                                                   */
  /* ---------                   | ----------                               | -------------                                             */

  /* headers...
  /* ~~<displayThis>             | section header                           | ~~Entree Choices                                          */

  /* check boxes...
  /* <textOnly>                  | selection/check box                      | Filet Mignon                                              */

  /* instructions...
  /* ~[checkbox=off]             | Stop rendering check boxes, render value only
  /* ~[checkbox=on]              | Begin rendering check boxes AND values
  /* ~[display=off]              | Do not display anything until display=on is encountered
  /* ~[display=on]               | Begin showing lines again
  /* ~[required=on]              | Text fields between these tags must not be left blank
  /* ~[required=off]             | Stop requiring entry in text fields
  /* ~[displayIF=test]           | only show this row if the test is true, will keep test on until endif encountered
  /* ~[endif]                    | stop testing rows

   
  /* prompt for response...
  /* ~other:<text>               | prompt for text response with <text>     | ~other:What is your name?                                */
  /* ~time:<text>                | prompt for time response with <text>     | ~time:What time would you like your meal?                */
  /* ~date:<text>                | prompt for date response with <text>     | ~date:What date would you like your meal?                */

  /* special cases...
  /* ~+<key>~<value>             | use value only when <key> is selected    | ~+Filet Mignon~~!How would you like your filet cooked?      */

  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  async function extractRequestType(aKey) {
    let activityParts = aKey.split('//');
    let activityCode = activityParts.pop();
    let activityClient = ((activityParts.length > 0) ? activityParts[0] : state.session.client_id);
    let activityRec = await getActivity(activityClient, activityCode);
    return activityRec.request_type || activityRec.name;
  }

  async function initialLoad() {
    let defaultObj = buildDefaults(defaultValue);
    let paymentInfo = defaultObj.collectPayment
      || defaultValue.collectPayment
      || (defaultValue.global_defaults && defaultValue.global_defaults.collectPayment);
    if (paymentInfo) {
      if (typeof (paymentInfo) === 'string') {
        paymentInfo = {
          allow: true
        };
      }
      updateReactData({
        collectPayment: paymentInfo,
      }, false);
    }
    let defaultColumnList = [];
    let localData_maxDName = 0;
    // eslint-disable-next-line
    {  // build defaultColumns object from passed in activities for this request
      if (!defaultValue || !defaultValue.hasOwnProperty('activities')) {
        if (!fact.activity_code && fact.activity_key) {
          fact.activity_code = fact.activity_key;
        }
        let this_requestType = defaultValue.requestType || defaultValue.request_type || await extractRequestType(fact.activity_code) || 'noRType';
        let this_requestName = state.session.service_request_types.hasOwnProperty(this_requestType) ? state.session.service_request_types[this_requestType].description : titleCase(this_requestType);
        let this_foreignKey = defaultValue.foreignKey || defaultValue.foreign_key || 'noFKey';
        let fDate = makeDate(this_foreignKey);
        let dName = ([' ', ' ', ' '].concat(this_requestName.split(' ').slice(-3)).concat(fDate.error ? [] : ((fDate.absolute).split(','))));
        localData_maxDName = Math.max((localData_maxDName || 0), dName.length);
        let rowDetails = await buildDisplayRows(listValues, defaultObj, qualifiers);
        for (let r = 0; r < rowDetails.length; r++) {
          rowDetails[r].version = 1;
          if (rowDetails[r].checkbox && rowDetails[r].observationKey && !rowDetails[r].qualData) {
            let qualResponse = await buildQualifiers(rowDetails[r].observationKey);
            if (Object.keys(qualResponse.selections).length > 0) {
              rowDetails[r].qualSelections = deepCopy(qualResponse.selections);
            }
            if (Object.keys(qualResponse.data).length > 0) {
              rowDetails[r].qualData = deepCopy(qualResponse.data);
            }
            if (Object.keys(qualResponse.moreInfo).length > 0) {
              rowDetails[r].moreInfo = deepCopy(qualResponse.moreInfo);
            }
          }
        }
        defaultColumnList.push({
          rowDetails: rowDetails,
          activity_key: fact.activity_code,
          foreignKey: this_foreignKey,
          requestType: this_requestType,
          requestName: this_requestName,
          defaultValues: defaultObj,
          column_id: `${this_requestType}_${this_foreignKey}`,
          dName: dName
        });
      }
      else {
        for (let a = 0; a < defaultValue.activities.length; a++) {
          // merge global defaults and column_defaults into a single object; column_defaults will override globals
          let defaultsToUse = deepCopy(Object.assign({}, defaultObj, defaultValue.activities[a].column_defaults || {}));
          // if this activity carries qualifiers with it, add those to the qualifiers object that was passed in
          if (defaultsToUse.hasOwnProperty('collectPayment')) {
            if (typeof (defaultsToUse.collectPayment) === 'string') {
              updateReactData({
                collectPayment: {
                  allow: true
                }
              }, false);
            }
            else {
              updateReactData({
                collectPayment: defaultsToUse.collectPayment,
              }, false);
            }
          }
          if (defaultValue.activities[a].hasOwnProperty('qualifiers')) {
            Object.assign(qualifiers, defaultValue.activities[a].qualifiers);
          }
          let this_activityKey = defaultValue.activities[a].column_defaults.activity_code || defaultValue.activities[a].activityRec.activity_code || fact.activity_code;
          let this_requestType = defaultValue.activities[a].column_defaults.requestType || defaultValue.requestType || defaultValue.request_type || await extractRequestType(this_activityKey) || 'noRType';
          let this_requestName = state.session.service_request_types.hasOwnProperty(this_requestType) ? state.session.service_request_types[this_requestType].description : titleCase(this_requestType);
          let this_foreignKey = defaultValue.activities[a].column_defaults.foreignKey || defaultValue.foreignKey || defaultValue.foreign_key || 'noFKey';
          let fDate = makeDate(this_foreignKey);
          let dName = ([' ', ' ', ' '].concat(this_requestName.split(' ').slice(-3)).concat(fDate.error ? [] : ((fDate.absolute).split(/,\s*/))));
          localData_maxDName = Math.max((localData_maxDName || 0), dName.length);
          let rowDetails = await buildDisplayRows(defaultValue.activities[a].activityRec.valid_values_list, defaultsToUse, qualifiers);
          for (let r = 0; r < rowDetails.length; r++) {
            rowDetails[r].version = 1;
            if (rowDetails[r].checkbox && rowDetails[r].observationKey && !rowDetails[r].qualData) {
              let qualResponse = await buildQualifiers(rowDetails[r].observationKey);
              if (Object.keys(qualResponse.selections).length > 0) {
                rowDetails[r].qualSelections = deepCopy(qualResponse.selections);
              }
              if (Object.keys(qualResponse.data).length > 0) {
                rowDetails[r].qualData = deepCopy(qualResponse.data);
              }
              if (Object.keys(qualResponse.moreInfo).length > 0) {
                rowDetails[r].moreInfo = deepCopy(qualResponse.moreInfo);
              }
            }
          }
          defaultColumnList.push({
            rowDetails: rowDetails,
            activity_key: this_activityKey,
            foreignKey: this_foreignKey,
            requestType: this_requestType,
            requestName: this_requestName,
            defaultValues: defaultsToUse,
            column_id: `${this_requestType}_${this_foreignKey}`,
            dName: dName

          });
        }
      }
    }

    updateReactData({
      defaultColumns: defaultColumnList,
      maxDName: localData_maxDName,
      columnList: []
    }, false);

    // columns are created for each person_id, foreignKey, requestType combination
    // The person is assigned in one of three ways: 
    //    1. selected - a selectList will be passed in the defaultValue.selectList
    //    2. pre-assigned - a peopleList will be passed in the defaultValue.peopleList
    //    3. default - if neither of the above, use the current session.patient_id

    if (defaultValue.peopleList && defaultValue.peopleList.peopleList && (defaultValue.peopleList.peopleList.length > 0)) {
      for (let p = 0; p < defaultValue.peopleList.peopleList.length; p++) {
        await addColumns(defaultValue.peopleList.peopleList[p].person_id);
      }
    }
    else if (defaultValue.selectList) {
      updateReactData({
        selectionList: defaultValue.selectList.selectionList || defaultValue.selectList.shortList
      }, false);
    }
    else {
      await addColumns(state.session.patient_id);
    }

    updateReactData({
      initialLoadComplete: true,
      columnList: reactData.columnList,
      titleName: reactData.titleName
    }, true);

    function buildDefaults(defaultValue) {
      let returnObj = {};
      if (defaultValue) {
        for (let dKey in defaultValue) {
          switch (dKey) {
            case ('importTypes'): {
              break;
            }
            case ('allowAddPeople'): {
              setAllowAddPeople(defaultValue.allowAddPeople);
              break;
            }
            case ('allowAttachment'):
            case ('allowAttachments'): {
              updateReactData({ allowAttachments: true }, false);
              break;
            }
            case ('viewOnly'): {
              updateReactData({ viewOnly: true }, false);
              break;
            }
            case ('allowRemovePeople'): {
              setAllowRemovePeople(defaultValue.allowRemovePeople);
              break;
            }
            case ('selectList'): {
              if (defaultValue.selectList.addPeople) {
                setAllowAddPeople(defaultValue.selectList.addPeople);
              }
              break;
            }
            case ('peopleList'): {
              if (defaultValue.peopleList.addPeople) {
                setAllowAddPeople(defaultValue.peopleList.addPeople);
              }
              break;
            }
            case ('activities'): {
              break;
            }
            default: {
              if (typeof defaultValue[dKey] === 'string') {
                returnObj[dKey] = defaultValue[dKey];
              }
            }
          };
        }
      }
      return returnObj;
    }

  };

  React.useEffect(() => {
    async function initialize() {
      let activity_info = `${reactData.factName} request started`;
      if (state.session.user_id !== state.session.patient_id) {
        activity_info += ` by ${state.session.user_id}`;
      }
      dbClient
        .put({
          TableName: 'ActivityLog',
          Item: {
            timestamp: new Date().getTime(),
            user_id: state.session.patient_id || 'error-no_patient_id',
            activity_code: activity_info,
            activity_name: `MultiObservationFormD`,
            cookieValues: 'n/a',
            errorInfo: null,
            AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
          }
        })
        .promise()
        .catch(putError => {
          console.log(`Bad put to ActivityLog - caught error is: ${putError}`);
        });
      await initialLoad();
    }
    if (!reactData.initialLoadComplete) {
      initialize();
      start();  // idle timer
    }
  }, [defaultValue]);  // eslint-disable-line react-hooks/exhaustive-deps

  function columnUniqueName(my_column) {
    let commonRows = ([' ', ' ', ' ', ' ', ' '].concat(reactData.columnList[0].dName)).slice(-10);
    reactData.columnList.forEach(this_column => {
      let testName = ([' ', ' ', ' ', ' ', ' '].concat(this_column.dName)).slice(-10);
      testName.forEach((dN, dX) => {
        if (dN !== commonRows[dX]) {
          commonRows[dX] = false;
        }
      });
    });
    let testName = ([' ', ' ', ' ', ' ', ' '].concat(my_column.dName)).slice(-10);
    let showName = testName.filter((n, x) => {
      return !commonRows[x];
    });
    let returnData = {
      string: showName.slice(-7).join(' ').trim(),
      array: showName
    };
    return returnData;
  }

  function columnCommonName() {
    let commonRows = ([' ', ' ', ' ', ' ', ' '].concat(reactData.columnList[0].dName)).slice(-1 * reactData.maxDName);
    reactData.columnList.forEach(this_column => {
      let testName = ([' ', ' ', ' ', ' ', ' '].concat(this_column.dName)).slice(-1 * reactData.maxDName);
      testName.forEach((dN, dX) => {
        if (dN !== commonRows[dX]) {
          commonRows[dX] = false;
        }
      });
    });
    let commonText = '';
    commonRows.forEach(c => {
      if (c && !reactData.columnList[0].display_name.includes(c)) { commonText += (c + ' '); };
    });
    updateReactData({
      commonText,
      commonRows
    }, false);
    return;
  }

  function loadingInProgress(index = 'all') {
    if (!reactData.loadProgress) {
      return false;
    }
    if (index !== 'all') {
      return (reactData.loadProgress[index] && reactData.loadProgress[index].loading);
    }
    else {
      return (reactData.loadProgress.some(i => {
        return (i.loading);
      }));
    }
  }

  function cleanForDisplay(inString) {
    if (!inString) {
      return '';
    }
    else {
      let response = inString.replaceAll('%20', ' ');
      let body = response.split('.');
      if (body.length > 1) {
        body.pop();
        response = body.join('.');
      }
      return response.replace(/_\d*$/gm, "");
    }
  }



  const hiddenFileInput = React.useRef(null);
  const handleFileUpload = event => {
    hiddenFileInput.current.click();
  };

  let upload;
  async function handleSaveFile(pTarget) {
    let pType = pTarget.type;
    upload = s3.upload({
      partSize: 10 * 1024 * 1024,
      queueSize: 4,
      Bucket: 'theseus-medical-storage',
      Key: pTarget.name,
      Body: pTarget,
      ACL: 'public-read-write',
      ContentType: pType
    });
    let reactData_index = reactData.attachmentList.push({
      Key: pTarget.name
    }) - 1;
    reactData.loadProgress[reactData_index] = {
      loading: true,
      fileName: '',
      total: 1,
      progress: 0
    };
    updateReactData({ loadProgress: reactData.loadProgress }, true);
    let s3Resp = await performUpload();
    reactData.attachmentList[reactData_index] = s3Resp;
    if (!reactData.textInput) { reactData.textInput = { 's3file': s3Resp.Location }; }
    else { reactData.textInput.s3file = s3Resp.Location; }
    reactData.loadProgress[reactData_index] = {
      loading: false,
      fileName: '',
      total: 1,
      progress: 0
    };
    updateReactData({
      loadProgress: reactData.loadProgress,
      attachmentList: reactData.attachmentList,
      textInput: reactData.textInput
    }, true);
    return s3Resp;

    function performUpload() {
      return new Promise(function (resolve, reject) {
        upload
          .send((err, good) => {
            if (err) {
              if (err.code === 'RequestAbortedError') {
                updateReactData({
                  alert: {
                    severity: 'error',
                    title: 'File upload stopped',
                    message: `AVA stopped loading at your request.`,
                    persist: true
                  }
                }, true);
              }
              else {
                updateReactData({
                  alert: {
                    severity: 'error',
                    title: 'File upload error',
                    message: `Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`,
                    persist: true
                  }
                }, true);
              }
              reject({});
            }
            else {
              resolve(good);
            }
          });
        upload.on('httpUploadProgress', progress => {
          if (reactData.loadProgress[reactData_index].loading === 'abort') {
            upload.abort();
            reactData.loadProgress.splice(reactData_index, 1);
          }
          else {
            let pFactor = 1000;
            do {
              pFactor *= 10;
            }
            while (progress.total > (1000 * pFactor));
            reactData.loadProgress[reactData_index] = {
              loading: true,
              fileName: progress.key,
              total: (progress.total / pFactor),
              progress: ((progress.loaded * 100) / progress.total)
            };
          }
          updateReactData({ loadProgress: reactData.loadProgress }, true);
        });
      });
    };
  };

  const handleChangeTextField = (vText, columnNumber, rowNumber) => {
    reactData.columnList[columnNumber].columnActivated = true;
    if (!reactData.columnList[columnNumber].rowDetails[rowNumber].hasOwnProperty('textValue')) {
      reactData.columnList[columnNumber].rowDetails[rowNumber].textValue = '';
    }
    reactData.columnList[columnNumber].rowDetails[rowNumber].error = '';
    if (!vText || (vText === '')) {
      reactData.columnList[columnNumber].rowDetails[rowNumber].isChecked = false;
      if (reactData.columnList[columnNumber].rowDetails[rowNumber].required) {
        reactData.columnList[columnNumber].rowDetails[rowNumber].error = 'This information is required';
      }
      reactData.columnList[columnNumber].rowDetails[rowNumber].textValue = '';
    }
    else {
      reactData.columnList[columnNumber].rowDetails[rowNumber].isChecked = true;
      if (reactData.columnList[columnNumber].rowDetails[rowNumber].input.toLowerCase() === 'promptall') {
        handleTextAll(vText, reactData.columnList[columnNumber].rowDetails[rowNumber].text);
      }
      else if (reactData.columnList[columnNumber].rowDetails[rowNumber].input === 'date') {
        handleDateExit(vText, columnNumber, rowNumber);
      }
      else if (reactData.columnList[columnNumber].rowDetails[rowNumber].input === 'time') {
        handleTimeExit(vText, columnNumber, rowNumber);
      }
      else if (reactData.columnList[columnNumber].rowDetails[rowNumber].input.toLowerCase() === 'promptall') {
        handleTextAll(vText, reactData.columnList[columnNumber].rowDetails[rowNumber].text);
      }
      else if ((reactData.columnList[columnNumber].rowDetails[rowNumber].obo_line)
        || (reactData.columnList[columnNumber].rowDetails[rowNumber].input.toLowerCase() === 'obo')) {
        handleOBOText(vText, columnNumber, rowNumber);
      }
      else {
        reactData.columnList[columnNumber].rowDetails[rowNumber].textValue = vText.replace(/[\r\n]+/gm, '');
      }
    }
    if (isNaN(reactData.columnList[columnNumber].rowDetails[rowNumber].version)) {
      reactData.columnList[columnNumber].rowDetails[rowNumber].version = new Date().getTime();
    }
    else {
      reactData.columnList[columnNumber].rowDetails[rowNumber].version++;
    }
    updateReactData({ columnList: reactData.columnList }, true);
    return;
  };

  function handleDateExit(vText, columnNumber, rowNumber) {
    let AVAdate = makeDate(vText, reactData.columnList[columnNumber].rowDetails[rowNumber].row_qualifier);
    if (AVAdate.error) {
      reactData.columnList[columnNumber].rowDetails[rowNumber].error = AVAdate.absolute;
    }
    else {
      reactData.columnList[columnNumber].rowDetails[rowNumber].error = '';
      reactData.columnList[columnNumber].rowDetails[rowNumber].textValue = AVAdate.absolute_full;
    }
    return;
  };

  function handleTimeExit(vText, columnNumber, rowNumber) {
    reactData.columnList[columnNumber].rowDetails[rowNumber].error = '';
    let ampm = null;
    if (vText.includes('p')) { ampm = 'pm'; }
    else if (vText.includes('a')) { ampm = 'am'; };
    let [hh$, mm$] = vText.split(':');
    let hh = Number(hh$.replace(/\D+/g, ''));
    let mm = 0;
    if (hh > 100) {
      if (!mm$) { mm = hh % 100; }
      hh = Math.floor(hh / 100);
    }
    if (mm$) { mm = Number(mm$.replace(/\D+/g, '')); }
    if (mm > 59) {
      let hAdd = Math.floor(mm / 60);
      mm -= (hAdd * 60);
      hh += hAdd;
    }
    if (hh >= 23) {
      hh = hh % 24;
    }
    if (hh >= 12) {
      hh -= 12;
      ampm = 'pm';
    }
    if (hh === 0) {
      hh = 12;
      ampm = 'pm';
    }
    if (!ampm) { ampm = ((hh > 6) && (hh < 12)) ? 'am' : 'pm'; }
    reactData.columnList[columnNumber].rowDetails[rowNumber].textValue = `${hh}:${mm < 10 ? ('0' + mm) : mm} ${ampm}`;
    return;
  };

  function handleOBOText(vText, columnNumber, rowNumber) {
    let inactiveAssignment = state?.session?.group_assignments?.inactive;
    let inactiveGroup = [];
    if (!inactiveAssignment) {
      inactiveGroup = ['inactive'];
    }
    else if (Array.isArray(inactiveAssignment)) {
      inactiveGroup.push(...inactiveAssignment);
    }
    else {
      inactiveGroup = [inactiveAssignment];
    }
    let prohibitedGroups = inactiveGroup;
    if (defaultValue.obo_prohibited) {
      let prohibitedList = makeArray(defaultValue.obo_prohibited);
      prohibitedList.forEach(p => {
        prohibitedGroups.push(...makeArray(state?.session?.group_assignments?.[p]));
      });
    };
    let guestAssignment = state?.session?.group_assignments?.guest;
    let guestGroups = [];
    if (!guestAssignment) {
      guestGroups = ['guest'];
    }
    else if (Array.isArray(guestAssignment)) {
      guestGroups.push(...guestAssignment);
    }
    else {
      guestGroups = [guestAssignment];
    }
    let typed_in_words = vText.toLowerCase().split(/\s+/).filter(w => { return w.length > 2; });
    let hits = [];
    let errorText = null;
    let winnerList = [];
    let selections = {};
    if (!state?.accessList?.[state.session.client_id]?.list) {
      errorText = `AVA is still loading names.  Please wait a few seconds and try again.`;
    }
    else {
      let maxMatch = 1;
      for (let accessList_person of state.accessList[state.session.client_id].list) {
        if (prohibitedGroups.includes(accessList_person.member_of)) {
          return false;
        }
        // if any word in the display_name matches a typed in word, it is a "hit"
        let wordsMatched = accessList_person.display_name.toLowerCase().split(/\s+/).reduce((total_matches, name_word) => {  // for every word in the display_name...
          if (typed_in_words.some(typed_in_word => {   // check for any typed in word that exactly matches
            return (typed_in_word === name_word);
          })) {
            total_matches++;
          };
          return total_matches;
        }, 0);
        if (wordsMatched >= maxMatch) {
          maxMatch = Math.min(wordsMatched, typed_in_words.length);  // you can't match 4 words if only 2 words were typed in
          hits.push({
            accessRec: accessList_person,
            wordsMatched
          });
        }
      };
      if (hits.length === 0) {
        errorText = `Nobody found to match that name`;
      }
      else {
        winnerList = [{
          default: '',
          max_allowed: 1,
          min_required: 1,
          option: [],
        }];
        for (let this_hit of (hits.filter(h => { return h.wordsMatched >= maxMatch; }))) {
          let newDName = `${this_hit.accessRec.name?.first} ${this_hit.accessRec.name?.last}`.trim() || this_hit.accessRec.display_name;
          let select_name = `${newDName}${guestGroups.includes(this_hit.accessRec.member_of)
            ? ' (Guest)'
            : (this_hit.accessRec.location ? ' (' + this_hit.accessRec.location + ')' : '')
            }`;
          winnerList[0].option.push({
            person_id: this_hit.accessRec.id,
            location: this_hit.location,
            dName: newDName,
            display: select_name,
            type: 'checkbox'
          });
          selections[select_name] = false;
        }
        if (winnerList[0].option.length > 1) {
          winnerList[0].title = `AVA found ${winnerList[0].option.length} people to match that name.`;
        }
      }
      let targetColumns = [];
      if (!defaultValue.selectList) {
        reactData.columnList.forEach((c, x) => {
          targetColumns.push(x);
        });
      }
      else {
        targetColumns.push(columnNumber);
      }
      targetColumns.forEach(c => {
        reactData.columnList[c].rowDetails[rowNumber].error = '';
        reactData.columnList[c].rowDetails[rowNumber].qualData = [];
        reactData.columnList[c].rowDetails[rowNumber].qualSelections = {};
        if (winnerList[0].option.length === 1) {
          reactData.columnList[c].person_id = winnerList[0].option[0].person_id;
          let newDName = winnerList[0].option[0].dName;
          reactData.columnList[c].display_name = newDName;
          reactData.columnList[c].dName.splice(-3, 3, ...([' ', ' ', ' '].concat(newDName.split(/\s+/).splice(-3))));
          vText = winnerList[0].option[0].display;
          resetTitleName();
          reactData.columnList[c].rowDetails.forEach((checkRow, r) => {
            if (checkRow.location_line) {
              reactData.columnList[c].rowDetails[r].textValue = winnerList[0].option[0].location || '';
            }
          });
        }
        else if (errorText) {
          reactData.columnList[c].rowDetails[rowNumber].error = errorText;
        }
        else {
          reactData.columnList[c].person_id = winnerList[0].option[0].person_id;
          reactData.columnList[c].display_name = winnerList[0].option[0].dName;
          reactData.columnList[c].dName.splice(-3, 3, ...([' ', ' ', ' '].concat(winnerList[0].option[0].dName.split(/\s+/).splice(-3))));
          resetTitleName();
          reactData.columnList[c].rowDetails[rowNumber].isChecked = true;
          reactData.columnList[c].rowDetails[rowNumber].isExpanded = true;
          reactData.columnList[c].rowDetails[rowNumber].version = new Date().getTime();
          reactData.columnList[c].rowDetails[rowNumber].qualData = winnerList;
          reactData.columnList[c].rowDetails[rowNumber].qualSelections = {
            [winnerList[0].title]: selections
          };
          vText = winnerList[0].option[0].dName;
          reactData.columnList[c].rowDetails.forEach((checkRow, r) => {
            if (checkRow.location_line) {
              reactData.columnList[c].rowDetails[r].textValue = winnerList[0].option[0].location || '';
            }
          });
        }
        reactData.columnList[c].rowDetails[rowNumber].textValue = titleCase(vText);
      });
      return;
    }
  };

  function resetTitleName() {
    let workingTitle = {};
    reactData.columnList.forEach(this_person => {
      let nameWords = this_person.display_name.split(/\s+/);
      let this_lastName = nameWords.pop();
      let this_firstName = nameWords.join(' ');
      if (!workingTitle || !workingTitle.remembered || (workingTitle.remembered.length === 0)) {
        workingTitle = {
          first: this_firstName,
          last: this_lastName.trim(),
          display: this_person.display_name,
          remembered: [this_person.display_name]
        };
      }
      else if (workingTitle.last.toLowerCase() !== this_lastName.trim().toLowerCase()) {
        if (!workingTitle.remembered.includes(this_person.display_name)) {
          workingTitle.display = `${workingTitle.remembered.push(this_person.display_name)} people`;
        }
        workingTitle.first = '_multi_';
        workingTitle.last = '_multi_';
      }
      else {         // same last name as all others so far
        if (!workingTitle.remembered.includes(this_person.display_name)) {
          workingTitle.remembered.push(this_person.display_name);
          workingTitle.display = `${workingTitle.first} and ${this_person.display_name}`;
          workingTitle.first = `${workingTitle.first}, ${this_firstName.trim()}`;
        }
      }
    });
    updateReactData({ titleName: workingTitle }, false);
  }

  function handleTextAll(vText, this_item) {
    reactData.columnList.forEach((this_column, columnNumber) => {
      let rowNumber = this_column.rowDetails.findIndex(r => {
        return (r.text === this_item);
      });
      if (rowNumber >= 0) {
        reactData.columnList[columnNumber].rowDetails[rowNumber].textValue = vText;
      }
    });
    return;
  };

  function isQualChecked(rowData, pOption, pSelection) {
    if (!rowData.qualSelections) { return false; }
    if (!rowData.qualSelections.hasOwnProperty(pOption)) { return false; }
    return !!rowData.qualSelections[pOption][pSelection];
  }

  async function itemSelected(columnNumber, rowNumber) {
    let this_row = reactData.columnList[columnNumber].rowDetails[rowNumber];
    this_row.isChecked = !this_row.isChecked;
    this_row.isExpanded = this_row.isChecked;
    if (isNaN(this_row.version)) {
      this_row.version = new Date().getTime();
    }
    else {
      this_row.version++;
    }
    if (this_row.isChecked && this_row.observationKey && !this_row.qualData) {
      // let [myQualSelections, myQualData] = await buildQualifiers(this_row.observationKey);
      let qualResponse = await buildQualifiers(this_row.observationKey);
      if (Object.keys(qualResponse.selections).length > 0) {
        this_row.qualSelections = deepCopy(qualResponse.selections);
      }
      if (Object.keys(qualResponse.data).length > 0) {
        this_row.qualData = deepCopy(qualResponse.data);
      }
      if (Object.keys(qualResponse.moreInfo).length > 0) {
        this_row.moreInfo = deepCopy(qualResponse.moreInfo);
      }
    }
    reactData.columnList[columnNumber].columnActivated = true;
    reactData.columnList[columnNumber].rowDetails[rowNumber] = this_row;
    updateReactData({ columnList: reactData.columnList }, true);
  }

  function getQualTextValue(rowData, qOpt, qChoice) {
    if (rowData.qualSelections && rowData.qualSelections[qOpt]) {
      return rowData.qualSelections[qOpt][qChoice] || '';
    }
    else {
      return '';
    }
  }

  function optSelected(rowData, qOpt, qChoice, qValueText) {
    // reactData.columnList[columnNumber].rowDetails[rowNumber].qualSelections[pText][pOption][pSelection]
    if (!rowData.hasOwnProperty('qualData')) {
      return;
    }
    // which entry in qualData contains the qOpt information?
    let optionAt = rowData.qualData.findIndex(opt => {
      return (opt.title === qOpt);
    });
    if (optionAt < 0) {
      return;
    }
    if (isNaN(rowData.version)) {
      rowData.version = new Date().getTime();
    }
    else {
      rowData.version++;
    }

    let qualRules = rowData.qualData[optionAt];
    // which option in rowData.qualData[optionAt] contains the qChoice information?

    //    reactData.columnList[columnNumber].rowDetails[rowNumber].hasOwnProperty('qualSelections').qualSelections[pText][pOption][pSelection]
    if (!rowData.hasOwnProperty('qualSelections')) {
      rowData.qualSelections = {
      };
    }
    if (!rowData.qualSelections.hasOwnProperty(qOpt)) {
      rowData.qualSelections[qOpt] = {
        [qChoice]: (qValueText || true)
      };
    }
    else {
      if (rowData.qualSelections[qOpt].hasOwnProperty(qChoice)) {
        if (typeof (rowData.qualSelections[qOpt][qChoice]) === 'boolean') {
          rowData.qualSelections[qOpt][qChoice] = !rowData.qualSelections[qOpt][qChoice];
        }
        else { rowData.qualSelections[qOpt][qChoice] = qValueText; }
      }
      else { rowData.qualSelections[qOpt][qChoice] = (qValueText || true); }
    }

    let optionsSelected = [];
    for (let choice in rowData.qualSelections[qOpt]) {
      if (rowData.qualSelections[qOpt][choice]) {
        optionsSelected.push(choice);
      }
    }
    let numberOfSelections = optionsSelected.length;
    if (qualRules.max_allowed && (numberOfSelections > qualRules.max_allowed)) {
      for (let o = 0; ((o < optionsSelected.length) && (numberOfSelections > qualRules.max_allowed)); o++) {
        // too many selections?  turn off the first one we find that isn't the one requested in the function call
        if (optionsSelected[o] !== qChoice) {
          rowData.qualSelections[qOpt][optionsSelected[o]] = false;
          numberOfSelections--;
        }
      }
    }
    if (qualRules.min_required && (numberOfSelections < qualRules.min_required)) {   // not enough selections
      if (qualRules.default && !rowData.qualSelections[qOpt][qualRules.default]) {   // and the default is not selected 
        rowData.qualSelections[qOpt][qualRules.default] = true;
        numberOfSelections++;
      }
      for (let o = 0; ((o < qualRules.option.length) && (numberOfSelections < qualRules.min_required)); o++) {
        // start turning things on until we have enough; but don't touch the one requested in the function call
        if ((!rowData.qualSelections[qOpt][qualRules.option[o].display])
          && (qualRules.option[o].display !== qOpt)
          && (qualRules.option[o].type === 'checkbox')
        ) {
          rowData.qualSelections[qOpt][qualRules.option[o].display] = true;
          numberOfSelections++;
        }
      }
    }
    return rowData;
  }

  async function addColumns(this_id) {
    let this_person = await getPerson(this_id);
    let this_name = (`${this_person.name.first} ${this_person.name.last}`).trim();
    if (!reactData.titleName || !reactData.titleName.remembered || (reactData.titleName.remembered.length === 0)) {
      reactData.titleName = {
        first: this_person.name.first.trim(),
        last: this_person.name.last.trim(),
        display: this_name,
        remembered: [this_name]
      };
    }
    else if (reactData.titleName.last.toLowerCase() !== this_person.name.last.trim().toLowerCase()) {
      if (!reactData.titleName.remembered.includes(this_name)) {
        reactData.titleName.display = `${reactData.titleName.remembered.push(this_name)} people`;
      }
      reactData.titleName.first = '_multi_';
      reactData.titleName.last = '_multi_';
    }
    else {         // same last name as all others so far
      if (!reactData.titleName.remembered.includes(this_name)) {
        reactData.titleName.remembered.push(this_name);
        reactData.titleName.display = `${reactData.titleName.first} and ${this_name}`;
        reactData.titleName.first = `${reactData.titleName.first}, ${this_person.name.first.trim()}`;
      }
    }
    let myDefaultColumns = deepCopy(reactData.defaultColumns);
    for (let c = 0; c < myDefaultColumns.length; c++) {              // for each column
      let column = myDefaultColumns[c];
      for (let dKey in column.defaultValues) {
        if (column.defaultValues[dKey] === '[person.location]') {
          myDefaultColumns[c].defaultValues[dKey] = this_person.location;
        }
        else if (column.defaultValues[dKey] === '[person.name]') {
          myDefaultColumns[c].defaultValues[dKey] = `${this_person.first} ${this_person.last}`;
        }
        else if ((typeof (column.defaultValues[dKey]) === 'string') && (column.defaultValues[dKey].startsWith('[person.'))) {
          let pKey = column.defaultValues[dKey].split('.')[1];
          if (this_person.hasOwnProperty(pKey)) {
            myDefaultColumns[c].defaultValues[dKey] = this_person[pKey];
          }
        }
      }
      myDefaultColumns[c].columnActivated = false;
      myDefaultColumns[c].rowDetails.forEach((dRow, r) => {
        if (dRow.textValue) {
          if (dRow.textValue === '[person.location]') {
            myDefaultColumns[c].rowDetails[r].textValue = this_person.location;
          }
          else if (dRow.textValue === '[person.name]') {
            myDefaultColumns[c].rowDetails[r].textValue = `${this_person.first} ${this_person.last}`;
          }
          else if (dRow.textValue.startsWith('[person.')) {
            let pKey = dRow.textValue.split('.')[1];
            if (this_person.hasOwnProperty(pKey)) {
              myDefaultColumns[c].rowDetails[r].textValue = this_person[pKey];
            }
          }
        }
      });
      myDefaultColumns[c].person_id = this_id;
      myDefaultColumns[c].column_id = `${column.column_id}_${this_id}`;
      myDefaultColumns[c].display_name = this_name;
      // add three elements for the name at the end of the dName array (regardless of whether you have 2 or 3 words in your name)
      let nameElements = [' ', ' '].concat((`${this_person.name.first} ${this_person.name.last}`).trim().split(/[\s-]+/));
      myDefaultColumns[c].dName.push(...(nameElements.slice(-3)));
      if (myDefaultColumns[c].dName.length > reactData.maxDName) {
        updateReactData({
          maxDName: myDefaultColumns[c].dName.length
        }, false);
      }
      if (defaultValue.checkForDuplicates) {
        let existingRequest = await checkExistingRequests({
          client_id: state.session.client_id,
          foreign_key: myDefaultColumns[c].foreign_key || myDefaultColumns[c].foreignKey,
          request_type: defaultValue.importTypes || myDefaultColumns[c].request_type || myDefaultColumns[c].requestType,
          requestor: this_id,
          requestor_name: `${this_person.name.first} ${this_person.name.last}`,
          defaultValue
        });
        if (existingRequest.status === 'use existing') {
          await applyExistingRequest(existingRequest, myDefaultColumns[c], c);
        }
      }
    };
    reactData.columnList.push(...myDefaultColumns);
    if (reactData.columnList.length > 1) {
      columnCommonName();
    }
  };

  function OKtoShow(this_item) {
    let response = true;
    if (this_item.rowTest.length > 0) {
      response = this_item.rowTest.every(thisTest => {
        let test;
        let display = true;
        if (isObject(thisTest)) {
          test = thisTest.test;
          display = (thisTest.type === 'display');
        }
        else {
          test = thisTest;
          display = true;
        };
        let [checkField, checkValue, qualSelected] = test.split('%%');
        let checkRow = reactData.columnList[selectedColumn].rowDetails.find(row => {
          return (row.text === checkField);
        });
        if (checkValue === 'true') {
          checkValue = true;
        }
        else if (checkValue === 'false') {
          checkValue = false;
        }
        let innerResponse;
        if (checkRow) {
          if (checkRow.checkbox || checkRow.isChecked) {    // checkbox 
            if (!checkValue) {
              innerResponse = checkRow.isChecked;
            }
            else if (!checkRow.isChecked || !qualSelected || !checkRow.qualSelections) {
              innerResponse = false;
            }
            else {
              innerResponse = (checkRow.qualSelections.hasOwnProperty(checkValue) && checkRow.qualSelections[checkValue][qualSelected]);
            }
          }
          else if (!checkValue) {    // not a checkbox... if we don't care if there is a vlue type in or not? 
            innerResponse = !!checkRow.textValue;
          }
          else {  // if we do care...
            innerResponse = checkRow.textValue.toLowerCase().includes(checkValue.toLowerCase());
          }
        }
        else if (reactData.columnList[selectedColumn].defaultValues.hasOwnProperty(checkField)) {
          // no row matched this test field; perhaps a default value does?          
          innerResponse = (reactData.columnList[selectedColumn].defaultValues[checkField] === checkValue);
        }
        else if (defaultValue.hasOwnProperty(checkField)) {
          // maybe a global default?          
          innerResponse = (defaultValue[checkField] === checkValue);
        }
        if (display) {
          return innerResponse;
        }
        else {
          return !innerResponse;
        }
      });
    }
    return response;
  }

  const oneMinute = 1000 * 60;
  const msBeforeSleeping = 1 * oneMinute;

  function onAction() {
    let now = new Date();
    if ((reactData.idleState) || ((now.getTime() - reactData.lastActiveTime.getTime()) > oneMinute)) {
      cl(`Action/Update at ${now.toLocaleString()}.  Last active at ${reactData.lastActiveTime.toLocaleString()}`);
      updateReactData({
        lastActiveTime: now,
        idleState: false,
      }, false);
    }
    reset();
  };

  const onIdle = async () => {
    let now = new Date();
    let minutesSinceActive = 0;
    let reactUpdObj = {
      idleState: true,
      enteredIdleStateTime: now,
    };
    if (!reactData.idleState) {
      // we weren't previously in an idle state and we are now...
      cl(`Entered idle state in MutliObservationFormD at ${new Date().toLocaleString()}.`);
      updateReactData(reactUpdObj, true);
    }
    else {
      minutesSinceActive = Math.floor((now.getTime() - reactData.lastActiveTime.getTime()) / oneMinute);
      cl(`Still idle in MutliObservationFormD at ${new Date().toLocaleString()} (${minutesSinceActive} minutes).`);
    }
    if (minutesSinceActive > 5) {
      dbClient
        .put({
          TableName: 'ActivityLog',
          Item: {
            timestamp: new Date().getTime(),
            user_id: state.session.patient_id || 'error-no_patient_id',
            activity_code: `Auto-close, no request sent - idle time was ${minutesSinceActive} minutes`,
            activity_name: `MultiObservationFormD`,
            cookieValues: 'n/a',
            errorInfo: null,
            AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
          }
        })
        .promise()
        .catch(putError => {
          console.log(`Bad put to ActivityLog - caught error is: ${putError}`);
        });
      onClose();
    }
    else if (minutesSinceActive >= 3) {
      dbClient
        .put({
          TableName: 'ActivityLog',
          Item: {
            timestamp: new Date().getTime(),
            user_id: state.session.patient_id || 'error-no_patient_id',
            activity_code: `Idle warning "...over ${minutesSinceActive} minutes"`,
            activity_name: `MultiObservationFormD`,
            cookieValues: 'n/a',
            errorInfo: null,
            AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
          }
        })
        .promise()
        .catch(putError => {
          console.log(`Bad put to ActivityLog - caught error is: ${putError}`);
        });
      let alertMessage = <div>We haven't heard from you in over {minutesSinceActive} minutes.<br />
        We'll automatically exit and close in {5 - minutesSinceActive} minutes.<br />
        (Your request will not be sent.)<br />
        To keep working on this, move the screen or tap somewhere.</div>;
      if (minutesSinceActive > 4) {
        play();
        alertMessage = <div>We will close this request in 1 minute<br />
          if the screen remains idle.<br />
          (Your request <strong>will not</strong> be sent.)<br />
          To keep working on this, move the screen or tap somewhere.</div>;
      }
      updateReactData({
        alert: {
          severity: (minutesSinceActive > 4 ? 'warning' : 'info'),
          title: (minutesSinceActive > 4 ? 'Exiting very soon' : `Are you there?`),
          message: alertMessage,
          autoHide: 75000
        }
      }, true);
    }
    reset();
  };

  const { start, reset } = useIdleTimer({
    onIdle,
    onAction,
    timeout: msBeforeSleeping,
    throttle: 500
  });

  async function applyExistingRequest(existingRequest, this_column, this_column_index) {
    this_column.request_to_update = existingRequest.requestToUse;
    this_column.columnActivated = true;
    if (!existingRequest.requestToUse.hasOwnProperty('current_request')) {
      existingRequest.requestToUse.current_request = deepCopy(existingRequest.requestToUse.original_request);
    }
    for (let sX = 0; sX < existingRequest.requestToUse.current_request.selections.length; sX++) {
      let s = existingRequest.requestToUse.current_request.selections[sX];
      let selection = s.split('(').shift().trim();
      let rowNumber = this_column.rowDetails.findIndex(r => {
        return (r.text === selection);
      });
      if (rowNumber > -1) {
        this_column.rowDetails[rowNumber].isChecked = true;
        this_column.rowDetails[rowNumber].isExpanded = true;
        this_column.rowDetails[rowNumber].version = new Date().getTime();
        if (this_column.rowDetails[rowNumber].observationKey && !this_column.rowDetails[rowNumber].qualData) {
          let qualResponse = await buildQualifiers(this_column.rowDetails[rowNumber].observationKey);
          if (Object.keys(qualResponse.selections).length > 0) {
            this_column.rowDetails[rowNumber].qualSelections = deepCopy(qualResponse.selections);
          }
          if (Object.keys(qualResponse.data).length > 0) {
            this_column.rowDetails[rowNumber].qualData = deepCopy(qualResponse.data);
          }
          if (Object.keys(qualResponse.moreInfo).length > 0) {
            this_column.rowDetails[rowNumber].moreInfo = deepCopy(qualResponse.moreInfo);
          }
        }
        if ((existingRequest.requestToUse.current_request.hasOwnProperty('options'))
          && (existingRequest.requestToUse.current_request.options.hasOwnProperty(selection))) {
          if (!this_column.rowDetails[rowNumber].qualData) {
            // [this_column.rowDetails[rowNumber].defaultSelections, this_column.rowDetails[rowNumber].qualData] = await buildQualifiers(this_column.rowDetails[rowNumber].observationKey);
            let qualResponse = await buildQualifiers(this_column.rowDetails[rowNumber].observationKey);
            this_column.rowDetails[rowNumber].defaultSelections = deepCopy(qualResponse.selections);
            this_column.rowDetails[rowNumber].qualData = deepCopy(qualResponse.data);
            this_column.rowDetails[rowNumber].moreInfo = deepCopy(qualResponse.moreInfo);
          }
          this_column.rowDetails[rowNumber].qualSelections = deepCopy(existingRequest.requestToUse.current_request.options[selection]);
        }
        if ((existingRequest.requestToUse?.current_request.hasOwnProperty('textInput'))
          && (existingRequest.requestToUse?.current_request?.options?.hasOwnProperty(selection))) {
          this_column.rowDetails[rowNumber].textValue = deepCopy(existingRequest.requestToUse.current_request.textInput[selection]);
        }
        if ((this_column.rowDetails[rowNumber].input === 'signature')
          && (existingRequest.requestToUse.current_request.hasOwnProperty('images') || existingRequest.requestToUse?.current_request.hasOwnProperty('image_location'))) {
          if (existingRequest.requestToUse.current_request.image_location?.[this_column.rowDetails[rowNumber].text]) {

            updateReactData({
              storedSignature: existingRequest.requestToUse?.current_request.image_location[this_column.rowDetails[rowNumber].text]
            }, false);
          }
          else {
            updateReactData({
              storedSignature: existingRequest.requestToUse?.current_request.images[this_column.rowDetails[rowNumber].text]
            }, false);
          }
        }
      }
    };
    if (existingRequest.requestToUse.current_request.hasOwnProperty('textInput')) {
      for (let selection in existingRequest.requestToUse.current_request.textInput) {
        let rowNumber = this_column.rowDetails.findIndex(r => {
          return (r.text === selection);
        });
        if (rowNumber < 0) {
          continue;
        };
        this_column.rowDetails[rowNumber].textValue = deepCopy(existingRequest.requestToUse.current_request.textInput[selection]);
      }
    }
    if (existingRequest.requestToUse.current_request.hasOwnProperty('qualifiers')) {
      /*
         current_request.qualifiers come in as qualifiers.[<Menu choice>][<Qualifier Option>][<array of selections>]
         example 
           [Coffee][How do you like your coffee?][cream, sugar]
        
         and are stored in qualSelections as [<Menu choice>][<Person>][<Qualifier Option>][pSelection]
         example 
           [Coffee][rsteele][How do you like your coffee?][cream] = true
           [Coffee][rsteele][How do you like your coffee?][sugar] = true
      */
      for (let selection in existingRequest.requestToUse.current_request.qualifiers) {
        let rowNumber = this_column.rowDetails.findIndex(r => {
          return (r.qualData && r.qualData.qualSelections && r.qualData.qualSelections.hasOwnProperty(selection));
        });
        if (rowNumber < 0) {
          continue;
        };
        for (let option in existingRequest.requestToUse.current_request.qualifiers[selection]) {
          if (!this_column.rowDetails.qualData.qualSelections[selection].hasOwnProperty(option)) {
            this_column.rowDetails.qualData.qualSelections[selection][option] = {};
          }
          if (Array.isArray(existingRequest.requestToUse.current_request.qualifiers[selection][option])) {
            existingRequest.requestToUse.current_request.qualifiers[selection][option].forEach(choice => {
              this_column.rowDetails.qualData.qualSelections[selection][option][choice] = true;
            });
          }
        }
      }
    }
  };

  async function checkExistingRequests(request_key) {
    // Does this person already have a request for this requestype and foreignkey?
    if (!request_key.foreign_key || (request_key.foreign_key === 'noFKey')) {
      return {
        'status': 'make new'
      };
    }
    let existingRequest = await getServiceRequests(request_key);
    if (existingRequest.length > 0) {
      if (request_key.defaultValue.useExisting) {
        return {
          'status': 'use existing',
          'requestToUse': existingRequest[0]
        };
      }
      else {
        let requestAction = await orderWarning(request_key);
        let rTime = makeDate(new Date().getTime());
        switch (requestAction) {
          case 'use': {
            let lastRec = records2Update.push(existingRequest[0]) - 1;
            records2Update[lastRec].history.unshift(`Imported by ${state.session.user_id} on ${rTime.oaDate}`);
            records2Update[lastRec].last_update = rTime.timestamp;
            setRecords2Update(records2Update);
            return {
              'status': 'use existing',
              'requestToUse': existingRequest[0]
            };
          }
          case 'delete': {
            let lastRec = records2Update.push(existingRequest[0]) - 1;
            records2Update[lastRec].history.unshift(`Replaced on ${rTime.oaDate}`);
            records2Update[lastRec].last_update = rTime.timestamp;
            setRecords2Update(records2Update);
            break;
          }
          default: { }
        }
      }
    }
    return {
      'status': 'make new'
    };

    async function orderWarning(pKey) {
      const showWarning = new Promise((resolve, reject) => {
        let response = '';
        const snackAction = (
          <React-Fragment>
            <Button className={AVAClass.AVAButton}
              style={{ backgroundColor: 'green', color: 'white' }}
              size='small'
              onClick={() => { response = 'use'; resolve(response); }}
            >
              Use the existing one
            </Button>
            <Button className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={() => { response = 'delete'; resolve(response); }}
            >
              Delete the current one and replace it with a this one
            </Button>
            <Button className={AVAClass.AVAButton}
              style={{ backgroundColor: 'blue', color: 'white' }}
              size='small'
              onClick={() => { response = 'keep'; resolve(response); }}
            >
              Keep this one and create another one, too
            </Button>
          </React-Fragment>
        );
        let phrase = `${state.session.service_request_types[pKey.request_type]?.description || 'This'} already exists for ${pKey.requestor_name}`;
        if (pKey.foreign_key) {
          let fKdate = makeDate(pKey.foreign_key);
          if (!fKdate.error) {
            phrase += ` dated for ${fKdate.relative}`;
          }
        }
        updateReactData({
          alert: {
            severity: 'warning',
            title: 'Request exists',
            message: `${phrase}.  What would you like to do?`,
            persist: true,
            action: snackAction
          }
        }, true);
      });
      let rValue = await showWarning;
      return rValue;
    }
  };

  async function sendRequests(pData) {
    let everyoneText = {};
    if (pData.textValue && pData.textValue.hasOwnProperty('*all*')) {
      Object.keys(pData.textValue['*all*']).forEach(prompt => {
        everyoneText[prompt] = pData.textValue['*all*'][prompt];
      });
    }
    let writtenRecords = [];
    let local_key = null;
    let message_body;

    for (let columnNumber = 0; columnNumber < pData.length; columnNumber++) {
      let currentTime = makeDate(new Date());
      let selections = [];
      let options = {};
      let textInput = {};
      let images = {};
      let image_location = {};
      let oBo;
      let this_column = pData[columnNumber];
      if (this_column.columnActivated) {
        if (this_column.person_id) {
          oBo = await makeName(this_column.person_id);
        }
        else {
          oBo = await makeName(reactData.defaultPerson ? reactData.defaultPerson.person_id : state.patient.person_id);
        }
        for (let rowNumber = 0; rowNumber < this_column.rowDetails.length; rowNumber++) {
          let this_row = this_column.rowDetails[rowNumber];
          if (this_row.isChecked && !this_row.input) {
            let choices_list = [];
            for (let this_option in this_row.qualSelections) {
              for (let this_choice in this_row.qualSelections[this_option]) {
                if (!options.hasOwnProperty(this_row.text)) {
                  options[this_row.text] = {};
                }
                if (!options[this_row.text].hasOwnProperty(this_option)) {
                  options[this_row.text][this_option] = {};
                }
                options[this_row.text][this_option][this_choice] = this_row.qualSelections[this_option][this_choice];
                if (typeof (this_row.qualSelections[this_option][this_choice]) === 'boolean') {
                  if (this_row.qualSelections[this_option][this_choice]) {
                    choices_list.push(this_choice);
                  }
                }
                else {
                  choices_list.push(this_row.qualSelections[this_option][this_choice]);
                }
              }
            }
            let pushText = this_row.text;
            if (choices_list.length > 0) {
              pushText += ` (${choices_list.join('; ')})`;
            }
            selections.push(pushText);
          }
          if (this_row.textValue) {
            // special Values/
            if ((this_row.obo_line) || (this_column.defaultValues.hasOwnProperty('onBehalfOf') && (this_column.defaultValues['onBehalfOf'] === this_row.text))
              || (this_row.input === 'obo')) {
              oBo = this_row.textValue;
              textInput[this_row.text] = `Changed to ${this_row.textValue}`;
            }
            else {
              textInput[this_row.text] = this_row.textValue;
            }
          }
        }
        if ((selections.length > 0) || (Object.keys(textInput).length > 0)) {
          // We are ready to save this service request
          let svc_messaging = null;
          if (!fact.new_messaging && fact.messaging) {
            if ((Array.isArray(fact.messaging) && (fact.messaging.every(m => { return (m.format && (m.format.type !== 'mealTicket')); })))
              || (!Array.isArray(fact.messaging) && (fact.messaging.format && (fact.messaging.format.type !== 'mealTicket')))) {
              svc_messaging = fact.messaging;
              local_key = null;
            }
          }
          let putSR = {};
          if (this_column.request_to_update) {
            putSR = deepCopy(this_column.request_to_update);
          }
          Object.assign(putSR, {
            client: state.session.client_id,
            author: this_column.person_id || state.session.patient_id,
            proxy_user: state.session.user_id,
            requestType: this_column.requestType,
            activity_key: this_column.activity_key,
            request: {},
            onBehalfOf: oBo,
            messaging: svc_messaging
          });
          if (local_key) {
            putSR.local_key = local_key;
          }
          if (this_column.request_to_update) {
            if (putSR.history.length === 0) {
              putSR.history = [];
            };
            putSR.history.unshift(`Request updated ${currentTime.oaDate}`);
            // putSR.original_request = {
            putSR.current_request = {
              selections,
              options,
              textInput,
              image_location,
              images
            };
            await updateServiceRequest(putSR);
            writtenRecords.push(putSR);
          }
          else {
            putSR.history = [`Request submitted ${currentTime.oaDate}`];
            putSR.request = {
              selections,
              options,
              textInput,
              image_location,
              images
            };
            putSR.foreign_key = await resolveMessageVariables(this_column.foreignKey, textInput);
            if (fact?.value?.freeText?.assign_to) {
              // if there is an assign_to value, we'll assigne this SR to that ID
              putSR.assign_to = fact?.value?.freeText?.assign_to;
              let this_name = await getPerson(fact?.value?.freeText?.assign_to, 'name');
              putSR.history.unshift(`Auto-Assigned to ${this_name}`);
              if (validRequestStatus(this_column.requestType, 'assigned', state.session)) {
                putSR.requestStatus = 'assigned';
              }
            }
            else {
              putSR.assign_to = 'unassigned';
            }
            if (reactData.attachmentList && (reactData.attachmentList.length > 0)) {
              putSR.attachments = reactData.attachmentList;
              if (defaultValue.requestType === 'file') {
              }
            }
            let result = await putServiceRequest(putSR);
            local_key = result.requestRec.local_key;
            message_body = result.body;
            writtenRecords.push(result.requestRec);
            if (result.message) {
              updateReactData({
                alert: {
                  severity: 'warning',
                  title: 'Results',
                  message: result.message,
                  autoHide: 300000
                }
              }, true);
            }
          }
        }
      }
    };
    // meal tickets print here combining all completed requests...
    let formatCallObj = {
      local_key,
      client_id: pClient,
      client_name: state.session.client_name
    };
    if (fact.messaging && (fact.messaging?.format?.method !== 'hold')) {
      let factMessagingList = [];
      if (Array.isArray(fact.messaging)) {
        factMessagingList.push(...fact.messaging);
      }
      else {
        factMessagingList.push(fact.messaging);
      }
      for (let m = 0; m < factMessagingList.length; m++) {
        if (!factMessagingList[m].format.hasOwnProperty('logo') || factMessagingList[m].format.logo) {
          formatCallObj.logo = state.session.client_logo;
          formatCallObj.logo_dimensions = state.session.logo_dimensions;
        }
        if (!factMessagingList[m].format.hasOwnProperty('initials') || factMessagingList[m].format.initials) {
          formatCallObj.initials = true;
        }
        let html, plain, attachment;
        switch (factMessagingList[m].format.type) {
          case 'mealTicket':
            {
              [html, plain, attachment] = await mealTicketFormat(formatCallObj);
              break;
            }
          default: { }
        }
        if (html) {  // if there is a message to send, send it and update all the Service Request records to show that it was sent
          // prepare message that contains the tickets (one for the whole group)
          message_body.messaging = deepCopy(factMessagingList[m]);
          message_body.messaging.format = { 'type': 'inBody', 'subject': 'Meal Ticket' };
          message_body.htmlText = html;
          message_body.messageText = plain;
          let preparedMessages = await prepareMessage(message_body);
          // send the message
          if (preparedMessages.length > 0) {
            preparedMessages.forEach((m, x) => {
              preparedMessages[x].thread_id = `svc_${message_body.requestType}/${local_key}`;
              if (attachment) {
                preparedMessages[x].attachments = [attachment.Location];
                if (message_body.messaging.hasOwnProperty('attachment_method')
                  && (message_body.messaging.attachment_method === 'file')) {
                  if (attachment.data) {
                    preparedMessages[x].attachment_data = {
                      filename: `MealTicket-${local_key}.pdf`,
                      content: attachment.data,
                      type: 'application/pdf',
                      disposition: 'attachment',
                      content_id: local_key
                    };
                  }
                }
              }
            });
            let rTime = makeDate(new Date().getTime());
            let rMsg;
            let last_status;
            if (message_body.messaging?.format?.method === 'hold') {
              last_status = 'Prepared & Held';
              rMsg = `Held for future processing ${rTime.oaDate}`;
            }
            else {
              let sendResults = (await sendMessages(preparedMessages)).pop();
              if (!sendResults.sent) {
                last_status = 'Failed to send';
                rMsg = `Failed to send ${rTime.oaDate}`;
              }
              else {
                if (validRequestStatus(message_body.requestType, 'sent', state.session)) {
                  last_status = 'Sent';
                }
                rMsg = `Sent for processing ${rTime.oaDate}`;
              }
            }
            writtenRecords.forEach(w => {
              w.messages = preparedMessages;
              w.last_update = rTime.timestamp;
              w.last_status = last_status;
              if (('history' in w) && Array.isArray(w.history)) {
                w.history.unshift(rMsg);
              }
              else { w.history = [rMsg]; }
            });
            await updateServiceRequest(writtenRecords);
          }
        }  // end of "is there a message to send?"
        // if (records2Update.length > 0) { await updateServiceRequest(records2Update); }
      }
    }
  }

  function makeConfirm(pData) {  // assumes you've passed in a columnList
    let warningsExist = false;
    let dataExists = false;
    let confirmStatus = 'confirm';
    let warningSection = [];
    let responseArray = [`[bold][italic]AVA will send the following:`];
    pData.forEach((this_column, column_number) => {
      /*
      pData[
        {
          rowDetails[{
              text: <string>  (the actual selection text, such as "Chopped Steak" or "Pancake Platter")
              isChecked: <boolean>,
              qualSelections: {
                option: {
                  choice: <boolean> or <string>
                }
              },
              textValue: <string>
            }, ...
          ],
          xxxxxx: ...
        },
        {},...
      ]
      */
      let selectionText = [];
      let columnName = columnUniqueName(this_column).string;
      if (!this_column.columnActivated) {
        warningSection.push(`[color:red][bold]Nothing was entered${columnName ? (' for ' + columnName) : ''}.`);
        warningsExist = true;
      }
      else {
        /*  Check for errors */
        this_column.rowDetails.forEach((this_row, row_number) => {
          reactData.columnList[column_number].rowDetails[row_number].error = false;
          if (this_row.isChecked && this_row.qualData) {
            this_row.qualData.forEach(this_qual => {
              if (this_qual.min_required > 0) {
                let qualCount = 0;
                if (this_row.qualSelections && this_row.qualSelections.hasOwnProperty(this_qual.title)) {
                  qualCount = (Object.values(this_row.qualSelections[this_qual.title]).filter(this_value => {
                    return this_value;
                  })).length;
                }
                if (qualCount < this_qual.min_required) {
                  confirmStatus = 'error';
                  warningsExist = true;
                  let warningMessage;
                  if (this_qual.max_allowed === this_qual.min_required) {
                    warningMessage = `You must select ${this_qual.min_required} from ${this_row.text} (${this_qual.title})`;
                  }
                  else {
                    warningMessage = `You must select at least ${this_qual.min_required} from ${this_row.text} (${this_qual.title})`;
                  }
                  warningSection.push(`[color:red][bold]${warningMessage}`);
                  reactData.columnList[column_number].rowDetails[row_number].error = warningMessage;
                }
              }
            });
            updateReactData({
              columnList: reactData.columnList
            }, false);
          }
          else if (this_row.required && !this_row.textValue && !this_row.isChecked) {
            confirmStatus = 'error';
            let warningMessage;
            if (pData.length > 1) {
              warningMessage = `${columnName} is missing "${this_row.text}"`;
            }
            else {
              warningMessage = `"${this_row.text}" is required`;
            }
            warningsExist = true;
            warningSection.push(`[color:red][bold]${warningMessage}`);
            reactData.columnList[column_number].rowDetails[row_number].error = 'This field is required';
            updateReactData({
              columnList: reactData.columnList
            }, false);
          }
          else if (this_row.error) {
            confirmStatus = 'error';
            if (pData.length > 1) {
              warningSection.push(`[color:red][bold]${columnName} has an error on "${this_row.text}".  The error is: ${this_row.error}.`);
            }
            else {
              warningSection.push(`[color:red][bold]Error on "${this_row.text}".  The error is: ${this_row.error}.`);
            }
            warningsExist = true;
          }
        });
        let options = {};
        if (reactData.collectPayment) {
          options.includeFees = true;
        }
        for (const [this_selection, optionList] of Object.entries(formatServiceRequestDetails(this_column, options))) {
          selectionText.push(`[style={size:1}]${sentenceCase(this_selection)}`);
          optionList.forEach(option => {
            selectionText.push(`[indent=1][italic][style={size:0.4}]${option}`);
          });
        };
        // that's all the rows for this column
        if (selectionText.length === 0) {
          if (pData.length > 1) {
            warningSection.push(`[color:red][bold]${columnName} has no entries at all`);
          }
          else {
            warningSection.push(`[color:red][bold]No entries were made`);
          }
          warningsExist = true;
        }
        else {
          if (confirmStatus !== 'error') {
            if (columnName) {
              responseArray.push(`[bold]${columnName}`);
            };
            responseArray.push(...selectionText);
            responseArray.push('[style = { bottom: 3 }] ');
            dataExists = true;
          }
        }
      }
    });
    let returnArray = [`Your request has not been sent yet!`, `[bold]${reactData.factName}`];
    if (reactData.commonText) {
      returnArray = [titleCase(reactData.commonText)];
    }
    if (warningsExist) {
      returnArray.push(...warningSection);
    }
    if (dataExists) {
      if (warningsExist) {
        returnArray.push(' ');
      }
      returnArray.push(...responseArray);
    }
    let activity_info = `${reactData.factName} confirmation screen shown`;
    dbClient
      .put({
        TableName: 'ActivityLog',
        Item: {
          timestamp: new Date().getTime(),
          user_id: state.session.patient_id || 'error-no_patient_id',
          activity_code: activity_info,
          activity_name: `MultiObservationFormD`,
          cookieValues: 'n/a',
          errorInfo: returnArray,
          AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
        }
      })
      .promise()
      .catch(putError => {
        console.log(`Bad put to ActivityLog - caught error is: ${putError}`);
      });
    return [confirmStatus, returnArray];
  };

  return (
    <Dialog
      open={(true || forceRedisplay) && reactData.initialLoadComplete}
      p={2}
      fullScreen
    >
      { /* MAIN */}

      {(reactData.columnList && reactData.columnList.length > 0)
        &&
        <React.Fragment>
          {/* Header with Avatar, Message, and VertMenu */}
          <Box
            display='flex' flexDirection='row'
            className={classes.messageArea}
            style={AVATextStyle({
              margin: {
                top: 1,
                right: 0.5,
                left: 0.5
              },
              size: 1.3,
              bold: true,
              overflow: 'visible'
            })}
            key={'topBox'}
            borderBottom={(reactData.columnList.length <= 1) ? 2 : 0}
          >
            <Box
              display='flex'
              flexDirection='column'
              overflow='visible'
              key={'titlesection'}
            >
              <Typography
                style={AVATextStyle({
                  margin: {
                    top: 1,
                    right: 1,
                    left: 1,
                    bottom: 0
                  },
                  size: ((reactData.titleName.display) ? 1 : 1.3),
                  bold: true
                })}
              >
                {`${titleCase(reactData.commonText) || factName}`}
              </Typography>
              {reactData.titleName.display &&
                <Typography
                  style={AVATextStyle({
                    margin: {
                      top: 0,
                      right: 1,
                      left: 1,
                      bottom: 0
                    },
                    size: 1.3,
                    bold: true
                  })}
                >
                  {`for ${reactData.titleName.display}`}
                </Typography>
              }
            </Box>
            <Box
              paddingRight={2}
              marginTop={1}
              aria-controls='hidden-menu'
              aria-haspopup='true'
              onClick={(event) => {
                handleClick(event);
                setPopupMenuOpen(true);
              }}>
              <Avatar src={process.env.REACT_APP_AVA_LOGO} />
            </Box>
            <Menu
              id='hidden-menu'
              anchorEl={anchorEl}
              open={popupMenuOpen}
              onClose={() => { setPopupMenuOpen(false); }}
              keepMounted>
              <MenuList
                style={AVATextStyle({
                  margin: { right: 1.5 },
                  padding: { right: 1 }
                })}
              >
                <MenuItem
                  onClick={() => {
                    onClose();
                  }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowHome'}
                  >
                    <HomeIcon />
                    <Typography
                      style={AVATextStyle({
                        margin: { left: 0.5 },
                        size: 0.5
                      })}
                    >
                      {'Go to AVA Menu'}
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    let jumpTo = window.location.origin;
                    window.location.replace(jumpTo);
                  }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowRefresh'}
                  >
                    <AutorenewIcon />
                    <Typography
                      style={AVATextStyle({
                        margin: { left: 0.5 },
                        size: 0.5
                      })}
                    >
                      {'Restart AVA'}
                    </Typography>
                  </Box>
                </MenuItem>
                <MenuItem>
                  <Box
                    display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                    key={'vRowRefresh'}
                  >
                    <Typography style={AVATextStyle({ size: 0.5 })} >{`AVA vers ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                    <Typography style={AVATextStyle({ size: 0.5 })} >{`User ${fact.session.user_id}${fact.patient_id !== fact.session.user_id ? (' (' + fact.patient_id + ')') : ''}`}</Typography>
                    <Typography style={AVATextStyle({ size: 0.5 })} >{`Function: ObservationForm`}</Typography>
                    <Typography style={AVATextStyle({ size: 0.5 })} >{`Activity: ${fact.activity_key}`}</Typography>
                  </Box>
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>

          { /* Selection Row */}
          {(reactData.columnList.length > 1) &&
            <Box display='flex'
              flexDirection='row'
              marginRight={0}
              marginLeft={0}
              marginTop={0}
              marginBottom={0}
              borderBottom={2}
              paddingTop={(reactData.columnList.length > 5) ? ((reactData.titleName.remembered.length > 1) ? '150px' : '100px') : 1}
              overflow={(reactData.columnList.length > 5) ? 'scroll' : null}
              key={'peopleSelectionBox'}
              id={'peopleSelectionBox'}
              className={classes.listItemSticky}
            >
              <Box
                display='flex'
                flexDirection='row'
                key={'person'}
                className={classes.listItem}
                mb={0.5}
                mt={0.5}
                justifyContent='space-between'
                alignItems='flex-end'
              >
                <Box
                  display='flex'
                  flexDirection='row'
                  key={'rowP'}
                  className={classes.listItem}
                  justifyContent='flex-end'
                  alignItems='flex-end'
                >
                  <Box
                    display='flex'
                    flexDirection='column'
                    minWidth={50}
                    maxWidth={50}
                    marginBottom={'10px'}
                    key={`radiobox-rowP-colSelect`}
                    className={classes.listItem}
                    justifyContent='flex-end'
                    alignItems='center'
                  >
                    {(reactData.titleName.remembered.length === 1) &&
                      <Box
                        component="img"
                        mt={0}
                        mb={1}
                        border={1}
                        minWidth={50}
                        maxWidth={50}
                        minHeight={50}
                        maxHeight={50}
                        alt=''
                        src={getImage(reactData.columnList[0].person_id)}
                      />
                    }
                    <Typography key={`selectWord`} className={classes.smallTextLine}>{'Select'}</Typography>
                  </Box>
                  {reactData.columnList.map((this_column, this_columnNumber) => (
                    <Box
                      display='flex'
                      flexDirection='column'
                      minWidth={50}
                      maxWidth={50}
                      key={`radiobox-rowP-col${this_columnNumber}`}
                      className={classes.listItem}
                      justifyContent='space-between'
                      alignItems='center'
                    >
                      {(reactData.titleName.remembered.length > 1) &&
                        <Box
                          component="img"
                          mt={0}
                          mb={1}
                          border={1}
                          minWidth={50}
                          maxWidth={50}
                          minHeight={50}
                          maxHeight={50}
                          alt=''
                          src={getImage(this_column.person_id)}
                        />
                      }
                      {columnUniqueName(this_column).array.slice(-1 * Math.min(reactData.maxDName, 7)).map((n, nx) => (
                        <Typography key={`name-${nx}-${this_columnNumber}`} className={classes.smallTextLine}>{n.slice(0, 10)}</Typography>
                      ))}
                      <Radio
                        key={`radio-rowP-col${this_columnNumber}`}
                        checked={(selectedColumn === this_columnNumber)}
                        value={(selectedColumn === this_columnNumber)}
                        onClick={() => {
                          setSelectedColumn(this_columnNumber);
                          setForceRedisplay(!forceRedisplay);
                        }}
                        disableRipple
                        className={classes.radioButton}
                        size='small'
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          }

          { /* Data rows */}
          <Paper component={Box} className={classes.page} overflow='auto' square>
            <Box
              key={`thewholething`}
              id={`thewholething`}
              display="flex"
              flexDirection={reactData.columnList[selectedColumn].rowDetails.some(r => r.multiColumn) ? 'row' : 'column'}
              flexWrap={reactData.columnList[selectedColumn].rowDetails.some(r => r.multiColumn) ? 'wrap' : 'nowrap'}
              justifyContent="flex-start"
              alignItems='flex-start'
            >

              {(reactData.columnList.length > 0) &&
                (reactData.columnList[selectedColumn].rowDetails).map((this_item, this_index) => (
                  OKtoShow(this_item) &&
                  <Box display='flex'
                    flexDirection='row'
                    borderRadius={'16px'}
                    marginLeft={2}
                    marginRight={2}
                    maxWidth={(this_item.checkbox && !this_item.isChecked) ? 400 : 'auto'}
                    width={!this_item.checkbox ? '100%' : 'auto'}
                    marginTop={(this_item.header ? 0 : 2)}
                    marginBottom={(this_item.header ? 1 : 2)}
                    padding={(this_item.header ? 0 : 1)}
                    border={(!reactData.viewOnly && (!!this_item.error || this_item.isChecked || (this_item.textValue && (this_item.textValue !== ''))))
                      ? 4
                      : (this_item.checkbox ? 4 : 'none')
                    }
                    className={!!this_item.error ? classes.backGroundRed : (this_item.isChecked ? classes.backGroundGreen : classes.backGroundNone)}
                    borderColor={!!this_item.error ? 'red' : (this_item.isChecked ? 'green' : 'lightgray')}
                    key={`rowboxwrap_${selectedColumn}.${this_index}-${this_item.version}-${!!this_item.error ? 'err' : 'ok'}`}
                    id={`rowboxwrap_${selectedColumn}.${this_index}-${this_item.version}-${!!this_item.error ? 'err' : 'ok'}`}
                  >
                    { /* Descriptive text - headers and info that is text only */}
                    {!this_item.input && !this_item.checkbox &&
                      <Box
                        display='flex'
                        flexDirection='row'
                        key={`textoutbox_${selectedColumn}.${this_index}`}
                        id={`textoutbox_${selectedColumn}.${this_index}`}
                        className={classes.listItem}
                        justifyContent='flex-start'
                        alignItems='center'
                      >
                        <Typography
                          key={`textout_${selectedColumn}.${this_index}`}
                          id={`textout_${selectedColumn}.${this_index}`}
                          style={this_item.style
                            ? AVATextStyle(this_item.style)
                            : (this_item.header
                              ? AVATextStyle({ size: 1.2, bold: true, margin: { top: 2 } })
                              : AVATextStyle({ size: 1.3, margin: { right: 0.5 } }))
                          }
                        >
                          {this_item.bold
                            ? (this_item.italic ? <b><i>{this_item.text}</i></b> : <b>{this_item.text}</b>)
                            : (this_item.italic ? <i>{this_item.text}</i> : `${this_item.text}`)}
                        </Typography>
                      </Box>
                    }
                    { /* Text prompt line for this row - headers don't have this */}
                    {this_item.input && !reactData.viewOnly &&
                      <Card elevation={0} sx={{ maxWidth: 345 }} style={{ width: '100%', padding: '4px', paddingBottom: '6px' }}>
                        <TextField
                          style={Object.assign({
                            marginLeft: '8px',
                            paddingLeft: 0,
                            paddingRight: 0,
                            flexGrow: 2,
                            width: '95%',
                          },
                            (this_item.isChecked && !isEmpty(this_item.qualData) ? { marginTop: '12px' } : {}))
                          }
                          variant={'standard'}
                          key={`inputtextprompt_${selectedColumn}.${this_index}-${this_item.version}`}
                          id={`inputtextprompt_${selectedColumn}.${this_index}-${this_item.version}`}
                          helperText={(this_item.error ? (`${this_item.error} - `) : '') + this_item.text}
                          multiline
                          inputProps={{ style: AVATextStyle({ size: 1.2 }) }}
                          InputProps={{ style: AVATextStyle({ size: 1.2 }), }}
                          FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                          onBlur={(event) => {
                            if (!event.target.value) {
                              reactData.errorOnScreen = false;
                            }
                            handleChangeTextField(event.target.value, selectedColumn, this_index);
                          }}
                          autoComplete='off'
                          defaultValue={this_item.textValue || ''}
                        />
                        {(this_item.isChecked && !isEmpty(this_item.qualData)) &&
                          <Box
                            key={`cardinfowrap_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                            id={`cardinfowrap_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                            style={{ marginBottom: '12px' }}
                            display="flex"
                            flexDirection='column'
                            justifyContent="flex-start"
                            alignItems='flex-start'
                          >
                            {makeArray(this_item.qualData).map((qR, qRndx) => (
                              <Box
                                key={`qualboxwrap_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                id={`qualboxwrap_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                display="flex"
                                style={AVATextStyle({
                                  margin: { left: 1, right: 1 },
                                  padding: { left: 0, right: 3 }
                                })}
                                flexDirection='column'
                                justifyContent="center"
                              >
                                <Box display='flex' flexDirection='column' justifyContent='center'
                                  key={`qualbox_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                  id={`qualbox_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                  alignItems='flex-start'>
                                  <Typography
                                    key={`qualboxtitle_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                    id={`qualboxtitle_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                    style={AVATextStyle({
                                      margin: { top: 0.8, bottom: 0, left: 0 },
                                      padding: { left: 0, right: 3 },
                                      size: 1
                                    })}
                                  >
                                    {qR.title}
                                  </Typography>
                                  <Box display='flex' flexDirection='row' justifyContent='flex-start'
                                    key={`optionbox_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                    id={`optionbox_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                    alignItems='center' flexWrap='wrap'
                                  >
                                    {qR.option && qR.option.map((opt, oX) => (
                                      <Box display='flex' flexDirection='row' justifyContent='flex-start'
                                        key={`option_${selectedColumn}.${this_index}.${qRndx}.${oX}-${isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}`}
                                        id={`option_${selectedColumn}.${this_index}.${qRndx}.${oX}-${isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}`}
                                        alignItems='center'
                                      >
                                        <React.Fragment>
                                          <Checkbox
                                            key={`optioncheckbox_${selectedColumn}.${this_index}.${qRndx}.${oX}-${isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}`}
                                            id={`optioncheckbox_${selectedColumn}.${this_index}.${qRndx}.${oX}-${isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}`}
                                            className={classes.radioButton}
                                            size="small"
                                            onClick={() => {
                                              reactData.columnList[selectedColumn].rowDetails[this_index].error = '';
                                              reactData.columnList[selectedColumn].rowDetails[this_index].qualData = [];
                                              reactData.columnList[selectedColumn].rowDetails[this_index].qualSelections = {};
                                              reactData.columnList[selectedColumn].rowDetails[this_index].textValue = opt.dName;
                                              reactData.columnList[selectedColumn].rowDetails[this_index].version++;
                                              reactData.columnList[selectedColumn].person_id = opt.person_id;
                                              reactData.columnList[selectedColumn].display_name = opt.dName;
                                              reactData.columnList[selectedColumn].dName.splice(-3, 3, ...([' ', ' ', ' '].concat(opt.dName.split(/\s+/).splice(-3))));
                                              resetTitleName();
                                              reactData.columnList[selectedColumn].rowDetails.forEach((checkRow, r) => {
                                                if (checkRow.location_line) {
                                                  reactData.columnList[selectedColumn].rowDetails[r].textValue = opt.location;
                                                }
                                              });
                                              updateReactData({
                                                columnList: reactData.columnList
                                              }, true);
                                            }}
                                            checked={false}
                                          />
                                          <Typography
                                            key={`optionchecktext_${selectedColumn}.${this_index}.${qRndx}.${oX}-${isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}`}
                                            id={`optionchecktext_${selectedColumn}.${this_index}.${qRndx}.${oX}-${isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}`}
                                            style={AVATextStyle({ size: 0.75, margin: { top: 0.5, bottom: 0.5, left: 0.3, right: 3 } })}>
                                            {opt.display}
                                          </Typography>
                                        </React.Fragment>
                                      </Box>
                                    ))}
                                  </Box>
                                </Box>
                              </Box>
                            ))
                            }
                          </Box>
                        }
                      </Card>
                    }
                    {this_item.checkbox && !this_item.header &&
                      <Card elevation={0} sx={{ maxWidth: 345 }}>
                        <Box
                          key={`cardboxmaster_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                          id={`cardboxmaster_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                          display="flex"
                          flexDirection='column'
                          justifyContent="flex-start"
                          alignItems='flex-start'
                        >
                          <Box
                            key={`cardboxmasterrow_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                            id={`cardboxmasterrow_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                            display="flex"
                            flexDirection='column'
                            justifyContent="flex-start"
                            alignItems='flex-start'
                            onClick={async () => {
                              if (this_item.checkbox && !this_item.noUpdate) {
                                await itemSelected(selectedColumn, this_index);
                              }
                            }}
                          >
                            <Box key={`cardboxmasterrow_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                              id={`cardboxmasterrow_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                              display="flex"
                              flexDirection='row'
                              justifyContent="flex-start"
                              alignItems='center'
                            >
                              {!reactData.viewOnly && !this_item.noUpdate &&
                                <IconButton aria-label="select this item">
                                  {this_item.isChecked ? <CheckBoxIcon /> : <CheckBoxOutlineBlankIcon />}
                                </IconButton>
                              }
                              <Box
                                key={`cardboxmastercolumn_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                                id={`cardboxmastercolumn_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                                display="flex"
                                flexDirection='column'
                                justifyContent="flex-start"
                                alignItems='flex-start'
                              >
                                <Typography
                                  key={`textout_${selectedColumn}.${this_index}`}
                                  id={`textout_${selectedColumn}.${this_index}`}
                                  style={this_item.style
                                    ? AVATextStyle(this_item.style)
                                    : AVATextStyle({ size: 1.2, margin: { right: 2 } })
                                  }
                                >
                                  {this_item.text}
                                </Typography>
                                {this_item.moreInfo && this_item.moreInfo.fee &&
                                  <Typography
                                    key={`feetext_${selectedColumn}.${this_index}-${this_item.version}`}
                                    id={`feetext_${selectedColumn}.${this_index}-${this_item.version}`}
                                    style={AVATextStyle({ size: 1.2, margin: { right: 3 } })}
                                  >
                                    {new Intl.NumberFormat('en-US', {
                                      style: 'currency',
                                      currency: 'USD',
                                    }).format(this_item.moreInfo.fee)}
                                  </Typography>
                                }
                                {this_item.desc &&
                                  <Typography
                                    key={`descriptiontext_${selectedColumn}.${this_index}-${this_item.version}`}
                                    id={`descritpiontext_${selectedColumn}.${this_index}-${this_item.version}`}
                                    style={AVATextStyle({ size: 0.7, margin: { right: 3 } })}
                                  >
                                    {this_item.desc}
                                  </Typography>
                                }
                              </Box>
                            </Box>
                            {this_item.moreInfo && this_item.moreInfo.image &&
                              <Box
                                component="img"
                                minWidth={150}
                                maxWidth={300}
                                minHeight={150}
                                marginLeft={1.2}
                                marginRight={1}
                                marginBottom={2}
                                marginTop={1}
                                src={this_item.moreInfo.image}
                              />
                            }
                          </Box>
                          {(this_item.isChecked || this_item.isExpanded) &&
                            (!isEmpty(this_item.moreInfo) || !isEmpty(this_item.qualData)) &&
                            <Box
                              key={`cardinfowrap_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                              id={`cardinfowrap_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                              style={{ marginBottom: '12px' }}
                              display="flex"
                              flexDirection='column'
                              justifyContent="flex-start"
                              alignItems='flex-start'
                            >
                              {!isEmpty(this_item.moreInfo) &&
                                <Box
                                  key={`qualboxwrap_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                                  id={`qualboxwrap_${selectedColumn}.${this_index}.moreInfo-${this_item.version}`}
                                  display="flex"
                                  style={AVATextStyle({
                                    margin: { right: 1 },
                                    padding: { left: 0, right: 3 }
                                  })}
                                  flexDirection='column'
                                  justifyContent="center"
                                  alignItems='flex-start'
                                >
                                  {Object.keys(this_item.moreInfo).map((opt, oX) => (
                                    <React.Fragment
                                      key={`optionbox_${selectedColumn}.${this_index}.fragment-${this_item.version}-${oX}`}
                                    >
                                      {(opt !== 'image') && (opt !== 'fee') && (opt !== 'restriction') &&
                                        <Typography
                                          key={`optionchecktext_${selectedColumn}.${this_index}.moreInfo.${oX}-${this_item.version}`}
                                          id={`optionchecktext_${selectedColumn}.${this_index}.moreInfo.${oX}-${this_item.version}`}
                                          style={AVATextStyle({ size: 0.75, margin: { left: 1 } })}
                                        >
                                          {`${sentenceCase(opt.replace('_', ' '))}${this_item.moreInfo[opt].trim() ? (': ' + this_item.moreInfo[opt]) : ''}`}
                                        </Typography>
                                      }
                                      {(opt === 'restriction')
                                        && (
                                          state
                                            .accessList[state.session.client_id]
                                            .list
                                            .find(p => { return (p.person_id === reactData.columnList[selectedColumn].person_id); })
                                            .groups
                                            .includes(this_item.moreInfo[opt].trim())
                                        )
                                        &&
                                        <Box display='flex' flexDirection='row' justifyContent='flex-start'
                                          key={`option_${selectedColumn}.${this_index}.restriction.${oX}-${this_item.version}`}
                                          id={`option_${selectedColumn}.${this_index}.restriction.${oX}-${this_item.version}`}
                                          style={AVATextStyle({ size: 0.7, margin: { right: 3 } })}
                                          alignItems='center'
                                        >
                                          <Typography
                                            key={`optionchecktext_${selectedColumn}.${this_index}.restriction.${oX}-${this_item.version}`}
                                            id={`optionchecktext_${selectedColumn}.${this_index}.restriction.${oX}-${this_item.version}`}
                                            style={AVATextStyle({ color: 'red', style: 'bold', size: 1.2, margin: { left: 1 } })}
                                          >
                                            {`*** THIS ITEM IS NOT RECOMMENDED FOR ${reactData.columnList[selectedColumn].display_name.toUpperCase()} ***`}
                                          </Typography>
                                        </Box>
                                      }
                                    </React.Fragment>
                                  ))}
                                </Box>
                              }
                              {(!isEmpty(this_item.qualData))
                                && makeArray(this_item.qualData).map((qR, qRndx) => (
                                  <Box
                                    key={`qualboxwrap_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                    id={`qualboxwrap_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                    display="flex"
                                    style={AVATextStyle({
                                      margin: { left: 1, right: 1 },
                                      padding: { left: 0, right: 3 }
                                    })}
                                    flexDirection='column'
                                    justifyContent="center"
                                  >
                                    <Box display='flex' flexDirection='column' justifyContent='center'
                                      key={`qualbox_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                      id={`qualbox_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                      alignItems='flex-start'>
                                      <Typography
                                        key={`qualboxtitle_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                        id={`qualboxtitle_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                        style={AVATextStyle({
                                          margin: { top: 0.8, bottom: 0, left: 0 },
                                          padding: { left: 0, right: 3 },
                                          size: 1
                                        })}
                                      >
                                        {qR.title}
                                      </Typography>
                                      <Box display='flex' flexDirection='row' justifyContent='flex-start'
                                        key={`optionbox_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                        id={`optionbox_${selectedColumn}.${this_index}.${qRndx}-${this_item.version}`}
                                        alignItems='center' flexWrap='wrap'
                                      >
                                        {qR.option && qR.option.map((opt, oX) => (
                                          <Box display='flex' flexDirection='row' justifyContent='flex-start'
                                            key={`option_${selectedColumn}.${this_index}.${qRndx}.${oX}-${isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}`}
                                            id={`option_${selectedColumn}.${this_index}.${qRndx}.${oX}-${isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}`}
                                            alignItems='center'
                                          >
                                            {(!opt.type || (opt.type === 'checkbox')) &&
                                              <React.Fragment>
                                                {!reactData.viewOnly &&
                                                  <Checkbox
                                                    key={`optioncheckbox_${selectedColumn}.${this_index}.${qRndx}.${oX}-${isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}`}
                                                    id={`optioncheckbox_${selectedColumn}.${this_index}.${qRndx}.${oX}-${isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}`}
                                                    className={classes.radioButton}
                                                    size="small"
                                                    onClick={() => {
                                                      optSelected(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display);
                                                      reactData.columnList[selectedColumn].columnActivated = true;
                                                      updateReactData({
                                                        columnList: reactData.columnList
                                                      }, true);
                                                    }}
                                                    checked={isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}
                                                  />
                                                }
                                                <Typography
                                                  key={`optionchecktext_${selectedColumn}.${this_index}.${qRndx}.${oX}-${isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}`}
                                                  id={`optionchecktext_${selectedColumn}.${this_index}.${qRndx}.${oX}-${isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}`}
                                                  style={AVATextStyle({ size: 0.75, margin: { top: 0.5, bottom: 0.5, left: 0.3, right: 3 } })}>
                                                  {opt.display}
                                                </Typography>
                                              </React.Fragment>
                                            }
                                            {(opt.type === 'prompt' || opt.type === 'promptOnly') &&
                                              <React.Fragment>
                                                {!reactData.viewOnly && (opt.type === 'prompt') &&
                                                  <Checkbox
                                                    className={classes.radioButton}
                                                    key={`optionpromptcheck_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.version}`}
                                                    id={`optionpromptcheck_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.version}`}
                                                    size="small"
                                                    checked={isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}
                                                  />
                                                }
                                                <Typography style={AVATextStyle({ size: 0.75, margin: { top: 0.5, bottom: 0.5, left: 0.3, right: 0.1 } })}>
                                                  {opt.display}:
                                                </Typography>
                                                {!reactData.viewOnly &&
                                                  <TextField
                                                    key={`optionpromptchecktext_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.version}`}
                                                    id={`optionpromptchecktext_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.version}`}
                                                    style={AVATextStyle({ 'line-height': 1, size: 0.75, margin: { top: 0.5, bottom: 0.5, left: 0.3, right: 3 } })}
                                                    defaultValue={getQualTextValue(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}
                                                    variant={'standard'}
                                                    inputProps={{ style: { paddingBottom: 0, paddingTop: 0, fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                                                    FormHelperTextProps={{ style: { paddingBottom: 0, paddingTop: 0, fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                                                    onChange={(event) => {
                                                      optSelected(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display, event.target.value);
                                                      updateReactData({
                                                        columnList: reactData.columnList
                                                      }, true);
                                                    }}
                                                    autoComplete='off'
                                                  />
                                                }
                                              </React.Fragment>
                                            }
                                          </Box>
                                        ))}
                                      </Box>
                                    </Box>
                                  </Box>
                                ))
                              }
                            </Box>
                          }
                          {false && (this_item.moreInfo || this_item.qualData) &&
                            <CardActions disableSpacing>
                              <IconButton
                                aria-label="view qual"
                                onClick={async () => {
                                  reactData.columnList[selectedColumn].rowDetails[this_index].isExpanded = !reactData.columnList[selectedColumn].rowDetails[this_index].isExpanded;
                                  updateReactData({
                                    columnList: reactData.columnList
                                  }, true);
                                }
                                }
                              >
                                {this_item.isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton>
                            </CardActions>
                          }
                        </Box>
                      </Card>
                    }
                  </Box>
                ))
              }
              { /* File upload status */}
              {(reactData.attachmentList.length > 0) &&
                <Box display='flex' flexDirection='column' justifyContent='flex-start'
                  alignItems='flex-start' key={'qrOpt_attachmentlist'}
                  borderRadius={'16px'}
                  marginLeft={2}
                  marginRight={2}
                  maxWidth={'80%'}
                  width={'80%'}
                  marginTop={2}
                  marginBottom={2}
                  padding={1}
                  border={12}
                  borderColor={'green'}
                >
                  <Typography 
                    style={AVATextStyle({ size: 1.2, margin: { right: 0.5 } })}
                  >
                    {`File${(reactData.attachmentList.length > 1) ? 's' : ''}:`}
                  </Typography>
                  {reactData.attachmentList.map((this_attachment, x) => (
                    <Box display='flex' flexDirection='row' justifyContent='flex-start'
                      alignItems='center' key={`qrOpt_attachmentLine-${x}`} width={'100%'}
                    >
                      <Box display='flex' flexDirection='column' width={'100%'} justifyContent='center'
                        alignItems='flex-start' key={`qrOpt_attachmentBox-${x}`}
                      >
                        <Box display='flex' flexDirection='row' justifyContent='flex-start'
                          alignItems='center' key={`qrOpt_attachmentName-${x}`}
                        >
                          <DeleteIcon
                            className={classes.radioButton}
                            size="small"
                            onClick={() => {
                              reactData.attachmentList.splice(x, 1);
                              reactData.forceRedisplay = !reactData.forceRedisplay;
                              if (loadingInProgress(x)) {
                                reactData.loadProgress[x].loading = 'abort';
                              }
                              setReactData(reactData);
                              setForceRedisplay(forceRedisplay => !forceRedisplay);
                            }}
                          />
                          <Typography
                            style={AVATextStyle({
                              size: 0.6,
                              color: ((loadingInProgress(x)) ? 'gray' : 'black'),
                              margin: { left: 0.3, right: 1 }
                            })}
                          >
                            {`${cleanForDisplay(this_attachment.Key)}
                    ${loadingInProgress(x) ? ' - ' + ((Math.floor((reactData.loadProgress[x].progress) * 100) / 100).toString() + '%') : ''}
                    ${(loadingInProgress(x) && (this_attachment.Key.split('.').pop() === 'mov') && (reactData.loadProgress[x].progress > 95)) ? ` - Converting from MOV format, please wait...` : ''}`}
                          </Typography>
                          {!loadingInProgress(x) &&
                            <Box
                              component="img"
                              mb={2}
                              ml={2}
                              minWidth={50}
                              maxWidth={50}
                              alt=''
                              src={this_attachment.Location}
                            />}
                        </Box>
                        {loadingInProgress(x) &&
                          !((this_attachment.Key.split('.').pop() === 'mov') && (reactData.loadProgress[x].progress >= 99)) &&
                          <React.Fragment>
                            <LinearProgress
                              variant="determinate"
                              key={`qrOpt_progress-${x}`}
                              className={classes.progressBar}
                              style={{ width: '95%' }}
                              value={reactData.loadProgress[x].progress}
                            />
                          </React.Fragment>
                        }
                      </Box>
                    </Box>
                  ))}
                </Box>
              }
            </Box>
          </Paper>


        </React.Fragment>
      }

      { /* Prompt for People */}
      {((reactData.columnList && (reactData.columnList.length < 1)) || (morePeople))
        &&
        <PersonFilter
          prompt={'Select from this list'}
          peopleList={reactData.selectionList}
          onCancel={() => {
            if (reactData.columnList.length < 1) {
              onClose();
            }
            setMorePeople(false);
          }}
          onSelect={async (selectedID) => {
            let sIDs = makeArray(selectedID);
            reactData.columnList = [];
            if (sIDs.length > 0) {
              for (let p = 0; p < sIDs.length; p++) {             // for each person you selected
                await addColumns(sIDs[p]);
              }
              updateReactData({
                columnList: reactData.columnList,
                titleName: reactData.titleName
              }, true);
            }
            setMorePeople(false);
          }}
          allowRandom={false}
          multiSelect={(defaultValue.selectOne ? !defaultValue.selectOne : true)}
          returnValue={'id'}
        />
      }

      { /* Prompts */}
      {cancelPending
        &&
        <AVAConfirm
          promptText={`Are you sure you'd like to exit?`}
          cancelText={'No, go back'}
          confirmText={'Yes, exit'}
          onCancel={() => {
            setCancelPending(false);
          }}
          onConfirm={() => {
            dbClient
              .put({
                TableName: 'ActivityLog',
                Item: {
                  timestamp: new Date().getTime(),
                  user_id: state.session.patient_id || 'error-no_patient_id',
                  activity_code: `Exit requested and confirmed by user`,
                  activity_name: `MultiObservationFormD`,
                  cookieValues: 'n/a',
                  errorInfo: null,
                  AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
                }
              })
              .promise()
              .catch(putError => {
                console.log(`Bad put to ActivityLog - caught error is: ${putError}`);
              });
            onClose();
          }}
        >
        </AVAConfirm>
      }
      {confirmDelete
        &&
        <AVAConfirm
          promptText={`Please confirm removing ${columnUniqueName(reactData.columnList[selectedColumn]).string}`}
          cancelText={'No, go back'}
          confirmText={`Yes, remove ${columnUniqueName(reactData.columnList[selectedColumn]).string}`}
          onCancel={() => {
            setConfirmDelete(false);
          }}
          onConfirm={() => {
            reactData.columnList.splice(selectedColumn, 1);
            if (selectedColumn > 0) { setSelectedColumn(selectedColumn - 1); }
            setConfirmDelete(false);
            updateReactData({
              columnList: reactData.columnList
            }, true);
          }}
        >
        </AVAConfirm>
      }
      {(confirmStatus === 'confirm')
        &&
        <AVAConfirm
          promptText={confirmPrompt}
          cancelText={'Go back'}
          confirmText={'Send'}
          onCancel={async () => {
            dbClient
              .put({
                TableName: 'ActivityLog',
                Item: {
                  timestamp: new Date().getTime(),
                  user_id: state.session.patient_id || 'error-no_patient_id',
                  activity_code: `Confirmation response "go back" caused return`,
                  activity_name: `MultiObservationFormD`,
                  cookieValues: 'n/a',
                  errorInfo: null,
                  AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
                }
              })
              .promise()
              .catch(putError => {
                console.log(`Bad put to ActivityLog - caught error is: ${putError}`);
              });
            setConfirmStatus('');
          }}
          onConfirm={async () => {
            let activity_info = `Request send confirmed`;
            if (!reactData.lockSend) {
              updateReactData(
                { lockSend: true },
                false
              );
              if (reactData.collectPayment) {
                window.open(reactData.collectPayment.link || 'https://buy.stripe.com/3cs5lzbSS9RXecwcMN', reactData.collectPayment.description || 'Please pay');
              }
              await sendRequests(reactData.columnList);
            }
            else {
              activity_info += ` - NOT sent, possible duplicate`;
            }
            dbClient
              .put({
                TableName: 'ActivityLog',
                Item: {
                  timestamp: new Date().getTime(),
                  user_id: state.session.patient_id || 'error-no_patient_id',
                  activity_code: activity_info,
                  activity_name: `MultiObservationFormD`,
                  cookieValues: 'n/a',
                  errorInfo: null,
                  AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
                }
              })
              .promise()
              .catch(putError => {
                console.log(`Bad put to ActivityLog - caught error is: ${putError}`);
              });
            onSave();
          }}
        />
      }
      {(confirmStatus === 'error')
        &&
        <AVAConfirm
          promptText={confirmPrompt}
          cancelText={'Go back'}
          confirmText={'*none*'}
          onCancel={() => { setConfirmStatus(''); }}
          onConfirm={() => { }}
        >
        </AVAConfirm>
      }

      { /* Command Area */}
      {((reactData.columnList && (reactData.columnList.length > 0)) && !morePeople)
        &&
        <Box display='flex' flexDirection='column'>
          <Box mx={2} display='flex' flexWrap='wrap' flexDirection='row' justifyContent='space-between' alignItems='center'>
            <Box display='flex' flexWrap='wrap' flexGrow={1} flexDirection='row' justifyContent='center' alignItems='center' />
            <Box display='flex' flexWrap='wrap' flexGrow={2} flexDirection='row' justifyContent='center' alignItems='center'>
              <Button
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'red', color: 'white' }}
                size='small'
                onClick={() => {
                  ((factType === 'list') ? onClose() : setCancelPending(true));
                }}
                startIcon={<CloseIcon size="small" />}
              >
                {'Exit'}
              </Button>
            </Box>
            <Box display='flex' flexWrap='wrap' flexGrow={2} flexDirection='row' justifyContent='center' alignItems='center'>
              {reactData.allowAttachments &&
                <React.Fragment>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'blue', color: 'white' }}
                    startIcon={<CloudUploadIcon />}
                    size='small'
                    onClick={async () => {
                      handleFileUpload();
                      console.log('upload done');
                    }}
                  >
                    {'Attach'}
                  </Button>
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    ref={hiddenFileInput}
                    onChange={async (target) => {
                      await handleSaveFile(target.target.files[0]);
                      setForceRedisplay(!forceRedisplay);
                    }}
                  />
                </React.Fragment>
              }
              {(allowAddPeople || (allowRemovePeople && (reactData.columnList.length > 1))) &&
                <Box display='flex' flexWrap='wrap' flexDirection='row' justifyContent='center' alignItems='center'>
                  {allowAddPeople &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'blue', color: 'white' }}
                      size='small'
                      onClick={() => {
                        setMorePeople(true);
                      }}
                      startIcon={<GroupAddIcon size="small" />}
                    >
                      {'Add People'}
                    </Button>
                  }
                  {allowRemovePeople && (reactData.columnList.length > 1) && !reactData.viewOnly &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'red', color: 'white' }}
                      size='small'
                      onClick={() => {
                        setConfirmDelete(true);
                      }}
                      startIcon={<DeleteIcon size="small" />}
                    >
                      {`Remove ${columnUniqueName(reactData.columnList[selectedColumn]).string}`}
                    </Button>
                  }
                </Box>
              }
              {(!factType || (factType !== 'list')) && !reactData.viewOnly &&
                !((reactData.columnList && (reactData.columnList.length < 1)) || (morePeople)) &&
                <Button
                  className={AVAClass.AVAButton}
                  style={reactData.errorOnScreen ? { backgroundColor: 'white', color: 'green' } : { backgroundColor: 'green', color: 'white' }}
                  size='small'
                  disabled={reactData.errorOnScreen}
                  onClick={() => {
                    let [cStatus, response] = makeConfirm(reactData.columnList);
                    setConfirmPrompt(response);
                    setConfirmStatus(cStatus);
                  }}
                  startIcon={<CheckIcon size="small" />}
                >
                  {'Confirm'}
                </Button>
              }
            </Box>
            <Box display='flex' flexWrap='wrap' flexGrow={1} flexDirection='row' justifyContent='center' alignItems='center' />
          </Box>
        </Box>
      }
      {
        reactData.alert &&
        <Snackbar
          open={!!reactData.alert}
          px={3}
          key={`alert_wrapper`}
          autoHideDuration={reactData.alert.persist ? null : (reactData.alert.autoHide || ((reactData.alert.severity === 'success') ? 5000 : ((reactData.alert.severity === 'info') ? 15000 : null)))}
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
            style={{ marginX: '8px', borderRadius: '20px', border: 1 }}
            action={(reactData.alert.action
              ?
              <Box
                display='flex'
                key={`alert_action`}
                mx={1}
                overflow='auto'
                flexDirection='column'
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
            {reactData.alert.title && <AlertTitle>{reactData.alert.title}</AlertTitle>}
            {reactData.alert.message}
          </Alert>
        </Snackbar >
      }
    </Dialog >
  );

};
