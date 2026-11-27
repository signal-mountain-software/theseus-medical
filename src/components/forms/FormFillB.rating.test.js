import React from 'react';
import { fireEvent, render, screen, wait } from '@testing-library/react';
import FormFillB from './FormFillB';
import { dbClient, getDb } from '../../util/AVAUtilities';
import { updateDocument } from '../../util/AVADocuments';

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
  dbClient: {
    get: jest.fn(() => ({ promise: async () => ({}) })),
    put: jest.fn(() => ({ promise: async () => ({}) }))
  },
  getDb: jest.fn(async ({ TableName }) => TableName === 'People'
    ? { person_id: 'person', name: { first: 'Test', last: 'Person' }, groups: [] } : null),
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
jest.mock('../../util/AVATasks', () => ({ putTask: jest.fn() }));
jest.mock('../../util/AVAGroups', () => ({ addMember: jest.fn(async () => []), removeMember: jest.fn(async () => []) }));
jest.mock('../../util/AVAPeople', () => ({ makeName: () => 'Test Person' }));
jest.mock('../../util/AVADateTime', () => ({
  makeDate: () => ({ numeric$: 20261030, numeric: 20261030, date: new Date(), absolute: 'Today' }),
  makeTime: () => ({}),
}));
jest.mock('../../util/AVAMessages', () => ({ sendMessages: jest.fn() }));
jest.mock('../../util/AVADocuments', () => ({ updateDocument: jest.fn(async ({ docData }) => docData) }));
jest.mock('../../util/AVACalendars', () => ({}));
jest.mock('../../util/AVANotifications', () => ({ createNotification: jest.fn() }));
jest.mock('../../util/AVASessionSync', () => ({ syncPersonToSessionCaches: jest.fn() }));
jest.mock('../../util/AVAUploadFile', () => () => null);

const form = {
  form_id: 'form', form_name: 'Rating', options: {},
  stages: [{ stage_name: 'default' }],
  sections: [{ section_name: 'Mood', fields: ['a'], belongs_to_stage: 'default' }],
  fields: { a: { type: 'rating', prompt: 'How was today?', options: { minValue: 1, maxValue: 5 } } },
};

beforeEach(() => {
  jest.clearAllMocks();
  dbClient.get.mockReturnValue({ promise: async () => ({}) });
  getDb.mockImplementation(async ({ TableName }) => TableName === 'People'
    ? { person_id: 'person', name: { first: 'Test', last: 'Person' }, groups: [] } : null);
});

const renderSavedFieldValue = async (type, value) => {
  const savedDocument = {
    document_id: 'doc',
    form_type: 'form',
    pertains_to: 'person',
    status: 'in_process',
    form_stage: 'default',
    field_values: { a: value },
    history: [],
  };
  dbClient.get.mockImplementation(({ TableName }) => ({
    promise: async () => (TableName === 'DocumentMaster' ? { Item: savedDocument } : {}),
  }));
  const savedForm = {
    ...form,
    fields: { a: { ...form.fields.a, type } },
  };
  render(<FormFillB request={{ form_id: 'form', document_id: 'doc', previewFormRec: savedForm }} onClose={jest.fn()} />);
  await screen.findByText('How was today?');
}

it('renders one bubble per configured value, defaulting the end tags to Low/High', async () => {
  render(<FormFillB request={{ form_id: 'form', previewFormRec: form }} onClose={jest.fn()} />);
  await screen.findByText('How was today?');

  expect(screen.getByText('Low')).toBeInTheDocument();
  expect(screen.getByText('High')).toBeInTheDocument();
  for (const value of [1, 2, 3, 4, 5]) {
    expect(screen.getByLabelText(`a_${value}`)).toHaveAttribute('aria-pressed', 'false');
  }
  expect(screen.queryByLabelText('a_0')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('a_6')).not.toBeInTheDocument();
});

it('honors custom end tags, selects a bubble on click, and stores a plain integer', async () => {
  const tagged = {
    ...form,
    fields: { a: { ...form.fields.a, options: { minValue: 1, maxValue: 5, lowLabel: 'Very Difficult', highLabel: 'Very Easy' } } },
  };
  render(<FormFillB request={{ form_id: 'form', previewFormRec: tagged }} onClose={jest.fn()} />);
  await screen.findByText('How was today?');

  expect(screen.getByText('Very Difficult')).toBeInTheDocument();
  expect(screen.getByText('Very Easy')).toBeInTheDocument();

  fireEvent.click(screen.getByLabelText('a_4'));
  expect(screen.getByLabelText('a_4')).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByText('Finish'));
  expect(await screen.findByText('This form is complete!')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
  await wait(() => expect(updateDocument).toHaveBeenCalled());
  const [[{ docData }]] = updateDocument.mock.calls;
  expect(docData.field_values.a).toBe(4);
});

it('coerces a stored text rating into its numeric selection when reopening the document', async () => {
  await renderSavedFieldValue('rating', '2');
  expect(screen.getByLabelText('a_2')).toHaveAttribute('aria-pressed', 'true');
});

it('saves a previously text-stored numeric value as a number', async () => {
  await renderSavedFieldValue('numeric', '2');
  fireEvent.click(screen.getByText('Finish'));
  expect(await screen.findByText('This form is complete!')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Complete' }));
  await wait(() => expect(updateDocument).toHaveBeenCalled());
  const [[{ docData }]] = updateDocument.mock.calls;
  expect(docData.field_values.a).toBe(2);
});

it.each([null, 'not a number', ''])('treats an invalid stored rating value (%s) as unanswered', async value => {
  await renderSavedFieldValue('rating', value);
  for (const rating of [1, 2, 3, 4, 5]) {
    expect(screen.getByLabelText(`a_${rating}`)).toHaveAttribute('aria-pressed', 'false');
  }
});

it('allows un-clicking to remove a selection when the field is not required', async () => {
  render(<FormFillB request={{ form_id: 'form', previewFormRec: form }} onClose={jest.fn()} />);
  await screen.findByText('How was today?');

  fireEvent.click(screen.getByLabelText('a_3'));
  expect(screen.getByLabelText('a_3')).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByLabelText('a_3'));
  expect(screen.getByLabelText('a_3')).toHaveAttribute('aria-pressed', 'false');

  fireEvent.click(screen.getByText('Finish'));
  expect(await screen.findByText('This form is complete!')).toBeInTheDocument();
});

it('does not allow removing a selection when the field is required', async () => {
  const required = { ...form, fields: { a: { ...form.fields.a, required: true } } };
  render(<FormFillB request={{ form_id: 'form', previewFormRec: required }} onClose={jest.fn()} />);
  await screen.findByText('How was today?');

  fireEvent.click(screen.getByLabelText('a_3'));
  expect(screen.getByLabelText('a_3')).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByLabelText('a_3'));
  expect(screen.getByLabelText('a_3')).toHaveAttribute('aria-pressed', 'true');
});

it('shows a configuration warning instead of bubbles when no range is configured', async () => {
  const unconfigured = { ...form, fields: { a: { type: 'rating', prompt: 'How was today?' } } };
  render(<FormFillB request={{ form_id: 'form', previewFormRec: unconfigured }} onClose={jest.fn()} />);
  await screen.findByText('How was today?');

  expect(screen.getByText(/Rating scale is not fully configured/)).toBeInTheDocument();
  expect(screen.queryByLabelText('a_1')).not.toBeInTheDocument();
});
