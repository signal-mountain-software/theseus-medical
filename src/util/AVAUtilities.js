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

export function listFromArray(inArray) {
  if (!Array.isArray(inArray)) {
    if (!inArray || (inArray.trim() === '')) { return 'None'; }
    return inArray;
  }
  let makeList$ = '';
  let link = '';
  let nextToLast = inArray.length - 2;
  let threeOrMore = (inArray.length > 2);
  inArray.forEach((s, x) => {
    makeList$ += link + s;
    if (threeOrMore) { link = ', '; }
    if (x === nextToLast) (link += (!threeOrMore ? ' ' : '') + 'and ');

  });
  return makeList$;
}


export async function getCustomizations(pKey, pClient) {
  if (!pKey || !pClient) { return false; }
  if (pKey.toLowerCase() === '*all') {
    let qParm = {
      KeyConditionExpression: 'client_id = :c',
      ExpressionAttributeValues: { ':c': pClient },
      TableName: "Customizations"
    };
    let cRecs = await dbClient
      .query(qParm)
      .promise()
      .catch(error => {
        cl({
          'Error reading Groups': error,
          client_id: `<${pClient}>`
        });
      });
    if (!recordExists(cRecs)) { return false; }
    else { return cRecs.Items; }
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


export function makeString(inP, pNum = 0, pLink) {
  if (!inP) { return null; }
  if (!Array.isArray(inP)) { return inP.trim(); }
  if (pNum === 0) { return inP.join(pLink || ' ~ '); }
  let lim = Math.min(pNum, inP.length);
  let return$ = inP[0];
  for (let a = 1; a < lim; a++) {
    return$ += pLink + inP[a];
  }
  return return$;
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
  return (!pString ? '' : pString.slice(0, 1).toUpperCase() + pString.slice(1).toLowerCase());
}

export function makeArray(input, delimiter = null) {
  let response = [];
  if (!input) { return []; };
  if (Array.isArray(input)) { response.push(...input); }
  else if (typeof input === 'object') { response = Object.keys(input); }
  else if ((input.charAt(0) === '{') && (input.charAt(input.length - 1) === '}')) {
    let rObj = JSON.parse(input);
    Object.keys(rObj).forEach(o => {
      response.push(`${o}=${rObj[o]}`);
    });
  }
  else if (delimiter) {
    response = input.split(delimiter).map(e => { return e.trim(); });
  }
  else { response.push(input); }
  return response;
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
      case 'person':
      case 'patient': {
        response.push(front, pSession.patient_id);
        break;
      }
      case 'user': {
        response.push(front, pSession.user_id);
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
        let keyDate = makeDate(instruction);
        if (!keyDate.error) { response.push(front, keyDate[dType || 'obs']); }
        else {
          let iParts = instruction.split('~');
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
      if (!currentSheet[currentCell].w) { continue; }
      cellValue = currentSheet[currentCell].w.trim();
      cellColumn = currentCell.replace(/[^A-Z]+/, '');
      cellRow = Number(currentCell.replace(cellColumn, ''));
      if (!returnObj[cellRow]) { returnObj[cellRow] = {}; }
      returnObj[cellRow][cellColumn] = cellValue;
    }
  });
  return returnObj;
}
