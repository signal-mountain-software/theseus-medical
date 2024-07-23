import { clt, cl, recordExists, getCustomizations, makeArray, makeString, makeNumber, uuid, dbClient, titleCase, isEmpty, isObject } from './AVAUtilities';
import { makeName, getPerson, formatPhone } from './AVAPeople';
import { addDays, daysDiff, makeDate, makeTime } from './AVADateTime';
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
      defaultSlotOwners: body.calendar_info.defaultSlotOwners,
      messaging: [],
      event_data: {
        description: body.calendar_info.description,
        owner: makeArray(body.calendar_info.owner),
        groups: setRestrictions(body.calendar_info.restrictions),
        type: body.calendar_info.personal_event ? 'personal' : body.calendar_info.signup_type,
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
      slotPattern: setSlots(body.calendar_info),
      slot_object_list: body.calendar_info.slot_object_list
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
      case 'bi-weekly_on': {
        return {
          recurrence: 'bi-weekly',
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

export async function myAvailability(requestBody) {
  // check_date, check_person_id, check_client
  // get slots for the occurrence_date you're checking
  let already_booked = [];   // {start_time24: hhmm, end_time24: hhmm, event: xxxx, event_description: yyyy}
  let calRecs = await dbClient
    .query({
      KeyConditionExpression: 'client = :c and list_key = :d',
      ExpressionAttributeValues: {
        ':c': requestBody.client || requestBody.client_id || requestBody.check_client,
        ':d': `${requestBody.check_person_id || requestBody.personID}#${makeDate(requestBody.date || requestBody.check_date).numeric$}`
      },
      TableName: "Calendar",
      IndexName: 'list_key-index'
    })
    .promise()
    .catch(error => {
      cl({ 'Error reading Calendar': error });
    });
  if (!recordExists(calRecs)) { return already_booked; }
  for (let ndx = 0; ndx < calRecs.Items.length; ndx++) {
    let this_calRec = calRecs.Items[ndx];
    if (this_calRec?.slotData?.status?.current !== 'released') {
      let eventRec = {};
      let occRec = {};
      let cRecs = await getCalendarEntries({
        client: requestBody.client || requestBody.client_id || requestBody.check_client,
        event: `${this_calRec.event_id}#${this_calRec.occurrence_date}`,
        type: ['event', 'occurrence']
      });
      if (cRecs[0].eventData || cRecs[0].calData) {
        eventRec = cRecs[0];
        if (cRecs[1]) { occRec = cRecs[1]; }
      }
      else {
        occRec = cRecs[0];
        if (cRecs[1]) { eventRec = cRecs[1]; }
      }
      let eventStart24 = eventRec.eventData?.event_data?.time?.from;
      let event_start_time24 = eventStart24 ? makeTime(eventStart24.trim()).numeric24 : 0;
      let eventEnd24 = eventRec.eventData?.event_data?.time?.to;
      let event_end_time24 = eventEnd24 ? makeTime(eventEnd24.trim()).numeric24 : 2359;
      if (eventRec && ('eventData' in eventRec) && (eventRec.eventData.slotPattern)) {
        let slotArray = eventRec.eventData.slotPattern;
        if (('occData' in occRec) && (occRec.occData.slotPattern)) { slotArray = occRec.occData.slotPattern; };
        let foundNdx = slotArray.findIndex(slot => {
          return (slot === this_calRec.slotData.slot);
        });
        let found_end_time24 = event_end_time24;
        let found_start_time24 = event_start_time24;
        let slot_description = slotArray[foundNdx] || '0';
        if (eventRec.eventData.sign_up.type === 'time') {
          found_start_time24 = Number(slot_description);
          if (found_start_time24 < event_start_time24) {
            found_start_time24 = event_start_time24;
          }
          found_end_time24 = slotArray[foundNdx + 1] || event_end_time24;
          if (found_end_time24 > event_end_time24) {
            found_end_time24 = event_end_time24;
          }
        }
        if (eventRec.eventData.slot_object_list) {
          let found = eventRec.eventData.slot_object_list.find(o => {
            return (o.key === slot_description);
          });
          if (found) {
            if (eventRec.eventData.sign_up.type !== 'time') {
              let [found_start, found_end] = found.value.split("-");
              found_start_time24 = found_start ? makeTime(found_start.trim()).numeric24 : event_start_time24;
              if (found_start_time24 < event_start_time24) {
                found_start_time24 = event_start_time24;
              }
              found_end_time24 = found_end ? makeTime(found_end.trim()).numeric24 : event_end_time24;
              if (found_end_time24 > event_end_time24) {
                found_end_time24 = event_end_time24;
              }
            }
          }
        }
        console.log(found_start_time24, found_end_time24);
        already_booked.push({
          start_time24: found_start_time24,
          end_time24: found_end_time24,
          event: occRec.event_key,
          event_description: eventRec.eventData.event_data.description
        });
      }
    }
  }
  already_booked.sort((a, b) => {
    return ((a.start_time24 < b.start_time24) ? 1 : -1);
  });
  return already_booked;
}

export function slotTimes(eventRec, occRec, slotRec) {
  let eventStart24 = eventRec.time?.from;
  let event_start_time24 = eventStart24 ? makeTime(eventStart24.trim()).numeric24 : 0;
  let eventEnd24 = eventRec.time?.to;
  let event_end_time24 = eventEnd24 ? makeTime(eventEnd24.trim()).numeric24 : 2359;
  if (eventRec.slotPattern) {
    let slotArray = eventRec.slotPattern;
    if (('occData' in occRec) && (occRec.occData.slotPattern)) { slotArray = occRec.occData.slotPattern; };
    let foundNdx = slotArray.findIndex(slot => {
      return (slot === slotRec.slotData.slot);
    });
    let found_end_time24 = event_end_time24;
    let found_start_time24 = event_start_time24;
    let slot_description = slotArray[foundNdx] || '0';
    if (eventRec.type === 'time') {
      found_start_time24 = Number(slot_description);
      if (found_start_time24 < event_start_time24) {
        found_start_time24 = event_start_time24;
      }
      found_end_time24 = slotArray[foundNdx + 1] || event_end_time24;
      if (found_end_time24 > event_end_time24) {
        found_end_time24 = event_end_time24;
      }
    }
    if (eventRec.slot_object_list) {
      let found = eventRec.slot_object_list.find(o => {
        return (o.key === slot_description);
      });
      if (found) {
        if (eventRec.type !== 'time') {
          let [found_start, found_end] = found.value.split("-");
          found_start_time24 = found_start ? makeTime(found_start.trim()).numeric24 : event_start_time24;
          if (found_start_time24 < event_start_time24) {
            found_start_time24 = event_start_time24;
          }
          found_end_time24 = found_end ? makeTime(found_end.trim()).numeric24 : event_end_time24;
          if (found_end_time24 > event_end_time24) {
            found_end_time24 = event_end_time24;
          }
        }
      }
    }
    return {
      start24: found_start_time24,
      end24: found_end_time24
    };
  }
  else {
    return {
      start24: 0,
      end24: 2359
    };
  }
}

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
            qQ.KeyConditionExpression += ' and begins_with(event_key, :rV)';
            qQ.ExpressionAttributeValues[':rV'] = rV;
            if (rP) {
              qQ.FilterExpression = 'begins_with(list_key, :rP)';
              qQ.ExpressionAttributeValues[':rP'] = `${rP}#`;
            }
            break;
          }
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
        clt({ 'Bad batch write on Calendars - caught error is': error });
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
  let last_ampm = null;
  let show_ampm = '';
  if (eventRec && ('eventData' in eventRec) && (eventRec.eventData.slotPattern)) {
    let slotArray = eventRec.eventData.slotPattern;
    if (('occData' in occRec) && (occRec.occData.slotPattern)) { slotArray = occRec.occData.slotPattern; };
    let eventStart24 = eventRec.eventData?.event_data?.time?.from;
    let event_start_time24 = eventStart24 ? makeTime(eventStart24.trim()).numeric24 : 0;
    let eventEnd24 = eventRec.eventData?.event_data?.time?.to;
    let event_end_time24 = eventEnd24 ? makeTime(eventEnd24.trim()).numeric24 : 2359;
    slotArray.forEach((s, ndx) => {
      let found_end_time24 = event_end_time24;
      let found_start_time24 = event_start_time24;
      let slot_description = s;
      if (eventRec.eventData.sign_up.type === 'time') {
        let hh = Number(s.slice(0, 2));
        let calc_ampm = ((hh < 12) ? 'am' : 'pm');
        if (calc_ampm !== last_ampm) {
          show_ampm = calc_ampm;
          last_ampm = calc_ampm;
        }
        else {
          show_ampm = '';
        }
        if (hh > 12) {
          hh -= 12;
        }
        slot_description = `${hh}:${s.slice(2)} ${show_ampm}`.trim();
        found_start_time24 = s;
        if (found_start_time24 < event_start_time24) {
          found_start_time24 = event_start_time24;
        }
        found_end_time24 = slotArray[ndx + 1] || event_end_time24;
        if (found_end_time24 > event_end_time24) {
          found_end_time24 = event_end_time24;
        }
      }
      let slot_sort = s;
      if (eventRec.eventData.slot_object_list) {
        let found = eventRec.eventData.slot_object_list.find(o => {
          return (o.key === s);
        });
        if (found) {
          slot_description = found.value;
          slot_sort = found.sort;
          if (eventRec.eventData.sign_up.type !== 'time') {
            let [found_start, found_end] = found.value.split("-");
            found_start_time24 = found_start ? makeTime(found_start.trim()).numeric24 : event_start_time24;
            if (found_start_time24 < event_start_time24) {
              found_start_time24 = event_start_time24;
            }
            found_end_time24 = found_end ? makeTime(found_end.trim()).numeric24 : event_end_time24;
            if (found_end_time24 > event_end_time24) {
              found_end_time24 = event_end_time24;
            }
          }
        }
      }
      console.log(found_start_time24, found_end_time24);
      slotObj[s] = {
        status: "available",
        show_this_slot: true,
        slot_description,
        slot_start_time24: found_start_time24,
        slot_end_time24: found_end_time24,
        slot_sort
      };
    });
  }
  let slotRecs = await getCalendarEntries({ client: request.client, event: occRec.event_key, type: 'structure' });
  if (slotRecs.length > 0) {
    let ownedSlotsFound = false;
    for (let rNum = 0; rNum < slotRecs.length; rNum++) {
      let r = slotRecs[rNum];
      if (r.slotData) {
        let slotKey = r.slotData.slot || r.slotData.id;
        let owner_location = null;
        if (r.slotData.owner && (r.slotData.status && (r.slotData.status.current !== 'released'))) {
          ownedSlotsFound = true;
          let this_person = await getPerson(r.slotData.owner, '*all');
          if (this_person.location) {
            owner_location = this_person.location.trim();
          }
        }
        let slot_description = slotKey;
        if (eventRec.eventData.sign_up.type === 'time') {
          let hh = Number(slotKey.slice(0, 2));
          let calc_ampm = ((hh < 12) ? 'am' : 'pm');
          if (calc_ampm !== last_ampm) {
            show_ampm = calc_ampm;
            last_ampm = calc_ampm;
          }
          else {
            show_ampm = '';
          }
          if (hh > 12) {
            hh -= 12;
          }
          slot_description = `${hh}:${slotKey.slice(2)} ${show_ampm}`.trim();
        }
        let slot_sort = slotKey;
        if (eventRec.eventData.slot_object_list) {
          let found = eventRec.eventData.slot_object_list.find(o => {
            return (o.key === slotKey);
          });
          if (found) {
            slot_description = found.value;
            slot_sort = found.sort;
          }
        }
        slotObj[slotKey] = Object.assign(r.slotData, {
          status: (r.slotData.status ? r.slotData.status.current : "undefined"),
          show_this_slot: (r.slotData.hasOwnProperty('show_this_slot') ? r.slotData.show_this_slot : true),
          owner: r.slotData.owner,
          display_name: makeReadableName(r.slotData),
          owner_location: owner_location,
          marked: r.marked,
          slot_description,
          slot_sort
        });
      }
    };
    if (!ownedSlotsFound) {   // no slots found at all?
      // slotRecs[0] will be the event record - does it give instructions on what to do?
      if (eventRec.eventData.hasOwnProperty('defaultSlotOwners')) {
        if (eventRec.eventData.defaultSlotOwners === 'first_occurrence') {
          let newSlotObj = await copySlots(request.client, `${eventRec.event_id}#${eventRec.occExists[0]}`, occRec.event_key);
          slotObj = Object.assign(slotObj, newSlotObj);
        }
        else if (eventRec.eventData.defaultSlotOwners === 'prior_occurrence') {
          let indexAt = eventRec.occExists.indexOf(occRec.occurrence_date);
          let stopLoop = false;
          let newSlotObj = {};
          while ((indexAt >= 0) && !stopLoop) {
            newSlotObj = await copySlots(request.client, `${eventRec.event_id}#${eventRec.occExists[indexAt - 1]}`, occRec.event_key);
            stopLoop = (Object.keys(newSlotObj).length > 0);
            indexAt--;
          }
          slotObj = Object.assign(slotObj, newSlotObj);

        }
      }
    }
  }
  return ({ eventRec, slotObj, occRec });

  function makeReadableName(pItem) {
    if (!pItem.name) {
      return pItem.display_name;
    }
    let [pPrimary, pFirst] = pItem.name.split(',');
    return (`${pFirst || ''} ${pPrimary}`).trim();
  }
}

export async function copySlots(client_id, from_occ, to_occ) {
  if (to_occ === from_occ) {
    return {};
  }
  let slotObj = {};
  let slotRecs = await getCalendarEntries({
    client: client_id,
    event: from_occ,
    type: ['event', 'structure']
  });
  let from_event = slotRecs.find(r => {
    return r.hasOwnProperty('eventData');
  });
  for (let rNum = 0; rNum < slotRecs.length; rNum++) {
    let r = slotRecs[rNum];
    if (r.slotData && r.slotData.owner && (r.slotData.status && (r.slotData.status.current !== 'released'))) {
      let slotKey = r.slotData.slot || r.SlotData.id;
      let newSlot = await writeSlot({
        "client": client_id,
        "event": to_occ,
        "owner": r.slotData.owner,
        "slot": slotKey,
        "no_messaging": true
      });
      let owner_location = null;
      let readableName = '';
      let this_person = await getPerson(r.slotData.owner, '*all');
      if (this_person.location) {
        owner_location = this_person.location.trim();
      }
      if (!this_person.name) {
        readableName = this_person.display_name;
      }
      else {
        readableName = (`${this_person.name.first || ''} ${this_person.name.last || ''}`).trim();
      }
      if (Array.isArray(from_event.eventData.slot_object_list)) {
        let this_slotObj = from_event.eventData.slot_object_list.find(o => {
          return (slotKey === o.key);
        });
        slotObj[slotKey] = Object.assign(newSlot, {
          status: (newSlot.status ? newSlot.status.current : "undefined"),
          show_this_slot: (newSlot.hasOwnProperty('show_this_slot') ? newSlot.show_this_slot : true),
          owner: r.slotData.owner,
          display_name: readableName,
          owner_location: owner_location,
          marked: false,
          slot_description: this_slotObj.value,
          slot_sort: this_slotObj.sort
        });
      }
    }
  }
  return slotObj;
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
    case "bi-weekly": {
      let firstWeek = [];
      let firstDate = makeDate(occPattern.first_date).date;
      for (let count = 0; count < 7; count++) {
        let d = addDays(firstDate, count);
        firstWeek[d.getDay()] = d;
      }
      for (let candidate = from_date; candidate < to_date; candidate = addDays(candidate, 1)) {
        if (occPattern.day_of_week.includes(candidate.getDay()) && (daysDiff(candidate, firstWeek[candidate.getDay()]) % 14) === 0) {
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
    // called from inside getOccurenceList and therefore pertains to a specific event currently loaded
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
    // cl(`${eventRec.eventData.event_data.description} (${eventRec.event_key}) - ${cDate.absolute} exists already`);
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
  let event_key;
  if (occ_id) {
    event_key = `${event_id}#${occ_id}#${body.slot}`;
  }
  else {
    event_key = `${event_id}#${occurrence}#${body.slot}`;
  }
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
  if (body.no_messaging) {
    // no op here... just drop through
  }
  else {
    let [eventRec] = await getCalendarEntries({ client: body.client, event: `${event_key}`, type: 'event' });
    if (eventRec.eventData && (!eventRec.eventData.messaging || (eventRec.eventData.messaging.length === 0))) {
      let subjectText = '';
      let messageText = '';

      if (body.status === 'released') {
        subjectText = `${slotDataObj.name} was removed from `;
      }
      else {
        subjectText = `${slotDataObj.name} signed up `;
        if (slotDataObj.slot) {
          let maybeTime = makeSlotName(slotDataObj.slot);
          if (maybeTime.includes(':')) {
            subjectText += ` in the ${makeTime(slotDataObj.slot).time} slot `;
          }
        }
        subjectText += 'for ';
      }
      if (body.override_description) {
        subjectText += body.override_description;
      }
      else if (eventRec.eventData.event_data) {
        subjectText += eventRec.eventData.event_data.description;
      }
      else if (eventRec.calData) {
        subjectText += eventRec.calData.description;
      }
      else { subjectText += 'your event'; }
      subjectText += ` on ${makeDate(occurrence).absolute}`;

      messageText = (slotDataObj.notes ? `${slotDataObj.notes}\r\n\n` : '');
      let pName = await makeName(body.person_id);
      messageText += `AVA Automated Message from ${pName}`;

      let ownerList;
      if (eventRec.eventData.event_data) { ownerList = makeArray(eventRec.eventData.event_data.owner); }
      else if (eventRec.calData) { ownerList = eventRec.calData.owner; }
      eventRec.eventData.messaging = {
        action: (body.status === 'released' ? "released" : "selected"),
        format: {
          subject: subjectText,
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
  }
  /*
  return {
    'request_id': serviceRequestRec.request_id,
    'message': (goodWrite ? `${body.requestType} request ${serviceRequestRec.request_id} added (${body.author} for ${serviceRequestRec.on_behalf_of})` : 'Request not added')
  };
  */

  return putCalendar;
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
  let eoData = await getSlotList({ "client": body.client || body.client_id, "event": body.event || body.event_id });
  oData.slots = eoData.slotObj;

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
  pdfLine(page.info.title, page.font.size.large, 'bold', 0, 0, 0, { align: 'center' });
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
  // let nameRow_indent = detail_indent - 10;

  let slotList = Object.keys(oData.slots).sort();

  for (let s = 0; s < slotList.length; s++) {
    let sID = slotList[s];
    let outName;
    let occupiedSlot = false;
    if (oData.slots[sID].owner && (oData.slots[sID].owner !== 'available') && (oData.slots[sID].owner !== '')) {
      occupiedSlot = true;
      if (!oData.slots[sID].display_name) { outName = oData.slots[sID].owner; }
      else {
        let oParts = oData.slots[sID].display_name.split(',');
        if (oParts.length === 1) { outName = oParts[0].trim(); }
        else { outName = (`${oParts[1].trim()} ${oParts[0].trim()}`).trim(); }
      }
    };
    if (body.request_type === 'sign-up') {
      pdfLine(((oData.type === 'time') ? formatTime(sID) : sID), page.font.size.large, 'normal', 0, 1.5, 0, { align: 'left' });
      if (occupiedSlot) {
        pdfLine(outName, page.font.size.large, 'bold', 0, 0, 0, { xPos: detail_indent + 10, noNewLine: true });
      }
      doc.line(detail_indent, yPos + 3, detail_indent + 300, yPos + 3, 'F');
    }
    else if (occupiedSlot) {
      pdfLine('image', page.font.size.large, 'normal', 0, 1.5, 0, { image: `https://theseus-medical-storage.s3.amazonaws.com/public/patients/${oData.slots[sID].owner}.jpg` });
      pdfLine(outName, page.font.size.large, 'bold', 0, 0.5, 0, { noNewLine: true });
      let nameY = yPos;
      if (oData.type === 'time') {
        pdfLine(`${formatTime(sID)}`, page.font.size.medium, 'normal', 0, 0, 0, { align: 'vertical', noBreak: true });
      }
      else if (oData.type === 'seats') {
        pdfLine(`${sID}`, page.font.size.medium, 'normal', 0, 0, 0, { align: 'vertical', noBreak: true });
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
        else if (options.align === 'left') {
          doc.text(text, page.margin.left + indent, yPos);
          previousXPos = page.margin.left + indent;
          xPos = page.margin.left + indent + doc.getTextWidth(text) + lastSize;
        }
        else if (options.xPos) {
          doc.text(text, options.xPos, yPos);
          previousXPos = options.xPos;
          xPos = options.xPos + doc.getTextWidth(text) + lastSize;
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
          if (this_rec.eventData.event_data.groups) {
            returnObj.groups = this_rec.eventData.event_data.groups.filter(g => {
              return ((g !== 'ALL') && (g !== '__TOP__'));
            });
          }
          if (!returnObj.groups || (returnObj.groups.length === 0)) {
            returnObj.groups = ['*all'];
          }
          returnObj.owner = this_rec.eventData.event_data.owner || [];
          returnObj.time = this_rec.eventData.event_data.time.from;
          if (this_rec.eventData.event_data.time.to && (this_rec.eventData.event_data.time.to.trim() !== '')) {
            returnObj.time += ` to ${this_rec.eventData.event_data.time.to}`;
          };
          eventRec = this_rec;
          start_date = makeDate(this_rec.eventData.last_written_occurrence || this_rec.start_date || today.date).date;
          if (start_date < today.date) { start_date = today.date; }
          end_date = makeDate(this_rec.end_date || addDays(start_date, 35)).date;
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
          if (rec.eventData.event_data.time.to && (rec.eventData.event_data.time.to.trim() !== '')) {
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
        if (rec.time.to && (rec.time.to.trim() !== '')) {
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
          if (rec.occData.event_data.time.to && (rec.occData.event_data.time.to.trim() !== '')) {
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
  /*
  get a list of events by date
  requestBody = {
      client (or client_id or [list of client_id's])
      start_date - today if missing
      end_date - start + 14 days if missing
      filter {
         group: [...values] - only include entries that are valid for one of these groups
         person: person_id - only include entries where this person is a slot owner
        }
  }
  returnList = [{
    date (as yyyymmdd string)
    client
    event_key (event_id#occurrence_date)  
    description,
    location,
    time,
    restrictedToGroup
  }]
  */

  const [start_date, end_date] = setDateRange(body.start_date, body.end_date);

  let qQ = { TableName: 'Calendar' };
  qQ.IndexName = 'occurrence_date-index';

  const this_client = body.client || body.client_id;
  qQ.KeyConditionExpression = 'client = :c';
  qQ.ExpressionAttributeValues = { ':c': this_client };

  qQ.KeyConditionExpression += ' AND occurrence_date BETWEEN :s and :e';
  qQ.ExpressionAttributeValues[':s'] = makeDate(start_date, { noTime: true }).numeric$;
  qQ.ExpressionAttributeValues[':e'] = makeDate(end_date, { noTime: true }).numeric$;

  let peopleInfo = {};
  let response = {};
  for (let date = start_date; date <= end_date; date = addDays(date, 1)) {
    let thisDate = makeDate(date);
    response[thisDate.numeric] = {
      events: {},
      date_words: thisDate.relative
    };
  };

  // let returnList = [];
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
  if (!recordExists(calendarRecs)) { return response; }

  let ccL = calendarRecs.Items.length;
  let screenDate = 0;
  let found_events = {};
  for (let c = 0; c < ccL; c++) {
    let occurrenceRec = calendarRecs.Items[c];
    if (occurrenceRec.occurrence_date !== screenDate) {  // send a message back... now processing date xxxx
      screenDate = occurrenceRec.occurrence_date;
      screenStatus(makeDate(occurrenceRec.occurrence_date).relative, ccL * 3, ((c / ccL) * 90));
    }
    if (!found_events.hasOwnProperty(occurrenceRec.event_id)) {
      // for each event we come across, gather event data (eventData) and create any missing occurrences in this date range (getOccurrenceList)
      // found_events[occurrenceRec.event_id] = await eventData({
      //   client_id: this_client,
      //   event_id: occurrenceRec.event_id,
      //   info: 'basic'
      // });
      let newOcc = await getOccurenceList({
        client: this_client,
        event: occurrenceRec.event_id,
        from_date: start_date,
        to_date: end_date
      });
      found_events[occurrenceRec.event_id] = newOcc.eventRec.eventData.event_data;
      if (newOcc.eventRec.eventData.slotPattern && (newOcc.eventRec.eventData.slotPattern.length > 0)) {
        found_events[occurrenceRec.event_id].slotPattern = newOcc.eventRec.eventData.slotPattern;
      }
      if (newOcc.eventRec.eventData.slot_object_list && (newOcc.eventRec.eventData.slot_object_list.length > 0)) {
        found_events[occurrenceRec.event_id].slot_object_list = newOcc.eventRec.eventData.slot_object_list;
      }
      if ((newOcc.eventRec.eventData.event_data.type === 'seats')
        && (newOcc.eventRec.eventData.slotPattern)
        && (newOcc.eventRec.eventData.slot_object_list)) {
        found_events[occurrenceRec.event_id].slot_names = {};
        let lastID = '';
        newOcc.eventRec.eventData.slotPattern.forEach(sID => {
          let foundIt = newOcc.eventRec.eventData.slot_object_list.find(sO => {
            return (sO.key === sID);
          });
          if (foundIt && foundIt.value !== '') {
            lastID = foundIt.value;
          }
          found_events[occurrenceRec.event_id].slot_names[sID] = lastID;
        });
      }
      if (!found_events[occurrenceRec.event_id].hasOwnProperty('time')
        || (isObject(found_events[occurrenceRec.event_id].time) && isEmpty(found_events[occurrenceRec.event_id].time.from))
        || (isEmpty(found_events[occurrenceRec.event_id].time))) {
        found_events[occurrenceRec.event_id].sort24 = `0001-${found_events[occurrenceRec.event_id].description}`;
      }
      else if (isObject(found_events[occurrenceRec.event_id].time)) {
        found_events[occurrenceRec.event_id].sort24 = makeTime(found_events[occurrenceRec.event_id].time.from).string24;
      }
      else {
        found_events[occurrenceRec.event_id].sort24 = makeTime(found_events[occurrenceRec.event_id].time.split(' to')[0]).string24;
      }
      // for occurrences that were created, add them to the appropriate response[date].events object 
      for (let newDate in newOcc.occRec) {
        if (response.hasOwnProperty(newDate)) {
          if (!response[newDate].events.hasOwnProperty(newOcc.occRec[newDate].event_id)) {
            response[newDate].events[newOcc.occRec[newDate].event_id] = {
              slot_owners: {}
            };
          }
          Object.assign(response[newDate].events[newOcc.occRec[newDate].event_id], newOcc.eventRec.eventData.event_data, newOcc.occRec[newDate]);
        }
      }
    }
    // find and add this event in the proper date
    if (!response[occurrenceRec.occurrence_date].events.hasOwnProperty(occurrenceRec.event_id)) {
      response[occurrenceRec.occurrence_date].events[occurrenceRec.event_id] = {
        slot_owners: {}
      };
    }
    if (occurrenceRec.record_type === 'occurrence') {
      Object.assign(response[occurrenceRec.occurrence_date].events[occurrenceRec.event_id], occurrenceRec);
    }
    else if ((occurrenceRec.record_type === 'slot') && ((occurrenceRec.slotData.status.current === 'selected') || (occurrenceRec.slotData.status.current === 'notes'))) {
      response[occurrenceRec.occurrence_date].events[occurrenceRec.event_id].slot_owners[occurrenceRec.slotData.owner] =
        found_events[occurrenceRec.event_id]?.slot_names?.[occurrenceRec.slotData.slot] || ((found_events[occurrenceRec.event_id].type === 'seats') ? '' : occurrenceRec.slotData.slot);
      if (!peopleInfo.hasOwnProperty(occurrenceRec.slotData.owner)) {
        peopleInfo[occurrenceRec.slotData.owner] = [];
      }
      let slotTimesResponse = slotTimes(found_events[occurrenceRec.event_id], response[occurrenceRec.occurrence_date].events[occurrenceRec.event_id], occurrenceRec);
      peopleInfo[occurrenceRec.slotData.owner].push(Object.assign({},
        {
          occurrence_date: occurrenceRec.occurrence_date,
          event_id: occurrenceRec.event_id,
          event_description: found_events[occurrenceRec.event_id].description,
          start_time24: slotTimesResponse.start24,
          end_time24: slotTimesResponse.end24,
        },
        occurrenceRec.slotData)
      );
    }
  };

  screenStatus('Wrapping things up', ccL * 3, 95);
  let greetings = await getCustomizations('greetings', this_client);
  let greetingsAll = await getCustomizations('greetings', '*all');
  let holidays = Object.assign({}, greetingsAll.customization_value, greetings.customization_value);

  for (let this_date in response) {
    // Add Holidays from the Greetings or Holidays Customization
    let today = makeDate(this_date);
    let mmdd = today.obs.slice(5);
    let yymmdd = `${today.obs.slice(2, 4)}.${mmdd}`;
    if (holidays.hasOwnProperty(today.obs)) {
      response[this_date].events[`#greeting_${yymmdd}#`] = {
        description: holidays[today.obs],
        sort24: `0000-${holidays[today.obs]}`,
        slot_owners: [],
        type: 'holiday'
      };
    }
    else if (holidays.hasOwnProperty(yymmdd)) {
      response[this_date].events[`#greeting_${yymmdd}#`] = {
        description: holidays[yymmdd],
        sort24: `0000-${holidays[yymmdd]}`,
        slot_owners: [],
        type: 'holiday'
      };
    }
    else if (holidays.hasOwnProperty(mmdd)) {
      response[this_date].events[`#greeting_${yymmdd}#`] = {
        description: holidays[mmdd],
        sort24: `0000-${holidays[mmdd]}`,
        slot_owners: [],
        type: 'holiday'
      };
    }
    for (let this_event in response[this_date].events) {
      let allowed_event = true;
      if (found_events[this_event]) {
        if (found_events[this_event].owner.includes(body.this_person)) {
          allowed_event = true;
        }
        else if ((found_events[this_event].type === 'personal') &&
          body.this_person &&
          (!found_events[this_event].owner.includes(body.this_person))) {
          allowed_event = false;
        }
        else if ((body.filter.group) && (found_events[this_event]?.groups)) {
          // event must allow *all OR must allow a group that is in the filter.group list
          if (found_events[this_event].groups.includes('*all')) { }
          else {
            allowed_event = found_events[this_event].groups.some(allowed_group => {
              return Object.keys(body.filter.group).includes(allowed_group);
            });
          }
        }
      }
      if (!allowed_event) {
        delete response[this_date].events[this_event];
      }
      else {
        response[this_date].events[this_event] = Object.assign({}, found_events[this_event], response[this_date].events[this_event]);
      }
    }
  }

  response.peopleInfo = peopleInfo;
  return response;

  function setDateRange(start_date, end_date) {
    let this_start, this_end;
    let candidate = makeDate(start_date);
    if (candidate.error || isEmpty(start_date)) {
      if (isEmpty(end_date)) {
        this_start = new Date();
        this_end = addDays(this_start, 14);
      }
      else if (isObject(end_date)) {
        this_end = end_date;
        this_start = addDays(this_end, -14);
      }
      else {
        let candidate = makeDate(end_date);
        if (candidate.error) {
          this_start = new Date();
          this_end = addDays(this_start, 14);
        }
        else {
          this_end = candidate.date;
          this_start = addDays(this_end, -14);
        }
      }
    }
    else {
      this_start = candidate.date;
      if (isEmpty(end_date)) {
        this_end = addDays(this_start, 14);
      }
      else if (isObject(end_date)) {
        this_end = end_date;
      }
      else {
        let candidate = makeDate(end_date);
        if (candidate.error) {
          this_end = addDays(this_start, 14);
        }
        else {
          this_end = candidate.date;
        }
      }
    }

    if (this_end < this_start) {
      return [this_end, this_start];
    }
    else {
      return [this_start, this_end];
    }
  }
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
    case "bi-weekly": {
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
          // Now figure out if this was in the start week or any date an exact multiple of 14 days after the start week
          // candidate.getDay() is a matching day of the week; what is the day of the week for the first date?
          let firstDate = makeDate(occPattern.first_date).date;
          let firstDayOfWeek = firstDate.getDay();
          let candidateDayOfWeek = candidate.getDay();
          let diff = candidateDayOfWeek - firstDayOfWeek;
          let baseDate;
          if (candidateDayOfWeek > firstDayOfWeek) { baseDate = addDays(firstDate, 7 - diff); }
          else { baseDate = addDays(firstDate, diff); }
          if ((daysDiff(candidate, baseDate) % 14) === 0) { responseArray.push(nominee.numeric$); };
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
      let from_date = makeDate(start_date).date;
      from_date.setMonth(1);
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