import React from 'react';
import { sentenceCase, deepCopy, makeArray, isMobile, cl, titleCase, dbClient, recordExists, listFromArray } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { getImage, getPerson, makeName } from '../../util/AVAPeople';
import { getMemberList } from '../../util/AVAGroups';
import { getCalendarEntries } from '../../util/AVACalendars';
import { getServiceRequests, updateServiceRequest, printServiceRequest } from '../../util/AVAServiceRequest';
import { getMessages, messageHistory, sendMessages } from '../../util/AVAMessages';
import { printRawData } from '../../util/AVAPrintServiceRequest';
import MakeMessage from '../forms/MakeMessage';
import AVATextInput from '../forms/AVATextInput';
import CalendarEventEditForm from '../forms/CalendarEventEditForm';
import StaffAccess from './StaffAccess';

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

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
import ListAltIcon from '@material-ui/icons/ListAlt';
import CloseIcon from '@material-ui/icons/HighlightOff';
import CheckIcon from '@material-ui/icons/DoneSharp';
import SwapVertIcon from '@material-ui/icons/SwapVert';
import ClearAllIcon from '@material-ui/icons/ClearAll';
import DoneAllIcon from '@material-ui/icons/DoneAll';
import OpenDoorIcon from '@material-ui/icons/MeetingRoom';
import DashboardIcon from '@material-ui/icons/Dashboard';
import ListIcon from '@material-ui/icons/List';
import HomeIcon from '@material-ui/icons/Home';

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
    marginBottom: theme.spacing(1),
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
      selectOnly: newStatus - show only the name and very brief info; select an item to automatically change ths status
      allowAssign - when items are selected, the "assign" button will be shown.  allowAssign should contain an array (list) of groups that assignees can be selected from
      updateMode - preselect first item
      viewMode - no search field; no changes allowed; show "add new request"; onClose carries instruction for next step
      noSelect - suppress checkbox and buttons for updates, etc.
      woNumber - edit work order number in foreign key
    }
  */

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { state } = useSession();

  const firstSelectedRowRef = React.useRef(null);

  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const [loading, setLoading] = React.useState('no_value');
  const [unmount, setUnmount] = React.useState();
  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);

  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  let filterIn = Object.assign(filter, { filtering: false });
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
    pageTitle: titleCase(title.split(/\(/).shift().toLowerCase().replace('list', '').trim()),
    requestIDs: [],
    showDashboard: false,
    showSummary: false,
    selectionsChanged: false,
    selectAssignTo: false,
    showUpdateForm: false,
    showEventEdit: false,
    detailEdit: {},
    choiceList: [],
    statusList: [],
    isMobile: isMobile(),
    showStaffAccess: false,
    statusObj: {},
    checkInStatusObj: {},
    rowOpen: [],
    display_summary: {},
    display_summaryList: [],
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

  async function handleChangeStatusSelection(statusIn) {
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
    let reactUpdateObj = {
      filter: reactData.filter
    };
    if (reactData.showSummary) {
      await prepareSummary();
      reactUpdateObj.display_summary = reactData.display_summary;
    }
    updateReactData(reactUpdateObj, true);

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
    if (pOptions.history_update) {
      historyLine = pOptions.history_update;
    }
    else if (historyLine) {
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
    let OGHistoryLine = historyLine;
    for (let x = 0; x < reactData.dataRows.length; x++) {
      let r = reactData.dataRows[x];
      rowChanged[x] = false;
      rowSelected[x] = false;
      statusChanged[x] = false;
      assignmentChanged[x] = false;
      historyLine = OGHistoryLine;
      if (r.workData.checked && OKToDisplay(r)) {
        rowSelected[x] = true;
        if (pOptions.woNumber && (pOptions.woNumber !== reactData.dataRows[x].foreign_key)) {
          if (historyLine) {
            historyLine += ` and `;
          }
          else {
            historyLine = '';
          }
          historyLine += `Set Work Order number to ${pOptions.woNumber}`;
        }
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
        if (pOptions.woNumber && (pOptions.woNumber !== reactData.dataRows[x].foreign_key)) {
          reactData.dataRows[x].foreign_key = pOptions.woNumber;
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
          if (reactData.dataRows[this_index].hasOwnProperty('current_request')) {
            if (reactData.dataRows[this_index].current_request.selections
              && reactData.dataRows[this_index].current_request.selections.length > 0) {
              messageText += `${reactData.dataRows[this_index].workData.enteredBy_name.split(' ').shift()} selected`;
              messageText += ` ${listFromArray(reactData.dataRows[this_index].current_request.selections)}.  \r\n`;
            }
            for (let topic in reactData.dataRows[this_index].current_request.textInput) {
              messageText += `${topic}: ${reactData.dataRows[this_index].current_request.textInput[topic]}  \r\n`;
            }
          }
          else {
            if (reactData.dataRows[this_index].original_request.selections
              && reactData.dataRows[this_index].original_request.selections.length > 0) {
              messageText += `${reactData.dataRows[this_index].workData.enteredBy_name.split(' ').shift()} selected`;
              messageText += ` ${listFromArray(reactData.dataRows[this_index].original_request.selections)}.  \r\n`;
            }
            for (let topic in reactData.dataRows[this_index].original_request.textInput) {
              messageText += `${topic}: ${reactData.dataRows[this_index].original_request.textInput[topic]}  \r\n`;
            }
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
          });
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

  function sortDataRows(direction) {
    let sort_factor;
    if (direction.startsWith('des')) {
      sort_factor = -1;
    }
    else {
      sort_factor = 1;
    }
    reactData.dataRows.sort((a, b) => {
      if (!a.this_sort) {
        if (!a.workData.orderForDate.error) {
          a.this_sort = a.workData.orderForDate.timeStamp;
        }
        else {
          a.this_sort = a.request_date;
        }
      }
      if (!b.this_sort) {
        if (!b.workData.orderForDate.error) {
          b.this_sort = b.workData.orderForDate.timeStamp;
        }
        else {
          b.this_sort = b.request_date;
        }
      }
      if (a.this_sort < b.this_sort) {
        return -1 * sort_factor;
      }
      else if (a.this_sort > b.this_sort) {
        return 1 * sort_factor;
      }
      else if (a.request_date < b.request_date) {
        return -1 * sort_factor;
      }
      else {
        return 1 * sort_factor;
      }
    });
    updateReactData({
      dataRows: reactData.dataRows,
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

  async function prepareSummary() {
    reactData.display_summary = {};
    reactData.display_summaryList = [];
    reactData.rowOpen = [];
    let observations;
    let oType = {};
    let last_fKey;
    for (let x = 0; x < reactData.dataRows.length; x++) {
      let this_item = reactData.dataRows[x];
      if (this_item.foreign_key !== last_fKey) {
        let pDate = makeDate(this_item.foreign_key);
        observations = await dbClient
          .query({
            KeyConditionExpression: 'client_id = :c and date_key = :d',
            ExpressionAttributeValues: { ':c': this_item.client_id, ':d': pDate.ymd },
            TableName: "Observations",
            IndexName: "date_key-index"
          })
          .promise()
          .catch(error => { cl(`ERROR reading Observations by date *** caught error is: ${error}`); });
        if (recordExists(observations)) {
          last_fKey = this_item.foreign_key;
          observations.Items.forEach(o => {
            let check = o.composite_key.toLowerCase();
            ['entree', 'salad', 'soup', 'bread', 'side', 'dessert', 'beverage'].forEach(t => {
              if (check.includes(t)) {
                oType[o.observation_code] = sentenceCase(t);
              }
            });
          });
        }
      }
      if (OKToDisplay(this_item)) {
        await countThisLine(this_item, oType);
      }
    }
    // clean up Other (if possible)
    for (let oKey in reactData.display_summary) {
      if (reactData.display_summary[oKey].menuType === 'Other') {
        if (oType.hasOwnProperty(oKey)) {
          reactData.display_summary[oKey].menuType = oType.oKey;
        }
        else {
          observations = await dbClient
            .query({
              KeyConditionExpression: 'client_id = :c and begins_with(observation_code, :o)',
              ExpressionAttributeValues: { ':c': session.client_id, ':o': oKey.slice(0, 10) },
              TableName: "Observations",
              IndexName: "observation_code-index"
            })
            .promise()
            .catch(error => { cl(`ERROR reading Observations by obs_code *** caught error is: ${error}`); });
          if (recordExists(observations)) {
            let keepGoing = true;
            for (let i = 0; ((i < observations.Items.length) && (keepGoing)); i++) {
              let o = observations.Items[i];
              let check = `${o.composite_key} ${o.sort_order}`.toLowerCase();
              // eslint-disable-next-line
              ['entree', 'salad', 'soup', 'bread', 'side', 'dessert', 'beverage'].forEach(t => {
                if (check.includes(t)) {
                  reactData.display_summary[oKey].menuType = sentenceCase(t);
                  oType[o.observation_code] = sentenceCase(t);
                  keepGoing = false;
                }
              });
            };
          }
        }
      }
    }
    ['Entree', 'Salad', 'Soup', 'Bread', 'Side', 'Dessert', 'Beverage', 'Other'].forEach(t => {
      let this_group = [];
      for (let oKey in reactData.display_summary) {
        if (reactData.display_summary[oKey].menuType === t) {
          this_group.push(reactData.display_summary[oKey]);
        }
      }
      if (this_group.length > 0) {
        this_group.sort((a, b) => {
          return (a.description > b.description ? 1 : -1);
        });
        reactData.display_summaryList.push(...this_group);
      }
    });
    return reactData.display_summaryList;
  }

  async function countThisLine(this_item, oType) {
    let parent;
    for (let x = 0; x < this_item.workData.summary_request.length; x++) {
      let line = this_item.workData.summary_request[x];
      if ((line[0] === 'detail') || (line[0] === 'qual')) {
        if (line[0] === 'detail') {
          if (((x + 1) < this_item.workData.summary_request.length)
            && (this_item.workData.summary_request[x + 1][0] === 'qual')) {
            parent = line[1];
          }
          else {
            parent = null;
          }
        }
        // let this_prop = `${(line[0] === 'qual') ? parent + ' - ' : ''}${line[1]}`;
        if (line[0] === 'detail') {
          if (!reactData.display_summary.hasOwnProperty(line[1])) {
            reactData.display_summary[line[1]] = {
              description: line[1],
              count: 1,
              type: line[0],
              menuType: oType[line[1]] || 'Other',
              qual: {}
            };
            reactData.rowOpen.push(false);
          }
          else {
            reactData.display_summary[line[1]].count++;
          }
        }
        else {
          if (!reactData.display_summary.hasOwnProperty(parent)) {
            reactData.display_summary[parent] = {
              description: parent,
              count: 1,
              type: line[0],
              menuType: oType[parent] || 'Other',
              qual: {
                [line[1]]: 1
              }
            };
            reactData.rowOpen.push(false);
          }
          else if (!reactData.display_summary[parent].qual.hasOwnProperty(line[1])) {
            reactData.display_summary[parent].qual[line[1]] = 1;
          }
          else {
            reactData.display_summary[parent].qual[line[1]]++;
          }
        }
      }
    };
  }

  function OKToDisplay(this_item) {
    if (reactData.filter.filtering) {
      if (this_item.last_status && reactData.filter.fields.status[this_item.last_status.toLowerCase()]) {
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
      let response = (`${this_item.workData.enteredBy_name} ${this_item.workData.search_data}`).toLowerCase().includes(reactData.filterTextLower);
      if (!response && this_item.workData.notes_section) {
        response = this_item.workData.notes_section.some(note => {
          return note[1].toLowerCase().includes(reactData.filterTextLower);
        });
      }
      return response;
    }
  }

  function OKToDisplayStatus(this_status) {
    if (!(reactData.statistics.count.hasOwnProperty(this_status))) {
      return false;
    }
    if (reactData.filter.filtering) {
      if (reactData.filter.fields.status[this_status]) {
        // this status IS checked off
        return !!!reactData.filter.statusNot;
      }
      else {
        // this status IS NOT checked off
        return !!reactData.filter.statusNot;
      }
    }
    return true;
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

  function commonFKey() {
    let commonKey;
    let multipleKeys = reactData.dataRows.some(row => {
      if (row.workData.checked) {
        if (!commonKey) {
          commonKey = row.foreign_key;
          return false;
        }
        return (row.foreign_key !== commonKey);
      }
      return false;
    });
    if (multipleKeys) {
      return null;
    }
    else {
      return commonKey;
    }
  }

  function getRequestors() {
    let response = {};
    reactData.dataRows.forEach(r => {
      if (r.workData.checked) {
        if (response.hasOwnProperty(r.workData.enteredBy)) {
          response[r.workData.enteredBy].count++;
        }
        else {
          response[r.workData.enteredBy] = {
            name: r.workData.enteredBy_name,
            count: 1
          };
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
    let responseList = [];
    for (let key in response) {
      let this_obj = {
        value: key,
        label: response[key].name,
        count: response[key].count
      };
      responseList.push(this_obj);
    };
    return responseList;
  }

  function anyRowsSelected() {
    return reactData.dataRows.some(r => {
      return (r.workData.checked && OKToDisplay(r));
    });
  }

  function checklistSelected() {
    let selectedRow = false;
    let checklistRow = { OK: false, reason: 'No checklist row selected' };;
    reactData.dataRows.forEach(r => {
      if (r.workData.checked && OKToDisplay(r)) {
        // a selected row that is visible
        if (selectedRow && (checklistRow.OK || (r.workData.flavor === 'checklist'))) {     // is there already a selected row?  if so, reject
          return { OK: false, reason: 'You selected multiple rows, which included at least one checklist' };
        }
        selectedRow = true;
        if (r.workData.flavor === 'checklist') {    // is this row a checklist type of request?
          checklistRow = {
            OK: true,
            rowIndex: r,
            foreign_key: r.foreign_key
          };
        }
      }
    });
    return checklistRow;
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
        selectedPersonName: `${pName}'${pName.slice(-1) === 's' ? '' : 's'} Activity`
      }, true);
    }
    if ((!filter.hasOwnProperty('client_id') || !filter.client_id)) {
      filter.client_id = session.client_id;
    }
    filter.request_type = makeArray(filter.request_type, ',');
    if (!filter.hasOwnProperty('sort')) {
      filter.sort = 'desc';
    };
    qList = await getServiceRequests(filter);
    let maxTimeStamp = 0;
    reactData.dataRows = [];
    reactData.requestIDs = [];
    for (let x = 0; (x < qList.length); x++) {
      if (qList[x].request_date > maxTimeStamp) {
        maxTimeStamp = qList[x].request_date;
      }
      if (qList[x].request_id !== `${qList[x].requestor}_checkout`) {
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
    }
    if (loading !== 'rebuild') {
      if (filter.person_id
        && (!filter.request_type
          || (filter.request_type.length === 0)
          || ((filter.request_type.length > 0) && filter.request_type.includes('event')))) {
        let eList = await getCalendarEntries({ person_id: filter.person_id });
        for (let x = 0; (x < eList.length); x++) {
          reactData.dataRows.push(await buildRequestFromEvent(eList[x]));
        }
        sortDataRows(filter.sort);
      }
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
    else {
      // Capture statistics
      let nowTime = new Date().getTime();
      const msInADay = 1000 * 60 * 60 * 24;
      let count = {};
      let open_closed = {
        'closed': 'na',
        'open': 'na'
      };
      let total_open_time = {};
      let total_idle_time = {};   // time since last activity
      let oldest_requests = {};   // track 5 oldest
      qList.forEach(this_request => {
        let row_status = this_request.last_status;
        do {
          if (count.hasOwnProperty(row_status)) {
            count[row_status]++;
            if (open_closed[row_status] === 'closed') {
              total_open_time[row_status] += (this_request.last_update - this_request.request_date);
              total_idle_time[row_status] += 0;
            }
            else {
              total_open_time[row_status] += (nowTime - this_request.request_date);
              total_idle_time[row_status] += (nowTime - this_request.last_update);
            }
            if (this_request.request_date < oldest_requests[row_status][4].request_date) {
              let age = (nowTime - this_request.request_date) / msInADay;
              oldest_requests[row_status][4] = {
                request_date: this_request.request_date,
                request_id: this_request.request_id,
                age,
              };
              oldest_requests[row_status].sort((a, b) => {
                if (a.request_date < b.request_date) {
                  return -1;
                }
                else {
                  return 1;
                }
              });
            }
          }
          else {
            if (!open_closed.hasOwnProperty(row_status)) {
              // eslint-disable-next-line
              if (reactData.statusObj.hasOwnProperty(row_status)) {
                open_closed[row_status] = (!!reactData.statusObj[row_status].open ? 'open' : 'closed');
              }
              else {
                open_closed[row_status] = 'closed';
              }
            }
            count[row_status] = 1;
            if (open_closed[row_status] === 'closed') {
              total_open_time[row_status] = (this_request.last_update - this_request.request_date);
              total_idle_time[row_status] = 0;
            }
            else {
              total_open_time[row_status] = (nowTime - this_request.request_date);
              total_idle_time[row_status] = (nowTime - this_request.last_update);
            }
            oldest_requests[row_status] = [{
              request_date: this_request.request_date,
              request_id: this_request.request_id,
              age: (nowTime - this_request.request_date) / msInADay
            }];
            for (let x = 1; x <= 4; x++) {
              oldest_requests[row_status][x] = {
                request_date: Number.MAX_SAFE_INTEGER,
                request_id: ''
              };
            }
          };
          row_status = open_closed[row_status];
        } while (row_status !== 'na');
      });
      let average_open_time = {};
      let average_time_since_last_activity = {};
      let color = {};
      let value_word = {};
      for (let this_status in count) {
        // will give average time in days
        average_open_time[this_status] = (total_open_time[this_status] / count[this_status]) / msInADay;
        if (reactData.statusObj.hasOwnProperty(this_status)) {
          [color[this_status], value_word[this_status]] = setColor(average_open_time[this_status], (reactData.statusObj[this_status].age));
        }
        else {
          color[this_status] = '#a7d2f8';
        }
        if (open_closed[this_status] === 'open') {
          average_time_since_last_activity[this_status] = (total_idle_time[this_status] / count[this_status]) / msInADay;
        }
      }
      updateReactData({
        statistics: {
          count,
          total_open_time,
          total_idle_time,   // time since last activity
          oldest_requests,
          average_open_time,
          average_time_since_last_activity,
          color,
          value_word,
          open_closed
        }
      }, false);
    }
    if (dashboard_idleTimer && dashboard_idleTimer.current) {
      dashboard_idleTimer.current.start();
      cl(`Idle timer started in dashboard at ${new Date().toLocaleString()}.`);
    }
  };

  function setColor(value, rangeObj) {
    const color_gradient = ['#5ffb76', '#00fbbb', '#00f5ec', '#53ecff', '#9fe0ff', '#a7d2f8', '#b0c3ed', '#b8b5dd', '#c177bc', '#cb4f99', '#ce0e6a'];
    const gradient_word = ['Excellent', 'Excellent', 'Good', 'Good', 'OK', 'OK', 'OK', 'Low', 'Low', 'Poor', 'Poor'];
    let low = 0;
    let med = 5;
    let high = 10;
    if (rangeObj) {
      low = rangeObj.good || 0;
      med = rangeObj.ok || 5;
      high = rangeObj.bad || 10;
    }
    let x;
    if (value <= low) {
      x = 0;
    }
    else if (value >= high) {
      x = 10;
    }
    else if (value < med) {
      x = Math.round(((value - low) / (med - low)) * 5);
    }
    else {
      x = Math.round(((high - value) / (high - med)) * 5) + 6;
    }
    return [color_gradient[x], gradient_word[x]];
  }

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

  async function orderWarning(pKey) {
    const showWarning = new Promise((resolve, reject) => {
      let response = '';
      const snackAction = (
        <React-Fragment>
          <Button className={AVAClass.AVAButton}
            style={{ backgroundColor: 'green', color: 'white' }}
            size='small'
            onClick={() => { response = 'close'; resolve(response); }}
          >
            Yes, Close it!
          </Button>
          <Button className={AVAClass.AVAButton}
            style={{ backgroundColor: 'red', color: 'white' }}
            size='small'
            onClick={() => { response = 'leave'; resolve(response); }}
          >
            No, Leave it.
          </Button>
        </React-Fragment>
      );
      enqueueSnackbar(
        `You marked off all ${pKey} items on the list.  Would you like to mark the request complete and close it?`,
        { variant: 'warning', persist: true, action: snackAction }
      );
    });
    let rValue = await showWarning;
    closeSnackbar();
    return rValue;
  }

  async function buildRequestDetails(this_request) {
    this_request.workData = {};
    this_request.workData.search_data = '';
    if (!this_request.hasOwnProperty('current_request')) {
      this_request.current_request = deepCopy(this_request.original_request);
    }
    if (session.service_request_types.hasOwnProperty(this_request.request_type)) {
      this_request.workData.formatted_type = session.service_request_types[this_request.request_type].description || `${titleCase(this_request.request_type)}`;
      this_request.workData.flavor = session.service_request_types[this_request.request_type].flavor || '';
    }
    else {
      cl(`request type "${this_request.request_type}" not in session.service_request_types`);
      this_request.workData.formatted_type = titleCase(this_request.request_type.replace('_', ' '));
      this_request.workData.flavor = '';
    }
    let [enteredBy, requestTimeStamp] = this_request.request_id.split('~');
    this_request.workData.enteredBy = enteredBy;
    if (!('request_date' in this_request)) { this_request.request_date = requestTimeStamp; }
    let AVAupdateDate = makeDate(this_request.last_update);
    let AVArequestDate = makeDate(this_request.request_date);
    this_request.workData.display_date = AVArequestDate.relative;    // the date/time the request was first created
    let anonymous = false;
    if (!this_request.requestor) {
      if (this_request.composite_key) {
        this_request.requestor = this_request.composite_key.split('%')[0];
      }
      else {
        this_request.requestor = this_request.request_id.split('~')[0];
      }
    }
    let requestorRec = await getPerson(this_request.requestor, '*all');
    this_request.workData.requestor_name = await makeName(this_request.requestor);
    if (this_request.requestor !== enteredBy) {
      this_request.workData.enteredBy_name = await makeName(enteredBy);
    }
    else {
      this_request.workData.enteredBy_name = this_request.workData.requestor_name;
    }
    this_request.workData.requestor_location = requestorRec.location;
    this_request.workData.requestor_image = await getImage(this_request.requestor);
    this_request.workData.formatted_request = [];
    this_request.workData.summary_request = [];
    this_request.workData.notes_section = [];
    this_request.workData.textBased_request = [];
    this_request.workData.update_date = AVAupdateDate.relative;
    this_request.workData.requestTime = AVArequestDate.timestamp;
    this_request.workData.orderForDate = makeDate(this_request.foreign_key);
    this_request.workData.this_status = sentenceCase(this_request.last_status);
    if (!options.textForm && !options.selectOnly) {
      let aName = '';
      if (this_request.assigned_to && (this_request.assigned_to !== 'unassigned') && (reactData.statusObj[this_request.last_status] && reactData.statusObj[this_request.last_status].open)) {
        aName = await makeName(this_request.assigned_to);
      }
      if (this_request.last_status) {
        this_request.workData.formatted_request.push(['head', `${(titleCase(this_request.last_status.replace('_', ' ')))} ${aName ? ('- ' + aName) : ''}`]);
      }
    }
    if ((!options.shortForm) && (!options.textForm) && !options.selectOnly) {
      if (AVAupdateDate.relative !== AVArequestDate.relative) {
        this_request.workData.formatted_request.push(['head', `Updated: ${this_request.workData.update_date}`]);
      }
      this_request.workData.formatted_request.push(['head', 'Details']);
    }
    this_request.workData.textBased_request[0] = AVArequestDate.relative;
    this_request.workData.textBased_request.push(`<b>${this_request.workData.formatted_type}`);
    if (!anonymous) {
      let pLine = '';
      if (!filter.person_id) {
        pLine += this_request.workData.requestor_name;
      }
      if (this_request.workData.enteredBy !== this_request.requestor) {
        pLine += `by ${this_request.workData.enteredBy_name}`;
      }
      if (pLine) {
        this_request.workData.textBased_request.push(pLine);
      }
    }
    if (('current_request' in this_request) && (typeof (this_request.current_request) !== 'string')) {
      anonymous = (this_request.current_request.selections && this_request.current_request.selections.join(' ').includes('anonymous'));
      let [fReq, fSearch, fText] = formatRequest(this_request, this_request.current_request);
      this_request.workData.textBased_request.push(fText);
      this_request.workData.formatted_request.push(...fReq);
      this_request.workData.search_data += ` ${fSearch}`;
    }
    else if ('current_request' in this_request) {
      anonymous = this_request.current_request.includes('anonymous');
      this_request.workData.formatted_request.push(['detail', this_request.current_request || 'No information available']);
      this_request.workData.textBased_request.push(this_request.current_request);
      this_request.workData.search_data += ` ${this_request.current_request}`;
    }
    else if (('original_request' in this_request) && (typeof (this_request.original_request) !== 'string')) {
      anonymous = (this_request.original_request.selections && this_request.original_request.selections.join(' ').includes('anonymous'));
      let [fReq, fSearch, fText] = formatRequest(this_request, this_request.original_request);
      this_request.workData.textBased_request.push(fText);
      this_request.workData.formatted_request.push(...fReq);
      this_request.workData.search_data += ` ${fSearch}`;
    }
    else {
      anonymous = this_request.original_request.includes('anonymous');
      this_request.workData.formatted_request.push(['detail', this_request.original_request || 'No information available']);
      this_request.workData.textBased_request.push(this_request.original_request);
      this_request.workData.search_data += ` ${this_request.original_request}`;
    }
    if (this_request.attachments && (this_request.attachments.length > 0)) {
      this_request.attachments.forEach(a => {
        let fNArr = a.split('/').pop().split('.');
        fNArr.pop();
        let fName = decodeURI(fNArr.join('.'));
        this_request.workData.formatted_request.push([`href=${a}`, fName]);
      });
    }
    if (anonymous) {
      this_request.workData.requestor_name = 'Anonymous';
      this_request.workData.enteredBy_name = 'Anonymous';
      this_request.workData.requestor_location = null;
      this_request.workData.requestor_image = null;
    }
    this_request.workData.search_data += this_request.workData.requestor_name;
    this_request.workData.summary_request = this_request.workData.formatted_request;
    let historyList = [];
    let noteList = [];
    if ((!options.textForm) && (!options.selectOnly)) {
      this_request.workData.formatted_request = [];
      if ('history' in this_request) {
        // updateHistoryList takes each history line and determines if it contains "note added"
        // if it does, then it includes that information on the notelist, otherwise the line is added to historylist
        if (typeof (this_request.history) === 'string') {
          updateHistoryList(this_request.history);
        }
        else if (Array.isArray(this_request.history)) {
          this_request.history.forEach(h => {
            if (typeof h === 'string') {
              updateHistoryList(h);
            }
          });
        }
        else {
          Object.values(this_request.history).forEach(h => {
            updateHistoryList(h);
          });
        }
      }

      this_request.workData.formatted_request.push(['head', 'History']);
      if (historyList.length === 0) {
        this_request.workData.formatted_request.push(['detail', '*** None ***']);
      }
      else {
        historyList.forEach(hLine => {
          this_request.workData.formatted_request.push(['detail', hLine]);
        });
      }

      if (noteList.length > 0) {
        this_request.workData.notes_section.push(['head', 'Notes']);
        noteList.forEach(nLine => {
          this_request.workData.notes_section.push(['detail', nLine]);
        });
      }

      let mHist = await messageHistory({
        thread_id: `svc_${this_request.request_type}/${this_request.request_id}`,
        type: 'delivery'
      });
      if (mHist && (mHist.length > 0)) {
        this_request.workData.formatted_request.push(['head', 'Messages']);
        mHist.map(h => { return this_request.workData.formatted_request.push(['detail', h]); });
      }
      this_request.workData.search_data += `~ ${requestorRec.location} ~ ${this_request.workData.requestor_name} ~ ${this_request.workData.enteredBy_name}`;
      if (this_request.last_status && ['closed', 'completed', 'complete', 'cancelled'].includes(this_request.last_status.toLowerCase())) {
        this_request.workData.search_data += ` ~ closed`;
      }
      else { this_request.workData.search_data += ` ~ open`; }
    }
    this_request.workData.checked = false;
    this_request.workData.open = false;
    return this_request;

    function updateHistoryList(text) {
      if (text.startsWith('Note added')) {
        noteList.push(text.replace('Note added by ', ''));
      }
      else {
        historyList.push(text);
      }
      return;
    }
  }

  async function buildRequestFromEvent(this_event) {
    let response = {
      workData: {
        search_data: ''
      }
    };
    response.workData.this_status = 'Signed-up';
    response.workData.flavor = 'event';
    response.workData.formatted_type = 'Event';
    if (session.service_request_types.hasOwnProperty('event')) {
      response.workData.formatted_type = session.service_request_types['event'].description || `Event`;
      if (session.service_request_types['event'].hasOwnProperty('statusList')) {
        let foundStatus = (session.service_request_types['event'].statusList.find(x => {
          return (x.value === this_event?.slotData?.status?.current);
        }));
        if (foundStatus) {
          response.workData.this_status = foundStatus.display;
        }
      }
    }

    let AVArequestDate = makeDate(this_event.event_key.split('#')[1]);
    let AVAupdateDate = null;
    response.request_date = AVArequestDate.date.getTime();
    response.workData.display_date = AVArequestDate.relative;    // the date/time the request was first created
    response.workData.requestTime = AVArequestDate.timestamp;

    if (this_event.slotData?.status) {
      if (this_event.slotData?.status?.history) {
        AVAupdateDate = makeDate(this_event.slotData?.status?.history[0].date);
        response.workData.update_date = AVAupdateDate.relative;
      }
    }

    response.requestor = this_event.slotData.owner;
    response.workData.enteredBy = this_event.slotData.owner;
    response.workData.requestor_name = this_event.slotData.name;
    response.workData.enteredBy_name = this_event.slotData.name;

    let requestorRec = await getPerson(this_event.slotData.owner, '*all');
    response.workData.requestor_location = requestorRec.location;
    response.workData.requestor_image = await getImage(this_event.slotData.owner);

    response.workData.formatted_request = [];
    response.workData.summary_request = [];
    response.workData.notes_section = [];
    response.workData.textBased_request = [];

    if ((!options.shortForm) && (!options.textForm) && !options.selectOnly) {
      if (AVAupdateDate.relative !== AVArequestDate.relative) {
        response.workData.formatted_request.push(['head', `Updated: ${AVAupdateDate.relative}`]);
      }
      response.workData.formatted_request.push(['head', 'Details']);
    }
    response.workData.textBased_request[0] = AVArequestDate.relative;
    response.workData.textBased_request.push(`<b>${response.workData.formatted_type}`);

    response.workData.search_data += response.workData.requestor_name;
    response.workData.summary_request = response.workData.formatted_request;
    response.workData.checked = false;
    response.workData.open = false;
    return response;
  }

  function formatRequest(this_request, req) {
    let returnMessage = [];
    let returnText = '';
    let returnSearch = '';
    if (!('textInput' in req)) { req.textInput = {}; }
    if (!('qualifiers' in req)) { req.qualifiers = []; }
    if (!('selections' in req)) { req.selections = []; }
    if (!filter.person_id && (this_request.workData.requestor_name !== this_request.on_behalf_of)) {
      returnMessage.push(['detail', `For ${this_request.on_behalf_of}`]);
      returnText += ` on behalf of ${this_request.on_behalf_of}`;
    }
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
        if (req.textInput[k] !== this_request.on_behalf_of) {
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
    let responseObj = {};
    if (filter.request_type
      && (state.session.service_request_types.hasOwnProperty(filter.request_type[0]))
      && state.session.service_request_types[filter.request_type[0]].statusList) {
      response = state.session.service_request_types[filter.request_type[0]].statusList;
      state.session.service_request_types[filter.request_type[0]].statusList.forEach(s => {
        responseObj[s.value] = s;
      });
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
      responseObj = {
        'submitted': {
          display: 'Submitted',
          value: 'submitted'
        },
        'in_process': {
          display: 'In Process',
          value: 'in_process'
        },
        'complete': {
          display: 'Complete/Closed',
          value: 'complete'
        }
      };
    }
    updateReactData({
      statusList: response,
      statusObj: responseObj
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
            mt={2}
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
              {!options.viewMode && !options.selectOnly &&
                <Box
                  display='flex' flexDirection='row'
                  className={classes.messageArea}
                  key={'midBox'}
                >
                  <Box
                    display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'
                    key={`left_top_box`}
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
                    {!reactData.showDashboard && !reactData.showSummary &&
                      <Box display='flex'
                        paddingRight={2}
                        paddingBottom={0.5}
                        paddingLeft={2}
                        alignItems={'center'}
                        marginBottom={0.5}
                        marginTop={1}
                        flexDirection='row'
                        key={'sortbox'}
                        onClick={() => {
                          let sort_factor;
                          if (reactData.filter.sort.startsWith('des')) {
                            reactData.filter.sort = 'asc';
                            sort_factor = 1;
                          }
                          else {
                            reactData.filter.sort = 'des';
                            sort_factor = -1;
                          }
                          reactData.dataRows.sort((a, b) => {
                            if (!a.this_sort) {
                              if (!a.workData.orderForDate.error) {
                                a.this_sort = a.workData.orderForDate.timeStamp;
                              }
                              else {
                                a.this_sort = a.request_date;
                              }
                            }
                            if (!b.this_sort) {
                              if (!b.workData.orderForDate.error) {
                                b.this_sort = b.workData.orderForDate.timeStamp;
                              }
                              else {
                                b.this_sort = b.request_date;
                              }
                            }
                            if (a.this_sort < b.this_sort) {
                              return -1 * sort_factor;
                            }
                            else if (a.this_sort > b.this_sort) {
                              return 1 * sort_factor;
                            }
                            else if (a.request_date < b.request_date) {
                              return -1 * sort_factor;
                            }
                            else {
                              return 1 * sort_factor;
                            }
                          });
                          updateReactData({
                            dataRows: reactData.dataRows,
                            filter: reactData.filter
                          }, true);
                        }}
                      >
                        <Typography
                          style={AVATextStyle({ size: 0.75, bold: true, margin: { left: 1, right: 0 } })}
                        >
                          {`Showing ${(reactData?.filter?.sort && reactData?.filter?.sort.startsWith('des')) ? 'Newest' : 'Oldest'} first`}
                        </Typography>
                        <SwapVertIcon size="small" />
                      </Box>
                    }
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
                            onChange={async () => {
                              await handleChangeStatusSelection(this_status.value);
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
            {options.selectOnly &&
              <React.Fragment>
                <Box
                  display='flex'
                  overflow='auto'
                  justifyContent='center'
                  alignContent='center'
                  flexDirection='column'
                >
                  <Typography
                    style={AVATextStyle({ align: 'right', wrap: 'nowrap', size: 1.1, margin: { right: 0 } })}
                    id='scroll-dialog-title'
                  >
                    {`${makeDate(new Date()).dateOnly.split(',').pop().trim()}`}
                  </Typography>
                  <Typography
                    style={AVATextStyle({ align: 'right', size: 1.1, margin: { right: 0 } })}
                    id='scroll-dialog-title'
                  >
                    {`${makeDate(new Date()).timeOnly.split(' ').join('').toLowerCase()}`}
                  </Typography>
                </Box>
                <Box
                  display='flex' flexDirection='row'
                  className={classes.messageArea}
                  key={'topBox'}
                >
                  <Box
                    component="img"
                    ml={2}
                    mr={2}
                    aria-controls='hidden-menu'
                    aria-haspopup='true'
                    minWidth={50}
                    maxWidth={50}
                    minHeight={50}
                    maxHeight={50}
                    onClick={(event) => {
                      handleClick(event);
                      setPopupMenuOpen(true);
                    }}
                    alt=''
                    src={process.env.REACT_APP_AVA_LOGO}
                  />
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
                          <Typography className={classes.popUpMenuRow} >{'Exit'}</Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem>
                        <Box
                          display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                          key={'vRowRefresh'}
                        >
                          <Typography className={classes.popUpFooter} >{`AVA vers ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                          <Typography className={classes.popUpFooter} >{`User ${state.session.user_id}${state.session.patient_id !== state.session.user_id ? (' (' + state.session.patient_id + ')') : ''}`}</Typography>
                          <Typography className={classes.popUpFooter} >{`Function: Calendar`}</Typography>
                        </Box>
                      </MenuItem>
                    </MenuList>
                  </Menu>
                </Box>
              </React.Fragment>
            }
          </Box>

          {/* Main List */}
          {!reactData.showDashboard && !reactData.showSummary &&
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
                          <Box
                            display='flex'
                            flexDirection='row'
                            style={options.noSelect ? { paddingLeft: '16px' } : {}}
                          >
                            {!options.noSelect &&
                              <Checkbox
                                checked={this_item.workData.checked || false}
                                disableRipple
                                key={'checkbox' + index}
                                onClick={() => { toggleCheck(index); }}
                              />
                            }
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
                                        style={AVATextStyle({ size: 1.5, italic: true, bold: true })}
                                      >
                                        {this_item.workData.formatted_type}
                                      </Typography>
                                    }
                                    {!filter.person_id &&
                                      <React.Fragment>
                                        {this_item.hasOwnProperty('current_request')
                                          ?
                                          <Typography
                                            variant='h5'
                                            style={AVATextStyle({ size: 1.5, bold: true })}
                                            className={classes.firstName}
                                          >
                                            {`${this_item.workData.requestor_name} ${this_item?.current_request?.textInput['Room Number'] ? ('(' + this_item?.current_request?.textInput['Room Number'] + ')') : (
                                              this_item.workData.requestor_location ? ('(' + this_item.workData.requestor_location + ')') : '')}`}
                                          </Typography>
                                          :
                                          <Typography
                                            variant='h5'
                                            style={AVATextStyle({ size: 1.5, bold: true })}
                                            className={classes.firstName}
                                          >
                                            {`${this_item.workData.requestor_name} ${this_item?.original_request?.textInput['Room Number'] ? ('(' + this_item?.original_request?.textInput['Room Number'] + ')') : (
                                              this_item.workData.requestor_location ? ('(' + this_item.workData.requestor_location + ')') : '')}`}
                                          </Typography>}
                                      </React.Fragment>
                                    }
                                    {this_item.workData.updated &&
                                      <Typography
                                        style={AVATextStyle({ size: 0.7 })}
                                      >
                                        {this_item.workData.updated}
                                      </Typography>
                                    }
                                    {!options.selectOnly &&
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
                                    }
                                  </Box>
                                </Box>
                                {!options.textForm
                                  && !options.selectOnly
                                  && this_item?.workData?.summary_request
                                  && this_item.workData.summary_request.map((mSumLine, mSumIndex) => (
                                    <Typography
                                      key={`prefLine-${mSumIndex}`}
                                      className={(`mrow${mSumLine[0]}` in classes) ? classes[`mrow${mSumLine[0]}`] : classes.mrowdetail}
                                    >
                                      {typeof mSumLine[1] === 'string' ? mSumLine[1] : (alert(mSumIndex, mSumLine))}
                                    </Typography>
                                  ))
                                }
                                {!options.selectOnly
                                  && this_item?.workData?.notes_section
                                  && this_item.workData.notes_section.map((mLine, mIndex) => (
                                    <Typography
                                      key={`prefLine-${mIndex}`}
                                      className={(`mrow${mLine[0]}` in classes) ? classes[`mrow${mLine[0]}`] : classes.mrowdetail}
                                    >
                                      {typeof mLine[1] === 'string' ? mLine[1] : (alert(index, mLine))}
                                    </Typography>
                                  ))}
                                {this_item.workData.open
                                  && !options.selectOnly
                                  && this_item?.workData?.formatted_request
                                  && this_item.workData.formatted_request.map((mLine, mIndex) => (
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
                                {this_item.workData.open && !options.selectOnly &&
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
                            <Box display='flex' onClick={() => { toggleOpen(index); }} flexGrow={1} flexDirection='column' justifyContent='center' alignItems='flex-start'>
                              {this_item.workData.textBased_request.map((textLine, tX) =>
                                <Typography
                                  style={AVATextStyle(textLine.startsWith('<b>') ? { bold: true } : {})}
                                  key={`singleTextLine-${index}_${tX}`}
                                  className={classes.mrowdetail}
                                >
                                  {textLine.replace('<b>', '')}
                                </Typography>
                              )}
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
          }

          {/* Main Dashboard */}
          {reactData.showDashboard &&
            <Paper
              component={Box}
              overflow='auto'
              elevation={0}
              pt={3}
              pb={2}
              square
            >
              <List>
                {reactData.statusList.map((this_status, this_status_index) => (
                  (OKToDisplayStatus(this_status.value) &&
                    <Paper
                      component={Box}
                      elevation={0}
                      key={`paper_row_${this_status_index}`}
                    >
                      <Box
                        display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'
                        key={`paper_row_box${this_status_index}`}
                        className={classes.listItem}
                        style={{ backgroundColor: reactData.statistics.color[this_status.value] }}
                        marginBottom={1.5}
                        marginLeft={2}
                        padding={2}
                        borderRadius={'32px'}
                        border={1}
                        borderColor={'black'}
                      >
                        <Box display='flex' flexDirection='row' width='100%' justifyContent='space-between' alignItems='center'>
                          <Box display='flex' flexDirection='column' marginBottom={1.5}>
                            <Typography
                              variant='h5'
                              style={AVATextStyle({ size: 1.5, bold: true })}
                              className={classes.firstName}
                            >
                              {reactData.statusObj[this_status.value].display}
                            </Typography>
                            <Typography
                              style={AVATextStyle({ margin: { left: 1 }, size: 1 })}
                            >
                              {`Count: ${reactData.statistics.count[this_status.value]}`}
                            </Typography>
                            <Typography
                              style={AVATextStyle({ margin: { left: 1 }, size: 1 })}
                            >
                              {`Avg ${(reactData.statistics.open_closed[this_status.value] === 'open') ? 'Age' : 'Days to Close'}: ${reactData.statistics.average_open_time[this_status.value].toFixed(1)} days`}
                            </Typography>
                            {reactData.statistics.average_time_since_last_activity.hasOwnProperty(this_status.value) &&
                              <React.Fragment>
                                <Typography
                                  style={AVATextStyle({ margin: { left: 1 }, size: 1 })}
                                >
                                  {`Avg Time Since Last Activity: ${reactData.statistics.average_time_since_last_activity[this_status.value].toFixed(1)} days`}
                                </Typography>
                                <Typography
                                  style={AVATextStyle({ margin: { left: 1 }, size: 1 })}
                                >
                                  {`Age of Oldest: ${reactData.statistics.oldest_requests[this_status.value][0].age.toFixed(1)} days`}
                                </Typography>
                              </React.Fragment>
                            }
                          </Box>
                          <Typography
                            style={AVATextStyle({ margin: { right: 1 }, align: 'right', size: 4 })}
                          >
                            {reactData.statistics.value_word[this_status.value]}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  )
                ))}
              </List>
            </Paper>
          }


          {/* Summary */}
          {reactData.showSummary &&
            <Paper
              component={Box}
              overflow='auto'
              elevation={0}
              pt={3}
              pb={2}
              square
            >
              <List>
                {reactData.display_summaryList.map((this_item, this_index) => (
                  <Paper
                    component={Box}
                    elevation={0}
                    key={`paper_row_${this_index}`}
                  >
                    <Box
                      display='flex' flexDirection='column' justifyContent='flex-start' alignItems='flex-start'
                      key={`paper_row_box${this_index}`}
                      className={classes.listItem}
                      marginLeft={2}
                    >
                      {((this_index === 0) || (this_item.menuType !== reactData.display_summaryList[this_index - 1].menuType)) &&
                        <Typography
                          variant='h5'
                          style={AVATextStyle({ size: 1.2, bold: true, margin: { top: 2 } })}
                          className={classes.firstName}
                        >
                          {this_item.menuType}
                        </Typography>
                      }
                      <Box display='flex'
                        flexDirection='row' width='100%'
                        justifyContent='flex-start'
                        alignItems='center'
                        onClick={() => {
                          reactData.rowOpen[this_index] = !reactData.rowOpen[this_index];
                          updateReactData({
                            rowOpen: reactData.rowOpen
                          }, true);
                        }}
                      >
                        <Typography
                          variant='h5'
                          style={AVATextStyle({ size: 1, margin: { top: 1, left: 2 } })}
                          className={classes.firstName}
                        >
                          {`${this_item.description} - ${this_item.count}${(this_item.qual && (Object.keys(this_item.qual).length > 0)) ? '*' : ''}`}
                        </Typography>
                      </Box>
                      {reactData.rowOpen[this_index]
                        && Object.keys(this_item.qual).sort().map((qText, qX) => (
                          <Typography
                            key={`qual_row_${this_index}_${qX}`}
                            variant='h5'
                            style={AVATextStyle({ margin: { left: 4 }, italic: true, size: 1 })}
                            className={classes.firstName}
                          >
                            {`${qText} - ${this_item.qual[qText]}`}
                          </Typography>
                        )
                        )}
                    </Box>
                  </Paper>
                ))}
              </List>
            </Paper>
          };

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
          {
            reactData.selectAssignTo &&
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
          {reactData.showUpdateForm && (options && options.woNumber) &&
            <AVATextInput
              titleText={`Update this Item`}
              promptText={['WO Number', '[select]Status', 'Notes', '[selectmulti]Notify']}
              valueText={[
                commonFKey(),
                '',
                '',
                ''
              ]}
              selectionList={[
                null,
                reactData.statusList.filter(s => {
                  return !s.hasOwnProperty('selectable') || s.selectable;
                }),
                null,
                getRequestors()
              ]}
              buttonText={'Update'}
              onCancel={() => {
                updateReactData({
                  showUpdateForm: false
                }, true);
              }}
              onSave={async (response) => {
                await handleUpdates({
                  woNumber: response[0],
                  newStatus: response[1],
                  enteredNote: response[2],
                  notify: response[3]
                });
                updateReactData({
                  showUpdateForm: false
                }, true);
              }}
            />
          }
          {reactData.showUpdateForm && (!options || !options.woNumber) &&
            <AVATextInput
              titleText={`Update this Item`}
              promptText={['[select]Status', 'Notes', '[selectmulti]Notify']}
              valueText={[
                '',
                '',
                ''
              ]}
              selectionList={[
                reactData.statusList.filter(s => {
                  return !s.hasOwnProperty('selectable') || s.selectable;
                }),
                null,
                getRequestors()
              ]}
              buttonText={'Update'}
              onCancel={() => {
                updateReactData({
                  showUpdateForm: false
                }, true);
              }}
              onSave={async (response) => {
                await handleUpdates({
                  woNumber: null,
                  newStatus: response[0],
                  enteredNote: response[1],
                  notify: response[2]
                });
                updateReactData({
                  showUpdateForm: false
                }, true);
              }}
            />
          }
          {
            reactData.showStaffAccess && false &&
            (['in'].includes(reactData.checkInStatusObj.last_status) ?
              <AVATextInput
                titleText={[
                  makeGreeting(state.session.patient_display_name),
                  `[italic]You've been checked in with ${reactData.dataRows[reactData.checkInStatusObj.targetIndex].on_behalf_of} since ${makeDate(reactData.checkInStatusObj.last_update).relative}`,
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
                  reactData.checkInStatusObj.reqRec.last_status = 'out';
                  reactData.checkInStatusObj.reqRec.last_update = now.timestamp;
                  reactData.checkInStatusObj.reqRec.type_date = `${reactData.checkInStatusObj.reqRec.request_type}~${now.timestamp}`;
                  let hNote = `Checked out on ${now.absolute}`;
                  /*  if we have other data to capture ("did you complete your task?", "issues to note", etc.)
                      those notes would be captured in prompts and be saved here
                  responses.forEach((r, x) => {
                    if (r && reactData.residentPrompts) {
                      hNote += ` ${reactData.residentPrompts[x]}: ${r}.`;
                    }
                  });
                  */
                  reactData.checkInStatusObj.reqRec.history.unshift(hNote);
                  let newFormattedRequest = await buildRequestDetails(reactData.dataRows[reactData.checkInStatusObj.targetIndex]);
                  reactData.dataRows[reactData.checkInStatusObj.targetIndex].workData.formatted_request = newFormattedRequest.workData.formatted_request;
                  await updateServiceRequest([reactData.checkInStatusObj.reqRec]);
                  enqueueSnackbar(`Check-out successful!`, { variant: 'success', persist: false });
                  updateReactData({
                    showStaffAccess: false
                  }, true);
                }}
                allowCancel={true}
                options={{ save_on_enter: true }}
              />
              :
              <StaffAccess
                open={true}
                priority_list={reactData.listOfPeopleToVisit}
                onClose={async (selected_person) => {
                  if (selected_person) {
                    /****  FUTURE
                    let now = makeDate(new Date());
                    Object.assign((reactData.checkInStatusObj.reqRec || {}), reactData.dataRows[reactData.checkInStatusObj.targetIndex]);
                    reactData.checkInStatusObj.reqRec.last_status = 'in';
                    reactData.checkInStatusObj.reqRec.last_update = now.timestamp;
                    reactData.checkInStatusObj.reqRec.type_date = `${reactData.checkInStatusObj.reqRec.request_type}~${now.timestamp}`;
                    let hNote = `${state.session.patient_display_name} checked in to ${selected_person} on ${now.absolute}`;
                    reactData.checkInStatusObj.reqRec.history.unshift(hNote);
                    reactData.checkInStatusObj.reqRec.last_visited = reactData.dataRows[reactData.checkInStatusObj.targetIndex].requestor;
                    let newFormattedRequest = await buildRequestDetails(reactData.dataRows[reactData.checkInStatusObj.targetIndex]);
                    reactData.dataRows[reactData.checkInStatusObj.targetIndex].workData.formatted_request = newFormattedRequest.workData.formatted_request;
                    await updateServiceRequest([reactData.checkInStatusObj.reqRec]);
                    enqueueSnackbar(`Check-in successful!`, { variant: 'success', persist: false });
                    *****/
                  }
                  updateReactData({
                    showStaffAccess: false,
                    dataRows: reactData.dataRows
                  }, true);
                }}
              />

            )
          }

          {
            reactData.showStaffAccess &&
            <StaffAccess
              open={true}
              priority_list={reactData.listOfPeopleToVisit}
              onClose={async (selected_person) => {
                if (selected_person) {
                  /****  FUTURE
                  let now = makeDate(new Date());
                  Object.assign((reactData.checkInStatusObj.reqRec || {}), reactData.dataRows[reactData.checkInStatusObj.targetIndex]);
                  reactData.checkInStatusObj.reqRec.last_status = 'in';
                  reactData.checkInStatusObj.reqRec.last_update = now.timestamp;
                  reactData.checkInStatusObj.reqRec.type_date = `${reactData.checkInStatusObj.reqRec.request_type}~${now.timestamp}`;
                  let hNote = `${state.session.patient_display_name} checked in to ${selected_person} on ${now.absolute}`;
                  reactData.checkInStatusObj.reqRec.history.unshift(hNote);
                  reactData.checkInStatusObj.reqRec.last_visited = reactData.dataRows[reactData.checkInStatusObj.targetIndex].requestor;
                  let newFormattedRequest = await buildRequestDetails(reactData.dataRows[reactData.checkInStatusObj.targetIndex]);
                  reactData.dataRows[reactData.checkInStatusObj.targetIndex].workData.formatted_request = newFormattedRequest.workData.formatted_request;
                  await updateServiceRequest([reactData.checkInStatusObj.reqRec]);
                  enqueueSnackbar(`Check-in successful!`, { variant: 'success', persist: false });
                  *****/
                  let now = makeDate(new Date());
                  await handleUpdates({
                    newStatus: `in_process`,
                    history_update: `${state.session.patient_display_name} checked in to ${selected_person[0].location} (${selected_person[0].display_name || selected_person[0].name}) on ${now.absolute}`
                  });
                }
                updateReactData({
                  showStaffAccess: false,
                  dataRows: reactData.dataRows
                }, true);
              }}
            />
          }


          {/* Buttons */}
          {
            ((loading === 'load_complete') || (reactData.dataRows.length > 0)) &&
            (!options.viewMode) && (!options.selectOnly) &&
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
                  {options.allowDashboard && reactData.statistics &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'purple', color: 'white' }}
                      size='small'
                      onClick={() => {
                        updateReactData({
                          showDashboard: !reactData.showDashboard
                        }, true);
                      }}
                      startIcon={reactData.showDashboard ? <ListIcon size="small" /> : <DashboardIcon size="small" />}
                    >
                      {reactData.showDashboard ? 'List' : 'Dashboard'}
                    </Button>
                  }
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
                      {!options.noSelect &&
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
                      }
                    </React.Fragment>
                  }
                  {options.allowSummary
                    && !options.noSelect
                    && ((rowsDisplayed.length > 0) || reactData.showSummary)
                    &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'orange', color: 'white' }}
                      size='small'
                      onClick={async () => {
                        await prepareSummary();
                        updateReactData({
                          display_summary: reactData.display_summary,
                          showSummary: !reactData.showSummary
                        }, true);
                      }}
                      startIcon={reactData.showSummary ? <ListIcon size="small" /> : <DashboardIcon size="small" />}
                    >
                      {reactData.showSummary ? 'List' : 'Summary'}
                    </Button>
                  }
                  {!options.noSelect
                    && (rowsDisplayed.length > 0)
                    &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'pink', color: 'black' }}
                      size='small'
                      onClick={async () => {
                        let allRows = allRowsSelected();
                        let anySelected = anyRowsSelected();
                        if (!anySelected || allRows.allChecked) {
                          await printRawData(
                            reactData.dataRows.filter((r, x) => {
                              return (OKToDisplay(r));
                            }),
                            state
                          );
                        }
                        else {
                          await printRawData(
                            reactData.dataRows.filter((r, x) => {
                              return (r.workData.checked && OKToDisplay(r));
                            }),
                            state
                          );
                        }
                      }}
                      startIcon={<ListAltIcon size="small" />}
                    >
                      {`Print Report`}
                    </Button>
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
                  {anyRowsSelected() &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'aqua', color: 'black' }}
                      size='small'
                      onClick={async () => {
                        let checkInStatusObj = await getCurrentStatus(session.client_id, session.patient_id, 'staff');
                        checkInStatusObj.targetIndex =   // check in / check out only applies to the FIRST checked-off row
                          reactData.dataRows.findIndex(r => {
                            return r.workData.checked;
                          });
                        let checklist_info = checklistSelected();
                        let cEntries;
                        let listOfPeopleToVisit = [];
                        if (checklist_info.OK) {
                          cEntries = await getCalendarEntries({
                            client: session.client_id,
                            event_id: checklist_info.foreign_key,
                            type: 'slot'
                          });
                          cEntries.forEach(e => {
                            if (e.slotData && !e.marked && (e.slotData?.status?.current !== 'released')) {
                              let [first, last] = (e.slotData.display_name || e.slotData.name).split(' ');
                              listOfPeopleToVisit.push({
                                id: e.slot_owner,
                                first: first,
                                last: last
                              });
                            }
                          });
                        }
                        else {
                          let [first, last] = (reactData.dataRows[checkInStatusObj.targetIndex].workData.requestor_name).split(' ');
                          listOfPeopleToVisit = [{
                            id: reactData.dataRows[checkInStatusObj.targetIndex].requestor,
                            first: first,
                            last: last
                          }];
                        }
                        updateReactData({
                          showStaffAccess: true,
                          listOfPeopleToVisit: listOfPeopleToVisit,
                          checkInStatusObj: checkInStatusObj
                        }, true);
                      }}
                      startIcon={<OpenDoorIcon size="small" />}
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
                        let checklist_info = checklistSelected();
                        if (checklist_info.OK) {
                          let cEntries = await getCalendarEntries({
                            person_id: session.patient_id,
                            client: session.client_id,
                            event_id: checklist_info.foreign_key
                          });
                          let this_event = {
                            event_key: checklist_info.foreign_key
                          };
                          this_event.occData = Object.assign({},
                            cEntries[0].eventData.event_data,
                            cEntries[0].eventData,
                            { location: cEntries[0].eventData.event_data.location.description },
                            { signup_type: cEntries[0].eventData.sign_up.type },
                            cEntries[1],
                            { date: cEntries[1].occurrence_date },
                            { time$: `${cEntries[0].eventData.event_data.time.from}${((cEntries[0].eventData.event_data.time.to && cEntries[0].eventData.event_data.time.to.trim() !== '') ? ' to ' + cEntries[0].eventData.event_data.time.to : '')}` },
                            { time24: this_event.time24 }
                          );
                          updateReactData({
                            showEventEdit: true,
                            detailEdit: this_event
                          }, true);
                        }
                        else {
                          await setStatusList();
                          updateReactData({
                            showUpdateForm: true
                          }, true);
                        }
                      }}
                      startIcon={<CheckIcon size="small" />}
                    >
                      {'Update'}
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
          {
            ((loading === 'load_complete') || (reactData.dataRows.length > 0)) &&
            (options.selectOnly) && (anyRowsSelected()) &&
            // Command Area
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' flexWrap='wrap' justifyContent='center' alignItems='center'>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'blue', color: 'white', paddingRight: (reactData.isMobile ? '4px' : '') }}
                    size='small'
                    onClick={async () => {
                      await handlePrintRequest();
                    }}
                    startIcon={<PrintIcon size="small" />}
                  >
                    {'Check me in!'}
                  </Button>
                </Box>
              </Box>
            </DialogActions>
          }
          {
            ((loading === 'load_complete') || (reactData.dataRows.length > 0)) &&
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
          {
            (loading === 'load_complete') && reactData.showEventEdit &&
            <CalendarEventEditForm
              pEventCode={reactData.detailEdit.event_key}
              peopleList={[]}
              pPatient={session.patient_id}
              pClient={session.client_id}
              pOccData={reactData.detailEdit.occData}
              onReset={async (occData) => {
                if (occData.summaryInfo.listComplete) {
                  let requestAction = await orderWarning(occData.summaryInfo.markedSlots);
                  if (requestAction === 'close') {
                    await handleUpdates({
                      newStatus: 'complete',
                      enteredNote: `${occData.summaryInfo.markedSlots} of ${occData.summaryInfo.ownedSlots} items marked off`,
                    });
                  }
                }
                updateReactData({
                  showEventEdit: false
                }, true);
              }}
            />
          }
        </React.Fragment >
      }
    </Dialog >
  );
};