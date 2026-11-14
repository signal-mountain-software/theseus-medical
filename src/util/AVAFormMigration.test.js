import { buildFormFromAccountConfig, migrateAccountConfigToForm } from './AVAFormMigration';

describe('buildFormFromAccountConfig', () => {
  const baseConfig = {
    account_type: 'caregiver',
    field_list: ['first_name', 'last_name', 'dd_only_field', 'missing_field'],
    required: ['first_name', 'last_name'],
  };

  function makeGetDbImpl({ formFields = {}, commonFields = {}, dictionaryFields = {} } = {}) {
    return jest.fn(async ({ Key, TableName }) => {
      if (TableName === 'Form_Fields') { return formFields[Key.field_name] || false; }
      if (TableName === 'Common_Fields') { return commonFields[Key.field_id] || false; }
      if (TableName === 'DataDictionaryV3') { return dictionaryFields[Key.field_key] || false; }
      return false;
    });
  }

  it('marks a field found only in DataDictionaryV3 as dictionary-adopted', async () => {
    const getDbImpl = makeGetDbImpl({
      formFields: { first_name: { prompt: 'First Name' }, last_name: { prompt: 'Last Name' } },
      dictionaryFields: { dd_only_field: { type: 'string' } },
    });
    const { form, warnings } = await buildFormFromAccountConfig({ client_id: 'test', accountConfig: baseConfig, getDbImpl });
    expect(form.fields.dd_only_field).toEqual({ required: false, dictionary_field_key: 'dd_only_field' });
    expect(warnings).toEqual([expect.stringContaining('"missing_field"')]);
  });

  it('does not mark a field as dictionary-adopted when it also has its own Form_Fields record', async () => {
    const getDbImpl = makeGetDbImpl({
      formFields: {
        first_name: { prompt: 'First Name' },
        last_name: { prompt: 'Last Name' },
        dd_only_field: { prompt: 'Also hand-authored' },
      },
      dictionaryFields: { dd_only_field: { type: 'string' } },
    });
    const { form } = await buildFormFromAccountConfig({ client_id: 'test', accountConfig: baseConfig, getDbImpl });
    expect(form.fields.dd_only_field).toEqual({ required: false });
  });

  it('does not mark a field as dictionary-adopted when it also has its own Common_Fields record', async () => {
    const getDbImpl = makeGetDbImpl({
      formFields: { first_name: {}, last_name: {} },
      commonFields: { dd_only_field: { prompt: 'Also hand-authored' } },
      dictionaryFields: { dd_only_field: { type: 'string' } },
    });
    const { form } = await buildFormFromAccountConfig({ client_id: 'test', accountConfig: baseConfig, getDbImpl });
    expect(form.fields.dd_only_field).toEqual({ required: false });
  });

  it('carries the required array over onto each field, and skips unresolved field_list entries with a warning', async () => {
    const getDbImpl = makeGetDbImpl({
      formFields: { first_name: {}, last_name: {} },
      dictionaryFields: { dd_only_field: {} },
    });
    const { form, warnings } = await buildFormFromAccountConfig({ client_id: 'test', accountConfig: baseConfig, getDbImpl });
    expect(form.fields.first_name.required).toBe(true);
    expect(form.fields.last_name.required).toBe(true);
    expect(form.fields.dd_only_field.required).toBe(false);
    expect(form.fields.missing_field).toBeUndefined();
    expect(form.sections[0].fields).toEqual(['first_name', 'last_name', 'dd_only_field']);
    expect(warnings).toHaveLength(1);
  });

  it('builds form_id, form_name, and table-ready shape from the account_config', async () => {
    const getDbImpl = makeGetDbImpl({ formFields: { first_name: {}, last_name: {} }, dictionaryFields: { dd_only_field: {} } });
    const { form } = await buildFormFromAccountConfig({
      client_id: 'test',
      accountConfig: { ...baseConfig, capture_header: 'Caregiver Details' },
      getDbImpl,
    });
    expect(form.client_id).toBe('test');
    expect(form.form_id).toBe('caregiver_account_form');
    expect(form.form_name).toBe('Caregiver Details');
    expect(form.category).toBe('Account Creation');
    expect(form.active).toBe(true);
    expect(form.sections).toHaveLength(1);
    expect(form.sections[0].section_name).toBe('default');
    expect(form.stages).toEqual([]);
  });

  it('falls back to a title-cased account_type for form_name when capture_header is absent', async () => {
    const getDbImpl = makeGetDbImpl({ formFields: { first_name: {}, last_name: {} }, dictionaryFields: { dd_only_field: {} } });
    const { form } = await buildFormFromAccountConfig({ client_id: 'test', accountConfig: baseConfig, getDbImpl });
    expect(form.form_name).toBe('Caregiver');
  });

  it('honors an explicit form_id override', async () => {
    const getDbImpl = makeGetDbImpl({ formFields: { first_name: {}, last_name: {} }, dictionaryFields: { dd_only_field: {} } });
    const { form } = await buildFormFromAccountConfig({ client_id: 'test', accountConfig: baseConfig, form_id: 'custom_form_id', getDbImpl });
    expect(form.form_id).toBe('custom_form_id');
  });

  it('warns when every field_list entry is unresolved, producing an empty-fields form rather than throwing', async () => {
    const getDbImpl = makeGetDbImpl();
    const { form, warnings } = await buildFormFromAccountConfig({ client_id: 'test', accountConfig: baseConfig, getDbImpl });
    expect(form.sections[0].fields).toEqual([]);
    expect(Object.keys(form.fields)).toHaveLength(0);
    expect(warnings.some((w) => w.includes('no fields'))).toBe(true);
  });

  it.each([
    [null, 'requires a client_id'],
    ['', 'requires a client_id'],
  ])('rejects a missing client_id (%p)', async (client_id, expectedMessage) => {
    await expect(buildFormFromAccountConfig({ client_id, accountConfig: baseConfig, getDbImpl: jest.fn() }))
      .rejects.toThrow(expectedMessage);
  });

  it.each([
    [null, 'requires an accountConfig'],
    [{}, 'non-empty account_type'],
    [{ account_type: 'caregiver' }, 'non-empty field_list'],
    [{ account_type: 'caregiver', field_list: [] }, 'non-empty field_list'],
  ])('rejects an invalid accountConfig %p', async (accountConfig, expectedMessage) => {
    await expect(buildFormFromAccountConfig({ client_id: 'test', accountConfig, getDbImpl: jest.fn() }))
      .rejects.toThrow(expectedMessage);
  });
});

describe('migrateAccountConfigToForm', () => {
  it('writes the built form via putDb and returns its form_id and warnings, without mutating accountConfig', async () => {
    const accountConfig = {
      account_type: 'caregiver',
      field_list: ['first_name'],
      required: ['first_name'],
    };
    const original = JSON.parse(JSON.stringify(accountConfig));
    const getDbImpl = jest.fn(async ({ TableName }) => (TableName === 'Form_Fields' ? { prompt: 'First Name' } : false));
    const putDbImpl = jest.fn().mockResolvedValue({});

    const result = await migrateAccountConfigToForm({ client_id: 'test', accountConfig, putDbImpl, getDbImpl });

    expect(putDbImpl).toHaveBeenCalledWith({
      TableName: 'Forms',
      Item: expect.objectContaining({ client_id: 'test', form_id: 'caregiver_account_form' }),
    });
    expect(result.form_id).toBe('caregiver_account_form');
    expect(result.warnings).toEqual([]);
    expect(accountConfig).toEqual(original);
  });
});
