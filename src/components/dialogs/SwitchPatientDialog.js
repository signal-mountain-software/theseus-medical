import React from 'react';
import { useSnackbar } from 'notistack';
import { API, graphqlOperation } from 'aws-amplify';
import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import List from '@material-ui/core/List';
import Paper from '@material-ui/core/Paper';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import CheckIcon from '@material-ui/icons/Check';
import CloseIcon from '@material-ui/icons/Close';

import { updateSession } from '../../graphql/mutations';
import { getPerson } from '../../graphql/queries';
import { SET_PATIENT, SET_SESSION } from '../../contexts/Session/actions';
import useSession from '../../hooks/useSession';
import PatientListItem from '../PatientListItem';

const useStyles = makeStyles(theme => ({
  appBar: {
    position: 'relative',
  },
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
}));

export default ({ open, roles, onClose }) => {
  const [selected, setSelected] = React.useState(null);
  const { enqueueSnackbar } = useSnackbar();
  const { state, dispatch } = useSession();
  const { patients, session } = state;
  const classes = useStyles();

  const parsePersonObject = person => {
    const patient_id = person.person_id;
    const patient_display_name = person.display_name;
    // const { first, last, suffix } = person.name;
    // const patient_display_name = `${first} ${last}${suffix ? ' ' + suffix : ''}`;
    return { patient_id, patient_display_name };
  };

  const handleClose = () => {
    if (session) {
      const { patient_id, patient_display_name } = session;
      setSelected({ patient_id, patient_display_name });
    }
    onClose();
  };

  const handlePatientClick = newPatient => event => {
    setSelected(newPatient);
  };

  const handleConfirmation = () => {
    (async () => {
      if (session) {
        const result1 = await API.graphql(
          graphqlOperation(updateSession, { input: { session_id: session.user_id, ...selected } })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching a session: ${error.errors[0].message}`, {
            variant: 'error',
          });
        });

        const result2 = await API.graphql(
          graphqlOperation(getPerson, {
            person_id: result1.data.updateSession.patient_id || result1.data.updateSession.user_id,
          })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching a patient by session: ${error.errors[0].message}`, {
            variant: 'error',
          });
        });

        dispatch({ type: SET_SESSION, payload: result1.data.updateSession });
        dispatch({ type: SET_PATIENT, payload: result2.data.getPerson });
      }
      let jumpTo = window.location.href.replace('refresh', 'theseus');
      window.location.replace(jumpTo);
  //    onClose();
    })();
  };

  React.useEffect(() => {
    if (session) {
      const { patient_id, patient_display_name } = session;
      setSelected({ patient_id, patient_display_name });
    }
  }, [session]);

  return (
    <Dialog open={open} onClose={handleClose}>
      <AppBar className={classes.appBar}>
        <Toolbar>
          <IconButton color='inherit' edge='start' onClick={handleClose}>
            <CloseIcon />
          </IconButton>
          <Typography variant='h6' className={classes.title}>
            Switch Account
          </Typography>
        </Toolbar>
      </AppBar>
      <Typography variant='body1' className={classes.title}>
        &nbsp;
      </Typography>
      <Typography variant='body1' className={classes.title}>
        NOTE: Switch Account is being moved.
      </Typography>
      <Typography variant='body1' className={classes.title}>
        Please use "Directory Search / Find a Resident", then search for and select the desired account and press "Switch to this Account".
      </Typography>
      {patients && roles ? (
        <Box p={3}>
          <Paper component={Box} variant='outlined' width='100%' maxHeight={256} overflow='auto' square>
            <List component='nav'>
              {patients.length === 0 ? (
                <PatientListItem
                  patient={{
                    patient_id: null,
                    patient_display_name: roles.includes('responsible_for') ? 'No group' : 'No patient',
                  }}
                  selected={selected}
                  onClick={handlePatientClick({ patient_id: null, patient_display_name: null })}
                />
              ) : null}
              {patients.map((patient, x) => (
                <PatientListItem
                  key={patient.person_id + x}
                  patient={parsePersonObject(patient)}
                  selected={selected}
                  onClick={handlePatientClick(parsePersonObject(patient))}
                />
              ))}
            </List>
          </Paper>
        </Box>
      ) : null}
      <Divider />
      <Box py={2} px={3} display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
        <Button color='secondary' variant='contained' endIcon={<CloseIcon />} onClick={handleClose}>
          Cancel
        </Button>
        <Box mr={2} />
        <Button color='primary' variant='contained' endIcon={<CheckIcon />} onClick={handleConfirmation}>
          Confirm
        </Button>
      </Box>
    </Dialog>
  );
};
