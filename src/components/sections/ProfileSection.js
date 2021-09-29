import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';

import Typography from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';

import makeStyles from '@material-ui/core/styles/makeStyles';

import { createPutFact } from '../../graphql/mutations';

import Section from '../Section';

const useStyles = makeStyles(theme => ({
  formControl: {
    marginLeft: theme.spacing(3),
    marginTop: theme.spacing(2),
    marginRight: theme.spacing(1),
    paddingRight: theme.spacing(1),
    width: '100%',
    minWidth: '100%',
  },
  root: {
    '& .MuiTextField-root': {
      margin: theme.spacing(1),
      //      width: '25ch',
    },
  },
  inputText: {
    paddingRight: '45px',
  },
  subHeader: {
    fontWeight: 'bold',
    minWidth: '100%',
  },
  defaultButton: {
    marginTop: 8,
    marginLeft: 5,
    paddingLeft: 10,
    paddingRight: 10,
    variant: 'outlined',
    verticalAlign: 'middle',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  freeInput: {
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 15,
    width: '85%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    height: theme.typography.fontSize * 2.8,
  },
  valueLine: {
    marginBottom: 0,
    marginTop: 0,
    paddingBottom: 0,
    lineHeight: 1,
    minWidth: '50%',
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

export default ({ session, profile, loginID }) => {
  const getGreeting = () => {
    const date = new Date();
    const hours = date.getHours();

    let greeting;
    if (hours >= 18) {
      greeting = 'Good Evening';
    } else if (hours >= 12) {
      greeting = 'Good Afternoon';
    } else if (hours >= 6) {
      greeting = 'Good Morning';
    } else {
      greeting = 'Good Evening';
    }
    return greeting;
  };

  const classes = useStyles();

  const [firstName, setFirstName] = React.useState();
  const [lastName, setLastName] = React.useState();
  const [email, setEmail] = React.useState();
  const [cell, setCell] = React.useState();
  const [voice, setVoice] = React.useState();
  const [location, setLocation] = React.useState();

  const [changes, setChanges] = React.useState(false);

  const s3Bucket = 'https://theseus-medical-storage.s3.amazonaws.com/public/patients/';
  // const [newFact, setNewFact] = React.useState({});

  React.useEffect(() => {
    if (profile) {
      if (profile.messaging.email) {
        setEmail(profile.messaging.email);
      }

      if (profile.messaging.sms) {
        var match = '' + profile.messaging.sms.replace(/\D/g, '').substr(-10);
        let newCell = '';
        if (match.length > 0) {
          newCell += '(' + match.substr(0, 3);
        }
        if (match.length > 3) {
          newCell += ') ' + match.substr(3, 3);
        }
        if (match.length > 6) {
          newCell += '-' + match.substr(6, 4);
        }
        setCell(newCell);
      }

      if (profile.messaging.voice) {
        match = '' + profile.messaging.voice.replace(/\D/g, '').substr(-10);
        let newVoice = '';
        if (match.length > 0) {
          newVoice += '(' + match.substr(0, 3);
        }
        if (match.length > 3) {
          newVoice += ') ' + match.substr(3, 3);
        }
        if (match.length > 6) {
          newVoice += '-' + match.substr(6, 4);
        }
        setVoice(newVoice);
      }
      
        setFirstName(profile.name.first);
        setLastName(profile.name.last);
        setLocation(profile.location);

      setChanges(false);
    }
  }, [loginID, profile]);
/*
  const handleNew = async () => {
    let updatePerson = {
      person_id: loginID,
      first: firstName,
      last: lastName,
      email: email,
      sms: cell ? '+1' + cell.replace(/\D/g, '') : null,
      voice: voice ? '+1' + voice.replace(/\D/g, '') : null,
      location: location,
    };
    let updateString = 'newData.' + JSON.stringify(updatePerson);
    console.log(updatePerson);
    let newFactData = {
      patient_id: session.user_id,
      activity_key: 'action.createUser',
      value: updateString,
      qualifier: null,
      status: 'requested',
      session: {
        user_id: loginID,
        session_id: (state.version + '~' + session.session_id),
      },
    };
    // setNewFact(newFactData);
    await API.graphql(graphqlOperation(createPutFact, { input: newFactData })).catch(error => {
      console.log(error);
    });
  };
*/
  const handleUpdate = async () => {
    let updatePerson = {
      person_id: loginID,
      first: firstName,
      last: lastName,
      email: email,
      sms: cell ? '+1' + cell.replace(/\D/g, '') : null,
      voice: voice ? '+1' + voice.replace(/\D/g, '') : null,
      location: location,
    };
    let updateString = 'newData.' + JSON.stringify(updatePerson);
    console.log(updatePerson);
    let newFactData = {
      patient_id: session.user_id,
      activity_key: 'action.updateUser',
      value: updateString,
      qualifier: null,
      status: 'requested',
      session: {
        user_id: loginID,
        session_id: (state.version + '~' + session.session_id),
      },
    };
    // setNewFact(newFactData);
    await API.graphql(graphqlOperation(createPutFact, { input: newFactData })).catch(error => {
      console.log(error);
    });
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
    var match = '' + event.target.value.replace(/\D/g, '');
    let newCell = '';
    if (match.length > 0) {
      newCell += '(' + match.substr(0, 3);
    }
    if (match.length > 3) {
      newCell += ') ' + match.substr(3, 3);
    }
    if (match.length > 6) {
      newCell += '-' + match.substr(6, 4);
    }
    setCell(newCell);
    setChanges(true);
  };

  const handleChangeVoice = event => {
    var match = '' + event.target.value.replace(/\D/g, '');
    let newVoice = '';
    if (match.length > 0) {
      newVoice += '(' + match.substr(0, 3);
    }
    if (match.length > 3) {
      newVoice += ') ' + match.substr(3, 3);
    }
    if (match.length > 6) {
      newVoice += '-' + match.substr(6, 4);
    }
    setVoice(newVoice);
    setChanges(true);
  };

  const handleChangeLocation = event => {
    setLocation(event.target.value);
    setChanges(true);
  };

  return (
    <Section title='Profile'>
      {session ? (
        <>
          <Typography variant='h5' gutterBottom>
            {getGreeting()}, {firstName && lastName ? firstName + ' ' + lastName : session.user_display_name}!
          </Typography>
          {session.user_id !== session.patient_id ? (
            <Typography variant='body1'>
              You are currently working on behalf of {session.patient_display_name}
            </Typography>
          ) : null}
          {profile ? (
            <Box m={2}>
            <Paper
              component={Box}
              p={3}
              variant='outlined'
              display='flex'
              flexDirection='row'
              justifyContent='center'
              alignItems='center'>
              <Box flexGrow={1} mr={3}>
                <img src={s3Bucket + profile.person_id + '.jpg'} alt={'Upload?'} />
              </Box>
            <form className={classes.root} noValidate autoComplete='off'>
              <div>
                <TextField
                  id='FirstName'
                  label='Name'
                  value={firstName}
                  onChange={handleChangeFirstName}
                  helperText='First'
                  marginRight={10}
                />
                <TextField id='LastName' label=' ' onChange={handleChangeLastName} value={lastName} helperText='Last' />
              </div>
              <div>
                <TextField
                  id='eMail'
                  value={email}
                  fullWidth
                  onChange={handleChangeEmail}
                  helperText='e-Mail'
                  marginRight={10}
                />
              </div>
              <div>
                <TextField id='cell' label=' ' value={cell} onChange={handleChangeCell} helperText='cell phone' />
                <TextField id='home' label=' ' value={voice} onChange={handleChangeVoice} helperText='home phone' />
              </div>
              <div>
                <TextField
                  id='address'
                  label='Address'
                  value={location}
                  onChange={handleChangeLocation}
                  helperText='Apartment location'
                  marginRight={10}
                />
              </div>
                <Button
                  onClick={handleUpdate}
                  disabled={!changes}
                  className={classes.defaultButton}
                  variant='contained'>
                Update this Info
                </Button>
            </form>
            </Paper>
      </Box>
          ) : null}
        </>
      ) : null}
    </Section>
  );
};
