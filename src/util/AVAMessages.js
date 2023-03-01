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

export async function prepareMessage(body) {
  body = Object.assign(body, body.messaging);
  body = Object.assign(body, body.request);
  cl({ 'in prepare messages': body });
  let results = {};
  if (Array.isArray(body.recipientList)) { results.recipientList = [...body.recipientList]; }
  else { results.recipientList = [body.recipientList]; }
  results.client = body.client;
  results.author = body.author;
  results.preferred_method = body.method;
  if (!('format' in body)) { body.format = { 'type': 'factForm' }; }
  if ('subject' in body.format) { results.subject = await resolveMessageVariables(body.format.subject); }
  if ('method' in body.format) { results.preferred_method = body.format.method; }
  switch (body.format.type) {
    case 'mealOrder':
    case 'checklist':
    case 'factForm': {
      [results.htmlText, results.messageText] = await formatRequestDetails(body, body.format.type);
      break;
    }
    case 'plainText':
    default: {
      results.messageText = '%%custom_text%%' + (await resolveMessageVariables(body.format.text));
      results.htmlText = results.messageText;
    }
  }
  if ('test' in body) { await processRules(body); }
  
  results.messageText = results.messageText.replace('\n\r%%custom_text%%\n\r', '').trim();
  results.htmlText = results.htmlText.replace('%%custom_text%%', '').trim();
  
  return results;

  /**************************/

  async function resolveMessageVariables(inString) {
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
        case 'user': { workString = `${front}${body.author}${back}`; break; }
        case 'selections': {
          workString = `${front}${listFromArray(body.selections)}${back}`;
          break;
        }
        default: {
          if (variable.startsWith('value')) { variable = variable.split(':')[1]; }
          workString = `${front}${body.textInput[variable]}${back}`;
        }
      }
    }
    return workString;
  };

  async function processRules() {
    for (let b = 0; b < body.test.length; b++) {
      let t = body.test[b];
      let thenArray = [];
      let passedTest = false;
      if (body.selections && body.selections.includes(t.check) && !t.test) { passedTest = true; }
      else if ((t.check in body.textInput) && (body.textInput[t.check].toLowerCase().includes(t.test.toLowerCase()))) { passedTest = true; }
      else if (await resolveMessageVariables(t.check) === t.test) { passedTest = true; }
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
            if (Array.isArray(rule.value)) { results.recipientList = [...rule.value]; }
            else { results.recipientList = [rule.value]; }
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
            let custom_text = await resolveMessageVariables(rule.value);
            results.messageText = results.messageText.replace('%%custom_text%%', custom_text );
            results.htmlText = results.htmlText.replace('%%custom_text%%', custom_text );
            break;
          }
          default: { }
        }
      }
    }
  };

}

async function formatRequestDetails(body, summaryType) {

  let htmlMessage = `<h1 style="color: #5e9ca0;"><span style="color: #000000;">`
    + body.activityName
    + '</span></h1>';
  let rawMessage = `${body.activityName}\n\r`;

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
        let tOut = listFromArray(body.qualifiers[aVal][qual]);
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