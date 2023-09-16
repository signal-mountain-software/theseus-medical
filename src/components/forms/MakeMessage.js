import React from 'react';
import { sendMessages } from '../../util/AVAMessages';
import { makeName, getImage } from '../../util/AVAPeople';
import { makeArray, s3, dbClient } from '../../util/AVAUtilities';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

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

import { AVAclasses } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  containerBox: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0
  },
  contentBox: {
    minWidth: '100%',
    paddingLeft: theme.spacing(3),
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
    fontWeight: 'bold'
  },
  imageArea: {
    minWidth: '100px',
    maxWidth: '100px',
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
  },
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
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
  seedText
}) => {

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { enqueueSnackbar } = useSnackbar();
  const { state } = useSession();

  const setFocus = React.useRef(null);

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [reactData, setReactData] = React.useState({
    recipientID: pRecipientID,
    recipientName: pRecipientName,
    selectID: pRecipientID,
    newAccount: false,
    titleText: titleText,
    attachmentList: [],
    textInput: makeArray(seedText) || [],
    multipleRecipients: false,
    nameInput: '',
    isUrgent: setUrgent,
    allowReplyAll: false,
    forceMethod: setMethod,
    imageURL: ''
  });

  React.useEffect(() => {
    if (setFocus && setFocus.current) {
      setFocus.current.focus();
    }
  }, []);

  const handleChangeTextInput = (event, x) => {
    reactData.textInput[x] = event.target.value;
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
    return (!reactData.textInput[makeArray(promptText).length - 1]);
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
    let request = {
      client: sender.client_id,
      author: state.session.user_id,
      person_id: state.session.patient_id,
      messageText: reactData.textInput[makeArray(promptText).length - 1],
      recipientList: Array.isArray(sendToID) ? sendToID : [sendToID],
      subject: (makeArray(promptText).length > 1 ? reactData.textInput[0] : `Message from ${senderName}`)
    };
    if (state.session.user_id !== state.session.patient_id) {
      let pName = await makeName(state.session.patient_id);
      let hMessage = request.messageText;
      request.messageText = `[This message was sent by ${senderName} while accessing ${pName}'${(pName.charAt(pName.length - 1) !== 's' ? 's' : '')} account.]\r\n\n${hMessage}`;
    }
    if (reactData.attachmentList.length > 0) { request.attachments = reactData.attachmentList.map(a => { return a.Location; }); }
    if (reactData.isUrgent) { request.preffered_method = 'urgent'; }
    if (reactData.allowReplyAll) { request.allowReplyAll = true; }
    else if (reactData.forceMethod) { request.preffered_method = reactData.forceMethod; }
    if (thread_id) { request.thread_id = thread_id; }
    let response = await sendMessages(request);
    enqueueSnackbar(response.message, { variant: (response.sent ? 'success' : 'error') });
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
        response += `to members of ${nArray[0]}`;
      }
      else {
        let [last, first] = nArray[0].split(/,/);
        response += `to ${first ? (first + ' ') : ''}${last}`;
        reactData.selectID = rArray[0];
      }
    }
    else {
      reactData.multipleRecipients = true;
      let random = Math.floor(Math.random() * rArray.length);
      if (rArray[random].startsWith('GRP//')) {
        response += `to multiple people, including members of ${nArray[random]}`;
      }
      else {
        let [last, first] = nArray[random].split(/,/);
        response += `to ${rArray.length} people, including ${first ? (first + ' ') : ''}${last}`;
      }
      reactData.selectID = selectedData.recipientID[random];
    }
    reactData.titleText = response;
    setReactData(reactData);
    return response;
  }

  // **************************

  return (
    <Dialog open={reactData.forceRedisplay || true} fullScreen className={classes.containerBox}>
      {(typeof reactData.recipientID === 'string') && (reactData.recipientID === '*select') &&
        <SendMessageDialog
          open={true}
          onClose={() => {
            onCancel();
          }}
          multiSelect={true}
          pReturnValue={'object'}
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
          <Box display='flex'
            grow={1}
            mb={0}
            flexDirection='column'
            justifyContent='center'
            alignItems='flex-start'
          >
            <DialogContentText className={classes.title} id='scroll-dialog-title'>
              {reactData.titleText || makeTitle(reactData)}
            </DialogContentText>
            <Box
              className={classes.imageArea}
              component="img"
              alt=''
              src={getImage(reactData.selectID)}
            />
            <DialogContent className={classes.contentBox}>
              <Box
                display='flex'
                grow={1}
                mb={0}
                ml={0}
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
                    border={reactData.textInput[x] ? 1 : 0}
                    borderRadius={'16px'}
                    key={'fullRow' + x}
                  >
                    <TextField
                      classes={{ root: classes.idText }}
                      id={`prompt-msg`}
                      key={`prompt-msg_${x}`}
                      fullWidth
                      multiline
                      ref={(x === (makeArray(promptText).length - 1)) ? setFocus : null}
                      helperText={p}
                      value={reactData.textInput[x] || ''}
                      onChange={(event) => {
                        handleChangeTextInput(event, x);
                      }}
                      autoComplete='off'
                    />
                  </Box>
                )}
                {reactData.multipleRecipients &&
                  <Box
                    key={'qMulti'}
                    display="flex"
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
                      <Typography className={classes.radioText}>Allow Reply all</Typography>
                    </Box>
                  </Box>
                }
                <Box
                  key={'qRow'}
                  display={"flex"}
                  marginTop={'16px'}
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
                    <Typography className={classes.radioText}>Mark as Urgent</Typography>
                  </Box>
                </Box>
                {(reactData.attachmentList.length > 0) &&
                  <Box display='flex' flexDirection='column' justifyContent='flex-start'
                    alignItems='flex-start' key={'qrOpt_attachmentlist'}
                  >
                    <Typography className={classes.radioHead}>Attachments:</Typography>
                    {reactData.attachmentList.map((a, x) => (
                      <Box display='flex' flexDirection='row' justifyContent='flex-start'
                        alignItems='flex-start' key={`qrOpt_attachmentLine-${x}`}
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
                        <Typography className={classes.radioText}>{a.Key}</Typography>
                      </Box>
                    ))}
                  </Box>
                }
              </Box>
            </DialogContent>
          </Box>
          <DialogActions style={{ justifyContent: 'center' }}>
            <Box display='flex' flexDirection='row' justifyContent='flex-start'
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
            </Box>
            <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center' >
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
            </Box>
            <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center' >
              <Button
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'green', color: 'white' }}
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
