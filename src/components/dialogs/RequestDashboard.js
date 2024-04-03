import React from 'react';
import { sentenceCase, deepCopy, makeArray, isMobile, cl, titleCase, dbClient, recordExists, listFromArray } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { getImage, getPerson, makeName } from '../../util/AVAPeople';
import { getMemberList } from '../../util/AVAGroups';
import { getServiceRequests, updateServiceRequest, printServiceRequest } from '../../util/AVAServiceRequest';
import { getMessages, messageHistory, sendMessages } from '../../util/AVAMessages';
import MakeMessage from '../forms/MakeMessage';
import AVATextInput from '../forms/AVATextInput';

import AVA_AlertSound from '../../ava_alert.mp3';
import SearchIcon from '@material-ui/icons/Search';

import IdleTimer from 'react-idle-timer';

import useSound from 'use-sound';

import { useSnackbar } from 'notistack';
import useSession from '../../hooks/useSession';

import List from '@material-ui/core/List';
import PersonFilter from '../forms/PersonFilter';
import SelectFromList from '../forms/SelectFromList';

import PersonAddIcon from '@material-ui/icons/PersonAdd';
import CloseIcon from '@material-ui/icons/HighlightOff';
import CheckIcon from '@material-ui/icons/DoneSharp';
import ClearAllIcon from '@material-ui/icons/ClearAll';
import DoneAllIcon from '@material-ui/icons/DoneAll';

import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import TextField from '@material-ui/core/TextField';

import SendIcon from '@material-ui/icons/Send';
import PrintIcon from '@material-ui/icons/Print';

import { AVAclasses, AVATextStyle, AVADefaults, AVATextVariableStyle } from '../../util/AVAStyles';

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
    marginLeft: '2px',
    marginRight: 2,
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(1),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: theme.spacing(1),
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
  },
  imageArea: {
    minWidth: '80px',
    maxWidth: '80px',
    minHeight: '80px',
    maxHeight: '80px',
    marginRight: theme.spacing(1),
  },
  formControlLbl: {
    marginRight: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 2,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 5,
  },
  buttonArea: {
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
    alignItems: 'start',
    justifyContent: 'flex-start',
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(0),
    marginRight: theme.spacing(0),
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
      person_id - only show requests made by or assigned to this person
      request_type - (optional) only show requests of this type
      selection - (optional) pre-set filter criteria
      request_date - (optional)
          if string or number or array with one entry, choose only this date
          if array with exactly two entries, use as start and end
    }
    options: {
      shortForm - when true, don't show image, history, or message details
      textForm - when true, show only requestor and selections (in a text format)
      allowAssign - when items are selected, the "assign" button will be shown.  allowAssign should contain an array (list) of groups that assignees can be selected from
      updateMode - preselect first item
      viewMode - no search field; no changes allowed; show "add new request"; onClose carries instruction for next step
    }
  */

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { state } = useSession();

  const firstSelectedRowRef = React.useRef(null);

  const { enqueueSnackbar } = useSnackbar();

  const [loading, setLoading] = React.useState('no_value');
  const [unmount, setUnmount] = React.useState();
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  let filterIn = { filtering: false };
  if (filter.status || ((filter.statusNot && !filter.showNotBox))) {
    filterIn.statusNot = false;
    filterIn.filtering = true;
    filterIn.fields = { status: {} };
    filter.status = (filter.status || []).concat((filter.statusNot || []));
    filter.status.forEach(f => {
      filterIn.fields.status[f] = true;
    });
  }
  else if (filter.statusNot && filter.showNotBox) {
    filterIn.statusNot = true;
    filterIn.filtering = true;
    filterIn.fields = { status: {} };
    filter.statusNot.forEach(f => {
      filterIn.fields.status[f] = true;
    });
  }

  const [reactData, setReactData] = React.useState({
    rebuilding: false,
    selectedPersonName: null,
    displayVersion: 0,
    dataRows: [],
    OGFilter: deepCopy(filter),
    pageTitle: title.split(/\(/).shift().trim(),
    requestIDs: [],
    selectionsChanged: false,
    selectAssignTo: false,
    selectStatus: false,
    choiceList: [],
    statusList: [],
    isMobile: isMobile(),
    showStaffAccess: false,
    statusObj: {},
    filter: deepCopy(filterIn),
    filterTextLower: (filter.filterText ? filter.filterText.toLowerCase() : null)
  });

  const [promptForMessage, setPromptForMessage] = React.useState(false);

  const [play] = useSound(AVA_AlertSound, { volume: 1 });

  let rowsDisplayed = [];

  let dashboard_idleTimer = React.createRef();
  const oneMinute = 1000 * 60;
  const msBeforeSleeping = (options.idle_delay || 5) * oneMinute;

  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  function allRowsSelected() {
    let selectedCount = 0;
    let filtered = reactData.dataRows.filter(f => {
      if (OKToDisplay(f)) {
        if (f.workData.checked) {
          selectedCount++;
        }
        return true;
      }
      return false;
    });
    return { count: filtered.length, allChecked: (selectedCount === filtered.length) };
  }

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

  function makeGreeting(pName) {
    if (state.session?.custom_greeting) { return `${state.session.custom_greeting}${pName ? ', ' + pName : ''}!`; }
    else { return `Good ${makeDate(new Date()).dayPart}${pName ? ', ' + pName : ''}!`; }
  }

  const handleChangeStatusSelection = statusIn => {
    let statusWord = statusIn.toLowerCase();
    if (!reactData.filter.fields.status.hasOwnProperty(statusWord)
      || !reactData.filter.fields.status[statusWord]) {
      reactData.filter.fields.status[statusWord] = true;
      reactData.filter.filtering = true;
    }
    else {
      reactData.filter.fields.status[statusWord] = false;
      reactData.filter.filtering = Object.values(reactData.filter.fields.status).some(f => {
        return f;
      });
    }
    updateReactData({
      filter: reactData.filter
    }, true);

  };

  const handleStatusNot = event => {
    if (!reactData.filter.hasOwnProperty('statusNot')) {
      reactData.filter.statusNot = true;
    }
    else {
      reactData.filter.statusNot = !reactData.filter.statusNot;
    }
    updateReactData({
      filter: reactData.filter
    }, true);

  };

  async function handleUpdates(pOptions) {
    let historyLine;
    let messageStatusText;
    let assignedToName;
    if (pOptions.newStatus) {
      switch (pOptions.newStatus.toLowerCase()) {
        case 'printed': {
          historyLine = `Printed`;
          break;
        }
        case 'completed':
        case 'complete': {
          historyLine = `Marked complete by ${await getPerson(session.user_id, 'name')}`;
          messageStatusText = `marked it as complete`;
          break;
        }
        case 'assigned': {
          break;
        }
        default: {
          historyLine = `${await getPerson(session.user_id, 'name')} changed status to ${titleCase(pOptions.newStatus.replace('_', ' '))}`;
          messageStatusText = `changed the status to ${(pOptions.newStatus.replace('_', ' '))}`;
        }
      }
    }
    if (pOptions.assigned_to) {
      if (historyLine) {
        historyLine += ` and `;
      }
      else {
        historyLine = '';
      }
      assignedToName = await getPerson(pOptions.assigned_to, 'name');
      historyLine += `Assigned to ${assignedToName}`;
    }
    let AVAdate = makeDate(new Date());
    if (historyLine) {
      historyLine += ` on ${AVAdate.absolute}`;
    }
    let updateRows = [];
    let rowChanged = [];
    let rowSelected = [];
    let statusChanged = [];
    let assignmentChanged = [];
    let myNote;
    if (pOptions.enteredNote) {
      myNote = `Note added by ${await getPerson(session.user_id, 'name')} on ${AVAdate.absolute}: ${pOptions.enteredNote}`;
    }
    for (let x = 0; x < reactData.dataRows.length; x++) {
      let r = reactData.dataRows[x];
      rowChanged[x] = false;
      rowSelected[x] = false;
      statusChanged[x] = false;
      assignmentChanged[x] = false;
      if (r.workData.checked && OKToDisplay(r)) {
        rowSelected[x] = true;
        if (historyLine) {
          if (('history' in reactData.dataRows[x]) && Array.isArray(reactData.dataRows[x].history)) {
            reactData.dataRows[x].history.unshift(historyLine);
          }
          else { reactData.dataRows[x].history = [historyLine]; }
        }
        if (myNote) {
          if (('history' in reactData.dataRows[x]) && Array.isArray(reactData.dataRows[x].history)) {
            reactData.dataRows[x].history.unshift(myNote);
          }
          else { reactData.dataRows[x].history = [myNote]; }
        }
        if ((pOptions.newStatus) && (r.last_status.toLowerCase() !== pOptions.newStatus)
          && reactData.statusList.some(v => {
            return (v.value.toLowerCase() === pOptions.newStatus.toLowerCase());
          })) {
          reactData.dataRows[x].last_status = pOptions.newStatus;
          statusChanged[x] = true;
          rowChanged[x] = true;
        }
        if (pOptions.assigned_to) {
          if (reactData.dataRows[x].assigned_to !== pOptions.assigned_to) {
            reactData.dataRows[x].assigned_to = pOptions.assigned_to;
            assignmentChanged[x] = true;
            rowChanged[x] = true;
          }
        }
        else {
          if (!reactData.dataRows[x].assigned_to) {
            reactData.dataRows[x].assigned_to = 'unassigned';
          }
        }
        reactData.dataRows[x].last_update = AVAdate.timestamp;
        reactData.dataRows[x].workData.update_date = AVAdate.relative;
        reactData.dataRows[x].workData.checked = false;
        let newFormattedRequest = await buildRequestDetails(reactData.dataRows[x]);
        reactData.dataRows[x].workData.formatted_request = newFormattedRequest.workData.formatted_request;
        updateRows.push(reactData.dataRows[x]);
      }
    };
    await updateServiceRequest(updateRows.map(u => {
      let w = Object.assign({}, u);
      delete w.workData;
      return w;
    }));
    rowsDisplayed = [];
    // if we assigned one or more requests to somebody, send them message(s) notifying them
    if (pOptions.assigned_to) {
      for (let this_index = 0; this_index < reactData.dataRows.length; this_index++) {
        if (rowChanged[this_index]) {
          let messageText = `A ${reactData.dataRows[this_index].workData.formatted_type},`;
          messageText += ` entered by ${reactData.dataRows[this_index].workData.enteredBy_name}`;
          messageText += ` on ${reactData.dataRows[this_index].workData.display_date}`;
          messageText += ` has been assigned to you.  \r\n`;
          if (reactData.dataRows[this_index].original_request.selections
            && reactData.dataRows[this_index].original_request.selections.length > 0) {
            messageText += `${reactData.dataRows[this_index].workData.enteredBy_name.split(' ').shift()} selected`;
            messageText += ` ${listFromArray(reactData.dataRows[this_index].original_request.selections)}.  \r\n`;
          }
          for (let topic in reactData.dataRows[this_index].original_request.textInput) {
            messageText += `${topic}: ${reactData.dataRows[this_index].original_request.textInput[topic]}  \r\n`;
          }
          let messageObj = {
            client: session.client_id,
            author: session.user_id,
            messageText: messageText,
            thread_id: `svc_${reactData.dataRows[this_index].request_type}/${reactData.dataRows[this_index].request_id}`,
            recipientList: pOptions.assigned_to,
            subject: `${reactData.dataRows[this_index].workData.formatted_type} assigned to you`
          };
          await sendMessages(messageObj);
          reactData.dataRows[this_index].messages.unshift(messageObj);
        }
      }
    }
    // this section sends messages to those that were flagged to be notified
    if (pOptions.notify && pOptions.notify.length > 0) {
      let messageAuthor = await getPerson(session.user_id, 'name');
      for (let this_index = 0; this_index < reactData.dataRows.length; this_index++) {
        if (rowSelected[this_index]) {
          let notifyMessage;
          if (messageStatusText && statusChanged[this_index]) {
            notifyMessage = `${messageAuthor} has updated your ${reactData.dataRows[this_index].workData.formatted_type} from ${reactData.dataRows[this_index].workData.display_date}.  They`;
            notifyMessage += ` ${messageStatusText}`;
          }
          if (assignedToName && assignmentChanged[this_index]) {
            if (notifyMessage) {
              notifyMessage += ` and assigned it to ${assignedToName}.`;
            }
            else {
              notifyMessage = `${messageAuthor} assigned your ${reactData.dataRows[this_index].workData.formatted_type} from ${reactData.dataRows[this_index].workData.display_date} to ${assignedToName}.`;
            }
          }
          if (pOptions.enteredNote) {
            if (notifyMessage) {
              notifyMessage += `  They also added this note: "${pOptions.enteredNote}".`;
            }
            else {
              notifyMessage = `${messageAuthor} added a note to your ${reactData.dataRows[this_index].workData.formatted_type} from ${reactData.dataRows[this_index].workData.display_date}.  It says "${pOptions.enteredNote}"`;
            }
          }
          let recipientList = pOptions.notify.filter(n => {
            return ((n === reactData.dataRows[this_index].workData.enteredBy) || (n = reactData.dataRows[this_index].requestor));
          })
          if (notifyMessage) {
            let messageObj = {
              client: session.client_id,
              author: session.user_id,
              messageText: notifyMessage,
              thread_id: `svc_${reactData.dataRows[this_index].request_type}/${reactData.dataRows[this_index].request_id}`,
              recipientList: recipientList,
              subject: `Update to your ${reactData.dataRows[this_index].workData.formatted_type}`
            };
            await sendMessages(messageObj);
            reactData.dataRows[this_index].messages.unshift(messageObj);
          }
        }
      }
    }
    updateReactData({
      dataRows: reactData.dataRows
    }, true);
  }

  function exitModule(instruction) {
    onClose(instruction);
    setUnmount(true);
    return;
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

  async function handlePrintRequest() {
    let printList = [];
    reactData.dataRows.forEach(r => {
      if (r.workData.checked) { printList.push(r); }
      return;
    });
    let result = await printServiceRequest(printList, { PDF: true, fileName: 'test_PDF', request_type: "force_print" });
    enqueueSnackbar(result.message, { variant: (result.success ? 'success' : 'error'), persist: false });
    if (result.success) {
      result.preparedMessages.forEach(m => {
        if (m.preferred_method !== 'email') {
          if (m.attachments) {
            window.open(m.attachments.Location);
          }
          else if (m.pdfInfo && m.pdfInfo.s3Location) {
            window.open(m.pdfInfo.s3Location);
          }
        }
      });
      await handleUpdates({
        newStatus: 'Printed',
      });
    }
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
        }, true);
      }
      else {
        updateReactData({
          filterTextLower: vCheck.toLowerCase()
        }, true);
      }
    }, 500);
  };

  function OKToDisplay(this_item) {
    if (reactData.filter.filtering) {
      if (reactData.filter.fields.status[this_item.last_status.toLowerCase()]) {
        // We know we're filtering for something, and it turns out we care about this item
        // because it's status is checked off.  Reject the line if we are looking for rows
        // whose status is NOT this status
        if (reactData.filter.statusNot) {
          return false;
        }
      }
      else if (!reactData.filter.statusNot) {
        // We know we're filtering for something, but this item's status is not being filtered for at all
        // If status NOT is false, then we are rejecting items that have a status that is not
        // checked off, so reject me
        return false;
      }
    }
    // You are OK on status.  Check for search words...
    if ((!this_item.workData) || (!reactData.filterTextLower)) {
      return true;
    }
    else {
      return Object.values(this_item.workData).join(' ').toLowerCase().includes(reactData.filterTextLower);
    }
  }

  function toggleCheck(pI) {
    reactData.dataRows[pI].workData.checked = !reactData.dataRows[pI].workData.checked;
    updateReactData({
      dataRows: reactData.dataRows
    }, true);
  }

  function commonStatus() {
    let commonStatus;
    let multipleStatuses = reactData.dataRows.some(row => {
      if (row.workData.checked) {
        if (!commonStatus) {
          commonStatus = row.last_status;
          return false;
        }
        return (row.last_status !== commonStatus);
      }
      return false;
    });
    if (multipleStatuses) {
      return null;
    }
    else {
      return commonStatus;
    }
  }

  function getRequestors() {
    let response = {};
    reactData.dataRows.forEach(r => {
      if (r.workData.checked) {
        if (response.hasOwnProperty(r.workData.enteredBy)) {
          response[r.workData.enteredBy].count++
        }
        else {
          response[r.workData.enteredBy] = {
            name: r.workData.enteredBy_name,
            count: 1
          }
        }
        if (r.requestor !== r.workData.enteredBy) {
          if (response.hasOwnProperty(r.requestor)) {
            response[r.requestor].count++;
          }
          else {
            response[r.requestor] = {
              name: r.on_behalf_of,
              count: 1
            };
          }
        }
      }
    });
    return response;
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

  async function toggleOpen(pI) {
    reactData.dataRows[pI].workData.open = !reactData.dataRows[pI].workData.open;
    if (!reactData.dataRows[pI].workData.messageRecs) {
      reactData.dataRows[pI].workData.messageRecs = await prepareMessageHistory(reactData.dataRows[pI].request_id);
    }
    updateReactData({
      dataRows: reactData.dataRows
    }, true);
  }

  async function getCurrentStatus(client_id, person_id, mode) {
    let reqArray = await getServiceRequests({ client_id, person_id, foreign_key: mode, request_type: "checkout" });
    if (reqArray.length === 0) {
      return {
        last_status: 'none',
        last_update: 0,
        history: [],
        last_visited_name: await makeName(state.patient.person_id)
      };
    }
    else {
      let returnObj = {
        last_update: reqArray[0].last_update,
        last_visited: reqArray[0].last_visited,
        history: reqArray[0].history,
        reqRec: reqArray[0]
      };
      if ((reqArray[0].last_visited && (reqArray[0].last_status === 'in'))) {
        returnObj.last_status = 'in';
        returnObj.last_visited_name = (reqArray[0].last_visited ? await makeName(reqArray[0].last_visited) : '');
      }
      else {
        returnObj.last_status = 'out';
        returnObj.last_visited_name = await makeName(state.patient.person_id);
      }
      return returnObj;
    }
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
    await setStatusList();
    let qList = [];
    if (filter.assigned_to) {
      updateReactData({
        selectedPersonName: `Requests assigned to ${await makeName(filter.assigned_to)}`
      }, true);
    }
    else if (filter.person_id) {
      let pName = await makeName(filter.person_id);
      updateReactData({
        selectedPersonName: `${pName}'${pName.slice(-1) === 's' ? '' : 's'} Requests`
      }, true);
    }
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
      /*
      if (filter.statusNot && filter.statusNot.includes(qList[x].last_status.toLowerCase())) {
        continue;
      }
      else if (filter['status'] && !(filter.status.includes(qList[x].last_status.toLowerCase()))) {
        continue;
      }
      */
      reactData.dataRows.push(await buildRequestDetails(qList[x]));
      reactData.requestIDs.push(qList[x].request_id);
      if ((x % 5) === 0) {    // every 5th entry, commit to the screen
        updateReactData({
          lastTimeStamp: maxTimeStamp,
          dataRows: reactData.dataRows,
          requestIDs: reactData.requestIDs,
          rebuilding: false,
        }, true);
      }
    }
    if (loading !== 'rebuild') {
      updateReactData({
        lastTimeStamp: maxTimeStamp,
        dataRows: reactData.dataRows,
        requestIDs: reactData.requestIDs,
        rebuilding: false,
      }, true);
    }
    if ((qList.length === 0) || (reactData.dataRows.length === 0)) {
      enqueueSnackbar(`No requests were found`, { variant: 'error', persist: false });
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
              /*
              if ((filter.statusNot && filter.statusNot.includes(qList[0].last_status.toLowerCase()))
                || (filter['status'] && !(filter.status.includes(qList[0].last_status.toLowerCase())))) {
                continue;
              }
              else {
              */
              newRecordsFound = true;
              let newRow = await buildRequestDetails(qList[0]);
              reactData.dataRows.push(newRow);
              if (OKToDisplay(newRow)) {
                playAlert = true;
              }
              // }
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
    i.workData.summary_request = [];
    i.workData.textBased_request = '';
    i.workData.update_date = AVAupdateDate.relative;
    i.workData.requestTime = AVArequestDate.timestamp;
    i.workData.orderForDate = makeDate(i.foreign_key);
    i.workData.this_status = sentenceCase(i.last_status);
    if (!options.textForm) {
      i.workData.formatted_request.push(['head', `Current status: ${(titleCase(i.last_status.replace('_', ' ')))}`]);
    }
    if ((!options.shortForm) && (!options.textForm)) {
      if (AVAupdateDate.relative !== AVArequestDate.relative) {
        i.workData.formatted_request.push(['head', `Updated: ${i.workData.update_date}`]);
      }
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
    i.workData.summary_request = i.workData.formatted_request;
    if ((!options.textForm)) {
      i.workData.formatted_request = [];
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
      if (['closed', 'completed', 'complete', 'cancelled'].includes(i.last_status.toLowerCase())) {
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
            returnText += `${textLink} ${req.textInput[k]}`;
          }
          else {
            returnMessage.push(['text', `${k} - ${req.textInput[k]}`]);
            returnText += `${textLink} ${k} - ${req.textInput[k]}`;
          }
        }
      }
    };
    return [returnMessage, returnSearch, returnText];
  }

  const setChoices = async (inList) => {
    if (reactData.choiceList.length > 0) { return; }
    let response = [];
    let memberInfo = await getMemberList(inList, session.client_id, { "sort": true, "exclude": false });
    /* getMemberList returns
        {
          peopleList: [<People records of the members>],
          groupList: [<Group records for the selected groups>]
        }
    */
    let mInfo;
    let pLL = memberInfo.peopleList.length;
    for (let e = 0; e < pLL; e++) {
      let p = memberInfo.peopleList[e];
      let searchString = [...Object.values(p.name), p.search_data, p.location].join(' ');
      if (p.messaging) { searchString += Object.values(p.messaging).join(' '); }
      // list is of the form <name>:<id>:<search_string>
      try {
        mInfo = `${p.name.last}, ${p.name.first}:${p.person_id}:${searchString}`;
        response.push(mInfo);
      }
      catch (error) {
        cl(`response push error at index ${e} with ${mInfo}`);
      }
    };
    updateReactData({
      choiceList: response
    }, false);
  };

  const setStatusList = async (inList) => {
    if (reactData.statusList.length > 0) { return; }
    let response = [];
    if (filter.request_type
      && (state.session.service_request_types.hasOwnProperty(filter.request_type[0]))
      && state.session.service_request_types[filter.request_type[0]].statusList) {
      response = state.session.service_request_types[filter.request_type[0]].statusList;
    }
    else {
      response = [
        {
          display: 'Submitted',
          value: 'submitted'
        },
        {
          display: 'In Process',
          value: 'in_process'
        },
        {
          display: 'Complete/Closed',
          value: 'complete'
        }
      ];
    }
    updateReactData({
      statusList: response
    }, false);
  };


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
      open={(true || forceRedisplay) && !unmount}
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
            key={'topBox'}
          >
            <Box display='flex' flexDirection='column' flexGrow={1} key={'titlesection'}>
              <Typography
                className={classes.title}
                style={AVATextVariableStyle((((filter.person_id || filter.assigned_to) && reactData.selectedPersonName)
                  ? reactData.selectedPersonName
                  : reactData.pageTitle), { size: 2.5, bold: true })}
              >
                {((filter.person_id || filter.assigned_to) && reactData.selectedPersonName)
                  ? reactData.selectedPersonName
                  : reactData.pageTitle
                }
              </Typography>
              {!options.viewMode &&
                <Box
                  display='flex' flexDirection='row'
                  className={classes.messageArea}
                  key={'midBox'}
                >
                  <Box display='flex'
                    marginLeft={2}
                    paddingRight={2}
                    borderRadius={'32px'}
                    border={1}
                    borderColor={'black'}
                    paddingBottom={0.5}
                    paddingLeft={2}
                    alignItems={'center'}
                    marginBottom={0.5}
                    flexBasis={'content'}
                    flexDirection='row' width='85%' key={'midLeft'}
                  >
                    <SearchIcon size="small" />
                    <TextField
                      id='List Filter'
                      defaultValue={reactData.filterTextLower}
                      onChange={event => (handleChangeFilter(event.target.value))}
                      width={'100%'}
                      className={classes.freeInput}
                      inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                      variant={'standard'}
                      autoComplete='off'
                    />
                  </Box>
                  {(filter.foreign_key || filter.statusNot || filter.status) &&
                    <Box display='flex'
                      width={'100%'}
                      marginLeft={2}
                      marginRight={2}
                      marginBottom={0.5}
                      paddingBottom={2}
                      borderRadius={'32px'}
                      border={1}
                      borderColor={'black'}
                      flexDirection='column' key={'midRight'}
                    >
                      <Box display='flex' alignItems={'center'} flexDirection='row' justifyContent={'space-between'}>
                        <Typography
                          className={classes.title}
                          style={AVATextStyle({ size: 1, bold: true, margin: { bottom: 0.5 } })}
                        >
                          {'Filters'}
                        </Typography>
                        {filter.showNotBox &&
                          <FormControlLabel
                            className={classes.formControlLbl}
                            onChange={handleStatusNot}
                            control={
                              <Checkbox
                                disableRipple
                                checked={!!reactData.filter.statusNot}
                                className={classes.radioButton}
                                size='small'
                              />}
                            label={
                              <Typography
                                className={classes.radioText}
                              >
                                {'Not...'}
                              </Typography>}
                          />
                        }
                      </Box>
                      {filter.foreign_key &&
                        <Typography
                          className={classes.subTitle}
                          style={AVATextStyle({ size: 1, margin: { top: 0, left: 1 } })}
                        >
                          {`For ${makeDate(filter.foreign_key).absolute}`}
                        </Typography>
                      }
                      <Box display='flex' flexDirection='row' flexWrap='wrap'>
                        {reactData.statusList.map((this_status, this_status_index) => (
                          <FormControlLabel
                            className={classes.formControlLbl}
                            onChange={() => {
                              handleChangeStatusSelection(this_status.value);
                            }}
                            key={`status_selector_${this_status_index}`}
                            id={`status_selector_${this_status_index}`}
                            control={
                              <Checkbox
                                disableRipple
                                checked={!!reactData.filter.fields.status[this_status.value.toLowerCase()]}
                                className={classes.radioButton}
                                size='small'
                              />}
                            label={
                              <Typography
                                className={classes.radioText}
                              >
                                {titleCase(this_status.display)}
                              </Typography>}
                          />
                        ))}
                      </Box>
                    </Box>
                  }
                </Box>
              }
            </Box>
          </Box>

          {/* Main List */}
          <Paper
            component={Box}
            overflow='auto'
            elevation={0}
            pt={3}
            pb={2}
            square
          >
            <List>
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
                      color={(this_item.workData.checked) ? 'black' : null}
                      ref={((firstSelectedRow() === index) || ((firstSelectedRow() === -1) && (rowsDisplayed.length === 1))) ? firstSelectedRowRef : null}
                      onContextMenu={async (e) => {
                        e.preventDefault();
                        enqueueSnackbar(<div>
                          Type={this_item.request_type}<br />
                          Requestor={this_item.requestor}<br />
                          ForeignKey={this_item.foreign_key}<br />
                          LastUpdate={makeDate(this_item.last_update).absolute}<br />
                          ReqTime={makeDate(this_item.workData.requestTime).absolute}<br />
                          ForDate={this_item.workData.orderForDate.absolute}<br />
                          ID={this_item.request_id}
                        </div>, { variant: 'info', persist: true });
                      }}>
                      <Box
                        display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                        key={this_item.message_id + 'r' + index}
                        className={classes.listItem}
                      >
                        <Box display='flex' flexDirection='row'>
                          <Checkbox
                            checked={this_item.workData.checked || false}
                            disableRipple
                            key={'checkbox' + index}
                            onClick={() => { toggleCheck(index); }}
                          />
                          {!filter.person_id &&
                            <Box
                              className={classes.imageArea}
                              component="img"
                              border={1}
                              alt=' '
                              src={this_item.workData.requestor_image}
                            />
                          }
                        </Box>
                        {!options.textForm &&
                          <Box display='flex' onClick={() => { toggleOpen(index); }} flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'>
                            <Box display='flex' flexDirection='column'>
                              <Box display='flex' flexDirection='row'>
                                <Box display='flex' flexDirection='column' marginBottom={1.5}>
                                  {(!filter.request_type || (filter.request_type.length !== 1)) &&
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
                                      {`${this_item.workData.requestor_name} (${this_item?.original_request?.textInput['Room Number'] || this_item.workData.requestor_location})`}
                                    </Typography>
                                  }
                                  {this_item.workData.updated &&
                                    <Typography
                                      style={AVATextStyle({ size: 0.7 })}
                                    >
                                      {this_item.workData.updated}
                                    </Typography>
                                  }
                                  <React.Fragment>
                                    {(this_item.requestor !== this_item.workData.enteredBy) &&
                                      <Typography
                                        variant='h5'
                                        style={AVATextStyle({ size: 1, margin: { top: 0.2 } })}
                                      >
                                        {`By ${this_item.workData.enteredBy_name}`}
                                      </Typography>
                                    }
                                    <Typography
                                      variant='h5'
                                      style={AVATextStyle({ size: 1, margin: { top: 0.2 } })}
                                    >
                                      {this_item.workData.display_date}
                                    </Typography>
                                    {(!options.hasOwnProperty('showForeignKey') || options.showForeignKey)
                                      && !(this_item?.workData?.orderForDate.error)
                                      &&
                                      <Typography
                                        variant='h5'
                                        style={AVATextStyle({ size: 1, margin: { top: 0.2 } })}
                                      >
                                        {`For ${this_item?.workData?.orderForDate.relative}`}
                                      </Typography>
                                    }
                                  </React.Fragment>
                                </Box>
                              </Box>
                              {!options.textForm &&
                                this_item?.workData?.summary_request &&
                                this_item.workData.summary_request.map((mSumLine, mSumIndex) => (
                                  < Typography
                                    key={`prefLine-${mSumIndex}`}
                                    className={(`mrow${mSumLine[0]}` in classes) ? classes[`mrow${mSumLine[0]}`] : classes.mrowdetail}
                                  >
                                    {typeof mSumLine[1] === 'string' ? mSumLine[1] : (alert(mSumIndex, mSumLine))}
                                  </Typography>
                                ))}
                              {this_item.workData.open && this_item?.workData?.formatted_request && this_item.workData.formatted_request.map((mLine, mIndex) => (
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
                        {options.textForm &&
                          <Box display='flex' onClick={() => { toggleOpen(index); }} flexGrow={1} flexDirection='row' justifyContent='flex-start' alignItems='center'>
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
          {reactData.selectAssignTo &&
            <PersonFilter
              prompt={'Assign to whom?'}
              peopleList={reactData.choiceList}
              multiSelect={false}
              onCancel={() => {
                updateReactData({
                  selectAssignTo: false
                }, true);
              }}
              onSelect={async (selectedPerson) => {
                let printList = [];
                reactData.dataRows.forEach(r => {
                  if (r.workData.checked) { printList.push(r); }
                  return;
                });
                await handleUpdates({
                  newStatus: 'Assigned',
                  assigned_to: selectedPerson.split(':')[1]
                });
                updateReactData({
                  selectAssignTo: false
                }, true);
              }}
            />
          }
          {reactData.selectStatus &&
            <SelectFromList
              prompt={['Status', 'Notes', 'Notifications']}
              selectionsList={reactData.statusList.filter(s => {
                return !s.hasOwnProperty('selectable') || s.selectable;
              })}
              options={{
                'multiSelect': false,
                'alreadyChecked': commonStatus(),
                'allowNote': 'Add a note',
                'allowNotify': getRequestors()
              }}
              onCancel={() => {
                updateReactData({
                  selectStatus: false
                }, true);
              }}
              onSelect={async (response) => {
                await handleUpdates({
                  newStatus: ((response.selections && (response.selections.length > 0)) ? response.selections[0].value : null),
                  enteredNote: response.enteredNote,
                  notify: response.notify
                });
                updateReactData({
                  selectStatus: false
                }, true);
              }}
            />
          }
          {reactData.showStaffAccess &&
            (['in'].includes(reactData.statusObj.last_status) ?
              <AVATextInput
                titleText={[
                  makeGreeting(state.session.patient_display_name),
                  `[italic]You've been checked in with ${reactData.dataRows[reactData.statusObj.targetIndex].on_behalf_of} since ${makeDate(reactData.statusObj.last_update).relative}`,
                  ' ',
                  `Tap "Confirm" to check out`
                ]}
                promptText={[]}  // prompts go here (if any)
                buttonText={['Confirm', 'Back']}
                onCancel={() => {
                  updateReactData({
                    showStaffAccess: false
                  }, true);
                }}
                onSave={async (responses) => {
                  let now = makeDate(new Date());
                  reactData.statusObj.reqRec.last_status = 'out';
                  reactData.statusObj.reqRec.last_update = now.timestamp;
                  reactData.statusObj.reqRec.type_date = `${reactData.statusObj.reqRec.request_type}~${now.timestamp}`;
                  let hNote = `Checked out on ${now.absolute}`;
                  /*  if we have other data to capture ("did you complete your task?", "issues to note", etc.)
                      those notes would be captured in prompts and be saved here
                  responses.forEach((r, x) => {
                    if (r && reactData.residentPrompts) {
                      hNote += ` ${reactData.residentPrompts[x]}: ${r}.`;
                    }
                  });
                  */
                  reactData.statusObj.reqRec.history.unshift(hNote);
                  let newFormattedRequest = await buildRequestDetails(reactData.dataRows[reactData.statusObj.targetIndex]);
                  reactData.dataRows[reactData.statusObj.targetIndex].workData.formatted_request = newFormattedRequest.workData.formatted_request;
                  await updateServiceRequest([reactData.statusObj.reqRec]);
                  enqueueSnackbar(`Check-out successful!`, { variant: 'success', persist: false });
                  updateReactData({
                    showStaffAccess: false
                  }, true);
                }}
                allowCancel={true}
                options={{ save_on_enter: true }}
              />
              :
              <AVATextInput
                titleText={[
                  makeGreeting(state.session.patient_display_name),
                  `[italic]You are checking in with ${reactData.dataRows[reactData.statusObj.targetIndex].on_behalf_of}`,
                  ' ',
                  `Tap "Confirm" to check in`
                ]}
                promptText={[]}  // prompts go here (if any)
                buttonText={['Confirm', 'Back']}
                onCancel={() => {
                  updateReactData({
                    showStaffAccess: false
                  }, true);
                }}
                onSave={async () => {
                  let now = makeDate(new Date());
                  Object.assign(reactData.statusObj.reqRec, reactData.dataRows[reactData.statusObj.targetIndex]);
                  reactData.statusObj.reqRec.last_status = 'in';
                  reactData.statusObj.reqRec.last_update = now.timestamp;
                  reactData.statusObj.reqRec.type_date = `${reactData.statusObj.reqRec.request_type}~${now.timestamp}`;
                  let hNote = `${state.session.patient_display_name} checked in on ${now.absolute}`;
                  reactData.statusObj.reqRec.history.unshift(hNote);
                  reactData.statusObj.reqRec.last_visited = reactData.dataRows[reactData.statusObj.targetIndex].requestor;
                  let newFormattedRequest = await buildRequestDetails(reactData.dataRows[reactData.statusObj.targetIndex]);
                  reactData.dataRows[reactData.statusObj.targetIndex].workData.formatted_request = newFormattedRequest.workData.formatted_request;
                  await updateServiceRequest([reactData.statusObj.reqRec]);
                  enqueueSnackbar(`Check-in successful!`, { variant: 'success', persist: false });
                  updateReactData({
                    showStaffAccess: false,
                    dataRows: reactData.dataRows
                  }, true);
                }}
                allowCancel={true}
              />
            )
          }

          {/* Buttons */}
          {((loading === 'load_complete') || (reactData.dataRows.length > 0)) &&
            (!options.viewMode) &&
            // Command Area
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' flexWrap='wrap' justifyContent='center' alignItems='center'>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    onClick={onClose}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {reactData.isMobile ? 'Exit' : 'Close'}
                  </Button>
                  {(rowsDisplayed.length > 0) &&
                    <React.Fragment>
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
                          {'None'}
                        </Button>
                      }
                      <Button
                        className={AVAClass.AVAButton}
                        style={allRowsSelected().allChecked ? { backgroundColor: 'white', color: 'green' } : { backgroundColor: 'green', color: 'white' }}
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
                        {`All ${allRowsSelected().count}`}
                      </Button>
                    </React.Fragment>
                  }
                </Box>
                <Box display='flex' flexDirection='row' flexWrap='wrap' justifyContent='center' alignItems='center'>
                  {anyRowsSelected() &&
                    (!filter.person_id) &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'orange', color: 'black', paddingRight: (reactData.isMobile ? '4px' : '') }}
                      size='small'
                      onClick={() => {
                        setPromptForMessage(getSelectedDetails());
                      }}
                      startIcon={<SendIcon size="small" />}
                    >
                      {reactData.isMobile ? null : 'Message'}
                    </Button>
                  }
                  {anyRowsSelected() && options.allowAssign &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'green', color: 'white' }}
                      size='small'
                      onClick={async () => {
                        await setChoices(options.allowAssign);
                        updateReactData({
                          selectAssignTo: true
                        }, true);
                      }}
                      startIcon={<PersonAddIcon size="small" />}
                    >
                      {'Assign'}
                    </Button>
                  }
                  {anyRowsSelected() && false &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'green', color: 'white' }}
                      size='small'
                      onClick={async () => {
                        let statusObj = await getCurrentStatus(session.client_id, session.patient_id, 'staff');
                        statusObj.targetIndex =
                          reactData.dataRows.findIndex(r => {
                            return r.workData.checked;
                          });
                        updateReactData({
                          showStaffAccess: true,
                          statusObj: statusObj
                        }, true);
                      }}
                      startIcon={<PersonAddIcon size="small" />}
                    >
                      {'Access'}
                    </Button>
                  }
                  {anyRowsSelected() &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'brown', color: 'white' }}
                      size='small'
                      onClick={async () => {
                        await setStatusList();
                        updateReactData({
                          selectStatus: true
                        }, true);
                      }}
                      startIcon={<CheckIcon size="small" />}
                    >
                      {reactData.isMobile ? 'Status' : 'Update status'}
                    </Button>
                  }
                  {anyRowsSelected()
                    &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'blue', color: 'white', paddingRight: (reactData.isMobile ? '4px' : '') }}
                      size='small'
                      onClick={async () => {
                        await handlePrintRequest();
                      }}
                      startIcon={<PrintIcon size="small" />}
                    >
                      {reactData.isMobile ? null : 'Print'}
                    </Button>
                  }
                </Box>
              </Box>
            </DialogActions>
          }
          {((loading === 'load_complete') || (reactData.dataRows.length > 0)) &&
            (options.viewMode) &&
            // Command Area
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' flexWrap='wrap' justifyContent='center' alignItems='center'>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    onClick={() => {
                      onClose('exit');
                    }}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {reactData.isMobile ? 'Exit' : 'Close'}
                  </Button>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'green', color: 'white' }}
                    size='small'
                    onClick={() => {
                      exitModule('continue');
                    }}
                    startIcon={<DoneAllIcon size="small" />}
                  >
                    {reactData.isMobile ? 'Add New' : 'Add a New Request'}
                  </Button>
                </Box>
              </Box>
            </DialogActions>
          }
        </React.Fragment >
      }
    </Dialog >
  );
};