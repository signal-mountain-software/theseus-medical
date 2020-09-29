import React from 'react';
import TextField from '@material-ui/core/TextField';

export default ({ label, value, onChange, onError }) => {
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (value && (value === '' || (value.length > 1 && value.startsWith('0')))) {
      onError(true);
      setError(true);
    } else {
      onError(false);
      setError(false);
    }
  }, [value, onError]);

  return (
    <TextField
      value={value || '0'}
      label={label}
      helperText={error ? 'Incorrect entry.' : null}
      type='number'
      variant='outlined'
      error={error}
      onChange={onChange}
      InputLabelProps={{ shrink: true }}
      fullWidth
    />
  );
};
