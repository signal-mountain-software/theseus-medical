import React from 'react';

import { makeName, getImage, getPerson } from '../../util/AVAPeople';
import { getMemberList } from '../../util/AVAGroups';
import { deepCopy, makeObj, titleCase, sentenceCase } from '../../util/AVAUtilities';
import { getObservationOptions, getObservationItems, getActivity } from '../../util/AVAObservations';
import { makeDate } from '../../util/AVADateTime';
import { putServiceRequest, getServiceRequests, updateServiceRequest } from '../../util/AVAServiceRequest';
import PersonFilter from './PersonFilter';
import { useSnackbar } from 'notistack';

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

import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';

import Avatar from '@material-ui/core/Avatar';
import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import Radio from '@material-ui/core/Radio';

import AVAConfirm from './AVAConfirm';
import { mealTicketFormat, prepareMessage, sendMessages } from '../../util/AVAMessages';

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
    width: '100%'
  },
  page: {
    height: 950,
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
    initialLoadComplete: null,
    defaultPerson: null,
    defaultQualSelections: {},
    defaultRequestType: null
  });

  const [foreign_key, setForeignKey] = React.useState('');
  const [records2Update, setRecords2Update] = React.useState([]);
  const [importTypes, setImportTypes] = React.useState('');
  const [allowAddPeople, setAllowAddPeople] = React.useState(false);
  const [allowRemovePeople, setAllowRemovePeople] = React.useState(true);

  const [dataRows, setDataRows] = React.useState();

  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [maxName, setMaxName] = React.useState(1);
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

  let selectionList = [];
  let checkbox = true;
  let ignore = false;
  let required = false;
  let multiColumn = false;
  let displayBold = false;
  let displayStyle = false;
  let displayItalic = false;
  let doneWithTopBox = false;
  const defaultCheckedWords = ['checked', 'on', 'selected', 'true'];

  const updateReactData = (newData, force = false) => {
    for (let oKey in newData) {
      setReactData((prevValues) => ({
        ...prevValues,
        [oKey]: newData[oKey]
      }));
    }
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  async function initialLoad() {
    // if (!initialLoadComplete) {
    let columnList = [];
    let maxLength = 1;
    let foreignKey = '*tbd';
    let defaultObj = {};
    updateReactData({
      defaultPerson: state.patient
    }, false);
    let defaultChecked = { AVA: false };
    let defaultQualSelections = {};
    let defaultQualData = [];
    // set defaults and build columnList (if appropriate)
    if (defaultValue) {
      for (let dKey in defaultValue) {
        switch (dKey) {
          case ('foreignKey'): {
            foreignKey = defaultValue.foreignKey;
            break;
          }
          case ('requestType'): {
            updateReactData({
              defaultRequestType: defaultValue.requestType
            }, false);
            break;
          }
          case ('importTypes'): {
            setImportTypes(defaultValue.importTypes);
            break;
          }
          case ('allowAddPeople'): {
            setAllowAddPeople(defaultValue.allowAddPeople);
            break;
          }
          case ('allowRemovePeople'): {
            setAllowRemovePeople(defaultValue.allowRemovePeople);
            break;
          }
          case ('selectList'): {
            let allowAdd = true;
            for (let subKey in defaultValue.selectList) {
              switch (subKey) {
                case 'selectionList': {
                  selectionList = defaultValue.selectList.selectionList;
                  break;
                }
                case 'shortList': {
                  selectionList = defaultValue.selectList.shortList;
                  break;
                }
                case 'addPeople': {
                  allowAdd = defaultValue.selectList.addPeople;
                  break;
                }
                default: { }
              }
            }
            setAllowAddPeople(allowAdd);
            break;
          }
          case ('peopleList'): {
            let allowAdd = false;
            for (let subKey in defaultValue.peopleList) {
              switch (subKey) {
                case 'peopleList': {
                  let defaultDisplayRows = await buildDisplayRows(listValues, defaultObj);
                  if (defaultValue.hasOwnProperty('activities')) {
                    updateReactData({
                      defaultPerson: defaultValue.peopleList.peopleList[0]
                    }, false);
                  }
                  else {
                    // eslint-disable-next-line
                    columnList = defaultValue.peopleList.peopleList.map(pRec => {
                      if (!pRec.display_name && pRec.name) {
                        pRec.display_name = `${pRec.name.first} ${pRec.name.last}`;
                      }
                      let a = pRec.display_name.trim().split(' ');
                      maxLength = Math.max(a.length, maxLength);
                      return Object.assign({}, pRec, {   // return to the map function... adds an entry to the columnList
                        rowDetails: deepCopy(defaultDisplayRows),
                        foreignKey: defaultValue.foreignKey || foreignKey,
                        requestType: defaultValue.requestType,
                        defaultValues: defaultObj,
                        column_id: pRec.person_id,
                        dName: [' ', ' ', ' '].concat(a)
                      });
                    });
                  }
                  break;
                }
                case 'addPeople': {
                  allowAdd = defaultValue.peopleList.addPeople;
                  break;
                }
                default: { }
              }
            }
            setAllowAddPeople(allowAdd);
            break;
          }
          case ('activities'): {
            for (let a = 0; a < defaultValue.activities.length; a++) {
              let this_requestType, this_requestName;
              if (!defaultValue.activities[a].hasOwnProperty('column_defaults')) {
                defaultValue.activities[a].column_defaults = {};
              }
              if (defaultValue.activities[a].column_defaults.requestType) {
                this_requestType = defaultValue.activities[a].column_defaults.requestType;
                if (state.session.service_request_types.hasOwnProperty(this_requestType)) {
                  this_requestName = state.session.service_request_types[this_requestType].description || titleCase(this_requestType);
                }
                else {
                  this_requestName = titleCase(this_requestType);
                }
              }
              let words = this_requestName.split(' ');
              maxLength = Math.max(words.length, maxLength);
              let defaultsToUse = deepCopy(Object.assign({}, defaultObj, defaultValue.activities[a].column_defaults));
              columnList.push({
                rowDetails: await buildDisplayRows(defaultValue.activities[a].activityRec.valid_values_list, defaultsToUse),
                activity_key: defaultValue.activities[a].column_defaults.activity_code || defaultValue.activities[a].activityRec.activity_code,
                foreignKey: defaultValue.activities[a].column_defaults.foreignKey,
                requestType: defaultValue.activities[a].column_defaults.requestType,
                requestName: this_requestName,
                defaultValues: defaultsToUse
              });
            }
            setAllowRemovePeople(false);
            setAllowAddPeople(false);
            break;
          }
          default: {
            if (typeof defaultValue[dKey] === 'string') {
              defaultObj[dKey] = defaultValue[dKey];
            }
          }
        };
      }
    }
    setForeignKey(foreignKey);
    if (!defaultValue.requestType) {
      let activityParts = fact.activity_key.split('//');
      let activityCode = activityParts.pop();
      let activityClient = state.session.client_id;
      if (activityParts.length > 0) {
        activityClient = activityParts[0];
      }
      let activityRec = await getActivity(activityClient, activityCode);
      updateReactData({
        defaultRequestType: activityRec.request_type
      }, false);
    }
    let displayRowList = await buildDisplayRows(listValues, defaultObj);

    // We'll pre-load the radio checkboxes and do a little manipulation on the names for display purposes
    let radioOn = {};
    let textValue = {};
    columnList.forEach((this_column, x) => {         // for every column
      radioOn[this_column.column_id] = {};
      displayRowList.forEach((r, rx) => {
        if (this_column.rowDetails[x].isChecked) {
          radioOn[this_column.column_id][r.text] = true;
        }
        if (defaultObj.hasOwnProperty(r.text) || defaultValue.activities[x].column_defaults.hasOwnProperty(r.text)) {
          let textValueToUse = defaultValue.activities[x].column_defaults[r.text] || defaultObj[r.text];
          if (!this_column.rowDetails[x].isChecked || !defaultCheckedWords.includes(textValueToUse.toLowerCase())) {
            if (!textValue.hasOwnProperty(this_column.column_id)) {
              textValue[this_column.column_id] = {};
            }
            textValue[this_column.column_id][r.text] = textValueToUse;
          }
        }
      });
      for (let dQ in defaultQualSelections) {
        defaultQualSelections[dQ][this_column.column_id] = deepCopy(defaultQualSelections[dQ]['_default_']);
      }
      if (!this_column.requestType) {
        this_column.requestType = reactData.defaultRequestType;
        if (state.session.service_request_types.hasOwnProperty(this_column.requestType)) {
          this_column.requestName = state.session.service_request_types[this_column.requestType].description || titleCase(this_column.requestType);
        }
        else {
          this_column.requestName = titleCase(this_column.requestType);
        }
      }
      if (!this_column.foreignKey) {
        this_column.foreignKey = reactData.defaultForeignKey;
      }
      if (!this_column.dName) {
        let fDate = makeDate(this_column.foreignKey);
        let words = this_column.requestName.split(' ').slice(-3);
        if (!fDate.error) {
          this_column.dName = [' ', ' ', ' '].concat(words).concat((fDate.absolute).split(','));
        }
        else {
          this_column.dName = [' ', ' ', ' '].concat(words).concat((fDate.absolute).split(','));
        }
      }
      if (!this_column.column_id) {
        this_column.column_id = `${this_column.requestType}_${this_column.foreignKey}`;
      }
      if (this_column.hasOwnProperty('person_id')) {
        if (this_column.hasOwnProperty('defaultValues')) {  // if this person carried global default values
          displayRowList.forEach((r, rx) => {
            if (this_column.defaultValues.hasOwnProperty(r.text)) {
              if (!textValue.hasOwnProperty(this_column.column_id)) { textValue[this_column.column_id] = {}; }
              textValue[this_column.column_id][r.text] = this_column.defaultValues[r.text];
            }
          });
        }
        if (!this_column.display_name) {
          this_column.display_name = `${this_column.name.first} ${this_column.name.last}`;
        }
        if (!columnList[x].dName) {
          let a = this_column.display_name.split(' ');
          maxLength = Math.max(a.length, maxLength);
          columnList[x].dName = [' ', ' ', ' '].concat(a);
        }
      }
    });
    setMaxName(maxLength);

    setDataRows({
      displayRows: displayRowList,
      dataRows: {},
      textValue,
      radioOn,
      defaultChecked,
      qualData: defaultQualData,
      columnList: columnList,
      selectionList: selectionList
    });
    updateReactData({
      initialLoadComplete: true,
      defaultQualSelections
    }, true);

    async function buildDisplayRows(listValues, defaults) {
      let displayRowList = [];
      for (let vIndex = 0; vIndex < listValues.length; vIndex++) {
        // All rows are evaluated as follows "<instruction[0]>~<instruction[1]>:<instruction[2]>"
        // OR... "<instruction[0]>~~<instruction[1]>" (instruction[0] expected to be null/blank in this case)
        let oValueObject = {};
        let t = listValues[vIndex].split(/={|}/);
        if (t.length > 1) {
          oValueObject = makeObj(t[1]);
          listValues[vIndex] = listValues[vIndex].replace(`{${t[1]}}`, '<OBJ>');
        }
        let instruction = listValues[vIndex].split(/[~:]+/);
        // console.log(instruction);

        // This checks for rows that contain "~[<oControl>=<oValue on/off>]"
        let dValue = '';
        let last_instruction = instruction[instruction.length - 1];
        if (last_instruction.charAt(0) === '[') {
          let [, oControl, oValue] = last_instruction.split(/[=[\]]+/);
          switch (oControl) {
            case 'checkbox': {    // checkbox default state is true; this allows you to toggle it off/on
              checkbox = (oValue.toLowerCase() === 'on');
              break;
            }
            case 'display': {
              ignore = (oValue.toLowerCase() === 'off');
              break;
            }
            case 'multiColumn': {
              multiColumn = (oValue.toLowerCase() === 'off');
              break;
            }
            case 'required': {
              required = (oValue.toLowerCase() === 'on');
              break;
            }
            case 'bold': {
              displayBold = (oValue.toLowerCase() === 'on');
              break;
            }
            case 'style': {
              if (oValue.toLowerCase() === 'off') {
                displayStyle = false;
              }
              else if (oValue === '<OBJ>') {
                displayStyle = oValueObject;
              }
              else {
                displayStyle = oValue;
              }
              break;
            }
            case 'italics':
            case 'italic': {
              displayItalic = (oValue.toLowerCase() === 'on');
              break;
            }
            case 'default': {
              dValue = oValue;
              break;
            }
            default: { }
          }
          instruction.pop();
          if ((instruction.length === 0) || ((instruction.length === 1) && !instruction[0])) { continue; }
        }

        if (ignore) { continue; }

        if ((vIndex !== 0) && (checkbox || (!instruction[0] && !instruction[2]))) {
          // this is either a checkbox or a header
          doneWithTopBox = true;
        }

        // This handles any row without a leading "~"
        // These are checkboxes UNLESS a previous [checkbox=off] instruction is still in effect
        if (instruction[0]) {
          let rObj = {
            checkbox,
            isChecked: false,
            required,
            multiColumn,
            text: instruction[0],
            oKey: getKey(instruction[0]),
            desc: getDescription(instruction[0]),
            input: false,
            bold: displayBold,
            style: displayStyle,
            italic: displayItalic
          };
          if (vIndex !== 0 && !doneWithTopBox) {
          }
          else {
            // default the checkbox to checked if either:
            //   a previous instruction set the default for all checkboxes to ON (~[default=checked]), OR
            //   a passed in default for this item instructs AVA to set the checkbox ON
            if (defaultCheckedWords.includes(dValue)
              || (defaults.hasOwnProperty(instruction[0]) && defaultCheckedWords.includes(defaults[instruction[0]]))) {
              delete defaults[instruction[0]];
              if (defaultObj.hasOwnProperty(instruction[0]) && defaultCheckedWords.includes(defaultObj[instruction[0]])) {
                defaultChecked[instruction[0]] = true;    // this handles GLOBAL default "set for all columns" and is used if we add another column later
              }
              rObj.isChecked = true;
              rObj.qualSelections = {};
              let oItem = await getObservationItems(rObj.oKey);
              if (oItem && oItem.hasOwnProperty('options')) {
                defaultQualData[instruction[0]] = await getObservationOptions(oItem.options.observation_key);
                rObj.qualSelections[instruction[0]] = {};
                oItem.options.display_value.forEach(v => {
                  if (v.default) {
                    rObj.qualSelections[instruction[0]][v.title] = {};
                    if (Array.isArray(v.default)) {
                      v.default.forEach(dVal => {
                        rObj.qualSelections[instruction[0]][v.title][dVal] = true;
                      });
                    }
                    else {
                      rObj.qualSelections[instruction[0]][v.title][v.default] = true;
                    }
                  }
                });
              }
            }
          }

          displayRowList.push(rObj);
          continue;
        }

        // Dropping through to here means that instruction[0] was null/blank
        //    (ie. there was nothing before the first "~"; the row started with "~")
        // This handles rows in the form "~<instruction[1]>:<instruction[2]>", for example
        //     "~lambda:<instruction[2]>" or 
        //     "~prompt:Who is this order for?"
        //     "~promptAll:Table Number"
        if (instruction[2]) {
          displayRowList.push({
            checkbox: false,
            required: false,
            multiColumn: false,
            text: instruction[2].trim(),
            textValue: defaults[instruction[2]],
            oKey: instruction[3] || getKey(instruction[2].trim()),
            desc: getDescription(instruction[2]),
            input: instruction[1].trim().toLowerCase(),
            header: false
          });
          if (dValue) { defaults[instruction[2].trim()] = dValue; }
          continue;
        }

        // Dropping through to here means that instruction[2] was also null/blank
        //      so the row looked like "~<instruction[1]>" or "~~<instruction[1]>"
        // Turns out, this is a header line in instruction[1]
        displayRowList.push({
          checkbox: false,
          required: false,
          multiColumn: false,
          text: instruction[1],
          oKey: getKey(instruction[1]),
          desc: getDescription(instruction[1]),
          input: false,
          header: true
        });
        if (dValue) { defaults[instruction[1]] = dValue; }
      };
      return displayRowList;
    }
  }

  React.useEffect(() => {
    async function initialize() {
      await initialLoad();
    }
    if (!reactData.initialLoadComplete) {
      initialize();
    }
  }, [defaultValue]);  // eslint-disable-line react-hooks/exhaustive-deps

  function getKey(pText) {
    if (qualifiers.hasOwnProperty(pText) && qualifiers[pText].qualifiers) {
      let qKey = qualifiers[pText].qualifiers.find(q => { return (q.startsWith('~~key=')); });
      if (qKey) { return qKey.substr(6); }
    }
    return null;
  }

  function getDescription(pText) {
    if (qualifiers.hasOwnProperty(pText)) {
      return qualifiers[pText].description;
    }
    else {
      return null;
    }
  }

  const onCheckEnter = (event, columnNumber, rowNumber) => {
    if (event.key === 'Enter' || event.type === 'blur') {
      if (dataRows.columnList[columnNumber].rowDetails[rowNumber].input === 'date') { handleDateExit(event.target.value, columnNumber, rowNumber); }
      else if (dataRows.columnList[columnNumber].rowDetails[rowNumber].input === 'time') { handleTimeExit(event.target.value, columnNumber, rowNumber); }
      else if (dataRows.columnList[columnNumber].rowDetails[rowNumber].input.toLowerCase() === 'promptall') {
        handleTextAll(event.target.value, dataRows.columnList[columnNumber].rowDetails[rowNumber].text);
      }
      else { handleTextExit(event.target.value, columnNumber, rowNumber); }
    }
    setForceRedisplay(!forceRedisplay);
  };

  const handleChangeTextField = (vText, columnNumber, rowNumber) => {
    // dataRows.columnList[columnNumber].rowDetails[rowNumber].textValue
    if (!dataRows.columnList[columnNumber].rowDetails[rowNumber].hasOwnProperty('textValue')) {
      dataRows.columnList[columnNumber].rowDetails[rowNumber].textValue = {};
    }
    if (!vText || (vText === '')) {
      handleTextExit(vText, columnNumber, rowNumber);
    }
    else {
      if (dataRows.columnList[columnNumber].rowDetails[rowNumber].input === 'date') { handleDateExit(vText, columnNumber, rowNumber); }
      else if (dataRows.columnList[columnNumber].rowDetails[rowNumber].input === 'time') { handleTimeExit(vText, columnNumber, rowNumber); }
      else if (dataRows.columnList[columnNumber].rowDetails[rowNumber].input.toLowerCase() === 'promptall') {
        handleTextAll(vText, dataRows.columnList[columnNumber].rowDetails[rowNumber].text);
      }
      else { handleTextExit(vText, columnNumber, rowNumber); }
    }
    setForceRedisplay(!forceRedisplay);
    return;
  };

  function handleDateExit(vText, columnNumber, rowNumber) {
    let AVAdate = makeDate(vText);
    dataRows.columnList[columnNumber].rowDetails[rowNumber].textValue = AVAdate.absolute;
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  };

  function handleTimeExit(vText, columnNumber, rowNumber) {
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
    dataRows.columnList[columnNumber].rowDetails[rowNumber].textValue = `${hh}:${mm < 10 ? ('0' + mm) : mm} ${ampm}`;
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  };

  function handleTextExit(vText, columnNumber, rowNumber) {
    dataRows.columnList[columnNumber].rowDetails[rowNumber].textValue = vText;
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  };

  function handleTextAll(vText, this_item) {
    dataRows.columnList.forEach(this_column => {
      let rowNumber = this_column.rowDetails.findIndex(r => {
        return (r.text === this_item);
      });
      if (rowNumber >= 0) {
        this_column.rowDetails[rowNumber].textValue = vText;
      }
    });
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  };

  function isQualChecked(pText, columnNumber, rowNumber, pOption, pSelection) {
    let objRef = dataRows.columnList[columnNumber].rowDetails[rowNumber];
    if (!objRef.qualSelections) { return false; }
    if (!objRef.qualSelections.hasOwnProperty(pText)) { return false; }
    if (!objRef.qualSelections[pText].hasOwnProperty(pOption)) { return false; }
    return !!objRef.qualSelections[pText][pOption][pSelection];
  }

  async function itemSelected(columnNumber, rowNumber) {
    if (dataRows.columnList[columnNumber].rowDetails[rowNumber].isChecked) {
      dataRows.columnList[columnNumber].rowDetails[rowNumber].isChecked = false;
    }
    else {
      dataRows.columnList[columnNumber].rowDetails[rowNumber].isChecked = true;
      let keyText = dataRows.columnList[columnNumber].rowDetails[rowNumber].text;
      let oKey = dataRows.columnList[columnNumber].rowDetails[rowNumber].oKey;
      if (!dataRows.qualData) { dataRows.qualData = {}; }
      if (!dataRows.qualData[keyText]) {
        // first time we've seen anybody check off this text in this session
        if (oKey) { dataRows.qualData[keyText] = await getObservationOptions(oKey); }
        else { dataRows.qualData[keyText] = []; }
      }
      if (dataRows.qualData[keyText].length > 0) {
        if (!dataRows.columnList[columnNumber].rowDetails[rowNumber].qualSelections) {
          dataRows.columnList[columnNumber].rowDetails[rowNumber].qualSelections = {};
          if (reactData.defaultQualSelections[keyText]) {
            dataRows.columnList[columnNumber].rowDetails[rowNumber].qualSelections = deepCopy(reactData.defaultQualSelections[keyText]);
          }
          else {
            dataRows.columnList[columnNumber].rowDetails[rowNumber].qualSelections = {};
          }
        }
      }
    }
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  }

  function getQualTextValue(columnNumber, rowNumber, pText, qOpt, qChoice) {
    let objRef = dataRows.columnList[columnNumber].rowDetails[rowNumber];
    if (objRef.qualSelections
      && objRef.qualSelections[pText]
      && objRef.qualSelections[pText][qOpt]) {
      return objRef.qualSelections[pText][qOpt][qChoice] || '';
    }
  }

  function optSelected(columnNumber, rowNumber, pText, qOpt, qChoice, qValueText) {
    // dataRows.columnList[columnNumber].rowDetails[rowNumber].qualSelections[pText][pOption][pSelection]
    let qualRules = dataRows.qualData[pText].find(r => { return r.title === qOpt; });
    let objRef = dataRows.columnList[columnNumber].rowDetails[rowNumber];
    if (!objRef.hasOwnProperty('qualSelections')) {
      objRef.qualSelections = {
        [pText]: {}
      };
    }
    else if (!objRef.qualSelections.hasOwnProperty(pText)) {
      objRef.qualSelections[pText] = {};
    }
    if (!objRef.qualSelections[pText].hasOwnProperty(qOpt)) {
      objRef.qualSelections[pText][qOpt] = {
        [qChoice]: (qValueText || true)
      };
    }
    else {
      if (objRef.qualSelections[pText][qOpt].hasOwnProperty(qChoice)) {
        if (typeof (objRef.qualSelections[pText][qOpt][qChoice]) === 'boolean') {
          objRef.qualSelections[pText][qOpt][qChoice] = !objRef.qualSelections[pText][qOpt][qChoice];
        }
        else { objRef.qualSelections[pText][qOpt][qChoice] = qValueText; }
      }
      else { objRef.qualSelections[pText][qOpt][qChoice] = (qValueText || true); }
    }
    let optionsSelected = [];
    for (let choice in objRef.qualSelections[pText][qOpt]) {
      if (objRef.qualSelections[pText][qOpt][choice]) {
        optionsSelected.push(choice);
      }
    }
    let numberOfSelections = optionsSelected.length;
    if (qualRules.max_allowed && (numberOfSelections > qualRules.max_allowed)) {
      for (let o = 0; ((o < optionsSelected.length) && (numberOfSelections > qualRules.max_allowed)); o++) {
        // too many selections?  turn off the first one we find that isn't the one requested in the function call
        if (optionsSelected[o] !== qChoice) {
          objRef.qualSelections[pText][qOpt][optionsSelected[o]] = false;
          numberOfSelections--;
        }
      }
    }
    if (qualRules.min_required && (numberOfSelections < qualRules.min_required)) {   // not enough selections
      if (qualRules.default && !objRef.qualSelections[pText][qOpt][qualRules.default]) {   // and the default is not selected 
        objRef.qualSelections[pText][qOpt][qualRules.default] = true;
        numberOfSelections++;
      }
      for (let o = 0; ((o < qualRules.option.length) && (numberOfSelections < qualRules.min_required)); o++) {
        // start turning things on until we have enough; but don't touch the one requested in the function call
        if ((!objRef.qualSelections[pText][qOpt][qualRules.option[o].display])
          && (qualRules.option[o].display !== qOpt)
          && (qualRules.option[o].type === 'checkbox')
        ) {
          objRef.qualSelections[pText][qOpt][qualRules.option[o].display] = true;
          numberOfSelections++;
        }
      }
    }
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  }

  const handleAddPersonToList = async (pPeople) => {
    let defaultChecked = dataRows.defaultChecked || { AVA: false };
    let resetSelectedTo;
    let maxLength = maxName;
    for (let pID in pPeople) {
      if (pID.startsWith('GRP//')) {
        let groupParts = pID.split('/');    // this allows for capture of optional client in pID as [client]/group_id
        let gID = groupParts.pop();
        let gClient = groupParts.pop() || state.session.client_id;
        let gObj = await getMemberList(gID, gClient, { 'sort': true });
        gObj.peopleList.forEach(async (person) => {
          await columnAdd(person.name.first.trim() + ' ' + person.name.last.trim(), person.person_id);
        });
      }
      else {
        let nameParts = pPeople[pID].split(',');  // this will produce "first last" regardless of whether it comes in "last, first"
        let fName = nameParts.pop();
        let lName = nameParts.join(' ');
        await columnAdd(fName.trim() + ' ' + lName.trim(), pID);
      }
    }
    setMaxName(maxLength);
    setMorePeople(false);
    setSelectedColumn(resetSelectedTo);
    setDataRows({
      displayRows: dataRows.displayRows,
      dataRows: dataRows.dataRows,
      textValue: dataRows.textValue,
      radioOn: dataRows.radioOn,
      checked: dataRows.checked,
      defaultChecked: dataRows.defaultChecked,
      columnList: dataRows.columnList,
      qualSelections: dataRows.qualSelections,
      qualData: dataRows.qualData,
      selectionList: dataRows.selectionList
    });

    return;

    async function columnAdd(display_name, person_id) {
      let nameWords = display_name.split(/\s+/);
      let [this_id, spliceAfter] = checkDuplicate(person_id);
      let newColumn = {
        person_id: this_id,
        account_id: person_id,
        display_name,
        dName: [' ', ' ', ' '].concat(nameWords)
      };
      if (spliceAfter === 0) {
        dataRows.columnList.push(newColumn);
        if (!resetSelectedTo) {
          resetSelectedTo = dataRows.columnList.length - 1;
        }
      }
      else {
        dataRows.columnList.splice(spliceAfter + 1, 0, newColumn);
        if (!resetSelectedTo) {
          resetSelectedTo = spliceAfter + 1;
        }
      }
      let existingOrder = await checkExistingOrders(this_id, display_name);
      if (existingOrder.status !== 'use existing') {
        dataRows.radioOn[this_id] = deepCopy(defaultChecked);
        for (let dQ in dataRows.qualSelections) {
          dataRows.qualSelections[dQ][person_id] = deepCopy(dataRows.qualSelections[dQ]['_default_']);
        }
      }
      else {
        dataRows.radioOn[this_id] = {};
        existingOrder.requestToUse.original_request.selections.forEach(s => {
          let selection = s.split('(').shift().trim();
          dataRows.radioOn[this_id][selection] = true;
        });
        if (existingOrder.requestToUse.original_request.hasOwnProperty('qualifiers')) {
          /*
             original_request.qualifiers come in as qualifiers.[<Menu choice>][<Qualifier Option>][<array of selections>]
             example 
               [Coffee][How do you like your coffee?][cream, sugar]
            
             and are stored in qualSelections as [<Menu choice>][<Person>][<Qualifier Option>][pSelection]
             example 
               [Coffee][rsteele][How do you like your coffee?][cream] = true
               [Coffee][rsteele][How do you like your coffee?][sugar] = true
          */
          for (let selection in existingOrder.requestToUse.original_request.qualifiers) {
            // add qualData if necessary - qualData describes the options available for anyone that selects this menu item
            if (!dataRows.qualData) { dataRows.qualData = {}; }
            let selection_key = getKey(selection);
            if (!selection_key) {     // you are importing a qualifier that is not part of this request; ignore it
              continue;
            }
            if (!dataRows.qualData[selection]) {
              dataRows.qualData[selection] = await getObservationOptions(getKey(selection));
            }
            // add qualSelections - records the specific choices for this id
            if (!dataRows.qualSelections.hasOwnProperty(selection)) {
              dataRows.qualSelections[selection] = {};   // Menu choice
            }
            if (!dataRows.qualSelections[selection].hasOwnProperty(this_id)) {    // MenuChoice.Person
              dataRows.qualSelections[selection][this_id] = {};
            }
            for (let option in existingOrder.requestToUse.original_request.qualifiers[selection]) {
              if (!dataRows.qualSelections[selection][this_id].hasOwnProperty(option)) {
                dataRows.qualSelections[selection][this_id][option] = {};
              }
              if (Array.isArray(existingOrder.requestToUse.original_request.qualifiers[selection][option])) {
                existingOrder.requestToUse.original_request.qualifiers[selection][option].forEach(choice => {
                  dataRows.qualSelections[selection][this_id][option][choice] = true;
                });
              }
            }
          }
        }
        if (existingOrder.requestToUse.original_request.hasOwnProperty('textInput')) {
          dataRows.textValue[this_id] = deepCopy(existingOrder.requestToUse.original_request.textInput);
        }
      }
      maxLength = Math.max(nameWords.length, maxLength);
      return;

      function checkDuplicate(checkID) {
        let counter = 1;
        let spliceAfter = 0;
        dataRows.columnList.forEach((c, x) => {
          if (c.account_id === checkID) {
            counter++;
            spliceAfter = x;
          }
        });
        if (counter === 1) {
          return [checkID, 0];
        }
        else {
          return [`${checkID}+++${counter}`, spliceAfter];
        }
      }
    }
  };

  async function checkExistingOrders(pPerson, pName) {
    // Does this person already have a request for this requestype and foreignkey?
    let existingRequest = await getServiceRequests({
      client_id: pClient,
      foreign_key,
      request_type: importTypes || reactData.defaultRequestType,
      requestor: pPerson
    });
    if (existingRequest.length > 0) {
      let requestAction = await orderWarning(pName);
      let rTime = makeDate(new Date().getTime());
      switch (requestAction) {
        case 'use': {
          let lastRec = records2Update.push(existingRequest[0]) - 1;
          records2Update[lastRec].history.unshift(`Imported to another order by ${state.session.user_id} on ${rTime.oaDate}`);
          records2Update[lastRec].last_status = 'Imported';
          records2Update[lastRec].last_update = rTime.timestamp;
          setRecords2Update(records2Update);
          return {
            'status': 'use existing',
            'requestToUse': existingRequest[0]
          };
        }
        case 'delete': {
          let lastRec = records2Update.push(existingRequest[0]) - 1;
          records2Update[lastRec].history.unshift(`Replaced by another order on ${rTime.oaDate}`);
          records2Update[lastRec].last_status = 'replaced with new order';
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

    async function orderWarning(pPerson) {
      const showWarning = new Promise((resolve, reject) => {
        let response = '';
        const snackAction = (
          <React-Fragment>
            <Button className={AVAClass.AVAButton}
              style={{ backgroundColor: 'green', color: 'white' }}
              size='small'
              onClick={() => { response = 'use'; resolve(response); }}
            >
              Use the order
            </Button>
            <Button className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={() => { response = 'delete'; resolve(response); }}
            >
              Delete the order
            </Button>
            <Button className={AVAClass.AVAButton}
              style={{ backgroundColor: 'blue', color: 'white' }}
              size='small'
              onClick={() => { response = 'keep'; resolve(response); }}
            >
              Keep the order and create another one, too
            </Button>
          </React-Fragment>
        );
        enqueueSnackbar(
          `AVA found an existing order for ${pPerson}.  What would you like to do?`,
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

    for (let columnNumber = 0; columnNumber < pData.columnList.length; columnNumber++) {
      let selections = [];
      let options = {};
      let textInput = {};
      let oBo;
      let this_column = pData.columnList[columnNumber];
      if (this_column.person_id) {
        oBo = await makeName(this_column.person_id);
      }
      else {
        oBo = await makeName(reactData.defaultPerson ? reactData.defaultPerson.person_id : state.patient);
      }
      for (let rowNumber = 0; rowNumber < this_column.rowDetails.length; rowNumber++) {
        let this_row = this_column.rowDetails[rowNumber];
        if (this_row.isChecked) {
          let choices_list = [];
          for (let this_key in this_row.qualSelections) {
            for (let this_option in this_row.qualSelections[this_key]) {
              for (let this_choice in this_row.qualSelections[this_key][this_option]) {
                if (!options.hasOwnProperty(this_row.text)) {
                  options[this_row.text] = {};
                }
                if (!options[this_row.text].hasOwnProperty(this_key)) {
                  options[this_row.text][this_key] = {};
                }
                options[this_row.text][this_key][this_option] = this_choice;
                if (typeof (this_row.qualSelections[this_key][this_option][this_choice]) === 'boolean') {
                  choices_list.push(this_choice);
                }
                else {
                  choices_list.push(this_row.qualSelections[this_key][this_option][this_choice]);
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
          if (this_column.defaultValues.hasOwnProperty('onBehalfOf') && (this_column.defaultValues['onBehalfOf'] === this_row.text)) {
            oBo = this_row.textValue;
          }
          else {
            textInput[this_row.text] = this_row.textValue;
          }
        }
      }
      if ((selections.length > 0) || (Object.keys(textInput).length > 0)) {
        let result = await putServiceRequest(
          {
            client: state.session.client_id,
            author: this_column.person_id || state.session.patient_id,
            proxy_user: state.session.user_id,
            requestType: this_column.requestType,
            activity_key: this_column.activity_key,
            onBehalfOf: oBo,
            foreign_key: this_column.foreignKey,
            request: {
              selections,
              options,
              textInput
            },
            messaging: (fact.messaging.format.type !== 'mealTicket' ? fact.messaging : null),
            local_key
          });
        local_key = result.requestRec.local_key;
        message_body = result.body;
        writtenRecords.push(result.requestRec);
      }
    };
    // print tickets...
    let formatCallObj = {
      local_key,
      client_id: pClient,
      client_name: state.session.client_name
    };
    if (fact.messaging) {
      if (!fact.messaging.format.hasOwnProperty('logo') || fact.messaging.format.logo) {
        formatCallObj.logo = state.session.client_logo;
        formatCallObj.logo_dimensions = state.session.logo_dimensions;
      }
      if (!fact.messaging.format.hasOwnProperty('initials') || fact.messaging.format.initials) {
        formatCallObj.initials = true;
      }
      let html, plain, attachment;
      switch (fact.messaging.format.type) {
        case 'mealTicket':
          {
            [html, plain, attachment] = await mealTicketFormat(formatCallObj);
            break;
          }
        default: { }
      }
      if (html) {  // if there is a message to send, send it and update all the Service Request records to show that it was sent
        // prepare message that contains the tickets (one for the whole group)
        message_body.messaging = deepCopy(fact.messaging);
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
              last_status = 'Sent';
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
      if (records2Update.length > 0) { await updateServiceRequest(records2Update); }
    }
  }

  function makeConfirm(pData) {
    let warningsExist = false;
    let dataExists = false;
    let warningSection = [`[bold][italic]There are no selections for:`, ' '];
    let responseArray = [`[bold][italic]AVA will send the following:`];
    let everyoneText = [];
    if (pData.textValue && pData.textValue.hasOwnProperty('*all*')) {
      Object.keys(pData.textValue['*all*']).forEach(prompt => {
        everyoneText.push(`[indent=1]${prompt}: ${pData.textValue['*all*'][prompt]}`);
      });
    }
    pData.columnList.forEach(this_column => {
      // what is checked off in this column?
      // columnList[columnNumber].rowDetails[rowNumber].isChecked
      let selectionText = [];
      let inputText = [];
      this_column.rowDetails.forEach(this_row => {
        if (this_row.isChecked) {
          selectionText.push(`[style={size:1}]${titleCase(this_row.text)}`);
          for (let this_key in this_row.qualSelections) {
            if (this_key !== this_row.text) {
              selectionText.push(titleCase(this_key));
            }
            for (let this_option in this_row.qualSelections[this_key]) {
              for (let this_choice in this_row.qualSelections[this_key][this_option]) {
                let choices_list = [];
                if (typeof (this_row.qualSelections[this_key][this_option][this_choice]) === 'boolean') {
                  choices_list.push(this_choice);
                }
                else {
                  choices_list.push(this_row.qualSelections[this_key][this_option][this_choice]);
                }
                if (choices_list.length > 0) {
                  selectionText.push(`[indent=1][italic][style={size:0.4}]${choices_list.join('; ')}`);
                }
              }
            }
          }
        }
        if (this_row.textValue) {
          // special Values/
          if (this_column.defaultValues.hasOwnProperty('onBehalfOf') && (this_column.defaultValues['onBehalfOf'] === this_row.text)) {
            inputText.push(`[style={size:1}]for ${sentenceCase(this_row.textValue)}`);
          }
          else {
            inputText.push(`[style={size:1}]${this_row.textValue}`);
          }
        }
      });
      // that's all the rows for this column
      let columnName = this_column.dName.slice(-3).join(' ');
      if (selectionText.length === 0) {
        warningSection.push(`[bold]${columnName}`);
        warningsExist = true;
      }
      else {
        responseArray.push(`[bold]${columnName}`);
        responseArray.push(...inputText);
        responseArray.push(...selectionText);
        responseArray.push('[style = { bottom: 3 }] ');
        dataExists = true;
      }
    });
    let returnArray = ['Selection summary'];
    if (warningsExist) { returnArray.push(...warningSection); }
    if (dataExists) { returnArray.push(...responseArray); }
    return ['confirm', returnArray];
  };

  return (
    <Dialog
      open={true || forceRedisplay}
      p={2}
      fullScreen
    >
      {!!dataRows && dataRows.hasOwnProperty('displayRows') && dataRows.displayRows.length > 0 &&
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
            borderBottom={(dataRows.columnList.length <= 1) ? 2 : 0}
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
                  size: ((dataRows.columnList && (!dataRows.columnList[selectedColumn].person_id || (dataRows.columnList.length === 1))) ? 1 : 1.3),
                  bold: true
                })}
              >
                {`${factName}`}
              </Typography>
              {dataRows.columnList &&
                ((!dataRows.columnList[selectedColumn].person_id) ?
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
                    {`for ${(reactData.defaultPerson ? reactData.defaultPerson.name.first : state.patient.name.first)} ${(reactData.defaultPerson ? reactData.defaultPerson.name.last : state.patient.name.last)}`}
                  </Typography>
                  : ((dataRows.columnList.length === 1) ?
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
                      {`for ${dataRows.columnList[selectedColumn].display_name}`}
                    </Typography>
                    : null
                  )
                )
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

          { /* MAIN */}

          { /* Selection Row */}
          {(dataRows.columnList.length > 1) &&
            <Box display='flex'
              flexDirection='row'
              marginRight={0}
              marginLeft={0}
              marginTop={0}
              marginBottom={0}
              borderBottom={2}
              padding={1}
              key={'peopleSelectionBox'}
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
                    alignItems='flex-start'
                  >
                    <Typography key={`selectWord`} className={classes.smallTextLine}>{'Select'}</Typography>
                  </Box>
                  {dataRows.columnList.map((this_column, this_columnNumber) => (
                    <Box
                      display='flex'
                      flexDirection='column'
                      minWidth={50}
                      maxWidth={50}
                      key={`radiobox-rowP-col${this_columnNumber}`}
                      className={classes.listItem}
                      justifyContent='flex-end'
                      alignItems='center'
                    >
                      {(dataRows.hasOwnProperty('textValue')
                        && dataRows.textValue.hasOwnProperty(this_column.column_id)
                        && dataRows.textValue[this_column.column_id].hasOwnProperty('Seat Assignment')
                        && (dataRows.textValue[this_column.column_id]['Seat Assignment'])
                        && (dataRows.textValue[this_column.column_id]['Seat Assignment'] !== ''))
                        ?
                        <Box
                          mt={0}
                          mb={1}
                          minWidth={50}
                          maxWidth={50}
                          minHeight={50}
                          maxHeight={50}
                          display='flex'
                          flexDirection='row'
                          justifyContent='center'
                          alignItems='center'
                        >
                          <Typography key={`number-${this_columnNumber}`} style={AVATextStyle({ size: 2, bold: true })}>
                            {dataRows.textValue[this_column.column_id]['Seat Assignment'].slice(0, 2)}
                          </Typography>
                        </Box>
                        :
                        (this_column.person_id
                          ?
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
                          :
                          null
                        )
                      }
                      {this_column.dName.slice(-1 * Math.min(maxName, 3)).map((n, nx) => (
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
            {(dataRows.columnList.length > 0) &&
              (dataRows.columnList[selectedColumn].rowDetails).map((this_item, this_index) => (
                <Box display='flex'
                  flexDirection='column'
                  borderRadius={'16px'}
                  marginLeft={2}
                  marginRight={2}
                  marginBottom={(this_item.header ? 0 : 0.5)}
                  paddingBottom={(this_item.header ? 0 : 1)}
                  marginTop={(this_item.header ? 0 : 0.5)}
                  paddingTop={(this_item.header ? 0 : 1)}
                  border={(this_item.isChecked || (this_item.textValue && (this_item.textValue !== ''))) ? 1 : 'none'}
                  key={`rowboxwrap_${selectedColumn}.${this_index}-${this_item.isChecked}`}
                  id={`rowboxwrap_${selectedColumn}.${this_index}-${this_item.isChecked}`}
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
                    {this_item.input &&
                      <TextField
                        className={classes.freeInput}
                      variant={'standard'}
                      key={`inputtextprompt_${selectedColumn}.${this_index}`}
                      id={`inputtextprompt_${selectedColumn}.${this_index}`}
                        helperText={this_item.text}
                        multiline
                        inputProps={{ style: { fontSize: `${user_fontSize * 1}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                        onChange={event => (handleChangeTextField(event.target.value, selectedColumn, this_index))}
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
                    && dataRows.qualData.hasOwnProperty(this_item.text)
                    && dataRows.qualData[this_item.text].map((qR, qRndx) => (
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
                                        optSelected(selectedColumn, this_index, this_item.text, qR.title, opt.display);
                                      }}
                                      checked={isQualChecked(this_item.text, selectedColumn, this_index, qR.title, opt.display)}
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
                                      checked={isQualChecked(this_item.text, selectedColumn, this_index, qR.title, opt.display)}
                                    />
                                    <Typography style={AVATextStyle({ size: 0.75, margin: { top: 0.5, bottom: 0.5, left: 0.3, right: 3 } })}>{opt.display}</Typography>
                                    <TextField
                                      key={`optionpromptchecktext_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.isChecked}`}
                                      id={`optionpromptchecktext_${selectedColumn}.${this_index}.${qRndx}.${oX}-${this_item.isChecked}`}
                                      style={AVATextStyle({ size: 0.75, margin: { top: 0.5, bottom: 0.5, left: 0.3, right: 3 } })}
                                      defaultValue={getQualTextValue(selectedColumn, this_index, this_item.text, qR.title, opt.display)}
                                      variant={'standard'}
                                      multiline
                                      onChange={(event) => {
                                        optSelected(selectedColumn, this_index, this_item.text, qR.title, opt.display, event.target.value);
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
              ))
            }
          </Paper>

          { /* Prompt for People */}
          {(dataRows.columnList.length < 1) &&
            <PersonFilter
              prompt={'Select from this list'}
              peopleList={dataRows.selectionList}
              onCancel={() => {
                onClose();
              }}
              onSelect={async (selectedPeople) => {
                await handleAddPersonToList(selectedPeople);
              }}
              allowRandom={true}
              multiSelect={true}
              returnValue={'object'}
            />
          }
          {(dataRows.columnList.length > 0)
            && dataRows.selectionList
            && (dataRows.selectionList.length > 0)
            &&
            <PersonFilter
              prompt={'Select from this list'}
              peopleList={dataRows.selectionList}
              onCancel={() => {
                delete dataRows.selectionList;
                setDataRows(dataRows);
              }}
              onSelect={async (selectedID) => {
                delete dataRows.selectionList;
                let selectedPerson = await getPerson(selectedID);
                dataRows.columnList.forEach((column, c) => {
                  dataRows.columnList[c].person_id = selectedID;
                });
                setDataRows(dataRows);
                updateReactData({
                  defaultPerson: selectedPerson
                }, true);
              }}
              allowRandom={true}
              multiSelect={false}
              returnValue={'id'}
            />
          }

          { /* Prompt for People */}
          {morePeople &&
            <PersonFilter
              prompt={'Select diners'}
              peopleList={state.accessList[state.session.client_id].shortList}
              onCancel={() => {
                setMorePeople(false);
              }}
              onSelect={async (selectedPeople) => {
                await handleAddPersonToList(selectedPeople);
              }}
              allowRandom={true}
              multiSelect={true}
              returnValue={'object'}
            />
          }

          { /* Prompts */}
          {
            cancelPending &&
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
          {
            confirmDelete &&
            <AVAConfirm
              promptText={`Please confirm removing ${dataRows.columnList[selectedColumn].display_name}`}
              cancelText={'No, go back'}
              confirmText={`Yes, remove ${dataRows.columnList[selectedColumn].display_name}`}
              onCancel={() => {
                setConfirmDelete(false);
              }}
              onConfirm={() => {
                dataRows.columnList.splice(selectedColumn, 1);
                if (selectedColumn > 0) { setSelectedColumn(selectedColumn - 1); }
                setDataRows(dataRows);
                setConfirmDelete(false);
                setForceRedisplay(forceRedisplay => !forceRedisplay);
              }}
            >
            </AVAConfirm>
          }
          {
            (confirmStatus === 'confirm') &&
            <AVAConfirm
              promptText={confirmPrompt}
              cancelText={'Go back'}
              confirmText={'Save/Send'}
              onCancel={() => { setConfirmStatus(''); }}
              onConfirm={async () => {
                await sendRequests(dataRows);
                onSave();
              }}
            />
          }
          {
            (confirmStatus === 'error') &&
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
                {(!factType || (factType !== 'list')) &&
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'green', color: 'white' }}
                    size='small'
                    onClick={() => {
                      let [cStatus, response] = makeConfirm(dataRows);
                      setConfirmPrompt(response);
                      setConfirmStatus(cStatus);
                    }}
                    startIcon={<CheckIcon size="small" />}
                  >
                    {'Confirm/Send'}
                  </Button>
                }
              </Box>
              {(allowAddPeople || (allowRemovePeople && (dataRows.columnList.length > 1))) &&
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
                  {allowRemovePeople && (dataRows.columnList.length > 1) &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'red', color: 'white' }}
                      size='small'
                      onClick={() => {
                        setConfirmDelete(true);
                      }}
                      startIcon={<DeleteIcon size="small" />}
                    >
                      {`Remove ${dataRows.columnList[selectedColumn].display_name}`}
                    </Button>
                  }
                </Box>
              }
            </Box>
          </DialogActions>
        </React.Fragment>
      }
    </Dialog >
  );

};
