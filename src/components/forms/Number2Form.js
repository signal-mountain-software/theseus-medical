import React from 'react';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';

export default ({ labelOne, labelTwo, value, onChange, onError }) => {
  const [errorOne, setErrorOne] = React.useState(false);
  const [errorTwo, setErrorTwo] = React.useState(false);

  React.useEffect(() => {
    if (value[0] === '' || (value[0].length > 1 && value[0].startsWith('0'))) {
      onError(true);
      setErrorOne(true);
    } else {
      onError(errorTwo);
      setErrorOne(false);
    }

    if (value[1] === '' || (value[1].length > 1 && value[1].startsWith('0'))) {
      onError(true);
      setErrorTwo(true);
    } else {
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
          helperText={errorOne ? 'Incorrect entry.' : null}
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
          helperText={errorTwo ? 'Incorrect entry.' : null}
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
