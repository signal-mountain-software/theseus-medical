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

const openCondition = async ({ type = 'text', scope = 'field', rule = 'show_if', values = ['specific'] } = {}) => {
  const condition = { [rule]: [{ field: 'source', values }] };
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Conditions',
    sections: [{
      section_name: 'Questions', fields: ['source', 'target'],
      ...(scope === 'section' ? condition : {}),
    }],
    fields: {
      source: { type, prompt: 'Trigger', value: { selection: { selectionList: ['specific', 'other'], min: 0, max: 2 } } },
      target: { type: 'text', prompt: 'Target', ...(scope === 'field' ? condition : {}) },
    },
  }} onClose={jest.fn()} />);
  fireEvent.click(await screen.findByText(rule === 'show_if' ? 'Show if…' : 'Ignore if…'));
  return within(screen.getByText('Conditional Display').closest('[role="dialog"]'));
};

it.each(['text', 'yes/no', 'select', 'select&text', 'date', 'number'])('offers any non-blank value for %s triggers and preserves specific values', async type => {
  const dialog = await openCondition({ type });
  const anyValue = dialog.getByLabelText('...is not blank, or');
  expect(anyValue).not.toBeChecked();
  fireEvent.click(anyValue);
  expect(anyValue).toBeChecked();
  fireEvent.click(dialog.getByText('Save'));
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.fields.target.show_if).toEqual([
    { field: 'source', values: ['*', 'specific'] },
  ]);
});

it.each(['field', 'section'])('loads and removes the wildcard from %s ignore conditions', async scope => {
  const dialog = await openCondition({ scope, rule: 'ignore_if', values: ['*', 'specific'] });
  const anyValue = dialog.getByLabelText('...is not blank, or');
  expect(anyValue).toBeChecked();
  expect(dialog.getByPlaceholderText('Enter each triggering value on its own line')).toHaveValue('specific');
  fireEvent.click(anyValue);
  fireEvent.click(dialog.getByText('Save'));
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const saved = putDb.mock.calls[0][0].Item;
  expect((scope === 'field' ? saved.fields.target : saved.sections[0]).ignore_if).toEqual([
    { field: 'source', values: ['specific'] },
  ]);
});

it('preserves the wildcard when editing specific text values', async () => {
  const dialog = await openCondition({ values: ['*'] });
  const input = dialog.getByPlaceholderText('Enter each triggering value on its own line');
  expect(input).toHaveValue('');
  fireEvent.change(input, { target: { value: 'new value' } });
  fireEvent.blur(input);
  expect(dialog.getByLabelText('...is not blank, or')).toBeChecked();
  fireEvent.click(dialog.getByText('Save'));
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.fields.target.show_if[0].values).toEqual(['*', 'new value']);
});

it.each([
  ['field', 'show_if'],
  ['field', 'ignore_if'],
  ['section', 'show_if'],
  ['section', 'ignore_if'],
])('confirms deletion of a %s %s rule and omits it from the saved form', async (scope, rule) => {
  const dialog = await openCondition({ scope, rule });
  fireEvent.click(dialog.getByLabelText('Delete conditional rule'));
  expect(putDb).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Keep rule'));
  expect(dialog.getByLabelText('Delete conditional rule')).toBeInTheDocument();
  expect(dialog.getByPlaceholderText('Enter each triggering value on its own line')).toHaveValue('specific');
  fireEvent.click(dialog.getByLabelText('Delete conditional rule'));
  fireEvent.click(screen.getByText('Delete rule'));
  await wait(() => expect(screen.queryByText('Conditional Display')).not.toBeInTheDocument());
  expect(putDb).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const saved = putDb.mock.calls[0][0].Item;
  const target = scope === 'field' ? saved.fields.target : saved.sections[0];
  expect(target).not.toHaveProperty('show_if');
  expect(target).not.toHaveProperty('ignore_if');
  expect(saved.fields.target.prompt).toBe('Target');
  expect(saved.sections[0].fields).toEqual(['source', 'target']);
});

it('rejects a trigger field without a test value and lets Cancel discard the unfinished rule', async () => {
  const dialog = await openCondition({ values: [] });
  fireEvent.click(dialog.getByText('Save'));
  expect(dialog.getByText('Check "is not blank" or provide at least one value to test against.')).toBeInTheDocument();
  expect(screen.getByText('Conditional Display')).toBeInTheDocument();
  fireEvent.click(dialog.getByText('Cancel'));
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.fields.target).not.toHaveProperty('show_if');
});

it('discards changes to an existing rule when Cancel is clicked', async () => {
  const dialog = await openCondition();
  fireEvent.click(dialog.getByLabelText('...is not blank, or'));
  fireEvent.change(dialog.getByPlaceholderText('Enter each triggering value on its own line'), {
    target: { value: 'replacement' },
  });
  fireEvent.click(dialog.getByText('Cancel'));
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.fields.target.show_if).toEqual([
    { field: 'source', values: ['specific'] },
  ]);
});

it('accepts a wildcard-only rule without specific values', async () => {
  const dialog = await openCondition({ values: [] });
  fireEvent.click(dialog.getByLabelText('...is not blank, or'));
  fireEvent.click(dialog.getByText('Save'));
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.fields.target.show_if[0].values).toEqual(['*']);
});

it('allows Escape to discard edits', async () => {
  const dialog = await openCondition();
  fireEvent.click(dialog.getByLabelText('...is not blank, or'));
  fireEvent.keyDown(screen.getByText('Conditional Display').closest('[role="dialog"]'), { key: 'Escape', keyCode: 27 });
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.fields.target.show_if[0].values).toEqual(['specific']);
});
