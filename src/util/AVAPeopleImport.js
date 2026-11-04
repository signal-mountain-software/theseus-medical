// Shared "Create new accounts" spreadsheet handling - used by ClientImportSection (bulk account
// creation) and GroupControl (Upload: resolve a spreadsheet to a list of people, matching existing
// accounts and optionally creating the rest).
import { dbClient, putDb, isEmpty, titleCase, cl } from './AVAUtilities';
import { addMember } from './AVAGroups';

const XLSX = require('xlsx');

export const toStoragePhone = (phoneValue) => {
  if (!phoneValue) return '';
  const digits = String(phoneValue).replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 0) return `+${digits}`;
  return '';
};

export const parseFullName = (raw) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { firstName: '', lastName: '' };
  if (trimmed.includes(',')) {
    const commaIdx = trimmed.indexOf(',');
    const lastName = trimmed.slice(0, commaIdx).trim();
    const firstName = trimmed.slice(commaIdx + 1).trim();
    return { firstName, lastName };
  }
  const parts = trimmed.split(/\s+/);
  const lastName = parts.pop();
  const firstName = parts.join(' ');
  return { firstName, lastName };
};

// Reads the first sheet of an .xlsx/.xls/.csv File into a header row plus non-blank data rows.
export const readSpreadsheetFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const allRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!allRows || allRows.length === 0) {
        resolve({ headers: [], rows: [] });
        return;
      }
      const headers = allRows[0].map(h => String(h).trim());
      const rows = allRows.slice(1).filter(row => row.some(cell => String(cell).trim() !== ''));
      resolve({ headers, rows });
    } catch (err) {
      reject(err);
    }
  };
  reader.onerror = () => reject(reader.error);
  reader.readAsArrayBuffer(file);
});

// Turns "Create new accounts" rows into normalized people. Rows missing a first or last name are
// errors; repeat names within the sheet are warnings (first occurrence wins).
export const parseCreatePeopleRows = (headers, rows) => {
  const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());
  const firstIdx = lowerHeaders.findIndex(h => h.includes('first'));
  const lastIdx = lowerHeaders.findIndex(h => h.includes('last'));
  const fullNameIdx = lowerHeaders.findIndex(h => h === 'name' || h === 'full name' || h === 'full_name' || h === 'fullname');
  const emailIdx = lowerHeaders.findIndex(h => (h.includes('email') || h.includes('mail')) && !h.includes('alt'));
  const cellIdx = lowerHeaders.findIndex(h => h.includes('cell') || h.includes('mobile') || (h.includes('phone') && !h.includes('home') && !h.includes('work')));

  const useSingleNameCol = fullNameIdx !== -1 && (firstIdx === -1 || lastIdx === -1);
  if (!useSingleNameCol && (firstIdx === -1 || lastIdx === -1)) {
    return { columnError: 'Could not find name columns. Expected "First Name" + "Last Name", or a single "Name" / "Full Name" column.', people: [], errors: [], warnings: [] };
  }

  const people = [];
  const errors = [];
  const warnings = [];
  const seenNames = new Set();
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2; // 1-based, +1 for header row
    const row = rows[i];
    let firstName, lastName;
    if (useSingleNameCol) {
      const parsed = parseFullName(row[fullNameIdx]);
      firstName = titleCase(parsed.firstName);
      lastName = titleCase(parsed.lastName);
    } else {
      firstName = titleCase(String(row[firstIdx] || '').trim());
      lastName = titleCase(String(row[lastIdx] || '').trim());
    }
    if (!firstName || !lastName) {
      errors.push({ rowNum, message: `Row ${rowNum}: missing first or last name — skipped.` });
      continue;
    }
    const nameKey = `${firstName.toLowerCase()} ${lastName.toLowerCase()}`;
    if (seenNames.has(nameKey)) {
      warnings.push(`Row ${rowNum} (${firstName} ${lastName}): duplicate name in spreadsheet — skipped.`);
      continue;
    }
    seenNames.add(nameKey);
    const email = emailIdx >= 0 ? String(row[emailIdx] || '').trim().toLowerCase() : '';
    const cell = cellIdx >= 0 ? toStoragePhone(String(row[cellIdx] || '').trim()) : '';
    people.push({ rowIndex: i, rowNum, firstName, lastName, email, cell });
  }
  return { people, errors, warnings };
};

// Client's user_id format (client_style customization), loaded once per batch.
export const loadClientIdStyle = async (client_id) => {
  let clientSuffix = null;
  let idSeparator = '-';
  let useNameOnly = false;
  const clientStyleRec = await dbClient
    .get({ Key: { client_id, custom_key: 'client_style' }, TableName: 'Customizations' })
    .promise()
    .catch(() => null);
  if (clientStyleRec?.Item?.customization_value) {
    const cv = clientStyleRec.Item.customization_value;
    if (cv.id_separator !== undefined) {
      idSeparator = cv.id_separator;
    }
    if (cv.client_suffix !== undefined) {
      const rawSuffix = cv.client_suffix;
      useNameOnly = (rawSuffix === '*none');
      clientSuffix = useNameOnly ? null : rawSuffix;
    }
  }
  return { clientSuffix, idSeparator, useNameOnly };
};

// Creates People + SessionsV2 + PeopleAccounts records (and __TOP__/ALL membership) for one person.
// Returns { user_id } on success, { user_id, alreadyExists: true } when the generated id already
// belongs to someone with this exact name, or { error } when no unique id could be generated.
// usedIds is shared across a batch so two rows never claim the same new id. DB write failures throw.
export const createPersonAccount = async ({ client_id, idStyle, usedIds, firstName, lastName, email = '', cell = '' }) => {
  const { clientSuffix, idSeparator, useNameOnly } = idStyle;
  const firstInitial = firstName.charAt(0).toLowerCase();
  const cleanLast = lastName.toLowerCase().replace(/[^a-z]/g, '');

  let counter = '';
  let attempts = 0;
  let user_id = '';
  let alreadyExists = false;
  while (attempts < 100) {
    let candidate;
    if (useNameOnly) {
      candidate = `${firstInitial}${cleanLast}${counter}`.toLowerCase();
    } else {
      const suffix = clientSuffix || client_id;
      candidate = `${firstInitial}${cleanLast}${counter}${idSeparator}${suffix}`.toLowerCase();
    }
    if (!usedIds.has(candidate)) {
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
    return { error: `could not generate unique user_id for ${firstName} ${lastName}` };
  }
  if (alreadyExists) {
    return { user_id, alreadyExists: true };
  }
  usedIds.add(user_id);

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

  const accountEntries = [
    { field: (`${firstName} ${lastName} ${client_id}`).toLowerCase(), type: 'name' },
  ];
  if (email) accountEntries.push({ field: email, type: 'eMail' });
  if (cell) accountEntries.push({ field: cell.slice(-10), type: 'phone_number' });

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
  return { user_id, peopleRecord };
};

// ── matching existing accounts ──────────────────────────────────────────────

const lookupPeopleAccounts = async (identifier) => {
  if (!identifier) { return []; }
  const result = await dbClient
    .query({
      TableName: 'PeopleAccounts',
      IndexName: 'alternate_id-index',
      KeyConditionExpression: 'identifier = :i',
      ExpressionAttributeValues: { ':i': identifier }
    })
    .promise()
    .catch((err) => { cl({ 'PeopleAccounts identifier lookup error': { identifier, err } }); return null; });
  return result?.Items || [];
};

const sameName = (personRec, firstName, lastName) =>
  (String(personRec?.name?.first || '').trim().toLowerCase() === firstName.toLowerCase())
  && (String(personRec?.name?.last || '').trim().toLowerCase() === lastName.toLowerCase());

// Finds the existing account for one spreadsheet person, client-scoped. Tries email, then cell
// phone, then name (PeopleAccounts identifiers: lower-case email, last 10 phone digits, and
// "first last client_id"). An email/phone hit is accepted regardless of name; when several
// same-client accounts share it (e.g. a family), the one whose name matches wins, else the first.
// peopleCache (person_id → People record or null) avoids re-reading the same record in a batch.
// Returns { person_id, personRec, matchedOn, note? } or null.
export const matchExistingPerson = async ({ client_id, firstName, lastName, email, cell, peopleCache = {} }) => {
  const getPeopleRec = async (person_id) => {
    if (!(person_id in peopleCache)) {
      const got = await dbClient
        .get({ Key: { person_id }, TableName: 'People' })
        .promise()
        .catch(() => null);
      peopleCache[person_id] = got?.Item || null;
    }
    return peopleCache[person_id];
  };

  const attempts = [
    { matchedOn: 'email', identifier: email ? email.toLowerCase() : '', accountType: 'eMail' },
    { matchedOn: 'phone', identifier: cell ? String(cell).replace(/\D/g, '').slice(-10) : '', accountType: 'phone_number' },
    { matchedOn: 'name', identifier: (`${firstName} ${lastName} ${client_id}`).toLowerCase(), accountType: 'name' },
  ];
  for (const { matchedOn, identifier, accountType } of attempts) {
    if (!identifier) { continue; }
    const rows = (await lookupPeopleAccounts(identifier))
      .filter((r) => !r.account_type || (r.account_type === accountType));
    const candidateIds = [...new Set(rows.map((r) => r.person_id).filter(Boolean))];
    const candidates = [];
    for (const person_id of candidateIds) {
      const personRec = await getPeopleRec(person_id);
      if (personRec && (personRec.client_id === client_id)) {
        candidates.push({ person_id, personRec });
      }
    }
    if (candidates.length === 0) { continue; }
    const pick = candidates.find((c) => sameName(c.personRec, firstName, lastName)) || candidates[0];
    return {
      ...pick,
      matchedOn,
      ...((candidates.length > 1) ? { note: `${candidates.length} accounts share this ${matchedOn}; used ${pick.person_id}` } : {})
    };
  }
  return null;
};
