import React from 'react';
import { fireEvent, render, screen, wait } from '@testing-library/react';
import FormFillB from './FormFillB';
import { dbClient } from '../../util/AVAUtilities';

jest.mock('../../hooks/useSession', () => () => ({
  state: {
    user: { account_class: 'admin', customizations: {} },
    session: { client_id: 'client', patient_id: 'person', client_style: {}, client_name: 'Client' },
    patient: { name: { first: 'Test', last: 'Person' } },
  },
  dispatch: jest.fn(),
}));
jest.mock('../../hooks/useDarkMode', () => () => false);
jest.mock('@material-ui/core/styles/makeStyles', () => () => () => ({}));
jest.mock('use-sound', () => () => [jest.fn()]);
jest.mock('react-idle-timer', () => ({ useIdleTimer: () => ({ start: jest.fn(), reset: jest.fn(), pause: jest.fn() }) }));
jest.mock('../../util/AVAUtilities', () => ({
  dbClient: { get: jest.fn(() => ({ promise: async () => ({}) })) },
  getDb: async ({ TableName }) => TableName === 'People'
    ? { person_id: 'person', name: { first: 'Test', last: 'Person' }, groups: [] } : null,
  cl: jest.fn(),
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  isEmpty: value => value == null || value === '' || (Array.isArray(value) && !value.length),
  makeArray: value => value == null ? [] : [value].flat(),
  isObject: value => value !== null && typeof value === 'object' && !Array.isArray(value),
  recordExists: value => !!value?.Item,
  titleCase: value => value,
  isMobile: () => false,
  uuid: () => 'id',
  array_in_array: (a, b) => a.some(value => b.includes(value)),
  booleanLikeToken: value => [true, 'true', 'yes'].includes(value) ? true : [false, 'false', 'no'].includes(value) ? false : null,
  listFromArray: values => values.join(', '),
}));
jest.mock('../../util/AVAStyles', () => ({ AVAclasses: () => ({}), AVATextStyle: () => ({}) }));
jest.mock('../../util/AVATasks', () => ({}));
jest.mock('../../util/AVAGroups', () => ({}));
jest.mock('../../util/AVAPeople', () => ({ makeName: () => 'Test Person' }));
jest.mock('../../util/AVADateTime', () => ({
  makeDate: () => ({ numeric$: 20261030, numeric: 20261030, date: new Date(), absolute: 'Today' }),
  makeTime: () => ({}),
}));
jest.mock('../../util/AVAMessages', () => ({}));
jest.mock('../../util/AVADocuments', () => ({}));
jest.mock('../../util/AVACalendars', () => ({}));
jest.mock('../../util/AVANotifications', () => ({}));
jest.mock('../../util/AVASessionSync', () => ({}));
jest.mock('../../util/AVAUploadFile', () => () => null);

const form = {
  form_id: 'form', form_name: 'Answer Rules', options: {},
  stages: [{ stage_name: 'default' }],
  sections: [{
    section_name: 'Choices', fields: ['a', 'b'], belongs_to_stage: 'default',
    answer_limits: { mode: 'fields', min: 1, max: 1 },
  }],
  fields: {
    a: { type: 'text', prompt: 'Question A', clear_if: [{ field: 'b', values: ['*'] }] },
    b: { type: 'text', prompt: 'Question B', clear_if: [{ field: 'a', values: ['*'] }] },
  },
};

const inputFor = (text, index = 0) => screen.getAllByText(text)[index].closest('p').parentElement.querySelector('input,textarea');

it('clears the older answer on text edits while retaining the newest answer', async () => {
  render(<FormFillB request={{ form_id: 'form', person_id: 'person', previewFormRec: form }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  fireEvent.blur(inputFor('Question A'), { target: { value: 'First answer' } });
  await wait(() => expect(inputFor('Question A').value).toBe('First answer'));
  fireEvent.blur(inputFor('Question B'), { target: { value: 'Second answer' } });
  await wait(() => expect(inputFor('Question A').value).toBe(''));
  expect(inputFor('Question B').value).toBe('Second answer');
  expect(screen.getByText(/Cleared related answers/)).toBeInTheDocument();
});

it('validates the section minimum without making individual fields required', async () => {
  render(<FormFillB request={{ form_id: 'form', previewFormRec: form }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  expect(screen.queryByText(/currently \d/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Finish'));
  expect(await screen.findByText('"Choices" requires at least 1 answered fields; currently 0.')).toBeInTheDocument();
  expect(screen.queryByText(/Question A is required/)).not.toBeInTheDocument();
});

it('retains a saved cleared answer instead of restoring its default on opening', async () => {
  dbClient.get.mockReturnValueOnce({ promise: async () => ({
    Item: {
      document_id: 'doc', form_type: 'form', pertains_to: 'person', status: 'in_process',
      field_values: { a: '', b: 'Kept' }, history: [],
    },
  }) });
  const withDefault = { ...form, fields: { ...form.fields, a: { ...form.fields.a, default: { value: 'Prefilled' } } } };
  render(<FormFillB request={{ document_id: 'doc', form_id: 'form', previewFormRec: withDefault }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  expect(inputFor('Question A').value).toBe('');
  expect(inputFor('Question B').value).toBe('Kept');
});

it('clears a pending text edit when a newer checkbox selection is made', async () => {
  const mixed = {
    ...form, fields: { ...form.fields, b: {
      ...form.fields.b, type: 'select', value: { selectionList: ['Latest choice'], max: 3 },
    } },
  };
  render(<FormFillB request={{ form_id: 'form', previewFormRec: mixed }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  fireEvent.blur(inputFor('Question A'), { target: { value: 'Pending' } });
  fireEvent.mouseDown(screen.getByLabelText('b_0'));
  await wait(() => expect(inputFor('Question A').value).toBe(''));
  expect(screen.getByLabelText('b_0').querySelector('input').checked).toBe(true);
});

it('treats a custom Other answer as nonblank when triggering a clear rule', async () => {
  const custom = { ...form, fields: { ...form.fields, b: {
    ...form.fields.b, type: 'select&text', value: { selectionList: ['Standard choice'], max: 3 },
  } } };
  render(<FormFillB request={{ form_id: 'form', previewFormRec: custom }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  fireEvent.blur(inputFor('Question A'), { target: { value: 'Previous' } });
  await wait(() => expect(inputFor('Question A').value).toBe('Previous'));
  fireEvent.change(screen.getByPlaceholderText('other'), { target: { value: 'My custom choice' } });
  await wait(() => expect(inputFor('Question A').value).toBe(''));
  expect(screen.getByPlaceholderText('other').value).toBe('My custom choice');
});

it('counts selections across fields without silently removing answers over the section maximum', async () => {
  const selections = {
    ...form,
    sections: [{ ...form.sections[0], answer_limits: { mode: 'selections', max: 2 } }],
    fields: {
      a: { type: 'select', prompt: 'Question A', value: { selectionList: ['A', 'B'], max: 3 } },
      b: { type: 'select', prompt: 'Question B', value: { selectionList: ['C'], max: 3 } },
    },
  };
  render(<FormFillB request={{ form_id: 'form', previewFormRec: selections }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  for (const label of ['a_0', 'a_1', 'b_0']) {
    fireEvent.mouseDown(screen.getByLabelText(label));
  }
  for (const label of ['a_0', 'a_1', 'b_0']) {
    expect(screen.getByLabelText(label).querySelector('input').checked).toBe(true);
  }
  expect(screen.queryByText(/currently \d/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Finish'));
  expect(await screen.findByText('"Choices" allows at most 2 answers/selections; currently 3.')).toBeInTheDocument();
});

it('keeps clear rules and answer limits independent for each repeating section occurrence', async () => {
  dbClient.get.mockReturnValueOnce({ promise: async () => ({
    Item: {
      document_id: 'doc', form_type: 'form', pertains_to: 'person', status: 'in_process',
      field_values: { a: 'First occurrence', b: '', a_occ2: 'Second occurrence', b_occ2: '' }, history: [],
    },
  }) });
  const repeating = { ...form, sections: [{ ...form.sections[0], section_name: 'Choices 1', occurrences: 2 }] };
  render(<FormFillB request={{ document_id: 'doc', form_id: 'form', previewFormRec: repeating }} onClose={jest.fn()} />);
  await screen.findByText('Choices 2');
  fireEvent.blur(inputFor('Question B', 1), { target: { value: 'Newest second answer' } });
  await wait(() => expect(inputFor('Question A', 1).value).toBe(''));
  expect(inputFor('Question A').value).toBe('First occurrence');
  expect(inputFor('Question B', 1).value).toBe('Newest second answer');
  fireEvent.click(screen.getByText('Finish'));
  expect(await screen.findByText('This form is complete!')).toBeInTheDocument();
});

it('excludes conditionally hidden fields from section counts', async () => {
  dbClient.get.mockReturnValueOnce({ promise: async () => ({
    Item: {
      document_id: 'doc', form_type: 'form', pertains_to: 'person', status: 'in_process',
      field_values: { a: 'Visible', b: 'Hidden' }, history: [],
    },
  }) });
  const conditional = { ...form, fields: {
    a: { type: 'text', prompt: 'Question A' },
    b: { type: 'text', prompt: 'Question B', ignore_if: [{ field: 'a', values: ['*'] }] },
  } };
  render(<FormFillB request={{ document_id: 'doc', form_id: 'form', previewFormRec: conditional }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  expect(screen.queryByText('Question B')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Finish'));
  expect(await screen.findByText('This form is complete!')).toBeInTheDocument();
});

it('validates the section maximum when multiple independent fields are answered', async () => {
  const independent = {
    ...form, fields: {
      a: { type: 'text', prompt: 'Question A' },
      b: { type: 'text', prompt: 'Question B' },
    },
  };
  render(<FormFillB request={{ form_id: 'form', previewFormRec: independent }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  fireEvent.blur(inputFor('Question A'), { target: { value: 'A' } });
  await wait(() => expect(inputFor('Question A').value).toBe('A'));
  fireEvent.blur(inputFor('Question B'), { target: { value: 'B' } });
  await wait(() => expect(inputFor('Question B').value).toBe('B'));
  fireEvent.click(screen.getByText('Finish'));
  expect(await screen.findByText('"Choices" allows at most 1 answered fields; currently 2.')).toBeInTheDocument();
});

it('preserves conflicting saved answers on open and reports the conflict during validation', async () => {
  dbClient.get.mockReturnValueOnce({ promise: async () => ({
    Item: {
      document_id: 'doc', form_type: 'form', pertains_to: 'person', status: 'in_process',
      field_values: { a: 'Saved A', b: 'Saved B' }, history: [],
    },
  }) });
  render(<FormFillB request={{ document_id: 'doc', form_id: 'form', previewFormRec: form }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  expect(inputFor('Question A').value).toBe('Saved A');
  expect(inputFor('Question B').value).toBe('Saved B');
  fireEvent.click(screen.getByText('Finish'));
  expect((await screen.findAllByText(/Conflicting answer for Question A/)).length).toBeGreaterThan(0);
});
