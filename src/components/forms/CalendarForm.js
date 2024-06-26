import React from 'react';
import { useSnackbar } from 'notistack';

import { makeDate, makeTime } from '../../util/AVADateTime';
import { cl, isMobile, isObject, deepCopy } from '../../util/AVAUtilities';
import { getCalendarEntries } from '../../util/AVACalendars';

import Grid from '@material-ui/core/Grid';
import ImageList from '@material-ui/core/ImageList';

import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CloseIcon from '@material-ui/icons/ExitToApp';

import CalendarEventEditForm from './CalendarEventEditForm';

import TextField from '@material-ui/core/TextField';

import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import PrintIcon from '@material-ui/icons/Print';
import AddEventIcon from '@material-ui/icons/Event';

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';
import DialogContent from '@material-ui/core/DialogContent';
import Dialog from '@material-ui/core/Dialog';

import NewCalendarEvent from '../dialogs/NewCalendarEvent';

import Button from '@material-ui/core/Button';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';
import useSession from '../../hooks/useSession';
import { printCalendar } from '../../util/AVACalendarPrint';

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
  AVAButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    border: '0.75px solid gray',
    textTransform: 'none',
    textDecoration: 'none',
    textWrap: 'nowrap',
    fontWeight: 'bold',
    size: 'small',
  },
  freeInput: {
    marginTop: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(0.75),
    width: '90%'
  },
  subDescriptionText2: {
    marginTop: 0,
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    fontSize: '0.8rem',
  },
  subDescriptionText: {
    marginTop: 0,
    marginBottom: 0,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    fontSize: '0.8rem',
  },
  progressBar: {
    marginBottom: theme.spacing(3),
    backgroundColor: '#a3a0a0',
    color: '#000000',
    transition: 'none',
    height: '5px'
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
}));

export default ({ myCalendar, person_id, peopleList, onClose, defaultValues = {} }) => {

  const { enqueueSnackbar } = useSnackbar();

  const classes = useStyles();
  const AVAClass = AVAclasses();
  const { state } = useSession();

  const selectedDate = React.useRef(null);

  const [reactData, setReactData] = React.useState(
    {
      rowLimit: 50,
      priorTop: 0,
      filterTextLower: null,
      selectDate: null,
      needRef: false,
      loading: false,
      progress: 0,
      pWidth: 60,
      defaultValues: defaultValues
    }
  );

  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  if (myCalendar.loadError || (myCalendar.length === 0)) {
    enqueueSnackbar(`AVA is still loading.  Wait just a moment and try again, please.`, { variant: 'warning' });
    //   onClose();
    //   return [];
  }

  React.useEffect(() => {
    if (selectedDate && selectedDate.current) {
      selectedDate.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [reactData.needRef]);

  const [detailEdit, setDetailEdit] = React.useState(false);
  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [anchorEl, setAnchorEl] = React.useState(null);

  let user_fontSize = AVADefaults({ fontSize: 'get' });
  let filterTimeOut;

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  function okToShow(this_event) {
    if (this_event.date === '29991231') { return false; }   // event was soft-deleted
    if (!reactData.filterTextLower) {
      return true;
    }
    else {
      return (`${this_event.description} ${this_event.location}`).toLowerCase().includes(reactData.filterTextLower);
    }
  }

  const handleChangePersonFilter = vCheck => {
    clearTimeout(filterTimeOut);
    cl(`set timeout with ${vCheck} at ${new Date().getTime()}`);
    filterTimeOut = setTimeout(() => {
      cl(`timeout ended ${vCheck} at ${new Date().getTime()}`);
      if (vCheck.length === 0) {
        updateReactData({
          filterTextLower: ''
        });
      }
      else {
        updateReactData({
          filterTextLower: vCheck.toLowerCase()
        });
      }
    }, 500);
  };

  function makeCalendarTime(i) {
    if (isObject(i)) {
      return `${i.from || ''}${(i.from && i.to && (i.from.trim() !== '') && (i.to.trim() !== '')) ? ' to ' : ''}${i.to || ''}`;
    }
    else { return i; }
  }

  function ordinal(n) {
    let ord = 'th';
    if (n % 10 === 1 && n % 100 !== 11) {
      ord = 'st';
    }
    else if (n % 10 === 2 && n % 100 !== 12) {
      ord = 'nd';
    }
    else if (n % 10 === 3 && n % 100 !== 13) {
      ord = 'rd';
    }
    return `${n}${ord}`;
  }

  return (
    <Dialog
      open={(true || forceRedisplay)}
      p={2}
      fullScreen
    >
      {myCalendar &&
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
              <Typography
                className={classes.title} style={AVATextStyle({ size: 1.3, bold: true, margin: { top: 1.5, left: 1, right: 1 } })}
              >
                {`${state.patient.name.first}${state.patient.name.first.slice(-1) === 's' ? "'" : "'s"} Calendar`}
              </Typography>

              <Box
                display='flex' flexDirection='row' alignItems={'center'}
                key={'vRowRefresh'}
              >
                {(Object.keys(myCalendar).length > 0) ?
                  <Typography
                    className={classes.subDescriptionText2} style={AVATextStyle({ margin: { left: 2, right: 2, bottom: 2 } })}
                  >
                    {reactData.selectDate ? reactData.selectDate.absolute_full :
                      `From ${makeDate(Object.keys(myCalendar)[0]).relative} through ${makeDate(Object.keys(myCalendar)[Object.keys(myCalendar).length - 1]).relative}`
                    }
                  </Typography>

                  :
                  <Typography
                    className={classes.subDescriptionText2} style={AVATextStyle({ margin: { left: 2, right: 2, bottom: 2 } })}
                  >
                    This Calendar is empty!
                  </Typography>
                }
              </Box>
            </Box>
            <Box
              component="img"
              ml={2}
              mr={2}
              mt={2}
              aria-controls='hidden-menu'
              aria-haspopup='true'
              minWidth={50}
              maxWidth={50}
              minHeight={50}
              maxHeight={50}
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
                    <Typography className={classes.popUpFooter} >{`User ${state.session.user_id}${state.session.patient_id !== state.session.user_id ? (' (' + state.session.patient_id + ')') : ''}`}</Typography>
                    <Typography className={classes.popUpFooter} >{`Function: Calendar`}</Typography>
                  </Box>
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>
          <Box display='flex'
            flexDirection='row'
            marginLeft={2}
            marginRight={2}
            marginBottom={0.5}
            border={reactData.filterDisplay ? 1 : 0}
            borderRadius={'16px'}
            key={'filterRow'}
          >
            <TextField
              id='List Filter'
              onChange={event => (handleChangePersonFilter(event.target.value))}
              className={classes.freeInput}
              helperText={isMobile ? 'Filter' : 'Type a few letters to filter the list'}
              inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
              FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
              variant={'standard'}
              autoComplete='off'
            />
          </Box>
          {!reactData.loading &&
            <DialogContent
              dividers={true} classes={{ dividers: classes.dialogBox }}
            //  onScroll={async (event) => (await handleScroll(event))}
            >
              <Box
                display='flex'
                alignItems='flex-start'
                flexDirection='row'
                flexWrap={'wrap'}
              >
                {Object.keys(myCalendar).map((this_date, index) => (        // an array of dates
                  <Box
                    key={this_date + 'rhead' + index}
                    ref={this_date ? selectedDate : null}
                    style={{ marginBottom: '0px', width: '300px', marginTop: '50px' }}
                    cols={1}
                  >
                    <Box
                      display='flex'
                      border={2}
                      style={{
                        width: '250px',
                        borderRadius: '30px 30px 30px 30px',
                        backgroundColor: ((makeDate(this_date).weekday === 'weekend') ? 'lightyellow' : null)
                      }}
                      ml={2} mr={2}
                      minHeight={'280px'}
                      justifyContent='flex-start'

                      alignItems='center'
                      flexDirection='column'
                    >
                      <Box
                        display='flex'
                        mb={0.5} mx={2} pt={1} px={0} borderBottom={2} mt={1} width={'80%'}>
                        <Box display='flex' flexGrow={1} flexDirection='row' justifyContent={'space-between'}>
                          <Typography
                            style={AVATextStyle({ size: 1.5 })}
                            key={this_date + 'head1' + index}
                          >
                            {['Today', 'Tomorrow'].includes(myCalendar[this_date].date_words) ? myCalendar[this_date].date_words : makeDate(this_date).dayOfWeek_word}
                          </Typography>
                          <Typography
                            style={AVATextStyle({ size: 1.5 })}
                            key={this_date + 'head2' + index}
                          >
                            {`${(makeDate(this_date).date.getDate() === 1) ? (makeDate(this_date).date.toLocaleString([], { month: 'long' }) + ' ') : ''}${ordinal(makeDate(this_date).date.getDate())}`}
                          </Typography>
                        </Box>
                      </Box>
                      {(Object.keys(myCalendar[this_date].events).length === 0) ?
                        <Box display='flex' flexDirection='column'
                          p={2}
                          mt={0} mb={1}
                          variant='outlined'
                          justifyContent='flex-start' alignItems='center'
                          key={`details${this_date}_noEvents`}
                        >
                          <Typography style={AVATextStyle({})}>
                            {`No Events Scheduled`}
                          </Typography>
                        </Box>
                        :
                        <React.Fragment>
                          {(Object.keys(myCalendar[this_date].events).sort((s1, s2) => {
                            return (myCalendar[this_date].events[s1].sort24 > myCalendar[this_date].events[s2].sort24 ? 1 : -1);
                          })).map((this_event, eventIndex) => (        // an array of events on this date
                            okToShow(myCalendar[this_date].events[this_event]) &&
                            <Box
                              component={Box}
                              p={2}
                              mt={0} mb={1}
                              variant='outlined'
                              textAlign='center'
                              key={`details${this_date}_${eventIndex}`}
                              onClick={async () => {
                                switch (myCalendar[this_date].events[this_event].type) {
                                  case 'holiday': {
                                    break;
                                  }
                                  case 'birthday': {
                                    break;
                                  }
                                  case 'personal': {
                                    break;
                                  }
                                  default: {
                                    let [eventInfo, occInfo] = await getCalendarEntries({
                                      person_id,
                                      client: myCalendar[this_date].events[this_event].client,
                                      event_id: myCalendar[this_date].events[this_event].event_key
                                    });
                                    myCalendar[this_date].events[this_event].occData = Object.assign({},
                                      eventInfo.eventData.event_data,
                                      eventInfo.eventData,
                                      { location: eventInfo.eventData.event_data.location.description },
                                      { signup_type: eventInfo.eventData.sign_up.type },
                                      occInfo,
                                      { date: occInfo.occurrence_date },
                                      { time$: `${eventInfo.eventData.event_data.time.from}${((eventInfo.eventData.event_data.time.to && eventInfo.eventData.event_data.time.to.trim() !== '') ? ' to ' + eventInfo.eventData.event_data.time.to : '')}` },
                                      { time24: this_event.time24 }
                                    );
                                    myCalendar[this_date].events[this_event].date_index = this_date;
                                    myCalendar[this_date].events[this_event].event_index = this_event;
                                    setDetailEdit(myCalendar[this_date].events[this_event]);
                                  }
                                }
                              }}
                            >
                              <Box display='flex' flexDirection='column'
                                justifyContent='flex-start' alignItems='center'
                              >
                                <Typography style={AVATextStyle({
                                  bold: true,
                                  color: (myCalendar[this_date].events[this_event].slot_owners.hasOwnProperty(state.session.patient_id) ? 'red' :
                                    (['holiday', 'birthday'].includes(myCalendar[this_date].events[this_event].type) ? 'blue' : 'black'))
                                })}>
                                  {myCalendar[this_date].events[this_event].description}
                                </Typography>
                                {myCalendar[this_date].events[this_event].slot_owners.hasOwnProperty(state.session.patient_id) &&
                                  <Typography style={AVATextStyle({ color: 'red', italic: true })}>
                                    {`You're signed up!`}
                                  </Typography>
                                }
                                {myCalendar[this_date].events[this_event].time
                                  &&
                                  (myCalendar[this_date].events[this_event].slot_owners.hasOwnProperty(state.session.patient_id) ?
                                    <Typography style={AVATextStyle({
                                      color: ('red')
                                    })}>
                                      {((myCalendar[this_date].events[this_event].type === 'time')
                                        ? (makeTime(myCalendar[this_date].events[this_event].slot_owners[state.session.patient_id]).time)
                                        : (makeCalendarTime(myCalendar[this_date].events[this_event].time)))
                                      }
                                    </Typography>
                                    :
                                    <Typography style={AVATextStyle({})}>
                                      {makeCalendarTime(myCalendar[this_date].events[this_event].time)}
                                    </Typography>
                                  )
                                }
                              </Box>
                            </Box>
                          ))}
                        </React.Fragment>
                      }
                    </Box>
                  </Box>
                ))}
              </Box>
            </DialogContent>
          }
          {!reactData.loading && detailEdit &&
            <CalendarEventEditForm
              pEventCode={detailEdit.event_key}
              peopleList={peopleList}
              pPatient={person_id}
              pClient={detailEdit.client}
              pOccData={detailEdit.occData}
              defaultValues={reactData.defaultValues}
              onReset={(updatedData) => {
                let calRef = myCalendar[detailEdit.date_index].events[detailEdit.event_index];
                calRef.description = updatedData.description;
                calRef.slot_owners = updatedData.summaryInfo.slot_owners;
                if (calRef.time24 !== updatedData.time24) {
                  calRef.time = updatedData.time$;
                  calRef.time24 = updatedData.time24;
                }
                if (calRef.date_index !== updatedData.date) {
                  if (myCalendar.hasOwnProperty(updatedData.date)) {
                    myCalendar[updatedData.date].events[detailEdit.event_index] = deepCopy(calRef);
                  }
                  delete myCalendar[detailEdit.date_index].events[detailEdit.event_index];
                }
                setDetailEdit(false);
                setForceRedisplay(forceRedisplay => !forceRedisplay);
              }}
            />
          }
          {!reactData.loading && reactData.addPersonalEvent &&
            <NewCalendarEvent
              patient={state.session}
              personalEvent={true}
              showNewEvent={true}
              onClose={(newEvent) => {
                if (newEvent && myCalendar.hasOwnProperty(newEvent.eventData.start_Date)) {
                  myCalendar[newEvent.eventData.start_Date].events[newEvent.event_id] = {
                    description: newEvent.eventData.event_data.description,
                    slot_owners: [],
                    time: makeCalendarTime(newEvent.eventData.event_data.time),
                    time24: (newEvent.eventData.event_data.time.from ? makeTime(newEvent.eventData.event_data.time.from).numeric24 : 0),
                    type: 'personal'
                  };
                }
                updateReactData({
                  addPersonalEvent: false
                }, true);
              }}
            />
          }
        </React.Fragment>
      };
      <Box display='flex' flexDirection='row'
        justifyContent='center' alignItems='center' style={{ marginTop: '1em' }}>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          startIcon={<CloseIcon fontSize="small" />}
          onClick={onClose}>
          {'Done'}
        </Button>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'green', color: 'white' }}
          size='small'
          startIcon={<AddEventIcon fontSize="small" />}
          onClick={async () => {
            updateReactData({
              addPersonalEvent: true
            }, true);
          }}
        >
          {'Add a Personal Event'}
        </Button>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'blue', color: 'white' }}
          size='small'
          startIcon={<PrintIcon fontSize="small" />}
          onClick={async () => {
            await printCalendar(
              {
                client_id: state.session.client_id,
                myCalendar,
                requestor: state.session.user_id,
                filterTextLower: reactData.filterTextLower,
                groupFilter: state.groups.belongsTo
              }
            );
          }}
        >
          {'Print'}
        </Button>
      </Box>
    </Dialog >
  );
};