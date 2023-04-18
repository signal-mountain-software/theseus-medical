import React from 'react';

import { prepareTargets } from '../../util/AVAGroups';
import { makeArray, cl } from '../../util/AVAUtilities';
import { addEvent } from '../../util/AVACalendars';

import { useSnackbar } from 'notistack';

import PersonFilter from '../forms/PersonFilter';

import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Checkbox from '@material-ui/core/Checkbox';
import FormGroup from '@material-ui/core/FormGroup';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';

import ListItem from '@material-ui/core/ListItem';

import useSession from '../../hooks/useSession';

const useStyles = makeStyles(theme => ({
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    flexGrow: 1
  },
  formControlDays: {
    margin: 0,
    marginLeft: '-8px',
    marginRight: '2px',
    paddingTop: 0,
    height: 1,
    fontSize: theme.typography.fontSize * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '10px',
    marginBottom: '25px',
  },
  centerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -12
  },
  radioDays: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 2,
    marginLeft: 0,
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
    margin: 0,
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
    marginTop: 20,
    textTransform: 'none',
    verticalAlign: 'center',
    color: theme.palette.confirm[theme.palette.type],
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
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
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

  const { state } = useSession();
  const { session } = state;
  const [message_targets, setMessageTargets] = React.useState();
  const [targetInfo, setTargetInfo] = React.useState();
  const [owner_targets, setOwnerTargets] = React.useState();
  const [ownerTargetInfo, setOwnerTargetInfo] = React.useState();
  const [description, setDescription] = React.useState(' ');
  const [event_date, setEventDate] = React.useState(' ');

  const [last_date, setLastDate] = React.useState();
  const [eventAsADate, setEventAsADate] = React.useState();
  const [lastAsADate, setLastAsADate] = React.useState();
  const [prefMethod, setMethod] = React.useState();
  const [specificPeople, setSpecificPeople] = React.useState();
  const [specificOwners, setSpecificOwners] = React.useState();
  const [signup_type, setSignUpType] = React.useState('none');
  const [slot_max_seats, setSlotMaxSeats] = React.useState();
  const [slot_interval, setSlotInterval] = React.useState();
  const [time_from_display_string, setTimeFromAsDisplayString] = React.useState();
  const [timeFromAs24HourNumber, setTimeFromAs24HourNumber] = React.useState();
  const [displayTimes, setIntervalDisplay] = React.useState([]);
  const [displayTimes24, setDisplayTimes24] = React.useState([]);
  const [time_to_display_string, setTimeToAsDisplayString] = React.useState();
  const [timeToAs24HourNumber, setTimeToAs24HourNumber] = React.useState();
  const [location, setLocation] = React.useState();
  const [showPersonSelect, setShowPersonSelect] = React.useState(false);
  const [showOwnerSelect, setShowOwnerSelect] = React.useState(false);
  const [restrictionList, setRestrictionList] = React.useState([]);
  const [ownerList, setOwnerList] = React.useState([patient.patient_id]);

  const [checkedDays, setCheckedDays] = React.useState({});

  const { closeSnackbar, enqueueSnackbar } = useSnackbar();

  // const [patientGroups, setPatientGroups] = React.useState();

  let intervals24h = [];

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  let ordinal = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
    '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th',
    '21st', '22nd', '23rd', '24th', '25th', '26th', '27th', '28th'];

  React.useEffect(() => {
    if (patient) {
    }
  }, [patient]);

  const handleAbort = () => {
    onClose();
  };

  const handleUpdate = async () => {
    enqueueSnackbar(`AVA is creating your new event!  Stand by...`, { variant: 'warning' });
    let oDays = [];
    Object.keys(checkedDays).forEach(a => {
      if (checkedDays[a]) { oDays.push(Number(a))};
    })
    var payload = {
      "clientId": patient.client_id,
      "calendar_info": {
        "groups": null,
        "description": description,
        "image": null,
        "event_date": eventAsADate.getTime(),
        "last_date": lastAsADate?.getTime() || null,
        "schedule_type": prefMethod,
        "time_from": time_from_display_string,
        "time_to": time_to_display_string,
        "slots": setSlots(signup_type),
        "occDays": oDays,
        "location": location,
        "owner": ownerList,
        "restrictions": restrictionList,
        "signup_type": signup_type,
        "slot_max_seats": slot_max_seats,
        "slot_interval": slot_interval,
        "slot_visibility": "show_name",
        "reminder_minutes_Enrolled": 0,
        "reminder_minutes_NotEnrolled": 0
      }
    };
    let response = await addEvent(payload);
    closeSnackbar();
    if (response) { 
      enqueueSnackbar(`${response.eventData.event_data.description} has been saved!`, { variant: 'success' });
    }
    else { 
      enqueueSnackbar(`Sorry.  AVA could not save this event!`, { variant: 'error' });
    }
    onClose();
  };

  // **************************

  function setSlots(inType) {
    if ((inType === 'time') && (displayTimes24.length > 0)) { return displayTimes24; }
    else if ((inType === 'seats') && (slot_max_seats)) { return setSeatNames(slot_max_seats); }
    else { return null; }
  }

  function setSeatNames(pNum) {
    let inNum = Number(pNum);
    let digits, starter, lastSeat;
    if (isNaN(inNum)) { return []; }
    else if (inNum < 10) { digits = 1; starter = 11; lastSeat = 10 + inNum; }
    else if (inNum < 100) { digits = 2; starter = 101; lastSeat = 100 + inNum; }
    else if (inNum < 1000) { digits = 3; starter = 1001; lastSeat = 1000 + inNum; }
    else return [];
    let returnArr = [];
    for (let i = starter; i <= lastSeat; i++) {
      returnArr.push((i.toString().slice(-digits)));
    }
    return returnArr;
  }

  function OK2Save() {
    return ((description.trim() !== '') && (event_date.trim() !== ''));
  }

  let filterTimeOut;
  const handleChangeDescription = vCheck => {
    clearTimeout(filterTimeOut);
    cl(`set timeout with ${vCheck}`);
    filterTimeOut = setTimeout(() => {
      cl(`timeout ended ${vCheck}`);
      setDescription(vCheck);
    }, 500);
  };

  const handleChangeLocation = vCheck => {
    clearTimeout(filterTimeOut);
    cl(`set timeout with ${vCheck}`);
    filterTimeOut = setTimeout(() => {
      cl(`timeout ended ${vCheck}`);
      setLocation(vCheck);
    }, 500);
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
      if (!time_to_display_string) {
        if (slot_interval) { assumeToTime(calcFromTime); }
      }
      else if (timeToAs24HourNumber && (timeToAs24HourNumber < calcFromTime)) {
        if (timeToAs24HourNumber < 1200) {
          setTimeToAs24HourNumber(timeToAs24HourNumber + 1200);
          setTimeToAsDisplayString(time_to_display_string.replace('am', 'pm'));
        }
        else {
          setTimeToAs24HourNumber(timeFromAs24HourNumber + 100);
          if (hh === 11) { ampm = (ampm = 'am' ? 'pm' : 'am'); }
          if (hh === 12) { hh = 1; }
          else { hh++; };
          setTimeToAsDisplayString(`${hh}:${mm < 10 ? ('0' + mm) : mm} ${ampm}`);
        }
      }
      if (displayTimes.length > 0) {
        handleExitInterval({ key: event.key, type: event.type, fromTime: calcFromTime });
      }
    }
  };

  function assumeToTime(pFromTime) {
    let newTime = pFromTime >= 2300 ? (pFromTime % 100) : (pFromTime + 100);
    setTimeToAs24HourNumber(newTime);
    let hh = Math.floor(newTime / 100);
    let mm = newTime % 100;
    setTimeToAsDisplayString(`${hh === 0 ? '12' : (hh > 12 ? (hh - 12) : hh).toString()}:${mm < 10 ? ('0' + mm) : mm} ${newTime > 1159 ? 'pm' : 'am'}`);
  };

  const handleTimeToExit = event => {
    if ((event.key === 'Enter' || event.type === 'blur') && time_to_display_string) {
      let ampm = null;
      if (time_to_display_string.includes('p')) { ampm = 'pm'; }
      else if (time_to_display_string.includes('a')) { ampm = 'am'; };
      let [hh$, mm$] = time_to_display_string.split(':');
      let hh = Number(hh$.replace(/\D+/g, ''));
      let mm = 0;
      if (hh > 100) {
        if (!mm$) { mm = hh % 100; }
        hh = Math.floor(hh / 100);
      }
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
      let calcToTime = 0;
      if (ampm === 'pm') {
        calcToTime = (hh < 12 ? ((hh + 12) * 100) : 1200) + mm;
      }
      else {
        calcToTime = ((hh < 12 ? (hh * 100) : 0) + mm);
      }
      if (timeFromAs24HourNumber && (calcToTime < timeFromAs24HourNumber)) {
        if (calcToTime < 1200) {
          calcToTime += 1200;
        }
        else {
          calcToTime = timeFromAs24HourNumber + 100;
        }
      }
      setTimeToAs24HourNumber(calcToTime);
      mm = calcToTime % 100;
      hh = Math.floor(calcToTime / 100);
      ampm = hh > 11 ? 'pm' : 'am';
      setTimeToAsDisplayString(`${hh > 12 ? hh - 12 : hh}:${mm < 10 ? ('0' + mm) : mm} ${ampm}`);
      if (displayTimes.length > 0) {
        handleExitInterval({ key: event.key, type: event.type, toTime: calcToTime });
      }
    }
  };

  const handleChangeTimeTo = event => {
    setTimeToAsDisplayString(event.target.value);
  };

  const handleDateExit = event => {
    if (event.key === 'Enter' || event.type === 'blur') {
      let goodDate = makeDate(event_date.trim());
      setEventAsADate(goodDate);
      if (!prefMethod) { setMethod('specific_date'); };
      setEventDate(goodDate.toDateString());
    }
  };

  function makeDate(pDate) {
    let goodDate = new Date(pDate);
    if (isNaN(goodDate)) {
      let jump = 0;
      let tDate = pDate.substr(0, 3).toLowerCase();
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

  const handleChangeLastDate = event => {
    setLastAsADate(null);
    setLastDate(event.target.value);
  };

  const handleLastDateExit = event => {
    if (event.key === 'Enter' || event.type === 'blur') {
      let goodDate = new Date(last_date);
      if (isNaN(goodDate.getTime())) {     // invalid date input
        if (event_date) {
          let addYears = 1;
          if (prefMethod === 'annually_on') { addYears = 10; }
          goodDate = new Date(event_date);
          goodDate.setFullYear(goodDate.getFullYear() + addYears);
        }
        else {
          setLastDate('');
          setLastAsADate(null);
        }
      }
      let current = new Date(Date.now());
      if (goodDate < current) {
        let yyyy = current.getFullYear();
        goodDate.setFullYear(yyyy);
        if (goodDate < current) { goodDate.setFullYear(yyyy + 1); }
      };
      setLastDate(goodDate.toDateString());
      setLastAsADate(goodDate);
    }
  };

  const handleChangeMethod = event => {
    setMethod(event.target.value);
  };


  const handleChangeOwnersToggle = event => {
    setSpecificOwners(event.target.value);
  };

  const handleChangePeopleToggle = event => {
    setSpecificPeople(event.target.value);
  };

  const handleChangeSignUp = event => {
    setSignUpType(event.target.value);
    if (event.target.value === 'time' && !time_to_display_string) {
      assumeToTime(timeFromAs24HourNumber);
    }
  };

  const handleChangeMaxSeats = event => {
    setSlotMaxSeats(event.target.value);
  };

  const handleChangeInterval = event => {
    setSlotInterval(event.target.value);
  };

  const handleExitInterval = event => {
    let intervals = [];
    if (
      (event.key === 'Enter' || event.type === 'blur')
      && (timeFromAs24HourNumber || event.hasOwnProperty('fromTime'))
      && (timeToAs24HourNumber || event.hasOwnProperty('toTime'))
    ) {
      let useFromTime = event.fromTime || timeFromAs24HourNumber;
      let useToTime = event.toTime || timeToAs24HourNumber;
      let s = Number(slot_interval);
      let m = useToTime % 100;
      let h = Math.floor(useToTime / 100);
      m -= s;
      if (m < 0) {
        m += 60;
        h--;
        if (h < 0) { h += 24; }
      }
      let stopLoop = (h * 100) + m;
      for (
        let t = useFromTime;
        t <= stopLoop;
        t
      ) {
        let mm = t % 100;
        let hh_raw = Math.floor(t / 100);
        let hh = hh_raw;
        if (hh_raw > 12) { hh = hh_raw - 12; }
        else if (hh_raw === 0) { hh = 12; };
        intervals.push(`${hh}:${mm < 10 ? '0' + mm : mm}`);
        intervals24h.push((10000 + (hh_raw * 100) + mm).toString().slice(-4));
        mm += s;
        if (mm > 59) {
          mm -= 60;
          hh_raw++;
        }
        t = (hh_raw * 100) + mm;
      }
      setIntervalDisplay(intervals);
      setDisplayTimes24(intervals24h);
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
              {'Create a New Event'}
            </Typography>
          </Toolbar>
        </AppBar>
        <Toolbar />
        <Box m={2}>
          <Paper component={Box} variant={'outlined'}>
            <Box mt={1} py={1} px={3} borderBottom={2}>
              <Box flexGrow={1}>
                <Typography variant='h6'>Event Details</Typography>
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
                    id='description'
                    fullWidth
                    onChange={event => (handleChangeDescription(event.target.value))}
                    helperText='Description'
                  />
                </div>
                <div>
                  <TextField
                    id='location'
                    fullWidth
                    onChange={event => (handleChangeLocation(event.target.value))}
                    helperText='Location'
                  />
                </div>
                <div>
                  <TextField
                    id='event_date'
                    value={event_date}
                    onKeyPress={handleDateExit}
                    onChange={handleChangeDate}
                    onBlur={handleDateExit}
                    helperText='Event Date'
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
                          value="annually_on"
                          control={<Radio disableRipple className={classes.radioButton} size='small' />}
                          label={
                            <Typography className={classes.radioText}>
                              {`Every year on ${eventAsADate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                            </Typography>}
                        />
                        <FormControlLabel
                          className={classes.formControlLbl}
                          value="weekly_on"
                          control={<Radio disableRipple className={classes.radioButton} size='small' />}
                          label={
                            <Typography className={classes.radioText}>
                              {`Every week`}
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
                        {eventAsADate.getDate() < 29 &&
                          <FormControlLabel
                            className={classes.formControlLbl}
                            value="monthly_by_date"
                            control={<Radio disableRipple className={classes.radioButton} size='small' />}
                            label={
                              <Typography className={classes.radioText}>
                                {`Every month on the ${ordinal[(eventAsADate.getDate()) - 1]}`}
                              </Typography>}
                          />
                        }
                      </RadioGroup>
                    </FormControl>
                  </Box>
                }
                {(prefMethod && prefMethod === 'weekly_on') &&
                  <Box display={'flex'} flexDirection={'row'} className={classes.formControlDayRow} flexWrap={'wrap'} >
                    <Typography className={classes.radioText}>
                      {`Which days?`}
                    </Typography>
                    <FormControl className={classes.formControl} component="fieldset">
                      <FormGroup row aria-label={`message_routedays_method`} name="method">
                        <FormControlLabel
                          className={classes.formControlDays}
                          control={
                            <Checkbox
                              className={classes.centerCenter}
                              value={checkedDays['0']}
                              name={`message_routing_0`}
                              onClick={() => {
                                if (checkedDays[0]) { checkedDays[0] = false; }
                                else { checkedDays[0] = true; }
                                setCheckedDays(checkedDays);
                              }}
                              disableRipple
                              inputProps={{ 'aria-labelledby': `message_routing_0` }}
                            />
                          }
                          label={<Typography className={classes.radioDays}>Sun</Typography>}
                          labelPlacement='bottom'
                        />
                        <FormControlLabel
                          className={classes.formControlDays}
                          control={
                            <Checkbox
                              className={classes.centerCenter}
                              value={checkedDays['1']}
                              name={`message_routing_1`}
                              onClick={() => {
                                if (checkedDays[1]) { checkedDays[1] = false; }
                                else { checkedDays[1] = true; }
                                setCheckedDays(checkedDays);
                              }}
                              disableRipple
                              inputProps={{ 'aria-labelledby': `message_routing_1` }}
                            />
                          }
                          label={<Typography className={classes.radioDays}>Mon</Typography>}
                          labelPlacement='bottom'
                        />
                        <FormControlLabel
                          className={classes.formControlDays}
                          value="AVA"
                          control={
                            <Checkbox
                              className={classes.centerCenter}
                              value={checkedDays['2']}
                              name={`message_routing_2`}
                              onClick={() => {
                                if (checkedDays[2]) { checkedDays[2] = false; }
                                else { checkedDays[2] = true; }
                                setCheckedDays(checkedDays);
                              }}
                              disableRipple
                              inputProps={{ 'aria-labelledby': `message_routing_2` }}
                            />
                          }
                          label={<Typography className={classes.radioDays}>Tue</Typography>}
                          labelPlacement='bottom'
                        />
                        <FormControlLabel
                          className={classes.formControlDays}
                          value="AVA"
                          control={
                            <Checkbox
                              className={classes.centerCenter}
                              value={checkedDays['3']}
                              name={`message_routing_3`}
                              onClick={() => {
                                if (checkedDays[3]) { checkedDays[3] = false; }
                                else { checkedDays[3] = true; }
                                setCheckedDays(checkedDays);
                              }}
                              disableRipple
                              inputProps={{ 'aria-labelledby': `message_routing_3` }}
                            />
                          }
                          label={<Typography className={classes.radioDays}>Wed</Typography>}
                          labelPlacement='bottom'
                        />
                        <FormControlLabel
                          className={classes.formControlDays}
                          value="AVA"
                          control={
                            <Checkbox
                              className={classes.centerCenter}
                              value={checkedDays['4']}
                              name={`message_routing_4`}
                              onClick={() => {
                                if (checkedDays[4]) { checkedDays[4] = false; }
                                else { checkedDays[4] = true; }
                                setCheckedDays(checkedDays);
                              }}
                              disableRipple
                              inputProps={{ 'aria-labelledby': `message_routing_4` }}
                            />
                          }
                          label={<Typography className={classes.radioDays}>Thu</Typography>}
                          labelPlacement='bottom'
                        />
                        <FormControlLabel
                          className={classes.formControlDays}
                          value="AVA"
                          control={
                            <Checkbox
                              className={classes.centerCenter}
                              value={checkedDays['5']}
                              name={`message_routing_5`}
                              onClick={() => {
                                if (checkedDays[5]) { checkedDays[5] = false; }
                                else { checkedDays[5] = true; }
                                setCheckedDays(checkedDays);
                              }}
                              disableRipple
                              inputProps={{ 'aria-labelledby': `message_routing_5` }}
                            />
                          }
                          label={<Typography className={classes.radioDays}>Fri</Typography>}
                          labelPlacement='bottom'
                        />
                        <FormControlLabel
                          className={classes.formControlDays}
                          value="AVA"
                          control={
                            <Checkbox
                              className={classes.centerCenter}
                              value={checkedDays['6']}
                              name={`message_routing_6`}
                              onClick={() => {
                                if (checkedDays[6]) { checkedDays[6] = false; }
                                else { checkedDays[6] = true; }
                                setCheckedDays(checkedDays);
                              }}
                              disableRipple
                              inputProps={{ 'aria-labelledby': `message_routing_6` }}
                            />
                          }
                          label={<Typography className={classes.radioDays}>Sat</Typography>}
                          labelPlacement='bottom'
                        />
                      </FormGroup>
                    </FormControl>
                  </Box>
                }
                {(prefMethod && prefMethod !== 'specific_date') &&
                  <div>
                    <TextField
                      id='last_date'
                      value={last_date}
                      onKeyPress={handleLastDateExit}
                      onChange={handleChangeLastDate}
                      onBlur={handleLastDateExit}
                      helperText='Last Date to Schedule'
                    />
                  </div>
                }
                <div>
                  <TextField
                    id='time_from_display_string'
                    value={time_from_display_string}
                    onChange={handleChangeTimeFrom}
                    onKeyPress={handleTimeFromExit}
                    onBlur={handleTimeFromExit}
                    helperText='Start time'
                  />
                  {'    '}
                  <TextField
                    id='time_to_display_string'
                    value={time_to_display_string}
                    onChange={handleChangeTimeTo}
                    onKeyPress={handleTimeToExit}
                    onBlur={handleTimeToExit}
                    helperText='End time'
                  />
                </div>
                <Box
                  display="flex"
                  pt={2}
                  pb={1}
                  flexDirection='column'
                  justifyContent="center"
                >
                  <Typography className={classes.radioText}>Does this event require sign-up?</Typography>
                  <FormControl className={classes.formControl} component="fieldset">
                    <RadioGroup
                      row
                      defaultValue={signup_type}
                      aria-label="SignUp"
                      name="signup"
                      value={signup_type}
                      onChange={handleChangeSignUp}
                    >
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="none"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Open/Unlimited
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="seats"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Limited to a maximum number of Participants
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="time"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Schedule appointments at specific intervals
                          </Typography>}
                      />
                    </RadioGroup>
                  </FormControl>
                </Box>
                {(signup_type === 'seats') &&
                  <div>
                    <TextField
                      id='slot_max_seats'
                      value={slot_max_seats}
                      onChange={handleChangeMaxSeats}
                      helperText='Maximum number of participants'
                    />
                  </div>
                }
                {(signup_type === 'time') &&
                  <div>
                    <TextField
                      id='slot_interval'
                      value={slot_interval}
                      onChange={handleChangeInterval}
                      onKeyPress={handleExitInterval}
                      onBlur={handleExitInterval}
                      helperText='How long between appointment times? (in minutes)'
                    />
                  </div>
                }
                {(displayTimes.length > 0) && (signup_type === 'time') &&
                  <React-Fragment>
                    <Box flexGrow={1} mr={3} mt={2}
                      display="flex"
                      flexDirection='row'
                      flexWrap={'wrap'}
                      alignItems="center"
                      justifyContent="flex-start"
                    >
                      <Typography className={classes.radioText}>
                        {'Appointment schedule will be'}
                      </Typography>
                      {displayTimes.map((time) => (
                        <Typography key={`t${time}`} className={classes.radioText}>
                          {time}
                        </Typography>
                      ))}
                    </Box>
                  </React-Fragment>
                }
                <Box
                  display="flex"
                  pt={2}
                  pb={1}
                  flexDirection='column'
                  justifyContent="center"
                >
                  <Typography className={classes.radioText}>Do you wish to restrict this event to specific groups only?</Typography>
                  <FormControl className={classes.formControl} component="fieldset">
                    <RadioGroup
                      row
                      defaultValue={'no'}
                      aria-label="restrictions"
                      name="restrictions"
                      value={specificPeople}
                      onChange={handleChangePeopleToggle}
                    >
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="no"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            No
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="yes"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Yes
                          </Typography>}
                      />
                    </RadioGroup>
                  </FormControl>
                </Box>
                {(specificPeople === 'yes') &&
                  <div>
                    {restrictionList.length > 0 ?
                      restrictionList.map((restrictionEntry, x) => (
                        (
                          <ListItem
                            key={`${restrictionEntry}_selected_${x}`}
                            className={classes.noRow}
                          >
                            <Typography
                              className={classes.radioText}>
                              {(typeof targetInfo[restrictionEntry].name === 'object')
                                ? `${targetInfo[restrictionEntry].name.first} ${targetInfo[restrictionEntry].name.last}`
                                : targetInfo[restrictionEntry].name
                              }
                            </Typography>
                          </ListItem>
                        )
                      ))
                      : (
                        <Typography
                          className={classes.radioText}>
                          {'Tap the button below to choose...'}
                        </Typography>
                      )
                    }
                    <Button
                      className={classes.defaultButton}
                      size='small'
                      variant='outlined'
                      onClick={async () => {
                        let targetObj = await prepareTargets(session.user_id, session.client_id, { includeGroups: true, includePeople: false });
                        setMessageTargets(targetObj.responsibleList.sort());
                        setTargetInfo(targetObj.responsibleObj);
                        setShowPersonSelect(true); 
                      }}
                    >
                      {`Tap to select`}
                    </Button>
                  </div>
                }
                <Box
                  display="flex"
                  pt={2}
                  pb={1}
                  flexDirection='column'
                  justifyContent="center"
                >
                  <Typography className={classes.radioText}>Show someone other than you be listed as an event owner?</Typography>
                  <FormControl className={classes.formControl} component="fieldset">
                    <RadioGroup
                      row
                      defaultValue={'no'}
                      aria-label="ownership"
                      name="ownership"
                      value={specificOwners}
                      onChange={handleChangeOwnersToggle}
                    >
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="no"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            No
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="yes"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Yes
                          </Typography>}
                      />
                    </RadioGroup>
                  </FormControl>
                </Box>
                {(specificOwners === 'yes') &&
                  <div>
                    {ownerList.length > 0 ?
                      ownerList.map((ownerEntry, x) => (
                        (
                          <ListItem
                            key={`${ownerEntry}_selected_${x}`}
                            className={classes.noRow}
                          >
                            <Typography
                              className={classes.radioText}>
                              {ownerTargetInfo && ownerTargetInfo[ownerEntry] &&
                                ((typeof ownerTargetInfo[ownerEntry].name === 'object')
                                ? `${ownerTargetInfo[ownerEntry].name.first} ${ownerTargetInfo[ownerEntry].name.last}`
                                : ownerTargetInfo[ownerEntry].name
                                )
                              }
                            </Typography>
                          </ListItem>
                        )
                      ))
                      : (
                        <Typography
                          className={classes.radioText}>
                          {'Tap the button below to choose...'}
                        </Typography>
                      )
                    }
                    <Button
                      className={classes.defaultButton}
                      size='small'
                      variant='outlined'
                      onClick={async () => {
                        let ownerTargetObj = await prepareTargets(session.user_id, session.client_id, { includeGroups: false, includePeople: true });
                        setOwnerTargets(ownerTargetObj.responsibleList.sort());
                        setOwnerTargetInfo(ownerTargetObj.responsibleObj);
                        setShowOwnerSelect(true);
                      }}
                    >
                      {`Tap to select`}
                    </Button>
                  </div>
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
                  {'Done'}
                </Button>
                {OK2Save() &&
                  <Button
                    onClick={() => {                      
                      handleUpdate();
                    }}
                    className={classes.rowButton}
                  >
                    {'Save'}
                  </Button>
                }
              </DialogActions>
            </Box>
          </Box>
        </Box>
        {showPersonSelect &&
          <PersonFilter
            prompt={'Restricted to which groups?'}
            peopleList={message_targets}
            multiSelect={true}
            alreadyChecked={restrictionList}
            onCancel={() => {
              setShowPersonSelect(false);
            }}
            onSelect={(pChoices) => {
              setRestrictionList(makeArray(pChoices));
              setShowPersonSelect(false);
            }}
          >
          </PersonFilter>
        }
        {showOwnerSelect &&
          <PersonFilter
            prompt={`Who else should be listed as an owner for ${description}?`}
            peopleList={owner_targets}
            multiSelect={true}
            alreadyChecked={ownerList}
            onCancel={() => {
              setShowOwnerSelect(false);
            }}
            onSelect={(pChoices) => {
              setOwnerList(makeArray(pChoices));
              setShowOwnerSelect(false);
            }}
          >
          </PersonFilter>
        }
      </Dialog>
      : null
  );
};
