import { clt, cl, recordExists, titleCase, uuid, listFromArray, makeArray, sentenceCase, dbClient } from './AVAUtilities';
import { getPerson, makeName } from './AVAPeople';
import { getGroupsBelongTo } from './AVAGroups';
import { getServiceRequests } from './AVAServiceRequest';
import { makeDate } from './AVADateTime';

// Functions

export async function getMessages(body) {
  let qT = body.thread_id || body.thread;
  let qQ = {
    TableName: 'TheseusMessages',
    KeyConditionExpression: 'thread_id = :t',
    ExpressionAttributeValues: { ':t': qT },
    ScanIndexForward: false
  };
  if (body.hasOwnProperty('key') || body.hasOwnProperty('composite_key')) {
    qQ.KeyConditionExpression += ' AND begins_with(composite_key, :c)';
    qQ.ExpressionAttributeValues[':c'] = body.key || body.composite_key;
  }
  if (body.hasOwnProperty('type') || body.hasOwnProperty('record_type')) {
    qQ.FilterExpression = 'record_type = :y';
    qQ.ExpressionAttributeValues[':y'] = body.type || body.record_type;
  }
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
    local_key: inBody.local_key,
    requestDate: inBody.requestDate,
    requestID: inBody.requestID
  },
    inBody.request);
  if (inBody.hasOwnProperty('attachments')) {
    requestInfo.attachments = inBody.attachments.map(a => { return a.Location; });
  }
  do {
    let this_request = Object.assign({}, requestInfo, messageList.shift());
    cl({ 'in prepare messages': { this_request } });
    results = {};
    if (Array.isArray(this_request.recipientList)) { results.recipientList = [...this_request.recipientList]; }
    else { results.recipientList = [this_request.recipientList]; }
    for (let i = 0; i < results.recipientList.length; i++) {
      results.recipientList[i] = await resolveMessageVariables(results.recipientList[i], this_request);
    }
    results.client = this_request.client;
    results.author = this_request.author;
    results.preferred_method = this_request.method;
    if (!('format' in this_request)) { this_request.format = { 'type': 'factForm' }; }
    if ('subject' in this_request.format) { results.subject = this_request.format.subject }
    if ('method' in this_request.format) { results.preferred_method = this_request.format.method; }
    switch (this_request.format.type) {
      case 'mealOrder':
      case 'checklist':
      case 'factForm': {
        [results.htmlText, results.messageText] = await formatRequestDetails(this_request, this_request.format.type);
        break;
      }
      case 'mealTicket': {
        [results.htmlText, results.messageText] = await mealTicketFormat(this_request);
        break;
      }
      case 'inBody': {
        results.htmlText = inBody.htmlText;
        results.messageText = inBody.messageText;
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
    if (results.subject) {
      results.subject = await resolveMessageVariables(results.subject, this_request);
    }
    results.messageText = results.messageText.replace('%%custom_text%%', '').trim();
    results.htmlText = results.htmlText.replace('%%custom_text%%', '').trim();

    if (requestInfo.hasOwnProperty('attachments')) {
      results.htmlText += '<br>';
      // eslint-disable-next-line
      requestInfo.attachments.forEach((a, x) => {
        let fNArr = a.split('/').pop().split('.');
        fNArr.pop();
        let fName = decodeURI(fNArr.join('.'));
        results.messageText += `\r\n\nAttachment ${fName}: ${a}`;
        results.htmlText += `<br><a href=${a}>Attachment: ${fName}</a>`;
      });
    }

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
      if (!t.test) {   // No test condition?  Testing to see if the t.check was selected
        if (requestToTest.selections && requestToTest.selections.includes(t.check)) { passedTest = true; }
      }
      // there is a test condition
      else if (requestToTest.textInput && (requestToTest.textInput.hasOwnProperty(t.check))) {  // checking text input against t.test
        if (requestToTest.textInput[t.check].toLowerCase().includes(t.test.toLowerCase())) { passedTest = true; }
      }
      else if (t.check) {    // resolve whatever is being checked and test it against t.test (or array of t.tests)
        let resolved = await resolveMessageVariables(t.check, requestToTest);
        if (resolved) {
          if (Array.isArray(t.test)) {
            passedTest = t.test.some(v => {
              if (!(resolved.toLowerCase().includes(v.value.toLowerCase()))) { return false; }
              t.then = v.then;
              t.else = v.else;
              return true;
            });
          }
          else if (resolved.toLowerCase().includes(t.test.toLowerCase())) { passedTest = true; }
        }
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
          case 'add_recipient':
          case 'add_recipients': {
            if (Array.isArray(rule.value)) { results.recipientList.push(...rule.value); }
            else { results.recipientList.push(rule.value); }
            break;
          }
          case 'replace_recipient':
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
          case 'remove_recipient':
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
          case 'subject': {
            results.subject = rule.value;
            break;
          }
          case 'method':
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
          case 'replace_message':
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
  let loopCount = 0;
  while (workString.includes('<') && (loopCount < 10)) {
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
      case 'memberOf': {
        let gList = await getGroupsBelongTo(body.author);
        workString = `${front}${Object.keys(gList).join(' ~ ')}${back}`;
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
      case 'user': {
        if (body.hasOwnProperty('requestID')) {
          workString = `${front}${body.requestID.split('~')[0]}${back}`;
        }
        else { workString = `${front}${body.author}${back}`; }
        break;
      }
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
          if (body.selections.includes(if$.trim())) { workString = then$.trim(); }
          else { workString = ''; }
        }
        else if (body.hasOwnProperty('textInput') || body.hasOwnProperty('qualifiers')) {
          if (variable.startsWith('value')) { variable = variable.split(':')[1]; }
          let r = '';
          if (body.hasOwnProperty('textInput') && (variable in body.textInput)) {
            r = body.textInput[variable];
          }
          else if (body.hasOwnProperty('qualifiers')) {
            let qObj = {};
            for (let q in body.qualifiers) {
              Object.assign(qObj, body.qualifiers[q]);
            }
            if (variable in qObj) { r = listFromArray(qObj[variable]); };
          }
          workString = `${front}${r}${back}`;
        }
        else {
          let [dDate, dType] = variable.split(':');
          let keyDate = makeDate(dDate);
          if (!keyDate.error) { workString = `${front}${keyDate[dType || 'absolute']}${back}`; }
          else { workString = `${front}"${variable}"${back}`; }
        }
      }
    }
    loopCount++;
  }
  return workString;
};

async function formatRequestDetails(body, summaryType) {
  let textInput = {};
  if (body.textInput && (Object.keys(body.textInput).length > 0)) {
    textInput = Object.assign({}, body.textInput);
  }
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
    if (textInput && (Object.keys(textInput).length > 0)) {
      for (let topic in textInput) {
        if (!body.selections.includes(topic)) {
          let sVal = sentenceCase(topic.trim());
          rawMessage += `\n${sVal}\n${textInput[topic]}\n`;
          htmlMessage += `<h2><span style="color: black;">${sVal}</span></h2>`;
          htmlMessage += `<div style="padding-left: 10px; margin-top: -15px; font-size: 1.2em;">${textInput[topic]}</div>`;
          delete textInput[topic];
        }
      }
    }
    if (body.selections.length > 0) {
      htmlMessage += `<h2 style="color: black;">Options Selected</h2><dl style="padding-left: 40px;">`;
    }
  }

  let lineSpacing = '0px';
  if (!textInput) { textInput = {}; }
  body.selections.forEach((aVal) => {
    let sVal = sentenceCase(aVal.trim());
    htmlMessage += `<dt style="margin-top: ${lineSpacing}; font-size: 1.2em; color: black;">${renderCheckBox}<strong>${sVal}&nbsp&nbsp&nbsp</strong>${textInput[aVal] || ''}</dt>`;
    rawMessage += `\n${sVal}\n`;
    if (textInput[aVal]) {
      rawMessage += `${textInput[aVal]}\n`;
      delete textInput[aVal];
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

  if (textInput && (Object.keys(textInput).length > 0)) {
    for (let topic in textInput) {
      let sVal = sentenceCase(topic.trim());
      htmlMessage += `<dt style="padding-top:${lineSpacing}; font-size: 1.2em; color: black;">${renderCheckBox}<strong>${sVal}&nbsp&nbsp&nbsp</strong>${textInput[topic]}</dt>`;
      rawMessage += `\n${sVal}\n${textInput[topic]}\n`;
      lineSpacing = `${spaceBetweenLines}px`;
    }
  }

  // Finish
  htmlMessage += `</dl><p style="padding-top:${(spaceBetweenLines * 1.5).toString()}px;">`;

  if (body.local_key) {
    htmlMessage += `<div>AVA request number:&nbsp;<strong>${body.local_key}</strong></div>`;
    rawMessage += `\n\rAVA request number: ${body.local_key}`;
  }

  htmlMessage += `<div>AVA reference:&nbsp;${body.requestID} (${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()})</div>`;
  htmlMessage += `<div>***** END *****</div></p>`;
  rawMessage += `\n\rAVA reference: ${body.requestID} (${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()})\n***** END *****`;

  return [htmlMessage, rawMessage];
}

export async function mealTicketFormat(body) {

  // *********** GET ALL REQ THAT MATCH LOCAL_KEY IN THE BODY *********** //
  if (!body.local_key) {
    let keyRequest = await getServiceRequests({
      request_id: body.request_id,
      client_id: body.client || body.client_id
    });
    if (keyRequest.length === 0) { return null; } 
    body.local_key = keyRequest[0].local_key;
  }
  let requestList = await getServiceRequests({
    local_key: body.local_key,
    client_id: body.client || body.client_id
  });
  if (requestList.length === 0) { return null; }

  // Prep the PDF output
  let htmlText = [];
  if (!body.margin) { body.margin = {}; }
  let page = {
    width: body.pageWidth || '276px',
    border: body.border || true,
    font: {
      family: 'Helvetica',
      size: { large: '1.2em', medium: '1em', small: '0.8em', tiny: '0.6em' }
    },
    layout: body.orientation || 'portrait',
    info: { author: 'AVA Senior Living', title: 'Meal Ticket' },
    margin: {
      top: body.margin.top || '3em',
      bottom: body.margin.bottom || '1em',
      left: body.margin.left || '4px',
      right: body.margin.right || '4px'
    }
  };
  let style = `"padding-top: ${page.margin.top}; padding-bottom: ${page.margin.bottom}; width: ${page.width}; font-family: ${page.font.family}; ${page.border ? 'border: 2px solid black;' : ''} color: black; padding-left: ${page.margin.left}; padding-right: ${page.margin.right}"`;
  htmlText.push(`<body style=${style}>`)

  // ********** LOGO ********** //
  if (body.logo) {
    htmlText.push(`<div style="text-align:center">`);
    let logo_dimensions = [150, 100];
    if (body.logo_dimensions) { 
      logo_dimensions = body.logo_dimensions;
    }
    htmlText.push(`<img src="${body.logo}" width="${logo_dimensions[0]}px" height="${logo_dimensions[1]}px" />`);
    htmlText.push(`</div>`);
  }

  htmlText.push(`<p>`);
  
  // ********** TITLE ********** //
  let titleWords = body.subject || body?.format?.subject || body.activityName || 'Meal Ticket';
  titleWords = await resolveMessageVariables(titleWords, body);
  style = `"text-align:center; font-size: ${page.font.size.large};"`;
  htmlText.push(`<div style=${style}><b>${titleCase(titleWords)}</b></div>`);
  if (body.client_name) {
    htmlText.push(`<div style=${style}><b>${titleCase(body.client_name)}</b></div>`);
  }

  htmlText.push(`<br />`);

  // ********** HEADER ********** //
  // Pick-off the first request for Header info for the ticket
  let this_request = requestList[0];
  let [server_id, order_timestamp] = this_request.request_id.split('~');
  let server_name = await makeName(server_id);
  let table_key = body.tableNumberKey || 'Table Number';
  style = `"text-align:center; font-size: ${page.font.size.small};"`;
  htmlText.push(`<dt style=${style}>Server: ${titleCase(server_name)}</dt>`);
  htmlText.push(`<dt style=${style}>${makeDate(order_timestamp).absolute}</dt>`);
  if (this_request.original_request.textInput && this_request.original_request.textInput[table_key]) {
    htmlText.push(`<dt style=${style}><b>Table: ${this_request.original_request.textInput[table_key]}</b></dt>`);
  }
  
  htmlText.push(`</p>`);

  // ********** ORDERS ********** //
  for (let r = 0; r < requestList.length; r++) {
    let this_request = requestList[r];
    let requestor = this_request.on_behalf_of;
    if (!requestor) { requestor = await makeName(this_request.requestor); }
    htmlText.push(`<p style="padding-top: 1.5em;">`);
    style = `"font-size: ${page.font.size.medium}; padding-top: 0.5em;"`;
    htmlText.push(`<div style=${style}><b>${titleCase(requestor)}</b></div>`);
    // eslint-disable-next-line
    this_request.original_request.selections.forEach(s => {
      style = `"font-size: ${page.font.size.medium}; padding-top: 0.5em; padding-left: 0;"`;
      let [selection, options] = s.split(/[()]/);
      htmlText.push(`<div style=${style}>${selection}</div>`);
      if (options) {
        style = `"font-size: ${page.font.size.medium}; padding-left: 2em;"`;
        let optionList = options.split(',');
        optionList.forEach(o => {
          htmlText.push(`<div style=${style}><i>${titleCase(o)}</i></div>`);
        });
      }
    });
    for (let field in this_request.original_request.textInput) {
      if (field !== table_key) {
        style = `"font-size: ${page.font.size.medium}; padding-top: 0.5em;"`;
        htmlText.push(`<div style=${style}>${field}</div>`);
        style = `"font-size: ${page.font.size.medium}; padding-left: 2em;"`;
        htmlText.push(`<div style=${style}><i>${this_request.original_request.textInput[field]}</i></div>`);
      }
    }
    htmlText.push(`</p>`);
  }

  // ********** INITIALS ********** //
  htmlText.push(`<p style="font-size: ${page.font.size.medium}; padding-top: 4em;">Initials _________</p>`);

  // ********** FOOTERS ********** //
  htmlText.push(`<p style="padding-top: 1.5em;">`);
  style = `"font-size: ${page.font.size.tiny}; text-align:center;"`;
  htmlText.push(`<div style=${style}>${this_request.local_key}/${this_request.request_id}</div>`);
  htmlText.push(`<div style=${style}>AVA Senior Living</div>`);
  htmlText.push(`<div style=${style}>****** END ******</div>`);
  htmlText.push(`</p>`);

  htmlText.push(`</body>`);

  return [htmlText.join(''), htmlText.join('')] ;
}

export async function sendMessage(body) { return await sendMessages(body); }

export async function sendMessages(body) {
  /*  Expect body as an object or array of objects with the following structure
          client: <client_id>,
          author: <from person_id>
          testMode: <boolean> (if true, everything will happen EXCEPT the message will not be put in the PostOffice - and therefore not sent)
          messageText: <text> (if present, messageTextthis will override any messageText in the values attribute)
          htmlMessageText: <text>
          recipientList: <person_id or array of person_id's list can include "GRP//<group_id>" as well>
          subject: <subject>
          attachments: [<string>, <string>, ...]
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
    let currentTime = makeDate(new Date());
    let env = toSend[m];
    if (!('thread_id' in env)) { env.thread_id = `${postTime}.${uuid(6)}`; }
    // clean up recipientList before proceeding
    if (!('recipientList' in env)) {  // skip this, no recipients
      results.push({ sent: false, message: `failed - no recipients specified` });
      continue;
    }
    var PostOfficeRec = {
      Item: {
        'client_id': env.client,
        'thread_id': env.thread_id,
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
    if (env.attachments) { PostOfficeRec.Item.attachments = makeArray(env.attachments); }
    if (env.allowReplyAll) { PostOfficeRec.Item.allowReplyAll = env.allowReplyAll; }
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
        if (gCode.includes('/')) {
          let [cl, gr] = gCode.split(/[/]+/);
          PostOfficeRec.Item["client_id"] = cl;
          gCode = gr;
        }
        PostOfficeRec.Item["recipient_base"] = 'group';
        PostOfficeRec.Item["recipient_key"] = gCode;
        let goodSend = true;
        await dbClient
          .put(PostOfficeRec)
          .promise()
          .catch(error => {
            console.log(`Message Engine caught error at 268 adding a Message; error is ${error}`);
            results.push({ sent: false, message: `Unable to send message to group ${gCode} ${currentTime.oaDate}.  Error was ${error}` });
            goodSend = false;
          });
        if (goodSend) { results.push({ sent: true, message: `Sent message to group ${gCode} ${currentTime.oaDate}` }); }
      }
      else { ind.push(to[r]); }
    }
    if (ind.length > 0) {
      PostOfficeRec.Item["recipient_base"] = 'list';
      PostOfficeRec.Item["recipient_key"] = ind;
      let goodPost = true;
      await dbClient
        .put(PostOfficeRec)
        .promise()
        .catch(error => {
          cl(`Error writing to Post Office; error is ${error}`);
          results.push({ sent: false, message: `Unable to send message ${currentTime.oaDate}.  Error was ${error}` });
          goodPost = false;
        });
      if (goodPost) {
        let nList = [];
        for (let p = 0; p < ind.length; p++) {
          nList.push(await makeName(ind[p]));
        }
        results.push({ sent: true, message: `Sent message to ${listFromArray(nList)} ${currentTime.oaDate}` });
      }
    }
  }
  return results;
}

export async function messageHistory(body) {
  // body should include thread_id
  let mRecs = await getMessages(body);
  let returnArray = [];
  if (!mRecs) { returnArray.push(`No message history`); }
  else {
    mRecs.forEach(mR => {
      let mTime = mR.posted_time || mR.created_time;
      let mInfo = '';
      let mLine = `Sent to ${mR.recipient_list.name.first} ${mR.recipient_list.name.last}`;
      switch (mR.deliver_method) {
        case 'sms': {
          mLine += ' via text message';
          break;
        }
        case 'voice':
        case 'office': {
          mLine += ' via phone call';
          break;
        }
        case 'email': {
          mLine += ' via e-Mail';
          break;
        }
        case 'hold': {
          mLine += " held for later delivery per recipient's instructions";
          break;
        }
        default: { mLine += ` via ${mR.deliver_method}`; }
      }
      if (mR.results) {
        let mRLast = mR.results[0];
        mTime = mRLast.posted_time;
        switch (mRLast.result) {
          case 'reply': {
            mLine += '.  Reply received';
            mInfo = ` Reply is "${mRLast.update_contents.replace(':', ' -')}"`;
            break;
          }
          case 'submitted': {
            break;
          }
          case 'replyReceived': {
            mLine += '.  Reply received';
            break;
          }
          case 'delivery':
          case 'delivered': {
            mLine += '.  Delivered';
            break;
          }
          case 'open': {
            mLine += '.  Opened';
            break;
          }
          default: {
            mLine += `. ${mRLast.result}`;
          }
        }
      }
      mLine += ` ${makeDate(mTime).oaDate}`;
      mLine += mInfo;
      returnArray.push(mLine);
    });
    return returnArray;
  }
}