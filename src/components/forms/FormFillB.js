import React from 'react';

import { dbClient, cl, makeArray, deepCopy, isEmpty, getDb, sentenceCase, listFromArray, array_in_array, recordExists, isObject, titleCase, uuid, isMobile } from '../../util/AVAUtilities';
import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { formatPhone, getPerson, makeName } from '../../util/AVAPeople';
import { makeDate } from '../../util/AVADateTime';
import AVAConfirm from './AVAConfirm';
import AVAUploadFile from '../../util/AVAUploadFile';

import { sendMessages } from '../../util/AVAMessages';
import { printDocumentB, printEmptyDocument, printDocumentHybrid } from '../../util/AVAMessages';
import SignatureCanvas from 'react-signature-canvas';
import Select from "react-dropdown-select";
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import PrintIcon from '@material-ui/icons/Print';
import { Dialog, DialogContent, Snackbar, Box, Typography, FormControlLabel, Button, TextField, Checkbox } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab/';
import makeStyles from '@material-ui/core/styles/makeStyles';

import AVA_AlertSound from '../../ava_alert.mp3';
import useSound from 'use-sound';

import useSession from '../../hooks/useSession';
import { useIdleTimer } from 'react-idle-timer';
import { updateDocument, createDocument } from '../../util/AVADocuments';

const useStyles = makeStyles(theme => ({
  dialogBox: {
    paddingTop: 0,
    paddingLeft: 0,
    paddingBottom: theme.spacing(1),
    overflowX: 'hidden',
    marginLeft: theme.spacing(2),
  },
  buttonArea: {
    justifyContent: 'space-around',
    minWidth: '100%',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center'
  },
  formControl: {
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  formControlCheckGroup: {
    marginTop: 0,
    paddingTop: 0,
  },
  formControlTitle: {
    margin: 0,
    marginLeft: 0,
    marginRight: '2px',
    paddingTop: '16px',
    paddingBottom: 0,
    fontSize: theme.typography.fontSize * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginBottom: 0,
  },
  imageArea: {
    minWidth: '150px',
    maxWidth: '150px'
  },
  formControlDays: {
    margin: 0,
    marginLeft: '-8px',
    marginRight: '2px',
    height: 1,
    fontSize: theme.typography.fontSize * 0.8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '10px',
    marginBottom: '25px',
  },
  radioDays: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: '-8px',
    marginRight: '16px',
    '&.MuiInputBase-input': {
      paddingBottom: '0px'
    }
  },
  clientBackground: {
    borderRadius: '30px',
    maxWidth: '95%',
    paddingLeft: '4px',
    paddingRight: '4px',
    marginLeft: '4px',
    marginRight: '4px'
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
  },
  breakRow: {
    flexBasis: '100%',
    height: 0
  },
  inputDisplay: {
    '&.MuiInputBase-input': {
      paddingBottom: '0px',
      color: 'red'
    },
    '&.MuiInput-input': {
      paddingBottom: '22px',
      color: 'red'
    },
    '&.MuiInputBase-root': {
      'Mui-disabled': {
        color: 'black'
      }
    }
  }
}));

export default ({ request = {}, onClose }) => {
  const classes = useStyles();
  const AVAClass = AVAclasses();
  const signatureRef = [React.useRef(null), React.useRef(null), React.useRef(null)];

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
    options.document_id = request;
    options.form_id = request;
  }
  else {
    options = Object.assign({}, request);
  }

  const [play] = useSound(AVA_AlertSound, { volume: 1 });

  const nowObj = new Date();

  const [reactData, setReactData] = React.useState({
    form_id: options.form_id,
    options,
    document_id: options.document_id,
    document_title: options.document_title,
    fields: {},
    /* 
    fields is keyed by field_name: {
      prompt:
      type:
      value:
      valueText:
      selectionObj:
      options:
      isError: 
      errorMessage:
    }
    */
    sections: {},
    /* 
    sections comes directly from FormRec.sections and describes the sequence: [{
      sectionName:
      fields: []
    }]
    */
    formRec: {},
    sessionRec: {},
    peopleRec: {},
    docRec: {},
    familyRec: false,
    family_id: options.family_id || false,
    newPerson: false,
    newFamily: false,
    stage: 'initialize',
    messageList: ['In progress'],
    errorsOnForm: 0,
    formUpdates: 0,
    lastActiveTime: nowObj,
    version: 1,
    idleState: false,
    pertains_to: options.person_id,
    clientSampleMode: (!options.person_id || (options.person_id === state.session.client_id))
  });

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

  const isInitializing = () => {
    return ((reactData.stage === 'still_initializing') || (reactData.stage === 'initialize'));
  };

  const valuesChanged = () => {
    return !!reactData.formUpdates;
  };

  const oneMinute = 1000 * 60;
  const msBeforeSleeping = 1 * oneMinute;

  function onAction() {
    let now = new Date();
    if ((reactData.idleState) || ((now.getTime() - reactData.lastActiveTime.getTime()) > oneMinute)) {
      cl(`Action/Update at ${now.toLocaleString()}.  Last active at ${reactData.lastActiveTime.toLocaleString()}`);
      updateReactData({
        lastActiveTime: now,
        idleState: false,
      }, false);
    }
    reset();
  };

  const onIdle = async () => {
    let now = new Date();
    let minutesSinceActive = 0;
    let reactUpdObj = {
      idleState: true,
      enteredIdleStateTime: now,
    };
    if (!reactData.idleState) {
      // if we weren't previously in an idle state and we are now...
      if (!isInitializing && valuesChanged) {
        cl(`Auto save at ${now.toLocaleString()}.`);
        let response = await handleSave({
          document_id: reactData.document_id,
          final: false,
          timeout: true
        });
        if (response.goodPut) {
          reactUpdObj.formUpdates = 0;
          reactUpdObj.document_id = response.document_id;
          reactUpdObj.recWritten = response.recWritten;
        }
      }
      updateReactData(reactUpdObj, true);
    }
    else {
      minutesSinceActive = Math.floor((now.getTime() - reactData.enteredIdleStateTime.getTime()) / oneMinute);
      cl(`Still idle at ${new Date().toLocaleString()}.  Idle for ${minutesSinceActive} minutes.`);
    }
    if (minutesSinceActive > 5) {
      onClose('timeout', {
        document_id: reactData.document_id,
        document_title: reactData.document_title,
        document_status: (reactData.clientSampleMode ? 'cancel' : 'work_in_process'),
        pertains_to: reactData.pertains_to,
        recWritten: reactData.recWritten
      });
    }
    else if (minutesSinceActive > 3) {
      updateReactData({
        alert: {
          severity: 'info',
          title: `Are you there?`,
          message: <div>We haven't heard from you in over {minutesSinceActive} minutes.<br />
            We'll automatically {reactData.clientSampleMode ? '' : 'save your work and '} close this form in {5 - minutesSinceActive} minutes.<br />
            To keep this form active, just move your mouse or tap somewhere.</div>
        }
      }, true);
    }
    else if (minutesSinceActive === 5) {
      play();
      updateReactData({
        alert: {
          severity: 'warning',
          title: `Close imminent`,
          message: <div>Heads up!  We'll automatically {reactData.clientSampleMode ? '' : 'save your work and '} close this form in 1 minute!<br />
            <strong>To keep this form active, just move your mouse or tap somewhere.</strong></div>
        }
      }, true);
    }
    reset();
  };

  const { start, reset } = useIdleTimer({
    onIdle,
    onAction,
    timeout: msBeforeSleeping,
    throttle: 500
  });

  // **************************

  const setFieldDefault = async ({ this_field }) => {
    let response = {};
    // Set default value
    const defaultObj = {};
    if (!reactData.formRec.fields.hasOwnProperty(this_field)) {
      const formFieldRec = await getDb({
        Key: {
          client_id: state.session.client_id,
          field_name: this_field
        },
        TableName: "Form_Fields"
      });
      if (formFieldRec) {
        reactData.formRec.fields[this_field] = formFieldRec;
        updateReactData({
          formRec: reactData.formRec
        }, false);
      }
      else {
        response.ignore = true;
        return response;
      }
    }
    if (reactData.formRec.fields[this_field].default) {
      if (reactData.formRec.fields[this_field].default.source) {
        let sourceDefaults = [];
        if (Array.isArray(reactData.formRec.fields[this_field].default.source)) {
          sourceDefaults = reactData.formRec.fields[this_field].default.source;
        }
        else {
          sourceDefaults = [reactData.formRec.fields[this_field].default.source];
        }
        for (const this_default of sourceDefaults) {
          // if defaultObj has a source, the source is going to tell you where to find the default data
          // this should be EITHER an array OR a string; we want to make an array out of it
          defaultObj.source_path = makeArray(this_default, '.');
          const source_file = defaultObj.source_path.shift();
          if (source_file.toLowerCase().startsWith('session')) {
            if (!reactData.sessionRec[reactData.pertains_to]) {
              reactData.sessionRec[reactData.pertains_to] = await getDb({
                Key: {
                  session_id: reactData.pertains_to
                },
                TableName: "SessionsV2"
              });
              updateReactData({
                sessionRec: reactData.sessionRec
              }, false);
            }
            response.value = resolve({
              object: reactData.sessionRec[reactData.pertains_to],
              key: defaultObj.source_path
            });
          }
          else if ((source_file.toLowerCase().startsWith('person'))
            || (source_file.toLowerCase().startsWith('people'))) {
            response.value = resolve({
              object: reactData.peopleRec[reactData.pertains_to],
              key: defaultObj.source_path
            });
          }
          else if (source_file.startsWith('family')) {
            // we need to get the familyRec; do we have it already?
            if (source_file.toLowerCase().startsWith('family')) {
              if (!reactData.familyRec && reactData.family_id) {
                reactData.familyRec = await getDb({
                  Key: {
                    client_id: state.session.client_id,
                    composite_key: reactData.family_id
                  },
                  TableName: "FamilyGroups"
                });
                updateReactData({
                  familyRec: reactData.familyRec
                }, false);
              }
            }
            if (reactData.familyRec) {
              response.value = resolve({
                object: reactData.familyRec,
                key: defaultObj.source_path
              });
            }
          }
          else if (source_file.toLowerCase().startsWith('user')) {
            if (!reactData.peopleRec[state.session.user_id]) {
              reactData.peopleRec[state.session.user_id] = await getDb({
                Key: {
                  person_id: state.session.user_id
                },
                TableName: "People"
              });
              updateReactData({
                peopleRec: reactData.peopleRec
              }, false);
            }
            response.value = resolve({
              object: reactData.peopleRec[state.session.user_id],
              key: defaultObj.source_path
            });
          }
          else if (source_file.startsWith('formData')) {
            if (reactData.options.hasOwnProperty('formData') && defaultObj.source_path[0]) {
              response.value = reactData.options.formData[defaultObj.source_path[0]];
            }
          }
          if (response.value) {
            break;
          }
        }
      }
      if (!response.value && reactData.formRec.fields[this_field].default.value) {
        defaultObj.value_path = makeArray(reactData.formRec.fields[this_field].default.value, '.');
        if (defaultObj.value_path[0].toLowerCase() === 'date') {
          response.value = makeDate(defaultObj.value_path[1], { notime: true })[defaultObj.value_path[2]];
        }
        else if (defaultObj.value_path[0].toLowerCase() === 'time') {
          response.value = makeDate(defaultObj.value_path[1])[defaultObj.value_path[2]];
        }
        else if (defaultObj.value_path[0].toLowerCase() === 'name') {
          let pertains_to;
          if (['person', 'patient', 'pertains', 'pertain_to'].includes(defaultObj.value_path[1])) {
            pertains_to = reactData.pertains_to;
          }
          else if (defaultObj.value_path[1] === 'user') {
            pertains_to = state.session.user_id;
          }
          else {
            pertains_to = defaultObj.value_path[1];
          }
          response.value = makeName(pertains_to);
        }
        else if (defaultObj.value_path[0].toLowerCase() === 'makenewaccount') {
          response.value = await makeNewUser({
            tableDefaults: reactData.formRec.fields[this_field].default.tables,
          });
        }
        else if (defaultObj.value_path[0].toLowerCase() === 'field') {
          if (defaultObj.value_path[1]) {
            response.value = reactData.fields[defaultObj.value_path[1]].value;
          }
        }
        else if (defaultObj.value_path.length === 1) {
          response.value = defaultObj.value_path[0];
        }
      }
    }
    else if (reactData.fields[this_field]?.prompt && reactData.fields[this_field]?.prompt?.value) {
      if (['image', 'html'].includes(reactData.fields[this_field]?.value.type || reactData.fields[this_field]?.default?.type)) {
        response.value = reactData.fields[this_field]?.prompt?.value;
      }
    }
    if (!response.value) {
      response.value = null;
    }
    // if prompt.ignore_if exists, check the value
    if (reactData.fields[this_field]?.prompt?.ignore_if) {
      response.ignore = false;
      const ignoreList = makeArray(reactData.fields[this_field]?.prompt?.ignore_if);
      if (!response.value) {
        if (ignoreList.includes('%%no_data%%')) {
          response.ignore = true;
          return response;
        }
      }
      else if (array_in_array(ignoreList, response.value)) {
        response.ignore = true;
        return response;
      }
    }
    return response;
  };

  const initializeBlank = async ({ form_id }) => {
    const formRec = await getDb({
      Key: {
        client_id: state.session.client_id,
        form_id
      },
      TableName: "Forms"
    });
    if (!formRec) {
      return {
        fields: {},
        sections: []
      };
    }
    updateReactData({
      peopleRec: {},
      formRec
    }, false);
    let response = {
      fields: {},
      sections: formRec.sections,
      document_title: `${formRec.form_name}`
    };
    for (let this_section of response.sections) {
      this_section.section_name = await resolveVariables(this_section.section_name);
      for (let this_field of this_section.fields) {
        response.fields[this_field] = {};
        // Set default value
        const defaultObj = {};
        if (!formRec.fields.hasOwnProperty(this_field)) {
          const formFieldRec = await getDb({
            Key: {
              client_id: state.session.client_id,
              field_name: this_field
            },
            TableName: "Form_Fields"
          });
          if (formFieldRec) {
            formRec.fields[this_field] = formFieldRec;
            updateReactData({
              formRec
            }, false);
          }
          else {
            response.fields[this_field].ignore = true;
            continue;
          }
        }
        if (formRec.fields[this_field].default) {
          if (formRec.fields[this_field].default.source) {
            let sourceDefaults = [];
            if (Array.isArray(formRec.fields[this_field].default.source)) {
              sourceDefaults = formRec.fields[this_field].default.source;
            }
            else {
              sourceDefaults = [formRec.fields[this_field].default.source];
            }
            for (const this_default of sourceDefaults) {
              defaultObj.source_path = makeArray(this_default, '.');
              const source_file = defaultObj.source_path.shift();
              if (source_file.toLowerCase().startsWith('session')) {
                response.fields[this_field].value = '';
              }
              else if ((source_file.toLowerCase().startsWith('person')) || (source_file.toLowerCase().startsWith('people'))) {
                response.fields[this_field].value = '';
              }
              else if (source_file.startsWith('family')) {
                response.fields[this_field].value = '';
              }
              else if (source_file.toLowerCase().startsWith('user')) {
                if (!reactData.peopleRec[state.session.user_id]) {
                  reactData.peopleRec[state.session.user_id] = await getDb({
                    Key: {
                      person_id: state.session.user_id
                    },
                    TableName: "People"
                  });
                  updateReactData({
                    peopleRec: reactData.peopleRec
                  }, false);
                }
                response.fields[this_field].value = resolve({
                  object: reactData.peopleRec[state.session.user_id],
                  key: defaultObj.source_path
                });
              }
              else if (source_file.startsWith('formData')) {
                if (reactData.options.hasOwnProperty('formData') && defaultObj.source_path[0]) {
                  response.fields[this_field].value = reactData.options.formData[defaultObj.source_path[0]];
                }
              }
              if (response.fields[this_field].value) {
                break;
              }
            }
          }
          if (!response.fields[this_field].value && formRec.fields[this_field].default.value) {
            defaultObj.value_path = makeArray(formRec.fields[this_field].default.value, '.');
            if (defaultObj.value_path[0].toLowerCase() === 'date') {
              response.fields[this_field].value = makeDate(defaultObj.value_path[1], { notime: true })[defaultObj.value_path[2]];
            }
            else if (defaultObj.value_path[0].toLowerCase() === 'time') {
              response.fields[this_field].value = makeDate(defaultObj.value_path[1])[defaultObj.value_path[2]];
            }
            else if (defaultObj.value_path[0].toLowerCase() === 'name') {
              if (['person', 'patient', 'pertains', 'pertain_to'].includes(defaultObj.value_path[1])) {
                response.fields[this_field].value = makeName(reactData.pertains_to);
              }
              else if (defaultObj.value_path[1] === 'user') {
                response.fields[this_field].value = makeName(state.session.user_id);
              }
              else {
                response.fields[this_field].value = '';
              }
            }
            else if (defaultObj.value_path[0].toLowerCase() === 'makenewaccount') {
              response.fields[this_field].value = response.value = await makeNewUser({
                tableDefaults: formRec.fields[this_field]?.default?.tables,
              });
            }
            else if (defaultObj.value_path.length === 1) {
              response.fields[this_field].value = defaultObj.value_path[0];
            }
          }
        }
        else if (formRec.fields[this_field]?.prompt && formRec.fields[this_field]?.prompt?.value) {
          if (['image', 'html'].includes(formRec.fields[this_field]?.value.type || formRec.fields[this_field]?.default?.type)) {
            response.fields[this_field].value = formRec.fields[this_field]?.prompt?.value;
          }
        }
        if (!response.fields[this_field].value) {
          response.fields[this_field].value = null;
        }
        // if prompt.ignore_if exists, check the value
        if (formRec.fields[this_field]?.prompt?.ignore_if) {
          const ignoreList = makeArray(formRec.fields[this_field]?.prompt?.ignore_if);
          if (!response.fields[this_field].value) {
            if (ignoreList.includes('%%no_data%%')) {
              response.fields[this_field].ignore = true;
            }
          }
          else if (ignoreList.includes(response.fields[this_field].value)) {
            response.fields[this_field].ignore = true;
          }
        }
        // Set type
        response.fields[this_field].type = formRec.fields[this_field]?.value.type || formRec.fields[this_field]?.default?.type || 'text';
        // Set default valueText (this may require conversion of value data as in types phone or date or time)
        response.fields[this_field].valueText = await formatValue({
          rawValue: response.fields[this_field].value,
          type: response.fields[this_field].type
        });
        // set prompt
        response.fields[this_field].prompt = formRec.fields[this_field]?.prompt || { value: sentenceCase(this_field) };
        // Selection Obj should be set for the special case - type = select or type = select & text
        if (response.fields[this_field].type.startsWith('select')) {
          response.fields[this_field].selectionObj = formRec.fields[this_field]?.value.selection;
        }
        // set options
        response.fields[this_field].options = {
          required: !!formRec.fields[this_field].value.required,
          log_results: formRec.fields[this_field].value.log_results || false,
          viewOnly: (formRec.fields[this_field].value.edit === 'view'),
          hidden: (formRec.fields[this_field].value.edit === 'hidden'),
          ifEmpty: formRec.fields[this_field].options ? formRec.fields[this_field].options.ifEmpty : null,
          resetFields: (formRec.fields[this_field].value.resetFields
            || (formRec.fields[this_field].options ? formRec.fields[this_field].options.resetFields : null))
        };
      }
    };
    return response;
  };

  const initializeDoc = async ({ form_id, pertains_to, preset_values }) => {
    const formRec = await getDb({
      Key: {
        client_id: state.session.client_id,
        form_id
      },
      TableName: "Forms"
    });
    if (!formRec) {
      return {
        fields: {},
        sections: []
      };
    }
    /*
      fields as follows:
        prompt:
        type:
        value:
        valueText:
        selectionObj:
        options:
        isError: 
        errorMessage:
    */
    let pertains_to_name;
    reactData.peopleRec[pertains_to] = await getDb({
      Key: {
        person_id: pertains_to
      },
      TableName: "People"
    });
    if (!reactData.peopleRec[pertains_to]) {
      reactData.peopleRec[pertains_to] = {};
    };
    updateReactData({
      family_id: reactData.peopleRec[pertains_to].family_id || false,
      peopleRec: reactData.peopleRec,
      formRec
    }, false);
    if (reactData.clientSampleMode) {
      pertains_to_name = state.session.client_name;
    }
    else {
      pertains_to_name = reactData.peopleRec[pertains_to].display_name;
    }
    if (!pertains_to_name && (reactData.peopleRec[pertains_to] && reactData.peopleRec[pertains_to].hasOwnProperty('name'))) {
      pertains_to_name = (`${reactData.peopleRec[pertains_to]?.name.first} ${reactData.peopleRec[pertains_to]?.name.last}`).trim();
    }
    let tempTitle;
    if (pertains_to_name) {
      tempTitle = `${formRec.form_name} for ${pertains_to_name}`;
    }
    else {
      tempTitle = `${formRec.form_name}`;
    }
    let response = {
      fields: {},
      sections: formRec.sections,
      document_title: reactData.document_title || tempTitle
    };
    for (let this_section of response.sections) {
      for (let this_field of this_section.fields) {
        response.fields[this_field] = {};
        // Set default value
        const defaultObj = {};
        if (!formRec.fields.hasOwnProperty(this_field)) {
          const formFieldRec = await getDb({
            Key: {
              client_id: state.session.client_id,
              field_name: this_field
            },
            TableName: "Form_Fields"
          });
          if (formFieldRec) {
            formRec.fields[this_field] = formFieldRec;
            updateReactData({
              formRec
            }, false);
          }
          else {
            response.fields[this_field].ignore = true;
            continue;
          }
        }
        if (formRec.fields[this_field].default) {
          if (formRec.fields[this_field].default.source) {
            let sourceDefaults = [];
            if (Array.isArray(formRec.fields[this_field].default.source)) {
              sourceDefaults = formRec.fields[this_field].default.source;
            }
            else {
              sourceDefaults = [formRec.fields[this_field].default.source];
            }
            for (const this_default of sourceDefaults) {
              // if defaultObj has a source, the source is going to tell you where to find the default data
              // this should be EITHER an array OR a string; we want to make an array out of it
              defaultObj.source_path = makeArray(this_default, '.');
              const source_file = defaultObj.source_path.shift();
              if (source_file.toLowerCase().startsWith('session')) {
                if (!reactData.sessionRec[pertains_to]) {
                  reactData.sessionRec[pertains_to] = await getDb({
                    Key: {
                      session_id: pertains_to
                    },
                    TableName: "SessionsV2"
                  });
                  updateReactData({
                    sessionRec: reactData.sessionRec
                  }, false);
                }
                response.fields[this_field].value = resolve({
                  object: reactData.sessionRec[pertains_to],
                  key: defaultObj.source_path
                });
              }
              else if ((source_file.toLowerCase().startsWith('person')) || (source_file.toLowerCase().startsWith('people'))) {
                response.fields[this_field].value = resolve({
                  object: reactData.peopleRec[pertains_to],
                  key: defaultObj.source_path
                });
              }
              else if (source_file.startsWith('family')) {
                if (source_file.toLowerCase().startsWith('family')) {
                  if (!reactData.familyRec && reactData.family_id) {
                    reactData.familyRec = await getDb({
                      Key: {
                        client_id: state.session.client_id,
                        composite_key: reactData.family_id
                      },
                      TableName: "FamilyGroups"
                    });
                    updateReactData({
                      familyRec: reactData.familyRec
                    }, false);
                  }
                }
                if (reactData.familyRec) {
                  response.fields[this_field].value = resolve({
                    object: reactData.familyRec,
                    key: defaultObj.source_path
                  });
                }
              }
              else if (source_file.toLowerCase().startsWith('user')) {
                if (!reactData.peopleRec[state.session.user_id]) {
                  reactData.peopleRec[state.session.user_id] = await getDb({
                    Key: {
                      person_id: state.session.user_id
                    },
                    TableName: "People"
                  });
                  updateReactData({
                    peopleRec: reactData.peopleRec
                  }, false);
                }
                response.fields[this_field].value = resolve({
                  object: reactData.peopleRec[state.session.user_id],
                  key: defaultObj.source_path
                });
              }
              else if (source_file.startsWith('formData')) {
                if (reactData.options.hasOwnProperty('formData') && defaultObj.source_path[0]) {
                  response.fields[this_field].value = reactData.options.formData[defaultObj.source_path[0]];
                }
              }
              if (response.fields[this_field].value) {
                break;
              }
            }
          }
          if (!response.fields[this_field].value && formRec.fields[this_field].default.value) {
            defaultObj.value_path = makeArray(formRec.fields[this_field].default.value, '.');
            if (defaultObj.value_path[0].toLowerCase() === 'date') {
              response.fields[this_field].value = makeDate(defaultObj.value_path[1], { notime: true })[defaultObj.value_path[2]];
            }
            else if (defaultObj.value_path[0].toLowerCase() === 'time') {
              response.fields[this_field].value = makeDate(defaultObj.value_path[1])[defaultObj.value_path[2]];
            }
            else if (defaultObj.value_path[0].toLowerCase() === 'name') {
              let pertains_to;
              if (['person', 'patient', 'pertains', 'pertain_to'].includes(defaultObj.value_path[1])) {
                pertains_to = reactData.pertains_to;
              }
              else if (defaultObj.value_path[1] === 'user') {
                pertains_to = state.session.user_id;
              }
              else {
                pertains_to = defaultObj.value_path[1];
              }
              response.fields[this_field].value = makeName(pertains_to);
            }
            else if (defaultObj.value_path[0].toLowerCase() === 'makenewaccount') {
              response.fields[this_field].value = response.value = await makeNewUser({
                tableDefaults: formRec.fields[this_field]?.default?.tables,
              });
            }
            else if (defaultObj.value_path.length === 1) {
              response.fields[this_field].value = defaultObj.value_path[0];
            }
          }
        }
        else if (formRec.fields[this_field]?.prompt && formRec.fields[this_field]?.prompt?.value) {
          if (['image', 'html'].includes(formRec.fields[this_field]?.value.type || formRec.fields[this_field]?.default?.type)) {
            response.fields[this_field].value = formRec.fields[this_field]?.prompt?.value;
          }
        }
        if (!response.fields[this_field].value) {
          response.fields[this_field].value = null;
        }
        // Set type
        response.fields[this_field].type = formRec.fields[this_field]?.value.type || formRec.fields[this_field]?.default?.type || 'text';
        // Override computed defaults with preset values (if any)
        if (preset_values && preset_values[this_field]) {
          response.fields[this_field].og_default = await formatValue({
            rawValue: response.fields[this_field].value,
            type: response.fields[this_field].type
          });
          response.fields[this_field].value = preset_values[this_field];
        }
        // if prompt.ignore_if exists, check the value
        if (formRec.fields[this_field]?.prompt?.ignore_if) {
          const ignoreList = makeArray(formRec.fields[this_field]?.prompt?.ignore_if);
          if (!response.fields[this_field].value) {
            if (ignoreList.includes('%%no_data%%')) {
              response.fields[this_field].ignore = true;
            }
          }
          else if (array_in_array(ignoreList, response.fields[this_field].value)) {
            response.fields[this_field].ignore = true;
          }
        }
        // Set default valueText (this may require conversion of value data as in types phone or date or time)
        response.fields[this_field].valueText = await formatValue({
          rawValue: response.fields[this_field].value,
          type: response.fields[this_field].type
        });
        // set prompt
        response.fields[this_field].prompt = formRec.fields[this_field]?.prompt || { value: sentenceCase(this_field) };
        // Selection Obj should be set for the special case - type = select or type = select & text
        if (response.fields[this_field].type.startsWith('select')) {
          response.fields[this_field].selectionObj = formRec.fields[this_field]?.value.selection;
        }
        // set options
        response.fields[this_field].options = {
          required: !!formRec.fields[this_field].value.required,
          log_results: formRec.fields[this_field].value.log_results || false,
          viewOnly: (formRec.fields[this_field].value.edit === 'view'),
          hidden: (formRec.fields[this_field].value.edit === 'hidden'),
          ifEmpty: formRec.fields[this_field].options ? formRec.fields[this_field].options.ifEmpty : null,
          resetFields: (formRec.fields[this_field].value.resetFields
            || (formRec.fields[this_field].options ? formRec.fields[this_field].options.resetFields : null))

        };
        if (response.fields[this_field].type === 'signature') {
          response.fields[this_field].options.sigRefNumber = formRec.fields[this_field].sigRefNumber;
        }
        // set saveAs
        if (!isEmpty(formRec.fields[this_field].value.saveAs)) {
          let wip_saveAs = makeArray(formRec.fields[this_field].value.saveAs, ".");
          const wip_file = wip_saveAs[0].slice(0, 6).toLowerCase();
          let found_index = ['person', 'people', 'sessio', 'family'].findIndex(this_word => {
            return (wip_file === this_word);
          });
          if (found_index < 0) {
            wip_saveAs.unshift('peopleRec');
          }
          else if (found_index < 2) {
            wip_saveAs[0] = 'peopleRec';
          }
          else if (found_index === 2) {
            wip_saveAs[0] = 'sessionRec';
          }
          else if (found_index === 3) {
            wip_saveAs[0] = 'familyRec';
          }
          response.fields[this_field].saveAs = wip_saveAs;
        }
        else {
          response.fields[this_field].saveAs = false;
        }
        // set logAs
        if (!isEmpty(formRec.fields[this_field].value.log_results)) {
          response.fields[this_field].logAs = formRec.fields[this_field].value.log_results.path;
        }
        else {
          response.fields[this_field].logAs = false;
        }
        // finish initializations
        response.fields[this_field].isError = false;
      }
      this_section.section_name = await resolveVariables(this_section.section_name, response.fields);
    };
    return response;
  };

  const resolve = ({ object, key }) => {
    const this_key = key.shift();
    if (!object || !object.hasOwnProperty(this_key)) {
      return null;
    }
    if (key.length === 0) {
      return deepCopy(object[this_key]);
    }
    else {
      return resolve({ object: object[this_key], key });
    }
  };

  const formatValue = async ({ rawValue, type }) => {
    switch (type) {
      case 'phone': {
        return formatPhone(rawValue);
      }
      case 'date_select':
      case 'date': {
        return makeDate(rawValue, { noTime: true, noYearCorrection: true }).absolute;
      }
      case 'time': {
        return makeDate(rawValue, { noTime: true, noYearCorrection: true }).timeOnly;
      }
      case 'id': {
        if (reactData.peopleRec[rawValue]) {
          return reactData.peopleRec[rawValue].display_name
            || (`${reactData.peopleRec[rawValue]?.name.first} ${reactData.peopleRec[rawValue]?.name.last}`).trim();
        }
        else {
          return await makeName(rawValue);
        }
      }
      default: {
        return rawValue;
      }
    }
  };

  const makeNextAction = ({ instruction }) => {
    let response = {
      action: instruction.action
    };
    if (instruction.target) {
      response.target = reconcilePrompt({
        rawValue: instruction.target,
        this_field: 'null'
      });
    }
    return response;
  };

  const makeNewUser = async ({ tableDefaults }) => {
    let response;
    let formatter = `%%first_name//^[a-zA-Z]{1}%%%%last_name%%-%%client_id%%`;
    let candidate = reconcilePrompt({
      rawValue: formatter,
      this_field: 'person_id'
    });
    candidate = candidate.replace(/\s/gm, '').toLowerCase();
    let isExisting = await getPerson(candidate);
    if (isEmpty(isExisting)) {
      response = candidate.toLowerCase();
    }
    else {
      // try alternate format
      let formatterB = `%%first_name%%%%last_name%%-%%client_id%%`;
      let candidateB = reconcilePrompt({
        rawValue: formatterB,
        this_field: 'person_id'
      });
      candidateB = candidateB.replace(/\s/gm, '').toLowerCase();
      isExisting = await getPerson(candidateB);
      if (isEmpty(isExisting)) {
        response = candidateB.toLowerCase();
      }
      else {
        // start trying numbers
        let num = 0;
        do {
          num++;
          candidateB = candidate.replace('-', `${num}-`);
          isExisting = await getPerson(candidateB);
        }
        while (!isEmpty(isExisting) && (num < 20));
        if (isEmpty(isExisting)) {
          response = candidateB.toLowerCase();
        }
        else {
          response = `${new Date().getTime()}-${candidate.split('-')[1]}`;
        }
      }
    }
    reactData.peopleRec[response] = Object.assign({},
      tableDefaults.personRec,
      {
        person_id: response,
        client_id: state.session.client_id,
      });
    reactData.sessionRec[response] = Object.assign({},
      tableDefaults.sessionRec,
      {
        session_id: response,
        patient_id: response,
        person_id: response,
        client_id: state.session.client_id,
        user_homeClient: state.session.client_id,
        user_id: response
      });
    if (!reactData.family_id) {
      reactData.family_id = `family_${new Date().getTime()}`;
      reactData.newFamily = true;
      reactData.familyRec = Object.assign({},
        {
          client_id: state.session.client_id,
          composite_key: reactData.family_id,
          record_type: 'header',
          role: 'family',
          family_id: reactData.family_id,
        }
      );
    };
    if (reactData.newFamily) {
      reactData.familyRec.family_name = reactData.fields['last_name']
        ? `The ${reactData.fields['last_name'].value} Family`
        : (reactData.fields['first_name'] ? `${reactData.fields['first_name'].value}'s Family` : 'My Family');
    }
    updateReactData({
      newPerson: true,
      newFamily: reactData.newFamily,
      family_id: reactData.family_id,
      peopleRec: reactData.peopleRec,
      sessionRec: reactData.sessionRec,
      familyRec: reactData.familyRec,
      pertains_to: response
    }, false);
    return response;
  };

  const handleChangeValue = async ({ newText, newValue, newList, prop, sentenceCase }) => {
    if (sentenceCase && newText && (newText.length === 1)) {
      newText = newText.toUpperCase();
    }
    reactData.fields[prop].value = newValue || newList || newText;
    reactData.fields[prop].valueText = await formatValue({
      rawValue: reactData.fields[prop].value,
      type: reactData.fields[prop].type
    });
    if (reactData.fields[prop].options.resetFields) {
      for (const this_resetter of makeArray(reactData.fields[prop].options.resetFields)) {
        const { ignore, value } = await setFieldDefault({ this_field: this_resetter });
        reactData.fields[this_resetter].value = value;
        if (ignore) {
          reactData.fields[this_resetter].ignore = ignore;
        }
        else {
          reactData.fields[this_resetter].ignore = false;
        }
        reactData.fields[this_resetter].valueText = await formatValue({
          rawValue: reactData.fields[this_resetter].value,
          type: reactData.fields[this_resetter].type
        });
      }
    }
    updateReactData({
      formUpdates: reactData.formUpdates++,
      fields: reactData.fields
    }, true);
  };

  const handleMakeSelection = async (props) => {
    if (isEmpty(reactData.fields[props.prop].value)) {
      reactData.fields[props.prop].value = [props.clickText];
    }
    else {
      if (!Array.isArray(reactData.fields[props.prop].value)) {
        reactData.fields[props.prop].value = [reactData.fields[props.prop].value];
      }
      let foundAt = reactData.fields[props.prop].value.indexOf(props.clickText);
      if (foundAt < 0) {
        reactData.fields[props.prop].value.push(props.clickText);
        if (reactData.fields[props.prop].selectionObj.max
          && (reactData.fields[props.prop].value.length > reactData.fields[props.prop].selectionObj.max)) {
          reactData.fields[props.prop].value.shift();
        }
      }
      else {
        reactData.fields[props.prop].value.splice(foundAt, 1);
      }
    }
    if (reactData.fields[props.prop].options.resetFields) {
      for (const this_resetter of makeArray(reactData.fields[props.prop].options.resetFields)) {
        if (!reactData.fields[this_resetter]) {
          continue;
        }
        const { ignore, value } = await setFieldDefault({ this_field: this_resetter });
        reactData.fields[this_resetter].value = deepCopy(value);
        if (ignore) {
          reactData.fields[this_resetter].ignore = ignore;
        }
        else {
          reactData.fields[this_resetter].ignore = false;
        }
        reactData.fields[this_resetter].valueText = await formatValue({
          rawValue: reactData.fields[this_resetter].value,
          type: reactData.fields[this_resetter].type
        });
      }
    }
    updateReactData({
      formUpdates: reactData.formUpdates++,
      fields: reactData.fields
    }, true);
  };

  const reconcilePrompt = ({ rawValue, this_field }) => {
    let response = rawValue;
    if (!rawValue) { return this_field; }
    let answer = response.match(/%%.*?%%/);
    let rememberAnswer = false;
    if (answer) {
      do {
        let variable = answer[0];
        if (variable === '%%value%%') {
          let vValue = (reactData.fields[this_field] ? reactData.fields[this_field].valueText : '');
          if (!vValue) {
            vValue = `<${titleCase(this_field.toLowerCase().replace(/[^a-z]/, ' '))}>`;
          }
          response = response.replace(variable, vValue);
        }
        else if ((variable === '%%default%%') || (variable === '%%OG_default%%')) {
          let vValue = (reactData.fields[this_field] ? (reactData.fields[this_field].og_default || reactData.fields[this_field].valueText) : '');
          if (!vValue) {
            vValue = `<${titleCase(this_field.toLowerCase().replace(/[^a-z]/, ' '))}>`;
          }
          response = response.replace(variable, vValue);
          if (variable === '%%OG_default%%') {
            rememberAnswer = true;
          }
        }
        else {
          let extracted_field = variable.slice(2, -2);
          if (reactData.fields[extracted_field] && reactData.fields[extracted_field].valueText) {
            let vValue = reactData.fields[extracted_field].valueText;
            if (!vValue) {
              vValue = `<${titleCase(extracted_field.toLowerCase().replace(/[^a-z]/, ' '))}>`;
            }
            response = response.replace(variable, vValue);
          }
          else if (extracted_field.includes('//')) {
            let [field_part, regex_part] = extracted_field.split('//');
            if (reactData.fields[field_part]) {
              let vValue = reactData.fields[field_part].value.match(RegExp(regex_part, 'gm'))[0];
              if (!vValue) {
                vValue = `<${titleCase(field_part.toLowerCase().replace(/[^a-z]/, ' '))}>`;
              }
              response = response.replace(variable, vValue);
            }
            else {
              response = response.replace(variable, '');
            }
          }
          else if (extracted_field === 'client_id') {
            response = response.replace(variable, state.session.client_id);
          }
          else {
            response = response.replace(variable, '');
          }
        }
        answer = response.match(/%%.*?%%/);
      }
      while (answer);
    }
    if (!response.endsWith(')') && reactData.fields[this_field].prompt.show_log && reactData.fields[this_field].logAs) {
      let path = reactData.fields[this_field].logAs.split('.');
      let pathFile = path.shift();
      let logLine = resolve({
        object: reactData[pathFile]?.[reactData.pertains_to],
        key: path
      });
      response += ` (${logLine})`;
    }
    if (rememberAnswer) {
      reactData.fields[this_field].prompt.value = response;
    }
    return response;
  };

  // **************************

  const AVACheckBoxGroup = (props) => {
    // props should contain
    //   prop
    //   text - an array of options, each can independently go true or false
    return (
      <Box flexDirection='column' key={`Box__${props.prop}`} className={classes.formControlCheckGroup}>
        <Typography className={classes.formControlTitle}>
          {reconcilePrompt({
            rawValue: reactData.fields[props.prop].prompt.value,
            this_field: props.prop
          })}
        </Typography>
        <Box
          flexDirection='row'
          key={`CheckGroup__${props.prop}`}
        >
          <React.Fragment
            key={`groupFrag__${props.prop}`}
          >
            {(props.text).map((text, tIndex) => (
              <FormControlLabel
                className={classes.formControlDays}
                key={`${props.prop}_${tIndex}`}
                control={
                  <Checkbox
                    aria-label={`${props.prop}_${tIndex}`}
                    name={`${props.prop}_${tIndex}`}
                    key={`CheckGroup__${props.prop}_${tIndex}`}
                    size='small'
                    checked={reactData.fields[props.prop].value && reactData.fields[props.prop].value.includes(text)}
                    onClick={async () => {
                      await handleMakeSelection({
                        clickText: text,
                        prop: props.prop
                      });
                    }}
                    disableRipple
                    inputProps={{ 'aria-labelledby': `message_routing_3` }}
                  />
                }
                label={<Typography className={classes.radioDays}>{text}</Typography>}
                labelPlacement='end'
              />
            ))}
            {(props.withPrompt) &&
              <FormControlLabel
                className={classes.formControlDays}
                key={`${props.prop}_other`}
                control={
                  <TextField
                    style={AVATextStyle({
                      lineHeight: 1,
                      padding: { bottom: 0, top: 1 },
                      size: 0.75,
                      margin: { top: 0, bottom: 0.5, left: 0.5, right: 3 }
                    })}
                    className={classes.radioDays}
                    autoComplete='off'
                    disabled={reactData.fields[props.prop].options.viewOnly}
                    id={`${props.prop}_otherText`}
                    defaultValue={(reactData.fields[props.prop].value && reactData.fields[props.prop].bonusText)
                      ? reactData.fields[props.prop].bonusText
                      : ''
                    }
                    onBlur={(event) => {
                      if (!reactData.fields[props.prop].value) {
                        reactData.fields[props.prop].value = [];
                      }
                      reactData.fields[props.prop].bonusText = event.target.value;
                      updateReactData({
                        formUpdates: reactData.formUpdates++,
                        fields: reactData.fields
                      }, true);
                    }}
                    helperText={props.withPrompt}
                  />
                }
              />
            }
          </React.Fragment>
        </Box>
      </Box>
    );
  };

  // **************************

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const handleAbort = () => {
    onClose(0, {
      document_id: null,
      document_status: 'aborted'
    });
  };

  const handleReview = async () => {
    let messageList = ['There are problems with this form'];
    let errorsOnForm = 0;
    let activeErrors = 0;
    for (const sectionObj of reactData.sections) {
      let suppressSection = dontShowSection(sectionObj);
      if (suppressSection !== 'data') {
        for (const this_field of sectionObj.fields) {
          if (reactData.fields[this_field].ignore) {
            continue;
          }
          reactData.fields[this_field].isError = false;
          if (reactData.fields[this_field]?.options?.ifEmpty && isEmpty(reactData.fields[this_field].value)) {
            reactData.fields[this_field].value = reconcilePrompt({
              rawValue: reactData.fields[this_field].options.ifEmpty,
              this_field
            });
          }
          if (reactData.fields[this_field]?.options?.required || reactData.fields[this_field]?.value?.required) {
            if (((reactData.fields[this_field].type === 'signature')
              && ((signatureRef[reactData.fields[this_field].options.sigRefNumber].current) && (signatureRef[reactData.fields[this_field].options.sigRefNumber].current.isEmpty())))
              || ((reactData.fields[this_field].type !== 'signature')
                && (isEmpty(reactData.fields[this_field].value)))) {
              if (!suppressSection) {
                activeErrors++;
                reactData.fields[this_field].errorMessage = `${reconcilePrompt({
                  rawValue: reactData.fields[this_field].prompt.value,
                  this_field
                })} is required`;
                reactData.fields[this_field].isError = true;
                messageList.push(reactData.fields[this_field].errorMessage);
              }
              errorsOnForm++;
            }
          }
          else if (reactData.fields[this_field].type.startsWith('select')) {
            let mySelections = [];
            if (reactData.fields[this_field].value) {
              mySelections = ([reactData.fields[this_field].value].flat()).filter(v => {
                return (reactData.fields[this_field].selectionObj.selectionList.includes(v));
              });
            }
            if (reactData.fields[this_field].selectionObj.min) {
              if (isEmpty(mySelections)) {
                if (!suppressSection) {
                  activeErrors++;
                  reactData.fields[this_field].errorMessage = `Please make a selection for ${reconcilePrompt({
                    rawValue: reactData.fields[this_field].prompt.value,
                    this_field
                  })}`;
                  reactData.fields[this_field].isError = true;
                  messageList.push(reactData.fields[this_field].errorMessage);
                }
                errorsOnForm++;
              }
              else if (mySelections.length < reactData.fields[this_field].selectionObj.min) {
                if (!suppressSection) {
                  activeErrors++;
                  reactData.fields[this_field].errorMessage = `You must make at least ${reactData.fields[this_field].selectionObj.min} selections for ${reconcilePrompt({
                    rawValue: reactData.fields[this_field].prompt.value,
                    this_field
                  })}`;
                  reactData.fields[this_field].isError = true;
                  messageList.push(reactData.fields[this_field].errorMessage);
                }
                errorsOnForm++;
              }
            }
          }
        };
      }
    }
    if (!activeErrors) {
      if (errorsOnForm) {
        messageList = ['Your part of this form looks good!', 'Tap "Submit" below to save it and submit for review'];
      }
      else {
        messageList = ['This form is complete!', 'Tap "Complete" below to save it'];
      }
    }
    updateReactData({
      messageList,
      errorsOnForm,
      activeErrors,
      fields: reactData.fields,
      stage: 'confirm'
    }, true);
  };

  const resolveValue = (object, key, value) => {
    const this_key = key.shift();
    if (key.length === 0) {
      object[this_key] = value;
      return object;
    }
    else if (isEmpty(object)) {
      let resolvedObj = resolveValue({}, key, value);
      object = resolvedObj;
      return object;
    }
    else if (!object.hasOwnProperty(this_key)) {
      let resolvedObj = resolveValue({}, key, value);
      object[this_key] = resolvedObj;
      return object;
    }
    else {
      let resolvedObj = resolveValue(object[this_key], key, value);
      object[this_key] = resolvedObj;
      return object;
    }
  };

  const handleSave = async ({ document_id, final, timeout, pending = false }) => {
    let response = { goodPut: true };
    // always save this in DocumentsInProcess
    if (!document_id) {
      document_id = reactData.document_id || `${state.session.patient_id}_${reactData.form_id}_${new Date().getTime()}`;
      updateReactData({
        document_id
      }, false);
    }
    // updates to the Database as per instructions in fields[this_field].saveAs
    let needsUpdate = {
      peopleRec: false,
      sessionRec: false,
      familyRec: false
    };
    let field_values = {};
    let now = makeDate(new Date());
    for (const this_field in reactData.fields) {
      if (reactData.fields[this_field].bonusText) {
        if (reactData.fields[this_field].value) {
          let valueArray = makeArray(reactData.fields[this_field].value);
          valueArray.push(reactData.fields[this_field].bonusText);
          reactData.fields[this_field].value = valueArray;
          reactData.fields[this_field].valueText = listFromArray(valueArray);
        }
        else {
          reactData.fields[this_field].value = reactData.fields[this_field].bonusText;
          reactData.fields[this_field].valueText = reactData.fields[this_field].bonusText;
        }
      }
      if (!reactData.fields[this_field].options?.viewOnly) {
        field_values[this_field] = reactData.fields[this_field].value;
      }
      if (!reactData.fields[this_field].ignore) {
        if (reactData.fields[this_field].saveAs) {
          const save_instructions = reactData.fields[this_field].saveAs;
          const save_file = save_instructions.shift();
          if (save_file === 'peopleRec') {
            if (!reactData.peopleRec.hasOwnProperty(reactData.pertains_to)) {
              reactData.peopleRec[reactData.pertains_to] = await getDb({
                Key: {
                  person_id: reactData.pertains_to
                },
                TableName: "People"
              });
              updateReactData({
                peopleRec: reactData.peopleRec
              }, false);
            }
            reactData.peopleRec[reactData.pertains_to] = resolveValue(
              reactData.peopleRec[reactData.pertains_to],
              save_instructions,
              reactData.fields[this_field].value
            );
            needsUpdate.peopleRec = true;
          }
          else if (save_file === 'sessionRec') {
            if (!reactData.sessionRec.hasOwnProperty(reactData.pertains_to)) {
              reactData.sessionRec[reactData.pertains_to] = await getDb({
                Key: {
                  person_id: reactData.pertains_to
                },
                TableName: "SessionsV2"
              });
              updateReactData({
                sessionRec: reactData.sessionRec
              }, false);
            }
            reactData.sessionRec[reactData.pertains_to] = resolveValue(
              reactData.sessionRec[reactData.pertains_to],
              save_instructions,
              reactData.fields[this_field].value
            );
            needsUpdate.sessionRec = true;
          }
          else if (save_file === 'familyRec') {
            // we need to get the familyRec; do we have it already?           
            if (!reactData.familyRec && reactData.family_id) {
              reactData.familyRec = await getDb({
                Key: {
                  client_id: state.session.client_id,
                  composite_key: reactData.family_id
                },
                TableName: "FamilyGroups"
              });
              updateReactData({
                familyRec: reactData.familyRec
              }, false);
            }
            if (reactData.familyRec) {
              reactData.familyRec = resolveValue(
                reactData.familyRec,
                save_instructions,
                reactData.fields[this_field].value
              );
              needsUpdate.familyRec = true;
            }
          }
        }
        if ((!!reactData.fields[this_field].options?.log_results)
          && (!reactData.fields[this_field].options.log_results.if_value
            || reactData.fields[this_field].options.log_results.if_value.some(v => {
              if (typeof (reactData.fields[this_field].value) === 'string') { return v = reactData.fields[this_field].value; }
              else { return reactData.fields[this_field].value.includes(v); }
            }))) {
          const log_instructions = reactData.fields[this_field].options.log_results.path.split('.');
          const log_file = log_instructions.shift();
          if (log_file === 'peopleRec') {
            if (!reactData.peopleRec.hasOwnProperty(reactData.pertains_to)) {
              reactData.peopleRec[reactData.pertains_to] = await getDb({
                Key: {
                  person_id: reactData.pertains_to
                },
                TableName: "People"
              });
              updateReactData({
                peopleRec: reactData.peopleRec
              }, false);
            }
            reactData.peopleRec[reactData.pertains_to] = resolveValue(
              reactData.peopleRec[reactData.pertains_to],
              log_instructions,
              sentenceCase(`Previously ${reactData.fields[this_field].value} ${now.oaDate} by ${state.profile.name.first} ${state.profile.name.last}`)
            );
            needsUpdate.peopleRec = true;
          }
          else if (log_file === 'sessionRec') {
            if (!reactData.sessionRec.hasOwnProperty(reactData.pertains_to)) {
              reactData.sessionRec[reactData.pertains_to] = await getDb({
                Key: {
                  person_id: reactData.pertains_to
                },
                TableName: "SessionsV2"
              });
              updateReactData({
                sessionRec: reactData.sessionRec
              }, false);
            }
            reactData.sessionRec[reactData.pertains_to] = resolveValue(
              reactData.sessionRec[reactData.pertains_to],
              log_instructions,
              sentenceCase(`Previously ${reactData.fields[this_field].value} ${now.oaDate} by ${state.profile.name.first} ${state.profile.name.last}`)
            );
            needsUpdate.sessionRec = true;
          }
        }

      }
    }
    if (needsUpdate.peopleRec || reactData.newPerson) {
      if (reactData.newFamily) {
        reactData.peopleRec[reactData.pertains_to].family_id = reactData.family_id;
      }
      await dbClient
        .put({
          Item: reactData.peopleRec[reactData.pertains_to],
          TableName: 'People'
        })
        .promise()
        .catch(error => {
          cl(`Bad put to People. Error is: ${error}`);
          response = { goodPut: false, putError: `Bad put to People. Error is: ${error}` };
        });
    }
    if (needsUpdate.sessionRec) {
      await dbClient
        .put({
          Item: reactData.sessionRec[reactData.pertains_to],
          TableName: 'SessionsV2'
        })
        .promise()
        .catch(error => {
          cl(`Bad put to SessionsV2. Error is: ${error}`);
          response = { goodPut: false, putError: `Bad put to SessionsV2. Error is: ${error}` };
        });
    }

    // updates - if any - are done
    // if this is the type of document that needs to generate a final printout, do that now
    let url;
    if (final && !reactData.formRec?.options?.noFinal) {
      // render signatures (if any) before printing
      let signatures = [];
      for (const this_field in reactData.fields) {
        if (reactData.fields[this_field].ignore) {
          continue;
        }
        if ((reactData.fields[this_field].type === 'signature') && (signatureRef[reactData.fields[this_field].options.sigRefNumber].current)) {
          signatures[reactData.fields[this_field].options.sigRefNumber] = signatureRef[reactData.fields[this_field].options.sigRefNumber].current.getTrimmedCanvas().toDataURL('image/png');
        }
        if (reactData.fields[this_field].prompt) {
          reactData.fields[this_field].prompt.value =
            reconcilePrompt({
              rawValue: reactData.fields[this_field].prompt.value,
              this_field
            });
        }
      };
      const s3Results = await printDocumentB({
        documentList: [{
          sections: reactData.sections,
          fields: reactData.fields,
          docID: document_id,
          signatures,
          client_id: state.session.client_id,
          title: reactData.document_title
        }]
      });
      url = s3Results[0].s3Location;
    }

    // printing is done (or wasn't necessary)
    // save_type is one of 'final', 'in_process', 'on_timeout', 'printed'
    let docData = {
      client_id: state.session.client_id,
      document_id,
      title: reactData.document_title,
      pertains_to: reactData.pertains_to,
      status: url ? (pending ? 'pending' : 'complete') : 'in_process',   // need to set pending when appropriate
      form_type: reactData.form_id,
      client_id_form_type: `${state.session.client_id}%%${reactData.form_id}`,
      field_values,
      options: reactData.formRec.options
    };
    if (reactData.docRec?.history) {
      docData.history = reactData.docRec?.history;
    }
    const recWritten = await updateDocument({
      docData,
      author: state.session.patient_id,
      isNew: false,
      pending,
      save_type: url ? 'printed' : (final ? 'save_final' : (timeout ? 'on_timeout' : 'in_process')),
      url
    });
    response.location = url;
    response.document_status = docData.status;
    response.status = docData.status;
    response.document_id = docData.document_id;
    if (final && reactData.formRec?.options?.messaging) {
      // conditional based on responses should be allowed here
      // in user lists, user can be a person: person_id, group: group_id, or author: true
      for (let this_instruction of [reactData.formRec?.options?.messaging].flat()) {
        if (this_instruction.hasOwnProperty('status') && this_instruction.status !== docData.status) {
          continue;
        }
        if (this_instruction.hasOwnProperty('send_message')) {
          if (this_instruction.send_message.attach) {
            this_instruction.send_message.url = url;
          };
          if (!this_instruction.send_message.subject) {
            this_instruction.send_message.subject = `Form update - status is ${docData.status}`;
          }
          else {
            this_instruction.send_message.subject = await deepResolve(this_instruction.send_message.subject, reactData.peopleRec[reactData.pertains_to]);
          }
          this_instruction.send_message.text = await deepResolve(this_instruction.send_message.text, reactData.peopleRec[reactData.pertains_to]);
          await sendMessage(this_instruction.send_message);
        }
        if (this_instruction.hasOwnProperty('instruction') && (this_instruction.instruction === 'create_form')) {
          await createForm({        // finishing this form issues an instruction to create another form ("teacher recommendation" use case, for example)
            instructions: this_instruction,
            source_doc: document_id,
            doc_location: response.location
          });
        }
      }
    }
    updateReactData({
      document_id,
      docRec: recWritten,
      recWritten: recWritten,
      dataSaved: true,
    }, true);
    return response;
  };


  async function sendMessage(send_instructions) {
    let postTime = new Date().getTime();
    let newMessageThread = `${postTime}.${uuid(6)}`;
    let message_id = `${postTime}.${uuid(6)}.0~CuredMessage`;
    const reply_to = [state.session.person_id];
    let recipient_key = [send_instructions.send_to].flat();
    let PostOfficeRec = {
      Item: {
        thread_id: newMessageThread,
        message_id,
        allowReplyAll: false,
        client_id: state.session.client_id,
        deliver_time: postTime,
        from: state.session.patient_id,
        message_text: send_instructions.text,
        patient_id: state.session.patient_id,
        preferred_method: null,
        recipient_base: 'list',
        recipient_key,
        subject: send_instructions.subject || ``,
        reply_to
      },
      TableName: 'PostOffice'
    };
    if (send_instructions.attach) {
      PostOfficeRec.Item.attachments = [send_instructions.url];
    }
    await dbClient
      .put(PostOfficeRec)
      .promise()
      .catch(error => {
        cl(`Error writing to Post Office; error is ${error}`);
      });
    return;
  }

  let preset_values = {};
  async function createForm({ instructions, source_doc, doc_location }) {
    //   { 
    //     instruction: 'create_form',
    //     form_id: <form_id>   make a new form of type form_id as wip 
    //     fields: [ {<field>: <value>}, {<field>: {form: <form_field>}}, <field> (as a string - same as {<field> : {form: <field>}})
    //     assign_to: [user, user, (author), (pertains_to)...]  put it on the forms list for this/these people
    //     pertains_to: <specific_user_id>
    //     document_title: (optional) <string>
    //     restricted_access: 'admin_only'
    //     message: {text: <text>, subject: <subject>} 
    //   }, {}, ...]
    /*
    Example: {
      "form_id": "recommendation_response",
      "assign_to": [
        "rsteele"
      ],
      "document_title": "Test Title",
      "fields": [
        {
          "camper_first_name": "%%camper_first_name%% %%camper_last_name%%"
        },
        "camper_last_name",
        "camper_school_grade_2024_2025",
        "teachers_name",
        "teachers_email"
      ],
      "instruction": "create_form",
      "message": {
        "subject": "Test subject goes here",
        "text": "This is the message";
      },
      "pertains_to": "ava-campdemo",
      "restricted_access": "admin_only";
    }
    */

    // prepare data fields
    if (instructions.fields) {
      //  array - each entry is one of these forms: 
      //    object with key = field to set and value is a string {<key>: <value>}, 
      // or object with key = field to set and value is an object as in {<key>: {form: <form_field>}}, 
      // or a string = field name from the source form
      for (let this_field of instructions.fields) {
        if (!isObject(this_field)) {
          if (reactData.fields.hasOwnProperty(this_field)) {
            preset_values[this_field] = reactData.fields[this_field].value;
          }
        }
        else {
          for (const [key, value] of Object.entries(this_field)) {
            if (typeof (value) === 'string') {
              preset_values[key] = await resolveVariables(value);
            }
            else {
              if (reactData.fields.hasOwnProperty(value.form)) {
                preset_values[key] = reactData.fields[value.form].value;
              }
            }
          }
        }
      }
    }
    let newDocumentID = await createDocument({
      docData: {
        client_id: state.session.client_id,
        form_type: instructions.form_id,
        pertains_to: instructions.pertains_to,
        field_values: preset_values
      },
      author: state.session.user_id
    });

    // Send messages (optional)
    if (instructions.message) {
      // the message.text and message.subject may contain variables in the form %%field_name%%
      let final_messageText = await resolveVariables(instructions.message.text);
      let jumpTo = window.location.origin;
      for (const this_assignment of instructions.assign_to) {
        let final_html = final_messageText + `<br><br>Please click on <a href=${jumpTo}?document=${newDocumentID}&&docUser=${this_assignment}>this link</a> to respond.`;
        final_messageText += `\r\n\nClick on this link to respond: ${jumpTo}?document=${newDocumentID}&&docUser=${this_assignment}`;
        await sendMessages({
          client: state.session.client_id,
          author: state.session.user_id,
          person_id: state.session.patient_id,
          messageText: final_messageText,
          htmlText: final_html,
          recipientList: this_assignment,
          attachments: doc_location,
          subject: instructions.message.subject
            ? await resolveVariables(instructions.message.subject)
            : `A message from ${reactData.peopleRec[instructions.pertains_to].display_name || 'AVA Document Management'}`
        });
      }
    }

  }

  async function deepResolve(s, o) {
    let a = s.match(/(.*?)%%(.*?)%%(.*)/);
    if (a) {
      do {
        let v = '';
        if (preset_values && preset_values.hasOwnProperty(a[2])) {
          v = preset_values[a[2]];
        }
        else if (reactData.fields.hasOwnProperty(a[2])) {
          v = await formatValue({
            rawValue: reactData.fields[a[2]].value,
            type: reactData.fields[a[2]].type
          });
        }
        else if (o) {
          v = resolve({
            object: o,
            key: a[2].split('.')
          });
        }
        s = `${a[1]}${v}${a[3]}`;
        a = s.match(/(.*?)%%(.*?)%%(.*)/);
      } while (a);
    }
    return s;
  }

  async function resolveVariables(s, o) {
    let a = s.match(/(.*?)%%(.*?)%%(.*)/);
    if (a) {
      do {
        let v = '';
        if (preset_values && preset_values.hasOwnProperty(a[2])) {
          v = preset_values[a[2]];
        }
        else if (reactData.fields.hasOwnProperty(a[2])) {
          if (!reactData.fields[a[2]].value) {
            v = `<${reactData.fields[a[2]]?.prompt?.value || titleCase(a[2].toLowerCase().replace(/[^a-z]/, ' '))}>`;
          }
          else {
            v = await formatValue({
              rawValue: reactData.fields[a[2]].value,
              type: reactData.fields[a[2]].type
            });
          }
        }
        else if (o && o.hasOwnProperty(a[2])) {
          if (!o[a[2]].value) {
            v = `<${o[a[2]]?.prompt?.value || titleCase(a[2].toLowerCase().replace(/[^a-z]/, ' '))}>`;
          }
          else {
            v = await formatValue({
              rawValue: o[a[2]].value,
              type: o[a[2]].type
            });
          }
        }
        s = `${a[1]}${v}${a[3]}`;
        a = s.match(/(.*?)%%(.*?)%%(.*)/);
      } while (a);
    }
    return s;
  }

  async function printWIP({ document_id }) {
    let signatures = [];
    for (const this_field in reactData.fields) {
      if (reactData.fields[this_field].ignore) {
        continue;
      }
      if ((reactData.fields[this_field].type === 'signature')
        && (!signatureRef[reactData.fields[this_field].options.sigRefNumber].current.isEmpty())) {
        signatures[reactData.fields[this_field].options.sigRefNumber] = signatureRef[reactData.fields[this_field].options.sigRefNumber].current.getTrimmedCanvas().toDataURL('image/png');
      }
      reactData.fields[this_field].prompt.value =
        reconcilePrompt({
          rawValue: reactData.fields[this_field].prompt.value,
          this_field
        });
    };
    await printDocumentHybrid({
      documentList: [{
        sections: reactData.sections,
        fields: reactData.fields,
        docID: document_id,
        signatures,
        client_id: state.session.client_id,
        title: reactData.document_title
      }]
    });
  }

  async function initialize() {
    // request can pass in a document_id - in this case, we'll try to pick up the WIP document and continue with it
    // if document_id is not found in DocumentsInProcess, check to see if it is in DocumentsAssigned in which case we will launch a new document
    // if it is also not in DocumentsAssigned, check Documents to see if it is completed.  If found there, offer to display it.
    // If no document_id is sent in, or the document_id wasn't found in the process above, look for a form_id
    // If a form_id is sent in, create a new document from that form
    // Otherwise the call returns an error.

    if (reactData.document_id) {
      // first, look to see if the referenced document_id is completed.  If it is, show it and leave
      let docRec = await dbClient
        .get({
          Key: {
            document_id: reactData.document_id
          },
          TableName: "DocumentMaster"
        })
        .promise()
        .catch(error => {
          cl(`in FormFillB -> initialize, bad get to DocumentMaster with ${reactData.document_id || '(null)'}. Error is: ${error}`);
        });
      if (recordExists(docRec)) {
        if (docRec.Item.status === 'complete') {
          window.open(
            docRec.Item.history[0].url,
            docRec.Item.status,
            `name=${docRec.Item.status}, left=${20}, top=${20}`
          );
          handleAbort();
        }
        else {
          const { fields, sections, document_title } = await initializeDoc({
            form_id: docRec.Item.form_type,
            pertains_to: docRec.Item.pertains_to,
            preset_values: docRec.Item.field_values
          });
          updateReactData({
            document_title: docRec.Item.title || document_title,
            pertains_to: docRec.Item.pertains_to,
            form_id: docRec.Item.form_type,
            fields,
            sections,
            docRec: docRec.Item,
            formRec: { options: docRec.Item.options },
            stage: 'fill'
          }, true);
          return;
        }
      }
    }
    // if we got here, there was no existing document found with the passed in document_id
    // or no document_id was passed in at all. 
    // In this case, look for a DocumentinProcess for this person and formType...
    if (reactData.form_id && reactData.pertains_to && !reactData.options.start_from_scratch) {
      let queryObj = {
        KeyConditionExpression: 'pertains_to = :p and form_type = :f',
        ScanIndexForward: false,
        TableName: 'DocumentMaster',
        IndexName: 'person_form-index',
        ExpressionAttributeValues: {
          ':p': reactData.pertains_to,
          ':f': reactData.form_id
        }
      };
      let queryResult = await dbClient
        .query(queryObj)
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`in FormFillB -> initialize, bad get to DocumentMaster with pertains_to=${reactData.pertains_to || '(null)'} and form_id=${reactData.form_id || '(null)'}. Error is: ${error}`);
        });
      if (recordExists(queryResult)) {
        for (const this_document of queryResult.Items) {
          if (this_document.status !== 'complete') {
            const { fields, sections, document_title } = await initializeDoc({
              form_id: this_document.form_type,
              pertains_to: this_document.pertains_to,
              preset_values: this_document.field_values
            });
            updateReactData({
              document_id: this_document.document_id,
              document_title: this_document.title || document_title,
              pertains_to: this_document.pertains_to,
              form_id: this_document.form_type,
              fields,
              sections,
              formRec: { options: this_document.options },
              stage: 'fill'
            }, true);
            return;
          }
        }
      }
    }
    // we couldn't find an appropriate document to continue with, so we'll start a new one
    const { fields, sections, document_title } = await initializeDoc({
      form_id: reactData.form_id,
      pertains_to: reactData.pertains_to
    });
    let nowTime = new Date().getTime();
    updateReactData({
      document_id: `${reactData.pertains_to}_${reactData.form_id}_${nowTime}`,
      pertains_to: reactData.pertains_to,
      form_id: reactData.form_id,
      document_title,
      fields,
      sections,
      stage: 'fill'
    }, true);
    return;
  }

  const dontShowSection = (this_sectionObj) => {
    if (this_sectionObj.hasOwnProperty('show_if')) {
      let reason = 'unknown';
      for (const this_test of this_sectionObj.show_if) {
        if (this_test.hasOwnProperty('pertainsTo_memberOf')) {
          if (reactData.peopleRec[reactData.pertains_to].groups.some(g => { return [this_test.memberOf].flat().includes(g); })) {
            return false;
          }
          else { reason = 'pertains_to'; }
        }
        else if (this_test.hasOwnProperty('memberOf')) {
          if (state.patient.groups.some(g => { return [this_test.memberOf].flat().includes(g); })) {
            return false;
          }
          else { reason = 'memberOf'; }
        }
        else {
          const this_value = reactData.fields[this_test.field].value;
          if (array_in_array(this_test.values, this_value)) {
            return false;
          }
          else { reason = 'data'; }
        }
      }
      return reason;
    }
    else {
      return false;
    }
  };

  /********************
   * 
   * Initialize
   * 
   ********************/

  React.useEffect(() => {
    async function goLoad() {
      if (reactData.options.mode === 'printEmpty') {
        const { fields, sections, document_title } = await initializeBlank({ form_id: reactData.form_id });
        await printEmptyDocument({
          documentList: [{
            sections,
            fields,
            client_id: state.session.client_id,
            title: document_title
          }]
        });
        onClose();
      }
      else {
        await initialize();
        if (!reactData.sections) {
          onClose();
        }
        start();  // idle timer
        updateReactData({
          stage: 'fill'
        }, true);
      }
    }
    if (reactData.stage === 'initialize') {
      goLoad();
    }
  }, [reactData.form_id, reactData.document_id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // **************************

  return (
    <Dialog
      open={(forceRedisplay && (reactData.version > 0)) || true}
      key={`wholeScreen__`}
      onClose={handleAbort}
      classes={{ paper: classes.clientBackground }}
    >
      {!isInitializing() &&
        <React.Fragment>
          <Box m={2}>
            <Typography style={AVATextStyle({
              size: 1.8, bold: true, margin: {
                bottom: 1,
                top: 1,
              }
            })}>
              {reactData.document_title}
            </Typography>
          </Box>
          <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
            {reactData.sections.map((sectionObj, sectionNdx) => (
              (!dontShowSection(sectionObj) &&
                <React.Fragment
                  key={`sectionFrag__${sectionObj.section_name}_${sectionNdx}`}
                >
                  <Typography
                    key={`section__${sectionObj.section_name}`}
                    style={AVATextStyle({
                      size: 1.3, bold: true, margin: {
                        bottom: 1,
                        top: ((sectionNdx === 0) ? 1 : 3),
                      }
                    })}
                  >
                    {sectionObj.section_name}
                  </Typography>
                  {sectionObj.fields.map((this_field, fieldNdx) => (
                    (reactData.fields.hasOwnProperty(this_field) &&
                      (!reactData.fields[this_field].options || !reactData.fields[this_field].options.hidden) &&
                      !reactData.fields[this_field].ignore &&

                      <React.Fragment
                        key={`fieldFrag__${this_field}_${sectionNdx}`}
                      >
                        {reactData.fields[this_field].prompt.newLine &&
                          <Typography
                            key={`section__${sectionObj.section_name}_${reactData.fields[this_field]}-breakRow`}
                            className={classes.breakRow}
                          >
                            {''}
                          </Typography>
                        }
                        {(reactData.fields[this_field].type === 'text') &&
                          <TextField
                            id={`field__${this_field}`}
                            key={`field__${this_field}__${sectionNdx}_${(reactData.fields[this_field] && reactData.fields[this_field].valueText)
                              ? reactData.fields[this_field].valueText
                              : ''}`}
                            className={classes.inputDisplay}
                            multiline
                            variant={reactData.fields[this_field].prompt.rows ? 'outlined' : 'standard'}
                            disabled={reactData.fields[this_field].options.viewOnly}
                            style={AVATextStyle({
                              lineHeight: 1,
                              width: `${reactData.fields[this_field].prompt.width || 200}px`,
                              maxWidth: '90%',
                              size: 0.75,
                              color: 'black',
                              margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                            })}
                            autoComplete='off'
                            defaultValue={(reactData.fields[this_field] && reactData.fields[this_field].valueText)
                              ? reactData.fields[this_field].valueText
                              : ''
                            }
                            onBlur={async (event) => {
                              await handleChangeValue({
                                newText: event.target.value,
                                prop: this_field,
                                sentenceCase: true
                              });
                            }}
                            helperText={reconcilePrompt({
                              rawValue: reactData.fields[this_field].prompt.value,
                              this_field
                            })}
                          />
                        }
                        {(reactData.fields[this_field].type === 'header') &&
                          <Typography
                            style={AVATextStyle(Object.assign(
                              {},
                              {
                                size: 0.75,
                                margin: { top: 2, bottom: 0.5, right: 3 }
                              },
                              reactData.fields[this_field].prompt.style || {}
                            ))}
                          >
                            {reactData.fields[this_field].prompt.value}
                          </Typography>
                        }
                        {(reactData.fields[this_field].type === 'image') &&
                          <Box
                            className={classes.imageArea}
                            component="img"
                            alt={''}
                            src={reactData.fields[this_field].valueText}
                          />
                        }
                        {(reactData.fields[this_field].type === 'phone') &&
                          <TextField
                            id={`field__${fieldNdx}`}
                            className={classes.inputDisplay}
                            autoComplete='off'
                            disabled={reactData.fields[this_field].options.viewOnly}
                            key={`field__${fieldNdx}__${sectionNdx}_${(reactData.fields[this_field] && reactData.fields[this_field].valueText)
                              ? reactData.fields[this_field].valueText
                              : ''}`}
                            style={AVATextStyle({
                              lineHeight: 1,
                              width: `${reactData.fields[this_field].prompt.width || 200}px`,
                              size: 0.75,
                              padding: { bottom: 0 },
                              margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                            })}
                            defaultValue={(reactData.fields[this_field] && reactData.fields[this_field].valueText)
                              ? reactData.fields[this_field].valueText
                              : ''
                            }
                            onBlur={async (event) => {
                              if (event.target.value) {
                                let fPhone = formatPhone(event.target.value);
                                await handleChangeValue({
                                  newText: fPhone,
                                  newValue: `+1${fPhone.replace(/\D/g, '')}`,
                                  prop: this_field,
                                  sentenceCase: false
                                });
                              }
                            }}
                            helperText={reconcilePrompt({
                              rawValue: reactData.fields[this_field].prompt.value,
                              this_field
                            })}
                          />
                        }
                        {(reactData.fields[this_field].type === 'date_select') &&
                          <Box
                            display='flex'
                            flexDirection='column'
                            id={`dateBox__${this_field}`}
                            key={`datebox__${fieldNdx}__${sectionNdx}_${(reactData.fields[this_field] && reactData.fields[this_field].value)
                              ? reactData.fields[this_field].value
                              : ''}`}
                            justifyContent='flex-start'
                            marginTop={1}
                            marginLeft={0}
                            alignItems='flex-start'
                          >
                            <input
                              type="date"
                              id={`field__${fieldNdx}`}
                              key={`field__${fieldNdx}__${sectionNdx}_${(reactData.fields[this_field] && reactData.fields[this_field].value)
                                ? reactData.fields[this_field].value
                                : ''}`}
                              min={reactData.fields[this_field].prompt.min}
                              max={reactData.fields[this_field].prompt.max}
                              value={(reactData.fields[this_field] && reactData.fields[this_field].valueText)
                                ? makeDate(reactData.fields[this_field].value).input
                                : ''
                              }
                              onChange={async (event) => {
                                if (event.target.value) {
                                  let dObj = makeDate(event.target.value, { noTime: true, noYearCorrection: true });
                                  if (!dObj.error) {
                                    await handleChangeValue({
                                      newText: dObj.absolute,
                                      newValue: dObj.numeric$,
                                      prop: this_field,
                                      sentenceCase: false
                                    });
                                  }
                                }
                              }}
                            />
                            {reactData.fields[this_field].prompt.newLine &&
                              <Typography
                                key={`section__${sectionObj.section_name}_${reactData.fields[this_field]}-breakRow`}
                                className={classes.breakRow}
                                style={AVATextStyle({
                                  lineHeight: 1,
                                  width: `${reactData.fields[this_field].prompt.width || 200}px`,
                                  maxWidth: '90%',
                                  size: 0.75,
                                  opacity: '60%',
                                  margin: { top: 0.25, bottom: 0.5, left: 0, right: 3 }
                                })}
                              >
                                {reconcilePrompt({
                                  rawValue: reactData.fields[this_field].prompt.value,
                                  this_field
                                })}
                              </Typography>
                            }
                          </Box>
                        }
                        {((reactData.fields[this_field].type === 'date')
                          || (reactData.fields[this_field].type === 'time')) &&
                          <TextField
                            id={`field__${fieldNdx}`}
                            className={classes.inputDisplay}
                            disabled={reactData.fields[this_field].options.viewOnly}
                            autoComplete='off'
                            key={`field__${fieldNdx}__${sectionNdx}_${(reactData.fields[this_field] && reactData.fields[this_field].value)
                              ? reactData.fields[this_field].value
                              : ''}`}
                            style={AVATextStyle({
                              lineHeight: 1,
                              size: 0.75,
                              padding: { bottom: 0 },
                              margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                            })}
                            defaultValue={(reactData.fields[this_field] && reactData.fields[this_field].valueText)
                              ? reactData.fields[this_field].valueText
                              : ''
                            }
                            onBlur={async (event) => {
                              if (event.target.value) {
                                let dObj = makeDate(event.target.value, { noTime: (reactData.fields[this_field].type === 'date'), noYearCorrection: true });
                                if (!dObj.error) {
                                  await handleChangeValue({
                                    newText: dObj.absolute,
                                    newValue: ((reactData.fields[this_field].type === 'date')
                                      ? dObj.numeric$
                                      : dObj.timestamp),
                                    prop: this_field,
                                    sentenceCase: false
                                  });
                                }
                              }
                            }}
                            helperText={reconcilePrompt({
                              rawValue: reactData.fields[this_field].prompt.value,
                              this_field
                            })}
                          />
                        }
                        {(reactData.fields[this_field].type.startsWith('select')) &&
                          <Box
                            display='flex'
                            mb={0}
                            flexDirection='row'
                            justifyContent='flex-start'
                            alignItems='center'
                          >
                            <AVACheckBoxGroup
                              prop={this_field}
                              text={reactData.fields[this_field].selectionObj.selectionList}
                              withPrompt={(reactData.fields[this_field].type === 'select&text')
                                ? reactData.fields[this_field].prompt.other || 'other'
                                : null
                              }
                            />
                          </Box>
                        }
                        {(reactData.fields[this_field].type === 'html') &&
                          <Box>
                            <div
                              dangerouslySetInnerHTML={{ '__html': reactData.fields[this_field].value }}
                            />
                          </Box>
                        }
                        {(reactData.fields[this_field].type === 'image') &&
                          <img
                            className={classes.imageArea}
                            alt=''
                            src={reactData.fields[this_field].value}
                          />
                        }
                        {(reactData.fields[this_field].type === 'url') &&
                          <a
                            href={reactData.fields[this_field].value}
                            style={{ color: 'inherit', textDecoration: 'none' }}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Typography
                              style={AVATextStyle(Object.assign({}, {
                                size: 0.75,
                                margin: { top: 2, bottom: 0.5, left: 0.5, right: 3 }
                              }))}
                            >
                              <u>{reactData.fields[this_field].prompt.helper || `Tap here for ${reconcilePrompt({
                                rawValue: reactData.fields[this_field].prompt.value,
                                this_field
                              })}`}</u>
                            </Typography>
                          </a>
                        }
                        {(reactData.fields[this_field].type === 'signature') &&
                          <Box
                            display='flex'
                            flexDirection='column'
                            id={`sigBox__${this_field}`}
                            key={`sigBox__${this_field}_${sectionNdx}`}
                            justifyContent='flex-start'
                            marginTop={2}
                            marginBottom={2}
                            alignItems='flex-start'
                            width='97%'
                          >
                            <SignatureCanvas
                              ref={signatureRef[reactData.fields[this_field].options.sigRefNumber || 0]}
                              canvasProps={{
                                style: {
                                  backgroundColor: 'beige',
                                  width: '75%',
                                  marginLeft: '10px',
                                  marginRight: '10px',
                                  marginTop: '2px',
                                  height: '88px'
                                }
                              }}
                            />
                            <Typography
                              id={`sigBoxText__${this_field}`}
                              key={`sigBoxText__${this_field}_${sectionNdx}`}
                              style={AVATextStyle({
                                lineHeight: 1,
                                width: `${reactData.fields[this_field].prompt.width || 200}px`,
                                maxWidth: '90%',
                                size: 0.75,
                                margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                              })}
                            >
                              {reconcilePrompt({
                                rawValue: reactData.fields[this_field].prompt.value,
                                this_field
                              })}
                            </Typography>
                            <Box display='flex' mt={0} mb={0} flexWrap='wrap' flexDirection='row' justifyContent='center' alignItems='center'>
                              {signatureRef[reactData.fields[this_field].options.sigRefNumber || 0].current &&
                                <Button
                                  className={AVAClass.AVAMicroButton}
                                  style={{ backgroundColor: 'white', color: 'red' }}
                                  size='small'
                                  onClick={() => {
                                    signatureRef[reactData.fields[this_field].options.sigRefNumber || 0].current.clear();
                                    setForceRedisplay(!forceRedisplay);
                                  }}
                                >
                                  {'Clear'}
                                </Button>
                              }
                            </Box>
                          </Box>
                        }
                        {(reactData.fields[this_field].type === 'id') &&
                          <Box
                            display='flex'
                            flexDirection='row'
                            key={`selectParent-${this_field}_${sectionNdx}`}
                            id={`selectParent-${this_field}`}
                            width={`${reactData.fields[this_field].prompt.width || 200}px`}
                            flexGrow={1}
                            marginBottom={0}
                            justifyContent='flex-start'
                            alignItems='flex-start'
                          >
                            <Box
                              key={`selectBox-${this_field}_${sectionNdx}`}
                              display='flex' marginLeft={1} flexGrow={1} flexDirection='column'
                            >
                              <Select
                                options={reactData.peopleList[reactData.fields[this_field].choose.ref]}
                                searchBy={'label'}
                                dropdownHandle={true}
                                clearOnSelect={true}
                                clearOnBlur={true}
                                key={`selectOptions-${this_field}_${sectionNdx}`}
                                searchable={true}
                                create={false}
                                closeOnClickInput={true}
                                closeOnSelect={true}
                                style={{
                                  lineHeight: 1,
                                  fontSize: `${reactData.user_fontSize * (1.05)}rem`,
                                  marginLeft: '-5px',
                                  marginBottom: '-4px',
                                  borderWidth: 0
                                }}
                                noDataLabel={`No ${reconcilePrompt({
                                  rawValue: reactData.fields[this_field].prompt.value,
                                  this_field
                                })}s match`}
                                values={(reactData.fields[this_field]) ?
                                  (reactData.fields[this_field].valueText
                                    ? [{ label: reactData.fields[this_field].valueText, value: reactData.fields[this_field].value }]
                                    : (reactData.fields[this_field].valueList
                                      ? reactData.fields[this_field].valueList.map(this_value => {
                                        return {
                                          label: (reactData.peopleList[reactData.fields[this_field].choose.ref].find(this_person => {
                                            return (this_person.value === this_value);
                                          })).label,
                                          value: this_value
                                        };
                                      })
                                      : []
                                    )
                                  ) : []
                                }
                                placeholder={``}
                                onChange={async (values) => {
                                  if (values.length > 0) {
                                    await handleChangeValue({
                                      newText: values[0].label,
                                      newValue: values[0].value,
                                      prop: this_field,
                                      sentenceCase: false
                                    });
                                  }
                                }}
                              />
                              <Box display='flex'
                                flexDirection='row'
                                paddingTop={'4px'}
                                borderTop={1}
                                key={`selectPromptBox-${this_field}_${sectionNdx}`}
                              >
                                <Typography
                                  key={`selectPrompt-${this_field}_${sectionNdx}`}
                                  id={`selectPrompt-${this_field}`}
                                  style={AVATextStyle({
                                    lineHeight: 1,
                                    width: `${reactData.fields[this_field].prompt.width || 200}px`,
                                    maxWidth: '90%',
                                    size: 0.75,
                                    opacity: '60%',
                                    margin: { top: 0.25, bottom: 0.5, left: 0, right: 3 }
                                  })}
                                >
                                  {reconcilePrompt({
                                    rawValue: reactData.fields[this_field].prompt.value,
                                    this_field
                                  })}
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        }
                      </React.Fragment>

                    )
                  ))}
                </React.Fragment>
              )
            ))}
          </DialogContent>
          <Box
            display='flex'
            flexDirection='row'
            alignItems={'center'}
            marginTop={'16px'}
            marginBottom={'16px'}
            justifyContent={'space-around'}
          >
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={() => {
                updateReactData({
                  stage: 'exit'
                }, true);
              }}
            >
              {'Exit'}
            </Button>
            <Box display='flex' flexDirection='row' justifyContent='flex-end' alignItems='center'>
              {!reactData.formRec?.options?.noSaveContinue && !reactData.clientSampleMode &&
                <Button
                  onClick={async () => {
                    const document_id = reactData.document_id || `${state.session.patient_id}_${reactData.form_id}_${new Date().getTime()}`;
                    await handleSave({
                      document_id,
                      final: false
                    });
                  }}
                  className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'lightcyan', color: 'black' }}
                  size='small'
                >
                  {isMobile() ? 'Save' : 'Save/Continue'}
                </Button>
              }
              {!reactData.clientSampleMode &&
                <Button
                  onClick={async () => {
                    await handleReview();
                  }}
                  className={AVAClass.AVAButton}
                  style={{ backgroundColor: 'green', color: 'white' }}
                  size='small'
                >
                  {'Finish'}
                </Button>
              }
              <PrintIcon
                classes={{ root: classes.rowButton }}
                size='medium'
                aria-label="penciladd_icon"
                onClick={async () => {
                  await printWIP({ document_id: reactData.document_id });
                }}
                edge="start"
              />
              {!reactData.clientSampleMode &&
                <CloudUploadIcon
                  classes={{ root: classes.rowButton }}
                  style={{ marginLeft: '16px' }}
                  key={`radio-button_upload`}
                  id={`radio-button_upload`}
                  size='medium'
                  onClick={() => {
                    updateReactData({
                      stage: 'upload'
                    }, true);
                  }}
                />
              }
            </Box>
          </Box>
        </React.Fragment>
      }
      {(reactData.stage === 'upload') &&
        <AVAUploadFile
          options={{
            buttonText: ['Choose', 'Save & Continue'],
            title: [reactData.document_title, 'Tap "Choose a File" to select the content to upload'],
            oneOnly: true
          }}
          onCancel={() => {
            updateReactData({
              stage: 'fill'
            }, true);
          }}
          onLoad={async (response) => {
            const docRec = await updateDocument({
              docData: Object.assign({},
                reactData.docRec,
                {
                  document_id: reactData.document_id,
                  form_type: reactData.form_id,
                  pertains_to: reactData.pertains_to,
                  client_id: state.session.client_id
                }
              ),
              author: state.session.user_id,
              save_type: 'uploaded',
              url: response[0].fLoc
            });
            if (!docRec) {
              updateReactData({
                stage: 'fill'
              }, true);
            }
            else {
              onClose('docAdded',
                {
                  document_id: reactData.document_id,
                  document_title: reactData.document_title,
                  document_status: 'uploaded',
                  location: response[0],
                  pertains_to: reactData.pertains_to,
                  recWritten: docRec,
                  nextAction: (reactData.formRec?.options?.onFinish
                    ? makeNextAction({ instruction: reactData.formRec?.options?.onFinish })
                    : null
                  )
                }
              );
            };
          }}
        />
      }
      {(reactData.stage === 'confirm') &&
        <AVAConfirm
          promptText={reactData.messageList}
          cancelText={'Go back'}
          confirmText={(reactData.activeErrors)
            ? '*none*'
            : (reactData.errorsOnForm ? 'Submit' : 'Complete')
          }
          onCancel={() => {
            updateReactData({
              stage: 'fill'
            }, true);
          }}
          onConfirm={async () => {
            let response = await handleSave({
              document_id: reactData.document_id,
              final: true,
              pending: !!reactData.errorsOnForm
            });
            if (!response.goodPut) {
              updateReactData({
                stage: 'error',
                errorMessage: makeArray(response.putError)
              }, true);
            }
            else {
              onClose('docAdded',
                {
                  document_id: reactData.document_id,
                  document_title: reactData.document_title,
                  document_status: response.status,
                  location: response.location,
                  pertains_to: reactData.pertains_to,
                  recWritten: Object.assign({}, response.recWritten, reactData.peopleRec[reactData.pertains_to]),
                  nextAction: (reactData.formRec?.options?.onFinish
                    ? makeNextAction({ instruction: reactData.formRec?.options?.onFinish })
                    : null
                  )
                }
              );
            }
          }}
        />
      }
      {(reactData.stage === 'exit') &&
        <AVAConfirm
          promptText={[`${valuesChanged() ? 'Warning! You have unsaved changes!  ' : ''}Are you sure you want to exit?`]}
          cancelText={`No, keep going`}
          confirmText={`Yes, exit`}
          onCancel={() => {
            updateReactData({
              stage: 'fill'
            }, true);
          }}
          onConfirm={async () => {
            if (reactData.dataSaved) {
              onClose('docAdded',
                {
                  document_id: reactData.document_id,
                  document_title: reactData.document_title,
                  document_status: 'work_in_process',
                  pertains_to: reactData.pertains_to,
                  recWritten: reactData.recWritten
                }
              );
            }
            else {
              onClose('aborted',
                {
                  document_id: 'n/a',
                  document_status: 'aborted'
                }
              );
            }
          }}
          allowCancel={true}
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
    </Dialog>
  );

};
