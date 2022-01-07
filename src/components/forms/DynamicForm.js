import React from 'react';
import { Storage } from 'aws-amplify';
import { API, graphqlOperation } from 'aws-amplify';

import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';

import TextField from '@material-ui/core/TextField';

import TimePicker from 'react-time-picker';

import { isMobile } from 'react-device-detect';

import makeStyles from '@material-ui/core/styles/makeStyles';

import Checkbox from '@material-ui/core/Checkbox';

import NumberForm from './NumberForm';
import Number2Form from './Number2Form';
import FreeTextForm from './FreeTextForm';

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
import InputAdornment from '@material-ui/core/InputAdornment';
import IconButton from '@material-ui/core/IconButton';
import SearchIcon from '@material-ui/icons/Search';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import CallIcon from '@material-ui/icons/Call';
import EmailIcon from '@material-ui/icons/Email';
import TextSMSIcon from '@material-ui/icons/Textsms';

import { getPerson } from '../../graphql/queries';

import DialogContentText from '@material-ui/core/DialogContentText';

import Box from '@material-ui/core/Box';
import Avatar from '@material-ui/core/Avatar';
import FaceIcon from '@material-ui/icons/Face';

import VideoRecorder from 'react-video-recorder';
import ReactPlayer from 'react-player';

const useStyles = makeStyles(theme => ({
  formControl: {
    marginLeft: theme.spacing(3),
    width: '100%',
    minWidth: '100%',
  },
  inputText: {
    paddingRight: '45px',
  },
  clockText: {
    marginRight: '15px',
    marginLeft: 0,
    marginBottom: '5px',
    marginTop: '5px',
    paddingLeft: 0,
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
  defaultButton: {
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
    variant: 'outlined',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.6,
    // height: theme.typography.fontSize * 2.8,
  },
  messageInput: {
    marginLeft: 0,
    marginBottom: theme.spacing(10),
    paddingLeft: 0,
    paddingRight: 15,
    width: '95%',
    //    verticalAlign: 'middle',
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
    fontSize: theme.typography.fontSize * 0.4,
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
  qualDialog: {},
  qualTitle: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
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
  session,
  message,
  statusMessage,
  values,
  qualifierTable,
  defaultValue,
  qualCheckedParam,
  checkedParm,
  searchText,
  setMessage,
  setStatusMessage,
  observationKey,
  onError,
  onSave,
  onNext,
}) => {
  const [value, setValue] = React.useState(defaultValue || '');
  const [nums, setNums] = React.useState(['', '']);
  const [mOut, setMOut] = React.useState(message || 'enter something here');
  const [searchKey, setSearchKey] = React.useState(null);
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();

  const [formState, setFormState] = React.useState(1);
  //const [firstTime, setFirstTime] = React.useState(true);

  // const [qualifierTable, setQualifierTable] = React.useState({});
  //const [associationsTable, setAssociationsTable] = React.useState({});
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

  const [listValues, setListValues] = React.useState([]);

  const [qualChecked, setQualChecked] = React.useState(qualCheckedParam);
  // const [qualMessage, setQualMessage] = React.useState('');
  const [OGqualifiers, setOGQualifiers] = React.useState([]);

  const [freeText, setFreeText] = React.useState('');
  const [filterText, setFilterText] = React.useState('');

  var noToggle = false;
  var recordingStatus;

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


  const onChangeFreeTime = tableRow => event => {
    newFact.value.freeText[tableRow] = event;
    setNewFact(newFact);
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const onCheckEnter = event => {
    if (event.key === 'Enter') { handleFilterText(event.target.value); }
  };

  const onChangeFilterText = event => {
    setFilterText(event.target.value);
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const handleFilterText = keyValue => {
    if (filterText) {
      newFact.value.freeText['%filter%'] = filterText;
    }
    else if (keyValue) {
      newFact.value.freeText['%filter%'] = newFact.value.freeText[keyValue];
    }
    setNewFact(newFact);
    setSearchKey(newFact.value.freeText['%filter%']);
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
  };

  const handleQualSelected = value => async () => {
    setQMessage('');
    if (qualifierTable[value].qualifiers[0].startsWith('~people:')) {
      let person_id = qualifierTable[value].qualifiers[0].split(':')[1];
      let result = await API.graphql(
        graphqlOperation(getPerson, {
          person_id: person_id,
        })
      ).catch(error => {
        console.log(`Whoops! Something went wrong when fetching a patient by session: ${error.message}`);
      });
      qualifierTable[value].value = value;
      qualifierTable[value].qualifiers[0] = '~~' + result.data.getPerson.location;
      if (result?.data?.getPerson?.messaging?.email) { qualifierTable[value].qualifiers.push('~~e-Mail: ' + result.data.getPerson.messaging.email); };
      if (result?.data?.getPerson?.messaging?.sms) {
        let cleaned = ('' + result.data.getPerson.messaging.sms).replace(/\D/g, '');
        let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
        let phoneNumber = result.data.getPerson.messaging.sms;
        if (match) { phoneNumber = ['(', match[2], ') ', match[3], '-', match[4]].join(''); }
        qualifierTable[value].qualifiers.push('~~cell: ' + phoneNumber);
      };
      if (result?.data?.getPerson?.messaging?.voice) {
        let cleaned = ('' + result.data.getPerson.messaging.voice).replace(/\D/g, '');
        let match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
        let phoneNumber = result.data.getPerson.messaging.voice;
        if (match) { phoneNumber = ['(', match[2], ') ', match[3], '-', match[4]].join(''); }
        qualifierTable[value].qualifiers.push('~~home: ' + phoneNumber);
      };
      let response = await Storage.get('patients/' + person_id + '.jpg').catch(error => {
        console.log(`Whoops! Something went wrong getting picture from s3: ${error.message}`);
      });
      qualifierTable[value].qualifiers.push('~~Message:');
      qualifierTable[value].image_url = 'patients/' + person_id + '.jpg';
      setDialogImage(response);
      setPeopleMode(true);
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
      let search1 = null;
      if (searchKey) { search1 = searchKey.toLowerCase(); }
      let search2 = searchText.toLowerCase();
      let listDisplay;

      listDisplay = values.filter(word => {
        if (!filtering && word.includes('~%')) {
          filtering = true;
          return true;
        }
        let theValue = (
          ((!search2 || word.toLowerCase().includes(search2)) &&
            (!filtering || (search1 && word.toLowerCase().includes(search1)))));
        if (theValue) { return true; }
        theValue = (
          word.includes('~!') ||
          checked.some((checkItem) => { return checkItem.includes(word.split(':', 2)[1].split(':')[0] + ':'); })
        );
        return theValue;
      });

      setListValues(listDisplay);
    }
  }, [checked, formState, searchKey, searchText, values]);

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
      recordingStatus = 'none';
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
                  Key: 'public/documents/' + fName,
                  Body: fObj,
                  ACL: 'public-read-write',
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
      recordingStatus = 'none';
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
              isFlipped
              showReplayControls
              replayVideoAutoplayAndLoopOff
              onRecordingComplete={async (videoBlob) => {
                const pVideo = {
                  Bucket: 'theseus-medical-storage',
                  Key: newFact.activity_key.replace('.', '^').split('^')[1] + (recordingStatus !== 'stopped' ? '_partial' : '') + '.webm',
                  Body: videoBlob,
                  ACL: 'public-read-write',
                  ContentType: 'video/webm'
                };
                newFact.value.tag = freeText;
                newFact.value.mediaData = pVideo;
                if (recordingStatus !== 'stopped') {
                  recordingStatus = 'aborted';
                  //onSave();
                };
              }
              }
              onStopRecording={() => {
                recordingStatus = 'stopped';
              }}
              onStartRecording={() => { recordingStatus = 'started'; }}
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
            enqueueSnackbar(`I'm sorry... AVA can't play that video. (${err.target.error.message || 'Details not provided'})`, { variant: 'error' });
            await API
              .graphql(graphqlOperation(createPutFact, {
                input: {
                  patient_id: session.patient_id,
                  activity_key: 'error.videoPlayer',
                  status: new Date().toString(),
                  value: JSON.stringify(`Code=${err.target.error.code} Message=${err.target.error.message}`),
                  qualifier: [defaultValue, err?.target?.outerHTML],
                  session: {
                    user_id: session.user_id,
                    session_id: session.session_id
                  },
                }
              }))
              .catch(error => { console.log(error) });
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
              <Typography noWrap={true} className={classes.factTitle}>
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
      window.open(defaultValue, message);  // intentionally fall through to the message case
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
    default:
      let checkBoxOn = true;
      let suppressDisplay = false;
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

                  /* prompt for response...
                  /* ~other:<text>               | prompt for text response with <text>     | ~other:What is your name?                                */
                  /* ~time:<text>                | prompt for time response with <text>     | ~time:What time would you like your meal?                */
                  /* ~file:<folder_name>         | render "pick a file"                     | ~file:public/documents                                   */

                  /* special cases...
                  /* ~+<key>~<value>             | use value only when <key> is selected    | ~+Filet Mignon~~!How would you like your filet cooked?      */

                  /* ~^<useTextBoxforThis>       | prompt with a multi-line box, show value |                                                           */
                  /*                             | in message area (just below the title)   |                                                           */

                  /* */

                  /* suppressing rows...
                  /* ~~! or ~! means "always show this line" */
                  /* ~% means suppress all lines after this one that do not include 
                      the freetext attached to this line 
                      (prompt for freeText with ~%other:<prompt text>) 
                  */

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

                  let [specialKey, freeTextFieldName] = value.split(':');
                  let specialHandling = false;
                  let header = false;
                  let showCheckBox = true;
                  let textPrompt = false;
                  let promptBox = false;
                  if (specialKey.charAt(0) === '~') {
                    showCheckBox = (specialKey === '~withCheckBox');
                    switch (specialKey.charAt(1)) {
                      case '~': { header = true; break; }
                      case '%': { specialHandling = true; break; }
                      default: {
                        if (showCheckBox || specialKey.includes('other')) {
                          textPrompt = true;
                          promptBox = specialKey.includes('^');
                        }
                        else {
                          specialHandling = true;
                        }
                      }
                    }
                  };

                  return (
                    <ListItem
                      id={'blockhead' + value}
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
                                    checkItem.split(':').pop() === value.split('~-')[0].split(':').pop()
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
                          {header && false &&
                            <ListItemText
                              id={'subhead' + value}
                              primary={
                                <Typography className={classes.factTitle}>
                                  {value.replace('!', '').substr(2)}
                                </Typography>
                              }
                            />
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
                              onClick={qualifierTable.hasOwnProperty(value) ? handleQualSelected(value) : null}
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
                              multiline={promptBox}
                              fullWidth
                              autoComplete='off'
                              value={newFact?.value?.freeText?.[freeTextFieldName] || ''}
                              onChange={onChangeFreeText}
                            />
                          }
                        </React.Fragment>
                        :
                        <React.Fragment key={`fragment-${value}-${vIndex.toString()}`}>
                          {value.includes('~%') &&  /* Prompt for filter */
                            <FormControl fullWidth className={classes.freeInput}>
                              <Input
                                id='%filter-input%'
                                type='text'
                                onChange={onChangeFilterText}
                                onKeyPress={onCheckEnter}
                                autoComplete='off'
                                placeholder={newFact?.value?.freeText?.[freeTextFieldName] || freeTextFieldName}
                                value={filterText}
                                endAdornment={
                                  <InputAdornment position='end'>
                                    <IconButton id={'testthis'} aria-label='trigger-filter-action' onClick={() => { handleFilterText(freeTextFieldName); }} >
                                      <SearchIcon />
                                    </IconButton>
                                  </InputAdornment>
                                }
                              />
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
                                };
                                newFact.value.tag = freeText || oName;
                                newFact.value.mediaData = pFile;
                              }
                              }
                            />
                          }
                          {value.startsWith('~time:') && /* Time prompt */
                            <Box
                              flexDirection='row'
                              display='flex'
                              grow={1}
                              justifyContent='flex-start'
                              alignItems='baseline'>
                              <Typography variant={'body2'} className={classes.clockText}>
                                {freeTextFieldName}
                              </Typography>
                              <TimePicker
                                value={newFact?.value?.freeText?.[freeTextFieldName] || '0:00'} clearIcon={null}
                                clockIcon={null}
                                // className={classes.freeInput}
                                className={classes.clockInput}
                                disableClock={true}
                                onChange={onChangeFreeTime(freeTextFieldName)}
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
          <Dialog
            open={qualifierOpen}
            className={classes.qualDialog}
            fullWidth
            aria-labelledby='qualifier-dialog'>
            <Box display='flex' flexDirection='row' width='95%'>
              <Box display='flex' flexDirection='column' width='95%'>
                <Typography className={classes.qualTitle} noWrap={true}>
                  {qualifierData.value ? qualifierData.value.split(':')[0] : null}
                </Typography>
                {qualifierData.description ? (
                  <DialogContentText className={classes.qualDescription}>{qualifierData.description}</DialogContentText>
                ) : null}
                {qualChecked?.[selectedFact]?.length > 0 ? (
                  <DialogContentText className={classes.qualSubDescription}>
                    You selected: {qualChecked[selectedFact].map(x => { return x.replace('~other:', '').replace(/~\[.*\]=/, ''); }).join(' ~ ')}
                  </DialogContentText>
                ) : null}
                <DialogContent pt={0}>
                  <FormControl fullWidth>
                    <FormGroup value={value} id='qvalue-label' name='value' open={qualifierOpen}>
                      <List>
                        {qualifiers
                          ? qualifiers.map((qualifier, qIndex) =>
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
                                    variant='standard'
                                    autoComplete='off'
                                    onChange={onChangeQMessage}
                                  //InputProps={{ marginLeft: '2', marginTop: '2' }}
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
                                      checked={qualChecked && qualChecked[selectedFact].indexOf(qualifier) !== -1}
                                      name={qualifier}
                                      disableRipple
                                      inputProps={{ 'aria-labelledby': `qlabel-${qualifier}` }}
                                    /> : null}
                                  {!qualifier.startsWith('~other') ?
                                    (
                                      <ListItemText
                                        id={`qlabelid-${qualifier}`}
                                        primary={<Typography noWrap={true}>{qualifier.replace(/~\[.*\]=/, '')}</Typography>}
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
                                        // InputLabelProps={{ shrink: true }}
                                        // InputProps={{ marginLeft: '2' }}
                                        fullWidth
                                      />
                                    )}
                                </React.Fragment>
                              </ListItem>
                            )
                          )
                          : null}
                      </List>
                    </FormGroup>
                  </FormControl>
                </DialogContent>

              </Box>
              {qualifierData.image_url ? (
                <Avatar src={qualifierImage} className={classes.picture}>
                  <FaceIcon className={classes.picture} />
                </Avatar>
              ) : null}
            </Box>
            <DialogActions>
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
                  {peopleMode ? 'Send Msg' : 'Save'}
                </Button>
                : null}
            </DialogActions>

          </Dialog>
        </React.Fragment >
      );
  }
};
