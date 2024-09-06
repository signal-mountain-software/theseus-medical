import React from 'react';

import { dbClient, cl, recordExists, deepCopy, makeArray, s3, isEmpty } from '../../util/AVAUtilities';
import { AVAclasses, AVATextStyle, AVADefaults } from '../../util/AVAStyles';
import { formatPhone, makeName } from '../../util/AVAPeople';
import { makeDate } from '../../util/AVADateTime';
import AVAConfirm from './AVAConfirm';
import { getGroupMembers } from '../../util/AVAGroups';
import SignatureCanvas from 'react-signature-canvas';
import Select from "react-dropdown-select";
import { useGeolocated } from "react-geolocated";

import { SearchPlaceIndexForPositionCommand, LocationClient } from '@aws-sdk/client-location';
import { withAPIKey } from '@aws/amazon-location-utilities-auth-helper';

import Box from '@material-ui/core/Box';
import CloseIcon from '@material-ui/icons/Close';
import { Dialog, DialogActions, DialogContent } from '@material-ui/core';
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
    minWidth: '100px',
    maxWidth: '80%',
    marginTop: theme.spacing(2),
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
      let [key, value] = req.split('=');
      options[key] = value;
    });
  }
  else if (typeof (request) === 'string') {
    options.form_id = request;
  }
  else {
    options = Object.assign({}, request);
  }

  const [reactData, setReactData] = React.useState({
    form_id: options.form_id,
    formRec: {},
    peopleList: {},
    initialized: false,
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
    cl({ 'reactData before': JSON.stringify(reactData).length });
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    cl({ 'reactData after': JSON.stringify(reactData).length });
    if (force) {
      cl({ 'forceRedisplay before': forceRedisplay });
      setForceRedisplay(!forceRedisplay);
      cl({ 'forceRedisplay after': forceRedisplay });
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
      let textResponse = 'at';
      let netAccuracy = response.Results[0].Distance + accuracy;
      if (netAccuracy > 10) {
        let calcAccuracyFeet = netAccuracy * 3.28;
        if (calcAccuracyFeet > 1000) {
          textResponse = `within ${Math.round((calcAccuracyFeet / 5280) * 10) / 10} miles of`;
        }
        else {
          textResponse = `within ${Math.round(calcAccuracyFeet)} feet of`;
        }
      }
      textResponse += ` ${response.Results[0].Place.Label}`;
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
    if (reactData.formRec.fields[this_field].choose) {
      if (!reactData.peopleList.hasOwnProperty(reactData.formRec.fields[this_field].choose.ref)) {
        default_peopleList = await getGroupMembers({
          group_id: reactData.formRec.fields[this_field].choose.ref,
          short: true
        });
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
      else {
        default_peopleList = reactData.peopleList[reactData.formRec.fields[this_field].default.ref];
      }
    }
    if (!reactData.formRec.fields[this_field].default) {
      return '';
    }
    let defaultText = '';
    let defaultValue;
    let default_source = reactData.formRec.fields[this_field].default.source;
    if (!default_source) {
      defaultText = (reactData.formRec.fields[this_field].default.ref || '');
    }
    else {
      switch (default_source) {
        case 'form': {
          if (!reactData?.document.hasOwnProperty(reactData.formRec.fields[this_field].default.ref)) {
            let documentsObj = await loadDocument({
              form_id: reactData.formRec.fields[this_field].default.ref,
              recent: true
            });
            updateReactData({
              document: documentsObj
            }, true);
          }
          if ((!reactData.document[reactData.formRec.fields[this_field].default.ref])
            || (!reactData.document[reactData.formRec.fields[this_field].default.ref][this_field])) {
            // no op - no default specified for this field, or no default value available from the form
          }
          else {
            defaultText = reactData.document[reactData.formRec.fields[this_field].default.ref][this_field];
            if (Array.isArray(defaultText)) {   // special handling here for checkbox selections
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
            }
            else if (reactData.formRec.fields[this_field].default.type === 'phone') {
              defaultText = formatPhone(defaultText);
              defaultValue = `+1${defaultText.replace(/\D/g, '')}`;
            }
            else if (reactData.formRec.fields[this_field].default.type === 'date') {
              let defaultDate = makeDate(defaultText, { noTime: true, noYearCorrection: true });
              if (defaultDate.error) {
                return '';
              }
              defaultText = defaultDate.absolute;
              defaultValue = defaultDate.numeric$;
            }
            else if (reactData.formRec.fields[this_field].default.type === 'time') {
              let defaultDate = makeDate(defaultText, { noYearCorrection: true });
              if (defaultDate.error) {
                return '';
              }
              defaultText = defaultDate.absolute;
              defaultValue = defaultDate.timestamp;
            }
            else if (reactData.formRec.fields[this_field].default.type === 'id') {
              defaultValue = reactData?.document[reactData.formRec.fields[this_field].default.ref][this_field];
              if (reactData.formRec.fields[this_field].choose) {
                let foundPerson = default_peopleList.find(person => {
                  return (person.person_id === defaultValue);
                });
                if (foundPerson) {
                  defaultText = foundPerson.display_name;
                }
              }
              else {
                defaultText = await makeName(defaultValue);
              }
            }
          }
          break;
        }
        case 'date': {
          let defaultDate = makeDate(reactData.formRec.fields[this_field].default.ref, { noTime: true, noYearCorrection: true });
          if (defaultDate.error) {
            return '';
          }
          defaultText = defaultDate.absolute;
          defaultValue = defaultDate.numeric$;
          break;
        }
        case 'time': {
          let defaultDate = makeDate(reactData.formRec.fields[this_field].default.ref, {});
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
          let defaultSelections = makeArray(reactData.formRec.fields[this_field].default.ref);
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
          switch (reactData.formRec.fields[this_field].default.ref) {
            case 'display_name': {
              defaultText = `${state[recordID]?.name?.first} ${state[recordID]?.name?.last}`;
              break;
            }
            case 'phone': {
              let phone = state[recordID]?.messaging?.voice || state[recordID]?.messaging?.sms;
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
              defaultText = state[recordID][reactData.formRec.fields[this_field].default.ref] || '';
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
          defaultText = state.patient.local_data[reactData.formRec.fields[this_field].default.ref] || '';
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
          defaultText = (reactData.formRec.fields[this_field].default.ref || '');
        }
      }
    }
    if (reactData.formRec.fields[this_field].prompt.ignore_if) {
      let ignoreList = makeArray(reactData.formRec.fields[this_field].prompt.ignore_if);
      if ((ignoreList.includes('%%no_data%%') && !defaultText)
        || (ignoreList.some(ignore_me => {
          return (Array.isArray(defaultValue) ? defaultValue.includes(ignore_me) : (defaultValue === ignore_me));
        }))) {
        delete reactData.formRec.fields[this_field];
        return;
      }
    }
    if (reactData.formRec.fields[this_field].prompt.ref.includes('%%default%%')) {
      reactData.formRec.fields[this_field].prompt.ref =
        reactData.formRec.fields[this_field].prompt.ref.replace('%%default%%', defaultText);
      //  updateReactData will be called once to refresh formRec after all makeDefault calls are complete
    }
    if (defaultText && (reactData.formRec.fields[this_field].value.type !== 'view')) {
      handleChangeText({
        newText: defaultText,
        newValue: defaultValue,
        prop: this_field
      });
    }
  };

  const getDirection = (degrees, isLongitude) =>
    degrees > 0 ? (isLongitude ? "E" : "N") : isLongitude ? "W" : "S";

  const formatDegrees = (degrees, isLongitude) =>
    `${0 | degrees}° ${0 | (((degrees < 0 ? (degrees = -degrees) : degrees) % 1) * 60)
    }' ${0 | (((degrees * 60) % 1) * 60)}" ${getDirection(
      degrees,
      isLongitude,
    )}`;

  const handleChangeText = ({ newText, newValue, prop, sentenceCase }) => {
    if (sentenceCase && (newText.length === 1)) {
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
    tempObj.value = newValue || newText;
    updateReactValues({
      [prop]: tempObj
    }, true);
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

  const handleChangeValue = ({ newList, prop, }) => {
    let tempObj = {};
    if (reactValues.hasOwnProperty(prop)) {
      tempObj = deepCopy(reactValues[prop]);
    }
    else {
      tempObj = deepCopy(reactValues.defaultObj);
    }
    tempObj.valueList = newList;
    tempObj.value = newList;
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
                  handleChangeText({
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

  const handleSave = async () => {
    let documentRec = {
      client_id: state.session.client_id,
      form_id: reactData.form_id,
      person_id: state.patient.person_id,
      completed_by: state.session.user_id,
      completed_timestamp: new Date().getTime()
    };
    documentRec.document_id = `${documentRec.person_id}%%${documentRec.form_id}%%${documentRec.completed_timestamp}`;
    documentRec.values = {};
    delete reactValues.defaultObj;
    let putError = [];
    for (let this_field in reactValues) {
      if (reactData.formRec.fields[this_field].value.type === 'signature') {
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
    return { goodPut: (putError.length === 0), putError };
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

  async function loadDocument({ recent, form_id, specific_document }) {
    let queryObj = { TableName: 'Documents' };
    queryObj.KeyConditionExpression = 'client_id = :c';
    queryObj.ExpressionAttributeValues = { ':c': state.session.client_id };
    if (!form_id || (form_id === 'recent')) {
      form_id = reactData.form_id;
    }
    if (recent) {   // recent refers to the most recent version of the requested form
      queryObj.KeyConditionExpression += ' and begins_with(document_id, :dID)';
      queryObj.ExpressionAttributeValues[':dID'] = `${state.patient.person_id}%%${form_id}%%`;
      queryObj.ScanIndexForward = false;
      queryObj.Limit = 1;
    }
    else if (specific_document) {   // something other than most recent version
      queryObj.KeyConditionExpression += ' and document_id = :dID';
      let splitDoc = specific_document.split('%%');
      if (splitDoc.length === 1) {
        queryObj.ExpressionAttributeValues[':dID'] = `${state.patient.person_id}%%${form_id}%%${splitDoc[0]}`;
      }
      else if (splitDoc.length === 2) {
        form_id = splitDoc[0];
        queryObj.ExpressionAttributeValues[':dID'] = `${state.patient.person_id}%%${splitDoc[0]}%%${splitDoc[1]}`;
      }
      else {
        form_id = splitDoc[1];
        queryObj.ExpressionAttributeValues[':dID'] = `${splitDoc[0]}%%${splitDoc[1]}%%${splitDoc[2]}`;
      }
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
    if (recent && (form_id === reactData.form_id)) {
      documentsObj.recent = queryResult.Items[0].values;
    }
    else {
      documentsObj[form_id] = queryResult.Items[0].values;
    }
    return documentsObj;
  };

  React.useEffect(() => {
    async function initialize() {
      let user_fontSize = AVADefaults({ fontSize: 'get' }) || 1.5;
      let response = await loadForm(reactData.form_id);
      let documentsObj = await loadDocument({ recent: true });
      updateReactData({
        formRec: response,
        document: documentsObj || { recent: {} }
      }, true);
      for (let sN = 0; sN < reactData.formRec.sections.length; sN++) {
        let this_section = reactData.formRec.sections[sN];
        for (let fN = 0; fN < this_section.fields.length; fN++) {
          await makeDefault(this_section.fields[fN]);
        }
      }
      console.log(reactValues);
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
  }, [reactData.form_id]);  // eslint-disable-line react-hooks/exhaustive-deps

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
              {reactData.formRec.form_name}
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
                            value={(reactValues[this_field] && reactValues[this_field].valueText)
                              ? reactValues[this_field].valueText
                              : ''
                            }
                            onChange={(event) => {
                              handleChangeText({
                                newText: event.target.value,
                                prop: this_field,
                                sentenceCase: true
                              });
                            }}
                            helperText={reactData.formRec.fields[this_field].prompt.ref}
                          />
                        }
                        {(reactData.formRec.fields[this_field].value.type === 'phone') &&
                          <TextField
                            id={`field__${fieldNdx}`}
                            className={classes.inputDisplay}
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
                                handleChangeText({
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
                          />
                        }
                        {((reactData.formRec.fields[this_field].value.type === 'date')
                          || (reactData.formRec.fields[this_field].value.type === 'time')) &&
                          <TextField
                            id={`field__${fieldNdx}`}
                            className={classes.inputDisplay}
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
                                  handleChangeText({
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
                          <Box
                            display='flex'
                            flexDirection='column'
                            id={`sigBox__${this_field}`}
                            key={`sigBox__${this_field}`}
                            justifyContent='flex-start'
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
                              {signatureRef.current && !signatureRef.current.isEmpty() &&
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
                                    handleChangeText({
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
                              <Button
                                className={AVAClass.AVAButton}
                                key={`geoButton-${this_field}`}
                                style={(Object.assign({}, {
                                  maxWidth: '150px',
                                  textWrap: 'wrap'
                                },
                                  reactData.formRec.fields[this_field].prompt?.options?.button || {}
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
                                    newText = "Device doesn't support location ID"
                                  }
                                  else if (!isGeolocationEnabled) {
                                    newText = `User blocked location ID`;
                                  }
                                  else {
                                    newText = await reverseGeo({
                                      latitude: coords.latitude,
                                      longitude: coords.longitude,
                                      accuracy: coords.accuracy
                                    })
                                    newValue = {
                                      latitude: coords.latitude,
                                      longitude: coords.longitude,
                                      speed: coords.speed,
                                    };
                                  }
                                  newValue.timestamp = new Date().getTime();
                                  handleChangeText({
                                    newText,
                                    newValue,
                                    prop: this_field
                                  });
                                }}
                              >
                                {reactData.formRec.fields[this_field].prompt.ref}
                              </Button>
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
                                      width: `${reactData.formRec.fields[this_field].prompt.width || 200}px`,
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
          <DialogActions className={classes.buttonArea} >
            <Button
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'red', color: 'white' }}
              size='small'
              onClick={() => {
                updateReactData({
                  stage: 'exit'
                }, true);
              }}
              startIcon={<CloseIcon fontSize="small" />}
            >
              {'Exit'}
            </Button>
            <Button
              onClick={async () => {
                await handleReview();
                console.log(reactData);
                console.log(forceRedisplay);
              }}
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'green', color: 'white' }}
              size='small'
            >
              {'Finish'}
            </Button>
          </DialogActions>
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
            console.log(reactValues);
            let response = await handleSave();
            if (!response.goodPut) {
              updateReactData({
                stage: 'error',
                errorMessage: response.putError
              }, true);
            }
            else {
              onClose();
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
            onClose();
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
