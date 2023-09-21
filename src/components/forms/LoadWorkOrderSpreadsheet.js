import React from 'react';
import { useSnackbar } from 'notistack';
import { getServiceRequests, updateServiceRequest, putServiceRequest } from '../../util/AVAServiceRequest';
import { makeDate } from '../../util/AVADateTime';
import { makeName, getPersonFromPartialID, getPersonFromLocation, getPersonByName } from '../../util/AVAPeople';

import Dialog from '@material-ui/core/Dialog';
import DialogContentText from '@material-ui/core/DialogContentText';

import LinearProgress from '@material-ui/core/LinearProgress';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';

import Paper from '@material-ui/core/Paper';
import Box from '@material-ui/core/Box';

import makeStyles from '@material-ui/core/styles/makeStyles';
// import useMediaQuery from '@material-ui/core/useMediaQuery';

import Slide from '@material-ui/core/Slide';
import { parseSpreadsheet } from '../../util/AVAUtilities';

import AVAUploadFile from '../../util/AVAUploadFile';

var XLSX = require("xlsx");

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

export default ({ pClient, showSheet, session, defaults, onClose }) => {

  const classes = useStyles();

  const [loading, setLoading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [pWidth, setPWidth] = React.useState(60);

  const { enqueueSnackbar } = useSnackbar();

  let defaultUser = 'AVA';
  if (Array.isArray(defaults) & (defaults.length > 0)) { defaultUser = defaults[0]; }
  else if (typeof defaults === 'string') { defaultUser = defaults; }

  let sheetData = [];

  const jobTime = new Date().getTime();

  async function handleSpreadsheet(pFile) {
    var req = new XMLHttpRequest();
    req.open("GET", pFile.fLoc, true);
    req.responseType = "arraybuffer";
    req.onload = async function (e) {
      var data = new Uint8Array(req.response);
      var workbook = XLSX.read(data, { type: "array" });
      sheetData = parseSpreadsheet(workbook);
      setLoading(true);
      await processXLSData();
      setLoading(false);
      enqueueSnackbar(`Finished with ${pFile.fName}!`, { variant: 'success', persist: true });
    };
    req.send();
  };

  async function processXLSData() {
    // sheetData contains info as sheetData[row][column] = value
    // headers are at headerRow (so we'll start at the next row after that)
    // key data is at sheetData[row][keyColumn]
    // columns we care about are in headerColumns
    let headers = {
      'Work Order #': { notify: false, request_data: false, key_data: true },
      'Open Date': { notify: false, request_data: false },
      'Closed Date': { notify: false, request_data: false },
      'Closed By': { notify: false, request_data: false },
      'Summary': { notify: true, request_data: true, description_data: true },
      'Details of your request': { notify: true, request_data: true, description_data: true },
      'Description': { notify: true, request_data: true, description_data: true },
      'Status': { notify: true, request_data: false },
      'Assigned To': { notify: true, request_data: true },
      'Area Name': { notify: false, request_data: true },
      'Comments': { notify: true, request_data: true, description_data: true },
      'Initiated By': { notify: false, request_data: false },
      'Requested By': { notify: false, request_data: false }
    };
    let foundHeader = false;
    let statusHeader = 'Status';
    let dateHeader = 'Open Date';
    let closedDate = 'Closed Date';
    let closedBy = 'Closed By';
    let keyHeader = 'Work Order #';
    let notesHeader = 'Comments';
    let personHeader = 'Requested By';
    let adminHeader = 'Initiated By';
    let locationHeader = 'Area Name';
    let sdL = sheetData.length;
    setPWidth(100);
    for (let activeRow = 0; activeRow < sdL; activeRow++) {
      setProgress((activeRow / sdL) * 100);
      if (!sheetData[activeRow]) { continue; }
      if (!foundHeader) {
        // ignore this row until we've found headers, then start with next row
        let rowData = Object.values(sheetData[activeRow]);
        if ((rowData.length >= 4) && (rowData.some(c => { return Object.keys(headers).includes(c); }))) {
          foundHeader = true;
          // eslint-disable-next-line
          Object.keys(headers).forEach(h => {
            for (let sheetColumn in sheetData[activeRow]) {
              if (sheetData[activeRow][sheetColumn] === h) {
                headers[h].column = sheetColumn;
              }
            }
          });
        }
        continue;
      }
      // process detail rows
      let needsUpdate = false;
      let reqRec;
      if (sheetData[activeRow][headers[keyHeader].column]) {     // if the row lists a foreign key...
        let reqRecs = await getServiceRequests({    // see if there is a request for that foreign key already
          client_id: pClient,
          foreign_key: sheetData[activeRow][headers[keyHeader].column]
        });
        // if multiple request exist for that key, take the last (most recent) one
        let rL = reqRecs.length;
        if (rL > 0) {
          reqRec = reqRecs[rL - 1];
        }
      }
      if (!reqRec) {   // there is no foreign key (TELS number, eg)
        // is there a local key in any cell?
        findLocal: for (let c in sheetData[activeRow]) {
          let wordList = sheetData[activeRow][c].split(' ');
          for (let w = 0; w < wordList.length; w++) {
            let thisWord = wordList[w];
            if (/[0-9]-[0-9]/.test(thisWord)) {
              let reqRecs = await getServiceRequests({
                client_id: pClient,
                local_key: thisWord
              });
              let rL = reqRecs.length;    // if more than 1 request found with this local key, use most recent one
              if (rL > 0) {
                reqRec = reqRecs[rL - 1];
                break findLocal;
              }
            }
          }
        }
      }
      let guessedAuthor, guessedOBO;
      if (!reqRec) {  // No foreign key and no local key
        // Can we figure out who the person is associated with this request?
        if (sheetData[activeRow][headers[locationHeader].column]) {
          let possibles = await getPersonFromLocation(pClient, sheetData[activeRow][headers[locationHeader].column]);
          if (possibles.length > 0) {
            guessedAuthor = possibles[0].person_id;
            guessedOBO = await makeName(guessedAuthor);
          }
        }
        if (!guessedAuthor && (sheetData[activeRow][headers[personHeader].column])) {
          let possibles = await getPersonFromPartialID(pClient, sheetData[activeRow][headers[personHeader].column].toLowerCase());
          if (possibles.length > 0) {
            guessedAuthor = possibles[0].person_id;
            guessedOBO = await makeName(guessedAuthor);
          }
        }
        if (!guessedAuthor && (sheetData[activeRow][headers[adminHeader].column])) {
          let possibles = await getPersonByName(pClient, sheetData[activeRow][headers[adminHeader].column].toLowerCase());
          if (possibles.length > 0) {
            guessedAuthor = possibles[0].person_id;
          }
        }
        // if we have a guessedAuthor, is there an open Service Request for this person that matches
        // three or more of the words in this request (provided that the word is four letters long or longer)
        if (guessedAuthor) {
          let guessedRecs = await getServiceRequests({
            person: guessedAuthor,
            request_type: 'maint'
          });
          // step 1 - remove any closed or completed requests
          let openRecs = [];
          if (guessedRecs && (guessedRecs.length > 0)) {
            guessedRecs.forEach(g => {
              if (!(['closed', 'completed', 'cancelled'].includes(g.last_status.toLowerCase()))) {
                openRecs.push(g);
              }
            });
          }
          if (openRecs.length > 0) {
            // step 2 - get all of the four+ letter words that are in the spreadsheet's description columns
            let descriptive_words = [];
            for (let h in headers) {
              if (headers[h].description_data && sheetData[activeRow][headers[h].column]) {
                sheetData[activeRow][headers[h].column].split(/\s/).forEach(w => {
                  if ((w.length > 3) && !(descriptive_words.includes(w))) { descriptive_words.push(w); }
                });
              }
            }
            for (let g = 0; g < openRecs.length; g++) {
              let gRec = openRecs[g];
              let request_words = [];
              // step 3 - get all of the descriptive_words in the original request
              if (gRec.original_request.hasOwnProperty('textInput')) {
                if (typeof gRec.original_request.textInput === 'string') {
                  gRec.original_request.textInput.split(/\s/).forEach(w => {
                    if ((w.length > 3) && !(request_words.includes(w))) { request_words.push(w); }
                  });
                }
                else {
                  Object.keys(gRec.original_request.textInput).forEach(k => {
                    if (headers.hasOwnProperty(k) && headers[k].description_data) {
                      gRec.original_request.textInput[k].split(/\s/).forEach(w => {
                        if ((w.length > 3) && !(request_words.includes(w))) { request_words.push(w); }
                      });
                    }
                  });
                }
              }
              // step 4 - does this request include three or more of the descriptive_words?
              let count = 0;
              descriptive_words.forEach(d => {
                request_words.forEach(r => {
                  if (d === r) { count++; }
                });
              });
              if (count > 2) {
                reqRec = gRec;
                needsUpdate = true;
                break;
              }
            }
          }
        }
      }
      let textInput = {};
      for (let h in headers) {
        if (headers[h].request_data) {
          textInput[h] = sheetData[activeRow][headers[h].column];
        }
      }
      let statusMessage, updateTime;
      if (sheetData[activeRow][headers[statusHeader].column] && (!reqRec || (sheetData[activeRow][headers[statusHeader].column] !== reqRec.last_status))) {
        needsUpdate = true;
        if (sheetData[activeRow][headers[closedDate].column]) {
          let closeTime = makeDate(sheetData[activeRow][headers[closedDate].column]);
          statusMessage = `Closed ${closeTime.absolute}`;
          updateTime = closeTime.timestamp;
          if (sheetData[activeRow][headers[closedBy].column]) {
            statusMessage += ` by ${sheetData[activeRow][headers[closedBy].column]}`;
          }
        }
        else {
          let statusFrom = '';
          if (reqRec && reqRec.last_status) {
            statusFrom = ` from ${reqRec.last_status}`;
          }
          statusMessage = `Status changed${statusFrom} to ${sheetData[activeRow][headers[statusHeader].column]}`;
        }
      }
      if (!reqRec) {
        let fKey = sheetData[activeRow][headers[keyHeader].column];
        await putServiceRequest({
          client: pClient,
          author: guessedAuthor || defaultUser,
          requestType: 'maint',
          requestDate: makeDate(sheetData[activeRow][headers[dateHeader].column]).timestamp,
          onBehalfOf: guessedOBO || 'Maintenance Team',
          foreign_key: fKey,
          update_time: updateTime,    // if null, putServiceRequest will set to current time
          history: [statusMessage],
          requestStatus: sheetData[activeRow][headers[statusHeader].column],
          notes: sheetData[activeRow][headers[notesHeader].column],
          request: { textInput }
        });
      }
      else if (needsUpdate) {
        // found an existing request...  update it
        reqRec.last_status = sheetData[activeRow][headers[statusHeader].column];
        reqRec.last_update = updateTime || jobTime;
        if (statusMessage) {
          if (!reqRec.history) { reqRec.history = []; }
          reqRec.history.unshift(statusMessage);
        }
        if (!reqRec.original_request || (typeof (reqRec.original_request) === 'string')) {
          let prevText = reqRec.original_request || 'none';
          reqRec.original_request = { textInput: { 'Original request': prevText } };
        }
        for (let i in textInput) {
          if (textInput[i] === reqRec.original_request.textInput[i]) { continue; }
          reqRec.original_request.textInput[i] = textInput[i];
          if (!reqRec.history) { reqRec.history = []; }
          reqRec.history.push(`${i} changed to ${textInput[i]}`);
        }
        await updateServiceRequest(reqRec);
      }
    }
  }

  return (
    <Dialog open={showSheet} p={2}
      fullWidth
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
    >
      {loading &&
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
            src={session?.client_logo || process.env.REACT_APP_AVA_LOGO}
          />
          <React.Fragment>
            <Box
              display='flex' flexDirection='column' justifyContent='center' alignItems='center'
              flexWrap='wrap' textOverflow='ellipsis' width='100%'
              key={'loadingBox'}
              mb={2}
            >
              <Typography variant='h5' className={classes.lastName} >{`Loading Work Order data`}</Typography>
              <Typography variant='caption' >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
            </Box>
            <LinearProgress variant="determinate" className={classes.progressBar} style={{ width: pWidth }} value={progress} />
            <CircularProgress />
          </React.Fragment>
        </Box>
      }
      {!loading &&
        <React.Fragment>
          <DialogContentText className={classes.title} id='scroll-dialog-title'>
            {'Upload Work Order updates to AVA'}
          </DialogContentText>
          <Paper component={Box} className={classes.page} overflow='auto' square>
            <AVAUploadFile
              onLoad={async (fileList) => {
                if (fileList.length === 0) { onClose(); }
                else { await handleSpreadsheet(fileList[0]); }
              }}
              onCancel={onClose}
              options={{ title: 'Choose file(s) to process' }}
            />
          </Paper >
        </React.Fragment >
      }
    </Dialog >
  );

};