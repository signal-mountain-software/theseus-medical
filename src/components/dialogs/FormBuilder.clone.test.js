import React from 'react';
import { fireEvent, render, screen, wait, within } from '@testing-library/react';
import FormBuilder from './FormBuilder';
import FormManagement from './FormManagement';
import { dbClient, getDb } from '../../util/AVAUtilities';

jest.mock('../../hooks/useSession', () => {
  const state = {
    user: { account_class: 'admin' },
    session: {
      client_id: 'client',
      client_name: 'Client',
      client_style: { sort_order: 'last_first' }
    }
  };
  return () => ({ state });
});
jest.mock('../../util/AVAUtilities', () => ({
  dbClient: { query: jest.fn(), put: jest.fn() },
  getDb: jest.fn(),
  putDb: jest.fn(),
  cl: jest.fn(),
  recordExists: result => !!result?.Items?.length,
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  uuid: () => 'clone-id',
  titleCase: value => value
}));
jest.mock('../../util/AVAStyles', () => ({ AVAclasses: () => ({}), AVATextStyle: () => ({}) }));
jest.mock('../../util/AVACalendars', () => ({ getEventMasterList: async () => [] }));
jest.mock('../../util/AVAGroups', () => ({ getMemberList: jest.fn() }));
jest.mock('../../util/AVAPeople', () => ({ getPerson: jest.fn(), getImage: jest.fn() }));
jest.mock('../../util/AVADateTime', () => ({
  makeDate: () => ({ numeric$: 20261026, numeric: 20261026, date: new Date(2026, 9, 26) }),
  addDays: () => ({ numeric$: 20271026 }),
  makeTime: jest.fn()
}));
jest.mock('../../util/AVADocuments', () => ({ createDocument: jest.fn() }));
jest.mock('../../util/AVAUploadFile', () => () => null);
jest.mock('../../util/AVAPeopleListExport', () => ({}));
jest.mock('./ExportFilterPrompt', () => () => null);
jest.mock('./PeopleMaintenance', () => () => null);
jest.mock('../forms/MessageForm', () => () => null);
jest.mock('../forms/FormFillB', () => () => null);
jest.mock('../sections/QuickSearch', () => () => null);

const original = {
  client_id: 'client',
  form_id: 'original',
  form_name: 'Original',
  category: 'Forms',
  active: true,
  sections: [],
  fields: {},
  stages: [],
  options: { dated_docs: true },
  customAttribute: 'preserve me'
};
const cloned = { ...original, form_id: 'form_clone-id', form_name: 'Copy of Original' };

beforeEach(() => {
  jest.clearAllMocks();
  Element.prototype.scrollIntoView = jest.fn();
  dbClient.query.mockImplementation(() => ({
    // Simulate an eventually consistent list query that does not yet contain the clone.
    promise: async () => ({ Items: [original] })
  }));
  dbClient.put.mockImplementation(() => ({ promise: async () => ({}) }));
  getDb.mockResolvedValue(original);
});

it('refreshes the standalone list and focuses the newly created raw copy', async () => {
  render(<FormBuilder />);
  fireEvent.click(await screen.findByTitle('Clone this form'));

  const copy = await screen.findByText('Copy of Original');
  const row = copy.closest('[tabindex="-1"]');
  await wait(() => expect(row.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' }), { timeout: 1000 });
  await wait(() => expect(row).toHaveFocus(), { timeout: 1000 });
  expect(row).toHaveAttribute('aria-current', 'true');
  expect(row.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  expect(dbClient.put).toHaveBeenCalledWith({ TableName: 'Forms', Item: cloned });
  expect(dbClient.query.mock.calls.filter(([spec]) => spec.TableName === 'Forms')).toHaveLength(2);
});

it('returns a clone to the parent list when cloning from the editor', async () => {
  const onClose = jest.fn();
  render(<FormBuilder directForm={original} onClose={onClose} />);
  fireEvent.click(await screen.findByText('Clone', { selector: 'button span' }));

  await wait(() => expect(onClose).toHaveBeenCalledWith(true, cloned, { focusForm: true }));
  expect(getDb).toHaveBeenCalledWith({
    Key: { client_id: 'client', form_id: 'original' },
    TableName: 'Forms'
  });
});

it('confirms unsaved edits, allows cancellation, and clones only the saved record', async () => {
  const onClose = jest.fn();
  render(<FormBuilder directForm={original} onClose={onClose} />);
  const nameInput = await screen.findByDisplayValue('Original');
  fireEvent.change(nameInput, { target: { value: 'Unsaved name' } });
  fireEvent.click(screen.getByText('Clone', { selector: 'button span' }));
  expect(dbClient.put).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('No, keep editing'));
  expect(nameInput).toHaveValue('Unsaved name');
  expect(onClose).not.toHaveBeenCalled();

  fireEvent.click(screen.getByText('Clone', { selector: 'button span' }));
  fireEvent.click(screen.getByText('Yes, clone and discard changes'));
  await wait(() => expect(onClose).toHaveBeenCalledWith(true, cloned, { focusForm: true }));
  expect(dbClient.put).toHaveBeenCalledWith({ TableName: 'Forms', Item: cloned });
});

it('leaves the editor open and reports a failed clone without success', async () => {
  dbClient.put.mockImplementation(() => ({ promise: async () => { throw new Error('write failed'); } }));
  const onClose = jest.fn();
  render(<FormBuilder directForm={original} onClose={onClose} />);
  fireEvent.click(await screen.findByText('Clone', { selector: 'button span' }));

  expect(await screen.findByText('Could not clone this form. Please try again.')).toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
  expect(screen.getByDisplayValue('Original')).toBeInTheDocument();
  expect(screen.getByText('Clone', { selector: 'button span' }).closest('button')).not.toBeDisabled();
});

it('returns to the standalone list after cloning from its editor', async () => {
  render(<FormBuilder />);
  fireEvent.click(await screen.findByText('Original'));
  fireEvent.click(await screen.findByText('Clone', { selector: 'button span' }));
  const copy = await screen.findByText('Copy of Original');
  await wait(() => expect(copy.closest('[aria-current="true"]')).toHaveFocus(), { timeout: 1000 });
  expect(screen.queryByText('Edit Form')).not.toBeInTheDocument();
});

it('does not leave the editor or create a copy when the saved form cannot be found', async () => {
  getDb.mockResolvedValue(null);
  const onClose = jest.fn();
  render(<FormBuilder directForm={original} onClose={onClose} />);
  fireEvent.click(await screen.findByText('Clone', { selector: 'button span' }));
  expect(await screen.findByText('Could not find a saved version of this form to clone - save it first.')).toBeInTheDocument();
  expect(dbClient.put).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

it('refreshes FormManagement, selects the clone, and moves focus to its row', async () => {
  dbClient.query.mockImplementation(({ TableName }) => ({
    promise: async () => ({ Items: TableName === 'Forms' ? [original] : [] })
  }));
  render(<FormManagement onClose={jest.fn()} />);
  const row = (await screen.findByText('Original')).closest('[tabindex="-1"]');
  fireEvent.click(row.querySelectorAll('svg')[1]);
  const editor = await screen.findByText('Edit Form');
  fireEvent.click(within(editor.closest('[role="dialog"]')).getByText('Clone', { selector: 'button span' }));

  const copies = await screen.findAllByText('Copy of Original');
  const copyRow = copies.map(copy => copy.closest('[aria-current="true"]')).find(Boolean);
  await wait(() => expect(copyRow).toHaveFocus(), { timeout: 1000 });
  expect(copyRow).toHaveAttribute('aria-current', 'true');
  expect(screen.queryByText('Edit Form')).not.toBeInTheDocument();
  expect(dbClient.query.mock.calls.filter(([spec]) => spec.TableName === 'Forms').length).toBeGreaterThanOrEqual(3);
  expect(dbClient.query).toHaveBeenCalledWith(expect.objectContaining({
    TableName: 'DocumentMaster',
    ExpressionAttributeValues: { ':p': 'client%%form_clone-id' }
  }));
});
