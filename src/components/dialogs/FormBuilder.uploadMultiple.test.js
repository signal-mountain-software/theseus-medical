import React from 'react';
import { fireEvent, render, screen, wait } from '@testing-library/react';
import FormBuilder from './FormBuilder';
import { putDb } from '../../util/AVAUtilities';

jest.mock('../../hooks/useSession', () => () => ({
  state: { user: { account_class: 'admin' }, session: { client_id: 'client' } },
}));
jest.mock('../../util/AVAUtilities', () => ({
  dbClient: { query: jest.fn(() => ({ promise: async () => ({ Items: [] }) })) },
  putDb: jest.fn(),
  cl: jest.fn(),
  recordExists: result => !!result?.Items?.length,
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  uuid: jest.fn(() => String(Math.random())),
  titleCase: value => value,
}));
jest.mock('../../util/AVAStyles', () => ({ AVAclasses: () => ({}), AVATextStyle: () => ({}) }));
jest.mock('../../util/AVACalendars', () => ({ getEventMasterList: async () => [] }));
jest.mock('../forms/FormFillB', () => () => null);
jest.mock('../sections/QuickSearch', () => () => null);

beforeEach(() => {
  jest.clearAllMocks();
  document.createRange = () => ({ setStart: () => {}, setEnd: () => {}, commonAncestorContainer: document.body });
});

// FormFillB treats prompt.oneOnly as true whenever it's MISSING, not just when explicitly true -
// so checking "Allow multiple files to be uploaded?" must write an explicit oneOnly:false, and
// leaving it unchecked must omit oneOnly entirely rather than ever writing oneOnly:true.
it('writes prompt.oneOnly:false when "Allow multiple files to be uploaded?" is checked', async () => {
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Upload Form',
    sections: [{ section_name: 'Section', belongs_to_stage: 'complete', fields: ['photos'] }],
    fields: { photos: { type: 'upload', prompt: 'Photos' } },
  }} onClose={jest.fn()} />);

  const checkbox = await screen.findByLabelText('Allow multiple files to be uploaded?');
  expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();

  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const item = putDb.mock.calls[0][0].Item;

  expect(item.fields.photos.prompt).toEqual({ value: 'Photos', oneOnly: false });
});

it('omits oneOnly (rather than writing oneOnly:true) when left unchecked', async () => {
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Upload Form',
    sections: [{ section_name: 'Section', belongs_to_stage: 'complete', fields: ['photos'] }],
    fields: { photos: { type: 'upload', prompt: 'Photos' } },
  }} onClose={jest.fn()} />);

  await screen.findByLabelText('Allow multiple files to be uploaded?');
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const item = putDb.mock.calls[0][0].Item;

  expect(item.fields.photos.prompt).toBe('Photos');
});

it('pre-checks the control when the field already has prompt.oneOnly:false, and unchecking it removes oneOnly', async () => {
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Upload Form',
    sections: [{ section_name: 'Section', belongs_to_stage: 'complete', fields: ['photos'] }],
    fields: { photos: { type: 'upload', prompt: { value: 'Photos', oneOnly: false } } },
  }} onClose={jest.fn()} />);

  const checkbox = await screen.findByLabelText('Allow multiple files to be uploaded?');
  expect(checkbox).toBeChecked();
  fireEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();

  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const item = putDb.mock.calls[0][0].Item;

  expect(item.fields.photos.prompt).toBe('Photos');
});
