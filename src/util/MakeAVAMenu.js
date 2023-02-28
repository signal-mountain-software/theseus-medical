import { resolveVariables, stringToColor, cl, clt, recordExists } from '../util/AVAUtilities';

const AWS = require('aws-sdk');
const AVAIcon = process.env.REACT_APP_AVA_LOGO;

const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

let customObj = {};
let activityObj = {};
let groupObj = {};

export default async (requestor, masterClient, screenStatus, subMenuData = null, forceRefresh = false) => {

  if (forceRefresh) {
    customObj = {};
    activityObj = {};
    groupObj = {};
  };

  let groupList = [];

  // let subMenus = [];
  let numberOfRows = 1000;
  let sectionDetails = {};
  let activityHistory = {};

  // Main line

  let pPerson = requestor.person_id;
  if (!masterClient) { masterClient = requestor.client_id; };
  if (subMenuData) { return await handleSubMenu(subMenuData); }
  else {
    let returnMe = await buildMainMenu(pPerson);
    return returnMe;
  }


  // Functions

  async function handleSubMenu(pSubMenu) {
    let returnArray = [];
    let [sectionColor, sectionIcon] = await getCustomizations(pSubMenu.menu_name);
    let subActivities = await getSubMenu(pSubMenu.event_id, pSubMenu.client_id);
    let aL = subActivities.length;
    if (aL > 0) {
      for (let a = 0; a < aL; a++) {
        let pos = 100 + a;
        let this_row =
          await addRow(
            `${pSubMenu.client_id}//${subActivities[a]}`,   // activity_code
            pSubMenu.event_id,                  // this menu_id                      
            pSubMenu.parent,                    // parent menu_id
            pSubMenu.parent_name,               // parent menu name
            `SUB-${pSubMenu.event_id}-${pos}`,  // sort position
            pSubMenu.menu_name,                 // this menu name
            sectionColor,                       // this menu color
            sectionIcon,                        // this menu icon
            `Sub-menu ${pSubMenu.event_id}`     // why is this row in the menu
          );
        if (this_row) { returnArray.push(this_row); }
      }
    }
    return returnArray;
  }

  async function getSubMenu(pEvent, pClient) {
    let queryObj = {
      KeyConditionExpression: 'client_event_id = :e',
      ExpressionAttributeValues: {
        ':e': `${pClient}~${pEvent}`
      },
      TableName: "ActivityEvent",
      IndexName: 'sequence-index',
    };
    cl(`Get ActivityEvent for ${pClient}~${pEvent}`);
    let mRecs = await dbClient
      .query(queryObj)
      .promise()
      .catch(error => {
        cl({ 'Error reading ActivityEvent': error });
      });
    if (recordExists(mRecs) && (mRecs.Count > 0)) {
      return (mRecs.Items.map(m => { return m.activity_code; }));
    }
    else {
      return [];
    }
  }

  async function buildMainMenu(pPerson) {
    let returnArray = [];
    let sectionSort = '';
    let sectionName = '';
    let sectionColor = '';
    let sectionIcon = '';
    let duplicateCheck = [];
    let menuStructure = [{ menuName: 'main', currentSection: '' }];

    // Get Favorites from the People record
    // ({ '** FAVORITES **': (requestor.favorite_activities || 'no favorite activities') });
    sectionSort = '**2';
    sectionName = `${requestor.name.first.trim()}'${requestor.name.first.trim().slice(-1) === 's' ? '' : 's'} favorites`;
    sectionColor = '#6bb44b';
    sectionIcon = 'https://ava-icons.s3.amazonaws.com/icons8-favorite-50.png';
    let aL = 0;
    if (requestor.hasOwnProperty('favorite_activities')) {
      aL = requestor.favorite_activities.length;
      for (let a = 0; a < aL; a++) {
        screenStatus('Loading Favorites', ((a / aL) * 100), ((aL / 40) + .75));
        let this_activity = requestor.favorite_activities[a];
        let this_row = await addRow(this_activity, 'main', null, null, sectionSort, sectionName, sectionColor, sectionIcon, 'Favorite');
        if (this_row) { returnArray.push(this_row); }
      }
    }
    else {
      requestor.favorite_activities = [];
    }

    // Also add anything that you've used 3 or more times recently
    // Get Recent history
    // ({ '** HISTORY **': (activityHistory || 'no history found') });
    if (!('favorite_blocked' in requestor)) { requestor.favorite_blocked = []; }
    sectionSort = '**2a';
    sectionName = `${requestor.name.first.trim()}'${requestor.name.first.trim().slice(-1) === 's' ? '' : 's'} frequently used`;
    sectionColor = '#4bb491';
    sectionIcon = 'https://ava-icons.s3.amazonaws.com/icons8-star-half-empty-50.png';
    activityHistory = await getActivityLog(pPerson);
    let hL = Object.keys(activityHistory).length;
    let h = 0;
    for (const hActivity in activityHistory) {
      h++;
      if ((activityHistory[hActivity].length > 4) &&
        !(requestor.favorite_activities.includes(hActivity)) &&
        !(requestor.favorite_blocked.includes(hActivity))) {
        screenStatus('Frequently Used', ((h / hL) * 100), ((hL / 40) + .75));
        let this_row = await addRow(hActivity, 'main', null, null, sectionSort, sectionName, sectionColor, sectionIcon, 'History');
        if (this_row) { returnArray.push(this_row); }
      }
    }

    // ({ '** PRIORITIES **': (requestor.priority_activities || 'no priority activities') });
    if (requestor.hasOwnProperty('priority_activities')) {
      sectionSort = '**2b';
      sectionName = `${requestor.name.first.trim()}'${requestor.name.first.trim().slice(-1) === 's' ? '' : 's'} priorities`;
      sectionColor = "#a0985f";
      sectionIcon = 'https://ava-icons.s3.amazonaws.com/icons8-idea-sharing-64.png';
      let aL = requestor.priority_activities.length;
      for (let a = 0; a < aL; a++) {
        screenStatus('Priority Items', ((a / aL) * 100), ((aL / 40) + .75));
        let this_activity = requestor.priority_activities[a];
        let this_row = await addRow(this_activity, 'main', null, null, sectionSort, sectionName, sectionColor, sectionIcon, 'Priorities');
        if (this_row) { returnArray.push(this_row); }
      }
    }

    // Get all Groups this person is associated with
    let neededGroups = [];
    requestor.groups.forEach(e => { 
      if (e in groupObj) { groupList.push(groupObj[e]); }
      else { neededGroups.push(e); }
    })
    if (neededGroups.length > 0) {
      let addGroupList = await getGroupsPersonBelongsTo(neededGroups);
      addGroupList.forEach(c => {
        groupList.push(c);
        groupObj[c.group_id] = c;
      });
    }
    groupList.sort((a, b) => {
      if (a.group_id < b.group_id) { return -1; }
      else { return 1; }
    });
    // ('** GROUPS **');
    let allowDuplicates = false;
    let gL = groupList.length;
    for (let g = 0; g < gL; g++) {
      let this_group = groupList[g];
      sectionSort = 'ZZZ';
      sectionName = `Common activities for the ${this_group.name}${!this_group.name.includes('roup') ? ' group' : ''}`;
      sectionColor = stringToColor(sectionName);
      sectionIcon = AVAIcon;
      // (`Checking group ${this_group.group_id} (${this_group.name}): ${(this_group.common_activities || 'no common activities')}`);
      if (!this_group.hasOwnProperty('common_activities')) { continue; }
      let aL = this_group.common_activities.length;
      for (let a = 0; a < aL; a++) {
        screenStatus(`Common activities for ${this_group.name}`, ((a / aL) * 100), ((aL / 40) + .75));
        let this_activity = this_group.common_activities[a];
        if (!allowDuplicates && duplicateCheck.includes(this_activity)) {   // this_activity is already loaded
          continue;
        }
        if (this_activity.startsWith('~~')) {
          if (this_activity.includes('~~duplicate=OK')) {
            allowDuplicates = true;
            this_activity = this_activity.replace('~~duplicate=OK', '');
          }
          else { allowDuplicates = false; }
          let sectionKeys = this_activity.split('~~');
          if (sectionKeys.length > 2) {
            sectionSort = sectionKeys[1];
            sectionName = sectionKeys[2];
          }
          else {
            sectionSort = sectionKeys[1];
            sectionName = sectionKeys[1];
          }
          if (sectionName.startsWith('[')) {
            let [, iType, iValue, iKey] = sectionName.split(/[[\]=:]/);
            switch (iType) {
              case 'subMenu': {
                if (iValue === 'start') {
                  let currentMenu = menuStructure.length - 1;
                  let this_section = menuStructure[currentMenu].currentSection;
                  returnArray.push({
                    menu_name: menuStructure[currentMenu].menuName,
                    sort_key: sectionDetails[this_section].sort_key,
                    section_name: this_section,
                    section_color: sectionDetails[this_section].color,
                    section_icon: sectionDetails[this_section].icon,
                    row_color: sectionDetails[this_section].color,
                    activity_code: `event.${iKey}`,
                    activity_name: await resolveVariables(iKey),
                    row_type: 'event',
                    default_value: null,
                    parent_menu: ((currentMenu === 0) ? null : menuStructure[currentMenu - 1].menuName),
                    child_menu: iKey,
                    reason: `Group ${this_group.group_id}`,
                    last_used: -1,
                    is_favorite: false,
                    subMenu_data: {
                      client_id: masterClient,
                      event_id: iKey,
                      parent: ((currentMenu === 0) ? null : menuStructure[currentMenu - 1].menuName),
                      parent_name: ((currentMenu === 0) ? null : menuStructure[currentMenu - 1].menuName),
                      menu_name: iKey
                    }
                  });
                  menuStructure.push({ menuName: iKey, currentSection: iKey });
                  sectionName = iKey;
                }
                else if (iValue === 'end') {
                  if (menuStructure.length > 1) {
                    menuStructure.pop();
                    sectionName = menuStructure[menuStructure.length - 1].currentSection;
                  }
                };
                break;
              }
              default: { break; }
            }
          }
          else {
            menuStructure[menuStructure.length - 1].currentSection = sectionName;
          }
          if (!(sectionName in sectionDetails)) {
            [sectionColor, sectionIcon] = await getCustomizations(sectionName);
            sectionDetails[sectionName] = {
              color: sectionColor,
              icon: sectionIcon,
              sort_key: sectionSort
            };
          }
        }
        else {
          if (!(sectionName in sectionDetails)) {
            [sectionColor, sectionIcon] = await getCustomizations(sectionName);
            sectionDetails[sectionName] = {
              color: sectionColor,
              icon: sectionIcon,
              sort_key: sectionSort
            };
          }
          let currentMenu = menuStructure.length - 1;
          let this_row = await addRow
            (this_activity,                                 // pActivity
              menuStructure[currentMenu].menuName,        // pMenu
              (currentMenu === 0 ? null : menuStructure[currentMenu - 1].menuName),   // pParent
              null,                                           // pParentName
              sectionDetails[sectionName].sort_key,           // pSectionSort
              sectionName,                                // pSectionName
              sectionDetails[sectionName].color,          // pSectionColor
              sectionDetails[sectionName].icon,          // pSectionIcon
              `Group ${this_group.group_id}`              // pReason
            );
          if (this_row) {
            returnArray.push(this_row);
            duplicateCheck.push(this_activity);
          }
        }
      }
    }

    // Add sort key where needed
    for (let ndx = 0; ndx < returnArray.length; ndx++) {
      let row = returnArray[ndx];
      if (row.sort_key.startsWith('#need-')) {
        let sData = {};
        if (row.section_name in sectionDetails) {
          sData = sectionDetails[row.section_name];
        }
        else {
          let [customColor, customIcon] = await getCustomizations(row.section_name);
          sData = {
            sort_key: `Z1~${row.section_name}`,
            color: customColor,
            icon: customIcon
          };
        }
        returnArray[ndx].sort_key = `${sData.sort_key}${row.sort_key.substring(5)}`;
        returnArray[ndx].section_color = sData.color;
        returnArray[ndx].row_color = sData.color;
        returnArray[ndx].section_icon = sData.icon;
      };
    };

    // Sort by sort_key
    returnArray.sort((a, b) => {
      if (a.sort_key > b.sort_key) { return 1; }
      else { return -1; }
    });

    // save for easy retieval next time
    saveMenu(pPerson, returnArray);
    return returnArray;
  }

  async function saveMenu(pPerson, pMenu) {
    cl(`Update menu for ${pPerson}`);
    await dbClient
      .update({
        Key: {
          person_id: pPerson
        },
        UpdateExpression: "set AVA_main_menu = :m",
        ExpressionAttributeValues: {
          ":m": pMenu
        },
        TableName: "AVAMenu"
      })
      .promise()
      .catch(error => {
        clt({ 'Menu not updated. Error is': error });
      });
  }

  async function getCustomizations(pName) {
    if (pName in customObj) { return [customObj[pName].color, customObj[pName].icon]; }
    cl(`Get Customizations for ${pName}`);
    let cRec = await dbClient
      .get({
        Key: {
          client_id: masterClient,
          custom_key: pName
        },
        TableName: "Customizations",
      })
      .promise()
      .catch(error => {
        cl(`Caught error reading Customizations.Error is: ${error} 
                    with client = ${masterClient} and custom_key = ${pName} `);
      });
    if (recordExists(cRec)) {
      customObj[pName] = {
        color: cRec.Item.color || stringToColor(pName),
        icon: cRec.Item.icon || AVAIcon
      }
      return [cRec.Item.color || stringToColor(pName), cRec.Item.icon || AVAIcon];
    }
    else {
      customObj[pName] = {
        color: stringToColor(pName),
        icon: AVAIcon
      }
      return [stringToColor(pName), AVAIcon];
    }
  }

  async function getActivityLog(pPerson) {
    cl(`Get ActivityLog for ${pPerson}`);
    let aRecs = await dbClient
      .query({
        KeyConditionExpression: 'user_id = :p',
        ExpressionAttributeValues: { ':p': pPerson },
        TableName: "ActivityLog",
        ScanIndexForward: false,
        Limit: 20
      })
      .promise()
      .catch(error => {
        cl({ 'Error reading ActivityLog': error });
      });
    let history = {};
    // ({ 'Activity Log query got:': aRecs });
    if (recordExists(aRecs)) {
      let aL = aRecs.Items.length;
      for (let a = 0; a < aL; a++) {
        if (aRecs.Items[a].activity_code in history) {
          history[aRecs.Items[a].activity_code].push(aRecs.Items[a].timestamp);
        }
        else {
          history[aRecs.Items[a].activity_code] = [aRecs.Items[a].timestamp];
        }
      }
      return history;
    }
    else { return []; }
  }

  async function addRow(pActivity, pMenu, pParent, pParentName, pSectionSort, pSectionName, pSectionColor, pSectionIcon, pReason) {
    let activityRec = await getActivity(pActivity);
    if (Object.keys(activityRec).length === 0) {
      // (`rejecting ${pActivity} - not found in Activities table`);
      return false;
    };
    // (`added ${pActivity} to ${pSectionName} `);
    let last_used = ((activityRec.activity_code in activityHistory) ?
      Math.max(...activityHistory[activityRec.activity_code]) :
      -1
    );
    numberOfRows++;
    let aClient = activityRec.client_id;
    let [aType, aCode] = activityRec.activity_code.split('.');
    if (aType.includes('//')) {
      [aClient, aType] = aType.split('//');
    }
    let favorite = (pReason === 'History') || requestor.favorite_activities.includes(activityRec.activity_code);
    let pSort;
    if (activityRec.section_name && !favorite) {
      pSort = `#need-${numberOfRows}`;
    }
    else {
      pSort = `${pSectionSort}-${numberOfRows}`;
    }
    activityRec.code = activityRec.activity_code;
    return {
      activity_rec: activityRec,
      code: activityRec.activity_code,
      menu_name: pMenu,
      sort_key: pSort,
      section_name: (!favorite && activityRec.section_name) || pSectionName,
      section_color: pSectionColor,
      section_icon: pSectionIcon,
      row_color: pSectionColor,
      activity_code: activityRec.activity_code,
      activity_name: await resolveVariables(activityRec.name),
      row_type: activityRec.type,
      default_value: activityRec.validation?.default_value || null,
      parent_menu: pParent,
      child_menu: ((aType === 'event') ? aCode : null),
      reason: pReason,
      last_used: last_used,
      is_favorite: favorite,
      subMenu_data: ((aType !== 'event')
        ? null
        : {
          client_id: aClient,
          event_id: aCode,
          parent: pMenu,
          parent_name: pSectionName,
          menu_name: activityRec.name
        }
      )
    };
  }

  async function getActivity(pActivityCode) {
    if (pActivityCode in activityObj) { return activityObj[pActivityCode]; }
    let pClient = masterClient;
    let addClient = false;
    let overrideDefault, overrideTitle;
    let parts = pActivityCode.split('~[');
    let pActivity = parts[0];
    for (let p = 1; p < parts.length; p++) {
      let [iType, iData] = parts[p].split(/[=\]]/);
      switch (iType) {
        case 'default': {
          overrideDefault = iData;
          break;
        }
        case 'title': {
          overrideTitle = iData;
          break;
        }
        default: { break; }
      }
    }
    if (pActivity.includes('//')) {
      [pClient, pActivity] = pActivity.split('//');
      addClient = true;
    }
    cl(`Get Activities for ${requestor.person_id} - ${pActivity}`);
    let aRecs = await dbClient
      .get({
        Key: {
          client_id: pClient,
          activity_code: pActivity
        },
        TableName: 'Activities'
      })
      .promise()
      .catch(error => {
        clt(`Error reading Activities is ${error}.`);
      });
    if (recordExists(aRecs)) {
      if (addClient) { aRecs.Item.activity_code = `${pClient}//${pActivity}`; };
      if (overrideDefault) {
        if (!('validation' in aRecs.Item)) { aRecs.Item.validation = {}; }
        aRecs.Item.validation.default_value = overrideDefault;
      }
      if (overrideTitle) {
        aRecs.Item.name = overrideTitle;
      }
      activityObj[pActivityCode] = aRecs.Item;
      return aRecs.Item;
    }
    activityObj[pActivityCode] = {};
    return {};
  }

  async function getGroupsPersonBelongsTo(neededGroupArray) {
    // ({ 'in getGroupsPersonBelongsTo': { pPerson } });
    let batchGetRequest = {
      RequestItems: {
        'Groups': {
          Keys: []
        }
      }
    };

    // requestor.groups was unexpectedly found to have duplicate entries in one instance
    // When that happened, this batchGetRequest would fail and no menu was rendered at all
    // the code "[...new Set(requestor.groups)]" assures that unique values only are considered
    [...new Set(neededGroupArray)].forEach(g => {
      batchGetRequest.RequestItems.Groups.Keys.push(
        {
          client_id: masterClient,
          group_id: g
        }
      );
    });
    cl(`Get Group batch for ${requestor.person_id} - ${neededGroupArray.join(' / ')}`);
    let groupRecs = await dbClient
      .batchGet(batchGetRequest)
      .promise()
      .catch(error => {
        clt({ 'Bad get on Groups - caught error is': error });
      });
    if (groupRecs && ('Responses' in groupRecs)) {
      return groupRecs.Responses.Groups;
    }
    else { return []; }
  }

};    // end
