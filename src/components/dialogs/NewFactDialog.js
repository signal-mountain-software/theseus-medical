import React from 'react';
//import AppBar from '@material-ui/core/AppBar';
//import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
//import Divider from '@material-ui/core/Divider';
//import Toolbar from '@material-ui/core/Toolbar';
//import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import DynamicForm from '../forms/DynamicForm';

const useStyles = makeStyles(theme => ({
  appBar: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
    fontWeight: 'bold',
  },
  formControl: {
    marginLeft: theme.spacing(3),
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  descriptionText: {
    marginLeft: theme.spacing(3),
    marginRight: theme.spacing(1),
    marginTop: 0,
    fontSize: '0.8rem',
  },
}));

export default ({ fact, session, open, onClose, onSave, onNext }) => {
  const [newFact, setNewFact] = React.useState(null);
  // const [disable, setDisable] = React.useState(false);
  const [message, setMessage] = React.useState('enter an initial value');
  const classes = useStyles();

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone

  var withNext;

  const handleNext = () => {
    withNext = true;
    handleExit();
  };

  const handleSave = () => {
    withNext = false;
    handleExit();
  };

  const handleExit = () => {
    let badData = false;
    if (typeof newFact.value !== 'object') {
      let xVal = newFact.value.replace('.', '~').split('~')[1];
      if (xVal === 'null' || xVal === '') {
        badData = true;
      } else if (fact.numeric_minimum || fact.numeric_maximum) {
        let fVal = parseFloat(xVal);
        if (
          !fVal ||
          fVal === '' ||
          fVal < 0 ||
          (fact.numeric_minimum && fVal < parseFloat(fact.numeric_minimum)) ||
          (fact.numeric_maximum && fVal > parseFloat(fact.numeric_maximum))
        ) {
          badData = true;
        }
      } else if (fact.type === 'characteristic_num2' && !xVal.includes('over')) {
        badData = true;
      }
    }
    if (!badData) {
      setMessage('');
      if (withNext) {
        onNext(newFact);
      } else {
        onSave(newFact);
      }
    }
    return badData;
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
      let eString;
      switch (fact.type) {
        case 'characteristic_num2': {
          if (fact.prompt) {
            eString = fact.prompt;
          } else {
            eString = 'Enter numbers in both boxes';
          }
          break;
        }
        case 'characteristic_num': {
          if (fact.prompt) {
            eString = fact.prompt;
          } else {
            eString = 'Enter a number';
            if (fact.numeric_minimum) {
              if (fact.numeric_maximum) {
                eString += ' between ' + fact.numeric_minimum + ' and ' + fact.numeric_maximum;
              } else {
                eString += ', no less than ' + fact.numeric_minimum;
              }
            } else {
              if (fact.numeric_maximum) {
                eString += ', no greater than ' + fact.numeric_maximum;
              }
            }
          }
          break;
        }
        case 'message': {
          if (fact.prompt) {
            eString = fact.prompt;
          } else {
            eString = 'Enter a message';
          }
          fact.default_value = '';
          break;
        }
        case 'list_multiple': {
          eString = 'Select all that apply';
          break;
        }
        default: {
          if (fact.prompt) {
            eString = fact.prompt;
          } else {
            eString = 'Select one';
          }
        }
      }
      setMessage(eString);
    }
  }, [fact, session]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContentText className={classes.title} id='scroll-dialog-title'>
        {fact?.name}
      </DialogContentText>
      <DialogContentText className={classes.descriptionText}>{message}</DialogContentText>
      <DialogContent dividers={true}>
        {fact ? (
          <DynamicForm
            open={open}
            newFact={newFact}
            setNewFact={setNewFact}
            type={fact.type}
            message={message}
            values={fact.valid_values_list}
            valueQualifiers={fact.value_qualifiers}
            defaultValue={fact.default_value}
            observationKey={fact.observation_key}
            onError={disableSave}
            onSave={handleSave}
            onNext={handleNext}
          />
        ) : null}
      </DialogContent>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button className={classes.reject} size='small' variant='contained' onClick={onClose}>
          {isMobile ? 'Can' : 'Cancel'}
        </Button>
        <Button color='inherit' size='small' variant='contained' onClick={handleHistory}>
          {isMobile ? 'Hist' : 'History'}
        </Button>
        <Button variant='contained' color='primary' size='small' onClick={handleSave}>
          Save
        </Button>
        <Button className={classes.confirm} size='small' variant='contained' onClick={handleNext}>
          {isMobile ? 'Save +' : 'Save & Next'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
