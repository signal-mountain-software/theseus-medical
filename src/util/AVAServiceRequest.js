import { clt, cl, recordExists, getCustomizations, dbClient, makeArray, deepCopy, isObject } from '../util/AVAUtilities';
import { getActivity } from '../util/AVAObservations';
import { getPerson, makeName } from '../util/AVAPeople';
import { makeDate } from '../util/AVADateTime';
import { prepareMessage, sendMessages, resolveMessageVariables, messageHistory } from '../util/AVAMessages';

// Functions

export function putServiceRequest_nonAsync(body) {
  const goFunction = async () => {
    return await putServiceRequest(...arguments);
  };
  let returnArray = goFunction();
  return returnArray;
}

export async function getServiceRequests(body) {
  /*
    --- body can contain a sort key; if present, sortInstructions is prepared and results sorted per these instructions 
    sort: <string> OR object in the form {
        sort: true
        order: 'asc' or 'des' 
        key: the field in the ServiceRequest record on which to sort
      }
    --- The following keys can be in the request body itself OR in a body.filter object
    request_id: <highest priority  
    person_id OR person OR requestor: select only records where requestor = person_id

    }
  */
  let sortInstructions = {
    sort: false
  };
  if (body.sort) {
    if (isObject(body.sort)) {
      // if body.sort is an object, use its keys
      sortInstructions = deepCopy(body.sort);
    }
    else {
      // if body.sort is not an object, assume it's a string
      // use the string as the "order" key's value if the first 3 characters are 'asc' or 'des'
      // otherwise, use the string as the "key" key's value
      let checkSort = body.sort.toLowerCase().slice(0, 3);
      if (['asc', 'des'].includes(checkSort)) {
        sortInstructions.order = checkSort;
      }
      else {
        sortInstructions.key = body.sort;
      }
    }
    sortInstructions.sort = true;
    if (!sortInstructions.hasOwnProperty('order')) {   // default is no sort order is present
      sortInstructions.order = 'des';
    }
    if (!sortInstructions.hasOwnProperty('key')) {   // default is no key is present
      sortInstructions.key = 'request_date';
    }
  }

  if (body.filter) { Object.assign(body, body.filter); };
  let rP = body.person_id || body.person || body.requestor;
  let rT;
  if (body.request_type) {
    if (Array.isArray(body.request_type) && (body.request_type.length === 0)) {}
    else {
      rT = body.request_type;
    }
  }
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
  else if (body.assigned_to) {
    qQ.IndexName = 'assigned_to-index';
    qQ.KeyConditionExpression = 'client_id = :c and assigned_to = :rA';
    qQ.ExpressionAttributeValues = { ':c': body.client_id, ':rA': body.assigned_to };
    if (rT) {
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
  } while (qQ.ExclusiveStartKey && (loopCount < 10) && (unSortedList.length < (body.limit || 100)));
  if (!sortInstructions.sort) {
    return unSortedList;
  }
  let sort_order = 1;
  if (sortInstructions.order.startsWith('des')) {
    sort_order = -1;
  }
  return unSortedList.sort((a, b) => {
    a.sort = a[sortInstructions.key] || Number(a.request_id.split(/~/g).pop());
    b.sort = b[sortInstructions.key] || Number(b.request_id.split(/~/g).pop());
    if (a.sort < b.sort) { return -1 * sort_order; }
    if (a.sort > b.sort) { return sort_order; }
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
    "assigned_to": body.assigned_to || body.assign_to || 'unassigned',
    "foreign_key": body.foreign_key || '',
    "last_update": body.update_time || now,
    "type_date": `${body.requestType}~${body.update_time || now}`,
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
    "activity": serviceRequestRec.history[0],
    "assigned_to": serviceRequestRec.assigned_to,
    "last_status": serviceRequestRec.last_status,
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
    if (!serviceRequestRec.activity_key) {
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
      requestList[x].overrideMethod = 'print';
    });
  }
  let success = true;
  if (requestList.length > 0) {
    let preparedMessages = await prepareMessage(requestList);
    if (preparedMessages.length > 0) {
      preparedMessages.forEach((m, x) => { preparedMessages[x].thread_id = `svc_${requestList[0].request_type || requestList[0].requestType}/${requestList[0].request_id || requestList[0].requestID}`; });
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
  let x = 0;
  for (let r of makeArray(body)) {
    unProcessed.push({
      "PutRequest": {
        "Item": r
      }
    });
    logRec.push({
      "PutRequest": {
        "Item": {
          "client_id": r.client_id,
          "log_time": r.last_update + x++,
          "activity": r.history[0],
          "assigned_to": r.assigned_to,
          "last_status": r.last_status,
          "request_id": r.request_id,
          "person": await makeName(r.requestor),
          "requestor": r.requestor,
          "request_type": r.request_type,
          "last_visited": r.last_visited
        }
      }
    });
  };
  let initialCount = unProcessed.length;
  let finalCount = 0;
  let retryNeeded;
  let retryCount = 0;
  do {
    let this_Request_group = [];
    let this_Log_group = [];
    let failedItems = [];
    let r;
    for (r = 0; ((r < unProcessed.length) && (r < 10)); r++) {
      this_Request_group.push(unProcessed[r]);
      this_Log_group.push(logRec[r]);
    }
    unProcessed.splice(0, r);
    logRec.splice(0, r);
    retryNeeded = false;
    finalCount += r;
    let requestObject = {
      RequestItems: {
        'ServiceRequests': this_Request_group,
        'ServiceRequestLog': this_Log_group
      }
    };  
    let goodWrite = true;
    let writeResponse = await dbClient
      .batchWrite(requestObject)
      .promise()
      .catch(error => {
        clt({ 'Bad batch write on ServiceRequests - caught error is': error });
        this_Request_group.forEach(k => {
          clt(`request_id = ${k.PutRequest.Item.request_id}`);
        })
        this_Log_group.forEach(k => {
          clt(`log_time = ${k.PutRequest.Item.log_time}`);
        })
        goodWrite = false;
      });
    if (writeResponse
      && ('UnprocessedItems' in writeResponse)
      && (Object.keys(writeResponse.UnprocessedItems)).length > 0) {
      failedItems.push(...writeResponse.UnprocessedItems);
      finalCount -= writeResponse.UnprocessedItems.length / 2;
      retryNeeded = true;
    }
    if (!goodWrite) {
      finalCount -= r;
    }
    if (unProcessed.length > 0) {
      retryNeeded = true;
    }
    if (retryNeeded) {
      retryCount++;
    }
  } while (retryNeeded && (retryCount < 5));
  let returnMessage = '';
  if (finalCount >= initialCount) {
    returnMessage = `Successfully updated ${initialCount} Request record${(initialCount > 1) ? 's' : ''}`;
  }
  else if (finalCount <= 0) {
    returnMessage = `Failed to update Request record${(initialCount > 1) ? 's' : ''}`;
  }
  else {
    returnMessage = `Updated ${finalCount} of ${initialCount} Request records`;
  }
  return returnMessage;
}

export function formatServiceRequestDetails(pInput) {
  let this_request;
  /*  
  TAKES INPUT IN THIS FORMAT
  { 
    selections: [
      <string>  of the form "selection (choice, choice, ...)"
    ], 
    qualifiers: {
      <selection_words>: {
        <option_words>: [
          <choice_words>,
          <choice_words>,
          ...
        ],
        ...
      },
      ...
    },
    textInput: {
      <selection_words>: <text string>
    },     
    options: {
      <selection_words>: {
          <option_words>: [
            <choice_words> : <boolean> or <string_value>,
            ...
          ],
          ...
        }
      }
    }
  }

  AND PRODUCES OUTPUT AS
  {
    selection: [
      option1,
      option2,
      ...
    ],
    ...
  }
  */
  if (pInput.hasOwnProperty('request_id')) {  // passed in pInput as an entire ServiceRequest record
    this_request = pInput.original_request;
  }
  else if (pInput.hasOwnProperty('rowDetails')) {
    /*
    rowDetails[
      {
        text: <string>  (the actual selection text, such as "Chopped Steak" or "Pancake Platter")
        isChecked: <boolean>,
        qualSelections: {
          option: {
            choice: <boolean> or <string>
          }
        },
        textValue: <string>
      }, ...
    ],
    */
    this_request = {
      selections: [],
      options: {},
      textInput: {}
    };
    pInput.rowDetails.forEach(row => {
      if (row.isChecked || row.textValue) {
        let selection = row.text.trim();
        this_request.selections.push(selection);
        this_request.options[selection] = row.qualSelections;
        this_request.textInput[selection] = row.textValue;
      }
    });
  }
  else {
    this_request = pInput;
  }
  let requestDetailsObj = {};
  if (this_request.selections) {
    this_request.selections.forEach(s => {
      let selection = s;
      let choices = [];
      let qualifiers = [];
      if (!this_request.textInput[s]) {
        let unTrimmed_selection;
        [unTrimmed_selection, ...choices] = s.split(/[();,]/);
        selection = unTrimmed_selection.trim();
      }
      if (this_request.qualifiers?.[selection]) {
        Object.values(this_request.qualifiers?.[selection]).forEach(v => {
          qualifiers.push(...v);
        });
      };
      for (let this_option in this_request.options?.[selection]) {
        for (let this_choice in this_request.options?.[selection][this_option]) {
          if (typeof (this_request.options?.[selection][this_option][this_choice]) === 'boolean') {
            if (this_request.options?.[selection][this_option][this_choice]) {
              qualifiers.push(this_choice);
            }
          }
          else {
            qualifiers.push(this_request.options?.[selection][this_option][this_choice]);
          }
        };
      }
      let options = [];
      (choices.concat(qualifiers)).forEach(e => {
        if (e && !options.includes(e.trim())) {
          options.push(e.trim());
          return;
        }
      });
      requestDetailsObj[selection] = options;

    });
  }
  for (let selection in this_request.textInput) {
    if (this_request.textInput[selection]) {
      if (!requestDetailsObj[selection]) {
        requestDetailsObj[selection] = [];
      };
      requestDetailsObj[selection].push(this_request.textInput[selection]);
    }
  }
  return requestDetailsObj;
}

export async function formatServiceRequest(inboundRequest) {
  let requestList = [];
  if (Array.isArray(inboundRequest)) {
    requestList.push(...inboundRequest);
  }
  else {
    requestList = [inboundRequest];
  }
  let final_result = [];

  for (let rN = 0; rN < requestList.length; rN++) {
    let this_request = requestList[rN];
    let result = {
      print: {
        data: {},
        format: [],
        job: []
      },
      message_history: []
    };
    /*
    result: {
      error: <boolean>,
      print: {
        data: {
          title: 
          client_name:
          logo:
          creator_id:
          creator_name:
          request_person_name:
          request_person_id:
          request_person_rec:
          created_time: <makeDate object format>
          onBehalfOf_name
          requestDetails: {
            selection: [
              option,
              ...
            ],
            ...
          }
          request_id
        },
        format: [<AVA format>, ...]      
      },
      message_history: [
        {
          thread_id:        
          recipients: [<result for this recipient>, ...]
        },
        ...
      ],
      request_status: {
        current:
        history: [<text line>, ...]
      }
    }
    */

    // what we find inside this_request could be a string, an array of stuff, or an object
    if (this_request.original_request || this_request.history || this_request.messages) {
      // assume that a good SR record was passed in
    }
    else if (this_request.rowDetails) {
      // assume that a SR under construction was passed in and let it build (if possible) from the data passed in
    }
    else {
      // assume that the args provided a reference to one or more SRs
      let returnedRequests = await getServiceRequests({
        client_id: this_request.client,
        request_id: this_request.requestID
      });
      if (returnedRequests.length === 0) {
        return { error: true };
      }
      else if (returnedRequests.length === 1) {
        this_request = deepCopy(returnedRequests[0]);
      }
      else {
        requestList.splice(rN, 1, ...returnedRequests);
        this_request = deepCopy(returnedRequests[0]);
      }
    }

    let sessionObject = JSON.parse(sessionStorage.getItem('AVASessionData'));
    if (!this_request.client_id && !this_request.client) {
      this_request.client_id = sessionObject?.currentSession?.client_id;
      this_request.client = sessionObject?.currentSession?.client_id;
    }
    if (this_request.request_type && !this_request.requestTypeRec) {
      this_request.requestTypeRec =
        await getCustomizations(
          'service_request_types',
          this_request.client_id).customization_value?.[this_request.request_type];
    }
    if (!this_request.activityRec) {
      this_request.activityRec =
        await getActivity(
          this_request.client_id || this_request.client,
          (this_request.activity_key || this_request.activity_id || this_request.requestTypeRec?.activity_code));
    }

    result.print.data.request_id = this_request.request_id;

    result.print.data.title = this_request.title
      || this_request.pdf?.title
      || this_request.subject
      || this_request.format?.subject
      || this_request.requestTypeRec?.description
      || this_request.activityRec?.name
      || 'AVA Senior Living';
    result.print.data.title = (await resolveMessageVariables(result.print.data.title, this_request)).replace(/\(.+\)/g, '').trim();

    if (this_request.reprint) {
      result.print.data.title = `*** REPRINT ${result.print.data.title} ***`;
    };

    result.print.data.client_id = this_request.client_id;

    result.print.data.client_name = this_request.client_name
      || sessionObject?.currentSession?.client_name
      || `Client ${this_request.client_id}`;

    result.print.data.logo = this_request.client_logo
      || this_request.logo
      || sessionObject.currentSession?.client_logo
      || await getCustomizations('logo', this_request.client_id)?.icon;

    result.print.data.created = {};

    result.print.data.creator_id =
      (this_request.request_id ? this_request.request_id.split('~').shift() : null)
      || this_request.user_id
      || this_request.userID
      || this_request.requestor
      || this_request.session.user_id
      || sessionObject?.currentSession?.user_id;

    result.print.data.creator_name = this_request.author_name
      || this_request.user_name
      || this_request.userName
      || await makeName(result.print.data.creator_id);

    result.print.data.request_person_id = this_request.requestor
      || this_request.patient_id
      || this_request.patientID
      || this_request.session.patient_id
      || sessionObject?.currentSession?.patient_id;

    result.print.data.request_person_rec = await getPerson(result.print.data.request_person_id);
    result.print.data.request_person_name =
      await makeName(result.print.data.request_person_rec);

    result.print.data.created_time = makeDate(this_request.request_date);

    result.print.data.onBehalfOf_name = this_request.on_behalf_of
      || this_request.onBehalfOf;

    if (!result.print.data.onBehalfOf_name) {
      this_request.obo_key = this_request?.activityRec?.default_value?.onBehalfOf
        || this_request?.activityRec?.default_value?.global_defaults?.onBehalfOf
        || this_request?.activityRec?.default_value?.activities?.global_defaults?.onBehalfOf;
      result.print.data.onBehalfOf_name = this_request?.original_request?.textInput?.[this_request.obo_key];
      if (!result.print.data.onBehalfOf_name && this_request.rowDetails) {
        this_request.rowDetails.forEach(row => {
          if (row.isChecked && (row.text.trim() === this_request.obo_key)) {
            result.print.data.onBehalfOf_name = row.textValue;
          }
        });
      }
      else {
        result.print.data.onBehalfOf_name = result.print.data.request_person_name;
      };
    }

    result.print.data.requestDetails = formatServiceRequestDetails(this_request);

    result.print.format = [];
    makeArray(this_request.activityRec.messaging).forEach(m => {
      if (!result.print.format.includes(m.format.type)) {
        result.print.format.push(m.format.type);
      }
    });

    for (let m = 0; m < this_request.messages.length; m++) {
      if (this_request.messages[m].record_type === 'delivery') {
        result.message_history.push({
          thread_id: this_request.messages[m].thread_id,
          recipients: await messageHistory(this_request.messages[m])
        });
      }
    }

    result.request_status = {
      current: this_request.last_status,
      history: this_request.history
    };

    final_result.push(result);
  }
  return final_result;
}