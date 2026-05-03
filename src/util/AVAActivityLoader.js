
import { getObservationOptions, getObservationItems, makeObservationList } from '../util/AVAObservations';
import { getMemberList, prepareTargets } from '../util/AVAGroups';
import { recordExists, isObject, resolveVariables, makeArray, dbClient, deepCopy, makeObj } from '../util/AVAUtilities';

let sessionState;
let checkbox = true;
let ignore = false;
let required = false;
let rowTestArray = [];
let multiColumn = false;
let displayBold = false;
let displayStyle = false;
let displayItalic = false;
let doneWithTopBox = false;
const defaultCheckedWords = ['checked', 'on', 'selected', 'true', 'always'];

export async function getActivityDetail(pActRec, state) {
  sessionState = state;
  if (pActRec.preLoad_code) {
    let preLoaded = await dbClient
      .get({
        Key: {
          client_id: sessionState.session.client_id,
          preLoad_key: pActRec.preLoad_code
        },
        TableName: "PreLoads",
      })
      .promise()
      .catch(error => {
        console.log({ 'Bad get on PreLoads - caught error is': error });
      });
    if (recordExists(preLoaded)) {
      return preLoaded.Item.preLoad_data;
    }
  }
  let [global_default_value, global_default_object] = await prepareDefaults(pActRec);
  let resolvedActivity = await makeObservationList(pActRec.activity_rec || pActRec.activity_code, sessionState.session, global_default_object);
  resolvedActivity.activityRec.name = await resolveVariables(pActRec.activity_name, sessionState.session);
  resolvedActivity.activityRec.default_value = global_default_value;
  resolvedActivity.activityRec.default_object = global_default_object;
  return resolvedActivity;
};

export async function prepareDefaults(fact) {
  let excludeList = ['reservation', 'play_video'];
  let returnArray = [];
  let returnObject = {};
  if (!fact.default_value) { return [returnArray, returnObject]; }
  if (excludeList.includes(fact.activity_rec?.type) || excludeList.includes(fact.type)) {
    return [fact.default_value, { default: fact.default_value }];
  }
  if (fact.activity_rec?.type === 'make_message') {

  }

  // check for default values in the person's record
  if (sessionState.patient.hasOwnProperty('defaultValues')) {
    let pDefaults = sessionState.patient.defaultValues;
    for (let key in pDefaults) {
      returnArray.push(`private~${key}=${pDefaults[key]}`);
    }
  }
  // now pull in default values associated with this specific function call
  let defaultValues = {};
  if (isObject(fact.default_value)) {
    defaultValues = Object.assign({}, fact.default_value);
  }
  else {
    // old style is a string of key/value pairs (in the form key=value) separated by " ~ "
    let dArray = makeArray(fact.default_value, /\s*~|~\s*/g);
    dArray.forEach((d, x) => {
      console.log(d);
      if (isObject(d)) {
        Object.assign(defaultValues, d);
      }
      else if (d.includes('=')) {
        let dO = d.split('=');
        defaultValues[dO[0]] = dO[1];
      }
      else {
        // a value may not be in the form key=value; in this case, just use value
        defaultValues[`_key_${x}`] = d;
      }
    });
  }
  for (let dField in defaultValues) {
    let dValue = await resolveDefaults(fact, dField, defaultValues[dField]);
    // we're returning an array and an object, they are duplicates of one another and consumed as needed by their targets
    // each entry is a default value which could be:
    //     a string alone (as in "myDefault")
    //     a string with some field name (as in "requestType=myDefault")
    //     an object (as in {requestType: myDefault, peopleList: [person1, person2, ...], ...})
    let rKey;
    let k = dField.match(/_key_(.*)/);
    if (k) {          // if no field name was specified
      rKey = `d${k[1]}`;
    }
    else {
      rKey = (dField.split('.')).pop();
    }
    returnObject[rKey] = dValue;
    if (typeof dValue !== 'string') {
      returnArray.push({ [rKey]: dValue });
    }
    else {
      returnArray.push(`${k ? '' : (rKey + '=')}${dValue}`);
    }
  }
  return [returnArray, returnObject];
}

export async function resolveDefaults(fact, this_key, this_value) {
  if (typeof (this_value) !== 'string') {
    let workObj = deepCopy(this_value);
    for (let aKey in workObj) {
      workObj[aKey] = await resolveDefaults(fact, aKey, workObj[aKey]);
    }
    workObj = await specialCases(this_key, workObj);
    return workObj;
  }
  let a = this_value.split('.');
  // if there are two or more "." in the value, use the value itself 
  if (a.length > 2) {
    return this_value;
  }
  let dValue = await resolveVariables(a.pop(), sessionState.session, { ignoreArrayCheck: true });
  // if anything remains in array a (after the pop above), the value was in the form instruction=value
  // we'll act as per that instruction here
  if (a.length > 0) {
    dValue = await specialCases(a[0], dValue);
  }
  return dValue;

  async function specialCases(key, dValue) {
    switch (key) {
      case 'people': {
        let factClient;
        if (fact.activity_rec.client_id) { factClient = fact.activity_rec.client_id; }
        else if (fact.activity_code.includes('//')) { factClient = fact.activity_code.split('//')[0]; }
        else { factClient = sessionState.client_id; }
        dValue = await getMemberList(makeArray(dValue, ','), factClient, { sort: true, shortList: true });
        break;
      }
      case 'person': {
        if (dValue === 'patientRec') {
          dValue = sessionState.patient;
        }
        else if (dValue === 'userRec') {
          dValue = sessionState.user;
        }
        else {
          dValue = {
            'peopleList': [sessionState.patient]
          };
        }
        break;
      }
      case 'select': {
        if (dValue === 'accessList') {
          dValue = {
            'selectionList': sessionState.accessList[sessionState.session.client_id].shortList
          };
        }
        else if (sessionState.patients) {
          dValue = sessionState.patients;
        }
        else {
          let targetObj = await prepareTargets(sessionState.session.patient_id, sessionState.session.client_id, { includeGroups: true });
          dValue = targetObj.responsibleList.sort();
        }
        break;
      }
      case 'events': {
        if (!sessionState.hasOwnProperty('calendar')) {
          return { loadError: true };
        }
        else {
          dValue = deepCopy(sessionState.calendar);
        }
        break;
      }
      case 'activities': {
        // activities dValue is an object with
        //     global_defaults - pass to every column
        //     column_list - an array with info about each column to return
        //          response entries will be resolved activities (with observation records prepared as per the instructions in the array element)
        //          each element is an object with
        //              activity_id - optional; if missing use the activity_id that this is a part of
        //              column_defaults - add these to the global defaults when resolving and handling the activity
        let responseArray = [];
        let global_defaults = dValue.global_defaults;
        if (!dValue.hasOwnProperty('column_list') || (dValue.column_list.length === 0)) {
          let column_defaults = Object.assign({}, global_defaults);
          let column_object = deepCopy(await makeObservationList(fact.activity_code, sessionState.session, column_defaults));
          column_object.column_defaults = column_defaults;
          responseArray.push(column_object);
        }
        else {
          for (let m = 0; m < dValue.column_list.length; m++) {
            let column_defaults = Object.assign({}, global_defaults, dValue.column_list[m].column_defaults);
            let column_object = deepCopy(await makeObservationList(dValue.column_list[m].activity_id, sessionState.session, column_defaults));
            column_object.column_defaults = column_defaults;
            responseArray.push(column_object);
          }
        }
        dValue = responseArray;
        break;
      }
      default: {
        if (key && (typeof (dValue) === 'string') && (key !== 'default')) {
          dValue = `${key}.${dValue}`;
        }
      }
    }
    return dValue;
  }
}

export async function buildDisplayRows(listValues, defaults, qualifiers) {
  // Reset module-level state so successive calls start clean
  checkbox = true;
  ignore = false;
  required = false;
  rowTestArray = [];
  multiColumn = false;
  displayBold = false;
  displayStyle = false;
  displayItalic = false;
  doneWithTopBox = false;

  let displayRowList = [];
  for (let vIndex = 0; vIndex < listValues.length; vIndex++) {
    // All rows are evaluated as follows "<instruction[0]>~<instruction[1]>:<instruction[2]>"
    // OR... "<instruction[0]>~~<instruction[1]>" (instruction[0] expected to be null/blank in this case)
    let oValueObject = {};
    let t = listValues[vIndex].split(/={|}/);
    if (t.length > 1) {
      oValueObject = makeObj(t[1]);
      listValues[vIndex] = listValues[vIndex].replace(`{${t[1]}}`, '<OBJ>');
    }
    let instruction = listValues[vIndex].split(/[~:]+/);
    // console.log(instruction);

    // This checks for rows that contain "~[<oControl>=<oValue on/off>]"
    let observationDefaultValue = '';
    let last_instruction = instruction[instruction.length - 1];
    if (last_instruction.charAt(0) === '[') {
      let [, oControl, oValue] = last_instruction.split(/[=[\]]+/);
      switch (oControl) {
        case 'checkbox': {    // checkbox default state is true; this allows you to toggle it off/on
          checkbox = (oValue.toLowerCase() === 'on');
          break;
        }
        case 'display_if': 
        case 'displayif': 
        case 'displayIF': { 
          rowTestArray.push({ test: oValue, type: 'display' });
          break;
        }
        case 'ignore_if':
        case 'ignoreif':
        case 'ignoreIF': {
          rowTestArray.push({ test: oValue, type: 'ignore' });
          break;
        }
        case 'end_if':
        case 'endif':
        case 'endIF': {
          rowTestArray.pop();
          break;
        }
        case 'noOp': {
          doneWithTopBox = true;
          break;
        }
        case 'display': {
          ignore = (oValue.toLowerCase() === 'off');
          break;
        }
        case 'multiColumn': {
          multiColumn = (oValue.toLowerCase() === 'off');
          break;
        }
        case 'required': {
          required = (oValue.toLowerCase() === 'on');
          break;
        }
        case 'bold': {
          displayBold = (oValue.toLowerCase() === 'on');
          break;
        }
        case 'style': {
          if (oValue.toLowerCase() === 'off') {
            displayStyle = false;
          }
          else if (oValue === '<OBJ>') {
            displayStyle = oValueObject;
          }
          else {
            displayStyle = oValue;
          }
          break;
        }
        case 'italics':
        case 'italic': {
          displayItalic = (oValue.toLowerCase() === 'on');
          break;
        }
        case 'default': {
          observationDefaultValue = oValue;
          break;
        }
        default: { }
      }
      instruction.pop();
      if ((instruction.length === 0) || ((instruction.length === 1) && !instruction[0])) { continue; }
    }

    if (ignore) { continue; }

    if ((vIndex !== 0) && (checkbox || (!instruction[0] && !instruction[2]))) {
      // this is either a checkbox or a header
      doneWithTopBox = true;
    }

    // This handles any row without a leading "~"
    // These are checkboxes UNLESS a previous [checkbox=off] instruction is still in effect
    if (instruction[0]) {
      let docRows;
      let rObj = {
        checkbox,
        isChecked: false,
        noUpdate: false,
        required,
        rowTest: deepCopy(rowTestArray),
        multiColumn,
        text: instruction[0],
        observationKey: getKey(instruction[0]),
        desc: getQualifier(instruction[0], 'description'),
        fee: getQualifier(instruction[0], 'fee'),
        input: false,
        bold: displayBold,
        style: displayStyle,
        italic: displayItalic
      };
      if (vIndex !== 0 && !doneWithTopBox) {
      }
      else {
        // default the checkbox to checked if either:
        //   a previous instruction set the default for all checkboxes to ON (~[default=checked]), OR
        //   a passed in default for this item instructs AVA to set the checkbox ON
        if ((defaults.hasOwnProperty(instruction[0]) && defaultCheckedWords.includes(defaults[instruction[0]])) // this item is checked off by default
          || (defaultCheckedWords.includes(observationDefaultValue))) {  // this item is checked off because this instruction had a modifier such as [default=checked]
          // [rObj.qualSelections, rObj.qualData, docRows] = await buildQualifiers(rObj.observationKey);  // see if there any any qualifiers for this item
          let qualResponse = await buildQualifiers(rObj.observationKey);  // see if there any any qualifiers for this item
          rObj.qualSelections = deepCopy(qualResponse.selections);
          rObj.qualData = deepCopy(qualResponse.data);
          rObj.moreInfo = deepCopy(qualResponse.moreInfo);
          rObj.isChecked = true;
          if (qualResponse.docLines) {
            docRows = deepCopy(qualResponse.docLines)
          }
          else {
            if ((defaults.hasOwnProperty(instruction[0]) && (defaults[instruction[0]] === 'always')) // this item is checked off by default
              || (observationDefaultValue === 'always')) { 
              rObj.noUpdate = true;
            }
          }
        }
      }
      displayRowList.push(rObj);
      if (docRows) {
        displayRowList.push({
          checkbox: false,
          isChecked: false,
          required: false,
          rowTest: deepCopy(rowTestArray),
          multiColumn,
          text: docRows,
          observationKey: null,
          desc: null,
          input: 'docLines',
          bold: false,
          style: false,
          italic: false
        });
      }
      continue;
    }

    // Dropping through to here means that instruction[0] was null/blank
    //    (ie. there was nothing before the first "~"; the row started with "~")
    // This handles rows in the form "~<instruction[1]>:<instruction[2]>[row_qualifier]", for example
    //     "~lambda:<instruction[2]>" or 
    //     "~prompt:Notes for the server"
    //     "~other:Notes for the server"
    //     "~promptAll:Table Number"
    //     "~obo:Request is for whom?"
    //     "~signature:Sign here"
    //     "~date:What date[noFuture]"
    if (instruction[2]) {
      let splitInstruction = instruction[2].split('[');
      let this_instruction = splitInstruction[0].trim();
      let this_qualifier;
      if (splitInstruction.length > 1) {
        this_qualifier = splitInstruction[1].replace(']', '');
      }
      let rObj = {
        checkbox: false,
        required,
        rowTest: deepCopy(rowTestArray),
        multiColumn: false,
        text: this_instruction,
        textValue: defaults[this_instruction],
        obo_line: ((defaults.obo || defaults.onBehalfOf) === this_instruction),
        location_line: (defaults[this_instruction] && (defaults[this_instruction] === '[person.location]')),
        observationKey: instruction[3] || getKey(this_instruction),
        desc: getQualifier(this_instruction, 'description'),
        fee: getQualifier(this_instruction, 'fee'),
        input: instruction[1].trim().toLowerCase(),
        header: false,
        row_qualifier: this_qualifier
      };
      if (instruction[1].trim().toLowerCase() === 'signature') {
        rObj.isChecked = true;
        rObj.required = true;
      }
      displayRowList.push(rObj);
      if (observationDefaultValue) {
        defaults[this_instruction] = observationDefaultValue;
      }
      continue;
    }

    // Dropping through to here means that instruction[2] was also null/blank
    //      so the row looked like "~<instruction[1]>" or "~~<instruction[1]>"
    // Turns out, this is a header line in instruction[1]
    displayRowList.push({
      checkbox: false,
      required: false,
      rowTest: deepCopy(rowTestArray),
      multiColumn: false,
      text: instruction[1],
      observationKey: getKey(instruction[1]),
      desc: getQualifier(instruction[1], 'description'),
      fee: getQualifier(instruction[1], 'fee'),
      input: false,
      header: true
    });
    if (observationDefaultValue) {
      defaults[instruction[1]] = observationDefaultValue;
    }
  };
  return displayRowList;

  function getKey(pText) {
    if (qualifiers.hasOwnProperty(pText) && qualifiers[pText].qualifiers) {
      let qKey = qualifiers[pText].qualifiers.find(q => { return (q.startsWith('~~key=')); });
      if (qKey) { return qKey.substr(6); }
    }
    return null;
  }

  function getQualifier(pText, pQual) {
    if (qualifiers.hasOwnProperty(pText)) {
      return qualifiers[pText][pQual];
    }
    else {
      return null;
    }
  }
}

let rememberedQualifiers = {};
export async function buildQualifiers(qKey) {
  if (!qKey) {
    return [{}, {}];
  }
  if (!rememberedQualifiers[qKey]) {
    rememberedQualifiers[qKey] = {
      selections: {},
      data: {},
      moreInfo: {}
    };
    let docLineList = [];
    let oItem = await getObservationItems(qKey);
    if (oItem) {
      for (let prop in oItem) {
        if (prop === 'options') {
          rememberedQualifiers[qKey].data = await getObservationOptions(oItem.options.observation_key);
          oItem.options.display_value.forEach(v => {
            if (v.default) {
              rememberedQualifiers[qKey].selections[v.title] = {};
              makeArray(v.default).forEach(dVal => {
                rememberedQualifiers[qKey].selections[v.title][dVal] = true;
              });
            }
          });
        }
        else if (prop.startsWith('doc_line')) {
          docLineList[Number(prop.split(':')[1])] = oItem[prop].display_value;
        }
        else if (prop !== 'observation_name') {
          if (oItem[prop].display_value) {
            rememberedQualifiers[qKey].moreInfo[prop] = oItem[prop].display_value;
          }
          else if (oItem[prop].value) {
            rememberedQualifiers[qKey].moreInfo[prop] = `${oItem[prop].value}${oItem[prop].uom || ''}`;
          }
          else {
            rememberedQualifiers[qKey].moreInfo[prop] = ' ';
          }
        }
      }
    }
    rememberedQualifiers[qKey].docLines = docLineList.join('');
  }
  // return [rememberedQualifiers[qKey].selections, rememberedQualifiers[qKey].data, rememberedQualifiers[qKey].docLines];
  return rememberedQualifiers[qKey];
}