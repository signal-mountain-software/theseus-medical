import { clt, cl, recordExists, makeArray, makeString, makeNumber, uuid, dbClient, titleCase } from './AVAUtilities';
import { makeName, getPerson, formatPhone } from './AVAPeople';
import { addDays, makeDate, makeTime } from './AVADateTime';
import { sendMessages, resolveMessageVariables } from './AVAMessages';

import { jsPDF } from "jspdf";

let eventCache = {};

// Functions

export async function addEvent(body) {
  /*  request body is
  {
      "clientId": patient.client_id,
      "eventID (optional)": "Use this eventID" (if existing ID, this will override the existing event)
      "calendar_info": {
        "groups": 
        "description"
        "image"
        "event_date",
        "last_date"
        "schedule_type"
        "time_from": time_from_display_string,
        "time_to": time_to_display_string,
        "location"
        "owner"
        "restrictions"
        "signup_type"
        "slots"  (24h based time slots)
        "slot_max_seats": slot_max_seats,
        "slot_interval": slot_interval,
        "slot_visibility":
        "reminder_minutes_Enrolled"
        "reminder_minutes_NotEnrolled"
      }
    }
  */
  // Prepare Event record
  let eventID = `${body.calendar_info.description.replace(/\W/g, '').slice(0, 8)}_${uuid(6)}`.toLowerCase();
  let occPattern = Object.assign({}, setRecurrence(body.calendar_info.schedule_type));
  let eventRec = {
    client: body.clientId,
    event_key: eventID,
    event_id: eventID,
    schedule_key: 'event_master',
    record_type: 'event',
    eventData: {
      messaging: [],
      event_data: {
        description: body.calendar_info.description,
        owner: makeArray(body.calendar_info.owner),
        groups: setRestrictions(body.calendar_info.restrictions),
        type: body.calendar_info.signup_type,
        image: body.calendar_info.image,
        location: {
          // code:  (future)
          description: body.calendar_info.location
        },
        time: {
          from: body.calendar_info.time_from,
          to: body.calendar_info.time_to,
        }
      },
      occPattern,
      start_Date: occPattern.first_date || (occPattern.specified ? occPattern.specified[0] : makeDate('today').numeric),
      end_date: occPattern.last_date || (occPattern.specified ? occPattern.specified[occPattern.specified.length - 1] : makeDate('today').numeric),
      last_written_occurrence: 0,
      reminders: {
        reminder_minutes_Enrolled: body.calendar_info.reminder_minutes_Enrolled,
        reminder_minutes_NotEnrolled: body.calendar_info.reminder_minutes_NotEnrolled
      },
      sign_up: {
        name_security: (body.calendar_info.slot_visibility && (body.calendar_info.slot_visibility !== 'show_name')),
        type: body.calendar_info.signup_type,
      },
      slotPattern: setSlots(body.calendar_info)
    }
  };
  await dbClient
    .put({
      Item: eventRec,
      TableName: "Calendar",
    })
    .promise()
    .catch(error => {
      cl(`caught error updating Calendar; error is:`, error);
      return false;
    });
  eventCache[eventID] = eventRec;
  await getOccurenceList({
    client: body.clientId,
    event: eventID,
    from_date: eventRec.eventData.occPattern.first_date,
    number_of_occurrences: 30
  });
  return eventRec;

  // **********

  function setRestrictions(inR) {
    if ((inR) && (inR.length > 0)) { return inR; }
    else { return ['*all']; }
  }

  function setRecurrence(inR) {
    let first_date = makeDate(body.calendar_info.event_date);
    if (!body.calendar_info.last_date) {
      body.calendar_info.last_date = addDays(first_date.date, 365);
    }
    let last_date = makeDate(body.calendar_info.last_date).numeric;
    switch (inR) {
      case 'yearly':
      case 'annually_on': {
        return {
          recurrence: 'yearly',
          first_date: first_date.numeric,
          last_date,
          day_of_year: [first_date.numeric % 10000]
        };
      }
      case 'daily': {
        return {
          recurrence: 'daily',
          first_date: first_date.numeric,
          last_date,
          day_of_week: [0, 1, 2, 3, 4, 5, 6]
        };
      }
      case 'weekdays_only': {
        return {
          recurrence: 'daily',
          first_date: first_date.numeric,
          last_date,
          day_of_week: [1, 2, 3, 4, 5]
        };
      }
      case 'weekends_only': {
        return {
          recurrence: 'daily',
          first_date: first_date.numeric,
          last_date,
          day_of_week: [0, 6]
        };
      }
      case 'weekly_on': {
        return {
          recurrence: 'daily',
          first_date: first_date.numeric,
          last_date,
          day_of_week: body.calendar_info.occDays
        };
      }
      case 'monthly_by_dayOfWeek': {
        let ordinal = ['first', 'second', 'third', 'last'];
        return {
          recurrence: 'monthly',
          day_of_month: [ordinal[(Math.min(Math.floor(first_date.date.getDate() / 7.1) + 1, 4)) - 1]],
          day_of_week: [first_date.date.getDay()],
          first_date: first_date.numeric,
          last_date,
        };
      }
      case 'monthly':
      case 'monthly_by_date': {
        return {
          recurrence: 'monthly',
          first_date,
          last_date,
          day_of_month: [first_date.numeric % 100]
        };
      }
      case 'specified':
      case 'specific_date':
      default: {
        return {
          recurrence: 'specified',
          specified: [first_date.numeric]
        };
      }
    }
  }

  function setSlots(inCalInfo) {
    if (inCalInfo.slots) { return inCalInfo.slots; }
    else if (inCalInfo.slot_max_seats) { return setSeatNames(inCalInfo.slot_max_seats); }
    else { return null; }
  }

  function setSeatNames(inNum) {
    let digits, starter, lastSeat;
    if (inNum < 10) { digits = 1; starter = 11; lastSeat = 10 + inNum; }
    else if (inNum < 100) { digits = 2; starter = 101; lastSeat = 100 + inNum; }
    else if (inNum < 1000) { digits = 3; starter = 1001; lastSeat = 1000 + inNum; }
    else return [];
    let returnArr = [];
    for (let i = starter; i <= lastSeat; i++) {
      returnArr.push((i.toString().slice(-digits)));
    }
    return returnArr;
  }
};

export async function getCalendarEntries(body, statusUpdate) {
  /*  
  body: {
    client_id  (alt client)
    person_id  (alt person)
    event_id  (form event#occurrence OK) (alt event)
    occurrence_id  (if present, replaces occurrence in event_id) (alt occurrence)
    start_date (find occurrences starting on this date)
    end_date (find occurrences up to this date)
    type ('event', 'occurrence', 'slot', 'all', 'exact', 'structure')
    allow_create  (boolean - if type = occurrence AND record does not exist AND occurrence_id is a valid eccurrence for this event )
    return_event (boolean - when allow_create adds an occerrence, also return the associated event record)
    (alt) filter {
      person_id  (alt person)
      event_id  (alt event)
      occurrence_id  (alt occurrence)
      type
    }
  }
  */
  let start_Date, end_Date;
  if (body.startDate) { start_Date = makeDate(body.startDate).numeric; }
  else { start_Date = makeDate('today').numeric; }
  if (body.endDate) { end_Date = makeDate(body.endDate).numeric; }
  if (!end_Date || (end_Date < start_Date)) { end_Date = makeDate(addDays(makeDate(start_Date).date, 7)).numeric; }
  let returnArr = [];
  let rC = body.client_id || body.client;
  let rP = body.person_id || body.person || body.filter?.person_id || body.filter?.person;
  // rV is the event_key which may include the occurrence date as <event_id>#<occurrence_date>
  // rO is the occurrence date
  // rT is the record type
  let rV = makeString((body.event_id || body.event || body.filter?.event_id || body.filter?.event), 1);
  let rTin = body.type || body.filter?.type;
  let rT = [];
  if (!Array.isArray(rTin)) {
    if (!rTin) { rT = ['occurrence', 'event']; }
    else { rT = [rTin]; }
  }
  else { rT = [...rTin]; }
  let rO = body.occurrence_id || body.occurrence || body.filter?.occurrence_id || body.filter?.occurrence;
  let create_occ = false;
  if (body.allow_create) { create_occ = body.allow_create; }
  if (rO && rV) { rV = rV.split('#')[0] + '#' + rO; }   // both sent in change rV to include passed rO
  else if (rO) { }    // rO sent without an rV - that's bad; ignore rO
  else if (rV) { rO = rV.split('#')[1]; }     // rV sent without an rO; try to set rO from the rV value
  else { }   // netiher sent;  that's OK
  let qQ = { TableName: 'Calendar' };

  // rT is an array with one or more calendar record types in it
  for (let t = 0; t < rT.length; t++) {
    if (rV) {
      qQ.KeyConditionExpression = 'client = :c';
      qQ.ExpressionAttributeValues = { ':c': rC };
      if (rT[t]) {
        switch (rT[t]) {
          case 'all': {
            qQ.KeyConditionExpression += ' and begins_with(event_key, :rV)';
            qQ.ExpressionAttributeValues[':rV'] = `${rV.split('#')[0]}#`;
            break;
          }
          case 'event': {
            qQ.KeyConditionExpression += ' and event_key = :rV';
            qQ.ExpressionAttributeValues[':rV'] = `${rV.split('#')[0]}`;
            break;
          }
          case 'occurrence': {
            qQ.KeyConditionExpression += ' and event_key = :rV';
            let rParts = rV.split('#');
            qQ.ExpressionAttributeValues[':rV'] = `${rParts[0]}#${rParts[1]}`;
            break;
          }
          case 'structure': {
            qQ.KeyConditionExpression += ' and begins_with(event_key, :rV)';
            qQ.ExpressionAttributeValues[':rV'] = rV;
            break;
          }
          case 'slot': {
            if (rP) {
              qQ.KeyConditionExpression += ' and begins_with(event_key, :rV)';
              qQ.ExpressionAttributeValues[':rV'] = rV;
              qQ.FilterExpression = 'begins_with(list_key, :rP)';
              qQ.ExpressionAttributeValues[':rP'] = `${rP}#`;
              break;
            }
            // fall through is intentional
          }
          // eslint-disable-next-line
          case 'exact':
          default: {
            qQ.KeyConditionExpression += ' and event_key = :rV';
            qQ.ExpressionAttributeValues[':rV'] = rV;
            break;
          }
        }
      }
    }
    else if (rP) {
      qQ.IndexName = 'sign_up-index';
      qQ.KeyConditionExpression = 'schedule_key = :s and begins_with(list_key, :rP)';
      qQ.ExpressionAttributeValues = { ':rP': `${rP}#`, ':s': 'slot_data' };
    }
    else {
      // when falling through to here, no event or person was passed in
      // we assume they want all entries in the calendar that are valid between go and stop
      qQ.IndexName = 'occurrence_date-index';
      qQ.KeyConditionExpression = 'client = :c and occurrence_date between :go and :stop';
      qQ.ExpressionAttributeValues = { ':c': rC, ':go': start_Date.toString(), ':stop': end_Date.toString() };
      if (rT[t]) {
        switch (rT[t]) {
          case 'all': {
            // later, code to fetch events that go with the occurrences and slots found
            break;
          }
          case 'event': {
            // later, code to fetch events that go with the occurrences found (remove occurrences from results)
            break;
          }
          case 'exact':
          case 'occurrence': {
            qQ.FilterExpression = 'attribute_not_exists(slotData)';
            break;
          }
          case 'structure': {
            break;
          }
          case 'slot':
          default: {
            qQ.FilterExpression = 'attribute_exists(slotData) and slotData <> :null';
            qQ.ExpressionAttributeValues[':null'] = null;
            break;
          }
        }
      }
    }

    // At this point, we've contructed the query
    if (statusUpdate) { statusUpdate('Retrieving events', 100, 10); }
    let qR;
    if ((rT === 'event') && eventCache && (eventCache[rV.split('#')[0]])) {
      qR = { Items: [eventCache[rV.split('#')[0]]] };
    }
    else {
      qR = await dbClient
        .query(qQ)
        .promise()
        .catch(error => {
          if (error.code === 'NetworkingError') {
            cl(`Security Violation or no Internet Connection`);
          }
          cl(`Error reading ${qQ.TableName} id ${error}`);
        });
      if ((rT === 'event') && recordExists(qR)) {
        eventCache[rV.split('#')[0]] = qR.Items[0];
      }
    }
    if (recordExists(qR)) {
      if (statusUpdate) {
        let count = qR.Items.length;
        statusUpdate(`Found ${count} events`, count, ((100 + count) * .10) / 100);
      }
      returnArr.push(...qR.Items);
    }
    else {
      // we are here if the requested record(s) were not found
      if ((rT[t] === 'occurrence') && (create_occ)) {
        // called for a specific occurrence record
        // AND asked to create the entry if not found (create_occ = true), so...
        let newOcc = await putEventOccurrence(rC, rV, rO);  // will not create if it is an invalid occurrence
        if (newOcc && Array.isArray(newOcc)) { returnArr.push(...newOcc); }
      }
    }
  }
  // end of loop for requested types
  // at this point, returnArr has all of the records requested
  
  /*  THIS CODE REPLACES THE "CANDIDATE FOR DEPRECIATION" CODE BELOW BUT IS ALSO NOT NECESSARY
  // get a list of (up to 10) occurrences for this event over the next 90 days
  let today = makeDate(new Date());
  for (let a = 0; a < returnArr.length; a++) {
    if (returnArr[a].record_type === 'event') {
      let start_date = makeDate(returnArr[a].eventData.last_written_occurrence || today.date).date;
      if (start_date < today.date) { start_date = today.date; }
      let end_date = addDays(start_date, 90);
      let oDates = occurrenceDateBuilder(returnArr[a], start_date, end_date);
      oDates.forEach(o => { 
        if (returnArr.every(r => { return (r.occurrence_date !== o); })) {
          returnArr.push({
            client: returnArr[a].client,
            event_id: returnArr[a].event_id,
            event_key: `${returnArr[a].event_id}#${o}`,
            occurrence_date: o,
            record_type: 'occurrence'
          });
        }
      })
    }
  }
  */

  /*  CANDIDATE FOR DEPRECIATION
  // AVA will automatically create new occurrences where needed
  // for every occurrence record found, look for the next occurrence of that same event (if any)
  // add that entry to the array
  let prevDate, showDate;
  for (let a = 0; a < returnArr.length; a++) {
    if (returnArr[a].occurrence_date && (returnArr[a].occurrence_date < end_Date)) {
      if (statusUpdate) {
        if (returnArr[a].occurrence_date !== prevDate) {
          showDate = makeDate(returnArr[a].occurrence_date).relative;
          prevDate = returnArr[a].occurrence_date;
        }
        statusUpdate(showDate, returnArr.length, ((a / returnArr.length) * 100));
      }
      let nextOcc = await getOccurenceList({
        client: returnArr[a].client,
        event: returnArr[a].event_id,
        from_date: makeDate(addDays(makeDate(returnArr[a].occurrence_date).date, 1)).numeric,
        to_date: makeDate(addDays(makeDate(end_Date).date, 366)).numeric,
        number_of_occurrences: 10
      });
      if (nextOcc
        && nextOcc.occArray
        && (nextOcc.occArray.length > 0)
        && nextOcc.occArray[0]
        && (nextOcc.occArray[0] <= end_Date)
      ) {
        let newKey = `${returnArr[a].event_id}#${nextOcc.occArray[0]}`;
        if (returnArr.some(a => { return (a.event_key === newKey); })) { continue; }    // found occurrence was already in retrunArr
        else {
          returnArr.push({
            client: returnArr[a].client,
            event_id: returnArr[a].event_id,
            event_key: `${returnArr[a].event_id}#${nextOcc.occArray[0]}`,
            occurrence_date: nextOcc.occArray[0]
          });
        }
      }
    }
  }
  */
  
  // return the list of calendar entries sorted by date/slot in event key (oldest first)
  return returnArr.sort((a, b) => {
    if ((a.event_key.split(/#(.*)/)[1] || null) > (b.event_key.split(/#(.*)/)[1] || null)) { return 1; }
    else { return -1; }
  });
}

export async function updateCalendarEntry(body) {

  // body is a single, or an array of, service request records
  let unProcessed = [];
  if (Array.isArray(body)) {
    body.forEach(r => {
      unProcessed.push({
        "PutRequest": {
          "Item": r
        }
      });
    });
  }
  else {
    unProcessed[0] = {
      "PutRequest": {
        "Item": body
      }
    };
  }
  let initialCount = unProcessed.length;
  let finalCount = 0;
  let retryNeeded;
  let retryCount = 0;
  do {
    retryNeeded = false;
    let writeResponse = await dbClient
      .batchWrite({
        RequestItems: {
          'ServiceRequests': unProcessed
        }
      })
      .promise()
      .catch(error => {
        clt({ 'Bad batch write on ServiceRequests - caught error is': error });
      });
    if (writeResponse
      && ('UnprocessedItems' in writeResponse)
      && (Object.keys(writeResponse.UnprocessedItems)).length > 0) {
      unProcessed = [...writeResponse.UnprocessedItems];
      finalCount = unProcessed.length;
      retryNeeded = true;
      retryCount++;
    }
  } while (retryNeeded && (retryCount < 5));
  let returnMessage = '';
  if (finalCount === 0) { returnMessage = `Successfully updated ${initialCount} Request record${(initialCount > 1) ? 's' : ''}`; }
  else if (finalCount < initialCount) {
    let processedCount = initialCount - finalCount;
    returnMessage = `Updated ${processedCount} of ${initialCount} Request records`;
  }
  else { returnMessage = `Failed to update Request record${(initialCount > 1) ? 's' : ''}`; }
  return returnMessage;
}

export async function getSlotList(request) {
  /* 
  request
    client - client
    event - use this event 
    occurrence - use this event
  
  response
    eventRec
    occRec
    slotObj {slot: status, slot: status, ...]
  */
  let eventRec = {};
  let occRec = {};
  let slotObj = {};
  if (Array.isArray(request.event)) { request.event = makeString(request.event, 1); }
  let cRecs = await getCalendarEntries({ client: request.client, event: request.event, type: ['event', 'occurrence'] });
  if (cRecs[0].eventData || cRecs[0].calData) {
    eventRec = cRecs[0];
    if (cRecs[1]) { occRec = cRecs[1]; }
  }
  else {
    occRec = cRecs[0];
    if (cRecs[1]) { eventRec = cRecs[1]; }
  }
  if (eventRec && ('eventData' in eventRec) && (eventRec.eventData.slotPattern)) {
    let slotArray = eventRec.eventData.slotPattern;
    if (('occData' in occRec) && (occRec.occData.slotPattern)) { slotArray = occRec.occData.slotPattern; };
    slotArray.forEach(s => {
      slotObj[s] = {
        status: "available",
        show_this_slot: true
      };
    });
  }
  let slotRecs = await getCalendarEntries({ client: request.client, event: occRec.event_key, type: 'structure' });
  if (slotRecs.length > 0) {
    slotRecs.forEach(r => {
      if (r.slotData) {
        let slotKey = r.slotData.slot || r.slotData.id;
        slotObj[slotKey] = Object.assign(r.slotData, {
          status: (r.slotData.status ? r.slotData.status.current : "undefined"),
          show_this_slot: (r.slotData.hasOwnProperty('show_this_slot') ? r.slotData.show_this_slot : true),
          owner: r.slotData.owner,
          display_name: r.slotData.display_name || r.slotData.name,
          marked: r.marked
        });
      }
    });
  }
  return ({ eventRec, slotObj, occRec });
}

export async function getOccurenceList(request) {
  /* 
  takes the request and builds an array of valid occurrence dates for the requested events
  request
    client - client
    event - use this event 
      if occurrence is in event (as in event#occurence), get next occurrence after the listed one
    from_date - find next occurrence on or after this date (will override occurrence included in event)
    to_date - find all occurrences up to and including this date (default if missing is 400 days after from_date)
    number_of_occurrences - find this many
  
  response
    eventRec
    occArray [oDate, oDate...]
    occRec {oDate: occRec, oDate: occRec, ...}  if rec already exists, otherwise not present
  */
  let eventRec = {};
  let event_id, event_occurrence;
  if (typeof (request.event) === 'string') {
    [event_id, event_occurrence] = request.event.split('#');
    [eventRec] = await getCalendarEntries({ client: request.client, event: event_id, type: 'event' });
  }
  else { eventRec = request.event; }
  let response = { eventRec, occArray: [], occRec: {} };
  if (!eventRec) { return response; }
  let from_date, from_numeric, to_date, to_numeric;
  if (request.from_date
    || (('date' in request) &&
      ((request.date.hasOwnProperty('from')) || (request.date.hasOwnProperty('from_date'))))) {
    let fDate = makeDate(request.from_date || request.date.from || request.date.from_date);
    from_date = fDate.date;
    from_numeric = fDate.numeric;
  }
  else if (event_occurrence) { from_date = makeDate(event_occurrence).date; }
  else { from_date = new Date(); }
  if (request.to_date
    || (('date' in request) &&
      ((request.date.hasOwnProperty('to')) || (request.date.hasOwnProperty('to_date'))))) {
    let tDate = makeDate(request.to_date || request.date.to || request.date.to_date);
    to_date = tDate.date;
    to_numeric = tDate.numeric;
  }
  else {
    to_date = addDays(new Date(from_date), 400);
    to_numeric = makeDate(to_date).numeric;
  }
  // Now have key elements in hand:
  //   eventRec, from_date (as date), to_date (as date), and (optionally) number_of_occurrences
  let occPattern = eventRec.eventData.occPattern;
  switch (occPattern.recurrence) {
    case "daily": {
      for (let candidate = from_date; candidate < to_date; candidate = addDays(candidate, 1)) {
        if (occPattern.day_of_week.includes(candidate.getDay())) {
          await validateOccurrenceDate(makeDate(candidate).numeric);
          if (foundEnough()) { break; }
        }
      }
      break;
    }
    case "monthly": {
      let targetArray = [];
      if (typeof occPattern.day_of_month === 'string') { targetArray[0] = occPattern.day_of_month; }
      else if (typeof occPattern.day_of_month === 'number') { targetArray[0] = occPattern.day_of_month; }
      else { targetArray.push(...occPattern.day_of_month); }
      from_date.setDate(1);
      let monthToCheck;
      for (let candidate = from_date; ((candidate < to_date) && !foundEnough()); candidate.setMonth(monthToCheck + 1)) {
        let yearToCheck = candidate.getFullYear();
        monthToCheck = candidate.getMonth();
        for (let r = 0; ((r < targetArray.length) && !foundEnough()); r++) {
          if (typeof targetArray[r] === 'number') {
            await validateOccurrenceDate(`${yearToCheck}${(monthToCheck + 101).toString().slice(-2)}${(targetArray[r] + 100).toString().slice(-2)}`);
            if (foundEnough()) { break; }
          }
          else {
            let checkDate = new Date(candidate);
            for (let x = 0; x < 7; x++) {
              if (occPattern.day_of_week.includes(checkDate.getDay())) {
                switch (targetArray[r]) {
                  // the validateOccurrenceDate routine evaluates the passed-in date
                  // based on the occPattern that's already loaded here
                  // if that date is a "real" occurrence, it will push the date it onto response.occArray
                  //

                  case "first": {
                    await validateOccurrenceDate(makeDate(checkDate).numeric);
                    break;
                  }
                  case "second": {
                    await validateOccurrenceDate(makeDate(addDays(checkDate, 7)).numeric);
                    break;
                  }
                  case "third": {
                    await validateOccurrenceDate(makeDate(addDays(checkDate, 14)).numeric);
                    break;
                  }
                  case "fourth": {
                    await validateOccurrenceDate(makeDate(addDays(checkDate, 21)).numeric);
                    break;
                  }
                  case "last": {
                    let possDate = addDays(checkDate, 28);
                    if (possDate.getMonth() === monthToCheck) {
                      await validateOccurrenceDate(makeDate(possDate).numeric);
                    }
                    else {
                      await validateOccurrenceDate(makeDate(addDays(checkDate, 21)).numeric);
                    }
                    break;
                  }
                  default: { }
                }  // end switch on occPattern.day_of_month (as targetArray[r]) ("first Thursday", "second Thursday", etc)
              } // end "if this date matches a target day of the week (Thursday)"
              if (foundEnough()) { break; }
              checkDate = addDays(checkDate, 1);
            } // end trying every possible day of the week (Sunday - Saturday)
          } // end else block - occPattern.day_of_month (targetArray[r]) is not a number
        } // end loop through all occPattern.day_of_month entries
      } // end loop from first date to last date
      break;
    } // end monthly case
    case "yearly": {
      let targetArray = [];
      if (typeof occPattern.day_of_year === 'string') { targetArray[0] = Number(occPattern.day_of_year); }
      else if (typeof occPattern.day_of_year === 'number') { targetArray[0] = occPattern.day_of_year; }
      else {
        occPattern.day_of_year.forEach(d => {
          targetArray.push(Number(d));
        });
        targetArray.sort();
      }
      from_date.setMonth(1, 1);
      let yearToCheck;
      for (let candidate = from_date; candidate < to_date; candidate.setFullYear(yearToCheck + 1)) {
        yearToCheck = candidate.getFullYear();
        for (let t = 0; t < targetArray.length; t++) {
          await validateOccurrenceDate((yearToCheck * 10000) + targetArray[t]);
          if (foundEnough()) { break; }
        }
      }
      break;
    }
    default: {
      for (let s = 0; s < occPattern.specified.length; s++) {
        await validateOccurrenceDate(occPattern.specified[s]);
        if (foundEnough()) { break; }
      }
    }
  }
  return response;

  // ----- Functions -----

  function foundEnough() {
    return (request.number_of_occurrences && (response.occArray.length >= request.number_of_occurrences));
  }

  async function validateOccurrenceDate(inDate) {
    // called from inside getOccurenceList and therefore pertains to a sepcific event currently loaded
    //  (occPattern and eventRec should be loaded)
    // determines if a specific date is between that occurrence's first and last dates, and not excluded
    // will return false or...
    //    will add the occurrence
    //    and return the date in yyyymmdd numeric format
    let numericDate, stringDate;
    if (typeof inDate === 'string') { stringDate = inDate; numericDate = Number(inDate); }
    else { stringDate = inDate.toString(); numericDate = inDate; }
    if (('exceptions' in occPattern) && occPattern.exceptions.hasOwnProperty(stringDate)) {
      if (occPattern.exceptions[stringDate] > 0) {
        numericDate = occPattern.exceptions[stringDate];
        stringDate = numericDate.toString();
      }
      else { return false; } // found a date specifically excluded
    }
    if (occPattern['first_date'] && (numericDate < occPattern.first_date)) { return false; }
    if (numericDate < from_numeric) { return false; }
    if (occPattern['last_date'] && (numericDate > occPattern.last_date)) { return false; }
    if (numericDate > to_numeric) { return false; }
    // All good if we get this far
    // Add this date to the response.occArray
    response.occArray.push(numericDate);
    // Add this date to the response.occArray
    if (!eventRec.occExists) { eventRec.occExists = []; }
  //  else if (eventRec.occExists.includes(stringDate)) {
  //    return numericDate;
  //  }
    let oResp = await putEventOccurrence(request.client, event_id, stringDate, eventRec.occExists);
    if (Array.isArray(oResp)) { response.occRec[stringDate] = oResp[1]; }
    return numericDate;
  }
}

export async function putEventOccurrence(client, inEvent, inDate, occExists) {
  // this routine assumes you've got a good occurrence (inDate) for an event (inEvent)
  // return occurrence and event records for a specific event/date occurrence;  
  // create the occurrence if it doesn't exist
  let eventRec, occRec;
  let cDate = makeDate(inDate);
  let reqOcc = `${inEvent.split('#')[0]}#${cDate.numeric}`;
  if (occExists && !occExists.includes(inDate)) {
    occExists.push(inDate);
    await dbClient
      .update({
        Key: {
          client: client,
          event_key: inEvent.split('#')[0]
        },
        UpdateExpression: 'set occExists = :o,  last_written_occurrence = :i',
        ExpressionAttributeValues: { ':o': occExists, ':i': inDate },
        TableName: "Calendar"
      })
      .promise()
      .catch(error => { cl(`caught error updating Calendar; error is: `, error); });
  }
  let evRec = await dbClient
    .query({
      TableName: 'Calendar',
      KeyConditionExpression: 'client = :c and event_key = :rV',
      ExpressionAttributeValues: { ':c': client, ':rV': inEvent.split('#')[0] }
    })
    .promise()
    .catch(error => {
      if (error.code === 'NetworkingError') {
        cl(`Security Violation or no Internet Connection`);
      }
      cl(`Error reading Calendar (event) id ${error}`);
    });
  if (recordExists(evRec)) {
    eventRec = evRec.Items[0];
  }
  let ocRec = await dbClient
    .query({
      TableName: 'Calendar',
      KeyConditionExpression: 'client = :c and event_key = :rV',
      ExpressionAttributeValues: { ':c': client, ':rV': reqOcc }
    })
    .promise()
    .catch(error => {
      if (error.code === 'NetworkingError') {
        cl(`Security Violation or no Internet Connection`);
      }
      cl(`Error reading Calendar (occurrence) id ${error}`);
    });
  if (recordExists(ocRec)) {
    cl(`${eventRec.eventData.event_data.description} (${eventRec.event_key}) - ${cDate.absolute} exists already`);
    return [eventRec, ocRec.Items[0]];
  }
  if (eventRec) {
    occRec = await addOccurrence({
      client,
      event: eventRec,
      occurrence_date: cDate.numeric,
      occExists: occExists || []
    });
    cl(`${eventRec.eventData.event_data.description} (${eventRec.event_key}) - ${cDate.absolute} added`);
  }
  return [eventRec, occRec];
}

export function makeSlotName(pSlot) {
  let nSlot = Number(pSlot);
  if (isNaN(nSlot)) { return pSlot; }
  if ((nSlot < 100) || (nSlot > 2359) || ((nSlot % 100) > 59)) { return nSlot.toString(); }
  else { return makeTime(pSlot).short; }
}

export async function writeSlot(body) {
  /*  
    "client": <client>,
    "event": <event_id>,
    "occurrence_date (optional, if occurrence is in event as event#occurrence": <string or number>
    "owner": <person>,
    "override_name": <string or null>,
    "slot (alternate form = id)": <"0900 (time) or s#103 (seat) or r#12/s#103 (row and seat) or rsteele (user_id)">,
    "status": <"null (=selected), released, reserved, confirmed, attended, no-show, off_campus, left_campus, entered_campus... ">
    "show_this_slot": <boolean>  (assume true if missing or null)
  */
  let [event_id, occ_id] = makeString(body.event, 1).split('#');
  let occurrence = body.occurrence_date || occ_id;
  if (!body.slot && body.id) { body.slot = body.id; }
  let event_key = `${event_id}#${occurrence}#${body.slot}`;
  let [slotRec] = await getCalendarEntries({ client: body.client, event: event_key, type: 'slot' });
  let slotHistory = [];
  if (slotRec) {
    if (slotRec.slotData.status) { slotHistory = slotRec.slotData.status.history; }
    else {  // will convert a record from old style to new stlye
      slotHistory = [{
        date: 'unknown',
        status: 'selected',
        owner: slotRec.slotData.owner
      }];
    }
  }
  else { slotRec = {}; }

  let slotDataObj = Object.assign(
    {},
    slotRec.slotData || {},
    body.slotData || {},
  );

  if ('show_this_slot' in body) { slotDataObj.show_this_slot = !!body.show_this_slot; }
  else { slotDataObj.show_this_slot = true; }
  if (body.slot) { slotDataObj.slot = body.slot; }
  if (body.notes) { slotDataObj.notes = body.notes; }
  if (body.owner) {
    slotDataObj.owner = body.owner;
    if (body.override_name) { slotDataObj.display_name = body.override_name; }
    else { slotDataObj.display_name = await makeName(body.owner); }
  }
  slotDataObj.name = slotDataObj.display_name;

  let makeHistory = {
    date: makeDate(new Date()).absolute,
    status: body.status || 'selected',
    owner: body.owner
  };
  if (body.notes && slotRec.slotData && (slotRec.slotData.notes !== body.notes)) {
    makeHistory.note = body.notes;
  }
  slotHistory.unshift(makeHistory);
  slotDataObj.status = {
    current: body.status || 'selected',
    history: slotHistory
  };

  let putCalendar = {
    client: body.client,
    event_id,
    event_key,
    occurrence_date: `${occurrence}`,
    record_type: 'slot',
    slot_owner: body.owner,
    slotData: slotDataObj
  };

  // legacy support
  putCalendar.id = event_id;
  putCalendar.list_key = `${body.status === 'released' ? 'available' : body.owner}#${occurrence}`;
  putCalendar.schedule_key = 'slot_data';

  await dbClient
    .put({
      Item: putCalendar,
      TableName: "Calendar",
    })
    .promise()
    .catch(error => {
      cl(`caught error updating Calendar; error is:`, error);
    });

  // messaging
  let [eventRec] = await getCalendarEntries({ client: body.client, event: `${event_key}`, type: 'event' });
  if (eventRec.eventData && (!eventRec.eventData.messaging || (eventRec.eventData.messaging.length === 0))) {
    let subjectLine = '';
    let messageText = '';
    let notesLine = '';
    if (eventRec.eventData.event_data) {
      subjectLine = eventRec.eventData.event_data.description;
      if (slotDataObj.notes) { notesLine = `  \r\n\nNotes - ${slotDataObj.notes}`; }
    }
    else if (eventRec.calData) {
      subjectLine = eventRec.calData.description;
    }
    else { subjectLine = 'Your event'; }
    subjectLine += ` on ${makeDate(occurrence).absolute}`;
    messageText += `${subjectLine} - ${slotDataObj.name}`;
    subjectLine += ` - ${slotDataObj.name}`;
    if (body.status === 'released') {
      messageText += ` removed`;
      subjectLine += ` removed`;
    }
    else {
      messageText += ` added`;
      if (slotDataObj.slot) {
        let maybeTime = makeSlotName(slotDataObj.slot);
        if (maybeTime.includes(':')) {
          messageText += ` in the ${makeTime(slotDataObj.slot).time} slot.`;
        }
        else {
          messageText += `.`;
        }
        messageText += notesLine;
      }
      subjectLine += ` added`;
    }
    messageText += `  \r\n\nThe current sign-up sheet is available in AVA.`;
    let ownerList;
    if (eventRec.eventData.event_data) { ownerList = makeArray(eventRec.eventData.event_data.owner); }
    else if (eventRec.calData) { ownerList = eventRec.calData.owner; }
    eventRec.eventData.messaging = {
      action: (body.status === 'released' ? "released" : "selected"),
      format: {
        subject: subjectLine,
        text: messageText
      },
      recipientList: ownerList
    };
  }
  if (eventRec.eventData && eventRec.eventData.messaging) {
    let messageList = [];
    let msgObject = {
      client: eventRec.client,
      author: 'AVA'
    };
    body.client = eventRec.client;
    body.person = eventRec.owner;
    body.onBehalfOf = slotDataObj.name;
    body = Object.assign(body, eventRec.eventData.event_data, slotDataObj);
    if (Array.isArray(eventRec.eventData.messaging)) { messageList.push(...eventRec.eventData.messaging); }
    else { messageList.push(eventRec.eventData.messaging); }
    for (let m = 0; m < messageList.length; m++) {
      let this_message = messageList[m];
      if (!this_message.action || (this_message.action === body.status.current)) {
        if ('subject' in this_message.format) { msgObject.subject = await resolveMessageVariables(this_message.format.subject, body); }
        if (Array.isArray(this_message.recipientList)) { msgObject.recipientList = [...this_message.recipientList]; }
        else { msgObject.recipientList = [this_message.recipientList]; }
        msgObject.messageText = await resolveMessageVariables(this_message.format.text, body);
        sendMessages(msgObject);
      }
    }
  }
  /*
  return {
    'request_id': serviceRequestRec.request_id,
    'message': (goodWrite ? `${body.requestType} request ${serviceRequestRec.request_id} added (${body.author} for ${serviceRequestRec.on_behalf_of})` : 'Request not added')
  };
  */

  return putCalendar;
}

export async function updateSlotStatus(request) {
  /* request is
    {
      client, 
      body: [
        { 
          person: [p1:<opt pName>, p2...], 
          event, 
          occurrence 
            -OR- 
          date: { 
            from: string -> makeDate.date
            to: string -> makeDate.date
          },
          slot (if missing, use person_id), 
          status 
          show_this_slot
        }, 
        {}...
      ];
    }
  */
  let responseMessage = [];
  let reqArray = makeArray(request.body);
  for (let r = 0; r < reqArray.length; r++) {
    let this_request = reqArray[r];
    // figure out occurrences
    let occArray = [];
    if ('occurrence' in this_request) {
      occArray = makeArray(this_request.occurrence);
    }
    else {
      if (!('date' in this_request)) {
        responseMessage.push(`No occurrence data`);
        continue;
      }
      else if (typeof (this_request.date) === 'string') { occArray.push(makeDate(this_request.date).numeric); }
      else if (Array.isArray(this_request.date)) {
        this_request.date.forEach(d => { occArray.push(makeDate(d).numeric); });
      }
      else {
        let from_date, to_date;
        if ('from' in this_request.date) { from_date = makeDate(this_request.date.from).date; }
        else { from_date = new Date(); }
        if ('to' in this_request.date) { to_date = makeDate(this_request.date.to).date; }
        else { to_date = addDays(from_date, 7); }
        let rBody = {
          client: request.client,
          event: this_request.event,
          from_date,
          to_date
        };
        let oResponse = await getOccurenceList(rBody);
        occArray = oResponse.occArray;
      }
    }
    let peopleArray = makeArray(this_request.person);
    for (let o = 0; o < occArray.length; o++) {
      await putEventOccurrence(request.client, this_request.event, occArray[o]);
      for (let p = 0; p < peopleArray.length; p++) {
        let [pID, pName] = peopleArray[p].split(':');
        await writeSlot({
          client: request.client,
          event: this_request.event,
          occurrence_date: occArray[o],
          owner: pID,
          override_name: pName,
          slot: this_request.slot,
          status: this_request.status,
          show_this_slot: this_request.show_this_slot || true
        });
      }
    }
  }
  return responseMessage;
}


export async function createNewOccurrences(request) {
  // expect request to contain
  //  client => 
  //  from_date (optional) => if present, start making occurrences from this date; if missing assume today
  //  to_date (optional) => if present, must be > from_date; if missing, assume today + 366 days

  // **** set up parameters **** //
  let fDate, tDate;
  if (request.from_date
    || (('date' in request) &&
      ((request.date.hasOwnProperty('from')) || (request.date.hasOwnProperty('from_date'))))) {
    fDate = makeDate(request.from_date || request.date.from || request.date.from_date);
  }
  else { fDate = makeDate('today'); }
  if (request.to_date
    || (('date' in request) &&
      ((request.date.hasOwnProperty('to')) || (request.date.hasOwnProperty('to_date'))))) {
    tDate = makeDate(request.to_date || request.date.to || request.date.to_date);
  }
  else { tDate = makeDate(addDays(new Date(fDate.date), 366)); }

  // **** read the events **** //
  let qQ = {
    TableName: 'Calendar',
    FilterExpression: 'event_key = event_id'
  };
  let evRec;
  do {
    evRec = await dbClient
      .scan(qQ)
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          cl(`Security Violation or no Internet Connection`);
        }
        cl(`Error reading Calendar (event) id ${error}`);
      });
    if (recordExists(evRec)) {
      for (let i = 0; i < evRec.Items.length; i++) {
        let eventRec = evRec.Items[i];
        cl(`Event: ${eventRec.eventData.event_data.description} (${eventRec.event_key})`);
        // Does this event fit inside the request dates?
        if (!eventRec.eventData) { continue; }
        if (!eventRec.eventData.occPattern) { continue; }
        if ((eventRec.eventData.occPattern.first_date && (eventRec.eventData.occPattern.first_date > tDate.numeric))
          || (eventRec.eventData.occPattern.last_date && (eventRec.eventData.occPattern.last_date < fDate.numeric))) {
          cl(`-- Dates out of range: first=${eventRec.eventData.occPattern.first_date} / last=${eventRec.eventData.occPattern.last_date}`);
          continue;
        }
        // make occurrences
        await getOccurenceList({
          client: request.client,
          event: eventRec.event_key,
          from_date: fDate.date,
          to_date: tDate.date
        });
      }
    }
    qQ.ExclusiveStartKey = evRec.LastEvaluatedKey;
  } while (evRec.LastEvaluatedKey);
}

// ****************  THIRD GENERATION CODE *****************

export async function printOccurrenceSheet(body) {

  /* 
  body expected as
  {
      client (or client_id)
      event (or event_id)
      occurrence (or occurrence_id - if null, then get occurrence from event_id)
      margin: {top: nn, bottom: mm, left: yy, right: zz}
      client_name (optional; will print on header if present)
      request_type ('full' - show all details, otherwise just slot infor and name)
      pageWidth
      size: ('legal', 'letter', or [width_in_px, length_in_px])
      border
      font
      orientation (anything other than 'landscape' is treated as 'portrait')
      title
  }
  */
  let xPos = 0;
  let previousXPos = 0;

  // Get the event master record
  let oData = await occurrenceData(body);

  // Prep the PDF output
  let default_font = 'Helvetica';
  if (!body.margin) { body.margin = {}; }
  let page = {
    border: body.border || true,
    font: {
      family: body.font || body.font_family || default_font,
      size: { large: 14, medium: 12, small: 10, tiny: 8 }
    },
    size: (body.size || 'letter'),
    layout: (body.orientation === 'landscape' ? 'landscape' : 'portrait'),
    info: { author: 'AVA Senior Living', title: (body.title || oData.description || 'Event Report') },
    number: 1,
    margin: {
      top: body.margin.top || 42,
      bottom: body.margin.bottom || 14,
    }
  };

  if (Array.isArray(page.size)) {
    page.width = page.size[0];
    page.height = page.size[1];
  }
  else if (page.size === 'legal') {
    page.width = 275;
    page.height = 750;
  }
  else {
    page.width = 275;
    page.height = 590;
  }
  if (page.orientation === 'landscape') {
    let temp = page.height;
    page.width = page.height;
    page.height = temp;
  }
  page.margin.left = body.margin.left || (page.width / 10);
  page.margin.right = body.margin.right || (page.width / 10);

  let yPos = page.margin.top;
  const doc = new jsPDF({
    orientation: page.layout,
    unit: "px",
    format: page.size
  });
  page.centerPoint = doc.internal.pageSize.width / 2;
  page.printableArea = doc.internal.pageSize.width - page.margin.left - page.margin.right;


  // ********** TITLE ********** //
  let titleWords = await resolveMessageVariables(page.info.title, body);
  page.info.title = titleCase(titleWords);
  doc.info = { author: 'AVA', title: titleCase(titleWords) };
  pdfLine(page.info.title, page.font.size.large, 'normal', 0, 0, 0, { align: 'center' });
  if (body.client_name) {
    let outClientName = titleCase(body.client_name);
    pdfLine(outClientName, page.font.size.large, 'normal', 0, 0, 0, { align: 'center' });
  }
  pdfLine(oData.date.absolute, page.font.size.small, 'normal', 0, 0, 0, { align: 'center' });
  if (oData.time) {
    pdfLine(oData.time, page.font.size.small, 'normal', 0, 0, 0, { align: 'center' });
  }
  if (oData.location && oData.location.description) {
    pdfLine(oData.location.description, page.font.size.small, 'normal', 0, 0, 0, { align: 'center' });
  }

  /* Grid
  let options = {};
  for (let p = page.margin.left; p <= page.width; p += 10) {
    pdfLine(p, page.font.size.tiny, 'normal', 0, 0, -1, options);
    options = { noNewLine: true };
  }
  */

  // Body

  let totalLines = 0;
  let detail_indent = (page.width / 10) + page.margin.left;
  let nameRow_indent = detail_indent - 10;

  let slotList = Object.keys(oData.slots).sort();

  for (let s = 0; s < slotList.length; s++) {
    let sID = slotList[s];

    if (oData.slots[sID].owner && (oData.slots[sID].owner !== 'available') && (oData.slots[sID].owner !== '')) {
      pdfLine('image', page.font.size.large, 'normal', 0, 1.5, 0, { image: `https://theseus-medical-storage.s3.amazonaws.com/public/patients/${oData.slots[sID].owner}.jpg` });
      let outName;
      let oParts = oData.slots[sID].display_name.split(',');
      if (oParts.length === 1) { outName = oParts[0].trim(); }
      else { outName = `${oParts[1].trim()} ${oParts[0].trim()}`; }
      pdfLine(outName, page.font.size.large, 'bold', 0, 0.5, 0, { noNewLine: true });
      let nameY = yPos;
      if (oData.type === 'time') {
        pdfLine(`Time: ${formatTime(sID)}`, page.font.size.medium, 'normal', 0, 0, 0, { align: 'vertical', noBreak: true });
      }
      else if (oData.type === 'seats') {
        pdfLine(`Seat: ${sID}`, page.font.size.medium, 'normal', 0, 0, 0, { align: 'vertical', noBreak: true });
      }
      if (oData.slots[sID].owner && body.request_type === 'full') {
        let pRec = await getPerson(oData.slots[sID].owner);
        if (pRec) {
          if (pRec.person_id !== 'void') {
            if (pRec.location) {
              pdfLine(pRec.location, page.font.size.medium, 'normal', 0, 0, 0, { align: 'vertical', noBreak: true });
            }
            totalLines++;
            // eslint-disable-next-line
            Object.values(pRec.messaging).forEach(mVal => {
              if (mVal && (typeof (mVal) === 'string') && (mVal !== '')) {
                let outVal = mVal;
                if (!isNaN(Number(mVal))) { outVal = formatPhone(mVal); }
                pdfLine(outVal, page.font.size.medium, 'normal', 0, 0, 0, { align: 'vertical', noBreak: true });
                totalLines++;
              }
            });
          }
        }
      };
      if (oData.slots[sID].marked) {
        pdfLine('image', page.font.size.small, 'normal', 0, 0, 0, { yPos: nameY, noNewLine: true, align: 'right', image: `https://ava-icons.s3.amazonaws.com/icons8-check-192.png` });
      }
    }
    else { doc.line(nameRow_indent, yPos, nameRow_indent + 400, yPos, 'F'); }
    totalLines += 2;
  }

  if (totalLines === 0) {
    pdfLine(`No data found for ${page.info.title}`, page.font.size.medium, 'normal', detail_indent, 3);
  }

  // Wrap up
  let event_info = `${body.client || body.client_id}//${body.event || body.event_id}`;
  if (body.occurrence || body.occurrence_id) {
    event_info += `//${body.occurrence || body.occurrence_id}`;
  }
  pdfLine('AVA Senior Living', page.font.size.tiny, 'normal', 0, 0, 0, { align: 'footer' });
  pdfLine(`Event info ${event_info}`, page.font.size.tiny, 'normal', 0, 0, 0, { align: 'center', noBreak: true });
  pdfLine('****** END ******', page.font.size.tiny, 'normal', 0, 0, 0, { align: 'center', noBreak: true });
  var now = new Date();
  var postTime = now.getTime();
  let fileName = `${body.client || body.client_id}_${postTime}_EventReport.pdf`;
  /*
  let pBlob = doc.output('blob');
  let data64 = (doc.output('datauri')).split(';base64,')[1];
  let s3Resp = await s3
    .upload({
      Bucket: 'theseus-medical-storage',
      Key: fileName,
      Body: pBlob,
      ACL: 'public-read-write',
      ContentType: 'application/pdf'
    })
    .promise()
    .catch(err => {
      cl(`PDF not saved by AVA.  The reason is ${err.message}`);
    });
  */
  await doc.save(fileName, { returnPromise: true });
  // s3Resp.data = data64;

  return fileName;

  function formatTime(pHHMM) {
    let mm = pHHMM % 100;
    let hh_raw = Math.floor(pHHMM / 100);
    let hh = hh_raw;
    if (hh_raw > 12) { hh = hh_raw - 12; }
    else if (hh_raw === 0) { hh = 12; };
    return (`${hh}:${mm < 10 ? '0' + mm : mm}`);
  };

  function pdfLine(textIn, size, style, indent = 0, before, after, options = {}) {
    // doc.setFontSize(page.font.size.tiny);
    // doc.text(String(yPos), 10, yPos, options);
    let textArray = makeArray(textIn);
    for (let a = 0; a < textArray.length; a++) {
      let text = String(textArray[a]);
      if (typeof (textIn) === 'string') { text = textIn.toString(); }
      else if (typeof (textIn) === 'number') { text = textIn.toString(); }
      let lastSize = page.font.size.medium;
      if (size) {
        doc.setFontSize(size);
        lastSize = size;
      }
      let rememberedYPos;
      if (options.yPos) {
        rememberedYPos = yPos;
        yPos = options.yPos;
      }
      if (before) { yPos += before * lastSize; }
      let needPageBreak = false;
      if (options.noBreak) {
        if (yPos > (page.height - 10)) { needPageBreak = true; }
      }
      else {
        if (yPos > (page.height - page.margin.bottom - 54)) { needPageBreak = true; }
      }
      if (needPageBreak) {
        // Title lines   
        doc.addPage({
          orientation: page.layout,
          format: page.size
        });
        doc.setFont(page.font.family, 'normal');
        doc.setFontSize(page.font.size.large);
        let xOffset = page.centerPoint - (doc.getTextWidth(page.info.title) / 2);
        let yOffset = page.margin.top;
        doc.text(page.info.title, xOffset, yOffset);
        if (body.client_name) {
          let outClientName = titleCase(body.client_name);
          xOffset = page.centerPoint - (doc.getTextWidth(outClientName) / 2);
          yOffset += page.font.size.large;
          doc.text(outClientName, xOffset, yOffset);
        }
        doc.setFontSize(page.font.size.small);
        xOffset = page.centerPoint - (doc.getTextWidth(oData.date.absolute) / 2);
        yOffset += page.font.size.small;
        doc.text(oData.date.absolute, xOffset, yOffset);
        if (oData.time) {
          xOffset = page.centerPoint - (doc.getTextWidth(oData.time) / 2);
          yOffset += page.font.size.small;
          doc.text(oData.time, xOffset, yOffset);
        }
        if (oData.location && oData.location.description) {
          xOffset = page.centerPoint - (doc.getTextWidth(oData.location.description) / 2);
          yOffset += page.font.size.small;
          doc.text(oData.location.description, xOffset, yOffset);
        }
        page.number++;
        let pageNumberLine = `page ${page.number}`;
        xOffset = page.centerPoint - (doc.getTextWidth(pageNumberLine) / 2);
        yOffset += page.font.size.small;
        doc.text(pageNumberLine, xOffset, yOffset);
        doc.setFontSize(lastSize);
        yPos = page.margin.top + page.font.size.large + page.font.size.small + (lastSize * 3);
      }
      if (style) { doc.setFont(page.font.family, style); }
      if (!options.noNewLine) {
        yPos += lastSize;
        if (options.align !== 'vertical') { xPos = page.margin.left; }
        else { xPos = previousXPos; }
      }
      let nextLine;
      if (doc.getTextWidth(text) > page.printableArea) {
        let tWords = text.split(/\s+/);
        nextLine = tWords.pop();
        text = tWords.join(' ');
        if (doc.getTextWidth(text) > page.printableArea) {
          let t2Words = text.split(/\s+/);
          nextLine += ' ' + t2Words.pop();
          text = t2Words.join(' ');
        }
        textArray.splice(a, 0, nextLine);
      }
      if (options.image) {
        let imageSize = size * 3;
        let xOffset;
        switch (options.align) {
          case 'center': {
            xOffset = page.centerPoint - (imageSize / 2);
            break;
          }
          case 'right': {
            xOffset = page.width - page.margin.right - imageSize;
            break;
          }
          default: {
            xOffset = xPos + indent;
          }
        }
        doc.addImage(options.image, 'JPEG', xOffset, yPos, imageSize, imageSize);
        previousXPos = xOffset;
        xPos = xOffset + imageSize + lastSize;
      }
      else {
        if (options.align === 'center') {
          let xOffset = page.centerPoint - (doc.getTextWidth(text) / 2);
          doc.text(text, xOffset, yPos);
          previousXPos = xOffset;
          xPos = page.centerPoint + (doc.getTextWidth(text) / 2) + lastSize;
        }
        else if (options.align === 'right') {
          doc.text(text, page.width - page.margin.right, yPos, { align: 'right' });
          previousXPos = page.width - page.margin.right - doc.getTextWidth(text);
          xPos = page.margin.right;
        }
        else if (options.noNewLine) {
          doc.text(text, xPos + indent, yPos);
          previousXPos = xPos + indent;
          xPos += doc.getTextWidth(text) + lastSize;
        }
        else if (options.align === 'footer') {
          let xOffset = page.centerPoint - (doc.getTextWidth(text) / 2);
          let yOffset = page.height - page.margin.bottom - 54;
          doc.text(text, xOffset, yOffset);
          previousXPos = xOffset;
          yPos = yOffset;
          xPos = page.centerPoint + (doc.getTextWidth(text) / 2) + lastSize;
        }
        else {
          doc.text(text, xPos + indent, yPos);
          previousXPos = xPos + indent;
          xPos = (xPos + indent) + doc.getTextWidth(text) + lastSize;
        }
      }
      if (rememberedYPos) { yPos = rememberedYPos; }
      if (after) { yPos += (after * lastSize); }
    }
    return;
  }

}

export async function eventData(body) {
  /*  
  pass in an event_code, get event information back
  body = {
      client (or client_id)
      event (or event_id)
      info - 'basic'=just event data itself; 'full'=event and occurrence list; 
  }
  returnObj = {
      description,
      location,
      type,
      time,
      occurrences: {
        past: [<event_id>, <event_id>, ...],
        current: [<event_id>, <event_id>, ...]
      }
  }
  */
  let event_id = (body.event_id || body.event || body.filter?.event_id || body.filter?.event).split('#').shift();

  let qQ = { TableName: 'Calendar' };

  qQ.KeyConditionExpression = 'client = :c';
  qQ.ExpressionAttributeValues = { ':c': body.client || body.client_id };

  if (body.info === 'full') {
    qQ.KeyConditionExpression += ' and begins_with(event_key, :rEvent)';
    qQ.ExpressionAttributeValues[':rEvent'] = event_id;
    qQ.FilterExpression = 'record_type = :e OR record_type = :o';
    qQ.ExpressionAttributeValues[':e'] = 'event';
    qQ.ExpressionAttributeValues[':o'] = 'occurrence';
  }
  else {
    qQ.KeyConditionExpression += ' and event_key = :rEvent';
    qQ.ExpressionAttributeValues[':rEvent'] = event_id;
  }

  let calendarRecs = await dbClient
    .query(qQ)
    .promise()
    .catch(error => {
      if (error.code === 'NetworkingError') {
        cl(`Security Violation or no Internet Connection`);
      }
      cl(`Error reading ${qQ.TableName} in eventData - error is: ${error}`);
      cl(qQ);
    });
  let returnObj = {
    description: '',
    location: '',
    type: '',
    time: '',
    occurrences: {
      past: [],
      current: [],
      future: []
    }
  };
  let eventRec, start_date, end_date;
  if (recordExists(calendarRecs)) {
    let today = makeDate(new Date());
    for (let c = 0; c < calendarRecs.Items.length; c++) {
      let this_rec = calendarRecs.Items[c];
      switch (this_rec.record_type) {
        case 'event': {
          returnObj.description = this_rec.eventData.event_data.description;
          returnObj.location = this_rec.eventData.event_data.location.description;
          returnObj.type = this_rec.eventData.event_data.type;
          returnObj.time = this_rec.eventData.event_data.time.from;
          if (this_rec.eventData.event_data.time.to) {
            returnObj.time += ` to ${this_rec.eventData.event_data.time.to}`;
          };
          eventRec = this_rec;
          start_date = makeDate(this_rec.eventData.last_written_occurrence || this_rec.start_date || today.date).date;
          if (start_date < today.date) { start_date = today.date; }
          end_date = makeDate(this_rec.end_date || addDays(start_date, 90)).date;
          returnObj.occurrences.future = occurrenceDateBuilder(eventRec, start_date, end_date);
          break;
        }
        case 'occurrence': {
          let key = ((this_rec.occurrence_date < today.numeric$) ? 'past' : 'current');
          returnObj.occurrences[key].push(this_rec.event_key);
          break;
        }
        default: { }
      }
    }
  }
  return returnObj;
};

export async function occurrenceData(body) {
  /*  
    request {
      client (or client_id)
      event (or event_id)
      occurrence (or occurrence_id - if null, then get occurrence from event_id)
    }
    returnObj {
      description,
      location,
      type,
      owner,
      time,
      date (as returned from makeDate)
      slots: {
        slotName: {
          owner (or false),
          notes,
          display_name
          marked
        }
      }
    }
  */
  let returnObj = {
    description: '',
    location: '',
    time: '',
    slots: {}
  };

  let rC = body.client_id || body.client;
  let rV = makeString((body.event_id || body.event || body.filter?.event_id || body.filter?.event), 1);
  let rO = body.occurrence_id || body.occurrence || body.filter?.occurrence_id || body.filter?.occurrence;
  if (rO && rV) { rV = rV.split('#')[0] + '#' + rO; }   // both sent in change rV to include passed rO
  else if (rO) { return {}; }    // rO sent without an rV - that's bad; ignore rO
  else if (rV) { rO = rV.split('#')[1]; }     // rV sent without an rO; try to set rO from the rV value
  else { return {}; }   // netiher sent;  return void
  // if no rO was set, use the event only (all slots will be empty)
  let [eventInfo] = await getCalendarEntries({ client: rC, event: rV, occurrence: rO, type: 'event' });
  let occInfoArray = await getCalendarEntries({ client: rC, event: rV, occurrence: rO, type: 'structure' });
  occInfoArray.unshift(eventInfo);
  occInfoArray.forEach((rec, x) => {
    if (!returnObj.date && (rec.occurrence_date || (makeNumber(rec.schedule_key) > 0))) {
      returnObj.date = makeDate(rec.occurrence_date || makeNumber(rec.schedule_key));
    }
    if (rec.eventData) {
      cl({ 'handling eventData': rec.eventData.event_data });
      if (!returnObj.description) { returnObj.description = rec.eventData.event_data.description; }
      if (!returnObj.location) { returnObj.location = rec.eventData.event_data.location; }
      if (!returnObj.type && rec.eventData.sign_up) {
        if (rec.eventData.sign_up.type === 'time') { returnObj.type = 'time'; }
        else { returnObj.type = 'seats'; }
      }
      if (!returnObj.time) {
        if (rec.eventData.event_data.time) {
          returnObj.time = rec.eventData.event_data.time.from;
          if (rec.eventData.event_data.time.to) {
            returnObj.time += ' to ' + rec.eventData.event_data.time.to;
          }
        }
      }
      if (returnObj.slots.length === 0) {
        rec.slotPattern.forEach(sID => {
          if (!(sID in returnObj.slots)) {
            returnObj.slots[sID] = { owner: null, notes: null, display_name: null, marked: false };
          }
        });
      };
    }
    else if (rec.record_type === 'occurrence') {
      Object.assign(returnObj, rec);
      if (rec.time) {
        returnObj.time = rec.time.from;
        if (rec.time.to) {
          returnObj.time += ' to ' + rec.time.to;
        }
      }
      if (rec.occurrence_date) {
        returnObj.date = makeDate(rec.occurrence_date);
      }
    }
    else if (rec.occData) {
      if ('event_data' in rec.occData) {
        if ('description' in rec.occData.event_data) {
          returnObj.description = rec.occData.event_data.description;
        }
        if ('location' in rec.occData.event_data) {
          returnObj.location = rec.occData.event_data.location;
        }
        if ('time' in rec.occData.event_data) {
          returnObj.time = rec.occData.event_data.time.from;
          if (rec.occData.event_data.time.to) {
            returnObj.time += ' to ' + rec.occData.event_data.time.to;
          }
        }
        if (rec.occData.sign_up) {
          if (rec.occData.sign_up.type === 'time') { returnObj.type = 'time'; }
          else { returnObj.type = 'seats'; }
        }
        if ('slotPattern' in rec.occData.event_data) {
          for (const sID in returnObj.slots) {
            if (!returnObj.slots[sID].owner) { delete returnObj.slots[sID]; }  // unoccupied slots are removed
          }
          rec.slotPattern.forEach(sID => {     // fill the array with slots from the pattern
            returnObj.slots[sID] = { owner: null, notes: null, display_name: null, marked: false };
          });
        }
      }
      else {
        if ('description' in rec.occData) {
          returnObj.description = rec.occData.description;
        };
        if ('time_from' in rec.occData) {
          returnObj.time = rec.occData.time_from;
        };

      }
    }
    else if (rec.slotData) {
      let sID = rec.slotData.slot || rec.slotData.id;
      if (rec.slotData.status && rec.slotData.status.current === 'released') {
        returnObj.slots[sID] = {
          owner: '',
          notes: '',
          display_name: '',
          marked: false
        };
      }
      else {
        let slotName = '';
        if (rec.slotData.display_name) { slotName = rec.slotData.display_name; }
        else if (rec.slotData.name) {
          if (typeof rec.slotData.name === 'string') { slotName = rec.slotData.name; }
          else { slotName = `${rec.slotData.name.first} ${rec.slotData.name.last}`.trim(); }
        }
        returnObj.slots[sID] = {
          owner: rec.slotData.owner,
          notes: rec.slotData.notes,
          display_name: slotName,
          marked: !!rec.marked
        };
      }
    }
    else if (rec.calData) { }
  });
  return returnObj;
};

export async function getAllOccurrences(body, screenStatus = () => { }) {
  // body should contain
  // client or client_id
  // start_date - use today if missing
  // end_date - use 14 days from start date if missing
  /*  
  pass in a client, with option start and end dates; get a list of events between those dates
  body = {
      client (or client_id)
      start_date - today if missing
      end_date - start + 14 days if missing
  }
  returnList = [{
    date (as yyyymmdd string)
    client
    event_key (event_id#occurrence_date)  
    description,
    location,
    time
  }]
  */

  let qQ = { TableName: 'Calendar' };
  qQ.IndexName = 'record_type-index';

  qQ.KeyConditionExpression = 'client = :c';
  qQ.ExpressionAttributeValues = { ':c': body.client || body.client_id };

  qQ.KeyConditionExpression += ' and record_type = :t';
  qQ.ExpressionAttributeValues[':t'] = 'occurrence';

  qQ.FilterExpression = 'occurrence_date BETWEEN :s and :e';
  qQ.ExpressionAttributeValues[':s'] = makeDate((body.start_date || new Date())).numeric$;
  qQ.ExpressionAttributeValues[':e'] = makeDate((body.end_date || addDays(qQ.ExpressionAttributeValues[':s'], 14))).numeric$;

  let returnList = [];
  let calendarRecs = await dbClient
    .query(qQ)
    .promise()
    .catch(error => {
      if (error.code === 'NetworkingError') {
        cl(`Security Violation or no Internet Connection`);
      }
      cl(`Error reading ${qQ.TableName} in getAllOccurrences - error is: ${error}`);
      cl(qQ);
    });
  if (!recordExists(calendarRecs)) { return returnList; }

  let ccL = calendarRecs.Items.length;
  calendarRecs.Items.sort((a, b) => {
    return (a.occurrence_date < b.occurrence_date ? -1 : 1);
  });
  let screenDate = 0;
  for (let c = 0; c < ccL; c++) {
    let occurrenceRec = calendarRecs.Items[c];
    if (occurrenceRec.occurrence_date !== screenDate) {  // send a message back... now processing date xxxx
      screenDate = occurrenceRec.occurrence_date;
      screenStatus(makeDate(occurrenceRec.occurrence_date).relative, ((c / ccL) * 100), ((ccL / 40) + .75));
    }
    let eventRec = {};
    if (occurrenceRec.description
      && occurrenceRec.location
      && occurrenceRec.time) { }
    else {
      eventRec = await eventData({
        client_id: qQ.ExpressionAttributeValues[':c'],
        event_id: occurrenceRec.event_id,
        info: 'basic'
      });
    }
    let oTime;
    if (occurrenceRec.time) {
      oTime = occurrenceRec.time.from;
      if (occurrenceRec.time.to) { oTime = occurrenceRec.time.to; }
    }
    else { oTime = eventRec.time; }
    let occurrenceObj = {
      date: occurrenceRec.occurrence_date,
      client: qQ.ExpressionAttributeValues[':c'],
      event_key: occurrenceRec.event_key,
      description: occurrenceRec.description || eventRec.description,
      location: occurrenceRec.location || eventRec.location,
      time: oTime,
      time24: makeTime(oTime).numeric24
    };
    returnList.push(occurrenceObj);
  }
  returnList.sort((a, b) => {
    if (a.date < b.date) { return -1; }
    else if (a.date > b.date) { return 1; }
    else if (a.time24 < b.time24) { return -1; }
    else { return 1; }
  });
  return returnList;
}

export function occurrenceDateBuilder(eventRec, start_date, end_date) {
  let responseArray = [];
  if (!eventRec || !eventRec.eventData || !eventRec.eventData.occPattern) { return []; }
  let occPattern = eventRec.eventData.occPattern;
  switch (occPattern.recurrence) {
    case "daily": {
      let from_date = makeDate(start_date).date;
      let to_date = makeDate(end_date).date;
      for (let candidate = from_date; ((candidate < to_date) && (responseArray.length < 10)); candidate = addDays(candidate, 1)) {
        if (occPattern.day_of_week.includes(candidate.getDay())) {
          let nominee = makeDate(candidate);
          if (occPattern['first_date'] && (nominee.numeric < occPattern.first_date)) { continue; }
          if (candidate < from_date) { continue; }
          if (occPattern['last_date'] && (nominee.numeric > occPattern.last_date)) { continue; }
          if (candidate > to_date) { continue; }
          // All good if we get this far
          responseArray.push(nominee.numeric$);
        }
      }
      break;
    }
    case "monthly": {
      let targetArray = makeArray(occPattern.day_of_month);
      let from_date = makeDate(start_date).date;
      from_date.setDate(1);
      let to_date = makeDate(end_date).date;
      let monthToCheck;
      for (let candidate = from_date; ((candidate < to_date) && (responseArray.length < 10)); candidate.setMonth(monthToCheck + 1)) {
        let yearToCheck = candidate.getFullYear();
        monthToCheck = candidate.getMonth();
        for (let r = 0; ((r < targetArray.length) && (responseArray.length < 10)); r++) {
          if (typeof targetArray[r] === 'number') {  // day of the month
            responseArray.push(`${yearToCheck}${(monthToCheck + 101).toString().slice(-2)}${(targetArray[r] + 100).toString().slice(-2)}`);
          }
          else {
            let nominee = makeDate(candidate);
            for (let x = 0; x < 7; x++) {
              if (occPattern.day_of_week.includes(nominee.date.getDay())) {
                switch (targetArray[r]) {
                  case "first": {
                    responseArray.push(nominee.numeric$);
                    break;
                  }
                  case "second": {
                    responseArray.push(makeDate(addDays(nominee.date, 7)).numeric$);
                    break;
                  }
                  case "third": {
                    responseArray.push(makeDate(addDays(nominee.date, 14)).numeric$);
                    break;
                  }
                  case "last": {
                    let possDate = addDays(nominee.date, 28);
                    if (possDate.getMonth() === monthToCheck) {
                      responseArray.push(makeDate(possDate).numeric$);
                      break;
                    }
                  }
                  // eslint-disable-next-line
                  case "fourth": {
                    responseArray.push(makeDate(addDays(nominee.date, 21)).numeric$);
                    break;
                  }
                  default: { }
                }  // end switch on occPattern.day_of_month (as targetArray[r]) ("first Thursday", "second Thursday", etc)
              } // end "if this date matches a target day of the week (Thursday)"
              if (responseArray.length >= 10) { break; }
              addDays(nominee.date, 1);
            } // end trying every possible day of the week (Sunday - Saturday)
          } // end else block - occPattern.day_of_month (targetArray[r]) is not a number
        } // end loop through all occPattern.day_of_month entries
      } // end loop from first date to last date
      break;
    } // end monthly case
    case "yearly": {
      //*****************  RAY GO HERE  ***************
      let targetArray = [];
      if (typeof occPattern.day_of_year === 'string') { targetArray[0] = Number(occPattern.day_of_year); }
      else if (typeof occPattern.day_of_year === 'number') { targetArray[0] = occPattern.day_of_year; }
      else {
        occPattern.day_of_year.forEach(d => {
          targetArray.push(Number(d));
        });
        targetArray.sort();
      }
      let from_date = makeDate(start_date).date.setMonth(1);
      let to_date = makeDate(end_date).date;
      let yearToCheck;
      for (let candidate = from_date; ((candidate < to_date) && (responseArray.length < 10)); candidate.setFullYear(yearToCheck + 1)) {
        yearToCheck = candidate.getFullYear();
        for (let t = 0; t < targetArray.length; t++) {
          responseArray.push(`${(yearToCheck * 10000) + targetArray[t]}`);
        }
      }
      break;
    }
    default: {
      for (let s = 0; ((s < occPattern.specified.length) && (responseArray.length < 10)); s++) {
        responseArray.push(`${occPattern.specified[s]}`);
      }
    }
  }
  return responseArray;
}

export async function addOccurrence(body) {
  // body MUST contain 
  //  client or client_id 
  //  event - either an event record(object) OR an event_key(string)
  //
  // addOccurrence assumes a valid occurrence date
  // 

  let client = (body.client || body.client_id);

  if (!body.event || !client) { return false; }
  let eventIn;
  if (typeof body.event === 'object') { eventIn = body.event.event_key; }
  else { eventIn = (body.event_id || body.event); }
  let [event_id, dateFromEvent] = eventIn.split('#');
  let eventRecs = await dbClient
    .get({
      Key: { client: client, event_key: event_id },
      TableName: "Calendar"
    })
    .promise()
    .catch(error => {
      cl({ 'Error reading Calendar': error });
    });
  if (!recordExists(eventRecs)) { return false; }
  let eventRec = eventRecs.Item;

  let oDate = makeDate(body.occurrence_date || dateFromEvent);
  let occurrence_date = oDate.numeric$;
  if (!occurrence_date) { return false; }
  let putCalendar = {
    client,
    event_id,
    description: eventRec.description,
    location: eventRec.location,
    time: eventRec.time,
    event_key: `${event_id}#${occurrence_date}`,
    occurrence_date,
    record_type: 'occurrence'
  };
  let goodWrite = true;
  await dbClient
    .put({
      Item: putCalendar,
      TableName: "Calendar",
    })
    .promise()
    .catch(error => {
      cl(`caught error updating Calendar; error is:`, error);
      goodWrite = false;
    });
  if (!goodWrite) { return false; }

  if (!eventRec.occExists) { eventRec.occExists = [occurrence_date]; }
  else { eventRec.occExists.push(occurrence_date); }

  if ((!eventRec.last_written_occurrence)
    || (oDate.numeric > Number(eventRec.last_written_occurrence))) {
    eventRec.last_written_occurrence = occurrence_date;
  }

  await dbClient
    .update({
      Key: { client: client, event_key: event_id },
      UpdateExpression: 'set occExists = :a, last_written_occurrence = :b',
      ExpressionAttributeValues: { ':a': eventRec.occExists, ':b': eventRec.last_written_occurrence },
      TableName: "Calendar"
    })
    .promise()
    .catch(error => { cl(`caught error updating Calendar; error is: `, error); });

  return putCalendar;
}