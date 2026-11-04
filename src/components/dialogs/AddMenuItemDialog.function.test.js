import React from 'react';
import { fireEvent, render, screen, wait, within } from '@testing-library/react';
import AddMenuItemDialog from './AddMenuItemDialog';
import { parseMenuFunctionCall } from './MenuFunctionFields';
import { cl, dbClient } from '../../util/AVAUtilities';

let mockAccountClass = 'master';
jest.mock('../../hooks/useSession', () => () => ({
  state: {
    user: { account_class: mockAccountClass },
    session: { client_id: 'client', user_id: 'user', patient_id: 'user' },
  },
}));
jest.mock('../../util/AVAUtilities', () => ({
  dbClient: { get: jest.fn(), query: jest.fn(), put: jest.fn(), update: jest.fn() },
  cl: jest.fn(),
  recordExists: response => !!response?.Item,
  deepCopy: value => JSON.parse(JSON.stringify(value)),
}));
jest.mock('../../util/AVAStyles', () => ({ AVATextStyle: () => ({}), AVAclasses: () => ({}) }));
jest.mock('../sections/QuickSearch', () => () => null);

const source = {
  client_id: 'client', menu_id: 'group_control', menu_itemType: 'function',
  description: { short: 'Group Control' },
  available_to: ['*all'], color: '#ffffff',
  call: { target: 'ShowGroup', params: { defaults: { expand_parents: true }, options: { pSession: '<sessionRec>', pGroup_id: ['residents', '*all_public'] } } },
};
const input = label => label.startsWith('Function') ? screen.getByLabelText(label)
  : screen.getByText(label, { selector: 'label' }).parentElement.querySelector('input,textarea');

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountClass = 'master';
  document.createRange = () => ({ setStart: () => {}, setEnd: () => {}, commonAncestorContainer: document.body });
  dbClient.get.mockImplementation(({ Key }) => ({ promise: async () => ({
    ...(Key.menu_id === 'parent' ? { Item: { client_id: 'client', menu_id: 'parent', children: ['existing'], available_to: ['group:team'] } } : {}),
  }) }));
  dbClient.query.mockImplementation(() => ({ promise: async () => ({ Items: [source] }) }));
  dbClient.put.mockImplementation(() => ({ promise: async () => ({}) }));
  dbClient.update.mockImplementation(() => ({ promise: async () => ({}) }));
});

async function openFunction() {
  const onClose = jest.fn();
  render(<AddMenuItemDialog open client_id='client' parentMenuId='parent' onClose={onClose} />);
  await wait(() => expect(screen.getByText('Add').closest('button').disabled).toBe(false));
  fireEvent.change(input('Title'), { target: { value: 'New Function' } });
  fireEvent.click(screen.getByLabelText('Function'));
  await wait(() => expect(dbClient.query).toHaveBeenCalled());
  return onClose;
}

it.each(['admin', 'support', 'patient'])('does not offer Function to %s accounts or load copy sources', async accountClass => {
  mockAccountClass = accountClass;
  render(<AddMenuItemDialog open client_id='client' parentMenuId='parent' onClose={jest.fn()} />);
  await wait(() => expect(screen.getByText('Add').closest('button').disabled).toBe(false));
  expect(screen.queryByLabelText('Function')).not.toBeInTheDocument();
  expect(dbClient.query).not.toHaveBeenCalled();
});

it('creates the exact Function call with nested params and preserves standard card attributes', async () => {
  const onClose = await openFunction();
  const params = { options: { pSession: '<sessionRec>', pGroup_id: ['residents', '*all_public'] }, request: { currentOnly: true }, defaults: { expand_parents: false } };
  fireEvent.change(input('Function target'), { target: { value: ' ShowGroup ' } });
  fireEvent.change(input('Function params (JSON)'), { target: { value: JSON.stringify(params) } });
  fireEvent.change(screen.getByPlaceholderText('#rrggbb'), { target: { value: '#123456' } });
  fireEvent.click(screen.getByText('Add'));
  await wait(() => expect(onClose).toHaveBeenCalled());
  const item = dbClient.put.mock.calls[0][0].Item;
  expect(item).toMatchObject({
    client_id: 'client', menu_id: 'new_function', menu_itemType: 'function',
    description: { short: 'New Function', long: 'New Function' },
    available_to: ['person:user', 'group:team'], color: '#123456',
    call: { target: 'ShowGroup', params },
  });
  expect(item).not.toHaveProperty('children');
  expect(item).not.toHaveProperty('url');
  expect(dbClient.update.mock.calls[0][0].ExpressionAttributeValues[':c']).toEqual(['new_function', 'existing']);
  expect(onClose.mock.calls[0][0]).toMatchObject({ success: true, createdItems: [{ menuItemRec: item }] });
});

it.each(['{invalid', '[]', 'null', '"text"', 'false', '42', ''])('rejects invalid Function params %s without writing records', async value => {
  await openFunction();
  fireEvent.change(input('Function target'), { target: { value: 'ShowGroup' } });
  fireEvent.change(input('Function params (JSON)'), { target: { value } });
  fireEvent.click(screen.getByText('Add'));
  expect(await screen.findByText(/Params must be/)).toBeInTheDocument();
  expect(dbClient.put).not.toHaveBeenCalled();
  expect(dbClient.update).not.toHaveBeenCalled();
});

it('requires a target', async () => {
  await openFunction();
  fireEvent.click(screen.getByText('Add'));
  expect(await screen.findByText(/Please provide a target/)).toBeInTheDocument();
  expect(dbClient.put).not.toHaveBeenCalled();
});

it('loads every page of same-client Function entries, previews params, and copies only the call', async () => {
  const lastKey = { client_id: 'client', menu_id: 'last_page' };
  dbClient.query.mockImplementation(({ ExclusiveStartKey }) => ({
    promise: async () => ExclusiveStartKey ? { Items: [source] } : {
      Items: [
        { ...source, client_id: 'another_client', menu_id: 'foreign' },
        { ...source, menu_itemType: 'link', menu_id: 'link' },
      ], LastEvaluatedKey: lastKey,
    },
  }));
  const onClose = await openFunction();
  await wait(() => expect(dbClient.query).toHaveBeenCalledTimes(2));
  expect(dbClient.query.mock.calls[0][0]).toMatchObject({
    TableName: 'MenuV3', KeyConditionExpression: 'client_id = :client',
    ExpressionAttributeValues: { ':client': 'client', ':type': 'function' },
  });
  expect(dbClient.query.mock.calls[1][0].ExclusiveStartKey).toEqual(lastKey);
  fireEvent.mouseDown(screen.getByLabelText('Copy function from'));
  const option = await screen.findByRole('option');
  expect(screen.getAllByRole('option')).toHaveLength(1);
  fireEvent.mouseOver(within(option).getByText('Group Control (group_control)'));
  expect(await screen.findByText('Target: ShowGroup')).toBeInTheDocument();
  expect(screen.getByRole('tooltip').textContent).toContain('"expand_parents": true');
  fireEvent.click(option);
  expect(input('Function target').value).toBe('ShowGroup');
  expect(JSON.parse(input('Function params (JSON)').value)).toEqual(source.call.params);
  expect(input('Title').value).toBe('New Function');
  expect(screen.getByPlaceholderText('#rrggbb').value).toBe('');
  fireEvent.click(screen.getByText('Add'));
  await wait(() => expect(onClose).toHaveBeenCalled());
  expect(dbClient.put.mock.calls[0][0].Item.available_to).toEqual(['person:user', 'group:team']);
});

it('reports copy-list failures and supports retry without losing manual input', async () => {
  dbClient.query.mockImplementationOnce(() => ({ promise: async () => { throw new Error('offline'); } }));
  await openFunction();
  expect(await screen.findByText(/Unable to load Function menu items to copy/)).toBeInTheDocument();
  fireEvent.change(input('Function target'), { target: { value: 'FormFillB' } });
  fireEvent.click(screen.getByText('Retry'));
  await wait(() => expect(dbClient.query).toHaveBeenCalledTimes(2));
  await wait(() => expect(screen.queryByText(/Unable to load Function menu items to copy/)).not.toBeInTheDocument());
  expect(input('Function target').value).toBe('FormFillB');
  expect(cl).toHaveBeenCalled();
});

it.each(['put', 'update'])('reports %s failures without returning success', async operation => {
  const onClose = await openFunction();
  dbClient[operation].mockImplementationOnce(() => ({ promise: async () => { throw new Error('offline'); } }));
  fireEvent.change(input('Function target'), { target: { value: 'FormFillB' } });
  fireEvent.click(screen.getByText('Add'));
  expect(await screen.findByText(/Unable to finish adding the menu item/)).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByText('Add').closest('button').disabled).toBe(false);
});

it.each(['admin', 'support', undefined])('rejects nonmaster Function creation at validation for %s', accountClass => {
  expect(() => parseMenuFunctionCall({ accountClass, target: 'ShowGroup', paramsText: '{}' })).toThrow('Only master');
});

it.each([
  ['Sub-Menu', 'menu'],
  ['Document, Video, Picture, or Link', 'link'],
  ['Auto-dial Phone', 'link'],
])('preserves ordinary %s creation for administrative accounts', async (label, type) => {
  mockAccountClass = 'admin';
  const onClose = jest.fn();
  render(<AddMenuItemDialog open client_id='client' parentMenuId='parent' onClose={onClose} />);
  await wait(() => expect(screen.getByText('Add').closest('button').disabled).toBe(false));
  fireEvent.change(input('Title'), { target: { value: 'Ordinary Card' } });
  fireEvent.click(screen.getByLabelText(label));
  if (label === 'Document, Video, Picture, or Link') {
    fireEvent.change(input('URL'), { target: { value: 'https://example.com/document.pdf' } });
  } else if (label === 'Auto-dial Phone') {
    fireEvent.change(input('Phone Number'), { target: { value: '4235550123' } });
  }
  fireEvent.click(screen.getByText('Add'));
  await wait(() => expect(onClose).toHaveBeenCalled());
  const item = dbClient.put.mock.calls[0][0].Item;
  expect(item.menu_itemType).toBe(type);
  expect(item).not.toHaveProperty('call');
  if (type === 'menu') {
    expect(item.children).toEqual(['add_item_instructions']);
  } else {
    expect(item.url).toBe(label === 'Auto-dial Phone' ? 'tel:+14235550123' : 'https://example.com/document.pdf');
  }
  expect(dbClient.query).not.toHaveBeenCalled();
});
