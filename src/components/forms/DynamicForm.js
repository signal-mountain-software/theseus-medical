import React from 'react';
import { Storage } from 'aws-amplify';
import { API, graphqlOperation } from 'aws-amplify';

import { updateSession } from '../../graphql/mutations';
import { SET_PATIENT, SET_SESSION } from '../../contexts/Session/actions';
import useSession from '../../hooks/useSession';

import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';

import SwapHorizIcon from '@material-ui/icons/SwapHoriz';

import NewCalendarEvent from '../dialogs/NewCalendarEvent';
import MessageForm from '../forms/MessageForm';
import ObservationForm from '../forms/ObservationForm';
import MultiObservationForm from '../forms/MultiObservationForm';
import RequestDashboard from '../dialogs/RequestDashboard';
import CalendarDashboard from '../dialogs/CalendarDashboard';
import ShowCalendar from '../dialogs/ShowCalendar';
import ShowMenu from '../dialogs/ShowMenu';
import ShowEventActivity from '../dialogs/ShowEventActivity';
import LoadWorkOrderSpreadsheet from '../forms/LoadWorkOrderSpreadsheet';
import ShowGroup from '../dialogs/ShowGroup';

import TextField from '@material-ui/core/TextField';

import { isMobile } from 'react-device-detect';

import makeStyles from '@material-ui/core/styles/makeStyles';

import Checkbox from '@material-ui/core/Checkbox';

import NumberForm from './NumberForm';
import Number2Form from './Number2Form';
import FreeTextForm from './FreeTextForm';
import MakeMessage from './MakeMessage';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';

import DialogContent from '@material-ui/core/DialogContent';

import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';

import { createPutFact } from '../../graphql/mutations';
import { useSnackbar } from 'notistack';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';

import Input from '@material-ui/core/Input';
import IconButton from '@material-ui/core/IconButton';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import CallIcon from '@material-ui/icons/Call';
import EmailIcon from '@material-ui/icons/Email';
import TextSMSIcon from '@material-ui/icons/Textsms';

import { getSession, getPerson } from '../../graphql/queries';

import Box from '@material-ui/core/Box';

import VideoRecorder from 'react-video-recorder';
import ReactPlayer from 'react-player';
import DynamicSignup from './DynamicSignup';

const useStyles = makeStyles(theme => ({
  formControl: {
    marginLeft: theme.spacing(3),
    width: '100%',
    minWidth: '100%',
  },
  inputText: {
    paddingRight: '45px',
    marginTop: 0,
  },
  clockText: {
    marginRight: '15px',
    marginLeft: 0,
    marginBottom: '5px',
    marginTop: '5px',
    paddingLeft: 0,
    verticalAlign: 'middle'
  },
  personText: {
    marginRight: '15px',
    marginLeft: '15px',
    marginBottom: '5px',
    marginTop: '5px',
    paddingLeft: '15px',
    verticalAlign: 'middle'
  },
  leftButton: {
    minWidth: '30px',
  },
  listItemAVA: {
    maxWidth: 'max-content',
    marginRight: '7px'
  },
  idText: {
    display: 'inline',
    marginLeft: '25px'
  },
  subHeader: {
    fontWeight: 'bold',
    minWidth: '100%',
  },
  subHeaderPlus: {
    fontWeight: 'bold',
    minWidth: '100%',
    marginTop: '15px',
  },
  defaultButton: {
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
    variant: 'outlined',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.6,
    // height: theme.typography.fontSize * 2.8,
  },
  defaultButtonTight: {
    marginLeft: 3,
    paddingLeft: 3,
    paddingRight: 1,
    paddingBottom: '1px',
    paddingTop: '1px',
    marginTop: '1px',
    marginBottom: '1px',
    variant: 'outlined',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.6,
    // height: theme.typography.fontSize * 2.8,
  },
  lastName: {
    fontSize: theme.typography.fontSize * 2.0,
    fontWeight: 'bold'
  },
  firstName: {
    fontSize: theme.typography.fontSize * 1.7,
  },
  messageInput: {
    marginLeft: 0,
    marginBottom: theme.spacing(10),
    paddingLeft: 0,
    paddingRight: 15,
    width: '95%',
    fontSize: theme.typography.fontSize * 0.4,
    height: theme.typography.fontSize * 2.8,
  },
  freeInput: {
    marginLeft: 0,
    marginBottom: '10px',
    paddingLeft: 0,
    paddingRight: 0,
    //width: '95%',
    verticalAlign: 'middle',
    // fontSize: theme.typography.fontSize * 0.4,
    minHeight: theme.typography.fontSize * 2.8,
  },
  clockBox: {
    marginLeft: 0,
    marginBottom: 0,
    marginTop: '5px',
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: 0,
    width: '95%',
    justifyContent: 'center',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    height: theme.typography.fontSize * 2.8,
  },
  clockInput: {
    marginLeft: 10,
    marginTop: '10px',
    marginBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    width: '25%',
    fontSize: theme.typography.fontSize,
    verticalAlign: 'middle',
  },
  valueLine: {
    marginBottom: 0,
    marginTop: 0,
    paddingBottom: 0,
    lineHeight: 1,
    minWidth: '50%',
    width: '95%',
    height: theme.typography.fontSize * 25,
  },
  qualDialog: {
    minWidth: '90%'
  },
  qualTitle: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(0),
    marginRight: theme.spacing(0),
    marginBottom: 0,
    fontSize: '1.0rem',
    fontWeight: 'bold',
  },
  factTitle: {
    fontSize: '1.2rem',
    marginTop: theme.spacing(1.5),
    marginLeft: 0,
    paddingLeft: 0,
    fontWeight: 'fontWeightBold',
  },
  qualDescription: {
    marginLeft: theme.spacing(4),
    marginTop: 0,
    marginBottom: 0,
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },
  qualSubDescription: {
    marginLeft: theme.spacing(4),
    marginTop: theme.spacing(1),
    marginBottom: 0,
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },
  picture: {
    marginTop: theme.spacing(3),
    width: theme.spacing(16),
    height: theme.spacing(16),
    [theme.breakpoints.down('xs')]: {
      width: theme.spacing(8),
      height: theme.spacing(8),
    },
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
}));

export default ({
  open,
  newFact,
  setNewFact,
  type,
  factName,
  session,
  message,
  statusMessage,
  values,
  qualifierTable,
  defaultValue,
  qualCheckedParam,
  checkedParm,
  searchTextFromParent,   // not used
  setMessage,
  setStatusMessage,
  observationKey,
  onError,
  onSave,
  onClose,
}) => {

  const { dispatch } = useSession();

  const [value, setValue] = React.useState(defaultValue || '');
  const [nums, setNums] = React.useState(['', '']);
  const [mOut, setMOut] = React.useState(message || 'enter something here');
  const [filterPromptValue, setfilterPromptValue] = React.useState(null);
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();

  const [formState, setFormState] = React.useState(1);
  const [qualifiers, setQualifiers] = React.useState([]);
  const [selectedFact, setSelectedFact] = React.useState('');

  const [qualifierImage, setDialogImage] = React.useState('');
  const [checked, setChecked] = React.useState(checkedParm);
  const [qualifierOpen, setQualifierOpen] = React.useState(false);
  const [qualifierData, setQualifierData] = React.useState({});
  const [qMessage, setQMessage] = React.useState('');
  const [OGmessage, setOGmessage] = React.useState('');
  const [OGvalue, setOGvalue] = React.useState('');

  const [peopleMode, setPeopleMode] = React.useState(false);
  const [saveMode, setSaveMode] = React.useState(false);
  const [switchMode, setSwitchMode] = React.useState(false);
  const [groupChange, setGroupChange] = React.useState(false);
  const [chosenPerson, setChosenPerson] = React.useState('');

  const [listValues, setListValues] = React.useState([]);

  const [qualChecked, setQualChecked] = React.useState(qualCheckedParam);
  const [groupChecked, setGroupChecked] = React.useState({});
  const [OGqualifiers, setOGQualifiers] = React.useState([]);

  const [personRowLimit, setPersonRowLimit] = React.useState(100);

  const [freeText, setFreeText] = React.useState('');
  const [filterText, setFilterText] = React.useState('');
  const [getSessionResult, setSessionResult] = React.useState({});

  var noToggle = false;

  var groupsManaged = [];
  if (session.groups_managed) {
    if (Array.isArray(session.groups_managed)) {
      groupsManaged = session.groups_managed;
    }
    else {
      groupsManaged = session.groups_managed.replace(/\[|\]/g, '').split(/\s?,\s?/);
    }
  }

  const classes = useStyles();

  if (OGmessage === '') {
    setOGmessage(message);
  }

  if (OGvalue === '' && type === 'document') {
    setOGvalue(value);
  }

  const onChangeFreeName = event => {
    let slotIndex = event.target.id.substr(event.target.id.indexOf('#') + 1);
    newFact.value.slot[slotIndex].display_name = event.target.value;
    newFact.value.slot[slotIndex].action = 'set name to ' + event.target.value;
    setNewFact(newFact);
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const handleReserve = slotIndex => () => {
    if (newFact.value.slot[slotIndex].owner !== null) {
      newFact.value.slot[slotIndex].owner = null;
      newFact.value.slot[slotIndex].display_name = null;
      newFact.value.slot[slotIndex].action = 'relinquished.' + newFact.value.version;
    } else {
      newFact.value.slot[slotIndex].owner = newFact.patient_id;
      newFact.value.slot[slotIndex].display_name = session.patient_display_name;
      newFact.value.slot[slotIndex].action = 'reserved.' + newFact.value.version;
    }
    setNewFact(newFact);
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const handleToggle = value => () => {
    // noToggle ignores the whole function code (used when handleToggle is fired by the OS)
    if (!noToggle) {
      closeSnackbar();   // close any persistent snackbars on the screen

      let checkedItems = value.split('~-');
      let item2Check = checkedItems[0];
      const currentIndex = checked.indexOf(item2Check);
      const newChecked = [...checked];

      if (currentIndex === -1) {
        newChecked.push(item2Check);
        if (checkedItems.length > 1) {
          for (let i = 1; i < checkedItems.length; i++) {
            let inverse = true;
            if (checkedItems[i].substr(0, 1) === '-') {
              inverse = false;
              checkedItems[i] = checkedItems[i].substr(1);
            }
            // key in value was just checked ON; 
            //    if this checkedItems[i] was a '~-' then it must turn OFF
            //    if this checkedItems[i] was a '~--' then it must turn ON
            let foundAt = checked.indexOf(checkedItems[i]);
            if (foundAt !== -1 && inverse) {    // was previously checked and inverse is on...  remove it
              newChecked.splice(foundAt, 1);
            }
            else if (foundAt === -1 && !inverse) {    // was NOT previously checked and identical is on (inverse off)...  add it
              newChecked.push(checkedItems[i].replace('-', ''));
            }
          }
        }
      } else {
        newChecked.splice(currentIndex, 1); /* this removes the check mark */
        if (checkedItems.length > 1) {
          for (let i = 1; i < checkedItems.length; i++) {
            let inverse = true;
            if (checkedItems[i].substr(0, 1) === '-') {
              inverse = false;
              checkedItems[i] = checkedItems[i].substr(1);
            }
            // key in value was just turned OFF; 
            //    if this checkedItems[i] was a '~-' then it must turn ON
            //    if this checkedItems[i] was a '~--' then it must turn OFF
            let foundAt = checked.indexOf(checkedItems[i]);
            if (foundAt !== -1 && !inverse) {
              newChecked.splice(foundAt, 1);
            }
            else if (foundAt === -1 && inverse) {
              newChecked.push(checkedItems[i]);
            }
          }
        }
      }
      setChecked(newChecked);
      if (newChecked.length > 0) {
        let stopAt = newChecked.length - 1;
        let sMess = 'You selected: ';
        newChecked.forEach((entry, index) => {
          sMess += entry.split(':')[0] + (index < stopAt ? ' ~ ' : '');
        });
        setStatusMessage(sMess);
      }

      if (!newFact.value.hasOwnProperty('selected')) {
        newFact.value.selected = {};
      }
      newFact.value.selected = newChecked;
      setNewFact(newFact);
    } else {
      noToggle = false;
    }
  };

  const onChangeFreeText = event => {
    newFact.value.freeText[event.target.id] = event.target.value;
    setNewFact(newFact);
    if (event.target.value.length > 0) {
      if (!checked.includes(event.target.id)) { checked.push(event.target.id); }
    }
    else {
      let itsAt = checked.indexOf(event.target.id);
      if (itsAt > -1) { checked.splice(itsAt, 1); }
    }
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const onChangeFreeDate = event => {
    newFact.value.freeText[event.target.id] = event.target.value;
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const handleDateExit = event => {
    if (event.key === 'Enter' || event.type === 'blur') {
      let goodDate = new Date(event.target.value);
      if (isNaN(goodDate)) {
        let tNext = event.target.value.trim().toLowerCase().startsWith('next');
        if (tNext) {
          let dayWord = event.target.value.split(' ')[1].trim();
          event.target.value = dayWord;
        }
        let tDate = event.target.value.substr(0, 3).toLowerCase();
        let dOfw = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(tDate);
        goodDate = new Date(Date.now());
        if (dOfw > -1) {
          if ((goodDate.getDay() > dOfw) && tNext) {
            tNext = false;
          }
          goodDate.setDate(goodDate.getDate() + ((7 - (goodDate.getDay() - dOfw)) % 7) + (tNext ? 7 : 0));
        }
        else if (tDate === 'tom') {
          goodDate.setDate(goodDate.getDate() + 1);
        }
        else if (tDate !== 'tod') {
          goodDate = new Date(event.target.value);
        }
      }
      let current = new Date(Date.now());
      current.setHours(0, 0, 0, 0);
      if (goodDate < current) {
        let yyyy = current.getFullYear();
        goodDate.setFullYear(yyyy);
        if (goodDate < current) { goodDate.setFullYear(yyyy + 1); }
      };
      newFact.value.freeText[event.target.id] = goodDate.toDateString();
      var resetter = formState + 1;
      setFormState(resetter);
      setNewFact(newFact);
    }
  };

  const onChangeFreeTime = event => {
    newFact.value.freeText[event.target.id] = event.target.value;
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const handleTimeExit = event => {
    if (event.key === 'Enter' || event.type === 'blur') {
      let ampm = null;
      if (event.target.value.includes('p')) { ampm = 'pm'; }
      else if (event.target.value.includes('a')) { ampm = 'am'; };
      let [hh$, mm$] = event.target.value.split(':');
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
      newFact.value.freeText[event.target.id] = `${hh}:${mm < 10 ? ('0' + mm) : mm} ${ampm}`;
      var resetter = formState + 1;
      setFormState(resetter);
      setNewFact(newFact);
    }
  };

  const onCheckEnter = event => {
    if (event.key === 'Enter') { handleFilterText(event.target.value); }
  };

  const onChangeFilterText = event => {
    setFilterText(event.target.value);
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const handleFilterText = async (keyValue) => {
    // An activity value that starts with the code "~%" is treated as a filter
    // A filter is used to supress the display of subsequent values
    // filterText is updated on every change in the value typed in to "~%" filter line
    if (filterText) {
      newFact.value.freeText['%filter%'] = filterText;
    }
    // if filterText is empty, then nothing has been typed into the filter field at all
    // This code checks to see if we had preserved the value of the filter from a previous call
    else if (keyValue) {
      newFact.value.freeText['%filter%'] = newFact.value.freeText[keyValue];
    }
    setNewFact(newFact);
    if (newFact.value.freeText['%filter%']?.length > 0) {
      setfilterPromptValue(newFact.value.freeText['%filter%']);
    }
    else {
      setfilterPromptValue(null);
    }
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const onChangeQualText = event => {
    setFreeText(event.target.value);
  };

  const onChangeQMessage = event => {
    setQMessage(event.target.value);
    setSaveMode(true);
  };

  const handleQClose = event => {
    setQualChecked(OGqualifiers);
    setOGQualifiers('');
    setQualifierOpen(false);
  };

  const handleSendMessage = async (messageToSend, selectedQualifier) => {
    let [recipient,] = selectedQualifier.split(':');
    await API
      .graphql(graphqlOperation(createPutFact, {
        input: {
          patient_id: session.patient_id,
          activity_key: 'form.send_message',
          status: new Date().toString(),
          value: `form.selections.${selectedQualifier} ~ MessageText = ${messageToSend}`,
          qualifier: [],
          session: {
            user_id: session.patient_id,
            session_id: session.session_id
          },
        }
      }))
      .catch(error => {
        enqueueSnackbar(`AVA had a problem sending a Message to ${recipient}.  (${JSON.stringify(error)})`, { variant: 'error' });
      })
      .then(message => {
        enqueueSnackbar(`AVA Message sent to ${recipient}`, { variant: 'success' });
      });
  };

  const handleGroupChange = async (groupObject) => {
    await API
      .graphql(graphqlOperation(createPutFact, {
        input: {
          patient_id: chosenPerson,
          activity_key: 'action.updatePersonGroups',
          status: new Date().toString(),
          value: `newGroups.${Object.keys(groupObject).join(' ~ ')}`,
          qualifier: [],
          session: {
            user_id: session.patient_id,
            session_id: session.session_id
          },
        }
      }))
      .catch(error => {
        enqueueSnackbar(`Ooops! AVA could not update the groups.  (${error.message || error.errors[0].message})`, { variant: 'error' });
      })
      .then(message => {
        enqueueSnackbar(`Groups updated!`, { variant: 'success' });
      });
  };

  const handleSwitch = async (parmSelected) => {
    if (session && parmSelected) {
      let newPatient = {
        patient_id: parmSelected.user_id,
        patient_display_name: parmSelected.user_display_name
      };
      const result1 = await API.graphql(
        graphqlOperation(updateSession, { input: { session_id: session.user_id, ...newPatient } })
      ).catch(error => {
        enqueueSnackbar(`Whoops! Something went wrong when fetching a session: ${error.errors[0].message}`, {
          variant: 'error',
        });
      });

      const result2 = await API.graphql(
        graphqlOperation(getPerson, {
          person_id: parmSelected.user_id,
        })
      ).catch(error => {
        enqueueSnackbar(`Whoops! Something went wrong when fetching a patient by session: ${error.errors[0].message}`, {
          variant: 'error',
        });
      });

      dispatch({ type: SET_SESSION, payload: result1.data.updateSession });
      dispatch({ type: SET_PATIENT, payload: result2.data.getPerson });
      let jumpTo = window.location.href.replace('refresh', 'theseus');
      window.location.replace(jumpTo);
    }
  };

  const handleQSave = () => {
    if (!newFact.value.hasOwnProperty('qualifiers')) {
      newFact.value.qualifiers = {};
    }
    qualChecked[selectedFact].forEach((key, index) => {
      if (key.startsWith('~other')) {
        qualChecked[selectedFact][index] = freeText;
      }
    });
    newFact.value.qualifiers = qualChecked;
    if (qualChecked.hasOwnProperty(selectedFact) && qualChecked[selectedFact].length > 0) {
      if (!newFact.value.selected.includes(selectedFact)) {
        newFact.value.selected.push(selectedFact);
      }
    }
    setNewFact(newFact);
    setChecked(newFact.value.selected);
    if (qMessage) { handleSendMessage(qMessage, selectedFact); }
    setOGQualifiers('');
    setQualifierOpen(false);
    setSaveMode(false);

    if (groupChange) {
      handleGroupChange(groupChecked);
      setGroupChange(false);
    }

  };

  const handleQualSelected = value => async () => {
    setQMessage('');
    if (qualifierTable[value].qualifiers[0].startsWith('~people:')) {
      let respArray = [];
      if (session.responsible_for) {
        if (Array.isArray(session.responsible_for)) {
          respArray.push(...session.responsible_for);
        }
        else if (session.responsible_for.startsWith('[')) {
          respArray = session.responsible_for.replace(/[[\s\]]/g, '').split(',');
        }
        else {
          respArray.push(session.responsible_for);
        }
      }
      let person_id = qualifierTable[value].qualifiers[0].split(':')[1];
      let result = await API.graphql(
        graphqlOperation(getPerson, {
          person_id: person_id,
        })
      ).catch(error => {
        console.log(`Error accessing patient: ${error.message}`);
      });
      let gC = {};
      if (groupsManaged.length > 0) {
        result.data.getPerson.groups.forEach(g => {
          gC[g] = true;
          if (respArray.includes(g)) { setSwitchMode(true); }
        });
        if (
          respArray.includes(result.data.getPerson.person_id)
          || respArray.includes('*all')
          || session.kiosk_mode
        ) {
          setSwitchMode(true);
        }
      }
      setGroupChecked(gC);

      setSessionResult(await API
        .graphql(graphqlOperation(getSession, { session_id: person_id }))
        .catch(() => { }));
      qualifierTable[value].value = value;
      qualifierTable[value].qualifiers.length = 1;
      if (!result.data.getPerson.location) {
        qualifierTable[value].qualifiers.push('~~No Location given');
      }
      else {
        result.data.getPerson.location.split('~').forEach(locLine => {
          qualifierTable[value].qualifiers.push('~~' + locLine.trim());
        });
      }
      if (result?.data?.getPerson?.messaging?.email) {
        qualifierTable[value].qualifiers.push('~~e-Mail: ' + result.data.getPerson.messaging.email + (result.data.getPerson.preferred_method === 'email' ? '  - preferred' : ''));
      };
      if (result?.data?.getPerson?.messaging?.sms) {
        let cleaned = ('' + result.data.getPerson.messaging.sms).replace(/\D/g, '');
        let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
        let phoneNumber = result.data.getPerson.messaging.sms;
        if (match) { phoneNumber = ['(', match[2], ') ', match[3], '-', match[4]].join(''); }
        qualifierTable[value].qualifiers.push('~~cell: ' + phoneNumber + (result.data.getPerson.preferred_method === 'sms' ? '  - preferred' : ''));
      };
      if (result?.data?.getPerson?.messaging?.voice) {
        let cleaned = ('' + result.data.getPerson.messaging.voice).replace(/\D/g, '');
        let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
        let phoneNumber = result.data.getPerson.messaging.voice;
        if (match) { phoneNumber = ['(', match[2], ') ', match[3], '-', match[4]].join(''); }
        qualifierTable[value].qualifiers.push('~~home: ' + phoneNumber + (result.data.getPerson.preferred_method === 'voice' ? '  - preferred' : ''));
      };
      if (result?.data?.getPerson?.messaging?.office) {
        let cleaned = ('' + result.data.getPerson.messaging.office).replace(/\D/g, '');
        let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
        let phoneNumber = result.data.getPerson.messaging.office;
        if (match) { phoneNumber = ['(', match[2], ') ', match[3], '-', match[4]].join(''); }
        qualifierTable[value].qualifiers.push('~~work: ' + phoneNumber + (result.data.getPerson.preferred_method === 'office' ? '  - preferred' : ''));
      };

      let response = await Storage.get('patients/' + person_id + '.jpg').catch(error => {
        console.log(`Whoops! Something went wrong getting picture from s3: ${error.message}`);
      });
      qualifierTable[value].qualifiers.push('~~Message:');
      qualifierTable[value].image_url = 'patients/' + person_id + '.jpg';
      setDialogImage(response);
      setPeopleMode(true);
      setChosenPerson(person_id);
    }
    else {
      getImage((!(qualifierTable[value]?.image_url?.includes('/')) ? 'observation_images/' : '') + qualifierTable[value].image_url);
      setPeopleMode(false);
    }

    setQualifierData(qualifierTable[value]);
    let qualData = qualifierTable[value].qualifiers;
    setQualifiers(qualData);
    setSelectedFact(value);
    if (!qualChecked.hasOwnProperty(value)) {
      /* no selections previously made? */
      qualChecked[value] = [];
      setQualChecked(qualChecked);
    }
    setOGQualifiers(qualChecked);

    var resetter = formState + 1;
    setFormState(resetter);
    setQualifierOpen(true);
    noToggle = true;

  };

  const handleToggleQual = value => () => {
    const currentIndex = qualChecked[selectedFact].indexOf(value);
    const newChecked = [...qualChecked[selectedFact]];
    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }
    qualChecked[selectedFact] = newChecked;
    setQualChecked(qualChecked);
    var resetter = formState + 1;
    setFormState(resetter);
    setSaveMode(true);
    // if (newChecked.length === 0) {
    //   setQualMessage('');
    // } else {
    //   setQualMessage('Options: ' + newChecked.join(' ~ '));
    // }
  };

  const handleToggleGroup = value => () => {
    let checkFor = value.split('~')[0].trim();
    if (groupChecked.hasOwnProperty(checkFor)) { delete groupChecked[checkFor]; }
    else { groupChecked[checkFor] = true; }
    var resetter = formState + 1;
    setFormState(resetter);
    setSaveMode(true);
    setGroupChange(true);
  };

  const onChangeValue = event => {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    setNewFact(newFact);
  };

  const onChangeMessage = event => {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    setNewFact(newFact);
  };

  const onChangeNums = index => event => {
    const newNums = [...nums];
    newNums[index] = event.target.value;
    setNums(newNums);
    if (newNums[0] && newNums[1]) {
      newFact.value = observationKey + '.' + newNums.join(' over ');
    } else {
      newFact.value = 'number.partial';
    }
    setNewFact(newFact);
  };

  async function getImage(image_name) {
    if (image_name) {
      const response = await Storage.get(image_name);
      setDialogImage(response);
    } else {
      setDialogImage(null);
    }
  }

  const handleMore = () => {
    setPersonRowLimit(personRowLimit + 100);
  };

  React.useEffect(() => {
    if (open) {
      setMOut(message);
      setFormState(1);
    } else {
      setValue(defaultValue || '');
      setNums(['', '']);
      setMOut(message || 'Enter something here');
    }
  }, [message]);  // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (values) {
      let filtering = false;
      let searching = false;
      let searchTerms = [];
      if (filterPromptValue) {
        searchTerms = filterPromptValue
          .toLowerCase()
          .split(/\s+/g)
          .map(arrayElement => {
            if (session.search_terms?.hasOwnProperty(arrayElement)) {
              return session.search_terms[arrayElement];
            }
            if (/^\d+$/.test(arrayElement)) {       // all digits only
              if (arrayElement.length < 4) { return `-${arrayElement}`; }
              return arrayElement;
            }
            return arrayElement;
          });
        searching = (searchTerms.length > 0);
      };
      let listDisplay;
      let filteredCount = null;
      let spliceEmpty = false;

      listDisplay = values.filter(valuesListEntry => {
        if (!filtering) {
          if (valuesListEntry.includes('~%')) {
            filtering = true;
            filteredCount = 0;
          }
          else if (valuesListEntry === '~[filter=on]') {
            filtering = true;
            filteredCount = 1;
          }
          return true;
        }
        if (valuesListEntry === '~[filter=off]') {
          if (searching && (!filteredCount || (filteredCount === 0))) {
            spliceEmpty = true;
          }
          filtering = false;
          return true;
        }
        let lowerListEntry = valuesListEntry.toLowerCase();
        if (
          !searching ||
          searchTerms.every(searchTerm => {
            if (searchTerm.length === 1) { 
              return (lowerListEntry.startsWith(searchTerm) || lowerListEntry.includes(searchTerm + '-'));
            }
            return lowerListEntry.includes(searchTerm);
          })
        ) {
          filteredCount++;
          return true;
        }
        return (
          valuesListEntry.includes('~!') ||
          checked.includes(valuesListEntry) ||
          checked.some((checkItem) => { return checkItem.includes(valuesListEntry.replace(':', '%%').split('%%').pop().split(':')[0] + ':'); })
        );
      });

      if (spliceEmpty) {
        listDisplay.splice(listDisplay.indexOf('~[filter=off]'), 1,
          ...['~[checkbox=off]', 'No matching entries found', '~[checkbox=on]']);
      }

      setListValues(listDisplay);
    }
  }, [checked, filterPromptValue, searchTextFromParent, values, session.search_terms]);

  switch (type) {
     case 'characteristic_num':
      return (
        <NumberForm
          open={open}
          label='Number'
          value={value}
          message={mOut}
          onChange={onChangeValue}
          onError={onError}
        />
      );
    case 'upload_file':
      return (
        <FormControl fullWidth>
          <FormGroup value={newFact.value} id='value-label' name='values' open={formState > 0}>
            <br />
            <FreeTextForm
              open={true}
              label='Name your file'
              value={freeText}
              onChange={onChangeQualText}
              onError={onError}
            />
            <br />
            <input
              type="file"
              onChange={async (target) => {
                let fObj = target.target.files[0];
                let oName = fObj.name.toLowerCase().split('.');
                let oType = oName.pop();
                let fName = freeText ? (freeText + '.' + oType) : fObj.name;
                const pFile = {
                  Bucket: 'theseus-medical-storage',
                  Key: fName,
                  Body: fObj,
                  ACL: 'public-read-write',
                  ContentType: fObj.type,
                  Metadata: { 'Content-Type': fObj.type }
                };
                newFact.value.tag = freeText || oName;
                newFact.value.mediaData = pFile;
              }
              }
            />
          </FormGroup>
        </FormControl>
      );
    case 'record_video':
      var dateOptions = { month: 'short', day: 'numeric' };
      return (
        <FormControl fullWidth>
          <FormGroup value={newFact.value} id='value-label' name='values' open={formState > 0}>
            <br />
            {!freeText ?
              (defaultValue ?
                setFreeText(defaultValue + " - " + new Date().toLocaleDateString('en-US', dateOptions))
                :
                setFreeText((session.patient_display_name.split(',')[1] || session.patient_display_name.split(' ')[0]) + "'s video - "
                  + new Date().toLocaleDateString('en-US', dateOptions)))
              : null}
            <FreeTextForm
              open={true}
              label='Name your video'
              value={freeText}
              onChange={onChangeQualText}
              onError={onError}
            />
            <br />
            <VideoRecorder
              isOnInitially
              showReplayControls
              replayVideoAutoplayAndLoopOff={false}
              onRecordingComplete={async (videoBlob) => {
                const pVideo = {
                  Bucket: 'theseus-medical-storage',
                  Key: freeText.replace('.', '_') + '.webm',
                  Body: videoBlob,
                  ACL: 'public-read-write',
                  ContentType: 'video/webm'
                };
                newFact.value.tag = freeText;
                newFact.value.mediaData = pVideo;
                newFact.value.recordingStatus = 'stopped';
              }}
              onStartRecording={() => {
                newFact.value.recordingStatus = 'started';
              }}
            />
          </FormGroup>
        </FormControl>
      );
    case 'play_video':
      return (
        <ReactPlayer
          url={defaultValue}
          controls={true}
          width='100%'
          height='100%'
          playing={true}
          onError={async (err) => {
            console.log(err);
            let eValue = `error_value.Video error (user not notified) - err is ${JSON.stringify(err)}`;
            if (err?.target?.error?.message) {
              enqueueSnackbar(`I'm sorry... AVA can't play that video. (${err?.target?.error?.message || 'Details not provided'})`, { variant: 'error' });
              eValue = `error_value.File=${defaultValue} Code=${err?.target?.error?.code} Message=${err?.target?.error?.message}`;
              await API
                .graphql(graphqlOperation(createPutFact, {
                  input: {
                    patient_id: session.patient_id,
                    activity_key: 'error.videoPlayer',
                    status: new Date().toString(),
                    value: eValue,
                    qualifier: null,
                    session: {
                      user_id: session.user_id,
                      session_id: session.session_id
                    },
                  }
                }))
                .catch(error => { console.log(error); });
            }
          }}
        />
      );
    case 'show_image':
      return (
        <Box alignItems="center" justifyContent="center" width="1">
          <img src={defaultValue} width='100%'
            height='100%' alt="" />
        </Box>
      );
    case 'characteristic_num2':
      return (
        <Number2Form
          open={open}
          labelOne='Systolic'
          labelTwo='Diastolic'
          value={nums}
          message={mOut}
          onChange={onChangeNums}
          onError={onError}
        />
      );
    case 'reservation':
      var availableSlots = 0;
      newFact.value.slot.forEach((curVal) => { if (!curVal.owner) { availableSlots++; }; return; });
      var unownedSlotFound = false;
      return (
        <FormControl fullWidth>
          <FormGroup value={newFact.value} id='value-label' name='values' open={formState > 0}>
            <List className={classes.root}>
              <Typography noWrap={false} className={classes.factTitle}>
                {availableSlots > 0 ? "Choose any open check box to reserve your place!" : "I'm sorry, this event is full"}
              </Typography>
              {newFact.value.slot.flatMap((currentSlot, vX) => {
                if (!newFact?.value?.show_slots?.includes('first_available') || !unownedSlotFound) {
                  const labelId = `checkbox-list-label-${currentSlot.identifier}#${vX.toString()}`;
                  const owned = !!currentSlot.owner;
                  const ownedByMe = owned && (currentSlot.owner === newFact.patient_id || newFact.value.owner.includes(newFact.patient_id));
                  var slotValue =
                    currentSlot.identifier
                    ||
                    (owned ? '' :
                      (newFact?.value?.show_slots?.includes('first_available') ? availableSlots + ' ' : '')
                      + 'available - click to reserve');
                  var freeName = currentSlot.display_name;
                  if (!owned) {
                    unownedSlotFound = true;
                  };
                  if (newFact.value?.show_slots === 'no_names') { freeName = ''; }
                  else if (newFact.value?.show_slots === 'hide_names' && !ownedByMe) { freeName = 'taken'; }
                  return (
                    <ListItem key={'key-' + labelId} role={undefined} dense button>
                      <ListItemIcon classes={{ root: classes.leftButton }}>
                        {!owned || ownedByMe ? (
                          <Checkbox
                            edge='start'
                            onClick={handleReserve(vX)}
                            checked={owned}
                            tabIndex={-1}
                            disabled={owned && !ownedByMe}
                            disableRipple
                            inputProps={{ 'aria-labelledby': labelId }}
                          />
                        ) : null}
                      </ListItemIcon>
                      <ListItemText classes={{ root: classes.listItemAVA }} id={'id-' + labelId} primary={slotValue} />
                      <TextField
                        classes={{ root: classes.idText }}
                        id={'val-' + labelId}
                        value={freeName || ''}
                        disabled={!ownedByMe}
                        InputLabelProps={{ shrink: true }}
                        onChange={onChangeFreeName}
                      />
                    </ListItem>
                  );
                }
              })}
            </List>
          </FormGroup>
        </FormControl>
      );
    case 'document':
      let nowJ = new Date().getTime();
      window.open(`${defaultValue}?qt=${nowJ.toString()}`, message);  // intentionally fall through to the message case
    case 'message':
      return (
        <FreeTextForm
          open={open}
          label='Message'
          value={(OGvalue !== value && type === 'document') ? OGvalue : value}
          message={mOut}
          onChange={onChangeMessage}
          onError={onError}
        />
      );
    case 'message_list':
      return (
        <MessageForm
          pPerson={session.patient_id}
          pClient={session.client_id}
          pMessageList={[]}
          pSession={session}
          onReset={onSave}
          defaultValue={defaultValue}
        />
      );
    case 'make_message':
      let defaultValueObj;
      if (!defaultValue) { defaultValueObj = { recipientID: '*select' }; }
      else { defaultValueObj = JSON.parse(defaultValue); }
      return (
        <MakeMessage
          titleText={defaultValueObj.title}
          promptText={defaultValueObj.prompt || `What's the Message?`}
          buttonText={defaultValueObj.button || 'Send'}
          sender={session}
          pRecipientID={defaultValueObj.recipientID}
          pRecipientName={defaultValueObj.recipientName || `user ${defaultValueObj.recipientID}`}
          onCancel={onClose}
          onComplete={onClose}
          allowCancel={true}
        />
      );
    case 'observation_form':
      return (
        <ObservationForm
          fact={newFact}
          factName={factName}
          defaultValue={defaultValue}
          prompt={message}
          pClient={session.client_id}
          qualifiers={qualifierTable}
          listValues={values}
          onSave={(requestNumber, oSelected, fText, fQualifiers) => { 
            newFact.commonKey = requestNumber; 
            newFact.value.selected = oSelected; 
            newFact.value.freeText = fText;
            newFact.value.qualifiers = fQualifiers;
            newFact.status = 'confirmed';
            setNewFact(newFact);
            onSave();
          }}
          onClose={onClose}
        />
      );
    case 'multi_observation':
      return (
        <MultiObservationForm
          fact={newFact}
          factName={factName}
          defaultValue={defaultValue}
          prompt={message}
          pClient={session.client_id}
          qualifiers={qualifierTable}
          listValues={values}
          onSave={onSave}
          onClose={onClose}
        />
      );
    case 'request_dashboard': {
      let filter = { person_id: session.patient_id };
      if (newFact?.value?.freeText?.requestType) {
        filter = { request_type: newFact.value.freeText.requestType };
      }
      return (
        <RequestDashboard
          session={session}
          filter={filter}
          onClose={onClose}
        />
      );
    }
    case 'calendar_dashboard': {
      let filter = { person_id: session.patient_id };
      if (newFact?.value?.freeText?.requestType) {
        filter = { request_type: newFact.value.freeText.requestType };
      }
      return (
        <CalendarDashboard
          session={session}
          filter={filter}
          onClose={onClose}
        />
      );
    }
    case 'new_event':
      return (
        <NewCalendarEvent
          patient={session}
          peopleList={values}
          picture={null}
          showNewEvent={true}
          onClose={onSave}
        />
      );
    case 'new_appointment':
      return (
        <DynamicSignup
          patient={session}
          peopleList={values}
          picture={null}
          showNewEvent={true}
          onClose={onSave}
        />
      );
    case 'show_calendar':
    case 'add_calendar':
      let OGsession = {};
      Object.assign(OGsession, session);
      return (
        <ShowCalendar
          patient={session}
          OGpatient={OGsession}
          peopleList={values}
          currentEvent={defaultValue || []}
          eventClient={newFact.client_id || session.client_id}
          calendarMode={(type === 'show_calendar') ? 'view' : 'signUp'}
          onClose={onSave}
        />
      );
    case 'show_menu':
      return (
        <ShowMenu
          pClient={session.client_id}
          showMenu={true}
          onClose={onSave}
        />
      );
    case 'load_workorder_sheet':
      return (
        <LoadWorkOrderSpreadsheet
          pClient={session.client_id}
          showSheet={true}
          session={session}
          onClose={onSave}
        />
      );
    case 'show_event':
      return (
        <ShowEventActivity
          pSession={session}
          pEvent_id={defaultValue}
          pName={message}
          showList={true}
          onClose={onSave}
        />
      );
    case 'show_groups':
      return (
        <ShowGroup
          pSession={session}
          pGroup_id={defaultValue}
          pGroup_name={message}
          peopleList={values}
          showList={true}
          onClose={onSave}
        />
      );
    default:
      let checkBoxOn = true;
      let suppressDisplay = false;
      let requiredInput = false;
      let workingRowCount = 0;
      return (
        <React.Fragment key={`selection-panel`}>
          <FormControl fullWidth>
            <FormGroup value={value} id='value-label' name='value' open={formState > 0}>
              <List className={classes.valueLine}>
                {listValues.map((value, vIndex) => {
                  const labelId = `checkbox-list-label-${value}`;

                  /* value                       | meaning                                  | example                                                   */
                  /* ---------                   | ----------                               | -------------                                             */

                  /* headers...
                  /* ~~<displayThis>             | section header                           | ~~Entree Choices                                          */

                  /* check boxes...
                  /* <textOnly>                  | selection/check box                      | Filet Mignon                                              */
                  /*                             |                                          | Club Sandwich                                             */
                  /* <text>~-<key1>~--<key2>...  | ~- inverse (if text turns on, key1 turns | Deliver~-Pick-up                                          */
                  /*                             | off... and vice versa)
                  /*                             | ~-- identical (text turns on, key2 turns 
                  /*                             | on;  text turns off, key2 turns off)
                  /* ~[checkbox=off]             | Stop rendering check boxes, render value only
                  /* ~[checkbox=on]              | Begin rendering check boxes AND values
                  /* ~[display=off]              | Do not display anything until display=on is encountered
                  /* ~[display=on]               | Begin showing lines again
                  /* ~[required=on]              | Text fields between these tags must not be left blank
                  /* ~[required=off]             | Stop requiring entry in text fields

                  /* prompt for response...
                  /* ~other:<text>               | prompt for text response with <text>     | ~other:What is your name?                                */
                  /* ~time:<text>                | prompt for time response with <text>     | ~time:What time would you like your meal?                */
                  /* ~date:<text>                | prompt for date response with <text>     | ~date:What date would you like your meal?                */
                  /* ~file:<folder_name>         | render "pick a file"                     | ~file:public/documents                                   */

                  /* special cases...
                  /* ~+<key>~<value>             | use value only when <key> is selected    | ~+Filet Mignon~~!How would you like your filet cooked?      */

                  /* ~^<useTextBoxforThis>       | prompt with a multi-line box, show value |                                                           */
                  /*                             | in message area (just below the title)   |                                                           */

                  /* ~person:<person stuff>      | show avatar and person name              |                                                           */

                  /* */

                  /* suppressing rows...
                  /* ~~! or ~! means "always show this line" */
                  /* ~% means suppress all lines after this one that do not include
                      the freetext attached to this line 
                      (prompt for freeText with ~%other:<prompt text>) 
                  */
                  let [specialKey, freeTextFieldName] = value.split(':');

                  if (value.startsWith('~+')) {
                    let checkMe = value.substr(2).replace('~', '%%').split('%%');
                    if (checked.includes(checkMe[0]) || newFact?.value?.freeText?.[checkMe[0]]) {
                      value = checkMe[1];
                    }
                    else { return null; }
                  }

                  if (value === '~[checkbox=off]') { checkBoxOn = false; return null; }
                  else if (value === '~[checkbox=on]') { checkBoxOn = true; return null; }

                  if (value === '~[display=off]') { suppressDisplay = true; return null; }
                  else if (value === '~[display=on]') { suppressDisplay = false; return null; }

                  if (suppressDisplay) { return null; }

                  if (value === '~[required=on]') { requiredInput = true; return null; }
                  else if (value === '~[required=off]') { requiredInput = false; return null; }

                  let personID = '';
                  let specialHandling = false;
                  let personRow = false;
                  let header = false;
                  let showCheckBox = true;
                  let textPrompt = false;
                  if (specialKey.charAt(0) === '~') {
                    showCheckBox = (specialKey === '~withCheckBox');
                    switch (specialKey.charAt(1)) {
                      case '~': { header = true; break; }
                      case '%': { specialHandling = true; break; }
                      default: {
                        if (showCheckBox || specialKey.includes('other')) {
                          textPrompt = true;
                        }
                        else {
                          specialHandling = true;
                        }
                      }
                    }
                  }
                  else if (qualifierTable[value]?.qualifiers[0]?.startsWith('~people:')) {
                    personID = qualifierTable[value].qualifiers[0].substr(8);
                    specialHandling = true;
                    freeTextFieldName = specialKey;
                    personRow = true;
                    if (workingRowCount >= personRowLimit) {
                      if (workingRowCount === personRowLimit) {
                        workingRowCount++;
                        return (
                          <Button key='more_button' onClick={handleMore} className={classes.confirm} size='small' variant='contained'>
                            More?
                          </Button>
                        );
                      }
                      else { return null; }
                    }
                    else {
                      workingRowCount++;
                    }
                  }
                  else if (freeTextFieldName && freeTextFieldName.startsWith('group=')) {
                    specialHandling = true;
                    freeTextFieldName = specialKey;
                    personRow = true;
                    if (workingRowCount >= personRowLimit) {
                      if (workingRowCount === personRowLimit) {
                        workingRowCount++;
                        return (
                          <Button onClick={handleMore} className={classes.confirm} size='small' variant='contained'>
                            More?
                          </Button>
                        );
                      }
                      else { return null; }
                    }
                    else {
                      workingRowCount++;
                    }
                  };

                  return (
                    <ListItem
                      id={'blockhead' + value + vIndex.toString()}
                      key={value + vIndex.toString()}
                      role={undefined}
                      dense
                      //className={header ? classes.factTitle : classes.defaultButton}>
                      className={classes.defaultButton}>
                      {!specialHandling ?
                        <React.Fragment key={`fragment-${value}-${vIndex.toString()}`}>
                          {checkBoxOn && showCheckBox &&
                            <Checkbox
                              edge='start'
                              checked={
                                checked.some((checkItem) => {
                                  return (
                                    checkItem.split(':').pop().trim() === value.split('~-')[0].split(':').pop().trim()
                                  );
                                })
                              }
                              disableRipple
                              onClick={handleToggle(value)}
                              inputProps={{ 'aria-labelledby': labelId }}
                            />
                          }
                          {qualifierTable.hasOwnProperty(value) &&
                            <ListItemSecondaryAction>
                              <IconButton edge='end' aria-label='comments' onClick={handleQualSelected(value)}>
                                <InfoOutlinedIcon />
                              </IconButton>
                            </ListItemSecondaryAction>
                          }
                          {textPrompt ||
                            <ListItemText
                              id={labelId}
                              primary={
                                header ?
                                  <Typography className={classes.factTitle}>
                                    {value.replace('!', '').substr(2)}
                                  </Typography>
                                  :
                                  <Typography className={classes.inputText}>
                                    {value.split(/:(?!\d)/g)[0].split('~-')[0]}
                                  </Typography>
                              }
                              onClick={qualifierTable.hasOwnProperty(value) ? handleQualSelected(value) : (checkBoxOn && showCheckBox ? handleToggle(value) : null)}
                              secondary={
                                newFact?.value?.qualifiers?.[value] &&
                                newFact.value.qualifiers[value].map(x => { return x.replace('~other:', '').replace(/~\[.*\]=/, ''); }).join(' ~ ')
                              }
                            />
                          }
                          {textPrompt &&
                            <TextField
                              className={classes.freeInput}
                              id={freeTextFieldName}
                              label={freeTextFieldName}
                              variant={'standard'}
                              multiline
                              fullWidth
                            autoComplete='off'
                            required={requiredInput}
                              value={newFact?.value?.freeText?.[freeTextFieldName] || ''}
                              onChange={onChangeFreeText}
                            />
                          }
                        </React.Fragment>
                        :
                        <React.Fragment key={`fragment-${value}-${vIndex.toString()}`}>
                          {value.includes('~%') &&  /* Prompt for filter */
                            <FormControl fullWidth className={classes.freeInput}>
                              <Box display='flex' flexDirection='row'>
                                <Input
                                  id='%filter-input%'
                                  type='text'
                                  style={{ flexGrow: 1, marginRight: 5 }}
                                  onChange={onChangeFilterText}
                                  onKeyPress={onCheckEnter}
                                  autoComplete='off'
                                  placeholder={newFact?.value?.freeText?.[freeTextFieldName] || freeTextFieldName}
                                  value={filterText}
                                />
                                <Button
                                  color='primary'
                                  size='small'
                                  variant='contained'
                                  id={'testthis'}
                                  aria-label='trigger-filter-action'
                                  onClick={() => { handleFilterText(freeTextFieldName); }}>
                                  Search
                                </Button>
                              </Box>
                            </FormControl>
                          }
                          {value.startsWith('~file:') && /* File prompt */
                            <input
                              type="file"
                              onChange={async (target) => {
                                let fObj = target.target.files[0];
                                let oName = fObj.name.toLowerCase().split('.');
                                let oType = oName.pop();
                                let fName = freeText ? (freeText + '.' + oType) : fObj.name;
                                const pFile = {
                                  Bucket: 'theseus-medical-storage',
                                  Key: freeTextFieldName + fName,
                                  Body: fObj,
                                  ACL: 'public-read-write',
                                  ContentType: fObj.type,
                                  Metadata: {'Content-Type': fObj.type}
                                };
                                newFact.value.tag = freeText || oName;
                                newFact.value.mediaData = pFile;
                              }
                              }
                            />
                          }
                          {personRow && /* Show person avatar and info  */
                            <Box
                              display='flex'
                              marginTop={2}
                              minHeight={150}
                              flexDirection='row'
                              alignItems='center'
                            >
                              {checkBoxOn && showCheckBox &&
                                <Checkbox
                                  edge='start'
                                  checked={
                                    checked.some((checkItem) => {
                                      return (
                                        checkItem.split(':').pop().trim() === value.split('~-')[0].split(':').pop().trim()
                                      );
                                    })
                                  }
                                  disableRipple
                                  onClick={handleToggle(value)}
                                  inputProps={{ 'aria-labelledby': labelId }}
                                />
                              }
                              <Box
                                width={150}
                                display='flex'
                                flexDirection='row'
                                justifyContent={'center'}
                                onClick={handleQualSelected(value)}
                              >
                                <Box
                                  component="img"
                                  minWidth={150}
                                  maxWidth={150}
                                  alt='No photo available'
                                  src={personID ? `https://theseus-medical-storage.s3.amazonaws.com/public/patients/${personID}.jpg` : 'https://ava-icons.s3.amazonaws.com/icons8-family-50.png'}
                                />
                              </Box>
                              <Box
                                marginLeft={2}
                                display='flex'
                                flexDirection='column'
                                alignItems='flex-start'
                                justifyContent='center'
                                onClick={handleQualSelected(value)}
                              >
                                <Typography
                                  className={classes.lastName}
                                >
                                  {freeTextFieldName.split(',')[0].trim()}
                                </Typography>
                                <Typography
                                  className={classes.firstName}
                                >
                                  {freeTextFieldName.split(',')[1]?.trim()}
                                </Typography>
                              </Box>
                            </Box>
                          }
                          {value.startsWith('~date:') && /* Date prompt */
                            <Box
                              flexDirection='row'
                              display='flex'
                              width={'100%'}
                              justifyContent='flex-start'
                              alignItems='baseline'>
                              <TextField
                                className={classes.freeInput}
                                id={freeTextFieldName}
                                label={freeTextFieldName}
                                variant={'standard'}
                                fullWidth
                                autoComplete='off'
                                onKeyPress={handleDateExit}
                                onChange={onChangeFreeDate}
                                onBlur={handleDateExit}
                                value={newFact?.value?.freeText?.[freeTextFieldName] || ''}
                              />
                            </Box>
                          }
                          {value.startsWith('~time:') && /* Time prompt */
                            <Box
                              flexDirection='row'
                              display='flex'
                              grow={1}
                              width={'100%'}
                              justifyContent='flex-start'
                              alignItems='baseline'>
                              <TextField
                                className={classes.freeInput}
                                id={freeTextFieldName}
                                label={freeTextFieldName}
                                variant={'standard'}
                                fullWidth
                                autoComplete='off'
                                onKeyPress={handleTimeExit}
                                onChange={onChangeFreeTime}
                                onBlur={handleTimeExit}
                                value={newFact?.value?.freeText?.[freeTextFieldName] || ''}
                              />
                            </Box>
                          }
                        </React.Fragment>
                      }
                    </ListItem>
                  );
                })}
              </List>
            </FormGroup>
          </FormControl>
          {qualifierOpen &&
            <Dialog
              open={qualifierOpen}
              fullWidth
              scroll={'paper'}
              aria-labelledby='qualifier-dialog'>
              <Box
                display='flex'
                flexDirection='row'
                justifyContent='space-around'
                alignItems='center'
              >
                <Box display='flex' pt={3} flexDirection='column' justifyContent='center' alignItems='center'>
                  <Typography variant={'h5'} className={classes.lastName} noWrap={false}>
                    {qualifierData.value ? qualifierData.value.split(':')[0].split(',')[0].trim() : null}
                  </Typography>
                  <Typography className={classes.firstName} noWrap={false}>
                    {qualifierData.value ? qualifierData.value.split(':')[0].split(',')[1]?.trim() : null}
                  </Typography>
                  {qualifierData.description ? (
                    <Typography className={classes.qualDescription}>
                      {qualifierData.description}
                    </Typography>
                  )
                    : null}
                </Box>
                {qualifierData.image_url &&
                  <Box
                    marginTop={5}
                    component="img"
                    minWidth={120}
                    maxWidth={120}
                    alt='No photo available'
                    src={qualifierImage}
                  />
                }
              </Box>
              <DialogContent pt={0}>
                <FormControl fullWidth>
                  <FormGroup value={value} id='qvalue-label' name='value' open={qualifierOpen}>
                    <List>
                      {qualifiers
                        ? qualifiers.map((qualifier, qIndex) =>
                          !qualifier.startsWith('~people:') ? (
                            qualifier.startsWith('~~') ? (
                              <ListItem
                                key={value + qIndex.toString()}
                                role={undefined}
                                className={classes.defaultButton}
                              >
                                {qualifier.startsWith('~~e') ? (
                                  <IconButton
                                    edge='start'
                                    aria-label='action'
                                    href={`mailto:${qualifier.substr(9)}`}
                                  >
                                    <EmailIcon />
                                  </IconButton>
                                ) : null}
                                {isMobile && (qualifier.startsWith('~~c') || qualifier.startsWith('~~h')) ? (
                                  <IconButton
                                    edge='start'
                                    aria-label='action'
                                    href={`tel:${qualifier.substr(7)}`}
                                  >
                                    <CallIcon />
                                  </IconButton>
                                ) : null}
                                {isMobile && qualifier.startsWith('~~c') ? (
                                  <IconButton
                                    edge='start'
                                    aria-label='actionsms'
                                    href={`sms:${qualifier.substr(7)}&subject = Subject&body = ${qMessage}`}
                                  >
                                    <TextSMSIcon />
                                  </IconButton>
                                ) : null}
                                {qualifier === '~~Message:' ? (
                                  <TextField
                                    value={qMessage}
                                    id='PersonMessageText'
                                    label='Message'
                                    fullWidth
                                    multiline
                                    variant='standard'
                                    autoComplete='off'
                                    onChange={onChangeQMessage}
                                  />
                                ) : (
                                  <ListItemText
                                    id={'qhead' + value}
                                    classes={{ primary: classes.subHeader }}
                                    primary={qualifier.substr(2)}
                                  />)
                                }
                              </ListItem>
                            ) : (
                              <ListItem
                                key={qualifier + qIndex.toString()}
                                role={undefined}
                                dense
                                button
                                className={classes.defaultButton}
                                onClick={handleToggleQual(qualifier)}>
                                <React.Fragment key={`qfragment-${qualifier}-${qIndex.toString()}`}>
                                  {(!qualifier.startsWith('~[nocheck]=')) ?
                                    <Checkbox
                                      edge='start'
                                      key={`qlabel-${qualifier}`}
                                      checked={qualChecked && qualChecked[selectedFact].indexOf(qualifier) !== -1}
                                      name={qualifier}
                                      disableRipple
                                      inputProps={{ 'aria-labelledby': `qlabel-${qualifier}` }}
                                    /> : null}
                                  {!qualifier.startsWith('~other') ?
                                    (
                                      <ListItemText
                                        id={`qlabelid-${qualifier}`}
                                        key={`qlabelid-${qualifier}`}
                                        primary={<Typography noWrap={false}>{qualifier.replace(/~\[.*\]=/, '')}</Typography>}
                                      />
                                    )
                                    :
                                    (
                                      <TextField
                                        id={qualifier.split(':')[1] + '_in'}
                                        label={qualifier.split(':')[1]}
                                        variant='standard'
                                        value={freeText}
                                        onChange={onChangeQualText}
                                        fullWidth
                                      />
                                    )}
                                </React.Fragment>
                              </ListItem>
                            )
                          )
                            : null)
                        : null
                      }
                      {peopleMode && (groupsManaged?.length > 0) &&
                        <React.Fragment key={`session-panel`}>
                          <ListItem
                            key={`qhead-groupmanagement-textkey`}
                            className={classes.defaultButton}
                          >
                            <ListItemText
                              id={`qhead-groupmanagement-textid`}
                              key={`qhead-groupmanagement-textkey`}
                              classes={{ primary: classes.subHeaderPlus }}
                              primary='Groups'
                            />
                          </ListItem>
                          {groupsManaged.map((managedGroup, mx) =>
                            <ListItem
                              key={`mSection-${mx}-checkkeylistitem`}
                              role={undefined}
                              className={classes.defaultButtonTight}
                              onClick={handleToggleGroup(managedGroup)}
                            >
                              <Checkbox
                                edge='start'
                                checked={groupChecked.hasOwnProperty(managedGroup.split('~')[0].trim())}
                                name={managedGroup}
                                disableRipple
                                key={`mSection-${mx}-checkkey`}
                                id={`mSection-${mx}-checkid`}
                                inputProps={{ 'aria-labelledby': `qlabel-${managedGroup}-check` }}
                              />
                              <ListItemText
                                id={`mSection-${mx}-textid`}
                                key={`mSection-${mx}-textkey`}
                                primary={<Typography noWrap={false}>{managedGroup.split('~').pop().trim()}</Typography>}
                              />
                            </ListItem>
                          )}
                          <ListItem
                            key={`qhead-sessiondetails-header`}
                            className={classes.defaultButton}
                          >
                            <ListItemText
                              id={`qhead-sessiondetails-headertext`}
                              key={`qhead-sessiondetails-headertext`}
                              classes={{ primary: classes.subHeaderPlus }}
                              primary='AVA Usage'
                            />
                          </ListItem>
                          <ListItem
                            key={`qhead-sessiondetails-userid`}
                            className={classes.defaultButton}
                          >
                            <ListItemText
                              id={`qlabelid-userid`}
                              key={`qlabelid-userid`}
                              primary={<Typography noWrap={false}>User ID: {getSessionResult?.data?.getSession?.session_id || chosenPerson}</Typography>}
                            />
                          </ListItem>
                          <ListItem
                            key={`qhead-sessiondetails-platform`}
                            className={classes.defaultButton}
                          >
                            <ListItemText
                              id={`qlabelid-platform`}
                              key={`qlabelid-platform`}
                              primary={<Typography noWrap={false}>Platform: {getSessionResult?.data?.getSession?.platform}</Typography>}
                            />
                          </ListItem>
                          <ListItem
                            key={`qhead-sessiondetails-version`}
                            className={classes.defaultButton}
                          >
                            <ListItemText
                              id={`qlabelid-version`}
                              key={`qlabelid-version`}
                              primary={<Typography noWrap={false}>Last version: {getSessionResult?.data?.getSession?.status?.split(/=|~/)[1]}</Typography>}
                            />
                          </ListItem>
                          <ListItem
                            key={`qhead-sessiondetails-status`}
                            className={classes.defaultButton}
                          >
                            <ListItemText
                              id={`qlabelid-status`}
                              key={`qlabelid-status`}
                              primary={<Typography noWrap={false}>Last use: {getSessionResult?.data?.getSession?.status?.split(/=|~/).pop().replace(/GMT\S*/, '')}</Typography>}
                            />
                          </ListItem>
                          {getSessionResult?.data?.getSession?.password_change_date ?
                            <ListItem
                              key={`qhead-sessiondetails-pwdchange`}
                              className={classes.defaultButton}
                            >
                              <ListItemText
                                id={`qlabelid-status`}
                                key={`qlabelid-status`}
                                primary={<Typography noWrap={false}>Pwd change: {getSessionResult?.data?.getSession?.password_change_date?.split('GMT')[0]} (GMT)</Typography>}
                              />
                            </ListItem>
                            : null}
                        </React.Fragment>
                      }
                    </List>
                  </FormGroup>
                </FormControl>
              </DialogContent>
              <DialogActions style={{ justifyContent: 'center' }}>
                {(switchMode && getSessionResult?.data?.getSession) ?
                  <IconButton
                    onClick={() => { handleSwitch(getSessionResult.data.getSession); }}
                    variant='contained'
                    size='small'>
                    <SwapHorizIcon />
                  </IconButton>
                  : null}
                <Button onClick={handleQClose} className={classes.reject} size='small' variant='contained'>
                  Back
                </Button>
                {saveMode ?
                  <Button
                    onClick={handleQSave}
                    className={classes.confirm}
                    variant='contained'
                    color='primary'
                    size='small'>
                    {(peopleMode && qMessage) ? 'Send Msg' : 'Save'}
                  </Button>
                  : null}
              </DialogActions>
            </Dialog>
          }
        </React.Fragment >
      );
  }
};
