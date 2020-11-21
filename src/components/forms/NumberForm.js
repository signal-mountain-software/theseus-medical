import React from 'react';
import TextField from '@material-ui/core/TextField';

export default ({ open, label, value, message, onChange, onError }) => {
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
      value={value}
      label={label}
      type='number'
      variant='outlined'
      onChange={onChange}
      InputLabelProps={{ shrink: true }}
      fullWidth
    />
  );
};
