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

// FormBuilder's TextFields (e.g. the numeric/rating bounds and tag inputs below) don't pass an
// explicit `id`, so MUI v4 never links their <label> to the <input> via htmlFor - getByLabelText
// can't find them. Same pattern as this suite's own limitInput helper: locate the labeled
// FormControl by its label text, then reach into its rendered <input>.
const numberInput = (label) => screen.getByText(label).parentElement.querySelector('input');

// Switching an existing field's type to Rating Scale should seed a usable 1-10 default range -
// bubbles can't render with no configured bounds, unlike a plain numeric field whose bounds are
// optional.
it('seeds a default 1-10 range when a field becomes a Rating Scale', async () => {
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Rating Seeding',
    sections: [{ section_name: 'Section', fields: ['answer'] }],
    fields: { answer: { type: 'text', prompt: 'How satisfied are you?' } },
  }} onClose={jest.fn()} />);

  fireEvent.mouseDown(await screen.findByRole('button', { name: 'Text' }));
  fireEvent.click(screen.getByRole('option', { name: 'Rating Scale' }));

  expect(numberInput('Lowest value')).toHaveValue(1);
  expect(numberInput('Highest value')).toHaveValue(10);

  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const item = putDb.mock.calls[0][0].Item;

  expect(item.fields.answer.type).toBe('rating');
  expect(item.fields.answer.options).toEqual({ minValue: 1, maxValue: 10 });
});

// Round-trips an already-configured Rating Scale field (bounds + end tags), confirming the
// editor loads the stored options and persists edits to the tags back out the same way.
it('loads and saves a Rating Scale field\'s bounds and end tags', async () => {
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Rating Round Trip',
    sections: [{ section_name: 'Section', fields: ['mood'] }],
    fields: {
      mood: {
        type: 'rating', prompt: 'How was working in the Editor today?', required: true,
        options: { minValue: 1, maxValue: 10, lowLabel: 'Very Difficult', highLabel: 'Very Easy' },
      },
    },
  }} onClose={jest.fn()} />);

  expect(await screen.findByText('Lowest value')).toBeInTheDocument();
  expect(numberInput('Lowest value')).toHaveValue(1);
  expect(numberInput('Highest value')).toHaveValue(10);
  expect(numberInput('Low end tag')).toHaveValue('Very Difficult');
  expect(numberInput('High end tag')).toHaveValue('Very Easy');

  fireEvent.change(numberInput('High end tag'), { target: { value: 'Extremely Easy' } });

  fireEvent.click(screen.getByText('Save Form'));
  await wait(() => expect(putDb).toHaveBeenCalled());
  const item = putDb.mock.calls[0][0].Item;

  expect(item.fields.mood.options).toEqual({
    minValue: 1, maxValue: 10, lowLabel: 'Very Difficult', highLabel: 'Extremely Easy',
  });
  expect(item.fields.mood.required).toBe(true);
});

// A Rating Scale with no usable range can't render any bubbles - saving should be blocked with
// an explanatory alert rather than silently persisting an unusable field.
it('blocks saving a Rating Scale whose lowest value is not less than its highest', async () => {
  render(<FormBuilder directForm={{
    client_id: 'client', form_id: 'form', form_name: 'Rating Validation',
    sections: [{ section_name: 'Section', fields: ['mood'] }],
    fields: { mood: { type: 'rating', prompt: 'Mood', options: { minValue: 5, maxValue: 5 } } },
  }} onClose={jest.fn()} />);

  fireEvent.click(await screen.findByText('Save Form'));

  expect(await screen.findByText(/needs a Lowest Value and Highest Value/)).toBeInTheDocument();
  expect(putDb).not.toHaveBeenCalled();
});
