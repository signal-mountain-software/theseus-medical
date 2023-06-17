import { cl, clt, recordExists, makeArray, getCustomizations, dbClient } from './AVAUtilities';
import { AVAname, getPerson, getSession } from '../util/AVAPeople';

let profile, session;
let groupRecs = {};
let groupObj = {};
let targetObj = {};
let targetArray = [];
let targetPerson = null;
let loadedGroupObj = {};
let loadedPerson = null;

// Functions

export async function isMemberOf(person_id, pGroup_id) {
  if (!loadedPerson || (loadedPerson !== person_id)) {
    loadedGroupObj = await getGroupsBelongTo(person_id);
  }
  return (Object.keys(loadedGroupObj).includes(pGroup_id));
};

export async function getGroupsResponsibleFor(person_id) {
  if (!session || (session.patient_id !== person_id)) {
    session = await getSession(person_id);
  }
  var returnObject = {};
  // First, get Groups that this person explicitly manages (as per the SessionsV2 table)
  if ('groups_managed' in session) {
    for (let g = 0; g < session.groups_managed.length; g++) {
      let [gID, gName] = session.groups_managed[g].split('~').map(s => { return s.trim(); });
      let gRec = await getGroup(gID, session.client_id);
      if (gRec.name) { gName = gRec.name; }
      returnObject[gID] = {
        group_name: gName,
        group_id: gID,
        role: 'responsible'
      };
    };
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
      let gName;
      if (groupObj[group]) { gName = groupObj[group].name; }
      else {
        let gRec = await getGroup(group, session.client_id);
        if (gRec.name) { gName = gRec.name; }
      }
      if (gName) {
        returnObject[group] = {
          group_name: gName,
          group_id: group,
          role: 'responsible'
        };
      }
    };
  }
  loadedPerson = person_id;
  return returnObject;
}

export async function getPeopleResponsibleFor(person_id) {
  if (!session || (session.patient_id !== person_id)) {
    session = await getSession(person_id);
  }
  var respList = [];
  if ('groups_managed' in session) {
    for (let g = 0; g < session.groups_managed.length; g++) {
      let [gID, ] = session.groups_managed[g].split('~').map(s => { return s.trim(); });
      respList.push(gID);
    };
  }
  let respArray = [];
  if ('responsible_for' in session) {
    if (Array.isArray(session.responsible_for)) { respArray.push(...session.responsible_for); }
    else if (session.responsible_for.startsWith('[')) { respArray = session.responsible_for.replace(/[[\s\]]/g, '').split(','); }
    else { respArray.push(session.responsible_for); }
  }
  for (let g = 0; g < respArray.length; g++) {
    let rID = respArray[g].trim();
    if (!respList.includes(rID)) { respList.push(rID); }
  }
  let returnObject = await getMemberList(respList, session.client_id, { sortResults: true });
  return returnObject.peopleList.map(p => { 
    return `${p.name.last}, ${p.name.first}:${p.person_id}:${p.search_data}`;
  })
}


export async function getGroupsBelongTo(person_id, options) {
  // You belong to all groups that you are responsible for
  var returnObject = await getGroupsResponsibleFor(person_id);
  // Next, get any other Groups that this person belongs to (but aren't responsible for)
  if (!profile || (profile.person_id !== person_id)) {
    profile = await getPerson(person_id);
  }
  if (profile && profile.groups) {
    for (let g = 0; g < profile.groups.length; g++) {
      let group = profile.groups[g];
      if (!(group in returnObject)) {
        let gName;
        if (groupObj[group]) { gName = groupObj[group].name; }
        else {
          let gRec = await getGroup(group, session.client_id);
          if (gRec.name) { gName = gRec.name; }
        }
        if (gName) {
          returnObject[group] = {
            group_name: gName,
            group_id: group,
            role: 'member'
          };
        }
      }
    };
  }
  loadedPerson = person_id;
  loadedGroupObj = returnObject;
  if (options && options.sort) {
    // put each object in an array of objects, then sort that array and return an object sequenced by the sort
    let gArray = [];
    for (let gID in returnObject) { gArray.push(returnObject[gID]); }
    gArray.sort((a, b) => {
      if (a.group_name > b.group_name) { return 1; }
      else { return -1; }
    });
    let newObject = {};
    gArray.forEach(g => { newObject[g.group_id] = g; });
    return newObject;
  }
  else { return returnObject; }
};

export async function getGroup(pGroup_id, pClient_id) {
  if (!pClient_id) {
    if (pGroup_id.includes('//')) { [pClient_id, pGroup_id] = pGroup_id.split('//'); }
    else if (session) { pClient_id = session.client_id; }
    else return {};
  }
  let cKey = `${pClient_id}//${pGroup_id}`;
  if (cKey in groupRecs) { return groupRecs[cKey]; }
  if (!pClient_id || !pGroup_id) { return {}; }
  let groupRec = await dbClient
    .get({
      Key: { client_id: pClient_id, group_id: pGroup_id },
      TableName: "Groups"
    })
    .promise()
    .catch(error => {
      cl({
        'Error reading Groups': error,
        client_id: `<${pClient_id}>`,
        group_id: `<${pGroup_id}>`
      });
    });
  if (recordExists(groupRec)) {
    groupRecs[cKey] = groupRec.Item;
    return groupRec.Item;
  }
  return {};
};

export async function getRole(pGroup, pPerson) {
  let pSession = await getSession(pPerson);
  if ((('responsible_for' in pSession) && (pSession.responsible_for.some(g => g.split('~')[0].trim() === pGroup)))
    || (('groups_managed' in pSession) && (pSession.groups_managed.some(g => g.split('~')[0].trim() === pGroup)))) {
    return 'responsible';
  }
  else {
    let gRec = await getGroup(pGroup, pSession.client_id);
    if (gRec.admin_list && gRec.admin_list.includes(pPerson)) { return 'responsible'; }
  }
  if (await isMemberOf(pPerson, pGroup)) { return 'member'; }
  else { return 'non-member'; }
}

export async function getMemberList(pGroups, pClient_id, options) {
  // returns an array of peopleRecs that are members of the group(s) in pGroups
  // if you happen to include a person_id in the pGroups list, getMemberList returns those too
  let returnArray = [];
  let foundIDs = [];
  // if options.exclude is TRUE, getMemberList respects directory_option === exclude 
  // otherwise, people records are return without regard to the directory_option
  let checkExclude = false;
  let sortResults = false;
  if (options) {
    if (options.sort || options.sortResults) {
      sortResults = options.sort || options.sortResults;
    }
    if (options.exclude || options.checkExclude) {
      checkExclude = options.exclude || options.checkExclude;
    }
  }
  let defaultClient = pClient_id || session.client_id;
  let gList = [];
  if (Array.isArray(pGroups)) {
    pGroups.forEach(grp => { gList.push(...(grp.replace(/[[\]]/g, '').split(/,|~/g))); });
  }
  else if (pGroups.includes('[')) { gList = pGroups.replace(/[[\]]/g, '').split(/,|~/g); }
  else { gList = [pGroups]; }
  if (gList.some(g => g.toLowerCase().includes('*all'))) { gList = ['*all']; }
  for (let g = 0; g < gList.length; g++) {
    let grp, client;
    if (gList[g].includes(':')) { grp = gList[g].split(':')[1].trim(); }  // some arrays send '~group:group_id' in an element
    else if (gList[g].includes('~')) { grp = gList[g].split('~')[0].trim(); }   // some arrays send 'group_id ~ group_name' in an element
    else { grp = gList[g].trim(); }
    if (grp.includes('//')) { [client, grp] = grp.split('//'); }
    else { client = defaultClient; }
    let qParm = {
      KeyConditionExpression: 'client_id = :c',
      ExpressionAttributeValues: { ':c': client },
      TableName: "People",
      IndexName: "client_id-index",
    };
    if (grp !== '*all') {
      qParm.FilterExpression = 'contains(groups, :n) OR (person_id = :n)';
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
        if (!foundIDs.includes(i.person_id)) {
          foundIDs.push(i.person_id);
          if (!checkExclude || (i.directory_option !== 'exclude')) {
            if (!i.name) { i.name = { last: `Unknown ${i.person_id}` }; }
            if (!i.messaging) { i.messaging = { ava_only: `AVA` }; }
            i.display_name = AVAname(i);
            returnArray.push(i);
          }
        }
      });
    }
  };
  if (sortResults) {
    returnArray.sort((a, b) => {
      if (a.name.last > b.name.last) { return 1; }
      else if (a.name.last < b.name.last) { return -1; }
      else if (a.name.first > b.name.first) { return 1; }
      else if (a.name.first < b.name.first) { return -1; }
      else { return 0; }
    });
  }
  return {
    foundIDs,
    'peopleList': returnArray,
    'groupList': gList
  };
}

export async function addMember(pPerson, pClient, pGroup) {
  let peopleRec = await getPerson(pPerson);
  if (peopleRec?.person_id) {
    let newGroupList = peopleRec.groups;
    newGroupList.push(pGroup);
    let clientGroups = peopleRec.clients;
    clientGroups.some((cG, ndx) => {
      if (cG.id === pClient) {
        peopleRec.clients[ndx].groups = newGroupList;
        return true;
      }
      else { return false; }
    });
    await dbClient
      .update({
        Key: { person_id: pPerson },
        UpdateExpression: "set groups = :g, clients = :cg",
        ExpressionAttributeValues: {
          ":g": newGroupList,
          ":cg": peopleRec.clients
        },
        TableName: "People",
      })
      .promise()
      .catch(error => {
        clt({ 'Bad update to People - caught error is': error });
      });
  }
  let peopleGroupRec = {
    client_group_id: pClient + '~' + pGroup,
    display_name: (peopleRec?.person_id ? `${peopleRec.name.last}, ${peopleRec.name.first}` : `${pPerson}, Unknown Account`),
    person_id: pPerson,
    roles: ["patient"]
  };
  await dbClient
    .put({
      Item: peopleGroupRec,
      TableName: "PeopleGroups"
    })
    .promise()
    .catch(error => {
      clt({ 'Bad put to PeopleGroups - caught error is': error });
    });
}

export async function addAdministrator(pPerson, pGroup) {
  let sessionRec = await getSession(pPerson);
  if (sessionRec?.session_id) {
    let rArray = makeArray(sessionRec.responsible_for);
    if (!rArray.includes(pGroup)) {
      rArray.push(pGroup);
      await dbClient
        .update({
          Key: { session_id: pPerson },
          UpdateExpression: "set responsible_for = :r",
          ExpressionAttributeValues: {
            ":r": rArray
          },
          TableName: "SessionsV2",
        })
        .promise()
        .catch(error => {
          clt({ 'Bad update to Sessions - caught error is': error });
        });
    }
  }
}

export async function removeAdministrator(pPerson, pGroup) {
  let sessionRec = await getSession(pPerson);
  if (sessionRec?.session_id) {
    let rArray = makeArray(sessionRec.responsible_for);
    let rIndex = rArray.indexOf(pGroup);
    if (rIndex > -1) {
      rArray.splice(rIndex, 1);
      await dbClient
        .update({
          Key: { session_id: pPerson },
          UpdateExpression: "set responsible_for = :r",
          ExpressionAttributeValues: {
            ":r": rArray
          },
          TableName: "SessionsV2",
        })
        .promise()
        .catch(error => {
          clt({ 'Bad update to Sessions - caught error is': error });
        });
    }
  }
}

export async function prepareTargets(pPerson, pClient_id, options) {
  if (targetPerson === pPerson) {
    return { targetArray, targetObj };
  }
  let includeGroups = false;
  let includePeople = true;
  if (options) {
    if (options.includeGroups) { includeGroups = options.includeGroups; };
    if (options.includePeople) { includePeople = options.includePeople; };
  }
  if (!pClient_id) {
    let peopleRec = await getPerson(pPerson);
    pClient_id = peopleRec.client_id;
  }
  let responsibleList = [];   // legacy format
  let responsibleObj = {};
  let groupObj = await getGroupsBelongTo(pPerson);
  let allGroupArr = Object.keys(groupObj);
  if (allGroupArr.length === 0) { return []; }
  if (includeGroups) {   // first, add a list of groups that you are responsible for (if requested)
    allGroupArr.forEach(g => {
      if (groupObj[g].role === 'responsible') {
        responsibleList.push(`${groupObj[g].group_name}:GRP//${profile.client_id}/${groupObj[g].group_id}`);
        let gKey = `GRP//${profile.client_id}/${groupObj[g].group_id}`;
        responsibleObj[gKey] = {
          group_id: groupObj[g].group_id,
          type: 'group',
          client_id: profile.client_id,
          name: groupObj[g].group_name,
          search: `${groupObj[g].group_name}`
        };
      }
    });
  }
  if (includePeople) {   // then, add any individual in a group that you are responsible for OR are a member of
    let responseObj = await getMemberList(allGroupArr, profile.client_id);
    let allPeopleArr = responseObj.peopleList;
    if (allPeopleArr.length > 0) {
      allPeopleArr.forEach(p => {
        responsibleList.push(((`${p.name?.last}, ${p.name?.first}:${p.person_id}:${p.search_data} ${((typeof p.messaging) === 'object') ? JSON.stringify(p.messaging) : ''}`).trim()));
        responsibleObj[p.person_id] = {
          person_id: p.person_id,
          type: 'person',
          name: p.name,
          search: p.search_data,
          messaging: p.messaging
        };
      });
    }
  }
  return { responsibleList, responsibleObj };
}

export async function getGroupHierarchy(pClient_id, options) {
  /* options can be as follows (all optional and treated as FALSE is missing)
  {
    sort: true,    return the names sorted at each level of the hierarchy
    displayList: true     returns an array with [ {level: <n>, name: <name>, selectable: <boolean>}, {}, ... ]
  }
  */
  if (!pClient_id) {
    if (session) { pClient_id = session.client_id; }
    else return {};
  }
  let qParm = {
    KeyConditionExpression: 'client_id = :c',
    ExpressionAttributeValues: { ':c': pClient_id, ':a': 'admin', ':p': 'parent' },
    FilterExpression: 'group_type IN (:a, :p)',
    TableName: "Groups"
  };
  let groupRec = await dbClient
    .query(qParm)
    .promise()
    .catch(error => {
      cl({
        'Error reading Groups': error,
        client_id: `<${pClient_id}>`
      });
    });
  if (!recordExists(groupRec)) { return {}; }
  let hierarchy = {};
  let customRec = await getCustomizations('client_name', pClient_id);
  let nameObj = { 'ALL': `All ${customRec.customization_value} Accounts` };
  let parentObj = { 'ALL': '' };
  // first pass - all admin level groups are added to their parent
  for (let g = 0; g < groupRec.Items.length; g++) {
    if (!groupRec.Items[g].belongs_to) { groupRec.Items[g].belongs_to = 'ALL'; }
    let thisGroup = groupRec.Items[g];
    if (thisGroup.group_type === 'admin') {
      if (!hierarchy.hasOwnProperty(thisGroup.belongs_to)) {
        hierarchy[thisGroup.belongs_to] = {};
      }
      hierarchy[thisGroup.belongs_to][thisGroup.group_id] = {};
      nameObj[thisGroup.group_id] = thisGroup.name;
      parentObj[thisGroup.group_id] = thisGroup.belongs_to;
      let cKey = `${pClient_id}//${thisGroup.group_id}`;
      groupRecs[cKey] = thisGroup;
      groupRec.Items.splice(g, 1);
      g--;
    }
  }
  // what's left behind is an array of all the parents
  // loop through looking for a parent that was mentioned in the prior loop
  let count = 0;
  let thisGroup;
  let withChildren;
  do {
    count++;
    for (let g = 0; g < groupRec.Items.length; g++) {
      thisGroup = groupRec.Items[g];
      if (hierarchy.hasOwnProperty(thisGroup.group_id)) {
        withChildren = Object.assign({}, hierarchy[thisGroup.group_id]);
        delete hierarchy[thisGroup.group_id];
        // does my parent already exist in the tree somewhere?
        let [success, result] = recursiveSearch(hierarchy);
        if (success) {
          hierarchy = result;
        }
        else {
          hierarchy[thisGroup.belongs_to] = {};
          hierarchy[thisGroup.belongs_to][thisGroup.group_id] = withChildren;
        };
        nameObj[thisGroup.group_id] = thisGroup.name;
        parentObj[thisGroup.group_id] = thisGroup.belongs_to;
        groupRec.Items.splice(g, 1);
        g--;
      }
    }
  } while ((groupRec.Items.length > 0) && (count < 20));

  // manipulate the output:
  if (!options) { return hierarchy; }
  if (options.sort) { return recursiveSort(hierarchy, [], 0); }
  return hierarchy;

  function recursiveSearch(searchObj) {
    let oKeys = Object.keys(searchObj);
    if (oKeys.length === 0) { return [false, {}]; }
    if (oKeys.includes(thisGroup.belongs_to)) { // parent found
      searchObj[thisGroup.belongs_to][thisGroup.group_id] = withChildren;
      return [true, searchObj];
    }
    else {
      for (let g = 0; g < oKeys.length; g++) {
        let [success, result] = recursiveSearch(searchObj[oKeys[g]]);
        if (success) {
          searchObj[oKeys[g]] = result;
          return [true, searchObj];
        }
      }
      return [false, {}];
    }
  }

  function recursiveSort(searchObj, response, level) {
    if (Object.keys(searchObj).length === 0) { return []; }
    let oKeys = Object.keys(searchObj).sort((a, b) => {
      if (nameObj[a] > nameObj[b]) { return 1; }
      else { return -1; }
    });
    for (let g = 0; g < oKeys.length; g++) {
      let selectable = (Object.keys(searchObj[oKeys[g]]).length === 0);
      response.push({
        id: oKeys[g],
        level,
        belongs_to: parentObj[oKeys[g]],
        name: nameObj[oKeys[g]],
        selectable
      });
      if (!selectable) { response = recursiveSort(searchObj[oKeys[g]], response, level + 1); }
    }
    return response;
  }
}

export async function getPublicGroupList(pClient_id, person_id, options) {
  if (!pClient_id) {
    if (session) { pClient_id = session.client_id; }
    else return {};
  }
  let qParm = {
    KeyConditionExpression: 'client_id = :c',
    ExpressionAttributeValues: { ':c': pClient_id, ':a': 'open', ':p': 'public' },
    FilterExpression: 'group_type IN (:a, :p)',
    TableName: "Groups"
  };
  let groupRec = await dbClient
    .query(qParm)
    .promise()
    .catch(error => {
      cl({
        'Error reading Groups': error,
        client_id: `<${pClient_id}>`
      });
    });
  if (!recordExists(groupRec)) { return {}; }
  groupRec.Items.sort((a, b) => {
    if (a.name > b.name) { return 11; }
    else { return -1; }
  });
  let response = {};
  for (let g = 0; g < groupRec.Items.length; g++) {
    let thisGroup = groupRec.Items[g];
    let role = await getRole(thisGroup.group_id, person_id);
    response[thisGroup.group_id] = {
      group_name: thisGroup.name,
      group_id: thisGroup.group_id,
      role
    };
  }
  return response;
}

export async function getAllGroups(person_id, client_id) {
  let responseData = {};
  let profile = await getPerson(person_id);
  if (!client_id) {
    let session = await getSession(person_id);
    if (session) { client_id = session.client_id; }
    if (!client_id) { return { adminHierarchy: [], publicGroups: {}, privateGroups: {}}; }
  }
  responseData.adminHierarchy = await getGroupHierarchy(client_id, { sort: true });
  responseData.adminHierarchy.forEach(a => {
    if (a.selectable && profile?.groups?.includes(a.id)) {
      responseData.selectedID = a.id;
    }
  });
  responseData.publicGroups = await getPublicGroupList(client_id, person_id);
  responseData.privateGroups = await getGroupsBelongTo(person_id, { sort: true });
  responseData.adminHierarchy.forEach(a => { delete responseData.privateGroups[a.id]; });
  for (let gID in responseData.publicGroups) { delete responseData.privateGroups[gID]; }
  return responseData;
};
