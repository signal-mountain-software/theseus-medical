import { clt, cl, recordExists, dbClient, makeArray, deepCopy } from '../util/AVAUtilities';
import { getActivity } from '../util/AVAObservations';
import { getPerson, makeName } from '../util/AVAPeople';
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
  let sortInstructions = {};
  if (body.sort) {
    sortInstructions = deepCopy(body.sort);
    delete body.sort;
  }
  if (body.filter) { Object.assign(body, body.filter); };
  let rP = body.person_id || body.person || body.requestor;
  let rT = body.request_type;
  let qQ = { TableName: 'ServiceRequests' };
  if (body.request_id) {
    qQ.KeyConditionExpression = 'client_id = :c and request_id = :r';
    qQ.ExpressionAttributeValues = { ':c': body.client_id, ':r': body.request_id };
  }
  else if (body.local_key) {
    qQ.IndexName = 'local_key-index';
    qQ.KeyConditionExpression = 'client_id = :c and local_key = :lK';
    qQ.ExpressionAttributeValues = { ':c': body.client_id, ':lK': body.local_key };
  }
  else if (body.foreign_key) {
    qQ.IndexName = 'foreign_key-index';
    qQ.KeyConditionExpression = 'client_id = :c and foreign_key = :fK';
    qQ.ExpressionAttributeValues = { ':c': body.client_id, ':fK': body.foreign_key };
    if (rT) {
      let rTarray = makeArray(rT);
      qQ.FilterExpression = '(request_type = :t';
      qQ.ExpressionAttributeValues[':t'] = rTarray[0];
      if (rTarray.length > 1) {
        for (let x = 1; x < rTarray.length; x++) {
          qQ.FilterExpression += ` or request_type = :t${x}`;
          qQ.ExpressionAttributeValues[`:t${x}`] = rTarray[x];
        };
      }
      qQ.FilterExpression += ')';
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
      let rTarray = makeArray(rT);
      if (rTarray.length === 1) {
        qQ.KeyConditionExpression += ' and request_type = :rT';
        qQ.ExpressionAttributeValues[':rT'] = rTarray[0];
      }
    }
  }
  else if (rT) {
    qQ.IndexName = 'last_update-index';
    qQ.KeyConditionExpression = 'client_id = :c';
    qQ.Limit = 500;
    qQ.ScanIndexForward = false;
    let rTarray = makeArray(rT);
    if (rTarray.length === 1) {
      qQ.FilterExpression = 'request_type = :rT';
      qQ.ExpressionAttributeValues = { ':c': body.client_id, ':rT': rTarray[0] };
    }
    else {
      qQ.FilterExpression = '(request_type = :t';
      qQ.ExpressionAttributeValues = { ':c': body.client_id, ':t': rTarray[0] };
      if (rTarray.length > 1) {
        for (let x = 1; x < rTarray.length; x++) {
          qQ.FilterExpression += ` or request_type = :t${x}`;
          qQ.ExpressionAttributeValues[`:t${x}`] = rTarray[x];
        };
      }
      qQ.FilterExpression += ')';
    }
  }
  let loopCount = 0;
  let unSortedList = [];
  do {
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
      unSortedList = unSortedList.concat(qR.Items);
    }
    qQ.ExclusiveStartKey = qR.LastEvaluatedKey;
    loopCount++;
  } while (qQ.ExclusiveStartKey && (loopCount < 10) && (unSortedList.length < body.limit));
  if (sortInstructions.hasOwnProperty('sort') && !sortInstructions.sort) {
    return unSortedList;
  }
  if (!sortInstructions.hasOwnProperty('key')) {
    sortInstructions.key = 'request_date';
  }
  let sort_order = 1;
  if (sortInstructions.hasOwnProperty('order') && (sortInstructions.order.toLowerCase().slice(0, 4) === 'desc')) {
    sort_order = -1;
  }
  return unSortedList.sort((a, b) => {
    a.sort = a[sortInstructions.key] || Number(a.request_id.split(/~/g).pop());
    b.sort = b[sortInstructions.key] || Number(b.request_id.split(/~/g).pop());
    if (a.sort > b.sort) { return -1 * sort_order; }
    if (a.sort < b.sort) { return sort_order; }
    return 0;
  });
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
              activity_key
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
    "activity_key": body.activity_key,
    "original_request": body.request,
    "history": historyArray,
    "local_key": body.local_key,
    "foreign_key": body.foreign_key || '',
    "last_update": body.update_time || now,
    "last_status": body.requestStatus || 'submitted',
    "last_note": body.notes
  };
  if (body.attachments && (body.attachments.length > 0)) {
    serviceRequestRec.attachments = body.attachments.map(a => { return a.Location; });
  }
  if (body.messaging) {
    let preparedMessages = await prepareMessage(body, serviceRequestRec);
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
        let sendResults = (await sendMessages(preparedMessages)).pop();   // send all the messages in the queue.  THe service request status will reflect the results of the last message (pop)
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
  serviceRequestRec.composite_key = '';
  if (serviceRequestRec.foreign_key !== '') {
    serviceRequestRec.composite_key = serviceRequestRec.foreign_key + '%';
  }
  serviceRequestRec.composite_key += `${serviceRequestRec.request_type}%${serviceRequestRec.last_status}`;
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
  let requestLogRec = {
    "client_id": serviceRequestRec.client_id,
    "log_time": serviceRequestRec.last_update,
    "activity": serviceRequestRec.history[0].replace(makeDate(serviceRequestRec.last_update).oaDate, '##'),
    "request_id": serviceRequestRec.request_id,
    "person": await makeName(serviceRequestRec.requestor),
    "requestor": serviceRequestRec.requestor,
    "request_type": serviceRequestRec.request_type
  };
  await dbClient
    .put({
      Item: requestLogRec,
      TableName: "ServiceRequestLog"
    })
    .promise()
    .catch(error => {
      clt({ 'Bad put to ServiceRequestLog - caught error is': error });
      goodWrite = false;
    });
  return {
    'request_id': serviceRequestRec.request_id,
    'requestRec': serviceRequestRec,
    'body': body,
    'message': (goodWrite ? `${body.requestType} request ${serviceRequestRec.request_id} added (${body.author} for ${serviceRequestRec.on_behalf_of})` : 'Request not added')
  };
}

export async function printServiceRequest(serviceRequestRecsIn, options = {}) {
  let requestsIn = [];
  let requestList = [];
  if (Array.isArray(serviceRequestRecsIn)) { requestsIn.push(...serviceRequestRecsIn); }
  else { requestsIn.push(serviceRequestRecsIn); }
  let remembered_customizationsRec;
  let remembered_activityRec = {};
  for (let r = 0; r < requestsIn.length; r++) {
    let serviceRequestRec = requestsIn[r];
    if (!remembered_customizationsRec) {
      remembered_customizationsRec = await dbClient
        .get({
          Key: { client_id: serviceRequestRec.client_id, custom_key: 'service_request_types' },
          TableName: "Customizations"
        })
        .promise()
        .catch(error => { cl(`***ERR reading Customizations*** caught error is: ${error}`); });
    }
    if (recordExists(remembered_customizationsRec)) {
      serviceRequestRec.activity_key = remembered_customizationsRec.Item.customization_value[serviceRequestRec.request_type].activity_code;
    }
    if (!remembered_activityRec.hasOwnProperty(serviceRequestRec.activity_key) || !remembered_activityRec[serviceRequestRec.activity_key]) {
      remembered_activityRec[serviceRequestRec.activity_key] = await getActivity(serviceRequestRec.client_id, serviceRequestRec.activity_key);
    }
    let activityRec = remembered_activityRec[serviceRequestRec.activity_key];
    if (!(activityRec.hasOwnProperty('activity_code'))) {
      return {
        'success': false,
        'message': `AVA could not find enough information for this request (key=${serviceRequestRec.activity_key})`
      };
    }
    let body = Object.assign({}, activityRec, serviceRequestRec, serviceRequestRec.original_request);
    if (body.messaging) {
      requestList.push(Object.assign({}, body, options));
    }
  }
  if (requestList.length > 1) {
    requestList.forEach((r, x) => {
      requestList[x].multiPrint = {
        firstDoc: (x === 0),
        lastDoc: (x === (requestList.length - 1))
      };
    });
  }
  let success = true;
  if (requestList.length > 0) {
    let preparedMessages = await prepareMessage(requestList);
    if (preparedMessages.length > 0) {
      preparedMessages.forEach((m, x) => { preparedMessages[x].thread_id = `svc_${requestList[x].requestType}/${requestList[x].requestID}`; });
      return {
        success,
        preparedMessages,   // ***** RAY ***** this is where we could merge output to a single document for later printing
        'message': `Job complete! (${requestList.length} request${(requestList.length > 1) ? 's' : ''} prepared to print.)`
      };
    };
  }
  return {
    'success': false,
    'message': `Nothing to print`
  };
}

export async function updateServiceRequest(body) {
  // body is a single, or an array of, service request records
  let unProcessed = [];
  let logRec = [];
  if (Array.isArray(body)) {
    for (let x = 0; x < body.length; x++) {
      let r = body[x];
      unProcessed.push({
        "PutRequest": {
          "Item": r
        }
      });
      logRec.push({
        "PutRequest": {
          "Item": {
            "client_id": r.client_id,
            "log_time": r.last_update + x,
            "activity": r.history[0].replace(makeDate(r.last_update).oaDate, '##'),
            "request_id": r.request_id,
            "person": await makeName(r.requestor),
            "requestor": r.requestor,
            "request_type": r.request_type
          }
        }
      });
    };
  }
  else {
    unProcessed[0] = {
      "PutRequest": {
        "Item": body
      }
    };
    logRec[0] = {
      "PutRequest": {
        "Item": {
          "client_id": body.client_id,
          "log_time": body.last_update,
          "activity": body.history[0].replace(makeDate(body.last_update).oaDate, '##'),
          "request_id": body.request_id,
          "person": await makeName(body.requestor),
          "requestor": body.requestor,
          "request_type": body.request_type
        }
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
          'ServiceRequests': unProcessed,
          'ServiceRequestLog': logRec
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

