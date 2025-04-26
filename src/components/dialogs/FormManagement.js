import React from 'react';

import useSession from '../../hooks/useSession';

import { getMemberList } from '../../util/AVAGroups';
import { dbClient, recordExists, cl, titleCase } from '../../util/AVAUtilities';
import QuickSearch from '../sections/QuickSearch';
import { getPerson, getImage, makeName } from '../../util/AVAPeople';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import { addDays, makeDate } from '../../util/AVADateTime';
import FormFillB from '../forms/FormFillB';
import { createDocument } from '../../util/AVADocuments';

import { Snackbar, Paper, Box, Dialog, DialogActions, Button, Typography } from '@material-ui/core';
import Select from "react-dropdown-select";
import { Alert, AlertTitle } from '@material-ui/lab/';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import CloseIcon from '@material-ui/icons/ExitToApp';
import PeopleIcon from '@material-ui/icons/People';
import SettingsIcon from '@material-ui/icons/Settings';
import SendIcon from '@material-ui/icons/Send';

import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import EditIcon from '@material-ui/icons/Edit';
import VisibilityIcon from '@material-ui/icons/Visibility';

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
    loading: false,
    masterFormList: {},
    masterPeopleList: {},
    needRef: false,
    newGroups: {},
    popUpOpen: false,
    progressMessage: 'Building Group List',
    pWidth: 60,
    rowLimit: 50,
    selectDate: null,
    selectedPerson_id: null,
    selectedPersonRec: false,
    selectedPersonFirstName: '',
    selectedPersonLastName: '',
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
  };

  function OKtoShow(this_person, this_form, display_data) {
    if (!reactData.lower_activity_filter) { return true; }
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
    return (display_data.toLowerCase().includes(reactData.lower_activity_filter));
  };

  async function personForms(this_person) {
    reactData.masterPeopleList[this_person] = {};
    for (let this_form in reactData.masterFormList) {
      if (reactData.masterFormList[this_form].hasOwnProperty('groupList') &&
        reactData.masterFormList[this_form].groupList.some(g => { return reactData.selectedPersonRec.groups.includes(g); })) {
        reactData.masterPeopleList[this_person][this_form] = {
          status: 'not started',
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
          wipDocs: [],
          dated_docs: false,
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

  async function buildMasters(this_doc) {
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
      let goodPerson = await makeName(this_doc.pertains_to);
      if (goodPerson) {
        reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to] = {
          person_id: this_doc.pertains_to,
          person_name: goodPerson,
          person_first: `${this_doc.pertains_to}`,
          person_last: `${this_doc.pertains_to}`,
          wipDocs: [],
          assignedDocs: [],
          dated_docs: false,
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
    let eventDate = makeDate(this_doc.event_key ? this_doc.event_key.split('#')[1] : null);
    if ((!eventDate.error)) {
      reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].assignedDocs.push({
        document_id: this_doc.document_id,
        last_update: this_doc.history[0].last_update,
        due_date: this_doc.due_date || reactData.masterFormList[this_doc.form_type].dueDate,
        title: this_doc.title,
        event_date: eventDate.error ? null : eventDate.numeric,
        event_displayDate: eventDate.error ? null : eventDate.dateOnly,
        event_key: this_doc.event_key,
        location: this_doc.history[0].url,
        status: this_doc.status
      });
      reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].dated_docs = true;
      reactData.masterFormList[this_doc.form_type].dated_docs = true;
    }
    if (this_doc.status.startsWith('complete')) {
      const completed_count = reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].completedDocs.length;
      const cObj = {
        document_id: this_doc.document_id,
        location: this_doc.history[0].url,
        last_update: this_doc.history[0].last_update,
        date_completed: makeDate(this_doc.history[0].last_update).relative,
        title: this_doc.title,
        amendments: this_doc.amendments
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
          title: this_doc.title
        });
      }
      else {
        reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].wipDocs.push({
          document_id: this_doc.document_id,
          last_update: this_doc.history[0].last_update,
          doc_status: this_doc.status,
          due_date: this_doc.due_date || reactData.masterFormList[this_doc.form_type].dueDate,
          title: this_doc.title
        });
      }
    }
  }

  async function formPeople(this_form) {    // gathers all the people tha should (or do) have this form
    if (!reactData.masterFormList[this_form].hasOwnProperty('groupList')) {
      return;
    }
    reactData.masterFormList[this_form].memberList = {};
    reactData.masterPeopleList = {};
    for (let this_group of reactData.masterFormList[this_form].groupList) {
      let response = await getMemberList(this_group, state.session.client_id, { "exclude": false });
      for (let this_member of response.peopleList) {
        reactData.masterFormList[this_form].memberList[this_member.person_id] = {
          person_id: this_member.person_id,
          person_name: `${this_member.name.first} ${this_member.name.last}`,
          person_first: this_member.name.first,
          person_last: this_member.name.last,
          wipDocs: [],
          dated_docs: false,
          assignedDocs: [],
          completedDocs: [],
        };
        reactData.masterPeopleList[this_member.person_id] = {
          [this_form]: {
            status: 'not started',
            last_update: 0
          }
        };
      }
    }

    // get all Documents for this form type
    let today_ymd = makeDate(new Date()).numeric;
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
      let workingOn = null;
      let docList = [];
      if (recordExists(allDocs)) {
        for (const this_doc of allDocs.Items) {
          if (workingOn !== this_doc.pertains_to) {
            if (docList.length > 0) {
              docList.sort((a, b) => { return ((a.occDate > b.occDate) ? -1 : 1); });
              for (let i = 0; ((i < 14) && (i < docList.length)); i++) {
                await buildMasters(docList[i]);
              }
            }
            docList = [];
            workingOn = this_doc.pertains_to;
          }
          let occDate;
          if (this_doc.occurrence) {
            occDate = this_doc.occurrence;
          }
          else {
            let splitter = this_doc.document_id.split('#');
            let candidate = Number(splitter[splitter.length - 1]);
            if (!isNaN(candidate)) {
              occDate = candidate;
            }
            else {
              occDate = 0;
            }
          }
          if (occDate <= today_ymd) {
            this_doc.occDate = occDate;
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
    updateReactData({
      masterPeopleList: reactData.masterPeopleList,
      masterFormList: reactData.masterFormList
    }, true);
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
        if (!formRec.active) { continue; }
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
        masterFormList[formRec.form_id] = {
          form_id: formRec.form_id,
          form_name: formRec.form_name || `Form ${titleCase(formRec.form_id.replace(/[^a-zA-z0-9]|_/g, ' '))}`,
          groupList: [],  // all the groups that require this form
          options: formRec.options || {},
          dueDate: date_assigned,
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
    let sortedForms = Object.keys(masterFormList).sort((a, b) => {
      return (masterFormList[a].form_name < masterFormList[b].form_name ? -1 : 1);
    });

    updateReactData({
      sortedForms,
      masterFormList,
      formsInitialized: true
    }, true);
  }

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
              <Paper component={Box} elevation={0} overflow='auto' square
                style={{ scrollbarWidth: 'none', flexGrow: 1, display: 'flex' }}
              >
                <Box display='flex' flexDirection='column'
                  justifyContent='flex-start'
                  alignItems='flex-start'
                >
                  {reactData.sortedForms.map((this_formID, listIndex) => (
                    <React.Fragment key={`frag_${listIndex}`}>
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
                        <Typography
                          key={`g_text_${listIndex}_0_${reactData.selectedPerson_id}`}
                          draggable={!!reactData.selectedPerson_id}
                          onDragStart={(e) => handleDragStart(e, {
                            form_id: this_formID,
                            reason: 'createForm'
                          })}
                          onClick={async () => {
                            await formPeople(this_formID);
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
                              filterInProcess: false
                            }, true);
                          }}
                          style={AVATextStyle({
                            size: 1.2,
                            margin: { left: 0, top: 0 },
                          })}>
                          {reactData.masterFormList[this_formID].form_name}
                        </Typography>
                      </Box>
                    </React.Fragment>
                  ))}
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
                  style={{ scrollbarWidth: 'none', flexGrow: 1, display: 'flex' }}
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
                                color: (((reactData.masterPeopleList[reactData.selectedPerson_id]?.[this_form]?.status === 'not started') || (reactData.masterPeopleList[reactData.selectedPerson_id]?.[this_form]?.status.startsWith('complete')))
                                  ? 'red'
                                  : 'orange')
                              })}
                              size='small'
                            />
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
                                color: ((!reactData.masterPeopleList.hasOwnProperty(reactData.selectedPerson_id))
                                  ? 'red'
                                  : (!reactData.masterPeopleList[reactData.selectedPerson_id].hasOwnProperty(this_form)
                                    ? 'red'
                                    : ((reactData.masterPeopleList[reactData.selectedPerson_id][this_form].status.startsWith('complete'))
                                      ? 'green'
                                      : ((reactData.masterPeopleList[reactData.selectedPerson_id][this_form].status === 'not started')
                                        ? 'red'
                                        : 'orange')
                                    )))
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
                                  let nowJ = new Date().getTime();
                                  window.open(`${reactData.masterFormList[this_form].memberList[reactData.selectedPerson_id].completedDocs[0].location}?qt=${nowJ.toString()}`
                                    , reactData.masterFormList[this_form].memberList[reactData.selectedPerson_id].completedDocs[0].location);
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
                <Paper component={Box} width='100%' elevation={0} overflow='auto' square
                  style={{ scrollbarWidth: 'none', flexGrow: 1, display: 'flex' }}
                >
                  <Box display='flex' flexDirection='column'
                    key={`person_column`}
                    justifyContent='flex-start'
                    alignItems='flex-start'
                  >
                    {reactData.masterFormList[reactData.selectedForm_id] && Object.keys(reactData.masterFormList[reactData.selectedForm_id].memberList).sort((a, b) => {
                      return (reactData.masterFormList[reactData.selectedForm_id].memberList[a].person_name > reactData.masterFormList[reactData.selectedForm_id].memberList[b].person_name) ? 1 : -1;
                    }).map((this_person, cX) => (
                      (OKtoShow(this_person, reactData.selectedForm_id, reactData.masterFormList[reactData.selectedForm_id].memberList[this_person].person_name) &&
                        <Box display='flex' flexDirection='column'
                          key={`formperson_column_list_${cX}`}
                          style={{ marginBottom: '6px' }}
                          justifyContent='flex-start'
                          alignItems='flex-start'
                        >
                          <Box display='flex' flexDirection='row'
                            key={`formperson_row_list_${cX}`}
                            justifyContent='flex-start'
                            alignItems='center'
                            onContextMenu={async (e) => {
                              e.preventDefault();
                              updateReactData({
                                alert: {
                                  severity: 'info',
                                  title: `${reactData.masterFormList[reactData.selectedForm_id].memberList[this_person].person_name}`,
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
                            {!reactData.masterFormList[reactData.selectedForm_id].dated_docs &&
                              <EditIcon
                                key={`radio-button_person${cX}edit`}
                                id={`radio-button_person${cX}edit`}
                                onClick={() => {
                                  updateReactData({
                                    isEditing: {
                                      calledFrom: 'forms',
                                      person_id: this_person,
                                      form_id: reactData.selectedForm_id,
                                      document_id: ((reactData.masterPeopleList[this_person]?.[reactData.selectedForm_id]?.status.startsWith('complete')) ? 'new' : (reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.wipDocs[0]?.document_id || 'new'))
                                    }
                                  }, true);
                                }}
                                style={AVATextStyle({
                                  size: 1.5,
                                  margin: { right: 0.5 },
                                  color: (((reactData.masterPeopleList[this_person]?.[reactData.selectedForm_id]?.status === 'not started') || (reactData.masterPeopleList[this_person]?.[reactData.selectedForm_id]?.status === 'completed'))
                                    ? 'red'
                                    : 'orange')
                                })}
                                size='small'
                              />
                            }
                            {(!reactData.masterFormList[reactData.selectedForm_id].dated_docs || 
                              (reactData.masterPeopleList[this_person]?.[reactData.selectedForm_id]?.status.startsWith('complete')
                              && !reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.dated_docs) ||
                              (reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.assignedDocs.length > 0)
                            ) ?
                              <Typography
                                key={`g_textpeople-${cX}`}
                                style={AVATextStyle({
                                  overflow: 'visible',
                                  size: 1.2,
                                  margin: { top: 0 },
                                  color: (reactData.masterFormList[reactData.selectedForm_id].dated_docs
                                    ? 'black'
                                    : (
                                      ((!reactData.masterPeopleList.hasOwnProperty(this_person))
                                        ? 'red'
                                        : (!reactData.masterPeopleList[this_person].hasOwnProperty(reactData.selectedForm_id)
                                          ? 'red'
                                          : ((reactData.masterPeopleList[this_person][reactData.selectedForm_id].status.startsWith('complete'))
                                            ? 'green'
                                            : ((reactData.masterPeopleList[this_person][reactData.selectedForm_id].status === 'not started')
                                              ? 'red'
                                              : 'orange')
                                          )))
                                    ))
                                })}
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, {
                                  person_id: this_person,
                                  person_name: `${reactData.masterFormList[reactData.selectedForm_id].memberList[this_person].person_name}`,
                                  reason: 'form'
                                })}
                                onClick={async () => {
                                  updateReactData({
                                    selectedForm_id: false,
                                    selectedFormRec: false,
                                    selectedFormMembers: false,
                                    selectedPerson_id: this_person,
                                    selectedPersonRec: await getPerson(this_person),
                                    activity_filter: '',
                                    lower_activity_filter: '',
                                    filterComplete: false,
                                    filterNotStarted: false,
                                    filterInProcess: false
                                  }, true);
                                  await personForms(this_person);
                                }}
                              >
                                {`${reactData.masterFormList[reactData.selectedForm_id].memberList[this_person].person_name}`}
                              </Typography>
                              :
                              <Typography
                                key={`g_textpeople-${cX}`}
                                style={AVATextStyle({
                                  overflow: 'visible',
                                  size: 1.2,
                                  margin: { top: 0 },
                                  color: 'lightgray'
                                })}
                                draggable={true}
                                onDragStart={(e) => handleDragStart(e, {
                                  person_id: this_person,
                                  person_name: `${reactData.masterFormList[reactData.selectedForm_id].memberList[this_person].person_name}`,
                                  reason: 'form'
                                })}
                              >
                                {`${reactData.masterFormList[reactData.selectedForm_id].memberList[this_person].person_name}`}
                              </Typography>
                            }
                            {(reactData.masterPeopleList[this_person]?.[reactData.selectedForm_id]?.status.startsWith('complete'))
                              && !reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.dated_docs
                              &&
                              <CheckCircleIcon
                                key={`radio-button_person${cX}off`}
                                id={`radio-button_person${cX}off`}
                                style={AVATextStyle({
                                  color: 'green',
                                  size: 1,
                                  margin: { left: 0.5, right: 0.5 },
                                })}
                                onClick={() => {
                                  let nowJ = new Date().getTime();
                                  window.open(`${reactData.masterFormList[reactData.selectedForm_id].memberList[this_person].completedDocs[0].location}?qt=${nowJ.toString()}`
                                    , reactData.masterFormList[reactData.selectedForm_id].memberList[this_person].completedDocs[0].location);
                                }}
                                size='small'
                              />
                            }
                          </Box>
                          {reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.dated_docs &&
                            reactData.masterFormList[reactData.selectedForm_id].memberList?.[this_person]?.assignedDocs.sort((a, b) => {
                              return (a.event_date < b.event_date) ? 1 : -1;
                            }).map((this_assignedDoc, aX) => (
                              <Box display='flex' flexDirection='row'
                                key={`formdoc_row_list_${cX}_${aX}`}
                                justifyContent='flex-start'
                                alignItems='center'
                                style={{ marginLeft: '60px' }}
                                onClick={async () => {
                                  if (!this_assignedDoc.status.startsWith('complete')) {
                                    updateReactData({
                                      isEditing: {
                                        calledFrom: 'forms',
                                        person_id: this_person,
                                        form_id: reactData.selectedForm_id,
                                        document_id: this_assignedDoc.document_id
                                      }
                                    }, true);
                                  }
                                  else {
                                    let nowJ = new Date().getTime();
                                    window.open(`${this_assignedDoc.location}?qt=${nowJ.toString()}`
                                      , this_assignedDoc.location);
                                  }
                                }}
                              >
                                {!(this_assignedDoc.status.startsWith('complete'))
                                  ?
                                  <EditIcon
                                    key={`radio-button_person${cX}_${aX}edit`}
                                    id={`radio-button_person${cX}_${aX}edit`}
                                    style={AVATextStyle({
                                      size: 1,
                                      margin: { right: 0.5 },
                                      color: ((this_assignedDoc.status.startsWith('complete'))
                                        ? 'green'
                                        : (this_assignedDoc.status === 'not_started')
                                          ? 'red'
                                          : 'orange')
                                    })}
                                    size='small'
                                  />
                                  :
                                  <CheckCircleIcon
                                    key={`radio-button_person${cX}off`}
                                    id={`radio-button_person${cX}off`}
                                    style={AVATextStyle({
                                      color: 'green',
                                      size: 1,
                                      margin: { right: 0.5 },
                                    })}
                                    size='small'
                                  />
                                }
                                <Typography
                                  key={`g_docdate-${cX}_${aX}`}
                                  style={AVATextStyle({
                                    overflow: 'visible',
                                    size: 1,
                                    color: ((this_assignedDoc.status.startsWith('complete'))
                                      ? 'green'
                                      : (this_assignedDoc.status === 'not_started')
                                        ? 'red'
                                        : 'orange')
                                  })}
                                >
                                  {this_assignedDoc.event_displayDate}
                                </Typography>
                              </Box>
                            ))
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
            }
          </Box>

        </React.Fragment >
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
            }}
          onClose={async (ignore_me, statusObj) => {
            if (statusObj.document_status === 'work_in_process') {
              reactData.masterPeopleList[reactData.isEditing.person_id][reactData.isEditing.form_id].status = 'in_process';
              if (!reactData.masterFormList[reactData.isEditing.form_id].memberList.hasOwnProperty(reactData.isEditing.person_id)) {
                reactData.masterFormList[reactData.isEditing.form_id].memberList[reactData.isEditing.person_id] = {
                  person_id: reactData.isEditing.person_id,
                  person_name: reactData.isEditing.person_id,
                  person_first: reactData.isEditing.person_id,
                  person_last: reactData.isEditing.person_id,
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
                  title: statusObj.document_title
                });
              }
              else {
                reactData.masterFormList[reactData.isEditing.form_id].memberList[reactData.isEditing.person_id].wipDocs[0].document_id = statusObj.document_id;
              }
            }
            else if (statusObj.document_status.startsWith('complete')) {
              reactData.masterPeopleList[reactData.isEditing.person_id][reactData.isEditing.form_id].status = 'completed';
              if (!reactData.masterFormList[reactData.isEditing.form_id].memberList.hasOwnProperty(reactData.isEditing.person_id)) {
                reactData.masterFormList[reactData.isEditing.form_id].memberList[reactData.isEditing.person_id] = {
                  person_id: reactData.isEditing.person_id,
                  person_name: reactData.isEditing.person_id,
                  person_first: reactData.isEditing.person_id,
                  person_last: reactData.isEditing.person_id,
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
                title: statusObj.document_title
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
            messageText: reactData.sendMessage[0].messageText,
            attachmentList: reactData.sendMessage.map(a => {
              return a.attachmentList;
            }).flat(),
          }}
        />
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
      </DialogActions>;
      {
        reactData.alert &&
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
