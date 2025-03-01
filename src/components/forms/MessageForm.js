import React from 'react';
import { useSnackbar } from 'notistack';
import { getImage, getPerson, makeName } from '../../util/AVAPeople';
import { messageHistory } from '../../util/AVAMessages';
import { extract, dbClient, titleCase, listFromArray, cl, uuid } from '../../util/AVAUtilities';
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

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const [message_filter, setMessageFilter] = React.useState('');
  const [message_filter_lower, setMessageFilterLower] = React.useState('');
  const [singleFilterDigit, setSingleFilterDigit] = React.useState(false);

  const [messageList, setMessageList] = React.useState(pMessageList);
  const [personFilter, setPersonFilter] = React.useState(false);
  const [messageResults, setMessageResults] = React.useState();
  const [deletePending, setDeletePending] = React.useState(false);
  const showDeleted = false;
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const [confirmID, setConfirmID] = React.useState('');
  const [confirmIndex, setConfirmIndex] = React.useState('');
  const [open, setOpen] = React.useState([]);

  const placeholderImage =
    'https://theseus-medical-storage.s3.amazonaws.com/public/patients/tboone.jpg';


  const [reactData, setReactData] = React.useState({
    statusMessage: false,
    window_width: window.window.innerWidth,
    isSmall: (window.window.innerWidth < 800),
    isTiny: (window.window.innerWidth < 500),
    lastActiveTime: new Date(),
    lastReloadTime: 0,
    forceReloadTime: 0,
    idleState: false,
    newMessageMode: (options && options.newMessage) || false,
    viewPeopleMaintenance: false,
    myImage: null,
    myName: null,
    selections: [],    // wip selections from quick search
    selectedPeople_count: 0,
    selectedPeople_list: [],
    newMessageRecipients: ((options && options.newMessage && options.recipients) ? options.recipients : []),
    alert: false,
    showGroupList: false,
    showIndividualList: false,
    showPreferredList: true,
    warning: false,
    preferred_recipients: [],
    newUrgentMessage: false,
    replyToList: [{ person_id: pPerson, person_name: 'Me' }],
    newMessageText: ((options && options.newMessage && options.messageText) ? options.messageText : ''),
    newMessageSubject: ((options && options.newMessage && options.subject) ? options.subject : ''),
    newMessageThread: false,
    attachments_to_send: ((options && options.newMessage && options.attachmentList) ? options.attachmentList : []),
    linkedPersonFilter: '',
  });

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };



  const onImageError = (e) => {
    e.target.src = placeholderImage;
  };

  const messageStyle = (this_item, index) => {
    if ((index === 0) || (this_item.thread_id !== messageList[index - 1].thread_id)) {
      return AVATextStyle({ size: 1 });
    }
    else {
      return AVATextStyle({ size: 0.8 });
    }
  };

  if (defaultValue) {
    if (Array.isArray(defaultValue)) {
      defaultValue = defaultValue[0];
    }
  }

  const [rowLimit, setRowLimit] = React.useState(20);
  const scrollValue = 20;
  var rowsWritten;

  const { enqueueSnackbar } = useSnackbar();

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

  function makeSubject(pContent) {
    if (pContent) {
      if (pContent.startsWith('Message from')) {
        return titleCase(pContent.replace('Message from', 'Conversation originated by'));
      }
      return pContent.slice(0, 1).toUpperCase() + pContent.slice(1);
      /*
      let lContent = pContent.toLowerCase().trim().split(/[^a-zA-Z0-9 ']+/);
      return (lContent[0] || lContent[1]).split(/[ ]+/g).map(w => { return (w.charAt(0).toUpperCase() + w.substring(1)); }).join(' ');
      */
    }
    else { return 'AVA Message'; }
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

  const handleChangeMessageFilter = event => {
    if (event.target.value.length === 0) {
      setMessageFilter(null);
      setMessageFilterLower(null);
    }
    else {
      setMessageFilter(event.target.value);
      setMessageFilterLower(event.target.value.toLowerCase());
      setSingleFilterDigit(event.target.value.length === 1);
    }
    setRowLimit(scrollValue);
  };

  const handleRemoveMessage = async (pMessage_id, pIndex) => {
    await dbClient
      .update({
        Key: {
          thread_id: pMessage_id.split('~')[0].slice(2),
          composite_key: pMessage_id
        },
        UpdateExpression: 'set delete_flag = :t',
        ExpressionAttributeValues: {
          ':t': true
        },
        TableName: "TheseusMessages",
      })
      .promise()
      .catch(error => {
        enqueueSnackbar(`AVA couldn't delete that message.  Error is ${error}`,
          { variant: 'error', persist: true }
        );
        return;
      });
    let tempMessageList = messageList;
    tempMessageList.splice(pIndex, 1);
    setMessageList(tempMessageList);
    let workingOpen = open;
    workingOpen.splice(pIndex, 1);
    setOpen(workingOpen);
    setForceRedisplay(!forceRedisplay);
    return tempMessageList;
  };

  async function getMessageResults({ this_item }) {
    let gotHistory = await messageHistory({
      thread_id: this_item.common_key.split('~M')[0].slice(2),
      composite_key: this_item.common_key.split('~D')[0],
      record_type: 'delivery',
      in_out: this_item.inOut,
      was_held: this_item.wasHeld,
      returnObject: true
    });
    if (this_item.inOut === 'in') {
      return { [pPerson]: gotHistory[pPerson] };
    }
    else {
      return gotHistory;
    }
  };

  const onScroll = event => {
    if (rowLimit < messageList.length) {
      setRowLimit(rowLimit + scrollValue);
      setForceRedisplay(!forceRedisplay);
    }
  };

  const toggleOpen = async ({ index, this_item }) => {
    let workingOpen = [];
    if (!open[index]) {
      workingOpen[index] = true;
      let results = await getMessageResults({ this_item });
      if (this_item.wasHeld) {
        let ogMsgRec = await dbClient
          .get({
            Key: {
              thread_id: this_item.thread_id,
              composite_key: this_item.held_messageKey,
            },
            TableName: 'TheseusMessages'
          })
          .promise()
          .catch(error => {
            cl({ 'Error reading TheseusMessages': error });
          });
        console.log(ogMsgRec.Item);
        let ogCount = Object.keys(ogMsgRec.Item.recipient_list).length;
        results[this_item.person_id].history.push({
          time: this_item.wasHeld,
          line: `Message was sent ${(ogCount > 1) ? 'to ' + ogCount + ' people ' : ''}${makeDate(this_item.wasHeld).oaDate} but held per rule`
        });
      }
      setMessageResults(results);
    }
    setOpen(workingOpen);
    setForceRedisplay(!forceRedisplay);
  };

  function filteredMessage(pMessageRec, pFilter) {
    if (singleFilterDigit) { return true; }
    else {
      let searchString = [pMessageRec.message_text, pMessageRec.sender_name, pMessageRec.sender_id].join(' ');
      return searchString.toLowerCase().includes(message_filter_lower);
    }
  }

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
      : [pPerson];
    let recipient_key = [];
    reactData.newMessageRecipients.forEach(r => {
      if (r.person_id) { recipient_key.push(...([r.person_id].flat())); }
      else if (r.group_id) { recipient_key.push(`GRP:${r.group_id}`); }
      else if (r.rIndex) {
        recipient_key.push(...reactData.preferred_recipients[r.rIndex].personList);
      }
    });
    reply_to.forEach(r => {    // this makes sure that everyone on the reply_to list is copied on the original message
      if ((r !== pPerson) && !recipient_key.includes(r)) {
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
        from: pPerson,
        message_text: reactData.newMessageText,
        patient_id: pPerson,
        preferred_method: (reactData.newUrgentMessage ? 'urgent' : null),
        recipient_base: 'list',
        recipient_key,
        subject: reactData.newMessageSubject || `Message from ${await makeName(pPerson)}`,
        reply_to
      },
      TableName: 'PostOffice'
    };
    let goodPost = true;
    await dbClient
      .put(PostOfficeRec)
      .promise()
      .catch(error => {
        cl(`Error writing to Post Office; error is ${error}`);
        goodPost = false;
      });
    if (goodPost) {
      const recipientMessageText = `${listFromArray(((reactData.newMessageRecipients.length > 0)
        ? reactData.newMessageRecipients
        : reactData.selections)
        .map(r => (r.person_name || r.group_name || reactData.preferred_recipients[r.rIndex].objText)),
        { max: { length: 4, words: 'recipients' } })}`;
      updateReactData({
        newMessageMode: false,
        selections: [],    // wip selections from quick search
        newMessageSubject: '',
        newMessageRecipients: [],
        newUrgentMessage: false,
        replyToList: [{ person_id: pPerson, person_name: 'Me' }],
        newMessageText: '',
        newMessageThread: false,
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

  async function initialize() {
    let messageArray = [];
    let messageMethods = {};
    let totalInboundProcessed = 0;
    let totalInboundCount = 0;
    let totalOutboundCount = 0;
    let totalOutboundProcessed = 0;
    // my Image
    updateReactData({
      myImage: await getImage(pPerson),
      myName: await makeName(pPerson)
    }, true);
    // Get messages to me
    let mRecs = await dbClient
      .query({
        KeyConditionExpression: 'deliver_to = :p',
        FilterExpression: 'delete_flag <> :true',
        ExpressionAttributeValues: {
          ':p': pPerson,
          ':true': true
        },
        TableName: "TheseusMessages",
        IndexName: 'deliver_to-index',
        ScanIndexForward: false,
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
        }
        console.log({ 'Error reading Messages': error });
      });
    if (mRecs && mRecs.hasOwnProperty('Items')) {
      totalInboundCount += mRecs.Count;
      for (let x = 0; x < mRecs.Items.length; x++) {
        totalInboundProcessed++;
        let m = mRecs.Items[x];
        if (m.author.author_id === pPerson) {
          continue;
        }
        // let language = m.language || 'EN-US';
        let language = 'EN-US';
        let this_image = await getImage(m.author.author_id);
        if (m.author.author_name === 'AVA notifications') {
          let sRec = await getPerson(m.author.author_id);
          if (sRec && sRec.name) {
            m.author.author_name = `${sRec.name.first} ${sRec.name.last}`;
          }
        }
        // convert inline link to an attachment by extracting all text after (and including http:)
        let hLink = extract(m.content.current[language].text, 'http', ' ', {
          fuzzyRight: true,  // allow end-of-string as a right delimeter 
          includeLeft: true,  // return the left delimeter
        });
        if (hLink) {
          if (!m.content.current.attachments) { m.content.current.attachments = []; }
          m.content.current.attachments.push(hLink);
          m.content.current[language].text = m.content.current[language].text.replace(hLink, '');
        }
        let deliver_method = (m.deliver_method === 'email')
          ? 'email'
          : ((m.deliver_method === 'sms')
            ? 'text'
            : ((m.deliver_method === 'voice') ? 'phone' : 'ava')
          );
        let message_key = m.composite_key.split('~D')[0];
        if (messageMethods.hasOwnProperty(message_key)) {
          messageMethods[message_key].push(deliver_method);
        }
        else {
          messageMethods[message_key] = [deliver_method];
          let this_message = {
            inOut: 'in',
            delete_flag: m.delete_flag,
            person_id: m.deliver_to,
            patient_name: m.author.author_name,
            sender_name: m.author.author_name,
            sender_id: m.author.author_id,
            partner_id: [m.author.author_id],
            sender_image: this_image,
            message_id: m.composite_key,
            deliver_method,
            posted_time: m.created_time,
            deliver_time: m.created_time,
            common_key: m.composite_key,
            replyToList: m.reply_to,
            message_content: m.content.current[language].text,
            attachments: m.content.current.attachments,
            subject: m.subject_line,
            message_text: m.content.current[language].text,
            thread_id: m.thread_id,
            allowReplyAll: (m.allowReplyAll || false)
          };

          this_message.toLine = `${m.author.author_name} -> Me`;
          this_message.target = pPerson;

          messageArray.push(this_message);
          if ((x % 100) === 0) {
            // put everything in reverse chronological order
            let presorted = messageArray.sort((a, b) => {
              return ((a.deliver_time > b.deliver_time) ? -1 : 1);
            });
            let finalSort = [];
            let skipMe = [];
            presorted.forEach((this_message, mNdx) => {
              const message_key = presorted[mNdx].common_key.split('~D')[0];
              this_message.deliver_method = listFromArray(messageMethods[message_key]);
              // this clumps all the same thread_ids together behind the most recent one
              if (!skipMe.includes(this_message.thread_id)) {
                finalSort.push(this_message);   // this is the message on the thread that was most recent
                skipMe.push(this_message.thread_id);   // dont process this thread again in the main loop
                for (let n = mNdx + 1; n < presorted.length; n++) {
                  if (presorted[n].thread_id === this_message.thread_id) {
                    if (presorted[n].common_key.endsWith('hold')) {
                      finalSort[finalSort.length - 1].wasHeld = presorted[n].posted_time;
                      finalSort[finalSort.length - 1].held_messageKey = presorted[n].common_key.split('~D')[0];
                    }
                    else {
                      finalSort.push(presorted[n]);
                    }
                  }
                }
              }
            });
            updateReactData({
              statusMessage: `Processing inbound - ${totalInboundProcessed} of ${totalInboundCount}`
            }, false);
            setMessageList(finalSort);
            console.log(`Processing inbound - ${totalInboundProcessed} of ${totalInboundCount}`);
          }
        }
      };
      let presorted = messageArray.sort((a, b) => {
        return ((a.deliver_time > b.deliver_time) ? -1 : 1);
      });
      let finalSort = [];
      let skipMe = [];
      presorted.forEach((this_message, mNdx) => {
        // this clumps all the same thread_ids together behind the most recent one
        if (!skipMe.includes(this_message.thread_id)) {
          finalSort.push(this_message);   // this is the message on the thread that was most recent
          skipMe.push(this_message.thread_id);  // dont process this thread again in the main loop
          for (let n = mNdx + 1; n < presorted.length; n++) {
            if (presorted[n].thread_id === this_message.thread_id) {
              if (presorted[n].common_key.endsWith('hold')) {
                finalSort[finalSort.length - 1].wasHeld = presorted[n].posted_time;
                finalSort[finalSort.length - 1].held_messageKey = presorted[n].common_key.split('~D')[0];
              }
              else {
                finalSort.push(presorted[n]);
              }
            }
          }
        }
      });
      updateReactData({
        statusMessage: `Processing outbound`
      }, false);
      setMessageList(finalSort);
    }
    // Get messages From me
    let outbound_threads = [];
    let queryObj = {
      KeyConditionExpression: 'sent_from = :p',
      FilterExpression: 'delete_flag <> :true AND record_type = :t',
      ExpressionAttributeValues: {
        ':p': pPerson,
        ':t': 'message',
        ':true': true
      },
      TableName: "TheseusMessages",
      IndexName: 'sent_from-index',
      ScanIndexForward: false,
    };
    let loopCount = 0;
    do {
      mRecs = await dbClient
        .query(queryObj)
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
          }
          console.log({ 'Error reading Messages': error });
        });
      if (mRecs && mRecs.hasOwnProperty('Items')) {
        totalOutboundCount += mRecs.Count;
        for (let x = 0; x < mRecs.Items.length; x++) {
          totalOutboundProcessed++;
          let m = mRecs.Items[x];
          // let language = m.language || 'EN-US';
          let language = 'EN-US';
          // convert inline link to an attachment
          let hLink;
          if (m.content.current[language].hasOwnProperty('text') && m.content.current[language].text) {
            hLink = extract(m.content.current[language].text, 'http', ' ', {
              fuzzyRight: true,  // allow end-of-string as a right delimeter 
              includeLeft: true,  // return the left delimeter
            });
          }
          else { continue; }
          if (hLink) {
            if (!m.content.current.attachments) { m.content.current.attachments = []; }
            m.content.current.attachments.push(hLink);
            m.content.current[language].text = m.content.current[language].text.replace(hLink, '');
          }
          // is this another message with the same thread_id AND the same message text?
          // if so, and this recipient_list to the previous one(s)
          const foundAt = outbound_threads.findIndex(t => {
            return ((t.thread_id === m.thread_id) && (t.message_text === m.content.current[language].text));
          });
          let this_message;
          let message_index;
          if (foundAt === -1) {
            message_index = messageArray.length;
            outbound_threads.push({
              index: message_index,
              thread_id: m.thread_id,
              message_text: m.content.current[language].text
            });
            this_message = {
              inOut: 'out',
              delete_flag: m.delete_flag,
              person_id: m.deliver_to,
              patient_name: m.author.author_name,
              sender_name: m.author.author_name,
              sender_id: m.author.author_id,
              message_id: m.composite_key,
              posted_time: m.created_time,
              deliver_time: m.created_time,
              common_key: m.composite_key,
              thread_id: m.thread_id,
              replyToList: m.reply_to,
              recipientList: m.recipient_list,
              message_content: m.content.current[language].text,
              attachments: m.content.current.attachments,
              subject: m.subject_line,
              message_text: m.content.current[language].text
            };
          }
          else {
            message_index = outbound_threads[foundAt].index;
            messageArray[message_index].recipientList = Object.assign({},
              messageArray[message_index].recipientList,
              m.recipient_list
            );
            messageArray[message_index].posted_time = Math.min(m.created_time, messageArray[message_index].posted_time);
            this_message = messageArray[message_index];
          }
          let methodList = {};
          for (let address of Object.keys(this_message.recipientList)) {
            const aType = address.split('.')[1];
            let a2Type = aType.includes('email')
              ? 'email'
              : ((aType === 'sms')
                ? 'text'
                : ((aType === 'voice') ? 'phone' : 'ava')
              );
            if (!methodList.hasOwnProperty(a2Type)) {
              methodList[a2Type] = 1;
            }
            else {
              methodList[a2Type]++;
            }
          }
          let rArray = [];
          Object.keys(this_message.recipientList).forEach(r => {
            const p = r.split('.')[0];
            if (!rArray.includes(p) && (p !== pPerson)) {
              rArray.push(p);
            }
          });
          this_message.partner_id = rArray;
          this_message.deliver_method = listFromArray(Object.keys(methodList)).toLowerCase();

          this_message.toLine = `Me -> `;

          if (rArray.length === 1) {
            const this_recipient = Object.values(m.recipient_list)[0];
            this_message.sender_image = await getImage(rArray[0]);
            this_message.toLine += (`${this_recipient.name.first} ${this_recipient.name.last}`).trim();
            this_message.target = rArray;
          }
          else if ((rArray.length === 0) && (Object.keys(this_message.recipientList).length > 0)) {
            this_message.toLine += `Myself only`;
            this_message.target = [pPerson];
            this_message.sender_image = '';
          }
          else {
            this_message.toLine += `${rArray.length} people`;
            this_message.target = rArray;
            this_message.sender_image = '';
          }
          messageArray[message_index] = this_message;
        };
        let presorted = messageArray.sort((a, b) => {
          return ((a.deliver_time > b.deliver_time) ? -1 : 1);
        });
        let finalSort = [];
        let skipMe = [];
        presorted.forEach((this_message, mNdx) => {
          // this clumps all the same thread_ids together behind the most recent one
          if (!skipMe.includes(this_message.thread_id)) {
            finalSort.push(this_message);  // this is the message on the thread that was most recent
            skipMe.push(this_message.thread_id);   // dont process this thread again in the main loop
            for (let n = mNdx + 1; n < presorted.length; n++) {
              if (presorted[n].thread_id === this_message.thread_id) {
                if (presorted[n].common_key.endsWith('hold')) {
                  finalSort[finalSort.length - 1].wasHeld = presorted[n].posted_time;
                  finalSort[finalSort.length - 1].held_messageKey = presorted[n].common_key.split('~D')[0];
                }
                else {
                  finalSort.push(presorted[n]);
                }
              }
            }
          }
        });
        updateReactData({
          statusMessage: `Processing outbound - ${totalOutboundProcessed} of ${totalOutboundCount}`
        }, false);
        setMessageList(finalSort);
        if (mRecs.LastEvaluatedKey) {
          queryObj.ExclusiveStartKey = mRecs.LastEvaluatedKey;
        }
        else {
          delete queryObj.ExclusiveStartKey;
        }
      }
      else {
        delete queryObj.ExclusiveStartKey;
      }
      loopCount++;
    } while (queryObj.ExclusiveStartKey && (loopCount < 10));
    start();  // idle timer
    updateReactData({
      lastReloadTime: new Date(),
      lastActiveTime: new Date(),
      forceReloadTime: 0,
      idleState: false,
      statusMessage: false
    }, true);
  }

  React.useEffect(() => {
    initialize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pPerson, pClient]);  // eslint-disable-line react-hooks/exhaustive-deps


  // ******************

  return (
    <Dialog
      open={true || forceRedisplay}
      onScroll={onScroll}
      p={2}
      fullScreen
    >
      {(messageList || reactData.newMessageMode) &&
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
                value={message_filter}
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
            <Paper component={Box} className={classes.newMessagePage} variant='outlined' overflow='auto' square>
              <Box key={'newMessage_frag'}
                marginLeft={'16px'}
                marginRight={'16px'}
                borderRadius={'30px'}
                border={2}
                borderColor={reactData.newUrgentMessage ? 'red' : 'black'}
              >
                <Box display='flex' flexDirection='column'>
                  <Box
                    display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                    key={'newMessage_r'}
                    className={classes.listItem}
                  >
                    <Box display='flex'
                      key={'newMessage_r2'}
                      flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'>
                      <Box display='flex'
                        key={'newMessage_c'}
                        flexDirection='column'
                        marginRight={'16px'}
                        style={{ flexGrow: 1 }}
                        justifyContent={'center'}
                      >
                        <Box display='flex'
                          key={'newMessage_r3'}
                          flexDirection='row'>
                          <Box display='flex'
                            key={'newMessage_c2'}
                            flexDirection='column'
                            style={{
                              flexGrow: 1
                            }}
                          >
                            <Box display='flex'
                              key={'newMessage_r4'}
                              flexDirection='row'
                              justifyContent={'space-between'}
                            >
                              <Box display='flex'
                                key={'newMessage_c2a'}
                                flexDirection='row'
                                style={{
                                  flexGrow: 1
                                }}
                              >
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
                                            linkedPersonFilter: '',
                                            showQuickSearch: true,
                                            selections: reactData.newMessageRecipients
                                          }, true);
                                        }}
                                      >
                                        <Typography
                                          style={AVATextStyle({ size: 1, bold: true })}
                                          key={`showNames__${reactData.newMessageRecipients.length + reactData.selections.length}`}
                                        >
                                          {((reactData.newMessageRecipients.length > 4) || ((reactData.selections.length > 4) && !reactData.showReplyToSearch))
                                            ? (`Me -> ${reactData.selectedPeople_count || reactData.selections.length} recipients`)
                                            : ((reactData.newMessageRecipients.length > 0) || ((reactData.selections.length > 0) && !reactData.showReplyToSearch))
                                              ? `Me -> ${listFromArray(((reactData.newMessageRecipients.length > 0)
                                                ? reactData.newMessageRecipients
                                                : reactData.selections)
                                                .map(r => (r.person_name || r.group_name || reactData.preferred_recipients[r.rIndex].objText)),
                                                { max: { length: 4, words: 'recipients' } })}`
                                              : 'Me ->'
                                          }
                                        </Typography>
                                        <Typography
                                          style={Object.assign({}, { display: 'flex', textWrap: 'nowrap', alignSelf: 'flex-end' }, AVATextStyle({ margin: { left: 1 }, size: 0.8 }))}
                                        >
                                          {(!(reactData.newMessageRecipients.length === 0) && (!reactData.selections || reactData.showReplyToSearch))
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
                                      <React.Fragment>
                                        <TextField
                                          id='Message_subject_new'
                                          multiline
                                          autoComplete='off'
                                          style={AVATextStyle({ size: 1.2, bold: true })}
                                          onChange={async (event) => {
                                            updateReactData({
                                              newMessageSubject: event.target.value
                                            }, true);
                                          }}
                                          defaultValue={reactData.newMessageSubject}
                                          helperText={'Subject'}
                                        />
                                      </React.Fragment>

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
                                  <TextField
                                    id='MessageText_new'
                                    multiline
                                    autoComplete='off'
                                    style={AVATextStyle({ size: 1.2, bold: true })}
                                    onBlur={async (event) => {
                                      let reactUpdObj = {
                                        newMessageText: event.target.value
                                      };
                                      if (event.target.value.length > 500) {
                                        reactUpdObj.warning = true;
                                        reactUpdObj.alert = {
                                          severity: 'warning',
                                          title: 'Message length',
                                          message: <div>Your message is {event.target.value.length.toLocaleString('en-US')} characters long.<br />
                                            Some text messaging networks limit message size to 500 characters.<br />
                                            You may send the message as is.  If you choose to do that, we will break the message into {Math.floor(event.target.value.length / 500) + 1} parts and send each part as a separate message for text message recipients.
                                            (All other recipients will receive the message as entered.)</div>,
                                        };
                                      }
                                      updateReactData(reactUpdObj, true);
                                    }}
                                    defaultValue={reactData.newMessageText}
                                    helperText={'Message Text'}
                                  />
                                </Box>
                              </Box>
                            </Box>

                          </Box>


                        </Box>

                        <Box display='flex'
                          key={'newMessage_rNewBottom'}
                          flexDirection='row'>
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
                              disabled={(reactData.newMessageText.length === 0) || (reactData.newMessageRecipients.length === 0)}
                              onClick={async () => {
                                if (!reactData.warning) {
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
                                  linkedPersonFilter: '',
                                  showReplyToSearch: true,
                                  selections: reactData.replyToList
                                }, true);
                              }}
                            >
                              {((reactData.replyToList.length > 0) || ((reactData.selections.length > 0) && !reactData.showQuickSearch))
                                ? `Reply to: ${listFromArray(((reactData.replyToList.length > 0)
                                  ? reactData.replyToList
                                  : reactData.selections).map(r => r.person_name),
                                  { max: { length: 2, words: 'people' } })}`
                                : 'Reply to: Me'
                              }
                            </Typography>
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
                          </Box>
                        </Box>

                      </Box>
                      <DeleteIcon
                        onClick={() => {
                          updateReactData({
                            newMessageRecipients: [],
                            replyToList: [{ person_id: pPerson, person_name: 'Me' }],
                            newMessageMode: false
                          }, true);
                        }}
                      />
                    </Box>

                  </Box>
                </Box>
              </Box>
            </Paper>
          }
          {(messageList.length > 0) &&
            <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
              <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                {rowsWritten = 0}
              </Typography>
              {messageList.map((this_item, index) => (
                ((rowsWritten <= rowLimit)
                  && ((!personFilter)
                    || (personFilter && (this_item.partner_id.includes(personFilter))))
                  && (!message_filter || filteredMessage(this_item, message_filter))
                  && (!this_item.delete_flag || showDeleted)
                  &&
                  <Box key={this_item.person_id + 'frag' + index}
                    borderTop={((index !== 0) && (this_item.thread_id !== messageList[index - 1].thread_id)) ? 2 : 0}
                    borderColor={'black'}
                    onContextMenu={async (e) => {
                      e.preventDefault();
                      console.log({ this_item });
                      console.log(reactData.window_width);
                    }}
                  >
                    <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                      {rowsWritten++}
                    </Typography>
                    <Box display='flex' flexDirection='column'>
                      <Box
                        display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                        key={this_item.message_id + 'r' + index}
                        className={classes.listItem}
                      >
                        <Box display='flex'
                          key={this_item.message_id + 'r2' + index}
                          maxWidth={(reactData.isTiny ? '80%' : null)}
                          flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'
                        >
                          <Box display='flex'
                            key={this_item.message_id + 'c' + index}
                            flexDirection='column'
                            style={{ flexGrow: 1 }}
                            justifyContent={'center'}
                          >
                            <Box display='flex'
                              key={this_item.message_id + 'r3' + index}
                              flexDirection='row'
                            >
                              <Box display='flex'
                                key={this_item.left + 'r3a' + index}
                                flexDirection='row'
                                minWidth={'65px'}
                              >
                                {((index === 0) || (this_item.thread_id !== messageList[index - 1].thread_id))
                                  &&
                                  <Box
                                    key={this_item.message_id + 'ibox' + index}
                                    style={{ alignSelf: 'anchor-center' }}
                                    onClick={() => {
                                      setPersonFilter(this_item.partner_id[0]);
                                    }}
                                  >
                                    <img
                                      key={this_item.message_id + 'i' + index}
                                      className={classes.imageArea}
                                      alt={''}
                                      onError={onImageError}
                                      src={this_item.sender_image}
                                    />
                                  </Box >
                                }
                              </Box>
                              <Box display='flex'
                                key={this_item.message_id + 'c2b' + index}
                                flexDirection='column'
                                style={{
                                  maxWidth: (reactData.isTiny ? '70%' : null),
                                  flexGrow: 1
                                }}
                              >
                                <Box display='flex'
                                  key={this_item.message_id + 'r5' + index}
                                  flexDirection='row'
                                  style={{
                                    flexGrow: 1
                                  }}
                                >
                                  <Box display='flex'
                                    key={this_item.message_id + 'c3' + index}
                                    flexDirection='column'
                                    style={{ flexGrow: 1 }}
                                  >
                                    {((index === 0) || (this_item.thread_id !== messageList[index - 1].thread_id)) &&
                                      <React.Fragment>
                                        <Typography
                                          style={AVATextStyle({ size: 1, bold: true })}
                                        >
                                          {makeSubject(this_item.subject || this_item.message_text)}
                                        </Typography>
                                      </React.Fragment>
                                    }
                                    <Typography
                                      style={AVATextStyle({ size: 0.8, bold: true })}
                                    >
                                      {this_item.toLine}
                                    </Typography>
                                    <Typography
                                      style={AVATextStyle({ size: 0.8 })}
                                    >
                                      {`${makeReadableTime(this_item.posted_time || this_item.deliver_time)} - via ${this_item.deliver_method}`}
                                    </Typography>
                                  </Box>
                                </Box>
                                <Typography key={`prefLine-text`}
                                  style={Object.assign({}, messageStyle(this_item, index), { overflowWrap: 'anywhere', overflowY: 'auto' })}
                                >
                                  {this_item.message_text}
                                </Typography>
                              </Box>
                            </Box>

                            {open[index] &&
                              <Box
                                marginLeft={'65px'}
                              >
                                <Typography
                                  key={`history header`}
                                  style={AVATextStyle({ size: 0.8, bold: true, margin: { top: 1 } })}
                                >
                                  {`Results`}
                                </Typography>
                                {messageResults && Object.keys(messageResults).sort((a, b) => {
                                  return (messageResults[a].name > messageResults[b].name) ? 1 : -1;
                                }).map((mObj, mIndex) => (
                                  mObj && messageResults[mObj] &&
                                  <React.Fragment key={`historyFrag-${mIndex}`}>
                                    {messageResults[mObj].history.sort((a, b) => {
                                      return (a.time > b.time) ? -1 : 1;
                                    }).map((h, x) => (
                                      <Typography
                                        key={`prefLine-${mIndex}__${x}`}
                                        style={AVATextStyle({ size: 0.8, margin: { left: 0 } })}
                                      >
                                        {h.line}
                                      </Typography>
                                    ))}
                                  </React.Fragment>
                                ))}
                                <Typography
                                  key={`thread_id`}
                                  style={AVATextStyle({ align: 'right', size: 0.6, margin: { top: 1 } })}
                                >
                                  {`(Message ID ${messageResults[Object.keys(messageResults)[0]].composite_key.split('~D')[0]})`}
                                </Typography>
                              </Box>
                            }
                          </Box>
                        </Box>
                        <Box display='flex'
                          key={`options_r4col_${index}`}
                          flexDirection='column'
                          alignItems='center'
                          style={{
                          }}
                        >
                          {this_item.attachments &&
                            <Box display='flex'
                              key={`attachments_${index}`}
                              flexDirection='row'
                              style={{ marginBottom: '8px', marginTop: '8px' }}
                            >
                              {this_item.attachments.map((aLine, aIndex) => (
                                <a
                                  href={aLine}
                                  key={`attach_${index}-${aIndex}-href`}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  style={{ color: 'inherit', textDecoration: 'underline' }}>
                                  <AttachmentIcon />
                                </a>
                              ))}
                            </Box>
                          }
                          <Box display='flex'
                            key={`options_r5_${index}`}
                            flexDirection='row'
                            style={this_item.attachments ? { marginBottom: '8px', marginTop: '8px' } : {}}
                          >
                            {!open[index] ?
                              <ExpandMoreIcon
                                onClick={() => { toggleOpen({ index, this_item }); }}
                              />
                              :
                              <ExpandLessIcon
                                onClick={() => { toggleOpen({ index, this_item }); }}
                              />}
                            {((index === 0) || (this_item.thread_id !== messageList[index - 1].thread_id)) &&
                              <React.Fragment>
                                <ReplyIcon
                                  onClick={async () => {
                                    let newMessageRecipients = [];
                                    let replyToList = [];
                                    if (this_item.replyToList && this_item.replyToList.some(p => { return p !== pPerson; })) {
                                      for (const this_recipient of this_item.replyToList) {
                                        newMessageRecipients.push({ person_id: this_recipient, person_name: await makeName(this_recipient) });
                                        replyToList.push({ person_id: this_recipient, person_name: await makeName(this_recipient) });
                                      }
                                    }
                                    else {
                                      for (let this_person of this_item.partner_id) {
                                        newMessageRecipients.push({ person_id: this_person, person_name: await makeName(this_person) });
                                      }
                                      replyToList = [{ person_id: pPerson, person_name: 'Me' }];
                                    }
                                    updateReactData({
                                      newMessageRecipients,
                                      replyToList,
                                      newMessageThread: this_item.thread_id,
                                      newMessageSubject: this_item.subject,
                                      newMessageMode: true
                                    }, true);
                                  }}
                                />
                                <DeleteIcon
                                  onClick={() => {
                                    setConfirmMessage(`Delete message from ${this_item.patient_name || this_item.sender_name}?`);
                                    setConfirmID(this_item.message_id);
                                    setConfirmIndex(index);
                                    setDeletePending(true);
                                    setForceRedisplay(false);
                                  }}
                                />
                              </React.Fragment>
                            }
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  </Box>
                )
              ))}
            </Paper>
          }
          {(messageList.length === 0) &&
            <Box display='flex' flex={4} justifyContent='center' alignItems='flex-start' overflow='hidden'>
              <Typography style={AVATextStyle({ size: 1.5, bold: true, align: 'center', margin: { top: 3 } })} >
                {(reactData.lastReloadTime === 0) ? `Loading!  Please wait...` : `You don't have any message activity yet!`}
              </Typography>
            </Box>
          }
          {
            deletePending &&
            <AVAConfirm
              promptText={confirmMessage}
              onCancel={() => {
                setDeletePending(false);
              }}
              onConfirm={() => {
                handleRemoveMessage(confirmID, confirmIndex);
                setDeletePending(false);
              }}
            >
            </AVAConfirm>
          }
          {
            reactData.getAttachment &&
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
          {reactData.showQuickSearch &&
            <QuickSearch
              reactData={reactData}
              updateReactData={updateReactData}
              options={{
                pickAndGo: true,
                keepSelections: true,
                withGroups: true,
                withPreferred: true,
                buttonColor: (reactData.selections.length === 0) ? 'red' : 'green',
                buttonText: searchButtonText(),
                showAll: true,
                title: 'Select Recipients'
              }}
              onClose={async (selections) => {
                updateReactData({
                  showQuickSearch: false,
                  newMessageRecipients: selections,
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
                      ? `Reply to ${reactData.selections[0].person_name.split(' ')[0]}`
                      : `Reply to ${reactData.selections.length} people`
                    ),
                showAll: true,
                title: 'Select additional people to reply to'
              }}
              onClose={async (selections) => {
                updateReactData({
                  showReplyToSearch: false,
                  replyToList: selections,
                  selections: []
                }, true);
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
                  <Button
                    onClick={async () => {
                      updateReactData({
                        showQuickSearch: true,
                        linkedPersonFilter: '',
                        newMessageMode: true,
                        newMessageSubject: '',
                        newMessageText: '',
                        newUrgentMessage: false,
                        newMessageRecipients: [],
                        replyToList: [{ person_id: pPerson, person_name: 'Me' }],
                        newMessageThread: false,
                      }, true);
                    }}
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'green', color: 'white' }}
                    size='small'
                    startIcon={<SendIcon size='small' />}
                  >
                    {`New Message`}
                  </Button>
                  {personFilter &&
                    <Button
                      onClick={async () => {
                        setPersonFilter(false);
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