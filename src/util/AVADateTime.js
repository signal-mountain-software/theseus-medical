import { titleCase } from '../util/AVAUtilities';

export function addDays(pDate, pDays) {
    const copy = pDate;
    copy.setDate(pDate.getDate() + pDays);
    return copy;
}

export function daysDiff(d1, d2) {
    let one_day = 1000 * 60 * 60 * 24;
    return Math.abs(Math.floor((d2.getTime() - d1.getTime()) / one_day));
}

export function makeDate(pInput) {
    if (!pInput) {
        return {
            'error': true,
            'relative': '',
            'absolute': '',
            'oaDate': '',
            'date': null,
            'timestamp': 0,
            'ymd': '2099.01.01',
            'obs': '2099.1.1',
            'numeric': 20990101
        };
    }
    let targetDateStamp, targetDate;
    if (pInput instanceof Date) {
        targetDateStamp = pInput.getTime();
        targetDate = pInput;
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
                targetDate = buildDate(`${Math.floor(pInput / 100)}/${pInput % 100}`);
            }
            else if (pInput <= 123199) {
                targetDate = buildDate(`${Math.floor(pInput / 10000)}/${Math.floor((pInput % 10000) / 100)}/20${pInput % 100}`);
            }
            else if (pInput <= 991231) {
                targetDate = buildDate(`${Math.floor((pInput % 10000) / 100)}/${pInput % 100}/20${Math.floor(pInput / 10000)}`);
            }
            else if (pInput <= 12312999) {
                targetDate = buildDate(`${Math.floor(pInput / 1000000)}/${Math.floor((pInput % 1000000) / 10000)}/${pInput % 10000}`);
            }
            else if (pInput <= 29991231) {
                targetDate = buildDate(`${Math.floor((pInput % 10000) / 100)}/${pInput % 100}/${Math.floor(pInput / 10000)}`);
            }
            else { targetDate = new Date(pInput); }
        }
        else if ((typeof pInput) !== 'string') { targetDate = new Date(pInput); }
        else { targetDate = buildDate(pInput); }
        if (targetDate instanceof Date) {
            targetDateStamp = targetDate.getTime();
        }
        else {
            return {
                'error': true,
                'relative': `${pInput} is not a valid date`,
                'absolute': `${pInput} is not a valid date`,
                'oaDate': `${pInput} is not a valid date`,
                'date': null,
                'timestamp': 0,
                'ymd': '2099.01.01',
                'obs': '2099.1.1',
                'numeric': 20990101
            };
        }
    }
    let currentDate = new Date();
    let relDate, absDate, oaDate;
    // Make relative date
    let hours = 60 * 60 * 1000;
    let beginningOfCurrentDay = currentDate.setHours(0, 0, 0, 0);

    if (targetDateStamp < beginningOfCurrentDay) {
        if (targetDateStamp > (beginningOfCurrentDay - (24 * hours))) {
            relDate = 'yesterday';
        }
        else if (targetDateStamp > (beginningOfCurrentDay - (7 * 24 * hours))) {
            let mWord = '';
            if ((currentDate.getTime() - targetDateStamp) > (4 * 24 * hours)) {
                mWord = 'last ';
            }
            relDate = `${mWord}${targetDate.toLocaleString([], { weekday: 'long' })}`;
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
            relDate = `${mWord}${targetDate.toLocaleString([], { weekday: 'long' })}`;
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
    absDate = `${targetDate.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric' })}`;
    if (!relDate) { relDate = absDate; }
    if (targetDate.getFullYear() !== currentDate.getFullYear()) {
        absDate += ` ${targetDate.getFullYear()}`;
        if (daysDiff(targetDate, new Date()) > 21) { relDate += ` ${targetDate.getFullYear()}`; }
    }
    oaDate = `on ${absDate}`;
    if ((targetDate.getHours() > 0) || (targetDate.getMinutes() > 0)) {
        let tOfDay = ` at ${targetDate.toLocaleString([], { hour: 'numeric', minute: '2-digit' })}`;
        absDate += tOfDay;
        oaDate += tOfDay;
        relDate += tOfDay;
    }
    let targetDateYMD = targetDate.getFullYear()
        + '.' + (targetDate.getMonth() + 101).toString().slice(1)
        + '.' + (targetDate.getDate() + 100).toString().slice(1);
    let regEx = /\.0/g;
    return {
        'error': false,
        'relative': titleCase(relDate),
        'absolute': titleCase(absDate),
        'oaDate': titleCase(oaDate),
        'date': targetDate,
        'timestamp': targetDateStamp,
        'ymd': targetDateYMD,
        'obs': targetDateYMD.replace(regEx, '.'),
        'numeric': Number(targetDateYMD.replace(/\./g,''))
    };

    function buildDate(pString) {
        let [words, days$] = pString.split(/[-+]/);
        let daysToAdd = 0;
        if (days$) {
            daysToAdd = parseInt(days$.trim(), 10) * (pString.includes('-') ? -1 : 1);
            pString = words.trim();
        }
        if (/^\d+$/.test(pString)) { pString = parseInt(pString, 10); }
        let goodDate = new Date(pString);
        if (isNaN(goodDate)) {
            let currentDate = new Date();
            let tDate = pString.trim().substr(0, 3).toLowerCase();
            if (tDate === 'now') { tDate = 'tod'; }
            else { currentDate.setHours(0, 0, 0, 0); }
            if (tDate === 'tom') {
                return addDays(currentDate, (1 + daysToAdd));
            }
            else if (tDate === 'tod') {
                return addDays(currentDate, daysToAdd);
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
                        variant = (7 + requestedDofWeek - currentDofWeek);
                    }
                    else {
                        variant = requestedDofWeek - currentDofWeek;
                        if (variant <= 0) { variant += 7; }
                    }
                    return addDays(currentDate, (variant + daysToAdd));
                }
                else {
                    return null;
                }
            }
        }
        else {
            // the date passed in was a good date
            // if the year is more than 20 years from now, assume that no year was passed in
            // Adjust the year to be the year that makes the month and day closest to now
            let today = new Date();
            let thisYear = today.getFullYear();
            let resolvedYear = goodDate.getFullYear();
            if (Math.abs(resolvedYear - thisYear) < 20) { return goodDate; }
            goodDate.setFullYear(thisYear);
            if (daysDiff(today, goodDate) <= 120) { return goodDate; }
            let resolvedMonth = goodDate.getMonth();
            if (resolvedMonth > 9) { goodDate.setFullYear(thisYear - 1); }
            else if (resolvedMonth < 3) { goodDate.setFullYear(thisYear + 1); }
            return goodDate;
        }
    }
};

export function isDate(pIn) {
    return (pIn instanceof Date);
}

export function makeTime(pTime) {
    let inTime;
    let ampm, hh, hh$, mm$;
    let mm = 0;
    if (isDate(pTime)) {
        hh = pTime.getHours();
        mm = pTime.getMinutes();
    }
    else {
        if (typeof (pTime) === 'string') {
            inTime = pTime;
            if (inTime.includes('p')) { ampm = 'pm'; }
            else if (inTime.includes('a')) { ampm = 'am'; };
            [hh$, mm$] = inTime.split(':');
            hh = Number(hh$.replace(/\D+/g, ''));
            if ((ampm === 'pm') && (hh < 12)) { hh += 12; }
        }
        else { hh = pTime; }
        if (hh > 100) {
            if (!mm$) { mm = hh % 100; }
            hh = Math.floor(hh / 100);
        }
        if (mm$) { mm = Number(mm$.replace(/\D+/g, '')); }
        if (mm > 59) {
            let hAdd = Math.floor(mm / 60);
            mm -= (hAdd * 60);
            hh += hAdd;
        }
        if (hh >= 23) {
            hh = hh % 24;
        }
        if (hh >= 12) {
            hh -= 12;
            ampm = 'pm';
        }
        if (hh === 0) {
            hh = 12;
            ampm = 'pm';
        }
    }
    if (!ampm) { ampm = ((hh >= 0) && (hh < 12)) ? 'am' : 'pm'; }
    let numeric24;
    if ((ampm === 'pm') && (hh < 12)) { numeric24 = ((hh + 12) * 100) + mm; }
    else { numeric24 = ( hh * 100) + mm; }
    let dayPart;
    if (hh < 12) { dayPart = "morning"; }
    else if (hh < 17) { dayPart = "afternoon"; }
    else (dayPart = "evening");
    return {
        'time': `${hh}:${mm < 10 ? ('0' + mm) : mm} ${ampm}`,
        'short': `${hh}:${mm < 10 ? ('0' + mm) : mm}`,
        'hhmm': `${hh}${mm}`,
        numeric24,
        dayPart
    };
}