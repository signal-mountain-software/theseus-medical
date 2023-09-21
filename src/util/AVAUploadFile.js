import React from 'react';
import { useSnackbar } from 'notistack';
import { s3, makeArray } from '../util/AVAUtilities';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import TextField from '@material-ui/core/TextField';

import CloseIcon from '@material-ui/icons/HighlightOff';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';

import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';

import { AVAclasses } from '../util/AVAStyles';

export default ({ onCancel, onLoad, options = {} }) => {

  const AVAClass = AVAclasses();

  // if options.buttonText, use buttontext as follows:
  //  [0] - use as default (not shown when no file has been selected yet)
  //  [1] - (optional) use when exactly one file has already been selected
  //  [2] - (optional) use when more than one file has been selected
  const [reactData, setReactData] = React.useState({
    uploadList: [],
    buttonText: (options.buttonText ? makeArray(options.buttonText)[0] : 'Continue')
  });
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const { enqueueSnackbar, closeSnackbar } = useSnackbar();

  const hiddenFileInput = React.useRef(null);

  const handleFileUpload = event => {
    hiddenFileInput.current.click();
  };

  const handleChangeTextInput = (event, index) => {
    reactData.uploadList[index].fName = event.target.value;
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
  };

  const handleSave = () => {
    onLoad(reactData.uploadList);
  };

  return (
    <Dialog open={forceRedisplay || true} fullWidth
      style={{ marginX: 2, marginTop: 3 }} >
      <DialogContentText className={AVAClass.AVATitle} id='scroll-dialog-title'>
        {options.title || 'Upload a file'}
      </DialogContentText>
      <Paper component={Box} style={{ maxWidth: 1000 }} overflow='auto' square>
        {(reactData.uploadList.length > 0) &&
          <Paper component={Box} style={{ paddingTop: '16px' }} overflow='auto' square>
            {reactData.uploadList.map((fObj, cIndex) => (
              <Box display='flex'
                style={{ marginBottom: '2em', marginLeft: '1em', }}
                flexDirection='row' key={`ambiguous-${cIndex}`} justifyContent='flex-start' alignItems='center'
                paddingX={2}
                paddingY={1}
                marginRight={2}
                minWidth={'90%'}
                border={1}
                borderRadius={'16px'}
              >
                <TextField
                  className={AVAClass.AVASmallText}
                  id={`fNameID`}
                  key={`fNameKey`}
                  multiline
                  value={fObj.fName}
                  helperText={fObj.fType}
                  onChange={(event) => {
                    handleChangeTextInput(event, cIndex);
                  }}
                  autoComplete='off'
                />
              </Box>
            )
            )}
          </Paper>
        }
        <DialogActions className={AVAClass.AVABox} style={{ justifyContent: 'center' }}>
          <Box display='flex' flexDirection='column'>
            <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='center' alignItems='center'>
                <Button
                  className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'blue', color: 'white' }}
                  size='small'
                  startIcon={<CloudUploadIcon />}
                  onClick={handleFileUpload}
                >
                  {`Choose ${(reactData.uploadList.length === 0) ? 'a file' : 'more'}`}
                </Button>
                <input
                  type="file"
                  style={{ display: 'none' }}
                  ref={hiddenFileInput}
                  onChange={async (target) => {
                    let fObj = target.target.files[0];
                    let fParts = fObj.name.split('.');
                    let extension = fParts.pop();
                    let keyName = fParts.join('.');
                    const pFile = {
                      Bucket: 'theseus-medical-storage',
                      Key: `public_uploads/${keyName}.${extension}`,
                      Body: fObj,
                      ACL: 'public-read-write',
                      ContentType: fObj.ContentType
                    };
                    enqueueSnackbar(`Uploading ${keyName}`, { variant: 'success', persist: true });
                    let s3Resp = await s3
                      .upload(pFile)
                      .promise()
                      .catch(err => {
                        enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
                      });
                    closeSnackbar();
                    reactData.uploadList.push({ fName: keyName, fType: extension, fLoc: s3Resp.Location });
                    if (options.buttonText && Array.isArray(options.buttonText)) {
                      if (options.buttonText[2] && reactData.uploadList.length > 1) {
                        reactData.buttonText = options.buttonText[2];
                      }
                      else { reactData.buttonText = options.buttonText[1]; }
                    }
                    setReactData(reactData);
                    setForceRedisplay(!forceRedisplay);
                  }}
                />
              <Button
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'red', color: 'white' }}
                size='small'
                variant='outlined'
                onClick={() => onCancel()}
                startIcon={<CloseIcon size="small" />}
              >
                Exit
              </Button>
              {(reactData.uploadList.length > 0) &&
                <Button
                  className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'green', color: 'white' }}
                  size='small'
                  variant='outlined'
                  onClick={() => {
                    handleSave();
                  }}
                  startIcon={<CloseIcon size="small" />}
                >
                  {reactData.buttonText}
                </Button>
              }
            </Box>
          </Box>
        </DialogActions>
      </Paper >
    </Dialog >
  );

};