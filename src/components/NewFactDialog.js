import React from 'react';
import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
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

const DynamicForm = ({ type, values, newFact, setNewFact }) => {
  const [num1, setNum1] = React.useState(0);
  const [num2, setNum2] = React.useState(0);
  const classes = useStyles();

  const onChangeValue = event => {
    newFact.value = event.target.value;
    setNewFact(newFact);
  };

  const onChangeNum = event => {
    newFact.value = 'number.' + event.target.value;
    setNewFact(newFact);
  };

  const onChangeNum1 = event => {
    setNum1(event.target.value);
    newFact.value = 'number.' + event.target.value + '.' + num2;
    setNewFact(newFact);
  };

  const onChangeNum2 = event => {
    setNum2(event.target.value);
    newFact.value = 'number.' + num1 + '.' + event.target.value;
    setNewFact(newFact);
  };

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
            value={type}
            onChange={onChangeValue}
            id='value-label'
            name='value'
            inputProps={{ 'aria-label': 'value' }}>
            {values.map(value => (
              <option key={value} value={'observation.' + value}>
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
          <IconButton color='inherit' onClick={handleSave}>
            <SaveIcon />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box p={3} flexGrow={1}>
        <DynamicForm type={fact?.type} values={fact?.valid_values_list} newFact={newFact} setNewFact={setNewFact} />
      </Box>
    </Dialog>
  );
};
