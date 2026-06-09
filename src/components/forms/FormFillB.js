import React from 'react';

import { dbClient, cl, makeArray, deepCopy, isEmpty, getDb, listFromArray, array_in_array, recordExists, isObject, titleCase, uuid, isMobile } from '../../util/AVAUtilities';
import { putTask, parseQuickActivity } from '../../util/AVATasks';
import { addMember, removeMember } from '../../util/AVAGroups';
import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { formatPhone, makeName } from '../../util/AVAPeople';
import { makeDate, makeTime, addDays } from '../../util/AVADateTime';
import AVAConfirm from './AVAConfirm';
import AVAUploadFile from '../../util/AVAUploadFile';

import { printFromHTML, sendMessages, printDocumentB } from '../../util/AVAMessages';
import { printEmptyDocument } from '../../util/AVAMessages';
import SignatureCanvas from 'react-signature-canvas';
import Select from "react-dropdown-select";
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import EditIcon from '@material-ui/icons/Edit';
import PrintIcon from '@material-ui/icons/Print';
import LockIcon from '@material-ui/icons/Lock';
import LockOpenIcon from '@material-ui/icons/LockOpen';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';
import { Dialog, DialogContent, Snackbar, Box, Typography, FormControlLabel, Button, TextField, Checkbox, IconButton, Chip } from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab/';
import makeStyles from '@material-ui/core/styles/makeStyles';

import AVA_AlertSound from '../../ava_alert.mp3';
import useSound from 'use-sound';

import useSession from '../../hooks/useSession';
import { syncPersonToSessionCaches } from '../../util/AVASessionSync';
import { useIdleTimer } from 'react-idle-timer';
import { updateDocument, createDocument } from '../../util/AVADocuments';
import { writeSlot, getCalendarEntries } from '../../util/AVACalendars';

const useStyles = makeStyles(theme => ({
  dialogBox: {
    paddingTop: 0,
    paddingLeft: 0,
    paddingBottom: theme.spacing(1),
    overflowX: 'hidden',
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 260px)',
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
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '10px',
    marginBottom: '25px',
  },
  radioDays: {
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
  },
  selectionFieldBox: {
    position: 'relative',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 4,
    boxSizing: 'border-box',
    paddingTop: theme.spacing(0.5),
    paddingRight: theme.spacing(1),
    paddingBottom: theme.spacing(0.5),
    paddingLeft: theme.spacing(1),
  },
  selectionFieldLabel: {
    position: 'absolute',
    top: -9,
    left: 10,
    padding: '3px 0 4px',
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.secondary,
    fontSize: '1rem',
    lineHeight: 1.2,
  },
  selectionFieldLabelInline: {
    padding: '2px 0 4px 0',
    color: theme.palette.text.secondary,
    fontSize: '1rem',
    lineHeight: 1.2,
  },
  selectionFieldHelper: {
    color: theme.palette.text.secondary,
    fontSize: theme.typography.fontSize * 0.72,
    marginTop: 0,
    marginBottom: theme.spacing(0.5),
    marginLeft: theme.spacing(0.5),
    marginRight: theme.spacing(0.5),
  },
  sectionStickyTitle: {
    position: 'sticky',
    top: 0,
    zIndex: 2,
    backgroundColor: theme.palette.background.paper,
    paddingTop: theme.spacing(0.5),
    marginBottom: theme.spacing(1),
  },
  '@global': {
    '.react-dropdown-select-dropdown': {
      zIndex: '10 !important',
      backgroundColor: '#ffffff !important',
      color: '#000000 !important',
    },
    '.react-dropdown-select-item': {
      color: '#000000 !important',
    },
    '.react-dropdown-select-item:hover': {
      backgroundColor: '#e8e8e8 !important',
    },
    '.react-dropdown-select-item.react-dropdown-select-item-selected': {
      backgroundColor: '#bbdefb !important',
      color: '#000000 !important',
    },
  },
  requiredTextField: {
    '& .MuiInputLabel-asterisk': {
      color: theme.palette.success.main,
      fontWeight: 700,
    },
    '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.success.main,
    },
    '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.success.main,
    },
    '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: theme.palette.success.main,
      borderWidth: 2,
    }
  },
  requiredOutline: {
    borderColor: `${theme.palette.success.main} !important`,
  },
  requiredLabel: {
    color: theme.palette.success.main,
  },
  requiredAsterisk: {
    color: theme.palette.success.main,
    fontWeight: 700,
    marginLeft: 3,
  }
}));

export default ({ request = {}, onClose }) => {
  const MIN_FIELD_WIDTH_PX = 400;
  const classes = useStyles();
  const AVAClass = AVAclasses();
  const signatureRef = [React.useRef(null), React.useRef(null), React.useRef(null)];

  const { state, dispatch } = useSession();

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
    administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),
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
    current_formStage: null,
    form_stageStatus: {}, // keyed by stage_name: 'not_started', 'in_progress', 'complete'
    number_of_errorsOnForm: 0,
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
    pertains_to: options.person_id || state.session.patient_id,
    clientSampleMode: (!options.document_id && (options.person_id === state.session.client_id)),
    activeSectionOccurrences: {}
  });

  function uploadIcon(this_field, occ_index) {
    const IconToRender = (makeArray(reactData.fields[this_field].valueText).length > 1) ? EditIcon : CloudUploadIcon;
    const isDisabled = (reactData.fields[this_field].options.viewOnly || reactData.viewOnlyMode || reactData.docRec?.formLocked);
    return (
      <IconButton
        classes={{ root: classes.rowButton }}
        style={{ marginLeft: 0, marginTop: 0, marginBottom: 0, paddingTop: 0 }}
        key={`radio-button_upload`}
        id={`radio-button_upload`}
        disabled={isDisabled}
        size='medium'
        onClick={() => {
          if (isDisabled) {
            return;
          }
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
      >
        <IconToRender />
      </IconButton>
    );
  };

  const [forceRedisplay, setForceRedisplay] = React.useState(false);
  const [fieldDebugSnack, setFieldDebugSnack] = React.useState(null);

  const [renderedSectionCount, setRenderedSectionCount] = React.useState(0);
  const sectionRenderTimerRef = React.useRef(null);
  const formFieldDefinitionCacheRef = React.useRef({});
  const commonFieldDefinitionCacheRef = React.useRef({});
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
      updateReactData(reactUpdObj, true);
    }
    else {
      minutesSinceActive = Math.floor((now.getTime() - reactData.enteredIdleStateTime.getTime()) / oneMinute);
      cl(`Still idle at ${new Date().toLocaleString()}.  Idle for ${minutesSinceActive} minutes.`);
    }
    if (minutesSinceActive > 5) {
      let timeoutDocumentId = reactData.document_id;
      let timeoutRecWritten = reactData.recWritten;
      if (!isInitializing() && valuesChanged() && !reactData.saveInProcess && getDisplayState().hasDisplayableContent) {
        let response = await handleSave({
          document_id: reactData.document_id,
          final: false,
          timeout: true
        });
        if (response.goodPut) {
          timeoutDocumentId = response.document_id || timeoutDocumentId;
          timeoutRecWritten = response.recWritten || timeoutRecWritten;
        }
      }
      onClose('timeout', {
        document_id: timeoutDocumentId,
        document_title: reactData.document_title,
        document_status: (reactData.clientSampleMode ? 'cancel' : 'work_in_process'),
        pertains_to: reactData.pertains_to,
        recWritten: timeoutRecWritten,
        formLocked: reactData.docRec?.formLocked
      });
    }
    else if (minutesSinceActive >= 5) {
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
    else if (minutesSinceActive > 3) {
      updateReactData({
        alert: {
          severity: 'info',
          title: `Are you there?`,
          message: <div>We haven't heard from you in over {minutesSinceActive} minutes.<br />
            We'll automatically {reactData.clientSampleMode ? '' : 'save your work and '} close this form in {6 - minutesSinceActive} minutes.<br />
            To keep this form active, just move your mouse or tap somewhere.</div>
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
    const { ignoreObj, showObj, occurrenceNumber } = tests;

    // Resolve a field key to its occurrence-specific version when inside a repeating block.
    // Handles both '1'-placeholder keys (field_1_name → field_N_name) and _occ1 suffix keys.
    const resolveOccFieldKey = (fieldKey) => {
      if (!occurrenceNumber || occurrenceNumber === 1 || !fieldKey) return fieldKey;
      // _occ1 suffix style
      if (fieldKey.endsWith('_occ1')) {
        return `${fieldKey.slice(0, -5)}_occ${occurrenceNumber}`;
      }
      // '1'-placeholder style: replace first occurrence of '1' surrounded by non-digits (or boundaries)
      const substituted = fieldKey.replace(/(^|[^0-9])1($|[^0-9])/, `$1${occurrenceNumber}$2`);
      // If substitution changed the key and that key exists in fields, use it;
      // otherwise fall back to _occN suffix to avoid silently resolving to the wrong field
      if (substituted !== fieldKey) {
        if (reactData.fields[substituted]) return substituted;
        return `${fieldKey}_occ${occurrenceNumber}`;
      }
      return `${fieldKey}_occ${occurrenceNumber}`;
    };
    const matchValues = (valToCheck, valuesToMatch) => {
      // Normalize valuesToMatch: convert string values to lowercase without mutating the original
      const normalizedValues = Array.isArray(valuesToMatch)
        ? valuesToMatch.map(v => typeof v === 'string' ? v.toLowerCase() : v)
        : valuesToMatch;

      // '*' matches any non-blank value
      if (normalizedValues.includes('*')) {
        if (Array.isArray(valToCheck)) { return valToCheck.length > 0; }
        return valToCheck !== null && valToCheck !== undefined && valToCheck !== '';
      }

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
      // ignore_if is an array of tests: [{ field: "field_name", values: [...] }, ...]
      // Also supports legacy scalar form with a .data property for backward compatibility.
      const testList = Array.isArray(ignoreObj) ? ignoreObj : [ignoreObj];
      ignoreResult = testList.some(this_test => {
        const rawFieldKey = this_test.field || this_test.data?.split('.').slice(-1)[0];
        const fieldKey = resolveOccFieldKey(rawFieldKey);
        const value_to_test = reactData.fields[fieldKey]?.value ?? null;
        return matchValues(value_to_test, makeArray(this_test.values));
      });
    }
    else if (showObj) {
      // show_if is an array of tests: [{ field: "field_name", values: [...] }, ...]
      // (same shape as section-level show_if handled by okToShowSection)
      // Also supports legacy scalar form with a .data property for backward compatibility.
      const testList = Array.isArray(showObj) ? showObj : [showObj];
      const isShown = testList.some(this_test => {
        const rawFieldKey = this_test.field || this_test.data?.split('.').slice(-1)[0];
        const fieldKey = resolveOccFieldKey(rawFieldKey);
        const value_to_test = reactData.fields[fieldKey]?.value ?? null;
        return matchValues(value_to_test, makeArray(this_test.values));
      });
      ignoreResult = !isShown;
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
      if (fieldRec.default.type === 'url') {
        response.value = fieldRec.default.value;
        return response;
      }
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

    const loadFormFieldRec = async () => {
      if (Object.prototype.hasOwnProperty.call(formFieldDefinitionCacheRef.current, field_key)) {
        return formFieldDefinitionCacheRef.current[field_key];
      }
      const fetchedFormFieldRec = await getDb({
        Key: {
          client_id: state.session.client_id,
          field_name: field_key
        },
        TableName: "Form_Fields"
      });
      formFieldDefinitionCacheRef.current[field_key] = fetchedFormFieldRec || null;
      return formFieldDefinitionCacheRef.current[field_key];
    };

    const loadCommonFieldRec = async () => {
      if (Object.prototype.hasOwnProperty.call(commonFieldDefinitionCacheRef.current, field_key)) {
        return commonFieldDefinitionCacheRef.current[field_key];
      }
      const fetchedCommonFieldRec = await getDb({
        Key: {
          client_id: state.session.client_id,
          field_id: field_key
        },
        TableName: "Common_Fields"
      });
      commonFieldDefinitionCacheRef.current[field_key] = fetchedCommonFieldRec || null;
      return commonFieldDefinitionCacheRef.current[field_key];
    };

    const [formFieldRec, commonFieldRec] = await Promise.all([
      loadFormFieldRec(),
      loadCommonFieldRec()
    ]);

    let _field_sources = [];

    if (formFieldRec) {
      // Found in Form_Fields table
      _field_sources.push('Form_Fields table');
      field_variables = Object.assign({}, formFieldRec);
    }

    if (commonFieldRec) {
      // Found in Common_Fields table
      _field_sources.push('Common_Fields table');
      field_variables = Object.assign({}, field_variables, commonFieldRec.value, commonFieldRec);
    }

    // Now override with any values in formRec.fields[field_name]
    if (formRec.fields && formRec.fields[field_name]) {
      if (!_field_sources.includes('form spec')) { _field_sources.push('form spec'); }
      field_variables = Object.assign({}, field_variables, formRec.fields[field_name]);
    }

    if (isObject(fieldEntry)) {
      // Finally, override with any values in fieldEntry object
      if (!_field_sources.includes('form spec')) { _field_sources.push('form spec'); }
      field_variables = Object.assign({}, field_variables, fieldEntry);
    }

    field_variables._field_sources = _field_sources.length > 0 ? _field_sources : ['form spec'];
    field_variables._field_key = field_key;
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
    if (docFields && docFields.hasOwnProperty(field_name) && docFields[field_name] !== null && docFields[field_name] !== undefined) {
      // if we have a document field value, use it
      returnObj.field_value = docFields[field_name];
    }
    // if this is an image or html type field, set the value to the prompt value if present
    else if (returnObj.prompt?.value && (field_variables.value?.type || field_variables.default?.type) === 'html') {
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
    let yesNoType = false;
    returnObj.type = field_variables.type || field_variables.value?.type || field_variables.default?.type || 'text';
    // If 'select' type and custom_selection is true, set type to 'select&text'
    if (returnObj.type === 'select' && field_variables.custom_selection) {
      returnObj.type = 'select&text';
    }
    else if (returnObj.type === 'yes/no') {
      yesNoType = true;
      returnObj.type = 'select';
      const yesNoMin = (field_variables.value?.selection?.min !== undefined && field_variables.value?.selection?.min !== null)
        ? Number(field_variables.value.selection.min)
        : 1;
      returnObj.selectionObj = {
        selectionList: ['yes', 'no'],
        min: yesNoMin,
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
    if (!yesNoType && (returnObj.type.startsWith('select') || returnObj.type.startsWith('drop'))) {
      returnObj.selectionObj = Object.assign({},
        { min: 0, max: 999 },
        field_variables.value,
        field_variables.value?.selection,
        field_variables.column !== undefined ? { column: field_variables.column } : {}
      );
    }

    // For select_event type, dynamically populate selectionList from future calendar occurrences
    if (returnObj.type === 'select_event' && returnObj.selectionObj?.event_id) {
      const todayNumeric = makeDate('today').numeric;

      // Normalize event_id to an array to support single or multiple events
      const rawEventIds = returnObj.selectionObj.event_id;
      const eventIds = Array.isArray(rawEventIds) ? rawEventIds : [rawEventIds];

      // Fetch calendar records for all event IDs in parallel
      const perEventResults = await Promise.all(
        eventIds.map(eid => getCalendarEntries({
          client_id: state.session.client_id,
          event_id: eid,
          type: 'all'
        }))
      );

      // Format hhmm (24h integer, e.g. 830, 1400) → "h:mm AM/PM"
      const formatHHMM = (hhmm) => {
        const n = Number(hhmm);
        const h = Math.floor(n / 100);
        const m = n % 100;
        const ampm = h < 12 ? 'AM' : 'PM';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
      };

      // Format minutes-since-midnight → "h:mm AM/PM"
      const formatMins = (mins) => {
        const h = Math.floor(Number(mins) / 60);
        const m = Number(mins) % 60;
        const ampm = h < 12 ? 'AM' : 'PM';
        const h12 = h % 12 || 12;
        return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
      };

      // Build a flat list of future occurrences, each tagged with its parent event's metadata
      const allFutureOccurrences = [];
      for (let i = 0; i < eventIds.length; i++) {
        const allCalRecords = perEventResults[i];
        const eventRec = allCalRecords.find(rec =>
          rec.record_type === 'event' || !rec.event_key?.includes('#')
        );
        const rawType = eventRec?.eventData?.event_data?.type || eventRec?.eventData?.sign_up?.type || '';
        const eventType = (rawType === 'time') ? 'time' : (rawType === 'seats') ? 'seats' : 'open';
        const eventStartMins = eventRec?.eventData?.event_data?.time?.from_minutesSinceMidnight;
        const eventLocation = eventRec?.eventData?.event_data?.location?.description;
        const baseSlotPattern = eventRec?.eventData?.slotPattern || [];
        const signUpWindow = eventRec?.eventData?.sign_up?.window;
        allCalRecords
          .filter(rec => {
            const keyParts = rec.event_key?.split('#');
            if (keyParts?.length !== 2 || !rec.occurrence_date || rec.occurrence_date < todayNumeric) return false;
            if (signUpWindow) {
              const occDate = makeDate(rec.occurrence_date).date;
              const windowStart = Number(signUpWindow.start);
              const windowEnd = Number(signUpWindow.end);
              if (windowStart > 0) {
                // Registration opens `start` days before the occurrence
                const windowOpenNumeric = makeDate(addDays(occDate, -windowStart)).numeric;
                if (todayNumeric < windowOpenNumeric) return false;
              }
              if (windowEnd > 0) {
                // Registration closes `end` days before the occurrence
                const windowCloseNumeric = makeDate(addDays(occDate, -windowEnd)).numeric;
                if (todayNumeric > windowCloseNumeric) return false;
              }
            }
            return true;
          })
          .forEach(occRec => {
            allFutureOccurrences.push({ occRec, eventType, eventStartMins, eventLocation, baseSlotPattern });
          });
      }

      // Sort all occurrences chronologically: date first, then event start time
      allFutureOccurrences.sort((a, b) => {
        const dateDiff = (a.occRec.occurrence_date || 0) - (b.occRec.occurrence_date || 0);
        if (dateDiff !== 0) return dateDiff;
        return (a.eventStartMins || 0) - (b.eventStartMins || 0);
      });

      // Apply event_filter if present; occurrence/occurrence_id wins over count
      const eventFilter = returnObj.selectionObj?.event_filter;
      let filteredOccurrences = allFutureOccurrences;
      if (eventFilter) {
        const filterByOcc = eventFilter.occurrence ?? eventFilter.occurrence_id;
        if (filterByOcc != null) {
          const filterSet = new Set([].concat(filterByOcc));
          filteredOccurrences = allFutureOccurrences.filter(({ occRec }) => filterSet.has(occRec.event_key));
        } else if (eventFilter.count != null) {
          filteredOccurrences = allFutureOccurrences.slice(0, Number(eventFilter.count));
        }
      }

      const selectionList = [];
      const preSelectedValues = [];  // values to pre-populate as already selected

      for (const { occRec, eventType, eventStartMins, eventLocation, baseSlotPattern } of filteredOccurrences) {
        const occEventKey = occRec.event_key;  // <event_id>#<occurrence_date>
        const occSlotPattern = occRec.occData?.slotPattern || baseSlotPattern;
        const occDateDisplay = makeDate(occRec.occurrence_date).absolute_full;

        if (eventType === 'open') {
          // Open events: one entry per occurrence, no slot interrogation needed
          const displayParts = [occDateDisplay];
          if (eventStartMins != null) { displayParts.push(`at ${formatMins(eventStartMins)}`); }
          if (eventLocation) { displayParts.push(`@ ${eventLocation}`); }
          selectionList.push({
            value: occEventKey,
            display: displayParts.join(' '),
            event_type: eventType,
            slotPattern: occSlotPattern
          });
        }
        else {
          // seats or time: interrogate existing slot records to find occupancy
          const slotQueryResults = await getCalendarEntries({
            client_id: state.session.client_id,
            event_id: occEventKey,
            type: 'slot'
          });
          // Actual slot records have 3 '#'-separated parts in event_key
          const actualSlotRecs = slotQueryResults.filter(rec => rec.event_key?.split('#').length === 3);
          const activeSlotRecs = actualSlotRecs.filter(rec => rec.slotData?.status?.current !== 'released');
          // A slot is occupied when its record exists and status is not 'released'
          const occupiedSlots = new Set(activeSlotRecs.map(rec => String(rec.event_key.split('#')[2])));
          // Find any slot already held by the current user
          const mySlotRec = activeSlotRecs.find(rec => rec.slot_owner === reactData.pertains_to);
          const mySlotId = mySlotRec ? String(mySlotRec.event_key.split('#')[2]) : null;

          if (eventType === 'seats') {
            // Include this occurrence if there's a free seat OR the user already holds a seat here
            const availableSlots = occSlotPattern.filter(slot => !occupiedSlots.has(String(slot)));
            const allOccupied = occSlotPattern.length > 0 && availableSlots.length === 0;
            if (!allOccupied || mySlotId) {
              const displayParts = [occDateDisplay];
              if (eventStartMins != null) { displayParts.push(`at ${formatMins(eventStartMins)}`); }
              if (eventLocation) { displayParts.push(`@ ${eventLocation}`); }
              selectionList.push({
                value: occEventKey,
                display: displayParts.join(' '),
                event_type: eventType,
                slotPattern: occSlotPattern,
                availableSlots,
                mySlotId   // null when not already registered; slot identifier when already registered
              });
              if (mySlotId) { preSelectedValues.push(occEventKey); }
            }
          }
          else {
            // time-based: one entry per unoccupied slot, plus any slot the user already holds
            for (const slot of occSlotPattern) {
              const slotStr = String(slot);
              const isMySlot = (mySlotId === slotStr);
              if (!occupiedSlots.has(slotStr) || isMySlot) {
                selectionList.push({
                  value: `${occEventKey}#${slotStr}`,
                  display: `${occDateDisplay} at ${formatHHMM(slot)}`,
                  event_type: eventType,
                  slotPattern: occSlotPattern,
                  slot_id: slotStr,
                  mySlotId: isMySlot ? slotStr : null
                });
                if (isMySlot) { preSelectedValues.push(`${occEventKey}#${slotStr}`); }
              }
            }
          }
        }
      }

      returnObj.selectionObj.selectionList = selectionList.slice(0, 20);
      // Pre-populate field value with any slots the user already holds
      if (preSelectedValues.length > 0) {
        returnObj.field_value = preSelectedValues.length === 1 ? preSelectedValues[0] : preSelectedValues;
      }
    }

    // set options
    returnObj.options = {
      required: !!(field_variables.required || field_variables.value?.required || returnObj.value?.required),
      log_results: returnObj.value?.log_results || false,
      viewOnly: (returnObj.value?.edit === 'view'),
      hidden: (returnObj.value?.edit === 'hidden'),
      ifEmpty: field_variables.options ? field_variables.options.ifEmpty : null,
      resetFields: (returnObj.value?.resetFields
        || (field_variables.options ? field_variables.options.resetFields : null))
    };

    // gather show_if/show_ifAll/ignore_if in response
    returnObj.show_if = field_variables.show_if || null;
    returnObj.show_ifAll = field_variables.show_ifAll || null;
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
    returnObj._field_key = field_key;
    returnObj._field_name = field_name;
    returnObj._section_name = section?.section_name || '';
    returnObj._field_sources = field_variables._field_sources || ['form spec'];

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

    let complete_stage = { stage_name: 'complete' };
    // Ensure stages array is properly set up
    if (!formRec.stages || !Array.isArray(formRec.stages) || (formRec.stages.length === 0)) {
      formRec.stages = [{ stage_name: 'default' }];
    }
    else {
      if (formRec.stages[0].stage_name !== 'default') {
        formRec.stages.unshift({ stage_name: 'default' });
      }
      // Remove any 'complete' stage(s) from the stages array
      let existingCompleteStage = formRec.stages.find(stage => stage.stage_name === 'complete');
      if (existingCompleteStage) {
        complete_stage = existingCompleteStage;
        formRec.stages = formRec.stages.filter(stage => stage.stage_name !== 'complete');
      }
    }
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
    formRec.stages.push(complete_stage);
    // Ensure formRec.fields is initialized — a newly created form may not have this property in the DB
    if (!formRec.fields || typeof formRec.fields !== 'object') {
      formRec.fields = {};
    }
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
          } else if (fieldEntry.form_field) {
            // When field_name isn't explicit, treat form_field as the field_name so that
            // reactData.fields is keyed by the Form_Fields table key (not an auto-generated name)
            field_name = fieldEntry.form_field;
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

    if (formRec.noData_section && Array.isArray(formRec.noData_section.fields)) {
      formRec.noData_section = Object.assign({}, formRec.noData_section);
      formRec.noData_section.section_name = await resolveVariables(formRec.noData_section.section_name || 'No data');
      for (let [index, fieldEntry] of formRec.noData_section.fields.entries()) {
        let field_name = formRec.noData_section.section_name + '_field_' + index;
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
          section: formRec.noData_section,
          formRec,
          response
        });

        reactData.fields[field_name] = Object.assign({}, formRec.fields[field_name],
          {
            value: formRec.fields[field_name].field_value,
            valueText: formRec.fields[field_name].field_valueText
          }
        );
      }
    }

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
        });
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
    const docFieldValues = documentRec.field_values || {};
    const activeSectionOccurrences = {};
    for (let this_section of formRec.sections) {
      if (this_section.occurrences && !isNaN(this_section.occurrences)) {
        const templateName = this_section.section_name;
        const maxOccurrences = Number(this_section.occurrences);
        // Determine how many occurrences have saved data (used to restore expanded state on reload)
        let highestActive = 1;
        for (let n = maxOccurrences; n >= 2; n--) {
          const hasValue = this_section.fields.some(f => {
            const baseFn = typeof f === 'string' ? f : (f.field_name || f.form_field || f.field_key || f.field_id);
            const replaced = baseFn?.replace('1', String(n));
            // When '1' is not in the field name, fall back to the _occN suffix scheme
            const fn = (replaced === baseFn && n !== 1) ? `${baseFn}_occ${n}` : replaced;
            return fn && docFieldValues[fn] != null;
          });
          if (hasValue) { highestActive = n; break; }
        }
        activeSectionOccurrences[templateName] = highestActive;
        for (let section_number = 1; section_number <= maxOccurrences; section_number++) {
          let sectionIndex = response.sections.push(deepCopy(this_section)) - 1;
          response.sections[sectionIndex].section_name = this_section.section_name.replace('1', section_number);
          response.sections[sectionIndex].occurrence_template = templateName;
          response.sections[sectionIndex].occurrence_number = section_number;
          response.sections[sectionIndex].occurrence_max = maxOccurrences;
          for (let [field_index, this_field] of this_section.fields.entries()) {
            // Resolve the base field name regardless of entry format (string, {field_name}, {form_field}, etc.)
            const baseFieldName = typeof this_field === 'string'
              ? this_field
              : (this_field.field_name || this_field.form_field || this_field.field_key || this_field.field_id);
            const newFieldName = baseFieldName.replace('1', String(section_number));
            // When the base field name has no '1' placeholder, replace() is a no-op and every
            // occurrence would share the same in-memory field key — causing all dropdowns to
            // display the same selected value.  Generate a unique key for occurrences beyond
            // the first so each occurrence has independent state in reactData.fields.
            const resolvedFieldName = (newFieldName === baseFieldName && section_number !== 1)
              ? `${baseFieldName}_occ${section_number}`
              : newFieldName;
            // Ensure the deep-copied entry is an object with field_name set
            if (typeof response.sections[sectionIndex].fields[field_index] !== 'object'
              || response.sections[sectionIndex].fields[field_index] === null) {
              response.sections[sectionIndex].fields[field_index] = {};
            }
            response.sections[sectionIndex].fields[field_index].field_name = resolvedFieldName;
            // default_source is an inline-only property on the raw section field entry
            const rawDefaultSource = isObject(this_field) ? this_field.default_source : undefined;
            response.sections[sectionIndex].fields[field_index].default_source = rawDefaultSource
              ? rawDefaultSource.replace('1', String(section_number))
              : null;
            // saveAs is a processed array on the enriched field record (from Form_Fields lookup);
            // replace '1' in each path segment for this occurrence number
            const enrichedField = reactData.fields[baseFieldName];
            const baseSaveAs = enrichedField?.saveAs;
            response.sections[sectionIndex].fields[field_index].saveAs = baseSaveAs
              ? (Array.isArray(baseSaveAs)
                ? baseSaveAs.map(s => typeof s === 'string' ? s.replace('1', String(section_number)) : s)
                : false)
              : false;
            // For occurrences beyond the first, reactData.fields was never initialized for the
            // expanded field name.  Deep-copy the base field definition and apply the doc value.
            if (section_number > 1) {
              if (enrichedField) {
                const docFieldValue = docFieldValues.hasOwnProperty(resolvedFieldName)
                  ? docFieldValues[resolvedFieldName]
                  : null;
                reactData.fields[resolvedFieldName] = Object.assign({}, deepCopy(reactData.fields[baseFieldName]), {
                  value: docFieldValue,
                  valueText: formatValue({ rawValue: docFieldValue, type: reactData.fields[baseFieldName].type }),
                  _occurrence_number: section_number,
                });
              }
            } else if (enrichedField) {
              // Stamp occurrence 1 so checkIgnore can resolve sibling field keys consistently
              reactData.fields[baseFieldName]._occurrence_number = 1;
            }
          }
        }
      }
      else {
        response.sections.push(this_section);
      }
    }
    updateReactData({ activeSectionOccurrences }, false);

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
        case 'date_past':
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

  const getSelectionMinRequirement = (fieldRec) => {
    if (!fieldRec || typeof fieldRec.type !== 'string') {
      return 0;
    }
    if (!(fieldRec.type.startsWith('select') || fieldRec.type.startsWith('drop'))) {
      return 0;
    }
    return Number(fieldRec.selectionObj?.min || 0);
  };

  const isFieldRequired = (fieldRec) => {
    if (!fieldRec || fieldRec.options?.viewOnly) {
      return false;
    }
    return !!(
      fieldRec.required
      || fieldRec.options?.required
      || fieldRec.value?.required
      || (getSelectionMinRequirement(fieldRec) > 0)
    );
  };

  const escapeHtmlForRender = (value) => {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const decodeHtmlEntitiesForRender = (value) => {
    if (typeof value !== 'string' || !value) {
      return '';
    }
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  };

  const normalizePromptMarkup = (value) => {
    const sourceText = String(value || '');
    if (!sourceText.trim()) {
      return '';
    }

    const decodedText = decodeHtmlEntitiesForRender(sourceText);
    const hasLikelyHtml = /<(?:\/)?(?:p|div|span|br|strong|em|b|i|u|ul|ol|li|a|h[1-6]|table|thead|tbody|tr|td|th|blockquote|img|hr|sup|sub)\b[^>]*>/i.test(decodedText)
      || /<\/[a-z][^>]*>/i.test(decodedText);

    if (hasLikelyHtml) {
      return decodedText;
    }

    return escapeHtmlForRender(sourceText).replace(/\r?\n/g, '<br />');
  };

  const toInlineFieldText = (value) => {
    const normalizedMarkup = normalizePromptMarkup(value);
    if (!normalizedMarkup) {
      return '';
    }
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = normalizedMarkup;
    return String(tempDiv.textContent || tempDiv.innerText || '')
      .replace(/\s+/g, ' ')
      .trim();
  };
  /*
  const getPromptLength = (value) => {
      const inlineText = toInlineFieldText(value);
      const inlineLength = inlineText.length;
  
      if (typeof value !== 'string') {
        return inlineLength;
      }
  
      const rawTextLength = value
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/\s+/g, ' ')
        .trim()
        .length;
  
      return Math.max(inlineLength, rawTextLength);
    };
    
  const getFieldOccurrenceTextValue = (fieldRec, occ_index = 0) => {
      if (!fieldRec) {
        return '';
      }
      const valueText = fieldRec.valueText;
      if (Array.isArray(valueText)) {
        return String(valueText[occ_index] || '').trim();
      }
      return String(valueText || '').trim();
    };
  
    const isLongPromptField = (this_field) => {
      const fullPromptText = reconcilePrompt({
        rawValue: reactData.fields?.[this_field]?.prompt?.value,
        this_field,
        includeRequiredMarker: false
      });
      return getPromptLength(fullPromptText) > 70;
    };
  
    const getInlinePromptFieldProps = ({ this_field, helperValue = '', hidePrompt = false, forceShrink = false, fieldInstanceKey = '', hasCurrentValue = false }) => {
      if (hidePrompt) {
        return {
          label: '',
          placeholder: '',
          InputLabelProps: forceShrink ? { shrink: true } : undefined
        };
      }
  
      const fullPromptText = toInlineFieldText(reconcilePrompt({
        rawValue: reactData.fields?.[this_field]?.prompt?.value,
        this_field,
        includeRequiredMarker: false
      }));
      const isLongPrompt = fullPromptText.length > 70;
      const truncatedPromptText = isLongPrompt
        ? `${fullPromptText.slice(0, 87).trimEnd()}…`
        : fullPromptText;
  
      const helperText = toInlineFieldText(helperValue || '');
      const longPromptShouldUseNotch = isLongPrompt && (forceShrink || hasCurrentValue || (fieldInstanceKey === activePromptFieldKey));
      const shouldShrink = forceShrink || (!isLongPrompt) || longPromptShouldUseNotch;
  
      if (isLongPrompt && !longPromptShouldUseNotch) {
        const isRequired = isFieldRequired(reactData.fields?.[this_field]);
        return {
          label: '',
          placeholder: isRequired ? `${fullPromptText}\u00A0*` : fullPromptText,
          InputLabelProps: shouldShrink ? { shrink: true } : undefined
        };
      }
  
      return {
        label: truncatedPromptText,
        placeholder: isLongPrompt ? '' : helperText,
        InputLabelProps: {
          ...(shouldShrink ? { shrink: true } : {}),
          ...(isLongPrompt ? { title: fullPromptText } : {}),
          ...(shouldShrink ? {
            style: {
              maxWidth: 'calc(100% - 10px)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block'
            }
          } : {})
        }
      };
    };
  */
  const addRequiredPromptMarker = (promptText) => {
    if (typeof promptText !== 'string') {
      return promptText;
    }

    const marker = '\u00A0*';
    const trailingHtmlRegex = /(\s*(?:<br\s*\/?>|<\/[^>]+>)\s*)+$/i;
    const trailingHtmlMatch = promptText.match(trailingHtmlRegex);
    const trailingStart = trailingHtmlMatch
      ? (promptText.length - trailingHtmlMatch[0].length)
      : promptText.length;

    const contentPart = promptText.slice(0, trailingStart).trimEnd();
    if (contentPart.endsWith('*')) {
      return promptText;
    }

    return `${promptText.slice(0, trailingStart)}${marker}${promptText.slice(trailingStart)}`;
  };

  const reconcilePrompt = ({ rawValue, this_field, includeRequiredMarker = true }) => {
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
          else if (reconcile_key.length > 0) {
            response = response.replace(variable, 'this person');
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

    const thisFieldRec = reactData.fields?.[this_field];
    const isRequiredPrompt = isFieldRequired(thisFieldRec);
    if (includeRequiredMarker && isRequiredPrompt && (typeof response === 'string')) {
      response = addRequiredPromptMarker(response);
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
      const previousIgnore = reactData.fields?.[fieldName]?.ignore;
      if (reactData.fields?.[fieldName]) {
        reactData.fields[fieldName].ignore = true;
      }
      return previousIgnore !== true;
    }

    let hasChanges = false;

    // Resolve default value if not already set
    if (!reactData.fields[fieldName].value && reactData.formRec.fields[fieldName]) {
      const defaultResult = await getDefaultValueForField({
        fieldRec: reactData.formRec.fields[fieldName],
        fieldName
      });
      if (defaultResult.value !== undefined) {
        hasChanges = true;
        reactData.fields[fieldName].value = defaultResult.value;
        reactData.fields[fieldName].valueText = formatValue({
          rawValue: reactData.fields[fieldName].value,
          type: reactData.fields[fieldName].type
        });
      }
    }

    // Compute value for 'age' type fields — always read-only, derived from source date fields
    if (reactData.fields[fieldName].type === 'age') {
      // The age config (from_field, to_field, unit) lives in field.prompt because processFieldForSectionField
      // does: returnObj.prompt = Object.assign({}, field_variables.value, field_variables.prompt)
      // which merges the value config into prompt. field.value is the mutable computed result.
      const ageFieldDef = reactData.fields[fieldName].prompt || {};
      const fromFieldName = ageFieldDef.from_field;
      const toFieldName = ageFieldDef.to_field;
      const unit = ageFieldDef.unit || 'years';
      const fromRawValue = fromFieldName ? (reactData.fields[fromFieldName]?.value ?? null) : null;
      const toRawValue = toFieldName ? (reactData.fields[toFieldName]?.value ?? null) : null;

      let computedAge = '';
      if (fromRawValue) {
        const fromObj = makeDate(fromRawValue, { noTime: true, noYearCorrection: true });
        if (!fromObj.error) {
          const toDate = toRawValue
            ? (() => { const d = makeDate(toRawValue, { noTime: true, noYearCorrection: true }); return d.error ? null : d.date; })()
            : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
          if (toDate) {
            const from = fromObj.date;
            if (unit === 'days') {
              computedAge = String(Math.floor((toDate - from) / (1000 * 60 * 60 * 24)));
            } else if (unit === 'months') {
              let months = (toDate.getFullYear() - from.getFullYear()) * 12 + (toDate.getMonth() - from.getMonth());
              if (toDate.getDate() < from.getDate()) { months--; }
              computedAge = String(Math.max(0, months));
            } else {
              // years (default)
              let years = toDate.getFullYear() - from.getFullYear();
              if (toDate.getMonth() < from.getMonth() || (toDate.getMonth() === from.getMonth() && toDate.getDate() < from.getDate())) { years--; }
              computedAge = String(Math.max(0, years));
            }
          }
        }
      }

      if (reactData.fields[fieldName].valueText !== computedAge) {
        hasChanges = true;
        reactData.fields[fieldName].value = computedAge;
        reactData.fields[fieldName].valueText = computedAge;
      }
      // age fields are always read-only
      reactData.fields[fieldName].options = Object.assign({}, reactData.fields[fieldName].options, { viewOnly: true });
    }

    const nextIgnore = checkIgnore({
      ignoreObj: reactData.fields[fieldName]?.ignore_if || reactData.fields[fieldName]?.prompt?.ignore_if,
      showObj: reactData.fields[fieldName]?.show_if,
      occurrenceNumber: reactData.fields[fieldName]?._occurrence_number ?? null,
    });
    if (reactData.fields[fieldName].ignore !== nextIgnore) {
      hasChanges = true;
    }
    reactData.fields[fieldName].ignore = nextIgnore;

    return hasChanges;
  };

  // **************************

  const normalizeSelectionList = (selectionList) => {
    return makeArray(selectionList).map((this_option) => {
      if (isObject(this_option)) {
        const optionValue = this_option.value ?? this_option.id ?? this_option.key ?? this_option.display ?? this_option.label;
        const optionDisplay = this_option.display ?? this_option.label ?? this_option.value ?? this_option.id ?? this_option.key;
        return Object.assign({}, this_option, {
          value: optionValue,
          display: optionDisplay
        });
      }
      return {
        value: this_option,
        display: this_option
      };
    });
  };

  const isSelectionOptionSelected = ({ selectedValue, optionValue, optionDisplay }) => {
    const selectedList = [selectedValue].flat().filter(v => (v !== null && v !== undefined));
    return selectedList.some(v => (v === optionValue) || (v === optionDisplay));
  };

  const AVADropDown = (props) => {
    // props should contain
    //   prop
    //   prompt
    //   text - an array of options, each can independently go true or false
    const fieldRec = reactData.fields[props.prop];
    if (!fieldRec) {
      return null;
    }

    const isRequiredField = isFieldRequired(fieldRec);
    const isDisabled = fieldRec.options.viewOnly || reactData.viewOnlyMode || reactData.docRec?.formLocked;
    let optionList = normalizeSelectionList(props.text)
      .map(this_option => ({ value: this_option.value, label: this_option.display }))
      .sort((a, b) => `${a.label}`.localeCompare(`${b.label}`));
    const promptText = normalizePromptMarkup(reconcilePrompt({
      rawValue: fieldRec.prompt?.value,
      this_field: props.prop,
      includeRequiredMarker: false
    }));
    const helperText = toInlineFieldText(fieldRec.prompt?.helper || '');
    const promptWidth = fieldRec.prompt?.width;
    const containerStyle = {
      width: `${promptWidth || 320}px`,
      minWidth: `${MIN_FIELD_WIDTH_PX}px`,
      maxWidth: '80vw',
      marginTop: '24px',
      marginLeft: '8px',
      marginRight: '8px',
      marginBottom: '8px'
    };
    const selectionMax = fieldRec?.selectionObj?.max;
    const isMulti = Number(selectionMax) > 1;
    const selectedValueList = [fieldRec?.value].flat().filter(v => !isEmpty(v));

    return (
      <Box flexDirection='column' key={`DropDown__${props.prop}`} className={classes.formControlCheckGroup}>
        <Box
          key={`DropDownBox__${props.prop}`}
          className={`${classes.selectionFieldBox} ${isRequiredField ? classes.requiredOutline : ''}`}
          style={containerStyle}
        >
          <Typography className={`${classes.selectionFieldLabelInline} ${isRequiredField ? classes.requiredLabel : ''}`}
            style={{ fontSize: `${reactData.user_fontSize}rem` }}>
            <span dangerouslySetInnerHTML={{ __html: promptText || normalizePromptMarkup(props.prop) }} />
            {isRequiredField && <span className={classes.requiredAsterisk}>*</span>}
          </Typography>
          {!!helperText && (
            <Typography className={classes.selectionFieldHelper}>{helperText}</Typography>
          )}
          <Box display='flex' flexDirection='column' marginTop={0.5}>
            <Select
              options={optionList}
              searchBy={'label'}
              style={{
                fontSize: '0.8rem',
                minHeight: '40px',
                border: 'none',
                borderRadius: '4px',
                borderColor: isRequiredField ? '#2e7d32' : undefined
              }}
              dropdownHandle={true}
              variant={'standard'}
              disabled={isDisabled}
              dropdownPosition={'auto'}
              values={(() => {
                if (selectedValueList.length === 0) return [];
                const matched = optionList.filter(opt =>
                  selectedValueList.includes(opt.value) || selectedValueList.includes(opt.label)
                );
                const matchedValues = matched.map(o => o.value);
                const custom = selectedValueList
                  .filter(v => !matchedValues.includes(v))
                  .map(v => ({ value: v, label: v }));
                return [...matched, ...custom];
              })()}
              clearable={true}
              clearOnSelect={false}
              placeholder={helperText || 'Tap to select'}
              clearOnBlur={false}
              key={`selectBox_selectdrop_${props.prop}`}
              searchable={true}
              multi={isMulti}
              closeOnClickInput={isMulti}
              closeOnSelect={isMulti}
              optionRenderer={isMulti ? ({ item, methods }) => (
                <Chip
                  label={item.label}
                  size='small'
                  color='primary'
                  onDelete={isDisabled ? undefined : (e) => {
                    e.stopPropagation();
                    methods.removeItem(e, item, false);
                  }}
                  style={{ margin: '2px 3px', fontSize: '0.72rem', maxWidth: '200px' }}
                />
              ) : undefined}
              create={true}
              keepSelectedInList={true}
              noDataLabel={''}
              onInputChange={async (values) => {
                if (!values || values.length === 0) {
                  return;
                }
                await handleMakeSelection({
                  clickText: values[0].value,
                  prop: props.prop,
                  singleValue: !isMulti
                });
              }}
              onChange={async (values) => {
                if (isMulti) {
                  // For multi-select, react-dropdown-select passes the COMPLETE new selection
                  // list on every change — not just the newly clicked item.  Set the value
                  // directly rather than toggling through handleMakeSelection (which would
                  // treat values[0] as a toggle and remove an already-selected item).
                  const newValue = (values || []).map(v => v.value);
                  reactData.fields[props.prop].value = newValue;
                  reactData.fields[props.prop].valueText = formatValue({
                    rawValue: newValue,
                    type: reactData.fields[props.prop].type
                  });
                  updateReactData({
                    formUpdates: ++reactData.formUpdates,
                    fields: reactData.fields
                  }, true);
                }
                else {
                  if (!values || values.length === 0) {
                    return;
                  }
                  await handleMakeSelection({
                    clickText: values[0].value,
                    prop: props.prop,
                    singleValue: true
                  });
                }
              }}
            />
          </Box>
        </Box>
      </Box>
    );
  };

  const AVASelectionCheckGroup = (props) => {
    const fieldRec = reactData.fields[props.prop];
    if (!fieldRec) {
      return null;
    }

    const isRequiredField = isFieldRequired(fieldRec);
    const isDisabled = fieldRec.options.viewOnly || reactData.viewOnlyMode || reactData.docRec?.formLocked;
    const promptText = normalizePromptMarkup(reconcilePrompt({
      rawValue: fieldRec.prompt?.value,
      this_field: props.prop,
      includeRequiredMarker: false
    }));
    const helperText = toInlineFieldText(fieldRec.prompt?.helper || '');
    const selectionMax = fieldRec?.selectionObj?.max;
    const shouldUseSingleSelection = Number.isFinite(selectionMax)
      ? (selectionMax <= 1)
      : !props.defaultMultiIfMaxMissing;

    const containerStyle = props.useFamilySizing
      ? {
        width: `${fieldRec.prompt?.width || 320}px`,
        minWidth: `${MIN_FIELD_WIDTH_PX}px`,
        maxWidth: '80vw',
        marginTop: '24px',
        marginLeft: '8px',
        marginRight: '8px',
        marginBottom: '8px'
      }
      : {
        minWidth: `${MIN_FIELD_WIDTH_PX}px`,
        maxWidth: '80vw',
        marginTop: '24px',
        marginLeft: '8px',
        marginRight: '8px',
        marginBottom: '8px'
      };

    const optionList = normalizeSelectionList(props.text);

    return (
      <Box flexDirection='column' key={`Box__${props.prop}`} className={classes.formControlCheckGroup}>
        <Box
          key={`CheckGroup__${props.prop}`}
          className={`${classes.selectionFieldBox} ${isRequiredField ? classes.requiredOutline : ''}`}
          style={containerStyle}
        >
          <Typography className={`${classes.selectionFieldLabelInline} ${isRequiredField ? classes.requiredLabel : ''}`}
            style={{ fontSize: `${reactData.user_fontSize}rem` }}>
            <span dangerouslySetInnerHTML={{ __html: promptText || normalizePromptMarkup(props.prop) }} />
            {isRequiredField && <span className={classes.requiredAsterisk}>*</span>}
          </Typography>
          {!!helperText && (
            <Typography className={classes.selectionFieldHelper}>{helperText}</Typography>
          )}
          <Box
            display='flex'
            flexDirection={props.column ? 'column' : 'row'}
            alignItems='flex-start'
            flexWrap={props.column ? 'nowrap' : 'wrap'}
            style={{ marginTop: '8px' }}
          >
            <React.Fragment key={`groupFrag__${props.prop}`}>
              {(optionList).map((text, tIndex) => (
                <FormControlLabel
                  className={classes.formControlDays}
                  style={props.optionRowStyle || undefined}
                  key={`${props.prop}_${tIndex}_${text.value}`}
                  control={
                    <Checkbox
                      aria-label={`${props.prop}_${tIndex}`}
                      name={`${props.prop}_${tIndex}`}
                      key={`${props.groupKeyPrefix || 'CheckGroup'}__${props.prop}_${tIndex}`}
                      size='small'
                      disabled={isDisabled}
                      checked={isSelectionOptionSelected({
                        selectedValue: fieldRec.value,
                        optionValue: text.value,
                        optionDisplay: text.display
                      })}
                      onMouseDown={async () => {
                        if (text.select_all) {
                          const isCurrentlyChecked = isSelectionOptionSelected({
                            selectedValue: fieldRec.value,
                            optionValue: text.value,
                            optionDisplay: text.display
                          });
                          reactData.fields[props.prop].value = isCurrentlyChecked
                            ? []
                            : optionList.map(o => o.value);
                          updateReactData({
                            formUpdates: ++reactData.formUpdates,
                            fields: reactData.fields
                          }, true);
                          return;
                        }
                        const selectAllItem = optionList.find(o => o.select_all);
                        if (selectAllItem) {
                          const selectAllChecked = isSelectionOptionSelected({
                            selectedValue: fieldRec.value,
                            optionValue: selectAllItem.value,
                            optionDisplay: selectAllItem.display
                          });
                          if (selectAllChecked && Array.isArray(reactData.fields[props.prop].value)) {
                            const idx = reactData.fields[props.prop].value.indexOf(selectAllItem.value);
                            if (idx >= 0) { reactData.fields[props.prop].value.splice(idx, 1); }
                          }
                        }
                        await handleMakeSelection({
                          clickText: text.value,
                          prop: props.prop,
                          singleValue: shouldUseSingleSelection
                        });
                      }}
                      disableRipple
                      inputProps={{ 'aria-labelledby': `${props.ariaPrefix || 'message_routing'}_${tIndex}` }}
                    />
                  }
                  label={<Typography className={classes.radioDays} style={{ whiteSpace: 'nowrap' }}>{text.display}</Typography>}
                  labelPlacement='end'
                />
              ))}
              {(optionList.length === 0) && !!props.noOptionsMessage && (
                <Typography style={AVATextStyle({ size: 0.8, margin: { left: 1 } })}>
                  {props.noOptionsMessage}
                </Typography>
              )}
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
                      disabled={isDisabled}
                      id={`${props.prop}_otherText`}
                      defaultValue={(fieldRec.value && fieldRec.bonusText)
                        ? fieldRec.bonusText
                        : ''
                      }
                      onBlur={(event) => {
                        if (!fieldRec.value) {
                          fieldRec.value = [];
                        }
                        fieldRec.bonusText = event.target.value;
                        setTimeout(() => {
                          updateReactData({
                            formUpdates: reactData.formUpdates++,
                            fields: reactData.fields
                          }, true);
                        }, 0);
                      }}
                      variant='outlined'
                      size='small'
                      placeholder={toInlineFieldText(props.withPrompt || '')}
                    />
                  }
                />
              }
            </React.Fragment>
          </Box>
        </Box>
      </Box>
    );
  };

  const AVACheckBoxGroup = (props) => {
    return (
      <AVASelectionCheckGroup
        prop={props.prop}
        text={props.text}
        column={props.column}
        withPrompt={props.withPrompt}
        defaultMultiIfMaxMissing={false}
        useFamilySizing={false}
        groupKeyPrefix={'CheckGroup'}
        ariaPrefix={'message_routing'}
      />
    );
  };

  const AVAFamilyCheckBoxGroup = (props) => {
    const familyOptionList = (props.familyMembers || []).map((member) => ({
      value: member.id,
      display: `${member.name}${member.nickname ? (` (${member.nickname})`) : ''}`
    }));

    return (
      <AVASelectionCheckGroup
        prop={props.prop}
        text={familyOptionList}
        column={props.column !== undefined ? props.column : true}
        defaultMultiIfMaxMissing={true}
        useFamilySizing={true}
        groupKeyPrefix={'FamilyCheckGroup'}
        ariaPrefix={'family_member'}
        optionRowStyle={{ marginLeft: '16px' }}
        noOptionsMessage={'No family members found'}
      />
    );
  };

  // **************************

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const handleAbort = () => {
    onClose(0, {
      document_id: null,
      document_status: 'aborted',
      formLocked: reactData.docRec?.formLocked
    });
  };

  const leaveFormNow = () => {
    if (reactData.dataSaved) {
      onClose('docAdded',
        {
          document_id: reactData.document_id,
          document_title: reactData.document_title,
          document_status: 'work_in_process',
          pertains_to: reactData.pertains_to,
          recWritten: reactData.recWritten,
          formLocked: reactData.docRec?.formLocked
        }
      );
    }
    else {
      onClose('aborted',
        {
          document_id: 'n/a',
          document_status: 'aborted',
          formLocked: reactData.docRec?.formLocked
        }
      );
    }
  };

  const validateForm = () => {
    // Validates all fields in the form and returns error information
    // Used by both handleReview and handleToggleLock
    let messageList = ['There are problems with this form'];
    let number_of_errorsOnForm = 0;
    let form_stageStatus = {};
    for (const sectionObj of reactData.sections) {
      let stage_name = sectionObj.belongs_to_stage || 'default';
      if (!form_stageStatus.hasOwnProperty(stage_name)) {
        form_stageStatus[stage_name] = {
          errors_in_stage: 0,
        };
      }
      if (okToShowSection(sectionObj) &&
          !(sectionObj.occurrence_template && sectionObj.occurrence_number > (reactData.activeSectionOccurrences?.[sectionObj.occurrence_template] ?? 1))) {
        for (const this_field of sectionObj.fields) {
          // this_field may be a plain string or an object with a field_name property
          // (repeating sections store objects so each occurrence has its own resolved field_name)
          const field_name = isObject(this_field) ? this_field.field_name : this_field;
          const thisFieldRec = reactData.fields[field_name];
          if (!thisFieldRec || thisFieldRec.ignore) {
            continue;
          }
          thisFieldRec.isError = false;
          if (thisFieldRec?.options?.ifEmpty && isEmpty(thisFieldRec.value)) {
            // if there is a specific rule regarding empty value, apply it now
            thisFieldRec.value = reconcilePrompt({
              rawValue: thisFieldRec.options.ifEmpty,
              this_field: field_name
            });
          }
          if (isFieldRequired(thisFieldRec)) {
            const minSelectionRequired = getSelectionMinRequirement(thisFieldRec);
            if (minSelectionRequired > 0) {
              const selectedValues = [thisFieldRec.value ?? []].flat().filter(v => !isEmpty(v));
              const numberOfSelections = selectedValues.length;
              if (numberOfSelections < minSelectionRequired) {
                const prompt_part = reconcilePrompt({
                  rawValue: thisFieldRec.prompt?.value,
                  this_field: field_name
                });
                thisFieldRec.errorMessage = numberOfSelections === 0
                  ? `Please make a selection for ${prompt_part}`
                  : `You must make at least ${minSelectionRequired} selections for ${prompt_part}`;
                thisFieldRec.isError = true;
                messageList.push(thisFieldRec.errorMessage);
                number_of_errorsOnForm++;
                form_stageStatus[stage_name].errors_in_stage++;
              }
              continue;
            }

            // this is a required field
            let is_error = false;
            if (thisFieldRec.type === 'signature') {
              const sigRefNumber = thisFieldRec.options?.sigRefNumber ?? 0;
              const canvasHasSig = signatureRef[sigRefNumber]
                && signatureRef[sigRefNumber].current
                && !signatureRef[sigRefNumber].current.isEmpty();
              const fieldHasSavedSig = thisFieldRec.value && String(thisFieldRec.value).startsWith('data:image/');
              is_error = !canvasHasSig && !fieldHasSavedSig;
            }
            else {
              is_error = isEmpty(thisFieldRec.value);
            }
            if (is_error) {
              thisFieldRec.errorMessage = `${reconcilePrompt({
                rawValue: thisFieldRec.prompt?.value,
                this_field: field_name
              }).replace("*", "").trim()} is required`;
              thisFieldRec.isError = true;
              messageList.push(thisFieldRec.errorMessage);
              number_of_errorsOnForm++;
              form_stageStatus[stage_name].errors_in_stage++;
            }
          }
        }
      }
      // if the section is not being shown, then flag the stage that contains the section as "in error" (it can't be cleared yet) 
      else {
        form_stageStatus[stage_name].errors_in_stage++;
      }
    }
    // we've finished checking sections, the current stage is the first stage we reach that has an error
    // if no stage has an error, the current stage is "complete"
    let current_form_stage = null;
    for (const this_stage of reactData.formStages) {   // formStages was set up in initializeFromFormDefinition from formRec.stages and is sequential
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
    updateReactData({
      current_formStage: current_form_stage,
      form_stageStatus: form_stageStatus
    }, false);

    return {
      messageList,
      number_of_errorsOnForm,
      fields: reactData.fields,
      current_formStage: current_form_stage,
      form_stageStatus: form_stageStatus
    };
  };

  const handleReview = async () => {
    if (!getDisplayState().hasDisplayableContent) {
      updateReactData({
        alert: {
          severity: 'info',
          title: 'No data available',
          message: 'There are no displayable sections or fields available to save for this form.'
        }
      }, true);
      return;
    }

    const validationResult = validateForm();

    if (!validationResult.number_of_errorsOnForm) {
      validationResult.messageList = ['This form is complete!', 'Tap "Complete" below to save it.'];
    }

    updateReactData({
      messageList: validationResult.messageList,
      number_of_errorsOnForm: validationResult.number_of_errorsOnForm,
      fields: validationResult.fields,
      stage: 'confirm'
    }, true);
  };

  const resolveValue = (object, key, value) => {
    const this_key = key.shift();
    if (key.length === 0) {
      if (isEmpty(object) || typeof object !== 'object' || object === null) {
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

  const handleToggleLock = async () => {
    const currentLockedState = reactData.docRec?.formLocked;

    // If currently unlocked, we're locking - validate first
    // We don't want to lock a form that has problems
    // Consequently, locking a form forces its status to be 'complete'
    if (!currentLockedState) {
      if (!getDisplayState().hasDisplayableContent) {
        updateReactData({
          alert: {
            severity: 'info',
            title: 'No data available',
            message: 'There are no displayable sections or fields available to save for this form.'
          }
        }, true);
        return;
      }

      // Run validation
      const validationResult = validateForm();

      // If errors exist, warn the user and let them decide whether to lock anyway
      if (validationResult.number_of_errorsOnForm) {
        updateReactData({
          messageList: ['Warning: this form has incomplete or invalid fields.', ...validationResult.messageList.slice(1), 'Do you still want to lock the form?'],
          number_of_errorsOnForm: validationResult.number_of_errorsOnForm,
          fields: validationResult.fields,
          stage: 'confirmLock'
        }, true);
        return;
      }

      // No errors - proceed with locking and saving
      // Update docRec with locked state (not formRec)
      const updatedDocRec = Object.assign({}, reactData.docRec, {
        formLocked: true
      });

      // Update local state
      updateReactData({
        docRec: updatedDocRec
      }, false);

      try {
        // Save the document as final with formLocked = true
        await handleSave({
          document_id: reactData.document_id,
          final: true,
          formLocked: true
        });

        // Exit the form
        onClose('complete', {
          document_id: reactData.document_id,
          document_title: reactData.document_title,
          document_status: 'complete',
          pertains_to: reactData.pertains_to,
          formLocked: true
        });
      } catch (error) {
        cl('Error locking and saving form:', error);
      }
    } else {
      // Currently locked, just unlock (toggle behavior)
      const updatedDocRec = Object.assign({}, reactData.docRec, {
        formLocked: false
      });

      // Update local state and save document
      updateReactData({
        docRec: updatedDocRec
      }, true);

      // Save the unlocked state to the document
      try {
        await handleSave({
          document_id: reactData.document_id,
          final: false,
          formLocked: false
        });
      } catch (error) {
        cl('Error unlocking form:', error);
      }
    }
  };

  const handleSave = async ({ document_id, final, timeout, pending = false, formLocked }) => {
    if (!getDisplayState().hasDisplayableContent) {
      if (!timeout) {
        updateReactData({
          alert: {
            severity: 'info',
            title: 'No data available',
            message: 'There are no displayable sections or fields available to save for this form.'
          }
        }, true);
      }
      return {
        goodPut: false,
        skippedNoData: true,
        putError: 'No displayable sections or fields available to save for this form.',
        document_status: 'no_data',
        status: 'no_data',
        document_id: document_id || reactData.document_id
      };
    }

    // assure that peopleRec and sessionRec are available
    if (!reactData.peopleRec.hasOwnProperty(reactData.pertains_to)) {
      reactData.peopleRec[reactData.pertains_to] = await getDb({
        Key: { person_id: reactData.pertains_to },
        TableName: "People"
      });
    }
    if (!reactData.sessionRec.hasOwnProperty(reactData.pertains_to)) {
      reactData.sessionRec[reactData.pertains_to] = await getDb({
        Key: { session_id: reactData.pertains_to },
        TableName: "SessionsV2"
      });
    }
    updateReactData({
      saveInProcess: true,
      peopleRec: reactData.peopleRec,
      sessionRec: reactData.sessionRec,
      document_id: document_id || reactData.document_id || `${state.session.patient_id}_${reactData.form_id}_${new Date().getTime()}`
    }, false);

    let field_values = {};
    let signatures = [];
    let needsUpdate = { peopleRec: false, sessionRec: false };
    const selectEventAssignments = new Map(); // Map<valueKey, {event, slot}>
    const selectEventReleases = new Map();    // Map<valueKey, {event, slot}>
    const normalizeSelectEventList = (rawValue) => {
      return [rawValue].flat()
        .map(v => (isObject(v) ? (v.value || v.event || v.event_id || v.id || null) : v))
        .filter(v => !isEmpty(v))
        .map(v => `${v}`);
    };
    for (const this_field in reactData.fields) {
      if (reactData.fields[this_field].bonusText) {   // an extra value added to the end of a list of selections (as in "other - please specify")
        let current_value = [reactData.fields[this_field].value].flat();
        current_value.push(reactData.fields[this_field].bonusText);
        current_value = current_value.filter(v => v && v.toString().trim() !== '');
        reactData.fields[this_field].value = current_value;
        reactData.fields[this_field].valueText = listFromArray(current_value);
      }
      if (!reactData.fields[this_field].options?.viewOnly) {
        field_values[this_field] = reactData.fields[this_field].value;
      }
      if (reactData.fields[this_field].ignore) { continue; }  // load the values, but don't save them anywhere
      if ((reactData.fields[this_field].type === 'select_event') && !reactData.fields[this_field].options?.viewOnly) {
        const participantId = reactData.pertains_to || state.session.patient_id;
        const selectionList = reactData.fields[this_field].selectionObj?.selectionList || [];
        const selectedEventList = normalizeSelectEventList(reactData.fields[this_field].value);
        const previousEventList = normalizeSelectEventList(reactData.docRec?.field_values?.[this_field]);

        const selectedSet = new Set(selectedEventList);
        for (const selectedValue of selectedEventList) {
          const valueParts = selectedValue.split('#');
          // For time type, value encodes the slot as the 3rd part; strip it for the event key
          const eventKey = valueParts.length >= 3 ? `${valueParts[0]}#${valueParts[1]}` : selectedValue;
          const matchingEntry = selectionList.find(entry => entry.value === selectedValue);
          const entryEventType = matchingEntry?.event_type || 'open';
          let slot;
          if (entryEventType === 'time') {
            slot = valueParts[2] || null;
          } else if (entryEventType === 'seats') {
            // prefer the user's existing slot (re-registration); fall back to first available seat
            slot = matchingEntry?.mySlotId ?? matchingEntry?.availableSlots?.[0] ?? null;
          } else {
            slot = participantId;
          }
          selectEventAssignments.set(selectedValue, { event: eventKey, slot });
        }
        for (const previousValue of previousEventList) {
          if (!selectedSet.has(previousValue)) {
            const valueParts = previousValue.split('#');
            const eventKey = valueParts.length >= 3 ? `${valueParts[0]}#${valueParts[1]}` : previousValue;
            const slot = valueParts.length >= 3 ? valueParts[2] : participantId;
            selectEventReleases.set(previousValue, { event: eventKey, slot });
          }
        }
      }
      if (reactData.fields[this_field].saveAs) {
        const [save_file, ...save_instructions] = reactData.fields[this_field].saveAs;
        if ((save_file === 'peopleRec') || (save_file === 'personRec')) {
          reactData.peopleRec[reactData.pertains_to] = resolveValue(
            reactData.peopleRec[reactData.pertains_to],
            save_instructions,
            reactData.fields[this_field].value
          );
          needsUpdate.peopleRec = true;
        }
        else if (save_file === 'sessionRec') {
          reactData.sessionRec[reactData.pertains_to] = resolveValue(
            reactData.sessionRec[reactData.pertains_to],
            save_instructions,
            reactData.fields[this_field].value
          );
          needsUpdate.sessionRec = true;
        }
      }
      if (reactData.fields[this_field].type === 'signature') {
        const sigRefNumber = reactData.fields[this_field].options.sigRefNumber ?? 0;
        let sigData = null;
        if (signatureRef[sigRefNumber] && signatureRef[sigRefNumber].current && !signatureRef[sigRefNumber].current.isEmpty()) {
          sigData = signatureRef[sigRefNumber].current.getTrimmedCanvas().toDataURL('image/png');
        }
        else if (reactData.fields[this_field].value && String(reactData.fields[this_field].value).startsWith('data:image/')) {
          sigData = reactData.fields[this_field].value;  // canvas unmounted but value was captured onEnd
        }
        if (sigData) {
          signatures[sigRefNumber] = sigData;
          field_values[this_field] = sigData;
          reactData.fields[this_field].value = sigData;
        }
      }
    }

    for (const [, { event: releasedEvent, slot: releasedSlot }] of selectEventReleases) {
      try {
        await writeSlot({
          client: state.session.client_id,
          event: releasedEvent,
          owner: state.session.patient_id,
          slot: releasedSlot,
          status: 'released',
          show_this_slot: false,
          no_messaging: false
        });
      }
      catch (error) {
        cl(`Error releasing select_event slot for ${releasedEvent}: ${error}`);
      }
    }

    for (const [, { event: selectedEvent, slot: selectedSlot }] of selectEventAssignments) {
      try {
        await writeSlot({
          client: state.session.client_id,
          event: selectedEvent,
          owner: state.session.patient_id,
          slot: selectedSlot,
          show_this_slot: true,
          no_messaging: false,
          rejectDuplicate: true
        });
      }
      catch (error) {
        cl(`Error writing select_event slot for ${selectedEvent}: ${error}`);
      }
    }
    // all field data is now prepared for saving

    // check for actions needed leaving or entering stages
    let this_stageIndex = reactData.formRec.stages.findIndex(s => s.stage_name === reactData.current_formStage);
    // Capture group list before any stage transitions so we can diff for PeopleGroups sync
    const groupsBeforeStageTransitions = (reactData.peopleRec[reactData.pertains_to]?.groups || []).slice();
    if ((reactData.previous_formStage !== reactData.current_formStage) && reactData.formRec.stages) {
      // log stage change
      cl(`Form ${document_id} stage changed from ${reactData.previous_formStage} to ${reactData.current_formStage}`);

      // check stage exit
      let previous_stageIndex = reactData.formRec.stages.findIndex(s => s.stage_name === reactData.previous_formStage);
      for (let stage_we_finished = previous_stageIndex; stage_we_finished < this_stageIndex; stage_we_finished++) {
        // send message on stage exit /  complete     
        let messageInstructions_onStageExit = reactData.formRec.stages[stage_we_finished].on_complete_message;
        if (messageInstructions_onStageExit) {
          await send_stageMessage(messageInstructions_onStageExit); // send stage complete message
        }
        // remove and add groups from pertains_to account's group list if any
        let groupInstructions_onStageExit = reactData.formRec.stages[stage_we_finished].on_complete_groups;
        if (groupInstructions_onStageExit) {
          reactData.peopleRec[reactData.pertains_to].groups = update_stageGroups(groupInstructions_onStageExit);
          needsUpdate.peopleRec = true;
        }
        // create tasks on stage exit
        const taskTemplates_onStageExit = reactData.formRec.stages[stage_we_finished].on_complete_tasks;
        if (taskTemplates_onStageExit) {
          await createTasksFromTemplates(taskTemplates_onStageExit);
        }
      }
    }

    //check stage entry
    if (this_stageIndex >= 0) {
      // send message on stage entry
      let messageInstructions_onStageEntry = reactData.formRec.stages[this_stageIndex].on_entry_message;
      if (messageInstructions_onStageEntry) {
        await send_stageMessage(messageInstructions_onStageEntry); // send stage entered message
      }
      // remove and add groups from pertains_to account's group list if any
      let groupInstructions_onStageEntry = reactData.formRec.stages[this_stageIndex].on_entry_groups;
      if (groupInstructions_onStageEntry) {
        reactData.peopleRec[reactData.pertains_to].groups = update_stageGroups(groupInstructions_onStageEntry);
        needsUpdate.peopleRec = true;
      }
      // lock the form?
      if (reactData.formRec.stages[this_stageIndex].on_entry_lock) { formLocked = true; }
    }



    let response = { goodPut: true };
    let peopleUpdated = false;
    // save any changes to peopleRec and sessionRec that were indicated to be
    // done with the fields in the form
    if (needsUpdate.peopleRec || reactData.newPerson) {
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
      if (response.goodPut) {
        peopleUpdated = true;
        // Sync PeopleGroups for any stage-transition group changes
        const groupsAfterStageTransitions = reactData.peopleRec[reactData.pertains_to]?.groups || [];
        const personId = reactData.pertains_to;
        const clientId = state.session.client_id;
        const parent_of = state.groups?.parent_of || {};
        const isLeaf = g => !parent_of[g]?.length;
        const groupsToAdd = groupsAfterStageTransitions.filter(g => isLeaf(g) && !groupsBeforeStageTransitions.includes(g));
        const groupsToRemove = groupsBeforeStageTransitions.filter(g => isLeaf(g) && !groupsAfterStageTransitions.includes(g));
        if (groupsToAdd.length > 0) { await addMember(personId, clientId, groupsToAdd); }
        if (groupsToRemove.length > 0) { await removeMember(personId, clientId, groupsToRemove); }
      }
    }
    if (peopleUpdated) {
      syncPersonToSessionCaches({
        state,
        dispatch,
        personRec: reactData.peopleRec[reactData.pertains_to]
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

    let docData = {
      client_id: state.session.client_id,
      document_id,
      title: reactData.document_title,
      pertains_to: reactData.pertains_to,
      status: final ? 'complete' : 'in_process',
      form_type: reactData.form_id,
      client_id_form_type: `${state.session.client_id}%%${reactData.form_id}`,
      field_values,
      options: reactData.formRec.options,
      formLocked: formLocked !== undefined ? formLocked : (reactData.docRec?.formLocked || false),
      history: reactData.docRec?.history || [],
      form_stage: reactData.current_formStage
    };

    const recWritten = await updateDocument({
      docData,
      author: state.session.patient_id,
      isNew: true,
      save_type: final ? 'save_final' : (timeout ? 'on_timeout' : 'in_process'),
    });

    // send messages or create new forms as indicated in formRec options upon final save
    if (final && reactData.formRec?.options?.messaging) {
      // conditional based on responses should be allowed here
      // in user lists, user can be a person: person_id, group: group_id, or author: true
      for (let this_instruction of [reactData.formRec?.options?.messaging].flat()) {
        if (this_instruction.hasOwnProperty('status') && this_instruction.status !== docData.status) {
          continue;
        }
        if (this_instruction.hasOwnProperty('send_message')) {
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
            doc_location: response.document_id
          });
        }
      }
    }

    // create tasks as indicated in formRec options upon final save
    if (final && reactData.formRec?.options?.tasks) {
      await createTasksFromTemplates(reactData.formRec.options.tasks);
    }

    updateReactData({
      saveInProcess: false,
      document_id,
      docRec: recWritten,
      recWritten: recWritten,
      dataSaved: true,
      formUpdates: 0
    }, true);

    response = Object.assign({}, response, {
      document_status: docData.status,
      status: docData.status,
      document_id: docData.document_id,
      recWritten
    });
    return response;
  };

  function resolveMessageTokens(text) {
    if (!text) { return text; }
    const person_id = reactData.pertains_to;
    const personRec = reactData.peopleRec?.[person_id] || {};
    const fullName = personRec.display_name || `${personRec.name?.first || ''} ${personRec.name?.last || ''}`.trim();
    return text.replace(/\{\{([^}]+)\}\}/gi, (match, token) => {
      const key = token.trim();
      if (/^user_id$/i.test(key)) { return person_id; }
      if (/^name$/i.test(key)) { return fullName; }
      const hrefMatch = key.match(/^href:(.+)$/i);
      if (hrefMatch) { return `<a href="${hrefMatch[1].trim()}">this link</a>`; }
      const fieldRec = reactData.fields?.[key];
      const valueText = formatValue({
        rawValue: fieldRec?.value,
        type: fieldRec?.type
      });
      if (fieldRec) { return String(valueText || fieldRec.value || ''); }
      return match;
    });
  }

  async function send_stageMessage(messageInstructions) {
    let final_messageText = '';
    let final_html = '';
    if (messageInstructions.template_id) {
      let templateRec = await getDb({
        Key: {
          client_id: state.session.client_id,
          template_id: messageInstructions.template_id
        },
        TableName: 'MessageTemplates'
      });
      if (templateRec) {
        final_messageText = await resolveVariables(templateRec.message_text);
        final_html = templateRec.html_text ? await resolveVariables(templateRec.html_text) : final_messageText;
      }
    }
    else if (messageInstructions.text) {
      final_messageText = await deepResolve(messageInstructions.text, reactData.peopleRec[reactData.pertains_to]);
      final_html = final_messageText;
    }
    let recipientList = [];
    if (messageInstructions.recipientList) {
      if (messageInstructions.recipientList.people) {
        recipientList = recipientList.concat(messageInstructions.recipientList.people);
      }
      if (messageInstructions.recipientList.groups) {
        for (const this_group of messageInstructions.recipientList.groups) {
          recipientList.push(`GRP//${this_group}`);
        }
      }
    }
    final_html = final_messageText;
    final_messageText = resolveMessageTokens(final_messageText);
    final_html = resolveMessageTokens(final_html);
    await sendMessages({
      client: state.session.client_id,
      author: state.session.user_id,
      person_id: state.session.patient_id,
      messageText: final_messageText,
      htmlText: final_html,
      recipientList: recipientList,
      subject: messageInstructions.subject
        ? resolveMessageTokens(await resolveVariables(messageInstructions.subject))
        : `A message from ${reactData.peopleRec[reactData.pertains_to].display_name || 'AVA Document Management'}`
    });
  }

  function update_stageGroups(groupInstructions) {
    let groupList = reactData.peopleRec[reactData.pertains_to].groups || [];
    if (groupInstructions.remove) {
      const removeList = (typeof groupInstructions.remove === 'string')
        ? [groupInstructions.remove]
        : groupInstructions.remove;
      // if i am removing a group that's a parent, you are also removing that group's children. So we need to check for that and remove those as well
      const allGroupstoRemove = getAllChildrenOfGroups(removeList, reactData.groupsRec);
      groupList = groupList.filter(g => !allGroupstoRemove.includes(g));
    }
    if (groupInstructions.add) {
      const addList = (typeof groupInstructions.add === 'string')
        ? [groupInstructions.add]
        : groupInstructions.add;
      // if i am adding a group that's a child, you are also adding that group's parents. So we need to check for that and add those as well
      const allGroupstoAdd = getAllParentsOfGroups(addList, reactData.groupsRec);
      for (const this_group of allGroupstoAdd) {
        if (!groupList.includes(this_group)) {
          groupList.push(this_group);
        }
      }
    }
    return groupList;
  }

  // Creates tasks from an array of task-template objects (used by on_complete_tasks and options.tasks).
  // Each template: { text, iterate_over?, skip_if_blank?, condition?: { field, value } }
  // All field references use occurrence-1 naming (e.g. med_1_name); iterate_over causes them to
  // be repeated for each active occurrence of that section template, substituting 1→N.
  const createTasksFromTemplates = async (templates) => {
    for (const template of [templates].flat()) {
      const occTemplate = template.iterate_over;
      const maxN = occTemplate
        ? (reactData.activeSectionOccurrences?.[occTemplate] ?? 1)
        : 1;
      for (let n = 1; n <= maxN; n++) {
        // Replace all {{field_1_name}} tokens with {{field_N_name}} for this occurrence
        const applyN = (str) => {
          if (!str || n === 1) { return str; }
          return str.replace(/\{\{([^}]+)\}\}/g, (match, token) => {
            const replaced = token.replace('1', String(n));
            return `{{${replaced === token ? `${token}_occ${n}` : replaced}}}`;
          });
        };
        const applyNtoField = (fieldName) => {
          if (!fieldName || n === 1) { return fieldName; }
          const replaced = fieldName.replace('1', String(n));
          return replaced === fieldName ? `${fieldName}_occ${n}` : replaced;
        };
        // skip_if_blank: skip this occurrence if the anchor field has no value
        const skipField = applyNtoField(template.skip_if_blank);
        if (skipField) {
          const skipRec = reactData.fields?.[skipField];
          const skipVal = skipRec?.valueText ?? skipRec?.value;
          if (!skipVal || String(skipVal).trim() === '') { continue; }
        }
        // condition: skip if the field value doesn't match expected
        if (template.condition) {
          const condField = applyNtoField(template.condition.field);
          const condRec = reactData.fields?.[condField];
          const condVal = condRec?.valueText ?? condRec?.value;
          if (String(condVal ?? '').trim() !== String(template.condition.value ?? '').trim()) { continue; }
        }
        // resolve {{tokens}} then parse the natural-language phrase
        const resolvedText = resolveMessageTokens(applyN(template.text || ''));
        if (!resolvedText?.trim()) { continue; }
        const { description, schedule, start_date } = parseQuickActivity(resolvedText);
        if (!description?.trim()) { continue; }
        await putTask({
          task_id: null,
          client_id: state.session.client_id,
          description,
          status: 'active',
          start_date,
          end_date: '',
          available_to: ['*all'],
          applies_to: [{
            type: 'person',
            id: reactData.pertains_to,
            name: reactData.peopleRec?.[reactData.pertains_to]?.display_name || reactData.pertains_to
          }],
          data_to_collect: [],
          schedule,
          remind_who: [],
          reminders: [],
          streak_rules: [],
          created_by: state.session.user_id,
          source: 'form',
        });
      }
    }
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
        message_text: resolveMessageTokens(send_instructions.text),
        patient_id: state.session.patient_id,
        preferred_method: null,
        recipient_base: 'list',
        recipient_key,
        subject: resolveMessageTokens(send_instructions.subject) || ``,
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

    // mode === 'update': look up the most recent editable document for this person+form before doing anything else
    if (!reactData.document_id && options.mode === 'update' && reactData.form_id && reactData.pertains_to) {
      const gsiResult = await dbClient
        .query({
          TableName: 'DocumentMaster',
          IndexName: 'person_form-index',
          KeyConditionExpression: 'pertains_to = :p and form_type = :f',
          ExpressionAttributeValues: {
            ':p': reactData.pertains_to,
            ':f': reactData.form_id
          }
        })
        .promise()
        .catch(error => {
          cl(`in FormFillB -> initialize (update mode), bad query to DocumentMaster. Error is: ${error}`);
        });

      if (recordExists(gsiResult) && gsiResult.Items.length > 0) {
        let candidates = [...gsiResult.Items].sort((a, b) =>
          (b.document_id || '').localeCompare(a.document_id || '')  // newest first
        );
        // Prefer the most recent document that is still editable
        const editable = candidates.find(d => d.status !== 'complete' && !d.formLocked);
        const chosen = editable || candidates[0];
        // Inject the resolved document_id so the existing lookup path handles it
        updateReactData({ document_id: chosen.document_id }, false);
        reactData.document_id = chosen.document_id;
      }
    }

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
        if (options.mode !== 'update') {
          if (!options.hasOwnProperty('open_complete') || options.open_complete === false) {
            setviewOnlyMode = (docRec.Item.form_stage === 'complete');
          }
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
    const resolved_pertains_to = reactData.pertains_to || state.session.patient_id;
    updateReactData({
      document_id: `${resolved_pertains_to}_${reactData.form_id}_${nowTime}`,
      pertains_to: resolved_pertains_to,
      form_id: reactData.form_id,
      document_title,
      sections,
      stage: 'fill'
    }, true);
    return;
  }

  // Returns true if the test condition matches the given field value.
  // If test.values contains '*', matches any non-blank value.
  const matchesFieldValues = (test, fieldValue) => {
    if ([test.values].flat().includes('*')) {
      if (Array.isArray(fieldValue)) { return fieldValue.length > 0; }
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    }
    return array_in_array([test.values].flat(), [fieldValue].flat());
  };

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
          return matchesFieldValues(this_test, this_value);
        }
      }));
    }
    else if (this_sectionObj.hasOwnProperty('show_ifAll') || this_sectionObj.hasOwnProperty('ignore_ifAll')) {
      const testList = this_sectionObj.show_ifAll || this_sectionObj.ignore_ifAll;
      const response = (testList.every(this_test => {
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
          return matchesFieldValues(this_test, this_value);
        }
      }));
      if (this_sectionObj.hasOwnProperty('show_ifAll')) {
        return response;
      }
      else { return !response; }
    }
    else if (this_sectionObj.hasOwnProperty('ignore_if')) {
      return !(this_sectionObj.ignore_if.some(this_test => {
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
          return matchesFieldValues(this_test, this_value);
        }
      }));
    }
    else {
      return true;
    }
  };

  const getSectionFieldName = ({ sectionObj, fieldEntry, index }) => {
    if (isObject(fieldEntry)) {
      return (
        fieldEntry.field_name
        || fieldEntry.field_key
        || fieldEntry.form_field
        || fieldEntry.field_id
        || `${sectionObj.section_name}_field_${index}`
      );
    }
    return fieldEntry;
  };

  const getDisplayState = () => {
    const displaySections = [];

    for (const sectionObj of (Array.isArray(reactData.sections) ? reactData.sections : [])) {
      if (!okToShowSection(sectionObj)) {
        continue;
      }
      // Skip inactive occurrences for dynamic sections
      if (sectionObj.occurrence_template && sectionObj.occurrence_number > (reactData.activeSectionOccurrences?.[sectionObj.occurrence_template] ?? 1)) {
        continue;
      }
      const visibleFieldList = makeArray(sectionObj.fields)
        .map((fieldEntry, index) => getSectionFieldName({ sectionObj, fieldEntry, index }))
        .filter((fieldName) => (
          !!fieldName
          && !!reactData.fields?.[fieldName]
          && !reactData.fields[fieldName].ignore
        ));
      if (visibleFieldList.length > 0) {
        displaySections.push(Object.assign({}, sectionObj, { fields: visibleFieldList }));
      }
    }

    if (displaySections.length > 0) {
      return {
        displaySections,
        hasDisplayableContent: true,
      };
    }

    if (reactData.formRec?.noData_section) {
      const noDataSection = reactData.formRec.noData_section;
      const noDataFieldList = makeArray(noDataSection.fields)
        .map((fieldEntry, index) => getSectionFieldName({ sectionObj: noDataSection, fieldEntry, index }))
        .filter((fieldName) => (
          !!fieldName
          && !!reactData.fields?.[fieldName]
          && !reactData.fields[fieldName].ignore
        ));
      return {
        displaySections: [Object.assign({}, noDataSection, { fields: noDataFieldList })],
        hasDisplayableContent: false,
      };
    }

    return {
      displaySections: [],
      hasDisplayableContent: false,
    };
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
      else if (reactData.options.mode === 'printPDF') {
        await initialize();
        // Collect signature data from field values (signature canvases may not be mounted)
        let signatures = [];
        for (const fieldName in reactData.fields) {
          if (reactData.fields[fieldName]?.type === 'signature') {
            const sigRefNumber = reactData.fields[fieldName].options?.sigRefNumber ?? 0;
            if (reactData.fields[fieldName].value && String(reactData.fields[fieldName].value).startsWith('data:image/')) {
              signatures[sigRefNumber] = reactData.fields[fieldName].value;
            }
          }
        }
        // Use getDisplayState to get the filtered, resolved section/field list
        const { displaySections } = getDisplayState();
        await printDocumentB({
          documentList: [{
            sections: displaySections,
            fields: reactData.fields,
            signatures,
            docID: reactData.document_id,
            client_id: state.session.client_id,
            title: reactData.document_title
          }]
        });
        onClose('print', {
          document_id: reactData.document_id,
          document_title: reactData.document_title,
          document_status: 'aborted',
          pertains_to: reactData.pertains_to,
          formLocked: reactData.docRec?.formLocked
        });
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

      const fieldNames = Object.keys(reactData.fields);
      const changedFlags = await Promise.all(fieldNames.map((fieldName) => processFieldForDisplay(fieldName)));
      const hasAnyFieldChanges = changedFlags.some(Boolean);

      if (hasAnyFieldChanges) {
        updateReactData({
          fields: reactData.fields
        }, true);
      }
    }

    processAllFields();
  }, [reactData.stage, reactData.formUpdates, reactData.formRec, reactData.sessionRec, reactData.peopleRec]);  // eslint-disable-line react-hooks/exhaustive-deps

  // **************************

  const { displaySections, hasDisplayableContent } = React.useMemo(() => {
    return getDisplayState();
  }, [forceRedisplay, reactData.formUpdates, reactData.sections, reactData.formRec, reactData.peopleRec, reactData.pertains_to, reactData.stage, state.patient?.groups]);  // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (sectionRenderTimerRef.current) {
      clearTimeout(sectionRenderTimerRef.current);
      sectionRenderTimerRef.current = null;
    }

    const totalSections = displaySections.length;
    if (totalSections === 0) {
      setRenderedSectionCount(0);
      return undefined;
    }

    const initialChunk = Math.min(3, totalSections);
    setRenderedSectionCount(initialChunk);

    if (initialChunk >= totalSections) {
      return undefined;
    }

    const renderNextChunk = () => {
      setRenderedSectionCount((previousCount) => {
        const nextCount = Math.min(previousCount + 3, totalSections);
        if (nextCount < totalSections) {
          sectionRenderTimerRef.current = setTimeout(renderNextChunk, 16);
        }
        return nextCount;
      });
    };

    sectionRenderTimerRef.current = setTimeout(renderNextChunk, 16);

    return () => {
      if (sectionRenderTimerRef.current) {
        clearTimeout(sectionRenderTimerRef.current);
        sectionRenderTimerRef.current = null;
      }
    };
  }, [displaySections.length]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Restore saved signature images into SignatureCanvas after each render batch
  React.useEffect(() => {
    if (reactData.stage !== 'fill' || !reactData.fields) { return; }
    for (const fieldName in reactData.fields) {
      const fieldRec = reactData.fields[fieldName];
      if (fieldRec?.type === 'signature' && fieldRec.value && String(fieldRec.value).startsWith('data:image/')) {
        const sigRefNumber = fieldRec.options?.sigRefNumber ?? 0;
        if (signatureRef[sigRefNumber]?.current && signatureRef[sigRefNumber].current.isEmpty()) {
          signatureRef[sigRefNumber].current.fromDataURL(fieldRec.value);
        }
      }
    }
  }, [renderedSectionCount, reactData.stage]);  // eslint-disable-line react-hooks/exhaustive-deps

  const renderTextLikeField = ({ this_field, occ_index, sectionNdx, fieldNdx }) => {
    const fieldRec = reactData.fields[this_field];
    if (!fieldRec) {
      return null;
    }

    const fieldType = fieldRec.type;
    const isTextType = fieldType === 'text';
    const isPhoneType = fieldType === 'phone';
    const isDateSelectType = fieldType === 'date_select';
    const isDateOrTimeType = (fieldType === 'date') || (fieldType === 'date_past') || (fieldType === 'time');
    const isRequiredField = isFieldRequired(fieldRec);
    const isDisabled = fieldRec.options.viewOnly || reactData.viewOnlyMode || reactData.docRec?.formLocked;
    const promptWidth = fieldRec?.prompt?.width;
    const fallbackMinWidth = (isPhoneType || isDateSelectType || isDateOrTimeType) ? '20vw' : '60vw';
    const textRows = Number(fieldRec.prompt?.rows || fieldRec.value?.rows || 1);
    const resolvedMinWidth = promptWidth ? `${promptWidth}px` : fallbackMinWidth;
    const valueText = (fieldRec && fieldRec.valueText)
      ? (Array.isArray(fieldRec.valueText) ? fieldRec.valueText[occ_index] : fieldRec.valueText)
      : '';
    const hasLongValueText = String(valueText || '').length > 90;
    const shouldAutoWrapText = isTextType && ((textRows > 1) || hasLongValueText);
    const resolvedTextRows = (textRows > 1)
      ? textRows
      : (shouldAutoWrapText ? 2 : undefined);

    const promptText = occ_index > 0 ? '' : normalizePromptMarkup(reconcilePrompt({
      rawValue: fieldRec.prompt?.value,
      this_field,
      includeRequiredMarker: false
    }));
    const helperText = toInlineFieldText(fieldRec.prompt?.helper || '');

    const containerStyle = {
      width: resolvedMinWidth,
      minWidth: `${MIN_FIELD_WIDTH_PX}px`,
      maxWidth: '90%',
      marginTop: '24px',
      marginLeft: '8px',
      marginRight: '8px',
      marginBottom: '8px',
    };

    const sharedProps = {
      id: `field__${this_field}`,
      variant: 'standard',
      size: 'small',
      key: `field__${this_field}__${sectionNdx}__${valueText}`,
      placeholder: helperText || undefined,
      required: isRequiredField,
      disabled: isDisabled,
      error: !!fieldRec.isError,
      helperText: fieldRec.isError ? fieldRec.errorMessage : undefined,
      InputProps: { disableUnderline: true },
      style: {
        width: '100%',
        marginTop: '4px',
      },
      onFocus: () => {}
    };

    const promptLabel = !!promptText && (
      <Typography className={`${classes.selectionFieldLabelInline} ${isRequiredField ? classes.requiredLabel : ''}`}
        style={{ fontSize: `${reactData.user_fontSize}rem` }}>
        <span dangerouslySetInnerHTML={{ __html: promptText }} />
        {isRequiredField && <span className={classes.requiredAsterisk}>&nbsp;*</span>}
      </Typography>
    );

    if (isDateSelectType) {
      return (
        <Box
          display='flex'
          flexDirection='column'
          id={`dateBox__${this_field}`}
          key={`datebox__${fieldNdx}__${sectionNdx}_${(fieldRec && fieldRec.value)
            ? fieldRec.value
            : ''}`}
          className={`${classes.selectionFieldBox} ${isRequiredField ? classes.requiredOutline : ''}`}
          style={containerStyle}
        >
          {promptLabel}
          <TextField
            {...sharedProps}
            type='date'
            autoComplete='off'
            inputProps={{ 'data-lpignore': 'true', 'data-form-type': 'other' }}
            min={fieldRec.prompt?.min}
            max={fieldRec.prompt?.max}
            value={(!isEmpty(fieldRec?.valueText))
              ? makeDate(fieldRec.value).input
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
            onBlur={() => {}}
          />
        </Box>
      );
    }

    const commonTextField = (
      <TextField
        {...sharedProps}
        multiline={isTextType ? shouldAutoWrapText : undefined}
        minRows={isTextType ? resolvedTextRows : undefined}
        autoComplete='off'
        inputProps={isTextType
          ? {
            'data-lpignore': 'true',
            'data-form-type': 'other',
            style: {
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere'
            }
          }
          : {
            'data-lpignore': 'true',
            'data-form-type': 'other'
          }
        }
        defaultValue={valueText}
        onBlur={async (event) => {
          if (isTextType) {
            await handleChangeValue({
              newText: event.target.value,
              prop: this_field,
              occ_index,
              sentenceCase: true
            });
            return;
          }

          if (!event.target.value) {
            return;
          }

          if (isPhoneType) {
            let fPhone = formatPhone(event.target.value);
            await handleChangeValue({
              newText: fPhone,
              newValue: `+1${fPhone.replace(/\D/g, '')}`,
              occ_index,
              prop: this_field,
              sentenceCase: false
            });
            return;
          }

          if (fieldType === 'time') {
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
            return;
          }

          if (isDateOrTimeType) {
            let dObj = makeDate(event.target.value, {
              noTime: (fieldType === 'date' || fieldType === 'date_past'),
              noYearCorrection: true,
              noFuture: (fieldType === 'date_past')
            });
            if (dObj.error) {
              reactData.fields[this_field].isError = true;
              reactData.fields[this_field].errorMessage = dObj.absolute;
              updateReactData({ formUpdates: ++reactData.formUpdates, fields: reactData.fields }, true);
            } else {
              reactData.fields[this_field].isError = false;
              reactData.fields[this_field].errorMessage = '';
              await handleChangeValue({
                newText: dObj.absolute,
                newValue: ((fieldType === 'date' || fieldType === 'date_past')
                  ? dObj.numeric$
                  : dObj.timestamp),
                prop: this_field,
                occ_index,
                sentenceCase: false
              });
            }
          }
        }}
      />
    );

    return (
      <Box
        flexDirection='column'
        key={`Box__${this_field}`}
        className={`${classes.selectionFieldBox} ${isRequiredField ? classes.requiredOutline : ''}`}
        style={containerStyle}
      >
        {promptLabel}
        {commonTextField}
      </Box>
    );
  };

  const disableSaveActions = !hasDisplayableContent;

  return (
    <div ref={formContainerRef} id="content-to-export" className="my-form-container">
      <Dialog
        open={(forceRedisplay && (reactData.version > 0)) || true}
        key={`wholeScreen__`}
        onClose={handleAbort}
        disableBackdropClick
        classes={{ paper: classes.clientBackground }}
        maxWidth={false}
        BackdropProps={reactData.options?.mode === 'printPDF' ? { style: { visibility: 'hidden' } } : undefined}
        PaperProps={{
          style: {
            minWidth: '80vw',
            maxWidth: '80vw',
            ...(reactData.options?.mode === 'printPDF' ? { visibility: 'hidden', pointerEvents: 'none' } : {})
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
              {displaySections.length > 0
                ? <React.Fragment>
                  {displaySections.slice(0, renderedSectionCount || displaySections.length).map((sectionObj, sectionNdx) => (
                    <div
                      key={`sectionFrag__${sectionObj.section_name}_${sectionNdx}`}
                    >
                      {sectionObj.section_header
                        ? <div
                            key={`section__${sectionObj.section_name}`}
                            className={classes.sectionStickyTitle}
                            style={{
                              ...AVATextStyle({
                                size: 1.3, bold: true, overflow: 'visible', margin: {
                                  bottom: 1,
                                  top: ((sectionNdx === 0) ? 1 : 3),
                                }
                              }),
                              zIndex: 2 + sectionNdx
                            }}
                            dangerouslySetInnerHTML={{ __html: sectionObj.section_header }}
                          />
                        : <div
                            key={`section__${sectionObj.section_name}`}
                            className={classes.sectionStickyTitle}
                            style={{
                              ...AVATextStyle({
                                size: 1.3, bold: true, overflow: 'visible', margin: {
                                  bottom: 1,
                                  top: ((sectionNdx === 0) ? 1 : 3),
                                }
                              }),
                              zIndex: 2 + sectionNdx
                            }}
                          >
                            {sectionObj.section_name}
                          </div>
                      }
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
                            onContextMenu={(e) => {
                              e.preventDefault();
                              const fieldRec = reactData.fields[this_field];
                              const fieldKey = fieldRec._field_key || this_field;
                              setFieldDebugSnack({
                                form_id: reactData.form_id,
                                section: sectionObj.section_name,
                                field_name: this_field,
                                field_key: fieldKey !== this_field ? fieldKey : null,
                                sources: (fieldRec._field_sources || []).join(', ') || 'form spec'
                              });
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
                                {(['text', 'phone', 'date_select', 'date', 'date_past', 'time', 'age'].includes(reactData.fields[this_field].type))
                                  && renderTextLikeField({ this_field, occ_index, sectionNdx, fieldNdx })
                                }
                                {(reactData.fields[this_field].type === 'header') && (occ_index === 0) &&
                                  <Typography
                                    style={AVATextStyle(Object.assign(
                                      {},
                                      {
                                        margin: { top: 1, bottom: 0.5, right: 3 }
                                      },
                                      reactData.fields[this_field].prompt?.style || {}
                                    ))}
                                    dangerouslySetInnerHTML={{
                                      __html: normalizePromptMarkup(reconcilePrompt({
                                        rawValue: reactData.fields[this_field].prompt?.value,
                                        this_field
                                      }))
                                    }}
                                  />
                                }
                                {(reactData.fields[this_field].type === 'image') &&
                                  <React.Fragment>
                                    <Typography
                                      style={AVATextStyle(Object.assign(
                                        {},
                                        {
                                          size: 0.75,
                                          margin: { top: 2, bottom: 0.5, right: 3 }
                                        },
                                        reactData.fields[this_field].prompt?.style || {}
                                      ))}
                                    >
                                      <span
                                        dangerouslySetInnerHTML={{
                                          __html: normalizePromptMarkup(reconcilePrompt({
                                            rawValue: reactData.fields[this_field].prompt?.value,
                                            this_field
                                          }))
                                        }}
                                      />
                                    </Typography>
                                    <Box
                                      display='flex'
                                      mb={0}
                                      flexDirection='row'
                                      justifyContent='flex-start'
                                      alignItems='center'
                                      padding={(makeArray(reactData.fields[this_field].valueText).length > 1) ? 1 : 0}
                                    >
                                      {makeArray(reactData.fields[this_field].valueText).map((this_image, imageNdx) => {
                                        const fileExtension = this_image.split('.').pop().toLowerCase();
                                        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(fileExtension);
                                        const isPDF = fileExtension === 'pdf';

                                        return (
                                          <Box
                                            borderRadius={'20px'}
                                            border={1}
                                            marginRight={(makeArray(reactData.fields[this_field].valueText).length > 1) ? 1 : 0}
                                            key={`image_${sectionNdx}_${fieldNdx}_${imageNdx}`}
                                            onClick={() => {
                                              window.open(this_image, `${fileExtension} File`);
                                            }}
                                            style={{
                                              minWidth: '150px',
                                              maxWidth: '450px',
                                              minHeight: '150px',
                                              maxHeight: '450px',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              justifyContent: 'center',
                                              alignItems: 'center',
                                              cursor: 'pointer',
                                              backgroundColor: isImage ? 'transparent' : '#f5f5f5',
                                              overflow: 'hidden'
                                            }}
                                          >
                                            {isImage ? (
                                              <Box
                                                component="img"
                                                alt={`${fileExtension} file`}
                                                src={this_image}
                                                style={{
                                                  width: '100%',
                                                  height: '100%',
                                                  objectFit: 'cover'
                                                }}
                                              />
                                            ) : isPDF ? (
                                              <iframe
                                                src={`${this_image}#toolbar=0&navpanes=0&scrollbar=0`}
                                                title={`PDF ${imageNdx}`}
                                                style={{
                                                  width: '100%',
                                                  height: '100%',
                                                  border: 'none',
                                                  pointerEvents: 'none'
                                                }}
                                              />
                                            ) : (
                                              <>
                                                <InsertDriveFileIcon style={{ fontSize: '48px', color: '#666' }} />
                                                <Typography style={{ fontSize: '0.7rem', marginTop: '8px', textAlign: 'center' }}>
                                                  {fileExtension.toUpperCase()}
                                                </Typography>
                                                <Typography style={{ fontSize: '0.6rem', color: '#999', textAlign: 'center' }}>
                                                  Tap to view
                                                </Typography>
                                              </>
                                            )}
                                          </Box>
                                        );
                                      })}
                                    </Box>
                                  </React.Fragment>
                                }
                                {(reactData.fields[this_field].type === 'upload') &&
                                  <Box
                                    display='flex'
                                    mb={0}
                                    flexDirection='column'
                                    justifyContent='flex-start'
                                    alignItems='flex-start'
                                    style={{
                                      paddingTop: '16px',
                                    }}
                                  >
                                    <Box
                                      display='flex'
                                      mb={0}
                                      flexDirection='column'
                                      justifyContent='flex-start'
                                      alignItems='flex-start'
                                    >
                                      <Typography
                                        style={AVATextStyle(Object.assign(
                                          {},
                                          {
                                            size: 0.75,
                                            margin: { top: 2, bottom: 0.75, right: 3 }
                                          },
                                          reactData.fields[this_field].prompt?.style || {}
                                        ))}
                                      >
                                        <span
                                          dangerouslySetInnerHTML={{
                                            __html: normalizePromptMarkup(reconcilePrompt({
                                              rawValue: reactData.fields[this_field].prompt?.value,
                                              this_field
                                            }))
                                          }}
                                        />
                                      </Typography>
                                      {!((reactData.fields[this_field].options.viewOnly || reactData.viewOnlyMode || reactData.docRec?.formLocked))
                                        && uploadIcon(this_field, occ_index)
                                      }
                                    </Box>
                                    <Box
                                      display='flex'
                                      mb={0}
                                      flexDirection='row'
                                      justifyContent='center'
                                      alignItems='center'
                                      padding={(makeArray(reactData.fields[this_field].valueText).length > 1) ? 1 : 0}
                                    >
                                      {makeArray(reactData.fields[this_field].valueText).map((this_image, imageNdx) => {
                                        const fileExtension = this_image.split('.').pop().toLowerCase();
                                        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(fileExtension);
                                        const isPDF = fileExtension === 'pdf';

                                        return (
                                          <Box
                                            borderRadius={'20px'}
                                            border={1}
                                            marginRight={(makeArray(reactData.fields[this_field].valueText).length > 1) ? 1 : 0}
                                            key={`image_${sectionNdx}_${fieldNdx}_${imageNdx}`}
                                            onClick={() => {
                                              window.open(this_image, `${fileExtension} File`);
                                            }}
                                            style={{
                                              minWidth: '150px',
                                              maxWidth: '450px',
                                              minHeight: '150px',
                                              maxHeight: '450px',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              justifyContent: 'center',
                                              alignItems: 'center',
                                              cursor: 'pointer',
                                              backgroundColor: isImage ? 'transparent' : '#f5f5f5',
                                              overflow: 'hidden'
                                            }}
                                          >
                                            {isImage ? (
                                              <Box
                                                component="img"
                                                alt={`${fileExtension} file`}
                                                src={this_image}
                                                style={{
                                                  width: '100%',
                                                  height: '100%',
                                                  objectFit: 'cover'
                                                }}
                                              />
                                            ) : isPDF ? (
                                              <iframe
                                                src={`${this_image}#toolbar=0&navpanes=0&scrollbar=0`}
                                                title={`PDF ${imageNdx}`}
                                                style={{
                                                  width: '100%',
                                                  height: '100%',
                                                  border: 'none',
                                                  pointerEvents: 'none'
                                                }}
                                              />
                                            ) : (
                                              <>
                                                <InsertDriveFileIcon style={{ fontSize: '48px', color: '#666' }} />
                                                <Typography style={{ fontSize: '0.7rem', marginTop: '8px', textAlign: 'center' }}>
                                                  {fileExtension.toUpperCase()}
                                                </Typography>
                                                <Typography style={{ fontSize: '0.6rem', color: '#999', textAlign: 'center' }}>
                                                  Tap to view
                                                </Typography>
                                              </>
                                            )}
                                          </Box>
                                        );
                                      })}
                                    </Box>
                                  </Box>
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
                                      <u>
                                        <span
                                          dangerouslySetInnerHTML={{
                                            __html: normalizePromptMarkup(reactData.fields[this_field].prompt?.helper || `Tap here for ${reconcilePrompt({
                                              rawValue: reactData.fields[this_field].prompt?.value,
                                              this_field
                                            })}`)
                                          }}
                                        />
                                      </u>
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
                                      onEnd={() => {
                                        const sigRefNumber = reactData.fields[this_field].options.sigRefNumber || 0;
                                        if (signatureRef[sigRefNumber].current && !signatureRef[sigRefNumber].current.isEmpty()) {
                                          reactData.fields[this_field].value = signatureRef[sigRefNumber].current.getTrimmedCanvas().toDataURL('image/png');
                                        }
                                      }}
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
                                          minWidth: '60vw',
                                          maxWidth: '90%',
                                          size: 0.75,
                                          margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                                        })}
                                      >
                                        <span
                                          dangerouslySetInnerHTML={{
                                            __html: normalizePromptMarkup(reconcilePrompt({
                                              rawValue: reactData.fields[this_field].prompt?.value,
                                              this_field
                                            }))
                                          }}
                                        />
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
                                  (() => {
                                    const isRequiredField = isFieldRequired(reactData.fields[this_field]);
                                    return (
                                      <Box
                                        display='flex'
                                        flexDirection='row'
                                        key={`selectParent-${this_field}_${sectionNdx}`}
                                        id={`selectParent-${this_field}`}
                                        width={`${reactData.fields[this_field].prompt?.width || 200}px`}
                                        minWidth={`${MIN_FIELD_WIDTH_PX}px`}
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
                                            disabled={reactData.fields[this_field].options.viewOnly || reactData.viewOnlyMode || reactData.docRec?.formLocked}
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
                                                className={isRequiredField ? classes.requiredLabel : ''}
                                                style={AVATextStyle({
                                                  lineHeight: 1,
                                                  minWidth: '60vw',
                                                  maxWidth: '90%',
                                                  size: 0.75,
                                                  opacity: '60%',
                                                  margin: { top: 0.25, bottom: 0.5, left: 0, right: 3 }
                                                })}
                                              >
                                                <span
                                                  dangerouslySetInnerHTML={{
                                                    __html: normalizePromptMarkup(reconcilePrompt({
                                                      rawValue: reactData.fields[this_field].prompt?.value,
                                                      this_field,
                                                      includeRequiredMarker: false
                                                    }))
                                                  }}
                                                />
                                                {isRequiredField && <span className={classes.requiredAsterisk}>*</span>}
                                              </Typography>
                                            </Box>
                                          }
                                        </Box>
                                      </Box>
                                    );
                                  })()
                                }
                              </React.Fragment>

                            ))}
                          </Box>
                        );
                      })}
                      {sectionObj.occurrence_template && !reactData.viewOnlyMode && !reactData.docRec?.formLocked && (() => {
                        const nextSection = displaySections[sectionNdx + 1];
                        const isLastInGroup = !nextSection || nextSection.occurrence_template !== sectionObj.occurrence_template;
                        const canAddMore = sectionObj.occurrence_number < sectionObj.occurrence_max;
                        const canRemove = isLastInGroup && sectionObj.occurrence_number > 1;
                        if (!isLastInGroup && !canRemove) return null;
                        if (isLastInGroup && !canAddMore && !canRemove) return null;
                        const addMoreLabel = reactData.formRec?.sections?.find(s => s.section_name === sectionObj.occurrence_template)?.add_more_label
                          || `Add another ${sectionObj.occurrence_template.replace(/\s*1\s*/, ' ').trim()}`;
                        return (
                          <Box key={`more_btn__${sectionObj.occurrence_template}`} display='flex' justifyContent='flex-start' marginTop={1} marginBottom={1} marginLeft={1} style={{ gap: '8px' }}>
                            {isLastInGroup && canAddMore && (
                              <Button
                                size='small'
                                className={AVAClass.AVAButton}
                                style={{ color: 'white', backgroundColor: '#1976d2' }}
                                onClick={() => {
                                  updateReactData({
                                    activeSectionOccurrences: Object.assign({}, reactData.activeSectionOccurrences, {
                                      [sectionObj.occurrence_template]: sectionObj.occurrence_number + 1
                                    })
                                  }, true);
                                }}
                              >
                                {`+ ${addMoreLabel}`}
                              </Button>
                            )}
                            {canRemove && (
                              <Button
                                size='small'
                                className={AVAClass.AVAButton}
                                style={{ color: 'white', backgroundColor: '#b71c1c' }}
                                onClick={() => {
                                  // Clear field values for this occurrence before removing it
                                  const fieldsToReset = sectionObj.fields;
                                  for (const fieldName of fieldsToReset) {
                                    if (reactData.fields[fieldName]) {
                                      reactData.fields[fieldName].value = null;
                                      reactData.fields[fieldName].valueText = null;
                                    }
                                  }
                                  updateReactData({
                                    fields: reactData.fields,
                                    activeSectionOccurrences: Object.assign({}, reactData.activeSectionOccurrences, {
                                      [sectionObj.occurrence_template]: sectionObj.occurrence_number - 1
                                    })
                                  }, true);
                                }}
                              >
                                {'- Remove'}
                              </Button>
                            )}
                          </Box>
                        );
                      })()}
                    </div>
                  ))}
                  <Box aria-hidden='true' style={{ height: '28vh' }} />
                </React.Fragment>
                :
                <Typography style={AVATextStyle({ size: 0.9, margin: { top: 1, bottom: 1, left: 0.5, right: 3 } })}>
                  No data available for this form.
                </Typography>
              }
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
                  if (disableSaveActions) {
                    leaveFormNow();
                  }
                  else {
                    updateReactData({
                      stage: 'exit'
                    }, true);
                  }
                }}
              >
                {'Exit'}
              </Button>
              {!disableSaveActions &&
                <Box display='flex' flexDirection='row' justifyContent='flex-end' alignItems='center'>
                  {reactData.administrative_account && !reactData.clientSampleMode && !reactData.formRec.upload_only && !reactData.viewOnlyMode &&
                    <Button
                      onClick={handleToggleLock}
                      className={AVAClass.AVAButton}
                      style={{
                        color: reactData.docRec?.formLocked ? 'green' : 'red',
                        borderColor: reactData.docRec?.formLocked ? 'green' : 'red',
                        borderWidth: 2,
                        borderStyle: 'solid',
                      }}
                      size='small'
                      startIcon={reactData.docRec?.formLocked ? <LockOpenIcon /> : <LockIcon />}
                    >
                      {reactData.docRec?.formLocked ? 'Unlock' : 'Lock/Save'}
                    </Button>
                  }
                  {!reactData.formRec?.options?.noSaveContinue && !reactData.clientSampleMode && !reactData.formRec.upload_only && !reactData.viewOnlyMode && !reactData.docRec?.formLocked &&
                    <Button
                      onClick={async () => {
                        const document_id = reactData.document_id || `${state.session.patient_id}_${reactData.form_id}_${new Date().getTime()}`;
                        const saveResponse = await handleSave({
                          document_id,
                          final: false
                        });
                        if (saveResponse?.goodPut) {
                          updateReactData({
                            alert: {
                              severity: 'success',
                              title: 'Saved',
                              message: 'Your form has been saved.'
                            }
                          }, true);
                        }
                      }}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'lightcyan', color: 'black' }}
                      size='small'
                    >
                      {isMobile() ? 'Save' : 'Save/Continue'}
                    </Button>
                  }
                  {!reactData.clientSampleMode && !reactData.formRec.upload_only && !reactData.viewOnlyMode && !reactData.docRec?.formLocked &&
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
                  {false && !reactData.formRec.upload_only && !reactData.viewOnlyMode && !reactData.docRec?.formLocked &&
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
                  {!reactData.clientSampleMode && !reactData.formRec.upload_only &&
                    <Button
                      onClick={async () => {
                        if (valuesChanged()) {
                          const document_id = reactData.document_id || `${state.session.patient_id}_${reactData.form_id}_${new Date().getTime()}`;
                          await handleSave({ document_id, final: false });
                        }
                        let signatures = [];
                        for (const fieldName in reactData.fields) {
                          if (reactData.fields[fieldName]?.type === 'signature') {
                            const sigRefNumber = reactData.fields[fieldName].options?.sigRefNumber ?? 0;
                            if (reactData.fields[fieldName].value && String(reactData.fields[fieldName].value).startsWith('data:image/')) {
                              signatures[sigRefNumber] = reactData.fields[fieldName].value;
                            }
                          }
                        }
                        const { displaySections } = getDisplayState();
                        await printDocumentB({
                          documentList: [{
                            sections: displaySections,
                            fields: reactData.fields,
                            signatures,
                            docID: reactData.document_id,
                            client_id: state.session.client_id,
                            title: reactData.document_title
                          }]
                        });
                      }}
                      className={AVAClass.AVAButton}
                      style={{ backgroundColor: 'lightblue', color: 'black' }}
                      size='small'
                      startIcon={<PrintIcon />}
                    >
                      {'Print'}
                    </Button>
                  }
                </Box>
              }
            </Box>
          </React.Fragment >
        }
        {
          (reactData.stage === 'upload') &&
          <AVAUploadFile
            options={{
              buttonText: ['Choose', 'Save & Continue'],
              title: [reactData.document_title, 'Tap "Choose a File" to select the content to upload'],
              oneOnly: reactData.hasOwnProperty('oneOnly') ? reactData.oneOnly : true,
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
                    ),
                    formLocked: reactData.docRec?.formLocked
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
        {(reactData.stage === 'confirmLock') &&
          <AVAConfirm
            promptText={reactData.messageList}
            cancelText={'No, go back'}
            confirmText={'Yes, lock anyway'}
            onCancel={() => {
              updateReactData({
                stage: 'fill'
              }, true);
            }}
            onConfirm={async () => {
              const updatedDocRec = Object.assign({}, reactData.docRec, { formLocked: true });
              updateReactData({ docRec: updatedDocRec }, false);
              try {
                await handleSave({
                  document_id: reactData.document_id,
                  final: true,
                  formLocked: true
                });
                onClose('complete', {
                  document_id: reactData.document_id,
                  document_title: reactData.document_title,
                  document_status: 'complete',
                  pertains_to: reactData.pertains_to,
                  formLocked: true
                });
              } catch (error) {
                cl('Error locking form with warnings:', error);
              }
            }}
          />
        }
        {(reactData.stage === 'confirm') &&
          <AVAConfirm
            promptText={reactData.messageList}
            cancelText={'Go back'}
            // if there were errors that this user is responsible for, we would not have gotten this far
            // number_of_errorsOnForm > 0 means there are errors on the form, but none of the errors are in a stage that this user has access to
            // this used to imply "pending" status, but that has been removed in favor of "in_process"
            confirmText={(reactData.number_of_errorsOnForm ? '*none*' : 'Complete')}
            onCancel={() => {
              updateReactData({
                stage: 'fill'
              }, true);
            }}
            onConfirm={async () => {
              let response = await handleSave({
                document_id: reactData.document_id,
                final: true,
                pending: !!reactData.number_of_errorsOnForm
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
                    ),
                    formLocked: reactData.docRec?.formLocked
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
              leaveFormNow();
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
          fieldDebugSnack &&
          <Snackbar
            open={!!fieldDebugSnack}
            key={'fieldDebug_snackbar'}
            autoHideDuration={8000}
            onClose={() => setFieldDebugSnack(null)}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert
              severity='info'
              variant='filled'
              key={'fieldDebug_alert'}
              style={{ borderRadius: '12px' }}
              onClose={() => setFieldDebugSnack(null)}
            >
              <AlertTitle>Field Info</AlertTitle>
              <Typography style={{ fontSize: '0.85rem' }}>{'form_id: ' + fieldDebugSnack.form_id}</Typography>
              <Typography style={{ fontSize: '0.85rem' }}>{'section: ' + fieldDebugSnack.section}</Typography>
              <Typography style={{ fontSize: '0.85rem' }}>{'field_name: ' + fieldDebugSnack.field_name}</Typography>
              {fieldDebugSnack.field_key &&
                <Typography style={{ fontSize: '0.85rem' }}>{'field_key: ' + fieldDebugSnack.field_key}</Typography>
              }
              <Typography style={{ fontSize: '0.85rem' }}>{'source(s): ' + fieldDebugSnack.sources}</Typography>
            </Alert>
          </Snackbar>
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
