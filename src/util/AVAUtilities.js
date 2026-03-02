import { getPerson, makeName } from '../util/AVAPeople';
import { makeDate, isDate } from '../util/AVADateTime';
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

const MediaConvert = require('aws-sdk/clients/mediaconvert');
export const mediaconvert = new MediaConvert({
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
    let periodWords = weather.properties.periods[0].name;
    if (periodWords.startsWith('this') || periodWords.startsWith('today')) {
      periodWords = `t${periodWords.slice(1)}`;
    }
    return `Forecast for ${client_weather.place_name} ${periodWords} - ${weather.properties.periods[0].detailedForecast}`;
  };
}

export async function getMarqueeMessage(client_id, options = {}) {
  let response = [];
  let weatherMessage = false;
  let urgentMessage;
  let suppressWeather = false;
  if (options.client_weather && !options.critical_only) {
    let weather = await getLocalWeather(options.client_weather);
    if (weather) {
      weatherMessage = {
        style: null,
        message: weather
      };
    }
  }
  let now = new Date().getTime();
  let mRecs = await dbClient
    .query({
      KeyConditionExpression: 'client_id = :c',
      ExpressionAttributeValues: {
        ':c': client_id,
      },
      TableName: "MarqueeMessages",
    })
    .promise()
    .catch(error => {
      clt(`Error reading MarqueeMessages`, error);
    });
  if (recordExists(mRecs)) {
    let selectedMRecs = mRecs.Items.filter(mRec => {
      if (!options.future_OK && mRec.start_time && (mRec.start_time > now)) {
        return false;
      }
      if (mRec.end_time && (mRec.end_time < now)) {
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
      if (sRec.criticalMessage || sRec.priorityMessage || !options.critical_only) {
        response.push({
          style: sRec.style,
          message: sRec.message,
          criticalMessage: sRec.criticalMessage,
          priorityMessage: sRec.priorityMessage
        });
        if ((sRec.criticalMessage) || (sRec.priorityMessage)) {
          suppressWeather = true;
          if (sRec.criticalMessage) {
            urgentMessage = sRec.message;
          }
        }
      }
    });
  }
  if (urgentMessage) {
    sessionStorage.setItem('marquee_message', JSON.stringify([urgentMessage]));
  }
  else {
    if (!suppressWeather && weatherMessage) {
      response.unshift(weatherMessage);
    }
    sessionStorage.setItem('marquee_message', JSON.stringify(response));
  }
  return response;
}

export function deepCopy(pValue) {
  // Fast path for primitives and null/undefined
  if (!pValue || typeof pValue !== 'object') {
    return pValue;
  }

  // Preserve Date objects
  if (isDate(pValue)) {
    return pValue;
  }

  // Use JSON for speed (5-10x faster than manual recursion)
  // This handles most common cases: objects, arrays, nested structures
  try {
    return JSON.parse(JSON.stringify(pValue));
  } catch (e) {
    // Fallback for edge cases (circular refs, special types, etc.)
    if (Array.isArray(pValue)) {
      return pValue.map(item => deepCopy(item));
    }
    const obj = {};
    for (const prop in pValue) {
      obj[prop] = deepCopy(pValue[prop]);
    }
    return obj;
  }
}

export function listFromArray(pArray, options) {
  if (!Array.isArray(pArray)) {
    if (!pArray || (pArray.trim() === '')) { return 'None'; }
    return pArray;
  }
  let inArray = pArray;
  if (options && options.ignoreBlank) {
    inArray = pArray.filter(e => { return (e.trim() !== ''); });
  }
  let makeList$ = '';
  let link = '';
  let nextToLast = inArray.length - 2;
  let threeOrMore = (inArray.length > 2);
  if (options && options.max && (inArray.length > options.max.length)) {
    return `${inArray.length} ${options.max.words || 'selections'}`;
  }
  inArray.forEach((s, x) => {
    let linkWord = 'and';
    if (options) {
      if (options.sentenceCase) { s = sentenceCase(s); }
      if (options.or) { linkWord = 'or'; }
    }
    makeList$ += link + s;
    if (threeOrMore) { link = ', '; }
    if (x === nextToLast) (link += (!threeOrMore ? ' ' : '') + `${linkWord} `);
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
    color += `00${value.toString(16)}`.slice(-2);
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

export function makeCustomArray(input, options = {}) {
  let response = [];
  if (!input) { return []; };
  let { delimiter, toLowerCase, notAlone } = options;
  if ((typeof (input) === 'string')) {
    if (toLowerCase) {
      return (notAlone ? input.toLowerCase() : [input.toLowerCase()]);
    }
    else {
      return (notAlone ? input : [input]);
    }
  }
  else if (Array.isArray(input)) {
    for (const this_item of input) {
      response.push(makeArray(this_item, Object.assign({}, options, { notAlone: true })));
    }
  }
  else if (typeof input === 'object') {
    for (const this_key in input) {
      response.push({ [(toLowerCase ? this_key.toLowerCase() : this_key)]: makeArray(input[this_key], Object.assign({}, options, { notAlone: true })) });
    }
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
  if (options.includeRight) { f_right += right.length; }
  return string.slice(f_left, f_right);
};

export function array_in_array(a1, a2) {
  if (!a1 || !a2) { return false; }
  // return true if any member of array 1 appears anywhere in array 2
  return a1.some(this_a => {
    return a2.includes(this_a);
  });
}

export function titleCase(pString) {
  if (!pString) { return ''; }
  let words = pString.split(/([^\w':]+)/);
  // console.log(words);
  const smallWords = ['of', 'and', 'or', 'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by'];
  const allCapWords = ['ava', 'bbq', 'id', 'tv', 'ceo', 'cfo', 'coo', 'usa', 'uk', 'eu', 'am', 'pm'];
  var titleCased = [];
  words.forEach((w, idx) => {
    // if (!w.trim()) { return; }   // ignore spaces between words (we'll put them back in later)
    // Always capitalize first word, otherwise check if it's a small word
    if (allCapWords.includes(w.toLowerCase())) {
      titleCased.push(w.toUpperCase());
    }
    else if (idx === 0 || !smallWords.includes(w.toLowerCase())) {
      titleCased.push(w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    }
    else { titleCased.push(w.toLowerCase()); }
  });
  return titleCased.join('').trim();
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

export function validatePhone(pInput, options = {}) {
  if (!pInput) {
    return {
      'error': true,
      'raw': '',  // last 10 digits only
      'dial': '',  // +12223334444
      'display': '',  // (222) 333-4444
      'area_code': '',  // 222
      'numeric': '',  // 2223334444
      'isPhoneNumber': false
    };
  }
  if (typeof pInput !== 'string') {
    pInput = pInput.toString();
  }
  let digitsOnly = pInput.replace(/\D/g, '');
  let raw = digitsOnly.toString().slice(-10);
  let area_code = raw.slice(0, 3);
  let numeric = Number(raw);
  let display = `(${area_code}) ${raw.slice(3, 6)}-${raw.slice(6)}`;
  let dial = `+1${raw}`;
  if (options.country_code) {
    dial = `+${options.country_code}${raw}`;
  }
  if (digitsOnly.length === 10) { /* valid US number */ }
  else if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) { /* valid US number with country code */ }
  else if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
    // International number - keep user's formatting
    raw = digitsOnly;
    area_code = '';
    numeric = Number(digitsOnly);
    display = pInput;
    dial = `+${digitsOnly}`;
  }
  return {
    error: false,
    raw,
    dial,
    display,
    area_code,
    numeric,
    isPhoneNumber: raw.length >= 10
  };
};

export function isPhoneNumber(pIn) {
  return !isNaN(Number(pIn.toString().replace(/[()-\s.]/g, "")));
}

export function isEMail(pIn) {
  return isValidEmail(pIn);
}

export function isValidEmail(pIn) {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(pIn);
}

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
  let oPieces = pObj.split('/');
  let oFile = oPieces.pop();
  let myPiece = oPieces.findIndex(x => {
    return (x.includes('.s3'));
  });
  if (myPiece > -1) {
    imageBucket = oPieces[myPiece].substring(0, oPieces[myPiece].indexOf('.s3'));
  }
  let oData;
  try {
    let rawObject =
      await s3.getObject({
        Bucket: imageBucket,
        Key: oFile,
      }, function (error, data) {
        if (data) {
          oData = data;
          if (oData) {
            console.log('got oData');
          }
        };
      })
        .promise();
    console.log(rawObject);
    let gotURL =
      s3.getSignedUrl('getObject', {
        Bucket: imageBucket,
        Key: oFile,
        Expires: 3600
      });
    if (!gotURL || (gotURL.ContentLength === 0)) { throw new Error('No object returned'); }
    else {
      let gotObject =
        await s3.getObject({
          Bucket: imageBucket,
          Key: oFile,
        }).promise();
      if (!gotObject || (gotObject.ContentLength === 0)) {
        return;
      };
      let base64String = gotObject.Body.toString('base64');
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

export async function resolveData(client_id, person_id, field_ids = [], options = {}) {
  if (!client_id || !person_id || !Array.isArray(field_ids)) {
    return [];
  }

  const resolvedValues = [];
  const dictionaryCache = options.dictionaryCache || {};

  for (const field_id of field_ids) {
    if (!field_id) {
      resolvedValues.push({
        raw: null,
        formatted: null,
        details: null,
        meta: {
          field_id: null,
          status: 'missing_field_id'
        }
      });
      continue;
    }

    const cacheKey = `${client_id}::${field_id}`;
    let dictionaryRec = dictionaryCache[cacheKey] || null;

    if (!dictionaryRec) {
      let foundRec = await dbClient
        .get({
          TableName: 'DataDictionaryV3',
          Key: {
            client_id,
            field_key: field_id
          }
        })
        .promise()
        .catch((error) => {
            cl({ 'resolveData DataDictionaryV3 read failed': { client_id, field_id, error } });
          });

      dictionaryRec = recordExists(foundRec) ? foundRec.Item : null;
      if (dictionaryRec) {
        dictionaryCache[cacheKey] = dictionaryRec;
      }
    }

    if (!dictionaryRec) {
      resolvedValues.push({
        raw: null,
        formatted: null,
        details: null,
        meta: {
          field_id,
          client_id,
          status: 'dictionary_not_found'
        }
      });
      continue;
    }

    const resolution = await resolveDataByDictionary({
      client_id,
      person_id,
      field_id,
      dictionaryRec,
      options
    });

    const effectiveDictionaryRec = resolution.dictionaryRec || dictionaryRec;
    const resolvedRaw = resolution.rawValue;

    const resolvedOutput = await formatResolvedValue({
      rawValue: resolvedRaw,
      dictionaryRec: effectiveDictionaryRec,
      client_id,
      person_id,
      options
    });

    const resolvedEntry = {
      raw: resolvedRaw,
      formatted: resolvedOutput.formatted,
      details: resolvedOutput.details,
      meta: {
        field_id,
        client_id,
        source: effectiveDictionaryRec.source || null,
        locator: effectiveDictionaryRec.locator || null,
        path_used: resolution.pathUsed,
        status: resolution.status || (isGoodResolvedValue(resolvedRaw) ? 'resolved' : 'not_found')
      }
    };

    resolvedValues.push(cleanUndefinedArtifacts(resolvedEntry));
  }

  return resolvedValues;
}

async function resolveDataByDictionary({ client_id, person_id, field_id, dictionaryRec, options = {} }) {
  const resolutionCandidates = buildResolutionCandidates(dictionaryRec);

  for (const candidateRec of resolutionCandidates) {
    const pathList = Array.isArray(candidateRec.path)
      ? candidateRec.path
      : ((typeof candidateRec.path === 'string' && candidateRec.path.trim()) ? [candidateRec.path] : []);

    const source = (candidateRec?.source || '').toString().toLowerCase();
    if (source === 'document' || source === 'documents' || source === 'documentmaster') {
      const completionDateValue = await resolveDocumentCompletionDateFromPath({
        client_id,
        person_id,
        dictionaryRec: candidateRec,
        pathList
      });
      if (completionDateValue !== undefined) {
        return {
          rawValue: completionDateValue,
          pathUsed: '*completion_date',
          status: 'resolved_from_document_completion_date',
          dictionaryRec: candidateRec
        };
      }

      const updateDateValue = await resolveDocumentUpdateDateFromPath({
        client_id,
        person_id,
        dictionaryRec: candidateRec,
        pathList
      });
      if (updateDateValue !== undefined) {
        return {
          rawValue: updateDateValue,
          pathUsed: '*update_date',
          status: 'resolved_from_document_update_date',
          dictionaryRec: candidateRec
        };
      }
    }

    const sourceRecord = await getSourceRecord({
      client_id,
      person_id,
      dictionaryRec: candidateRec,
      options
    });

    if (sourceRecord) {
      for (const pathSpec of pathList) {
        const pathValue = resolvePathSpecValue(sourceRecord, pathSpec);
        if (isGoodResolvedValue(pathValue)) {
          return {
            rawValue: pathValue,
            pathUsed: pathSpec,
            status: 'resolved_from_path',
            dictionaryRec: candidateRec
          };
        }
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(dictionaryRec, 'fixed_value')) {
    return {
      rawValue: dictionaryRec.fixed_value,
      pathUsed: null,
      status: 'resolved_from_fixed_value',
      dictionaryRec
    };
  }
  if (Object.prototype.hasOwnProperty.call(dictionaryRec, 'default_value')) {
    return {
      rawValue: dictionaryRec.default_value,
      pathUsed: null,
      status: 'resolved_from_default_value',
      dictionaryRec
    };
  }
  if (Object.prototype.hasOwnProperty.call(dictionaryRec, 'value')) {
    return {
      rawValue: dictionaryRec.value,
      pathUsed: null,
      status: 'resolved_from_value',
      dictionaryRec
    };
  }

  cl({ 'resolveData unresolved field': { client_id, person_id, field_id, dictionaryRec } });
  return {
    rawValue: null,
    pathUsed: null,
    status: 'unresolved',
    dictionaryRec
  };
}

function buildResolutionCandidates(dictionaryRec = {}) {
  const multiSourceCandidates = firstArrayOfObjects([
    dictionaryRec.sources,
    dictionaryRec.source_options,
    dictionaryRec.source_candidates,
    dictionaryRec.resolution_sources
  ]);

  if (!multiSourceCandidates) {
    return [dictionaryRec];
  }

  return multiSourceCandidates.map((candidate) => {
    return Object.assign({}, dictionaryRec, candidate);
  });
}

function firstArrayOfObjects(candidateValues = []) {
  for (const candidateValue of candidateValues) {
    if (!Array.isArray(candidateValue) || candidateValue.length === 0) {
      continue;
    }

    const objectCandidates = candidateValue.filter((item) => {
      return item && typeof item === 'object' && !Array.isArray(item);
    });

    if (objectCandidates.length > 0) {
      return objectCandidates;
    }
  }
  return null;
}

async function resolveDocumentCompletionDateFromPath({ client_id, person_id, dictionaryRec, pathList = [] }) {
  if (!Array.isArray(pathList) || pathList.length === 0) {
    return undefined;
  }

  const hasCompletionDatePath = pathList.some((pathSpec) => {
    return isCompletionDatePathSpec(pathSpec);
  });

  if (!hasCompletionDatePath) {
    return undefined;
  }

  const documentList = await getDocumentRecordsForDictionary({
    client_id,
    person_id,
    dictionaryRec
  });

  if (!Array.isArray(documentList) || documentList.length === 0) {
    return undefined;
  }

  return getLowestCompletedHistoryLastUpdate(documentList);
}

async function resolveDocumentUpdateDateFromPath({ client_id, person_id, dictionaryRec, pathList = [] }) {
  if (!Array.isArray(pathList) || pathList.length === 0) {
    return undefined;
  }

  const hasUpdateDatePath = pathList.some((pathSpec) => {
    return isUpdateDatePathSpec(pathSpec);
  });

  if (!hasUpdateDatePath) {
    return undefined;
  }

  const documentList = await getDocumentRecordsForDictionary({
    client_id,
    person_id,
    dictionaryRec
  });

  if (!Array.isArray(documentList) || documentList.length === 0) {
    return undefined;
  }

  return getMostRecentCompletedHistoryLastUpdate(documentList);
}

function isCompletionDatePathSpec(pathSpec) {
  if (typeof pathSpec === 'string') {
    return (pathSpec.trim().toLowerCase() === '*completion_date');
  }
  if (Array.isArray(pathSpec)) {
    return pathSpec.some((subPathSpec) => {
      return (typeof subPathSpec === 'string') && (subPathSpec.trim().toLowerCase() === '*completion_date');
    });
  }
  return false;
}

function isUpdateDatePathSpec(pathSpec) {
  if (typeof pathSpec === 'string') {
    return (pathSpec.trim().toLowerCase() === '*update_date');
  }
  if (Array.isArray(pathSpec)) {
    return pathSpec.some((subPathSpec) => {
      return (typeof subPathSpec === 'string') && (subPathSpec.trim().toLowerCase() === '*update_date');
    });
  }
  return false;
}

function getLowestCompletedHistoryLastUpdate(documentList = []) {
  let lowestComparableLastUpdate = Number.POSITIVE_INFINITY;
  let lowestRawLastUpdate;

  for (const doc of documentList) {
    const historyEntries = Array.isArray(doc?.history) ? doc.history : [];
    for (const historyEntry of historyEntries) {
      if (!isCompletedDocumentStatus(historyEntry?.status)) {
        continue;
      }

      const rawLastUpdate = historyEntry?.last_update;
      const comparableLastUpdate = getComparableLastUpdateValue(rawLastUpdate);
      if (comparableLastUpdate === null) {
        continue;
      }

      if (comparableLastUpdate < lowestComparableLastUpdate) {
        lowestComparableLastUpdate = comparableLastUpdate;
        lowestRawLastUpdate = rawLastUpdate;
      }
    }
  }

  return lowestRawLastUpdate;
}

function getMostRecentCompletedHistoryLastUpdate(documentList = []) {
  let highestComparableLastUpdate = Number.NEGATIVE_INFINITY;
  let highestRawLastUpdate;

  for (const doc of documentList) {
    const historyEntries = Array.isArray(doc?.history) ? doc.history : [];
    for (const historyEntry of historyEntries) {
      if (!isCompletedDocumentStatus(historyEntry?.status)) {
        continue;
      }

      const rawLastUpdate = historyEntry?.last_update;
      const comparableLastUpdate = getComparableLastUpdateValue(rawLastUpdate);
      if (comparableLastUpdate === null) {
        continue;
      }

      if (comparableLastUpdate > highestComparableLastUpdate) {
        highestComparableLastUpdate = comparableLastUpdate;
        highestRawLastUpdate = rawLastUpdate;
      }
    }
  }

  return highestRawLastUpdate;
}

function isCompletedDocumentStatus(statusValue) {
  if (statusValue === null || statusValue === undefined) {
    return false;
  }

  const normalizedStatus = `${statusValue}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  const completedStatusValues = [
    'complete',
    'completed',
    'save_final',
    'saved_final',
    'final',
    'finalized'
  ];

  return completedStatusValues.includes(normalizedStatus);
}

function resolvePathSpecValue(sourceRecord, pathSpec) {
  if (!sourceRecord || !pathSpec) {
    return undefined;
  }

  if (typeof pathSpec === 'string') {
    return getValueByPath(sourceRecord, pathSpec);
  }

  if (!Array.isArray(pathSpec)) {
    return undefined;
  }

  const compositeParts = [];
  for (const subPathSpec of pathSpec) {
    if (typeof subPathSpec !== 'string' || !subPathSpec.trim()) {
      continue;
    }
    const subValue = getValueByPath(sourceRecord, subPathSpec);
    if (!isGoodResolvedValue(subValue)) {
      continue;
    }
    const partValue = stringifyResolvedPart(subValue);
    if (partValue) {
      compositeParts.push(partValue);
    }
  }

  if (compositeParts.length === 0) {
    return undefined;
  }

  return compositeParts.join(' ');
}

function stringifyResolvedPart(value) {
  if (!isGoodResolvedValue(value)) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return `${value}`;
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? '' : value.toISOString();
  }
  try {
    return JSON.stringify(value);
  }
  catch {
    return `${value}`;
  }
}

async function getSourceRecord({ client_id, person_id, dictionaryRec, options = {} }) {
  const source = (dictionaryRec.source || '').toString().toLowerCase();
  if (!source) {
    return null;
  }

  if (source === 'document' || source === 'documents' || source === 'documentmaster') {
    const foundDocs = await getDocumentRecordsForDictionary({
      client_id,
      person_id,
      dictionaryRec
    });
    if (!Array.isArray(foundDocs) || foundDocs.length === 0) {
      return null;
    }

    return pickMostRecentDocument(foundDocs);
  }

  const locatorField = dictionaryRec.locator || 'person_id';
  const locatorValue = getLocatorValue({ client_id, person_id, locatorField, options });
  if (!locatorValue) {
    return null;
  }

  let tableName = dictionaryRec.table;
  if (!tableName) {
    if (source === 'person' || source === 'people') {
      tableName = 'People';
    }
    else {
      tableName = dictionaryRec.source;
    }
  }

  const sourceRec = await dbClient
    .get({
      TableName: tableName,
      Key: {
        [locatorField]: locatorValue
      }
    })
    .promise()
    .catch((error) => {
      cl({ 'resolveData source read failed': { tableName, locatorField, locatorValue, error } });
    });

  if (recordExists(sourceRec)) {
    return sourceRec.Item;
  }
  return null;
}

async function getDocumentRecordsForDictionary({ client_id, person_id, dictionaryRec }) {
  const formType = (dictionaryRec?.locator || '').toString().trim();
  if (!person_id || !formType) {
    return [];
  }

  const foundDocs = await dbClient
    .query({
      TableName: 'DocumentMaster',
      IndexName: 'person_form-index',
      KeyConditionExpression: 'pertains_to = :p and form_type = :f',
      ExpressionAttributeValues: {
        ':p': person_id,
        ':f': formType
      }
    })
    .promise()
    .catch((error) => {
      cl({ 'resolveData document source read failed': { client_id, person_id, formType, error } });
    });

  if (!recordExists(foundDocs) || !Array.isArray(foundDocs.Items)) {
    return [];
  }

  return foundDocs.Items;
}

function pickMostRecentDocument(documentList = []) {
  if (!Array.isArray(documentList) || documentList.length === 0) {
    return null;
  }

  let mostRecentDoc = null;
  let mostRecentValue = Number.NEGATIVE_INFINITY;

  for (const doc of documentList) {
    const lastUpdateValue = getDocumentLastUpdateValue(doc);
    if (mostRecentDoc === null || lastUpdateValue > mostRecentValue) {
      mostRecentDoc = doc;
      mostRecentValue = lastUpdateValue;
    }
  }

  return mostRecentDoc;
}

function getDocumentLastUpdateValue(doc) {
  const rawLastUpdate = doc?.history?.[0]?.last_update;
  const comparableLastUpdate = getComparableLastUpdateValue(rawLastUpdate);
  if (comparableLastUpdate === null) {
    return Number.NEGATIVE_INFINITY;
  }

  return comparableLastUpdate;
}

function getComparableLastUpdateValue(rawLastUpdate) {
  if (rawLastUpdate === null || rawLastUpdate === undefined) {
    return null;
  }

  if (typeof rawLastUpdate === 'number' && !isNaN(rawLastUpdate)) {
    return rawLastUpdate;
  }

  const dateValue = new Date(rawLastUpdate).getTime();
  if (!isNaN(dateValue)) {
    return dateValue;
  }

  const numValue = Number(rawLastUpdate);
  if (!isNaN(numValue)) {
    return numValue;
  }

  return null;
}

function getLocatorValue({ client_id, person_id, locatorField, options = {} }) {
  if (options.locators && Object.prototype.hasOwnProperty.call(options.locators, locatorField)) {
    return options.locators[locatorField];
  }
  if (Object.prototype.hasOwnProperty.call(options, locatorField)) {
    return options[locatorField];
  }
  switch (locatorField) {
    case 'person_id': return person_id;
    case 'client_id': return client_id;
    default: return null;
  }
}

function getValueByPath(sourceObject, pathSpec) {
  if (!sourceObject || !pathSpec || (typeof pathSpec !== 'string')) {
    return undefined;
  }
  const pathParts = pathSpec.split('.').map((p) => p.trim()).filter((p) => p.length > 0);
  let currentValue = sourceObject;
  for (const part of pathParts) {
    if (currentValue === null || currentValue === undefined) {
      return undefined;
    }
    if (Array.isArray(currentValue)) {
      const idx = Number(part);
      if (!Number.isInteger(idx)) {
        return undefined;
      }
      currentValue = currentValue[idx];
    }
    else {
      currentValue = currentValue[part];
    }
  }
  return currentValue;
}

function isGoodResolvedValue(value) {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value instanceof Date) {
    return !isNaN(value.getTime());
  }
  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }
  return true;
}

async function formatResolvedValue({ rawValue, dictionaryRec, client_id, person_id, options = {} }) {
  const dataType = (dictionaryRec?.type || '').toString().toLowerCase();
  if (dataType === 'boolean' || dataType === 'bool') {
    const boolObj = normalizeBooleanInput(rawValue);
    return {
      formatted: boolObj.value,
      details: boolObj
    };
  }

  if (!isGoodResolvedValue(rawValue)) {
    return {
      formatted: null,
      details: null
    };
  }

  switch (dataType) {
    case 'email':
    case 'e-mail':
    case 'e_mail': {
      const emailObj = normalizeEmailInput(rawValue);
      if (!emailObj) {
        return {
          formatted: rawValue,
          details: null
        };
      }
      return {
        formatted: emailObj.full,
        details: emailObj
      };
    }
    case 'address': {
      const addressObj = normalizeAddressInput(rawValue);
      if (!addressObj) {
        return {
          formatted: rawValue,
          details: null
        };
      }

      addressObj.full = buildAddressFull(addressObj, options) || addressObj.full;

      if (isMarkedResolvedAddress(rawValue)) {
        const storedAddress = mergeAddressDetails(addressObj, rawValue, options);
        return {
          formatted: storedAddress.full,
          details: storedAddress
        };
      }

      const lookupEnabled = (options.address_lookup !== false) && (options.resolve_address !== false);
      if (lookupEnabled) {
        const resolvedAddress = await resolveAddressWithPublicApi(addressObj.full, options);
        if (resolvedAddress) {
          const mergedAddress = mergeAddressDetails(addressObj, resolvedAddress, options);
          if (mergedAddress && mergedAddress.full) {
            await persistResolvedAddressToPerson({
              client_id,
              person_id,
              dictionaryRec,
              options,
              resolvedAddress: mergedAddress
            });
          }
          return {
            formatted: mergedAddress.full,
            details: mergedAddress
          };
        }
      }

      return {
        formatted: addressObj.full,
        details: addressObj
      };
    }
    case 'name': {
      const nameObj = normalizeNameInput(rawValue);
      if (!nameObj) {
        return {
          formatted: rawValue,
          details: null
        };
      }
      return {
        formatted: nameObj.full,
        details: nameObj
      };
    }
    case 'phone': {
      const phoneInput = normalizePhoneInput(rawValue);
      if (!phoneInput) {
        return {
          formatted: rawValue,
          details: null
        };
      }
      const lastTen = phoneInput.replace(/\D/g, '').slice(-10);
      if (lastTen.length < 10) {
        return {
          formatted: rawValue,
          details: null
        };
      }
      const phoneObj = validatePhone(lastTen);
      return {
        formatted: phoneObj?.display || rawValue,
        details: phoneObj || null
      };
    }
    case 'date':
    case 'datetime': {
      const dateObjOut = makeDate(rawValue);      
      return {
        formatted: dateObjOut.slashDate || rawValue,
        details: dateObjOut
      };
    }
    case 'age':{
      const dateObjOut = makeDate(rawValue);      
      return {
        formatted: dateObjOut.age || rawValue,
        details: dateObjOut
      };
    }
    case 'number': {
      const nValue = Number(rawValue);
      if (isNaN(nValue)) {
        return {
          formatted: rawValue,
          details: null
        };
      }
      return {
        formatted: nValue,
        details: null
      };
    }
    case 'string_list': {
      const listObj = normalizeStringListInput(rawValue);
      return {
        formatted: listObj,
        details: {
          values: listObj,
          count: listObj.length
        }
      };
    }
    case 'string': {
      if (typeof rawValue === 'string') {
        return {
          formatted: rawValue,
          details: null
        };
      }
      return {
        formatted: `${rawValue}`,
        details: null
      };
    }
    default: {
      return {
        formatted: rawValue,
        details: null
      };
    }
  }
}

function normalizeBooleanInput(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return {
      value: false,
      populated: false,
      source_type: 'nullish'
    };
  }

  if (typeof rawValue === 'boolean') {
    return {
      value: rawValue,
      populated: true,
      source_type: 'boolean'
    };
  }

  return {
    value: isGoodResolvedValue(rawValue),
    populated: true,
    source_type: Array.isArray(rawValue) ? 'array' : typeof rawValue
  };
}

function normalizePhoneInput(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }
  if ((typeof rawValue === 'string') || (typeof rawValue === 'number')) {
    return `${rawValue}`;
  }
  return null;
}

function normalizeEmailInput(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue === 'string' || typeof rawValue === 'number') {
    const parsed = splitEmailFromString(`${rawValue}`);
    return parsed;
  }

  if (typeof rawValue !== 'object') {
    return null;
  }

  const fullFromObject = firstNonBlank([
    rawValue.full,
    rawValue.email,
    rawValue.address,
    rawValue.email_address,
    rawValue.value
  ]);

  let name = firstNonBlank([
    rawValue.name,
    rawValue.local,
    rawValue.local_part,
    rawValue.user
  ]);

  let domain = firstNonBlank([
    rawValue.domain,
    rawValue.host
  ]);

  let full = fullFromObject;
  if (!full && name && domain) {
    full = `${name}@${domain}`;
  }

  const parsedFromFull = splitEmailFromString(full);
  if (!name) {
    name = parsedFromFull.name;
  }
  if (!domain) {
    domain = parsedFromFull.domain;
  }
  if (!full) {
    full = parsedFromFull.full;
  }

  if (!full) {
    return null;
  }

  return {
    full,
    name,
    domain,
    is_valid: isValidEmail(full)
  };
}

function splitEmailFromString(emailString) {
  if (typeof emailString !== 'string') {
    return {
      full: '',
      name: '',
      domain: '',
      is_valid: false
    };
  }

  const full = cleanUndefinedString(emailString).trim();
  if (!full) {
    return {
      full: '',
      name: '',
      domain: '',
      is_valid: false
    };
  }

  const atPos = full.indexOf('@');
  if (atPos < 0) {
    return {
      full,
      name: full,
      domain: '',
      is_valid: isValidEmail(full)
    };
  }

  const name = full.slice(0, atPos).trim();
  const domain = full.slice(atPos + 1).trim();
  return {
    full,
    name,
    domain,
    is_valid: isValidEmail(full)
  };
}

function normalizeStringListInput(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return [];
  }

  if (Array.isArray(rawValue)) {
    const cleanedArray = rawValue
      .map(item => cleanUndefinedString(item))
      .filter(item => !!item);
    return cleanedArray;
  }

  if (typeof rawValue === 'string' || typeof rawValue === 'number') {
    const cleanedValue = cleanUndefinedString(rawValue);
    return (cleanedValue ? [cleanedValue] : []);
  }

  if (typeof rawValue === 'object') {
    const asString = cleanUndefinedString(JSON.stringify(rawValue));
    return (asString ? [asString] : []);
  }

  return [];
}

function normalizeNameInput(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue === 'string') {
    const parsed = splitNameFromString(rawValue);
    return parsed;
  }

  if (typeof rawValue !== 'object') {
    return null;
  }

  const first = firstNonBlank([
    rawValue.first,
    rawValue.first_name,
    rawValue.firstname,
    rawValue.given_name,
    rawValue.givenName
  ]);

  const last = firstNonBlank([
    rawValue.last,
    rawValue.last_name,
    rawValue.lastname,
    rawValue.family_name,
    rawValue.familyName,
    rawValue.surname
  ]);

  const fullFromObject = firstNonBlank([
    rawValue.full,
    rawValue.full_name,
    rawValue.fullname,
    rawValue.display_name,
    rawValue.displayName,
    rawValue.name
  ]);

  let normalizedFirst = first || '';
  let normalizedLast = last || '';

  if ((!normalizedFirst || !normalizedLast) && fullFromObject) {
    const splitFromFull = splitNameFromString(fullFromObject);
    if (!normalizedFirst) {
      normalizedFirst = splitFromFull.first;
    }
    if (!normalizedLast) {
      normalizedLast = splitFromFull.last;
    }
  }

  let full = `${normalizedFirst} ${normalizedLast}`.trim();
  if (!full) {
    full = (fullFromObject || '').trim();
  }

  if (!full) {
    return null;
  }

  return {
    first: normalizedFirst,
    last: normalizedLast,
    full
  };
}

function normalizeAddressInput(rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return null;
  }

  if (typeof rawValue === 'string') {
    const full = rawValue.trim();
    if (!full) {
      return null;
    }
    return {
      line1: '',
      line2: '',
      city: '',
      state: '',
      zip: '',
      full
    };
  }

  if (typeof rawValue !== 'object') {
    return null;
  }

  const line1 = firstNonBlank([
    rawValue.address,
    rawValue.address1,
    rawValue.street,
    rawValue.location,
    rawValue.line1,
    rawValue.address_line1
  ]);

  let line2 = firstNonBlank([
    rawValue.address2,
    rawValue.line2,
    rawValue.address_line2
  ]);

  if (line2 === line1) {
    line2 = '';
  }

  const city = firstNonBlank([rawValue.city]);
  const state = firstNonBlank([rawValue.state]);
  const zip = firstNonBlank([
    rawValue.zip,
    rawValue.zip_code
  ]);

  const fullFromObject = firstNonBlank([
    rawValue.full,
    rawValue.full_address,
    rawValue.display_address
  ]);

  let full = buildAddressFull({ line1, line2, city, state, zip }, { address_full_format: 'legacy' });

  if (!full) {
    full = fullFromObject;
  }

  if (!full) {
    return null;
  }

  return {
    line1,
    line2,
    city,
    state,
    zip,
    full
  };
}

async function resolveAddressWithPublicApi(addressString, options = {}) {
  if (!addressString || typeof addressString !== 'string' || typeof fetch !== 'function') {
    return null;
  }

  const trimmedAddress = addressString.trim();
  if (!trimmedAddress) {
    return null;
  }

  const queryParams = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    limit: '1',
    q: trimmedAddress
  });

  if (options.address_lookup_email) {
    queryParams.set('email', options.address_lookup_email);
  }
  if (options.address_lookup_country_code) {
    queryParams.set('countrycodes', `${options.address_lookup_country_code}`.toLowerCase());
  }

  const timeoutMs = Number(options.address_lookup_timeout_ms) || 4000;
  const controller = (typeof AbortController === 'function') ? new AbortController() : null;
  let timeoutHandle = null;
  if (controller && timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      controller.abort();
    }, timeoutMs);
  }

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${queryParams.toString()}`, {
      method: 'GET',
      signal: controller ? controller.signal : undefined,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response || !response.ok) {
      return null;
    }

    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const best = data[0] || {};
    const addr = best.address || {};
    const line1 = buildAddressLine1(addr);
    const city = firstNonBlank([
      addr.city,
      addr.town,
      addr.village,
      addr.hamlet,
      addr.municipality,
      addr.county
    ]);
    const state = firstNonBlank([addr.state, addr.state_district]);
    const zip = firstNonBlank([addr.postcode]);

    let full = buildAddressFull({
      line1,
      line2: '',
      city,
      state,
      zip
    }, options);
    if (!full) {
      full = firstNonBlank([best.display_name]);
    }
    if (!full) {
      return null;
    }

    return {
      line1,
      line2: '',
      city,
      state,
      zip,
      full,
      source: 'nominatim',
      validated: true,
      confidence: (typeof best.importance === 'number') ? best.importance : null,
      latitude: best.lat || null,
      longitude: best.lon || null
    };
  }
  catch {
    return null;
  }
  finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

function buildAddressLine1(addressObj = {}) {
  const houseNumber = firstNonBlank([addressObj.house_number]);
  const road = firstNonBlank([
    addressObj.road,
    addressObj.pedestrian,
    addressObj.residential,
    addressObj.path
  ]);
  return [houseNumber, road].filter(Boolean).join(' ').trim();
}

function buildAddressFull({ line1 = '', line2 = '', city = '', state = '', zip = '' } = {}, options = {}) {
  const normalized = {
    line1: cleanUndefinedString(line1),
    line2: cleanUndefinedString(line2),
    city: cleanUndefinedString(city),
    state: cleanUndefinedString(state),
    zip: cleanUndefinedString(zip)
  };

  const addressFormat = `${options?.address_full_format || 'us_standard'}`.toLowerCase();
  const cityStateZip = [normalized.city, normalized.state].filter(Boolean).join(', ');
  const cityStateZipWithZip = [cityStateZip, normalized.zip].filter(Boolean).join(' ').trim();

  if (addressFormat === 'legacy') {
    const lineSection = [normalized.line1, normalized.line2].filter(Boolean).join(' ');
    const legacyCityStateZip = [normalized.city, normalized.state, normalized.zip].filter(Boolean).join(' ');
    return [lineSection, legacyCityStateZip].filter(Boolean).join(', ').trim();
  }

  const segments = [];
  if (normalized.line1) { segments.push(normalized.line1); }
  if (normalized.line2) { segments.push(normalized.line2); }
  if (cityStateZipWithZip) { segments.push(cityStateZipWithZip); }
  return segments.join(', ').trim();
}

function mergeAddressDetails(baseAddress = {}, resolvedAddress = {}, options = {}) {
  const merged = {
    line1: firstNonBlank([resolvedAddress.line1, baseAddress.line1]),
    line2: firstNonBlank([resolvedAddress.line2, baseAddress.line2]),
    city: firstNonBlank([resolvedAddress.city, baseAddress.city]),
    state: firstNonBlank([resolvedAddress.state, baseAddress.state]),
    zip: firstNonBlank([resolvedAddress.zip, baseAddress.zip]),
    source: resolvedAddress.source || null,
    validated: !!resolvedAddress.validated,
    is_resolved_address: true,
    resolved_at: resolvedAddress.resolved_at || new Date().toISOString(),
    confidence: (resolvedAddress.confidence === undefined ? null : resolvedAddress.confidence),
    latitude: resolvedAddress.latitude || null,
    longitude: resolvedAddress.longitude || null
  };

  merged.full = buildAddressFull(merged, options) || firstNonBlank([resolvedAddress.full, baseAddress.full]);
  return merged;
}

function isMarkedResolvedAddress(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return (value.is_resolved_address === true) || (value.resolved_address === true);
}

async function persistResolvedAddressToPerson({ client_id, person_id, dictionaryRec, options = {}, resolvedAddress }) {
  if (!person_id || !resolvedAddress || options.persist_resolved_address === false) {
    return;
  }

  const sourceName = (dictionaryRec?.source || '').toString().toLowerCase();
  const tableName = (dictionaryRec?.table || '').toString();
  const shouldPersist = (!sourceName || sourceName === 'person' || sourceName === 'people' || tableName === 'People');
  if (!shouldPersist) {
    return;
  }

  await dbClient
    .update({
      TableName: 'People',
      Key: {
        person_id
      },
      UpdateExpression: 'set resolved_address = :r',
      ExpressionAttributeValues: {
        ':r': Object.assign({}, resolvedAddress, {
          is_resolved_address: true,
          resolved_at: resolvedAddress.resolved_at || new Date().toISOString(),
          source: resolvedAddress.source || 'nominatim',
          client_id: client_id || null
        })
      }
    })
    .promise()
    .catch((error) => {
      cl({ 'resolveData persist resolved_address failed': { person_id, client_id, error } });
    });
}

function splitNameFromString(nameString) {
  if (typeof nameString !== 'string') {
    return {
      first: '',
      last: '',
      full: ''
    };
  }

  const cleaned = nameString.trim().replace(/\s+/g, ' ');
  if (!cleaned) {
    return {
      first: '',
      last: '',
      full: ''
    };
  }

  const firstSpace = cleaned.indexOf(' ');
  if (firstSpace < 0) {
    return {
      first: cleaned,
      last: '',
      full: cleaned
    };
  }

  const first = cleaned.slice(0, firstSpace).trim();
  const last = cleaned.slice(firstSpace + 1).trim();
  const full = `${first} ${last}`.trim();

  return {
    first,
    last,
    full
  };
}

function firstNonBlank(values = []) {
  for (const value of values) {
    if (typeof value === 'string' || typeof value === 'number') {
      const trimmed = cleanUndefinedString(value);
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return '';
}

function cleanUndefinedArtifacts(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return cleanUndefinedString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => cleanUndefinedArtifacts(item));
  }

  if (typeof value === 'object') {
    const outObj = {};
    Object.keys(value).forEach((key) => {
      outObj[key] = cleanUndefinedArtifacts(value[key]);
    });
    return outObj;
  }

  return value;
}

function cleanUndefinedString(value) {
  if (value === null || value === undefined) {
    return '';
  }

  let cleaned = `${value}`;
  cleaned = cleaned.replace(/\bundefined\b/gi, ' ');
  cleaned = cleaned.replace(/\s+,/g, ',');
  cleaned = cleaned.replace(/,\s*,+/g, ', ');
  cleaned = cleaned.replace(/\s{2,}/g, ' ');
  cleaned = cleaned.replace(/\s+$/g, '');
  cleaned = cleaned.replace(/^\s+/g, '');
  return cleaned;
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

export const isSmallScreen = () => {
  return isMobile() || (window.window.innerWidth < 800);
};

export async function switchActiveAccount(session, newClient, newPatient, options = {}) {
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
  if (options && options.resetUser) {
    let sessionObject = JSON.parse(sessionStorage.getItem('AVASessionData'));
    sessionObject.currentProfile.client_id = newClient;
    sessionObject.currentProfile.person_id = newPatient.id;
    sessionStorage.setItem('AVASessionData', JSON.stringify(sessionObject));
  }
  else {
    sessionStorage.removeItem('AVASessionData');
  }
  let jumpTo = `${window.location.href.replace('refresh', 'theseus').split('?')[0]}`;
  if (options.resetUser) { jumpTo += `?user=${newPatient.id}`; }
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

export async function getDb(getSpec) {
  const foundRec = await dbClient
    .get(getSpec)
    .promise()
    .catch(error => {
      cl(`Error reading ${getSpec.TableName} in getDb with key of ${getSpec.Key}: ${error}`);
    });
  if (recordExists(foundRec)) {
    return foundRec.Item;
  }
  else {
    return false;
  }
}

export async function queryDb(querySpec) {
  const foundRecs = await dbClient
    .query(querySpec)
    .promise()
    .catch(error => {
      cl(`Error reading ${querySpec.TableName} in getDb with key of ${querySpec.Key}: ${error}`);
    });
  if (recordExists(foundRecs)) {
    return foundRecs.Items;
  }
  else {
    return false;
  }
}

export async function putDb(putSpec) {
  await dbClient
    .put(putSpec)
    .promise()
    .catch(error => {
      cl(`Error putting ${putSpec.TableName} in putDb with key of ${putSpec.Key}: ${error}`);
      return false;
    });
  return putSpec.Item;
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