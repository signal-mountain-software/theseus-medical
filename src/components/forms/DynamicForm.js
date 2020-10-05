import React from 'react';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import NativeSelect from '@material-ui/core/NativeSelect';
import makeStyles from '@material-ui/core/styles/makeStyles';

import NumberForm from './NumberForm';
import Number2Form from './Number2Form';

const useStyles = makeStyles({
  formControl: {
    width: '100%',
  },
});

export default ({ open, newFact, setNewFact, type, message, values, defaultValue, observationKey, onError }) => {
  const [value, setValue] = React.useState(defaultValue || '');
  const [nums, setNums] = React.useState(['0', '0']);
  const [mOut, setMOut] = React.useState(message || 'enter something here');
  const classes = useStyles();

  const onChangeValue = event => {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    setNewFact(newFact);
  };

  const onChangeNums = index => event => {
    const newNums = [...nums];
    newNums[index] = event.target.value;
    setNums(newNums);
    newFact.value = observationKey + '.' + newNums.join('.');
    setNewFact(newFact);
  };

  React.useEffect(() => {
    if (open) {
      newFact.value = observationKey + '.' + defaultValue;
      setNewFact(newFact);
      setMOut(message);
    } else {
      setValue(defaultValue || '');
      setNums(['0', '0']);
      setMOut(message || 'enter something here');
    }
  }, [open, newFact, setNewFact, defaultValue, observationKey, message]);

  switch (type) {
    case 'characteristic_num':
      return (
        <NumberForm
          open={open}
          label='Number'
          value={value}
          message={mOut}
          onChange={onChangeValue}
          onError={onError}
        />
      );
    case 'characteristic_num2':
      return (
        <Number2Form
          open={open}
          labelOne='1st Number'
          labelTwo='2nd Number'
          value={nums}
          onChange={onChangeNums}
          onError={onError}
        />
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
