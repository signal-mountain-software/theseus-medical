import { sendMessages, sendMessage } from './AVAMessages';
import { dbClient } from './AVAUtilities';

jest.mock('./AVAUtilities', () => ({
  dbClient: { query: jest.fn(), put: jest.fn() },
  cl: jest.fn(), uuid: () => 'id',
  makeArray: value => [value].flat()
}));
jest.mock('./AVAPeople', () => ({ makeName: async () => 'Sender' }));
jest.mock('./AVAGroups', () => ({}));
jest.mock('./AVAServiceRequest', () => ({}));
jest.mock('./AVAObservations', () => ({}));
jest.mock('./AVADateTime', () => ({}));
jest.mock('jspdf', () => ({}));
jest.mock('html2canvas', () => ({}));

beforeEach(() => {
  jest.clearAllMocks();
  dbClient.put.mockImplementation(() => ({ promise: async () => ({}) }));
  dbClient.query.mockImplementation(params => ({
    promise: async () => ({ Items: params.TableName === 'People'
      ? Array.from({ length: 410 }, (_, index) => ({ person_id: `person-${index}`, groups: ['group'] }))
      : [] })
  }));
});

it('combines groups and explicit IDs into one deduplicated broadcast', async () => {
  const result = await sendMessages({
    client: 'client', author: 'sender', subject: ' Subject\nline ', messageText: 'Body',
    recipientList: ['GRP//group', 'person-0', 'GRP:group'],
    attachments: ['file'], voiceMail: 'Voice', testMode: true
  });
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ sent: true, message_ids: expect.any(Array) });
  expect(result[0].message_ids).toHaveLength(2);
  const requests = dbClient.put.mock.calls.map(([params]) => params);
  expect(requests.map(params => params.Item.recipient_key.length)).toEqual([205, 205]);
  requests.forEach(params => expect(params).toMatchObject({
    TableName: 'TestPostOffice',
    Item: { client_id: 'client', from: 'sender', subject: 'Subject line', message_text: 'Body', attachments: ['file'], voice_mail: 'Voice' }
  }));
});

it('preserves the alias and small-message thread ID', async () => {
  const [result] = await sendMessage({
    client: 'client', author: 'sender', subject: 'Subject', messageText: 'Body',
    recipientList: 'person', thread_id: 'existing-thread'
  });
  expect(result.sent).toBe(true);
  expect(result.message_id).toBe('existing-thread.0~AVAMessages');
  expect(dbClient.put.mock.calls[0][0].Item).toMatchObject({
    thread_id: 'existing-thread', recipient_base: 'list', recipient_key: ['person']
  });
});

it('returns failure, not success, when only some batches were posted', async () => {
  dbClient.put.mockImplementation(params => ({
    promise: async () => {
      if (params.Item.batch_index === 2) { throw new Error('Access denied'); }
      return {};
    }
  }));
  const [result] = await sendMessages({
    client: 'client', author: 'sender', subject: 'Subject', messageText: 'Body',
    recipientList: 'GRP//group'
  });
  expect(result.sent).toBe(false);
  expect(result.message).toContain('1 of 2 message batches queued');
  expect(result.message_ids).toHaveLength(1);
});

it('continues independent input messages after a resolution error', async () => {
  const results = await sendMessages([
    { client: 'client', author: 'sender', subject: 'Subject', recipientList: [] },
    { client: 'client', author: 'sender', subject: 'Subject', recipientList: ['person'] }
  ]);
  expect(results.map(result => result.sent)).toEqual([false, true]);
  expect(dbClient.put).toHaveBeenCalledTimes(1);
});
