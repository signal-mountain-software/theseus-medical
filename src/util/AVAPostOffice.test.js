import { dbClient } from './AVAUtilities';
import {
  MAX_POSTOFFICE_RECIPIENTS, preparePostOfficeSubmission, submitPostOfficeSubmission, postPostOffice
} from './AVAPostOffice';

jest.mock('./AVAUtilities', () => ({
  dbClient: { query: jest.fn(), put: jest.fn() }
}));

const people = count => Array.from({ length: count }, (_, index) => `person-${index}`);
const request = (recipient_key, overrides = {}) => ({
  TableName: 'PostOffice',
  Item: {
    client_id: 'client', message_id: 'message', thread_id: 'thread',
    recipient_base: 'list', recipient_key,
    message_text: 'Message', html_message_text: '<p>Message</p>', subject: 'Subject',
    from: 'sender', patient_id: 'sender', deliver_time: 12345,
    preferred_method: 'urgent', reply_to: ['sender'], allowReplyAll: true,
    attachments: ['attachment'], s3MessageHTMLdoc: 'document', voice_mail: 'Voice',
    byPass_rules: true, is_public: true,
    ...overrides
  }
});

beforeEach(() => {
  jest.clearAllMocks();
  dbClient.query.mockImplementation(() => ({ promise: async () => ({ Items: [] }) }));
  dbClient.put.mockImplementation(() => ({ promise: async () => ({}) }));
});

it.each([
  [1, [1]], [3, [3]], [350, [350]], [400, [400]], [410, [205, 205]],
  [799, [400, 399]], [801, [267, 267, 267]], [1500, [375, 375, 375, 375]],
  [2500, [358, 357, 357, 357, 357, 357, 357]]
])('balances %i explicit person IDs into %j', async (count, sizes) => {
  const original = request(people(count));
  const snapshot = JSON.parse(JSON.stringify(original));
  const submission = await postPostOffice(original);
  const items = submission.records.map(record => record.request.Item);
  expect(items.map(item => item.recipient_key.length)).toEqual(sizes);
  expect(items.every(item => item.recipient_key.length <= MAX_POSTOFFICE_RECIPIENTS)).toBe(true);
  expect(items.flatMap(item => item.recipient_key)).toEqual(people(count));
  expect(new Set(items.map(item => item.message_id)).size).toBe(sizes.length);
  expect(new Set(items.map(item => item.thread_id)).size).toBe(sizes.length);
  expect(submission.recipientCount).toBe(count);
  expect(dbClient.query).not.toHaveBeenCalled();
  expect(original).toEqual(snapshot);
  items.forEach(item => {
    expect(item).toMatchObject({
      message_text: 'Message', html_message_text: '<p>Message</p>', subject: 'Subject',
      from: 'sender', patient_id: 'sender', deliver_time: 12345,
      preferred_method: 'urgent', reply_to: ['sender'], allowReplyAll: true,
      attachments: ['attachment'], s3MessageHTMLdoc: 'document', voice_mail: 'Voice',
      byPass_rules: true, is_public: true, recipient_base: 'list', client_id: 'client'
    });
  });
  if (sizes.length === 1) {
    expect(items[0].message_id).toBe('message');
    expect(items[0].thread_id).toBe('thread');
    expect(items[0].broadcast_id).toBeUndefined();
  } else {
    items.forEach((item, index) => expect(item).toMatchObject({
      message_id: `message.batch-${index + 1}`, thread_id: `thread.batch-${index + 1}`,
      broadcast_id: 'message', broadcast_thread_id: 'thread',
      batch_index: index + 1, batch_count: sizes.length
    }));
  }
});

it('deduplicates explicit IDs before calculating the batch count', async () => {
  const submission = await postPostOffice(request([...people(400), ...people(400)]));
  expect(submission.records).toHaveLength(1);
  expect(submission.recipientCount).toBe(400);
});

it('fully paginates People and Groups, expands ancestors, and deduplicates mixed references', async () => {
  const persons = people(410).map(person_id => ({ person_id, groups: ['leaf'] }));
  dbClient.query.mockImplementation(params => ({
    promise: async () => params.TableName === 'Groups'
      ? (params.ExclusiveStartKey
        ? { Items: [{ group_id: 'parent', belongs_to: 'root' }, { group_id: 'root', belongs_to: 'parent' }] }
        : { Items: [{ group_id: 'leaf', belongs_to: 'parent' }], LastEvaluatedKey: { group_id: 'leaf' } })
      : (params.ExclusiveStartKey
        ? { Items: persons.slice(200) }
        : { Items: persons.slice(0, 200), LastEvaluatedKey: { person_id: 'person-199' } })
  }));
  const submission = await postPostOffice(request(['person-0', 'GRP:root', 'GRP//parent', 'GRP:leaf', 'person-409']));
  expect(submission.records.map(record => record.request.Item.recipient_key.length)).toEqual([205, 205]);
  expect(submission.records.flatMap(record => record.request.Item.recipient_key)).toEqual(people(410));
  expect(dbClient.query).toHaveBeenCalledTimes(4);
  expect(dbClient.query.mock.calls.some(([params]) => params.ExclusiveStartKey?.person_id === 'person-199')).toBe(true);
  expect(dbClient.query.mock.calls.some(([params]) => params.ExclusiveStartKey?.group_id === 'leaf')).toBe(true);
});

it('resolves group-addressed records and includes people without groups in *all', async () => {
  dbClient.query.mockImplementation(params => ({
    promise: async () => ({ Items: params.TableName === 'People'
      ? [{ person_id: 'a', groups: ['group'] }, { person_id: 'b' }] : [] })
  }));
  const group = await postPostOffice(request('group', { recipient_base: 'group' }));
  expect(group.records[0].request.Item.recipient_key).toEqual(['a']);
  const all = await postPostOffice(request('GRP:*all'));
  expect(all.records[0].request.Item.recipient_key).toEqual(['a', 'b']);
});

it('preserves cross-client groups without changing the client of explicit recipients', async () => {
  dbClient.query.mockImplementation(params => ({
    promise: async () => ({ Items: params.TableName === 'People'
      ? [{ person_id: 'other-person', groups: ['group'] }] : [] })
  }));
  const submission = await postPostOffice(request(['GRP//other/group', 'local-person']));
  expect(submission.records.map(record => ({
    client: record.request.Item.client_id, recipients: record.request.Item.recipient_key
  }))).toEqual([
    { client: 'other', recipients: ['other-person'] },
    { client: 'client', recipients: ['local-person'] }
  ]);
  expect(dbClient.query.mock.calls.every(([params]) => params.ExpressionAttributeValues[':c'] === 'other')).toBe(true);
});

it('preserves self-addressed records and the test table', async () => {
  const original = request('self', { recipient_base: 'person' });
  original.TableName = 'TestPostOffice';
  await postPostOffice(original);
  expect(dbClient.put).toHaveBeenCalledWith({
    ...original, Item: { ...original.Item, recipient_base: 'list', recipient_key: ['person'] }
  });
});

it.each([[[]], [['']], [[null]], [['valid', undefined]]])('rejects invalid/empty recipients %j without posting', async recipients => {
  await expect(postPostOffice(request(recipients))).rejects.toThrow(/recipient/i);
  expect(dbClient.put).not.toHaveBeenCalled();
});

it('fails before any writes if a group page cannot be read', async () => {
  dbClient.query.mockImplementation(params => ({
    promise: async () => {
      if (params.TableName === 'Groups') { return { Items: [] }; }
      if (params.ExclusiveStartKey) { throw new Error('Membership read denied'); }
      return { Items: [{ person_id: 'a', groups: ['group'] }], LastEvaluatedKey: { person_id: 'a' } };
    }
  }));
  await expect(postPostOffice(request(['explicit', 'GRP:group']))).rejects.toThrow('Membership read denied');
  expect(dbClient.put).not.toHaveBeenCalled();
});

it('does not silently succeed when groups resolve to an empty audience', async () => {
  await expect(postPostOffice(request('GRP:empty'))).rejects.toThrow('no recipients');
  expect(dbClient.put).not.toHaveBeenCalled();
});

it('reports partial writes and retries only unconfirmed records with unchanged IDs and audience', async () => {
  const submission = await preparePostOfficeSubmission(request(people(801)));
  let fail = true;
  dbClient.put.mockImplementation(params => ({
    promise: async () => {
      if (fail && params.Item.batch_index === 2) { throw new Error('Write denied'); }
      return {};
    }
  }));
  await expect(submitPostOfficeSubmission(submission)).rejects.toMatchObject({
    message: expect.stringContaining('2 of 3 message batches queued'),
    submission,
    failures: [{ message_id: 'message.batch-2', error: expect.any(Error) }]
  });
  expect(submission.records.map(record => record.posted)).toEqual([true, false, true]);
  const originalSecond = dbClient.put.mock.calls[1][0];
  fail = false;
  await submitPostOfficeSubmission(submission);
  expect(dbClient.put).toHaveBeenCalledTimes(4);
  expect(dbClient.put.mock.calls[3][0]).toBe(originalSecond);
  await submitPostOfficeSubmission(submission);
  expect(dbClient.put).toHaveBeenCalledTimes(4);
});
