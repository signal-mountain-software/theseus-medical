import React from 'react';
import { fireEvent, render, screen, wait, within } from '@testing-library/react';
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

// FormBuilder only models a specific set of attributes at the form/section/field level - anything
// else (e.g. a repeating section's "occurrences", which only FormFillB understands) must survive a
// round trip through the editor untouched instead of being silently dropped by buildFormRecord's
// from-scratch rebuild.
it('preserves form/section/field attributes it does not model across a save', async () => {
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Keeps Extras',
    options: { custom_form_flag: true },
    sections: [{
      section_name: 'Repeating', belongs_to_stage: 'complete', fields: ['answer'],
      occurrences: 3,
    }],
    fields: {
      answer: { type: 'text', prompt: 'Answer', custom_field_flag: 'keep-me' },
    },
    stages: [{ stage_name: 'complete' }],
  }} onClose={jest.fn()} />);

  await screen.findByDisplayValue('Answer');
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const item = putDb.mock.calls[0][0].Item;

  expect(item.options).toEqual({ custom_form_flag: true });
  expect(item.sections[0].occurrences).toBe(3);
  expect(item.fields.answer.custom_field_flag).toBe('keep-me');
  // Attributes FormBuilder DOES model still reflect the edited form, not stale raw copies.
  expect(item.sections[0].section_name).toBe('Repeating');
  expect(item.fields.answer.prompt).toBe('Answer');
});

// A field-level attribute FormBuilder manages only conditionally (show_if here) must not survive
// from the raw snapshot once the condition is removed through the editor - only genuinely
// unmanaged attributes (custom_field_flag) should pass through untouched.
it('clears a managed attribute through the editor instead of leaking it back in from the raw snapshot', async () => {
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Clears Managed',
    sections: [{ section_name: 'Section', belongs_to_stage: 'complete', fields: ['source', 'target'] }],
    fields: {
      source: { type: 'select', prompt: 'Source', value: { selection: { selectionList: ['a', 'b'], min: 0, max: 1 } } },
      target: { type: 'text', prompt: 'Target', custom_field_flag: 'keep-me', show_if: [{ field: 'source', values: ['a'] }] },
    },
  }} onClose={jest.fn()} />);

  fireEvent.click(await screen.findByText('Show if…'));
  const dialog = within(screen.getByText('Conditional Display').closest('[role="dialog"]'));
  fireEvent.click(dialog.getByLabelText('Delete conditional rule'));
  fireEvent.click(screen.getByText('Delete rule'));
  await wait(() => expect(screen.queryByText('Conditional Display')).not.toBeInTheDocument());

  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const item = putDb.mock.calls[0][0].Item;

  expect(item.fields.target).not.toHaveProperty('show_if');
  expect(item.fields.target.custom_field_flag).toBe('keep-me');
});
