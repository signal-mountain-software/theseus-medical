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
    else if (session) { pClient_id = session.client_id; }
    else return {};
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
  let pSession = await getSession(pPerson);
  if ((('responsible_for' in pSession) && (pSession.responsible_for.some(g => g.split('~')[0].trim() === pGroup)))
    || (('groups_managed' in pSession) && (pSession.groups_managed.some(g => g.split('~')[0].trim() === pGroup)))
    || (getGroup(pGroup, pSession.client_id).admin_list.includes(pPerson))) {
    return 'responsible';
  }
  else { return 'member'; }
}

export async function getMemberList(pGroups, pClient_id, options) {
  // returns an array of peopleRecs that are members of the group(s) in pGroups
  let returnArray = [];
  let checkExclude = false;
  let sortResults = false;
  if (options) {
    checkExclude = options.exclude;
    sortResults = options.sort;
  }
  let defaultClient = pClient_id || session.client_id;
  let gList = [];
  if (Array.isArray(pGroups)) { gList = [...pGroups]; }
  else if (pGroups.includes('[')) { gList = pGroups.replace(/[[\]]/g, '').split(','); }
  else { gList = [pGroups]; }
  if (gList.some(g => g.toLowerCase().includes('*all'))) { gList = ['*all']; }
  for (let g = 0; g < gList.length; g++) {
    let grp = gList[g].split('~')[0].trim();   // some arrays send 'group_id ~ group_name' in an element
    let client;
    if (grp.includes('//')) { [client, grp] = grp.split('//'); }
    else { client = defaultClient; }
    let qParm = {
      KeyConditionExpression: 'client_id = :c',
      ExpressionAttributeValues: { ':c': client },
      TableName: "People",
      IndexName: "client_id-index",
    };
    if (grp !== '*all') {
      qParm.FilterExpression = 'contains ( groups, :n )';
      qParm.ExpressionAttributeValues[':n'] = grp;
    }
    let gPeopleRecs = await dbClient
      .query(qParm)
      .promise()
      .catch(error => {
        cl({ 'Bad scan on People in getGroupMembers - caught error is': error });
      });
    if (recordExists(gPeopleRecs)) {
      gPeopleRecs.Items.forEach(i => {
        if ((!returnArray.includes(i.person_id)) || !checkExclude || (i.directory_option !== 'exclude')) {
          if (!i.name) { i.name = { last: `Unknown ${i.person_id}` }; }
          if (!i.messaging) { i.messaging = { ava_only: `AVA` }; }
          returnArray.push(i);
        }
      });
    }
  }
  if (sortResults) {
    returnArray.sort((a, b) => {
      if (a.name.last === b.name.last) {
        if (a.name.first > b.name.first) { return 1; }
        if (a.name.first < b.name.first) { return -1; }
      }
      else {
        if (a.name.last > b.name.last) { return 1; }
        if (a.name.last < b.name.last) { return -1; }
      }
      return 0;
    });
  }
  return {
    'peopleList': returnArray,
    'groupList': gList
  };
}