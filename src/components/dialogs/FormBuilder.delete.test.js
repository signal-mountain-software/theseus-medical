import React from 'react';
import { fireEvent, render, screen, wait } from '@testing-library/react';
import FormBuilder from './FormBuilder';
import { putDb } from '../../util/AVAUtilities';
import { findFormReferences, softDeleteForm } from '../../util/AVAForms';

const mockState = {
  user: { account_class: 'admin' },
  session: { client_id: 'client', user_id: 'tech1' }
};
jest.mock('../../hooks/useSession', () => () => ({ state: mockState }));
jest.mock('../../util/AVAUtilities', () => ({
  dbClient: { query: jest.fn(() => ({ promise: async () => ({ Items: [] }) })), put: jest.fn() },
  getDb: jest.fn(),
  putDb: jest.fn(),
  cl: jest.fn(),
  recordExists: result => !!result?.Items?.length,
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  uuid: () => 'new-id',
  titleCase: value => value
}));
jest.mock('../../util/AVAForms', () => {
  const actual = jest.requireActual('../../util/AVAForms');
  return { ...actual, findFormReferences: jest.fn(), softDeleteForm: jest.fn() };
});
jest.mock('../../util/AVAStyles', () => ({ AVAclasses: () => ({}), AVATextStyle: () => ({}) }));
jest.mock('../../util/AVACalendars', () => ({ getEventMasterList: async () => [] }));
jest.mock('../forms/FormFillB', () => () => null);
jest.mock('../sections/QuickSearch', () => () => null);

const form = { client_id: 'client', form_id: 'form_1', form_name: 'Intake', category: 'Forms', sections: [], stages: [] };
const noRefs = { documentCount: 0, groups: [], events: [], menus: [], errors: [] };

beforeEach(() => {
  jest.clearAllMocks();
  mockState.user.account_class = 'admin';
  document.createRange = () => ({ setStart: () => {}, setEnd: () => {}, commonAncestorContainer: document.body });
});

const deleteButton = () => screen.queryByText('Delete', { selector: 'button span' });

it('treats a missing active attribute as active and stores the inverse of "Inactive Form?"', async () => {
  const onClose = jest.fn();
  render(<FormBuilder directForm={form} onClose={onClose} />);
  const checkbox = (await screen.findByText('Inactive Form?')).closest('label').querySelector('input');
  expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.active).toBe(false);
});

it('hides Delete from non-admins and for unsaved new forms', async () => {
  mockState.user.account_class = 'user';
  const { unmount } = render(<FormBuilder directForm={form} onClose={jest.fn()} />);
  await screen.findByText('Inactive Form?');
  expect(deleteButton()).toBeNull();
  unmount();

  mockState.user.account_class = 'admin';
  render(<FormBuilder directForm='new' onClose={jest.fn()} />);
  await screen.findByText('Inactive Form?');
  expect(deleteButton()).toBeNull();
});

it('blocks the delete and lists what uses the form', async () => {
  findFormReferences.mockResolvedValue({ ...noRefs, documentCount: 2, groups: [{ id: 'g1', name: 'Nurses' }] });
  render(<FormBuilder directForm={form} onClose={jest.fn()} />);
  await screen.findByText('Inactive Form?');
  fireEvent.click(deleteButton());
  expect(await screen.findByText('This form cannot be deleted')).toBeInTheDocument();
  expect(screen.getByText('2 documents created from this form')).toBeInTheDocument();
  expect(screen.getByText('Nurses')).toBeInTheDocument();
  expect(screen.queryByText('Delete Form')).toBeNull();
  expect(softDeleteForm).not.toHaveBeenCalled();
});

it('requires the exact form name, re-checks, then soft deletes', async () => {
  findFormReferences.mockResolvedValue(noRefs);
  softDeleteForm.mockResolvedValue({ ...form, client_id: 'client~deleted' });
  const onClose = jest.fn();
  render(<FormBuilder directForm={form} onClose={onClose} />);
  await screen.findByText('Inactive Form?');
  fireEvent.click(deleteButton());
  const input = await screen.findByLabelText('Type the form name to confirm');
  const confirm = screen.getByText('Delete Form').closest('button');
  expect(confirm).toBeDisabled();
  fireEvent.change(input, { target: { value: 'intake' } });
  expect(confirm).toBeDisabled();
  fireEvent.change(input, { target: { value: 'Intake' } });
  expect(confirm).not.toBeDisabled();
  fireEvent.click(confirm);
  await wait(() => expect(onClose).toHaveBeenCalledWith(true, expect.objectContaining({ form_id: 'form_1', client_id: 'client' }), { deleted: true }));
  expect(findFormReferences).toHaveBeenCalledTimes(2);
  expect(softDeleteForm).toHaveBeenCalledWith({ client_id: 'client', form_id: 'form_1', deleted_by: 'tech1' });
});
