import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

import { dbClient, recordExists, deepCopy, resolveData, cl } from './AVAUtilities';
import { getImage } from './AVAPeople';

export function formatExportValue(value) {
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
    return value.join('; ');
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
      return formatExportValue(resolvedField?.formatted);
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

export function downloadRowsAsXlsx({ header = [], rows = [], fileName = 'export.xlsx' }) {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);

  const maxColumnWidth = 60;
  worksheet['!cols'] = header.map((headerLabel, columnIndex) => {
    const maxValueLength = rows.reduce((longest, row) => {
      const value = row[columnIndex];
      const length = `${value ?? ''}`.length;
      return Math.max(longest, length);
    }, `${headerLabel ?? ''}`.length);

    return {
      wch: Math.min(Math.max(maxValueLength + 2, 10), maxColumnWidth)
    };
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, 'People List');
  XLSX.writeFile(workbook, fileName);
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

  for (let i = 0; i < rows.length; i++) {
    if (i > 0) { doc.addPage(); }

    const row = rows[i];
    const personId = `${row[personIdColIndex] || ''}`;
    const personName = `${row[personNameColIndex] || ''}`;
    const fieldValues = row.slice(identityColCount);

    let y = margin;

    // Photo — centered, square
    const photoUrl = getImage(personId);
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

    // Field rows
    doc.setFontSize(10);
    for (let j = 0; j < fieldLabels.length; j++) {
      const meta = fieldMeta[j];
      const label = fieldLabels[j] || '';

      if (meta?.value_type === 'notes') {
        // ── Notes block ──
        const rawNotes = Array.isArray(fieldValues[j]) ? fieldValues[j] : [];
        const promptFilters = (meta.filters || []).filter(f => f.source === 'prompt');
        const filteredNotes = evaluateNoteFilters(rawNotes, promptFilters, resolvedPromptValues);
        if (filteredNotes.length === 0) { continue; }

        if (y > pageHeight - margin - lineHeight * 3) { doc.addPage(); y = margin; }
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(label ? `${label}:` : 'Notes:', margin, y);
        y += lineHeight;

        for (let n = 0; n < filteredNotes.length; n++) {
          const note = filteredNotes[n];
          if (y > pageHeight - margin - lineHeight * 4) { doc.addPage(); y = margin; }

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
              if (y > pageHeight - margin - lineHeight) { doc.addPage(); y = margin; }
              doc.text(noteLine, margin + 8, y);
              y += lineHeight - 2;
            }
          }

          // Category + Byline (small, gray)
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(130, 130, 130);
          if (note.category) {
            if (y > pageHeight - margin - lineHeight) { doc.addPage(); y = margin; }
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
            if (y > pageHeight - margin - lineHeight) { doc.addPage(); y = margin; }
            doc.text(byline, margin + 8, y);
            y += lineHeight - 2;
          }
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(9);

          // Thin divider between notes (not after the last one)
          if (n < filteredNotes.length - 1) {
            if (y > pageHeight - margin - 6) { doc.addPage(); y = margin; }
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

        // Preserve compatibility with semicolon-joined arrays while supporting single URL values.
        const imageUrls = rawValue
          .split(';')
          .map((candidate) => candidate.trim())
          .filter(Boolean);
        if (imageUrls.length === 0) { continue; }

        if (y > pageHeight - margin - lineHeight * 3) {
          doc.addPage();
          y = margin;
        }

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(`${label}:`, margin, y);
        y += lineHeight;

        for (const imageUrl of imageUrls) {
          const base64 = await loadImageAsBase64(imageUrl);
          if (!base64) {
            if (y > pageHeight - margin - lineHeight) {
              doc.addPage();
              y = margin;
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
            doc.addPage();
            y = margin;
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

      } else {
        // ── Standard "Label: value" row ──
        const value = `${fieldValues[j] ?? ''}`.trim();
        if (!value) { continue; }

        if (y > pageHeight - margin - lineHeight) {
          doc.addPage();
          y = margin;
        }

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        const labelText = `${label}: `;
        doc.text(labelText, margin, y);
        const labelWidth = doc.getTextWidth(labelText);

        doc.setFont('Helvetica', 'normal');
        const valueLines = doc.splitTextToSize(value, contentWidth - labelWidth);
        doc.text(valueLines[0], margin + labelWidth, y);
        y += lineHeight;

        for (let k = 1; k < valueLines.length; k++) {
          if (y > pageHeight - margin - lineHeight) {
            doc.addPage();
            y = margin;
          }
          doc.text(valueLines[k], margin + labelWidth, y);
          y += lineHeight;
        }
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
      onProgress
    });

    rows = rows.map((row, rowIndex) => {
      const personId = resolvedPersonIds[rowIndex] || '';
      const selectedFieldValues = resolvedByPersonId[personId] || normalizedSelectedFieldKeys.map(() => '');
      return [...row, ...selectedFieldValues];
    });
  }

  const normalizedDownloadType = `${downloadType || 'csv'}`.trim().toLowerCase();
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
