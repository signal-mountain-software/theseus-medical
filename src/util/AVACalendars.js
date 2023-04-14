import { clt, cl, recordExists, makeArray, makeString, makeNumber, resolveVariables, uuid } from './AVAUtilities';
import { makeName } from './AVAPeople';
import { addDays, makeDate } from './AVADateTime';
import { sendMessages, resolveMessageVariables } from './AVAMessages';

// const PDFDocument = require('pdfkit');

const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

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
  let eventRec = {
    client: body.clientId,
    event_key: eventID,
    event_id: eventID,
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
      occPattern: Object.assign({}, setRecurrence(body.calendar_info.schedule_type)),
      reminders: {
        reminder_minutes_Enrolled: body.calendar_info.reminder_minutes_Enrolled,
        reminder_minutes_NotEnrolled: body.calendar_info.reminder_minutes_NotEnrolled
      },
      sign_up: {
        name_security: (body.calendar_info.slot_visibility && (body.calendar_info.slot_visibility !== 'show_name')),
        type: body.calendar_info.signup_type,
      },
      slotPattern: body.calendar_info.slot_max_seats ? setSeatNames(body.calendar_info.slot_max_seats) : body.calendar_info.slots
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

  return eventRec;

  // **********

  function setRestrictions(inR) {
    if ((inR) && (inR.length > 0)) { return inR; }
    else { return ['*all']; }
  }

  function setRecurrence(inR) {
    let first_date = makeDate(body.calendar_info.event_date);
    let last_date = body.calendar_info.last_date ? makeDate(body.calendar_info.last_date).numeric : null;
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
          day_of_week: [first_date.date.getDay()]
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

  function setSeatNames(inNum) {
    let returnArr = [];
    for (let i = 0; i < inNum; i++) {
      returnArr.push(i.toString());
    }
    return returnArr;
  }
};

export async function getCalendarEntries(body) {
  /*  
  body: {
    client_id  (alt client)
    person_id  (alt person)
    event_id  (form event#occurrence OK) (alt event)
    occurrence_id  (if present, replaces occurrence in event_id) (alt occurrence)
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
  let returnArr = [];
  let rC = body.client_id || body.client;
  let rP = body.person_id || body.person || body.filter?.person_id || body.filter?.person;
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
      // we assume they want all entries in the calendar moving forward from this date
      qQ.IndexName = 'occurrence_date-index';
      qQ.KeyConditionExpression = 'client = :c and occurrence_date > :now';
      qQ.ExpressionAttributeValues = { ':c': rC, ':now': makeDate('today').numeric.toString() };
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
    let qR = await dbClient
      .query(qQ)
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          cl(`Security Violation or no Internet Connection`);
        }
        cl(`Error reading ${qQ.TableName} id ${error}`);
      });
    if (recordExists(qR)) {
      returnArr.push(...qR.Items);
    }
    else {
      if ((rT[t] === 'occurrence') && (create_occ)) {
        // occurrence not found... 
        // asked to create the entry if not found(create_occ = true), so...
        let newOcc = await validateOccurrence(rC, rV, rO, true);  // will not create if it is an invalid occurrence
        if (newOcc && Array.isArray(newOcc)) { returnArr.push(...newOcc); }
      }
    }
  }  // end of loop for requested types
  if (returnArr.length < 2) { return returnArr; }
  else {
    // return the list of calendar entries sorted by date/slot in event key (oldest first)
    return returnArr.sort((a, b) => {
      if ((a.event_key.split(/#(.*)/)[1] || null) > (b.event_key.split(/#(.*)/)[1] || null)) { return 1; }
      else { return -1; }
    });
  }
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
          display_name: r.slotData.display_name || r.slotData.name
        });
      }
    });
  }
  return ({ eventRec, slotObj, occRec });
}

export async function getOccurenceList(request) {
  /* 
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
    let tDate = makeDate(request.to_date || request.date.to || request.date.to_date).date;
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
      for (let candidate = from_date; candidate < to_date; addDays(candidate, 1)) {
        if (occPattern.day_of_week.includes(candidate.getDay())) {
          await goodCandidate(makeDate(candidate).numeric);
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
            await goodCandidate(`${yearToCheck}${(monthToCheck + 101).toString().slice(-2)}${(targetArray[r] + 100).toString().slice(-2)}`);
            if (foundEnough()) { break; }
          }
          else {
            let checkDate = new Date(candidate);
            for (let x = 0; x < 7; x++) {
              if (occPattern.day_of_week.includes(checkDate.getDay())) {
                switch (targetArray[r]) {
                  case "first": {
                    await goodCandidate(makeDate(checkDate).numeric);
                    break;
                  }
                  case "second": {
                    await goodCandidate(makeDate(addDays(checkDate, 7)).numeric);
                    break;
                  }
                  case "third": {
                    await goodCandidate(makeDate(addDays(checkDate, 14)).numeric);
                    break;
                  }
                  case "fourth": {
                    await goodCandidate(makeDate(addDays(checkDate, 21)).numeric);
                    break;
                  }
                  case "last": {
                    let possDate = addDays(checkDate, 28);
                    if (possDate.getMonth() === monthToCheck) {
                      await goodCandidate(makeDate(possDate).numeric);
                    }
                    else {
                      await goodCandidate(makeDate(addDays(checkDate, 21)).numeric);
                    }
                    break;
                  }
                  default: { }
                }  // end switch on occPattern.day_of_month (as targetArray[r]) ("first Thursday", "second Thursday", etc)
              } // end "if this date matches a target day of the week (Thursday)"
              if (foundEnough()) { break; }
              addDays(checkDate, 1);
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
          await goodCandidate((yearToCheck * 10000) + targetArray[t]);
          if (foundEnough()) { break; }
        }
      }
      break;
    }
    default: {
      for (let s = 0; s < occPattern.specified.length; s++) {
        await goodCandidate(occPattern.specified[s]);
        if (foundEnough()) { break; }
      }
    }
  }
  return response;

  // ----- Functions -----

  function foundEnough() {
    return (request.number_of_occurrences && (response.occArray.length >= request.number_of_occurrences));
  }

  async function goodCandidate(inDate) {
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
    if (('first_date' in occPattern) && (numericDate < occPattern.first_date)) { return false; }
    if (numericDate < from_numeric) { return false; }
    if (('last_date' in occPattern) && (numericDate > occPattern.last_date)) { return false; }
    if (numericDate > to_numeric) { return false; }
    // All good if we get this far
    response.occArray.push(numericDate);
    let oRec = await getCalendarEntries({ client: request.client, event: `${event_id}#${stringDate}`, type: 'occurrence' });
    if (recordExists.oRec) { response.occRec[stringDate] = oRec.occData; }
    return numericDate;
  }
}

export async function validateOccurrence(client, inEvent, inDate, addRec = false) {
  let cDate = makeDate(inDate);
  let result = await getOccurenceList({
    client,
    event: inEvent,
    from_date: cDate.date,
    to_date: cDate.date
  });
  if (result.occArray.length > 0) {
    if (result.occRec.hasOwnProperty[result.occArray[0]]) { return result.occRec[result.occArray[0]]; }
    else { return true; }
  }
  else {
    if (!addRec) { return false; }
    let occRec = await addOccurrence({
      client,
      event: result.eventRec,
      occurrence_date: cDate.numeric
    });
    return [result.eventRec, occRec];
  }
}

export async function addOccurrence(body) {
  if (!body.event) { return false; }
  let event_id, occurrence, oDesc;
  if (typeof body.event === 'object') {
    event_id = body.event.event_key;
    occurrence = body.occurrence_date;
    if (body.event.eventData) {
      let sessionData = {
        client_id: body.client,
      };
      let rDesc = await resolveVariables(body.event.eventData.event_data.description, sessionData);
      if (rDesc !== body.event.eventData.event_data.description) { oDesc = rDesc; }
    }
  }
  else {
    let occ_id;
    [event_id, occ_id] = body.event.split('#');
    occurrence = body.occurrence_date || occ_id;
  }
  let putCalendar = {
    client: body.client,
    event_id,
    event_key: `${event_id}#${occurrence}`,
    occurrence_date: `${occurrence}`
  };
  if (oDesc) {
    putCalendar.occData = {
      "event_data": { 'description': oDesc }
    };
  }
  if (body.occData) { putCalendar.occData = body.occData; }
  await dbClient
    .put({
      Item: putCalendar,
      TableName: "Calendar",
    })
    .promise()
    .catch(error => {
      cl(`caught error updating Calendar; error is:`, error);
      return false;
    });
  return putCalendar;
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
  let eventRec = await getCalendarEntries({ client: body.client, event: `${event_key}`, type: 'event' });
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
        /* 
          oResponse.occArray [oDate, oDate...]
          oResponse.occRec {oDate: occRec, oDate: occRec, ...}  if rec already exists, otherwise not present
        */
        occArray = oResponse.occArray;
      }
    }
    let peopleArray = makeArray(this_request.person);
    for (let o = 0; o < occArray.length; o++) {
      await validateOccurrence(request.client, this_request.event, occArray[o], true);
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
      time,
      date (as returned from makeDate)
      slots: {
        slotName: {
          owner (or false),
          notes,
          display_name
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
            returnObj.slots[sID] = { owner: null, notes: null, display_name: null };
          }
        });
      };
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
            returnObj.slots[sID] = { owner: null, notes: null, display_name: null };
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
          display_name: ''
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
          display_name: slotName
        };
      }
    }
    else if (rec.calData) { }
  });
  return returnObj;
};

/*
export async function printOccurrenceSheet(body) {
  let fSize = [14, 12, 10];
  let default_font = 'Helvetica';

  const doc = new PDFDocument({ size: 'LETTER', layout: 'portrait', autoFirstPage: false })
    .font(default_font)
    .fontSize(fSize[2]);

  // at 72px per inch, 8.5 x 11 (letter size) is 612px wide x 792px long
  let pageHeight = 792;

  newPage();

  // Get the event master record

  let oData = await occurrenceData(body);
  // Let's do this thang...
  doc.info = { author: 'AVA', title: oData.description };

  // Body

  let totalLines = 0;
  let pageNumber = 0;

  let detail_indent = 70;
  // let detail_indent = ((time_type || seats_type) ? 70 : 10);
  let nameRow_indent = detail_indent - 10;

  for (const sID in oData.slots) {
    if (doc.y > (pageHeight - doc.page.margins.bottom - 54) || pageNumber === 0) {
      // Title lines
      if (pageNumber > 0) { newPage(); }
      pageNumber++;
      doc
        .fontSize(fSize[0] * 1.5)
        .font(`${default_font}-Bold`)
        .text(oData.description, { align: 'center' });
      doc
        .fontSize(fSize[1] * 1.5)
        .font(`${default_font}-Bold`)
        .text(oData.location, { align: 'center' });
      doc
        .fontSize(fSize[1] * 1.5)
        .font(default_font)
        .text(`${oData.date}${oData.time ? (' at ' + oData.time) : ''}`, { align: 'center' });
      if (pageNumber > 1) {
        doc
          .fontSize(fSize[2])
          .text(`page ${pageNumber}`, { align: 'center' });
        totalLines++;
      }
      doc.moveDown(3);
      totalLines += 6;
    }

    // if request_type is sign-up turn on underline on display_name
    // if time type show nn:mm display_name
    // is seats type show index display_name

    let rowTag = '';
    if (oData.type === 'time') { rowTag = formatTime(sID); }
    else if (sID !== oData.slots[sID].owner) { rowTag = sID; }

    let rowName = ' ';
    let slot_person = '';
    if (oData.slots[sID].owner && (oData.slots[sID].owner !== 'available') && (oData.slots[sID].owner !== '')) {
      rowName = oData.slots[sID].display_name;
      slot_person = oData.slots[sID].owner;
    }

    doc.moveDown(1);
    doc
      .fontSize(fSize[1])
      .font(`${default_font}-Bold`);
    if (rowTag) {
      doc
        .text(rowTag.padEnd(10), { align: 'left', continued: true });
    }
    let xAt = ((parseInt(doc.x / 10) + 1) * 10);
    let yAt = doc.y;
    doc
      .fontSize(fSize[1] * 2)
      .moveUp(0.3)
      .text(rowName, { indent: nameRow_indent });
    if (!rowName) {
      doc
        .moveTo(xAt + 35, yAt + 12)
        .lineTo(xAt + 400, yAt + 12)
        .stroke();
    }
    doc
      .moveUp(2);
    doc.font(default_font);
    totalLines += 2;
    if (slot_person && body.request_type === 'full') {
      let pRec = getPerson(slot_person);
      if (pRec) {
        doc.fontSize(fSize[2]);
        if (pRec.person_id !== 'void') {
          doc.text(pRec.Location, { indent: detail_indent });
          totalLines++;
          if (pRec.messaging.voice) {
            doc
              .text('Phone: ' + pRec.messaging.voice, { indent: detail_indent });
            totalLines++;
          }
          if (pRec.messaging.sms) {
            doc
              .text('Cell: ' + pRec.messaging.sms, { indent: detail_indent });
            totalLines++;
          }
          if (pRec.messaging.eMail) {
            doc
              .text('e-Mail: ' + pRec.messaging.eMail, { indent: detail_indent });
            totalLines++;
          }
        }
      }
      doc.moveDown(2);
    };
  }

  cl({ 'total Line Count': totalLines });
  if (totalLines === 0) {
    doc
      .fontSize(fSize[2])
      .moveDown(3)
      .text(`No data found for ${oData.description}`);
  }

  // Wrap up
  var now = new Date();
  var postTime = now.getTime();
  var timeString = now.toLocaleString([], {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });

  let yAt = doc.y;
  let xAt = doc.x;
  if (doc.y > (pageHeight - 36)) {
    newPage();
    yAt = doc.y;
  }
  else { yAt = pageHeight - 36; };

  doc.page.margins.bottom = 0;
  doc.page.margins.left = 0;
  doc
    .fontSize(fSize[2] - 2)
    .text('***** END *****', 36, pageHeight - 36);
  let rC = body.client_id || body.client;
  let rV = makeString((body.event_id || body.event || body.filter?.event_id || body.filter?.event), 1);
  doc.text('AVA reference: ' + rC + '/' + rV + '/' + body.request_type + '/' + postTime);
  doc.text('Printed: ' + timeString + ' ET');

  // Finalize PDF file
  doc.end();

  return {
    status: 200,
  };

  function newPage() {
    doc.addPage({
      margins: {
        top: pageHeight * .1,
        bottom: pageHeight * .05,
        left: pageHeight * .1,
        right: pageHeight * .1
      }
    });
  }

  function formatTime(pHHMM) {
    let mm = pHHMM % 100;
    let hh_raw = Math.floor(pHHMM / 100);
    let hh = hh_raw;
    if (hh_raw > 12) { hh = hh_raw - 12; }
    else if (hh_raw === 0) { hh = 12; };
    return (`${hh}:${mm < 10 ? '0' + mm : mm}`);
  };

}
*/