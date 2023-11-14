import React from 'react';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';

import Button from '@material-ui/core/Button';
import GoBackIcon from '@material-ui/icons/SettingsBackupRestore';
import CheckIcon from '@material-ui/icons/DoneSharp';
import { Typography } from '@material-ui/core';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { makeObject } from '../../util/AVAUtilities';

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

  function makePageStyle(pLines) {
    if (pLines.length < 2) {
      return {top: 2, bottom: 2}
    }
    else {
      let setStyle = AVATextStyle(pLines[1]);
      return {
        top: setStyle.top || 2,
        bottom: setStyle.bottom || 2
      }
    }
  }

  function makeStyle(str,
    defStyle = {
      margin: { top: 3, right: 2 },
      size: 1.5,
      bold: true
    }
  ) {
    let a = str.match(/(style=.+})/g);
    if (!a) {
      return defStyle;
    }
    else {
      let oStr = a[0].split('=');
      if (oStr.length > 1) {
        let r = makeObject(oStr.pop());
        return r;
      }
      else {
        return defStyle;
      }
    }
  }

  let promptLines = [];
  if (Array.isArray(promptText)) { promptLines = promptText; }
  else { promptLines = [promptText]; }

  const AVAClass = AVAclasses();

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
        marginRight={2}
      >
        <Typography
          style={AVATextStyle(makeStyle(promptLines[0]))}
          id='scroll-dialog-title'
          key={'promptConfirm'}
        >
          {promptLines[0].includes('[bold]')
            ? (promptLines[0].includes('[italic]') ? <b><i>{makeLine(promptLines[0])}</i></b> : <b>{makeLine(promptLines[0])}</b>)
            : (promptLines[0].includes('[italic]') ? <i>{makeLine(promptLines[0])}</i> : `${makeLine(promptLines[0])}`)
          }
        </Typography>
      </Box>
      <Paper component={Box} style={AVATextStyle(makePageStyle(promptLines))} overflow='auto' square>
        {promptLines.map((pLine, index) => (
          (index > 0 ?
            (pLine.trim() === ''
              ?
              <Box
                key={`blank-line${index}`}
                id={`BOX_for_blankLine_${index}`}
                marginTop={0.1}
              >
                <br/>
              </Box>
              :
              <Box
                key={`box-line${index}`}
                marginLeft={3 + (3 * Number(makeIndent(pLine)))}
                marginRight={2}
                id={`BOX_for_promptLine_${index}_withText`}
                style={AVATextStyle(makeStyle(pLine, {
                  margin: { top: (pLine.match(/(indent=.)/g) ? 0 : 1.5), right: 1 }
                }))
                }
              >
                <Typography
                  style={AVATextStyle(makeStyle(pLine, {
                    size: (pLine.match(/(indent=.)/g) ? 0.8 : 1)
                  }))
                  }
                  id={`promptLine_${index}_withText`}
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
      </DialogActions>
    </Dialog>
  );
};
