import { clt, cl, recordExists } from './AVAUtilities';

const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

// Functions

export async function getCalendarEntries(body) {
  let rP = body.person_id || body.person || body.filter?.person_id || body.filter?.person;
  let rV = body.event_id || body.event || body.filter?.event_id || body.filter?.event;
  let rT = body.type || body.filter?.type;  // 'event', 'occurrence', 'slot', 'all', 'exact', 'structure'
  let qQ = { TableName: 'Calendar' };
  if (rV) {
    qQ.KeyConditionExpression = 'client = :c';
    qQ.ExpressionAttributeValues = { ':c': body.client_id };
    if (rT) {
      switch (rT) {
        case 'all': {
          qQ.KeyConditionExpression += ' and begins_with(event_key, :rP)';
          qQ.ExpressionAttributeValues[':rP'] = `${rV.split('#')[0]}#`;
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
      // sort by date in event key (most recent first)
      return qR.Items.sort((a, b) => {
        if ((a.event_key.split(/#(.*)/)[1] || null) > (b.event_key.split(/#(.*)/)[1] || null)) { return -1; }
        else { return 1; }
      });
    }
  }
  else { return []; }
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

