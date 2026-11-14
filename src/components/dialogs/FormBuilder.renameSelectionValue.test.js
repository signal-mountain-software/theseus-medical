import React from 'react';
import { fireEvent, render, screen, wait, within } from '@testing-library/react';
import FormBuilder from './FormBuilder';
import { putDb } from '../../util/AVAUtilities';

// The selection-value TextFields render with no label, so scope queries to the "Values to choose
// from:" block (there's exactly one per select-type field in these tests) rather than relying on
// a display value being unique across the whole form.
const getSelectionValueInputs = async () => {
  const label = await screen.findByText('Values to choose from:');
  const outerBox = label.closest('div').parentElement;
  return within(outerBox).getAllByRole('textbox');
};

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

// Covers the "renamed selection orphans its rules" scenario: field_a (a select field) has a
// value renamed from "one" to "won". Every rule that tested field_a for "one" - another field's
// Conditional Display condition, the owning section's own condition, and a stage-level
// on_complete_message rule - should be re-pointed at "won" instead of silently going stale.
it('re-points every rule testing a renamed selection value at its new spelling', async () => {
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Rename Rule',
    sections: [{
      section_name: 'Section', belongs_to_stage: 'complete', fields: ['field_a', 'target'],
      show_if: [{ field: 'field_a', values: ['one'] }],
    }],
    fields: {
      field_a: { type: 'select', prompt: 'Pick one', value: { selection: { selectionList: ['one', 'two', 'three'], min: 0, max: 1 } } },
      target: { type: 'text', prompt: 'Target', show_if: [{ field: 'field_a', values: ['one'] }] },
    },
    stages: [{
      stage_name: 'complete',
      on_complete_message: [{ showIf: [{ field: 'field_a', values: ['one'] }], text: 'Hi', recipientList: ['pertains_to'] }],
    }],
  }} onClose={jest.fn()} />);

  const [oneInput] = await getSelectionValueInputs();
  fireEvent.change(oneInput, { target: { value: 'won' } });

  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const item = putDb.mock.calls[0][0].Item;

  expect(item.fields.field_a.value.selection.selectionList).toEqual(['won', 'two', 'three']);
  expect(item.fields.target.show_if).toEqual([{ field: 'field_a', values: ['won'] }]);
  expect(item.sections[0].show_if).toEqual([{ field: 'field_a', values: ['won'] }]);
  expect(item.stages.find(stage => stage.stage_name === 'complete').on_complete_message[0].showIf).toEqual([
    { field: 'field_a', values: ['won'] },
  ]);
});

it('leaves rules alone when a blank selection row is simply filled in', async () => {
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Blank Fill',
    sections: [{ section_name: 'Section', belongs_to_stage: 'complete', fields: ['field_a', 'target'] }],
    fields: {
      field_a: { type: 'select', prompt: 'Pick one', value: { selection: { selectionList: ['one', ''], min: 0, max: 1 } } },
      target: { type: 'text', prompt: 'Target', show_if: [{ field: 'field_a', values: ['one'] }] },
    },
  }} onClose={jest.fn()} />);

  const inputs = await getSelectionValueInputs();
  fireEvent.change(inputs[1], { target: { value: 'two' } });

  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const item = putDb.mock.calls[0][0].Item;

  expect(item.fields.field_a.value.selection.selectionList).toEqual(['one', 'two']);
  expect(item.fields.target.show_if).toEqual([{ field: 'field_a', values: ['one'] }]);
});
