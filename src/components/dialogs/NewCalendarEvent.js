import React from 'react';
// import { API, graphqlOperation } from 'aws-amplify';
// import { createPutFact } from '../../graphql/mutations';
// import { getSession } from '../../graphql/queries';
// import useSession from '../../hooks/useSession';

import { useSnackbar } from 'notistack';

import { Lambda } from 'aws-sdk';
import AVAConfirm from '../forms/AVAConfirm';

// import "react-datepicker/dist/react-datepicker.css";

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

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';

// import ClientsSection from '../sections/ClientsSection';

import useMediaQuery from '@material-ui/core/useMediaQuery';

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

  const [description, setDescription] = React.useState();
  const [event_date, setEventDate] = React.useState();
  const [copy_from_date, setCopyFromDate] = React.useState();
  const [copyFromAsADate, setCopyFromAsADate] = React.useState();
  const [copy_to_date, setCopyToDate] = React.useState();
  const [copyToAsADate, setCopyToAsADate] = React.useState();
  const [eventList, setEventList] = React.useState();
  const [copyPending, setCopyPending] = React.useState(false);
  const [rememberedSelection, setRememberedSelection] = React.useState();
  const [confirmMessage, setConfirmMessage] = React.useState('');

  const [last_date, setLastDate] = React.useState();
  const [eventAsADate, setEventAsADate] = React.useState();
  const [lastAsADate, setLastAsADate] = React.useState();
  const [prefMethod, setMethod] = React.useState();
  const [specificPeople, setSpecificPeople] = React.useState();
  const [signup_type, setSignUpType] = React.useState('none');
  const [slot_max_seats, setSlotMaxSeats] = React.useState();
  const [slot_interval, setSlotInterval] = React.useState();
  const [time_from_display_string, setTimeFromAsDisplayString] = React.useState();
  const [timeFromAs24HourNumber, setTimeFromAs24HourNumber] = React.useState();
  const [displayTimes, setIntervalDisplay] = React.useState([]);
  const [time_to_display_string, setTimeToAsDisplayString] = React.useState();
  const [timeToAs24HourNumber, setTimeToAs24HourNumber] = React.useState();
  const [location, setLocation] = React.useState();
  const [showPersonSelect, setShowPersonSelect] = React.useState(false);
  const [showCopyFromPrevious, setShowCopyFromPrevious] = React.useState(false);
  const [person_filter, setPersonFilter] = React.useState('');
  const [restrictionList, setRestrictionList] = React.useState([]);

  const { enqueueSnackbar } = useSnackbar();

  // const [patientGroups, setPatientGroups] = React.useState();

  const [changes, setChanges] = React.useState(false);

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let ordinal = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th',
    '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th',
    '21st', '22nd', '23rd', '24th', '25th', '26th', '27th', '28th'];

  React.useEffect(() => {
    if (patient) {
    }
  }, [patient]);


  const handleAbort = () => {
    setChanges(false);
    onClose();
  };

  const handleUpdate = async () => {
    enqueueSnackbar(`AVA is creating your new event!  Stand by...`, {
      variant: 'warning'
    });
    let invokeFailed = false;
    var payload = {
      "action": "add_event",
      "clientId": patient.client_id,
      "calendar_info": {
        "groups": null,
        "description": description,
        "image": null,
        "event_date": eventAsADate.getTime(),
        "last_date": lastAsADate?.getTime() || eventAsADate?.getTime(),
        "schedule_type": prefMethod,
        "time_from": time_from_display_string,
        "time_to": time_to_display_string,
        "location": location,
        "owner": patient.patient_id,
        "restrictions": restrictionList,
        "signup_type": signup_type,
        "slot_max_seats": slot_max_seats,
        "slot_interval": slot_interval,
        "slot_visibility": "show_name",
        "reminder_minutes_Enrolled": 0,
        "reminder_minutes_NotEnrolled": 0
      }
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log("AVA couldn't save this event.  Error is", JSON.stringify(err));
        enqueueSnackbar(`AVA couldn't save this event.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed && JSON.parse(fResp.Payload).status === 200) {
      enqueueSnackbar(`Your event has been saved!`, {
        variant: 'success'
      });
    }
    onClose();
  };

  // **************************

  const handleChangeDescription = event => {
    setDescription(event.target.value);
    if (event_date && time_from_display_string) { setChanges(true); }
  };

  const handleChangeLocation = event => {
    setLocation(event.target.value);
  };

  const handleSelectPerson = (pPerson) => {
    let newRList = restrictionList;
    newRList.push(pPerson.replace(':', '%%').split(':')[0]);
    setRestrictionList(newRList);
  };

  const choosePerson = () => {
    setShowPersonSelect(true);
  };

  const handleChangePersonFilter = event => {
    setPersonFilter(event.target.value);
  };

  const handleChangeDate = event => {
    setEventDate(event.target.value);
    setEventAsADate(null);
    if (description && time_from_display_string) { setChanges(true); }
  };

  const handleChangeCopyFromDate = event => {
    setCopyFromDate(event.target.value);
    setCopyFromAsADate(null);
  };

  const handleChangeCopyToDate = event => {
    setCopyToDate(event.target.value);
    setCopyToAsADate(null);
    setCopyPending(false);
  };

  const handleChangeTimeFrom = event => {
    setTimeFromAsDisplayString(event.target.value);
    if (description && event_date) { setChanges(true); }
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
      let goodDate = makeDate(event_date);
      setEventAsADate(goodDate);
      if (!prefMethod) { setMethod('specific_date'); };
      setEventDate(goodDate.toDateString());
    }
  };

  const handleCopyFromDateExit = async (event) => {
    if (event.key === 'Enter' || event.type === 'blur') {
      let goodDate = makeDate(event_date);
      setCopyFromDate(goodDate.toDateString());
      let formattedDate = (goodDate.getFullYear() * 10000) + ((goodDate.getMonth() + 1) * 100) + (goodDate.getDate());
      setCopyFromAsADate(formattedDate);
      let invokeFailed = false;
      var payload = {
        "action": "list_events",
        "clientId": patient.client_id,
        "list_filter": {
          "list_start": formattedDate,
          "list_end": formattedDate
        }
      };
      let params = {
        FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance',
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
        Payload: JSON.stringify(payload)
      };
      const fResp = await lambda
        .invoke(params)
        .promise()
        .catch(err => {
          enqueueSnackbar(`AVA couldn't retrieve events.  Error is ${err.message}`, {
            variant: 'error'
          });
          invokeFailed = true;
        });
      if (!invokeFailed) {
        let returnData = JSON.parse(fResp.Payload);
        if (returnData.status === 200) {
          setEventList(returnData.body.map(e => { return [e.calData.description, e.calData.id]; }));
          return;
        }
      }
      setEventList(['No Events Found', '']);
    }
  };

  const handleCopyToDateExit = async (event) => {
    if (event.key === 'Enter' || event.type === 'blur') {
      let goodDate = makeDate(event_date);
      setCopyToDate(goodDate.toDateString());
      setCopyToAsADate((goodDate.getFullYear() * 10000) + ((goodDate.getMonth() + 1) * 100) + (goodDate.getDate()));
      if (rememberedSelection) {
        setConfirmMessage(`Confirm copying ${rememberedSelection[0]} from ${copy_from_date} to ${copy_to_date}`);
        setCopyPending(true);
      }
    }
    setCopyPending(false);
  };

  const handleSelectEventToCopy = async (pEvent) => {
    setRememberedSelection(pEvent);
    if (copyToAsADate) {
      setConfirmMessage(`Confirm copying ${rememberedSelection[0]} from ${copy_from_date} to ${copy_to_date}`);
      setCopyPending(true);
    }
  };

  const executeCopy = async () => {
    let invokeFailed = false;
    var payload = {
      "action": "copy_events",
      "clientId": patient.client_id,
      "request": {
        "id": rememberedSelection[1],
        "occ_date": copyFromAsADate,
        "to_date": copyToAsADate
      }
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA couldn't retrieve events.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let returnData = JSON.parse(fResp.Payload);
      if (returnData.status === 200) {
        enqueueSnackbar(`Your event has been copied!`, { variant: 'success' });
        return;
      }
    }
    enqueueSnackbar(`AVA could not copy that event`, { variant: 'error' });
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
        mm += s;
        if (mm > 59) {
          mm -= 60;
          hh_raw++;
        }
        t = (hh_raw * 100) + mm;
      }
      setIntervalDisplay(intervals);
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
            {changes ?
              <Button
                onClick={() => {
                  setChanges(false);
                  handleUpdate();
                }}
                disabled={!changes}
                hidden={!changes}
                variant='contained'
                className={classes.topButton}
              >
                {isMobile ? 'Save' : 'Save Changes'}
              </Button>
              : null
            }
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
                    value={description}
                    fullWidth
                    onChange={handleChangeDescription}
                    helperText='Description'
                  />
                </div>
                <div>
                  <TextField
                    id='location'
                    value={location}
                    fullWidth
                    onChange={handleChangeLocation}
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
                  <Typography className={classes.radioText}>Do you wish to restrict this event to specific people only?</Typography>
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
                              {restrictionEntry.split('%%')[0]}
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
                    <Button className={classes.defaultButton} size='small' variant='contained' onClick={choosePerson}>
                      {`Choose ${restrictionList.length > 0 ? 'more ' : ''}Attendees?`}
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
                <Button
                  onClick={() => {
                    setShowCopyFromPrevious(true);
                  }}
                  className={classes.rowButton}
                >
                  {`Copy`}
                </Button>
              </DialogActions>
            </Box>
          </Box>
        </Box>
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
        {showCopyFromPrevious &&
          <Dialog
            p={2}
            height={250}
            fullWidth
            variant={'elevation'} elevation={2}
            open={showCopyFromPrevious}
            TransitionComponent={Transition}
          >
            <Paper component={Box} variant='outlined' width='100%' overflow='auto' square>
              <TextField
                id='Enter the date of the event you are copying from'
                value={copy_from_date}
                onKeyPress={handleCopyFromDateExit}
                onChange={handleChangeCopyFromDate}
                onBlur={handleCopyFromDateExit}
                helperText='Copy From'
              />
              <TextField
                id='Enter the date you want for the copy of the event'
                value={copy_to_date}
                onKeyPress={handleCopyToDateExit}
                onChange={handleChangeCopyToDate}
                onBlur={handleCopyToDateExit}
                helperText='Copy To'
              />
              {eventList && eventList.length > 0 &&
                <List component='nav'>
                  {eventList.map((listEntry, x) => (
                    <ListItem
                      key={`${listEntry[1]}_select_${x}`}
                      onClick={() => { handleSelectEventToCopy(listEntry[1]); }}
                      button>
                      <Typography
                        className={classes.listItemAVA}>
                        {listEntry[0]}
                      </Typography>
                    </ListItem>
                  ))}
                </List>
              }
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
        {copyPending &&
          <AVAConfirm
            promptText={confirmMessage}
            onCancel={() => {
              setCopyPending(false);
            }}
            onConfirm={() => {
              executeCopy();
              setCopyPending(false);
            }}
          >
          </AVAConfirm>
        }
      </Dialog>
      : null
  );
};
