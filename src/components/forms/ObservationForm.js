import React from 'react';
import { s3 } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { makeName } from '../../util/AVAPeople';
import { putServiceRequest } from '../../util/AVAServiceRequest';
import { getObservationItems } from '../../util/AVAObservations';

import makeStyles from '@material-ui/core/styles/makeStyles';
import { useSnackbar } from 'notistack';

import TextField from '@material-ui/core/TextField';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';
import List from '@material-ui/core/List';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import CloseIcon from '@material-ui/icons/HighlightOff';
import CheckIcon from '@material-ui/icons/Check';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import DeleteIcon from '@material-ui/icons/Delete';

import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';

import Avatar from '@material-ui/core/Avatar';
import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import AVAConfirm from './AVAConfirm';

import { AVAclasses, AVADefaults, AVATextStyle } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  textLine: {
    fontSize: '1rem',
    flexGrow: 0,
    marginRight: '7px'
  },
  containerBox: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0
  },
  headerLine: {
    marginTop: theme.spacing(3.0),
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
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
  },
  radioHeader: {
    fontSize: theme.typography.fontSize * 0.9,
    fontWeight: 'bold',
    marginLeft: 0,
    marginBottom: 0,
    marginTop: 0,
    paddingLeft: 0,
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
    marginLeft: 3,
    paddingLeft: 0,
    paddingRight: 1,
  },
  freeInput: {
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 0,
    flexGrow: 2,
    fontSize: theme.typography.fontSize * 1.3,
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  inputRow: {
    marginTop: theme.spacing(0.75),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0.75),
  },
  listItem: {
    marginTop: theme.spacing(0.75),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(0.75),
    flexWrap: 'nowrap'
  },
  page: {
    height: 950,
  },
  qualOption: {
    marginTop: 0,
    marginLeft: theme.spacing(3),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0.9375),
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
    // marginLeft: theme.spacing(2),
    marginBottom: 0,
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold',
  },
  subTitle: {
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
    //  marginLeft: theme.spacing(2),
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

  let user_fontSize = AVADefaults({fontSize: 'get'});

  const classes = useStyles();
  const AVAClass = AVAclasses();
  const { enqueueSnackbar } = useSnackbar();

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [reactData, setReactData] = React.useState({
    cancelPending: false,
    confirmStatus: '',
    confirmPrompt: false,
    checkedToSave: null,
    attachmentList: [],
    textInput: {},
    initialLoadComplete: null,
    popupMenuOpen: false
  });

  const [dataRows, setDataRows] = React.useState();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [linkURL, setLinkURL] = React.useState(null);

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

  let displayRowList = [];
  let checkbox = true;
  let ignore = false;
  let required = false;
  let displayBold = false;
  let displayItalic = false;
  const defaultCheckedWords = ['checked', 'on', 'selected', 'true'];

  if (!reactData.initialLoadComplete) {
    let defaultObj = {};
    let defaultChecked = [];
    if (defaultValue) {
      (Array.isArray(defaultValue) ? [...defaultValue] : [defaultValue]).forEach(i => {
        let [key, value] = i.split('=');
        defaultObj[key] = value;
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

      // This handles any row without a leading "~"
      // These will be checkbox fields UNLESS a previous instruction turned checkbox OFF (~[checkbox=OFF])
      if (instruction[0]) {
        let rObj = {
          checkbox,
          required,
          text: instruction[0],
          oKey: getKey(instruction[0]),
          altValue: (listValues[vIndex].includes(":") ? instruction[1] : null),
          desc: getDescription(instruction[0]),
          input: false,
          bold: displayBold,
          italic: displayItalic
        };
        displayRowList.push(rObj);
        // default the checkbox to checked if either:
        //   a previous instruction set the default for all checkboxes to ON (~[default=checked]), OR
        //   a passed in default for this item instructs AVA to set the checkbox ON
        if (defaultCheckedWords.includes(dValue)
          || (defaultObj.hasOwnProperty(instruction[0]) && defaultCheckedWords.includes(defaultObj[instruction[0]]))) {
          defaultChecked.push(instruction[0]);
          /*   When default sets on a check box for something with qualifiers, we need to expose the qualifiers...  (but don't know how yet!)
          if (!dataRows.hasOwnProperty('checked') || (dataRows.checked.length === 0)) {
            dataRows.checked = [instruction[0]];
            await getObservations(instruction[0], this_item.oKey, dataRows.checked);
          }
          */
        }
        continue;
      }

      // Dropping through to here means that instruction[0] was null/blank
      //    (ie. there was nothing before the first "~"; the row started with "~")
      // This handles rows in the form "~<instruction[1]>:<instruction[2]>", for example
      //     "~lambda:ServiceRequestMaintenance" or
      //     "~prompt:Notes for the Dining Staff..."
      if (instruction[2]) {
        let rObj = {
          checkbox: (instruction[1].includes('withCheckBox')),
          required: required || (instruction[1].includes('required')),
          text: instruction[2],
          oKey: getKey(instruction[2]),
          desc: getDescription(instruction[2]),
          input: instruction[1]
        };
        displayRowList.push(rObj);
        if (dValue) { defaultObj[instruction[2]] = dValue; }
        if (defaultObj.hasOwnProperty(`private~${instruction[2]}`)) {
          if (!reactData.textInput) { reactData.textInput = {}; }
          reactData.textInput[instruction[2]] = defaultObj[`private~${instruction[2]}`];
          fact.value.freeText[instruction[2]] = defaultObj[`private~${instruction[2]}`];
        }
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
    if (defaultObj && (Object.keys(defaultObj).length > 0)) {
      for (const key in defaultObj) {
        if (!key.startsWith('private~')) {
          if (!reactData.textInput) { reactData.textInput = {}; }
          reactData.textInput[key] = defaultObj[key];
        }
        else { delete fact?.value?.freeText[key]; }
      }
    }
    reactData.initialLoadComplete = true;
    setDataRows({ displayRows: displayRowList, dataRows: {}, checked: defaultChecked });
    setReactData(reactData);
  }

  async function getObservations(pText, pObsKey, pChecked) {
    let workDataRows = dataRows;
    workDataRows.checked = pChecked;
    if (dataRows.hasOwnProperty(pText)) {
      setDataRows(workDataRows);
      setForceRedisplay(!forceRedisplay);
      return;
    }
    if (pObsKey) {
      let oItem = await getObservationItems(pObsKey);
      if (oItem && oItem.hasOwnProperty('options')) {
        workDataRows[pText] = oItem.options.display_value;
        let workChosenQ = {};
        if (workDataRows.hasOwnProperty('chosenQual')) {
          workChosenQ = workDataRows.chosenQual;
        }
        if (!workChosenQ.hasOwnProperty(pText)) {
          workChosenQ[pText] = {};
          oItem.options.display_value.forEach(v => {
            if (v.default) {
              if (Array.isArray(v.default)) { workChosenQ[pText][v.title] = v.default; }
              else { workChosenQ[pText][v.title] = [v.default]; }
            }
            else { workChosenQ[pText][v.title] = []; }
          });
        }
        workDataRows.chosenQual = workChosenQ;
      }
      if (oItem && oItem.hasOwnProperty('links')) {
        if (!workDataRows.hasOwnProperty('links')) {
          workDataRows.links = {};
        }
        oItem.links.display_value.forEach(l => {
          workDataRows.links[l.display] = l.link;
        });
      }
    }
    setDataRows(workDataRows);
    setForceRedisplay(!forceRedisplay);
  }

  function handleQualChecked(pOrderOption, pQualifier, pQualChoice) {
    if (!pQualChoice) { return; }
    let qRule = dataRows[pOrderOption].find(r => { return (r.title === pQualifier); });
    let workChosenQ = dataRows.chosenQual;
    if (!workChosenQ) {
      workChosenQ[pOrderOption] = {};
    }
    if (!workChosenQ[pOrderOption]) {
      workChosenQ[pOrderOption][pQualifier] = {};
    }
    if (!workChosenQ[pOrderOption][pQualifier] || (workChosenQ[pOrderOption][pQualifier].length === 0)) {
      workChosenQ[pOrderOption][pQualifier] = [pQualChoice];
    }
    else {
      let x = workChosenQ[pOrderOption][pQualifier].indexOf(pQualChoice);
      let workArray = workChosenQ[pOrderOption][pQualifier];
      if (x === -1) {
        if (workArray.length >= (qRule.max_allowed || 99)) { workArray.pop(); }
        workArray.push(pQualChoice);
      }
      else {
        if (workArray.length > (qRule.min_required || 0)) {
          workArray.splice(x, 1);
        }
      }
      workChosenQ[pOrderOption][pQualifier] = workArray;
    }
    // Checking Rules
    dataRows.chosenQual = workChosenQ;
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
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

  const onCheckEnter = (event, this_item) => {
    if (event.key === 'Enter' || event.type === 'blur') {
      if (this_item.input === 'date') { handleDateExit(event, this_item); }
      else if (this_item.input === 'time') { handleTimeExit(event, this_item); }
      else { handleTextExit(event, this_item); }
    }
    setForceRedisplay(!forceRedisplay);
  };

  const handleDateExit = async (event, this_item) => {
    let AVAdate = makeDate(event.target.value);
    reactData.textInput[this_item.text] = AVAdate.absolute;
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
  };

  const handleTimeExit = (event, this_item) => {
    let ampm = null;
    if (event.target.value.includes('p')) { ampm = 'pm'; }
    else if (event.target.value.includes('a')) { ampm = 'am'; };
    let [hh$, mm$] = event.target.value.split(':');
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
    reactData.textInput[this_item.text] = `${hh}:${mm < 10 ? ('0' + mm) : mm} ${ampm}`;
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
  };

  const handleTextExit = (event, this_item) => {
    reactData.textInput[this_item.text] = event.target.value;
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
  };

  function isChecked(pObj) {
    return (dataRows.hasOwnProperty('checked') && dataRows.checked.includes(pObj.text) && pObj.checkbox);
  }

  function isQChecked(pObj, pQualName, pChoice) {
    return (dataRows.hasOwnProperty('chosenQual')
      && dataRows.chosenQual[pObj.text]
      && dataRows.chosenQual[pObj.text].hasOwnProperty(pQualName.title)
      && dataRows.chosenQual[pObj.text][pQualName.title].includes(pChoice));
  }

  function showQualifier(pObj) {
    return (isChecked(pObj) && !!dataRows && dataRows.hasOwnProperty(pObj.text));
  }

  function makeConfirm(pDisplayRows, pChecked, textInput = { 'empty': true }) {
    if (!textInput) { textInput = { 'empty': true }; }
    let workChecked = [];
    let errorsExist = false;
    let errorMessage = ['Please correct these errors', ''];
    let responseArray = [`Please confirm your selections`, ''];
    setLinkURL(null);
    pDisplayRows.forEach(r => {
      if (r.required && (!textInput.hasOwnProperty(r.text) || textInput[r.text] === '')) {
        errorsExist = true;
        errorMessage.push(`[italic]You left "${r.text}" blank!`);
      }
      if (r.checkbox || (textInput && textInput.hasOwnProperty(r.text))) {
        let rText = '';
        if (pChecked.includes(r.text)) { rText = r.text; }
        if (textInput.hasOwnProperty(r.text) && (textInput[r.text].length > 0)) { rText = textInput[r.text]; }
        if (rText) {
          if (pChecked.includes(r.text)) { workChecked.push(`${rText}${(r.altValue ? (':' + r.altValue) : '')}`); }
          responseArray.push(rText);
          if (dataRows.links && dataRows.links[rText]) {
            setLinkURL(dataRows.links[rText]);
          }
          if (dataRows.hasOwnProperty('chosenQual') && dataRows.chosenQual[r.text]) {
            for (let key in dataRows.chosenQual[r.text]) {
              if (dataRows.chosenQual[r.text][key] && (dataRows.chosenQual[r.text][key].length > 0)) {
                dataRows.chosenQual[r.text][key].forEach(qRow => {
                  responseArray.push(`[indent=1]${qRow}`);
                  if (dataRows.links && dataRows.links[qRow]) {
                    setLinkURL(dataRows.links[qRow]);
                  }
                });
              }
            }
          }
        }
      }
    });
    if (reactData.attachmentList && (reactData.attachmentList.length > 0)) {
      reactData.attachmentList.forEach(aRow => {
        let fNArr = aRow.Location.split('/').pop().split('.');
        fNArr.pop();
        let fName = decodeURI(fNArr.join('.'));
        responseArray.push(`Attachment: ${fName}`);
      });
    }
    reactData.checkedToSave = workChecked;
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
    if (errorsExist) { return ['error', errorMessage]; } else { return ['confirm', responseArray]; };
  }

  const hiddenFileInput = React.useRef(null);

  const handleFileUpload = event => {
    hiddenFileInput.current.click();
  };

  function textIsPresent(fieldName) {
    return (reactData.textInput
      && (Object.keys(reactData.textInput).length > 0)
      && reactData.textInput[fieldName]);
  }

  async function handleSaveFile(pTarget) {
    let pType = pTarget.type;
    let s3Resp = await s3
      .upload({
        Bucket: 'theseus-medical-storage',
        Key: pTarget.name,
        Body: pTarget,
        ACL: 'public-read-write',
        ContentType: pType
      })
      .promise()
      .catch(err => {
        enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
      });
    reactData.attachmentList.push(s3Resp);
    if (!reactData.textInput) { reactData.textInput = { 's3file': s3Resp.Location }; }
    else { reactData.textInput.s3file = s3Resp.Location; }
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
    return s3Resp;
  };

  return (
    <Dialog open={forceRedisplay || true} fullScreen className={classes.containerBox}>
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
                className={classes.title} style={AVATextStyle({ size: 1.3, bold: true })}
              >
                {factName}
              </Typography>
              <Typography
                className={classes.subTitle} style={AVATextStyle({ size: 1.2, bold: true, margin: { right: 2, bottom: 0.5 } })}
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
                reactData.popupMenuOpen = true;
                setReactData(reactData);
                setForceRedisplay(!forceRedisplay);
              }}>
              <Avatar src={process.env.REACT_APP_AVA_LOGO} />
            </Box>
            <Menu
              id='hidden-menu'
              anchorEl={anchorEl}
              open={reactData.popupMenuOpen}
              onClose={() => {
                reactData.popupMenuOpen = false;
                setReactData(reactData);
                setForceRedisplay(!forceRedisplay);
              }}
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
          {/* Selections */}
          <Paper component={Box} className={classes.page} overflow='auto' square>
            <List  >
              {dataRows.displayRows.map((this_item, this_index) => (
                <Box display='flex'
                  flexDirection='column'
                  marginLeft={(this_item.checkbox || this_item.input) ? 2 : 0}
                  marginRight={2}
                  marginBottom={0.5}
                  marginTop={0.5}
                  border={(isChecked(this_item) || textIsPresent(this_item.text)) ? 1 : 0}
                  borderRadius={'16px'}
                  minHeight={`${user_fontSize * 2}rem`}
                  justifyContent='center'
                  key={'fullRow' + this_index}
                >
                  <Box
                    display='flex'
                    flexDirection='row'
                    flexWrap='wrap'
                    key={'row' + this_index}
                    className={this_item.input ? classes.inputRow : classes.listItem}
                    justifyContent='flex-start'
                    alignItems='center'
                    onClick={async () => {
                      if (this_item.checkbox) {
                        if (!dataRows.hasOwnProperty('checked') || (dataRows.checked.length === 0)) {
                          dataRows.checked = [this_item.text];
                          await getObservations(this_item.text, this_item.oKey, dataRows.checked);
                        }
                        else {
                          let x = dataRows.checked.indexOf(this_item.text);
                          let workChecked = dataRows.checked;
                          if (x === -1) {
                            workChecked.push(this_item.text);
                            await getObservations(this_item.text, this_item.oKey, workChecked);
                          }
                          else {
                            workChecked.splice(x, 1);
                            dataRows.checked = workChecked;
                            setDataRows(dataRows);
                            setForceRedisplay(!forceRedisplay);
                          }
                        }
                      }
                    }}
                  >
                    {this_item.checkbox &&
                      <Checkbox
                        edge='start'
                        checked={isChecked(this_item)}
                        disableRipple
                        key={'checkbox' + this_index}
                      />
                    }
                    {!this_item.input &&
                      <Typography
                        style={this_item.header ? AVATextStyle({ size: 1.3, bold: true, margin: { top: 3, bottom: 1 } }) : AVATextStyle({ margin: { right: 0.5 } })}
                      >
                        {this_item.bold
                          ? (this_item.italic ? <b><i>{this_item.text}</i></b> : <b>{this_item.text}</b>)
                          : (this_item.italic ? <i>{this_item.text}</i> : `${this_item.text}`)}
                      </Typography>
                    }
                    {this_item.input &&
                      <TextField
                        className={classes.freeInput}
                        id={'text' + this_index}
                        variant={'standard'}
                        key={'text' + this_index}
                        helperText={this_item.text}
                        multiline
                        inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                        FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                        onKeyPress={(event) => {
                          onCheckEnter(event, this_item);
                        }}
                        onChange={(event) => {
                          if (!reactData.textInput) { reactData.textInput = {}; }
                          reactData.textInput[this_item.text] = event.target.value;
                          setReactData(reactData);
                          setForceRedisplay(!forceRedisplay);
                        }}
                        onBlur={(event) => {
                          onCheckEnter(event, this_item);
                        }}
                        autoComplete='off'
                        value={textIsPresent(this_item.text) ? reactData.textInput[this_item.text] : ''}
                      />
                    }
                  </Box>
                  {(this_item.desc && isChecked(this_item)) &&
                    <Typography style={AVATextStyle({ size: 0.7, margin: { left: 1, bottom: 0.8, right: 3 } })}>{this_item.desc}</Typography>
                  }
                  {showQualifier(this_item) &&
                    dataRows[this_item.text].map((qR, qRndx) => (
                      <Box
                        key={'qRow' + qRndx}
                        display="flex"
                        style={AVATextStyle({ size: 0.6, margin: { left: 0.8, bottom: 0.2, right: 0.4 } })}
                        flexDirection='column'
                        justifyContent="center"
                      >
                        <Box display='flex' flexDirection='column' justifyContent='center'
                          alignItems='flex-start' key={'qrRow' + qR.title}>
                          <Typography style={AVATextStyle({ size: 0.7, margin: { left: 0.3, top: 0.8, right: 3 } })}>{qR.title}</Typography>
                          <Box display='flex' flexDirection='row' justifyContent='flex-start'
                            alignItems='center' flexWrap='wrap' key={'qrOpt' + qR.title}
                          >
                            {qR.option && qR.option.map((opt, oX) => (
                              <Box display='flex' flexDirection='row' justifyContent='flex-start'
                                alignItems='center' key={'qrOpt2' + oX}
                                onClick={() => {
                                  handleQualChecked(this_item.text, qR.title, opt.display);
                                }}
                              >
                                {(!opt.type || (opt.type === 'checkbox')) &&
                                  <React.Fragment>
                                    <Checkbox
                                      className={classes.radioButton}
                                      size="small"
                                      checked={isQChecked(this_item, qR, opt.display)} />
                                    <Typography style={AVATextStyle({ size: 0.6, margin: { left: 0.3, right: 3 } })}>{opt.display}</Typography>
                                  </React.Fragment>
                                }
                                {opt.type === 'prompt' &&
                                  <React.Fragment>
                                    <Checkbox
                                      className={classes.radioButton}
                                      size="small"
                                      checked={isQChecked(this_item, qR, opt.display)} />
                                    <TextField
                                      style={AVATextStyle({ size: 0.6, margin: { left: 0.3, right: 3 } })}
                                      id={'text' + this_index + oX}
                                      variant={'standard'}
                                      key={'text' + this_index + oX}
                                      multiline
                                      onChange={(event) => {
                                        qR.option[oX].display = event.target.value;
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
              ))}
            </List>
            { /* Show list of already uploaded attachments (if applicable) */}
            {(reactData.attachmentList.length > 0) &&
              <Box display='flex' flexDirection='column' pl={'24px'} justifyContent='flex-start'
                alignItems='flex-start' key={'qrOpt_attachmentlist'}
              >
                <Typography className={classes.radioHead}>Attachments:</Typography>
                {reactData.attachmentList.map((a, x) => (
                  <Box display='flex' flexDirection='row' justifyContent='flex-start'
                    alignItems='flex-start' key={`qrOpt_attachmentLine-${x}`}
                  >
                    <DeleteIcon
                      className={classes.radioButton}
                      size="small"
                      onClick={() => {
                        reactData.attachmentList.splice(x, 1);
                        reactData.forceRedisplay = !reactData.forceRedisplay;
                        setReactData(reactData);
                        setForceRedisplay(!forceRedisplay);
                      }}
                    />
                    <Typography style={AVATextStyle({ size: 0.6, margin: { left: 0.3, right: 3 } })}>{a.Key}</Typography>
                  </Box>
                ))}
              </Box>
            }
          </Paper>
          { /* Prompts */}
          {
            reactData.cancelPending &&
            <AVAConfirm
              promptText={`Are you sure you'd like to exit?`}
              cancelText={'No, go back'}
              confirmText={'Yes, exit'}
              onCancel={() => {
                reactData.cancelPending = false;
                setReactData(reactData);
                setForceRedisplay(!forceRedisplay);
              }}
              onConfirm={() => {
                onClose();
              }}
            >
            </AVAConfirm>
          }
          {
            (reactData.confirmStatus === 'confirm') &&
            <AVAConfirm
              promptText={reactData.confirmPrompt}
              cancelText={'Go back'}
              confirmText={'Save/Send'}
              onCancel={() => {
                reactData.confirmStatus = '';
                setReactData(reactData);
                setForceRedisplay(!forceRedisplay);
              }}
              onConfirm={async () => {
                let rObj;
                if (factType !== 'list') {
                  // in defaultValues, if foreign_key and/or obo exist they can either mean:
                  //    1. the name of the prompt whose textInput contains the value, OR
                  //    2. the value itself
                  // if not mentioned in defaultValues, we'll assign values to them
                  let oBo, foreign_key;
                  if (fact.value.freeText) {
                    if ('onBehalfOf' in fact.value.freeText) {
                      oBo = fact.value.freeText.onBehalfOf;
                      if (reactData.textInput && reactData.textInput[fact.value.freeText.onBehalfOf]) {
                        oBo = reactData.textInput[fact.value.freeText.onBehalfOf];
                        delete reactData.textInput[fact.value.freeText.onBehalfOf];
                        delete fact.value.freeText.onBehalfOf;
                        delete reactData.textInput.onBehalfOf;
                      }
                    }
                    if ('foreignKey' in fact.value.freeText) {
                      foreign_key = fact.value.freeText.foreignKey;
                      if (reactData.textInput) {
                        if (reactData.textInput[fact.value.freeText.foreignKey]) {
                          foreign_key = reactData.textInput[fact.value.freeText.foreignKey];
                          delete reactData.textInput[fact.value.freeText.foreignKey];
                          delete fact.value.freeText.foreignKey;
                        }
                        else if ('foreignKey' in reactData.textInput) {
                          foreign_key = reactData.textInput['foreignKey'];
                        }
                        delete reactData.textInput['foreignKey'];
                      }
                    }
                  }
                  if (reactData.checkedToSave.some(s => { return s.toLowerCase().includes('anonymous'); })) {
                    oBo = 'Anonymous';
                  }
                  else if (!oBo) { oBo = await makeName(fact.patient_id); }
                  if (!foreign_key) { foreign_key = '*tbd'; }

                  delete reactData.textInput['requestType'];
                  let requestObj = { 'selections': reactData.checkedToSave, textInput: reactData.textInput, 'qualifiers': dataRows.chosenQual };
                  let messageObj = {};
                  if ('messaging' in fact) {
                    messageObj.messaging = Object.assign({}, requestObj, fact.messaging);
                    messageObj.messaging.activityName = factName;
                  }
                  let putSR = {
                    client: pClient,
                    author: fact.patient_id,
                    proxy_user: fact.session.user_id,
                    requestType: fact.value.freeText.requestType,
                    onBehalfOf: oBo.replace(/\n/g, " ").trim(),
                    foreign_key,
                    request: requestObj,
                    messaging: fact.messaging,
                    activity_key: fact.activity_key
                  };
                  if (reactData.attachmentList && (reactData.attachmentList.length > 0)) {
                    putSR.attachments = reactData.attachmentList;
                  }
                  rObj = await putServiceRequest(putSR);
                }
                if (linkURL) {
                  window.open(linkURL, (rObj.request_id || 'AVA_request_postURL'));
                }
                onSave((rObj ? rObj.request_id : ''), reactData.checkedToSave, reactData.textInput, dataRows.chosenQual);
              }}
            >
            </AVAConfirm>
          }
          {
            (reactData.confirmStatus === 'error') &&
            <AVAConfirm
              promptText={reactData.confirmPrompt}
              cancelText={'Go back'}
              confirmText={'*none*'}
              onCancel={() => {
                reactData.confirmStatus = '';
                setReactData(reactData);
                setForceRedisplay(!forceRedisplay);
              }}
              onConfirm={() => { }}
            >
            </AVAConfirm>
          }

          { /* Command Area */}
          {
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  {reactData?.textInput?.requestType && !(['meal'].includes(reactData.textInput.requestType)) &&
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
                          reactData.forceRedisplay = !reactData.forceRedisplay;
                          setReactData(reactData);
                          setForceRedisplay(!forceRedisplay);
                        }}
                      />
                    </React.Fragment>
                  }
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    onClick={() => {
                      if (factType === 'list') { onClose(); }
                      else {
                        reactData.cancelPending = true;
                        setReactData(reactData);
                        setForceRedisplay(!forceRedisplay);
                      };
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
                        let [cStatus, response] = makeConfirm(dataRows.displayRows, dataRows.checked, reactData.textInput);
                        reactData.confirmPrompt = response;
                        reactData.confirmStatus = cStatus;
                        setReactData(reactData);
                        setForceRedisplay(!forceRedisplay);
                      }}
                      startIcon={<CheckIcon size="small" />}
                    >
                      {'Confirm/Send'}
                    </Button>
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
