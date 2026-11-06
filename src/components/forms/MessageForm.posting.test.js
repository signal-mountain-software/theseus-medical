import React from 'react';
import { fireEvent, render, screen, wait } from '@testing-library/react';
import MessageForm from './MessageForm';
import { dbClient } from '../../util/AVAUtilities';

jest.mock('../../hooks/useSession', () => () => ({
  state: {
    user: { account_class: 'admin' },
    session: { user_id: 'user', patient_id: 'sender', client_id: 'client', client_style: {}, message_template_variables: [] }
  }
}));
jest.mock('@material-ui/core/styles/makeStyles', () => () => () => ({}));
jest.mock('../../util/AVAStyles', () => ({
  AVAclasses: () => ({}), AVATextStyle: () => ({}), AVADefaults: () => 1
}));
jest.mock('../../util/AVAUtilities', () => ({
  dbClient: { query: jest.fn(), put: jest.fn() },
  cl: jest.fn(), uuid: () => 'id',
  listFromArray: values => values.join(', '),
  recordExists: value => !!(value?.Item || value?.Items?.length)
}));
jest.mock('../../util/AVAPeople', () => ({
  makeName: async () => 'Sender', getImage: () => '', getPerson: async () => ({})
}));
jest.mock('../../util/AVAGroups', () => ({}));
jest.mock('../../util/AVADateTime', () => ({
  makeDate: value => ({ date: new Date(value), absolute: 'Scheduled time' })
}));
jest.mock('../../util/AVAMessages', () => ({ html_to_pdf: async () => 'pdf' }));
jest.mock('../../util/AVAUploadFile', () => () => null);
jest.mock('../dialogs/PeopleMaintenance', () => () => null);
jest.mock('../dialogs/MessageDetailDialog', () => () => null);
jest.mock('../sections/QuickSearch', () => () => null);
jest.mock('react-quill', () => () => null);
jest.mock('react-dropdown-select', () => () => null);
jest.mock('react-idle-timer', () => ({ useIdleTimer: () => ({ start: jest.fn() }) }));

beforeEach(() => {
  jest.clearAllMocks();
  dbClient.query.mockImplementation(params => ({
    promise: async () => ({ Items: params.TableName === 'People'
      ? Array.from({ length: 410 }, (_, index) => ({ person_id: `person-${index}`, groups: ['group'] }))
      : [] })
  }));
  dbClient.put.mockImplementation(() => ({ promise: async () => ({}) }));
});

const mountComposer = (recipients = [{ group_id: 'group', group_name: 'Group' }]) => {
  const onReset = jest.fn();
  render(<MessageForm
    pPerson="sender" pClient="client" pMessageList={[]} onReset={onReset}
    options={{ newMessage: true, recipients, subject: 'Subject', messageText: 'Body' }}
  />);
  return onReset;
};

it('posts a group-icon-style audience as balanced explicit lists', async () => {
  const onReset = mountComposer();
  fireEvent.click(await screen.findByRole('button', { name: 'Send' }));
  await wait(() => expect(onReset).toHaveBeenCalledTimes(1));
  const requests = dbClient.put.mock.calls.map(([params]) => params);
  expect(requests.map(params => params.Item.recipient_key.length)).toEqual([205, 205]);
  expect(requests.every(params => params.TableName === 'TestPostOffice')).toBe(true);
  expect(requests[0].Item.thread_id).not.toBe(requests[1].Item.thread_id);
  expect(requests.every(params => params.Item.recipient_base === 'list')).toBe(true);
});

it('keeps a failed draft and retries only the unconfirmed batch', async () => {
  let fail = true;
  dbClient.put.mockImplementation(params => ({
    promise: async () => {
      if (fail && params.Item.batch_index === 2) { throw new Error('Write denied'); }
      return {};
    }
  }));
  const onReset = mountComposer();
  fireEvent.click(await screen.findByRole('button', { name: 'Send' }));
  await screen.findByText(/1 of 2 message batches queued/);
  expect(onReset).not.toHaveBeenCalled();
  expect(document.getElementById('MessageText_new').value).toBe('Body');
  const failedRequest = dbClient.put.mock.calls[1][0];
  fail = false;
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await wait(() => expect(onReset).toHaveBeenCalledTimes(1));
  expect(dbClient.put).toHaveBeenCalledTimes(3);
  expect(dbClient.put.mock.calls[2][0]).toBe(failedRequest);
});

it('does not requeue successful chunks if a partially posted draft is edited', async () => {
  dbClient.put.mockImplementation(params => ({
    promise: async () => {
      if (params.Item.batch_index === 2) { throw new Error('Write denied'); }
      return {};
    }
  }));
  const onReset = mountComposer();
  fireEvent.click(await screen.findByRole('button', { name: 'Send' }));
  await screen.findByText(/1 of 2 message batches queued/);
  fireEvent.change(document.getElementById('MessageText_new'), { target: { value: 'Changed' } });
  fireEvent.blur(document.getElementById('MessageText_new'), { target: { value: 'Changed' } });
  await wait(() => expect(screen.getByRole('button', { name: 'Send' }).disabled).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
  await screen.findByText(/Part of the previous message is already queued/);
  expect(dbClient.put).toHaveBeenCalledTimes(2);
  expect(onReset).not.toHaveBeenCalled();
});

it('preserves a small message and its existing reply thread', async () => {
  const onReset = jest.fn();
  render(<MessageForm
    pPerson="sender" pClient="client" pMessageList={[]} onReset={onReset}
    options={{
      newMessage: true, recipients: [{ person_id: 'person', person_name: 'Person' }],
      newMessageThread: 'existing', subject: 'Subject', messageText: 'Body'
    }}
  />);
  fireEvent.click(await screen.findByRole('button', { name: 'Send' }));
  await wait(() => expect(onReset).toHaveBeenCalledTimes(1));
  expect(dbClient.put).toHaveBeenCalledTimes(1);
  expect(dbClient.put.mock.calls[0][0].Item).toMatchObject({
    thread_id: 'existing', recipient_key: ['person'], message_text: 'Body'
  });
});

it('prevents overlapping clicks from queuing the same message twice', async () => {
  let finishWrite;
  dbClient.put.mockImplementation(() => ({ promise: () => new Promise(resolve => { finishWrite = resolve; }) }));
  const onReset = mountComposer([{ person_id: 'person', person_name: 'Person' }]);
  const send = await screen.findByRole('button', { name: 'Send' });
  fireEvent.click(send);
  fireEvent.click(send);
  await wait(() => expect(dbClient.put).toHaveBeenCalledTimes(1));
  expect(send.disabled).toBe(true);
  finishWrite({});
  await wait(() => expect(onReset).toHaveBeenCalledTimes(1));
  expect(dbClient.put).toHaveBeenCalledTimes(1);
});
