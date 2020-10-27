import React from 'react';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import Input from '@material-ui/core/Input';

//import NativeSelect from '@material-ui/core/NativeSelect';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import makeStyles from '@material-ui/core/styles/makeStyles';

import NumberForm from './NumberForm';
import Number2Form from './Number2Form';
import FreeTextForm from './FreeTextForm';

const useStyles = makeStyles({
  formControl: {
    width: '100%',
  },
});

export default ({
  open,
  newFact,
  setNewFact,
  type,
  message,
  values,
  defaultValue,
  observationKey,
  onError,
  onSave,
  onNext,
}) => {
  const [value, setValue] = React.useState(defaultValue || '');
  const [freeText, setFreeText] = React.useState('');
  const [nums, setNums] = React.useState(['', '']);
  const [mOut, setMOut] = React.useState(message || 'enter something here');
  const [inputAllowed, setInputAllowed] = React.useState(false);
  const classes = useStyles();

  const onChangeValue = event => {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    setNewFact(newFact);
  };

  const onInputChange = event => {
    setFreeText(event.target.value);
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    setNewFact(newFact);
  };

  const onChangeMessage = event => {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    setNewFact(newFact);
  };

  const checkEnter = event => {
    if (event.key === 'Enter') {
      onChangeValue(event);
      onSave();
    }
  };

  const onChangeNums = index => event => {
    const newNums = [...nums];
    newNums[index] = event.target.value;
    setNums(newNums);
    if (newNums[0] && newNums[1]) {
      newFact.value = observationKey + '.' + newNums.join(' over ');
    } else {
      newFact.value = 'number.partial';
    }
    setNewFact(newFact);
  };

  React.useEffect(() => {
    if (open) {
      if (values && values.includes('~other~')) {
        setInputAllowed(true);
      } else {
        setInputAllowed(false);
      }
      newFact.value = observationKey + '.' + defaultValue;
      setNewFact(newFact);
      setMOut(message);
    } else {
      setValue(defaultValue || '');
      setNums(['', '']);
      setMOut(message || 'enter something here');
    }
  }, [open, newFact, setNewFact, defaultValue, observationKey, message, values]);

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
          labelOne='Systolic'
          labelTwo='Diastolic'
          value={nums}
          message={mOut}
          onChange={onChangeNums}
          onError={onError}
        />
      );
    case 'message':
      return (
        <FreeTextForm
          open={open}
          label='Message'
          value={value}
          message={mOut}
          onChange={onChangeMessage}
          onKeyPress={checkEnter}
          onError={onError}
        />
      );
    default:
      return (
        <FormControl className={classes.formControl}>
          <FormLabel htmlFor='value-label'>{mOut}</FormLabel>
          <RadioGroup
            value={value}
            id='value-label'
            name='value'
            onChange={onChangeValue}
            inputProps={{ 'aria-label': 'value' }}>
            {values.map(value =>
              value === '~other~' ? null : (
                <FormControlLabel label={value} key={value} value={value} control={<Radio />} />
              )
            )}
            {inputAllowed ? (
              <FormControlLabel
                label={
                  <Input
                    autoFocus={true}
                    placeholder='other (specify)'
                    onChange={onInputChange}
                    name={'radio-input'}
                    value={freeText}
                  />
                }
                key={freeText}
                name='freetext'
                value={freeText}
                control={<Radio />}
              />
            ) : null}
          </RadioGroup>
        </FormControl>
      );
  }
};
