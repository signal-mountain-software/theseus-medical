import { clt, cl, getPerson, recordExists } from './AVAUtilities';

const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

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
  let rP = body.person_id || body.person || body.filter.person_id || body.filter.person;
  let rT = body.request_type || body.filter.request_type;
  let qQ = { TableName: 'ServiceRequests' }
  if (rP) {
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
      console.log({ 'Error reading ServiceRequests by Person': error });
    });
  if (recordExists(qR)) {
    return qR.Items.sort((a, b) => {
      if (a.last_update > b.last_update) { return -1; }
      if (a.last_update < b.last_update) { return 1; }
      return 0;
    });
  }
  else { return []; }
}

export async function putServiceRequest(body) {
  /* request is an object with...
          body: {
              client: <string> (required),
              author: <user ID> (required)
              requestType: <string> (required)
              [requestDate: <timestamp>] (optional - defaults to currentTime),
              [onBehalfOf: <string>] (optional - defaults to author's name)
              request: <object> (required)
      };
  */
  let now = new Date().getTime();
  if (!body.requestDate) { body.requestDate = now; };
  body.$Date = body.requestDate.toString();
  let serviceRequestRec = {
    "client_id": body.client,
    "request_id": `${body.author}~${body.$Date}`,
    "requestor": body.author,
    "on_behalf_of": body.onBehalfOf || getPerson(body.author, 'name'),
    "request_type": body.requestType,
    "request_date": body.requestDate,
    "original_request": body.request,
    "local_key": body.localKey || `${body.$Date.substr(2, 4)}-${body.$Date.substr(6, 4)}`,
    "foreign_key": body.foreignKey || '*tbd*',
    "last_update": now,
    "last_status": 'Submitted',
    "last_note": null
  };
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

