const AWS = require('aws-sdk');

const AVAIcon = 'https://ava-icons.s3.amazonaws.com/AVA+Logo.png';

const dbClient = new AWS.DynamoDB.DocumentClient({
    apiVersion: '2012-08-10',
    region: "us-east-1",
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY
});

export default function () {

    let argumentArray = [...arguments];
    let functionToCall = argumentArray[0];
    argumentArray.shift();

    switch (functionToCall) {
        case 'putServiceRequest': {
            const goFunction = async () => {
                returnArray = await putServiceRequest(...argumentArray);
            };
            let returnArray = [];
            goFunction();
            return returnArray;
        }
        case 'makeRelativeDate': {
            return formatDateTime('rel', ...argumentArray);
        }
        case 'makeAbsoluteDate': {
            return formatDateTime('abs', ...argumentArray);
        }
        default: {
            return null;
        }
    }

    // Functions

    /*
     async function getGroupMembership(pPerson, pClient = null) {
        let batchGetRequest = {
            RequestItems: {
                'Groups': {
                    Keys: []
                }
            }
        };
        // requestor.groups was unexpectedly found to have duplicate entries in one instance
        // When that happened, this batchGetRequest would fail and no menu was rendered at all
        [...new Set(pGroupList)].forEach(g => {
            if (g.includes('//')) { [gClient, gGroup] = g.split('//'); }
            else { gClient = (pClient || masterClient); gGroup = g; }
            batchGetRequest.RequestItems.Groups.Keys.push(
                {
                    client_id: gClient,
                    group_id: gGroup
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
    */

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

    async function getPerson(pPerson, pElement = '*all') {
        let peopleRec = await dbClient
            .get({
                Key: { person_id: pPerson },
                TableName: "People"
            })
            .promise()
            .catch(error => {
                console.log({ 'Bad get on People - caught error is': error });
            });
        if (!recordExists(peopleRec)) { return null; }
        switch (pElement.toLowerCase()) {
            case '*all': { return peopleRec.Item; }
            case 'name': {
                if (!peopleRec.Item.hasOwnProperty('name')) {
                    if (peopleRec.Item.hasOwnProperty('messaging')) {
                        if (peopleRec.Item.hasOwnProperty('preferred_method') &&
                            peopleRec.Item.messaging.hasOwnProperty(peopleRec.Item.preferred_method)) {
                            return `${peopleRec.Item.messaging[peopleRec.Item.preferred_method]} (${pPerson})`;
                        }
                        let destinations = Object.keys(peopleRec.Item.messaging);
                        for (let k = 0; k < destinations.length; k++) {
                            if (typeof destinations[k] !== 'boolean') {
                                return `${peopleRec.Item.messaging[destinations[k]]} (${pPerson})`;
                            }
                        }
                    }
                    return pPerson;
                }
                let rName = peopleRec.Item.name.first || '';
                rName += ' ' + (peopleRec.Item.name.last || '');
                return rName.trim();
            }
            default: {
                return peopleRec.Item;
            }
        }

    };

    async function putServiceRequest(body) {

        /* request is an object with...
                body: {
                    client: <string> (required),
                    author: <user ID> (required)
                    requestType: <string> (required)
                    [requestDate: <timestamp>] (optional - defaults to currentTime),
                    [onBehalfOf: <string>] (optional - defaults to author's name)
                    request: <object> (required)
            };
        */

        let now = new Date().getTime();
        if (!body.requestDate) { body.requestDate = now; };
        body.$Date = body.requestDate.toString();
        let serviceRequestRec = {
            "client_id": body.client,
            "request_id": `${body.author}~${body.$Date}`,
            "requestor": body.author,
            "on_behalf_of": body.onBehalfOf || getPerson(body.author, 'name'),
            "request_type": body.requestType,
            "original_request": body.request,
            "local_key": body.localKey || `${body.$Date.substr(2, 4)}-${body.$Date.substr(6, 4)}`,
            "foreign_key": body.foreignKey || '*tbd*',
            "last_update": now,
            "last_status": 'Submitted',
            "last_note": null
        };
        cl({ 'adding ServiceRequestRec as': serviceRequestRec });
        let goodWrite = true;
        await dbClient
            .put({
                Item: serviceRequestRec,
                TableName: "ServiceRequests"
            })
            .promise()
            .catch(error => {
                clt({ 'Bad put to ServiceRequests - caught error is': error });
                goodWrite = false;
            });
        return (goodWrite ? `${sentenceCase(body.requestType)} request ${serviceRequestRec.request_id} added (${body.author} for ${serviceRequestRec.on_behalf_of})` : 'Request not added');
    }

    async function getPersonDetails(pPerson) {
        // get the Person's name and contact information
        cl({ 'in getPersonDetails with': pPerson });
        let personRec = await dbClient
            .get({
                Key: { person_id: pPerson },
                TableName: "People"
            })
            .promise()
            .catch(error => {
                clt({ 'Bad get on People - caught error is': error });
            });
        if (!recordExists(personRec)) { return { "Error": "No such person" }; }
        if (!personRec.Item.hasOwnProperty('messaging')) {
            personRec.Item.messaging = {};
        }
        if (personRec.Item.messaging.voice) {
            var cleaned = ('' + personRec.Item.messaging.voice).replace(/\D/g, '');
            var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
            if (match) {
                var intlCode = (match[1] ? '+1 ' : '');
                personRec.Item.home = [match[2], '-', match[3], '-', match[4]].join('');
                personRec.Item.search_data += ' ' + personRec.Item.messaging.voice;
            }
        }
        else { personRec.Item.home = ''; }
        if (personRec.Item.messaging.sms) {
            cleaned = ('' + personRec.Item.messaging.sms).replace(/\D/g, '');
            match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
            if (match) {
                intlCode = (match[1] ? '+1 ' : '');
                personRec.Item.cell = [match[2], '-', match[3], '-', match[4]].join('');
                personRec.Item.search_data += ' ' + personRec.Item.messaging.sms;
            }
        }
        if (personRec.Item.messaging.office) {
            cleaned = ('' + personRec.Item.messaging.office).replace(/\D/g, '');
            match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
            if (match) {
                intlCode = (match[1] ? '+1 ' : '');
                personRec.Item.office = [match[2], '-', match[3], '-', match[4]].join('');
                personRec.Item.search_data += ' ' + personRec.Item.messaging.office;
            }
        }
        else { personRec.Item.office = ''; }
        personRec.Item.email = personRec.Item.messaging.email;
        personRec.Item.first = personRec.Item.name.first;
        personRec.Item.last = personRec.Item.name.last;
        if (!personRec.Item.search_data) { personRec.Item.search_data = ''; }
        personRec.Item.search_data +=
            ' ' + personRec.Item.messaging.email +
            ' ' + personRec.Item.messaging.first +
            ' ' + personRec.Item.messaging.last +
            ' ' + personRec.Item.messaging.location;
        personRec.Item.search_data = personRec.Item.search_data.toLowerCase();
        cl({ 'getPersonDetails returns': personRec.Item });
        return personRec.Item;
    }

    function sentenceCase(pString) {
        return (!pString ? '' : pString.slice(0, 1).toUpperCase() + pString.slice(1).toLowerCase());
    }

    function formatDateTime(pType = 'rel', pInput) {
        let targetDateStamp, targetDate;

        if (pInput instanceof Date) {
            targetDateStamp = pInput.getTime();
            targetDate = pInput;
        }
        else if ((typeof pInput) !== 'string') {
            targetDate = new Date(pInput);
            targetDateStamp = targetDate.getTime();
        }
        else {
            targetDate = makeDate(pInput);
            targetDateStamp = targetDate.getTime();
        }

        let currentDate = new Date();

        let mDate = null;
        if (!pType.toLowerCase().startsWith('abs')) {
            let hours = 60 * 60 * 1000;
            let midnight = currentDate.setHours(0, 0, 0, 0);

            if (targetDateStamp < midnight) {
                if (targetDateStamp > (midnight - (24 * hours))) {
                    mDate = 'yesterday';
                }
                else if (targetDateStamp > (midnight - (7 * 24 * hours))) {
                    let mWord = '';
                    if (targetDate.getDay() < 6) {
                        mWord = 'last ';
                    }
                    mDate = `${mWord}${targetDate.toLocaleString([], { weekday: 'long' })}`;
                }
            }
            else if (targetDateStamp >= (midnight + (24 * hours))) {
                if (targetDateStamp < (midnight + (48 * hours))) {
                    mDate = 'tomorrow';
                }
                else if (targetDateStamp < (midnight + (8 * 24 * hours))) {
                    let mWord = '';
                    if (targetDate.getDay() <= currentDate.getDay()) {
                        mWord = 'next ';
                    }
                    mDate = `${mWord}${targetDate.toLocaleString([], { weekday: 'long' })}`;
                }
            }
            else {
                let hour = targetDate.getHours();
                if (hour < 12) { mDate = "this morning"; }
                else if (hour < 17) { mDate = "this afternoon"; }
                else (mDate = "this evening");
            }
        }
        if (!mDate) {
            mDate = `${targetDate.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;
            if ((targetDate.getFullYear() !== currentDate.getFullYear())
                && (targetDate.getMonth() > 3 || currentDate.getMonth() < 9)) {
                mDate += ` ${targetDate.getFullYear()}`;
            }
        }

        if ((targetDate.getHours() > 0) && (targetDate.getMinutes() > 0)) {
            mDate += ` at ${targetDate.toLocaleString([], { hour: 'numeric', minute: '2-digit' })}`;
        }
        let targetDateYMD = targetDate.getFullYear()
            + '.' + (targetDate.getMonth() + 101).toString().slice(1)
            + '.' + (targetDate.getDate() + 100).toString().slice(1);
        return [sentenceCase(mDate), targetDate, targetDateStamp, targetDateYMD];

        function addDays(pDate, pDays) {
            const copy = pDate;
            copy.setDate(pDate.getDate() + pDays);
            return copy;
        }

        function makeDate(pString) {
            if (/^\d+$/.test(pString)) { pString = parseInt(pString, 10); }
            let goodDate = new Date(pString);
            console.log({ 'in makeDate': pString, 'goodDate': goodDate.toLocaleString(), 'bad': isNaN(goodDate) });
            if (isNaN(goodDate)) {
                let currentDate = new Date();
                currentDate.setHours(0, 0, 0, 0);
                let tDate = pString.trim().substr(0, 3).toLowerCase();
                if (tDate === 'tom') {
                    return addDays(currentDate, 1);
                }
                else if (tDate === 'tod') {
                    return currentDate;
                }
                else {
                    // the pString doesn't translate to a date on its own
                    // it is therefore in the format [next | last] <day of the week>
                    // if "last" is used, look backward from today to the previous Monday, then move backward (7 - <day of the week>) more days
                    // if "next" is used, look ahead to the next Sunday (7 - <day of the week>), then find the next instance of the requested day
                    let tLast = false;
                    let tNext = pString.trim().toLowerCase().startsWith('next');
                    if (!tNext) {
                        tLast = pString.trim().toLowerCase().startsWith('last');
                    }
                    if (tLast || tNext) {
                        let parts = pString.split(/\W+/);
                        parts.shift();
                        pString = parts.join(' ');
                    }
                    let currentDofWeek = new Date().getDay();
                    let variant = 0;
                    let dayWord = pString.split(' ')[0].trim().slice(0, 3).toLowerCase();
                    let requestedDofWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(dayWord);
                    if (requestedDofWeek > -1) {
                        if (tLast) { variant = (0 - currentDofWeek) - (7 - requestedDofWeek); }
                        else if (tNext) {
                            if (requestedDofWeek === 0) { requestedDofWeek = 7; }
                            variant = (7 - currentDofWeek) + requestedDofWeek;
                        }
                        else {
                            variant = requestedDofWeek - currentDofWeek;
                            if (variant === 0) { variant = 7; }
                        }
                        return addDays(currentDate, variant);
                    }
                    else {
                        return null;
                    }
                }
            }
            else { return goodDate; }
        }
    }
    // end
}
