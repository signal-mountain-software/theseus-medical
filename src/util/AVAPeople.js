import { isPromise, cl, recordExists, sentenceCase, titleCase, isEmpty, dbClient, getObject } from '../util/AVAUtilities';

let foundPeople = {};
let savedSession;
const PERSON_PHOTO_THUMB_KEY_PREFIX = 'ava_person_photo_thumb__';
const PERSON_PHOTO_THUMB_SIZE = 64;
const PERSON_PHOTO_THUMB_QUALITY = 0.55;
const personPhotoThumbCache = {};
const personPhotoBackfillInProgress = new Set();

function getPersonPhotoThumbStorageKey(person_id) {
    return `${PERSON_PHOTO_THUMB_KEY_PREFIX}${person_id}`;
}

function rememberPersonPhotoThumb(person_id, thumbData) {
    if (!person_id || !thumbData) { return thumbData || null; }
    personPhotoThumbCache[person_id] = thumbData;
    if (foundPeople?.[person_id]) {
        foundPeople[person_id].person_photo = thumbData;
    }
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem(getPersonPhotoThumbStorageKey(person_id), thumbData);
        }
    }
    catch (_error) {
        // Ignore storage quota/privacy failures; in-memory cache is enough for current session.
    }
    return thumbData;
}

function getRememberedPersonPhotoThumb(person_id) {
    if (!person_id) { return null; }
    if (personPhotoThumbCache[person_id]) {
        return personPhotoThumbCache[person_id];
    }
    if (foundPeople?.[person_id]?.person_photo) {
        return rememberPersonPhotoThumb(person_id, foundPeople[person_id].person_photo);
    }
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const cachedThumb = window.localStorage.getItem(getPersonPhotoThumbStorageKey(person_id));
            if (cachedThumb) {
                return rememberPersonPhotoThumb(person_id, cachedThumb);
            }
        }
    }
    catch (_error) {
        // Ignore storage access failures.
    }
    return null;
}

function renderSquareThumbFromImage(imageEl) {
    const canvas = document.createElement('canvas');
    canvas.width = PERSON_PHOTO_THUMB_SIZE;
    canvas.height = PERSON_PHOTO_THUMB_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) { return null; }
    const side = Math.min(imageEl.naturalWidth, imageEl.naturalHeight);
    const sx = (imageEl.naturalWidth - side) / 2;
    const sy = (imageEl.naturalHeight - side) / 2;
    ctx.drawImage(imageEl, sx, sy, side, side, 0, 0, PERSON_PHOTO_THUMB_SIZE, PERSON_PHOTO_THUMB_SIZE);
    return canvas.toDataURL('image/jpeg', PERSON_PHOTO_THUMB_QUALITY);
}

export function createPersonPhotoThumbFromFile(file) {
    return new Promise((resolve) => {
        if (!file || !file.type?.startsWith('image/')) { resolve(null); return; }
        const imageEl = new Image();
        const objectUrl = URL.createObjectURL(file);
        imageEl.onload = () => {
            URL.revokeObjectURL(objectUrl);
            try {
                resolve(renderSquareThumbFromImage(imageEl));
            }
            catch (_error) {
                resolve(null);
            }
        };
        imageEl.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
        };
        imageEl.src = objectUrl;
    });
}

export function createPersonPhotoThumbFromUrl(imageUrl) {
    return new Promise((resolve) => {
        if (!imageUrl || typeof imageUrl !== 'string') { resolve(null); return; }
        const imageEl = new Image();
        imageEl.crossOrigin = 'anonymous';
        imageEl.onload = () => {
            try {
                resolve(renderSquareThumbFromImage(imageEl));
            }
            catch (_error) {
                resolve(null);
            }
        };
        imageEl.onerror = () => resolve(null);
        imageEl.src = imageUrl;
    });
}

export async function persistPersonPhotoThumb(person_id, thumbData) {
    if (!person_id || !thumbData) { return null; }
    await dbClient.update({
        TableName: 'People',
        Key: { person_id },
        UpdateExpression: 'set person_photo = :thumb',
        ExpressionAttributeValues: {
            ':thumb': thumbData
        }
    }).promise().catch((error) => {
        cl({ [`Failed to persist person_photo for ${person_id}`]: error });
    });
    return rememberPersonPhotoThumb(person_id, thumbData);
}

async function backfillPersonPhotoThumb(person_id, options = {}) {
    const allowS3Backfill = options.allowS3Backfill !== false;
    if (!person_id || personPhotoBackfillInProgress.has(person_id)) {
        return getRememberedPersonPhotoThumb(person_id);
    }
    personPhotoBackfillInProgress.add(person_id);
    try {
        const personRec = await getPerson(person_id, '*all');
        if (personRec?.person_photo) {
            return rememberPersonPhotoThumb(person_id, personRec.person_photo);
        }
        if (!allowS3Backfill) {
            return null;
        }
        const imageUrl = getObject(person_id, 'image');
        const thumbData = await createPersonPhotoThumbFromUrl(imageUrl);
        if (!thumbData) { return null; }
        await persistPersonPhotoThumb(person_id, thumbData);
        return thumbData;
    }
    catch (error) {
        cl({ [`Failed to backfill person photo thumb for ${person_id}`]: error });
        return null;
    }
    finally {
        personPhotoBackfillInProgress.delete(person_id);
    }
}

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

export function getImage(pPerson, options = {}) {
    const allowS3Fallback = options.allowS3Fallback !== false;
    const allowS3Backfill = options.allowS3Backfill !== false;
    let person_id = '';
    if (typeof (pPerson) === 'string') {
        person_id = pPerson;
    }
    else if (Array.isArray(pPerson)) {
        person_id = pPerson[0];
    }
    else if (pPerson?.person_photo) {
        return rememberPersonPhotoThumb(pPerson.person_id, pPerson.person_photo);
    }
    else if (pPerson?.person_id) {
        person_id = pPerson.person_id;
    }
    else {
        return '';
    }

    const cachedThumb = getRememberedPersonPhotoThumb(person_id);
    if (cachedThumb) {
        return cachedThumb;
    }

    void backfillPersonPhotoThumb(person_id, { allowS3Backfill });
    if (!allowS3Fallback) {
        return '';
    }
    return getObject(person_id, 'image');
    // return `https://d3sds9ybtm36gy.cloudfront.net/${pPerson}.jpg`;
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
    // Filter to only include valid search words (truthy and length > 2)
    pWords = pWords.filter(w => w && w.length > 2);
    if (pWords.length === 0) { return []; }
    pWords = pWords.map(w => w.replace(/\W/g, '').toLowerCase());
    let normalizedClient = (pClient || '').toLowerCase().trim();

    {
        let matchedPersonIds = {};

        async function findMatchesInPeopleAccounts({ accountType, requireClientMatch = false }) {
            let lastEvaluatedKey;
            do {
                let qQ = { TableName: 'PeopleAccounts' };
                qQ.IndexName = 'identifier-index';
                qQ.KeyConditionExpression = 'account_type = :n';
                qQ.ExpressionAttributeValues = { ':n': accountType };
                if (lastEvaluatedKey) {
                    qQ.ExclusiveStartKey = lastEvaluatedKey;
                }
                let qR = await dbClient
                    .query(qQ)
                    .promise()
                    .catch(error => {
                        if (error.code === 'NetworkingError') {
                            console.log(`Security Violation or no Internet Connection`);
                        }
                        console.log({ 'Error reading People by Name': error });
                    });
                if (!recordExists(qR)) {
                    return;
                }
                qR.Items.forEach(item => {
                    let identifierText = (item.identifier || '').toLowerCase();
                    let searchWords = identifierText.split(/[\W,]/).filter(Boolean);
                    if (requireClientMatch && normalizedClient) {
                        let idClient = searchWords[searchWords.length - 1] || '';
                        if (idClient !== normalizedClient) {
                            return;
                        }
                    }
                    let allWordsFound = pWords.every(w => searchWords.includes(w));
                    if (allWordsFound) {
                        matchedPersonIds[item.person_id] = true;
                        foundPeople[item.person_id] = item;
                    }
                });
                lastEvaluatedKey = qR.LastEvaluatedKey;
            } while (lastEvaluatedKey);
        }

       
        if (Object.keys(matchedPersonIds).length === 0) {
            await findMatchesInPeopleAccounts({
                accountType: 'name',
                requireClientMatch: true
            });
        }

        const responseObj = await Promise.all(
            Object.keys(matchedPersonIds).map(personId => {
                console.log(personId);
                return getPerson(personId, "*all", true);
            })
        );
        return responseObj;
    }










    /*
    let qQ = { TableName: 'People' };
    qQ.IndexName = 'client_id-index';
    qQ.KeyConditionExpression = 'client_id = :c';
    qQ.ExpressionAttributeNames = { '#d': 'search_data' };
    qQ.ExpressionAttributeValues = { ':c': pClient };
    qQ.FilterExpression = '';
    let conjunction = '';
    pWords.forEach((word, x) => {
        qQ.FilterExpression += ` ${conjunction} contains(#d, :f${x})`;
        qQ.ExpressionAttributeValues[`:f${x}`] = word;
        conjunction = 'and';
    });
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
        qR.Items = qR.Items.filter(item => {
            let searchWords = item.search_data.split(/[\W,]/);
            let allWordsFound = pWords.every(w => searchWords.includes(w));
            if (allWordsFound) {
                foundPeople[item.person_id] = item;
            }
            return allWordsFound;
        });
        return qR.Items;
    }
    else { return []; }
    */
}

export async function getWIPFormList({ client_id, personList }) {
    let response = {};

    // in a minute, we're going to need the names and due dates of all the forms that are found.
    // we'll grab them all here.
    let formNames = {};
    let formDueDates = {};
    let formList = {};
    let formResult = await dbClient
        .query({
            TableName: 'Forms',
            KeyConditionExpression: 'client_id = :c',
            ExpressionAttributeValues: { ':c': client_id }
        })
        .promise()
        .catch(error => {
            if (error.code === 'NetworkingError') {
                cl(`Security Violation or no Internet Connection`);
            }
            cl(`Error reading Forms is ${error}`);
        });
    if (recordExists(formResult)) {
        for (let this_form of formResult.Items) {
            formNames[this_form.form_id] = this_form.form_name;
            formDueDates[this_form.form_id] = this_form.due_by ? this_form.due_by[0] : null;
        }
    }

    // ... and we'll need the formList from every group
    let groupResult = await dbClient
        .query({
            TableName: 'Groups',
            KeyConditionExpression: 'client_id = :c',
            ExpressionAttributeValues: { ':c': client_id }
        })
        .promise()
        .catch(error => {
            if (error.code === 'NetworkingError') {
                cl(`Security Violation or no Internet Connection`);
            }
            cl(`Error reading Groups is ${error}`);
        });
    if (recordExists(groupResult)) {
        for (let this_group of groupResult.Items) {
            formList[this_group.group_id] = this_group.forms;
        }
    }

    for (let person_id of personList) {
        // get all the groups that this person belongs to
        let peopleRec = await dbClient
            .get({
                Key: { person_id: person_id },
                TableName: "People"
            })
            .promise()
            .catch(error => {
                cl({ [`in getWIPFormList, Error reading People key=${person_id}`]: error });
            });
        if (!recordExists(peopleRec)) {
            response[person_id] = {
                formListObj: {},
                numberWIP: 0,
                nearest_dueDate: 0
            };
        }

        let myFormListObj = {};
        // get all the forms that are assigned to people in this group 
        for (let this_group of peopleRec.Item.groups) {
            if (formList[this_group] && (formList[this_group].length > 0)) {
                for (let this_form of formList[this_group]) {
                    if (!myFormListObj.hasOwnProperty(this_form)) {
                        myFormListObj[this_form] = {
                            form_id: this_form,
                            form_name: formNames[this_form],
                            due_date: formDueDates[this_form],
                            completed: false,
                            wip: false,
                            document_list: []
                        };
                    }
                }
            }
        }

        // get all the completed documents for this person
        let recentlyCompletedDocs = await dbClient
            .query({
                KeyConditionExpression: 'pertains_to = :p',
                ScanIndexForward: false,
                IndexName: 'pertains_to-formType_date-index',
                Limit: 40,
                TableName: 'CompletedDocuments',
                ExpressionAttributeValues: {
                    ':p': person_id
                }
            })
            .promise()
            .catch(error => {
                if (error.code === 'NetworkingError') {
                    cl(`Security Violation or no Internet Connection`);
                }
                cl(`Error reading CompletedDocuments; error is ${error}`);
            });
        if (recordExists(recentlyCompletedDocs)) {
            for (let this_doc of recentlyCompletedDocs.Items) {
                if (!myFormListObj.hasOwnProperty(this_doc.formType)) {
                    myFormListObj[this_doc.formType] = {
                        form_id: this_doc.formType,
                        form_name: formNames[this_doc.formType],
                        due_date: formDueDates[this_doc.formType],
                        completed: true,
                        wip: false,
                        document_list: []
                    };
                }
                myFormListObj[this_doc.formType].completed = true;
                myFormListObj[this_doc.formType].document_list.push({
                    document_id: this_doc.document_id,
                    isComplete: true,
                    location: this_doc.file_location,
                    date_completed: this_doc.date_completed
                });
            }
        }

        // Check for an exising WIP form
        let wipDocuments = await dbClient
            .query({
                KeyConditionExpression: 'pertains_to = :p',
                ScanIndexForward: false,
                TableName: 'DocumentsInProcess',
                IndexName: 'pertains_to-formType_date-index',
                ExpressionAttributeValues: {
                    ':p': person_id,
                }
            })
            .promise()
            .catch(error => {
                if (error.code === 'NetworkingError') {
                    cl(`Security Violation or no Internet Connection`);
                }
                cl(`Error reading DocumentsInProcess; error is ${error}`);
            });
        if (recordExists(wipDocuments)) {
            for (let this_doc of wipDocuments.Items) {
                if (!myFormListObj.hasOwnProperty(this_doc.formType)) {
                    myFormListObj[this_doc.formType] = {
                        form_id: this_doc.formType,
                        form_name: formNames[this_doc.formType],
                        due_date: formDueDates[this_doc.formType],
                        completed: false,
                        wip: true,
                        document_list: []
                    };
                }
                myFormListObj[this_doc.formType].wip = true;
                myFormListObj[this_doc.formType].document_list.push({
                    document_id: this_doc.document_id,
                    isComplete: false,
                });
            }
        }

        // go through all the forms to summarize
        let numberWIP = 0;
        let nearest_dueDate = false;
        for (let this_formID in myFormListObj) {
            if (!myFormListObj[this_formID].completed || myFormListObj[this_formID].wip) {
                numberWIP++;
                if (myFormListObj[this_formID].due_date
                    && (myFormListObj[this_formID].due_date > 0)
                    && (!nearest_dueDate || (myFormListObj[this_formID].due_date < nearest_dueDate))
                ) {
                    nearest_dueDate = myFormListObj[this_formID].due_date;
                }
            }
        }
        response[person_id] = {
            formListObj: {},
            numberWIP,
            nearest_dueDate
        };
    }
    return response;
}

export async function getPerson(pID, pElement = '*all', override = false) {
    if (!foundPeople || (!(pID in foundPeople)) || override) {
        let personRec = await dbClient
            .get({
                Key: { person_id: pID },
                TableName: "People"
            })
            .promise()
            .catch(error => {
                cl({ [`in getPerson, Error reading key=${pID}`]: error });
            });
        if (!recordExists(personRec)) {
            if (pElement === 'validate') { return false; }
            else { return {}; }
        }
        else if (pElement === 'validate') { return true; }
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
        if (!personRec.Item.hasOwnProperty('name')) {
            personRec.Item.name = {};
        }
        personRec.Item.first = personRec.Item?.name.first;
        personRec.Item.last = personRec.Item?.name.last;
        personRec.Item.display_name = (`${personRec.Item.first} ${personRec.Item.last}`).trim();
        if (!personRec.Item.search_data) { personRec.Item.search_data = ''; }
        personRec.Item.search_data += personRec.Item.search_data.toLowerCase();
        personRec.Item.search_data +=
            ' ' + personRec.Item.messaging.email +
            ' ' + (personRec.Item.messaging.voice || '') +
            ' ' + (personRec.Item.messaging.office || '') +
            ' ' + (personRec.Item.messaging.sms || '');
        if (personRec.Item.person_photo) {
            rememberPersonPhotoThumb(pID, personRec.Item.person_photo);
        }
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
            Item: Object.assign({}, body, putPerson),
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
        if (i.name) (names.push(...(Object.values(i.name))));
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
                if (iC.length > 10) {
                    search_words.push(iC.slice(1));
                }
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
