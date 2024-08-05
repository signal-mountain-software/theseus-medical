import React from 'react';

import Dialog from '@material-ui/core/Dialog';
import Box from '@material-ui/core/Box';

import Button from '@material-ui/core/Button';
import GoBackIcon from '@material-ui/icons/SettingsBackupRestore';
import CheckIcon from '@material-ui/icons/DoneSharp';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { Typography } from '@material-ui/core';

import { AVATextStyle } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  title: {
    marginTop: theme.spacing(3),
    marginRight: theme.spacing(2),
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold',
  },
  radius_rounded: {
    borderRadius: '30px',
  },
  page: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(4),
  },
  notTitle: {
    marginRight: theme.spacing(2),
  },
}));

export default ({ promptText, cancelText = 'Cancel', confirmText = 'Confirm', onCancel, onConfirm, options = {} }) => {

  const AVAButton = {
    margin: '8px',
    paddingLeft: '16px',
    paddingRight: '16px',
    borderRadius: '16px',
    variant: 'outlined',
    border: '0.75px solid gray',
    textTransform: 'none',
    textDecoration: 'none',
    textWrap: 'nowrap',
    fontWeight: 'bold',
    size: 'small',
  };

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
        sx={{
          pl: (3 + (3 * Number(makeIndent(promptLines[0])))),
          borderRadius: '30px 30px 0 0',
          bgcolor: options.bgColor,
        }}
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
      <Box component={Box}
        sx={{
          pt: '16px',
          pb: '32px',
          bgcolor: options.bgColor,
        }}
        overflow='auto' square
      >
        {promptLines.map((pLine, index) => (
          (index > 0 ?
            (blankLine(pLine)
              ?
              <Box
                key={`blank-line${index}`}
                id={`blank-line${index}`}
                sx={{
                  bgcolor: options.bgColor,
                  paddingTop: '25px',
                }}
              />
              :
              <Box
                key={`box-line${index}`}
                id={`box-line${index}`}
                sx={{
                  bgcolor: options.bgColor,
                  pl: `${(3 + (3 * Number(makeIndent(pLine)))) * 8}px`,
                }}
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
      </Box>
      <Box display='flex'
        sx={{
          p: '16px',
          borderRadius: '0 0 30px 30px',
          bgcolor: options.bgColor,
        }}
        flexDirection='row' justifyContent='space-between' alignItems='center' >
        {(cancelText !== '*none*') &&
          <Button
            style={
              Object.assign(
                {},
                AVAButton,
                { backgroundColor: 'red', color: 'white' }
              )
            }
            startIcon={<GoBackIcon />}
            size='small'
            onClick={() => {
              onCancel();
            }}>
            {cancelText}
          </Button>
        }
        {(confirmText !== '*none*') &&
          <Button
            style={
              Object.assign(
                {},
                AVAButton,
                { backgroundColor: 'green', color: 'white' }
              )
            }
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
