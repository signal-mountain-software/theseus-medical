import React from 'react';
import { useSnackbar } from 'notistack';
import { makeArray, uuid, s3 } from '../../util/AVAUtilities';
import { getPersonByWords } from '../../util/AVAPeople';
import { makeDate } from '../../util/AVADateTime';
import { getServiceRequests } from '../../util/AVAServiceRequest';

import MakeMessage from './MakeMessage';
import AVAConfirm from '../forms/AVAConfirm';

import Dialog from '@material-ui/core/Dialog';
import DialogContentText from '@material-ui/core/DialogContentText';

import LinearProgress from '@material-ui/core/LinearProgress';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';

import Box from '@material-ui/core/Box';

import makeStyles from '@material-ui/core/styles/makeStyles';
// import useMediaQuery from '@material-ui/core/useMediaQuery';

import Slide from '@material-ui/core/Slide';
import { parseSpreadsheet } from '../../util/AVAUtilities';

import AVAUploadFile from '../../util/AVAUploadFile';

import useSession from '../../hooks/useSession';

var XLSX = require("xlsx");
const StepFunctions = require('aws-sdk/clients/stepfunctions');

const useStyles = makeStyles(theme => ({
  listItem: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2)
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
    fontWeight: 'bold'
  },
  progressBar: {
    marginBottom: theme.spacing(3),
    backgroundColor: '#a3a0a0',
    color: '#000000',
    transition: 'none',
    height: '5px'
  },
  subTitle: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '0.8rem'
  },
  typeOfLine: {
    fontSize: theme.typography.fontSize * 0.8,
    marginBottom: 0,
  },
  observationLine: {
    marginTop: 0,
    fontSize: theme.typography.fontSize * 1.8,
  },
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    paddingRight: 0,
    minWidth: '100%',
  },
  page: {
    maxWidth: 1000
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
    color: theme.palette.confirm[theme.palette.type],
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ onClose }) => {

  const classes = useStyles();
  const { state } = useSession();
  const stepFunctions = new StepFunctions();

  const [reactData, setReactData] = React.useState({
    loading: false,
    initialized: false,
    pWidth: 100,
    progress: 0,
    stage: 'get_file',
  });
  const [forceRedisplay, setForceRedisplay] = React.useState(true);
  const [filesProcessed, setFilesProcessed] = React.useState([{}]);

  const { enqueueSnackbar } = useSnackbar();

  async function handleFiles(fileList) {
    let summaryList = [];
    for (let f = 0; f < fileList.length; f++) {
      if (!fileList[f].fName) { fileList[f].fName = `File uploaded ${makeDate(new Date()).absolute}`; }
      switch (fileList[f].fType.toLowerCase()) {
        case 'csv':
        case 'xls':
        case 'xlsx': {
          let sheetData = await handleSpreadsheet(fileList[f]);
          let sheetObj = await processXLSData(sheetData);
          if (!sheetObj) {
            enqueueSnackbar(`${fileList[f].fName} has type ${fileList[f].fType}, but is not a valid spreadsheet`, { variant: 'error', persist: true });
          }
          else if (sheetObj.count === 0) { 
            enqueueSnackbar(sheetObj.message, { variant: 'error', persist: true });
          }
          else {
            summaryList.push(...sheetObj.peopleList);
          }
          break;
        }
        default: {
          enqueueSnackbar(`AVA is unable to translate the file type ${fileList[f].fType} for ${fileList[f].fName}!`, { variant: 'error', persist: true });
        }
      }
    }
    let recipientList = [];
    let recipientNameList = [];
    let nowTime = makeDate(new Date()).numeric$;
    let thread_id = `welfare_check.${state.session.client_id}.${nowTime}.${uuid(6)}`;
    let callList = [];
    for (let l = 0; l < summaryList.length; l++) {
      let p = summaryList[l];
      if (p.pStatus === 'no match') { p.result = 'No call - no AVA account found'; }
      else if (p.pStatus === 'multiple') { p.result = 'No call - multiple AVA accounts found'; }
      else {
        if (!p.pRec.local_data
          || !p.pRec.local_data.hasOwnProperty('welfare check phone number')
          || p.pRec.local_data['welfare check phone number'] === '') {
          p.result = 'No call - person is on the exclusion list;';
        }
        else {
          if (recipientList.includes(p.pID)) { p.result = 'Duplicate'; }
          else {
            recipientList.push(p.pID);
            recipientNameList.push(p.pName);
            p.result = 'Placed on call list';
            p.thread = thread_id;
          }
        }
        let reqArray = await getServiceRequests({
          client_id: state.session.client_id,
          person_id: p.pID,
          foreign_key: 'resident',
          request_type: "checkout"
        });
        if ((reqArray.length > 0) && (reqArray[0].last_status === 'out')) {
          p.result += ` (Checked out since ${makeDate(reqArray[0].last_update).relative})`;
        }
      }
      callList.push({
        AVA_ID: p.pID,
        Resident: p.pName,
        Action: p.result,
        Status: (p.thread ? 'Submitted' : 'Complete - no call')
      });
    };
    if (recipientList.length === 0) {
      enqueueSnackbar(`Nobody found to contact!`, { variant: 'error', persist: false });
      reactData.stage = 'get_file';
    }
    else {
      reactData.stage = 'confirm_list';
    }
    reactData.request = {
      client: state.session.client_id,
      author: state.session.person_id,
      messageText: `We didn't receive an acknowledgement from the check-in system for you today.  This call is to confirm all is well.`,
      recipientList,
      recipientNameList,
      subject: 'Your daily check-in',
      thread_id,
      preffered_method: 'urgent'
    };
    reactData.callList = callList;
    // **** RAY SAVE THE CALL LIST SOMEWHERE??? ****
    let newWorksheet = XLSX.utils.json_to_sheet(callList, {});
    let newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Call List");
    let bufferInfo = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'csv' });
    const pFile = {
      Bucket: 'theseus-medical-storage',
      Key: `public_uploads/${thread_id}.csv`,
      Body: bufferInfo,
      ACL: 'public-read-write',
    };
    enqueueSnackbar(`Uploading your results report`, { variant: 'success' });
    let s3Resp = await s3
      .upload(pFile)
      .promise()
      .catch(err => {
        enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
      });
    // Schedule follow-up
    const stateMachineArn = 'arn:aws:states:us-east-1:125549937716:stateMachine:MessageFollowUp';
    await stepFunctions.startExecution({
      stateMachineArn,
      input: JSON.stringify({
        requestor: state.session.user_id,
        client_id: state.session.client_id,
        thread_id,
        s3File: s3Resp.Location,
        localName: fileList[0].fName || ''
      }),
    }).promise();
    // Done
    reactData.loading = false;
    setReactData(reactData);
    setForceRedisplay(forceRedisplay => !forceRedisplay);
  };

  async function handleSpreadsheet(pFile) {
    return new Promise(function (resolve, reject) {
      reactData.loading = true;
      setReactData(reactData);
      setForceRedisplay(forceRedisplay => !forceRedisplay);
      var req = new XMLHttpRequest();
      req.open("GET", pFile.fLoc, true);
      req.responseType = "arraybuffer";
      req.onload = async function () {
        var data = new Uint8Array(req.response);
        var workbook = XLSX.read(data, { type: "array" });
        let sheetData = parseSpreadsheet(workbook);
        if (!sheetData) { reject(`Nothing returned`); }
        else { resolve(sheetData); }
      };
      req.send();
    });
  };

  async function processXLSData(sheetData) {
    // We're going to look for a column that contains names
    // First, look for something that looks like a column header.  A cell with the word "name" in it.
    // sheetData is an array of arrays 
    //    it contains info as sheetData[row] = columnObj 
    //    where each columnObj[columnNumber] = cellValue
    let nameColumn, headerRow;
    let sdL = sheetData.length;
    for (let activeRow = 0; activeRow < sdL; activeRow++) {
      reactData.progress = ((activeRow / sdL) * 100);
      setReactData(reactData);
      setForceRedisplay(forceRedisplay => !forceRedisplay);
      if (!sheetData[activeRow]) { continue; }
      let rowData = Object.entries(sheetData[activeRow]);
      // eslint-disable-next-line
      if (rowData.some(([column, cellValue]) => {
        if (cellValue.toLowerCase() === 'name') {
          nameColumn = column;
          headerRow = activeRow;
          return true;
        }
        return false;
      })) { break; }
    }
    if (!headerRow) {
      return {
        count: 0,
        message: 'No name column was found'
      };
    }
    let nameList = [];
    for (let activeRow = headerRow + 1; activeRow < sdL; activeRow++) {
      reactData.progress = ((activeRow / sdL) * 100);
      setReactData(reactData);
      setForceRedisplay(forceRedisplay => !forceRedisplay);
      if (!sheetData[activeRow].hasOwnProperty(nameColumn)) { continue; }
      nameList.push(sheetData[activeRow][nameColumn]);
    }
    if (nameList.length === 0) {
      return {
        count: 0,
        message: 'Name column was empty'
      };
    }
    let returnObj = {
      count: 0,
      found: 0
    };
    let returnList = [];
    for (let x = 0; x < nameList.length; x++) {
      let this_name = nameList[x];
      let pList = await getPersonByWords(state.session.client_id, makeArray(this_name.replace(',', ' ').toLowerCase(), ' '));
      returnObj.found += pList.length;
      returnObj.count++;
      switch (pList.length) {
        case 0: {
          returnList.push({ pID: '', pName: this_name, pRec: {}, pStatus: 'no match' });
          break;
        }
        case 1: {
          returnList.push({ pID: pList[0].person_id, pName: this_name, pRec: pList[0], pStatus: 'match' });
          break;
        }
        default: {
          returnList.push({ pID: pList.map(p => { return p.person_id; }), pName: this_name, pRec: pList, pStatus: 'multiple' });
        }
      }
    };
    if (returnObj.found === 0) {
      returnObj.message = `None of the ${returnObj.count} names matched an account`;
    }
    else {
      returnObj.message = `${returnObj.found} accounts found`;
    }
    returnObj.peopleList = returnList;
    return returnObj;
  }

  return (
    <Dialog open={forceRedisplay || true} p={2}
      fullWidth
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
    >
      {reactData.loading &&
        <Box
          display='flex' flexDirection='column' justifyContent='center' alignItems='center'
          key={'loadingBox'}
          ml={2} mr={2} mb={2} mt={8}
        >
          <Box
            component="img"
            mb={2}
            minWidth={150}
            maxWidth={150}
            alt=''
            src={state.session.client_logo || process.env.REACT_APP_AVA_LOGO}
          />
          <React.Fragment>
            <Box
              display='flex' flexDirection='column' justifyContent='center' alignItems='center'
              flexWrap='wrap' textOverflow='ellipsis' width='100%'
              key={'loadingBox'}
              mb={2}
            >
              <Typography variant='h5' className={classes.lastName} >{`Loading Call List data`}</Typography>
              <Typography variant='caption' >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
            </Box>
            <LinearProgress variant="determinate" className={classes.progressBar} style={{ width: reactData.pWidth }} value={reactData.progress} />
            <CircularProgress />
          </React.Fragment>
        </Box>
      }
      {!reactData.loading &&
        <React.Fragment>
          {(reactData.stage === 'get_file') &&
            <Dialog open={forceRedisplay || true} p={2}
              fullWidth
              variant={'elevation'} elevation={2}
              TransitionComponent={Transition}
            >
              <DialogContentText className={classes.title} id='scroll-dialog-title'>
                {'Daily Welfare Call Sheet'}
              </DialogContentText>
              <AVAUploadFile
                onCancel={() => { onClose(); }}
                onLoad={async (fileList) => {
                  await handleFiles(fileList);
                }}
                options={{ title: 'Choose file(s) to process', buttonText: ['Exit', 'Process this file', 'Process these files'] }}
              />
            </Dialog>
          }
          {(reactData.stage === 'confirm_list') &&
            <AVAConfirm
              promptText={[`You are going to call ${reactData.request.recipientList.length} people.  Please confirm.`]}
              cancelText={`Cancel`}
              confirmText={`Confirm and proceed`}
              onCancel={() => {
                enqueueSnackbar(`Cancel request acknowledged.  No calls were placed.`, { variant: 'error', persist: true });
                onClose();
              }}
              onConfirm={() => {
                reactData.stage = 'send_message';
                setReactData(reactData);
                setForceRedisplay(forceRedisplay => !forceRedisplay);
              }}
              allowCancel={true}
            />
          }
          {(reactData.stage === 'send_message') &&
            <MakeMessage
              titleText={'Welfare Check Call'}
              promptText={[`Subject`, `Message`]}
              buttonText={'Send'}
              sender={state.session}
              pRecipientID={reactData.request.recipientList}
              pRecipientName={reactData.request.recipientNameList}
              onCancel={() => {
                reactData.stage = 'get_file';
                setReactData(reactData);
                filesProcessed.unshift()
                setFilesProcessed(filesProcessed);
                setForceRedisplay(forceRedisplay => !forceRedisplay);
              }}
              onComplete={() => {
                onClose();
              }}
              allowCancel={true}
              thread_id={reactData.request.thread_id}
              seedText={[reactData.request.subject, reactData.request.messageText]}
            />
          }
        </React.Fragment >
      }
    </Dialog >
  );
};