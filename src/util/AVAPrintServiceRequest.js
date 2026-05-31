import { clt, cl, s3, titleCase, uuid, parseNumeric, getCustomizations, deepCopy } from './AVAUtilities';
import { resolveMessageVariables } from './AVAMessages';
import { makeName } from './AVAPeople';
import { getServiceRequests, formatServiceRequest, getRequestLog } from './AVAServiceRequest';
import { makeDate } from './AVADateTime';

import { jsPDF } from "jspdf";

let page = {};
let pdfCurrent = {};
let doc;
let htmlMessage = '';
let rawMessage = '';
let customizations = {};

// Functions

export async function makeSRPrint(inboundRequest) {
  let requestList = [];
  if (Array.isArray(inboundRequest)) {
    requestList.push(...inboundRequest);
  }
  else {
    requestList = [inboundRequest];
  }

  // input will be a list of SR's to be printed
  // each element MUST contain a service request, a reference to a service request, OR a set of printing instructions
  /*
    We'll return an array with one element for each passed in SR or referenced SR
    (NOTE: if inboundRequest references multiple SRs, as in "all foreign_key = date, request_type = dinner_order", list will expand accordingly)
      output_format as follows
          {
            <format_code: "mealOrder", etc,>: {
              type: pdf, html, data
              output: <pdf_blob, html string, or raw text string>
              sharedDoc_id: if multiPrint, this key is the same for all SRs in the output document
            }
          }
  */
  let sharedDoc_id;
  let final_result = [];

  for (let rN = 0; rN < requestList.length; rN++) {
    let request_body = requestList[rN];
    if (request_body.hasOwnProperty('body')) {   // keys in "body" are promoted to the object itself
      Object.assign(request_body, request_body.body);
      delete request_body.body;
    }

    let returnedRequests = await formatServiceRequest(request_body);
    let this_request;
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

    if ((!this_request) || this_request.error) {
      return { error: true };
    }

    // Prep the PDF output
    /*
        pass request_body.multiPrint{} to control:
          stand-alone - omit multiPrint
          first page / start new PDF - multiPrint.firstDoc === true
          last page / close this PDF at end - multiPrint.lastDoc === true
          so... multiPrint.firstDoc === false adds a page to an existing PDF
          ...and multiPrint.lastDoc === false leaves the PDF open on exit
    */

    if (!request_body.margin) {
      request_body.margin = {};
    }

    let client_customizations = await getCustomizations('*all', this_request.client_id);
    let AVA_customizations = await getCustomizations('*all', 'AVA');
    customizations = Object.assign({}, AVA_customizations, client_customizations);

    let output_format = {};   // one or more output formats as called for in the this_request.print?.format array

    if (!this_request.print?.format) {
      return { 'error': true };
    };

    if (request_body.multiPrint && request_body.multiPrint.firstDoc) {
      sharedDoc_id = uuid(10);    // this is one document of multiple documents in the output
    }

    for (let f = 0; f < this_request.print?.format.length; f++) {
      let this_format = this_request.print?.format[f];

      output_format[this_format] = {
        type: customizations?.print_format?.[this_format].format || 'pdf',
        sharedDoc_id
      };

      // Header & Title
      await pdfLaunch(Object.assign({}, request_body, this_request, { client_id: this_request.client_id }));
      if (customizations?.print_format?.[this_format].show_obo === 'as_title') {
        page.title = this_request.print?.data?.onBehalfOf_name;
      }
      if (customizations?.print_format?.[this_format].suppress_header) {
        pdfLine(' ', { align: 'center', image: pdfCurrent.logo });
        pdfLine(page.title, { style: 'bold', size: 'large', align: 'center', after: 1 });
      }
      else {
        pdfHeader();
      }
      htmlMessage += `<h1 style="color: #5e9ca0;"><span style="color: #000000;">${page.title}</span></h1>`;
      htmlMessage += `<h2 style = "color: black;" >`;
      rawMessage += `${page.title}\n\r`;

      let suppress_obo = false;
      // does the title contain all of the words in the obo?
      if (customizations?.print_format?.[this_format].show_obo === 'when_unique') {
        let tLower = page.title.toLowerCase();
        let oboWords = this_request.print.data.onBehalfOf_name.toLowerCase().split(/\s+/);
        suppress_obo = oboWords.every(oboWord => {
          return (tLower.includes(oboWord));
        });
      }
      else if (customizations?.print_format?.[this_format].show_obo !== 'always') {
        suppress_obo = true;
      }
      if (!suppress_obo) {
        htmlMessage += this_request.print.data.onBehalfOf_name;
        rawMessage += `${this_request.print.data.onBehalfOf_name}\n`;
        pdfLine(`for ${this_request.print.data.onBehalfOf_name}`, { style: 'normal', align: 'center', size: 'medium' });
      }

      if (customizations?.print_format?.[this_format].show_location && this_request.print.data.request_person_rec.location) {
        let locNum = parseNumeric(this_request.print.data.request_person_rec.location);
        if (locNum.hasNumbers) {
          this_request.print.data.request_person_rec.location = `Apt ${locNum.value}`;
        }
        htmlMessage += `<br />${this_request.print.data.request_person_rec.location}`;
        rawMessage += `${this_request.print.data.request_person_rec.location}\n`;
        pdfLine(this_request.print.data.request_person_rec.location, { size: 'small', align: 'center' });
      }

      htmlMessage += `</h2><p style = "color: black;">`;

      if (customizations?.print_format?.[this_format].show_created) {
        let pDateTime = this_request.print.data.created_time.absolute;
        if (this_request.print.data.creator_id !== this_request.print.data.request_person_id) {
          pDateTime += ` by ${this_request.print.data.creator_name}`;
        }
        htmlMessage += `created: <strong>${pDateTime}</strong>`;
        rawMessage += `${pDateTime}\n\r`;
        pdfLine(`created: ${pDateTime}`, { size: 'small', align: 'center' });
      }

      if (customizations?.print_format?.[this_format].show_contact_info) {
        for (let cTyp in this_request.print.data.request_person_rec.messaging) {
          if ((cTyp in this_request.print.data.request_person_rec) && (this_request.print.data.request_person_rec[cTyp].trim() !== '')) {
            let cLab;
            switch (cTyp) {
              case 'sms': { cLab = 'cell'; break; }
              case 'voice': { cLab = 'home'; break; }
              case 'email': { cLab = 'e-Mail'; break; }
              default: { cLab = cTyp; }
            }
            htmlMessage += `<br />${cLab}: <strong>${this_request.print.data.request_person_rec[cTyp]}</strong>`;
            rawMessage += `${cLab}: ${this_request.print.data.request_person_rec[cTyp]}\n\r`;
            pdfLine(`${this_request.print.data.request_person_rec[cTyp]}`, { size: 'small', align: 'center' });
          }
        }
      }
      pdfDown(2);

      htmlMessage += '</p><h2 style = "color: black;" >** AVA **</h2>';
      rawMessage += '\n\r** AVA **\n\r';

      // Request Detail section
      let requestDetails = deepCopy(this_request.print.data.requestDetails);

      // Pre-Detail - show info that needs special attention
      if (customizations?.print_format?.[this_format].selections_to_promote
        && (customizations?.print_format?.[this_format].selections_to_promote.length > 0)) {

        for (const [this_selection, optionList] of Object.entries(requestDetails)) {
          if (customizations?.print_format?.[this_format].selections_to_promote.includes(this_selection)) {
            if (!optionList || (optionList.length === 0)) {
              htmlMessage += `<h2 style="color: black;">${this_selection}</h2>`;
              rawMessage += `${this_selection}\r\n`;
              pdfLine(this_selection);
            }
            else {
              for (let o = 0; o < optionList.length; o++) {
                htmlMessage += `<h2 style="color: black;">${optionList[o]}</h2>`;
                rawMessage += `${optionList[o]}\r\n`;
                pdfLine(optionList[o]);
              };
            }
            delete requestDetails[this_selection];
          }
        }
      }

      let renderCheckBox = '';
      if (customizations?.print_format?.[this_format].show_checkbox) {
        renderCheckBox = '&#8414;   ';
      }

      if (customizations?.print_format?.[this_format].detail_section_header
        && (Object.keys(requestDetails).length > 0)) {
        htmlMessage += `<h2 style="color: black;">Options Selected</h2>`;
        rawMessage += `Options Selected\r\n`;
        pdfLine('Options Selected', { style: 'bold', before: 1, align: 'left' });
      }

      htmlMessage += `<dl style="padding-left: 40px;">`;
      pdfStyle('reset');
      let lineSpacing = '0px';

      // *********    DETAIL LINES  **********
      for (const [this_selection, optionList] of Object.entries(requestDetails)) {
        htmlMessage += `<dt style="margin-top: ${lineSpacing}; font-size: 1.2em; color: black;">${renderCheckBox}<strong>&nbsp;&nbsp;&nbsp;${this_selection}</dt>`;
        rawMessage += `\n${this_selection}\n`;
        pdfStyle('reset');
        pdfLine(this_selection, { before: 1 });
        if (optionList) {
          for (let o = 0; o < optionList.length; o++) {
            htmlMessage += `<dd>${optionList[o]}</dd>`;
            rawMessage += `${optionList[o]}\n`;
            pdfLine(`${optionList[o]}`, { noNewLine: true, before: 1, indent: 15, size: 'small' });
          };
        }
      };

      pdfStyle('reset');
      rawMessage += `\n\n`;
      htmlMessage += `</dl>`;

      if (customizations?.print_format?.[this_format].initials_message) {
        pdfLine(`${customizations?.print_format?.[this_format].initials_message}: ________________________`, { before: 4, after: 1 });
        htmlMessage += `<h2 style = "color: black;" >${customizations?.print_format?.[this_format].initials_message}: _______________________</h2>`;
        rawMessage += `\n\n${customizations?.print_format?.[this_format].initials_message}: ________________________\n\n`;
      }

      // Finish
      if (!request_body.multiPrint || request_body.multiPrint.lastDoc) {
        let refText = `AVA reference: ${this_request.print.data.client_id}/${this_request.print.data.request_id} (${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()})`;
        pdfLine(refText, { noNewPage: true, yPos: 'footer', align: 'center' });
        pdfLine(`***** END *****`, { noNewPage: true, noNewLine: true, before: 1 });
        htmlMessage += `<p style = "color: black;"><div>${refText}</div><div>***** END *****</div></p>`;
        rawMessage += `\n\r${refText}\n***** END *****`;
      }
    }  // done with all formats of this SR

    for (const [format_code, outObj] of Object.entries(output_format)) {   // for each format, load the final document
      switch (outObj.type) {
        case 'text': {
          output_format[format_code].output = rawMessage;
          break;
        }
        case 'html': {
          output_format[format_code].output = htmlMessage;
          break;
        }
        default: {
          output_format[format_code].output = doc.output('blob');
        }
      }
    }

    if (request_body.multiPrint && request_body.multiPrint.lastDoc) {
      for (let x = 0; x < final_result.length; x++) {
        let doc = final_result[x];
        for (const [format_code, outObj] of Object.entries(doc)) {   // for each format, load the final document
          if (outObj.sharedDoc_id === sharedDoc_id) {
            switch (outObj.type) {
              case 'text': {
                final_result[x][format_code].output = rawMessage;
                break;
              }
              case 'html': {
                final_result[x][format_code].output = htmlMessage;
                break;
              }
              default: {
                final_result[x][format_code].output = doc.output('blob');
              }
            }
          }
        }
      }
    }
    final_result.push(output_format);
  }
  return final_result;
}

export async function printRawData(dataRows, state) {
  // Header & Title
  await pdfLaunch({ client_id: state.session.client_id });
  page.title = 'Activity Listing';
  pdfHeader();
  dataRows.forEach((this_item, index) => {
    pdfDown(3);
    pdfStyle('reset');
    if (pdfCurrent.yPos > (page.bottom - (1.5 * page.margin.bottom))) {
      pdfCurrent.pageNumber++;
      pdfHeader();
    }
    pdfLine(this_item.workData.formatted_type, { size: 'large', style: 'bold' });
    pdfLine(this_item.workData.requestor_name, { size: 'large', style: 'normal' });
    let line;
    if (this_item?.current_request?.textInput['Room Number']) {
      line = this_item?.current_request?.textInput['Room Number'];
    }
    else if (this_item?.original_request?.textInput['Room Number']) {
      line = this_item?.original_request?.textInput['Room Number'];
    }
    else if (this_item.workData.requestor_location) {
      line = this_item.workData.requestor_location;
    }
    if (line) {
      pdfLine(line, { size: 'large', style: 'normal' });
    }
    pdfStyle({ size: 'small' });
    if (this_item.workData.updated) {
      pdfLine(this_item.workData.updated, {  });
    }
    if (this_item.requestor !== this_item.workData.enteredBy) {
      pdfLine(`By ${this_item.workData.enteredBy_name}`);
    }
    pdfLine(this_item.workData.display_date);
    if (this_item.workData.summary_request) {
      this_item.workData.summary_request.forEach((mLine, mIndex) => {
        if (typeof mLine[1] === 'string') {
          if (mLine[0] === 'head') {
            pdfLine(`Status: ${mLine[1]}`, { size: 'small', before: 0, indent: 0 });
          }
          else if (mLine[0] === 'qual') {
            pdfLine(mLine[1], { size: 'small', before: 0, indent: 10 });
          }
          else {
            pdfLine(mLine[1], { size: 'medium', before: 0.5, indent: 0 });
          }
        }
      });
    }
    if (this_item.workData.notes_section) {
      this_item.workData.notes_section.forEach((mLine, mIndex) => {
        if (typeof mLine[1] === 'string') {
          if (mLine[0] === 'head') {
            pdfLine(mLine[1], { size: 'medium', before: 0.5, indent: 0 });
          }
          else {
            pdfLine(mLine[1], { size: 'small', before: 0, indent: 10 });
          }
        }
      });
    }
    if (this_item.workData.formatted_request) {
      this_item.workData.formatted_request.forEach((mLine, mIndex) => {
        if (typeof mLine[1] === 'string') {
          if (mLine[0] === 'head') {
            pdfLine(mLine[1], { size: 'medium', before: 0.5, indent: 0 });
          }
          else {
            pdfLine(mLine[1], { size: 'small', before: 0, indent: 10 });
          }
        }
      });
    }
    if (this_item.workData.messageRecs) {
      this_item.workData.messageRecs.forEach((mLine, dX) => {
        if (mLine[0] === 'head') {
          pdfLine(mLine[1], { size: 'medium', before: 0.5, indent: 0 });
        }
        else {
          pdfLine(mLine[1], { size: 'small', before: 0, indent: 10 });
        }
      });
    }
  });
  let pdfInfo = {
    PDF: true, fileName: 'report_PDF', request_type: "force_print",
    s3Bucket: 'theseus-medical-storage',
    s3Key: `${state.session.client_id}_AVA_Report.pdf`,
  };
  let pdfResp = await savePDFBlob(doc.output('blob'), pdfInfo, { local: false, S3: true, onSave: 'print' });
  if (pdfResp.responseData.s3Resp) {
    pdfInfo.s3Location = pdfResp.responseData.s3Resp.Location;
  }
}

export async function savePDFBlob(pdfBlob, pdfInfo, options = {}) {
  let s3Resp;
  let responseStatus = 400;
  let responseData = { message: [] };
  if (options.S3) {
    let goodS3 = true;
    s3Resp = await s3
      .upload({
        Bucket: pdfInfo.s3Bucket,
        Key: pdfInfo.s3Key,
        Body: pdfBlob,
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
      top: body.margin.top || 84,
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
      bottom: (body.pdf.margin && body.pdf.margin.bottom) || (doc.internal.pageSize.height / 10),
      left: (body.pdf.margin && body.pdf.margin.left) || (doc.internal.pageSize.width / 12),
      right: (body.pdf.margin && body.pdf.margin.right) || (doc.internal.pageSize.width / 12)
    }
  };
  page.bottom = page.height - (2 * page.margin.bottom);
  page.right = page.width - page.margin.right;
  page.centerPoint = page.width / 2;
  page.printableArea = page.width - page.margin.left - page.margin.right;
  page.title = body?.print?.data?.title || page.title;
  page.info.title = page.title;
  clt({ page });

  let nowTime = makeDate(new Date());
  pdfCurrent = {
    yPos: page.margin.top,
    xPos: page.margin.left,
    pageNumber: ((body.multiPrint && !body.multiPrint.firstDoc) ? doc.internal.getNumberOfPages() + 1 : 1),
    indent: 0,
    reportTime: nowTime.absolute,
    timestamp: nowTime.numeric24,
    client_name: body?.print?.data?.client_name,
    logo: body?.print?.data?.logo
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
  if (customizations['logo_dimensions']) {
    pdfCurrent.logo_width = customizations['logo_dimensions'][0] / 2;
    pdfCurrent.logo_height = customizations['logo_dimensions'][1] / 2;
  }
  else {
    pdfCurrent.logo_width = 75;
    pdfCurrent.logo_height = 75;
  }
  pdfStyle('reset');
}

function pdfHeader() {
  clt({ pdfCurrent });
  if (pdfCurrent.pageNumber > 1) {
    doc.addPage({
      orientation: "portrait",
      format: ([page.width, page.height])
    });
  }
  let savedStyle = Object.assign({}, pdfCurrent);
  pdfCurrent.yPos = page.margin.top;
  pdfStyle('reset');
  if (pdfCurrent.logo) {
    // removed due to a security (CORS) policy violation
    // let extension = pdfCurrent.logo.split('.').pop().toUpperCase();   
    // doc.addImage(pdfCurrent.logo, extension, page.center - (pdfCurrent.logo_width / 2), pdfCurrent.yPos, pdfCurrent.logo_width, pdfCurrent.logo_height);
    // pdfCurrent.yPos += pdfCurrent.logo_height;
  }
  pdfStyle({ size: 'large', align: 'center', style: 'bold' });
  doc.text(pdfCurrent.client_name || 'AVA', page.center, pdfCurrent.yPos, { align: 'center' });
  if (page.title) {
    pdfStyle({ size: 'large', before: 1.5, style: 'normal' });
    doc.text(page.title, page.center, pdfCurrent.yPos, { align: 'center' });
  }
  pdfStyle({ size: 'small', before: 2, style: 'normal' });
  doc.text(pdfCurrent.headerSubtitle || pdfCurrent.reportTime, page.center, pdfCurrent.yPos, { align: 'center' });
  if (pdfCurrent.pageNumber > 1) {
    pdfStyle({ size: 'small', before: 1 });
    doc.text(`Page ${pdfCurrent.pageNumber}`, page.center, pdfCurrent.yPos, { align: 'center' });
    pdfDown(4);
    pdfCurrent = Object.assign({}, savedStyle, { yPos: pdfCurrent.yPos });
    pdfStyle(pdfCurrent);
  }
  else {
    pdfStyle('reset');
    pdfDown(1);
  }
}

function pdfLine(text, options = {}) {
  clt({ pdfLine: text, options });
  if (options) {
    pdfStyle(options);
  }
  let remembered_indent = pdfCurrent.indent;
  if (options.hasOwnProperty('before')) {
    delete options.before;
  }
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
  if (!options.noNewPage && (pdfCurrent.yPos >= page.bottom)) {
    pdfCurrent.pageNumber++;
    pdfHeader();
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
      else if ((pdfCurrent.align !== 'center') && ((doc.getTextWidth(text) + pdfCurrent.xPos + pdfCurrent.indent + 10) > page.right)) {
        tWords = doc.splitTextToSize(text, (page.right - (pdfCurrent.xPos + pdfCurrent.indent)));
      }
      if (tWords.length > 1) {        
        for (let t = 0; t < tWords.length - 1; t++) {
          doc.text(tWords[t], pdfCurrent.xPos + pdfCurrent.indent, pdfCurrent.yPos);
          pdfCurrent.indent = remembered_indent + 10;
          pdfDown(1);
        }
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
  if (options.after) {
    pdfDown(options.after);
  }
  if (remembered_indent) {
    pdfCurrent.indent = remembered_indent;
  }
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
    if (options.before) {
      pdfDown(options.before);
    }
  }
}

export async function printRequestsOnePerPage(dataRows, options = {}) {
  if (!dataRows || dataRows.length === 0) {
    return { success: false, message: 'No requests to print.' };
  }

  await pdfLaunch({
    client_id: options.client_id,
    print: { data: { client_name: options.client_name } }
  });
  page.title = '';  // request type only shown in the data body, not the header

  for (let index = 0; index < dataRows.length; index++) {
    const item = dataRows[index];
    pdfCurrent.headerSubtitle = item.local_key ? `Request #${item.local_key}` : '';
    if (index > 0) {
      pdfCurrent.pageNumber++;
    }
    pdfHeader();
    pdfStyle('reset');

    // Request type
    pdfLine(item.workData.formatted_type || '', { size: 'large', style: 'bold' });

    // Requestor name + location
    const nameLine = (item.workData.requestor_name || '')
      + (item.workData.requestor_location ? ` (${item.workData.requestor_location})` : '');
    pdfLine(nameLine, { size: 'large', style: 'normal' });

    // Status
    if (item.workData.this_status) {
      pdfLine(`Status: ${item.workData.this_status}`, { size: 'medium', style: 'normal' });
    }

    pdfStyle({ size: 'small' });

    // Date submitted — use absolute format so exact date/time is shown
    const _reqDate = item.request_date ? makeDate(item.request_date).absolute : item.workData.display_date;
    if (_reqDate) { pdfLine(_reqDate); }

    // Entered by (if different from requestor)
    if (item.requestor !== item.workData.enteredBy) {
      pdfLine(`By ${item.workData.enteredBy_name}`);
    }

    // Summary request lines
    if (item.workData.summary_request) {
      item.workData.summary_request.forEach(([type, value]) => {
        if (type === 'qa' && value && typeof value === 'object') {
          // Question on its own line, answer below in bold at 1.2x size
          const question = value.question || '';
          const rawAnswerText = Array.isArray(value.answers)
            ? value.answers.join(', ')
            : (value.answers || '');
          // \u2713 is not renderable in jsPDF Helvetica; substitute a readable affirmative
          const answerText = rawAnswerText.replace(/\u2713/g, 'Yes');
          pdfLine(question, { size: 'medium', style: 'normal', before: 1, indent: 10 });
          if (answerText) {
            pdfLine(answerText, { size: 'medium', fontSize: pdfCurrent.fontSize * 1.2, style: 'bold', indent: 10 });
            pdfStyle({ style: 'normal', fontSize: page.font.size.medium });
          }
        } else if (typeof value === 'string') {
          if (type === 'head') { pdfLine(value, { size: 'medium', style: 'bold', before: 0.5 }); }
          else if (type === 'qual') { pdfLine(value, { size: 'small', indent: 10 }); }
          else { pdfLine(value, { size: 'medium', before: 0.5 }); }
        }
      });
    }

    // Notes section
    if (item.workData.notes_section?.length > 0) {
      item.workData.notes_section.forEach(([type, value]) => {
        if (typeof value !== 'string') { return; }
        if (type === 'head') { pdfLine(value, { size: 'medium', style: 'bold', before: 0.5 }); }
        else { pdfLine(value, { size: 'small', indent: 10 }); }
      });
    }

    // Activity log — loaded from ServiceRequestLog, mirrors on-screen history section
    const activityLog = await getRequestLog(item.request_id);
    if (activityLog && activityLog.length > 0) {
      pdfLine('Activity History', { size: 'medium', style: 'bold', before: 2 });
      pdfStyle({ style: 'normal', size: 'small' });
      activityLog.forEach(entry => {
        const entryDate = makeDate(entry.log_time).absolute;
        pdfLine(`${entryDate}  \u2014  ${entry.activity}`, { size: 'small', indent: 10 });
      });
    }
  }

  const safeTitle = (options.title || 'requests').replace(/[^a-zA-Z0-9]/g, '_');
  const pdfInfo = {
    PDF: true,
    fileName: `${safeTitle}_print.pdf`,
    request_type: 'force_print',
    s3Bucket: 'theseus-medical-storage',
    s3Key: `${options.client_id || 'unknown'}_AVA_Report.pdf`,
  };
  const pdfResp = await savePDFBlob(doc.output('blob'), pdfInfo, { local: false, S3: true, onSave: 'print' });
  if (pdfResp.responseData?.s3Resp) {
    pdfInfo.s3Location = pdfResp.responseData.s3Resp.Location;
  }
  return {
    success: true,
    message: `Printed ${dataRows.length} request${dataRows.length > 1 ? 's' : ''}.`,
    pdfInfo
  };
}
