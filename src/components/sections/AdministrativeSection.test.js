import React from 'react';
import { fireEvent, render, screen, wait } from '@testing-library/react';
import AdministrativeSection from './AdministrativeSection';

jest.mock('../../util/AVAUtilities', () => ({
  isEmpty: value => value == null || value.length === 0,
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  booleanLikeToken: value => value === true ? 'true' : value === false ? 'false' : null,
}));
jest.mock('../../util/AVAStyles', () => ({ AVATextStyle: () => ({}) }));
jest.mock('../../util/AVADateTime', () => ({ makeDate: () => ({ input: '2026-11-06' }) }));

beforeAll(() => {
  Element.prototype.scrollIntoView = jest.fn();
});

const mount = (type, prompt, value = '') => {
  const updateField = jest.fn(async () => {});
  const fields = {
    example: {
      prompt, value,
      fieldRec: {
        prompt: { value: prompt, width: 200 },
        value: { type, saveAs: 'People.example', selection: { selectionList: ['One', 'Two'], max: 1 } },
        options: {},
      },
    },
  };
  const result = render(<AdministrativeSection
    reactData={{ administrative_account: true, form_fields: fields }}
    updateField={updateField}
  />);
  return { ...result, updateField };
};

it.each([
  ['text', ''], ['text', ['Existing']], ['date', '20261106'],
  ['boolean', false], ['select', []], ['dropdown', 'One'],
])('renders HTML prompts for %s with value %j', (type, value) => {
  const { container } = mount(type, '<p>Important <strong>instructions</strong><br/>Second line</p>', value);
  expect(container.querySelector('strong').textContent).toBe('instructions');
  expect(container.querySelector('br')).not.toBeNull();
  expect(screen.getByText('instructions')).toBeTruthy();
  expect(container.textContent).not.toContain('<strong>');
  expect(container.querySelector('p p')).toBeNull();
});

it('preserves ordinary prompt text and scalar punctuation', () => {
  mount('text', 'Age < 18 & notes');
  expect(screen.getByText('Age < 18 & notes:')).toBeTruthy();
});

it('removes active HTML while preserving formatting', () => {
  const { container } = mount('boolean',
    '<strong>Safe</strong><script>alert(1)</script><img src="bad" onerror="alert(1)"/><a href="javascript:alert(1)">Link</a><iframe src="bad"></iframe>');
  expect(container.querySelector('strong').textContent).toBe('Safe');
  expect(container.querySelector('script,iframe,[onerror]')).toBeNull();
  expect(container.querySelector('a').getAttribute('href')).toBeNull();
});

it('preserves editing and save payloads with an HTML prompt', async () => {
  const { container, updateField } = mount('text', '<b>Notes</b>', 'Before');
  fireEvent.blur(container.querySelector('input'), { target: { value: 'After' } });
  await wait(() => expect(updateField).toHaveBeenCalledWith(expect.objectContaining({
    updateList: [{ tableName: 'People', fieldName: 'example', newData: 'After' }],
  })));
});
