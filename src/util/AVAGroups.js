import { cl, clt, recordExists, makeArray, getCustomizations, dbClient, deepCopy, titleCase } from './AVAUtilities';
import { AVAname, getPerson, getSession } from '../util/AVAPeople';
import { makeDate } from './AVADateTime';

let profile, session;
let groupRecs = {};
let targetObj = {};
let targetArray = [];
let targetPerson = null;
let loadedGroupObj = {};
let loadedPerson = null;
// Module-level hierarchy cache: populated by getAllGroups at bootstrap, consumed by addMember/removeMember
// Structure: { adminHierarchy: [{id, belongs_to, level, name}], parent_of: {parentId: [childId, ...]} }
let cachedHierarchy = null;

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

export async function accountAccess(person_id, pClient_id) {
  // Does my person account designate an account_class?
  let myPeopleRec = await getPerson(person_id);
  let myClass;
  let accessList = {};
  let respList = {};
  let proxyList = [];
  let birthdayList = {};
  if (myPeopleRec.account_class) {
    myClass = myPeopleRec.account_class;
  }
  else {
    // What admin group do I belong to in the client_id?
    let allGroupObject = await getAllGroups(person_id, pClient_id);
    let myAdminGroup = await getGroup(allGroupObject.selectedID, pClient_id);
    if (myAdminGroup.admin_class) {
      myClass = myAdminGroup.admin_class;
    }
    else {
      let clientGroupAssignments = await getCustomizations('group_assignments', pClient_id);
      if (clientGroupAssignments && clientGroupAssignments.customization_value) {
        for (let accountClass in clientGroupAssignments.customization_value) {
          if (makeArray(clientGroupAssignments.customization_value[accountClass]).includes(myAdminGroup.group_id)) {
            myClass = accountClass;
            break;
          }
        }
      }
      if (!myClass) {
        myClass = 'local';
      }
    }
  }
  // Now get a list of people that I can access
  let myGroupAccessLevel = [];
  let groups_person_belongsTo, rejectObject;
  if (myClass !== 'inactive') {
    if (!session || (session.session_id !== person_id)) {
      session = await getSession(person_id);
    }
    if (!session.hasOwnProperty('responsible_for')) {
      session.responsible_for = [];
    }
    let accessLevelTable = ['none', 'restricted', 'view', 'proxy', 'full'];
    let clientList = [pClient_id];
 /*   if (((myClass === 'support') || (myClass === 'admin'))
      && (myPeopleRec.hasOwnProperty('clients') && Array.isArray(myPeopleRec.clients))) {
      myPeopleRec.clients.forEach(c => {
        if (!clientList.includes(c.id)) { clientList.push(c.id); }
      });
    }
    else if (myClass === 'master') {
      clientList = await getAllClients();
    };  */
    for (let client_id of clientList) {
      // for each client that I have access to, get the client name and logo for display purposes
      let clientName = await getCustomizations('client_name', client_id);
      let clientLogo = await getCustomizations('logo', client_id);
      console.log({ check_access: { client_id, clientName } });

      accessList[client_id] = {
        name: clientName.customization_value,
        logo: clientLogo.icon,
        count: {},
        list: [],
        groups: {}
      };

      // establish my authority to each group in this client; we'll use this later to determine my access level to each person in the client based on their group membership  
      [groups_person_belongsTo, rejectObject,] = await getGroupAccess(client_id, person_id);
      const accessibleGroups = [];
      for (const [key, value] of Object.entries(Object.assign({}, groups_person_belongsTo, rejectObject))) {
        if (value.is_accessible) {
          accessibleGroups.push(key);
        }
      };
      myGroupAccessLevel = accessibleGroups;

      respList[client_id] = {
        name: clientName.customization_value,
        logo: clientLogo.icon,
        count: {},
        list: []
      };
      let options = {};
      accessLevelTable.forEach(a => { accessList[client_id].count[a] = 0; });
      if (['master', 'support', 'admin'].includes(myClass)) {
        // options = { withSession: true };
      }
      if (client_id !== session.client_id) {
        options = { nameOnly: true };
      }
      let allPeople = await getMemberList('*all', client_id, options);
      // get all the people in the client
      for (let this_person of allPeople.peopleList) {
        // for each person...  I am allowed access to them or not?
        let accessLevel = 'none';
        if (['master', 'admin'].includes(myClass)   // if I am a support or master class user
          || (this_person.may_proxy_to && this_person.may_proxy_to.hasOwnProperty(person_id))  // or the person record we're looking at granted permission for me to proxy to them
          || (session.responsible_for.includes(this_person.person_id))
          || (this_person.person_id === person_id)  // the person is ME
        ) {
          accessLevel = 'proxy';    // then I get FULL (level 3) access to this person
        }
        else if (this_person.groups?.some(g => accessibleGroups.includes(g))) {
          // my access is dependent on what groups this person belongs to and what access I have to those groups based on the accessibleGroups array built above
          // accessLevelTable = ['none', 'restricted', 'view', 'proxy', 'full'];
          accessLevel = 'view';   // at least view (level 2) access to this person because I have access to at least one of their groups
        }
        if (accessLevel !== 'none') {
          if (this_person?.local_data?.['date of birth']) {
            let dob = makeDate(this_person.local_data['date of birth'], { forceForward: true });
            if (!birthdayList.hasOwnProperty(dob.numeric$)) {
              birthdayList[dob.numeric$] = [];
            }
            birthdayList[dob.numeric$].push({
              person_id: this_person.person_id,
              display_name: `${this_person.name.first} ${this_person.name.last}`,
            });
          }
          if ((accessLevel === 'proxy') || (accessLevel === 'full')) {
            proxyList.push(this_person.person_id);
          };
          let pRec2Push = {
            person_id: this_person.person_id,
            name: this_person.name,
            first: this_person.name.first,
            last: this_person.name.last,
            display_name: `${this_person.name.first} ${this_person.name.last}`,
            preferred_method: this_person.preferred_method,
            id: this_person.person_id,
            access: accessLevel,
            signature_key: this_person.signature_key || null
          };
          if (client_id === session.client_id) {
            pRec2Push.directory_option = this_person.directory_option;
            pRec2Push.groups = this_person.groups;
            pRec2Push.location = this_person.location;
            pRec2Push.messaging = this_person.messaging;
            pRec2Push.member_of = this_person.account_class;
            pRec2Push.search_data = this_person.search_data;
            pRec2Push.session = this_person.session;
          };
          if (session.responsible_for.includes(this_person.person_id) || (this_person.person_id === person_id)) {
            respList[client_id].list.push(pRec2Push);
          }
          else {
            accessList[client_id].list.push(pRec2Push);
          }
        }
      };
      // sort names within this client
      respList[client_id].list.sort((a, b) => {
        if (a.last > b.last) { return 1; }
        else if (a.last < b.last) { return -1; }
        else if (a.first > b.first) { return 1; }
        else if (a.first < b.first) { return -1; }
        else { return 0; }
      });
      accessList[client_id].list.unshift(...respList[client_id].list);
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
      });
      accessList[client_id].groups = myGroupAccessLevel;
    }
    if (myClass === 'family') {
      if (['none', 'na', 'cancelled', 'inactive'].includes(session.subscription_status)) {
        accessList.subscription = {
          subscription_active: false,
          subscription_status: session.subscription_status
        };
      }
      else {
        accessList.subscription = {
          subscription_active: true,
          subscription_status: session.subscription_status
        };
      }
    }
  }
  accessList.belongs_to = [];
  for (const b2 in groups_person_belongsTo) {
    if (groups_person_belongsTo[b2].belongs_to) { accessList.belongs_to.push(groups_person_belongsTo[b2].group_id); }
  };
  accessList.birthdayList = deepCopy(birthdayList);
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
    let activeClients = everyClient.Items.filter(this_client => {
      return (!this_client.disabled);
    });
    activeClients.sort((a, b) => {      // sort by client name
      if (a.customization_value > b.customization_value) { return 1; }
      else { return -1; }
    });
    returnArray = activeClients.map(c => {
      return c.client_id;
    });
  }
  return returnArray;
}

export async function isMemberOf(client_id, person_id, pGroup_id) {
  if (!loadedPerson || (loadedPerson !== person_id)) {
    loadedGroupObj = await getGroupsBelongTo(client_id, person_id);
  }
  return (Object.keys(loadedGroupObj).includes(pGroup_id));
};

export async function getGroupAccess(client_id, person_id, options) {
  var groups_person_belongsTo = {};
  var rejectObject = {};
  // first, get a list of every group in this client
  if (!client_id && session) {
    client_id = session.client_id;
  }
  let qParm = {
    KeyConditionExpression: 'client_id = :c',
    ExpressionAttributeValues: { ':c': client_id },
    TableName: "Groups"
  };
  let everyGroup = await dbClient
    .query(qParm)
    .promise()
    .catch(error => {
      cl({
        'Error reading Groups': error,
        client_id: `<${client_id}>`
      });
    });
  if (!recordExists(everyGroup)) {
    return [groups_person_belongsTo, rejectObject];
  }

  let classList = [];
  let my_personRec = {};
  if (options && options.personRec) { 
    my_personRec = options.personRec;
  }
  else {
    my_personRec = await getPerson(person_id);
  }
  const is_admin = ['master', 'admin'].includes(my_personRec?.account_class || 'local');

  // Pass zero - assure that my group list is correct.
  // If I am a member of a group, I am also a member of its parent
  for (let this_group of my_personRec.groups) { 
    let findParent = (child_id) => {
      everyGroup.Items.forEach(g => {
        if (g.group_id === child_id) {
          if (g.belongs_to) {
            if (!my_personRec.groups.includes(g.belongs_to)) {
              my_personRec.groups.push(g.belongs_to);
            }
            findParent(g.belongs_to);
          }
        }
      });
    };
    findParent(this_group);
  }

  let may_access = new Set();
  // first pass evaluates what each group has declared that its own members may do; 
  // may_access will be a list of groups that the person_id is granted access to by virtue of their membership in specific groups
  // example - members of the "independent_living" group may access "all_assisted_living" 
  // everyGroup.Items.forEach(this_group => {
  for (let this_group of everyGroup.Items) {
    if (my_personRec.groups.includes(this_group.group_id)) {
      // I am a member of the group, we're going to note may ability to access them in the may_access object, which will be used later when we evaluate my access to each person in the client based on their group membership
      if (this_group.may_access) {
        let mayAccessList = makeArray(this_group.may_access);
        if (mayAccessList.includes('*self')) {
          may_access.add(this_group.group_id);
          mayAccessList = mayAccessList.filter(id => id !== '*self');
        }
        for (const id of mayAccessList) {
          may_access.add(id);
        }
      }
    }
  }

  // second pass evaluates what each group has declared about granting access to itself
  // example - the "bridge_club" group declares that any member of "independent_living" may access their group
  for (let this_group of everyGroup.Items) {
    let is_accessible = false;
    if (is_admin || this_group.group_type === 'public') { is_accessible = true; }
    else if (this_group.accessible_to) {
      for (let this_access_rule of this_group.accessible_to) {
        switch (this_access_rule.split(':')[0].trim()) {
          case '*all': { is_accessible = true; break; }
          case '*admin': { if (is_admin) { is_accessible = true; } break; }  // redundant since we check is_admin at the top of the loop, but we'll leave it in case we want to add other admin-like classes in the future
          case '*support': { if (['master', 'support', 'admin'].includes(my_personRec.account_class)) { is_accessible = true; } break; }
          case 'person': { if (this_access_rule.split(':')[1].trim() === person_id) { is_accessible = true; } break; }
          case 'group': { if (my_personRec.groups.includes(this_access_rule.split(':')[1].trim())) { is_accessible = true; } break; }
          case '*members': { if (my_personRec.groups.includes(this_group.group_id)) { is_accessible = true; } break; }
          case 'class': { if (this_access_rule.split(':')[1].trim() === my_personRec.account_class) { is_accessible = true; } break; }
          case 'group_type': { if (this_access_rule.split(':')[1].trim() === this_group.group_type) { is_accessible = true; } break; }
          default: { cl({ 'Unrecognized access rule type': this_access_rule.split(':')[0].trim() }); }
        }
      }
    }
    else if (may_access.has(this_group.group_id)) {  // redundant but included for clarity
      is_accessible = true;
    }
    if (is_accessible) {
      may_access.add(this_group.group_id);
    }
  }

  // third pass finds children and grandchildren of groups I belong to and marks me as belonging to them as well; this will allow the fourth pass to recognize that I have access to those descendant groups by virtue of my membership in the parent group
  for (const good_group of may_access) { 
    let findChildren = (parent_id) => {
      everyGroup.Items.forEach(g => {
        if (g.belongs_to === parent_id) {
          may_access.add(g.group_id);
          my_personRec.groups.push(g.group_id);  // this will trick the fourth pass into marking me as a member of descendant groups
          findChildren(g.group_id);
        }
      });
    };
    findChildren(good_group);
  }


  // fourth pass prepares the response
  for (let this_group of everyGroup.Items) {
    // console.log(`evaluating_group: ${this_group.group_id}`);
    let is_accessible = may_access.has(this_group.group_id);
    let is_responsible = this_group?.admin_list?.includes(person_id);
    const belongs_to = my_personRec.groups.includes(this_group.group_id);
    const resultObj = {
      group_name: this_group.name,
      group_id: this_group.group_id,
      role: is_responsible ? 'responsible' : (belongs_to ? 'member' : 'non-member'),
      admin_class: this_group.admin_class,
      is_accessible,
      is_responsible,
      belongs_to
    };
    if (resultObj.role === 'non-member' && !is_accessible) {
      rejectObject[this_group.group_id] = resultObj;
    }
    else {
      groups_person_belongsTo[this_group.group_id] = resultObj;
    }
  }

  loadedPerson = person_id;
  return [groups_person_belongsTo, rejectObject, classList];
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

export async function getGroupsBelongTo(client_id, person_id, options = {}) {
  let [groups_person_belongsTo, ,] = await getGroupAccess(client_id, person_id, options);

  loadedPerson = person_id;
  loadedGroupObj = groups_person_belongsTo;
  if (options && options.sort) {
    // put each object in an array of objects, then sort that array and return an object sequenced by the sort
    let gArray = [];
    for (let gID in groups_person_belongsTo) { gArray.push(groups_person_belongsTo[gID]); }
    gArray.sort((a, b) => {
      if (a.group_name > b.group_name) { return 1; }
      else { return -1; }
    });
    let newObject = {};
    gArray.forEach(g => { newObject[g.group_id] = g; });
    return newObject;
  }
  else { return groups_person_belongsTo; }
};

export async function getAuthObject(request) {
  /* 
  AuthObj in response will set permission level for default, people (as person_id), 
  groups (as GRP//group_id), and flavors (as FLAV//flavor).  For each key, value should be:
    0 = none
    1 = minimal, I may see name only
    3 = basic, I may see name and location
    5 = contact detail, I may see contact information
    7 = edit, I may update person information
    9 = proxy
  */
  if (!request.userRec) {
    if (!request.user_id) {
      return {
        source: 'Error',
        authObj: { default: 0 }
      };
    }
    else {
      request.userRec = await getPerson(request.user_id);
    }
  }
  // if account_class is 'master' or 'support' grant full authority
  if (request.userRec.account_class && (['master', 'support'].includes(request.userRec.account_class))) {
    return {
      source: `User Account_class ${request.userRec.person_id}//${request.userRec.account_class}`,
      authObj: { default: 9 }
    };
  }
  // set based on the user's group
  if (request.session) {
    if (request.session.group_precedence) {
      if (Array.isArray(request.session.group_precedence)) {
        let lowIndex = 999;
        request.userRec.groups.forEach(uGroup => {
          let foundIndex = request.session.group_precedence.indexOf(uGroup);
          if ((foundIndex > -1) && (foundIndex < lowIndex)) {
            lowIndex = foundIndex;
          }
        });
        if (lowIndex < 999) {
          let targetGroupRec = await getGroup(request.session.group_precedence[lowIndex], request.session.client_id);
          if (targetGroupRec) {
            cl({ 'HighestPrecedentGroup': targetGroupRec.group_id });
            if (targetGroupRec.authorities) {
              return {
                source: `Authority granted to the highest precedent Group I belong to = ${targetGroupRec.group_id}`,
                authObj: targetGroupRec.authorities
              };
            }
            else if (targetGroupRec.flavor && request.session.group_flavors) {
              let foundFlavor = request.session.group_flavors.find(fItem => {
                return (fItem.flavor === targetGroupRec.flavor);
              });
              if (foundFlavor) {
                return {
                  source: `Flavor of the Group I belong to that has the highest precedent = ${targetGroupRec.group_id}//${foundFlavor.flavor}`,
                  authObj: foundFlavor.authorities
                };
              }
              else {
                cl({ 'Flavor for HighestPrecedentGroup not in Customization group_flavors': targetGroupRec.group_id });
              }
            }
            else {
              cl({ 'HighestPrecedentGroup has neither Authority nor Flavor': targetGroupRec.group_id });
            }
          }
        }
        else {
          cl({ 'None of these User groups in precendent list': request.userRec.groups });
        }
      };
    }
    else {
      cl('No precendent list in Customizations');
    }
    // set based on the user's group with the highest priority flavor
    if (request.session.group_flavors) {
      let lowFlavor = 999;
      let winningGroup;
      for (let g = 0; g < request.userRec.groups.length; g++) {
        if (lowFlavor > 0) {
          let userGroupRec = await getGroup(request.userRec.groups[g], request.session.client_id);
          if (userGroupRec) {
            if (!userGroupRec.flavor && userGroupRec.admin_class) {
              userGroupRec.flavor = userGroupRec.admin_class;
            }
            if (userGroupRec.flavor) {
              let foundFlavorIndex = request.session.group_flavors.findIndex(fItem => {
                return (fItem.flavor === userGroupRec.flavor);
              });
              if ((foundFlavorIndex > -1) && (foundFlavorIndex < lowFlavor)) {
                lowFlavor = foundFlavorIndex;
                winningGroup = request.userRec.groups[g];
              }
            }
          }
        }
      };
      if (lowFlavor < 999) {
        let foundFlavor = request.session.group_flavors[lowFlavor];
        return {
          source: `Highest precedent flavor associated with a Group I belong to = ${winningGroup}//${foundFlavor.flavor}`,
          authObj: foundFlavor.authorities
        };
      }
      else {
        cl({ 'None of these User groups have a flavor in the flavor list': request.userRec.groups });
      }
    }
    else {
      cl('No flavor list in Customizations');
    }
    // set based on the user's admin group
    let allGroupObject = await getAllGroups(request.userRec.person_id, request.session.client_id);
    let userAdminGroupRec = await getGroup(allGroupObject.selectedID, request.session.client_id);
    if (userAdminGroupRec) {
      if (userAdminGroupRec.authorities) {
        return {
          source: `Authority granted to my Admin group = ${userAdminGroupRec.group_id}`,
          authObj: userAdminGroupRec.authorities
        };
      }
      else if (userAdminGroupRec.flavor && request.session.group_flavors) {
        let foundFlavor = request.session.group_flavors.find(fItem => {
          return (fItem.flavor === userAdminGroupRec.flavor);
        });
        if (foundFlavor) {
          return {
            source: `Flavor of my Admin group = ${userAdminGroupRec.group_id}//${foundFlavor.flavor}`,
            authObj: foundFlavor.authorities
          };
        }
      }
      else {
        cl({ 'The Admin group has neither an authority nor a flavor': userAdminGroupRec.group_id });
      }
    }
    // set based on the default authority for this client
    if (request.session.default_authority) {
      return {
        source: 'Default authority for my client',
        authObj: request.session.default_authority
      };
    }
    else {
      cl({ 'There is no default authority for this client': request.session.client_id });
    }
  }
  // failed on every effort
  return {
    source: 'Failed to find any sources',
    authObj: { default: 0 }
  };
}

export async function getGroup(pGroup_id, pClient_id) {
  if (!pClient_id) {
    if (pGroup_id && pGroup_id.includes('//')) { [pClient_id, pGroup_id] = pGroup_id.split('//'); }
    else if (session) {
      pClient_id = session.client_id;
    }
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
  // will return 'responsible' if you are responsible for this group, 'member' if you are a member of this group, and 'non-member' if you are not a member of this group
  // if pGroup is an array of group_ids, will return 'member' if you are a member of all of the groups in the array, and 'non-member' if you are not a member of at least one of the groups in the array 
  let pSession = await getSession(pPerson);
  if (!Array.isArray(pGroup)) {
    if ((('responsible_for' in pSession) && (pSession.responsible_for.some(g => g.split('~')[0].trim() === pGroup)))
      || (('groups_managed' in pSession) && (pSession.groups_managed.some(g => g.split('~')[0].trim() === pGroup)))) {
      return 'responsible';
    }
    else {
      let gRec = await getGroup(pGroup, pSession.client_id);
      if (gRec.admin_list && gRec.admin_list.includes(pPerson)) { return 'responsible'; }
      // am I responsible for this group's parent?
      if (gRec.belongs_to) {
        let parentRole = await getRole(gRec.belongs_to, pPerson);
        if (parentRole === 'responsible') { return 'responsible'; }
      }
    }
    if (await isMemberOf(pSession.client_id, pPerson, pGroup)) { return 'member'; }
    else { return 'non-member'; }
  }
  else {
    if (pGroup.every(async n => {
      return (await isMemberOf(pSession.client_id, pPerson, n));
    })) { return 'member'; }
    else { return 'non-member'; }
  }

}

export function determineClass(gList, group_assignments, options = {}) {
  let groupFlavor = {};
  if (options && options.show_as_inactive) {
    return 'inactive';
  }
  let groupHierarchy = ['inactive', 'admin', 'staff', 'resident', 'student', 'camper', 'family', 'guest', 'vendor', 'other'];
  if (group_assignments) {
    Object.keys(group_assignments).forEach(t => {
      let groups = makeArray(group_assignments[t]);
      let foundAt = groupHierarchy.indexOf(t);
      if (foundAt < 0) { foundAt = groupHierarchy.length - 1; }
      groups.forEach(gCamel => {
        let g = gCamel.toLowerCase();
        if (!groupFlavor.hasOwnProperty(g)) { groupFlavor[g] = foundAt; }
        else { groupFlavor[g] = Math.min(foundAt, groupFlavor[g]); }
      });
    });
  }
  let member_of = groupHierarchy.length - 1;
  if (gList) {
    gList.forEach(gCamel => {
      let g = gCamel.toLowerCase();
      if (groupFlavor.hasOwnProperty(g)) {
        member_of = Math.min(member_of, groupFlavor[g]);
      }
    });
  }
  return groupHierarchy[member_of];
}

/**
 * Checks if a person matches any rule in a group.
 * @param {string|object} groupArg - group_id or groupRec
 * @param {string|object} personArg - person_id or PeopleRec
 * @returns {Promise<boolean>} true if any rule matches, else false
 */
export async function doesPersonMatchGroupRules(client_id, groupArg, personArg) {
  // dbClient and state are available in this module
  let groupRec = groupArg;
  let peopleRec = personArg;
  // Fetch groupRec if only group_id is provided
  if (typeof groupArg === 'string') {
    const group_id = groupArg;
    const result = await dbClient.get({
      Key: { client_id, group_id },
      TableName: 'Groups',
    }).promise().catch(() => null);
    groupRec = result && result.Item ? result.Item : null;
  }
  // Fetch peopleRec if only person_id is provided
  if (typeof personArg === 'string') {
    const person_id = personArg;
    const result = await dbClient.get({
      Key: { person_id },
      TableName: 'People',
    }).promise().catch(() => null);
    peopleRec = result && result.Item ? result.Item : null;
  }
  if (!groupRec || !peopleRec || !Array.isArray(groupRec.rules)) return false;
  for (const rule of groupRec.rules) {
    if (!rule || !rule.source || !Array.isArray(rule.test)) continue;
    // Support dot notation in source, e.g., 'name.last' or 'peopleRec.name.last'
    let sourcePath = rule.source.split('.');
    // Ignore first element if it is 'peopleRec' or 'personRec'
    if (['peopleRec', 'personRec'].includes(sourcePath[0])) {
      sourcePath = sourcePath.slice(1);
    }
    let value = sourcePath.reduce((obj, key) => (obj && obj[key] !== undefined ? obj[key] : undefined), peopleRec);
    if (typeof value === 'string') {
      value = value.toLowerCase();
      if (rule.test.some(testVal => typeof testVal === 'string' && value === testVal.toLowerCase())) {
        return true;
      }
    } else if (Array.isArray(value)) {
      // If value is an array, check if any element matches
      for (const v of value) {
        if (typeof v === 'string' && rule.test.some(testVal => typeof testVal === 'string' && v.toLowerCase() === testVal.toLowerCase())) {
          return true;
        }
      }
    }
  }
  return false;
}

export async function getMemberList(pGroups, pClient_id, options = {}) {
  // returns an array of peopleRecs that are members of the group(s) in pGroups
  // if you happen to include a person_id in the pGroups list, getMemberList returns those too
  let returnArray = [];
  let foundIDs = [];
  let foundGroups = {};
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
    pGroups.forEach(grp => {
      grp = grp.replace('~group:', '');
      gList.push(...(grp.replace(/[[\]]/g, '').split(/,|~/g)));
    });
  }
  else if (pGroups.includes('[')) {
    pGroups = pGroups.replace('~group:', '');
    gList = pGroups.replace(/[[\]]/g, '').split(/,|~/g);
  }
  else { gList = [pGroups]; }
  if (gList.some(g => g.toLowerCase().includes('*all'))) { gList = ['*all']; }

  // CACHE OPTIMIZATION: Check if state.accessList has pre-loaded data
  if (options.state?.accessList?.[defaultClient]?.list && gList.length > 0) {
    console.log('✅ Using CACHED accessList for groups:', gList);
    console.time('⏱️ Cache filtering');
    let cachedPeople = options.state.accessList[defaultClient].list;
    console.log(`📊 Cached people count: ${cachedPeople.length}`);

    // Filter cached people by group membership
    for (let person of cachedPeople) {
      if (foundIDs.includes(person.person_id)) continue;

      // Check if person belongs to any of the requested groups or is the person_id itself
      let matches = gList.includes('*all') ||
        gList.some(grp => {
          return (person?.groups?.includes(grp)) || person.person_id === grp;
        });

      if (matches) {
        foundIDs.push(person.person_id);
        if (options.name_and_search) {
          returnArray.push({
            person_id: person.person_id,
            name: person.name ?? { last: `Unknown ${person.person_id}` },
            display_name: person.display_name ?? AVAname(person),
            search_data: person.search_data ?? `${person.name?.first || ''} ${person.name?.last || ''} ${person.location || ''} ${(person.messaging) ? Object.values(person.messaging).join(' ') : ''}`.trim(),
          });
        }
        else if (options.nameOnly) {
          returnArray.push({
            person_id: person.person_id,
            name: person.name ?? { last: `Unknown ${person.person_id}` },
            display_name: person.display_name ?? AVAname(person),
          });
        }
        else {
          returnArray.push(deepCopy(person));
        }
      }
    }

    console.log(`📊 Filtered to ${returnArray.length} people`);
    console.timeEnd('⏱️ Cache filtering');

    // Sort if needed
    if (sortResults) {
      console.time('⏱️ Sorting');
      returnArray.sort((a, b) => {
        if (a.name.last > b.name.last) { return 1; }
        else if (a.name.last < b.name.last) { return -1; }
        else if (a.name.first > b.name.first) { return 1; }
        else if (a.name.first < b.name.first) { return -1; }
        else { return 0; }
      });
      console.timeEnd('⏱️ Sorting');
    }

    let rObj = {
      foundIDs,
      'peopleList': returnArray,
      'groupList': gList
    };

    if (shortList) {
      rObj.shortList = returnArray.map(p => {
        let searchString = [...Object.values(p.name), p.search_data, p.location].join(' ');
        if (p.messaging) { searchString += Object.values(p.messaging).join(' '); }
        return `${p.name.last}, ${p.name.first}:${p.person_id}:${searchString}`;
      });
    }

    return rObj;
  }

  console.log('❌ Cache NOT available, using DB query for groups:', gList);
  console.time('⏱️ Database query');
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
    do {
      let gPeopleRecs = await dbClient
        .query(qParm)
        .promise()
        .catch(error => {
          cl({ 'Bad scan on People in getMemberList - caught error is': error });
        });
      if (gPeopleRecs && gPeopleRecs.LastEvaluatedKey) {
        qParm.ExclusiveStartKey = gPeopleRecs.LastEvaluatedKey;
      }
      else {
        delete qParm.ExclusiveStartKey;
      }
      if (recordExists(gPeopleRecs)) {
        // OPTIMIZATION: Collect all unique group IDs that need to be fetched
        let groupsToFetch = new Set();
        let peopleToProcess = [];

        for (let p = 0; p < gPeopleRecs.Items.length; p++) {
          let i = deepCopy(gPeopleRecs.Items[p]);
          if (!foundIDs.includes(i.person_id)) {
            foundIDs.push(i.person_id);
            if (!checkExclude || (i.directory_option !== 'exclude')) {
              if (!i.name) { i.name = { last: `Unknown ${i.person_id}` }; }
              if (!i.messaging) { i.messaging = { ava_only: `AVA` }; }
              i.display_name = AVAname(i);

              // Collect groups that need fetching
              if (!options.nameOnly && i.groups) {
                for (let g = 0; g < i.groups.length; g++) {
                  if (!foundGroups.hasOwnProperty(i.groups[g])) {
                    groupsToFetch.add(i.groups[g]);
                  }
                }
              }

              peopleToProcess.push(i);
            }
          }
        }

        // OPTIMIZATION: Fetch all needed groups in parallel
        if (groupsToFetch.size > 0) {
          const groupFetchPromises = Array.from(groupsToFetch).map(groupId =>
            getGroup(groupId, client).then(groupRec => ({ groupId, groupRec }))
          );
          const groupResults = await Promise.all(groupFetchPromises);
          groupResults.forEach(({ groupId, groupRec }) => {
            foundGroups[groupId] = groupRec;
          });
        }

        // OPTIMIZATION: Fetch all sessions in parallel if needed
        if (options && options.withSession) {
          const sessionPromises = peopleToProcess.map(i =>
            getSession(i.person_id).then(session => ({ person_id: i.person_id, session }))
          );
          const sessionResults = await Promise.all(sessionPromises);
          const sessionMap = {};
          sessionResults.forEach(({ person_id, session }) => {
            sessionMap[person_id] = session;
          });
          peopleToProcess.forEach(i => {
            i.session = sessionMap[i.person_id];
          });
        }

        // Process people with cached group data
        for (let i of peopleToProcess) {
          if (options.nameOnly) {
            returnArray.push({
              person_id: i.person_id,
              name: i.name,
              display_name: i.display_name
            });
          }
          else {
            // if you belong to a group that has a parent, you belong to the parent
            if (i.groups) {
              for (let g = 0; g < i.groups.length; g++) {
                if ((foundGroups[i.groups[g]]?.belongs_to) && (!i.groups.includes(foundGroups[i.groups[g]].belongs_to))) {
                  i.groups.push(foundGroups[i.groups[g]].belongs_to);
                }
              }
            }
            returnArray.push(i);
          }
        }
      }
    } while (qParm.ExclusiveStartKey);
  };
  console.timeEnd('⏱️ Database query');
  console.log(`📊 DB query returned ${returnArray.length} people`);

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
  };
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

/**
 * Synchronize all People records in a client with dynamic group rules.
 * For each person, removes all dynamic group memberships, then adds those for which the person matches the rules.
 * Leaves non-dynamic group memberships untouched.
 * @param {string} client_id - The client to process
 * @param {Array} dynamicGroups - Array of dynamic group objects (must include group_id and rules[])
 * @param {object} [options] - Optional: { logger, progressCallback }
 */
export async function syncDynamicGroupsForClient(client_id, dynamicGroups, options = {}) {
  if (!client_id || !Array.isArray(dynamicGroups)) return;
  const logger = options.logger || console;
  const progress = options.progressCallback;
  // 1. Get all People records for this client
  let qParm = {
    KeyConditionExpression: 'client_id = :c',
    ExpressionAttributeValues: { ':c': client_id },
    TableName: 'People',
    IndexName: 'client_id-index',
  };
  let allPeople = [];
  let lastEvaluatedKey = undefined;
  do {
    if (lastEvaluatedKey) qParm.ExclusiveStartKey = lastEvaluatedKey;
    let result = await dbClient.query(qParm).promise().catch(e => { logger.error('Error querying People', e); });
    if (result && result.Items) allPeople.push(...result.Items);
    lastEvaluatedKey = result && result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  logger.info(`Found ${allPeople.length} people in client ${client_id}`);
  let dynamicGroupIDs = dynamicGroups.map(g => g.group_id);
  let updatedCount = 0;
  for (let i = 0; i < allPeople.length; i++) {
    let person = allPeople[i];
    let origGroups = Array.isArray(person.groups) ? [...person.groups] : [];
    // Remove all dynamic group IDs
    let newGroups = origGroups.filter(gid => !dynamicGroupIDs.includes(gid));
    // For each dynamic group, check if person matches
    for (let dg of dynamicGroups) {
      let matches = await doesPersonMatchGroupRules(client_id, dg, person);
      if (matches) newGroups.push(dg.group_id);
    }
    // Only update if changed
    // (sort for stable comparison)
    newGroups.sort();
    origGroups.sort();
    if (JSON.stringify(newGroups) !== JSON.stringify(origGroups)) {
      await dbClient.update({
        Key: { person_id: person.person_id },
        UpdateExpression: 'set groups = :g',
        ExpressionAttributeValues: { ':g': newGroups },
        TableName: 'People',
      }).promise().catch(e => logger.error('Error updating person', person.person_id, e));
      updatedCount++;
      if (logger.info) logger.info(`Updated ${person.person_id}: ${origGroups} -> ${newGroups}`);
    }
    if (progress && typeof progress === 'function') progress(i + 1, allPeople.length);
  }
  logger.info(`syncDynamicGroupsForClient: Updated ${updatedCount} of ${allPeople.length} people.`);
  return { updated: updatedCount, total: allPeople.length };
}

export async function getGroupMembers(request = {}) {
  /*
    request...
      group_id - string: a single group to look for
      groupList - array: an array of groups to look for
      ignore_exclude - boolean: true = return even if (directory_option === 'exclude'); false or missing = respect directory option
      short - boolean: true = return only name, id, and search; false or missing = name, id, search, messaging, member_of
      ignore_unlisted - boolean: true = return messaging info, even if private is set
      with_responsible - boolean: true = add responsible_for
    return an array of objects  
  */
  if (!request.groupList) {
    if (request.group_id) {
      request.groupList = [request.group_id];
    }
    else {
      return [];
    }
  }
  let response = [];
  let all_groups = (request.groupList.includes('*all'));
  if (!request.client_id) {
    request.client_id = session.client_id;
  }
  // retrieve every account in the client; 
  let gPeopleRecs = await dbClient
    .query({
      KeyConditionExpression: 'client_id = :c',
      ExpressionAttributeValues: { ':c': request.client_id },
      TableName: "People",
      IndexName: "client_id-index",
    })
    .promise()
    .catch(error => {
      cl({ 'Bad scan on People in getGroupMembers - caught error is': error });
    });
  if (recordExists(gPeopleRecs)) {
    gPeopleRecs.Items.forEach(personRec => {
      if (personRec.groups && [personRec.groups].flat().some(this_group => {
        return (all_groups || request.groupList.includes(this_group) || request.groupList.includes(personRec.person_id));
      })) {
        let this_response = {
          person_id: personRec.person_id,
          display_name: (`${personRec.name.first.trim()} ${personRec.name.last.trim()}`),
          first_name: personRec.name.first,
          last_name: personRec.name.last,
          search_data: personRec.search_data
        };
        if (!request.short) {
          this_response.member_of = deepCopy(personRec.groups);
          for (const mType in personRec.messaging) {
            if (!mType.includes('_private')) {
              if (request.ignore_unlisted || !personRec.messaging[`${mType}_private`]) {
                this_response[mType] = personRec.messaging[mType];
              }
            }
          }
        }
        response.push(this_response);
      }
    });
    if (request.withResponsible) {
      for (let rN = 0; rN < response.length; rN++) {
        let sessionRec = await getSession(response[rN].person_id);
        if (sessionRec?.responsible_for) {
          response[rN].responsible_for = makeArray(sessionRec.responsible_for);
        }
      }
    }
    let ascending = true;
    let sort_by = 'display_name';
    if (request.sort) {
      if (request.sort.sort_by) {
        sort_by = request.sort.sort_by;
      }
      if (request.sort.descending) {
        ascending = false;
      }
    }
    response.sort((a, b) => {
      if (a[sort_by] > b[sort_by]) {
        return (ascending ? 1 : -1);
      }
      else {
        return (ascending ? -1 : 1);
      }
    });
    return response;
  }
}

export async function createNewGroup({ client_id, group_name, belongs_to, adminList, memberList, madeFromGroup }) {
  cl({ 'in createNewGroup with': { client_id, group_name, belongs_to, adminList, memberList } });
  if (!group_name) { return; }
  let newGroupID = 'group_' + group_name.replace(' ', '').substr(0, 5) + '_' + new Date().getTime();
  let newGroupRec = Object.assign({},
    madeFromGroup,
    {
      client_id: client_id,
      group_id: newGroupID,
      admin_list: makeArray(adminList),
      group_type: (madeFromGroup ? 'admin' : 'open'),
      belongs_to: (madeFromGroup ? madeFromGroup.group_id : null),
      name: group_name,
      common_activities: []
    },
  );
  await dbClient
    .put({
      Item: newGroupRec,
      TableName: "Groups"
    })
    .promise()
    .catch(error => {
      clt({ 'Bad put to Groups - caught error is': error });
    });
  for (const this_member of makeArray(memberList)) {
    await addMember(this_member, client_id, newGroupID);
  };
  for (const this_admin of makeArray(adminList)) {
    var sessionRec = await dbClient
      .get({
        Key: { 'session_id': this_admin },
        TableName: 'SessionsV2'
      })
      .promise()
      .catch(error => {
        clt({ 'Bad get on SessionsV2 - caught error is': error });
      });
    if (recordExists(sessionRec)) {
      if (!sessionRec.Item.groups_managed) {
        sessionRec.Item.groups_managed = [`${newGroupID} ~ ${group_name}`];
      }
      else {
        sessionRec.Item.groups_managed.push(`${newGroupID} ~ ${group_name}`);
      }
    }
    await dbClient
      .update({
        Key: { 'session_id': this_admin },
        UpdateExpression: "set #n = :n",
        ExpressionAttributeValues: {
          ":n": sessionRec.Item.groups_managed
        },
        ExpressionAttributeNames: {
          "#n": "groups_managed"
        },
        TableName: 'SessionsV2'
      })
      .promise()
      .catch(error => {
        clt({ 'Bad update on SessionsV2 - caught error is': error });
      });
  }
  return newGroupID;
}

export async function addMember(pPerson, pClient, pGroup, options = {}) {
  /*
    pGroup may be a single group_id string or an array of group_ids.
    Each group passed should be a LEAF group (no children in the hierarchy).
    addMember will:
      1. By default, reject (skip with a warning) any group that has children.
         Pass options.allowParent = true to bypass this check (e.g. direct UI drag-drop).
      2. Write PeopleGroups rows for the group AND every ancestor up the chain.
      3. Update People.groups[] with the same full set.
      4. Fire onAdd group_rules for each leaf group written (unless options._ruleDepth > 0).
  */
  const leafGroupsRequested = makeArray(pGroup);

  // Ensure hierarchy cache is available; fall back to loading it if called before bootstrap
  if (!cachedHierarchy) {
    const h = await getGroupHierarchy(pClient, { sort: true });
    cachedHierarchy = { adminHierarchy: h.hierarchy, parent_of: h.parent_of };
  }
  const { adminHierarchy, parent_of } = cachedHierarchy;

  // Build a quick parent lookup from the hierarchy: child_id → parent_id
  const parentOf = {};
  adminHierarchy.forEach(g => { if (g.belongs_to) { parentOf[g.id] = g.belongs_to; } });

  // Helper: walk up from a leaf, return [leaf, parent, grandparent, ...]
  const ancestorChain = (groupId) => {
    const chain = [groupId];
    let current = groupId;
    while (parentOf[current]) {
      current = parentOf[current];
      chain.push(current);
    }
    return chain;
  };

  // Collect all group_ids to write (leaf + full ancestor chains), deduplicated
  const allGroupsToWrite = new Set();
  for (const g of leafGroupsRequested) {
    // Leaf check: reject if this group has children in the hierarchy (unless caller opts out)
    if (!options.allowParent && parent_of?.[g]?.length > 0) {
      clt({ 'addMember: skipping non-leaf group (has children)': g, 'use a child group instead': parent_of[g] });
      continue;
    }
    ancestorChain(g).forEach(id => allGroupsToWrite.add(id));
  }

  if (allGroupsToWrite.size === 0) { return; }

  const groupsArray = Array.from(allGroupsToWrite);

  // Cascade context: personGroups accumulates each person's latest known groups so
  // subsequent rule-triggered calls build on the already-written state.
  // personRecs caches the full People record to avoid redundant DB reads across hops.
  const personGroups = options._personGroups || new Map();
  const personRecs = options._personRecs || new Map();
  let peopleRec;
  if (personRecs.has(pPerson)) {
    peopleRec = personRecs.get(pPerson);
  } else {
    peopleRec = await getPerson(pPerson);
    if (peopleRec?.person_id) { personRecs.set(pPerson, peopleRec); }
  }

  // Single People update: add all new groups in one write.
  // Use personGroups (accumulated cascade state) as the base when available.
  let newGroupList;
  if (peopleRec?.person_id) {
    const baseGroups = personGroups.has(pPerson) ? personGroups.get(pPerson) : makeArray(peopleRec.groups);
    newGroupList = [...baseGroups];
    let changed = false;
    for (const g of groupsArray) {
      if (!newGroupList.includes(g)) { newGroupList.push(g); changed = true; }
    }
    if (changed) {
      await dbClient
        .update({
          Key: { person_id: pPerson },
          UpdateExpression: 'set #g = :g',
          ExpressionAttributeNames: { '#g': 'groups' },
          ExpressionAttributeValues: { ':g': newGroupList },
          TableName: 'People',
        })
        .promise()
        .catch(error => { clt({ 'Bad update to People in addMember - caught error is': error }); });
    }
    // Keep cascade context current so the next rule-triggered call for this person is accurate
    personGroups.set(pPerson, newGroupList);
  } else {
    newGroupList = groupsArray;
  }

  // PeopleGroups: write one record per group in the chain (leaf + all ancestors).
  // For rule-triggered adds (membershipSource === 'withData'):
  //   - skip if an existing 'manual' record is present (admin override is permanent)
  //   - skip if already active (preserves the original join_date)
  // For manual adds: always overwrite (existing behaviour).
  const isRuleTriggered = options.membershipSource === 'withData';
  const joinDate = makeDate(new Date()).numeric;
  const displayName = (peopleRec?.person_id
    ? `${peopleRec.name.last}, ${peopleRec.name.first}`
    : `${pPerson}, Unknown Account`);
  for (const g of groupsArray) {
    if (isRuleTriggered) {
      const existingPG = await dbClient
        .get({ TableName: 'PeopleGroups', Key: { client_group_id: pClient + '~' + g, person_id: pPerson } })
        .promise().catch(() => null);
      const existing = existingPG?.Item;
      if (existing?.membership_source === 'manual') { continue; }   // admin override — never touch
      if (existing?.membership_status === 'active') { continue; }    // already set — preserve join_date
    }
    await dbClient
      .put({
        Item: {
          client_group_id: pClient + '~' + g,
          person_id: pPerson,
          display_name: displayName,
          membership_status: 'active',
          membership_source: options.membershipSource || 'manual',
          join_date: joinDate,
          roles: ['patient']
        },
        TableName: 'PeopleGroups'
      })
      .promise()
      .catch(error => { clt({ 'Bad put to PeopleGroups in addMember - caught error is': error }); });
  }

  // Fire onAdd rules for each group written — leaf + ancestors.
  // firedRules tracks (triggerType:group_id:person_id) keys already processed in this cascade,
  // preventing any group's rules from firing twice for the same person while still allowing
  // full rule chains (rules triggered by rules) to propagate.
  {
    const firedRules = options._firedRules || new Set();
    for (const g of allGroupsToWrite) {
      const key = `onAdd:${g}:${pPerson}`;
      if (!firedRules.has(key)) {
        firedRules.add(key);
        await applyGroupRules('onAdd', pPerson, pClient, g, firedRules, personGroups, personRecs);
      }
    }
  }

  return newGroupList;
}

export async function removeMember(pPerson, pClient, pGroup, options = {}) {
  /*
    pGroup may be a single group_id string or an array of group_ids.
    removeMember will:
      1. Remove the specified leaf groups from People.groups[] and mark their PeopleGroups rows inactive.
      2. For each removed group's ancestor chain, check if the person still has any OTHER active leaf
         membership that still reaches that ancestor. If not, also remove the ancestor row (orphan cleanup).
      3. Fire onRemove group_rules for each leaf group removed (unless options._ruleDepth > 0).
  */
  const leafGroupsToRemove = makeArray(pGroup);

  // Ensure hierarchy cache is available
  if (!cachedHierarchy) {
    const h = await getGroupHierarchy(pClient, { sort: true });
    cachedHierarchy = { adminHierarchy: h.hierarchy, parent_of: h.parent_of };
  }
  const { adminHierarchy, parent_of } = cachedHierarchy;

  // Build parent lookup: child_id → parent_id
  const parentOf = {};
  adminHierarchy.forEach(g => { if (g.belongs_to) { parentOf[g.id] = g.belongs_to; } });

  const ancestorChain = (groupId) => {
    const chain = [];
    let current = parentOf[groupId];
    while (current) {
      chain.push(current);
      current = parentOf[current];
    }
    return chain;  // ancestors only (not the leaf itself)
  };

  // Load the person's current active groups from PeopleGroups (authoritative source via person-index GSI)
  const pgResult = await dbClient.query({
    TableName: 'PeopleGroups',
    IndexName: 'person-index',
    KeyConditionExpression: 'person_id = :p AND membership_status = :s',
    ExpressionAttributeValues: { ':p': pPerson, ':s': 'active' }
  }).promise().catch(error => { clt({ 'Bad query on PeopleGroups in removeMember': error }); });
  const currentGroups = (pgResult?.Items || [])
    .filter(row => row.client_group_id.startsWith(pClient + '~'))
    .map(row => row.client_group_id.split('~')[1]);

  // Cascade context: use accumulated groups and cached People records if available.
  const personGroups = options._personGroups || new Map();
  const personRecs = options._personRecs || new Map();
  const effectiveGroups = personGroups.has(pPerson) ? personGroups.get(pPerson) : currentGroups;

  // The remaining leaf groups after this removal (used for orphan ancestor check)
  const remainingLeafs = effectiveGroups.filter(g => {
    // A group is a leaf if it has no children
    return !parent_of?.[g]?.length && !leafGroupsToRemove.includes(g);
  });

  // For each ancestor of each removed group, check if any remaining leaf still reaches it
  const orphanedAncestors = new Set();
  for (const g of leafGroupsToRemove) {
    for (const ancestor of ancestorChain(g)) {
      // Does any remaining leaf group have this ancestor in its own chain?
      const stillReached = remainingLeafs.some(remainingLeaf => {
        let current = parentOf[remainingLeaf];
        while (current) {
          if (current === ancestor) { return true; }
          current = parentOf[current];
        }
        return false;
      });
      if (!stillReached) { orphanedAncestors.add(ancestor); }
    }
  }

  const allGroupsToRemove = [...leafGroupsToRemove, ...orphanedAncestors];

  // Single People update: remove all affected groups in one write
  // ConditionExpression guards against accidentally creating a stub People record for a non-existent person
  const newGroupList = effectiveGroups.filter(g => !allGroupsToRemove.includes(g));
  await dbClient
    .update({
      Key: { person_id: pPerson },
      UpdateExpression: 'set #g = :g',
      ExpressionAttributeNames: { '#g': 'groups' },
      ExpressionAttributeValues: { ':g': newGroupList },
      ConditionExpression: 'attribute_exists(person_id)',
      TableName: 'People',
    })
    .promise()
    .catch(error => {
      if (error?.code !== 'ConditionalCheckFailedException') {
        clt({ 'Bad update to People in removeMember - caught error is': error });
      }
    });

  // Keep cascade context current so subsequent rule-triggered calls for this person are accurate
  personGroups.set(pPerson, newGroupList);

  // PeopleGroups: soft-delete all affected rows (leaf + orphaned ancestors)
  const removedDate = makeDate(new Date()).numeric;
  for (const g of allGroupsToRemove) {
    await dbClient
      .update({
        Key: { client_group_id: pClient + '~' + g, person_id: pPerson },
        UpdateExpression: 'set membership_status = :s, removed_date = :d, membership_source = :src',
        ExpressionAttributeValues: { ':s': 'inactive', ':d': removedDate, ':src': 'manual' },
        TableName: 'PeopleGroups'
      })
      .promise()
      .catch(error => { clt({ 'Bad update to PeopleGroups in removeMember - caught error is': error }); });
  }

  // Fire onRemove rules for each group removed — leaf + orphaned ancestors.
  // firedRules prevents the same group's rules from firing twice for the same person in a cascade.
  {
    const firedRules = options._firedRules || new Set();
    for (const g of allGroupsToRemove) {
      const key = `onRemove:${g}:${pPerson}`;
      if (!firedRules.has(key)) {
        firedRules.add(key);
        await applyGroupRules('onRemove', pPerson, pClient, g, firedRules, personGroups, personRecs);
      }
    }
  }

  // Return the person's complete new group list for caller use
  return newGroupList;
}

/**
 * Resolves the family_id for a person: People.family_groups[0] || People.family_id.
 * Then queries FamilyGroups to return { primary_id, all_ids[] }.
 * Returns null if no family record found.
 */
async function getFamilyMembers(person_id, client_id) {
  const personRec = await getPerson(person_id);
  const family_id = (personRec?.family_groups?.[0]) || personRec?.family_id;
  if (!family_id) { return null; }
  const fgRec = await dbClient
    .get({
      TableName: 'FamilyGroups',
      Key: { client_id, composite_key: family_id },
    })
    .promise()
    .catch(error => { clt({ 'getFamilyMembers error reading FamilyGroups': error }); });
  if (!recordExists(fgRec)) { return null; }
  const primary_id = fgRec.Item?.primary_contact?.id || null;
  const other_ids = (fgRec.Item?.other_members || []).map(m => m.id).filter(Boolean);
  return { primary_id, all_ids: [primary_id, ...other_ids].filter(Boolean) };
}

/**
 * Loads the group record for group_id, finds rules matching triggerType ('onAdd' | 'onRemove'),
 * resolves the who-list for each rule/action, and calls addMember or removeMember as appropriate.
 * firedRules (a Set) is threaded through all recursive calls to prevent any group's rules from
 * firing more than once for the same person in a single cascade.
 */
async function applyGroupRules(triggerType, person_id, client_id, group_id, firedRules, personGroups = new Map(), personRecs = new Map()) {
  // Load the group record to get group_rules
  const gRec = await dbClient
    .get({
      TableName: 'Groups',
      Key: { client_id, group_id },
    })
    .promise()
    .catch(error => { clt({ 'applyGroupRules error reading Groups': error }); });
  if (!recordExists(gRec)) { return; }
  const group_rules = gRec.Item?.group_rules;
  if (!group_rules?.length) { return; }

  const matchingRules = group_rules.filter(r => r.rule_type === triggerType);
  if (!matchingRules.length) { return; }

  for (const rule of matchingRules) {
    for (const action of (rule.actions || [])) {
      // Resolve who-list
      let whoIds = [];
      const who = action.who || 'self';
      if (who === 'self') {
        whoIds = [person_id];
      } else {
        // allFamily or primary: look up the family record
        const family = await getFamilyMembers(person_id, client_id);
        if (!family) {
          clt({ 'applyGroupRules: no family record found for who rule': { person_id, who, group_id } });
          continue;
        }
        whoIds = (who === 'primary')
          ? (family.primary_id ? [family.primary_id] : [])
          : (who === 'otherFamily')
            ? family.all_ids.filter(id => id !== person_id)
            : family.all_ids;
      }

      const where = action.where?.length ? action.where : [group_id];

      for (const targetPerson of whoIds) {
        for (const targetGroup of where) {
          if (action.action === 'addMember') {
            await addMember(targetPerson, client_id, targetGroup, { _firedRules: firedRules, _personGroups: personGroups, _personRecs: personRecs, membershipSource: 'withData' });
          } else if (action.action === 'removeMember') {
            await removeMember(targetPerson, client_id, targetGroup, { _firedRules: firedRules, _personGroups: personGroups, _personRecs: personRecs });
          }
        }
      }
    }
  }
}

/**
 * Returns all active group_ids for person_id in the given client from the PeopleGroups table.
 */
export async function getPersonGroups(person_id, client_id) {
  const pgResult = await dbClient.query({
    TableName: 'PeopleGroups',
    IndexName: 'person-index',
    KeyConditionExpression: 'person_id = :p AND membership_status = :s',
    ExpressionAttributeValues: { ':p': person_id, ':s': 'active' }
  }).promise().catch(error => { clt({ 'Bad query on PeopleGroups in getPersonGroups': error }); });
  return (pgResult?.Items || [])
    .filter(row => row.client_group_id.startsWith(client_id + '~'))
    .map(row => row.client_group_id.split('~')[1]);
}

/**
 * Fires onAdd rules for every current active member of the given group.
 * Useful for backfilling rules that were created after members were already added.
 *
 * @param {string}   group_id         The group whose onAdd rules should be backfilled.
 * @param {string}   client_id        Client identifier.
 * @param {function} onProgress       Optional callback({ done, total, person_id }) called after each person.
 */
export async function backfillOnAddRule(group_id, client_id, onProgress) {
  // Load all PeopleGroups records for this group, filter inactive in JS
  let allItems = [];
  let lastKey;
  const cgid = `${client_id}~${group_id}`;
  cl({ 'backfillOnAddRule: querying': cgid });
  do {
    const params = {
      TableName: 'PeopleGroups',
      IndexName: 'status-index',
      KeyConditionExpression: 'client_group_id = :cgid',
      ExpressionAttributeValues: { ':cgid': cgid },
    };
    if (lastKey) { params.ExclusiveStartKey = lastKey; }
    const result = await dbClient.query(params).promise()
      .catch(error => { clt({ 'backfillOnAddRule query error': error }); return null; });
    const page = (result?.Items || []).filter(item =>
      !item.membership_status || item.membership_status === 'active'
    );
    allItems = allItems.concat(page);
    lastKey = result?.LastEvaluatedKey;
  } while (lastKey);

  cl({ 'backfillOnAddRule: found members': allItems.length });
  const total = allItems.length;
  for (let i = 0; i < allItems.length; i++) {
    const person_id = allItems[i].person_id;
    const firedRules = new Set([`onAdd:${group_id}:${person_id}`]);
    await applyGroupRules('onAdd', person_id, client_id, group_id, firedRules);
    if (onProgress) { onProgress({ done: i + 1, total, person_id }); }
  }
  return total;
}

/**
 * Returns true if group_id is a leaf group for the given person — i.e., the person belongs to
 * none of group_id's children. Groups containing '_top_' always return false.
 * Loads and persists cachedHierarchy if not already available (using client_id).
 *
 * @param {string}   group_id        The group to test.
 * @param {string[]} personGroupIds  All group_ids the person belongs to (e.g., from getPersonGroups).
 * @param {string}   client_id       Used to load the hierarchy cache if not yet populated.
 */
export async function isLeaf(group_id, personGroupIds, client_id) {
  if (!group_id || group_id.toLowerCase().includes('_top_')) { return false; }
  if (!cachedHierarchy) {
    const h = await getGroupHierarchy(client_id, { sort: true });
    cachedHierarchy = { adminHierarchy: h.hierarchy, parent_of: h.parent_of };
  }
  const { parent_of } = cachedHierarchy;
  const hasChildren = parent_of?.[group_id]?.length > 0;
  const belongsToChild = hasChildren && parent_of[group_id].some(child_id => personGroupIds.includes(child_id));
  return !belongsToChild;
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
  let groupObj = await getGroupsBelongTo(pClient_id, pPerson);
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
  let messagingObj = { '__TOP__': [] };
  let parentObj = { '__TOP__': '' };   // this object tells who the parent is for each parentObj[group_id]
  let classObj = { '__TOP__': 'other' };
  let responsibleObj = { '__TOP__': [] };

  // first pass - all admin level groups are added to their parent
  for (let g = 0; g < groupRec.Items.length; g++) {
    if (!groupRec.Items[g].belongs_to) { groupRec.Items[g].belongs_to = '__TOP__'; }
    let thisGroup = groupRec.Items[g];
    // **** NOTE: I think we nee to include group_types 'open' and 'public' in this test to assure they are accessible
    if ((thisGroup.group_type === 'admin') || (thisGroup.group_type === 'parent')) {
      if (!hierarchy.hasOwnProperty(thisGroup.belongs_to)) {
        hierarchy[thisGroup.belongs_to] = {};
      }
      hierarchy[thisGroup.belongs_to][thisGroup.group_id] = {};
      nameObj[thisGroup.group_id] = thisGroup.name;
      messagingObj[thisGroup.group_id] = [];
      if (thisGroup.common_activities && (thisGroup.common_activities.length > 0)) {
        thisGroup.common_activities.forEach(activity => {
          if (typeof (activity) === 'string') {
            let matchResult = activity.match(/(.+)~\[default={recipientID:(.+),recipientName:(.+)\}\]~\[title=(.+)\]/);
            if (matchResult) {
              let [str, inst, pers, pName, pText] = matchResult;
              console.log(str);
              if (inst === 'form.make_message') {
                messagingObj[thisGroup.group_id].push({
                  personList: [pers],
                  personNames: [pName],
                  objText: pText
                });
              }
            }
          }
          else if ((activity.activity_code === 'form.make_message') && (activity.default && activity.default.recipientID)) {
            messagingObj[thisGroup.group_id].push({
              personList: [activity.default.recipientID].flat(),
              personNames: [activity.default.recipientName || new Array([activity.default.recipientID].flat().length)].flat(),
              objText: activity.title
            });
          }
        });
      }
      parentObj[thisGroup.group_id] = thisGroup.belongs_to;
      responsibleObj[thisGroup.group_id] = thisGroup.admin_list;
      classObj[thisGroup.group_id] = thisGroup.admin_class || 'other';
      let cKey = `${pClient_id}//${thisGroup.group_id}`;
      groupRecs[cKey] = thisGroup;
    }
  }
  // hierarchy now contains every group with children
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
        messagingObj[thisGroup.group_id] = [];
        if (thisGroup.common_activities && (thisGroup.common_activities.length > 0)) {
          // eslint-disable-next-line
          thisGroup.common_activities.forEach(activity => {
            if (typeof (activity) === 'string') {
              let matchResult = activity.match(/(.+)~\[default={recipientID:(.+),recipientName:(.+)\}\]~\[title=(.+)\]/);
              if (matchResult) {
                let [str, inst, pers, pName, pText] = matchResult;
                console.log(str);
                if (inst === 'form.make_message') {
                  messagingObj[thisGroup.group_id].push({
                    personList: [pers],
                    personNames: [pName],
                    objText: titleCase(pText.toLowerCase().replace('send a message to', '')).trim()
                  });
                }
              }
            }
            else if ((activity.activity_code === 'form.make_message') && (activity.default && activity.default.recipientID)) {
              messagingObj[thisGroup.group_id].push({
                personList: [activity.default.recipientID].flat(),
                personNames: [activity.default.recipientName || new Array([activity.default.recipientID].flat().length)].flat(),
                objText: activity.title
              });
            }
            else if ((activity.activity_code === 'form.make_message') && (activity.default && activity.default.recipientID)) {
              messagingObj[thisGroup.group_id].push({
                personList: [activity.default.recipientID].flat(),
                personNames: [activity.default.recipientName || new Array([activity.default.recipientID].flat().length)].flat(),
                objText: titleCase(activity.title.toLowerCase().replace('send a message to', '')).trim()
              });
            }
          });
        }
        parentObj[thisGroup.group_id] = thisGroup.belongs_to;
        classObj[thisGroup.group_id] = thisGroup.admin_class || 'other';
        responsibleObj[thisGroup.group_id] = thisGroup.admin_list;
        groupRec.Items.splice(g, 1);
        g--;
      }
    }
  } while ((groupRec.Items.length > 0) && (count < 20));

  // build parent_of object
  let parent_of = {};
  for (let top_level in hierarchy) {
    addChild(top_level, hierarchy[top_level]);
  }
  function addChild(parent, target) {
    for (let my_child in target) {
      if (!parent_of.hasOwnProperty(parent)) { parent_of[parent] = [my_child]; }
      else { parent_of[parent].push(my_child); }
      let grandchildren = addChild(my_child, target[my_child]);
      if (grandchildren) { parent_of[parent].push(...grandchildren); };
    }
    return parent_of[parent];
  }

  // manipulate the output:
  if (!options) {
    return ({
      preferred_recipients: messagingObj,
      group_names: nameObj, group_tree: hierarchy, hierarchy, parent_of
    });
  }
  if (options.sort) {
    return ({
      group_names: nameObj,
      preferred_recipients: messagingObj,
      group_tree: hierarchy,
      hierarchy: recursiveSort(hierarchy, [], 0),
      parent_of
    });
  }
  return ({
    preferred_recipients: messagingObj,
    group_names: nameObj, group_tree: hierarchy, hierarchy, parent_of
  });

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
        selectable,
        admin_class: classObj[oKeys[g]],
        admin_list: responsibleObj[oKeys[g]]
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
    if (a.name > b.name) { return 1; }
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

export async function getPrivateGroupList(pClient_id, person_id, options) {
  if (!pClient_id) {
    if (session) { pClient_id = session.client_id; }
    else return {};
  }
  let qParm = {
    KeyConditionExpression: 'client_id = :c',
    ExpressionAttributeValues: { ':c': pClient_id, ':p': 'private' },
    FilterExpression: 'group_type = :p',
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
    if (a.name > b.name) { return 1; }
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

/**
 * Fetches public, private, and dynamic groups for a client and person in a single query.
 * Returns { publicGroups, privateGroups, dynamicGroups } for use in state.groups.
 */
export async function getAllGroupTypes(pClient_id, person_id) {
  session = await getSession(person_id);
  if (!pClient_id) {
    if (session) { pClient_id = session.client_id; }
    else { return { publicGroups: {}, privateGroups: {}, dynamicGroups: [] }; }
  }
  // Query all groups for this client
  let qParm = {
    KeyConditionExpression: 'client_id = :c',
    ExpressionAttributeValues: { ':c': pClient_id },
    TableName: "Groups"
  };
  let groupRec = await dbClient
    .query(qParm)
    .promise()
    .catch(error => {
      cl({ 'Error reading Groups': error, client_id: `<${pClient_id}>` });
    });
  if (!recordExists(groupRec)) { return { publicGroups: {}, privateGroups: {}, dynamicGroups: [] }; }
  // Sort by name for consistency
  groupRec.Items.sort((a, b) => (a.name > b.name ? 1 : -1));
  let publicGroups = {};
  let adminGroups = {};
  let privateGroups = {};
  let dynamicGroups = [];
  for (let thisGroup of groupRec.Items) {
    let role = await getRole(thisGroup.group_id, person_id);
    if (thisGroup.group_type === "private") {
      privateGroups[thisGroup.group_id] = {
        group_name: thisGroup.name,
        group_id: thisGroup.group_id,
        role
      };
    }
    else if (thisGroup.group_type === "public" || thisGroup.group_type === "open") {
      publicGroups[thisGroup.group_id] = {
        group_name: thisGroup.name,
        group_id: thisGroup.group_id,
        role
      };
    }
    else if (thisGroup.group_type === "admin" || thisGroup.group_type === "parent") {
      // Admin groups are handled separately in getGroupHierarchy, so we can skip them here
      adminGroups[thisGroup.group_id] = {
        group_name: thisGroup.name,
        group_id: thisGroup.group_id,
        role
      };
    }
    // Dynamic: dynamic_group === true
    if (thisGroup.dynamic_group === true) {
      dynamicGroups.push({
        group_id: thisGroup.group_id,
        group_name: thisGroup.name,
        rules: thisGroup.rules || []
      });
    }
  }
  return { publicGroups, privateGroups, dynamicGroups, adminGroups };
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
  let session = await getSession(person_id);
  if (!client_id) {
    if (session) { client_id = session.client_id; }
    if (!client_id) { return { adminHierarchy: [], publicGroups: {}, privateGroups: {}, dynamicGroups: [] }; }
  }
  // Use consolidated group fetch
  const { publicGroups, privateGroups, dynamicGroups } = await getAllGroupTypes(client_id, person_id);
  // Retain adminHierarchy and other hierarchy data if needed
  let gHResponse = await getGroupHierarchy(client_id, { sort: true });
  responseData.adminHierarchy = gHResponse.hierarchy;
  responseData.groupTree = gHResponse.group_tree;
  responseData.preferred_recipients = gHResponse.preferred_recipients;
  responseData.groupNames = gHResponse.group_names;
  responseData.parent_of = gHResponse.parent_of;
  responseData.publicGroups = publicGroups;
  responseData.privateGroups = privateGroups;
  responseData.dynamicGroups = dynamicGroups;
  // Remove admin groups from privateGroups and publicGroups for consistency
  responseData.adminHierarchy.forEach(a => { delete responseData.privateGroups[a.id]; delete responseData.publicGroups[a.id];});
  for (let gID in responseData.publicGroups) { delete responseData.privateGroups[gID]; }
  // Populate module-level hierarchy cache for use by addMember/removeMember
  cachedHierarchy = { adminHierarchy: responseData.adminHierarchy, parent_of: responseData.parent_of };
  return responseData;
};
