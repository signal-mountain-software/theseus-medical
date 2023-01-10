import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import List from '@material-ui/core/List';

import Collapse from '@material-ui/core/Collapse';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import CloseIcon from '@material-ui/icons/HighlightOff';

import MarkunreadMailboxOutlinedIcon from '@material-ui/icons/MarkunreadMailboxOutlined';
import ContactMailOutlinedIcon from '@material-ui/icons/ContactMailOutlined';

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
import AVATextInput from '../forms/AVATextInput';
import SendMessageDialog from '../dialogs/SendMessageDialog';

const useStyles = makeStyles(theme => ({
  page: {
    height: 950,
    maxWidth: 1000
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
  rowButtonDefault: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.primary[theme.palette.type],
  },
  rowButtonRed: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    color: theme.palette.reject[theme.palette.type],
  },
  rowButtonGreen: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.confirm[theme.palette.type],
  },
  rowButtonBlue: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.info[theme.palette.type],
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
    marginRight: theme.spacing(1),
  }
}));

export default ({ pPerson, pClient, pMessageList, onReset }) => {

  const classes = useStyles();

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
  const [open, setOpen] = React.useState([]);

  const [inOut_mode, setinOut] = React.useState('in');

  const [rowLimit, setRowLimit] = React.useState(20);
  const [previousY, setCurrentY] = React.useState(0);
  const scrollValue = 20;
  var rowsWritten;

  const { enqueueSnackbar } = useSnackbar();

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  function makeReadableTime(pJavaDate) {
    let dDate = new Date(pJavaDate);
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
      let lContent = pContent.toLowerCase().trim().split(/[^a-zA-Z0-9 ']+/);
      return (lContent[0] || lContent[1]).split(/[ ]+/g).map(w => { return (w.charAt(0).toUpperCase() + w.substring(1)); }).join(' ');
    }
    else { return 'AVA Message'; }
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

  const handleRemoveMessage = async (pMessageID, pIndex) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:MessageMaintenance';
    params.Payload = JSON.stringify({
      action: "mark_deleted",
      clientId: pClient,
      request: {
        "message_id": pMessageID,
      }
    });
    await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while deleting that item.  Error is ${err.message}`, {
          variant: 'error'
        });
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
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:MessageMaintenance';
    params.Payload = JSON.stringify({
      action: "send_results",
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

  const handleSendMessage = async (pPatient, pMessage, pRecipient = null) => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:messageEngine';
    let nqMessage = '';
    nqMessage = `Sent "${pMessage}" to ${pRecipient.split(':')[0]}`;
    let lambdaPayload = {
      "body": {
        "client": pClient,
        "author": pPatient,
        "values": pRecipient + ' ~ MessageText = ' + pMessage
      }
    };
    params.Payload = JSON.stringify(lambdaPayload);
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while sending a Message.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    enqueueSnackbar(nqMessage, {
      variant: 'success'
    });
  };

  const onScroll = event => {
    if (rowLimit < messageList.length) {
      let currentY = window.scrollY;
      if (currentY - (previousY + 50)) {
        setCurrentY(currentY);
        setRowLimit(rowLimit + scrollValue);
        setForceRedisplay(!forceRedisplay);
      }
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
      let searchString = [pMessageRec.message_content, pMessageRec.sender_name, pMessageRec.sender_id].join(' ');
      return searchString.toLowerCase().includes(message_filter_lower);
    }
  }

  // ******************

  return (
    <Dialog
      open={true || forceRedisplay}
      onScroll={onScroll}
      p={2}
      fullScreen
    >
      {messageList && messageList.length > 0 &&
        <React.Fragment>
          <DialogContentText
            className={classes.title}
            id='scroll-dialog-title'
          >
            Recent Messages {inOut_mode === 'out' ? 'from me to others' : 'sent to me'}
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
                              <Typography variant='h5' className={classes.lastName} >{makeSubject(this_item.message_content || this_item.subject || this_item.message_text)}</Typography>
                              <Typography variant='h5' className={classes.firstName}>{`from: ${this_item.patient_name || this_item.sender_name || this_item.sender_id}`}</Typography>
                              <Typography variant='h5' className={classes.timeLine}>{makeReadableTime(this_item.posted_time || this_item.deliver_time)}</Typography>
                              {open[index] &&
                                this_item.message_content.replace('http', '\n\rhttp').split(/[\n\r]+/).map((mLine, mIndex) => (
                                  ((mLine.startsWith('http')) ?
                                    <a
                                      href={mLine.split(/\s+/g)[0]}
                                      target='_blank'
                                      rel='noopener noreferrer'
                                      style={{ color: 'inherit', textDecoration: 'underline' }}>
                                      <Typography key={`prefLine-${mIndex}`} className={classes.preferenceLine}>{mLine}</Typography>
                                    </a>
                                    :
                                    <Typography key={`prefLine-${mIndex}`} className={classes.preferenceLine}>{mLine}</Typography>)
                                ))
                              }
                              {open[index] &&
                                messageResults.map((mLine, mIndex) => (
                                  <Typography key={`prefLine-${mIndex}`} className={classes.preferenceLine}>{mLine}</Typography>)
                                )
                              }

                            </Box>
                          }
                          {(inOut_mode === 'out') &&
                            <Box display='flex' flexDirection='column'>
                              <Typography variant='h5' className={classes.lastName} >{this_item.subject || makeSubject(this_item.message_text)}</Typography>
                              <Typography variant='h5' className={classes.firstName}>{`to: ${this_item.toLine}`}</Typography>
                              <Typography variant='h5' className={classes.timeLine}>{makeReadableTime(this_item.deliver_time)}</Typography>
                              {open[index] &&
                                this_item.message_text.split(/[\n\r]+/).map((mLine, mIndex) => (
                                  <Typography key={`prefLine-${mIndex}`} className={classes.preferenceLine}>{mLine}</Typography>)
                                )
                              }
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
                            {(inOut_mode === 'in') &&
                              <Button
                                onClick={() => {
                                  setPromptForMessage(true);
                                  setRecipient(`${this_item.patient_name || this_item.sender_name}:` + this_item.patient_id);
                                }}
                                className={classes.rowButtonGreen}
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
          {promptForMessage &&
            <AVATextInput
              promptText={`What should your message to ${recipient.split(':')[0]} say?`}
              buttonText='Send'
              onCancel={() => { setPromptForMessage(false); }}
              onSave={(messageText) => {
                setPromptForMessage(false);
                handleSendMessage(pPerson, messageText, recipient);
              }}
            />
          }
          {deletePending &&
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
          {showAddPrompt &&
            <SendMessageDialog
              open={true}
              onClose={() => {
                setShowAddPrompt(false);
              }}
              onSelect={(selectedPerson) => {
                setPromptForMessage(true);
                setRecipient(selectedPerson);
              }}
            >
            </SendMessageDialog>
          }
          { // Command Area
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  <Button
                    className={classes.rowButtonGreen}
                    onClick={onReset}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Close'}
                  </Button>
                  <Button
                    className={classes.rowButtonGreen}
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
                    className={classes.rowButtonGreen}
                    startIcon={<SendIcon size='small' />}
                  >
                    {`New Message`}
                  </Button>
                </Box>
              </Box>
            </DialogActions>
          }
        </React.Fragment>
      }
    </Dialog >
  );
};;