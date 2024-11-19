import React from 'react';

import { titleCase, makeArray, s3 } from '../../util/AVAUtilities';

import { useSnackbar } from 'notistack';

import { Dialog, DialogContent, TextField, Box, Button, Typography, Checkbox } from '@material-ui/core';

import LoadIcon from '@material-ui/icons/GetApp';
import CloseIcon from '@material-ui/icons/HighlightOff';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import DeleteIcon from '@material-ui/icons/Delete';
import LinearProgress from '@material-ui/core/LinearProgress';
import Select from "react-dropdown-select";

import makeStyles from '@material-ui/core/styles/makeStyles';

import { AVATextStyle, AVADefaults } from '../../util/AVAStyles';

const useStyles = makeStyles(theme => ({
  contentBox: {
    minWidth: '100%',
    dividers: {
      paddingTop: theme.spacing(1),
      paddingBottom: theme.spacing(1),
      minWidth: '100%',
    }
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
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  placeHolder: {
    marginLeft: 0,
    color: 'black'
  },
  idText: {
    minWidth: '100%',
    marginTop: 10,
    marginBottom: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 0,
  },
  clientBackground: {
    borderRadius: '30px',
  },
  promptBackground: {
    borderRadius: '15px',
    marginTop: 4,
    marginBottom: 4,
    paddingLeft: 16,
    paddingRight: 16,
    backgroundColor: 'white',
  }
}));

export default ({ titleText, promptText, valueText, selectionList, errorText, buttonText, onCancel, onSave, allowCancel = true, options = {} }) => {

  const classes = useStyles();

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

  const { enqueueSnackbar } = useSnackbar();

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  let keyPressed = 0;

  const [textInput, setTextInput] = React.useState(
    makeArray(promptText).map((p, x) => {
      if (valueText && valueText[x]) {
        return valueText[x];
      }
      else {
        return "";
      }
    })
  );
  const [forceRedisplay, setForceRedisplay] = React.useState(true);
  const [reactData, setReactData] = React.useState({
    saving: false,
    focusOn: 0,
    loadProgress: [],
    attachmentList: (options.allowAttach && options.attachmentList ? options.attachmentList : []),
    bgColor_option: options.bgColor || null
  });

  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  const hiddenFileInput = React.useRef(null);

  const handleFileUpload = event => {
    hiddenFileInput.current.click();
  };

  const handleChangeTextInput = (inputValue, ndx, options = {}) => {
    if (!reactData.saving) {
      if (Array.isArray(inputValue)) {
        if (inputValue.length > 1) {
          textInput[ndx] = inputValue.map(v => {
            return v.value;
          });
        }
        else {
          textInput[ndx] = inputValue[0].value;
        }
      }
      else {
        textInput[ndx] = inputValue;
      }
      setTextInput(textInput);
      if (inputValue === '*% select_new %*') {
        updateReactData({ saving: true }, false);
        handleSave();
      }
      else if (options.edit) {
        textInput[ndx] = `*% edit_item %*${inputValue}`;
        setTextInput(textInput);
        updateReactData({ saving: true }, false);
        handleSave();
      }
      else {
        setForceRedisplay(!forceRedisplay);
      }
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
    reactData.loadProgress[reactData_index] = {
      loading: false,
      fileName: '',
      total: 1,
      progress: 0
    };
    updateReactData({
      loadProgress: reactData.loadProgress,
      attachmentList: reactData.attachmentList,
      textInput: reactData.textInput
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

  const handleSave = () => {
    let attachments = [];
    if (reactData.attachmentList && (reactData.attachmentList.length > 0)) {
      attachments = reactData.attachmentList.map(a => {
        return a.Location;
      });
    }
    if (Array.isArray(promptText)) {
      onSave(textInput, keyPressed, attachments);
    }
    else {
      onSave(textInput[0], keyPressed, attachments);
    }
  };

  const onCheckEnter = (event) => {
    if (event.key === 'Enter') {
      if (options.save_on_enter) {
        updateReactData({ saving: true }, false);
        handleSave();
      }
      else if (Array.isArray(promptText)) {
        let currentIndex = promptText.findIndex(this_prompt => {
          let promptParts = this_prompt.split(']');
          return (promptParts[promptParts.length - 1] === event.currentTarget.innerText)
        })
        let currentFocus = currentIndex + 1;
        if (currentFocus >= promptText.length) {
          currentFocus = 0;
        }
        updateReactData({
          focusOn: currentFocus
        }, true);
      }
    }
  };

  let promptArray = [];
  if (Array.isArray(promptText)) { promptArray = promptText; }
  else {
    promptArray = [promptText];
    if (!titleText) { titleText = titleCase(promptText); }
  }
  let minHeight = 0;
  promptArray.forEach(p => {
    if (p.startsWith('[select')) {
      minHeight = 350;
    }
  });
  let titleArray = makeArray(titleText);
  let displayValueArray = makeArray(valueText).map((v, ndx) => {
    if (!v || (v.trim() === '')) {
      return '';
    }
    if (!selectionList || !selectionList[ndx]) {
      return v;
    }
    let foundIt = selectionList[ndx].find(s => {
      if (typeof (s) === 'string') {
        return (s.toLowerCase().trim() === v.toLowerCase().trim());
      }
      else if (s.hasOwnProperty('value')) {
        return (s.value.toLowerCase().trim() === v.toLowerCase().trim());
      }
      else {
        return false;
      }
    });
    if (foundIt) {
      if (typeof (foundIt) === 'string') {
        return foundIt;
      }
      else {
        return (foundIt.key || foundIt.label || foundIt.display);
      }
    }
    return '';
  });


  let buttonArray = [];
  if (!buttonText) { buttonArray = ['Save', 'Cancel/Go Back']; }
  else if (Array.isArray(buttonText)) { buttonArray = buttonText; }
  else {
    buttonArray = [buttonText, 'Cancel/Go Back'];
  }

  // **************************

  return (
    <Dialog
      open={forceRedisplay || true}
      fullWidth
      classes={{ paper: classes.clientBackground }}
    >
      <Box display='flex'
        grow={1}
        sx={{
          px: 3,
          py: 2,
          borderRadius: '30px 30px 0 0',
          bgcolor: reactData.bgColor_option,
        }}
        flexDirection='column'
        justifyContent='center'
        alignItems='flex-start'
      >
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
      </Box>

      {promptArray && (promptArray.length > 0) &&
        <DialogContent
          dividers={true}
          style={{
            minWidth: '100%',
            backgroundColor: reactData.bgColor_option,
            dividers: {
              paddingTop: 8,
              paddingBottom: 8,
              minWidth: '100%',
            },
            minHeight: `${minHeight}px`,
            paddingBottom: '1em'
          }}
          id='dialog-content'
        >
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
                  <React.Fragment>
                    <Box display='flex'
                      flexDirection='row'
                      className={classes.promptBackground}
                      mt={0.5}
                      mb={0.5}
                      paddingLeft={2}
                      paddingRight={2}
                      alignItems={'center'}
                      minWidth={'100%'}
                      border={(textInput[ndx] || prompt.toLowerCase().startsWith('[select')) ? 1 : 0}
                      borderRadius={'16px'}
                      key={'fullRow' + ndx}
                    >
                      {prompt.toLowerCase().startsWith('[checkbox]') &&
                        <React.Fragment>
                          <Checkbox
                            className={classes.radioButton}
                            size="small"
                            onClick={() => {
                              toggleCheckbox(ndx);
                            }}
                            checked={(textInput[ndx] === 'checked')}
                          />
                          <Typography style={AVATextStyle({
                            size: 1,
                            color: 'black'
                          })}>
                            {prompt.split(']').pop()}
                          </Typography>
                        </React.Fragment>
                      }
                      {prompt.toLowerCase().startsWith('[select') &&
                        <React.Fragment>
                          <Box
                            key={`selectBox_${ndx}`}
                            display='flex' flexGrow={1} flexDirection='column'
                            pt={1} pb={1}
                          >
                            <Select
                              options={selectionList[ndx].map(sel => {
                                return {
                                  value: (typeof (sel) === 'string') ? sel : sel.value,
                                  label: (titleCase(((typeof (sel) === 'string') ? sel : (sel.key || sel.label || sel.display)).replace('_', ' ')))
                                };
                              })}
                              searchBy={'label'}
                              style={{
                                fontSize: `${user_fontSize}rem`,
                                marginLeft: -5,
                                marginBottom: -4,
                                marginTop: 1,
                                borderWidth: 0
                              }}
                              dropdownHandle={true}
                              clearOnSelect={true}
                              clearOnBlur={true}
                              key={`select_${ndx}`}
                              searchable={true}
                              multi={prompt.toLowerCase().startsWith('[selectmulti')}
                              closeOnClickInput={true}
                              closeOnSelect={true}
                              create={false}
                              keepSelectedInList={true}
                              noDataLabel={"No matches found"}
                              placeholder={displayValueArray[ndx]}
                              onChange={(values) => {
                                if (values.length > 0) {
                                  handleChangeTextInput(values, ndx);
                                  updateReactData({
                                    focusOn: (ndx + 1)
                                  }, true);
                                }
                              }}
                            />
                            <Box display='flex'
                              flexDirection='row'
                              minWidth={'100%'}
                              paddingTop={'4px'}
                              borderTop={1}
                              key={'borderTop' + ndx}
                            >
                              <Typography
                                style={AVATextStyle({
                                  size: 0.8,
                                  margin: { left: 0, top: 0, bottom: 0.5 },
                                  color: 'black',
                                  opacity: '54%',
                                })}
                              >
                                {prompt.split(']').pop()}
                              </Typography>
                            </Box>
                          </Box>
                        </React.Fragment>
                      }
                    </Box>
                  </React.Fragment>
                  :
                  <Box display='flex'
                    flexDirection='column'
                    className={classes.promptBackground}
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
                      inputProps={{ style: { color: 'black', fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                      FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                      error={!!(errorText && errorText[ndx])}
                      value={textInput[ndx] || ''}
                      onChange={(event) => {
                        handleChangeTextInput(event.target.value, ndx);
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
      {(options.allowAttach && reactData.attachmentList && reactData.attachmentList.length > 0) &&
        <Box display='flex' flexDirection='column' justifyContent='flex-start'
          alignItems='flex-start' key={'qrOpt_attachmentlist'}
          sx={{
            pl: 1.5,
            mt: 1,
            bgcolor: reactData.bgColor_option,
          }}

        >
          <Typography className={classes.radioHead}>
            {(typeof (options.allowAttach) === 'string') ? options.allowAttach : 'Attachments'}:
          </Typography>
          {reactData.attachmentList.map((a, x) => (
            <Box display='flex' flexDirection='row' justifyContent='flex-start'
              alignItems='center' key={`qrOpt_attachmentLine-${x}`}
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
              {loadingInProgress(x) &&
                <React.Fragment>
                  <LinearProgress
                    variant="determinate"
                    className={classes.progressBar}
                    style={{ width: reactData.loadProgress[x].total }}
                    value={reactData.loadProgress[x].progress}
                  />
                </React.Fragment>
              }
              <Typography
                style={AVATextStyle({
                  size: 0.6,
                  color: ((loadingInProgress(x)) ? 'gray' : 'black'),
                  margin: { left: 0.3, right: 3 }
                })}
              >
                {a.Key}
              </Typography>
              <Box
                component="img"
                mb={2}
                minWidth={150}
                maxWidth={150}
                alt=''
                src={a.Location}
              />
            </Box>
          ))}
        </Box>
      }
      <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
        sx={{
          px: 2,
          pb: 2,
          borderRadius: '0 0 30px 30px',
          bgcolor: reactData.bgColor_option,
        }}
      >
        {allowCancel &&
          <Button
            style={
              Object.assign(
                {},
                AVAButton, 
                { backgroundColor: 'red', color: 'white' }
              )
            }
            size='small'
            onClick={() => {
              onCancel();
            }}
            startIcon={<CloseIcon size="small" />}
          >
            {buttonArray[1]}
          </Button>
        }
        <Box display='flex' flexWrap='wrap' flexDirection='row' justifyContent='center' alignItems='center'>
          <Button
            style={
              Object.assign(
                {},
                AVAButton,
                { backgroundColor: 'green', color: 'white' }
              )
            }
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
                  style={
                    Object.assign(
                      {},
                      AVAButton,
                      { backgroundColor: 'blue', color: 'white' }                    )
                  }
                key={`extra-button_${i}`}               
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
          {options.allowAttach && (!options.maxAttach || (options.maxAttach > reactData.attachmentList.length)) &&
            <Box display='flex' flexDirection='row' justifyContent='flex-start'
              alignItems='center' key={'qrOpt_attachmentbox'}
            >
              <Button
                style={
                  Object.assign(
                    {},
                    AVAButton,
                    { backgroundColor: 'blue', color: 'white' }
                  )
                }
                size='small'
                startIcon={<CloudUploadIcon />}
                onClick={handleFileUpload}
              >
                Add {(typeof (options.allowAttach) === 'string') ? options.allowAttach : 'Attachment'}
              </Button>
              <input
                type="file"
                style={{ display: 'none' }}
                ref={hiddenFileInput}
                onChange={async (target) => {
                  let s3Data = await handleSaveFile(target.target.files[0]);
                  textInput.push(s3Data.Location);
                  setTextInput(textInput);
                }}
              />
            </Box>
          }
        </Box>
      </Box>
    </Dialog>
  );
};
