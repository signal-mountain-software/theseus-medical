import React from 'react';
import { getObservations } from '../../util/AVAObservations';
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
import PlaylistAddCheckIcon from '@material-ui/icons/PlaylistAddCheck';
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
    paddingTop: 0,
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
    overflowX: 'auto',
 //   overflowY: 'hidden'
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
  const [displayedDate, setDisplayedDate] = React.useState(new Date().toDateString());
  const [loadMode, setLoadMode] = React.useState(false);
  const [copyMode, setCopyMode] = React.useState(false);

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const [changes, setChanges] = React.useState(false);
  if (changes) { }

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  async function buildObservationList(pDate) {
    let obsList = [];
    for (let d = 0; d < 7; d++) {
      let this_date = addDays(pDate, d);
      let [todayList,] = await getObservations(pClient, '', { date: this_date, sort: true, return: 'records' });
      /*
      todayList.forEach((this_observation, this_index) => {
        let [, cKey] = this_observation.composite_key.split('~');
        let s = cKey.replace('all_day', '%RESTORE%').split('_');
        let p = s.map(e => {
          return (e === '%RESTORE%' ? 'all_day' : e);
        });
        // now p has up to 4 parts; figure out what each part means
        todayList[this_index].encoding = {};
        p.forEach(this_part => {
          if (this_part)
        })
      })
      */
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
            value: r.observation_key || `*noKey~${x}`,
            type: (`${r.composite_key}_${r.sort_order}`).toLowerCase()
          };
        });
      }
      let response = (unsortedObservations).sort((a, b) => {
        return ((a.label < b.label) ? -1 : 1);
      });
      var seenLabel = {};
      let seenValue = {};
      let seenType = {};
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
          if (!seenType[item.label] && item.type) {
            seenType[item.label] = item.type;
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
          seenType[item.label] = item.type;
        }
      });
      let finalAnswer = [];
      for (let label in seenLabel) {
        finalAnswer.push({
          label: label,
          value: seenLabel[label],
          type: seenType[label]
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
    setSelectedDate(goodDate.numeric$);
    buildObservationList(goodDate.date);
  };

  let filterTimeOut;
  const handleChangeDate = vCheck => {
    clearTimeout(filterTimeOut);
    filterTimeOut = setTimeout(() => {
      if (vCheck.length === 0) {
        setDisplayedDate('');
      }
      else if (vCheck.length >= 3) {
        let goodDate = makeDate(vCheck, { validation: 'noPast' });
        if (!goodDate.error) {
          handleDateExit(vCheck);
        }
      }
    }, 500);
  };


  const handleAbort = () => {
    setChanges(false);
    onClose();
  };

  // **************************

  React.useEffect(() => {
    async function initialize() {
      await buildObservationList(new Date().toDateString());
    }
    if (!observationList) { initialize(); }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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
              defaultValue={displayedDate}
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
            style={{ backgroundColor: 'green', color: 'white' }}
            size='small'
            onClick={handleAbort}
            startIcon={<PlaylistAddCheckIcon size="small" />}
          >
            {'Done'}
          </Button>
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'blue', color: 'white' }}
            size='small'
            onClick={handleLoad}
            startIcon={<LoadIcon size="small" />}
          >
            {'Upload from Template'}
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
