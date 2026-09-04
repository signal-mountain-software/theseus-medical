import React from 'react';

import { makeTime, makeDate, addDays } from '../../util/AVADateTime';
import { isObject, deepCopy, titleCase, makeArray, isEmpty } from '../../util/AVAUtilities';
import { getCalendarEntries, writeSlot, getSlotList, publishCalendar } from '../../util/AVACalendars';
import { getImage, getPerson, makeName } from '../../util/AVAPeople';
import AVATextInput from './AVATextInput';
import { Alert, AlertTitle } from '@material-ui/lab/';
import Select from 'react-dropdown-select';

import { Snackbar, Box, Typography, Avatar, IconButton } from '@material-ui/core';
import Tooltip from '@material-ui/core/Tooltip';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CloseIcon from '@material-ui/icons/ExitToApp';
import SearchIcon from '@material-ui/icons/Search';
import ClearIcon from '@material-ui/icons/Clear';

import CalendarEventEditForm from './CalendarEventEditForm';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import PrintIcon from '@material-ui/icons/Print';
import AddEventIcon from '@material-ui/icons/Event';
import DateRangeIcon from '@material-ui/icons/DateRange';
import CalendarViewDayIcon from '@material-ui/icons/CalendarViewDay';
import GroupIcon from '@material-ui/icons/Group';
import PersonAddDisabledIcon from '@material-ui/icons/PersonAddDisabled';
import EventIcon from '@material-ui/icons/Event';
import AssignmentTurnedInIcon from '@material-ui/icons/AssignmentTurnedIn';

import ArrowForwardIcon from '@material-ui/icons/ArrowForward';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import TodayIcon from '@material-ui/icons/Today';

import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogActions from '@material-ui/core/DialogActions';
import Dialog from '@material-ui/core/Dialog';

import NewCalendarEvent from '../dialogs/NewCalendarEvent';
import PersonFilter from '../forms/PersonFilter';

import Button from '@material-ui/core/Button';

import { AVAclasses, AVATextStyle, AVADefaults, contrastColor, hexColors, make_rgba } from '../../util/AVAStyles';
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
    fontSize: '1.2rem',
  },
  tooltipBody: {
    backgroundColor: 'rgba(245, 245, 249, 0.8)',
    color: 'rgba(0, 0, 0, 0.87)',
    minHeight: 30,
    paddingBottom: 1,
    borderRadius: '30px',
    fontSize: 1,
    border: '1px solid #242426',
  },
  arrowBody: {
    color: '#f5f5f9',
    fontSize: theme.typography.pxToRem(12),
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  title: {
    flexGrow: 1,
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
    fontSize: theme.typography.fontSize * 0.8
    ,
  },
  dragNamesFirst: {
    fontSize: theme.typography.fontSize * 1.2,
    marginTop: '3px',
    marginBottom: '-10px'
  },
  dragNamesLast: {
    fontSize: theme.typography.fontSize * 1.2,
    marginTop: '3px',
    fontWeight: 'bold',
    marginBottom: '-10px'
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
  AVAButtonSize: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  freeInput: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
    width: '90%'
  },
  peopleBox: {
    paddingTop: 0,
    paddingBottom: theme.spacing(2),
    overflowX: 'auto',
    scrollbarWidth: 'thin',
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    display: 'flex',
    width: '100%',
    flexDirection: 'row'
  },
  peopleBoxWithSpace: {
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    overflowX: 'auto',
    scrollbarWidth: 'thin',
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    display: 'flex',
    width: '100%',
    flexDirection: 'row'
  },
  dateCell: {
    transform: `style(1.4)`,
    display: 'flex',
    flexDirection: 'column',
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(1),
    paddingTop: theme.spacing(2),
    paddingBottom: theme.spacing(2),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    textAlign: 'center'
  },
  subDescriptionText2: {
    marginTop: 0,
    marginBottom: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    fontSize: '1.4rem',
  },
  subDescriptionText: {
    marginTop: 0,
    marginBottom: 0,
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
    fontSize: '1.4rem',
  },
  progressBar: {
    marginBottom: theme.spacing(3),
    backgroundColor: '#a3a0a0',
    color: '#000000',
    transition: 'none',
    height: '5px'
  },
  radioText: {
    fontSize: theme.typography.fontSize * 1.4,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  dialogBox: {
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
    minHeight: '100%',
  },
  idText: {
    fontSize: theme.typography.fontSize * 1.4,
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

export default ({ myCalendar, calendarPeople, conflictInfo = {}, person_id, peopleList, onClose, defaultValues = {} }) => {

  /*
  DEFAULT VALUES
    slotsView - show all people that are signed up
    agendaView - show in straigh-line "agenda" format
    weekView - show in week format
    subtitle - if present, text to show under the person name
    onlyRegistered - only show events that I am signed-up for
    onlyPublished - only show events that have alreasdy been published
    viewOnly - do not allow updates to event details
    assignmentView - show list of people you can assign to events
    allowAssign - required when assignmentView is true; this becomes assignment__list
    template__List - a list of event templates to use when creating new appointments
    assignment__list - this is a list of people and groups that you may choose from to assign to events
    message_override - [list of IDs] or [*none*] (default if missing: added slots = message to the event owner)
    colorScheme: {   (if this exists at all, ALL colors are overridden; missing keys will be null/black color)
      owned: <color> if the session.patient_id owns any slot, use this color (default: green) 
      full: <color> if all slots are filled, use this color (default: red)
      empty: <color> if NO slots are filled, use this color (default: null)      
      atLeast_n: <color> if 'n' or more slots are filled, use this color (default: null)
      lessThan_n: <color> if less than 'n'slots are filled, use this color (default: null)
      waitlist: <color> if there is a waitlist, and session.patient_id is NOT on it, use this color (default: orange)
      waitlisted: <color> if there is a waitlist, and session.patient_id IS on it, use this color (default: orange)
    }
  */

  const classes = useStyles();
  const AVAClass = AVAclasses();
  const { state } = useSession();
  const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const selectedDate = React.useRef(null);
  const dateSelectRef = React.useRef(null);

  if (defaultValues.assignmentView) {
    defaultValues.slotsView = true;
  }

  if (!defaultValues.template__List) {
    defaultValues.template__List = [];
  }

  const defaultColorScheme = {
    unavailable: 'purple',
    owned: 'green',
    full: 'red',
    waitlist: 'orange',
    waitlisted: 'orange'
  };

  const [reactData, setReactData] = React.useState(
    {
      alert: false,
      rowLimit: 50,
      todayYMD: makeDate(new Date()).numeric,
      selectedPerson_id: person_id,
      myCalendar,
      display_name: state.patient?.name?.first || 'My',
      filterTextLower: null,
      searchForcedAgenda: false,
      locationFilter: '*all',
      selectDate: null,
      clicked_on_date: false,
      administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),
      popUpOpen: false,
      needRef: false,
      loading: false,
      event_being_edited: false,
      pWidth: 60,
      defaultValues: defaultValues,
      selectedPersonRec: {},
      dayDetailsIndex: null,
      conflictInfo: conflictInfo,
      colorScheme: Object.assign({}, defaultColorScheme, defaultValues.colorScheme),
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

  const handlePublishOptions = async ({ response, results }) => {
    updateReactData({
      alert: {
        severity: 'warning',
        title: 'Publish warning!',
        message: <div>
          There is a filter on.  This will cause {results.failedFilter} event(s) to be skipped.<br /><br />
          You may: <br />
          <strong>Continue</strong> with the filter as is, skipping the {results.failedFilter} event(s),<br />
          <strong>Ignore</strong> the filter, publishing all available events, or<br />
          <strong>Cancel</strong> and go back without publishing anything</div>,
        action: [
          {
            text: `Continue`,
            function: (async () => {
              response.proceedWithoutWarning = true;
              await executePublish(response);
              updateReactData({
                setPublishDates: false
              }, true);
            })
          },
          {
            text: `Ignore`,
            function: (async () => {
              response.proceedWithoutWarning = true;
              response.ignoreFilters = true;
              await executePublish(response);
              updateReactData({
                setPublishDates: false
              }, true);
            })
          },
          {
            text: `Cancel`,
            function: () => {
              updateReactData({
                setPublishDates: false,
                alert: false
              }, true);
            }
          }
        ]
      }
    }, true);
  };

  const executePublish = async (response) => {
    let publishData = await publishCalendar(
      {
        client: {
          client_id: state.session.client_id,
          client_name: state.session.client_name
        },
        myCalendar: reactData.myCalendar,
        requestor: state.session.user_id,
        filters: {
          filterTextLower: response.ignoreFilters ? '' : reactData.filterTextLower,
          ownerFilter: response.ignoreFilters ? false : reactData.idFilter,
          eventFilter: response.ignoreFilters ? false : reactData.eventIDFilter
        },
        startDate: makeDate(response[0]).date,
        endDate: makeDate(response[1]).date,
        proceedWithoutWarning: response.proceedWithoutWarning || false
      }
    );
    if (publishData.warningsExist) {
      await handlePublishOptions({ response, results: publishData.results });
      return;
    }
    else {
      reactData.myCalendar.forEach((pDate, pDx) => {
        pDate.eventList.forEach((pEvent, pEx) => {
          if (publishData.event_list.includes(pEvent.event_key)) {
            reactData.myCalendar[pDx].eventList[pEx].published = true;
          }
        });
      });
      let dateRangeMessage = `Publish complete for ${publishData.dates.from}`;
      if (publishData.dates.from !== publishData.dates.to) {
        dateRangeMessage += ` to ${publishData.dates.to}`;
      }
      let previouslyPublishedMessage = '';
      if (publishData.already_published > 0) {
        previouslyPublishedMessage = `${publishData.already_published} event${(publishData.already_published > 1) ? 's' : ''} had already been published`;
      }
      let skippedMessage = '';
      if (publishData.results && (publishData.results.failedFilter > 0)) {
        skippedMessage = `${publishData.results.failedFilter} event(s) were skipped due to a filter you have set`;
      }
      updateReactData({
        myCalendar: reactData.myCalendar,
        alert: {
          severity: 'success',
          title: `Publish complete`,
          message: <div>
            {dateRangeMessage}< br />
            <br />
            <strong>{publishData.results.willPublish}</strong> events were published<br />
            <strong>{(publishData.people_count === 0) ? 'No' : publishData.people_count}</strong> notifications sent<br />
            {previouslyPublishedMessage}<br />
            {skippedMessage}</div >,
        }
      }, true);
    }
    return;
  };

  const handleConflictOptions = ({ conflictingEvent, dragged_id, eventObj }) => {
    let { droppedOn_event, eventIndex, dateIndex, eventStart24, eventEnd24 } = eventObj;
    updateReactData({
      alert: {
        severity: 'warning',
        title: 'Conflict warning!',
        message: `This conflicts with ${conflictingEvent}`,
        action: [
          {
            text: `Go ahead`,
            function: (async () => {
              await proceedWithSignUp(dragged_id, { droppedOn_event, eventIndex, dateIndex, eventStart24, eventEnd24 });
              updateReactData({
                alert: false
              }, true);
              return;
            })
          },
          {
            text: `Don't assign`,
            function: () => {
              updateReactData({
                alert: false
              }, true);
              return;
            }
          }
        ]
      }
    }, true);
  };

  if (reactData.myCalendar.loadError || (reactData.myCalendar.length === 0)) {
    updateReactData({
      alert: {
        severity: 'warning',
        title: 'Loading',
        message: `AVA is still loading.  Wait just a moment and try again, please.`
      }
    }, true);
  }

  if ((reactData.defaultValues.start_date !== defaultValues.start_date)
    || (reactData.defaultValues.end_date !== defaultValues.end_date)
    || (reactData.myCalendar.length !== myCalendar.length)) {
    updateReactData({
      myCalendar,
      defaultValues: Object.assign({},
        reactData.defaultValues,
        {
          start_date: defaultValues.start_date,
          end_date: defaultValues.end_date
        }
      )
    }, true);
  }

  React.useEffect(() => {
    if (reactData.defaultValues.selectDate) {
      let checkDate = makeDate(reactData.defaultValues.selectDate).numeric$;
      if (checkDate !== reactData.selectDate) {
        updateReactData({
          selectDate: checkDate,
          needRef: true
        }, true);
      }
    };
    // re-render so agendaView()/isMobileWidth() reflect the current window width
    function handleResize() {
      setCellFitCounts({});
      updateReactData({}, true);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  React.useEffect(() => {
    if (selectedDate && selectedDate.current) {
      selectedDate.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [reactData.needRef]);

  React.useEffect(() => {
    if (dateSelectRef && dateSelectRef.current) {
      console.log(dateSelectRef.current.value);
    }
  }, [dateSelectRef]);

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  const isMobileWidth = () => (window.window.innerWidth < 800);

  const agendaView = () => {
    return reactData.defaultValues.agendaView || isMobileWidth();
  };

  // jump the loaded calendar window to the 4-week block (Sun-Sat x4) containing pDate
  const navigateToWindow = (pDate) => {
    let dObj = makeDate(pDate, { noTime: true, noYearCorrection: true });
    if (!dObj.error) {
      onClose({
        action: 'reset',
        newStartDate: addDays(dObj.date, -dObj.dayOfWeek),
        newEndDate: addDays(dObj.date, 27 - dObj.dayOfWeek)
      });
    }
  };

  // grid-cell overflow trimming: how many event entries actually fit a date's fixed-height box, keyed by dateIndex
  const cellContentRefs = React.useRef({});
  const cellShownCountsRef = React.useRef({});
  const [cellFitCounts, setCellFitCounts] = React.useState({});

  // the set of events/filters changed - let every cell start over from "show all" so it can grow back, not just shrink
  React.useEffect(() => {
    setCellFitCounts({});
  }, [reactData.myCalendar, reactData.filterTextLower, reactData.locationFilter, reactData.eventIDFilter, reactData.idFilter]);

  // after every render, shrink any grid cell whose entries overflow its fixed-height box, one entry at a time, until it fits
  // intentionally runs on every render (no dep array) since layout/content can change for reasons not worth tracking individually
  // eslint-disable-next-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    if (agendaView()) { return; }
    const overflowing = Object.keys(cellContentRefs.current).filter((key) => {
      const el = cellContentRefs.current[key];
      return el && (el.scrollHeight > el.clientHeight + 1) && (cellShownCountsRef.current[key] > 0);
    });
    if (overflowing.length === 0) { return; }
    setCellFitCounts((prev) => {
      const next = { ...prev };
      overflowing.forEach((key) => {
        next[key] = cellShownCountsRef.current[key] - 1;
      });
      return next;
    });
  });

  // clears the active search and, if search had forced Agenda view, restores whatever view the user was in before
  const clearSearch = (extra = {}) => {
    let reactUpdObj = Object.assign({
      filterTextLower: false,
      idFilter: false,
      eventIDFilter: false
    }, extra);
    if (reactData.searchForcedAgenda) {
      reactData.defaultValues.agendaView = false;
      reactUpdObj.defaultValues = reactData.defaultValues;
      reactUpdObj.searchForcedAgenda = false;
    }
    updateReactData(reactUpdObj, true);
  };

  const eventsToShow = (this_date) => {
    return this_date.eventList.some((this_event) => {        // an array of events on this date
      return okToShow(this_event);
    });
  };

  const isUnAvailable = (this_date, this_person) => {
    return this_date.eventList.some((this_event) => {        // an array of events on this date
      if (!this_event.customizations) { return false; }
      if (!this_event.customizations.hasOwnProperty('show_as_unavailable')) { return false; }
      if (!okToShow(this_event)) { return false; }
      return (this_event.slot_owners.hasOwnProperty(this_person));
    });
  };

  const getPersonName = (idToFind) => {
    if (typeof idToFind === 'string' && idToFind.toLowerCase().startsWith('guest:')) {
      return titleCase(idToFind.slice(6).replace(/_/g, ' '));
    }
    if (!state.accessList?.[state.session.client_id]?.list) {
      return idToFind;
    }
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
    if (!this_event.hasOwnProperty('slot_owners')) {
      return false;
    }
    else if (!check_person) {
      return (this_event.slot_owners.hasOwnProperty(reactData.selectedPerson_id));
    }
    else {
      return (this_event.slot_owners.hasOwnProperty(check_person));
    }
  };

  const waitListExists = (this_event) => {
    return (this_event.hasOwnProperty('wait_list') && (this_event.wait_list.length > 0));
  };

  const isWaitListed = (this_event) => {
    return (
      this_event.hasOwnProperty('wait_list')
      && this_event.wait_list.includes(reactData.selectedPerson_id)
      && (this_event.occurrence_date >= reactData.todayYMD)
    );
  };

  const allSlotsFull = (this_event) => {
    if (!['seats', 'time'].includes(this_event.type)) {
      return false;
    }
    else if (!this_event.slotPattern) {
      return false;
    }
    else if (!this_event.slot_owners) {
      return false;
    }
    else {
      return (this_event.slotPattern.length <= Object.keys(this_event.slot_owners).length);
    }
  };

  const allSlotsEmpty = (this_event) => {
    return (Object.keys(this_event.slot_owners).length === 0);
  };

  function getLocationOptions() {
    let foundLocations = new Set(makeArray(state.session.campus_locations).filter(loc => (loc && (loc.trim() !== ''))));
    let hasNoLocationEvent = false;
    reactData.myCalendar.forEach(this_date => {
      this_date.eventList.forEach(this_event => {
        const description = this_event.location?.description?.trim();
        if (description) { foundLocations.add(description); }
        else { hasNoLocationEvent = true; }
      });
    });
    let options = [{ value: '*all', label: 'All Locations' }];
    if (hasNoLocationEvent) { options.push({ value: '*none*', label: '(No Location)' }); }
    return options.concat(Array.from(foundLocations).sort((a, b) => a.localeCompare(b)).map(loc => ({ value: loc, label: loc })));
  }

  function okToShow(this_event) {
    if (this_event.date === '29991231') { return false; }   // event was soft-deleted
    if (reactData.locationFilter && (reactData.locationFilter !== '*all')) {
      const description = this_event.location?.description?.trim();
      if (reactData.locationFilter === '*none*') {
        if (description) { return false; }
      }
      else if (description !== reactData.locationFilter) { return false; }
    }
    if (reactData.defaultValues.hasOwnProperty('onlyRegistered')
      && (!this_event.slot_owners.hasOwnProperty(reactData.selectedPerson_id))) {
      return false;
    }
    if (reactData.defaultValues.hasOwnProperty('onlyPublished')
      && (!this_event.published)) {
      return false;
    }
    if (!reactData.administrative_account && this_event.groups && (this_event.groups.length > 0)) {
      const isMember = this_event.groups.some((group) => {
        let response = ((group === '*all') || Object.keys(state.groups.belongsTo).includes(group));
        return (response);
      });
      if (!isMember) { return false; }
    }
    if (this_event.type === 'personal') {
      if ([this_event.owner].flat().includes(reactData.selectedPerson_id)
        || reactData.administrative_account
        || this_event.slot_owners.hasOwnProperty(reactData.selectedPerson_id)
      ) {
        // no-op
      }
      else {
        return false;
      }
    }
    if ((reactData.idFilter) && (!this_event.slot_owners.hasOwnProperty(reactData.idFilter))) {
      //    console.log(`failed - ${reactData.idFilter} in ${Object.keys(this_event.slot_owners)}`)
      return false;
    }
    else if (reactData.eventIDFilter) {
      return (this_event.event_id === reactData.eventIDFilter);
    }
    else if ((!reactData.idFilter) && (this_event.customizations?.show_as_unavailable)) {
      return false;
    }
    else if (!reactData.filterTextLower) {
      return true;
    }
    else if (reactData.filterTextLower.startsWith('publish')
      && (this_event.published)) {
      return true;
    }
    else if (reactData.filterTextLower.startsWith('unpub')
      && (!this_event.published)) {
      return true;
    }
    else if (['red', 'green'].includes(reactData.filterTextLower) && (setTextColor(this_event).color === reactData.filterTextLower)) {
      return true;
    }
    else if ((reactData.filterTextLower === 'full') && !allSlotsFull(this_event)) {
      return false;
    }
    else {
      return ((`${this_event.description} ${this_event.location}`).toLowerCase().includes(reactData.filterTextLower));
    }
  }

  function onlyLocationFilterActive() {
    return !!(reactData.locationFilter && (reactData.locationFilter !== '*all')
      && !reactData.filterTextLower && !reactData.idFilter && !reactData.eventIDFilter);
  }

  const handleDragStart = (ev, id) => {
    ev.dataTransfer.setData('id', id);
  };

  let dropTarget = {};
  const handleDragOver = (ev, target) => {
    ev.preventDefault();
    dropTarget[target.type] = target.data;
  };

  const isTemplate = (id) => {
    return (id.startsWith('template:'));
  };

  const getTemplate = (id) => {
    let template_id = id.split('%%')[1];
    return (reactData.defaultValues.template__List.find(this_template => {
      return this_template.event_data.event_id === template_id;
    }));
  };

  const handleDrop = async (ev, dropType) => {
    ev.preventDefault();
    let dragged_id = ev.dataTransfer.getData('id');
    console.log(`drop on ${dropType} with ${Object.keys(dropTarget)}`);
    switch (dropType) {
      case 'event': {
        if (!isTemplate(dragged_id)) {
          await eventSignup(dragged_id, dropTarget['event']);
          dropTarget = {};
          break;
        }
        else {
          dropTarget['calendar_cell'].this_date = { dateObj: makeDate(dropTarget['event'].droppedOn_event.occurrence_date) };
        }
        // intentionally drop through to calendar_cell case
      }
      // eslint-disable-next-line
      case 'calendar_cell': {
        if (dropTarget.hasOwnProperty('calendar_cell')) {
          if (isTemplate(dragged_id)) {
            let personRec = null;
            if (reactData.idFilter) {
              personRec = await getPerson(reactData.idFilter);
            }
            updateReactData({
              addTemplateEvent: true,
              selectedTemplate: getTemplate(dragged_id),
              selectedPersonRec: personRec,
              isAppointment: true,
              appointmentStart: null,
              appointmentEnd: null,
              appointmentDate: dropTarget['calendar_cell'].this_date
            }, true);
          }
          else {
            let personRec = await getPerson(dragged_id);
            updateReactData({
              getAppointmentType: true,
              appointmentStart: null,
              appointmentEnd: null,
              appointmentDate: dropTarget['calendar_cell'].this_date,
              selectedPersonRec: personRec,
            }, true);
            /*
             updateReactData({
                    addPersonalEvent: true,
                    getAppointmentType: false,
                    isAppointment: true,
                    appointmentStart: response[1],
                    appointmentEnd: response[2]
                  }, true);
            */
          }
        }
        break;
      }
      case 'filter_button': {
        if (isTemplate(dragged_id)) {
          let templateRec = getTemplate(dragged_id);
          updateReactData({
            eventIDFilter: templateRec.event_data.event_id,
            idFilter: false,
            //          filterTextLower: templateRec.event_data.generic_description.toLowerCase()
          }, true);
        }
        else {
          updateReactData({
            eventIDFilter: false,
            idFilter: dragged_id,
            //         filterTextLower: `${personRec.name.last.toLowerCase()} ${personRec.name.first.toLowerCase()}`
          }, true);
        }
        break;
      }
      default: { }
    }
    dropTarget = {};
  };

  function resolve(request, ownerRec) {
    let response = deepCopy(request);
    do {
      let result = response.match(/(.*?)(%%)(.*?)(%%)(.*)/);
      if (!result) {
        break;
      }
      let [, front, , middle, , back] = result;
      if (middle) {
        switch (middle) {
          case 'last_name': {
            response = `${front}${ownerRec.name.last}${back}`;
            break;
          }
          case 'first_name': {
            response = `${front}${ownerRec.name.first}${back}`;
            break;
          }
          case 'location': {
            response = `${front}${ownerRec.location || ''}${back}`;
            break;
          }
          default: {
            response = `${front}${middle}${back}`;
          }
        }
      }
    } while (response.includes('%%'));
    return response;
  }

  function checkConflict(dragged_id, { droppedOn_event, eventIndex, dateIndex }) {
    let isAvailable = true;
    let conflictingEvent;
    let eventStart24 = droppedOn_event.time?.from ? makeTime(droppedOn_event.time.from.trim()).numeric24 : 0;
    let eventEnd24 = droppedOn_event.time?.to ? makeTime(droppedOn_event.time.to.trim()).numeric24 : 2359;
    if (!isEmpty(reactData.conflictInfo)
      && reactData.conflictInfo.hasOwnProperty(dragged_id)
      && reactData.conflictInfo[dragged_id].hasOwnProperty(droppedOn_event.occurrence_date)
    ) {
      reactData.conflictInfo[dragged_id][droppedOn_event.occurrence_date].some(this_time => {
        if (this_time.time <= eventStart24) {
          // event hasn't started - hold onto current availability and (if not available) the event that causes the potential conflict,
          isAvailable = this_time.open;
          conflictingEvent = !this_time.open ? this_time.event_title : null;
        }
        else if (this_time.time >= eventEnd24) {
          // the event started and ended before this possible conflict came up;  
          // your availability for the event will depend on what your availabilty was immediately BEFORE the event - which was stored in the earlier step(s)
          return true;   // break the loop and use the current value of isAvailable
        }
        else {
          // implied (this_time.time < eventEnd24)
          // this entry is changing your availability DURING the event;  
          // if this conflict marker marks you as unavailable OR you were unavailable from before the event, there is a conflict
          if (!this_time.open) {
            isAvailable = false;
            conflictingEvent = this_time.event_title;
          }
          if (!isAvailable) {
            return true;
          }
        }
        return false;     // return false to the .some function to keep it running
      });
    }
    return ({ isAvailable, conflictingEvent, dragged_id, calledWith: { droppedOn_event, eventIndex, dateIndex, eventStart24, eventEnd24 } });
  }

  async function eventSignup(dragged_id, { droppedOn_event, eventIndex, dateIndex }) {
    console.log(`dropped ${dragged_id} onto ${droppedOn_event.description}`);
    if (ownerOfSlots(droppedOn_event, dragged_id)) {
      updateReactData({
        alert: {
          severity: 'warning',
          title: 'Already included',
          message: `${dragged_id} is already included in ${droppedOn_event.description}`
        }
      }, true);
    }
    else {
      // does this person have a conflict with this event?
      // what is the start time of this event?
      let eventStart24 = droppedOn_event.time?.from ? makeTime(droppedOn_event.time.from.trim()).numeric24 : 0;
      let eventEnd24 = droppedOn_event.time?.to ? makeTime(droppedOn_event.time.to.trim()).numeric24 : 2359;
      if (!isEmpty(reactData.conflictInfo)
        && reactData.conflictInfo.hasOwnProperty(dragged_id)
        && reactData.conflictInfo[dragged_id].hasOwnProperty(droppedOn_event.occurrence_date)
      ) {
        let isAvailable = true;
        let conflictingEvent;
        reactData.conflictInfo[dragged_id][droppedOn_event.occurrence_date].some(this_time => {
          if (this_time.time <= eventStart24) {
            // event hasn't started - hold onto current availability and (if not available) the event that causes the potential conflict,
            isAvailable = this_time.open;
            conflictingEvent = !this_time.open ? this_time.event_title : null;
          }
          else if (this_time.time >= eventEnd24) {
            // the event started and ended before this possible conflict came up;  
            // your availability for the event will depend on what your availabilty was immediately BEFORE the event - which was stored in the earlier step(s)
            return true;   // break the loop and use the current value of isAvailable
          }
          else {
            // implied (this_time.time < eventEnd24)
            // this entry is changing your availability DURING the event;  
            // if this conflict marker marks you as unavailable OR you were unavailable from before the event, there is a conflict
            if (!this_time.open) {
              isAvailable = false;
              conflictingEvent = this_time.event_title;
            }
            if (!isAvailable) {
              return true;
            }
          }
          return false;     // return false to the .some function to keep it running
        });
        if (!isAvailable) {
          handleConflictOptions({
            conflictingEvent,
            dragged_id,
            eventObj: { droppedOn_event, eventIndex, dateIndex, eventStart24, eventEnd24 }
          });
          return;
        }
      }
      await proceedWithSignUp(dragged_id, { droppedOn_event, eventIndex, dateIndex, eventStart24, eventEnd24 });
    }
  }

  async function proceedWithSignUp(dragged_id, { droppedOn_event, eventIndex, dateIndex, eventStart24, eventEnd24 }) {
    let { slotAssigned, slotUpdates } = await handleAllocateSlot({
      person_id: dragged_id,
      this_event: droppedOn_event,
      eventIndex,
      dateIndex
    });
    if ((eventIndex > -1) && (dateIndex > -1)) {
      if (slotUpdates.newDescription) {
        reactData.myCalendar[dateIndex].eventList[eventIndex].description = slotUpdates.newDescription;
      }
      if (slotAssigned) {
        if (!reactData.myCalendar[dateIndex].eventList[eventIndex].hasOwnProperty('slot_owners')) {
          reactData.myCalendar[dateIndex].eventList[eventIndex].slot_owners = {};
        }
        reactData.myCalendar[dateIndex].eventList[eventIndex].slot_owners[dragged_id] = slotAssigned;
        if (!reactData.conflictInfo.hasOwnProperty(dragged_id)) {
          reactData.conflictInfo[dragged_id] = {};
        }
        let this_date = makeDate(droppedOn_event.occurrence_date);
        let this_Sunday = makeDate(addDays(this_date.date, -(this_date.dayOfWeek)));
        if (!reactData.conflictInfo[dragged_id].hasOwnProperty('summaries')) {
          reactData.conflictInfo[dragged_id].summaries = {
            [this_Sunday.numeric$]: {
              description: this_Sunday.dateOnly,
              minutes: 0
            }
          };
        }
        else if (!reactData.conflictInfo[dragged_id].summaries.hasOwnProperty(this_Sunday.numeric$)) {
          reactData.conflictInfo[dragged_id].summaries[this_Sunday.numeric$] = {
            description: this_Sunday.dateOnly,
            minutes: 0
          };
        }
        let start_time = makeTime(eventStart24);
        let end_time = makeTime(eventEnd24);
        let minutes_booked = 0;
        if (end_time.minutesSinceMidnight < start_time.minutesSinceMidnight) {
          minutes_booked = end_time.minutesSinceMidnight + (1440 - start_time.minutesSinceMidnight);
        }
        else {
          minutes_booked = end_time.minutesSinceMidnight - start_time.minutesSinceMidnight;
        }
        if (minutes_booked < 1200) {
          reactData.conflictInfo[dragged_id].summaries[this_Sunday.numeric$].minutes += minutes_booked;
        }
        if (!reactData.conflictInfo[dragged_id].hasOwnProperty(droppedOn_event.occurrence_date)) {
          reactData.conflictInfo[dragged_id][droppedOn_event.occurrence_date] = [];
        }
        reactData.conflictInfo[dragged_id][droppedOn_event.occurrence_date].push(
          {
            time: eventStart24,
            open: false,
            event_id: reactData.myCalendar[dateIndex].eventList[eventIndex].event_id,
            event_title: reactData.myCalendar[dateIndex].eventList[eventIndex].description
          },
          { time: eventEnd24, open: true }
        );
        reactData.conflictInfo[dragged_id][droppedOn_event.occurrence_date].sort((a, b) => {
          if (a.time === b.time) {
            return (!a.open ? 1 : -1);
          }
          else {
            return ((a.time < b.time) ? -1 : 1);
          }
        });
        updateReactData({
          myCalendar: reactData.myCalendar
        }, true);
      }
    }
    updateReactData({
      checkConflict: false,
      conflictProceed: false
    }, true);
    return;
  }

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
      "show_this_slot": true
    };
    if (this_event.hasOwnProperty('default_forms')) {
      writeRequest.default_forms = deepCopy(this_event.default_forms);
    }
    if (this_event.hasOwnProperty('customizations')) {
      writeRequest.customizations = deepCopy(this_event.customizations);
    }
    if (!reactData.defaultValues.message_override) {
      writeRequest.no_messaging = false;
    }
    else {
      let overrideList = makeArray(reactData.defaultValues.message_override);
      if (overrideList.some(oItem => {
        return oItem.toLowerCase().startsWith('*none');
      })) {
        writeRequest.no_messaging = true;
      }
      else if (overrideList.some(oItem => {
        return oItem.toLowerCase().startsWith('*published');
      })) {
        if (!this_event.published) {
          writeRequest.no_messaging = true;
        }
        else {
          // event is already published and this instruction asks to message people only when published...
          writeRequest.no_messaging = false;
          writeRequest.overrideRecipient = [];
          for (const this_person of overrideList) {
            let instruction = this_person.split('=');
            if (instruction[0].startsWith('*published')) {
              instruction[0] = instruction[1];
            }
            if (instruction) {
              if (instruction[0].startsWith('slot')) {
                writeRequest.overrideRecipient.push(person_id);
              }
              else if (instruction[0].startsWith('event')) {
                writeRequest.overrideRecipient.push(...makeArray(this_event.owner));
              }
              else {
                writeRequest.overrideRecipient.push(instruction[0]);
              }
            }
          }
          if (writeRequest.overrideRecipient.length === 0) {
            writeRequest.overrideRecipient.push(person_id);
          }
          writeRequest.override_subject = `Changes have been made to ${this_event.description} (${makeDate(this_event.occurrence_date, { noTime: true }).absolute}) that affect you`;
          writeRequest.override_messageText = `${await makeName(person_id)} has been added to this event.`;
        }
      }
      else {
        writeRequest.no_messaging = false;
        writeRequest.overrideRecipient = overrideList;
      }
    }
    let slotUpdates = await writeSlot(writeRequest);
    localStorage.setItem(`calendarChanged`, true);
    console.log(`Added ${person_id} to ${this_event.description}${(slotToUse === person_id) ? '' : ' - ' + slotToUse}`);
    return { slotAssigned: slotToUse, slotUpdates };
  };

  const setTextColor = (this_event, this_date, agendaView) => {
    if (!agendaView && reactData.idFilter && isUnAvailable(this_date, reactData.idFilter)) {
      return { color: contrastColor(hexColors[reactData.colorScheme.unavailable]) };
    }
    else if (!this_event) {
      return { color: reactData.calendar_fill_text };
    }
    else if (this_event.customizations && this_event.customizations.show_as_unavailable && reactData.colorScheme.unavailable) {
      return { color: reactData.colorScheme.empty };
    }
    else if (ownerOfSlots(this_event) && !reactData.defaultValues.onlyRegistered && reactData.colorScheme.owned) { return { color: reactData.colorScheme.owned }; }
    else if (allSlotsFull(this_event) && reactData.colorScheme.full) { return { color: reactData.colorScheme.full }; }
    else if (allSlotsEmpty(this_event) && reactData.colorScheme.empty) { return { color: reactData.colorScheme.empty }; }
    else {
      let numberToCheck, keyColor;
      Object.keys(reactData.colorScheme).forEach(scheme => {
        if (scheme.startsWith('lessThan')) {
          numberToCheck = scheme.split('_')[1].trim();
          keyColor = reactData.colorScheme[scheme];
        }
      });
      if (numberToCheck
        && !isNaN(Number(numberToCheck))
        && (Object.keys(this_event.slot_owners).length < Number(numberToCheck))
      ) {
        return { color: keyColor };
      }
      numberToCheck = null;
      Object.keys(reactData.colorScheme).forEach(scheme => {
        if (scheme.startsWith('atLeast')) {
          numberToCheck = scheme.split('_')[1].trim();
          keyColor = reactData.colorScheme[scheme];
        }
      });
      if (numberToCheck
        && !isNaN(Number(numberToCheck))
        && (Object.keys(this_event.slot_owners).length >= Number(numberToCheck))
      ) {
        return { color: keyColor };
      }
      if (isWaitListed(this_event) && reactData.colorScheme.waitlisted) { return { color: reactData.colorScheme.waitlisted }; }
      else if (waitListExists(this_event) && reactData.colorScheme.waitlist) {
        return { color: reactData.colorScheme.waitlist };
      }
    }
    return {
      color: reactData.calendar_fill_text
    };
  };

  const setAvailabilityColor = (minutes) => {
    if (minutes <= 0) { return 'red'; }
    else if (minutes >= 540) { return 'green'; }
    let g = Math.min((minutes / 270), 1);
    let r = (minutes <= 270) ? 1 : ((540 - minutes) / 270);
    return make_rgba(r, g, 0, 0.5);
  };

  function setBackgroundColor(this_date) {
    let this_background = reactData.calendar_fill;
    if (this_date.date_words === 'Today') {
      this_background = (isDarkMode ? 'darkgoldenrod' : 'white');
    }
    else if (this_date.dateObj.weekday === 'weekend') {
      this_background = (isDarkMode ? 'darkgoldenrod' : 'lightyellow');
    }
    if (reactData.idFilter) {
      if (isUnAvailable(this_date, reactData.idFilter)) {
        this_background = reactData.colorScheme.unavailable;
      }
    }
    return this_background;
  }

  function makeCalendarTime(i) {
    if (isObject(i)) {
      return `${i.from || ''}${(i.from && i.to && (i.from.trim() !== '') && (i.to.trim() !== '')) ? ' to ' : ''}${i.to || ''}`;
    }
    else { return i; }
  }

  // compact "1-3pm" / "11am-1pm" / "1:30-3pm" style range, falling back to makeCalendarTime when from/to can't both be parsed
  function makeSmartCalendarTime(i) {
    if (!isObject(i) || !i.from || !i.to) { return makeCalendarTime(i); }
    const fromT = makeTime(i.from);
    const toT = makeTime(i.to);
    if (fromT.error || toT.error) { return makeCalendarTime(i); }
    const bothOnHour = (fromT.mm === 0) && (toT.mm === 0);
    const fromStr = bothOnHour ? `${fromT.hh}` : `${fromT.hh}:${fromT.mm.toString().padStart(2, '0')}`;
    const toStr = bothOnHour ? `${toT.hh}` : `${toT.hh}:${toT.mm.toString().padStart(2, '0')}`;
    // only show am/pm on the first time too when the range spans noon (crosses am/pm)
    return (fromT.ampm === toT.ampm)
      ? `${fromStr}-${toStr}${toT.ampm}`
      : `${fromStr}${fromT.ampm}-${toStr}${toT.ampm}`;
  }

  // trims long event descriptions to a fixed word count so they never overflow the grid cell
  function truncateDescription(text, maxWords = 3) {
    if (!text) { return text; }
    const words = text.trim().split(/\s+/);
    return (words.length <= maxWords) ? text : `${words.slice(0, maxWords).join(' ')}…`;
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

  // shared event row, used both inline in a grid cell (limited count, truncated) and in the "day details" dialog (full list, expanded=true lets it wrap)
  const renderEventBox = (this_event, eventIndex, this_date, dateIndex, expanded = false) => (
    <Box
      zIndex={2000}
      onDragOver={(e) =>
        handleDragOver(e, {
          type: 'event',
          data: { droppedOn_event: this_event, eventIndex, dateIndex }
        })
      }
      onDrop={async (e) => {
        await handleDrop(e, 'event');
      }}
      display='flex' flexDirection='column'
      py={1}
      px={1}
      mt={0.5}
      mb={0.5}
      variant='outlined'
      textAlign={agendaView() ? 'flex-start' : 'center'}
      style={{ minWidth: 0, width: '100%', overflow: 'hidden', flexShrink: 0 }}
      key={`details${this_date.dateObj.numeric$}_${eventIndex}`}
      onClick={async () => {
        switch (this_event.type) {
          case 'holiday': {
            break;
          }
          case 'birthday': {
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
              { signup_window: eventInfo.eventData.sign_up.window || { start: null, end: null } },
              occInfo,
              { date: occInfo.occurrence_date },
              { time$: this_event.time$ },
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
        color={setTextColor(this_event, this_date, agendaView()).color}
        style={{ minWidth: 0, width: '100%' }}
      >
        <Box display='flex' flexDirection='column'
          justifyContent={agendaView() ? 'flex-start' : 'center'}
          ml={agendaView() ? 0 : 1}
          mr={1}
          alignItems={agendaView() ? 'flex-start' : 'center'}
          color={setTextColor(this_event, this_date, agendaView()).color}
          style={{ minWidth: 0, maxWidth: '100%' }}
        >
          <Typography noWrap={!expanded}
            style={AVATextStyle({
              size: 1,
              bold: true,
            })}>
            {(agendaView() || expanded) ? titleCase(this_event.description) : truncateDescription(titleCase(this_event.description))}
          </Typography>
          {this_event.location && this_event.location.description
            && (!reactData.locationFilter || (reactData.locationFilter === '*all')) &&
            <Typography
              noWrap={true}
              style={AVATextStyle({ size: 0.8 })}
            >
              {this_event.location.description}
            </Typography>
          }
          {isWaitListed(this_event) &&
            <Typography
              noWrap={true}
              style={AVATextStyle({ size: 1.2, italic: true })}
            >
              {`You're on the Waitlist`}
            </Typography>
          }
          {this_event.slot_owners.hasOwnProperty(reactData.selectedPerson_id)
            ?
            <React.Fragment>
              {!reactData.defaultValues.onlyRegistered
                && (this_date.dateObj.numeric >= reactData.todayYMD)
                && (![this_event.owner].flat().includes(reactData.selectedPerson_id))
                &&
                <Typography
                  noWrap={true}
                  style={AVATextStyle({ size: 1.2, italic: true })}
                >
                  {`You're on the list`}
                </Typography>
              }
              <Typography
                noWrap={true}
                style={AVATextStyle({
                  size: 0.8,
                })}
              >
                {((this_event.type === 'time')
                  ? (makeTime(this_event.slot_owners[reactData.selectedPerson_id]).time)
                  : (makeSmartCalendarTime(this_event.time)))
                }
              </Typography>
            </React.Fragment>
            :
            <React.Fragment>
              {this_event.time
                &&
                <Typography
                  noWrap={true}
                  style={AVATextStyle({
                    size: 0.8,
                  })}
                >
                  {makeSmartCalendarTime(this_event.time)}
                </Typography>
              }
            </React.Fragment>
          }
        </Box>
      </Box>
      {showSlots() && this_event.slot_owners
        && (Object.keys(this_event.slot_owners).length > 0)
        && (Object.keys(this_event.slot_owners).sort((a, b) => {
          return ((this_event.slot_owners[a] > this_event.slot_owners[b]) ? 1 : -1);
        })).map(this_owner => (
          <Typography
            key={`event_${this_event}_slot_owner_${this_owner}`}
            noWrap={true}
            style={AVATextStyle({
              size: 0.8,
            })}>
            {`${(this_event.type === 'time') ? makeTime(this_event.slot_owners[this_owner]).short + ' ' : ''}${this_event.slot_holder_names?.[this_owner] || getPersonName(this_owner.split('%%')[0])}`}
          </Typography>
        ))}
    </Box>
  );

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
            style={{ paddingLeft: '8px', paddingRight: '8px', paddingTop: '16px', paddingBottom: '16px' }}
            alignItems={'center'}
            key={'topBox'}
          >
            <Box
              display='flex' flexDirection='row'
              className={classes.client_backgroundCenter}
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
                  alignItems='center'
                  className={classes.client_backgroundCenter}
                  key={'nameBox'}
                >
                  <Box
                    display='flex' flexDirection='column'
                    key={'nameRows'}
                  >
                    <Typography
                      className={classes.title}
                      style={AVATextStyle({ size: 1.2, bold: true, margin: { left: 0.5, right: 1 } })}
                    >
                      {(reactData.defaultValues.assignmentView
                        ? `Calendar Management`
                        : `${reactData.display_name}${reactData.display_name.slice(-1) === 's' ? "'" : "'s"} Calendar`
                      ) + (reactData.filterTextLower ? ` - events containing "${reactData.filterTextLower}"` : '')}
                    </Typography>
                    {reactData.defaultValues.subtitle &&
                      <Typography
                        className={classes.title}
                        style={AVATextStyle({ size: 1.4, margin: { top: 0, left: 0.5, right: 1 } })}
                      >
                        {reactData.defaultValues.subtitle}
                      </Typography>
                    }
                  </Box>
                  {reactData.filterTextLower &&
                    <IconButton
                      aria-label='Clear search'
                      size='small'
                      onClick={() => clearSearch()}
                    >
                      <ClearIcon fontSize='small' />
                    </IconButton>
                  }
                </Box>
                {(getLocationOptions().length > 1) &&
                  <Box style={{ position: 'relative', zIndex: 2100, width: '40vw', marginTop: 4, marginBottom: 4 }}>
                    <Select
                      options={getLocationOptions()}
                      values={getLocationOptions().filter(this_option => (this_option.value === reactData.locationFilter))}
                      labelField={'label'}
                      valueField={'value'}
                      searchBy={'label'}
                      dropdownHandle={true}
                      searchable={true}
                      clearOnSelect={false}
                      closeOnSelect={true}
                      key={`selectLocationFilter`}
                      style={{
                        lineHeight: 1,
                        fontSize: '0.85rem',
                        width: '100%',
                        marginLeft: '4px',
                        border: '1px solid rgba(0, 0, 0, 0.3)',
                        borderRadius: '4px',
                        padding: '2px 6px',
                        color: 'black',
                        backgroundColor: ((reactData.locationFilter && (reactData.locationFilter !== '*all')) ? '#fff3cd' : 'white')
                      }}
                      onChange={(values) => {
                        updateReactData({ locationFilter: (values.length > 0 ? values[0].value : '*all') }, true);
                      }}
                    />
                  </Box>
                }
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
              </Box>
              <IconButton
                aria-label='Search calendar'
                onClick={() => {
                  updateReactData({
                    setSearch: true
                  }, true);
                }}
                onDragOver={(e) =>
                  handleDragOver(e, {
                    type: 'filter_button'
                  })
                }
                onDrop={async (e) => {
                  await handleDrop(e, 'filter_button');
                }}
                style={{
                  color: (reactData.filterTextLower || reactData.idFilter || reactData.eventIDFilter) ? '#b8860b' : undefined
                }}
              >
                <SearchIcon fontSize='large' />
              </IconButton>
              <Avatar className={AVAClass.AVAAvatar} src={state.session?.client_logo || process.env.REACT_APP_AVA_LOGO} alt={reactData.client_id}
                onClick={(event) => {
                  handleClick(event);
                  updateReactData({
                    popUpOpen: true
                  }, true);
                }}
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
                  {!reactData.defaultValues.assignmentView &&
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
                  }
                  {!isMobileWidth() &&
                    <MenuItem
                      onClick={() => {
                        reactData.defaultValues.agendaView = !agendaView();
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
                  }
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
                      updateReactData({
                        setDates: true,
                        popUpOpen: false
                      }, true);
                    }}
                  >
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowHome'}
                    >
                      {<DateRangeIcon />}
                      <Typography className={classes.popUpMenuRow} >
                        {'Modify dates'}
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    onClick={async () => {
                      await printCalendar(
                        {
                          client_id: state.session.client_id,
                          myCalendar: reactData.myCalendar,
                          requestor: state.session.user_id,
                          filterTextLower: reactData.filterTextLower,
                          groupFilter: state.groups.belongsTo,
                          onlyRegistered: reactData.defaultValues.onlyRegistered ? reactData.selectedPerson_id : null
                        }
                      );
                      updateReactData({
                        popUpOpen: false
                      }, true);
                    }}
                  >
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowHome'}
                    >
                      {<PrintIcon />}
                      <Typography className={classes.popUpMenuRow} >
                        {'Print'}
                      </Typography>
                    </Box>
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      updateReactData({
                        setPublishDates: true,
                        popUpOpen: false
                      }, true);
                    }}
                  >
                    <Box
                      display='flex' flexDirection='row' alignItems={'center'}
                      key={'vRowHome'}
                    >
                      {<AssignmentTurnedInIcon />}
                      <Typography className={classes.popUpMenuRow} >
                        {'Publish'}
                      </Typography>
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
              <React.Fragment>
                {reactData.defaultValues.template__List && !reactData.defaultValues.no_dragTemplate &&
                  <Box
                    key={`template_outer`}
                    className={classes.peopleBox}
                  >
                    {reactData.defaultValues.template__List.map((this_template, tX) => (
                      <Box
                        key={`template-${tX}_inner`}
                        mx={1}
                        display='flex'
                        justifyContent='center'
                        alignItems='center'
                        flexDirection='column'
                        draggable={true}
                        onDragStart={(e) =>
                          handleDragStart(e, `template: ${tX}%%${this_template.event_data.event_id}`)
                        }
                      >
                        <Avatar
                          className={classes.assignment_avatar}
                          src={this_template.event_data.image}
                          variant={'square'}
                        >
                          <EventIcon />
                        </Avatar>
                        {(this_template.event_data.generic_description || this_template.event_data.description).split(' ').map((this_word, wX) => (
                          <Typography
                            noWrap={true}
                            key={`name_word_${wX}`}
                            className={classes.dragNamesLast}
                          >
                            {this_word}
                          </Typography>
                        ))
                        }
                      </Box>
                    ))}
                  </Box>
                }
                {reactData.defaultValues.assignment__List.map((this_list, lX) => (
                  <Box
                    key={`candidate-${lX}`}
                    className={((lX === 0) && !reactData.defaultValues.template__List) ? classes.peopleBox : classes.peopleBoxWithSpace} >
                    {this_list.assignmentList.map((this_candidate, cX) => (
                      <Box
                        key={`candidate-${lX}-${cX}`}
                        mx={1}
                        display='flex'
                        justifyContent='center'
                        alignItems='center'
                        flexDirection='column'
                      >
                        <Tooltip
                          classes={{ tooltip: classes.tooltipBody, arrow: classes.arrowBody }}
                          draggable={true}
                          arrow
                          enterDelay={500}
                          onDragStart={(e) => handleDragStart(e, this_candidate.person_id)}
                          title={
                            <Box
                              key={`conflict-${cX}`} mx={1} mb={1}
                              display='flex' justifyContent='center' alignItems='center'
                              flexDirection='column'
                            >
                              <Typography
                                noWrap={true}
                                key={`conflict-${cX}_conflictName`}
                                style={AVATextStyle({ bold: true, size: 1, margin: { top: 0.2 } })}
                              >
                                {this_candidate.display_name}
                              </Typography>
                              {reactData.conflictInfo[this_candidate.person_id]
                                ?
                                Object.keys(reactData.conflictInfo[this_candidate.person_id].summaries).map((conflict_date, cDateX) => (
                                  <Box
                                    key={`conflict-${cX}_${cDateX}`}
                                    display='flex' justifyContent='center'
                                    alignItems='center' flexDirection='column'
                                    textOverflow={'ellipsis'}
                                  >
                                    {(reactData.conflictInfo[this_candidate.person_id].summaries[conflict_date].minutes > 0)
                                      ?
                                      <Typography
                                        noWrap={true}
                                        style={AVATextStyle({ italic: true, size: 0.8 })}>
                                        {`Hrs wk of ${ordinal(conflict_date % 100)}: ${(Math.round((reactData.conflictInfo[this_candidate.person_id].summaries[conflict_date].minutes / 60) * 10) / 10).toFixed(1)}`}
                                      </Typography>
                                      :
                                      <Typography
                                        noWrap={true}
                                        style={AVATextStyle({ italic: true, size: 0.8 })}>
                                        {`Nothing scheduled wk of ${ordinal(conflict_date % 100)}`}
                                      </Typography>
                                    }
                                  </Box>
                                ))
                                :
                                <Box key={`conflict-${cX}_noconflict`} display='flex' justifyContent='center' alignItems='center' flexDirection='column'>
                                  <Typography
                                    style={AVATextStyle({ italic: true, size: 0.8, margin: { top: 0.2 } })}>
                                    {'Nothing Scheduled'}
                                  </Typography>
                                </Box>
                              }
                              {reactData.conflictInfo[this_candidate.person_id] && reactData.clicked_on_date &&
                                reactData.conflictInfo[this_candidate.person_id][reactData.clicked_on_date.numeric$] &&
                                reactData.conflictInfo[this_candidate.person_id][reactData.clicked_on_date.numeric$].map((this_conflict, cN) => (
                                  !this_conflict.open &&
                                  <Box
                                    key={`conflict-${cX}_${cN}`}
                                    display='flex' justifyContent='center'
                                    alignItems='center' flexDirection='row'
                                    textOverflow={'ellipsis'}
                                  >
                                    <Typography
                                      noWrap={true}
                                      style={AVATextStyle({ italic: true, size: 0.8 })}>
                                      {`${Math.floor((this_conflict.time - (this_conflict.time >= 1300 ? 1200 : 0)) / 100)}:${('0' + (this_conflict.time % 100).toString()).slice(-2)} ${this_conflict.event_title}`}
                                    </Typography>
                                  </Box>
                                ))
                              }
                            </Box>
                          }
                          placement='top-end'
                        >
                          <Box
                            key={`avatar_box-${lX}_${cX}`}
                            border={reactData.clicked_on_date ? 2 : 0}
                            display='flex'
                            flexDirection='column'
                            justifyContent={'center'}
                            alignItems={'center'}
                            style={{
                              marginTop: 0,
                              marginBottom: 0,
                              height: 55,
                              width: 55,
                              border: 0,
                              boxShadow: (reactData.idFilter === this_candidate.person_id) ? '0 0 8px 12px #0ff' : null,
                              borderRadius: '30px 30px 30px 30px',
                              backgroundColor: reactData.clicked_on_date
                                ? setAvailabilityColor(reactData.conflictInfo?.[this_candidate.person_id]?.availability?.[reactData.clicked_on_date.numeric$] || 540)
                                : null
                            }}
                          >
                            <Avatar className={classes.assignment_avatar} src={getImage(this_candidate, { allowS3Fallback: false, allowS3Backfill: false })} >
                              {`${this_candidate.first_name.slice(0, 1)}${this_candidate.last_name.slice(0, 1)}`}
                            </Avatar>
                          </Box>
                        </Tooltip>
                        {(reactData.defaultValues.assignmentDisplayBy
                          && reactData.defaultValues.assignmentDisplayBy.toLowerCase().includes('last'))
                          ?
                          <React.Fragment>
                            <Typography
                              noWrap={true}
                              className={classes.dragNamesLast}
                            >
                              {this_candidate.last_name}
                            </Typography>
                            <Typography
                              noWrap={true}
                              className={classes.dragNamesFirst}
                            >
                              {this_candidate.first_name}
                            </Typography>
                          </React.Fragment>
                          :
                          <React.Fragment>
                            <Typography
                              noWrap={true}
                              className={classes.dragNamesFirst}
                            >
                              {this_candidate.first_name}
                            </Typography>
                            <Typography
                              noWrap={true}
                              className={classes.dragNamesLast}
                            >
                              {this_candidate.last_name}
                            </Typography>
                          </React.Fragment>
                        }
                      </Box>
                    ))}
                  </Box>
                ))}
              </React.Fragment>
            }

          </Box>
          {!reactData.loading &&
            <DialogContent
              dividers={true}
              classes={{ dividers: classes.client_background }}
              style={{ paddingLeft: '0px', paddingRight: '0px' }}
            >
              <Box display='flex'
                flexDirection='row'
                key={`screen_box`}
                className={classes.dialogBox}
              >
                <Box
                  display={agendaView() ? 'flex' : 'grid'}
                  alignItems={agendaView() ? 'flex-start' : 'stretch'}
                  flexDirection={agendaView() ? 'column' : undefined}
                  key={`whole_calendar_${agendaView() ? 'A' : 'C'}`}
                  style={{
                    paddingLeft: '16px',
                    paddingRight: agendaView() ? 0 : '16px',
                    minHeight: `${Math.min(reactData.visible_y - 400, 350)}px`,
                    width: '100%',
                    boxSizing: 'border-box',
                    ...(agendaView() ? {} : { gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' })
                  }}
                  id='dialog-content'
                >
                  {!agendaView() && ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((this_weekday, wX) => (
                    <Box key={`weekday_header_${wX}`} display='flex' justifyContent='center' py={0.5}>
                      <Typography style={AVATextStyle({ size: 1, bold: true, color: reactData.calendar_fill_text })}>
                        {this_weekday}
                      </Typography>
                    </Box>
                  ))}
                  {!agendaView() && (reactData.myCalendar[0] && !reactData.myCalendar[0].dateObj.error
                    ? Array.from({ length: reactData.myCalendar[0].dateObj.dayOfWeek })
                    : []
                  ).map((_, bX) => (
                    <Box key={`leading_blank_${bX}`} />
                  ))}
                  {reactData.myCalendar && (reactData.myCalendar.length > 0) &&
                    reactData.myCalendar.map((this_date, dateIndex) => {        // an array of dates
                      if (this_date.dateObj.error) { return null; }
                      if (agendaView() && !eventsToShow(this_date) && (dateIndex !== 0)) { return null; }
                      const visibleEntries = this_date.eventList
                        .map((this_event, eventIndex) => ({ this_event, eventIndex }))
                        .filter(entry => okToShow(entry.this_event));
                      // grid view: start by assuming everything fits; the shrink-to-fit effect trims this down when it doesn't
                      const maxShow = agendaView()
                        ? visibleEntries.length
                        : Math.max(0, Math.min(visibleEntries.length, cellFitCounts[dateIndex] ?? visibleEntries.length));
                      const shownEntries = visibleEntries.slice(0, maxShow);
                      const overflowCount = visibleEntries.length - shownEntries.length;
                      if (!agendaView()) { cellShownCountsRef.current[dateIndex] = maxShow; }
                      return (
                        <Box
                          display='flex'
                          key={`dateBox_cell-${dateIndex}_${agendaView() ? 'A' : 'C'}`}
                          ref={(this_date.dateObj.numeric$ === reactData.selectDate)
                            ? selectedDate
                            : null
                          }
                          border={agendaView() ? 0 : 2}
                          style={agendaView() ? {} : {
                            aspectRatio: '1 / 1',
                            borderRadius: '16px 16px 16px 16px',
                            borderColor: reactData.calendar_fill_text,
                            backgroundColor: setBackgroundColor(this_date),
                            opacity: (this_date.dateObj.numeric < reactData.todayYMD ? 0.6 : 1),
                            overflow: 'hidden'
                          }}
                          ml={agendaView() ? 1 : 0} mr={agendaView() ? 1 : 0} mt={1}
                          justifyContent='flex-start'
                          alignItems={agendaView() ? 'flex-start' : 'stretch'}
                          flexDirection='column'
                          zIndex={1900}
                        >
                          { /* Date in calendar cell */}
                          <Box
                            display='flex'
                            width='-webkit-fill-available'
                            mb={0.5}
                            mx={agendaView() ? 2 : 1} pt={1}
                            px={agendaView() ? 0 : 1}
                            borderBottom={2}
                            mt={1}
                            justifyContent='center'
                            style={{
                              borderColor: setTextColor(null, this_date, agendaView()).color,
                              cursor: agendaView() ? 'default' : 'pointer'
                            }}
                            onClick={() => {
                              let clicked_on_date = false;
                              if (!reactData.clicked_on_date || (reactData.clicked_on_date.numeric$ !== this_date.dateObj.numeric$)) {
                                clicked_on_date = this_date.dateObj;
                              }
                              let reactUpdObj = { clicked_on_date };
                              if (!agendaView()) { reactUpdObj.dayDetailsIndex = dateIndex; }
                              updateReactData(reactUpdObj, true);
                            }}
                            onDragOver={(e) =>
                              handleDragOver(e, {
                                type: 'calendar_cell',
                                data: {
                                  this_date,
                                  dateIndex
                                }
                              })
                            }
                            onDrop={async (e) => {
                              await handleDrop(e, 'calendar_cell');
                            }}
                          >
                            {agendaView() &&
                              <Typography
                                style={AVATextStyle({
                                  size: 1.2,
                                  margin: { left: 0.2, right: 0.2 },
                                  color: setTextColor(null, this_date, agendaView()).color,
                                })}
                                key={this_date.dateObj.numeric$ + 'head1' + dateIndex}
                              >
                                {this_date.dateObj.dayOfWeek_word}
                              </Typography>
                            }
                            {((dateIndex === 0) || (this_date.dateObj.date.getDate() === 1)) &&
                              <Typography
                                style={AVATextStyle({
                                  size: 1.2,
                                  margin: { left: 0.2, right: 0.2 },
                                  color: setTextColor(null, this_date, agendaView()).color,
                                })}
                                key={this_date.dateObj.numeric$ + 'month2' + dateIndex}
                              >
                                {this_date.dateObj.date.toLocaleString([], { month: 'short' })}
                              </Typography>
                            }
                            <Typography
                              style={AVATextStyle({
                                size: 1.2,
                                color: setTextColor(null, this_date, agendaView()).color,
                                margin: { left: 0.2, right: 0.2 }
                              })}
                              key={this_date.dateObj.numeric$ + 'head2' + dateIndex}
                            >
                              {ordinal(this_date.dateObj.date.getDate())}
                            </Typography>
                          </Box>

                          { /* Calendar cell contents */}
                          <Box
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              padding: agendaView() ? '16px' : '2px 8px',
                              justifyContent: 'flex-start',
                              overflow: 'hidden',
                              flexGrow: 1,
                              minHeight: 0
                            }}
                            alignItems={agendaView() ? 'flex-start' : 'center'}
                            textAlign={agendaView() ? 'flex-start' : 'center'}
                            key={`details${this_date.dateObj.numeric$}_eventBox`}
                          >
                            {/* this is the box that actually gets squeezed by flex - measure IT for overflow, not its parent */}
                            <Box
                              ref={(el) => {
                                if (agendaView()) { return; }
                                if (el) { cellContentRefs.current[dateIndex] = el; }
                                else { delete cellContentRefs.current[dateIndex]; }
                              }}
                              style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, flex: '1 1 auto', width: '100%' }}
                            >

                              {/* only genuinely empty dates get this message - a cell trimmed down to 0 shown (but with entries waiting behind "+n more") should not */}
                              {visibleEntries.length === 0
                                ?
                                <Typography style={AVATextStyle({
                                  color: reactData.calendar_fill_text,
                                  size: 1,
                                  textWrap: 'wrap',
                                  padding: { left: 0.5 }
                                })}>
                                  {(this_date.eventList.length === 0)
                                    ? `No Events Scheduled`
                                    : (onlyLocationFilterActive()
                                      ? `No Events in ${(reactData.locationFilter === '*none*') ? '(No Location)' : reactData.locationFilter}`
                                      : `No Events Match your Filter`)}
                                </Typography>
                                :
                                shownEntries.map(({ this_event, eventIndex }) => (
                                  renderEventBox(this_event, eventIndex, this_date, dateIndex)
                                ))
                              }
                            </Box>
                            {overflowCount > 0 &&
                              <Typography
                                onClick={() => updateReactData({ dayDetailsIndex: dateIndex }, true)}
                                style={{ ...AVATextStyle({ size: 0.8, italic: true }), cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}
                              >
                                {`+${overflowCount} more`}
                              </Typography>
                            }
                          </Box>
                        </Box>
                      );
                    })
                  }
                </Box>
              </Box>
            </DialogContent>
          }
          {!reactData.loading && (reactData.dayDetailsIndex !== null) && (reactData.dayDetailsIndex !== undefined) &&
            reactData.myCalendar[reactData.dayDetailsIndex] &&
            <Dialog
              open={true}
              onClose={() => updateReactData({ dayDetailsIndex: null }, true)}
              PaperProps={{ style: { borderRadius: '30px', minWidth: '30vw', maxHeight: '80vh' } }}
            >
              <DialogTitle>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  <Typography style={AVATextStyle({ size: 1.2, bold: true })}>
                    {`${reactData.myCalendar[reactData.dayDetailsIndex].dateObj.dayOfWeek_word}, ${reactData.myCalendar[reactData.dayDetailsIndex].dateObj.date.toLocaleString([], { month: 'long' })} ${ordinal(reactData.myCalendar[reactData.dayDetailsIndex].dateObj.date.getDate())}`}
                  </Typography>
                </Box>
              </DialogTitle>
              <DialogContent dividers={true}>
                {reactData.myCalendar[reactData.dayDetailsIndex].eventList
                  .map((this_event, eventIndex) => ({ this_event, eventIndex }))
                  .filter(entry => okToShow(entry.this_event))
                  .map(({ this_event, eventIndex }) => (
                    renderEventBox(this_event, eventIndex, reactData.myCalendar[reactData.dayDetailsIndex], reactData.dayDetailsIndex, true)
                  ))
                }
              </DialogContent>
              <DialogActions style={{ justifyContent: 'center' }}>
                <Button
                  className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'red', color: 'white' }}
                  size='small'
            
                  onClick={() => updateReactData({ dayDetailsIndex: null }, true)}
                >
                  {'Close'}
                </Button>
              </DialogActions>
            </Dialog>
          }
          {!reactData.loading && reactData.setSearch &&
            <AVATextInput
              titleText={'Search Calendar'}
              promptText={['Words to search for']}
              buttonText={['Search', 'Cancel/Go Back', 'Clear Search',]}
              valueText={[reactData.filterTextLower]}
              options={{
                save_on_enter: true
              }}
              onCancel={() => {
                updateReactData({
                  setSearch: false
                }, true);
              }}
              onSave={async (response, buttonPressed) => {
                if ((response.length === 0) || (response[0].length === 0) || (buttonPressed === 2)) {
                  clearSearch({ setSearch: false });
                }
                else {
                  let reactUpdObj = {
                    setSearch: false,
                    filterTextLower: response[0].toLowerCase()
                  };
                  // a word search reads best in the linear Agenda layout, so force it on
                  if (!agendaView()) {
                    reactData.defaultValues.agendaView = true;
                    reactUpdObj.defaultValues = reactData.defaultValues;
                    reactUpdObj.searchForcedAgenda = true;
                  }
                  updateReactData(reactUpdObj, true);
                }
              }}
            />
          }
          {!reactData.loading && reactData.setDates &&
            <AVATextInput
              titleText={'Set Calendar Dates'}
              promptText={['Start date', 'End date']}
              buttonText={'Set Dates'}
              onCancel={() => {
                updateReactData({
                  setDates: false
                }, true);
              }}
              onSave={async (response) => {
                updateReactData({
                  setDates: false
                }, false);
                if (response.length > 1) {
                  let newStart = makeDate(response[0]);
                  if (newStart.error) { }
                  else if (defaultValues.weekView) {
                    let revisedStart = addDays(newStart.date, -(newStart.dayOfWeek));
                    newStart = makeDate(revisedStart);
                  }
                  onClose({
                    action: 'reset',
                    newStartDate: newStart.date,
                    newEndDate: makeDate(response[1]).date
                  });
                }
              }}
            />
          }
          {!reactData.loading && reactData.getAppointmentType &&
            <AVATextInput
              titleText={'What Type of Appointment?'}
              promptText={['[select]Type', 'Start time', 'End time']}
              buttonText={'Proceed'}
              selectionList={[reactData.defaultValues.template__List.map(this_selection => {
                this_selection.value = this_selection.event_data.event_id;
                this_selection.label = this_selection.event_data.description;
                return this_selection;
              }).concat([{ value: '%%no_template%%', label: 'No Appointment Type' }]), null, null]}
              onCancel={() => {
                updateReactData({
                  getAppointmentType: false
                }, true);
              }}
              onSave={async (response) => {
                if ((response[0] === '%%no_template%%') || (!response[0])) {
                  updateReactData({
                    addPersonalEvent: true,
                    getAppointmentType: false,
                    isAppointment: true,
                    appointmentStart: response[1],
                    appointmentEnd: response[2]
                  }, true);
                }
                else {
                  updateReactData({
                    getAppointmentType: false,
                    addTemplateEvent: true,
                    selectedTemplate: getTemplate(`template%%${response[0]}`),
                    isAppointment: true,
                    appointmentStart: response[1],
                    appointmentEnd: response[2]
                  }, true);
                }
              }}
            />
          }
          {!reactData.loading && reactData.setPublishDates &&
            <AVATextInput
              titleText={'Publish What Dates'}
              promptText={['Start date', 'End date']}
              buttonText={'Set Dates'}
              onCancel={() => {
                updateReactData({
                  setPublishDates: false
                }, true);
              }}
              onSave={async (response) => {
                if (response.length > 1) {
                  await executePublish(response);
                }
                updateReactData({
                  myCalendar: reactData.myCalendar,
                  setPublishDates: false
                }, true);
              }}
            />
          }

          {!reactData.loading && reactData.event_being_edited &&
            <CalendarEventEditForm
              pEventCode={reactData.event_being_edited.event_key}
              pEvent={reactData.event_being_edited}
              peopleList={peopleList}
              pPatient={reactData.selectedPerson_id}
              pClient={reactData.event_being_edited.client}
              pViewOnly={
                defaultValues.hasOwnProperty('viewOnly')
                  ? defaultValues.viewOnly
                  : (reactData.event_being_edited.owner_only || false)
              }
              pSignUps={calendarPeople}
              pOccData={reactData.event_being_edited.occData}
              defaultValues={reactData.defaultValues}
              onReset={(updatedData) => {
                let updateObj = {
                  event_being_edited: false
                };
                if (updatedData.event_cancelled) {
                  onClose({
                    action: 'reset',
                  });
                }
                else if (!updatedData.no_change) {
                  let calRef = reactData.myCalendar[reactData.event_being_edited.date_index].eventList[reactData.event_being_edited.event_index];
                  calRef.description = updatedData.description;
                  calRef.slot_owners = updatedData.summaryInfo.slot_owners;
                  if (updatedData.wait_list) {
                    calRef.wait_list = updatedData.wait_list;
                  }
                  if (calRef.time24 !== updatedData.time24) {
                    calRef.time = deepCopy(updatedData.time);
                    calRef.time$ = updatedData.time$;
                    calRef.time24 = updatedData.time24;
                    localStorage.setItem(`calendarChanged`, true);
                  }
                  if (calRef.occurrence_date !== updatedData.date) {
                    if (reactData.myCalendar.hasOwnProperty(updatedData.date)) {
                      reactData.myCalendar[updatedData.date].eventList[reactData.event_being_edited.event_index] = deepCopy(calRef);
                      updateObj.myCalendar = reactData.myCalendar;
                      localStorage.setItem(`calendarChanged`, true);
                    }
                  }
                }
                updateReactData(updateObj, true);
              }}
            />
          }
          {!reactData.loading && reactData.addPersonalEvent &&
            <NewCalendarEvent
              patient={reactData.isAppointment ? reactData.selectedPersonRec : state.session}
              personalEvent={!reactData.isAppointment}
              showNewEvent={true}
              options={{
                setPerson: reactData.isAppointment,
                setDate: ((reactData.appointmentDate && !reactData.appointmentDate.error) ? reactData.appointmentDate : null),
                setStart: reactData.appointmentStart,
                setEnd: reactData.appointmentEnd,
              }}
              isAppointment={reactData.isAppointment}
              onClose={(newEvent) => {
                let reactUpdObj = {
                  addPersonalEvent: false,
                  isAppointment: false
                };
                if (newEvent) {
                  let slotObj = {};
                  newEvent.slots.forEach(this_slot => {
                    slotObj[this_slot.slot_owner] = this_slot.slot_owner;
                  });
                  newEvent.occRecords.occArray.forEach(newOccDate => {
                    let index_of_thisDate_in_myCalendar = reactData.myCalendar.findIndex(this_date => {
                      return (this_date.dateObj.numeric === newOccDate);
                    });
                    if (index_of_thisDate_in_myCalendar > -1) {
                      let newEntry = {
                        "event_id": newEvent.event_id,
                        "owner": [state.session.user_id],
                        "image": null,
                        "description": newEvent.eventData.event_data.description,
                        "groups": newEvent.eventData.event_data.groups,
                        "location": newEvent.eventData.event_data.location,
                        "time": newEvent.eventData.event_data.time,
                        "type": 'appointment',
                        "sort24": (newEvent.eventData.event_data.time.from ? makeTime(newEvent.eventData.event_data.time.from).numeric24 : 0),
                        "slot_owners": slotObj,
                        "occurrence_date": newOccDate,
                        "event_key": `${newEvent.event_key}#${newOccDate}`,
                        "client": newEvent.client,
                        "record_type": "occurrence"
                      };
                      let eventIndex = reactData.myCalendar[index_of_thisDate_in_myCalendar].eventList.push(newEntry) - 1;
                      newEvent.slots.forEach(this_slot => {
                        let dragged_id = this_slot.slot_owner;
                        if (!reactData.conflictInfo.hasOwnProperty(dragged_id)) {
                          reactData.conflictInfo[dragged_id] = {};
                        }
                        let this_date = makeDate(newOccDate);
                        let this_Sunday = makeDate(addDays(this_date.date, -(this_date.dayOfWeek)));
                        if (!reactData.conflictInfo[dragged_id].hasOwnProperty('summaries')) {
                          reactData.conflictInfo[dragged_id].summaries = {
                            [this_Sunday.numeric$]: {
                              description: this_Sunday.dateOnly,
                              minutes: 0
                            }
                          };
                        }
                        else if (!reactData.conflictInfo[dragged_id].summaries.hasOwnProperty(this_Sunday.numeric$)) {
                          reactData.conflictInfo[dragged_id].summaries[this_Sunday.numeric$] = {
                            description: this_Sunday.dateOnly,
                            minutes: 0
                          };
                        }
                        let start_time = makeTime(newEvent.eventData.event_data.time.from);
                        let end_time = makeTime(newEvent.eventData.event_data.time.to);
                        let minutes_booked = 0;
                        if (end_time.minutesSinceMidnight < start_time.minutesSinceMidnight) {
                          minutes_booked = end_time.minutesSinceMidnight + (1440 - start_time.minutesSinceMidnight);
                        }
                        else {
                          minutes_booked = end_time.minutesSinceMidnight - start_time.minutesSinceMidnight;
                        }
                        if (minutes_booked < 1200) {
                          reactData.conflictInfo[dragged_id].summaries[this_Sunday.numeric$].minutes += minutes_booked;
                        }
                        if (!reactData.conflictInfo[dragged_id].hasOwnProperty(newOccDate)) {
                          reactData.conflictInfo[dragged_id][newOccDate] = [];
                        }
                        reactData.conflictInfo[dragged_id][newOccDate].push(
                          {
                            time: start_time.numeric24, open: false, event_id: reactData.myCalendar[index_of_thisDate_in_myCalendar].eventList[eventIndex].event_key,
                            event_title: reactData.myCalendar[index_of_thisDate_in_myCalendar].eventList[eventIndex].description
                          },
                          { time: end_time.numeric24, open: true }
                        );
                        reactData.conflictInfo[dragged_id][newOccDate].sort((a, b) => {
                          if (a.time === b.time) {
                            return (!a.open ? 1 : -1);
                          }
                          else {
                            return ((a.time < b.time) ? -1 : 1);
                          }
                        });
                      });
                      reactData.myCalendar[index_of_thisDate_in_myCalendar].eventList.sort((a, b) => {
                        if (a.customizations && a.customizations.show_as_unavailable) {
                          return 1;
                        }
                        else if (b.customizations && b.customizations.show_as_unavailable) {
                          return -1;
                        }
                        else if (a.sort24 > b.sort24) {
                          return 1;
                        }
                        else if (a.sort24 < b.sort24) {
                          return -1;
                        }
                        else {
                          return (a.description > b.description ? 1 : -1);
                        }
                      });
                    }
                  });
                  reactUpdObj.myCalendar = reactData.myCalendar;
                  localStorage.setItem(`calendarChanged`, true);
                }
                updateReactData(reactUpdObj, true);
              }}
            />
          }
          {!reactData.loading && reactData.addTemplateEvent &&
            <NewCalendarEvent
              patient={state.session}
              personalEvent={false}
              showNewEvent={true}
              options={{
                setPerson: false,
                simpleForm: true,
                setDuration: reactData.selectedTemplate.event_data.time.duration,
                forms: reactData.selectedTemplate.forms,
                customizations: reactData.selectedTemplate.customizations,
                title: (!isEmpty(reactData.selectedPersonRec)
                  ? resolve(reactData.selectedTemplate.customizations.description, reactData.selectedPersonRec)
                  : reactData.selectedTemplate.event_data.generic_description
                ),
                location: (!isEmpty(reactData.selectedPersonRec)
                  ? (resolve(reactData.selectedTemplate.customizations.location, reactData.selectedPersonRec) || '')
                  : ''
                ),
                setDate: ((reactData.appointmentDate && !reactData.appointmentDate.error) ? reactData.appointmentDate : null),
                setStart: reactData.appointmentStart,
                setEnd: reactData.appointmentEnd,
              }}
              isAppointment={false}
              onClose={async (newEvent) => {
                let reactUpdObj = {
                  addTemplateEvent: false,
                  isAppointment: false
                };
                let signupStatus = [];
                if (newEvent) {
                  for (let o = 0; o < newEvent.occRecords.occArray.length; o++) {
                    let newOccDate = newEvent.occRecords.occArray[o];
                    let index_of_thisDate_in_myCalendar = reactData.myCalendar.findIndex(this_date => {
                      return (this_date.dateObj.numeric === newOccDate);
                    });
                    const thisDate_exists_in_myCalendar = (index_of_thisDate_in_myCalendar > -1);
                    let slotObj = {};
                    newEvent.slots.forEach(this_slot => {
                      slotObj[this_slot.slot_owner] = this_slot.slot_owner;
                    });
                    let newEntry = Object.assign({}, newEvent, {
                      "event_id": newEvent.event_id,
                      "owner": [state.session.user_id],
                      "image": null,
                      "description": newEvent.eventData.event_data.description,
                      "groups": newEvent.eventData.event_data.groups,
                      "location": newEvent.eventData.event_data.location,
                      "time": newEvent.eventData.event_data.time,
                      "type": 'appointment',
                      "sort24": (newEvent.eventData.event_data.time.from ? makeTime(newEvent.eventData.event_data.time.from).numeric24 : 0),
                      "slot_owners": slotObj,
                      "occurrence_date": newOccDate,
                      "event_key": `${newEvent.event_key}#${newOccDate}`,
                      "client": newEvent.client,
                      "record_type": "occurrence"
                    });
                    let eventIndex = -1;
                    if (thisDate_exists_in_myCalendar) {
                      eventIndex = reactData.myCalendar[index_of_thisDate_in_myCalendar].eventList.push(newEntry) - 1;
                      for (let s = 0; s < newEvent.slots.length; s++) {
                        let this_slot = newEvent.slots[s];
                        let dragged_id = this_slot.slot_owner;
                        if (!reactData.conflictInfo.hasOwnProperty(dragged_id)) {
                          reactData.conflictInfo[dragged_id] = {};
                        }
                        let this_date = makeDate(newOccDate);
                        let this_Sunday = makeDate(addDays(this_date.date, -(this_date.dayOfWeek)));
                        if (!reactData.conflictInfo[dragged_id].hasOwnProperty('summaries')) {
                          reactData.conflictInfo[dragged_id].summaries = {
                            [this_Sunday.numeric$]: {
                              description: this_Sunday.dateOnly,
                              minutes: 0
                            }
                          };
                        }
                        else if (!reactData.conflictInfo[dragged_id].summaries.hasOwnProperty(this_Sunday.numeric$)) {
                          reactData.conflictInfo[dragged_id].summaries[this_Sunday.numeric$] = {
                            description: this_Sunday.dateOnly,
                            minutes: 0
                          };
                        }
                        let start_time = makeTime(newEvent.eventData.event_data.time.from);
                        let end_time = makeTime(newEvent.eventData.event_data.time.to);
                        let minutes_booked = 0;
                        if (end_time.minutesSinceMidnight < start_time.minutesSinceMidnight) {
                          minutes_booked = end_time.minutesSinceMidnight + (1440 - start_time.minutesSinceMidnight);
                        }
                        else {
                          minutes_booked = end_time.minutesSinceMidnight - start_time.minutesSinceMidnight;
                        }
                        if (minutes_booked < 1200) {
                          reactData.conflictInfo[dragged_id].summaries[this_Sunday.numeric$].minutes += minutes_booked;
                        }
                        if (!reactData.conflictInfo[dragged_id].hasOwnProperty(newOccDate)) {
                          reactData.conflictInfo[dragged_id][newOccDate] = [];
                        }
                        reactData.conflictInfo[dragged_id][newOccDate].push(
                          {
                            time: start_time.numeric24,
                            open: false,
                            event_id: reactData.myCalendar[index_of_thisDate_in_myCalendar].eventList[eventIndex].event_id,
                            event_title: reactData.myCalendar[index_of_thisDate_in_myCalendar].eventList[eventIndex].description
                          },
                          { time: end_time.numeric24, open: true }
                        );
                        reactData.conflictInfo[dragged_id][newOccDate].sort((a, b) => {
                          if (a.time === b.time) {
                            return (!a.open ? 1 : -1);
                          }
                          else {
                            return ((a.time < b.time) ? -1 : 1);
                          }
                        });
                      };
                    }
                    if (reactData.selectedPersonRec) {
                      signupStatus.push(
                        checkConflict(reactData.selectedPersonRec.person_id, {
                          droppedOn_event: newEntry,
                          eventIndex,
                          dateIndex: index_of_thisDate_in_myCalendar
                        })
                      );
                    }
                    /*
                    if (thisDate_exists_in_myCalendar) {
                      reactData.myCalendar[index_of_thisDate_in_myCalendar].eventList.sort((a, b) => {
                        if (a.customizations && a.customizations.show_as_unavailable) {
                          return 1;
                        }
                        else if (b.customizations && b.customizations.show_as_unavailable) {
                          return -1;
                        }
                        else if (a.sort24 > b.sort24) {
                          return 1;
                        }
                        else if (a.sort24 < b.sort24) {
                          return -1;
                        }
                        else {
                          return (a.description > b.description ? 1 : -1);
                        }
                      });
                    }
                    */
                  };
                  if (signupStatus.length > 0) {
                    let goodRecs = 0;
                    let badRecs = 0;
                    for (let this_occ of signupStatus) {
                      if (!this_occ.isAvailable) {
                        badRecs++;
                      }
                      else {
                        goodRecs++;
                      }
                    }
                    if (goodRecs === signupStatus.length) {
                      for (let this_occ of signupStatus) {
                        await proceedWithSignUp(this_occ.dragged_id, this_occ.calledWith);
                      }
                    }
                    else {
                      let warn_message = `There are scheduling conflicts with `;
                      if (badRecs === signupStatus.length) {
                        if (signupStatus.length === 2) {
                          warn_message += `both of the `;
                        }
                        else {
                          warn_message += `all ${signupStatus.length} of the `;
                        }
                        warn_message += `dates you're scheduling.  What would you like to do?`;
                        updateReactData({
                          alert: {
                            severity: 'warning',
                            title: 'Conflict warning!',
                            message: warn_message,
                            action: [
                              {
                                text: `Go ahead and assign them all`,
                                function: (async () => {
                                  for (let this_occ of signupStatus) {
                                    await proceedWithSignUp(this_occ.dragged_id, this_occ.calledWith);
                                  }
                                  updateReactData({
                                    alert: false
                                  }, true);
                                  onClose({
                                    action: 'reset',
                                  });
                                  return;
                                })
                              },
                              {
                                text: `Don't assign any`,
                                function: () => {
                                  updateReactData({
                                    alert: false
                                  }, true);
                                  return;
                                }
                              }
                            ]
                          }
                        }, true);
                      }
                      else {
                        warn_message += `${badRecs} of the ${signupStatus.length} `;
                        warn_message += `dates you're scheduling.  What would you like to do?`;
                        updateReactData({
                          alert: {
                            severity: 'warning',
                            title: 'Conflict warning!',
                            message: warn_message,
                            action: [
                              {
                                text: `Go ahead and assign them all`,
                                function: (async () => {
                                  for (let this_occ of signupStatus) {
                                    await proceedWithSignUp(this_occ.dragged_id, this_occ.calledWith);
                                  }
                                  updateReactData({
                                    alert: false
                                  }, true);
                                  onClose({
                                    action: 'reset',
                                  });
                                  return;
                                })
                              },
                              {
                                text: `Assign only those without a conflict`,
                                function: (async () => {
                                  for (let this_occ of signupStatus) {
                                    if (this_occ.isAvailable) {
                                      await proceedWithSignUp(this_occ.dragged_id, this_occ.calledWith);
                                    }
                                  }
                                  updateReactData({
                                    alert: false
                                  }, true);
                                  onClose({
                                    action: 'reset',
                                  });
                                  return;
                                })
                              },
                              {
                                text: `Don't assign any`,
                                function: () => {
                                  updateReactData({
                                    alert: false
                                  }, true);
                                  return;
                                }
                              }
                            ]
                          }
                        }, true);
                      }
                    }
                  }
                  for (let o = 0; o < newEvent.occRecords.occArray.length; o++) {
                    let newOccDate = newEvent.occRecords.occArray[o];
                    let index_of_thisDate_in_myCalendar = reactData.myCalendar.findIndex(this_date => {
                      return (this_date.dateObj.numeric === newOccDate);
                    });
                    const thisDate_exists_in_myCalendar = (index_of_thisDate_in_myCalendar > -1);
                    if (thisDate_exists_in_myCalendar) {
                      reactData.myCalendar[index_of_thisDate_in_myCalendar].eventList.sort((a, b) => {
                        if (a.customizations && a.customizations.show_as_unavailable) {
                          return 1;
                        }
                        else if (b.customizations && b.customizations.show_as_unavailable) {
                          return -1;
                        }
                        else if (a.sort24 > b.sort24) {
                          return 1;
                        }
                        else if (a.sort24 < b.sort24) {
                          return -1;
                        }
                        else {
                          return (a.description > b.description ? 1 : -1);
                        }
                      });
                    }
                  }
                  reactUpdObj.myCalendar = reactData.myCalendar;
                  localStorage.setItem(`calendarChanged`, true);
                  if (reactData.selectedPersonRec) {
                    dropTarget = {};
                    reactUpdObj.selectedPersonRec = '';
                  }
                }
                updateReactData(reactUpdObj, true);
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
      }
      <Box display='flex' flexDirection='column'
        className={classes.button_area}
        paddingBottom={'1.5'} px={0}
        justifyContent='center' alignItems='center'
      >
        <Box display='flex' flexWrap='wrap' flexGrow={2} flexDirection='row' justifyContent='center' alignItems='center'>
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: 'red', color: 'white' }}
            size='small'
            startIcon={<CloseIcon fontSize="small" />}
            onClick={() => {
              onClose();
            }}
          >
            {'Done'}
          </Button>
          {!reactData.defaultValues.assignmentView &&
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'green', color: 'white' }}
              size='small'
              startIcon={<AddEventIcon fontSize="small" />}
              onClick={async () => {
                let reactUpdObj = {
                  addPersonalEvent: true
                };
                if (reactData.selectedPerson_id !== state.session.person_id) {
                  reactUpdObj.selectedPersonRec = await getPerson(reactData.selectedPerson_id);
                  reactUpdObj.isAppointment = true;
                }
                updateReactData(reactUpdObj, true);
              }}
            >
              {(reactData.selectedPerson_id !== state.session.person_id) ? 'Make an Appointment' : 'Add an Event'}
            </Button>
          }
        </Box>
        <Box display='flex' flexWrap='noWrap' flexGrow={1} flexDirection='row' justifyContent='center' alignItems='center'>
          <Tooltip title='Previous 4 weeks'>
            <IconButton
              size='small'
              style={{ backgroundColor: 'blue', color: 'white', marginRight: '4px' }}
              onClick={() => { navigateToWindow(addDays(reactData.defaultValues?.start_date || new Date(), -28)); }}
            >
              <ArrowBackIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <Tooltip title='Jump to today'>
            <IconButton
              size='small'
              style={{ backgroundColor: 'blue', color: 'white', marginRight: '4px' }}
              onClick={() => { navigateToWindow(new Date()); }}
            >
              <TodayIcon fontSize='small' />
            </IconButton>
          </Tooltip>
          <input
            type="date"
            id={`select_date`}
            key={`select_date_${makeDate(reactData.defaultValues?.start_date || new Date()).numeric}`}
            ref={dateSelectRef}
            style={{
              backgroundColor: 'blue',
              color: 'white',
              fontFamily: 'Roboto',
              paddingRight: '16px',
              paddingTop: '5px',
              paddingLeft: '16px',
              paddingBottom: '5px',
              marginLeft: '0px',
              marginRight: '4px',
              border: '0.75px solid white',
              borderRadius: '30px',
              textWrap: 'nowrap',
              minHeight: '30px',
              maxHeight: '30px'
            }}
            defaultValue={makeDate(reactData.defaultValues?.start_date || new Date()).input}
            onChange={(ev) => {
              if (ev.target.value) { navigateToWindow(ev.target.value); }
            }}
          />
          <Tooltip title='Next 4 weeks'>
            <IconButton
              size='small'
              style={{ backgroundColor: 'blue', color: 'white', marginLeft: '0px' }}
              onClick={() => { navigateToWindow(addDays(reactData.defaultValues?.start_date || new Date(), 28)); }}
            >
              <ArrowForwardIcon fontSize='small' />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      {
        reactData.alert &&
        <Snackbar
          style={{ zIndex: 2000 }}
          open={!!reactData.alert}
          px={3}
          key={`alert_wrapper`}
          autoHideDuration={(reactData.alert.severity === 'success') ? 15000 : ((reactData.alert.severity === 'info') ? 15000 : null)}
          onClose={() => {
            updateReactData({
              alert: false
            }, true);
          }}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'center'
          }}
        >
          <Alert
            severity={reactData.alert.severity || 'info'}
            key={`alert_box`}
            icon={false}
            style={{
              flexDirection: 'column', borderRadius: '20px', border: 1, justifyContent: 'center', alignItems: 'center'
            }}
            action={(reactData.alert.action
              ?
              <Box
                display='flex'
                key={`alert_action`}
                overflow='auto'
                flexDirection='row'
              >
                {([reactData.alert.action].flat()).map((this_action, actionNdx) => (
                  <Button
                    key={`alert_button__${actionNdx}`}
                    className={AVAClass.AVAButton} color="inherit"
                    onClick={() => this_action.function()}
                  >
                    {this_action.text}
                  </Button>
                ))}
              </Box>
              : null
            )}
            variant='filled'
            onClose={() => {
              updateReactData({
                alert: false
              }, true);
            }}
          >
            <Box
              display='flex'
              key={`alert_message`}
              overflow='auto'
              alignItems={'center'}
              justifyContent={'center'}
              flexDirection='column'
            >
              {reactData.alert.title && <AlertTitle>{reactData.alert.title}</AlertTitle>}
              {reactData.alert.message}
            </Box>
          </Alert>
        </Snackbar >
      }
    </Dialog >
  );
};