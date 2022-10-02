import React from 'react';
import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import CloseIcon from '@material-ui/icons/HighlightOff';
import SaveIcon from '@material-ui/icons/Save';

import CloudUploadIcon from '@material-ui/icons/CloudUpload';

import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Slide from '@material-ui/core/Slide';

var XLSX = require("xlsx");

const useStyles = makeStyles(theme => ({
  listItem: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  typeOfLine: {
    fontSize: theme.typography.fontSize * 0.8,
    marginBottom: 0,
  },
  observationLine: {
    marginTop: 0,
    fontSize: theme.typography.fontSize * 1.8,
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ pClient, showSheet, onClose }) => {

  const classes = useStyles();

  const [changeDetected, setChangeDetected] = React.useState(false);
  const [s3Filename, setS3Filename] = React.useState();

  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });
  const s3 = new AWS.S3({
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  const hiddenFileInput = React.useRef(null);

  const handleFileUpload = event => {
    hiddenFileInput.current.click();
  };

  async function handleSpreadsheet(pFile) {
    var req = new XMLHttpRequest();
    req.open("GET", pFile, true);
    req.responseType = "arraybuffer";
    req.onload = function (e) {
      var data = new Uint8Array(req.response);
      var workbook = XLSX.read(data, { type: "array" });
      runLambda(workbook);
    };
    req.send();
  };

  async function runLambda(pWorkbook) {
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:LoadSpreadsheet',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: ''
    };
    params.Payload = JSON.stringify({
      action: "work_orders",
      clientId: pClient,
      request: {
        "spreadsheet_data": pWorkbook
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
    onClose();
  }

  return (
    <Dialog open={showSheet} p={2}
      fullWidth
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
    >
      <React.Fragment>
        <DialogContentText className={classes.title} id='scroll-dialog-title'>
          {'Send Notifications'}
        </DialogContentText>
        <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
          {
            <DialogContent dividers={true} className={classes.dialogBox}>
              <Button
                className={classes.uploadButton}
                variant='contained'
                size='small'
                startIcon={<CloudUploadIcon />}
                onClick={handleFileUpload}
              >
                {'Choose File'}
              </Button>
              <input
                type="file"
                style={{ display: 'none' }}
                ref={hiddenFileInput}
                onChange={async (target) => {
                  let fObj = target.target.files[0];
                  const pFile = {
                    Bucket: 'theseus-medical-storage',
                    Key: 'public_uploads/' + fObj.name,
                    Body: fObj,
                    ACL: 'public-read-write',
                    ContentType: fObj.ContentType
                  };
                  enqueueSnackbar(`Uploading your file`, { variant: 'success', persist: true });
                  let s3Resp = await s3
                    .upload(pFile)
                    .promise()
                    .catch(err => {
                      enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
                    });
                  closeSnackbar();
                  setS3Filename(s3Resp.Location);
                  setChangeDetected(true);
                }}
              />
            </DialogContent>
          }
        </Paper>
        <DialogActions className={classes.buttonArea} >
          <Box display='flex' flexDirection='column'>
            <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
              <Button
                className={classes.rowButtonRed}
                size='small'
                onClick={onClose}
                startIcon={<CloseIcon size="small" />}
              >
                Cancel
              </Button>
              {changeDetected &&
                <Button
                  className={classes.rowButtonGreen}
                  size='small'
                  onClick={async () => { await handleSpreadsheet(s3Filename); }}
                  startIcon={<SaveIcon size="small" />}
                >
                  Process
                </Button>
              }
            </Box>
          </Box>
        </DialogActions>
      </React.Fragment>
    </Dialog>
  );
};