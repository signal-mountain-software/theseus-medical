import React from 'react';
import AppBar from '@material-ui/core/AppBar';
import Avatar from '@material-ui/core/Avatar';
import Box from '@material-ui/core/Box';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import IconButton from '@material-ui/core/IconButton';
import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

const useStyles = makeStyles(theme => ({
  appBar: {
    position: 'relative',
  },
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
      <AppBar className={classes.appBar}>
        <Toolbar>
          <IconButton color='inherit' edge='start' onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <Typography variant='h6' className={classes.title}>
            {patient?.name.first} {patient?.name.last}
          </Typography>
        </Toolbar>
      </AppBar>
      <Box p={3} flexGrow={1}>
        <Avatar src={picture} className={classes.picture} />
        {/*{JSON.stringify(patient)}*/}
      </Box>
    </Dialog>
  );
};
