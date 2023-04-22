import React from 'react';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';

import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { Typography } from '@material-ui/core';

const useStyles = makeStyles(theme => ({
  title: {
    marginTop: theme.spacing(3),
    marginRight: theme.spacing(2),
    fontSize: theme.typography.fontSize * 1.5,
    maxWidth: '90%',
    fontWeight: 'bold',
  },
  page: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2)
  },
  notTitle: {
    maxWidth: '90%',
    marginRight: theme.spacing(2),
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  greenButton: {
    variant: 'outlined',
    backgroundColor: 'green',
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

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
      open={true}
      p={2}
      height={250}
      width='80%'
      variant={'elevation'} elevation={2}
      TransitionComponent={Transition}
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
            className={classes.reject}
            size='small'
            variant='contained'
            onClick={() => {
              onCancel();
            }}>
            {cancelText}
          </Button>
        }
        {(confirmText !== '*none*') &&
          <Button
            className={classes.greenButton}
            size='small'
            variant='contained'
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
