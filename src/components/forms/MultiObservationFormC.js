import React from 'react';

import { makeName, getImage, getPerson } from '../../util/AVAPeople';
import { deepCopy, titleCase, sentenceCase, makeArray, s3 } from '../../util/AVAUtilities';
import { getActivity } from '../../util/AVAObservations';
import { makeDate } from '../../util/AVADateTime';
import { buildDisplayRows, buildQualifiers } from '../../util/AVAActivityLoader';
import { putServiceRequest, getServiceRequests, updateServiceRequest, formatServiceRequestDetails, validRequestStatus } from '../../util/AVAServiceRequest';
import PersonFilter from './PersonFilter';
import { useSnackbar } from 'notistack';

import SignatureCanvas from 'react-signature-canvas';

import useSession from '../../hooks/useSession';
import TextField from '@material-ui/core/TextField';

import makeStyles from '@material-ui/core/styles/makeStyles';

import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import CloseIcon from '@material-ui/icons/HighlightOff';
import CheckIcon from '@material-ui/icons/Check';
import DeleteIcon from '@material-ui/icons/Delete';
import GroupAddIcon from '@material-ui/icons/GroupAdd';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import LinearProgress from '@material-ui/core/LinearProgress';

import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';

import Avatar from '@material-ui/core/Avatar';
import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import Radio from '@material-ui/core/Radio';

import AVAConfirm from './AVAConfirm';
import { mealTicketFormat, prepareMessage, sendMessages, resolveMessageVariables } from '../../util/AVAMessages';

import { AVAclasses, AVADefaults, AVATextStyle } from '../../util/AVAStyles';

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
    fontSize: theme.typography.fontSize * 1.3,
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
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

  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { state } = useSession();

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [cancelPending, setCancelPending] = React.useState(false);
  const [confirmStatus, setConfirmStatus] = React.useState('');
  const [confirmPrompt, setConfirmPrompt] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [morePeople, setMorePeople] = React.useState(false);

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
    allowAttachments: false,
    errorOnScreen: false,
    factName: factName
  });

  const [records2Update, setRecords2Update] = React.useState([]);
  const [allowAddPeople, setAllowAddPeople] = React.useState(false);
  const [allowRemovePeople, setAllowRemovePeople] = React.useState(true);

  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [selectedColumn, setSelectedColumn] = React.useState(0);

  const factType = fact.activity_key.split('.')[0];

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
        defaultColumnList.push({
          rowDetails: await buildDisplayRows(listValues, defaultObj, qualifiers),
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
          defaultColumnList.push({
            rowDetails: await buildDisplayRows(defaultValue.activities[a].activityRec.valid_values_list, defaultsToUse, qualifiers),
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
            case ('allowAttachments'): {
              updateReactData({ allowAttachments: true }, false);
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
      await initialLoad();
    }
    if (!reactData.initialLoadComplete) {
      initialize();
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

  const onCheckEnter = (event, columnNumber, rowNumber) => {
    if (event.key === 'Enter' || event.type === 'blur') {
      if (reactData.columnList[columnNumber].rowDetails[rowNumber].input === 'date') {
        handleDateExit(event.target.value, columnNumber, rowNumber);
      }
      else if (reactData.columnList[columnNumber].rowDetails[rowNumber].input === 'time') {
        handleTimeExit(event.target.value, columnNumber, rowNumber);
      }
      else if (reactData.columnList[columnNumber].rowDetails[rowNumber].input.toLowerCase() === 'promptall') {
        handleTextAll(event.target.value, reactData.columnList[columnNumber].rowDetails[rowNumber].text);
      }
      else {
        if ((reactData.columnList[columnNumber].rowDetails[rowNumber].obo_line)
          || (reactData.columnList[columnNumber].rowDetails[rowNumber].input.toLowerCase() === 'obo')) {
          handleOBOText(event.target.value, columnNumber, rowNumber);
        }
        else {
          handleTextExit(event.target.value, columnNumber, rowNumber);
          if (reactData.columnList[columnNumber].rowDetails[rowNumber].required) {
            if (!event.target.value) {
              reactData.columnList[columnNumber].rowDetails[rowNumber].error = 'This information is required';
            }
            else {
              reactData.columnList[columnNumber].rowDetails[rowNumber].error = '';
            }
          }
        }
      }
    }
    setForceRedisplay(!forceRedisplay);
  };

  const signatureRef = React.useRef(null);

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
                enqueueSnackbar(`AVA stopped loading at your request.`, { variant: 'error', persist: false });
              }
              else {
                enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
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
    if (!reactData.columnList[columnNumber].rowDetails[rowNumber].hasOwnProperty('textValue')) {
      reactData.columnList[columnNumber].rowDetails[rowNumber].textValue = {};
    }
    if (!vText || (vText === '')) {
      handleTextExit(vText, columnNumber, rowNumber);
    }
    else {
      if (reactData.columnList[columnNumber].rowDetails[rowNumber].input.toLowerCase() === 'promptall') {
        handleTextAll(vText, reactData.columnList[columnNumber].rowDetails[rowNumber].text);
      }
      else {
        handleTextExit(vText.replace(/[\r\n]+/gm, ''), columnNumber, rowNumber);
      }
    }
    setForceRedisplay(!forceRedisplay);
    return;
  };

  function handleDateExit(vText, columnNumber, rowNumber) {
    let AVAdate = makeDate(vText, reactData.columnList[columnNumber].rowDetails[rowNumber].row_qualifier);
    if (AVAdate.error) {
      reactData.columnList[columnNumber].rowDetails[rowNumber].error = AVAdate.absolute;
    }
    else {
      reactData.columnList[columnNumber].rowDetails[rowNumber].error = '';
      reactData.columnList[columnNumber].rowDetails[rowNumber].textValue = AVAdate.absolute;
    }
    // reactData.errorOnScreen = (AVAdate.error && !!AVAdate.absolute);
    updateReactData({ columnList: reactData.columnList }, true);
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
    updateReactData({ columnList: reactData.columnList }, true);
  };

  function handleTextExit(vText, columnNumber, rowNumber) {
    reactData.columnList[columnNumber].rowDetails[rowNumber].textValue = vText;
    updateReactData({ columnList: reactData.columnList }, true);
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
    let typed_in_words = vText.toLowerCase().split(/\s+/);
    let hits = [];
    let hitCount = [];
    let errorText = null;
    let winner = false;
    let winner_at;
    let winnerList = [];
    if (!state?.accessList?.[state.session.client_id]?.list) {
      errorText = `AVA is still loading names.  Please wait a few seconds and try again.`;
    }
    else {
      hits = state.accessList[state.session.client_id].list.filter(accessList_person => {
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
        if (wordsMatched > 0) {
          hitCount.push(wordsMatched);
          return true;
        }
        return false;
      });
      if (hits.length === 0) {
        errorText = `Nobody found to match that name`;
      }
      else if (hits.length === 1) {
        winner = true;
        winner_at = 0;
        let newDName = `${hits[winner_at].name?.first} ${hits[winner_at].name?.last}`.trim() || hits[winner_at].display_name;
        winnerList = [{
          person_id: hits[winner_at].id,
          dName: newDName,
          display: `${newDName}${guestGroups.includes(hits[winner_at].member_of) ? ' (Guest)' : ' (' + hits[winner_at].location + ')'}`,
          type: 'checkbox'
        }];
      }
      else if (hits.length > 1) {
        // is there a clear winner in the hit_count array?
        let maxHits = 0;
        let maxHitCount = 0;
        hitCount.forEach((h, x) => {
          if (h > maxHits) {
            winner_at = x;
            winner = true;
            maxHits = h;
            maxHitCount = 1;
            let newDName = `${hits[winner_at].name?.first} ${hits[winner_at].name?.last}`.trim() || hits[winner_at].display_name;
            let dText = `${newDName}${guestGroups.includes(hits[winner_at].member_of) ? ' (Guest)' : ' (' + hits[winner_at].location + ')'}`;
            winnerList = [{
              default: dText,
              max_allowed: 1,
              min_required: 1,
              option: [{
                person_id: hits[winner_at].id,
                location: hits[winner_at].location,
                dName: newDName,
                display: dText,
                type: 'checkbox'
              }],
            }];
          }
          else if (h === maxHits) {
            winner = false;
            maxHitCount++;
            let newDName = `${hits[x].name?.first} ${hits[x].name?.last}`.trim() || hits[x].display_name;
            winnerList[0].option.push({
              person_id: hits[x].id,
              location: hits[x].location,
              dName: newDName,
              display: `${newDName}${guestGroups.includes(hits[x].member_of) ? ' (Guest)' : ' (' + hits[x].location + ')'}`,
              type: 'checkbox'
            });
          }
        });
        if (!winner) {
          winnerList[0].title = `AVA found ${maxHitCount} people to match that name.`;
        }
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
      if (winner) {
        reactData.columnList[c].person_id = hits[winner_at].id;
        let newDName = `${hits[winner_at].name?.first} ${hits[winner_at].name?.last}`.trim() || hits[winner_at].display_name;
        reactData.columnList[c].display_name = newDName;
        reactData.columnList[c].dName.splice(-3, 3, ...([' ', ' ', ' '].concat(newDName.split(/\s+/).splice(-3))));
        vText = `${newDName}`;
        if (guestGroups.includes(hits[winner_at].member_of)) {
          vText += ` (Guest)`;
        }
        resetTitleName();
        reactData.columnList[c].rowDetails.forEach((checkRow, r) => {
          if (checkRow.location_line) {
            reactData.columnList[c].rowDetails[r].textValue = hits[winner_at].location || '';
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
        reactData.columnList[c].rowDetails[rowNumber].qualData = winnerList;
        reactData.columnList[c].rowDetails[rowNumber].qualSelections = {
          [winnerList[0].title]: {
            [winnerList[0].option[0].display]: true
          }
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
    updateReactData({ columnList: reactData.columnList }, true);
  };

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
    updateReactData({ columnList: reactData.columnList }, true);
  };

  function isQualChecked(rowData, pOption, pSelection) {
    if (!rowData.qualSelections) { return false; }
    if (!rowData.qualSelections.hasOwnProperty(pOption)) { return false; }
    return !!rowData.qualSelections[pOption][pSelection];
  }

  async function itemSelected(columnNumber, rowNumber) {
    let this_row = reactData.columnList[columnNumber].rowDetails[rowNumber];
    this_row.isChecked = !this_row.isChecked;
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
        else if (column.defaultValues[dKey].startsWith('[person.')) {
          let pKey = column.defaultValues[dKey].split('.')[1];
          if (this_person.hasOwnProperty(pKey)) {
            myDefaultColumns[c].defaultValues[dKey] = this_person[pKey];
          }
        }
      }
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
      if (!defaultValue.suppressDuplicateCheck) {
        let existingRequest = await checkExistingRequests({
          client_id: state.session.client_id,
          foreign_key: myDefaultColumns[c].foreign_key || myDefaultColumns[c].foreignKey,
          request_type: defaultValue.importTypes || myDefaultColumns[c].request_type || myDefaultColumns[c].requestType,
          requestor: this_id,
          requestor_name: `${this_person.name.first} ${this_person.name.last}`
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

  async function applyExistingRequest(existingRequest, this_column, this_column_index) {
    this_column.request_to_update = existingRequest.requestToUse;
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
        enqueueSnackbar(
          `${phrase}.  What would you like to do?`,
          { variant: 'warning', persist: true, action: snackAction }
        );
      });
      let rValue = await showWarning;
      closeSnackbar();
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
      if (this_column.person_id) {
        oBo = await makeName(this_column.person_id);
      }
      else {
        oBo = await makeName(reactData.defaultPerson ? reactData.defaultPerson.person_id : state.patient.person_id);
      }
      for (let rowNumber = 0; rowNumber < this_column.rowDetails.length; rowNumber++) {
        let this_row = this_column.rowDetails[rowNumber];
        if (this_row.isChecked) {
          let choices_list = [];
          if (this_row.input === 'signature') {
            let s3Response = await s3
              .upload({
                Bucket: 'theseus-medical-storage',
                Key: `${this_column.person_id || reactData.defaultPerson.person_id || state.patient.person_id}_signature`,
                Body: this_row.image,
                ACL: 'public-read-write',
                ContentType: 'image/png'
              })
              .promise()
              .catch(err => {
                enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
              });
            image_location[this_row.text] = s3Response.Location;
            images[this_row.text] = this_row.image;
          }
          else {
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
          }
          let pushText = this_row.text;
          if (choices_list.length > 0) {
            pushText += ` (${choices_list.join('; ')})`;
          }
          selections.push(pushText);
        }
        if (this_row.textValue) {
          // special Values/
          if ((this_column.defaultValues.hasOwnProperty('onBehalfOf') && (this_column.defaultValues['onBehalfOf'] === this_row.text))
            || (this_row.input === 'obo')) {
            oBo = this_row.textValue;
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
      /*  Check for errors */
      this_column.rowDetails.forEach((this_row, row_number) => {
        if (this_row.input === 'signature') {
          if (signatureRef.current.isEmpty() && this_row.required) {
            this_row.textValue = false;
          }
          else {
            // reactData.columnList[column_number].rowDetails[row_number].image = signatureRef.current.toDataURL('image/png');
            reactData.columnList[column_number].rowDetails[row_number].image = signatureRef.current.getTrimmedCanvas().toDataURL('image/png');
            this_row.textValue = 'Signature captured';
          }
        }
        if (this_row.required && !this_row.textValue) {
          confirmStatus = 'error';
          if (pData.length > 1) {
            warningSection.push(`[color:red][bold]${columnName} is missing "${this_row.text}"`);
          }
          else {
            warningSection.push(`[color:red][bold]"${this_row.text}" is required`);
          }
          warningsExist = true;
          reactData.columnList[column_number].rowDetails[row_number].error = "This information is required";
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
      for (const [this_selection, optionList] of Object.entries(formatServiceRequestDetails(this_column))) {
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
    });
    let returnArray = [reactData.factName];
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
              paddingTop={(reactData.columnList.length > 5) ? '100px' : 1}
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
            {(reactData.columnList.length > 0) &&
              (reactData.columnList[selectedColumn].rowDetails).map((this_item, this_index) => (
                <Box display='flex'
                  flexDirection='row'
                  borderRadius={'16px'}
                  marginLeft={2}
                  marginRight={2}
                  marginBottom={(this_item.header ? 0 : 0.5)}
                  paddingBottom={(this_item.header ? 0 : 1)}
                  marginTop={(this_item.header ? 0 : 0.5)}
                  paddingTop={(this_item.header ? 0 : 1)}
                  border={(!!this_item.error || this_item.isChecked || (this_item.textValue && (this_item.textValue !== ''))) ? (!!this_item.error ? 4 : 1) : 'none'}
                  borderColor={!!this_item.error ? 'red' : 'black'}
                  key={`rowboxwrap_${selectedColumn}.${this_index}-${this_item.isChecked}-${!!this_item.error ? 'err' : 'ok'}`}
                  id={`rowboxwrap_${selectedColumn}.${this_index}-${this_item.isChecked}-${!!this_item.error ? 'err' : 'ok'}`}
                >
                  <Box display='flex'
                    flexDirection='column'
                    flexGrow={1}
                    key={`rowmainboxwrap_${selectedColumn}.${this_index}-${this_item.isChecked}-${!!this_item.error ? 'err' : 'ok'}`}
                    id={`rowmainboxwrap_${selectedColumn}.${this_index}-${this_item.isChecked}-${!!this_item.error ? 'err' : 'ok'}`}
                  >
                    <Box
                      display='flex'
                      flexDirection='row'
                      key={`rowbox_${selectedColumn}.${this_index}-${this_item.isChecked}`}
                      id={`rowbox_${selectedColumn}.${this_index}-${this_item.isChecked}`}
                      className={classes.listItem}
                      mb={0.5}
                      mt={0.5}
                      justifyContent='flex-start'
                      onClick={async () => {
                        if (this_item.checkbox) {
                          await itemSelected(selectedColumn, this_index);
                        }
                      }}
                      alignItems='center'
                    >
                      {this_item.checkbox &&
                        <Radio
                          key={`checkbox_${selectedColumn}.${this_index}-${this_item.isChecked}`}
                          id={`checkbox_${selectedColumn}.${this_index}-${this_item.isChecked}`}
                          checked={this_item.isChecked}
                          value={this_item.isChecked}
                          disableRipple
                          className={classes.radioButton}
                          size='small'
                        />
                      }
                      { /* Descriptive text for this row - every row has some */}
                      {!this_item.input &&
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
                                ? AVATextStyle({ size: 1.3, bold: true, margin: { top: 2 } })
                                : AVATextStyle({ size: 1.2, margin: { right: 0.5 } }))
                            }
                          >
                            {this_item.bold
                              ? (this_item.italic ? <b><i>{this_item.text}</i></b> : <b>{this_item.text}</b>)
                              : (this_item.italic ? <i>{this_item.text}</i> : `${this_item.text}`)}
                          </Typography>
                        </Box>
                      }
                      { /* Text prompt line for this row - headers don't have this */}
                      {this_item.input && (this_item.input !== 'signature') && (this_item.input !== 'docLines') &&
                        <TextField
                          className={classes.freeInput}
                          variant={'standard'}
                          key={`inputtextprompt_${selectedColumn}.${this_index}`}
                          id={`inputtextprompt_${selectedColumn}.${this_index}`}
                          helperText={(this_item.error ? (`${this_item.error} - `) : '') + this_item.text}
                          multiline
                          inputProps={{ style: { fontSize: `${user_fontSize * 1}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                          onChange={event => {
                            if (!event.target.value) {
                              reactData.errorOnScreen = false;
                            }
                            handleChangeTextField(event.target.value, selectedColumn, this_index);
                          }}
                          FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                          onKeyPress={(event) => {
                            onCheckEnter(event, selectedColumn, this_index);
                          }}
                          onBlur={(event) => {
                            onCheckEnter(event, selectedColumn, this_index);
                          }}
                          autoComplete='off'
                          value={this_item.textValue || ''}
                        />
                      }
                      {this_item.input && (this_item.input === 'docLines') &&
                        <div
                          dangerouslySetInnerHTML={{ '__html': this_item.text }}
                        />
                      }
                      {this_item.input && (this_item.input === 'signature') &&
                        <Box
                          display='flex'
                          flexDirection='column'
                          key={`sigbox_${selectedColumn}.${this_index}`}
                          id={`sigbox_${selectedColumn}.${this_index}`}
                          justifyContent='flex-start'
                          alignItems='flex-start'
                          width='97%'
                        >
                          <SignatureCanvas
                            ref={signatureRef}
                            canvasProps={{
                              style: {
                                backgroundColor: 'beige',
                                width: '35%',
                                marginLeft: '10px',
                                marginRight: '10px',
                                marginTop: '2px',
                                height: '88px'
                              }
                            }}
                          />
                          <Typography
                            key={`sigboxtxt_${selectedColumn}.${this_index}`}
                            id={`sigboxtxt_${selectedColumn}.${this_index}`}
                            style={AVATextStyle({ size: 0.6, margin: { left: 1, bottom: 0.5 } })}
                          >
                            {this_item.text}
                          </Typography>
                          <Box display='flex' mt={0} mb={0} flexWrap='wrap' flexDirection='row' justifyContent='center' alignItems='center'>
                            {signatureRef.current && !signatureRef.current.isEmpty() &&
                              <Button
                                className={AVAClass.AVAMicroButton}
                                style={{ backgroundColor: 'white', color: 'red' }}
                                size='small'
                                onClick={() => {
                                  signatureRef.current.clear();
                                  setForceRedisplay(!forceRedisplay);
                                }}
                              >
                                {'Clear'}
                              </Button>
                            }
                            {reactData.storedSignature &&
                              <Button
                                className={AVAClass.AVAMicroButton}
                                style={{ backgroundColor: 'lightgreen', color: 'black', margin: { bottom: 0 } }}
                                size='small'
                                onClick={async () => {
                                  signatureRef.current.clear();
                                  var params = {
                                    Bucket: 'theseus-medical-storage',
                                    Key: reactData.storedSignature.split('/').pop()
                                  };
                                  let data = await s3
                                    .getObject(params)
                                    .promise()
                                    .catch(err => {
                                      console.log(`error at getS3Object is`, err);
                                    });
                                  if (data) {
                                    let s64 = data.Body.toString("base64");
                                    console.log(s64);
                                    let b64 = 'data:image/png;base64,' + data.Body.toString("base64");
                                    signatureRef.current.fromDataURL(b64);
                                  }
                                  setForceRedisplay(!forceRedisplay);
                                }}
                              >
                                {'Use Existing'}
                              </Button>
                            }
                          </Box>
                        </Box>
                      }
                    </Box>
                    {this_item.isChecked && this_item.desc &&
                      <Typography
                        key={`descriptiontext_${selectedColumn}.${this_index}-${this_item.isChecked}`}
                        id={`descritpiontext_${selectedColumn}.${this_index}-${this_item.isChecked}`}
                        style={AVATextStyle({ size: 0.7, margin: { left: 1, bottom: 0.8, right: 3 } })}
                      >
                        {this_item.desc}
                      </Typography>
                    }
                    {this_item.isChecked
                      && this_item.moreInfo &&
                      <Box
                        key={`qualboxwrap_${selectedColumn}.${this_index}.moreInfo-${this_item.isChecked}`}
                        id={`qualboxwrap_${selectedColumn}.${this_index}.moreInfo-${this_item.isChecked}`}
                        display="flex"
                        style={AVATextStyle({
                          margin: { right: 1 },
                          padding: { left: 0, right: 3 }
                        })}
                        flexDirection='column'
                        justifyContent="center"
                      >
                        <Box display='flex' flexDirection='column' justifyContent='center'
                          key={`qualbox_${selectedColumn}.${this_index}.moreInfo-${this_item.isChecked}`}
                          id={`qualbox_${selectedColumn}.${this_index}.moreInfo-${this_item.isChecked}`}
                          alignItems='flex-start'>
                          <Box display='flex' flexDirection='row' justifyContent='flex-start'
                            key={`optionbox_${selectedColumn}.${this_index}.moreInfo-${this_item.isChecked}`}
                            id={`optionbox_${selectedColumn}.${this_index}.moreInfo-${this_item.isChecked}`}
                            alignItems='center' flexWrap='wrap'
                          >
                            {Object.keys(this_item.moreInfo).map((opt, oX) => (
                              <React.Fragment
                                key={`optionbox_${selectedColumn}.${this_index}.fragment-${this_item.isChecked}-${oX}`}
                              >
                                {(opt !== 'image') && (opt !== 'restriction') &&
                                  <Box display='flex' flexDirection='row' justifyContent='flex-start'
                                    key={`option_${selectedColumn}.${this_index}.moreInfo.${oX}-${this_item.isChecked}`}
                                    id={`option_${selectedColumn}.${this_index}.moreInfo.${oX}-${this_item.isChecked}`}
                                    style={AVATextStyle({ size: 0.7, margin: { right: 3 } })}
                                    alignItems='center'
                                  >
                                    <Typography
                                      key={`optionchecktext_${selectedColumn}.${this_index}.moreInfo.${oX}-${this_item.isChecked}`}
                                      id={`optionchecktext_${selectedColumn}.${this_index}.moreInfo.${oX}-${this_item.isChecked}`}
                                      style={AVATextStyle({ size: 0.75, margin: { left: 1 } })}
                                    >
                                      {`${sentenceCase(opt.replace('_', ' '))}${this_item.moreInfo[opt].trim() ? (': ' + this_item.moreInfo[opt]) : ''}`}
                                    </Typography>
                                  </Box>
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
                                    key={`option_${selectedColumn}.${this_index}.restriction.${oX}-${this_item.isChecked}`}
                                    id={`option_${selectedColumn}.${this_index}.restriction.${oX}-${this_item.isChecked}`}
                                    style={AVATextStyle({ size: 0.7, margin: { right: 3 } })}
                                    alignItems='center'
                                  >
                                    <Typography
                                      key={`optionchecktext_${selectedColumn}.${this_index}.restriction.${oX}-${this_item.isChecked}`}
                                      id={`optionchecktext_${selectedColumn}.${this_index}.restriction.${oX}-${this_item.isChecked}`}
                                      style={AVATextStyle({ color: 'red', style: 'bold', size: 1.2, margin: { left: 1 } })}
                                    >
                                      {`*** THIS ITEM IS NOT RECOMMENDED FOR ${reactData.columnList[selectedColumn].display_name.toUpperCase()} ***`}
                                    </Typography>
                                  </Box>
                                }
                              </React.Fragment>
                            ))}
                          </Box>
                        </Box>
                      </Box>
                    }
                    {this_item.isChecked
                      && this_item.qualData
                      && makeArray(this_item.qualData).map((qR, qRndx) => (
                        <Box
                          key={`qualboxwrap_${selectedColumn}.${this_index}.${qRndx}-${this_item.isChecked}`}
                          id={`qualboxwrap_${selectedColumn}.${this_index}.${qRndx}-${this_item.isChecked}`}
                          display="flex"
                          style={AVATextStyle({
                            margin: { left: 1.5, right: 1 },
                            padding: { left: 0, right: 3 }
                          })}
                          flexDirection='column'
                          justifyContent="center"
                        >
                          <Box display='flex' flexDirection='column' justifyContent='center'
                            key={`qualbox_${selectedColumn}.${this_index}.${qRndx}-${this_item.isChecked}`}
                            id={`qualbox_${selectedColumn}.${this_index}.${qRndx}-${this_item.isChecked}`}
                            alignItems='flex-start'>
                            <Typography
                              key={`qualboxtitle_${selectedColumn}.${this_index}.${qRndx}-${this_item.isChecked}`}
                              id={`qualboxtitle_${selectedColumn}.${this_index}.${qRndx}-${this_item.isChecked}`}
                              style={AVATextStyle({
                                margin: { top: 0.8, bottom: 0, left: 0 },
                                padding: { left: 0, right: 3 },
                                size: 1
                              })}
                            >
                              {qR.title}
                            </Typography>
                            <Box display='flex' flexDirection='row' justifyContent='flex-start'
                              key={`optionbox_${selectedColumn}.${this_index}.${qRndx}-${this_item.isChecked}`}
                              id={`optionbox_${selectedColumn}.${this_index}.${qRndx}-${this_item.isChecked}`}
                              alignItems='center' flexWrap='wrap'
                            >
                              {qR.option && qR.option.map((opt, oX) => (
                                <Box display='flex' flexDirection='row' justifyContent='flex-start'
                                  key={`option_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.isChecked}`}
                                  id={`option_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.isChecked}`}
                                  alignItems='center'
                                >
                                  {(!opt.type || (opt.type === 'checkbox')) &&
                                    <React.Fragment>
                                      <Checkbox
                                        key={`optioncheckbox_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.isChecked}`}
                                        id={`optioncheckbox_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.isChecked}`}
                                        className={classes.radioButton}
                                        size="small"
                                        onClick={() => {
                                          optSelected(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display);
                                          if (reactData.columnList[selectedColumn].rowDetails[this_index].obo_line) {
                                            console.log('There I am Gary!');
                                            // which qualSelection is true?
                                            let allPossibilitiesObj = Object.values(reactData.columnList[selectedColumn].rowDetails[this_index].qualSelections)[0];
                                            let selectedOBOkey = Object.keys(allPossibilitiesObj).find((k) => {
                                              return allPossibilitiesObj[k];
                                            });
                                            let allQualsList = reactData.columnList[selectedColumn].rowDetails[this_index].qualData[0].option;
                                            let qualPicked = allQualsList.findIndex((i) => {
                                              return (i.display === selectedOBOkey);
                                            });
                                            reactData.columnList[selectedColumn].person_id = allQualsList[qualPicked].person_id;
                                            reactData.columnList[selectedColumn].display_name = allQualsList[qualPicked].dName;
                                            reactData.columnList[selectedColumn].dName.splice(-3, 3, ...([' ', ' ', ' '].concat(allQualsList[qualPicked].dName.split(/\s+/).splice(-3))));
                                            resetTitleName();
                                            reactData.columnList[selectedColumn].rowDetails[this_index].textValue = titleCase(allQualsList[qualPicked].dName);
                                            reactData.columnList[selectedColumn].rowDetails.forEach((checkRow, r) => {
                                              if (checkRow.location_line) {
                                                reactData.columnList[selectedColumn].rowDetails[r].textValue = allQualsList[qualPicked].location || '';
                                              }
                                            });
                                          }
                                          updateReactData({
                                            columnList: reactData.columnList
                                          }, true);
                                        }}
                                        checked={isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}
                                      />
                                      <Typography
                                        key={`optionchecktext_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.isChecked}`}
                                        id={`optionchecktext_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.isChecked}`}
                                        style={AVATextStyle({ size: 0.75, margin: { top: 0.5, bottom: 0.5, left: 0.3, right: 3 } })}>{opt.display}</Typography>
                                    </React.Fragment>
                                  }
                                  {opt.type === 'prompt' &&
                                    <React.Fragment>
                                      <Checkbox
                                        className={classes.radioButton}
                                        key={`optionpromptcheck_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.isChecked}`}
                                        id={`optionpromptcheck_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.isChecked}`}
                                        size="small"
                                        checked={isQualChecked(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}
                                      />
                                      <Typography style={AVATextStyle({ size: 0.75, margin: { top: 0.5, bottom: 0.5, left: 0.3, right: 3 } })}>{opt.display}</Typography>
                                      <TextField
                                        key={`optionpromptchecktext_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.isChecked}`}
                                        id={`optionpromptchecktext_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.isChecked}`}
                                        style={AVATextStyle({ size: 0.75, margin: { top: 0.5, bottom: 0.5, left: 0.3, right: 3 } })}
                                        defaultValue={getQualTextValue(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display)}
                                        variant={'standard'}
                                        multiline
                                        onChange={(event) => {
                                          optSelected(reactData.columnList[selectedColumn].rowDetails[this_index], qR.title, opt.display, event.target.value);
                                          updateReactData({
                                            columnList: reactData.columnList
                                          }, true);
                                        }}
                                        autoComplete='off'
                                      />
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
                  {this_item.isChecked
                    && this_item.moreInfo &&
                    <React.Fragment>
                      {
                        Object.keys(this_item.moreInfo).map((opt, oX) => (
                          (opt === 'image') &&
                          <Box
                            component="img"
                            key={`obs_image_${oX}`}
                            mt={0}
                            mb={1}
                            mr={2}
                            alignSelf={'center'}
                            border={1}
                            minWidth={100}
                            maxWidth={100}
                            minHeight={100}
                            maxHeight={100}
                            alt=''
                            src={this_item.moreInfo[opt]}
                          />
                        ))
                      }
                    </React.Fragment>
                  }
                </Box>
              ))
            }
            { /* Show list of already uploaded attachments (if applicable) */}
            {(reactData.attachmentList.length > 0) &&
              <Box display='flex' flexDirection='column' pl={'24px'} justifyContent='flex-start'
                alignItems='flex-start' key={'qrOpt_attachmentlist'}
              >
                <Typography className={classes.radioHead}>Attachments:</Typography>
                {reactData.attachmentList.map((a, x) => (
                  <Box display='flex' flexDirection='row' justifyContent='flex-start'
                    alignItems='center' key={`qrOpt_attachmentLine-${x}`}
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
                    {loadingInProgress(x) &&
                      <React.Fragment>
                        <LinearProgress
                          variant="determinate"
                          className={classes.progressBar}
                          style={{ width: reactData.loadProgress[x].total }}
                          value={reactData.loadProgress[x].progress}
                        />
                      </React.Fragment>
                    }
                    <Typography
                      style={AVATextStyle({
                        size: 0.6,
                        color: ((loadingInProgress(x)) ? 'gray' : 'black'),
                        margin: { left: 0.3, right: 3 }
                      })}
                    >
                      {a.Key}
                    </Typography>
                  </Box>
                ))}
              </Box>
            }
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
          confirmText={'Save/Send'}
          onCancel={() => { setConfirmStatus(''); }}
          onConfirm={async () => {
            if (!reactData.lockSend) {
              updateReactData(
                { lockSend: true },
                false
              );
              await sendRequests(reactData.columnList);
            }
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
      <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
        <Box display='flex' flexDirection='column'>
          <Box display='flex' flexWrap='wrap' flexDirection='row' justifyContent='center' alignItems='center'>
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
            {reactData.allowAttachments &&
              <React.Fragment>
                <Button
                  className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'blue', color: 'white' }}
                  startIcon={<CloudUploadIcon />}
                  size='small'
                  onClick={handleFileUpload}
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
            {(!factType || (factType !== 'list')) &&
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
                {'Confirm/Send'}
              </Button>
            }
          </Box>
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
              {allowRemovePeople && (reactData.columnList.length > 1) &&
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
        </Box>
      </DialogActions>
    </Dialog >
  );

};
