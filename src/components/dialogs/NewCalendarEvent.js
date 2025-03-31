import React from 'react';

import { prepareTargets } from '../../util/AVAGroups';
import { makeArray, titleCase, listFromArray } from '../../util/AVAUtilities';
import { addEvent, writeSlot } from '../../util/AVACalendars';
import { AVAclasses } from '../../util/AVAStyles';

import ClientsSection from '../sections/ClientsSection';
import EditList from '../forms/EditList';
import Select from "react-dropdown-select";

import { makeDate, makeTime, addMonths } from '../../util/AVADateTime';

import { useSnackbar } from 'notistack';

import PersonFilter from '../forms/PersonFilter';

import { AVATextStyle } from '../../util/AVAStyles';

import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import IconButton from '@material-ui/core/IconButton';
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
import { getPerson } from '../../util/AVAPeople';

const useStyles = makeStyles(theme => ({
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    flexGrow: 1
  },
  radius_rounded: {
    borderRadius: '30px'
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
  dialogBox: {
    paddingTop: 0,
    paddingLeft: 0,
    paddingBottom: theme.spacing(1),
    overflowX: 'hidden',
    marginLeft: theme.spacing(2),
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
  timeInput: {
    marginRight: '16px'
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 5,
  },
}));

export default ({ patient, personalEvent, picture, showNewEvent, onClose, isAppointment, options = {} }) => {
  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { state } = useSession();
  const { session } = state;
  const [ownerTargetInfo, setOwnerTargetInfo] = React.useState();

  const [last_date, setLastDate] = React.useState(' ');
  const [lastAsADate, setLastAsADate] = React.useState();
  const [specificPeople, setSpecificPeople] = React.useState(' ');
  const [customizeButton, setcustomizeButton] = React.useState(false);
  const [specificOwners, setSpecificOwners] = React.useState(' ');
  const [signup_type, setSignUpType] = React.useState('none');
  const [defaultSlotOwners, setDefaultSlotOwners] = React.useState('none');
  const [slot_max_seats, setSlotMaxSeats] = React.useState(' ');
  const [signup_start, setSignup_start] = React.useState(' ');
  const [signup_end, setSignup_end] = React.useState(' ');
  const [slot_interval, setSlotInterval] = React.useState(' ');
  const [eventDateAsDisplayString, setEventDateAsDisplayString] = React.useState((options.setDate ? options.setDate.dateObj.absolute : ' '));
  const [displayTimes, setIntervalDisplay] = React.useState([]);
  const [showOwnerSelect, setShowOwnerSelect] = React.useState(false);
  const [ownerList, setOwnerList] = React.useState([patient.person_id || patient.patient_id]);

  const [checkedDays, setCheckedDays] = React.useState({});

  const { closeSnackbar, enqueueSnackbar } = useSnackbar();

  const [reactData, setReactData] = React.useState({
    groupList: [],
    restrictToGroups: [],
    slotObjList: [],
    event_date: (options.setDate ? options.setDate.dateObj : null),
    prefMethod: 'specific_date',
    preReservationList: ((options.setPerson && isAppointment) ? [patient.person_id || patient.patient_id] : []),
    dateObj: { error: true },
    default_forms: options.forms,
    customizations: options.customizations,
    chosen_names: ((options.setPerson && isAppointment) ? patient.display_name : ''),
    event_title: (options.title ? titleCase(options.title.trim())
      : ((options.setPerson && isAppointment) ? (`Appointment for ${patient.display_name}`) : '')),
    title_override: false,
    event_location: (options.location
      ? options.location
      : ((options.setPerson && isAppointment) ? patient.location : '')
    ),
    location_override: false,
    initialized: false,
    allDay: true,
    startObj: { empty: true },
    endObj: { empty: true },
    timeOK: true
  });

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) {
      setForceRedisplay(!forceRedisplay);
    }
  };

  const makeChoices = (rawList) => {
    let response = [];
    rawList.forEach(listEntry => {
      if ((listEntry.access !== 'none') && (listEntry.access !== 'view')) {
        response.push({
          value: listEntry.person_id,
          label: listEntry.display_name
        });
      }
    });
    return response;
  };

  const dOfw = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
    if (reactData.prefMethod && ((reactData.prefMethod === 'weekly_on') || (reactData.prefMethod === 'bi-weekly_on'))) {
      Object.keys(checkedDays).forEach(a => {
        if (checkedDays[a]) { oDays.push(Number(a)); };
      });
    }
    let time_duration;
    if (reactData.allDay) {

    }
    if (reactData.startObj.good && reactData.endObj.good) {
      time_duration = reactData.endObj.minutesSinceMidnight - reactData.startObj.minutesSinceMidnight;
      if (time_duration < 0) {
        time_duration += 1440;
      }
    }
    var payload = {
      "clientId": patient.client_id,
      "calendar_info": {
        "groups": null,
        "description": reactData.event_title,
        "image": null,
        "event_date": reactData.event_date.date.getTime(),
        "last_date": lastAsADate?.getTime() || null,
        "schedule_type": reactData.prefMethod,
        "time_from": reactData.startObj.time,
        "time_to": reactData.endObj.time,
        time_duration,
        allDay: reactData.allDay,
        "default_forms": reactData.default_forms,
        "customizations": reactData.customizations,
        "slots": reactData.slotObjList.map(s => { return s.key; }),
        "slot_object_list": reactData.slotObjList,
        "defaultSlotOwners": defaultSlotOwners,
        "occDays": oDays,
        "location": reactData.event_location,
        "owner": ownerList,
        "personal_event": !!personalEvent && !isAppointment,
        "restrictions": reactData.restrictToGroups,
        "signup_type": signup_type,
        "slot_max_seats": slot_max_seats,
        "signup_end": signup_end,
        "signup_start": signup_start,
        "slot_interval": slot_interval,
        "slot_visibility": "show_name",
        "reminder_minutes_Enrolled": 0,
        "reminder_minutes_NotEnrolled": 0
      }
    };
    let response = await addEvent(payload);
    response.slots = [];
    if (!!personalEvent
      && !isAppointment    // this is a personal event, not an appointment; the owner MUST be added to a slot
      && (!reactData.preReservationList.includes(state.session.patient_id))
    ) {
      reactData.preReservationList.push(state.session.patient_id);
    }
    if ((isAppointment || personalEvent) && (reactData.preReservationList.length > 0)) {
      for (let o = 0; o < response.occRecords.occArray.length; o++) {
        let this_occurrence = response.occRecords.occArray[o];
        for (let s = 0; s < reactData.preReservationList.length; s++) {
          let this_person = reactData.preReservationList[s];
          let writeRequest = {
            "client": state.session.client_id,
            "event": response.event_id,
            occurrence_date: this_occurrence,
            "owner": this_person,
            "slot": payload.calendar_info.slots[s] || this_person,
            "status": 'selected',
            "show_this_slot": true,
            "no_messaging": true
          };
          let this_slot = await writeSlot(writeRequest);
          response.slots.push(this_slot);
        }
      }
    }
    closeSnackbar();
    if (response) {
      enqueueSnackbar(`${response.eventData.event_data.description} has been saved!`, { variant: 'success' });
    }
    else {
      enqueueSnackbar(`Sorry.  AVA could not save this event!`, { variant: 'error' });
    }
    localStorage.setItem(`calendarChanged`, true);
    onClose(response);
  };

  // **************************

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
    return ((reactData.event_date && !reactData.event_date.error)
      && (reactData.event_title.trim() !== '')
      && (!isAppointment || (reactData.preReservationList.length > 0))
      && reactData.timeOK
    );
  }

  const handleChangeDescription = vCheck => {
    updateReactData({
      event_title: vCheck,
      title_override: true
    }, true);
  };

  const handleChangeLocation = vCheck => {
    updateReactData({
      event_location: vCheck,
      location_override: true
    }, true);
  };

  const handleChangeEventDate = event => {
    setEventDateAsDisplayString(event.target.value);
  };

  const handleChangeLastDate = event => {
    setLastAsADate(null);
    setLastDate(event.target.value);
  };

  const handleLastDateExit = event => {
    if (event.key === 'Enter' || event.type === 'blur') {
      let goodDate = new Date(last_date);
      if (isNaN(goodDate.getTime())) {     // invalid date input
        if (reactData.event_date) {
          let addYears = 1;
          if (reactData.prefMethod === 'annually_on') { addYears = 10; }
          if (reactData.prefMethod === 'semiannually_on') { addYears = 3; }
          goodDate = reactData.event_date.date;
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

  const handleChangeOwnersToggle = event => {
    setSpecificOwners(event.target.value);
  };

  const handleChangePeopleToggle = event => {
    setSpecificPeople(event.target.value);
  };

  const handleChangeSignUp = event => {
    if (signup_type !== event.target.value) {
      setSignUpType(event.target.value);
      let reactUpdateObj = {
        slotObjList: []
      };
      if (event.target.value === 'time') {
        reactUpdateObj.allDay = (reactData.startObj.empty && reactData.endObj.empty);
        reactUpdateObj.timeOK = (reactData.startObj.good && reactData.endObj.good);
      }
      updateReactData(reactUpdateObj, true);
    }
  };

  const handleChangeDefaultSlotOwners = event => {
    setDefaultSlotOwners(event.target.value);
  };

  const handleChangeMaxSeats = event => {
    setSlotMaxSeats(event.target.value);
    let seatList = setSeatNames(event.target.value);
    let updatedList = seatList.map((i, x) => {
      let found;
      if (reactData.slotObjList && (reactData.slotObjList.length > 0)) {
        found = reactData.slotObjList.find(s => {
          return (s.key === i);
        });
      }
      if (found) {
        return {
          key: found.key,
          value: found.value,
          sort: i
        };
      }
      else {
        return {
          key: i,
          value: i,
          sort: i
        };
      }
    });
    updateReactData({
      slotObjList: updatedList
    }, false);
  };

  const handleChangeInterval = event => {
    setSlotInterval(event.target.value);
  };

  const handleSetSlotTimes = () => {
    let intervals = [];
    if (reactData.timeOK && !reactData.allDay && reactData.startObj.numeric24 && reactData.endObj.numeric24) {
      let useFromTime = reactData.startObj.numeric24;
      let useToTime = reactData.endObj.numeric24;
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
      let updatedList = intervals24h.map((i, x) => {
        let found;
        if (reactData.slotObjList && (reactData.slotObjList.length > 0)) {
          found = reactData.slotObjList.find(s => {
            return (s.key === i);
          });
        }
        if (found) {
          return {
            key: found.key,
            value: found.value,
            sort: i
          };
        }
        else {
          return {
            key: i,
            value: intervals[x],
            sort: i
          };
        }
      });
      updateReactData({
        slotObjList: updatedList
      }, false);
    }
  };

  React.useEffect(() => {
    async function initialize() {
      let startObj = { empty: true, good: false };
      let endObj = { empty: true, good: false };
      let allDay = false;
      if (options.setEnd) {
        endObj = makeTime(options.setEnd);
      };
      if (options.setStart) {
        startObj = makeTime(options.setStart);
        if (!startObj.error) {
          if (endObj.empty && options.setDuration) {
            const tempTime = startObj.minutesSinceMidnight + options.setDuration;
            endObj = makeTime(`${(Math.floor(tempTime / 60) * 100)}:${(tempTime % 60)}`);
          }
        }
      }
      if ((startObj.empty || (startObj.minutesSinceMidnight < 5))
        && (endObj.empty || (endObj.minutesSinceMidnight > 1435))) {
        allDay = true;
      }
      updateReactData({
        startObj,
        endObj,
        allDay,
        timeOK: true
      }, false);
      if (options.noDisplay) {
        handleUpdate();
      }
    }
    if (!reactData.initialized) {
      initialize();
      updateReactData({ initialized: true }, true);
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // **************************

  return (
    <Dialog
      open={showNewEvent}
      onClose={handleAbort}
      fullScreen={true}
    >
      {!personalEvent &&
        <React.Fragment>
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
        </React.Fragment>
      }
      {showNewEvent && !customizeButton &&
        <React.Fragment>
          <Box mt={1} py={1} px={2} borderBottom={2}>
            <Typography variant='h6'>
              {`${options.title || (isAppointment ? 'Appointment' : 'Event')} Details`}
            </Typography>
          </Box>
          <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
            <Box flexGrow={2} display='flex' paddingTop={2} flexDirection='column'>
              {isAppointment &&
                <Box
                  display='flex'
                  flexDirection='row'
                  key={`selectParent`}
                  id={`selectParent`}
                  width={`350px`}
                  flexGrow={1}
                  marginBottom={0}
                  marginTop={1}
                  justifyContent='flex-start'
                  alignItems='flex-start'
                >
                  <Box
                    key={`selectBox`}
                    display='flex' flexGrow={1} flexDirection='column'
                  >
                    <Select
                      options={(state.accessList && state.accessList[state.session.client_id])
                        ? makeChoices(state.accessList[state.session.client_id].list)
                        : [{ value: state.session.patient_id, label: state.session.patient_display_name }]
                      }
                      searchBy={'label'}
                      dropdownHandle={true}
                      clearOnSelect={true}
                      clearOnBlur={true}
                      key={`selectOptions`}
                      searchable={true}
                      create={false}
                      closeOnClickInput={true}
                      placeholder={''}
                      values={(options.setPerson)
                        ? [{ label: patient.display_name, value: (patient.person_id || patient.patient_id) }]
                        : []
                      }
                      closeOnSelect={true}
                      style={{
                        lineHeight: 1,
                        fontSize: `1rem`,
                        marginLeft: '-5px',
                        marginBottom: '-4px',
                        borderWidth: 0,
                        control: (defaultStyles, state) => ({
                          ...defaultStyles,
                          color: 'black',
                          backgroundColor: state.isSelected ? 'red' : 'orange'
                        })
                      }}
                      noDataLabel={`No names match`}
                      onChange={async (values) => {
                        if (values.length > 0) {
                          let reactUpd = [];
                          if (values.length === 1) {
                            reactUpd = {
                              preReservationList: [values[0].value],
                              chosen_names: values[0].label
                            };

                          }
                          else if (values.length > 1) {
                            let peopleNames = [];
                            let reservationList = [];
                            for (let v = 0; v < values.length; v++) {
                              peopleNames.push(values[v].label);
                              reservationList.push(values[v].value);
                            }
                            reactUpd = {
                              preReservationList: reservationList,
                              chosen_names: listFromArray(peopleNames)
                            };
                          }
                          if (!reactData.title_override) {
                            reactUpd.event_title = `${options.title ? titleCase(options.title.trim()) : 'Appointment'} for ${reactUpd.chosen_names}`;
                          }
                          if (!reactData.location_override_override) {
                            let this_person = await getPerson(values[0].value);
                            reactUpd.event_location = this_person.location || '';
                          }
                          updateReactData(reactUpd, true);
                        }
                        else {  // values.length === 0  (no one selected)
                          let reactUpd = {
                            preReservationList: [],
                            chosen_names: ''
                          };
                          if (!reactData.title_override) {
                            reactUpd.event_title = '';
                          }
                          if (!reactData.location_override_override) {
                            reactUpd.event_location = '';
                          }
                          updateReactData(reactUpd, true);
                        }
                      }}
                    />
                    <Box display='flex'
                      flexDirection='row'
                      paddingTop={'4px'}
                      borderTop={1}
                      key={`selectPromptBox`}
                    >
                      <Typography
                        key={`selectPrompt`}
                        id={`selectPrompt`}
                        style={AVATextStyle({
                          lineHeight: 1,
                          maxWidth: '90%',
                          size: 0.75,
                          opacity: '60%',
                          margin: { top: 0.25, bottom: 0.5, left: 0, right: 3 }
                        })}
                      >
                        {(state.accessList && state.accessList[state.session.client_id])
                          ? `Who is this ${titleCase(options.title)} for?`
                          : 'AVA still loading...'
                        }
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              }
              <div>
                <TextField
                  id='description'
                  value={reactData.event_title}
                  fullWidth
                  onChange={event => (handleChangeDescription(event.target.value))}
                  helperText='Event Title'
                />
              </div>
              <div>
                <TextField
                  id='location'
                  value={reactData.event_location}
                  fullWidth
                  onChange={event => (handleChangeLocation(event.target.value))}
                  helperText='Location'
                />
              </div>
              <div>
                <TextField
                  id='event_date'
                  // defaultValue={reactData.event_date ? reactData.event_date.absolute : ''}
                  value={eventDateAsDisplayString}
                  onKeyPress={handleChangeEventDate}
                  onChange={handleChangeEventDate}
                  onBlur={(event) => {
                    if (event.target.value) {
                      let dObj = makeDate(event.target.value, { noTime: true });
                      let reactUpd = { event_date: dObj };
                      setEventDateAsDisplayString(dObj.absolute);
                      if (!reactData.prefMethod) {
                        reactUpd.method = 'specific_date';
                      };
                      let checkedDays = [];
                      checkedDays[dObj.dayOfWeek] = true;
                      setCheckedDays(checkedDays);
                      updateReactData(reactUpd, true);
                    }
                  }}
                  helperText='Event Date'
                />
              </div>
              {reactData.event_date && !reactData.event_date.error &&
                <Box
                  display="flex"
                  pb={1}
                  mt={1}
                  flexDirection='column'
                  justifyContent="center"
                >
                  <FormControl className={classes.formControl} component="fieldset">
                    <RadioGroup
                      row
                      defaultValue={reactData.prefMethod}
                      aria-label="PrefMethod"
                      name="method"
                      value={reactData.prefMethod}
                      onChange={(event) => {
                        updateReactData({ prefMethod: event.target.value }, true);
                      }}
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
                            {`Every week`}
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="bi-weekly_on"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            {`Every other week`}
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="annually_on"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            {`Every year on ${reactData.event_date.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="semiannually_on"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            {`Twice a year (${reactData.event_date.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} and ${addMonths(reactData.event_date.date, 6).date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })})`}
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="monthly_by_dayOfWeek"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            {`Every month on the ${ordinal[(Math.min(Math.floor(reactData.event_date.date.getDate() / 7.1) + 1, 4)) - 1]} ${reactData.event_date.date.toLocaleDateString(undefined, { weekday: 'long' })}`}
                          </Typography>}
                      />
                      {reactData.event_date.date.getDate() < 29 &&
                        <FormControlLabel
                          className={classes.formControlLbl}
                          value="monthly_by_date"
                          control={<Radio disableRipple className={classes.radioButton} size='small' />}
                          label={
                            <Typography className={classes.radioText}>
                              {`Every month on the ${ordinal[(reactData.event_date.date.getDate()) - 1]}`}
                            </Typography>}
                        />
                      }
                    </RadioGroup>
                  </FormControl>
                </Box>
              }
              {(reactData.prefMethod && ((reactData.prefMethod === 'weekly_on') || (reactData.prefMethod === 'bi-weekly_on'))) &&
                <Box display={'flex'} flexDirection={'row'} flexWrap={'wrap'} >
                  <Typography className={classes.radioText}>
                    {`Which days?`}
                  </Typography>
                  <FormControl className={classes.formControl} component="fieldset">
                    <FormGroup row aria-label={`message_routedays_method`} name="method">
                      {[0, 1, 2, 3, 4, 5, 6].map(this_dow => (
                        <FormControlLabel
                          className={classes.formControlDays}
                          key={`dow_control_${this_dow}`}
                          control={
                            <Checkbox
                              className={classes.centerCenter}
                              key={`dow_check_${this_dow}`}
                              value={checkedDays[this_dow]}
                              checked={checkedDays[this_dow]}
                              name={`dow_check_${this_dow}`}
                              onClick={() => {
                                if (checkedDays[this_dow]) { checkedDays[this_dow] = false; }
                                else { checkedDays[this_dow] = true; }
                                setCheckedDays(checkedDays);
                              }}
                              disableRipple
                              inputProps={{ 'aria-labelledby': `message_routing_0` }}
                            />
                          }
                          label={<Typography className={classes.radioDays}>
                            {dOfw[this_dow]}
                          </Typography>}
                          labelPlacement='bottom'
                        />
                      ))}
                    </FormGroup>
                  </FormControl>
                </Box>
              }
              {(reactData.prefMethod && (reactData.prefMethod !== 'specific_date')) &&
                <div>
                  <TextField
                    id='last_date'
                    value={last_date || ''}
                    onKeyPress={handleLastDateExit}
                    onChange={handleChangeLastDate}
                    onBlur={handleLastDateExit}
                    helperText='Last Date to Schedule'
                  />
                </div>
              }
              {reactData.prefMethod && (reactData.prefMethod !== 'specific_date') && !personalEvent &&
                <Box
                  display="flex"
                  pt={2}
                  pb={1}
                  flexDirection='column'
                  justifyContent="center"
                >
                  <Typography className={classes.radioText}>When accessing a new occurrence, copy previous names?</Typography>
                  <FormControl className={classes.formControl} component="fieldset">
                    <RadioGroup
                      row
                      defaultValue={defaultSlotOwners}
                      aria-label="SignUp"
                      name="signup"
                      value={defaultSlotOwners}
                      onChange={handleChangeDefaultSlotOwners}
                    >
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="none"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Do not copy
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="first_occurrence"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Copy from first occurrence
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="prior_occurrence"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Copy from last active occurrence
                          </Typography>}
                      />
                    </RadioGroup>
                  </FormControl>
                </Box>
              }
              <Box
                display="flex"
                pt={2}
                pb={1}
                flexDirection='row'
                alignItems={'center'}
              >
                <TextField
                  className={classes.timeInput}
                  id='startTime'
                  key={`startTime_${reactData.allDay}`}
                  defaultValue={(reactData.startObj.empty || reactData.allDay) ? '' : reactData.startObj.time}
                  onChange={(event) => {
                    updateReactData({
                      startObj: Object.assign(reactData.startObj, { time: event.target.value })
                    }, true);
                  }}
                  onBlur={(event) => {
                    const startObj = makeTime(event.target.value);
                    if (startObj.empty) {
                      // empty start
                      updateReactData({
                        startObj,
                        allDay: reactData.endObj.empty,
                        timeOK: reactData.endObj.empty
                      }, true);
                    }
                    else if ((startObj.error) || (reactData.endObj.error)) {
                      // bad start or bad end
                      updateReactData({
                        startObj,
                        allDay: false,
                        timeOK: false
                      }, true);
                    }
                    else if (reactData.endObj.empty) {
                      // good start, no end
                      let tempTime;
                      if (options.setDuration && (options.setDuration < 1400)) {
                        tempTime = startObj.minutesSinceMidnight + options.setDuration;
                      }
                      else {
                        tempTime = startObj.minutesSinceMidnight + 60;
                      }
                      const endObj = makeTime(`${(Math.floor(tempTime / 60) * 100)}:${(tempTime % 60)} ${(tempTime > 719) ? 'pm' : 'am'}`);
                      updateReactData({
                        startObj,
                        endObj,
                        allDay: false,
                        timeOK: !endObj.error
                      }, true);
                    }
                    else {
                      // good start, good end
                      updateReactData({
                        startObj,
                        allDay: false,
                        timeOK: true
                      }, true);
                    }
                  }}
                  helperText='Start time'
                />
                <TextField
                  className={classes.timeInput}
                  id='endTime'
                  key={`endTime_${reactData.allDay}`}
                  defaultValue={(reactData.endObj.empty || reactData.allDay) ? '' : reactData.endObj.time}
                  onChange={(event) => {
                    updateReactData({
                      endObj: Object.assign(reactData.endObj, { time: event.target.value })
                    }, true);
                  }}
                  onBlur={(event) => {
                    const endObj = makeTime(event.target.value);
                    if (endObj.empty) {
                      // empty end
                      updateReactData({
                        endObj,
                        allDay: reactData.startObj.empty,
                        timeOK: reactData.startObj.empty
                      }, true);
                    }
                    else if ((endObj.error) || (reactData.startObj.error)) {
                      // bad start or bad end
                      updateReactData({
                        endObj,
                        allDay: false,
                        timeOK: false
                      }, true);
                    }
                    else if (reactData.startObj.empty) {
                      // good end, no start
                      let tempTime;
                      if (options.setDuration) {
                        tempTime = endObj.minutesSinceMidnight - options.setDuration;
                      }
                      else {
                        tempTime = endObj.minutesSinceMidnight - 60;
                      }
                      const startObj = makeTime(`${(Math.floor(tempTime / 60) * 100)}:${(tempTime % 60)}`);
                      updateReactData({
                        startObj,
                        endObj,
                        allDay: false,
                        timeOK: !startObj.error
                      }, true);
                    }
                    else {
                      // good start, good end
                      updateReactData({
                        endObj,
                        allDay: false,
                        timeOK: true
                      }, true);
                    }
                  }}

                  helperText='End time'
                />
                <Radio
                  key={`radio-allday`}
                  id={`radio-allday`}
                  style={{ alignSelf: 'center' }}
                  checked={reactData.allDay}
                  value={reactData.allDay}
                  onClick={async () => {
                    if (reactData.allDay) {
                      updateReactData({
                        allDay: false,
                        timeOK: (reactData.startObj.good && reactData.endObj.good),
                      }, true);
                    }
                    else {
                      updateReactData({
                        allDay: true,
                        timeOK: true,
                      }, true);
                    }
                  }}
                  disableRipple
                  className={classes.radioButton}
                  size='small'
                />
                <Typography className={classes.radioText}>
                  All Day?
                </Typography>
              </Box>
              {!personalEvent && !isAppointment && !options.simpleForm &&
                <React.Fragment>
                  <Box
                    display="flex"
                    pt={2}
                    flexDirection='column'
                    justifyContent="center"
                  >
                    <Typography className={classes.radioText}>Restrict sign-up window?</Typography>
                    <Box
                      display="flex"
                      pb={1}
                      ml={2}
                      flexDirection='row'
                      justifyContent="flex-start"
                    >
                      <TextField
                        id='signup_start'
                        value={signup_start}
                        style={{width: '200px', marginRight: '16px'}}
                        onChange={(event) => {
                          setSignup_start(event.target.value);
                        }}
                        helperText='# days before the event to open sign-up'
                      />
                      <TextField
                        id='signup_end'
                        value={signup_end}
                        style={{ width: '200px' }}
                        onChange={(event) => {
                          setSignup_end(event.target.value);
                        }}
                        helperText='# days before the event to close sign-up'
                      />
                    </Box>
                  </Box>
                  <Box
                    display="flex"
                    pt={2}
                    pb={1}
                    flexDirection='column'
                    justifyContent="center"
                  >
                    <Typography className={classes.radioText}>Limit participations?</Typography>
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
                </React.Fragment>
              }
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
                    onBlur={handleSetSlotTimes}
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
              {reactData.slotObjList && (reactData.slotObjList.length > 0) &&
                <Box
                  display="flex"
                  pt={2}
                  pb={1}
                  flexDirection='column'
                  justifyContent="center"
                >
                  <Typography className={classes.radioText}>Tap to Customize this event</Typography>
                  <Box
                    display="flex"
                    pt={0}
                    mt={0}
                    width={'100px'}
                    flexDirection='column'
                    justifyContent="center"
                  >
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'green', color: 'white' }}
                      size='small'
                      onClick={async () => {
                        setcustomizeButton(true);
                      }}
                    >
                      Customize
                    </Button>
                  </Box>
                </Box>
              }
              {!personalEvent && !isAppointment && !options.simpleForm &&
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
              }
              {(specificPeople === 'yes') &&
                <ClientsSection
                  person={patient}
                  groupData={state.groups}
                  multiple={true}
                  updateGroups={(selections) => {
                    if (selections.length === 0) {
                      selections = ['*all'];
                    }
                    updateReactData({
                      restrictToGroups: selections
                    }, false);
                  }}
                />
              }
              {!personalEvent && !isAppointment &&
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
              }
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
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'green', color: 'white' }}
                    size='small'
                    onClick={async () => {
                      let ownerTargetObj = await prepareTargets(session.user_id, session.client_id, { includeGroups: false, includePeople: true });
                      setOwnerTargetInfo(ownerTargetObj.responsibleObj);
                      setShowOwnerSelect(true);
                    }}
                  >
                    {`Tap to select`}
                  </Button>
                </div>
              }
            </Box>
          </DialogContent>
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
            <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
              <DialogActions className={classes.buttonArea} >
                <Button
                  className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'red', color: 'white' }}
                  size='small'
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
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'green', color: 'white' }}
                    size='small'
                  >
                    {'Save'}
                  </Button>
                }
              </DialogActions>
            </Box>
          </Box>
          {showOwnerSelect &&
            <PersonFilter
              prompt={`Who else should be listed as an owner for ${reactData.event_title}?`}
              peopleList={state.accessList[state.session.client_id].list}
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
        </React.Fragment>
      }
      {showNewEvent && customizeButton &&
        <EditList
          listToUpdate={reactData.slotObjList}
          options={{
            allowAdd: true
          }}
          onClose={(response) => {
            setcustomizeButton(false);
            updateReactData({
              slotObjList: response
            }, true);
          }}
        />
      }
    </Dialog>
  );
};
