import { isPromise, cl, recordExists, sentenceCase, dbClient } from '../util/AVAUtilities';

let foundPeople = {};
let savedSession;

export async function makeName(pRec) {
    if (!pRec) { return 'N/A'; }
    else if (typeof pRec !== 'object') { return AVAname(await getPerson(pRec)); }
    else if ('Item' in pRec) { return AVAname(pRec.Item); }
    else if ('Items' in pRec) { return pRec.Items.map(p => AVAname(p)); }
    else { return AVAname(pRec); }
};

export function AVAname(pRec) {
    if (isPromise(pRec)) {
        return 'Unresolved';
    }
    else if (!pRec) { return 'No name'; }
    else if ('name' in pRec) {
        return (`${pRec.name.first || ''} ${pRec.name.last || ''}`).trim();
    }
    else if ('displayName' in pRec) { return pRec.displayName; }
    else if ('messaging' in pRec) {
        if (('preferred_method' in pRec) &&
            pRec.messaging.hasOwnProperty(pRec.preferred_method)) {
            return `${pRec.messaging[pRec.preferred_method]} (${pRec.person_id})`;
        }
        else {
            let destinations = Object.keys(pRec.messaging);
            for (let k = 0; k < destinations.length; k++) {
                if (typeof destinations[k] !== 'boolean') {
                    return `${pRec.messaging[destinations[k]]} (${pRec.person_id})`;
                }
            }
        }
    }
    else { return pRec.person_id; }
}

export function getImage(pPerson) {
    return `https://d3sds9ybtm36gy.cloudfront.net/${pPerson}.jpg`;
};

export async function getPersonFromPartialID(pClient, pID) {
    let qQ = { TableName: 'People' };
    qQ.IndexName = 'client_id-index';
    qQ.KeyConditionExpression = 'client_id = :c';
    qQ.FilterExpression = 'contains(#p, :pID)';
    qQ.ExpressionAttributeNames = { '#p': 'person_id' };
    qQ.ExpressionAttributeValues = { ':c': pClient, ':pID': pID };
    let qR = await dbClient
        .query(qQ)
        .promise()
        .catch(error => {
            if (error.code === 'NetworkingError') {
                console.log(`Security Violation or no Internet Connection`);
            }
            console.log({ 'Error reading People by Person ID': error });
        });
    if (recordExists(qR)) {
        for (let p = 0; p < qR.Items.length; p++) {
            foundPeople[qR.Items[p].person_id] = qR.Items[p];
        }
        return qR.Items;
    }
    else { return []; }
}

export async function getPersonFromLocation(pClient, pLoc) {
    let replacements = {
        East: 'E',
        West: 'W',
        North: 'N',
        South: 'S',
        Unit: ' '
    }
    for (let v in replacements) {
        pLoc = pLoc.replace(v, replacements[v]);
        pLoc = pLoc.replace(v.toLowerCase(), replacements[v]);
        pLoc = pLoc.replace(v.toUpperCase(), replacements[v]);
    }
    pLoc = pLoc.replace(/\s+/g, '-');
    let qQ = { TableName: 'People' };
    qQ.IndexName = 'client_id-index';
    qQ.KeyConditionExpression = 'client_id = :c';
    qQ.FilterExpression = 'contains(#l, :pL) or contains(#l, :pLup) or contains(#l, :pLow)';
    qQ.ExpressionAttributeNames = { '#l': 'location' };
    qQ.ExpressionAttributeValues = { ':c': pClient, ':pL': pLoc, ':pLup': pLoc.toUpperCase(), ':pLow': pLoc.toLowerCase() };
    let qR = await dbClient
        .query(qQ)
        .promise()
        .catch(error => {
            if (error.code === 'NetworkingError') {
                console.log(`Security Violation or no Internet Connection`);
            }
            console.log({ 'Error reading Person by Location': error });
        });
    if (recordExists(qR)) {
        for (let p = 0; p < qR.Items.length; p++) {
            foundPeople[qR.Items[p].person_id] = qR.Items[p];
        }
        return qR.Items;
    }
    else { return []; }
}

export async function getPersonByName(pClient, pFirstName, pLastName) {
    if (!pLastName) { [pFirstName, pLastName] = pFirstName.split(' '); }
    let qQ = { TableName: 'People' };
    qQ.IndexName = 'display_name-index';
    qQ.KeyConditionExpression = 'client_id = :c and contains(#f, :f) and contains(#f, :l)';
    qQ.ExpressionAttributeValues = { ':c': pClient, ':f': sentenceCase(pFirstName), ':l': sentenceCase(pLastName) };
    qQ.ExpressionAttributeNames = { '#f': 'display_name' }
    let qR = await dbClient
        .query(qQ)
        .promise()
        .catch(error => {
            if (error.code === 'NetworkingError') {
                console.log(`Security Violation or no Internet Connection`);
            }
            console.log({ 'Error reading People by Name': error });
        });
    if (recordExists(qR)) {
        for (let p = 0; p < qR.Items.length; p++) {
            foundPeople[qR.Items[p].person_id] = qR.Items[p];
        }
        return qR.Items;
    }
    else { return []; }
}

export async function getPerson(pID, pElement = '*all', override = false) {
    if (!foundPeople || (!(pID in foundPeople)) || override) {
        let personRec = await dbClient
            .get({
                Key: { person_id: pID },
                TableName: "People"
            })
            .promise()
            .catch(error => { cl({ 'Error reading People': error }); });
        if (!recordExists(personRec)) { return {}; }
        if (!personRec.Item.hasOwnProperty('messaging')) {
            personRec.Item.messaging = {};
        }
        if (personRec.Item.messaging.voice) {
            personRec.Item.voice = personRec.Item.home = formatPhone(personRec.Item.messaging.voice);
            personRec.Item.search_data += ' ' + personRec.Item.messaging.voice;
        }
        else { personRec.Item.voice = personRec.Item.home = ''; }
        if (personRec.Item.messaging.sms) {
            personRec.Item.cell = personRec.Item.sms = formatPhone(personRec.Item.messaging.sms);
            personRec.Item.search_data += ' ' + personRec.Item.messaging.sms;
        }
        else { personRec.Item.cell = personRec.Item.sms = ''; }
        if (personRec.Item.messaging.office) {
            personRec.Item.office = formatPhone(personRec.Item.messaging.office);
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
        foundPeople[pID] = personRec.Item;
    }
    switch (pElement.toLowerCase()) {
        case '*all': { return foundPeople[pID]; }
        case 'name': { return await makeName(foundPeople[pID]); }
        default: { return foundPeople[pID]; }
    }
};

export function formatPhone(numberIn) {
    if (typeof (numberIn) === 'string') { numberIn = Number(numberIn.replace(/\D/g, '')); }
    let response = '';
    switch (true) {
        case (numberIn > 9999999): {
            response += `(${('  ' + Math.floor(numberIn / 10000000)).slice(-3)}) `;
        }
        // eslint-disable-next-line
        case (numberIn > 9999): {
            response += `${('  ' + Math.floor(numberIn / 10000)).slice(-3)}-`;
            response += ('0000' + (numberIn % 10000).toString()).slice(-4);
            break;
        }
        default: { response += ('    ' + (numberIn % 10000).toString()).slice(-4); }
    }
    return response.trim();
}

export async function getSession(pID) {
    if (savedSession && (savedSession.session_id === pID)) {
        return savedSession;
    }
    let sessionRec = await dbClient
        .get({
            Key: { session_id: pID },
            TableName: "SessionsV2"
        })
        .promise()
        .catch(error => { cl({ 'Error reading SessionsV2': error }); });
    if (recordExists(sessionRec)) {
        if (('groups_managed' in sessionRec.Item) && !Array.isArray(sessionRec.Item.groups_managed)) {
            sessionRec.Item.groups_managed = sessionRec.Item.groups_managed.split(/[[,\]]/);
        }
        if (('responsible_for' in sessionRec.Item) && !Array.isArray(sessionRec.Item.responsible_for)) {
            sessionRec.Item.responsible_for = sessionRec.Item.responsible_for.split(/[[,\]]/);
        }
        savedSession = sessionRec.Item;
        return sessionRec.Item;
    }
    return {};
};