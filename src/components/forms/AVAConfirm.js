import React from 'react';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';

import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';

const useStyles = makeStyles(theme => ({
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(2),
    fontWeight: 'bold',
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  greenButton: {
    variant: 'outlined',
    backgroundColor: 'green',
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ promptText, onCancel, onConfirm }) => {

  const classes = useStyles();

  // **************************

  return (
    <Dialog
      open={true}
      p={2}
      height={250}
      width='80%'
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
    >
      <DialogContentText
        className={classes.title}
        id='scroll-dialog-title'
      >
        {promptText}
      </DialogContentText>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={classes.reject}
          size='small'
          variant='contained'
          onClick={() => {
            onCancel();
          }}>
          {'Cancel'}
        </Button>
        <Button
          className={classes.greenButton}
          size='small'
          variant='contained'
          onClick={() => {
            onConfirm();
          }}>
          {'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
