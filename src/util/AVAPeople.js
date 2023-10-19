import { isPromise, cl, recordExists, sentenceCase, titleCase, isEmpty, dbClient } from '../util/AVAUtilities';

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
    };
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
    if (!pLastName) {
        if (pFirstName.includes(',')) { 
            let pWords = pFirstName.split(/,(.*)/);
            pLastName = pWords[0].trim();
            pFirstName = pWords[1].trim();
        }
        else {
            let pWords = pFirstName.split(' ');
            pLastName = pWords.pop();
            pFirstName = pWords.join(' ');
        }
    }
    let qQ = { TableName: 'People' };
    qQ.IndexName = 'client_id-index';
    qQ.KeyConditionExpression = 'client_id = :c';
    qQ.FilterExpression = 'contains(#f, :f) and contains(#f, :l)';
    qQ.ExpressionAttributeValues = { ':c': pClient, ':f': sentenceCase(pFirstName), ':l': sentenceCase(pLastName) };
    qQ.ExpressionAttributeNames = { '#f': 'display_name' };
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

export async function getPersonByWords(pClient, pWords) {
    if (!pWords || pWords.length === 0) { return []; }
    let qQ = { TableName: 'People' };
    qQ.IndexName = 'client_id-index';
    qQ.KeyConditionExpression = 'client_id = :c';
    qQ.ExpressionAttributeNames = { '#d': 'search_data' };
    qQ.ExpressionAttributeValues = { ':c': pClient };
    qQ.FilterExpression = '';
    let conjunction = '';
    for (let x = 0; x < pWords.length; x++) {
        if (pWords[x] && (pWords[x].length > 2)) {
            qQ.FilterExpression += ` ${conjunction} contains(#d, :f${x})`;
            qQ.ExpressionAttributeValues[`:f${x}`] = pWords[x];
            conjunction = 'and';
        }
    }
    if (!qQ.FilterExpression) { return []; }
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
            let searchWords = qR.Items[p].search_data.split(/[\W,]/);
            let notFoundWords = pWords.filter(w => { return (w && !searchWords.includes(w)); })
            if (notFoundWords.length === 0) {
                foundPeople[qR.Items[p].person_id] = qR.Items[p];
            }
            else {
                qR.Items.splice(p, 1);
            }
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
    if (!numberIn) { return ''; }
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

export async function addGuest(body) {
    if (!body
        || !body.name
        || !body.name.first
        || !body.name.last
        || (!body.phone && !body.sms && (!body.messaging || !body.messaging.sms))
        || !body.client_id
    ) { return { result: 'failed', message: 'Missing data in request' }; }
    let tryAgain;
    let availableID = '';
    let namePart = `${body.client_id}_guest_`;
    if (body.id || body.person_id) { namePart += body.id || body.person_id; }
    else { namePart += body.name.first.trim().substr(0, 1).toLowerCase() + body.name.last.toLowerCase().replace(/\W/g, ''); }
    let numberPart = 1;
    let lookupID = namePart;
    do {
        let found = await getPerson(lookupID);
        if (!isEmpty(found)) {
            tryAgain = true;
            lookupID = `${namePart}${numberPart}`;
            numberPart++;
        }
        else {
            tryAgain = false;
            availableID = lookupID;
        }
    } while (tryAgain);
    cl(`User ID ${availableID} assigned`);
    let putPerson = {
        person_id: availableID,
        client_id: body.client_id,
        "name": {
            first: titleCase(body.name.first),
            last: titleCase(body.name.last),
        },
        messaging: {
            email: body.email || (body.messaging ? body.messaging.email : null),
            sms: body.phone || body.sms || (body.messaging ? body.messaging.sms : null),
            voice: body.voice || (body.messaging ? body.messaging.voice : null),
            office: body.office || (body.messaging ? body.messaging.office : null)
        },
        search_data: makeSearchData([body]) + ' guest',
        preferred_method: 'sms',
        requirePassword: false,
        storePassword: true,
        directory_option: 'normal',
        clients: {
            id: body.client_id,
            groups: ['guests']
        },
        groups: ['guests'],
        location: body.location ? body.location.replace(/,/g, '') : body.client_id
    };
    await dbClient
        .put({
            Item: putPerson,
            TableName: "People",
        })
        .promise()
        .catch(error => {
            cl(`caught error updating People; error is:`, error);
            return { result: 'failed', message: error };
        });
    return { result: 'success', personRec: putPerson };
}

export async function addVendor(body) {
    if (!body) {
        return { result: 'failed', message: 'Missing data in request' };
    }
    else if (!body.name || !body.name.first || !body.name.last) {
        return { result: 'failed', message: 'Missing name in request' };
    }
    else if (!body.location) {
        return { result: 'failed', message: 'Missing location in request' };
    }
    else if (!body.client_id) {
        return { result: 'failed', message: 'Missing client in request' };
    }
    else if (!body.phone && !body.sms && (!body.messaging || !body.messaging.sms)) {
        return { result: 'failed', message: 'Missing phone number in request' };
    }
    let tryAgain;
    let availableID = '';
    let namePart = `${body.client_id}_vendor_`;
    if (body.id || body.person_id) { namePart += body.id || body.person_id; }
    else { namePart += body.name.first.trim().substr(0, 1).toLowerCase() + body.name.last.toLowerCase().replace(/\W/g, ''); }
    let numberPart = 1;
    let lookupID = namePart;
    do {
        let found = await getPerson(lookupID);
        if (!isEmpty(found)) {
            tryAgain = true;
            lookupID = `${namePart}${numberPart}`;
            numberPart++;
        }
        else {
            tryAgain = false;
            availableID = lookupID;
        }
    } while (tryAgain);
    cl(`User ID ${availableID} assigned`);
    let putPerson = {
        person_id: availableID,
        client_id: body.client_id,
        "name": {
            first: titleCase(body.name.first),
            last: titleCase(body.name.last),
        },
        messaging: {
            email: body.email || (body.messaging ? body.messaging.email : null),
            sms: body.phone || body.sms || (body.messaging ? body.messaging.sms : null),
            voice: body.voice || (body.messaging ? body.messaging.voice : null),
            office: body.office || (body.messaging ? body.messaging.office : null)
        },
        search_data: makeSearchData([body]) + ' vendor',
        preferred_method: 'sms',
        requirePassword: false,
        storePassword: true,
        directory_option: 'normal',
        clients: {
            id: body.client_id,
            groups: ['vendors']
        },
        groups: ['vendors'],
        location: body.location ? body.location.replace(/,/g, '') : body.client_id
    };
    await dbClient
        .put({
            Item: putPerson,
            TableName: "People",
        })
        .promise()
        .catch(error => {
            cl(`caught error updating People; error is:`, error);
            return { result: 'failed', message: error };
        });
    return { result: 'success', personRec: putPerson };
}

export function makeSearchData(iArray) {
    let search_words = [];
    iArray.forEach(i => {
        if (i.searchTerm) { search_words.push(...(i.searchTerm.trim().split(/\s+/))); };
        if (i.location) {
            search_words.push(...(i.location.replace(/,/g, ' ').trim().toLowerCase().split(/\s+/)));
            let digits = i.location.replace(/\D+/g, '').trim();
            if (digits) {
                search_words.push(...(digits.split(/\s+/)));
            }
        }
        let names = [i.firstName, i.lastName, (i.display_name ? i.display_name.replace(/,/g, ' ') : '')];
        if (i.name) (names.push(...(Object.values(i.name))))
        names.forEach(n => {
            if (n) {
                search_words.push(...(n.trim().toLowerCase().split(/\s+/)));
                search_words.push(...(titleCase(n.trim()).split(/\s+/)));
            }
        });
        let phone = [i.cell, i.sms, i.office, i.voice];
        if (i.messaging) (phone.push(...(Object.values(i.messaging))));
        phone.forEach(p => {
            if (p && (typeof (p) === 'string')) {
                let iC = p.replace(/\D/g, '');
                search_words.push(iC);
                search_words.push(iC.slice(-4));
            }
        });
    });
    let wordCheck = [];
    search_words.forEach(w => {
        if (!wordCheck.includes(w) && (w !== 'undefined')) { wordCheck.push(w); }
    });
    return wordCheck.join(' ');
}
