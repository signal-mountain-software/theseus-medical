import React from 'react';
import { titleCase, cl } from '../../util/AVAUtilities';
import { makeDate, makeTime } from '../../util/AVADateTime';
import { getImage, getPerson } from '../../util/AVAPeople';
import { getCalendarEntries, occurrenceData } from '../../util/AVACalendars';
import { getMessages } from '../../util/AVAMessages';
import AVAConfirm from '../forms/AVAConfirm';
import AVATextInput from '../forms/AVATextInput';

import { useSnackbar } from 'notistack';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import List from '@material-ui/core/List';

import CloseIcon from '@material-ui/icons/HighlightOff';
import EditIcon from '@material-ui/icons/Edit';

import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';

import DeleteIcon from '@material-ui/icons/Delete';
import SendIcon from '@material-ui/icons/Send';
import SendMessageDialog from '../dialogs/SendMessageDialog';

import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';

import Avatar from '@material-ui/core/Avatar';
import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import LinearProgress from '@material-ui/core/LinearProgress';
import CircularProgress from '@material-ui/core/CircularProgress';

const useStyles = makeStyles(theme => ({
  page: {
    height: 950,
    maxWidth: 1000
  },
  freeInput: {
    marginLeft: '25px',
    marginRight: 2,
    marginBottom: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: theme.spacing(1),
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
  },
  imageArea: {
    minWidth: '100px',
    maxWidth: '100px',
    minHeight: '100px',
    maxHeight: '100px',
    marginBottom: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  buttonArea: {
    maxWidth: 1000,
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  rowButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'contained',
    size: 'small'
  },
  rowButtonDefault: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.primary[theme.palette.type],
  },
  rowButtonRed: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    color: theme.palette.reject[theme.palette.type],
  },
  rowButtonGreen: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.confirm[theme.palette.type],
  },
  rowButtonBlue: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
    // color: theme.palette.info[theme.palette.type],
  },
  listItem: {
    justifyContent: 'space-between',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(1),
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  makeIconStyle: {
    marginRight: theme.spacing(1),
  },
  locationLine: {
    fontSize: theme.typography.fontSize * 1.0,
  },
  preferenceLine: {
    fontSize: theme.typography.fontSize * 1.0,
  },
  mrowhead: {
    marginTop: 10,
    fontSize: theme.typography.fontSize * 1.2,
    fontWeight: 'bold'
  },
  mrowdetail: {
    fontSize: theme.typography.fontSize * 1.0,
  },
  mrowqual: {
    fontSize: theme.typography.fontSize * 1.0,
    marginLeft: 10,
  },
  techInfoLine: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(2),
  },
  techInfoLine2: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: theme.spacing(4),
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  confirm: {
    backgroundColor: 'green',
  },
  firstName: {
    fontSize: theme.typography.fontSize * 1.4,
    marginRight: theme.spacing(1),
  },
  timeLine: {
    fontSize: theme.typography.fontSize * 1.4,
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1.5),
  },
  lastName: {
    fontWeight: 'bold',
    fontSize: theme.typography.fontSize * 1.8,
    marginRight: theme.spacing(1),
  },
  messageArea: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(0),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  title: {
    marginTop: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginBottom: 0,
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
}));

export default ({ session, filter = {}, onClose }) => {

  /*
    filter: {
      person_id - only show this person
      request_type - (optional) only show requests of this type
      request_date - (optional)
          if string or number or array with one entry, choose only this date
          if array with exactly two entries, use as start and end
    }
  */

  const { enqueueSnackbar } = useSnackbar();

  const classes = useStyles();

  const [dataRows, setDataRows] = React.useState();
  const [allRows, setAllRows] = React.useState();
  const [moreRows, setMoreRows] = React.useState();

  const [request_filter, setRequestFilter] = React.useState('');
  const [request_filter_lower, setRequestFilterLower] = React.useState('');
  const [singleFilterDigit, setSingleFilterDigit] = React.useState(false);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [showReactError,] = React.useState(false);
  const [showAddPrompt, setShowAddPrompt] = React.useState(false);
  const [deletePending, setDeletePending] = React.useState(false);
  const showDeleted = false;
  const [confirmMessage, setConfirmMessage] = React.useState('');
  const [confirmID, setConfirmID] = React.useState('');
  const [confirmIndex, setConfirmIndex] = React.useState('');

  const [loading, setLoading] = React.useState();

  const [promptForUpdate, setPromptForUpdate] = React.useState(false);

  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const [progress, setProgress] = React.useState(0);
  const [pWidth, setPWidth] = React.useState(60);

  const [rowLimit, setRowLimit] = React.useState(20);
  const scrollValue = 5;
  var rowsWritten;

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  const requestNames = {
    maint: 'Maintenance Request',
    meal: 'Meal Order',
    guest_room: 'Guest Room Reservation Request',
    trans: 'Transportation Request',
    breakfast: 'Breakfast Order'
  };

  const statusWords = {
    delivery: 'Delivered',
    open: 'Opened'
  };

  function createMessageText() {
    let mData = {};
    let mCount = 0;
    let pM = '';
    dataRows.forEach(r => {
      if (r.workData.checked) {
        if (!(r.request_type in mData)) { mData[r.request_type] = []; }
        mData[r.request_type].push(r.workData.display_date);
        mCount++;
      }
    });
    if (mCount === 0) { return null; }
    if (mCount > 1) { pM += ` ${mCount} prior requests:`; }
    let linkWord = '';
    for (let t in mData) {
      let mL = mData[t].length - 1;
      pM += `${linkWord} ${requestNames[t] || 'request'}`;
      if (mL > 0) { pM += 's'; }
      pM += ' from';
      for (let x = 0; x <= mL; x++) {
        if (mData[t][x].startsWith('Last ')) { pM += ` last ${mData[t][x].slice(5)}`; }
        else { pM += ` ${mData[t][x]}`; }
        if ((mL > 1) && (x < mL)) { pM += ','; }
        if ((x + 1) === (mL)) { pM += ' and'; }
      };
      linkWord = ', and';
    }
    return pM.trim();
  }

  async function handleUpdates([newStatus, checked, newNote]) {
    let historyLine = '';
    if (newStatus) { historyLine += `Status changed to "${newStatus}"`; }
    else if (checked === 'checked') { historyLine += 'Status changed to "Complete"'; }
    if (newNote) {
      if (historyLine) { historyLine += ' and '; }
      historyLine += `Note that said "${newNote.trim()}" added`;
    }
    let thisPerson = await getPerson(session.patient_id, 'name');
    historyLine += ` by ${thisPerson}`;
    if (session.patient_id !== session.user_id) { historyLine += ` (proxy=${session.user_id})`; }
    let AVAdate = makeDate(new Date());
    historyLine += ` on ${AVAdate.absolute}`;
    let updateRows = [];
    for (let x = 0; x < dataRows.length; x++) {
      let r = dataRows[x];
      if (r.workData.checked) {
        if (newStatus && (newStatus !== '')) { r.last_status = newStatus; }
        else if (checked === 'checked') { r.last_status = 'Complete'; }
        r.last_update = AVAdate.timestamp;
        r.workData.update_date = AVAdate.relative;
        if (newNote) { r.last_note = newNote; }
        if (('history' in r) && Array.isArray(r.history)) {
          r.history.unshift(historyLine);
        }
        else { r.history = [historyLine]; }
        updateRows.push(r);
        dataRows[x] = await buildCalendarDetails(r);
      }
    };
    //updateCalendarRequest(updateRows.map(u => {
    //  let w = Object.assign({}, u);
    //  delete w.workData;
    //  return w;
    //}));
    dataRows.sort((a, b) => {
      if (a.last_update > b.last_update) { return -1; }
      if (a.last_update < b.last_update) { return 1; }
      return 0;
    });
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  }

  const handleChangeRequestFilter = event => {
    if (event.target.value.length === 0) {
      setRequestFilter(null);
      setRequestFilterLower(null);
    }
    else {
      setRequestFilter(event.target.value);
      setRequestFilterLower(event.target.value.toLowerCase());
      setSingleFilterDigit(event.target.value.length === 1);
    }
    setRowLimit(scrollValue);
  };

  const handleRemoveMessage = async (pMessage_id, pIndex) => {
    // will mark request as cancelled as send appropriate messages 
  };


  const onScroll = async (event) => {
    if (dataRows.length < allRows.length) {
      let promiseArr = [];
      let stopAt = Math.min(allRows.length, (dataRows.length + scrollValue));
      for (let x = dataRows.length; x < stopAt; x++) {
        promiseArr.push(
          await buildCalendarDetails(allRows[x])
            .then((good, bad) => {
              if (good) { dataRows[x] = good; }
              else { console.log(bad); }
            })
        );
      }
      await Promise.all(promiseArr);
      setDataRows(dataRows);
      setRowLimit(dataRows.length);
      cl(`scroll done - now ${dataRows.length} rows of ${allRows.length} loaded`);
      setMoreRows(allRows.length > dataRows.length);
      setForceRedisplay(!forceRedisplay);
    }
    else { cl(`scroll ignored`); }
  };

  function toggleCheck(pI) {
    dataRows[pI].workData.checked = !dataRows[pI].workData.checked;
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  }

  async function toggleOpen(pI) {
    dataRows[pI].workData.open = !dataRows[pI].workData.open;
    if (!dataRows[pI].workData.messageRecs) {
      dataRows[pI].workData.messageRecs = await prepareMessage(dataRows[pI].request_id);
    }
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  }

  async function prepareMessage(thread) {
    let qR = await getMessages({ 'thread_id': thread });
    let mRow = [];
    let workingKey = '';
    qR.forEach(r => {
      switch (r.record_type) {
        case 'message': {
          mRow.push({
            'sort': `${r.composite_key}.000`,
            'body': ['head', `Message ${makeDate(r.created_time).relative}`]
          });
          mRow.push({
            'sort': `${r.composite_key}.001`,
            'body': ['detail', 'Sent to:']
          });
          mRow.push({
            'sort': `${r.composite_key}~Z999.000`,
            'body': ['detail', 'Message said:']
          });
          r.content.current['EN-US'].text.split('\r\n').forEach((m, mX) => {
            mRow.push({
              'sort': `${r.composite_key}~Z999.${mX + 100}`,
              'body': ['qual', m]
            });
          });
          workingKey = r.composite_key;
          break;
        }
        case 'delivery': {
          let nameOut = (`${r.recipient_list.name.first} ${r.recipient_list.name.last}`).trim();
          let postedWord = makeDate(r.results[0].posted_time).relative;
          mRow.push({
            'sort': `${workingKey}.${r.recipient_list.name.last}/${r.recipient_list.name.first}`,
            'body': ['qual', `${nameOut} - ${statusWords[r.results[0].result] || r.results[0].result} ${postedWord}`]
          });
          break;
        };
        default: { }
      }
    });
    mRow.sort((a, b) => {
      if (a.sort > b.sort) { return 1; }
      if (a.sort < b.sort) { return -1; }
      return 0;
    });
    return mRow.map(r => { return r.body; });
  };

  function filteredRequest(pRec) {
    if (singleFilterDigit) { return true; }
    else {
      return (`${pRec.workData.search_data} ${pRec.workData.formatted_type}`).toLowerCase().includes(request_filter_lower);
    }
  }

  const buildDashboard = async () => {
    let qList = [];
    setProgress(0);
    qList = await getCalendarEntries({
      client_id: session.client_id,
      type: 'occurrence'
    });
    setProgress(25);
    if (qList.length === 0) {
      enqueueSnackbar(`The Calendar is empty!`, { variant: 'error', persist: false });
      onClose();
    }
    setAllRows(qList);
    let workingList = [];
    for (let x = 0; x < Math.min(qList.length, scrollValue); x++) {
      workingList.push(await buildCalendarDetails(qList[x]));
      setProgress(25 + ((x / qList.length) * 75));
    }
    setDataRows(workingList);
    return { dataRows: workingList, allRows: qList };
  };

  async function buildCalendarDetails(i) {
    let [e, o,] = i.event_key.split('#');
    let thisEntry = await occurrenceData({
      'client_id': i.client,
      'type': 'occurrence',
      'event': e,
      'occurrence': o
    });
    i.workData = {};
    i.workData.formatted_type = thisEntry.description;
    i.workData.display_date = thisEntry.date.relative;
    i.workData.formatted_request = [];
    let location = i.location;
    if (thisEntry.location) {
      if (typeof thisEntry.location === 'string') { location = thisEntry.location; }
      else { location = thisEntry.location.description; }
    }
    if (location) {
      i.workData.formatted_request.push(['head', titleCase(location)]);
    }
    i.workData.start_time = thisEntry.time || i.time_from;
    if (i.slotData) {
      let owner = i.slotData.owner || i.slot_owner;
      i.workData.requestor_image = await getImage(owner);
      let this_slot = (i.slotData.slot || i.slotData.id);
      let list_type = (this_slot === owner);
      if (isNaN(Number(this_slot)) && !list_type) { i.workData.formatted_request.push(['detail', this_slot]); }
      else {
        let slot_number = Number(this_slot);
        if ((slot_number > 99) && (slot_number < 2400)) { i.workData.formatted_request.push(['detail', `${makeTime(this_slot).time}`]); }
        else if (this_slot && !list_type) { i.workData.formatted_request.push(['detail', this_slot]); }
      }
      if (i.slotData.status
        && (typeof (i.slotData.status.current) === 'string')
        && (i.slotData.status.current.toLowerCase() !== 'selected')) {
        i.workData.formatted_request.push(['details', titleCase(i.slotData.status.current)]);
      }
      if (i.slotData.notes) { i.workData.formatted_request.push(['qual', `Notes: ${titleCase(i.slotData.notes)}`]); }
    }
    i.workData.checked = false;
    i.workData.open = false;
    return i;
  }
  /*
    function formatRequest(i, req) {
      let returnMessage = [];
      let returnSearch = '';
      if (!('textInput' in req)) { req.textInput = {}; }
      if (!('qualifiers' in req)) { req.qualifiers = []; }
      if (!('selections' in req)) { req.selections = []; }
      returnMessage.push(['detail', `For ${i.on_behalf_of}`]);
      req.selections.forEach(s => {
        let dLine = s;
        if (s in req.textInput) {
          dLine += ` - ${req.textInput[s]}`;
          delete req.textInput[s];
        }
        returnMessage.push(['detail', dLine]);
        returnSearch += ` ${dLine}}`;
        if (s in req.qualifiers) {
          for (let q in req.qualifiers[s]) {
            let qLast = req.qualifiers[s][q].length - 1;
            if (qLast >= 0) {
              let qLine = `${q} -`;
              // eslint-disable-next-line
              req.qualifiers[s][q].forEach((qV, qX) => {
                qLine += ` ${qV}`;
                returnSearch += ` ${qV}`;
                if ((qX < qLast) && (qLast > 1)) { qLine += ','; }  // array longer than 2
                if (qX === (qLast - 1)) { qLine += ' and'; }  // next to last entry in array
              });
              returnMessage.push(['qual', qLine]);
            }
          }
        }
      });   // done with all selections; is there any text left?
      for (let k in req.textInput) {
        if (['-stamped', '-date', '-ymd'].some(w => { return k.includes(w); })) { continue; }
        if (typeof req.textInput[k] === 'string') {
          if (req.textInput[k] !== i.on_behalf_of) {
            let kLow = k.toLowerCase().trim();
            returnSearch += ` ${req.textInput[k]}`;
            if (['description', 'summary', 'details'].some(w => { return kLow.includes(w); })) {
              returnMessage.unshift(['text', req.textInput[k]]);
            }
            else {
              returnMessage.push(['text', `${k} - ${req.textInput[k]}`]);
            }
          }
        }
      };
      return [returnMessage, returnSearch];
    }
  */

  async function initialize() {
    setPWidth(100);
    setLoading('loading');
    await buildDashboard();
    setLoading('complete');
  }

  if (!loading) {
    initialize();
  }

  if (loading === 'complete') {
    return reactScreen();
  }
  else {
    return loadingScreen();
  }

  /*
  React.useEffect(() => {
    async function initialize() {
      await buildDashboard();
    }
    initialize();
  }, [session]);  // eslint-disable-line react-hooks/exhaustive-deps
  */

  // ******************
  function reactScreen() {
    return (
      <Dialog
        open={true || forceRedisplay}
        p={2}
        fullScreen
      >
        {dataRows && dataRows.length > 0 &&
          <React.Fragment>
            {/* Header with Avatar, Message, and VertMenu */}
            <Box
              display='flex' flexDirection='row'
              className={classes.messageArea}
              key={'topBox'}
            >
              <Box display='flex' flexDirection='column' key={'titlesection'}>
                <Typography
                  className={classes.title}
                >
                  Upcoming Events
                </Typography>
              </Box>
              <Box
                paddingRight={2}
                marginTop={1}
                aria-controls='hidden-menu'
                aria-haspopup='true'
                onClick={(event) => {
                  handleClick(event);
                  setPopupMenuOpen(true);
                }}>
                <Avatar src={process.env.REACT_APP_AVA_LOGO} />
              </Box>
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
                      <Typography className={classes.popUpFooter} >{`Function: RequestDashboard`}</Typography>
                    </Box>
                  </MenuItem>
                </MenuList>
              </Menu>
            </Box>
            <TextField
              id='List Filter'
              value={request_filter}
              onChange={handleChangeRequestFilter}
              className={classes.freeInput}
              label={'Filter/Search'}
              variant={'standard'}
              autoComplete='off'
            />
            <Paper
              component={Box}
              onScroll={moreRows ? onScroll : null}
              className={classes.page}
              variant='outlined'
              overflow='auto'
              square
            >
              <List  >
                <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                  {rowsWritten = 0}
                </Typography>
                {dataRows.map((this_item, index) => (
                  ((rowsWritten <= rowLimit)
                    && (!request_filter || filteredRequest(this_item, request_filter))
                    && (!this_item.workData.delete_flag || showDeleted) &&
                    <Paper component={Box} variant='outlined' key={this_item.person_id + 'frag' + index} >
                      <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                        {rowsWritten++}
                      </Typography>
                      <Box display='flex' flexDirection='column'>
                        <Box
                          display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
                          key={this_item.message_id + 'r' + index}
                          className={classes.listItem}
                        >
                          <Box display='flex' onClick={() => { toggleOpen(index); }} flexGrow={1} flexDirection='row' justifyContent='space-between' alignItems='center'>
                            <Box display='flex' flexDirection='column'>
                              <Box display='flex' flexDirection='row'>
                                <Box
                                  className={classes.imageArea}
                                  component="img"
                                  alt={''}
                                  src={this_item.workData.requestor_image}
                                />
                                <Box display='flex' flexDirection='column'>
                                  <Typography variant='h5' className={classes.lastName} >{this_item.workData.formatted_type}</Typography>
                                  <Typography variant='h5' className={classes.firstName}>{this_item.workData.requestor_name}</Typography>
                                  <Typography variant='h5' className={classes.timeLine}>{`${this_item.workData.display_date}${this_item.workData.start_time ? (' - ' + this_item.workData.start_time) : ''}`}</Typography>
                                </Box>
                              </Box>
                              {this_item && this_item.workData && this_item.workData.formatted_request && this_item.workData.formatted_request.map((mLine, mIndex) => (
                                <Typography
                                  key={`prefLine-${mIndex}`}
                                  className={(`mrow${mLine[0]}` in classes) ? classes[`mrow${mLine[0]}`] : classes.mrowdetail}
                                >
                                  {mLine[1]}
                                </Typography>
                              ))}
                              {this_item.workData.open &&
                                this_item.workData.messageRecs.map((mLine, dX) => (
                                  <Typography
                                    key={('mrow_out' + dX)}
                                    className={(`mrow${mLine[0]}` in classes) ? classes[`mrow${mLine[0]}`] : classes.mrowdetail}
                                  >
                                    {mLine[1]}
                                  </Typography>
                                ))
                              }
                            </Box>
                          </Box>
                          <Checkbox
                            edge='start'
                            checked={this_item.workData.checked}
                            disableRipple
                            key={'checkbox' + index}
                            onClick={() => { toggleCheck(index); }}
                          />
                          <DeleteIcon
                            onClick={() => {
                              setConfirmMessage(`Cancel this request`);
                              setConfirmID(this_item.message_id);
                              setConfirmIndex(index);
                              setDeletePending(true);
                              setForceRedisplay(false);
                            }}
                          />
                        </Box>
                      </Box>
                    </Paper>
                  )
                ))}
              </List>
            </Paper>
            {
              deletePending &&
              <AVAConfirm
                promptText={confirmMessage}
                onCancel={() => {
                  setDeletePending(false);
                }}
                onConfirm={() => {
                  handleRemoveMessage(confirmID, confirmIndex);
                  setDeletePending(false);
                }}
              >
              </AVAConfirm>
            }
            {
              showAddPrompt &&
              <SendMessageDialog
                open={true}
                onClose={() => {
                  setShowAddPrompt(false);
                }}
                onSelect={(selectedPerson) => {
                }}
              >
              </SendMessageDialog>
            }
            {promptForUpdate &&
              <AVATextInput
                titleText={createMessageText()}
                promptText={['New Status', '[checkbox]Mark as Complete?', 'Notes']}
                buttonText='Update'
                onCancel={() => { setPromptForUpdate(false); }}
                onSave={async (requestUpdates) => {
                  setPromptForUpdate(false);
                  await handleUpdates(requestUpdates);
                }}
              />
            }
            { // Command Area
              <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
                <Box display='flex' flexDirection='column'>
                  <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                    <Button
                      className={classes.rowButtonGreen}
                      onClick={() => {
                        onClose();
                      }}
                      startIcon={<CloseIcon size="small" />}
                    >
                      {'Close'}
                    </Button>
                    <Button
                      className={classes.rowButtonDefault}
                      onClick={() => {
                        setPromptForUpdate(true);
                      }}
                      startIcon={<EditIcon size="small" />}
                    >
                      {'Update Status'}
                    </Button>
                    <Button
                      onClick={async () => {
                        setShowAddPrompt(true);
                      }}
                      className={classes.rowButtonGreen}
                      startIcon={<SendIcon size='small' />}
                    >
                      {`New Request`}
                    </Button>
                  </Box>
                </Box>
              </DialogActions>
            }
          </React.Fragment >
        }
        {(showReactError) &&
          <React.Fragment>
            <Typography className={classes.title}>
              {dataRows[dataRows.length + 10].person_id}
            </Typography>
          </React.Fragment>
        }
      </Dialog >
    );
  }

  function loadingScreen() {
    return (
      <Box
        display='flex' flexDirection='column' justifyContent='center' alignItems='center'
        key={'loadingBox'}
        ml={2} mr={2} mb={2} mt={8}
      >
        <Box
          component="img"
          mb={2}
          minWidth={150}
          maxWidth={150}
          alt=''
          src={session?.client_logo || process.env.REACT_APP_AVA_LOGO}
        />
        <React.Fragment>
          <Box
            display='flex' flexDirection='column' justifyContent='center' alignItems='center'
            flexWrap='wrap' textOverflow='ellipsis' width='100%'
            key={'loadingBox'}
            mb={2}
          >
            <Typography variant='h5' className={classes.lastName} >{`Loading your Calendar`}</Typography>
            <Typography variant='caption' >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
          </Box>
          <LinearProgress variant="determinate" className={classes.progressBar} style={{ width: pWidth }} value={progress} />
          <CircularProgress />
        </React.Fragment>
      </Box>
    );
  }
};