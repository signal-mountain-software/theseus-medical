import React from 'react';
import { Storage } from 'aws-amplify';

import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';
import FormGroup from '@material-ui/core/FormGroup';

import Input from '@material-ui/core/Input';
import TextField from '@material-ui/core/TextField';

import makeStyles from '@material-ui/core/styles/makeStyles';

import Checkbox from '@material-ui/core/Checkbox';

import NumberForm from './NumberForm';
import Number2Form from './Number2Form';
import FreeTextForm from './FreeTextForm';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';

import DialogContent from '@material-ui/core/DialogContent';

import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemSecondaryAction from '@material-ui/core/ListItemSecondaryAction';
import ListItemText from '@material-ui/core/ListItemText';
import IconButton from '@material-ui/core/IconButton';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';

// import QualifierForm from '../forms/QualifierForm';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';

import Box from '@material-ui/core/Box';
import Avatar from '@material-ui/core/Avatar';
import FaceIcon from '@material-ui/icons/Face';

const useStyles = makeStyles(theme => ({
  formControl: {
    marginLeft: theme.spacing(3),
    width: '100%',
    minWidth: '100%',
  },
  subHeader: {
    fontWeight: 'bold',
    minWidth: '100%',
  },
  defaultButton: {
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
    variant: 'outlined',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.6,
    height: theme.typography.fontSize * 2.8,
  },
  qLine: {
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
    verticalAlign: 'middle',
  },
  valueLine: {
    marginBottom: 0,
    marginTop: 0,
    paddingBottom: 0,
    lineHeight: 1,
    minWidth: '100%',
    height: theme.typography.fontSize * 25,
  },
  qualDialog: {},
  qualTitle: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.0rem',
    fontWeight: 'bold',
  },
  qualDescription: {
    marginLeft: theme.spacing(4),
    marginTop: 0,
    marginBottom: 0,
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
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
  searchText,
  setMessage,
  observationKey,
  onError,
  onSave,
  onNext,
}) => {
  const [value, setValue] = React.useState(defaultValue || '');
  const [nums, setNums] = React.useState(['', '']);
  const [mOut, setMOut] = React.useState(message || 'enter something here');

  const [boxState, setBoxState] = React.useState({});
  const [formState, setFormState] = React.useState(1);

  const [allSelections_qualValueText, set_allSelections_qualValueText] = React.useState({});
  const [qualifierTable, setQualifierTable] = React.useState({});
  const [associationsTable, setAssociationsTable] = React.useState({});
  const [qualifiers, setQualifiers] = React.useState([]);
  const [selectedFact, setSelectedFact] = React.useState('');

  const [qualifierImage, setDialogImage] = React.useState('');
  const [checked, setChecked] = React.useState([]);
  const [qualifierOpen, setQualifierOpen] = React.useState(false);
  const [qualifierData, setQualifierData] = React.useState({});
  const [OGmessage, setOGmessage] = React.useState('');

  const [qualChecked, setQualChecked] = React.useState({});
  const [qualMessage, setQualMessage] = React.useState('');
  const [OGqualifiers, setOGQualifiers] = React.useState([]);

  const [freeText, setFreeText] = React.useState('');

  // const [searchText, setSearchText] = React.useState('');
  var noToggle = false;

  const classes = useStyles();

  if (OGmessage === '') {
    setOGmessage(message);
  }

  if (Object.keys(boxState).length === 0 && values) {
    console.log('initializing');
    values.forEach(value => {
      if (value === defaultValue) {
        boxState[value] = true;
      } else {
        boxState[value] = false;
      }
      allSelections_qualValueText[value] = '';
    });
    if (valueQualifiers && valueQualifiers.length > 0) {
      valueQualifiers.forEach(vQual => {
        if (vQual && Object.keys(vQual).length > 0) {
          qualifierTable[vQual.value] = vQual;
          if (vQual.associated_activity) {
            associationsTable[vQual.value] = vQual.associated_activity;
          }
        }
      });
    }
    boxState.freeText = false;
    allSelections_qualValueText.freeText = false;
    setBoxState(boxState);
    set_allSelections_qualValueText(allSelections_qualValueText);
    setQualifierTable(qualifierTable);
    setAssociationsTable(associationsTable);
    newFact.value = {
      selected: [],
      associations: associationsTable,
    };
    setNewFact(newFact);
  }

  const handleToggle = value => () => {
    if (!noToggle) {
      const currentIndex = checked.indexOf(value);
      const newChecked = [...checked];

      if (currentIndex === -1) {
        newChecked.push(value);
      } else {
        newChecked.splice(currentIndex, 1);
      }
      setChecked(newChecked);
      if (newChecked.length === 0) {
        setMessage(OGmessage);
      } else {
        setMessage('You selected: ' + newChecked.join(' ~ '));
      }
      if (!newFact.value.hasOwnProperty('selected')) {
        newFact.value.selected = {};
      }
      newFact.value.selected = newChecked;
      setNewFact(newFact);
    } else {
      noToggle = false;
    }
  };

  const onChangeFreeText = event => {
    setFreeText(event.target.value);
  };

  const handleQClose = event => {
    setQualChecked(OGqualifiers);
    setOGQualifiers('');
    setQualifierOpen(false);
  };

  const handleQSave = () => {
    if (!newFact.value.hasOwnProperty('qualifiers')) {
      newFact.value.qualifiers = {};
    }
    newFact.value.qualifiers = qualChecked;
    if (qualChecked.hasOwnProperty(selectedFact) && qualChecked[selectedFact].length > 0) {
      if (!newFact.value.selected.includes(selectedFact)) {
        newFact.value.selected.push(selectedFact);
      }
    }
    setNewFact(newFact);
    setChecked(newFact.value.selected);
    setOGQualifiers('');
    setQualifierOpen(false);
  };

  const handleQualSelected = value => () => {
    setQualifierOpen(true);
    setQualifierData(qualifierTable[value]);
    setQualifiers(qualifierTable[value].qualifiers);
    setSelectedFact(value);
    if (!qualChecked.hasOwnProperty(value)) {
      /* no selections previously made? */
      qualChecked[value] = [];
      setQualChecked(qualChecked);
    }
    setOGQualifiers(qualChecked);
    getImage(qualifierTable[value].image_url);
    var resetter = formState + 1;
    setFormState(resetter);
    noToggle = true;
  };

  const handleToggleQual = value => () => {
    const currentIndex = qualChecked[selectedFact].indexOf(value);
    const newChecked = [...qualChecked[selectedFact]];
    if (currentIndex === -1) {
      newChecked.push(value);
    } else {
      newChecked.splice(currentIndex, 1);
    }
    qualChecked[selectedFact] = newChecked;
    setQualChecked(qualChecked);
    if (newChecked.length === 0) {
      setQualMessage('');
    } else {
      setQualMessage('Options: ' + newChecked.join(' ~ '));
    }
  };

  const onChangeValue = event => {
    //    if (event.target.value) {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    //    }
    setNewFact(newFact);
  };
  /*
  const onSearchInput = event => {
    setSearchText(event.target.value.toLowerCase());
    var resetter = formState + 1;
    setFormState(resetter); // force re-render
  };
*/

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
    if (image_name) {
      const response = await Storage.get('observation_images/' + image_name);
      setDialogImage(response);
    } else {
      setDialogImage(null);
    }
  }

  React.useEffect(() => {
    if (open) {
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
    default:
      return (
        <React.Fragment key={`selection-panel`}>
          <FormControl fullWidth>
            <FormGroup value={value} id='value-label' name='value' open={formState > 0}>
              <List className={classes.valueLine}>
                {values.map(value => {
                  const labelId = `checkbox-list-label-${value}`;
                  return value.startsWith('~~') ? (
                    <ListItem key={value} role={undefined} className={classes.defaultButton} dense>
                      <ListItemText
                        id={'subhead' + value}
                        classes={{ primary: classes.subHeader }}
                        primary={value.substr(2)}
                      />
                    </ListItem>
                  ) : searchText === '' || value.toLowerCase().includes(searchText) ? (
                    <ListItem
                      key={value}
                      role={undefined}
                      dense
                      button
                      className={classes.defaultButton}
                      onClick={handleToggle(value)}>
                      <React.Fragment key={`fragment-${value}`}>
                        <Checkbox
                          edge='start'
                          checked={checked.indexOf(value) !== -1}
                          disableRipple
                          inputProps={{ 'aria-labelledby': labelId }}
                        />
                        {value !== '~other~' ? (
                          <ListItemText
                            id={labelId}
                            fullWidth
                            primary={<Typography noWrap={true}>{value}</Typography>}
                            secondary={
                              newFact.value.qualifiers && newFact.value.qualifiers[value]
                                ? newFact.value.qualifiers[value].join(' ~ ')
                                : null
                            }
                          />
                        ) : (
                          <TextField
                            value={freeText}
                            label={labelId}
                            onChange={onChangeFreeText}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                          />
                        )}
                        {qualifierTable.hasOwnProperty(value) ? (
                          <ListItemSecondaryAction>
                            <IconButton edge='end' aria-label='comments' onClick={handleQualSelected(value)}>
                              <InfoOutlinedIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        ) : null}
                      </React.Fragment>
                    </ListItem>
                  ) : null;
                })}
              </List>
            </FormGroup>
          </FormControl>
          <Dialog
            open={qualifierOpen}
            className={classes.qualDialog}
            fullWidth
            onClose={handleQClose}
            aria-labelledby='qualifier-dialog'>
            <Box display='flex' flexDirection='row' width='95%'>
              <Box display='flex' flexDirection='column' width='95%'>
                <Typography className={classes.qualTitle} noWrap={true}>
                  {qualifierData.value}
                </Typography>
                {qualifierData.description ? (
                  <DialogContentText className={classes.qualDescription}>{qualifierData.description}</DialogContentText>
                ) : null}
                {qualChecked.hasOwnProperty(selectedFact) && qualChecked[selectedFact].length > 0 ? (
                  <DialogContentText className={classes.qualDescription}>
                    {qualChecked[selectedFact].join(' ~ ')}
                  </DialogContentText>
                ) : null}
              </Box>
              {qualifierData.image_url ? (
                <Avatar src={qualifierImage} className={classes.picture}>
                  <FaceIcon className={classes.picture} />
                </Avatar>
              ) : null}
            </Box>
            {qualifierOpen ? (
              <DialogContent pt={0}>
                <FormControl>
                  <FormGroup value={value} id='qvalue-label' name='value' open={qualifierOpen}>
                    {qualifiers
                      ? qualifiers.map(qualifier =>
                          qualifier.startsWith('~~') ? (
                            <ListItem key={value} role={undefined} className={classes.defaultButton} dense>
                              <ListItemText
                                id={'qhead' + value}
                                classes={{ primary: classes.subHeader }}
                                primary={qualifier.substr(2)}
                              />
                            </ListItem>
                          ) : (
                            <ListItem
                              key={qualifier}
                              role={undefined}
                              dense
                              button
                              className={classes.defaultButton}
                              onClick={handleToggleQual(qualifier)}>
                              <React.Fragment key={`qfragment-${qualifier}`}>
                                <Checkbox
                                  edge='start'
                                  checked={qualChecked[selectedFact].indexOf(qualifier) !== -1}
                                  name={qualifier}
                                  disableRipple
                                  inputProps={{ 'aria-labelledby': `qlabel-${qualifier}` }}
                                />
                                {value !== '~other~' ? (
                                  <ListItemText
                                    id={`qlabelid-${qualifier}`}
                                    fullWidth
                                    primary={<Typography noWrap={true}>{qualifier}</Typography>}
                                  />
                                ) : (
                                  <TextField
                                    value={freeText}
                                    label={`qlabeltext-${qualifier}`}
                                    onChange={onChangeFreeText}
                                    InputLabelProps={{ shrink: true }}
                                    fullWidth
                                  />
                                )}
                              </React.Fragment>
                            </ListItem>
                          )
                        )
                      : null}
                  </FormGroup>
                </FormControl>
              </DialogContent>
            ) : null}
            <DialogActions>
              <Button onClick={handleQClose} color='inherit' size='small' variant='contained'>
                Back
              </Button>
              <Button
                onClick={handleQSave}
                className={classes.confirm}
                variant='contained'
                color='primary'
                size='small'>
                Save
              </Button>
            </DialogActions>
          </Dialog>
        </React.Fragment>
      );
  }
};
