import {
  resolveVariables, stringToColor, cl, clt, recordExists, uuid,
  dbClient, makeArray, isObject, deepCopy, deepResolve, makeObject
} from '../util/AVAUtilities';
import { getPerson } from '../util/AVAPeople';
import { makeDate } from '../util/AVADateTime';
import { getGroup, getMemberList, prepareTargets } from '../util/AVAGroups';
import { makeObservationList } from '../util/AVAObservations';

const AVAIcon = process.env.REACT_APP_AVA_LOGO;

let customObj = {};
let activityObj = {};
let groupObj = {};

export default async (requestor, masterClient, screenStatus, subMenuData = null, forceRefresh = false, state) => {

  if (forceRefresh) {
    customObj = {};
    activityObj = {};
    groupObj = {};
    requestor = await getPerson(requestor.person_id, '*all', true);
  };

  let groupList = [];

  let numberOfRows = 1000;
  let sectionDetails = {};
  let activityHistory = {};

  function makeVersion(inStr) {
    let [vYr, vDay] = inStr.split(/\.(.*)/);
    return ((Number(vYr) % 100) * 100) + parseFloat(vDay);
  }

  function makeNumber(inStr) {
    let [vYr, vMo, vDay] = inStr.split(/\./g);
    return (20000000 + ((Number(vYr) % 100) * 10000) + (Number(vMo) * 100) + Number(vDay));
  }

  let sectionCheck = {};
  function alreadyInSection(pSec, pAct) {
    if (sectionCheck[pSec]) {
      if (sectionCheck[pSec].includes(pAct)) { return true; }
      else { sectionCheck[pSec].push(pAct); }
    }
    else { sectionCheck[pSec] = [pAct]; }
    return false;
  }

  let ava_version_number = makeVersion(process.env.REACT_APP_AVA_VERSION);
  let ava_env = window.location.href.split('//')[1].slice(0, 1).toUpperCase();
  let todays_numeric_date = makeDate(new Date()).numeric;

  // Main line

  let pPerson = requestor.person_id;
  if (!masterClient) { masterClient = requestor.client_id; };
  if (subMenuData) { return await handleSubMenu(subMenuData); }
  else {
    let returnMe = await buildMainMenu(pPerson);
    return returnMe;
  }


  // Functions

  async function handleSubMenu(pSubMenu, pActivities = null, pOverrides = null) {
    let returnArray = [];
    let [sectionColor, sectionIcon] = await getCustomizations(pSubMenu.menu_name);
    if (pOverrides) {
      if (pOverrides.color) { sectionColor = pOverrides.color; }
      if (pOverrides.icon) { sectionIcon = pOverrides.icon; }
    }
    let subActivities = [];
    if (pActivities) { subActivities.push(...pActivities); }
    else { subActivities = await getSubMenu(pSubMenu.event_id, pSubMenu.client_id); }
    let aL = subActivities.length;
    if (aL > 0) {
      for (let a = 0; a < aL; a++) {
        let pos = 100 + a;
        let subClient, subKey;
        if (subActivities[a].includes('//')) { [subClient, subKey] = subActivities[a].split('//'); }
        else {
          subClient = pSubMenu.client_id;
          subKey = subActivities[a];
        }
        let this_row =
          await addRow(
            `${subClient}//${subKey}`,   // activity_code
            pSubMenu.event_id,                  // this menu_id                      
            pSubMenu.parent,                    // parent menu_id
            pSubMenu.parent_name,               // parent menu name
            `ZZZZ_SUB-${pSubMenu.event_id}-${pos}`,  // sort position
            pSubMenu.menu_name,                 // this menu name
            sectionColor,                       // this menu color
            sectionIcon,                        // this menu icon
            (`${pSubMenu.reason} Sub-menu ${pSubMenu.event_id}`).trim()     // why is this row in the menu
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
      ScanIndexForward: false
    };
    let mRecs = await dbClient
      .query(queryObj)
      .promise()
      .catch(error => {
        cl({ 'Error reading ActivityEvent': error });
      });
    if (recordExists(mRecs) && (mRecs.Count > 0)) {
      for (let m = 0; m < mRecs.Items.length; m++) {
        if (!mRecs.Items[m].sort_order) {
          if (mRecs.Items[m].sequence) {
            mRecs.Items[m].sort_order = (Number.MAX_SAFE_INTEGER - mRecs.Items[m].sequence).toString();
          }
          else { mRecs.Items[m].sort_order = ''; }
        }
        mRecs.Items[m].resolved = await resolveVariables(`%%${mRecs.Items[m].sort_order}%%`, { client_id: masterClient, patient_id: pPerson, user_id: pPerson });
        mRecs.Items[m].resolved = mRecs.Items[m].resolved.replace(/%%/g, '');
      }
      mRecs.Items.sort((a, b) => {
        if (a.resolved > b.resolved) { return 1; }
        else { return -1; }
      });
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
    if (!requestor.hasOwnProperty('name') || !requestor.name.hasOwnProperty('first')) {
      requestor.name = {
        first: requestor.person_id
      };
    }
    sectionName = `${requestor.name.first.trim()}'${requestor.name.first.trim().slice(-1) === 's' ? '' : 's'} favorites`;
    sectionColor = '#6bb44b';
    sectionIcon = 'https://ava-icons.s3.amazonaws.com/icons8-favorite-50.png';
    let aL = 0;
    if (requestor.hasOwnProperty('favorite_activities')) {
      aL = requestor.favorite_activities.length;
      for (let a = 0; a < aL; a++) {
        screenStatus('Loading Favorites', ((a / aL) * 100), ((aL / 40) + .75), returnArray);
        let this_activity = requestor.favorite_activities[a];
        let this_row = await addRow(this_activity, 'main', null, null, sectionSort, sectionName, sectionColor, sectionIcon, 'Favorite');
        if (this_row) { returnArray.push(this_row); }
      }
    }
    else {
      requestor.favorite_activities = [];
    }

    // ({ '** PRIORITIES **': (requestor.priority_activities || 'no priority activities') });
    if (requestor.hasOwnProperty('priority_activities')) {
      sectionSort = '**2b';
      sectionName = `${requestor.name.first.trim()}'${requestor.name.first.trim().slice(-1) === 's' ? '' : 's'} priorities`;
      sectionColor = "#a0985f";
      sectionIcon = 'https://ava-icons.s3.amazonaws.com/icons8-idea-sharing-64.png';
      let aL = requestor.priority_activities.length;
      for (let a = 0; a < aL; a++) {
        screenStatus('Priority Items', ((a / aL) * 100), ((aL / 40) + .75), returnArray);
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
    });
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
      for (let a = 0; a < this_group.common_activities.length; a++) {
        let aL = this_group.common_activities.length;
        screenStatus(`Common activities for ${this_group.name}`, ((a / aL) * 100), ((aL / 40) + .75), returnArray);
        let this_activity = this_group.common_activities[a];
        let overrideColor = '';
        let overrideIcon = '';
        if (!allowDuplicates && duplicateCheck.includes(this_activity)) {   // this_activity is already loaded
          continue;
        }
        if ((typeof (this_activity) === 'string') && this_activity.includes('~[auth=')) {
          let aPieces = this_activity.match(/~\[auth=.+|\]/g);
          let foundAt = aPieces.findIndex(p => { return (p === '~[auth=view]'); });
          if (foundAt > -1) {
            if ((state.accessList[masterClient].groups.hasOwnProperty(this_group.group_id))
              && (state.accessList[masterClient].groups[this_group.group_id] === 0)
            ) {
              continue;
            }
          }
          this_activity = this_activity.replace('~[auth=view]', '');
        }
        if ((typeof (this_activity) === 'string') && (this_activity.startsWith('~~'))) {
          if (this_activity.includes('~[adopt=')) {
            let [, oGroup,] = this_activity.split(/~\[adopt=|\]/g);
            let oClient;
            if (oGroup.includes('//')) { [oClient, oGroup] = oGroup.split('//'); }
            else { oClient = masterClient; }
            let oGroupRec = await getGroup(oGroup, oClient);
            if (oGroupRec && oGroupRec.common_activities) {
              this_group.common_activities.splice(a, 1, ...oGroupRec.common_activities);
              a--;
            }
            continue;
          }
          if (this_activity.includes('~~duplicate=OK') || this_activity.includes('~[duplicate=OK]')) {
            allowDuplicates = true;
            this_activity = this_activity.replace('~~duplicate=OK', '');
            this_activity = this_activity.replace('~[duplicate=OK]', '');
          }
          else { allowDuplicates = false; }
          if (this_activity.includes('~[color=')) {
            let [front, oColor, back] = this_activity.split(/~\[color=|\]/g);
            overrideColor = oColor;
            this_activity = front;
            if (back) { this_activity += back; };
          }
          if (this_activity.includes('~[icon=')) {
            let [front, oIcon, back] = this_activity.split(/~\[icon=|\]/g);
            overrideIcon = oIcon;
            this_activity = front;
            if (back) { this_activity += back; };
          }
          let sectionKeys = this_activity.split('~~');
          if (sectionKeys.length > 2) {
            sectionSort = sectionKeys[1];
            sectionName = sectionKeys[2];
          }
          else {
            sectionSort = sectionKeys[1];
            sectionName = sectionKeys[1];
          }
          if (sectionName.startsWith('section=')) {
            sectionName = sectionName.split(/=(.*)/)[1];
          }
          if (sectionName.startsWith('submenu=')) {
            let subName = sectionName.split(/=(.*)/)[1];
            let subOverrides = {};
            if (overrideColor) { subOverrides.color = overrideColor; }
            if (overrideIcon) { subOverrides.icon = overrideIcon; }
            let currentMenu = menuStructure.length - 1;
            let this_section = menuStructure[currentMenu].currentSection;
            if (alreadyInSection(this_section, `submenu.${subName}`)) { continue; }
            let subMenuObj = {
              client_id: masterClient,
              event_id: `submenu.${subName}`,
              parent: ((currentMenu === 0) ? null : menuStructure[currentMenu - 1].menuName),
              parent_name: ((currentMenu === 0) ? null : menuStructure[currentMenu - 1].menuName),
              menu_name: subName
            };
            returnArray.push({
              menu_name: menuStructure[currentMenu].menuName,
              sort_key: `${sectionDetails[this_section].sort_key}-${numberOfRows + 1000}`,
              section_name: this_section,
              section_color: sectionDetails[this_section].color,
              raw_data: this_activity,
              section_icon: sectionDetails[this_section].icon,
              row_color: sectionDetails[this_section].color,
              activity_code: `submenu.${subName}`,
              activity_name: await resolveVariables(subName, { client_id: masterClient, patient_id: pPerson, user_id: pPerson }),
              row_type: 'event',
              default_value: null,
              parent_menu: ((currentMenu === 0) ? null : menuStructure[currentMenu - 1].menuName),
              child_menu: subName,
              reason: `Group ${this_group.group_id}`,
              last_used: -1,
              is_favorite: false,
              subMenu_data: subMenuObj
            });
            await addRow(
              `submenu.${subName}`,   // activity_code
              menuStructure[currentMenu].menuName,                  // this menu_id                      
              subMenuObj.parent,                    // parent menu_id
              subMenuObj.parent_name,               // parent menu name
              sectionDetails[this_section].sort_key,           // pSectionSort
              this_section,                                // pSectionName
              sectionDetails[this_section].color,          // pSectionColor
              sectionDetails[this_section].icon,          // pSectionIcon
              `Group ${this_group.group_id}`              // pReason
            );
            menuStructure.push({ menuName: subName, currentSection: subName });
            let subActivities = [];
            let nextA;
            for (let s = a + 1; ((s < aL) && (this_group.common_activities[s] !== '~~end_submenu')); s++) {
              subActivities.push(this_group.common_activities[s]);
              nextA = s;
            }
            subMenuObj = {
              client_id: masterClient,
              event_id: subName,
              parent: menuStructure[currentMenu].menuName,
              parent_name: menuStructure[currentMenu].menuName,
              menu_name: subName,
              reason: `Group ${this_group.group_id}`
            };
            let subLines = await handleSubMenu(subMenuObj, subActivities, subOverrides);
            returnArray.push(...subLines);
            menuStructure.pop();
            sectionName = menuStructure[menuStructure.length - 1].currentSection;
            a = nextA + 1;
            continue;
          }
          else {
            menuStructure[menuStructure.length - 1].currentSection = sectionName;
          }
          if (!(sectionName in sectionDetails)) {
            [sectionColor, sectionIcon] = await getCustomizations(sectionName);
            if (overrideColor) { sectionColor = overrideColor; }
            if (overrideIcon) { sectionIcon = overrideIcon; }
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
            if (overrideColor) { sectionColor = overrideColor; }
            if (overrideIcon) { sectionIcon = overrideIcon; }
            sectionDetails[sectionName] = {
              color: sectionColor,
              icon: sectionIcon,
              sort_key: sectionSort
            };
          }
          let currentMenu = menuStructure.length - 1;
          if (!alreadyInSection(sectionName, this_activity)) {
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
    }

    // Filter the result to remove sections or functions prohibited by People record
    if (requestor.hasOwnProperty('prohibited')) {
      if (!requestor.prohibited.activity_code) { requestor.prohibited.activity_code = []; }
      if (!requestor.prohibited.section) { requestor.prohibited.section = []; }
      returnArray = returnArray.filter(row => {
        return !(requestor.prohibited.activity_code.includes(row.activity_code) || (requestor.prohibited.section.includes(row.section_name)));
      });
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
      };
      return [cRec.Item.color || stringToColor(pName), cRec.Item.icon || AVAIcon];
    }
    else {
      customObj[pName] = {
        color: stringToColor(pName),
        icon: AVAIcon
      };
      return [stringToColor(pName), AVAIcon];
    }
  }

  /*
  async function getActivityLog(pPerson) {
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
  */

  async function addRow(pActivity, pMenu, pParent, pParentName, pSectionSort, pSectionName, pSectionColor, pSectionIcon, pReason) {
    let activityRec = await getActivity(pActivity);
    if (Object.keys(activityRec).length === 0) {
      return false;
    };
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
    let favorite = false;
    if (pReason === 'History') { favorite = true; }
    else {
      if (requestor.hasOwnProperty('favorite_activities')) {
        favorite = makeArray(requestor.favorite_activities).some(r => {
          if (isObject(r)) {
            return (r.activity_code === activityRec.activity_code);
          }
          else {
            return (r.split('~')[0] === activityRec.activity_code);
          }
        });
      }
    }
    let pSort;
    if (activityRec.section_name && !favorite) {
      pSort = `#need-${numberOfRows}`;
    }
    else {
      pSort = `${pSectionSort}-${numberOfRows}`;
    }
    activityRec.code = activityRec.activity_code;
    let returnRowObject = {
      activity_rec: activityRec,
      code: activityRec.activity_code,
      raw_data: pActivity,
      menu_name: pMenu,
      sort_key: pSort,
      section_name: (!favorite && activityRec.section_name) || pSectionName,
      section_color: pSectionColor,
      section_icon: pSectionIcon,
      row_color: pSectionColor,
      activity_code: activityRec.activity_code,
      activity_name: await resolveVariables(activityRec.name, { client_id: aClient, patient_id: pPerson, user_id: pPerson }),
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
    if (activityRec.preLoad) {
      let preLoad_code = uuid(8);
      returnRowObject.preLoad_code = preLoad_code;
      makeObservationList(Object.assign({}, returnRowObject, returnRowObject.activity_rec), state.session)
        .then(resolvedActivity => {
          resolvedActivity.activityRec.name = returnRowObject.activity_name;
          prepareDefaults(resolvedActivity.activityRec)
            .then(response => {
              [resolvedActivity.activityRec.default_value, resolvedActivity.activityRec.default_object] = response;
              dbClient
                .put({
                  TableName: 'PreLoads',
                  Item: {
                    client_id: state.session.client_id,
                    preLoad_key: preLoad_code,
                    preLoad_data: resolvedActivity
                  }
                })
                .promise()
                .catch(error => {
                  console.log('Error adding an pre-loaded activity', error.message);
                });
              console.log(`done with preload for ${resolvedActivity.activityRec.name} (${returnRowObject.code}) as preload_code ${preLoad_code}`);
            })
        });
    };
    return returnRowObject;
  };

  async function prepareDefaults(fact) {
    let excludeList = ['reservation', 'play_video'];
    let returnArray = [];
    let returnObject = {};
    if (!fact.default_value) { return [returnArray, returnObject]; }
    if (excludeList.includes(fact.activity_rec?.type) || excludeList.includes(fact.type)) { return fact.default_value; }
    if (fact.activity_rec?.type === 'make_message') {

    }

    // check for default values in the person's record
    if (state.patient.hasOwnProperty('defaultValues')) {
      let pDefaults = state.patient.defaultValues;
      for (let key in pDefaults) {
        returnArray.push(`private~${key}=${pDefaults[key]}`);
      }
    }
    // now pull in default values associated with this specific function call
    let defaultValues = {};
    if (isObject(fact.default_value)) {
      defaultValues = Object.assign({}, fact.default_value);
    }
    else {
      // old style is a string of key/value pairs (in the form key=value) separated by " ~ "
      makeArray(fact.default_value, /\s~|~\s/g).forEach((d, x) => {
        if (d.includes('=')) {
          let dO = d.split('=');
          defaultValues[dO[0]] = dO[1];
        }
        else {
          // a value may not be in the form key=value; in this case, just use value
          defaultValues[`_key_${x}`] = d;
        }
      });
    }
    for (let dField in defaultValues) {
      let dValue = await resolveDefaults(fact, dField, defaultValues[dField]);
      // we're returning an array and an object, they are duplicates of one another and consumed as needed by their targets
      // each entry is a default value which could be:
      //     a string alone (as in "myDefault")
      //     a string with some field name (as in "requestType=myDefault")
      //     an object (as in {requestType: myDefault, peopleList: [person1, person2, ...], ...})
      let rKey;
      let k = dField.match(/_key_(.*)/);
      if (k) {          // if no field name was specified
        rKey = `d${k[1]}`;
      }
      else {
        rKey = (dField.split('.')).pop();
      }
      returnObject[rKey] = dValue;
      if (typeof dValue !== 'string') {
        returnArray.push({ [rKey]: dValue });
      }
      else {
        returnArray.push(`${k ? '' : (rKey + '=')}${dValue}`);
      }
    }
    return [returnArray, returnObject];
  }


  async function resolveDefaults(fact, this_key, this_value) {
    if (typeof (this_value) !== 'string') {
      let workObj = deepCopy(this_value);
      for (let aKey in workObj) {
        workObj[aKey] = await resolveDefaults(fact, aKey, workObj[aKey]);
      }
      workObj = await specialCases(this_key, workObj);
      return workObj;
    }
    let a = this_value.split('.');
    // if there are two or more "." in the value, use the value itself 
    if (a.length > 2) {
      return this_value;
    }
    let dValue = await resolveVariables(a.pop(), state.session, { ignoreArrayCheck: true });
    // if anything remains in array a (after the pop above), the value was in the form instruction=value
    // we'll act as per that instruction here
    if (a.length > 0) {
      dValue = await specialCases(a[0], dValue);
    }
    return dValue;

    async function specialCases(key, dValue) {
      switch (key) {
        case 'people': {
          let factClient;
          if (fact.activity_rec.client_id) { factClient = fact.activity_rec.client_id; }
          else if (fact.activity_code.includes('//')) { factClient = fact.activity_code.split('//')[0]; }
          else { factClient = state.session.client_id; }
          dValue = await getMemberList(makeArray(dValue, ','), factClient, { sort: true, shortList: true });
          break;
        }
        case 'person': {
          if (dValue === 'patientRec') {
            dValue = state.patient;
          }
          else if (dValue === 'userRec') {
            dValue = state.user;
          }
          else {
            dValue = {
              'peopleList': [state.patient]
            };
          }
          break;
        }
        case 'select': {
          if (dValue === 'accessList') {
            dValue = {
              'selectionList': state.accessList[state.session.client_id].shortList
            };
          }
          else if (state.patients) {
            dValue = state.patients;
          }
          else {
            let targetObj = await prepareTargets(state.session.patient_id, state.session.client_id, { includeGroups: true });
            dValue = targetObj.responsibleList.sort();
          }
          break;
        }
        case 'events': {
          dValue = deepCopy(state.calendar);
          break;
        }
        case 'activities': {
          // activities dValue is an object with
          //     global_defaults - pass to every column
          //     column_list - an array with info about each column to return
          //          response entries will be resolved activities (with observation records prepared as per the instructions in the array element)
          //          each element is an object with
          //              activity_id - optional; if missing use the activity_id that this is a part of
          //              column_defaults - add these to the global defaults when resolving and handling the activity
          let responseArray = [];
          let global_defaults = dValue.global_defaults;
          if (!dValue.hasOwnProperty('column_list') || (dValue.column_list.length === 0)) {
            let column_defaults = Object.assign({}, global_defaults);
            let column_object = deepCopy(await makeObservationList(fact.activity_code, state.session, column_defaults));
            column_object.column_defaults = column_defaults;
            responseArray.push(column_object);
          }
          else {
            for (let m = 0; m < dValue.column_list.length; m++) {
              let column_defaults = Object.assign({}, global_defaults, dValue.column_list[m].column_defaults);
              let column_object = deepCopy(await makeObservationList(dValue.column_list[m].activity_id, state.session, column_defaults));
              column_object.column_defaults = column_defaults;
              responseArray.push(column_object);
            }
          }
          dValue = responseArray;
          break;
        }
        default: {
          if (key && (typeof (dValue) === 'string') && (key !== 'default')) {
            dValue = `${key}.${dValue}`;
          }
        }
      }
      return dValue;
    }
  }

  async function getActivity(pActivityCode) {
    if (isObject(pActivityCode)) {
      let aResolved = await getActivityFromObject(pActivityCode);
      activityObj[pActivityCode] = aResolved;
      return aResolved;
    }
    if (pActivityCode in activityObj) { return activityObj[pActivityCode]; }
    let pClient = masterClient;
    let addClient = false;
    let overrideDefault, overrideTitle;
    let parts = pActivityCode.split('~[');
    let pActivity = parts[0];
    if (pActivity.includes('//')) {
      [pClient, pActivity] = pActivity.split('//');
      addClient = true;
    }
    for (let p = 1; p < parts.length; p++) {
      let [iType, iData] = parts[p].split(/[=%\]]/);
      switch (iType) {
        case 'default': {
          overrideDefault = await resolveVariables(iData, { client_id: pClient, patient_id: pPerson, user_id: pPerson });
          if (overrideDefault.charAt(0) === '[') {
            overrideDefault = makeArray(overrideDefault);
          }
          break;
        }
        case 'title': {
          overrideTitle = await resolveVariables(iData, { client_id: pClient, patient_id: pPerson, user_id: pPerson });;
          break;
        }
        case 'env': {
          if ((parts[p].toLowerCase() === 'test') && (!['T', 'L'].includes(ava_env))) { return {}; }
          else if ((parts[p].toLowerCase() === 'dev') && (ava_env !== 'D')) { return {}; }
          break;
        }
        case 'vers':
        case 'rel':
        case 'version':
        case 'release': {
          let checkVer = makeVersion(iData);
          if ((checkVer >= 9999) && (!['T', 'L'].includes(ava_env))) { return {}; }
          if ((parts[p].includes('<') && (ava_version_number >= checkVer))
            || (parts[p].includes('>') && (ava_version_number <= checkVer))
            || (parts[p].includes('=') && (checkVer !== ava_version_number))) {
            activityObj[pActivityCode] = {};
            return {};
          }
          break;
        }
        case 'date': {
          let checkDate = makeNumber(iData);
          if ((parts[p].includes('<') && (todays_numeric_date >= checkDate))
            || (parts[p].includes('>') && (todays_numeric_date <= checkDate))
            || (parts[p].includes('=') && (checkDate !== todays_numeric_date))) {
            activityObj[pActivityCode] = {};
            return {};
          }
          break;
        }
        default: { break; }
      }
    }
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

  async function getActivityFromObject(pActivityObj) {
    let pClient = pActivityObj.client || masterClient;
    let addClient = !(pClient === masterClient);
    let overrideDefault, overrideTitle;
    let pActivity = pActivityObj.activity_code || pActivityObj.activity;

    for (let [iType, iData] of Object.entries(pActivityObj)) {
      iData = await deepResolve(iData, { client_id: pClient, patient_id: pPerson, user_id: pPerson });
      switch (iType) {
        case 'default': {
          overrideDefault = iData;
          break;
        }
        case 'title': {
          overrideTitle = iData;
          break;
        }
        case 'env': {
          if ((iData.toLowerCase() === 'test') && (!['T', 'L'].includes(ava_env))) { return {}; }
          else if ((iData.toLowerCase() === 'dev') && (ava_env !== 'D')) { return {}; }
          break;
        }
        case 'vers':
        case 'rel':
        case 'version':
        case 'release': {
          let checkVer = makeVersion(iData);
          if ((checkVer >= 9999) && (!['T', 'L'].includes(ava_env))) { return {}; }
          if ((iData.includes('<') && (ava_version_number >= checkVer))
            || (iData.includes('>') && (ava_version_number <= checkVer))
            || (iData.includes('=') && (checkVer !== ava_version_number))) {
            return {};
          }
          break;
        }
        case 'date': {
          let checkDate = makeNumber(iData);
          if ((iData.includes('<') && (todays_numeric_date >= checkDate))
            || (iData.includes('>') && (todays_numeric_date <= checkDate))
            || (iData.includes('=') && (checkDate !== todays_numeric_date))) {
            return {};
          }
          break;
        }
        default: { break; }
      }
    }
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
        if (!('validation' in aRecs.Item)) {
          aRecs.Item.validation = {
            default_value: deepCopy(overrideDefault)
          };
        }
        else {
          if ((aRecs.Item.validation.default_value) && (!isObject(aRecs.Item.validation.default_value))) {
              let a1 = aRecs.Item.validation.default_value.split('.');
              let a2 = a1.pop();
              let a3 = makeArray(a2, '~');
              let a4 = makeObject(a3);
              aRecs.Item.validation.default_value = a4;
          }
          aRecs.Item.validation.default_value = deepCopy(Object.assign({}, aRecs.Item.validation.default_value, overrideDefault));
        }
      }
      if (overrideTitle) {
        aRecs.Item.name = overrideTitle;
      }
      return aRecs.Item;
    }
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
