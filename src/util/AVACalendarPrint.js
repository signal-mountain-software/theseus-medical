import { clt, cl, s3, titleCase } from './AVAUtilities';
import { getCustomizations } from './AVAUtilities';
import { makeDate, addDays} from './AVADateTime';

import { jsPDF } from "jspdf";
import 'jspdf-autotable';

import htmlToFormattedText from "html-to-formatted-text";

let page = {};
let pdfCurrent = {};
let doc;

// Functions

export async function printCalendar(requestBody) {
  /* 
  requestBody expects {
    client_id
    myCalendar
    eventList (from default events.future typically)
    requestor
    first_date
  }
  */

  // all calendar entries for the next 90 days are pre-loaded into eventList
  let myCalendar = [];
  if (requestBody.myCalendar) {
    myCalendar = requestBody.myCalendar;
  }
  else {
    requestBody.currentEvent.find(e => {
      return e.hasOwnProperty('eventList');
    });
  }

  // make all calendar entries contain a ymd element
  myCalendar.forEach((entry, x) => {
    myCalendar[x].ymd = makeDate(entry.date).ymd;
  });

  let firstDate;
  if (requestBody.first_date) {
    // find the Sunday on or before the date passed in
    let bodyFirst = makeDate(requestBody.first_date);
    firstDate = addDays(bodyFirst.date, (-1 * bodyFirst.dayOfWeek));
  }
  else {
    // find the Sunday on or before the first date in myCalendar
    let calFirst = makeDate(myCalendar[0].date);
    firstDate = addDays(calFirst.date, (-1 * calFirst.dayOfWeek));
  }

  // Standard 8.5 x 11 output for a Request of any type
  // Prep the PDF output
  await pdfLaunch({
    orientation: 'landscape',
    client_id: requestBody.client_id,
    pdf: {
      pageWidth: 999,
      pageHeight: 999
    }
  });

  // this will hold the whole month
  let calendarGrid = [];  // inside this grid is an array for each row (week)
  let headRow = [
    [{
      content: makeDate(firstDate).absolute_full.split(' ')[1],
      colSpan: 7,
      styles: { halign: 'center', fontSize: 30, valign: 'middle' }
    }],
    ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  ];

  // loop for five weeks
  for (let weekNumber = 0; weekNumber < 5; weekNumber++) {
    let sunday = addDays(firstDate, (weekNumber * 7));
    // fill a week
    let this_week = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      let this_day = makeDate(addDays(sunday, dayOfWeek));
      let dayOfMonth = this_day.date.getDate();
      if (dayOfMonth === 1) {
        this_week[dayOfWeek] = `${this_day.dateOnly}`;
      }
      else {
        this_week[dayOfWeek] = dayOfMonth.toString();
      }
      myCalendar.forEach(entry => {
        if (entry.ymd === this_day.ymd) {
          if (okToShow(entry)) {
            let showTime = '';
            if (entry.time) {
              showTime = entry.time.split(' ')[0].trim();
            }
            this_week[dayOfWeek] += `\n\r${showTime ? (showTime + ' ') : ''}${entry.description}`;
          }
        }
      });
    }
    calendarGrid.push(this_week);
  }

  // set up grid Display
  let columnStyles = {};
  let headStyles = {
    halign: 'center',
    fontSize: 12,
    fontStyle: 'bold',
    minCellHeight: 10
  };
  let bodyStyles = {
    halign: 'center',
    minCellHeight: 120
  };

  for (let c = 0; c < 7; c++) {
    columnStyles[c] = {
      halign: 'center',
      cellWidth: 120
    };
  }
  doc.autoTable({
    head: headRow,
    body: calendarGrid,
    startY: 70,
    theme: 'grid',
    columnStyles: columnStyles,
    headStyles: headStyles,
    bodyStyles: bodyStyles
  });

  // file name
  if (requestBody.fileName && requestBody.fileName.slice(-4) !== '.pdf') {
    requestBody.fileName += '.pdf';
  }
  let pdfInfo = {
    s3Key: (requestBody.fileName || `Calendar_${requestBody.requestor}_${makeDate(firstDate).ymd}.pdf`),
    s3Bucket: (requestBody.S3_bucket || 'theseus-medical-storage')
  };

  // finish and save
  pdfStyle('reset')
  pdfStyle({ size: 'small', before: 1 });
  pdfLine(`***** END *****`, { align: 'center_bottom', noNewPage: true, noNewLine: true, before: 6 });
  let pdfResp = await savePDF(doc, pdfInfo, { local: true, S3: true });
  if (pdfResp.responseData.s3Resp) {
    pdfInfo.s3Location = pdfResp.responseData.s3Resp.Location;
  }

  function okToShow(this_event) {
    if (this_event.date === '29991231') { return false; }   // event was soft-deleted
    else if (this_event.groups && (this_event.groups[0] !== '*all')) {
      let belongsToASelectedGroup = this_event.groups.some(g => {
        return (requestBody.hasOwnProperty(g));
      });
      if (!belongsToASelectedGroup) {
        return false;
      }
    }
    if (!requestBody.filterTextLower) {
      return true;
    }
    else {
      return (`${this_event.description} ${this_event.location}`).toLowerCase().includes(requestBody.filterTextLower);
    }
  }

}

async function savePDF(doc, pdfInfo, options = {}) {
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
    responseStatus++;
    responseData.message.push(`Locally saved as ${pdfInfo.s3Key}`);
    responseData.saveName = pdfInfo.s3Key;
  }
  return {
    responseStatus,
    responseData
  };

}

async function pdfLaunch(body) {
  if (!body.hasOwnProperty('pdf')) { body.pdf = {}; }
  if (!body.multiPrint || body.multiPrint.firstDoc) {
    doc = new jsPDF({
      orientation: body.orientation || 'portrait',
      unit: "px",
      format: ((body.pdf.pageWidth) ? [body.pdf.pageWidth, (body.pdf.pageHeight || 9999)] : [563, 750])
    });
  }
  else {
    doc.addPage({
      orientation: body.orientation || 'portrait',
      format: ((body.pdf.pageWidth) ? [body.pdf.pageWidth, (body.pdf.pageHeight || 9999)] : [563, 750])
    });
  }
  page = {
    orientation: body.orientation || 'portrait',
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

  
  page.title = body.pdf.title || 'Calendar';
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
  let customizations = await getCustomizations('*all', body.client_id);
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
      orientation: page.orientation,
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
        // doc.addImage(options.image, 'JPEG', xOffset, pdfCurrent.yPos, imageSize, imageSize);
        doc.addImage(options.image, 'JPEG', xOffset, pdfCurrent.yPos);
        pdfCurrent.xPos = xOffset + imageSize;
      }
    }
    pdfCurrent.yPos += imageSize;
  }
  else if (options.html) {
    delete options.html;
    pdfLine(htmlToFormattedText(text), options);
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
    else if(pdfCurrent.align === 'center_bottom') {
      let xOffset = page.centerPoint - (doc.getTextWidth(text) / 2);
      doc.text(text, xOffset, page.height - page.margin.bottom - 10);
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
