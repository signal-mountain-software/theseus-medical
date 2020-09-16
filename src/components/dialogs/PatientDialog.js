import React from 'react';
import AppBar from '@material-ui/core/AppBar';
import Avatar from '@material-ui/core/Avatar';
import Box from '@material-ui/core/Box';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import FaceIcon from '@material-ui/icons/Face';

import ActivityCustomizationsSection from '../sections/ActivityCustomizationsSection';
import ClientsSection from '../sections/ClientsSection';
import RelationshipSection from '../sections/RelationshipSection';

const useStyles = makeStyles(theme => ({
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
  formControl: {
    margin: theme.spacing(1),
    width: '100%',
  },
  picture: {
    width: theme.spacing(16),
    height: theme.spacing(16),
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ patient, picture, open, onClose }) => {
  const classes = useStyles();

  return (
    <Dialog open={open} onClose={onClose} TransitionComponent={Transition} fullScreen>
      <AppBar>
        <Toolbar>
          <IconButton color='inherit' edge='start' onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <Typography variant='h6' className={classes.title}>
            {patient.name.first} {patient.name.last}
          </Typography>
        </Toolbar>
      </AppBar>
      <Toolbar />
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
            <Avatar src={picture} className={classes.picture}>
              <FaceIcon />
            </Avatar>
          </Box>
          <Box flexGrow={2} display='flex' flexDirection='column'>
            <Typography variant='h6'>Location: {patient.location || 'null'}</Typography>
            {patient.messaging ? (
              <>
                <Typography variant='subtitle2'>
                  email: {patient.messaging.email || 'none'} | phone: {patient.messaging.sms || 'none'}
                </Typography>
                <Typography variant='subtitle2'>
                  Preferred contact method: {patient.preferred_method || 'none'}
                </Typography>
              </>
            ) : (
              <>
                <Typography variant='subtitle2'>email: none | phone: none</Typography>
                <Typography variant='subtitle2'>Preferred contact method: N/A</Typography>
              </>
            )}
            <Box mb={1} />
            <Divider />
            <Box mb={1} />
            <Typography variant='subtitle1'>
              Favorite activities: {patient.favorite_activities ? patient.favorite_activities.join(', ') : 'none'}
            </Typography>
            <Typography variant='subtitle1'>
              Priority activities: {patient.priority_activities ? patient.priority_activities.join(', ') : 'none'}
            </Typography>
          </Box>
        </Paper>
      </Box>
      <RelationshipSection patient={patient} />
      <ActivityCustomizationsSection patient={patient} />
      <ClientsSection patient={patient} />
    </Dialog>
  );
};
