import { dbClient } from './AVAUtilities';

export const MAX_POSTOFFICE_RECIPIENTS = 400;

async function queryAll(params) {
  const items = [];
  let lastKey;
  do {
    const page = await dbClient.query({
      ...params,
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {})
    }).promise();
    items.push(...(page.Items || []));
    lastKey = page.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

function groupTargets(value, defaultClient) {
  const targets = [];
  for (const entry of [value].flat()) {
    if (typeof entry !== 'string' || !entry.trim()) {
      throw new Error('A message group reference is empty or invalid.');
    }
    let group = entry.replace(/^GRP(?::|\/\/)/, '').trim();
    let client = defaultClient;
    if (group.includes('/')) {
      [client, group] = group.split(/\/+/);
    }
    for (let id of group.replace(/[[\]]/g, '').split(/,|~/)) {
      id = id.trim().replace(/^group:/, '').trim();
      if (id) { targets.push({ client, group: id }); }
    }
  }
  if (!targets.length || targets.some(target => !target.client)) {
    throw new Error('A message group reference is missing its client or group.');
  }
  return targets;
}

async function resolveAudience(item) {
  const inputs = [];
  if (item.recipient_base === 'group') {
    inputs.push(...groupTargets(item.recipient_key, item.client_id));
  } else {
    const recipients = item.recipient_base === 'list'
      ? [item.recipient_key].flat()
      : (!item.recipient_key || item.recipient_key === 'self'
        || (Array.isArray(item.recipient_key) && item.recipient_key[0] === 'self'))
        ? [item.recipient_base] : [item.recipient_key].flat();
    for (const recipient of recipients) {
      if (typeof recipient !== 'string' || !recipient.trim()) {
        throw new Error('A message recipient person ID is empty or invalid.');
      }
      if (/^GRP(?::|\/\/)/.test(recipient)) {
        inputs.push(...groupTargets(recipient, item.client_id));
      } else {
        inputs.push({ client: item.client_id, person: recipient.trim() });
      }
    }
  }

  const clients = new Map();
  for (const input of inputs.filter(input => input.group)) {
    if (clients.has(input.client)) { continue; }
    // Match Mailman's People.groups audience, including inherited ancestor groups.
    // Existing group helpers swallow read errors or return only the first page.
    const [people, groups] = await Promise.all([
      queryAll({
        TableName: 'People',
        IndexName: 'client_id-index',
        KeyConditionExpression: 'client_id = :c',
        ExpressionAttributeValues: { ':c': input.client },
        ProjectionExpression: 'person_id, #groups',
        ExpressionAttributeNames: { '#groups': 'groups' }
      }),
      queryAll({
        TableName: 'Groups',
        KeyConditionExpression: 'client_id = :c',
        ExpressionAttributeValues: { ':c': input.client },
        ProjectionExpression: 'group_id, belongs_to'
      })
    ]);
    const parents = new Map(groups.map(group => [group.group_id, group.belongs_to]));
    clients.set(input.client, people.map(person => {
      const membership = new Set([person.groups || []].flat());
      for (const group of membership) {
        const parent = parents.get(group);
        if (parent) { membership.add(parent); }
      }
      return { person_id: person.person_id, membership };
    }));
  }

  const seen = new Set();
  const audience = new Map();
  const add = (client, person) => {
    if (typeof person !== 'string' || !person.trim()) {
      throw new Error('A resolved message recipient is missing its person ID.');
    }
    if (!client) { throw new Error('A message recipient is missing its client.'); }
    if (seen.has(person)) { return; }
    seen.add(person);
    if (!audience.has(client)) { audience.set(client, []); }
    audience.get(client).push(person);
  };
  for (const input of inputs) {
    if (input.person) {
      add(input.client, input.person);
    } else {
      for (const person of clients.get(input.client)) {
        if (input.group.toLowerCase().includes('*all') || person.membership.has(input.group)) {
          add(input.client, person.person_id);
        }
      }
    }
  }
  if (!seen.size) { throw new Error('This message has no recipients after resolving its groups.'); }
  return audience;
}

export async function preparePostOfficeSubmission(request) {
  if (!request || !request.Item || !request.Item.message_id
    || !['PostOffice', 'TestPostOffice'].includes(request.TableName)) {
    throw new Error('A valid PostOffice table and message ID are required.');
  }
  const audience = await resolveAudience(request.Item);
  const batches = [];
  for (const [client, recipients] of audience) {
    const count = Math.ceil(recipients.length / MAX_POSTOFFICE_RECIPIENTS);
    const size = Math.floor(recipients.length / count);
    const extra = recipients.length % count;
    let offset = 0;
    for (let index = 0; index < count; index++) {
      const length = size + (index < extra ? 1 : 0);
      batches.push({ client, recipients: recipients.slice(offset, offset + length) });
      offset += length;
    }
  }
  const split = batches.length > 1;
  return {
    recipientCount: batches.reduce((total, batch) => total + batch.recipients.length, 0),
    records: batches.map((batch, index) => ({
      posted: false,
      request: {
        ...request,
        Item: {
          ...request.Item,
          client_id: batch.client,
          recipient_base: 'list',
          recipient_key: batch.recipients,
          ...(split ? {
            message_id: `${request.Item.message_id}.batch-${index + 1}`,
            // Independent threads avoid Mailman's concurrent message-number allocation.
            thread_id: `${request.Item.thread_id || request.Item.message_id}.batch-${index + 1}`,
            broadcast_id: request.Item.broadcast_id || request.Item.message_id,
            broadcast_thread_id: request.Item.broadcast_thread_id || request.Item.thread_id || request.Item.message_id,
            batch_index: index + 1,
            batch_count: batches.length
          } : {})
        }
      }
    }))
  };
}

export async function submitPostOfficeSubmission(submission) {
  const failures = [];
  for (const record of submission.records) {
    if (record.posted) { continue; }
    try {
      await dbClient.put(record.request).promise();
      record.posted = true;
    } catch (error) {
      failures.push({ message_id: record.request.Item.message_id, error });
    }
  }
  const postedCount = submission.records.filter(record => record.posted).length;
  if (failures.length) {
    const error = new Error(
      `${postedCount} of ${submission.records.length} message batches queued. `
      + `Could not queue ${failures.map(failure => failure.message_id).join(', ')}. `
      + `Error: ${failures[0].error.message || failures[0].error}`
    );
    error.submission = submission;
    error.failures = failures;
    throw error;
  }
  return submission;
}

export async function postPostOffice(request) {
  return submitPostOfficeSubmission(await preparePostOfficeSubmission(request));
}
