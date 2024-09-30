import React from 'react';

import { useSnackbar } from 'notistack';

import { getCalendarEntries, getAllOccurrences } from '../../util/AVACalendars';
import { makeTime, addDays, makeDate } from '../../util/AVADateTime';
import { isEmpty, isObject, deepCopy, makeArray } from '../../util/AVAUtilities';
import { AVAclasses, AVADefaults, AVATextStyle } from '../../util/AVAStyles';
import { getGroupsBelongTo, getMemberList, getGroupMembers } from '../../util/AVAGroups';

// import useMediaQuery from '@material-ui/core/useMediaQuery';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CalendarForm from '../forms/CalendarForm';
import PersonFilter from '../forms/PersonFilter';
import CalendarEventEditForm from '../forms/CalendarEventEditForm';

import Typography from '@material-ui/core/Typography';
import CircularProgress from '@material-ui/core/CircularProgress';
import LinearProgress from '@material-ui/core/LinearProgress';

import useSession from '../../hooks/useSession';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: 0,
    paddingTop: 0,
  },
  progressBar: {
    marginBottom: theme.spacing(3),
    backgroundColor: '#a3a0a0',
    color: '#000000',
    transition: 'none',
    height: '5px'
  },
  formControlLbl: {
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  freeInput: {
    marginLeft: '25px',
    marginTop: '5px',
    marginRight: 2,
    marginBottom: '10px',
    paddingLeft: 0,
    paddingRight: 0,
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    minHeight: theme.typography.fontSize * 2.8,
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  titleText: {
    fontSize: '1.3rem',
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
  },
  subDescriptionText: {
    marginLeft: theme.spacing(3),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },

  picture: {
    width: theme.spacing(16),
    height: theme.spacing(16),
    [theme.breakpoints.down('xs')]: {
      width: theme.spacing(8),
      height: theme.spacing(8),
    },
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  listItemAVA: {
    fontSize: theme.typography.fontSize * 1.5,
  },
  client_background: {
    backgroundColor: isObject(AVADefaults({ client_style: 'get' })) ? AVADefaults({ client_style: 'get' }).calendar_background : null
  },
  idText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  }
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ patient, OGpatient, peopleList, defaultObject = {}, eventClient, calendarMode, onClose }) => {

  /*
 DEFAULT VALUES
   USED IN ShowCalendar
    show_group - only include events authorized for these groups
    eventList - an already contructed calendar, usually passed in from the background load done at AVA restart
    start_date - when building a calendar, start from this date
    end_date - when building a calendar, build through this date
    assignmentView - show list of people you can assign to events
    allowAssign - required when assignmentView is true; this becomes assignment__list
   
   CREATED BY ShowCalendar and sent to CalendarForm
    assignment__list - this is a list of people and groups that you may choose from to assign to events
   
   PASSED THROUGH to CalendarForm without consideration
    slotsView - show all people that are signed up
    subtitle - if present, text to show under the person name
    agendaView - show in straigh-line "agenda" format
    onlyRegistered - only show events that I am signed-up for
    message_override - [list of IDs] or [*none*] (default if missing: added slots = message to the event owner)
    colorScheme - see CalendarForm for details of this object
 */

  const [showPersonSelect, setShowPersonSelect] = React.useState(false);
  const [showAll, setShowAll] = React.useState(true);

  const { enqueueSnackbar } = useSnackbar();
  const { state } = useSession();

  // some other function (assigments, new calendar entry, etc) may have changed the calendar
  //   in this case, that function will have put "true" in local storage key calendarChanged
  //   and require a rebuild of the calendar - this code checks for that, only using a passed in calendar
  //   if the calendarChanged rebuild is not triggered...
  let load_myCal = [];
  if (defaultObject.hasOwnProperty('eventList')) {
    if (!defaultObject.eventList.loadError) {
      let needRefresh = localStorage.getItem(`calendarChanged`);
      if (!(needRefresh === 'true')) {
        load_myCal = defaultObject.eventList;
      }
    }
  }

  const [reactData, setReactData] = React.useState({
    start_date: 0,
    end_date: 0,
    defaultValues: defaultObject,
    selectedEvent: defaultObject.selectedEvent || '',
    myCalendar: load_myCal,
    loading: true
  });

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  const [statusMessage, setStatusMessage] = React.useState('Initializing');
  const [progress, setProgress] = React.useState(1);
  const [pWidth, setPWidth] = React.useState(60);

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const [changes, setChanges] = React.useState(false);
  if (changes) { }

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const onStatusUpdate = (statusMessage, progressWidth, progressPct) => {
    setStatusMessage(statusMessage);
    setProgress(progressPct);
    setPWidth(progressWidth);
    console.log(statusMessage, progressWidth, progressPct);
    setForceRedisplay(!forceRedisplay);
  };

  const setCalendar = async () => {
    // let rightNow = new Date();
    // let this_date = rightNow.getDate();
    let theCalendar = [];
    let oRecs;
    let checkClient = eventClient || (patient.adopted_client || patient.client_id);
    if (reactData.selectedEvent) {
      setShowAll(false);
      oRecs = await getCalendarEntries({
        client_id: checkClient,
        person_id: patient.patient_id,
        event_id: reactData.selectedEvent,
        type: ['occurrence'],
        allow_create: true
      });
    }
    else {
      setShowAll(true);
      oRecs = await getCalendarEntries({
        client_id: checkClient,
        startDate: reactData.start_date,
        endDate: reactData.end_date,
        type: ['occurrence']
      }, onStatusUpdate);
    }
    for (let o = 0; o < oRecs.length; o++) {
      onStatusUpdate('Checking sign-ups', oRecs.length, ((o / oRecs.length) * 100));
      let occRec = oRecs[o];
      let [eventRec] = await getCalendarEntries({
        client_id: checkClient,
        event_id: occRec.event_key,
        type: ['event']
      });
      let description, location, owner, signup_type, time$;
      let time24 = 0;
      if (eventRec.eventData) {
        description = eventRec.eventData.event_data.description;
        owner = eventRec.eventData.event_data.owner;
        signup_type = eventRec.eventData.event_data.type;
        if (eventRec.eventData.event_data.time) {
          time24 = makeTime(eventRec.eventData.event_data.time.from).numeric24;
          if (eventRec.eventData.event_data.time.to) {
            time$ = 'From ' + eventRec.eventData.event_data.time.from + ' to ' + eventRec.eventData.event_data.time.to;
          }
          else { time$ = eventRec.eventData.event_data.time.from; }
        }
        if (eventRec.eventData.event_data.location) {
          location = ((typeof eventRec.eventData.event_data.location === 'object')
            ? eventRec.eventData.event_data.location.description
            : eventRec.eventData.event_data.location);
        }
        else { location = ''; }
      }
      else if (eventRec.calData) {
        description = eventRec.calData.description;
        location = eventRec.calData.location;
        owner = eventRec.calData.owner;
        signup_type = eventRec.calData.signup_type;
      }
      if (occRec.occData && occRec.occData.event_data && occRec.occData.event_data.description) {
        description = occRec.occData.event_data.description;
      }
      let oDate;
      if (occRec.occData && occRec.occData.date) { oDate = occRec.occData.date; }
      else { oDate = occRec.occurrence_date; }
      let [slotRec] = await getCalendarEntries({
        client_id: checkClient,
        event_id: occRec.event_key,
        person_id: patient.patient_id || patient.person_id,
        type: ['slot']
      });
      let tCal = {
        client: occRec.client,
        event_key: occRec.event_key,
        id: occRec.event_id || occRec.id,
        // list_key: 'occurrence_master',
        schedule_key: `${oDate}`,
        occData: {
          date: Number(oDate),
          signup_type,
          description,
          location,
          time$,
          time24,
          owner
        }
      };
      if (slotRec) {
        tCal.slots = [{
          owner: patient.patient_id,
          id: slotRec.slotData.slot || slotRec.slotData.id,
          reminder_minutes: 0,
          name: slotRec.slotData.name
        }];
      }
      theCalendar.push(tCal);
    }
    // final sort
    theCalendar.sort((a, b) => {
      if (a.occData.date > b.occData.date) { return 1; }
      else if (a.occData.date < b.occData.date) { return -1; }
      else if (a.occData.time24 > b.occData.time24) { return 1; }
      else { return -1; }
    });
    return theCalendar;
  };

  const choosePerson = () => {
    setShowPersonSelect(true);
  };

  const handleAbort = () => {
    if (OGpatient.patient_id !== patient.patient_id) {
      patient.patient_display_name = OGpatient.patient_display_name;
      patient.patient_id = OGpatient.patient_id;
      patient.kiosk_mode = true;
    }
    setChanges(false);
    onClose();
  };

  const organizeCalendar = (this_calendar) => {
    let calendarList = [];
    Object.keys(this_calendar).forEach((this_date) => {
      if (!(this_date === 'peopleList')) {
        if (!this_calendar[this_date].events || (Object.keys(this_calendar[this_date].events).length === 0)) {
          calendarList.push({
            dateObj: makeDate(this_date),
            date_words: this_calendar[this_date].date_words,
            eventList: []
          });
        }
        else {
          let sorted_eventIDs = Object.keys(this_calendar[this_date].events).sort((s1, s2) => {
            if (this_calendar[this_date].events[s1].sort24 > this_calendar[this_date].events[s2].sort24) {
              return 1;
            }
            else if (this_calendar[this_date].events[s1].sort24 < this_calendar[this_date].events[s2].sort24) {
              return -1;
            }
            else {
              return (this_calendar[this_date].events[s1].description > this_calendar[this_date].events[s2].description ? 1 : -1);
            }
          });
          calendarList.push({
            dateObj: makeDate(this_date),
            date_words: this_calendar[this_date].date_words,
            eventList: sorted_eventIDs.map(this_eventID => {
              return Object.assign({},
                { event_id: this_eventID },
                this_calendar[this_date].events[this_eventID]
              );
            })
          });
        }
      }
    });
    return calendarList;
  };

  React.useEffect(() => {
    async function initialize() {
      // single event you're looking for?  
      if (reactData.selectedEvent) {
        let calendarEntry = await setCalendar();
        if (!calendarEntry || (calendarEntry.length === 0)) {
          enqueueSnackbar(`AVA couldn't load that event`, { variant: 'error' });
        }
        else {
          updateReactData({
            myCalendar: calendarEntry
          }, true);
        }
        return;
      }
      if (reactData.myCalendar && !reactData.myCalendar.loadError && reactData.birthdayList) {
        return;
      }
      let oList = {};
      if (isEmpty(reactData.myCalendar) || reactData.myCalendar.loadError || reactData.defaultValues.forceReload) {
        let startDate, endDate;
        if (reactData.defaultValues.start_date) {
          startDate = makeDate(reactData.defaultValues.start_date).date;
        }
        else {
          startDate = new Date();
        }
        if (reactData.defaultValues.end_date) {
          endDate = makeDate(reactData.defaultValues.end_date).date;
        }
        else {
          endDate = addDays(startDate, 35);
        }
        let filterGroup = [];
        if (reactData.defaultValues.hasOwnProperty('show_group')) {
          filterGroup = makeArray(reactData.defaultValues.show_group);
        }
        else {
          filterGroup = await getGroupsBelongTo(patient.client_id, patient.patient_id, { sort: true });
        }
        oList = await getAllOccurrences(
          {
            client_id: patient.client_id,
            this_person: patient.patient_id,
            start_date: startDate,
            end_date: endDate,
            filter: { group: filterGroup }
          }, onStatusUpdate
        );
      }
      else {
        oList = deepCopy(reactData.myCalendar);
      }
      if (!reactData.birthdayList) {
        if (state.accessList && state.accessList.birthdayList) {
          for (let keyDate in state.accessList.birthdayList) {
            if (oList.hasOwnProperty(keyDate)) {
              state.accessList.birthdayList[keyDate].forEach(p => {
                oList[keyDate].events[`#birthday_${p.person_id}#`] = {
                  description: `Happy Birthday ${p.display_name}`,
                  sort24: `0000z-${p.display_name}`,
                  slot_owners: {},
                  type: 'birthday'
                };
              });
            }
          }
        }
        else {
          let allPeople = await getMemberList('*all', patient.client_id, {});
          let this_year = new Date().getFullYear();
          let next_year = this_year + 1;
          allPeople.peopleList.forEach(p => {
            if (p.local_data?.['date of birth']) {
              let keyDate;
              let bDay = `${this_year}${p.local_data['date of birth'].slice(4)}`;
              if (oList.hasOwnProperty(bDay)) {
                keyDate = bDay;
              }
              else {
                bDay = `${next_year}${p.local_data['date of birth'].slice(4)}`;
                if (oList.hasOwnProperty(bDay)) {
                  keyDate = bDay;
                }
              }
              if (keyDate) {
                oList[keyDate].events[`#birthday_${p.person_id}#`] = {
                  description: `Happy Birthday ${p.name.first} ${p.name.last}`,
                  sort24: `0000z-${p.name.first} ${p.name.last}`,
                  slot_owners: {},
                  type: 'birthday'
                };
              }
            }
          });
        }
      }
      let reactUpdObj = {
        myCalendar: organizeCalendar(oList),
        calendarPeople: oList.peopleInfo,
        conflictInfo: oList.conflicts,
        birthdayList: true,
        loading: false
      };
      if (reactData.defaultValues.assignmentView && reactData.defaultValues.allowAssign) {
        let assignmentList = await getGroupMembers({
          groupList: [...makeArray(reactData.defaultValues.allowAssign), state.session.patient_id],
          short: true
        });
        if (assignmentList && (assignmentList.length > 0)) {
          reactData.defaultValues.assignment__List = assignmentList.sort((a, b) => {
            if (a.last_name < b.last_name) { return -1; }
            else if (a.last_name > b.last_name) { return 1; }
            else if (a.first_name < b.first_name) { return -1; }
            else { return 1; }
          });
          reactUpdObj.defaultValues = reactData.defaultValues;
        }
      }
      localStorage.setItem(`calendarChanged`, false);
      let client_style = AVADefaults({ client_style: 'get' });
      if (isObject(client_style)) {
        reactUpdObj.calendar_background = client_style.calendar_background;
        reactUpdObj.calendar_day = client_style.calendar_day;
      }
      updateReactData(reactUpdObj, true);
    }
    initialize();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps


  // **************************
  return (
    <React.Fragment>
      {showAll && reactData && (forceRedisplay || true) &&
        <Dialog
          open={!!calendarMode}
          onClose={handleAbort}
          TransitionComponent={Transition}
          classes={{ paper: classes.client_background }}
          fullScreen
        >
          {patient.kiosk_mode &&
            <Box
              display='flex'
              mb={0}
              flexDirection='row'
              justifyContent='flex-start'
              alignItems='center'
            >
              <Box mr={3} justifySelf={'flex-end'} alignSelf={'center'}>
                <Button
                  className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'blue', color: 'white' }}
                  size='small'
                  onClick={choosePerson}>
                  {'Resident?'}
                </Button>
              </Box>
            </Box>
          }
          {/* Loading spinner */}
          {reactData.loading &&
            <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
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
                  src={patient.client_logo || process.env.REACT_APP_AVA_LOGO}
                />
                <React.Fragment>
                  <Box
                    display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                    flexWrap='wrap' textOverflow='ellipsis' width='100%'
                    key={'loadingBox'}
                    mb={2}
                  >
                    <Typography style={AVATextStyle({ size: 1.5, align: 'center' })} className={classes.lastName} >{`Building your Calendar`}</Typography>
                    <Typography style={AVATextStyle({ size: 0.8, align: 'center' })} >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                    <Box
                      display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                      flexWrap='wrap' textOverflow='ellipsis' width='100%'
                      key={'loadingWordBox'}
                    >
                      <Typography style={AVATextStyle({ size: 0.8, align: 'center' })}>{statusMessage}</Typography>
                    </Box>
                  </Box>
                  <LinearProgress variant="determinate" className={classes.progressBar} style={{ width: pWidth }} value={progress} />
                  <CircularProgress />
                </React.Fragment>
              </Box>
            </DialogContent>
          }
          {!reactData.loading &&
            <CalendarForm
              myCalendar={reactData.myCalendar}
              calendarPeople={reactData.calendarPeople}
              conflictInfo={reactData.conflictInfo}
              person_id={patient.patient_id}
              peopleList={peopleList}
              onClose={() => {
                setShowAll(!reactData.selectedEvent);
                onClose();
              }}
              defaultValues={reactData.defaultValues}
            />
          }
          <DialogActions style={{ justifyContent: 'center' }}>
            {reactData.myCalendar && reactData.myCalendar.length > 0 &&
              <Button
                onClick={() => { }}
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'blue', color: 'white' }}
                size='small'
              >
                {'More Dates'}
              </Button>
            }
            {patient.kiosk_mode &&
              <Button
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'green', color: 'white' }}
                size='small'
                onClick={choosePerson}>
                {'Sign-up?'}
              </Button>
            }
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={handleAbort}>
              {'Exit'}
            </Button>
          </DialogActions>
          {showPersonSelect &&
            <PersonFilter
              prompt={'Whose Calendar do you wish to view?'}
              peopleList={peopleList}
              onCancel={async () => {
                setShowPersonSelect(false);
                patient.kiosk_mode = false;
                await setCalendar();
              }}
              onSelect={async (selectedPerson) => {
                [patient.patient_display_name, patient.patient_id,] = selectedPerson.split(':');
                setShowPersonSelect(false);
                patient.kiosk_mode = false;
                await setCalendar();
              }}
            >
            </PersonFilter>
          }
        </Dialog>
      }
      {!showAll && (reactData.myCalendar.length > 0) &&
        <CalendarEventEditForm
          pEventCode={reactData.selectedEvent}
          peopleList={peopleList}
          pPatient={patient.patient_id}
          pClient={eventClient || (patient.adopted_client || patient.client_id)}
          pOccData={reactData.myCalendar[0].occData}
          pPatientRec={patient}
          defaultValues={reactData.defaultValues}
          onReset={() => { handleAbort(); }}
          pMode={calendarMode}
        />
      }
      {!showAll && (reactData.myCalendar.length === 0) &&
        <DialogContentText className={classes.subDescriptionText}>
          Getting your Event Info
        </DialogContentText>
      }
    </React.Fragment>
  );
};
