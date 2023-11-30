import React from 'react';
import { sentenceCase, makeArray, isMobile, cl, titleCase, dbClient, recordExists, listFromArray } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { getImage, getPerson, makeName } from '../../util/AVAPeople';
import { getServiceRequests, updateServiceRequest, printServiceRequest } from '../../util/AVAServiceRequest';
import { getMessages, messageHistory } from '../../util/AVAMessages';
import MakeMessage from '../forms/MakeMessage';

import AVA_AlertSound from '../../ava_alert.mp3';

import IdleTimer from 'react-idle-timer';
import useSound from 'use-sound';

import { useSnackbar } from 'notistack';

import List from '@material-ui/core/List';

import CloseIcon from '@material-ui/icons/HighlightOff';
import CheckIcon from '@material-ui/icons/DoneSharp';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import FirstPageIcon from '@material-ui/icons/FirstPage';
import ClearAllIcon from '@material-ui/icons/ClearAll';

import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';

import SendIcon from '@material-ui/icons/Send';
import PrintIcon from '@material-ui/icons/Print';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import DoneAllIcon from '@material-ui/icons/DoneAll';

import Avatar from '@material-ui/core/Avatar';
import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  page: {
    height: 950,
    maxWidth: 1000
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
  },
  freeInput: {
    marginLeft: '25px',
    marginRight: 2,
    marginBottom: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: theme.spacing(1),
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
  },
  imageArea: {
    minWidth: '100px',
    maxWidth: '100px',
    minHeight: '100px',
    maxHeight: '100px',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  buttonArea: {
    maxWidth: 1000,
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  AVAButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    border: '0.75px solid gray',
    textTransform: 'none',
    textDecoration: 'none',
    textWrap: 'nowrap',
    fontWeight: 'bold',
    size: 'small',
  },
  listItem: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
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
    fontSize: theme.typography.fontSize * 1.0,
  },
  mrowhead: {
    marginTop: 10,
    fontSize: theme.typography.fontSize * 1.2,
    fontWeight: 'bold'
  },
  mrowdetail: {
    fontSize: theme.typography.fontSize * 1.0,
  },
  mrowqual: {
    fontSize: theme.typography.fontSize * 1.0,
    marginLeft: 10,
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
  firstName: {
    fontSize: theme.typography.fontSize * 1.4,
    marginRight: theme.spacing(1),
  },
  timeLine: {
    fontSize: theme.typography.fontSize * 1.4,
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  lastName: {
    fontWeight: 'bold',
    fontSize: theme.typography.fontSize * 1.8,
    marginTop: theme.spacing(-0.75),
  },
  messageArea: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(0),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
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
}));

export default ({ session, title, filter = { 'person_id': session.patient_id }, options = {}, onClose }) => {

  /*
    filter: {
      person_id - only show this person
      request_type - (optional) only show requests of this type
      selection - (optional) pre-set filter criteria
      request_date - (optional)
          if string or number or array with one entry, choose only this date
          if array with exactly two entries, use as start and end
    }
    options: {
      shortForm - when true, don't show image, history, or message details
      textForm - when true, show only requestor and selections (in a text format)
      updateMode - preselect first item
    }
  */

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const firstSelectedRowRef = React.useRef(null);

  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = React.useState('no_value');

  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  const [reactData, setReactData] = React.useState({
    rebuilding: false,
    selectedPersonName: null,
    displayVersion: 0,
    dataRows: [],
    requestIDs: [],
    selectionsChanged: false
  });

  const [promptForMessage, setPromptForMessage] = React.useState(false);

  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [play] = useSound(AVA_AlertSound, { volume: 1 });

  let rowsDisplayed = [];

  let dashboard_idleTimer = React.createRef();
  const oneMinute = 1000 * 60;
  const msBeforeSleeping = (options.idle_delay || 5) * oneMinute;

  const updateReactData = (newData, force = false) => {
    for (let oKey in newData) {
      setReactData((prevValues) => ({
        ...prevValues,
        [oKey]: newData[oKey],
      }));
    }
    if (force) {
      setForceRedisplay(forceRedisplay => !forceRedisplay);
    }
  };

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  const statusWords = {
    delivery: 'Delivered',
    open: 'Opened'
  };

  React.useEffect(() => {
    if (firstSelectedRowRef && firstSelectedRowRef.current) {
      firstSelectedRowRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [reactData.selectionsChanged]);

  async function handleUpdates(pOptions) {
    let historyLine = '';
    if (pOptions.newStatus) {
      switch (pOptions.newStatus.toLowerCase()) {
        case 'printed': {
          historyLine = `Printed`;
          break;
        }
        case 'completed':
        case 'complete': {
          historyLine = `Marked complete by ${await getPerson(session.user_id, 'name')}`;
          break;
        }
        default: {
          historyLine = `${await getPerson(session.user_id, 'name')} changed status to ${pOptions.newStatus}`;
        }
      }
    }
    let AVAdate = makeDate(new Date());
    historyLine += ` on ${AVAdate.absolute}`;
    let updateRows = [];
    let rowChanged = [];
    reactData.dataRows.forEach((r, x) => {
      rowChanged[x] = false;
      if (r.workData.checked && OKToDisplay(r)) {
        if ((pOptions.newStatus) && (r.last_status.toLowerCase() !== 'complete')) {
          reactData.dataRows[x].last_status = pOptions.newStatus;
          rowChanged[x] = true;
        }
        reactData.dataRows[x].last_update = AVAdate.timestamp;
        reactData.dataRows[x].workData.update_date = AVAdate.relative;
        if (('history' in reactData.dataRows[x]) && Array.isArray(reactData.dataRows[x].history)) {
          reactData.dataRows[x].history.unshift(historyLine);
        }
        else { reactData.dataRows[x].history = [historyLine]; }
        reactData.dataRows[x].workData.checked = false;
        updateRows.push(reactData.dataRows[x]);
      }
    });
    await updateServiceRequest(updateRows.map(u => {
      let w = Object.assign({}, u);
      delete w.workData;
      return w;
    }));
    rowsDisplayed = [];
    // have these rows now been disqualified based on the passed-in filter?
    if ((filter.hasOwnProperty('statusNot') && filter.statusNot.includes(pOptions.newStatus.toLowerCase()))
      || (filter.hasOwnProperty('status') && !(filter.status.includes(pOptions.newStatus.toLowerCase())))) {
      let revisedDataRows = reactData.dataRows.filter((r, x) => {
        return !rowChanged[x];
      });
      if (revisedDataRows.length > 0) {
        revisedDataRows[0].workData.checked = true;
      }
      updateReactData({
        dataRows: revisedDataRows
      }, true);
    }
    else {
      updateReactData({
        dataRows: reactData.dataRows
      }, true);
    }
  }

  function getSelectedDetails() {
    let selectedIDs = [];
    let selectedName = [];
    reactData.dataRows.forEach(row => {
      if (row.workData.checked && !selectedIDs.includes(row.workData.requestor_id)) {
        selectedIDs.push(row.requestor);
        selectedName.push(row.workData.requestor_name);
      }
    });
    return { selectedIDs, selectedName };
  }

  let filterTimeOut;
  const handleChangeFilter = vCheck => {
    clearTimeout(filterTimeOut);
    cl(`set timeout with ${vCheck} at ${new Date().getTime()}`);
    filterTimeOut = setTimeout(() => {
      cl(`timeout ended ${vCheck} at ${new Date().getTime()}`);
      if (vCheck.length === 0) {
        updateReactData({
          filterTextLower: ''
        });
      }
      else {
        updateReactData({
          filterTextLower: vCheck.toLowerCase()
        });
      }
    }, 500);
  };

  function OKToDisplay(this_item) {
    if ((!this_item.workData) || (!reactData.filterTextLower)) {
      return true;
    }
    else {
      return JSON.stringify(this_item).includes(reactData.filterTextLower);
    }
  }

  function toggleCheck(pI) {
    reactData.dataRows[pI].workData.checked = !reactData.dataRows[pI].workData.checked;
    updateReactData({
      dataRows: reactData.dataRows
    }, true);
  }

  function anyRowsSelected() {
    return reactData.dataRows.some(r => {
      return r.workData.checked;
    });
  }

  const firstSelectedRow = () => {
    return reactData.dataRows.findIndex(this_row => {  // find first checked row
      return this_row.workData.checked;
    });
  };

  const lastSelectedRow = () => {
    return reactData.dataRows.findLastIndex(this_row => {  // find last checked row
      return this_row.workData.checked;
    });
  };

  async function toggleOpen(pI) {
    reactData.dataRows[pI].workData.open = !reactData.dataRows[pI].workData.open;
    if (!reactData.dataRows[pI].workData.messageRecs) {
      reactData.dataRows[pI].workData.messageRecs = await prepareMessageHistory(reactData.dataRows[pI].request_id);
    }
    updateReactData({
      dataRows: reactData.dataRows
    }, true);
  }

  async function prepareMessageHistory(thread) {
    let qR = await getMessages({ 'thread_id': thread });
    let mRow = [];
    let workingKey = '';
    qR.forEach(r => {
      switch (r.record_type) {
        case 'message': {
          mRow.push({
            'sort': `${r.composite_key}.000`,
            'body': ['head', `Message ${makeDate(r.created_time).relative}`]
          });
          mRow.push({
            'sort': `${r.composite_key}.001`,
            'body': ['detail', 'Sent to:']
          });
          mRow.push({
            'sort': `${r.composite_key}~Z999.000`,
            'body': ['detail', 'Message said:']
          });
          r.content.current['EN-US'].text.split('\r\n').forEach((m, mX) => {
            mRow.push({
              'sort': `${r.composite_key}~Z999.${mX + 100}`,
              'body': ['qual', m]
            });
          });
          workingKey = r.composite_key;
          break;
        }
        case 'delivery': {
          let nameOut = (`${r.recipient_list.name.first} ${r.recipient_list.name.last}`).trim();
          let postedWord = makeDate(r.results[0].posted_time).relative;
          mRow.push({
            'sort': `${workingKey}.${r.recipient_list.name.last}/${r.recipient_list.name.first}`,
            'body': ['qual', `${nameOut} - ${statusWords[r.results[0].result] || r.results[0].result} ${postedWord}`]
          });
          break;
        };
        default: { }
      }
    });
    mRow.sort((a, b) => {
      if (a.sort > b.sort) { return 1; }
      if (a.sort < b.sort) { return -1; }
      return 0;
    });
    return mRow.map(r => { return r.body; });
  };

  const buildDashboard = async () => {
    let qList = [];
    let selectedPersonName = await makeName(filter.person_id);
    if ((!filter.hasOwnProperty('client_id') || !filter.client_id)) {
      filter.client_id = session.client_id;
    }
    filter.request_type = makeArray(filter.request_type, ',');
    if (!filter.hasOwnProperty('sort')) {
      filter.sort = {
        order: 'desc'
      };
    };
    qList = await getServiceRequests(filter);
    let maxTimeStamp = 0;
    reactData.dataRows = [];
    reactData.requestIDs = [];
    for (let x = 0; (x < qList.length); x++) {
      if (qList[x].request_date > maxTimeStamp) {
        maxTimeStamp = qList[x].request_date;
      }
      if (filter.hasOwnProperty('statusNot') && filter.statusNot.includes(qList[x].last_status.toLowerCase())) {
        continue;
      }
      else if (filter.hasOwnProperty('status') && !(filter.status.includes(qList[x].last_status.toLowerCase()))) {
        continue;
      }
      reactData.dataRows.push(await buildRequestDetails(qList[x]));
      reactData.requestIDs.push(qList[x].request_id);
    }
    if (loading !== 'rebuild') {
      updateReactData({
        lastTimeStamp: maxTimeStamp,
        dataRows: reactData.dataRows,
        requestIDs: reactData.requestIDs,
        rebuilding: false,
        selectedPersonName
      }, true);
    }
    if ((qList.length === 0) || (reactData.dataRows.length === 0)) {
      enqueueSnackbar(`No requests were found`, { variant: 'error', persist: false });
    }
    else {
      reactData.dataRows[0].workData.checked = true;
    }
    if (dashboard_idleTimer && dashboard_idleTimer.current) {
      dashboard_idleTimer.current.start();
      cl(`Idle timer started in dashboard at ${new Date().toLocaleString()}.`);
    }
  };

  const extendDashboard = async () => {
    if (reactData.rebuilding) {
      return;
    }
    let qQ = { TableName: 'ServiceRequestLog' };
    qQ.KeyConditionExpression = 'client_id = :c and log_time > :lt';
    qQ.ExpressionAttributeValues = { ':c': session.client_id, ':lt': reactData.lastTimeStamp };
    let qR = await dbClient
      .query(qQ)
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          console.log(`Security Violation or no Internet Connection`);
        }
        console.log({ 'Error reading ServiceRequests': error, index: qQ.IndexName, qQ });
      });
    let newRecordsFound = false;
    let maxTimeStamp = reactData.lastTimeStamp;
    let playAlert = false;
    if (recordExists(qR)) {
      for (let x = 0; (x < qR.Items.length); x++) {
        let newKey = qR.Items[x].request_id;
        if (!reactData.requestIDs.includes(newKey)) {
          let request_timestamp = Number(newKey.split('~').pop());
          if (!isNaN(request_timestamp)) {
            maxTimeStamp = Math.max(maxTimeStamp, request_timestamp);
            reactData.requestIDs.push(newKey);
            let qList = await getServiceRequests({
              client_id: session.client_id,
              request_id: newKey
            });
            if (filter.foreign_key && (filter.foreign_key === qList[0].foreign_key)) {
              if ((filter.hasOwnProperty('statusNot') && filter.statusNot.includes(qList[0].last_status.toLowerCase()))
                || (filter.hasOwnProperty('status') && !(filter.status.includes(qList[0].last_status.toLowerCase())))) {
                continue;
              }
              else {
                newRecordsFound = true;
                let newRow = await buildRequestDetails(qList[0]);
                reactData.dataRows.push(newRow);
                if (OKToDisplay(newRow)) {
                  playAlert = true;
                }
              }
            }
          }
        }
      }
    }
    if (newRecordsFound) {
      updateReactData({
        lastTimeStamp: maxTimeStamp,
        dataRows: reactData.dataRows
      }, true);
      if (playAlert) {
        play();
      }
    }
    if (dashboard_idleTimer && dashboard_idleTimer.current) {
      dashboard_idleTimer.current.start();
      cl(`Idle timer restarted in dashboard at ${new Date().toLocaleString()}.`);
    }
  };

  async function buildRequestDetails(i) {
    i.workData = {};
    i.workData.search_data = '';
    if (session.service_request_types.hasOwnProperty(i.request_type)) {
      i.workData.formatted_type = session.service_request_types[i.request_type].description || `${titleCase(i.request_type)}`;
    }
    else {
      cl(`request type "${i.request_type}" not in session.service_request_types`);
      i.workData.formatted_type = titleCase(i.request_type);
    }
    let [enteredBy, requestTimeStamp] = i.request_id.split('~');
    i.workData.enteredBy = enteredBy;
    if (!('request_date' in i)) { i.request_date = requestTimeStamp; }
    let AVAupdateDate = makeDate(i.last_update);
    let AVArequestDate = makeDate(i.request_date);
    i.workData.display_date = AVArequestDate.relative;    // the date/time the request was first created
    let anonymous = false;
    let requestorRec = await getPerson(i.requestor, '*all');
    i.workData.requestor_name = await makeName(i.requestor);
    if (i.requestor !== enteredBy) {
      i.workData.enteredBy_name = await makeName(enteredBy);
    }
    else {
      i.workData.enteredBy_name = i.workData.requestor_name;
    }
    i.workData.requestor_location = requestorRec.location;
    i.workData.requestor_image = await getImage(i.requestor);
    i.workData.formatted_request = [];
    i.workData.textBased_request = '';
    i.workData.update_date = AVAupdateDate.relative;
    i.workData.requestTime = AVArequestDate.timestamp;
    i.workData.orderForDate = makeDate(i.foreign_key);
    i.workData.this_status = sentenceCase(i.last_status);
    if ((!options.shortForm) && (!options.textForm)) {
      if (AVAupdateDate.relative !== AVArequestDate.relative) {
        i.workData.formatted_request.push(['head', `Updated: ${i.workData.update_date}`]);
      }
      i.workData.formatted_request.push(['head', `Current status: ${i.workData.this_status}`]);
      i.workData.formatted_request.push(['head', 'Details']);
    }
    if (('original_request' in i) && (typeof (i.original_request) !== 'string')) {
      anonymous = (i.original_request.selections && i.original_request.selections.join(' ').includes('anonymous'));
      let [fReq, fSearch, fText] = formatRequest(i, i.original_request);
      i.workData.textBased_request = `${AVArequestDate.relative} ` + (anonymous ? `Anonymous` : i.workData.requestor_name) + fText;
      i.workData.formatted_request.push(...fReq);
      i.workData.search_data += ` ${fSearch}`;
    }
    else {
      anonymous = i.original_request.includes('anonymous');
      i.workData.formatted_request.push(['detail', i.original_request || 'No information available']);
      i.workData.textBased_request = `${AVArequestDate.relative} ` + (anonymous ? `Anonymous` : i.workData.requestor_name) + i.original_request;
      i.workData.search_data += ` ${i.original_request}`;
    }
    if (i.attachments && (i.attachments.length > 0)) {
      i.attachments.forEach(a => {
        let fNArr = a.split('/').pop().split('.');
        fNArr.pop();
        let fName = decodeURI(fNArr.join('.'));
        i.workData.formatted_request.push([`href=${a}`, fName]);
      });
    }
    if (anonymous) {
      i.workData.requestor_name = 'Anonymous';
      i.workData.enteredBy_name = 'Anonymous';
      i.workData.requestor_location = null;
      i.workData.requestor_image = null;
    }
    i.workData.search_data += i.workData.requestor_name;
    if ((!options.shortForm) && (!options.textForm)) {
      if ('history' in i) {
        i.workData.formatted_request.push(['head', 'History']);
        if (typeof (i.history) === 'string') { i.workData.formatted_request.push(['detail', i.history]); }
        else if (Array.isArray(i.history)) {
          i.history.forEach(h => {
            if (typeof h === 'string') { i.workData.formatted_request.push(['detail', h]); }
          });
        }
        else {
          Object.values(i.history).forEach(h => { i.workData.formatted_request.push(['detail', h]); });
        }
      }
      let mHist = await messageHistory({
        thread_id: `svc_${i.request_type}/${i.request_id}`,
        type: 'delivery'
      });
      if (mHist && (mHist.length > 0)) {
        i.workData.formatted_request.push(['head', 'Messages']);
        mHist.map(h => { return i.workData.formatted_request.push(['detail', h]); });
      }
      i.workData.search_data += `~ ${requestorRec.location} ~ ${i.workData.requestor_name} ~ ${i.workData.enteredBy_name}`;
      if (['closed', 'completed', 'cancelled'].includes(i.last_status.toLowerCase())) {
        i.workData.search_data += ` ~ closed`;
      }
      else { i.workData.search_data += ` ~ open`; }
    }
    i.workData.checked = false;
    i.workData.open = false;
    return i;
  }

  function formatRequest(i, req) {
    let returnMessage = [];
    let returnText = '';
    let returnSearch = '';
    if (!('textInput' in req)) { req.textInput = {}; }
    if (!('qualifiers' in req)) { req.qualifiers = []; }
    if (!('selections' in req)) { req.selections = []; }
    if (i.workData.requestor_name !== i.on_behalf_of) {
      returnMessage.push(['detail', `For ${i.on_behalf_of}`]);
      returnText += ` on behalf of ${i.on_behalf_of}`;
    }
    returnText += ` - `;
    let textLink = '';
    req.selections.forEach(s => {
      let dLine = s.trim();
      let [selection, ...opts] = dLine.split(/[();,]/);
      let options = opts.map(o => { return o.trim(); });
      if (req.hasOwnProperty('qualifiers')
        && req.qualifiers.hasOwnProperty(selection.trim())
      ) {
        Object.values(req.qualifiers[selection.trim()]).forEach(choiceList => {
          choiceList.forEach(c => {
            let choice = c.trim();
            if (!options.includes(choice)) {
              options.push(choice);
            }
          });
        });
      }
      returnMessage.push(['detail', selection.trim()]);
      returnText += `${textLink} ${selection.trim()}`;
      let rTextList = [];
      if (options.length > 0) {
        // let q = parts.shift().split(/[;,]/);
        options.forEach(qx => {
          let outO = titleCase(qx.trim());
          if (outO !== '') {
            returnMessage.push(['qual', outO]);
            rTextList.push(outO);
          }
        });
      }
      if (s in req.textInput) {
        returnMessage.push(['qual', req.textInput[s]]);
        rTextList.push(req.textInput[s]);
        delete req.textInput[s];
      }
      if (rTextList.length > 0) {
        returnText += `(${rTextList.join(', ')})`;
        textLink = ';';
      }
      returnSearch += ` ${dLine}`;
    });   // done with all selections; is there any text left?
    for (let k in req.textInput) {
      if (['-stamped', '-date', '-ymd'].some(w => { return k.includes(w); })) { continue; }
      if (typeof req.textInput[k] === 'string') {
        if (req.textInput[k] !== i.on_behalf_of) {
          let kLow = k.toLowerCase().trim();
          returnSearch += ` ${req.textInput[k]}`;
          if (['description', 'summary', 'details'].some(w => { return kLow.includes(w); })) {
            returnMessage.unshift(['text', req.textInput[k]]);
          }
          else {
            returnMessage.push(['text', `${k} - ${req.textInput[k]}`]);
            returnText += `${textLink} ${req.textInput[k]}`;
          }
        }
      }
    };
    return [returnMessage, returnSearch, returnText];
  }

  React.useEffect(() => {
    async function initialize() {
      setLoading('initial_load');
      await buildDashboard();
      setLoading('load_complete');
    }
    initialize();
  }, [session]);  // eslint-disable-line react-hooks/exhaustive-deps


  // ******************

  return (
    <Dialog
      open={true || forceRedisplay}
      p={2}
      fullScreen
    >
      {reactData.dataRows &&
        <React.Fragment>
          {/* Idle timer always running */}
          <IdleTimer
            ref={dashboard_idleTimer}
            timeout={msBeforeSleeping}   // every "n" minutes
            onActive={() => {
              let now = new Date();
              cl(`Active in dashboard at ${now.toLocaleString()}.  Idle since ${new Date(dashboard_idleTimer.current.state.lastIdle).toLocaleString()}`);
            }}
            onIdle={async () => {
              cl(`Idle fired in dashboard at ${new Date().toLocaleString()}.  Last active at ${new Date(dashboard_idleTimer.current.state.lastActive).toLocaleString()}.   Previous idle at ${new Date(dashboard_idleTimer.current.state.lastIdle).toLocaleString()}`);
              await extendDashboard();
            }}
            startOnMount={true}
            debounce={250}
          />

          {/* Header with Avatar, Message, and VertMenu */}
          <Box
            display='flex' flexDirection='row'
            className={classes.messageArea}
            key={'topBox'}
          >
            <Box display='flex' flexDirection='column' key={'titlesection'}>
              <Typography
                className={classes.title}
                style={AVATextStyle({ size: 2.5, bold: true })}
              >
                {filter.person_id
                  ? reactData.selectedPersonName
                  : title
                }
              </Typography>
              {filter.foreign_key &&
                <Typography
                  className={classes.subTitle}
                  style={AVATextStyle({ size: 1.5 })}
                >
                  {`For: ${makeDate(filter.foreign_key).absolute}`}
                </Typography>
              }
              {filter.statusNot &&
                <Typography
                  className={classes.subTitle}
                  style={AVATextStyle({ size: 1.5 })}
                >
                  {`Status NOT: ${listFromArray(filter.statusNot, { sentenceCase: true, or: true })}`}
                </Typography>
              }
              {filter.status &&
                <Typography
                  className={classes.subTitle}
                  style={AVATextStyle({ size: 1.5 })}
                >
                  {`Status: ${listFromArray(filter.status, { sentenceCase: true, or: true })}`}
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
                    <Typography className={classes.popUpFooter} >{`User ${session.user_id}${session.patient_id !== session.user_id ? (' (' + session.patient_id + ')') : ''}`}</Typography>
                    <Typography className={classes.popUpFooter} >{`Function: RequestDashboard`}</Typography>
                  </Box>
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>

          {/* Text Filter */}
          <TextField
            id='List Filter'
            onChange={event => (handleChangeFilter(event.target.value))}
            className={classes.freeInput}
            helperText={isMobile ? 'Filter' : 'Type a few letters to filter the list'}
            inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
            FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
            variant={'standard'}
            autoComplete='off'
          />

          {/* Main List */}
          <Paper
            component={Box}
            variant='outlined'
            overflow='auto'
            square
          >
            <List  >
              <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                {rowsDisplayed = []}
              </Typography>
              {reactData.dataRows.map((this_item, index) => (
                (OKToDisplay(this_item, index) &&
                  <Paper
                    component={Box}
                    variant='outlined'
                    key={`paper_row_${index}_${this_item.workData.checked}`}
                  >
                    <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                      {rowsDisplayed.push(index)}
                    </Typography>
                    <Box display='flex'
                      flexDirection='column'
                      bgcolor={(this_item.workData.checked) ? 'antiqueWhite' : null}
                      ref={((firstSelectedRow() === index) || ((firstSelectedRow() === -1) && (rowsDisplayed.length === 1))) ? firstSelectedRowRef : null}
                      onContextMenu={async (e) => {
                        e.preventDefault();
                        enqueueSnackbar(<div>
                          Type={this_item.request_type}<br />
                          Requestor={this_item.requestor}<br />
                          ForeignKey={this_item.foreign_key}<br />
                          LastUpdate={makeDate(this_item.last_update).absolute}<br />
                          ReqTime={makeDate(this_item.workData.requestTime).absolute}<br />
                          OrderFor={this_item.workData.orderForDate.absolute}
                        </div>, { variant: 'info', persist: true });
                      }}>
                      <Box
                        display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                        key={this_item.message_id + 'r' + index}
                        className={classes.listItem}
                      >
                        {!options.textForm &&
                          <Box display='flex' onClick={() => { toggleOpen(index); }} flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'>
                            <Box display='flex' flexDirection='column'>
                              <Box display='flex' flexDirection='row'>
                                {!options.shortForm && !filter.person_id &&
                                  <Box
                                    className={classes.imageArea}
                                    component="img"
                                    minWidth={50}
                                    minHeight={50}
                                    maxWidth={50}
                                    border={1}
                                    alt=' '
                                    src={this_item.workData.requestor_image}
                                  />
                                }
                                <Box display='flex' flexDirection='column' marginBottom={1.5}>
                                  {filter.request_type && (filter.request_type.length > 1) &&
                                    <Typography
                                      variant='h5'
                                      style={AVATextStyle({ size: 1, italic: true })}
                                    >
                                      {this_item.workData.formatted_type}
                                    </Typography>
                                  }
                                  {!filter.person_id &&
                                    <Typography
                                      variant='h5'
                                      style={AVATextStyle({ size: 1.5, bold: true })}
                                      className={classes.firstName}
                                    >
                                      {`${this_item.workData.requestor_name} ${this_item.workData.requestor_location ? '(' + this_item.workData.requestor_location + ')' : ''}`}
                                    </Typography>
                                  }
                                  {this_item.workData.updated &&
                                    <Typography
                                      style={AVATextStyle({ size: 0.7 })}
                                    >
                                      {this_item.workData.updated}
                                    </Typography>
                                  }
                                  {!options.shortForm &&
                                    <React.Fragment>
                                      {(this_item.requestor !== this_item.workData.enteredBy) &&
                                        <Typography variant='h5' className={classes.firstName}>{`By ${this_item.workData.enteredBy_name}`}</Typography>
                                      }
                                      <Typography variant='h5' className={classes.firstName}>{this_item.workData.display_date}</Typography>
                                      {!(this_item?.workData?.orderForDate.error) &&
                                        <Typography variant='h5' className={classes.firstName}>{`For ${this_item?.workData?.orderForDate.relative}`}</Typography>
                                      }
                                    </React.Fragment>
                                  }
                                </Box>
                              </Box>
                              {this_item?.workData?.formatted_request && this_item.workData.formatted_request.map((mLine, mIndex) => (
                                (mLine[0].startsWith('href=')
                                  ?
                                  <a
                                    href={mLine[0].split('=')[1]}
                                    key={`attach-${mIndex}-href`}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    style={{ color: 'inherit', textDecoration: 'underline' }}>
                                    <Typography
                                      key={`attach-${mIndex}`}
                                      className={classes.mrowdetail}
                                    >
                                      {`Attachment: ${mLine[1]}`}
                                    </Typography>
                                  </a>
                                  :
                                  < Typography
                                    key={`prefLine-${mIndex}`}
                                    className={(`mrow${mLine[0]}` in classes) ? classes[`mrow${mLine[0]}`] : classes.mrowdetail}
                                  >
                                    {typeof mLine[1] === 'string' ? mLine[1] : (alert(index, mLine))}
                                  </Typography>
                                )
                              ))}
                              {this_item.workData.open &&
                                this_item.workData.messageRecs.map((mLine, dX) => (
                                  <Typography
                                    key={('mrow_out' + dX)}
                                    className={(`mrow${mLine[0]}` in classes) ? classes[`mrow${mLine[0]}`] : classes.mrowdetail}
                                  >
                                    {mLine[1]}
                                  </Typography>
                                ))
                              }
                            </Box>
                          </Box>
                        }
                        <Box display='flex' flexDirection='row'>
                          <Checkbox
                            checked={this_item.workData.checked || false}
                            disableRipple
                            key={'checkbox' + index}
                            onClick={() => { toggleCheck(index); }}
                          />
                        </Box>
                        {options.textForm &&
                          <Box display='flex' onClick={() => { toggleOpen(index); }} flexGrow={1} flexDirection='row' justifyContent='flex-start' alignItems='center'>
                            <Box display='flex' flexDirection='row'>
                              <Box
                                className={classes.imageArea}
                                component="img"
                                minWidth={50}
                                minHeight={50}
                                maxWidth={50}
                                border={1}
                                alt=' '
                                src={this_item.workData.requestor_image}
                              />
                            </Box>
                            < Typography
                              key={`singleTextLine-${index}`}
                              className={classes.mrowdetail}
                            >
                              {this_item.workData.textBased_request}
                            </Typography>
                          </Box>
                        }
                      </Box>
                    </Box>
                  </Paper>
                )
              ))}
              {(rowsDisplayed.length === 0) && (loading === 'load_complete') &&
                <Box display='flex' flex={4} justifyContent='center' alignItems='center' overflow='hidden'>
                  <Typography style={AVATextStyle({ size: 1.5, bold: true, align: 'center' })} >
                    {`No requests match your criteria`}
                  </Typography>
                </Box>
              }
            </List>
          </Paper>

          {/* Prompts */}
          {
            promptForMessage &&
            <MakeMessage
              titleText={null}
              promptText={[`What should your message say?`]}
              promptUse={['message']}
              buttonText={'Send'}
              sender={{
                "client_id": session.client_id,
                "patient_id": session.user_id,
                "patient_display_name": session.user_display_name
              }}
              pRecipientID={promptForMessage.selectedIDs}
              pRecipientName={promptForMessage.selectedName}
              onCancel={() => { setPromptForMessage(false); }}
              onComplete={() => { setPromptForMessage(false); }}
              setMethod={null}
              allowCancel={true}
            />
          }

          {/* Buttons */}
          {((loading === 'load_complete') || (reactData.dataRows.length > 0)) &&
            // Command Area
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    onClick={onClose}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Close'}
                  </Button>
                </Box>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  {anyRowsSelected() &&
                    (!filter.person_id) &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'orange', color: 'black' }}
                      size='small'
                      onClick={() => {
                        setPromptForMessage(getSelectedDetails());
                      }}
                      startIcon={<SendIcon size="small" />}
                    >
                      {'Message'}
                    </Button>
                  }
                  {anyRowsSelected()
                    &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'blue', color: 'white' }}
                      size='small'
                      onClick={async () => {
                        let printList = [];
                        reactData.dataRows.forEach(r => {
                          if (r.workData.checked) { printList.push(r); }
                          return;
                        });
                        let result = await printServiceRequest(printList, { PDF: true, fileName: 'test_PDF' });
                        enqueueSnackbar(result.message, { variant: (result.success ? 'success' : 'error'), persist: false });
                        await handleUpdates({
                          newStatus: 'Printed',
                        });
                      }}
                      startIcon={<PrintIcon size="small" />}
                    >
                      {'Print'}
                    </Button>
                  }
                  {anyRowsSelected()
                    &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'brown', color: 'white' }}
                      size='small'
                      onClick={async () => {
                        await handleUpdates({
                          newStatus: 'Complete',
                        });
                      }}
                      startIcon={<CheckIcon size="small" />}
                    >
                      {'Complete'}
                    </Button>
                  }
                </Box>
                {(rowsDisplayed.length > 0) &&
                  <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                    <Button
                      className={AVAClass.AVAButton}
                      disabled={(firstSelectedRow() === rowsDisplayed[0]) || (firstSelectedRow() === -1)}
                      style={{ backgroundColor: ((firstSelectedRow() === rowsDisplayed[0] || (firstSelectedRow() === -1)) ? 'white' : 'orange'), color: 'black' }}
                      size='small'
                      onClick={() => {
                        let firstRow = firstSelectedRow();
                        reactData.dataRows[firstRow].workData.checked = false;
                        let newSelectedRow = rowsDisplayed.findIndex(d => { return d === firstRow; }) - 1;
                        reactData.dataRows[newSelectedRow].workData.checked = true;
                        updateReactData({
                          dataRows: reactData.dataRows,
                          selectionsChanged: !reactData.selectionsChanged
                        }, true);
                      }}
                      startIcon={<ArrowBackIcon size="small" />}
                    >
                      {'Prior'}
                    </Button>
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'green', color: 'white' }}
                      size='small'
                      onClick={() => {
                        rowsDisplayed.forEach((r, x) => {
                          reactData.dataRows[r].workData.checked = (x === 0);
                        });
                        updateReactData({
                          dataRows: reactData.dataRows,
                          selectionsChanged: !reactData.selectionsChanged
                        }, true);
                      }}
                      startIcon={
                        <FirstPageIcon size="small" />}
                    >
                      {'First'}
                    </Button>
                    {anyRowsSelected() &&
                      <Button
                        className={AVAClass.AVAButton}
                        style={{ backgroundColor: 'pink', color: 'black' }}
                        size='small'
                        onClick={() => {
                          rowsDisplayed.forEach((r) => {
                            reactData.dataRows[r].workData.checked = false;
                          });
                          updateReactData({
                            dataRows: reactData.dataRows,
                            selectionsChanged: !reactData.selectionsChanged
                          }, true);
                        }}
                        startIcon={<ClearAllIcon size="small" />}
                      >
                        {'Unselect all'}
                      </Button>
                    }
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'green', color: 'white' }}
                      size='small'
                      onClick={() => {
                        rowsDisplayed.forEach((r, x) => {
                          reactData.dataRows[r].workData.checked = true;
                        });
                        updateReactData({
                          dataRows: reactData.dataRows,
                          selectionsChanged: !reactData.selectionsChanged
                        }, true);
                      }}
                      startIcon={<DoneAllIcon size="small" />}
                    >
                      {'All'}
                    </Button>
                    <Button
                      className={AVAClass.AVAButton}
                      disabled={(lastSelectedRow() === Math.max(...rowsDisplayed) || (lastSelectedRow() === -1))}
                      style={{ backgroundColor: ((lastSelectedRow() === Math.max(...rowsDisplayed) || (lastSelectedRow() === -1)) ? 'white' : 'orange'), color: 'black' }}
                      size='small'
                      onClick={() => {
                        let lastRow = lastSelectedRow();
                        reactData.dataRows[lastRow].workData.checked = false;
                        let newSelectedRow = rowsDisplayed.findLastIndex(d => { return d === lastRow; }) + 1;
                        reactData.dataRows[newSelectedRow].workData.checked = true;
                        updateReactData({
                          dataRows: reactData.dataRows,
                          selectionsChanged: !reactData.selectionsChanged
                        }, true);
                      }}
                      endIcon={<ArrowForwardIcon size="small" />}
                    >
                      {'Next'}
                    </Button>
                  </Box>
                }
              </Box>
            </DialogActions>
          }
        </React.Fragment >
      }
    </Dialog >
  );
};