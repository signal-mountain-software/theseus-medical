import React from 'react';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';

import Button from '@material-ui/core/Button';
import GoBackIcon from '@material-ui/icons/SettingsBackupRestore';
import CheckIcon from '@material-ui/icons/DoneSharp';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { Typography } from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  title: {
    marginTop: theme.spacing(3),
    marginRight: theme.spacing(2),
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold',
  },
  page: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  notTitle: {
    marginRight: theme.spacing(2),
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
  }
}));

export default ({ promptText, cancelText = 'Cancel', confirmText = 'Confirm', onCancel, onConfirm }) => {


  function makeLine(str) {
    let work = str.match(/[<[].*?[>\]]/g);
    if (work && work.length > 0) {
      work.forEach(w => {
        str = str.replace(w, '');
      });
    }
    return str;
  }

  function makeIndent(str) {
    let a = str.match(/(indent=.)/g);
    if (!a) {
      return '0';
    }
    else {
      return a[0].split('=')[1];
    }
  }

  let promptLines = [];
  if (Array.isArray(promptText)) { promptLines = promptText; }
  else { promptLines = [promptText]; }

  const classes = useStyles();

  // **************************

  return (
    <Dialog
      key={`confirm-dialog`}
      open={true}
      fullWidth
      p={2}
    >
      <Box
        key={`box-line`}
        marginLeft={3 + (3 * Number(makeIndent(promptLines[0])))}
      >
        <Typography
          className={classes.title}
          id='scroll-dialog-title'
          key={'promptConfirm'}
        >
          {promptLines[0].includes('[bold]')
            ? (promptLines[0].includes('[italic]') ? <b><i>{makeLine(promptLines[0])}</i></b> : <b>{makeLine(promptLines[0])}</b>)
            : (promptLines[0].includes('[italic]') ? <i>{makeLine(promptLines[0])}</i> : `${makeLine(promptLines[0])}`)
          }
        </Typography>
      </Box>
      <Paper component={Box} className={classes.page} overflow='auto' square>
        {promptLines.map((pLine, index) => (
          (index > 0 ?
            (pLine.trim() === ''
              ? <Box key={`blank-line${index}`} marginTop={2} />
              :
              <Box
                key={`box-line${index}`}
                marginLeft={3 + (3 * Number(makeIndent(pLine)))}
              >
                <Typography
                  className={index === 0 ? classes.title : classes.notTitle}
                  id='scroll-dialog-title'
                  key={'promptConfirm' + index}
                >
                  {pLine.includes('[bold]')
                    ? (pLine.includes('[italic]') ? <b><i>{makeLine(pLine)}</i></b> : <b>{makeLine(pLine)}</b>)
                    : (pLine.includes('[italic]') ? <i>{makeLine(pLine)}</i> : `${makeLine(pLine)}`)
                  }
                </Typography>
              </Box>
            )
            : null)
        ))}
      </Paper>
      <DialogActions style={{ justifyContent: 'center' }}>
        {(cancelText !== '*none*') &&
          <Button
            className={classes.AVAButton}
            startIcon={<GoBackIcon />}
            style={{ color: 'red' }}
            size='small'
            onClick={() => {
              onCancel();
            }}>
            {cancelText}
          </Button>
        }
        {(confirmText !== '*none*') &&
          <Button
            className={classes.AVAButton}
            startIcon={<CheckIcon />}
            size='small'
            onClick={() => {
              onConfirm();
            }}>
            {confirmText}
          </Button>
        }
      </DialogActions>
    </Dialog>
  );
};
