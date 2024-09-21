import React from 'react';

import { dbClient, cl, recordExists, deepCopy, makeArray, s3, isEmpty, isObject } from '../../util/AVAUtilities';
import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';
import { formatPhone, makeName, getPerson, getImage } from '../../util/AVAPeople';
import { makeDate } from '../../util/AVADateTime';
import AVAConfirm from './AVAConfirm';
import { getGroupMembers } from '../../util/AVAGroups';
import SignatureCanvas from 'react-signature-canvas';
import Select from "react-dropdown-select";
import { useGeolocated } from "react-geolocated";

import { SearchPlaceIndexForPositionCommand, LocationClient } from '@aws-sdk/client-location';
import { withAPIKey } from '@aws/amazon-location-utilities-auth-helper';

import Box from '@material-ui/core/Box';
import CloseIcon from '@material-ui/icons/HighlightOff';
import { Dialog, DialogContent } from '@material-ui/core';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import Checkbox from '@material-ui/core/Checkbox';
import { FormGroup, FormControlLabel, FormControl, FormLabel } from '@material-ui/core';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';

import useSession from '../../hooks/useSession';

const useStyles = makeStyles(theme => ({
  dialogBox: {
    paddingTop: 0,
    paddingLeft: 0,
    paddingBottom: theme.spacing(1),
    overflowX: 'hidden',
    marginLeft: theme.spacing(2),
  },
  radius_rounded: {
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
  const signatureRef = React.useRef(null);

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
    options.form_id = request;
  }
  else {
    options = Object.assign({}, request);
  }
  if (!options.form_id && options.document_id) {
    let docParts = options.document_id.split('%%');
    options.form_id = docParts[1];
  }

  /* 
   if options.changeMode, then
     - expect options.document_id
     - the form_id comes from the document_id (person %% form_id %% version)
     - all defaults in form_id are ignored; values from incoming document_id are used as defaults
     - if saved, add replaced_by = <new document_id> to the incoming document_id and update that document

   if options.viewMode, then
     - expect options.document_id
     - the form_id comes from the document_id (person %% form_id %% version)
     - all fields rendered in view mode, including signature
     - do not show "save" button

 */

  const [reactData, setReactData] = React.useState({
    form_id: options.form_id,
    formRec: {},
    peopleList: {},
    initialized: false,
    storedSignature: null,
    stage: 'initialize',
    version__number: 0,
    document: {},
    values: {
      sampleField: {
        valueList: [],
        valueText: ''
      }
    }
  });

  const [reactValues, setReactValues] = React.useState({
    defaultObj: {
      valueList: [],
      valueText: '',
      value: ''
    }
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

  const updateReactValues = (newData, force = false) => {
    setReactValues((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) {
      setForceRedisplay(!forceRedisplay);
    }
  };

  const {
    coords,
    getPosition,
    isGeolocationAvailable,
    isGeolocationEnabled,
    positionError,
  } = useGeolocated({
    positionOptions: {
      enableHighAccuracy: true,
    },
    userDecisionTimeout: 5000,
    watchLocationPermissionChange: true,
  });

  const reverseGeo = async ({ latitude, longitude, accuracy }) => {
    const authHelper =
      await withAPIKey("v1.public.eyJqdGkiOiJiOTFjN2E0My1mZTNlLTQxMzctYTIyMy00YWI2YTE2NjUxZDUifToPc5592CrSHhW1JSbATtnjGoJDzqJYD-7AK7ExQpcAtmfRb-ofIy9TciExqtsveXreYKYPBoGKj8IIpESh8jhu8WcHmPHzYyPwjdMLEj2oc78daTQeGqw41QI-okSYoUMVCRBwO9eGiLsU2adjFXwSNlcs85lz_XAaYLAAKZODPOFTKk4sgI2kJ5queq9aHj4HjOOJfPwWmJZAqP-oTs2TLp-N95yBVllyU7-_6S3QXOI97rSAy5ABj-7fJMZTtXRrb6zw6sv8pJPKjZegaeM8V2oP4fQBMC4bC746aYaNT6SiVtTzIU8tdmrYgHmgkzbSxw_VZSp-UF8_OQIiNwQ.ZWU0ZWIzMTktMWRhNi00Mzg0LTllMzYtNzlmMDU3MjRmYTkx");
    const locationClient = new LocationClient({
      region: "us-east-1",
      ...authHelper.getLocationClientConfig() // sets up the Location client to use the API Key defined above
    });
    let response = await locationClient.send(new SearchPlaceIndexForPositionCommand({
      IndexName: "explore.place.Here", // Place index resource to use
      Position: [longitude, latitude], // position to search near
      MaxResults: 3 // number of results to return
    }));
    if (!response || !response.Results || (response.Results.length === 0)) {
      return `at ${formatDegrees(latitude, false)}, ${formatDegrees(longitude, true)}`;
    }
    else {
      let selectedResponse = response.Results.find(result => {
        return (result.Place.AddressNumber);
      });
      if (!selectedResponse) {
        selectedResponse = response.Results[0];
      }
      let textResponse = 'At';
      let netAccuracy = selectedResponse.Distance + accuracy;
      if (netAccuracy > 10) {
        let calcAccuracyFeet = netAccuracy * 3.28;
        if (calcAccuracyFeet > 1000) {
          textResponse = `Within ${Math.round((calcAccuracyFeet / 5280) * 10) / 10} miles of`;
        }
        else {
          textResponse = `Within ${Math.round(calcAccuracyFeet)} feet of`;
        }
      }
      textResponse += ` ${selectedResponse.Place.Label} ${makeDate(new Date()).oaDate}`;
      return textResponse;
    }
  };

  // **************************

  const makeDefault = async (this_field) => {
    if (!reactData.formRec.fields.hasOwnProperty(this_field)) {
      cl(`${this_field} missing from Form entry`);
      return '';
    }
    let default_peopleList;
    let defaultText = '';
    let defaultValue;
    let default_source, default_ref;
    if (reactData.formRec.fields[this_field].choose) {
      if (!reactData.peopleList.hasOwnProperty(reactData.formRec.fields[this_field].choose.ref)) {
        if (reactData.formRec.fields[this_field].choose.ref.startsWith('%%resp')) {
          if (!state.session.responsible_for || (state.session.responsible_for.length === 0)) {
            default_peopleList = await getGroupMembers({
              groupList: state.user.person_id,
              short: true
            });
          }
          else {
            default_peopleList = await getGroupMembers({
              groupList: [...state.session.responsible_for, state.user.person_id],
              short: true
            });
          }
        }
        else {
          default_peopleList = await getGroupMembers({
            group_id: reactData.formRec.fields[this_field].choose.ref,
            short: true
          });
        }
        if (default_peopleList && (default_peopleList.length > 0)) {
          reactData.peopleList[reactData.formRec.fields[this_field].choose.ref] =
            default_peopleList.map(person => {
              return {
                value: person.person_id,
                label: person.display_name
              };
            });
          updateReactData({
            peopleList: reactData.peopleList
          }, false);
        }
      }
      else {
        default_peopleList = reactData.peopleList[reactData.formRec.fields[this_field].choose.ref];
      }
    }
    if (!reactData.formRec.fields[this_field].default && !options.changeMode && !options.viewMode && !options.incompleteMode) {
      return '';   // there is no default specified for this field (in change mode, ignore this - use value instead)
    }
    if (reactData.formRec.fields?.[this_field]?.default?.ref === 'image') {
      default_source = reactData.formRec.fields[this_field].default.source;
      default_ref = 'image';
    }
    else if (options.changeMode || options.viewMode || options.incompleteMode) {
      default_source = 'form';
      default_ref = reactData.form_id;
    }
    else {
      default_source = reactData.formRec.fields[this_field].default.source;
      if (reactData.formRec.fields[this_field].default.ref === 'recent') {
        default_ref = reactData.form_id;
      }
      else {
        default_ref = reactData.formRec.fields[this_field].default.ref;
      }
    }
    if (reactData.formRec.fields?.[this_field]?.default
      && reactData.formRec.fields?.[this_field]?.default.hasOwnProperty('assigned_to')) {
      default_ref += reactData.formRec.fields[this_field].default.assigned_to;
    }
    if (!default_source) {
      defaultText = (default_ref || '');
    }
    else {
      switch (default_source) {
        case 'form': {
          if (!reactData?.document.hasOwnProperty(default_ref)) {
            let documentsObj;
            if (reactData.formRec.fields[this_field].default.hasOwnProperty('assigned_to')) {
              let [this_form, this_assignTo] = default_ref.split('%%');
              if (this_assignTo === 'person_id') {
                this_assignTo = state.patient.person_id;
                default_ref = `${this_form}%%${state.patient.person_id}`;
              }
              documentsObj = await loadDocument({
                form_id: this_form,
                assigned_to: this_assignTo,
                recent: true
              });
            }
            else {
              documentsObj = await loadDocument({
                form_id: default_ref,
                recent: true
              });
            }
            updateReactData({
              document: documentsObj
            }, true);
          }
          if ((!reactData.document[default_ref])
            || (!reactData.document[default_ref][this_field])) {
            // no op - the refererenced form doesn't exist, or this field has no value on that form
            handleChangeValue({
              newList: [],
              prop: this_field
            });
          }
          else {
            if (isObject(reactData.document[default_ref][this_field])) {
              defaultText = reactData.document[default_ref][this_field].textDescription;
            }
            else {
              defaultText = reactData.document[default_ref][this_field];
            }
            let defaultType = reactData.formRec.fields[this_field]?.default?.type;
            if (!defaultType) {
              defaultType = reactData.formRec.fields[this_field]?.value?.type;
            }
            if (Array.isArray(defaultText)) {
              defaultType = 'selection';
            }
            switch (defaultType) {
              case 'selection': {   // special handling here for checkbox selections
                if (reactData.formRec.fields[this_field].value.type.includes('view')) {
                  defaultValue = defaultText;
                  defaultText = defaultText.join('; ');
                }
                else {
                  if (reactData.formRec.fields[this_field].prompt.ref.includes('%%default%%')) {
                    reactData.formRec.fields[this_field].prompt.ref =
                      reactData.formRec.fields[this_field].prompt.ref.replace('%%default%%', defaultText.join('; '));
                  }
                  if (reactData.formRec.fields[this_field].prompt.ignore_if) {
                    let ignoreList = makeArray(reactData.formRec.fields[this_field].prompt.ignore_if);
                    if ((ignoreList.includes('%%no_data%%') && (defaultText.length === 0))
                      || (ignoreList.some(ignore_me => {
                        return defaultText.includes(ignore_me);
                      }))) {
                      delete reactData.formRec.fields[this_field];
                      return;
                    }
                  }
                  if (defaultText.length === 0) {
                    return '';
                  }
                  let defaultSelections = defaultText;
                  let defaultSelectionList = [];
                  let bonusList = [];
                  let selectionList = reactData.formRec.fields[this_field]?.value?.selection?.selectionList || [];
                  defaultSelections.forEach(this_selection => {
                    if (selectionList.includes(this_selection)) {
                      defaultSelectionList.push(this_selection);
                    }
                    else {
                      bonusList.push(this_selection);
                    }
                  });
                  if (bonusList.length > 0) {
                    handleChangeListText({
                      newText: bonusList.join('; '),
                      prop: this_field
                    });
                  }
                  if (defaultSelectionList.length === 0) {
                    return '';
                  }
                  handleChangeValue({
                    newList: defaultSelectionList,
                    prop: this_field
                  });
                  return defaultSelectionList;
                }
                break;
              }
              case 'signature': {
                updateReactData({
                  storedSignature: reactData.document[default_ref][this_field]
                }, false);
                defaultText = `${reactData.formRec.fields[this_field].prompt.ref}: ${defaultText}`;
                defaultValue = reactData.document[default_ref][this_field];
                break;
              }
              case 'geolocation': {
                defaultText = `${reactData.formRec.fields[this_field].prompt.ref}: ${defaultText}`;
                defaultValue = reactData.document[default_ref][this_field];
                break;
              }
              case 'phone': {
                defaultText = formatPhone(defaultText);
                defaultValue = `+1${defaultText.replace(/\D/g, '')}`;
                break;
              }
              case 'date': {
                let defaultDate = makeDate(defaultText, { noTime: true, noYearCorrection: true });
                if (defaultDate.error) {
                  return '';
                }
                defaultText = defaultDate.absolute;
                defaultValue = defaultDate.numeric$;
                break;
              }
              case 'time': {
                let defaultDate = makeDate(defaultText, { noYearCorrection: true });
                if (defaultDate.error) {
                  return '';
                }
                defaultText = defaultDate.absolute;
                defaultValue = defaultDate.timestamp;
                break;
              }
              case 'id': {
                defaultValue = reactData?.document[default_ref][this_field];
                if ((reactData.formRec.fields[this_field].choose)
                  && !options.viewMode) {
                  let foundPerson = default_peopleList.find(person => {
                    return (person.person_id === defaultValue);
                  });
                  if (foundPerson) {
                    defaultText = foundPerson.display_name;
                  }
                  else {
                    defaultText = '';
                    defaultValue = '';
                  }
                }
                else {
                  defaultText = await makeName(defaultValue);
                }
                break;
              }
              default: { }
            }
          }
          break;
        }
        case 'date': {
          let defaultDate = makeDate(default_ref, { noTime: true, noYearCorrection: true });
          if (defaultDate.error) {
            return '';
          }
          defaultText = defaultDate.absolute;
          defaultValue = defaultDate.numeric$;
          break;
        }
        case 'time': {
          let defaultDate = makeDate(default_ref, {});
          if (defaultDate.error) {
            return '';
          }
          defaultText = defaultDate.absolute;
          defaultValue = defaultDate.timestamp;
          break;
        }

        case 'selection':
        case 'selections':
        case 'values':
        case 'value': {
          let defaultSelections = makeArray(default_ref);
          if (defaultSelections.length === 0) {
            return '';
          }
          let defaultSelectionList = [];
          let bonusList = [];
          defaultSelections.forEach(this_selection => {
            if (reactData.formRec.fields[this_field].value.selection.selectionList.includes(this_selection)) {
              defaultSelectionList.push(this_selection);
            }
            else {
              bonusList.push(this_selection);
            }
          });
          if (bonusList.length > 0) {
            handleChangeListText({
              newText: bonusList.join('; '),
              prop: this_field
            });
          }
          if (defaultSelectionList.length === 0) {
            return '';
          }
          handleChangeValue({
            newList: defaultSelectionList,
            prop: this_field
          });
          return defaultSelectionList;
        }
        case 'user':
        case 'person':
        case 'session':
        case 'userRec':
        case 'sessionRec':
        case 'personRec': {
          let recordID = 'patient';
          if (default_source.startsWith('user')) {
            recordID = 'user';
          }
          else if (default_source.startsWith('session')) {
            recordID = 'session';
          }
          switch (default_ref) {
            case 'display_name': {
              if (recordID === 'patient') {
                defaultText = `${reactData.selectedPersonRec.name?.first} ${reactData.selectedPersonRec.name?.last}`;
              }
              else {
                defaultText = `${state[recordID]?.name?.first} ${state[recordID]?.name?.last}`;
              }
              break;
            }
            case 'image': {
              if (recordID === 'patient') {
                defaultText = getImage(reactData.selectedPersonRec.person_id);
              }
              else {
                defaultText = getImage(state[recordID]?.person_id);
              }
              break;
            }
            case 'phone': {
              let phone;
              if (recordID === 'patient') {
                phone = reactData.selectedPersonRec?.messaging?.voice || reactData.selectedPersonRec?.messaging?.sms;
              }
              else {
                phone = state[recordID]?.messaging?.voice || state[recordID]?.messaging?.sms;
              }
              if (phone) {
                defaultText = formatPhone(phone);
                defaultValue = `+1${defaultText.replace(/\D/g, '')}`;
              }
              else {
                return '';
              }
              break;
            }
            default: {
              if (recordID === 'patient') {
                defaultText = reactData.selectedPersonRec[default_ref] || '';
              }
              else {
                defaultText = state[recordID][default_ref] || '';
              }
              if ((reactData.formRec.fields[this_field].default.type === 'date') && defaultText) {
                let defaultDate = makeDate(defaultText, { noTime: true, noYearCorrection: true });
                if (defaultDate.error) {
                  return '';
                }
                defaultText = defaultDate.absolute;
                defaultValue = defaultDate.numeric$;
              }
              else if ((reactData.formRec.fields[this_field].default.type === 'time') && defaultText) {
                let defaultDate = makeDate(defaultText, {});
                if (defaultDate.error) {
                  return '';
                }
                defaultText = defaultDate.absolute;
                defaultValue = defaultDate.timestamp;
              }
              else if ((reactData.formRec.fields[this_field].default.type === 'phone') && defaultText) {
                defaultText = formatPhone(defaultText);
                defaultValue = `+1${defaultText.replace(/\D/g, '')}`;
              }
            }
          }
          break;
        }
        case 'local': {
          defaultText = state.patient.local_data[default_ref] || '';
          if ((reactData.formRec.fields[this_field].default.type === 'date') && defaultText) {
            let defaultDate = makeDate(defaultText, { noTime: true, noYearCorrection: true });
            if (defaultDate.error) {
              return '';
            }
            defaultText = defaultDate.absolute;
            defaultValue = defaultDate.numeric$;
          }
          else if ((reactData.formRec.fields[this_field].default.type === 'phone') && defaultText) {
            defaultText = formatPhone(defaultText);
            defaultValue = `+1${defaultText.replace(/\D/g, '')}`;
          }
          break;
        }
        default: {
          defaultText = (default_ref || '');
        }
      }
    }
    if (reactData.formRec.fields[this_field].prompt.ignore_if) {
      let ignoreList = makeArray(reactData.formRec.fields[this_field].prompt.ignore_if);
      if ((ignoreList.includes('%%no_data%%') && (!defaultText || (defaultText.trim() === '')))
        || (ignoreList.some(ignore_me => {
          return (Array.isArray(defaultValue) ? defaultValue.includes(ignore_me) : (defaultValue === ignore_me));
        }))) {
        delete reactData.formRec.fields[this_field];
        return;
      }
    }
    if (reactData.formRec.fields[this_field]?.prompt?.ref
      && reactData.formRec.fields[this_field].prompt.ref.includes('%%default%%')
    ) {
      reactData.formRec.fields[this_field].prompt.ref =
        reactData.formRec.fields[this_field].prompt.ref.replace('%%default%%', defaultText);
    }
    handleChangeValue({
      newText: defaultText,
      newValue: defaultValue,
      prop: this_field
    });
  };

  const getDirection = (degrees, isLongitude) =>
    degrees > 0 ? (isLongitude ? "E" : "N") : isLongitude ? "W" : "S";

  const formatDegrees = (degrees, isLongitude) =>
    `${0 | degrees}° ${0 | (((degrees < 0 ? (degrees = -degrees) : degrees) % 1) * 60)
    }' ${0 | (((degrees * 60) % 1) * 60)}" ${getDirection(
      degrees,
      isLongitude,
    )}`;

  const handleChangeValue = ({ newText, newValue, newList, prop, sentenceCase }) => {
    if (sentenceCase && newText && (newText.length === 1)) {
      newText = newText.toUpperCase();
    }
    let tempObj = {};
    if (reactValues.hasOwnProperty(prop)) {
      tempObj = deepCopy(reactValues[prop]);
    }
    else {
      tempObj = deepCopy(reactValues.defaultObj);
    }
    tempObj.valueText = newText;
    tempObj.valueList = newList;
    tempObj.value = newValue || newList || newText;
    updateReactValues({
      [prop]: tempObj
    }, true);
    if (reactData.formRec.fields[prop].value.assign_to) {
      updateReactData({
        assign_to: tempObj.value
      }, true);
    }
  };

  const handleChangeListText = ({ newText, prop }) => {
    let tempObj = {};
    if (reactValues.hasOwnProperty(prop)) {
      tempObj = deepCopy(reactValues[prop]);
    }
    else {
      tempObj = deepCopy(reactValues.defaultObj);
    }
    tempObj.bonusText = newText;
    updateReactValues({
      [prop]: tempObj
    }, true);
  };

  const handleClick = (props) => {
    if (!reactValues[props.prop]) {
      if (!props.forceClickOff) {
        reactValues[props.prop] = {
          valueList: [props.clickText]
        };
      }
    }
    else if (!reactValues[props.prop].hasOwnProperty('valueList')) {
      if (!props.forceClickOff) {
        reactValues[props.prop].valueList = [props.clickText];
      }
    }
    else {
      if (props.ogText) {
        let ogAt = reactValues[props.prop].valueList.indexOf(props.ogText);
        if (ogAt > -1) {
          reactValues[props.prop].valueList.splice(ogAt, 1);
        }
      }
      if (!reactValues[props.prop].valueList) {
        reactValues[props.prop].valueList = [];
      }
      let foundAt = reactValues[props.prop].valueList.indexOf(props.clickText);
      if (foundAt < 0) {
        reactValues[props.prop].valueList.push(props.clickText);
        if (reactData.formRec.fields[props.prop].value.selection.max) {
          if (reactValues[props.prop].valueList.length > reactData.formRec.fields[props.prop].value.selection.max) {
            reactValues[props.prop].valueList.shift();
          }
        }
      }
      else {
        if (!props.forceClickOn) {
          if (reactData.formRec.fields[props.prop].value.selection.min) {
            if (reactValues[props.prop].valueList.length > reactData.formRec.fields[props.prop].value.selection.min) {
              reactValues[props.prop].valueList.splice(foundAt, 1);
            }
          }
          else {
            reactValues[props.prop].valueList.splice(foundAt, 1);
          }
        }
      }
    }
    handleChangeValue({
      newList: reactValues[props.prop].valueList,
      prop: props.prop
    });
  };

  // **************************

  const AVACheckBoxGroup = (props) => {
    // props should contain
    //   prop
    //   text - an array of options, each can independently go true or false
    return (
      <FormControl className={classes.formControlCheckGroup} component="fieldset">
        <FormLabel className={classes.formControlTitle}>
          {reactData.formRec.fields[props.prop].prompt.ref}
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
                  disabled={options.viewMode}
                  size='small'
                  checked={reactValues[props.prop]?.valueList && reactValues[props.prop].valueList.includes(text)}
                  onClick={() => {
                    handleClick({
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
          {reactData.formRec.fields[props.prop].value.type.includes('other') &&
            <FormControlLabel
              className={classes.formControlDays}
              key={`${props.prop}_other`}
              control={
                <Checkbox
                  aria-label={`${props.prop}_other`}
                  name={`${props.prop}_other`}
                  key={`CheckGroup__${props.prop}_other`}
                  size='small'
                  disabled={options.viewMode}
                  checked={reactValues[props.prop]?.valueList && reactValues[props.prop].valueList.includes(reactValues[props.prop].valueText)}
                  onClick={() => {
                    handleClick({
                      clickText: reactValues[props.prop].valueText,
                      prop: props.prop
                    });
                  }}
                  disableRipple
                  inputProps={{ 'aria-labelledby': `message_routing_3` }}
                />
              }
              label={<TextField
                style={AVATextStyle({
                  lineHeight: 1,
                  padding: { bottom: 0 },
                  size: 0.75,
                  margin: { top: 0.5, bottom: 0.5, left: -0.3, right: 3 }
                })}
                className={classes.radioDays}
                autoComplete='off'
                id={`${props.prop}_otherText`}
                defaultValue={(reactValues[props.prop] && reactValues[props.prop].valueText)
                  ? reactValues[props.prop].valueText
                  : ''
                }
                onBlur={(event) => {
                  let ogText = ((reactValues[props.prop] && reactValues[props.prop].valueText)
                    ? reactValues[props.prop].valueText
                    : ''
                  );
                  handleChangeValue({
                    newText: event.target.value,
                    prop: props.prop,
                    sentenceCase: false
                  });
                  if (!reactValues[props.prop].valueText) {
                    handleClick({
                      clickText: '',
                      prop: props.prop,
                      ogText,
                      forceClickOff: true
                    });
                  }
                  else {
                    handleClick({
                      clickText: reactValues[props.prop].valueText,
                      prop: props.prop,
                      ogText,
                      forceClickOn: true
                    });
                  }
                  if (event.relatedTarget) {
                    event.relatedTarget.focus({ focusVisible: true });
                    if (event.relatedTarget.type !== 'button') {
                      event.relatedTarget.click();
                    }
                  }
                }}
                helperText={reactData.formRec.fields[props.prop].prompt.other || 'Other'}
              />}
              labelPlacement='right'
            />
          }
          {reactData.formRec.fields[props.prop].value.type.includes('text') &&
            <FormControlLabel
              className={classes.formControlDays}
              key={`${props.prop}_other`}
              control={
                <TextField
                  style={AVATextStyle({
                    lineHeight: 1,
                    padding: { bottom: 0 },
                    size: 0.75,
                    margin: { top: 0, bottom: 0.5, left: 0.5, right: 3 }
                  })}
                  className={classes.radioDays}
                  autoComplete='off'
                  disabled={options.viewMode}
                  id={`${props.prop}_otherText`}
                  defaultValue={(reactValues[props.prop] && reactValues[props.prop].bonusText)
                    ? reactValues[props.prop].bonusText
                    : ''
                  }
                  onBlur={(event) => {
                    handleChangeListText({
                      newText: event.target.value,
                      prop: props.prop,
                    });
                    if (event.relatedTarget) {
                      event.relatedTarget.focus({ focusVisible: true });
                      if (event.relatedTarget.type !== 'button') {
                        event.relatedTarget.click();
                      }
                    }
                  }}
                  helperText={reactData.formRec.fields[props.prop].prompt.other || 'Other'}
                />
              }
            />
          }
        </FormGroup>
      </FormControl>
    );
  };

  // **************************

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  const handleAbort = () => {
    onClose();
  };

  const handleReview = async () => {
    let messageList = ['There are problems with this form'];
    let errorFields = [];
    reactData.formRec.sections.forEach(this_section => {
      this_section.fields.forEach(this_field => {
        if (reactData.formRec.fields.hasOwnProperty(this_field)) {
          if (reactData.formRec.fields[this_field].value.type === 'signature') {
            if (signatureRef.current.isEmpty()) {
              if (reactData.formRec.fields[this_field].value.required) {
                messageList.push(`Signature is required`);
                errorFields.push(this_field);
              }
            }
            else {
              if (!reactValues.hasOwnProperty(this_field)) {
                reactValues[this_field] = {};
              }
              let sigImage = signatureRef.current.getTrimmedCanvas().toDataURL('image/png');
              reactValues[this_field].image = sigImage;
              reactValues[this_field].value = sigImage;
            }
          }
          else if (reactData.formRec.fields[this_field].value.required
            && (!reactValues.hasOwnProperty(this_field) || !reactValues[this_field].value)) {
            messageList.push(`${reactData.formRec.fields[this_field].prompt.ref} is required`);
            errorFields.push(this_field);
          }
          else if ((reactData.formRec.fields[this_field].value.type.startsWith('select'))
            && (reactData.formRec.fields[this_field].value?.selection?.min > 0)) {
            if (!reactValues.hasOwnProperty(this_field) || !reactValues[this_field].value || (reactValues[this_field].value.length === 0)) {
              messageList.push(`Please make a selection for ${reactData.formRec.fields[this_field].prompt.ref}`);
              errorFields.push(this_field);
            }
            else if (reactValues[this_field].value.length < reactData.formRec.fields[this_field].value.selection.min) {
              messageList.push(`You must make at least ${reactData.formRec.fields[this_field].value.selection.min} selections for ${reactData.formRec.fields[this_field].prompt.ref}`);
              errorFields.push(this_field);
            }
          }
        }
      });
    });
    if (errorFields.length === 0) {
      messageList = ['This form is complete!', 'Tap "Save" below to save it'];
    }
    updateReactData({
      messageList,
      errorFields,
      stage: 'confirm'
    }, true);
  };

  const handleSave = async ({ document_id, save_continue }) => {
    let documentRec = {
      client_id: state.session.client_id,
      completed_by: state.session.user_id,
    };
    if (reactData.assign_to) {
      documentRec.assigned_to = reactData.assign_to;
    }
    if (reactData.formRec.title) {
      let titleFields = reactData.formRec.title.split('%%');
      let results = '';
      titleFields.forEach(titleWord => {
        if (reactData.formRec.fields.hasOwnProperty(titleWord)) {
          results += ' ' + ((reactValues[titleWord] && reactValues[titleWord].valueText)
            ? reactValues[titleWord].valueText
            : reactData.formRec.fields[titleWord].defaultText
          );
        }
        else {
          results += ' ' + titleWord;
        }
      });
      documentRec.title = results;
    }
    if (document_id) {
      let docParts = document_id.split('%%');
      documentRec.form_id = docParts[1];
      documentRec.person_id = docParts[0];
      documentRec.completed_timestamp = docParts[2];
      documentRec.document_id = document_id;
    }
    else {
      documentRec.form_id = reactData.form_id;
      documentRec.person_id = options.person_id || state.patient.person_id;
      documentRec.completed_timestamp = new Date().getTime();
      documentRec.document_id = `${documentRec.person_id}%%${documentRec.form_id}%%${documentRec.completed_timestamp}`;
    }
    documentRec.incomplete = !!save_continue;
    documentRec.values = {};
    delete reactValues.defaultObj;
    let putError = [];
    for (let this_field in reactValues) {
      if (reactData.formRec.fields?.[this_field]?.value?.type === 'signature') {
        if (reactValues[this_field].image) {
          await s3
            .upload({
              Bucket: 'theseus-medical-storage',
              Key: `${documentRec.completed_by}_signature`,
              Body: reactValues[this_field].image,
              ACL: 'public-read-write',
              ContentType: 'image/png'
            })
            .promise()
            .catch(err => {
              putError.push(err);
            });
          documentRec.values[this_field] = reactValues[this_field].image;
          documentRec.signature_field = this_field;
        }
      }
      else if (reactValues[this_field].bonusText) {
        let valueArray = makeArray(reactValues[this_field].value);
        valueArray.push(reactValues[this_field].bonusText);
        documentRec.values[this_field] = valueArray;
      }
      else {
        documentRec.values[this_field] = reactValues[this_field].value;
      }
    }
    await dbClient
      .put({
        Item: documentRec,
        TableName: "Documents",
      })
      .promise()
      .catch(error => {
        console.log(`caught error updating Documents; error is:`, error);
        putError.push(error);
      });
    if (options.changeMode) {
      await dbClient
        .update({
          Key: {
            client_id: state.session.client_id,
            document_id: options.document_id
          },
          UpdateExpression: 'set #s = :s',
          ExpressionAttributeValues: {
            ':s': documentRec.document_id
          },
          ExpressionAttributeNames: {
            '#s': 'replaced_by'
          },
          TableName: "Documents",
        })
        .promise()
        .catch(error => {
          cl(`caught error updating Documents; error is: `, error);
        });
    }
    return {
      goodPut: (putError.length === 0),
      putError,
      document_id: documentRec.document_id
    };
  };

  // **************************

  async function loadForm(form_id) {
    let formRec = await dbClient
      .get({
        Key: {
          client_id: state.session.client_id,
          form_id
        },
        TableName: "Forms"
      })
      .promise()
      .catch(error => {
        cl(`***ERR reading Groups*** caught error is: ${error}`, form_id);
      });
    if (!recordExists(formRec)) {
      return {};
    }
    else {
      return formRec.Item;
    }
  }

  async function loadDocument({ recent, form_id, specific_document, assigned_to }) {
    let queryObj = { TableName: 'Documents' };
    queryObj.KeyConditionExpression = 'client_id = :c';
    queryObj.ExpressionAttributeValues = { ':c': state.session.client_id };
    if (!form_id || (form_id === 'recent')) {
      form_id = reactData.form_id;
    }
    if (recent && !assigned_to) {   // recent refers to the most recent version of the requested form
      queryObj.KeyConditionExpression += ' and begins_with(document_id, :dID)';
      queryObj.ExpressionAttributeValues[':dID'] = `${options.person_id || state.patient.person_id}%%${form_id}%%`;
      queryObj.ScanIndexForward = false;
      queryObj.Limit = 1;
    }
    else if (specific_document) {   // something other than most recent version
      queryObj.KeyConditionExpression += ' and document_id = :dID';
      let splitDoc = specific_document.split('%%');
      if (splitDoc.length === 1) {
        queryObj.ExpressionAttributeValues[':dID'] = `${options.person_id || state.patient.person_id}%%${form_id}%%${splitDoc[0]}`;
      }
      else if (splitDoc.length === 2) {
        form_id = splitDoc[0];
        queryObj.ExpressionAttributeValues[':dID'] = `${options.person_id || state.patient.person_id}%%${splitDoc[0]}%%${splitDoc[1]}`;
      }
      else {
        form_id = splitDoc[1];
        queryObj.ExpressionAttributeValues[':dID'] = `${splitDoc[0]}%%${splitDoc[1]}%%${splitDoc[2]}`;
      }
    }
    else if (assigned_to) {
      queryObj.IndexName = 'assigned_to-index';
      queryObj.KeyConditionExpression += ' and assigned_to = :a';
      queryObj.ExpressionAttributeValues[':a'] = `${assigned_to || state.patient.person_id}`;
      queryObj.ScanIndexForward = false;
    }
    let queryResult = await dbClient
      .query(queryObj)
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          cl(`Security Violation or no Internet Connection`);
        }
        cl(`Error reading ${queryObj.TableName} id ${error}`);
      });
    let documentsObj = deepCopy(reactData.document);
    if (!recordExists(queryResult)) {
      queryResult.Items = [{ values: {} }];
    }
    if (assigned_to) {
      if (queryResult.Items.length > 1) {
        queryResult.Items.sort((a, b) => {
          return ((a.completed_timestamp < b.completed_timestamp) ? 1 : -1);
        });
      }
      let foundIt = 0;
      let foundDoc = [{ values: {} }];
      queryResult.Items.forEach(this_document => {
        if ((this_document.completed_timestamp > foundIt)
          && (this_document.form_id === form_id)) {
          foundIt = this_document.completed_timestamp;
          foundDoc = this_document;
        }
      });
      queryResult.Items[0] = foundDoc;
      form_id += `%%${assigned_to}`;
    }
    documentsObj[form_id] = queryResult.Items[0].values;
    if (queryResult.Items[0].title) {
      documentsObj[form_id].document__title = queryResult.Items[0].title;
    }
    return documentsObj;
  };

  React.useEffect(() => {
    async function initialize() {
      let user_fontSize = AVADefaults({ fontSize: 'get' }) || 1.5;
      let response = await loadForm(reactData.form_id);
      if (isEmpty(response)) {
        onClose();
      }
      // do I have permission to update this form?
      if (response.hasOwnProperty('may_update')) {

      }
      let documentsObj;
      if ((options.changeMode || options.viewMode || options.incompleteMode) && options.document_id) {
        documentsObj = await loadDocument({
          specific_document: options.document_id,
        });
      }
      else {
        documentsObj = await loadDocument({
          recent: true
        });
      }
      let this_form = (documentsObj ? Object.keys(documentsObj)[0] : options.form_id);
      let selectedPersonRec;
      if (options.person_id) {
        selectedPersonRec = await getPerson(options.person_id);
      }
      else {
        selectedPersonRec = deepCopy(state.patient);
      }
      let reactObj = {
        form_id: this_form,
        formRec: response,
        selectedPersonRec,
        document: documentsObj || { [this_form]: {} }
      };
      if (options.incompleteMode) {
        reactObj.document_id = options.document_id;
      }
      updateReactData(reactObj, true);
      for (let sN = 0; sN < reactData.formRec.sections.length; sN++) {
        let this_section = reactData.formRec.sections[sN];
        for (let fN = 0; fN < this_section.fields.length; fN++) {
          await makeDefault(this_section.fields[fN]);
        }
      }
      updateReactData({
        formRec: reactData.formRec,   // makeDefault may have updated this
        user_fontSize,
        initialized: true,
        stage: 'fill'
      }, true);
      setForceRedisplay('ready');
    }
    if (reactData.stage === 'initialize') {
      initialize();
    }
  }, [reactData.form_id, reactData.document_id]);  // eslint-disable-line react-hooks/exhaustive-deps

  // **************************

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
              {reactData.document[reactData.form_id].document__title || reactData.formRec.form_name}
            </Typography>
          </Box>
          <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
            {reactData.formRec.sections.map((sectionObj, sectionNdx) => (
              <React.Fragment
                key={`sectionFrag__${sectionObj.section_name}`}
              >
                <Typography
                  key={`section__${sectionObj.section_name}`}
                  style={AVATextStyle({
                    size: 1.3, bold: true, margin: {
                      bottom: 1,
                      top: 1,
                    }
                  })}>
                  {sectionObj.section_name}
                </Typography>
                {sectionObj.fields.map((this_field, fieldNdx) => (
                  <React.Fragment
                    key={`parentFrag__${this_field}`}
                  >
                    {reactData.formRec.fields.hasOwnProperty(this_field) &&
                      <React.Fragment
                        key={`fieldFrag__${this_field}`}
                      >
                        {(reactData.formRec.fields[this_field].value.type === 'text') &&
                          <TextField
                            id={`field__${this_field}`}
                            key={`field__${this_field}`}
                            style={AVATextStyle({
                              lineHeight: 1,
                              width: `${reactData.formRec.fields[this_field].prompt.width || 200}px`,
                              maxWidth: '90%',
                              size: 0.75,
                              margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                            })}
                            disabled={options.viewMode}
                            autoComplete='off'
                            value={(reactValues[this_field] && reactValues[this_field].valueText)
                              ? reactValues[this_field].valueText
                              : ''
                            }
                            onChange={(event) => {
                              handleChangeValue({
                                newText: event.target.value,
                                prop: this_field,
                                sentenceCase: true
                              });
                            }}
                            helperText={reactData.formRec.fields[this_field].prompt.ref}
                          />
                        }
                        {(reactData.formRec.fields[this_field].value.type === 'image') &&
                          <Box
                            className={classes.imageArea}
                            component="img"
                            alt={''}
                            src={reactValues[this_field].valueText}
                          />
                        }
                        {(reactData.formRec.fields[this_field].value.type === 'phone') &&
                          <TextField
                            id={`field__${fieldNdx}`}
                            className={classes.inputDisplay}
                            autoComplete='off'
                            key={`field__${fieldNdx}_${(reactValues[this_field] && reactValues[this_field].valueText)
                              ? reactValues[this_field].valueText
                              : ''}`}
                            style={AVATextStyle({
                              lineHeight: 1,
                              width: `${reactData.formRec.fields[this_field].prompt.width || 200}px`,
                              size: 0.75,
                              padding: { bottom: 0 },
                              margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                            })}
                            defaultValue={(reactValues[this_field] && reactValues[this_field].valueText)
                              ? reactValues[this_field].valueText
                              : ''
                            }
                            onBlur={(event) => {
                              if (event.target.value) {
                                let fPhone = formatPhone(event.target.value);
                                handleChangeValue({
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
                            helperText={reactData.formRec.fields[this_field].prompt.ref}
                            disabled={options.viewMode}
                          />
                        }
                        {((reactData.formRec.fields[this_field].value.type === 'date')
                          || (reactData.formRec.fields[this_field].value.type === 'time')) &&
                          <TextField
                            id={`field__${fieldNdx}`}
                            className={classes.inputDisplay}
                            autoComplete='off'
                            key={`field__${fieldNdx}_${(reactValues[this_field] && reactValues[this_field].value)
                              ? reactValues[this_field].value
                              : ''}`}
                            style={AVATextStyle({
                              lineHeight: 1,
                              size: 0.75,
                              padding: { bottom: 0 },
                              margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                            })}
                            defaultValue={(reactValues[this_field] && reactValues[this_field].valueText)
                              ? reactValues[this_field].valueText
                              : ''
                            }
                            onBlur={(event) => {
                              if (event.target.value) {
                                let dObj = makeDate(event.target.value, { noTime: (reactData.formRec.fields[this_field].value.type === 'date'), noYearCorrection: true });
                                if (!dObj.error) {
                                  handleChangeValue({
                                    newText: dObj.absolute,
                                    newValue: ((reactData.formRec.fields[this_field].value.type === 'date')
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
                            helperText={reactData.formRec.fields[this_field].prompt.ref}
                            disabled={options.viewMode}
                          />
                        }
                        {(reactData.formRec.fields[this_field].value.type.startsWith('select')) &&
                          <Box
                            display='flex'
                            mb={0}
                            flexDirection='row'
                            justifyContent='flex-start'
                            alignItems='center'
                          >
                            <AVACheckBoxGroup
                              prop={this_field}
                              text={reactData.formRec.fields[this_field].value.selection.selectionList}
                            />
                          </Box>
                        }
                        {(reactData.formRec.fields[this_field].value.type.includes('view')) &&
                          <React.Fragment>
                            {((!reactData.formRec.fields[this_field].prompt.type)
                              || (reactData.formRec.fields[this_field].prompt.type === 'text')) &&
                              <Typography
                                id={`field__${fieldNdx}`}
                                key={`field__${fieldNdx}`}
                                style={AVATextStyle(Object.assign({}, {
                                  size: 1,
                                  margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 },
                                  minWidth: `${reactData.formRec.fields[this_field].prompt.width || 0}px`
                                },
                                  reactData.formRec.fields[this_field].prompt.options
                                ))}
                              >
                                {reactData.formRec.fields[this_field].prompt.ref}
                              </Typography>
                            }
                            {(reactData.formRec.fields[this_field].prompt.type === 'html') &&
                              <div
                                dangerouslySetInnerHTML={{ '__html': reactData.formRec.fields[this_field].prompt.ref }}
                              />
                            }
                            {(reactData.formRec.fields[this_field].prompt.type === 'image') &&
                              <img
                                className={classes.imageArea}
                                alt=''
                                src={reactData.formRec.fields[this_field].prompt.ref}
                              />
                            }
                            {(reactData.formRec.fields[this_field].prompt.type === 'url') &&
                              <a
                                href={reactData.formRec.fields[this_field].prompt.ref}
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
                                  <u>{reactData.formRec.fields[this_field].prompt.helper || `Tap here for ${reactData.formRec.fields[this_field].prompt.ref}`}</u>
                                </Typography>
                              </a>
                            }
                          </React.Fragment>
                        }
                        {(reactData.formRec.fields[this_field].value.type === 'signature') &&
                          (!options.viewMode) &&
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
                              ref={signatureRef}
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
                                width: `${reactData.formRec.fields[this_field].prompt.width || 200}px`,
                                maxWidth: '90%',
                                size: 0.75,
                                margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                              })}
                            >
                              {reactData.formRec.fields[this_field].prompt.ref}
                            </Typography>
                            <Box display='flex' mt={0} mb={0} flexWrap='wrap' flexDirection='row' justifyContent='center' alignItems='center'>
                              {signatureRef.current &&
                                <Button
                                  className={AVAClass.AVAMicroButton}
                                  style={{ backgroundColor: 'white', color: 'red' }}
                                  size='small'
                                  onClick={() => {
                                    signatureRef.current.clear();
                                    setForceRedisplay(!forceRedisplay);
                                  }}
                                >
                                  {'Clear'}
                                </Button>
                              }
                            </Box>
                          </Box>
                        }
                        {(reactData.formRec.fields[this_field].value.type === 'signature') &&
                          (options.viewMode) &&
                          <Box
                            display='flex'
                            flexDirection='column'
                            id={`sigBox__${this_field}`}
                            key={`sigBox__${this_field}`}
                            justifyContent='flex-start'
                            alignItems='flex-start'
                            width='97%'
                          >
                            <img
                              className={classes.imageArea}
                              alt=''
                              src={request.signatureImage}
                            />
                            <Typography
                              id={`sigBoxText__${this_field}`}
                              key={`sigBoxText__${this_field}`}
                              style={AVATextStyle({
                                lineHeight: 1,
                                width: `${reactData.formRec.fields[this_field].prompt.width || 200}px`,
                                maxWidth: '90%',
                                size: 0.75,
                                margin: { top: 0.5, bottom: 0.5, left: 0.5, right: 3 }
                              })}
                            >
                              {reactData.formRec.fields[this_field].prompt.ref}
                            </Typography>
                          </Box>
                        }

                        {(reactData.formRec.fields[this_field].value.type === 'id') &&
                          <Box
                            display='flex'
                            flexDirection='row'
                            key={`selectParent-${this_field}`}
                            id={`selectParent-${this_field}`}
                            width={`${reactData.formRec.fields[this_field].prompt.width || 200}px`}
                            flexGrow={1}
                            marginBottom={0}
                            justifyContent='flex-start'
                            alignItems='flex-start'
                          >
                            {(!options.viewMode) &&
                              <Box
                                key={`selectBox-${this_field}`}
                                display='flex' marginLeft={1} flexGrow={1} flexDirection='column'
                              >
                                <Select
                                  options={reactData.peopleList[reactData.formRec.fields[this_field].choose.ref]}
                                  searchBy={'label'}
                                  dropdownHandle={true}
                                  clearOnSelect={true}
                                  clearOnBlur={true}
                                  key={`selectOptions-${this_field}`}
                                  disabled={options.viewMode}
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

                                  noDataLabel={`No ${reactData.formRec.fields[this_field].prompt.ref}s match`}
                                  values={(reactValues[this_field] && reactValues[this_field].valueText)
                                    ? [{ label: reactValues[this_field].valueText, value: reactValues[this_field].value }]
                                    : []
                                  }
                                  placeholder={``}
                                  onChange={async (values) => {
                                    if (values.length > 0) {
                                      handleChangeValue({
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
                                      width: `${reactData.formRec.fields[this_field].prompt.width || 200}px`,
                                      maxWidth: '90%',
                                      size: 0.75,
                                      opacity: '60%',
                                      margin: { top: 0.25, bottom: 0.5, left: 0, right: 3 }
                                    })}
                                  >
                                    {reactData.formRec.fields[this_field].prompt.ref}
                                  </Typography>
                                </Box>
                              </Box>
                            }
                            {(options.viewMode) &&
                              <Box display='flex'
                                flexDirection='row'
                                marginLeft={1}
                                marginTop={-0.5}
                                key={`selectPromptBox-${this_field}`}
                              >
                                <Typography
                                  id={`geoButtonPrompt-${this_field}`}
                                  key={`geoButtonPrompt-${this_field}`}
                                  style={AVATextStyle({
                                    lineHeight: 1.2,
                                    width: `${reactData.formRec.fields[this_field].prompt.width || 300}px`,
                                    maxWidth: '90%',
                                    size: 1,
                                    bold: true,
                                    opacity: '60%',
                                    margin: { top: 0, bottom: 0, left: 0, right: 3 }
                                  })}
                                >
                                  {reactValues[this_field].valueText}
                                </Typography>
                              </Box>
                            }
                          </Box>
                        }
                        {(reactData.formRec.fields[this_field].value.type === 'geolocation') &&
                          <Box
                            display='flex'
                            flexDirection='row'
                            key={`geoButtonParent-${this_field}`}
                            id={`geoButtonParent-${this_field}`}
                            flexGrow={1}
                            marginBottom={0}
                            justifyContent='flex-start'
                            alignItems='flex-start'
                          >
                            <Box
                              key={`geoBox-${this_field}`}
                              display='flex' marginTop={1} flexGrow={1} flexDirection='column'
                            >
                              {!options.viewMode &&
                                <Button
                                  className={AVAClass.AVAButton}
                                  key={`geoButton-${this_field}`}
                                  style={(Object.assign({}, {
                                    maxWidth: '150px',
                                    textWrap: 'wrap'
                                  },
                                    reactData.formRec.fields[this_field].prompt?.options?.button || {},
                                    ((!!(reactValues[this_field] && reactValues[this_field].value))
                                      ? {
                                        color: (reactData.formRec.fields[this_field].prompt?.options?.button?.backgroundColor || 'blue'),
                                        backgroundColor: 'white'
                                      }
                                      : {}
                                    ),
                                  ))}
                                  size='small'
                                  width={`${reactData.formRec.fields[this_field].prompt.width || 50}px`}
                                  onClick={async () => {
                                    getPosition();
                                    let newText;
                                    let newValue = {};
                                    if (!isEmpty(positionError)) {
                                      newText = `Location Error ${JSON.stringify(positionError)}`;
                                    }
                                    else if (!isGeolocationAvailable) {
                                      newText = "Device doesn't support location ID";
                                    }
                                    else if (!isGeolocationEnabled) {
                                      newText = `User blocked location ID`;
                                    }
                                    else {
                                      newText = await reverseGeo({
                                        latitude: coords.latitude,
                                        longitude: coords.longitude,
                                        accuracy: coords.accuracy
                                      });
                                      newValue = {
                                        latitude: coords.latitude,
                                        longitude: coords.longitude,
                                        speed: coords.speed,
                                      };
                                    }
                                    newValue.timestamp = new Date().getTime();
                                    newValue.textDescription = newText;
                                    handleChangeValue({
                                      newText,
                                      newValue,
                                      prop: this_field
                                    });
                                  }}
                                >
                                  {reactData.formRec.fields[this_field].prompt.ref}
                                </Button>
                              }
                              {reactValues[this_field] && reactValues[this_field].value &&
                                <Box display='flex'
                                  flexDirection='row'
                                  marginLeft={1}
                                  marginTop={-0.5}
                                  key={`selectPromptBox-${this_field}`}
                                >
                                  <Typography
                                    id={`geoButtonPrompt-${this_field}`}
                                    key={`geoButtonPrompt-${this_field}`}
                                    style={AVATextStyle({
                                      lineHeight: 1,
                                      width: `${reactData.formRec.fields[this_field].prompt.width || 300}px`,
                                      maxWidth: '90%',
                                      size: 0.75,
                                      opacity: '60%',
                                      margin: { top: 0, bottom: 0.5, left: 0, right: 3 }
                                    })}
                                  >
                                    {reactValues[this_field].valueText}
                                  </Typography>
                                </Box>
                              }
                            </Box>
                          </Box>
                        }
                      </React.Fragment>
                    }
                  </React.Fragment>
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
                if (options.viewMode) {
                  onClose();
                }
                else {
                  updateReactData({
                    stage: 'exit'
                  }, true);
                }
              }}
              startIcon={<CloseIcon fontSize="small" />}
            >
              {'Exit'}
            </Button>
            {!options.viewMode &&
              <Box display='flex' flexDirection='row' justifyContent='flex-end' alignItems='center'>
                <Button
                  onClick={async () => {
                    let saveCallObj = {
                      save_continue: true
                    };
                    if (reactData.document_id) {
                      saveCallObj.document_id = reactData.document_id;
                    }
                    let response = await handleSave(saveCallObj);
                    updateReactData({
                      document_id: response.document_id,
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
              </Box>
            }
          </Box>
        </React.Fragment>
      }
      {(reactData.stage === 'confirm') &&
        <AVAConfirm
          promptText={reactData.messageList}
          cancelText={'Go back'}
          confirmText={(reactData.errorFields && (reactData.errorFields.length > 0))
            ? '*none*'
            : 'Save'
          }
          onCancel={() => {
            updateReactData({
              stage: 'fill'
            }, true);
          }}
          onConfirm={async () => {
            let saveCallObj = {
              save_continue: false
            };
            if (reactData.document_id) {
              saveCallObj.document_id = reactData.document_id;
            }
            let response = await handleSave(saveCallObj);
            if (!response.goodPut) {
              updateReactData({
                stage: 'error',
                errorMessage: response.putError
              }, true);
            }
            else {
              onClose('docAdded');
            }
          }}
        />
      }
      {(reactData.stage === 'exit') &&
        <AVAConfirm
          promptText={[`Are you sure you want to exit?`]}
          cancelText={`No, keep going`}
          confirmText={`Yes, exit`}
          onCancel={() => {
            updateReactData({
              stage: 'fill'
            }, true);
          }
          }
          onConfirm={async () => {
            onClose((reactData.savePending) ? 'docAdded' : '');
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
