import React from 'react';
import { sentenceCase, makeArray, cl, titleCase, listFromArray } from '../../util/AVAUtilities';
import { addDays, daysDiff, makeDate, sameDate } from '../../util/AVADateTime';
import { getImage, getPerson, makeName } from '../../util/AVAPeople';
import { getServiceRequests, updateServiceRequest, printServiceRequest } from '../../util/AVAServiceRequest';
import { getMessages, messageHistory } from '../../util/AVAMessages';
import MakeMessage from '../forms/MakeMessage';
import AVATextInput from '../forms/AVATextInput';

import { useSnackbar } from 'notistack';
// import { print } from "pdf-to-printer";

import List from '@material-ui/core/List';

import CloseIcon from '@material-ui/icons/HighlightOff';
import CheckIcon from '@material-ui/icons/DoneSharp';

import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import CircularProgress from '@material-ui/core/CircularProgress';
import DynamicFeedIcon from '@material-ui/icons/DynamicFeed';

import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import TextField from '@material-ui/core/TextField';

import SendIcon from '@material-ui/icons/Send';
import PrintIcon from '@material-ui/icons/Print';
import HomeIcon from '@material-ui/icons/Home';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import DoneAllIcon from '@material-ui/icons/DoneAll';

import Avatar from '@material-ui/core/Avatar';
import Menu from '@material-ui/core/Menu';
import MenuList from '@material-ui/core/MenuList';
import MenuItem from '@material-ui/core/MenuItem';

import { AVAclasses } from '../../util/AVAStyles';

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
    marginTop: theme.spacing(-0.75),
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
      selection - (optional) pre-set filter criteria
      request_date - (optional)
          if string or number or array with one entry, choose only this date
          if array with exactly two entries, use as start and end
    }
  */

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { enqueueSnackbar } = useSnackbar();

  const [dataRows, setDataRows] = React.useState();
  const [loading, setLoading] = React.useState(false);
  const [filters, setFilters] = React.useState({
    rowLimit: 5,
  });
  const [targetDatesExist, setTargetDatesExist] = React.useState(false);
  const [rowsSelected, setRowsSelected] = React.useState([]);
  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [statusDisplayed, setStatusDisplayed] = React.useState({});

  const showDeleted = false;

  const [promptForMessage, setPromptForMessage] = React.useState(false);
  const [showFilter, setShowFilter] = React.useState(false);

  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const scrollValue = 5;
  let rowsDisplayed = [];

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  const statusWords = {
    delivery: 'Delivered',
    open: 'Opened'
  };

  async function handleUpdates(options) {
    let historyLine = '';
    if (options.newStatus) {
      if (options.newStatus.toLowerCase() !== 'printed') {
        historyLine = `${await getPerson(session.user_id, 'name')} changed status to ${options.newStatus}`;
      }
      else {
        historyLine = `Printed`;
      }
    }
    let AVAdate = makeDate(new Date());
    historyLine += ` on ${AVAdate.absolute}`;
    let updateRows = [];
    for (let x = 0; x < options.rowsToUpdate.length; x++) {
      let r = dataRows[options.rowsToUpdate[x]];
      if ((options.newStatus) && (r.last_status.toLowerCase() !== 'complete')) {
        r.last_status = options.newStatus;
      }
      r.last_update = AVAdate.timestamp;
      r.workData.update_date = AVAdate.relative;
      if (('history' in r) && Array.isArray(r.history)) {
        r.history.unshift(historyLine);
      }
      else { r.history = [historyLine]; }
      updateRows.push(r);
      dataRows[x] = await buildRequestDetails(r);
      dataRows[x].workData.checked = false;
      let xSelected = rowsSelected.findIndex(i => { return i === x; });
      if (xSelected > -1) {
        rowsSelected.splice(xSelected, 1);
        setRowsSelected(rowsSelected);
      }
    };
    updateServiceRequest(updateRows.map(u => {
      let w = Object.assign({}, u);
      delete w.workData;
      return w;
    }));
    setDataRows(dataRows);
    setForceRedisplay(forceRedisplay => !forceRedisplay);
  }

  function getSelectedDetails(rows) {
    let selectedIDs = [];
    let selectedName = [];
    if (rows.length > 0) {
      rows.forEach(row => {
        if (!selectedIDs.includes(dataRows[row].workData.requestor_id)) {
          selectedIDs.push(dataRows[row].requestor);
          selectedName.push(dataRows[row].workData.requestor_name);
        }
      });
    }
    return { selectedIDs, selectedName };
  }

  let scrollTimeOut;
  function handleScroll() {
    clearTimeout(scrollTimeOut);
    scrollTimeOut = setTimeout(() => {
      let updatedFilters = filters;
      updatedFilters.rowLimit = filters.rowLimit + scrollValue;
      setFilters(updatedFilters);
      setForceRedisplay(forceRedisplay => !forceRedisplay);
    }, 500);
  };

  let filterTimeOut;
  const handleChangeRequestFilter = vCheck => {
    clearTimeout(filterTimeOut);
    filterTimeOut = setTimeout(() => {
      if (vCheck.length < 2) {
        setFilters(Object.assign(filters, {
          request_filter: ((filters.statusFilterList && (filters.statusFilterList.length > 0)) || (filters.dateTime_filter && !filters.dateTime_filter.error)),
          request_filter_lower: [],
          singleFilterDigit: ((vCheck && (vCheck.length === 1)) ? true : false),
          rowLimit: ((filters.rowLimit === 999) ? 5 : filters.rowLimit),
        }));
        setForceRedisplay(forceRedisplay => !forceRedisplay);
      }
      else {
        let checkWords = makeArray(vCheck.trim().toLowerCase(), ' ');
        setFilters(Object.assign(filters, {
          request_filter: true,
          request_filter_lower: checkWords,
          singleFilterDigit: false,
          rowLimit: 999,
        }));
        setForceRedisplay(forceRedisplay => !forceRedisplay);
      }
    }, 1000);
  };

  function checkDateFilter(vCheck) {
    let dateFilterType = 0;
    let dateFilterWords = '';
    let dateTime_filter = makeDate(vCheck.trim());
    if (!dateTime_filter.error) {
      /* 
        They entered a date.
        
        All Service Requests carry a "requested on" date in their request_date (this shows up here as a timestamp in the workData.request_date)
        Some type of Service Requests carry a "requested for fulfillment" date in their foreign_key (a meal ordered in advance for next Sunday, for example)
          If there are any "requested for fulfillment" type requests on this dashboard, the targetDatesExist variable will be true
                    
        There are four kinds of date searches available:
           1. Search for requests "entered on" a date,
           2. Search for requests "entered after" a date,
           3. Search for requests "requested for fulfillment on" a date,
           4. Search for requests "requested for fulfillment after" a date
        Type 1 & 2 don't make sense for future dates.
        Type 3 & 4 don't make sense if targetDatesExist is false
        
        We will determine the type by looking for keywords:
           1. "on", or no keyWord and date is today or in the past
           2. "after" (for dates in the past), or "since"
           3. "for", or no keyWord and date is in the future
           4. "after" (for today and dates in the future)

        NOTE: In addition to date searching, AVA includes search by word (see quotedWords and elsewhere in this function)   
      */
      vCheck = dateTime_filter.textOut;
      let keyWord = vCheck.toLowerCase().match(/\b(on|for|since|after)\b/gm);
      const today = new Date();
      if (!keyWord) {
        if (dateTime_filter.date <= today) {
          dateFilterType = 1;
          dateFilterWords = `entered on ${dateTime_filter.absolute}`;
        }
        else {
          dateFilterType = 3;
          dateFilterWords = `requested for ${dateTime_filter.absolute}`;
        }
      }
      else {
        switch (keyWord[0]) {
          case 'on': {
            if (dateTime_filter.date <= today) {
              dateFilterType = 1;
              dateFilterWords = `entered on ${dateTime_filter.absolute}`;
              break;
            }
            // "on" is invalid for future dates
            else if (daysDiff(dateTime_filter.date, today) < 7) {
              // if the date is within a week of today, coerce it back to a past date
              dateTime_filter = makeDate(addDays(dateTime_filter.date, -7));
              dateFilterType = 1;
              dateFilterWords = `entered on ${dateTime_filter.absolute}`;
              break;
            }
            else {
              // if we can't fix it, make this filter "FOR <future_date>" (missing break is intentional)
              keyWord[0] = 'for';
            }
          }
          // eslint-disable-next-line
          case 'for': {
            //     if (targetDatesExist) {
            dateFilterType = 3;
            dateFilterWords = `requested for ${dateTime_filter.absolute}`;
            //     }
            break;
          }
          case 'since': {
            if (dateTime_filter.date < today) {
              dateFilterType = 2;
              dateFilterWords = `entered on or after ${dateTime_filter.relative}`;
            }
            else if ((daysDiff(dateTime_filter.date, today) < 7)) {
              dateTime_filter = makeDate(addDays(dateTime_filter.date, -7));
              dateFilterType = 2;
              dateFilterWords = `entered on or after ${dateTime_filter.relative}`;
            }
            else {    // future date that's more than 7 days in the future; it can't be "entered after <future date>"                  
              dateFilterType = 4;
              dateFilterWords = `requested for dates on or after ${dateTime_filter.relative}`;
            }
            break;
          }
          case 'after': {
            if (dateTime_filter.date < today) {
              dateFilterType = 2;
              dateFilterWords = `entered on or after ${dateTime_filter.relative}`;
            }
            else if ((daysDiff(dateTime_filter.date, today) < 7) && (targetDatesExist)) {
              dateFilterType = 4;
              dateFilterWords = `requested for dates on or after ${dateTime_filter.relative}`;
            }
            break;
          }
          default: { }
        }
        if (dateFilterType > 0) {
          vCheck = vCheck.split(/\s+/).filter(f => { return (f !== keyWord[0]); }).join(' ');
        }
      }
    }
    return { dateTime_filter, dateFilterType, dateFilterWords };
  }

  function toggleCheck(pI) {
    dataRows[pI].workData.checked = !dataRows[pI].workData.checked;
    setDataRows(dataRows);
    let xSelected = rowsSelected.findIndex(i => { return i === pI; });
    if (xSelected > -1) {
      rowsSelected.splice(xSelected, 1);
    }
    else {
      rowsSelected.push(pI);
    }
    setRowsSelected(rowsSelected);
    setForceRedisplay(forceRedisplay => !forceRedisplay);
  }

  async function toggleOpen(pI) {
    dataRows[pI].workData.open = !dataRows[pI].workData.open;
    if (!dataRows[pI].workData.messageRecs) {
      dataRows[pI].workData.messageRecs = await prepareMessageHistory(dataRows[pI].request_id);
    }
    setDataRows(dataRows);
    setForceRedisplay(forceRedisplay => !forceRedisplay);
  }

  async function prepareMessageHistory(thread) {
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
    else if (filters.dateTime_filter && !filters.dateTime_filter.error) {
      switch (filters.dateFilterType) {
        case 1: {
          // Search for requests "entered on" a date
          if (!sameDate(pRec.workData.requestTime, filters.dateTime_filter.date)) {
            return false;
          }
          break;
        }
        case 2: {
          // Search for requests "entered after" a date
          if (pRec.workData.requestTime < filters.dateTime_filter.timestamp) {
            return false;
          }
          break;
        }
        case 3: {
          // Search for requests "requested for fulfillment on" a date
          if (pRec.workData.orderForDate.numeric !== filters.dateTime_filter.numeric) {
            return false;
          }
          break;
        }
        case 4: {
          // Search for requests "requested for fulfillment after" a date
          if (pRec.workData.orderForDate.numeric < filters.dateTime_filter.numeric) {
            return false;
          }
          break;
        }
        default: { }
      }
    }
    if (filters.request_filter_lower && (filters.request_filter_lower.length > 0)) {
      let searchString = `${pRec.workData.search_data} ${pRec.workData.formatted_type}`;
      let allWordsFound = filters.request_filter_lower.every(w => {
        return searchString.toLowerCase().includes(w);
      });
      if (!allWordsFound) { return false; }
    }
    if (filters.statusFilterList && (filters.statusFilterList.length > 0)) {
      return (filters.statusFilterList.includes(pRec.last_status.toLowerCase().trim()));
    }
    else { return true; }
  }

  function makeFilterHelper() {
    let filter_helper = '';
    if (filters.request_filter) {
      filter_helper = 'Requests ';
      if (filters.dateFilterWords) {
        filter_helper += filters.dateFilterWords;
      }
      if (filters.request_filter_lower && (filters.request_filter_lower.length > 0)) {
        if (filters.dateFilterWords) { filter_helper += ' and'; }
        filter_helper +=
          ` containing the word${(filters.request_filter_lower.length > 1) ? 's' : ''} ${listFromArray(filters.request_filter_lower)}`;
      }
      if (filters.statusFilterList && (filters.statusFilterList.length > 0)) {
        if (filter_helper.length > 9) { filter_helper += ' and'; }
        filter_helper += ` with status ${listFromArray(filters.statusFilterList, {or: true, sentenceCase: true})}`;
      }
    }
    return filter_helper;
  }

  const buildDashboard = async () => {
    setLoading(true);
    let qList = [];
    if (filter) { filter.client_id = session.client_id; }
    else { filter = { 'person': session.patient_id }; }
    filter.limit = Math.min(filters.rowLimit, 5) * 3;
    filter.request_type = makeArray(filter.request_type, ',');
    qList = await getServiceRequests(filter);
    let limit = Math.min(filter.limit, qList.length);
    for (let x = 0; x < limit; x++) {
      qList[x] = await buildRequestDetails(qList[x]);
    }
    let filtering = false;
    if (filter.selections || filter.words) {
      handleChangeRequestFilter(filter.selections || filter.words);
      filtering = true;
    }
    let dateFilterObj = {};
    if (filter.dates) {
      dateFilterObj = checkDateFilter(filter.dates);
      dateFilterObj.dateAsEntered = filter.dates;
      filtering = true;
    }
    let statusFilterList = [];
    if (filter.status) {
      statusFilterList = makeArray(filter.status);
      filtering = true;
    }
    if (filter.statusNot) {
      Object.keys(statusDisplayed).forEach((k) => {
        if (!filter.statusNot.includes(k.toLowerCase())) {
          statusFilterList.push(k.toLowerCase());
          filtering = true;
        }
      });
      filtering = true;
    }
    let newFilters = Object.assign(
      filters,
      { statusFilterList },
      dateFilterObj,
      { request_filter: filtering }
    );
    setFilters(newFilters);
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
    let AVArequestDate = makeDate(i.request_date);
    i.workData.display_date = AVArequestDate.relative;    // the date/time the request was first created
    let anonymous = false;
    let requestorRec = await getPerson(i.requestor, '*all');
    i.workData.requestor_name = await makeName(i.requestor);
    i.workData.requestor_location = requestorRec.location;
    i.workData.requestor_image = await getImage(i.requestor);
    i.workData.formatted_request = [];
    i.workData.update_date = AVAupdateDate.relative;
    i.workData.requestTime = AVArequestDate.timestamp;
    i.workData.orderForDate = makeDate(i.foreign_key);
    if (!i.workData.orderForDate.error) { setTargetDatesExist(true); }
    if (AVAupdateDate.relative !== AVArequestDate.relative) {
      i.workData.formatted_request.push(['head', `Updated: ${i.workData.update_date}`]);
    }
    let this_status = sentenceCase(i.last_status);
    i.workData.formatted_request.push(['head', `Current status: ${this_status}`]);
    if (!statusDisplayed[this_status]) {
      statusDisplayed[this_status] = 1;
    }
    else {
      statusDisplayed[this_status]++;
    }
    setStatusDisplayed(statusDisplayed);
    i.workData.formatted_request.push(['head', 'Details']);
    if (('original_request' in i) && (typeof (i.original_request) !== 'string')) {
      anonymous = (i.original_request.selections && i.original_request.selections.join(' ').includes('anonymous'));
      let [fReq, fSearch] = formatRequest(i, i.original_request);
      i.workData.formatted_request.push(...fReq);
      i.workData.search_data += ` ${fSearch}`;
    }
    else {
      anonymous = i.original_request.includes('anonymous');
      i.workData.formatted_request.push(['detail', i.original_request || 'No information available']);
      i.workData.search_data += ` ${i.original_request}`;
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
    if (i.workData.requestor_name !== i.on_behalf_of) {
      returnMessage.push(['detail', `For ${i.on_behalf_of}`]);
    }
    req.selections.forEach(s => {
      let dLine = s;
      if (s in req.textInput) {
        dLine += ` - ${req.textInput[s]}`;
        delete req.textInput[s];
      }
      returnMessage.push(['detail', dLine]);
      returnSearch += ` ${dLine}`;
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
      {!loading && dataRows &&
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
            label={'Search'}
            helperText={makeFilterHelper()}
            variant={'standard'}
            autoComplete='off'
          />
          <Paper
            onScroll={() => (
              handleScroll())}
            component={Box}
            variant='outlined'
            overflow='auto'
            square
          >
            <List  >
              <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                {rowsDisplayed = []}
              </Typography>
              {dataRows.map((this_item, index) => (
                ((rowsDisplayed.length <= filters.rowLimit) && this_item.workData
                  && (!filters.request_filter || filteredRequest(this_item, filters.request_filter))
                  && (!this_item.workData.delete_flag || showDeleted) &&
                  <Paper component={Box} variant='outlined' key={this_item.person_id + 'frag' + index} >
                    <Typography className={classes.noDisplay} sx={{ display: 'none', visibility: 'hidden' }}>
                      {rowsDisplayed.push(index)}
                    </Typography>
                    <Box display='flex' flexDirection='column'
                      onContextMenu={async (e) => {
                        e.preventDefault();
                        enqueueSnackbar(<div>
                          Type={this_item.request_type}<br />
                          Requestor={this_item.requestor}<br />
                          ForeignKey={this_item.foreign_key}<br />
                          LastUpdate={makeDate(this_item.last_update).absolute}<br />
                          ReqTime={makeDate(this_item.workData.requestTime).absolute}<br />
                          OrderFor={this_item.workData.orderForDate.absolute}
                        </div>, { variant: 'info', persist: true });
                      }}>
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
                              <Box display='flex' flexDirection='column' marginBottom={1.5}>
                                <Typography variant='h5' className={classes.lastName} >{this_item.workData.formatted_type}</Typography>
                                <Typography variant='h5' className={classes.firstName}>{`${this_item.workData.requestor_name} ${this_item.workData.requestor_location ? '(' + this_item.workData.requestor_location + ')' : ''}`}</Typography>
                                <Typography variant='h5' className={classes.firstName}>{this_item.workData.display_date}</Typography>
                                {!(this_item?.workData?.orderForDate.error) &&
                                  <Typography variant='h5' className={classes.firstName}>{`For ${this_item?.workData?.orderForDate.relative}`}</Typography>
                                }
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
                        <Box display='flex' flexDirection='row'>
                          <Checkbox
                            checked={this_item.workData.checked || false}
                            disableRipple
                            key={'checkbox' + index}
                            onClick={() => { toggleCheck(index); }}
                          />
                        </Box>
                      </Box>
                    </Box>
                  </Paper>
                )
              ))}
              {(rowsDisplayed.length === 0) &&
                <Box display='flex' flexDirection='column' flexWrap={'wrap'} justifyContent={'center'} alignContent={'center'}>
                  <Box display='flex' flexDirection='row' justifyContent={'center'} alignContent={'center'}>
                    <Typography variant='h5' className={classes.lastName} >Nothing found matches</Typography>
                  </Box>
                  <Box display='flex' flexDirection='row' justifyContent={'center'} alignContent={'center'}>
                    <Typography variant='h5' className={classes.lastName} >{`"${makeFilterHelper()}"`}</Typography>
                  </Box>
                </Box>
              }
            </List>
          </Paper>
          {
            promptForMessage &&
            <MakeMessage
              titleText={null}
              promptText={[`What should your message say?`]}
              promptUse={['message']}
              buttonText={'Send'}
              sender={{
                "client_id": session.client_id,
                "patient_id": session.user_id,
                "patient_display_name": session.user_display_name
              }}
              pRecipientID={promptForMessage.selectedIDs}
              pRecipientName={promptForMessage.selectedName}
              onCancel={() => { setPromptForMessage(false); }}
              onComplete={() => { setPromptForMessage(false); }}
              setMethod={null}
              allowCancel={true}
            />
          }
          {showFilter &&
            <AVATextInput
              titleText={'Include only...'}
              promptText={
                ['[display]What request dates?', 'Request date(s)?', '[display]~~~', '[display]Include which status(es)?']
                  .concat(Object.keys(statusDisplayed).map(k => {
                    return `[checkbox]${k}`;
                  }))
              }
              valueText={
                ['', ((filters.dateTime_filter && !filters.dateTime_filter.error) ? filters.dateAsEntered : ''),
                  '', '']
                  .concat(Object.keys(statusDisplayed).map(k => {
                    return ((filters.statusFilterList && filters.statusFilterList.includes(k.toLowerCase())) ? 'checked' : '');
                  }))}
              buttonText='Filter'
              onCancel={() => { setShowFilter(false); }}
              onSave={async (requestUpdates) => {
                setShowFilter(false);
                let filtering = !!filters.request_filter_lower;
                let dateFilterObj = {};
                if (requestUpdates[1]) {
                  dateFilterObj = checkDateFilter(requestUpdates[1]);
                  dateFilterObj.dateAsEntered = requestUpdates[1];
                  filtering = true;
                }
                else {
                  delete filters.dateFilterType;
                  delete filters.dateFilterWords;
                  delete filters.dateTime_filter;
                  delete filters.dateAsEntered;
                }
                let statusFilterList = [];
                Object.keys(statusDisplayed).forEach((k, x) => {
                  if (requestUpdates[4 + x] === 'checked') {
                    statusFilterList.push(k.toLowerCase());
                    filtering = true
                  }                  
                });
                let newFilters = Object.assign(
                  filters,
                  { statusFilterList },
                  dateFilterObj,
                  { request_filter: filtering }
                );
                setFilters(newFilters);
                setForceRedisplay(forceRedisplay => !forceRedisplay);
              }}
            />
          }
          { // Command Area
            <DialogActions className={classes.buttonArea} style={{ justifyContent: 'center' }}>
              <Box display='flex' flexDirection='column'>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    onClick={onClose}
                    startIcon={<CloseIcon size="small" />}
                  >
                    {'Close'}
                  </Button>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'green', color: 'white' }}
                    size='small'
                    onClick={() => {
                      rowsDisplayed.forEach((r, x) => {
                        dataRows[r].workData.checked = true;
                      });
                      setRowsSelected(rowsDisplayed);
                      setDataRows(dataRows);
                      setForceRedisplay(forceRedisplay => !forceRedisplay);
                    }}
                    startIcon={<DoneAllIcon size="small" />}
                  >
                    {'Select all'}
                  </Button>
                  <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'purple', color: 'white' }}
                    size='small'
                    onClick={() => {
                      setShowFilter(true);
                    }}
                    startIcon={<DynamicFeedIcon size="small" />}
                  >
                    {'Filter'}
                  </Button>
                </Box>
                <Box display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
                  {(rowsSelected.length > 0)
                    &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'orange', color: 'black' }}
                      size='small'
                      onClick={() => {
                        setPromptForMessage(getSelectedDetails(rowsSelected));
                      }}
                      startIcon={<SendIcon size="small" />}
                    >
                      {'Message'}
                    </Button>
                  }
                  {(rowsSelected.length > 0)
                    &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'blue', color: 'white' }}
                      size='small'
                      onClick={async () => {
                        let printList = [];
                        rowsSelected.forEach(r => { printList.push(dataRows[r]); });
                        let result = await printServiceRequest(printList, { PDF: true, fileName: 'test_PDF' });
                        enqueueSnackbar(result.message, { variant: (result.success ? 'success' : 'error'), persist: false });
                        await handleUpdates({
                          newStatus: 'Printed',
                          rowsToUpdate: rowsSelected
                        });
                        setRowsSelected([]);
                      }}
                      startIcon={<PrintIcon size="small" />}
                    >
                      {'Print'}
                    </Button>
                  }
                  {(rowsSelected.length > 0)
                    &&
                    <Button
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'brown', color: 'white' }}
                      size='small'
                      onClick={async () => {
                        await handleUpdates({
                          newStatus: 'Complete',
                          rowsToUpdate: rowsSelected
                        });
                        setRowsSelected([]);
                      }}
                      startIcon={<CheckIcon size="small" />}
                    >
                      {'Complete'}
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