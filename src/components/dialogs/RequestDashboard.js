import React from 'react';
import { sentenceCase, makeArray, cl, titleCase } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { getImage, getPerson, makeName } from '../../util/AVAPeople';
import { getServiceRequests, updateServiceRequest } from '../../util/AVAServiceRequest';
import { getMessages, sendMessages, messageHistory } from '../../util/AVAMessages';
import AVATextInput from '../forms/AVATextInput';

import { useSnackbar } from 'notistack';

import List from '@material-ui/core/List';

import CloseIcon from '@material-ui/icons/HighlightOff';

import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import CircularProgress from '@material-ui/core/CircularProgress';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';

import SendIcon from '@material-ui/icons/Send';

import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';

import Avatar from '@material-ui/core/Avatar';
import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

const useStyles = makeStyles(theme => ({
  page: {
    height: 950,
    maxWidth: 1000
  },
  dialogBox: {
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    minWidth: '100%',
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

  const classes = useStyles();
  const { enqueueSnackbar } = useSnackbar();

  const [dataRows, setDataRows] = React.useState();
  const [loading, setLoading] = React.useState(false);
  const [filters, setFilters] = React.useState({
    rowLimit: 5
  });
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const showDeleted = false;

  const [promptForUpdate, setPromptForUpdate] = React.useState(false);

  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const scrollValue = 5;
  var rowsWritten;

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
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
      pM += `${linkWord} ${session.service_request_types[t].description || 'request'}`;
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
    return titleCase(pM.trim());
  }

  async function handleUpdates([newStatus, checked, newMessage]) {
    let historyLine = '';
    if (newStatus) { historyLine += `Status changed to "${newStatus}"`; }
    else if (checked === 'checked') { historyLine += 'Status changed to "Complete"'; }
    if (newMessage) {
      if (historyLine) { historyLine += ' with the message: '; }
      historyLine += newMessage.trim();
    }
    let sendLine = historyLine;
    let thisPerson = await getPerson(session.patient_id, 'name');
    historyLine += ` added by ${thisPerson}`;
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
        if (newMessage) { r.last_note = newMessage; }
        if (('history' in r) && Array.isArray(r.history)) {
          r.history.unshift(historyLine);
        }
        else { r.history = [historyLine]; }
        await sendMessages({
          client: session.client_id,
          author: session.patient_id,
          testMode: false,
          messageText: sendLine,
          htmlText: sendLine,
          recipientList: r.requestor,
          subject: `Response to your ${r.workData.formatted_type} from ${session.patient_display_name}`,
          thread_id: '1234'
        });
        updateRows.push(r);
        dataRows[x] = await buildRequestDetails(r);
        dataRows[x].workData.checked = false;
      }
    };
    updateServiceRequest(updateRows.map(u => {
      let w = Object.assign({}, u);
      delete w.workData;
      return w;
    }));
    setDataRows(dataRows);
    setForceRedisplay(!forceRedisplay);
  }

  let scrollTimeOut;
  function handleScroll() {
    clearTimeout(scrollTimeOut);
    scrollTimeOut = setTimeout(() => {
      setFilters({
        request_filter: filters.request_filter,
        request_filter_lower: filters.request_filter_lower,
        singleFilterDigit: filters.singleFilterDigit,
        rowLimit: (filters.rowLimit + scrollValue),
        forceRedisplay: !forceRedisplay
      });
    }, 500);
  };

  let filterTimeOut;
  const handleChangeRequestFilter = vCheck => {
    clearTimeout(filterTimeOut);
    filterTimeOut = setTimeout(() => {
      if (vCheck.length === 0) {
        setFilters({
          request_filter: '',
          request_filter_lower: '',
          singleFilterDigit: false,
          rowLimit: filters.rowLimit,
          forceRedisplay: !forceRedisplay
        });
      }
      else {
        setFilters({
          request_filter: vCheck || '',
          request_filter_lower: vCheck.toLowerCase() || '',
          singleFilterDigit: (vCheck.length === 1),
          rowLimit: filters.rowLimit,
          forceRedisplay: !forceRedisplay
        });
      }
    }, 500);

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
    if (filters.singleFilterDigit) { return true; }
    else {
      return (`${pRec.workData.search_data} ${pRec.workData.formatted_type}`).toLowerCase().includes(filters.request_filter_lower);
    }
  }

  const buildDashboard = async () => {
    setLoading(true);
    let qList = [];
    if (filter) { filter.client_id = session.client_id; }
    else { filter = { 'person': session.patient_id }; }
    filter.limit = Math.min(filters.rowLimit, 5) * 3;
    filter.request_type = makeArray(filter.request_type, ',');
    // if (!filter.hasOwnProperty('client_id')) { filter.client_id = session.client_id; } 
    qList = await getServiceRequests(filter);
    let limit = Math.min(filter.limit, qList.length);
    for (let x = 0; x < limit; x++) {
      qList[x] = await buildRequestDetails(qList[x]);
    }
    setDataRows(qList);
    setLoading(false);
    filter.limit = Math.min(filters.rowLimit, 5) * 40;
    getServiceRequests(filter)
      .then(result => {
        let finalLimit = result.length;
        for (let x = limit; x < finalLimit; x++) {
          buildRequestDetails(result[x])
            .then(data => {
              qList[x] = data;
              setDataRows(qList);
            });
        }
      });
    if (qList.length === 0) {
      enqueueSnackbar(`No requests were found`, { variant: 'error', persist: false });
      onClose();
    }
  };

  async function buildRequestDetails(i) {
    i.workData = {};
    if (session.service_request_types.hasOwnProperty(i.request_type)) {
      i.workData.formatted_type = session.service_request_types[i.request_type].description || `${titleCase(i.request_type)}`;
    }
    else {
      cl(`request type "${i.request_type}" not in session.service_request_types`);
      i.workData.formatted_type = titleCase(i.request_type);
    }
    if (!('request_date' in i)) { i.request_date = i.request_id.split('~')[1]; }
    let AVAupdateDate = makeDate(i.last_update);
    i.workData.display_date = AVAupdateDate.relative;
    let anonymous = false;
    let requestorRec = await getPerson(i.requestor, '*all');
    i.workData.requestor_name = await makeName(i.requestor);
    i.workData.requestor_location = requestorRec.location;
    i.workData.requestor_image = await getImage(i.requestor);
    i.workData.formatted_request = [];
    let AVArequestDate = makeDate(i.request_date);
    i.workData.update_date = AVArequestDate.relative;
    i.workData.formatted_request.push(['head', `Since: ${i.workData.update_date}`]);
    i.workData.formatted_request.push(['head', `Current status: ${sentenceCase(i.last_status)}`]);
    i.workData.formatted_request.push(['head', 'Details']);
    if (('original_request' in i) && (typeof (i.original_request) !== 'string')) {
      anonymous = (i.original_request.selections && i.original_request.selections.join(' ').includes('anonymous'));
      let [fReq, fSearch] = formatRequest(i, i.original_request);
      i.workData.formatted_request.push(...fReq);
      i.workData.search_data = fSearch;
    }
    else {
      anonymous = i.original_request.includes('anonymous');
      i.workData.formatted_request.push(['detail', i.original_request || 'No information available']);
      i.workData.search_data = i.original_request;
    }
    if (i.attachments && (i.attachments.length > 0)) {
      i.attachments.forEach(a => {
        let fNArr = a.split('/').pop().split('.');
        fNArr.pop();
        let fName = decodeURI(fNArr.join('.'));
        i.workData.formatted_request.push([`href=${a}`, fName]);
      });
    }
    if (anonymous) {
      i.workData.requestor_name = 'Anonymous';
      i.workData.requestor_location = null;
      i.workData.requestor_image = null;
    }
    if ('history' in i) {
      i.workData.formatted_request.push(['head', 'History']);
      if (typeof (i.history) === 'string') { i.workData.formatted_request.push(['detail', i.history]); }
      else if (Array.isArray(i.history)) {
        i.history.forEach(h => {
          if (typeof h === 'string') { i.workData.formatted_request.push(['detail', h]); }
        });
      }
      else {
        Object.values(i.history).forEach(h => { i.workData.formatted_request.push(['detail', h]); });
      }
    }
    let mHist = await messageHistory({
      thread_id: `svc_${i.request_type}/${i.request_id}`,
      type: 'delivery'
    });
    if (mHist && (mHist.length > 0)) {
      i.workData.formatted_request.push(['head', 'Messages']);
      mHist.map(h => { return i.workData.formatted_request.push(['detail', h]); });
    }
    i.workData.search_data += `~ ${requestorRec.location} ~ ${i.workData.requestor_name}`;
    if (['closed', 'completed', 'cancelled'].includes(i.last_status.toLowerCase())) {
      i.workData.search_data += ` ~ closed`;
    }
    else { i.workData.search_data += ` ~ open`; }
    i.workData.checked = false;
    i.workData.open = false;
    return i;
  }

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

  React.useEffect(() => {
    async function initialize() {
      await buildDashboard();
    }
    initialize();
  }, [session]);  // eslint-disable-line react-hooks/exhaustive-deps


  // ******************

  return (
    <Dialog
      open={true || forceRedisplay}
      p={2}
      fullScreen
    >
      {loading &&
        <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
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
              src={session.client_logo || process.env.REACT_APP_AVA_LOGO}
            />
            <React.Fragment>
              <Box
                display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                flexWrap='wrap' textOverflow='ellipsis' width='100%'
                key={'loadingBox'}
                mb={2}
              >
                <Typography variant='h5' >{`Retrieving`}</Typography>
                <Typography variant='h5' className={classes.lastName} sx={{ marginBottom: '15px' }}>
                  {(filter.request_type && session.service_request_types[filter.request_type]) ? session.service_request_types[filter.request_type].description : 'Request'}s
                </Typography>
                <Typography variant='caption' >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
              </Box>
              <CircularProgress />
            </React.Fragment>
          </Box>
        </DialogContent>
      }
      {!loading && dataRows && dataRows.length > 0 &&
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
                Recent Requests
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
            onChange={event => (handleChangeRequestFilter(event.target.value))}
            className={classes.freeInput}
            label={'Filter/Search'}
            variant={'standard'}
            autoComplete='off'
          />
          <Paper
            onScroll={() => (handleScroll())}
            component={Box}
            // className={classes.page}
            variant='outlined'
            overflow='auto'
            square
          >
            <List  >
              <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                {rowsWritten = 0}
              </Typography>
              {dataRows.map((this_item, index) => (
                ((rowsWritten <= filters.rowLimit) && this_item.workData
                  && (!filters.request_filter || filteredRequest(this_item, filters.request_filter))
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
                                minWidth={50}
                                minHeight={50}
                                maxWidth={50}
                                border={1}
                                alt=' '
                                src={this_item.workData.requestor_image}
                              />
                              <Box display='flex' flexDirection='column'>
                                <Typography variant='h5' className={classes.lastName} >{this_item.workData.formatted_type}</Typography>
                                <Typography variant='h5' className={classes.firstName}>{`requested by: ${this_item.workData.requestor_name} ${this_item.workData.requestor_location ? '(' + this_item.workData.requestor_location + ')' : ''}`}</Typography>
                                <Typography variant='h5' className={classes.timeLine}>{this_item.workData.display_date}</Typography>
                              </Box>
                            </Box>
                            {this_item?.workData?.formatted_request && this_item.workData.formatted_request.map((mLine, mIndex) => (
                              (mLine[0].startsWith('href=')
                                ?
                                <a
                                  href={mLine[0].split('=')[1]}
                                  key={`attach-${mIndex}-href`}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  style={{ color: 'inherit', textDecoration: 'underline' }}>
                                  <Typography
                                    key={`attach-${mIndex}`}
                                    className={classes.mrowdetail}
                                  >
                                    {`Attachment: ${mLine[1]}`}
                                  </Typography>
                                </a>
                                :
                                < Typography
                                  key={`prefLine-${mIndex}`}
                                  className={(`mrow${mLine[0]}` in classes) ? classes[`mrow${mLine[0]}`] : classes.mrowdetail}
                                >
                                  {typeof mLine[1] === 'string' ? mLine[1] : (alert(index, mLine))}
                                </Typography>
                              )
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
                        {filter.request_type
                          && (makeArray(filter.request_type).length === 1)
                          && (
                            !(session.service_request_types[filter.request_type].hasOwnProperty('allowStatusUpdateFromDashboard'))
                            || session.service_request_types[filter.request_type].allowStatusUpdateFromDashboard)
                          &&
                          <Checkbox
                            edge='start'
                            checked={this_item.workData.checked || false}
                            disableRipple
                            key={'checkbox' + index}
                            onClick={() => { toggleCheck(index); }}
                          />
                        }
                        <SendIcon
                          onClick={() => {
                            toggleCheck(index);
                            setPromptForUpdate(true);
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
            promptForUpdate &&
            <AVATextInput
              titleText={createMessageText()}
              promptText={['New Status', '[checkbox]Mark as Complete?', 'Message to Requestor']}
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
                    className={classes.AVAButton}
                    style={{ color: 'red' }}
                    onClick={onClose}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Close'}
                  </Button>
                  {filter.request_type
                    && (makeArray(filter.request_type).length === 1)
                    && (
                      !(session.service_request_types[filter.request_type].hasOwnProperty('allowStatusUpdateFromDashboard'))
                      || session.service_request_types[filter.request_type].allowStatusUpdateFromDashboard)
                    &&
                    <Button
                      className={classes.AVAButton}
                      onClick={() => {
                        setPromptForUpdate(true);
                      }}
                      startIcon={<SendIcon size="small" />}
                    >
                      {'Message / Update'}
                    </Button>
                  }
                </Box>
              </Box>
            </DialogActions>
          }
        </React.Fragment >
      }
    </Dialog >
  );
};