import React from 'react';
import { Storage } from 'aws-amplify';

import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import FormGroup from '@material-ui/core/FormGroup';
import Input from '@material-ui/core/Input';
import Box from '@material-ui/core/Box';

//import NativeSelect from '@material-ui/core/NativeSelect';
import RadioGroup from '@material-ui/core/RadioGroup';
import Radio from '@material-ui/core/Radio';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Checkbox from '@material-ui/core/Checkbox';

import NumberForm from './NumberForm';
import Number2Form from './Number2Form';
import FreeTextForm from './FreeTextForm';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';

import Avatar from '@material-ui/core/Avatar';
import FaceIcon from '@material-ui/icons/Face';

import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';

const useStyles = makeStyles(theme => ({
  formControl: {
    marginLeft: theme.spacing(3),
    width: '100%',
  },
  subHeader: {
    marginTop: theme.spacing(2),
    paddingBottom: 0,
  },
  valueLine: {
    marginBottom: 0,
    paddingBottom: 0,
    lineHeight: 1,
  },
  qualTitle: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    paddingBottom: 0,
    paddingTop: 0,
    paddingLeft: 0,
    fontSize: '1.3rem',
    lineHeight: 1,
  },
  qualDescription: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginTop: 0,
    paddingTop: 0,
    paddingLeft: 0,
    fontSize: '0.8rem',
    lineHeight: 1,
  },
  qualLine: {
    marginLeft: 15,
    marginTop: 0,
    paddingTop: 2,
    lineHeight: 1,
    fontSize: theme.typography.fontSize * 0.8,
  },
  picture: {
    marginTop: theme.spacing(3),
    width: theme.spacing(16),
    height: theme.spacing(16),
    [theme.breakpoints.down('xs')]: {
      width: theme.spacing(8),
      height: theme.spacing(8),
    },
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
}));

export default ({
  open,
  newFact,
  setNewFact,
  type,
  message,
  values,
  valueQualifiers,
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
  const [focusHere, setFocusHere] = React.useState(false);

  const [boxState, setBoxState] = React.useState({});
  const [formState, setFormState] = React.useState(1);
  const [formOpen, setFormOpen] = React.useState(1);

  const [qualText, setQualText] = React.useState('');
  const [allSelections_qualValueText, set_allSelections_qualValueText] = React.useState({});
  const [allSelections_qualBoxStates, set_allSelections_qualBoxStates] = React.useState({});
  const [qualifierTable, setQualifierTable] = React.useState({});
  const [qualifiers, setQualifiers] = React.useState([]);
  const [activeDialog_qualBoxState, set_activeDialog_qualBoxState] = React.useState({});
  const [allSelections_qualFreeText, set_allSelections_qualFreeText] = React.useState({});

  const [OGState, setOGState] = React.useState([]);
  const [OGValue, setOGValue] = React.useState('');
  const [OGFreeText, setOGFreeText] = React.useState('');
  const [OGnewFact, setOGnewFact] = React.useState({});

  // const [dialogText, setDialogText] = React.useState('');
  const [dialogTitle, setDialogTitle] = React.useState('');
  const [dialogBody, setDialogBody] = React.useState('');
  const [dialogImage, setDialogImage] = React.useState('');
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const [selection, setSelection] = React.useState('');

  var clickedWord = false;

  const classes = useStyles();

  if (Object.keys(boxState).length === 0 && values) {
    console.log('initializing');
    values.forEach(value => {
      boxState[value] = false;
      allSelections_qualValueText[value] = '';
    });
    if (valueQualifiers && valueQualifiers.length > 0) {
      valueQualifiers.forEach(vQual => {
        qualifierTable[vQual.value] = vQual;
      });
    }
    boxState.freeText = false;
    allSelections_qualValueText.freeText = false;
    setBoxState(boxState);
    set_allSelections_qualValueText(allSelections_qualValueText);
    setQualifierTable(qualifierTable);
    newFact.value = observationKey + '.' + defaultValue;
    setNewFact(newFact);
  }

  const qualCheckBoxChange = event => {
    console.log('in qualCheckBox', event.target.name, event.target.checked);
    activeDialog_qualBoxState[event.target.name] = event.target.checked;
    set_activeDialog_qualBoxState(activeDialog_qualBoxState);
    let xForm = formOpen + 1;
    setFormOpen(xForm);
    console.log(OGState);
  };

  const onClickedWord = event => {
    clickedWord = true;
  };

  const checkBoxChange = event => {
    if (clickedWord && !qualifierTable[event.target.name]) {
      clickedWord = false;
    }
    if (!clickedWord) {
      if (type !== 'list_multiple' && event.target.checked) {
        for (const key in boxState) {
          boxState[key] = false;
        }
      }
      boxState[event.target.name] = event.target.checked;
    }
    console.log('checkBoxChange', event.target.name, event.target.checked);
    setSelection(event.target.name);
    if (boxState[event.target.name]) {
      newFact.value = observationKey + '.' + event.target.value;
    } else {
      newFact.value = null;
    }
    setBoxState(boxState);
    console.log(boxState[event.target.name], qualifierTable[event.target.name]);
    if ((event.target.checked || clickedWord) && qualifierTable[event.target.name]) {
      //      if (qualValue[event.target.name]) { setDialogText(qualValue[event.target.name]); }
      //      else { setDialogText(''); }
      setDialogTitle(event.target.name);
      setDialogBody(qualifierTable[event.target.name].description);

      if (qualifierTable[event.target.name].hasOwnProperty('image_url')) {
        getImage(qualifierTable[event.target.name].image_url);
      } else {
        setDialogImage(null);
      }

      setQualifiers(qualifierTable[event.target.name].qualifiers);

      if (
        !allSelections_qualBoxStates.hasOwnProperty(event.target.name) &&
        qualifierTable[event.target.name].qualifiers
      ) {
        allSelections_qualBoxStates[event.target.name] = {};
        qualifierTable[event.target.name].qualifiers.forEach(qWord => {
          allSelections_qualBoxStates[event.target.name][qWord] = false;
        });
        allSelections_qualBoxStates[event.target.name].qualText = false;
      }
      set_activeDialog_qualBoxState(allSelections_qualBoxStates[event.target.name]);
      setQualText(allSelections_qualFreeText[event.target.name]);
      console.log('ready for dialog', allSelections_qualBoxStates, qualText);
      setDialogOpen(true);
    } else {
      if (!event.target.checked) {
        allSelections_qualValueText[event.target.name] = '';
        set_allSelections_qualValueText(allSelections_qualValueText);
        console.log('changing allSelections_qualValueText', allSelections_qualValueText);
      }
      setDialogOpen(false);
      var resetter = formState + 1;
      setFormState(resetter); // force re-render
    }
    var OGStateArray = [];
    for (const key in allSelections_qualBoxStates[event.target.name]) {
      if (allSelections_qualBoxStates[event.target.name][key]) {
        OGStateArray.push(key);
      }
    }
    setOGState(OGStateArray);
    setOGValue(allSelections_qualValueText[event.target.name]);
    setOGFreeText(allSelections_qualFreeText[event.target.name]);
    setOGnewFact(newFact);
    setNewFact(newFact);
  };

  const handleDialogRemoveAllSelections = event => {
    allSelections_qualBoxStates[selection] = {};
    qualifierTable[selection].qualifiers.forEach(qWord => {
      allSelections_qualBoxStates[selection][qWord] = false;
    });
    allSelections_qualBoxStates[selection].qualText = false;
    allSelections_qualFreeText[selection] = '';
    allSelections_qualValueText[selection] = '';
    set_activeDialog_qualBoxState(allSelections_qualBoxStates[selection]);
    set_allSelections_qualFreeText(allSelections_qualFreeText);
    set_allSelections_qualValueText(allSelections_qualValueText);
    set_allSelections_qualBoxStates(allSelections_qualBoxStates);
    if (newFact.hasOwnProperty('qualifier')) {
      delete newFact.qualifier;
      setNewFact(newFact);
    }
    let xForm = formOpen + 1;
    setFormOpen(xForm);
  };

  const handleDialogBack = event => {
    setDialogOpen(false);
    for (const key in allSelections_qualBoxStates[selection]) {
      allSelections_qualBoxStates[selection][key] = OGState.includes(key);
    }
    allSelections_qualFreeText[selection] = OGFreeText;
    allSelections_qualValueText[selection] = OGValue;
    set_allSelections_qualFreeText(allSelections_qualFreeText);
    set_allSelections_qualValueText(allSelections_qualValueText);
    set_allSelections_qualBoxStates(allSelections_qualBoxStates);
    newFact = OGnewFact;
    setNewFact(newFact);
  };

  const handleClose = event => {
    allSelections_qualBoxStates[selection] = activeDialog_qualBoxState;
    let comma = '';
    allSelections_qualValueText[selection] = '';
    allSelections_qualFreeText[selection] = '';
    newFact.qualifier = [];
    for (const key in activeDialog_qualBoxState) {
      if (activeDialog_qualBoxState[key]) {
        if (key === 'qualText') {
          allSelections_qualValueText[selection] += comma + qualText;
          allSelections_qualFreeText[selection] = qualText;
          newFact.qualifier.push(qualText);
        } else {
          allSelections_qualValueText[selection] += comma + key;
          newFact.qualifier.push(key);
        }
        comma = ', ';
      }
    }
    console.log('back from dialog', boxState, allSelections_qualValueText[selection]);
    if (allSelections_qualValueText[selection] !== '') {
      if (type !== 'list_multiple') {
        for (const key in boxState) {
          boxState[key] = false;
        }
      }
      boxState[selection] = true;
      setBoxState(boxState);
      setNewFact(newFact);
      console.log('reset state', boxState, allSelections_qualValueText[selection]);
    } else {
      delete newFact.qualifier;
    }
    set_allSelections_qualFreeText(allSelections_qualFreeText);
    set_allSelections_qualValueText(allSelections_qualValueText);
    set_allSelections_qualBoxStates(allSelections_qualBoxStates);
    setDialogOpen(false);
  };

  const onQualInputChange = event => {
    //    if (event.target.value) {
    setQualText(event.target.value);
    setValue(event.target.value);
    activeDialog_qualBoxState.qualText = true;
    set_activeDialog_qualBoxState(activeDialog_qualBoxState);
    //  setNewFact(newFact);
    setFocusHere(true);
  };

  const onChangeValue = event => {
    //    if (event.target.value) {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    //    }
    setNewFact(newFact);
  };

  const onInputChange = event => {
    //    if (event.target.value) {
    setFreeText(event.target.value);
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    if (type !== 'list_multiple') {
      for (const key in boxState) {
        boxState[key] = false;
      }
    }
    boxState[event.target.value] = true;
    setBoxState(boxState);
    setNewFact(newFact);
    setFocusHere(true);
  };

  const onChangeMessage = event => {
    //    if (event.target.value) {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    //    }
    setNewFact(newFact);
  };

  const checkEnter = event => {
    if (event.key === 'Enter') {
      onChangeValue(event);
      onSave();
    }
  };

  const onChangeNums = index => event => {
    //    if (event.target.value) {
    const newNums = [...nums];
    newNums[index] = event.target.value;
    setNums(newNums);
    if (newNums[0] && newNums[1]) {
      newFact.value = observationKey + '.' + newNums.join(' over ');
    } else {
      newFact.value = 'number.partial';
    }
    //    }
    setNewFact(newFact);
  };

  async function getImage(image_name) {
    const response = await Storage.get('observation_images/' + image_name);
    setDialogImage(response);
  }

  React.useEffect(() => {
    if (open) {
      if (values && values.includes('~other~')) {
        setInputAllowed(true);
      } else {
        setInputAllowed(false);
      }
      // newFact.value = observationKey + '.' + defaultValue;
      // setNewFact(newFact);
      setMOut(message);
    } else {
      setValue(defaultValue || '');
      setNums(['', '']);
      setMOut(message || 'enter something here');
    }
    // }, [open, newFact, setNewFact, defaultValue, observationKey, message, values]);
  }, [open, defaultValue, observationKey, message, values]);

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
    case 'dont use me':
      return (
        <FormControl>
          <RadioGroup
            value={value.startsWith('~~') ? value.substr(2) : value}
            id='value-label'
            name='value'
            onChange={onChangeValue}>
            {values.map(value =>
              value.startsWith('~~') ? (
                <FormLabel htmlFor='value-label' key={value + 'Label'} className={classes.subHeader}>
                  {value.substr(2)}
                </FormLabel>
              ) : value === '~other~' ? null : (
                <FormControlLabel label={value} key={value} value={value} control={<Radio />} />
              )
            )}
            {inputAllowed ? (
              <FormControlLabel
                label={
                  <Input
                    placeholder='other (specify)'
                    autoFocus={focusHere}
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
    default:
      return (
        <div>
          <FormControl>
            <FormGroup value={value} id='value-label' name='value' open={formState > 0}>
              {console.log('rendering', boxState)}
              {values.map(value =>
                boxState[value] === undefined ? (
                  (boxState[value] = false)
                ) : value.startsWith('~~') ? (
                  <FormLabel htmlFor='value-label' key={value + 'Label'} className={classes.subHeader}>
                    {value.substr(2)}
                  </FormLabel>
                ) : value === '~other~' ? null : (
                  <FormControlLabel
                    label={
                      <div onClick={onClickedWord}>
                        <Typography value={value} className={classes.valueLine}>
                          {value}
                        </Typography>
                        {allSelections_qualValueText[value] ? (
                          <Typography className={classes.qualLine}>{allSelections_qualValueText[value]}</Typography>
                        ) : null}
                      </div>
                    }
                    key={value}
                    name={value}
                    value={value.startsWith('~~') ? value.substr(3) : value}
                    control={
                      <Checkbox
                        checked={boxState[value]}
                        hidden={value.startsWith('~~')}
                        name={value}
                        onChange={checkBoxChange}
                      />
                    }
                  />
                )
              )}
              {inputAllowed ? (
                <FormControlLabel
                  label={
                    <Input
                      placeholder='other (specify)'
                      autoFocus={focusHere}
                      onChange={onInputChange}
                      name={freeText}
                      value={freeText}
                    />
                  }
                  key={freeText}
                  name='freetext'
                  value={freeText}
                  control={<Checkbox checked={boxState.freeText} name='freeText' onChange={checkBoxChange} />}
                />
              ) : null}
            </FormGroup>
          </FormControl>
          <Dialog open={dialogOpen} onClose={handleClose} aria-labelledby='form-dialog-title'>
            <Box display='flex' flexDirection='row' width='95%'>
              <Box display='flex' flexDirection='column' width='95%'>
                <DialogTitle pb={0} className={classes.qualTitle} id='form-dialog-title'>
                  {dialogTitle}
                </DialogTitle>
                <DialogContentText className={classes.qualDescription}>{dialogBody}</DialogContentText>
              </Box>
              {dialogImage ? (
                <Avatar src={dialogImage} className={classes.picture}>
                  <FaceIcon className={classes.picture} />
                </Avatar>
              ) : null}
            </Box>
            {qualifiers ? (
              <DialogContent pt={0}>
                <FormControl>
                  <FormGroup value={value} id='value-label' name='value' open={formOpen > 0}>
                    {qualifiers.map(qualifier =>
                      qualifier.startsWith('~~') ? (
                        <FormLabel htmlFor='value-label' className={classes.subHeader}>
                          {qualifier.substr(2)}
                        </FormLabel>
                      ) : qualifier === '~other~' ? null : (
                        <FormControlLabel
                          label={
                            <div>
                              <Typography className={classes.valueLine}>{qualifier}</Typography>
                            </div>
                          }
                          key={qualifier}
                          name={qualifier}
                          value={qualifier.startsWith('~~') ? qualifier.substr(3) : qualifier}
                          control={
                            <Checkbox
                              hidden={qualifier.startsWith('~~')}
                              checked={activeDialog_qualBoxState[qualifier]}
                              name={qualifier}
                              onChange={qualCheckBoxChange}
                            />
                          }
                        />
                      )
                    )}
                    <FormControlLabel
                      label={
                        <Input
                          placeholder='special request (specify)'
                          autoFocus={focusHere}
                          onChange={onQualInputChange}
                          name={qualText}
                          value={qualText}
                        />
                      }
                      key={qualText}
                      name='qualtextControl'
                      value={qualText}
                      control={
                        <Checkbox
                          checked={activeDialog_qualBoxState.qualText}
                          name='qualText'
                          onChange={qualCheckBoxChange}
                        />
                      }
                    />
                  </FormGroup>
                </FormControl>
              </DialogContent>
            ) : null}
            <DialogActions>
              <Button onClick={handleDialogBack} color='inherit' size='small' variant='contained'>
                Back
              </Button>
              {qualifiers ? (
                <Button
                  onClick={handleDialogRemoveAllSelections}
                  className={classes.reject}
                  size='small'
                  variant='contained'>
                  Remove
                </Button>
              ) : null}
              {qualifiers ? (
                <Button
                  onClick={handleClose}
                  className={classes.confirm}
                  variant='contained'
                  color='primary'
                  size='small'>
                  Save
                </Button>
              ) : null}
            </DialogActions>
          </Dialog>
        </div>
      );
  }
};
