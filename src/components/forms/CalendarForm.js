import React from 'react';

import { getCalendarEntries } from '../../util/AVACalendars';

import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CircularProgress from '@material-ui/core/CircularProgress';
import CalendarEventEditForm from './CalendarEventEditForm';

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

export default ({ myCalendar, person_id, kiosk_mode, display_name, filter, peopleList }) => {

  let working_date = '';

  const now = new Date(new Date().setHours(0, 0, 0, 0));
  const today = now.getTime();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), (now.getDate() + 1)).getTime();
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };

  const classes = useStyles();
  let filterText = filter ? filter.toLowerCase() : null;
  if (filterText) { working_date = ''; };

  const [detailEdit, setDetailEdit] = React.useState(false);

  function formatDate(pDate$) {
    let pDate = pDate$.toString() || '19591021';
    let yyyy = pDate.substr(0, 4);
    let mm = pDate.substr(4, 2);
    let dd = pDate.substr(6, 2);
    let dDate = new Date(yyyy, Number(mm) - 1, dd);
    let testDate = dDate.getTime();
    let rString = (testDate === today ? 'Today - ' : (testDate === tomorrow ? 'Tomorrow - ' : '')) + dDate.toLocaleDateString('en-US', dateOptions);
    return rString;
  }

  function makeSlotName(pSlot) {
    let nSlot = Number(pSlot);
    if (isNaN(nSlot)) { return ""; }
    if ((nSlot < 100) || (nSlot > 2359) || ((nSlot % 100) > 59)) { return ""; }
    else { return ` for ${makeReadableTime(pSlot, false)}`; }
  }

  function makeReadableTime(pTimeHM, withAMPM = false) {
    let pTime = Number(pTimeHM);
    let hh = Math.floor(pTime / 100);
    let mm = pTime % 100;
    let ampm = 'am';
    if (hh > 12) {
      hh -= 12;
      ampm = 'pm';
    }
    else if (hh === 12) {
      ampm = 'pm';
    }
    return `${hh}:${mm < 10 ? ('0' + mm) : mm}${withAMPM ? (' ' + ampm) : ''}`;
  }

  function okToShow(this_event) {
    if (!filterText) { return true; }
    if (this_event.occData.description.toLowerCase().includes(filterText)) { return true; }
    if (this_event.occData.location && this_event.occData.location.toLowerCase().includes(filterText)) { return true; }
    return false;
  }

  return (
    (!myCalendar || myCalendar.length === 0)
      ?
      <Box mt={2} flexGrow={1}>
        <CircularProgress />
      </Box>
      :
      <Box >
        <Grid item>
          <GridList cellHeight='auto' cols={1} key='gridList'>
            {myCalendar.map((this_event, index) => (
              okToShow(this_event) &&
              <React-fragment key={this_event.id + 'frag' + index} >
                {this_event.occData.date !== working_date &&
                  <GridListTile
                    key={this_event.id + 'rhead' + index}
                    style={{ marginBottom: '0px', marginTop: (index === 0 ? '0px' : '50px') }}
                    cols={1}
                  >
                    <Box mb={0} py={1} px={0} borderBottom={2}>
                      <Box flexGrow={1}>
                        <Typography
                          key={this_event.occData.date + 'dhead' + index}
                          className={classes.noDisplay}
                        >
                          {working_date = (this_event.occurrence_date || this_event.occData.date)}
                        </Typography>
                        <Typography
                          key={working_date + 'head' + index}
                          variant='h6'
                        >
                          {formatDate(working_date)}
                        </Typography>
                        {
                          // an event can display a message under its name
                          // To do this, put the message text in the description field
                          //    force a line break on the screen with %%
                        }
                        {this_event.occData.status === 'message' ?
                          this_event.occData.description.split('%%').map((messageLine) => (
                            <Typography
                              key={this_event.occData.date + 'message' + index}
                              variant='subtitle1'
                            >
                              {messageLine}
                            </Typography>
                          ))
                          : null
                        }
                      </Box>
                    </Box>
                  </GridListTile>
                }
                {this_event.occData.status !== 'message' &&
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
                      onClick={async () => {
                        setDetailEdit(this_event);
                      }}
                      square>
                      <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                        <Box display='flex' flexDirection='column' className={classes.activityText} width='95%' textOverflow='ellipsis'>
                          <React.Fragment key={`act_box_${this_event.id}`}>
                            <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                              <Box display='flex' flexGrow={1} flexDirection='column'>
                                <Box display='flex' flexDirection='row'>
                                  <Typography variant='h6'>{this_event.occData.time_from}</Typography>
                                  {this_event.occData.time_to &&
                                    <Typography variant='h6'>&nbsp;-&nbsp;{this_event.occData.time_to}</Typography>
                                  }
                                </Box>
                                <Typography variant='h5'>{this_event.occData.description}</Typography>
                                {this_event.occData.location &&
                                  <Typography variant='body2'>{this_event.occData.location}</Typography>
                                }
                              </Box>
                            </Box>
                            <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                              <Typography variant='subtitle2'>
                                {(this_event.slots && (this_event.slots[0].owner === person_id))
                                  ? `You are signed-up ${makeSlotName(this_event.slots[0].id)}`
                                  : `Tap here to sign-up!`
                                }
                              </Typography>
                            </Box>
                          </React.Fragment>
                        </Box>
                      </Box>
                    </Paper>
                  </GridListTile>
                }
              </React-fragment>
            ))}
          </GridList>
          {detailEdit &&
            <CalendarEventEditForm
              pEventCode={detailEdit.event_key}
              peopleList={peopleList}
              pPatient={person_id}
              pClient={detailEdit.client}
              pOccData={detailEdit.occData}
              onReset={async () => {
                let [slotRec] = await getCalendarEntries({
                  client_id: detailEdit.client,
                  event_id: detailEdit.event_key,
                  person_id: person_id,
                  type: ['slot']
                });
                if (slotRec) {
                  detailEdit.slots = [{
                    owner: person_id,
                    id: slotRec.slotData.id,
                    reminder_minutes: slotRec.slotData.reminder_minutes,
                    name: slotRec.slotData.reminder_minutes
                  }];
                }
                else if (detailEdit.slots) { delete detailEdit.slots; }
                setDetailEdit(false);
              }}
            />
          }
        </Grid>
      </Box>
  );
};;