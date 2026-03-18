import * as XLSX from 'xlsx';

import { dbClient, recordExists, deepCopy, resolveData, cl } from './AVAUtilities';

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

export async function getExportFieldPickerData({ sessionId, clientId, exportScope, logLabel = 'export' }) {
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
      .filter((fieldRec) => !!fieldRec?.field_key)
      .map((fieldRec) => ({
        field_key: fieldRec.field_key,
        description: fieldRec.description || fieldRec.field_key,
        category: fieldRec.category || 'Other',
        value_type: fieldRec?.type,
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
