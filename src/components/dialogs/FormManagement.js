import React from 'react';

import useSession from '../../hooks/useSession';

import { getMemberList } from '../../util/AVAGroups';
import { dbClient, recordExists, cl, titleCase, getDb, putDb, deepCopy } from '../../util/AVAUtilities';
import QuickSearch from '../sections/QuickSearch';
import { getPerson, getImage } from '../../util/AVAPeople';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import { addDays, makeDate, makeTime } from '../../util/AVADateTime';
import FormFillB from '../forms/FormFillB';
import { createDocument } from '../../util/AVADocuments';
import AVAUploadFile from '../../util/AVAUploadFile';
import FormEditor from '../forms/FormEditor';

import { Snackbar, Paper, Box, Dialog, DialogActions, DialogContent, DialogContentText, Button, Typography, Checkbox, FormControlLabel } from '@material-ui/core';
import Select from "react-dropdown-select";
import { Alert, AlertTitle } from '@material-ui/lab/';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import CloseIcon from '@material-ui/icons/ExitToApp';
import PeopleIcon from '@material-ui/icons/People';
import SettingsIcon from '@material-ui/icons/Settings';
import SendIcon from '@material-ui/icons/Send';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import SwapVertIcon from '@material-ui/icons/SwapVert';
import EditIcon from '@material-ui/icons/Edit';
import VisibilityIcon from '@material-ui/icons/Visibility';
import LockIcon from '@material-ui/icons/Lock';
import GetAppIcon from '@material-ui/icons/GetApp';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import MessageForm from '../forms/MessageForm';

const useStyles = makeStyles(theme => ({
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  },
  myImageArea: {
    minWidth: '50px',
    maxWidth: '50px',
    minHeight: '50px',
    maxHeight: '50px',
    marginRight: theme.spacing(1),
    borderRadius: '25px'
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
    flexDirection: 'column'
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
  paperPallette: {
    borderRadius: '30px 30px 30px 30px',
    width: '95%',
    height: '100%',
    overflow: 'hidden'
  },
  dragNamesFirst: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: '3px',
    marginBottom: '-10px'
  },
  dragNamesLast: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: '3px',
    fontWeight: 'bold',
    marginBottom: '-10px'
  },
  assignment_avatar: {
    marginTop: 0,
    marginBottom: 0,
    height: 40,
    width: 40,
    paddingTop: 0,
    fontSize: '1.2rem',
  },
  title: {
    marginTop: theme.spacing(3),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    marginBottom: 0,
    fontSize: '1.3rem',
  },
  listItemAVA: {
    fontSize: theme.typography.fontSize * 1.5,
  },
  noDisplay: {
    display: 'none',
    visibility: 'hidden'
  },
  filterSelect: {
    color: '#111111',
    '& .react-dropdown-select-content': {
      color: '#111111'
    },
    '& .react-dropdown-select-input': {
      color: '#111111'
    },
    '& .react-dropdown-select-dropdown': {
      backgroundColor: '#ffffff',
      color: '#111111'
    },
    '& .react-dropdown-select-item': {
      color: '#111111'
    },
    '& .react-dropdown-select-item-selected': {
      backgroundColor: '#e6f0ff',
      color: '#111111'
    }
  },
}));

export default ({ defaults, onClose }) => {

  const { state } = useSession();

  const [reactData, setReactData] = React.useState({
    alert: false,
    window_width: 1,
    administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),

    // from defaults

    activity_filter: '',
    lower_activity_filter: null,
    filterComplete: false,
    filterNotStarted: false,
    filterInProcess: false,
    default_filters: [{
      value: '',
      label: 'Show All'
    },
    {
      value: 'completed',
      label: 'Complete'
    },
    {
      value: 'in_process',
      label: 'In Process'
    },
    {
      value: 'pending',
      label: 'Pending'
    },
    {
      value: 'not started',
      label: 'Not Started'
    }],
    anchorEl: null,
    building: 'not started',
    defaults,
    denseView: false,
    display_name: state.patient?.name?.first || 'My',
    event_being_edited: false,
    isDarkMode: useMediaQuery('(prefers-color-scheme: dark)'),
    isEditing: false,
    isUploading: false,
    loading: false,
    masterFormList: {},
    masterPeopleList: {},
    maxPeopleToRender: 100, // Virtual scrolling: only render first 100 people initially
    needRef: false,
    newGroups: {},
    popUpOpen: false,
    progressMessage: 'Building Group List',
    pWidth: 60,
    rowLimit: 21,
    selectDate: null,
    selectedPerson_id: null,
    selectedPersonRec: false,
    selectedPersonFirstName: '',
    selectedPersonLastName: '',
    showCategoryHeaders: false,
    showGroupSelect: false,
    showQuickSearch: false,
    selectedGroup_id: null,
    selectedGroupRec: false,
    selectedGroupMembers: false,
    updatesMade: false,
    viewPeopleMaintenance: false
  });
  const [refreshTrigger, setRefreshTrigger] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setRefreshTrigger(refreshTrigger => !refreshTrigger); }
  };


  function handleResize() {
    updateReactData({
      window_width: Math.min(((window.window.innerWidth - 220) / 1400), 1),
    }, true);
  }

  const handleDragStart = (ev, id) => {
    ev.dataTransfer.setData('id', JSON.stringify(id));
  };

  const handleDragOver = (ev) => {
    ev.preventDefault();
  };

  const placeholderImage =
    'https://theseus-medical-storage.s3.amazonaws.com/public/patients/ademo.jpg';

  const onImageError = (e) => {
    e.target.src = placeholderImage;
  };

  // const autoFocus = (element) => element?.focus();

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const handleChangeActivityFilter = selectedValue => {
    let lower = selectedValue.value.toLowerCase();
    updateReactData({
      activity_filter: selectedValue.label,
      lower_activity_filter: lower,
      filterComplete: lower.includes('complete'),
      filterNotStarted: lower.includes('not start'),
      filterInProcess: lower.includes('process'),
      filterPending: lower.includes('pending')
    }, true);

    // Recompute filtered list for current form if one is selected
    if (reactData.selectedForm_id) {
      applyFilterToForm(reactData.selectedForm_id, {
        filterComplete: lower.includes('complete'),
        filterNotStarted: lower.includes('not start'),
        filterInProcess: lower.includes('process'),
        filterPending: lower.includes('pending')
      });
    }
  };

  function applyFilterToForm(form_id, filters = null) {
    // Use provided filters or current reactData filters
    const activeFilters = filters || {
      filterComplete: reactData.filterComplete,
      filterNotStarted: reactData.filterNotStarted,
      filterInProcess: reactData.filterInProcess,
      filterPending: reactData.filterPending
    };

    if (!reactData.masterFormList[form_id]?.sortedMemberIds) {
      return;
    }

    // If no filter is active, show all people
    const hasActiveFilter = activeFilters.filterComplete || activeFilters.filterNotStarted ||
      activeFilters.filterInProcess || activeFilters.filterPending;

    if (!hasActiveFilter) {
      reactData.masterFormList[form_id].filteredMemberIds = reactData.masterFormList[form_id].sortedMemberIds;
      return;
    }

    // Filter based on overall_status
    reactData.masterFormList[form_id].filteredMemberIds = reactData.masterFormList[form_id].sortedMemberIds.filter(person_id => {
      const personData = reactData.masterFormList[form_id].memberList[person_id];
      const status = personData.overall_status || 'not_started';

      if (activeFilters.filterComplete && status.startsWith('complete')) { return true; }
      if (activeFilters.filterInProcess && status === 'in_process') return true;
      if (activeFilters.filterPending && status === 'pending') return true;
      if (activeFilters.filterNotStarted && status === 'not_started') return true;

      return false;
    });

    // Now re-sort the memberList by last_update descending (most recent at the top)
    // sortfilteredIds(form_id, reactData.activity_sort_order);
    reactData.masterFormList[form_id].filteredMemberIds.sort((a, b) => {
      return (reactData.masterPeopleList[a]?.[form_id]?.last_update > reactData.masterPeopleList[b]?.[form_id]?.last_update ? -1 : 1);
    });

    return;
  }

  function sortfilteredIds(form_id, direction = 'desc') {
    if (direction === 'desc') {
      reactData.masterFormList[form_id].filteredMemberIds.sort((a, b) => {
        return (reactData.masterPeopleList[a]?.[form_id]?.last_update > reactData.masterPeopleList[b]?.[form_id]?.last_update ? -1 : 1);
      });
    }
    else {
      reactData.masterFormList[form_id].filteredMemberIds.sort((a, b) => {
        return (reactData.masterPeopleList[a]?.[form_id]?.last_update > reactData.masterPeopleList[b]?.[form_id]?.last_update ? 1 : -1);
      });
    }
    updateReactData({
      activity_sort_order: direction
    }, true);
  }

  function csvSafe(value) {
    if ((value === null) || (value === undefined)) {
      return '';
    }
    const stringValue = `${value}`.replace(/"/g, '""');
    return `"${stringValue}"`;
  }

  function downloadCurrentPeopleListCsv() {
    if (!reactData.selectedForm_id) {
      return;
    }

    const selectedForm = reactData.masterFormList?.[reactData.selectedForm_id];
    const filteredMemberIds = selectedForm?.filteredMemberIds || [];

    if (filteredMemberIds.length === 0) {
      updateReactData({
        alert: {
          severity: 'info',
          title: 'No people to export',
          message: 'There are no people in the current list to export.'
        }
      }, true);
      return;
    }

    const header = ['Name', 'Person ID', 'Status'];
    const rows = filteredMemberIds.map(person_id => {
      const memberData = selectedForm?.memberList?.[person_id] || {};
      const personName = memberData.person_name || makeName(person_id).display;
      const status = reactData.masterPeopleList?.[person_id]?.[reactData.selectedForm_id]?.status || 'not_started';

      return [personName, person_id, status];
    });

    const csvContent = [header, ...rows]
      .map(row => row.map(csvSafe).join(','))
      .join('\n');

    const safeFormName = (selectedForm?.form_name || reactData.selectedForm_id)
      .replace(/[^a-z0-9]+/gi, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    const fileName = `${safeFormName || 'form'}_people_list.csv`;

    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const csvUrl = URL.createObjectURL(csvBlob);
    const downloadLink = document.createElement('a');
    downloadLink.href = csvUrl;
    downloadLink.setAttribute('download', fileName);
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(csvUrl);
  }

  function OKtoShow(this_person, this_form, display_data) {
    if (!reactData.lower_activity_filter) { return true; }
    if (reactData.masterFormList?.[this_form]?.memberList?.[this_person].dated_docs) {
      if (reactData.masterFormList?.[this_form]?.memberList?.[this_person].dated_status) {
        if (reactData.filterComplete) {
          return (reactData.masterFormList?.[this_form]?.memberList?.[this_person].dated_status.complete || false);
        }
        else if (reactData.filterInProcess) {
          return (reactData.masterFormList?.[this_form]?.memberList?.[this_person].dated_status.in_process || false);
        }
        else if (reactData.filterPending) {
          return (reactData.masterFormList?.[this_form]?.memberList?.[this_person].dated_status.pending || false);
        }
        else if (reactData.filterNotStarted) {
          return (reactData.masterFormList?.[this_form]?.memberList?.[this_person].dated_status.not_started || false);
        }
      }
      // if there is no dated_status for a dated_doc, assume that it is "not started"
      else if (reactData.filterNotStarted) {
        return true;
      }
      else {
        if ((reactData.filterComplete) || (reactData.filterInProcess) || (reactData.filterPending)) {
          return false;
        }
      }
    }
    else if (reactData.masterPeopleList[this_person]?.[this_form]?.status) {
      if (reactData.filterComplete) {
        return (reactData.masterPeopleList[this_person]?.[this_form]?.status.startsWith('complete'));
      }
      else if (reactData.filterInProcess) {
        return (reactData.masterPeopleList[this_person]?.[this_form]?.status === 'in_process');
      }
      else if (reactData.filterPending) {
        return (reactData.masterPeopleList[this_person]?.[this_form]?.status === 'pending');
      }
      else if (reactData.filterNotStarted) {
        return (!reactData.masterPeopleList[this_person].hasOwnProperty(this_form)
          || (reactData.masterPeopleList[this_person]?.[this_form]?.status === 'not started'));
      }
    }
    return (display_data.toLowerCase().includes(reactData.lower_activity_filter));
  };

  async function personForms(this_person) {
    reactData.masterPeopleList[this_person] = {};
    for (let this_form in reactData.masterFormList) {
      if (reactData.masterFormList[this_form].hasOwnProperty('groupList') &&
        reactData.masterFormList[this_form].groupList.some(g => { return reactData.selectedPersonRec.groups.includes(g); })) {
        reactData.masterPeopleList[this_person][this_form] = {
          status: 'not_started',
          last_update: 0
        };
        if (!reactData.masterFormList[this_form].hasOwnProperty('memberList')) {
          reactData.masterFormList[this_form].memberList = {};
        }
        reactData.masterFormList[this_form].memberList[this_person] = {
          person_id: reactData.selectedPerson_id,
          person_name: `${reactData.selectedPersonRec.name.first} ${reactData.selectedPersonRec.name.last}`,
          person_first: reactData.selectedPersonRec.name.first,
          person_last: reactData.selectedPersonRec.name.last,
          sort_order: state.session.client_style.sort_order === 'last_first' ?
            `${reactData.selectedPersonRec.name.last}, ${reactData.selectedPersonRec.name.first}` :
            `${reactData.selectedPersonRec.name.first} ${reactData.selectedPersonRec.name.last}`,
          wipDocs: [],
          dated_docs: false,
          dated_status: {},
          assignedDocs: [],
          completedDocs: [],
        };
      }
    }
    // get all Documents for this person
    let allDocs = await dbClient
      .query({
        KeyConditionExpression: 'pertains_to = :p',
        IndexName: 'person_form-index',
        TableName: 'DocumentMaster',
        ExpressionAttributeValues: {
          ':p': this_person
        }
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          cl(`Security Violation or no Internet Connection`);
        }
        cl(`Error reading CompletedDocuments; error is ${error}`);
      });
    if (recordExists(allDocs)) {
      for (const this_doc of allDocs.Items) {
        await buildMasters(this_doc);
      }
    }
    updateReactData({
      masterPeopleList: reactData.masterPeopleList,
      masterFormList: reactData.masterFormList
    }, true);
  }

  function makeName(person_id) {
    let peopleList = state.accessList?.[state.session.client_id].list;
    let foundPerson = peopleList?.find(p => p.person_id === person_id);
    if (foundPerson) {
      return {
        found: true,
        first: foundPerson.name.first,
        last: foundPerson.name.last,
        display: `${foundPerson.name.first} ${foundPerson.name.last}`,
        sort: state.session.client_style.sort_order === 'last_first' ?
          `${foundPerson.name.last}, ${foundPerson.name.first}` :
          `${foundPerson.name.first} ${foundPerson.name.last}`
      };
    }
    else {
      return {
        found: false,
        first: person_id,
        last: state.session.client_id,
        display: person_id,
        sort: `ZZZ_${person_id}`
      };
    }
  }

  async function buildMasters(this_doc, eventCache = {}) {
    if ((this_doc.restricted_access === 'admin_only') && (!reactData.administrative_account)) {
      return;    // skip this document
    }
    if (!reactData.masterFormList.hasOwnProperty(this_doc.form_type)) {
      reactData.masterFormList[this_doc.form_type] = { memberList: {} };
    }
    else if (!reactData.masterFormList[this_doc.form_type].hasOwnProperty('memberList')) {
      reactData.masterFormList[this_doc.form_type].memberList = {};
    }
    if (!reactData.masterFormList[this_doc.form_type].memberList.hasOwnProperty(this_doc.pertains_to)) {
      let personName = makeName(this_doc.pertains_to);
      if (personName.found) {
        reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to] = {
          person_id: this_doc.pertains_to,
          person_name: personName.display,
          person_first: personName.first,
          person_last: personName.last,
          sort_order: personName.sort,
          wipDocs: [],
          assignedDocs: [],
          dated_docs: false,
          dated_status: {},
          completedDocs: [],
        };
      }
      else {
        return;
      }
    };
    if (!reactData.masterPeopleList.hasOwnProperty(this_doc.pertains_to)) {
      reactData.masterPeopleList[this_doc.pertains_to] = {};
    }
    if (!Array.isArray(this_doc.history)) {
      this_doc.history = [{ last_update: 0 }];
    }
    if (this_doc.history[0].last_update === 0) {
      let splitter = this_doc.document_id.split('#');
      this_doc.history[0].last_update = splitter[splitter.length - 1];
    }
    if (reactData.masterFormList[this_doc.form_type].dated_docs) {
      // get the event
      if (!this_doc.event_id) {
        if (!this_doc.event_key) {
          return;
        }
        this_doc.event_id = this_doc.event_key.split(/#|%/)[0];
      }

      // Check cache first to avoid duplicate DB calls
      let eventRec = eventCache[this_doc.event_id];
      if (!eventRec) {
        eventRec = await dbClient
          .get({
            Key: {
              client: state.session.client_id,
              event_key: this_doc.event_id
            },
            TableName: "Calendar"
          })
          .promise()
          .catch(error => {
            cl(`in buildMasters, bad get to Calendar with ${this_doc.event_id}. Error is: ${error}`);
          });

        // Cache the result for future use
        if (recordExists(eventRec)) {
          eventCache[this_doc.event_id] = eventRec;
        }
      }

      if (!recordExists(eventRec)) {
        return;
      }
      let eventTime = '';
      if (eventRec.Item.eventData.event_data.time.allDay) {
        // no op
      }
      else {
        let timeObj = makeTime(eventRec.Item.eventData.event_data.time.from);
        if (!timeObj.error) {
          eventTime = ` - ${timeObj.time}`;
        }
      }
      let eventDate = makeDate(this_doc.event_key ? this_doc.event_key.split('#')[1] : null);
      if (!eventDate.error) {
        reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].assignedDocs.push({
          document_id: this_doc.document_id,
          last_update: this_doc.history[0].last_update,
          due_date: this_doc.due_date || reactData.masterFormList[this_doc.form_type].dueDate,
          title: this_doc.title,
          event_date: eventDate.numeric,
          event_displayDate: eventDate.dateOnly,
          event_time: eventTime,
          event_key: this_doc.event_key,
          location: this_doc.history[0].url,
          status: this_doc.status,
          formLocked: this_doc.formLocked || false
        });
        reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].dated_docs = true;
        reactData.masterFormList[this_doc.form_type].dated_docs = true;
        if (!reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].dated_status) {
          reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].dated_status = {};
        }
        switch (this_doc.status) {
          case 'complete':
          case 'completed': {
            reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].dated_status.complete = true;
            break;
          }
          case 'in_process': {
            reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].dated_status.in_process = true;
            break;
          }
          case 'pending': {
            reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].dated_status.pending = true;
            break;
          }
          default: {
            reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].dated_status.not_started = true;
          }
        }
      }
    }
    if (this_doc.status.startsWith('complete')) {
      const completed_count = reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].completedDocs.length;
      const cObj = {
        document_id: this_doc.document_id,
        location: this_doc.history[0].url,
        last_update: this_doc.history[0].last_update,
        date_completed: makeDate(this_doc.history[0].last_update).relative,
        title: this_doc.title,
        amendments: this_doc.amendments,
        formLocked: this_doc.formLocked || false
      };
      if ((completed_count === 0) || (this_doc.history[0].last_update > reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].completedDocs[0].last_update)) {
        reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].completedDocs.unshift(cObj);
        if (!reactData.masterPeopleList[this_doc.pertains_to].hasOwnProperty(this_doc.form_type) || (this_doc.history[0].last_update > reactData.masterPeopleList[this_doc.pertains_to][this_doc.form_type].last_update)) {
          reactData.masterPeopleList[this_doc.pertains_to][this_doc.form_type] = {
            status: 'completed',
            last_update: this_doc.history[0].last_update
          };
        }
      }
      else if (this_doc.history[0].last_update < reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].completedDocs[completed_count - 1].last_update) {
        reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].completedDocs.push(cObj);
      }
      else {
        const foundAt = reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].completedDocs.findIndex(d => {
          return (d.last_update < this_doc.history[0].last_update);
        });
        reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].completedDocs.splice(foundAt, 0, cObj);
      }
    }
    else if ((this_doc.status === 'in_process') || (this_doc.status === 'pending')) {
      if (!reactData.masterPeopleList[this_doc.pertains_to].hasOwnProperty(this_doc.form_type) || (this_doc.history[0].last_update > reactData.masterPeopleList[this_doc.pertains_to][this_doc.form_type].last_update)) {
        reactData.masterPeopleList[this_doc.pertains_to][this_doc.form_type] = {
          status: this_doc.status,
          last_update: this_doc.history[0].last_update
        };
      }
      if ((reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].wipDocs.length > 0) && (reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].wipDocs[0].last_update < this_doc.history[0].last_update)) {
        reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].wipDocs.unshift({
          document_id: this_doc.document_id,
          last_update: this_doc.history[0].last_update,
          doc_status: this_doc.status,
          due_date: this_doc.due_date || reactData.masterFormList[this_doc.form_type].dueDate,
          title: this_doc.title,
          formLocked: this_doc.formLocked || false
        });
      }
      else {
        reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].wipDocs.push({
          document_id: this_doc.document_id,
          last_update: this_doc.history[0].last_update,
          doc_status: this_doc.status,
          due_date: this_doc.due_date || reactData.masterFormList[this_doc.form_type].dueDate,
          title: this_doc.title,
          formLocked: this_doc.formLocked || false
        });
      }
    }
  }

  async function formPeople(this_form) {    // gathers all the people tha should (or do) have this form
    console.time('⏱️ TOTAL formPeople');
    if (!reactData.masterFormList[this_form].hasOwnProperty('groupList')) {
      return;
    }

    // ALWAYS refresh filteredMemberIds when form is clicked (not just first time)
    applyFilterToForm(this_form);
    if (!reactData.masterFormList[this_form].build_complete) {
      delete reactData.masterFormList[this_form].build_complete;
      delete reactData.masterFormList[this_form].sortedMemberIds;
      delete reactData.masterFormList[this_form].filteredMemberIds;
    }
    console.time('⏱️ Setup and initialization');
    let this_date = makeDate(new Date());
    let today_ymd = this_date.numeric;
    let oldest_date = makeDate(addDays(this_date.date, -(reactData.rowLimit || 7))).numeric;
    reactData.masterFormList[this_form].memberList = {};
    reactData.masterPeopleList = {};
    console.timeEnd('⏱️ Setup and initialization');

    // Collect all members from all groups IN PARALLEL
    console.time('⏱️ getMemberList calls');
    console.log(`📊 Fetching ${reactData.masterFormList[this_form].groupList.length} groups...`);
    const groupPromises = reactData.masterFormList[this_form].groupList.map(this_group =>
      getMemberList(this_group, state.session.client_id, { "exclude": false, state })
    );

    const groupResponses = await Promise.all(groupPromises);
    console.timeEnd('⏱️ getMemberList calls');

    // Process all members from all groups
    console.time('⏱️ Processing members');
    let memberCount = 0;
    for (let response of groupResponses) {
      memberCount += response.peopleList.length;
      for (let this_member of response.peopleList) {
        reactData.masterFormList[this_form].memberList[this_member.person_id] = {
          person_id: this_member.person_id,
          person_name: `${this_member.name.first} ${this_member.name.last}`,
          person_first: this_member.name.first,
          person_last: this_member.name.last,
          sort_order: state.session.client_style.sort_order === 'last_first' ?
            `${this_member.name.last}, ${this_member.name.first}` :
            `${this_member.name.first} ${this_member.name.last}`,
          wipDocs: [],
          dated_docs: false,
          assignedDocs: [],
          completedDocs: [],
        };
        reactData.masterPeopleList[this_member.person_id] = {
          [this_form]: {
            status: 'not_started',
            last_update: 0
          }
        };
      }
    }
    console.log(`📊 Processed ${memberCount} members`);
    console.timeEnd('⏱️ Processing members');

    // PRE-SORT: Create sorted list of person IDs once, not on every render
    console.time('⏱️ Sorting members');
    reactData.masterFormList[this_form].sortedMemberIds = Object.keys(reactData.masterFormList[this_form].memberList).sort((a, b) => {
      return (reactData.masterFormList[this_form].memberList[a].sort_order > reactData.masterFormList[this_form].memberList[b].sort_order) ? 1 : -1;
    });
    console.timeEnd('⏱️ Sorting members');

    // PROGRESSIVE RENDERING: Update UI with initial member list (now sorted!)
    console.time('⏱️ First UI update');
    console.log(`📊 Rendering ${Math.min(reactData.maxPeopleToRender, reactData.masterFormList[this_form].sortedMemberIds.length)} of ${reactData.masterFormList[this_form].sortedMemberIds.length} people`);
    updateReactData({
      masterPeopleList: reactData.masterPeopleList,
      masterFormList: reactData.masterFormList,
      progressMessage: `Loading documents for ${reactData.masterFormList[this_form].sortedMemberIds.length} people...`
    }, true);
    console.timeEnd('⏱️ First UI update');

    // Event cache to avoid duplicate DB calls
    let eventCache = {};

    // get all Documents for this form type
    let docList = [];
    let workingOn = null;
    let loopCount = 0;
    let queryObj = {
      KeyConditionExpression: 'client_id_form_type = :p',
      IndexName: 'client_form_person-index',
      TableName: 'DocumentMaster',
      ExpressionAttributeValues: {
        ':p': `${state.session.client_id}%%${this_form}`
      }
    };

    do {
      let allDocs = await dbClient
        .query(queryObj)
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`Error reading CompletedDocuments; error is ${error}`);
        });
      if (recordExists(allDocs)) {
        if (!allDocs.LastEvaluatedKey) {
          allDocs.Items.push({
            client_id: state.session.client_id,
            last_record: true
          });
        }
        for (const this_doc of allDocs.Items) {
          if (this_doc.client_id !== state.session.client_id) {
            continue;
          }
          if ((workingOn !== this_doc.pertains_to) || this_doc.last_record) {
            if (docList.length > 0) {
              docList.sort((a, b) => { return ((a.occDate > b.occDate) ? -1 : 1); });

              // Process documents directly (typically just 1 document per person)
              for (const doc of docList) {
                await buildMasters(doc, eventCache);
              }
            };
            if (this_doc.last_record) {
              continue;
            }
            docList = [];
            workingOn = this_doc.pertains_to;
          }
          if (reactData.masterFormList[this_form].dated_docs) {
            let occDate = 0;
            if (this_doc.occurrence) {
              occDate = Number(this_doc.occurrence);
            }
            else {
              let splitter = this_doc.document_id.split(/%|#/);
              for (const [sX, this_part] of Object.entries(splitter)) {
                let candidate = Number(this_part);
                if (candidate && !isNaN(candidate) && (candidate > 0)) {
                  occDate = candidate;
                  if (!this_doc.event_key) {
                    this_doc.event_id = (splitter[sX - 1] || splitter[sX - 2]);
                  }
                  break;
                }
              }
            }
            if ((occDate <= today_ymd) && (occDate >= oldest_date)) {
              this_doc.occDate = occDate;
              docList.push(this_doc);
            }
          }
          else {
            docList.push(this_doc);
          }
        }
        if (allDocs.LastEvaluatedKey) {
          queryObj.ExclusiveStartKey = allDocs.LastEvaluatedKey;
        }
        else {
          delete queryObj.ExclusiveStartKey;
        }
      }
      loopCount++;
    } while (queryObj.ExclusiveStartKey && (loopCount < 10));

    // COMPUTE STATUS: Calculate overall status for each person for filtering
    console.time('⏱️ Computing person statuses');
    for (let person_id in reactData.masterFormList[this_form].memberList) {
      let personData = reactData.masterFormList[this_form].memberList[person_id];

      // Calculate overall status based on dated_docs or regular status
      if (reactData.masterFormList[this_form].dated_docs && personData.dated_status) {
        // For dated docs, compute an overall status from all dated statuses
        if (personData.dated_status.complete) {
          personData.overall_status = 'complete';
        } else if (personData.dated_status.in_process) {
          personData.overall_status = 'in_process';
        } else if (personData.dated_status.pending) {
          personData.overall_status = 'pending';
        } else if (personData.dated_status.not_started) {
          personData.overall_status = 'not_started';
        } else {
          personData.overall_status = 'not_started';
        }
      } else {
        // For regular forms, use the masterPeopleList status
        personData.overall_status = reactData.masterPeopleList[person_id]?.[this_form]?.status || 'not_started';
      }
    }
    console.timeEnd('⏱️ Computing person statuses');

    // INITIALIZE FILTERED LIST: Start with all people (no filter applied yet)
    reactData.masterFormList[this_form].filteredMemberIds = reactData.masterFormList[this_form].sortedMemberIds;
    applyFilterToForm(this_form);

    reactData.masterFormList[this_form].build_complete = true;
    console.time('⏱️ Final UI update');
    updateReactData({
      masterPeopleList: reactData.masterPeopleList,
      masterFormList: reactData.masterFormList,
      progressMessage: ''
    }, true);
    console.timeEnd('⏱️ Final UI update');
    console.timeEnd('⏱️ TOTAL formPeople');
  }

  async function initialize() {
    // this will get a list of forms, and include the groups that each form is attached to (if any)
    const today = makeDate('today');
    let temp_dueDate = today.numeric$ + 10000;     // one year from today
    let masterFormList = {};
    // and build myFormListObj with one object for each form assigned to members of this person's groups
    // get all the forms that are assigned people in this group 
    let allForms = await dbClient
      .query({
        KeyConditionExpression: 'client_id = :c',
        TableName: 'Forms',
        ExpressionAttributeValues: {
          ':c': state.session.client_id,
        }
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          cl(`Security Violation or no Internet Connection`);
        }
        cl(`Error reading Forms; error is ${error}`);
      });
    if (recordExists(allForms)) {
      for (let formRec of allForms.Items) {
        // due_by works like this...
        //   if due_by is single date and the date is in the future, use that date
        //   if due_by is an array of dates, take the nearest date that is in the future
        //   if due_by is a number, and docData.dueDate_key exists, add/subtract due_by to docData.dueDate_key
        //   if due_by is a number, and no docData.dueDate_key exists, add due_by to today
        let date_assigned = false;
        for (const this_dueBy of [formRec.due_by].flat()) {
          let candidate = Number(this_dueBy);
          if ((candidate > today.numeric$) && (candidate < temp_dueDate)) {   // is it a date in the future that is earlier than the current temp_dueDate?
            temp_dueDate = candidate;
            date_assigned = true;
          }
          else if (candidate < 20000000) {   // it is not a date at all
            let checkMe = addDays((formRec.dueDate_key || today.date), candidate);
            if (checkMe.numeric$ > today.numeric$) {
              temp_dueDate = checkMe.numeric$;
              date_assigned = true;
              break;
            }
          }
        }
        // Determine category: inactive forms go to "Inactive Forms" by default
        let formCategory = formRec.category || 'No Category';
        if (!formRec.active) {
          formCategory = 'Inactive Forms';
        }
        masterFormList[formRec.form_id] = {
          form_id: formRec.form_id,
          form_name: formRec.form_name || `Form ${titleCase(formRec.form_id.replace(/[^a-zA-z0-9]|_/g, ' '))}`,
          category: formCategory,
          groupList: [],  // all the groups that require this form
          options: formRec.options || {},
          dueDate: date_assigned,
          dated_docs: formRec.options?.dated_docs || false,
          active: formRec.active || false
        };
      }
    }
    // are there one or more groups that require this form?
    let allGroups = await dbClient
      .query({
        KeyConditionExpression: 'client_id = :c',
        TableName: 'Groups',
        ExpressionAttributeValues: {
          ':c': state.session.client_id,
        }
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          cl(`Security Violation or no Internet Connection`);
        }
        cl(`Error reading Groups; error is ${error}`);
      });
    if (recordExists(allGroups)) {
      for (let groupRec of allGroups.Items) {
        if (groupRec.forms) {
          for (let this_form of groupRec.forms) {
            if (masterFormList.hasOwnProperty(this_form)) {
              masterFormList[this_form].groupList.push(groupRec.group_id);
            }
          }
        }
      }
    }
    // now we've got a list of all the forms that are attached to all the groups 
    // Sort by category first, then by form_name within each category
    // "Inactive Forms" category should always appear last
    let sortedForms = Object.keys(masterFormList).sort((a, b) => {
      const catA = masterFormList[a].category || 'No Category';
      const catB = masterFormList[b].category || 'No Category';

      // Move "Inactive Forms" to the end
      const aIsInactive = catA === 'Inactive Forms';
      const bIsInactive = catB === 'Inactive Forms';
      if (aIsInactive && !bIsInactive) return 1;
      if (!aIsInactive && bIsInactive) return -1;

      // First sort by category
      if (catA < catB) return -1;
      if (catA > catB) return 1;

      // Then sort by form_name within the same category
      return (masterFormList[a].form_name < masterFormList[b].form_name ? -1 : 1);
    });

    // Determine if we should show category headers
    // Get unique categories
    const categories = [...new Set(sortedForms.map(formId => masterFormList[formId].category || 'No Category'))];
    const showCategoryHeaders = categories.length > 1;

    updateReactData({
      sortedForms,
      masterFormList,
      showCategoryHeaders,
      formsInitialized: true
    }, true);
  }

  const makeColor = (status) => {
    switch (status.slice(0, 7)) {
      case 'complet': return 'green';
      case 'in_proc': return 'orange';
      case 'pending': return 'blue';
      case 'not_sta': return 'red';
      default: return 'red';
    }
  };

  React.useEffect(() => {
    initialize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [state.session]); // eslint-disable-line react-hooks/exhaustive-deps


  // **************************

  return (
    <Dialog
      open={true || refreshTrigger}
      maxWidth={false}
      classes={{
        paper: classes.paperPallette
      }}
      style={{
        borderRadius: ('25px 25px 25px 25px'),
      }}
    >
      {(Object.keys(reactData.masterFormList).length === 0)
        ?
        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
          <Typography
            style={{
              marginTop: 4,
              marginBottom: 2,
              marginLeft: 2,
              marginRight: 2,
              paddingTop: 3,
            }}
          >
            {reactData.formsInitialized ? `No Forms to show for ${state.session.user_display_name}` : 'Loading'}
          </Typography>
        </Box>
        :
        <React.Fragment>
          <Box style={{ borderRadius: '30px 30px 30px 30px', marginRight: '16px' }}
            key={'topRow'} height={'120px'}
            display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
          >
            <Box
              key={'topBox'} flexGrow={1}
              display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'
            >
              <Typography
                className={classes.title}
                style={AVATextStyle({ size: 1.3, bold: true, margin: { top: 1.5, left: 1, right: 1 } })}
                id='scroll-dialog-title'
              >
                {'Select a form from this list'}
              </Typography>

              <React.Fragment>
                <Box
                  key={`selectBox_filterdrop`}
                  display='flex' flexGrow={1} flexDirection='column'
                  pt={1} pb={1} marginLeft={'32px'} width={'40%'}
                >
                  {(reactData.selectedPerson_id || reactData.selectedForm_id) &&
                    <React.Fragment>
                      <Select
                        options={reactData.default_filters}
                        searchBy={'label'}
                        className={classes.filterSelect}
                        style={{
                          fontSize: '0.8rem',
                          marginLeft: -5,
                          marginBottom: -4,
                          marginTop: 1,
                          borderWidth: 0
                        }}
                        dropdownHandle={true}
                        variant={'standard'}
                        dropdownPosition={'auto'}
                        value={reactData.activity_filter}
                        clearable={true}
                        clearOnSelect={false}
                        placeholder={reactData.activity_filter}
                        clearOnBlur={false}
                        key={`selectBox_filterdrop_select${reactData.lower_activity_filter}`}
                        searchable={true}
                        multi={false}
                        closeOnClickInput={true}
                        closeOnSelect={true}
                        create={true}
                        keepSelectedInList={true}
                        noDataLabel={''}
                        onInputChange={(values) => {
                          if (values.length === 0) {
                            handleChangeActivityFilter({ value: '', label: '' });
                          }
                          else {
                            handleChangeActivityFilter(values[0]);
                          }
                        }}
                        onChange={(values) => {
                          if (values.length === 0) {
                            handleChangeActivityFilter({ value: '', label: '' });
                          }
                          else {
                            handleChangeActivityFilter(values[0]);
                          }
                        }}
                      />
                      <Box display='flex'
                        flexDirection='row'
                        minWidth={'100%'}
                        paddingTop={'4px'}
                        key={`select_wrapper_box`}
                        borderTop={1}
                      >
                        <Typography
                          style={AVATextStyle({
                            size: 0.8,
                            margin: { left: 0, top: 0, bottom: 0.5 },
                            color: 'black',
                            opacity: '54%',
                          })}
                        >
                          {`Filter`}
                        </Typography>
                      </Box>
                    </React.Fragment>
                  }
                </Box>
              </React.Fragment>
            </Box>
            <PeopleIcon
              style={{ marginRight: '32px' }}
              onClick={() => {
                updateReactData({ showQuickSearch: true }, true);
              }}
            />
          </Box>

          <Box display='flex' flexDirection='row' style={{ flexGrow: 1, height: '100px' }}>

            {/* LEFT SIDE */}
            <Box display='flex' style={{ width: '44.5%' }}
              flexDirection='column'
              justifyContent='flex-start'
              alignItems='flex-start'
              marginLeft={'32px'}
            >
              <Box display='flex' flexDirection='row' alignItems='center' justifyContent='space-between' width='100%'>
                <Typography
                  key={`g_client_name_header`}
                  style={AVATextStyle({
                    size: 1.5,
                    bold: true,
                    overflow: 'visible',
                    margin: { top: 1, bottom: 1 },
                  })}>
                  {`${state.session.client_name} Forms`}
                </Typography>
              </Box>
              <Paper component={Box} elevation={0} overflow='auto' square
                style={{ scrollbarWidth: 'none', flexGrow: 1, display: 'flex' }}
              >
                <Box display='flex' flexDirection='column'
                  justifyContent='flex-start'
                  alignItems='flex-start'
                >
                  {reactData.sortedForms.map((this_formID, listIndex) => {
                    const currentCategory = reactData.masterFormList[this_formID].category || 'No Category';
                    const previousCategory = listIndex > 0
                      ? (reactData.masterFormList[reactData.sortedForms[listIndex - 1]].category || 'No Category')
                      : null;
                    const showCategoryHeader = reactData.showCategoryHeaders && currentCategory !== previousCategory;

                    return (
                      <React.Fragment key={`frag_${listIndex}`}>
                        {showCategoryHeader && (
                          <Typography
                            key={`category_header_${listIndex}`}
                            style={AVATextStyle({
                              size: 1.1,
                              bold: true,
                              overflow: 'visible',
                              margin: { top: listIndex === 0 ? 0 : 2, bottom: 0.5, left: 0 },
                              color: 'textSecondary'
                            })}
                          >
                            {currentCategory}
                          </Typography>
                        )}
                        <Box display='flex' flexDirection='row'
                          key={`form_master_list_${listIndex}`}
                          justifyContent='flex-start'
                          alignItems='center'
                          style={AVATextStyle({
                            overflow: 'visible',
                            size: 1.2,
                            margin: { top: 0, bottom: 0.8 }
                          })}
                        >
                          <VisibilityIcon
                            key={`view-button_form${listIndex}edit`}
                            onClick={() => {
                              updateReactData({
                                selectedForm_id: false,
                                selectedFormRec: false,
                                selectedFormMembers: false,
                                selectedPerson_id: false,
                                selectedPersonRec: false,
                                activity_filter: '',
                                lower_activity_filter: '',
                                filterComplete: false,
                                filterNotStarted: false,
                                filterInProcess: false,
                                isEditing: {
                                  calledFrom: 'master',
                                  person_id: state.session.client_id,
                                  form_id: this_formID,
                                  document_id: 'new'
                                }
                              }, true);
                            }}
                            style={AVATextStyle({
                              size: 1.5,
                              margin: { right: 0.5 },
                            })}
                            size='small'
                          />
                          <EditIcon
                            key={`edit-button_form${listIndex}`}
                            onClick={async () => {
                              // Fetch Forms table record
                              const getSpec = {
                                TableName: 'Forms',
                                Key: {
                                  client_id: state.session.client_id,
                                  form_id: this_formID
                                }
                              };
                              let formRec = await getDb(getSpec);
                              if (!formRec) return;
                              updateReactData({
                                showFormEditor: true,
                                formEditorRecord: deepCopy(formRec)
                              }, true);
                            }}
                            style={AVATextStyle({
                              size: 1.5,
                              margin: { right: 0.5 },
                            })}
                            size='small'
                          />
                          {/* FormEditor Dialog */}
                          <Typography
                            key={`g_text_${listIndex}_0_${reactData.selectedPerson_id}`}
                            draggable={!!reactData.selectedPerson_id}
                            onDragStart={(e) => handleDragStart(e, {
                              form_id: this_formID,
                              reason: 'createForm'
                            })}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              updateReactData({
                                editFormGroups: {
                                  form_id: this_formID,
                                  form_name: reactData.masterFormList[this_formID].form_name,
                                  groupList: reactData.masterFormList[this_formID].groupList || [],
                                  collapsedGroups: []
                                }
                              }, true);
                            }}
                            onClick={async () => {
                              console.log('🖱️ Form clicked:', reactData.masterFormList[this_formID].form_name);
                              console.time('⏱️ TOTAL onClick to UI update');
                              console.time('⏱️ updateReactData (initial)');
                              updateReactData({
                                selectedForm_id: this_formID,
                                selectedFormRec: reactData.masterFormList[this_formID],
                                selectedFormMembers: reactData.masterFormList[this_formID].memberList,
                                selectedPerson_id: false,
                                selectedPersonRec: false,
                                selectedPersonFirstName: false,
                                selectedPersonLastName: false,
                                activity_filter: '',
                                lower_activity_filter: '',
                                filterComplete: false,
                                filterNotStarted: false,
                                filterInProcess: false,
                                progressMessage: 'Loading people...',
                                maxPeopleToRender: 100 // Reset to initial limit
                              }, true);
                              console.timeEnd('⏱️ updateReactData (initial)');
                              console.time('⏱️ formPeople execution');
                              await formPeople(this_formID);
                              console.timeEnd('⏱️ formPeople execution');
                              console.timeEnd('⏱️ TOTAL onClick to UI update');
                            }}
                            style={AVATextStyle({
                              size: 1.2,
                              margin: { left: 0, top: 0 },
                            })}>
                            {reactData.masterFormList[this_formID].form_name}
                          </Typography>
                        </Box>
                      </React.Fragment>
                    );
                  })}
                </Box>
              </Paper>
            </Box>

            {/* RIGHT SIDE */}
            {reactData.selectedPerson_id &&
              <Box display='flex' style={{ width: '50%' }} flexDirection='column'
                justifyContent='flex-start'
                alignItems='flex-start'
                borderLeft={2}
                paddingLeft={'32px'}
              >
                <Box display='flex' flexDirection='row'
                  justifyContent='space-between'
                  alignItems='center'
                  style={{ width: '100%' }}
                >
                  <Box display='flex' flexDirection='row'
                    flexGrow={1}
                    justifyContent='flex-start'
                    onDragOver={(e) => handleDragOver(e)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      let draggedFrom = JSON.parse(e.dataTransfer.getData('id'));
                      if (draggedFrom.reason === 'createForm') {
                        let newDocument = await createDocument({
                          docData: {
                            client_id: state.session.client_id,
                            form_type: draggedFrom.form_id,
                            pertains_to: reactData.selectedPerson_id
                          },
                          author: state.session.patient_id
                        });
                        cl(newDocument);
                      }
                    }}
                    alignItems='center'
                  >
                    <Typography
                      key={`g_text_end-last_name`}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, {
                        person_id: reactData.selectedPerson_id,
                        person_name: `${reactData.selectedPersonRec.name.first} ${reactData.selectedPersonRec.name.last}`,
                      })}

                      style={Object.assign({},
                        AVATextStyle({
                          size: 1.5,
                          overflow: 'visible',
                          bold: true,
                          margin: { top: 1, bottom: 1, right: 0 },
                        }), { textWrap: 'nowrap' }
                      )}
                    >
                      {`${reactData.selectedPersonRec.name.first} ${reactData.selectedPersonRec.name.last}'${reactData.selectedPersonRec.name.last.trim().endsWith('s') ? '' : 's'} Forms`}
                    </Typography>
                  </Box>
                  <Box
                    key={'my_image_box'}
                    style={{ marginRight: '16px', marginLeft: '6px' }}
                    onClick={() => {
                      updateReactData({
                        viewPeopleMaintenance: reactData.selectedPerson_id
                      }, true);
                    }}
                  >
                    <img
                      key={'my_image'}
                      draggable={true}
                      className={classes.myImageArea}
                      alt={''}
                      onError={onImageError}
                      src={getImage(reactData.selectedPerson_id)}
                    />
                    <SettingsIcon style={{ marginLeft: '-26px' }} />
                  </Box >
                </Box>
                <Paper component={Box} width='100%' elevation={0} overflow='auto' square
                  style={{ scrollbarWidth: 'thin', flexGrow: 1, display: 'flex' }}
                  onDragOver={(e) => handleDragOver(e)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    let draggedFrom = JSON.parse(e.dataTransfer.getData('id'));
                    if (draggedFrom.reason === 'createForm') {
                      let newDocument = await createDocument({
                        docData: {
                          client_id: state.session.client_id,
                          form_type: draggedFrom.form_id,
                          pertains_to: reactData.selectedPerson_id
                        },
                        author: state.session.patient_id
                      });
                      cl(newDocument);
                    }
                  }}
                >
                  <Box display='flex' flexDirection='column'
                    onDrop={async (e) => {
                      e.preventDefault();
                      let draggedFrom = JSON.parse(e.dataTransfer.getData('id'));
                      if (draggedFrom.reason === 'createForm') {
                        let newDocument = await createDocument({
                          docData: {
                            client_id: state.session.client_id,
                            form_type: draggedFrom.form_id,
                            pertains_to: reactData.selectedPerson_id
                          },
                          author: state.session.patient_id
                        });
                        cl(newDocument);
                      }
                    }}
                    key={`form_column`}
                    justifyContent='flex-start'
                    alignItems='flex-start'
                  >
                    {reactData.masterPeopleList.hasOwnProperty(reactData.selectedPerson_id) &&
                      Object.keys(reactData.masterPeopleList[reactData.selectedPerson_id]).map((this_form, gX) => (
                        (OKtoShow(reactData.selectedPerson_id, this_form, reactData.masterFormList[this_form].form_name) &&
                          <Box display='flex' flexDirection='row'
                            key={`form_row_list_${gX}`}
                            justifyContent='flex-start'
                            alignItems='center'
                            onContextMenu={async (e) => {
                              e.preventDefault();
                              updateReactData({
                                alert: {
                                  severity: 'info',
                                  title: `${reactData.masterFormList[this_form].form_name}`,
                                  message: <div>
                                    Person ID: <strong>{reactData.selectedPerson_id}</strong><br />
                                    Form Type: <strong>{this_form}</strong><br />
                                    Status: {reactData.masterPeopleList[reactData.selectedPerson_id]?.[this_form]?.status}<br />
                                    WIP Doc ID: {(reactData.masterFormList[this_form].memberList?.[reactData.selectedPerson_id]?.wipDocs[0]?.document_id || 'n/a')}<br />
                                    Completed Doc ID: {(reactData.masterFormList[this_form].memberList?.[reactData.selectedPerson_id]?.completedDocs[0]?.document_id || 'n/a')}</div>
                                }
                              }, true);
                            }}
                            style={AVATextStyle({
                              size: 1.2,
                              margin: { top: 0, bottom: 0.8 }
                            })}
                          >
                            {(reactData.masterFormList[this_form].memberList?.[reactData.selectedPerson_id]?.wipDocs[0]?.formLocked
                              || reactData.masterFormList[this_form].memberList?.[reactData.selectedPerson_id]?.completedDocs[0]?.formLocked)
                              ?
                              <React.Fragment>
                                <LockIcon
                                  key={`radio-button_form${gX}lock`}
                                  id={`radio-button_form${gX}lock`}
                                  onClick={() => {
                                    updateReactData({
                                      isEditing: {
                                        calledFrom: 'people',
                                        person_id: reactData.selectedPerson_id,
                                        form_id: this_form,
                                        document_id: (reactData.masterFormList[this_form].memberList?.[reactData.selectedPerson_id]?.wipDocs[0]?.document_id
                                          || reactData.masterFormList[this_form].memberList?.[reactData.selectedPerson_id]?.completedDocs[0]?.document_id
                                          || 'new')
                                      }
                                    }, true);
                                  }}
                                  style={AVATextStyle({
                                    size: 1.5,
                                    margin: { right: 0.5 },
                                    color: 'gray'
                                  })}
                                  size='small'
                                />
                              </React.Fragment>
                              :
                              (reactData.masterPeopleList[reactData.selectedPerson_id]?.[this_form]?.status === 'pending')
                                ?
                                <React.Fragment>
                                  <CheckCircleIcon
                                    key={`radio-button_form${gX}edit`}
                                    id={`radio-button_form${gX}edit`}
                                    onClick={() => {
                                      updateReactData({
                                        isEditing: {
                                          calledFrom: 'people',
                                          person_id: reactData.selectedPerson_id,
                                          form_id: this_form,
                                          document_id: (reactData.masterFormList[this_form].memberList?.[reactData.selectedPerson_id]?.wipDocs[0]?.document_id || 'new')
                                        }
                                      }, true);
                                    }}
                                    style={AVATextStyle({
                                      size: 1.5,
                                      margin: { right: 0.5 },
                                      color: 'orange'
                                    })}
                                    size='small'
                                  />
                                </React.Fragment>
                                :
                                <React.Fragment>
                                  <EditIcon
                                    key={`radio-button_form${gX}edit`}
                                    id={`radio-button_form${gX}edit`}
                                    onClick={() => {
                                      updateReactData({
                                        isEditing: {
                                          calledFrom: 'people',
                                          person_id: reactData.selectedPerson_id,
                                          form_id: this_form,
                                          document_id: ((reactData.masterPeopleList[reactData.selectedPerson_id]?.[this_form]?.status.startsWith('complete')) ? 'new' : (reactData.masterFormList[this_form].memberList?.[reactData.selectedPerson_id]?.wipDocs[0]?.document_id || 'new'))
                                        }
                                      }, true);
                                    }}
                                    style={AVATextStyle({
                                      size: 1.5,
                                      margin: { right: 0.5 },
                                      color: makeColor(reactData.masterPeopleList[reactData.selectedPerson_id]?.[this_form]?.status || 'not_started')
                                    })}
                                    size='small'
                                  />
                                </React.Fragment>
                            }
                            <Typography
                              key={`g_text_end_group-${gX}`}
                              draggable={true}
                              onDragStart={(e) => handleDragStart(e, {
                                person_id: reactData.selectedPerson_id,
                                person_name: `${reactData.selectedPersonRec.name.first} ${reactData.selectedPersonRec.name.last}`,
                                reason: 'form'
                              })}
                              style={AVATextStyle({
                                size: 1.2,
                                margin: { top: 0, bottom: 0 },
                                color: makeColor(reactData.masterPeopleList[reactData.selectedPerson_id]?.[this_form]?.status || 'not_started')
                              })}
                              onClick={async () => {
                                await formPeople(this_form);
                                updateReactData({
                                  selectedForm_id: this_form,
                                  selectedFormRec: reactData.masterFormList[this_form],
                                  selectedFormMembers: reactData.masterFormList[this_form].memberList,
                                  selectedPerson_id: false,
                                  selectedPersonRec: false,
                                  activity_filter: '',
                                  lower_activity_filter: '',
                                  filterComplete: false,
                                  filterNotStarted: false,
                                  filterInProcess: false

                                }, true);
                              }}
                            >
                              {`${reactData.masterFormList[this_form].form_name}`}
                            </Typography>
                            {(reactData.masterPeopleList[reactData.selectedPerson_id]?.[this_form]?.status.startsWith('complete'))
                              &&
                              <CheckCircleIcon
                                key={`radio-button_form${gX}off`}
                                id={`radio-button_form${gX}off`}
                                style={AVATextStyle({
                                  color: 'green',
                                  size: 1,
                                  margin: { left: 0.5, right: 0.5 },
                                })}
                                onClick={() => {

                                  updateReactData({
                                    isEditing: {
                                      calledFrom: 'people',
                                      person_id: reactData.selectedPerson_id,
                                      form_id: this_form,
                                      document_id: (reactData.masterFormList[this_form].memberList?.[reactData.selectedPerson_id]?.completedDocs[0]?.document_id)
                                    }
                                  }, true);


                                }}
                                size='small'
                              />
                            }
                          </Box>
                        )
                      ))}
                  </Box>
                </Paper>
                <SendIcon
                  classes={{ root: classes.rowButton }}
                  size='medium'
                  style={{ alignSelf: 'center' }}
                  aria-label="trash_icon"
                  onDragOver={(e) => handleDragOver(e)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    let draggedFrom = JSON.parse(e.dataTransfer.getData('id'));
                    let sendMessage = [];
                    if (draggedFrom.reason === 'form') {
                      let jumpTo = window.location.href.replace('refresh', 'theseus');
                      if (jumpTo.includes('?')) {
                        jumpTo = jumpTo.split('?')[0];
                      }
                      sendMessage.push({
                        person_id: draggedFrom.person_id,
                        person_name: draggedFrom.person_name,
                        subject: `Your ${state.session.client_name} forms`,
                        messageText: `To access your ${state.session.client_name} forms, click the attached link!`,
                        attachmentList: [`${jumpTo}?user=${draggedFrom.person_id}&forms=true`]
                      });
                    }
                    else if (draggedFrom.hasOwnProperty('person_id')) {
                      sendMessage.push({
                        person_id: draggedFrom.person_id,
                        person_name: `${draggedFrom.person_name}`
                      });
                    }
                    updateReactData({
                      sendMessage
                    }, true);
                  }}
                  edge="start"
                />
              </Box>
            }
            {reactData.selectedForm_id &&
              <Box display='flex' style={{ width: '50%' }} flexDirection='column'
                justifyContent='flex-start'
                alignItems='flex-start'
                borderLeft={2}
                paddingLeft={'32px'}
              >

                <Box display='flex' flexDirection='row'
                  justifyContent='flex-start'
                  alignItems='center'
                >
                  <Typography
                    key={`g_name`}
                    style={AVATextStyle({
                      size: 1.5,
                      overflow: 'visible',
                      bold: true,
                      margin: { top: 1, bottom: 1 },
                    })}>
                    {`${reactData.masterFormList[reactData.selectedForm_id].form_name}`}
                  </Typography>
                </Box>

                {/* Progress message display */}
                {reactData.progressMessage && (
                  <Box display='flex' flexDirection='row'
                    justifyContent='flex-start'
                    alignItems='center'
                    style={{ marginBottom: '8px' }}
                  >
                    <Typography
                      style={AVATextStyle({
                        size: 1.0,
                        margin: { top: 0, bottom: 0.5 },
                        color: 'textSecondary'
                      })}
                    >
                      {reactData.progressMessage}
                    </Typography>
                  </Box>
                )}

                {/* Show rendering info or empty state */}
                {reactData.selectedForm_id && (
                  <Box display='flex' flexDirection='column'
                    justifyContent='center'
                    alignItems='flex-start'
                    style={{ marginBottom: '8px' }}
                  >
                    {reactData.masterFormList[reactData.selectedForm_id]?.filteredMemberIds?.length === 0
                      ?
                      <Typography
                        style={AVATextStyle({
                          size: 1.0,
                          margin: { top: 0, bottom: 0.5 },
                          color: 'textSecondary'
                        })}
                      >
                        {reactData.lower_activity_filter
                          ? 'No people match the selected filter'
                          : 'No people assigned to this form'}
                      </Typography>
                      :
                      (reactData.masterFormList[reactData.selectedForm_id]?.filteredMemberIds?.length > 0 &&
                        <React.Fragment>
                          <Typography
                            style={AVATextStyle({
                              size: 0.9,
                              margin: { top: 0, bottom: 0 },
                              color: 'textSecondary'
                            })}
                          >
                            {`${reactData.masterFormList[reactData.selectedForm_id]?.filteredMemberIds?.length} people${reactData.lower_activity_filter ? ' match the filter' : ''}.`}
                          </Typography>
                          {(reactData.masterFormList[reactData.selectedForm_id]?.filteredMemberIds?.length > reactData.maxPeopleToRender) &&
                            <Typography
                              style={AVATextStyle({
                                size: 0.9,
                                margin: { top: 0, bottom: 0 },
                                color: 'textSecondary'
                              })}
                            >
                              {`Showing first ${reactData.maxPeopleToRender} people (scroll for more)`}
                            </Typography>
                          }
                          {reactData.lower_activity_filter && !reactData.filterNotStarted &&
                            <Box display='flex' flexDirection='row'
                              justifyContent='flex-start'
                              alignItems='center'
                              style={{ marginBottom: 0, marginTop: 0 }}
                              onClick={() => {
                                let newSortOrder = reactData.activity_sort_order === 'asc' ? 'desc' : 'asc';
                                sortfilteredIds(reactData.selectedForm_id, newSortOrder);
                              }}
                            >
                              <Typography
                                style={AVATextStyle({
                                  size: 0.9,
                                  margin: { top: 0, bottom: 0, right: 1 },
                                  color: 'textSecondary'
                                })}
                              >
                                {`Sorted by date - ${reactData.activity_sort_order === 'asc' ? 'Oldest' : 'Most recent'} at the top `}
                              </Typography>
                              <SwapVertIcon />
                            </Box>
                          }
                        </React.Fragment>
                      )
                    }
                  </Box>
                )}

                <Paper component={Box} width='100%' elevation={0} square
                  style={{
                    scrollbarWidth: 'thin',
                    flexGrow: 1,
                    display: 'flex',
                    overflow: 'auto',
                    maxHeight: 'calc(100vh - 300px)'
                  }}
                  onScroll={(e) => {
                    // Load more people when scrolling near bottom
                    const element = e.currentTarget;
                    const scrolledToBottom = element.scrollHeight - element.scrollTop <= element.clientHeight + 200;

                    if (scrolledToBottom) {
                      const totalPeople = reactData.masterFormList[reactData.selectedForm_id]?.filteredMemberIds?.length || 0;
                      if (reactData.maxPeopleToRender < totalPeople) {
                        console.log(`📜 Loading more people: ${reactData.maxPeopleToRender} → ${reactData.maxPeopleToRender + 100}`);
                        updateReactData({
                          maxPeopleToRender: reactData.maxPeopleToRender + 100
                        }, true); // Force re-render to show new people
                      }
                    }
                  }}
                >
                  <Box display='flex' flexDirection='column'  // Box to stack all the rows for all the people
                    key={`person_column`}
                    justifyContent='flex-start'
                    alignItems='flex-start'
                  >
                    {reactData.masterFormList[reactData.selectedForm_id]?.filteredMemberIds?.slice(0, reactData.maxPeopleToRender)
                      .map((this_person, cX) => (
                        <Box display='flex' flexDirection='row'   // Box for row icon, person name, and (optional) trailing icon
                          key={`formperson_row_list_${cX}`}
                          justifyContent='flex-start'
                          alignItems='center'
                          onContextMenu={async (e) => {
                            e.preventDefault();
                            updateReactData({
                              alert: {
                                severity: 'info',
                                title: `${reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.person_name || makeName(this_person).display}`,
                                message: <div>
                                  Person ID: <strong>{this_person}</strong><br />
                                  Form Type: <strong>{reactData.selectedForm_id}</strong><br />
                                  Status: {reactData.masterPeopleList[this_person]?.[reactData.selectedForm_id]?.status}<br />
                                  WIP Doc ID: {(reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.wipDocs[0]?.document_id || 'n/a')}<br />
                                  Completed Doc ID: {(reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.completedDocs[0]?.document_id || 'n/a')}</div>
                              }
                            }, true);
                          }}
                        >
                          {reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.overall_status?.startsWith('compl')
                            ?
                            (reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.completedDocs[0]?.formLocked
                              ?
                              <LockIcon   // if overall status for this person/form is complete, show lock if form is locked
                                key={`radio-button_person${cX}lock`}
                                id={`radio-button_person${cX}lock`}
                                onClick={() => {
                                  updateReactData({
                                    isEditing: {
                                      calledFrom: 'forms',
                                      person_id: this_person,
                                      form_id: reactData.selectedForm_id,
                                      document_id: (reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.wipDocs[0]?.document_id
                                        || reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.completedDocs[0]?.document_id
                                        || 'new')
                                    }
                                  }, true);
                                }}
                                style={AVATextStyle({
                                  size: 1.5,
                                  margin: { right: 0.5 },
                                  color: 'gray'
                                })}
                                size='small'
                              />
                              :
                              <CheckCircleIcon  // if overall status for this person/form is complete, show checkCircle if form is not locked
                                key={`radio-button_person${cX}edit`}
                                id={`radio-button_person${cX}edit`}
                                onClick={() => {
                                  updateReactData({
                                    isEditing: {
                                      calledFrom: 'forms',
                                      person_id: this_person,
                                      form_id: reactData.selectedForm_id,
                                      document_id: reactData.masterFormList[reactData.selectedForm_id].memberList[this_person].completedDocs[0].document_id
                                    }
                                  }, true);
                                }}
                                style={AVATextStyle({
                                  size: 1.5,
                                  margin: { right: 0.5 },
                                  color: 'green'
                                })}
                                size='small'
                              />
                            )
                            :
                            <EditIcon   // if overall status for this person/form is NOT complete, show edit icon
                              key={`radio-button_person${cX}edit`}
                              id={`radio-button_person${cX}edit`}
                              onContextMenu={() => {
                                updateReactData({
                                  isEditing: {
                                    calledFrom: 'forms',
                                    person_id: this_person,
                                    form_id: reactData.selectedForm_id,
                                    document_id: ((reactData.masterPeopleList[this_person]?.[reactData.selectedForm_id]?.status.startsWith('complete')) ? 'new' : (reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.wipDocs[0]?.document_id || 'new'))
                                  }
                                }, true);
                              }}
                              onClick={() => {
                                updateReactData({
                                  isEditing: {
                                    calledFrom: 'forms',
                                    open_complete: !reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.wipDocs[0]?.document_id,
                                    person_id: this_person,
                                    form_id: reactData.selectedForm_id,
                                    document_id: (reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.wipDocs[0]?.document_id
                                      || (reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.completedDocs[0]?.document_id
                                        || 'new'))
                                  }
                                }, true);
                                console.log(reactData.isEditing);
                              }}
                              style={AVATextStyle({
                                size: 1.5,
                                margin: { right: 0.5 },
                                color: makeColor(reactData.masterPeopleList[this_person]?.[reactData.selectedForm_id]?.status || 'not_started')
                              })}
                              size='small'
                            />
                          }
                          <Typography  // Always show person's name, with color based on status of their form completion
                            key={`g_textpeople-${cX}`}
                            style={AVATextStyle({
                              overflow: 'visible',
                              size: 1.2,
                              margin: { top: 0 },
                              color: makeColor(reactData.masterPeopleList[this_person]?.[reactData.selectedForm_id]?.status || 'not_started')
                            })}
                            draggable={true}
                            onDragStart={(e) => handleDragStart(e, {
                              person_id: this_person,
                              person_name: `${reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.person_name || makeName(this_person).display}`,
                              reason: 'form'
                            })}
                            onClick={() => {
                              updateReactData({
                                viewPeopleMaintenance: this_person
                              }, true);
                            }}
                          >
                            {`${reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.person_name || makeName(this_person).display}`}
                          </Typography>
                          {!reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.overall_status?.startsWith('compl') &&
                            reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.completedDocs &&
                            (reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.completedDocs.length > 0) &&
                            <CheckCircleIcon  // if overall status for this person/form is NOT complete, BUT there IS at least one complete form of this type, show checkCircle
                              key={`radio-button_person${cX}off`}
                              id={`radio-button_person${cX}off`}
                              style={AVATextStyle({
                                color: 'green',
                                size: 1,
                                margin: { left: 0.5, right: 0.5 },
                              })}
                              onClick={() => {
                                updateReactData({
                                  isEditing: {
                                    calledFrom: 'forms',
                                    person_id: this_person,
                                    form_id: reactData.selectedForm_id,
                                    document_id: reactData.masterFormList[reactData.selectedForm_id].memberList[this_person].completedDocs[0].document_id
                                  }
                                }, true);
                              }}
                              size='small'
                            />
                          }
                        </Box>
                      ))
                      // end of loop through all filtered people for this form  
                    }
                  </Box>
                </Paper>



                <Box
                  display='flex'
                  flexDirection='row'
                  justifyContent='center'
                  alignItems='center'
                  style={{ alignSelf: 'center', marginTop: '6px' }}
                >
                  <GetAppIcon
                    classes={{ root: classes.rowButton }}
                    size='medium'
                    style={{ marginRight: '16px', opacity: (reactData.masterFormList[reactData.selectedForm_id]?.filteredMemberIds?.length > 0) ? 1 : 0.4 }}
                    aria-label="download_csv_icon"
                    onClick={() => {
                      if (reactData.masterFormList[reactData.selectedForm_id]?.filteredMemberIds?.length > 0) {
                        downloadCurrentPeopleListCsv();
                      }
                    }}
                  />
                  <SendIcon
                    classes={{ root: classes.rowButton }}
                    size='medium'
                    style={{ alignSelf: 'center' }}
                    aria-label="trash_icon"
                    onDragOver={(e) => handleDragOver(e)}
                    onClick={async (e) => {
                      let sendMessage = reactData.masterFormList[reactData.selectedForm_id]?.filteredMemberIds.map(p => {
                        return {
                          person_id: reactData.masterFormList[reactData.selectedForm_id]?.memberList[p].person_id,
                          person_name: reactData.masterFormList[reactData.selectedForm_id]?.memberList[p].person_name,
                          subject: `Your ${state.session.client_name} forms`
                        };
                      });
                      updateReactData({
                        sendMessage
                      }, true);
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      let draggedFrom = JSON.parse(e.dataTransfer.getData('id'));
                      let sendMessage = [];
                      if (draggedFrom.reason === 'form') {
                        let jumpTo = window.location.href.replace('refresh', 'theseus');
                        if (jumpTo.includes('?')) {
                          jumpTo = jumpTo.split('?')[0];
                        }
                        sendMessage.push({
                          person_id: draggedFrom.person_id,
                          person_name: draggedFrom.person_name,
                          subject: `Your ${state.session.client_name} forms`,
                          messageText: `To access your ${state.session.client_name} forms, click the attached link!`,
                          attachmentList: [`${jumpTo}?user=${draggedFrom.person_id}&forms=true`]
                        });
                      }
                      else if (draggedFrom.hasOwnProperty('person_id')) {
                        sendMessage.push({
                          person_id: draggedFrom.person_id,
                          person_name: draggedFrom.person_name
                        });
                      }
                      updateReactData({
                        sendMessage
                      }, true);
                    }}
                    edge="start"
                  />
                </Box>
              </Box>
            }
          </Box>

        </React.Fragment >
      }
      {reactData.isUploading &&
        <AVAUploadFile
          options={{
            buttonText: ['Choose', 'Save & Continue'],
            title: [reactData.document_title, 'Tap "Choose a File" to select the content to upload'],
            oneOnly: true
          }}
          onCancel={() => {
            updateReactData({
              isUploading: false
            }, true);
          }}
          onLoad={async (response) => {
            let docRecObj = await dbClient
              .get({
                Key: {
                  document_id: reactData.isUploading.document_id
                },
                TableName: "DocumentMaster"
              })
              .promise()
              .catch(error => {
                cl(`in isUploading, bad get to DocumentMaster with ${reactData.isUploading.document_id || '(null)'}. Error is: ${error}`);
              });
            if (recordExists(docRecObj)) {
              docRecObj.Item.history.unshift({
                last_update: new Date().getTime(),
                status: 'uploaded',
                update_by: state.session.user_id,
                url: response[0].fLoc
              });
              docRecObj.Item.status = 'complete';
              await dbClient
                .put({
                  Item: docRecObj.Item,
                  TableName: 'DocumentMaster'
                })
                .promise()
                .catch(error => {
                  cl(`Bad put to DocumentMaster. Error is: ${error}`);
                });
            }
            updateReactData({
              isUploading: false
            }, true);
          }}
        />
      }
      {reactData.isEditing &&
        <FormFillB
          key={`doc_update_ffB`}
          request={(reactData.isEditing.document_id === 'new') ?
            {
              form_id: reactData.isEditing.form_id,
              person_id: reactData.isEditing.person_id,
              mode: 'new',
            }
            :
            {
              form_id: reactData.isEditing.form_id,
              document_id: reactData.isEditing.document_id,
              person_id: reactData.isEditing.person_id,
              open_complete: reactData.isEditing.open_complete
            }}
          onClose={async (ignore_me, statusObj) => {
            if (statusObj.document_status === 'aborted') {
              // no op
            }
            else {
              if (statusObj.document_status === 'work_in_process') {
                reactData.masterPeopleList[reactData.isEditing.person_id][reactData.isEditing.form_id].status = 'in_process';
                reactData.masterFormList[reactData.isEditing.form_id].memberList[reactData.isEditing.person_id].overall_status = 'in_process';
                if (!reactData.masterFormList[reactData.isEditing.form_id].memberList.hasOwnProperty(reactData.isEditing.person_id)) {
                  let personName = makeName(reactData.isEditing.person_id);
                  reactData.masterFormList[reactData.isEditing.form_id].memberList[reactData.isEditing.person_id] = {
                    person_name: personName.display,
                    person_first: personName.first,
                    person_last: personName.last,
                    sort_order: personName.sort,
                    wipDocs: [],
                    dated_docs: false,
                    assignedDocs: [],
                    completedDocs: [],
                  };
                }
                if (reactData.masterFormList[reactData.isEditing.form_id].memberList[reactData.isEditing.person_id].wipDocs.length === 0) {
                  reactData.masterFormList[reactData.isEditing.form_id].memberList[reactData.isEditing.person_id].wipDocs.unshift({
                    document_id: statusObj.document_id,
                    last_update: new Date().getTime(),
                    doc_status: 'in_process',
                    due_date: reactData.masterFormList[reactData.isEditing.form_id].dueDate,
                    title: statusObj.document_title,
                    formLocked: statusObj.formLocked || false,
                  });
                }
                else {
                  reactData.masterFormList[reactData.isEditing.form_id].memberList[reactData.isEditing.person_id].wipDocs[0].document_id = statusObj.document_id;
                }
              }
              else if (statusObj.document_status.startsWith('complete')) {
                reactData.masterPeopleList[reactData.isEditing.person_id][reactData.isEditing.form_id].status = 'completed';
                reactData.masterFormList[reactData.isEditing.form_id].memberList[reactData.isEditing.person_id].overall_status = 'complete';
                if (!reactData.masterFormList[reactData.isEditing.form_id].memberList.hasOwnProperty(reactData.isEditing.person_id)) {
                  let personName = makeName(reactData.isEditing.person_id);
                  reactData.masterFormList[reactData.isEditing.form_id].memberList[reactData.isEditing.person_id] = {
                    person_id: reactData.isEditing.person_id,
                    person_name: personName.display,
                    person_first: personName.first,
                    person_last: personName.last,
                    sort_order: personName.sort,
                    wipDocs: [],
                    dated_docs: false,
                    assignedDocs: [],
                    completedDocs: [],
                  };
                }
                reactData.masterFormList[reactData.isEditing.form_id].memberList[reactData.isEditing.person_id].completedDocs.unshift({
                  document_id: statusObj.document_id,
                  location: statusObj.location,
                  last_update: new Date().getTime(),
                  date_completed: makeDate(new Date().getTime()).relative,
                  title: statusObj.document_title,
                  formLocked: statusObj.formLocked || false,
                });
              }
              updateReactData({
                masterPeopleList: reactData.masterPeopleList,
                masterFormList: reactData.masterFormList,
              }, false);
              if (reactData.isEditing.calledFrom === 'people') {
                await personForms(reactData.isEditing.person_id);
              }
              else {
                await formPeople(reactData.isEditing.form_id);
              }
            }
            updateReactData({
              isEditing: false
            }, true);
          }}
        />
      }
      {
        reactData.showQuickSearch &&
        <QuickSearch
          reactData={reactData}
          updateReactData={updateReactData}
          options={{
            pickOne: true,
            showAll: true
          }}
          onClose={async (selections) => {
            if (selections && (selections.length > 0)) {
              updateReactData({
                showQuickSearch: false,
                selectedForm_id: false,
                selectedFormRec: false,
                selectedFormMembers: false,
                selectedPerson_id: selections[0].person_id,
                selectedPersonRec: await getPerson(selections[0].person_id,),
              }, true);
              await personForms(selections[0].person_id);
            }
            else {
              updateReactData({
                showQuickSearch: false,
              }, true);
            }
          }}
        />
      }
      {
        reactData.sendMessage &&
        <MessageForm
          pPerson={state.session.patient_id}
          pClient={state.session.client_id}
          pMessageList={[]}
          pSession={state.session}
          onReset={() => {
            updateReactData({
              sendMessage: false
            }, true);
          }}
          options={{
            newMessage: true,
            recipients: reactData.sendMessage.map(r => {
              return {
                person_id: r.person_id,
                person_name: r.person_name
              };
            }),
            subject: reactData.sendMessage[0].subject,
            messageText: reactData.sendMessage[0].messageText || ''
          }}
        />
      }
      {
        reactData.editFormGroups &&
        <Dialog
          open={true}
          maxWidth="sm"
          fullWidth
          classes={{
            paper: classes.paperPallette
          }}
          style={{
            borderRadius: '30px 30px 30px 30px',
          }}
        >
          <DialogContent style={{ display: 'flex', flexDirection: 'column', height: '70vh' }}>
            <DialogContentText
              style={{
                ...AVATextStyle({
                  size: 1.4,
                  bold: true,
                  margin: { bottom: 1, top: 1, left: 0.5 }
                }),
                flexShrink: 0
              }}
            >
              {`Assign "${reactData.editFormGroups.form_name}" to Groups`}
            </DialogContentText>
            <Typography
              style={{
                ...AVATextStyle({
                  size: 1,
                  margin: { bottom: 1.5, top: 0.5, left: 0.5 },
                  color: 'textSecondary'
                }),
                flexShrink: 0
              }}
            >
              Select which groups should have access to this form:
            </Typography>
            <Paper component={Box} elevation={0} overflow='auto' square style={{ flex: '1 1 auto', minHeight: 0 }}>
              {state.groups && state.groups.adminHierarchy && (() => {
                // Helper function to get all children of a group
                const getAllChildren = (parentId) => {
                  const children = [];
                  state.groups.adminHierarchy.forEach(g => {
                    if (g.belongs_to === parentId) {
                      children.push(g.id);
                      children.push(...getAllChildren(g.id));
                    }
                  });
                  return children;
                };

                // Helper function to get direct children
                const getDirectChildren = (parentId) => {
                  return state.groups.adminHierarchy.filter(g => g.belongs_to === parentId).map(g => g.id);
                };

                // Helper function to check if group should be visible
                const isGroupVisible = (group) => {
                  if (group.level === 0) return false;
                  if (group.level === 1) return true;

                  // Check if all ancestors are expanded
                  let current = group;
                  while (current.level > 1) {
                    const belongsTo = current.belongs_to;
                    const parent = state.groups.adminHierarchy.find(g => g.id === belongsTo);
                    if (!parent) return false;
                    if (reactData.editFormGroups.collapsedGroups?.includes(parent.id)) {
                      return false;
                    }
                    current = parent;
                  }
                  return true;
                };

                // Helper function to determine checkbox state (checked, unchecked, indeterminate)
                const getCheckboxState = (group) => {
                  const isChecked = reactData.editFormGroups.groupList.includes(group.id);
                  const children = getAllChildren(group.id);

                  // RULE: If parent is checked, always show as checked (not indeterminate)
                  if (isChecked) {
                    return { checked: true, indeterminate: false };
                  }

                  // Parent not checked - check children status
                  if (children.length === 0) {
                    // No children: simple unchecked
                    return { checked: false, indeterminate: false };
                  }

                  const selectedChildren = children.filter(childId =>
                    reactData.editFormGroups.groupList.includes(childId)
                  );

                  // Some (but not all) children selected = indeterminate
                  if (selectedChildren.length > 0 && selectedChildren.length < children.length) {
                    return { checked: false, indeterminate: true };
                  }
                  // All children selected (but not parent) = show indeterminate to indicate implicit selection
                  else if (selectedChildren.length === children.length && children.length > 0) {
                    return { checked: false, indeterminate: true };
                  }
                  // Nothing selected = unchecked
                  else {
                    return { checked: false, indeterminate: false };
                  }
                };

                return state.groups.adminHierarchy.map((group, idx) => {
                  if (!isGroupVisible(group)) return null;

                  const hasChildren = getDirectChildren(group.id).length > 0;
                  const isCollapsed = reactData.editFormGroups.collapsedGroups?.includes(group.id);
                  const checkboxState = getCheckboxState(group);
                  const isSelected = reactData.editFormGroups.groupList.includes(group.id);

                  return (
                    <Box
                      key={`group_row_${idx}`}
                      display='flex'
                      flexDirection='row'
                      alignItems='center'
                      style={{ width: '100%', margin: '4px 0' }}
                    >
                      {/* Expand/Collapse Icon */}
                      <Box style={{ width: '24px', marginLeft: `${(group.level - 1) * 20}px` }}>
                        {hasChildren ? (
                          isCollapsed ? (
                            <ChevronRightIcon
                              style={{ cursor: 'pointer', fontSize: '20px' }}
                              onClick={() => {
                                const newCollapsed = [...(reactData.editFormGroups.collapsedGroups || [])];
                                const idx = newCollapsed.indexOf(group.id);
                                if (idx > -1) {
                                  newCollapsed.splice(idx, 1);
                                }
                                updateReactData({
                                  editFormGroups: {
                                    ...reactData.editFormGroups,
                                    collapsedGroups: newCollapsed
                                  }
                                }, true);
                              }}
                            />
                          ) : (
                            <ExpandMoreIcon
                              style={{ cursor: 'pointer', fontSize: '20px' }}
                              onClick={() => {
                                const newCollapsed = [...(reactData.editFormGroups.collapsedGroups || [])];
                                if (!newCollapsed.includes(group.id)) {
                                  newCollapsed.push(group.id);
                                }
                                updateReactData({
                                  editFormGroups: {
                                    ...reactData.editFormGroups,
                                    collapsedGroups: newCollapsed
                                  }
                                }, true);
                              }}
                            />
                          )
                        ) : null}
                      </Box>

                      {/* Checkbox and Label */}
                      <FormControlLabel
                        style={{ flexGrow: 1, marginLeft: 0 }}
                        control={
                          <Checkbox
                            checked={checkboxState.checked}
                            indeterminate={checkboxState.indeterminate}
                            onChange={async (e) => {
                              const newGroupList = [...reactData.editFormGroups.groupList];

                              if (e.target.checked) {
                                // Add this group
                                if (!newGroupList.includes(group.id)) {
                                  newGroupList.push(group.id);
                                }

                                // Find and add all children (groups with this group as parent)
                                const findChildren = (parentId) => {
                                  state.groups.adminHierarchy.forEach(g => {
                                    if (g.belongs_to === parentId && !newGroupList.includes(g.id)) {
                                      newGroupList.push(g.id);
                                      // Recursively find children of this child
                                      findChildren(g.id);
                                    }
                                  });
                                };
                                findChildren(group.id);
                              } else {
                                // Only remove this group, leave children unchanged
                                const idx = newGroupList.indexOf(group.id);
                                if (idx > -1) {
                                  newGroupList.splice(idx, 1);
                                }
                              }

                              updateReactData({
                                editFormGroups: {
                                  ...reactData.editFormGroups,
                                  groupList: newGroupList
                                }
                              }, true);
                            }}
                            color="primary"
                          />
                        }
                        label={
                          <Typography
                            style={{
                              ...AVATextStyle({ size: 1, bold: isSelected })
                            }}
                          >
                            {group.name}
                          </Typography>
                        }
                      />
                    </Box>
                  );
                });
              })()}
            </Paper>
          </DialogContent>
          <DialogActions className={classes.buttonArea}>
            <Button
              className={AVAClass.AVAButton}
              onClick={() => {
                updateReactData({ editFormGroups: false }, true);
              }}
              style={{ backgroundColor: 'gray', color: 'white' }}
              size='small'
              startIcon={<CloseIcon fontSize="small" />}
            >
              Cancel
            </Button>
            <Button
              className={AVAClass.AVAButton}
              onClick={async () => {
                // Update each group's forms array
                const form_id = reactData.editFormGroups.form_id;
                let newGroupList = [...reactData.editFormGroups.groupList];
                //                const oldGroupList = reactData.masterFormList[form_id].groupList || [];

                // VALIDATION: Clean up orphaned parents
                // If a parent is selected but NONE of its children are, remove the parent
                // This ensures data consistency and prevents the DB issue
                const getAllChildren = (parentId) => {
                  const children = [];
                  const findChildren = (pid) => {
                    state.groups.adminHierarchy.forEach(g => {
                      if (g.belongs_to === pid) {
                        children.push(g.id);
                        findChildren(g.id);
                      }
                    });
                  };
                  findChildren(parentId);
                  return children;
                };

                const cleanedGroupList = newGroupList.filter(groupId => {
                  const group = state.groups.adminHierarchy.find(g => g.id === groupId);
                  if (!group) return true; // Keep if we can't find it (shouldn't happen)

                  const children = getAllChildren(groupId);
                  if (children.length === 0) {
                    // No children - keep it
                    return true;
                  }

                  // Has children - only keep if at least one child is selected
                  const hasSelectedChild = children.some(childId => newGroupList.includes(childId));
                  return hasSelectedChild;
                });

                newGroupList = cleanedGroupList;

                // Get all groups
                const allGroups = await dbClient
                  .query({
                    KeyConditionExpression: 'client_id = :c',
                    TableName: 'Groups',
                    ExpressionAttributeValues: {
                      ':c': state.session.client_id,
                    }
                  })
                  .promise()
                  .catch(error => {
                    cl(`Error reading Groups; error is ${error}`);
                  });

                if (recordExists(allGroups)) {
                  for (let groupRec of allGroups.Items) {
                    const shouldHaveForm = newGroupList.includes(groupRec.group_id);
                    const currentlyHasForm = groupRec.forms && groupRec.forms.includes(form_id);

                    if (shouldHaveForm && !currentlyHasForm) {
                      // Add form to group
                      if (!groupRec.forms) groupRec.forms = [];
                      groupRec.forms.push(form_id);

                      await dbClient
                        .put({
                          Item: groupRec,
                          TableName: 'Groups'
                        })
                        .promise()
                        .catch(error => {
                          cl(`Error updating group ${groupRec.group_id}: ${error}`);
                        });
                    } else if (!shouldHaveForm && currentlyHasForm) {
                      // Remove form from group
                      const idx = groupRec.forms.indexOf(form_id);
                      if (idx > -1) {
                        groupRec.forms.splice(idx, 1);

                        await dbClient
                          .put({
                            Item: groupRec,
                            TableName: 'Groups'
                          })
                          .promise()
                          .catch(error => {
                            cl(`Error updating group ${groupRec.group_id}: ${error}`);
                          });
                      }
                    }
                  }
                }

                // Update local state
                reactData.masterFormList[form_id].groupList = newGroupList;

                // Force rebuild of member list to reflect new group assignments
                reactData.masterFormList[form_id].build_complete = false;

                // If this form is currently selected, refresh the people list immediately BEFORE closing dialog
                if (reactData.selectedForm_id === form_id) {
                  console.log('🔄 Refreshing people list after group assignment change...');
                  await formPeople(form_id);
                }

                // Close dialog and show success message
                updateReactData({
                  editFormGroups: false,
                  masterFormList: reactData.masterFormList,
                  masterPeopleList: reactData.masterPeopleList,
                  progressMessage: '',
                  alert: {
                    severity: 'success',
                    message: `Group assignments updated for ${reactData.editFormGroups.form_name}`
                  }
                }, true);
              }}
              style={{ backgroundColor: 'green', color: 'white' }}
              size='small'
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      }
      {
        reactData.viewPeopleMaintenance &&
        <PeopleMaintenance
          person_id={reactData.viewPeopleMaintenance}
          initialValues={{ color: 'green' }}
          options={{}}
          onClose={() => {
            updateReactData({
              viewPeopleMaintenance: false
            }, true);
          }}
        />
      }
      <DialogActions className={classes.buttonArea} >
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
        {false &&
          <Button
            variant="contained"
            color="primary"
            size="small"
            style={{
              borderRadius: '20px',
              textTransform: 'none',
              marginRight: '16px'
            }}
            onClick={() => {
              const newForm = {
                client_id: state.session.client_id,
                form_id: `form_${Date.now()}`,
                form_name: 'New Form',
                category: '',
                sections: [],
                fields: {}
              };
              updateReactData({
                showFormEditor: true,
                formEditorRecord: newForm
              }, true);
            }}
          >
            + New Form
          </Button>
        }
      </DialogActions>
      {reactData.showFormEditor && (
        <Dialog
          open={true}
          onClose={() => updateReactData({ showFormEditor: false }, true)}
          classes={{
            paper: classes.paperPallette
          }}
          PaperProps={{
            style: {
              width: '80vw',
              maxWidth: '80vw',
              minWidth: 400,
            },
          }}
          style={{
            borderRadius: ('25px 25px 25px 25px'),
          }}
        >
          <DialogContent>
            <FormEditor
              form={reactData.formEditorRecord}
              onSave={async (updatedForm) => {
                // Save to Forms table
                const putSpec = {
                  TableName: 'Forms',
                  Item: updatedForm
                };
                await putDb(putSpec);
                updateReactData({ showFormEditor: false }, true);
                // Reload the form list to include the new/updated form
                await initialize();
              }}
              onCancel={() => updateReactData({ showFormEditor: false }, true)}
            />
          </DialogContent>
        </Dialog>
      )}
      {reactData.alert &&
        <Snackbar
          open={!!reactData.alert}
          px={3}
          key={`alert_wrapper`}
          autoHideDuration={(reactData.alert.severity === 'success') ? 5000 : ((reactData.alert.severity === 'info') ? 15000 : null)}
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
            style={{ marginX: '8px', borderRadius: '20px', border: 1 }}
            action={(reactData.alert.action
              ?
              <Box
                display='flex'
                key={`alert_action`}
                mx={1}
                overflow='auto'
                flexDirection='column'
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
            {reactData.alert.title && <AlertTitle>{reactData.alert.title}</AlertTitle>}
            {reactData.alert.message}
          </Alert>
        </Snackbar >
      }
    </Dialog >
  );
};
