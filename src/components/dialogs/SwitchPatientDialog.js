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

const PATIENT_LIST = [
  { patient_id: 'rbobby', patient_display_name: 'Ricky Bobby' },
  { patient_id: 'cbing', patient_display_name: 'Chandler Bing' },
  { patient_id: 'rsteelesr', patient_display_name: 'Ray Steele Sr' },
];

export default ({ open, onClose }) => {
  const [selected, setSelected] = React.useState(null);
  const { enqueueSnackbar } = useSnackbar();
  const { state, dispatch } = useSession();
  const { session } = state;
  const classes = useStyles();

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
          graphqlOperation(updateSession, { input: { session_id: session.session_id, ...selected } })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching a session: ${error.message}`, {
            variant: 'error',
          });
        });

        const result2 = await API.graphql(
          graphqlOperation(getPerson, {
            person_id: result1.data.updateSession.patient_id || result1.data.updateSession.user_id,
          })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching a patient by session: ${error.message}`, {
            variant: 'error',
          });
        });

        dispatch({ type: SET_SESSION, payload: result1.data.updateSession });
        dispatch({ type: SET_PATIENT, payload: result2.data.getPerson });
      }
      onClose();
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
            Switch Patients
          </Typography>
        </Toolbar>
      </AppBar>
      {PATIENT_LIST ? (
        <Box p={3}>
          <Paper component={Box} variant='outlined' width='100%' maxHeight={256} square>
            <List component='nav'>
              <PatientListItem
                patient={{ patient_id: null, patient_display_name: 'No patient' }}
                selected={selected}
                onClick={handlePatientClick({ patient_id: null, patient_display_name: null })}
              />
              {PATIENT_LIST.map(patient => (
                <PatientListItem
                  key={patient.patient_id}
                  patient={patient}
                  selected={selected}
                  onClick={handlePatientClick(patient)}
                />
              ))}
            </List>
          </Paper>
        </Box>
      ) : null}
      <Divider />
      <Box py={2} px={3} display='flex' flexDirection='row' justifyContent='flex-end' alignItems='center'>
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
