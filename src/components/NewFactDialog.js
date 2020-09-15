import React from 'react';
import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import IconButton from '@material-ui/core/IconButton';
import Slide from '@material-ui/core/Slide';
import TextField from '@material-ui/core/TextField';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import SaveIcon from '@material-ui/icons/Save';
import InputLabel from '@material-ui/core/InputLabel';
import NativeSelect from '@material-ui/core/NativeSelect';
import FormControl from '@material-ui/core/FormControl';

const useStyles = makeStyles(theme => ({
  appBar: {
    position: 'relative',
  },
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
  formControl: {
    margin: theme.spacing(1),
    width: '100%',
  },
}));

const DynamicForm = ({ newFact, setNewFact, type, values, defaultValue, observationKey }) => {
  const [value, setValue] = React.useState('');
  const [num1, setNum1] = React.useState(0);
  const [num2, setNum2] = React.useState(0);
  const classes = useStyles();

  const onChangeValue = event => {
    setValue(event.target.value);
    newFact.value = observationKey + '.' + event.target.value;
    setNewFact(newFact);
  };

  const onChangeNum = event => {
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
    if (defaultValue && observationKey) {
      newFact.value = observationKey + '.' + defaultValue;
      setNewFact(newFact);
      setValue(defaultValue);
    }
  }, [newFact, setNewFact, defaultValue, observationKey]);

  switch (type) {
    case 'characteristic_num':
      return (
        <TextField
          label='Number'
          type='number'
          variant='outlined'
          onChange={onChangeNum}
          InputLabelProps={{ shrink: true }}
          fullWidth
        />
      );
    case 'characteristic_num2':
      return (
        <Box display='flex' flexDirection='column'>
          <Box width='100%' my={1}>
            <TextField
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

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ fact, session, open, onClose, onSave }) => {
  const [newFact, setNewFact] = React.useState(null);
  const classes = useStyles();

  const handleSave = () => {
    onSave(newFact);
  };

  React.useEffect(() => {
    if (fact && session) {
      setNewFact({
        patient_id: session.patient_id,
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
    <Dialog open={open} onClose={onClose} TransitionComponent={Transition}>
      <AppBar className={classes.appBar}>
        <Toolbar>
          <IconButton color='inherit' edge='start' onClick={onClose}>
            <CloseIcon />
          </IconButton>
          <Typography variant='h6' className={classes.title}>
            Adding New '{fact?.name}' Fact
          </Typography>
        </Toolbar>
      </AppBar>
      <Box p={3} flexGrow={1}>
        <DynamicForm
          newFact={newFact}
          setNewFact={setNewFact}
          type={fact?.type}
          values={fact?.valid_values_list}
          defaultValue={fact?.default_value}
          observationKey={fact?.observation_key}
        />
      </Box>
      <Box p={2} flexGrow={1} display='flex' flexDirection='row' justifyContent='flex-end' alignItems='center'>
        <Button color='primary' variant='contained' startIcon={<SaveIcon />} onClick={handleSave}>
          Save
        </Button>
      </Box>
    </Dialog>
  );
};
