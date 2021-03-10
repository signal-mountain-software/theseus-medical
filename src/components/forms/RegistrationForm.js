import React from 'react';

import FormControl from '@material-ui/core/FormControl';
import FormGroup from '@material-ui/core/FormGroup';

import TextField from '@material-ui/core/TextField';

import makeStyles from '@material-ui/core/styles/makeStyles';

import Checkbox from '@material-ui/core/Checkbox';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';

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
  factTitle: {
    fontSize: '1.2rem',
    marginLeft: 0,
    paddingLeft: 0,
    fontWeight: 'fontWeightBold',
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
}));

export default ({ newFact, setNewFact }) => {
  const [valueCached, setValues] = React.useState({});

  const [formState, setFormState] = React.useState(1);

  const classes = useStyles();

  setValues(newFact.value);
  var values = newFact.value;

  const handleToggle = slotIndex => () => {
    if (values.slot[slotIndex].owner === newFact.patient_id) {
      values.slot[slotIndex].owner = null;
    } else {
      values.slot[slotIndex].owner = newFact.patient_id;
    }
    setValues(values);
    newFact.value = values;
    setNewFact(newFact);
    var resetter = formState + 1;
    setFormState(resetter);
  };

  const onChangeFreeName = event => {
    let slotIndex = event.target.id.substr(event.target.id.indexOf('#') + 1);
    values.slot[slotIndex].display_name = event.target.value;
    setValues(values);
    newFact.value = values;
    setNewFact(newFact);
    var resetter = formState + 1;
    setFormState(resetter);
  };

  return (
    <FormControl fullWidth>
      <FormGroup value={values} id='value-label' name='values' open={formState > 0}>
        <List className={classes.root}>
          {values.slot.map((currentSlot, vX) => {
            const labelId = `checkbox-list-label-${currentSlot.identifier}#${vX.toString()}`;
            const owned = !!currentSlot.owner;
            const ownedByMe = owned && currentSlot.owner === newFact.person_id;
            var freeName =
              currentSlot.show_slots && currentSlot.show_slots === 'no_names' && !ownedByMe
                ? 'taken'
                : currentSlot.display_name || 'available';
            return (
              <ListItem key={currentSlot.identifier} role={undefined} dense button onClick={handleToggle(vX)}>
                <ListItemIcon>
                  <Checkbox
                    edge='start'
                    checked={owned}
                    tabIndex={-1}
                    disabled={owned && !ownedByMe}
                    disableRipple
                    inputProps={{ 'aria-labelledby': labelId }}
                  />
                </ListItemIcon>
                <ListItemText id={'id-' + labelId} primary={currentSlot.identifier} />
                <TextField
                  id={'val-' + labelId}
                  value={freeName}
                  disabled={!ownedByMe}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ noWrap: true }}
                  onChange={onChangeFreeName}
                />
              </ListItem>
            );
          })}
        </List>
      </FormGroup>
    </FormControl>
  );
};
