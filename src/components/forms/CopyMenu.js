import React from 'react';
import { useSnackbar } from 'notistack';
import { Lambda } from 'aws-sdk';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';

import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';

import CloseIcon from '@material-ui/icons/HighlightOff';
import SaveIcon from '@material-ui/icons/Save';

import Slide from '@material-ui/core/Slide';

import Paper from '@material-ui/core/Paper';
import Box from '@material-ui/core/Box';

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
  formControl: {
    marginTop: 10,
    marginBottom: 10,
    paddingTop: 0,
  },
  formControlLbl: {
    marginTop: 10,
    paddingTop: 10,
    paddingBottom: 5,
    height: theme.spacing(1),
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingTop: 0,
    paddingLeft: 0,
    paddingRight: 10,
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

  const [event_date, setEventDate] = React.useState();
  const [last_date, setLastDate] = React.useState();

  const [eventAsADate, setEventAsADate] = React.useState();
  const [sundayAsADate, setSundayAsADate] = React.useState();
  const [lastAsADate, setLastAsADate] = React.useState();

  const [prefMethod, setMethod] = React.useState('specific_date');
  const [randomize, setRandomize] = React.useState('no_randomize');

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });
    
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

  const { enqueueSnackbar } = useSnackbar();

  const handleSave = async () => {
    // get Observations based on the Copy From date
    let numberDays = ((prefMethod && (prefMethod !== 'specific_date')) ? 7 : 1);
    let obsRecs = await getObservationRecs(eventAsADate, numberDays);
    // assign a date to map each copy from to
    let targetDateArray = [0];
    if (numberDays > 1) {
      switch (randomize) {
        case 'random_all': {
          targetDateArray = myRandomInts(7, 7);
          break;
        }
        case 'random_notSunday': { 
          targetDateArray = myRandomInts(7, 7);
          let sundayValue, sundayTarget;
          for (let d = 0; d < numberDays; d++) {
            let sourceDate = addDays(lastAsADate, d);
            if (sourceDate.getDay() === 0) {
              sundayValue = targetDateArray[d];
              if (sundayValue === 0) { sundayTarget = d; }
              else { targetDateArray[d] = 0; }
            }
            else {
              let resultDate = addDays(lastAsADate, targetDateArray[d]);
              if (resultDate.getDay() === 0) { sundayTarget = d; }
            }
          };
          targetDateArray[sundayTarget] = sundayValue;
          break;
        }
        case 'no_randomize': {
          let fromDoW = eventAsADate.getDay();
          let toDoW = lastAsADate.getDay();
          let incr = (toDoW > fromDoW ? 7 : 0) - (toDoW - fromDoW);
          for (let d = 0; d < numberDays; d++) {
            targetDateArray[d] = incr;
            if (incr === 6) { incr = 0; }
            else { incr++; }
          };
          break;
        }
        default: {
          for (let d = 0; d < numberDays; d++) {
            targetDateArray[d] = d;
          };
          break;
        }
      }
    }
    let date_keys = {};
    for (let d = 0; d < numberDays; d++) { 
      let targetDateYMD = makeYMD(lastAsADate, targetDateArray[d]); 
      date_keys[makeYMD(eventAsADate, d)] = targetDateYMD;
    }
    // build update array
    let newObservationList = [];
    obsRecs.forEach(oRec => {
      let [, oType,] = oRec.composite_key.split(/[~_]/);
      if (oType === 'header') { 
        let d1 = new Date(date_keys[oRec.date_key]).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        oRec.observation_code = `~~${d1}`;
      }
      if (oType !== 'message') {
        newObservationList.push({
          date: date_keys[oRec.date_key],
          item: oRec.observation_code,
          type: oType,
          oKey: oRec.observation_key || null
        });
      }
    });
    // write the to date records
    params.Payload = JSON.stringify({
      action: "bulk_add",
      clientId: pClient,
      request: {
        "item_list": newObservationList
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

  function myRandomInts(quantity, max) {
    const arr = [];
    while (arr.length < quantity) {
      var candidateInt = Math.floor(Math.random() * max);
      if (arr.indexOf(candidateInt) === -1) arr.push(candidateInt);
    }
    return (arr);
  };

  const addDays = (date, days) => {
    let rDate = new Date(date);
    return new Date(rDate.setDate(rDate.getDate() + days));
  }

  function makeYMD(pDate, d) { 
    let workDate = pDate;
    workDate = addDays(pDate, d);
    return (workDate.getFullYear() + '.' + ((workDate.getMonth() + 101).toString()).substring(1) + '.' + ((workDate.getDate() + 100).toString()).substring(1));
  }

  const getObservationRecs = async (pDate, pNumberDays) => {
    let invokeFailed = false;
    if (!(pDate instanceof Date) || isNaN(pDate)) {
      pDate = new Date(pDate);
    }

    params.Payload = JSON.stringify({
      action: "get_multiple_dates",
      clientId: pClient,
      request: {
        "select_date": makeYMD(pDate, 0),
        "number_of_days": pNumberDays
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while retrieving that menu.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let oRecs = JSON.parse(fResp.Payload);
      if (oRecs.status === 200) {
        return oRecs.body;
      }
    };
    return [];
  };

  const handleChangeDate = event => {
    setEventDate(event.target.value);
    setEventAsADate(null);
  };

  const handleDateExit = event => {
    if (event.key === 'Enter' || event.type === 'blur') {
      let goodDate = makeDate(event_date);
      setEventAsADate(goodDate);
      setEventDate(goodDate.toDateString());
      let sunday = addDays(goodDate, -goodDate.getDay());
      setSundayAsADate(sunday);
      setChangeDetected(goodDate && lastAsADate);
    }
  };

  const handleChangeLastDate = event => {
    setLastAsADate(null);
    setLastDate(event.target.value);
  };

  const handleLastDateExit = event => {
    if (event.key === 'Enter' || event.type === 'blur') {
      let goodDate = makeDate(last_date);
      if (!goodDate || isNaN(goodDate.getTime())) {     // invalid date input
        if (event_date) {
          goodDate = addDays(new Date(event_date), 28);
        }
        else {
          setLastDate('');
          setLastAsADate(null);
        }
      }
      setLastDate(goodDate.toDateString());
      setLastAsADate(goodDate);
      setChangeDetected(eventAsADate && goodDate);
    }
  };

  const handleChangeMethod = event => {
    setMethod(event.target.value);
  };

  const handleRandomize = event => {
    setRandomize(event.target.value);
  };

  if (!event_date) {
    setEventDate(' ');
  }
  
  if (!last_date) {
    setLastDate(' ');
  }

  function makeDate(pDate) {
    if (!pDate) { return null; }
    let goodDate = new Date(pDate);
    if (isNaN(goodDate)) {
      let jump = 0;
      let tDate = pDate.substr(0, 3).toLowerCase();
      let dOfw = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(tDate);
      goodDate = new Date(Date.now());
      if (dOfw > -1) {
        goodDate = addDays(goodDate, (((7 - (goodDate.getDay() - dOfw)) % 7) + jump));
      }
      else if (tDate === 'tom') {
        goodDate = addDays(goodDate, 1);
      }
      else if (tDate !== 'tod') {
        goodDate = new Date(pDate);
      }
    }
    let current = new Date(Date.now());
    let seconds_in_a_day = 24 * 60 * 60 * 1000;
    if ((goodDate < current) && ((current.getTime() - goodDate.getTime()) > (400 * seconds_in_a_day))) {
      let yyyy = current.getFullYear();
      goodDate.setFullYear(yyyy);
    };
    return goodDate;
  }

  return (
    <Dialog open={showUpload} p={2}
      fullWidth
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
    >
      <React.Fragment>
        <DialogContentText className={classes.title} id='scroll-dialog-title'>
          {'Copy from a previous date'}
        </DialogContentText>
        <Box m={2}>
          <Paper
            component={Box}
            p={3}
            variant='outlined'
            display='flex'
            flexDirection='row'
            justifyContent='center'
            alignItems='center'>
            <Box flexGrow={2} display='flex' flexDirection='column'>
              <form className={classes.root} noValidate autoComplete='off'>
                <div>
                  <TextField
                    id='event_date'
                    value={event_date}
                    onKeyPress={handleDateExit}
                    onChange={handleChangeDate}
                    onBlur={handleDateExit}
                    helperText='Copy starting from what date?'
                  />
                </div>
                <div>
                  <TextField
                    id='last_date'
                    value={last_date}
                    onKeyPress={handleLastDateExit}
                    onChange={handleChangeLastDate}
                    onBlur={handleLastDateExit}
                    helperText={`Copy to date${(prefMethod && (prefMethod !== 'specific_date')) ? 's beginning on' : ''}`}
                  />
                </div>
                {(typeof (eventAsADate) === 'object') && eventAsADate &&
                  <Box
                    display="flex"
                    pb={1}
                    flexDirection='column'
                    justifyContent="center"
                  >
                    <FormControl className={classes.formControl} component="fieldset">
                      <RadioGroup
                        row
                        aria-label="PrefMethod"
                        name="method"
                        value={prefMethod}
                        onChange={handleChangeMethod}
                      >
                        <FormControlLabel
                          className={classes.formControlLbl}
                          value="specific_date"
                          control={<Radio disableRipple className={classes.radioButton} size='small' />}
                          label={
                            <Typography className={classes.radioText}>
                              Copy this date only
                            </Typography>}
                        />
                        <FormControlLabel
                          className={classes.formControlLbl}
                          value="seven_starting"
                          control={<Radio disableRipple className={classes.radioButton} size='small' />}
                          label={
                            <Typography className={classes.radioText}>
                              {`Copy 7 days, beginning ${eventAsADate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`}
                            </Typography>}
                        />
                        <FormControlLabel
                          className={classes.formControlLbl}
                          value="week_of"
                          control={<Radio disableRipple className={classes.radioButton} size='small' />}
                          label={
                            <Typography className={classes.radioText}>
                              {`Copy the week, beginning ${sundayAsADate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`}
                            </Typography>}
                        />
                      </RadioGroup>
                    </FormControl>
                  </Box>
                }
                {prefMethod && (prefMethod !== 'specific_date') &&
                  <Box
                    display="flex"
                    pb={1}
                    flexDirection='column'
                    justifyContent="center"
                  >
                    <FormControl className={classes.formControl} component="fieldset">
                      <RadioGroup
                        row
                        aria-label="Randomize"
                        name="method"
                        value={randomize}
                        onChange={handleRandomize}
                      >
                        <FormControlLabel
                          className={classes.formControlLbl}
                          value="no_randomize"
                          control={<Radio disableRipple className={classes.radioButton} size='small' />}
                          label={
                            <Typography className={classes.radioText}>
                              {'Copy Sun->Sun, Mon->Mon, etc.'}
                            </Typography>}
                        />
                        <FormControlLabel
                          className={classes.formControlLbl}
                          value="random_all"
                          control={<Radio disableRipple className={classes.radioButton} size='small' />}
                          label={
                            <Typography className={classes.radioText}>
                              {'Randomize'}
                            </Typography>}
                        />
                        <FormControlLabel
                          className={classes.formControlLbl}
                          value="random_notSunday"
                          control={<Radio disableRipple className={classes.radioButton} size='small' />}
                          label={
                            <Typography className={classes.radioText}>
                              {'Randomize except Sunday'}
                            </Typography>}
                        />
                      </RadioGroup>
                    </FormControl>
                  </Box>
                }
              </form>
            </Box>
          </Paper>
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
            <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
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
            </Box>
          </Box>
        </Box>
      </React.Fragment>
    </Dialog>
  );
};