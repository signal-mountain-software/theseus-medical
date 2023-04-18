import React from 'react';

import { API, graphqlOperation } from 'aws-amplify';
import { getCalendarEntries } from '../../util/AVACalendars';
import { makeTime } from '../../util/AVADateTime';
import { getCalendar } from '../../graphql/queries';
import useMediaQuery from '@material-ui/core/useMediaQuery';

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
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
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
  photoButton: {
    alignSelf: 'center',
    size: 'sm',
    variant: 'outlined',
    verticalAlign: 'middle',
  },
  defaultButton: {
    alignSelf: 'end',
    variant: 'outlined',
    verticalAlign: 'end',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  topButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.primary[theme.palette.type],
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
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  listItemAVA: {
    fontSize: theme.typography.fontSize * 1.5,
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

export default ({ patient, OGpatient, peopleList, currentEvent, eventClient, calendarMode, onClose }) => {
  const [myCalendar, setMyCalendar] = React.useState([]);
  const [showPersonSelect, setShowPersonSelect] = React.useState(false);
  const [showAll, setShowAll] = React.useState(true);
  const [loading, setLoading] = React.useState(false);

  const [lastEndDate, setLastEndDate] = React.useState();

  const [statusMessage, setStatusMessage] = React.useState('Initializing');
  const [progress, setProgress] = React.useState(100);
  const [pWidth, setPWidth] = React.useState(60);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const classes = useStyles();

  const [changes, setChanges] = React.useState(false);
  if (changes) { }

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
  if (isMobile) { }

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const onStatusUpdate = (statusMessage, progressWidth, progressPct) => {
    setStatusMessage(statusMessage);
    setProgress(progressPct);
    setPWidth(progressWidth);
    setForceRedisplay(!forceRedisplay);
  };

  const setCalendar = async () => {
    let rightNow = new Date();
    let this_date = rightNow.getDate();
    let twoWeeksFromNow = new Date(rightNow.setDate(this_date + 14));
    let theCalendar = [];
    let oRecs;
    let checkClient = eventClient || (patient.adopted_client || patient.client_id);
    if (currentEvent && currentEvent.length > 0) {
      setShowAll(false);
      oRecs = await getCalendarEntries({
        client_id: checkClient,
        person_id: patient.patient_id,
        event_id: currentEvent,
        type: ['occurrence'],
        allow_create: true
      });
    }
    else {
      setShowAll(true);
      oRecs = await getCalendarEntries({
        client_id: checkClient,
        start_date: 'today',
        end_date: 'today + 7',
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
          time$ = eventRec.eventData.event_data.time.from;
          if (eventRec.eventData.event_data.time.to) {
            time$ += ' to ' + eventRec.eventData.event_data.time.to;
          }
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
        person_id: patient.patient_id,
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
    })
    setMyCalendar(theCalendar);
    setLastEndDate(twoWeeksFromNow);
    return theCalendar;
  };

  const extendDates = async () => {
    let invokeFailed = false;
    lastEndDate.setDate(lastEndDate.getDate() + 1);
    let event_time = lastEndDate.getTime();
    let this_year = lastEndDate.getFullYear();
    let this_month = lastEndDate.getMonth() + 1;
    let this_date = lastEndDate.getDate();
    let twoWeeksFromNow = new Date(lastEndDate);
    twoWeeksFromNow.setDate(this_date + 14);
    let fortnight_year = twoWeeksFromNow.getFullYear();
    let fortnight_month = twoWeeksFromNow.getMonth() + 1;
    let fortnight_date = twoWeeksFromNow.getDate();
    let result = {};

    result = await API
      .graphql(
        graphqlOperation(getCalendar, {
          input: {
            "action": `list_events#${event_time}`,
            "clientId": eventClient || (patient.adopted_client || patient.client_id),
            "list_start": ((this_year * 10000) + (this_month * 100) + this_date).toString(),
            "list_end": ((fortnight_year * 10000) + (fortnight_month * 100) + fortnight_date).toString(),
            "person_id": patient.patient_id
          }
        })
      )
      .catch(error => {
        console.log(error);
        invokeFailed = true;
      });

    let theCalendar = myCalendar;
    if (!invokeFailed && result.data.getCalendar.body) {
      result.data.getCalendar.body.forEach(cEv => {
        theCalendar.push(cEv);
      });
    };
    setMyCalendar(theCalendar);
    setLastEndDate(twoWeeksFromNow);
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

  // **************************
  React.useEffect(() => {
    async function buildIt() {
      setLoading(true);
      await setCalendar();
      setLoading(false);
    }
    if (!loading) {
      buildIt();
    }
  }, [currentEvent]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    <React.Fragment>
      {showAll && (forceRedisplay || true) &&
        <Dialog
          open={!!calendarMode}
          onClose={handleAbort}
          TransitionComponent={Transition}
          fullScreen
        >
          <Box
            display='flex'
            mb={0}
            flexDirection='row'
            justifyContent='flex-start'
            alignItems='center'
          >
            {patient.kiosk_mode &&
              <Box mr={3} justifySelf={'flex-end'} alignSelf={'center'}>
                <Button className={classes.defaultButton} size='small' variant='contained' onClick={choosePerson}>
                  {'Resident?'}
                </Button>
              </Box>
            }
          </Box>
          {/* Loading spinner */}
          {loading &&
            <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
              <Box
                display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                key={'loadingBox'}
                ml={2} mr={2} mb={2} mt={8}
              >
                <Box
                  component="img"
                  mb={2}
                  minWidth={isMobile ? 150 : 175}
                  maxWidth={isMobile ? 150 : 175}
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
                    <Typography variant='h5' className={classes.lastName} >{`Building your Calendar`}</Typography>
                    <Typography variant='caption' >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                    <Box
                      display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                      flexWrap='wrap' textOverflow='ellipsis' width='100%'
                      key={'loadingWordBox'}
                    >
                      <Typography>{statusMessage}</Typography>
                    </Box>
                  </Box>
                  <LinearProgress variant="determinate" className={classes.progressBar} style={{ width: pWidth }} value={progress} />
                  <CircularProgress />
                </React.Fragment>
              </Box>
            </DialogContent>
          }
          {!loading &&
            <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
              <CalendarForm
                myCalendar={myCalendar}
                person_id={patient.patient_id}
                kiosk_mode={patient.kiosk_mode}
                display_name={patient.patient_display_name}
                peopleList={peopleList}
                session={patient}
                onClose={onClose}
              />
            </DialogContent>
          }
          <DialogActions style={{ justifyContent: 'center' }}>
            {myCalendar && myCalendar.length > 0 &&
              <Button
                onClick={extendDates}
                variant='contained'
                size='small'
                className={classes.topButton}
              >
                {isMobile ? 'More' : 'Show more?'}
              </Button>
            }
            {patient.kiosk_mode &&
              <Button
                className={classes.defaultButton}
                size='small'
                variant='contained'
                onClick={choosePerson}>
                {'Sign-up?'}
              </Button>
            }
            <Button className={classes.reject} size='small' variant='contained' onClick={handleAbort}>
              {'Done'}
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
      {!showAll && (myCalendar.length > 0) &&
        <CalendarEventEditForm
          pEventCode={currentEvent}
          peopleList={peopleList}
          pPatient={patient.patient_id}
          pClient={eventClient || (patient.adopted_client || patient.client_id)}
          pOccData={myCalendar[0].occData}
          pPatientRec={patient}
          onReset={() => { handleAbort(); }}
          pMode={calendarMode}
        />
      }
      {!showAll && (myCalendar.length === 0) &&
        <DialogContentText className={classes.subDescriptionText}>
          Getting your Event Info
        </DialogContentText>
      }
    </React.Fragment>
  );
};
