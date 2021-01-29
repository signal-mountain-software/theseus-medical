import React from 'react';
import TextField from '@material-ui/core/TextField';

export default ({ open, label, value, message, onChange, onKeyPress, onError }) => {
  const keyWords = ['.org', 'org/', 'com/', '.com', 'http', '.mp', '.doc', '.pdf'];

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
      pt={13}
      value={
        keyWords.some(element => value.includes(element)) ? '"' + message + '" has opened in another window!' : value
      }
      multiline
      label={label}
      type='message'
      variant='outlined'
      onChange={onChange}
      onKeyPress={onKeyPress}
      InputLabelProps={{ shrink: true }}
      fullWidth
    />
  );
};
