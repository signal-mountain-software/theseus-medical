import React from 'react';
import { useSnackbar } from 'notistack';
import { parseSpreadsheet, makeArray, uuid, s3, stepFunctions, resolveVariables } from '../../util/AVAUtilities';
import { getPersonByWords, getPerson } from '../../util/AVAPeople';
import { determineClass } from '../../util/AVAGroups';
import { makeDate } from '../../util/AVADateTime';
import { getServiceRequests } from '../../util/AVAServiceRequest';
import { AVAclasses } from '../../util/AVAStyles';

import AVAUploadFile from '../../util/AVAUploadFile';
import MakeMessage from './MakeMessage';
import AVAConfirm from '../forms/AVAConfirm';

import Dialog from '@material-ui/core/Dialog';
import DialogContentText from '@material-ui/core/DialogContentText';

import LinearProgress from '@material-ui/core/LinearProgress';
import CircularProgress from '@material-ui/core/CircularProgress';
import Typography from '@material-ui/core/Typography';

import Box from '@material-ui/core/Box';
import Slide from '@material-ui/core/Slide';

import useSession from '../../hooks/useSession';

var XLSX = require("xlsx");

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ options = { runType: 'welfare_check' }, onClose }) => {

  const { state } = useSession();
  const AVAClass = AVAclasses();

  if (!options.runType) {
    options.runType = 'welfare_check';
  }

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
    let localFileName;
    if (fileList.length === 1) { localFileName = fileList[0].fName; }
    else { localFileName = `Multiple (${fileList.length - 1}) files uploaded ${makeDate(new Date()).absolute}`; }
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
    let testList = [];
    let substituteNames = false;
    if (state.session[options.runType] && state.session[options.runType].testList) {
      testList = makeArray(state.session[options.runType].testList);
      substituteNames = true;
    }
    let recipientList = [];
    let recipientNameList = [];
    let nowTime = makeDate(new Date()).numeric$;
    let thread_id = `${options.runType}.${state.session.client_id}.${nowTime}.${uuid(6)}`;
    let callList = [];
    let noCallList = [];
    let colWidth = {
      AVA_ID: 10,
      Name: 25,
      Action: 10,
      Status: 10
    };
    let fakeNumber = 0;
    for (let l = 0; l < summaryList.length; l++) {
      let p = summaryList[l];
      let avaID = p.pID;
      if (p.pStatus === 'no match') {
        p.result = 'No AVA account found';
      }
      else if (p.pStatus.startsWith('multiple inactive')) {
        p.result = `${p.pStatus.split(':')[1]} accounts found.  All are inactive.`;
      }
      else if (determineClass(p.pRec.groups, state.session.group_assignments) === 'inactive') {
        p.result = 'This is an inactive account';
      }
      else if (p.pStatus === 'multiple') {
        p.result = 'Multiple AVA accounts found';
      }
      else if (excludeThisPerson(p.pRec)) {
        p.result = 'Person is on the exclusion list';
      }
      else if (recipientList.includes(p.pID)) {
        p.result = 'Duplicate';
      }
      else {
        if (substituteNames) {
          let tID = testList.shift();
          if (tID) {
            p.result = 'Message Scheduled';
            recipientList.push(tID);
            avaID = tID;
          }
          else {
            p.result = 'Message would have been sent, but no substitute for testing identified';
            recipientList.push(`fakeID_${fakeNumber++}`);
          }
        }
        else {
          recipientList.push(p.pID);
          p.result = 'Message Scheduled';
        }
        recipientNameList.push(p.pName);
        p.thread = thread_id;
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
      if (p.result.startsWith('Message Scheduled')) {
        let rowData = {
          AVA_ID: avaID,
          Name: p.pName,
          Action: p.result,
          Status: 'Submitted'
        };
        callList.push(rowData);
        Object.keys(rowData).forEach(k => { 
          let w = rowData[k].length;
          if (w > colWidth[k]) { colWidth[k] = w; }
        })
      }
      else {
        let rowData = {
          AVA_ID: avaID,
          Name: p.pName,
          Action: p.result,
          Status: 'No message'
        }
        noCallList.push(rowData);
        Object.keys(rowData).forEach(k => {
          let w = rowData[k].length;
          if (w > colWidth[k]) { colWidth[k] = w; }
        })
      }
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
      messageText: ``,
      recipientList,
      recipientNameList,
      subject: `sentenceCase(${options.runType})`,
      thread_id,
      preffered_method: 'urgent',
      localFileName
    };
    if (state.session[options.runType] && state.session[options.runType].message) {
      if (state.session[options.runType].message.text) {
        reactData.request.messageText = await resolveVariables(state.session[options.runType].message.text, state.session);
      }
      if (state.session[options.runType].message.voiceMail) {
        reactData.request.voiceMailMessage = await resolveVariables(state.session[options.runType].message.voiceMail, state.session);
      }
      if (state.session[options.runType].message.subject) {
        reactData.request.subject = await resolveVariables(state.session[options.runType].message.subject, state.session);
      }
      if (state.session[options.runType].message.author) {
        reactData.request.author = state.session[options.runType].message.author;
      }
    }
    callList.sort((a, b) => {
      if (a.Name < b.Name) { return -1; }
      else { return 1; }
    });
    noCallList.sort((a, b) => {
      if (a.Name < b.Name) { return -1; }
      else { return 1; }
    });
    let emptyRow = {
      AVA_ID: '',
      Name: '',
      Action: '',
      Status: ''
    };
    let finalList = [];
    finalList.push(emptyRow);
    finalList.push(...callList);
    finalList.push(emptyRow);
    finalList.push(emptyRow);
    finalList.push(emptyRow);
    finalList.push(...noCallList);
    reactData.callList = finalList;
    let newWorksheet = XLSX.utils.json_to_sheet(finalList, {});
    newWorksheet["!cols"] = Object.values(colWidth).map(v => { return {wch: v}})
    let newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Call List");
    let bufferInfo = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });
    const pFile = {
      Bucket: 'theseus-medical-storage',
      Key: `public_uploads/${thread_id}.xlsx`,
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
    reactData.request.s3Upload = s3Resp.Location;
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

  function excludeThisPerson(pRec) {
    let notExcluded = false;
    let excluded = true;
    if (!state.session[options.runType] || !state.session[options.runType].filter) {
      return notExcluded;
    }
    let filters = makeArray(state.session[options.runType].filter);
    for (let f = 0; f < filters.length; f++) {
      let this_filter = filters[f];
      let a = this_filter.property.split('.');
      let result = a.reduce((val, c, x) => {
        if (!val) { return false; }
        return val[a[x]];
      }, pRec);
      if (this_filter.if_exists === 'exclude') { return (result ? excluded : notExcluded); }
      else { return (result ? notExcluded : excluded); }
    };
  }

  async function processXLSData(sheetData) {
    // We're going to look for a column that contains names
    // First, look for something that looks like a column header.  A cell with the word "name" in it.
    // sheetData is an array of arrays 
    //    it contains info as sheetData[row] = columnObj 
    //    where each columnObj[columnNumber] = cellValue

    let key_column;
    let headerRow = -1;
    let keyWord = 'name';
    let hasHeaderRow = true;
    if (state.session[options.runType] && state.session[options.runType].spreadsheet) {
      if (state.session[options.runType].spreadsheet.key_column) {
        key_column = state.session[options.runType].spreadsheet.key_column;
      }
      if (state.session[options.runType].spreadsheet.key) {
        keyWord = state.session[options.runType].spreadsheet.key;
      }
      if (state.session[options.runType].spreadsheet.hasOwnProperty('headers')) {
        hasHeaderRow = state.session[options.runType].spreadsheet.headers;
      }
    }
    let sdL = sheetData.length;
    if (hasHeaderRow || !key_column) {
      for (let activeRow = 0; activeRow < sdL; activeRow++) {
        reactData.progress = ((activeRow / sdL) * 100);
        setReactData(reactData);
        setForceRedisplay(forceRedisplay => !forceRedisplay);
        if (!sheetData[activeRow]) { continue; }
        let rowData = Object.entries(sheetData[activeRow]);
        // eslint-disable-next-line
        if (rowData.some(([column, cellValue]) => {
          if (cellValue.toLowerCase() === keyWord) {
            if (key_column) {
              if (column === key_column) {
                headerRow = activeRow;
                return true;
              }
            }
            else {
              key_column = column;
              headerRow = activeRow;
              return true;
            }
          }
          return false;
        })) { break; }
      }
      if (!key_column) {
        return {
          count: 0,
          message: 'No key column was found'
        };
      }
    }
    let nameList = [];
    for (let activeRow = headerRow + 1; activeRow < sdL; activeRow++) {
      reactData.progress = ((activeRow / sdL) * 100);
      setReactData(reactData);
      setForceRedisplay(forceRedisplay => !forceRedisplay);
      if (!sheetData[activeRow] || !sheetData[activeRow].hasOwnProperty(key_column)) { continue; }
      nameList.push(sheetData[activeRow][key_column]);
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
      reactData.progress = ((x / nameList.length) * 100);
      setReactData(reactData);
      setForceRedisplay(forceRedisplay => !forceRedisplay);
      let this_name = nameList[x];
      if (this_name.toLowerCase().includes(' and ') || this_name.includes(' & ')) {
        let wordList = makeArray(this_name, ' ');
        let foundAt = wordList.indexOf('and');
        if (foundAt === -1) { foundAt = wordList.indexOf('&'); }
        if (foundAt > -1) {
          this_name = wordList.toSpliced(foundAt, 2).join(' ');
          let rightName = wordList.toSpliced(foundAt - 1, 2).join(' ');
          nameList.push(rightName);
        }
      }
      let pList = await getPersonByWords(state.session.client_id, makeArray(this_name.replace(',', ' ').toLowerCase(), ' '));
      if (pList.length > 1) {    // if more than one account was found, remove any inactive accounts before proceeding
        let pCount = pList.length;
        pList = pList.filter(p => {
          return (determineClass(p.groups, state.session.group_assignments) !== 'inactive');
        });
        if (pList.length === 0) {
          returnList.push({ pID: '', pName: this_name, pRec: {}, pStatus: `multiple inactive:${pCount}` });
          break;
        }
      }
      returnObj.found += pList.length;
      returnObj.count++;
      switch (pList.length) {
        case 0: {    // name not found by words?  see if this is a userID instead...
          let pRec = await getPerson(this_name.toLowerCase());
          if (pRec.person_id) {
            returnList.push({ pID: pRec.person_id, pName: (`${pRec.first} ${pRec.last}`).trim(), pRec: pRec, pStatus: 'match' });
            returnObj.found += 1;
          }
          else {
            returnList.push({ pID: '', pName: this_name, pRec: {}, pStatus: 'no match' });
          }
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
              <Typography variant='h5' className={AVAClass.AVABigBoldTitle} >{`Loading Call List data`}</Typography>
              <Typography variant='caption' >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
            </Box>
            <LinearProgress variant="determinate" className={AVAClass.AVAProgressBar} style={{ width: reactData.pWidth }} value={reactData.progress} />
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
              <DialogContentText className={AVAClass.AVATitle} id='scroll-dialog-title'>
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
              promptText={[`You are going to call ${reactData.request.recipientList.length} ${(reactData.request.recipientList.length === 1) ? 'person' : 'people'}.  Please confirm.`]}
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
              promptText={[`Subject`, `Message to send`, `Alternate message for Voice Mail`]}
              promptUse={['subject', 'message', 'voicemail']}
              buttonText={'Send'}
              sender={state.session}
              pRecipientID={reactData.request.recipientList}
              pRecipientName={reactData.request.recipientNameList}
              onCancel={() => {
                reactData.stage = 'get_file';
                setReactData(reactData);
                filesProcessed.unshift();
                setFilesProcessed(filesProcessed);
                setForceRedisplay(forceRedisplay => !forceRedisplay);
              }}
              onComplete={async () => {
                const stateMachineArn = 'arn:aws:states:us-east-1:125549937716:stateMachine:MessageFollowUp';
                await stepFunctions.startExecution({
                  stateMachineArn,
                  input: JSON.stringify({
                    requestor: state.session.user_id,
                    client_id: state.session.client_id,
                    thread_id: reactData.request.thread_id,
                    fileLocation: reactData.request.s3Upload,
                    localName: reactData.request.localFileName
                  }),
                }).promise();
                onClose();
              }}
              allowCancel={true}
              thread_id={reactData.request.thread_id}
              seedText={[reactData.request.subject, reactData.request.messageText, (reactData.request.voiceMailMessage || reactData.request.messageText)]}
            />
          }
        </React.Fragment >
      }
    </Dialog >
  );
};