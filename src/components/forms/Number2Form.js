import React from 'react';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';

export default ({ open, labelOne, labelTwo, value, message, onChange, onError }) => {
  const [errorOne, setErrorOne] = React.useState(false);
  const [errorTwo, setErrorTwo] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setErrorOne(false);
      setErrorTwo(false);
      onError(false);
    }
  }, [open, onError]);

  React.useEffect(() => {
    if (!value || value[0] === '' || value[1] === '') {
      onError(true);
      switch (value[0]) {
        case '': {
          setErrorOne(true);
          break;
        }
        default: {
          setErrorOne(false);
        }
      }
      switch (value[1]) {
        case '': {
          setErrorTwo(true);
          break;
        }
        default: {
          setErrorTwo(false);
        }
      }
    } else {
      onError(errorTwo);
      setErrorOne(false);
      onError(errorOne);
      setErrorTwo(false);
    }
  }, [value, errorOne, errorTwo, onError]);

  return (
    <Grid spacing={3} container>
      <Grid xs={6} item>
        <TextField
          value={value[0]}
          label={labelOne}
          helperText={message}
          type='number'
          variant='outlined'
          error={errorOne}
          onChange={onChange(0)}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </Grid>
      <Grid xs={6} item>
        <TextField
          value={value[1]}
          label={labelTwo}
          helperText={null}
          type='number'
          variant='outlined'
          error={errorTwo}
          onChange={onChange(1)}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      </Grid>
    </Grid>
  );
};
