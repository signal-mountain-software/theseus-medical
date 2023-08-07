import React from 'react';
import { useSnackbar } from 'notistack';
import { s3, lambda, sentenceCase } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import ShowBulkList from '../forms/ShowBulkList';

import CloseIcon from '@material-ui/icons/HighlightOff';
import SaveIcon from '@material-ui/icons/Save';

import Slide from '@material-ui/core/Slide';

import Paper from '@material-ui/core/Paper';
import Box from '@material-ui/core/Box';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Button from '@material-ui/core/Button';

var XLSX = require("xlsx");

const useStyles = makeStyles(theme => ({
  containerBox: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(1),
    fontSize: '1.3rem',
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
    //   height: 950,
    maxWidth: 1000
  },
  listBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    paddingRight: 0,
    maxWidth: '100%',
    maxHeight: 500,
  },
  rowButtonRed: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.reject[theme.palette.type],
  },
  rowButtonGreen: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.confirm[theme.palette.type],
  },
  idText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  uploadButton: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
    marginTop: 10,
    marginBottom: 10,
  },
  table: {
    width: '95%',
    minWidth: 650,
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ pClient, showUpload, handleClose }) => {

  const classes = useStyles();

  const [changeDetected, setChangeDetected] = React.useState(false);
  const [bulkItemList, setBulkItemList] = React.useState([]);

  const entryTypes = [
    'header',
    'message',
    'entree',
    'soft_entree',
    'AL_lunch_entree',
    'AL_dinner_entree',
    'soup',
    'salad',
    'side',
    'bread',
    'dessert'
  ];

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:ObservationMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const hiddenFileInput = React.useRef(null);

  const handleFileUpload = event => {
    hiddenFileInput.current.click();
  };

  const handleSave = async () => {
    params.Payload = JSON.stringify({
      action: "bulk_add",
      clientId: pClient,
      request: {
        "item_list": bulkItemList
      }
    });
    await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while updating that item.  Error is ${err.message}`, {
          variant: 'error'
        });
      });
    handleClose();
  };

  const handleSpreadsheet = (pXFile) => {
    var req = new XMLHttpRequest();
    req.open("GET", pXFile, true);
    req.responseType = "arraybuffer";
    req.onload = function (e) {
      var data = new Uint8Array(req.response);
      var workbook = XLSX.read(data, { type: "array" });
      if (pClient === 'SMSoft') { parseSpreadsheet(workbook); }
      else { parseTemplateMenu(workbook); }
      setChangeDetected(true);
    };
    req.send();
  };

  function parseSpreadsheet(pWorkbook) {
    let dateWords = 'monday%tuesday%wednesday%thursday%friday%saturday%sunday%january%february%march%april%may%june%july%august%september%october%november%december';
    let itemType = ['header', 'soup', 'salad', 'entree', 'salad', 'side', 'bread', 'side', 'dessert', 'entree', 'side', 'side'];
    let sundayType = ['header', 'entree', 'side', 'entree', 'salad', 'entree', 'side', 'side', 'bread', 'side', 'dessert', 'side', 'side'];
    let dateString = '';
    let results = [];
    let needDate = true;
    let fullValue, cellValue, cellKey, cellOKey;
    let workingDate, workingDoW;
    let messages = [];
    let itemTypeNumber = 0;
    pWorkbook.SheetNames.forEach((sheetName) => {
      let currentSheet = pWorkbook.Sheets[sheetName];
      let previousRow = 0;
      let dateRow = 0;
      for (const currentCell in currentSheet) {
        if (!currentSheet[currentCell].v) { continue; }
        fullValue = currentSheet[currentCell].v;
        let valueArray = fullValue.toString().split('~');
        if (!valueArray || valueArray.length < 2) {
          cellValue = (isNaN(fullValue) ? fullValue.trim() : fullValue);
          cellOKey = null;
        }
        else {
          cellValue = valueArray[0].trim();
          cellOKey = valueArray[1].trim();
        }
        let cellColumn = currentCell.replace(/[^A-Z]+/, '');
        let cellRow = Number(currentCell.replace(cellColumn, ''));
        if ((cellRow - previousRow) > 1) {
          needDate = true;
          dateString = '';
        }
        previousRow = cellRow;
        if (isNaN(Number(cellValue)) && cellValue.length < 3) { continue; }
        if (cellValue.toString().includes('+++++')) { continue; }
        cellKey = cellValue.toString().trim().toLowerCase().replace(/[^a-z]+/, '');
        if (cellKey && dateWords.includes(cellKey)) {
          dateString = cellValue;
          needDate = true;
          dateRow = cellRow;
          continue;
        }
        else {
          if (needDate) {
            let valueNumber = Number(cellValue);
            if (valueNumber < 32) {
              dateString += ' ' + cellValue;
              dateRow = cellRow;
              continue;
            }
            else if (valueNumber > 2000) {
              dateString += ' ' + cellValue;
              dateRow = cellRow;
            }
          }
        }
        if (needDate) {
          if (dateString === '') {
            messages.push(cellValue);
            continue;
          }
          else {
            workingDate = new Date(dateString);
            workingDoW = workingDate.getDay();
            dateString = '';
            needDate = false;
            itemTypeNumber = 0;
            results.push({
              date: workingDate,
              item: '~~' + workingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
              type: 'header'
            });
            if (messages.length > 0) {
              for (let m = 0; m < messages.length; m++) {
                results.push({
                  date: workingDate,
                  item: messages[m],
                  type: 'message'
                });
              };
              messages = [];
            }
          }
        }
        if (!isNaN(Number(cellValue))) { continue; }
        if (cellRow === dateRow) {
          results.push({
            date: workingDate,
            item: cellValue,
            type: 'message'
          });
          continue;
        }
        itemTypeNumber++;
        let twoValues = cellValue.indexOf(' or ');
        if (twoValues > 0) {
          let [firstValue, secondValue] = cellValue.split(' or ');
          results.push({
            date: workingDate,
            item: firstValue,
            type: ((workingDoW > 0) ? itemType[itemTypeNumber] : sundayType[itemTypeNumber])
          });
          cellValue = secondValue;
        }
        results.push({
          date: workingDate,
          item: cellValue,
          type: ((workingDoW > 0) ? itemType[itemTypeNumber] : sundayType[itemTypeNumber]),
          oKey: cellOKey || null
        });
      }
    });
    results.forEach(o => { o.sort_order = o.date.getFullYear() + '.' + (o.date.getMonth() + 101) + '.' + (o.date.getDate() + 100).toString() + '.' + (entryTypes.indexOf(o.type) + 100).toString() + o.item; });
    results.sort((a, b) => { return (a.sort_order > b.sort_order ? 1 : -1); });
    setBulkItemList(results);
  }

  function parseTemplateMenu(pWorkbook) {
    let headers = [];
    let results = [];
    pWorkbook.SheetNames.forEach((sheetName) => {
      let currentSheet = pWorkbook.Sheets[sheetName];
      for (const currentCell in currentSheet) {
        if (!currentSheet[currentCell].v) { continue; }   // skip if no value in the cell
        if (typeof (currentSheet[currentCell].v) !== 'string') { continue; }
        if (!currentSheet[currentCell].v.startsWith('###')) { continue; }   // skip if not flagged as a key cell
        let values = currentSheet[currentCell].v.replace('###', '').split('//');
        let split_value = values[2].split('_');
        let this_date = makeDate(values[0]);
        let hKey = `~~${this_date.absolute}${split_value[1] ? (' ' + sentenceCase(split_value[0])) : ''}`;
        if (!headers.includes(hKey)) {
          results.push({
            date: this_date.date,
            sort_order: `${this_date.ymd}.${split_value[1] ? split_value[0] : 'ava'}`,
            item: hKey,
            type: 'header'
          });
          headers.push(hKey);
        }
        let sort_key = entryTypes.indexOf(split_value[split_value.length - 1]);
        if (sort_key === -1) { sort_key = 99; }
        results.push({
          date: this_date.date,
          sort_order: `${this_date.ymd}.${split_value[1] ? split_value[0] : 'ava'}.${100 + sort_key}`,
          item: values[1],
          type: values[2]
        });
      }
    });
    results.sort((a, b) => { return (a.sort_order > b.sort_order ? 1 : -1); });
    setBulkItemList(results);
  }

  return (
    <Dialog open={showUpload} p={2}
      fullWidth
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
    >
      <React.Fragment>
        <DialogContentText className={classes.title} id='scroll-dialog-title'>
          {'Load new Menus from a File'}
        </DialogContentText>
        <Paper component={Box} className={classes.page} variant='outlined' overflow='auto' square>
          {
            bulkItemList.length === 0 ?
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
                    enqueueSnackbar(`Uploading your file`, { variant: 'success', persist: false });
                    let s3Resp = await s3
                      .upload(pFile)
                      .promise()
                      .catch(err => {
                        enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
                      });
                    closeSnackbar();
                    handleSpreadsheet(s3Resp.Location);
                  }}
                />
              </DialogContent>
              :
              <ShowBulkList
                pClient={pClient}
                workingList={bulkItemList}
                showList={bulkItemList.length > 0}
              />
          }
        </Paper>
        <DialogActions className={classes.buttonArea} >
          <Box display='flex' flexDirection='column'>
            <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
              <Button
                className={classes.rowButtonRed}
                size='small'
                onClick={handleClose}
                startIcon={<CloseIcon size="small" />}
              >
                {'Cancel'}
              </Button>
              {changeDetected &&
                <Button
                  className={classes.rowButtonGreen}
                  size='small'
                  onClick={handleSave}
                  startIcon={<SaveIcon size="small" />}
                >
                  Save
                </Button>
              }
            </Box>
          </Box>
        </DialogActions>
      </React.Fragment>
    </Dialog>
  );
};