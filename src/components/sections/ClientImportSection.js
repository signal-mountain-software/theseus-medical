import React from 'react';
import {
  Box, Button, Typography, RadioGroup, FormControlLabel, Radio, FormControl, FormLabel,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, LinearProgress
} from '@material-ui/core';
import { Alert, AlertTitle } from '@material-ui/lab';
import { dbClient, putDb, isEmpty, titleCase, cl } from '../../util/AVAUtilities';
import { addMember } from '../../util/AVAGroups';
import { AVATextStyle } from '../../util/AVAStyles';

const XLSX = require('xlsx');

const IMPORT_TYPES = [
  {
    value: 'create_people',
    label: 'Create new accounts',
    description: 'Columns: First Name, Last Name (and optional email, cell phone). Creates People, SessionsV2, and PeopleAccounts records.'
  },
  {
    value: 'append_groups',
    label: 'Add people to groups',
    description: 'Columns: user_id, then one or more group IDs. Appends listed groups to each person without removing existing groups.'
  },
  {
    value: 'update_contact',
    label: 'Update contact information',
    description: 'Columns: user_id, then any of: cell phone, home phone, work phone, e-Mail, alt e-Mail. Updates People and PeopleAccounts records.'
  },
  {
    value: 'dd_import',
    label: 'Add Data to People records via Data Dictionary',
    description: 'Columns: user_id, then one or more Data Dictionary field_key column headers. Stores values directly in the People record at each field\'s defined path.'
  },
  {
    value: 'family_groups',
    label: 'Add Family Groups',
    description: 'Columns: primary_id (column A), then one or more user_ids. Always creates a new FamilyGroups record and updates each listed person\'s People record with the family link.'
  },
  {
    value: 'merge_accounts',
    label: 'Merge Account Data',
    description: 'Columns: user_id_A (column A), user_id_B (column B). Merges groups, contact info, and address from both records into both records. Conflicting contact fields are preserved as an "alt" sibling. Address conflicts are resolved by keeping column A data.'
  }
];

// ─── helpers ─────────────────────────────────────────────────────────────────

const toStoragePhone = (phoneValue) => {
  if (!phoneValue) return '';
  const digits = String(phoneValue).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 0) return `+${digits}`;
  return '';
};

// Set a value at a dotted path inside obj, stripping a leading 'person'/'peoplerec' prefix segment.
const setAtPath = (obj, rawPath, value) => {
  if (!rawPath) return;
  const keys = String(rawPath).split('.');
  let start = 0;
  const first = (keys[0] || '').toLowerCase();
  if (first === 'person' || first === 'peoplerec' || first === 'people') {
    start = 1;
  }
  const effectiveKeys = keys.slice(start);
  if (effectiveKeys.length === 0) return;
  let current = obj;
  for (let i = 0; i < effectiveKeys.length - 1; i++) {
    if (!current[effectiveKeys[i]]) current[effectiveKeys[i]] = {};
    current = current[effectiveKeys[i]];
  }
  current[effectiveKeys[effectiveKeys.length - 1]] = value;
};

// Guess the import type from the column headers.
const detectImportType = (headers) => {
  if (!headers || headers.length === 0) return '';
  const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());
  const hasFirstLast = lowerHeaders.some(h => h.includes('first')) && lowerHeaders.some(h => h.includes('last'));
  const hasUserId = lowerHeaders[0].includes('user') || lowerHeaders[0].includes('person') || lowerHeaders[0].includes('id');
  const hasContactKeyword = lowerHeaders.some(h =>
    h.includes('phone') || h.includes('cell') || h.includes('home') || h.includes('work') || h.includes('email') || h.includes('mail')
  );
  const hasPrimaryId = lowerHeaders[0].includes('primary');
  const isMergePair = lowerHeaders[0].endsWith('_a') && lowerHeaders.length > 1 && lowerHeaders[1].endsWith('_b');
  if (hasFirstLast && !hasUserId) return 'create_people';
  if (hasPrimaryId) return 'family_groups';
  if (hasUserId && hasContactKeyword) return 'update_contact';
  if (isMergePair) return 'merge_accounts';
  if (hasUserId) return 'append_groups';
  return '';
};

// Map a Type 3 column header to a contact_info path and PeopleAccounts account_type.
const contactHeaderToPath = (header) => {
  const h = String(header).toLowerCase().trim();
  if (h.includes('alt') && (h.includes('email') || h.includes('mail'))) {
    return { path: 'contact_info.alt_email.address', accountType: 'eMail', messagingKey: null };
  }
  if (h.includes('email') || h.includes('mail') || h.includes('e-mail')) {
    return { path: 'contact_info.email.address', accountType: 'eMail', messagingKey: 'email' };
  }
  if (h.includes('cell') || h.includes('mobile')) {
    return { path: 'contact_info.cell.number', accountType: 'phone_number', messagingKey: 'sms', isPhone: true };
  }
  if (h.includes('home') || h.includes('landline')) {
    return { path: 'contact_info.landline.number', accountType: 'phone_number', messagingKey: null, isPhone: true };
  }
  if (h.includes('work')) {
    return { path: 'contact_info.work.number', accountType: 'phone_number', messagingKey: null, isPhone: true };
  }
  return null;
};

// ─── component ───────────────────────────────────────────────────────────────

export default ({ reactData }) => {
  const fileInputRef = React.useRef(null);

  const [importState, setImportState] = React.useState({
    importType: '',
    detectedType: '',
    headers: [],
    rows: [],
    fileName: '',
    running: false,
    progressCurrent: 0,
    progressTotal: 0,
    results: null,   // { successes: number, errors: [{rowNum, message}], warnings: string[] }
  });

  const patchState = (updates) => setImportState(prev => Object.assign({}, prev, updates));

  const client_id = reactData.client_id;

  // ── file parsing ─────────────────────────────────────────────────────────

  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
        if (!allRows || allRows.length < 2) {
          patchState({ fileName: file.name, headers: [], rows: [], results: { successes: 0, errors: [{ rowNum: 0, message: 'File has no data rows.' }], warnings: [] } });
          return;
        }
        const headers = allRows[0].map(h => String(h).trim());
        const dataRows = allRows.slice(1).filter(row => row.some(cell => String(cell).trim() !== ''));
        const detected = detectImportType(headers);
        patchState({
          fileName: file.name,
          headers,
          rows: dataRows,
          detectedType: detected,
          importType: importState.importType || detected || '',
          results: null,
        });
      } catch (err) {
        cl({ 'ClientImportSection file parse error': err });
        patchState({ fileName: file.name, headers: [], rows: [], results: { successes: 0, errors: [{ rowNum: 0, message: `Could not read file: ${err.message}` }], warnings: [] } });
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so the same file can be re-selected if needed
    event.target.value = '';
  };

  // ── import processors ─────────────────────────────────────────────────────

  const processCreatePeople = async (headers, rows) => {
    const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());
    const firstIdx = lowerHeaders.findIndex(h => h.includes('first'));
    const lastIdx = lowerHeaders.findIndex(h => h.includes('last'));
    const emailIdx = lowerHeaders.findIndex(h => (h.includes('email') || h.includes('mail')) && !h.includes('alt'));
    const cellIdx = lowerHeaders.findIndex(h => h.includes('cell') || h.includes('mobile') || (h.includes('phone') && !h.includes('home') && !h.includes('work')));

    if (firstIdx === -1 || lastIdx === -1) {
      return { successes: 0, errors: [{ rowNum: 0, message: 'Could not find "First Name" and "Last Name" columns.' }], warnings: [] };
    }

    // Load client style once for user_id format
    let clientSuffix = null;
    let useNameOnly = false;
    const clientStyleRec = await dbClient
      .get({ Key: { client_id, custom_key: 'client_style' }, TableName: 'Customizations' })
      .promise()
      .catch(() => null);
    if (clientStyleRec?.Item?.customization_value?.client_suffix) {
      const rawSuffix = clientStyleRec.Item.customization_value.client_suffix;
      useNameOnly = (rawSuffix === '*none');
      clientSuffix = useNameOnly ? null : rawSuffix;
    }

    const successes = [];
    const errors = [];
    const warnings = [];
    const usedIds = new Set(); // track IDs generated in this batch
    const assignedIds = new Array(rows.length).fill('');

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // 1-based, +1 for header row
      const row = rows[i];
      const firstName = titleCase(String(row[firstIdx] || '').trim());
      const lastName = titleCase(String(row[lastIdx] || '').trim());
      if (!firstName || !lastName) {
        errors.push({ rowNum, message: `Row ${rowNum}: missing first or last name — skipped.` });
        continue;
      }
      const email = emailIdx >= 0 ? String(row[emailIdx] || '').trim().toLowerCase() : '';
      const cell = cellIdx >= 0 ? toStoragePhone(String(row[cellIdx] || '').trim()) : '';

      const firstInitial = firstName.charAt(0).toLowerCase();
      const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');

      // Generate unique user_id
      let counter = '';
      let attempts = 0;
      let user_id = '';
      let alreadyExists = false;
      while (attempts < 100) {
        let candidate;
        if (useNameOnly) {
          candidate = `${firstInitial}${cleanLast}${counter}`.toLowerCase();
        } else if (clientSuffix) {
          candidate = `${firstInitial}${cleanLast}${counter}-${clientSuffix}`.toLowerCase();
        } else {
          candidate = `${firstInitial}${cleanLast}${counter}-${client_id}`.toLowerCase();
        }
        if (!usedIds.has(candidate)) {
          // Check People table
          const existing = await dbClient
            .get({ Key: { person_id: candidate }, TableName: 'People' })
            .promise()
            .catch(() => null);
          if (!existing?.Item) {
            user_id = candidate;
            break;
          }
          // Exact name match on collision → treat as duplicate, skip creation
          const existFirst = titleCase(String(existing.Item.name?.first || '').trim());
          const existLast = titleCase(String(existing.Item.name?.last || '').trim());
          if (existFirst === firstName && existLast === lastName) {
            user_id = candidate;
            alreadyExists = true;
            break;
          }
        }
        counter = counter === '' ? 2 : Number(counter) + 1;
        attempts++;
      }
      if (!user_id) {
        errors.push({ rowNum, message: `Row ${rowNum}: could not generate unique user_id for ${firstName} ${lastName} — skipped.` });
        continue;
      }
      if (alreadyExists) {
        warnings.push(`Row ${rowNum} (${firstName} ${lastName}): exact match already exists as "${user_id}" — skipped.`);
        assignedIds[i] = user_id;
        continue;
      }
      usedIds.add(user_id);

      // Build People record
      const contact_info = {};
      const messaging = {};
      if (email) { contact_info.email = { address: email }; messaging.email = email; }
      if (cell) { contact_info.cell = { number: cell }; messaging.sms = cell; }

      const preferred_method = email ? 'email' : (cell ? 'sms' : 'AVA');
      const preferred_methods = preferred_method === 'AVA' ? ['AVA'] : [preferred_method];

      const searchWords = [firstName, lastName, firstName.toLowerCase(), lastName.toLowerCase()];
      if (cell) searchWords.push(cell.slice(-10));
      if (email) searchWords.push(email);

      const peopleRecord = {
        person_id: user_id,
        user_id,
        client_id,
        name: { first: firstName, last: lastName },
        display_name: `${firstName} ${lastName}`,
        groups: ['__TOP__', 'ALL'],
        preferred_method,
        preferred_methods,
        contact_info,
        messaging,
        search_data: searchWords.join(' '),
        created_on: new Date().toISOString(),
        last_update: new Date().toISOString(),
      };

      const sessionRecord = {
        session_id: user_id,
        client_id,
        last_login: null,
        method: 'Import',
        patient_display_name: `${firstName} ${lastName}`,
        patient_id: user_id,
        person_id: user_id,
        requirePassword: false,
        storePassword: true,
        subscription_status: 'na',
        user_display_name: `${firstName} ${lastName}`,
        user_homeClient: client_id,
        user_id,
        last_update: new Date().toISOString(),
      };

      // Build PeopleAccounts entries
      const accountEntries = [
        { field: (`${firstName} ${lastName} ${client_id}`).toLowerCase(), type: 'name' },
      ];
      if (email) accountEntries.push({ field: email, type: 'eMail' });
      if (cell) accountEntries.push({ field: cell.slice(-10), type: 'phone_number' });

      try {
        await putDb({ TableName: 'People', Item: peopleRecord });
        await putDb({ TableName: 'SessionsV2', Item: sessionRecord });
        await addMember(user_id, client_id, ['__TOP__', 'ALL'], { allowParent: true });
        const putRequests = accountEntries
          .filter(a => !isEmpty(a.field))
          .map(a => ({ PutRequest: { Item: { person_id: user_id, identifier: a.field, account_type: a.type } } }));
        if (putRequests.length > 0) {
          await dbClient.batchWrite({ RequestItems: { PeopleAccounts: putRequests } }).promise()
            .catch(err => cl({ 'PeopleAccounts batchWrite error': err }));
        }
        successes.push(user_id);
        assignedIds[i] = user_id;
      } catch (err) {
        cl({ 'Create people row error': { rowNum, err } });
        errors.push({ rowNum, message: `Row ${rowNum} (${firstName} ${lastName}): ${err.message}` });
      }
    }
    return { successes: successes.length, errors, warnings, assignedIds };
  };

  const processAppendGroups = async (headers, rows) => {
    const errors = [];
    const warnings = [];
    let successes = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const person_id = String(row[0] || '').trim();
      if (!person_id) {
        errors.push({ rowNum, message: `Row ${rowNum}: missing user_id — skipped.` });
        continue;
      }
      const newGroups = row.slice(1)
        .map(g => String(g || '').trim())
        .filter(g => g !== '');
      if (newGroups.length === 0) {
        warnings.push(`Row ${rowNum} (${person_id}): no group IDs found — skipped.`);
        continue;
      }
      try {
        const existing = await dbClient.get({ Key: { person_id }, TableName: 'People' }).promise().catch(() => null);
        if (!existing?.Item) {
          errors.push({ rowNum, message: `Row ${rowNum}: person_id "${person_id}" not found — skipped.` });
          continue;
        }
        await addMember(person_id, client_id, newGroups, { allowParent: true });
        successes++;
      } catch (err) {
        cl({ 'Append groups row error': { rowNum, err } });
        errors.push({ rowNum, message: `Row ${rowNum} (${person_id}): ${err.message}` });
      }
    }
    return { successes, errors, warnings };
  };

  const processUpdateContact = async (headers, rows) => {
    const errors = [];
    const warnings = [];
    let successes = 0;

    // Map each column (after index 0) to a contact path descriptor
    const columnMap = headers.slice(1).map(h => contactHeaderToPath(h));

    // Load client communication preference once for the whole import
    let client_preference = 'email';
    const clientStyleRec = await dbClient
      .get({ Key: { client_id, custom_key: 'client_style' }, TableName: 'Customizations' })
      .promise()
      .catch(() => null);
    if (clientStyleRec?.Item?.customization_value?.preferred_communication) {
      client_preference = clientStyleRec.Item.customization_value.preferred_communication;
    }

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const person_id = String(row[0] || '').trim();
      if (!person_id) {
        errors.push({ rowNum, message: `Row ${rowNum}: missing user_id — skipped.` });
        continue;
      }
      try {
        const existing = await dbClient.get({ Key: { person_id }, TableName: 'People' }).promise().catch(() => null);
        if (!existing?.Item) {
          errors.push({ rowNum, message: `Row ${rowNum}: person_id "${person_id}" not found — skipped.` });
          continue;
        }
        const updatedPerson = Object.assign({}, existing.Item);
        const newAccountEntries = [];

        for (let colIdx = 0; colIdx < columnMap.length; colIdx++) {
          const descriptor = columnMap[colIdx];
          if (!descriptor) continue;
          const rawVal = String(row[colIdx + 1] || '').trim();
          if (!rawVal) continue;

          const storedVal = descriptor.isPhone ? toStoragePhone(rawVal) : rawVal.toLowerCase();
          if (!storedVal) continue;

          setAtPath(updatedPerson, descriptor.path, storedVal);
          if (descriptor.messagingKey) {
            if (!updatedPerson.messaging) updatedPerson.messaging = {};
            updatedPerson.messaging[descriptor.messagingKey] = storedVal;
          }
          const identifier = descriptor.isPhone ? storedVal.slice(-10) : storedVal;
          if (identifier) {
            newAccountEntries.push({ field: identifier, type: descriptor.accountType });
          }
        }

        // Recalculate preferred_method and preferred_methods from updated contact info
        const currentEmail = updatedPerson?.messaging?.email || '';
        const currentCell = updatedPerson?.messaging?.sms || '';
        if (client_preference === 'sms' || client_preference === 'text') {
          if (currentCell) {
            updatedPerson.preferred_methods = ['sms'];
            updatedPerson.preferred_method = 'sms';
          } else if (currentEmail) {
            updatedPerson.preferred_methods = ['email'];
            updatedPerson.preferred_method = 'email';
          }
        } else {
          if (currentEmail) {
            updatedPerson.preferred_methods = ['email'];
            updatedPerson.preferred_method = 'email';
          } else if (currentCell) {
            updatedPerson.preferred_methods = ['sms'];
            updatedPerson.preferred_method = 'sms';
          }
        }

        updatedPerson.last_update = new Date().toISOString();
        await putDb({ TableName: 'People', Item: updatedPerson });

        if (newAccountEntries.length > 0) {
          const putRequests = newAccountEntries
            .filter(a => !isEmpty(a.field))
            .map(a => ({ PutRequest: { Item: { person_id, identifier: a.field, account_type: a.type } } }));
          if (putRequests.length > 0) {
            await dbClient.batchWrite({ RequestItems: { PeopleAccounts: putRequests } }).promise()
              .catch(err => cl({ 'PeopleAccounts update contact batchWrite error': err }));
          }
        }
        successes++;
      } catch (err) {
        cl({ 'Update contact row error': { rowNum, err } });
        errors.push({ rowNum, message: `Row ${rowNum} (${person_id}): ${err.message}` });
      }
    }
    return { successes, errors, warnings };
  };

  const processDDImport = async (headers, rows) => {
    const errors = [];
    const warnings = [];
    let successes = 0;

    // Load DD records for all column headers (skip index 0 which is user_id)
    const fieldKeys = headers.slice(1);
    const ddMap = {}; // { [field_key]: { path, found: bool } }

    await Promise.all(fieldKeys.map(async (fieldKey) => {
      if (!fieldKey) return;
      try {
        const rec = await dbClient
          .get({ Key: { client_id, field_key: fieldKey }, TableName: 'DataDictionaryV3' })
          .promise()
          .catch(() => null);
        if (!rec?.Item) {
          warnings.push(`Column "${fieldKey}": no DataDictionaryV3 record found — column will be skipped.`);
          ddMap[fieldKey] = { path: null, found: false };
          return;
        }
        const dictionaryRec = rec.Item;
        // Find the first source candidate that targets the People record
        const multiSources = dictionaryRec.sources || dictionaryRec.source_options || dictionaryRec.source_candidates || dictionaryRec.resolution_sources;
        const candidates = Array.isArray(multiSources) && multiSources.length > 0
          ? multiSources.map(s => Object.assign({}, dictionaryRec, s))
          : [dictionaryRec];

        const personCandidate = candidates.find(c => {
          const src = String(c.source || '').toLowerCase();
          return src === 'person' || src === 'peoplerec' || src === 'people';
        });

        if (!personCandidate || !personCandidate.path) {
          warnings.push(`Column "${fieldKey}": no person-sourced path found in DataDictionaryV3 — column will be skipped.`);
          ddMap[fieldKey] = { path: null, found: false };
        } else {
          const rawPath = Array.isArray(personCandidate.path) ? personCandidate.path[0] : personCandidate.path;
          ddMap[fieldKey] = { path: rawPath, found: true };
        }
      } catch (err) {
        warnings.push(`Column "${fieldKey}": error loading DataDictionaryV3 record — column will be skipped.`);
        ddMap[fieldKey] = { path: null, found: false };
      }
    }));

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const person_id = String(row[0] || '').trim();
      if (!person_id) {
        errors.push({ rowNum, message: `Row ${rowNum}: missing user_id — skipped.` });
        continue;
      }
      try {
        const existing = await dbClient.get({ Key: { person_id }, TableName: 'People' }).promise().catch(() => null);
        if (!existing?.Item) {
          errors.push({ rowNum, message: `Row ${rowNum}: person_id "${person_id}" not found — skipped.` });
          continue;
        }
        const updatedPerson = Object.assign({}, existing.Item);
        let anyChange = false;

        for (let colIdx = 0; colIdx < fieldKeys.length; colIdx++) {
          const fieldKey = fieldKeys[colIdx];
          const info = ddMap[fieldKey];
          if (!info || !info.found || !info.path) continue;
          const rawVal = String(row[colIdx + 1] || '').trim();
          if (!rawVal) continue;
          setAtPath(updatedPerson, info.path, rawVal);
          anyChange = true;
        }

        if (anyChange) {
          updatedPerson.last_update = new Date().toISOString();
          await putDb({ TableName: 'People', Item: updatedPerson });
        }
        successes++;
      } catch (err) {
        cl({ 'DD import row error': { rowNum, err } });
        errors.push({ rowNum, message: `Row ${rowNum} (${person_id}): ${err.message}` });
      }
    }
    return { successes, errors, warnings };
  };

  const processMergeAccounts = async (headers, rows) => {
    const errors = [];
    const warnings = [];
    let successes = 0;

    // Contact field paths that support an "alt" sibling on conflict.
    // Each entry: { path: dotted path to the value, altPath: sibling to write conflict into }
    const CONTACT_MERGE_FIELDS = [
      { path: 'contact_info.cell.number',       altPath: 'contact_info.cell.alt',       messagingKey: 'sms',   isPhone: true  },
      { path: 'contact_info.landline.number',   altPath: 'contact_info.landline.alt',   messagingKey: null,    isPhone: true  },
      { path: 'contact_info.work.number',       altPath: 'contact_info.work.alt',       messagingKey: null,    isPhone: true  },
      { path: 'contact_info.email.address',     altPath: 'contact_info.email.alt',      messagingKey: 'email', isPhone: false },
      { path: 'contact_info.alt_email.address', altPath: 'contact_info.alt_email.alt',  messagingKey: null,    isPhone: false },
    ];

    // Read a value at a dotted path from an object (returns undefined if missing)
    const getAtPath = (obj, path) => {
      return path.split('.').reduce((cur, key) => (cur && cur[key] !== undefined ? cur[key] : undefined), obj);
    };

    // Write a value at a dotted path, creating intermediate objects as needed
    const writeAtPath = (obj, path, value) => {
      const keys = path.split('.');
      let cur = obj;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!cur[keys[i]] || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
        cur = cur[keys[i]];
      }
      cur[keys[keys.length - 1]] = value;
    };

    // Merge groups: union of both arrays, deduplicated
    const mergeGroups = (groupsA, groupsB) => {
      const a = Array.isArray(groupsA) ? groupsA : [];
      const b = Array.isArray(groupsB) ? groupsB : [];
      return [...new Set([...a, ...b])];
    };

    // Merge address: prefer recA's value; skip on conflict (no alt for address)
    const mergeAddress = (recA, recB) => {
      const addrA = recA.address || {};
      const addrB = recB.address || {};
      if (!addrB || Object.keys(addrB).length === 0) return addrA;
      if (!addrA || Object.keys(addrA).length === 0) return addrB;
      // Merge field by field: keep A where both exist, take B where A is empty
      const merged = Object.assign({}, addrB, addrA);
      return merged;
    };

    // Apply contact field merges between recA (primary) and recB (donor).
    // Writes merged values back into both cloned records.
    const mergeContactFields = (clonedA, clonedB) => {
      for (const field of CONTACT_MERGE_FIELDS) {
        const valA = getAtPath(clonedA, field.path);
        const valB = getAtPath(clonedB, field.path);

        if (valA && valB && valA !== valB) {
          // Conflict: keep each record's own value; store the other as alt
          writeAtPath(clonedA, field.altPath, valB);
          writeAtPath(clonedB, field.altPath, valA);
        } else if (!valA && valB) {
          // A is empty — copy B's value into A
          writeAtPath(clonedA, field.path, valB);
          if (field.messagingKey) {
            if (!clonedA.messaging) clonedA.messaging = {};
            clonedA.messaging[field.messagingKey] = valB;
          }
        } else if (valA && !valB) {
          // B is empty — copy A's value into B
          writeAtPath(clonedB, field.path, valA);
          if (field.messagingKey) {
            if (!clonedB.messaging) clonedB.messaging = {};
            clonedB.messaging[field.messagingKey] = valA;
          }
        }
        // else: both empty or identical — nothing to do
      }
    };

    cl({ 'merge_accounts: starting loop': { rowCount: rows.length, rows } });
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const idA = String(row[0] || '').trim();
      const idB = String(row[1] || '').trim();
      cl({ 'merge_accounts row': { rowNum, row, idA, idB } });

      if (!idA || !idB) {
        errors.push({ rowNum, message: `Row ${rowNum}: both user_id columns are required — skipped.` });
        continue;
      }
      if (idA === idB) {
        warnings.push(`Row ${rowNum}: column A and column B are the same user_id ("${idA}") — skipped.`);
        continue;
      }

      try {
        const [recAResult, recBResult] = await Promise.all([
          dbClient.get({ Key: { person_id: idA }, TableName: 'People' }).promise().catch(() => null),
          dbClient.get({ Key: { person_id: idB }, TableName: 'People' }).promise().catch(() => null),
        ]);
        cl({ 'merge_accounts DB lookup': { idA, foundA: !!recAResult?.Item, idB, foundB: !!recBResult?.Item } });

        if (!recAResult?.Item) {
          errors.push({ rowNum, message: `Row ${rowNum}: user_id "${idA}" (column A) not found — skipped.` });
          continue;
        }
        if (!recBResult?.Item) {
          errors.push({ rowNum, message: `Row ${rowNum}: user_id "${idB}" (column B) not found — skipped.` });
          continue;
        }

        const clonedA = JSON.parse(JSON.stringify(recAResult.Item));
        const clonedB = JSON.parse(JSON.stringify(recBResult.Item));

        // ── merge groups ──────────────────────────────────────────────────
        // Run addMember FIRST so it reads the original People records and updates
        // PeopleGroups table. addMember also does a dbClient.update on People.groups,
        // but our putDb below overwrites that with the full merged record, so order matters.
        const mergedGroups = mergeGroups(clonedA.groups, clonedB.groups);
        const addedToA = mergedGroups.filter(g => !(recAResult.Item.groups || []).includes(g));
        const addedToB = mergedGroups.filter(g => !(recBResult.Item.groups || []).includes(g));
        cl({ 'merge_accounts group calc': { idA, idB, groupsA: clonedA.groups, groupsB: clonedB.groups, mergedGroups, addedToA, addedToB } });
        if (addedToA.length > 0) {
          await addMember(idA, client_id, addedToA, { allowParent: true })
            .catch(err => { cl({ 'merge_accounts addMember error for A': { idA, addedToA, err } }); });
        }
        if (addedToB.length > 0) {
          await addMember(idB, client_id, addedToB, { allowParent: true })
            .catch(err => { cl({ 'merge_accounts addMember error for B': { idB, addedToB, err } }); });
        }
        // Set merged groups on clones — putDb below will stamp the final merged groups
        // after addMember has already handled PeopleGroups table updates.
        clonedA.groups = mergedGroups;
        clonedB.groups = mergedGroups;

        // ── merge contact fields ──────────────────────────────────────────
        mergeContactFields(clonedA, clonedB);

        // ── merge address (A wins on conflict) ────────────────────────────
        const mergedAddress = mergeAddress(clonedA, clonedB);
        if (mergedAddress && Object.keys(mergedAddress).length > 0) {
          clonedA.address = mergedAddress;
          clonedB.address = mergedAddress;
        }

        // ── write back both records ───────────────────────────────────────
        // putDb runs last so it stamps the fully merged record (groups + contact + address),
        // overwriting any intermediate state left by addMember's update.
        const ts = new Date().toISOString();
        clonedA.last_update = ts;
        clonedB.last_update = ts;

        await Promise.all([
          putDb({ TableName: 'People', Item: clonedA }),
          putDb({ TableName: 'People', Item: clonedB }),
        ]);

        successes++;
      } catch (err) {
        cl({ 'Merge accounts row error': { rowNum, err } });
        errors.push({ rowNum, message: `Row ${rowNum} (${idA} / ${idB}): ${err.message}` });
      }
    }
    return { successes, errors, warnings };
  };

  const processFamilyGroups = async (headers, rows) => {
    const errors = [];
    const warnings = [];
    let successes = 0;

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const primary_id = String(row[0] || '').trim();
      if (!primary_id) {
        errors.push({ rowNum, message: `Row ${rowNum}: missing primary_id — skipped.` });
        continue;
      }

      const memberIds = row.slice(1)
        .map(v => String(v || '').trim())
        .filter(v => v !== '');

      // Look up primary contact
      const primaryRec = await dbClient
        .get({ Key: { person_id: primary_id }, TableName: 'People' })
        .promise()
        .catch(() => null);

      if (!primaryRec?.Item) {
        errors.push({ rowNum, message: `Row ${rowNum}: primary_id "${primary_id}" not found in People — skipped.` });
        continue;
      }

      const primaryItem = primaryRec.Item;
      const primaryName = [primaryItem.name?.first, primaryItem.name?.last].filter(Boolean).join(' ')
        || primaryItem.display_name
        || primary_id;
      const primaryLastName = primaryItem.name?.last || '';

      // Look up other members
      const otherMembers = [];
      for (const uid of memberIds) {
        const memberRec = await dbClient
          .get({ Key: { person_id: uid }, TableName: 'People' })
          .promise()
          .catch(() => null);
        if (!memberRec?.Item) {
          warnings.push(`Row ${rowNum}: user_id "${uid}" not found in People — added to family record with id only.`);
          otherMembers.push({ id: uid, name: uid, role: 'view' });
        } else {
          const memberName = [memberRec.Item.name?.first, memberRec.Item.name?.last].filter(Boolean).join(' ')
            || memberRec.Item.display_name
            || uid;
          otherMembers.push({ id: uid, name: memberName, role: 'view' });
        }
      }

      const family_id = `family_${new Date().getTime()}_${rowNum}`;
      const family_name = primaryLastName
        ? `The ${primaryLastName} Family`
        : `Family (${primary_id})`;

      const familyRecord = {
        client_id,
        composite_key: family_id,
        family_id,
        family_name,
        primary_contact: { id: primary_id, name: primaryName },
        other_members: otherMembers,
      };

      try {
        await putDb({ TableName: 'FamilyGroups', Item: familyRecord });

        // Update People records for primary and all members with the family_id
        const allIds = [primary_id, ...memberIds];
        for (const uid of allIds) {
          const personRec = await dbClient
            .get({ Key: { person_id: uid }, TableName: 'People' })
            .promise()
            .catch(() => null);
          if (personRec?.Item) {
            const existingFamilyGroups = Array.isArray(personRec.Item.family_groups) ? personRec.Item.family_groups : [];
            const updated = Object.assign({}, personRec.Item, {
              family_id,
              family_groups: existingFamilyGroups.includes(family_id) ? existingFamilyGroups : [...existingFamilyGroups, family_id],
              last_update: new Date().toISOString(),
            });
            await putDb({ TableName: 'People', Item: updated });
          }
        }
        successes++;
      } catch (err) {
        cl({ 'Family groups row error': { rowNum, err } });
        errors.push({ rowNum, message: `Row ${rowNum} (${primary_id}): ${err.message}` });
      }
    }
    return { successes, errors, warnings };
  };

  // ── download updated spreadsheet ─────────────────────────────────────────

  const downloadWithUserIds = () => {
    const { headers, rows, results, fileName } = importState;
    const assignedIds = results?.assignedIds || [];
    const outputHeaders = [...headers, 'Assigned User ID'];
    const outputRows = rows.map((row, i) => [...row, assignedIds[i] || '']);
    const ws = XLSX.utils.aoa_to_sheet([outputHeaders, ...outputRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Import Results');
    const outName = (fileName || 'import').replace(/\.[^/.]+$/, '') + '_with_ids.xlsx';
    XLSX.writeFile(wb, outName);
  };

  // ── commit handler ────────────────────────────────────────────────────────

  const handleCommit = async () => {
    const { importType, headers, rows } = importState;
    if (!importType || rows.length === 0) return;

    patchState({ running: true, progressCurrent: 0, progressTotal: rows.length, results: null });

    let results;
    try {
      if (importType === 'create_people') {
        results = await processCreatePeople(headers, rows);
      } else if (importType === 'append_groups') {
        results = await processAppendGroups(headers, rows);
      } else if (importType === 'update_contact') {
        results = await processUpdateContact(headers, rows);
      } else if (importType === 'dd_import') {
        results = await processDDImport(headers, rows);
      } else if (importType === 'family_groups') {
        results = await processFamilyGroups(headers, rows);
      } else if (importType === 'merge_accounts') {
        results = await processMergeAccounts(headers, rows);
      } else {
        results = { successes: 0, errors: [{ rowNum: 0, message: 'Unknown import type.' }], warnings: [] };
      }
    } catch (err) {
      cl({ 'ClientImportSection handleCommit error': err });
      results = { successes: 0, errors: [{ rowNum: 0, message: `Unexpected error: ${err.message}` }], warnings: [] };
    }

    patchState({ running: false, results });
  };

  // ── render ────────────────────────────────────────────────────────────────

  const { importType, detectedType, headers, rows, fileName, running, results } = importState;

  const hasFile = headers.length > 0 && rows.length > 0;
  const canCommit = hasFile && !!importType && !running;
  const previewRows = rows.slice(0, 5);

  return (
    <Box
      key='clientImportSection_masterBox'
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
      style={{ gap: 16 }}
    >

      {/* ── type selector ── */}
      <FormControl component='fieldset'>
        <FormLabel component='legend'>
          <Typography style={AVATextStyle({ size: 0.85, bold: true })}>Import Type</Typography>
        </FormLabel>
        <RadioGroup
          value={importType}
          onChange={(e) => patchState({ importType: e.target.value })}
        >
          {IMPORT_TYPES.map(t => (
            <FormControlLabel
              key={t.value}
              value={t.value}
              control={<Radio size='small' color='primary' />}
              label={
                <Box>
                  <Typography style={AVATextStyle({ size: 0.85, bold: importType === t.value })}>
                    {t.label}
                    {detectedType === t.value && (
                      <Typography component='span' style={AVATextStyle({ size: 0.75, color: 'green' })}>
                        {' '}(auto-detected)
                      </Typography>
                    )}
                  </Typography>
                  <Typography style={AVATextStyle({ size: 0.75, color: '#666' })}>
                    {t.description}
                  </Typography>
                </Box>
              }
            />
          ))}
        </RadioGroup>
      </FormControl>

      {/* ── file chooser ── */}
      <Box display='flex' alignItems='center' style={{ gap: 12 }}>
        <Button
          variant='outlined'
          size='small'
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
          disabled={running}
        >
          Choose File
        </Button>
        {fileName && (
          <Typography style={AVATextStyle({ size: 0.85 })}>
            {fileName}
            {hasFile && ` — ${rows.length} data row${rows.length !== 1 ? 's' : ''}`}
          </Typography>
        )}
        <input
          ref={fileInputRef}
          type='file'
          accept='.csv,.xlsx,.xls'
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </Box>

      {/* ── preview table ── */}
      {hasFile && (
        <Box>
          <Typography style={AVATextStyle({ size: 0.8, color: '#555' })}>
            Preview (first {Math.min(previewRows.length, 5)} rows):
          </Typography>
          <TableContainer component={Paper} style={{ maxHeight: 240, overflow: 'auto' }}>
            <Table size='small' stickyHeader>
              <TableHead>
                <TableRow>
                  {headers.map((h, idx) => (
                    <TableCell key={idx} style={{ fontWeight: 'bold', fontSize: '0.75rem', padding: '4px 8px' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {previewRows.map((row, rIdx) => (
                  <TableRow key={rIdx}>
                    {headers.map((_, cIdx) => (
                      <TableCell key={cIdx} style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                        {String(row[cIdx] || '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* ── progress ── */}
      {running && (
        <Box>
          <Typography style={AVATextStyle({ size: 0.85 })}>Running import…</Typography>
          <LinearProgress style={{ marginTop: 4 }} />
        </Box>
      )}

      {/* ── commit button ── */}
      {hasFile && !running && (
        <Box>
          <Button
            variant='contained'
            color='primary'
            size='small'
            onClick={handleCommit}
            disabled={!canCommit}
          >
            Commit Import
          </Button>
        </Box>
      )}

      {/* ── results ── */}
      {results && (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Alert severity={results.errors.length === 0 ? 'success' : (results.successes > 0 ? 'warning' : 'error')}>
            <AlertTitle>
              {results.successes} row{results.successes !== 1 ? 's' : ''} processed successfully
              {results.errors.length > 0 ? `, ${results.errors.length} error${results.errors.length !== 1 ? 's' : ''}` : ''}
            </AlertTitle>
            {results.warnings && results.warnings.length > 0 && (
              <Box>
                {results.warnings.map((w, idx) => (
                  <Typography key={idx} style={AVATextStyle({ size: 0.8, color: '#555' })}>
                    {w}
                  </Typography>
                ))}
              </Box>
            )}
            {results.errors.length > 0 && (
              <Box style={{ marginTop: 8 }}>
                {results.errors.map((e, idx) => (
                  <Typography key={idx} style={AVATextStyle({ size: 0.8 })}>
                    {e.message}
                  </Typography>
                ))}
              </Box>
            )}
          </Alert>
          {importType === 'create_people' && results.assignedIds && (
            <Box>
              <Button
                variant='outlined'
                size='small'
                onClick={downloadWithUserIds}
              >
                Download Spreadsheet with Assigned User IDs
              </Button>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
