import React from 'react';
import { Lambda } from 'aws-sdk';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import { useSnackbar } from 'notistack';
import CloseIcon from '@material-ui/icons/HighlightOff';
import SendIcon from '@material-ui/icons/Send';

import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';

import TextField from '@material-ui/core/TextField';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';

import SendMessageDialog from '../dialogs/SendMessageDialog';

import makeStyles from '@material-ui/core/styles/makeStyles';
const useStyles = makeStyles(theme => ({
  containerBox: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0
  },
  contentBox: {
    minWidth: '100%'
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
    minWidth: '150px',
    maxWidth: '150px',
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
  rowButtonConfirm: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    border: '0.4px solid gray',
    textTransform: 'none',
    fontWeight: 'bold',
    size: 'small',
    color: theme.palette.confirm[theme.palette.type],
  },
  rowButtonReject: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(2),
    variant: 'outlined',
    border: '0.4px solid gray',
    textTransform: 'none',
    fontWeight: 'bold',
    size: 'small',
    color: theme.palette.reject[theme.palette.type],
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
    paddingRight: 50,
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

const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});
const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

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

  const { enqueueSnackbar } = useSnackbar();

  const [recipientID, setRecipientID] = React.useState(pRecipientID);
  const [recipientName, setRecipientName] = React.useState(pRecipientName);
  const [newAccount, setNewAccount] = React.useState(false);

  const [textInput, setTextInput] = React.useState(seedText || '');
  const [nameInput, setNameInput] = React.useState('');
  const [forceRedisplay, setForceRedisplay] = React.useState(true);
  const [isUrgent, setIsUrgent] = React.useState(setUrgent);
  const [forceMethod, ] = React.useState(setMethod);
  const [imageURL, setImageURL] = React.useState('');

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:messageEngine',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  const handleChangeTextInput = (event) => {
    setTextInput(event.target.value);
    setForceRedisplay(!forceRedisplay);
  };

  const handleChangeNameInput = (event) => {
    setNameInput(event.target.value);
    setForceRedisplay(!forceRedisplay);
  };

  const noInput = () => {
    return (!textInput);
  };

  const handleSave = async () => {
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:messageEngine';
    let pRecipient = recipientName + ':';
    if (recipientID.startsWith('GRP//')) {
      pRecipient += 'group=' + recipientID.split('//')[1].replace('/', '~');
    }
    else if (newAccount) {
      setNewAccount(false);
      pRecipient += await handleAddAccount();
      setRecipientID(pRecipient);
    }
    else {
      pRecipient += recipientID;
    }
    let lambdaPayload = {
      "body": {
        "client": sender.client_id,
        "author": sender.patient_id,
        "values": pRecipient + ' ~ MessageText = ' + textInput
      }
    };
    lambdaPayload.body.values += ' ~ Urgent = ' + (isUrgent ? 'urgent' : 'normal');
    if (forceMethod) { lambdaPayload.body.method = forceMethod; }
    if (thread_id) { lambdaPayload.body.thread_id = thread_id; }
    params.Payload = JSON.stringify(lambdaPayload);
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while sending a Message.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    enqueueSnackbar(`Your ${isUrgent ? 'urgent' : ''} message is on the way to ${recipientName}`, { variant: 'success' });
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
    let fName = recipientName.split(' ')[0];
    let lName = recipientName.slice(fName.length).trim();
    let pParse = recipientID.split('=');
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
      search_data: recipientName,
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
    return workingID;
  };

  const onCheckEnter = async (event) => {
    if ((event.key === 'Enter') && (textInput) && (!newAccount)) { await handleSave(); }
  };

  const onNameEnter = async (event) => {
    if (((event.key === 'Enter') || (event.type === 'blur')) && (newAccount)) {
      setRecipientName(event.target.value);
      setForceRedisplay(!forceRedisplay);
    }
  };
  function makeName(pName) {
    let ans = pName.split(',');
    switch (ans.length) {
      case 3: { return `${ans[2].trim()} ${ans[0].trim()}, ${ans[1].trim()}`; }
      case 2: { return `${ans[1].trim()} ${ans[0].trim()}`; }
      default: { return ans[0].trim(); }
    }
  }

  function getImage(pPerson) {
    if (!imageURL) {
      const imageBucket = 'theseus-medical-storage';
      const imageURI = `public/patients/${pPerson}.jpg`;
      try {
        setImageURL(
          s3.getSignedUrl('getObject', {
            Bucket: imageBucket,
            Key: imageURI,
            Expires: 3600
          })
        );
      }
      catch (e) {
        console.log(`error getting S3 image is ${e}`);
      }
    }
    return imageURL;
  };

  // **************************

  return (
    <Dialog open={forceRedisplay || true} fullScreen className={classes.containerBox}>
      {(recipientID === '*select') &&
        <SendMessageDialog
          open={true}
          onClose={() => {
            onCancel();
          }}
          onSelect={(selectedPerson) => {
            let [sRecipientName, sRecipientID] = selectedPerson.split(':');
            setNewAccount(sRecipientName === '*new');
            setRecipientName(makeName(sRecipientName));
            setRecipientID(sRecipientID);
            setImageURL(null);
            setForceRedisplay(!forceRedisplay);
          }}
        >
        </SendMessageDialog>
      }
      {(recipientID !== '*select') &&
        <React.Fragment>
          <Box display='flex'
            grow={1}
            mb={0}
            flexDirection='column'
            justifyContent='center'
            alignItems='flex-start'
          >
            <DialogContentText className={classes.title} id='scroll-dialog-title'>
              {titleText || `Send a${(forceMethod === 'AVA') ? 'n AVA Alert' : ''} ${thread_id ? 'reply' : 'message'} to ${(recipientName === '*new') ? recipientID.split('=')[1].trim() : (recipientName || 'an AVA Subscriber')}`}
            </DialogContentText>
            <Box
              className={classes.imageArea}
              component="img"
              alt=''
              src={getImage(recipientID)}
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
                {newAccount &&
                  <TextField
                    classes={{ root: classes.idText }}
                    id={`name-msg`}
                    key={`name-msg`}
                    fullWidth
                    multiline
                    helperText={`What name should AVA use for ${recipientID.split('=')[1].trim()}`}
                    value={nameInput || ''}
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
                <TextField
                  classes={{ root: classes.idText }}
                  id={`prompt-msg`}
                  key={`prompt-msg`}
                  fullWidth
                  multiline
                  helperText={promptText}
                  value={textInput || ''}
                  onChange={(event) => {
                    handleChangeTextInput(event);
                  }}
                  onKeyPress={(event) => {
                    onCheckEnter(event);
                  }}
                  autoComplete='off'
                />
                <Box
                  key={'qRow'}
                  display="flex"
                  className={classes.qualOption}
                  flexDirection='column'
                  justifyContent="center"
                >
                  <Box display='flex' flexDirection='row' justifyContent='flex-start'
                    alignItems='center' flexWrap='wrap' key={'qrOpt'}
                  >
                    <Checkbox
                      className={classes.radioButton}
                      size="small"
                      onClick={() => { setIsUrgent(!isUrgent); }}
                      checked={isUrgent}
                    />
                    <Typography className={classes.radioText}>Mark as Urgent</Typography>
                  </Box>
                </Box>
              </Box>
            </DialogContent>
          </Box>
          <DialogActions style={{ justifyContent: 'center' }}>
            <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center' >
              {allowCancel &&
                <Button
                  className={classes.rowButtonReject}
                  size='small'
                  onClick={() => {
                    if (pRecipientID !== '*select') { onCancel(); }
                    setRecipientID(pRecipientID);
                  }}
                  startIcon={<CloseIcon size="small" />}
                >
                  {'Back'}
                </Button>
              }
              <Button
                className={classes.rowButtonConfirm}
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
        </React.Fragment>
      }
    </Dialog>

  );
};
