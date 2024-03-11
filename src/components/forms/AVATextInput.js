import React from 'react';

import { titleCase, makeArray } from '../../util/AVAUtilities';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';

import LoadIcon from '@material-ui/icons/GetApp';
import CloseIcon from '@material-ui/icons/HighlightOff';

import TextField from '@material-ui/core/TextField';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import Checkbox from '@material-ui/core/Checkbox';

import makeStyles from '@material-ui/core/styles/makeStyles';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  containerBox: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0
  },
  contentBox: {
    minWidth: '100%'
  },
  radioButton: {
    marginTop: 0,
    marginRight: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
  },
  AVAButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    border: '0.75px solid gray',
    textTransform: 'none',
    textDecoration: 'none',
    textWrap: 'nowrap',
    fontWeight: 'bold',
    size: 'small',
  },
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  idText: {
    minWidth: '100%',
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
}));

export default ({ titleText, promptText, valueText, errorText, buttonText, onCancel, onSave, allowCancel = true, options = {} }) => {

  const classes = useStyles();
  const AVAClass = AVAclasses();

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  let keyPressed = 0;

  const [textInput, setTextInput] = React.useState(valueText ? (Array.isArray(valueText) ? valueText : [valueText]) : []);
  const [forceRedisplay, setForceRedisplay] = React.useState(true);
  const [reactData, setReactData] = React.useState({
    saving: false,
    focusOn: 0
  })

  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  /*
  const setFocus = React.useRef(null);

  React.useEffect(() => {
    if (setFocus && setFocus.current) {
      setFocus.current.focus();
    }
  }, [reactData]);
  */

  const handleChangeTextInput = (event, ndx) => {
    if (!reactData.saving) {
      textInput[ndx] = event.target.value;
      setTextInput(textInput);
      setForceRedisplay(!forceRedisplay);
    }
    else {
      updateReactData({ saving: false }, false);
    }
  };

  const toggleCheckbox = (ndx) => {
    if (textInput[ndx] === 'checked') { textInput[ndx] = ''; }
    else { textInput[ndx] = 'checked'; }
    setTextInput(textInput);
    setForceRedisplay(!forceRedisplay);
  };

  const handleSave = () => {
    if (Array.isArray(promptText)) { onSave(textInput, keyPressed); }
    else { onSave(textInput[0], keyPressed); }
  };

  const onCheckEnter = (event) => {
    if (event.key === 'Enter') {
      if (options.save_on_enter) {
        updateReactData({ saving: true }, false);
        handleSave();
      }
      else if (Array.isArray(promptText)) {
        let currentFocus = reactData.focusOn + 1;
        if (currentFocus >= promptText.length) {
          currentFocus = 0;
        }
        updateReactData({
          focusOn: currentFocus
        }, true)
      }
    }
  };

  let promptArray = [];
  if (Array.isArray(promptText)) { promptArray = promptText; }
  else {
    promptArray = [promptText];
    if (!titleText) { titleText = titleCase(promptText); }
  }
  let titleArray = makeArray(titleText);


  let buttonArray = [];
  if (!buttonText) { buttonArray = ['Save', 'Cancel/Go Back']; }
  else if (Array.isArray(buttonText)) { buttonArray = buttonText; }
  else {
    buttonArray = [buttonText, 'Cancel/Go Back'];
  }

  // **************************

  return (
    <Dialog open={forceRedisplay || true} fullWidth className={classes.containerBox}>
      <Box display='flex'
        grow={1}
        mb={0}
        flexDirection='column'
        justifyContent='center'
        alignItems='flex-start'
      >
        <DialogContent id='dialog-title'>
          {titleText && titleArray.map((t, tx) => (
            <Typography key={`title-${tx}`}
              style={AVATextStyle({
                size: ((tx === 0) ? 1.3 : 1.0),
                bold: (tx === 0),
                italic: (t.includes('[italic]')),
                marginTop: ((!t || t.trim() === '') ? 1.5 : 0)
              })}
              className={classes.titleRow}>
              {t.replace('[italic]', '')}
            </Typography>
          ))}
        </DialogContent>
        {promptArray && (promptArray.length > 0) &&
          <DialogContent className={classes.contentBox} id='dialog-content'>
            <Box
              display='flex'
              grow={1}
              pt={1}
              mb={0}
              id={`contentsColumn`}
              key={`contentsColumn`}
              flexDirection='column'
              justifyContent='center'
              alignItems='flex-start'
            >
              {promptArray.map((prompt, ndx) => (
                <React.Fragment key={`frag-${ndx}`}>
                  {prompt && (prompt.toLowerCase().startsWith('[')) ?
                    <Box display='flex'
                      flexDirection='row'
                      mt={0.5}
                      mb={0.5}
                      paddingLeft={2}
                      paddingRight={2}
                      alignItems={'center'}
                      minWidth={'100%'}
                      border={textInput[ndx] ? 1 : 0}
                      borderRadius={'16px'}
                      key={'fullRow' + ndx}
                    >
                      {prompt.toLowerCase().startsWith('[checkbox]') &&
                        <Checkbox
                          className={classes.radioButton}
                          size="small"
                          onClick={() => {
                            toggleCheckbox(ndx);
                          }}
                          checked={(textInput[ndx] === 'checked')}
                        />
                      }
                      <Typography style={AVATextStyle({
                        size: 1
                      })}>
                        {prompt.split(']').pop()}
                      </Typography>
                    </Box>
                    :
                    <Box display='flex'
                      flexDirection='column'
                      mt={0.5}
                      mb={0.5}
                      paddingLeft={2}
                      paddingRight={2}
                      minWidth={'100%'}
                      justifyContent={'center'}
                      minHeight={`${user_fontSize * 2}rem`}
                      // border={textInput[ndx] ? 1 : 0}
                      border={!!(errorText && errorText[ndx]) ? 4 : (textInput[ndx] ? 1 : 'none')}
                      borderColor={!!(errorText && errorText[ndx]) ? 'red' : 'black'}
                      borderRadius={'16px'}
                      key={'fullRow' + ndx}
                    >
                      <TextField
                        className={classes.idText}
                        id={`prompt-${ndx}`}
                        key={`prompt-${ndx}`}
                        multiline
                        autoFocus={(ndx === reactData.focusOn) ? true : null}
                        inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                        FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                        error={!!(errorText && errorText[ndx])}
                        value={textInput[ndx] || ''}
                        onChange={(event) => {
                          handleChangeTextInput(event, ndx);
                        }}
                        onKeyPress={(event) => {
                          onCheckEnter(event);
                        }}
                        helperText={(errorText && errorText[ndx]) ? errorText[ndx] : ((prompt === titleText) ? '' : (prompt || ''))}
                        autoComplete='off'
                      />
                    </Box>
                  }
                </React.Fragment>
              ))}
            </Box>
          </DialogContent>
        }
      </Box>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Box display='flex' style={{ marginTop: '2em' }} flexWrap='wrap' flexDirection='row' justifyContent='center' alignItems='center'>
          {allowCancel &&
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={() => {
                onCancel();
              }}
              startIcon={<CloseIcon size="small" />}
            >
              {buttonArray[1]}
            </Button>
          }
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'green', color: 'white' }}
            size='small'
            onClick={() => {
              keyPressed = 0;
              handleSave();
            }}
            startIcon={<LoadIcon size="small" />}
          >
            {buttonArray[0]}
          </Button>
          {(buttonArray.length > 2) &&
            buttonArray.map((b, i) => (
              (i > 1) &&
              b &&
              <Button
                className={AVAClass.AVAButton}
                key={`extra-button_${i}`}
                style={{ backgroundColor: 'blue', color: 'white' }}
                size='small'
                onClick={() => {
                  keyPressed = i;
                  handleSave();
                }}
              >
                {b}
              </Button>
            ))
          }
        </Box>
      </DialogActions>
    </Dialog>
  );
};
