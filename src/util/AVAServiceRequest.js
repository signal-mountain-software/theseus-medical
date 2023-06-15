import { clt, cl, recordExists, dbClient } from '../util/AVAUtilities';
import { getPerson } from '../util/AVAPeople';
import { makeDate } from '../util/AVADateTime';
import { prepareMessage, sendMessages } from '../util/AVAMessages';

// Functions

export function putServiceRequest_nonAsync(body) {
  const goFunction = async () => {
    returnArray = await putServiceRequest(...arguments);
  };
  let returnArray = [];
  goFunction();
  return returnArray;
}

export async function getServiceRequests(body) {
  if (body.filter) { Object.assign(body, body.filter); };
  let rP = body.person_id || body.person || body.requestor;
  let rT = body.request_type;
  let qQ = { TableName: 'ServiceRequests' };
  if (body.local_key) {
    qQ.IndexName = 'local_key-index';
    qQ.KeyConditionExpression = 'client_id = :c and local_key = :lK';
    qQ.ExpressionAttributeValues = { ':c': body.client_id, ':lK': body.local_key };
  }
  else if (body.foreign_key) {
    qQ.IndexName = 'foreign_key-index';
    qQ.KeyConditionExpression = 'client_id = :c and foreign_key = :fK';
    qQ.ExpressionAttributeValues = { ':c': body.client_id, ':fK': body.foreign_key };
    if (rT) {
      qQ.FilterExpression = 'request_type = :t';
      qQ.ExpressionAttributeValues[':t'] = rT;
      if (rP) { 
        qQ.FilterExpression += ' and requestor = :p';
        qQ.ExpressionAttributeValues[':p'] = rP;
      }
    }
    else if (rP) {
        qQ.FilterExpression += 'requestor = :p';
        qQ.ExpressionAttributeValues[':p'] = rP;
    }
  }
  else if (rP) {
    qQ.IndexName = 'requestor-type-index';
    qQ.KeyConditionExpression = 'requestor = :rP';
    qQ.ExpressionAttributeValues = { ':rP': rP };
    if (rT) {
      qQ.KeyConditionExpression += ' and request_type = :rT';
      qQ.ExpressionAttributeValues[':rT'] = rT;
    }
  }
  else if (rT) {
    qQ.IndexName = 'request_type-index';
    qQ.KeyConditionExpression = 'client_id = :c and request_type = :rT';
    qQ.ExpressionAttributeValues = { ':c': body.client_id, ':rT': rT };
  }

  let qR = await dbClient
    .query(qQ)
    .promise()
    .catch(error => {
      if (error.code === 'NetworkingError') {
        console.log(`Security Violation or no Internet Connection`);
      }
      console.log({ 'Error reading ServiceRequests': error, index: qQ.IndexName, qQ });
    });
  if (recordExists(qR)) {
    return qR.Items.sort((a, b) => {
      a.sort = a.request_date || Number(a.request_id.split(/~/g).pop());
      b.sort = b.request_date || Number(b.request_id.split(/~/g).pop());
      if (a.sort > b.sort) { return -1; }
      if (a.sort < b.sort) { return 1; }
      return 0;
    });
  }
  else { return []; }
}

export async function putServiceRequest(body) {
  /* request is an object with...
          body: {
              client: <string> (required),
              author: <user ID> (required),
              proxy_user: <user ID> (optional - if present, this is the actual user that created the request)
              requestType: <string> (required - maint, dining, transportation, etc....)
              requestDate: <optional timestamp - defaults to currentTime>,
              onBehalfOf: <optional - defaults to author's name>
              request: <object> (required)
              messaging: <optional messaging object>
              attachments: <optional attachments to add to the request>
              local_key: <optional AVA key>
              foreign_key: <optional external key>
              update_time: <optional, if missing set to current time>
              requestStatus: <optional - if missing defaults to 'submitted'>,
              notes: <optional text>
      };
  */
  let currentTime = makeDate(new Date());
  let now = currentTime.timestamp;
  if (!body.requestDate) { body.requestDate = now; };
  body.requestID = `${body.proxy_user || body.author}~${body.requestDate}`;
  if (!body.local_key) {
    let sDate = now.toString();
    body.local_key = sDate.slice(2, 6) + '-' + sDate.slice(6, 10);
  }
  if (!body.onBehalfOf) { body.onBehalfOf = await getPerson(body.author, 'name'); }
  let historyArray = [];
  if (body.history) {
    if (Array.isArray(body.history)) { historyArray.push(...(body.history)); }
    else { historyArray.push(body.history); }
  }
  else { historyArray.push(`Request submitted ${currentTime.oaDate}`); }
  let serviceRequestRec = {
    "client_id": body.client,
    "request_id": body.requestID,
    "requestor": body.author,
    "on_behalf_of": body.onBehalfOf,
    "request_type": body.requestType,
    "request_date": body.requestDate,
    "original_request": body.request,
    "history": historyArray,
    "local_key": body.local_key,
    "foreign_key": body.foreign_key || '*tbd*',
    "last_update": body.update_time || now,
    "last_status": body.requestStatus || 'submitted',
    "last_note": body.notes
  };
  if (body.attachments && (body.attachments.length > 0)) { 
    serviceRequestRec.attachments = body.attachments.map(a => { return a.Location; })
  }
  if (body.messaging) {
    let preparedMessages = await prepareMessage(body);
    if (preparedMessages.length > 0) {
      preparedMessages.forEach((m, x) => { preparedMessages[x].thread_id = `svc_${body.requestType}/${body.requestID}`; });
      let rTime = makeDate(new Date().getTime());
      let rMsg;
      serviceRequestRec.messages = preparedMessages;
      serviceRequestRec.last_update = rTime.timestamp;
      if (body.messaging?.format?.method === 'hold') {
        serviceRequestRec.last_status = 'Prepared & Held';
        rMsg = `Held for future processing ${rTime.oaDate}`;
      }
      else {
        let sendResults = (await sendMessages(preparedMessages)).pop();
        if (!sendResults.sent) {
          serviceRequestRec.last_status = 'Failed to send';
          rMsg = `Failed to send ${rTime.oaDate}`;
        }
        else {
          serviceRequestRec.last_status = 'Sent';
          rMsg = `Sent for processing ${rTime.oaDate}`;
        }
      }
      if (('history' in serviceRequestRec) && Array.isArray(serviceRequestRec.history)) {
        serviceRequestRec.history.unshift(rMsg);
      }
      else { serviceRequestRec.history = [rMsg]; }
    }
  }
  cl({ 'adding ServiceRequestRec as': serviceRequestRec });
  let goodWrite = true;
  await dbClient
    .put({
      Item: serviceRequestRec,
      TableName: "ServiceRequests"
    })
    .promise()
    .catch(error => {
      clt({ 'Bad put to ServiceRequests - caught error is': error });
      goodWrite = false;
    });
  return {
    'request_id': serviceRequestRec.request_id,
    'message': (goodWrite ? `${body.requestType} request ${serviceRequestRec.request_id} added (${body.author} for ${serviceRequestRec.on_behalf_of})` : 'Request not added')
  };
}

export async function updateServiceRequest(body) {
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

