import React from 'react';

import useSession from '../../hooks/useSession';

import { getImage, getPerson, getSession } from '../../util/AVAPeople';
import { deepCopy, makeArray, cl, recordExists, dbClient } from '../../util/AVAUtilities';

import makeStyles from '@material-ui/core/styles/makeStyles';
import { AVAclasses, AVADefaults, AVATextStyle } from '../../util/AVAStyles';

import { Button, IconButton, TextField } from '@material-ui/core';
import { Dialog, DialogContent, DialogActions } from '@material-ui/core';
import { Box, Typography, Radio, Avatar } from '@material-ui/core';
import { Menu, MenuList, MenuItem } from '@material-ui/core';

import CloseIcon from '@material-ui/icons/HighlightOff';
import CheckIcon from '@material-ui/icons/Check';
import HomeIcon from '@material-ui/icons/Home';
import GroupAddIcon from '@material-ui/icons/GroupAdd';

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
    <member.record_type>: { <role>: [ {form_id: xxx}, {form_id: xxx}, ... ], <role>: [ {form_id: xxx}, {form_id: xxx}, ... ], ... },
    <member.record_type>: { <role>: [ {form_id: xxx}, {form_id: xxx}, ... ], <role>: [ {form_id: xxx}, {form_id: xxx}, ... ], ... },
    ...
  }
  */

  let user_fontSize = AVADefaults({ fontSize: 'get' });

  const classes = useStyles();
  const AVAClass = AVAclasses();

  const { state } = useSession();

  const [forceRedisplay, setForceRedisplay] = React.useState(false);

  const [reactData, setReactData] = React.useState({
    stage: 'start',
    family_id,
    familyMembers: [],
    restrict_to_client_id: options.client_id || null,
    selectedColumn: null,
    formInfoForThisPerson: [],
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
          familyMembers.push(Object.assign({}, this_familyRec, sessionRec, personRec));
        }
      };
    }
    updateReactData({
      familyMembers: [familyHeader].concat(familyMembers)
    }, false);
    const this_formList = await makeFormList({
      selectedColumn: 0,
      client_id: reactData.familyMembers[0].client_id,
      record_type: reactData.familyMembers[0].record_type,
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
    refValue = reactData.formInfoForThisPerson[selectedColumn][form_index].fields[refField]?.value?.data_value;
    if (!refValue) {
      // does it exist anywhere in the family column?
      for (let ndx = 0; ((ndx < reactData.formInfoForThisPerson[0].length) && !refValue); ndx++) {
        refValue = reactData.formInfoForThisPerson[0][ndx].fields[refField]?.value?.data_value;
      }      
    }
    if (!refValue) {
      // does it exist on another form in this column?
      for (let ndx = 0; ((ndx < reactData.formInfoForThisPerson[selectedColumn].length) && !refValue); ndx++) {
        if (ndx !== form_index) {
          refValue = reactData.formInfoForThisPerson[selectedColumn][ndx].fields[refField]?.value?.data_value;
        }
      }
    }
  }

  function prepareField({ selectedColumn, form_index, field_name, editMode }) {
    let fieldData = reactData.formInfoForThisPerson[selectedColumn][form_index].fields[field_name];
    let prompt = fieldData.prompt.ref;
    let data_value = fieldData.value.data_value;
    if ((!fieldData.value) || (!data_value)) {
      // in edit mode, default value comes from fieldData.edit
      if (editMode || fieldData.loaded) {
        fieldData.default = fieldData.edit;
      }
      // No value; does it have a default value?
      if (fieldData.default) {
        if (!data_value) {
          // does this field exist on ANY other form?
          data_value = getRefValue({ selectedColumn, form_index, refField: fieldData.default.ref });
        }
        if (!data_value) {
          if (fieldData.default.type === 'ID') {
            const refField = fieldData.default.ref;
            const refValue = getRefValue({ selectedColumn, form_index, refField });
            if (refValue) {
              let refWords = refValue.split(/\s+/);
              data_value = (refWords[0].replace(/[^a-zA-Z]/, '').slice(0, 1)
                + (refWords[1] ? refWords[1].replace(/[^a-zA-Z]/, '') : '')
                + '-' + reactData.familyMembers[selectedColumn].client_id).toLowerCase();
            }
          }
          else if (fieldData.default.type === 'first') {
            const refField = fieldData.default.ref;
            const refValue = getRefValue({ selectedColumn, form_index, refField });
            if (refValue) {
              let refWords = refValue.split(/\s+/);
              data_value = refWords[0];
            }
          }
          else if (fieldData.default.type === 'last') {
            const refField = fieldData.default.ref;
            const refValue = getRefValue({ selectedColumn, form_index, refField });
            if (refValue) {
              let refWords = refValue.split(/\s+/);
              refWords.shift();
              data_value = refWords.join(' ');
            }
          }
        }
        if (!data_value) {
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
      cleanValue({
        type: fieldData.value.type || 'text',
        value: fieldData.value.raw_value
      }),
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

  function handleChange({ newValue, selectedColumn, form_index, field_name }) {
    Object.assign(
      reactData.formInfoForThisPerson[selectedColumn][form_index].fields[field_name].value,
      cleanValue({
        type: reactData.formInfoForThisPerson[selectedColumn][form_index].fields[field_name].value.type || 'text',
        value: newValue
      })
    );
    updateReactData({
      formInfoForThisPerson: reactData.formInfoForThisPerson
    }, true);
  }

  function selectAForm({ selectedColumn, form_index }) {
    if (reactData.formInfoForThisPerson[selectedColumn][form_index].isChecked) {
      reactData.formInfoForThisPerson[selectedColumn][form_index].isChecked = false;
    }
    else {
      for (let ndx = 0; ndx < reactData.formInfoForThisPerson[selectedColumn].length; ndx++) {
        reactData.formInfoForThisPerson[selectedColumn][ndx].isChecked = false;
      }
      reactData.formInfoForThisPerson[selectedColumn][form_index].isChecked = true;
    }
    updateReactData({ formInfoForThisPerson: reactData.formInfoForThisPerson }, true);
  }

  async function editForm({ selectedColumn, form_index }) {
    for (const field_name in reactData.formInfoForThisPerson[selectedColumn][form_index].fields) {
      const beforeValue = reactData.formInfoForThisPerson[selectedColumn][form_index].fields[field_name]?.value?.data_value;
      const [afterObj] = prepareField({ selectedColumn, form_index, field_name, editMode: true });
      Object.assign(
        reactData.formInfoForThisPerson[selectedColumn][form_index].fields[field_name].value,
        afterObj
      );
      if (reactData.formInfoForThisPerson[selectedColumn][form_index].fields[field_name].value.version) {
        reactData.formInfoForThisPerson[selectedColumn][form_index].fields[field_name].value.version = 1;
      }
      else {
        reactData.formInfoForThisPerson[selectedColumn][form_index].fields[field_name].value.version++;
      }
      afterObj.error = false;
      if (afterObj.data_value !== beforeValue) {
        // data in this field changed
      }
      if (afterObj.required && !afterObj.data_value) {
        reactData.formInfoForThisPerson[selectedColumn][form_index].fields[field_name].value.error = `Please don't leave this blank`;
      }
    };
    updateReactData({
      formInfoForThisPerson: reactData.formInfoForThisPerson,
      familyMembers: reactData.familyMembers
    }, true);
  }

  async function makeFormList({ selectedColumn, client_id, record_type, role }) {
    reactData.formInfoForThisPerson[selectedColumn] = [];
    let form_index = -1;
    if (!reactData.forms[record_type].hasOwnProperty(role)) {
      // you are asking for a form that was not named in the passed-in defaults,
      // build out a basic form with minimal info
      reactData.formInfoForThisPerson[selectedColumn] = [{
        client_id: reactData.familyMembers[selectedColumn].client_id,
        fields: {
          display_name: {
            prompt: { type: 'text', ref: 'Name' },
            value: { type: 'text', required: true }
          },
          nickname: {
            default: { type: 'first', ref: 'display_name' },
            prompt: { type: 'text', ref: 'Nickname' },
            value: { type: 'text', required: false }
          },
          person_id: {
            default: { type: 'ID', ref: 'display_name' },
            prompt: { type: 'text', ref: 'Account ID' },
            value: { type: 'ID', required: true }
          }
        },
        form_name: 'Account Information',
        isChecked: true,
        sections: [{
          fields: ['display_name', 'nickname', 'person_id'],
          section_name: 'New Person Information'
        }]
      }];
    }
    else {
      for (const formObj of reactData.forms[record_type][role]) {
        form_index++;
        let this_form = await getForm(formObj.form_id);
        if (!!this_form) {
          reactData.formInfoForThisPerson[selectedColumn][form_index] = deepCopy(this_form);
        }
        reactData.formInfoForThisPerson[selectedColumn][form_index].isChecked = (form_index === 0); 
      }
    }
    updateReactData({ formInfoForThisPerson: reactData.formInfoForThisPerson }, false);
    return reactData.formInfoForThisPerson[selectedColumn];
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
        if (reactData.formInfoForThisPerson[column_index]) {
          let familyRec = deepCopy(this_column);
          for (const this_form of reactData.formInfoForThisPerson[column_index]) {
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
        if (reactData.formInfoForThisPerson[column_index]) {
          // for each person's form info, we're going to load each of these table records with
          // data from the form, as specified in the form field's value.saveAs key
          let saveObj = {
            personRec: deepCopy(this_column),
            sessionRec: {},
            familyRec: {}
          };
          //  remove?     let sessionRec = deepCopy(this_column);
          for (const this_form of reactData.formInfoForThisPerson[column_index]) {
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
            role: saveObj.personRec.role || 'member'
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
      let workList = [];
      if (!valueObj.saveAs) { workList = [['personRec', this_field]]; }
      else if (typeof (valueObj.saveAs) === 'string') {
        workList = [['personRec', valueObj.saveAs]];
      }
      else {
        handleArray(valueObj.saveAs);
      };
      return workList;

      function handleArray(arrayToHandle) {
        let workIndex = workList.push([]) - 1;
        arrayToHandle.forEach(this_entry => {
          if (typeof (this_entry) === 'string') {
            if (workList[workIndex].length === 0) {
              if (!['personRec', 'person', 'sessionRec', 'session', 'familyRec', 'family'].includes(this_entry)) {
                workList[workIndex] = ['personRec', this_entry];
              }
              else {
                workList[workIndex][0] = this_entry + ((this_entry.slice(-3) !== 'Rec') ? 'Rec' : '');
              }
            }
            else {
              workList[workIndex].push(this_entry);
            }
          }
          else {
            // this_entry is an array
            handleArray(this_entry);
          }
        });
      }
    }

    function resolveValues(obj, ar, v) {
      let oWork = obj;
      ar.forEach((o, nDx) => {
        const last = (nDx === (ar.length - 1));
        oWork = checkObj(oWork, o, last, v);
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
              left: 0.5
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
              {`Our Family`}
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
                  <Typography style={AVATextStyle({ size: 0.5 })} >{`User ${state.session.user_id}${state.patient_id !== state.session.user_id ? (' (' + state.patient_id + ')') : ''}`}</Typography>
                  <Typography style={AVATextStyle({ size: 0.5 })} >{`Function: FamiyMaintenance`}</Typography>
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
                            {(this_column.nickname || this_column?.name?.first).split(/\s+/).map((this_word, wX) => (
                              <Typography key={`name-${this_columnNumber}_${wX}`} className={classes.smallTextLine}>
                                {this_word.slice(0, 10)}
                              </Typography>
                            ))}
                          </Box>
                        </React.Fragment>
                      }
                      <Radio
                        key={`radio-rowP-col${this_columnNumber}`}
                        checked={(reactData.selectedColumn === this_columnNumber)}
                        value={(reactData.selectedColumn === this_columnNumber)}
                        onClick={async () => {
                          const this_formList = await makeFormList({
                            selectedColumn: this_columnNumber,
                            client_id: reactData.familyMembers[this_columnNumber].client_id,
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
            <IconButton
              color='inherit'
              style={{ marginRight: '24px', marginBottom: '16px', height: '48px' }}
              onClick={async () => {
                reactData.familyMembers.push(Object.assign({}, reactData.familyMembers[0], {
                  record_type: 'person',
                  nickname: 'New!',
                  role: 'member'
                }));
                updateReactData({
                  familyMembers: reactData.familyMembers
                }, true);
              }}
            >
              <GroupAddIcon />
            </IconButton>
          </Box>
        }

        { /* Data rows */}
        <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
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
              reactData.formList.map((this_form, form_index) => (
                <Box
                  display='flex'
                  flexGrow={1}
                  maxWidth={'80%'}
                  minWidth={'80%'}
                  flexDirection='column'
                  key={`radio-col${reactData.selectedColumn}_form${form_index}`}
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
                    <Radio
                      key={`radio-col${reactData.selectedColumn}_form${form_index}`}
                      checked={reactData.formInfoForThisPerson[reactData.selectedColumn][form_index].isChecked}
                      value={reactData.formInfoForThisPerson[reactData.selectedColumn][form_index].isChecked}
                      onClick={() => {
                        selectAForm({ selectedColumn: reactData.selectedColumn, form_index });
                      }}
                      disableRipple
                      className={classes.radioButton}
                      size='small'
                    />
                    <Typography key={`name-col${reactData.selectedColumn}_form${form_index}`}
                      style={AVATextStyle({ size: 1.5, bold: true, margin: { left: 1 } })}
                    >
                      {this_form.form_name}
                    </Typography>
                  </Box>
                  {reactData.formInfoForThisPerson[reactData.selectedColumn][form_index].isChecked &&
                    this_form.sections.map((this_section, section_index) => (
                      <React.Fragment>
                        <Typography
                          key={`sectionHeader_${reactData.selectedColumn}.${form_index}.${section_index}`}
                          id={`sectionHeader_${reactData.selectedColumn}.${form_index}.${section_index}`}
                          style={AVATextStyle({ size: 1, italic: true, margin: { left: 1.5, top: 0.5 } })}
                        >
                          {this_section.section_name}
                        </Typography>
                        {this_section.fields.map((field_name, sFnDX) => (
                          prepareField({ selectedColumn: reactData.selectedColumn, form_index, section_index, field_name }).map((this_field) => (
                            (!this_field.hidden &&
                              <Box display='flex'
                                flexDirection='row'
                                borderRadius={'16px'}
                                marginLeft={2}
                                marginRight={2}
                                maxWidth={this_field.checkbox ? 400 : 'auto'}
                                width={!this_field.checkbox ? '100%' : 'auto'}
                                marginTop={1}
                                marginBottom={0}
                                padding={1}
                                border={(!!this_field.error || (this_field.isBlank && this_field.required))
                                  ? 4
                                  : (this_field.checkbox ? 4 : 'none')
                                }
                                className={classes.backGroundNone}
                                borderColor={!!this_field.error ? 'red' : (this_field.isChecked ? 'green' : 'lightgray')}
                                key={`box_${reactData.selectedColumn}.${form_index}.${section_index}.${sFnDX}`}
                                id={`box_${reactData.selectedColumn}.${form_index}.${section_index}.${sFnDX}`}
                              >
                                <TextField
                                  className={classes.freeInput}
                                  variant={'standard'}
                                  key={`inputtextprompt_${reactData.selectedColumn}.${form_index}.${section_index}.${sFnDX}.${this_field.version || 0}`}
                                  id={`inputtextprompt_${reactData.selectedColumn}.${form_index}.${section_index}.${sFnDX}.${this_field.version || 0}`}
                                  helperText={this_field.prompt}
                                  multiline
                                  inputProps={{ style: { fontSize: `${user_fontSize * 1}rem`, lineHeight: `${user_fontSize * 1.2}rem` } }}
                                  onChange={event => {
                                    handleChange({
                                      newValue: event.target.value,
                                      selectedColumn: reactData.selectedColumn,
                                      form_index, section_index, field_name
                                    });
                                  }}
                                  onBlur={async () => {
                                    await editForm({ selectedColumn: reactData.selectedColumn, form_index });
                                  }}
                                  FormHelperTextProps={{ style: { fontSize: `${user_fontSize * 0.75}rem`, lineHeight: `${user_fontSize * 0.9}rem` } }}
                                  autoComplete='off'
                                  value={this_field.visible_value || ''}
                                />
                              </Box>
                            )
                          ))
                        ))}
                      </React.Fragment>
                    ))
                  }
                </Box>
              ))
            }
          </Box>
        </DialogContent>
      </React.Fragment>

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
            style={{ backgroundColor: 'red', color: 'white', marginRight: '96px' }}
            size='small'
            onClick={() => { onClose(); }}
            startIcon={<CloseIcon size="small" />}
          >
            {'Exit'}
          </Button>
          <Button
            className={AVAClass.AVAButton}
            style={reactData.errorOnScreen
              ? { backgroundColor: 'white', color: 'green', marginLeft: '96px' }
              : { backgroundColor: 'green', color: 'white', marginLeft: '96px' }
            }
            size='small'
            disabled={reactData.errorOnScreen}
            onClick={async () => {
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
