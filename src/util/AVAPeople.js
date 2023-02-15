import { getIcon, isPromise, cl, recordExists } from '../util/AVAUtilities';

const AWS = require('aws-sdk');

const dbClient = new AWS.DynamoDB.DocumentClient({
    apiVersion: '2012-08-10',
    region: "us-east-1",
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY
});

const s3 = new AWS.S3({
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY
});

let imageObj = {};
let profile, session;


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

export async function getImage(pPerson, override = false) {
    if (imageObj.hasOwnProperty(pPerson) && !override) { return imageObj[pPerson]; }
    const imageBucket = 'theseus-medical-storage';
    const imageURI = `public/patients/${pPerson}.jpg`;
    let oData;
    try {
        await s3.getObject({
            Bucket: imageBucket,
            Key: imageURI,
        }, function (error, data) {
            if (data) { oData = data; };
        })
            .promise();
        if (!oData || (oData.ContentLength === 0)) {
            if (!('AVA Logo' in imageObj)) { getIcon('AVA Logo'); }
            imageObj[pPerson] = imageObj['AVA Logo'];
            return imageObj['AVA Logo'];
        };
        let gotImage =
            s3.getSignedUrl('getObject', {
                Bucket: imageBucket,
                Key: imageURI,
                Expires: 3600
            });
        imageObj[pPerson] = gotImage;
        return gotImage;
    }
    catch (e) {
        console.log(`error getting S3 image is ${e}`);
        if (!('AVA Logo' in imageObj)) { getIcon('AVA Logo'); }
        imageObj[pPerson] = imageObj['AVA Logo'];
        return imageObj['AVA Logo'];
    }
};

export async function getPerson(pID, pElement = '*all', override = false) {
    if (!profile || (profile.person_id !== pID)) {
        let personRec = await dbClient
            .get({
                Key: { person_id: pID },
                TableName: "People"
            })
            .promise()
            .catch(error => { cl({ 'Error reading Groups': error }); });
        if (!recordExists(personRec)) { return {}; }
        if (!personRec.Item.hasOwnProperty('messaging')) {
            personRec.Item.messaging = {};
        }
        if (personRec.Item.messaging.voice) {
            var cleaned = ('' + personRec.Item.messaging.voice).replace(/\D/g, '');
            var match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
            if (match) {
                personRec.Item.home = [match[2], '-', match[3], '-', match[4]].join('');
                personRec.Item.search_data += ' ' + personRec.Item.messaging.voice;
            }
        }
        else { personRec.Item.home = ''; }
        if (personRec.Item.messaging.sms) {
            cleaned = ('' + personRec.Item.messaging.sms).replace(/\D/g, '');
            match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
            if (match) {
                personRec.Item.cell = [match[2], '-', match[3], '-', match[4]].join('');
                personRec.Item.search_data += ' ' + personRec.Item.messaging.sms;
            }
        }
        if (personRec.Item.messaging.office) {
            cleaned = ('' + personRec.Item.messaging.office).replace(/\D/g, '');
            match = cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
            if (match) {
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
        profile = personRec.Item;
    }
    switch (pElement.toLowerCase()) {
        case '*all': { return profile; }
        case 'name': { return makeName(profile); }
        default: { return profile; }
    }
};

export async function getSession(pID) {
    if (session && (session.session_id === pID)) {
        return session;
    }
    let sessionRec = await dbClient
        .get({
            Key: { session_id: pID },
            TableName: "SessionsV2"
        })
        .promise()
        .catch(error => { cl({ 'Error reading Groups': error }); });
    if (recordExists(sessionRec)) {
        session = sessionRec.Item;
        return sessionRec.Item;
    }
    return {};
};