import React from 'react';
import Button from '@material-ui/core/Button';
import { fade, withStyles, makeStyles } from '@material-ui/core/styles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import InputBase from '@material-ui/core/InputBase';
import FormControl from '@material-ui/core/FormControl';

import DynamicForm from '../forms/DynamicForm';

const BootstrapInput = withStyles(theme => ({
  root: {
    marginTop: '0',
  },
  input: {
    borderRadius: 4,
    marginLeft: theme.spacing(2),
    marginTop: '0',
    marginBottom: '0',
    border: '1px solid #ced4da',
    fontSize: '0.8rem',
    width: 'auto',
    padding: '5px 6px',
    '&:focus': {
      boxShadow: `${fade(theme.palette.primary.main, 0.25)} 0 0 0 0.2rem`,
      borderColor: theme.palette.primary.main,
    },
  },
}))(InputBase);

const useStyles = makeStyles(theme => ({
  appBar: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  margin: {
    margin: theme.spacing(1),
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
    fontWeight: 'bold',
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
  },
  formControl: {
    marginLeft: theme.spacing(3),
    minWidth: '100%',
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  descriptionText: {
    marginLeft: theme.spacing(3),
    marginTop: 0,
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },
  subDescriptionText: {
    marginLeft: theme.spacing(3),
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontColor: 'red',
    fontSize: '0.8rem',
  },
  searchLine: {
    marginLeft: theme.spacing(3),
    marginRight: theme.spacing(4),
    marginTop: 0,
    marginBottom: theme.spacing(1),
    padding: 0,
    minWidth: '100%',
    fontSize: '0.8rem',
  },
  searchBox: {
    marginLeft: theme.spacing(3),
    marginRight: theme.spacing(4),
    marginTop: 0,
    marginBottom: theme.spacing(1),
    padding: 0,
    minWidth: '100%',
    fontSize: '0.8rem',
  },
}));

export default ({ fact, session, open, fromHome, onClose, onSave, onNext }) => {
  const [newFact, setNewFact] = React.useState(null);
  const [message, setMessage] = React.useState('enter an initial value');
  const [statusMessage, setStatusMessage] = React.useState('');
  const classes = useStyles();

  const [searchText, setSearchText] = React.useState('');

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

  const onSearchInput = event => {
    setSearchText(event.target.value.toLowerCase());
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
          setStatusMessage(`${fVal} is not an allowed value`);
        }
      } else if (fact.type === 'characteristic_num2' && !xVal.includes('over')) {
        badData = true;
        setStatusMessage(`We expected two numbers here`);
      }
    }
    if (!badData) {
      setMessage('');
      setStatusMessage('');
      if (withNext) {
        onNext(newFact);
      } else {
        onSave(newFact);
      }
    }
    return badData;
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
        case 'document': {
          if (fact.prompt) {
            eString = fact.prompt;
          } else {
            eString = fact.name;
          }
          break;
        }
        case 'list_multiple': {
          if (fact.prompt) {
            eString = fact.prompt;
          } else {
            eString = 'Select from this list';
          }
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
    <Dialog open={open} fullWidth={true} onClose={onClose}>
      <DialogContentText className={classes.title} id='scroll-dialog-title'>
        {fact?.name}
      </DialogContentText>
      <DialogContentText className={classes.descriptionText}>{message}</DialogContentText>
      {statusMessage ? (
        <DialogContentText className={classes.subDescriptionText}>{statusMessage}</DialogContentText>
      ) : null}
      {fact.type === 'list_multiple' ? (
        <FormControl className={classes.margin}>
          <BootstrapInput
            placeholder='Search/Filter'
            onChange={onSearchInput}
            value={searchText}
            id='bootstrap-input'
          />
        </FormControl>
      ) : null}
      <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
        {fact ? (
          <DynamicForm
            open={open}
            newFact={newFact}
            setNewFact={setNewFact}
            type={fact.type}
            message={message}
            statusMessage={statusMessage}
            values={fact.valid_values_list}
            valueQualifiers={fact.value_qualifiers}
            defaultValue={
              fact.fact_history &&
              fact.fact_history[0].value &&
              !fact.observation_status.includes('(exp)') &&
              newFact &&
              !newFact.activity_key.startsWith('form.')
                ? fact.fact_history[0].value
                : fact.default_value
            }
            lastQualifier={
              fact.fact_history &&
              fact.fact_history[0].qualifier &&
              fact.fact_history[0].qualifier.length > 0 &&
              newFact &&
              !newFact.activity_key.startsWith('form.')
                ? fact.fact_history[0].qualifier
                : []
            }
            searchText={searchText}
            setMessage={setMessage}
            setStatusMessage={setStatusMessage}
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
        {fact && fact.code && fact.code.startsWith('document.') ? null : (
          <Button variant='contained' color='primary' size='small' onClick={handleSave}>
            Save
          </Button>
        )}
        {fromHome === 'event' && (!fact || !fact.code || !fact.code.startsWith('document.')) ? (
          <Button className={classes.confirm} size='small' variant='contained' onClick={handleNext}>
            {isMobile ? 'Save +' : 'Save & Next'}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
};
