import React from 'react';
import TextField from '@material-ui/core/TextField';

export default ({ open, label, value, message, onChange, onError }) => {
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setError(false);
      onError(false);
    }
  }, [open, onError]);

  React.useEffect(() => {
    if (!value || value === '') {
      onError(true);
      setError(true);
    } else {
      onError(false);
      setError(false);
    }
  }, [value, onError]);

  return (
    <TextField
      value={value}
      label={label}
      helperText={message}
      type='message'
      variant='outlined'
      error={error}
      onChange={onChange}
      InputLabelProps={{ shrink: true }}
      fullWidth
    />
  );
};
