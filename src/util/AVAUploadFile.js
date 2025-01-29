import React from 'react';
import { useSnackbar } from 'notistack';
import { s3, elastictranscoder, makeArray } from '../util/AVAUtilities';

import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import Typography from '@material-ui/core/Typography';
import LinearProgress from '@material-ui/core/LinearProgress';

import TextField from '@material-ui/core/TextField';

import CloseIcon from '@material-ui/icons/HighlightOff';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import DeleteIcon from '@material-ui/icons/Delete';

import Paper from '@material-ui/core/Paper';
import Button from '@material-ui/core/Button';
import Box from '@material-ui/core/Box';

import makeStyles from '@material-ui/core/styles/makeStyles';
import { AVAclasses, AVATextStyle, AVADefaults } from '../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  radius_rounded: {
    borderRadius: '30px',
    marginX: 2,
    marginTop: 3
  },
  progressBar: {
    marginBottom: theme.spacing(3),
    marginLeft: theme.spacing(1),
    marginTop: theme.spacing(0.5),
    backgroundColor: '#a3a0a0',
    color: '#000000',
    transition: 'none',
    height: '5px'
  },
  AVATitle: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
  },
}));

export default ({ onCancel, onLoad, options = {} }) => {

  const AVAClass = AVAclasses();
  const classes = useStyles();
  let user_fontSize = AVADefaults({ fontSize: 'get' });

  // if options.buttonText, use buttontext as follows:
  //  [0] - use as default (not shown when no file has been selected yet)
  //  [1] - (optional) use when exactly one file has already been selected
  //  [2] - (optional) use when more than one file has been selected
  const [reactData, setReactData] = React.useState({
    uploadList: [],
    buttonText: (options.buttonText ? makeArray(options.buttonText)[0] : 'Continue'),
    saving: false,
    focusOn: 0,
    loadProgress: [],
    title: [options.title || 'Upload a File'].flat(),
    attachmentList: (options.allowAttach && options.attachmentList ? options.attachmentList : []),
  });
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const { enqueueSnackbar } = useSnackbar();

  const hiddenFileInput = React.useRef(null);

  const handleFileUpload = event => {
    hiddenFileInput.current.click();
  };

  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  const handleChangeTextInput = (event, index) => {
    reactData.uploadList[index].fName = event.target.value;
    setReactData(reactData);
    setForceRedisplay(!forceRedisplay);
  };

  function loadingInProgress(index = 'all') {
    if (!reactData.loadProgress) {
      return false;
    }
    if (index !== 'all') {
      return (reactData.loadProgress[index] && reactData.loadProgress[index].loading);
    }
    else {
      return (reactData.loadProgress.some(i => {
        return (i.loading);
      }));
    }
  }

  let upload;
  async function handleSaveFile(pTarget) {
    let pType = pTarget.type;
    upload = s3.upload({
      partSize: 10 * 1024 * 1024,
      queueSize: 4,
      Bucket: 'theseus-medical-storage',
      Key: pTarget.name,
      Body: pTarget,
      ACL: 'public-read-write',
      ContentType: pType
    });
    let reactData_index = reactData.attachmentList.push({
      Key: pTarget.name
    }) - 1;
    reactData.loadProgress[reactData_index] = {
      loading: true,
      fileName: '',
      total: 1,
      progress: 0
    };
    updateReactData({ loadProgress: reactData.loadProgress }, true);
    let s3Resp = await performUpload();
    reactData.attachmentList[reactData_index] = s3Resp;
    if (!reactData.textInput) { reactData.textInput = { 's3file': s3Resp.Location }; }
    else { reactData.textInput.s3file = s3Resp.Location; }
    let [extension] = pTarget.name.split('.').slice(-1);
    if (options.buttonText && Array.isArray(options.buttonText)) {
      if (options.buttonText[2] && reactData.uploadList.length > 1) {
        reactData.buttonText = options.buttonText[2];
      }
      else { reactData.buttonText = options.buttonText[1]; }
    }
    reactData.loadProgress[reactData_index] = {
      loading: false,
      fileName: '',
      total: 1,
      progress: 0
    };
    if (extension.toLowerCase() === 'mov') {
      var converterParms = {
        PipelineId: '1626108726566-cv5z9u',
        Input: {
          Key: pTarget.name,
        },
        Output: {
          Key: `${pTarget.name.split('.').slice(0, -1).join('.')}.mp4`,
          PresetId: '1351620000001-000001',
        },
      };
      let converterOK = true;
      let data = await elastictranscoder
        .createJob(converterParms)
        .promise()
        .catch(err => {
          enqueueSnackbar(`Conversion unsuccessful`, { variant: 'failure', persist: true });
          converterOK = false;
        });
      if (false) { console.log(data); }
      if (converterOK) {
        s3Resp.Location = `${s3Resp.Location.split('.').slice(0, -1).join('.')}.mp4`;
        extension = 'mp4';
      }
    }
    reactData.uploadList.push({ fName: pTarget.name, fType: extension, fLoc: s3Resp.Location });
    updateReactData({
      loadProgress: reactData.loadProgress,
      attachmentList: reactData.attachmentList,
      textInput: reactData.textInput,
      uploadList: reactData.uploadList,
      buttonText: reactData.buttonText
    }, true);
    return s3Resp;

    function performUpload() {
      return new Promise(function (resolve, reject) {
        upload
          .send((err, good) => {
            if (err) {
              if (err.code === 'RequestAbortedError') {
                enqueueSnackbar(`AVA stopped loading at your request.`, { variant: 'error', persist: false });
              }
              else {
                enqueueSnackbar(`Uh oh!  AVA couldn't save your file.  The reason is ${err.message}`, { variant: 'error', persist: true });
              }
              reject({});
            }
            else {
              resolve(good);
            }
          });
        upload.on('httpUploadProgress', progress => {
          if (reactData.loadProgress[reactData_index].loading === 'abort') {
            upload.abort();
            reactData.loadProgress.splice(reactData_index, 1);
          }
          else {
            let pFactor = 1000;
            do {
              pFactor *= 10;
            }
            while (progress.total > (1000 * pFactor));
            let adjust = (progress.total / pFactor) / (window.window.innerWidth * .8);
            pFactor = pFactor * adjust;
            reactData.loadProgress[reactData_index] = {
              loading: true,
              fileName: progress.key,
              total: (progress.total / pFactor),
              progress: ((progress.loaded * 100) / progress.total)
            };
          }
          updateReactData({ loadProgress: reactData.loadProgress }, true);
        });
      });
    };
  };

  /****** FOR FUTURE REFERENCE
   *   THIS CODE SUPPORT MULTI-PART UPLOADS
  async function handleMultiPartUpload(pTarget) {
    try {
      // Multipart upload will pass chunks of 10Mb
      let partSize = 10000000;
      let numberOfParts = 10;
      if (fileSize > (partSize * numberOfParts)) { partSize = fileSize / 10; }
      else { numberOfParts = Math.ceil(fileSize / partSize); }

      if ((numberOfParts === 1) || forceSingle) {
        enqueueSnackbar(`AVA is saving your ${pType.toLowerCase()} with the name ${pMediaData.Key}`, { variant: 'info', persist: false });
        let uploadOK = true;
        await s3
          .putObject(pMediaData)
          .promise()
          .catch(err => {
            uploadOK = false;
            enqueueSnackbar(`Uh oh!  AVA couldn't save that.  The reason is ${err.message}`,
              { variant: 'error', persist: true });
          });
        if (uploadOK) {
          closeSnackbar();
          enqueueSnackbar(`${pMediaData.Key} was saved successfully`, { variant: 'success', persist: true });
          return pMediaData.Key;
        };
        return null;
      }

      // this is a multi-part load
      enqueueSnackbar(`AVA broke your ${pType.toLowerCase()} with the name ${pMediaData.Key} into ${numberOfParts} pieces and is uploading them now`, { variant: 'info', persist: false });
      let upParms = {
        Bucket: pMediaData.Bucket,
        Key: pMediaData.Key,
        ACL: pMediaData.ACL,
        ContentType: pMediaData.ContentType,
        Metadata: pMediaData.MetaData
      };
      let mpUp = await s3.createMultipartUpload(upParms).promise();
      uploadId = mpUp.UploadId;

      const uploadPromises = [];
      // Upload each part.
      for (let i = 0; i < numberOfParts; i++) {
        const start = i * partSize;
        const end = start + partSize;
        let uPartParm = {
          Bucket: pMediaData.Bucket,
          Key: pMediaData.Key,
          UploadId: uploadId,
          Body: buffer.subarray(start, end),
          PartNumber: i + 1,
        };
        uploadPromises.push(s3.uploadPart(uPartParm).promise());
      }

      const uploadResults = await Promise.all(uploadPromises);
      let upDone = {
        Bucket: pMediaData.Bucket,
        Key: pMediaData.Key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: uploadResults.map(({ ETag }, i) => ({
            ETag,
            PartNumber: i + 1,
          })),
        }
      };
      let s3Resp = await s3.completeMultipartUpload(upDone).promise();
      enqueueSnackbar(`All parts of ${s3Resp.Key} were saved successfully to ${s3Resp.Location}`, { variant: 'success', persist: true });
      return pMediaData.Key;

      // Verify the output by downloading the file from the Amazon Simple Storage Service (Amazon S3) console.
      // Because the output is a 25 MB string, text editors might struggle to open the file.
    }
    catch (err) {
      console.error(err);
      enqueueSnackbar(`That didn't work.  ${err}`, { variant: 'error', persist: true });
      if (uploadId) {
        let s3Bad = await s3.abortMultipartUpload({
          Bucket: pMediaData.Bucket,
          Key: pMediaData.Key,
          UploadId: uploadId,
        }).promise();
        console.log(s3Bad);
      }
    }
  */

  const handleSave = () => {
    onLoad(reactData.uploadList);
  };

  return (
    <Dialog open={forceRedisplay || true} fullWidth
      classes={{ paper: classes.radius_rounded }}
    >
      <Box marginTop={3}>
        {[options.title || 'Upload a File'].flat().map((this_title, ndx) => (
          <Typography
            style={AVATextStyle({
              size: ((ndx === 0) ? 1.3 : 1),
              bold: (ndx === 0)
            })}
            className={classes.AVATitle}
            id={`scroll-dialog-title__${ndx}`}
            key={`scroll-dialog-title__${ndx}`}
          >
            {this_title}
          </Typography>
        ))}
      </Box>
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
          {(reactData.uploadList.length > 0) && false &&
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
          {(reactData.attachmentList && reactData.attachmentList.length > 0) &&
            <Box display='flex' flexDirection='column' justifyContent='flex-start'
              alignItems='flex-start' key={'qrOpt_attachmentlist'}
              sx={{
                pl: 1.5,
                mt: 1,
                bgcolor: reactData.bgColor_option,
              }}

            >
              <Typography className={classes.radioHead}>
                {`File${(reactData.attachmentList.length > 1) ? 's' : ''}:`}
              </Typography>
              {reactData.attachmentList.map((a, x) => (
                <Box display='flex' mb={2} flexDirection='row' justifyContent='flex-start'
                  alignItems='center' key={`qrOpt_attachmentLine-${x}`}
                >
                  <Box display='flex' flexDirection='column' justifyContent='center'
                    alignItems='flex-start' key={`qrOpt_attachmentBox-${x}`}
                  >
                    <Box display='flex' flexDirection='row' justifyContent='flex-start'
                      alignItems='center' key={`qrOpt_attachmentName-${x}`}
                    >
                      <DeleteIcon
                        className={classes.radioButton}
                        size="small"
                        onClick={() => {
                          reactData.attachmentList.splice(x, 1);
                          reactData.forceRedisplay = !reactData.forceRedisplay;
                          if (loadingInProgress(x)) {
                            reactData.loadProgress[x].loading = 'abort';
                          }
                          setReactData(reactData);
                          setForceRedisplay(forceRedisplay => !forceRedisplay);
                        }}
                      />
                      <Typography
                        style={AVATextStyle({
                          size: 0.6,
                          color: ((loadingInProgress(x)) ? 'gray' : 'black'),
                          margin: { left: 0.3, right: 1 }
                        })}
                      >
                        {`${a.Key} - ${loadingInProgress(x) ? ((Math.floor((reactData.loadProgress[x].progress) * 100) / 100).toString() + '%') : 'Done!'}`}
                      </Typography>
                      {!loadingInProgress(x) && <Box
                        component="img"
                        mb={2}
                        ml={2}
                        minWidth={50}
                        maxWidth={50}
                        alt=''
                        src={a.Location}
                      />}
                    </Box>
                    {loadingInProgress(x) &&
                      <React.Fragment>
                        <LinearProgress
                          variant="determinate"
                          key={`qrOpt_progress-${x}`}
                          className={classes.progressBar}
                          style={{ width: reactData.loadProgress[x].total }}
                          value={reactData.loadProgress[x].progress}
                        />
                      </React.Fragment>
                    }
                  </Box>
                </Box>
              ))}
            </Box>
          }
        </Box>
        <DialogActions className={AVAClass.AVABox} style={{ justifyContent: 'center' }}>
          <Box display='flex' flexDirection='column' minWidth='100%'>
            <Box display='flex' flexDirection='row' marginTop={2} paddingBottom={1} justifyContent='space-between' alignItems='center'>
              <Button
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'red', color: 'white' }}
                size='small'
                variant='outlined'
                onClick={() => onCancel()}
                startIcon={<CloseIcon size="small" />}
              >
                {`${loadingInProgress('all') ? 'Stop/' : ''}Exit`}
              </Button>
              <Box display='flex' flexDirection='row'>
                {(!options.oneOnly || (reactData.uploadList.length === 0)) &&
                  <React.Fragment>
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
                        let s3Data = await handleSaveFile(target.target.files[0]);
                        console.log(s3Data);
                      }}
                    />
                  </React.Fragment>
                }
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
          </Box>
        </DialogActions>
      </Paper >
    </Dialog >
  );
};