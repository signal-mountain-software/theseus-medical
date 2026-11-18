import { getDb, putDb, titleCase } from './AVAUtilities';

/**
 * Converts a QuickAdd account_config's field_list/required arrays into a Forms-table record
 * FormFillB can render via account_config.form_id, bootstrapping the one-time migration of an
 * account_type off QuickAdd's own field-list rendering (see the form_id opt-in discussed
 * alongside FormFillB delegation in QuickAdd.js).
 *
 * Looks up each field_list entry against Form_Fields, then Common_Fields, then DataDictionaryV3 -
 * the same precedence QuickAdd's own field-list rendering already uses (see QuickAdd.js's
 * gatherFormFields) - so the generated Form inherits identical prompt/type/show_if/ignore_if
 * behavior without re-authoring any of it. A field_list entry found only in DataDictionaryV3 (no
 * Form_Fields/Common_Fields record of its own) is marked dictionary_field_key so FormFillB treats
 * it as adopted from the Data Dictionary (inferred default/saveAs - see FormFillB.js's
 * getFieldVariables); a field with its own Form_Fields/Common_Fields record is treated as
 * hand-authored, matching how FormBuilder already distinguishes the two.
 *
 * This only builds the record in memory - it does not write it, and does not modify
 * accountConfig. Review the result (e.g. by opening it in FormBuilder, or passing it as
 * request.previewFormRec to FormFillB) before writing it, and before pointing an account_config's
 * form_id at it.
 *
 * @param {object} options
 * @param {string} options.client_id
 * @param {object} options.accountConfig - a new_account_form entry: { account_type, field_list, required, capture_header, ... }
 * @param {string} [options.form_id] - defaults to `${account_type}_account_form`
 * @param {Function} [options.getDbImpl] - override for testing; defaults to AVAUtilities.getDb
 * @returns {Promise<{form: object, warnings: string[]}>}
 */
export async function buildFormFromAccountConfig({ client_id, accountConfig, form_id, getDbImpl = getDb }) {
  if (!client_id || typeof client_id !== 'string') {
    throw new Error('buildFormFromAccountConfig requires a client_id.');
  }
  if (!accountConfig || typeof accountConfig !== 'object' || Array.isArray(accountConfig)) {
    throw new Error('buildFormFromAccountConfig requires an accountConfig object.');
  }
  const accountType = accountConfig.account_type;
  if (!accountType || typeof accountType !== 'string' || !accountType.trim()) {
    throw new Error('accountConfig must have a non-empty account_type.');
  }
  if (!Array.isArray(accountConfig.field_list) || accountConfig.field_list.length === 0) {
    throw new Error('accountConfig must have a non-empty field_list array.');
  }

  const requiredSet = new Set((accountConfig.required || []).map((fieldKey) => String(fieldKey)));
  const resolvedFormId = (form_id && form_id.trim()) || `${accountType}_account_form`;
  const warnings = [];
  const fields = {};
  const sectionFieldNames = [];

  for (const fieldKey of accountConfig.field_list) {
    const [formFieldRec, commonFieldRec, dictionaryRec] = await Promise.all([
      getDbImpl({ Key: { client_id, field_name: fieldKey }, TableName: 'Form_Fields' }),
      getDbImpl({ Key: { client_id, field_id: fieldKey }, TableName: 'Common_Fields' }),
      getDbImpl({ Key: { client_id, field_key: fieldKey }, TableName: 'DataDictionaryV3' }),
    ]);

    if (!formFieldRec && !commonFieldRec && !dictionaryRec) {
      warnings.push(`"${fieldKey}" was not found in Form_Fields, Common_Fields, or DataDictionaryV3 for this client - it was skipped. Add a field definition for it first, then re-run the migration.`);
      continue;
    }

    const fieldDef = { required: requiredSet.has(fieldKey) };
    if (!formFieldRec && !commonFieldRec && dictionaryRec) {
      fieldDef.dictionary_field_key = fieldKey;
    }
    fields[fieldKey] = fieldDef;
    sectionFieldNames.push(fieldKey);
  }

  if (sectionFieldNames.length === 0) {
    warnings.push('None of this account_type\'s field_list entries could be resolved - the generated form has no fields.');
  }

  const form = {
    client_id,
    form_id: resolvedFormId,
    form_name: accountConfig.capture_header || titleCase(accountType),
    category: 'Account Creation',
    active: true,
    current: true,
    sections: [{
      section_name: 'default',
      belongs_to_stage: '',
      fields: sectionFieldNames,
    }],
    fields,
    stages: [],
  };

  return { form, warnings };
}

/**
 * Convenience wrapper: builds the Form record (buildFormFromAccountConfig) and writes it via
 * putDb. Does NOT modify accountConfig itself - once you've reviewed the generated form, set
 * accountConfig.form_id to the returned form_id yourself (e.g. via ClientProfileSection's
 * new_account_form editor) to actually opt that account_type into FormFillB delegation.
 *
 * @returns {Promise<{form_id: string, warnings: string[]}>}
 */
export async function migrateAccountConfigToForm({ client_id, accountConfig, form_id, putDbImpl = putDb, getDbImpl = getDb }) {
  const { form, warnings } = await buildFormFromAccountConfig({ client_id, accountConfig, form_id, getDbImpl });
  await putDbImpl({ TableName: 'Forms', Item: form });
  return { form_id: form.form_id, warnings };
}
