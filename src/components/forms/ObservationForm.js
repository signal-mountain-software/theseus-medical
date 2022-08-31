import React from 'react';
import { Lambda } from 'aws-sdk';
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
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    marginBottom: 0,
    marginTop: 0,
    paddingLeft: 0,
    paddingRight: 50,
  },
  qualText: {
    fontSize: theme.typography.fontSize * 1.0,
    marginLeft: 0,
    marginBottom: 0,
    marginTop: 0,
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
    marginTop: theme.spacing(3),
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

export default ({ factName, defaultValue, pClient, qualifiers, listValues, onSave, onClose }) => {

  const classes = useStyles();

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [cancelPending, setCancelPending] = React.useState(false);
  const [confirmPending, setConfirmPending] = React.useState(false);
  const [confirmPrompt, setConfirmPrompt] = React.useState(false);
  const [checked, setChecked] = React.useState();
  const [checkedToSave, setCheckedToSave] = React.useState();
  const [chosenQual, setChosenQual] = React.useState();
  const [textInput, setTextInput] = React.useState();
  const [initialLoadComplete, setLoadComplete] = React.useState();
  const [displayRows, setDisplayRows] = React.useState();
  const [qualifierRows, setQualifierRows] = React.useState();

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
    let inputDefaults = defaultValue.split('~');
    inputDefaults.forEach(i => {
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
   
  /* prompt for response...
  /* ~other:<text>               | prompt for text response with <text>     | ~other:What is your name?                                */
  /* ~time:<text>                | prompt for time response with <text>     | ~time:What time would you like your meal?                */
  /* ~date:<text>                | prompt for date response with <text>     | ~date:What date would you like your meal?                */

  let displayRowList = [];
  let checkbox = true;
  let ignore = false;

  async function getObservations(pText, pObsKey) {
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
          let workQRows = {};
          if (qualifierRows) { workQRows = qualifierRows; }
          workQRows[pText] = oRecs.body.options.display_value;
          let workChosenQ = {};
          if (chosenQual) {
            workChosenQ = chosenQual;
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
          setChosenQual(workChosenQ);
          setQualifierRows(workQRows);
        }
      }
    };
  }

  function handleQualChecked(pOrderOption, pQualifier, pQualChoice) {
    let qRule = qualifierRows[pOrderOption].find(r => { return (r.title === pQualifier); });
    let workChosenQ = chosenQual;
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
    setChosenQual(workChosenQ);
    setForceRedisplay(!forceRedisplay);
  }

  function getKey(pText) {
    if (qualifiers.hasOwnProperty(pText) && qualifiers[pText].qualifiers) {
      let qKey = qualifiers[pText].qualifiers.find(q => { return (q.startsWith('~~key=')); });
      if (qKey) { return qKey.substr(6); }
    }
    return null;
  }

  if (!initialLoadComplete) {
    for (let vIndex = 0; vIndex < listValues.length; vIndex++) {
      let instruction = listValues[vIndex].split(/[~:]+/);
      if ((instruction[1]) && (instruction[1].charAt(0) === '[')) {
        let [, oControl, oValue] = instruction[1].split(/[=[\]]+/);
        switch (oControl) {
          case 'checkbox': {
            checkbox = (oValue.toLowerCase() === 'on');
            break;
          }
          case 'display': {
            ignore = (oValue.toLowerCase() === 'on');
            break;
          }
          default: { }
        }
        continue;
      }
      if (ignore) { continue; }
      if (instruction[0]) {
        // CheckBox selection
        displayRowList.push({
          checkbox,
          text: instruction[0],
          oKey: getKey(instruction[0]),
          input: false
        });
        continue;
      }
      if (instruction[2]) {
        // Special Instruction - input = date, time, or file...  anything else is plain text prompt
        displayRowList.push({
          checkbox: (instruction[1] === 'withCheckBox'),
          text: instruction[2],
          oKey: getKey(instruction[2]),
          input: instruction[1]
        });
        continue;
      }
      // Turns out, this is a header line in instruction[1]
      displayRowList.push({
        checkbox: false,
        text: instruction[1],
        oKey: getKey(instruction[1]),
        input: false,
        header: true
      });
    }
    setLoadComplete(true);
    setDisplayRows(displayRowList);
  }

  const onCheckEnter = (event, this_item) => {
    if (event.key === 'Enter' || event.type === 'blur') {
      if (this_item.input === 'date') { handleDateExit(event, this_item); }
      else if (this_item.input === 'time') { handleTimeExit(event, this_item); }
      else { handleTextExit(event, this_item); }
    }
    setForceRedisplay(!forceRedisplay);
  };

  const handleDateExit = (event, this_item) => {
    let goodDate = new Date(event.target.value);
    if (isNaN(goodDate)) {
      let tNext = event.target.value.trim().toLowerCase().startsWith('next');
      if (tNext) {
        let dayWord = event.target.value.split(' ')[1].trim();
        event.target.value = dayWord;
      }
      let tDate = event.target.value.substr(0, 3).toLowerCase();
      let dOfw = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(tDate);
      goodDate = new Date(Date.now());
      if (dOfw > -1) {
        if ((goodDate.getDay() > dOfw) && tNext) {
          tNext = false;
        }
        goodDate.setDate(goodDate.getDate() + ((7 - (goodDate.getDay() - dOfw)) % 7) + (tNext ? 7 : 0));
      }
      else if (tDate === 'tom') {
        goodDate.setDate(goodDate.getDate() + 1);
      }
      else if (tDate !== 'tod') {
        goodDate = new Date(event.target.value);
      }
    }
    let current = new Date(Date.now());
    current.setHours(0, 0, 0, 0);
    if (goodDate < current) {
      let yyyy = current.getFullYear();
      goodDate.setFullYear(yyyy);
      if (goodDate < current) { goodDate.setFullYear(yyyy + 1); }
    };
    textInput[this_item.text] = goodDate.toDateString();
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

  function makeConfirm(displayRows, checked, textInput) {
    let workChecked = [];
    let responseArray = [`Please confirm your selections`, '----'];
    displayRows.forEach(r => {
      let rText = '';
      if (checked.includes(r.text) || textInput[r.text]) { rText = r.text; }
      if (textInput[r.text]) { rText += (rText.length > 0 ? ': ' : '') + textInput[r.text]; }
      if (rText) {
        let linker = '';
        if (chosenQual[r.text]) {
          rText += ' (';
          for (let key in chosenQual[r.text]) {
            if (chosenQual[r.text][key] && (chosenQual[r.text][key].length > 0)) {
              rText += linker + chosenQual[r.text][key].join(', ');
            }
            linker = ', ';
          }
          rText += ')';
        }
        if (checked.includes(r.text)) { workChecked.push(rText); }
        responseArray.push(rText);
      }
    });
    setCheckedToSave(workChecked);
    return responseArray;
  }

  return (
    <Dialog
      open={true || forceRedisplay}
      p={2}
      fullScreen
    >
      {displayRows && displayRows.length > 0 &&
        <React.Fragment>
          <Box display='flex' flexDirection='column' key={'titlesection'}>
            <Typography
              className={classes.title}
            >
              {factName}
            </Typography>
            <Typography
              className={classes.subTitle}
            >
              {`Please select from these options`}
            </Typography>
          </Box>
          <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
            <List  >
              {displayRows.map((this_item, this_index) => (
                <Box display='flex' flexDirection='column' key={'fullRow' + this_index}>
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
                        checked={(!!checked && (checked.length > 0) && (checked.includes(this_item.text)))}
                        disableRipple
                        flexGrow={0}
                        key={'checkbox' + this_index}
                        onClick={async () => {
                          if (!checked || (checked.length === 0)) {
                            setChecked([this_item.text]);
                            await getObservations(this_item.text, this_item.oKey);
                          }
                          else {
                            let x = checked.indexOf(this_item.text);
                            let workChecked = checked;
                            if (x === -1) {
                              workChecked.push(this_item.text);
                              await getObservations(this_item.text, this_item.oKey);
                            }
                            else { workChecked.splice(x, 1); }
                            setChecked(workChecked);
                            setForceRedisplay(!forceRedisplay);
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
                  {checked && checked.includes(this_item.text) && qualifierRows && qualifierRows[this_item.text] &&
                    qualifierRows[this_item.text].map((qR, qRndx) => (
                      <Box
                        key={'qRow' + qRndx}
                        display="flex"
                        className={classes.qualOption}
                        flexDirection='column'
                        justifyContent="center"
                      >
                        <Box display='flex' flexDirection='row' justifyContent='flex-start'
                          alignItems='center' key={'qrRow' + qR.title}>
                          <Typography className={classes.qualText}>{qR.title}</Typography>
                          {qR.option.map((opt, oX) => (
                            <Box display='flex' flexDirection='row' justifyContent='flex-start'
                              alignItems='center' key={'qrOpt' + opt.display}
                              onClick={() => {
                                handleQualChecked(this_item.text, qR.title, opt.display);
                              }}
                            >
                              <Checkbox
                                className={classes.radioButton}
                                size="small"
                                checked={chosenQual && chosenQual[this_item.text] && chosenQual[this_item.text][qR.title] && chosenQual[this_item.text][qR.title].includes(opt.display)}
                              />
                              <Typography className={classes.radioText}>{opt.display}</Typography>
                            </Box>
                          ))}
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
            confirmPending &&
            <AVAConfirm
              promptText={confirmPrompt}
              onCancel={() => { setConfirmPending(false); }}
              onConfirm={() => { onSave(checkedToSave, textInput); }}
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
                    onClick={() => { setCancelPending(true); }}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Exit'}
                  </Button>
                  <Button
                    className={classes.rowButtonDefault}
                    onClick={() => {
                      setConfirmPrompt(makeConfirm(displayRows, checked, textInput));
                      setConfirmPending(true);
                    }}
                    startIcon={<CheckIcon size="small" />}
                  >
                    {'Confirm/Send'}
                  </Button>

                </Box>
              </Box>
            </DialogActions>
          }
        </React.Fragment>
      }
    </Dialog >
  );

};
