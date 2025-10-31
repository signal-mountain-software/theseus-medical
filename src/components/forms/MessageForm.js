import React from 'react';
import useSession from '../../hooks/useSession';

import { Editor } from '@tinymce/tinymce-react';
import { html_to_pdf } from '../../util/AVAMessages';
import Select from "react-dropdown-select";

import { getImage, getPerson, makeName } from '../../util/AVAPeople';
import { extract, dbClient, titleCase, sentenceCase, listFromArray, cl, uuid, recordExists, isEmpty, array_in_array } from '../../util/AVAUtilities';
import { getMemberList } from '../../util/AVAGroups';
import { AVATextStyle } from '../../util/AVAStyles';
import { makeDate } from '../../util/AVADateTime';
import AVAUploadFile from '../../util/AVAUploadFile';
import { Alert, AlertTitle } from '@material-ui/lab/';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';

import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
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

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';

import DeleteIcon from '@material-ui/icons/Delete';
import SendIcon from '@material-ui/icons/Send';
import AVAConfirm from './AVAConfirm';

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

export default ({ pPerson, pClient, pMessageList, onReset, defaultValue, options }) => {

  const { state } = useSession();
  const classes = useStyles();
  const AVAClass = AVAclasses();

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
    forceReloadTime: 0,
    idleState: false,
    imageTable: {},
    inOut_filter: (options && options.inOut_filter) || false,
    isSmall: (window.window.innerWidth < 800),
    isTiny: (window.window.innerWidth < 500),
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
    selectedPeople_count: 0,
    selectedPeople_list: [],
    showSelectSender: false,
    selections: [], // wip selections from quick search
    showDeleted: (options && options.showDeleted) || false,
    showGroupList: (options && options.showGroupList ? true : false),
    showIndividualList: false,
    showPreferredList: ((options && options.hasOwnProperty('showPreferredList') && !options.showPreferredList) ? false : true),
    showQuickSearch: (options && options.newMessage && (!options.recipients || (options.recipients.length === 0))) || false,
    showVMAlt: ((options && options.hasOwnProperty('hideVMAlt') && options.hideVMAlt) ? true : false),
    singleFilterDigit: false,
    start_time: (options && options.hasOwnProperty('start_time')) ? makeDate(options.start_time).timestamp : false,
    statusFilter: (options && options.statusFilter) || false,
    statusMessage: false,
    sorted_threads: [],
    threadObj: {},
    threads: {},
    // threads is {[<thread_id>]: {last_update: <>, messages: []}}, {[<thread_id>]: {}}...]
    // threads[n].messages is [{message_text: <>, last_update: <>, attachments: [], recipients: []}, {}...]
    // threads[n].messages[m].recipients is [{recipient_id: <>, recipient_name: <>, wasHeld: <t/f>, methods: []}, {}...] 
    // threads[n].messages[m].recipients[o].methods is [{method: <>, sent_time: <>, last_update_time: <>, result: <>}, {}...]
    viewOnly: (options && options.viewOnly) || false,
    viewPeopleMaintenance: false,
    warning: false,
    window_width: window.window.innerWidth,
  });

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  let last_displayed_thread = null;
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

  function makeReadableTime(pJavaDate) {
    let dDate = new Date(Number(pJavaDate));
    return dDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  function makeSubject(this_thread, message_number) {
    last_displayed_thread = this_thread;
    let response = reactData.threads[this_thread].messages[message_number].subject || `Conversation originated by ${reactData.threads[this_thread].messages[message_number].author_name}`;
    if (reactData.threads[this_thread].messages[message_number].subject.startsWith('Message from')) {
      response = reactData.threads[this_thread].messages[message_number].subject.replace('Message from', 'Conversation originated by');
    }
    return titleCase(response);
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
      const HTMLcontent = editorRef.current.getContent();
      setDirty(false);
      editorRef.current.setDirty(false);
      let reactUpdObj = {
        newMessageText: HTMLcontent
      };
      //     if (HTMLcontent.length > 500) {
      //       reactUpdObj.warning = true;
      //       reactUpdObj.alert = {
      //         severity: 'warning',
      //         title: 'Message length',
      //         message: <div>Your message is {HTMLcontent.length.toLocaleString('en-US')} characters long.<br />
      //           Some text messaging networks limit message size to 500 characters.<br />
      //           You may send the message as is.  If you choose to do that, we will break the message into {Math.floor(HTMLcontent.length / 500) + 1} parts and send each part as a separate message for text message recipients.
      //           (All other recipients will receive the message as entered.)</div>,
      //       };
      //     }
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

  const onAction = async () => {
    if (reactData.forceReloadTime) {
      let now = new Date().getTime();
      if (reactData.forceReloadTime < now) {
        await initialize();
      }
    }
    if (reactData.idleState) {
      updateReactData({
        idleState: false,
      }, false);
    }
    reset();
  };

  const onIdle = async () => {
    let now = new Date();
    let minutesSinceActive = 0;
    if (reactData.forceReloadTime) {
      let now = new Date().getTime();
      if (reactData.forceReloadTime < now) {
        await initialize();
      }
    }
    if (!reactData.idleState) {    // if we weren't previously in an idle state and we are now...
      cl(`Went idle at ${now.toLocaleString()}.  Idle for ${minutesSinceActive} minutes.`);
      updateReactData({
        idleState: true,
        enteredIdleStateTime: now,
      }, true);
    }
    else {   // we are still in an idle state
      minutesSinceActive = Math.floor((now.getTime() - reactData.enteredIdleStateTime.getTime()) / oneMinute);
      if (minutesSinceActive > 2) {
        await initialize();
      }
      else {
        cl(`Still idle at ${now.toLocaleString()}.  Idle for ${minutesSinceActive} minutes.`);
      }
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
        .catch(error => {
          if (error.code === 'NetworkingError') {
            updateReactData({
              alert: {
                severity: 'error',
                title: 'No Internet',
                message: `There is no internet connection`,
              }
            }, true);
          }
          else {
            updateReactData({
              alert: {
                severity: 'error',
                title: 'Database problem',
                message: `Error reading Templates: ${error}`,
              }
            }, true);
          }
        });
      if (templateRecs && templateRecs.LastEvaluatedKey) {
        queryObj.ExclusiveStartKey = templateRecs.LastEvaluatedKey;
      }
      else {
        delete queryObj.ExclusiveStartKey;
      }
      if (recordExists(templateRecs)) {
        for (let this_template of templateRecs.Items) {
          if (this_template.template_mayUse_groupList.includes('*all') ||
            reactData.administrative_account ||
            array_in_array(this_template.template_mayUse_groupList, state.user.groups)) {
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
        reply_to
      },
      TableName: 'PostOffice'
    };
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
            partner_id: PostOfficeRec.Item.recipient_key,
            recipients: reactData.newMessageRecipients.map((r, x) => {
              return {
                recipient_id: r.person_id || r.group_id || reactData.preferred_recipients[r.rIndex].personList[0],
                recipient_name: r.person_name || r.group_name || reactData.preferred_recipients[r.rIndex].objText,
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
            other_recipients: []   // these are IDs of people who - on an inbound message to me - also received the same message
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
        forceReloadTime: new Date().getTime() + (1000 * 30),
        alert: {
          severity: 'success',
          title: 'Your Message',
          message: `Your message is on the way to ${recipientMessageText}`
        }
      }, true);
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
    return;
  }

  function handleResize() {
    updateReactData({
      window_width: window.window.innerWidth,
      isSmall: (window.window.innerWidth < 800),
      isTiny: (window.window.innerWidth < 500),
    }, true);
  }

  const oneDay = 24 * 60 * 60 * 1000;

  async function allMessages({ person_id, start_time, end_time }) {
    if (!start_time) {
      let nowTime = new Date().getTime();
      start_time = nowTime - (7 * oneDay);
      end_time = nowTime + oneDay;
    }
    let queryObj;
    // Get messages to me
    if (!reactData.inOut_filter || (reactData.inOut_filter === 'in')) {
      let inRecs;
      queryObj = {
        KeyConditionExpression: 'deliver_to = :p AND created_time between :s and :e',
        ExpressionAttributeValues: {
          ':p': person_id,
          ':s': start_time.toString(),
          ':e': end_time.toString()
        },
        TableName: "TheseusMessages",
        IndexName: 'deliver_to-index',
        ScanIndexForward: false,
      };
      do {
        inRecs = await dbClient
          .query(queryObj)
          .promise()
          .catch(error => {
            if (error.code === 'NetworkingError') {
              updateReactData({
                alert: {
                  severity: 'error',
                  title: 'No Internet',
                  message: `There is no internet connection`,
                }
              }, true);
            }
            else {
              updateReactData({
                alert: {
                  severity: 'error',
                  title: 'Database problem',
                  message: `Error reading inbound Messages: ${error}`,
                }
              }, true);
            }
          });
        if (inRecs && inRecs.LastEvaluatedKey) {
          queryObj.ExclusiveStartKey = inRecs.LastEvaluatedKey;
        }
        else {
          delete queryObj.ExclusiveStartKey;
        }
        if (recordExists(inRecs)) {
          await processDeliveryRecs(inRecs.Items, '', person_id);
        }
      } while (queryObj.ExclusiveStartKey);
    }
    // Get messages from me
    if (!reactData.inOut_filter || (reactData.inOut_filter === 'out')) {
      let outRecs;
      queryObj = {
        KeyConditionExpression: 'sent_from = :p AND created_time between :s and :e',
        FilterExpression: 'record_type = :t',
        ExpressionAttributeValues: {
          ':p': person_id,
          ':s': start_time.toString(),
          ':e': end_time.toString(),
          //      ':t': 'delivery',
          ':t': 'message',
        },
        TableName: "TheseusMessages",
        IndexName: 'sent_from-index',
        ScanIndexForward: false,
      };
      do {
        outRecs = await dbClient
          .query(queryObj)
          .promise()
          .catch(error => {
            if (error.code === 'NetworkingError') {
              updateReactData({
                alert: {
                  severity: 'error',
                  title: 'No Internet',
                  message: `There is no internet connection`,
                }
              }, true);
            }
            else {
              updateReactData({
                alert: {
                  severity: 'error',
                  title: 'Database problem',
                  message: `Error reading outbound Messages: ${error}`,
                }
              }, true);
            }
          });
        if (outRecs && outRecs.LastEvaluatedKey) {
          queryObj.ExclusiveStartKey = outRecs.LastEvaluatedKey;
        }
        else {
          delete queryObj.ExclusiveStartKey;
        }
        if (recordExists(outRecs)) {
          await processDeliveryRecs(outRecs.Items, '', person_id);
        }
      } while (queryObj.ExclusiveStartKey);
    }
    /*  if (autoFocus && autoFocus.current) {
        autoFocus.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
      */
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
        .catch(error => {
          if (error.code === 'NetworkingError') {
            updateReactData({
              alert: {
                severity: 'error',
                title: 'No Internet',
                message: `There is no internet connection`,
              }
            }, true);
          }
          else {
            updateReactData({
              alert: {
                severity: 'error',
                title: 'Database problem',
                message: `Error reading inbound Messages: ${error}`,
              }
            }, true);
          }
        });
      if (actionRecs && actionRecs.LastEvaluatedKey) {
        queryObj.ExclusiveStartKey = actionRecs.LastEvaluatedKey;
      }
      else {
        delete queryObj.ExclusiveStartKey;
      }
      if (recordExists(actionRecs)) {
        let mailRecs = [];
        for (let this_heldMessage of actionRecs.Items) {
          let mailRec = await dbClient
            .query({
              KeyConditionExpression: 'composite_key = :k',
              ExpressionAttributeValues: {
                ':k': this_heldMessage.content.composite_key
              },
              TableName: "TheseusMessages",
              IndexName: 'composite_key-index'
            })
            .promise()
            .catch(error => {
              cl(`Error reading TheseusMessages for composite key ${this_heldMessage.content.composite_key}.  Error is ${error}`);
            });
          if (recordExists(mailRec)) {
            mailRecs.push(Object.assign({}, mailRec.Items[0], { actionRec: this_heldMessage }));
          }
        }
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
          messages: []
        };
      }
      if (!state.patient.hasOwnProperty('preferred_language')) {
        state.patient.preferred_language = 'en';
      }
      if (this_deliveryRec.content.current.hasOwnProperty(state.patient.preferred_language || 'en')) {
        this_deliveryRec.message_text = this_deliveryRec.content.current[state.patient.preferred_language || 'en'];
      }
      else if (this_deliveryRec.content.current.hasOwnProperty('original')) {
        this_deliveryRec.message_text = this_deliveryRec.content.current.original;
      }
      else if (this_deliveryRec.content.current.hasOwnProperty('EN-US')) {
        this_deliveryRec.message_text = this_deliveryRec.content.current['EN-US'];
      }
      else {
        this_deliveryRec.message_text = '(Message content unavailable)';
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
          subject: this_deliveryRec.subject_line,
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
          partner_id: [],
          recipients: [],
          actionRec: this_deliveryRec.actionRec || false,
          other_recipients: []   // these are IDs of people who - on an inbound message to me - also received the same message
        });
        message_added = true;
        message_number = reactData.threads[this_deliveryRec.thread_id].messages.length - 1;
      }


      if ((this_deliveryRec.record_type === 'message') && (inOut === 'out')) {
        for (let this_recipient_key in this_deliveryRec.recipient_list) {
          let this_recipient = this_deliveryRec.recipient_list[this_recipient_key];
          if (!reactData.threads[this_deliveryRec.thread_id].messages[message_number].partner_id.includes(this_recipient.id)) {
            reactData.threads[this_deliveryRec.thread_id].messages[message_number].partner_id.push(this_recipient.id);
          }
          let recipient_number = reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients.findIndex(r => { return r.recipient_id === this_recipient.id; });
          if (recipient_number === -1) {
            recipient_number = reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients.push({
              recipient_id: this_recipient.id,
              recipient_name: (`${this_recipient.name.first} ${this_recipient.name.last}`).trim(),
              wasHeld: false,
              status_held: false,
              status_blocked: false,
              status_redirected: false,
              status_with_rules: Boolean(this_deliveryRec.recipient_list && this_deliveryRec.recipient_list.rule_used),
              status_not_og: Boolean(this_deliveryRec.recipient_list && this_deliveryRec.recipient_list.not_original_recipient),
              heldUntil: 0,
              methods: {}
            }) - 1;
          }
          let this_method = standardizeMethod(this_recipient.method);
          if (this_method === 'held') {
            reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].wasHeld = true;
            reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].status_held = true;
            reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].heldUntil = this_deliveryRec.recipient_list.holdUntil;
            if (this_deliveryRec.recipient_list.hold_reason === 'blocked') {
              reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].status_blocked = true;
            }
            if (this_deliveryRec.recipient_list.hold_reason === 'replaced') {
              reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].status_redirected = true;
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
          reactData.threads[this_deliveryRec.thread_id].messages[message_number].partner_id.push(this_deliveryRec.author.author_id);
        }
        else {
          reactData.threads[this_deliveryRec.thread_id].messages[message_number].partner_id.push(this_deliveryRec.deliver_to);
        }
        //     recipient_number = reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients.push({
        //       recipient_id: this_deliveryRec.deliver_to,
        //       recipient_name: (`${this_deliveryRec.recipient_list.name.first} ${this_deliveryRec.recipient_list.name.last}`).trim(),
        //       wasHeld: false,
        //       status_held: false,
        //       status_blocked: false,
        //       status_redirected: false,
        //       status_with_rules: Boolean(this_deliveryRec.recipient_list && this_deliveryRec.recipient_list.rule_used),
        //       status_not_og: Boolean(this_deliveryRec.recipient_list && this_deliveryRec.recipient_list.not_original_recipient),
        //       heldUntil: 0,
        //       methods: {}
        //     }) - 1;
      }
      /*
      let this_method = standardizeMethod(this_deliveryRec.deliver_method);
      if (this_method === 'held') {
        reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].wasHeld = true;
        reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].status_held = true;
        reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].heldUntil = this_deliveryRec.recipient_list.holdUntil;
        if (this_deliveryRec.recipient_list.hold_reason === 'blocked') {
          reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].status_blocked = true;
        }
        if (this_deliveryRec.recipient_list.hold_reason === 'replaced') {
          reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].status_redirected = true;
        }
      }
      let this_result = this_deliveryRec.results[0];
      this_deliveryRec.last_update = Number(this_result.posted_time || this_deliveryRec.created_time);
      if (((this_method !== 'held') && (this_method !== 'AVA'))
        || (Object.keys(reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].methods).length === 0)) {
        if (reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].methods) {
          delete reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].methods['held'];
          delete reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].methods['AVA'];
        }
        reactData.threads[this_deliveryRec.thread_id].messages[message_number].recipients[recipient_number].methods[this_method] = {
          last_update_time: (this_result.posted_time || this_deliveryRec.created_time).toString(),
          result: this_result.result,
          composite_key: this_deliveryRec.composite_key,
        };
      }
      if (this_deliveryRec.last_update > reactData.threads[this_deliveryRec.thread_id].messages[message_number].last_update) {
        reactData.threads[this_deliveryRec.thread_id].messages[message_number].last_update = this_deliveryRec.last_update;
        if ((this_deliveryRec.last_update > reactData.threads[this_deliveryRec.thread_id].last_update)
          && (!['open', 'delivered', 'delivery'].includes(this_deliveryRec.delivery_status))
        ) {
          reactData.threads[this_deliveryRec.thread_id].last_update = this_deliveryRec.last_update;
        }
      }
      
      if (!isEmpty(this_deliveryRec.reply_to)) {
        reactData.threads[this_deliveryRec.thread_id].messages[message_number].reply_to = this_deliveryRec.reply_to;
      }
      */
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
          return ((a.sent_time > b.sent_time) ? -1 : 1);
        });
      }
      // every 50 records, send info back
      if ((totalProcessed % 50) === 0) {
        let sorted_threads = Object.keys(reactData.threads).sort((a, b) => {
          return ((reactData.threads[a].last_update > reactData.threads[b].last_update) ? -1 : 1);
        });
        updateReactData({
          statusMessage: `Processing inbound - ${totalProcessed} of ${totalCount}`,
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
      if (this_result.result.toLowerCase().startsWith('reply')) {
        return `Replied to ${makeDate(this_result.posted_time).oaDate}`;
      }
      else if (this_result.result.toLowerCase() === 'response') {
        return `Call responded to with "${this_result.response}" ${makeDate(this_result.posted_time).oaDate}`;
      }
      else if (!alreadyOpened) {
        if (this_result.result.toLowerCase() === 'open') {
          resultText = `Opened ${makeDate(this_result.posted_time).oaDate}`;
          alreadyOpened = true;
        }
        else if (this_result.result.toLowerCase().startsWith('deliver')) {
          resultText = `Delivery`;
          if (this_result.info && this_result.info.phoneCarrier) {
            resultText += ` confirmed by ${this_result.info.phoneCarrier}`;
          }
          resultText += ` ${makeDate(this_result.posted_time).oaDate}`;
        }
        else if ((this_result.result.toLowerCase().includes('no answer')) || (this_result.result.toLowerCase().includes('busy'))) {
          resultText = `No answer ${makeDate(this_result.posted_time).oaDate}`;
        }
        else if (this_result.result.toLowerCase().includes('answered')) {
          resultText = `${sentenceCase(this_result.result)} ${makeDate(this_result.posted_time).oaDate}`;
          alreadyOpened = true;
        }
        else {

        }
      }
    }
    return resultText;
  }

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

  function makeToLine(this_thread, message_index) {
    let response;
    if (reactData.threads[this_thread].messages[message_index].inOut === 'out') {
      response = `Me -> `;
      if (reactData.threads[this_thread].messages[message_index].recipients.length < 4) {
        response += listFromArray(reactData.threads[this_thread].messages[message_index].recipients.map(r => { return r.recipient_name; }));
      }
      else {
        response += `${reactData.threads[this_thread].messages[message_index].recipients.length} people`;
      }
    }
    else if (reactData.threads[this_thread].messages[message_index].inOut === 'held') {
      response = `${reactData.threads[this_thread].messages[message_index].author_name} -> `;
      if (reactData.threads[this_thread].messages[message_index].recipients.length < 4) {
        response += listFromArray(reactData.threads[this_thread].messages[message_index].recipients.map(r => { return r.recipient_name; }));
      }
      else {
        response += `${reactData.threads[this_thread].messages[message_index].recipients.length} people`;
      }
    }
    else {
      response = `${reactData.threads[this_thread].messages[message_index].author_name} -> `;
      if (reactData.threads[this_thread].messages[message_index].other_recipients.length < 3) {
        response += listFromArray(reactData.threads[this_thread].messages[message_index].other_recipients.concat(['Me']));
      }
      else {
        response += `Me and ${reactData.threads[this_thread].messages[message_index].other_recipients.length} other people`;
      }
    }
    return response;
  }

  async function initialize() {
    // housekeeping
    updateReactData({
      myImage: await getImage(pPerson),
      myName: await makeName(pPerson),
      templateList: await getTemplateList()
    }, true);
    let nowTime = new Date().getTime();
    let loop_until;
    if (!reactData.start_time) {
      loop_until = nowTime - (30 * oneDay);
    }
    else {
      loop_until = reactData.start_time;
    }
    let this_start = Math.max((nowTime - (2 * oneDay)), loop_until);
    let this_end = nowTime + oneDay;
    if (pPerson === '*allHeld') {
      await heldMessages();
    }
    else {
      do {
        await allMessages({ person_id: pPerson, start_time: this_start, end_time: this_end });
        this_end = this_start;
        this_start -= (7 * oneDay);
      } while (this_start > loop_until);
      await allMessages({ person_id: pPerson, start_time: loop_until, end_time: this_end });
    }
    start();  // idle timer
    updateReactData({
      lastReloadTime: new Date(),
      lastActiveTime: new Date(),
      forceReloadTime: 0,
      idleState: false,
      statusMessage: false
    }, true);
  }

  function standardizeMethod(raw_method) {
    if (raw_method === 'email') {
      return 'e-Mail';
    }
    else if (raw_method === 'sms') {
      return 'text';
    }
    else if (raw_method === 'voice') {
      return 'phone';
    }
    else if (raw_method === 'hold') {
      return 'held';
    }
    else {
      return 'AVA';
    }
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
      response = reactData.threads[this_thread].messages[this_messageIndex].partner_id.includes(reactData.personFilter);
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
                              {((reactData.newMessageRecipients.length > 4) || ((reactData.selections.length > 4) && !reactData.showReplyToSearch))
                                ? (`${reactData.alternateSenderName || 'Me'} -> ${reactData.selectedPeople_count || reactData.selections.length} recipients`)
                                : ((reactData.newMessageRecipients.length > 0) || ((reactData.selections.length > 0) && !reactData.showReplyToSearch))
                                  ? `${reactData.alternateSenderName || 'Me'} -> ${listFromArray(((reactData.newMessageRecipients.length > 0)
                                    ? reactData.newMessageRecipients
                                    : reactData.selections)
                                    .map(r => (r.person_name || r.group_name || reactData.preferred_recipients?.[r.rIndex]?.objText)),
                                    { max: { length: 4, words: 'recipients' } })}`
                                  : `${reactData.alternateSenderName || 'Me'} ->`
                              }
                            </Typography>
                            <Typography
                              style={Object.assign({}, { display: 'flex', textWrap: 'nowrap', alignSelf: 'center' }, AVATextStyle({ margin: { left: 1 }, size: 0.8 }))}
                            >
                              {((reactData.newMessageRecipients.length === 0) && isEmpty(reactData.selections))
                                ? '(Tap here to select Recipients)'
                                : `(Tap here to add/change Recipients)`
                              }
                            </Typography>
                          </Box>
                          <Typography
                            style={AVATextStyle({ size: 0.8, margin: { bottom: 1 } })}
                          >
                            {`${makeReadableTime(new Date().getTime())}`}
                          </Typography>
                          <TextField
                            id='Message_subject_new'
                            multiline
                            autoComplete='off'
                            style={AVATextStyle({ size: 1.2, bold: true, margin: { right: 1.5 } })}
                            onChange={async (event) => {
                              updateReactData({
                                newMessageSubject: event.target.value
                              }, true);
                            }}
                            defaultValue={reactData.newMessageSubject}
                            helperText={'Subject'}
                          />
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
                        <TextField
                          id='MessageText_new'
                          multiline
                          autoComplete='off'
                          style={AVATextStyle({ size: 1.2, bold: true, margin: { right: 1.5 } })}
                          onBlur={async (event) => {
                            let reactUpdObj = {
                              newMessageText: event.target.value
                            };
                            //                          if (event.target.value.length > 500) {
                            //                            reactUpdObj.warning = true;
                            //                            reactUpdObj.alert = {
                            //                              severity: 'warning',
                            //                              title: 'Message length',
                            //                              message: <div>Your message is {event.target.value.length.toLocaleString('en-US')} characters long.<br />
                            //                                Some text messaging networks limit message size to 500 characters.<br />
                            //                                You may send the message as is.  If you choose to do that, we will break the message into {Math.floor(event.target.value.length / 500) + 1} parts and send each part as a separate message for text message recipients.
                            //                                (All other recipients will receive the message as entered.)</div>,
                            //                            };
                            //                          }
                            updateReactData(reactUpdObj, true);
                          }}
                          defaultValue={reactData.newMessageText}
                          helperText={'Message Text'}
                        />
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
                          <Editor
                            apiKey='jz5usjjdkhrx34z6bm32xhv8pxep9u7iptvmqnsz8goday9n'
                            key={'tinyMCE_editing_area'}
                            id={'tinyMCE_editing_area'}
                            onInit={(evt, editor) => editorRef.current = editor}
                            onDirty={() => setDirty(true)}
                            onBlur={() => {
                              HTMLsave();
                            }}
                            initialValue={reactData.newMessageText}
                            init={{
                              branding: false,
                              statusbar: false,
                              height: 300,
                              selector: 'textarea',
                              plugins: [
                                // Core editing features
                                // the inlinecss is part of the paid program.  Removing to see what the effect is...
                                'anchor', 'autolink', 'charmap', 'codesample', 'emoticons', 'image', 'inlinecss', 'lists', 'media', 'searchreplace', 'table', 'visualblocks', 'wordcount',
                                // 'anchor', 'autolink', 'charmap', 'codesample', 'emoticons', 'image', 'link', 'lists', 'media', 'searchreplace', 'table', 'visualblocks', 'wordcount',
                                // Your account includes a free trial of TinyMCE premium features
                                // Try the most popular premium features until May 26, 2025:
                                'checklist', 'mediaembed', 'casechange', 'formatpainter', 'pageembed', 'permanentpen', 'advtable', 'advcode', 'editimage', 'advtemplate', 'mentions', 'tableofcontents', 'footnotes', 'mergetags', 'inlinecss', 'markdown'
                              ],
                              toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline forecolor backcolor | table | spellcheckdialog | align lineheight | checklist numlist bullist indent outdent | emoticons charmap | removeformat',
                              line_height_formats: '0.8 1 1.2 1.4 1.6 2',
                            }}
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
                                await sendMessage();
                                await initialize();
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
                          <Typography
                            style={AVATextStyle({ size: 1 })}
                            onClick={() => {
                              updateReactData({
                                replyToList: [],
                                showReplyToSearch: true,
                                selections: reactData.replyToList
                              }, true);
                            }}
                          >
                            {((reactData.replyToList.length > 0) || ((reactData.selections.length > 0) && !reactData.showQuickSearch))
                              ? `Replies cc'd to: ${listFromArray(((reactData.replyToList.length > 0)
                                ? reactData.replyToList
                                : reactData.selections).map(r => r.person_name),
                                { max: { length: 2, words: 'people' } })}`
                              : `Add Reply To`
                            }
                          </Typography>
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
                        </Box>
                      </Box>
                    </Box>
                    <DeleteIcon
                      onClick={() => {
                        updateReactData({
                          newMessageRecipients: [],
                          replyToList: [],
                          newMessageMode: false
                        }, true);
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            </Paper>
          }
          {(Object.keys(reactData.threads).length > 0) &&
            <Paper component={Box} className={classes.page} overflow='auto' square>
              {reactData.sorted_threads.map((this_thread, thread_index) => (
                reactData.threads[this_thread].messages.map((this_message, message_index) => (
                  (okToShow(this_thread, message_index) &&
                    <Box key={`${thread_index}_frag_${message_index}_${reactData.personFilter || ''}`}
                      borderTop={((thread_index !== 0) && (this_thread !== last_displayed_thread)) ? 2 : 0}
                      borderColor={'black'}
                      onContextMenu={async (e) => {
                        e.preventDefault();
                      }}
                    >
                      <Box display='flex' flexDirection='column'
                      //                     ref={((this_thread === reactData.newMessageThread) && (message_index === 0)) ? autoFocus : null}
                      >
                        <Box
                          display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                          key={`${thread_index}_r_${message_index}`}
                          className={classes.listItem}
                        >
                          <Box display='flex'
                            key={`${thread_index}_r2_${message_index}`}
                            maxWidth={(reactData.isTiny ? '80%' : null)}
                            flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'
                          >
                            <Box display='flex'
                              key={`${thread_index}_c_${message_index}`}
                              flexDirection='column'
                              style={{ flexGrow: 1 }}
                              justifyContent={'center'}
                            >
                              <Box display='flex'
                                key={`${thread_index}_r3_${message_index}`}
                                flexDirection='row'
                              >
                                <Box display='flex'
                                  key={`${thread_index}_r3a_${message_index}`}
                                  flexDirection='row'
                                  minWidth={'65px'}
                                >
                                  {(this_thread !== last_displayed_thread) &&
                                    <Box
                                      key={`${thread_index}_ibox_${message_index}`}
                                      style={{ alignSelf: 'anchor-center' }}
                                      onClick={() => {
                                        updateReactData({
                                          personFilter: this_message.partner_id[0]
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
                                  }
                                </Box>
                                <Box display='flex'
                                  key={`${thread_index}_c2b_${message_index}`}
                                  flexDirection='column'
                                  style={{
                                    maxWidth: (reactData.isTiny ? '70%' : null),
                                    flexGrow: 1
                                  }}
                                >
                                  <Box display='flex'
                                    key={`${thread_index}_r5_${message_index}`}
                                    flexDirection='row'
                                    style={{
                                      flexGrow: 1
                                    }}
                                  >
                                    <Box display='flex'
                                      key={`${thread_index}_c3_${message_index}`}
                                      flexDirection='column'
                                      style={{ flexGrow: 1 }}
                                    >
                                      {(this_thread !== last_displayed_thread) &&
                                        <React.Fragment>
                                          <Typography
                                            style={AVATextStyle({ size: 1, bold: true, margin: { top: 1 } })}
                                          >
                                            {makeSubject(this_thread, message_index)}
                                          </Typography>
                                        </React.Fragment>
                                      }
                                      <Typography
                                        style={AVATextStyle({ size: 0.8, bold: true, color: (status_filter_result ? 'red' : null) })}
                                      >
                                        {makeToLine(this_thread, message_index)}
                                      </Typography>
                                      <Typography
                                        style={AVATextStyle({ size: 0.8 })}
                                      >
                                        {`${makeReadableTime(this_message.sent_time)} - ${makeMethodLine(this_message)}`}
                                      </Typography>
                                    </Box>
                                  </Box>



                                  {(!this_message.html_message_text || !this_message.html_message_text.startsWith('<')) &&
                                    <Typography key={`prefLine-text`}
                                      style={Object.assign({}, AVATextStyle({ size: ((message_index === 0) ? 1 : 0.9) }), { overflowWrap: 'anywhere', overflowY: 'auto' })}
                                    >
                                      {this_message.message_text}
                                    </Typography>
                                  }
                                  {(this_message.html_message_text && this_message.html_message_text.startsWith('<')) &&
                                    <Box
                                      borderRadius={'30px'}
                                      padding={'8px'}
                                      marginTop='16px'
                                      marginBottom='16px'
                                      marginRight='16px'
                                      border={2}
                                      borderColor={reactData.newUrgentMessage ? 'red' : 'black'}
                                    >
                                      <div
                                        dangerouslySetInnerHTML={{ '__html': this_message.html_message_text }}
                                      />
                                    </Box>
                                  }




                                </Box>
                              </Box>
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
                          <Box display='flex'
                            key={`options_r4col_${message_index}`}
                            flexDirection='column'
                            alignItems='center'
                            style={{
                            }}
                          >
                            {this_message.attachments &&
                              <Box display='flex'
                                key={`attachments_${message_index}`}
                                flexDirection='row'
                                style={{ marginBottom: '8px', marginTop: '8px' }}
                              >
                                {this_message.attachments.map((aLine, aIndex) => (
                                  <a
                                    href={aLine}
                                    key={`attach_${message_index}-${aIndex}-href`}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    style={{ color: 'inherit', textDecoration: 'underline' }}>
                                    <AttachmentIcon />
                                  </a>
                                ))}
                              </Box>
                            }
                            <Box display='flex'
                              key={`options_r5_${message_index}`}
                              flexDirection='row'
                              style={this_message.attachments ? { marginBottom: '8px', marginTop: '8px' } : {}}
                            >
                              {(this_message.inOut !== 'in') &&
                                (reactData.expanded_composite_key !== this_message.composite_key ?
                                  <ExpandMoreIcon
                                    onClick={async () => {
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
                                    }}
                                  />
                                  :
                                  <ExpandLessIcon
                                    onClick={() => {
                                      updateReactData({
                                        expanded_composite_key: false
                                      }, true);
                                    }}
                                  />
                                )
                              }
                              {(message_index === 0) &&
                                !reactData.viewOnly &&
                                <React.Fragment>
                                  <ReplyIcon
                                    onClick={async () => {
                                      let newMessageRecipients = [];
                                      let replyToList = [];
                                      if (this_message.inOut === 'held') {
                                        newMessageRecipients.push({ person_id: this_message.author_id, person_name: this_message.author_name });
                                      }
                                      else {
                                        for (let this_person of this_message.partner_id) {
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
                                        newMessageMode: true
                                      }, true);
                                    }}
                                  />
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
                                        await initialize();
                                      }}
                                    />
                                  }
                                </React.Fragment>
                              }
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  )
                ))
              ))}
            </Paper>
          }
          {(Object.keys(reactData.threads).length === 0) &&
            <Box display='flex' flex={4} justifyContent='center' alignItems='flex-start' overflow='hidden'>
              <Typography style={AVATextStyle({ size: 1.5, bold: true, align: 'center', margin: { top: 3 } })} >
                {(reactData.lastReloadTime === 0) ? `Loading!  Please wait...` : `You don't have any message activity yet!`}
              </Typography>
            </Box>
          }
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
                        html_message: (templateObj.template_type === 'html')
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
                withGroups: true,
                restrictGroups: state.session.client_style.restrict_groups,
                withPreferred: true,
                buttonColor: (reactData.selections.length === 0) ? 'red' : 'green',
                buttonText: searchButtonText(),
                showAll: true,
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
          {reactData.showReplyToSearch &&
            <QuickSearch
              reactData={reactData}
              updateReactData={updateReactData}
              options={{
                pickAndGo: true,
                keepSelections: true,
                buttonColor: (reactData.selections.length === 0) ? 'red' : 'green',
                buttonText:
                  (reactData.selections.length === 0)
                    ? 'Exit'
                    : ((reactData.selections.length === 1)
                      ? `Reply to ${reactData.selections[0].person_name ? reactData.selections[0].person_name.split(' ')[0] : ''}`
                      : `Reply to ${reactData.selections.length} people`
                    ),
                showAll: true,
                title: 'Select additional people to reply to'
              }}
              onClose={async (selections) => {
                updateReactData({
                  showReplyToSearch: false,
                  replyToList: selections || [],
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
                showAll: true,
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
                      style={{ backgroundColor: 'green', color: 'white' }}
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
        </React.Fragment >
      }
    </Dialog >
  );
};