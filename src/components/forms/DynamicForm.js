import React from 'react';
import Box from '@material-ui/core/Box';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import NativeSelect from '@material-ui/core/NativeSelect';
import TextField from '@material-ui/core/TextField';
import makeStyles from '@material-ui/core/styles/makeStyles';

import NumberForm from './NumberForm';

const useStyles = makeStyles({
  formControl: {
    width: '100%',
  },
});

export default ({ newFact, setNewFact, type, values, defaultValue, observationKey, onError }) => {
  const [value, setValue] = React.useState(defaultValue || '0');
  const [num1, setNum1] = React.useState('0');
  const [num2, setNum2] = React.useState('0');
  const classes = useStyles();

  const onChangeValue = event => {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    setNewFact(newFact);
  };

  const onChangeNum1 = event => {
    const value = event.target.value;
    setNum1(value);
    newFact.value = observationKey + '.' + value + '.' + num2;
    setNewFact(newFact);
  };

  const onChangeNum2 = event => {
    const value = event.target.value;
    setNum2(value);
    newFact.value = observationKey + '.' + num1 + '.' + value;
    setNewFact(newFact);
  };

  React.useEffect(() => {
    newFact.value = observationKey + '.' + defaultValue;
    setNewFact(newFact);
  }, [newFact, setNewFact, defaultValue, observationKey]);

  switch (type) {
    case 'characteristic_num':
      return <NumberForm label='Number' value={value} onChange={onChangeValue} onError={onError} />;
    case 'characteristic_num2':
      return (
        <Box display='flex' flexDirection='column'>
          <Box width='100%' my={1}>
            <TextField
              value={num1}
              label='1st Number'
              type='number'
              variant='outlined'
              onChange={onChangeNum1}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>
          <Box width='100%' my={1}>
            <TextField
              value={num2}
              label='2nd Number'
              type='number'
              variant='outlined'
              onChange={onChangeNum2}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>
        </Box>
      );
    default:
      return (
        <FormControl className={classes.formControl}>
          <InputLabel htmlFor='value-label'>Value</InputLabel>
          <NativeSelect
            value={value}
            id='value-label'
            name='value'
            onChange={onChangeValue}
            inputProps={{ 'aria-label': 'value' }}>
            {values.map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </NativeSelect>
        </FormControl>
      );
  }
};
