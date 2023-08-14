import React from 'react';

import { makeName, getImage } from '../../util/AVAPeople';
import { getMemberList } from '../../util/AVAGroups';
import { listFromArray } from '../../util/AVAUtilities';
import { getObservationOptions } from '../../util/AVAObservations';
import { makeDate } from '../../util/AVADateTime';
import { putServiceRequest, getServiceRequests, updateServiceRequest } from '../../util/AVAServiceRequest';
import PersonFilter from '../forms/PersonFilter';
import AVATextInput from '../forms/AVATextInput';
import { useSnackbar } from 'notistack';

import useSession from '../../hooks/useSession';
import TextField from '@material-ui/core/TextField';

import makeStyles from '@material-ui/core/styles/makeStyles';
import Tooltip from '@material-ui/core/Tooltip';

import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import CloseIcon from '@material-ui/icons/HighlightOff';
import CheckIcon from '@material-ui/icons/Check';
import EditIcon from '@material-ui/icons/Edit';
import NotesIcon from '@material-ui/icons/Notes';
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

import { AVAclasses } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  textLine: {
    fontSize: theme.typography.fontSize * 1.3,
    flexGrow: 0,
    lineHeight: 1.0,
    marginRight: '7px'
  },
  smallTextLine: {
    fontSize: theme.typography.fontSize * 1.0,
    flexGrow: 0,
    lineHeight: 1.25,
    whiteSpace: 'break-spaces'
  },
  headerLine: {
    marginTop: theme.spacing(3.0),
    marginBottom: theme.spacing(1.0),
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold'
  },
  headerLineSticky: {
    marginTop: theme.spacing(1.0),
    marginBottom: theme.spacing(1.0),
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold'
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    marginBottom: 0,
    marginTop: 0,
    paddingLeft: 0,
    paddingRight: 50,
  },
  descText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(3),
    marginBottom: 10,
    marginTop: 0,
    paddingLeft: 0,
    paddingRight: 50,
  },
  messageArea: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1)
  },
  profileArea: {
    alignItems: 'center'
  },
  popUpMenu: {
    marginRight: theme.spacing(3),
    paddingRight: 2,
  },
  popUpMenuRow: {
    marginLeft: theme.spacing(1),
    fontSize: theme.typography.fontSize * 1.0,
  },
  popUpFooter: {
    fontSize: theme.typography.fontSize * 0.8,
  },

  qualText: {
    fontSize: theme.typography.fontSize * 1.0,
    marginLeft: 0,
    marginBottom: 0,
    marginTop: 10,
    paddingLeft: 0,
    paddingRight: 50,
    fontWeight: 'bold'
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
  },
  freeInput: {
    marginLeft: 20,
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
    width: 'max-content'
  },
  listItemSticky: {
    marginLeft: theme.spacing(1),
    marginRight: 0,
    padding: theme.spacing(1),
    position: 'sticky',
    background: 'lightgray',
    top: 0,
    opacity: 1,
    zIndex: 1,
    width: 'max-content'
  },
  page: {
    height: 950,
  },
  qualOption: {
    marginTop: 0,
    marginLeft: theme.spacing(3),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: theme.typography.fontSize * 0.8
  },
  qualItem: {
    marginTop: 0,
    marginLeft: theme.spacing(3),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: theme.typography.fontSize * 0.8
  },
  title: {
    marginTop: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginBottom: 0,
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold',
  },
  subTitle: {
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
    marginLeft: theme.spacing(2),
    fontSize: theme.typography.fontSize * 1.2
  },
  buttonArea: {
    maxWidth: 1000,
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  }
}));

export default ({ fact, factName, defaultValue, prompt, pClient, qualifiers, listValues, onSave, onClose }) => {

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { state } = useSession();

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [cancelPending, setCancelPending] = React.useState(false);
  const [confirmStatus, setConfirmStatus] = React.useState('');
  const [confirmPrompt, setConfirmPrompt] = React.useState(false);
  const [morePeople, setMorePeople] = React.useState(false);

  const [request_type, setRequestType] = React.useState('');
  const [foreign_key, setForeignKey] = React.useState('');
  const [records2Update, setRecords2Update] = React.useState([]);

  const [promptForText, setPromptForText] = React.useState({});

  const [textInput, setTextInput] = React.useState();
  const [initialLoadComplete, setLoadComplete] = React.useState();
  const [dataRows, setDataRows] = React.useState();

  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [maxName, setMaxName] = React.useState(1);

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

  let displayRowList = [];
  let selectionList = [];
  let checkbox = true;
  let ignore = false;
  let required = false;
  let displayBold = false;
  let displayItalic = false;
  let doneWithTopBox = false;
  const defaultCheckedWords = ['checked', 'on', 'selected', 'true'];

  if (!initialLoadComplete) {
    let columnList = [];
    setForeignKey('*tbd');
    setRequestType(fact.activity_key.split('.').pop());
    if (fact.value.freeText) {
      if ('foreignKey' in fact.value.freeText) { setForeignKey(fact.value.freeText.foreignKey); }
      if ('requestType' in fact.value.freeText) { setRequestType(fact.value.freeText.requestType); }
    }
    let defaultObj = {};
    let defaultChecked = { AVA: false };
    if (defaultValue) {
      (Array.isArray(defaultValue) ? [...defaultValue] : [defaultValue]).forEach(i => {
        if (typeof i === 'string') {
          let [key, value] = i.split('=');
          defaultObj[key] = value;
        }
        else {
          if (typeof i === 'object' && i.peopleList) {
            columnList = i.peopleList.peopleList;
          }
          else if (typeof i === 'object' && i.selectionList) {
            selectionList = i.selectionList;
          }
        }
      });
    }
    for (let vIndex = 0; vIndex < listValues.length; vIndex++) {
      // All rows are evaluated as follows "<instruction[0]>~<instruction[1]>:<instruction[2]>"
      // OR... "<instruction[0]>~~<instruction[1]>" (instruction[0] expected to be null/blank in this case)
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
          case 'required': {
            required = (oValue.toLowerCase() === 'on');
            break;
          }
          case 'bold': {
            displayBold = (oValue.toLowerCase() === 'on');
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
      if (instruction[0]) {
        if (vIndex !== 0 && !doneWithTopBox) {
          displayRowList[0].text += `\n${instruction[0]}`;
        }
        else {
          displayRowList.push({
            checkbox,
            required,
            text: instruction[0],
            oKey: getKey(instruction[0]),
            desc: getDescription(instruction[0]),
            input: false,
            bold: displayBold,
            italic: displayItalic
          });
          // default the checkbox to checked if either:
          //   a previous instruction set the default for all checkboxes to ON (~[default=checked]), OR
          //   a passed in default for this item instructs AVA to set the checkbox ON
          if (defaultCheckedWords.includes(dValue)
            || (defaultObj.hasOwnProperty(instruction[0]) && defaultCheckedWords.includes(defaultObj[instruction[0]]))) {
            defaultChecked[instruction[0]] = true;
          }
        };
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
          text: instruction[2].trim(),
          oKey: instruction[3] || getKey(instruction[2].trim()),
          desc: getDescription(instruction[2]),
          input: instruction[1].trim().toLowerCase(),
          header: false
        });
        if (dValue) { defaultObj[instruction[2].trim()] = dValue; }
        continue;
      }

      // Dropping through to here means that instruction[2] was also null/blank
      //      so the row looked like "~<instruction[1]>" or "~~<instruction[1]>"
      // Turns out, this is a header line in instruction[1]
      displayRowList.push({
        checkbox: false,
        required: false,
        text: instruction[1],
        oKey: getKey(instruction[1]),
        desc: getDescription(instruction[1]),
        input: false,
        header: true
      });
      if (dValue) { defaultObj[instruction[1]] = dValue; }
    };
    setTextInput(defaultObj);

    // We'll pre-load the radio checkboxes and do a little manipulation on the names for display purposes
    let radioOn = {};
    let maxLength = 1;
    let textValue = {};
    columnList.forEach((c, x) => {
      radioOn[c.person_id] = Object.assign({}, defaultChecked);
      if (c.hasOwnProperty('defaultValues')) {  // if this person carried global default values
        // for every row in the displayRowList, check for a defaultvalue for this person
        // if such a value is found, preload it
        displayRowList.forEach((r, rx) => {
          if (c.defaultValues.hasOwnProperty(r.text)) {
            if (!textValue.hasOwnProperty(c.person_id)) { textValue[c.person_id] = {}; }
            textValue[c.person_id][r.text] = c.defaultValues[r.text];
          }
        });
      }
      let a = c.display_name.split(' ');
      maxLength = Math.max(a.length, maxLength);
      columnList[x].dName = [' ', ' ', ' '].concat(a);
    });
    setMaxName(maxLength);

    setDataRows({
      displayRows: displayRowList,
      dataRows: {},
      textValue,
      radioOn,
      checked: Object.keys(defaultChecked),
      qualSelections: {},
      columnList: columnList,
      selectionList: selectionList
    });
    setLoadComplete(true);
  }

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

  function isChecked(pText) {
    let numberOn = 0;
    let numberOfPeople = Object.keys(dataRows.radioOn).length;
    for (let person in dataRows.radioOn) {
      if (dataRows.radioOn[person][pText]) { numberOn++; }
    }
    if (numberOn === 0) { return 'none'; }
    else if (numberOn < numberOfPeople) { return 'some'; }
    else { return 'all'; }
  }

  function isQualChecked(pText, pPerson, pOption, pSelection) {
    if (!dataRows.hasOwnProperty('qualSelections')) { return false; }
    if (!dataRows.qualSelections.hasOwnProperty(pText)) { return false; }
    if (!dataRows.qualSelections[pText].hasOwnProperty(pPerson)) { return false; }
    if (!dataRows.qualSelections[pText][pPerson].hasOwnProperty(pOption)) { return false; }
    if (!dataRows.qualSelections[pText][pPerson][pOption].hasOwnProperty(pSelection)) { return false; }
    return !!dataRows.qualSelections[pText][pPerson][pOption][pSelection];
  }

  function textPresent(pText, pPerson) {
    if (!pPerson) {
      for (let person in dataRows.radioOn) {
        if (dataRows.textValue && dataRows.textValue[person] && dataRows.textValue[person][pText]
          && (dataRows.textValue[person][pText].trim() !== '')) { return true; }
      }
    }
    else {
      if (dataRows.textValue && dataRows.textValue[pPerson] && dataRows.textValue[pPerson][pText]
        && (dataRows.textValue[pPerson][pText].trim() !== '')) { return true; }
    }
    return false;
  }

  async function itemSelected(pPerson, pObs, pDisplayName) {
    dataRows.optNeeded = [];
    if ((!dataRows.radioOn[pPerson].hasOwnProperty(pObs.text))
      || (!dataRows.radioOn[pPerson][pObs.text])) {
      dataRows.radioOn[pPerson][pObs.text] = true;
      if (!dataRows.qualData) { dataRows.qualData = {}; }
      if (!dataRows.qualData[pObs.text]) {
        if (pObs.oKey) { dataRows.qualData[pObs.text] = await getObservationOptions(pObs.oKey); }
        else { dataRows.qualData[pObs.text] = []; }
      }
      if (dataRows.qualData[pObs.text].length > 0) {
        if (!dataRows.qualSelections) { dataRows.qualSelections = {}; }
        if (!dataRows.qualSelections[pObs.text]) { dataRows.qualSelections[pObs.text] = {}; }
        if (!dataRows.qualSelections[pObs.text][pPerson]) { dataRows.qualSelections[pObs.text][pPerson] = {}; }
        dataRows.optNeeded = [pObs.text, pPerson, pDisplayName];
      }
    }
    else {
      dataRows.radioOn[pPerson][pObs.text] = false;
    }
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  }

  function optSelected(qOpt, qChoice, qValue) {
    let [pObsText, pPerson,] = dataRows.optNeeded;
    let sArray = [];
    if (pPerson === '*all') {
      if (!dataRows.hasOwnProperty('textValue')) { dataRows.textValue = {}; }
      if (!dataRows.textValue.hasOwnProperty('*all*')) {
        dataRows.textValue['*all*'] = {};
      }
      dataRows.textValue['*all*'][pObsText] = qValue || qChoice;
    }
    else {
      sArray = dataRows.qualSelections[pObsText][pPerson];
      if (!sArray.hasOwnProperty(qOpt)) {
        sArray[qOpt] = {};
        sArray[qOpt][qChoice] = (qValue || true);
      }
      else {
        if (sArray[qOpt].hasOwnProperty(qChoice)) {
          if (typeof (sArray[qOpt][qChoice]) === 'boolean') {
            sArray[qOpt][qChoice] = !sArray[qOpt][qChoice];
          }
          else { sArray[qOpt][qChoice] = qValue; }
        }
        else { sArray[qOpt][qChoice] = (qValue || true); }
      }
      dataRows.qualSelections[pObsText][pPerson] = sArray;
    }
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  }

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

  function checkDuplicate(checkID) {
    let counter = 1;
    let spliceAfter = 0;
    dataRows.columnList.forEach((c, x) => {
      if (c.account_id === checkID) { counter++; spliceAfter = x; }
    });
    if (counter === 1) { return [checkID, spliceAfter]; }
    else { return [`${checkID}+++${counter}`, spliceAfter]; }
  }

  const handleAddPersonToList = async (pPeople) => {
    let defaultChecked = { AVA: false };
    let qualChecked = {};
    let x = dataRows.columnList.length;
    let maxLength = maxName;
    for (let pID in pPeople) {
      if (!pID.startsWith('GRP//')) {
        let nameParts = pPeople[pID].split(',');
        let fName = nameParts.pop();
        let lName = nameParts.join(' ');
        let display_name = fName.trim() + ' ' + lName.trim();
        let a = display_name.split(/\s+/);
        let [this_id, spliceAfter] = checkDuplicate(pID);
        let newColumn = {
          person_id: this_id,
          account_id: pID,
          display_name,
          dName: [' ', ' ', ' '].concat(a)
        };
        if (spliceAfter === 0) { dataRows.columnList[x++] = newColumn; }
        else { dataRows.columnList.splice(spliceAfter + 1, 0, newColumn); }
        [defaultChecked, qualChecked] = await checkExistingOrders(this_id, display_name);
        dataRows.radioOn[this_id] = Object.assign({}, defaultChecked);
        dataRows.qualSelections = Object.assign(dataRows.qualSelections, qualChecked);
        maxLength = Math.max(a.length, maxLength);
      }
      else {
        let groupParts = pID.split('/');
        let gID = groupParts.pop();
        let gClient = groupParts.pop() || state.session.client_id;
        let gObj = await getMemberList(gID, gClient, { 'sort': true });
        // eslint-disable-next-line
        for (let l = 0; l < gObj.peopleList.length; l++) {
          defaultChecked = { AVA: false };
          let p = gObj.peopleList[l];
          let display_name = p.name.first.trim() + ' ' + p.name.last.trim();
          let a = display_name.split(/\s+/);
          let [this_id, spliceAfter] = checkDuplicate(p.person_id);
          let newColumn = {
            person_id: this_id,
            account_id: p.person_id,
            display_name,
            dName: [' ', ' ', ' '].concat(a)
          };
          if (spliceAfter === 0) { dataRows.columnList[x++] = newColumn; }
          else { dataRows.columnList.splice(spliceAfter + 1, 0, newColumn); }
          [defaultChecked, qualChecked] = await checkExistingOrders(this_id, p.display_name);
          dataRows.radioOn[this_id] = Object.assign({}, defaultChecked);
          dataRows.qualSelections = Object.assign(dataRows.qualSelections, qualChecked);
          maxLength = Math.max(a.length, maxLength);
        };
      }
    }

    setMaxName(maxLength);
    setMorePeople(false);
    setDataRows({
      displayRows: dataRows.displayRows,
      dataRows: dataRows.dataRows,
      textValue: dataRows.textValue,
      radioOn: dataRows.radioOn,
      checked: dataRows.checked,
      columnList: dataRows.columnList,
      qualSelections: dataRows.qualSelections,
      selectionList: dataRows.selectionList
    });
  };

  async function checkExistingOrders(pPerson, pName) {
    // Does this person already have a request for this requestype amd foreignkey?
    let defaultChecked = { AVA: false };
    let qualChecked = {};
    let existingRequest = await getServiceRequests({
      client_id: pClient,
      foreign_key,
      request_type,
      requestor: pPerson
    });
    if (existingRequest.length > 0) {
      let requestAction = await orderWarning(pName);
      let rTime = makeDate(new Date().getTime());
      switch (requestAction) {
        case 'use': {
          let lastRec = records2Update.push(existingRequest[0]) - 1;
          records2Update[lastRec].history.unshift(`Updated by ${fact.session.user_id} on ${rTime.oaDate}`);
          records2Update[lastRec].last_status = 'updated';
          records2Update[lastRec].last_update = rTime.timestamp;
          setRecords2Update(records2Update);
          // eslint-disable-next-line
          existingRequest[0].original_request.selections.forEach(s => {
            let [selection, options] = s.split(/[()]/);
            defaultChecked[selection.trim()] = true;
            console.log(options);
          });
          if (existingRequest[0].original_request.hasOwnProperty('options')) {
            for (let selection in existingRequest[0].original_request.options) {
              if (!qualChecked.hasOwnProperty(selection)) { qualChecked[selection] = {}; }
              if (!qualChecked[selection].hasOwnProperty(pPerson)) { qualChecked[selection][pPerson] = {}; }
              for (let option in existingRequest[0].original_request.options[selection]) {
                if (!qualChecked[selection][pPerson].hasOwnProperty(option)) { qualChecked[selection][pPerson][option] = {}; }
                for (let choice in existingRequest[0].original_request.options[selection][option]) {
                  if (typeof (existingRequest[0].original_request.options[selection][option][choice]) === 'boolean') {
                    qualChecked[selection][pPerson][option][choice] = true;
                  }
                  else {
                    qualChecked[selection][pPerson][option][choice] = existingRequest[0].original_request.options[selection][option][choice];
                  }
                }
              }
            }
          };
          break;
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
    return [defaultChecked, qualChecked];
  }

  function isRadioSelected(person, item) {
    return (dataRows.radioOn[person].hasOwnProperty(item) && dataRows.radioOn[person][item]);
  }

  async function sendRequests(pData) {
    let oBo;
    let everyoneText = {};
    if (pData.textValue && pData.textValue.hasOwnProperty('*all*')) {
      Object.keys(pData.textValue['*all*']).forEach(prompt => {
        everyoneText[prompt] = pData.textValue['*all*'][prompt];
      });
    }
    let writtenRecords = [];
    let local_key = null;
    let message_body;
    for (let a = 0; a < dataRows.columnList.length; a++) {
      let c = dataRows.columnList[a];
      oBo = await makeName(c.person_id);
      let radioChecked = [];
      let optionObj = {};
      Object.keys(pData.radioOn[c.person_id]).forEach(r => {
        if (pData.radioOn[c.person_id][r]) {
          let optionsText = '';
          if (pData.qualSelections && pData.qualSelections[r] && pData.qualSelections[r][c.person_id]) {
            Object.keys(pData.qualSelections[r][c.person_id]).forEach(opt => {
              let oList = [];
              Object.keys(pData.qualSelections[r][c.person_id][opt]).forEach(key => {
                if (typeof (pData.qualSelections[r][c.person_id][opt][key]) === 'boolean') {
                  if (!!pData.qualSelections[r][c.person_id][opt][key]) {
                    oList.push(key);
                    if (!optionObj.hasOwnProperty(r)) { optionObj[r] = {}; }
                    if (!optionObj[r].hasOwnProperty(opt)) { optionObj[r][opt] = {}; }
                    optionObj[r][opt][key] = true;
                  };
                }
                else {
                  oList.push(`${key} ${pData.qualSelections[r][c.person_id][opt][key]}`);
                  if (!optionObj.hasOwnProperty(r)) { optionObj[r] = {}; }
                  if (!optionObj[r].hasOwnProperty(opt)) { optionObj[r][opt] = {}; }
                  optionObj[r][opt][key] = pData.qualSelections[r][c.person_id][opt][key];
                }
              });
              if (oList.length > 0) { optionsText += ` (${listFromArray(oList)})`; }
            });
          }
          radioChecked.push(r + optionsText);
        }
        return;
      });
      let textExists = false;
      let textObj = {};
      if (pData.textValue && pData.textValue.hasOwnProperty(c.person_id)) {
        Object.keys(pData.textValue[c.person_id]).forEach(textIn => {
          if (pData.textValue[c.person_id][textIn].trim() !== '') {
            textExists = true;
            textObj[textIn] = pData.textValue[c.person_id][textIn];
          }
        });
      }
      if ((radioChecked.length > 0) || textExists) {
        delete textInput['requestType'];
        let requestObj = { 'selections': radioChecked };
        if (textExists || (Object.keys(everyoneText).length > 0)) { requestObj.textInput = Object.assign(textObj, everyoneText); }
        if (Object.keys(optionObj).length > 0) { requestObj.options = optionObj; }
        let result = await putServiceRequest(
          {
            client: pClient,
            author: c.account_id,
            proxy_user: fact.session.user_id,
            requestType: request_type,
            onBehalfOf: oBo,
            foreign_key,
            request: requestObj,
            messaging: null,
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
      default: {
        [html, plain, attachment] = await mealTicketFormat(formatCallObj);
      }
    }
    if (html) {  // if there is a message to send, send it and update all the Service Request records to show that it was sent
      // prepare message that contains the tickets (one for the whole group)
      message_body.messaging = Object.assign({}, fact.messaging);
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

  function displayValue(prompt) {
    if (!dataRows.hasOwnProperty('textValue')) { return ''; }
    if (!dataRows.textValue.hasOwnProperty('*all*')) { return ''; }
    if (!dataRows.textValue['*all*'].hasOwnProperty(prompt)) { return ''; }
    return dataRows.textValue['*all*'][prompt];
  }

  function makeConfirm(pData) {
    let warningsExist = false;
    let dataExists = false;
    let warningSection = [' ', `[bold][italic]There are no selections for:`, ' '];
    let responseArray = [' ', `[bold][italic]AVA will send the following:`];
    let everyoneText = [];
    if (pData.textValue && pData.textValue.hasOwnProperty('*all*')) {
      Object.keys(pData.textValue['*all*']).forEach(prompt => {
        everyoneText.push(`[indent=1]${prompt}: ${pData.textValue['*all*'][prompt]}`);
      });
    }
    pData.columnList.forEach(c => {
      let radioChecked = [];
      Object.keys(pData.radioOn[c.person_id]).forEach(r => {
        if (pData.radioOn[c.person_id][r]) {
          let optionsText = '';
          if (pData.qualSelections && pData.qualSelections[r] && pData.qualSelections[r][c.person_id]) {
            Object.keys(pData.qualSelections[r][c.person_id]).forEach(opt => {
              let oList = [];
              Object.keys(pData.qualSelections[r][c.person_id][opt]).forEach(key => {
                if (typeof (pData.qualSelections[r][c.person_id][opt][key]) === 'boolean') {
                  if (!!pData.qualSelections[r][c.person_id][opt][key]) { oList.push(key); };
                }
                else { oList.push(`${key} ${pData.qualSelections[r][c.person_id][opt][key]}`); }
              });
              if (oList.length > 0) { optionsText += ` (${listFromArray(oList)})`; }
            });
          }
          radioChecked.push(r + optionsText);
        }
        return;
      });
      if (radioChecked.length > 0) {
        dataExists = true;
        responseArray.push(` `);
        responseArray.push(`[italic]${c.display_name}${c.person_id.includes('+++') ? (' (' + c.person_id.split('+++')[1] + ')') : ''}`);
        responseArray.push(`[indent=1]${listFromArray(radioChecked)}`);
      }
      let noText = true;
      if (pData.textValue && pData.textValue.hasOwnProperty(c.person_id)) {
        Object.keys(pData.textValue[c.person_id]).forEach(textIn => {
          if (pData.textValue[c.person_id][textIn].trim() !== '') {
            dataExists = true;
            noText = false;
            if (radioChecked.length === 0) {
              responseArray.push(` `);
              responseArray.push(`[italic]${c.display_name}${c.person_id.includes('+++') ? (' (' + c.person_id.split('+++')[1] + ')') : ''}`);
            }
            responseArray.push(`[indent=1]${textIn}: ${pData.textValue[c.person_id][textIn]}`);
          }
        });
      }
      if ((radioChecked.length === 0) && (noText)) {
        warningsExist = true;
        warningSection.push(`[italic]${c.display_name}${c.person_id.includes('+++') ? (' (' + c.person_id.split('+++')[1] + ')') : ''}`);
      }
      else if (everyoneText.length > 0) {
        everyoneText.forEach(e => {
          responseArray.push(e);
        });
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
            key={'topBox'}
          >
            <Box display='flex' flexDirection='column' key={'titlesection'}>
              <Typography
                className={classes.title}
              >
                {factName}
              </Typography>
              <Typography
                className={classes.subTitle}
              >
                {prompt || `Please select from these options`}
              </Typography>
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
              <MenuList className={classes.popUpMenu}>
                <MenuItem
                  onClick={() => {
                    onClose();
                  }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowHome'}
                  >
                    <HomeIcon />
                    <Typography className={classes.popUpMenuRow} >{'Go to AVA Menu'}</Typography>
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
                    <Typography className={classes.popUpMenuRow} >{'Restart AVA'}</Typography>
                  </Box>
                </MenuItem>
                <MenuItem>
                  <Box
                    display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                    key={'vRowRefresh'}
                  >
                    <Typography className={classes.popUpFooter} >{`AVA vers ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                    <Typography className={classes.popUpFooter} >{`User ${fact.session.user_id}${fact.patient_id !== fact.session.user_id ? (' (' + fact.patient_id + ')') : ''}`}</Typography>
                    <Typography className={classes.popUpFooter} >{`Function: ObservationForm`}</Typography>
                    <Typography className={classes.popUpFooter} >{`Activity: ${fact.activity_key}`}</Typography>
                  </Box>
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>

          { /* Data rows */}
          <Paper component={Box} className={classes.page} overflow='auto' square>
            {(dataRows.columnList.length > 0) &&
              dataRows.displayRows.map((this_item, this_index) => (
                <Box display='flex'
                  flexDirection='column'
                  margin={((isChecked(this_item.text) !== 'none') || textPresent(this_item.text)) ? 2 : 0}
                  border={((isChecked(this_item.text) !== 'none') || textPresent(this_item.text)) ? 2 : 0}
                  key={'fullRow' + this_index}
                  className={(this_index === 0 ? classes.listItemSticky : classes.listTopRow)}
                >
                  <Box
                    display='flex'
                    flexDirection='row'
                    key={'row' + this_index}
                    className={classes.listItem}
                    mb={0.5}
                    mt={0.5}
                    justifyContent='space-between'
                    alignItems='center'
                  >
                    <Box
                      display='flex'
                      flexDirection='row'
                      minWidth={200}
                      maxWidth={(this_item.header && (this_index > 0)) ? 2000 : 200}
                      key={`descriptor-row${this_index}`}
                      className={classes.listItem}
                      justifyContent='flex-start'
                      alignItems='center'
                    >
                      <Typography
                        className={this_item.header ? (this_index === 0 ? classes.headerLineSticky : classes.headerLine) : classes.textLine}
                      >
                        {this_item.bold
                          ? (this_item.italic ? <b><i>{this_item.text}</i></b> : <b>{this_item.text}</b>)
                          : (this_item.italic ? <i>{this_item.text}</i> : `${this_item.text}`)}
                      </Typography>
                    </Box>
                    {(!this_item.header || (this_index === 0)) &&
                      <Box
                        display='flex'
                        flexDirection='row'
                        key={'row' + this_index}
                        className={classes.listItem}
                        justifyContent='flex-end'
                        alignItems='center'
                      >
                        {this_index !== 0 && this_item.checkbox &&
                          <Box
                            display='flex'
                            flexDirection='row'
                            minWidth={50}
                            maxWidth={50}
                            key={`radiobox-row${this_index}`}
                            className={classes.listItem}
                            justifyContent='center'
                            alignItems='center'
                          >
                            <Checkbox
                              checked={isChecked(this_item.text) === 'all'}
                              indeterminate={isChecked(this_item.text) === 'some'}
                              disableRipple
                              key={'checkbox' + this_index}
                              onClick={() => {
                                // is every person currently check ON for this row?
                                let someAreOff = false;
                                for (let person in dataRows.radioOn) {
                                  if (!dataRows.radioOn[person][this_item.text]) { someAreOff = true; }
                                }
                                for (let person in dataRows.radioOn) {
                                  dataRows.radioOn[person][this_item.text] = someAreOff;
                                }
                                setDataRows(dataRows);
                                setForceRedisplay(!forceRedisplay);
                              }}
                            />
                          </Box>
                        }
                        {this_index !== 0 && !this_item.checkbox &&
                          <Box
                            display='flex'
                            flexDirection='row'
                            minWidth={50}
                            maxWidth={(this_item.input !== 'promptall') ? 50 : 500}
                            key={`pencilbox-row${this_index}`}
                            className={classes.listItem}
                            justifyContent='center'
                            alignItems='center'
                          >
                            {(this_item.input !== 'promptall') &&
                              <Checkbox
                                disableRipple
                                className={classes.hiddenItem}
                                key={'pencilbox' + this_index}
                                onClick={() => { }}
                              />
                            }
                            {(this_item.input === 'promptall') &&
                              <TextField
                                className={classes.freeInput}
                                id={'text' + this_index}
                                variant={'standard'}
                                key={'text' + this_index}
                                multiline
                                onFocus={async () => {
                                  if (this_item.oKey) {
                                    if (!dataRows.qualData || !dataRows.qualData[this_item.text]) {
                                      if (!dataRows.qualData) { dataRows.qualData = {}; }
                                      if (!dataRows.qualData[this_item.text]) { dataRows.qualData[this_item.text] = []; }
                                      dataRows.qualData[this_item.text] = await getObservationOptions(this_item.oKey);
                                    }
                                    dataRows.optNeeded = [this_item.text, '*all', 'Everyone'];
                                    setDataRows(dataRows);
                                    setForceRedisplay(!forceRedisplay);
                                  }
                                }}
                                onChange={(event) => {
                                  if (!dataRows.hasOwnProperty('textValue')) { dataRows.textValue = {}; }
                                  if (!dataRows.textValue.hasOwnProperty('*all*')) {
                                    dataRows.textValue['*all*'] = {};
                                  }
                                  dataRows.textValue['*all*'][this_item.text] = event.target.value;
                                  setDataRows(dataRows);
                                  setForceRedisplay(!forceRedisplay);
                                }}
                                autoComplete='off'
                                value={displayValue(this_item.text)}
                              />
                            }
                          </Box>
                        }
                        {(this_index === 0) &&
                          <Box
                            display='flex'
                            flexDirection='column'
                            minWidth={50}
                            maxWidth={50}
                            key={`radiobox-row${this_index}`}
                            className={classes.listItem}
                            justifyContent='flex-end'
                            alignItems='center'
                          >
                            <Typography className={classes.smallTextLine}>Select</Typography>
                            <Typography className={classes.smallTextLine}>all</Typography>
                          </Box>
                        }
                        {dataRows.columnList.map((this_person, this_column) => (
                          (this_index === 0 ?
                            <Box
                              display='flex'
                              flexDirection='column'
                              minWidth={50}
                              maxWidth={50}
                              key={`radiobox-row${this_index}-col${this_column}`}
                              className={classes.listItem}
                              justifyContent='flex-end'
                              alignItems='center'
                            >
                              {this_person.person_id.includes('+++') ?
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
                                  <Typography key={`number-${this_column}`} style={{ fontSize: '3em', fontWeight: 'bold' }}>
                                    {this_person.person_id.split('+++')[1]}
                                  </Typography>
                                </Box>
                                :
                                <Box
                                  component="img"
                                  mt={0}
                                  mb={1}
                                  minWidth={50}
                                  maxWidth={50}
                                  minHeight={50}
                                  maxHeight={50}
                                  alt=''
                                  src={getImage(this_person.person_id)}
                                />
                              }
                              {this_person.dName.slice(-1 * maxName).map((n, nx) => (
                                <Typography key={`name-${nx}-${this_column}`} className={classes.smallTextLine}>{n}</Typography>
                              ))}
                            </Box>
                            :
                            (this_item.checkbox ?
                              <Box
                                display='flex'
                                flexDirection='row'
                                minWidth={50}
                                maxWidth={50}
                                key={`radiobox-row${this_index}-col${this_column}`}
                                className={classes.listItem}
                                justifyContent='center'
                                alignItems='center'
                              >
                                <Radio
                                  key={`radio-row${this_index}-col${this_column}`}
                                  checked={isRadioSelected(this_person.person_id, this_item.text)}
                                  value={isRadioSelected(this_person.person_id, this_item.text)}
                                  onClick={async () => {
                                    await itemSelected(this_person.person_id, this_item, this_person.display_name);
                                  }}
                                  disableRipple
                                  className={classes.radioButton}
                                  size='small'
                                />
                              </Box>
                              :
                              <Box
                                display='flex'
                                flexDirection='row'
                                minWidth={50}
                                maxWidth={50}
                                key={`pencilbox-row${this_index}-col${this_column}`}
                                className={classes.listItem}
                                justifyContent='center'
                                alignItems='center'
                              >
                                {(dataRows.hasOwnProperty('textValue')
                                  && dataRows.textValue.hasOwnProperty(this_person.person_id)
                                  && dataRows.textValue[this_person.person_id].hasOwnProperty(this_item.text)
                                  && dataRows.textValue[this_person.person_id][this_item.text].trim() !== '')
                                  ?
                                  <Tooltip title={dataRows.textValue[this_person.person_id][this_item.text]}>
                                    <Button
                                      className={classes.pencilButton}
                                      onClick={() => {
                                        setPromptForText({
                                          person: this_person.person_id,
                                          prompt: this_item.text,
                                          title: this_person.display_name,
                                          value: dataRows.textValue[this_person.person_id][this_item.text]
                                        });
                                        setForceRedisplay(!forceRedisplay);
                                      }}
                                      startIcon={<NotesIcon size="small" />}
                                    />
                                  </Tooltip>
                                  :
                                  (this_item.input !== 'promptall' &&
                                    <Button
                                      className={classes.pencilButton}
                                      onClick={() => {
                                        setPromptForText(
                                          {
                                            person: this_person.person_id,
                                            prompt: this_item.text,
                                            title: this_person.display_name
                                          }
                                        );
                                        setForceRedisplay(!forceRedisplay);
                                      }}
                                      startIcon={<EditIcon size="small" />}
                                    />
                                  )
                                }
                              </Box>
                            )
                          )
                        ))}
                      </Box>
                    }
                  </Box>
                </Box>
              ))}

          </Paper>

          { /* Prompt for People */}
          {((dataRows.columnList.length < 1) || morePeople) &&
            <PersonFilter
              prompt={'Select diners'}
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

          { /* Prompt for Options */}
          {(dataRows.optNeeded && dataRows.optNeeded.length > 0) &&
            dataRows.qualData[dataRows.optNeeded[0]].map((qR, qRndx) => (
              <Box
                key={'qRow' + qRndx}
                display="flex"
                className={classes.qualOption}
                flexDirection='column'
                justifyContent="center"
              >
                <Box display='flex' flexDirection='column' justifyContent='center'
                  alignItems='flex-start' key={'qrRow' + qR.title}>
                  {qRndx === 0 &&
                    <Typography className={classes.qualText}>{dataRows.optNeeded[0]} for {dataRows.optNeeded[2]}</Typography>
                  }
                  <Typography className={classes.qualText}>{qR.title}</Typography>
                  <Box display='flex' flexDirection='row' justifyContent='flex-start'
                    alignItems='center' flexWrap='wrap' key={'qrOpt' + qR.title}
                  >
                    {qR.option && qR.option.map((opt, oX) => (
                      <Box display='flex' flexDirection='row' justifyContent='flex-start'
                        alignItems='center' key={'qrOpt2' + oX}
                        onClick={() => {
                          optSelected(qR.title, opt.display);
                        }}
                      >
                        {(!opt.type || (opt.type === 'checkbox')) &&
                          <React.Fragment>
                            <Checkbox
                              className={classes.radioButton}
                              size="small"
                              checked={isQualChecked(dataRows.optNeeded[0], dataRows.optNeeded[1], qR.title, opt.display)}
                            />
                            <Typography className={classes.radioText}>{opt.display}</Typography>
                          </React.Fragment>
                        }
                        {opt.type === 'prompt' &&
                          <React.Fragment>
                            <Checkbox
                              className={classes.radioButton}
                              size="small"
                              checked={dataRows.qualSelections[dataRows.optNeeded[0]][dataRows.optNeeded[1]][qR.title][opt.display]} />
                            <TextField
                              className={classes.radioText}
                              id={'text' + qRndx + oX}
                              variant={'standard'}
                              key={'text' + qRndx + oX}
                              multiline
                              onChange={(event) => {
                                optSelected(qR.title, opt.display, event.target.value);
                              }}
                              autoComplete='off'
                            />
                            <Typography className={classes.radioText}>{opt.display}</Typography>
                          </React.Fragment>
                        }
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            ))
          }



          { /* Prompt for Text */}
          {(Object.keys(promptForText).length > 0) &&
            <AVATextInput
              titleText={promptForText.title}
              promptText={promptForText.prompt}
              valueText={promptForText.value || ''}
              buttonText='Save'
              onCancel={() => {
                setPromptForText({});
                setForceRedisplay(!forceRedisplay);
              }}
              onSave={(updatedText) => {
                if (!dataRows.hasOwnProperty('textValue')) { dataRows.textValue = {}; }
                if (!dataRows.textValue.hasOwnProperty(promptForText.person)) {
                  dataRows.textValue[promptForText.person] = {};
                }
                dataRows.textValue[promptForText.person][promptForText.prompt] = updatedText;
                setDataRows(dataRows);
                setPromptForText({});
                setForceRedisplay(!forceRedisplay);
              }}
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
          {
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
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
                    <React-Fragment>
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
                    </React-Fragment>
                  }
                </Box>
              </Box>
            </DialogActions>
          }
        </React.Fragment>
      }
    </Dialog >
  );

};
