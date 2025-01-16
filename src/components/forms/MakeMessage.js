import React from 'react';
import { sendMessages } from '../../util/AVAMessages';
import { makeName, getImage } from '../../util/AVAPeople';
import { makeArray, s3, dbClient } from '../../util/AVAUtilities';
import { Dialog, DialogContent, DialogActions } from '@material-ui/core';

import { useSnackbar } from 'notistack';
import CloseIcon from '@material-ui/icons/HighlightOff';
import SendIcon from '@material-ui/icons/Send';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import DeleteIcon from '@material-ui/icons/Delete';

import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';

import TextField from '@material-ui/core/TextField';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';

import SendMessageDialog from '../dialogs/SendMessageDialog';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useSession from '../../hooks/useSession';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  containerBox: {
    margin: theme.spacing(2),
  },
  contentBox: {
    minWidth: '100%',
    paddingLeft: theme.spacing(3),
  },
  radius_rounded: {
    borderRadius: '30px',
    overflowX: 'hidden'
  },
  dialogBox: {
    paddingTop: 0,
    paddingLeft: 0,
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
    overflowX: 'hidden',
  },
  title: {
    marginTop: 0,
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
    fontWeight: 'bold'
  },
  imageArea: {
    minWidth: '100px',
    maxWidth: '100px',
    marginTop: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
  buttonArea: {
    justifyContent: 'space-around',
    minWidth: '100%',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center'
  },
  tightRight: {
    marginRight: 0
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    marginBottom: 0,
    marginTop: 0,
    paddingLeft: 0,
  },
  radioHeader: {
    fontSize: theme.typography.fontSize * 0.9,
    fontWeight: 'bold',
    marginLeft: 0,
    marginBottom: 0,
    marginTop: 0,
    paddingLeft: 0,
  },
  idText: {
    fontSize: theme.typography.fontSize * 0.8,
    minWidth: '100%',
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
}));

export default ({
  titleText,
  promptText,
  promptUse,
  buttonText,
  sender,
  pRecipientID,
  pRecipientName,
  onCancel,
  onComplete,
  setUrgent = false,
  setMethod,
  allowCancel = true,
  thread_id,
  options = {},
  seedText
}) => {

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { enqueueSnackbar } = useSnackbar();
  const { state } = useSession();

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  const setFocus = React.useRef(null);

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  let rList = makeArray(pRecipientID);
  const [reactData, setReactData] = React.useState({
    recipientID: pRecipientID,
    recipientName: pRecipientName,
    selectID: ((rList.length === 1) ? rList[0] : ''),
    IDImage: ((rList.length === 1) ? getImage(rList[0]) : ''),
    newAccount: false,
    titleText: titleText,
    attachmentList: [],
    textInput: makeArray(seedText) || [],
    promptUsage: checkPrompts(promptText, promptUse),
    HTMLMessage: false,
    viewAsHTML: false,
    multipleRecipients: false,
    nameInput: '',
    isUrgent: setUrgent,
    allowReplyAll: false,
    forceMethod: setMethod,
    imageURL: ''
  });

  function checkPrompts(promptText, promptUse) {
    let prompts = makeArray(promptText);
    if (prompts.length > 1) {
      if (!promptUse) {
        return ['subject', 'message', 'voicemail'];
      }
      else {
        return makeArray(promptUse);
      }
    }
    else {
      return ['message'];
    }
  }

  React.useEffect(() => {
    if (setFocus && setFocus.current) {
      setFocus.current.focus();
    }
  }, []);

  const handleChangeTextInput = (event, x) => {
    if (event.target.value && (event.target.value.length === 1)) {
      reactData.textInput[x] = event.target.value.toUpperCase();
    }
    else {
      reactData.textInput[x] = event.target.value;
    }
    if (reactData.promptUsage[x] === 'message') {
      reactData.HTMLMessage = ((reactData.textInput[x].includes('<')) && (reactData.textInput[x].includes('>')));
    }
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
  };

  const handleChangeNameInput = (event) => {
    reactData.nameInput = event.target.value;
    reactData.forceRedisplay = !reactData.forceRedisplay;
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
  };

  const hiddenFileInput = React.useRef(null);

  const handleFileUpload = event => {
    hiddenFileInput.current.click();
  };

  async function handleSaveFile(pTarget) {
    let pType = pTarget.type;
    let s3Resp = await s3
      .upload({
        Bucket: 'theseus-medical-storage',
        Key: pTarget.name,
        Body: pTarget,
        ACL: 'public-read-write',
        ContentType: pType
      })
      .promise()
      .catch(err => {
        enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
      });
    reactData.attachmentList.push(s3Resp);
    reactData.forceRedisplay = !reactData.forceRedisplay;
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
    return s3Resp;
  };

  const noInput = () => {
    return !(makeArray(promptText).some((n, p) => { return (!!reactData.textInput[p] && !!(reactData.textInput[p].trim())); }));
  };

  const handleSave = async () => {
    let sendToID = reactData.recipientID;
    let sendToName = reactData.recipientName;
    if (reactData.newAccount) {
      [sendToID, sendToName] = await handleAddAccount();
      reactData.newAccount = false;
      setReactData(reactData);
    }
    console.log(sendToName);
    let senderName = await makeName(state.session.user_id);
    let principalMessageText = '';
    let voiceMailText = '';
    let subjectText = '';
    if (reactData.textInput.length > 1) {
      if (!promptUse) {
        promptUse = ['subject', 'message', 'voicemail'];
      }
      else {
        promptUse = makeArray(promptUse);
      }
      promptUse.forEach((u, n) => {
        if (reactData.textInput[n]) {
          switch (u) {
            case 'subject': { subjectText += ' ' + reactData.textInput[n]; break; }
            case 'voicemail': {
              voiceMailText += ' ' + reactData.textInput[n];
              if (!principalMessageText) {
                principalMessageText = voiceMailText;
              }
              break;
            }
            default: { principalMessageText += ' ' + reactData.textInput[n]; }
          }
        }
      });
    }
    else {
      principalMessageText = reactData.textInput[0];
    }
    if (!subjectText) {
      subjectText = `Message from ${senderName}`;
    }
    else {
      principalMessageText += `\r\n\n(sent by ${senderName})`;
    }
    let request = {
      client: sender.client_id,
      author: state.session.user_id,
      person_id: state.session.patient_id,
      messageText: principalMessageText.trim(),
      recipientList: Array.isArray(sendToID) ? sendToID : [sendToID],
      subject: subjectText.trim()
    };
    if (voiceMailText) {
      request.voiceMail = voiceMailText.trim();
    }
    if (reactData.attachmentList.length > 0) { request.attachments = reactData.attachmentList.map(a => { return a.Location; }); }
    if (reactData.isUrgent) { request.preffered_method = 'urgent'; }
    if (reactData.allowReplyAll) { request.allowReplyAll = true; }
    else if (reactData.forceMethod) { request.preffered_method = reactData.forceMethod; }
    if (thread_id) { request.thread_id = thread_id; }
    let response = await sendMessages(request);
    let resp = makeArray(response);
    enqueueSnackbar(resp[0].message, { variant: (resp[0].sent ? 'success' : 'error') });
    onComplete();
  };

  function recordExists(recordId) {
    if (!recordId) { return false; }
    if (recordId.hasOwnProperty('Count')) { return (recordId.Count > 0); }
    else { return ((recordId.hasOwnProperty("Item") || recordId.hasOwnProperty("Items"))); }
  }

  async function makeUniqueID(fName, lName, pAddress) {
    if (!lName) {
      if (!fName) { return (new Date().getTime().toString()); };
      lName = fName.slice(1);
    }
    let namePart = fName.charAt(0).toLowerCase() + lName.toLowerCase().replace(/\W/g, '');
    let queryExpression = {
      KeyConditionExpression: 'client_id = :c AND begins_with(person_id, :p)',
      ExpressionAttributeValues: { ':c': sender.client_id, ':p': namePart },
      ExpressionAttributeNames: { '#n': 'name', '#f': 'first', '#l': 'last' },
      TableName: "People",
      IndexName: "client_id-index",
      ProjectionExpression: "person_id, #n.#f, #n.#l, messaging"
    };
    var checkRecs = await dbClient
      .query(queryExpression)
      .promise()
      .catch(error => {
        console.log({ 'Bad query on People in getGroupMembers - caught error is': error });
      });
    let maxID;
    if (recordExists(checkRecs)) {
      let foundAt = checkRecs.Items.findIndex(rec => {
        let numberPart = rec.person_id.slice(namePart.length).trim();
        if (!numberPart) { maxID = 0; }
        else if (!isNaN(numberPart)) { maxID = Math.max(Number(numberPart), maxID); }
        return (Object.values(rec.messaging).includes(pAddress));
      });
      if (foundAt > -1) { return checkRecs.Items[foundAt].person_id; }
    }
    return namePart + (maxID ? (maxID + 1) : '');      // nothing found...
  }

  const handleAddAccount = async () => {
    let fName = reactData.recipientName.split(' ')[0];
    let lName = reactData.recipientName.slice(fName.length).trim();
    let pParse = reactData.recipientID.split('=');
    let pAddress = pParse[pParse.length - 1];
    let isEmail = pAddress.includes('@');
    let isPhone = !isNaN(pAddress);
    let workingID = await makeUniqueID(fName, lName, pAddress);

    let putPerson = {
      person_id: workingID,
      client_id: sender.client_id,
      "name": {
        first: fName,
        last: lName,
      },
      messaging: {
        email: (isEmail ? pAddress : null),
        sms: (isPhone ? `+1${pAddress}` : null),
        voice: (isPhone ? `+1${pAddress}` : null)
      },
      search_data: reactData.recipientName,
      preferred_method: (isPhone ? 'sms' : 'email'),
      requirePassword: false,
      storePassword: true,
      directory_option: 'normal',
      directory_partner: 'na',
      clients: {
        id: sender.client_id,
        groups: ['*none']
      },
      groups: ['*none'],
      location: `Friend of ${sender.patient_display_name} (${sender.patient_id})`,
    };
    await dbClient
      .put({
        Item: putPerson,
        TableName: "People",
      })
      .promise()
      .catch(error => {
        console.log(`caught error updating People; error is:`, error);
        workingID = null;
      });
    return [workingID, reactData.recipientName];
  };

  const onNameEnter = async (event) => {
    if (((event.key === 'Enter') || (event.type === 'blur')) && (reactData.newAccount)) {
      reactData.recipientName = event.target.value;
      reactData.forceRedisplay = !reactData.forceRedisplay;
      setReactData(reactData);
      setForceRedisplay(!forceRedisplay);
    }
  };

  function makeTitle(selectedData) {
    let response = '';
    reactData.multipleRecipients = false;
    if (reactData.forceMethod === 'AVA') { response += 'Send an AVA Alert '; }
    else { response += 'Send a '; }
    if (thread_id) { response += 'reply '; }
    else { response += 'message '; }
    let rArray = makeArray(selectedData.recipientID);
    let nArray = makeArray(selectedData.recipientName);
    if (rArray.length === 1) {
      if (rArray[0].startsWith('GRP//')) {
        reactData.multipleRecipients = true;
        response += `to ${nArray[0]}`;
      }
      else {
        let [last, first] = nArray[0].split(/,/);
        response += `to ${first ? (first + ' ') : ''}${last}`;
        reactData.selectID = rArray[0];
        reactData.IDImage = getImage(rArray[0]);
      }
    }
    else {
      reactData.multipleRecipients = true;
      let random = Math.floor(Math.random() * rArray.length);
      let hasGroups = rArray.some(this_item => {
        return this_item.startsWith('GRP//');
      });
      if (rArray[random].startsWith('GRP//')) {
        response += `to multiple people, including ${nArray[random]}`;
      }
      else {
        let [last, first] = nArray[random].split(/,/);
        response += `to ${hasGroups ? 'multiple' : rArray.length} people, including ${first ? (first + ' ') : ''}${last}`;
      }
    }
    reactData.titleText = response;
    setReactData(reactData);
    return response;
  }

  // **************************

  return (
    <Dialog fullWidth open={true}
      classes={{ paper: classes.radius_rounded }}
    >
      {(typeof reactData.recipientID === 'string') && (reactData.recipientID === '*select') &&
        <SendMessageDialog
          open={true}
          onClose={() => {
            onCancel();
          }}
          multiSelect={true}
          pReturnValue={'object'}
          options={options}
          onSelect={async (selectedPerson) => {
            if (Object.keys(selectedPerson).length < 1) {
              enqueueSnackbar(`Please select at least one name`, { variant: 'error' });
            }
            else {
              reactData.imageURL = null;
              reactData.newAccount = false;     // future enhancement
              reactData.recipientID = Object.keys(selectedPerson);
              reactData.recipientName = Object.values(selectedPerson);
              makeTitle(reactData);
              reactData.forceRedisplay = !reactData.forceRedisplay;
              setReactData(reactData);
            }
            setForceRedisplay(forceRedisplay => !forceRedisplay);
          }}
        >
        </SendMessageDialog>
      }
      {((typeof reactData.recipientID !== 'string') || (reactData.recipientID !== '*select')) &&
        <React.Fragment>
          <Box display='flex' flexDirection={'row'} justifyContent={'space-between'} width={'100%'} alignItems={'flex-start'} mb={1}>
            <Typography style={AVATextStyle({
              size: 1.3, bold: true, margin: {
                top: 3,
                left: 1.5,
                right: 0,
              }
            })} id='scroll-dialog-title'>
              {reactData.titleText || makeTitle(reactData)}
            </Typography>
            {(reactData.IDImage) && (!reactData.multipleRecipients) &&
              <img
                className={classes.imageArea}
                alt=''
                src={reactData.IDImage}
              />
            }
          </Box>
          <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
            <Box display='flex'
              flexGrow={1}
              mb={0}
              mt={1}
              pb={2}
              mx={1}
              flexDirection='column'
              justifyContent='center'
              alignItems='flex-start'
            >

              <Box
                display='flex'
                flexGrow={1}
                mb={0}
                ml={1}
                minWidth={'100%'}
                flexDirection='column'
                justifyContent='center'
                alignItems='flex-start'
              >
                {reactData.newAccount &&
                  <TextField
                    classes={{ root: classes.idText }}
                    id={`name-msg`}
                    key={`name-msg`}
                    fullWidth
                    multiline
                    helperText={`What name should AVA use for ${reactData.recipientID.split('=')[1].trim()}`}
                    value={reactData.nameInput || ''}
                    onChange={(event) => {
                      handleChangeNameInput(event);
                    }}
                    onKeyPress={(event) => {
                      onNameEnter(event);
                    }}
                    onBlur={(event) => {
                      onNameEnter(event);
                    }}
                    autoComplete='off'
                  />
                }
                {makeArray(promptText).map((p, x) =>
                  <Box display='flex'
                    flexDirection='row'
                    paddingLeft={2}
                    paddingRight={2}
                    minWidth={'100%'}
                    mt={0.5}
                    mb={0.5}
                    border={reactData.textInput[x] ? 4 : 2}
                    borderColor={reactData.textInput[x] ? 'green' : 'red'}
                    borderRadius={'16px'}
                    key={'fullRow' + x}
                  >
                    {((reactData.promptUsage[x] === 'message') && reactData.viewAsHTML) ?
                      <div
                        dangerouslySetInnerHTML={{ '__html': reactData.textInput[x] }}
                      />
                      :
                      <TextField
                        classes={{ root: classes.idText }}
                        id={`prompt-msg`}
                        key={`prompt-msg_${x}`}
                        fullWidth
                        multiline
                        inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                        FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                        ref={(x === (makeArray(promptText).length - 1)) ? setFocus : null}
                        helperText={p}
                        value={reactData.textInput[x] || ''}
                        onChange={(event) => {
                          handleChangeTextInput(event, x);
                        }}
                        autoComplete='off'
                      />
                    }
                  </Box>
                )}
                {reactData.multipleRecipients &&
                  <Box
                    key={'qMulti'}
                    display="flex"
                    marginLeft={'12px'}
                    marginBottom={'-8px'}
                    className={classes.qualOption}
                    flexDirection='column'
                    justifyContent="center"
                  >
                    <Box display='flex' flexDirection='row' justifyContent='flex-start'
                      alignItems='center' key={'qrOpt_multibox'}
                    >
                      <Checkbox
                        className={classes.radioButton}
                        size="small"
                        onClick={() => {
                          reactData.allowReplyAll = !reactData.allowReplyAll;
                          setReactData(reactData);
                          setForceRedisplay(!forceRedisplay);
                        }}
                        checked={reactData.allowReplyAll}
                      />
                      <Typography style={AVATextStyle({ size: 0.5, margin: { left: 0.2 } })}>Allow Reply all</Typography>
                    </Box>
                  </Box>
                }
                <Box
                  key={'qRow'}
                  display={"flex"}
                  marginLeft={'12px'}
                  className={classes.qualOption}
                  flexDirection='column'
                  justifyContent="center"
                >
                  <Box display='flex' flexDirection='row' justifyContent='flex-start'
                    alignItems='center' key={'qrOpt_urgentbox'}
                  >
                    <Checkbox
                      className={classes.radioButton}
                      size="small"
                      onClick={() => {
                        reactData.isUrgent = !reactData.isUrgent;
                        setReactData(reactData);
                        setForceRedisplay(!forceRedisplay);
                      }}
                      checked={reactData.isUrgent}
                    />
                    <Typography style={AVATextStyle({ size: 0.5, margin: { left: 0.2 } })}>Mark as Urgent</Typography>
                  </Box>
                  {reactData.HTMLMessage &&
                    <Box display='flex' flexDirection='row' justifyContent='flex-start'
                      alignItems='center' key={'qrOpt_urgentbox'}
                    >
                      <Checkbox
                        className={classes.radioButton}
                        size="small"
                        onClick={() => {
                          reactData.viewAsHTML = !reactData.viewAsHTML;
                          setReactData(reactData);
                          setForceRedisplay(!forceRedisplay);
                        }}
                        checked={reactData.viewAsHTML}
                      />
                      <Typography style={AVATextStyle({ size: 0.5, margin: { left: 0.2 } })}>View as HTML</Typography>
                    </Box>
                  }
                </Box>
                {(reactData.attachmentList.length > 0) &&
                  <Box display='flex' flexDirection='column' justifyContent='flex-start'
                    alignItems='flex-start' key={'qrOpt_attachmentlist'}
                  >
                    <Typography style={AVATextStyle({ size: 0.9, margin: { top: 1 } })}>Attachments:</Typography>
                    {reactData.attachmentList.map((a, x) => (
                      <Box display='flex' flexDirection='row' justifyContent='flex-start'
                        alignItems='center' key={`qrOpt_attachmentLine-${x}`} overflow='hidden'
                      >
                        <DeleteIcon
                          className={classes.radioButton}
                          size="small"
                          onClick={() => {
                            reactData.attachmentList.splice(x, 1);
                            reactData.forceRedisplay = !reactData.forceRedisplay;
                            setReactData(reactData);
                            setForceRedisplay(!forceRedisplay);
                          }}
                        />
                        <Typography style={AVATextStyle({ size: 0.5 })}>{a.Key}</Typography>
                      </Box>
                    ))}
                  </Box>
                }
              </Box>
            </Box>
          </DialogContent>
          <DialogActions className={classes.buttonArea} >
            {allowCancel &&
              <Button
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'red', color: 'white' }}
                size='small'
                onClick={() => {
                  onCancel();
                }}
                startIcon={<CloseIcon size="small" />}
              >
                {'Back'}
              </Button>
            }
            <Box display='flex' flexDirection='row' justifyContent='flex-end' flexWrap='wrap'
              alignItems='center' key={'qrOpt_attachmentbox'}
            >
              <Button
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'blue', color: 'white' }}
                size='small'
                startIcon={<CloudUploadIcon />}
                onClick={handleFileUpload}
              >
                {'Attach'}
              </Button>
              <input
                type="file"
                style={{ display: 'none' }}
                ref={hiddenFileInput}
                onChange={async (target) => {
                  await handleSaveFile(target.target.files[0]);
                  reactData.forceRedisplay = !reactData.forceRedisplay;
                  setReactData(reactData);
                  setForceRedisplay(!forceRedisplay);
                }}
              />
              <Button
                className={AVAClass.AVAButton}
                style={{ backgroundColor: (noInput() ? 'white' : 'green'), color: (noInput() ? 'green' : 'white') }}
                size='small'
                disabled={noInput()}
                onClick={async () => {
                  await handleSave();
                  onCancel();
                }}
                startIcon={<SendIcon className={classes.tightRight} size="small" />}
              >
                {buttonText}
              </Button>
            </Box>
          </DialogActions>
        </React.Fragment >
      }
    </Dialog >
  );
};
