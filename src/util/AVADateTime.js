import { titleCase } from '../util/AVAUtilities';

export function addDays(pDate, pDays) {
    let copy;
    try {
        copy = makeDate(pDate).date;
        if (copy.error) {
            return copy;
        }
        copy.setDate(copy.getDate() + pDays);
    }
    catch {
        console.log(`tried ${pDate} and failed`);
    }
    return copy;
}

export function addMonths(pDate, pMonths) {
    let copy;
    copy = makeDate(pDate);
    if (copy.error) {
        return copy;
    }
    let cDate = copy.date;
    cDate.setMonth(cDate.getMonth() + pMonths);
    return makeDate(cDate);
}


export function daysDiff(d1, d2) {
    let oneMinute = 1000 * 60;
    let one_day = 1000 * 60 * 60 * 24;
    let d1DST = d1.getTimezoneOffset();
    let d2DST = d2.getTimezoneOffset();
    return Math.abs(Math.floor((d2.getTime() - d1.getTime() - ((d2DST - d1DST) * oneMinute)) / one_day));
}

export function makeDate(pInput, optionIn = {}) {
    if (!pInput) {
        return {
            'error': true,
            'relative': '',  // next Tuesday
            'absolute': '',  // Tue, Aug 22
            'absolute_full': '',  // Tuesday, August 22, 2023
            'dateOnly': '',  // August 22
            'timeOnly': '', // 2:45pm
            'oaDate': '',   // on Tue, Aug 22, 2023 at 2:45pm
            'date': null,
            'timestamp': 0,
            'ymd': '2099.01.01',
            'input': '2099-01-01',
            'obs': '2099.1.1',
            'numeric': 20990101,
            'numeric$': '20990101',
            'dayPart': 'day',   // afternoon
            'workingHours': 'day',   // day, night, weekend
            'dayOfWeek': 0,    // Sun = 0, Mon = 1, ... , Sat = 6
            'dayOfWeek_word': 'Sunday',
            'weekday': '',   // 'weekend' or 'weekday' 
            'textOut': pInput
        };
    }
    let options = {};
    if (typeof (optionIn) === 'string') {
        options[optionIn] = true;
    }
    else {
        options = Object.assign({}, optionIn);
    }
    if (!options.hasOwnProperty('timeZone')) {
        options.timeZone = 'America/New_York';
    }
    let originalInput = pInput;
    let targetDateStamp, targetDate;
    if (pInput instanceof Date) {
        if (options.noTime) {
            pInput.setHours(0, 0, 0, 0);
        }
        targetDateStamp = pInput.getTime();
        targetDate = new Date(pInput);
    }
    else {
        if (Number(pInput).toString() === pInput) { pInput = Number(pInput); }  // convert a string that is all digits to its numeric equivalent
        if ((typeof pInput) === 'number') {
            //      101 -     1231 mm dd in logical year (see makedate)
            //    10101 -   123199 mm dd yy
            //   200101 -   991231 yy mm dd
            //  1010001 - 12312999 mm dd yyyy
            // 20200101 - 29991231 yyyy mm dd
            //          > 29991231 java timestamp
            if (pInput <= 1231) {
                targetDate = buildDate(`${Math.floor(pInput / 100)}/${pInput % 100}`).date;
            }
            else if (pInput <= 123199) {
                targetDate = buildDate(`${Math.floor(pInput / 10000)}/${Math.floor((pInput % 10000) / 100)}/20${pInput % 100}`).date;
            }
            else if (pInput <= 991231) {
                targetDate = buildDate(`${Math.floor((pInput % 10000) / 100)}/${pInput % 100}/20${Math.floor(pInput / 10000)}`).date;
            }
            else if (pInput <= 12312999) {
                targetDate = buildDate(`${Math.floor(pInput / 1000000)}/${Math.floor((pInput % 1000000) / 10000)}/${pInput % 10000}`).date;
            }
            else if (pInput <= 29991231) {
                targetDate = buildDate(`${Math.floor((pInput % 10000) / 100)}/${pInput % 100}/${Math.floor(pInput / 10000)}`).date;
            }
            else { targetDate = new Date(pInput); }
        }
        else if ((typeof pInput) !== 'string') { targetDate = new Date(pInput); }
        else {
            let response = buildDate(pInput);
            targetDate = response.date;
            pInput = response.leftOver_text || '';
        }
        if (isDate(targetDate)) {
            targetDateStamp = targetDate.getTime();
        }
        else {
            return {
                'error': true,
                'relative': `${pInput} is not a valid date`,
                'absolute': `${pInput} is not a valid date`,
                'absolute_full': `${pInput} is not a valid date`,
                'dateOnly': `${pInput} is not a valid date`,
                'timeOnly': `${pInput} is not a valid date`,
                'oaDate': `${pInput} is not a valid date`,
                'date': null,
                'timestamp': 0,
                'ymd': '2099.01.01',
                'input': '2099-01-01',
                'obs': '2099.1.1',
                'numeric': 20990101,
                'numeric$': '20990101',
                'dayPart': 'day',
                'workingHours': `${pInput} is not a valid date`,
                'dayOfWeek': 9,
                'dayOfWeek_word': 'invalid',
                'weekday': 'invalid',
                'textOut': pInput
            };
        }
    }

    let currentDate = new Date();
    let beginningOfCurrentDay = currentDate.setHours(0, 0, 0, 0);

    if (options.noTime) {
        targetDate.setHours(0, 0, 0, 0);
    }

    // validation
    if (options.validation) {
        let foundError;
        switch (options.validation) {
            case 'noFuture': {
                if (targetDate > currentDate) {
                    foundError =
                        `${targetDate.toLocaleString([], { timeZone: options.timeZone, month: 'short', day: 'numeric', year: 'numeric' })} is in the future and not allowed here`;
                }
                break;
            }
            case 'noPast': {
                if (targetDateStamp < beginningOfCurrentDay) {
                    foundError = `${originalInput} is in the past and not allowed here`;
                }
                break;
            }
            default: { }
        }
        if (foundError) {
            return {
                'error': true,
                'relative': foundError,
                'absolute': foundError,
                'absolute_full': foundError,
                'dateOnly': foundError,
                'timeOnly': foundError,
                'oaDate': foundError,
                'date': null,
                'timestamp': 0,
                'ymd': '2099.01.01',
                'input': '2099-01-01',
                'obs': '2099.1.1',
                'numeric': 20990101,
                'numeric$': '20990101',
                'dayPart': 'day',
                'workingHours': foundError,
                'dayOfWeek': 9,
                'dayOfWeek_word': 'invalid',
                'weekday': 'invalid',
                'textOut': pInput
            };
        }
    }

    // force this date to be in the future
    if (options.forceForward) {
        if (targetDate < currentDate) {
            targetDate.setFullYear(currentDate.getFullYear() + 1);
        }
    }

    // Make relative date
    let relDate, absDate, oaDate, dateOnly, absFull;
    let hours = 60 * 60 * 1000;
    if (targetDateStamp < beginningOfCurrentDay) {
        if (targetDateStamp > (beginningOfCurrentDay - (24 * hours))) {
            relDate = 'yesterday';
        }
        else if (targetDateStamp > (beginningOfCurrentDay - (7 * 24 * hours))) {
            let mWord = '';
            if ((currentDate.getTime() - targetDateStamp) > (4 * 24 * hours)) {
                mWord = 'last ';
            }
            relDate = `${mWord}${targetDate.toLocaleString([], { timeZone: options.timeZone, weekday: 'long' })}`;
        }
    }
    else if (targetDateStamp >= (beginningOfCurrentDay + (24 * hours))) {
        if (targetDateStamp < (beginningOfCurrentDay + (48 * hours))) {
            relDate = 'tomorrow';
        }
        else if (targetDateStamp < (beginningOfCurrentDay + (8 * 24 * hours))) {
            let mWord = '';
            if (targetDate.getDay() <= currentDate.getDay()) {
                mWord = 'next ';
            }
            relDate = `${mWord}${targetDate.toLocaleString([], { timeZone: options.timeZone, weekday: 'long' })}`;
        }
    }
    else {
        let hour = targetDate.getHours();
        if ((hour + targetDate.getMinutes()) === 0) { relDate = "today"; }
        else if (hour < 12) { relDate = "this morning"; }
        else if (hour < 17) { relDate = "this afternoon"; }
        else (relDate = "this evening");
    }
    // Make absolute date
    absDate = `${targetDate.toLocaleString([], { timeZone: options.timeZone, weekday: 'short', month: 'short', day: 'numeric' })}`;
    absFull = `${targetDate.toLocaleString([], { timeZone: options.timeZone, weekday: 'long', month: 'long', year: 'numeric', day: 'numeric' })}`;
    dateOnly = `${targetDate.toLocaleString([], { timeZone: options.timeZone, month: 'short', day: 'numeric' })}`;
    if (!relDate) { relDate = absDate; }
    if (targetDate.getFullYear() !== currentDate.getFullYear()) {
        absDate += ` ${targetDate.getFullYear()}`;
        if (daysDiff(targetDate, new Date()) > 21) { relDate += ` ${targetDate.getFullYear()}`; }
    }
    oaDate = `on ${absDate}`;
    if ((targetDate.getHours() > 0) || (targetDate.getMinutes() > 0)) {
        let tOfDay = ` at ${targetDate.toLocaleString([], { timeZone: options.timeZone, hour: 'numeric', minute: '2-digit' })}`;
        absDate += tOfDay;
        oaDate += tOfDay;
        relDate += tOfDay;
    }
    let dayPart = 'day';
    let workingHours = 'day';
    let hour = targetDate.getHours();
    if (hour < 12) { dayPart = "morning"; }
    else if (hour < 17) { dayPart = "afternoon"; }
    else (dayPart = "evening");
    if (options.working_hours) {
        if ((options.working_hours.hasOwnProperty('isHoliday')) && (options.working_hours.isHoliday)) {
            workingHours = "holiday";
        }
        else if ((options.working_hours.hasOwnProperty('weekend')) && (options.working_hours.weekend) && ((targetDate.getDay() % 6) === 0)) {
            workingHours = "weekend";
        }
        else {
            let startTime = 800;
            if (options.working_hours.hasOwnProperty('start')) {
                let try_start = Number(options.working_hours.start);
                if (!isNaN(try_start)) {
                    if (try_start < 100) {
                        try_start *= 100;
                    }
                    startTime = try_start;
                }
            }
            let endTime = 1800;
            if (options.working_hours.hasOwnProperty('end')) {
                let try_end = Number(options.working_hours.end);
                if (!isNaN(try_end)) {
                    if (try_end < 100) {
                        try_end *= 100;
                    }
                    endTime = try_end;
                }
            }
            if (((hour * 100) < startTime) || ((hour * 100) > endTime)) {
                workingHours = "night";
            };
        }
    }
    else {
        if ((targetDate.getDay() % 6) === 0) {
            workingHours = "weekend";
        }
        else if ((hour < 8) || (hour > 18)) {
            workingHours = "night";
        };
    }
    let targetDateYMD = targetDate.getFullYear()
        + '.' + (targetDate.getMonth() + 101).toString().slice(1)
        + '.' + (targetDate.getDate() + 100).toString().slice(1);
    let targetDateInput = targetDate.getFullYear()
        + '-' + (targetDate.getMonth() + 101).toString().slice(1)
        + '-' + (targetDate.getDate() + 100).toString().slice(1);
    let regEx = /\.0/g;
    return {
        'error': false,
        'relative': titleCase(relDate),
        'absolute': titleCase(absDate),
        'absolute_full': titleCase(absFull),
        'timeOnly': targetDate.toLocaleString([], { timeZone: options.timeZone, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
        'dateOnly': dateOnly,
        'oaDate': titleCase(oaDate),
        'date': targetDate,
        'timestamp': targetDateStamp,
        'ymd': targetDateYMD,
        'input': targetDateInput,
        'obs': targetDateYMD.replace(regEx, '.'),
        'numeric': Number(targetDateYMD.replace(/\./g, '')),
        'numeric$': targetDateYMD.replace(/\./g, ''),
        'dayPart': dayPart,
        'workingHours': workingHours,
        'dayOfWeek': targetDate.getDay(),
        'dayOfWeek_word': `${targetDate.toLocaleString([], { timeZone: options.timeZone, weekday: 'long' })}`,
        'weekday': (((targetDate.getDay() % 6) === 0) ? 'weekend' : 'weekday'),
        'textOut': pInput
    };

    function buildDate(pString) {
        if (!pString) {
            return {
                date: new Date(),
                leftOver_text: ''
            };
        }
        // is this a string as yyyy-mm-dd?
        let test_me = pString.split('-');
        if (test_me.length === 3) {
            pString = `${test_me[1].trim()}/${test_me[2].trim()}/${test_me[0].trim()}`;
        }
        // is the text a good date on its own?
        let parsed = pString.match(/[+-]/);
        let datePart;
        let addendPart = 0;
        let delimiter = '+';
        if (parsed) {
            delimiter = parsed[0];
            [datePart, addendPart] = pString.split(delimiter);
            if (isNaN(addendPart)) {
                addendPart = 0;
            }
        }
        else {
            datePart = pString;
        }
        datePart = datePart.replace(/st|th|nd|rd/, '');
        const today = new Date(new Date().setHours(0, 0, 0, 0));   // midnight at the start of the current day
        let validateDate = new Date(datePart);
        if (isDate(validateDate)) {    // if something came in (say "Feb 20" or "2/20") that is a good date, we'll use it
            // BUT... if there was no year, the default is 2001 (probably not what they want); check for that here
            let sixtyDaysAgo = addDays(today, -60);
            let finalAnswer = validateDate;
            if (validateDate < sixtyDaysAgo) {
                // this tries to take a date in the past and make it current year
                // note that we APPEND the year, so if the incoming date string had a year explicity stated, that year will be used
                let date_asCorrected = new Date(`${datePart} ${today.getFullYear()}`);
                // in some cases, however, that doesn't work (example: on Dec 15, you enter January 5 - you want the date to be next year)
                if (!isDate(date_asCorrected) || (date_asCorrected < sixtyDaysAgo)) {
                    let try_me = new Date(`${datePart} ${today.getFullYear() + 1}`);
                    if (isDate(try_me)) {
                        finalAnswer = try_me;
                    }
                }
                else if (isDate(date_asCorrected)) {
                    finalAnswer = date_asCorrected;
                }
                else {
                    finalAnswer = validateDate;
                }
            }
            return {
                date: addDays(finalAnswer, ((delimiter === '-') ? -1 : 1) * Number(addendPart)),
                leftOver_text: ''
            };
        }
        // the text is some odd combination
        let daysToAdd = 0;
        let words, plusMinus, days$;
        let timePart;
        let validString = pString.match(/(\d+[/\-.]\s*\d+[/\-.]\s*\d+)\s*(([+-])(.*))?/);
        if (validString) {
            [, words, , plusMinus, days$] = validString;
        }
        else {
            validString = pString.match(/(.*)([-+])(.*)/);
            if (validString) {
                [, words, plusMinus, days$] = validString;
            }
        }
        if (words) {
            pString = words.trim();
        }
        if (days$) {
            daysToAdd = parseInt(days$.trim(), 10) * (plusMinus.includes('-') ? -1 : 1);
        }
        if (/^\d+$/.test(pString)) { pString = parseInt(pString, 10); }      // a string that is all numbers
        else {
            // extract time if it is present (time will be in group 2)
            let mTime = pString.match(/([\s\w/]*)\s((\d+:*\d*)\s*([PpAa].*[Mm])*)/);
            if (mTime && mTime.length > 2) {
                timePart = makeTime(mTime[2]);
                timePart.exists = true;
                pString = pString.replace(mTime[2], '');
            }
            let pStringPieces = pString.split(/[./-]/gm);
            if (pStringPieces.length > 1) {        // two or three strings separated by "." or "-" or "/"
                let yearAt = pStringPieces.findIndex(p => { return (p > 1900); });
                let yearPiece, monthPiece, dayPiece;
                if (yearAt < 0) {
                    if (pStringPieces.length > 2) {
                        let twoDigYr = parseInt(pStringPieces[2], 10);
                        if (twoDigYr < 30) {
                            yearPiece = twoDigYr + 2000;
                        }
                        else {
                            yearPiece = twoDigYr + 1900;
                        }
                    }
                    else {
                        yearPiece = new Date().getFullYear();
                    }
                }
                else {
                    yearPiece = pStringPieces[yearAt];
                    pStringPieces.splice(yearAt, 1);
                }
                monthPiece = pStringPieces[0];
                if (pStringPieces.length === 1) {
                    dayPiece = 1;
                }
                else {
                    dayPiece = pStringPieces[1];
                }
                pString = `${monthPiece}/${dayPiece}/${yearPiece}`;
            }
        }
        let goodDate = new Date(pString);
        if (!isDate(goodDate)) {
            let m = pString.match(/(\d+:*\d*)\s*([PpAa].*[Mm])/);
            if (m) {
                pString = pString.replace(m[0], `${m[1]}${m[2]}`);
            }
            let pWords = pString.split(/\s+/);
            let currentDate;
            pWords = pWords.filter(f => {      // filter expression will consume words that successfully contribute to the date 
                let culledDate = dateFromText(f);
                if (culledDate) {
                    currentDate = culledDate;
                    return false;
                }
                else {
                    return true;
                }
            });
            if (!isDate(currentDate)) {
                return { date: null, leftOver_text: pString };
            }
            if (timePart && timePart.exists) {
                currentDate.setHours(timePart.hh24, timePart.mm);
            }
            let variant = 0;
            const foundAt = pWords.findIndex(value => /last|next/.test(value));
            if (foundAt > -1) {
                if (pWords[foundAt] === 'last') {
                    variant = -7;
                }
                else { variant = 7; }
                pWords.splice(foundAt, 1);
            }
            return {
                date: addDays(currentDate, (variant + daysToAdd)),
                leftOver_text: pWords.join(' ')
            };
        }
        else {
            // the date passed in was a good date
            // if the year is more than 100 years from now, assume that no year was passed in
            // Adjust the year to be the year that makes the month and day closest to now
            goodDate = addDays(goodDate, daysToAdd);
            let today = new Date();
            let thisYear = today.getFullYear();
            let resolvedYear = goodDate.getFullYear();
            if ((Math.abs(resolvedYear - thisYear) < 5) || (options.noYearCorrection)) {
                return {
                    date: goodDate,
                    leftOver_text: null
                };
            }
            // If you arrive here, the date is 100 years from now.  Set it to a more recent date automatically
            goodDate.setFullYear(thisYear);
            if ((goodDate > today) || (daysDiff(today, goodDate) <= 120)) {
                return {
                    date: goodDate,
                    leftOver_text: null
                };
            }
            // date is more than 120 days before today
            let resolvedMonth = goodDate.getMonth();
            if (resolvedMonth > 9) { goodDate.setFullYear(thisYear - 1); }   // and date is October or later, then assume last year
            return {
                date: goodDate,
                leftOver_text: null
            };
        }
    }

    function dateFromText(pString) {
        if (pString.match(/\d+\/\d+/)) {     // pString is in the form nn/nn
            let dateFromString = new Date(pString);
            if (dateFromString.getFullYear() === 2001) {
                dateFromString.setFullYear(new Date().getFullYear());
            }
            return dateFromString;
        }
        else {
            let ordinal = pString.match(/(\d+)(st|nd|rd|th)/);  // pString looks like an ordinal (1st, 2nd, 3rd, etc)          
            if (ordinal) {
                let n = ordinal[1];      // the numeric part is in array position 1 (array position 0 is the entire matched ordinal)
                let now = new Date();
                let thisMonth_target = new Date();
                thisMonth_target.setDate(n);
                if (thisMonth_target >= now) {
                    let lastMonth_target = new Date();
                    lastMonth_target.setMonth(now.getMonth() - 1, n);
                    if (daysDiff(now, lastMonth_target) < 7) { return lastMonth_target; }
                    else {
                        return thisMonth_target;
                    }
                }
                else {
                    if ((daysDiff(thisMonth_target, now) < 7) || (options.noFuture)) {
                        return thisMonth_target;
                    }
                    else {
                        let nextMonth_target = new Date();
                        nextMonth_target.setMonth(now.getMonth() + 1, n);
                        return nextMonth_target;
                    }
                }
            }
        }
        let currentDate = new Date();
        let pStringLower = pString.toLowerCase();
        if (pStringLower === 'now') {
            pString = 'today';
            pStringLower = 'today';
        }
        else { currentDate.setHours(0, 0, 0, 0); }
        if (pStringLower === 'tomorrow') {
            return addDays(currentDate, 1);
        }
        else if (pStringLower === 'today') {
            return currentDate;
        }
        else if (pStringLower === 'yesterday') {
            return addDays(currentDate, - 1);
        }
        else {
            let currentDofWeek = new Date().getDay();
            let requestedDofWeek = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(pStringLower.slice(0, 3));
            if (requestedDofWeek > -1) {
                let variant = requestedDofWeek - currentDofWeek;
                if (variant < 0) { variant += 7; }
                return addDays(currentDate, variant);
            }
            else {
                return null;
            }
        }
    }
};

export function isDate(pIn) {
    return ((pIn instanceof Date) && !isNaN(pIn.getTime()));
}

export function sameDate(d1, d2) {
    if (!d1 || !d2) { return false; }
    if (d1 === d2) { return true; }
    return (makeDate(d1).numeric === makeDate(d2).numeric);
}

export function makeTime(pTime) {
    let inTime;
    let ampm, hh, hh$, mm$;
    let mm = 0;
    let error = false;
    let empty = false;
    if (isDate(pTime)) {
        hh = pTime.getHours();
        mm = pTime.getMinutes();
    }
    else {
        if (typeof (pTime) === 'string') {
            if (pTime.trim() === '') {
                empty = true;
            }
            if (pTime.replace(/\D+/g, '') === '') {
                ampm = 'am';
                hh = 0;
                mm$ = '00';
                mm = 0;
                empty = true;
            }
            else {
                inTime = pTime.toLowerCase();
                if (inTime.includes('pm')) { ampm = 'pm'; }
                else if (inTime.includes('am')) { ampm = 'am'; }
                else if (inTime.includes('a')) { ampm = 'am'; }
                else if (inTime.includes('p')) { ampm = 'pm'; }
                else if (inTime.slice(0, 1) === '0') {
                    ampm = 'am';
                    if (inTime.slice(1, 2) === '0') { inTime = `12${inTime.slice(2)}am`; }
                }  // support military times starting with zero
                [hh$, mm$] = inTime.split(':');
                const hhClean = hh$.replace(/\D+/g, '');
                if (!hhClean) {
                    error = true;
                }
                hh = Number(hhClean);
                if ((ampm === 'am') && (hh === 12)) { hh = 0; }
                else if ((ampm === 'pm') && (hh < 12)) { hh += 12; }
            }
        }
        else { hh = pTime; }
        if (hh >= 100) {
            if (!mm$) { mm = hh % 100; }
            hh = Math.floor(hh / 100);
        }
        if (!ampm && (hh < 7) && (hh > 0)) { hh += 12; }
        if (mm$) { mm = Number(mm$.replace(/\D+/g, '')); }
        if (mm > 59) {
            error = true;
            let hAdd = Math.floor(mm / 60);
            mm -= (hAdd * 60);
            hh += hAdd;
        }
        if (hh > 23) {
            hh = hh % 24;
        }
        if (hh > 12) {
            hh -= 12;
            ampm = 'pm';
        }
        else if ((hh === 12) && (!ampm)) {
            ampm = 'pm';
        }
        else if (hh === 0) {
            hh = 12;
            ampm = 'am';
        }
    }
    if (!ampm) { ampm = ((hh >= 0) && (hh < 12)) ? 'am' : 'pm'; }
    let numeric24;
    if ((ampm === 'pm') && (hh < 12)) { numeric24 = ((hh + 12) * 100) + mm; }
    else if ((ampm === 'am') && (hh === 12)) { numeric24 = mm; }
    else { numeric24 = (hh * 100) + mm; }
    let dayPart;
    if (numeric24 < 1200) { dayPart = "morning"; }
    else if (numeric24 < 1700) { dayPart = "afternoon"; }
    else (dayPart = "evening");
    if (mm === 0) { mm$ = '00'; }
    else if (mm < 10) { mm$ = mm.toString().padStart(2, '0'); }
    else { mm$ = mm.toString(); }
    let hh24 = Math.floor(numeric24 / 100);
    return {
        'time': `${hh}:${mm$} ${ampm}`,
        'short': `${hh}:${mm$}`,
        'hhmm': `${hh}${mm$}`,
        hh,
        hh24,
        mm,
        ampm,
        numeric24,
        minutesSinceMidnight: ((hh24 * 60) + mm),
        string24: `0000${numeric24}`.slice(-4),
        dayPart,
        empty,
        error,
        good: (!empty && !error)
    };
}