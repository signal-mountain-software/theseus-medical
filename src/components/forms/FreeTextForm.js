import React from 'react';
import TextField from '@material-ui/core/TextField';
import makeStyles from '@material-ui/core/styles/makeStyles';

const useStyles = makeStyles(theme => ({
  freeInput: {
    marginLeft: 0,
    marginTop: '50px',
    marginBottom: '10px',
    paddingLeft: 0,
    paddingRight: 0,
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    minHeight: theme.typography.fontSize * 2.8,
  }
}));


export default ({ open, label, value, message, onChange, onKeyPress, onError }) => {
  //const keyWords = ['.org', 'org/', 'com/', '.com', 'http', '.mp', '.doc', '.pdf'];

  const classes = useStyles();

  React.useEffect(() => {
    if (!open) {
      onError(false);
    }
  }, [open, onError]);

  React.useEffect(() => {
    if (!value || value === '') {
      onError(true);
    } else {
      onError(false);
    }
  }, [value, onError]);

  return (
    <TextField
      className={classes.freeInput}
      id={label}
      value={value}
      multiline
      label={label}
      type='message'
      variant={'standard'}
      autoComplete='off'
      onChange={onChange}
      onKeyPress={onKeyPress}
      fullWidth
    />
  );

};
