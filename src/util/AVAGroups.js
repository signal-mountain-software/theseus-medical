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
let groupRecs = {};
let groupObj = {};
let loadedGroupObj = {};
let loadedPerson = null;

// Functions

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
      returnObject[group] = {
        group_name: (groupObj[group] ? groupObj[group].name : null),
        group_id: group,
        role: 'responsible'
      };
    }
  };
  // Next, get any other Groups that this person belongs to
  if (!profile || (profile.person_id !== person_id)) {
    profile = await getPerson(person_id);
  }
  for (let g = 0; g < profile.groups.length; g++) {
    let group = profile.groups[g];
    if (!(group in returnObject)) {
      returnObject[group] = {
        group_name: (groupObj[group] ? groupObj[group].name : null),
        group_id: group,
        role: 'member'
      };
    }
  };
  loadedPerson = person_id;
  loadedGroupObj = returnObject;
  return returnObject;
};

export async function getGroup(pGroup_id, pClient_id) {
  if (!pClient_id) {
    if (pGroup_id.includes('//')) { [pClient_id, pGroup_id] = pGroup_id.split('//'); }
    else { pClient_id = session.client_id; }
  }
  let cKey = `${pClient_id}//${pGroup_id}`;
  if (cKey in groupRecs) { return groupRecs[cKey]; }
  let groupRec = await dbClient
    .get({
      Key: { client_id: pClient_id, group_id: pGroup_id },
      TableName: "Groups"
    })
    .promise()
    .catch(error => { cl({ 'Error reading Groups': error }); });
  if (recordExists(groupRec)) {
    groupRecs[cKey] = groupRec.Item;
    return groupRec.Item;
  }
  return {};
};

export async function getRole(pGroup, pPerson) {
  let pSession = getSession(pPerson);
  if ('responsible_for' in pSession) {
    if (Array.isArray(pSession.responsible_for)) {
      if (pSession.responsible_for.includes(pGroup)) { return 'responsible'; }
    }
    else if (pSession.responsible_for.split(/[[,\]]/).includes(pGroup)) { return 'responsible'; }
  }
  else if ('groups_managed' in pSession) {
    if (Array.isArray(pSession.groups_managed)) {
      if (pSession.groups_managed.includes(pGroup)) { return 'responsible'; }
    }
    else if (pSession.groups_managed.split(/[[,\]]/).includes(pGroup)) { return 'responsible'; }
  }
  else if (getGroup(pGroup, pSession.client_id).admin_list.includes(pPerson)) {
    return 'responsible';
  }
  else { return 'member' }
}

export async function getMemberList(pGroup_id, pClient_id, checkExclude = false) {
  let returnObj = {};
  let defaultClient = pClient_id || session.client_id;
  let gList = [];
  if (Array.isArray(pGroup_id)) { gList = [...pGroup_id]; }
  else { gList = [pGroup_id]; }
  for (let g = 0; g < gList.length; g++) {
    let grp = gList[g];
    let client;
    if (grp.includes('//')) { [client, grp] = grp.split('//'); }
    else { client = defaultClient; }
    let groupRec = getGroup(grp, client);
    let gPeopleRecs = await dbClient
      .query({
        KeyConditionExpression: 'client_id = :c',
        FilterExpression: 'contains ( groups, :n )',
        ExpressionAttributeValues: { ':n': grp, ':c': client },
        TableName: "People",
        IndexName: "client_id-index",
      })
      .promise()
      .catch(error => {
        cl({ 'Bad scan on People in getGroupMembers - caught error is': error });
      });
    if (recordExists(gPeopleRecs)) {
      gPeopleRecs.Items.forEach(i => {
        if (i.person_id in returnObj) { 
          returnObj[i.person_id].role[groupRec.group_id] = getRole(groupRec.group_id, i.person_id) ;
        }
        else {
          if (!checkExclude || (i.directory_option !== 'exclude')) { 
            if (!i.name) { i.name = { last: `Unknown ${i.person_id}` }; }
            if (!i.messaging) { i.messaging = { ava_only: `AVA` }; }
            let role = {};
            role[groupRec.group_id] = getRole(groupRec.group_id, i.person_id);
            returnObj[i.person_id] = Object.assign(role, i);
          }
        }
      });
    }
  }
  let peopleList = Object.keys(returnObj);
  peopleList.sort((a, b) => {
    if (returnObj[a].name.last === returnObj[b].name.last) {
      if (returnObj[a].name.first > returnObj[b].name.first) { return 1; }
      if (returnObj[a].name.first < returnObj[b].name.first) { return -1; }
    }
    else {
      if (returnObj[a].name.last > returnObj[b].name.last) { return 1; }
      if (returnObj[a].name.last < returnObj[b].name.last) { return -1; }
    }
    return 0;
  });
  returnObj.peopleList = peopleList;
}