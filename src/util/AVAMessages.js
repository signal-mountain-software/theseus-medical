
import { clt, cl, s3, recordExists, titleCase, uuid, isObject, listFromArray, array_in_array, makeArray, sentenceCase, dbClient, deepCopy, getObject } from './AVAUtilities';
import { getPerson, makeName } from './AVAPeople';
import { getGroupsBelongTo } from './AVAGroups';
import { getCustomizations, getObject64 } from './AVAUtilities';
import { getServiceRequests, formatServiceRequestDetails } from './AVAServiceRequest';
import { getObservationItems } from './AVAObservations';
import { makeDate } from './AVADateTime';

import { jsPDF } from "jspdf";

let page = {};
let pdfCurrent = {};
let doc;

let attachments = [];

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

export async function prepareMessage(inBodyData, requestRec = {}) {
  let bodyList = [];
  let messageList = [];
  let results;
  let returnResults = [];
  if (Array.isArray(inBodyData)) { bodyList.push(...inBodyData); }
  else { bodyList.push(inBodyData); }
  do {
    let inBody = bodyList.shift();
    messageList = [];
    if (Array.isArray(inBody.messaging)) { messageList.push(...inBody.messaging); }
    else { messageList.push(inBody.messaging); }
    //   returnResults = [];  why is this here?
    results = null;
    let requestInfo = Object.assign({}, inBody, {
      activityName: inBody.activityName || inBody.name,
      client: inBody.client || inBody.client_id,
      author: inBody.author || inBody.requestor,
      onBehalfOf: inBody.onBehalfOf || inBody.on_behalf_of,
      local_key: inBody.local_key,
      requestDate: inBody.requestDate || inBody.request_date,
      requestID: inBody.requestID || inBody.request_ID || inBody.request_id,
      selections: inBody.selections,
      qualifiers: inBody.qualifiers,
      textInput: inBody.textInput,
      reprint: inBody.reprint,
      overrideMethod: inBody.overrideMethod
    },
      inBody.original_request,
      inBody.request);
    // about Attachments...
    // "attachments" are URLs that will be hyperlinked to from the body of the message
    //   these URLs may have come along with the message or be created below
    //   This is our non-traditional way of sending links to resources in the body of a message
    // "attachment_data" is what is needed to create a traditional attached file in the message
    //   and is only present when the activity lists attachment_method = 'file'
    if (inBody.hasOwnProperty('attachments')) {
      requestInfo.attachments = inBody.attachments.map(a => {
        if (typeof (a) === 'string') {
          return a;
        }
        else if (isObject(a)) {
          return a.Location;
        }
        else {
          return '';
        }
      });
    }
    let needMultiPrint = (messageList.length > 1);
    let firstDoc = true;
    // if multi print, put types that need to be bundled together at the bottom of the list 
    messageList.sort((a, b) => {
      if (!a.format || ['mealOrder', 'checklist', 'factForm'].includes(a.format.type)) {
        return 1;
      }
      return -1;
    });
    do {
      let this_request = Object.assign({}, requestInfo, messageList.shift());   // this removes the message from the messageList
      if (needMultiPrint) {
        this_request.multiPrint = {
          firstDoc,
          lastDoc: (messageList.length === 0)
        };
      }
      results = {};
      if (Array.isArray(this_request.recipientList)) { results.recipientList = [...this_request.recipientList]; }
      else { results.recipientList = [this_request.recipientList]; }
      for (let i = 0; i < results.recipientList.length; i++) {
        results.recipientList[i] = await resolveMessageVariables(results.recipientList[i], this_request);
      }
      results.client = this_request.client;
      results.author = this_request.author;
      results.preferred_method = this_request.overrideMethod || this_request.format?.method || this_request.method;
      if (!('format' in this_request)) {
        this_request.format = { 'type': 'factForm' };
      }
      if (this_request.format.method === 'hold') {
        continue;
      }
      if ('subject' in this_request.format) {
        results.subject = this_request.format.subject;
      }
      switch (this_request.format.type) {
        case 'mealOrder':
        case 'checklist':
        case 'factForm': {
          [results.htmlText, results.messageText, results.pdfInfo] = await formatRequestDetails(this_request, this_request.format.type);
          firstDoc = false;
          if ((this_request.messaging.hasOwnProperty('attachment_method')
            && (this_request.messaging.attachment_method === 'file')) ||
            (this_request.hasOwnProperty('attachment_method')
              && (this_request.attachment_method === 'file'))) {
            results.attachment_data = {
              filename: results.pdfInfo.key,
              content: results.pdfInfo.data,
              type: 'application/pdf',
              disposition: 'attachment',
              content_id: this_request.local_key
            };
            // results.htmlText = 'See attached';
            // results.messageText = 'See attached';
          }
          break;
        }
        case 'document': {
          [results.htmlText, results.messageText, results.pdfInfo] = await buildDocument(this_request);
          results.attachments = deepCopy(results.pdfInfo);
          requestInfo.attachments = results.pdfInfo;
          if ((this_request.messaging.hasOwnProperty('attachment_method')
            && (this_request.messaging.attachment_method === 'file')) ||
            (this_request.hasOwnProperty('attachment_method')
              && (this_request.attachment_method === 'file'))) {
            results.attachment_data = {
              filename: results.pdfInfo.key,
              content: results.pdfInfo.data,
              type: 'application/pdf',
              disposition: 'attachment',
              content_id: this_request.local_key
            };
            // results.htmlText = 'See attached';
            // results.messageText = 'See attached';
          }
          break;
        }
        case 'singleTicket':
        case 'mealTicket': {
          [results.htmlText, results.messageText, results.attachments] = await mealTicketFormat(this_request, requestRec);
          if (results.attachments) {
            requestInfo.attachments = results.attachments;
            if (this_request.messaging.hasOwnProperty('attachment_method')
              && (this_request.messaging.attachment_method === 'file')) {
              results.attachment_data = {
                filename: `MealTicket-${this_request.local_key}.pdf`,
                content: results.attachments.data,
                type: 'application/pdf',
                disposition: 'attachment',
                content_id: this_request.local_key
              };
            }
          }
          break;
        }
        case 'inBody': {
          results.htmlText = inBody.htmlText;
          results.messageText = inBody.messageText;
          break;
        }
        case 'plainText':
        default: {
          results.messageText = await resolveMessageVariables(this_request.format.text, this_request) + ' ** AVA **';
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
      results.messageText = results.messageText.replace('** AVA **', '').trim();
      results.htmlText = results.htmlText.replace('** AVA **', '').trim();

      if (requestInfo.hasOwnProperty('attachments')) {
        results.htmlText += '<br>';
        if (!(Array.isArray(requestInfo.attachments))) {
          if (requestInfo.attachments.hasOwnProperty('Location')) {
            results.messageText += `\r\n\nAttachment ${requestInfo.attachments.Key}: ${requestInfo.attachments.Location}`;
            results.htmlText += `<br><a href=${requestInfo.attachments.Location}>Attachment: ${requestInfo.attachments.Key}</a>`;
          }
        }
        else {
          // eslint-disable-next-line
          requestInfo.attachments.forEach((a, x) => {
            let fNArr = a.split('/').pop().split('.');
            fNArr.pop();
            let fName = decodeURI(fNArr.join('.'));
            results.messageText += `\r\n\nAttachment ${fName}: ${a}`;
            results.htmlText += `<br><a href=${a}>Attachment: ${fName}</a>`;
          });
        }
      }

      returnResults.push(results);
    } while (messageList.length > 0);
  } while (bodyList.length > 0);

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
        if (requestToTest.selections) {
          if (makeArray(requestToTest.selections).some(s => {
            return s.includes(t.check);
          })) {
            passedTest = true;
          }
        }
        else if (requestToTest.textInput && requestToTest.textInput.hasOwnProperty(t.check)) { passedTest = true; }
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
            results.messageText = results.messageText.replace('** AVA **', `${custom_text} ** AVA **`);
            results.htmlText = results.htmlText.replace('** AVA **', `${custom_text} ** AVA **`);
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

export async function resolveMessageVariables(inString = '', body) {
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
      case 'env':
      case 'environment': {
        let env = window.location.href.split('//')[1].charAt(0).toLowerCase();
        workString = `${front}${env}${back}`;
        break;
      }
      case 'memberOf': {
        let gList = await getGroupsBelongTo(body.client, body.author);
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
        else if (variable.trim().toLowerCase().startsWith('date=')) {
          let [dDate, dType] = variable.split('=')[1].split(':');
          if (body.hasOwnProperty(dDate)) {
            dDate = body[dDate];
          }
          let keyDate = makeDate(dDate);
          if (!keyDate.error) { workString = `${front}${keyDate[dType || 'absolute']}${back}`; }
          else { workString = `${front}"${variable}"${back}`; }
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
          if (body.hasOwnProperty(dDate)) {
            dDate = body[dDate];
          }
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

export async function formatRequestDetails(body, summaryType) {
  // Standard 8.5 x 11 output for a Request of any type
  // Prep the PDF output
  if (!body.margin) { body.margin = {}; }
  await pdfLaunch(Object.assign({}, body, { client_id: (body.client || body.client_id) }));

  let textInput = {};
  if (body.textInput && (Object.keys(body.textInput).length > 0)) {
    textInput = Object.assign({}, body.textInput);
  }

  let htmlMessage = `<h1 style="color: #5e9ca0;"><span style="color: #000000;">${page.title}</span></h1>`;
  let rawMessage = `${page.title}\n\r`;
  pdfLine(' ', { align: 'center', image: pdfCurrent.logo });
  pdfLine(page.title, { style: 'bold', size: 'large', align: 'center', after: 1 });

  // Person
  let pRec = await getPerson(body.author);

  let authorName = await makeName(body.author);
  let pName = (body.onBehalfOf || authorName).replace(/\(.+\)/g, '').trim();  // this removes anything inside parenthesis
  // does the title contain all of the words in the obo?
  let tLower = page.title.toLowerCase();
  let oboWords = pName.toLowerCase().split(/\s+/);
  let allWordsAppear = oboWords.every(oboWord => {
    return (tLower.includes(oboWord));
  });
  if (!allWordsAppear) {
    htmlMessage += `<h2 style = "color: black;" >${pName}`;
    rawMessage += `${pName}\n`;
    pdfLine(`for ${pName}`, { style: 'normal', align: 'center', size: 'large' });
  }

  if (pRec.location) {
    //   let locNum = parseNumeric(pRec.location);
    //   if (locNum.hasNumbers) {
    //     pRec.location = `Apt ${locNum.value}`;
    //   }
    htmlMessage += `<br />${pRec.location}`;
    rawMessage += `${pRec.location}\n`;
    pdfLine(pRec.location, { align: 'center' });
  }
  htmlMessage += `</h2>`;

  if (!body.requestDate) { body.requestDate = new Date(); }
  let pDateTime = makeDate(body.requestDate).absolute;

  // get creator info - most reliable spot is first characters of the request id
  let creator_id = (body.request_id || body.requestID || body.author).split('~')[0];
  if (creator_id !== body.author) {
    pDateTime += ` by ${await makeName(creator_id)}`;
  }
  htmlMessage += `<p style = "color: black;">created: <strong>${pDateTime}</strong>`;
  rawMessage += `${pDateTime}\n\r`;
  pdfLine(`created: ${pDateTime}`, { size: 'medium', align: 'center' });

  for (let cTyp in pRec.messaging) {
    if ((pRec[cTyp]) && (pRec[cTyp].trim() !== '')) {
      let cLab;
      switch (cTyp) {
        case 'sms': { cLab = 'cell'; break; }
        case 'voice': { cLab = 'home'; break; }
        case 'email': { cLab = 'e-Mail'; break; }
        default: { cLab = cTyp; }
      }
      htmlMessage += `<br />${cLab}: <strong>${pRec[cTyp]}</strong>`;
      pdfLine(`${pRec[cTyp]}`, { align: 'center' });
    }
  }
  pdfDown(2);

  htmlMessage += '</p><h2 style = "color: black;" >** AVA **</h2>';
  rawMessage += '\n\r** AVA **\n\r';

  let spaceBetweenLines = 25;
  if (body.selections.length > 7) { spaceBetweenLines = 125 / (body.selections.length - 2); }

  let renderCheckBox = '';
  if (summaryType === 'mealOrder') {
    // special selections
    body.selections = body.selections.filter(aVal => {
      if (['dinner', 'lunch', 'pick-up', 'deliver'].includes(aVal.split(/\s+/)[0].toLowerCase())) {
        htmlMessage += `<h2 style="color: black;">${aVal.trim()}</h2>`;
        rawMessage += `${aVal}\r\n`;
        pdfLine(aVal);
        return false;
      }
      else {
        return true;
      }
    });
    renderCheckBox = '&#8414;   ';
    htmlMessage += '<br /><br />';
    rawMessage += `\n\n`;
    htmlMessage += `<h2 style="color: black;">Order Details</h2><dl style="padding-left: 40px;">`;
    pdfLine('Order Details', { style: 'bold', before: 3, align: 'left' });
  }
  else {
    if (textInput && (Object.keys(textInput).length > 0)) {
      pdfStyle('reset');
      for (let topic in textInput) {
        if (!body.selections.includes(topic)) {
          let sVal = sentenceCase(topic.trim());
          rawMessage += `\n${sVal}\n${textInput[topic]}\n`;
          htmlMessage += `<h2><span style="color: black;">${sVal}</span></h2>`;
          htmlMessage += `<div style="padding-left: 10px; margin-top: -15px; font-size: 1.2em;">${textInput[topic]}</div>`;
          pdfLine(sVal, { before: 1 });
          pdfLine(textInput[topic], { noNewLine: true, before: 1, indent: 15, size: 'small' });
          pdfStyle('reset');
          delete textInput[topic];
        }
      }
    }
    if (body.selections.length > 0) {
      htmlMessage += `<h2 style="color: black;">Options Selected</h2><dl style="padding-left: 40px;">`;
      //    pdfLine('Options Selected', {style: 'bold', before: 1, align: 'left'});
    }
  }
  pdfStyle('reset');

  let lineSpacing = '0px';
  if (!textInput) { textInput = {}; }
  body.selections.forEach((aVal) => {
    let aVal_raw = aVal.split(' (').shift();
    let sVal = sentenceCase(aVal.trim());
    if ((body.options) && (body.options.hasOwnProperty(aVal_raw))) {
      sVal = sentenceCase(aVal_raw);
    }
    if ((body.images) && (body.images.hasOwnProperty(aVal_raw))) {
      pdfLine(' ', { align: 'left', image: body.images[aVal_raw] });
      rawMessage += `<Signature Captured>\n`;
      htmlMessage += `<img src="${body.images[aVal_raw]}" />`;
    }
    else {
      htmlMessage += `<dt style="margin-top: ${lineSpacing}; font-size: 1.2em; color: black;">${renderCheckBox}<strong>&nbsp;&nbsp;&nbsp;${sVal}</strong></dt>`;
      rawMessage += `\n${sVal}\n`;
      pdfStyle('reset');
      pdfLine(sVal, { before: 1 });
      if (textInput[aVal]) {
        pdfLine(textInput[aVal], { noNewLine: true, before: 1, indent: 15, size: 'small' });
        htmlMessage += `<dd>${textInput[aVal]}</dd>`;
        rawMessage += `${textInput[aVal]}\n`;
        delete textInput[aVal];
      }
    }
    /* Check for qualifiers */
    if ((body.qualifiers) && (body.qualifiers.hasOwnProperty(aVal))) {
      for (let qual in body.qualifiers[aVal]) {
        let tOut = listFromArray(body.qualifiers[aVal][qual]) || 'No selection';
        htmlMessage += `<dd>${sentenceCase(qual)}: ${tOut}</dd>`;
        rawMessage += `${sentenceCase(qual)}: ${tOut}\n`;
        pdfLine(`${sentenceCase(qual)}: ${tOut}`, { noNewLine: true, before: 1, indent: 15, size: 'small' });
      }
    }
    /* Check for options */
    if ((body.options) && (body.options.hasOwnProperty(aVal_raw))) {
      for (let this_option in body.options[aVal_raw]) {
        for (let this_choice in body.options[aVal_raw][this_option]) {
          if (typeof (body.options[aVal_raw][this_option][this_choice]) === 'boolean') {
            if (body.options[aVal_raw][this_option][this_choice]) {
              htmlMessage += `<dd>${titleCase(this_choice)}</dd>`;
              rawMessage += `${titleCase(this_choice)}\n`;
              pdfLine(`${titleCase(this_choice)}`, { noNewLine: true, italic: true, before: 1, indent: 15, size: 'small' });
            }
          }
          else {
            htmlMessage += `<dd>${body.options[aVal_raw][this_option][this_choice]}</dd>`;
            rawMessage += `${body.options[aVal_raw][this_option][this_choice]}\n`;
            pdfLine(`${body.options[aVal_raw][this_option][this_choice]}`, { noNewLine: true, italic: true, before: 1, indent: 15, size: 'small' });
          }
        }
      }
    }
    lineSpacing = `${spaceBetweenLines}px`;
  });
  pdfStyle('reset');

  if (textInput && (Object.keys(textInput).length > 0)) {
    pdfDown(2);
    htmlMessage += '<br /><br />';
    rawMessage += `\n\n`;
    for (let topic in textInput) {
      if (!body.images || !body.images.hasOwnProperty(topic)) {
        let sVal = sentenceCase(topic.trim());
        htmlMessage += `<dt style="padding-top:${lineSpacing}; font-size: 1.2em; color: black;">${sVal}&nbsp;&nbsp;&nbsp;</strong>${textInput[topic]}</dt>`;
        rawMessage += `\n${sVal}\n${textInput[topic]}\n`;
        pdfStyle('reset');
        pdfLine(sVal, { before: 1 });
        pdfLine(textInput[topic], { noNewLine: true, before: 1, indent: 15, size: 'small' });
        lineSpacing = `${spaceBetweenLines}px`;
      }
    }
  }

  htmlMessage += `</dl><p style="padding-top:${(spaceBetweenLines * 1.5).toString()}px;">`;

  // Finish
  if (summaryType === 'mealOrder') {
    pdfStyle('reset');
    pdfLine('Order filled by: ________________________', { before: 4, after: 1 });
    htmlMessage += `<h2 style = "color: black;" >Order filled by: _______________________</h2>`;
    rawMessage += '\n\nOrder filled by: ________________________\n\n';
  }

  let refText = `AVA reference: ${body.client || body.client_id}/${body.requestID} (${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()})`;
  if (body.local_key) {
    htmlMessage += `<div>AVA request number: <strong>${body.local_key}</strong></div>`;
    rawMessage += `\n\rAVA request number: ${body.local_key}`;
    pdfLine(`AVA request number: ${body.local_key}`, { size: 'tiny', after: 1, yPos: 'footer', align: 'center' });
    pdfLine(refText, { noNewPage: true, noNewLine: true, before: 1, align: 'center' });
  }
  else {
    pdfLine(refText, { noNewPage: true, yPos: 'footer', align: 'center' });
  }

  htmlMessage += `<div>${refText}</div>`;
  htmlMessage += `<div>***** END *****</div></p>`;
  rawMessage += `\n\r${refText}\n***** END *****`;

  if (body.fileName && body.fileName.slice(-4) !== '.pdf') {
    body.fileName += '.pdf';
  }
  let pdfInfo = {
    s3Key: (body.fileName || `AVA_${body.requestID.replace('~', '_')}.pdf`),
    s3Bucket: (body.S3_bucket || 'theseus-medical-storage')
  };
  if (!body.multiPrint || body.multiPrint.lastDoc) {
    pdfLine(`***** END *****`, { noNewPage: true, noNewLine: true, before: 1 });
    let this_method = body.overrideMethod || body.messaging?.format?.method || body.messaging[0].format.method;
    let pdfResp = await savePDF(doc, pdfInfo, { local: false, S3: true, onSave: this_method });
    if (pdfResp.responseData.s3Resp) {
      pdfInfo.s3Location = pdfResp.responseData.s3Resp.Location;
    }
  }
  return [htmlMessage, rawMessage, pdfInfo];
}


export async function printDocument({ docData, docValues, docDocument, docID, client_id, title }) {
  // Prep the PDF output
  await pdfLaunch({ client_id });
  page.title = title;
  page.document_id = docID;
  page.client_id = client_id;
  page.footerText = `AVA reference: ${page.client_id}/${page.document_id}`;
  // pdfLine(' ', { align: 'center', image: pdfCurrent.logo });
  pdfLine(title, { style: 'bold', size: 'large', align: 'center', after: 1 });

  // docData.sections.forEach((sectionObj, sectionNdx) => {
  for (const sectionObj of docData.sections) {
    pdfLine(sectionObj.section_name, { protectOrphan: true, style: 'bold', size: 'medium', align: 'left', before: 2, after: 1 });
    // sectionObj.fields.forEach((this_field, fieldNdx) => {
    for (const this_field of sectionObj.fields) {
      if (docData.fields.hasOwnProperty(this_field) && !(docData.fields.ignore) && !(docData.fields.hidden)) {
        let printType = (docData.fields[this_field].value.type === 'view') ? docData.fields[this_field].prompt.type : docData.fields[this_field].value.type;
        switch (printType) {
          case 'upload':
          case 'image': {
            pdfLine(docData.fields[this_field].prompt.ref, { style: 'normal', size: 'medium', indent: 0, align: 'left', after: 0 });
            pdfLine('', { image: docValues[this_field].valueText, image_width: (page.width / 5), style: 'normal', size: 'medium', align: 'left', after: 1 });
            break;
          }
          case 'drop_down':
          case 'dropdown':
          case 'dropDown':
          case 'select&text':
          case 'select': {
            if (!docData.fields[this_field].prompt.noPrint) {
              if (page.line_was_compressed) {
                pdfDown(1);
                page.line_was_compressed = false;
              }
              if (docData.fields[this_field].prompt.compressPrint) {
                docData.fields[this_field].prompt.value += ':';
              }
              pdfLine(docData.fields[this_field].prompt.ref, { style: 'normal', size: 'medium', indent: 0, align: 'left', after: 0 });
              docData.fields[this_field].value.selection.selectionList.forEach((text, tIndex) => {
                if (docData.fields[this_field].value && docData.fields[this_field].prompt.compressPrint) {
                  if (docData.fields[this_field].value.includes(text)) {
                    pdfLine(text, { style: 'normal', indent: 2, after: 0, noNewLine: true });
                  }
                }
                else {
                  let radioSelected = docValues[this_field].valueList.includes(text);
                  if (tIndex === 0) {
                    pdfLine(text, { radio: true, radioSelected, style: 'normal', size: 'medium', align: 'left', indent: 2, after: 0, noNewPage: true });
                  }
                  else {
                    pdfLine(text, { radio: true, radioSelected, style: 'normal', size: 'medium', align: 'left', indent: 10, after: 0, noNewLine: true, noNewPage: true });
                  }
                }
              });
              pdfDown(1);
              pdfStyle('reset');
            }
            break;
          }
          case 'header': {
            pdfLine((docData.fields[this_field].prompt.ref || docData.fields[this_field].prompt.value), { protectOrphan: true, style: 'italic', size: 'medium', align: 'left', before: 2, after: 1 });
            break;
          }

          case 'html': {
            await pdfHTML(docData.fields[this_field].prompt.ref || docData.fields[this_field].prompt.value,
              Object.assign({}, docData.fields[this_field]?.prompt, {
                before: -2,
                printed_height: docData.fields[this_field]?.prompt?.printed_height || null,
                print_scale: docData.fields[this_field].prompt.print_scale || 1,
                html: true,
                style: 'normal',
                size: 'medium',
                align: 'left',
                after: 1
              }));
            break;
          }
          case 'signature': {
            await pdfImage(docData.fields[this_field].prompt.ref, { image: docDocument[this_field] || docDocument.signature, style: 'normal', size: 'medium', align: 'left', after: 1 });
            break;
          }
          case 'legacy_signature': {
            pdfLine(docData.fields[this_field].prompt.ref, { image: docDocument[this_field] || docDocument.signature, style: 'normal', size: 'medium', align: 'left', after: 1 });
            break;
          }
          default: {
            if (docValues.hasOwnProperty(this_field)) {
              if (docData.fields[this_field].prompt.compressPrint) {
                pdfLine(docValues[this_field].valueText,
                  { style: 'normal', size: 'medium', align: 'left', after: 0 });
              }
              else if (docData.fields[this_field].prompt.ref.includes(docValues[this_field].valueText)) {
                pdfLine(`${docData.fields[this_field].prompt.ref}`,
                  { style: 'normal', size: 'medium', align: 'left', after: 1 });
              }
              else {
                pdfLine(`${docData.fields[this_field].prompt.ref}: ${docValues[this_field].valueText}`,
                  { style: 'normal', size: 'medium', align: 'left', after: 1 });
              }
            }
          }
        }
      }
    };
  };

  // Finish
  pdfLine(page.footerText, { size: 'tiny', after: 1, yPos: 'footer', align: 'center' });
  doc.save(docDocument.document_id);
}

export async function consolidatePDFs({ documentList, options = {} }) {

}

function okToShowSection(this_sectionObj, fields) {
  if (this_sectionObj.hasOwnProperty('show_if')) {
    for (const this_test of this_sectionObj.show_if) {
      if (this_test.hasOwnProperty('pertainsTo_memberOf')) {
        return true;
      }
      else if (this_test.hasOwnProperty('memberOf')) {
        return true;
      }
      else {
        const this_value = fields[this_test.field].value;
        if (!this_value) { return true; }
        if (array_in_array(this_test.values, this_value)) {
          return true;
        }
      }
    }
    return false;
  }
  else {
    return true;
  }
}

export async function printDocumentB({ documentList, options = {} }) {
  let response = [];
  if (!Array.isArray(documentList)) {
    documentList = [documentList];
  }
  let numberOfDocuments = documentList.length;
  // Prep the PDF output
  let docIndex = 0;
  for (const docInfo of documentList) {
    docIndex++;
    let { sections, fields, docID, client_id, title, signatures } = docInfo;
    await pdfLaunch({ client_id });
    page.title = title;
    page.document_id = docID;
    page.client_id = client_id;
    page.footerText = `AVA reference: ${page.client_id}_${page.document_id}`;
    pdfLine(' ', { align: 'center', image: pdfCurrent.logo });
    pdfLine(title, { style: 'bold', size: 'large', align: 'center', after: 1 });

    //   sections.forEach((sectionObj, sectionNdx) => {
    for (const sectionObj of sections) {
      if (okToShowSection(sectionObj, fields)) {
        pdfLine(sectionObj.section_name, { protectOrphan: true, style: 'bold', size: 'medium', align: 'left', before: 2, after: 1 });
        //  sectionObj.fields.forEach((this_field, fieldNdx) => {
        for (const this_field of sectionObj.fields) {
          if (fields.hasOwnProperty(this_field) && !(fields[this_field].ignore) && !(fields[this_field].hidden)) {
            let printType = fields[this_field].type;
            switch (printType) {
              case 'upload':
              case 'image': {
                pdfLine(fields[this_field].prompt.value, { style: 'normal', size: 'medium', indent: 0, align: 'left', after: 0 });
                pdfLine('', { image: fields[this_field].valueText, image_width: (page.width / 5), style: 'normal', size: 'medium', align: 'left', after: 1 });
                break;
              }
              case 'drop_down':
              case 'dropdown':
              case 'dropDown':
              case 'select&text':
              case 'select': {
                if (!fields[this_field].prompt.noPrint) {
                  if (page.line_was_compressed) {
                    pdfDown(1);
                    page.line_was_compressed = false;
                  }
                  if (fields[this_field].prompt.compressPrint) {
                    fields[this_field].prompt.value += ':';
                  }
                  pdfLine(fields[this_field].prompt.value, { style: 'normal', size: 'medium', indent: 0, align: 'left', after: 0 });
                  fields[this_field].selectionObj.selectionList.forEach((text, tIndex) => {
                    if (fields[this_field].value && fields[this_field].prompt.compressPrint) {
                      if (fields[this_field].value.includes(text)) {
                        pdfLine(text, { style: 'normal', indent: 2, after: 0, noNewLine: true });
                      }
                    }
                    else {
                      let radioSelected = fields.hasOwnProperty(this_field) && fields[this_field].value && fields[this_field].value.includes(text);
                      if (tIndex === 0) {
                        pdfLine(text, { radio: true, radioSelected, style: 'normal', size: 'medium', align: 'left', indent: 2, after: 0, noNewPage: true });
                      }
                      else {
                        pdfLine(text, { radio: true, radioSelected, style: 'normal', size: 'medium', align: 'left', indent: 10, after: 0, noNewLine: true, noNewPage: true });
                      }
                    }
                  });
                  if (fields[this_field].bonusText) {
                    const text = `${fields[this_field].prompt.other || 'Other'}: ${fields[this_field].bonusText}`;
                    pdfLine(text, { radio: true, radioSelected: true, style: 'normal', size: 'medium', align: 'left', indent: 10, after: 0, noNewLine: true, noNewPage: true });
                  }
                  pdfDown(1);
                  pdfStyle('reset');
                }
                break;
              }
              case 'header': {
                pdfLine(fields[this_field].prompt.value, { protectOrphan: true, style: 'italic', size: 'medium', align: 'left', before: 2, after: 1 });
                break;
              }
              case 'html': {
                await pdfHTML(`${fields[this_field].prompt.value}`,
                  Object.assign({}, fields[this_field].prompt, {
                    before: -2,
                    printed_height: fields[this_field].prompt.printed_height,
                    print_scale: fields[this_field].prompt.print_scale || 1,
                    html: true,
                    style: 'normal',
                    size: 'medium',
                    align: 'left',
                    after: 1
                  }));
                break;
              }
              case 'signature': {
                await pdfImage(fields[this_field].prompt.value, { image: signatures[fields[this_field].options.sigRefNumber], style: 'normal', size: 'medium', align: 'left', after: 1 });
                break;
              }
              case 'legacy_signature': {
                pdfLine(fields[this_field].prompt.value, { image: signatures[fields[this_field].options.sigRefNumber], style: 'normal', size: 'medium', align: 'left', after: 1 });
                break;
              }
              default: {
                if (fields.hasOwnProperty(this_field)) {
                  if ((fields[this_field].valueText.length === 0) && fields[this_field].prompt.showNA) {
                    fields[this_field].valueText = 'n/a';
                  }
                  if (fields[this_field].prompt.compressPrint) {
                    pdfLine(fields[this_field].valueText,
                      { style: 'normal', size: 'medium', align: 'left', after: 0 });
                  }
                  else if (fields[this_field].prompt.value.includes(fields[this_field].valueText)) {
                    pdfLine(`${fields[this_field].prompt.value}`,
                      { style: 'normal', size: 'medium', align: 'left', after: 1 });
                  }
                  else {
                    pdfLine(`${fields[this_field].prompt.value}: ${fields[this_field].valueText}`,
                      { style: 'normal', size: 'medium', align: 'left', after: 1 });
                  }
                }
              }
            }
          }
        };
      }
    };

    // Finish
    pdfLine(page.footerText, { size: 'tiny', after: 1, yPos: 'footer', align: 'center' });
    doc.save(docID);
    if (!options.multiPrint || (numberOfDocuments === docIndex)) {
      let pdfInfo = {
        s3Key: (`${page.client_id}_${page.document_id}.pdf`),
        s3Bucket: (options.S3_bucket || 'theseus-medical-storage')
      };
      pdfLine(`***** END *****`, { noNewPage: true, noNewLine: true, before: 1 });
      let pdfResp = await savePDF(doc, pdfInfo, { local: false, S3: true, onSave: false });
      if (pdfResp.responseData.s3Resp) {
        pdfInfo.s3Location = pdfResp.responseData.s3Resp.Location;
      }
      response.push(pdfInfo);
    }
  }
  return response;
}

export async function printEmptyDocument({ documentList, options = {} }) {
  let response = [];
  if (!Array.isArray(documentList)) {
    documentList = [documentList];
  }
  let numberOfDocuments = documentList.length;
  // Prep the PDF output
  let docIndex = 0;
  for (const docInfo of documentList) {
    docIndex++;
    let { sections, fields, docID, client_id, title } = docInfo;
    await pdfLaunch({ client_id });
    page.title = title;
    page.document_id = docID;
    page.client_id = client_id;
    page.footerText = `AVA reference: ${page.client_id}_${page.document_id}`;
    pdfLine(' ', { align: 'center', image: pdfCurrent.logo });
    pdfLine(title, { style: 'bold', size: 'large', align: 'center', after: 1 });
    // eslint-disable-next-line
    //  sections.forEach((sectionObj) => {
    for (const sectionObj of sections) {
      pdfLine(sectionObj.section_name, { protectOrphan: true, style: 'bold', size: 'medium', align: 'left', before: 2, after: 1 });
      //   sectionObj.fields.forEach((this_field) => {
      for (const this_field of sectionObj.fields) {
        if (fields.hasOwnProperty(this_field) && !(fields[this_field].ignore) && !(fields[this_field].hidden)) {
          let printType = fields[this_field].type;
          switch (printType) {
            case 'upload':
            case 'image': {
              pdfLine(fields[this_field].prompt.value, { style: 'normal', size: 'medium', indent: 0, align: 'left', after: 0 });
              pdfLine('', { image: fields[this_field].valueText, image_width: (page.width / 5), style: 'normal', size: 'medium', align: 'left', after: 1 });
              break;
            }
            case 'drop_down':
            case 'dropdown':
            case 'dropDown':
            case 'select&text':
            case 'select': {
              if (!fields[this_field].prompt.noPrint) {
                pdfLine(fields[this_field].prompt.value, { style: 'normal', size: 'medium', indent: 0, align: 'left', after: 0 });
                fields[this_field].selectionObj.selectionList.forEach((text, tIndex) => {
                  let radioSelected = false;
                  if (tIndex === 0) {
                    pdfLine(text, { radio: true, radioSelected, style: 'normal', size: 'medium', align: 'left', indent: 2, after: 0, noNewPage: true });
                  }
                  else {
                    pdfLine(text, { radio: true, radioSelected, style: 'normal', size: 'medium', align: 'left', indent: 10, after: 0, noNewLine: true, noNewPage: true });
                  }
                });
                if (printType === 'select&text') {
                  const text = `${fields[this_field].prompt.other || 'other'}:`;
                  pdfLine(text, { style: 'normal', size: 'medium', align: 'left', indent: 10, after: 0, noNewLine: true, noNewPage: true });
                  let endX = pdfCurrent.xPos + doc.getTextWidth('Sample text thats not too long');
                  doc.line(pdfCurrent.xPos - 6, pdfCurrent.yPos + 1, endX, pdfCurrent.yPos + 1, 'DF');
                  pdfCurrent.xPos = endX;
                }
                pdfDown(1);
                pdfStyle('reset');
              }
              break;
            }
            case 'header': {
              pdfLine(fields[this_field].prompt.value, { protectOrphan: true, style: 'italic', size: 'medium', align: 'left', before: 2, after: 1 });
              break;
            }
            case 'html': {
              await pdfHTML(`${fields[this_field].prompt.value}`,
                Object.assign({}, fields[this_field].prompt, {
                  before: -2,
                  printed_height: fields[this_field].prompt.printed_height,
                  print_scale: fields[this_field].prompt.print_scale || 1,
                  html: true,
                  style: 'normal',
                  size: 'medium',
                  align: 'left',
                  after: 1
                }));
              break;
            }
            case 'signature': {
              pdfCurrent.yPos += 12;
              pdfLine(`${fields[this_field].prompt.value}:  `, { style: 'normal', size: 'medium', align: 'left', after: 1 });
              pdfCurrent.xPos = page.margin.left;
              let endX = doc.getTextWidth('Sample text long enough to accomodate most situations');
              doc.rect(pdfCurrent.xPos, pdfCurrent.yPos - 4, endX, 40, 'S');
              pdfCurrent.xPos += endX;
              pdfCurrent.yPos += 42;
              break;
            }
            default: {
              if (fields.hasOwnProperty(this_field)) {
                const this_text = fields[this_field].prompt.value.split(/%%.*?%%/gm).join("").replace("  ", " ");
                pdfCurrent.yPos += 12;
                pdfLine(`${this_text}:  `, { style: 'normal', size: 'medium', align: 'left', after: 1 });
                let promptWidth = doc.getTextWidth(`${this_text}:  `);
                pdfCurrent.xPos += promptWidth;
                let endX = pdfCurrent.xPos + doc.getTextWidth('Sample text long enough to accomodate most situations');
                if (endX > (page.right)) {
                  pdfDown(2);
                  pdfCurrent.xPos += 10;
                  endX = pdfCurrent.xPos + doc.getTextWidth('Sample text long enough to accomodate most situations');
                }
                doc.line(pdfCurrent.xPos, pdfCurrent.yPos - 8, endX, pdfCurrent.yPos - 8, 'DF');
                pdfCurrent.xPos = endX;
              }
            }
          }
        }
      };
    };

    // Finish
    pdfLine(page.footerText, { size: 'tiny', after: 1, yPos: 'footer', align: 'center' });
    doc.save(docID);
    if (!options.multiPrint || (numberOfDocuments === docIndex)) {
      let pdfInfo = {
        s3Key: (`${page.client_id}_${page.document_id}.pdf`),
        s3Bucket: (options.S3_bucket || 'theseus-medical-storage')
      };
      pdfLine(`***** END *****`, { noNewPage: true, noNewLine: true, before: 1 });
      let pdfResp = await savePDF(doc, pdfInfo, { local: false, S3: true, onSave: false });
      if (pdfResp.responseData.s3Resp) {
        pdfInfo.s3Location = pdfResp.responseData.s3Resp.Location;
      }
      response.push(pdfInfo);
    }
  }
  return response;
}

export async function printDocumentHybrid({ documentList, options = {} }) {
  let response = [];
  if (!Array.isArray(documentList)) {
    documentList = [documentList];
  }
  let numberOfDocuments = documentList.length;
  // Prep the PDF output
  let docIndex = 0;
  for (const docInfo of documentList) {
    docIndex++;
    let { sections, fields, docID, client_id, title, signatures } = docInfo;
    await pdfLaunch({ client_id });
    page.title = title;
    page.document_id = docID;
    page.client_id = client_id;
    page.line_was_compressed = false;
    page.footerText = `AVA reference: ${page.client_id}_${page.document_id}`;
    pdfLine(' ', { align: 'center', image: pdfCurrent.logo });
    pdfLine(title, { style: 'bold', size: 'large', align: 'center', after: 1 });
    // eslint-disable-next-line
    //  sections.forEach((sectionObj, sectionNdx) => {
    for (const sectionObj of sections) {
      if (okToShowSection(sectionObj, fields)) {
        pdfLine(sectionObj.section_name, { protectOrphan: true, style: 'bold', size: 'medium', align: 'left', before: 4, after: 1 });
        for (const this_field of sectionObj.fields) {
          if (fields.hasOwnProperty(this_field) && !(fields[this_field].ignore) && !(fields[this_field].hidden)) {
            let printType = fields[this_field].type;
            switch (printType) {
              case 'upload':
              case 'image': {
                pdfLine(fields[this_field].prompt.value, { style: 'normal', size: 'medium', indent: 0, align: 'left', before: 1, after: 0 });
                pdfLine('', { image: fields[this_field].valueText, image_width: (page.width / 5), style: 'normal', size: 'medium', align: 'left', after: 1 });
                break;
              }
              case 'drop_down':
              case 'dropdown':
              case 'dropDown':
              case 'select&text':
              case 'select': {
                if (!fields[this_field].prompt.noPrint) {
                  if (page.line_was_compressed) {
                    pdfDown(1);
                    page.line_was_compressed = false;
                  }
                  if (fields[this_field].prompt.compressPrint) {
                    fields[this_field].prompt.value += ':';
                  }
                  pdfLine(fields[this_field].prompt.value, { style: 'normal', size: 'medium', indent: 0, align: 'left', after: 0 });
                  fields[this_field].selectionObj.selectionList.forEach((text, tIndex) => {
                    if (fields[this_field].value && fields[this_field].prompt.compressPrint) {
                      if (fields[this_field].value.includes(text)) {
                        pdfLine(text, { style: 'normal', indent: 2, after: 0, noNewLine: true });
                      }
                    }
                    else {
                      let radioSelected = fields[this_field].value && fields[this_field].value.includes(text);
                      if (tIndex === 0) {
                        pdfLine(text, { radio: true, radioSelected, style: 'normal', size: 'medium', align: 'left', indent: 2, after: 0, noNewPage: true });
                      }
                      else {
                        pdfLine(text, { radio: true, radioSelected, style: 'normal', size: 'medium', align: 'left', indent: 10, after: 0, noNewLine: true, noNewPage: true });
                      }
                    }
                  });
                  if (fields[this_field].bonusText) {
                    const text = `${fields[this_field].prompt.other || 'Other'}: ${fields[this_field].bonusText}`;
                    pdfLine(text, { radio: true, radioSelected: true, style: 'normal', size: 'medium', align: 'left', indent: 10, after: 0, noNewLine: true, noNewPage: true });

                  }
                  pdfDown(1);
                  pdfStyle('reset');
                }
                break;
              }
              case 'header': {
                pdfLine(fields[this_field].prompt.value, { protectOrphan: true, style: 'italic', size: 'medium', align: 'left', before: 2, after: 1 });
                break;
              }
              case 'html': {
                await pdfHTML(`${fields[this_field].prompt.value}`,
                  Object.assign({}, fields[this_field].prompt, {
                    before: -2,
                    printed_height: fields[this_field].prompt.printed_height,
                    print_scale: fields[this_field].prompt.print_scale || 1,
                    html: true,
                    style: 'normal',
                    size: 'medium',
                    align: 'left',
                    after: 1
                  }));
                break;
              }
              case 'signature': {
                if (signatures[fields[this_field].options.sigRefNumber]) {
                  await pdfImage(fields[this_field].prompt.value, { image: signatures[fields[this_field].options.sigRefNumber], style: 'normal', size: 'medium', align: 'left', after: 1 });
                }
                else {
                  pdfCurrent.yPos += 12;
                  pdfLine(`${fields[this_field].prompt.value}:  `, { style: 'normal', size: 'medium', align: 'left', after: 1 });
                  pdfCurrent.xPos = page.margin.left;
                  let endX = doc.getTextWidth('Sample text long enough to accomodate most situations');
                  doc.rect(pdfCurrent.xPos, pdfCurrent.yPos - 4, endX, 40, 'S');
                  pdfCurrent.xPos += endX;
                  pdfCurrent.yPos += 42;
                }
                break;
              }
              default: {
                if (fields.hasOwnProperty(this_field)) {
                  if (page.line_was_compressed && !fields[this_field].prompt.compressPrint) {
                    pdfDown(1);
                    page.line_was_compressed = false;
                  }
                  if (fields[this_field].valueText.length > 0) {
                    if (fields[this_field].prompt.compressPrint) {
                      pdfLine(fields[this_field].valueText,
                        { style: 'normal', size: 'medium', align: 'left', noNewLine: fields[this_field].prompt.noNewLine || false });
                      page.line_was_compressed = true;
                    }
                    else if (fields[this_field].prompt.value.includes(fields[this_field].valueText)) {
                      pdfLine(`${fields[this_field].prompt.value}`,
                        { style: 'normal', size: 'medium', align: 'left', before: 1, after: 1 });
                    }
                    else {
                      pdfLine(`${fields[this_field].prompt.value}: ${fields[this_field].valueText}`,
                        { style: 'normal', size: 'medium', align: 'left', before: 1, after: 1 });
                    }
                  }
                  else {
                    const this_text = fields[this_field].prompt.value.split(/%%.*?%%/gm).join("").replace("  ", " ");
                    pdfCurrent.yPos += 12;
                    pdfLine(`${this_text}:  `, { style: 'normal', size: 'medium', align: 'left', after: 1 });
                    let promptWidth = doc.getTextWidth(`${this_text}:  `);
                    pdfCurrent.xPos += promptWidth;
                    let endX = pdfCurrent.xPos + doc.getTextWidth('Sample text long enough to accomodate most situations');
                    if (endX > (page.right)) {
                      pdfDown(2);
                      pdfCurrent.xPos += 10;
                      endX = pdfCurrent.xPos + doc.getTextWidth('Sample text long enough to accomodate most situations');
                    }
                    doc.line(pdfCurrent.xPos, pdfCurrent.yPos - 8, endX, pdfCurrent.yPos - 8, 'DF');
                    pdfCurrent.xPos = endX;
                  }
                }
              }
            }
          }
        };
      }
    };

    // Finish
    pdfLine(page.footerText, { size: 'tiny', after: 1, yPos: 'footer', align: 'center' });
    doc.save(docID);
    if (!options.multiPrint || (numberOfDocuments === docIndex)) {
      let pdfInfo = {
        s3Key: (`${page.client_id}_${page.document_id}.pdf`),
        s3Bucket: (options.S3_bucket || 'theseus-medical-storage')
      };
      pdfLine(`***** END *****`, { noNewPage: true, noNewLine: true, before: 1 });
      let pdfResp = await savePDF(doc, pdfInfo, { local: false, S3: true, onSave: false });
      if (pdfResp.responseData.s3Resp) {
        pdfInfo.s3Location = pdfResp.responseData.s3Resp.Location;
      }
      response.push(pdfInfo);
    }
  }
  return response;
}


export async function factForm(serviceRequestRec) {
  /*
  serviceRequestRec.original_request: {
            selections,
            options,
            textInput,
            image_location,
            images
          },
  */
  // Standard 8.5 x 11 output for a Request of any type
  // Prep the PDF output
  let page = {};
  await pdfLaunch(Object.assign({}, { client_id: serviceRequestRec.client_id }));

  let htmlMessage = `<h1 style="color: #5e9ca0;"><span style="color: #000000;">${page.title}</span></h1>`;
  let rawMessage = `${page.title}\n\r`;
  pdfLine(' ', { align: 'center', image: pdfCurrent.logo });
  pdfLine(page.title, { style: 'bold', size: 'large', align: 'center', after: 1 });

  // Person
  let pRec = await getPerson(serviceRequestRec.requestor);

  let authorName = await makeName(serviceRequestRec.requestor);
  let pName = (serviceRequestRec.onBehalfOf || authorName).replace(/\(.+\)/g, '').trim();  // this removes anything inside parenthesis
  // does the title contain all of the words in the obo?
  let tLower = page.title.toLowerCase();
  let oboWords = pName.toLowerCase().split(/\s+/);
  let allWordsAppear = oboWords.every(oboWord => {
    return (tLower.includes(oboWord));
  });
  if (!allWordsAppear) {
    htmlMessage += `<h2 style = "color: black;" >${pName}`;
    rawMessage += `${pName}\n`;
    pdfLine(`for ${pName}`, { style: 'normal', align: 'center', size: 'large' });
  }

  if (pRec.location) {
    htmlMessage += `<br />${pRec.location}`;
    rawMessage += `${pRec.location}\n`;
    pdfLine(pRec.location, { align: 'center' });
  }
  htmlMessage += `</h2>`;

  if (!serviceRequestRec.requestDate) {
    serviceRequestRec.requestDate = new Date();
  }
  let pDateTime = makeDate(serviceRequestRec.requestDate).absolute;

  // get creator info - most reliable spot is first characters of the request id
  let creator_id = serviceRequestRec.request_id.split('~')[0];
  if (creator_id !== serviceRequestRec.author) {
    pDateTime += ` by ${await makeName(creator_id)}`;
  }
  htmlMessage += `<p style = "color: black;">created: <strong>${pDateTime}</strong>`;
  rawMessage += `${pDateTime}\n\r`;
  pdfLine(`created: ${pDateTime}`, { size: 'medium', align: 'center' });

  for (let cTyp in pRec.messaging) {
    if ((pRec[cTyp]) && (pRec[cTyp].trim() !== '')) {
      let cLab;
      switch (cTyp) {
        case 'sms': { cLab = 'cell'; break; }
        case 'voice': { cLab = 'home'; break; }
        case 'email': { cLab = 'e-Mail'; break; }
        default: { cLab = cTyp; }
      }
      htmlMessage += `<br />${cLab}: <strong>${pRec[cTyp]}</strong>`;
      pdfLine(`${pRec[cTyp]}`, { align: 'center' });
    }
  }
  pdfDown(2);

  htmlMessage += '</p><h2 style = "color: black;" >** AVA **</h2>';
  rawMessage += '\n\r** AVA **\n\r';

  let spaceBetweenLines = 25;
  let renderCheckBox = '';

  let formattedRequestObj = formatServiceRequestDetails(serviceRequestRec);
  for (const [this_selection, optionList] of Object.entries(formattedRequestObj)) {
    htmlMessage += `<dt style="font-size: 1.2em; color: black;">${renderCheckBox}<strong>&nbsp;&nbsp;&nbsp;${sentenceCase(this_selection)}</dt>`;
    rawMessage += `\n${this_selection}\n`;
    pdfStyle('reset');
    pdfLine(this_selection, { before: 1 });
    // eslint-disable-next-line
    optionList.forEach(this_option => {
      htmlMessage += `<dd>${titleCase(this_option)}</dd>`;
      rawMessage += `${titleCase(this_option)}\n`;
      pdfLine(`${titleCase(this_option)}`, { noNewLine: true, italic: true, before: 1, indent: 15, size: 'small' });
    });
    if ((serviceRequestRec.original_request.images) && (serviceRequestRec.original_request.images.hasOwnProperty(this_selection))) {
      pdfLine(' ', { align: 'left', image: serviceRequestRec.original_request.images[this_selection] });
      rawMessage += `<Signature Captured>\n`;
      htmlMessage += `<img src="${serviceRequestRec.original_request.images[this_selection]}" />`;
    }
  };

  pdfStyle('reset');

  htmlMessage += `</dl><p style="padding-top:${(spaceBetweenLines * 1.5).toString()}px;">`;

  // Finish
  let refText = `AVA reference: ${serviceRequestRec.client_id}/${serviceRequestRec.request_id} (${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()})`;
  if (serviceRequestRec.local_key) {
    htmlMessage += `<div>AVA request number: <strong>${serviceRequestRec.local_key}</strong></div>`;
    rawMessage += `\n\rAVA request number: ${serviceRequestRec.local_key}`;
    pdfLine(`AVA request number: ${serviceRequestRec.local_key}`, { size: 'tiny', after: 1, yPos: 'footer', align: 'center' });
    pdfLine(refText, { noNewPage: true, noNewLine: true, before: 1, align: 'center' });
  }
  else {
    pdfLine(refText, { noNewPage: true, yPos: 'footer', align: 'center' });
  }

  htmlMessage += `<div>${refText}</div>`;
  htmlMessage += `<div>***** END *****</div></p>`;
  rawMessage += `\n\r${refText}\n***** END *****`;

  return {
    html: htmlMessage,
    plainText: rawMessage,
    pdf: doc
  };
}

export async function html_to_pdf(body) {
  let doc = new jsPDF({
    orientation: "portrait",
    unit: "px",
    format: ((body.pageWidth) ? [body.pageWidth, (body.pageHeight || 9999)] : [1020, 1320])
  });
  let finalHTML = body.htmlText.replace(/<p/gi, '<p style="font-size:10px; width: 1000px; margin: 60px"');
  await doc.html(finalHTML, {
    callback: function (doc) {
      doc.save();
    },
    autoPaging: 'text'
  });
  let pdfInfo = {
    s3Key: `AVA_${body.messageKey.replace('~', '_')}.pdf`,
    s3Bucket: (body.S3_bucket || 'theseus-medical-storage')
  };
  let pdfResp = await savePDF(doc, pdfInfo, { local: false, S3: true });
  if (pdfResp.responseData.s3Resp) {
    return pdfResp.responseData.s3Resp.Location;
  }
  else {
    return null;
  } 
}

export async function buildDocument(body) {
  // instructions for the document lines are in body.format.source
  let printInstructions = deepCopy(body.format.source);
  if (printInstructions.length === 0) {
    return [];
  }
  // Standard 8.5 x 11 output for a Request of any type
  // Prep the PDF output
  if (!body.margin) { body.margin = {}; }
  let callBody = Object.assign({}, body, body.selections, body.images);

  await pdfLaunch(Object.assign({}, body, { client_id: (body.client || body.client_id) }));

  let htmlMessage = '';
  let rawMessage = '';

  if (body.format.logo) {
    htmlMessage += `<div style="text-align:center">`;
    let logo_dimensions = [150, 100];
    if (body.logo_dimensions) {
      logo_dimensions = body.logo_dimensions;
    }
    htmlMessage += `<img src="${pdfCurrent.logo}" width="${logo_dimensions[0]}px" height="${logo_dimensions[1]}px" />`;
    htmlMessage += `</div>`;
    let image64 = await getObject64(pdfCurrent.logo);
    pdfLine(' ', { image: image64, align: 'center' });
    pdfStyle('reset');
  }

  if (body.format.title) {
    htmlMessage += `<h1 style="color: #5e9ca0;"><span style="color: #000000;">${body.format.title}</span></h1>`;
    rawMessage = `${body.format.title}\n\r`;
    pdfLine(pdfLine(body.format.title, { size: 'medium', bold: true }));
  }

  let ignoreNextLine = false;
  do {
    let this_instruction = printInstructions.shift();
    if (this_instruction.charAt(0) === '~') {
      let [instruction_type, instruction_key] = this_instruction.substring(1).split('=');
      if (instruction_type === 'if') {
        ignoreNextLine = true;
        if (body.request.selections.includes(instruction_key)) {
          // test is true, so respect the next lines (don't ignore)
          ignoreNextLine = false;
        }
        else {
          for (let selection in body.request.options) {
            for (let option in body.request.options[selection]) {
              if (body.request.options[selection][option][instruction_key]) {
                ignoreNextLine = false;
              }
            }
          }
          if (body.textInput[instruction_key]) {
            ignoreNextLine = false;
          }
        }
      }
      else if (instruction_type === 'else') {
        ignoreNextLine = !ignoreNextLine;
      }
      else if (instruction_type === 'end') {
        ignoreNextLine = false;
      }
      else if (!ignoreNextLine) {
        switch (instruction_type) {
          case 'includeObservationItems': {
            let lines = await getObservationItems(instruction_key);
            if (lines) {
              let lineKeys = Object.keys(lines).sort((a, b) => {
                if (Number(a.split(":")[1]) > Number(b.split(":")[1])) {
                  return 1;
                }
                else {
                  return -1;
                }
              });
              // eslint-disable-next-line
              lineKeys.forEach(lineKey => {
                htmlMessage += `<div>${lines[lineKey].display_value}</div>`;
                rawMessage += lines[lineKey].display_value;
                pdfLine(lines[lineKey].display_value, { html: true, size: 'medium' });
              });
            }
            break;
          }
          case 'down': {
            pdfDown(Number(instruction_key));
            break;
          }
          case 'if': {
            let testSucceeded = false;
            if (body.request.selections.includes(instruction_key)) {
              // test is true, so respect the next lines (don't ignore)
              testSucceeded = true;
            }
            else {
              for (let selection in body.request.options) {
                for (let option in body.request.options[selection]) {
                  if (body.request.options[selection][option][instruction_key]) {
                    testSucceeded = true;
                  }
                }
              }
              if (body.textInput[instruction_key]) {
                testSucceeded = true;
              }
            }
            // all tests failed; this test is false;  ignore subsequent lines
            ignoreNextLine = !testSucceeded;
            break;
          }
          case 'upload':
          case 'image': {
            let outImage = await resolveMessageVariables(instruction_key, callBody);
            pdfLine(' ', { image: outImage });
            htmlMessage += `<div >`;
            htmlMessage += `<img src="${instruction_key}"  />`;
            htmlMessage += `</div>`;
            break;
          }
          default: { }
        }
      }
    }
    else if (!ignoreNextLine) {
      let outText = await resolveMessageVariables(this_instruction, callBody);
      pdfLine(outText, { size: 'medium' });
    }
  } while (printInstructions.length > 0);

  // Finish

  let refText = `AVA reference: ${body.client || body.client_id}/${body.requestID} (${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()})`;
  if (body.local_key) {
    htmlMessage += `<div>AVA request number: <strong>${body.local_key}</strong></div>`;
    rawMessage += `\n\rAVA request number: ${body.local_key}`;
    pdfLine(`AVA request number: ${body.local_key}`, { size: 'tiny', after: 1, yPos: 'footer', align: 'center' });
    pdfLine(refText, { noNewPage: true, noNewLine: true, before: 1, align: 'center' });
  }
  else {
    pdfLine(refText, { noNewPage: true, yPos: 'footer', align: 'center' });
  }

  htmlMessage += `<div>${refText}</div>`;
  htmlMessage += `<div>***** END *****</div></p>`;
  rawMessage += `\n\r${refText}\n***** END *****`;

  if (body.fileName && body.fileName.slice(-4) !== '.pdf') {
    body.fileName += '.pdf';
  }

  let pdfInfo = {
    s3Key: (body.fileName || `AVA_${body.requestID.replace('~', '_')}.pdf`),
    s3Bucket: (body.S3_bucket || 'theseus-medical-storage')
  };

  let s3Resp;
  if (!body.multiPrint || body.multiPrint.lastDoc) {
    pdfLine(`***** END *****`, { noNewPage: true, noNewLine: true, before: 1 });

    let this_method = body.overrideMethod || body.messaging?.format?.method || body.messaging[0].format.method;;
    let pdfResp = await savePDF(doc, pdfInfo, { local: !body.PDF, S3: true, onSave: this_method });
    if (pdfResp.responseData.s3Resp) {
      pdfInfo.s3Location = pdfResp.responseData.s3Resp.Location;
    }

    let pBlob = doc.output('blob');
    let data64 = (doc.output('datauri')).split(';base64,')[1];
    let fileName = `${body.client || body.client_id}_${body.local_key}_${body.fileName || 'document'}.pdf`;
    s3Resp = await s3
      .upload({
        Bucket: 'theseus-medical-storage',
        Key: fileName,
        Body: pBlob,
        ACL: 'public-read-write',
        ContentType: 'application/pdf'
      })
      .promise()
      .catch(err => {
        cl(`PDF not saved by AVA.  The reason is ${err.message}`);
      });
    s3Resp.data = data64;

  }
  return [htmlMessage, rawMessage, s3Resp];
}


export async function savePDF(doc, pdfInfo, options = {}) {
  let s3Resp;
  let responseStatus = 400;
  let responseData = { message: [] };
  if (options.S3) {
    let goodS3 = true;
    s3Resp = await s3
      .upload({
        Bucket: pdfInfo.s3Bucket,
        Key: pdfInfo.s3Key,
        Body: doc.output('blob'),
        ACL: 'public-read-write',
        ContentType: 'application/pdf'
      })
      .promise()
      .catch(err => {
        cl(`PDF not saved by AVA.  The reason is ${err.message}`);
        goodS3 = false;
        responseStatus = 401;
        responseData.message = err.message;
      });
   // window.open(s3Resp.Location);
   // for (let this_attachment of attachments) {
   //   window.open(this_attachment);
   // };
    attachments = [];
    if (goodS3) {
      if (options.onSave === 'print') {
        window.open(s3Resp.Location);
      }
      responseStatus = 200;
      responseData.message.push(`S3 saved at ${s3Resp.Location}`);
      responseData.s3Resp = s3Resp;
    }
  }
  if (options.local) {
    doc.save(pdfInfo.s3Key);
    for (let this_attachment of attachments) {
      doc.save(this_attachment);
    }

    responseStatus++;
    responseData.message.push(`Locally saved as ${pdfInfo.s3Key}`);
    responseData.saveName = pdfInfo.s3Key;
  }
  return {
    responseStatus,
    responseData
  };

}

export async function mealTicketFormat(body, requestRec = {}) {

  // *********** GET ALL REQ THAT MATCH LOCAL_KEY IN THE BODY *********** //
  let seat_key = body.tableNumberKey || 'Seat Assignment';
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
  if (requestList.length === 0) {
    if (Object.keys(requestRec).length > 0) {
      requestList.push(requestRec);
    }
    else {
      return null;
    }
  }
  //  Sort the requests
  requestList.sort((a, b) => {
    let aSort, bSort;
    if (a.original_request.textInput && a.original_request.textInput[seat_key]) {
      aSort = a.original_request.textInput[seat_key];
    }
    if (b.original_request.textInput && b.original_request.textInput[seat_key]) {
      bSort = b.original_request.textInput[seat_key];
    }
    return ((aSort < bSort) ? -1 : 1);
  });

  // Prep the PDF output
  let htmlText = [];
  let plainText = [];
  if (!body.margin) { body.margin = {}; }
  let page = {
    width: body.pageWidth || 160,
    border: body.border || true,
    font: {
      family: 'Helvetica',
      size: { large: 14, medium: 12, small: 10, tiny: 8 }
    },
    layout: body.orientation || 'portrait',
    info: { author: 'AVA Senior Living', title: 'Meal Ticket' },
    margin: {
      top: body.margin.top || 42,
      bottom: body.margin.bottom || 14,
      left: body.margin.left || 4,
      right: body.margin.right || 4
    }
  };
  page.printableArea = page.width - page.margin.left - page.margin.right;
  let yPos = page.margin.top;
  let style = `"padding-top: ${page.margin.top}px; padding-bottom: ${page.margin.bottom}px; width: ${page.width}px; font-family: ${page.font.family}; ${page.border ? 'border: 2px solid black;' : ''} color: black; padding-left: ${page.margin.left}px; padding-right: ${page.margin.right}px"`;
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "px",
    // format: [page.width, page.width * 3]
    format: [page.width, page.width * Math.max(3, requestList.length * 1.15)]
  });

  htmlText.push(`<body style=${style}>`);

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
  if (body.reprint) { titleWords = '*** REPRINT ' + titleWords + ' ***'; };
  style = `"text-align:center; font-size: ${page.font.size.large};"`;
  let outTitle = titleCase(titleWords);
  pdfLineMealTicket(outTitle, page.font.size.large, 'normal', 0, 0, 0, { align: 'center' });
  htmlText.push(`<div style=${style}><b>${outTitle}</b></div>`);
  plainText.push(outTitle);
  if (body.client_name) {
    let outClientName = titleCase(body.client_name);
    pdfLineMealTicket(outClientName, page.font.size.large, 'normal', 0, 0, 0, { align: 'center' });
    htmlText.push(`<div style=${style}><b>${outClientName}</b></div>`);
    plainText.push(outClientName);
  }

  htmlText.push(`<br />`);
  plainText.push(' ');

  // ********** HEADER ********** //
  // Pick-off the first request for Header info for the ticket
  let this_request = requestList[0];
  let [author_id, order_timestamp] = this_request.request_id.split('~');
  let author_name = await makeName(author_id);
  let table_key = body.tableNumberKey || 'Table Number';
  let location_key = body.locationKey || 'Room Number';
  style = `"text-align:center; font-size: ${page.font.size.small};"`;
  let outAuthor = titleCase(author_name);
  pdfLineMealTicket(`Created by: ${outAuthor}`, page.font.size.small, 'normal', 0, -0.2, 0, { align: 'center' });
  htmlText.push(`<dt style=${style}>Created by: ${outAuthor}</dt>`);
  plainText.push(outAuthor);
  let outTime = makeDate(order_timestamp).absolute;
  pdfLineMealTicket(`${outTime}`, page.font.size.small, 'normal', 0, 0, 0, { align: 'center' });
  htmlText.push(`<dt style=${style}>${outTime}</dt>`);
  plainText.push(outTime);
  if (this_request.original_request.textInput && this_request.original_request.textInput[table_key]) {
    pdfLineMealTicket(`Table: ${this_request.original_request.textInput[table_key]}`, page.font.size.small, 'bold', 0, 0, 0, { align: 'center' });
    htmlText.push(`<dt style=${style}><b>Table: ${this_request.original_request.textInput[table_key]}</b></dt>`);
    plainText.push(`Table: ${this_request.original_request.textInput[table_key]}`);
  }
  if (this_request.original_request.textInput && this_request.original_request.textInput[location_key]) {
    pdfLineMealTicket(`Room: ${this_request.original_request.textInput[location_key]}`, page.font.size.small, 'bold', 0, 0, 0, { align: 'center' });
    htmlText.push(`<dt style=${style}><b>Room: ${this_request.original_request.textInput[location_key]}</b></dt>`);
    plainText.push(`Room: ${this_request.original_request.textInput[location_key]}`);
  }

  htmlText.push(`</p>`);

  // ********** ORDERS ********** //
  for (let r = 0; r < requestList.length; r++) {
    let this_request = requestList[r];
    let requestor = this_request.on_behalf_of;
    if (!requestor) { requestor = await makeName(this_request.requestor); }
    htmlText.push(`<p style="padding-top: 1.5em;">`);
    plainText.push(' ');
    style = `"font-size: ${page.font.size.medium}; padding-top: 0.5em;"`;
    let outSeat = '';
    if (this_request.original_request.textInput && this_request.original_request.textInput[seat_key]) {
      outSeat = this_request.original_request.textInput[seat_key] + ' - ';
    }
    let outRequestor = outSeat + titleCase(requestor);
    pdfLineMealTicket(outRequestor, page.font.size.medium, 'bold', 0, 1);
    htmlText.push(`<div style=${style}><b>${outRequestor}</b></div>`);
    plainText.push(outRequestor);
    // eslint-disable-next-line
    this_request.original_request.selections.forEach(s => {
      style = `"font-size: ${page.font.size.medium}; padding-top: 0.5em; padding-left: 0;"`;
      let [selection, ...options] = s.split(/[();,]/);
      if (this_request.original_request.hasOwnProperty('qualifiers')
        && this_request.original_request.qualifiers.hasOwnProperty(selection.trim())
      ) {
        Object.values(this_request.original_request.qualifiers[selection.trim()]).forEach(choiceList => {
          choiceList.forEach(choice => {
            if (!options.includes(choice)) {
              options.push(choice);
            }
          });
        });
      }
      pdfLineMealTicket(selection, page.font.size.medium, 'normal');
      htmlText.push(`<div style=${style}>${selection}</div>`);
      plainText.push(selection);
      if (options.length > 0) {
        style = `"font-size: ${page.font.size.medium}; padding-left: 2em;"`;
        options.forEach((o, i) => {
          let outO = titleCase(o.trim());
          if (outO !== '') {
            pdfLineMealTicket(outO, page.font.size.small, 'normal', 1, (i === 0 ? -0.2 : -0.1), ((i === (options.length - 1)) ? 0.2 : 0));
            htmlText.push(`<div style=${style}><i>${outO}</i></div>`);
            plainText.push(outO);
          }
        });
      }
    });
    for (let field in this_request.original_request.textInput) {
      if ((field !== table_key) && (field !== seat_key) && (field !== location_key)) {
        let tLine = `>>> ${this_request.original_request.textInput[field]} <<<`;
        pdfLineMealTicket(tLine, page.font.size.medium, 'normal', 0, 1);
        style = `"font-size: ${page.font.size.medium}; padding-top: 0.5em;"`;
        htmlText.push(`<div style=${style}><i>${tLine}</i></div>`);
        plainText.push(`--${tLine}`);
      }
    }
    htmlText.push(`</p>`);
  }

  // ********** INITIALS ********** //
  if (body.initials) {
    pdfLineMealTicket('Initials _________', page.font.size.medium, 'normal', 0, 2, 1);
    htmlText.push(`<p style="font-size: ${page.font.size.medium}; padding-top: 4em;">Initials _________</p>`);
    plainText.push(' ');
    plainText.push(' ');
    plainText.push('Initials _________');
  }

  // ********** FOOTERS ********** //
  pdfLineMealTicket('AVA Senior Living', page.font.size.tiny, 'normal', 0, 2, 0, { align: 'center' });
  pdfLineMealTicket(`ID ${this_request.local_key}`, page.font.size.tiny, 'normal', 0, 0, 0, { align: 'center' });
  pdfLineMealTicket('****** END ******', page.font.size.tiny, 'normal', 0, 0, 4, { align: 'center' });
  htmlText.push(`<p style="padding-top: 1.5em;">`);
  style = `"font-size: ${page.font.size.tiny}; text-align:center;"`;
  htmlText.push(`<div style=${style}>${this_request.local_key}/${this_request.request_id}</div>`);
  htmlText.push(`<div style=${style}>AVA Senior Living</div>`);
  htmlText.push(`<div style=${style}>****** END ******</div>`);
  htmlText.push(`</p>`);
  plainText.push(' ');
  plainText.push(' ');
  plainText.push(`${this_request.local_key}/${this_request.request_id}`);
  plainText.push(`AVA Senior Living`);
  plainText.push(`****** END ******`);

  htmlText.push(`</body>`);

  doc.rect(page.margin.left - 2, page.margin.top - page.font.size.large - 2, page.width - 4, yPos - page.margin.top);

  let pBlob = doc.output('blob');
  let data64 = (doc.output('datauri')).split(';base64,')[1];
  let fileName = `${body.client || body.client_id}_${this_request.local_key}_mealticket.pdf`;
  let s3Resp = await s3
    .upload({
      Bucket: 'theseus-medical-storage',
      Key: fileName,
      Body: pBlob,
      ACL: 'public-read-write',
      ContentType: 'application/pdf'
    })
    .promise()
    .catch(err => {
      cl(`PDF not saved by AVA.  The reason is ${err.message}`);
    });
  // await doc.save(fileName, { returnPromise: true });
  s3Resp.data = data64;

  return [htmlText.join(''), plainText.join('\n'), s3Resp];

  function pdfLineMealTicket(text, size, style, indent = 0, before, after, options) {
    if (style) { doc.setFont(page.font.family, style); }
    let lastSize = page.font.size.medium;
    if (size) {
      doc.setFontSize(size);
      lastSize = size;
    }
    if (before) { yPos += before * size; }
    let i = 0;
    if (indent) { i = indent * page.font.size.medium; }
    do {
      let nextLine;
      if (doc.getTextWidth(text) > page.printableArea) {
        let OGtext = text;
        let tWords = text.split(/\s+/);
        let firstLine = text;
        do {
          tWords.pop();
          firstLine = tWords.join(' ');
        } while (doc.getTextWidth(firstLine) > (page.printableArea - 15));
        text = firstLine;
        nextLine = OGtext.slice(text.length + 1);
      }
      if (options) {
        if (options.align === 'center') { doc.text(text, page.width / 2, yPos, options); }
        else { doc.text(text, page.margin.left + i, yPos, options); }
      }
      else { doc.text(text, page.margin.left + i, yPos); }
      yPos += lastSize;
      text = nextLine;
    } while (text);
    if (after) { yPos += (after * size); }
    return;
  }
}

async function pdfLaunch(body) {
  if (!body.hasOwnProperty('pdf')) { body.pdf = {}; }
  if (!doc || !body.multiPrint || body.multiPrint.firstDoc) {
    doc = new jsPDF({
      orientation: "portrait",
      unit: "px",
      format: ((body.pdf.pageWidth) ? [body.pdf.pageWidth, (body.pdf.pageHeight || 9999)] : [563, 750])
    });
  }
  else {
    doc.addPage({
      orientation: "portrait",
      format: ((body.pdf.pageWidth) ? [body.pdf.pageWidth, (body.pdf.pageHeight || 9999)] : [563, 750])
    });
  }
  // doc.autoPrint();
  page = {
    width: doc.internal.pageSize.width,
    height: doc.internal.pageSize.height,
    center: (doc.internal.pageSize.width / 2),
    border: (body.pdf.hasOwnProperty('border')) ? body.pdf.border : true,
    font: {
      family: 'Helvetica',
      size: { large: 14, medium: 12, small: 10, tiny: 8 }
    },
    layout: (body.pdf.hasOwnProperty('orientation')) ? body.pdf.orientation : 'portrait',
    info: { author: 'AVA Senior Living' },
    margin: {
      top: (body.pdf.margin && body.pdf.margin.top) || (doc.internal.pageSize.height / 20),
      bottom: (body.pdf.margin && body.pdf.margin.bottom) || (doc.internal.pageSize.height / 15),
      left: (body.pdf.margin && body.pdf.margin.left) || (doc.internal.pageSize.width / 12),
      right: (body.pdf.margin && body.pdf.margin.right) || (doc.internal.pageSize.width / 12)
    }
  };
  page.bottom = page.height - (2 * page.margin.bottom);
  page.right = page.width - page.margin.right;
  page.centerPoint = page.width / 2;
  page.printableArea = page.width - page.margin.left - page.margin.right;

  if (body.pdf?.title) {
    page.title = (await resolveMessageVariables(body.pdf.title, body)).replace(/\(.+\)/g, '').trim();
  }
  else if (body.subject) {
    page.title = (await resolveMessageVariables(body.subject, body)).replace(/\(.+\)/g, '').trim();
  }
  else if (body.format?.subject) {
    page.title = (await resolveMessageVariables(body.format.subject, body)).replace(/\(.+\)/g, '').trim();
  }
  else if (body.activityName) {
    page.title = await resolveMessageVariables(body.activityName, body);
  }
  else {
    page.title = 'AVA Senior Living';
  }
  if (body.reprint) {
    page.title = `*** REPRINT ${page.title} ***`;
  };
  page.info.title = page.title;
  clt({ page });

  let nowTime = makeDate(new Date());
  pdfCurrent = {
    yPos: page.margin.top,
    xPos: page.margin.left,
    pageNumber: ((body.multiPrint && !body.multiPrint.firstDoc) ? doc.internal.getNumberOfPages() + 1 : 1),
    indent: 0,
    reportTime: nowTime.absolute,
    timestamp: nowTime.numeric24
  };
  let customizations = await getCustomizations('*all', body.client || body.client_id);
  if (customizations['client_name']) {
    pdfCurrent.client_name = customizations['client_name'];
  }
  else {
    pdfCurrent.client_name = `Client = ${body.client || body.client_id}`;
  };
  if (customizations['print']) {
    let print_specs = customizations['print'];
    if (print_specs.size) {
      page.font.size = {
        large: ((print_specs.size <= 5) ? 20 * print_specs.size : print_specs.size),
        medium: ((print_specs.size <= 5) ? 16 * print_specs.size : print_specs.size),
        small: ((print_specs.size <= 5) ? 12 * print_specs.size : print_specs.size),
        tiny: ((print_specs.size <= 5) ? 8 * print_specs.size : print_specs.size),
      };
    }
  }
  else {
    pdfCurrent.client_name = `Client = ${body.client || body.client_id}`;
  };
  if (customizations['logo']) {
    pdfCurrent.logo = getObject(customizations['logo'], 'logo');
    //    pdfCurrent.logo64 = await getObject64(customizations['logo'], 'logo');
    if (customizations['logo_dimensions']) {
      pdfCurrent.logo_width = customizations['logo_dimensions'][0] / 2;
      pdfCurrent.logo_height = customizations['logo_dimensions'][1] / 2;
    }
    else {
      pdfCurrent.logo_width = 75;
      pdfCurrent.logo_height = 75;
    }
  }
  pdfStyle('reset');
}

function pdfHeader(pageN) {
  clt({ pdfCurrent });
  let savedStyle = Object.assign({}, pdfCurrent);
  pdfCurrent.yPos = page.margin.top;
  if (pageN > 1) {
    pdfStyle('reset');
    doc.addPage({
      orientation: "portrait",
      unit: "px",
      format: (page.width ? [page.width, page.height] : 'letter')
    });
    pdfDown(2);
  }
  else if (pdfCurrent.logo) {
    //     doc.addImage(pdfCurrent.logo, 'PNG', page.center - (pdfCurrent.logo_width / 2), pdfCurrent.yPos, pdfCurrent.logo_width, pdfCurrent.logo_height);
    //     pdfCurrent.yPos += pdfCurrent.logo_height;
  }
  pdfStyle({ size: 'large', align: 'center', style: 'bold' });
  doc.text(page.title, page.center, pdfCurrent.yPos, { align: 'center' });
  pdfDown(1);
  if (pageN > 1) {
    pdfStyle({ size: 'small', before: 1 });
    doc.text(`Page ${pdfCurrent.pageNumber}`, page.width / 2, pdfCurrent.yPos - 3, { align: 'center' });
    pdfDown(4);
    if (pdfCurrent.key) {
      pdfStyle({ size: 'medium', align: 'left', style: 'bold' });
      doc.text(titleCase(pdfCurrent.key), page.margin.left, pdfCurrent.yPos);
      let newX = page.margin.left + doc.getTextWidth(titleCase(pdfCurrent.key)) + 5;
      pdfStyle({ size: 'small', style: 'normal' });
      doc.text('(continued)', newX, pdfCurrent.yPos);
    }
    pdfStyle('reset');
    pdfCurrent = Object.assign({}, savedStyle, { yPos: pdfCurrent.yPos });
    pdfStyle(pdfCurrent);
  }
  else {
    pdfStyle('reset');
    pdfDown(2);
  }
}

async function pdfHTML(text, options = {}) {
  clt({ pdfLine: text, options });
  if (options) { pdfStyle(options); }
  if (options.before) { pdfDown(options.before); }
  if (options.yPos && !isNaN(options.yPos)) {
    pdfCurrent.yPos = options.yPos;
  }
  else if (options.yPos && (options.yPos === 'footer')) {
    pdfCurrent.yPos = page.height - page.margin.bottom - 20;
    pdfCurrent.xPos = page.margin.left;
    options.noNewPage = true;
  }
  else if (options.yPos && (options.yPos === 'header')) {
    pdfCurrent.yPos = page.margin.top;
    options.noNewPage = true;
  }
  else if (!options.noNewLine) {
    pdfDown(1);
  }
  if (!options.noNewPage && (pdfCurrent.yPos >= page.bottom)) {
    let savedStyle = Object.assign({}, pdfCurrent);
    pdfLine(page.footerText, { size: 'tiny', after: 1, yPos: 'footer', align: 'center' });
    pdfCurrent = Object.assign({}, savedStyle, { yPos: pdfCurrent.yPos });
    pdfStyle(pdfCurrent);
    pdfHeader(++pdfCurrent.pageNumber);
  }
  /** calculate the imgWidth, imgHeight to print on PDF 
   *  so it can scale in equal proportions*/
  let estimated_rows_needed;
  if (options.printed_height) {
    estimated_rows_needed = options.printed_height + 2;
  }
  else {
    let sizeEstimate = doc.getTextWidth(text);
    estimated_rows_needed = Math.ceil(sizeEstimate / page.width) + (text.split('<p').length * 2) + 2;
  }
  let estimated_y_units_needed = estimated_rows_needed * (pdfCurrent.fontSize * 0.75);
  let scale_factor = options.print_scale || 1;

  pdfCurrent.yPos += (options.print_ypos || 1);
  pdfCurrent.xPos = page.margin.left + (options.print_xpos || 0);

  // estimate the ending y position and shrink if needed to fit on the current page
  if ((estimated_y_units_needed + pdfCurrent.yPos) > (page.height - page.margin.top - page.margin.bottom)) {
    let remaining_y_units = page.height - page.margin.bottom - pdfCurrent.yPos;
    scale_factor = remaining_y_units / estimated_y_units_needed;
    if (scale_factor < 0.6) {   // if we are going to shrink too much, jump to next page and reset scale
      let savedStyle = Object.assign({}, pdfCurrent);
      pdfLine(page.footerText, { size: 'tiny', after: 1, yPos: 'footer', align: 'center' });
      pdfCurrent = Object.assign({}, savedStyle, { yPos: pdfCurrent.yPos });
      pdfStyle(pdfCurrent);
      pdfHeader(++pdfCurrent.pageNumber);
      scale_factor = 1;
    }
  }

  const BOLD = '';  // "\x1b[1m";
  const NORMAL = '';   // "\x1b[22m";

  let noNewLine = false;
  text = text.replace(/<style([\s\S]*?)<\/style>/gi, '');
  text = text.replace(/<script([\s\S]*?)<\/script>/gi, '');
  text = text.replace(/<strong>/ig, BOLD);
  text = text.replace(/<\/strong>/ig, NORMAL);
  text = text.replace(/<\/div>/ig, '\n');
  text = text.replace(/<\/li>/ig, '\n');
  text = text.replace(/<li>/ig, '  *  ');
  text = text.replace(/<\/ul>/ig, '\n');
  text = text.replace(/<\/p>/ig, '\n');
  text = text.replace(/<br\s*[/]?>/gi, "\n");
  text = text.replace(/<[^>]+>/ig, '');
  text = text.replace('%%', '');
  pdfLine(text, { size: 'medium', align: 'left', noNewLine });
  noNewLine = true;


  /*
  await doc.html(`<p style="font-size:${scale_factor * 10}%;">${text}</p>`, {
  // await doc.html(`<p style="font-size:10px;">${text}</p>`, {
    callback: function (doc) {
      return doc;
    },
    width: final_width,
    height: final_height,
    windowWidth: page.width,
    html2canvas: {
      width: final_width,
      scale: scale_factor * 0.8
    },
    margin: [page.margin.left, page.margin.top, page.margin.right, page.margin.bottom],
    x: (options.print_xpos || 0),
    y: ((this_page - 1) * page.height) + pdfCurrent.yPos,
    autoPaging: 'text'
  });
  */

  if (!options.noNewPage && ((pdfCurrent.yPos >= page.bottom))) {
    let savedStyle = Object.assign({}, pdfCurrent);
    pdfLine(page.footerText, { size: 'tiny', after: 1, yPos: 'footer', align: 'center' });
    pdfCurrent = Object.assign({}, savedStyle, { yPos: pdfCurrent.yPos });
    pdfStyle(pdfCurrent);
    pdfHeader(++pdfCurrent.pageNumber);
  }
  pdfCurrent.xPos = page.margin.left;

  if (options.after) { pdfDown(options.after); }
}

function pdfLine(text, options = {}) {
  clt({ pdfLine: text, options });
  if (options) { pdfStyle(options); }
  if (options.before) { pdfDown(options.before); }
  if (options.yPos && !isNaN(options.yPos)) {
    pdfCurrent.yPos = options.yPos;
  }
  else if (options.yPos && (options.yPos === 'footer')) {
    pdfCurrent.yPos = Math.max((page.height - page.margin.bottom - 20), pdfCurrent.yPos);
    pdfCurrent.xPos = page.margin.left;
    options.noNewPage = true;
  }
  else if (options.yPos && (options.yPos === 'header')) {
    pdfCurrent.yPos = page.margin.top;
    options.noNewPage = true;
  }
  else if (!options.noNewLine) {
    pdfDown(1);
  }
  if (!options.noNewPage && ((pdfCurrent.yPos + ((options.protectOrphan ? 2 : 0) * pdfCurrent.fontSize)) >= page.bottom)) {
    let savedStyle = Object.assign({}, pdfCurrent);
    pdfLine(page.footerText, { size: 'tiny', after: 1, yPos: 'footer', align: 'center' });
    pdfCurrent = Object.assign({}, savedStyle, { yPos: pdfCurrent.yPos });
    pdfStyle(pdfCurrent);
    pdfHeader(++pdfCurrent.pageNumber);
  }
  if (options.image) {
    var imageWidth, imageHeight;
    if (options.image_width) {
      imageWidth = options.image_width;
      imageHeight = options.image_width;
    }
    else if (options.image.includes('base64')) {
      var img = new Image();
      img.src = options.image;
      img.onload = function () {
        imageWidth = img.naturalWidth;
        imageHeight = img.naturalHeight;
      };
    }
    else {
      imageWidth = pdfCurrent.fontSize * 2 * (pdfCurrent.fontSize / page.font.size['medium']);
      imageHeight = imageWidth;
    }
    let xOffset;
    try {
      switch (pdfCurrent.align) {
        case 'center': {
          xOffset = page.centerPoint - (imageWidth / 2);
          for (let this_image of makeArray(options.image)) {
            console.log(this_image);
            doc.addImage(this_image, 'JPEG', xOffset, pdfCurrent.yPos, imageWidth, imageHeight);
          }
          pdfCurrent.xPos = page.centerPoint + (imageWidth / 2);
          break;
        }
        case 'right': {
          xOffset = page.width - page.margin.right - imageWidth;
          for (let this_image of makeArray(options.image)) {
            doc.addImage(this_image, 'JPEG', xOffset, pdfCurrent.yPos, imageWidth, imageHeight);
          }
          pdfCurrent.xPos = page.width - page.margin.right;
          break;
        }
        default: {
          xOffset = pdfCurrent.xPos + pdfCurrent.indent;
          //    let imageProps = doc.getImageProperties(options.image);
          for (let this_image of makeArray(options.image)) {
            let [pdir, imageURI] = this_image.split(/\/(?!.*\/)/);   
            console.log(pdir, imageURI);
            let imageBucket = 'theseus-medical-storage';
            let gotObject =
              s3.getSignedUrl('getObject', {
                Bucket: imageBucket,
                Key: imageURI,
                Expires: 3600
              });
            let pParts = imageURI.split('.');  
            attachments.push(gotObject);
            try {
              let jsConfirm = doc.addImage(gotObject, pParts.pop(), xOffset, pdfCurrent.yPos, imageWidth, imageHeight);
              pdfCurrent.yPos += imageHeight;
            }
            catch {
              pdfDown(1);
              doc.text('Attachment image not available.', xOffset, pdfCurrent.yPos);
            }
            pdfDown(2);
            let lWidth = doc.textWithLink('Click here to see the attachment.', xOffset, pdfCurrent.yPos, { url: this_image });
            doc.line(xOffset, pdfCurrent.yPos + 2, xOffset + lWidth, pdfCurrent.yPos + 2);
            pdfDown(1);
          }
        }
      }
    }
    catch {
      for (let this_image of makeArray(options.image)) {
        doc.html(`<img src="${this_image}" />`);
      }
      switch (pdfCurrent.align) {
        case 'center': {
          pdfCurrent.xPos = page.centerPoint + (imageWidth / 2);
          break;
        }
        case 'right': {
          pdfCurrent.xPos = page.width - page.margin.right;
          break;
        }
        default: {
          pdfCurrent.xPos = xOffset + imageWidth;
        }
      }
    }
  }
  if (options.radio) {
    if (((pdfCurrent.xPos + doc.getTextWidth(text) + pdfCurrent.indent + 8) > page.printableArea)) {
      pdfDown(1);
      pdfCurrent.xPos += 8;
    }
    doc.circle(pdfCurrent.xPos + pdfCurrent.indent, pdfCurrent.yPos - 1, 3, (options.radioSelected ? 'F' : 'S'));
    doc.setFontSize(pdfCurrent.fontSize * 0.8);
    doc.text(text, pdfCurrent.xPos + pdfCurrent.indent + 8, pdfCurrent.yPos + 1);
    pdfCurrent.xPos = (pdfCurrent.xPos + pdfCurrent.indent + 8) + doc.getTextWidth(text) + pdfCurrent.fontSize;
    doc.setFontSize(pdfCurrent.fontSize);
  }
  else if (options.html) {
    console.log(`html at right:${pdfCurrent.xPos}; top:${pdfCurrent.yPos}; width:${page.width - page.margin.right}`);
    doc.html(text, {
      callback: function (doc) {
        return doc;
      },
      width: page.width - page.margin.right,
      windowWidth: page.width,
      html2canvas: {
        width: page.width,
      },
      x: pdfCurrent.xPos,
      y: pdfCurrent.yPos,
      autoPaging: 'text'
    });
  }
  else if (text && (text.length > 0)) {
    // this little chunk deals with text overflow
    let tWords = [];
    let split_lines = text.split(/<br\s*[/]?>/gi);
    for (let this_line of split_lines) {
      if ((pdfCurrent.align === 'center') && (doc.getTextWidth(this_line) > page.printableArea)) {
        let pWords = doc.splitTextToSize(this_line, page.printableArea);
        tWords.push(...pWords);
      }
      else if ((pdfCurrent.align !== 'center') && ((doc.getTextWidth(this_line) + pdfCurrent.xPos + pdfCurrent.indent) > page.right)) {
        let pWords = doc.splitTextToSize(this_line, (page.right - (pdfCurrent.xPos + pdfCurrent.indent)));
        tWords.push(...pWords);
      }
      if (this_line !== split_lines[split_lines.length - 1]) {
        tWords.push(' ');
      }
    }
    if (tWords.length > 0) {
      for (let t = 0; t < tWords.length - 1; t++) {
        pdfDown(1);
        pdfLine(tWords[t], Object.assign({}, options, { noNewLine: true, after: 0 }));
      }
      pdfDown(1);
      text = tWords[tWords.length - 1];
    }
    if (pdfCurrent.align === 'center') {
      let xOffset = page.centerPoint - (doc.getTextWidth(text) / 2);
      doc.text(text, xOffset, pdfCurrent.yPos);
      pdfCurrent.xPos = page.centerPoint + (doc.getTextWidth(text) / 2) + (pdfCurrent.fontSize / 4);
    }
    else if (pdfCurrent.align === 'right') {
      doc.text(text, page.width - page.margin.right, pdfCurrent.yPos, { align: 'right' });
      pdfCurrent.xPos = page.margin.right;
    }
    else if (options.noNewLine) {
      doc.text(text, pdfCurrent.xPos, pdfCurrent.yPos);
      pdfCurrent.xPos += doc.getTextWidth(text) + (pdfCurrent.fontSize / 4);
    }
    else {
      doc.text(text, pdfCurrent.xPos + pdfCurrent.indent, pdfCurrent.yPos);
      pdfCurrent.xPos = (pdfCurrent.xPos + pdfCurrent.indent) + doc.getTextWidth(text) + (pdfCurrent.fontSize / 4);
    }
  }
  if (options.after) { pdfDown(options.after); }
  return;
}


async function pdfImage(text, options = {}) {
  clt({ pdfLine: text, options });
  if (options) { pdfStyle(options); }
  if (options.before) { pdfDown(options.before); }
  if (options.yPos && !isNaN(options.yPos)) {
    pdfCurrent.yPos = options.yPos;
  }
  else if (options.yPos && (options.yPos === 'footer')) {
    pdfCurrent.yPos = Math.max((page.height - page.margin.bottom - 20), pdfCurrent.yPos);
    pdfCurrent.xPos = page.margin.left;
    options.noNewPage = true;
  }
  else if (options.yPos && (options.yPos === 'header')) {
    pdfCurrent.yPos = page.margin.top;
    options.noNewPage = true;
  }
  else if (!options.noNewLine) {
    pdfDown(1);
  }
  if (!options.noNewPage && ((pdfCurrent.yPos + ((options.protectOrphan ? 2 : 0) * pdfCurrent.fontSize)) >= page.bottom)) {
    let savedStyle = Object.assign({}, pdfCurrent);
    pdfLine(page.footerText, { size: 'tiny', after: 1, yPos: 'footer', align: 'center' });
    pdfCurrent = Object.assign({}, savedStyle, { yPos: pdfCurrent.yPos });
    pdfStyle(pdfCurrent);
    pdfHeader(++pdfCurrent.pageNumber);
  }
  if (options.image) {
    var imageWidth, imageHeight;
    if (options.image.includes('base64')) {
      var img = new Image();
      img.src = options.image;
      await getImageSize(img);
      imageWidth = img.naturalWidth;
      imageHeight = img.naturalHeight;
    }
    else {
      imageWidth = pdfCurrent.fontSize * 2 * (pdfCurrent.fontSize / page.font.size['medium']);
      imageHeight = imageWidth;
    }
    if (imageWidth === 0) {
      imageWidth = pdfCurrent.fontSize * 2 * (pdfCurrent.fontSize / page.font.size['medium']);
      imageHeight = imageWidth;
    }
    else if (imageWidth > (page.width / 4)) {
      var shrinkFactor = (page.width / 4) / imageWidth;
      imageWidth = page.width / 4;
      imageHeight = imageHeight *= shrinkFactor;
    }
    let xOffset;
    try {
      switch (pdfCurrent.align) {
        case 'center': {
          xOffset = page.centerPoint - (imageWidth / 2);
          doc.addImage(options.image, 'JPEG', xOffset, pdfCurrent.yPos, imageWidth, imageHeight);
          pdfCurrent.xPos = page.centerPoint + (imageWidth / 2);
          break;
        }
        case 'right': {
          xOffset = page.width - page.margin.right - imageWidth;
          doc.addImage(options.image, 'JPEG', xOffset, pdfCurrent.yPos, imageWidth, imageHeight);
          pdfCurrent.xPos = page.width - page.margin.right;
          break;
        }
        default: {
          xOffset = pdfCurrent.xPos + pdfCurrent.indent;
          //    let imageProps = doc.getImageProperties(options.image);
          doc.addImage(options.image, 'JPEG', xOffset, pdfCurrent.yPos, imageWidth, imageHeight);
          pdfCurrent.yPos += imageHeight;
          pdfDown(1);
        }
      }
    }
    catch {
      doc.html(`<img src="${options.image}" />`);
      switch (pdfCurrent.align) {
        case 'center': {
          pdfCurrent.xPos = page.centerPoint + (imageWidth / 2);
          break;
        }
        case 'right': {
          pdfCurrent.xPos = page.width - page.margin.right;
          break;
        }
        default: {
          pdfCurrent.xPos = xOffset + imageWidth;
        }
      }
    }
  }
  if (text && (text.length > 0)) {
    // this little chunk deals with text overflow
    let tWords = [];
    if ((pdfCurrent.align === 'center') && (doc.getTextWidth(text) > page.printableArea)) {
      tWords = doc.splitTextToSize(text, page.printableArea);
    }
    else if ((pdfCurrent.align !== 'center') && ((doc.getTextWidth(text) + pdfCurrent.xPos + pdfCurrent.indent) > page.right)) {
      tWords = doc.splitTextToSize(text, (page.right - (pdfCurrent.xPos + pdfCurrent.indent)));
    }
    if (tWords.length > 0) {
      for (let t = 0; t < tWords.length - 1; t++) {
        pdfLine(tWords[t], Object.assign({}, options, { after: 0 }));
      }
      pdfDown(1);
      text = tWords[tWords.length - 1];
    }
    if (pdfCurrent.align === 'center') {
      let xOffset = page.centerPoint - (doc.getTextWidth(text) / 2);
      doc.text(text, xOffset, pdfCurrent.yPos);
      pdfCurrent.xPos = page.centerPoint + (doc.getTextWidth(text) / 2) + pdfCurrent.fontSize;
    }
    else if (pdfCurrent.align === 'right') {
      doc.text(text, page.width - page.margin.right, pdfCurrent.yPos, { align: 'right' });
      pdfCurrent.xPos = page.margin.right;
    }
    else if (pdfCurrent.noNewLine) {
      doc.text(text, pdfCurrent.xPos + pdfCurrent.indent, pdfCurrent.yPos);
      pdfCurrent.xPos += doc.getTextWidth(text) + pdfCurrent.fontSize;
    }
    else {
      doc.text(text, pdfCurrent.xPos + pdfCurrent.indent, pdfCurrent.yPos);
      pdfCurrent.xPos = (pdfCurrent.xPos + pdfCurrent.indent) + doc.getTextWidth(text) + pdfCurrent.fontSize;
    }
  }
  if (options.after) { pdfDown(options.after); }
  return;

  function getImageSize(img) {
    return new Promise(res => {
      img.onload = () => res();
      img.onerror = () => res();
    });
  }
}

function pdfDown(n = 1) {
  pdfCurrent.yPos += ((isNaN(n) ? 1 : n) * (pdfCurrent.fontSize * 0.75));
  pdfCurrent.xPos = page.margin.left;
}

function pdfStyle(options = {}) {
  if (options === 'reset') {
    pdfCurrent.style = 'normal';
    doc.setFont(page.font.family, 'normal');
    pdfCurrent.fontSize = page.font.size['medium'];
    doc.setFontSize(pdfCurrent.fontSize);
    pdfCurrent.indent = 0;
    pdfCurrent.align = '';
  }
  else {
    if (options.style) {
      pdfCurrent.style = options.style;
      doc.setFont(page.font.family, options.style);
    }
    if (options.size) {
      if (isNaN(options.size)) {
        if (page.font.size.hasOwnProperty(options.size)) {
          pdfCurrent.fontSize = page.font.size[options.size];
        }
      }
      else { pdfCurrent.fontSize = options.size; }
      doc.setFontSize(pdfCurrent.fontSize);
    }
    if (options.fontSize) {
      pdfCurrent.fontSize = options.fontSize;
      doc.setFontSize(pdfCurrent.fontSize);
    }
    if (options.hasOwnProperty('indent')) {   // different because when options.indent === 0, options.indent is false
      pdfCurrent.indent = options.indent;
    }
    if (options.align) {
      pdfCurrent.align = options.align;
    }
  }
}

export async function sendMessage(body) { return await sendMessages(body); }

export async function sendMessages(body) {
  /*  Expect body as an object or array of objects with the following structure
          client: <client_id>,
          author: <from person_id>
          testMode: <boolean> (if true, everything will happen EXCEPT the message will not be put in the PostOffice - and therefore not sent)
          messageText: <text> (if present, messageTextthis will override any messageText in the values attribute)
          htmltext: <text>
          recipientList: <person_id or array of person_id's list can include "GRP//<group_id>" as well>
          subject: <subject>
          attachments: [<string>, <string>, ...]
          attachment_data: <optional> exists when the attahment(s) are actual file attachments and not links
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
        'message_id': `${env.thread_id}.${m}~AVAMessages`,
        'deliver_time': postTime += m,
        'patient_id': env.person_id || env.author,
        'from': env.author,
        'message_text': env.messageText,
        'html_message_text': env.htmlText,
        'preferred_method': env.preferred_method,
        'subject': env.subject.replace(/\n/g, " ").trim()      // dont allow invlid characters in the message subject
      },
      TableName: "PostOffice"
    };
    if (env.testMode) { PostOfficeRec.TableName = "TestPostOffice"; };
    if (env.attachments) {
      PostOfficeRec.Item.attachments = makeArray(env.attachments);
      if (env.attachment_data) {
        PostOfficeRec.Item.attachment_data = Object.assign({}, env.attachment_data);
      }
    }
    if (env.voiceMail) { PostOfficeRec.Item.voice_mail = env.voiceMail; }
    if (env.allowReplyAll) { PostOfficeRec.Item.allowReplyAll = env.allowReplyAll; }
    if (!('subject' in PostOfficeRec.Item)) {
      PostOfficeRec.Item["subject"] = `Message from ${await makeName(env.author)}`;
    }
    let to = [];
    let ind = [];
    if (Array.isArray(env.recipientList)) { to = env.recipientList; }
    else to = [env.recipientList];
    for (let r = 0; r < to.length; r++) {
      PostOfficeRec.Item['message_id'] = `${env.thread_id}.${m}.${r}~AVAMessages`;
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
        if (ind.length === 1) {
          let sName = await makeName(ind[0]);
          results.push({ sent: true, message: `Successfully sent to ${sName}` });
        }
        else {
          results.push({ sent: true, message: `Successfully sent to ${ind.length} recipients` });
        }
      }
    }
  }
  return results;
}
/*
function getImageWidth(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      resolve(img.width);
    };

    img.onerror = () => {
      reject(new Error(`Failed to load image from URL: ${url}`));
    };

    img.src = url;
  });
}
*/

export async function messageHistory(body) {
  // body should include thread_id
  let mRecs = await getMessages(body);
  let returnArray = [];
  let returnObj = {};
  if (!mRecs) { returnArray.push(`No message history`); }
  else {
    let headerLine = false;
    if (body.in_out && (body.in_out === 'in') && (mRecs.length > 1) && (!body.was_held)) {
      headerLine = `From ${mRecs[0].author.author_name} to ${mRecs.length} addresses`;
      returnArray.push(headerLine);
    }
    mRecs.forEach(mR => {
      let mTime = mR.posted_time || mR.created_time;
      let mInfo = '';
      let mLine = (mR.deliver_method === 'hold') ? 'Held message ' : 'Sent ';
      if (!headerLine && (body.in_out && (body.in_out === 'in'))) {
        mLine += `from ${mR.author.author_name}  `;
      }
      mLine += `to ${mR.recipient_list.name.first} ${mR.recipient_list.name.last}`;
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
          if (mR.composite_key.endsWith('alt_email')) {
            mLine += ' (to alt e-Mail)';
          }
          break;
        }
        case 'hold': {
          break;
        }
        default: { mLine += ` via ${mR.deliver_method}`; }
      }
      if (mR.recipient_list && mR.recipient_list.rule_used) {
        mLine += ` as per rule "${mR.recipient_list.rule_used}"`;
      }
      if (mR.results) {
        let mRLast;
        if ((mR.results[0].result === 'callComplete') && (mR.results.length > 0)) { mRLast = mR.results[1]; }
        else { mRLast = mR.results[0]; }
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
            mLine += `.  ${mR.recipient_list.name.first} replied`;
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
            mLine += `. ${sentenceCase(mRLast.result)}`;
          }
        }
      }
      mLine += ` ${makeDate(mTime).oaDate}`;
      mLine += mInfo;
      if (!returnObj.hasOwnProperty(mR.deliver_to)) {
        returnObj[mR.deliver_to] = {
          name: `${mR.recipient_list.name.first} ${mR.recipient_list.name.last}`,
          composite_key: mR.composite_key,
          history: (headerLine ? [{
            time: new Date().getTime() + (60 * 60 * 1000),    // make sure tis is the most recent date (and displayed first) by setting it an hour in the future
            line: headerLine
          }] : [])
        };
      }
      returnObj[mR.deliver_to].history.push({
        time: mTime,
        line: mLine
      });
      returnArray.push(mLine);
    });
    returnArray.push(' ', `(${body.thread_id})`);
    if (body.returnObject) {
      return returnObj;
    }
    else {
      return returnArray;
    }
  }
}