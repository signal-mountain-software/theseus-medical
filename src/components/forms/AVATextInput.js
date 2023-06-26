import React from 'react';

import { titleCase } from '../../util/AVAUtilities';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import LoadIcon from '@material-ui/icons/GetApp';
import CloseIcon from '@material-ui/icons/HighlightOff';

import TextField from '@material-ui/core/TextField';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import Checkbox from '@material-ui/core/Checkbox';

import makeStyles from '@material-ui/core/styles/makeStyles';
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
    fontSize: '1.3rem',
    fontWeight: 'bold'
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
    fontSize: theme.typography.fontSize * 0.8,
    minWidth: '100%',
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
}));

export default ({ titleText, promptText, valueText, errorText, buttonText, onCancel, onSave, allowCancel = true }) => {

  const classes = useStyles();

  const [textInput, setTextInput] = React.useState(valueText ? (Array.isArray(valueText) ? valueText : [valueText]) : []);
  const [forceRedisplay, setForceRedisplay] = React.useState(true);

  const handleChangeTextInput = (event, ndx) => {
    textInput[ndx] = event.target.value;
    setTextInput(textInput);
    setForceRedisplay(!forceRedisplay);
  };

  const toggleCheckbox = (ndx) => {
    if (textInput[ndx] === 'checked') { textInput[ndx] = ''; }
    else { textInput[ndx] = 'checked'; }
    setTextInput(textInput);
    setForceRedisplay(!forceRedisplay);
  };

  const handleSave = () => {
    if (Array.isArray(promptText)) { onSave(textInput); }
    else { onSave(textInput[0]); }
  };

  const onCheckEnter = (event) => {
    if ((event.key === 'Enter') && !Array.isArray(promptText)) { handleSave(); }
  };

  let promptArray = [];
  if (Array.isArray(promptText)) { promptArray = promptText; }
  else {
    promptArray = [promptText];
    if (!titleText) { titleText = titleCase(promptText); }
  }

  let buttonArray = [];
  if (Array.isArray(buttonText)) { buttonArray = buttonText; }
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
        {titleText &&
          <DialogContentText className={classes.title} id='dialog-title'>
            {titleText}
          </DialogContentText>
        }
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
                {prompt.toLowerCase().startsWith('[checkbox]') ?
                  <Box display='flex' flexDirection='row' justifyContent='flex-start'
                    alignItems='center' flexWrap='wrap' key={`qropt-${ndx}`}
                  >
                    <Checkbox
                      className={classes.radioButton}
                      size="small"
                      onClick={() => {
                        toggleCheckbox(ndx);
                      }}
                      checked={(textInput[ndx] === 'checked')}
                    />
                    <Typography>{prompt.slice(10)}</Typography>
                  </Box>
                  :
                  <TextField
                    className={classes.idText}
                    id={`prompt-${ndx}`}
                    key={`prompt-${ndx}`}
                    multiline
                    error={!!(errorText && errorText[ndx])}
                    label={(prompt === titleText) ? '' : prompt}
                    value={textInput[ndx] || ''}
                    onChange={(event) => {
                      handleChangeTextInput(event, ndx);
                    }}
                    onKeyPress={(event) => {
                      onCheckEnter(event);
                    }}
                    helperText={(errorText && errorText[ndx]) ? errorText[ndx] : null}
                    autoComplete='off'
                  />
                }
              </React.Fragment>
            ))}
          </Box>
        </DialogContent>
      </Box>
      <DialogActions style={{ justifyContent: 'center' }}>
        <Box display='flex' style={{ marginTop: '2em'}} flexDirection='row' justifyContent='center' alignItems='center'>
          {allowCancel &&
            <Button
              className={classes.AVAButton}
              style={{color: 'red'}}
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
            className={classes.AVAButton}
            size='small'
            onClick={handleSave}
            startIcon={<LoadIcon size="small" />}
          >
            {buttonArray[0]}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};
