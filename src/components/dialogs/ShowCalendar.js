import React from 'react';

import { API, graphqlOperation } from 'aws-amplify';
import { Lambda } from 'aws-sdk';

import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Input from '@material-ui/core/Input';
import SearchIcon from '@material-ui/icons/Search';
import InputAdornment from '@material-ui/core/InputAdornment';

import CalendarForm from '../forms/CalendarForm';
import PersonFilter from '../forms/PersonFilter';
import CalendarEventEditForm from '../forms/CalendarEventEditForm';

import { getCalendar } from '../../graphql/queries';
import useMediaQuery from '@material-ui/core/useMediaQuery';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: 0,
    paddingTop: 0,
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

export default ({ patient, OGpatient, peopleList, currentEvent, showCalendar, onClose }) => {
  const [myCalendar, setMyCalendar] = React.useState([]);
  const [filterText, setFilterText] = React.useState('');
  const [myFilter, setMyFilter] = React.useState('');
  const [showPersonSelect, setShowPersonSelect] = React.useState(false);

  const [showAll, setShowAll] = React.useState(true);

  const [lastEndDate, setLastEndDate] = React.useState();

  const classes = useStyles();

  const [changes, setChanges] = React.useState(false);
  if (changes) { }

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
  if (isMobile) { }

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  const setCalendar = async () => {
    let invokeFailed = false;
    let rightNow = new Date();
    let this_year = rightNow.getFullYear();
    let this_month = rightNow.getMonth() + 1;
    let this_date = rightNow.getDate();
    let twoWeeksFromNow = new Date(rightNow.setDate(this_date + 14));
    let fortnight_year = twoWeeksFromNow.getFullYear();
    let fortnight_month = twoWeeksFromNow.getMonth() + 1;
    let fortnight_date = twoWeeksFromNow.getDate();

    if (currentEvent && currentEvent.length > 0) {
      params.Payload = JSON.stringify({
        action: "get_event",
        clientId: patient.adopted_client || patient.client_id,
        event_id: currentEvent,
        person_id: patient.patient_id
      });
      setShowAll(false);
    }
    else {
      params.Payload = JSON.stringify({
        action: "list_events",
        clientId: patient.adopted_client || patient.client_id,
        list_start: ((this_year * 10000) + (this_month * 100) + this_date).toString(),
        list_end: ((fortnight_year * 10000) + (fortnight_month * 100) + fortnight_date).toString(),
        person_id: patient.patient_id
      });
      setShowAll(true);
    }
    let fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log("AVA couldn't complete the query.  Error is", JSON.stringify(err));
        invokeFailed = true;
      });
    let theCalendar = [];
    if (!invokeFailed) {
      let fullResponse = JSON.parse(fResp.Payload);
      if (fullResponse.status === 200) {
        fullResponse.body.forEach(cEv => {
          theCalendar.push(cEv);
        });
      };
      setMyCalendar(theCalendar);
      setLastEndDate(twoWeeksFromNow);
      return theCalendar;
    };
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
            "clientId": patient.adopted_client || patient.client_id,
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

  const onCheckEnter = event => {
    if (event.key === 'Enter' || event.type === 'blur') {
      handleFilterText(event.target.value);
    }
  };

  const onChangeFilterText = event => {
    setFilterText(event.target.value);
    // var resetter = formState + 1;
    // setFormState(resetter);
  };

  const handleFilterText = event => {
    setMyFilter(filterText);
    // var resetter = formState + 1;
    // setFormState(resetter);
  };

  function formatDate(pDate$) {
    let pDate = pDate$.toString() || '19591021';
    let yyyy = pDate.substr(0, 4);
    let mm = pDate.substr(4, 2);
    let dd = pDate.substr(6, 2);
    let dDate = new Date(yyyy, Number(mm) - 1, dd);
    let rString = dDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return rString;
  }

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
      await setCalendar();
    }
    buildIt();
  }, [currentEvent]); // eslint-disable-line react-hooks/exhaustive-deps


  return (
    showAll ?
      <Dialog
        open={showCalendar}
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
              {(patient.kiosk_mode || !patient.patient_display_name) ? `Calendar of Events` : `${patient.patient_display_name.split(',').pop()}'s Calendar`}
            </DialogContentText>
            {(myCalendar.length > 0) ?
              <DialogContentText className={classes.subDescriptionText}>
                {formatDate(myCalendar[0].occData.date)} to {formatDate(myCalendar[myCalendar.length - 1].occData.date)}
              </DialogContentText>
              :
              <DialogContentText className={classes.subDescriptionText}>
                Building your Calendar
              </DialogContentText>
            }
          </Box>
          <Box mr={2}>
            <Input
              id='event_search'
              type='text'
              variant={'contained'}
              style={{ marginRight: 5 }}
              onKeyPress={onCheckEnter}
              onBlur={onCheckEnter}
              onChange={onChangeFilterText}
              label={'Search'}
              startAdornment={
                <InputAdornment position="start">
                  Search
                </InputAdornment>
              }
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label="search_icon"
                    onClick={() => { handleFilterText(filterText); }}
                    edge="end"
                  >
                    {<SearchIcon />}
                  </IconButton>
                </InputAdornment>
              }
              autoComplete='off'
              value={filterText}
            />
          </Box>
          {patient.kiosk_mode &&
            <Box mr={3} justifySelf={'flex-end'} alignSelf={'center'}>
              <Button className={classes.defaultButton} size='small' variant='contained' onClick={choosePerson}>
                {'Resident?'}
              </Button>
            </Box>
          }
        </Box>
        <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
          <CalendarForm
            myCalendar={myCalendar}
            person_id={patient.patient_id}
            kiosk_mode={patient.kiosk_mode}
            display_name={patient.patient_display_name}
            filter={myFilter}
            peopleList={peopleList}
          />
        </DialogContent>
        <DialogActions style={{ justifyContent: 'center' }}>
          {myCalendar && myCalendar.length > 0 &&
            <Button
              onClick={extendDates}
              variant='contained'
              size='small'
              className={classes.topButton}
            >
              {isMobile ? 'More' : 'Show more days'}
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
      :
      (
        (myCalendar.length > 0) ?
          <CalendarEventEditForm
            pEventCode={currentEvent}
            peopleList={peopleList}
            pPatient={patient.patient_id}
            pClient={patient.adopted_client || patient.client_id}
            pOccData={myCalendar[0].occData}
            pPatientRec={patient}
            onReset={() => { handleAbort(); }}
          />
          :
          <DialogContentText className={classes.subDescriptionText}>
            Getting your Event Info
          </DialogContentText>
      )
  );
};
