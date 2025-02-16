import React from 'react';

import useSession from '../../hooks/useSession';

import { getMemberList } from '../../util/AVAGroups';
import { dbClient, recordExists, cl } from '../../util/AVAUtilities';
import QuickSearch from '../sections/QuickSearch';
import { getPerson, getImage } from '../../util/AVAPeople';
import PeopleMaintenance from '../dialogs/PeopleMaintenance';
import { addDays, makeDate } from '../../util/AVADateTime';

import { Snackbar, Paper, TextField, Box, Dialog, DialogActions, Button, Typography } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab/';

import makeStyles from '@material-ui/core/styles/makeStyles';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import CloseIcon from '@material-ui/icons/ExitToApp';
import PeopleIcon from '@material-ui/icons/People';
import SettingsIcon from '@material-ui/icons/Settings';
import SendIcon from '@material-ui/icons/Send';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';
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

  const [activity_filter, setActivityFilter] = React.useState('');
  const [lower_activity_filter, setLowerFilter] = React.useState('');

  const [reactData, setReactData] = React.useState({
    alert: false,
    window_width: 1,
    administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),

    // from defaults
    agendaView: defaults.agendaView,
    allowAssign: defaults.allowAssign,
    assignmentList: defaults.assignmentList,
    assignmentView: defaults.assignmentView,
    viewOnly: defaults.viewOnly,




    anchorEl: null,
    building: 'not started',
    defaults,
    denseView: false,
    display_name: state.patient?.name?.first || 'My',
    event_being_edited: false,
    filterTextLower: null,
    isDarkMode: useMediaQuery('(prefers-color-scheme: dark)'),
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
    'https://theseus-medical-storage.s3.amazonaws.com/public/patients/tboone.jpg';

  const onImageError = (e) => {
    e.target.src = placeholderImage;
  };

  // const autoFocus = (element) => element?.focus();

  const classes = useStyles();
  const AVAClass = AVAclasses();

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  const handleChangeActivityFilter = event => {
    setActivityFilter(event.target.value);
    setLowerFilter(event.target.value.toLowerCase());
  };

  function OKtoShow(inObj) {
    if (!lower_activity_filter) { return true; }
    if (inObj.hasOwnProperty('group_name')) {
      if (inObj.group_name.toLowerCase().includes(lower_activity_filter)) {
        return true;
      }
    }
    return (inObj.group_id.toLowerCase().includes(lower_activity_filter));
  };

  async function personForms(this_person) {
    reactData.masterPeopleList[this_person] = {};
    for (let this_form in reactData.masterFormList) {
      if (reactData.masterFormList[this_form].groupList.some(g => { return reactData.selectedPersonRec.groups.includes(g); })) {
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
        buildMasters(this_doc);
      }
    }
    updateReactData({
      masterPeopleList: reactData.masterPeopleList,
      masterFormList: reactData.masterFormList
    }, true);
  }

  function buildMasters(this_doc) {
    if ((this_doc.restricted_access === 'admin_only') && (!reactData.administrative_account)) {
      return;    // skip this document
    }
    if (!reactData.masterFormList[this_doc.form_type].hasOwnProperty('memberList')) {
      reactData.masterFormList[this_doc.form_type].memberList = {};
    }
    if (!reactData.masterFormList[this_doc.form_type].memberList.hasOwnProperty(this_doc.pertains_to)) {
      reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to] = {
        person_id: this_doc.pertains_to,
        person_name: `${reactData.selectedPersonRec.name.first} ${reactData.selectedPersonRec.name.last}`,
        person_first: reactData.selectedPersonRec.name.first,
        person_last: reactData.selectedPersonRec.name.last,
        wipDocs: [],
        assignedDocs: [],
        completedDocs: [],
      };
    };
    if (!reactData.masterPeopleList.hasOwnProperty(this_doc.pertains_to)) {
      reactData.masterPeopleList[this_doc.pertains_to] = {};
    }
    if (this_doc.history[0].last_update === 0) {
      let splitter = this_doc.document_id.split('#');
      this_doc.history[0].last_update = splitter[splitter.length - 1];
    }
    if (this_doc.status === 'complete') {
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
    else {
      reactData.masterFormList[this_doc.form_type].memberList[this_doc.pertains_to].assignedDocs.push({
        document_id: this_doc.document_id,
        last_update: this_doc.history[0].last_update,
        due_date: this_doc.due_date || reactData.masterFormList[this_doc.form_type].dueDate,
        title: this_doc.title
      });
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
    let allDocs = await dbClient
      .query({
        KeyConditionExpression: 'client_id_form_type = :p',
        IndexName: 'client_form_person-index',
        TableName: 'DocumentMaster',
        ExpressionAttributeValues: {
          ':p': `${state.session.client_id}%%${this_form}`
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
        buildMasters(this_doc);
      }
    }
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
          form_name: formRec.form_name,
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
      {Object.keys(reactData.masterFormList).length === 0
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
            {`No Forms to show for ${state.session.user_display_name}`}
          </Typography>
        </Box>
        :
        <React.Fragment>
          <Box style={{ borderRadius: '30px 30px 30px 30px', marginRight: '16px' }}
            key={'topRow'}
            display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'
          >
            <Box
              key={'topBox'}
              display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'
            >
              <Typography
                className={classes.title}
                style={AVATextStyle({ size: 1.3, bold: true, margin: { top: 1.5, left: 1, right: 1 } })}
                id='scroll-dialog-title'
              >
                {'Select a form from this list'}
              </Typography>
              <TextField
                style={{
                  marginLeft: '25px',
                  marginRight: '16px',
                  marginBottom: '16px',
                  paddingLeft: 0,
                  paddingRight: 0,
                  paddingBottom: '8px',
                  width: '40%',
                  verticalAlign: 'middle',
                  fontSize: 0.4,
                  minHeight: 2.8,
                }}
                id='List Filter'
                value={activity_filter}
                className={classes.freeInput}
                onChange={handleChangeActivityFilter}
                helperText={'Filter Forms'}
                inputProps={{ style: { fontSize: `${user_fontSize}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                variant={'standard'}
                autoComplete='off'
              />
            </Box>
            <PeopleIcon
              style={{ marginRight: '32px' }}
              onClick={() => {
                updateReactData({ showQuickSearch: true }, true);
              }}
            />
          </Box>

          {/*   TOP SECTION PEOPLE WITH IMAGES
          {reactData.assignmentList && (reactData.assignmentList.length > 0) &&
            <Paper component={Box} variant='outlined' style={{ scrollbarWidth: 'thin' }} height={'130px'} minHeight={'fit-content'} width='100%' overflow='auto' square>
              <List component={'nav'} >
                <Box
                  key={`candidates`}
                  mx={1}
                  display='flex'
                  justifyContent='flex-start'
                  alignItems='center'
                  flexDirection='row'
                >
                  {reactData.assignmentList && reactData.assignmentList.map((this_candidate, cX) => (
                    <Box
                      key={`candidate-${cX}`}
                      mx={1}
                      display='flex'
                      justifyContent='center'
                      alignItems='center'
                      flexDirection='column'
                      borderRadius={'45px 45px 45px 45px'}
                      paddingTop={'8px'}
                      paddingRight={'4px'}
                      paddingBottom={'16px'}
                      paddingLeft={'4px'}
                      draggable={state.session?.adminAccount}
                      onDragStart={(e) => handleDragStart(e, {
                        person_id: this_candidate.person_id,
                        personObj: this_candidate,
                        listIndex: cX
                      })}
                      onClick={async () => {
                        updateReactData({
                          selectedGroup_id: false,
                          selectedGroupRec: false,
                          seletedGroupMembers: false,
                          selectedPerson_id: this_candidate.person_id,
                          selectedPersonRec: await getPerson(this_candidate.person_id),
                          selectedPersonFirstName: this_candidate.first_name,
                          selectedPersonLastName: this_candidate.last_name,
                        }, true);
                      }}
                    >
                      <Avatar className={classes.assignment_avatar}
                        style={((this_candidate.person_id === reactData.selectedPerson_id) || (reactData.selectedGroup_id && (reactData.selectedGroupMembers.hasOwnProperty(this_candidate.person_id))))
                          ? {
                            borderRadius: '20px',
                            boxShadow: '0 0 20px 5px rgba(255, 145, 0, 0.7)'
                          }
                          : {}
                        }
                        src={getImage(this_candidate.person_id)}
                      >
                        {`${this_candidate.first_name.slice(0, 1)}${this_candidate.last_name.slice(0, 1)}`}
                      </Avatar>
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
                    </Box>
                  ))}
                </Box>
              </List>
            </Paper>
          }
          */}

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
                    (OKtoShow(reactData.masterFormList[this_formID]) &&
                      <React.Fragment key={`frag_${listIndex}`}>
                        <Box
                          key={`activity-list_${listIndex}_1`}
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
                            }, true);
                          }}
                        >
                          <Typography
                            key={`g_text_${listIndex}_0`}
                            style={AVATextStyle({
                              size: 1.2,
                              margin: { left: 0, top: 0, bottom: 0.8 },
                            })}>
                            {reactData.masterFormList[this_formID].form_name}
                          </Typography>
                        </Box>
                      </React.Fragment>
                    )
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
                  onDragStart={(e) => handleDragStart(e, {
                    person_id: reactData.selectedPerson_id,
                    person_name: `${reactData.selectedPersonRec.name.first} ${reactData.selectedPersonRec.name.last}`,
                  })}
                  style={{ width: '100%' }}
                >
                  <Box display='flex' flexDirection='row'
                    flexGrow={1}
                    justifyContent='flex-start'
                    alignItems='center'
                  >
                    <Typography
                      key={`g_text_end-last_name`}
                      draggable={true}
                      style={Object.assign({},
                        AVATextStyle({
                          size: 1.5,
                          overflow: 'visible',
                          bold: true,
                          margin: { top: 1, bottom: 1, right: 0 },
                        }), { textWrap: 'nowrap' }
                      )}
                    >
                      {`${reactData.selectedPersonRec.name.first} ${reactData.selectedPersonRec.name.last}`}
                    </Typography>
                    <Typography
                      key={`g_text_end-last_tag`}
                      style={Object.assign({},
                        AVATextStyle({
                          size: 1.5,
                          overflow: 'visible',
                          bold: true,
                        }), { textWrap: 'nowrap' }
                      )}
                    >
                      {`'${reactData.selectedPersonRec.name.last.trim().endsWith('s') ? '' : 's'} Forms`}
                    </Typography>
                  </Box>
                  <Box
                    key={'my_image_box'}
                    style={{ marginRight: '16px' }}
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
                >
                  <Box display='flex' flexDirection='column'
                    justifyContent='flex-start'
                    alignItems='flex-start'
                  >
                    {reactData.masterPeopleList.hasOwnProperty(reactData.selectedPerson_id) &&
                      Object.keys(reactData.masterPeopleList[reactData.selectedPerson_id]).map((this_form, gX) => (
                        <Typography
                          key={`g_text_end_group-${gX}`}
                          style={AVATextStyle({
                            size: 1.2,
                            margin: { top: 0, bottom: 0.8 },
                            color: ((!reactData.masterPeopleList.hasOwnProperty(reactData.selectedPerson_id))
                              ? 'red'
                              : (!reactData.masterPeopleList[reactData.selectedPerson_id].hasOwnProperty(this_form)
                                ? 'red'
                                : ((reactData.masterPeopleList[reactData.selectedPerson_id][this_form].status === 'completed')
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
                            }, true);
                          }}
                        >
                          {`${reactData.masterFormList[this_form].form_name}`}
                        </Typography>
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
                    if (draggedFrom.hasOwnProperty('personObj')) {
                      sendMessage.push({
                        person_id: draggedFrom.personObj.person_id,
                        person_name: `${draggedFrom.personObj.name.first} ${draggedFrom.personObj.name.last}`
                      });
                    }
                    else {
                      sendMessage.push({
                        group_id: draggedFrom.group_id,
                        group_name: draggedFrom.groupObj.group_name
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
                    justifyContent='flex-start'
                    alignItems='flex-start'
                  >
                    {reactData.masterFormList[reactData.selectedForm_id] && Object.keys(reactData.masterFormList[reactData.selectedForm_id].memberList).sort((a, b) => {
                      return (reactData.masterFormList[reactData.selectedForm_id].memberList[a].person_name > reactData.masterFormList[reactData.selectedForm_id].memberList[b].person_name) ? 1 : -1;
                    }).map((this_person, cX) => (
                      <Typography
                        key={`g_textpeople-${cX}`}
                        style={AVATextStyle({
                          overflow: 'visible',
                          size: 1.2,
                          margin: { top: 0, bottom: 0.8 },
                          color: ((!reactData.masterPeopleList.hasOwnProperty(this_person))
                            ? 'red'
                            : (!reactData.masterPeopleList[this_person].hasOwnProperty(reactData.selectedForm_id)
                              ? 'red'
                              : ((reactData.masterPeopleList[this_person][reactData.selectedForm_id].status === 'completed')
                                ? 'green'
                                : ((reactData.masterPeopleList[this_person][reactData.selectedForm_id].status === 'not started')
                                  ? 'red'
                                  : 'orange')
                              )))
                        })}
                        onClick={async () => {
                          updateReactData({
                            selectedForm_id: false,
                            selectedFormRec: false,
                            selectedFormMembers: false,
                            selectedPerson_id: this_person,
                            selectedPersonRec: await getPerson(this_person),
                          }, true);
                          await personForms(this_person);
                        }}
                        draggable={state.session?.adminAccount}
                        onDragStart={(e) => handleDragStart(e, {
                          person_id: this_person,
                          person_name: `${reactData.masterFormList[reactData.selectedForm_id].memberList[this_person].person_name}`
                        })}
                      >
                        {`${reactData.masterFormList[reactData.selectedForm_id].memberList[this_person].person_name}`}
                      </Typography>
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
                    sendMessage.push({
                      person_id: draggedFrom.person_id,
                      person_name: draggedFrom.person_name
                    });
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
          pPerson={state.session.person_id}
          pClient={state.session.client_id}
          pMessageList={[]}
          pSession={state.session}
          onReset={() => {
            updateReactData({
              sendMessage: false
            }, true);
          }}
          options={{
            newMessage: reactData.sendMessage
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
