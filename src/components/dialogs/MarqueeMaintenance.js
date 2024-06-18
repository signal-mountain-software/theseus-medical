import React from 'react';

import { dbClient, getMarqueeMessage } from '../../util/AVAUtilities';
import { AVAclasses } from '../../util/AVAStyles';
import { makeDate } from '../../util/AVADateTime';
import { getGroup } from '../../util/AVAGroups';

import { Checkbox, List, TextField, Button, IconButton, Typography, Paper, Toolbar, Box, AppBar } from '@material-ui/core';
import { RadioGroup, Radio } from '@material-ui/core';
import { FormControl, FormControlLabel } from '@material-ui/core';
import { Dialog, DialogActions } from '@material-ui/core';

import { useSnackbar } from 'notistack';

import CloseIcon from '@material-ui/icons/Close';
import makeStyles from '@material-ui/core/styles/makeStyles';

import useSession from '../../hooks/useSession';

const useStyles = makeStyles(theme => ({
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    flexGrow: 1
  },
  formControlDays: {
    margin: 0,
    marginLeft: '-8px',
    marginRight: '2px',
    paddingTop: 0,
    height: 1,
    fontSize: theme.typography.fontSize * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '10px',
    marginBottom: '25px',
  },
  centerCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -12
  },
  radioDays: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 2,
    marginLeft: 0,
  },
  titlePersonSelect: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  formControl: {
    margin: 0,
    paddingTop: 0,
  },
  rowButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small'
  },
  formControlLbl: {
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  picture: {
    width: theme.spacing(16),
    height: theme.spacing(16),
    [theme.breakpoints.down('xs')]: {
      width: theme.spacing(8),
      height: theme.spacing(8),
    },
  },
  photoButton: {
    alignSelf: 'center',
    size: 'sm',
    variant: 'outlined',
    verticalAlign: 'middle',
  },
  defaultButton: {
    alignSelf: 'end',
    marginTop: 20,
    textTransform: 'none',
    verticalAlign: 'center',
    color: theme.palette.confirm[theme.palette.type],
  },
  topButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  resetButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.confirm[theme.palette.type],
    marginRight: 10,
  },
  infoButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.info[theme.palette.type],
    marginRight: 10,
    paddingRight: 10,
    marginLeft: 10,
    paddingLeft: 10,
  },
  freeInput: {
    marginLeft: theme.spacing(1),
    marginTop: '15px',
    marginRight: 2,
    marginBottom: '10px',
    paddingLeft: 0,
    paddingRight: 0,
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
    minHeight: theme.typography.fontSize * 2.8,
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  listItemAVA: {
    fontSize: theme.typography.fontSize * 1.5,
  },
  listItemHighlighted: {
    fontSize: theme.typography.fontSize * 1.5,
    backgroundColor: 'yellow'
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  noRow: {
    marginLeft: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  idText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 5,
  },
}));

export default ({ patient, peopleList, picture, showNewEvent, onClose }) => {
  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { state } = useSession();
  const [description, setDescription] = React.useState(' ');
  const [eventStartDisplayDate, setEventStartDate] = React.useState(' ');
  const [eventEndDisplayDate, setEventEndDate] = React.useState(' ');

  const [StartAsADateObj, setStartDateObj] = React.useState();
  const [EndAsADateObj, setEndDateObj] = React.useState();
  const [specificPeople, setSpecificPeople] = React.useState(' ');

  const { closeSnackbar, enqueueSnackbar } = useSnackbar();

  const [reactData, setReactData] = React.useState({
    groupList: [],
    restrictToGroups: [],
    slotObjList: [],
    selectedGroups: [],
    messageList: []
  });

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  React.useEffect(() => {
    if (patient) {
    }
  }, [patient]);

  const handleAbort = () => {
    onClose();
  };

  const handleUpdate = async () => {
    let putMarquee = {
      "client_id": state.session.client_id,
      "start_time": StartAsADateObj.timestamp,
      "end_time": EndAsADateObj.timestamp,
      "groups": (reactData.selectedGroups ? Object.keys(reactData.selectedGroups) : []),
      "message": description,
      "style": "",
      "author": state.session.user_id,
      "created_time": new Date().getTime()
    };
    let goodPut = true;
    await dbClient
      .put({
        Item: putMarquee,
        TableName: "MarqueeMessages",
      })
      .promise()
      .catch(error => {
        console.log(`caught error updating MarqueeMessages; error is:`, error);
        goodPut = false;
      });
    closeSnackbar();
    if (goodPut) {
      enqueueSnackbar(`Message Added!`, { variant: 'success' });
    }
    else {
      enqueueSnackbar(`Sorry.  AVA could not save this message!`, { variant: 'error' });
    }
    onClose();
  };


  React.useEffect(() => {
    async function initialize() {
      let options = {
        futureOK: true,
        rawData: true
      }
      let marqueeData = await getMarqueeMessage(state.session.client_id, options);
      for (let m = 0; m < marqueeData.length; m++) {
        if (marqueeData[m].groups && (marqueeData[m].groups.length > 0)) {
          marqueeData[m].groupNames = [];
          for (let g = 0; g < marqueeData[m].groups.length; g++) {
            let gObj = await getGroup(marqueeData[m].groups[g]);
            marqueeData[m].groupNames.push(gObj.name);
          }
        }
      }
      updateReactData({
        messageList: marqueeData
      }, true);
    }
    initialize();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // **************************

  function OK2Save() {
    /*
    return ((description.trim() !== '')
      && (event_start_date && (event_start_date.trim() !== ''))
      && (event_end_date && (event_end_date.trim() !== '')));
      */
    return true;
  }

  const handleChangeDescription = vCheck => {
    setDescription(vCheck);
  };

  const handleChangeDateFrom = vCheck => {
    if (vCheck.length === 0) {
      setEventStartDate('');
    }
    else {
      setEventStartDate(vCheck);
    }
  };

  const resolveFromDate = vCheck => {
    let goodDate = makeDate(vCheck);
    if (!goodDate.error) {
      setEventStartDate(goodDate.absolute);
      setStartDateObj(goodDate);
    }
  };

  const handleChangeDateTo = vCheck => {
    if (vCheck.length === 0) {
      setEventEndDate('');
    }
    else {
      setEventEndDate(vCheck);
    }
  };

  const resolveToDate = vCheck => {
    let goodDate = makeDate(vCheck);
    if (!goodDate.error) {
      setEventEndDate(goodDate.absolute);
      setEndDateObj(goodDate);
    }
  };

  const handleChangePeopleToggle = event => {
    setSpecificPeople(event.target.value);
  };

  // **************************

  return (
    <Dialog
      open={showNewEvent || forceRedisplay}
      onClose={handleAbort}
      fullScreen
    >
      <AppBar>
        <Toolbar>
          <IconButton color='inherit' edge='start' onClick={handleAbort}>
            <CloseIcon />
          </IconButton>
          <Typography variant='h6' className={classes.title}>
            {'Manage Marquee Messages'}
          </Typography>
        </Toolbar>
      </AppBar>
      <Toolbar />
      <React.Fragment>
        <Box m={2}>
          <Paper component={Box} variant={'outlined'}>
            <Box mt={1} py={1} px={3} borderBottom={2}>
              <Box flexGrow={1}>
                <Typography variant='h6'>Create a New Message</Typography>
              </Box>
            </Box>
          </Paper>
          <Paper
            component={Box}
            p={3}
            variant='outlined'
            display='flex'
            flexDirection='column'
            justifyContent='flex-start'
            alignItems='flex-start'
          >
            <Box flexGrow={2} width={'100%'} display='flex' flexDirection='column'>
              <form className={classes.root} noValidate autoComplete='off'>
                <div>
                  <TextField
                    key={`description`}
                    helperText={'Your Message'}
                    multiline
                    inputProps={{ style: { color: 'black', fontSize: `1.5rem`, lineHeight: `1.7rem` } }}
                    FormHelperTextProps={{ style: { color: 'black', fontSize: `1remrem`, lineHeight: `0.9rem` } }}
                    className={classes.freeInput}
                    variant={'standard'}
                    autoComplete='off'
                    id='description'
                    value={description}
                    fullWidth
                    onChange={event => (handleChangeDescription(event.target.value))}
                  />
                </div>
                <div>
                  <TextField
                    key={`input_fromDate`}
                    helperText={'Start Date (and optional time)'}
                    multiline
                    inputProps={{ style: { color: 'black', fontSize: `1.5rem`, lineHeight: `1.7rem` } }}
                    FormHelperTextProps={{ style: { color: 'black', fontSize: `1remrem`, lineHeight: `0.9rem` } }}
                    className={classes.freeInput}
                    id={'date-selection'}
                    variant={'standard'}
                    value={eventStartDisplayDate}
                    autoComplete='off'
                    onBlur={(event) => {
                      resolveFromDate(event.target.value);
                    }}
                    onChange={(event) => {
                      handleChangeDateFrom(event.target.value);
                    }}
                  />
                </div>
                <div>
                  <TextField
                    key={`input_toDate`}
                    className={classes.freeInput}
                    id={'date-selection'}
                    helperText={'End Date (and optional time)'}
                    multiline
                    inputProps={{ style: { color: 'black', fontSize: `1.5rem`, lineHeight: `1.7rem` } }}
                    FormHelperTextProps={{ style: { color: 'black', fontSize: `1remrem`, lineHeight: `0.9rem` } }}
                    variant={'standard'}
                    value={eventEndDisplayDate}
                    autoComplete='off'
                    onBlur={(event) => {
                      resolveToDate(event.target.value);
                    }}
                    onChange={(event) => {
                      handleChangeDateTo(event.target.value);
                    }}
                  />
                </div>
                <Box
                  display="flex"
                  pt={2}
                  pb={1}
                  pl={1}
                  mt={3.5}
                  flexDirection='column'
                  justifyContent="center"
                >
                  <Typography className={classes.radioText}>Do you wish to restrict this event to specific groups only?</Typography>
                  <FormControl className={classes.formControl} component="fieldset">
                    <RadioGroup
                      row
                      defaultValue={'no'}
                      aria-label="restrictions"
                      name="restrictions"
                      value={specificPeople}
                      onChange={handleChangePeopleToggle}
                    >
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="no"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            No
                          </Typography>}
                      />
                      <FormControlLabel
                        className={classes.formControlLbl}
                        value="yes"
                        control={<Radio disableRipple className={classes.radioButton} size='small' />}
                        label={
                          <Typography className={classes.radioText}>
                            Yes
                          </Typography>}
                      />
                    </RadioGroup>
                  </FormControl>
                </Box>
              </form>
            </Box>
            {(specificPeople === 'yes') &&
              <React.Fragment>
                <Box marginTop={2} marginLeft={4} display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
                  <Typography className={classes.HeadText}>{`Administrative Groups`}</Typography>
                  <List className={classes.root}>
                    {state.groups.adminHierarchy.map((gObj, ndx) => (
                      <Box display='flex' style={{ height: 40, marginLeft: gObj.level * 20 }} flexDirection='row' justifyContent='flex-start'
                        alignItems='center' flexWrap='wrap' key={`admin-${ndx}`}
                        onContextMenu={async (e) => {
                          e.preventDefault();
                          enqueueSnackbar(`Group ID=${gObj.id}`, { variant: 'info', persist: true });
                        }}
                      >
                        <Box display='flex' flexDirection='row' justifyContent='flex-start'
                          alignItems='center' flexWrap='nowrap' key={`qropt-${ndx}`}
                        >
                          <Checkbox
                            className={classes.radioButton}
                            size="small"
                            onClick={() => {
                              if (reactData.selectedGroups.hasOwnProperty(gObj.id)) {
                                delete reactData.selectedGroups[gObj.id];
                              }
                              else {
                                reactData.selectedGroups[gObj.id] = true;
                              }
                              updateReactData({
                                selectedGroups: reactData.selectedGroups
                              }, true);
                            }}
                            checked={reactData.selectedGroups.hasOwnProperty(gObj.id)}
                          />
                          <Typography className={classes.radioText} style={{ fontWeight: 'bold' }}>{gObj.name}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </List>
                </Box>
                <Typography className={classes.HeadTextWIthTopSpacing}>{`Public (optional) Groups`}</Typography>
                <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
                  <List className={classes.root}>
                    {Object.keys(state.groups.publicGroups).map((gID, ndx) => (
                      <Box display='flex' style={{ height: 40, marginLeft: 20 }} flexDirection='row' justifyContent='flex-start'
                        alignItems='center' flexWrap='wrap' key={`public-${ndx}`}
                        onContextMenu={async (e) => {
                          e.preventDefault();
                          enqueueSnackbar(`Group ID=${gID}`, { variant: 'info', persist: true });
                        }}
                      >
                        <Box display='flex' flexDirection='row' justifyContent='flex-start'
                          alignItems='center' flexWrap='wrap' key={`pubopt-${ndx}`}
                        >
                          <Checkbox
                            className={classes.radioButton}
                            size="small"
                            onClick={() => {
                              if (reactData.selectedGroups.hasOwnProperty(gID)) {
                                delete reactData.selectedGroups[gID];
                              }
                              else {
                                reactData.selectedGroups[gID] = true;
                              }
                              updateReactData({
                                selectedGroups: reactData.selectedGroups
                              }, true);
                            }
                            }
                            checked={reactData.selectedGroups.hasOwnProperty(gID)}
                          />
                          <Typography className={classes.radioText} style={{ fontWeight: 'bold' }}>{state.groups.publicGroups[gID].group_name}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </List>
                </Box>
                <Typography className={classes.HeadTextWIthTopSpacing}>{`Private Groups`}</Typography>
                <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
                  <List className={classes.root}>
                    {Object.keys(state.groups.privateGroups).map((gID, ndx) => (
                      <Box display='flex' style={{ height: 40, marginLeft: 20 }} flexDirection='row' justifyContent='flex-start'
                        alignItems='center' flexWrap='wrap' key={`private-${ndx}`}
                        onContextMenu={async (e) => {
                          e.preventDefault();
                          enqueueSnackbar(`Group ID=${gID}`, { variant: 'info', persist: true });
                        }}
                      >
                        <Box display='flex' flexDirection='row' justifyContent='flex-start'
                          alignItems='center' flexWrap='wrap' key={`pubopt-${ndx}`}
                        >
                          <Checkbox
                            className={classes.radioButton}
                            size="small"
                            onClick={() => {
                              if (reactData.selectedGroups.hasOwnProperty(gID)) {
                                delete reactData.selectedGroups[gID];
                              }
                              else {
                                reactData.selectedGroups[gID] = true;
                              }
                              updateReactData({
                                selectedGroups: reactData.selectedGroups
                              }, true);
                            }
                            }
                            checked={reactData.selectedGroups.hasOwnProperty(gID)}
                          />
                          <Typography className={classes.radioText} style={{ fontWeight: 'bold' }}>{state.groups.privateGroups[gID].group_name || gID}</Typography>
                        </Box>
                      </Box>
                    ))}
                  </List>
                </Box>
              </React.Fragment>
            }
          </Paper>
        </Box>
      </React.Fragment>
      <React.Fragment>
        <Box m={2}>
          <Paper component={Box} variant={'outlined'}>
            <Box mt={1} py={1} px={3} borderBottom={2}>
              <Box flexGrow={1}>
                <Typography variant='h6'>Current and Upcoming Messages</Typography>
              </Box>
            </Box>
          </Paper>
          <Paper
            component={Box}
            p={3}
            variant='outlined'
            elevation={0}
            marginBottom={1}
            display='flex'
            flexDirection='column'
            justifyContent='flex-start'
            alignItems='flex-start'
          >
            <Box flexGrow={2} display='flex' flexDirection='column'>
              {reactData.messageList.map((this_message, index) => (
                <Paper
                  component={Box}
                  marginTop={1}
                  elevation={0}
                  marginBottom={1}
                  key={`paper_row_${index}`}
                >
                  <Box display='flex'
                    flexDirection='column'                    
                  >
                    <Typography className={classes.radioText} style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                      {this_message.message}
                    </Typography>
                    <Typography className={classes.radioText} style={{ fontSize: '1rem', marginLeft: '16px' }} >
                      {`Start: ${makeDate(this_message.start_time).absolute}`}
                    </Typography>
                    <Typography className={classes.radioText} style={{ fontSize: '1rem', marginLeft: '16px' }} >
                      {`End: ${makeDate(this_message.end_time).absolute}`}
                    </Typography>
                    {this_message.groups && (this_message.groups.length > 0) &&
                      <Typography className={classes.radioText} style={{ fontSize: '1rem', marginLeft: '16px' }} >
                        {`Restricted to: ${this_message.groupNames.sort().join(', ')}`}
                      </Typography>
                    }
                  </Box>
                </Paper>
              ))}
            </Box>
          </Paper>
        </Box>
      </React.Fragment>
      <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
        <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
          <DialogActions className={classes.buttonArea} >
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={() => { onClose(); }}
              startIcon={<CloseIcon fontSize="small" />}
            >
              {'Exit'}
            </Button>
            {OK2Save() &&
              <Button
                onClick={() => {
                  handleUpdate();
                }}
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'green', color: 'white' }}
                size='small'
              >
                {'Save'}
              </Button>
            }
          </DialogActions>
        </Box>
      </Box>
    </Dialog>
  );
};
