import React from 'react';
import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import Divider from '@material-ui/core/Divider';
import FormControl from '@material-ui/core/FormControl';
import IconButton from '@material-ui/core/IconButton';
import InputLabel from '@material-ui/core/InputLabel';
import NativeSelect from '@material-ui/core/NativeSelect';
import TextField from '@material-ui/core/TextField';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import SaveIcon from '@material-ui/icons/Save';

const useStyles = makeStyles(theme => ({
  appBar: {
    position: 'relative',
  },
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
  formControl: {
    width: '100%',
  },
}));

const DynamicForm = ({ newFact, setNewFact, type, values, defaultValue, observationKey }) => {
  const [value, setValue] = React.useState(defaultValue);
  const [num1, setNum1] = React.useState(0);
  const [num2, setNum2] = React.useState(0);
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
      return (
        <TextField
          value={value || 0}
          label='Number'
          type='number'
          variant='outlined'
          onChange={onChangeValue}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      );
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

export default ({ fact, session, open, onClose, onSave }) => {
  const [newFact, setNewFact] = React.useState(null);
  const classes = useStyles();

  const handleSave = () => {
    onSave(newFact);
  };

  React.useEffect(() => {
    if (fact && session) {
      setNewFact({
        patient_id: session.patient_id || session.user_id,
        activity_key: fact.code,
        value: null,
        session: {
          user_id: session.user_id,
          session_id: session.session_id,
        },
      });
    }
  }, [fact, session]);

  return (
    <Dialog open={open} onClose={onClose}>
      <AppBar className={classes.appBar}>
        <Toolbar>
          <IconButton color='inherit' edge='start' onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <Typography variant='h6' className={classes.title}>
            Adding New Fact
          </Typography>
        </Toolbar>
      </AppBar>
      {fact ? (
        <Box p={3} display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
          <Typography variant='subtitle1'>Fact: {fact.name}</Typography>
          <Typography variant='subtitle1'>Type: {fact.type}</Typography>
          <Typography variant='subtitle1'>Reason: {fact.reason}</Typography>
          <Box my={1} />
          <DynamicForm
            newFact={newFact}
            setNewFact={setNewFact}
            type={fact.type}
            values={fact.valid_values_list}
            defaultValue={fact.default_value}
            observationKey={fact.observation_key}
          />
        </Box>
      ) : null}
      <Divider />
      <Box py={2} px={3} display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
        <Button color='secondary' variant='contained' endIcon={<CloseIcon />} onClick={onClose}>
          Cancel
        </Button>
        <Box mr={2} />
        <Button color='primary' variant='contained' startIcon={<SaveIcon />} onClick={handleSave}>
          Save
        </Button>
      </Box>
    </Dialog>
  );
};
