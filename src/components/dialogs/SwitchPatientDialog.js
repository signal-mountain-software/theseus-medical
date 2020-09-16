import React from 'react';
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

export default ({ patient, open, onClose }) => {
  const [selected, setSelected] = React.useState(null);
  const { dispatch } = useSession();
  const classes = useStyles();

  const handlePatientClick = id => event => {
    setSelected(id);
    alert('Clicked id ' + id);
  };

  const handleConfirmation = () => {
    alert('You clicked confirm');
  };

  React.useEffect(() => {
    if (patient) {
      setSelected(patient.person_id);
    }
  }, [patient]);

  return (
    <Dialog open={open} onClose={onClose}>
      <AppBar className={classes.appBar}>
        <Toolbar>
          <IconButton color='inherit' edge='start' onClick={onClose}>
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
                patientId=''
                patientDisplayName='No patient'
                selected={selected}
                onClick={handlePatientClick('')}
              />
              {PATIENT_LIST.map(patient => (
                <PatientListItem
                  key={patient.patient_id}
                  patientId={patient.patient_id}
                  patientDisplayName={patient.patient_display_name}
                  selected={selected}
                  onClick={handlePatientClick(patient.patient_id)}
                />
              ))}
            </List>
          </Paper>
        </Box>
      ) : null}
      <Divider />
      <Box py={2} px={3} display='flex' flexDirection='row' justifyContent='flex-end' alignItems='center'>
        <Button color='primary' variant='contained' endIcon={<CheckIcon />} onClick={handleConfirmation}>
          Confirm
        </Button>
      </Box>
    </Dialog>
  );
};
