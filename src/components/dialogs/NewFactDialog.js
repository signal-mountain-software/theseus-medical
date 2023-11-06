import React from 'react';
import Button from '@material-ui/core/Button';
import { makeStyles } from '@material-ui/core/styles';
// import useMediaQuery from '@material-ui/core/useMediaQuery';

import { useSnackbar } from 'notistack';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import DynamicForm from '../forms/DynamicForm';

import { AVAclasses } from '../../util/AVAStyles';

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
  reject: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(3),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    color: theme.palette.reject[theme.palette.type],
  },
  confirm: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(3),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    color: theme.palette.confirm[theme.palette.type],
  },
  descriptionText: {
    marginLeft: theme.spacing(3),
    marginTop: 0,
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
  },
  warningText: {
    marginLeft: theme.spacing(3),
    marginTop: 0,
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
    fontWeight: 'bold',
    color: 'red'
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

export default ({ fact, session, open, fromHome, onClose, onSave, onNext, onSelected }) => {
  const [newFact, setNewFact] = React.useState(null);
  const [message, setMessage] = React.useState('enter an initial value');
  const [statusMessage, setStatusMessage] = React.useState('');
  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { enqueueSnackbar } = useSnackbar();

  const [factIOClass, setFactIOClass] = React.useState(false);
  const [factPromoClass, setFactPromoClass] = React.useState(false);
  const [factEventClass, setFactEventClass] = React.useState(false);
  const [factMessageClass, setFactMessageClass] = React.useState(false);

  const [executionDefaultValue, setExecutionDefaultValue] = React.useState('');
  const [qualifierTable, setQualifierTable] = React.useState({});
  const [associationsTable, setAssociationsTable] = React.useState({});

  var withNext;
  var oopsie;

  const handleNext = () => {
    withNext = true;
    handleExit();
  };

  const handleSkip = () => {
    withNext = true;
    newFact.value = 'value.SKIPPED';
    setNewFact(newFact);
    onNext(newFact);
  };

  const handleSave = () => {
    if (newFact.value.recordingStatus === 'started') {
      enqueueSnackbar(`AVA is still recording!  Tap the square button to stop recording before tapping Save.`, { variant: 'warning', persist: true });
    }
    else {
      withNext = false;
      handleExit();
    }
  };

  const handlePromoSignup = () => {
    withNext = false;
    onSelected(fact.valid_values_list[1]);
  };

  const handlePromoMore = () => {
    withNext = false;
    window.open(fact.valid_values_list[2]);
  };

  const handlePromoNext = () => {
    withNext = false;
    onSelected(fact.valid_values_list[3]);
    open = false;
    onClose();
  };

  /*
  const onSearchInput = event => {
    setSearchText(event.target.value.toLowerCase());
  };
  */

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
    } else {
      if (fact.numeric_minimum
        && (!fact.type.startsWith('characteristic_num'))
        && newFact.value.selected
        && newFact.value.selected.length < parseInt(fact.numeric_minimum, 10)) {
        badData = true;
        if (newFact.value.selected.length === 0) {
          oopsie = `Ooops!  I don't see that you made any selections before pressing SAVE.
              You need to make at least ${fact.numeric_minimum} selection${fact.numerica_minimum === '1' ? '' : 's'}, please.`;
        }
        else if (newFact.value.selected.length === 1) {
          oopsie = `Ooops!  Did you forget something?  We expected at least ${fact.numeric_minimum} selections, 
              but I only see 1... ${newFact.value.selected.join(', ')}`;
        }
        else {
          oopsie = `Ooops!  Did you forget something?  We expected at least ${fact.numeric_minimum} selections, 
              but I only see ${newFact.value.selected.length}.  They are: ${newFact.value.selected.join(', ')}`;
        }
        enqueueSnackbar(oopsie, { variant: 'error', persist: true });
        setMessage('!!!!! ' + oopsie + ' !!!!!');
      }
      else if (factMessageClass) {
        let goodMessage = false;
        for (let e in newFact.value.freeText) {
          goodMessage = (e.slice(0, 1) !== '%') || goodMessage;
        }
        if (!goodMessage) {
          badData = true;
          oopsie = 'Enter your message text before pressing SEND';
          enqueueSnackbar(oopsie, { variant: 'error', persist: true });
          setMessage('!!!!! ' + oopsie + ' !!!!!');
        }
      }
      else {
        if (fact.type === 'upload_file' && !newFact.value.mediaData) {
          badData = true;
          oopsie = 'You must choose a file to upload before pressing SAVE';
          enqueueSnackbar(oopsie, { variant: 'error', persist: true });
          setMessage('!!!!! ' + oopsie + ' !!!!!');
        }
      }
    }
    if (!badData) {
      setMessage('');
      setStatusMessage('');
      if (!factIOClass) { handleClose(); }
      else if (withNext) { onNext(newFact); }
      else { onSave(newFact); }
    }
    return badData;
  };

  const handleClose = () => {
    if (newFact.value.recordingStatus === 'started') {
      enqueueSnackbar(`Warning!  You'll lose everything!  AVA is still recording.  Press the square button to stop recording, then Cancel or Save.`, { variant: 'warning', persist: true });
    }
    else {
      onClose(factIOClass ? `You pressed CANCEL. ${fact.name} was not completed.` : null);
    }
  };

  const disableSave = value => {
    //   setDisable(value);
  };

  React.useEffect(() => {
    if (fact && session) {
      let factCode = (fact.code || fact.activity_code).split('.')[0];
      setFactEventClass(false);
      switch (factCode) {
        case 'document':
        case 'render':
        case 'query':
        case 'action':
        case 'list': { break; }
        case 'media': { setFactIOClass(true); break; }
        case 'message': { setFactMessageClass(true); setFactIOClass(true); break; }
        case 'promo': { setFactPromoClass(true); break; }
        case 'search': { setFactEventClass(true); break; }
        default: {
          setFactIOClass(true);
          if (fromHome === 'event') {
            setFactEventClass(true);
          }
        }
      }
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
        case 'make_message': {
          setFactIOClass(false);
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
        case 'reservation':
        case 'form': {
          setFactEventClass(false);
          if (fact.prompt) {
            eString = fact.prompt;
          } else {
            eString = ' ';
          }
          break;
        }
        default: {
          if (fact.prompt) {
            eString = fact.prompt;
          } else {
            eString = ' ';
          }
        }
      }
      setMessage(eString);
    }

    if (!fact) {
      // eslint-disable-next-line
      fact = { "noData": true };
    };

    let defaultValue = '';
    let lQ = [];
    try {
      if (fact.fact_history &&
        fact.fact_history[0].value &&
        !fact.observation_status.includes('(exp)') &&
        !fact.code.startsWith('form.') &&
        !fact.code.startsWith('media.')
      ) { defaultValue = fact.fact_history[0].value; }
      else { defaultValue = fact.default_value; };
      if (
        fact.fact_history &&
        fact.fact_history[0].qualifier &&
        fact.fact_history[0].qualifier.length > 0 &&
        !fact.code.startsWith('form.')) {
        lQ = fact.fact_history[0].qualifier;
      };
    }
    catch (e) {
      console.error(e);
    }
    setExecutionDefaultValue(defaultValue);
    setQualifierTable(fact.value_qualifiers);
    setAssociationsTable(associationsTable);

    var mF = '';
    let vL = Array.isArray(fact.valid_values_list) ? fact.valid_values_list.length : 0;
    if (vL > 0) {
      let v = 0;
      do {
        if (fact.valid_values_list[v].includes('~^')) {     // ~^ indicates free form text box 
          [, mF] = fact.valid_values_list[v].split(':');    // prompt with the string after the ":"
        }
        v++;
      } while (v < vL && !mF);
    }

    let nF = {
      client_id: fact.client_id || session.client_id,
      patient_id: session.patient_id || session.user_id,
      activity_key: fact.code || fact.activity_code,
      value: (fact.type === 'reservation')
        ? fact.default_value
        : {
          selected: [],
          associations: associationsTable,
          freeText: {},
        },
      session: {
        user_id: session.user_id,
        session_id: session.session_id,
      },
    };

    if ('messaging' in fact) { nF.messaging = fact.messaging; }

    if (defaultValue
      && fact.type !== 'reservation'
      && fact.type !== 'play_video'
      && fact.type !== 'make_message'
    ) {
      if (defaultValue.length > 0) {
        defaultValue.forEach(nfValue => {
          if (typeof nfValue === 'string') {
            let [value, freeText] = nfValue.trim().split("=");
            value = value.trim();
            if (freeText) {
              freeText = freeText.trim();
              nF.value.freeText[value] = freeText;
              if (value === mF) {
                setMessage(freeText);
              }
            } else {
              nF.value.selected.push(value);
            }
          }
        });
      }

      if (lQ.length > 0) {
        nF.value.qualifiers = {};
        lQ.forEach(qStr => {
          let [value, qArr] = qStr.split(':');
          nF.value.qualifiers[value] = [...qArr.split(',')];
        });
      }
    }

    setNewFact(nF);

  }, [fact]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Dialog open={open} fullScreen >
      <DialogContentText className={classes.title} id='scroll-dialog-title'>
        {fact?.name}
      </DialogContentText>
      {message?.startsWith('!!!')
        ? <DialogContentText className={classes.warningText}>{message}</DialogContentText>
        : <DialogContentText className={classes.descriptionText}>{message}</DialogContentText>
      }
      {statusMessage &&
        <DialogContentText className={classes.subDescriptionText}>{statusMessage}</DialogContentText>
      }
      <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
        {fact ? (
          <DynamicForm
            open={open}
            newFact={newFact}
            setNewFact={setNewFact}
            type={fact.type}
            factName={fact.name}
            session={session}
            message={message}
            values={fact.valid_values_list}
            qualifierTable={qualifierTable}
            defaultValue={executionDefaultValue}
            defaultObject={fact.default_object}
            observationKey={fact.observation_key}
            onError={disableSave}
            onSave={handleSave}
            onClose={handleClose}
          />
        ) : null}
      </DialogContent>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          onClick={handleClose}
        >
          {!factIOClass ? 'Done' : 'Cancel'}
        </Button>
        {factIOClass
          ? (<Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'green', color: 'white' }}
            size='small'
            onClick={handleSave}
          >
            {factMessageClass ? 'Send' : 'Save'}
          </Button>
          )
          : null
        }
        {factPromoClass
          ? (<React.Fragment>
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'green', color: 'white' }}
              size='small'
              onClick={handlePromoSignup}>
              Sign-up
            </Button>
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'blue', color: 'white' }}
              size='small'
              onClick={handlePromoMore}>
              More info
            </Button>
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'blue', color: 'white' }}
              size='small'
              onClick={handlePromoNext}>
              Next
            </Button>
          </React.Fragment>)
          : null
        }
        {factEventClass
          ? (
            <React.Fragment>
              <Button
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'green', color: 'white' }}
                size='small'
                onClick={handleNext}>
                {'Next'}
              </Button>
              <Button
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'red', color: 'white' }}
                size='small'
                onClick={handleSkip}>
                Skip
              </Button>
            </React.Fragment>
          ) : null}
      </DialogActions>
    </Dialog>
  );
};