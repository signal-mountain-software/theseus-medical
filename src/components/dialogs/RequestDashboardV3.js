import React from 'react';
import {
  deepCopy, isMobile, cl, titleCase, dbClient, recordExists,
  listFromArray, makeArray, sentenceCase, restAPI,
} from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { getImage, getPerson, makeName } from '../../util/AVAPeople';
import { getMemberList } from '../../util/AVAGroups';
import { getServiceRequests, updateServiceRequest, getRequestLog } from '../../util/AVAServiceRequest';
import { sendMessages } from '../../util/AVAMessages';
import { printRequestsOnePerPage } from '../../util/AVAPrintServiceRequest';
import { downloadRowsAsXlsx } from '../../util/AVAPeopleListExport';
import { getActivityDetail } from '../../util/AVAActivityLoaderV3';
import MakeMessage from '../forms/MakeMessage';
import AVATextInput from '../forms/AVATextInput';
import PersonFilter from '../forms/PersonFilter';

import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import CircularProgress from '@material-ui/core/CircularProgress';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import List from '@material-ui/core/List';
import Paper from '@material-ui/core/Paper';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CheckIcon from '@material-ui/icons/DoneSharp';
import ClearAllIcon from '@material-ui/icons/ClearAll';
import CloseIcon from '@material-ui/icons/HighlightOff';
import DashboardIcon from '@material-ui/icons/Dashboard';
import DoneAllIcon from '@material-ui/icons/DoneAll';
import ListIcon from '@material-ui/icons/List';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import PrintIcon from '@material-ui/icons/Print';
import SaveAltIcon from '@material-ui/icons/SaveAlt';
import SearchIcon from '@material-ui/icons/Search';
import SendIcon from '@material-ui/icons/Send';
import SwapVertIcon from '@material-ui/icons/SwapVert';

import { useSnackbar } from 'notistack';
import useSession from '../../hooks/useSession';
import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';

// ─── Styles ──────────────────────────────────────────────────────────────────

const useStyles = makeStyles(theme => ({
  noDisplay: { display: 'none', visibility: 'hidden' },
  title: {
    marginTop: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginLeft: theme.spacing(2),
    marginBottom: 0,
    fontSize: theme.typography.fontSize * 1.5,
    fontWeight: 'bold',
  },
  rowName: {
    fontSize: theme.typography.fontSize * 1.4,
    fontWeight: 'bold',
    marginRight: theme.spacing(1),
  },
  rowMeta: {
    fontSize: theme.typography.fontSize * 1.0,
    marginTop: theme.spacing(-1.0),
    fontWeight: 'bold',
    marginBottom: theme.spacing(1.0),
  },
  statusChip: {
    display: 'inline-block',
    fontSize: theme.typography.fontSize * 0.8,
    padding: '2px 10px',
    borderRadius: '12px',
    fontWeight: 'bold',
    border: '1px solid rgba(0,0,0,0.2)',
    whiteSpace: 'nowrap',
  },
  sectionHead: {
    marginTop: theme.spacing(1),
    fontSize: theme.typography.fontSize * 1.05,
    fontWeight: 'bold',
  },
  sectionDetail: {
    fontSize: theme.typography.fontSize * 1.0,
    marginLeft: theme.spacing(1),
  },
  sectionQual: {
    fontSize: theme.typography.fontSize * 1.0,
    marginLeft: theme.spacing(2),
  },
  sectionText: {
    fontSize: theme.typography.fontSize * 1.0,
    marginLeft: theme.spacing(1),
    fontStyle: 'italic',
  },
  freeInput: {
    marginLeft: '2px',
    marginRight: 2,
    marginBottom: theme.spacing(0.5),
    paddingBottom: theme.spacing(0.5),
    width: '90%',
    verticalAlign: 'middle',
  },
  imageArea: {
    minWidth: '64px',
    maxWidth: '64px',
    minHeight: '64px',
    maxHeight: '64px',
    marginRight: theme.spacing(1),
    borderRadius: '8px',
    objectFit: 'cover',
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 5,
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.85,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  formControlLbl: {
    marginRight: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 2,
    paddingTop: 0,
    height: theme.spacing(2.8),
  },
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
    flexShrink: 0,
  },
  qaQuestion: {
    fontSize: theme.typography.fontSize * 1.0,
    color: 'rgba(0,0,0,0.58)',
    marginLeft: theme.spacing(1),
  },
  qaSep: {
    fontSize: theme.typography.fontSize * 1.0,
    color: 'rgba(0,0,0,0.35)',
    marginLeft: theme.spacing(0.75),
    marginRight: theme.spacing(0.75),
  },
  qaAnswer: {
    fontSize: theme.typography.fontSize * 1.0,
    fontWeight: 'bold',
    color: 'rgba(0,0,0,0.87)',
  },
}));

// ─── Default status list (used when none configured for the type) ─────────────

const DEFAULT_STATUS_LIST = [
  { display: 'Submitted', value: 'submitted' },
  { display: 'In Process', value: 'in_process' },
  { display: 'Complete / Closed', value: 'complete' },
];

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * RequestDashboardV3
 *
 * Manages service requests of a specific type — load, filter, assign, update,
 * message requestors, print, and view statistics.
 *
 * @param {string}   factName       - The request_type key (e.g. 'maintenance', 'transport').
 *                                    Drives the title, status list, and TELS config.
 * @param {object}   [request={}]   - Additional DB / client-side filters:
 *                                      person_id   — show only requests from this person
 *                                      assigned_to — show only requests assigned to this person
 *                                      foreign_key — narrow to a specific foreign key (e.g. a date)
 *                                      status      — array: initially show only these statuses
 *                                      statusNot   — array: initially exclude these statuses
 *                                      sort        — 'asc' | 'desc' (default 'desc')
 *                                      filterText  — initial text search
 * @param {object}   [options={}]   - Feature flags:
 *                                      allowAssign    — string | string[]: group IDs to pick assignee from
 *                                      allowDashboard — bool: show Dashboard stats toggle
 *                                      viewMode       — bool: read-only; just a Close button
 *                                      noSelect       — bool: hide checkboxes
 *                                      woNumber       — bool: include WO# field in Update dialog
 *                                      idle_delay     — number: minutes between background refreshes (0 = off, default 5)
 *                                      showForeignKey — bool: show "For <date>" on rows (default true)
 * @param {function} onClose        - Called when the user closes the dialog.
 */
export default function RequestDashboardV3({ factName, request = {}, options = {}, onClose }) {
  const classes = useStyles();
  const AVAClass = AVAclasses();
  const { state } = useSession();
  const { enqueueSnackbar } = useSnackbar();

  const session = state.session;
  const user_fontSize = AVADefaults({ fontSize: 'get' });

  // ── Type metadata from session ────────────────────────────────────────────
  const typeConfig = React.useMemo(
    () => session?.service_request_types?.[factName] || {},
    [session, factName]
  );
  const typeTitle = typeConfig.description
    || titleCase((factName || 'requests').replace(/_/g, ' '));
  const typeStatusList = typeConfig.statusList || DEFAULT_STATUS_LIST;
  const typeStatusObj = React.useMemo(
    () => Object.fromEntries(typeStatusList.map(s => [s.value, s])),
    [typeStatusList]
  );
  const allowTELS = typeConfig.allowTELS || false;
  const TELSfacilityID = typeConfig.TELSfacilityID || null;

  // ── Build initial status filter from filter prop ──────────────────────────
  const initialStatusFilter = React.useMemo(() => {
    const sf = {};
    const statuses = request.status || request.statusNot;
    if (statuses) {
      makeArray(statuses).forEach(s => { sf[s.toLowerCase()] = true; });
    }
    return sf;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── State ─────────────────────────────────────────────────────────────────
  const [reactData, setReactData] = React.useState({
    loading: true,
    rows: [],
    rowIds: [],
    lastTimestamp: 0,
    view: 'list',           // 'list' | 'dashboard'
    expandedRow: -1,        // index of the currently expanded row
    sortOrder: request.sort || 'desc',
    filterText: (request.filterText || '').toLowerCase(),
    statusFilter: initialStatusFilter,
    statusNotMode: !!(request.statusNot && !request.status),
    selectedPersonName: null,
    statistics: null,
    isMobile: isMobile(),
    // overlays
    showAssign: false,
    assignChoices: [],
    showUpdateForm: false,
    showMessage: null,      // { selectedIDs, selectedName } | null
    showExportPicker: false,
    exportAvailableColumns: [],
    exportRowsToExport: [],
  });
  // eslint-disable-next-line
  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const isMounted = React.useRef(true);
  const filterTimeoutRef = React.useRef(null);
  const refreshIntervalRef = React.useRef(null);
  const firstSelectedRef = React.useRef(null);
  const canonicalOrderRef = React.useRef([]);
  // Kept current so the background-refresh setInterval closure sees latest values
  const refreshStateRef = React.useRef({ rows: [], rowIds: [], lastTimestamp: 0 });

  const updateReactData = React.useCallback((newData, force = false) => {
    if (!isMounted.current) { return; }
    setReactData(prev => Object.assign(prev, newData));
    if (force) { setForceRedisplay(v => !v); }
  }, []);

  // Keep refreshStateRef in sync so the interval closure stays current
  React.useEffect(() => {
    refreshStateRef.current = {
      rows: reactData.rows,
      rowIds: reactData.rowIds,
      lastTimestamp: reactData.lastTimestamp,
    };
  }, [reactData.rows, reactData.rowIds, reactData.lastTimestamp]);

  // ── Visibility predicate ──────────────────────────────────────────────────
  function isVisible(row) {
    if (!row?.workData) { return false; }
    const hasActiveFilter = Object.values(reactData.statusFilter).some(Boolean);
    if (hasActiveFilter) {
      const statusLow = (row.last_status || '').toLowerCase();
      const statusMatches = !!reactData.statusFilter[statusLow];
      if (reactData.statusNotMode ? statusMatches : !statusMatches) { return false; }
    }
    if (reactData.filterText) {
      const haystack = `${row.workData.enteredBy_name} ${row.workData.search_data}`.toLowerCase();
      const notesMatch = row.workData.notes_section?.some(
        n => typeof n[1] === 'string' && n[1].toLowerCase().includes(reactData.filterText)
      );
      if (!haystack.includes(reactData.filterText) && !notesMatch) { return false; }
    }
    return true;
  }

  // Computed on every render — no stale closure risk
  const visibleRows = reactData.rows.filter(isVisible);
  const anySelected = reactData.rows.some(r => r.workData?.checked && isVisible(r));
  const allSelected = visibleRows.length > 0 && visibleRows.every(r => r.workData?.checked);
  const anyTELS = allowTELS
    && reactData.rows.some(r => r.workData?.checked && r.workData?.allowTELS && isVisible(r));

  // ── Request data formatting ───────────────────────────────────────────────

  function inferAffirmative(question) {
    const q = question.trim().toLowerCase();
    if (/^do you agree\b/.test(q)) { return 'I agree'; }
    if (/\bdo you\b|\bhave you\b|\bwould you\b|\bwill you\b|\bcan you\b|\bdid you\b/.test(q)) { return 'Yes'; }
    if (/^is it true\b|^are you\b|^is there\b|^was there\b|^are there\b|^does\b/.test(q)) { return 'Yes'; }
    if (/\?/.test(q)) { return 'Yes'; }
    return '\u2713';
  }

  function formatRequest(record, req) {
    const formatted = [];
    let searchText = '';

    if (!req.textInput) { req.textInput = {}; }
    if (!req.qualifiers) { req.qualifiers = {}; }
    if (!req.selections) { req.selections = []; }

    if (!request.person_id && record.workData.requestor_name !== record.on_behalf_of) {
      formatted.push(['detail', `For ${record.on_behalf_of}`]);
    }

    // Flavor 2: selections — split on first '(' to separate question from answer(s)
    req.selections.forEach(s => {
      const dLine = s.trim();
      const parenIdx = dLine.indexOf('(');
      let question, answers;
      if (parenIdx === -1) {
        question = dLine;
        answers = [inferAffirmative(dLine)];
      } else {
        question = dLine.slice(0, parenIdx).trim();
        answers = dLine.slice(parenIdx + 1).replace(/\)+$/, '').split(/[,;]+/).map(a => titleCase(a.trim())).filter(Boolean);
      }
      if (s in req.textInput) {
        answers.push(req.textInput[s]);
        delete req.textInput[s];
      }
      searchText += ` ${dLine}`;
      formatted.push(['qa', { question, answers }]);
    });

    // Flavor 3: qualifiers — {primaryQuestion: {secondaryQuestion: {answer: bool}}}
    if (!Array.isArray(req.qualifiers)) {
      for (const primaryQuestion of Object.keys(req.qualifiers)) {
        const secondaryObj = req.qualifiers[primaryQuestion];
        if (!secondaryObj || typeof secondaryObj !== 'object') { continue; }
        const secondaryKeys = Object.keys(secondaryObj);
        const multiSecondary = secondaryKeys.length > 1;
        for (const secondaryQuestion of secondaryKeys) {
          const choiceObj = secondaryObj[secondaryQuestion];
          if (!choiceObj || typeof choiceObj !== 'object') { continue; }
          const trueAnswers = Object.keys(choiceObj).filter(k => !!choiceObj[k]).map(k => titleCase(k));
          if (trueAnswers.length === 0) { continue; }
          const displayQuestion = multiSecondary
            ? `${primaryQuestion} / ${secondaryQuestion}`
            : primaryQuestion;
          searchText += ` ${trueAnswers.join(' ')}`;
          formatted.push(['qa', { question: displayQuestion, answers: trueAnswers }]);
        }
      }
    }

    // Flavor 1: remaining textInput entries — simple question / answer pairs
    for (const k in req.textInput) {
      if (['-stamped', '-date', '-ymd'].some(w => k.includes(w))) { continue; }
      if (typeof req.textInput[k] !== 'string') { continue; }
      if (req.textInput[k] === record.on_behalf_of) { continue; }
      const kLow = k.toLowerCase().trim();
      searchText += ` ${req.textInput[k]}`;
      if (['description', 'summary', 'details'].some(w => kLow.includes(w))) {
        formatted.unshift(['text', req.textInput[k]]);
      } else {
        formatted.push(['qa', { question: k, answers: [req.textInput[k]] }]);
      }
    }

    // Apply canonical ordering: sort qa items by their position in the Activity field sequence.
    // Non-qa items (text, detail) keep their original positions.
    const canonical = canonicalOrderRef.current;
    if (canonical.length > 0) {
      const nonQa = formatted.filter(item => item[0] !== 'qa');
      const qaItems = formatted.filter(item => item[0] === 'qa');
      qaItems.sort((a, b) => {
        const aQ = a[1].question.trim().toLowerCase();
        const bQ = b[1].question.trim().toLowerCase();
        const aIdx = canonical.findIndex(c => aQ === c || aQ.includes(c) || c.includes(aQ));
        const bIdx = canonical.findIndex(c => bQ === c || bQ.includes(c) || c.includes(bQ));
        return (aIdx === -1 ? canonical.length : aIdx) - (bIdx === -1 ? canonical.length : bIdx);
      });
      formatted.length = 0;
      formatted.push(...nonQa, ...qaItems);
    }

    return [formatted, searchText];
  }

  async function buildRowData(raw) {
    raw.workData = {};
    raw.workData.search_data = '';
    if (!raw.current_request) {
      raw.current_request = deepCopy(raw.original_request);
    }

    raw.workData.formatted_type = typeTitle;
    raw.workData.flavor = typeConfig.flavor || '';
    raw.workData.allowTELS = typeConfig.allowTELS || false;

    const [enteredBy] = raw.request_id.split('~');
    raw.workData.enteredBy = enteredBy;
    if (!raw.request_date) { raw.request_date = Number(raw.request_id.split('~').pop()); }

    const reqDate = makeDate(raw.request_date);
    const updDate = makeDate(raw.last_update);
    raw.workData.display_date = reqDate.relative;
    raw.workData.update_date = updDate.relative;
    raw.workData.requestTime = reqDate.timestamp;
    raw.workData.orderForDate = makeDate(raw.foreign_key);
    raw.workData.this_status = sentenceCase(raw.last_status || '');

    if (!raw.requestor) {
      raw.requestor = raw.composite_key
        ? raw.composite_key.split('%')[0]
        : enteredBy;
    }

    const requestorRec = await getPerson(raw.requestor, '*all');
    raw.workData.requestor_name = await makeName(raw.requestor);
    raw.workData.enteredBy_name = (raw.requestor !== enteredBy)
      ? await makeName(enteredBy)
      : raw.workData.requestor_name;
    raw.workData.requestor_location = requestorRec?.location || '';
    const _addr = requestorRec?.address || {};
    const _addrStreet = _addr.address ? _addr.address.split('~')[0] : '';
    const _addrStreet2 = _addr.address2 || '';
    const _addrStateZip = [_addr.state, (_addr.zip_code || _addr.zip)].filter(Boolean).join(' ');
    const _addrCityLine = [_addr.city, _addrStateZip].filter(Boolean).join(', ');
    raw.workData.requestor_address = [_addrStreet, _addrStreet2, _addrCityLine].filter(Boolean).join('; ');
    raw.workData.requestor_image = await getImage(raw.requestor);

    const req = raw.current_request ?? raw.original_request;
    let anonymous = false;

    if (req && typeof req !== 'string') {
      anonymous = req.selections?.join(' ')?.includes('anonymous') || false;
      const [fmt, srch] = formatRequest(raw, req);
      raw.workData.formatted_request = fmt;
      raw.workData.search_data += ` ${srch}`;
    } else {
      const text = (req || 'No information available').toString();
      anonymous = text.includes('anonymous');
      raw.workData.formatted_request = [['detail', text]];
      raw.workData.search_data += ` ${text}`;
    }

    if (raw.attachments?.length > 0) {
      raw.attachments.forEach(a => {
        const nameParts = a.split('/').pop().split('.');
        nameParts.pop();
        raw.workData.formatted_request.push([`href=${a}`, decodeURI(nameParts.join('.'))]);
      });
    }

    if (anonymous) {
      raw.workData.requestor_name = 'Anonymous';
      raw.workData.enteredBy_name = 'Anonymous';
      raw.workData.requestor_location = null;
      raw.workData.requestor_image = null;
    }

    // Summary = request body without attachments (shown in collapsed card)
    raw.workData.summary_request = raw.workData.formatted_request.filter(l => !l[0].startsWith('href='));
    raw.workData.search_data += ` ${raw.workData.requestor_name}`;

    // Split history into status-change lines and notes
    const historyList = [];
    const noteList = [];
    if (raw.history) {
      const lines = typeof raw.history === 'string'
        ? [raw.history]
        : Array.isArray(raw.history)
          ? raw.history.filter(h => typeof h === 'string')
          : Object.values(raw.history).filter(h => typeof h === 'string');
      lines.forEach(h => {
        if (h.startsWith('Note added')) { noteList.push(h.replace('Note added by ', '')); }
        else { historyList.push(h); }
      });
    }

    raw.workData.historyList = historyList;
    raw.workData.notes_section = [];
    if (noteList.length > 0) {
      raw.workData.notes_section.push(['head', 'Notes']);
      noteList.forEach(n => raw.workData.notes_section.push(['detail', n]));
    }

    raw.workData.thread_id = `svc_${raw.request_type}/${raw.request_id}`;
    raw.workData.activityLog = null;  // lazy-loaded from ServiceRequestLog on first expand
    raw.workData.checked = false;
    return raw;
  }

  // ── Statistics for dashboard view ─────────────────────────────────────────
  function computeStatistics(rows) {
    const now = Date.now();
    const msPerDay = 86_400_000;
    const count = {};
    const openClosed = { closed: 'na', open: 'na' };
    const totalOpenTime = {};
    const totalIdleTime = {};
    const oldestRequests = {};

    rows.forEach(row => {
      let status = row.last_status;
      let guard = 0;
      while (status && status !== 'na' && guard++ < 10) {
        if (!openClosed.hasOwnProperty(status)) {
          openClosed[status] = typeStatusObj[status]?.open ? 'open' : 'closed';
        }
        const closed = openClosed[status] === 'closed';
        const openMs = closed ? (row.last_update - row.request_date) : (now - row.request_date);
        const idleMs = closed ? 0 : (now - row.last_update);

        if (count[status] !== undefined) {
          count[status]++;
          totalOpenTime[status] += openMs;
          totalIdleTime[status] += idleMs;
          if (row.request_date < oldestRequests[status][4].request_date) {
            oldestRequests[status][4] = { request_date: row.request_date, age: openMs / msPerDay };
            oldestRequests[status].sort((a, b) => a.request_date - b.request_date);
          }
        } else {
          count[status] = 1;
          totalOpenTime[status] = openMs;
          totalIdleTime[status] = idleMs;
          oldestRequests[status] = [
            { request_date: row.request_date, age: openMs / msPerDay },
            ...Array(4).fill({ request_date: Number.MAX_SAFE_INTEGER, age: 0 }),
          ];
        }
        status = openClosed[status] ?? 'na';
      }
    });

    const colorGradient = [
      '#5ffb76', '#00fbbb', '#00f5ec', '#53ecff', '#9fe0ff',
      '#a7d2f8', '#b0c3ed', '#b8b5dd', '#c177bc', '#cb4f99', '#ce0e6a',
    ];
    const gradientWord = ['Excellent', 'Excellent', 'Good', 'Good', 'OK', 'OK', 'OK', 'Low', 'Low', 'Poor', 'Poor'];

    function statusColor(avgDays, rangeObj) {
      const low = rangeObj?.good ?? 0;
      const med = rangeObj?.ok ?? 5;
      const high = rangeObj?.bad ?? 10;
      let x;
      if (avgDays <= low) { x = 0; }
      else if (avgDays >= high) { x = 10; }
      else if (avgDays < med) { x = Math.round(((avgDays - low) / (med - low)) * 5); }
      else { x = Math.round(((high - avgDays) / (high - med)) * 5) + 6; }
      return [colorGradient[x], gradientWord[x]];
    }

    const avgOpenTime = {};
    const avgIdleTime = {};
    const color = {};
    const valueWord = {};

    for (const s in count) {
      const avg = (totalOpenTime[s] / count[s]) / msPerDay;
      avgOpenTime[s] = avg;
      const [c, w] = statusColor(avg, typeStatusObj[s]?.age);
      color[s] = c;
      valueWord[s] = w;
      if (openClosed[s] === 'open') {
        avgIdleTime[s] = (totalIdleTime[s] / count[s]) / msPerDay;
      }
    }

    return { count, totalOpenTime, totalIdleTime, oldestRequests, avgOpenTime, avgIdleTime, color, valueWord, openClosed };
  }

  // ── Bulk update selected rows ─────────────────────────────────────────────
  async function handleUpdate({ newStatus, assigned_to, enteredNote, notify, woNumber } = {}) {
    const now = makeDate(new Date());
    const currentUserName = await getPerson(session.user_id, 'name');
    const assignedToName = assigned_to ? await getPerson(assigned_to, 'name') : null;
    const statusChangeText = newStatus ? `changed the status to ${newStatus.replace(/_/g, ' ')}` : null;

    const rowsToWrite = [];

    for (let i = 0; i < reactData.rows.length; i++) {
      const row = reactData.rows[i];
      if (!row.workData.checked || !isVisible(row)) { continue; }

      const historyParts = [];
      if (newStatus && newStatus.toLowerCase() !== 'printed') {
        historyParts.push(`${currentUserName} changed status to ${titleCase(newStatus.replace(/_/g, ' '))} on ${now.absolute}`);
      } else if (newStatus === 'Printed') {
        historyParts.push(`Printed on ${now.absolute}`);
      }
      if (assigned_to) { historyParts.push(`Assigned to ${assignedToName} on ${now.absolute}`); }
      if (woNumber && woNumber !== row.foreign_key) { historyParts.push(`Set Work Order number to ${woNumber}`); }

      if (historyParts.length > 0) {
        const histLine = historyParts.join(' and ');
        if (Array.isArray(row.history)) { row.history.unshift(histLine); }
        else { row.history = [histLine]; }
        row.workData.historyList.unshift(histLine);
      }

      if (enteredNote) {
        const noteLine = `Note added by ${currentUserName} on ${now.absolute}: ${enteredNote}`;
        if (Array.isArray(row.history)) { row.history.unshift(noteLine); }
        else { row.history = [noteLine]; }
        if (!row.workData.notes_section.some(n => n[0] === 'head')) {
          row.workData.notes_section.unshift(['head', 'Notes']);
        }
        row.workData.notes_section.push(['detail', noteLine.replace('Note added by ', '')]);
      }

      let statusChanged = false;
      if (newStatus
        && row.last_status?.toLowerCase() !== newStatus.toLowerCase()
        && typeStatusList.some(s => s.value.toLowerCase() === newStatus.toLowerCase())) {
        row.last_status = newStatus;
        row.workData.this_status = sentenceCase(newStatus);
        statusChanged = true;
      }

      if (woNumber && woNumber !== row.foreign_key) { row.foreign_key = woNumber; }
      const assignmentChanged = assigned_to && row.assigned_to !== assigned_to;
      if (assignmentChanged) { row.assigned_to = assigned_to; }

      row.last_update = now.timestamp;
      row.workData.update_date = now.relative;
      row.workData.checked = false;
      rowsToWrite.push({ row, statusChanged, assignmentChanged: !!assignmentChanged });
    }

    if (rowsToWrite.length > 0) {
      await updateServiceRequest(rowsToWrite.map(({ row }) => {
        const copy = { ...row }; delete copy.workData; return copy;
      }));
    }

    // Notify assignee
    for (const { row, assignmentChanged } of rowsToWrite) {
      if (!assignmentChanged || !assigned_to) { continue; }
      const req = row.current_request || row.original_request;
      let msgText = `A ${typeTitle} entered by ${row.workData.enteredBy_name} on ${row.workData.display_date} has been assigned to you.\r\n`;
      if (req && typeof req !== 'string') {
        if (req.selections?.length > 0) {
          msgText += `${row.workData.enteredBy_name.split(' ')[0]} selected ${listFromArray(req.selections)}.\r\n`;
        }
        for (const topic in (req.textInput || {})) {
          msgText += `${topic}: ${req.textInput[topic]}\r\n`;
        }
      }
      await sendMessages({
        client: session.client_id,
        author: session.user_id,
        messageText: msgText,
        thread_id: row.workData.thread_id,
        recipientList: assigned_to,
        subject: `${typeTitle} assigned to you`,
      });
    }

    // Notify requestors of status / note changes
    if (notify?.length > 0) {
      for (const { row, statusChanged, assignmentChanged } of rowsToWrite) {
        let notifyMsg = '';
        if (statusChangeText && statusChanged) {
          notifyMsg = `${currentUserName} updated your ${typeTitle} from ${row.workData.display_date}. They ${statusChangeText}.`;
        }
        if (assignedToName && assignmentChanged) {
          notifyMsg += notifyMsg
            ? ` It was assigned to ${assignedToName}.`
            : `${currentUserName} assigned your ${typeTitle} from ${row.workData.display_date} to ${assignedToName}.`;
        }
        if (enteredNote) {
          notifyMsg += notifyMsg
            ? ` They also added a note: "${enteredNote}".`
            : `${currentUserName} added a note to your ${typeTitle}: "${enteredNote}".`;
        }
        if (!notifyMsg) { continue; }
        const recipients = notify.filter(n => n === row.workData.enteredBy || n === row.requestor);
        if (recipients.length > 0) {
          await sendMessages({
            client: session.client_id,
            author: session.user_id,
            messageText: notifyMsg,
            thread_id: row.workData.thread_id,
            recipientList: recipients,
            subject: `Update to your ${typeTitle}`,
          });
        }
      }
    }

    // Clear stale activity logs so the next expand re-fetches from ServiceRequestLog
    rowsToWrite.forEach(({ row }) => { row.workData.activityLog = null; });
    updateReactData({ rows: [...reactData.rows] }, true);
  }

  // ── Print ─────────────────────────────────────────────────────────────────
  async function handlePrint() {
    const printList = reactData.rows.filter(r => r.workData.checked && isVisible(r));
    if (printList.length === 0) {
      enqueueSnackbar('No requests selected to print.', { variant: 'warning' });
      return;
    }
    const result = await printRequestsOnePerPage(printList, {
      client_id: session.client_id,
      client_name: session.client_name,
    });
    enqueueSnackbar(result.message, { variant: result.success ? 'success' : 'error' });
    if (result.success) {
      await handleUpdate({ newStatus: 'Printed' });
    }
  }

  // ── Send to TELS ──────────────────────────────────────────────────────────
  async function handleSendToTELS() {
    const userName = await makeName(session.user_id);
    for (let i = 0; i < reactData.rows.length; i++) {
      const row = reactData.rows[i];
      if (!row.workData.checked || !isVisible(row) || !row.workData.allowTELS) { continue; }
      if (row.foreign_key?.startsWith('TELS:')) {
        const existingWO = row.foreign_key.split('TELS:')[1].trim();
        if (existingWO) {
          enqueueSnackbar(`Already has TELS work order ${existingWO}`, { variant: 'warning' });
          continue;
        }
      }
      const now = makeDate(new Date());
      const summaryText = row.workData.summary_request
        .filter(l => l[0] !== 'head')
        .map(l => {
          if (l[0] === 'qa') {
            const { question, answers } = l[1];
            return answers?.length > 0 ? `${question} \u2014 ${answers.join(', ')}` : question;
          }
          return typeof l[1] === 'string' ? l[1] : '';
        })
        .filter(Boolean)
        .join('\n');
      const description = `On ${row.workData.display_date}, ${row.workData.requestor_name} said:\n${summaryText}`;
      const env = window.location.href.split('//')[1].charAt(0).toUpperCase();
      const facilityId = (env === 'D' && TELSfacilityID) ? TELSfacilityID : 138266;

      const response = await restAPI(
        { path: '/workOrders/v1/workOrders', method: 'POST' },
        {
          facilityId,
          title: `AVA Request #${row.local_key}`,
          description,
          priority: 2,
          requestedBy: row.workData.requestor_name,
          whereLocated: row.workData.requestor_location,
          categoryId: 1,
          customCategory: '',
          customArea: '',
          status: 1,
          hasPermissionToEnter: 1,
          comments: `${userName} used AVA to auto-generate this workorder on ${now.absolute}`,
        }
      );
      cl(response);
      const newWO = response.entityIdentifier;
      enqueueSnackbar(
        <div>AVA request sent to TELS!<br />Work order {newWO} created.</div>,
        { variant: 'success' }
      );

      row.foreign_key = `TELS: ${newWO}`;
      const histLine = `AVA request sent to TELS on ${now.absolute}, WO ${newWO} created`;
      if (Array.isArray(row.history)) { row.history.unshift(histLine); }
      else { row.history = [histLine]; }
      row.workData.historyList.unshift(histLine);
      row.workData.activityLog = null;  // clear so next expand re-fetches
      row.last_update = now.timestamp;
      row.workData.update_date = now.relative;
      row.workData.checked = false;

      await sendMessages({
        client: session.client_id,
        author: session.user_id,
        messageText: `Your ${typeTitle} from ${row.workData.display_date} was issued work order ${newWO} by ${userName}.`,
        thread_id: row.workData.thread_id,
        recipientList: row.workData.enteredBy,
        subject: `Update to your ${typeTitle}`,
      });

      const dbRow = { ...row }; delete dbRow.workData;
      await updateServiceRequest([dbRow]);
    }
    updateReactData({ rows: [...reactData.rows] }, true);
  }

  // ── Assignee choices (lazy loaded) ───────────────────────────────────────
  async function loadAssignChoices() {
    if (reactData.assignChoices.length > 0) { return; }
    const memberInfo = await getMemberList(options.allowAssign, session.client_id, { sort: true, exclude: false });
    const choices = memberInfo.peopleList.map(p => {
      const search = [
        Object.values(p.name), p.search_data, p.location,
        ...Object.values(p.messaging || {}),
      ].flat().join(' ');
      return `${p.name.last}, ${p.name.first}:${p.person_id}:${search}`;
    });
    updateReactData({ assignChoices: choices }, false);
  }

  // ── Helpers for selection ─────────────────────────────────────────────────
  function getSelectedRecipients() {
    const seen = {};
    reactData.rows.filter(r => r.workData.checked && isVisible(r)).forEach(r => {
      if (!seen[r.workData.enteredBy]) {
        seen[r.workData.enteredBy] = { label: r.workData.enteredBy_name, value: r.workData.enteredBy };
      }
      if (r.requestor !== r.workData.enteredBy && !seen[r.requestor]) {
        seen[r.requestor] = { label: r.on_behalf_of || r.workData.requestor_name, value: r.requestor };
      }
    });
    return Object.values(seen);
  }

  function getSelectedMessageTargets() {
    const selectedIDs = [];
    const selectedName = [];
    reactData.rows.forEach(r => {
      if (r.workData.checked && isVisible(r) && !selectedIDs.includes(r.requestor)) {
        selectedIDs.push(r.requestor);
        selectedName.push(r.workData.requestor_name);
      }
    });
    return { selectedIDs, selectedName };
  }

  // ── Background refresh ────────────────────────────────────────────────────
  async function backgroundRefresh() {
    if (!isMounted.current) { return; }
    const { rowIds, lastTimestamp } = refreshStateRef.current;
    if (!lastTimestamp) { return; }

    const qR = await dbClient
      .query({
        TableName: 'ServiceRequestLog',
        KeyConditionExpression: 'client_id = :c and log_time > :lt',
        ExpressionAttributeValues: { ':c': session.client_id, ':lt': lastTimestamp },
      })
      .promise()
      .catch(err => { cl('Background refresh error:', err); return null; });

    if (!recordExists(qR)) { return; }

    let newMaxTs = lastTimestamp;
    const newRows = [];

    for (const logEntry of qR.Items) {
      if (rowIds.includes(logEntry.request_id)) { continue; }
      const ts = Number(logEntry.request_id.split('~').pop());
      if (isNaN(ts)) { continue; }
      newMaxTs = Math.max(newMaxTs, ts);

      const [loaded] = await getServiceRequests({ client_id: session.client_id, request_id: logEntry.request_id });
      if (!loaded) { continue; }
      if (request.foreign_key && request.foreign_key !== loaded.foreign_key) { continue; }
      newRows.push(await buildRowData(loaded));
    }

    if (newRows.length > 0 && isMounted.current) {
      const updated = [...refreshStateRef.current.rows, ...newRows];
      updateReactData({
        rows: updated,
        rowIds: [...refreshStateRef.current.rowIds, ...newRows.map(r => r.request_id)],
        lastTimestamp: newMaxTs,
        statistics: computeStatistics(updated),
      }, true);
    }
  }

  // ── Initialize ────────────────────────────────────────────────────────────
  React.useEffect(() => {
    isMounted.current = true;

    async function initialize() {
      updateReactData({ loading: true }, true);

      if (request.assigned_to) {
        const name = await makeName(request.assigned_to);
        updateReactData({ selectedPersonName: `Requests assigned to ${name}` }, false);
      } else if (request.person_id) {
        const name = await makeName(request.person_id);
        const poss = `${name}${name.slice(-1) === 's' ? '' : 's'}`;
        updateReactData({ selectedPersonName: `${poss} Activity` }, false);
      }

      const query = {
        client_id: session.client_id,
        request_type: factName,
        sort: request.sort || 'desc',
      };
      if (request.person_id) { query.person_id = request.person_id; }
      if (request.assigned_to) { query.assigned_to = request.assigned_to; }
      if (request.foreign_key) { query.foreign_key = request.foreign_key; }

      const rawRows = await getServiceRequests(query);
      if (!isMounted.current) { return; }

      if (!rawRows || rawRows.length === 0) {
        enqueueSnackbar(`No ${typeTitle.toLowerCase()} requests found`, { variant: 'info' });
        updateReactData({ loading: false }, true);
        return;
      }

      // Load canonical question order from the Activity record for this request type.
      // activity_key is stored on each ServiceRequest record; grab it from the first one.
      const activityKey = rawRows.find(r => r.activity_key)?.activity_key;
      if (activityKey) {
        try {
          const activityDetail = await getActivityDetail({ activity_code: activityKey }, state);
          canonicalOrderRef.current = (activityDetail?.rows || [])
            .filter(r => typeof r === 'string' && !r.startsWith('~'))
            .map(r => {
              const colonIdx = r.indexOf(':');
              return (colonIdx !== -1 ? r.slice(colonIdx + 1) : r).trim().toLowerCase();
            })
            .filter(Boolean);
        } catch (e) {
          cl({ 'RequestDashboardV3: failed to load activity detail': e });
        }
      }

      const rows = [];
      const rowIds = [];
      let maxTs = 0;

      for (let i = 0; i < rawRows.length; i++) {
        if (!isMounted.current) { return; }
        const raw = rawRows[i];
        if (raw.request_id === `${raw.requestor}_checkout`) { continue; }
        if (raw.request_date > maxTs) { maxTs = raw.request_date; }

        rows.push(await buildRowData(raw));
        rowIds.push(raw.request_id);

        // Progressive render — show results as they arrive
        if (i % 5 === 4 && isMounted.current) {
          updateReactData({ rows: [...rows], rowIds: [...rowIds], loading: false }, true);
        }
      }

      if (!isMounted.current) { return; }

      updateReactData({
        rows: [...rows],
        rowIds: [...rowIds],
        lastTimestamp: maxTs,
        statistics: computeStatistics(rows),
        loading: false,
      }, true);

      if (options.idle_delay !== 0) {
        const intervalMs = (options.idle_delay || 5) * 60_000;
        refreshIntervalRef.current = setInterval(backgroundRefresh, intervalMs);
      }
    }

    initialize();

    return () => {
      isMounted.current = false;
      clearInterval(refreshIntervalRef.current);
      clearTimeout(filterTimeoutRef.current);
    };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (firstSelectedRef.current) {
      firstSelectedRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [anySelected]);

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderSectionLines(lines, keyPrefix) {
    return (lines || []).map((line, idx) => {
      const [type, payload] = line;
      if (type.startsWith('href=')) {
        return (
          <a key={`${keyPrefix}-${idx}`}
            href={type.split('=')[1]}
            target='_blank'
            rel='noopener noreferrer'
            style={{ color: 'inherit', textDecoration: 'underline' }}>
            <Typography className={classes.sectionDetail}>{`Attachment: ${payload}`}</Typography>
          </a>
        );
      }
      if (type === 'qa') {
        const { question, answers } = payload;
        const answerText = Array.isArray(answers) ? answers.join(', ') : (answers || '');
        return (
          <Box key={`${keyPrefix}-${idx}`}
            display='flex' flexDirection='row' flexWrap='wrap' alignItems='baseline'
            mb={0.25}>
            <Typography className={classes.qaQuestion}>{question}</Typography>
            {answerText && (
              <React.Fragment>
                <Typography className={classes.qaSep}>{'\u2014'}</Typography>
                <Typography className={classes.qaAnswer}>{answerText}</Typography>
              </React.Fragment>
            )}
          </Box>
        );
      }
      const classKey = `section${type.charAt(0).toUpperCase() + type.slice(1)}`;
      return (
        <Typography key={`${keyPrefix}-${idx}`} className={classes[classKey] || classes.sectionDetail}>
          {typeof payload === 'string' ? payload : ''}
        </Typography>
      );
    });
  }

  // ── Export helpers ────────────────────────────────────────────────────────

  function buildExportColumns(rowsToExport) {
    const qaQuestions = new Map(); // question -> first-seen order
    let hasDetail = false;
    let hasText = false;
    rowsToExport.forEach(row => {
      (row.workData?.summary_request || []).forEach(([type, value]) => {
        if (type === 'qa' && value && typeof value.question === 'string') {
          if (!qaQuestions.has(value.question)) {
            qaQuestions.set(value.question, qaQuestions.size);
          }
        }
        else if (type === 'detail') { hasDetail = true; }
        else if (type === 'text') { hasText = true; }
      });
    });
    const requestInfoColumns = [
      { key: 'request_id', label: 'Request ID' },
      { key: 'requestor_name', label: 'Requestor Name' },
      { key: 'requestor_address', label: 'Requestor Address' },
    ];
    const systemColumns = [
      { key: 'date_created', label: 'Date Created' },
      { key: 'date_last_action', label: 'Date Last Action' },
      { key: 'status', label: 'Status' },
      { key: 'assigned_to', label: 'Assigned To' },
      { key: 'priority', label: 'Priority' },
    ];
    const questionColumns = [];
    if (hasDetail || hasText) { questionColumns.push({ key: '__details__', label: 'Details' }); }
    qaQuestions.forEach((_, q) => questionColumns.push({ key: `__qa__${q}`, label: q }));
    return { requestInfoColumns, systemColumns, questionColumns };
  }

  function handleExportReport() {
    const rowsToExport = anySelected
      ? reactData.rows.filter(r => r.workData.checked && isVisible(r))
      : visibleRows;
    if (rowsToExport.length === 0) {
      enqueueSnackbar('No rows to export.', { variant: 'warning' });
      return;
    }
    const { requestInfoColumns, systemColumns, questionColumns } = buildExportColumns(rowsToExport);
    const allColumns = [
      ...requestInfoColumns.map(c => ({ ...c, checked: true })),
      ...systemColumns.map(c => ({ ...c, checked: true })),
      ...questionColumns.map(c => ({ ...c, checked: true })),
    ];
    updateReactData({
      showExportPicker: true,
      exportRowsToExport: rowsToExport,
      exportAvailableColumns: allColumns,
    }, true);
  }

  async function doExportToExcel() {
    const rows = reactData.exportRowsToExport;
    const selectedCols = reactData.exportAvailableColumns.filter(c => c.checked);
    const fixedHeaders = ['Requestor', 'Request Type'];
    const extraHeaders = selectedCols.map(c => c.label);
    const header = [...fixedHeaders, ...extraHeaders];
    const excelRows = [];
    for (const row of rows) {
      const fixed = [
        row.workData.requestor_name || '',
        row.workData.formatted_type || '',
      ];
      const extra = [];
      for (const col of selectedCols) {
        if (col.key === 'request_id') {
          extra.push(row.local_key || '');
        }
        else if (col.key === 'date_created') {
          extra.push(row.request_date ? makeDate(row.request_date).date : null);
        }
        else if (col.key === 'date_last_action') {
          extra.push(row.last_update ? makeDate(row.last_update).date : null);
        }
        else if (col.key === 'status') {
          extra.push(row.workData.this_status || sentenceCase(row.last_status || '') || '');
        }
        else if (col.key === 'assigned_to') {
          const name = (!row.assigned_to || row.assigned_to === 'unassigned')
            ? '' : (await makeName(row.assigned_to) || '');
          extra.push(name);
        }
        else if (col.key === 'priority') {
          extra.push(row.priority || '');
        }
        else if (col.key === 'requestor_name') {
          extra.push(row.workData.requestor_name || '');
        }
        else if (col.key === 'requestor_address') {
          extra.push(row.workData.requestor_address || '');
        }
        else if (col.key === '__details__') {
          const parts = (row.workData.summary_request || [])
            .filter(([type]) => type === 'detail' || type === 'text')
            .map(([, value]) => (typeof value === 'string' ? value : ''));
          extra.push(parts.join('; '));
        }
        else if (col.key.startsWith('__qa__')) {
          const question = col.key.substring('__qa__'.length);
          const found = (row.workData.summary_request || []).find(([type, value]) =>
            type === 'qa' && value && value.question === question
          );
          extra.push(found ? (found[1].answers || []).join(', ') : '');
        }
        else { extra.push(''); }
      }
      excelRows.push([...fixed, ...extra]);
    }
    const safeTitle = (pageTitle || 'requests').replace(/[^a-zA-Z0-9]/g, '_');
    downloadRowsAsXlsx({ header, rows: excelRows, fileName: `${safeTitle}_export.xlsx` });
    updateReactData({ showExportPicker: false }, true);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const pageTitle = reactData.selectedPersonName || typeTitle;
  const isLoaded = !reactData.loading;
  const hasStatusFilterConfig = !!(request.status || request.statusNot);
  const firstCheckedIndex = reactData.rows.findIndex(r => r.workData?.checked);

  return (
    <Dialog open fullScreen>
      <Box display='flex' flexDirection='column' height='100vh' overflow='hidden'>

        {/* ── Header ── */}
        <Box flexShrink={0} display='flex' flexDirection='column'>
          <Typography className={classes.title} style={AVATextStyle({ size: 2.2, bold: true })}>
            {pageTitle}
          </Typography>

          {!options.viewMode && (
            <Box display='flex' flexDirection='row' alignItems='flex-start' flexWrap='wrap'
              ml={2} mr={2} mt={1} mb={0.5}>

              {/* Search */}
              <Box display='flex' flexDirection='row' alignItems='center'
                border={1} borderColor='black' borderRadius='32px'
                pl={2} pr={2} pb={0.5} mr={2} mb={1} style={{ minWidth: '220px', flexShrink: 0 }}>
                <SearchIcon fontSize='small' />
                <TextField
                  className={classes.freeInput}
                  defaultValue={reactData.filterText}
                  onChange={e => {
                    clearTimeout(filterTimeoutRef.current);
                    const val = e.target.value;
                    filterTimeoutRef.current = setTimeout(() => {
                      updateReactData({ filterText: val.toLowerCase(), expandedRow: -1 }, true);
                    }, 400);
                  }}
                  placeholder='Search...'
                  variant='standard'
                  autoComplete='off'
                  inputProps={{ style: { fontSize: `${user_fontSize}rem` } }}
                />
              </Box>

              {/* Sort toggle */}
              <Box display='flex' flexDirection='row' alignItems='center' mr={2} mb={1}
                onClick={() => {
                  const next = reactData.sortOrder.startsWith('des') ? 'asc' : 'desc';
                  const getTs = r => r.workData?.orderForDate?.error
                    ? (r.request_date || 0)
                    : (r.workData?.orderForDate?.timeStamp || r.request_date || 0);
                  const sorted = [...reactData.rows].sort((a, b) =>
                    next === 'asc' ? getTs(a) - getTs(b) : getTs(b) - getTs(a)
                  );
                  updateReactData({ rows: sorted, sortOrder: next }, true);
                }}
                style={{ cursor: 'pointer' }}>
                <Typography style={AVATextStyle({ size: 0.85, bold: true })}>
                  {reactData.sortOrder.startsWith('des') ? 'Newest first' : 'Oldest first'}
                </Typography>
                <SwapVertIcon fontSize='small' style={{ marginLeft: 4 }} />
              </Box>

              {/* Status filter */}
              {hasStatusFilterConfig && (
                <Box display='flex' flexDirection='column'
                  border={1} borderColor='black' borderRadius='24px'
                  pl={2} pr={2} pb={1} mb={1}>
                  <Typography style={AVATextStyle({ size: 0.95, bold: true, margin: { top: 0.5, bottom: 0.25 } })}>
                    {'Filter by status'}
                  </Typography>
                  <Box display='flex' flexDirection='row' flexWrap='wrap'>
                    {typeStatusList.map((s, si) => (
                      <FormControlLabel key={`sf-${si}`}
                        className={classes.formControlLbl}
                        control={
                          <Checkbox disableRipple size='small'
                            className={classes.radioButton}
                            checked={!!reactData.statusFilter[s.value.toLowerCase()]}
                            onChange={() => {
                              const sf = { ...reactData.statusFilter };
                              sf[s.value.toLowerCase()] = !sf[s.value.toLowerCase()];
                              updateReactData({ statusFilter: sf }, true);
                            }}
                          />
                        }
                        label={<Typography className={classes.radioText}>{s.display}</Typography>}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* ── Body (scrollable) ── */}
        <Box flexGrow={1} overflow='auto'>

          {/* Loading spinner */}
          {reactData.loading && (
            <Box display='flex' flexDirection='column' alignItems='center' justifyContent='center' height='100%' pt={6}>
              <CircularProgress size={48} />
              <Typography style={AVATextStyle({ size: 1.1, margin: { top: 2 } })}>
                {`Loading ${typeTitle.toLowerCase()} requests...`}
              </Typography>
            </Box>
          )}

          {/* List view */}
          {isLoaded && reactData.view === 'list' && (
            <Paper component={Box} elevation={0} square pt={1} pb={2}>
              <List disablePadding>

                {visibleRows.length === 0 && (
                  <Box display='flex' justifyContent='center' pt={6}>
                    <Typography style={AVATextStyle({ size: 1.4, bold: true, align: 'center' })}>
                      {'No requests match your criteria'}
                    </Typography>
                  </Box>
                )}

                {reactData.rows.map((row, index) => {
                  if (!isVisible(row)) { return null; }
                  const isExpanded = reactData.expandedRow === index;
                  const isFirstSelected = firstCheckedIndex === index;
                  const statusColor = reactData.statistics?.color?.[row.last_status] || '#e0e0e0';

                  return (
                    <Paper
                      key={`row-${index}-${row.workData.checked}-${row.last_status}`}
                      component={Box}
                      variant='outlined'
                      ref={isFirstSelected ? firstSelectedRef : null}
                    >
                      <Box display='flex' flexDirection='column'
                        bgcolor={row.workData.checked ? '#fdf5e6' : undefined}
                        onContextMenu={e => {
                          e.preventDefault();
                          enqueueSnackbar(
                            <div>
                              Type: {row.request_type}<br />
                              Requestor: {row.requestor}<br />
                              Foreign Key: {row.foreign_key}<br />
                              Last Update: {makeDate(row.last_update).absolute}<br />
                              ID: {row.request_id}
                            </div>,
                            { variant: 'info', persist: true }
                          );
                        }}
                      >
                        <Box display='flex' flexDirection='row'
                          justifyContent='space-between' alignItems='flex-start'
                          pt={1} pb={1} pr={1}>

                          {/* Checkbox + avatar */}
                          <Box display='flex' flexDirection='row' alignItems='flex-start'
                            pl={options.noSelect ? 2 : 0} flexShrink={0}>
                            {!options.noSelect && (
                              <Checkbox
                                checked={row.workData.checked || false}
                                disableRipple size='small'
                                onClick={() => {
                                  row.workData.checked = !row.workData.checked;
                                  updateReactData({ rows: [...reactData.rows] }, true);
                                }}
                              />
                            )}
                            {!request.person_id && (
                              <Box component='img'
                                className={classes.imageArea}
                                border={1} alt=' '
                                src={row.workData.requestor_image}
                              />
                            )}
                          </Box>

                          {/* Main content */}
                          <Box flexGrow={1} display='flex' flexDirection='column' ml={1}
                            onClick={async () => {
                              const next = isExpanded ? -1 : index;
                              if (next !== -1 && !row.workData.activityLog) {
                                row.workData.activityLog = await getRequestLog(row.request_id);
                                updateReactData({ rows: [...reactData.rows] }, false);
                              }
                              updateReactData({ expandedRow: next }, true);
                            }}
                            style={{ cursor: 'pointer' }}>

                            {/* Name + status chip */}
                            <Box display='flex' flexDirection='row' alignItems='baseline' flexWrap='wrap' mb={0.25}>
                              {!request.person_id && (
                                <Typography className={classes.rowName}>
                                  {`${row.workData.requestor_name}${row.workData.requestor_location ? ` (${row.workData.requestor_location})` : ''}`}
                                </Typography>
                              )}
                              <Box component='span' className={classes.statusChip}
                                style={{ backgroundColor: statusColor }}>
                                {row.workData.this_status}
                              </Box>
                            </Box>

                            {/* Meta */}
                            <Typography className={classes.rowMeta}>{row.workData.display_date}</Typography>
                            {row.requestor !== row.workData.enteredBy && (
                              <Typography className={classes.rowMeta}>{`By ${row.workData.enteredBy_name}`}</Typography>
                            )}
                            {options.showForeignKey !== false && !row.workData.orderForDate?.error && (
                              <Typography className={classes.rowMeta}>{`For ${row.workData.orderForDate?.relative}`}</Typography>
                            )}

                            {/* Summary lines (always visible) */}
                            {renderSectionLines(row.workData.summary_request, `sum-${index}`)}

                            {/* Notes (always visible) */}
                            {row.workData.notes_section?.length > 0 && (
                              <Box mt={0.5}>
                                {renderSectionLines(row.workData.notes_section, `notes-${index}`)}
                              </Box>
                            )}

                            {/* Expanded detail */}
                            {isExpanded && (
                              <Box mt={1} mb={0.5}>
                                {row.workData.formatted_request?.some(l => l[0].startsWith('href=')) && (
                                  renderSectionLines(
                                    row.workData.formatted_request.filter(l => l[0].startsWith('href=')),
                                    `attach-${index}`
                                  )
                                )}
                                {row.workData.activityLog?.length > 0 && (
                                  <React.Fragment>
                                    <Typography className={classes.sectionHead}>{'Activity'}</Typography>
                                    {row.workData.activityLog.map((entry, ai) => {
                                      const entryDate = makeDate(entry.log_time);
                                      return (
                                        <Box key={`act-${index}-${ai}`} mt={0.5} ml={1}>
                                          <Typography className={classes.sectionDetail}>
                                            <strong>{entryDate.absolute}</strong>
                                            {` — ${entry.activity}`}
                                          </Typography>
                                          {entry.message_id && (
                                            <Typography className={classes.sectionDetail} style={{ fontStyle: 'italic', marginLeft: '8px' }}>
                                              {'✉️ Message sent'}
                                            </Typography>
                                          )}
                                        </Box>
                                      );
                                    })}
                                  </React.Fragment>
                                )}
                                {row.workData.activityLog?.length === 0 && (
                                  <Typography className={classes.sectionDetail}>{'No activity recorded'}</Typography>
                                )}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    </Paper>
                  );
                })}
              </List>
            </Paper>
          )}

          {/* Dashboard / stats view */}
          {isLoaded && reactData.view === 'dashboard' && reactData.statistics && (
            <Paper component={Box} elevation={0} square pt={2} pb={2}>
              <List disablePadding>
                {typeStatusList.map((s, si) => {
                  const stats = reactData.statistics;
                  const cnt = stats.count[s.value];
                  if (!cnt) { return null; }
                  const bg = stats.color[s.value] || '#a7d2f8';
                  const word = stats.valueWord[s.value] || '';
                  const avgOpen = stats.avgOpenTime[s.value];
                  const avgIdle = stats.avgIdleTime?.[s.value];
                  const isOpen = stats.openClosed[s.value] === 'open';
                  const oldest = stats.oldestRequests[s.value]?.[0]?.age;
                  return (
                    <Paper component={Box} elevation={0} key={`ds-${si}`}>
                      <Box display='flex' flexDirection='column'
                        ml={2} mb={1.5} p={2}
                        borderRadius='32px' border={1} borderColor='black'
                        style={{ backgroundColor: bg }}>
                        <Box display='flex' flexDirection='row' width='100%'
                          justifyContent='space-between' alignItems='center'>
                          <Box>
                            <Typography style={AVATextStyle({ size: 1.4, bold: true })}>{s.display}</Typography>
                            <Typography style={AVATextStyle({ size: 1, margin: { left: 1 } })}>{`Count: ${cnt}`}</Typography>
                            <Typography style={AVATextStyle({ size: 1, margin: { left: 1 } })}>
                              {`Avg ${isOpen ? 'Age' : 'Days to Close'}: ${avgOpen?.toFixed(1)} days`}
                            </Typography>
                            {isOpen && (
                              <React.Fragment>
                                {avgIdle !== undefined && (
                                  <Typography style={AVATextStyle({ size: 1, margin: { left: 1 } })}>
                                    {`Avg Time Since Last Activity: ${avgIdle?.toFixed(1)} days`}
                                  </Typography>
                                )}
                                {oldest !== undefined && (
                                  <Typography style={AVATextStyle({ size: 1, margin: { left: 1 } })}>
                                    {`Oldest Request: ${oldest?.toFixed(1)} days`}
                                  </Typography>
                                )}
                              </React.Fragment>
                            )}
                          </Box>
                          <Typography style={AVATextStyle({ size: 3.5, align: 'right', margin: { right: 1 } })}>
                            {word}
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  );
                })}
              </List>
            </Paper>
          )}
        </Box>

        {/* ── Action buttons ── */}
        {isLoaded && !options.viewMode && (
          <DialogActions className={classes.buttonArea}>
            <Box display='flex' flexDirection='column'>

              {/* Row 1: navigation + selection management */}
              <Box display='flex' flexDirection='row' flexWrap='wrap' justifyContent='center'>
                <Button className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'red', color: 'white' }}
                  size='small' onClick={onClose} startIcon={<CloseIcon />}>
                  {reactData.isMobile ? 'Exit' : 'Close'}
                </Button>

                {options.allowDashboard && reactData.statistics && (
                  <Button className={AVAClass.AVAButton}
                    style={{ backgroundColor: '#6a0dad', color: 'white' }}
                    size='small'
                    onClick={() => updateReactData({ view: reactData.view === 'dashboard' ? 'list' : 'dashboard' }, true)}
                    startIcon={reactData.view === 'dashboard' ? <ListIcon /> : <DashboardIcon />}>
                    {reactData.view === 'dashboard' ? 'List' : 'Dashboard'}
                  </Button>
                )}

                {visibleRows.length > 0 && (
                  <React.Fragment>
                    {anySelected && (
                      <Button className={AVAClass.AVAButton}
                        style={{ backgroundColor: '#ffc0cb', color: 'black' }}
                        size='small'
                        onClick={() => {
                          reactData.rows.forEach(r => { if (isVisible(r)) { r.workData.checked = false; } });
                          updateReactData({ rows: [...reactData.rows] }, true);
                        }}
                        startIcon={<ClearAllIcon />}>
                        {'None'}
                      </Button>
                    )}

                    {!options.noSelect && (
                      <Button className={AVAClass.AVAButton}
                        style={allSelected
                          ? { backgroundColor: 'white', color: 'green', border: '2px solid green' }
                          : { backgroundColor: 'green', color: 'white' }}
                        size='small'
                        onClick={() => {
                          reactData.rows.forEach(r => { if (isVisible(r)) { r.workData.checked = true; } });
                          updateReactData({ rows: [...reactData.rows] }, true);
                        }}
                        startIcon={<DoneAllIcon />}>
                        {`All ${visibleRows.length}`}
                      </Button>
                    )}

                    {!options.noSelect && (
                      <Button className={AVAClass.AVAButton}
                        style={{ backgroundColor: '#ffc0cb', color: 'black' }}
                        size='small'
                        onClick={() => { handleExportReport(); }}
                        startIcon={<SaveAltIcon />}>
                        {'Export Report'}
                      </Button>
                    )}
                  </React.Fragment>
                )}
              </Box>

              {/* Row 2: actions on selected rows */}
              {anySelected && (
                <Box display='flex' flexDirection='row' flexWrap='wrap' justifyContent='center'>
                  {!request.person_id && (
                    <Button className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'orange', color: 'black' }}
                      size='small'
                      onClick={() => updateReactData({ showMessage: getSelectedMessageTargets() }, true)}
                      startIcon={<SendIcon />}>
                      {reactData.isMobile ? null : 'Message'}
                    </Button>
                  )}

                  {options.allowAssign && (
                    <Button className={AVAClass.AVAButton}
                      style={{ backgroundColor: '#008080', color: 'white' }}
                      size='small'
                      onClick={async () => {
                        await loadAssignChoices();
                        updateReactData({ showAssign: true }, true);
                      }}
                      startIcon={<PersonAddIcon />}>
                      {'Assign'}
                    </Button>
                  )}

                  <Button className={AVAClass.AVAButton}
                    style={{ backgroundColor: '#5c3317', color: 'white' }}
                    size='small'
                    onClick={() => updateReactData({ showUpdateForm: true }, true)}
                    startIcon={<CheckIcon />}>
                    {'Update'}
                  </Button>

                  <Button className={AVAClass.AVAButton}
                    style={{ backgroundColor: '#003399', color: 'white' }}
                    size='small'
                    onClick={handlePrint}
                    startIcon={<PrintIcon />}>
                    {reactData.isMobile ? null : 'Print'}
                  </Button>

                  {anyTELS && (
                    <Button className={AVAClass.AVAButton}
                      style={{ backgroundColor: '#006400', color: 'white' }}
                      size='small'
                      onClick={handleSendToTELS}
                      startIcon={<SaveAltIcon />}>
                      {'Send to TELS'}
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </DialogActions>
        )}

        {isLoaded && options.viewMode && (
          <DialogActions className={classes.buttonArea}>
            <Button className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={() => onClose('exit')}
              startIcon={<CloseIcon />}>
              {reactData.isMobile ? 'Exit' : 'Close'}
            </Button>
          </DialogActions>
        )}
      </Box>

      {/* ── Overlay: messaging ── */}
      {reactData.showMessage && (
        <MakeMessage
          titleText={null}
          promptText={['What should your message say?']}
          promptUse={['message']}
          buttonText={'Send'}
          sender={{
            client_id: session.client_id,
            patient_id: session.user_id,
            patient_display_name: session.user_display_name,
          }}
          pRecipientID={reactData.showMessage.selectedIDs}
          pRecipientName={reactData.showMessage.selectedName}
          allowCancel
          setMethod={null}
          onCancel={() => updateReactData({ showMessage: null }, true)}
          onComplete={() => updateReactData({ showMessage: null }, true)}
        />
      )}

      {reactData.showExportPicker &&
        <Dialog open={true} fullWidth maxWidth='sm'>
          <DialogTitle>{'Choose fields to include in the export'}</DialogTitle>
          <DialogContent>
            {(() => {
              const requestInfoKeys = ['request_id', 'requestor_name', 'requestor_address'];
              const systemKeys = ['date_created', 'date_last_action', 'status', 'assigned_to', 'priority'];
              const requestInfoCols = reactData.exportAvailableColumns.filter(c => requestInfoKeys.includes(c.key));
              const systemCols = reactData.exportAvailableColumns.filter(c => systemKeys.includes(c.key));
              const questionCols = reactData.exportAvailableColumns.filter(c =>
                !requestInfoKeys.includes(c.key) && !systemKeys.includes(c.key)
              );
              return (
                <Box>
                  {requestInfoCols.length > 0 && (
                    <Box mb={1}>
                      <Typography variant='subtitle1' style={{ fontWeight: 'bold' }}>{'Request Information'}</Typography>
                      {requestInfoCols.map(col => (
                        <FormControlLabel
                          key={col.key}
                          control={
                            <Checkbox
                              checked={col.checked}
                              onChange={e => {
                                const updated = reactData.exportAvailableColumns.map(c =>
                                  c.key === col.key ? { ...c, checked: e.target.checked } : c
                                );
                                updateReactData({ exportAvailableColumns: updated }, true);
                              }}
                              size='small'
                            />
                          }
                          label={col.label}
                        />
                      ))}
                    </Box>
                  )}
                  {systemCols.length > 0 && (
                    <Box mb={1}>
                      <Typography variant='subtitle1' style={{ fontWeight: 'bold' }}>{'Additional Information'}</Typography>
                      {systemCols.map(col => (
                        <FormControlLabel
                          key={col.key}
                          control={
                            <Checkbox
                              checked={col.checked}
                              onChange={e => {
                                const updated = reactData.exportAvailableColumns.map(c =>
                                  c.key === col.key ? { ...c, checked: e.target.checked } : c
                                );
                                updateReactData({ exportAvailableColumns: updated }, true);
                              }}
                              size='small'
                            />
                          }
                          label={col.label}
                        />
                      ))}
                    </Box>
                  )}
                  {questionCols.length > 0 && (
                    <Box mt={1}>
                      <Typography variant='subtitle1' style={{ fontWeight: 'bold' }}>{'Form Questions'}</Typography>
                      {questionCols.map(col => (
                        <FormControlLabel
                          key={col.key}
                          control={
                            <Checkbox
                              checked={col.checked}
                              onChange={e => {
                                const updated = reactData.exportAvailableColumns.map(c =>
                                  c.key === col.key ? { ...c, checked: e.target.checked } : c
                                );
                                updateReactData({ exportAvailableColumns: updated }, true);
                              }}
                              size='small'
                            />
                          }
                          label={col.label}
                        />
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })()}
          </DialogContent>
          <DialogActions>
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'green', color: 'white' }}
              size='small'
              onClick={() => { doExportToExcel(); }}
              startIcon={<SaveAltIcon />}>
              {'Download Excel'}
            </Button>
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={() => { updateReactData({ showExportPicker: false }, true); }}>
              {'Cancel'}
            </Button>
          </DialogActions>
        </Dialog>
      }

      {/* ── Overlay: assign ── */}
      {reactData.showAssign && (
        <PersonFilter
          prompt={'Assign to whom?'}
          peopleList={reactData.assignChoices}
          multiSelect={false}
          onCancel={() => updateReactData({ showAssign: false }, true)}
          onSelect={async personEntry => {
            const person_id = personEntry.split(/:|%%/)[1];
            await handleUpdate({ newStatus: 'Assigned', assigned_to: person_id });
            updateReactData({ showAssign: false }, true);
          }}
        />
      )}

      {/* ── Overlay: update status / notes ── */}
      {reactData.showUpdateForm && (
        <AVATextInput
          titleText={'Update Selected'}
          promptText={[
            ...(options.woNumber ? ['WO Number'] : []),
            '[select]Status',
            'Notes',
            '[selectmulti]Notify',
          ]}
          valueText={[
            ...(options.woNumber
              ? [reactData.rows.find(r => r.workData.checked && isVisible(r))?.foreign_key || '']
              : []),
            '', '', '',
          ]}
          selectionList={[
            ...(options.woNumber ? [null] : []),
            typeStatusList.filter(s => !s.hasOwnProperty('selectable') || s.selectable),
            null,
            getSelectedRecipients(),
          ]}
          buttonText={'Update'}
          onCancel={() => updateReactData({ showUpdateForm: false }, true)}
          onSave={async response => {
            const offset = options.woNumber ? 1 : 0;
            await handleUpdate({
              woNumber: options.woNumber ? response[0] : null,
              newStatus: response[offset],
              enteredNote: response[offset + 1],
              notify: response[offset + 2],
            });
            updateReactData({ showUpdateForm: false }, true);
          }}
        />
      )}
    </Dialog>
  );
}
