import { getPerson, makeName } from '../util/AVAPeople';
import { makeDate } from '../util/AVADateTime';
import { getOccurenceList } from '../util/AVACalendars';
import { Lambda } from 'aws-sdk';

// NOTES -
// regex to split at the first instance of a character only (% used as example to split on): is .split(/%(.*)/)

const AWS = require('aws-sdk');
let iconObj = {};

const sak = () => {
  let keyList = [
    "nMJ$NnV$cA5-oPTC-j,%If?)UhFnl))hH$$^QGs>SkIAR2OYl`n3;Ap&(cHd}/pKM{ul^KaHat{%hyb^@@o+j(EftN9K768dM,O[",
    "[?oRnyvdNc:=4b5-Sy^==`35W41%A}|x2}b_}S#'%pO>-(Op6FjtrZDb:&[j(:y?53M,FTI{gIB?,7S*9DAW2G)Ibq4H[(WFtqo=",
    "-RKC(0^vR[u8]z*,Q`M98d?$#6b$;c<`<<1XOseJX&/BT$soC;ZT~n4FEF.d5,?H1#UC(c=x4K8MQkNFg$?tfU;&a#ssocLPMsx]",
    "8?7'@=wJ$3LF27=%2E_{1q?U7/Wdd424%0a-Y41^&b/dY(=BO(7ddn1-QgJrT|![&uKXEH5p-P'[Nh#R%I>qbpVpU]nmLdhWcXE>",
    "h5]$AK2akK$VkrPM~ynClNK_624AQ26xQG{z-Q]{tu*|vIf(26{G}oi9qls``Fe-WJwVhniEuQG:?Z%w:7Zjl)R7.w_mzq|hu$?5",
    "}QE*tYyZ]%5{L0{#KjiPJ-fyf<EEo?lWk`LcUo>h(:[3?.Uh^V/v{KSYETYeToF63C0;AQYhb,Kq-?N,C5]d{81{yp8Q]RP(y+0%"
  ];
  let id2 = '';
  let indexer = '4042553918914687589290481423614042529443';
  for (let i = 0; i < 30; i++) {
    let index = Number(indexer.slice(i, i + 1));
    if (index < 6) {
      let pos = Number(indexer.slice(i + 1, i + 3));
      let len = Number(indexer.slice(i + 3, i + 4));
      id2 += keyList[index].slice(pos, pos + len);
    }
  }
  return [id2.slice(0, 20), id2.slice(20, 60)];
};

export const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: sak()[0],
  secretAccessKey: sak()[1]
});

export const CognitoClient = new AWS.CognitoIdentityServiceProvider({
  region: "us-east-1"
});

export const s3 = new AWS.S3({
  accessKeyId: sak()[0],
  secretAccessKey: sak()[1]
});

export const elastictranscoder = new AWS.ElasticTranscoder({
  accessKeyId: sak()[0],
  secretAccessKey: sak()[1],
  region: "us-east-1"
});

const StepFunctions = require('aws-sdk/clients/stepfunctions');
export const stepFunctions = new StepFunctions({
  accessKeyId: sak()[0],
  secretAccessKey: sak()[1],
  region: "us-east-1"
});

export const lambda = new Lambda({
  region: 'us-east-1',
  accessKeyId: sak()[0],
  secretAccessKey: sak()[1],
});

export const cloudfront = new AWS.CloudFront({
  region: "us-east-1",
  accessKeyId: sak()[0],
  secretAccessKey: sak()[1],
});

export function recordExists(recordId) {
  if (!recordId) { return false; }
  if (recordId.hasOwnProperty('Count')) { return (recordId.Count > 0); }
  else { return ((recordId.hasOwnProperty("Item") || recordId.hasOwnProperty("Items"))); }
}

export async function getLocalWeather(client_weather = {
  "place_name": "AVA HQ",
  "nws_x": 21,
  "nws_y": 10,
  "nws_office": "MRX"
}) {
  let weather = await restAPI({
    hostname: 'api.weather.gov',
    path: `/gridpoints/${client_weather.nws_office}/${client_weather.nws_x},${client_weather.nws_y}/forecast`,
    method: 'GET',
    headers: {
      "User-Agent": "(AVASeniorConnect.com, rsteele@avaseniorconnect.com)"
    }
  }, '');
  if (!weather || weather.status || !weather.properties) {
    return `Forecast for ${client_weather.place_name} not available at this time`;
  }
  else {
    return `Forecast for ${client_weather.place_name} ${weather.properties.periods[0].name.toLowerCase()} - ${weather.properties.periods[0].detailedForecast}`;
  };
}

export async function getMarqueeMessage(client_id, options = {}) {
  let response = [];
  let urgentMessage;
  if (options.client_weather) {
    let weather = await getLocalWeather(options.client_weather);
    if (weather) {
      response.push({
        style: null,
        message: weather
      });
    }
  }
  let now = new Date().getTime();
  let mRecs = await dbClient
    .query({
      KeyConditionExpression: 'client_id = :c and end_time > :now',
      ExpressionAttributeValues: {
        ':c': client_id,
        ':now': now
      },
      TableName: "MarqueeMessages",
      IndexName: "end_time-index"
    })
    .promise()
    .catch(error => {
      clt(`Error reading MarqueeMessages`, error);
    });
  if (recordExists(mRecs)) {
    let selectedMRecs = mRecs.Items.filter(mRec => {
      if (!options.future_OK && (mRec.start_date > now)) {
        return false;
      }
      if (!options.belongsTo) {
        return true;
      }
      if (mRec.groups && (mRec.groups.length > 0)) {
        return (mRec.groups.some((allowedGroup) => {
          return (options.belongsTo.hasOwnProperty(allowedGroup));
        }));
      }
      return true;
    });
    if (options.rawData) {
      return selectedMRecs;
    }
    selectedMRecs.forEach(sRec => {
      response.push({
        style: sRec.style,
        message: sRec.message,
        criticalMessage: sRec.criticalMessage
      });
      if (sRec.criticalMessage) {
        urgentMessage = sRec.message;
      }
    });
  }
  if (urgentMessage) {
    sessionStorage.setItem('marquee_message', JSON.stringify([urgentMessage]));
  }
  else {
    sessionStorage.setItem('marquee_message', JSON.stringify(response));
  }
  return response;
}

export function deepCopy(pValue) {
  if (!pValue) {
    return pValue;
  }
  else if (Array.isArray(pValue)) {
    var count = pValue.length;
    var arr = new Array(count);
    for (var i = 0; i < count; i++) {
      arr[i] = deepCopy(pValue[i]);
    }
    return arr;
  }
  else if (typeof pValue === 'object') {
    var obj = {};
    for (var prop in pValue) {
      obj[prop] = deepCopy(pValue[prop]);
    }
    return obj;
  }
  else {
    return pValue;
  }
}

export function listFromArray(inArray, options) {
  if (!Array.isArray(inArray)) {
    if (!inArray || (inArray.trim() === '')) { return 'None'; }
    return inArray;
  }
  let makeList$ = '';
  let link = '';
  let nextToLast = inArray.length - 2;
  let threeOrMore = (inArray.length > 2);
  inArray.forEach((s, x) => {
    if (options && options.sentenceCase) { s = sentenceCase(s); }
    makeList$ += link + s;
    if (threeOrMore) { link = ', '; }
    if (x === nextToLast) (link += (!threeOrMore ? ' ' : '') + `${(options && options.or) ? 'or' : 'and'} `);
  });
  return makeList$;
}

export async function getCustomizations(pKey, pClient) {
  if (!pKey || !pClient) { return false; }
  if (pKey.toLowerCase() === '*all') {
    let customizations = {};
    let cRecs = await dbClient
      .query({
        KeyConditionExpression: 'client_id = :c',
        ExpressionAttributeValues: {
          ':c': pClient,
        },
        TableName: "Customizations"
      })
      .promise()
      .catch(error => {
        clt(`Error reading Customizations`, error);
      });
    if (recordExists(cRecs)) {
      cRecs.Items.forEach(cRec => {
        customizations[cRec.custom_key] = cRec.customization_value || cRec.icon;
      });
    }
    return customizations;
  }
  else {
    let cRec = await dbClient
      .get({
        Key: {
          client_id: pClient,
          custom_key: pKey
        },
        TableName: "Customizations",
      })
      .promise()
      .catch(error => {
        cl(`Caught error reading Customizations.Error is: ${error} 
                    with client = ${pClient} and custom_key = ${pKey} `);
      });
    if (recordExists(cRec)) { return cRec.Item; }
    else { return false; }
  }
}

export function makeString(inP, pNum = 0, pLink = ',') {   // will force whatever you send it to return a string value
  let returnValue;
  if (typeof inP === 'boolean') { returnValue = (inP ? 'true' : 'false'); }
  else if (!inP) { returnValue = ' '; }
  else if (isObject(inP)) { returnValue = JSON.stringify(inP); }
  else if (!Array.isArray(inP)) { returnValue = inP.trim(); }
  else {  // array - return up to pNum entries (or all entries if pNum = 0)
    let lim = ((pNum > 0) ? Math.min(pNum, inP.length) : inP.length);
    let return$ = '';
    for (let a = 0; a < lim; a++) {
      return$ += ((a > 0) ? pLink : '') + makeString(inP[a]);
    }
    returnValue = return$;
  }
  if (returnValue) { return returnValue; }
  else { return ' '; }
}

export function stringToColor(string) {
  let hash = 0;
  let i;
  /* eslint-disable no-bitwise */
  for (i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#e';
  for (i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.substr(-2);
  }
  /* eslint-enable no-bitwise */
  return color.slice(0, 7);
}

export function cl() {
  for (let v = 0; v < arguments.length; v++) {
    let value = arguments[v];
    if ((typeof (value) === 'object') && (value.constructor.name === 'Object')) {
      console.log(JSON.stringify(value));
    }
    else { console.log(value); }
  }
};

export function clt() {
  for (let v = 0; v < arguments.length; v++) {
    let value = arguments[v];
    if (typeof (value) === 'object') { console.log(JSON.stringify(value)); }
    else { console.log({ value }); }
  };
};

export function sentenceCase(pString) {
  if (!pString) { return ''; }
  if (typeof (pString) === 'object') { return JSON.stringify(pString); }
  let words = pString.split(/\s+/);
  let returnString = '';
  words.forEach((w, x) => {
    if (w.toLowerCase() === 'ava') {
      returnString += 'AVA';
    }
    if (w.toLowerCase() === 'bbq') {
      returnString += 'BBQ';
    }
    else if (x === 0) {
      returnString += `${w.slice(0, 1).toUpperCase()}${w.slice(1).toLowerCase()}`;
    }
    else {
      returnString += w;
    }
    returnString += ' ';
  });
  return returnString.trim();
}

export function makeArray(input, delimiter = null) {
  let response = [];
  if (!input) { return []; };
  if (Array.isArray(input)) {
    response.push(...input);
  }
  else if (typeof input === 'object') {
    // response = Object.keys(input);
    response.push(input);
  }
  else if (typeof input === 'number') {
    response.push(input);
  }
  else if ((input.charAt(0) === '{') && (input.charAt(input.length - 1) === '}')) {
    try {
      let rObj = JSON.parse(input);
      Object.keys(rObj).forEach(o => {
        response.push(`${o}=${rObj[o]}`);
      });
    }
    catch {
      let outObj = {};
      let keyValuePairs = input.replace(/[{}]/g, '').split(',');
      keyValuePairs.forEach(pair => {
        let [key, value] = pair.split(':');
        outObj[key.trim()] = value.trim();
      });
      response.push(outObj);
    }
  }
  else if (input.charAt(0) === '[') {
    response = input.replace(/[[\]]/, '').split(',');
  }
  else if (delimiter) {
    response = input.split(delimiter).map(e => { return e.trim(); });
  }
  else { response.push(input); }
  return response;
}

export function makeObject(input) {
  if (isObject(input)) {
    return input;
  }
  else {
    let returnO = makeObj(input);
    return (returnO);
  }
}

export function makeObj(input) {
  let returnObj = {};
  let pairs = [];
  if (Array.isArray(input)) {
    pairs = input;
  }
  else {
    pairs = (input.split(','));
  }
  pairs.forEach((p, x) => {
    let [key, value] = p.replace(/[{}]/g, '').split(/[:=]/);
    if (!value) {
      returnObj[`${x}`] = key.trim();
    }
    else {
      if (isNaN(Number(value))) {
        returnObj[key.trim()] = value.trim();
      }
      else {
        returnObj[key.trim()] = Number(value);
      }
    }
  });
  return returnObj;
}

export function extract(string, left, right = null, options = {}) {
  let f_left = string.indexOf(left);
  let f_right = string.indexOf(right, f_left);
  if ((f_left === -1) || !left) {
    if (!options.fuzzyLeft) { return null; }
    else {
      f_left = 0;
      left = '';
    }
  }
  if ((f_right === -1) || !right) {
    if (!options.fuzzyRight) { return null; }
    else {
      f_right = string.length;
      right = '';
    }
  }
  if (!options.includeLeft) { f_left += left.length; }
  if (!options.includeRight) { f_right -= right.length; }
  return string.slice(f_left, f_right);
};

export function titleCase(pString) {
  if (!pString) { return ''; }
  let words = pString.split(/\s+/);
  let returnString = '';
  words.forEach((w, x) => {
    if (x === 0) { returnString += `${w.slice(0, 1).toUpperCase()}${w.slice(1)}`; }
    else if ((w.length < 3) || (w === 'and') || (w === 'the')) { returnString += w; }
    else if (w.toLowerCase() === 'ava') { returnString += 'AVA'; }
    else if (w.toLowerCase() === 'bbq') { returnString += 'BBQ'; }
    else { returnString += `${w.slice(0, 1).toUpperCase()}${w.slice(1)}`; }
    returnString += ' ';
  });
  return returnString.trim();
}

export function makeNumber(pNum) {
  if (!pNum) { return 0; }
  else {
    let pN = Number(pNum);
    if (isNaN(pN)) { return 0; }
    else { return pN; }
  }
};

export function parseNumeric(pIn) {
  let pStr = pIn.toString();
  let t = pStr.replace(/\d/g, '');
  let n = t.replace(/[\s.]/g, '');
  let v = pStr.replace(/\D/g, '');
  let p = parseFloat(pStr);
  if (p.toString().includes('.')) {
    // decimal point, not "dot" - in this case 
    // remove the decimal point from t as it is part of the number, not the text
    t = t.replace(/[.]/g, '');
  }
  return ({
    isNumeric: !!p,
    hasNumbers: !!v,
    hasText: !!n,
    textValue: t.trim() || null,
    value: p || null
  });
};

export async function getIcon(pIcon) {
  const imageBucket = 'ava-icons';
  const imageURI = `${pIcon}.png`;
  let oData;
  try {
    await s3.getObject({
      Bucket: imageBucket,
      Key: imageURI,
    }, function (error, data) {
      if (data) { oData = data; };
    })
      .promise();
    if (!oData || (oData.ContentLength === 0)) {
      return;
    };
    let gotImage =
      s3.getSignedUrl('getObject', {
        Bucket: imageBucket,
        Key: imageURI,
        Expires: 3600
      });
    iconObj[pIcon] = gotImage;
    return gotImage;
  }
  catch (e) {
    console.log(`error getting S3 image is ${e}`);
    return null;
  }
};


export async function getObject64(pObj) {
  let imageBucket = 'theseus-medical-storage';
  let oPieces = pObj.toLowerCase().split('/');
  let oFile = oPieces.pop();
  let myPiece = oPieces.findIndex(x => {
    return (x.includes('.s3'));
  });
  if (myPiece > -1) {
    imageBucket = oPieces[myPiece].substring(0, oPieces[myPiece].indexOf('.s3'));
  }
  let oData;
  try {
    await s3.getObject({
      Bucket: imageBucket,
      Key: oFile,
    }, function (error, data) {
      if (data) { oData = data; };
    })
      .promise();
    if (!oData || (oData.ContentLength === 0)) {
      return;
    }
    else {
      let base64String = oData.Body.toString('base64');
      return "data:image/jpeg;base64," + base64String;
    }
  }
  catch (e) {
    console.log(`error getting S3 image is ${e}`);
    return null;
  }
};

export function getObject(pObjIn, pTyp) {
  let imageBucket, imageURI;
  let [pObj, fExt] = pObjIn.split(/\.(.*)/);
  switch (pTyp) {
    case 'icon': {
      imageBucket = 'ava-icons';
      imageURI = `${pObj}.${fExt || 'png'}`;
      break;
    }
    case 'image': {
      imageBucket = 'theseus-medical-storage';
      if (fExt) {
        if (['png', 'jpg'].includes(fExt.toLowerCase())) {
          imageURI = `public/patients/${pObj}.${fExt}`;
        }
        else {
          imageURI = `public/patients/${pObj}.${fExt}.jpg`;
        }
      }
      else {
        imageURI = `public/patients/${pObj}.jpg`;
      }
      break;
    }
    default: {
      imageBucket = 'theseus-medical-storage';
      imageURI = pObjIn;
    }
  }
  try {
    let gotObject =
      s3.getSignedUrl('getObject', {
        Bucket: imageBucket,
        Key: imageURI,
        Expires: 3600
      });
    if (gotObject) { return gotObject; }
    else { throw new Error('No object returned'); }
  }
  catch (error) {
    cl({ 'error getting object': { pObjIn, pTyp, imageBucket, imageURI, pObj, fExt, error } });
    return null;
  }
};

export async function updateACL(pObjIn, pTyp) {
  let imageBucket, imageURI;
  let [pObj, fExt] = pObjIn.split(/\.(.*)/);
  switch (pTyp) {
    case 'icon': {
      imageBucket = 'ava-icons';
      imageURI = `${pObj}.${fExt || 'png'}`;
      break;
    }
    case 'image': {
      imageBucket = 'theseus-medical-storage';
      imageURI = `public/patients/${pObj}.${fExt || 'jpg'}`;
      break;
    }
    default: {
      imageBucket = 'theseus-medical-storage';
      imageURI = pObjIn;
    }
  }
  await s3
    .putObjectAcl({
      Bucket: imageBucket,
      Key: imageURI,
      ACL: 'public-read-write',
    })
    .promise()
    .catch(err => {
      cl(`ACL for ${imageURI} not updated in ${imageBucket}.  Error is ${err}`);
    });
};

export function isPromise(p) {
  return p && Object.prototype.toString.call(p) === "[object Promise]";
}

export function isEmpty(o) {
  if (!o) { return true; }
  else if (Array.isArray(o)) { return (o.length === 0); }
  else if (o instanceof Date) { return isNaN(o); }
  else if (typeof (o) === 'object') { return (Object.keys(o).length === 0); }
  else if (typeof (o) === 'string') { return (o.trim().length === 0); }
  else if (typeof (o) === 'number') { return (o === 0); }
  else { return false; }
}

export function isObject(a) {
  return (!!a) && (a.constructor === Object);
};

export function uuid(pLen) {
  let key = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F'];
  if (!pLen || (pLen < 6)) { pLen = 6; }
  var d = new Date().getTime();
  let ans = [];
  for (let a = 0; a < pLen; a++) {
    var r = Math.random() * 16; //random number between 0 and 16
    if (d <= 0) { d = new Date().getTime(); }
    r = (d + r) % 16 | 0;
    d = Math.floor(d / 16);
    ans.push(key[r]);
  }
  return ans.join('');
}

export async function deepResolve(pKey, pSession, options = {}) {
  if (typeof (pKey) !== 'string') {
    let workObj = deepCopy(pKey);
    for (let aKey in workObj) {
      workObj[aKey] = await deepResolve(workObj[aKey], pSession, options);
    }
    return workObj;
  }
  return resolveVariables(pKey, pSession, options);
}


export async function resolveVariables(pKey, pSession, options = {}) {
  if (!pKey) { return ''; }
  // look for brackets in the key and deal with what's between them
  let response = [];
  do {
    let result = pKey.match(/(.*?)([<[])(.*?)([>\]])(.*)/);
    if (!result) {
      response.push(pKey);
      break;
    }
    let [, front, d1, middle, d2, back] = result;
    if (middle.includes('%')) {
      let [, before, , variable_name, , after] = middle.match(/(.*?)(%)(.*?)(%)(.*)/);
      if (options.hasOwnProperty(variable_name)) {
        middle = `${before}${options[variable_name]}${after}`;
        d1 = '';
        d2 = '';
      }
      else if (pSession.hasOwnProperty(variable_name)) {
        middle = `${before}${pSession[variable_name]}${after}`;
        d1 = '';
        d2 = '';
      }
      response.push(front, d1, middle, d2);
    }
    else {
      let [instruction, dType] = middle.split(':');
      instruction = instruction.toLowerCase();
      switch (instruction) {
        case 'client': {
          response.push(front, pSession.client_id);
          break;
        }
        case 'name': {
          response.push(front, await makeName(pSession.patient_id));
          break;
        }
        case 'location': {
          let pMe = await getPerson(pSession.patient_id);
          response.push(front, pMe.location);
          break;
        }
        case 'local': {
          let pMe = await getPerson(pSession.patient_id);
          response.push(front, pMe.local_data ? pMe.local_data[dType] : '');
          break;
        }
        case 'person':
        case 'patient': {
          response.push(front, pSession.patient_id);
          break;
        }
        case 'user_id':
        case 'user': {
          response.push(front, pSession.user_id);
          break;
        }
        case 'user_name':
        case 'username': {
          response.push(front, await makeName(pSession.user_id));
          break;
        }
        case 'weekday': {
          if (dType) {
            if (dType.startsWith('today~')) {
              let now = new Date();
              let ttime = Number(instruction.split(/~/g)[1]);
              let tnow = (now.getHours() * 100) + now.getMinutes();
              if (tnow > ttime) { dType = 'tomorrow'; }
              else { dType = 'today'; }
            }
            let keyDate = makeDate(dType);
            response.push(front, keyDate.weekday);
          }
          break;
        }
        default: {
          if (instruction.startsWith('today~')) {
            let now = new Date();
            let ttime = Number(instruction.split(/~/g)[1]);
            let tnow = (now.getHours() * 100) + now.getMinutes();
            if (tnow > ttime) { instruction = 'tomorrow'; }
            else { instruction = 'today'; }
          }
          else if (instruction.startsWith('next_event~')) {
            let splitInstruction = instruction.split(/~/g);
            let oResponse = await getOccurenceList({
              client: pSession.client_id,
              event: splitInstruction[1],
              from_date: new Date(),
              number_of_occurrences: splitInstruction[2] || 1
            });
            instruction = oResponse.occArray[oResponse.occArray.length - 1];
          }
          let dateOptions = {};
          if (pSession.working_hours) {
            dateOptions.working_hours = deepCopy(pSession.working_hours);
          }
          let keyDate = makeDate(instruction, dateOptions);
          if (!keyDate.error) { response.push(front, keyDate[dType || 'obs']); }
          else {
            let iParts = [];
            if (typeof (instruction) === 'string') { iParts = instruction.split('~'); };
            if (iParts[2]) {
              let now = new Date();
              let tTime = Number(iParts[1]);  // get time
              let tNow = (now.getHours() * 100) + now.getMinutes();
              if (tNow > tTime) { response.push(front, iParts[2]); }
              else { response.push(front, iParts[0]); }
            }
            else { response.push(front, d1, middle, d2); }
          }
        }
      }
    }
    pKey = back;
  } while (pKey);
  return response.join('');
}

export function parseSpreadsheet(pWorkbook) {
  // take pWorkbook as raw XLSX data and return an array as returnObj[row] = { column: cellValue, ...}
  let returnObj = [];
  let cellValue, cellColumn, cellRow;
  pWorkbook.SheetNames.forEach((sheetName) => {
    let currentSheet = pWorkbook.Sheets[sheetName];
    for (const currentCell in currentSheet) {
      if (currentSheet[currentCell].w) { cellValue = currentSheet[currentCell].w.trim(); }
      else if (currentSheet[currentCell].v) { cellValue = currentSheet[currentCell].v.trim(); }
      else { continue; }
      cellColumn = currentCell.replace(/[^A-Z]+/, '');
      cellRow = Number(currentCell.replace(cellColumn, ''));
      if (!returnObj[cellRow]) { returnObj[cellRow] = {}; }
      returnObj[cellRow][cellColumn] = cellValue;
    }
  });
  return returnObj;
}

export const isMobile = () => {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

export async function switchActiveAccount(session, newClient, newPatient) {
  await dbClient
    .update({
      Key: { session_id: session.user_id },
      UpdateExpression: 'set client_id = :c, patient_id = :p, patient_display_name = :d, user_homeClient = :h',
      ExpressionAttributeValues: {
        ':c': newClient,
        ':p': newPatient.id,
        ':d': (newPatient.name ? (`${newPatient.name.first} ${newPatient.name.last}`).trim() : (`${newPatient.first} ${newPatient.last}`).trim()),
        ':h': (session.user_homeClient || session.client_id)
      },
      TableName: "SessionsV2",
    })
    .promise()
    .catch(error => { console.log(`caught error updating SessionsV2; error is:`, error); });
  sessionStorage.removeItem('AVASessionData');
  let jumpTo = window.location.href.replace('refresh', 'theseus');
  window.location.replace(jumpTo);
};

export async function updateDb(pData) {
  // pData in the form {["table": <tablename>, "key": {"key1": "keydata1", etc...}, "data": {"field_name1": "new value", "field_name2", "new value", ...}]}
  let response = [];
  pData_loop: for (let t = 0; t < pData.length; t++) {
    let k_num = 0;
    let aNamesObj = {};
    let aValuesObj = {};
    let expression = 'set';
    for (let pKey in pData[t].data) {
      // are you updating anything in the key?
      if (pData[t].key.hasOwnProperty(pKey)) {
        // this is a delete/add; not an update
        let oldRec = await dbClient
          .get({
            Key: pData[t].key,
            TableName: pData[t].table,
          })
          .promise()
          .catch(error => {
            console.log(`caught error getting ${pData[t].table}; error is:`, error);
            response.push(error);
          });
        let newRec;
        if (recordExists(oldRec)) {
          newRec = Object.assign({}, oldRec.Item, pData[t].data);
          await dbClient
            .delete({
              Key: pData[t].key,
              TableName: pData[t].table,
            })
            .promise()
            .catch(error => {
              console.log(`caught error deleting ${pData[t].table}; error is:`, error);
              response.push(error);
            });
        }
        else {
          newRec = Object.assign({}, pData[t].key, pData[t].data);
        }
        await dbClient
          .put({
            TableName: pData[t].table,
            Item: newRec
          })
          .promise()
          .catch(error => {
            console.log(`caught error putting to ${pData[t].table}; error is:`, error);
            response.push(error);
          });
        continue pData_loop;   // this jumps out and doesn't add to the aNameObj and aValuesObj
      }
      let aKey = `n${k_num++}`;
      aNamesObj[`#${aKey}`] = pKey;
      aValuesObj[`:${aKey}`] = pData[t].data[pKey];
      if (k_num > 1) {
        expression += ', ';
      }
      expression += ` #${aKey} = :${aKey}`;
    }
    await dbClient
      .update({
        Key: pData[t].key,
        UpdateExpression: expression,
        ExpressionAttributeValues: aValuesObj,
        ExpressionAttributeNames: aNamesObj,
        TableName: pData[t].table,
      })
      .promise()
      .catch(error => {
        console.log(`caught error updating ${pData[t].table}; error is:`, error);
        response.push(error);
      });
    response.push('OK');
  }
  return response;
}

export async function deleteDbRec(pData) {
  // pData in the form {["table": <tablename>, "key": {"key1": "keydata1", etc...}]}
  let response = [];
  for (let t = 0; t < pData.length; t++) {
    await dbClient
      .delete({
        Key: pData[t].key,
        TableName: pData[t].table,
      })
      .promise()
      .catch(error => {
        console.log(`caught error deleting ${pData[t].table}; error is:`, error);
        response.push(error);
      });
    response.push('OK');
  }
  return response;
}

export async function restAPI(pRequest, api_data) {
  let finalReturn = {};
  const TELSdefaults = {
    hostname: 'integrations.tels.net',
    path: '/workOrders/v1/workOrders',
    method: 'POST',
    headers: {
      "X-API-Key": "Ej8NR7sTFj1TvpG1p2ADz9os9aIu5Q3n7E4QeaIU",
      'Content-Type': 'application/json'
    },
  };

  let requestHeaders = Object.assign({}, TELSdefaults.headers, pRequest.headers);
  let request = Object.assign({}, TELSdefaults, pRequest, { headers: requestHeaders });

  let params = {
    FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:bookResourceReservation',
    InvocationType: 'RequestResponse',
    LogType: 'Tail',
    Payload: ''
  };

  params.Payload = JSON.stringify({
    options: request,
    newTELSworkorder: api_data
  });

  let invokeFailed = false;
  const fResp = await lambda
    .invoke(params)
    .promise()
    .catch(err => {
      invokeFailed = true;
    });

  if (!invokeFailed) {
    let response = JSON.parse(fResp.Payload);
    if (response.status === 200) {
      finalReturn = response.Presponse;
    }
  };
  return finalReturn;

}