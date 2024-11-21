import React from 'react';

import { dbClient, cl, makeArray, isEmpty, getDb, sentenceCase } from '../../util/AVAUtilities';
import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { formatPhone, makeName } from '../../util/AVAPeople';
import { makeDate } from '../../util/AVADateTime';
import AVAConfirm from './AVAConfirm';
import { printDocumentB, printEmptyDocument, printDocumentHybrid } from '../../util/AVAMessages';
import SignatureCanvas from 'react-signature-canvas';
import Select from "react-dropdown-select";
import PrintIcon from '@material-ui/icons/Print';

import Box from '@material-ui/core/Box';
import { Dialog, DialogContent } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Checkbox from '@material-ui/core/Checkbox';
import { FormGroup, FormControlLabel, FormControl, FormLabel } from '@material-ui/core';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';

import useSession from '../../hooks/useSession';
import { useIdleTimer } from 'react-idle-timer';

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
    height: 1,
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
    paddingTop: '16px',
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
  inputDisplay: {
    root: {
      '&.MuiInputBase-input': {
        paddingBottom: '0px',
        color: 'red'
      },
      '&.MuiInput-input': {
        paddingBottom: '22px',
        color: 'red'
      },
      '&.Mui-disabled': {
        color: 'black'
      },
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

  const nowObj = new Date();

  const [reactData, setReactData] = React.useState({
    form_id: options.form_id,
    options,
    document_id: options.document_id,
    document_title: null,
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
    sessionRec: {},
    peopleRec: {},
    familyRec: {},
    stage: 'initialize',
    messageList: ['In progress'],
    errorsOnForm: 0,
    formUpdates: 0,
    lastActiveTime: nowObj,
    version: 1,
    idleState: true,
    pertains_to: options.person_id || state.session.patient_id
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
          final: false
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
        document_id: reactUpdObj.document_id,
        document_title: reactData.document_title,
        document_status: 'work_in_process',
        recWritten: reactData.recWritten
      });
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
      peopleRec: {}
    }, false);
    let response = {
      fields: {},
      sections: formRec.sections,
      document_title: `${formRec.form_name}`
    };
    for (let this_section of response.sections) {
      for (let this_field of this_section.fields) {
        response.fields[this_field] = {};
        // Set default value
        const defaultObj = {};
        if (formRec.fields[this_field].default) {
          if (formRec.fields[this_field].default.source) {
            defaultObj.source_path = makeArray(formRec.fields[this_field].default.source, '.');
          }
          else if (formRec.fields[this_field].default.value) {
            defaultObj.value_path = makeArray(formRec.fields[this_field].default.value, '.');
          }
        }
        if (!defaultObj) {
          response.fields[this_field].value = null;
        }
        else {
          if (defaultObj.source_path) {
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
          }
          else if (defaultObj.value_path) {
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
            else if (defaultObj.value_path.length === 1) {
              response.fields[this_field].value = defaultObj.value_path[0];
            }
          }
          else if (formRec.fields[this_field]?.prompt && formRec.fields[this_field]?.prompt.value) {
            if (['image', 'html'].includes(formRec.fields[this_field]?.value.type || formRec.fields[this_field]?.default?.type)) {
              response.fields[this_field].value = formRec.fields[this_field]?.prompt.value;
            }
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
          viewOnly: (formRec.fields[this_field].value.edit === 'view')
        };
      }
    };
    return response;
  };

  const initializeDoc = async ({ form_id, pertains_to }) => {
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
    reactData.peopleRec[pertains_to] = await getDb({
      Key: {
        person_id: pertains_to
      },
      TableName: "People"
    });
    updateReactData({
      peopleRec: reactData.peopleRec
    }, false);
    const pertains_to_name = reactData.peopleRec[pertains_to].display_name
      || (`${reactData.peopleRec[pertains_to]?.name.first} ${reactData.peopleRec[pertains_to]?.name.last}`).trim();
    let response = {
      fields: {},
      sections: formRec.sections,
      document_title: `${formRec.form_name} for ${pertains_to_name} - ${makeDate(new Date()).absolute}`
    };
    for (let this_section of response.sections) {
      for (let this_field of this_section.fields) {
        response.fields[this_field] = {};
        // Set default value
        const defaultObj = {};
        if (formRec.fields[this_field].default) {
          if (formRec.fields[this_field].default.source) {
            // if defaultObj has a source, the source is going to tell you where to find the default data
            // this should be EITHER an array OR a string; we want to make an array out of it
            defaultObj.source_path = makeArray(formRec.fields[this_field].default.source, '.');
          }
          else if (formRec.fields[this_field].default.value) {
            defaultObj.value_path = makeArray(formRec.fields[this_field].default.value, '.');
          }
        }
        if (!defaultObj) {
          response.fields[this_field].value = null;
        }
        else {
          if (defaultObj.source_path) {
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
              if (!reactData.familyRec[pertains_to]) {
                let familyResponse = await getDb({
                  Key: {
                    client_id: state.session.client_id,
                    person_id: pertains_to
                  },
                  TableName: "FamilyGroups",
                  IndexName: "person_id-index"
                });
                if (familyResponse) {
                  reactData.familyRec[pertains_to] = familyResponse[0];
                }
                else {
                  reactData.familyRec[pertains_to] = false;
                }
                updateReactData({
                  familyRec: reactData.familyRec
                }, false);
              }
              response.fields[this_field].value = resolve({
                object: reactData.familyRec[pertains_to],
                key: defaultObj.source_path
              });
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
          }
          else if (defaultObj.value_path) {
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
            else if (defaultObj.value_path.length === 1) {
              response.fields[this_field].value = defaultObj.value_path[0];
            }
          }
          else if (formRec.fields[this_field]?.prompt && formRec.fields[this_field]?.prompt.value) {
            if (['image', 'html'].includes(formRec.fields[this_field]?.value.type || formRec.fields[this_field]?.default?.type)) {
              response.fields[this_field].value = formRec.fields[this_field]?.prompt.value;
            }
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
          viewOnly: (formRec.fields[this_field].value.edit === 'view')
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
        // finish initializations
        response.fields[this_field].isError = false;
      }
    };
    return response;
  };

  const resolve = ({ object, key }) => {
    const this_key = key.shift();
    if (!object || !object.hasOwnProperty(this_key)) {
      return null;
    }
    if (key.length === 0) {
      return object[this_key];
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

  const handleChangeValue = async ({ newText, newValue, newList, prop, sentenceCase }) => {
    if (sentenceCase && newText && (newText.length === 1)) {
      newText = newText.toUpperCase();
    }
    reactData.fields[prop].value = newValue || newList || newText;
    reactData.fields[prop].valueText = await formatValue({
      rawValue: reactData.fields[prop].value,
      type: reactData.fields[prop].type
    });
    updateReactData({
      formUpdates: reactData.formUpdates++,
      fields: reactData.fields
    }, true);
  };

  const handleMakeSelection = (props) => {
    if (isEmpty(reactData.fields[props.prop].value)) {
      reactData.fields[props.prop].value = [props.clickText];
    }
    else {
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
    updateReactData({
      formUpdates: reactData.formUpdates++,
      fields: reactData.fields
    }, true);
  };

  const reconcilePrompt = ({ rawValue, this_field }) => {
    let response = rawValue;
    let answer = response.match(/%%.*?%%/);
    if (answer) {
      do {
        let variable = answer[0];
        if ((variable === '%%default%%') || (variable === '%%value%%')) {
          response = response.replace(variable, reactData.fields[this_field].valueText);
        }
        else {
          let extracted_field = variable.slice(2, -2);
          if (reactData.fields[extracted_field]) {
            response = response.replace(variable, reactData.fields[extracted_field].valueText);
          }
          else {
            response = response.replace(variable, '');
          }
        }
        answer = response.match(/%%.*?%%/);
      }
      while (answer);
    }
    return response;
  };

  // **************************

  const AVACheckBoxGroup = (props) => {
    // props should contain
    //   prop
    //   text - an array of options, each can independently go true or false
    return (
      <FormControl className={classes.formControlCheckGroup} component="fieldset">
        <FormLabel className={classes.formControlTitle}>
          {reconcilePrompt({
            rawValue: reactData.fields[props.prop].prompt.value,
            this_field: props.prop
          })}
        </FormLabel>
        <FormGroup row aria-label={`CheckGroup__${props.prop}`} name="method">
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
                  onClick={() => {
                    handleMakeSelection({
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
        </FormGroup>
      </FormControl>
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
    for (const this_field in reactData.fields) {
      reactData.fields[this_field].isError = false;
      if (reactData.fields[this_field].options.required) {
        if (((reactData.fields[this_field].type === 'signature')
          && ((signatureRef[reactData.fields[this_field].options.sigRefNumber].current.isEmpty())))
          || ((reactData.fields[this_field].type !== 'signature')
            && (isEmpty(reactData.fields[this_field].value)))) {
          reactData.fields[this_field].errorMessage = `${reconcilePrompt({
            rawValue: reactData.fields[this_field].prompt.value,
            this_field
          })} is required`;
          reactData.fields[this_field].isError = true;
          messageList.push(reactData.fields[this_field].errorMessage);
          errorsOnForm++;
        }
      }
      else if (reactData.fields[this_field].type.startsWith('select')) {
        if (reactData.fields[this_field].selectionObj.min) {
          if (isEmpty(reactData.fields[this_field].value)) {
            reactData.fields[this_field].errorMessage = `Please make a selection for ${reconcilePrompt({
              rawValue: reactData.fields[this_field].prompt.value,
              this_field
            })}`;
            reactData.fields[this_field].isError = true;
            messageList.push(reactData.fields[this_field].errorMessage);
            errorsOnForm++;
          }
          else if (reactData.fields[this_field].value.length < reactData.fields[this_field].selectionObj.min) {
            reactData.fields[this_field].errorMessage = `You must make at least ${reactData.fields[this_field].selectionObj.min} selections for ${reconcilePrompt({
              rawValue: reactData.fields[this_field].prompt.value,
              this_field
            })}`;
            reactData.fields[this_field].isError = true;
            messageList.push(reactData.fields[this_field].errorMessage);
            errorsOnForm++;
          }
        }
      }
    };
    if (!errorsOnForm) {
      messageList = ['This form is complete!', 'Tap "Save" below to save it'];
    }
    updateReactData({
      messageList,
      errorsOnForm,
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

  const handleSave = async ({ document_id, final }) => {
    let response = { goodPut: true };
    // if not final, then save this in DocumentsInProcess
    if (!final) {
      let DinPRec = {
        client_id: state.session.client_id,
        document_id,
        document_title: reactData.document_title,
        pertains_to: reactData.pertains_to,
        form_id: reactData.form_id,
        formType: reactData.form_id,
        formType_date: `${reactData.form_id}%%${new Date().getTime()}`,
        fields: reactData.fields,
        sections: reactData.sections,
      };
      await dbClient
        .put({
          Item: DinPRec,
          TableName: 'DocumentsInProcess'
        })
        .promise()
        .catch(error => {
          cl(`Bad put to DocumentsInProcess. Error is: ${error}`);
          response = { goodPut: false };
        });
      if (response.goodPut) {
        response.recWritten = DinPRec;
        await dbClient
          .put({
            Item: {
              person_id: state.session.user_id,
              document_id,
              role: 'made_updates',
            },
            TableName: 'DocumentXRef'
          })
          .promise()
          .catch(error => {
            const messageText = `Bad put to DocumentXRef (made_updates). Error is: ${error}`;
            cl(messageText);
            response = { goodPut: false, putError: messageText };
          });
        await dbClient
          .put({
            Item: {
              person_id: reactData.pertains_to,
              document_id,
              role: 'pertains_to',
            },
            TableName: 'DocumentXRef'
          })
          .promise()
          .catch(error => {
            const messageText = `Bad put to DocumentXRef (pertains_to). Error is: ${error}`;
            cl(messageText);
            response = { goodPut: false, putError: messageText };
          });
        await dbClient
          .put({
            Item: {
              person_id: '*status',
              document_id,
              status: 'work_in_process',
              formType: reactData.form_id,
              last_update: new Date().getTime()
            },
            TableName: 'DocumentXRef'
          })
          .promise()
          .catch(error => {
            const messageText = `Bad put to DocumentXRef (status). Error is: ${error}`;
            cl(messageText);
            response = { goodPut: false, putError: messageText };
          });
      }
      return response;
    }
    // if we got here, this is a FINAL save
    // Update People, FamilyGroups, or SessionsV2 as per instructions in fields[this_field].saveAs
    let needsUpdate = {
      peopleRec: false,
      sessionRec: false,
      familyRec: false
    };
    for (const this_field in reactData.fields) {
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
          if (!reactData.familyRec.hasOwnProperty(reactData.pertains_to)) {
            let familyResponse = await getDb({
              Key: {
                client_id: state.session.client_id,
                person_id: reactData.pertains_to
              },
              TableName: "FamilyGroups",
              IndexName: "person_id-index"
            });
            if (familyResponse) {
              reactData.familyRec[reactData.pertains_to] = familyResponse[0];
            }
            else {
              // this person is not part of a family,
              // and there's no way to know what family they might be a part of
              // invent a new family and put them in there
              const family_id = `family_${Date().getTime()}`;
              reactData.familyRec[reactData.pertains_to] = {
                client_id: state.session.client_id,
                composite_key: `${family_id}%%${reactData.pertains_to}`,
                family_id,
                record_type: 'person',
                role: 'primary'
              };
              await dbClient
                .put({
                  Item: {
                    client_id: state.session.client_id,
                    composite_key: family_id,
                    family_id,
                    record_type: 'header',
                    role: 'master'
                  },
                  TableName: 'FamilyGroups'
                })
                .promise()
                .catch(error => {
                  cl(`Bad put to FamilyGroups. Error is: ${error}`);
                });
            }
            updateReactData({
              familyRec: reactData.familyRec
            }, false);
          }
          reactData.familyRec[reactData.pertains_to] = resolveValue(
            reactData.familyRec[reactData.pertains_to],
            save_instructions,
            reactData.fields[this_field].value
          );
          needsUpdate.familyRec = true;
        }
      }
    }
    if (needsUpdate.peopleRec) {
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
    if (needsUpdate.familyRec) {
      await dbClient
        .put({
          Item: reactData.familyRec[reactData.pertains_to],
          TableName: 'FamilyGroups'
        })
        .promise()
        .catch(error => {
          cl(`Bad put to Family. Error is: ${error}`);
          response = { goodPut: false, putError: `Bad put to Family. Error is: ${error}` };
        });
    }
    if (response.goodPut) {
      // render signatures (if any) before printing
      let signatures = [];
      for (const this_field in reactData.fields) {
        if (reactData.fields[this_field].type === 'signature') {
          signatures[reactData.fields[this_field].options.sigRefNumber] = signatureRef[reactData.fields[this_field].options.sigRefNumber].current.getTrimmedCanvas().toDataURL('image/png');
        }
        reactData.fields[this_field].prompt.value =
          reconcilePrompt({
            rawValue: reactData.fields[this_field].prompt.value,
            this_field
          });
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
      let timestamp = new Date().getTime();
      let CRec = {
        client_id: state.session.client_id,
        document_id,
        document_title: reactData.document_title,
        pertains_to: reactData.pertains_to,
        date_completed: timestamp,
        formType: reactData.form_id,
        formType_date: `${reactData.form_id}%%${timestamp}`,
        save_info: s3Results,
        file_location: s3Results[0].s3Location
      };
      await dbClient
        .put({
          Item: CRec,
          TableName: 'CompletedDocuments'
        })
        .promise()
        .catch(error => {
          cl(`Bad put to CompletedDocuments. Error is: ${error}`);
          response = { goodPut: false, putError: `Bad put to CompletedDocuments. Error is: ${error}` };
        });
      if (response.goodPut) {
        response.recWritten = CRec;
        await dbClient
          .put({
            Item: {
              person_id: state.session.user_id,
              document_id,
              role: 'completed_by',
            },
            TableName: 'DocumentXRef'
          })
          .promise()
          .catch(error => {
            const messageText = `Bad put to DocumentXRef (completed_by). Error is: ${error}`;
            cl(messageText);
            response = { goodPut: false, putError: messageText };
          });
        await dbClient
          .put({
            Item: {
              person_id: reactData.pertains_to,
              document_id,
              role: 'pertains_to',
            },
            TableName: 'DocumentXRef'
          })
          .promise()
          .catch(error => {
            const messageText = `Bad put to DocumentXRef (pertains_to). Error is: ${error}`;
            cl(messageText);
            response = { goodPut: false, putError: messageText };
          });
        await dbClient
          .put({
            Item: {
              person_id: '*status',
              document_id,
              status: 'complete',
              formType: reactData.form_id,
              last_update: new Date().getTime()
            },
            TableName: 'DocumentXRef'
          })
          .promise()
          .catch(error => {
            const messageText = `Bad put to DocumentXRef (status). Error is: ${error}`;
            cl(messageText);
            response = { goodPut: false, putError: messageText };
          });
      }
    }
    return response;
  };

  async function printWIP({ document_id }) {
    let signatures = [];
    for (const this_field in reactData.fields) {
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
      let WIPDocRec = await getDb({
        Key: {
          client_id: state.session.client_id,
          document_id: reactData.document_id
        },
        TableName: "DocumentsInProcess"
      });
      if (WIPDocRec) {
        for (let this_field in WIPDocRec.fields) {
          if (!WIPDocRec.fields[this_field].valueText) {
            WIPDocRec.fields[this_field].valueText = await formatValue({
              rawValue: WIPDocRec.fields[this_field].value,
              type: WIPDocRec.fields[this_field].type
            });
          }
        }
        updateReactData({
          document_title: WIPDocRec.document_title,
          pertains_to: WIPDocRec.pertains_to,
          form_id: WIPDocRec.form_id,
          fields: WIPDocRec.fields,
          sections: WIPDocRec.sections,
          stage: 'fill'
        }, true);
        return;
      }
      let AssignedDocRec = await getDb({
        Key: {
          client_id: state.session.client_id,
          document_id: reactData.document_id
        },
        TableName: "DocumentsAssigned"
      });
      if (AssignedDocRec) {
        // this document_id was assigned to someone, but hasn't been started yet
        const { fields, sections } = await initializeDoc({
          form_id: AssignedDocRec.form_id,
          pertains_to: AssignedDocRec.pertains_to
        });
        updateReactData({
          document_title: AssignedDocRec.document_title,
          pertains_to: AssignedDocRec.pertains_to,
          form_id: AssignedDocRec.form_id,
          fields,
          sections,
          stage: 'fill'
        }, true);
        return;
      }
      let CompletedDocRec = await getDb({
        Key: {
          client_id: state.session.client_id,
          document_id: reactData.document_id
        },
        TableName: "CompletedDocuments"
      });
      if (CompletedDocRec) {
        window.open(
          CompletedDocRec.file_location,
          CompletedDocRec.title,
          `name=${CompletedDocRec.title}, left=${20}, top=${20}`
        );
        handleAbort();
      }
    }
    // if we got here, there was no existing document found with the passed in document_id
    // or no document_id was passed in at all.  
    // In either case, try to create a new document from the form_id
    if (reactData.form_id) {
      const { fields, sections, document_title } = await initializeDoc({
        form_id: reactData.form_id,
        pertains_to: options.person_id || state.session.patient_id,
      });
      let nowTime = new Date().getTime();
      updateReactData({
        document_id: `${state.session.patient_id}_${reactData.form_id}_${nowTime}`,
        pertains_to: options.person_id || state.session.patient_id,
        document_title,
        fields,
        sections,
        stage: 'fill'
      }, true);
      return;
    }
  }

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


  console.log({
    isInitializing: isInitializing(),
    stage: reactData.stage,
    title: reactData.document_title
  });
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
              <React.Fragment
                key={`sectionFrag__${sectionObj.section_name}`}
              >
                <Typography
                  key={`section__${sectionObj.section_name}`}
                  style={AVATextStyle({
                    size: 1.3, bold: true, margin: {
                      bottom: 1,
                      top: ((sectionNdx === 0) ? 1 : 3),
                    }
                  })}>
                  {sectionObj.section_name}
                </Typography>
                {sectionObj.fields.map((this_field, fieldNdx) => (
                  <Box
                    key={`parentFrag__${this_field}`}
                    display='flex'
                    flexDirection='column'
                    id={`sigBox__${this_field}`}
                    justifyContent='flex-start'
                    marginTop={2}
                    marginBottom={2}
                    alignItems='flex-start'
                    width='97%'
                  >
                    {reactData.fields.hasOwnProperty(this_field) &&
                      <React.Fragment
                        key={`fieldFrag__${this_field}`}
                      >
                        {(reactData.fields[this_field].type === 'text') &&
                          <TextField
                            id={`field__${this_field}`}
                            key={`field__${this_field}`}
                            className={classes.inputDisplay}

                            disabled={reactData.fields[this_field].options.viewOnly}
                            style={AVATextStyle({
                              lineHeight: 1,
                              width: `${reactData.fields[this_field].prompt.width || 200}px`,
                              maxWidth: '90%',
                              minWidth: '80%',
                              size: 0.75,
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
                            key={`field__${fieldNdx}_${(reactData.fields[this_field] && reactData.fields[this_field].valueText)
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
                              if (event.relatedTarget) {
                                event.relatedTarget.focus({ focusVisible: true });
                                if (event.relatedTarget.type !== 'button') {
                                  event.relatedTarget.click();
                                }
                              }
                            }}
                            helperText={reconcilePrompt({
                              rawValue: reactData.fields[this_field].prompt.value,
                              this_field
                            })}
                          />
                        }
                        {((reactData.fields[this_field].type === 'date')
                          || (reactData.fields[this_field].type === 'time')) &&
                          <TextField
                            id={`field__${fieldNdx}`}
                            className={classes.inputDisplay}
                            disabled={reactData.fields[this_field].options.viewOnly}
                            autoComplete='off'
                            key={`field__${fieldNdx}_${(reactData.fields[this_field] && reactData.fields[this_field].value)
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
                              if (event.relatedTarget) {
                                event.relatedTarget.focus({ focusVisible: true });
                                if (event.relatedTarget.type !== 'button') {
                                  event.relatedTarget.click();
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
                            key={`sigBox__${this_field}`}
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
                              key={`sigBoxText__${this_field}`}
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
                            key={`selectParent-${this_field}`}
                            id={`selectParent-${this_field}`}
                            width={`${reactData.fields[this_field].prompt.width || 200}px`}
                            flexGrow={1}
                            marginBottom={0}
                            justifyContent='flex-start'
                            alignItems='flex-start'
                          >
                            <Box
                              key={`selectBox-${this_field}`}
                              display='flex' marginLeft={1} flexGrow={1} flexDirection='column'
                            >
                              <Select
                                options={reactData.peopleList[reactData.fields[this_field].choose.ref]}
                                searchBy={'label'}
                                dropdownHandle={true}
                                clearOnSelect={true}
                                clearOnBlur={true}
                                key={`selectOptions-${this_field}`}
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
                                key={`selectPromptBox-${this_field}`}
                              >
                                <Typography
                                  key={`selectPrompt-${this_field}`}
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
                    }
                  </Box>
                ))}
              </React.Fragment>
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
              <Button
                onClick={async () => {
                  const document_id = reactData.document_id || `${state.session.patient_id}_${reactData.form_id}_${new Date().getTime()}`;
                  let response = await handleSave({
                    document_id,
                    final: false
                  });
                  updateReactData({
                    document_id,
                    recWritten: response.recWritten,
                    savePending: true,
                  }, true);
                }}
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'lightcyan', color: 'black' }}
                size='small'
              >
                {'Save/Continue'}
              </Button>
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
              <PrintIcon
                classes={{ root: classes.rowButton }}
                size='medium'
                aria-label="penciladd_icon"
                onClick={async () => {
                  await printWIP({ document_id: reactData.document_id });
                }}
                edge="start"
              />
            </Box>
          </Box>
        </React.Fragment>
      }
      {(reactData.stage === 'confirm') &&
        <AVAConfirm
          promptText={reactData.messageList}
          cancelText={'Go back'}
          confirmText={(reactData.errorsOnForm)
            ? '*none*'
            : 'Save'
          }
          onCancel={() => {
            updateReactData({
              stage: 'fill'
            }, true);
          }}
          onConfirm={async () => {
            let response = await handleSave({
              document_id: reactData.document_id,
              final: true
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
                  document_status: 'complete',
                  recWritten: response.recWritten
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
            if (reactData.savePending) {
              onClose('docAdded',
                {
                  document_id: reactData.document_id,
                  document_title: reactData.document_title,
                  document_status: 'work_in_process',
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
    </Dialog>
  );

};
