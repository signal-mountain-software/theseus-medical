import { cl, clt, recordExists, makeArray, getCustomizations, dbClient } from './AVAUtilities';
import { AVAname, getPerson, getSession } from '../util/AVAPeople';
import { SET_ACCESSLIST } from '../contexts/Session/actions';

let profile, session;
let groupRecs = {};
let groupObj = {};
let targetObj = {};
let targetArray = [];
let targetPerson = null;
let loadedGroupObj = {};
let loadedPerson = null;

/* 
**********************

   AVA GROUPS

   group_type        
   --------------
   admin           groups based on who you are; an account belongs to exactly ONE admin group 
   parent          a group that owns one or more other groups; an account is assigned to this group because it belongs to one of its children or grandchildren
   open            groups available for any account to join - equivalient to "public"
   public          groups available for any account to join - equivalient to "open"
   private         groups that require a group administrator to add you to

   admin_class     associated with the single admin group this account belongs to, describes what information is available to members of this group        
   --------------
   local           see table below <local is the default if missing admin_class is invalid or missing> 
   family          see table below
   inactive        all actions prohibited for any account in the client that this group is a part of
   support         members may view, proxy, and edit any account in the client that this group is a part of
   master          members may view, proxy, and edit any account from any client

   local and family class access rules
   ------------------------------------
   Other members of a group I am a member of = local may view; family has no access (respect privacy rules)
   Other members of a group that I manage = view (ignore privacy rules)
   Members of a group that I am not a member of = depends on "view_group" attribute of group you are viewing
   Specific individual accounts or groups that I am responsible for or manage (SessionsV2 table) = view, proxy, and edit
   Specific individual accounts or groups that I have a relationship with = based on the access_type of the specific relationship


**********************   
*/

// Functions

export async function accountAccess(person_id, pClient_id, dispatch) {
  // Does my person account designate an account_class?
  let myPeopleRec = await getPerson(person_id);
  let myClass;
  if (myPeopleRec.account_class) {
    myClass = myPeopleRec.account_class;
  }
  else {
    // What admin group do I belong to in the client_id?
    let allGroupObject = await getAllGroups(person_id, pClient_id);
    let myAdminGroup = await getGroup(allGroupObject.selectedID);
    myClass = myAdminGroup.admin_class || 'local';
  }
  // Now get a list of people that I can access
  let accessList = {};
  if (myClass !== 'inactive') {
    let accessLevelTable = ['none', 'view', 'proxy', 'full'];
    let myGroupAccessLevel = {};
    let clientList = [pClient_id];
    if ((myClass === 'support')
      && (myPeopleRec.hasOwnProperty('clients') && Array.isArray(myPeopleRec.clients))) {
      myPeopleRec.clients.forEach(c => {
        if (!clientList.includes(c.id)) { clientList.push(c.id); }
      });
    }
    else if (myClass === 'master') {
      clientList = await getAllClients();
    };
    for (let c = 0; c < clientList.length; c++) {
      let client_id = clientList[c];
      let clientName = await getCustomizations('client_name', client_id);
      let clientLogo = await getCustomizations('logo', client_id);
      let clientGroupAssignments = await getCustomizations('group_assignments', client_id);
      // for every group in this client, classify that group by its type (admin, staff, resident, etc...)
      // then establish where in the hierarchy of groups this one belongs
      // store that in an object (groupFlavor) for easy retrieval later
      let groupFlavor = {};
      let groupHierarchy = ['admin', 'staff', 'resident', 'family', 'guest', 'vendor'];
      if (clientGroupAssignments && clientGroupAssignments.customization_value) {
        Object.keys(clientGroupAssignments.customization_value).forEach(t => {
          let groups = makeArray(clientGroupAssignments.customization_value[t]);
          let foundAt = groupHierarchy.indexOf(t);
          if (foundAt < 0) { foundAt = groupHierarchy.length - 1; }
          groups.forEach(g => {
            if (!groupFlavor.hasOwnProperty(g)) { groupFlavor[g] = foundAt; }
            else { groupFlavor[g] = Math.min(foundAt, groupFlavor[g]); }
          });
        });
      }
      accessList[client_id] = {
        name: clientName.customization_value,
        logo: clientLogo.icon,
        count: {},
        list: []
      };
      accessLevelTable.forEach(a => { accessList[client_id].count[a] = 0; }); 
      let allPeople = await getMemberList('*all', client_id);
      // get all the people in the client
      let pxL = allPeople.peopleList.length;
      for (let pX = 0; pX < pxL; pX++) {
        let p = allPeople.peopleList[pX];
        // for each person...  I am allowed access to them or not?
        let accessLevel = 'none';
        let myMaxAccessLevelToThisPerson = -1;
        // if I am a support or master class user, I get FULL (level 3) access to all users in this client
        if ((myClass === 'support') || (myClass === 'master')) { myMaxAccessLevelToThisPerson = 3; }
        // also... determine my role in all of the groups in this client
        let personFlavor = 99;
        if (p.groups) {
          let gL = p.groups.length;
          for (let x = 0; x < gL; x++) {
            let g = p.groups[x];
            // this person may belong to multiple groups; each group is assigned a type (flavor) earlier
            // which describes where that group lands in the client's hierarchy of groups
            // a person is given a flavor based on the most significant (lowest hierarchy number) group
            // that this person is a member of
            // 
            // your class (set in your people rec or defaulted above in this code) determines
            // how you are allowed to interact with people of a particular hierarchy
            if (groupFlavor.hasOwnProperty(g)) {
              personFlavor = Math.min(personFlavor, groupFlavor[g]);
            }
            // We're going to remember the access level for each group, so we don't
            // have to recalculate it for each person in the client
            // if we've already calculated my level of access to members of this group, it will be saved 
            // in the myGroupAccessLevel object;  if not, calculate it and save it there
            if (!myGroupAccessLevel.hasOwnProperty(g) && (myMaxAccessLevelToThisPerson < 3)) {
              let myRole = await getRole(g, person_id);
              if (myRole === 'responsible') { myGroupAccessLevel[g] = 3; }
              else {
                // the Group table record for a group MAY contain a view_group attribute
                // if it does, this attribute will contain an object
                // that object is keyed by class of user
                // each key should have a single value with the word (see accessLevelTable above) indicating
                // the level of access granted to users of this class
                // example... the staff group may have a view_group = {'local': 'view'} which would allow 
                //       local users to see (but not proxy to) its members
                let this_group = await getGroup(g, client_id);
                if (!this_group.hasOwnProperty('view_group')) {
                  myGroupAccessLevel[g] = 0;
                }
                else {
                  myGroupAccessLevel[g] = accessLevelTable.indexOf(this_group['view_group'][myClass]);
                }
                if ((myRole === 'member') && (myClass === 'local')) {
                  myGroupAccessLevel[g] = Math.max(1, myGroupAccessLevel[g]);
                }
              }
            }
            if (myGroupAccessLevel[g] > myMaxAccessLevelToThisPerson) { myMaxAccessLevelToThisPerson = myGroupAccessLevel[g]; }
          }
        }
        if (myMaxAccessLevelToThisPerson > 0) { accessLevel = accessLevelTable[myMaxAccessLevelToThisPerson]; }
        if (accessLevel !== 'none') {
          accessList[client_id].list.push({
            person_id: p.person_id,
            name: p.name,
            first: p.name.first,
            member_of: ((personFlavor < 99) ? groupHierarchy[personFlavor] : null),
            last: p.name.last,
            display_name: `${p.name.first} ${p.name.last}`,
            location: p.location,
            directory_option: p.directory_option,
            messaging: p.messaging,
            preferred_method: p.preferred_method,
            id: p.person_id,
            access: accessLevel
          });
        }
      };
      // sort names within this client
      accessList[client_id].list.sort((a, b) => {
        if (a.last > b.last) { return 1; }
        else if (a.last < b.last) { return -1; }
        else if (a.first > b.first) { return 1; }
        else if (a.first < b.first) { return -1; }
        else { return 0; }
      });
      accessList[client_id].shortList = accessList[client_id].list.map(p => { 
        accessList[client_id].count[p.access]++;
        let searchString = [...Object.values(p.name), p.search_data, p.location].join(' ');
        if (p.messaging) { searchString += Object.values(p.messaging).join(' '); }
        // list is of the form <name>:<id>:<search_string>
        return `${p.name.last}, ${p.name.first}:${p.person_id}:${searchString}`;
      })
    }
  }
  dispatch({ type: SET_ACCESSLIST, payload: accessList });
  return accessList;
}

export async function getAllClients() {
  let qParm = {
    FilterExpression: 'custom_key = :c',
    ExpressionAttributeValues: { ':c': 'client_name' },
    TableName: "Customizations"
  };
  let everyClient = await dbClient
    .scan(qParm)
    .promise()
    .catch(error => {
      cl({ 'Error reading for Clients': error });
    });
  let returnArray = [];
  if (recordExists(everyClient)) {
    everyClient.Items.sort((a, b) => {      // sort by client name
      if (a.customization_value > b.customization_value) { return 1; }
      else { return -1; }
    })
    returnArray = everyClient.Items.map(c => { return c.client_id; })
  }
  return returnArray;
}

export async function isMemberOf(person_id, pGroup_id) {
  if (!loadedPerson || (loadedPerson !== person_id)) {
    loadedGroupObj = await getGroupsBelongTo(person_id);
  }
  return (Object.keys(loadedGroupObj).includes(pGroup_id));
};

export async function getGroupsResponsibleFor(person_id, options) {
  if (!session || (session.session_id !== person_id)) {
    session = await getSession(person_id);
  }
  var returnObject = {};
  // First, get Groups that this person explicitly manages (as per the SessionsV2 table)
  if ('groups_managed' in session) {
    for (let g = 0; g < session.groups_managed.length; g++) {
      let gID = session.groups_managed[g].split('~')[0].trim();
      let gRec = await getGroup(gID, session.client_id);
      if (gRec.name) {
        returnObject[gID] = {
          group_name: gRec.name,
          group_id: gID,
          role: 'responsible'
        };
      };
    }
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
  let qParm = {
    KeyConditionExpression: 'client_id = :c',
    ExpressionAttributeValues: { ':c': session.client_id },
    TableName: "Groups"
  };
  let everyGroup = await dbClient
    .query(qParm)
    .promise()
    .catch(error => {
      cl({
        'Error reading Groups': error,
        client_id: `<${session.client_id}>`
      });
    });
  if (recordExists(everyGroup)) {
    for (let g = 0; g < everyGroup.Items.length; g++) {
      let this_group = everyGroup.Items[g];
      if (!(this_group.group_id in returnObject)) {
        if ((this_group.hasOwnProperty('admin_list') && this_group.admin_list.includes(person_id))
        || (options && options.account_class && (['master', 'support'].includes(options.account_class)))) {
          returnObject[this_group.group_id] = {
            group_name: this_group.name,
            group_id: this_group.group_id,
            role: 'responsible'
          };
        }
      };
    }
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
      let [gID,] = session.groups_managed[g].split('~').map(s => { return s.trim(); });
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
  });
}

export async function getGroupsBelongTo(person_id, options) {
  // You belong to all groups that you are responsible for
  var returnObject = await getGroupsResponsibleFor(person_id, options);
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

export function determineClass(gList, group_assignments) {
  let groupFlavor = {};
  let groupHierarchy = ['admin', 'staff', 'resident', 'family', 'guest', 'vendor', 'other'];
  if (group_assignments) {
    Object.keys(group_assignments).forEach(t => {
      let groups = makeArray(group_assignments[t]);
      let foundAt = groupHierarchy.indexOf(t);
      if (foundAt < 0) { foundAt = groupHierarchy.length - 1; }
      groups.forEach(g => {
        if (!groupFlavor.hasOwnProperty(g)) { groupFlavor[g] = foundAt; }
        else { groupFlavor[g] = Math.min(foundAt, groupFlavor[g]); }
      });
    });
  }
  let member_of = groupHierarchy.length - 1;
  if (gList) {
    let gL = gList.length;
    for (let x = 0; x < gL; x++) {
      let g = gList[x];
      if (groupFlavor.hasOwnProperty(g)) {
        member_of = Math.min(member_of, groupFlavor[g]);
      }
    }
  }
  return groupHierarchy[member_of];
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
  let shortList = false;
  if (options) {
    if (options.sort || options.sortResults) {
      sortResults = options.sort || options.sortResults;
    }
    if (options.exclude || options.checkExclude) {
      checkExclude = options.exclude || options.checkExclude;
    }
    if (options.shortList || options.includeShortList) {
      shortList = options.shortList || options.includeShortList;
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
  let rObj = {
    foundIDs,
    'peopleList': returnArray,
    'groupList': gList
  }
  if (shortList) {
    rObj.shortList = returnArray.map(p => {
      let searchString = [...Object.values(p.name), p.search_data, p.location].join(' ');
      if (p.messaging) { searchString += Object.values(p.messaging).join(' '); }
      // list is of the form <name>:<id>:<search_string>
      return `${p.name.last}, ${p.name.first}:${p.person_id}:${searchString}`;
    });
  }
  return rObj;
}

export async function addMember(pPerson, pClient, pGroup) {
  let peopleRec = await getPerson(pPerson);
  if (peopleRec?.person_id) {
    let newGroupList = peopleRec.groups;
    newGroupList.push(pGroup);
    let clientGroups = (Array.isArray(peopleRec.clients) ? peopleRec.clients : [peopleRec.clients]);
    clientGroups.some((cG, ndx) => {
      if (cG.id === pClient) {
        clientGroups[ndx].groups = newGroupList;
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
          ":cg": clientGroups
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
  // make a list of all accounts that you are allowed to proxy into
  // You will see options and authorities based on your OWN user ID (session.user_id),
  // but will be making requests on behalf of whoever you proxy into...
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
  /* 
  if options.sort is TRUE, getGroupHierarchy returns an array with [ {id: <group_id>, belongs_to: <parent_id>, level: <n>, name: <name>, selectable: <boolean>}, {}, ... ] sorted by name within level
  otherwise, getGroupHierarchy returns an object as {'__TOP__': { firstChild-group_ID: { grandchild-group_ID: { great_grandchild-group_ID: {...}}}, secondChild-group_ID: {...}, ...} 
  options can be as follows (all optional and treated as FALSE is missing)
  {
    sort: true,    return the names sorted at each level of the hierarchy   
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
  let hierarchy = {};  // keys are '__TOP__' and any group that has children; value is an object whose keys are the clidren of this entry's key
  let customRec = await getCustomizations('client_name', pClient_id);
  let nameObj = { '__TOP__': customRec.customization_value };   // this object delivers the groups name for each nameObj[group_id]
  let parentObj = { '__TOP__': '' };   // this object tells who the parent is for each parentObj[group_id]
  // first pass - all admin level groups are added to their parent
  for (let g = 0; g < groupRec.Items.length; g++) {
    if (!groupRec.Items[g].belongs_to) { groupRec.Items[g].belongs_to = '__TOP__'; }
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
  // we've passed through every record returned by the query above (get all 'parent' and 'admin' records in the client)
  // since we ignore parents and delete admins, what's left behind is an array of all the parent records
  // loop through these (but no more than 20 times as a safety valve against a run-away loop)
  let count = 0;
  let thisGroup;
  let withChildren;
  do {
    count++;
    for (let g = 0; g < groupRec.Items.length; g++) {
      thisGroup = groupRec.Items[g];
      if (hierarchy.hasOwnProperty(thisGroup.group_id)) {
        // if this parent was identified when building the "admin" loop above, 
        // it will already have a key in the hierarchy
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
  /*
   returns the single admin group that this person_id belongs to in the client_id
     selectedID = admin group that this person_id belongs to in the client_id
   AND three objects containing different types of groups:
     adminHierarchy: [], 
     publicGroups: {}, 
     privateGroups: {}
  */

  let responseData = {};
  let profile = await getPerson(person_id);
  if (!client_id) {
    let session = await getSession(person_id);
    if (session) { client_id = session.client_id; }
    if (!client_id) { return { adminHierarchy: [], publicGroups: {}, privateGroups: {} }; }
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
