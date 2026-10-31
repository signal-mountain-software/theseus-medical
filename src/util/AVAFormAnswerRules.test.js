import { answerSnapshot, applyClearRules, countSectionAnswers, hasAnswer, resolveAnswerFieldKey, sectionAnswerError } from './AVAFormAnswerRules';

const clearWhen = (field, values = ['*']) => [{ field, values }];
const runClear = (fields, previous) => applyClearRules({
  fields, previous,
  matches: test => test.values.includes('*') ? hasAnswer(fields[test.field]?.value)
    : test.values.includes(fields[test.field]?.value ?? '%%no_data%%'),
});

it('preserves the newest answer under reciprocal clear rules and clears associated text', () => {
  const fields = {
    a: { value: ['first'], bonusText: 'Other', clear_if: clearWhen('b') },
    b: { value: [], clear_if: clearWhen('a') },
  };
  const previous = answerSnapshot(fields);
  fields.b.value = ['newest'];
  expect(runClear(fields, previous)).toEqual(['a']);
  expect(fields.a.value).toEqual([]);
  expect(fields.a.bonusText).toBe('');
  expect(fields.b.value).toEqual(['newest']);
});

it('never clears initial saved values or reacts to unrelated edits', () => {
  const fields = { a: { value: 'saved', clear_if: clearWhen('b') }, b: { value: 'saved' }, c: { value: '' } };
  expect(runClear(fields, {})).toEqual([]);
  const previous = answerSnapshot(fields);
  fields.c.value = 'unrelated';
  expect(runClear(fields, previous)).toEqual([]);
});

it('protects the latest edited field when an older text blur commit is still pending', () => {
  const fields = {
    a: { value: '', clear_if: clearWhen('b') },
    b: { value: [], clear_if: clearWhen('a') },
  };
  const previous = answerSnapshot(fields);
  fields.a.value = 'Pending text';
  fields.b.value = ['Newest selection'];
  expect(applyClearRules({
    fields, previous, editedKey: 'b', matches: test => hasAnswer(fields[test.field]?.value),
  })).toEqual(['a']);
  expect(fields.b.value).toEqual(['Newest selection']);
});

it('processes chains triggered by cleared answers without looping', () => {
  const fields = {
    a: { value: 'a', clear_if: clearWhen('b') },
    b: { value: '' },
    c: { value: 'c', clear_if: clearWhen('a', ['']) },
  };
  const previous = answerSnapshot(fields);
  fields.b.value = 'b';
  expect(runClear(fields, previous)).toEqual(['a', 'c']);
});

it('respects protected targets and clears scalar false/zero answers when appropriate', () => {
  const fields = { a: { value: false, clear_if: clearWhen('b') }, b: { value: 0 } };
  const previous = answerSnapshot(fields);
  fields.b.value = 1;
  expect(applyClearRules({ fields, previous, matches: () => true, canClear: () => false })).toEqual([]);
  expect(runClear(fields, previous)).toEqual(['a']);
  expect(fields.a.value).toBe('');
});

it('resolves repeating field keys within the current occurrence', () => {
  expect(resolveAnswerFieldKey('field_1_name', 2, { field_2_name: {} })).toBe('field_2_name');
  expect(resolveAnswerFieldKey('answer_occ1', 3, {})).toBe('answer_occ3');
  expect(resolveAnswerFieldKey('answer', 2, {})).toBe('answer_occ2');
});

const answers = [
  { type: 'select', value: ['a', 'b', 'c'], bonusText: 'Other' },
  { type: 'text', value: 'answer' },
  { type: 'yes/no', value: false },
  { type: 'number', value: 0 },
  { type: 'text', value: '  ' },
  { type: 'select&text', value: [], bonusText: 'custom' },
  { type: 'header', value: 'Do not count' },
];

it('counts answered fields and individual selections without double counting Other text', () => {
  expect(countSectionAnswers(answers, 'fields')).toBe(5);
  expect(countSectionAnswers(answers, 'selections')).toBe(7);
});

it('counts dropdown selections individually and a guest-only answer as one answered field', () => {
  const fields = [
    { type: 'drop', value: ['first', 'second'] },
    { type: 'family&guests', value: [], guestNames: ['Guest', ''] },
  ];
  expect(countSectionAnswers(fields, 'fields')).toBe(2);
  expect(countSectionAnswers(fields, 'selections')).toBe(3);
});

it('validates exact section boundaries including a zero maximum and optional bounds', () => {
  const section = { section_name: 'Choices', answer_limits: { mode: 'selections', min: 7, max: 7 } };
  expect(sectionAnswerError(section, answers)).toBeNull();
  expect(sectionAnswerError({ ...section, answer_limits: { mode: 'fields', min: 6 } }, answers)).toContain('at least 6');
  expect(sectionAnswerError({ ...section, answer_limits: { mode: 'fields', max: 0 } }, answers)).toContain('at most 0');
  expect(sectionAnswerError({ section_name: 'Unlimited' }, answers)).toBeNull();
  expect(sectionAnswerError({ ...section, answer_limits: { mode: 'fields', min: 2, max: 1 } }, answers)).toContain('Invalid');
});
