import React from 'react';

import useSession from '../../hooks/useSession';
import { useSnackbar } from 'notistack';

import { getImage, getPerson, getSession } from '../../util/AVAPeople';
import { deepCopy, makeArray, cl, recordExists, dbClient, isEmpty, titleCase } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';

import makeStyles from '@material-ui/core/styles/makeStyles';
import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import FormFillB from './FormFillB';

import { Button, IconButton } from '@material-ui/core';
import { Dialog, DialogContent, DialogActions } from '@material-ui/core';
import { Box, Typography, Radio, Avatar } from '@material-ui/core';
import { Menu, MenuList, MenuItem } from '@material-ui/core';

import CloseIcon from '@material-ui/icons/HighlightOff';
import CheckIcon from '@material-ui/icons/Check';
import RadioButtonUncheckedIcon from '@material-ui/icons/RadioButtonUnchecked';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import HomeIcon from '@material-ui/icons/Home';
import GroupAddIcon from '@material-ui/icons/GroupAdd';
import EditIcon from '@material-ui/icons/Edit';

import AVATextInput from './AVATextInput';

const useStyles = makeStyles(theme => ({
  smallTextLine: {
    fontSize: theme.typography.fontSize * 1.0,
    flexGrow: 0,
    lineHeight: 1.25,
    whiteSpace: 'break-spaces'
  },
  messageArea: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  popUpFooter: {
    fontSize: theme.typography.fontSize * 0.8,
  },
  radioButton: {
    marginTop: 0,
    marginRight: 4,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 1,
  },
  freeInput: {
    marginLeft: theme.spacing(1),
    paddingLeft: 0,
    paddingRight: 0,
    flexGrow: 2,
    fontSize: theme.typography.fontSize * 1.3,
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  rootNoPadding: {
    paddingBottom: 0,
    paddingTop: 0,
  },
  inputRow: {
    marginTop: theme.spacing(1.5),
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
  },
  listItem: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  backGroundRed: {
    backgroundColor: 'red'
  },
  backGroundGreen: {
    backgroundColor: 'green'
  },
  backGroundNone: {
  },
  hiddenItem: {
    display: 'none',
    visibility: 'hidden'
  },
  listTopRow: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
  formControlTitle: {
    margin: 0,
    marginLeft: 0,
    marginRight: '2px',
    paddingTop: '16px',
    paddingBottom: 0,
    height: 1,
    fontSize: theme.typography.fontSize * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: '8px',
  },
  formControlCheckGroup: {
    marginTop: 0,
    paddingTop: 0,
    marginLeft: '32px'
  },
  listItemSticky: {   // keep
    position: 'sticky',
    top: 0,
    opacity: 1,
    overflowY: 'hidden',
    overflowX: 'auto',
    zIndex: 1,
    minHeight: '160px',
    maxHeight: '160px',
    width: '100%',
  },
  page: {
    // height: 950,
  },
  buttonArea: {
    width: '100%',
    justifyContent: 'center',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1)
  }
}));

export default ({ family_id, forms, options = {}, onSave, onClose }) => {

  /*
  forms as 
  { 
    : { <record_type>: [ {form_id: xxx}, {form_id: xxx}, ... ], <role>: [ {form_id: xxx}, {form_id: xxx}, ... ], ... },
    ...
  }
  */

  const classes = useStyles();
  const AVAClass = AVAclasses();
   const { enqueueSnackbar } = useSnackbar();

  const { state } = useSession();

  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [reactData, setReactData] = React.useState({
    stage: 'start',
    family_id,
    familyMembers: [],
    defaults: deepCopy(options),
    pertains_to: options.person_id || state.session.patient_id,
    newAccountForm: {},
    showCompleted: false,
    restrict_to_client_id: options.client_id || null,
    selectedColumn: 0,
    columnForms: [],
    forms,
    formList: []
  });

  const [popupMenuOpen, setPopupMenuOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleClick = async (event) => {
    setAnchorEl(event.currentTarget);
  };

  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
  };

  async function initialLoad() {
    if (!reactData.family_id) {
      let foundFamily = await dbClient
        .query({
          TableName: 'FamilyGroups',
          IndexName: 'person_id-index',
          KeyConditionExpression: 'client_id = :c AND person_id = :p',
          ExpressionAttributeValues: {
            ':c': state.session.client_id,
            ':p': reactData.pertains_to
          }
        })
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`Error reading FamilyGroups with key of ${state.session.client_id}/${reactData.pertains_to}: ${error}`);
        });
      if (recordExists(foundFamily)) {
        updateReactData({
          family_id: foundFamily.Items[0].family_id
        }, false);
      }
      else {
        // no Family ID was passed in and this account doesn't have a Family ID.
        // Create a Family and add this account as a new Caregiver
        const newFamilyID = `family_${new Date().getTime()}`;
        await dbClient
          .put({
            Item: {
              client_id: state.session.client_id,
              composite_key: newFamilyID,
              record_type: 'header',
              role: 'family',
              family_id: newFamilyID,
              family_name: (state?.patient?.name?.last
                ? `The ${state?.patient?.name?.last} Family`
                : 'My Family')
            },
            TableName: 'FamilyGroups'
          })
          .promise()
          .catch(error => {
            cl(`Bad put to Family. Error is: ${error}`);
            onClose();
          });
        await dbClient
          .put({
            Item: {
              client_id: state.session.client_id,
              composite_key: `${newFamilyID}%%${state.session.patient_id}`,
              family_id: newFamilyID,
              person_id: state.session.patient_id,
              record_type: 'person',
              role: options.role_if_new || 'caregiver'
            },
            TableName: 'FamilyGroups'
          })
          .promise()
          .catch(error => {
            cl(`Bad put to Family (person). Error is: ${error}`);
            onClose();
          });
        await dbClient
          .update({
            Key: { person_id: state.session.patient_id },
            UpdateExpression: 'set family_id = :f',
            ExpressionAttributeValues: {
              ':f': newFamilyID
            },
            TableName: "People",
          })
          .promise()
          .catch(error => { console.log(`caught error updating People; error is:`, error); });
        updateReactData({
          family_id: newFamilyID
        }, false);
      }
    }
    let qQ = {
      KeyConditionExpression: 'family_id = :f',
      ExpressionAttributeValues: { ':f': reactData.family_id },
      TableName: 'FamilyGroups',
      IndexName: 'family_id-index'
    };
    if (reactData.restrict_to_client_id) {
      qQ.KeyConditionExpression += ` and client_id = :c`;
      qQ.ExpressionAttributeValues[':c'] = reactData.restrict_to_client_id;
      qQ.IndexName = 'client-family-index';
    }
    let familyRecs = await dbClient
      .query(qQ)
      .promise()
      .catch(error => { cl(`Error reading FamilyGroups is: ${error}`, qQ); });
    let familyHeader = {};
    let familyMembers = [];
    if (recordExists(familyRecs)) {
      for (const this_familyRec of familyRecs.Items) {
        if (this_familyRec.record_type === 'header') {
          Object.assign(familyHeader, this_familyRec);
        }
        else if (this_familyRec.record_type === 'person') {
          let personRec = await getPerson(this_familyRec.person_id, '*all', true);
          let sessionRec = await getSession(this_familyRec.person_id);
          delete sessionRec.last_state;
          delete personRec.last_state;
          let this_columnNumber = familyMembers.push(Object.assign({}, this_familyRec, sessionRec, personRec)) - 1;
          if (this_familyRec.person_id === state.session.person_id) {
            reactData.selectedColumn = this_columnNumber;
          }
        }
      };
    }
    if (familyMembers.length === 0) {
      onClose();
    }
    if (isEmpty(familyHeader)) {
      const lastName = familyMembers[0]?.name?.last;
      familyHeader = {
        family_name: (lastName ? `The ${lastName} Family` : 'Our Family'),
        record_type: 'header',
      };
    }
    if (!familyHeader.hasOwnProperty('role')) {
      familyHeader.role = 'family';
    }
    if (!reactData.defaults.noFamilyColumn) {
      updateReactData({
        familyMembers: [familyHeader].concat(familyMembers),
        selectedColumn: reactData.selectedColumn || 0,
      }, false);
    }
    else {
      updateReactData({
        familyMembers,
        selectedColumn: reactData.selectedColumn || 0,
      }, false);
    }
    const this_formList = await makeFormList({
      selectedColumn: reactData.selectedColumn,
      client_id: state.session.client_id,
      role: reactData.familyMembers[0].role
    });
    updateReactData({
      formList: this_formList
    }, false);
    return {};
  };

  React.useEffect(() => {
    async function initialize() {
      updateReactData({ stage: 'initializing' }, false);
      await initialLoad();
      updateReactData({ stage: 'ready' }, true);
    }
    if (reactData.stage === 'start') {
      initialize();
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  function getRefValue({ selectedColumn, form_index, refField }) {
    let refValue;
    // is this value already on the current form?
    refValue = reactData.columnForms[selectedColumn][form_index].fields[refField]?.value?.data_value;
    if (!refValue) {
      // does it exist anywhere in the family column?
      for (let ndx = 0; ((ndx < reactData.columnForms[0].length) && !refValue); ndx++) {
        refValue = reactData.columnForms[0][ndx].fields[refField]?.value?.data_value;
      }
    }
    if (!refValue) {
      // does it exist on another form in this column?
      for (let ndx = 0; ((ndx < reactData.columnForms[selectedColumn].length) && !refValue); ndx++) {
        if (ndx !== form_index) {
          refValue = reactData.columnForms[selectedColumn][ndx].fields[refField]?.value?.data_value;
        }
      }
    }
    return refValue;
  }

  function prepareField({ selectedColumn, form_index, field_name, editMode }) {
    let fieldData = reactData.columnForms[selectedColumn][form_index].fields[field_name];
    let prompt = fieldData.prompt.ref;
    let data_value = fieldData.value.data_value;
    if (fieldData.value.hidden && fieldData.edit && fieldData.edit.reset && editMode) {
      data_value = null;
    }
    if ((!fieldData.value) || (!data_value)) {
      // in edit mode, default value comes from fieldData.edit
      if (editMode || fieldData.loaded) {
        fieldData.default = fieldData.edit;
      }
      // No value; does it have a default value?
      if (fieldData.default) {
        if (!data_value) {
          // does the referenced field exist on ANY other form?  (default ref must be a string)
          if (typeof (fieldData.default.ref) === 'string') {
            data_value = getRefValue({ selectedColumn, form_index, refField: fieldData.default.ref });
          }
        }
        if (!data_value) {
          // does the default reference exist in a database table we retrieved?
          // refs gives you the name of the field - or array with structure as in name.first is ['name','first'] 
          let refs = makeArray(fieldData.default.ref);
          if (refs.length > 0) {
            // familyMembers has already been loaded with SessionsV2 and People rec info for this person
            // if the field name referenced in refs is in familyMembers for this person, we'll use the
            // value from familyMembers as the default value for this column/person
            data_value = refs.reduce((remainingData, this_ref) => {
              if (this_ref === 'personRec') { return remainingData; }
              if (!remainingData) { return null; }
              return remainingData[this_ref];
            }, reactData.familyMembers[selectedColumn]);
            // if we weren't able to set a default based on the person's individual familyMembers record,
            // see if the field referenced in refs happens to be in the family information column
            // Family information is stored in the FamilyGroups "header" record.
            if (!data_value && (selectedColumn !== 0)) {
              data_value = refs.reduce((remainingData, this_ref) => {
                if (!remainingData) { return null; }
                return remainingData[this_ref];
              }, reactData.familyMembers[0]);
            }
          }
        }
        if (data_value) {
          // we got a value from the default.ref
          // does that value need to be manipulated based on the default type?
          switch (fieldData.default.type) {
            case 'ID': {
              let refWords = data_value.split(/\s+/);
              data_value = (refWords[0].replace(/[^a-zA-Z]/, '').slice(0, 1)
                + (refWords[1] ? refWords[1].replace(/[^a-zA-Z]/, '') : '')
                + '-' + state.session.client_id).toLowerCase();
              break;
            }
            case 'first': {
              let refWords = data_value.split(/\s+/);
              data_value = refWords[0];
              break;
            }
            case 'last': {
              let refWords = data_value.split(/\s+/);
              refWords.shift();
              data_value = refWords.join(' ');
              break;
            }
            default: { }
          }
        }
        Object.assign(
          fieldData.value,
          cleanValue({
            type: fieldData.value.type || 'text',
            value: data_value
          })
        );
      }
    }
    let error = false;
    if (fieldData.value.required && !data_value) {
      error = `This field is required`;
      prompt += ` - ${error}`;
    }
    if (field_name === 'nickname') {
      reactData.familyMembers[selectedColumn].nickname = data_value || 'New!';
    }
    else if (field_name === 'family_name') {
      reactData.familyMembers[selectedColumn].family_name = data_value || '';
    }
    else if (fieldData?.default?.type === 'ID') {
      reactData.familyMembers[selectedColumn].person_id = data_value;
      reactData.familyMembers[selectedColumn].composite_key = `${reactData.familyMembers[selectedColumn].family_id}%%${data_value}`;
    }
    fieldData.loaded = true;
    let response = [Object.assign({},
      fieldData.value,
      {
        prompt,
        error,
        isBlank: !data_value,
      }
    )];
    return response;
  }

  function cleanValue({ type, value }) {
    if (!value) {
      return {
        data_value: '',
        visible_value: '',
        raw_value: value,
        type
      };
    }
    switch (type) {
      case 'phone': {
        let allNums = (`${value}`.match(/[^\D]/g, "") || []).join("");
        return {
          data_value: `+1${allNums.slice(-10)}`,
          visible_value: `(${allNums.slice(-10, -7)}) ${allNums.slice(-7, -4)}-${allNums.slice(-4)}`,
          raw_value: value,
          type
        };
      }
      default: {
        return {
          data_value: value,
          visible_value: value,
          raw_value: value,
          type
        };
      }
    }
  }

  const identifyNewAccountForm = ({ role }) => {
    if (reactData.defaults.hasOwnProperty('roles')) {
      if (reactData.defaults.roles.hasOwnProperty(role)) {
        return reactData.defaults.roles[role].form_if_new || state.session.new_account_form || 'new_account_form';
      }
    }
    return ((role === 'caregiver') ? 'new_caregiver_form' : 'new_camper_form');
  };

  function selectAForm({ selectedColumn, form_index, showCompleted }) {
    if (reactData.columnForms[selectedColumn][form_index].isChecked) {
      reactData.columnForms[selectedColumn][form_index].isChecked = false;
    }
    else {
      for (let ndx = 0; ndx < reactData.columnForms[selectedColumn].length; ndx++) {
        reactData.columnForms[selectedColumn][ndx].isChecked = false;
      }
      reactData.columnForms[selectedColumn][form_index].isChecked = true;
    }
    updateReactData({
      columnForms: reactData.columnForms,
      showCompleted
    }, true);
  }

  async function editColumn({ selectedColumn }) {
    for (let form_index = 0; form_index < reactData.columnForms[selectedColumn].length; form_index++) {
      await editForm({ selectedColumn, form_index, editMode: true });
    }
  }

  async function editForm({ selectedColumn, form_index, editMode }) {
    for (const field_name in reactData.columnForms[selectedColumn][form_index].fields) {
      const beforeValue = reactData.columnForms[selectedColumn][form_index].fields[field_name]?.value?.data_value;
      const [afterObj] = prepareField({ selectedColumn, form_index, field_name, editMode });
      if (!reactData.columnForms[selectedColumn][form_index].fields[field_name].value.version) {
        reactData.columnForms[selectedColumn][form_index].fields[field_name].value.version = 1;
      }
      else {
        reactData.columnForms[selectedColumn][form_index].fields[field_name].value.version++;
      }
      afterObj.error = false;
      if (afterObj.data_value !== beforeValue) {
        // data in this field changed
      }
      if (afterObj.required && !afterObj.data_value) {
        reactData.columnForms[selectedColumn][form_index].fields[field_name].value.error = `Please don't leave this blank`;
      }
    };
    updateReactData({
      columnForms: reactData.columnForms,
      familyMembers: reactData.familyMembers
    }, false);
    return ({
      columnForms: reactData.columnForms,
      familyMembers: reactData.familyMembers
    });
  }

  async function makeFormList({ selectedColumn, client_id, role }) {
    if (!isEmpty(reactData.columnForms[selectedColumn])) {
      return reactData.columnForms[selectedColumn];
    }
    reactData.columnForms[selectedColumn] = [];
    let form_index = -1;
    if (!reactData.forms.hasOwnProperty(role)) {
      // you are asking for a form that was not named in the passed-in defaults,
      // build out a basic form with minimal info
      reactData.columnForms[selectedColumn] = [{
        client_id: state.session.client_id,
        fields: {},
        form_name: 'No Forms Available',
        isChecked: true,
        sections: []
      }];
      updateReactData({ columnForms: reactData.columnForms }, false);
    }
    else {
      for (const formObj of reactData.forms[role]) {
        // is there an active form for this person?
        let queryObj = {
          KeyConditionExpression: 'pertains_to = :p and begins_with(formType_date, :f)',
          ScanIndexForward: false,
          IndexName: 'pertains_to-formType_date-index',
          Limit: 1,
          ExpressionAttributeValues: {
            ':p': reactData.familyMembers[selectedColumn].person_id,
            ':f': `${formObj.form_id}%%`
          }
        };
        queryObj.TableName = 'CompletedDocuments';
        let existingCompleteRecs = await dbClient
          .query(queryObj)
          .promise()
          .catch(error => {
            if (error.code === 'NetworkingError') {
              cl(`Security Violation or no Internet Connection`);
            }
            cl(`Error reading ${queryObj.TableName} id ${error}`);
          });
        let existingComplete;
        let existingWIP = false;
        if (recordExists(existingCompleteRecs)) {
          // there IS a completed form for this person
          existingComplete = existingCompleteRecs.Items[0];
        }
        else {
          existingComplete = false;
          let queryObj = {
            KeyConditionExpression: 'pertains_to = :p and begins_with(formType_date, :f)',
            ScanIndexForward: false,
            TableName: 'DocumentsInProcess',
            IndexName: 'pertains_to-formType_date-index',
            Limit: 1,
            ExpressionAttributeValues: {
              ':p': reactData.pertains_to,
              ':f': `${reactData.form_id}%%`
            }
          };
          let queryResult = await dbClient
            .query(queryObj)
            .promise()
            .catch(error => {
              if (error.code === 'NetworkingError') {
                cl(`Security Violation or no Internet Connection`);
              }
              cl(`Error reading ${queryObj.TableName} is ${error}`);
            });
          if (recordExists(queryResult)) {
            existingWIP = {
              document_id: queryResult.Items[0].document_id,
              date_started: makeDate(queryResult.Items[0].formType_date.split('%%')[1]).dateOnly
            };
          }
        }
        // No?  Then set up for a new form
        let this_form = await getForm(formObj.form_id);
        if (this_form?.options?.anonymous) {
          reactData.newAccountForm[role] = this_form;
          updateReactData({
            newAccountForm: reactData.newAccountForm
          }, false);
        }
        if (isEmpty(this_form)) {
          if (!formObj.asForm) { continue; }
          form_index++;
          reactData.columnForms[selectedColumn][form_index] = { asForm: true };
        }
        else {
          form_index++;
          reactData.columnForms[selectedColumn][form_index] = deepCopy(this_form);
          reactData.columnForms[selectedColumn][form_index].asForm = true;
          reactData.columnForms[selectedColumn][form_index].useFamilyID = !!formObj.useFamilyID;
          let response = await editForm({ selectedColumn, form_index, editMode: false });
          reactData.columnForms = response.columnForms;
        }
        reactData.columnForms[selectedColumn][form_index].existingComplete = existingComplete;
        reactData.columnForms[selectedColumn][form_index].existingWIP = existingWIP;
        reactData.columnForms[selectedColumn][form_index].isChecked = false;
      }
    }
    // updateReactData({ columnForms: reactData.columnForms }, false);
    return reactData.columnForms[selectedColumn];
    //
    /* Functions used exclusively in makeFormList */
    //
    async function getForm(form_id) {
      let formRec = await dbClient
        .get({
          Key: {
            client_id,
            form_id
          },
          TableName: "Forms"
        })
        .promise()
        .catch(error => {
          cl(`Error getting Forms is: ${error}`, form_id);
        });
      if (!recordExists(formRec)) {
        return {};
      }
      else {
        return formRec.Item;
      }
    }
  }

  async function saveAndClose() {
    // get each column
    let column_index = -1;
    for (const this_column of reactData.familyMembers) {
      column_index++;
      if (this_column.record_type === 'header') {
        if (reactData.columnForms[column_index]) {
          let familyRec = deepCopy(this_column);
          for (const this_form of reactData.columnForms[column_index]) {
            Object.keys(this_form.fields).forEach(this_field => {
              familyRec[this_field] = this_form.fields[this_field].value.data_value;
            });
          }
          let familyIn = await dbClient
            .get({
              Key: {
                client_id: familyRec.client_id,
                composite_key: familyRec.composite_key
              },
              TableName: 'FamilyGroups'
            })
            .promise()
            .catch(error => { cl(`Error reading FamilyGroups is: ${error}`); });
          await dbClient
            .put({
              Item: Object.assign({}, familyIn.Item, familyRec),
              TableName: 'FamilyGroups'
            })
            .promise()
            .catch(error => { cl(`Error reading FamilyGroups is: ${error}`); });
        }
      }
      else if (this_column.record_type === 'person') {
        // for each person, we're updating three tables: People, SessionsV2, and FamilyGroups        
        if (reactData.columnForms[column_index]) {
          // for each person's form info, we're going to load each of these table records with
          // data from the form, as specified in the form field's value.saveAs key
          let saveObj = {
            personRec: deepCopy(this_column),
            sessionRec: {},
            familyRec: {}
          };
          //  remove?     let sessionRec = deepCopy(this_column);
          for (const this_form of reactData.columnForms[column_index]) {
            // eslint-disable-next-line
            Object.keys(this_form.fields).forEach(this_field => {
              if (this_form.fields[this_field].value.data_value) {
                let all_ar = makeHandlerArray({ this_field, valueObj: this_form.fields[this_field].value });
                all_ar.forEach(ar => {
                  saveObj = resolveValues(
                    saveObj,
                    ar,
                    this_form.fields[this_field].value.data_value
                  );
                });
              }
            });
          }
          if (!saveObj.personRec.person_id) {
            // new account => 
          }
          let personIn = await dbClient
            .get({
              Key: {
                person_id: saveObj.personRec.person_id
              },
              TableName: 'People'
            })
            .promise()
            .catch(error => { cl(`Error reading People is: ${error}`); });
          let sessionIn = await dbClient
            .get({
              Key: {
                session_id: saveObj.personRec.person_id
              },
              TableName: 'SessionsV2'
            })
            .promise()
            .catch(error => { cl(`Error reading SessionV2 is: ${error}`); });
          if (!recordExists(personIn)) {
            if (saveObj.personRec.display_name) {
              let words = saveObj.personRec.display_name.split(/\s+/);
              saveObj.personRec.first = words.shift();
              if (words) { saveObj.personRec.last = words.join(' '); }
            }
            personIn = {
              Item:
              {
                "person_id": saveObj.personRec.person_id,
                "clients": {
                  "groups": [
                    "ALL",
                    "__TOP__"
                  ],
                  "id": saveObj.personRec.client_id
                },
                "client_id": saveObj.personRec.client_id,
                "directory_option": "normal",
                "directory_partner": "na",
                "favorite_activities": [],
                "favorite_blocked": [],
                "groups": [
                  "ALL",
                  "__TOP__"
                ],
                "local_data": {
                },
                "location": "",
                "messaging": {
                  "email": saveObj.personRec.email || saveObj.personRec.eMail,
                  "office": saveObj.personRec.office,
                  "sms": saveObj.personRec.sms || saveObj.personRec.text,
                  "voice": saveObj.personRec.voice
                },
                "name": {
                  "first": saveObj.personRec.first,
                  "last": saveObj.personRec.last
                },
                "preferred_method":
                  (saveObj.personRec.email || saveObj.personRec.eMail)
                    ? "email"
                    : ((saveObj.personRec.sms || saveObj.personRec.text)
                      ? "sms"
                      : (saveObj.personRec.voice || saveObj.personRec.office)
                        ? "voice"
                        : "AVA"),
                "pwdReset": false,
                "requirePassword": false,
                "search_data": saveObj.personRec.display_name.toLowerCase(),
                "storePassword": false,
                "subscription_status": "na",
              }
            };
            sessionIn = {
              "Item":
              {
                "session_id": saveObj.personRec.person_id,
                "assigned_to": "",
                "client_id": saveObj.personRec.client_id,
                "current_event": "",
                "customizations": {
                  "font_size": 1
                },
                "groups_managed": [
                ],
                "kiosk_mode": false,
                "last_login": "",
                "method": "initial_load",
                "password_change_date": "",
                "patient_display_name": saveObj.personRec.display_name,
                "patient_id": saveObj.personRec.person_id,
                "person_id": saveObj.personRec.person_id,
                "platform": "Win32",
                "requirePassword": false,
                "responsible_for": [
                ],
                "status": {
                  "environment": "L",
                  "signin_status": "never",
                  "source": "Family Maintenance",
                  "time": "",
                  "version": ""
                },
                "storePassword": false,
                "subscription_status": "na",
                "url_parameters": "",
                "user_display_name": saveObj.personRec.display_name,
                "user_homeClient": saveObj.personRec.client_id,
                "user_id": saveObj.personRec.person_id
              }
            };
          }
          await dbClient
            .put({
              Item: Object.assign({}, personIn.Item, saveObj.personRec),
              TableName: 'People'
            })
            .promise()
            .catch(error => { cl(`Error writing People is: ${error}`); });
          await dbClient
            .put({
              Item: Object.assign({}, sessionIn.Item, saveObj.sessionRec),
              TableName: 'SessionsV2'
            })
            .promise()
            .catch(error => { cl(`Error writing SessionsV2 is: ${error}`); });
          if (this_column.composite_key !== (`${this_column.family_id}%%${saveObj.personRec.person_id}`)) {
            await dbClient
              .delete({
                Key: {
                  client_id: this_column.client_id,
                  composite_key: this_column.composite_key
                },
                TableName: 'FamilyGroups'
              })
              .promise()
              .catch(error => { cl(`Error deleting FamilyGroups is: ${error}`); });
          }
          const familyOut = {
            client_id: saveObj.personRec.client_id,
            composite_key: `${this_column.family_id}%%${saveObj.personRec.person_id}`,
            family_id: this_column.family_id,
            nickname: saveObj.personRec.nickname,
            person_id: saveObj.personRec.person_id,
            record_type: 'person',
            role: saveObj.personRec.role || reactData.defaults.role_if_new || 'member'
          };
          await dbClient
            .put({
              Item: Object.assign({}, familyOut, saveObj.familyRec),
              TableName: 'FamilyGroups'
            })
            .promise()
            .catch(error => { cl(`Error reading FamilyGroups is: ${error}`); });
        }
      }
    }
    onClose();

    function makeHandlerArray({ this_field, valueObj }) {
      let workList;
      if (!valueObj.saveAs) { workList = [['personRec', this_field]]; }
      else if (typeof (valueObj.saveAs) === 'string') {
        workList = [['personRec', valueObj.saveAs]];
      }
      else {
        workList = handleArray(valueObj.saveAs);
      };
      return workList;

      function handleArray(arrayToHandle) {
        let workIndex = 0;
        let response = [];
        arrayToHandle.forEach(this_entry => {
          if (typeof (this_entry) === 'string') {
            if (!response[workIndex] || (response[workIndex].length === 0)) {
              if (!['personRec', 'person', 'sessionRec', 'session', 'familyRec', 'family'].includes(this_entry)) {
                response[workIndex] = ['personRec', this_entry];
              }
              else {
                response[workIndex] = [`${this_entry}${((this_entry.slice(-3) !== 'Rec') ? 'Rec' : '')}`];
              }
            }
            else {
              response[workIndex].push(this_entry);
            }
          }
          else {
            // this_entry is an array
            let subArray = handleArray(this_entry);
            if (!response[workIndex] || (response[workIndex].length === 0)) {
              response[workIndex] = subArray;
            }
            else {
              response[workIndex].push(subArray);
            }
          }
        });
        return response;
      }
    }

    function resolveValues(obj, ar, v) {
      let oWork = obj;
      ar.forEach((o, nDx) => {
        if (Array.isArray(o)) {
          resolveValues(obj, o, v);
        }
        else {
          const last = (nDx === (ar.length - 1));
          oWork = checkObj(oWork, o, last, v);
        }
      });
      console.log(oWork);
      oWork = v;
      console.log(obj);
      return obj;

      function checkObj(oIn, key, last, value) {
        console.log(`checking ${key}`, oIn);
        if (!Object.keys(oIn).includes(key)) {
          oIn[key] = {};
        }
        if (last) {
          oIn[key] = value;
        }
        return oIn[key];
      }
    }
  };

  const makeScreenName = () => {
    if (reactData.familyMembers.length === 1) {
      var personName = (reactData.familyMembers[0].nickname || reactData.familyMembers[0].name?.first).trim();
      if (personName) {
        return `${personName}'${personName.endsWith('s') ? '' : 's'} Forms`;
      }
    }
    else {
      return 'My Group';
    }
  };

  const makeFormRequest = ({ form_index, showCompleted }) => {
    let response = {
      form_id: reactData.columnForms[reactData.selectedColumn][form_index].form_id,
      document_title: reactData.columnForms[reactData.selectedColumn][form_index].form_name,
    };
    if (reactData.columnForms[reactData.selectedColumn][form_index].useFamilyID) {
      response.family_id = reactData.family_id;
    }
    else {
      response.person_id = reactData.familyMembers[reactData.selectedColumn].person_id;
    }
    if (showCompleted) {
      response.document_id = reactData.columnForms[reactData.selectedColumn][form_index].existingComplete.document_id;
    }
    return response;
  };

  // **************************

  return (
    <Dialog
      open={(true || forceRedisplay)}
      p={2}
      fullScreen
    >
      { /* MAIN */}
      <React.Fragment>
        {/* Header with Avatar, Message, and VertMenu */}
        <Box
          display='flex' flexDirection='row'
          className={classes.messageArea}
          style={AVATextStyle({
            margin: {
              top: 1,
              right: 0.5,
              left: 0.5,
              bottom: 1
            },
            size: 1.3,
            bold: true,
            overflow: 'visible'
          })}
          key={'topBox'}
          borderBottom={0}
        >
          <Box
            display='flex'
            flexDirection='column'
            overflow='visible'
            key={'titlesection'}
          >
            <Typography
              style={AVATextStyle({
                margin: {
                  top: 1,
                  right: 1,
                  left: 1,
                  bottom: 0
                },
                size: 1.3,
                bold: true
              })}
            >
              {makeScreenName()}
            </Typography>
          </Box>
          <Box
            paddingRight={2}
            marginTop={1}
            aria-controls='hidden-menu'
            aria-haspopup='true'
            key={'logoBox'}
            onClick={(event) => {
              handleClick(event);
              setPopupMenuOpen(true);
            }}>
            <Avatar src={state.session?.client_logo || process.env.REACT_APP_AVA_LOGO} />
          </Box>
          <Menu
            id='hidden-menu'
            anchorEl={anchorEl}
            open={popupMenuOpen}
            onClose={() => { setPopupMenuOpen(false); }}
            keepMounted
          >
            <MenuList
              style={AVATextStyle({
                margin: { right: 1.5 },
                padding: { right: 1 }
              })}
            >
              <MenuItem
                onClick={() => {
                  onClose();
                }}>
                <Box
                  display='flex' flexDirection='row' alignItems={'center'}
                  key={'vRowHome'}
                >
                  <HomeIcon />
                  <Typography
                    style={AVATextStyle({
                      margin: { left: 0.5 },
                      size: 0.5
                    })}
                  >
                    {'Go to AVA Menu'}
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem>
                <Box
                  display='flex' flexDirection='column' justifyContent={'center'} alignItems={'flex-start'}
                  key={'vRowRefresh'}
                >
                  <Typography style={AVATextStyle({ size: 0.5 })} >{`AVA vers ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                  <Typography style={AVATextStyle({ size: 0.5 })} >{`User ${state.session.user_id}${state.patient_id !== state.session.user_id ? (' (' + state.session.patient_id + ')') : ''}`}</Typography>
                  <Typography style={AVATextStyle({ size: 0.5 })} >{`Function: FamilyMaintenance`}</Typography>
                </Box>
              </MenuItem>
            </MenuList>
          </Menu>
        </Box>

        { /* Selection Row */}
        {(reactData.familyMembers.length > 0) &&
          <Box display='flex'
            flexDirection='row'
            key={'peopleSelectionRow'}
            id={'peopleSelectionRow'}
            justifyContent='space-between'
            alignItems={'flex-end'}
            borderBottom={2}
          >
            {(reactData.familyMembers.length > 1) &&
              <Box display='flex'
                flexDirection='row'
                marginRight={0}
                marginLeft={0}
                marginTop={0}
                marginBottom={0}
                paddingTop={1}
                overflow={(reactData.familyMembers.length > 5) ? 'scroll' : null}
                key={'peopleSelectionBox'}
                id={'peopleSelectionBox'}
                className={classes.listItemSticky}
              >
                <Box
                  display='flex'
                  flexDirection='row'
                  key={'person'}
                  className={classes.listItem}
                  mb={0.5}
                  mt={0.5}
                  justifyContent='space-between'
                  alignItems='flex-end'
                >
                  <Box
                    display='flex'
                    flexDirection='row'
                    key={'rowP'}
                    className={classes.listItem}
                    justifyContent='flex-end'
                    alignItems='flex-end'
                  >
                    <Box
                      display='flex'
                      flexDirection='column'
                      minWidth={50}
                      maxWidth={50}
                      marginBottom={'10px'}
                      key={`radiobox-rowP-colSelect`}
                      className={classes.listItem}
                      justifyContent='flex-end'
                      alignItems='center'
                    >
                      <Typography key={`selectWord`} className={classes.smallTextLine}>{'Select'}</Typography>
                    </Box>
                    {reactData.familyMembers.map((this_column, this_columnNumber) => (
                      <Box
                        display='flex'
                        flexDirection='column'
                        minWidth={50}
                        maxWidth={50}
                        key={`radiobox-rowP-col${this_columnNumber}`}
                        className={classes.listItem}
                        justifyContent='space-between'
                        alignItems='center'
                      >
                        {(this_column.record_type === 'header')
                          ?
                          <React.Fragment
                            key={`familyHeader_${this_columnNumber}`}
                          >
                            {(this_column.family_name || 'My Family').split(/\s+/).map((this_word, wX) => (
                              <Typography key={`name-${this_columnNumber}_${wX}`} className={classes.smallTextLine}>
                                {this_word.slice(0, 10)}
                              </Typography>
                            ))}
                          </React.Fragment>
                          :
                          <React.Fragment
                            key={`familyHeader_${this_columnNumber}_${this_column.nickname}`}
                          >
                            <Box
                              component="img"
                              mt={0}
                              mb={1}
                              border={1}
                              minWidth={50}
                              maxWidth={50}
                              minHeight={50}
                              maxHeight={50}
                              alt=''
                              src={getImage(this_column.person_id)}
                            />
                            <Box
                              key={`nameBox-${this_columnNumber}`}
                              id={`nameBox-${this_columnNumber}`}
                              display="flex"
                              flexDirection='column'
                              minHeight={'40px'}
                              flexWrap={'wrap'}
                              justifyContent="flex-end"
                              alignItems='center'
                            >
                              {(this_column.nickname || this_column?.name?.first || 'New Person').split(/\s+/).map((this_word, wX) => (
                                <Typography key={`name-${this_columnNumber}_${wX}`} className={classes.smallTextLine}>
                                  {this_word.slice(0, 10)}
                                </Typography>
                              ))}
                            </Box>
                          </React.Fragment>
                        }
                        <Radio
                          key={`radio-rowP-col${this_columnNumber}`}
                          id={`radio-rowP-col${this_columnNumber}`}
                          checked={(reactData.selectedColumn === this_columnNumber)}
                          value={(reactData.selectedColumn === this_columnNumber)}
                          onClick={async () => {
                            // changing columns - run a final edit on the one you are leaving
                            await editColumn({ selectedColumn: reactData.selectedColumn });
                            const this_formList = await makeFormList({
                              selectedColumn: this_columnNumber,
                              client_id: state.session.client_id,
                              record_type: reactData.familyMembers[this_columnNumber].record_type,
                              role: reactData.familyMembers[this_columnNumber].role
                            });
                            updateReactData({
                              selectedColumn: this_columnNumber,
                              formList: this_formList
                            }, true);
                          }}
                          disableRipple
                          className={classes.radioButton}
                          size='small'
                        />
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            }
            {!reactData.defaults.suppressAddPerson &&
              <IconButton
                color='inherit'
                style={{ marginRight: '24px', marginBottom: '16px', height: '48px' }}
                onClick={async () => {
                  updateReactData({
                    addDocPrompt: true,
                  }, true);
                }}
              >
                <GroupAddIcon />
              </IconButton>
            }
          </Box>
        }

        { /* Data rows */}
        <DialogContent
          dividers={true}
          classes={{ dividers: classes.dialogBox }}
          key={`dialogcontent-${reactData.selectedColumn || 99}`}
        >
          <Box
            key={`thewholething-${reactData.selectedColumn || 99}`}
            id={`thewholething-${reactData.selectedColumn || 99}`}
            display="flex"
            flexDirection='column'
            flexWrap={'wrap'}
            justifyContent="flex-start"
            alignItems='flex-start'
          >
            {(reactData.familyMembers.length > 0)
              && reactData.formList
              && (reactData.selectedColumn != null)
              &&
              <React.Fragment
                key={`Colfrag${reactData.selectedColumn}`}
              >
                {reactData.formList.map((this_form, form_index) => (
                  <React.Fragment
                    key={`wrapperFrag-col${reactData.selectedColumn}_form${form_index}`}
                  >
                    <Box
                      display='flex'
                      flexGrow={1}
                      maxWidth={'80%'}
                      minWidth={'80%'}
                      flexDirection='column'
                      key={`wrapper-col${reactData.selectedColumn}_form${form_index}`}
                      className={classes.listItem}
                      justifyContent='center'
                      alignItems='flex-start'
                    >
                      <Box
                        display='flex'
                        flexDirection='row'
                        key={`radio-col${reactData.selectedColumn}_form${form_index}`}
                        className={classes.listItem}
                        style={AVATextStyle({ margin: { top: 2 } })}
                        justifyContent='flex-start'
                        alignItems='center'
                      >
                        {reactData.columnForms[reactData.selectedColumn][form_index].existingComplete
                          ? <CheckCircleIcon
                            key={`radio-button${reactData.selectedColumn}_form${form_index}off`}
                            id={`radio-button${reactData.selectedColumn}_form${form_index}off`}
                            onClick={() => {
                              selectAForm({ selectedColumn: reactData.selectedColumn, form_index, showCompleted: true });
                            }}
                            disableRipple
                            className={classes.radioButton}
                            size='small'
                          />
                          : <RadioButtonUncheckedIcon
                            key={`radio-button${reactData.selectedColumn}_form${form_index}on`}
                            id={`radio-button${reactData.selectedColumn}_form${form_index}on`}
                            onClick={() => {
                              selectAForm({ selectedColumn: reactData.selectedColumn, form_index, showCompleted: false });
                            }}
                            disableRipple
                            className={classes.radioButton}
                            size='small'
                          />
                        }
                        <EditIcon
                          key={`radio-button${reactData.selectedColumn}_form${form_index}edit`}
                          id={`radio-button${reactData.selectedColumn}_form${form_index}edit`}
                          checked={reactData.columnForms[reactData.selectedColumn][form_index].isChecked}
                          value={reactData.columnForms[reactData.selectedColumn][form_index].isChecked}
                          onClick={() => {
                            selectAForm({ selectedColumn: reactData.selectedColumn, form_index, showCompleted: false });
                          }}
                          disableRipple
                          className={classes.radioButton}
                          size='small'
                        />
                        <Typography
                          key={`name-col${reactData.selectedColumn}_form${form_index}`}
                          onClick={() => {
                            selectAForm({ selectedColumn: reactData.selectedColumn, form_index, showCompleted: false });
                          }}
                          onContextMenu={async (e) => {
                            e.preventDefault();
                            var contextText = '';
                            if (reactData.columnForms[reactData.selectedColumn][form_index].existingComplete) {
                              contextText += `Completed Document<br />
                              1. DocID: ${reactData.columnForms[reactData.selectedColumn][form_index].existingComplete.document_id}<br />
                              2. FormID: ${reactData.columnForms[reactData.selectedColumn][form_index].form_id}<br />
                              3. PersonID: ${reactData.familyMembers[reactData.selectedColumn].person_id}<br />`;
                            }
                            if (reactData.columnForms[reactData.selectedColumn][form_index].existingWIP) {
                              contextText += `WIP Document<br />
                              1. DocID: ${reactData.columnForms[reactData.selectedColumn][form_index].existingWIP.document_id}<br />
                              2. FormID: ${reactData.columnForms[reactData.selectedColumn][form_index].form_id}<br />
                              3. PersonID: ${reactData.familyMembers[reactData.selectedColumn].person_id}<br />
                              4. Date Started: ${reactData.columnForms[reactData.selectedColumn][form_index].existingWIP.date_started}`;
                            }
                            if (!contextText) {
                              contextText = 'Nothing started yet'
                            }
                            enqueueSnackbar(<div>{contextText}</div>,
                              { variant: 'info', persist: true });
                          }}
                          style={AVATextStyle({
                            size: 1.5,
                            bold: true,
                            margin: { left: 1 },
                            color: ((reactData.columnForms[reactData.selectedColumn][form_index].existingComplete) ? null : 'red')
                          })}
                        >
                          {this_form.form_name}
                        </Typography>
                      </Box>
                      {reactData.columnForms[reactData.selectedColumn][form_index].isChecked &&
                        reactData.columnForms[reactData.selectedColumn][form_index].asForm &&
                        <FormFillB
                          request={makeFormRequest({ form_index, showCompleted: reactData.showCompleted })}
                          onClose={(formStatus, statusObj) => {
                            reactData.columnForms[reactData.selectedColumn][form_index].isChecked = false;
                            if (statusObj.document_status === 'complete') {
                              reactData.columnForms[reactData.selectedColumn][form_index].existingComplete = statusObj.recWritten;
                            }
                            updateReactData({
                              columnForms: reactData.columnForms,
                              showCompleted: false
                            }, true);
                          }}
                        />
                      }
                    </Box>
                  </React.Fragment>
                ))}
              </React.Fragment>
            }
          </Box>
        </DialogContent>
      </React.Fragment>

      {
        reactData.addDocForm &&
        <FormFillB
          request={{
            form_id: identifyNewAccountForm({ role: reactData.roleToAdd }),
            person_id: state.session.patient_id,
            mode: 'new'

          }}
          onClose={async (ignore_me, statusObj) => {
            if (statusObj.document_status !== 'aborted') {
              let newLength = reactData.familyMembers.push(Object.assign({}, reactData.familyMembers[0],
                statusObj.recWritten,
                {
                  record_type: 'person',
                  role: reactData.roleToAdd,
                  nickname: (statusObj.recWritten?.name?.first || `New ${reactData.roleToAdd}`)
                }));
              await makeFormList({
                selectedColumn: newLength - 1,
                client_id: state.session.client_id,
                role: reactData.roleToAdd
              });
            }
            updateReactData({
              addDocForm: false
            }, true);
          }}
        />
      }
      {
        reactData.addDocPrompt &&
        <AVATextInput
          titleText={`What type of account are you adding?`}
          promptText={(reactData.defaults.hasOwnProperty('roles')
            ? Object.keys(reactData.defaults.roles).map(this_role => {
              return `[checkbox]${titleCase(this_role)}`;
            })
            : ['[checkbox]Caregiver', '[checkbox]Camper']
          )}
          valueText={[
            '', ''
          ]}
          buttonText={'Select'}
          onCancel={() => {
            updateReactData({
              addDocPrompt: false
            }, true);
          }}
          onSave={async (response) => {
            let checkNum = response.findIndex(this_response => { return this_response === 'checked'; });
            if (checkNum === -1) {
              updateReactData({
                addDocPrompt: false
              }, true);
            }
            else {
              let targetArray = (reactData.defaults.hasOwnProperty('roles')
                ? Object.keys(reactData.defaults.roles)
                : ['caregiver', 'camper']
              );
              let roleToAdd = targetArray[checkNum];
              updateReactData({
                addDocPrompt: false,
                addDocForm: true,
                roleToAdd

              }, true);
            }
          }}
        />
      }

      { /* Command Area */}
      <DialogActions className={classes.buttonArea} >
        <Box mx={2}
          display='flex'
          flexWrap='wrap'
          flexDirection='row'
          justifyContent='space-between'
          alignItems='center'
        >
          <Button
            className={AVAClass.AVAButton}
            key={`Exit_Button`}
            style={{ backgroundColor: 'red', color: 'white', marginRight: '96px' }}
            size='small'
            onClick={() => { onClose(); }}
            startIcon={<CloseIcon size="small" />}
          >
            {'Exit'}
          </Button>
          <Button
            className={AVAClass.AVAButton}
            key={`Finish_Button`}
            style={reactData.errorOnScreen
              ? { backgroundColor: 'white', color: 'green', marginLeft: '96px' }
              : { backgroundColor: 'green', color: 'white', marginLeft: '96px' }
            }
            size='small'
            disabled={reactData.errorOnScreen}
            onClick={async () => {
              await editColumn({ selectedColumn: reactData.selectedColumn });
              await saveAndClose();
            }}
            startIcon={<CheckIcon size="small" />}
          >
            {'Finish & Save'}
          </Button>
          <Box display='flex' flexWrap='wrap' flexGrow={1} flexDirection='row' justifyContent='center' alignItems='center' />
        </Box>
      </DialogActions>
    </Dialog >
  );
};
