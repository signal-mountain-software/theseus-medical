import React from 'react';
import { useSnackbar } from 'notistack';
import { Lambda } from 'aws-sdk';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import ShowBulkList from '../forms/ShowBulkList';

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
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    paddingRight: 0,
    minWidth: '100%',
  },
  listBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    paddingRight: 0,
    maxWidth: '100%',
    maxHeight: 500,
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

export default ({ pClient, showUpload, handleClose }) => {

  const classes = useStyles();

  const [changeDetected, setChangeDetected] = React.useState(false);
  const [bulkItemList, setBulkItemList] = React.useState([]);

  const entryTypes = ['header', 'message', 'entree', 'soft_entree', 'AL_lunch_entree', 'AL_dinner_entree', 'soup', 'salad', 'side', 'bread', 'dessert'];

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
      parseSpreadsheet(workbook);
      /**************************************** 
       ****************************************/
      setChangeDetected(true);
    };
    req.send();
  };

  function parseSpreadsheet(pWorkbook) {
    let dateWords = 'monday%tuesday%wednesday%thursday%friday%saturday%sunday%january%february%march%april%may%june%july%august%september%october%november%december';
    let itemType = ['header', 'soup', 'salad', 'entree', 'salad', 'side', 'bread', 'side', 'dessert', 'entree', 'side', 'side'];
    let dateString = '';
    let results = [];
    let needDate = true;
    let cellValue, cellKey;
    let workingDate;
    let itemTypeNumber = 0;
    let currentYear = new Date().getFullYear();
    pWorkbook.SheetNames.forEach((sheetName) => {
      let currentSheet = pWorkbook.Sheets[sheetName];
      for (const currentCell in currentSheet) {
        if (!currentSheet[currentCell].v) { continue; }
        cellValue = currentSheet[currentCell].v;
        if (isNaN(Number(cellValue)) && cellValue.length < 3) { continue; }
        cellKey = cellValue.toString().split(' ')[0].toLowerCase().replace(/[^a-z]+/, '');
        if (cellKey && dateWords.includes(cellKey)) {
          dateString = cellValue;
          needDate = true;
          continue;
        }
        else if (needDate && Number(cellValue) < 32) {
          dateString += ' ' + cellValue;
          continue;
        }
        if (needDate) {
          workingDate = new Date(dateString + ' ' + currentYear);
          dateString = '';
          needDate = false;
          itemTypeNumber = 0;
          results.push({
            date: workingDate,
            item: '~~' + workingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
            type: 'header'
          });
        }
        if (!isNaN(Number(cellValue))) { continue; }
        itemTypeNumber++;
        results.push({
          date: workingDate,
          item: cellValue,
          type: itemType[itemTypeNumber]
        });
      }
    });
    results.forEach(o => { o.sort_order = o.date.getFullYear() + '.' + (o.date.getMonth() + 101) + '.' + o.date.getDate() + (entryTypes.indexOf(o.type) + 100).toString() + o.item; });
    results.sort((a, b) => { return (a.sort_order > b.sort_order ? 1 : -1); })
    setBulkItemList(results);
  }

  return (
    <Dialog open={showUpload} fullWidth className={classes.containerBox}>
      <Box display='flex'
        grow={1}
        mb={0}
        flexDirection='column'
        justifyContent='center'
        alignItems='flex-start'>
        <DialogContentText className={classes.title} id='scroll-dialog-title'>
          {'Load new Menus from a File'}
        </DialogContentText>
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
        {
          bulkItemList.length > 0 &&
          <DialogContent dividers={true} className={classes.listBox}>
              <ShowBulkList
                pClient={pClient}
              workingList={bulkItemList}
              showList={bulkItemList.length > 0}
            />
          </DialogContent>
        }
        <DialogActions style={{ justifyContent: 'center' }}>
          <Button className={classes.reject} size='small' variant='contained' onClick={handleClose}>
            Cancel
          </Button>
          {changeDetected &&
            <Button variant='contained' color='primary' size='small' onClick={handleSave}>
              Save
            </Button>
          }
        </DialogActions>
      </Box>
    </Dialog>
  );
};