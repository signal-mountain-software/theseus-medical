import React from 'react';
import Cropper from "react-cropper";
import "cropperjs/dist/cropper.css";
import { API, graphqlOperation } from 'aws-amplify';
import { Lambda } from 'aws-sdk';
import { createPutFact, updateSession } from '../../graphql/mutations';
import { getSession, getPerson } from '../../graphql/queries';
import useSession from '../../hooks/useSession';

import { useSnackbar } from 'notistack';

import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';

import CircularProgress from '@material-ui/core/CircularProgress';

import ClientsSection from '../sections/ClientsSection';
import RelationshipSection from '../sections/RelationshipSection';
import LinkedAccountsSection from '../sections/LinkedAccountsSection';
import MessageRouting from '../sections/MessageRouting';

import useMediaQuery from '@material-ui/core/useMediaQuery';

const useStyles = makeStyles(theme => ({
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    flexGrow: 1
  },
  formControl: {
    margin: 0,
    paddingTop: 0,
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
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    alignSelf: 'center',
    verticalAlign: 'middle'
  },
  defaultButton: {
    alignSelf: 'end',
    variant: 'outlined',
    verticalAlign: 'end',
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
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioTextWithTopMargin: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: theme.spacing(1),
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  idText1: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  idText2: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 0,
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

export default ({ patient, picture, open, onClose }) => {
  const classes = useStyles();

  const [localData, setLocalData] = React.useState({});
  // const [firstName, setFirstName] = React.useState();
  // const [lastName, setLastName] = React.useState();
  // const [email, setEmail] = React.useState();
  // const [cell, setCell] = React.useState();
  const [groupMemberList, setGroupMemberList] = React.useState([]);
  // const [surrogate, setSurrogate] = React.useState();
  // const [searchTerm, setSearchTerm] = React.useState();
  // const [voice, setVoice] = React.useState();
  // const [location, setLocation] = React.useState();
  // const [inputPWD, setInputPWD] = React.useState();
  // const [prefMethod, setMethod] = React.useState();
  // const [directoryOption, setDirectoryOption] = React.useState();
  const [patientGroups, setPatientGroups] = React.useState();
  const [responsibleArray, setResponsibleArray] = React.useState();
  const [proxy, setProxy] = React.useState();
  // const [personRec, setPersonRec] = React.useState();

  const [refreshTrigger, setRefreshTrigger] = React.useState(false);

  const [patientPChange, setPatientPChange] = React.useState();
  const [patientSession, setPatientSession] = React.useState();
  const [sessionVersion, setSessionVersion] = React.useState(0);

  const [changes, setChanges] = React.useState(false);
  const [resettingPwd, setResettingPwd] = React.useState(false);
  const [pwdConfirmed, setPwdConfirmed] = React.useState(false);

  const [editPhoto, setEditPhoto] = React.useState('');
  const [cropper, setCropper] = React.useState();

  const { enqueueSnackbar } = useSnackbar();
  const { state } = useSession();

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const s3 = new AWS.S3({
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  function formatPhone(pNumber) {
    var match = '' + pNumber.replace(/\D/g, '').substr(-10);
    let formatted = '';
    if (match.length > 0) { formatted += '(' + match.substring(0, 3); }
    if (match.length > 3) { formatted += ') ' + match.substring(3, 6); }
    if (match.length > 6) { formatted += '-' + match.substring(6, 10); }
    return formatted;
  }

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  React.useEffect(() => {
    async function initialize() {
      if (patient) {
        let localPersonRec = await getPersonRec(patient.person_id);
        // setFirstName(patient.name.first);
        // setLastName(patient.name.last);
        // setCell(patient.messaging?.sms ? formatPhone(patient.messaging?.sms) : '');
        // setVoice(patient.messaging?.voice ? formatPhone(patient.messaging?.voice) : '');
        // setEmail(patient.messaging?.email || '');
        // setLocation(patient.location || '');
        // setSearchTerm(patient.search_data || '');
        // setInputPWD('password');
        // setMethod(patient.preferred_method);
        // setDirectoryOption(localPersonRec ? (localPersonRec.directory_option || 'normal') : 'normal');
        // if (isNaN(patient.messaging?.surrogate)) { setSurrogate(patient.messaging?.surrogate); }
        // else { setSurrogate(formatPhone('' + patient.messaging?.surrogate)); }
        let foundAt;
        let groupFound;
        if (Array.isArray(localPersonRec.clients)) {
          // patient.clients is an array...   each element is a single object with 
          //     key = client_id and 
          //     value = array of groups this patient is a member of in that client
          // First - find the array element that contains the object key (id) = current client (patient.client_id)
          groupFound = localPersonRec.clients.some((e, i) => {
            foundAt = i;
            return (e.id === localPersonRec.client_id);
          });
          if (groupFound) {
            // We found the right array element... load the React patientGroups value with
            //    an array of client, group entries as in 'SMSoft~AVT_residents'...   
            setPatientGroups(localPersonRec.clients[foundAt].groups.map(e => {
              return (`${localPersonRec.client_id}~${e}`);
            }));
            // Next, are there any entries in this array that represent a group that
            // belongs to another group?
          }
        }
        if (localPersonRec.relationships) {
          localPersonRec.relationships.forEach(async (relationship, index) => {
            let result = await API.graphql(
              graphqlOperation(getPerson, {
                person_id: relationship.person_id,
              })
            ).catch(error => {
              console.log(error);
            });
            if (result?.data) {
              localPersonRec.relationships[index].name = result.data.getPerson.name.first + ' ' + result.data.getPerson.name.last;
            }
            else {
              localPersonRec.relationships[index].name = null;
            }
          });
        }
        let targetSession = await getSessionData(patient.person_id);
        if (!groupMemberList || groupMemberList.length === 0) {
          await getGroupMemberList();
        }
        let workLocalData = {
          ready: true,
          firstName: localPersonRec.name.first,
          lastName: localPersonRec.name.last,
          email: (localPersonRec.messaging?.email || ''),
          cell: (localPersonRec.messaging?.sms ? formatPhone(localPersonRec.messaging?.sms) : ''),
          searchTerm: (localPersonRec.search_data || ''),
          voice: (localPersonRec.messaging?.voice ? formatPhone(localPersonRec.messaging?.voice) : ''),
          location: (localPersonRec.location || ''),
          inputPWD: (targetSession.last_login || 'password'),
          prefMethod: localPersonRec.preferred_method || 'AVA',
          directoryOption: (localPersonRec ? (localPersonRec.directory_option || 'normal') : 'normal'),
          patientGroups: (localPersonRec.clients[foundAt].groups.map(e => { return (`${localPersonRec.client_id}~${e}`); }))
        };
        if (isNaN(localPersonRec.messaging?.surrogate)) { workLocalData.surrogate = localPersonRec.messaging?.surrogate; }
        else { workLocalData.surrogate = (formatPhone('' + localPersonRec.messaging?.surrogate)); }
        setLocalData(workLocalData);
      }
    }
    initialize();
  }, [patient]);  // eslint-disable-line react-hooks/exhaustive-deps

  const getPersonRec = async (pPerson) => {
    let invokeFailed = false;

    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance';
    params.Payload = JSON.stringify({
      action: "get_person_details",
      clientId: patient.client_id,
      request: {
        "person_id": pPerson,
      }
    });
    let lambdaResponse = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let returnedPerson = JSON.parse(lambdaResponse.Payload);
      if (returnedPerson.status === 200 && returnedPerson.body.hasOwnProperty('person_id')) {
        // setPersonRec(returnedPerson.body);
        return returnedPerson.body;
      }
    };
    let templatePerson = {
      "person_id": pPerson,
      "location": "",
      "client_id": state.session.client_id,
      "search_data": "",
      "clients": [
        {
          "groups": [],
          "id": state.session.client_id
        }
      ],
      "name": {
        "last": "",
        "first": ""
      },
      "directory_option": "normal",
      "display_name": "",
      "groups": [],
      "preferred_method": "AVA",
      "relationships": null,
      "roles": ["patient"],
      "messaging": {},
      "time_offset": -5,
    };
    // setPersonRec(templatePerson);
    return templatePerson;
  };

  const getSessionData = async (pWho) => {
    let invokeFailed = false;
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance';
    params.Payload = JSON.stringify({
      action: "get_session_details",
      clientId: patient.client_id,
      request: {
        "person_id": pWho,
      }
    });
    let lambdaResponse = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let returnedSession = JSON.parse(lambdaResponse.Payload);
      if (returnedSession.status === 200) {
        setPatientSession(returnedSession.body);
        setPatientPChange(returnedSession.body.password_change_date);
        return returnedSession.body;
      }
    };
    return { "failed": true };
  };

  const getGroupMemberList = async () => {
    let invokeFailed = false;
    setGroupMemberList([]);
    params.Payload = JSON.stringify({
      action: "get_group_members",
      clientId: patient.client_id,
      request: {
        "group_id": '*ALL',
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log(`AVA encountered an error while retrieving Group list.  Error is ${err.message}`);
      });
    if (!invokeFailed) {
      let groupMemberList = JSON.parse(fResp.Payload);
      if (groupMemberList.status === 200) {
        setGroupMemberList(groupMemberList.body);
        return groupMemberList.body;
      }
    };
    return [];
  };

  const hiddenFileInput = React.useRef(null);

  const handlePhotoUpload = event => {
    hiddenFileInput.current.click();
  };

  const handleAbort = () => {
    setResettingPwd(false);
    setPwdConfirmed(false);
    // setInputPWD('password');
    localData.inputPWD = (patientSession.last_login || 'password');
    setChanges(false);
    onClose();
  };

  const handleUpdate = async () => {
    if (patient.person_id.startsWith('*NEW~')) {
      let tryAgain;
      let namePart = localData.firstName.trim().substr(0, 1).toLowerCase() + localData.lastName.toLowerCase().replace(/\W/g, '');
      let numberPart = 1;
      patient.person_id = namePart;
      do {
        tryAgain = false;
        let getSessionResult = await API
          .graphql(graphqlOperation(getSession, { session_id: patient.person_id }))
          .catch(() => { });
        if (getSessionResult) {
          numberPart++;
          patient.person_id = namePart + numberPart.toString();
          tryAgain = true;
        }
      } while (tryAgain);
      enqueueSnackbar(`User ID ${patient.person_id} assigned`, { variant: 'success', persist: true });
    }
    let updatePerson = {
      person_id: patient.person_id,
      first: localData.firstName.substr(0, 1).toUpperCase() + localData.firstName.substr(1),
      last: localData.lastName.substr(0, 1).toUpperCase() + localData.lastName.substr(1),
      email: localData.email,
      sms: localData.cell ? '+1' + localData.cell.replace(/\D/g, '') : null,
      voice: localData.voice ? '+1' + localData.voice.replace(/\D/g, '') : null,
      surrogate: localData.surrogate,
      search_data: localData.searchTerm,
      prefMethod: localData.prefMethod || 'AVA',
      directory_option: localData.directoryOption || 'normal',
      time_based_rules: patient.time_based_rules,
      groups: patientGroups,
      location: localData.location ? localData.location.replace(/,/g, '') : null,
      pwdReset: resettingPwd,
      newPassword: localData.inputPWD
    };
    if (typeof cropper !== "undefined") {
      // const croppedFile = dataUrlToFile(cropper.getCroppedCanvas().toDataURL('image/jpeg'), (patient.person_id + '_cropped.jpg'));
      cropper
        .getCroppedCanvas()
        .toBlob((async (pBlob) => {
          await handleSavePhoto(new File([pBlob], (patient.person_id + '_cropped.jpg'), { type: 'image/jpeg' }), '');
        }), 'image/jpeg');
    }
    let updateString = 'newData.' + JSON.stringify(updatePerson);
    console.log(updatePerson);
    let newFactData = {
      patient_id: patient.person_id,
      activity_key: 'action.updateUser',
      value: updateString,
      qualifier: null,
      status: 'requested',
      session: {
        user_id: state.session.user_id,
        session_id: state.session.session_id,
      },
    };
    await API.graphql(graphqlOperation(createPutFact, { input: newFactData })).catch(error => {
      console.log(error);
    });
    await API
      .graphql(graphqlOperation(
        updateSession, {
        input: {
          session_id: patient.person_id,
          responsible_for: responsibleArray,
          patient_id: proxy
        }
      }
      ))
      .catch(error => {
        console.log(`Can't update session in logusage: ${error.errors[0].message}`);
      });
    enqueueSnackbar(`Profile information updated!`, { variant: 'success', persist: false });
    patient.name.first = localData.firstName;
    patient.name.last = localData.lastName;
    setChanges(false);
    setResettingPwd(false);
    setPwdConfirmed(false);
    onClose(updatePerson);
  };

  const handleResetPassword1 = event => {
    setResettingPwd(true);
    setPwdConfirmed(false);
    // setInputPWD('password');
    localData.inputPWD = (patientSession.last_login || 'password');
  };

  const handleResetPassword2 = event => {
    setPwdConfirmed(true);
  };

  const handleChangeFirstName = event => {
    localData.firstName = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    // setFirstName(event.target.value);
    setChanges(true);
  };

  const handleChangeLastName = event => {
    localData.lastName = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    // setLastName(event.target.value);
    setChanges(true);
  };

  const handleChangeEmail = event => {
    localData.email = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    // setEmail(event.target.value);
    setChanges(true);
  };

  const handleChangeCell = event => {
    localData.cell = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    // setCell(formatPhone('' + event.target.value.replace(/\D/g, '')));
    setChanges(true);
  };

  const handleChangeVoice = event => {
    localData.voice = formatPhone('' + event.target.value.replace(/\D/g, ''));
    setRefreshTrigger(!refreshTrigger);
    // setVoice(formatPhone('' + event.target.value.replace(/\D/g, '')));
    setChanges(true);
  };

  const handleChangeSurrogate = event => {
    let checkNum = event.target.value.replace(/[\d\s\-()]/g, '');
    if (checkNum) { localData.surrogate = event.target.value; }
    else { localData.surrogate = (formatPhone('' + event.target.value.replace(/\D/g, ''))); }
    setRefreshTrigger(!refreshTrigger);
    setChanges(true);
  };

  async function handleSavePhoto(pTarget, pTmp) {
    let extension = pTarget.type.split('/')[1];
    if (extension === 'jpeg') { extension = 'jpg'; }
    const pFile = {
      Bucket: 'theseus-medical-storage',
      Key: 'public/patients/' + patient.person_id + pTmp + '.' + extension,
      Body: pTarget,
      ACL: 'public-read-write',
      ContentType: pTarget.type
    };
    let s3Resp = await s3
      .upload(pFile)
      .promise()
      .catch(err => {
        enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
      });
    console.log(s3Resp);
    return ('public/patients/' + patient.person_id + pTmp + '.' + extension);
  }

  const handleChangeSearch = event => {
    localData.searchTerm = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    // setSearchTerm(event.target.value);
    setChanges(true);
  };

  const handleChangeMethod = event => {
    localData.prefMethod = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    // setMethod(event.target.value);
    setChanges(true);
  };

  const handleChangeDirectoryOption = event => {
    localData.directoryOption = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    // setDirectoryOption(event.target.value);
    setChanges(true);
  };

  const handleChangeLocation = event => {
    localData.location = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    // setLocation(event.target.value);
    setChanges(true);
  };

  const handleChangePassword = event => {
    localData.inputPWD = event.target.value;
    setRefreshTrigger(!refreshTrigger);
    // setInputPWD(event.target.value);
  };

  const handleChangeGroups = updatedGroupArray => {
    setPatientGroups(updatedGroupArray);
    setChanges(true);
  };

  const handleChangeLinkedAccounts = updatedResponsibleArray => {
    setResponsibleArray(updatedResponsibleArray);
    patientSession.responsible_for = updatedResponsibleArray;
    setSessionVersion(sessionVersion + 1);
    setChanges(true);
  };

  const handleChangeProxy = event => {
    let newProxy = event.target.value;
    if (!newProxy || newProxy === '') { newProxy = patientSession.user_id; }
    setProxy(newProxy);
    patientSession.patient_id = newProxy;
    setSessionVersion(sessionVersion + 1);
    setChanges(true);
  };

  const onChangeMethod = tableRow => event => {
    patient.time_based_rules[tableRow].method = event.target.value;
    setChanges(true);
  };

  return (
    (localData.ready && (open || refreshTrigger)) ?
      <Dialog open={open} onClose={handleAbort} TransitionComponent={Transition} fullScreen>
        <AppBar>
          <Toolbar>
            <IconButton color='inherit' edge='start' onClick={handleAbort}>
              <CloseIcon />
            </IconButton>
            <Typography variant='h6' className={classes.title}>
              {patient?.name?.first} {patient?.name?.last}
            </Typography>
            {changes || pwdConfirmed ?
              <Button
                onClick={handleUpdate}
                disabled={!changes && !pwdConfirmed}
                hidden={!changes && !pwdConfirmed}
                variant='contained'
                className={classes.topButton}
              >
                {isMobile ? 'Save' : 'Save Changes'}
              </Button>
              : null}
          </Toolbar>
        </AppBar>
        <Toolbar />
        <Box m={2}>
          <Paper component={Box} variant={'outlined'}>
            <Box mt={1} py={1} px={3} borderBottom={2}>
              <Box flexGrow={1}>
                <Typography variant='h6'>Profile</Typography>
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
                  <TextField id='FirstName' value={localData.firstName} onChange={handleChangeFirstName} helperText='First' />
                  {'    '}
                  <TextField id='LastName' onChange={handleChangeLastName} value={localData.lastName} helperText='Last' />
                </div>
                <div>
                  <TextField id='address' value={localData.location} fullWidth onChange={handleChangeLocation} helperText='Location' />
                </div>
                <div>
                  <TextField id='eMail' value={localData.email} fullWidth onChange={handleChangeEmail} helperText='e-Mail' />
                </div>
                <div>
                  <TextField id='cell' value={localData.cell} onChange={handleChangeCell} helperText='cell phone' />
                  {'    '}
                  <TextField id='home' value={localData.voice} onChange={handleChangeVoice} helperText='home phone' />
                </div>
                <div>
                  <TextField id='surrogate' value={localData.surrogate} fullWidth onChange={handleChangeSurrogate} helperText='on-site alternate contact' />
                </div>
                <div>
                  <Box
                    display="flex"
                    pt={2}
                    flexDirection='column'
                    justifyContent="center"
                  >
                    <Typography className={classes.radioText}>I prefer to receive communications via...</Typography>
                    {localData.prefMethod &&
                      <FormControl className={classes.formControl} component="fieldset">
                        <RadioGroup row defaultValue={localData.prefMethod} aria-label="PrefMethod" name="method" value={localData.prefMethod} onChange={handleChangeMethod}>
                          <FormControlLabel className={classes.formControlLbl} value="AVA" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>AVA</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="sms" control={<Radio disabled={!localData.cell} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>text</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="email" control={<Radio disabled={!localData.email} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>e-Mail</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="voice" control={<Radio disabled={!localData.voice} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>phone</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="surrogate" control={<Radio disabled={!localData.surrogate} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>surrogate</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="time_based" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>time-based</Typography>} />
                        </RadioGroup>
                      </FormControl>
                    }

                    <Typography className={classes.idText1}>
                      {`My userID is ${patient?.person_id}`}
                    </Typography>
                    {patientPChange ?
                      <Typography className={classes.idText2}>{`My password was set on ${patientPChange.split('GMT')[0]} GMT`}</Typography>
                      : null}

                    <Typography className={classes.radioTextWithTopMargin}>With regard to the printed Directory...</Typography>
                    {localData.directoryOption &&
                      <FormControl className={classes.formControl} component="fieldset">
                        <RadioGroup row={false} defaultValue={localData.directoryOption} aria-label="DirOptions" name="dirOption" value={localData.directoryOption} onChange={handleChangeDirectoryOption}>
                          <FormControlLabel className={classes.formControlLbl} value="normal" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>Include my info</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="exclude" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>Exclude me</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="alone" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>Do not print my info with anyone else's</Typography>} />
                          <FormControlLabel className={classes.formControlLbl} value="merge" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>Print my info with someone else's</Typography>} />
                        </RadioGroup>
                      </FormControl>
                    }


                    <Box mt={3}>
                      <TextField id='searchTerm' value={localData.searchTerm} fullWidth onChange={handleChangeSearch} helperText='Additional search terms' />
                    </Box>

                  </Box>
                </div>
                <Box flexGrow={1} mr={3}
                  display="flex"
                  flexDirection='row'
                  alignItems="center"
                  justifyContent="flex-end"
                >
                </Box>
              </form>
            </Box>
          </Paper>
        </Box>
        {localData.prefMethod === 'time_based' ?
          <MessageRouting
            person={patient}
            updateSetChange={() => { setChanges(true); }}
            onChangeMethod={onChangeMethod}
            numberRows={patient.time_based_rules?.length || 1}
          />
          : null}
        <Box m={2}>
          <Paper component={Box} variant={'outlined'}>
            <Box mt={1} py={1} px={3} borderBottom={2}>
              <Box flexGrow={1}>
                <Typography variant='h6'>Photo</Typography>
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
            <Box flexGrow={1} mr={3}
              display="flex"
              flexDirection='column'
              alignItems="center"
              justifyContent="center"
            >
              <Box
                component="img"
                minWidth={150}
                maxWidth={150}
                alt='No photo available'
                src={!patient.person_id.startsWith('*NEW~') ? `https://theseus-medical-storage.s3.amazonaws.com/public/patients/${patient.person_id}.jpg` : 'https://ava-icons.s3.amazonaws.com/icons8-family-50.png'}
              />
              <br />
              <Box display='flex'
                className={classes.photoButton}
                flexDirection='row'
                justifyContent='center'
                alignItems='center'>
                {(editPhoto === '') &&
                  <React.Fragment>
                    <Button
                      className={classes.photoButton}
                      variant='outlined'
                      color='primary'
                      hidden={patient.person_id.startsWith('*NEW~')}
                      size='small'
                      startIcon={<CloudUploadIcon />}
                      onClick={async () => {
                        handlePhotoUpload();
                      }}
                    >
                      <Typography>Upload new photo</Typography>
                    </Button>
                    {!patient.person_id.startsWith('*NEW~') &&
                      <Button
                        className={classes.photoButton}
                        variant='outlined'
                        color='primary'
                        hidden={patient.person_id.startsWith('*NEW~')}
                        size='small'
                        onClick={async () => {
                          setEditPhoto(`public/patients/${patient.person_id}.jpg`);
                          setChanges(true);
                        }}
                      >
                        <Typography>Edit this photo</Typography>
                      </Button>
                    }
                  </React.Fragment>
                }
                {(editPhoto !== '') &&
                  <Button
                    className={classes.photoButton}
                    variant='outlined'
                    color='primary'
                    size='small'
                    onClick={() => {
                      cropper.rotate(90);
                    }}
                  >
                    <Typography>Rotate</Typography>
                  </Button>
                }
              </Box>
              {(editPhoto !== '') &&
                <Cropper
                  zoomTo={0.5}
                  style={{ width: "100%", height: "400px" }}
                  aspectRatio={1 / 1}
                  src={`https://theseus-medical-storage.s3.amazonaws.com/${editPhoto}`}
                  viewMode={0}
                  minCropBoxHeight={150}
                  minCropBoxWidth={150}
                  background={false}
                  responsive={true}
                  dragMode={'move'}
                  movable={true}
                  autoCropArea={1}
                  checkOrientation={false}
                  onInitialized={(instance) => {
                    setCropper(instance);
                  }}
                />
              }
              <input
                type="file"
                style={{ display: 'none' }}
                ref={hiddenFileInput}
                onChange={async (target) => {
                  let tempName = await handleSavePhoto(target.target.files[0], 'tmp');
                  setEditPhoto(tempName);
                  setChanges(true);
                }}
              />
            </Box>
          </Paper>
        </Box >
        <ClientsSection person={patient} updateGroups={handleChangeGroups} />
        <RelationshipSection person={patient} />
        <LinkedAccountsSection
          groupMemberList={groupMemberList}
          session={patientSession}
          updateSession={handleChangeLinkedAccounts}
          updateProxy={handleChangeProxy}
          version={sessionVersion}
        />
        <Toolbar>
          <Tooltip title={<Typography variant='caption'>{patient.person_id}</Typography>} placement='bottom-end'>
            <Box>
              <Button
                onClick={handleResetPassword1}
                disabled={resettingPwd && !pwdConfirmed}
                variant='contained'
                className={classes.infoButton}
              >
                Reset Acct
              </Button>
            </Box>
          </Tooltip>
          {" "}
          {resettingPwd ?
            <React.Fragment>
              <Button
                onClick={handleResetPassword2}
                disabled={!resettingPwd || pwdConfirmed}
                hidden={!resettingPwd}
                variant='contained'
                className={classes.resetButton}
              >
                {pwdConfirmed ? 'Confirmed!' : 'Confirm?'}
              </Button>
              {" "}
              <div>
                <TextField
                  id='password'
                  value={localData.inputPWD}
                  autoComplete='off'
                  type='text'
                  onChange={handleChangePassword}
                  helperText={'password'}
                />
              </div>
            </React.Fragment>
            : null}
        </Toolbar>
        <Box flexGrow={1} ml={5}
          display="flex"
          flexDirection='column'
        >
        </Box>
      </Dialog>
      :
      <Dialog open={open} TransitionComponent={Transition} fullScreen>
        <AppBar>
          <Toolbar>
            <IconButton color='inherit' edge='start' onClick={handleAbort}>
              <CloseIcon />
            </IconButton>
            <Typography variant='h6' className={classes.title}>
              {patient?.name?.first} {patient?.name?.last}
            </Typography>
            {changes || pwdConfirmed ?
              <Button
                onClick={handleUpdate}
                disabled={!changes && !pwdConfirmed}
                hidden={!changes && !pwdConfirmed}
                variant='contained'
                className={classes.topButton}
              >
                {isMobile ? 'Save' : 'Save Changes'}
              </Button>
              : null}
          </Toolbar>
        </AppBar>
        <Toolbar />
        <Box m={2}>
          <Paper component={Box} variant={'outlined'}>
            <Box mt={1} py={1} px={3} borderBottom={2}>
              <Box flexGrow={1}>
                <Typography variant='h6'>Profile</Typography>
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
              <Box
                display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                key={'loadingBox'}
                ml={2} mr={2}
              >
                <Typography variant='h5' className={classes.lastName} >{`Loading`}</Typography>
                <CircularProgress />
              </Box>
            </Box>
          </Paper>
        </Box>
      </Dialog>
  );
};
