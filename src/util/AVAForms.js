// Form lifecycle helpers shared by FormBuilder / FormManagement and the screens that list forms.
import { dbClient } from './AVAUtilities';

// The one rule for "is this form active?": anything except an explicit active === false.
export const isFormActive = (formRec) => (formRec?.active !== false);

// Soft-deleted forms are moved to this client_id, so every existing `client_id = <client>` query
// stops returning them with no other code changes. A technician can restore one by hand by
// copying the record back under the real client_id (and removing the deleted_* attributes).
export const deletedFormsClientId = (client_id) => `${client_id}~deleted`;

const queryAll = async (params) => {
  const items = [];
  let lastKey;
  do {
    const result = await dbClient
      .query(lastKey ? { ...params, ExclusiveStartKey: lastKey } : params)
      .promise();
    items.push(...(result?.Items || []));
    lastKey = result?.LastEvaluatedKey;
  } while (lastKey);
  return items;
};

// True if form_id appears anywhere in value as a whole token - exact match, inside a
// "<form:form_id>" menu token, a URL parameter, etc. Deliberately broad: a false positive only
// blocks a delete (and names the place to check), while a miss would leave a dangling reference.
const mentionsFormId = (value, form_id) => {
  if (value === null || value === undefined) { return false; }
  if (typeof value === 'string') {
    if (value === form_id) { return true; }
    const escaped = form_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^A-Za-z0-9_-])${escaped}([^A-Za-z0-9_-]|$)`).test(value);
  }
  if (Array.isArray(value)) { return value.some((v) => mentionsFormId(v, form_id)); }
  if (typeof value === 'object') { return Object.values(value).some((v) => mentionsFormId(v, form_id)); }
  return false;
};

// Everything that still points at a form. A form may only be deleted when nothing does.
// Any lookup that fails is reported in `errors` and must be treated as blocking - we never
// allow a delete based on an incomplete check.
// Returns { documentCount, groups: [{id, name}], events: [{id, name}], menus: [{id, name}], errors: [] }
export const findFormReferences = async ({ client_id, form_id }) => {
  const refs = { documentCount: 0, groups: [], events: [], menus: [], errors: [] };

  const checks = [
    (async () => {
      let lastKey;
      do {
        const params = {
          TableName: 'DocumentMaster',
          IndexName: 'client_form_person-index',
          KeyConditionExpression: 'client_id_form_type = :p',
          ExpressionAttributeValues: { ':p': `${client_id}%%${form_id}` },
          Select: 'COUNT',
        };
        if (lastKey) { params.ExclusiveStartKey = lastKey; }
        const result = await dbClient.query(params).promise();
        refs.documentCount += (result?.Count || 0);
        lastKey = result?.LastEvaluatedKey;
      } while (lastKey);
    })().catch((error) => { refs.errors.push(`documents (${error.message || error})`); }),

    queryAll({
      TableName: 'Groups',
      KeyConditionExpression: 'client_id = :c',
      ExpressionAttributeValues: { ':c': client_id },
    })
      .then((groups) => {
        refs.groups = groups
          .filter((g) => [g.forms].flat().includes(form_id))
          .map((g) => ({ id: g.group_id, name: g.group_name || g.group_id }));
      })
      .catch((error) => { refs.errors.push(`groups (${error.message || error})`); }),

    Promise.all(['event', 'template'].map((record_type) => queryAll({
      TableName: 'Calendar',
      IndexName: 'record_type-index',
      KeyConditionExpression: 'client = :c and record_type = :e',
      ExpressionAttributeValues: { ':c': client_id, ':e': record_type },
    })))
      .then((lists) => {
        refs.events = lists.flat()
          .filter((e) => mentionsFormId(e.default_forms, form_id) || mentionsFormId(e.forms, form_id))
          .map((e) => ({
            id: e.event_id || e.event_key,
            name: `${e.eventData?.event_data?.description || e.description || e.event_id || e.event_key}${(e.record_type === 'template') ? ' (template)' : ''}`
          }));
      })
      .catch((error) => { refs.errors.push(`events (${error.message || error})`); }),

    queryAll({
      TableName: 'MenuV3',
      KeyConditionExpression: 'client_id = :c',
      ExpressionAttributeValues: { ':c': client_id },
    })
      .then((menus) => {
        refs.menus = menus
          .filter((m) => {
            // Text/visual attributes can't launch anything - only scan the rest.
            const { description, icon_thumb, available_to, allow_add, newItem_availableTo, children, ...rest } = m;
            return mentionsFormId(rest, form_id);
          })
          .map((m) => ({ id: m.menu_id, name: m.description?.short || m.description?.long || m.menu_id }));
      })
      .catch((error) => { refs.errors.push(`menus (${error.message || error})`); }),
  ];

  await Promise.all(checks);
  return refs;
};

export const formHasReferences = (refs) => (
  (refs.documentCount > 0) || (refs.groups.length > 0) || (refs.events.length > 0)
  || (refs.menus.length > 0) || (refs.errors.length > 0)
);

// Moves the CURRENTLY STORED form record to the deleted-forms client_id in a single
// transaction (copy + delete succeed or fail together). Unsaved edits are not involved.
// Throws on failure; the caller must have run findFormReferences immediately beforehand.
export const softDeleteForm = async ({ client_id, form_id, deleted_by }) => {
  const stored = await dbClient
    .get({ TableName: 'Forms', Key: { client_id, form_id } })
    .promise();
  if (!stored?.Item) {
    throw new Error('This form was not found - it may already have been deleted.');
  }
  const archived = {
    ...stored.Item,
    client_id: deletedFormsClientId(client_id),
    deleted_from_client_id: client_id,
    deleted_by: deleted_by || 'unknown',
    deleted_on: new Date().toISOString(),
  };
  await dbClient
    .transactWrite({
      TransactItems: [
        { Put: { TableName: 'Forms', Item: archived } },
        {
          Delete: {
            TableName: 'Forms',
            Key: { client_id, form_id },
            ConditionExpression: 'attribute_exists(form_id)',
          }
        },
      ]
    })
    .promise();
  return archived;
};
