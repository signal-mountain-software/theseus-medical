import { getPerson, makeName } from '../util/AVAPeople';
import { makeDate } from '../util/AVADateTime';

// NOTES -
// regex to split at the first instance of a character only (% used as example to split on): is .split(/%(.*)/)

const AWS = require('aws-sdk');

const s3 = new AWS.S3({
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

let iconObj = {};

export function recordExists(recordId) {
  if (!recordId) { return false; }
  if (recordId.hasOwnProperty('Count')) { return (recordId.Count > 0); }
  else { return ((recordId.hasOwnProperty("Item") || recordId.hasOwnProperty("Items"))); }
}

export function listFromArray(inArray) { 
  if (!Array.isArray(inArray)) { return inArray }
  let makeList$ = '';
  let link = '';
  let nextToLast = inArray.length - 2;
  let threeOrMore = (inArray.length > 2);
  inArray.forEach((s, x) => {
    makeList$ += link + s;
    if (threeOrMore) { link = ', '; }
    if (x === nextToLast) (link += 'and ');

  });
  return makeList$;
}

export function stringToColor(string) {
  let hash = 0;
  let i;
  /* eslint-disable no-bitwise */
  for (i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.substr(-2);
  }
  /* eslint-enable no-bitwise */
  return color;
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
  return (!pString ? '' : pString.slice(0, 1).toUpperCase() + pString.slice(1).toLowerCase());
}

export function titleCase(pString) {
  if (!pString) { return ''; }
  let words = pString.split(/\s+/);
  let returnString = '';
  words.forEach(w => {
    if (w.length < 4) { returnString += w; }
    else { returnString += sentenceCase(w); }
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

export async function getObject(pObjIn, pTyp) {
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
    case 'temp_image': {
      imageBucket = 'theseus-medical-storage';
      imageURI = `temp/${pObj}.${fExt || 'jpg'}`;
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
    else { throw new Error('No object returned') }
  }
  catch (error) {
    cl({'error getting object': { pObjIn, pTyp, imageBucket, imageURI, pObj, fExt, error }});
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
      cl(`ACL for ${imageURI} not updated in ${imageBucket}.  Error is ${err}`)
    });
};


export function isPromise(p) {
  return p && Object.prototype.toString.call(p) === "[object Promise]";
}

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

export async function resolveVariables(pKey, pSession) {
  if (!pKey) { return ''; }
  // look for brackets in the key and deal with what's between them
  do {
    let [front, rest] = pKey.split(/\[(.*)/);
    if (!rest) { return front; }
    let [middle, back] = rest.split(/](.*)/);
    if (middle) {
      // if there is a middle, but no front or back, this is an ARRAY...
      if (!front && !back) { return middle.split(","); }
      let [instruction, dType] = middle.split(':');
      instruction = instruction.toLowerCase();
      switch (instruction) {
        case 'client': { pKey = `${front}${pSession.client_id}${back}`; break; }
        case 'name': { pKey = `${front}${await makeName(pSession.patient_id)}${back}`; break; }
        case 'location': {
          let pMe = await getPerson(pSession.patient_id);
          pKey = `${front}${pMe.location}${back}`;
          break;
        }
        case 'person':
        case 'patient': { pKey = `${front}${pSession.patient_id}${back}`; break; }
        case 'user': { pKey = `${front}${pSession.user_id}${back}`; break; }
        default: {
          if (instruction.startsWith('today~')) {
            let now = new Date();
            let ttime = Number(instruction.split(/~/g)[1]);
            let tnow = (now.getHours() * 100) + now.getMinutes();
            if (tnow > ttime) { instruction = 'tomorrow'; }
            else { instruction = 'today'; }
          }
          let keyDate = makeDate(instruction);
          if (!keyDate.error) { pKey = `${front}${keyDate[dType || 'obs']}${back}`; }
          else { pKey = `${front}"${instruction}"${back}`; }
        }
      }
    }
  } while (pKey.includes('['));
  return pKey;
};