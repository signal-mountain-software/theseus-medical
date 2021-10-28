import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { useSnackbar } from 'notistack';
import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';

import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { fade } from '@material-ui/core/styles/colorManipulator';
import makeStyles from '@material-ui/core/styles/makeStyles';
import BusinessCenterOutlinedIcon from '@material-ui/icons/BusinessCenterOutlined';
import IconButton from '@material-ui/core/IconButton';

import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';

import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import { createPutFact } from '../../graphql/mutations';
import { updateReservation } from '../../graphql/mutations';
import { getActivityData } from '../../graphql/queries';
import { getReservation } from '../../graphql/queries';
import NewFactDialog from '../dialogs/NewFactDialog';

import * as serviceWorker from '../../serviceWorker';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    [theme.breakpoints.down('xs')]: {
      width: '100%',
      minWidth: 64,
    },
  },
  title: {
    margin: theme.spacing(1),
  },
  appBar: {
    position: 'relative',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    zIndex: 1,
  },
  gridList: {
    // maxHeight: 400,
  },
  defaultButton: {
    borderRadius: 50,
    marginLeft: 0,
    paddingLeft: 13,
    paddingRight: 10,
    backgroundColor: fade(theme.palette.info[theme.palette.type], 0.05),
    variant: 'outlined',
    fontSize: theme.typography.fontSize * 0.6,
    color: theme.palette.info[theme.palette.type],
    height: theme.typography.fontSize * 1.8,
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  inputRoot: {
    color: 'inherit',
  },
  inputInput: {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: 3,
    transition: theme.transitions.create('width'),
    [theme.breakpoints.up('md')]: {
      width: '20ch',
    },
  },
  descriptionText: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
}));

const DEFAULT_TYPE = 'My_activities';
var DEFAULT_LIMIT = 100;


export default ({ patient, session, newFact, setNewFact }) => {
  DEFAULT_LIMIT++;

  const [activities, setActivities] = React.useState([]); // populates the activity buttons
  const [events, setEvents] = React.useState([]); // populates the events dropdown list
  const [types, setTypes] = React.useState([]); // populates the types dropdown list

  const [event, setEvent] = React.useState(''); // stores the current selected event filter
  const [type, setType] = React.useState(DEFAULT_TYPE); // stores the current selected type filter
  const [limit, setLimit] = React.useState(DEFAULT_LIMIT); // stores the current limit of activity buttons displayed

  //const [lastEvent, setLastEvent] = React.useState(''); // stores the current selected event filter
  //const [lastType, setLastType] = React.useState(''); // stores the current selected type filter
  //const [lastPerson, setLastPerson] = React.useState(''); // stores the current selected type filter
  //const [lastLimit, setLastLimit] = React.useState(0); // stores the current limit of activity buttons displayed

  const [loading, setLoading] = React.useState(true); // a flag that shows/hides loading spinner
  const [open, setOpen] = React.useState(false); // a flag that shows/hides the NewFactDialog
  // const [actionCancelled, setActionCancelled] = React.useState(false);
  const [selected, setSelected] = React.useState(null); // stores the current selected fact being added
  const [homeState, setHomeState] = React.useState('home');
  var actionCancelled;

  const [activePatient, setActivePatient] = React.useState(null);

  const [rowOpen, setRowOpen] = React.useState([]);

  const [showSummary, setSummary] = React.useState(false);
  const [showConfirmation, setConfirmation] = React.useState(false);
  // eslint-disable-next-line
  const [showFreeText, setFreeText] = React.useState({});

  const [lastWrittenFact, setLastWrittenFact] = React.useState({});

  var timeNow = new Date().getTime();

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
  const { enqueueSnackbar } = useSnackbar();
  const classes = useStyles();

  var priorReason = '';
  var selectedActivityName = '';
  var addedAFavorite = false;
  var toggledRow = false;

  const AWS = require('aws-sdk');
  AWS.config.update({region:'us-east-1'});
  
  const s3 = new AWS.S3({
    accessKeyId: 'AKIAR2O24AQ2HD72XKW4',
    secretAccessKey: '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',
 //   Bucket: 'smsoftware-reports'
  });
/*
  const s3Theseus = new AWS.S3({
    accessKeyId: 'AKIAR2O24AQ2HD72XKW4',
    secretAccessKey: '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',
    Bucket: 'theseus-medical-storage'
  });
  */

  var elastictranscoder = new AWS.ElasticTranscoder(
    {
      accessKeyId: 'AKIAR2O24AQ2HD72XKW4',
      secretAccessKey: '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',
    }
  );

  const doneWithEvent = () => {
    if ( activities.some(aObj => { return aObj.observation_expires > timeNow }) ) {   
      setSummary(true);   // if ANY activity has an expiration date that is in the future (it isn't expired yet), show the summary
    }
    else {
      setSummary(false);
      setConfirmation(false);
      if (homeState === 'home') {
        serviceWorker.unregister()
        window.location.reload();
      }
      returnToHome();
    } 
  };

  const handleSummarySubmit = () => {
    setSummary(false);
    setConfirmation(false);
    newFact = {
      patient_id: session.patient_id || session.user_id,
      activity_key: 'confirmation.' + (event ? event : selected.code),
      value: 'action.confirmed',
      qualifier: [],
      session: {
        user_id: session.user_id,
        session_id: `${process.env.REACT_APP_AVA_VERSION}~${session.user_id}`,
      },
    };
    if (event) {
      selectedActivityName = activities[0].reason.substr(0, activities[0].reason.length - 6);
    } else {
      selectedActivityName = selected.name;
    }
    setNewFact(newFact);
    onSaveFact(newFact);
    returnToHome();
  };

  const handleConfirmSubmit = () => {
    setSummary(false);
    setConfirmation(false);
    newFact.status = 'confirmed';
    selectedActivityName = selected.name;
    setNewFact(newFact);
    onSaveFact(newFact);
    //    returnToHome();
  };

  const handleSummaryBack = () => {
    setSummary(false);
    setConfirmation(false);
  };

  const handleConfirmBack = () => {
    setSummary(false);
    setConfirmation(false);
    if (newFact.value.hasOwnProperty('selected')) {
      let valueSelectedObject = newFact.value.selected;
      let qualObject = newFact.value.qualifiers;
      let freeTextObject = newFact.value.freeText;
      let separator = '';
      let qualSeparator = '';
      let fOL = valueSelectedObject.length;
      let constructedValue = '';
      // eslint-disable-next-line
      let constructedQualifier = '';
      let mVal;
      for (let f = 0; f < fOL; f++) {
        mVal = valueSelectedObject[f];
        constructedValue += separator + mVal;
        separator = ' ~ ';
        if (qualObject && qualObject[mVal] && qualObject[mVal] !== '') {
          constructedQualifier += qualSeparator + mVal + ': ' + qualObject[mVal].join(' ~ ');
          qualSeparator = ' / ';
        }
      }
      for (const [key, value] of Object.entries(freeTextObject)) {
        constructedValue += separator + key + ' = ' + value;
        separator = ' ~ ';
      }
      selected.most_recent_observation = constructedValue;
      selected.default_value = 'defaults.' + constructedValue;
    }
    setSelected(selected);
    setOpen(true);
  };

  const handleSummaryExit = () => {
    setSummary(false);
    setConfirmation(false);
    returnToHome();
  };

  const returnToHome = () => {
    setType(DEFAULT_TYPE);
    // setLimit(DEFAULT_LIMIT);
    setEvent('');
  };

  const onWildClick = () => {
    // alert ('you clicked in space');
  };

  const onChooseActivity = async activity => {
    actionCancelled = false;
    if (addedAFavorite || activity?.code?.startsWith('document')) {
      addedAFavorite = false;
      return;
    }
    if (activity?.code?.startsWith('event')) {
      if (!toggledRow) {       
        setType(DEFAULT_TYPE);
        // setLimit(DEFAULT_LIMIT);
        setEvent(activity.code.split('.')[1]);
        setNewFact();
      }
      setLimit(limit + 1);
      toggledRow = false;
    } else {
      let result = await API.graphql(
        graphqlOperation(getActivityData, {
          input: {
            client_id: session.client_id,
            person_id: patient.person_id,
            event_id: '',
            activity_type: '$$' + (activity?.code || activity),
            limit: limit,
            fact_data: true,
            includeEvents: true,
            history_only: false,
            use_short_date: isMobile,
          },
        })
      ).catch(error => {
        enqueueSnackbar(`We had a problem getting current information: ${error.errors[0].message}`, {
          variant: 'error',
        });
      });
      let selectedActivity = result.data.getActivityData[0];
      selectedActivityName = activity.name;
      if (selectedActivity.type === 'reservation') { 
        let reservationKey = selectedActivity.code.replace('.','^').split('^')[1];
        result = await API.graphql(
          graphqlOperation(getReservation, {
            client_id: session.client_id,
            event_code: reservationKey,
          })
        ).catch(error => {console.log('error on first get with ', reservationKey)});
        if (!result.data.getReservation) {
          result = await API.graphql(
            graphqlOperation(getReservation, {
              client_id: session.client_id,
              event_code: activity.code.replace('.','^').split('^')[1],
            })
          ).catch(error => {
            enqueueSnackbar(`We had a problem getting that event: ${error.errors[0].message}`, {
              variant: 'error',
            });
          });
        }
        if (!result.data.getReservation) {
          result = await API.graphql(
            graphqlOperation(getReservation, {
              client_id: session.client_id,
              event_code: activity.code,
            })
          ).catch(error => {
            enqueueSnackbar(`We had a problem getting that event: ${error.errors[0].message}`, {
              variant: 'error',
            });
          });
        }
        selectedActivity.default_value = result.data.getReservation;
      }
      setSelected(selectedActivity);
      if (!toggledRow) { setOpen(true) }
      toggledRow = false;
    }
  };

  const onSaveFact = async newFact => {
    let sVal = '';
    let mVal = '';
    let constructedValue = '';
    let constructedQualifier = [];
    setConfirmation(false);
    let showMessage = true;
    let dataType = typeof newFact.value;
    if (dataType === 'string') {
      let writtenFact = await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
      setLastWrittenFact(writtenFact.data.createPutFact);
      [, constructedValue] = newFact.value.replace('.', '^').split('^');
    } else {
      if (newFact.hasOwnProperty('value') && newFact.value) {
        if (newFact.value.hasOwnProperty('mediaData')) {
          if (newFact.value.mediaData.ContentType === 'video/webm' && !actionCancelled) {
            const finalFilename = await putVideo(newFact.value);
            const vName = newFact.value.tag;
            newFact.value = `file_details.s3file=${finalFilename} ~ userTag=${vName}`;
            let writtenFact = await API.graphql(graphqlOperation(createPutFact, { input: newFact }))
              .catch(error => {
                console.log(`Problem writing Fact at video creation: ${JSON.stringify(error)}`)
              });
            setLastWrittenFact(writtenFact?.data?.createPutFact || null);
          } else {
            const finalFilename = await putFile(newFact.value);
            newFact.value = `file_details.s3file=${finalFilename} ~ userTag=${newFact.value.tag}`;
            let writtenFact = await API.graphql(graphqlOperation(createPutFact, { input: newFact }))
              .catch(error => {
                console.log(`Problem writing Fact at file upload: ${JSON.stringify(error)}`)
              });
            setLastWrittenFact(writtenFact?.data?.createPutFact || null);
            showMessage = false;
          }
        }
        else if (newFact.value.hasOwnProperty('selected')) {
          let valueSelectedObject = newFact.value.selected;
          let qualObject = newFact.value.qualifiers;
          let freeTextObject = newFact.value.freeText;
          setFreeText(freeTextObject);
          let associationsObject = newFact.value.associations;
          let masterKey = newFact.activity_key;
          let separator = '';
          //          let qualSeparator = '';
          let fOL = valueSelectedObject.length;
          if (newFact.activity_key.startsWith('form.') || newFact.activity_key.startsWith('message.')) {
            if (newFact.status && newFact.status === 'confirmed') {
              for (let f = 0; f < fOL; f++) {
                mVal = valueSelectedObject[f];
                if (!freeTextObject.hasOwnProperty(mVal)) {
                  constructedValue += separator + mVal;
                  separator = ' ~ ';
                  if (qualObject && qualObject[mVal] && qualObject[mVal] !== '') {
                    constructedQualifier.push(mVal + ':' + qualObject[mVal]);
                  }
                }
              }
              for (const [key, value] of Object.entries(freeTextObject)) {
                if (key !== '%filter%') {
                  constructedValue += separator + key + ' = ' + value;
                  separator = ' ~ ';
                }
              }
              newFact.activity_key = masterKey;
              newFact.value = 'form_selections.' + constructedValue;
              if (constructedQualifier.length > 0) {
                newFact.qualifier = constructedQualifier;
              } else {
                if (newFact.hasOwnProperty('qualifier')) {
                  delete newFact.qualifier;
                }
              }
              let writtenFact = await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
              setLastWrittenFact(writtenFact.data.createPutFact);
            } else {
              setConfirmation(true);
              showMessage = false;
            }
          } else {
            for (let f = 0; f < fOL; f++) {
              mVal = valueSelectedObject[f];
              constructedValue += separator + mVal;
              separator = ' ~ ';
              if (qualObject && qualObject[mVal] && qualObject[mVal] !== '') {
                newFact.qualifier = qualObject[mVal];
              } else {
                if (newFact.hasOwnProperty('qualifier')) {
                  delete newFact.qualifier;
                }
              }
              newFact.activity_key = masterKey;
              newFact.value = 'selection.' + mVal;
              let writtenFact = await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
              setLastWrittenFact(writtenFact.data.createPutFact);
              if (associationsObject && associationsObject.hasOwnProperty(mVal)) {
                newFact.value = 'association.' + mVal;
                newFact.activity_key = associationsObject[mVal];
                await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
              }
            }
          } 
        } else if (newFact.value.hasOwnProperty('event_code')) {      // for "reservation" type activities
          constructedValue = '';
          let link = '';
          let nS = newFact.value.slot.length;
          for (let s = 0; s < nS; s++) {
            if (newFact.value.slot[s].hasOwnProperty('action')) {
              if (newFact.value.slot[s].action) {
                constructedValue += link + newFact.value.slot[s].identifier + ' ' + newFact.value.slot[s].action;
                link =  ' ~ ';
              }
              // delete newFact.value.slot[s].action;
            }
          }
          if (constructedValue) {
            // **** check to see if the reservation has been updated while this user had it open
            let result = await API.graphql(
              graphqlOperation(getReservation, {
                client_id: newFact.value.client_id,
                event_code: newFact.value.event_code,
              })
            ).catch(error => {
              console.log(`Reservation not read while checking version: ${JSON.stringify(error)}`, {
                variant: 'error',
              });
            });
            if (result.data.getReservation.version !== newFact.value.version) {
              enqueueSnackbar(
                `Uh oh! Someone else may have been in the sign-up sheet for ${newFact.value.event_name}, 
                and made a change before you pressed SAVE.  Please try again`,
                {variant: 'error', persist: true}
              );
              let selectedActivity = selected;
              let chosenActivity = selected; 
              selectedActivity.default_value = result.data.getReservation;
              setSelected(selectedActivity);
              setOpen(true);
              showMessage = false;
              onChooseActivity(chosenActivity);
            }
            else {
              newFact.activity_key = 'update.reservation';
              let writtenFact = await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
              writtenFact.data.createPutFact.value = 'update.' + constructedValue;
              setLastWrittenFact(writtenFact.data.createPutFact);
              newFact.value.version ? newFact.value.version++ : newFact.value.version = 1;
              await API.graphql(graphqlOperation(updateReservation, { input: newFact.value })).catch(error => {
                enqueueSnackbar(
                  `Uh oh! We tried to update ${newFact.value.event_name} but something went wrong.  
                  Please try again: ${JSON.stringify(
                    error.message || error.errors[0].message
                  )}`,
                  {
                    variant: 'error', persist: true
                  }
                );
              });
            }
          }
        }
      }
    }
    let segments = constructedValue.split('~');
    let enqueueOut = '';
    segments.forEach(segment => {
      enqueueOut += segment.trim().split(':')[0] + ' - ';
    })
    sVal = enqueueOut.slice(0, (enqueueOut.length - 2)) || (actionCancelled ? 'cancelled' : 'completed');

    setNewFact(newFact);
    setLimit(limit);
    setOpen(false);

    if (showMessage) {
      if (!selectedActivityName && selected.hasOwnProperty('name')) {
        selectedActivityName = selected.name;
      }
      if (selectedActivityName) {
        enqueueSnackbar(`${selectedActivityName} - ${sVal}`, {variant: 'success'});
      }
    }
    selectedActivityName = '';

    async function putVideo(params) {// Uploading files to the bucket
      let mediaData = newFact.value.mediaData;
      let warning = mediaData.Key.includes('_partial.webm') ? 'Your recording was interrupted.  AVA will save everything up to that point. ' : '';
      let vName = newFact.value.tag;
      var videoKeyName = newFact.activity_key.replace('.','^').split('^')[1] + '_' + new Date().getTime() + '.mp4';
      enqueueSnackbar(`${warning}AVA is preparing your video named "${vName}"`,
        {variant: (warning !== '' ? 'warning' : 'info'), persist: true})
      s3.upload(mediaData, function(err, data) {
        if (err) {enqueueSnackbar (`Uh oh!  AVA couldn't save your video.  The reason is ${JSON.stringify(err)}`,
          {variant: 'error', persist: true})}
        else {
          var converterParms = {
            PipelineId: '1626108726566-cv5z9u', /* required */
            Input: {
              Key: mediaData.Key,
            },
            Output: {
              Key: videoKeyName,
              PresetId: '1351620000001-000001',
            },
          };
          elastictranscoder.createJob(converterParms, function(err, data) {
            if (err) alert(`problem with converter job is ${JSON.stringify(err)}.  see ${newFact.activity_key.replace('.','^').split('^')[1] +'.mp4'}`); // an error occurred
            else {
              enqueueSnackbar(`Your video named "${vName}" is saved, and is now being prepared for viewing in AVA.`,
                {variant: 'info', persist: true});           // successful response
            }
          });
        }
      })
      return videoKeyName;
    }

    async function putFile(params) {    // Uploading files to the bucket
      let mediaData = newFact.value.mediaData;
      console.log(mediaData);
      await s3.upload(mediaData, function(err, data) {
        if (err) {
          enqueueSnackbar (`Uh oh!  AVA couldn't save your file.  The reason is ${JSON.stringify(err)}`, {variant: 'error', persist: true});
          return 'File not written';
        }
        else {
          enqueueSnackbar (`AVA completed the upload of your file.  Technical details: Bucket is ${data.Bucket}, Key is ${data.Key}`, {variant: 'success', persist: true});
        }
      });
      return mediaData.Key;
    }
    
  };

  const onNextFact = async newFact => {
    newFact.status = 'confirmed';
    await onSaveFact(newFact);
    let a = ((activities.findIndex(c => { return c.code === selected.code })) + 1 || 0); 
    if ( a > 0 ) { onChooseActivity(activities[a]); }
  };

  // build the event and activity lists for drop downs
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (session) {
        if (mounted) {
          setEvents(events);
          setTypes(types);
        } else {
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // retrieve the activities for the main part of the screen
  React.useEffect(() => {
    setLoading(true);
    let mounted = true;
    (async () => {
      let result;
      if (rowOpen[0]) {console.log('this is here to force a reload')};
      if (patient && session) {
          result = await API.graphql(
            graphqlOperation(getActivityData, { 
              input: {
                client_id: session.client_id,
                person_id: patient.person_id,
                event_id: event,
                activity_type: type,
                limit: limit,
                fact_data: true,
                includeEvents: true,
                history_only: false,
                use_short_date: isMobile,
              },
            })
          ).catch(error => {
            setLoading(false);
            enqueueSnackbar(`Whoops! Something went wrong when fetching activity data: ${error.errors[0].message}`, {
              variant: 'error',
            });
          });

        if (mounted) {
          setLoading(false);
          if (Object.keys(lastWrittenFact).length > 0) {
            // getActivityData is list of options that displays on the user's screen 
            // If we just wrote a fact, attempt to drop information about that fact into getActivityData 
            let [findAKey] = lastWrittenFact.activity_key.split('#');       // fact keys are in the form activity_type.activity_code#time_stamp
            result.data.getActivityData.some((checkObj, aIndex) => {         
              if (checkObj.code !== findAKey) {                             // if the current activity_code is NOT the one that was most recently recorded
                return false;                                               //    leave this iteration, but keep the loop alive (return false)
              }
              // A match! put info about the recently recorded fact into getActivityData 
              result.data.getActivityData[aIndex].fact_history = [lastWrittenFact];   
              result.data.getActivityData[aIndex].observation_status = '';
              [, result.data.getActivityData[aIndex].most_recent_observation] = lastWrittenFact.value
                .replace('.', '^')
                .split('^');
              setLastWrittenFact({});
              return true;                                                    // exit this iteration AND stop the loop (.some ends when ANY true is returned)
            });
          }
          setActivities(result.data.getActivityData);
          if (event === '' && type === DEFAULT_TYPE) {
            setHomeState('home');
          } else {
            setHomeState('event');
          }
        } else {
          API.cancel(result, 'ActivitySection unmounted, cancel getActivityData');
        }
      }
    })();

    if (patient !== activePatient) {
      returnToHome();
      setActivePatient(patient);
    }

    return () => {
      mounted = false;
    };
  }, [patient, event, type]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Paper component={Box} onClick={onWildClick} m={2}>
      <AppBar className={classes.appBar}>
        <Box
          px={3}
          display='flex'
          flexDirection='row'
          minHeight={40}
          width='100%'
          alignItems='center'
          mt={1}
          mb={1}
          justifyContent='space-between'>
          <Box
            flexDirection='row'
            pl={1}
            display='flex'
            grow={1}
            justifyContent='flex-start'
            alignItems='center'>
            <BusinessCenterOutlinedIcon />
            <Typography variant='h6' className={classes.title}>
              AVA
            </Typography>
          </Box>
          <Box pl={2} display={homeState === 'event' ? 'flex' : 'none'}>
              <Button
                color='secondary'
                size='small'
                variant='contained'
                onClick={doneWithEvent}>
                Home
              </Button>
          </Box>
        </Box>
      </AppBar>

      {/* Main Activity List and Selection */}
      <Box p={3} flexGrow={1}>
        <Grid container>
          <Grid md={6} sm={7} xs={12} item>
            <GridList className={classes.gridList} cellHeight='auto' cols={1}>
              {!activities || activities.length === 0 ? null : activities.map((activity, index) => (
                <GridListTile key={activity.code} cols={1}>
                  <Box display={activity.reason === priorReason ? 'none' : 'block'}>
                    <Typography variant='body1' noWrap={true}>
                      {(priorReason = activity.reason)}
                    </Typography>
                  </Box>
                  <Paper
                    component={Box}
                    p={2}
                    variant='outlined'
                    textAlign='left'
                    onClick={() => {
                      onChooseActivity(activity);
                    }}
                    square>
                    <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                      <Box display='flex' flexDirection='column' width='95%' textOverflow='ellipsis'>
                        {activity.type === 'document' ? 
                          <a href={activity.default_value + (!activity.default_value.includes('?') ? ('?a=' + new Date().getTime()) : '')} style={{color: 'inherit', textDecoration: 'none'}} target="_blank" rel="noopener noreferrer">
                            <Typography variant='h5'>{activity.name}</Typography>
                          </a> 
                          :
                          <React.Fragment key={`act_box_${activity.name}`}>                            
                            <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                              <Typography variant='h5'>{activity.name}</Typography>
                            </Box>
                            <Box display={activity.fact_history && rowOpen[index] ? 'block' : 'none'}>
                              {activity.fact_history ? activity.fact_history.map((hItem, hNdx) => (
                                <Typography key={activity.name + 'h' + hNdx} variant='body2'>
                                  {hNdx > 0 ? <br /> : null}
                                  {new Date(hItem.posted_time).toLocaleString()} <br /> {hItem.value.replace('.','^').split('^')[1]} 
                                </Typography>
                              )) : null}
                            </Box>
                          </React.Fragment>
                        }
                      </Box>
                      <Box
                        alignSelf='center'
                        flexDirection='row'
                        color='white'
                        display={activity.fact_history ? 'flex' : 'none'}>
                        <IconButton
                          aria-label='showHistory'
                          onClick={() => {
                            toggledRow = true;
                            let newRowOpen = rowOpen;
                            newRowOpen[index] = !newRowOpen[index];
                            setRowOpen(newRowOpen);
                          }}>
                          { rowOpen[index] ? <ExpandLessIcon /> : <ExpandMoreIcon /> }
                        </IconButton>
                      </Box>
                    </Box>
                  </Paper>
                </GridListTile>
              ))}
              <GridListTile cols={1}>
                <Typography variant='caption' noWrap={true}>
                  {`***AVA ${process.env.REACT_APP_AVA_VERSION}***`}
                </Typography>
              </GridListTile>
            </GridList>
          </Grid>
        </Grid>
        {loading ? 
          <div style={{display: 'flex', justifyContent: 'center'}}>
            <CircularProgress />
          </div> 
          : null
        }
      </Box>
    
      {/* Launch Children */}
      {open ? (
        <NewFactDialog
          fact={selected}
          session={session}
          open={open}
          fromHome={homeState}
          onClose={() => {
            setOpen(false);
            actionCancelled = true; 
          }}
          onSave={onSaveFact}
          onNext={onNextFact}
          onSelected={(nextActivity) => {
            setLimit(limit);
            setOpen(false);
            selectedActivityName = '';
            onChooseActivity(nextActivity);
          }}
        />
      ) : null}

      {/* When pressed "home" after entering diary data, this dialog lets you review the data and confirm it */}
      <Dialog
        open={showSummary && homeState === 'event'}
        onClose={handleSummaryBack}
        scroll='paper'
        fullWidth={true}
        aria-labelledby='scroll-dialog-title'
        aria-describedby='scroll-dialog-description'>
        <DialogTitle id='scroll-dialog-title' className={classes.descriptionText}>
          {activities && activities[0] && activities[0].reason
            ? activities[0].reason.substr(0, activities[0].reason.length - 6)
            : null}
        </DialogTitle>
        <DialogContent dividers={true} className={classes.descriptionText}>
          <DialogContentText id='scroll-dialog-description' tabIndex={-1}>
            {!activities || activities.length === 0 ? null : activities.map(activity =>
              activity.observation_expires && activity.observation_expires < timeNow ? (
                <Typography key={activity.name}>
                  <Box key={activity.name + '.name'} pt={2}>
                    {activity.name + ':  (no data)'}
                  </Box>
                </Typography>
              ) : (
                <Typography key={activity.name}>
                  <Box key={activity.name + '.name'} pt={2}>
                    {activity.name + ':'}
                  </Box>
                  <Box key={activity.name + '.value'} fontWeight='fontWeightBold'>
                    {activity.most_recent_observation}
                  </Box>
                </Typography>
              )
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button className={classes.reject} size='small' variant='contained' onClick={handleSummaryBack}>
            Back
          </Button>
          <Button color='secondary' size='small' variant='contained' onClick={handleSummaryExit}>
            Exit
          </Button>
          <Button variant='contained' className={classes.confirm} size='small' onClick={handleSummarySubmit}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Some activities require review and confirmation before writing in Facts table */}
      <Dialog
        open={showConfirmation}
        onClose={handleSummaryBack}
        scroll='paper'
        fullWidth={true}
        aria-labelledby='scroll-dialog-title'
        aria-describedby='scroll-dialog-description'>
        <DialogTitle id='scroll-dialog-title' className={classes.descriptionText}>
          {selected ? selected.name : null}
        </DialogTitle>
        <DialogContent dividers={true} className={classes.descriptionText}>
          <DialogContentText id='scroll-dialog-description' tabIndex={-1}>
            {newFact?.value?.selected
              ? newFact.value.selected.map(selectedValue => (
                  <Typography key={selectedValue}>
                    {newFact.value.freeText[selectedValue] ? null : (
                      <Box key={selectedValue + '.value'} pt={2} fontWeight='fontWeightBold'>
                        {selectedValue.split(':')[0]}
                      </Box>
                    )}
                    {newFact.value.qualifiers &&
                    !newFact.value.freeText[selectedValue] &&
                    newFact.value.qualifiers.hasOwnProperty(selectedValue) ? (
                      <Box key={selectedValue + '.qualifier'} pl={2} fontSize='0.8rem'>
                        {newFact.value.qualifiers[selectedValue].join(' ~ ')}
                      </Box>
                    ) : null}
                  </Typography>
                ))
              : null}
          </DialogContentText>
          <DialogContentText id='scroll-dialog-description' tabIndex={-1}>
            {newFact?.value?.freeText
              ? Object.keys(newFact.value.freeText).map(selectedValue =>
                  !selectedValue.startsWith('%filter%') ? (
                    <Typography key={selectedValue}>
                      <Box key={selectedValue + '.name'} pt={2} fontWeight='fontWeightBold'>
                        {selectedValue}
                      </Box>
                      <Box key={selectedValue + '.value'} pl={2} fontSize='0.8rem'>
                        {newFact.value.freeText[selectedValue]}
                      </Box>
                    </Typography>
                  ) : null
                )
              : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button className={classes.reject} size='small' variant='contained' onClick={handleConfirmBack}>
            Back
          </Button>
          <Button variant='contained' className={classes.confirm} size='small' onClick={handleConfirmSubmit}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
