import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { createPutFact } from '../../graphql/mutations';

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
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import FaceIcon from '@material-ui/icons/Face';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormControl from '@material-ui/core/FormControl';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';

import ActivityCustomizationsSection from '../sections/ActivityCustomizationsSection';
import ClientsSection from '../sections/ClientsSection';
import RelationshipSection from '../sections/RelationshipSection';

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
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
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
  const [prefMethod, setMethod] = React.useState();
  const [patientGroups, setPatientGroups] = React.useState();

  const [changes, setChanges] = React.useState(false);

  const { enqueueSnackbar } = useSnackbar();

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
      setMethod(patient.preferred_method);
      if (isNaN(patient.messaging?.surrogate)) { setSurrogate(patient.messaging?.surrogate); }
      else { setSurrogate(formatPhone('' + patient.messaging?.surrogate)); }
      let foundAt;
      const groupFound = patient.clients.some((e, i) => { foundAt = i; return (e.id === patient.client_id); });
      if (groupFound) {
        setPatientGroups(patient.clients[foundAt].groups.map(e => { return (`${patient.client_id}~${e}`); }));
      }
    }
  }, [patient]);

  const hiddenFileInput = React.useRef(null);

  const handlePhotoUpload = event => {
    hiddenFileInput.current.click();
  };

  const handleUpdate = async () => {
    let updatePerson = {
      person_id: patient.person_id,
      first: firstName,
      last: lastName,
      email: email,
      sms: cell ? '+1' + cell.replace(/\D/g, '') : null,
      voice: voice ? '+1' + voice.replace(/\D/g, '') : null,
      surrogate: surrogate,
      prefMethod: prefMethod || 'AVA',
      groups: patientGroups,
      location: location,
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
        user_id: patient.person_id,
        session_id: 'PatientDialog.js',
      },
    };
    await API.graphql(graphqlOperation(createPutFact, { input: newFactData })).catch(error => {
      console.log(error);
    });
    enqueueSnackbar(`Profile information updated!`, { variant: 'success', persist: false });
    patient.name.first = firstName;
    patient.name.last = lastName;
    setChanges(false);
    onClose();
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

  const handleChangeGroups = updatedGroupArray => {
    setPatientGroups(updatedGroupArray);
    setChanges(true);
  };


  return (
    open ?
    <Dialog open={open} onClose={onClose} TransitionComponent={Transition} fullScreen>
      <AppBar>
        <Toolbar>
          <IconButton color='inherit' edge='start' onClick={onClose}>
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
            <Button className={classes.photoButton} variant='outlined' color='primary' size='small' startIcon={<CloudUploadIcon />} onClick={handlePhotoUpload}>
              <Typography>Update photo?</Typography>
            </Button>
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
                  flexDirection='column'
                  height={80}
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
                    </RadioGroup>
                  </FormControl>
                </Box>
              </div>
              <div>
                <TextField id='address' value={location} onChange={handleChangeLocation} helperText='Apartment location' />
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
      <RelationshipSection person={patient} />
      <ClientsSection person={patient} updateGroups={handleChangeGroups}/>
    </Dialog>
    : null
  );
};
