import { clt, cl, recordExists, uuid, listFromArray, sentenceCase } from './AVAUtilities';
import { getPerson, makeName } from './AVAPeople';
import { makeDate } from './AVADateTime';

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

export async function prepareMessage(inBody) {
  let messageList = [];
  if (Array.isArray(inBody.messaging)) { messageList.push(...inBody.messaging); }
  else { messageList.push(inBody.messaging); }
  let returnResults = [];
  let results;
  let requestInfo = Object.assign({}, {
    activityName: inBody.activityName,
    client: inBody.client,
    author: inBody.author,
    onBehalfOf: inBody.onBehalfOf,
    requestType: inBody.requestType,
    requestDate: inBody.requestDate,
    requestID: inBody.requestID
  },
    inBody.request);
  do {
    let this_request = Object.assign({}, requestInfo, messageList.shift());
    cl({ 'in prepare messages': { this_request } });
    results = {};
    if (Array.isArray(this_request.recipientList)) { results.recipientList = [...this_request.recipientList]; }
    else { results.recipientList = [this_request.recipientList]; }
    results.recipientList = results.recipientList.map(async (r) => {
      return await resolveMessageVariables(r, this_request);
    })
    results.client = this_request.client;
    results.author = this_request.author;
    results.preferred_method = this_request.method;
    if (!('format' in this_request)) { this_request.format = { 'type': 'factForm' }; }
    if ('subject' in this_request.format) { results.subject = await resolveMessageVariables(this_request.format.subject, this_request); }
    if ('method' in this_request.format) { results.preferred_method = this_request.format.method; }
    switch (this_request.format.type) {
      case 'mealOrder':
      case 'checklist':
      case 'factForm': {
        [results.htmlText, results.messageText] = await formatRequestDetails(this_request, this_request.format.type);
        break;
      }
      case 'plainText':
      default: {
        results.messageText = await resolveMessageVariables(this_request.format.text, this_request) + ' %%custom_text%%';
        results.htmlText = results.messageText;
      }
    }
    if ('test' in this_request) {
      let ruleStatus = await processRules(this_request);
      if (ruleStatus === 'cancel') { continue; }
    }

    results.messageText = results.messageText.replace('%%custom_text%%', '').trim();
    results.htmlText = results.htmlText.replace('%%custom_text%%', '').trim();

    returnResults.push(results);
  } while (messageList.length > 0);

  return returnResults;

  /**************************/

  async function processRules(requestToTest) {
    let skipTo = false;
    for (let b = 0; b < requestToTest.test.length; b++) {
      let t = requestToTest.test[b];
      if (skipTo) {
        if (!requestToTest.id || skipTo !== requestToTest.id) { continue; }
        else { skipTo = false; }
      }
      let thenArray = [];
      let passedTest = false;
      if (requestToTest.selections && requestToTest.selections.includes(t.check) && !t.test) { passedTest = true; }
      else if (t.check in requestToTest.textInput) {
        if (requestToTest.textInput[t.check].toLowerCase().includes(t.test.toLowerCase())) { passedTest = true; }
      }
      else if (t.test && t.check) {
        let resolved = await resolveMessageVariables(t.check, requestToTest);
        if (resolved && resolved.toLowerCase().includes(t.test.toLowerCase())) { passedTest = true; }
      }
      else { passedTest = false; }
      if (passedTest && ('then' in t)) {
        if (!Array.isArray(t.then)) { thenArray = [t.then]; }
        else { thenArray = t.then; }
      }
      else if (!passedTest && ('else' in t)) {
        if (!Array.isArray(t.else)) { thenArray = [t.else]; }
        else { thenArray = t.else; }
      }
      for (let i = 0; i < thenArray.length; i++) {
        let rule = thenArray[i];
        switch (rule.instruction) {
          case 'add_recipients': {
            if (Array.isArray(rule.value)) { results.recipientList.push(...rule.value); }
            else { results.recipientList.push(rule.value); }
            break;
          }
          case 'replace_recipients': {
            if (Array.isArray(rule.value)) {
              if (rule.value.length === 0) { results.recipientList = []; }
              else { results.recipientList = [...rule.value]; }
            }
            else {
              if (!rule.value) { results.recipientList = []; }
              else { results.recipientList = [rule.value]; }
            }
            break;
          }
          case 'remove_recipients': {
            if (Array.isArray(rule.value)) {
              rule.value.forEach(v => {
                let foundAt = results.recipientList.indexOf(v);
                if (foundAt >= 0) { results.recipientList.splice(foundAt, 1); }
              });
            }
            else {
              let foundAt = results.recipientList.indexOf(rule.value);
              if (foundAt >= 0) { results.recipientList.splice(foundAt, 1); }
            }
            break;
          }
          case 'urgency': {
            results.urgent = rule.value;
            break;
          }
          case 'override_method': {
            results.preferred_method = rule.value;
            break;
          }
          case 'add_message': {
            let custom_text = await resolveMessageVariables(rule.value, requestToTest);
            results.messageText = results.messageText.replace('%%custom_text%%', `${custom_text} %%custom_text%%`);
            results.htmlText = results.htmlText.replace('%%custom_text%%', `${custom_text} %%custom_text%%`);
            break;
          }
          case 'skip_to': {
            skipTo = rule.value;
            break;
          }
          case 'create_message': {
            messageList.push(rule.value);
            break;
          }
          case 'cancel_message': {
            return 'cancel';
          }
          default: { }
        }
      }
    }
  };

}

export async function resolveMessageVariables(inString, body) {
  // extract first variable
  let workString = inString;
  while (workString.includes('<')) {
    let [front, rest] = workString.split(/<(.*)/);
    let [variable, back] = rest.split(/>(.*)/);
    switch (variable) {
      case 'client': {
        workString = `${front}${body.client}${back}`;
        break;
      }
      case 'author': {
        workString = `${front}${await makeName(body.author)}${back}`;
        break;
      }
      case 'person':
      case 'patient':
      case 'name': {
        workString = `${front}${body.onBehalfOf || await makeName(body.author)}${back}`;
        break;
      }
      case 'activityName':
      case 'activity': {
        workString = `${front}${body.activityName}${back}`;
        break;
      }
      case 'location': {
        let pMe = await getPerson(body.author);
        workString = `${front}${pMe.location}${back}`;
        break;
      }
      case 'event_location': {
        if (body.location) { workString = `${front}${body.location}${back}`; };
        break;
      }
      case 'event_description': {
        if (body.description) { workString = `${front}${body.description}${back}`; };
        break;
      }
      case 'event_date': {
        if (body.event) { workString = `${front}${makeDate(body.event.split('#')[1]).absolute}${back}`; };
        break;
      }
      case 'person_id':
      case 'patient_id':
      case 'requestor':
      case 'self':
      case 'user': { workString = `${front}${body.author}${back}`; break; }
      case 'selections': {
        workString = `${front}${listFromArray(body.selections)}${back}`;
        break;
      }
      default: {
        if (body.hasOwnProperty(variable)) {
          workString = `${front}${body[variable]}${back}`;
        }
        else if (variable.trim().toLowerCase().startsWith('if ')) { 
          let [if$, then$] = variable.trim().slice(2).split(':');
          if (body.hasOwnProperty(if$.trim())) { workString = `${front}${then$.trim()}${back}` }
        }
        else if (body.hasOwnProperty('textInput')) {
          if (variable.startsWith('value')) { variable = variable.split(':')[1]; }
          workString = `${front}${body.textInput[variable]}${back}`;
        }
        else {
          let [dDate, dType] = variable.split(':');
          let keyDate = makeDate(dDate);
          if (!keyDate.error) { workString = `${front}${keyDate[dType || 'absolute']}${back}`; }
          else { workString = `${front}"${variable}"${back}`; }
        }
      }
    }
  }
  return workString;
};

async function formatRequestDetails(body, summaryType) {

  let titleWords = body.subject;
  if (!titleWords && body.format) { titleWords = body.format.subject; }
  if (!titleWords && body.activityName) { titleWords = body.activityName; }
  if (!titleWords) { titleWords = 'AVA Request'; }
  else { titleWords = await resolveMessageVariables(titleWords, body); }

  let htmlMessage = `<h1 style="color: #5e9ca0;"><span style="color: #000000;">${titleWords}</span></h1>`;
  let rawMessage = `${titleWords}\n\r`;

  // Person
  let pRec = await getPerson(body.author);

  let pName = body.onBehalfOf || await makeName(body.author);
  htmlMessage += `<h2 style = "color: black;" >${pName}`;
  rawMessage += `${pName}\n`;

  if (pRec.location) {
    htmlMessage += `<br />${pRec.location}`;
    rawMessage += `${pRec.location}\n`;
  }
  htmlMessage += `</h2>`;

  const pTime = makeDate(new Date().getTime()).absolute + ' by ' + await makeName(body.author);
  htmlMessage += `<p style = "color: black;">created:&nbsp;<strong>${pTime}</strong>`;
  rawMessage += `${pTime}\n\r`;

  for (let cTyp in pRec.messaging) {
    if ((cTyp in pRec) && (pRec[cTyp].trim() !== '')) {
      let cLab;
      switch (cTyp) {
        case 'sms': { cLab = 'cell'; break; }
        case 'voice': { cLab = 'home'; break; }
        case 'email': { cLab = 'e-Mail'; break; }
        default: { cLab = cTyp; }
      }
      htmlMessage += `<br />${cLab}:&nbsp;<strong>${pRec[cTyp]}</strong>&nbsp;&nbsp;${(cTyp === pRec.preferred_method) ? '(pref)' : ''}`;
    }
  }

  htmlMessage += '</p><h2 style = "color: black;" >%%custom_text%%</h2>';
  rawMessage += '\n\r%%custom_text%%\n\r';

  let spaceBetweenLines = 25;
  if (body.selections.length > 7) { spaceBetweenLines = 125 / (body.selections.length - 2); }

  let renderCheckBox = '';
  if (summaryType === 'mealOrder') {
    let pTag = '<h2 style = "color: black;" >';
    let pXTag = '';
    for (let x = 0; x < body.selections.length; x++) {
      let aVal = body.selections[x];
      if (['Dinner', 'Lunch', 'Pick-up', 'Deliver (+$5)', 'Deliver ($5)'].includes(aVal.trim())) {
        htmlMessage += pTag + aVal.trim();
        rawMessage += `${aVal}\r\n`;
        pXTag = '</h2>';
        pTag = '&nbsp;/&nbsp;';
        body.selections.splice(x, 1);
        x--;
      }
    };
    htmlMessage += `${pXTag}<h2 style = "color: black;" >Order filled by:&nbsp;_______________________</h2>`;
    rawMessage += '\n\nOrder filled by: ________________________\n\n';
    renderCheckBox = '&#8414;&nbsp;&nbsp;&nbsp;';
    htmlMessage += `<h2 style="color: black;">Order Details</h2><dl style="padding-left: 40px;">`;
  }
  else {
    if (body.textInput && (Object.keys(body.textInput).length > 0)) {
      for (let topic in body.textInput) {
        if (!body.selections.includes(topic)) {
          let sVal = sentenceCase(topic.trim());
          rawMessage += `\n${sVal}\n${body.textInput[topic]}\n`;
          htmlMessage += `<h2><span style="color: black;">${sVal}</span></h2>`;
          htmlMessage += `<div style="padding-left: 10px; margin-top: -15px; font-size: 1.2em;">${body.textInput[topic]}</div>`;
          delete body.textInput[topic];
        }
      }
    }
    if (body.selections.length > 0) {
      htmlMessage += `<h2 style="color: black;">Options Selected</h2><dl style="padding-left: 40px;">`;
    }
  }

  let lineSpacing = '0px';
  if (!body.textInput) { body.textInput = {}; }
  body.selections.forEach((aVal) => {
    let sVal = sentenceCase(aVal.trim());
    htmlMessage += `<dt style="margin-top: ${lineSpacing}; font-size: 1.2em; color: black;">${renderCheckBox}<strong>${sVal}&nbsp&nbsp&nbsp</strong>${body.textInput[aVal] || ''}</dt>`;
    rawMessage += `\n${sVal}\n`;
    if (body.textInput[aVal]) {
      rawMessage += `${body.textInput[aVal]}\n`;
      delete body.textInput[aVal];
    }
    /* Check for qualifiers */
    if ((body.qualifiers) && (body.qualifiers.hasOwnProperty(aVal))) {
      for (let qual in body.qualifiers[aVal]) {
        let tOut = listFromArray(body.qualifiers[aVal][qual]) || 'No selection';
        htmlMessage += `<dd>${sentenceCase(qual)}:&nbsp${tOut}</dd>`;
        rawMessage += `${sentenceCase(qual)}: ${tOut}\n`;
      }
    }
    lineSpacing = `${spaceBetweenLines}px`;
  });

  if (body.textInput && (Object.keys(body.textInput).length > 0)) {
    for (let topic in body.textInput) {
      let sVal = sentenceCase(topic.trim());
      htmlMessage += `<dt style="padding-top:${lineSpacing}; font-size: 1.2em; color: black;">${renderCheckBox}<strong>${sVal}&nbsp&nbsp&nbsp</strong>${body.textInput[topic]}</dt>`;
      rawMessage += `\n${sVal}\n${body.textInput[topic]}\n`;
      lineSpacing = `${spaceBetweenLines}px`;
    }
  }

  // Finish
  htmlMessage += `</dl><p style="padding-top:${(spaceBetweenLines * 1.5).toString()}px;">`;
  htmlMessage += `<div>AVA reference:&nbsp;${body.requestID}</div>`;
  htmlMessage += `<div>***** END *****</div></p>`;
  rawMessage += `\n\rAVA reference: ${body.requestID}\n***** END *****`;

  return [htmlMessage, rawMessage];
}

export async function sendMessages(body) {
  /*  Expect body as an object or array of objects with the following structure
          client: <client_id>,
          author: <from person_id>
          testMode: <boolean> (if true, everything will happen EXCEPT the message will not be put in the PostOffice - and therefore not sent)
          messageText: <text> (if present, messageTextthis will override any messageText in the values attribute)
          htmlMessageText: <text>
          recipientList: <person_id or array of person_id's list can include "GRP//<group_id>" as well>
          subject: <subject>
          preffered_method: <attempt to force this method>
          thread_id: <if present, add this message to the indicated thread; otherwise, create a new thread>    
  */
  cl({ 'in send messages': body });
  let results = [];
  let postTime = new Date().getTime();
  let toSend = [];
  let mCount = 0;
  if (Array.isArray(body)) {
    toSend = body;
    mCount = body.length;
  }
  else {
    toSend = [body];
    mCount = 1;
  }
  for (let m = 0; m < mCount; m++) {
    let env = toSend[m];
    if (!('thread_id' in env)) { env.thread_id = `${postTime}.${uuid(6)}`; }
    // clean up recipientList before proceeding
    if (!('recipientList' in env)) {  // skip this, no recipients
      results.push(`failed - no recipients specified`);
      continue;
    }
    var PostOfficeRec = {
      Item: {
        'client_id': env.client,
        'message_id': `${postTime}~AVAMessages`,
        'deliver_time': postTime,
        'patient_id': env.author,
        'from': env.author,
        'message_text': env.messageText,
        'html_message_text': env.htmlText,
        'preferred_method': env.preferred_method,
        'subject': env.subject
      },
      TableName: "PostOffice"
    };
    if (env.testMode) { PostOfficeRec.TableName = "TestPostOffice"; };
    if (!('subject' in PostOfficeRec.Item)) {
      PostOfficeRec.Item["subject"] = `Message from ${await makeName(env.author)}`;
    }
    let to = [];
    let ind = [];
    if (Array.isArray(env.recipientList)) { to = env.recipientList; }
    else to = [env.recipientList];
    for (let r = 0; r < to.length; r++) {
      if (to[r].startsWith('GRP//')) {
        let gCode = to[r].split('//')[1];
        PostOfficeRec.Item["recipient_base"] = 'group';
        PostOfficeRec.Item["recipient_key"] = gCode;
        await dbClient
          .put(PostOfficeRec)
          .promise()
          .catch(error => { console.log(`Message Engine caught error at 268 adding a Message; error is ${error}`); });
        results.push(`sent to group ${gCode}`);
      }
      else { ind.push(to[r]); }
    }
    if (ind.length > 0) {
      PostOfficeRec.Item["recipient_base"] = 'list';
      PostOfficeRec.Item["recipient_key"] = ind;
      await dbClient
        .put(PostOfficeRec)
        .promise()
        .catch(error => { cl(`Error writing to Post Office; error is ${error}`); });
      results.push(`sent ${ind.length} message${(ind.length > 1) ? 's' : ''}. To: ${ind.join(', ')}`);
    }
  }
  return results;
}