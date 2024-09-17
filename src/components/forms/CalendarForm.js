import React from 'react';
import { useSnackbar } from 'notistack';

import { makeTime } from '../../util/AVADateTime';
import { cl, isMobile, isObject, deepCopy, titleCase } from '../../util/AVAUtilities';
import { getCalendarEntries, writeSlot, getSlotList } from '../../util/AVACalendars';
import { getImage } from '../../util/AVAPeople';

import { List, Box, Typography, Avatar, Tooltip } from '@material-ui/core';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CloseIcon from '@material-ui/icons/ExitToApp';
import HighlightOffIcon from '@material-ui/icons/HighlightOff';
import HourglassEmptyIcon from '@material-ui/icons/HourglassEmpty';
import CakeIcon from '@material-ui/icons/Cake';
import SignedUp from '@material-ui/icons/HowToReg';
import Flag from '@material-ui/icons/EmojiFlags';

import CalendarEventEditForm from './CalendarEventEditForm';

import TextField from '@material-ui/core/TextField';

import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import PrintIcon from '@material-ui/icons/Print';
import AddEventIcon from '@material-ui/icons/Event';
import DateRangeIcon from '@material-ui/icons/DateRange';
import CalendarViewDayIcon from '@material-ui/icons/CalendarViewDay';
import GroupIcon from '@material-ui/icons/Group';
import PersonAddDisabledIcon from '@material-ui/icons/PersonAddDisabled';

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';
import DialogContent from '@material-ui/core/DialogContent';
import Dialog from '@material-ui/core/Dialog';

import NewCalendarEvent from '../dialogs/NewCalendarEvent';
import PersonFilter from '../forms/PersonFilter';

import Button from '@material-ui/core/Button';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';
import useSession from '../../hooks/useSession';
import useMediaQuery from '@material-ui/core/useMediaQuery';
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
  avatar: {
    marginTop: 0,
    marginLeft: theme.spacing(2),
    marginBottom: 0,
    height: 50,
    width: 50,
    paddingTop: 0,
    fontSize: '1.3rem',
  },
  assignment_avatar: {
    marginTop: 0,
    marginBottom: 0,
    height: 40,
    width: 40,
    paddingTop: 0,
    fontSize: '0.8rem',
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
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
    width: '90%'
  },
  peopleBox: {
    paddingTop: 0,
    paddingLeft: 0,
    paddingBottom: theme.spacing(2),
    overflowX: 'scroll',
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    display: 'flex',
    width: '100%',
    flexDirection: 'row'
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
  dialogBox: {
    paddingBottom: theme.spacing(1),
    marginTop: theme.spacing(-5),
    minWidth: '100%',
    minHeight: '100%',
  },
  idText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  client_background: {
    backgroundColor: isObject(AVADefaults({ client_style: 'get' })) ? AVADefaults({ client_style: 'get' }).calendar_background : null
  },
  client_backgroundCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing(1.5),
    backgroundColor: isObject(AVADefaults({ client_style: 'get' })) ? AVADefaults({ client_style: 'get' }).calendar_background : null
  },
  button_area: {
    paddingBottom: 12,
    paddingTop: 4,
    backgroundColor: isObject(AVADefaults({ client_style: 'get' })) ? AVADefaults({ client_style: 'get' }).calendar_background : null
  },
  clientPopUp: {
    borderRadius: '30px 30px 30px 30px',
    backgroundColor: isObject(AVADefaults({ client_style: 'get' })) ? AVADefaults({ client_style: 'get' }).calendar_background : null
  },
}));

export default ({ myCalendar, calendarPeople, person_id, peopleList, onClose, defaultValues = {} }) => {

  /*
  DEFAULT VALUES
    slotsView - show all people that are signed up
    agendaView - show in straigh-line "agenda" format
    onlyRegistered - only show events that I am signed-up for
    assignmentView - show list of people you can assign to events
    allowAssign - required when assignmentView is true; this becomes assignment__list
    assignment__list - this is a list of people and groups that you may choose from to assign to events
  */

  const { enqueueSnackbar } = useSnackbar();

  const classes = useStyles();
  const AVAClass = AVAclasses();
  const { state } = useSession();
  const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const selectedDate = React.useRef(null);

  if (defaultValues.assignmentView) {
    defaultValues.slotsView = true
  }

  const [reactData, setReactData] = React.useState(
    {
      rowLimit: 50,
      selectedPerson_id: person_id,
      myCalendar,
      display_name: state.patient?.name?.first || 'My',
      filterTextLower: null,
      selectDate: null,
      popUpOpen: false,
      needRef: false,
      loading: false,
      event_being_edited: false,
      pWidth: 60,
      defaultValues: defaultValues,
      calendar_fill: isObject(AVADefaults({ client_style: 'get' })) ? AVADefaults({ client_style: 'get' }).calendar_fill : null,
      calendar_fill_text: isObject(AVADefaults({ client_style: 'get' })) ? AVADefaults({ client_style: 'get' }).calendar_fill_text : null
    }
  );


  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  if (reactData.myCalendar.loadError || (reactData.myCalendar.length === 0)) {
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

  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [anchorEl, setAnchorEl] = React.useState(null);

  let user_fontSize = AVADefaults({ fontSize: 'get' });
  let filterTimeOut;

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  const agendaView = () => {
    return reactData.defaultValues.agendaView;
  };

  const getPersonName = (idToFind) => {
    let this_person = state.accessList[state.session.client_id].list.find(this_member => {
      return (this_member.id === idToFind);
    });
    if (this_person) {
      return this_person.display_name;
    }
    else {
      return idToFind;
    }
  };

  const showSlots = () => {
    return reactData.defaultValues.slotsView;
  };

  const ownerOfSlots = (this_event, check_person) => {
    if (!check_person) {
      return (this_event.slot_owners.hasOwnProperty(reactData.selectedPerson_id));
    }
    else {
      return (this_event.slot_owners.hasOwnProperty(check_person));
    }
  };

  const isWaitListed = (this_event) => {
    return (this_event.hasOwnProperty('wait_list') && this_event.wait_list.includes(reactData.selectedPerson_id));
  };

  const allSlotsFull = (this_event) => {
    let response = (((this_event.type === 'seats') || (this_event.type === 'time'))
      && (this_event.slotPattern.length <= Object.keys(this_event.slot_owners).length));
    return response;
  };

  function okToShow(this_event) {
    if (this_event.date === '29991231') { return false; }   // event was soft-deleted
    if (reactData.defaultValues.hasOwnProperty('onlyRegistered')
      && (!this_event.slot_owners.hasOwnProperty(reactData.selectedPerson_id))) {
      return false;
    }
    if (!reactData.filterTextLower) {
      return true;
    }
    else {
      return (`${this_event.description} ${this_event.location}`).toLowerCase().includes(reactData.filterTextLower);
    }
  }

  const handleDragStart = (ev, id) => {
    ev.dataTransfer.setData('id', id);
  };

  const handleDragOver = (ev) => {
    ev.preventDefault();
  };

  const handleDrop = async (ev, { droppedOn_event, eventIndex, dateIndex }) => {
    ev.preventDefault();
    let dragged_id = ev.dataTransfer.getData('id');
    console.log(`dropped ${dragged_id} onto ${droppedOn_event.description}`);
    if (ownerOfSlots(droppedOn_event, dragged_id)) {
      console.log(`You are already signed up for ${droppedOn_event.description}`);
    }
    else {
      let slotAssigned = await handleAllocateSlot({
        person_id: dragged_id,
        this_event: droppedOn_event,
        eventIndex,
        dateIndex
      });
      if (slotAssigned) {
        if (!reactData.myCalendar[dateIndex].eventList[eventIndex].hasOwnProperty('slot_owners')) {
          reactData.myCalendar[dateIndex].eventList[eventIndex].slot_owners = {};
        }
        reactData.myCalendar[dateIndex].eventList[eventIndex].slot_owners[dragged_id] = slotAssigned;
        updateReactData({
          myCalendar: reactData.myCalendar
        }, true);
      }
    }
  };

  const handleAllocateSlot = async ({ this_event, person_id, eventIndex, dateIndex }) => {
    let slotToUse;
    if (!['time', 'seats'].includes(this_event.type)) {
      slotToUse = person_id;
    }
    else {
      let slotInfo = await getSlotList({
        client: state.session.client_id,
        "event": this_event.event_key
      });
      let slotList = Object.keys(slotInfo.slotObj).sort();
      let foundAt = slotList.findIndex(this_slot => {
        return (!slotInfo.slotObj[this_slot].status || ['released', 'available'].includes(slotInfo.slotObj[this_slot].status));
      });
      if (foundAt < 0) {
        console.log(`No available slots`);
        let [eventInfo, occInfo] = await getCalendarEntries({
          person_id,
          client: this_event.client,
          event_id: this_event.event_key
        });
        this_event.occData = Object.assign({},
          eventInfo.eventData.event_data,
          eventInfo.eventData,
          { location: eventInfo.eventData.event_data.location.description },
          { signup_type: eventInfo.eventData.sign_up.type },
          occInfo,
          { date: occInfo.occurrence_date },
          { time$: `${eventInfo.eventData.event_data.time.from}${((eventInfo.eventData.event_data.time.to && eventInfo.eventData.event_data.time.to.trim() !== '') ? ' to ' + eventInfo.eventData.event_data.time.to : '')}` },
          { time24: this_event.time24 }
        );
        this_event.date_index = dateIndex;
        this_event.event_index = eventIndex;
        updateReactData({
          event_being_edited: this_event
        }, true);
        return null;
      }
      else {
        slotToUse = slotList[foundAt];
      }
    }
    let writeRequest = {
      "client": state.session.client_id,
      "event": this_event.event_key,
      "occurrence_date": this_event.occurrence_date,
      "owner": person_id,
      "slot": slotToUse,
      "status": 'selected',
      "show_this_slot": true,
      "no_messaging": false
    };
    await writeSlot(writeRequest);
    console.log(`Added ${person_id} to ${this_event.description}${(slotToUse === person_id) ? '' : ' - ' + slotToUse}`);
    return slotToUse;
  };

  const handleChangePersonFilter = vCheck => {
    clearTimeout(filterTimeOut);
    cl(`set timeout with ${vCheck} at ${new Date().getTime()}`);
    filterTimeOut = setTimeout(() => {
      cl(`timeout ended ${vCheck} at ${new Date().getTime()}`);
      if (vCheck.length === 0) {
        updateReactData({
          filterTextLower: ''
        }, true);
      }
      else {
        updateReactData({
          filterTextLower: vCheck.toLowerCase()
        }, true);
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
      {reactData.myCalendar &&
        <React.Fragment>

          <Box
            display='flex' flexDirection='column'
            className={classes.client_background}
            alignItems={'center'}
            key={'topBox'}
          >

          <Box
            display='flex' flexDirection='row'
              className={classes.client_background}
            alignItems={'flex-start'} justifyContent={'space-between'}
              key={'topBox'}
              width={'100%'}
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
              <Box
                display='flex' flexDirection='row'
                className={classes.client_backgroundCenter}
                key={'nameBox'}
              >
                <Tooltip
                  className={classes.avatar}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, reactData.selectedPerson_id)}
                  title={
                    <Typography variant='caption'>
                      {`Drag to assign`}
                    </Typography>
                  }
                  placement='bottom-start'>
                  <Avatar src={getImage(reactData.selectedPerson_id)} />
                </Tooltip>
                <Typography
                  className={classes.title}
                  style={AVATextStyle({ size: 1.3, bold: true, margin: { left: 1, right: 1 } })}
                >
                  {`${reactData.display_name}${reactData.display_name.slice(-1) === 's' ? "'" : "'s"} Calendar`}
                </Typography>
              </Box>
              {(reactData.myCalendar.length === 0) &&
                <Box
                  display='flex' flexDirection='row' alignItems={'center'}
                  key={'vRowRefresh'}
                >
                  <Typography
                    className={classes.subDescriptionText2} style={AVATextStyle({ margin: { left: 2, right: 2, bottom: 2 } })}
                  >
                    This Calendar is empty!
                  </Typography>
                </Box>
              }
              <Box display='flex'
                flexDirection='row'
                minWidth={'60%'}
                className={classes.client_background}
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
            </Box>
            <Box
              component="img"
              m={2}
              aria-controls='hidden-menu'
              aria-haspopup='true'
              minWidth={50}
              minHeight={50}
              maxHeight={50}
              onClick={(event) => {
                handleClick(event);
                updateReactData({
                  popUpOpen: true
                }, true);
              }}
              alt=''
              src={state.session?.client_logo || process.env.REACT_APP_AVA_LOGO}
            />
            <Menu
              id='hidden-menu'
              anchorEl={anchorEl}
              open={reactData.popUpOpen}
              classes={{ paper: classes.clientPopUp }}
              onClose={() => {
                updateReactData({
                  popUpOpen: false
                }, true);
              }}
              keepMounted
            >
              <MenuList className={classes.popUpMenu}>
                <MenuItem
                  onClick={() => {
                    updateReactData({
                      selectPerson: true,
                      popUpOpen: false
                    }, true);
                  }}
                >
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowHome'}
                  >
                    <SwapHorizIcon />
                    <Typography className={classes.popUpMenuRow} >{`View someone else's calendar`}</Typography>
                  </Box>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    reactData.defaultValues.agendaView = !reactData.defaultValues.agendaView;
                    updateReactData({
                      defaultValues: reactData.defaultValues,
                      popUpOpen: false
                    }, true);
                  }}
                >
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowHome'}
                  >
                    {agendaView() ? <DateRangeIcon /> : <CalendarViewDayIcon />}
                    <Typography className={classes.popUpMenuRow} >{agendaView() ? 'Calendar view' : 'Agenda view'}</Typography>
                  </Box>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    reactData.defaultValues.slotsView = !reactData.defaultValues.slotsView;
                    updateReactData({
                      defaultValues: reactData.defaultValues,
                      popUpOpen: false
                    }, true);
                  }}
                >
                  <Box
                    display='flex' flexDirection='row' alignItems={'center'}
                    key={'vRowHome'}
                  >
                    {showSlots() ? <PersonAddDisabledIcon /> : <GroupIcon />}
                    <Typography className={classes.popUpMenuRow} >{showSlots() ? 'Hide people' : 'Show people'}</Typography>
                  </Box>
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    onClose();
                  }}
                >
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
                  }}
                >
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
                    <Typography className={classes.popUpFooter} >{`User ${state.session.user_id}${reactData.selectedPerson_id !== state.session.user_id ? (' (' + reactData.selectedPerson_id + ')') : ''}`}</Typography>
                    <Typography className={classes.popUpFooter} >{`Function: Calendar`}</Typography>
                  </Box>
                </MenuItem>
              </MenuList>
            </Menu>
          </Box>


            {reactData.defaultValues.assignmentView &&

              <Box className={classes.peopleBox} >
              {reactData.defaultValues.assignment__List.map((this_candidate, cX) => (
                <Box key={`candidate-${cX}`} mx={1} display='flex' justifyContent='center' alignItems='center' flexDirection='column'>
                  <Tooltip
                    className={classes.assignment_avatar}
                    draggable={true}
                    onDragStart={(e) => handleDragStart(e, this_candidate.person_id)}
                    title={
                      <Typography variant='caption'>
                        {this_candidate.display_name}
                      </Typography>
                    }
                    placement='bottom-start'>
                    <Avatar src={getImage(this_candidate.person_id)} />
                  </Tooltip>
                  <Typography className={classes.popUpFooter}>
                    {this_candidate.display_name.split(' ')[0]}
                  </Typography>
                  <Typography className={classes.popUpFooter}>
                    {this_candidate.display_name.split(' ')[-1]}
                  </Typography>
                </Box>
              ))}
            </Box>
          }

          </Box>


















          {!reactData.loading &&
            <DialogContent
              dividers={true}
              classes={{ dividers: classes.client_background }}
              style={{ paddingRight: '0px' }}
            >
              <Box display='flex' flexDirection='column' key={`screen_box`} className={classes.dialogBox}>
              
                <Box
                  display='flex'
                  alignItems='flex-start'
                  flexDirection={agendaView() ? 'column' : 'row'}
                  flexWrap={'wrap'}
                  key={`category-detail-box-outside2`}
                  style={{
                    paddingLeft: '4px',
                    minHeight: `${Math.min(reactData.visible_y - 400, 350)}px`,
                  }}
                  id='dialog-content'
                >
                  {reactData.myCalendar && (reactData.myCalendar.length > 0) &&
                    reactData.myCalendar.map((this_date, dateIndex) => (        // an array of dates
                      (!this_date.dateObj.error &&
                        <Box
                          key={this_date.dateObj.numeric$ + 'rhead' + dateIndex}
                          ref={this_date.dateObj.numeric$ ? selectedDate : null}
                          style={{ marginBottom: '0px', minWidth: `${user_fontSize * 300}px`, marginTop: '50px' }}
                          cols={1}
                        >
                          <Box
                            display='flex'
                            border={agendaView() ? null : 2}
                            style={agendaView() ? {} : {
                              minWidth: `${user_fontSize * 250}px`,
                              borderRadius: '30px 30px 30px 30px',
                              borderColor: reactData.calendar_fill_text,
                              backgroundColor: ((this_date.dateObj.weekday === 'weekend') ? (isDarkMode ? 'darkgoldenrod' : 'lightyellow') : reactData.calendar_fill)
                            }}
                            ml={2} mr={2}
                            minHeight={agendaView() ? '' : '280px'}
                            justifyContent='flex-start'
                            alignItems={agendaView() ? 'flex-start' : 'center'}
                            flexDirection='column'
                          >
                            {(this_date.dateObj.date.getDate() === 1) &&
                              <Typography
                                style={AVATextStyle({ size: 1.5, margin: { top: 1, bottom: -1 }, color: reactData.calendar_fill_text })}
                                key={this_date.dateObj.numeric$ + 'head2' + dateIndex}
                              >
                                {this_date.dateObj.date.toLocaleString([], { month: 'long' })}
                              </Typography>
                            }
                            <Box
                              display='flex'
                              width='-webkit-fill-available'
                              mb={0.5}
                              mx={2} pt={1}
                              px={agendaView() ? 0 : 2}
                              borderBottom={2} mt={1}
                              style={{
                                borderColor: reactData.calendar_fill_text,

                              }}
                            >
                              <Box display='flex' flexGrow={1} flexDirection='row'
                                justifyContent={agendaView() ? 'flex-start' : 'center'}>
                                <Typography
                                  style={AVATextStyle({ size: 1.5, margin: { right: 1 }, color: reactData.calendar_fill_text })}
                                  key={this_date.dateObj.numeric$ + 'head1' + dateIndex}
                                >
                                  {['Today', 'Tomorrow'].includes(this_date.date_words) ? this_date.date_words : this_date.dateObj.dayOfWeek_word}
                                </Typography>
                                <Typography
                                  style={AVATextStyle({ size: 1.5, color: reactData.calendar_fill_text })}
                                  key={this_date.dateObj.numeric$ + 'head2' + dateIndex}
                                >
                                  {ordinal(this_date.dateObj.date.getDate())}
                                </Typography>
                              </Box>
                            </Box>
                            {(this_date.eventList.length === 0) ?
                              <Box display='flex' flexDirection='column'
                                p={2}
                                mt={0} mb={1}
                                variant='outlined'
                                justifyContent='flex-start'
                                alignItems={agendaView() ? 'flex-start' : 'center'}
                                key={`details${this_date.dateObj.numeric$}_noEvents`}
                              >
                                <Typography style={AVATextStyle({})}>
                                  {`No Events Scheduled`}
                                </Typography>
                              </Box>
                              :
                              <React.Fragment>
                                {this_date.eventList.map((this_event, eventIndex) => (        // an array of events on this date
                                  okToShow(this_event) &&
                                  <Box
                                    component={Box}
                                    onDragOver={(e) => handleDragOver(e)}
                                    onDrop={async (e) => {
                                      await handleDrop(e, { droppedOn_event: this_event, eventIndex, dateIndex });
                                    }}
                                    display='flex' flexDirection='column'
                                    py={2} px={1}
                                    mt={0} mb={1}
                                    variant='outlined'
                                    textAlign={agendaView() ? 'flex-start' : 'center'}
                                    key={`details${this_date.dateObj.numeric$}_${eventIndex}`}
                                    onClick={async () => {
                                      switch (this_event.type) {
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
                                            person_id: reactData.selectedPerson_id,
                                            client: this_event.client,
                                            event_id: this_event.event_key
                                          });
                                          this_event.occData = Object.assign({},
                                            eventInfo.eventData.event_data,
                                            eventInfo.eventData,
                                            { location: eventInfo.eventData.event_data.location.description },
                                            { signup_type: eventInfo.eventData.sign_up.type },
                                            occInfo,
                                            { date: occInfo.occurrence_date },
                                            { time$: `${eventInfo.eventData.event_data.time.from}${((eventInfo.eventData.event_data.time.to && eventInfo.eventData.event_data.time.to.trim() !== '') ? ' to ' + eventInfo.eventData.event_data.time.to : '')}` },
                                            { time24: this_event.time24 }
                                          );
                                          this_event.date_index = dateIndex;
                                          this_event.event_index = eventIndex;
                                          updateReactData({
                                            event_being_edited: this_event
                                          }, true);
                                        }
                                      }
                                    }}
                                  >
                                    <Box display='flex' flexDirection='row'
                                      justifyContent={agendaView() ? 'flex-start' : 'center'}
                                      alignItems='center'
                                      color={(ownerOfSlots(this_event))
                                        ? (isDarkMode ? '#BB86FC' : '#38A028')
                                        : (isWaitListed(this_event) ? 'blue'
                                          : (allSlotsFull(this_event) ? 'red' : (reactData.calendar_fill_text)))
                                      }
                                    >
                                      {isWaitListed(this_event) && <HourglassEmptyIcon />}
                                      {allSlotsFull(this_event) && <HighlightOffIcon />}
                                      {ownerOfSlots(this_event) && <SignedUp />}
                                      {(this_event.type === 'holiday') && <Flag />}
                                      {(this_event.type === 'birthday') && <CakeIcon />}
                                      <Box display='flex' flexDirection='column'
                                        justifyContent='center'
                                        ml={1} mr={1}
                                        alignItems='center'
                                        color={(ownerOfSlots(this_event))
                                          ? (isDarkMode ? '#BB86FC' : '#38A028')
                                          : (isWaitListed(this_event) ? 'blue'
                                            : (allSlotsFull(this_event) ? 'red' : (reactData.calendar_fill_text)))
                                        }
                                      >
                                        <Typography style={AVATextStyle({
                                          bold: true,

                                        })}>
                                          {titleCase(this_event.description)}
                                        </Typography>
                                        {isWaitListed(this_event) &&
                                          <Typography style={AVATextStyle({ size: 1, italic: true })}>
                                            {`You're on the Waitlist`}
                                          </Typography>
                                        }
                                        {this_event.slot_owners.hasOwnProperty(reactData.selectedPerson_id)
                                          ?
                                          <React.Fragment>
                                            <Typography style={AVATextStyle({ size: 1, italic: true })}>
                                              {`You're signed up!`}
                                            </Typography>
                                            {(this_event.type !== 'seats') &&
                                              <Typography style={AVATextStyle({})}>
                                                {((this_event.type === 'time')
                                                  ? (makeTime(this_event.slot_owners[reactData.selectedPerson_id]).time)
                                                  : (makeCalendarTime(this_event.time)))
                                                }
                                              </Typography>
                                            }
                                          </React.Fragment>
                                          :
                                          <React.Fragment>
                                            {this_event.time
                                              &&
                                              <Typography style={AVATextStyle({})}>
                                                {makeCalendarTime(this_event.time)}
                                              </Typography>
                                            }
                                          </React.Fragment>
                                        }
                                      </Box>
                                      {(this_event.type === 'birthday') && <CakeIcon />}
                                      {(this_event.type === 'holiday') && <Flag />}
                                      {ownerOfSlots(this_event) && <SignedUp />}
                                      {allSlotsFull(this_event) && <HighlightOffIcon />}
                                      {isWaitListed(this_event) && <HourglassEmptyIcon />}
                                    </Box>
                                    {showSlots() && this_event.slot_owners
                                      && (Object.keys(this_event.slot_owners).length > 0)
                                      && Object.keys(this_event.slot_owners).map(this_owner => (
                                        <Typography style={AVATextStyle({ size: 0.8 })}>
                                          {getPersonName(this_owner.split('%%')[0])}
                                        </Typography>

                                      ))}
                                  </Box>
                                ))}
                              </React.Fragment>
                            }
                          </Box>
                        </Box>
                      )
                    ))}
                </Box>
              </Box>
            </DialogContent>
          }
          {!reactData.loading && reactData.event_being_edited &&
            <CalendarEventEditForm
              pEventCode={reactData.event_being_edited.event_key}
              peopleList={peopleList}
              pPatient={reactData.selectedPerson_id}
              pClient={reactData.event_being_edited.client}
              pViewOnly={reactData.event_being_edited.owner_only || false}
              pSignUps={calendarPeople}
              pOccData={reactData.event_being_edited.occData}
              defaultValues={reactData.defaultValues}
              onReset={(updatedData) => {
                let updateObj = {
                  event_being_edited: false
                };
                let calRef = reactData.myCalendar[reactData.event_being_edited.date_index].eventList[reactData.event_being_edited.event_index];
                calRef.description = updatedData.description;
                calRef.slot_owners = updatedData.summaryInfo.slot_owners;
                if (updatedData.wait_list) {
                  calRef.wait_list = updatedData.wait_list;
                }
                if (calRef.time24 !== updatedData.time24) {
                  calRef.time = updatedData.time$;
                  calRef.time24 = updatedData.time24;
                }
                if (calRef.occurrence_date !== updatedData.date) {
                  if (reactData.myCalendar.hasOwnProperty(updatedData.date)) {
                    reactData.myCalendar[updatedData.date].eventList[reactData.event_being_edited.event_index] = deepCopy(calRef);
                    updateObj.myCalendar = reactData.myCalendar;
                  }
                }
                updateReactData(updateObj, true);
              }}
            />
          }
          {!reactData.loading && reactData.addPersonalEvent &&
            <NewCalendarEvent
              patient={state.session}
              personalEvent={true}
              showNewEvent={true}
              onClose={(newEvent) => {
                if (newEvent && reactData.myCalendar.hasOwnProperty(newEvent.eventData.start_Date)) {
                  reactData.myCalendar[newEvent.eventData.start_Date].eventList[newEvent.event_id] = {
                    description: newEvent.eventData.event_data.description,
                    slot_owners: [],
                    time: makeCalendarTime(newEvent.eventData.event_data.time),
                    time24: (newEvent.eventData.event_data.time.from ? makeTime(newEvent.eventData.event_data.time.from).numeric24 : 0),
                    type: 'personal'
                  };
                }
                updateReactData({
                  addPersonalEvent: false,
                  myCalendar: reactData.myCalendar
                }, true);
              }}
            />
          }
          {reactData.selectPerson &&
            <PersonFilter
              prompt={`Whose Calendar do you want to View?`}
              splitter={'%%'}
              peopleList={state.accessList[state.session.client_id].list}
              multiSelect={false}
              onCancel={() => {
                updateReactData({
                  selectPerson: false
                }, true);
              }}
              onSelect={async (selection) => {
                let [display_name, myChoice] = selection.split('%%');
                updateReactData({
                  selectPerson: false,
                  selectedPerson_id: myChoice,
                  display_name
                }, true);
              }}
            >
            </PersonFilter>
          }
        </React.Fragment>
      };
      <Box display='flex' flexDirection='row'
        className={classes.button_area}
        paddingBottom={'1.5'} px={isMobile ? 2 : 6}
        justifyContent='space-between' alignItems='center'
      >
        <Box display='flex' flexWrap='wrap' flexGrow={1} flexDirection='row' justifyContent='center' alignItems='center' />
        <Box display='flex' flexWrap='wrap' flexGrow={2} flexDirection='row' justifyContent='center' alignItems='center'>
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'red', color: 'white' }}
            size='small'
            startIcon={<CloseIcon fontSize="small" />}
            onClick={onClose}>
            {'Done'}
          </Button>
        </Box>
        <Box display='flex' flexWrap='wrap' flexGrow={2} flexDirection='row' justifyContent='center' alignItems='center'>
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
                  myCalendar: reactData.myCalendar,
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
        <Box display='flex' flexWrap='wrap' flexGrow={1} flexDirection='row' justifyContent='center' alignItems='center' />
      </Box>
    </Dialog >
  );
};