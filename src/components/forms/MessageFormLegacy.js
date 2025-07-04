import React from 'react';
import { useSnackbar } from 'notistack';
import { getImage, getPerson, makeName } from '../../util/AVAPeople';
import { messageHistory, getMessages } from '../../util/AVAMessages';
import { extract, dbClient, lambda, isObject } from '../../util/AVAUtilities';
import { AVATextStyle } from '../../util/AVAStyles';

import List from '@material-ui/core/List';

import Collapse from '@material-ui/core/Collapse';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import CloseIcon from '@material-ui/icons/HighlightOff';
import { Switch } from '@material-ui/core';

import MarkunreadMailboxOutlinedIcon from '@material-ui/icons/MarkunreadMailboxOutlined';
import ContactMailOutlinedIcon from '@material-ui/icons/ContactMailOutlined';

import MakeMessage from './MakeMessage';

import Button from '@material-ui/core/Button';

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
import SendMessageDialog from '../dialogs/SendMessageDialog';

import { AVAclasses } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  page: {
    height: 950,
    maxWidth: 1000
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
    minWidth: '100px',
    maxWidth: '100px',
    minHeight: '100px',
    maxHeight: '100px',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
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

export default ({ pPerson, pClient, pMessageList, pSession, onReset, defaultValue }) => {

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const [message_filter, setMessageFilter] = React.useState('');
  const [message_filter_lower, setMessageFilterLower] = React.useState('');
  const [singleFilterDigit, setSingleFilterDigit] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [messageList, setMessageList] = React.useState(pMessageList);

  const [showAddPrompt, setShowAddPrompt] = React.useState(false);
  const [messageResults, setMessageResults] = React.useState();
  const [deletePending, setDeletePending] = React.useState(false);
  // const [showDeleted, setShowDeleted] = React.useState(false);
  const showDeleted = false;
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const [confirmID, setConfirmID] = React.useState('');
  const [confirmIndex, setConfirmIndex] = React.useState('');
  const [promptForMessage, setPromptForMessage] = React.useState('');
  const [recipient, setRecipient] = React.useState();
  const [recipientIndex, setRecipientIndex] = React.useState(-1);
  const [open, setOpen] = React.useState([]);

  let setDefault = 'in';
  if (defaultValue) {
    if (Array.isArray(defaultValue)) {
      defaultValue = defaultValue[0];
    }
    if (['sent', 'out'].includes(defaultValue)) { setDefault = 'out'; }
  }
  const [inOut_mode, setinOut] = React.useState(setDefault);

  const [rowLimit, setRowLimit] = React.useState(20);
  const scrollValue = 20;
  var rowsWritten;

  const { enqueueSnackbar } = useSnackbar();

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

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
      return pContent.slice(0, 1).toUpperCase() + pContent.slice(1);
      /*
      let lContent = pContent.toLowerCase().trim().split(/[^a-zA-Z0-9 ']+/);
      return (lContent[0] || lContent[1]).split(/[ ]+/g).map(w => { return (w.charAt(0).toUpperCase() + w.substring(1)); }).join(' ');
      */
    }
    else { return 'AVA Message'; }
  }

  async function replyAllList(pThreadID) {
    let threadHeaderRec = await getMessages({
      thread_id: pThreadID,
      type: 'message'
    });
    if (!threadHeaderRec || (threadHeaderRec.length === 0)) { return []; }
    let responseList = [];
    Object.values(threadHeaderRec[0].recipient_list).forEach(r => {
      let resp;
      if (r.name) { resp = (r.name.first + ' ' + r.name.last).trim(); }
      else { resp = r.destination; }
      resp += ':' + r.id;
      responseList.push(resp);
    });
    return responseList;
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

  async function getMessageResults(pCommonKey) {
    let requestBody = {
      thread_id: pCommonKey.split('~')[0].slice(2),
      composite_key: pCommonKey,
      record_type: 'delivery'
    };
    let returnArray = await messageHistory(requestBody);
    /*
    let mRecs = await dbClient
      .query({
        KeyConditionExpression: 'thread_id = :k AND begins_with(composite_key, :c)',
        FilterExpression: 'record_type = :t',
        ExpressionAttributeValues: {
          ':c': pCommonKey,
          ':k': pCommonKey.split('~')[0].slice(2),
          ':t': 'delivery'
        },
        TableName: "TheseusMessages",
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
      // let timeZones = ['UTC', 'UTC-1', 'UTC-2', 'UTC-3', 'America/New_York', 'America/New_York', 'America/Chicago'];
      // let timeZone = timeZones[-1 * (authorRec?.time_offset || -5)] || 'America/New_York';
      let timeZone = 'America/New_York';
      const oneMinute = 1000 * 60;
      const oneHour = 60 * oneMinute;
      let currentTime = new Date().getTime();
      let Time24HoursAgo = currentTime - (24 * oneHour);
      let Time7DaysAgo = currentTime - (7 * 24 * oneHour);
      mRecs.Items.forEach(mR => {
        let mTime = mR.posted_time;
        let mInfo = '';
        let mLine = `Sent to ${mR.recipient_list.name.first} ${mR.recipient_list.name.last}`;
        switch (mR.deliver_method) {
          case 'sms': {
            mLine += ' via text message';
            break;
          }
          case 'voice':
          case 'office': {
            mLine += ' via phone call';
            break;
          }
          case 'email': {
            mLine += ' via e-Mail';
            break;
          }
          case 'hold': {
            mLine += " held for later delivery per recipient's instructions";
            break;
          }
          default: { mLine += ` via ${mR.deliver_method}`; }
        }
        if (mR.results) {
          let mRLast = mR.results[0];
          mTime = mRLast.posted_time;
          switch (mRLast.result) {
            case 'reply': {
              mLine += '.  Reply received';
              mInfo = ` Reply is "${mRLast.update_contents.replace(':', ' -')}"`;
              break;
            }
            case 'submitted': {
              break;
            }
            case 'replyReceived': {
              mLine += '.  Reply received';
              break;
            }
            case 'delivered': {
              mLine += '.  Delivered';
              break;
            }
            case 'open': {
              mLine += '.  Opened';
              break;
            }
            default: {
              mLine += `. ${mRLast.result}`;
            }
          }
        }
 
        let mDateCheck = new Date(mTime);
        let mDate = '';
        if (mTime > Time24HoursAgo) {   // date within the last 24 hours?  Use Time only
          if ((mDateCheck.getHours() > new Date(currentTime).getHours())) {
            mDate = ' yesterday';
          }
        }
        else if (mTime > Time7DaysAgo) {  // date within the last 7 days?  Use Day of week ("Tue", "Sun", etc)
          let mWord = 'on';
          if ((mDateCheck.getDay() % 6 !== 0) && (mDateCheck.getDay() > new Date().getDay())) {
            mWord = 'last';
          }
          mDate = ` ${mWord} ${mDateCheck.toLocaleString([], { timeZone: timeZone, weekday: 'short' })}`;
        }
        else {
          mDate = ` on ${mDateCheck.toLocaleString([], { timeZone: timeZone, month: 'short', day: 'numeric' })}`;
        }
        mLine += `${mDate} at ${mDateCheck.toLocaleString([], { timeZone: timeZone, hour: 'numeric', minute: '2-digit' })}`;
        mLine += mInfo;
        returnArray.push(mLine);
      });
    */
    return ['~~~', 'Results:', ...returnArray];
  };

  async function getReceiptDetails(pCommonKey) {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:MessageMaintenance';
    params.Payload = JSON.stringify({
      action: "receipt_results",
      clientId: pClient,
      request: {
        "common_key": pCommonKey,
        "person_id": pPerson
      }
    });
    let invokeFailed = false;
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let returnData = JSON.parse(fResp.Payload);
      if (returnData.status === 200) {
        if (returnData.body.length > 0) {
          return ['~~~', 'Results:', ...returnData.body];
        }
      }
    }
    return [];
  };

  const onScroll = event => {
    if (rowLimit < messageList.length) {
      setRowLimit(rowLimit + scrollValue);
      setForceRedisplay(!forceRedisplay);
    }
  };

  const toggleOpen = async (pIndex, pMessageID) => {
    let workingOpen = [];
    if (!open[pIndex]) {
      workingOpen[pIndex] = true;
      if (inOut_mode === 'in') { setMessageResults(await getReceiptDetails(pMessageID)); }
      else { setMessageResults(await getMessageResults(pMessageID)); }
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

  function attachmentName(a) {
    if (isObject(a)) {
      a = a.Location;
    }
    let fNArr = a.split('/').pop().split('.');
    fNArr.pop();
    return decodeURI(fNArr.join('.'));
  }

  React.useEffect(() => {
    async function initialize() {
      let messageArray = [];
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
          Limit: 20
        })
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
          }
          console.log({ 'Error reading Messages': error });
        });
      if (mRecs && mRecs.hasOwnProperty('Items')) {
        for (let x = 0; x < mRecs.Items.length; x++) {
          let m = mRecs.Items[x];
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
          if (!m.content.current.hasOwnProperty(language)) {
            language = Object.keys(m.content.current)[0];
          }
          let hLink = extract(m.content.current[language].text, 'http', ' ', {
            fuzzyRight: true,  // allow end-of-string as a right delimeter 
            includeLeft: true,  // return the left delimeter
          });
          if (hLink) {
            if (!m.content.current.attachments) { m.content.current.attachments = []; }
            m.content.current.attachments.push(hLink);
            m.content.current[language].text = m.content.current[language].text.replace(hLink, '');
          }
          let this_message = {
            inOut: 'in',
            delete_flag: m.delete_flag,
            person_id: m.deliver_to,
            patient_name: m.author.author_name,
            sender_name: m.author.author_name,
            sender_id: m.author.author_id,
            sender_image: this_image,
            message_id: m.composite_key,
            posted_time: m.created_time,
            deliver_time: m.created_time,
            common_key: m.composite_key,
            message_content: m.content.current[language].text,
            attachments: m.content.current.attachments,
            subject: m.subject_line,
            message_text: m.content.current[language].text,
            thread_id: m.thread_id,
            allowReplyAll: (m.allowReplyAll || false)
          };
          messageArray.push(this_message);
        };
      }
      // Get messages From me
      mRecs = await dbClient
        .query({
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
        })
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
          }
          console.log({ 'Error reading Messages': error });
        });
      if (mRecs && mRecs.hasOwnProperty('Items')) {
        for (let x = 0; x < mRecs.Items.length; x++) {
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
          let this_message = {
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
            message_content: m.content.current[language].text,
            attachments: m.content.current.attachments,
            subject: m.subject_line,
            message_text: m.content.current[language].text
          };
          let rArray = Object.keys(m.recipient_list);
          if (rArray.length === 1) {
            this_message.sender_image = await getImage(m.recipient_list[rArray[0]].id);
            this_message.toLine = (`${m.recipient_list[rArray[0]].name.first} ${m.recipient_list[rArray[0]].name.last}`).trim();
          }
          else {
            let random = Math.floor(Math.random() * rArray.length);
            let randomName = await makeName(m.recipient_list[rArray[random]].id);
            this_message.toLine = `${rArray.length} people, including ${randomName}`;
            this_message.sender_image = await getImage(m.recipient_list[rArray[random]].id);
          }
          messageArray.push(this_message);
        };
      }
      setMessageList(messageArray);
    }
    initialize();
  }, [pPerson, pClient]);  // eslint-disable-line react-hooks/exhaustive-deps


  // ******************

  return (
    <Dialog
      open={true || forceRedisplay}
      onScroll={onScroll}
      p={2}
      fullScreen
    >
      {messageList &&
        <React.Fragment>
          <Box display='flex' flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'>
            <DialogContentText
              className={classes.title}
              id='scroll-dialog-title'
            >
              Recent Messages {inOut_mode === 'out' ? 'from me to others' : 'sent to me'}
            </DialogContentText>
            <Box display='flex' alignItems='center'
              justifyContent='flex-start' marginTop={4} marginRight={1.5}  marginBottom={1} flexDirection='row'
            >
              <Switch
                checked={false}
                onClick={async (event) => {
                  await dbClient
                    .update({
                      Key: {
                        person_id: pPerson,
                      },
                      UpdateExpression: 'set #c = :c',
                      ExpressionAttributeValues: {
                        ':c': true
                      },
                      ExpressionAttributeNames: {
                        '#c': 'useNewMessaging'
                      },
                      TableName: "People",
                    })
                    .promise()
                    .catch(error => {
                      console.log(`caught error updating People; error is: `, error);
                    });
                  onReset('restart');
                }}
                name="MessagingStyle"
                color="primary"
              />
              <Typography
                style={AVATextStyle({
                  size: 0.8, margin: { left: 0 },
                })}
              >
                {'Use New'}
              </Typography>
            </Box>
          </Box>
          <TextField
            id='List Filter'
            value={message_filter}
            onChange={handleChangeMessageFilter}
            className={classes.freeInput}
            label={'Filter/Search'}
            variant={'standard'}
            autoComplete='off'
          />
          {(messageList.length > 0) &&
            <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
              <List  >
                <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                  {rowsWritten = 0}
                </Typography>
                {messageList.map((this_item, index) => (
                  ((rowsWritten <= rowLimit)
                    && (this_item.inOut === inOut_mode)
                    && (!message_filter || filteredMessage(this_item, message_filter))
                    && (!this_item.delete_flag || showDeleted) ?
                    <Paper component={Box} variant='outlined' key={this_item.person_id + 'frag' + index} >
                      <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                        {rowsWritten++}
                      </Typography>
                      <Box display='flex' flexDirection='column'>
                        <Box
                          display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                          key={this_item.message_id + 'r' + index}
                          className={classes.listItem}
                          onClick={() => { toggleOpen(index, this_item.common_key); }}
                        >
                          <Box display='flex' flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'>
                            {(inOut_mode === 'in') &&
                              <Box display='flex' flexDirection='column'>
                                <Box display='flex' flexDirection='row'>
                                  <Box
                                    className={classes.imageArea}
                                    component="img"
                                    alt={''}
                                    src={this_item.sender_image}
                                  />
                                  <Box display='flex' flexDirection='column'>
                                    <Typography variant='h5' className={classes.lastName} >{makeSubject(this_item.subject || this_item.message_text)}</Typography>
                                    <Typography variant='h5' className={classes.firstName}>{`from: ${this_item.patient_name || this_item.sender_name || this_item.sender_id}`}</Typography>
                                    <Typography variant='h5' className={classes.timeLine}>{makeReadableTime(this_item.posted_time || this_item.deliver_time)}</Typography>
                                  </Box>
                                </Box>
                                {this_item.message_text.split(/[\n\r]+/).map((mLine, mIndex) => (
                                  <Typography key={`prefLine-${mIndex}`} className={classes.preferenceLine}>{mLine}</Typography>
                                ))}
                                {this_item.attachments && this_item.attachments.map((aLine, aIndex) => (
                                  <a
                                    href={aLine}
                                    key={`attach-${aIndex}-href`}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    style={{ color: 'inherit', textDecoration: 'underline' }}>
                                    <Typography
                                      key={`attach-${aIndex}`}
                                      className={classes.attachmentLine}
                                    >
                                      {`Attachment: ${attachmentName(aLine)}`}
                                    </Typography>
                                  </a>
                                ))}
                                {open[index] &&
                                  messageResults.map((mLine, mIndex) => (
                                    <Typography key={`prefLine-${mIndex}`} className={classes.preferenceLine}>{mLine}</Typography>)
                                  )
                                }
                              </Box>
                            }
                            {(inOut_mode === 'out') &&
                              <Box display='flex' flexDirection='column'>
                                <Box display='flex' flexDirection='row'>
                                  <Box
                                    className={classes.imageArea}
                                    component="img"
                                    alt={''}
                                    src={this_item.sender_image}
                                  />
                                  <Box display='flex' flexDirection='column'>
                                    <Typography variant='h5' className={classes.lastName} >{this_item.subject || makeSubject(this_item.message_text)}</Typography>
                                    <Typography variant='h5' className={classes.firstName}>{`to: ${this_item.toLine}`}</Typography>
                                    <Typography variant='h5' className={classes.timeLine}>{makeReadableTime(this_item.deliver_time)}</Typography>
                                  </Box>
                                </Box>
                                {this_item.message_text.split(/[\n\r]+/).map((mLine, mIndex) => (
                                  <Typography key={`prefLine-${mIndex}`} className={classes.preferenceLine}>{mLine}</Typography>)
                                )}
                                {this_item.attachments && this_item.attachments.map((aLine, aIndex) => (
                                  <a
                                    href={aLine}
                                    key={`attach-${aIndex}-href`}
                                    target='_blank'
                                    rel='noopener noreferrer'
                                    style={{ color: 'inherit', textDecoration: 'underline' }}>
                                    <Typography
                                      key={`attach-${aIndex}`}
                                      className={classes.attachmentLine}
                                    >
                                      {`Attachment: ${attachmentName(aLine)}`}
                                    </Typography>
                                  </a>
                                ))}
                                {open[index] &&
                                  messageResults.map((mLine, mIndex) => (
                                    <Typography key={`prefLine-${mIndex}`} className={classes.preferenceLine}>{mLine}</Typography>)
                                  )
                                }
                              </Box>
                            }
                          </Box>
                          {!open[index] ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                          {(inOut_mode === 'in') &&
                            <DeleteIcon
                              onClick={() => {
                                setConfirmMessage(`Delete message from ${this_item.patient_name || this_item.sender_name}?`);
                                setConfirmID(this_item.message_id);
                                setConfirmIndex(index);
                                setDeletePending(true);
                                setForceRedisplay(false);
                              }}
                            />
                          }
                        </Box>
                        <Collapse in={open[index]} timeout="auto" unmountOnExit>
                          {
                            <Box display='flex' flexDirection='row' paddingTop={1} paddingBottom={1} justifyContent='center' alignItems='center'>
                              {(inOut_mode === 'in') && (this_item.allowReplyAll) &&
                                <Button
                                  onClick={async () => {
                                    let rList = await replyAllList(this_item.thread_id);
                                    setRecipient(rList);
                                    setRecipientIndex(index);
                                    setPromptForMessage(true);
                                  }}
                                  className={classes.AVAButton}
                                  startIcon={<SendIcon fontSize="small" />}
                                >
                                  Reply All
                                </Button>
                              }
                              {(inOut_mode === 'in') &&
                                <Button
                                  onClick={() => {
                                    setPromptForMessage(true);
                                    setRecipient(`${this_item.sender_name}:${this_item.sender_id}`);
                                    setRecipientIndex(index);
                                  }}
                                  className={classes.AVAButton}
                                  startIcon={<SendIcon fontSize="small" />}
                                >
                                  Reply
                                </Button>
                              }
                            </Box>
                          }
                        </Collapse>
                      </Box>
                    </Paper>
                    : null
                  )
                ))}
              </List>
            </Paper>
          }
          {(messageList.length === 0) &&
            <Box display='flex' flex={4} justifyContent='center' alignItems='center' overflow='hidden'>
              <Typography style={AVATextStyle({ size: 1.5, bold: true, align: 'center' })} >
                {`There are no messages to show`}
              </Typography>
            </Box>
          }
          {
            promptForMessage &&
            <MakeMessage
              titleText={''}
              promptText={[`Subject`, `Message`]}
              promptUse={['subject', 'message']}
              buttonText={'Send'}
              sender={pSession}
              pRecipientID={Array.isArray(recipient) ? recipient.map(r => { return r.split(':')[1]; }) : [recipient.split(':')[1]]}
              pRecipientName={Array.isArray(recipient) ? recipient.map(r => { return r.split(':')[0]; }) : [recipient.split(':')[0]]}
              onCancel={() => {
                setPromptForMessage(false);
                setForceRedisplay(!forceRedisplay);
              }}
              onComplete={() => {
                setPromptForMessage(false);
                setForceRedisplay(!forceRedisplay);
              }}
              allowCancel={true}
              thread_id={(recipientIndex >= 0) ? messageList[recipientIndex].thread_id : ''}
              seedText={[((recipientIndex >= 0)
                ? `${pSession.user_display_name}'s reply to ${messageList[recipientIndex].subject}`
                : ''), '']}
            />
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
            showAddPrompt &&
            <SendMessageDialog
              open={true}
              onClose={() => {
                setShowAddPrompt(false);
              }}
              pReturnValue={'object'}
              multiSelect={true}
              onSelect={(selectedPerson) => {
                setPromptForMessage(true);
                setShowAddPrompt(false);
                let rList = [];
                Object.keys(selectedPerson).forEach(r => {
                  rList.push(`${selectedPerson[r]}:${r}`);
                });
                setRecipient(rList);
              }}
            >
            </SendMessageDialog>
          }
          { // Command Area
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    onClick={() => onReset()}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Close'}
                  </Button>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'blue', color: 'white' }}
                    size='small'
                    onClick={() => {
                      if (inOut_mode === 'in') { setinOut('out'); }
                      else { setinOut('in'); }
                    }}
                    startIcon={
                      (inOut_mode === 'in' ? <ContactMailOutlinedIcon size="small" /> : <MarkunreadMailboxOutlinedIcon size="small" />)
                    }
                  >
                    {inOut_mode === 'in' ? 'View Sent Messages' : 'View Received Messages'}
                  </Button>
                  <Button
                    onClick={async () => {
                      setShowAddPrompt(true);
                    }}
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'green', color: 'white' }}
                    size='small'
                    startIcon={<SendIcon size='small' />}
                  >
                    {`New Message`}
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