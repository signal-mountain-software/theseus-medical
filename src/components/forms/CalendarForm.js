import React from 'react';

import { getCalendarEntries } from '../../util/AVACalendars';
import { cl } from '../../util/AVAUtilities';

import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CalendarEventEditForm from './CalendarEventEditForm';

import TextField from '@material-ui/core/TextField';

import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogContent from '@material-ui/core/DialogContent';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';

import Button from '@material-ui/core/Button';

import useMediaQuery from '@material-ui/core/useMediaQuery';

const useStyles = makeStyles(theme => ({
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
  title: {
    flexGrow: 1,
    marginTop: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold',
  },
  subTitle: {
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0.5),
    marginLeft: theme.spacing(2),
    fontSize: theme.typography.fontSize * 1.2
  },
  popUpMenu: {
    marginRight: theme.spacing(3),
    paddingRight: 2,
  },
  popUpMenuRow: {
    marginLeft: theme.spacing(1),
    fontSize: theme.typography.fontSize * 1.0,
  },
  popUpFooter: {
    fontSize: theme.typography.fontSize * 0.8,
  },
  defaultButton: {
    alignSelf: 'end',
    variant: 'outlined',
    verticalAlign: 'end',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  freeInput: {
    marginRight: 2,
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: theme.spacing(1),
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
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
  subDescriptionText: {
    marginTop: 0,
    marginBottom: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(5),
    fontSize: '0.8rem',
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

export default ({ myCalendar, person_id, kiosk_mode, display_name, peopleList, session, onClose }) => {

  let working_date = '';

  const now = new Date(new Date().setHours(0, 0, 0, 0));
  const today = now.getTime();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), (now.getDate() + 1)).getTime();
  const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };

  const classes = useStyles();

  const [detailEdit, setDetailEdit] = React.useState(false);
  const [request_filter_lower, setRequestFilterLower] = React.useState('');
  const [singleFilterDigit, setSingleFilterDigit] = React.useState(false);

  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone

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
    if (singleFilterDigit) { return true; }
    else {
      return (`${this_event.occData.description} ${this_event.occData.location}`).toLowerCase().includes(request_filter_lower);
    }
  }

  let filterTimeOut;
  const handleChangeRequestFilter = vCheck => {
    clearTimeout(filterTimeOut);
    cl(`set timeout with ${vCheck}`);
    filterTimeOut = setTimeout(() => {
      cl(`timeout ended ${vCheck}`);
      if (!vCheck) {
        setRequestFilterLower(null);
        setSingleFilterDigit(true);
      }
      else {
        setRequestFilterLower(vCheck.toLowerCase());
        setSingleFilterDigit(vCheck.length === 1);
      }
      setForceRedisplay(!forceRedisplay);
    }, 500);
  };

  return (
    <Dialog
      open={true || forceRedisplay}
      p={2}
      fullScreen
    >
      {myCalendar && (myCalendar.length > 0) &&
        <React.Fragment>
          <Box
            display='flex' flexDirection='row'
            className={classes.messageArea}
            key={'topBox'}
          >
            <Box
              display='flex'
              grow={1}
              style={{ width: '90%' }}
              mb={0}
              flexDirection='column'
              justifyContent='center'
              alignItems='flex-start'
            >
              <DialogContentText className={classes.title} id='scroll-dialog-title'>
                {!session.patient_display_name ? `Calendar of Events` : `${session.patient_display_name.split(',').pop()}'s Calendar`}
              </DialogContentText>
              {(myCalendar.length > 0) &&
                <DialogContentText className={classes.subDescriptionText}>
                  {formatDate(myCalendar[0].occData.date)} to {formatDate(myCalendar[myCalendar.length - 1].occData.date)}
                </DialogContentText>
              }
              {(myCalendar.length === 0) &&
                <DialogContentText className={classes.subDescriptionText}>
                  This Calendar is empty!
                </DialogContentText>
              }
            </Box>
            <Box
              component="img"
              ml={isMobile ? 2 : 5}
              mr={2}
              mt={2}
              aria-controls='hidden-menu'
              aria-haspopup='true'
              minWidth={isMobile ? 50 : 55}
              maxWidth={isMobile ? 50 : 55}
              minHeight={isMobile ? 50 : 55}
              maxHeight={isMobile ? 50 : 55}
              onClick={(event) => {
                handleClick(event);
                setPopupMenuOpen(true);
              }}
              alt=''
              src={process.env.REACT_APP_AVA_LOGO}
            />
            <Menu
              id='hidden-menu'
              anchorEl={anchorEl}
              open={popupMenuOpen}
              onClose={() => { setPopupMenuOpen(false); }}
              keepMounted>
              <MenuList className={classes.popUpMenu}>
                <MenuItem
                  onClick={() => {
                    onClose();
                  }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowHome'}
                  >
                    <HomeIcon />
                    <Typography className={classes.popUpMenuRow} >{'Go to AVA Menu'}</Typography>
                  </Box>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    let jumpTo = window.location.origin;
                    window.location.replace(jumpTo);
                  }}>
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowRefresh'}
                  >
                    <AutorenewIcon />
                    <Typography className={classes.popUpMenuRow} >{'Restart AVA'}</Typography>
                  </Box>
                </MenuItem>
                <MenuItem>
                  <Box
                    display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                    key={'vRowRefresh'}
                  >
                    <Typography className={classes.popUpFooter} >{`AVA vers ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                    <Typography className={classes.popUpFooter} >{`User ${session.user_id}${session.patient_id !== session.user_id ? (' (' + session.patient_id + ')') : ''}`}</Typography>
                    <Typography className={classes.popUpFooter} >{`Function: Calendar`}</Typography>
                  </Box>
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>
          <TextField
            id='List Filter'
            onChange={event => (handleChangeRequestFilter(event.target.value))}
            className={classes.freeInput}
            label={'Filter/Search'}
            variant={'standard'}
            autoComplete='off'
          />
          <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
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
                                      <Typography variant='h5'>{this_event.occData.description}</Typography>
                                      {this_event.occData.time$ &&
                                        <Typography variant='body2'>{this_event.occData.time$}</Typography>
                                      }
                                      {this_event.occData.location &&
                                        <Typography variant='body2'>{this_event.occData.location}</Typography>
                                      }
                                    </Box>
                                  </Box>
                                  {((this_event.occData.signup_type === 'time') || (this_event.occData.signup_type === 'seats')) &&
                                    <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                      <Typography variant='subtitle2'>
                                        {(this_event.slots && (this_event.slots[0].owner === person_id))
                                          ? <strong>You are signed-up {makeSlotName(this_event.slots[0].id)}</strong>
                                          : `Tap here to sign-up!`
                                        }
                                      </Typography>
                                    </Box>
                                  }
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
          </DialogContent>
        </React.Fragment>
      }
      <DialogActions style={{ justifyContent: 'center' }}>
        <Button className={classes.reject} size='small' variant='contained' onClick={onClose}>
          {'Done'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};