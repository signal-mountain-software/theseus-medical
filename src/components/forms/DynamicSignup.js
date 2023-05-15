import React from 'react';
import { lambda } from '../../util/AVAUtilities';

import { useSnackbar } from 'notistack';

import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import CloseIcon from '@material-ui/icons/Close';
import SaveIcon from '@material-ui/icons/Save';
import SendIcon from '@material-ui/icons/Send';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';

import CalendarEventEditForm from '../forms/CalendarEventEditForm';

const useStyles = makeStyles(theme => ({
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    flexGrow: 1
  },
  titlePersonSelect: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  formControl: {
    margin: 0,
    paddingTop: 0,
  },
  rowButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small'
  },
  formControlLbl: {
    marginTop: 6,
    marginLeft: theme.spacing(1),
    marginBottom: 6,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  picture: {
    width: theme.spacing(16),
    height: theme.spacing(16),
    [theme.breakpoints.down('xs')]: {
      width: theme.spacing(8),
      height: theme.spacing(8),
    },
  },
  photoButton: {
    alignSelf: 'center',
    size: 'sm',
    variant: 'outlined',
    verticalAlign: 'middle',
  },
  defaultButton: {
    alignSelf: 'end',
    marginTop: 1,
    variant: 'outlined',
    verticalAlign: 'center',
    fontSize: theme.typography.fontSize * 0.6,
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  topButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  resetButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.confirm[theme.palette.type],
    marginRight: 10,
  },
  infoButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.info[theme.palette.type],
    marginRight: 10,
    paddingRight: 10,
    marginLeft: 10,
    paddingLeft: 10,
  },
  freeInput: {
    marginLeft: '25px',
    marginTop: '15px',
    marginRight: 2,
    marginBottom: '10px',
    paddingLeft: 0,
    paddingRight: 0,
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    minHeight: theme.typography.fontSize * 2.8,
  },
  dateTimeInput: {
    marginTop: '15px',
    marginRight: '10px',
    marginBottom: '5px',
    paddingLeft: 0,
    paddingRight: 0,
    width: '30%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    minHeight: theme.typography.fontSize * 2.8,
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  listItemAVA: {
    fontSize: theme.typography.fontSize * 1.5,
  },
  listItemHighlighted: {
    fontSize: theme.typography.fontSize * 1.5,
    backgroundColor: 'yellow'
  },
  radioPrompt: {
    fontSize: theme.typography.fontSize * 1.5,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioText: {
    fontSize: theme.typography.fontSize * 1.0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  noRow: {
    marginLeft: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  idText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 5,
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ patient, peopleList, picture, showNewEvent, onClose }) => {
  const classes = useStyles();

  const [personName, setPersonName] = React.useState(patient.patient_display_name);
  const [event_date, setEventDate] = React.useState();
  const [eventAsADate, setEventAsADate] = React.useState();
  const [prefMethod, setMethod] = React.useState('none');
  const [signup_type, setSignUpType] = React.useState('none');
  const [time_from_display_string, setTimeFromAsDisplayString] = React.useState();
  const [timeFromAs24HourNumber, setTimeFromAs24HourNumber] = React.useState();
  const [showPersonSelect, setShowPersonSelect] = React.useState(false);
  const [showCalendarEntry, setShowCalendarEntry] = React.useState(false);
  const [calendarToShow, setCalendarToShow] = React.useState();
  const [calendarOcc, setCalendarOcc] = React.useState();
  const [person_filter, setPersonFilter] = React.useState('');
  const [restrictionList, setRestrictionList] = React.useState([]);

  const [dateRestricted, setDateRestricted] = React.useState();
  const [loopCount, setLoopCount] = React.useState();

  const { enqueueSnackbar } = useSnackbar();

  // const [patientGroups, setPatientGroups] = React.useState();

  const [changes, setChanges] = React.useState(false);

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:messageEngine',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  let ordinal = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
    '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th',
    '21st', '22nd', '23rd', '24th', '25th', '26th', '27th', '28th'];

  let dateRestrictedTypes = ['basic', 'cut', 'beardtrim'];
  let calendarEvent = ['', '', '1660741231021', '1660751843388', '', '', ''];

  React.useEffect(() => {
    if (patient) {
    }
  }, [patient]);


  const handleAbort = () => {
    setChanges(false);
    onClose();
  };

  const handleNextDate = (pDate, pMethod) => {
    if (!dateRestricted) { handleAbort(); }
    else if (pMethod === 'weekly_on') {
      if (loopCount > 6) { handleAbort(); }
      else { setLoopCount(loopCount + 1); }
      let rDate = new Date(pDate);
      let nDate = new Date(rDate.setDate(rDate.getDate() + 7));
      setEventAsADate(nDate);
      handleUpdate(nDate);
    }
    else if (pMethod === 'monthly_by_dayOfWeek') {
      if (loopCount > 3) { handleAbort(); }
      else { setLoopCount(loopCount + 1); }
      let weekNumber = (Math.min(Math.floor(pDate.getDate() / 7.1) + 1, 4));
      let weekdayNumber = pDate.getDay();
      let rDate = new Date(pDate);
      let nextMonth = new Date(rDate.setMonth(rDate.getMonth() + 1));
      nextMonth.setDate(1);
      let dOne = nextMonth.getDay();
      let targetDate = ((weekNumber - 1) * 7) + (((weekdayNumber + 7) + 1 - dOne) % 7.1);
      let nDate = new Date(nextMonth.setDate(targetDate));
      setEventAsADate(nDate);
      handleUpdate(nDate);
    }
    else { handleAbort(); }
  };

  const handleUpdate = async (pDate) => {
    if (dateRestricted) {
      let cEvent = calendarEvent[pDate.getDay()];
      let cDate = ((pDate.getFullYear() * 10000) + ((pDate.getMonth() + 1) * 100) + (pDate.getDate())).toString();
      setCalendarToShow(cEvent + '#' + cDate);
      params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance';
      params.Payload = JSON.stringify({
        action: "get_event",
        clientId: patient.adopted_client || patient.client_id,
        event_id: cEvent + '#' + cDate,
        person_id: patient.patient_id
      });
      let invokeFailed = false;
      let fResp = await lambda
        .invoke(params)
        .promise()
        .catch(err => {
          console.log("AVA couldn't complete the query.  Error is", JSON.stringify(err));
          invokeFailed = true;
        });
      if (!invokeFailed) {
        let fullResponse = JSON.parse(fResp.Payload);
        if (fullResponse.status === 200 && (fullResponse.body.length > 0)) {
          fullResponse.body.forEach(cEv => {
            setCalendarOcc(cEv.occData);
          });
        }
        else { handleAbort(); }
      }
      else { handleAbort(); }
      setShowCalendarEntry(true);
    }
    else {
      setShowCalendarEntry(false);
      enqueueSnackbar(`AVA is sending a message to the Salon for you!`, {
        variant: 'info'
      });
      let pMessage = `${personName} is requesting `;
      pMessage += (signup_type === 'perm' ? 'Perm' : 'Color') + ' and Style service.';
      pMessage += ` They would prefer an appointment on ${event_date}`;
      if (time_from_display_string) { pMessage += ` at ${time_from_display_string}`; }
      pMessage += '.';
      params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:messageEngine';
      let lambdaPayload = {
        "body": {
          "client": 'SMSoft',
          "author": 'rsteele',
          "subject": 'Salon Appointment Request',
          "values": `AVA Support:ava_vcvmcl ~ MessageText = ${pMessage}`
        }
      };
      params.Payload = JSON.stringify(lambdaPayload);
      lambda
        .invoke(params)
        .promise()
        .catch(err => {
          enqueueSnackbar(`AVA encountered an error while sending a Message.  Error is ${err.message}`, {
            variant: 'error'
          });
        });
      handleAbort();
    }
  };

  // **************************

  const handleChangePersonName = event => {
    setPersonName(event.target.value);
    okToSave(event.target.value, eventAsADate, signup_type, prefMethod);
  };

  const handleSelectPerson = (pPerson) => {
    let newRList = restrictionList;
    newRList.push(pPerson.replace(':', '%%').split(':')[0]);
    setRestrictionList(newRList);
  };

  const handleChangePersonFilter = event => {
    setPersonFilter(event.target.value);
  };

  const handleChangeDate = event => {
    setEventDate(event.target.value);
    setEventAsADate(null);
  };

  const handleChangeTimeFrom = event => {
    setTimeFromAsDisplayString(event.target.value);
  };

  const handleTimeFromExit = event => {
    if ((event.key === 'Enter' || event.type === 'blur') && time_from_display_string) {
      let ampm = null;
      if (time_from_display_string.includes('p')) { ampm = 'pm'; }
      else if (time_from_display_string.includes('a')) { ampm = 'am'; };
      let [hh$, mm$] = time_from_display_string.split(':');
      let hh = Number(hh$.replace(/\D+/g, ''));
      let mm = 0;
      if (hh > 100) {
        if (!mm$) { mm = hh % 100; }
        hh = Math.floor(hh / 100);
      }
      if (mm$) { mm = Number(mm$.replace(/\D+/g, '')); }
      if (mm > 59) {
        let hAdd = Math.floor(mm / 60);
        mm -= (hAdd * 60);
        hh += hAdd;
      }
      if (hh >= 23) {
        hh = hh % 24;
      }
      if (hh >= 12) {
        hh -= 12;
        ampm = 'pm';
      }
      if (hh === 0) {
        hh = 12;
        ampm = 'pm';
      }
      if (!ampm) { ampm = ((hh > 6) && (hh < 12)) ? 'am' : 'pm'; }
      setTimeFromAsDisplayString(`${hh}:${mm < 10 ? ('0' + mm) : mm} ${ampm}`);
      let calcFromTime = 0;   // numeric 24 hour clock version of time as hhmm
      if (ampm === 'pm') {
        calcFromTime = (hh < 12 ? ((hh + 12) * 100) : 1200) + mm;
      }
      else {
        calcFromTime = ((hh < 12 ? (hh * 100) : 0) + mm);
      }
      setTimeFromAs24HourNumber(calcFromTime);
    }
  };

  const handleDateExit = event => {
    if (event.key === 'Enter' || event.type === 'blur') {
      let goodDate = makeDate(event_date);
      if (goodDate) {
        setEventAsADate(goodDate);
        setEventDate(goodDate.toDateString());
        okToSave(personName, goodDate, signup_type, prefMethod);
      }
    }
  };

  function makeDate(pDate) {
    if (!pDate) { return null; }
    let goodDate = new Date(pDate);
    if (isNaN(goodDate)) {
      let jump = 0;
      if (pDate.includes('next')) {
        jump = 7;
        pDate = pDate.replace('next', '');
      }
      let tDate = pDate.trim().substr(0, 3).toLowerCase();
      let dOfw = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(tDate);
      goodDate = new Date(Date.now());
      if (dOfw > -1) {
        goodDate.setDate(goodDate.getDate() + ((7 - (goodDate.getDay() - dOfw)) % 7) + jump);
      }
      else if (tDate === 'tom') {
        goodDate.setDate(goodDate.getDate() + 1);
      }
      else if (tDate !== 'tod') {
        goodDate = new Date(pDate);
      }
    }
    let current = new Date(Date.now());
    current.setHours(0, 0, 0, 0);
    if (goodDate < current) {
      let yyyy = current.getFullYear();
      goodDate.setFullYear(yyyy);
      if (goodDate < current) { goodDate.setFullYear(yyyy + 1); }
    };
    return goodDate;
  }

  const handleChangeMethod = event => {
    setMethod(event.target.value);
    okToSave(personName, eventAsADate, signup_type, event.target.value);
  };

  const okToSave = (pName, pDate, pService, pFreq) => {
    setDateRestricted(dateRestrictedTypes.includes(pService));
    if (!pDate) {
      setChanges(false);
    }
    else if (dateRestrictedTypes.includes(pService)) {
      if (!pDate || pDate.getDay() < 2 || pDate.getDay() > 3) {
        enqueueSnackbar(`That service is only available on Tuesdays and Wednesdays.`, {
          variant: 'error'
        });
        setChanges(false);
      }
      else {
        setChanges(true);
      }
      setChanges(pName && (pFreq && (pFreq !== 'none')));
    }
    else {
      setChanges(pName && (pService && (pService !== 'none')));
    }
    return;
  };

  const handleChangeSignUp = event => {
    setSignUpType(event.target.value);
    // basic, cut, beardtrim, perm, or color
    okToSave(personName, eventAsADate, event.target.value, prefMethod);
    if (!dateRestrictedTypes.includes(event.target.value)) {
      let timeMessage = '';
      if (eventAsADate) {
        timeMessage += `You've already entered a preferred date`;
        if (timeFromAs24HourNumber) { timeMessage += ` and time`; }
        else { timeMessage += `.  You may also enter a preferred time of day.`; }
      }
      else {
        timeMessage += `Please enter a preferred date and time.`;
      }
      enqueueSnackbar(`AVA can't schedule that service.  ${timeMessage}  We'll contact the Salon and they will confirm your appointment.`, {
        variant: 'success'
      });
    }
  };

  // **************************

  return (
    showNewEvent ?
      <Dialog
        open={showNewEvent}
        onClose={handleAbort}
        TransitionComponent={Transition}
        fullScreen
      >
        <AppBar>
          <Toolbar>
            <IconButton color='inherit' edge='start' onClick={handleAbort}>
              <CloseIcon />
            </IconButton>
            <Typography variant='h6' className={classes.title}>
              {'Make a Salon Appointment'}
            </Typography>
          </Toolbar>
        </AppBar>
        <Toolbar />
        <Box m={2}>
          <Paper component={Box} variant={'outlined'}>
            <Box mt={1} py={1} px={3} borderBottom={2}>
              <Box flexGrow={1}>
                <Typography variant='h6'>Details</Typography>
              </Box>
            </Box>
          </Paper>
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
                    id='personName'
                    value={personName}
                    fullWidth
                    onChange={handleChangePersonName}
                    helperText='Who is this appointment for?'
                  />
                </div>
                <Box
                  display="flex"
                  pt={2}
                  pb={1}
                  flexDirection='column'
                  justifyContent="center"
                >
                  <Typography className={classes.radioPropmt}>What service do you need?</Typography>
                  <FormControl className={classes.formControl} component="fieldset">
                    <RadioGroup
                      row={false}
                      defaultValue={signup_type}
                      aria-label="Service"
                      name="signup"
                      value={signup_type}
                      onChange={handleChangeSignUp}
                    >
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="basic"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Shampoo and Style ($15)
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="cut"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Shampoo, Cut, and Style (Women $20, Men $15)
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="beardtrim"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Shampoo, Cut, and Beard Trim ($32)
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="perm"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Permanent and Style ($65)
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="color"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Color and Style ($55)
                          </Typography>}
                      />
                    </RadioGroup>
                  </FormControl>
                </Box>
                <Box
                  display="flex"
                  pb={1}
                  flexDirection='row'
                  justifyContent="flex-start"
                >
                  <TextField
                    id='event_date'
                    value={event_date}
                    className={classes.dateTimeInput}
                    onKeyPress={handleDateExit}
                    onChange={handleChangeDate}
                    onBlur={handleDateExit}
                    helperText='Preferred Date'
                  />
                  {(!signup_type || (signup_type === 'none') || dateRestrictedTypes.includes(signup_type)) ?
                    null
                    :
                    <TextField
                      id='time_from_display_string'
                      value={time_from_display_string}
                      className={classes.dateTimeInput}
                      onChange={handleChangeTimeFrom}
                      onKeyPress={handleTimeFromExit}
                      onBlur={handleTimeFromExit}
                      helperText='Preferred time of day'
                    />
                  }
                </Box>
                {(typeof (eventAsADate) === 'object') && eventAsADate && dateRestrictedTypes.includes(signup_type) &&
                  <Box
                    display="flex"
                    pb={1}
                    flexDirection='column'
                    justifyContent="center"
                  >
                    <FormControl className={classes.formControl} component="fieldset">
                      <RadioGroup
                        row
                        defaultValue={prefMethod}
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
                              This date only
                            </Typography>}
                        />
                        <FormControlLabel
                          className={classes.formControlLbl}
                          value="weekly_on"
                          control={<Radio disableRipple className={classes.radioButton} size='small' />}
                          label={
                            <Typography className={classes.radioText}>
                              {`Every ${eventAsADate.toLocaleDateString(undefined, { weekday: 'long' })}`}
                            </Typography>}
                        />
                        <FormControlLabel
                          className={classes.formControlLbl}
                          value="monthly_by_dayOfWeek"
                          control={<Radio disableRipple className={classes.radioButton} size='small' />}
                          label={
                            <Typography className={classes.radioText}>
                              {`Every month on the ${ordinal[(Math.min(Math.floor(eventAsADate.getDate() / 7.1) + 1, 4)) - 1]} ${eventAsADate.toLocaleDateString(undefined, { weekday: 'long' })}`}
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
                <Button
                  className={classes.rowButton}
                  onClick={() => { onClose(); }}
                  startIcon={<CloseIcon fontSize="small" />}
                >
                  {'Cancel'}
                </Button>
                {changes &&
                  <Button
                    onClick={() => {
                      setChanges(false);
                      setLoopCount(1);
                      handleUpdate(eventAsADate);
                    }}
                    startIcon={
                      dateRestricted ? <SaveIcon fontSize="small" /> : <SendIcon fontSize="small" />
                    }
                    disabled={!changes}
                    hidden={!changes}
                    className={classes.rowButton}
                  >
                    {dateRestricted ? 'Schedule' : 'Send'}
                  </Button>
                }
              </DialogActions>
            </Box>
          </Box>
        </Box>
        {showCalendarEntry &&
          <CalendarEventEditForm
            pEventCode={calendarToShow}
            peopleList={peopleList}
            pPatient={patient.patient_id}
            pClient={patient.adopted_client || patient.client_id}
            pOccData={calendarOcc}
            pPatientRec={patient}
            pName={personName || null}
            pInfo={(signup_type === 'basic' ? 'Style' : (signup_type === 'cut' ? 'Cut' : 'Cut & Beard'))}
            onReset={() => {
              handleNextDate(eventAsADate, prefMethod);
            }}
          />
        }
        {showPersonSelect &&
          <Dialog
            p={2}
            height={250}
            fullWidth
            variant={'elevation'} elevation={2}
            open={showPersonSelect}
            TransitionComponent={Transition}
          >
            <Paper component={Box} variant='outlined' width='100%' overflow='auto' square>
              <TextField
                id='Type a few letters to filter the list'
                value={person_filter}
                onChange={handleChangePersonFilter}
                className={classes.freeInput}
                label='Type a few letters to filter the list'
                variant={'standard'}
                autoComplete='off'
              />
              <List component='nav'>
                {peopleList.map((listEntry, x) => (
                  (
                    listEntry.includes(person_filter) ?
                      <ListItem
                        key={`${listEntry.split(':')[1]}_select_${x}`}
                        onClick={() => { handleSelectPerson(listEntry); }}
                        button>
                        <Typography
                          className={classes.listItemAVA}>
                          {listEntry.split(':')[0]}
                        </Typography>
                      </ListItem> : null
                  )
                ))}
              </List>
            </Paper>
            <DialogActions style={{ justifyContent: 'center' }}>
              <Button
                className={classes.reject}
                size='small'
                variant='contained'
                onClick={() => {
                  setShowPersonSelect(false);
                }}>
                {'Done'}
              </Button>
            </DialogActions>
          </Dialog>
        }
      </Dialog>
      : null
  );
};
