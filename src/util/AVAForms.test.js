jest.mock('./AVAUtilities', () => ({
  dbClient: { query: jest.fn(), get: jest.fn(), transactWrite: jest.fn() },
}));

const { dbClient } = require('./AVAUtilities');
const { isFormActive, findFormReferences, formHasReferences, softDeleteForm } = require('./AVAForms');

const promiseOf = (value) => ({ promise: () => Promise.resolve(value) });
const rejectionOf = (error) => ({ promise: () => Promise.reject(error) });

// Routes each mocked query to a canned result by table (and record_type for Calendar).
const mockTables = (tables) => {
  dbClient.query.mockImplementation((params) => {
    let key = params.TableName;
    if (key === 'Calendar') { key = `Calendar:${params.ExpressionAttributeValues[':e']}`; }
    const result = tables[key];
    if (result instanceof Error) { return rejectionOf(result); }
    return promiseOf(result || { Items: [], Count: 0 });
  });
};

beforeEach(() => { jest.clearAllMocks(); });

describe('isFormActive', () => {
  it('treats anything except an explicit false as active', () => {
    expect(isFormActive({})).toBe(true);
    expect(isFormActive({ active: true })).toBe(true);
    expect(isFormActive({ active: null })).toBe(true);
    expect(isFormActive({ active: false })).toBe(false);
  });
});

describe('findFormReferences', () => {
  it('reports nothing when the form is unused', async () => {
    mockTables({
      Groups: { Items: [{ group_id: 'g1', group_name: 'G1', forms: ['form_other'] }] },
      MenuV3: { Items: [{ menu_id: 'm1', description: { short: 'form_abc in text only' }, call: { target: 'x', params: ['form_abcd'] } }] },
    });
    const refs = await findFormReferences({ client_id: 'c', form_id: 'form_abc' });
    expect(refs).toEqual({ documentCount: 0, groups: [], events: [], menus: [], errors: [] });
    expect(formHasReferences(refs)).toBe(false);
  });

  it('finds documents, groups, events, templates and menu items', async () => {
    mockTables({
      DocumentMaster: { Count: 3 },
      Groups: { Items: [{ group_id: 'g1', group_name: 'Nurses', forms: ['form_abc'] }, { group_id: 'g2', forms: 'form_abc' }] },
      'Calendar:event': { Items: [{ event_id: 'e1', default_forms: [{ form_id: 'form_abc' }], eventData: { event_data: { description: 'Bingo' } } }] },
      'Calendar:template': { Items: [{ event_id: 't1', record_type: 'template', forms: ['form_abc'], description: 'Tmpl' }] },
      MenuV3: { Items: [{ menu_id: 'm1', description: { short: 'Intake' }, call: { target: 'FormFillB', params: ['<form:form_abc>'] } }] },
    });
    const refs = await findFormReferences({ client_id: 'c', form_id: 'form_abc' });
    expect(refs.documentCount).toBe(3);
    expect(refs.groups).toEqual([{ id: 'g1', name: 'Nurses' }, { id: 'g2', name: 'g2' }]);
    expect(refs.events).toEqual([{ id: 'e1', name: 'Bingo' }, { id: 't1', name: 'Tmpl (template)' }]);
    expect(refs.menus).toEqual([{ id: 'm1', name: 'Intake' }]);
    expect(formHasReferences(refs)).toBe(true);
    const docQuery = dbClient.query.mock.calls.find(([p]) => p.TableName === 'DocumentMaster')[0];
    expect(docQuery).toMatchObject({ IndexName: 'client_form_person-index', Select: 'COUNT', ExpressionAttributeValues: { ':p': 'c%%form_abc' } });
  });

  it('treats a failed lookup as blocking', async () => {
    mockTables({ Groups: new Error('throttled') });
    const refs = await findFormReferences({ client_id: 'c', form_id: 'form_abc' });
    expect(refs.errors).toEqual(['groups (throttled)']);
    expect(formHasReferences(refs)).toBe(true);
  });
});

describe('softDeleteForm', () => {
  it('moves the stored record to <client>~deleted in one transaction', async () => {
    dbClient.get.mockReturnValue(promiseOf({ Item: { client_id: 'c', form_id: 'form_abc', form_name: 'Intake', sections: [1] } }));
    dbClient.transactWrite.mockReturnValue(promiseOf({}));
    const archived = await softDeleteForm({ client_id: 'c', form_id: 'form_abc', deleted_by: 'u1' });
    const { TransactItems } = dbClient.transactWrite.mock.calls[0][0];
    expect(TransactItems[0].Put.Item).toMatchObject({
      client_id: 'c~deleted', form_id: 'form_abc', form_name: 'Intake', sections: [1],
      deleted_from_client_id: 'c', deleted_by: 'u1',
    });
    expect(TransactItems[1].Delete).toEqual({
      TableName: 'Forms', Key: { client_id: 'c', form_id: 'form_abc' }, ConditionExpression: 'attribute_exists(form_id)',
    });
    expect(archived.client_id).toBe('c~deleted');
  });

  it('refuses when the form no longer exists', async () => {
    dbClient.get.mockReturnValue(promiseOf({}));
    await expect(softDeleteForm({ client_id: 'c', form_id: 'gone' })).rejects.toThrow(/not found/);
    expect(dbClient.transactWrite).not.toHaveBeenCalled();
  });
});
