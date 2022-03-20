import React from 'react';

import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';

import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Button from '@material-ui/core/Button';
// import ButtonGroup from '@material-ui/core/ButtonGroup';
import IconButton from '@material-ui/core/IconButton';
import AssignmentIcon from '@material-ui/icons/Assignment';
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined';
import DeleteIcon from '@material-ui/icons/Delete';
import DeleteForeverIcon from '@material-ui/icons/DeleteForever';

import CircularProgress from '@material-ui/core/CircularProgress';

const useStyles = makeStyles(theme => ({
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    flexGrow: 1
  },
  formControl: {
    margin: 0,
    paddingTop: 0,
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
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  defaultButton: {
    alignSelf: 'end',
    variant: 'outlined',
    verticalAlign: 'end',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  unavailable: {
    backgroundColor: theme.palette.warning.light[theme.palette.type],
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
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
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


export default ({ myCalendar, person_id, display_name, filter }) => {

  let working_date = '';
  const now = new Date(new Date().setHours(0, 0, 0, 0));
  const today = now.getTime();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), (now.getDate() + 1)).getTime();
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };

  const classes = useStyles();
  const [theCalendar, setTheCalendar] = React.useState([]);
  let filterText = filter ? filter.toLowerCase() : null;
  if (filterText) { working_date = ''; };

  const [deletePending, setDeletePending] = React.useState();

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  let paramsPrintCalendar = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:printCalendar',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  const { enqueueSnackbar } = useSnackbar();

  function formatDate(pDate) {
    let yyyy = pDate.substr(0, 4);
    let mm = pDate.substr(4, 2);
    let dd = pDate.substr(6, 2);
    let dDate = new Date(yyyy, Number(mm) - 1, dd);
    let testDate = dDate.getTime();
    let rString = (testDate === today ? 'Today - ' : (testDate === tomorrow ? 'Tomorrow - ' : '')) + dDate.toLocaleDateString('en-US', dateOptions);
    return rString;
  }

  const handleSeatSignup = async (pEvent, myCalendarIndex) => {
    setTheCalendar([]);
    let invokeFailed = false;
    let releaseSlot = false;
    if (!pEvent.slots[0].owner || (pEvent.slots[0].owner === 'available')) {
      releaseSlot = false;
    }
    else if (pEvent.slots[0].owner === person_id) {
      releaseSlot = true;
    }
    params.Payload = JSON.stringify({
      action: "allocate",
      clientId: pEvent.client,
      sign_up: {
        "event_key": pEvent.event_key,   // event and occurence is in here
        "slot_id": person_id,
        "owner": person_id,
        "requestor": person_id,
        "display_name": display_name,
        "new_list_key": releaseSlot ? 'release' : person_id,
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log("AVA couldn't save this event.  Error is", JSON.stringify(err));
        enqueueSnackbar(`AVA couldn't save this event.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed && JSON.parse(fResp.Payload).status === 200) {
      if (releaseSlot) {
        myCalendar[myCalendarIndex].slots[0] = {
          'reminder_minutes': null,
          'owner': null,
          'name': null,
          'id': null
        };
        setTheCalendar(myCalendar);
      }
      else {
        myCalendar[myCalendarIndex].slots[0] = {
          'reminder_minutes': 0,
          'owner': person_id,
          'name': display_name,
          'id': person_id
        };
        setTheCalendar(myCalendar);
      }
    };
    return;
  };

  React.useEffect(() => {
    /* console.log('in use Effect of CalendarForm.js'); */
  }, [theCalendar]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrint = async (pEvent, pType) => {
    let invokeFailed = false;
    paramsPrintCalendar.Payload = JSON.stringify(
      {
        body:
        {
          client_id: pEvent.client,
          event_id: pEvent.event_key,
          requestor: person_id,
          request_type: pType
        }
      });
    let fResp = await lambda
      .invoke(paramsPrintCalendar)
      .promise()
      .catch(err => {
        console.log("Problem printing the sign-up sheet.  Error is", JSON.stringify(err));
        enqueueSnackbar(`AVA couldn't print that sign-up sheet.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });

    if (!invokeFailed) {
      let fResponse = JSON.parse(fResp.Payload);
      if (fResponse.status === 200) {
        window.open(fResponse.body.Location, `${pEvent.occData.description} ${pType}`);
      }
    };
    return;
  };

  const handleDelete = async (pEvent, pIndex) => {
    if (deletePending !== pIndex) {
      setDeletePending(pIndex);
      return;
    }
    setTheCalendar([]);
    let invokeFailed = false;
    params.Payload = JSON.stringify({
      action: "delete_occ",
      clientId: pEvent.client,
      sign_up: {
        "event_key": pEvent.event_key
      }
    });
    let fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log("AVA couldn't update this event.  Error is", JSON.stringify(err));
        enqueueSnackbar(`AVA couldn't update this event.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed && JSON.parse(fResp.Payload).status === 200) {
      myCalendar[pIndex].occData.status = 'deleted';
      setTheCalendar(myCalendar);
    };
    return;
  };

  const handleTimeSignup = async (pEvent, pSlot, myCalendarIndex, pSlotIndex) => {
    setTheCalendar([]);
    let invokeFailed = false;
    let releaseSlot = false;
    if (!pSlot.owner || (pSlot.owner === 'available')) {
      releaseSlot = false;
      if ((pEvent.slots[0].owner === person_id) && (pEvent.slots[0].id !== pSlot.id)) {
        // You selected a new time, but already have another time reserved
        // remove the first before booking the new one
        params.Payload = JSON.stringify({
          action: "sign_up",
          clientId: pEvent.client,
          sign_up: {
            "event_key": pEvent.event_key,
            "slot_id": pEvent.slots[0].id,
            "owner": 'available',
            "requestor": 'available',
            "display_name": null,
            "new_list_key": 'available'
          }
        });
        await lambda
          .invoke(params)
          .promise()
          .catch(err => {
            console.log("AVA couldn't save this event.  Error is", JSON.stringify(err));
            enqueueSnackbar(`AVA couldn't save this event.  Error is ${err.message}`, {
              variant: 'error'
            });
            invokeFailed = true;
          });
        for (let s = 0; s < pEvent.slots.length; s++) {
          if (pEvent.slots[s].id === pEvent.slots[0].id) {
            myCalendar[myCalendarIndex].slots[s].owner = 'available';
            myCalendar[myCalendarIndex].slots[s].name = null;
          }
        }
      }
    }
    else if (pSlot.owner === person_id) {
      releaseSlot = true;
    }
    else { return; }  // clicked a slot not owner by the current user
    params.Payload = JSON.stringify({
      action: "sign_up",
      clientId: pEvent.client,
      sign_up: {
        "event_key": pEvent.event_key,
        "slot_id": pSlot.id,
        "owner": releaseSlot ? 'available' : person_id,
        "requestor": releaseSlot ? 'available' : person_id,
        "display_name": releaseSlot ? null : display_name,
        "new_list_key": (releaseSlot ? 'available' : person_id) + '#' + pEvent.schedule_key,
      }
    });
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log("AVA couldn't save this event.  Error is", JSON.stringify(err));
        enqueueSnackbar(`AVA couldn't save this event.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed && JSON.parse(fResp.Payload).status === 200) {
      if (releaseSlot) {
        myCalendar[myCalendarIndex].slots[pSlotIndex].owner = 'available';
        myCalendar[myCalendarIndex].slots[pSlotIndex].name = null;
        myCalendar[myCalendarIndex].slots[0].id = null;
        myCalendar[myCalendarIndex].slots[0].owner = null;
        myCalendar[myCalendarIndex].slots[0].name = null;
        setTheCalendar(myCalendar);
      }
      else {
        myCalendar[myCalendarIndex].slots[pSlotIndex].owner = person_id;
        myCalendar[myCalendarIndex].slots[pSlotIndex].name = display_name;
        myCalendar[myCalendarIndex].slots[0].id = myCalendar[myCalendarIndex].slots[pSlotIndex].id;
        myCalendar[myCalendarIndex].slots[0].owner = person_id;
        myCalendar[myCalendarIndex].slots[0].name = display_name;
        setTheCalendar(myCalendar);
      }
    };
    return;
  };

  return (
    (!myCalendar || myCalendar.length === 0)
      ?
      <Box flexGrow={1}>
        <Typography variant='h6'>
          Building your Calendar...
        </Typography>
        <CircularProgress />
      </Box>
      :
      <Box p={3}  >
        <Grid md={12} sm={12} xs={12} item>
          <GridList cellHeight='auto' cols={1} key='gridList'>
            {!myCalendar || myCalendar.length === 0
              ?
              null
              :
              myCalendar.map((this_event, index) => (
                (this_event.occData.status !== 'deleted' &&
                  (
                    !filterText ||
                    (this_event.occData.description.toLowerCase().includes(filterText)
                    || (this_event.occData.location && this_event.occData.location.toLowerCase().includes(filterText) )
                    )
                  )
                ) ?
                  <React-fragment key={this_event.id + 'frag' + index} >
                    {this_event.occData.date === working_date ? null :
                      <GridListTile
                        key={this_event.id + 'rhead' + index}
                        style={{ marginBottom: '0px', marginTop: (index === 0 ? '0px' : '50px') }}
                        cols={1}
                      >
                        <Box mb={0} py={1} px={0} borderBottom={2}>
                          <Box flexGrow={1}>
                            <Typography
                              className={classes.noDisplay}
                            >
                              {working_date = this_event.occData.date}
                            </Typography>
                            <Typography variant='h6'>
                              {formatDate(working_date)}
                            </Typography>
                          </Box>
                        </Box>

                      </GridListTile>
                    }
                    <GridListTile
                      key={this_event.id + 'r' + index}
                      style={{ marginBottom: '0px', marginTop: '0px' }}
                      cols={1}
                    >
                      <Paper
                        component={Box}
                        p={2}
                        mt={0} mb={1}
                        variant='outlined'
                        style={{ background: this_event, marginBottom: '0px', marginTop: '0px' }}
                        textAlign='left'
                        onClick={() => {
                          // onChooseCalendar(this_event);
                        }}
                        square>
                        <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                          <Box display='flex' flexDirection='column' className={classes.activityText} width='95%' textOverflow='ellipsis'>
                            <React.Fragment key={`act_box_${this_event.id}`}>
                              <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                <Box display='flex' flexGrow={1} flexDirection='column'>
                                  <Box display='flex' flexDirection='row'>
                                    <Typography variant='h6'>{this_event.occData.time_from}</Typography>
                                    {this_event.occData.time_to ?
                                      <Typography variant='h6'>&nbsp;-&nbsp;{this_event.occData.time_to}</Typography>
                                      : null}
                                  </Box>
                                  <Typography variant='h5'>{this_event.occData.description}</Typography>
                                  {this_event.occData.location ? <Typography variant='body2'>{this_event.occData.location}</Typography> : null}
                                </Box>
                                {(this_event.occData.owner === person_id) ?
                                  <React-fragment>
                                    <Box display='flex' flexDirection='row'>
                                      <IconButton
                                        key={'sheet_button' + this_event.event_key}
                                        variant={"contained"}
                                        className={classes.warning}
                                        onClick={async () => {
                                          await handlePrint(this_event, 'sign-up');
                                        }}
                                      >
                                        <AssignmentIcon />
                                      </IconButton>
                                      <IconButton
                                        key={'report_button' + this_event.event_key}
                                        variant={"contained"}
                                        className={classes.warning}
                                        onClick={async () => {
                                          await handlePrint(this_event, 'report');
                                        }}
                                      >
                                        <InfoOutlinedIcon />
                                      </IconButton>
                                      <IconButton
                                        key={'delete_button' + this_event.event_key}
                                        variant={"contained"}
                                        className={classes.warning}
                                        onClick={async () => {
                                          await handleDelete(this_event, index);
                                        }}
                                      >
                                        {deletePending === index ? <DeleteForeverIcon /> : <DeleteIcon />}
                                      </IconButton>
                                    </Box>
                                  </React-fragment>
                                  : null}
                              </Box>
                              {this_event.slots[0].owner === person_id
                                ? (this_event.occData.signup_type === 'time'
                                  ?
                                  <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                    <Typography variant='subtitle2'>
                                      You are signed-up for {Math.floor((this_event.slots[0].id - (this_event.slots[0].id > 1299 ? 1200 : 0)) / 100).toString() + ':' + ('0' + (this_event.slots[0].id % 100).toString()).substr(-2)}.  Tap to remove or select another time.
                                    </Typography>
                                  </Box>
                                  :
                                  (this_event.occData.signup_type !== 'seats'
                                    ? null
                                    : (
                                      <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                        <Typography variant='subtitle2'>
                                          You are signed-up for this event!  Tap below to remove your registration.
                                        </Typography>
                                      </Box>
                                    )
                                  )
                                )
                                : (this_event.occData.signup_type === 'none'
                                  ? null
                                  : (
                                    <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                      <Typography variant='subtitle2'>
                                        This event requires you to sign-up.
                                        {this_event.occData.signup_type === 'time' ? '  Choose a time below.' : '  Tap below to reserve your spot!'}
                                      </Typography>
                                    </Box>

                                  )
                                )
                              }
                              {(this_event.occData.signup_type !== 'time') ?
                                <Box display='flex' mt={2} flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                  <Button
                                    key={'seat_button' + this_event.event_key}
                                    disabled={this_event.slots[0].owner && (this_event.slots[0].owner !== person_id) && (this_event.slots[0].owner !== '') && (this_event.slots[0].owner !== 'available')}
                                    variant={this_event.slots[0].owner === person_id ? "contained" : "outlined"}
                                    className={this_event.slots[0].owner === person_id ? classes.confirm : null}
                                    onClick={async () => {
                                      await handleSeatSignup(this_event, index);
                                    }}
                                  >
                                    {this_event.slots[0].owner === person_id ?
                                      (this_event.occData.signup_type !== 'seats' ? "Reminder Set" : "Signed-up!")
                                      : (this_event.occData.signup_type !== 'seats' ? "Remind me?" : "Sign up?")}
                                  </Button>
                                </Box>
                                :
                                <Box flexWrap='wrap' display='flex' mt={2} flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                  {this_event.slots.map((this_slot, slotIndex) => (
                                    slotIndex === 0 ? null :
                                      <Button
                                        key={'time_button' + this_slot.id + this_event.occData.date}
                                        disabled={this_slot.owner && (this_slot.owner !== person_id) && (this_slot.owner !== '') && (this_slot.owner !== 'available')}
                                        variant={this_slot.owner === person_id ? "contained" : "text"}
                                        className={this_slot.owner === person_id ? classes.confirm : ((this_slot.owner && (this_slot.owner !== person_id) && (this_slot.owner !== '') && (this_slot.owner !== 'available')) ? classes.unavailable : null)}
                                        onClick={() => {
                                          handleTimeSignup(this_event, this_slot, index, slotIndex);
                                        }}
                                      >
                                        {Math.floor((this_slot.id - (this_slot.id > 1299 ? 1200 : 0)) / 100).toString() + ':' + ('0' + (this_slot.id % 100).toString()).substr(-2)}
                                      </Button>

                                  ))}
                                </Box>
                              }
                            </React.Fragment>
                          </Box>
                        </Box>
                      </Paper>
                    </GridListTile>
                  </React-fragment>
                  : null
              ))}

          </GridList>
        </Grid>

      </Box>
  );
};