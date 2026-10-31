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

const openCondition = async ({ type = 'text', scope = 'field', rule = 'show_if', values = ['specific'], answerLimits } = {}) => {
  const condition = { [rule]: [{ field: 'source', values }] };
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Conditions',
    sections: [{
      section_name: 'Questions', fields: ['source', 'target'],
      ...(answerLimits ? { answer_limits: answerLimits } : {}),
      ...(scope === 'section' ? condition : {}),
    }],
    fields: {
      source: { type, prompt: 'Trigger', value: { selection: { selectionList: ['specific', 'other'], min: 0, max: 2 } } },
      target: { type: 'text', prompt: 'Target', ...(scope === 'field' ? condition : {}) },
    },
  }} onClose={jest.fn()} />);
  fireEvent.click(await screen.findByText(rule === 'show_if' ? 'Show if…' : rule === 'clear_if' ? 'Clear if…' : 'Ignore if…'));
  return within(screen.getByText('Conditional Display').closest('[role="dialog"]'));
};

const openLimits = () => {
  fireEvent.click(screen.getByLabelText('Section answer limits'));
  return within(screen.getByText('Section Answer Limits').closest('[role="dialog"]'));
};
const limitInput = (dialog, label) => dialog.getByText(label).parentElement.querySelector('input');

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
  ['field', 'clear_if'],
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
  expect(target).not.toHaveProperty('clear_if');
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

it('round trips a field clear_if rule without changing required handling', async () => {
  const dialog = await openCondition({ rule: 'clear_if', values: ['*'] });
  expect(dialog.getByLabelText('Clear this item when...')).toBeChecked();
  fireEvent.click(dialog.getByText('Save'));
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.fields.target.clear_if).toEqual([{ field: 'source', values: ['*'] }]);
  expect(putDb.mock.calls[0][0].Item.fields.target.required).toBe(false);
});

it('saves section answer limits and rejects inverted limits', async () => {
  const dialog = await openCondition({ scope: 'section' });
  fireEvent.click(dialog.getByText('Save'));
  const limits = openLimits();
  const input = label => limitInput(limits, label);
  fireEvent.change(input('Minimum answers'), { target: { value: '3' } });
  fireEvent.change(input('Maximum answers'), { target: { value: '2' } });
  fireEvent.click(limits.getByText('Save'));
  expect(putDb).not.toHaveBeenCalled();
  expect(screen.getByText(/minimum no greater than maximum/)).toBeInTheDocument();
  fireEvent.change(input('Minimum answers'), { target: { value: '1' } });
  fireEvent.click(limits.getByText('Save'));
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.sections[0].answer_limits).toEqual({ mode: 'fields', min: 1, max: 2 });
});

it.each([
  { mode: 'fields', min: 0 },
  { mode: 'selections', max: 3 },
])('round trips section limits %j', async answerLimits => {
  const dialog = await openCondition({ scope: 'section', answerLimits });
  fireEvent.click(dialog.getByText('Save'));
  const limits = openLimits();
  expect(limitInput(limits, 'Minimum answers').value).toBe(answerLimits.min === undefined ? '' : String(answerLimits.min));
  expect(limitInput(limits, 'Maximum answers').value).toBe(answerLimits.max === undefined ? '' : String(answerLimits.max));
  expect(limits.getByText(answerLimits.mode === 'fields' ? 'Answered fields' : 'Individual selections')).toBeInTheDocument();
  fireEvent.click(limits.getByText('Save'));
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.sections[0].answer_limits).toEqual(answerLimits);
});

it('removes section limits when both bounds are blank', async () => {
  const dialog = await openCondition({ scope: 'section', answerLimits: { mode: 'fields', min: 1, max: 3 } });
  fireEvent.click(dialog.getByText('Save'));
  const limits = openLimits();
  for (const label of ['Minimum answers', 'Maximum answers']) {
    fireEvent.change(limitInput(limits, label), { target: { value: '' } });
  }
  fireEvent.click(limits.getByText('Save'));
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.sections[0]).not.toHaveProperty('answer_limits');
});

it.each(['-1', '1.5', 'invalid', '9007199254740992'])('rejects invalid section answer bound %s', async value => {
  const dialog = await openCondition({ scope: 'section' });
  fireEvent.click(dialog.getByText('Save'));
  const limits = openLimits();
  fireEvent.change(limitInput(limits, 'Minimum answers'), { target: { value } });
  fireEvent.click(limits.getByText('Save'));
  expect(putDb).not.toHaveBeenCalled();
  expect(screen.getByText(/non-negative whole numbers/)).toBeInTheDocument();
});

it.each(['Cancel', 'Escape', 'backdrop'])('hides answer limits until requested and discards draft changes with %s', async exit => {
  const dialog = await openCondition({ scope: 'section', answerLimits: { mode: 'fields', min: 1, max: 3 } });
  fireEvent.click(dialog.getByText('Save'));
  expect(screen.queryByText('Minimum answers')).not.toBeInTheDocument();
  expect(screen.queryByText('Count answers by')).not.toBeInTheDocument();
  const limits = openLimits();
  fireEvent.change(limitInput(limits, 'Minimum answers'), { target: { value: '2' } });
  if (exit === 'Cancel') {
    fireEvent.click(limits.getByText('Cancel'));
  } else if (exit === 'Escape') {
    fireEvent.keyDown(screen.getByText('Section Answer Limits').closest('[role="dialog"]'), { key: 'Escape', keyCode: 27 });
  } else {
    const container = screen.getByText('Section Answer Limits').closest('.MuiDialog-container');
    fireEvent.mouseDown(container);
    fireEvent.mouseUp(container);
  }
  expect(screen.queryByText('Section Answer Limits')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.sections[0].answer_limits).toEqual({ mode: 'fields', min: 1, max: 3 });
});

it('confirms deleting section limits and leaves individual field rules intact', async () => {
  const dialog = await openCondition({ type: 'select', scope: 'section', answerLimits: { mode: 'fields', min: 1, max: 3 } });
  fireEvent.click(dialog.getByText('Save'));
  const limits = openLimits();
  fireEvent.click(limits.getByLabelText('Delete section answer limits'));
  fireEvent.click(screen.getByText('Keep limits'));
  expect(limitInput(limits, 'Minimum answers').value).toBe('1');
  fireEvent.click(limits.getByLabelText('Delete section answer limits'));
  fireEvent.click(screen.getByText('Delete limits'));
  expect(screen.queryByText('Section Answer Limits')).not.toBeInTheDocument();
  expect(putDb).not.toHaveBeenCalled();
  const reopened = openLimits();
  expect(reopened.queryByLabelText('Delete section answer limits')).not.toBeInTheDocument();
  expect(limitInput(reopened, 'Minimum answers').value).toBe('');
  fireEvent.click(reopened.getByText('Cancel'));
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const saved = putDb.mock.calls[0][0].Item;
  expect(saved.sections[0]).not.toHaveProperty('answer_limits');
  expect(saved.fields.source.value.selection.min).toBe(0);
  expect(saved.fields.source.value.selection.max).toBe(2);
});

it.each([
  ['field', 'message'], ['field', 'notification'], ['field', 'groups'],
  ['section', 'message'], ['section', 'notification'], ['section', 'groups'],
  ['form', 'message'], ['form', 'notification'], ['form', 'groups'],
])('confirms deleting a %s completion %s rule while preserving other rules', async (scope, label) => {
  const kind = label === 'message' ? 'on_complete_message' : label === 'notification' ? 'on_complete_notify' : 'on_complete_groups';
  const content = label === 'groups' ? { add: ['group1'] } : { text: 'Rule content' };
  const target = { ...content, ...(scope === 'field' ? { showIf: [{ field: 'source', values: ['specific'] }] } : {}) };
  const other = { ...content, showIf: [{ field: 'source', values: ['other'] }] };
  const locked = { ...content, custom: 'Preserve this unsupported rule' };
  const stageName = scope === 'form' ? 'complete' : 'default';
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Completion Rules',
    stages: [{ stage_name: stageName, [kind]: [target, other, locked] }],
    sections: [{ section_name: 'Questions', belongs_to_stage: 'default', fields: ['source'] }],
    fields: { source: { type: 'select', prompt: 'Trigger', value: { selection: { selectionList: ['specific', 'other'], min: 0, max: 2 } } } },
  }} onClose={jest.fn()} />);
  const iconTitle = scope === 'field' ? `Edit ${label} rule for "specific"`
    : scope === 'section' ? `Edit an unconditional ${label} rule for this section`
      : `Edit a ${label} rule for when the entire form is completed`;
  fireEvent.click(await screen.findByTitle(new RegExp(iconTitle)));
  const kindLabel = label[0].toUpperCase() + label.slice(1);
  const dialog = within(screen.getByText(`${scope === 'form' ? 'Form Complete: ' : ''}${kindLabel} Rule`).closest('[role="dialog"]'));
  fireEvent.click(dialog.getByLabelText('Delete completion rule'));
  expect(putDb).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Keep rule'));
  expect(dialog.getByLabelText('Delete completion rule')).toBeInTheDocument();
  fireEvent.click(dialog.getByLabelText('Delete completion rule'));
  fireEvent.click(screen.getByText('Delete rule'));
  expect(screen.queryByLabelText('Delete completion rule')).not.toBeInTheDocument();
  expect(putDb).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const stage = putDb.mock.calls[0][0].Item.stages.find(s => s.stage_name === stageName);
  expect(stage[kind]).toHaveLength(2);
  expect(stage[kind]).toEqual(expect.arrayContaining([expect.objectContaining(other), locked]));
  expect(stage[kind]).not.toContainEqual(target);
});

it.each(['on_complete_message', 'on_complete_notify', 'on_complete_groups'])('omits %s after deleting its last rule', async kind => {
  const label = kind === 'on_complete_message' ? 'message' : kind === 'on_complete_notify' ? 'notification' : 'groups';
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Completion Rules',
    stages: [{ stage_name: 'default', [kind]: [kind === 'on_complete_groups' ? { add: ['group1'] } : { text: 'Rule content' }] }],
    sections: [{ section_name: 'Questions', belongs_to_stage: 'default', fields: ['source'] }],
    fields: { source: { type: 'text', prompt: 'Trigger' } },
  }} onClose={jest.fn()} />);
  fireEvent.click(await screen.findByTitle(new RegExp(`Edit an unconditional ${label} rule for this section`)));
  fireEvent.click(screen.getByLabelText('Delete completion rule'));
  fireEvent.click(screen.getByText('Delete rule'));
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.stages.find(s => s.stage_name === 'default')).not.toHaveProperty(kind);
});

it('offers answer limits from a collapsed section and saves a new selections limit only on Save', async () => {
  const dialog = await openCondition({ scope: 'section' });
  fireEvent.click(dialog.getByText('Save'));
  fireEvent.click(screen.getByTitle('Collapse section'));
  const limits = openLimits();
  expect(limits.queryByLabelText('Delete section answer limits')).not.toBeInTheDocument();
  fireEvent.mouseDown(limits.getByText('Answered fields'));
  fireEvent.click(screen.getByRole('option', { name: 'Individual selections' }));
  fireEvent.change(limitInput(limits, 'Maximum answers'), { target: { value: '3' } });
  expect(putDb).not.toHaveBeenCalled();
  fireEvent.click(limits.getByText('Save'));
  expect(screen.queryByText('Maximum answers')).not.toBeInTheDocument();
  expect(screen.getByTitle('Edit section answer limits')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  expect(putDb.mock.calls[0][0].Item.sections[0].answer_limits).toEqual({ mode: 'selections', max: 3 });
});
