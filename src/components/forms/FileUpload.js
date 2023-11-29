import React from 'react';

import { s3 } from '../../util/AVAUtilities';

import { useSnackbar } from 'notistack';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import LoadIcon from '@material-ui/icons/GetApp';
import CloseIcon from '@material-ui/icons/HighlightOff';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';

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
    minWidth: '100%',
  },
  screenBody: {
    minWidth: '100%',
    marginBottom: theme.spacing(2)
  },
  rowButtonRed: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
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
  uploadButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    border: '0.4px solid gray',
    textTransform: 'none',
    fontWeight: 'bold',
    size: 'small',
    color: theme.palette.primary[theme.palette.type],
  },
  rowButtonReject: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    border: '0.4px solid gray',
    textTransform: 'none',
    fontWeight: 'bold',
    size: 'small',
    color: theme.palette.reject[theme.palette.type],
  },
  rowButtonGreen: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
  },
  radioButton: {
    marginTop: 0,
    marginRight: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
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
  prompt: {
    marginTop: 0,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.0rem'
  },
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
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

export default ({ promptText, pClient, fileTag, onCancel }) => {

  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();

  const [forceRedisplay, setForceRedisplay] = React.useState(true);

  const [reactData, setReactData] = React.useState({
    fileType: '',
    fileName: '',
    file: '',
    loading: false
  });

  const hiddenFileInput = React.useRef(null);

  const handleFileUpload = event => {
    hiddenFileInput.current.click();
  };

  function handleStoreReference(pTarget) {
    reactData.fileType = pTarget.type;
    reactData.fileName = pTarget.name;
    reactData.file = pTarget;
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
    return;
  }

  async function handleSaveFileOld() {
    reactData.loading = true;
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
    let s3Resp = await s3
      .upload({
        Bucket: 'theseus-medical-storage',
        Key: `${pClient}_${fileTag[0]}`,
        Body: reactData.file,
        ACL: 'public-read-write',
        ContentType: reactData.fileType
      })
      .promise()
      .catch(err => {
        enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
      });
    console.log(s3Resp);
    onCancel();
  };

  async function handleSaveFile() {
    reactData.loading = true;
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
    let s3Resp = await s3
      .upload({
        partSize: 10 * 1024 * 1024, queueSize: 1,
        params: {
          Bucket: 'theseus-medical-storage',
          Key: `${pClient}_${fileTag[0]}`,
          Body: reactData.file,
          ACL: 'public-read-write',
          ContentType: reactData.fileType
        }
      })
      .promise()
      .on('httpUploadProgress', ((evt) => {
        console.log("Uploaded :: " + parseInt((evt.loaded * 100) / evt.total) + '%');
      }))
      .catch(err => {
        enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
      });
    console.log(s3Resp);
    onCancel();
  };


  // **************************

  return (
    <Dialog open={forceRedisplay || true} fullWidth className={classes.containerBox}>
      <Box display='flex'
        grow={1}
        mb={0}
        flexDirection='column'
        justifyContent='center'
        alignItems='flex-start'
        className={classes.screenBody}
      >
        <DialogContentText className={classes.title} id='dialog-title'>
          {'Upload a File to AVA'}
        </DialogContentText>
        <DialogContentText className={classes.prompt} id='dialog-prompt'>
          {promptText}
        </DialogContentText>
        <DialogContent className={classes.contentBox} id='dialog-content'>
          <Box
            display='flex'
            grow={1}
            pt={1}
            mb={0}
            id={`contentsColumn`}
            key={`contentsColumn`}
            flexDirection='column'
            justifyContent='center'
            alignItems='flex-start'
          >
            <Button
              className={classes.uploadButton}
              size='small'
              startIcon={<CloudUploadIcon />}
              onClick={handleFileUpload}
            >
              {`Select a ${reactData.fileName ? 'different' : ''} File`}
            </Button>
            <input
              type="file"
              style={{ display: 'none' }}
              ref={hiddenFileInput}
              onChange={(target) => {
                handleStoreReference(target.target.files[0]);
                setForceRedisplay(!forceRedisplay);
              }}
            />
          </Box>
        </DialogContent>
        {reactData.fileName &&
          <DialogContentText className={classes.prompt} id='dialog-prompt'>
            {`You selected ${reactData.fileName}`}
          </DialogContentText>
        }
      </Box>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
          <Button
            className={classes.rowButtonReject}
            size='small'
            onClick={() => {
              onCancel();
            }}
            startIcon={<CloseIcon size="small" />}
          >
            {'Cancel'}
          </Button>
          {reactData.fileName &&
            <React.Fragment>
              {reactData.loading
                ?
                < Button
                  className={classes.rowButtonGreen}
                  size='small'
                >
                  {'Loading'}
                </Button>
                :
                < Button
                  className={classes.rowButtonConfirm}
                  size='small'
                  onClick={async () => { await handleSaveFile(); }}
                  startIcon={<LoadIcon size="small" />}
                >
                  {'Confirm'}
                </Button>
              }
            </React.Fragment>
          }
        </Box>
      </DialogActions>
    </Dialog>
  );
};
