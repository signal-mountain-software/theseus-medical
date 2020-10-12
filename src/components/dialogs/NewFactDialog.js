import React from 'react';
import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import Divider from '@material-ui/core/Divider';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import CloseIcon from '@material-ui/icons/Close';
import HistoryIcon from '@material-ui/icons/History';
import SaveIcon from '@material-ui/icons/Save';

import DynamicForm from '../forms/DynamicForm';

const useStyles = makeStyles(theme => ({
  appBar: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
}));

export default ({ fact, session, open, onClose, onSave }) => {
  const [newFact, setNewFact] = React.useState(null);
  // const [disable, setDisable] = React.useState(false);
  const [message, setMessage] = React.useState('enter an initial value');
  const classes = useStyles();

  const handleSave = () => {
    let badData = false;
    if (fact.numeric_minimum || fact.numeric_maximum) {
      let fVal = parseFloat(newFact.value.replace('.', '~').split('~')[1]);
      if (
        !fVal ||
        fVal === '' ||
        fVal < 0 ||
        (fact.numeric_minimum && fVal < parseFloat(fact.numeric_minimum)) ||
        (fact.numeric_maximum && fVal > parseFloat(fact.numeric_maximum))
      ) {
        badData = true;
      }
    }
    if (!badData) {
      setMessage('');
      onSave(newFact);
    }
  };

  const handleHistory = () => {
    setMessage('History will be available soon!');
  };

  const disableSave = value => {
    //   setDisable(value);
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
      let eString = 'Enter a number';
      if (fact.numeric_minimum) {
        if (fact.numeric_maximum) {
          eString = 'Enter a number between ' + fact.numeric_minimum + ' and ' + fact.numeric_maximum;
        } else {
          eString += ', no less than ' + fact.numeric_minimum;
        }
      } else {
        if (fact.numeric_maximum) {
          eString += ', no greater than ' + fact.numeric_maximum;
        }
        if (fact.type === 'message') {
          eString = 'Enter a message';
          fact.default_value = '';
        }
      }
      setMessage(eString);
    }
  }, [fact, session]);

  return (
    <Dialog open={open} onClose={onClose}>
      <AppBar className={classes.appBar}>
        <Toolbar>
          <Typography variant='h6' className={classes.title}>
            {fact?.name}
          </Typography>
        </Toolbar>
      </AppBar>
      {fact ? (
        <Box p={3} display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
          <Box my={1} />
          <DynamicForm
            open={open}
            newFact={newFact}
            setNewFact={setNewFact}
            type={fact.type}
            message={message}
            values={fact.valid_values_list}
            defaultValue={fact.default_value}
            observationKey={fact.observation_key}
            onError={disableSave}
            onSave={handleSave}
          />
        </Box>
      ) : null}
      <Divider />
      <Box py={2} px={3} display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
        <Button color='secondary' variant='contained' endIcon={<CloseIcon />} onClick={onClose}>
          Cancel
        </Button>
        <Box mr={2} />
        <Button color='default' variant='contained' endIcon={<HistoryIcon />} onClick={handleHistory}>
          History
        </Button>
        <Box mr={2} />
        <Button color='primary' variant='contained' startIcon={<SaveIcon />} onClick={handleSave}>
          Save
        </Button>
      </Box>
    </Dialog>
  );
};
