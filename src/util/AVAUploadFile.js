import React from 'react';
import { useSnackbar } from 'notistack';
import { s3, makeArray } from '../util/AVAUtilities';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import Typography from '@material-ui/core/Typography';

import TextField from '@material-ui/core/TextField';

import CloseIcon from '@material-ui/icons/HighlightOff';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import DeleteIcon from '@material-ui/icons/Delete';

import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';

import { AVAclasses, AVATextStyle, AVADefaults } from '../util/AVAStyles';

export default ({ onCancel, onLoad, options = {} }) => {

  const AVAClass = AVAclasses();
  let user_fontSize = AVADefaults({ fontSize: 'get' });

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
      <Typography
        style={AVATextStyle({
          size: 1.3,
          bold: true
        })}
        className={AVAClass.AVATitle} id='scroll-dialog-title'>
        {options.title || 'Upload a file'}
      </Typography>
      <Paper component={Box} style={{ maxWidth: 1000 }} overflow='auto' square>
        <Box
          display='flex'
          grow={1}
          pt={1}
          id={`contentsColumn`}
          key={`contentsColumn`}
          flexDirection='column'
          justifyContent='center'
          alignItems='flex-start'
        >
          {(reactData.uploadList.length > 0) &&
            <Paper component={Box} style={{ paddingTop: '16px', paddingBottom: '16px', width: '100%' }} overflow='auto' square>
              {reactData.uploadList.map((fObj, cIndex) => (
                <Box display='flex'
                  flexDirection='column'
                  my={1}
                  paddingLeft={2}
                  paddingRight={2}
                  mx={1}
                  justifyContent={'center'}
                  minHeight={`${user_fontSize * 2}rem`}
                  border={1}
                  borderRadius={'16px'}
                  key={`ambiguous-${cIndex}`}
                >
                  <Box display='flex' flexDirection='row' paddingBottom={1} justifyContent='space-between' alignItems='center'>
                    <Box width='90%' flexGrow={1} >
                      <TextField
                        style={{ width: '95%' }}
                        id={`fNameID`}
                        key={`fNameKey`}
                        multiline
                        inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                        FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                        value={fObj.fName}
                        helperText={fObj.fType}
                        onChange={(event) => {
                          handleChangeTextInput(event, cIndex);
                        }}
                        autoComplete='off'
                      />
                    </Box>
                    <DeleteIcon
                      edge={'end'}
                      onClick={() => {
                        reactData.uploadList.splice(cIndex, 1);
                        setReactData(reactData);
                        setForceRedisplay(!forceRedisplay);
                      }}
                    />
                  </Box>
                </Box>
              ))}
            </Paper>
          }
          </Box>
          <DialogActions className={AVAClass.AVABox} style={{ justifyContent: 'center' }}>
            <Box display='flex' flexDirection='column'>
              <Box display='flex' flexDirection='row' marginTop={2} paddingBottom={1} justifyContent='center' alignItems='center'>
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