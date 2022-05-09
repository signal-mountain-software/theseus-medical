import React from 'react';

import TextField from '@material-ui/core/TextField';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContentText from '@material-ui/core/DialogContentText';

import Paper from '@material-ui/core/Paper';
import Box from '@material-ui/core/Box';

import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';

const useStyles = makeStyles(theme => ({
  freeInput: {
    marginLeft: '25px',
    marginTop: '5px',
    marginRight: 2,
    marginBottom: '10px',
    paddingLeft: 0,
    paddingRight: 0,
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    minHeight: theme.typography.fontSize * 2.8,
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
    fotWeight: 'bold'
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

export default ({ promptText, buttonText, onCancel, onSave }) => {

  const classes = useStyles();

  const [textInput, setTextInput] = React.useState();

  const handleChangeTextInput = event => {
    setTextInput(event.target.value);
  };

  // **************************

  return (
    <Dialog
      open={true}
      p={2}
      height={250}
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
    >
      <DialogContentText
        className={classes.title}
        id='scroll-dialog-title'
      >
        {promptText}
      </DialogContentText>
      <Paper component={Box} variant='outlined' width='100%' overflow='auto' square>
        <TextField
          id={promptText}
          value={textInput}
          multiline
          onChange={handleChangeTextInput}
          className={classes.freeInput}
          variant={'standard'}
          autoComplete='off'
        />
      </Paper>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={classes.reject}
          size='small'
          variant='contained'
          onClick={() => {
            onCancel();
          }}>
          {'Back'}
        </Button>
        <Button
          className={classes.greenButton}
          size='small'
          variant='contained'
          onClick={() => {
            onSave(textInput);
          }}>
          {buttonText}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
