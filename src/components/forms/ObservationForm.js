import React from 'react';
import { Lambda } from 'aws-sdk';
import { makeDate } from '../../util/AVADateTime';
import { putServiceRequest } from '../../util/AVAServiceRequest';

import makeStyles from '@material-ui/core/styles/makeStyles';

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

import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';

import Avatar from '@material-ui/core/Avatar';
import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';


import AVAConfirm from './AVAConfirm';

const useStyles = makeStyles(theme => ({
  textLine: {
    fontSize: theme.typography.fontSize * 1.3,
    flexGrow: 0,
    marginRight: '7px'
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
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
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
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
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
  },
  rowButtonDefault: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
  }
}));

export default ({ fact, factName, defaultValue, prompt, pClient, qualifiers, listValues, onSave, onClose }) => {

  const classes = useStyles();

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [cancelPending, setCancelPending] = React.useState(false);
  const [confirmStatus, setConfirmStatus] = React.useState('');
  const [confirmPrompt, setConfirmPrompt] = React.useState(false);

  const [checkedToSave, setCheckedToSave] = React.useState();

  const [textInput, setTextInput] = React.useState();
  const [initialLoadComplete, setLoadComplete] = React.useState();
  const [dataRows, setDataRows] = React.useState();

  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const factType = fact.activity_key.split('.')[0];

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:ObservationMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  if (!initialLoadComplete && defaultValue) {
    let defaultObj = {};
    (Array.isArray(defaultValue) ? [...defaultValue] : [defaultValue]).forEach(i => {
      let [key, value] = i.split('=');
      defaultObj[key] = value;
    });
    setTextInput(defaultObj);
  }

  /* value                       | meaning                                  | example                                                   */
  /* ---------                   | ----------                               | -------------                                             */

  /* headers...
  /* ~~<displayThis>             | section header                           | ~~Entree Choices                                          */

  /* check boxes...
  /* <textOnly>                  | selection/check box                      | Filet Mignon                                              */
  /*                             |                                          | Club Sandwich                                             */
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

  async function getObservations(pText, pObsKey, pChecked) {
    let workDataRows = dataRows;
    workDataRows.checked = pChecked;
    if (dataRows.hasOwnProperty(pText)) {
      setDataRows(workDataRows);
      setForceRedisplay(!forceRedisplay);
      return;
    }
    params.Payload = JSON.stringify({
      action: "get_observation_items",
      clientId: pClient,
      request: {
        "observation_key": pObsKey
      }
    });
    let invokeFailed = false;
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(() => {
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let oRecs = JSON.parse(fResp.Payload);
      if (oRecs.status === 200) {
        if (oRecs.body.options) {
          workDataRows[pText] = oRecs.body.options.display_value;
          let workChosenQ = {};
          if (workDataRows.hasOwnProperty('chosenQual')) {
            workChosenQ = workDataRows.chosenQual;
          }
          if (!workChosenQ.hasOwnProperty(pText)) {
            workChosenQ[pText] = {};
            oRecs.body.options.display_value.forEach(v => {
              if (v.default) {
                if (Array.isArray(v.default)) { workChosenQ[pText][v.title] = v.default; }
                else { workChosenQ[pText][v.title] = [v.default]; }
              }
              else { workChosenQ[pText][v.title] = []; }
            });
          }
          workDataRows.chosenQual = workChosenQ;
        }
      }
    };
    setDataRows(workDataRows);
    setForceRedisplay(!forceRedisplay);
  }

  function handleQualChecked(pOrderOption, pQualifier, pQualChoice) {
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

  if (!initialLoadComplete) {
    for (let vIndex = 0; vIndex < listValues.length; vIndex++) {
      // All rows are evaluated as follows "<instruction[0]>~<instruction[1]>:<instruction[2]>"
      // OR... "<instruction[0]>~~<instruction[1]>" (instruction[0] expected to be null/blank in thsi case)
      let instruction = listValues[vIndex].split(/[~:]+/);

      // This checks for rows in the form "~[<oControl>=<oValue on/off>]"
      if (instruction[1] && (instruction[1].charAt(0) === '[')) {
        let [, oControl, oValue] = instruction[1].split(/[=[\]]+/);
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
          default: { }
        }
        continue;
      }

      if (ignore) { continue; }

      // This handles any row without a leading "~"
      if (instruction[0]) {
        displayRowList.push({
          checkbox,
          required,
          text: instruction[0],
          oKey: getKey(instruction[0]),
          desc: getDescription(instruction[0]),
          input: false
        });
        continue;
      }

      // Dropping through to here means that instruction[0] was null/blank
      //    (ie. there was nothing before the first "~"; the row started with "~")
      // This handles rows in the form "~<instruction[1]>:<instruction[2]>", for example
      //     "~lambda:<instruction[2]>"
      if (instruction[2]) {
        displayRowList.push({
          checkbox: (instruction[1].includes('withCheckBox')),
          required: required || (instruction[1].includes('required')),
          text: instruction[2],
          oKey: getKey(instruction[2]),
          desc: getDescription(instruction[2]),
          input: instruction[1]
        });
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
    };
    setLoadComplete(true);
    setDataRows({ displayRows: displayRowList, dataRows: {}, checked: [] });
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
    textInput[this_item.text] = AVAdate.absolute;
    setTextInput(textInput);
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
    textInput[this_item.text] = `${hh}:${mm < 10 ? ('0' + mm) : mm} ${ampm}`;
    setTextInput(textInput);
  };

  const handleTextExit = (event, this_item) => {
    textInput[this_item.text] = event.target.value;
    setTextInput(textInput);
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
    let workChecked = [];
    let errorsExist = false;
    let errorMessage = ['Please correct these errors', '----'];
    let responseArray = [`Please confirm your selections`, '----'];
    pDisplayRows.forEach(r => {
      if (r.required && (!textInput.hasOwnProperty(r.text) || textInput[r.text] === '')) {
        errorsExist = true;
        errorMessage.push(`You left "${r.text}" blank!`);
      }
      if (r.checkbox || textInput.hasOwnProperty(r.text)) {
        let rText = '';
        if (pChecked.includes(r.text)) { rText = r.text; }
        if (textInput.hasOwnProperty(r.text) && (textInput[r.text].length > 0)) { rText = textInput[r.text]; }
        if (rText) {
          if (pChecked.includes(r.text)) { workChecked.push(rText); }
          responseArray.push(rText);
          if (dataRows.hasOwnProperty('chosenQual') && dataRows.chosenQual[r.text]) {
            for (let key in dataRows.chosenQual[r.text]) {
              if (dataRows.chosenQual[r.text][key] && (dataRows.chosenQual[r.text][key].length > 0)) {
                dataRows.chosenQual[r.text][key].forEach(qRow => {
                  responseArray.push(`[indent=1]${qRow}`);
                });
              }
            }
          }
        }
      }
    });
    setCheckedToSave(workChecked);
    if (errorsExist) { return ['error', errorMessage]; } else { return ['confirm', responseArray]; };
  }

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
                    <Typography className={classes.popUpFooter} >{`AVA vers 23.2.15${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                    <Typography className={classes.popUpFooter} >{`User ${fact.session.user_id}${fact.patient_id !== fact.session.user_id ? (' (' + fact.patient_id + ')') : ''}`}</Typography>
                    <Typography className={classes.popUpFooter} >{`Function: ObservationForm`}</Typography>
                    <Typography className={classes.popUpFooter} >{`Activity: ${fact.activity_key}`}</Typography>
                  </Box>
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>
          <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
            <List  >
              {dataRows.displayRows.map((this_item, this_index) => (
                <Box display='flex'
                  flexDirection='column'
                  margin={isChecked(this_item) ? 2 : 0}
                  border={isChecked(this_item) ? 1 : 0}
                  key={'fullRow' + this_index}
                >
                  <Box
                    display='flex'
                    flexDirection='row'
                    key={'row' + this_index}
                    className={this_item.input ? classes.inputRow : classes.listItem}
                    justifyContent='flex-start'
                    alignItems='center'
                  >
                    {this_item.checkbox &&
                      <Checkbox
                        edge='start'
                        checked={isChecked(this_item)}
                        disableRipple
                        key={'checkbox' + this_index}
                        onClick={async () => {
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
                        }}
                      />
                    }
                    <Typography
                      className={this_item.header ? classes.headerLine : classes.textLine}
                    >
                      {this_item.text}
                    </Typography>
                    {this_item.input &&
                      <TextField
                        className={classes.freeInput}
                        id={'text' + this_index}
                        variant={'standard'}
                        key={'text' + this_index}
                        multiline
                        onKeyPress={(event) => {
                          onCheckEnter(event, this_item);
                        }}
                        onChange={(event) => {
                          if (!textInput || (Object.keys(textInput).length === 0)) {
                            let tempText = {};
                            tempText[this_item.text] = event.target.value;
                            setTextInput(tempText);
                          }
                          else {
                            textInput[this_item.text] = event.target.value;
                            setTextInput(textInput);
                            setForceRedisplay(!forceRedisplay);
                          }
                        }}
                        onBlur={(event) => {
                          onCheckEnter(event, this_item);
                        }}
                        autoComplete='off'
                        value={(textInput && (Object.keys(textInput).length > 0)) ? textInput[this_item.text] : ''}
                      />
                    }
                  </Box>
                  {(this_item.desc && isChecked(this_item)) &&
                    <Typography className={classes.descText}>{this_item.desc}</Typography>
                  }
                  {showQualifier(this_item) &&
                    dataRows[this_item.text].map((qR, qRndx) => (
                      <Box
                        key={'qRow' + qRndx}
                        display="flex"
                        className={classes.qualOption}
                        flexDirection='column'
                        justifyContent="center"
                      >
                        <Box display='flex' flexDirection='column' justifyContent='center'
                          alignItems='flex-start' key={'qrRow' + qR.title}>
                          <Typography className={classes.qualText}>{qR.title}</Typography>
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
                                <Checkbox
                                  className={classes.radioButton}
                                  size="small"
                                  checked={isQChecked(this_item, qR, opt.display)} />
                                <Typography className={classes.radioText}>{opt.display}</Typography>
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
          </Paper>

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
                let rObj;
                if (factType !== 'list') {
                  rObj = await putServiceRequest(
                    {
                      client: pClient,
                      author: fact.patient_id,
                      requestType: fact.value.freeText.requestType,
                      onBehalfOf: textInput[fact.value.freeText.onBehalfOf] || fact.patient_id,
                      foreignKey: textInput[fact.value.freeText.foreignKey] || fact.value.freeText.foreignKey || '*tbd*',
                      request: { 'selections': checkedToSave, textInput, 'qualifiers': dataRows.chosenQual }
                    });
                }
                onSave((rObj ? rObj.request_id : ''), checkedToSave, textInput, dataRows.chosenQual);
              }}
            >
            </AVAConfirm>
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
                    className={classes.rowButtonDefault}
                    onClick={() => {
                      ((factType === 'list') ? onClose() : setCancelPending(true));
                    }}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Exit'}
                  </Button>
                  {(!factType || (factType !== 'list')) &&
                    <Button
                      className={classes.rowButtonDefault}
                      onClick={() => {
                        let [cStatus, response] = makeConfirm(dataRows.displayRows, dataRows.checked, textInput);
                        setConfirmPrompt(response);
                        setConfirmStatus(cStatus);
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
