import { cl, recordExists } from './AVAUtilities';
import { getPerson, getSession } from '../util/AVAPeople';


const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

let profile, session;
let loadedGroupObj = {};
let loadedPerson = null;

// Functions

/*
export function putMessage_nonAsync(body) {
    const goFunction = async () => {
        returnArray = await putMessage(...arguments);
    };
    let returnArray = [];
    goFunction();
    return returnArray;
}
*/

export async function isMemberOf(person_id, pGroup_id) {
  if (!loadedPerson || (loadedPerson !== person_id)) {
    loadedGroupObj = await getGroupsBelongTo(person_id);
  }
  return (Object.keys(loadedGroupObj).includes(pGroup_id));
};

export async function getGroupsBelongTo(person_id) {
  if (!session || (session.patient_id !== person_id)) {
    session = await getSession(person_id);
  }
  var returnObject = {};
  // First, get Groups that this person explicitly manages (as per the SessionsV2 table)
  if ('groups_managed' in session) {
    session.groups_managed.forEach(group => {
      let [gID, gName] = group.split('~');
      returnObject[gID.trim()] = {
        group_name: gName.trim(),
        group_id: gID.trim(),
        role: 'responsible'
      };
    });
  }
  // If there are groups in the "responsible for" array, include those
  let respArray = [];
  if ('responsible_for' in session) {
    if (Array.isArray(session.responsible_for)) { respArray.push(...session.responsible_for); }
    else if (session.responsible_for.startsWith('[')) { respArray = session.responsible_for.replace(/[[\s\]]/g, '').split(','); }
    else { respArray.push(session.responsible_for); }
  }
  for (let g = 0; g < respArray.length; g++) {
    let group = respArray[g].trim();
    if (!(group in returnObject)) {
      let checkGroup = await getGroup(group);
      if (checkGroup.hasOwnProperty('name')) {
        returnObject[group] = {
          group_name: checkGroup.name,
          group_id: group,
          role: 'responsible'
        };
      }
    }
  };
  // Next, get any other Groups that this person belongs to
  if (!profile || (profile.person_id !== person_id)) {
    profile = await getPerson(person_id);
  }
  for (let g = 0; g < profile.groups.length; g++) {
    let group = profile.groups[g];
    if (!(group in returnObject)) {
      let checkGroup = await getGroup(group);
      if (checkGroup.hasOwnProperty('name')) {
        returnObject[group] = {
          group_name: checkGroup.name,
          group_id: group,
          role: 'member'
        };
      }
    }
  };
  loadedPerson = person_id;
  loadedGroupObj = returnObject;
  return returnObject;
};

export async function getGroup(pGroup_id) {
  let groupRec = await dbClient
  .get({
    Key: { client_id: session.client_id, group_id: pGroup_id },
    TableName: "Groups"
  })
  .promise()
    .catch(error => { cl({ 'Error reading Groups': error }); });
if (recordExists(groupRec)) {
  return groupRec.Item;
}
return {};
};
