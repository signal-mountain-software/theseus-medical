import React from 'react';
import useSession from '../../hooks/useSession';

import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { html_to_pdf } from '../../util/AVAMessages';
import Select from "react-dropdown-select";

import { getImage, getPerson, makeName } from '../../util/AVAPeople';
import { extract, dbClient, sentenceCase, listFromArray, cl, uuid, recordExists, array_in_array } from '../../util/AVAUtilities';
import { getMemberList } from '../../util/AVAGroups';
import { AVATextStyle, AVADefaults } from '../../util/AVAStyles';
import { makeDate } from '../../util/AVADateTime';
import AVAUploadFile from '../../util/AVAUploadFile';
import { Alert, AlertTitle } from '@material-ui/lab/';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';

import CloseIcon from '@material-ui/icons/HighlightOff';
import AttachmentIcon from '@material-ui/icons/Attachment';
import ReplyIcon from '@material-ui/icons/Reply';
import SettingsIcon from '@material-ui/icons/Settings';

import QuickSearch from '../sections/QuickSearch';

import { useIdleTimer } from 'react-idle-timer';

import Button from '@material-ui/core/Button';
import { Snackbar } from '@material-ui/core';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import IconButton from '@material-ui/core/IconButton';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';

import DeleteIcon from '@material-ui/icons/Delete';
import SendIcon from '@material-ui/icons/Send';
import ZoomInIcon from '@material-ui/icons/ZoomIn';
import AVAConfirm from './AVAConfirm';
import MessageDetailDialog from '../dialogs/MessageDetailDialog';

import { AVAclasses } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  clientPopUp: {
    borderRadius: '30px 30px 30px 30px',
    padding: '16px',
    height: '450px'
  },
  newMessagePage: {
    paddingTop: '8px',
    paddingBottom: '8px',
    justifyContent: 'center',
    minHeight: 'fit-content',
    flexGrow: 1,
    overflow: 'visible'
  },
  page: {
    height: 'auto',
    overflowX: 'hidden'
  },
  SendButton: {
    marginRight: theme.spacing(1),
    marginTop: theme.spacing(1),
    variant: 'outlined',
    border: '0.75px solid gray',
    textTransform: 'none',
    textDecoration: 'none',
    textWrap: 'nowrap',
    fontWeight: 'bold',
    size: 'small',
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
  freeInput: {
    marginLeft: '25px',
    marginRight: 2,
    marginBottom: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: theme.spacing(1),
    width: '60%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
  },
  imageArea: {
    minWidth: '50px',
    maxWidth: '50px',
    minHeight: '50px',
    maxHeight: '50px',
    marginRight: theme.spacing(1),
    borderRadius: '25px'
  },
  myImageArea: {
    minWidth: '70px',
    maxWidth: '70px',
    minHeight: '70px',
    maxHeight: '70px',
    marginRight: theme.spacing(1),
    borderRadius: '35px'
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  buttonArea: {
    maxWidth: 1000,
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  rowButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'contained',
    size: 'small'
  },
  listItem: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(2),
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
  attachmentLine: {
    marginTop: theme.spacing(1),
    fontSize: theme.typography.fontSize * 1.0,
  },
  techInfoLine: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(2),
  },
  techInfoLine2: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(4),
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
    marginRight: theme.spacing(1),
  }
}));

// Pure utility functions — module-level so they are not recreated on every render
function makeReadableTime(pJavaDate, timeZone) {
  const d = new Date(Number(pJavaDate));
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
    ...(timeZone ? { timeZone } : {})
  });
}

function standardizeMethod(raw_method) {
  if (raw_method === 'email') { return 'e-Mail'; }
  if (raw_method === 'sms') { return 'text'; }
  if (raw_method === 'voice') { return 'phone'; }
  if (raw_method === 'hold') { return 'held'; }
  if (raw_method === 'alert') { return 'Alert'; }
  return 'AVA';
}

/**
 * Returns an array of { start, end } millisecond ranges — one per week — working
 * backwards from `fromTime`.  Newest range first.
 */
function buildWeekBoundaries(fromTime, weeksBack) {
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const boundaries = [];
  let end = fromTime;
  for (let i = 0; i < weeksBack; i++) {
    const start = end - oneWeekMs;
    boundaries.push({ start, end });
    end = start;
  }
  return boundaries;
}

/**
 * Runs a DynamoDB query to completion, following LastEvaluatedKey pagination.
 * Returns a flat array of all items across all pages.
 */
async function queryAllPages(queryParams) {
  const items = [];
  let params = { ...queryParams };
  let pageGuard = 0;
  do {
    const result = await dbClient.query(params).promise().catch(() => null);
    if (!result || !result.Items) { break; }
    items.push(...result.Items);
    if (result.LastEvaluatedKey) {
      params = { ...params, ExclusiveStartKey: result.LastEvaluatedKey };
    } else {
      break;
    }
    pageGuard++;
  } while (pageGuard < 20);
  return items;
}

export default ({ pPerson, pClient, pMessageList, onReset, defaultValue, options }) => {

  const { state } = useSession();
  const classes = useStyles();
  const AVAClass = AVAclasses();

  // state.session.client_style.
  //    restrict_groups = true/false - prevents you from seeing groups that are parents or siblings of a group you are in
  //    show_all_people = true/false - will suppress the list of people you can select (names can still be searched for)

  const placeholderImage =
    'https://theseus-medical-storage.s3.amazonaws.com/public/patients/ademo.jpg';


  const [reactData, setReactData] = React.useState({
    administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),
    alert: false,
    allowChangeSender: ((options && options.allowChangeSender) ? options.allowChangeSender : false),
    alternateSenderName: false,
    attachments_to_send: ((options && options.newMessage && options.attachmentList) ? options.attachmentList : []),
    confirmMessage: false,
    confirmessage_index: false,
    deletePending: false,
    expanded_composite_key: false,
    idleState: false,
    imageTable: {},
    inOut_filter: (options && options.inOut_filter) || false,
    isSmall: (window.window.innerWidth < 800),
    isTiny: (window.window.innerWidth < 500),
    is_public: false,
    is_reply: ((options && options.newMessage && options.newMessageThread) ? true : false),
    lastActiveTime: new Date(),
    lastReloadTime: 0,
    messageFilter: false,
    messageFilterLower: false,
    messageList: pMessageList,
    myImage: null,
    myName: null,
    newMessageMode: (options && options.newMessage) || false,
    newMessageSendFrom: ((options && options.newMessage && options.sendFrom) ? options.sendFrom : pPerson),
    newMessageRecipients: ((options && options.newMessage && options.recipients) ? options.recipients : []),
    newMessageSubject: ((options && options.newMessage && options.subject) ? options.subject : ''),
    newMessageText: ((options && options.newMessage && options.messageText) ? options.messageText : ''),
    newMessageThread: ((options && options.newMessage && options.newMessageThread) ? options.newMessageThread : false),
    newMessageVMAlternative: false,
    newMessageVMAltText: '',
    newUrgentMessage: false,
    options,
    preferred_recipients: [],
    replyToList: [],
    selectedPeople_count: ((options && options.newMessage && options.recipients) ? options.recipients.length : 0),
    selectedPeople_list: ((options && options.newMessage && options.recipients) ? options.recipients.map(r => r.person_id ) : []),
    showSelectSender: false,
    selections: [], // wip selections from quick search
    showDeleted: (options && options.showDeleted) || false,
    showGroupList: ((options && options.hasOwnProperty('showGroupList') && !options.showGroupList) ? false : true),
    showIndividualList: ((options && options.hasOwnProperty('showIndividualList') && !options.showIndividualList) ? false : true),
    showPreferredList: ((options && options.hasOwnProperty('showPreferredList') && !options.showPreferredList) ? false : true),
    withGroupList: ((options && options.hasOwnProperty('showGroupList') && !options.showGroupList) ? false : true),
    withIndividualList: ((options && options.hasOwnProperty('showIndividualList') && !options.showIndividualList) ? false : true),
    withPreferredList: ((options && options.hasOwnProperty('showPreferredList') && !options.showPreferredList) ? false : true),
    showQuickSearch: (options && options.newMessage && (!options.recipients || (options.recipients.length === 0))) || false,
    showVariableMenu: false,
    showVMAlt: ((options && options.hasOwnProperty('hideVMAlt') && options.hideVMAlt) ? true : false),
    singleFilterDigit: false,
    start_time: (options && options.hasOwnProperty('start_time')) ? makeDate(options.start_time).timestamp : false,
    loadedWeeksOldest: null,  // timestamp of the oldest week-start we have fetched
    loadingOlder: false,
    showSinceDatePicker: false,
    statusFilter: (options && options.statusFilter) || false,
    statusMessage: false,
    sorted_threads: [],
    threadObj: {},
    threads: {},
    user_fontSize: AVADefaults({ fontSize: 'get' }) || 1.5,
    viewOnly: (options && options.viewOnly) || false,
    viewMessageDialog: false,
    viewPeopleMaintenance: false,
    warning: false,
    window_width: window.window.innerWidth,
  });

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const isMountedRef = React.useRef(true);
  const refreshIntervalRef = React.useRef(null);
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (refreshIntervalRef.current) { clearInterval(refreshIntervalRef.current); }
    };
  }, []);
  const updateReactData = (newData, force = false) => {
    if (!isMountedRef.current) { return; }
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  // Shared DB error handler — shows an appropriate alert for network vs. server errors
  function handleDbError(error, context) {
    updateReactData({
      alert: {
        severity: 'error',
        title: error.code === 'NetworkingError' ? 'No Internet' : 'Database problem',
        message: error.code === 'NetworkingError'
          ? 'There is no internet connection'
          : `Error reading ${context}: ${error}`,
      }
    }, true);
    return null;
  }

  let status_filter_result = false;

  const onImageError = (e) => {
    e.target.src = placeholderImage;
  };

  if (defaultValue) {
    if (Array.isArray(defaultValue)) {
      defaultValue = defaultValue[0];
    }
  }

  const [rowLimit, setRowLimit] = React.useState(20);
  const scrollValue = 20;

  /*
   const autoFocus = React.useRef(null);
   React.useEffect(() => {
     if (autoFocus && autoFocus.current) {
       autoFocus.current.scrollIntoView({
         behavior: 'smooth',
         block: 'start',
       });
     }
   }, []);
 */

  React.useEffect(() => {
    const onPopState = (e) => {
      console.log("Back navigation triggered");
      onReset();
    };
    window.history.pushState(null, 'useEffect', window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [onReset]);

  function makeSubject(this_thread, message_number) {
    let response = reactData.threads[this_thread].messages[message_number].subject || `Conversation originated by ${reactData.threads[this_thread].messages[message_number].author_name}`;
    if (reactData.threads[this_thread].messages[message_number].subject.startsWith('Message from')) {
      response = reactData.threads[this_thread].messages[message_number].subject.replace('Message from', 'Conversation originated by');
    }
    return response;
    // return titleCase(response);
  }

  function searchButtonText() {
    if (reactData.selections.length === 0) {
      return 'Exit';
    }
    if (reactData.selections.length > 1) {
      if (!reactData.selectedPeople_count || (reactData.selectedPeople_count === 0)) {
        return `Select ${reactData.selections.reduce((total, this_selection) => {
          return (this_selection.peopleList ? (total + this_selection.peopleList.length) : (total + 1));
        }, 0)} people`;
      }
      else {
        return `Select ${reactData.selectedPeople_count} people`;
      }
    }
    // options below if only one item selected
    if (reactData.selections[0].hasOwnProperty('person_id')) {
      return `Select ${reactData.selections[0].person_name.split(' ')[0]}`;
    }
    else if (reactData.selections[0].hasOwnProperty('personList')) {
      return `Select ${reactData.selections[0].listName}`;
    }
    else if (reactData.selections[0].hasOwnProperty('group_name')) {
      return `Select ${reactData.selections[0].group_name}`;
    }
    else {
      return `Select`;
    }
  }

  const editorRef = React.useRef(null);
  const [dirty, setDirty] = React.useState(false);
  if (dirty) {
    reactData.dirty = true;
  };
  React.useEffect(() => setDirty(false), []);
  const HTMLsave = () => {
    if (editorRef.current) {
      const quillEditor = editorRef.current.getEditor();
      let HTMLcontent = quillEditor.root.innerHTML;
      HTMLcontent = HTMLcontent.replace(/<img src/gi, "<img style=\"max-width: 100%; height: auto;\" src"); // make images responsive
      setDirty(false);
      let reactUpdObj = {
        newMessageText: HTMLcontent
      };
      updateReactData(reactUpdObj, true);
      console.log(HTMLcontent);
    }
  };

  const handleChangeMessageFilter = event => {
    if (event.target.value.length === 0) {
      updateReactData({
        messageFilter: false,
        messageFilterLower: false,
        singleFilterDigit: false
      }, true);
    }
    else {
      updateReactData({
        messageFilter: event.target.value,
        messageFilterLower: event.target.value.toLowerCase(),
        singleFilterDigit: (event.target.value.length === 1)
      }, true);
    }
  };

  const handleRemoveMessage = async ({ thread_id, composite_key }) => {
    let dRec = await dbClient
      .get({
        Key: {
          thread_id: thread_id,
          composite_key: composite_key
        },
        ExpressionAttributeValues: {
          ':t': true
        },
        TableName: "TheseusMessages",
      })
      .promise()
      .catch(error => {
        dRec = null;
      });
    if (!recordExists(dRec)) {
      updateReactData({
        alert: {
          severity: 'error',
          title: 'Not Deleted',
          message: `We couldn't retrieve the message you want to delete`,
        }
      }, true);
      return;
    }
    else {
      let new_deleted_by = (dRec.Item.deleted_by || []);
      new_deleted_by.push(state.session.user_id);
      await dbClient
        .update({
          Key: {
            thread_id: thread_id,
            composite_key: composite_key
          },
          UpdateExpression: 'set delete_flag = :t, deleted_by = :d, deleted_time = :n',
          ExpressionAttributeValues: {
            ':t': true,
            ':d': new_deleted_by,
            ':n': new Date().getTime()
          },
          TableName: "TheseusMessages",
        })
        .promise()
        .catch(error => {
          updateReactData({
            alert: {
              severity: 'error',
              title: 'Not Deleted',
              message: `We were unable to delete that message`,
            }
          }, true);
          return;
        });
    }
    delete reactData.threads[thread_id];
    let foundIt = reactData.sorted_threads.findIndex(t => { return t === thread_id; });
    if (foundIt > -1) {
      reactData.sorted_threads.splice(foundIt, 1);
    }
    updateReactData({
      threads: reactData.threads,
      sorted_threads: reactData.sorted_threads,
      expanded_composite_key: false
    }, true);
  };

  const onScroll = event => {
    if (rowLimit < reactData.messageList.length) {
      setRowLimit(rowLimit + scrollValue);
      setForceRedisplay(!forceRedisplay);
    }
  };

  const oneMinute = 1000 * 60;
  const msBeforeSleeping = 1 * oneMinute;

  // Feature flags — set in state.session.client_style to opt OUT (default is ON)
  const hideMessageImages = !state.session.client_style || (state.session.client_style.messages_hide_images !== false);
  const forceMessagePlainText = !state.session.client_style || (state.session.client_style.messages_plain_text_only !== false);
  const truncateMessageText = !state.session.client_style || (state.session.client_style.messages_truncate_body !== false);
  const MESSAGE_TRUNCATE_LENGTH = 500;

  const onAction = () => {
    if (reactData.idleState) {
      updateReactData({ idleState: false }, false);
    }
    reset();
  };

  const onIdle = () => {
    if (!reactData.idleState) {
      cl(`Went idle at ${new Date().toLocaleString()}.`);
      updateReactData({ idleState: true, enteredIdleStateTime: new Date() }, true);
    }
    reset();
  };

  const { start, reset } = useIdleTimer({
    onIdle,
    onAction,
    timeout: msBeforeSleeping,
    throttle: 500
  });

  async function getTemplateList() {
    let workingList = [];
    let queryObj = {
      KeyConditionExpression: 'client_id = :c',
      ExpressionAttributeValues: {
        ':c': pClient
      },
      TableName: "MessageTemplates"
    };
    let templateRecs;
    do {
      templateRecs = await dbClient
        .query(queryObj)
        .promise()
        .catch(error => handleDbError(error, 'Templates'));
      if (templateRecs && templateRecs.LastEvaluatedKey) {
        queryObj.ExclusiveStartKey = templateRecs.LastEvaluatedKey;
      }
      else {
        delete queryObj.ExclusiveStartKey;
      }
      if (recordExists(templateRecs)) {
        for (let this_template of templateRecs.Items) {
          // Ensure template_mayUse_groupList exists and default to ['*all'] if not
          const mayUseGroupList = this_template.template_mayUse_groupList || ['*all'];
          if (mayUseGroupList.includes('*all') ||
            reactData.administrative_account ||
            array_in_array(mayUseGroupList, state.user.groups)) {
            workingList.push({
              value: this_template.template_id,
              label: this_template.template_name
            });
          }
        }
      }
    } while (queryObj.ExclusiveStartKey);
    return workingList;
  }

  async function getTemplateText(template_id) {
    let templateRec = await dbClient
      .get({
        Key: {
          'client_id': pClient,
          template_id
        },
        TableName: 'MessageTemplates'
      })
      .promise()
      .catch(error => {
        cl(`Error reading MessageTemplates`, error);
      });
    if (recordExists(templateRec)) {
      return templateRec.Item;
    }
    else {
      return {
        client_id: pClient,
        template_id,
        template_body: '',
        template_type: 'text'
      };
    }
  }

  async function releaseMessage(this_messageRec) {
    let goodHandle = true;
    let this_actionRec = this_messageRec.actionRec;
    let poTableName = (this_actionRec.content.testMode ? 'TestPostOffice' : 'PostOffice');
    let po_og = await dbClient
      .get({
        Key: { 'message_id': this_actionRec.content.message_id },
        TableName: poTableName
      })
      .promise()
      .catch(error => {
        cl(`Error reading ${poTableName}`, error);
        goodHandle = false;
      });
    if (goodHandle && recordExists(po_og)) {
      // make new message_id
      cl(`Got message from ${poTableName} with key ${this_actionRec.content.message_id}`);
      cl(`Composite_key is ${this_actionRec.content.composite_key}`);
      if (this_actionRec.content.composite_key) {
        // if this exists, we are re-trying a SINGLE recipient from a held message attempt
        // if this doesn't exist we are re-trying the ENTIRE message and all of its initial recipients
        cl(`Trying TheseusMessages with thread ${po_og.Item.thread_id} and composite ${this_actionRec.content.composite_key}`);
        let theseusMessage_og = await dbClient
          .get({
            Key: {
              thread_id: po_og.Item.thread_id,
              composite_key: this_actionRec.content.composite_key
            },
            TableName: 'TheseusMessages'
          })
          .promise()
          .catch(error => {
            cl(`Error reading TheseusMessages`, error);
          });
        if (recordExists(theseusMessage_og)) {
          cl(`Found original thread`);
          console.log(theseusMessage_og);
          // we are retrying a single message from a thread; send to the specific recipient
          po_og.Item.recipient_base = 'list';
          po_og.Item.recipient_key = [theseusMessage_og.Item.deliver_to];
        }
        else {
          cl(`Thread not found - this will be sent as a new thread`);
        }
      }
      po_og.Item.message_id += `.${new Date().getTime()}`;
      po_og.Item.byPass_rules = true;
      cl({ [poTableName]: po_og.Item });
      await dbClient
        .put({
          Item: po_og.Item,
          TableName: poTableName
        })
        .promise()
        .catch(error => {
          cl(`Error writing ${poTableName}`, error);
          goodHandle = false;
        });
      if (goodHandle) {
        cl(`Good write to ${poTableName} with message_id ${po_og.Item.message_id} `);
        // remove the message action
        cl(`Deleting ${this_actionRec.client_id}/${this_actionRec.after} from MessageActions`);
        await dbClient
          .delete({
            Key: {
              client_id: this_actionRec.client_id,
              after: this_actionRec.after
            },
            TableName: 'MessageActions'
          })
          .promise()
          .catch(error => {
            cl(`Error deleting ${poTableName}`, error);
            goodHandle = false;
          });
      }
    }
    else {
      cl(`Failed to get key ${this_actionRec.content.message_id} from ${poTableName}`);
      goodHandle = false;
    }
    return;
  }

  async function sendMessage() {
    let postTime = new Date().getTime();
    let message_id;
    if (!reactData.newMessageThread) {
      reactData.newMessageThread = `${postTime}.${uuid(6)}`;
      message_id = `${postTime}.${uuid(6)}.0~CuredMessage`;
    }
    else {
      message_id = `${reactData.newMessageThread}.${postTime}~CuredMessage`;
    }
    const reply_to = (reactData.replyToList && (reactData.replyToList.length > 0))
      ? reactData.replyToList.map(r => { return r.person_id; })
      : [];
    let recipient_key = [];
    reactData.newMessageRecipients.forEach(r => {
      if (r.person_id) { recipient_key.push(...([r.person_id].flat())); }
      else if (r.group_id) { recipient_key.push(`GRP:${r.group_id}`); }
      else if (r.hasOwnProperty('rIndex') && (r.rIndex > -1)) {
        recipient_key.push(...reactData.preferred_recipients[r.rIndex].personList);
      }
    });
    reply_to.forEach(r => {    // this makes sure that everyone on the reply_to list is copied on the original message
      if ((r !== reactData.newMessageSendFrom) && !recipient_key.includes(r)) {
        recipient_key.push(r);
      }
    });
    let PostOfficeRec = {
      Item: {
        thread_id: reactData.newMessageThread,
        message_id,
        allowReplyAll: reactData.allowReplyAll,
        attachments: reactData.attachments_to_send,
        client_id: pClient,
        deliver_time: postTime,
        from: reactData.newMessageSendFrom,
        message_text: reactData.newMessageText,
        patient_id: reactData.newMessageSendFrom,
        preferred_method: (reactData.newUrgentMessage ? 'urgent' : null),
        recipient_base: 'list',
        recipient_key,
        subject: reactData.newMessageSubject || `Message from ${await makeName(reactData.newMessageSendFrom)}`,
        reply_to,
        is_public: reactData.is_public
      },
      TableName: 'PostOffice'
    };
    if (options && options.forwardBypassRules) {
      PostOfficeRec.Item.byPass_rules = true;
    }
    if (reactData.newMessageSendFrom !== pPerson) {
      PostOfficeRec.Item.sender_spoofedByAccount = pPerson;
      PostOfficeRec.Item.sender_spoofedByUser = state.session.user_id;
    }
    if (reactData.newMessageText.startsWith('<p')) {
      PostOfficeRec.Item.html_message_text = reactData.newMessageText;
      let plain_text = reactData.newMessageText;
      plain_text = plain_text.replace(/<style([\s\S]*?)<\/style>/gi, '');
      plain_text = plain_text.replace(/<script([\s\S]*?)<\/script>/gi, '');
      plain_text = plain_text.replace(/<strong>/ig, '');
      plain_text = plain_text.replace(/<\/strong>/ig, '');
      plain_text = plain_text.replace(/<\/div>/ig, '\n');
      plain_text = plain_text.replace(/<\/li>/ig, '\n');
      plain_text = plain_text.replace(/<li>/ig, '  *  ');
      plain_text = plain_text.replace(/<\/ul>/ig, '\n');
      plain_text = plain_text.replace(/<\/p>/ig, '\n');
      plain_text = plain_text.replace(/<br\s*[/]?>/gi, "\n");
      plain_text = plain_text.replace(/<[^>]+>/ig, '');
      plain_text = plain_text.replace('%%', '');
      PostOfficeRec.Item.message_text = plain_text;
      PostOfficeRec.Item.s3MessageHTMLdoc = await html_to_pdf({
        client_id: pClient,
        htmlText: reactData.newMessageText,
        messageKey: message_id
      });
    }
    if (reactData.newMessageVMAlternative && reactData.newMessageVMAltText && (reactData.newMessageVMAltText.length > 0)) {
      PostOfficeRec.Item.voice_mail = reactData.newMessageVMAltText;
    }
    if (window.location.href.split('//')[1].slice(0, 1).toUpperCase() !== 'D') {
      PostOfficeRec.TableName = 'TestPostOffice';
    }
    let goodPost = true;
    await dbClient
      .put(PostOfficeRec)
      .promise()
      .catch(error => {
        cl(`Error writing to Post Office; error is ${error}`);
        goodPost = false;
      });
    if (goodPost) {
      let nowTime = new Date().getTime();
      reactData.threads[reactData.newMessageThread] = {
        last_update: nowTime,
        delete_flag: false,
        messages: [
          {
            message_text: PostOfficeRec.Item.message_text,
            html_message_text: PostOfficeRec.Item.html_message_text || PostOfficeRec.Item.message_text,
            subject: PostOfficeRec.Item.subject,
            last_update: nowTime,
            attachments: PostOfficeRec.Item.attachments,
            composite_key: `T:${reactData.newMessageThread}~M:001~D:${recipient_key[0]}`,
            inOut: 'out',
            my_id: pPerson,
            sent_time: nowTime,
            author_id: pPerson,
            author_name: await makeName(pPerson),
            author_image: getImage(pPerson),
            reply_to: PostOfficeRec.Item.reply_to,
            allowReplyAll: PostOfficeRec.Item.allowReplyAll,
            status_urgent: reactData.newUrgentMessage,
            status_with_attachment: Boolean(reactData.attachments_to_send && (reactData.attachments_to_send.length > 0)),
            partner_id: new Set(PostOfficeRec.Item.recipient_key),
            recipients: reactData.newMessageRecipients.map((r, x) => {
              return {
                recipient_id: r.person_id || r.group_id || reactData.preferred_recipients[r.rIndex].personList[0],
                recipient_name: r.person_name || r.group_name || reactData.preferred_recipients[r.rIndex].objText,
                is_group: !!r.group_id,
                wasHeld: false,
                status_held: false,
                status_blocked: false,
                status_redirected: false,
                status_with_rules: false,
                status_not_og: false,
                heldUntil: 0,
                methods: {
                  'in Process': {
                    last_update_time: nowTime,
                    result: 'Recently sent',
                    composite_key: `T:${reactData.newMessageThread}~M:001~D:${x}`
                  }
                }
              };
            }),
            other_recipients: [],   // these are IDs of people who - on an inbound message to me - also received the same message
            other_recipientNames: [],   // these are NamesIDs of people who - on an inbound message to me - also received the same message
            is_public: reactData.is_public
          }
        ]
      };
      reactData.sorted_threads.unshift(reactData.newMessageThread);
      const recipientMessageText = `${listFromArray(((reactData.newMessageRecipients.length > 0)
        ? reactData.newMessageRecipients
        : reactData.selections)
        .map(r => (r.person_name || r.group_name || reactData.preferred_recipients[r.rIndex].objText)),
        { max: { length: 4, words: 'recipients' } })}`;
      updateReactData({
        newMessageMode: false,
        threads: reactData.threads,
        sorted_threads: reactData.sorted_threads,
        selections: [],    // wip selections from quick search
        newMessageSubject: '',
        newMessageRecipients: [],
        newUrgentMessage: false,
        replyToList: [],
        newMessageText: '',
        newMessageThread: false,
        newMessageVMAlternative: false,
        newMessageVMAltText: '',
        attachments_to_send: [],
        is_public: false,
        is_reply: false,
        alert: {
          severity: 'success',
          title: 'Your Message',
          message: `Your message is on the way to ${recipientMessageText}`
        }
      }, true);
      // Re-refresh after Lambda delivery latency (~30s for processing)
      setTimeout(() => { if (isMountedRef.current) { refreshMessages(); } }, 30 * 1000);
    }
    else {
      updateReactData({
        alert: {
          severity: 'error',
          title: 'Your Message',
          message: `There was a problem sending your message`,
        }
      }, true);
    }
    return goodPost;
  }

  function handleResize() {
    updateReactData({
      window_width: window.window.innerWidth,
      isSmall: (window.window.innerWidth < 800),
      isTiny: (window.window.innerWidth < 500),
    }, true);
  }

  const oneDay = 24 * 60 * 60 * 1000;

  /**
   * Fetch all messages for `person_id` across the given week boundaries in parallel.
   * Each entry in `weekBoundaries` is { start: ms, end: ms }.
   * All per-week DB queries are fired simultaneously; results are merged and
   * processed together so processDeliveryRecs is called at most twice (in / out).
   */
  async function allMessagesByWeeks(person_id, weekBoundaries) {
    if (!weekBoundaries || weekBoundaries.length === 0) { return; }

    // --- INBOUND (deliver_to-index, parallel per week) ---
    if (!reactData.inOut_filter || reactData.inOut_filter === 'in') {
      const inboundPageArrays = await Promise.all(
        weekBoundaries.map(({ start, end }) =>
          queryAllPages({
            KeyConditionExpression: 'deliver_to = :p AND created_time between :s and :e',
            ExpressionAttributeValues: {
              ':p': person_id,
              ':s': start.toString(),
              ':e': end.toString(),
            },
            TableName: 'TheseusMessages',
            IndexName: 'deliver_to-index',
            ScanIndexForward: false,
          })
        )
      );
      const allInRecs = inboundPageArrays.flat();
      const publicThreadIds = new Set(
        allInRecs.filter(r => r.is_public).map(r => r.thread_id)
      );

      // Fetch supplemental public-thread records in parallel
      const supplementalArrays = await Promise.all(
        [...publicThreadIds].map(threadId =>
          queryAllPages({
            KeyConditionExpression: 'thread_id = :k',
            ExpressionAttributeValues: { ':k': threadId },
            TableName: 'TheseusMessages',
          }).catch(error => {
            cl(`Error reading thread ${threadId}: ${error}`);
            return [];
          })
        )
      );
      const supplementalRecs = supplementalArrays.flat().filter(rec => {
        const alreadyHave = allInRecs.some(existing => existing.composite_key === rec.composite_key);
        return !alreadyHave && rec.deliver_to !== person_id && rec.record_type === 'delivery';
      });

      const finalInRecs = allInRecs.concat(supplementalRecs);
      if (finalInRecs.length > 0) {
        await processDeliveryRecs(finalInRecs, '', person_id);
      }
    }

    // --- OUTBOUND (sent_from-index, parallel per week) ---
    if (!reactData.inOut_filter || reactData.inOut_filter === 'out') {
      const outboundPageArrays = await Promise.all(
        weekBoundaries.map(({ start, end }) =>
          queryAllPages({
            KeyConditionExpression: 'sent_from = :p AND created_time between :s and :e',
            FilterExpression: 'record_type = :t',
            ExpressionAttributeValues: {
              ':p': person_id,
              ':s': start.toString(),
              ':e': end.toString(),
              ':t': 'message',
            },
            TableName: 'TheseusMessages',
            IndexName: 'sent_from-index',
            ScanIndexForward: false,
          })
        )
      );
      const allOutRecs = outboundPageArrays.flat();
      if (allOutRecs.length > 0) {
        await processDeliveryRecs(allOutRecs, '', person_id);
      }
    }
  }

  async function getSenderNames(senderList) {
    let inputList = [senderList].flat();
    if (inputList.includes('*all')) {
      return reactData.accessList;
    }
    else {
      let memberObj = await getMemberList(inputList, pClient, options = {});
      return memberObj.peopleList;
    }
  }

  async function heldMessages() {
    // Get all messages currently in hold
    let actionRecs;
    let queryObj = {
      KeyConditionExpression: 'client_id = :c',
      ExpressionAttributeValues: {
        ':c': pClient
      },
      TableName: "MessageActions"
    };
    do {
      actionRecs = await dbClient
        .query(queryObj)
        .promise()
        .catch(error => handleDbError(error, 'held Messages'));
      if (actionRecs && actionRecs.LastEvaluatedKey) {
        queryObj.ExclusiveStartKey = actionRecs.LastEvaluatedKey;
      }
      else {
        delete queryObj.ExclusiveStartKey;
      }
      if (recordExists(actionRecs)) {
        // Fetch all held message records in parallel instead of serially
        const mailRecs = (await Promise.all(
          actionRecs.Items.map(heldMsg =>
            dbClient.query({
              KeyConditionExpression: 'composite_key = :k',
              ExpressionAttributeValues: { ':k': heldMsg.content.composite_key },
              TableName: 'TheseusMessages',
              IndexName: 'composite_key-index'
            }).promise()
              .catch(error => {
                cl(`Error reading TheseusMessages for composite key ${heldMsg.content.composite_key}. Error is ${error}`);
                return null;
              })
              .then(result => recordExists(result) ? Object.assign({}, result.Items[0], { actionRec: heldMsg }) : null)
          )
        )).filter(Boolean);
        await processDeliveryRecs(mailRecs, 'held', '*any');
      }
    } while (queryObj.ExclusiveStartKey);
    /*  if (autoFocus && autoFocus.current) {
       autoFocus.current.scrollIntoView({
         behavior: 'smooth',
         block: 'start',
       });
     }
     */
  }

  async function processDeliveryRecs(deliveryRecs, inOut, my_id) {
    // Cache parent message record lookups: same T:xxx~M:yyy key is shared by all D: delivery records
    const messageCache = {};
    let totalProcessed = 0;
    let totalCount = deliveryRecs.length;
    for (let this_deliveryRec of deliveryRecs) {
      totalProcessed++;
      //    if (this_deliveryRec.sent_from === this_deliveryRec.deliver_to) {    // a message to myself?  ignore...
      //      continue;
      //    }
      if (inOut !== 'held') {
        inOut = ((this_deliveryRec.sent_from === my_id) ? 'out' : 'in');
      }
      // threads is {[<thread_id>]: {last_update: <>, delete_flag: <t/f>, messages: []}}, {[<thread_id>]: {}}...]
      // threads[n].messages is [{message_text: <>, last_update: <>, attachments: [], sent_time: <>, author_id: <>, author_name: <>, author_image: <>, inOut: <in/out> ,recipients: []}, {}...]
      // threads[n].messages[m].recipients is [{recipient_id: <>, recipient_name: <>, wasHeld: <t/f>, methods: {}}, {}...] 
      // YOU ARE HERE -> threads[n].messages[m].recipients[o].methods is {[method]: {last_update_time: <>, result: <>}}, {[method]: {}}...]
      if (!(this_deliveryRec.thread_id in reactData.threads)) {  // does this thread exist yet?
        reactData.threads[this_deliveryRec.thread_id] = {
          last_update: this_deliveryRec.created_time || 0,
          delete_flag: false,
          is_public: this_deliveryRec.is_public ?? false,
          messages: []
        };
      }
      if (!state.patient.hasOwnProperty('preferred_language')) {
        state.patient.preferred_language = 'en';
      }
      if (this_deliveryRec.content.current.hasOwnProperty(state.patient.preferred_language)) {
        let this_lang_content = Array.isArray(state.patient.preferred_language) ? state.patient.preferred_language[0] : state.patient.preferred_language;
        this_deliveryRec.message_text = this_deliveryRec.content.current[this_lang_content];
      }
      else if (this_deliveryRec.content.current.hasOwnProperty('original')) {
        this_deliveryRec.message_text = this_deliveryRec.content.current.original;
      }
      else if (this_deliveryRec.content.current.hasOwnProperty('en')) {
        this_deliveryRec.message_text = this_deliveryRec.content.current['en'];
      }

      else if (this_deliveryRec.content.current.hasOwnProperty('EN-US')) {
        this_deliveryRec.message_text = this_deliveryRec.content.current['EN-US'];
      }
      else {
        this_deliveryRec.message_text = {
          text: '(Message content unavailable)',
          html: '(Message content unavailable)',
          subject: '(Message content unavailable)',
        };
      }
      let message_number = -1;
      let message_added = false;
      if (reactData.threads[this_deliveryRec.thread_id].messages.length > 0) {
        message_number = reactData.threads[this_deliveryRec.thread_id].messages.findIndex(this_message => {
          return ((this_message.author_id === this_deliveryRec.author.author_id) && (this_message.message_text.slice(0, 20) === this_deliveryRec.message_text.text.slice(0, 20)));
        });
      };
      if (message_number === -1) {
        // convert inline link to an attachment by extracting all text after (and including http:)
        let hLink = extract(this_deliveryRec.message_text.text, 'http', ' ', {
          fuzzyRight: true,  // allow end-of-string as a right delimeter 
          includeLeft: true,  // return the left delimeter
        });
        if (hLink) {
          if (!this_deliveryRec.content.current.attachments) {
            this_deliveryRec.content.current.attachments = [hLink];
          }
          else {
            this_deliveryRec.content.current.attachments.push(hLink);
          }
          this_deliveryRec.message_text.text = this_deliveryRec.message_text.text.replace(hLink, 'the attachment');
        }
        if (this_deliveryRec.author.author_name === 'AVA notifications') {
          let sRec = await getPerson(this_deliveryRec.author.author_id);
          if (sRec && sRec.name) {
            this_deliveryRec.author.author_name = (`${sRec.name.first} ${sRec.name.last}`).trim();
          }
        }
        if (!reactData.imageTable.hasOwnProperty(this_deliveryRec.author.author_id)) {
          reactData.imageTable[this_deliveryRec.author.author_id] = await getImage(this_deliveryRec.author.author_id);
        }
        reactData.threads[this_deliveryRec.thread_id].messages.push({
          message_text: this_deliveryRec.message_text.text,
          html_message_text: this_deliveryRec.message_text.html || this_deliveryRec.message_text.text,
          subject: this_deliveryRec.message_text.subject || this_deliveryRec.subject_line || '(No Subject)',
          last_update: 0,
          attachments: this_deliveryRec.content.current.attachments,
          composite_key: this_deliveryRec.composite_key,
          inOut,
          my_id: ((my_id === '*any') ? this_deliveryRec.author.author_id : my_id),
          sent_time: this_deliveryRec.created_time,
          author_id: this_deliveryRec.author.author_id,
          author_name: this_deliveryRec.author.author_name,
          author_image: reactData.imageTable[this_deliveryRec.author.author_id],
          reply_to: [],
          allowReplyAll: this_deliveryRec.allowReplyAll || false,
          status_urgent: this_deliveryRec.urgency.startsWith('urg'),
          status_with_attachment: Boolean(this_deliveryRec.content.current.attachments && (this_deliveryRec.content.current.attachments.length > 0)),
          status_with_rules: Boolean(this_deliveryRec.recipient_list && this_deliveryRec.recipient_list.rule_used),
          partner_id: new Set(),
          recipients: [],
          actionRec: this_deliveryRec.actionRec || false,
          other_recipients: [],   // these are IDs of people who - on an inbound message to me - also received the same message
          other_recipientNames: [],   // these are NamesIDs of people who - on an inbound message to me - also received the same message
        });
        message_added = true;
        message_number = reactData.threads[this_deliveryRec.thread_id].messages.length - 1;
      }

      if ((this_deliveryRec.record_type === 'message') && (inOut === 'out')) {
        for (let this_recipient_key in this_deliveryRec.recipient_list) {
          let this_recipient = this_deliveryRec.recipient_list[this_recipient_key];
          reactData.threads[this_deliveryRec.thread_id].messages[message_number].partner_id.add(this_recipient.id);
          let recipient_number = reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients.findIndex(r => { return r.recipient_id === this_recipient.id; });
          if (recipient_number === -1) {
            recipient_number = reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients.push({
              recipient_id: this_recipient.id,
              recipient_name: (`${this_recipient.name.first} ${this_recipient.name.last}`).trim(),
              wasHeld: false,
              status_held: false,
              status_blocked: false,
              status_redirected: false,
              status_with_rules: this_recipient.rule_used || false,
              status_not_og: this_recipient.not_original_recipient || false,
              heldUntil: 0,
              methods: {}
            }) - 1;
            if (this_recipient.rule_used) {
              reactData.threads[this_deliveryRec.thread_id].messages[message_number].status_with_rules = true;
            };
            if (this_recipient.not_original_recipient) {
              reactData.threads[this_deliveryRec.thread_id].messages[message_number].status_not_og = true;
            }
          }
          let this_method = standardizeMethod(this_recipient.method);
          if (this_method === 'held') {
            reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].wasHeld = true;
            reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].status_held = true;
            reactData.threads[this_deliveryRec.thread_id].messages[message_number].status_held = true;
            reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].heldUntil = this_deliveryRec.recipient_list.holdUntil;
            if (this_deliveryRec.recipient_list.hold_reason === 'blocked') {
              reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].status_blocked = true;
              reactData.threads[this_deliveryRec.thread_id].messages[message_number].status_blocked = true;
            }
            if (this_deliveryRec.recipient_list.hold_reason === 'replaced') {
              reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].status_redirected = true;
              reactData.threads[this_deliveryRec.thread_id].messages[message_number].status_redirected = true;
            }
          }
          reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].methods[this_method] = {
            last_update_time: this_deliveryRec.created_time,
            result: this_deliveryRec.results.success.includes(this_recipient_key) ? 'Sucessfully sent' :
              (this_deliveryRec.results.duplicate.includes(this_recipient_key) ? 'Not sent - duplicate destination address' : 'Failed to send'),
            composite_key: `${this_deliveryRec.composite_key}~D:${this_recipient_key}`
          };
        }
      }

      let recipient_number = -1;
      if (reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients.length > 0) {
        recipient_number = reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients.findIndex(this_recipient => {
          return ((this_recipient.recipient_id === this_deliveryRec.deliver_to));
        });
      };
      if (recipient_number === -1) {
        if (inOut === 'in') {
          reactData.threads[this_deliveryRec.thread_id].messages[message_number].partner_id.add(this_deliveryRec.author.author_id);

          // For incoming messages, populate other_recipients from the message record
          // composite_key shape: T:<thread_id>~M:<msg_number>~D:<recipient>
          const composite_parts = this_deliveryRec.composite_key.split('~');
          const message_composite_key = `${composite_parts[0]}~${composite_parts[1]}`; // T:<thread_id>~M:<msg_number>

          // Use a .get() (point-read by primary key) instead of a GSI query, and cache
          // to avoid re-fetching the same parent record for every delivery row in a thread
          if (!messageCache[message_composite_key]) {
            messageCache[message_composite_key] = await dbClient
              .get({
                Key: { thread_id: this_deliveryRec.thread_id, composite_key: message_composite_key },
                TableName: 'TheseusMessages',
              })
              .promise()
              .catch(error => {
                cl(`Error reading message record for composite key ${message_composite_key}. Error is ${error}`);
                return null;
              });
          }
          const messageRec = messageCache[message_composite_key];

          if (recordExists(messageRec)) {
            const messageRecord = messageRec.Item;

            // Populate other_recipients from recipient_list
            if (messageRecord.recipient_list) {
              for (let recipient_key in messageRecord.recipient_list) {
                const recipient = messageRecord.recipient_list[recipient_key];
                // Only add if it's not the current user (my_id) and not the sender
                if (recipient.id && recipient.id !== my_id && recipient.id !== this_deliveryRec.author.author_id) {
                  if (!reactData.threads[this_deliveryRec.thread_id].messages[message_number].other_recipients.includes(recipient.id)) {
                    reactData.threads[this_deliveryRec.thread_id].messages[message_number].other_recipients.push(recipient.id);
                    reactData.threads[this_deliveryRec.thread_id].messages[message_number].other_recipientNames.push(`${recipient.name.first} ${recipient.name.last}`.trim());
                  }
                }
              }
            }
          }
          // Add this delivery as a structured recipient entry so the detail dialog can show delivery status.
          // composite_key on this inbound delivery record IS the D: key — enrichMessageRecipients uses it
          // to .get() the delivery record and populate `result` with opened/replied text.
          if (my_id && my_id !== '*any') {
            const deliveryMethod = standardizeMethod(this_deliveryRec.deliver_method || 'AVA');
            reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients.push({
              recipient_id: this_deliveryRec.deliver_to,
              recipient_name: this_deliveryRec.deliver_to === my_id
                ? (reactData.myName || this_deliveryRec.deliver_to)
                : this_deliveryRec.deliver_to,
              wasHeld: false,
              methods: {
                [deliveryMethod]: {
                  composite_key: this_deliveryRec.composite_key,
                  result: '',  // enriched at dialog-open time via enrichMessageRecipients
                }
              }
            });
          }
        }
        else if (this_deliveryRec.record_type === 'delivery') {
          reactData.threads[this_deliveryRec.thread_id].messages[message_number].partner_id.add(this_deliveryRec.deliver_to);
        }
      }
      else if (inOut === 'in' && recipient_number >= 0) {
        // Recipient entry already exists — this is a second (or third) delivery channel
        // for the same person (e.g. email already added, now SMS arrives).
        // Merge the new method into the existing recipient entry.
        const extraMethod = standardizeMethod(this_deliveryRec.deliver_method || 'AVA');
        if (!reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].methods[extraMethod]) {
          reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].methods[extraMethod] = {
            composite_key: this_deliveryRec.composite_key,
            result: '',  // enriched at dialog-open time via enrichMessageRecipients
          };
        }
      }
      if (reactData.threads[this_deliveryRec.thread_id].delete_flag && (reactData.threads[this_deliveryRec.thread_id].delete_time < this_deliveryRec.created_time)) {
        reactData.threads[this_deliveryRec.thread_id].delete_flag = false;
      }
      if ((this_deliveryRec.delete_flag) && this_deliveryRec.deleted_by && (this_deliveryRec.deleted_by.includes(state.session.user_id))) {
        reactData.threads[this_deliveryRec.thread_id].delete_flag = true;
        reactData.threads[this_deliveryRec.thread_id].delete_time = this_deliveryRec.delete_time || 9999999999999;
      }
      // re-sort messages in this thread (if necessary)
      if (message_added && (reactData.threads[this_deliveryRec.thread_id].messages.length > 1)) {
        reactData.threads[this_deliveryRec.thread_id].messages.sort((a, b) => {
          return ((a.sent_time < b.sent_time) ? -1 : 1);
        });
      }
      // every 50 records, send info back
      if ((totalProcessed % 50) === 0) {
        let sorted_threads = Object.keys(reactData.threads).sort((a, b) => {
          return ((reactData.threads[a].last_update > reactData.threads[b].last_update) ? -1 : 1);
        });
        updateReactData({
          statusMessage: `Processing ${inOut} - ${totalProcessed} of ${totalCount}`,
          threads: reactData.threads,
          sorted_threads
        }, true);
      }
    }
    if (totalProcessed > 0) {
      let sorted_threads = Object.keys(reactData.threads).sort((a, b) => {
        return ((reactData.threads[a].last_update > reactData.threads[b].last_update) ? -1 : 1);
      });
      updateReactData({
        threads: reactData.threads,
        sorted_threads
      }, true);
    }
  }

  function buildDialogRecipients(recipients) {
    return (recipients || []).map((r) => {
      const methodEntries = Object.entries(r.methods || {});
      const resultLines = methodEntries.map(([method, data]) => {
        const suffix = data.result ? ` — ${data.result}` : '';
        return method === 'Alert' ? `Alert sent${suffix}` : `via ${method}${suffix}`;
      });
      const allResults = methodEntries.map(([, d]) => String(d.result || '').toLowerCase());
      const flagLabels = [];
      if (allResults.some(res => res.startsWith('opened'))) {
        flagLabels.push('Opened');
      }
      if (allResults.some(res => res.startsWith('replied') || res.startsWith('call responded'))) {
        flagLabels.push('Responded');
      }
      if (allResults.some(res => res.includes('duplicate'))) { flagLabels.push('Duplicate'); }
      if (allResults.some(res => res.startsWith('delivery confirmed by') || res.includes('carrier ok'))) {
        flagLabels.push('Carrier OK');
      }
      if (allResults.some(res => res.includes('machine') || res.includes('beep'))) { flagLabels.push('Machine'); }
      if (r.wasHeld) { flagLabels.push('Held'); }
      if (r.status_blocked) { flagLabels.push('Blocked'); }
      if (r.status_redirected) { flagLabels.push('Redirected'); }
      return { personId: r.recipient_id, personName: r.recipient_name, resultLines, flagLabels };
    });
  }

  async function enrichMessageRecipients(message, thread_id) {
    for (let this_recipient of (message.recipients || [])) {
      for (let this_method in (this_recipient.methods || {})) {
        const composite_key = this_recipient.methods[this_method].composite_key;
        if (!composite_key) { continue; }
        let this_status = await dbClient.get({
          Key: { thread_id, composite_key },
          TableName: 'TheseusMessages',
        }).promise().catch(() => null);
        if (recordExists(this_status)) {
          this_recipient.methods[this_method].result = makeResultText({
            resultArray: this_status.Item.results,
            currentValue: this_recipient.methods[this_method].result
          });
        }
      }
    }
  }

  function makeRecipientLines(this_recipient) {
    let response = [];
    let this_line = `${this_recipient.recipient_name}`;
    if (Object.keys(this_recipient.methods).length > 1) {
      response.push(this_line);
      this_line = '';
    }
    for (let this_method in this_recipient.methods) {
      let result;
      switch (this_recipient.methods[this_method].result) {
        case 'submitted': {
          result = 'Sent';
          break;
        }
        case 'userDisconnect': {
          result = 'Call answered; user disconnected';
          break;
        }
        case 'callComplete': {
          result = 'Call completed';
          break;
        }
        case 'delivered': {
          result = 'Delivery confirmed';
          break;
        }
        case 'open': {
          result = 'Message opened';
          break;
        }
        case 'duplicate': {
          result = `Duplicated another person's address`;
          break;
        }
        default: {
          result = this_recipient.methods[this_method].result;
        }
      }
      this_line += ` ${this_recipient.wasHeld ? 'held, then ' : ''}via ${this_method} - ${result}`;
      response.push(this_line);
      this_line = '';
    }
    return response;
  }

  function makeResultText(request) {
    /*
     resultArray: this_status.results,
     currentValue: this_recipient.methods[this_method].result
    */
    let resultText = request.currentValue;
    let alreadyOpened = false;
    for (let this_result of request.resultArray) {
      const clientTZ = state.session.client_timezone;
      if (this_result.result.toLowerCase().startsWith('reply')) {
        return `Replied to ${makeDate(this_result.posted_time, { timeZone: clientTZ }).oaDate}`;
      }
      else if (this_result.result.toLowerCase() === 'response') {
        return `Call responded to with "${this_result.response}" ${makeDate(this_result.posted_time, { timeZone: clientTZ }).oaDate}`;
      }
      else if (!alreadyOpened) {
        if (this_result.result.toLowerCase() === 'open') {
          resultText = `Opened ${makeDate(this_result.posted_time, { timeZone: clientTZ }).oaDate}`;
          alreadyOpened = true;
        }
        else if (this_result.result.toLowerCase().startsWith('deliver')) {
          resultText = `Delivery`;
          if (this_result.info && this_result.info.phoneCarrier) {
            resultText += ` confirmed by ${this_result.info.phoneCarrier}`;
          }
          resultText += ` ${makeDate(this_result.posted_time, { timeZone: clientTZ }).oaDate}`;
        }
        else if ((this_result.result.toLowerCase().includes('no answer')) || (this_result.result.toLowerCase().includes('busy'))) {
          resultText = `No answer ${makeDate(this_result.posted_time, { timeZone: clientTZ }).oaDate}`;
        }
        else if (this_result.result.toLowerCase().includes('answered')) {
          resultText = `${sentenceCase(this_result.result)} ${makeDate(this_result.posted_time, { timeZone: clientTZ }).oaDate}`;
          alreadyOpened = true;
        }
        else {

        }
      }
    }
    return resultText;
  }

  /* Redacted code for makeMethodLine
  function makeMethodLine(this_message) {
    let response = [];
    let wasHeld = false;
    let heldUntil = false;
    for (let this_recipient of this_message.recipients) {
      if (this_recipient.wasHeld) {
        wasHeld = true;
        heldUntil = this_recipient.heldUntil;
      }
      for (let this_method in this_recipient.methods) {
        if ((this_method !== 'hold') && (this_method !== 'AVA') && (!response.includes(this_method))) {
          response.push(this_method);
        }
      }
    }
    if (response.length === 0) {
      if (wasHeld) {
        return `Holding until ${makeDate(heldUntil).relative}`;
      }
      else {
        return 'AVA';
      }
    }
    else {
      return `${wasHeld ? 'Held, then ' : ''}${listFromArray(response)}`;
    }
  }
  */

  function makeToLine(this_thread, message_index) {
    // Builds a friendly recipient summary, aware of groups vs. individuals.
    // is_group is set on optimistically-added entries (right after send); loaded
    // messages have groups already expanded by PostOffice so all entries are people.
    function formatRecipientList(recipients) {
      if (recipients.length === 0) { return ''; }
      if (recipients.length <= 3) {
        return listFromArray(recipients.map(r => r.recipient_name));
      }
      const groups = recipients.filter(r => r.is_group);
      const people = recipients.filter(r => !r.is_group);
      if (groups.length === recipients.length) {
        // All groups — show up to 2 names then "N more groups"
        const shown = groups.slice(0, 2).map(r => r.recipient_name);
        const remaining = groups.length - 2;
        return `${listFromArray(shown)} and ${remaining} more group${remaining === 1 ? '' : 's'}`;
      }
      if (people.length === recipients.length) {
        // All people — show first 3 names then "N more people"
        const shown = people.slice(0, 3).map(r => r.recipient_name);
        const remaining = people.length - 3;
        return `${listFromArray(shown)} and ${remaining} more person${remaining === 1 ? '' : 's'}`;
      }
      // Mixed groups and people
      const groupPart = groups.length === 1
        ? groups[0].recipient_name
        : `${groups.length} groups`;
      const peoplePart = people.length === 1
        ? people[0].recipient_name
        : `${people.length} people`;
      return `${groupPart} and ${peoplePart}`;
    }

    let response;
    let OG_message = message_index === 0;
    if (reactData.threads[this_thread].messages[message_index].inOut === 'out') {
      response = `Me -> `;
      if (reactData.threads[this_thread].is_public && !OG_message) {
        response += 'The Group';
      }
      else {
        response += formatRecipientList(reactData.threads[this_thread].messages[message_index].recipients);
      }
    }
    else if (reactData.threads[this_thread].messages[message_index].inOut === 'held') {
      response = `${reactData.threads[this_thread].messages[message_index].author_name} -> `;
      response += formatRecipientList(reactData.threads[this_thread].messages[message_index].recipients);
    }
    else {
      response = `${reactData.threads[this_thread].messages[message_index].author_name} -> `;
      if (reactData.threads[this_thread].is_public && !OG_message) {
        response += 'The Group';
      }
      else if (reactData.threads[this_thread].messages[message_index].other_recipients.length < 3) {
        response += listFromArray(reactData.threads[this_thread].messages[message_index].other_recipientNames.concat(['Me']));
      }
      else {
        response += `Me and ${reactData.threads[this_thread].messages[message_index].other_recipients.length} other people`;
      }
    }
    if (reactData.threads[this_thread].is_public && OG_message) {
      response += ' (Group Message)';
    }
    return response;
  }

  async function pollRecentMessages() {
    if (!isMountedRef.current || reactData.newMessageMode) { return; }
    const nowTime = new Date().getTime();
    const fiveMinMs = 5 * 60 * 1000;
    await allMessagesByWeeks(pPerson, [{ start: nowTime - fiveMinMs, end: nowTime + oneDay }]);
    updateReactData({ lastReloadTime: new Date() }, true);
    resetRefreshTimer();
  }

  function resetRefreshTimer() {
    if (refreshIntervalRef.current) { clearInterval(refreshIntervalRef.current); }
    refreshIntervalRef.current = setInterval(async () => {
      if (isMountedRef.current) { await pollRecentMessages(); }
    }, 3 * oneMinute);
  }

  async function refreshMessages(overrideStartTime) {
    if (reactData.newMessageMode && options && options.newMessage) {
      updateReactData({
        threads: {},
        sorted_threads: [],
        lastReloadTime: new Date(),
        lastActiveTime: new Date(),
        idleState: false,
        statusMessage: false
      }, true);
      resetRefreshTimer();
      return;
    }

    const effectiveStartTime = (typeof overrideStartTime === 'number') ? overrideStartTime : reactData.start_time;
    const isDateChange = (typeof overrideStartTime === 'number');
    const nowTime = new Date().getTime();
    if (pPerson === '*allHeld') {
      await heldMessages();
    }
    else {
      const oneWeekMs = 7 * oneDay;
      const alreadyLoadedOlderWeeks = !isDateChange && (reactData.loadedWeeksOldest !== null);
      if (alreadyLoadedOlderWeeks) {
        // Prior weeks already loaded — only refresh the current week
        await allMessagesByWeeks(pPerson, [{ start: nowTime - oneWeekMs, end: nowTime + oneDay }]);
      }
      else {
        // Initial load or date change — fetch all weeks back to effectiveStartTime
        const weeksNeeded = effectiveStartTime
          ? Math.max(2, Math.ceil((nowTime + oneDay - effectiveStartTime) / oneWeekMs))
          : 2;
        const allBoundaries = buildWeekBoundaries(nowTime + oneDay, weeksNeeded);
        // Tier 1: most recent week — awaited so user sees messages immediately
        await allMessagesByWeeks(pPerson, [allBoundaries[0]]);
        updateReactData({ loadedWeeksOldest: allBoundaries[0].start }, false);
        // Tier 2+: all prior weeks — fire and forget, only done once
        if (allBoundaries.length > 1) {
          allMessagesByWeeks(pPerson, allBoundaries.slice(1)).then(() => {
            if (isMountedRef.current) {
              updateReactData({ loadedWeeksOldest: allBoundaries[allBoundaries.length - 1].start }, true);
            }
          });
        }
      }
    }

    // If in reply mode, check if replying to a public thread
    const replyModeUpdate = {
      lastReloadTime: new Date(),
      lastActiveTime: new Date(),
      idleState: false,
      statusMessage: false
    };
    if (reactData.newMessageThread && reactData.threads[reactData.newMessageThread]) {
      const threadIsPublic = reactData.threads[reactData.newMessageThread].is_public || false;
      replyModeUpdate.is_public = threadIsPublic;
      replyModeUpdate.newMessage_isPublic = threadIsPublic;
    }
    updateReactData(replyModeUpdate, true);
    resetRefreshTimer();
  }

  async function initialize() {
    // housekeeping — load once-per-session data, then fetch messages
    updateReactData({
      myImage: await getImage(pPerson),
      myName: await makeName(pPerson),
      templateList: await getTemplateList()
    }, true);
    start();  // idle timer
    await refreshMessages();
  }

  React.useEffect(() => {
    initialize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pPerson, pClient]);  // eslint-disable-line react-hooks/exhaustive-deps


  function okToShow(this_thread, this_messageIndex) {
    let response = true;
    status_filter_result = false;
    if (reactData.personFilter) {
      response = reactData.threads[this_thread].messages[this_messageIndex].partner_id.has(reactData.personFilter);
    }
    else if (reactData.messageFilter) {
      response = false;
      if (reactData.singleFilterDigit) {
        response = true;
      }
      else if (reactData.threads[this_thread].messages[this_messageIndex].message_text.toLowerCase().includes(reactData.messageFilterLower)) {
        response = true;
      }
      else if (reactData.threads[this_thread].messages[this_messageIndex].subject.toLowerCase().includes(reactData.messageFilterLower)) {
        response = true;
      }
      else if (reactData.threads[this_thread].messages[this_messageIndex].author_name.toLowerCase().includes(reactData.messageFilterLower)) {
        response = true;
      }
      else if (reactData.threads[this_thread].messages[this_messageIndex].recipients.some(r => {
        return r.recipient_name.includes(reactData.messageFilterLower);
      })) {
        response = true;
      }
    }
    else if (reactData.statusFilter) {
      if (reactData.threads[this_thread].messages[this_messageIndex].hasOwnProperty(`status_${reactData.statusFilter}`)) {
        response = reactData.threads[this_thread].messages[this_messageIndex][`status_${reactData.statusFilter}`];
      }
      else {
        response = (reactData.threads[this_thread].messages[this_messageIndex].recipients.some(r => {
          if (r.hasOwnProperty(`status_${reactData.statusFilter}`)) {
            return r[`status_${reactData.statusFilter}`];
          }
          else {
            return false;
          }
        }));
      }
      status_filter_result = response;
    }
    else if (reactData.threads[this_thread].delete_flag) {
      response = reactData.showDeleted;
    }
    return response;
  }

  // ******************

  return (
    <Dialog
      open={true || forceRedisplay}
      onScroll={onScroll}
      p={2}
      fullScreen
    >
      {(reactData.threads || reactData.newMessageMode) &&
        <React.Fragment>
          <Box display='flex'
            key={'header_row'}
            flexDirection='row' justifyContent='space-between' alignItems='center'
            height={'135px'}
          >
            <Box display='flex'
              key={'title_and_filter'}
              flexDirection='column'
              marginRight={'16px'}
              style={{ flexGrow: 1 }}
              justifyContent={'center'}
            >
              <DialogContentText
                className={classes.title}
                id='scroll-dialog-title'
              >
                {`${reactData.myName ? (reactData.myName + "'" + (reactData.myName.endsWith('s') ? '' : 's')) : 'My'} Messages`}
              </DialogContentText>
              <Box display='flex' flexDirection='row' alignItems='center' style={{ marginTop: '-8px', marginLeft: '16px' }}>
                <Typography variant='caption' color='textSecondary' style={{ fontSize: '0.75rem' }}>
                  {`Message activity since ${reactData.loadedWeeksOldest
                    ? makeDate(reactData.loadedWeeksOldest).dateOnly
                    : reactData.start_time
                      ? makeDate(reactData.start_time).dateOnly
                      : '2 weeks ago'}`}
                </Typography>
                <Button
                  size='small'
                  style={{ minWidth: 'auto', padding: '0 4px', fontSize: '0.7rem', textTransform: 'none', marginLeft: '4px' }}
                  onClick={() => updateReactData({ showSinceDatePicker: true }, true)}
                >
                  {'change'}
                </Button>
              </Box>
              <TextField
                id='List Filter'
                value={reactData.messageFilter || ''}
                onChange={handleChangeMessageFilter}
                className={classes.freeInput}
                label={'Filter/Search'}
                variant={'standard'}
                autoComplete='off'
              />
            </Box>
            <Box
              key={'my_image_box'}
              style={{ marginRight: '16px' }}
              onClick={() => {
                updateReactData({
                  viewPeopleMaintenance: true
                }, true);
              }}
            >
              <img
                key={'my_image'}
                className={classes.myImageArea}
                alt={''}
                onError={onImageError}
                src={reactData.myImage}
              />
              <SettingsIcon style={{ marginLeft: '-32px' }} />
            </Box >
          </Box>
          {reactData.newMessageMode &&
            <Paper component={Box} className={classes.newMessagePage} overflow='auto' square>
              <Box key={'newMessage_frag'}
                marginLeft={'16px'}
                marginRight={'16px'}
                borderRadius={'30px'}
                padding={'16px'}
                border={2}
                borderColor={(reactData.newUrgentMessage || reactData.alternateSenderName) ? 'red' : 'black'}
              >
                <Box display='flex' flexDirection='column'>
                  <Box display='flex'
                    key={'newMessage_r2'}
                    flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'>
                    <Box display='flex'
                      key={'newMessage_c2b'}
                      flexDirection='column'
                      style={{
                        flexGrow: 1
                      }}
                    >
                      <Box display='flex'
                        key={'newMessage_r5'}
                        flexDirection='row'
                        style={{
                          flexGrow: 1
                        }}
                      >
                        <Box display='flex'
                          key={'newMessage_c3'}
                          flexDirection='column'
                          paddingTop='8px'
                          style={{ flexGrow: 1 }}
                        >
                          <Box display='flex'
                            key={'newMessage_topblock'}
                            flexDirection='row'
                            alignContent={'center'}
                            justifyContent={'space-between'}
                          >
                            <Box display='flex'
                              key={'newMessage_midblock'}
                              flexDirection='column'
                              alignContent={'start'}
                              justifyContent={'center'}
                            >
                              <Box display='flex'
                                key={'newMessage_r6names'}
                                flexDirection='row'
                                flexWrap={'wrap'}
                                alignContent={'center'}
                                onClick={() => {
                                  updateReactData({
                                    newMessageRecipients: [],
                                    showQuickSearch: true,
                                    selections: reactData.newMessageRecipients
                                  }, true);
                                }}
                              >
                                <Typography
                                  style={AVATextStyle({ size: 1, bold: true })}
                                  key={`showNames__${(reactData.newMessageRecipients?.length || 0) + (reactData.selections?.length || 0)}`}
                                >
                                  {(() => {
                                    const sender = reactData.alternateSenderName || 'Me';

                                    // If public message, show "Me -> The Group"
                                    if (reactData.is_public && reactData.newMessage_isPublic && reactData.is_reply) {
                                      return `${sender} -> The Group`;
                                    }

                                    // If more than 4 recipients, show group-aware count
                                    if (reactData.newMessageRecipients.length > 4) {
                                      const groupCount = reactData.newMessageRecipients.filter(r => r.group_id).length;
                                      const peopleCount = reactData.newMessageRecipients.filter(r => r.person_id || r.hasOwnProperty('rIndex')).length;
                                      let countLabel;
                                      if (groupCount > 0 && peopleCount === 0) {
                                        countLabel = `${groupCount} group${groupCount === 1 ? '' : 's'}`;
                                      } else if (peopleCount > 0 && groupCount === 0) {
                                        countLabel = `${peopleCount} people`;
                                      } else {
                                        countLabel = `${groupCount} group${groupCount === 1 ? '' : 's'} and ${peopleCount} people`;
                                      }
                                      return `${sender} -> ${countLabel}`;
                                    }

                                    // If there are recipients to display
                                    const recipientsExist = (reactData.newMessageRecipients.length > 0) || ((reactData.selections.length > 0) && !reactData.showReplyToSearch);
                                    if (recipientsExist) {
                                      const recipients = reactData.newMessageRecipients.length > 0
                                        ? reactData.newMessageRecipients
                                        : reactData.selections;
                                      const groupCount = recipients.filter(r => r.group_id).length;
                                      const overflowWord = groupCount === recipients.length ? 'groups' : 'people';
                                      const recipientNames = listFromArray(
                                        recipients.map(r => (r.person_name || r.group_name || reactData.preferred_recipients?.[r.rIndex]?.objText)),
                                        { max: { length: 4, words: overflowWord } }
                                      );
                                      return `${sender} -> ${recipientNames}`;
                                    }

                                    // Default: just show sender
                                    return `${sender} ->`;
                                  })()}
                                </Typography>
                              </Box>
                            </Box>
                            <Box display='flex'
                              key={'newMessage_rightblock'}
                              flexDirection='column'
                              alignItems={'flex-end'}
                              justifyContent={'center'}
                            >
                              {/* Show public/private checkbox when multiple recipients, otherwise show Add Reply To */}
                              {((reactData.selectedPeople_count > 1) || (reactData.newMessage_isPublic)) &&
                                <Typography
                                  style={AVATextStyle({ size: 1, bold: reactData.is_public, color: reactData.is_public ? 'red' : null, cursor: 'pointer' })}
                                  onClick={() => {
                                    updateReactData({
                                      is_public: !reactData.is_public
                                    }, true);
                                  }}
                                >
                                  {`${reactData.is_reply ? 'Reply to the Group' : 'Replies Visible to All'} ${(reactData.is_public) ? '☑' : '☐'}`}
                                </Typography>
                              }
                            </Box>
                          </Box>

                          {!reactData.is_reply &&
                            <Box display='flex' flexDirection='row' alignItems='center' gap={1} marginBottom={2}>
                              <Typography
                                style={AVATextStyle({ size: 0.82, opacity: 0.6, margin: { top: 1.5, right: 0.5, left: 0.13 } })}
                              >
                                {'Subject'}
                              </Typography>
                              <TextField
                                id='Message_subject_new'
                                autoComplete='off'
                                style={AVATextStyle({ size: 1.2, width: '90%', bold: true, margin: { right: 1.5 } })}
                                onChange={async (event) => {
                                  updateReactData({
                                    newMessageSubject: event.target.value
                                  }, true);
                                }}
                                defaultValue={reactData.newMessageSubject}
                              />
                            </Box>
                          }
                        </Box>
                        {reactData.attachments_to_send && reactData.attachments_to_send.map((aLine, aIndex) => (
                          <a
                            href={aLine}
                            key={`attach-${aIndex}-href`}
                            target='_blank'
                            rel='noopener noreferrer'
                            style={{ color: 'green', textDecoration: 'underline' }}>
                            <AttachmentIcon />
                          </a>
                        ))}
                      </Box>
                      {!reactData.html_message &&
                        <>
                          <Typography
                            style={AVATextStyle({ size: 0.82, opacity: 0.6, margin: { left: 0.1, bottom: 0.3, top: (reactData.is_reply ? 1.5 : 0) } })}
                          >
                            {'Message Text'}
                          </Typography>
                          <TextField
                            id='MessageText_new'
                            multiline
                            variant={'outlined'}
                            autoComplete='off'
                            style={AVATextStyle({ size: 1.2, bold: true, margin: { bottom: 1, right: 1.5 } })}
                            onBlur={async (event) => {
                              let reactUpdObj = {
                                newMessageText: event.target.value
                              };
                              updateReactData(reactUpdObj, true);
                            }}
                            defaultValue={reactData.newMessageText}
                          />
                        </>
                      }
                      {reactData.html_message &&
                        <Box display='flex'
                          key={'html_box'}
                          flexDirection='column'
                          padding='16px'
                          marginLeft='-18px'
                        >
                          <Typography
                            style={AVATextStyle({ size: 0.82, opacity: 0.6, margin: { left: 0.1, bottom: 0.3 } })}
                          >
                            {'Formatted Message Text'}
                          </Typography>
                          <Box style={{ marginBottom: '8px', position: 'relative' }}>
                            <Button
                              className={AVAClass.AVAButton}
                              size="small"
                              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                              onClick={() => {
                                if (editorRef.current) {
                                  const quill = editorRef.current.getEditor();
                                  const cursorPosition = quill.getSelection()?.index || 0;
                                  updateReactData({
                                    showVariableMenu: !reactData.showVariableMenu,
                                    variableMenuAnchor: cursorPosition
                                  }, true);
                                }
                              }}
                            >
                              Insert Variable
                            </Button>
                            {reactData.showVariableMenu && (
                              <Paper
                                style={{
                                  position: 'absolute',
                                  zIndex: 1000,
                                  marginTop: '4px',
                                  padding: '8px',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                                }}
                                onMouseLeave={() => {
                                  updateReactData({ showVariableMenu: false }, true);
                                }}
                              >
                                <Box display='flex' flexDirection='column'>
                                  {(state.session.message_template_variables || []).map((variable, idx) => (
                                    <Button
                                      key={idx}
                                      size="small"
                                      style={{ justifyContent: 'flex-start', textTransform: 'none', padding: '6px 12px' }}
                                      onClick={() => {
                                        if (editorRef.current) {
                                          const quill = editorRef.current.getEditor();
                                          const cursorPosition = reactData.variableMenuAnchor || 0;
                                          const variableText = `<<${variable.value}>>`;
                                          quill.insertText(cursorPosition, variableText);
                                          quill.setSelection(cursorPosition + variableText.length);
                                          setDirty(true);
                                        }
                                        updateReactData({ showVariableMenu: false }, true);
                                      }}
                                    >
                                      {variable.label}
                                    </Button>
                                  ))}
                                </Box>
                              </Paper>
                            )}
                          </Box>
                          <ReactQuill
                            ref={editorRef}
                            theme="snow"
                            value={reactData.newMessageText}
                            onChange={(content, delta, source, editor) => {
                              setDirty(true);
                              updateReactData({
                                newMessageText: content
                              }, false);
                            }}
                            onBlur={() => {
                              HTMLsave();
                            }}
                            style={{ height: '300px', marginBottom: '50px' }}
                            modules={{
                              toolbar: [
                                [{ 'header': [1, 2, 3, false] }],
                                ['bold', 'italic', 'underline', 'strike'],
                                [{ 'color': [] }, { 'background': [] }],
                                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                                [{ 'indent': '-1' }, { 'indent': '+1' }],
                                [{ 'align': [] }],
                                ['link', 'image'],
                                ['clean']
                              ]
                            }}
                            formats={[
                              'header',
                              'bold', 'italic', 'underline', 'strike',
                              'color', 'background',
                              'list', 'bullet',
                              'indent',
                              'align',
                              'link', 'image'
                            ]}
                          />
                        </Box>
                      }
                      {reactData.newMessageVMAlternative &&
                        <TextField
                          id='MessageText_altVM'
                          multiline
                          autoComplete='off'
                          style={AVATextStyle({ size: 1.2, bold: true, margin: { right: 1.5 } })}
                          onBlur={async (event) => {
                            updateReactData({
                              newMessageVMAltText: event.target.value
                            }, true);
                          }}
                          defaultValue={reactData.newMessageVMAltText}
                          helperText={'Alternative Message to use leaving a Voice Mail'}
                        />
                      }
                      <Box display='flex'
                        key={'newMessage_rNewBottom'}
                        flexDirection='row'
                        marginRight='32px'
                      >
                        <Box display='flex'
                          key={'newMessage_c_reply'}
                          flexDirection='column'
                          style={{ marginLeft: '-10px' }}
                          alignItems={'flex-end'}
                          justifyContent={'flex-start'}
                        >
                          <Button
                            className={AVAClass.AVAButton}
                            style={((reactData.newMessageText.length > 0) && (reactData.newMessageRecipients.length > 0))
                              ? { marginTop: '24px', backgroundColor: 'green', color: 'white' }
                              : { marginTop: '24px', backgroundColor: 'white', color: 'green' }
                            }
                            size='small'
                            //                       disabled={(reactData.newMessageText.length === 0) || (reactData.newMessageRecipients.length === 0)}
                            onClick={async () => {
                              if (reactData.newMessageText.length === 0) {
                                updateReactData({
                                  warning: true,
                                  alert: {
                                    severity: 'warning',
                                    title: `Need Message Text`,
                                    message: `There isn't anything to send!`,
                                  }
                                }, true);
                              }
                              else if (reactData.newMessageRecipients.length === 0) {
                                updateReactData({
                                  warning: true,
                                  alert: {
                                    severity: 'warning',
                                    title: `Need Recipient(s)`,
                                    message: `You didn't choose anyone to send this to!`,
                                  }
                                }, true);
                              }
                              else if (!reactData.warning) {
                                const sendWasSuccessful = await sendMessage();
                                if (sendWasSuccessful) {
                                  if (options && options.newMessage) {
                                    onReset();
                                  }
                                  else {
                                    await refreshMessages();
                                  }
                                }
                              }
                            }}
                            startIcon={<SendIcon className={classes.tightRight} size="small" />}
                          >
                            {'Send'}
                          </Button>
                        </Box>
                        <Box display='flex'
                          key={'newMessage_c_reply_text'}
                          flexDirection='column'
                          style={{ flexGrow: 1, marginRight: '-30px' }}
                          alignItems={'flex-end'}
                        >
                          {reactData.administrative_account && reactData.allowChangeSender &&
                            <Typography
                              style={AVATextStyle({ size: 1 })}
                              onClick={async () => {
                                let selections = [];
                                if (reactData.newMessageSendFrom) {
                                  selections = [{
                                    person_id: reactData.newMessageSendFrom,
                                    person_name: reactData.alternateSenderName
                                  }];
                                }
                                updateReactData({
                                  selections,
                                  selectedPeople_list: [],
                                  showSelectSender: true,
                                  changeSenderNames: await getSenderNames(reactData.allowChangeSender)
                                }, true);
                              }}
                            >
                              {'Change Sender'}
                            </Typography>
                          }
                          <Typography
                            style={AVATextStyle({ size: 1 })}
                            onClick={() => {
                              updateReactData({
                                getAttachment: true
                              }, true);
                            }}
                          >
                            {'Add Attachment(s)'}
                          </Typography>
                          {(reactData.attachments_to_send.length > 0) &&
                            <Typography
                              style={AVATextStyle({ size: 1 })}
                              onClick={() => {
                                updateReactData({
                                  attachments_to_send: []
                                }, true);
                              }}
                            >
                              {`Remove ${(reactData.attachments_to_send.length > 2)
                                ? 'all attachments'
                                : ((reactData.attachments_to_send.length === 2)
                                  ? 'both attachments'
                                  : 'the attachment'
                                )}`}
                            </Typography>
                          }
                          {reactData.administrative_account &&
                            <Typography
                              style={AVATextStyle({ size: 1 })}
                              onClick={() => {
                                updateReactData({
                                  newUrgentMessage: !reactData.newUrgentMessage
                                }, true);
                              }}
                            >
                              {(reactData.newUrgentMessage) ? 'Mark as not urgent' : 'Mark as urgent'}
                            </Typography>
                          }
                          {reactData.administrative_account && reactData.showVMAlt &&
                            <Typography
                              style={AVATextStyle({ size: 1 })}
                              onClick={() => {
                                updateReactData({
                                  newMessageVMAlternative: !reactData.newMessageVMAlternative
                                }, true);
                              }}
                            >
                              {(reactData.newMessageVMAlternative) ? 'Remove VM Alt message' : 'Add VM Alt message'}
                            </Typography>
                          }
                          <Typography
                            style={AVATextStyle({ size: 1 })}
                            onClick={() => {
                              updateReactData({
                                html_message: !reactData.html_message
                              }, true);
                            }}
                          >
                            {(reactData.html_message) ? 'Use Plain Text' : 'Use Rich Text Editor'}
                          </Typography>
                          {reactData.templateList && (reactData.templateList.length > 0) &&
                            reactData.administrative_account &&
                            <Typography
                              style={AVATextStyle({ size: 1 })}
                              onClick={async () => {
                                updateReactData({
                                  showSelectTemplate: true,
                                }, true);
                              }}
                            >
                              {'Use a Template'}
                            </Typography>
                          }
                          <Typography
                            style={AVATextStyle({ size: 1 })}
                            onClick={() => {
                              if (options && options.newMessage) {
                                onReset();
                                return;
                              }
                              updateReactData({
                                newMessageRecipients: [],
                                selectedPeople_count: 0,
                                newMessageSubject: '',
                                newMessageText: '',
                                attachments_to_send: [],
                                selectedPeople_list: [],
                                replyToList: [],
                                newMessageMode: false,
                                is_reply: false,
                                is_public: false,
                              }, true);
                            }}
                          >
                            {'Discard Message'}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Paper>
          }
          {(Object.keys(reactData.threads).length > 0) &&
            <Paper component={Box} className={classes.page} overflow='auto' square>
              {reactData.sorted_threads.map((this_thread, thread_index) => (
                reactData.threads[this_thread].messages.map((this_message, message_index) => {
                  const isFirstMessage = message_index === 0;
                  return (
                    (okToShow(this_thread, message_index) &&
                      <Box key={`${thread_index}_frag_${message_index}_${reactData.personFilter || ''}`}
                        borderTop={((thread_index !== 0) && isFirstMessage) ? 2 : 0}
                        borderColor={'black'}
                        onContextMenu={async (e) => {
                          e.preventDefault();
                        }}
                      >
                        <Box display='flex' flexDirection='column'
                          key={`${thread_index}_col_${message_index}`}>
                          <Box
                            display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                            key={`${thread_index}_r_${message_index}`}
                            className={classes.listItem}
                          >
                            <Box display='flex'
                              key={`${thread_index}_r2_${message_index}`}
                              style={{ maxWidth: '100%', boxSizing: 'border-box', minWidth: 0 }}
                              flexDirection='row'
                              flexGrow={1}
                              justifyContent='space-between' alignItems='center'
                            >
                              <Box display='flex'
                                key={`${thread_index}_c_${message_index}`}
                                flexDirection='column'
                                style={{ width: '100%', minWidth: 0 }}
                                justifyContent={'center'}
                              >
                                <Box display='flex'
                                  key={`${thread_index}_r3_${message_index}`}
                                  flexDirection='row'
                                >
                                  <Box display='flex'
                                    key={`${thread_index}_c2b_${message_index}`}
                                    flexDirection='column'
                                    style={{
                                      flexGrow: 1,
                                      minWidth: 0
                                    }}
                                  >
                                    <Box display='flex'
                                      key={`${thread_index}_r5_${message_index}`}
                                      flexDirection='row'
                                      alignItems={'center'}
                                      style={{
                                        flexGrow: 1,
                                        minWidth: 0,
                                        marginTop: '8px',
                                      }}
                                    >
                                      {/* Author Image */}
                                      {isFirstMessage && !hideMessageImages &&
                                        <Box display='flex'
                                          key={`${thread_index}_r3a_${message_index}`}
                                          flexDirection='row'
                                          minWidth={'65px'}
                                        >
                                          <Box
                                            key={`${thread_index}_ibox_${message_index}`}
                                            style={{ alignSelf: 'anchor-center' }}
                                            onClick={() => {
                                              updateReactData({
                                                personFilter: this_message.partner_id.values().next().value
                                              }, true);
                                            }}
                                          >
                                            <img
                                              key={`${thread_index}_i_${message_index}`}
                                              className={classes.imageArea}
                                              alt={''}
                                              onError={onImageError}
                                              src={this_message.author_image}
                                            />
                                          </Box >
                                        </Box>
                                      }
                                      {/* Subject, To-Line, and Date/Time */}
                                      <Box display='flex'
                                        key={`${thread_index}_c3_${message_index}`}
                                        flexDirection='column'
                                        style={{ flexGrow: 1, minWidth: 0 }}
                                      >
                                        {isFirstMessage &&
                                          <React.Fragment>
                                            <Typography
                                              style={AVATextStyle({ size: 1, bold: true })}
                                            >
                                              {makeSubject(this_thread, message_index)}
                                            </Typography>
                                          </React.Fragment>
                                        }
                                        <Box display='flex'
                                          key={`${thread_index}_c3a_${message_index}`}
                                          flexDirection='column'
                                          style={{ marginLeft: (isFirstMessage ? 0 : 10), flexGrow: 1, minWidth: 0 }}
                                        >
                                          <Typography
                                            style={AVATextStyle({ size: 0.8, bold: true, color: (status_filter_result ? 'red' : null) })}
                                            onClick={async () => {
                                              if (this_message.inOut !== 'in') {
                                                if (reactData.expanded_composite_key !== this_message.composite_key) {
                                                  // Not expanded,  expand to show results
                                                  for (let this_recipient of this_message.recipients) {
                                                    for (let this_method in this_recipient.methods) {
                                                      let this_status = await dbClient
                                                        .get({
                                                          Key: {
                                                            thread_id: this_thread,
                                                            composite_key: this_recipient.methods[this_method].composite_key
                                                          },
                                                          TableName: "TheseusMessages",
                                                        })
                                                        .promise()
                                                        .catch(error => {
                                                          this_status = null;
                                                        });
                                                      if (recordExists(this_status)) {
                                                        this_recipient.methods[this_method].result = makeResultText({
                                                          resultArray: this_status.Item.results,
                                                          currentValue: this_recipient.methods[this_method].result
                                                        });
                                                      }
                                                    }
                                                  }
                                                  updateReactData({
                                                    expanded_composite_key: this_message.composite_key
                                                  }, true);
                                                } else {
                                                  // Is expanded, so collapse
                                                  updateReactData({
                                                    expanded_composite_key: false
                                                  }, true);
                                                }
                                              }
                                            }}
                                          >
                                            {makeToLine(this_thread, message_index)}
                                          </Typography>
                                          <Typography
                                            style={AVATextStyle({ size: 0.8 })}
                                          >
                                            {`${makeReadableTime(this_message.sent_time, state.session.client_timezone)}`}
                                          </Typography>
                                        </Box>
                                      </Box>
                                      {/* Right-margin icons: ZoomIn + Attachments (all messages), Reply/Delete/Send (first message only) */}
                                      <Box display='flex' flexDirection='row' alignItems='center' style={{ flexShrink: 0, marginLeft: '4px' }}>
                                        <IconButton
                                          size='small'
                                          title='View full message'
                                          onClick={async () => {
                                            await enrichMessageRecipients(this_message, this_thread);
                                            const prevMessage = message_index > 0 ? reactData.threads[this_thread].messages[message_index - 1] : null;
                                            updateReactData({
                                              viewMessageDialog: {
                                                subject: this_message.subject,
                                                message_text: this_message.message_text,
                                                html_message_text: this_message.html_message_text,
                                                author_name: this_message.author_name,
                                                sent_time: this_message.sent_time,
                                                recipients: buildDialogRecipients(this_message.recipients),
                                                deliveryCount: (this_message.recipients || []).length,
                                                replyEnabled: true,
                                                replyMessage: this_message,
                                                replyThread: this_thread,
                                                replyingTo: prevMessage ? {
                                                  authorName: prevMessage.author_name,
                                                  sentTime: prevMessage.sent_time,
                                                  messageText: prevMessage.message_text,
                                                } : null,
                                              }
                                            }, true);
                                          }}
                                        >
                                          <ZoomInIcon fontSize='small' />
                                        </IconButton>
                                        {this_message.attachments && this_message.attachments.map((aLine, aIndex) => (
                                          <a
                                            href={aLine}
                                            key={`attach_${message_index}-${aIndex}-href`}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            style={{ color: 'inherit' }}
                                          >
                                            <AttachmentIcon fontSize='small' />
                                          </a>
                                        ))}
                                        {isFirstMessage &&
                                          <ReplyIcon
                                            onClick={async () => {
                                              let newMessageRecipients = [];
                                              let replyToList = [];
                                              if (this_message.inOut === 'held') {
                                                newMessageRecipients.push({ person_id: this_message.author_id, person_name: this_message.author_name });
                                              }
                                              else {
                                                for (const this_person of this_message.partner_id) {
                                                  newMessageRecipients.push({ person_id: this_person, person_name: await makeName(this_person) });
                                                }
                                                if (this_message.reply_to && (this_message.reply_to.length > 0)) {
                                                  for (const this_recipient of this_message.reply_to) {
                                                    replyToList.push({ person_id: this_recipient, person_name: await makeName(this_recipient) });
                                                  }
                                                }
                                              }
                                              updateReactData({
                                                newMessageRecipients,
                                                replyToList,
                                                newMessageThread: this_message.thread_id || (this_message.composite_key ? this_message.composite_key.split('~')[0].replace('T:', '') : ''),
                                                newMessageSubject: this_message.subject,
                                                newMessageMode: true,
                                                is_reply: true,
                                                is_public: (reactData.threads[this_thread].is_public ?? false),
                                                newMessage_isPublic: (reactData.threads[this_thread].is_public ?? false)
                                              }, true);
                                            }}
                                          />
                                        }
                                        {isFirstMessage &&
                                          !reactData.viewOnly &&
                                          <React.Fragment>
                                            <DeleteIcon
                                              onClick={() => {
                                                updateReactData({
                                                  deletePending: {
                                                    composite_key: this_message.composite_key,
                                                    thread_id: this_thread
                                                  },
                                                  confirmMessage: `Delete this message?`
                                                }, true);
                                              }}
                                            />
                                            {(pPerson === '*allHeld') &&
                                              <SendIcon
                                                onClick={async () => {
                                                  await releaseMessage(this_message);
                                                  await refreshMessages();
                                                }}
                                              />
                                            }
                                          </React.Fragment>
                                        }
                                      </Box>
                                    </Box>
                                    {/* Message body — tap to view full message */}
                                    <Box
                                      display='flex'
                                      key={`message_body_box_${message_index}`}
                                      flexDirection='column'
                                      marginTop={isFirstMessage ? '8px' : '0'}
                                      style={{ marginLeft: (isFirstMessage ? 0 : 10), width: '100%', boxSizing: 'border-box', minWidth: 0, cursor: 'pointer' }}
                                      onClick={async () => {
                                        await enrichMessageRecipients(this_message, this_thread);
                                        const prevMessage = message_index > 0 ? reactData.threads[this_thread].messages[message_index - 1] : null;
                                        updateReactData({
                                          viewMessageDialog: {
                                            subject: this_message.subject,
                                            message_text: this_message.message_text,
                                            html_message_text: this_message.html_message_text,
                                            author_name: this_message.author_name,
                                            sent_time: this_message.sent_time,
                                            recipients: buildDialogRecipients(this_message.recipients),
                                            deliveryCount: (this_message.recipients || []).length,
                                            replyEnabled: true,
                                            replyMessage: this_message,
                                            replyThread: this_thread,
                                            replyingTo: prevMessage ? {
                                              authorName: prevMessage.author_name,
                                              sentTime: prevMessage.sent_time,
                                              messageText: prevMessage.message_text,
                                            } : null,
                                          }
                                        }, true);
                                      }}
                                    >
                                      {/* Plain text message (always shown when forced; also shown when no HTML available) */}
                                      {(forceMessagePlainText || !this_message.html_message_text || !this_message.html_message_text.startsWith('<')) &&
                                        <div
                                          style={{
                                            fontSize: `${reactData.user_fontSize * 0.9}rem`,
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            overflowWrap: 'break-word',
                                            wordWrap: 'break-word',
                                          }}
                                        >
                                          {truncateMessageText && this_message.message_text && (this_message.message_text.length > MESSAGE_TRUNCATE_LENGTH)
                                            ? `${this_message.message_text.slice(0, MESSAGE_TRUNCATE_LENGTH)}\u2026`
                                            : this_message.message_text
                                          }
                                        </div>
                                      }
                                      {/* HTML message — suppressed when plain text flag is on */}
                                      {(!forceMessagePlainText && this_message.html_message_text && this_message.html_message_text.startsWith('<')) &&
                                        <div
                                          style={{ border: '1px solid #ccc', margin: { top: '8px' }, padding: '8px', borderRadius: '30px' }}
                                          dangerouslySetInnerHTML={{ '__html': this_message.html_message_text }}
                                        />
                                      }
                                    </Box>
                                  </Box>
                                </Box>
                                {/* Expanded recipient results */}
                                {reactData.expanded_composite_key === this_message.composite_key &&
                                  <Box
                                    marginLeft={'65px'}
                                  >
                                    <Typography
                                      key={`history header`}
                                      style={AVATextStyle({ size: 0.8, bold: true, margin: { top: 1 } })}
                                    >
                                      {`Results`}
                                    </Typography>
                                    {(this_message.recipients.sort((a, b) => { return ((a.recipient_name > b.recipient_name) ? 1 : -1); })).map((this_recipient) => (
                                      (makeRecipientLines(this_recipient)).map((this_line, result_index) => (
                                        <Typography
                                          key={`prefLine-${message_index}_${result_index}`}
                                          style={AVATextStyle({ size: 0.8, margin: { left: ((result_index === 0) ? 0 : 2) } })}
                                        >
                                          {this_line}
                                        </Typography>
                                      ))
                                    ))}
                                    <Typography
                                      key={`thread_id`}
                                      style={AVATextStyle({ align: 'right', size: 0.6, margin: { top: 1 } })}
                                    >
                                      {`(Message ID ${this_message.composite_key ? (this_message.composite_key.split('~D')[0]) : ''})`}
                                    </Typography>
                                  </Box>
                                }
                              </Box>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    ));
                })
              ))
              }
            </Paper>
          }
          {/* Load older messages button removed from thread list — now in DialogActions */}
          {(Object.keys(reactData.threads).length === 0) && !(options && options.newMessage) &&
            <Box display='flex' flex={4} justifyContent='center' alignItems='flex-start' overflow='hidden'>
              <Typography style={AVATextStyle({ size: 1.5, bold: true, align: 'center', margin: { top: 3 } })} >
                {(reactData.lastReloadTime === 0) ? `Loading!  Please wait...` : `You don't have any message activity yet!`}
              </Typography>
            </Box>
          }
          {(Object.keys(reactData.threads).length === 0) && (options && options.newMessage) && !!options.sourceMessage && (() => {
            const src = options.sourceMessage;
            const subject = String(src.subject_line || src.subject || src.title || '').trim();
            const bodyText = String(options.sourceMessageText || '').trim();
            const sentDate = src.created_time ? makeReadableTime(src.created_time, state.session.client_timezone) : '';
            const senderName = options.sourceSenderName || String(src.sent_from || 'Unknown').trim();
            const previewBody = bodyText.length > 400 ? bodyText.slice(0, 400) + '…' : bodyText;
            return (
              <Paper
                component={Box}
                key={'source_message_preview'}
                marginLeft='16px'
                marginRight='16px'
                marginTop='8px'
                padding='16px'
                style={{ backgroundColor: '#f5f5f5', opacity: 0.9, borderRadius: '8px' }}
                square
              >
                <Typography style={AVATextStyle({ size: 0.75, bold: true, opacity: 0.55, margin: { bottom: 0.5 } })}>
                  {'In reference to:'}
                </Typography>
                <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='baseline'>
                  <Typography style={AVATextStyle({ size: 0.85, bold: true })}>
                    {`From: ${senderName}`}
                  </Typography>
                  <Typography style={AVATextStyle({ size: 0.8, opacity: 0.7 })}>
                    {sentDate}
                  </Typography>
                </Box>
                {!!subject &&
                  <Typography style={AVATextStyle({ size: 0.9, bold: true, margin: { top: 0.5 } })}>
                    {subject}
                  </Typography>
                }
                {!!previewBody &&
                  <Typography style={AVATextStyle({ size: 0.85, margin: { top: 0.5 }, opacity: 0.85 })}>
                    {previewBody}
                  </Typography>
                }
              </Paper>
            );
          })()}

          {reactData.deletePending &&
            <AVAConfirm
              promptText={reactData.confirmMessage}
              onCancel={() => {
                updateReactData({
                  deletePending: false
                }, true);
              }}
              onConfirm={() => {
                handleRemoveMessage(reactData.deletePending);
                updateReactData({
                  deletePending: false
                }, true);
              }}
            >
            </AVAConfirm>
          }
          {reactData.getAttachment &&
            <AVAUploadFile
              options={{
                buttonText: ['Choose', 'Save & Continue'],
                title: ['Attachments', 'Tap "Choose a File" to select something to attach'],
              }}
              onCancel={() => {
                updateReactData({
                  getAttachment: false
                }, true);
              }}
              onLoad={async (response) => {
                updateReactData({
                  attachments_to_send: response.map(f => { return f.fLoc; }),
                  getAttachment: false
                }, true);
              }}
            />
          }
          {reactData.showSelectTemplate &&
            <React.Fragment>
              <Dialog open={true || reactData.accessList}
                p={2}
                height={250}
                classes={{ paper: classes.clientPopUp }}
                fullWidth
                variant={'elevation'}
                elevation={2}
                onClose={() => {
                  updateReactData({
                    showSelectTemplate: false
                  }, true);
                }}
              >
                <DialogContentText
                  id='scroll-dialog-title'
                  style={AVATextStyle({
                    size: 1.4,
                    bold: true,
                    margin: { left: 0.5, top: 1 }
                  })}
                >
                  {'Select a Template'}
                </DialogContentText>
                <Select
                  options={reactData.templateList}
                  searchBy={'label'}
                  style={{
                    fontSize: '0.8rem',
                    marginLeft: -5,
                    marginBottom: -4,
                    marginTop: 1,
                    borderWidth: 3
                  }}
                  dropdownHandle={true}
                  variant={'standard'}
                  dropdownPosition={'auto'}
                  value={reactData.availableTemplates}
                  clearable={true}
                  clearOnSelect={false}
                  placeholder={'Select a Template from this list'}
                  clearOnBlur={false}
                  key={`selectBox_selectdrop`}
                  searchable={true}
                  multi={false}
                  closeOnClickInput={true}
                  closeOnSelect={true}
                  create={false}
                  keepSelectedInList={true}
                  noDataLabel={''}
                  onInputChange={async (values) => {
                    if (values.length > 0) {
                      let templateObj = await getTemplateText(values[0].value);
                      updateReactData({
                        newMessageText: (Array.isArray(templateObj.template_body) ? templateObj.template_body.join('') : templateObj.template_body),
                        showSelectTemplate: false,
                        html_message: !(templateObj.template_type === 'plain')
                      }, true);
                    }
                  }}
                  onChange={async (values) => {
                    if (values.length > 0) {
                      let templateObj = await getTemplateText(values[0].value);
                      updateReactData({
                        newMessageText: (Array.isArray(templateObj.template_body) ? templateObj.template_body.join('') : templateObj.template_body),
                        showSelectTemplate: false,
                        html_message: (templateObj.template_type === 'html')
                      }, true);
                    }
                  }}
                />
              </Dialog>
            </React.Fragment>
          }
          {reactData.showQuickSearch &&
            <QuickSearch
              reactData={reactData}
              updateReactData={updateReactData}
              options={{
                pickAndGo: true,
                keepSelections: true,
                withGroups: reactData.withGroupList,
                restrictGroups: state.session.client_style.restrict_groups,
                withPreferred: reactData.withPreferredList,
                hidePeople: !reactData.withIndividualList,
                buttonColor: (reactData.selections.length === 0) ? 'red' : 'green',
                buttonText: searchButtonText(),
                showAll: state.session.client_style.show_all_people ?? !state.session.client_style.restrict_groups,
                title: 'Select Recipients'
              }}
              onClose={async (selections) => {
                updateReactData({
                  showQuickSearch: false,
                  newMessageRecipients: selections || [],
                  selections: []
                }, true);
              }}
            />
          }
          {reactData.showSelectSender &&
            <QuickSearch
              reactData={Object.assign({}, reactData, { accessList: reactData.changeSenderNames })}
              updateReactData={(reactUpdObj) => {
                updateReactData(reactUpdObj, true);
              }}
              options={{
                pickAndGo: true,
                pickOne: true,
                keepSelections: true,
                buttonColor: (reactData.selections.length === 0) ? 'red' : 'green',
                buttonText: ((reactData.selections.length > 0) && (reactData.selections[0].person_name))
                  ? `Keep ${reactData.selections[0].person_name}`
                  : 'Exit',
                showAll: state.session.client_style.show_all_people ?? !state.session.client_style.restrict_groups,
                title: 'Who should be shown as the Sender of this message?'
              }}
              onClose={async (selections) => {
                let reactUpdObj = {
                  showSelectSender: false,
                  selections: [],
                  newMessageSendFrom: pPerson,
                  alternateSenderName: false
                };
                if (selections && (selections.length > 0) && (selections[0].person_id !== pPerson)) {
                  reactUpdObj.newMessageSendFrom = selections[0].person_id;
                  reactUpdObj.alternateSenderName = selections[0].person_name;
                }
                updateReactData(reactUpdObj, true);
              }}
            />
          }
          {reactData.viewPeopleMaintenance &&
            <PeopleMaintenance
              person_id={pPerson}
              initialValues={{ color: 'green' }}
              options={{ sectionToShow: ['ProfileSection', 'MessagePreferencesSection', 'PersonalizationSection'] }}
              onClose={() => {
                updateReactData({
                  viewPeopleMaintenance: false
                }, true);
              }}
            />
          }
          { // Command Area
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    onClick={onReset}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Close'}
                  </Button>
                  {reactData.showSinceDatePicker &&
                    <Dialog open onClose={() => updateReactData({ showSinceDatePicker: false }, true)} maxWidth='xs'>
                      <Box p={3} display='flex' flexDirection='column' style={{ gap: '16px' }}>
                        <Typography variant='subtitle1' style={{ fontWeight: 600 }}>{'Show messages since…'}</Typography>
                        <TextField
                          type='date'
                          label='Start date'
                          InputLabelProps={{ shrink: true }}
                          defaultValue={reactData.start_time
                            ? new Date(reactData.start_time).toISOString().slice(0, 10)
                            : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                          inputProps={{ max: new Date().toISOString().slice(0, 10) }}
                          id='since_date_input'
                        />
                        <Box display='flex' flexDirection='row' justifyContent='flex-end' style={{ gap: '8px' }}>
                          <Button size='small' onClick={() => updateReactData({ showSinceDatePicker: false }, true)}>{'Cancel'}</Button>
                          <Button
                            size='small'
                            variant='contained'
                            color='primary'
                            onClick={() => {
                              const val = document.getElementById('since_date_input').value;
                              if (!val) { return; }
                              const [y, m, d] = val.split('-').map(Number);
                              const newStart = new Date(y, m - 1, d).getTime();
                              updateReactData({
                                showSinceDatePicker: false,
                                start_time: newStart,
                                threads: {},
                                sorted_threads: [],
                                loadedWeeksOldest: null,
                              }, true);
                              setTimeout(() => refreshMessages(newStart), 0);
                            }}
                          >{'Apply'}</Button>
                        </Box>
                      </Box>
                    </Dialog>
                  }
                  {!reactData.viewOnly &&
                    <Button
                      onClick={async () => {
                        let reactUpd = {
                          showQuickSearch: true,
                          newMessageMode: true,
                          newMessageSubject: '',
                          newMessageText: '',
                          newUrgentMessage: false,
                          newMessageRecipients: [],
                          is_reply: false,
                          replyToList: [],
                          newMessageThread: false,
                        };
                        if (reactData.personFilter) {
                          reactUpd.newMessageRecipients = [{
                            person_id: reactData.personFilter,
                            person_name: await makeName(reactData.personFilter)
                          }];
                          reactUpd.showQuickSearch = false;
                        }
                        updateReactData(reactUpd, true);
                      }}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'green', color: 'white', marginLeft: '16px' }}
                      size='small'
                      startIcon={<SendIcon size='small' />}
                    >
                      {`New Message`}
                    </Button>
                  }
                  {reactData.personFilter &&
                    <Button
                      onClick={async () => {
                        updateReactData({
                          personFilter: false
                        }, true);
                      }}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'blue', color: 'white' }}
                      size='small'
                    >
                      {`Show all`}
                    </Button>
                  }
                </Box>
                {reactData.statusMessage &&
                  <Typography style={AVATextStyle({ size: 0.8, align: 'center' })} >
                    {reactData.statusMessage}
                  </Typography>
                }
              </Box>
            </DialogActions>
          }
          {reactData.alert &&
            <Snackbar
              open={!!reactData.alert}
              px={3}
              key={`alert_wrapper`}
              autoHideDuration={(reactData.alert.severity === 'success') ? 5000 : ((reactData.alert.severity === 'info') ? 15000 : null)}
              onClose={() => {
                updateReactData({
                  warning: false,
                  alert: false
                }, true);
              }}
              anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'center'
              }}
            >
              <Alert
                severity={reactData.alert.severity || 'info'}
                key={`alert_box`}
                style={{ marginX: '8px', borderRadius: '20px', border: 1 }}
                action={(reactData.alert.action
                  ?
                  <Box
                    display='flex'
                    key={`alert_action`}
                    mx={1}
                    overflow='auto'
                    flexDirection='column'
                  >
                    {([reactData.alert.action].flat()).map((this_action, actionNdx) => (
                      <Button
                        key={`alert_button__${actionNdx}`}
                        className={AVAClass.AVAButton} color="inherit"
                        onClick={() => this_action.function()}
                      >
                        {this_action.text}
                      </Button>
                    ))}
                  </Box>
                  : null
                )}
                variant='filled'
                onClose={() => {
                  updateReactData({
                    warning: false,
                    alert: false
                  }, true);
                }}
              >
                {reactData.alert.title && <AlertTitle>{reactData.alert.title}</AlertTitle>}
                {reactData.alert.message}
              </Alert>
            </Snackbar >
          }
          {/* Full message viewer pop-up */}
          {reactData.viewMessageDialog &&
            <MessageDetailDialog
              open={true}
              subject={reactData.viewMessageDialog.subject}
              messageText={reactData.viewMessageDialog.message_text}
              authorName={reactData.viewMessageDialog.author_name}
              sentTime={reactData.viewMessageDialog.sent_time}
              deliveryCount={reactData.viewMessageDialog.deliveryCount || 0}
              recipients={reactData.viewMessageDialog.recipients || []}
              replyingTo={reactData.viewMessageDialog.replyingTo || null}
              onClose={() => { updateReactData({ viewMessageDialog: false }, true); }}
              onReply={reactData.viewMessageDialog.replyEnabled
                ? async () => {
                  const msg = reactData.viewMessageDialog.replyMessage;
                  const thread = reactData.viewMessageDialog.replyThread;
                  let newMessageRecipients = [];
                  let replyToList = [];
                  if (msg.inOut === 'held') {
                    newMessageRecipients.push({ person_id: msg.author_id, person_name: msg.author_name });
                  } else {
                    for (const this_person of msg.partner_id) {
                      newMessageRecipients.push({ person_id: this_person, person_name: await makeName(this_person) });
                    }
                    if (msg.reply_to && msg.reply_to.length > 0) {
                      for (const this_recipient of msg.reply_to) {
                        replyToList.push({ person_id: this_recipient, person_name: await makeName(this_recipient) });
                      }
                    }
                  }
                  updateReactData({
                    viewMessageDialog: false,
                    newMessageRecipients,
                    replyToList,
                    newMessageThread: msg.thread_id || (msg.composite_key ? msg.composite_key.split('~')[0].replace('T:', '') : ''),
                    newMessageSubject: msg.subject,
                    newMessageMode: true,
                    is_reply: true,
                    is_public: (reactData.threads[thread].is_public ?? false),
                    newMessage_isPublic: (reactData.threads[thread].is_public ?? false)
                  }, true);
                }
                : null
              }
            />
          }
        </React.Fragment >
      }
    </Dialog >
  );
};