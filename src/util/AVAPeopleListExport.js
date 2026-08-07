import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

import { dbClient, recordExists, deepCopy, resolveData, cl, getObject } from './AVAUtilities';

export function formatExportValue(value, options = {}) {
  const arraySeparator = (typeof options?.arraySeparator === 'string') ? options.arraySeparator : '; ';
  if ((value === null) || (value === undefined)) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'yes' : 'no';
  }
  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === 'true') {
      return 'yes';
    }
    if (normalizedValue === 'false') {
      return 'no';
    }
  }
  if (Array.isArray(value)) {
    return value.join(arraySeparator);
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    }
    catch {
      return '';
    }
  }
  return value;
}

// Truthiness for logical_and/logical_or evaluation — mirrors formatExportValue's yes/no
// string handling so 'true'/'false' strings and booleans are treated consistently.
function isTruthyExportValue(value) {
  if ((value === null) || (value === undefined) || (value === '')) {
    return false;
  }
  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === 'false') { return false; }
    if (normalizedValue === 'no') { return false; }
    if (normalizedValue === 'n') { return false; }
    if (normalizedValue === '0') { return false; }
    if (normalizedValue === '') { return false; }
    return true;
  }
  return !!value;
}

/**
 * Collapse a list of resolved values to a single "yes"/"no" string.
 * @param {'and'|'or'} mode 'and' requires every value truthy; 'or' requires at least one.
 */
export function evaluateLogicalFieldValues(rawValue, mode) {
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  if (values.length === 0) { return 'no'; }
  const isMatch = (mode === 'and')
    ? values.every(isTruthyExportValue)
    : values.some(isTruthyExportValue);
  return isMatch ? 'yes' : 'no';
}

export function sanitizeExportBaseName(baseName, fallback = 'export') {
  return String(baseName || fallback)
    .replace(/[^a-z0-9]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function csvSafe(value) {
  if ((value === null) || (value === undefined)) {
    return '';
  }
  const stringValue = `${value}`.replace(/"/g, '""');
  return `"${stringValue}"`;
}

export async function getSavedExportFieldSelections({ sessionId, clientId, exportScope, logLabel = 'export selections' }) {
  if (!sessionId || !clientId || !exportScope) {
    return [];
  }

  const sessionRec = await dbClient
    .get({
      TableName: 'SessionsV2',
      Key: { session_id: sessionId }
    })
    .promise()
    .catch((error) => {
      cl({ [`Error reading SessionsV2 for ${logLabel}`]: error });
    });

  if (!recordExists(sessionRec)) {
    return [];
  }

  return [sessionRec.Item?.customizations?.csv_export?.[exportScope]?.[clientId]?.selected_fields]
    .flat()
    .filter((fieldName) => (typeof fieldName === 'string') && (fieldName.trim() !== ''));
}

export async function saveExportFieldSelections({ sessionId, clientId, exportScope, selectedFieldNames = [], logLabel = 'export selections' }) {
  if (!sessionId || !clientId || !exportScope) {
    return;
  }

  const sessionRec = await dbClient
    .get({
      TableName: 'SessionsV2',
      Key: { session_id: sessionId }
    })
    .promise()
    .catch((error) => {
      cl({ [`Error reading SessionsV2 before save ${logLabel}`]: error });
    });

  let customizations = deepCopy(sessionRec?.Item?.customizations || {});
  if (!customizations.csv_export) {
    customizations.csv_export = {};
  }
  if (!customizations.csv_export[exportScope]) {
    customizations.csv_export[exportScope] = {};
  }

  customizations.csv_export[exportScope][clientId] = {
    selected_fields: [...selectedFieldNames],
    updated_at: new Date().toISOString(),
  };

  await dbClient
    .update({
      TableName: 'SessionsV2',
      Key: { session_id: sessionId },
      UpdateExpression: 'set #c = :c',
      ExpressionAttributeNames: {
        '#c': 'customizations'
      },
      ExpressionAttributeValues: {
        ':c': customizations
      }
    })
    .promise()
    .catch((error) => {
      cl({ [`Error saving SessionsV2 ${logLabel}`]: error });
    });
}

export async function getExportFieldPickerData({ sessionId, clientId, exportScope, excludeFieldKeys = [], logLabel = 'export' }) {
  const normalizedExclusions = new Set(
    [excludeFieldKeys].flat().map(k => `${k}`.trim().toLowerCase()).filter(Boolean)
  );

  const formFieldsRec = await dbClient
    .query({
      KeyConditionExpression: 'client_id = :c',
      TableName: 'DataDictionaryV3',
      ExpressionAttributeValues: {
        ':c': clientId
      }
    })
    .promise()
    .catch(error => {
      cl({ [`Error reading DataDictionaryV3 for ${logLabel}`]: error });
    });

  let exportFieldOptions = [];
  if (recordExists(formFieldsRec)) {
    exportFieldOptions = formFieldsRec.Items
      .filter((fieldRec) => !!fieldRec?.field_key && !normalizedExclusions.has(`${fieldRec.field_key}`.trim().toLowerCase()))
      .map((fieldRec) => ({
        field_key: fieldRec.field_key,
        description: fieldRec.description || fieldRec.field_key,
        category: fieldRec.category || 'Other',
        value_type: fieldRec?.type,
        export_formats: Array.isArray(fieldRec?.export_formats) ? fieldRec.export_formats : null,
        filters: Array.isArray(fieldRec?.filters) ? fieldRec.filters : null,
        pdf_data_group: fieldRec?.pdf_data_group || null,
        table_info: fieldRec?.table_info || null,
        ignore_section: !!fieldRec?.ignore_section,
      }))
      .sort((a, b) => {
        const catCompare = (a.category || '').localeCompare(b.category || '');
        if (catCompare !== 0) {
          return catCompare;
        }
        return (a.description || '').localeCompare(b.description || '');
      });
  }

  const savedSelectionList = await getSavedExportFieldSelections({
    sessionId,
    clientId,
    exportScope,
    logLabel
  });

  const selectedExportFieldNames = exportFieldOptions
    .map((fieldRec) => fieldRec.field_key)
    .filter((fieldName) => savedSelectionList.includes(fieldName));

  return {
    exportFieldOptions,
    selectedExportFieldNames
  };
}

/**
 * Resolve selected DataDictionary fields for a set of people for export.
 *
 * Notes:
 * - Uses a shared in-memory `dictionaryCache` across all people in this run.
 * - Disables address lookup/resolve for speed and to avoid side effects during export.
 *
 * @param {Object} params
 * @param {string} params.clientId
 * @param {string[]} [params.personIds=[]]
 * @param {string[]} [params.selectedFieldKeys=[]]
 * @param {(progress:{completedCount:number,totalCount:number}) => void} [params.onProgress=null]
 * @returns {Promise<Object<string, any[]>>} Map of `person_id` to resolved/formatted field value list.
 */
export async function resolveSelectedFieldValuesForPeople({
  clientId,
  personIds = [],
  selectedFieldKeys = [],
  selectedFieldOptions = [],
  arraySeparator = '; ',
  preserveGroupedRaw = false,
  onProgress = null
}) {
  if (!Array.isArray(selectedFieldKeys) || selectedFieldKeys.length === 0) {
    return {};
  }

  const dictionaryCache = {};
  const outputByPersonId = {};
  const totalCount = personIds.length;
  let completedCount = 0;
  const batchSize = (selectedFieldKeys.length > 20) ? 4 : 8;
  const progressUpdateEvery = Math.max(1, Math.floor(totalCount / 100));

  const fieldOptionByKey = Object.fromEntries(
    selectedFieldOptions.map(opt => [opt.field_key, opt])
  );

  const resolveForPerson = async (personId) => {
    const resolvedFieldList = await resolveData(
      clientId,
      personId,
      selectedFieldKeys,
      {
        dictionaryCache,
        address_lookup: false,
        resolve_address: false
      }
    );

    outputByPersonId[personId] = selectedFieldKeys.map((fieldKey, fieldIndex) => {
      const resolvedField = resolvedFieldList[fieldIndex];
      const fieldOpt = fieldOptionByKey[fieldKey];
      if (fieldOpt?.value_type === 'notes') {
        const rawNotes = Array.isArray(resolvedField?.raw) ? resolvedField.raw : [];
        const staticFilters = (fieldOpt.filters || []).filter(f => f.source !== 'prompt');
        return evaluateNoteFilters(rawNotes, staticFilters);
      }
      if (fieldOpt?.value_type === 'logical_and' || fieldOpt?.value_type === 'logical_or') {
        return evaluateLogicalFieldValues(resolvedField?.raw, (fieldOpt.value_type === 'logical_and') ? 'and' : 'or');
      }
      // Keep the pre-join array for grouped fields so the PDF renderer can transpose instances by index.
      if (preserveGroupedRaw && fieldOpt?.pdf_data_group) {
        return resolvedField?.formatted;
      }
      return formatExportValue(resolvedField?.formatted, { arraySeparator });
    });

    completedCount += 1;
    if (onProgress && ((completedCount % progressUpdateEvery === 0) || (completedCount === totalCount))) {
      onProgress({ completedCount, totalCount });
    }
  };

  for (let startIndex = 0; startIndex < personIds.length; startIndex += batchSize) {
    const endIndex = Math.min(startIndex + batchSize, personIds.length);
    const personBatch = [];
    for (let personIndex = startIndex; personIndex < endIndex; personIndex++) {
      personBatch.push(personIds[personIndex]);
    }
    await Promise.all(personBatch.map(resolveForPerson));
  }

  return outputByPersonId;
}

/**
 * Evaluate a set of filters against an array of note objects.
 * Static filters (no source: "prompt") should already be evaluated before reaching PDF render;
 * prompt-driven filters use resolvedPromptValues keyed by prompt_label.
 */
export function evaluateNoteFilters(notes, filters = [], resolvedPromptValues = {}) {
  if (!Array.isArray(notes)) { return []; }
  if (!Array.isArray(filters) || filters.length === 0) { return notes; }
  return notes.filter(note =>
    filters.every(filter => {
      const rawFieldValue = note[filter.field];
      const fieldValue = (rawFieldValue === undefined || rawFieldValue === null) && filter.field === 'note_timestamp'
        ? Date.now() - 60 * 86400000
        : rawFieldValue;
      const filterValue = (filter.source === 'prompt')
        ? resolvedPromptValues[filter.prompt_label || filter.field]
        : filter.value;
      if (filterValue === undefined || filterValue === null) { return true; }
      switch (filter.operator) {
        case 'eq':  return fieldValue === filterValue;
        case 'ne':  return fieldValue !== filterValue;
        case 'gt':  return fieldValue > filterValue;
        case 'lt':  return fieldValue < filterValue;
        case 'gte': return fieldValue >= filterValue;
        case 'lte': return fieldValue <= filterValue;
        case 'between': {
          const { from, to } = (filterValue || {});
          return (from === undefined || fieldValue >= from) && (to === undefined || fieldValue <= to);
        }
        case 'ct': {
          const selected = Array.isArray(filterValue) ? filterValue : [filterValue];
          return selected.includes(fieldValue);
        }
        default: return true;
      }
    })
  );
}

/**
 * Collect the unique prompt specs needed before a PDF export.
 * Only notes-type fields with filters that have source: "prompt" contribute.
 * Deduplicates by prompt_label so the same date-range prompt isn't shown twice
 * when two notes fields share it.
 */
export function collectPromptSpecs(selectedFieldOptions = []) {
  const specs = [];
  const seenLabels = new Set();
  for (const fieldOpt of selectedFieldOptions) {
    if (fieldOpt.value_type !== 'notes') { continue; }
    if (!Array.isArray(fieldOpt.filters)) { continue; }
    for (const filter of fieldOpt.filters) {
      if (filter.source !== 'prompt') { continue; }
      const label = filter.prompt_label || filter.field;
      if (seenLabels.has(label)) { continue; }
      seenLabels.add(label);
      specs.push({
        prompt_label: label,
        value_type: filter.value_type || null,
        operator: filter.operator,
        field: filter.field,
      });
    }
  }
  return specs;
}

export function downloadRowsAsCsv({ header = [], rows = [], fileName = 'export.csv' }) {
  const csvContent = [header, ...rows]
    .map(row => row.map(csvSafe).join(','))
    .join('\n');

  const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const csvUrl = URL.createObjectURL(csvBlob);
  const downloadLink = document.createElement('a');
  downloadLink.href = csvUrl;
  downloadLink.setAttribute('download', fileName);
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(csvUrl);
}

export function downloadRowsAsXlsx({
  header = [],
  rows = [],
  fileName = 'export.xlsx',
  hiddenHeaderLabels = []
}) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('People List', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });
  const hiddenLabelSet = new Set(
    [hiddenHeaderLabels]
      .flat()
      .map((label) => `${label ?? ''}`.trim().toLowerCase())
      .filter(Boolean)
  );
  worksheet.addRow(header);
  rows.forEach((row) => worksheet.addRow(row));

  const maxColumnWidth = 60;
  worksheet.columns = header.map((headerLabel, columnIndex) => {
    const maxValueLength = rows.reduce((longest, row) => {
      const value = row[columnIndex];
      const length = `${value ?? ''}`.length;
      return Math.max(longest, length);
    }, `${headerLabel ?? ''}`.length);

    return {
      width: Math.min(Math.max(maxValueLength + 2, 10), maxColumnWidth),
      hidden: hiddenLabelSet.has(`${headerLabel ?? ''}`.trim().toLowerCase())
    };
  });

  // Wrap long values within each cell so content stays inside the column width.
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = {
        ...(cell.alignment || {}),
        wrapText: true,
        vertical: 'top'
      };
    });
  });

  workbook.xlsx.writeBuffer()
    .then((buffer) => {
      const xlsxBlob = new Blob(
        [buffer],
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      );
      const xlsxUrl = URL.createObjectURL(xlsxBlob);
      const downloadLink = document.createElement('a');
      downloadLink.href = xlsxUrl;
      downloadLink.setAttribute('download', fileName);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(xlsxUrl);
    })
    .catch((error) => {
      cl({ 'Error creating xlsx export': error });
    });
}

// Load an image URL into a base64 data-URI for embedding in jsPDF.
async function loadImageAsBase64(url) {
  if (!url) { return null; }
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) { return null; }
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  }
  catch { return null; }
}

/**
 * Generate a PDF with one page per person.
 * Each page shows: optional photo, person name + ID as a centered header,
 * then all selected fields as "Label: Value" pairs flowing down the page.
 *
 * @param {Object} params
 * @param {string[]} params.header         Column labels from buildCurrentPeopleListExportData
 * @param {Array[]}  params.rows           Data rows (parallel to header)
 * @param {string}   params.fileName       Output file name (e.g. 'group_people_list.pdf')
 * @param {number}   params.personIdColIndex   Column index containing the person_id (for photo lookup)
 * @param {number}   params.personNameColIndex Column index containing the display name
 * @param {number}   params.identityColCount   How many leading columns to skip in the field list
 * @param {string}   [params.reportTitle='']   Optional subtitle shown at top of each page
 */
export async function downloadRowsAsPdf({
  header = [],
  rows = [],
  fileName = 'export.pdf',
  personIdColIndex = 0,
  personNameColIndex = 0,
  identityColCount = 1,
  reportTitle = '',
  fieldMeta = [],
  resolvedPromptValues = {},
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();   // 612 pt
  const pageHeight = doc.internal.pageSize.getHeight(); // 792 pt
  const margin = 40;
  const contentWidth = pageWidth - (margin * 2);
  const lineHeight = 16;
  const photoSize = 80;

  const fieldLabels = header.slice(identityColCount);

  // Fields sharing a pdf_data_group are transposed by instance (see renderGroupedFieldSet below)
  // instead of being listed one field at a time.
  const groupFieldIndexes = {};
  for (let j = 0; j < fieldLabels.length; j++) {
    const groupKey = fieldMeta[j]?.pdf_data_group;
    if (!groupKey) { continue; }
    if (!groupFieldIndexes[groupKey]) { groupFieldIndexes[groupKey] = []; }
    groupFieldIndexes[groupKey].push(j);
  }

  for (let i = 0; i < rows.length; i++) {
    if (i > 0) { doc.addPage(); }

    const row = rows[i];
    const personId = `${row[personIdColIndex] || ''}`;
    const personName = `${row[personNameColIndex] || ''}`;
    const fieldValues = row.slice(identityColCount);

    let y = margin;

    // Photo — centered, square
    const photoUrl = personId ? getObject(personId, 'image') : '';
    if (photoUrl) {
      const base64 = await loadImageAsBase64(photoUrl);
      if (base64) {
        const photoX = (pageWidth - photoSize) / 2;
        try { doc.addImage(base64, 'JPEG', photoX, y, photoSize, photoSize); }
        catch {
          try { doc.addImage(base64, 'PNG', photoX, y, photoSize, photoSize); }
          catch { /* photo format unrecognized — skip */ }
        }
        y += photoSize + 24;
      }
    }

    // Person name — large, bold, centered
    doc.setFontSize(18);
    doc.setFont('Helvetica', 'bold');
    doc.text(personName || '(no name)', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Person ID — small, gray, centered
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(90, 90, 90);
    doc.text(`ID: ${personId}`, pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 16;

    // Divider
    doc.setLineWidth(0.5);
    doc.setDrawColor(190, 190, 190);
    doc.line(margin, y, pageWidth - margin, y);
    doc.setDrawColor(0, 0, 0);
    y += 14;

    // Per-person page counter for overflow continuation pages, kept in a stable ref object (rather
    // than a loop-scoped let) so closures over it don't trip the no-loop-func lint rule.
    const personPageNumRef = { current: 1 };

    // Draws the "<name> (page N)" + underline banner at the top of a fresh overflow-continuation page.
    const drawContinuationHeader = () => {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`${personName || '(no name)'} (page ${personPageNumRef.current})`, margin, margin);
      doc.setLineWidth(0.75);
      doc.setDrawColor(0, 0, 0);
      doc.line(margin, margin + 6, pageWidth - margin, margin + 6);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      return margin + 6 + lineHeight;
    };

    // Call this instead of a bare doc.addPage() for any overflow-driven page break within a
    // person's content: stamps a small "continued onto next page" footer on the page being left,
    // then starts the new page with the person's name/page-number banner. Returns the new y.
    const addOverflowPage = () => {
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`${personName || '(no name)'} continued onto next page`, pageWidth / 2, pageHeight - 20, { align: 'center' });
      doc.setTextColor(0, 0, 0);

      doc.addPage();
      personPageNumRef.current++;
      return drawContinuationHeader();
    };

    // Field rows
    doc.setFontSize(10);
    let currentCategory = null;
    const renderCategoryHeader = (categoryName, { allowBlank = false } = {}) => {
      const normalizedCategory = allowBlank ? `${categoryName || ''}`.trim() : (`${categoryName || 'Other'}`.trim() || 'Other');
      if (currentCategory === normalizedCategory) {
        return;
      }

      const requiredSpace = (lineHeight * 3);
      if (y > pageHeight - margin - requiredSpace) {
        y = addOverflowPage();
      }

      // Leave breathing room before each category section.
      y += (lineHeight * 2);
      if (y > pageHeight - margin - lineHeight) {
        y = addOverflowPage() + (lineHeight * 2);
      }

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(normalizedCategory, margin, y);
      y += lineHeight;

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(10);
      currentCategory = normalizedCategory;
    };

    // ignore_section fields never start a new section — they render into whatever section is
    // already active. If one happens to be the very first field on the page (no section shown
    // yet), a header is still rendered (for consistent spacing) but with blank text.
    const renderSectionHeader = (fieldMetaEntry, categoryName) => {
      if (fieldMetaEntry?.ignore_section) {
        if (currentCategory === null) {
          renderCategoryHeader('', { allowBlank: true });
        }
        return;
      }
      renderCategoryHeader(categoryName);
    };

    // Shared "Label: value" line renderer — wraps, paginates, and aligns the value after the label.
    const renderLabelValueRow = (labelText, value) => {
      if (y > pageHeight - margin - lineHeight) {
        y = addOverflowPage();
      }

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(labelText, margin, y);
      // Trailing spaces aren't reliably measured by getTextWidth, so add an explicit gap
      // rather than relying on a trailing space in labelText (which rendered inconsistently field-to-field).
      const labelGap = 4;
      const labelWidth = doc.getTextWidth(labelText) + labelGap;

      doc.setFont('Helvetica', 'normal');
      const valueLines = doc.splitTextToSize(value, contentWidth - labelWidth);
      doc.text(valueLines[0], margin + labelWidth, y);
      y += lineHeight;

      for (let k = 1; k < valueLines.length; k++) {
        if (y > pageHeight - margin - lineHeight) {
          y = addOverflowPage();
        }
        doc.text(valueLines[k], margin + labelWidth, y);
        y += lineHeight;
      }
    };

    const groupSpacing = 8;
    const addGroupGap = () => {
      if (y > pageHeight - margin - groupSpacing) {
        y = addOverflowPage();
      } else {
        y += groupSpacing;
      }
    };

    // Draws a static/blank fill-in table (e.g. printable log sheet) at the current y position.
    // Shared by the single-field render path and by each iteration of a pdf_data_group, since a
    // static_table field carries no per-instance value of its own to loop over.
    const drawStaticTable = (meta) => {
      const tableInfo = meta.table_info;
      const columnDefs = (tableInfo.columns?.values || []).filter((c) => c?.header);
      if (columnDefs.length === 0) { return; }

      const rawColumnWidths = columnDefs.map((c) => Number(c.width) || 0);
      const totalRawWidth = rawColumnWidths.reduce((sum, w) => sum + w, 0);
      // Shrink proportionally to fit the printable width; never scale up.
      const widthScale = (totalRawWidth > contentWidth) ? (contentWidth / totalRawWidth) : 1;
      const columnWidths = rawColumnWidths.map((w) => w * widthScale);

      const rowHeight = Number(tableInfo.rows?.height) || lineHeight;
      const headerRowHeight = Number(tableInfo.rows?.header_height) || rowHeight;
      const blankRowCount = Math.max(0, Number(tableInfo.rows?.minimum) || 0);
      const bodyRows = Array.from({ length: blankRowCount }, () => columnDefs.map(() => ''));

      const gridLineWidth = Number(tableInfo.borders?.grid) || 1;
      const outsideLineWidth = Number(tableInfo.borders?.outside) || gridLineWidth;
      const afterHeaderLineWidth = Number(tableInfo.borders?.after_header) || gridLineWidth;

      const columnStyles = {};
      columnWidths.forEach((w, idx) => { columnStyles[idx] = { cellWidth: w }; });

      const tableStartY = y;
      // If the table's own blank rows overflow a page on their own (no manual overflow check
      // above caught it), autoTable paginates internally — track its page breaks here so the
      // continuation banner still appears, even though we don't get a chance to add the
      // "continued onto next page" footer on the page being left in that specific case.
      let lastHandledTablePage = doc.internal.getCurrentPageInfo().pageNumber;
      doc.autoTable({
        head: [columnDefs.map((c) => c.header)],
        body: bodyRows,
        startY: tableStartY,
        margin: { left: margin, right: margin, top: margin + 6 + lineHeight },
        theme: 'grid',
        // 'wrap' keeps the border/width tied to the actual columns instead of the full page width,
        // and lets tableLineWidth/tableLineColor draw the outer edge per-page — a page break splits
        // this rect manually (using startY/finalY, which live on different pages) into a bogus box.
        tableWidth: 'wrap',
        tableLineWidth: outsideLineWidth,
        tableLineColor: [0, 0, 0],
        styles: { lineWidth: gridLineWidth, lineColor: [0, 0, 0], minCellHeight: rowHeight, valign: 'middle' },
        headStyles: { fontStyle: 'bold', halign: 'left', fillColor: [240, 240, 240], textColor: [0, 0, 0], minCellHeight: headerRowHeight },
        columnStyles,
        didDrawPage: () => {
          const currentPageNumber = doc.internal.getCurrentPageInfo().pageNumber;
          if (currentPageNumber > lastHandledTablePage) {
            lastHandledTablePage = currentPageNumber;
            personPageNumRef.current++;
            drawContinuationHeader();
          }
        },
        didDrawCell: (data) => {
          // Give the header/body divider its own (heavier) weight, distinct from the internal grid.
          if (data.section === 'head') {
            doc.setLineWidth(afterHeaderLineWidth);
            doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
            doc.setLineWidth(gridLineWidth);
          }
        }
      });

      y = doc.lastAutoTable.finalY + lineHeight;
    };

    // Renders a pdf_data_group's fields transposed by instance: all "instance 1" answers together,
    // then all "instance 2" answers, etc., instead of one field's full answer list at a time.
    const renderGroupedFieldSet = (groupIndexes) => {
      const arraysByIndex = groupIndexes.map((idx) => {
        const rawFieldValue = fieldValues[idx];
        return Array.isArray(rawFieldValue) ? rawFieldValue : [rawFieldValue];
      });
      const instanceCount = Math.max(0, ...arraysByIndex.map((arr) => arr.length));
      if (instanceCount === 0) { return; }

      renderSectionHeader(fieldMeta[groupIndexes[0]], fieldMeta[groupIndexes[0]]?.category || 'Other');

      let renderedInstanceCount = 0;
      for (let instanceIdx = 0; instanceIdx < instanceCount; instanceIdx++) {
        // The group's first field identifies whether this instance exists at all (e.g. the
        // medication name) — if it's blank, skip the whole instance, static_table included.
        const primaryValue = `${arraysByIndex[0][instanceIdx] ?? ''}`.trim();
        if (!primaryValue) { continue; }

        if (renderedInstanceCount > 0) {
          addGroupGap();
        }
        renderedInstanceCount++;

        for (let g = 0; g < groupIndexes.length; g++) {
          const idx = groupIndexes[g];
          const groupFieldMeta = fieldMeta[idx];
          // A static_table member has no per-instance value to look up — draw it once per
          // iteration of the group instead of falling through the label/value rendering below.
          if (groupFieldMeta?.value_type === 'static_table' && groupFieldMeta?.table_info) {
            y += lineHeight / 4;
            if (y > pageHeight - margin - lineHeight) { y = addOverflowPage(); }
            drawStaticTable(groupFieldMeta);
            continue;
          }
          const value = `${arraysByIndex[g][instanceIdx] ?? ''}`.trim();
          if (!value) { continue; }
          renderLabelValueRow(`${fieldLabels[idx] || ''} ${instanceIdx + 1}:`, value);
        }
      }
    };

    const renderedGroupKeys = new Set();
    let previousGroupKey = null;
    let previousGroupHadData = false;

    for (let j = 0; j < fieldLabels.length; j++) {
      const meta = fieldMeta[j];
      const label = fieldLabels[j] || '';
      const categoryLabel = meta?.category || 'Other';
      const groupKey = meta?.pdf_data_group || null;

      let groupIndexes = null;
      let groupHasData = false;
      if (groupKey) {
        groupIndexes = groupFieldIndexes[groupKey] || [j];
        groupHasData = groupIndexes.some((idx) => {
          const rawValue = fieldValues[idx];
          const arr = Array.isArray(rawValue) ? rawValue : [rawValue];
          return arr.some((v) => `${v ?? ''}`.trim() !== '');
        });
      }

      // Give a data-bearing pdf_data_group set breathing room, whether entering or leaving one.
      // A set with no data at all doesn't render anything, so it shouldn't leave a stray blank line.
      if (groupKey !== previousGroupKey) {
        if ((groupKey && groupHasData) || (previousGroupKey && previousGroupHadData)) {
          addGroupGap();
        }
        previousGroupKey = groupKey;
        previousGroupHadData = groupHasData;
      }

      if (groupKey) {
        if (renderedGroupKeys.has(groupKey)) { continue; }

        // Base the grouping decision on the largest instance count in the set (not just the
        // first field) so a single-entry case never triggers grouping/numbering unnecessarily.
        const groupInstanceCount = Math.max(0, ...groupIndexes.map((idx) => {
          const rawValue = fieldValues[idx];
          if (Array.isArray(rawValue)) { return rawValue.length; }
          return ((rawValue === undefined) || (rawValue === null) || (rawValue === '')) ? 0 : 1;
        }));
        if (groupInstanceCount > 1) {
          renderGroupedFieldSet(groupIndexes);
          renderedGroupKeys.add(groupKey);
          continue;
        }
        // Only one instance present — fall through to normal per-field rendering below.

        // A blank/nullish first field means this group instance doesn't exist at all — suppress
        // every field in the group (not just the ones that happen to also be blank).
        const rawPrimaryValue = fieldValues[groupIndexes[0]];
        const primaryValue = `${(Array.isArray(rawPrimaryValue) ? rawPrimaryValue[0] : rawPrimaryValue) ?? ''}`.trim();
        if (!primaryValue) { continue; }
      }


      if (meta?.value_type === 'notes') {
        // ── Notes block ──
        const rawNotes = Array.isArray(fieldValues[j]) ? fieldValues[j] : [];
        const promptFilters = (meta.filters || []).filter(f => f.source === 'prompt');
        const filteredNotes = evaluateNoteFilters(rawNotes, promptFilters, resolvedPromptValues);
        if (filteredNotes.length === 0) { continue; }

        renderSectionHeader(meta, categoryLabel);

        if (y > pageHeight - margin - lineHeight * 3) { y = addOverflowPage(); }
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(label ? `${label}:` : 'Notes:', margin, y);
        y += lineHeight;

        for (let n = 0; n < filteredNotes.length; n++) {
          const note = filteredNotes[n];
          if (y > pageHeight - margin - lineHeight * 4) { y = addOverflowPage(); }

          // Name line (bold; urgent in red)
          doc.setFontSize(9);
          doc.setFont('Helvetica', 'bold');
          if (note.urgent) {
            doc.setTextColor(180, 0, 0);
            const urgentTag = '[URGENT] ';
            doc.text(urgentTag, margin + 8, y);
            const urgentWidth = doc.getTextWidth(urgentTag);
            doc.setTextColor(0, 0, 0);
            doc.text(`${note.name || ''}`, margin + 8 + urgentWidth, y);
          } else {
            doc.text(`${note.name || ''}`, margin + 8, y);
          }
          doc.setTextColor(0, 0, 0);
          y += lineHeight - 2;

          // Note text (normal, wrapped)
          if (note.noteText) {
            doc.setFont('Helvetica', 'normal');
            const noteLines = doc.splitTextToSize(note.noteText, contentWidth - 16);
            for (const noteLine of noteLines) {
              if (y > pageHeight - margin - lineHeight) { y = addOverflowPage(); }
              doc.text(noteLine, margin + 8, y);
              y += lineHeight - 2;
            }
          }

          // Category + Byline (small, gray)
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(130, 130, 130);
          if (note.category) {
            if (y > pageHeight - margin - lineHeight) { y = addOverflowPage(); }
            doc.text(note.category, margin + 8, y);
            y += lineHeight - 2;
          }
          const byline = [note.user_name, (() => {
            const raw = note.last_update;
            if (!raw) { return `1/1/${new Date().getFullYear()}`; }
            const d = new Date(raw);
            return isNaN(d.getTime()) ? `1/1/${new Date().getFullYear()}` : d.toLocaleDateString();
          })()].filter(Boolean).join(' · ');
          if (byline) {
            if (y > pageHeight - margin - lineHeight) { y = addOverflowPage(); }
            doc.text(byline, margin + 8, y);
            y += lineHeight - 2;
          }
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(9);

          // Thin divider between notes (not after the last one)
          if (n < filteredNotes.length - 1) {
            if (y > pageHeight - margin - 6) { y = addOverflowPage(); }
            doc.setLineWidth(0.25);
            doc.setDrawColor(210, 210, 210);
            doc.line(margin + 8, y, pageWidth - margin, y);
            doc.setDrawColor(0, 0, 0);
            y += 20;
          }
        }
        y += 4;

      } else if (meta?.value_type === 'image') {
        const rawValue = `${fieldValues[j] ?? ''}`.trim();
        if (!rawValue) { continue; }

        // Preserve compatibility with semicolon- or line-break-joined arrays while supporting single URL values.
        const imageUrls = rawValue
          .split(/[;\n]+/)
          .map((candidate) => candidate.trim())
          .filter(Boolean);
        if (imageUrls.length === 0) { continue; }

        renderSectionHeader(meta, categoryLabel);

        if (y > pageHeight - margin - lineHeight * 3) {
          y = addOverflowPage();
        }

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`${label}:`, margin, y);
        y += lineHeight;

        for (const imageUrl of imageUrls) {
          const base64 = await loadImageAsBase64(imageUrl);
          if (!base64) {
            if (y > pageHeight - margin - lineHeight) {
              y = addOverflowPage();
            }
            doc.setFont('Helvetica', 'italic');
            doc.setFontSize(9);
            doc.text('[image unavailable]', margin + 8, y);
            y += lineHeight;
            continue;
          }

          const maxImageWidth = contentWidth;
          const maxImageHeight = 180;
          let drawWidth = maxImageWidth;
          let drawHeight = maxImageHeight;

          try {
            const imageProps = doc.getImageProperties(base64);
            const widthRatio = maxImageWidth / imageProps.width;
            const heightRatio = maxImageHeight / imageProps.height;
            const scale = Math.min(widthRatio, heightRatio);
            drawWidth = imageProps.width * scale;
            drawHeight = imageProps.height * scale;
          } catch {
            // Keep conservative defaults if metadata isn't available.
          }

          if (y + drawHeight > pageHeight - margin) {
            y = addOverflowPage();
          }

          const imageX = margin + ((contentWidth - drawWidth) / 2);
          try {
            doc.addImage(base64, 'JPEG', imageX, y, drawWidth, drawHeight);
          }
          catch {
            try {
              doc.addImage(base64, 'PNG', imageX, y, drawWidth, drawHeight);
            }
            catch {
              doc.setFont('Helvetica', 'italic');
              doc.setFontSize(9);
              doc.text('[image unavailable]', margin + 8, y);
              y += lineHeight;
              continue;
            }
          }

          y += drawHeight + 10;
        }
        y += 4;

      } else if (meta?.value_type === 'static_table' && meta?.table_info) {
        // ── Static/blank fill-in table (e.g. printable log sheet) ──
        renderSectionHeader(meta, categoryLabel);
        y += lineHeight / 4; // blank line before the table, per spec
        if (y > pageHeight - margin - lineHeight) { y = addOverflowPage(); }
        drawStaticTable(meta);

      } else {
        // ── Standard "Label: value" row ──
        const value = `${fieldValues[j] ?? ''}`.trim();
        if (!value) { continue; }

        renderSectionHeader(meta, categoryLabel);
        renderLabelValueRow(`${label}:`, value);
      }
    }
  }

  doc.save(fileName);
}


async function getExportFieldDefinitionsByKey({ clientId, selectedFieldKeys = [] }) {
  const normalizedKeys = [...new Set([selectedFieldKeys]
    .flat()
    .filter((fieldKey) => (typeof fieldKey === 'string') && (fieldKey.trim() !== '')))]
    .map((fieldKey) => fieldKey.trim());

  if (!clientId || normalizedKeys.length === 0) {
    return [];
  }

  const dictionaryRec = await dbClient
    .query({
      KeyConditionExpression: 'client_id = :c',
      TableName: 'DataDictionaryV3',
      ExpressionAttributeValues: {
        ':c': clientId
      }
    })
    .promise()
    .catch((error) => {
      cl({ 'Error reading DataDictionaryV3 for predefined export': error });
    });

  const dictionaryItems = recordExists(dictionaryRec) ? (dictionaryRec.Items || []) : [];
  const dictionaryByKey = dictionaryItems.reduce((acc, fieldRec) => {
    if (fieldRec?.field_key) {
      acc[fieldRec.field_key] = fieldRec;
    }
    return acc;
  }, {});

  return normalizedKeys.map((fieldKey) => {
    const dictionaryFieldRec = dictionaryByKey[fieldKey] || {};
    return {
      field_key: fieldKey,
      description: dictionaryFieldRec.description || fieldKey,
      category: dictionaryFieldRec.category || 'Other',
      value_type: dictionaryFieldRec.type || null
    };
  });
}

export async function downloadPeopleListWithPreselectedFields({
  clientId,
  baseHeader = [],
  baseRows = [],
  personIds = [],
  personIdColumnIndex = 0,
  selectedFieldKeys = [],
  downloadType = 'csv',
  fileBaseName = 'people_list',
  onProgress = null
}) {
  const normalizedRows = Array.isArray(baseRows) ? baseRows.map((row) => [row].flat()) : [];
  const normalizedBaseHeader = [baseHeader].flat().filter((headerValue) => (headerValue !== null) && (headerValue !== undefined));
  const normalizedSelectedFieldKeys = [...new Set([selectedFieldKeys]
    .flat()
    .filter((fieldKey) => (typeof fieldKey === 'string') && (fieldKey.trim() !== '')))]
    .map((fieldKey) => fieldKey.trim());

  const normalizedPersonIds = ([personIds].flat())
    .filter((personId) => (typeof personId === 'string') && (personId.trim() !== ''));

  const resolvedPersonIds = (normalizedPersonIds.length > 0)
    ? normalizedPersonIds
    : normalizedRows.map((row) => {
      return `${row?.[personIdColumnIndex] || ''}`.trim();
    });

  let header = [...normalizedBaseHeader];
  let rows = normalizedRows.map((row) => [...row]);
  const normalizedDownloadType = `${downloadType || 'csv'}`.trim().toLowerCase();
  const selectedArraySeparator = (normalizedDownloadType === 'xlsx' || normalizedDownloadType === 'xls') ? '\n' : '; ';

  if (normalizedSelectedFieldKeys.length > 0) {
    const selectedFieldDefinitions = await getExportFieldDefinitionsByKey({
      clientId,
      selectedFieldKeys: normalizedSelectedFieldKeys
    });

    header = [...header, ...selectedFieldDefinitions.map((fieldRec) => fieldRec.description)];

    const resolvedByPersonId = await resolveSelectedFieldValuesForPeople({
      clientId,
      personIds: resolvedPersonIds,
      selectedFieldKeys: normalizedSelectedFieldKeys,
      arraySeparator: selectedArraySeparator,
      onProgress
    });

    rows = rows.map((row, rowIndex) => {
      const personId = resolvedPersonIds[rowIndex] || '';
      const selectedFieldValues = resolvedByPersonId[personId] || normalizedSelectedFieldKeys.map(() => '');
      return [...row, ...selectedFieldValues];
    });
  }

  const safeBaseName = sanitizeExportBaseName(fileBaseName, 'people_list');

  if (normalizedDownloadType === 'csv') {
    downloadRowsAsCsv({
      header,
      rows,
      fileName: `${safeBaseName}.csv`
    });
  }
  else {
    const fileExtension = (normalizedDownloadType === 'xls') ? 'xls' : 'xlsx';
    downloadRowsAsXlsx({
      header,
      rows,
      fileName: `${safeBaseName}.${fileExtension}`
    });
  }

  return {
    header,
    rows
  };
}

export async function listSavedReports({ clientId, exportScope }) {
  if (!clientId || !exportScope) {
    return [];
  }

  const result = await dbClient
    .query({
      TableName: 'ReportDefinitions',
      KeyConditionExpression: 'client_id = :c',
      FilterExpression: 'export_scope = :s',
      ExpressionAttributeValues: {
        ':c': clientId,
        ':s': exportScope
      }
    })
    .promise()
    .catch((error) => {
      cl({ 'Error listing ReportDefinitions': error });
    });

  if (!recordExists(result)) {
    return [];
  }

  return result.Items
    .map((item) => ({
      report_id: item.report_id,
      report_name: item.report_name,
      selected_fields: Array.isArray(item.selected_fields) ? item.selected_fields : []
    }))
    .sort((a, b) => (a.report_name || '').localeCompare(b.report_name || ''));
}

export async function saveReport({ clientId, exportScope, reportId, reportName, selectedFieldNames = [] }) {
  if (!clientId || !exportScope || !reportId || !reportName) {
    return;
  }

  await dbClient
    .put({
      TableName: 'ReportDefinitions',
      Item: {
        client_id: clientId,
        report_id: reportId,
        report_name: reportName,
        export_scope: exportScope,
        selected_fields: [...selectedFieldNames],
        updated_at: new Date().toISOString()
      }
    })
    .promise()
    .catch((error) => {
      cl({ 'Error saving ReportDefinitions': error });
    });
}
