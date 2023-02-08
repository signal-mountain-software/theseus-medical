import { clt, recordExists } from './AVAUtilities';

const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient({
    apiVersion: '2012-08-10',
    region: "us-east-1",
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY
});

// Functions

/*
export function putMessage_nonAsync(body) {
    const goFunction = async () => {
        returnArray = await putMessage(...arguments);
    };
    let returnArray = [];
    goFunction();
    return returnArray;
}
*/

export async function getMessages(body) {
    let qT = body.thread_id || body.thread;
    let qQ = {
        TableName: 'TheseusMessages',
        KeyConditionExpression: 'thread_id = :t',
        ExpressionAttributeValues: { ':t': qT }
    };
    let qR = await dbClient
        .query(qQ)
        .promise()
        .catch(error => {
            if (error.code === 'NetworkingError') {
                clt(`Security Violation or no Internet Connection`);
            }
            clt({ 'Error reading TheseusMessages': error });
        });
    if (recordExists(qR)) {
        return qR.Items;
    }
    else { return []; }
}

/*
export async function putServiceRequest(body) {
    // request is an object with...
    //        body: {
    //            client: <string> (required),
    //            author: <user ID> (required)
    //            requestType: <string> (required)
    //            [requestDate: <timestamp>] (optional - defaults to currentTime),
    //            [onBehalfOf: <string>] (optional - defaults to author's name)
    //            request: <object> (required)
    //    };
    //
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
        let returnArray = [];
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

*/