import React from 'react';

import Dialog from '@material-ui/core/Dialog';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';

import Button from '@material-ui/core/Button';
import GoBackIcon from '@material-ui/icons/SettingsBackupRestore';
import CheckIcon from '@material-ui/icons/DoneSharp';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { Typography } from '@material-ui/core';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  title: {
    marginTop: theme.spacing(3),
    marginRight: theme.spacing(2),
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold',
  },
  radius_rounded: {
    borderRadius: '30px'
  },
  page: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(4),
  },
  notTitle: {
    marginRight: theme.spacing(2),
  },
  AVAButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    paddingRight: '16px',
    paddingLeft: '16px',
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

  function blankLine(p) {
    let a = p.match(/(\[.+\])/gm);
    let ans;
    if (!a) {
      ans = p;
    }
    else {
      ans = p.replace(a.pop(), '');
    }
    return (!ans || (ans.trim() === ''))
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
  const AVAClass = AVAclasses();

  // **************************

  return (
    <Dialog
      key={`confirm-dialog`}
      id={`confirm-dialog`}
      open={true}
      classes={{ paper: classes.radius_rounded }}
      fullWidth
      p={2}
    >
      <Box
        key={`box-line`}
        id={`box-line`}
        marginLeft={3 + (3 * Number(makeIndent(promptLines[0])))}
      >
        <Typography
          style={AVATextStyle({
            margin: { top: 2, right: 2 },
            size: 1.5,
            bold: true,
            color: (promptLines[0].includes('[color:') ? promptLines[0].split(/.*\[color:/)[1].split(']')[0] : null)
          })}
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
            (blankLine(pLine)
              ?
              <Box
                key={`blank-line${index}`}
                id={`blank-line${index}`}
                marginTop={'25px'}
              />
              :
              <Box
                key={`box-line${index}`}
                id={`box-line${index}`}
                marginLeft={3 + (3 * Number(makeIndent(pLine)))}
              >
                <Typography
                  style={index === 0 ?
                    AVATextStyle({
                      margin: { top: 3, right: 2 },
                      size: 1.5,
                      bold: true,
                      color: (pLine.includes('[color:') ? pLine.split(/.*\[color:/)[1].split(']')[0] : null)
                    })
                    :
                    AVATextStyle({
                      margin: { top: (pLine.match(/(indent=.)/g) ? 0 : 0.5), right: 1 },
                      size: (pLine.match(/(indent=.)/g) ? 0.8 : 1),
                      color: (pLine.includes('[color:') ? pLine.split(/.*\[color:/)[1].split(']')[0] : null)
                    })
                  }
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
      <Box display='flex' mx={2} flexDirection='row' justifyContent='space-between' alignItems='center' >
        {(cancelText !== '*none*') &&
          <Button
            className={AVAClass.AVAButton}
            startIcon={<GoBackIcon />}
            style={{ backgroundColor: 'red', color: 'white' }}
            size='small'
            onClick={() => {
              onCancel();
            }}>
            {cancelText}
          </Button>
        }
        {(confirmText !== '*none*') &&
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'green', color: 'white' }}
            startIcon={<CheckIcon />}
            size='small'
            onClick={() => {
              onConfirm();
            }}>
            {confirmText}
          </Button>
        }
      </Box>
    </Dialog>
  );
};
