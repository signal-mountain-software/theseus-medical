const AWS = require('aws-sdk');

const AVAIcon = 'https://ava-icons.s3.amazonaws.com/AVA+Logo.png';

const dbClient = new AWS.DynamoDB.DocumentClient({
    apiVersion: '2012-08-10',
    region: "us-east-1",
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY
});


export function recordExists(recordId) {
    if (!recordId) { return false; }
    if (recordId.hasOwnProperty('Count')) { return (recordId.Count > 0); }
    else { return ((recordId.hasOwnProperty("Item") || recordId.hasOwnProperty("Items"))); }
}

export function addDays(pDate, pDays) {
    const copy = pDate;
    copy.setDate(pDate.getDate() + pDays);
    return copy;
}

export function stringToColor(string) {
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

export function cl() {
    for (let v = 0; v < arguments.length; v++) {
        let value = arguments[v];
        if (typeof (value) === 'object') { console.log(JSON.stringify(value)); }
        else { console.log(value); }
    }
};

export function clt() {
    for (let v = 0; v < arguments.length; v++) {
        let value = arguments[v];
        if (typeof (value) === 'object') { console.log(JSON.stringify(value)); }
        else { console.log({ value }); }
    };
};

export async function getPerson(pPerson, pElement = '*all') {
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
        case 'name': { return makeName(peopleRec.Item); }
        default: {
            return peopleRec.Item;
        }
    }
};

export async function getPersonDetails(pPerson) {
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

export function sentenceCase(pString) {
    return (!pString ? '' : pString.slice(0, 1).toUpperCase() + pString.slice(1).toLowerCase());
}

export function titleCase(pString) {
    if (!pString) { return ''; }
    let words = pString.split(/\s+/);
    let returnString = '';
    words.forEach(w => {
        if (w.length < 4) { returnString += w; }
        else { returnString += sentenceCase(w); }
        returnString += ' ';
    });
    return returnString.trim();
}

// end

export function makeName(pRec) {
    if (!pRec) { return 'N/A'; }
    else if (typeof pRec !== 'object') { return getPerson(pRec, 'name'); }
    else if ('Item' in pRec) { return AVAname(pRec.Item); }
    else if ('Items' in pRec) { return pRec.Items.map(p => AVAname(p)); }
    else { return AVAname(pRec); }

    function AVAname(pRec) {
        if ('name' in pRec) {
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

export function makeNumber(pNum) {
    if (!pNum) { return 0; }
    else {
        let pN = Number(pNum);
        if (isNaN(pN)) { return 0; }
        else { return pN; }
    }
};

export function makeDate(pInput) {
    if (!pInput) {
        return {
            'relative': '',
            'absolute': '',
            'date': null,
            'timestamp': 0,
            'ymd': '2099.01.01'
        };
    }
    let targetDateStamp, targetDate;
    if (pInput instanceof Date) {
        targetDateStamp = pInput.getTime();
        targetDate = pInput;
    }
    else {
        if ((typeof pInput) !== 'string') { targetDate = new Date(pInput); }
        else { targetDate = buildDate(pInput); }
        if (targetDate instanceof Date) {
            targetDateStamp = targetDate.getTime();
        }
        else {
            return {
                'relative': `${pInput} is not a valid date`,
                'absolute': `${pInput} is not a valid date`,
                'date': null,
                'timestamp': 0,
                'ymd': '2099.01.01'
            };
        }
    }
    let currentDate = new Date();
    let mDate = null;
    let relDate, absDate;
    // Make relative date
    let hours = 60 * 60 * 1000;
    let midnight = currentDate.setHours(0, 0, 0, 0);

    if (targetDateStamp < midnight) {
        if (targetDateStamp > (midnight - (24 * hours))) {
            relDate = 'yesterday';
        }
        else if (targetDateStamp > (midnight - (7 * 24 * hours))) {
            let mWord = '';
            if (targetDate.getDay() < 6) {
                mWord = 'last ';
            }
            relDate = `${mWord}${targetDate.toLocaleString([], { weekday: 'long' })}`;
        }
    }
    else if (targetDateStamp >= (midnight + (24 * hours))) {
        if (targetDateStamp < (midnight + (48 * hours))) {
            relDate = 'tomorrow';
        }
        else if (targetDateStamp < (midnight + (8 * 24 * hours))) {
            let mWord = '';
            if (targetDate.getDay() <= currentDate.getDay()) {
                mWord = 'next ';
            }
            relDate = `${mWord}${targetDate.toLocaleString([], { weekday: 'long' })}`;
        }
    }
    else {
        let hour = targetDate.getHours();
        if (hour < 12) { relDate = "this morning"; }
        else if (hour < 17) { relDate = "this afternoon"; }
        else (relDate = "this evening");
    }
    // Make absolute date
    absDate = `${targetDate.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;
    if (!relDate) { relDate = absDate; }
    if (targetDate.getFullYear() !== currentDate.getFullYear()) {
        if (targetDate.getMonth() > 3 || currentDate.getMonth() < 9) {
            targetDate.setFullYear(currentDate.getFullYear());
        }
        else {
            targetDate.setFullYear(currentDate.getFullYear() + 1);
        }
        absDate += ` ${targetDate.getFullYear()}`;
    }
    if ((targetDate.getHours() > 0) && (targetDate.getMinutes() > 0)) {
        let tOfDay = ` at ${targetDate.toLocaleString([], { hour: 'numeric', minute: '2-digit' })}`;
        absDate += tOfDay;
        relDate += tOfDay;
    }
    let targetDateYMD = targetDate.getFullYear()
        + '.' + (targetDate.getMonth() + 101).toString().slice(1)
        + '.' + (targetDate.getDate() + 100).toString().slice(1);
    return {
        'relative': titleCase(relDate),
        'absolute': titleCase(absDate),
        'date': targetDate,
        'timestamp': targetDateStamp,
        'ymd': targetDateYMD
    };

    function addDays(pDate, pDays) {
        const copy = pDate;
        copy.setDate(pDate.getDate() + pDays);
        return copy;
    }

    function buildDate(pString) {
        if (/^\d+$/.test(pString)) { pString = parseInt(pString, 10); }
        let goodDate = new Date(pString);
        cl({ 'in buildDate': pString, 'goodDate': goodDate.toLocaleString(), 'bad': isNaN(goodDate) });
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
                        if (variant <= 0) { variant += 7; }
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
};
