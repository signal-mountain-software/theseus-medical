import React from 'react';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';

import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { Typography } from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    fontWeight: 'bold',
  },
  notTitle: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
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

  let promptLines = [];
  if (Array.isArray(promptText)) { promptLines = promptText; }
  else { promptLines = [promptText]; }

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
      {promptLines.map((pLine, index) => (
        <Typography
          className={index === 0 ? classes.title : classes.notTitle}
          id='scroll-dialog-title'
          key={'promptConfirm' + index}
        >
          {pLine}
        </Typography>
      ))}
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
