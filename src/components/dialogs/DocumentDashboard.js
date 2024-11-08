import React from 'react';
import { cl, dbClient, recordExists, makeArray, array_in_array } from '../../util/AVAUtilities';
import { makeDate, addDays } from '../../util/AVADateTime';
import { getPerson } from '../../util/AVAPeople';
import AVAConfirm from '../forms/AVAConfirm';
import FormFill from '../forms/FormFill';
import useSession from '../../hooks/useSession';
import { getAllOccurrences, getCalendarEntries } from '../../util/AVACalendars';
import PrintIcon from '@material-ui/icons/Print';

import CloseIcon from '@material-ui/icons/HighlightOff';
import AddIcon from '@material-ui/icons/Add';
import Button from '@material-ui/core/Button';
import { Dialog, DialogActions, DialogContent, IconButton } from '@material-ui/core';

import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';

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
  AVAMicroButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(0),
    marginTop: theme.spacing(0),
    marginBottom: theme.spacing(0),
    padding: theme.spacing(0),
    height: '16px',
    width: '16px',
    borderRadius: '32px',
    variant: 'outlined',
    textTransform: 'none',
    textDecoration: 'none',
    border: '0.75px solid gray',
    size: 'small',
    '& .MuiSvgIcon-root': {
      fontSize: '0.8rem',
    }
  },
  AVAMicroButtonClean: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(0),
    marginTop: theme.spacing(0),
    marginBottom: theme.spacing(0),
    padding: theme.spacing(0),
    height: '16px',
    width: '16px',
    textTransform: 'none',
    textDecoration: 'none',
    size: 'small',
    '& .MuiSvgIcon-root': {
      fontSize: '0.8rem',
    }
  },
  freeInput: {
    marginLeft: '2px',
    marginRight: 2,
    marginBottom: theme.spacing(1),
    marginTop: theme.spacing(1),
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: theme.spacing(1),
    width: '90%',
    verticalAlign: 'middle',
    fontSize: theme.typography.fontSize * 0.4,
  },
  imageArea: {
    minWidth: '50px',
    maxWidth: '50px',
    minHeight: '50px',
    maxHeight: '50px',
    marginRight: theme.spacing(1),
  },
  personArea: {
    marginTop: '20px',
    minHeight: '30px',
    maxHeight: '50px',
  },
  formControlLbl: {
    marginRight: 0,
    marginTop: 0,
    marginBottom: 0,
    marginLeft: 2,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: theme.spacing(2),
    paddingLeft: 0,
    paddingRight: 5,
  },
  buttonArea: {
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
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
    alignItems: 'start',
    justifyContent: 'flex-start',
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    marginLeft: theme.spacing(0),
    marginRight: theme.spacing(0),
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

export default ({ request = {}, onClose }) => {
  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { state } = useSession();

  let options = {};
  if (Array.isArray(request)) {
    request.forEach((req) => {
      if (typeof (req) === 'string') {
        let [key, value] = req.split('=');
        options[key] = value;
      }
      else {
        Object.assign(options, req);
      }
    });
  }
  else if (typeof (request) === 'string') {
    options.formTypeList = [request];
  }
  else {
    options = Object.assign({}, request);
  }

  /*
    expect options to contain
      formTypeList []   when missing, use *all
      formNoAdd []    if a form is in this list, do not allow "create new"... view only for that form type
       formNotAlone []    if this is the only form type in the list, ignore it
      peopleList []       can be *self, *user, *person, *all, or list of person_id's  (default *person)
      assignedToList []      can be *nobody, *self, *user, *person, *anybody, *nobody, or list of person_id's  (default null - don't care if assigned or not)
  */

  const handleAbort = () => {
    onClose();
  };

  const makeAssignedList = () => {
    if (!options.assignedToList) { return null; }
    return makeArray(options.assignedToList).map(aList => {
      if (aList === '*self') { return state.patient.person_id; }
      if (aList === '*person') { return state.patient.person_id; }
      if (aList === '*user') { return state.patient.user_id; }
      return aList;
    });
  };

  const [reactData, setReactData] = React.useState({
    formType_filter: options.formTypeList || ['*all'],
    formNoAdd: (options.formNoAdd ? makeArray(options.formNoAdd) : []),
    formNotAlone: (options.formNotAlone ? makeArray(options.formNotAlone) : []),
    formMaxToShow: (options.formMaxToShow ? Number(options.formMaxToShow) : 999),
    people_filter: makeArray(options.peopleList) || ['*person'],
    assignedTo_filter: makeAssignedList(),
    user_fontSize: AVADefaults({ fontSize: 'get' }) || 1.5,
    publishedOnly: (options.hasOwnProperty('publishedOnly') ? options.publishedOnly : false),
    document_date: {
      from_date: (options.hasOwnProperty('document_date') ? makeDate(options.document_date.from_date).numeric : 0),
      to_date: (options.hasOwnProperty('document_date') ? makeDate(options.document_date.to_date).numeric : 99990000),
    },
    initialized: false,
    documentList: [],
    stage: 'initialize',
    version__number: 0,
  });

  const determineMode = (this_document) => {
    if (reactData.stage === 'printDoc') { return 'print'; };
    if (reactData.stage === 'addDoc') { return 'add'; };
    if (!isIncomplete(this_document)) { return 'view'; };
    if (isNotStarted(this_document)) { return 'not_started'; };
    return 'incomplete';
  };

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) {
      setForceRedisplay(!forceRedisplay);
    }
  };

  const isIncomplete = (this_document) => {
    if (!this_document.hasOwnProperty('incomplete')) {
      return false;
    }
    else if (typeof this_document.incomplete === 'boolean') {
      return this_document.incomplete;
    }
    else if ((this_document.incomplete === 'true')
      || (this_document.incomplete === 'incomplete')
      || (this_document.incomplete === 'not_started')
    ) {
      return true;
    }
    else {
      return false;
    }
  };

  const isNotStarted = (this_document) => {
    if ((!this_document.hasOwnProperty('incomplete'))
      || (typeof this_document.incomplete === 'boolean')) {
      return false;
    }
    else {
      return (this_document.incomplete === 'not_started');
    }
  };

  React.useEffect(() => {
    async function initialize() {
      await loadDocuments();
      updateReactData({
        initialized: true,
        stage: 'complete'
      }, true);
      setForceRedisplay('ready');
    }
    if (reactData.stage === 'initialize') {
      initialize();
    }
    else if (reactData.stage === 'exit') {
      console.log('exit')
    }
  }, [reactData.stage]);  // eslint-disable-line react-hooks/exhaustive-deps


  // **********************************


  async function loadDocuments() {
    let queryObj = await makeQueryObj();
    let loopCount = 0;
    let unSortedList = [];
    let formLibrary = [];
    let rememberedNames = {};
    let rememberedPeople = {};
    let rememberedForms = {};
    if (reactData.formType_filter.includes('*none')) {
      formLibrary = [
        {
          form_id: '*all',
          form_name: 'All Forms',
          form_expanded: true
        }
      ];
      rememberedForms['*all'] = 'All Forms';
    }
    else {
      let formResult = await dbClient
        .query({
          TableName: 'Forms',
          KeyConditionExpression: 'client_id = :c',
          ExpressionAttributeValues: { ':c': state.session.client_id }
        })
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`Error reading ${queryObj.TableName} id ${error}`);
        });
      if (recordExists(formResult)) {
        formResult.Items.forEach(this_form => {
          if ((!this_form.hasOwnProperty('active') || this_form.active)
            && ((reactData.formType_filter.includes('*all')) || (reactData.formType_filter.includes(this_form.form_id)))) {
            formLibrary.push(this_form);
            if (!rememberedForms.hasOwnProperty(this_form.form_id)) {
              rememberedForms[this_form.form_id] = this_form.form_name;
            }
          }
        });
        formLibrary.sort((a, b) => {
          return (((a.sequence || 10) < (b.sequence || 10)) ? 1 : -1);
        });
      }
    }
    let queryResult;
    do {
      queryResult = await dbClient
        .query(queryObj)
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`Error reading ${queryObj.TableName} id ${error}`);
        });
      if (recordExists(queryResult)) {
        unSortedList = unSortedList.concat(queryResult.Items);
        let { sortedList, rememberedSelections } = await makeSortedObj(unSortedList);
        updateReactData({
          documentList: sortedList,
          rememberedSelections,
          stage: 'building'
        }, true);
        if (queryResult.LastEvaluatedKey) {
          queryObj.ExclusiveStartKey = queryResult.LastEvaluatedKey;
        }
        else {
          delete queryObj.ExclusiveStartKey;
        }
      }
      else {
        delete queryObj.ExclusiveStartKey;
        updateReactData({
          stage: 'building'
        }, true);
      }
      loopCount++;
    } while (queryObj.ExclusiveStartKey && (loopCount < 10));
    return;

    async function makeSortedObj(rawList) {
      let rememberedSelections = {};
      let buildDocList = [];
      for (let d = 0; d < rawList.length; d++) {
        // skip if necessary
        let this_document = rawList[d];
        if (reactData.assignedTo_filter) {
          if (this_document.assigned_to && (this_document.assigned_to.length > 0)) {
            // this_document is assigned to one or more people
            if (reactData.assignedTo_filter.includes('*nobody')) { continue; }
            if (reactData.assignedTo_filter.includes('*anybody')) { }
            else if (!array_in_array(reactData.assignedTo_filter, this_document.assigned_to)) { continue; }
          }
          else {
            // this_document isn't assigned to anyone
            if (!reactData.assignedTo_filter.includes('*nobody')) { continue; }
          }
        }
        let this_slot, this_event, this_date, this_person;
        this_slot = this_document.document_id.split('%%').pop();
        if (this_slot) {
          [this_event, this_date, this_person] = this_slot.split('#');
          if (reactData.document_date.from_date) {
            if ((reactData.document_date.from_date > this_date) || (reactData.document_date.to_date < this_date)) {
              continue;
            }
          }
        }
        if (reactData.publishedOnly) {
          if (this_slot) {
            if (this_person) {
              let this_eventOccurrence = await getCalendarEntries({
                client_id: this_document.client_id,
                event_id: this_event,
                occurrence_id: this_date,
                type: 'occurrence'
              });
              if (!this_eventOccurrence[0] || !this_eventOccurrence[0].published) {
                continue;
              }
              else {
                cl('doc found');
              }
            }
          }
        }
        const documentMatchesForm = (this_form) => { return ((this_document.form_id === this_form.form_id) || (this_form.form_id === '*all')); };
        let foundAt = buildDocList.findIndex(this_docObj => {
          return (this_docObj.person_id === this_document.person_id);
        });
        if (foundAt === -1) {
          // this is the first time we've encoutered this person; add them to the buildDocList with forms and this_document 
          if (!rememberedNames.hasOwnProperty(this_document.person_id)) {
            let personResult = await getPerson(this_document.person_id);
            if (!personResult) {
              rememberedNames[this_document.person_id] = {
                id: this_document.person_id,
                display_name: this_document.person_id,
                lastName: this_document.person_id,
                firstName: ''
              };
            }
            else {
              rememberedPeople[this_document.person_id] = personResult;
              rememberedNames[this_document.person_id] =
              {
                id: this_document.person_id,
                display_name: (personResult.name
                  ? (`${personResult.name.first.trim()} ${personResult.name.last.trim()}`)
                  : (personResult.display_name || personResult.person_id)),
                lastName: personResult?.name?.last?.trim(),
                firstName: personResult?.name?.first?.trim()
              }
                ;
            }
          }
          if (!rememberedForms.hasOwnProperty(this_document.form_id)) {
            rememberedForms[this_document.form_id] = await makeFormName(this_document);
          }
          let newPerson = {
            person_id: this_document.person_id,
            person_name: rememberedNames[this_document.person_id].display_name,
            person_last: rememberedNames[this_document.person_id].lastName,
            person_first: rememberedNames[this_document.person_id].firstName,
            person_incompleteDoc_count: (isIncomplete(this_document) ? 1 : 0),
            person_expanded: reactData?.rememberedSelections?.[this_document.person_id]?.expanded || false,
            formTypes: []
          };
          rememberedSelections[this_document.person_id] = {
            expanded: newPerson.person_expanded,
            formType_expanded: {}
          };
          formLibrary.forEach(this_form => {
            if ((this_form.form_id === '*all')
              || !this_form.hasOwnProperty('valid_for')
              || (rememberedPeople.hasOwnProperty(this_document.person_id)
                && rememberedPeople[this_document.person_id].groups
                && rememberedPeople[this_document.person_id].groups.some(this_group => {
                  return (this_form.valid_for.includes(this_group));
                })
              )) {
              let isExpanded = reactData.rememberedSelections?.[this_document.person_id]?.formType_expanded?.[this_form.form_id] || false;

              newPerson.formTypes.push({
                form_id: this_form.form_id,
                form_expanded: isExpanded,
                form_incompleteDoc_count: (documentMatchesForm(this_form) && isIncomplete(this_document)) ? 1 : 0,
                form_name: rememberedForms[this_form.form_id],
                documentList: (documentMatchesForm(this_form) ? [this_document] : [])
              });
              rememberedSelections[this_document.person_id].formType_expanded[this_form.form_id] = isExpanded;
            }
          });
          buildDocList.push(newPerson);
        }
        else {
          let foundForm = buildDocList[foundAt].formTypes.findIndex(this_form => {
            return documentMatchesForm(this_form);
          });
          if (foundForm < 0) {
            // this is the first time we've encoutered this form for this person; add the form to the buildDocList with this_document 
            if (!rememberedForms.hasOwnProperty(this_document.form_id)) {
              rememberedForms[this_document.form_id] = await makeFormName(this_document);
            }
            let isExpanded = reactData.rememberedSelections?.[this_document.person_id]?.formType_expanded?.[this_document.form_id] || false;
            buildDocList[foundAt].formTypes.push({
              form_id: this_document.form_id,
              form_expanded: isExpanded,
              form_incompleteDoc_count: (isIncomplete(this_document) ? 1 : 0),
              form_name: rememberedForms[this_document.form_id],
              documentList: [this_document]
            });
            if (isIncomplete(this_document)) {
              buildDocList[foundAt].person_incompleteDoc_count++;
            }
          }
          else {
            // the person and the form were already here; add this_document to the list
            buildDocList[foundAt].formTypes[foundForm].documentList.push(this_document);
            if (isIncomplete(this_document)) {
              buildDocList[foundAt].person_incompleteDoc_count++;
              buildDocList[foundAt].formTypes[foundForm].form_incompleteDoc_count++;
            }
          }
        }
      };
      buildDocList.forEach((personObj, pNdx) => {
        let typeList = [];
        personObj.formTypes.forEach((this_type, fX) => {
          if (this_type.documentList.length > 0) {
            typeList.push(this_type.form_id);
          }
          this_type.documentList = this_type.documentList.map(this_doc => {
            let aSplit = this_doc.document_id.split('%%');
            if (aSplit[2]) {
              this_doc.sort = aSplit[2].split('#')[1];
            }
            else if (this_doc.completed_timestamp) {
              this_doc.sort = this_doc.completed_timestamp;
            }
            else if (this_doc.title) {
              this_doc.sort = this_doc.title;
            }
            else {
              this_doc.sort = this_doc.document_id;
            }
            return this_doc;
          });
          let sortedForms = this_type.documentList.sort((a, b) => {
            return ((a.sort > b.sort) ? 1 : -1);
          });
          buildDocList[pNdx].formTypes[fX].documentList = sortedForms;
        });
        if ((typeList.length === 1) && (reactData.formNotAlone.includes(typeList[0]))) {
          buildDocList.splice(pNdx, 1);
        }
      });
      buildDocList.sort((a, b) => {
        if ((a.person_last < b.person_last)) {
          return -1;
        }
        else if ((a.person_last > b.person_last)) {
          return 1;
        }
        else {
          return ((a.person_first < b.person_first) ? -1 : 1);
        }
      });
      return { sortedList: buildDocList, rememberedSelections };
    }

    async function makeFormName(this_document) {
      let formRec = await dbClient
        .get({
          Key: {
            client_id: this_document.client_id || state.session.client_id,
            form_id: this_document.form_id
          },
          TableName: "Forms"
        })
        .promise()
        .catch(error => {
          cl(`***ERR reading Groups*** caught error is: ${error}`, this_document.form_id);
        });
      if (!recordExists(formRec)) {
        return this_document.form_id;
      }
      else {
        return formRec.Item.form_name;
      }
    }

    async function makeQueryObj() {
      let queryObj = { TableName: 'Documents' };
      queryObj.KeyConditionExpression = 'client_id = :c';
      queryObj.ExpressionAttributeValues = { ':c': state.session.client_id };
      queryObj.ScanIndexForward = false;
      /*
        expect reactData to contain
          formType_filter []   list or *all
          people_filter []       *self, *user, *person, *all, or list of person_id's
          assignedTo_filter []     *none, *self, *user, *person, *all, or list of person_id's
      */
      if (!reactData.formType_filter.includes('*all') && !reactData.formType_filter.includes('*none')) {
        // selecting on form type - use form id index and filter on people and assigned to
        //      queryObj.IndexName = 'form_id-index';
        queryObj.FilterExpression = 'form_id in (';
        reactData.formType_filter.forEach((filter, ndx) => {
          queryObj.FilterExpression += `${ndx > 0 ? ', ' : ''}:t${ndx}`;
          queryObj.ExpressionAttributeValues[`:t${ndx}`] = filter;
        });
        queryObj.FilterExpression += ')';
        queryObj = await peopleFilter(queryObj);
      }
      else {
        if (!reactData.people_filter.includes('*all')) {
          if (reactData.people_filter.length === 1) {
            queryObj.KeyConditionExpression += ' and begins_with (document_id, :p)';
            switch (reactData.people_filter[0]) {
              case '*user': {
                queryObj.ExpressionAttributeValues[':p'] = `${state.session.user_id}%%`;
                break;
              }
              case '*self':
              case '*person': {
                queryObj.ExpressionAttributeValues[':p'] = `${state.patient.person_id}%%`;
                break;
              }
              default: {
                queryObj.ExpressionAttributeValues[':p'] = `${reactData.people_filter[0]}%%`;
              }
            }
          }
          else {
            queryObj.FilterExpression = 'person_id in (';
            reactData.people_filter.forEach((filter, ndx) => {
              queryObj.KeyConditionExpression += `${ndx > 0 ? ', ' : ''}:p${ndx}`;
              switch (filter) {
                case '*user': {
                  queryObj.ExpressionAttributeValues[`:p${ndx}`] = state.session.user_id;
                  break;
                }
                case '*self':
                case '*person': {
                  queryObj.ExpressionAttributeValues[`:p${ndx}`] = state.patient.person_id;
                  break;
                }
                default: {
                  queryObj.ExpressionAttributeValues[`:p${ndx}`] = filter;
                }
              }
            });
            queryObj.FilterExpression += ')';
          }
        }
      }
      return queryObj;
    }

    async function peopleFilter(queryObj) {
      if (!reactData.people_filter.includes('*all')) {
        if (queryObj.FilterExpression) {
          queryObj.FilterExpression += ' and ';
        }
        else {
          queryObj.FilterExpression = '';
        }
        queryObj.FilterExpression += 'person_id in (';
        let count = 0;
        for (let ndx = 0; ndx < reactData.people_filter.length; ndx++) {
          let filter = reactData.people_filter[ndx];
          switch (filter) {
            case '*user': {
              queryObj.FilterExpression += `${ndx > 0 ? ', ' : ''}:p${ndx}`;
              queryObj.ExpressionAttributeValues[`:p${ndx}`] = state.session.user_id;
              break;
            }
            case '*self':
            case '*person': {
              queryObj.FilterExpression += `${ndx > 0 ? ', ' : ''}:p${ndx}`;
              queryObj.ExpressionAttributeValues[`:p${ndx}`] = state.patient.person_id;
              break;
            }
            case '*calendar': {
              let today = new Date();
              let startDate = addDays(today, -2);
              let endDate = addDays(today, 35);
              let oList = await getAllOccurrences(
                {
                  client_id: state.session.client_id,
                  start_date: startDate,
                  end_date: endDate,
                  filter: { slot_owner: [state.patient.person_id] }
                }, (() => { })
              );
              console.log(oList);
              let personList = [];
              for (let this_date in oList) {
                for (let this_event in oList[this_date].events) {
                  for (let this_slotOwner in oList[this_date].events[this_event].slot_owners) {
                    if (!personList.includes(this_slotOwner)) {
                      personList.push(this_slotOwner);
                      count++;
                      queryObj.FilterExpression += `${count > 1 ? ', ' : ''}:p${ndx}_${count}`;
                      queryObj.ExpressionAttributeValues[`:p${ndx}_${count}`] = this_slotOwner;
                    }
                  }
                }
              }
              break;
            }
            default: {
              queryObj.ExpressionAttributeValues[`:p${ndx}`] = filter;
            }
          }
        };
        queryObj.FilterExpression += ')';
      }
      return queryObj;
    }
  };


  // **********************************

  const personRow = ({ this_person, personNdx }) => {
    return (
      <Box
        display='flex'
        flexDirection='row'
        alignItems={'center'}
        justifyContent={'space-between'}
        className={classes.personArea}
        onClick={() => {
          reactData.documentList[personNdx].person_expanded = !this_person.person_expanded;
          reactData.rememberedSelections[this_person.person_id].expanded = reactData.documentList[personNdx].person_expanded;
          updateReactData({
            documentList: reactData.documentList,
            rememberedSelections: reactData.rememberedSelections
          }, true);
        }}
      >
        <Box
          display='flex'
          flexDirection='row'
          justifyContent='flex-start'
          alignItems='flex-end'
        >
          <Typography
            key={`person__${this_person.person_last}`}
            style={AVATextStyle({
              size: 1.3,
              bold: true,
              margin: {
                left: 0
              }
            })}>
            {this_person.person_last}
          </Typography>
          {this_person.person_first &&
            <Typography
              key={`person__${this_person.person_first}`}
              style={AVATextStyle({
                size: 1.2,
                margin: {
                  left: 0.2
                }
              })}>
              {this_person.person_first}
            </Typography>
          }
        </Box>
        {(this_person.formTypes.length > 0) &&
          <Typography
            key={`person__hide_${this_person.person_name}`}
            style={AVATextStyle({
              size: 0.5,
              bold: true,
              margin: {
                left: 0
              },
              color: (((this_person.person_incompleteDoc_count > 0) && !this_person.person_expanded) ? 'red' : '')
            })}>
            {`${this_person.formTypes.length} form${(this_person.formTypes.length > 1) ? 's' : ''}`}
          </Typography>
        }
      </Box>
    );
  };

  const formRow = ({ this_person, personNdx, this_form, formNdx }) => {
    return (
      <Box
        display='flex'
        flexDirection='row'
        alignItems={'center'}
        justifyContent={'space-between'}
        marginTop={1}
      >
        <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
          <IconButton
            className={classes.AVAMicroButton}
            size={'small'}
            onClick={() => {
              if (!reactData.formNoAdd.includes(this_form.form_id)) {
                updateReactData({
                  stage: 'addDoc',
                  selectedForm_id: this_form.form_id,
                  selectedPerson_id: this_person.person_id
                }, true);
              }
            }}
          >
            <AddIcon />
          </IconButton>
          <Typography
            key={`form__${personNdx}_${formNdx}`}
            onClick={() => {
              reactData.documentList[personNdx].formTypes[formNdx].form_expanded = !this_form.form_expanded;
              reactData.rememberedSelections[this_person.person_id].formType_expanded[this_form.form_id] = reactData.documentList[personNdx].formTypes[formNdx].form_expanded;
              updateReactData({
                documentList: reactData.documentList,
                rememberedSelections: reactData.rememberedSelections
              }, true);
            }}
            style={AVATextStyle({
              size: 1,
              margin: {
                left: 0.5
              }
            })}>
            {this_form.form_name}
          </Typography>
        </Box>
        {(this_form.documentList.length > 0) &&
          <Typography
            key={`person__hide_${this_person.person_name}`}
            onClick={() => {
              reactData.documentList[personNdx].formTypes[formNdx].form_expanded = !this_form.form_expanded;
              reactData.rememberedSelections[this_person.person_id].formType_expanded[this_form.form_id] = reactData.documentList[personNdx].formTypes[formNdx].form_expanded;
              updateReactData({
                documentList: reactData.documentList,
                rememberedSelections: reactData.rememberedSelections
              }, true);
            }}
            style={AVATextStyle({
              size: 0.5,
              bold: false,
              margin: {
                left: 0
              },
              color: (((this_form.form_incompleteDoc_count > 0) && !this_form.form_expanded) ? 'red' : '')
            })}>
            {`${this_form.documentList.length} document${(this_form.documentList.length > 1) ? 's' : ''}`}
          </Typography>
        }
      </Box>
    );
  };

  const documentRow = ({ this_document, documentNdx, this_person, personNdx, formNdx, shortForm }) => {
    return (
      <Box
        key={`docFrag__${personNdx}_${formNdx}_${documentNdx}`}
        display='flex'
        flexDirection='row'
        alignItems={'center'}
        justifyContent={'space-between'}
      >
        <Typography
          key={`doc__${personNdx}_${formNdx}_${documentNdx}`}
          onClick={() => {
            updateReactData({
              stage: 'viewDoc',
              signatureData: ((this_document.signature_field && (this_document.signature_field.length > 0))
                ? (Array.isArray(this_document.signature_field) ? (this_document.signature_field.map(this_sig => {
                  return this_document.values[this_sig];
                })) : this_document.values[this_document.signature_field])
                : null
              ),
              selectedDoc: this_document,
              selectedPerson_id: this_person.person_id,
              selectedDoc_id: this_document.document_id,
              incomplete: isIncomplete(this_document)
            }, true);
          }}
          style={AVATextStyle({
            size: 0.8, margin: {
              bottom: 0.5,
              left: shortForm ? 0.5 : 2
            },
            color: (isIncomplete(this_document) ? 'red' : '')
          })}>
          {`${this_document.title || makeDate(this_document.completed_timestamp).absolute}${isIncomplete(this_document) ? ' (incomplete)' : ''}`}
        </Typography>
        <IconButton
          className={classes.AVAMicroButtonClean}
          size={'small'}
          onClick={() => {
            updateReactData({
              stage: 'printDoc',
              signatureData: ((this_document.signature_field && (this_document.signature_field.length > 0))
                ? (Array.isArray(this_document.signature_field) ? (this_document.signature_field.map(this_sig => {
                  return this_document.values[this_sig];
                })) : this_document.values[this_document.signature_field])
                : null
              ),
              selectedDoc: this_document,
              selectedPerson_id: this_person.person_id,
              selectedDoc_id: this_document.document_id,
              incomplete: this_document.incomplete
            }, true);
          }}
        >
          <PrintIcon />
        </IconButton>
      </Box>
    );
  };

  // **********************************


  // ******************

  return (
    <Dialog
      open={(reactData.version > 0) || true}
      key={`wholeScreen__${reactData?.formRec?.form_name || 'notReady'}`}
      onClose={handleAbort}
      classes={{ paper: classes.radius_rounded }}
      fullScreen
    >
      {(reactData.stage !== 'initialize') &&
        <React.Fragment>
          <Box m={2}>
            <Typography style={AVATextStyle({
              size: 1.8, bold: true, margin: {
                bottom: 1,
                top: 1,
              }
            })}>
              Documents
            </Typography>
          </Box>
          <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
            {(reactData.documentList.length === 0) &&
              <Typography style={AVATextStyle({
                size: 1.2,
                margin: {
                  bottom: 1,
                  top: 1,
                },
                align: 'center'
              })}>
                No Documents Found
              </Typography>
            }
            {reactData.documentList.map((this_person, personNdx) => (
              <React.Fragment
                key={`personFrag__${this_person.person_name}`}
              >
                {personRow({ this_person, personNdx })}
                {(reactData.assignedTo_filter || this_person.person_expanded) &&
                  this_person.formTypes.map((this_form, formNdx) => (
                    <React.Fragment
                      key={`formFrag__${personNdx}_${formNdx}`}
                    >
                      {!reactData.assignedTo_filter &&
                        <React.Fragment>
                          {formRow({ this_person, personNdx, this_form, formNdx })}
                          {this_form.form_expanded && !reactData.formNoAdd.includes(this_form.form_id) &&
                            <Typography
                              key={`doc__${personNdx}_${formNdx}_addNew`}
                              onClick={() => {
                                updateReactData({
                                  stage: 'addDoc',
                                  selectedForm_id: this_form.form_id,
                                  selectedPerson_id: this_person.person_id
                                }, true);
                              }}
                              style={AVATextStyle({
                                size: 0.8, margin: {
                                  top: 0.5,
                                  bottom: 0.5,
                                  left: 2
                                },
                              })}>
                              {`Add a new ${this_form.form_name}`}
                            </Typography>
                          }
                        </React.Fragment>
                      }
                      {(reactData.assignedTo_filter || this_form.form_expanded)
                        && this_form.documentList.map((this_document, documentNdx) => (
                          (documentNdx < reactData.formMaxToShow)
                            ? documentRow({ this_document, documentNdx, this_person, personNdx, this_form, formNdx, shortForm: !!reactData.assignedTo_filter })
                            : null
                        ))
                      }
                    </React.Fragment>
                  ))}
              </React.Fragment>
            ))}
          </DialogContent>
          <DialogActions className={classes.buttonArea} >
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={() => {
                onClose();
              }}
              startIcon={<CloseIcon fontSize="small" />}
            >
              {'Exit'}
            </Button>
          </DialogActions>
        </React.Fragment>
      }
      {((reactData.stage === 'viewDoc') || (reactData.stage === 'printDoc')) &&
        <FormFill
          request={{
            document_id: reactData.selectedDoc_id,
            person_id: reactData.selectedPerson_id,
            signatureImage: (!reactData.incomplete ? reactData.signatureData : null),
            mode: determineMode(reactData.selectedDoc),
          }}
          onClose={(formStatus) => {
            if (formStatus === 'timeout') {
              updateReactData({
                stage: 'exit'
              }, true);
              handleAbort();
            }
            else {
              updateReactData({
                stage: ((formStatus === 'docAdded') ? 'initialize' : 'fill')
              }, true);
            }
          }}
        />
      }
      {(reactData.stage === 'addDoc') &&
        <FormFill
          request={{
            form_id: reactData.selectedForm_id,
            person_id: reactData.selectedPerson_id,
            mode: 'new'

          }}
          onClose={(formStatus) => {
            if (formStatus === 'timeout') {
              updateReactData({
                stage: 'exit'
              }, true);
              handleAbort();
            }
            else {
              updateReactData({
                stage: ((formStatus === 'docAdded') ? 'initialize' : 'fill')
              }, true);
            }
          }}
        />
      }
      {(reactData.stage === 'error') &&
        <AVAConfirm
          promptText={['Error', 'Something went wrong', ...reactData.errorMessage]}
          cancelText={'Try again'}
          confirmText={'*none*'}
          onCancel={() => {
            updateReactData({
              stage: 'fill'
            }, true);
          }}
        />
      }
    </Dialog>
  );
};