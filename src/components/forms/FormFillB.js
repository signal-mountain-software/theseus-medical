import React from 'react';

import { dbClient, cl, makeArray, deepCopy, isEmpty, getDb, sentenceCase, listFromArray, array_in_array, recordExists, isObject, titleCase, uuid, isMobile } from '../../util/AVAUtilities';
import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { formatPhone, makeName } from '../../util/AVAPeople';
import { makeDate, makeTime } from '../../util/AVADateTime';
import AVAConfirm from './AVAConfirm';
import AVAUploadFile from '../../util/AVAUploadFile';

import { printFromHTML, sendMessages } from '../../util/AVAMessages';
import { printEmptyDocument } from '../../util/AVAMessages';
import SignatureCanvas from 'react-signature-canvas';
import Select from "react-dropdown-select";
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import EditIcon from '@material-ui/icons/Edit';
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
  checkboxWrappedIndent: {
    marginLeft: 32,
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

  // This ref is to capture the entire form contents for HTML output
  const formContainerRef = React.useRef(null);

  const generateHtmlOutput = () => {
    // Access outerHTML when needed
    const scrubHTML = (html) => {
      // Create a temporary DOM to avoid modifying the visible UI
      let checkpoint = { type: typeof html, isElement: html instanceof Element, outerHTMLLength: html.outerHTML?.length };
      console.log('scrubHTML input:', checkpoint);
      const tempDiv = document.createElement('div');
      // tempDiv.innerHTML = html.outerHTML;
      tempDiv.innerHTML = html.innerHTML;
      console.log('scrubHTML tempDiv created:', { tempDivType: typeof tempDiv, tempDivLength: tempDiv.outerHTML.length });

      let finalDiv = document.createElement('div');
      const re = /^<div class="MuiBox-root MuiBox-root-\d+"><p class="MuiTypography-root/;

      let styleSheet = '';
      for (let style of tempDiv.querySelectorAll('style')) {
        console.log('scrubHTML found style div:', { divContent: style.innerHTML });
        styleSheet += style.outerHTML;
      }

      for (let div of tempDiv.querySelectorAll('div')) {
        if (div.innerHTML && (div.innerHTML.includes('Please tap') || div.innerHTML.includes('Please click')) && div.innerHTML.includes('href')) {
          // divsToRemove.push(div);
          console.log('scrubHTML removing div:', { divContent: div.innerHTML });
        }
        else if (div.innerHTML && (div.innerHTML.includes(reactData.document_title))) {
          if (re.test(div.innerHTML.trim())) {
            console.log('scrubHTML found title div:', { divContent: div.innerHTML });
            tempDiv.innerHTML = styleSheet + div.innerHTML;
            break;
          }
        }
        else if (div.innerHTML && (div.innerHTML.includes('aria-hidden="true"'))) {
          // divsToRemove.push(div);
        }
      }
      // divsToRemove.forEach(div => div.remove());

      // const nosToRemove = [];
      // tempDiv.querySelectorAll('noscript').forEach(noscript => {
      //   nosToRemove.push(noscript);
      // });
      // nosToRemove.forEach(noscript => noscript.remove());

      console.log('scrubHTML returning:', { type: typeof finalDiv, isElement: finalDiv instanceof Element });

      return tempDiv;
    };

    if (formContainerRef.current) {
      const htmlText = document.documentElement.outerHTML;
      console.log('generateHtmlOutput htmlText:', { length: htmlText.length });
      const scrubbedHtml = scrubHTML(document.documentElement);
      let checkpoint2 = { type: typeof scrubbedHtml, isElement: scrubbedHtml instanceof Element, outerHTMLLength: scrubbedHtml.outerHTML?.length };
      console.log('generateHtmlOutput scrubbedHtml:', checkpoint2);
      printFromHTML({ htmlContent: scrubbedHtml });
    }

  };

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
      form_stage: <stage_name>
    }]
    */

    formStages: [{}],  // this loads from the Form template (FormRec.stages)
    previous_formStage: 'default',
    errors_on_Form: 0,
    /* 
     A form can define a stages array in its form record.  
     The stage objects will be sequential in the array and imply progress through the form. 
     If not present, always assume "default" as the element 0 entry and "complete" as the final entry.
     Here's how form stages works:
     formRec.stages = [
       {
         stage_name: 'default',
         on_entry_message: {
           template_id: <template_id>,
           text: 'Form has not been started yet',
           recipientList: {
             people: [<user_id>, <user_id>, ...],
             groups: [<group_id>, <group_id>, ...]
           }
         },
         on_complete_message: {
           template_id: <template_id>,
           text: 'Form has entered <stage_name> stage',
           recipientList: {
             people: [<user_id>, <user_id>, ...],
             groups: [<group_id>, <group_id>, ...]
           }
         }
       }, ... 
       'application', 'review', 'approved', 'assigned', 'complete']
 
     Then...  each section may include a stage property indicating which stage it belongs to.
     If a section does not declare a stage, it is assumed to belong to the 'default' stage.
     Multiple sections may belong to the same stage, and FormFillB can show multiple stages all at the same time.
     If all fields in all sections in a stage are valid, that stage is marked complete.
 
     reactData.previous_formStage keeps track of the last known stage status so we can detect transitions.
     When loading from a document, reactData.previous_formStage is populated with the document's form_stage value.
     If a document has no form_stage, we assume 'default'.
     If loading from a FormRec (new form), we assume 'default'.
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
    viewOnlyMode: options.viewOnly || false,
    formUpdates: 0,
    lastActiveTime: nowObj,
    version: 1,
    idleState: false,
    pertains_to: options.person_id,
    clientSampleMode: (!options.document_id && (options.person_id === state.session.client_id))
  });

  function uploadIcon(this_field, occ_index) {
    const IconToRender = (makeArray(reactData.fields[this_field].valueText).length > 1) ? EditIcon : CloudUploadIcon;
    return (
      <IconToRender
        classes={{ root: classes.rowButton }}
        style={{ marginLeft: '16px', marginBottom: '4px' }}
        key={`radio-button_upload`}
        id={`radio-button_upload`}
        size='medium'
        onClick={() => {
          updateReactData({
            stage: 'uploadField',
            field_title: reconcilePrompt({
              rawValue: reactData.fields[this_field].prompt?.value,
              this_field
            }),
            oneOnly: (reactData.fields[this_field].prompt && reactData.fields[this_field].prompt.hasOwnProperty('oneOnly')
              ? reactData.fields[this_field].prompt.oneOnly
              : true
            ),
            upload_data: {
              prop: this_field,
              occ_index,
            }
          }, true);
        }}
      />
    );
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
      if (!isInitializing() && valuesChanged()) {
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

  const checkIgnore = (tests) => {
    const { ignoreObj, showObj } = tests;
    const matchValues = (valToCheck, valuesToMatch) => {
      // Normalize valuesToMatch: convert string values to lowercase without mutating the original
      const normalizedValues = Array.isArray(valuesToMatch)
        ? valuesToMatch.map(v => typeof v === 'string' ? v.toLowerCase() : v)
        : valuesToMatch;

      if (isEmpty(valToCheck) && normalizedValues.includes('%%no_data%%')) {
        return true;
      }
      else if (
        (valToCheck === false && normalizedValues.includes('false')) ||
        (valToCheck === true && normalizedValues.includes('true')) ||
        (typeof valToCheck === 'string' && normalizedValues.includes(valToCheck.toLowerCase())) ||
        (Array.isArray(valToCheck) && array_in_array(normalizedValues, valToCheck.map(v => typeof v === 'string' ? v.toLowerCase() : v)))
      ) {
        return true;
      }
      return false;
    };
    let ignoreResult = false;
    if (ignoreObj) {
      let field_to_ignore = ignoreObj.data.split('.').slice(-1)[0];
      let value_to_test = reactData.fields[field_to_ignore]?.value ?? null;
      const values_to_ignore = makeArray(ignoreObj.values);
      ignoreResult = matchValues(value_to_test, values_to_ignore);
    }
    else if (showObj) {
      let field_to_ignore = showObj.data.split('.').slice(-1)[0];
      let value_to_test = reactData.fields[field_to_ignore]?.value ?? null;
      if (showObj.data.startsWith('field.')) { // field.field_name
        const field_name = showObj.data.split('.')[1];
        value_to_test = reactData.fields[field_name]?.value ?? null;
      }
      const values_to_ignore = makeArray(showObj.values);
      ignoreResult = !matchValues(value_to_test, values_to_ignore);
    }
    return ignoreResult;
  };

  // **************************
  // Helper to recursively get all descendants (children, grandchildren, etc.) of groups in a list
  const getAllChildrenOfGroups = (groupList) => {
    if (!groupList || !Array.isArray(groupList) || groupList.length === 0) {
      return [];
    }

    const allDescendants = new Set(groupList); // Pre-load with original groups
    const visited = new Set(); // Track visited nodes to prevent infinite loops

    // Recursive helper to add a group's children and all their descendants
    const addDescendants = (group_id) => {
      // If we've already visited this group, skip it (circular reference protection)
      if (visited.has(group_id)) {
        return;
      }

      // Mark this group as visited
      visited.add(group_id);

      // Check if this group has children
      if (state.groups.parent_of && state.groups.parent_of.hasOwnProperty(group_id)) {
        // For each child
        for (const child of state.groups.parent_of[group_id]) {
          // Add the child to the set
          allDescendants.add(child);
          // Recursively add the child's descendants
          addDescendants(child);
        }
      }
    };

    // Process each group in the input list
    for (const this_group of groupList) {
      addDescendants(this_group);
    }

    // Convert Set back to array and return
    return Array.from(allDescendants);
  };

  // **************************
  // Helper to recursively get all ancestors (parents, grandparents, etc.) of groups in a list
  const getAllParentsOfGroups = (groupList) => {
    if (!groupList || !Array.isArray(groupList) || groupList.length === 0) {
      return [];
    }

    const allAncestors = new Set(groupList); // Pre-load with original groups
    const visited = new Set(); // Track visited nodes to prevent infinite loops

    // Helper to find a group's parent
    const getParent = (group_id) => {
      const groupInfo = state.groups.adminHierarchy?.find(g => g.id === group_id);
      if (groupInfo && groupInfo.belongs_to && !groupInfo.belongs_to.toLowerCase().includes('_top_')) {
        return groupInfo.belongs_to;
      }
      return null;
    };

    // Recursive helper to add a group's parents and all their ancestors
    const addAncestors = (group_id) => {
      // If we've already visited this group, skip it (circular reference protection)
      if (visited.has(group_id)) {
        return;
      }

      // Mark this group as visited
      visited.add(group_id);

      // Get the parent of this group
      const parent = getParent(group_id);
      if (parent) {
        // Add the parent to the set
        allAncestors.add(parent);
        // Recursively add the parent's ancestors
        addAncestors(parent);
      }
    };

    // Process each group in the input list
    for (const this_group of groupList) {
      addAncestors(this_group);
    }

    // Convert Set back to array and return
    return Array.from(allAncestors);
  };

  // **************************
  // Consolidated helper to resolve and return default value for a field
  const getDefaultValueForField = async ({ fieldRec, fieldName }) => {
    // fieldRec: the field record from formRec.fields[fieldName]
    // Returns: { value: <resolved_value> } or empty object if no default found
    if (!fieldRec || !fieldRec.default) {
      return {};
    }

    let response = {};
    const defaultObj = {};

    // Handle default.source
    if (fieldRec.default.source) {
      let sourceDefaults = [];
      if (Array.isArray(fieldRec.default.source)) {
        sourceDefaults = fieldRec.default.source;
      } else {
        sourceDefaults = [fieldRec.default.source];
      }

      for (const this_default of sourceDefaults) {
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
        else if ((source_file.toLowerCase().startsWith('person')) || (source_file.toLowerCase().startsWith('people'))) {
          response.value = resolve({
            object: reactData.peopleRec[reactData.pertains_to],
            key: defaultObj.source_path
          });
        }
        else if (source_file.startsWith('family')) {
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
        else if (source_file.startsWith('formData') || (source_file.startsWith('field'))) {
          response.value = reactData.fields[defaultObj.source_path[0]]?.value ?? '';
        }

        if (response.value) {
          break;
        }
      }
    }

    // Handle default.value
    if (!response.value && fieldRec.default.value) {
      defaultObj.value_path = makeArray(fieldRec.default.value, '.');
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
      else if (defaultObj.value_path[0].toLowerCase() === 'field') {
        if (defaultObj.value_path[1]) {
          response.value = reactData.fields[defaultObj.value_path[1]].value;
        }
      }
      else if (defaultObj.value_path.length === 1) {
        response.value = defaultObj.value_path[0];
      }
    }

    return response;
  };

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
          else if (source_file.startsWith('formData') || (source_file.startsWith('field'))) {
            response.value = reactData.fields[defaultObj.source_path[0]]?.value ?? '';
          }
          if (response.value) {
            break;
          }
        }
      }
    }
    return response;
  };

  async function getFieldVariables({ field_key, field_name, fieldEntry, formRec }) {
    // fieldVariables will contain the field's created keys such as prompt, default, etc
    // build it like this: 
    //  first, look in Form_fields table for field_key
    //  second, look in Common_Fields for field_key to override any of those values
    //  third, values in formRec[field_name] to override any of those values
    //  finally, if fieldEntry is an object, use those values to override any of those values
    let field_variables = {};

    let formFieldRec = await getDb({
      Key: {
        client_id: state.session.client_id,
        field_name: field_key
      },
      TableName: "Form_Fields"
    });
    if (formFieldRec) {
      // Found in Form_Fields table
      field_variables = Object.assign({}, formFieldRec);
    }

    let commonFieldRec = await getDb({
      Key: {
        client_id: state.session.client_id,
        field_id: field_key
      },
      TableName: "Common_Fields"
    });
    if (commonFieldRec) {
      // Found in Common_Fields table
      field_variables = Object.assign({}, field_variables, commonFieldRec.value, commonFieldRec);
    }

    // Now override with any values in formRec.fields[field_name]
    if (formRec.fields && formRec.fields[field_name]) {
      field_variables = Object.assign({}, field_variables, formRec.fields[field_name]);
    }

    if (isObject(fieldEntry)) {
      // Finally, override with any values in fieldEntry object
      field_variables = Object.assign({}, field_variables, fieldEntry);
    }
    return field_variables;
  };

  // Helper function to process a single field from a section
  const processFieldForSectionField = async ({ field_name, field_key, fieldEntry, docFields, index, section, formRec, response }) => {

    let returnObj = {};
    let field_variables = await getFieldVariables({ field_key, field_name, fieldEntry, formRec });

    if (isObject(field_variables.prompt)) {
      returnObj.prompt = Object.assign({}, field_variables.value, field_variables.prompt);
    } else {
      returnObj.prompt = Object.assign({}, field_variables.value, { value: field_variables.prompt });
    }

    if (isObject(field_variables.default)) {
      returnObj.default = Object.assign({}, field_variables.default);
    }

    // Set default value
    if (docFields && docFields.hasOwnProperty(field_name)) {
      // if we have a document field value, use it
      returnObj.field_value = docFields[field_name];
    }
    // if this is an image or html type field, set the value to the prompt value if present
    else if (returnObj.prompt?.value && ['image', 'html'].includes(field_variables.value?.type || field_variables.default?.type)) {
      returnObj.field_value = returnObj.prompt?.value;
    }
    else if (returnObj.prompt?.occurrences && returnObj.prompt?.occurrences > 1) {
      returnObj.field_value = new Array(returnObj.prompt?.occurrences).fill(null);
    }
    else {
      const defaultValueObj = await getDefaultValueForField({ fieldRec: field_variables, fieldName: field_name });
      if (defaultValueObj.value !== undefined) {
        returnObj.field_value = defaultValueObj.value;
      }
      else {
        returnObj.field_value = null;
      }
    }

    // Set type
    returnObj.type = field_variables.value?.type || field_variables.default?.type || 'text';
    // If 'select' type and custom_selection is true, set type to 'select&text'
    if (returnObj.type === 'select' && field_variables.custom_selection) {
      returnObj.type = 'select&text';
    }
    else if (returnObj.type === 'yes/no') {
      returnObj.type = 'select';
      returnObj.selectionObj = {
        selectionList: ['yes', 'no'],
        min: 1,
        max: 1
      };
    }
    else if (returnObj.type === 'family'
      && reactData.family_id) {
      let familyMembers = [];
      if (reactData.familyRec) {
        // Add primary contact
        familyMembers.push({
          id: reactData.familyRec.primary_contact.id,
          name: reactData.familyRec.primary_contact.name,
          nickname: reactData.familyRec.primary_contact.nickname
        });
        // Add other members
        if (reactData.familyRec.other_members && Array.isArray(reactData.familyRec.other_members)) {
          for (let member of reactData.familyRec.other_members) {
            familyMembers.push({
              id: member.id,
              name: member.name,
              nickname: member.nickname
            });
          }
        }
      }

      returnObj.familyMembers = familyMembers;
      updateReactData({
        familyRec: reactData.familyRec,
        family_id: reactData.family_id || false,
      }, false);
    }

    // Override computed defaults with preset values (if any)
    if (preset_values && preset_values[field_name]) {
      returnObj.og_default = formatValue({
        rawValue: returnObj.field_value,
        type: returnObj.type
      });
      returnObj.field_value = preset_values[field_name];
    }

    // format the default value for display
    returnObj.field_valueText = formatValue({
      rawValue: returnObj.field_value,
      type: returnObj.type
    });

    // Selection Obj should be set for the special case - type = select or type = select & text
    if (returnObj.type.startsWith('select') || returnObj.type.startsWith('drop')) {
      returnObj.selectionObj = Object.assign({},
        { min: 0, max: 999 },
        field_variables.value,
        field_variables.value?.selection
      );
    }

    // set options
    returnObj.options = {
      required: !!returnObj.value?.required || false,
      log_results: returnObj.value?.log_results || false,
      viewOnly: (returnObj.value?.edit === 'view'),
      hidden: (returnObj.value?.edit === 'hidden'),
      ifEmpty: field_variables.options ? field_variables.options.ifEmpty : null,
      resetFields: (returnObj.value?.resetFields
        || (field_variables.options ? field_variables.options.resetFields : null))
    };

    // gather show_if/ignore_if in response
    returnObj.show_if = field_variables.show_if || null;
    returnObj.ignore_if = field_variables.ignore_if || null;

    // set signature reference number if signature type
    if (returnObj.type === 'signature') {
      returnObj.options.sigRefNumber = field_variables.sigRefNumber;
    }

    // set saveAs
    if (!isEmpty(field_variables.value?.saveAs)) {
      let wip_saveAs = makeArray(field_variables.value?.saveAs, ".");
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
      returnObj.saveAs = wip_saveAs;
    }
    else {
      returnObj.saveAs = false;
    }

    // set logAs
    if (!isEmpty(field_variables.value?.log_results)) {
      returnObj.logAs = field_variables.value?.log_results.path;
    }
    else {
      returnObj.logAs = false;
    }

    // finish initializations
    returnObj.isError = false;

    formRec.fields[field_name] = Object.assign({}, returnObj);
    response.fields[field_name] = Object.assign({}, returnObj);

    return returnObj;
  };

  const initializeFromFormDefinition = async ({ form_id, docFields = {} }) => {
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
        sections: [],
        form_stages: [{
          stage_name: 'default'
        }],
      };
    }

    // Ensure stages array is properly set up
    if (!formRec.stages || !Array.isArray(formRec.stages) || (formRec.stages.length === 0) || formRec.stages[0].stage_name !== 'default') {
      formRec.stages = [{ stage_name: 'default' }];
    };
    for (const this_section of formRec.sections) {
      if (!this_section.belongs_to_stage) {
        this_section.belongs_to_stage = 'default';
      }
      if (formRec.stages.findIndex(stage => stage.stage_name === this_section.belongs_to_stage) === -1) {
        formRec.stages.push({
          stage_name: this_section.belongs_to_stage
        });
      }
    }
    formRec.stages.push({ stage_name: 'complete' });
    // We have a person - do they have a familyRec?  If so, go ahead and get it
    updateReactData({
      peopleRec: reactData.peopleRec || {},
      formRec
    }, false);
    let response = {
      fields: {},
      sections: formRec.sections,
      formStages: formRec.stages,
      document_title: `${formRec.form_name}`,
      formRec
    };

    // update all section and field names with resolved variables
    for (let this_section of response.sections) {
      this_section.section_name = await resolveVariables(this_section.section_name);
      for (let [index, fieldEntry] of this_section.fields.entries()) {

        // fieldEntry is either a string - in which case it is the field_name and the field_key
        // or it is an object - in which case it will name the field_name and may name the field_key
        let field_name = this_section.section_name + '_field_' + index;
        let field_key = field_name;
        if (isObject(fieldEntry)) {
          if (fieldEntry.field_name) {
            field_name = fieldEntry.field_name || fieldEntry.field_key;
          }
          if (fieldEntry.field_key) {
            field_key = fieldEntry.field_key;
          } else {
            field_key = fieldEntry.form_field || fieldEntry.field_id || fieldEntry.field_name || field_name;
          }
        } else {
          field_name = fieldEntry;
          field_key = fieldEntry;
        }

        formRec.fields[field_name] = await processFieldForSectionField({
          field_name,
          field_key,
          fieldEntry,
          docFields,
          index,
          section: this_section,
          formRec,
          response
        });

        reactData.fields[field_name] = Object.assign({}, formRec.fields[field_name],
          {
            value: formRec.fields[field_name].field_value,
            valueText: formRec.fields[field_name].field_valueText
          }
        );
      };
    };

    updateReactData({
      formRec,
      fields: reactData.fields,
      formStages: response.formStages
    }, false);

    return response;

  };

  const initializeFromDoc = async ({ form_id, pertains_to, documentRec = {} }) => {

    let pertains_to_name;
    if (!pertains_to) {
      pertains_to = state.session.patient_id;
    }
    if (!reactData.peopleRec || !reactData.peopleRec[pertains_to]) {
      let gotPerson = await getDb({
        Key: {
          person_id: pertains_to
        },
        TableName: "People"
      });
      let familyRec = null;
      if (gotPerson.family_groups && Array.isArray(gotPerson.family_groups) && gotPerson.family_groups.length > 0) {
        familyRec = await getDb({
          Key: {
            client_id: state.session.client_id,
            composite_key: gotPerson.family_groups[0]
          },
          TableName: "FamilyGroups"
        })
      }
      updateReactData({
        familyRec: familyRec || null,
        family_id: gotPerson.family_groups ? gotPerson.family_groups[0] : (gotPerson.family_id || false),
        peopleRec: Object.assign({}, reactData.peopleRec || {}, { [pertains_to]: gotPerson })
      }, false);
    }

    const { formRec } = await initializeFromFormDefinition({ form_id, docFields: documentRec.field_values || {} });

    if (request.overrideFormRec && isObject(request.overrideFormRec)) {
      Object.assign({}, formRec, request.overrideFormRec);
    }
    updateReactData({
      formRec
    }, false);

    if (reactData.clientSampleMode) {
      pertains_to_name = state.session.client_name;
    }
    else {
      pertains_to_name = (`${reactData.peopleRec[pertains_to]?.name?.first} ${reactData.peopleRec[pertains_to]?.name?.last}` || state.session.client_name).trim();
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
      sections: [],
      document_title: reactData.document_title || tempTitle
    };
    for (let this_section of formRec.sections) {
      if (this_section.occurrences && !isNaN(this_section.occurrences)) {
        for (let section_number = 1; section_number <= this_section.occurrences; section_number++) {
          let sectionIndex = response.sections.push(deepCopy(this_section)) - 1;
          response.sections[sectionIndex].section_name = this_section.section_name.replace('1', section_number);
          for (let [field_index, this_field] of this_section.fields.entries()) {
            response.sections[sectionIndex].fields[field_index].field_name = this_field.field_name.replace('1', section_number);
            response.sections[sectionIndex].fields[field_index].default_source = this_field.default_source
              ? (this_field.default_source.replace('1', section_number))
              : null;
            response.sections[sectionIndex].fields[field_index].saveAs = this_field.saveAs
              ? (this_field.saveAs.replace('1', section_number))
              : null;
          }
        }
      }
      else {
        response.sections.push(this_section);
      }
    }

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

  const formatValue = ({ rawValue, type }) => {
    let source = makeArray(rawValue);
    let response = [];
    for (let [index, this_value] of source.entries()) {
      switch (type) {
        case 'phone': {
          // return formatPhone(rawValue);
          response[index] = formatPhone(this_value);
          break;
        }
        case 'date_select':
        case 'date': {
          // return makeDate(rawValue, { noTime: true, noYearCorrection: true }).absolute;
          response[index] = makeDate(this_value, { noTime: true, noYearCorrection: true }).absolute;
          break;
        }
        case 'time': {
          // return makeDate(rawValue, { noTime: true, noYearCorrection: true }).timeOnly;
          response[index] = makeTime(this_value).time;
          break;
        }
        case 'id': {
          if (reactData.peopleRec[rawValue]) {
            // return reactData.peopleRec[rawValue].display_name
            //  || (`${reactData.peopleRec[rawValue]?.name.first} ${reactData.peopleRec[rawValue]?.name.last}`).trim();
            response[index] = reactData.peopleRec[this_value].display_name
              || (`${reactData.peopleRec[this_value]?.name.first} ${reactData.peopleRec[this_value]?.name.last}`).trim();
            break;
          }
          else {
            // return await makeName(rawValue);
            response[index] = this_value;
            makeName(this_value)
              .then((gotName) => {
                response[index] = gotName;
              });
            break;
          }
        }
        default: {
          // return rawValue;
          response[index] = this_value;
        }
      }
    }
    if (source.length === 1) {
      return response[0];
    }
    else {
      return response;
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

  const handleChangeValue = async ({ newText, newValue, newList, prop, occ_index, sentenceCase, reactUpdObj }) => {
    if (sentenceCase && newText && (newText.length === 1)) {
      newText = newText.toUpperCase();
    }
    if (reactData.fields[prop].prompt?.occurrences && (reactData.fields[prop].prompt?.occurrences > 1)) {
      reactData.fields[prop].value[occ_index] = newValue || newList || newText;
    }
    else {
      reactData.fields[prop].value = newValue || newList || newText;
    }
    reactData.fields[prop].valueText = formatValue({
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
        reactData.fields[this_resetter].valueText = formatValue({
          rawValue: reactData.fields[this_resetter].value,
          type: reactData.fields[this_resetter].type
        });
      }
    }
    // Delay forced re-render to prevent race condition with checkbox clicks
    setTimeout(() => {
      updateReactData(Object.assign({}, (reactUpdObj || {}), {
        formUpdates: ++reactData.formUpdates,
        fields: reactData.fields
      }), true);
    }, 0);
  };

  const handleMakeSelection = async (props) => {
    if (isEmpty(reactData.fields[props.prop].value)) {
      reactData.fields[props.prop].value = props.singleValue ? props.clickText : [props.clickText];
    }
    else if (props.singleValue) {
      reactData.fields[props.prop].value = props.clickText;
    }
    else {
      if (!Array.isArray(reactData.fields[props.prop].value)) {
        reactData.fields[props.prop].value = [reactData.fields[props.prop].value];
      }
      let foundAt = reactData.fields[props.prop].value.indexOf(props.clickText);
      if (foundAt < 0) {
        reactData.fields[props.prop].value.push(props.clickText);
        const max = reactData.fields[props.prop].selectionObj?.max || 99;
        if (max < reactData.fields[props.prop].value.length) {
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
        reactData.fields[this_resetter].valueText = formatValue({
          rawValue: reactData.fields[this_resetter].value,
          type: reactData.fields[this_resetter].type
        });
      }
    }
    updateReactData({
      formUpdates: ++reactData.formUpdates,
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
          let [, ...reconcile_key] = extracted_field.split('.');
          let table_value = resolve({
            object: reactData.peopleRec[reactData.pertains_to],
            key: reconcile_key
          });
          if (table_value) {
            response = response.replace(variable, `${[table_value].flat()[0]}`);
          }
          else if (reactData.fields[extracted_field] && reactData.fields[extracted_field].valueText) {
            let vValue = reactData.fields[extracted_field].valueText;
            vValue = listFromArray(formatValue({
              rawValue: reactData.fields[extracted_field].value,
              type: reactData.fields[extracted_field].type
            }));
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
    if (!response.endsWith(')') && reactData.fields[this_field] && reactData.fields[this_field].prompt?.show_log && reactData.fields[this_field].logAs) {
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

  const processFieldForDisplay = async (fieldName) => {
    // Process a field before displaying it in the form
    // May modify field properties or set skip flag
    // - Validate field visibility based on other fields
    // - Introduce or modify field values
    // - Set field.ignore = true to skip field display
    // - Add dynamic defaults based on reactData state

    if (!reactData.fields[fieldName] || reactData.fields[fieldName].options?.hidden) {
      reactData.fields[fieldName].ignore = true;
      return;
    }

    // Resolve default value if not already set
    if (!reactData.fields[fieldName].value && reactData.formRec.fields[fieldName]) {
      const defaultResult = await getDefaultValueForField({
        fieldRec: reactData.formRec.fields[fieldName],
        fieldName
      });
      if (defaultResult.value !== undefined) {
        reactData.fields[fieldName].value = defaultResult.value;
        reactData.fields[fieldName].valueText = formatValue({
          rawValue: reactData.fields[fieldName].value,
          type: reactData.fields[fieldName].type
        });
      }
    }

    reactData.fields[fieldName].ignore = checkIgnore({
      ignoreObj: reactData.fields[fieldName]?.ignore_if || reactData.fields[fieldName]?.prompt?.ignore_if,
      showObj: reactData.fields[fieldName]?.show_if
    });

    return;
  };

  // **************************

  const AVADropDown = (props) => {
    // props should contain
    //   prop
    //   prompt
    //   text - an array of options, each can independently go true or false
    let optionList = props.text.sort().map(this_option => {
      if (isObject(this_option)) {
        return this_option;
      }
      else {
        return ({
          value: this_option,
          label: this_option
        });
      }
    });
    const promptHTML = reconcilePrompt({
      rawValue: reactData.fields[props.prop].prompt?.value,
      this_field: props.prop
    });
    return (
      <Box
        key={'topBox'} flexGrow={1}
        display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'
      >
        <Typography className={classes.formControlTitle} dangerouslySetInnerHTML={{ __html: promptHTML }} />
        <React.Fragment>
          <Box
            key={`selectBox_filterdrop`}
            display='flex' flexGrow={1} flexDirection='column'
            pt={1} pb={1} marginLeft={'8px'} width={'60%'}
          >
            <React.Fragment>
              <Select
                options={optionList}
                searchBy={'label'}
                style={{
                  fontSize: '0.8rem',
                  marginLeft: -5,
                  marginBottom: -4,
                  marginTop: 1,
                  borderWidth: 3
                }}
                dropdownHandle={true}
                variant={'standard'}
                dropdownPosition={'auto'}
                values={(reactData.fields[props.prop]?.value && reactData.fields[props.prop]?.value.length > 0)
                  ? (() => {
                    let currentValue = Array.isArray(reactData.fields[props.prop]?.value) ? reactData.fields[props.prop]?.value[0] : reactData.fields[props.prop]?.value || '';
                    if (currentValue) {
                      return optionList.filter(option => option.value === currentValue);
                    }
                    return [{ label: 'English', value: 'en' }];
                  })()
                  : [{ label: 'English', value: 'en' }]
                }
                clearable={true}
                clearOnSelect={false}
                placeholder={'Please select your preferred language'}
                clearOnBlur={false}
                key={`selectBox_selectdrop`}
                searchable={true}
                multi={(reactData.fields[props.prop]?.selectionObj?.max > 1) || false}
                closeOnClickInput={(reactData.fields[props.prop]?.selectionObj?.max > 1) || false}
                closeOnSelect={(reactData.fields[props.prop]?.selectionObj?.max > 1) || false}
                create={true}
                keepSelectedInList={true}
                noDataLabel={''}
                onInputChange={async (values) => {
                  await handleMakeSelection({
                    clickText: values[0].value,
                    prop: props.prop,
                    singleValue: (reactData.fields[props.prop]?.selectionObj?.max > 1) ? false : true
                  });
                }}
                onChange={async (values) => {
                  await handleMakeSelection({
                    clickText: values[0].value,
                    prop: props.prop,
                    singleValue: (reactData.fields[props.prop]?.selectionObj?.max > 1) ? false : true
                  });
                }}
              />
            </React.Fragment>
          </Box>
        </React.Fragment>
      </Box>
    );
  };

  const AVACheckBoxGroup = (props) => {
    // props should contain
    //   prop
    //   text - an array of options, each can independently go true or false
    const promptHTML = reconcilePrompt({
      rawValue: reactData.fields[props.prop].prompt?.value,
      this_field: props.prop
    });
    return (
      <Box flexDirection='column' key={`Box__${props.prop}`} className={classes.formControlCheckGroup}>
        <Typography className={classes.formControlTitle} dangerouslySetInnerHTML={{ __html: promptHTML }} />
        <Box
          display='flex'
          flexDirection={props.column ? 'column' : 'row'}
          alignItems='flex-start'
          flexWrap={props.column ? 'nowrap' : 'wrap'}
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
                    disabled={reactData.fields[props.prop].options.viewOnly || reactData.viewOnlyMode}
                    checked={reactData.fields[props.prop].value && reactData.fields[props.prop].value.includes(text)}
                    onMouseDown={async () => {
                      await handleMakeSelection({
                        clickText: text,
                        prop: props.prop,
                        singleValue: (reactData.fields[props.prop]?.selectionObj?.max > 1) ? false : true
                      });
                    }}
                    disableRipple
                    inputProps={{ 'aria-labelledby': `message_routing_3` }}
                  />
                }
                label={<Typography className={classes.radioDays} style={{ whiteSpace: 'nowrap' }}>{text}</Typography>}
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
                    disabled={reactData.fields[props.prop].options.viewOnly || reactData.viewOnlyMode}
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
                      // Delay re-render to allow checkbox clicks to complete first
                      setTimeout(() => {
                        updateReactData({
                          formUpdates: reactData.formUpdates++,
                          fields: reactData.fields
                        }, true);
                      }, 0);
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

  const AVAFamilyCheckBoxGroup = (props) => {
    // props should contain:
    //   prop - field name
    //   familyMembers - array of family member objects with { id, name, nickname }
    const promptHTML = reconcilePrompt({
      rawValue: reactData.fields[props.prop].prompt?.value,
      this_field: props.prop
    });
    return (
      <Box flexDirection='column' key={`Box__${props.prop}`} className={classes.formControlCheckGroup}>
        <Typography className={classes.formControlTitle} dangerouslySetInnerHTML={{ __html: promptHTML }} />
        <Box
          display='flex'
          flexDirection='column'
          alignItems='flex-start'
          flexWrap='nowrap'
          key={`CheckGroup__${props.prop}`}
        >
          <React.Fragment key={`groupFrag__${props.prop}`}>
            {(props.familyMembers && props.familyMembers.length > 0) ?
              props.familyMembers.map((member, tIndex) => (
                <FormControlLabel
                  className={classes.formControlDays}
                  style={{ marginLeft: '16px' }}
                  key={`${props.prop}_${tIndex}`}
                  control={
                    <Checkbox
                      aria-label={`${props.prop}_${tIndex}`}
                      name={`${props.prop}_${tIndex}`}
                      key={`FamilyCheckGroup__${props.prop}_${tIndex}`}
                      size='small'
                      checked={reactData.fields[props.prop].value && reactData.fields[props.prop].value.includes(member.id)}
                      onClick={async () => {
                        await handleMakeSelection({
                          clickText: member.id,
                          prop: props.prop
                        });
                      }}
                      disableRipple
                      inputProps={{ 'aria-labelledby': `family_member_${tIndex}` }}
                    />
                  }
                  label={<Typography className={classes.radioDays} style={{ whiteSpace: 'nowrap' }}>{`${member.name}${member.nickname ? (' (' + member.nickname + ')') : ''}`}</Typography>}
                  labelPlacement='end'
                />
              ))
              :
              <Typography style={AVATextStyle({ size: 0.8, margin: { left: 1 } })}>
                No family members found
              </Typography>
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
    let errors_on_Form = 0;
    let form_stageStatus = {};
    for (const sectionObj of reactData.sections) {
      let stage_name = sectionObj.belongs_to_stage || 'default';
      if (!form_stageStatus.hasOwnProperty(stage_name)) {
        form_stageStatus[stage_name] = {
          errors_in_stage: 0,
        };
      }
      if (okToShowSection(sectionObj)) {
        for (const this_field of sectionObj.fields) {
          if (reactData.fields[this_field].ignore) {
            continue;
          }
          reactData.fields[this_field].isError = false;
          if (reactData.fields[this_field]?.options?.ifEmpty && isEmpty(reactData.fields[this_field].value)) {
            // if there is a specific rule regarding empty value, apply it now
            reactData.fields[this_field].value = reconcilePrompt({
              rawValue: reactData.fields[this_field].options.ifEmpty,
              this_field
            });
          }
          if (reactData.fields[this_field]?.options?.required || reactData.fields[this_field]?.value?.required) {
            // this is a required field
            const signature_ok = (reactData.fields[this_field].type === 'signature')
              ? (signatureRef[reactData.fields[this_field].options.sigRefNumber].current
                && (!signatureRef[reactData.fields[this_field].options.sigRefNumber].current.isEmpty()))
              : null;
            if (!signature_ok ?? isEmpty(reactData.fields[this_field].value)) {
              reactData.fields[this_field].errorMessage = `${reconcilePrompt({
                rawValue: reactData.fields[this_field].prompt?.value,
                this_field
              })} is required`;
              reactData.fields[this_field].isError = true;
              messageList.push(reactData.fields[this_field].errorMessage);
              errors_on_Form++;
              form_stageStatus[stage_name].errors_in_stage++;
            }
          }
          else if (reactData.fields[this_field].type.startsWith('select')) {
            let numberOfSelections = [reactData.fields[this_field].value ?? []].flat().length;
            if (numberOfSelections < (reactData.fields[this_field].selectionObj.min ?? 0)
            ) {
              const prompt_part = reconcilePrompt({
                rawValue: reactData.fields[this_field].prompt?.value,
                this_field
              });
              reactData.fields[this_field].errorMessage = numberOfSelections === 0
                ? `Please make a selection for ${prompt_part}`
                : `You must make at least ${reactData.fields[this_field].selectionObj.min} selections for ${prompt_part}`;
              reactData.fields[this_field].isError = true;
              messageList.push(reactData.fields[this_field].errorMessage);
              errors_on_Form++;
              form_stageStatus[stage_name].errors_in_stage++;
            }
          }
        }
      }
      else {
        form_stageStatus[stage_name].errors_in_stage++;
      }
    };

    let current_form_stage = null;
    for (const this_stage of reactData.formStages) {
      if (form_stageStatus.hasOwnProperty(this_stage.stage_name)) {
        if (form_stageStatus[this_stage.stage_name].errors_in_stage > 0) {
          // stop at the first stage that has errors
          current_form_stage = this_stage.stage_name;
          break;
        }
      }
    }
    if (!current_form_stage) {
      current_form_stage = 'complete';
    }

    if (!errors_on_Form) {
      if (current_form_stage !== 'complete') {
        messageList = ['Your part of this form looks good!', 'Tap below to continue.'];
      }
      else {
        messageList = ['This form is complete!', 'Tap "Complete" below to save it.'];
      }
    }

    updateReactData({
      messageList,
      errors_on_Form,
      fields: reactData.fields,
      stage: 'confirm',
      current_formStage: current_form_stage
    }, true);

  };

  const resolveValue = (object, key, value) => {
    const this_key = key.shift();
    if (key.length === 0) {
      if (isEmpty(object)) {
        return { [this_key]: value };
      }
      else {
        object[this_key] = value;
        return object;
      }
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
      // generateHtmlOutput();

      /* Temporarily disabled PDF generation
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
      */
    }

    // printing is done (or wasn't necessary)
    // save_type is one of 'final', 'in_process', 'on_timeout', 'printed'
    let docData = {
      client_id: state.session.client_id,
      document_id,
      title: reactData.document_title,
      pertains_to: reactData.pertains_to,
      status: final ? (pending ? 'pending' : 'complete') : 'in_process',   // need to set pending when appropriate
      form_type: reactData.form_id,
      client_id_form_type: `${state.session.client_id}%%${reactData.form_id}`,
      field_values,
      options: reactData.formRec.options
    };
    if (reactData.docRec?.history) {
      docData.history = reactData.docRec?.history;
    }
    docData.form_stage = reactData.current_formStage;
    const recWritten = await updateDocument({
      docData,
      author: state.session.patient_id,
      isNew: false,
      pending,
      save_type: final ? 'save_final' : (timeout ? 'on_timeout' : 'in_process'),
      url
    });
    response.location = url;
    response.document_status = docData.status;
    response.status = docData.status;
    response.document_id = docData.document_id;

    if (reactData.previous_formStage !== reactData.current_formStage) {
      // log stage change
      cl(`Form ${document_id} stage changed from ${reactData.previous_formStage} to ${reactData.current_formStage}`);

      // we may be manipulating thie groups list of the person in the pertains_to account, so we need to get that first
      let groupList = reactData.peopleRec[reactData.pertains_to].groups || [];

      // check stage exit
      let previous_stageIndex = reactData.formRec.stages.findIndex(s => s.stage_name === reactData.previous_formStage);
      if (previous_stageIndex >= 0) {
        // send message on stage exit /  complete     
        let messageInstructions_onStageExit = reactData.formRec.stages[previous_stageIndex].on_complete_message;
        if (messageInstructions_onStageExit) {
          // send stage complete message
          /*
          {
            template_id: <template_id>,
            text: 'Form has not been started yet',
            recipientList: {
              people: [<user_id>, <user_id>, ...],
              groups: [<group_id>, <group_id>, ...]
           }
          */
          let final_messageText = '';
          let final_html = '';
          if (messageInstructions_onStageExit.template_id) {
            let templateRec = await getDb({
              Key: {
                client_id: state.session.client_id,
                template_id: messageInstructions_onStageExit.template_id
              },
              TableName: 'MessageTemplates'
            });
            if (templateRec) {
              final_messageText = await resolveVariables(templateRec.message_text);
              final_html = templateRec.html_text ? await resolveVariables(templateRec.html_text) : final_messageText;
            }
          }
          else if (messageInstructions_onStageExit.text) {
            final_messageText = await deepResolve(messageInstructions_onStageExit.text, reactData.peopleRec[reactData.pertains_to]);
            final_html = final_messageText;
          }
          let recipientList = [];
          if (messageInstructions_onStageExit.recipientList) {
            if (messageInstructions_onStageExit.recipientList.people) {
              recipientList = recipientList.concat(messageInstructions_onStageExit.recipientList.people);
            }
            if (messageInstructions_onStageExit.recipientList.groups) {
              for (const this_group of messageInstructions_onStageExit.recipientList.groups) {
                recipientList.push(`GRP//${this_group}`);
              }
            }
          }
          let jumpTo = window.location.origin;
          final_html = final_messageText + `<br><br>The document is available <a href=${jumpTo}?document=${reactData.document_id}>here</a>`;
          final_messageText += `\r\n\nThe document is available at: ${jumpTo}?document=${reactData.document_id}`;
          await sendMessages({
            client: state.session.client_id,
            author: state.session.user_id,
            person_id: state.session.patient_id,
            messageText: final_messageText,
            htmlText: final_html,
            recipientList: recipientList,
            attachments: `${jumpTo}?document=${reactData.document_id}`,
            subject: messageInstructions_onStageExit.subject
              ? await resolveVariables(messageInstructions_onStageExit.subject)
              : `A message from ${reactData.peopleRec[reactData.pertains_to].display_name || 'AVA Document Management'}`
          });
        }
        // remove and add groups from pertains_to account's group list if any
        let groupInstructions_onStageExit = reactData.formRec.stages[previous_stageIndex].on_complete_groups;
        if (groupInstructions_onStageExit) {
          if (groupInstructions_onStageExit.remove) {
            // if i am removing a group that's a parent, you are also removing that group's children. So we need to check for that and remove those as well
            const allGroupstoRemove = getAllChildrenOfGroups(groupInstructions_onStageExit.remove, reactData.groupsRec);
            groupList = groupList.filter(g => !allGroupstoRemove.includes(g));
          }
          if (groupInstructions_onStageExit.add) {
            // if i am adding a group that's a child, you are also adding that group's parents. So we need to check for that and add those as well
            const allGroupstoAdd = getAllParentsOfGroups(groupInstructions_onStageExit.add, reactData.groupsRec);
            for (const this_group of allGroupstoAdd) {
              if (!groupList.includes(this_group)) {
                groupList.push(this_group);
              }
            }
          }
          reactData.peopleRec[reactData.pertains_to].groups = groupList;
        }
      }

      //check stage entry
      let this_stageIndex = reactData.formRec.stages.findIndex(s => s.stage_name === reactData.current_formStage);
      if (this_stageIndex >= 0) {
        // send message on stage entry
        let messageInstructions_onStageEntry = reactData.formRec.stages[this_stageIndex].on_entry_message;
        if (messageInstructions_onStageEntry) {
          // send stage complete message
          /*
          {
            template_id: <template_id>,
            text: 'Form has not been started yet',
            recipientList: {
              people: [<user_id>, <user_id>, ...],
              groups: [<group_id>, <group_id>, ...]
           }
          */
          let final_messageText = '';
          let final_html = '';
          if (messageInstructions_onStageEntry.template_id) {
            let templateRec = await getDb({
              Key: {
                client_id: state.session.client_id,
                template_id: messageInstructions_onStageEntry.template_id
              },
              TableName: 'MessageTemplates'
            });
            if (templateRec) {
              final_messageText = await resolveVariables(templateRec.message_text);
              final_html = templateRec.html_text ? await resolveVariables(templateRec.html_text) : final_messageText;
            }
          }
          else if (messageInstructions_onStageEntry.text) {
            final_messageText = await deepResolve(messageInstructions_onStageEntry.text, reactData.peopleRec[reactData.pertains_to]);
            final_html = final_messageText;
          }
          let recipientList = [];
          if (messageInstructions_onStageEntry.recipientList) {
            if (messageInstructions_onStageEntry.recipientList.people) {
              recipientList = recipientList.concat(messageInstructions_onStageEntry.recipientList.people);
            }
            if (messageInstructions_onStageEntry.recipientList.groups) {
              for (const this_group of messageInstructions_onStageEntry.recipientList.groups) {
                recipientList.push(`GRP//${this_group}`);
              }
            }
          }
          let jumpTo = window.location.origin;
          final_html = final_messageText + `<br><br>The document is available <a href=${jumpTo}?document=${reactData.document_id}>here</a>`;
          final_messageText += `\r\n\nThe document is available at: ${jumpTo}?document=${reactData.document_id}`;
          await sendMessages({
            client: state.session.client_id,
            author: state.session.user_id,
            person_id: state.session.patient_id,
            messageText: final_messageText,
            htmlText: final_html,
            recipientList: recipientList,
            attachments: `${jumpTo}?document=${reactData.document_id}`,
            subject: messageInstructions_onStageEntry.subject
              ? await resolveVariables(messageInstructions_onStageEntry.subject)
              : `A message from ${reactData.peopleRec[reactData.pertains_to].display_name || 'AVA Document Management'}`
          });
        }
        // remove and add groups from pertains_to account's group list if any
        let groupInstructions_onStageEntry = reactData.formRec.stages[previous_stageIndex].on_complete_groups;
        if (groupInstructions_onStageEntry) {
          if (groupInstructions_onStageEntry.remove) {
            // if i am removing a group that's a parent, you are also removing that group's children. So we need to check for that and remove those as well
            const allGroupstoRemove = getAllChildrenOfGroups(groupInstructions_onStageEntry.remove, reactData.groupsRec);
            groupList = groupList.filter(g => !allGroupstoRemove.includes(g));
          }
          if (groupInstructions_onStageEntry.add) {
            // if i am adding a group that's a child, you are also adding that group's parents. So we need to check for that and add those as well
            const allGroupstoAdd = getAllParentsOfGroups(groupInstructions_onStageEntry.add, reactData.groupsRec);
            for (const this_group of allGroupstoAdd) {
              if (!groupList.includes(this_group)) {
                groupList.push(this_group);
              }
            }
          }
          reactData.peopleRec[reactData.pertains_to].groups = groupList;
        }

      }

      let UpdateExpression = 'set #g = :g, #c = :c';
      let ExpressionAttributeValues = {
        ':g': groupList,
        ':c': {
          id: state.session.client_id,
          groups: groupList
        }
      };
      let ExpressionAttributeNames = {
        '#g': 'groups',
        '#c': 'clients'
      };
      await dbClient
        .update({
          Key: {
            person_id: reactData.pertains_to
          },
          UpdateExpression,
          ExpressionAttributeValues,
          ExpressionAttributeNames,
          TableName: "People",
        })
        .promise()
        .catch(error => {
          console.log(`caught error updating Group; error is: `, error);
        });

    }

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

    // Send messages as part of creating a new form (optional)
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
          v = formatValue({
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
            v = formatValue({
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
            v = formatValue({
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
          docRec.Item.form_stage = 'complete';
        };
        const { sections, document_title } = await initializeFromDoc({
          form_id: docRec.Item.form_type,
          pertains_to: docRec.Item.pertains_to,
          preset_values: docRec.Item.field_values,
          documentRec: docRec.Item
        });
        await processAllFieldsForDisplay();
        let setviewOnlyMode = false;
        if (!options.hasOwnProperty('open_complete') || options.open_complete === false) {
          setviewOnlyMode = (docRec.Item.form_stage === 'complete');
        }
        updateReactData({
          previous_formStage: docRec.Item.form_stage || 'default',
          viewOnlyMode: setviewOnlyMode,
          document_title: docRec.Item.title || document_title,
          pertains_to: docRec.Item.pertains_to,
          form_id: docRec.Item.form_type,
          sections,
          docRec: docRec.Item,
          formRec: Object.assign({}, reactData.formRec, { options: docRec.Item.options }),
          stage: 'fill'
        }, true);
        return;
      }
    }
    // if we got here, there was no existing document found with the passed in document_id
    // or no document_id was passed in at all. 
    // we couldn't find an appropriate document to continue with, so we'll start a new one
    const { sections, document_title } = await initializeFromDoc({
      form_id: reactData.form_id,
      pertains_to: reactData.pertains_to
    });
    await processAllFieldsForDisplay();
    let nowTime = new Date().getTime();
    updateReactData({
      document_id: `${reactData.pertains_to}_${reactData.form_id}_${nowTime}`,
      pertains_to: reactData.pertains_to,
      form_id: reactData.form_id,
      document_title,
      sections,
      stage: 'fill'
    }, true);
    return;
  }

  const okToShowSection = (this_sectionObj) => {
    if (this_sectionObj.hasOwnProperty('show_if')) {
      return (this_sectionObj.show_if.some(this_test => {
        if (this_test.hasOwnProperty('pertainsTo_memberOf')) {
          return reactData.peopleRec[reactData.pertains_to].groups.some(g => {
            return [this_test.memberOf].flat().includes(g);
          });
        }
        else if (this_test.hasOwnProperty('memberOf')) {
          return state.patient.groups.some(g => {
            return [this_test.memberOf].flat().includes(g);
          });
        }
        else {
          const this_value = reactData.fields?.[this_test.field]?.value;
          return (array_in_array(this_test.values, this_value));
        }
      }));
    }
    else {
      return true;
    }
  };

  // **************************
  // Helper function to process all fields for display
  const processAllFieldsForDisplay = async () => {
    if (!reactData.fields || Object.keys(reactData.fields).length === 0) {
      return;
    }

    for (const fieldName in reactData.fields) {
      await processFieldForDisplay(fieldName);
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
        const { fields, sections, document_title } = await initializeFromFormDefinition({ form_id: reactData.form_id });
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
    return (() => {
    });
  }, [reactData.form_id, reactData.document_id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // **************************
  // Process all fields for display after each render to update all field properties
  React.useEffect(() => {
    async function processAllFields() {
      if (reactData.stage !== 'fill' || !reactData.fields || Object.keys(reactData.fields).length === 0) {
        return;
      }

      for (const fieldName in reactData.fields) {
        await processFieldForDisplay(fieldName);
      }

      // Always update state after processing
      updateReactData({
        fields: reactData.fields
      }, true);
    }

    processAllFields();
  }, [reactData.formUpdates, reactData.fields, reactData.formRec, reactData.sessionRec, reactData.peopleRec]);  // eslint-disable-line react-hooks/exhaustive-deps

  // **************************

  return (
    <div ref={formContainerRef} id="content-to-export" className="my-form-container">
      <Dialog
        open={(forceRedisplay && (reactData.version > 0)) || true}
        key={`wholeScreen__`}
        onClose={handleAbort}
        classes={{ paper: classes.clientBackground }}
        maxWidth={false}
        PaperProps={{
          style: {
            minWidth: '80vw',
            maxWidth: '80vw'
          }
        }}
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
                (okToShowSection(sectionObj) &&
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
                    {sectionObj.fields.map((this_field, fieldNdx) => {
                      return (
                        !reactData.fields[this_field].ignore &&
                        <Box
                          key={`fieldFrag__${this_field}_${sectionNdx}`}
                          sx={{
                            border: reactData.fields[this_field].isError ? '2px solid red' : 'none',
                            padding: reactData.fields[this_field].isError ? '8px' : '0px',
                            borderRadius: reactData.fields[this_field].isError ? '30px' : '0px'
                          }}
                        >
                          {new Array(reactData.fields[this_field].prompt?.occurrences || 1).fill(0).map((a_zero, occ_index) => (
                            <React.Fragment
                              key={`innerFrag__${this_field}_${occ_index}`}
                            >
                              {reactData.fields[this_field].prompt?.newLine && (occ_index === 0) &&
                                <Typography
                                  key={`section__${sectionObj.section_name}_${reactData.fields[this_field]}-breakRow`}
                                  className={classes.breakRow}
                                >
                                  {''}
                                </Typography>
                              }
                              {(reactData.fields[this_field].type === 'text') &&
                                <Box flexDirection='column' key={`Box__${this_field}`} className={classes.formControlCheckGroup}>
                                  {occ_index === 0 && (
                                    <Typography
                                      className={classes.formControlTitle}
                                      dangerouslySetInnerHTML={{
                                        __html: reconcilePrompt({
                                          rawValue: reactData.fields[this_field].prompt?.value,
                                          this_field
                                        })
                                      }}
                                    />
                                  )}
                                  <TextField
                                    id={`field__${this_field}`}
                                    key={`field__${this_field}__${sectionNdx}_${(reactData.fields[this_field] && reactData.fields[this_field].valueText)
                                      ? reactData.fields[this_field].valueText
                                      : ''}`}
                                    className={classes.inputDisplay}
                                    multiline={(reactData.fields[this_field].prompt?.rows || reactData.fields[this_field].value?.rows || 1) > 1}
                                    variant={(reactData.fields[this_field].prompt?.rows || reactData.fields[this_field].value?.rows || 1) > 1 ? 'outlined' : 'standard'}
                                    disabled={reactData.fields[this_field].options.viewOnly || reactData.viewOnlyMode}
                                    InputProps={{ disableUnderline: reactData.fields[this_field].options.viewOnly || reactData.viewOnlyMode }}
                                    style={AVATextStyle({
                                      lineHeight: 1,
                                      width: `${reactData.fields[this_field].prompt?.width || 200}px`,
                                      maxWidth: '90%',
                                      size: 0.75,
                                      color: 'black',
                                      margin: { top: 0, bottom: 0.5, left: 0.5, right: 3 }
                                    })}
                                    autoComplete='off'
                                    defaultValue={(reactData.fields[this_field] && reactData.fields[this_field].valueText)
                                      ? (Array.isArray(reactData.fields[this_field].valueText) ? reactData.fields[this_field].valueText[occ_index] : reactData.fields[this_field].valueText)
                                      : ''
                                    }
                                    onBlur={async (event) => {
                                      await handleChangeValue({
                                        newText: event.target.value,
                                        prop: this_field,
                                        occ_index,
                                        sentenceCase: true
                                      });
                                    }}
                                  />
                                </Box>
                              }
                              {(reactData.fields[this_field].type === 'header') && (occ_index === 0) &&
                                <Typography
                                  style={AVATextStyle(Object.assign(
                                    {},
                                    {
                                      size: 0.75,
                                      margin: { top: 2, bottom: 0.5, right: 3 }
                                    },
                                    reactData.fields[this_field].prompt?.style || {}
                                  ))}
                                  dangerouslySetInnerHTML={{ __html: reactData.fields[this_field].prompt?.value }}
                                />
                              }
                              {(reactData.fields[this_field].type === 'image') &&
                                <Box
                                  className={classes.imageArea}
                                  component="img"
                                  alt={''}
                                  src={reactData.fields[this_field].valueText}
                                />
                              }
                              {(reactData.fields[this_field].type === 'upload') &&
                                <Box
                                  display='flex'
                                  mb={0}
                                  flexDirection='column'
                                  justifyContent='center'
                                  alignItems='flex-start'
                                  style={{
                                    paddingTop: '16px',
                                  }}
                                >
                                  <Box
                                    display='flex'
                                    mb={0}
                                    flexDirection='row'
                                    justifyContent='flex-start'
                                    alignItems='center'
                                  >
                                    <Typography
                                      style={{
                                        margin: 0,
                                        marginLeft: 0,
                                        marginRight: '2px',
                                        paddingBottom: 0,
                                        fontSize: 0.8,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginTop: 0,
                                        marginBottom: 0,
                                      }}
                                    >
                                      {reconcilePrompt({
                                        rawValue: reactData.fields[this_field].prompt?.value,
                                        this_field
                                      })}
                                    </Typography>
                                    {uploadIcon(this_field, occ_index)}
                                  </Box>
                                  <Box
                                    display='flex'
                                    mb={0}
                                    flexDirection='row'
                                    justifyContent='center'
                                    alignItems='center'
                                    padding={(makeArray(reactData.fields[this_field].valueText).length > 1) ? 1 : 0}
                                  >
                                    {makeArray(reactData.fields[this_field].valueText).map((this_image, imageNdx) => (
                                      <Box
                                        borderRadius={'20px'}
                                        border={1}
                                        marginRight={(makeArray(reactData.fields[this_field].valueText).length > 1) ? 1 : 0}
                                        key={`image_${sectionNdx}_${fieldNdx}_${imageNdx}`}
                                        onClick={() => {
                                          window.open(this_image, `${this_image.split('.').pop()} File`);
                                        }}
                                        style={{
                                          minWidth: '150px',
                                          maxWidth: '150px',
                                          minHeight: '150px',
                                          maxHeight: '150px',
                                        }}
                                        component="img"
                                        alt={`\nNo image available.  \nThis is a ${this_image.split('.').pop()} file.  \nTap to view`}
                                        src={this_image}
                                      />
                                    ))}
                                  </Box>
                                </Box>
                              }
                              {(reactData.fields[this_field].type === 'phone') &&
                                <TextField
                                  id={`field__${fieldNdx}`}
                                  className={classes.inputDisplay}
                                  autoComplete='off'
                                  disabled={reactData.fields[this_field].options.viewOnly || reactData.viewOnlyMode}
                                  InputProps={{ disableUnderline: reactData.fields[this_field].options.viewOnly || reactData.viewOnlyMode }}
                                  key={`field__${fieldNdx}__${sectionNdx}_${(reactData.fields[this_field] && reactData.fields[this_field].valueText)
                                    ? reactData.fields[this_field].valueText
                                    : ''}`}
                                  style={AVATextStyle({
                                    lineHeight: 1,
                                    width: `${reactData.fields[this_field].prompt?.width || 200}px`,
                                    size: 0.75,
                                    padding: { bottom: 0 },
                                    margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                                  })}
                                  defaultValue={(reactData.fields[this_field] && reactData.fields[this_field].valueText)
                                    ? (Array.isArray(reactData.fields[this_field].valueText) ? reactData.fields[this_field].valueText[occ_index] : reactData.fields[this_field].valueText)
                                    : ''
                                  }
                                  onBlur={async (event) => {
                                    if (event.target.value) {
                                      let fPhone = formatPhone(event.target.value);
                                      await handleChangeValue({
                                        newText: fPhone,
                                        newValue: `+1${fPhone.replace(/\D/g, '')}`,
                                        occ_index,
                                        prop: this_field,
                                        sentenceCase: false
                                      });
                                    }
                                  }}
                                  helperText={((occ_index > 0) ? null : reconcilePrompt({
                                    rawValue: reactData.fields[this_field].prompt?.value,
                                    this_field
                                  }))}
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
                                    min={reactData.fields[this_field].prompt?.min}
                                    max={reactData.fields[this_field].prompt?.max}
                                    value={(!isEmpty(reactData.fields[this_field]?.valueText))
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
                                            occ_index,
                                            prop: this_field,
                                            sentenceCase: false
                                          });
                                        }
                                      }
                                    }}
                                  />
                                  {reactData.fields[this_field].prompt?.newLine && (occ_index === 0) &&
                                    <Typography
                                      key={`section__${sectionObj.section_name}_${reactData.fields[this_field]}-breakRow`}
                                      className={classes.breakRow}
                                      style={AVATextStyle({
                                        lineHeight: 1,
                                        width: `${reactData.fields[this_field].prompt?.width || 200}px`,
                                        maxWidth: '90%',
                                        size: 0.75,
                                        opacity: '60%',
                                        margin: { top: 0.25, bottom: 0.5, left: 0, right: 3 }
                                      })}
                                    >
                                      {reconcilePrompt({
                                        rawValue: reactData.fields[this_field].prompt?.value,
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
                                  disabled={reactData.fields[this_field].options.viewOnly || reactData.viewOnlyMode}
                                  InputProps={{ disableUnderline: reactData.fields[this_field].options.viewOnly || reactData.viewOnlyMode }}
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
                                    ? (Array.isArray(reactData.fields[this_field].valueText) ? reactData.fields[this_field].valueText[occ_index] : reactData.fields[this_field].valueText)
                                    : ''
                                  }
                                  onBlur={async (event) => {
                                    if (event.target.value) {
                                      if (reactData.fields[this_field].type === 'time') {
                                        let dObj = makeTime(event.target.value);
                                        if (!dObj.error) {
                                          await handleChangeValue({
                                            newText: dObj.time,
                                            newValue: dObj.time,
                                            prop: this_field,
                                            occ_index,
                                            sentenceCase: false
                                          });
                                        }
                                      }
                                      else {
                                        let dObj = makeDate(event.target.value, { noTime: (reactData.fields[this_field].type === 'date'), noYearCorrection: true });
                                        if (!dObj.error) {
                                          await handleChangeValue({
                                            newText: dObj.absolute,
                                            newValue: ((reactData.fields[this_field].type === 'date')
                                              ? dObj.numeric$
                                              : dObj.timestamp),
                                            prop: this_field,
                                            occ_index,
                                            sentenceCase: false
                                          });
                                        }
                                      }
                                    }
                                  }}
                                  helperText={((occ_index > 0) ? null : reconcilePrompt({
                                    rawValue: reactData.fields[this_field].prompt?.value,
                                    this_field
                                  }))}
                                />
                              }
                              {(reactData.fields[this_field].type.startsWith('select')) &&
                                <Box
                                  display='flex'
                                  mb={1}
                                  flexDirection='row'
                                  justifyContent='flex-start'
                                  alignItems='center'
                                >
                                  <AVACheckBoxGroup
                                    prop={this_field}
                                    text={reactData.fields[this_field].selectionObj.selectionList}
                                    withPrompt={(reactData.fields[this_field].type === 'select&text')
                                      ? reactData.fields[this_field].prompt?.other || 'other'
                                      : null
                                    }
                                    column={reactData.fields[this_field].selectionObj.column || false}
                                  />
                                </Box>
                              }
                              {(reactData.fields[this_field].type.startsWith('drop')) &&
                                <Box
                                  display='flex'
                                  mb={0}
                                  flexDirection='row'
                                  justifyContent='flex-start'
                                  alignItems='center'
                                >
                                  <AVADropDown
                                    prop={this_field}
                                    text={reactData.fields[this_field].selectionObj.selectionList}
                                  />
                                </Box>
                              }
                              {(reactData.fields[this_field].type === 'family') &&
                                <Box
                                  display='flex'
                                  mb={1}
                                  flexDirection='row'
                                  justifyContent='flex-start'
                                  alignItems='center'
                                >
                                  <AVAFamilyCheckBoxGroup
                                    prop={this_field}
                                    familyMembers={reactData.fields[this_field].familyMembers || []}
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
                                    <u>{reactData.fields[this_field].prompt?.helper || `Tap here for ${reconcilePrompt({
                                      rawValue: reactData.fields[this_field].prompt?.value,
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
                                  {(occ_index === 0) &&
                                    <Typography
                                      id={`sigBoxText__${this_field}`}
                                      key={`sigBoxText__${this_field}_${sectionNdx}`}
                                      style={AVATextStyle({
                                        lineHeight: 1,
                                        width: `${reactData.fields[this_field].prompt?.width || 200}px`,
                                        maxWidth: '90%',
                                        size: 0.75,
                                        margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                                      })}
                                    >
                                      {reconcilePrompt({
                                        rawValue: reactData.fields[this_field].prompt?.value,
                                        this_field
                                      })}
                                    </Typography>
                                  }
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
                                  width={`${reactData.fields[this_field].prompt?.width || 200}px`}
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
                                        rawValue: reactData.fields[this_field].prompt?.value,
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
                                            occ_index,
                                            prop: this_field,
                                            sentenceCase: false
                                          });
                                        }
                                      }}
                                    />
                                    {(occ_index === 0) &&
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
                                            width: `${reactData.fields[this_field].prompt?.width || 200}px`,
                                            maxWidth: '90%',
                                            size: 0.75,
                                            opacity: '60%',
                                            margin: { top: 0.25, bottom: 0.5, left: 0, right: 3 }
                                          })}
                                        >
                                          {reconcilePrompt({
                                            rawValue: reactData.fields[this_field].prompt?.value,
                                            this_field
                                          })}
                                        </Typography>
                                      </Box>
                                    }
                                  </Box>
                                </Box>
                              }
                            </React.Fragment>

                          ))}
                        </Box>
                      );
                    })}
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
                {!reactData.formRec?.options?.noSaveContinue && !reactData.clientSampleMode && !reactData.formRec.upload_only && !reactData.viewOnlyMode &&
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
                {!reactData.clientSampleMode && !reactData.formRec.upload_only && !reactData.viewOnlyMode &&
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
                {!reactData.formRec.upload_only && !reactData.viewOnlyMode &&
                  <PrintIcon
                    classes={{ root: classes.rowButton }}
                    size='medium'
                    aria-label="penciladd_icon"
                    onClick={async () => {
                      generateHtmlOutput();
                      // await printWIP({ document_id: reactData.document_id });
                    }}
                    edge="start"
                  />
                }
                {!reactData.clientSampleMode && !reactData.viewOnlyMode &&
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
          </React.Fragment >
        }
        {
          (reactData.stage === 'upload') &&
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
              let docTitle = reactData.document_title;
              const docRec = await updateDocument({
                docData: Object.assign({},
                  reactData.docRec,
                  {
                    document_id: reactData.document_id,
                    form_type: reactData.form_id,
                    pertains_to: reactData.pertains_to,
                    client_id: state.session.client_id,
                    title: docTitle
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
        {
          (reactData.stage === 'uploadField') &&
          <AVAUploadFile
            options={{
              buttonText: ['Choose', 'Save & Continue'],
              title: [reactData.field_title],
              oneOnly: reactData.hasOwnProperty('oneOnly') ? reactData.oneOnly : true,
              prevSelected: ((makeArray(reactData.fields[reactData.upload_data.prop].valueText).length > 0)
                ? makeArray(reactData.fields[reactData.upload_data.prop].valueText).map(fLoc => {
                  let [fName, fType] = fLoc.split('/').pop().split('.');
                  return { fName, fLoc, fType, Key: fName, Location: fLoc };
                })
                : null
              )
            }}
            onCancel={() => {
              updateReactData({
                stage: 'fill'
              }, true);
            }}
            onLoad={async (response) => {
              await handleChangeValue({
                newValue: ((reactData.hasOwnProperty('oneOnly') && !reactData.oneOnly && (response.length > 1))
                  ? response.map(r => { return r.fLoc; })
                  : response[0].fLoc
                ),
                prop: reactData.upload_data.prop,
                occ_index: reactData.upload_data.occ_index,
                reactUpdObj: {
                  stage: 'fill'
                }
              });
            }}
          />
        }
        {
          (reactData.stage === 'confirm') &&
          <AVAConfirm
            promptText={reactData.messageList}
            cancelText={'Go back'}
            confirmText={(reactData.errors_on_Form > 0)
              ? '*none*'
              : (reactData.errors_on_Form ? 'Submit' : 'Complete')
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
                pending: !!reactData.errors_on_Form
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
        {
          (reactData.stage === 'exit') &&
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
        {
          (reactData.stage === 'error') &&
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
      </Dialog >
    </div>
  );

};
