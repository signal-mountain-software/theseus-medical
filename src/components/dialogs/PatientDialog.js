import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { createPutFact } from '../../graphql/mutations';
import { getSession } from '../../graphql/queries';
import useSession from '../../hooks/useSession';

import { useSnackbar } from 'notistack';

import AppBar from '@material-ui/core/AppBar';
import Avatar from '@material-ui/core/Avatar';
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
import FaceIcon from '@material-ui/icons/Face';

import Visibility from '@material-ui/icons/Visibility';
import VisibilityOff from '@material-ui/icons/VisibilityOff';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';

import ClientsSection from '../sections/ClientsSection';
import RelationshipSection from '../sections/RelationshipSection';
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

export default ({ patient, picture, open, onClose }) => {
  const classes = useStyles();

  const [firstName, setFirstName] = React.useState();
  const [lastName, setLastName] = React.useState();
  const [email, setEmail] = React.useState();
  const [cell, setCell] = React.useState();
  const [surrogate, setSurrogate] = React.useState();
  const [voice, setVoice] = React.useState();
  const [location, setLocation] = React.useState();
  const [inputPWD, setInputPWD] = React.useState();
  const [prefMethod, setMethod] = React.useState();
  const [patientGroups, setPatientGroups] = React.useState();

  const [showPassword, setShowPassword] = React.useState(false);

  const [changes, setChanges] = React.useState(false);
  const [resettingPwd, setResettingPwd] = React.useState(false);

  const { enqueueSnackbar } = useSnackbar();
  const { state } = useSession();

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const s3 = new AWS.S3({
    accessKeyId: 'AKIAR2O24AQ2HD72XKW4',
    secretAccessKey: 'EAeexsTiS8cxKgfuhoFKEuAkr6tPG7my1Z1VDLXA',
  });

  function formatPhone(pNumber) {
    var match = '' + pNumber.replace(/\D/g, '').substr(-10);
    let formatted = '';
    if (match.length > 0) { formatted += '(' + match.substr(0, 3); }
    if (match.length > 3) { formatted += ') ' + match.substr(3, 3); }
    if (match.length > 6) { formatted += '-' + match.substr(6, 4); }
    return formatted;
  }

  React.useEffect(() => {
    if (patient) {
      setFirstName(patient.name.first);
      setLastName(patient.name.last);
      setCell(patient.messaging?.sms ? formatPhone(patient.messaging?.sms) : '');
      setVoice(patient.messaging?.voice ? formatPhone(patient.messaging?.voice) : '');
      setEmail(patient.messaging?.email || '');
      setLocation(patient.location || '');
      setInputPWD('password');
      setMethod(patient.preferred_method);
      //      setTimeBasedRules(patient.time_based_rules);
      if (isNaN(patient.messaging?.surrogate)) { setSurrogate(patient.messaging?.surrogate); }
      else { setSurrogate(formatPhone('' + patient.messaging?.surrogate)); }
      let foundAt;
      let groupFound;
      if (Array.isArray(patient.clients)) {
        groupFound = patient.clients.some((e, i) => { foundAt = i; return (e.id === patient.client_id); });
        if (groupFound) {
          setPatientGroups(patient.clients[foundAt].groups.map(e => { return (`${patient.client_id}~${e}`); }));
        }
      }
    }
  }, [patient]);

  const hiddenFileInput = React.useRef(null);

  const handlePhotoUpload = event => {
    hiddenFileInput.current.click();
  };

  const handleAbort = () => {
    setResettingPwd(false);
    setShowPassword(false);
    setInputPWD('password');
    setChanges(false);
    onClose()
  }

  const handleUpdate = async () => {
    if (patient.person_id.startsWith('*NEW~')) {
      let tryAgain;
      let namePart = firstName.substr(0, 1).toLowerCase() + lastName.toLowerCase();
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
      first: firstName.substr(0, 1).toUpperCase() + firstName.substr(1),
      last: lastName.substr(0, 1).toUpperCase() + lastName.substr(1),
      email: email,
      sms: cell ? '+1' + cell.replace(/\D/g, '') : null,
      voice: voice ? '+1' + voice.replace(/\D/g, '') : null,
      surrogate: surrogate,
      prefMethod: prefMethod || 'AVA',
      time_based_rules: patient.time_based_rules,
      groups: patientGroups,
      location: location ? location.replace(/,/g, '') : null,
      pwdReset: resettingPwd,
      newPassword: inputPWD
    };
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
    enqueueSnackbar(`Profile information updated!`, { variant: 'success', persist: false });
    patient.name.first = firstName;
    patient.name.last = lastName;
    setChanges(false);
    setResettingPwd(false);
    onClose();
  };

  const handleResetPassword1 = event => {
    setResettingPwd(true);
    setInputPWD('password');
  };

  const handleResetPassword2 = event => {
    setChanges(true);
  };

  const handleChangeFirstName = event => {
    setFirstName(event.target.value);
    setChanges(true);
  };

  const handleChangeLastName = event => {
    setLastName(event.target.value);
    setChanges(true);
  };

  const handleChangeEmail = event => {
    setEmail(event.target.value);
    setChanges(true);
  };

  const handleChangeCell = event => {
    setCell(formatPhone('' + event.target.value.replace(/\D/g, '')));
    setChanges(true);
  };

  const handleChangeVoice = event => {
    setVoice(formatPhone('' + event.target.value.replace(/\D/g, '')));
    setChanges(true);
  };

  const handleChangeSurrogate = event => {
    let checkNum = event.target.value.replace(/[\d\s\-()]/g, '');
    if (checkNum) { setSurrogate(event.target.value); }
    else { setSurrogate(formatPhone('' + event.target.value.replace(/\D/g, ''))); }
    setChanges(true);
  };

  const handleChangeMethod = event => {
    setMethod(event.target.value);
    setChanges(true);
  };

  const handleChangeLocation = event => {
    setLocation(event.target.value);
    setChanges(true);
  };

  const handleChangePassword = event => {
    setInputPWD(event.target.value);
  };

  const handleChangeGroups = updatedGroupArray => {
    setPatientGroups(updatedGroupArray);
    setChanges(true);
  };

  const onChangeMethod = tableRow => event => {
    patient.time_based_rules[tableRow].method = event.target.value;
    setChanges(true);
  };
  
  return (
    open ?
      <Dialog open={open} onClose={handleAbort} TransitionComponent={Transition} fullScreen>
        <AppBar>
          <Toolbar>
            <IconButton color='inherit' edge='start' onClick={handleAbort}>
              <CloseIcon />
            </IconButton>
            <Typography variant='h6' className={classes.title}>
              {patient?.name?.first} {patient?.name?.last}
            </Typography>
            {changes ?
              <Button
                onClick={handleUpdate}
                disabled={!changes}
                hidden={!changes}
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
            <Box flexGrow={1} mr={3}
              display="flex"
              flexDirection='column'
              alignItems="center"
              justifyContent="center"
            >
              <Avatar src={picture} className={classes.picture}>
                <FaceIcon className={classes.picture} />
              </Avatar>
              <br />
              {!patient.person_id.startsWith('*NEW~') ?
                <Button
                  className={classes.photoButton}
                  variant='outlined'
                  color='primary'
                  hidden={patient.person_id.startsWith('*NEW~')}
                  size='small'
                  startIcon={<CloudUploadIcon />}
                  onClick={handlePhotoUpload}
                >
                  <Typography>Update photo?</Typography>
                </Button>
                : null}
              <input
                type="file"
                style={{ display: 'none' }}
                ref={hiddenFileInput}
                onChange={async (target) => {
                  // let fObj = target.target.files[0];
                  // let oName = fObj.name.toLowerCase().split('.');
                  // let oType = oName.pop();
                  const pFile = {
                    Bucket: 'theseus-medical-storage',
                    Key: 'public/patients/' + patient.person_id + '.jpg',
                    Body: target.target.files[0],
                    ACL: 'public-read-write',
                  };
                  enqueueSnackbar(`Your photo is being updated!`, { variant: 'success', persist: false });
                  s3.upload(pFile, function (err, data) {
                    if (err) {
                      enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${JSON.stringify(err)}`, { variant: 'error', persist: true });
                    }
                  });
                }
                }
              />
            </Box>
            <Box flexGrow={2} display='flex' flexDirection='column'>
              <form className={classes.root} noValidate autoComplete='off'>
                <div>
                  <TextField id='FirstName' value={firstName} onChange={handleChangeFirstName} helperText='First' />
                  {'    '}
                  <TextField id='LastName' onChange={handleChangeLastName} value={lastName} helperText='Last' />
                </div>
                <div>
                  <TextField id='address' value={location} fullWidth onChange={handleChangeLocation} helperText='Location' />
                </div>
                <div>
                  <TextField id='eMail' value={email} fullWidth onChange={handleChangeEmail} helperText='e-Mail' />
                </div>
                <div>
                  <TextField id='cell' value={cell} onChange={handleChangeCell} helperText='cell phone' />
                  {'    '}
                  <TextField id='home' value={voice} onChange={handleChangeVoice} helperText='home phone' />
                </div>
                <div>
                  <TextField id='surrogate' value={surrogate} fullWidth onChange={handleChangeSurrogate} helperText='on-site alternate contact' />
                </div>
                <div>
                  <Box
                    display="flex"
                    pt={2}
                    flexDirection='column'
                    justifyContent="center"
                  >
                    <Typography className={classes.radioText}>I prefer to receive communications via...</Typography>
                    <FormControl className={classes.formControl} component="fieldset">
                      <RadioGroup row defaultValue={prefMethod} aria-label="PrefMethod" name="method" value={prefMethod} onChange={handleChangeMethod}>
                        <FormControlLabel className={classes.formControlLbl} value="AVA" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>AVA</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="sms" control={<Radio disabled={!cell} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>text</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="email" control={<Radio disabled={!email} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>e-Mail</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="voice" control={<Radio disabled={!voice} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>phone</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="surrogate" control={<Radio disabled={!surrogate} disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>surrogate</Typography>} />
                        <FormControlLabel className={classes.formControlLbl} value="time_based" control={<Radio disableRipple className={classes.radioButton} size='small' />} label={<Typography className={classes.radioText}>time-based</Typography>} />
                      </RadioGroup>
                    </FormControl>

                    <Typography className={classes.idText}>{`My userID is ${patient.person_id}`}</Typography>

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
        {prefMethod === 'time_based' ?
          <MessageRouting
            person={patient}
            updateSetChange={() => { setChanges(true); }}
            onChangeMethod={onChangeMethod}
            numberRows={patient.time_based_rules?.length || 1}
          />
          : null}
        <ClientsSection person={patient} updateGroups={handleChangeGroups} />
        <RelationshipSection person={patient} />
        <Toolbar>
          <Tooltip title={<Typography variant='caption'>{patient.person_id}</Typography>} placement='bottom-end'>
            <Button
              onClick={handleResetPassword1}
              disabled={resettingPwd}
              variant='contained'
              className={classes.infoButton}
            >
              Reset Acct
            </Button>
          </Tooltip>
          {" "}
          {resettingPwd ?
            <React.Fragment>
              <Button
                onClick={handleResetPassword2}
                disabled={!resettingPwd}
                hidden={!resettingPwd}
                variant='contained'
                className={classes.resetButton}
              >
                Confirm
              </Button>
              {" "}
              <div>
                <TextField
                  id='password'
                  value={inputPWD}
                  autoComplete='off'
                  type={showPassword ? 'text' : 'password'}
                  onChange={handleChangePassword}
                  helperText={inputPWD === 'password' ? 'temporary password' : 'password'}
                />
              </div>
              <IconButton edge='end' aria-label='comments' onClick={() => { setShowPassword(!showPassword); }}>
                {showPassword ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </React.Fragment>
            : null}
        </Toolbar>
        <Box flexGrow={1} ml={5}
          display="flex"
          flexDirection='column'
        >
        </Box>
      </Dialog>
      : null
  );
};
