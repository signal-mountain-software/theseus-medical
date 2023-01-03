import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { Lambda } from 'aws-sdk';
import IdleTimer from 'react-idle-timer';
import avaAlert from '../../ava_alert.mp3';
import { useSnackbar } from 'notistack';

import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';
import Card from '@material-ui/core/Card';
import CardMedia from '@material-ui/core/CardMedia';
import Avatar from '@material-ui/core/Avatar';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { fade } from '@material-ui/core/styles/colorManipulator';
import makeStyles from '@material-ui/core/styles/makeStyles';
import IconButton from '@material-ui/core/IconButton';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';

import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';

import { updateSession } from '../../graphql/mutations';
import { createPutFact } from '../../graphql/mutations';

// import { getActivityData } from '../../graphql/queries';
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
    fontWeight: 'bold',
    marginLeft: 15
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  logoDisplay: {
    maxWidth: '600px',
    marginBottom: '15px'
  },
  logoSmall: {
    maxWidth: '100px',
    marginBottom: '15px'
  },
  mainPaper: {
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
  activityText: {
    marginLeft: theme.spacing(3),
  },
}));

const DEFAULT_TYPE = 'My_activities';
var DEFAULT_LIMIT = 100;


export default ({ patient, session }) => {
  DEFAULT_LIMIT++;

  const [newFact, setNewFact] = React.useState(null);

  const [activities, setActivities] = React.useState([]); // populates the activity buttons

  const [event, setEvent] = React.useState(''); // stores the current selected event filter
  const [type, setType] = React.useState(DEFAULT_TYPE); // stores the current selected type filter
  const [limit, setLimit] = React.useState(DEFAULT_LIMIT); // stores the current limit of activity buttons displayed

  //const [lastEvent, setLastEvent] = React.useState(''); // stores the current selected event filter
  //const [lastType, setLastType] = React.useState(''); // stores the current selected type filter
  //const [lastPerson, setLastPerson] = React.useState(''); // stores the current selected type filter
  //const [lastLimit, setLastLimit] = React.useState(0); // stores the current limit of activity buttons displayed

  const [loading_complete, setLoading_complete] = React.useState(false); // a flag that shows/hides loading spinner
  const [showNewFactDialog, setShowNewFactDialog] = React.useState(false); // a flag that shows/hides the NewFactDialog
  const [selected, setSelected] = React.useState(null); // stores the current selected fact being added
  const [homeState, setHomeState] = React.useState('home');
  var actionCancelled;

  const [activePatient, setActivePatient] = React.useState(null);

  const [promise, setPromise] = React.useState(null);

  const [rowOpen, setRowOpen] = React.useState([]);
  const [sectionOpen, setSectionOpen] = React.useState({});

  // const [showSummary, setSummary] = React.useState(false);
  const [showConfirmation, needsConfirmation] = React.useState(false);
  // eslint-disable-next-line
  const [showFreeText, setFreeText] = React.useState({});

  const [lastWrittenFact, setLastWrittenFact] = React.useState({});

  // var timeNow = new Date().getTime();

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const classes = useStyles();

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  async function getActivityDetails(pActivity) {
    let invokeFailed = false;
    var payload = {
      "body": {
        clientId: pActivity.client_id || session.client_id,
        personId: patient?.person_id || session.patient_id,
        activityType: '$$' + pActivity.code,
        limit: limit,
        fact_data: false,
        history_only: false,
        use_short_date: isMobile,
        kiosk_mode: false
      }
    };
    let functionName = 'thesesus-activityList';
    // the misspelling of thesesus was priginally accidental, but now ingrained and left alone
    if (session) {
      if (['l', 't'].includes(session.status?.environment)) {
        functionName = 'tesActivityData';
        payload.body.test = true;
      }
    }
    let params = {
      FunctionName: `arn:aws:lambda:us-east-1:125549937716:function:${functionName}`,
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`We had a problem getting current information: ${JSON.stringify(err)}`, {
          variant: 'error',
          persist: true
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let returnData = JSON.parse(fResp.Payload);
      if (returnData.status === 200) {
        return returnData.body.activityData[0];
      }
      else {
        enqueueSnackbar(`AVA returned an error handling your selection.  It is: ${returnData.body}`, {
          variant: 'error',
        });
      }
    }
    return [];
  }

  async function getActivityList(pType, pEvent) {
    let invokeFailed = false;
    /*  
        var payload = {
          "body": {
            clientId: session.client_id,
            personId: patient?.person_id || session.patient_id,
            activityType: pType,
            limit: 169,
            includeEvents: true,
            fact_data: true,
            history_only: false,
            use_short_date: isMobile,
            kiosk_mode: session?.kiosk_mode || false
          }
        };
        if (pEvent) { payload.body.eventId = pEvent; };
    */
    //  let functionName = 'thesesus-activityList';
    let functionName = 'MakeAVAMenu';
    let testMode = ['l', 't'].includes(session?.status?.environment);
    // the misspelling of thesesus was priginally accidental, but now ingrained and left alone
    if (testMode) { functionName = 'TestAVAMenu'; }
    let params = {
      FunctionName: `arn:aws:lambda:us-east-1:125549937716:function:${functionName}`,
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      // Payload: JSON.stringify(payload)
    };
    params.Payload = JSON.stringify({
      test: testMode,
      action: 'retrieve',
      client_id: session.client_id,
      request: {
        person_id: patient?.person_id || session.patient_id,
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`We had a problem getting current information: ${JSON.stringify(err)}`, {
          variant: 'error',
          persist: true
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let returnData = JSON.parse(fResp.Payload);
      if (returnData.status === 200) {
        return {
          "data": {
            "getActivityData": returnData.body.activityData
          }
        };
      }
      else if ('StatusCode' in fResp) {
        enqueueSnackbar(`AVA returned an error building your menu.  It is: ${returnData.errorMessage}`,
          { variant: 'error', persist: true }
        );
      }
      else {
        enqueueSnackbar(`AVA returned an error building your menu.  It is: ${returnData.body}`,
          { variant: 'error', persist: true }
        );
      }
    }
    return {
      "data": {
        "getActivityData": []
      }
    };
  }

  const activityLog = (pUser, pCode, pName) => {
    let pCodeOut = '';
    if (typeof (pCode) === 'object') { pCodeOut = JSON.stringify(pCode); }
    else { pCodeOut = pCode; }
    var payload =
    {
      'test': false,
      'action': "add_entry",
      'request': {
        user_id: pUser,
        activity_code: pCodeOut,
        activity_name: pName,
        AVA_version: `23.1.6${window.location.href.split('//')[1].slice(0, 1)}`
      }
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:ActivityLogMaintenance',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log('Access log call failed.  Error is', JSON.stringify(err));
      });
  };

  var priorReason = '';
  var sectionColor = '';
  var selectedActivityName = '';
  var addedAFavorite = false;
  var toggledRow = false;
  var toggledSection = false;

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const s3 = new AWS.S3({
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  var idleTimer = null;

  const doneWithEvent = () => {
    needsConfirmation(false);
    if (homeState === 'home') {
      serviceWorker.unregister();
      window.location.reload();
    }
    returnToHome();
  };


  const handleConfirmSubmit = () => {
    needsConfirmation(false);
    newFact.status = 'confirmed';
    selectedActivityName = selected.name;
    setNewFact(newFact);
    onSaveFact(newFact);
  };

  const handleConfirmBack = () => {
    // setSummary(false);
    needsConfirmation(false);
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
    setShowNewFactDialog(true);
  };

  const returnToHome = () => {
    setType(DEFAULT_TYPE);
    // setLimit(DEFAULT_LIMIT);
    setEvent('');
  };

  const onWildClick = () => {
    closeSnackbar();
  };
  /*
    function handleWriteError(parmMessage) {
      if (!parmMessage.includes('Network Error')) {
        let errorTime = new Date().toString();
        let instruction = {
          patient_id: patient.person_id,
          activity_key: '***ERROR_CAUGHT***',
          value: parmMessage,
          status: `Version = 23.1.6~${errorTime}`,
          session: {
            user_id: patient.person_id,
            session_id: session.client_id,
          },
        };
        API
          .graphql(graphqlOperation(createPutFact, { input: instruction }))
          .catch(e => { alert(`Menu build error, possible cause: ${parmMessage} / ${JSON.stringify(e)}. Use refresh button.`); });
      }
    };
  */
  function statusLine() {
    let returnValue = `*** AVA `;
    if (session) {
      if (typeof (session.status) === 'object') {
        returnValue += session.status.version;
        switch (session.status.environment) {
          case 'd': { break; }
          case 's': { returnValue += '/MASTER'; break; }
          case 'l': { returnValue += '/LOCAL'; break; }
          case 't': { returnValue += '/TEST'; break; }
          default: { returnValue += `/${session.status.environment.toUpperCase()}`; break; }
        }
      }
      else {
        returnValue += process.env.REACT_APP_AVA_VERSION;
      }
      returnValue += `/${session.patient_id}`;
      if (session.patient_id !== session.user_id) {
        returnValue += `(${session.user_id})`;
      }
    }
    returnValue += ' ***';
    return returnValue;
  }

  const onChooseActivity = async activity => {
    if (toggledSection) {
      toggledSection = false;
      activityLog(patient?.person_id || session.patient_id, `${activity.toggleAction ? 'Open/Show' : 'Close/Hide'} section`, activity.reason);
      setLimit(limit + 1);
      return;
    }
    activityLog(patient?.person_id || session.patient_id, activity?.code || activity, activity?.name || activity);
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
      /*
      let result = await API.graphql(
        graphqlOperation(getActivityData, {
          input: {
            client_id: session.client_id,
            person_id: patient?.person_id || session.patient_id,
            event_id: '',
            activity_type: '$$' + (activity?.code || activity),
            limit: limit,
            fact_data: false,
            includeEvents: true,
            history_only: false,
            use_short_date: isMobile,
            kiosk_mode: false
          },
        })
      ).catch(error => {
        enqueueSnackbar(`We had a problem getting current information: ${error.errors[0].message}`, {
          variant: 'error',
        });
      });
      let selectedActivity = result?.data?.getActivityData?.[0];
      */
      let selectedActivity = await getActivityDetails(activity);
      selectedActivityName = activity.name;
      if (selectedActivity.type === 'reservation') {
        let reservationKey = selectedActivity.code.replace('.', '^').split('^')[1];
        let result = await API.graphql(
          graphqlOperation(getReservation, {
            client_id: session.client_id,
            event_code: reservationKey,
          })
        ).catch(error => { console.log('error on first get with ', reservationKey); });
        if (!result.data.getReservation) {
          result = await API.graphql(
            graphqlOperation(getReservation, {
              client_id: session.client_id,
              event_code: activity.code.replace('.', '^').split('^')[1],
            })
          ).catch(error => {
            enqueueSnackbar(`We had a problem getting that event: ${error.errors[0].message}`, {
              variant: 'error',
              persist: true
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
              persist: true
            });
          });
        }
        selectedActivity.default_value = result.data.getReservation;
      }
      setSelected(selectedActivity);
      if (!toggledRow) { setShowNewFactDialog(true); }
      toggledRow = false;
    }
  };

  const onSaveFact = async newFact => {
    let sVal = '';
    let mVal = '';
    let constructedValue = '';
    let constructedQualifier = [];
    let factWasWritten = false;
    needsConfirmation(false);
    let showMessage = true;
    if (typeof newFact.value === 'string') {
      let writtenFact = await API
        .graphql(graphqlOperation(createPutFact, { input: newFact }))
        .catch(error => {
          enqueueSnackbar(
            `Uh oh! We tried to update ${newFact.value.event_name} but something went wrong. Please try again: ${JSON.stringify(
              error.message || error.errors[0].message
            )}`,
            {
              variant: 'error', persist: true
            }
          );
        });
      setLastWrittenFact(writtenFact.data.createPutFact);
      factWasWritten = true;
      [, constructedValue] = newFact.value.replace('.', '^').split('^');
    } else {
      if (newFact.hasOwnProperty('value') && newFact.value && !newFact.activity_key.startsWith('action.')) {
        if (newFact.value.hasOwnProperty('mediaData')) {
          let valueSelectedString = '';
          if (newFact.value.selected) {
            valueSelectedString += ' ~ ' + newFact.value.selected.join(' ~ ');
          }
          if (newFact.value.freeText) {
            for (const [k, v] of Object.entries(newFact.value.freeText)) {
              valueSelectedString += ` ~ ${k}=${v}`;
            }
          }
          if (
            (
              newFact.value?.mediaData?.ContentType?.includes('video')
              || newFact.value?.mediaData?.Body?.type?.includes('video')
              || newFact.value?.mediaData?.ContentType?.includes('audio')
              || newFact.value?.mediaData?.Body?.type?.includes('audio')
            )
            && !actionCancelled
          ) {
            const finalFilename = await putMedia(newFact.value);
            if (finalFilename) {
              const vName = newFact.value.tag;
              newFact.value = `file_details.s3file=${finalFilename} ~ Video ~ userTag=${vName}${valueSelectedString}`;
              let writtenFact = await API
                .graphql(graphqlOperation(createPutFact, { input: newFact }))
                .catch(error => {
                  enqueueSnackbar(
                    `Uh oh! We couldn't record important information about your recording. Please try again: ${JSON.stringify(
                      error.message || error.errors[0].message
                    )}`,
                    {
                      variant: 'error', persist: true
                    }
                  );
                });
              setLastWrittenFact(writtenFact?.data?.createPutFact || null);
              factWasWritten = true;
            }
            else { showMessage = false; }
          }
          else {
            const finalFilename = await putFile(newFact.value);
            if (finalFilename) {
              newFact.value = `file_details.s3file=${finalFilename} ~ File ~ userTag=${newFact.value.tag}${valueSelectedString}`;
              let writtenFact = await API.graphql(graphqlOperation(createPutFact, { input: newFact }))
                .catch(error => {
                  console.log(`Problem writing Fact at file upload: ${JSON.stringify(error)}`);
                });
              setLastWrittenFact(writtenFact?.data?.createPutFact || null);
              factWasWritten = true;
            }
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
                mVal = valueSelectedObject[f].split(':', 2).join(':');  // this trick removes any data after a SECOND ":"
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
              let writtenFact = await API
                .graphql(graphqlOperation(createPutFact, { input: newFact }))
                .catch(error => {
                  enqueueSnackbar(
                    `Uh oh! We tried to update ${newFact.value.event_name} but something went wrong. Please try again: ${JSON.stringify(
                      error.message || error.errors[0].message
                    )}`,
                    {
                      variant: 'error', persist: true
                    }
                  );
                });
              setLastWrittenFact(writtenFact?.data?.createPutFact);
              factWasWritten = true;
            } else {
              needsConfirmation(true);
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
              factWasWritten = true;
              if (associationsObject && associationsObject.hasOwnProperty(mVal)) {
                newFact.value = 'association.' + mVal;
                newFact.activity_key = associationsObject[mVal];
                await API
                  .graphql(graphqlOperation(createPutFact, { input: newFact }))
                  .catch(error => {
                    enqueueSnackbar(
                      `Uh oh! We tried to update ${newFact.value.event_name} but something went wrong. Please try again: ${JSON.stringify(
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
    }
    if (constructedValue) {
      let segments = constructedValue.split('~');
      let enqueueOut = '';
      segments.forEach(segment => {
        enqueueOut += segment.trim().split(/:+(?!\s)/)[0] + ' - ';
      });
      sVal = enqueueOut.slice(0, (enqueueOut.length - 2)) || (actionCancelled ? 'cancelled' : 'completed');
    }
    else {
      showMessage = false;
    }

    setNewFact(newFact);
    setLimit(limit);
    setShowNewFactDialog(false);

    if (showMessage) {
      if (!selectedActivityName && selected.hasOwnProperty('name')) {
        selectedActivityName = selected.name;
      }
      if (selectedActivityName) {
        enqueueSnackbar(`${selectedActivityName} - ${sVal}`, { variant: 'success' });
      }
    }
    selectedActivityName = '';
    if (session?.url_parameters && (session.url_parameters.hasOwnProperty('activity')) && (session.url_parameters.hasOwnProperty('user')) && factWasWritten) {
      let jumpTo = window.location.href.replace('theseus', 'thankyou').split('?')[0];
      jumpTo += `?user=${session.url_parameters.user}`;
      window.location.replace(jumpTo);
    }

    async function putMedia(params) {   // Uploading files to the bucket
      let newName = newFact.value?.freeText?.Title || newFact.value.mediaData.Key;
      let fileExtension = newFact.value.mediaData.Key.split('.').pop();
      let destinationName = newName.trim().replace(/[\s/]/g, '_').split('.')[0];
      newFact.value.mediaData.Key = destinationName + '.' + fileExtension;
      let mediaData = newFact.value.mediaData;
      let warning = mediaData.Key.includes('_partial.webm') ? 'Your recording was interrupted.  AVA will save everything up to that point. ' : '';
      enqueueSnackbar(`${warning}AVA is saving your recording named ${newName}`,
        { variant: (warning !== '' ? 'warning' : 'info'), persist: true });
      let uploadOK = true;
      let uploadResult = await s3
        .upload(mediaData)
        .promise()
        .catch(err => {
          uploadOK = false;
          enqueueSnackbar(`Uh oh!  AVA couldn't save your recording.  The reason is ${err.message}`,
            { variant: 'error', persist: true });
        });
      if (uploadOK) {
        enqueueSnackbar(`Your recording named ${destinationName} is saved!`, { variant: 'success', persist: false });
        showMessage = false;
        return uploadResult.Key;
      };
      return null;
    }

    async function putFile(params) {    // Uploading files to the bucket
      let mediaData = newFact.value.mediaData;
      let uploadGood = true;
      await s3.putObject(mediaData)
        .promise()
        .catch(err => {
          enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
          uploadGood = false;
        })
        .then(data => {
          if (uploadGood) {
            enqueueSnackbar(`AVA completed the upload of your file.  Technical details: Bucket is ${data?.Bucket}, Key is ${data?.Key}`, { variant: 'success', persist: true });
          }
        });
      if (uploadGood) { return mediaData.Key; }
      else { return null; }
    }

  };

  const onNextFact = async newFact => {
    if (newFact.activity_key.startsWith('search.') && selected.normal_value) {
      if (newFact.value.selected) { newFact.value.freeText.selected = newFact.value.selected; };
      onChooseActivity(
        selected.normal_value
        + '%%'
        + (newFact.value.freeText && JSON.stringify(newFact.value.freeText)));
    }
    else {
      newFact.status = 'confirmed';
      await onSaveFact(newFact);
      let a = ((activities.findIndex(c => { return c.code === selected.code; })) + 1 || 0);
      if ((a > 0) && (a < activities.length)) { onChooseActivity(activities[a]); }
      else { doneWithEvent(); }
    }
  };

  // on session change... build the event and activity lists for drop downs
  React.useEffect(() => {
    if (session) {
      setLoading_complete(false);
      if (session.url_parameters && (session.url_parameters.hasOwnProperty('activity'))) {
        onChooseActivity(session.url_parameters.activity);
        return () => {
        };
      }
      if (session?.kiosk_mode
        && (session.user_id === session.patient_id)
        && session.kiosk_activity
      ) {
        onChooseActivity(session.kiosk_activity);
        return () => {
        };
      }
      if (session?.current_event) {
        setSectionOpen(JSON.parse(session.current_event));
      };
      setLoading_complete(true);
      return () => {
      };
    }
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // on patient, event, or type change... retrieve the activities for the main part of the screen
  React.useEffect(() => {
    setLoading_complete(false);
    let mounted = true;
    let callPromise = (async () => {
      if (patient && session) {
        /*
        let result = await API.graphql(
          graphqlOperation(getActivityData, {
            input: {
              client_id: session.client_id,
              person_id: patient.person_id,
              event_id: event,
              activity_type: type,
              limit: 169,
              fact_data: true,
              includeEvents: true,
              history_only: false,
              use_short_date: isMobile,
              kiosk_mode: session?.kiosk_mode
            },
          })
        ).catch(error => {
          setLoading(false);
          enqueueSnackbar(`Whoops! Something went wrong when fetching activity data: ${error.errors[0].message}`, {
            variant: 'error',
            persist: true,
          });
          mounted = false;
          handleWriteError(`Error in getActivityData is ${error.errors[0].message}`);
        });
        */

        let result = await getActivityList(type, event);

        if (mounted) {
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
              return true;                                                    // exit this iteration AND stop the loop (.some ends when ANY true is returned)
            });
          }
          setActivities(result.data.getActivityData);
          let previousHomeState = homeState;
          if (event === '' && type === DEFAULT_TYPE) {
            setHomeState('home');
          } else {
            setHomeState('event');
            if (previousHomeState !== 'event') {
              window.scrollTo(0, 0);
            }
          }
          setLoading_complete(true);
        } else {
          API.cancel(result, 'ActivitySection unmounted, cancel getActivityData');
        }
      }
    })();

    if (patient && session) {
      setPromise(callPromise);
      if (false) { console.log(promise); };
    }

    if (patient?.person_id !== activePatient?.person_id) {
      returnToHome();
      setActivePatient(patient);
    }

    return () => {
      mounted = false;
    };
  }, [patient?.person_id, event, type]); // eslint-disable-line react-hooks/exhaustive-deps

  // on limit or lastWrittenFact change... retrieve the activities for the main part of the screen
  React.useEffect(() => {
    setLoading_complete(false);
    if (Object.keys(lastWrittenFact).length > 0) {
      let updatedActivities = activities;
      // getActivityData is list of options that displays on the user's screen 
      // If we just wrote a fact, attempt to drop information about that fact into getActivityData 
      let [findAKey] = lastWrittenFact.activity_key.split('#');       // fact keys are in the form activity_type.activity_code#time_stamp
      updatedActivities.some((checkObj, aIndex) => {
        if (checkObj.code !== findAKey) {                             // if the current activity_code is NOT the one that was most recently recorded
          return false;                                               //    leave this iteration, but keep the loop alive (return false)
        }
        // A match! put info about the recently recorded fact into getActivityData 
        updatedActivities[aIndex].fact_history = [lastWrittenFact];
        updatedActivities[aIndex].observation_status = '';
        [, updatedActivities[aIndex].most_recent_observation] = lastWrittenFact.value
          .replace('.', '^')
          .split('^');
        return true;                                                    // exit this iteration AND stop the loop (.some ends when ANY true is returned)
      });
      setActivities(updatedActivities);
      setLimit(limit + 1);
      setLastWrittenFact({});
    };
    setLoading_complete(true);
    return () => {
    };
  }, [limit, lastWrittenFact]); // eslint-disable-line react-hooks/exhaustive-deps


  const updateSessionPreferences = (pSections) => {
    if (session) {
      API
        .graphql(graphqlOperation(
          updateSession, {
          input: {
            session_id: session.user_id,
            current_event: JSON.stringify(pSections),
          }
        }))
        .catch(error => {
          enqueueSnackbar(`Change to your preference was not saved.`, { variant: 'info' });
        });
    };
  };

  function stringToColor(string) {
    let hash = 0;
    let i;

    /* eslint-disable no-bitwise */
    for (i = 0; i < string.length; i += 1) {
      hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }

    let color = '#';

    for (i = 0; i < 3; i += 1) {
      const value = (hash >> (i * 8)) & 0xff;
      color += `00${value.toString(16)}`.substr(-2);
    }
    /* eslint-enable no-bitwise */

    return color;
  }

  let idleSince = null;
  let idleStartTime = 0;
  let idleString = '';
  let msInAMinute = 1000 * 60;

  return (
    <Paper className={classes.mainPaper} onClick={() => onWildClick} >
      {/* Idle timer always running */}
      <IdleTimer
        ref={ref => { idleTimer = ref; }}
        timeout={(session?.kiosk_mode ? 1 : 30) * msInAMinute}   // every "n" minutes
        onAction={(event) => {
          if (idleSince) {
            console.log(`Active at ${new Date().toLocaleString()} on ${event.type}`);
            idleSince = null;
          }
        }}
        onIdle={async () => {
          if (!idleSince) {
            idleSince = idleTimer.getLastActiveTime();
            idleString = new Date(idleSince).toLocaleString();
            idleStartTime = new Date(idleSince).getTime();
            console.log(`Idle since ${idleString}`);
          }
          else {
            console.log(`Still idle at ${new Date().toLocaleString()}`);
            if (session?.kiosk_mode) {
              let checkTime = new Date().getTime() - idleStartTime;
              if (checkTime > (4 * msInAMinute)) {
                closeSnackbar();
                let newPatient = {
                  patient_id: session.user_id,
                  patient_display_name: session.user_display_name
                };
                await API.graphql(
                  graphqlOperation(updateSession, { input: { session_id: session.user_id, ...newPatient } })
                ).catch(error => { console.log(error); });
                let jumpTo = window.location.href.replace('refresh', 'theseus');
                window.location.replace(jumpTo);
              }
              else if (checkTime > (3 * msInAMinute)) {
                closeSnackbar();
                enqueueSnackbar(
                  `Are you still there?  AVA will end your session in 1 minute...`,
                  { variant: 'warning', persist: true }
                );
                try { new Audio(avaAlert).play(); }
                catch (err) {
                  console.log('play sound failed due to browser');
                }
              }
              else if (checkTime > (2 * msInAMinute)) {
                closeSnackbar();
                enqueueSnackbar(
                  `Are you still there?  AVA will end your session in 2 minutes...`,
                  { variant: 'info', persist: true }
                );
                try { new Audio(avaAlert).play(); }
                catch (err) {
                  console.log('play sound failed due to browser');
                }
              }
            }
          }
          idleTimer.reset();
        }}
        debounce={250}
      />

      {/* Main Activity List and Selection */}
      <Box p={3}  >
        {loading_complete && session && activities && (activities.length > 0) &&
          <Grid item>
            <Card
              className={classes.logoDisplay}
              raised={false}
              variant='elevation' elevation={0}
            >
              <CardMedia
                component="img"
                image={session?.client_icon || 'https://ava-icons.s3.amazonaws.com/AVA-logo.jpg'}
                alt='AVA'
              />
            </Card>
            <GridList cellHeight='auto' cols={1}>
              {homeState === 'event' ?
                <GridListTile
                  key={'ReturnHomeHeader'}
                  style={{ marginBottom: '0px', marginTop: '0px' }}
                  cols={1}
                >
                  <Paper
                    component={Box}
                    p={2}
                    style={{ background: '#d25958', marginTop: '5px', marginBottom: '5px' }}
                    textAlign='left'
                    onClick={doneWithEvent}
                    square>
                    <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                      {('Dont display me')}
                    </Typography>
                    <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
                      <Box
                        display='flex'
                        flexDirection='row'
                        alignItems='center'
                        marginRight={4}
                      >
                        <Avatar
                          src={`https://ava-icons.s3.amazonaws.com/back.png`}
                          sx={{ width: 30, height: 30 }}
                          alt=""
                          variant="square"
                        />
                        <Typography className={classes.gridList} variant='h5'>
                          {'Return to Main Menu'}
                        </Typography>
                      </Box>
                      <IconButton
                        aria-label='showActivities'
                        size='small'
                      >
                        {'Back'}
                      </IconButton>
                    </Box>
                  </Paper>
                </GridListTile>
                : 'none'}
              {!activities || activities.length === 0
                ? null
                : activities.map((activity, index) => (
                  !sectionOpen[activity.reason] && (activity.reason === priorReason) ? null :
                    <GridListTile
                      key={activity.reason + 'r' + index}
                      style={{ marginBottom: '0px', marginTop: '0px' }}
                      cols={1}
                    >
                      {activity.reason === priorReason ? null :
                        <Paper
                          component={Box}
                          p={2}
                          style={{ background: activity.color || stringToColor(activity.reason), marginTop: '5px', marginBottom: '5px' }}
                          textAlign='left'
                          onClick={() => {
                            toggledSection = true;
                            let newSectionOpen = sectionOpen;
                            !sectionOpen.hasOwnProperty(activity.reason)
                              ? newSectionOpen[activity.reason] = true
                              : newSectionOpen[activity.reason] = !newSectionOpen[activity.reason];
                            setSectionOpen(newSectionOpen);
                            updateSessionPreferences(newSectionOpen);
                            activity.toggleAction = newSectionOpen[activity.reason];
                            onChooseActivity(activity);
                          }}
                          square>
                          <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                            {(sectionColor = activity.color || stringToColor(activity.reason))}
                          </Typography>
                          <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
                            <Box
                              display='flex'
                              flexDirection='row'
                              alignItems='center'
                              marginRight={4}
                            >
                              <Avatar
                                src={activity.icon || `https://ava-icons.s3.amazonaws.com/dining-room.png`}
                                sx={{ width: 30, height: 30 }}
                                alt=""
                                variant="square"
                              />
                              <Typography className={classes.gridList} variant='h5'>
                                {(priorReason = activity.reason)}
                              </Typography>
                            </Box>
                            <IconButton
                              aria-label='showActivities'
                              size='small'
                            >
                              {!sectionOpen[activity.reason] ? 'Show' : 'Hide'}
                            </IconButton>
                          </Box>
                          <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                            {false}
                          </Typography>
                        </Paper>
                      }
                      {!sectionOpen[activity.reason] ? null :
                        <Paper
                          component={Box}
                          p={2}
                          variant='outlined'
                          style={{ background: activity.color || sectionColor, marginBottom: '0px', marginTop: '0px' }}
                          textAlign='left'
                          onClick={() => {
                            closeSnackbar();
                            onChooseActivity(activity);
                          }}
                          square>
                          <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                            <Box
                              display='flex'
                              flexDirection='column'
                              className={classes.activityText}
                              textOverflow='ellipsis'
                            >
                              {activity.type === 'document' ?
                                <a href={activity.default_value + (!activity.default_value.includes('?') ? ('?a=' + new Date().getTime()) : '')} style={{ color: 'inherit', textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">
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
                                        {new Date(hItem.posted_time).toLocaleString()} <br /> {hItem.value.replace('.', '^').split('^')[1]}
                                      </Typography>
                                    )) : null}
                                  </Box>
                                </React.Fragment>
                              }
                            </Box>
                            {activity.fact_history ?
                              <IconButton
                                aria-label='showHistory'
                                onClick={() => {
                                  toggledRow = true;
                                  let newRowOpen = rowOpen;
                                  newRowOpen[index] = !newRowOpen[index];
                                  setRowOpen(newRowOpen);
                                }}>
                                {rowOpen[index] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                              </IconButton> : null}
                          </Box>
                        </Paper>
                      }
                    </GridListTile>
                ))}
              <GridListTile cols={1} >
                <Typography variant='caption' noWrap={true}>
                  {statusLine()}
                </Typography>
              </GridListTile>
            </GridList>
          </Grid>
        }
        {(!loading_complete || !session || !activities || (activities.length === 0)) ?
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Box mt={3} display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
              <Card
                className={classes.logoSmall}
                raised={false}
                variant='elevation' elevation={0}
              >
                <CardMedia
                  component="img"
                  image={'https://ava-icons.s3.amazonaws.com/AVA+Logo.png'}
                  alt='AVA'
                />
              </Card>
              <Typography align='center'>
                {`Loading AVA version 23.1.6${window.location.href.split('//')[1].slice(0, 1)}`}
              </Typography>
              <CircularProgress />
            </Box>
          </div>
          : null
        }
      </Box>

      {/* Launch Children */}
      {showNewFactDialog ? (
        <NewFactDialog
          fact={selected}
          session={session}
          open={showNewFactDialog}
          fromHome={homeState}
          onClose={async (oopsieMessage = null) => {
            oopsieMessage && (enqueueSnackbar(oopsieMessage, { variant: 'error', persist: true }));
            setShowNewFactDialog(false);
            if (session?.url_parameters && ('activity' in session.url_parameters) && ('user' in session.url_parameters)) {
              let jumpTo = window.location.href.replace('theseus', 'thankyou').split('?')[0];
              jumpTo += `?user=${session.url_parameters.user}`;
              window.location.replace(jumpTo);
            }
            actionCancelled = true;
          }}
          onSave={onSaveFact}
          onNext={onNextFact}
          onSelected={(nextActivity) => {
            setLimit(limit);
            setShowNewFactDialog(false);
            selectedActivityName = '';
            onChooseActivity(nextActivity);
          }}
        />
      ) : null}

      {/* Some activities require review and confirmation before writing in Facts table */}
      {showConfirmation ?
        <Dialog
          open={showConfirmation}
          scroll='paper'
          fullWidth={true}
          aria-labelledby='scroll-dialog-title'
          aria-describedby='scroll-dialog-description'>
          <DialogTitle id='scroll-dialog-title' className={classes.descriptionText}>
            {selected ? selected.name : null}
          </DialogTitle>
          <DialogContent dividers={true} className={classes.descriptionText}>
            {newFact?.value?.freeText
              ?
              Object.keys(newFact.value.freeText)
                .map(selectedValue => (
                  !selectedValue.startsWith('%filter%')
                    ?
                    (
                      <React-Fragment key={`${selectedValue}_frag1`}>
                        <Box display='flex' flexGrow={1} key={`${selectedValue}_f`} flexWrap='wrap' flexDirection='row' justifyContent='flex-start'>
                          <Typography style={{ fontWeight: 'bold' }} key={`${selectedValue}_t1`}>
                            {selectedValue}
                          </Typography>
                          <Typography key={`${selectedValue}_fsp`}>
                            <span>&nbsp;</span>
                          </Typography>
                          <Typography key={`${selectedValue}_t2`}>
                            {newFact.value.freeText[selectedValue].replace(/[~[\]]/g, '')}
                          </Typography>
                        </Box >
                      </React-Fragment>
                    )
                    :
                    null
                ))
              : null
            }
            {newFact?.value?.selected
              ?
              newFact.value.selected
                .map(selectedValue => (
                  !newFact.value.freeText?.[selectedValue]
                    ?
                    (
                      <React-Fragment key={`${selectedValue}_frag`}>
                        <Box display='flex' flexDirection='row' key={`${selectedValue}`} justifyContent='flex-start' alignItems='center'>
                          <Typography style={{ fontWeight: 'bold' }} key={`${selectedValue}_b`}>
                            {selectedValue.split(':')[0]}
                          </Typography>
                          <Typography key={`${selectedValue}_sp`}>
                            <span>&nbsp;&nbsp;</span>
                          </Typography>
                          <Typography key={`${selectedValue}_q`}>
                            {newFact.value.qualifiers?.hasOwnProperty(selectedValue)
                              ? newFact.value.qualifiers[selectedValue]
                                .map(x => { return x.replace(/~\[.*\]=/, ''); })
                                .join(' ~ ')
                              : ((selectedValue.split(':')[0].charAt(selectedValue.split(':')[0].length - 1) === '?') ? 'YES' : null)
                            }
                          </Typography>
                        </Box>
                      </React-Fragment>
                    )
                    : null
                ))
              : null
            }
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
        : null}
    </Paper>
  );
};
