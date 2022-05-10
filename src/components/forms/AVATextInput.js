import React from 'react';

import Input from '@material-ui/core/Input';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';

import Paper from '@material-ui/core/Paper';
import Box from '@material-ui/core/Box';

import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { Typography } from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  freeInput: {
    marginLeft: 20,
    marginTop: 20,
    marginRight: 20,
    marginBottom: 20,
    paddingLeft: 5,
    paddingRight: 5,
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.fontSize,
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
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  rowButtonConfirm: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  rowButtonReject: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    backgroundColor: theme.palette.reject[theme.palette.type],
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
      <Typography
        className={classes.title}
        id='scroll-dialog-title'
      >
        {promptText}
      </Typography>
      <Paper component={Box} variant={'standard'} elevation={0} width='90%' overflow='auto' square>
        <Box pl={5} pr={5} display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
          <Input
            id={promptText}
            value={textInput}
            multiline
            fullWidth
            onChange={handleChangeTextInput}
            className={classes.freeInput}
            variant={'standard'}
            autoComplete='off'
          />
        </Box>
      </Paper>
      <DialogActions className={classes.buttonArea}>
        <Button
          className={classes.rowButtonReject}
          size='small'
          variant='contained'
          onClick={() => {
            onCancel();
          }}>
          {'Back'}
        </Button>
        <Button
          className={classes.rowButtonConfirm}
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
