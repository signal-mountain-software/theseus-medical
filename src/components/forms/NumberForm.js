import React from 'react';
import TextField from '@material-ui/core/TextField';

export default ({ label, value, message, onChange, onError }) => {
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    //    if (numMin && value < numMin) {
    //    onError(true);
    //  setError(true);
    //  } else {
    onError(false);
    setError(false);
    //   }
  }, [value, onError]);

  return (
    <TextField
      value={value}
      label={label}
      helperText={message}
      type='number'
      variant='outlined'
      error={error}
      onChange={onChange}
      InputLabelProps={{ shrink: true }}
      fullWidth
    />
  );
};
