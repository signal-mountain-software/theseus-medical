import { clt, cl, recordExists, makeArray, resolveVariables } from './AVAUtilities';
import { makeName } from './AVAPeople';
import { addDays, makeDate } from './AVADateTime';
import { sendMessages, resolveMessageVariables  } from './AVAMessages';

const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

// Functions

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
  let rC = body.client_id || body.client;
  let rP = body.person_id || body.person || body.filter?.person_id || body.filter?.person;
  let rV = body.event_id || body.event || body.filter?.event_id || body.filter?.event;
  let rT = body.type || body.filter?.type;
  let rO = body.occurrence_id || body.occurrence || body.filter?.occurrence_id || body.filter?.occurrence;
  let create_occ = false;
  if (body.allow_create) { create_occ = body.allow_create; }
  if (rO && rV) { rV = rV.split('#')[0] + '#' + rO; }   // both sent in change rV to include passed rO
  else if (rO) { }    // rO sent without an rV - that's bad; ignore rO
  else if (rV) { rO = rV.split('#')[1]; }     // rV sent without an rO; try to set rO from the rV value
  else { }   // netiher sent;  that's OK
  let qQ = { TableName: 'Calendar' };
  let returnValueIfNotFound = false;
  if (rV) {
    qQ.KeyConditionExpression = 'client = :c';
    qQ.ExpressionAttributeValues = { ':c': rC };
    if (rT) {
      switch (rT) {
        case 'all': {
          qQ.KeyConditionExpression += ' and begins_with(event_key, :rP)';
          qQ.ExpressionAttributeValues[':rP'] = `${rV.split('#')[0]}#`;
          returnValueIfNotFound = [];
          break;
        }
        case 'event': {
          qQ.KeyConditionExpression += ' and event_key = :rP';
          qQ.ExpressionAttributeValues[':rP'] = `${rV.split('#')[0]}`;
          break;
        }
        case 'occurrence': {
          qQ.KeyConditionExpression += ' and event_key = :rP';
          let rParts = rV.split('#');
          qQ.ExpressionAttributeValues[':rP'] = `${rParts[0]}#${rParts[1]}`;
          break;
        }
        case 'structure': {
          qQ.KeyConditionExpression += ' and begins_with(event_key, :rP)';
          qQ.ExpressionAttributeValues[':rP'] = rV;
          returnValueIfNotFound = [];
          break;
        }
        case 'slot':
        case 'exact':
        default: {
          qQ.KeyConditionExpression += ' and event_key = :rP';
          qQ.ExpressionAttributeValues[':rP'] = rV;
          break;
        }
      }
    }
  }
  else if (rP) {
    qQ.IndexName = 'sign_up-index';
    qQ.KeyConditionExpression = 'schedule_key = :s and begins_with(list_key, :rP)';
    qQ.ExpressionAttributeValues = { ':rP': `${rP}#`, ':s': 'slot_data' };
    returnValueIfNotFound = [];
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
    if (qR.Items.length === 1) { return qR.Items[0]; }
    else {
      // return the list of calendar entries sorted by date in event key (most recent first)
      return qR.Items.sort((a, b) => {
        if ((a.event_key.split(/#(.*)/)[1] || null) > (b.event_key.split(/#(.*)/)[1] || null)) { return -1; }
        else { return 1; }
      });
    }
  }
  else {
    if ((rT !== 'occurrence') || (!create_occ)) { return returnValueIfNotFound; }
    // occurrence not found... 
    // asked to create the entry if not found(create_occ = true), so...
    return await validateOccurrence(rC, rV, rO, true);  // will not create if it is an invalid occurrence
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
  let event_id, event_occurrence;
  if (typeof (request.event) === 'string') {
    [event_id, event_occurrence] = request.event.split('#');
    eventRec = await getCalendarEntries({ client: request.client, event: `${event_id}`, type: 'event' });
    if (!event_occurrence) { event_occurrence = request.occurrence; }
    occRec = await getCalendarEntries({ client: request.client, event: `${event_id}#${event_occurrence}`, type: 'occurrence' });
  }
  else {
    if (typeof (request.event) === 'object') { eventRec = request.event; }
    if (typeof (request.occurrence) === 'object') { occRec = request.occurrence; }
    else {
      occRec = await getCalendarEntries({ client: request.client, event: `${eventRec.event_id}#${request.occurrence}`, type: 'occurrence' });
    }
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
  let slotRecs = await getCalendarEntries({ client: request.client, event: `${occRec.event_key}`, type: 'structure' });
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
    eventRec = await getCalendarEntries({ client: request.client, event: event_id, type: 'event' });
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
    }
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
  let [event_id, occ_id] = body.event.split('#');
  let occurrence = body.occurrence_date || occ_id;
  if (!body.slot && body.id) { body.slot = body.id; }
  let event_key = `${event_id}#${occurrence}#${body.slot}`
  let slotRec = await getCalendarEntries({ client: body.client, event: `${event_key}`, type: 'slot' });
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
  if (eventRec.eventData.messaging) {
    let messageList = [];
    let msgObject = {
      client: eventRec.client,
      author: 'AVA'
    };
    body.client = eventRec.client;
    body.person = eventRec.owner;
    body.onBehalfOf = slotDataObj.name;
    body = Object.assign(body, eventRec.eventData.event_data, slotDataObj)
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