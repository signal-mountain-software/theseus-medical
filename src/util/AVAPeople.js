import { isPromise, cl, recordExists } from '../util/AVAUtilities';

const AWS = require('aws-sdk');

const dbClient = new AWS.DynamoDB.DocumentClient({
    apiVersion: '2012-08-10',
    region: "us-east-1",
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY
});

let foundPeople = {};
let savedSession;

export async function makeName(pRec) {
    if (!pRec) { return 'N/A'; }
    else if (typeof pRec !== 'object') { return AVAname(await getPerson(pRec)); }
    else if ('Item' in pRec) { return AVAname(pRec.Item); }
    else if ('Items' in pRec) { return pRec.Items.map(p => AVAname(p)); }
    else { return AVAname(pRec); }

    function AVAname(pRec) {
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
};

export function getImage(pPerson) {
    return `https://d3sds9ybtm36gy.cloudfront.net/${pPerson}.jpg`;
};

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