import React from 'react';
import { getObservations, getObservationKeys } from '../../util/AVAObservations';
import { sentenceCase, dbClient, cl, recordExists } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';

import TextField from '@material-ui/core/TextField';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import Button from '@material-ui/core/Button';
import makeStyles from '@material-ui/core/styles/makeStyles';
import LoadIcon from '@material-ui/icons/GetApp';
import CloseIcon from '@material-ui/icons/HighlightOff';
import FileCopyIcon from '@material-ui/icons/FileCopy';

import CopyMenu from '../forms/CopyMenu';

import MenuForm from '../forms/MenuFormB';
import LoadMenuSpreadsheet from '../forms/LoadMenuSpreadsheet';

import { AVAclasses } from '../../util/AVAStyles';
import { addDays } from '../../util/AVADateTime';

const useStyles = makeStyles(theme => ({
  pageHead: {
    paddingTop: theme.spacing(1),
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    paddingBottom: theme.spacing(1),
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
    fontWeight: 'bold'
  },
  subDescriptionText: {
    marginLeft: theme.spacing(3),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },
  freeInput: {
    marginLeft: 0,
    marginBottom: '10px',
    marginRight: '2px',
    paddingLeft: 0,
    paddingRight: 0,
    verticalAlign: 'middle',
    minHeight: theme.typography.fontSize * 2.8,
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
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
    overflowX: 'auto',
    overflowY: 'hidden'
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  load: {
    backgroundColor: theme.palette.warning[theme.palette.type],
  },
  confirm: {
    backgroundColor: 'green',
  },
}));

export default ({ pClient, showMenu, onClose }) => {
  const [observationList, setObservationList] = React.useState();
  const [alwaysList, setAlwaysList] = React.useState();
  const [recipeList, setRecipeList] = React.useState();
  const [selectedDate, setSelectedDate] = React.useState(new Date().toDateString());
  const [loadMode, setLoadMode] = React.useState(false);
  const [copyMode, setCopyMode] = React.useState(false);

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const [changes, setChanges] = React.useState(false);
  if (changes) { }

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const buildObservationList = async (pDate) => {
    let obsList = [];
    for (let d = 0; d < 7; d++) {
      let this_date = addDays(pDate, d);
      let [todayList,] = await getObservations(pClient, '', { date: this_date, sort: true, return: 'records' });
      obsList.push(...todayList);
    }
    let buildAlways;
    if (!alwaysList) {
      buildAlways = await getObservations(pClient, '', { always: true, sort: true, return: 'records' });
      setAlwaysList(buildAlways[0])
    }
    if (!recipeList || (recipeList.length === 0)) { 
      setRecipeList(await buildRecipeList());
    }
    let concatList = obsList.concat(alwaysList || buildAlways[0]);
    setObservationList(concatList);
    return concatList;
  };

  async function buildRecipeList() {
    if (!recipeList || (recipeList.length === 0)) {
      let recipeRecs = await getObservationKeys({ characteristic: 'observation_name' });
      let unsortedRecipeList = recipeRecs.map(r => {
        return {
          label: `${sentenceCase(r.display_value)}`.trim(),
          value: r.observation_key
        };
      });
      let oDate = makeDate(addDays(new Date(), -120)).ymd;
      let oldObservations = await dbClient
        .query({
          KeyConditionExpression: 'client_id = :c and date_key > :d',
          ExpressionAttributeValues: { ':c': pClient, ':d': oDate },
          TableName: "Observations",
          IndexName: "date_key-index"
        })
        .promise()
        .catch(error => { cl(`ERROR reading Observations by date *** caught error is: ${error}`); });
      let unsortedObservations = [];
      if (recordExists(oldObservations)) {
        unsortedObservations = oldObservations.Items.map((r, x) => {
          return {
            label: `${sentenceCase(r.observation_code)}`.trim(),
            value: r.observation_key || `*noKey~${x}`
          };
        });
      }
      let response = (unsortedRecipeList.concat(unsortedObservations)).sort((a, b) => {
        return ((a.label < b.label) ? -1 : 1);
      });
      var seenLabel = {};
      let seenValue = {};
      response.forEach((item, x) => {
        if (seenLabel.hasOwnProperty(item.label)) {
          // label already exists; do we need to put a better value in?  (we shuold if the value is missing or '*nokey...')
          if (!seenLabel[item.label]
            || (seenLabel[item.label].startsWith('*noKey') && (item.value && !item.value.startsWith('*noKey')))
          ) {
            if (!item.value) {
              item.value = `*noKey~${x}`;
            }
            if (seenValue.hasOwnProperty(item.value)) {
              item.value += `_${x}`
            }
            seenLabel[item.label] = item.value;
            seenValue[item.value] = true;
          }
        }
        else {
          if (!item.value) {
            item.value = `*noKey~${x}`
          }
          if (seenValue.hasOwnProperty(item.value)) {
            item.value += `_${x}`;
          }
          seenLabel[item.label] = item.value;
          seenValue[item.value] = true;
        }
      });
      let finalAnswer = [];
      for (let label in seenLabel) {
        finalAnswer.push({
          label: label,
          value: seenLabel[label]
        })
      }
      return finalAnswer;
    }
  }

  const handleLoad = async () => {
    setLoadMode(true);
  };

  const handleCopy = async () => {
    setCopyMode(true);
  };

  const handleDateExit = dateValue => {
    let goodDate = makeDate(dateValue, { validation: 'noPast' });
    if (goodDate.error) {
      setObservationList([]);
      return;
    }
    setSelectedDate(goodDate.absolute);
    buildObservationList(goodDate.date);
  };


  /*
  const handleDateExit = dateValue => {
 //   if (event.key === 'Enter' || event.type === 'blur') {
      let goodDate = new Date(dateValue);
      if (isNaN(goodDate)) {
        let tNext = dateValue.trim().toLowerCase().startsWith('next');
        if (tNext) {
          let dayWord = dateValue.split(' ')[1].trim();
          dateValue = dayWord;
        }
        let tDate = dateValue.substr(0, 3).toLowerCase();
        let dOfw = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(tDate);
        goodDate = new Date(Date.now());
        if (dOfw > -1) {
          if ((goodDate.getDay() > dOfw) && tNext) {
            tNext = false;
          }
          goodDate.setDate(goodDate.getDate() + ((7 - (goodDate.getDay() - dOfw)) % 7) + (tNext ? 7 : 0));
        }
        else if (tDate === 'tom') {
          goodDate.setDate(goodDate.getDate() + 1);
        }
        else if (tDate !== 'tod') {
          goodDate = new Date(dateValue);
        }
      }
      let current = new Date(Date.now());
      current.setHours(0, 0, 0, 0);
      if (goodDate < current) {
        let yyyy = current.getFullYear();
        goodDate.setFullYear(yyyy);
        if (goodDate < current) { goodDate.setFullYear(yyyy + 1); }
      };
      setSelectedDate(goodDate.toDateString());
      buildObservationList(goodDate);
  //  }
  };
  */

  // const handleChangeDate = event => {
  //  setSelectedDate(event.target.value);
  // };

  let filterTimeOut;
  const handleChangeDate = vCheck => {
    clearTimeout(filterTimeOut);
    filterTimeOut = setTimeout(() => {
      if (vCheck.length === 0) {
        setSelectedDate('');
      }
      else {
        setSelectedDate(vCheck);
        handleDateExit(vCheck);
      }
    }, 500);
  };


  const handleAbort = () => {
    setChanges(false);
    onClose();
  };

  // **************************

  if (!observationList) {
    buildObservationList(new Date().toDateString());
  }

  return (
    (showMenu &&
      <Dialog
        open={showMenu}
        onClose={handleAbort}
        className={classes.pageHead}
        fullScreen
      >
        <Box
          display='flex'
          mb={0}
          flexDirection='row'
          className={classes.pageHead}
          justifyContent='flex-start'
          alignItems='center'
        >
          <Box
            display='flex'
            grow={1}
            style={{ width: '90%' }}
            mb={0}
            flexDirection='column'
            justifyContent='center'
            alignItems='flex-start'
          >
            <DialogContentText className={classes.title} id='scroll-dialog-title'>
              {`Dining Menu Maintenance`}
            </DialogContentText>
          </Box>
          <Box
            flexDirection='row'
            display='flex'
            width={'100%'}
            justifyContent='flex-start'
            alignItems='baseline'
            marginTop={1}
          >
            <TextField
              className={classes.freeInput}
              id={'date-selection'}
              label={'Date selection'}
              variant={'standard'}
              fullWidth
              autoComplete='off'
              defaultValue={selectedDate}
              onChange={event => (handleChangeDate(event.target.value))}
            />
          </Box>
        </Box>
        
        {observationList &&
          <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
            <MenuForm
              observationList={observationList}
              recipeList={recipeList}
              pClient={pClient}
              keyDate={selectedDate}
              filter={''}
              onReset={() => {
                buildObservationList(selectedDate);
              }}
              handleAbort={handleAbort}
              handleLoad={handleLoad}
            />
          </DialogContent>
        }
        <DialogActions style={{ justifyContent: 'center' }}>
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'red', color: 'white' }}
            size='small'
            onClick={handleAbort}
            startIcon={<CloseIcon size="small" />}
          >
            {'Done'}
          </Button>
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'green', color: 'white' }}
            size='small'
            onClick={handleLoad}
            startIcon={<LoadIcon size="small" />}
          >
            {'Load'}
          </Button>
          {false && <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'brown', color: 'white' }}
            size='small'
            onClick={() => { handleCopy(); }}
            startIcon={<FileCopyIcon size="small" />}
          >
            {'Copy'}
          </Button>}
        </DialogActions>
        {loadMode &&
          <LoadMenuSpreadsheet
            pClient={pClient}
            showUpload={loadMode}
            handleClose={() => {
              setLoadMode(false);
              buildObservationList(selectedDate);
            }}
          />
        }
        {copyMode && false &&
          <CopyMenu
            pClient={pClient}
            showUpload={copyMode}
            handleClose={() => {
              setCopyMode(false);
            }}
          />
        }
      </Dialog>
    )
  );
};
