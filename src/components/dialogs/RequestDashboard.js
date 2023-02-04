import React from 'react';
import { Lambda } from 'aws-sdk';
import { Auth } from '@aws-amplify/auth';
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
import EditIcon from '@material-ui/icons/Edit';
import DeleteIcon from '@material-ui/icons/Delete';
import PrintIcon from '@material-ui/icons/Print';
import SendIcon from '@material-ui/icons/Send';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';


import Avatar from '@material-ui/core/Avatar';
import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import { makeDate, makeName, makeNumber, recordExists } from '../../util/AVAUtilities';
import MakeMessage from '../forms/MakeMessage';

const requestNames = {
  maint: 'Maintenance Request',
  meal: 'Meal Order',
  guest_room: 'Guest Room Reservation Request',
  trans: 'Transportation Request',
  breakfast: 'Breakfast Order'
};

const useStyles = makeStyles(theme => ({
  typeLine: {
    fontSize: theme.typography.fontSize * 1.5,
    flexGrow: 0,
    marginBottom: 0,
    fontWeight: 'bold'
  },
  textLine: {
    fontSize: theme.typography.fontSize * 1,
    flexGrow: 0,
    marginBottom: 0
  },
  statusLine: {
    fontSize: theme.typography.fontSize * 0.8,
    flexGrow: 0,
    marginBottom: 0
  },
  headerLine: {
    marginTop: theme.spacing(3.5),
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
  drowhead: {
    display: 'flex',
    marginTop: 10,
    fontSize: theme.typography.fontSize * 1.0,
    width: '100%',
    justifyContent: 'center',
    fontWeight: 'bold'
  },
  drowdetail: {
    fontSize: theme.typography.fontSize * 0.8,
    justifyContent: 'flex-start',
  },
  drowqual: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 10,
    justifyContent: 'flex-start',
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
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
  listItem: {
    marginTop: theme.spacing(1.5),
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

export default ({ session, filter = {}, seedData, onClose }) => {

  /* 
    filter: {
      person_id - only show this person
      request_type - (optional) only show requests of this type
      request_date - (optional)
          if string or number or array with one entry, choose only this date
          if array with exactly two entries, use as start and end
    }
  */

  const classes = useStyles();

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [cancelPending, setCancelPending] = React.useState(false);
  const [confirmStatus, setConfirmStatus] = React.useState('');
  const [confirmPrompt, setConfirmPrompt] = React.useState(false);

  const [checkedToSave, setCheckedToSave] = React.useState();

  const [textInput, setTextInput] = React.useState();
  const [initialLoadComplete, setLoadComplete] = React.useState();
  const [dataRows, setDataRows] = React.useState(seedData);

  const [promptForMessage, setPromptForMessage] = React.useState(false);
  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  //**  Initialize

  //**  Functions

  function toggleCheck(pI) {
    dataRows[pI].checked = !dataRows[pI].checked;
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  }

  function toggleOpen(pI) {
    dataRows[pI].open = !dataRows[pI].open;
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  }

  function createMessageText() {
    let mData = {};
    let mCount = 0;
    let pM = 'With regard to';
    dataRows.forEach(r => {
      if (r.checked) {
        if (!(r.request_type in mData)) { mData[r.request_type] = []; }
        mData[r.request_type].push(r.display_date);
        mCount++;
      }
    });
    if (mCount === 0) { return null; }
    if (mCount > 1) { pM += ` ${mCount} prior requests:`; }
    let linkWord = '';
    for (let t in mData) {
      let mL = mData[t].length - 1;
      pM += `${linkWord} my ${requestNames[t] || 'request'}`;
      if (mL > 0) { pM += 's'; }
      pM += ' from';
      for (let x = 0; x <= mL; x++) {
        if (mData[t][x].startsWith('Last ')) { pM += ` last ${mData[t][x].slice(5)}`; }
        else { pM += ` ${mData[t][x]}`; }
        if ((mL > 1) && (x < mL)) { pM += ','; }
        if ((x + 1) === (mL)) { pM += ' and'; }
      };
      linkWord = ', and';
    }
    return pM + '... ';
  }

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };


  // ** Under review
  /*
  async function getRequest(qP_in) {
    let qP_defaults = {
      'TableName': 'ServiceRequests',
    };
    let qP_keys = {
      'client_id': ['<pK>', 'foreign_key-index', 'local_key-index', 'last_status-index'],
      'request_id': '<pK>',
      'foreign_key': 'foreign_key-index',
      'on_behalf_of': 'ServiceRequestsByPerson',
      'local_key': 'local_key-index',
      'last_status': 'last_status-index',
      'requestor': 'requestor-type-index',
      'request_type': 'requestor-type-index'
    };
    let qP = {};
    Object.keys(qP_defaults).forEach(d => {
      if ((d in qP_in)) { qP[d] = qP_in[d]; }
      else {
        qP[d] = qP_defaults[d];
        delete qP_in[d];
      }
    });
    let keyCondition, filterExpression, expressionAttributes, indexName;
    Object.keys(qP_in).forEach(n => {
      if ((n in qP_keys)) { if (indexName && qP[d] = qP_in[d]; }
      else {
        qP[d] = qP_defaults[d];
        delete qP_in[d];
      }
    });
    {
      KeyConditionExpression: 'thread_id = :k AND begins_with(composite_key, :c)',
        FilterExpression: 'record_type = :t',
          ExpressionAttributeValues: {
        ':c': pCommonKey,
          ':k': pCommonKey.split('~')[0].slice(2),
            ':t': 'delivery';
      },
 
 
    }
    let ioIn = await dbClient
      .query(qP)
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          return [{ 'error': `No Internet connection or Security Violation` }];
        }
        return [{ error }];
      });
    if (mRecs && mRecs.hasOwnProperty('Items')) {
    }
 
  }
 
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
      let instruction = listValues[vIndex].split(/[~:]+/);
      if (instruction[1] && (instruction[1].charAt(0) === '[')) {
        let [, oControl, oValue] = instruction[1].split(/[=[\]]+/);
        switch (oControl) {
          case 'checkbox': {
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
      if (instruction[0]) {
        // CheckBox selection
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
      if (instruction[2]) {
        // Special Instruction - input = date, time, or file...  anything else is plain text prompt
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
    }
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
    let [readableDate, returnDate, returnDateStamp, returnDateYMD] = AVAUtilities('makeRelativeDate', event.target.value);
    textInput[this_item.text] = readableDate;
    textInput[this_item.text + '-stamped'] = returnDateStamp;
    textInput[this_item.text + '-date'] = returnDate;
    textInput[this_item.text + '-ymd'] = returnDateYMD;
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
 
  */

  return (
    <Dialog
      open={true || forceRedisplay}
      p={2}
      fullScreen
    >
      {/* Header with Title and Popup Menu */}
      <Box
        display='flex' flexDirection='row'
        className={classes.messageArea}
        key={'topBox'}
      >
        <Box display='flex' flexDirection='column' key={'titlesection'}>
          <Typography
            className={classes.title}
          >
            {`Requests for ${session.patient_display_name}`}
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
          <Avatar src={'https://ava-icons.s3.amazonaws.com/AVA+Logo.png'} />
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
                <Typography className={classes.popUpFooter} >{`AVA vers 23.1.28${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
              </Box>
            </MenuItem>
          </MenuList>
        </Menu>
      </Box>
      {dataRows &&
        <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
          <List  >
            {dataRows.map((this_item, this_index) => (
              <Box
                display='flex'
                flexDirection='row'
                key={'row' + this_index}
                className={classes.listItem}
                justifyContent='flex-start'
                padding={this_item.open ? 2 : 0}
                border={this_item.open ? 1 : 0}
                alignItems='center'
              >
                <Checkbox
                  edge='start'
                  checked={this_item.checked}
                  disableRipple
                  key={'checkbox' + this_index}
                  onClick={() => { toggleCheck(this_index); }}
                />
                <Box
                  display='flex'
                  flexDirection='row'
                  flexGrow={1}
                  key={'h2row' + this_index}
                  className={classes.inputRow}
                  justifyContent='space-between'
                  alignItems='center'
                  onClick={() => { toggleOpen(this_index); }}
                >
                  <Box
                    display='flex'
                    flexDirection='column'
                    key={'hcol' + this_index}
                    className={classes.inputRow}
                    justifyContent='flex-start'
                    alignItems='start'
                  >
                    {!filter.request_type &&
                      <Typography className={classes.typeLine}>{this_item.formatted_type}</Typography>
                    }
                    {!filter.request_date &&
                      <Typography className={classes.textLine}>{this_item.display_date}</Typography>
                    }
                    <Typography className={classes.textLine}>{this_item.last_status}</Typography>
                    {this_item.update_date &&
                      <Typography className={classes.textLine}>{this_item.update_date}</Typography>
                    }
                    {this_item.open &&
                      <React.Fragment>
                        <Typography className={classes.drowhead}>Details</Typography>
                        {this_item.formatted_request.map(dRow => (
                          <Typography className={(`drow${dRow[0]}` in classes) ? classes[`drow${dRow[0]}`] : classes.drowdetail}>{dRow[1]}</Typography>
                      ))}
                      </React.Fragment>
                    }
                  </Box>
                  {(this_item.open) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </Box>
              </Box>
            ))}
          </List>
        </Paper>
      }
      { /* Prompts */}
      {promptForMessage &&
        <MakeMessage
          titleText={'Follow-up'}
          promptText={`What should your message say?`}
          buttonText={'Send'}
          sender={{
            "client_id": session.client_id,
            "patient_id": session.patient_id,
            "patient_display_name": session.patient_display_name
          }}
          pRecipientID={'*select'}
          pRecipientName={''}
          onCancel={() => { setPromptForMessage(false); }}
          onComplete={() => { setPromptForMessage(false); }}
          setMethod={null}
          allowCancel={true}
          seedText={promptForMessage}
        />
      }
      { /* Command Area */}
      {
        <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
          <Box display='flex' flexDirection='column'>
            <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
              <Button
                className={classes.rowButtonDefault}
                onClick={() => {
                  onClose();
                }}
                startIcon={<CloseIcon size="small" />}
              >
                {'Exit'}
              </Button>
              <Button
                className={classes.rowButtonDefault}
                onClick={() => {

                }}
                startIcon={<EditIcon size="small" />}
              >
                {'Update Status'}
              </Button>
              {(filter.person_id || session.patient_id) &&
                <Button
                  className={classes.rowButtonDefault}
                  onClick={() => {
                    setPromptForMessage(createMessageText());
                  }}
                  startIcon={<EditIcon size="small" />}
                >
                  {'Send Follow-up'}
                </Button>
              }
              {(false) &&
                <Button
                  className={classes.rowButtonDefault}
                  onClick={() => {
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
    </Dialog >
  );
};
