import React from 'react';

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
  recipientID,
  recipientName,
  onCancel,
  onComplete,
  allowCancel = true
}) => {

  const classes = useStyles();

  const { enqueueSnackbar } = useSnackbar();

  const [textInput, setTextInput] = React.useState('');
  const [forceRedisplay, setForceRedisplay] = React.useState(true);
  const [isUrgent, setIsUrgent] = React.useState(false);
  const [imageURL, setImageURL] = React.useState('');

  const handleChangeTextInput = (event) => {
    setTextInput(event.target.value);
    setForceRedisplay(!forceRedisplay);
  };

  const noInput = () => {
    return (!textInput);
  };

  const handleSave = async () => {
    let postTime = new Date().getTime();
    let messageValue =
      'form_selections.'
      + 'MessageText = ' + textInput
      + ' ~ Recipient = ' + recipientName + ':' + recipientID;
    messageValue += ' ~ Urgent = ' + (isUrgent ? 'urgent' : 'normal');
    const newFact = {
      person_id: sender.patient_id,
      activity_key: (sender.client_id ? ((sender.client_id) + '//') : '') + 'MakeMessage#' + postTime,
      value: messageValue,
      status: 'recorded',
      user_id: sender.user_id,
      session_id: sender.session_id,
      method: 'AVAMenu',
      posted_time: postTime
    };
    await dbClient
      .put({
        TableName: 'Facts',
        Item: newFact
      })
      .promise()
      .catch(error => { console.error('Error adding a fact:', error.message); });
    enqueueSnackbar(`Your ${isUrgent ? 'urgent' : ''} message is on the way to ${recipientName}`, { variant: 'success' });
  };

  const onCheckEnter = async (event) => {
    if (event.key === 'Enter') { await handleSave(); }
  };

  function getImage(pPerson) {
    if (!imageURL) {
      const imageBucket = 'theseus-medical-storage';
      const imageURI = `public/patients/${pPerson}.jpg`;
      setImageURL(s3.getSignedUrl('getObject', {
        Bucket: imageBucket,
        Key: imageURI,
        Expires: 3600
      }));
    }
    return imageURL;
  };

  // **************************

  return (
    <Dialog open={forceRedisplay || true} fullScreen className={classes.containerBox}>
      <Box display='flex'
        grow={1}
        mb={0}
        flexDirection='column'
        justifyContent='center'
        alignItems='flex-start'
      >
        <DialogContentText className={classes.title} id='scroll-dialog-title'>
          {titleText || `Send a message to ${recipientName}`}
        </DialogContentText>
        <Box>
          <Box
            className={classes.imageArea}
            component="img"
            alt=''
            src={getImage(recipientID)}
          />
        </Box>
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
            <TextField
              classes={{ root: classes.idText }}
              id={`prompt-msg`}
              key={`prompt-msg`}
              fullWidth
              multiline
              inputRef={input => input && input.focus()}
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
                onCancel();
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
    </Dialog>
  );
};
