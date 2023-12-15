import { clt, cl, s3, recordExists, titleCase, uuid, listFromArray, makeArray, sentenceCase, dbClient, parseNumeric } from './AVAUtilities';
import { getPerson, makeName } from './AVAPeople';
import { getGroupsBelongTo } from './AVAGroups';
import { getCustomizations } from './AVAUtilities';
import { getServiceRequests } from './AVAServiceRequest';
import { makeDate } from './AVADateTime';

import { jsPDF } from "jspdf";

let page = {};
let pdfCurrent = {};
let doc;

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
    if (inBody.hasOwnProperty('attachments')) {
      requestInfo.attachments = inBody.attachments.map(a => { return a.Location; });
    }
    do {
      let this_request = Object.assign({}, requestInfo, messageList.shift());   // this removes the message from the messageList
      // cl({ 'in prepare messages': { this_request } });
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
      if ('subject' in this_request.format) {
        results.subject = this_request.format.subject;
      }
      switch (this_request.format.type) {
        case 'mealOrder':
        case 'checklist':
        case 'factForm': {
          [results.htmlText, results.messageText, results.pdfInfo] = await formatRequestDetails(this_request, this_request.format.type);
          break;
        }
        case 'mealTicket': {
          [results.htmlText, results.messageText, results.attachments] = await mealTicketFormat(this_request, requestRec);
          if (results.attachments) {
            requestInfo.attachments = results.attachments;
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
        if (requestToTest.selections && requestToTest.selections.includes(t.check)) { passedTest = true; }
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

export async function formatRequestDetails(body, summaryType) {
  // Prep the PDF output
  if (!body.margin) { body.margin = {}; }
  await pdfLaunch(Object.assign({}, body, { client_id: (body.client || body.client_id) }));

  let textInput = {};
  if (body.textInput && (Object.keys(body.textInput).length > 0)) {
    textInput = Object.assign({}, body.textInput);
  }
  let titleWords;
  if (body.subject) {
    titleWords = (await resolveMessageVariables(body.subject, body)).replace(/\(.+\)/g, '').trim();
  }
  else if (body.format && body.format.subject) {
    titleWords = (await resolveMessageVariables(body.format.subject, body)).replace(/\(.+\)/g, '').trim();
  }
  else if (body.activityName) {
    titleWords = await resolveMessageVariables(body.activityName, body);
  }
  else { titleWords = 'AVA Request'; }
  if (body.reprint) { titleWords = '*** REPRINT ' + titleWords + ' ***'; };

  let htmlMessage = `<h1 style="color: #5e9ca0;"><span style="color: #000000;">${titleWords}</span></h1>`;
  let rawMessage = `${titleWords}\n\r`;
  pdfLine(' ', { align: 'center', image: pdfCurrent.logo });
  pdfLine(titleWords, { style: 'bold', size: 'large', align: 'center', after: 1 });


  // Person
  let pRec = await getPerson(body.author);

  let authorName = await makeName(body.author);
  let pName = (body.onBehalfOf || authorName).replace(/\(.+\)/g, '').trim();  // this removes anything inside parenthesis
  // does the title contain all of the words in the obo?
  let tLower = titleWords.toLowerCase();
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
    let locNum = parseNumeric(pRec.location);
    if (locNum.hasNumbers) {
      pRec.location = `Apt ${locNum.value}`;
    }
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
    if ((cTyp in pRec) && (pRec[cTyp].trim() !== '')) {
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
        pdfLine(aVal);
        pXTag = '</h2>';
        pTag = ' / ';
        body.selections.splice(x, 1);
        x--;
      }
    };
    htmlMessage += `${pXTag}<h2 style = "color: black;" >Order filled by: _______________________</h2>`;
    rawMessage += '\n\nOrder filled by: ________________________\n\n';

    renderCheckBox = '&#8414;   ';
    htmlMessage += `<h2 style="color: black;">Order Details</h2><dl style="padding-left: 40px;">`;
    pdfLine('Order Details', { style: 'bold', before: 1, align: 'left' });
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
    htmlMessage += `<dt style="margin-top: ${lineSpacing}; font-size: 1.2em; color: black;">${renderCheckBox}<strong>&nbsp;&nbsp;&nbsp;${sVal}&nbsp;&nbsp;&nbsp;</strong>${textInput[aVal] || ''}</dt>`;
    rawMessage += `\n${sVal}\n`;
    pdfStyle('reset');
    pdfLine(sVal, { before: 1 });
    if (textInput[aVal]) {
      pdfLine(textInput[aVal], { noNewLine: true, before: 1, indent: 15, size: 'small' });
      rawMessage += `${textInput[aVal]}\n`;
      delete textInput[aVal];
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
    for (let topic in textInput) {
      let sVal = sentenceCase(topic.trim());
      htmlMessage += `<dt style="padding-top:${lineSpacing}; font-size: 1.2em; color: black;">${renderCheckBox}<strong>&nbsp;&nbsp;&nbsp;${sVal}&nbsp;&nbsp;&nbsp;</strong>${textInput[topic]}</dt>`;
      rawMessage += `\n${sVal}\n${textInput[topic]}\n`;
      pdfStyle('reset');
      pdfLine(sVal, { before: 1 });
      pdfLine(textInput[topic], { noNewLine: true, before: 1, indent: 15, size: 'small' });
      lineSpacing = `${spaceBetweenLines}px`;
    }
  }

  // Finish
  if (summaryType === 'mealOrder') {
    pdfStyle('reset');
    pdfLine('Order filled by: ________________________', { before: 4, after: 1 });
  }
  htmlMessage += `</dl><p style="padding-top:${(spaceBetweenLines * 1.5).toString()}px;">`;

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
    let this_method = body.overrideMethod || body.messaging?.format?.method;
    let pdfResp = await savePDF(doc, pdfInfo, { local: !body.PDF, S3: true, onSave: this_method });
    if (pdfResp.responseData.s3Resp) {
      pdfInfo.s3Location = pdfResp.responseData.s3Resp.Location;
    }
  }
  return [htmlMessage, rawMessage, pdfInfo];
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
    if (goodS3 && options.onSave === 'print') {
      window.open(s3Resp.Location);
      responseStatus = 200;
      responseData.message.push(`S3 saved at ${s3Resp.Location}`);
      responseData.s3Resp = s3Resp;
    }
  }
  if (options.local) {    
    doc.save(pdfInfo.s3Key);
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
    width: body.pageWidth || 175,
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
    format: [page.width, page.width * 3]
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
      if ((field !== table_key) && (field !== seat_key)) {
        /*
        pdfLineMealTicket(field, page.font.size.medium, 'normal');
        style = `"font-size: ${page.font.size.medium}; padding-top: 0.5em;"`;
        htmlText.push(`<div style=${style}>${field}</div>`);
        plainText.push(field);
        */
        let tLine = `>>> ${this_request.original_request.textInput[field]} <<<`;
        // pdfLineMealTicket(tLine, page.font.size.small, 'normal', 1, -0.5);
        pdfLineMealTicket(tLine, page.font.size.medium, 'normal');
        // style = `"font-size: ${page.font.size.medium}; padding-left: 2em;"`;
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
    let nextLine;
    if (doc.getTextWidth(text) > page.printableArea) {
      let tWords = text.split(/\s+/);
      nextLine = tWords.pop();
      text = tWords.join(' ');
      if (doc.getTextWidth(text) > page.printableArea) {
        let t2Words = text.split(/\s+/);
        nextLine += ' ' + t2Words.pop();
        text = t2Words.join(' ');
      }
    }
    if (options) {
      if (options.align === 'center') { doc.text(text, page.width / 2, yPos, options); }
      else { doc.text(text, page.margin.left + i, yPos, options); }
    }
    else { doc.text(text, page.margin.left + i, yPos); }
    yPos += lastSize;
    if (nextLine) {
      if (options) {
        if (options.align === 'center') { doc.text(nextLine, page.width / 2, yPos, options); }
        else { doc.text(nextLine, page.margin.left + i, yPos, options); }
      }
      else { doc.text(nextLine, page.margin.left + i, yPos); }
      yPos += lastSize;
    }
    if (after) { yPos += (after * size); }
    return;
  }
}

async function pdfLaunch(body) {
  if (!body.hasOwnProperty('pdf')) { body.pdf = {}; }
  if (!body.multiPrint || body.multiPrint.firstDoc) {
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
  doc.autoPrint();
  page = {
    width: doc.internal.pageSize.width,
    height: doc.internal.pageSize.height,
    center: (doc.internal.pageSize.width / 2),
    border: (body.pdf.hasOwnProperty('border')) ? body.pdf.border : true,
    font: {
      family: 'Helvetica',
      size: { large: 20, medium: 16, small: 12, tiny: 8 }
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
  page.title = body.pdf.title || 'AVA Senior Living';
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
  let customizations = await getCustomizations('*all', body.client);
  if (customizations['client_name']) {
    pdfCurrent.client_name = customizations['client_name'];
  }
  else {
    pdfCurrent.client_name = `Client = ${body.client_id}`;
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
    pdfCurrent.client_name = `Client = ${body.client_id}`;
  };
  if (customizations['logo']) {
    pdfCurrent.logo = customizations['logo'];
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
  }
  else if (pdfCurrent.logo) {
    //     doc.addImage(pdfCurrent.logo, 'PNG', page.center - (pdfCurrent.logo_width / 2), pdfCurrent.yPos, pdfCurrent.logo_width, pdfCurrent.logo_height);
    //     pdfCurrent.yPos += pdfCurrent.logo_height;
  }
  pdfStyle({ size: 'large', align: 'center', style: 'bold' });
  doc.text(pdfCurrent.client_name, page.center, pdfCurrent.yPos, { align: 'center' });
  pdfStyle({ size: 'medium', before: 1, style: 'normal' });
  doc.text(page.title, page.center, pdfCurrent.yPos, { align: 'center' });
  pdfDown(1);
  doc.text(pdfCurrent.reportTime, page.center, pdfCurrent.yPos, { align: 'center' });
  if (pageN > 1) {
    pdfStyle({ size: 'small', before: 1 });
    doc.text(`Page ${pdfCurrent.pageNumber}`, page.width / 2, pdfCurrent.yPos, { align: 'center' });
    pdfDown(2);
    if (pdfCurrent.key) {
      pdfStyle({ size: 'medium', align: 'left', style: 'bold' });
      doc.text(titleCase(pdfCurrent.key), page.margin.left, pdfCurrent.yPos);
      let newX = page.margin.left + doc.getTextWidth(titleCase(pdfCurrent.key)) + 5;
      pdfStyle({ size: 'small', style: 'normal' });
      doc.text('(continued)', newX, pdfCurrent.yPos);
    }
    pdfCurrent = Object.assign({}, savedStyle, { yPos: pdfCurrent.yPos });
    pdfStyle(pdfCurrent);
  }
  else {
    pdfStyle('reset');
    pdfDown(2);
  }
}

function pdfLine(text, options = {}) {
  clt({ pdfLine: text, options });
  if (options) { pdfStyle(options); }
  if (options.before) { pdfDown(options.before); }
  if (options.yPos && !isNaN(options.yPos)) {
    pdfCurrent.yPos = options.yPos;
  }
  else if (options.yPos && (options.yPos === 'footer')) {
    pdfCurrent.yPos = page.height - page.margin.bottom - 54;
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
  if (!options.noNewPage && (pdfCurrent.yPos >= (page.bottom - page.margin.bottom))) {
    pdfHeader(++pdfCurrent.pageNumber);
  }
  if (options.image) {
    let imageSize = pdfCurrent.fontSize * 5;
    let xOffset;
    switch (pdfCurrent.align) {
      case 'center': {
        xOffset = page.centerPoint - (imageSize / 2);
        doc.addImage(options.image, 'JPEG', xOffset, pdfCurrent.yPos, imageSize, imageSize);
        pdfCurrent.xPos = page.centerPoint + (imageSize / 2);
        break;
      }
      case 'right': {
        xOffset = page.width - page.margin.right - imageSize;
        doc.addImage(options.image, 'JPEG', xOffset, pdfCurrent.yPos, imageSize, imageSize);
        pdfCurrent.xPos = page.width - page.margin.right;
        break;
      }
      default: {
        xOffset = pdfCurrent.xPos + pdfCurrent.indent;
        doc.addImage(options.image, 'JPEG', xOffset, pdfCurrent.yPos, imageSize, imageSize);
        pdfCurrent.xPos = xOffset + imageSize;
      }
    }
    pdfCurrent.yPos += imageSize;
  }
  else {
    // this little chunk deals with text overflow
    {
      let tWords = [];
      if ((pdfCurrent.align === 'center') && (doc.getTextWidth(text) > page.printableArea)) {
        tWords = doc.splitTextToSize(text, page.printableArea);
      }
      else if ((pdfCurrent.align !== 'center') && ((doc.getTextWidth(text) + pdfCurrent.xPos + pdfCurrent.indent) > page.right)) {
        tWords = doc.splitTextToSize(text, (page.right - (pdfCurrent.xPos + pdfCurrent.indent)));
      }
      if (tWords.length > 0) {
        for (let t = 0; t < tWords.length - 1; t++) {
          pdfLine(tWords[t], options);
        }
        pdfDown(1);
        text = tWords[tWords.length - 1];
      }
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
          htmlMessageText: <text>
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
          results.push({ sent: true, message: `Sent message to ${sName}` });
        }
        else {
          results.push({ sent: true, message: `Sent message to ${ind.length} people` });
        }
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
            mLine += `. ${sentenceCase(mRLast.result)}`;
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