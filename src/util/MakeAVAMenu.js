const AWS = require('aws-sdk');

const AVAIcon = 'https://ava-icons.s3.amazonaws.com/AVA+Logo.png';

const dbClient = new AWS.DynamoDB.DocumentClient({
    apiVersion: '2012-08-10',
    region: "us-east-1",
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY
});

export default async (requestor, masterClient, screenStatus, subMenuData = null) => {

    let groupList;

    // let subMenus = [];
    let numberOfRows = 1000;

    let activityHistory = {};

    // Main line

    let pPerson = requestor.person_id;
    if (!masterClient) { masterClient = requestor.client_id; };
    if (subMenuData) { return await handleSubMenu(subMenuData) }
    else { return await buildMainMenu(pPerson); }


    // Functions

    async function handleSubMenu(pSubMenu) {
        let returnArray = [];
        let [sectionColor, sectionIcon] = await getCustomizations(pSubMenu.menu_name)
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

        // Get Favorites from the People record
        // ({ '** FAVORITES **': (requestor.favorite_activities || 'no favorite activities') });
        screenStatus('Loading Favorites');
        sectionSort = '**2';
        sectionName = `${requestor.name.first.trim()}'${requestor.name.first.trim().slice(-1) === 's' ? '' : 's'} favorites`;
        sectionColor = '#6bb44b';
        sectionIcon = 'https://ava-icons.s3.amazonaws.com/icons8-favorite-50.png';
        let aL = 0;
        if (requestor.hasOwnProperty('favorite_activities')) {
            aL = requestor.favorite_activities.length;
            for (let a = 0; a < aL; a++) {
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
        screenStatus('Checking History');
        if (!('favorite_blocked' in requestor)) { requestor.favorite_blocked = []; }
        sectionSort = '**2a';
        sectionName = `${requestor.name.first.trim()}'${requestor.name.first.trim().slice(-1) === 's' ? '' : 's'} frequently used`;
        sectionColor = '#4bb491';
        sectionIcon = 'https://ava-icons.s3.amazonaws.com/icons8-star-half-empty-50.png';
        activityHistory = await getActivityLog(pPerson);
        for (const hActivity in activityHistory) {
            if ((activityHistory[hActivity].length > 4) &&
                !(requestor.favorite_activities.includes(hActivity)) &&
                !(requestor.favorite_blocked.includes(hActivity))) {
                let this_row = await addRow(hActivity, 'main', null, null, sectionSort, sectionName, sectionColor, sectionIcon, 'History');
                if (this_row) { returnArray.push(this_row); }
            }
        }

        // ({ '** PRIORITIES **': (requestor.priority_activities || 'no priority activities') });
        screenStatus('Checking for Priority Items');
        if (requestor.hasOwnProperty('priority_activities')) {
            sectionSort = '**2b';
            sectionName = `${requestor.name.first.trim()}'${requestor.name.first.trim().slice(-1) === 's' ? '' : 's'} priorities`;
            sectionColor = "#a0985f";
            sectionIcon = 'https://ava-icons.s3.amazonaws.com/icons8-idea-sharing-64.png';
            let aL = requestor.priority_activities.length;
            for (let a = 0; a < aL; a++) {
                let this_activity = requestor.priority_activities[a];
                let this_row = await addRow(this_activity, 'main', null, null, sectionSort, sectionName, sectionColor, sectionIcon, 'Priorities');
                if (this_row) { returnArray.push(this_row); }
            }
        }

        // Get all Groups this person is associated with
        groupList = await getGroupsPersonBelongsTo(pPerson);
        // ('** GROUPS **');
        let gL = groupList.length;
        for (let g = 0; g < gL; g++) {
            let this_group = groupList[g];
            sectionSort = 'ZZZ';
            sectionName = `Common activities for the ${this_group.name}${!this_group.name.includes('roup') ? ' group' : ''}`;
            sectionColor = stringToColor(sectionName);
            sectionIcon = AVAIcon;
            screenStatus(`Common activities for ${this_group.name}`);
            // (`Checking group ${this_group.group_id} (${this_group.name}): ${(this_group.common_activities || 'no common activities')}`);
            if (!this_group.hasOwnProperty('common_activities')) { continue; }
            let aL = this_group.common_activities.length;
            for (let a = 0; a < aL; a++) {
                let this_activity = this_group.common_activities[a];
                if (duplicateCheck.includes(this_activity)) {
                    // (`${this_activity} is a duplicate`);
                    continue;
                }
                if (this_activity.startsWith('~~')) {
                    let sectionKeys = this_activity.split('~~');
                    if (sectionKeys.length > 2) {
                        sectionSort = sectionKeys[1];
                        sectionName = sectionKeys[2];
                    }
                    else {
                        sectionSort = sectionKeys[1];
                        sectionName = sectionKeys[1];
                    }
                    [sectionColor, sectionIcon] = await getCustomizations(sectionName);
                }
                else {
                    let this_row = await addRow(this_activity, 'main', null, null, sectionSort, sectionName, sectionColor, sectionIcon, `Group ${this_group.group_id}`);
                    if (this_row) { 
                        returnArray.push(this_row);
                        duplicateCheck.push(this_activity);
                    }
                }
            }
        }

        /*
        // Build sub-menus
            event_id: activityRec.activity_code,
            parent: pMenu,
            parent_name: pParentName,
            menu_name: activityRec.activity_name
        // ('** SUB-MENUS **');
        let menuDone = [];
        for (let s = 0; s < subMenus.length; s++) {
            // ({ 'Loop': s, 'Checking': subMenus[s] });
            if (menuDone.includes(subMenus[s].event_id)) {
                // (`${subMenus[s].event_id} is already built`);
                continue;
            }
            screenStatus(`Getting ${subMenus[s].menu_name} for ${subMenus[s].parent} menu`)
            sectionSort = `SUB-${s}`;
            sectionName = subMenus[s].menu_name;
            sectionColor = stringToColor(sectionName);
            sectionIcon = AVAIcon;
            let subActivities = await getSubMenu(subMenus[s].event_id, subMenus[s].client_id);
            let aL = subActivities.length;
            if (aL > 0) {
                for (let a = 0; a < aL; a++) {
                    let pos = 100 + a;
                    let this_row = await addRow(`${subMenus[s].client_id}//${subActivities[a]}`, subMenus[s].event_id, subMenus[s].parent, sectionName, `${sectionSort}-${pos}`, sectionName, sectionColor, sectionIcon, `Sub-menu ${subMenus[s].event_id}`);
                    if (this_row) { returnArray.push(this_row); }
                }
                menuDone.push(subMenus[s].event_id);
            }
        }
                */

        // Sort by sort_key
        returnArray.sort((a, b) => {
            if (a.sort_key > b.sort_key) { return 1; }
            else { return -1; }
        });

        // Display results in the console log
        let currentSection = '';
        returnArray.forEach(row => {
            if (row.section_name !== currentSection) {
                currentSection = row.section_name;
            };
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
            return [cRec.Item.color || stringToColor(pName), cRec.Item.icon || AVAIcon];
        }
        else { return [stringToColor(pName), AVAIcon]; }
    }

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
        return {
            menu_name: pMenu,
            sort_key: `${pSectionSort}-${numberOfRows}`,
            section_name: pSectionName,
            section_color: pSectionColor,
            section_icon: pSectionIcon,
            row_color: activityRec.color || pSectionColor,
            activity_code: activityRec.activity_code,
            activity_name: reconcile(activityRec.name),
            row_type: activityRec.type,
            default_value: activityRec.validation?.default_value || null,
            parent_menu: pParent,
            child_menu: ((aType === 'event') ? aCode : null),
            reason: pReason,
            last_used: last_used,
            is_favorite: (pReason === 'History') || requestor.favorite_activities.includes(activityRec.activity_code),
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
        let pActivity = pActivityCode;
        let pClient = masterClient;
        let addClient = false;
        if (pActivityCode.includes('//')) {
            [pClient, pActivity] = pActivityCode.split('//');
            addClient = true;
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
            return aRecs.Item;
        }
        return {};
    }

    async function getGroupsPersonBelongsTo(pPerson) {
        var returnArray = [];
        // ({ 'in getGroupsPersonBelongsTo': { pPerson } });
        var peopleGroup = await dbClient
            .query({
                KeyConditionExpression: 'person_id = :p',
                ExpressionAttributeValues: { ':p': pPerson },
                TableName: 'PeopleGroups',
            })
            .promise()
            .catch(error => {
                clt({ 'Bad query on PeopleGroups in getGroupsPersonBelongsTo - caught error is': error });
            });
        if (recordExists(peopleGroup)) {
            let pgL = peopleGroup.Items.length;
            for (let p = 0; p < pgL; p++) {
                let groupRec = await getGroup(peopleGroup.Items[p].client_group_id);
                if (groupRec.group_id) { returnArray.push(groupRec); }
            }
            // ({ 'return from getGroupsPersonBelongsTo': returnArray });
            return returnArray;
        }
        return [];
    }

    async function getGroup(pClientGroup) {
        let [pClient, pGroup] = pClientGroup.split('~');
        let groupRec = await dbClient
            .get({
                Key: {
                    client_id: pClient,
                    group_id: pGroup
                },
                TableName: "Groups"
            })
            .promise()
            .catch(error => {
                clt({ 'Bad get on Groups - caught error is': error });
            });
        if (recordExists(groupRec)) { return groupRec.Item; };
        return {};
    }

    function reconcile(pString) {
        if (!pString || !pString.includes('[')) { return pString; };
        // ({ 'reconciling': pString });
        let nameArray = pString.split(/\[|\]/g);
        let betweenTheBrackets = nameArray[1];
        if (betweenTheBrackets.includes('~')) {
            // handle [morning~1200~afternoon], reconciling the respone as per the hhmm
            let [earlyPart, timeTrigger$, latePart] = betweenTheBrackets.split('~');
            let timeTrigger = parseInt(timeTrigger$.trim(), 10);
            let timeNow = new Date();
            let timeNowHHMM = ((timeNow.getHours() - 4) * 100) + timeNow.getMinutes();
            if (timeNowHHMM > timeTrigger) { nameArray[1] = latePart; }
            else { nameArray[1] = earlyPart; }
            return nameArray.join('');
        }
        betweenTheBrackets = betweenTheBrackets.toLowerCase();
        if (betweenTheBrackets === 'name') {
            nameArray[1] = `${requestor.name.first} ${requestor.name.last} `;
            return nameArray.join('');
        }
        else if (betweenTheBrackets === 'location') {
            nameArray[1] = requestor.location;
            return nameArray.join('');
        }
        else {
            let keyDate;
            let today = new Date();
            let todayDayOfWeek = today.getDay();
            if (betweenTheBrackets.startsWith('today+')) {
                keyDate = addDays(today, parseInt(betweenTheBrackets.split('+')[1], 10));
            }
            else if (betweenTheBrackets.startsWith('sunday')) {
                let nextSunday = addDays(today, ((7 - todayDayOfWeek) % 7));
                keyDate = addDays(nextSunday, ((betweenTheBrackets.includes('-') ? -1 : 1) * parseInt(betweenTheBrackets.split('+')[1], 10)));
            }
            else {
                if (betweenTheBrackets.startsWith('next ')) {
                    today = addDays(today, 1);
                    todayDayOfWeek = today.getDay();
                    betweenTheBrackets = betweenTheBrackets.substring(5).trim();
                };
                switch (betweenTheBrackets) {
                    case 'today':
                        { keyDate = today; break; }
                    case 'tomorrow':
                        { keyDate = addDays(today, 1); break; }
                    case 'sunday':
                        { keyDate = addDays(today, ((7 - todayDayOfWeek) % 7)); break; }
                    case 'monday':
                        { keyDate = addDays(today, ((8 - todayDayOfWeek) % 7)); break; }
                    case 'tuesday':
                        { keyDate = addDays(today, ((9 - todayDayOfWeek) % 7)); break; }
                    case 'wednesday':
                        { keyDate = addDays(today, ((10 - todayDayOfWeek) % 7)); break; }
                    case 'thursday':
                        { keyDate = addDays(today, ((11 - todayDayOfWeek) % 7)); break; }
                    case 'friday':
                        { keyDate = addDays(today, ((12 - todayDayOfWeek) % 7)); break; }
                    case 'saturday':
                        { keyDate = addDays(today, ((13 - todayDayOfWeek) % 7)); break; }
                    default:
                        { break; }
                }
            }
            if (keyDate) {
                nameArray[1] = `${keyDate.getMonth() + 1}/${keyDate.getDate()}`;
                return nameArray.join('');
            }
        }
        return pString;
    }

    function addDays(pDate, pDays) {
        const copy = pDate;
        copy.setDate(pDate.getDate() + pDays);
        return copy;
    }

    function stringToColor(string) {
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

    function cl() {
            for (let v = 0; v < arguments.length; v++) {
                let value = arguments[v];
                if (typeof (value) === 'object') { console.log(JSON.stringify(value)); }
                else { console.log(value); }
        }
    };

    function clt() {
        for (let v = 0; v < arguments.length; v++) {
            let value = arguments[v];
            if (typeof (value) === 'object') { console.log(JSON.stringify(value)); }
            else { console.log({ value }); }
        };
    };

    function recordExists(recordId) {
        return (recordId != null && (recordId.hasOwnProperty("Item") || recordId.hasOwnProperty("Items")));
    }

};    // end
