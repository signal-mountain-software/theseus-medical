import React from 'react';
import { Storage } from 'aws-amplify';

import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';

import TextField from '@material-ui/core/TextField';

import Grid from '@material-ui/core/Grid';

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
import ListItemIcon from '@material-ui/core/ListItemIcon';

import Input from '@material-ui/core/Input';
import InputAdornment from '@material-ui/core/InputAdornment';
import IconButton from '@material-ui/core/IconButton';
import SearchIcon from '@material-ui/icons/Search';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';

import DialogContentText from '@material-ui/core/DialogContentText';

import Box from '@material-ui/core/Box';
import Avatar from '@material-ui/core/Avatar';
import FaceIcon from '@material-ui/icons/Face';

const useStyles = makeStyles(theme => ({
  formControl: {
    marginLeft: theme.spacing(3),
    width: '100%',
    minWidth: '100%',
  },
  inputText: {
    paddingRight: '45px',
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
    // height: theme.typography.fontSize * 2.8,
  },
  messageInput: {
    marginLeft: 0,
    marginBottom: theme.spacing(10),
    paddingLeft: 0,
    paddingRight: 15,
    width: '95%',
    //    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    height: theme.typography.fontSize * 2.8,
  },
  freeInput: {
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 15,
    width: '95%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    height: theme.typography.fontSize * 2.8,
  },
  valueLine: {
    marginBottom: 0,
    marginTop: 0,
    paddingBottom: 0,
    lineHeight: 1,
    minWidth: '50%',
    width: '95%',
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
  factTitle: {
    fontSize: '1.2rem',
    marginLeft: 0,
    paddingLeft: 0,
    fontWeight: 'fontWeightBold',
  },
  qualDescription: {
    marginLeft: theme.spacing(4),
    marginTop: 0,
    marginBottom: 0,
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },
  qualSubDescription: {
    marginLeft: theme.spacing(4),
    marginTop: theme.spacing(1),
    marginBottom: 0,
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
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
  client,
  message,
  statusMessage,
  values,
  valueQualifiers,
  defaultValue,
  lastQualifier,
  searchText,
  setMessage,
  setStatusMessage,
  observationKey,
  onError,
  onSave,
  onNext,
}) => {
  const [value, setValue] = React.useState(defaultValue || '');
  const [nums, setNums] = React.useState(['', '']);
  const [mOut, setMOut] = React.useState(message || 'enter something here');

  const [formState, setFormState] = React.useState(1);
  const [firstTime, setFirstTime] = React.useState(true);

  const [qualifierTable, setQualifierTable] = React.useState({});
  const [associationsTable, setAssociationsTable] = React.useState({});
  const [qualifiers, setQualifiers] = React.useState([]);
  const [selectedFact, setSelectedFact] = React.useState('');

  const [qualifierImage, setDialogImage] = React.useState('');
  const [checked, setChecked] = React.useState([]);
  const [qualifierOpen, setQualifierOpen] = React.useState(false);
  const [qualifierData, setQualifierData] = React.useState({});
  const [OGmessage, setOGmessage] = React.useState('');

  const [listValues, setListValues] = React.useState([]);

  const [qualChecked, setQualChecked] = React.useState({});
  // const [qualMessage, setQualMessage] = React.useState('');
  const [OGqualifiers, setOGQualifiers] = React.useState([]);

  const [freeText, setFreeText] = React.useState('');
  const [filterText, setFilterText] = React.useState('');
  const [messageField, setMessageField] = React.useState('');

  var noToggle = false;

  const classes = useStyles();

  if (OGmessage === '') {
    setOGmessage(message);
  }

  if (firstTime) {
    console.log('initializing');
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
    setQualifierTable(qualifierTable);
    setAssociationsTable(associationsTable);

    var mF = '';
    let vL = Array.isArray(values) ? values.length : 0;
    if (vL > 0) {
      let v = 0;
      do {
        if (values[v].includes('~^')) {
          [, mF] = values[v].split(':');
        }
        v++;
      } while (v < vL && !mF);
    }
    setMessageField(mF);

    if (type !== 'reservation') {
      newFact.value = {
        selected: [],
        associations: associationsTable,
        freeText: {},
      };
    }

    setQualChecked({});

    if (defaultValue && type !== 'reservation') {
      let [dBase, dValues] = defaultValue.replace('.', '^').split('^');
      let defaultSelections;
      if (!dValues) {
        defaultSelections = [dBase];
      } else {
        defaultSelections = dValues.split(' ~ ');
      }
      if (defaultSelections.length > 0) {
        setValue(defaultSelections[0]); /* this line handles numeric & text defaults */
        setNums(defaultSelections[0].split(' over ')); /* two numbers */
        /* the rest handles selection screen defaults */
        defaultSelections.forEach(nfValue => {
          let [value, freeText] = nfValue.split('=');
          value = value.trim();
          if (freeText) {
            freeText = freeText.trim();
            newFact.value.freeText[value] = freeText;
            if (value === mF) {
              setMessage(freeText);
            } else {
              if (value === '%filter%') {
                setFilterText(freeText);
              }
            }
          } else {
            newFact.value.selected.push(value);
          }
        });
      }
      if (lastQualifier.length > 0) {
        newFact.value.qualifiers = {};
        lastQualifier.forEach(qStr => {
          let [value, qArr] = qStr.split(':');
          newFact.value.qualifiers[value] = [...qArr.split(',')];
        });
        setQualChecked(newFact.value.qualifiers);
      }
    }

    setChecked(type !== 'reservation' ? newFact.value.selected : {});
    setNewFact(newFact);
    setFirstTime(false);
  }

  const onChangeFreeName = event => {
    let slotIndex = event.target.id.substr(event.target.id.indexOf('#') + 1);
    newFact.value.slot[slotIndex].display_name = event.target.value;
    newFact.value.slot[slotIndex].action = 'set name to ' + event.target.value;
    setNewFact(newFact);
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const handleReserve = slotIndex => () => {
    if (newFact.value.slot[slotIndex].owner === newFact.patient_id) {
      newFact.value.slot[slotIndex].owner = null;
      newFact.value.slot[slotIndex].action = 'relinquished';
    } else {
      newFact.value.slot[slotIndex].owner = newFact.patient_id;
      newFact.value.slot[slotIndex].action = 'reserved';
    }
    setNewFact(newFact);
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const handleToggle = value => () => {
    // noToggle ignores the whole function code (used when handleToggle is fired by the OS)
    if (!noToggle) {
      const currentIndex = checked.indexOf(value);
      const newChecked = [...checked];

      if (currentIndex === -1) {
        newChecked.push(value);
      } else {
        newChecked.splice(currentIndex, 1); /* this removes the check mark */
      }
      setChecked(newChecked);

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
    newFact.value.freeText[event.target.id] = event.target.value;
    setNewFact(newFact);
    if (event.target.id === messageField) {
      setMessage(event.target.value);
    }
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const onChangeFilterText = event => {
    setFilterText(event.target.value);
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const handleFilterText = () => {
    newFact.value.freeText['%filter%'] = filterText;
    setNewFact(newFact);
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const onChangeQualText = event => {
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
    qualChecked[selectedFact].forEach((key, index) => {
      if (key.startsWith('~other')) {
        qualChecked[selectedFact][index] = freeText;
      }
    });
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
    var resetter = formState + 1;
    setFormState(resetter);
    // if (newChecked.length === 0) {
    //   setQualMessage('');
    // } else {
    //   setQualMessage('Options: ' + newChecked.join(' ~ '));
    // }
  };

  const onChangeValue = event => {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    setNewFact(newFact);
  };

  const onChangeMessage = event => {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    setNewFact(newFact);
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
      setMOut(message || 'Enter something here');
    }
  }, [open, defaultValue, observationKey, message, values]);

  React.useEffect(() => {
    if (values) {
      let filtering = false;
      let search1 = null;
      if (newFact && newFact.value && newFact.value.freeText && newFact.value.freeText['%filter%']) {
        search1 = newFact.value.freeText['%filter%'].toLowerCase();
      }
      let search2 = searchText.toLowerCase();
      let listDisplay;

      listDisplay = values.filter(word => {
        if (!filtering && word.includes('~%')) {
          filtering = true;
          return true;
        }
        return (
          ((!search2 || word.toLowerCase().includes(search2)) &&
            (!filtering || (search1 && word.toLowerCase().includes(search1)))) ||
          word.includes('~!') ||
          checked.includes(word)
        );
      });

      setListValues(listDisplay);
    }
  }, [checked, formState, newFact, searchText, values]);

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
    case 'reservation':
      return (
        <FormControl fullWidth>
          <FormGroup value={newFact.value} id='value-label' name='values' open={formState > 0}>
            <List className={classes.root}>
              {newFact.value.slot.map((currentSlot, vX) => {
                const labelId = `checkbox-list-label-${currentSlot.identifier}#${vX.toString()}`;
                const owned = !!currentSlot.owner;
                const ownedByMe = owned && currentSlot.owner === newFact.session.user_id;
                var freeName =
                  currentSlot.show_slots && currentSlot.show_slots === 'no_names' && !ownedByMe
                    ? 'taken'
                    : currentSlot.display_name || '';
                return (
                  <ListItem key={currentSlot.identifier} role={undefined} dense button onClick={handleReserve(vX)}>
                    <ListItemIcon>
                      {!owned || ownedByMe ? (
                        <Checkbox
                          edge='start'
                          checked={owned}
                          tabIndex={-1}
                          disabled={owned && !ownedByMe}
                          disableRipple
                          inputProps={{ 'aria-labelledby': labelId }}
                        />
                      ) : null}
                    </ListItemIcon>
                    <ListItemText id={'id-' + labelId} primary={currentSlot.identifier} />
                    <ListItemSecondaryAction>
                      {owned ? (
                        <TextField
                          id={'val-' + labelId}
                          value={freeName}
                          disabled={!ownedByMe}
                          InputLabelProps={{ shrink: true }}
                          InputProps={{ noWrap: true }}
                          onChange={onChangeFreeName}
                        />
                      ) : null}
                    </ListItemSecondaryAction>
                  </ListItem>
                );
              })}
            </List>
          </FormGroup>
        </FormControl>
      );
    case 'document':
      if (firstTime) {
        window.open(defaultValue, '_blank');
      }
    // intentionally fall through to the message case

    case 'message':
      return (
        <FreeTextForm
          open={open}
          label='Message'
          value={value}
          message={mOut}
          onChange={onChangeMessage}
          onError={onError}
        />
      );
    default:
      if (checked.length === 0) {
        setStatusMessage('');
      } else {
        let stopAt = checked.length - 1;
        let sMess = 'You selected: ';
        checked.forEach((entry, index) => {
          sMess += entry.split(':')[0] + (index < stopAt ? ' ~ ' : '');
        });
        setStatusMessage(sMess);
      }
      return (
        <React.Fragment key={`selection-panel`}>
          <FormControl fullWidth>
            <FormGroup value={value} id='value-label' name='value' open={formState > 0}>
              <List className={classes.valueLine}>
                {listValues.map((value, vIndex) => {
                  const labelId = `checkbox-list-label-${value}`;
                  /* ~~ is a header */
                  /* ~other:<text> means prompt for input with <text> */
                  /* ~^ means "put this value in the message area (below the title) */
                  /* ~~! or ~! means "always show this line" */
                  /* ~% means suppress all lines after this one that do not include 
                      the freetext attached to this line 
                      (prompt for freeText with ~%other:<prompt text>) */
                  return value.startsWith('~~') ? (
                    <ListItem key={value + vIndex.toString()} role={undefined} dense className={classes.factTitle}>
                      <ListItemText
                        id={'subhead' + value}
                        classes={{ primary: classes.factTitle }}
                        primary={
                          <Typography noWrap={true} className={classes.factTitle}>
                            {value.replace('!', '').substr(2)}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ) : (
                    <ListItem
                      id={'blockhead' + value}
                      key={value + vIndex.toString()}
                      role={undefined}
                      dense
                      className={classes.defaultButton}>
                      {!value.includes('other:') ? (
                        <React.Fragment key={`fragment-${value}-${vIndex.toString()}`}>
                          <Checkbox
                            edge='start'
                            checked={checked.indexOf(value) !== -1}
                            disableRipple
                            onClick={handleToggle(value)}
                            inputProps={{ 'aria-labelledby': labelId }}
                          />
                          {qualifierTable.hasOwnProperty(value) ? (
                            <ListItemSecondaryAction>
                              <IconButton edge='end' aria-label='comments' onClick={handleQualSelected(value)}>
                                <InfoOutlinedIcon />
                              </IconButton>
                            </ListItemSecondaryAction>
                          ) : null}
                          <ListItemText
                            id={labelId}
                            onClick={handleToggle(value)}
                            classes={{ root: classes.inputText }}
                            primary={value.split(':')[0]}
                            secondary={
                              newFact && newFact.value && newFact.value.qualifiers && newFact.value.qualifiers[value]
                                ? newFact.value.qualifiers[value].join(' ~ ')
                                : null
                            }
                          />
                        </React.Fragment>
                      ) : !value.includes('~%') && !value.includes('~^') ? (
                        <FormControl className={classes.freeInput}>
                          <TextField
                            id={value.split(':')[1]}
                            placeholder={value.split(':')[1]}
                            value={
                              newFact.value && newFact.value.freeText && newFact.value.freeText[value.split(':')[1]]
                                ? newFact.value.freeText[value.split(':')[1]]
                                : ''
                            }
                            InputLabelProps={{ shrink: true }}
                            InputProps={{ noWrap: true }}
                            onChange={onChangeFreeText}
                          />
                        </FormControl>
                      ) : value.includes('~%') ? (
                        <FormControl className={classes.freeInput}>
                          <Input
                            id='%filter-input%'
                            type='text'
                            onChange={onChangeFilterText}
                            placeholder={value.split(':')[1]}
                            value={filterText}
                            endAdornment={
                              <InputAdornment position='end'>
                                <IconButton id='%filter%' aria-label='trigger-filter-action' onClick={handleFilterText}>
                                  <SearchIcon />
                                </IconButton>
                              </InputAdornment>
                            }
                          />
                        </FormControl>
                      ) : (
                        //                        <FormControl className={classes.messageInput}>
                        <TextField
                          id={value.split(':')[1]}
                          label={value.split(':')[1]}
                          multiline
                          fullWidth
                          rows={5}
                          type='text'
                          variant='outlined'
                          value={
                            newFact.value && newFact.value.freeText && newFact.value.freeText[value.split(':')[1]]
                              ? newFact.value.freeText[value.split(':')[1]]
                              : ''
                          }
                          InputLabelProps={{ shrink: true }}
                          onChange={onChangeFreeText}
                        />
                        //                        </FormControl>
                      )}
                    </ListItem>
                  );
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
                  {qualifierData.value ? qualifierData.value.split(':')[0] : null}
                </Typography>
                {qualifierData.description ? (
                  <DialogContentText className={classes.qualDescription}>{qualifierData.description}</DialogContentText>
                ) : null}
                {qualChecked && qualChecked.hasOwnProperty(selectedFact) && qualChecked[selectedFact].length > 0 ? (
                  <DialogContentText className={classes.qualSubDescription}>
                    You selected: {qualChecked[selectedFact].join(' ~ ').replace('~other:', '')}
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
                      ? qualifiers.map((qualifier, qIndex) =>
                          qualifier.startsWith('~~') ? (
                            <ListItem
                              key={value + qIndex.toString()}
                              role={undefined}
                              className={classes.defaultButton}
                              dense>
                              <ListItemText
                                id={'qhead' + value}
                                classes={{ primary: classes.subHeader }}
                                primary={qualifier.substr(2)}
                              />
                            </ListItem>
                          ) : (
                            <ListItem
                              key={qualifier + qIndex.toString()}
                              role={undefined}
                              dense
                              button
                              className={classes.defaultButton}
                              onClick={handleToggleQual(qualifier)}>
                              <React.Fragment key={`qfragment-${qualifier}-${qIndex.toString()}`}>
                                <Checkbox
                                  edge='start'
                                  checked={qualChecked && qualChecked[selectedFact].indexOf(qualifier) !== -1}
                                  name={qualifier}
                                  disableRipple
                                  inputProps={{ 'aria-labelledby': `qlabel-${qualifier}` }}
                                />
                                {!qualifier.startsWith('~other') ? (
                                  <ListItemText
                                    id={`qlabelid-${qualifier}`}
                                    fullWidth
                                    primary={<Typography noWrap={true}>{qualifier}</Typography>}
                                  />
                                ) : (
                                  <FormControl fullWidth>
                                    <Grid
                                      container
                                      alignItems='center'
                                      justifyContent='flex-start'
                                      className={classes.defaultButton}>
                                      <Grid item marginRight={1} paddingRight={2}>
                                        <Typography noWrap={true} marginRight={1}>
                                          {qualifier.split(':')[1] + ':'}
                                        </Typography>
                                      </Grid>
                                      <Grid item>
                                        <Typography>
                                          <span>&nbsp;&nbsp;</span>
                                        </Typography>
                                      </Grid>
                                      <Grid item>
                                        <TextField
                                          value={freeText}
                                          onChange={onChangeQualText}
                                          InputLabelProps={{ shrink: true }}
                                          InputProps={{ marginLeft: '2' }}
                                          fullWidth
                                        />
                                      </Grid>
                                    </Grid>
                                  </FormControl>
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
