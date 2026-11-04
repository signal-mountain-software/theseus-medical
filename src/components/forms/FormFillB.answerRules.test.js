import React from 'react';
import { fireEvent, render, screen, wait } from '@testing-library/react';
import FormFillB from './FormFillB';
import { dbClient } from '../../util/AVAUtilities';
import { addMember, removeMember } from '../../util/AVAGroups';
import { updateDocument } from '../../util/AVADocuments';
import { sendMessages } from '../../util/AVAMessages';
import { createNotification } from '../../util/AVANotifications';
import { putTask } from '../../util/AVATasks';

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
jest.mock('../../util/AVATasks', () => ({ putTask: jest.fn() }));
jest.mock('../../util/AVAGroups', () => ({
  addMember: jest.fn(async () => []),
  removeMember: jest.fn(async () => []),
}));
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

it('caps configured prompt widths at the container and allows selection labels to wrap', async () => {
  const longOption = 'April 16–18 | Vascular Anomalies & Craniofacial Conditions';
  const widthForm = {
    ...form,
    sections: [{ section_name: 'Widths', fields: ['a', 'b', 'c'] }],
    fields: {
      a: { type: 'select', prompt: { value: 'Wide choices', width: 600 },
        value: { column: true, selection: { min: 0, max: 1, selectionList: [longOption] } } },
      b: { type: 'text', prompt: { value: 'Wide text', width: 600, rows: 3 } },
      c: { type: 'drop', prompt: { value: 'Wide dropdown', width: 600 },
        value: { selection: { min: 0, max: 1, selectionList: ['First'] } } },
    },
  };
  render(<FormFillB request={{ form_id: 'form', previewFormRec: widthForm }} onClose={jest.fn()} />);
  await screen.findByText('Wide choices');
  for (const prompt of ['Wide choices', 'Wide text', 'Wide dropdown']) {
    const box = screen.getByText(prompt).closest('p').parentElement;
    expect(box.style.maxWidth).toBe('calc(100% - 16px)');
  }
  const label = screen.getByText(longOption);
  expect(label.style.whiteSpace).toBe('normal');
  expect(label.style.overflowWrap).toBe('anywhere');
  expect(label.closest('label').style.height).toBe('auto');
});

it.each([
  ['default', 'First', 'First', false],
  ['complete', 'First', 'First', false],
  ['default', 'First', 'Second', true],
  ['default', 'Neither', 'Neither', false],
])('reevaluates completed %s group rules with saved %s and live %s', async (stageName, saved, live, shouldRun) => {
  addMember.mockClear();
  removeMember.mockClear();
  sendMessages.mockClear();
  createNotification.mockClear();
  putTask.mockClear();
  const groupRules = ['First', 'Second'].map(value => ({
    showIf: [{ field: 'a', values: [value] }], remove: ['Parent'], add: ['Child1'],
  }));
  const actions = {
    on_complete_groups: groupRules,
    on_complete_message: [{ text: 'Do not resend', recipientList: ['pertains_to'] }],
    on_complete_notify: [{ text: 'Do not notify again', available_to: ['pertains_to'] }],
    on_complete_tasks: [{ text: 'Do not create again' }],
  };
  dbClient.get.mockReturnValueOnce({ promise: async () => ({
    Item: { document_id: 'doc', pertains_to: 'person', status: 'in_process',
      form_stage: 'complete', field_values: { a: saved }, history: [] },
  }) });
  const groupForm = {
    ...form,
    stages: ['default', 'complete'].map(stage_name => ({ stage_name, ...(stage_name === stageName ? actions : {}) })),
    sections: [{ section_name: 'Choices', fields: ['a'], belongs_to_stage: 'default' }],
    fields: { a: { type: 'text', prompt: 'Question A' } },
  };
  const onClose = jest.fn();
  render(<FormFillB request={{ document_id: 'doc', form_id: 'form', open_complete: true, previewFormRec: groupForm }} onClose={onClose} />);
  await screen.findByText('Question A');
  if (saved !== live) { fireEvent.blur(inputFor('Question A'), { target: { value: live } }); }
  fireEvent.click(screen.getByText('Finish'));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete' }));
  await wait(() => expect(onClose).toHaveBeenCalled());
  expect(removeMember).toHaveBeenCalledTimes(shouldRun ? 1 : 0);
  expect(addMember).toHaveBeenCalledTimes(shouldRun ? 1 : 0);
  if (shouldRun) {
    expect(removeMember.mock.calls[0][2]).toEqual(['Parent']);
    expect(addMember.mock.calls[0][2]).toEqual(['Child1']);
  }
  expect(sendMessages).not.toHaveBeenCalled();
  expect(createNotification).not.toHaveBeenCalled();
  expect(putTask).not.toHaveBeenCalled();
});

it('runs unconditional groups on first completion only and persists completion history', async () => {
  addMember.mockClear();
  removeMember.mockClear();
  updateDocument.mockClear();
  dbClient.get.mockReturnValueOnce({ promise: async () => ({
    Item: { document_id: 'doc', pertains_to: 'person', form_stage: 'pending',
      status: 'in_process', field_values: { a: 'First', b: '' }, history: [], group_completed_stages: [] },
  }) });
  const groupForm = {
    ...form,
    stages: [
      { stage_name: 'default', on_complete_groups: [{ add: ['Child1'], remove: ['Parent'] }] },
      { stage_name: 'pending', on_complete_groups: [{ add: ['MustNotAdd'] }] },
      { stage_name: 'complete', on_complete_groups: [{ add: ['AlsoMustNotAdd'] }] },
    ],
    sections: [
      { section_name: 'Choices', fields: ['a'], belongs_to_stage: 'default' },
      { section_name: 'Pending', fields: ['b'], belongs_to_stage: 'pending' },
    ],
    fields: { a: { type: 'text', prompt: 'Question A' }, b: { type: 'text', prompt: 'Question B', required: true } },
  };
  render(<FormFillB request={{ document_id: 'doc', form_id: 'form', previewFormRec: groupForm }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  fireEvent.click(screen.getByText('Save/Continue'));
  await wait(() => expect(updateDocument).toHaveBeenCalled());
  expect(removeMember.mock.calls[0][2]).toEqual(['Parent']);
  expect(addMember.mock.calls[0][2]).toEqual(['Child1']);
  addMember.mockClear();
  removeMember.mockClear();
  updateDocument.mockClear();
  fireEvent.click(screen.getByText('Save/Continue'));
  await wait(() => expect(updateDocument).toHaveBeenCalled());
  expect(removeMember).not.toHaveBeenCalled();
  expect(addMember).not.toHaveBeenCalled();
  expect(updateDocument.mock.calls[0][0].docData.group_completed_stages).toEqual(['default']);
});

it('preserves later-stage and current-entry exact-group conflict precedence', async () => {
  addMember.mockClear();
  removeMember.mockClear();
  const groupForm = {
    ...form,
    stages: [
      { stage_name: 'default', on_complete_groups: [{ add: ['A', 'B'], remove: ['Parent'] }] },
      { stage_name: 'later', on_complete_groups: [{ remove: ['A', 'B'] }] },
      { stage_name: 'complete', on_entry_groups: [{ add: ['B'] }] },
    ],
    sections: [
      { section_name: 'Choices', fields: ['a'], belongs_to_stage: 'default' },
      { section_name: 'Later', fields: ['b'], belongs_to_stage: 'later' },
    ],
    fields: { a: { type: 'text', prompt: 'Question A' }, b: { type: 'text', prompt: 'Question B' } },
  };
  const onClose = jest.fn();
  render(<FormFillB request={{ form_id: 'form', person_id: 'person', previewFormRec: groupForm }} onClose={onClose} />);
  await screen.findByText('Question A');
  fireEvent.click(screen.getByText('Finish'));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete' }));
  await wait(() => expect(onClose).toHaveBeenCalled());
  expect(removeMember.mock.calls[0][2].sort()).toEqual(['A', 'Parent']);
  expect(addMember.mock.calls[0][2]).toEqual(['B']);
});

it('runs only the changed later rule after reopening, then does not replay it on another save', async () => {
  addMember.mockClear();
  removeMember.mockClear();
  updateDocument.mockClear();
  dbClient.get.mockReturnValueOnce({ promise: async () => ({
    Item: { document_id: 'doc', pertains_to: 'person', form_stage: 'complete',
      status: 'in_process', field_values: { a: 'Interest', b: 'Old approval' },
      group_completed_stages: ['default', 'approvals', 'complete'], history: [] },
  }) });
  const groupForm = {
    ...form,
    stages: [
      { stage_name: 'default', on_complete_groups: [{ showIf: [{ field: 'a', values: ['Interest'] }], add: ['InterestGroup'] }] },
      { stage_name: 'approvals', on_complete_groups: [{
        showIf: [{ field: 'b', values: ['Old approval', 'New approval'] }], remove: ['InterestParent'], add: ['ApprovedGroup'],
      }] },
      { stage_name: 'complete', on_complete_groups: [{ remove: ['OneTimeGroup'] }] },
    ],
    sections: [
      { section_name: 'Choice', fields: ['a'], belongs_to_stage: 'default' },
      { section_name: 'Approvals', fields: ['b'], belongs_to_stage: 'approvals' },
    ],
    fields: { a: { type: 'text', prompt: 'Question A' }, b: { type: 'text', prompt: 'Question B' } },
  };
  render(<FormFillB request={{ document_id: 'doc', form_id: 'form', open_complete: true, previewFormRec: groupForm }} onClose={jest.fn()} />);
  await screen.findByText('Question B');
  fireEvent.blur(inputFor('Question B'), { target: { value: 'New approval' } });
  fireEvent.click(screen.getByText('Save/Continue'));
  await wait(() => expect(updateDocument).toHaveBeenCalled());
  expect(addMember.mock.calls[0][2]).toEqual(['ApprovedGroup']);
  expect(removeMember.mock.calls[0][2]).toEqual(['InterestParent']);
  addMember.mockClear();
  removeMember.mockClear();
  updateDocument.mockClear();
  fireEvent.click(screen.getByText('Save/Continue'));
  await wait(() => expect(updateDocument).toHaveBeenCalled());
  expect(addMember).not.toHaveBeenCalled();
  expect(removeMember).not.toHaveBeenCalled();
});

it('runs passing default-answer rules on first completion of a new form', async () => {
  addMember.mockClear();
  updateDocument.mockClear();
  const groupForm = {
    ...form,
    stages: [{ stage_name: 'default', on_complete_groups: [{
      showIf: [{ field: 'a', values: ['Preset'] }], add: ['DefaultGroup'],
    }] }],
    sections: [{ section_name: 'Choice', fields: ['a'], belongs_to_stage: 'default' }],
    fields: { a: { type: 'text', prompt: 'Question A', default: { value: 'Preset' } } },
  };
  render(<FormFillB request={{ form_id: 'form', person_id: 'person', previewFormRec: groupForm }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  fireEvent.click(screen.getByText('Save/Continue'));
  await wait(() => expect(updateDocument).toHaveBeenCalled());
  expect(addMember.mock.calls[0][2]).toEqual(['DefaultGroup']);
});

it('does not apply a changed field rule when its current condition fails', async () => {
  addMember.mockClear();
  removeMember.mockClear();
  updateDocument.mockClear();
  dbClient.get.mockReturnValueOnce({ promise: async () => ({
    Item: { document_id: 'doc', pertains_to: 'person', form_stage: 'complete',
      status: 'in_process', field_values: { a: 'Match' }, group_completed_stages: ['default'], history: [] },
  }) });
  const groupForm = {
    ...form,
    stages: [{ stage_name: 'default', on_complete_groups: [{
      showIf: [{ field: 'a', values: ['Match'] }], add: ['MatchedGroup'],
    }] }],
    sections: [{ section_name: 'Choice', fields: ['a'], belongs_to_stage: 'default' }],
    fields: { a: { type: 'text', prompt: 'Question A' } },
  };
  render(<FormFillB request={{ document_id: 'doc', form_id: 'form', open_complete: true, previewFormRec: groupForm }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  fireEvent.blur(inputFor('Question A'), { target: { value: 'No match' } });
  fireEvent.click(screen.getByText('Save/Continue'));
  await wait(() => expect(updateDocument).toHaveBeenCalled());
  expect(addMember).not.toHaveBeenCalled();
  expect(removeMember).not.toHaveBeenCalled();
});

it.each(['hidden', 'invalid'])('evaluates later approvals independently of an earlier %s stage', async blocker => {
  addMember.mockClear();
  removeMember.mockClear();
  updateDocument.mockClear();
  sendMessages.mockClear();
  createNotification.mockClear();
  putTask.mockClear();
  const groupForm = {
    ...form,
    stages: [
      { stage_name: 'default', on_complete_groups: [{ add: ['Interest'] }] },
      { stage_name: 'siblings', on_complete_groups: [{ add: ['BlockedSibling'] }] },
      {
        stage_name: 'approvals',
        on_complete_groups: [{ showIf: [{ field: 'approval', values: ['Approved'] }], add: ['AprilSession'], remove: ['ApprovalParent'] }],
        on_complete_message: [{ text: 'Do not send', recipientList: ['pertains_to'] }],
        on_complete_notify: [{ text: 'Do not notify', available_to: ['pertains_to'] }],
        on_complete_tasks: [{ text: 'Do not create' }],
      },
      { stage_name: 'sectionless', on_complete_groups: [{ add: ['NoSection'] }] },
      { stage_name: 'complete', on_complete_groups: [{ add: ['NotComplete'] }], on_entry_lock: true },
    ],
    sections: [
      { section_name: 'Top Choice', fields: ['choice'], belongs_to_stage: 'default' },
      {
        section_name: 'Siblings', fields: ['sibling'], belongs_to_stage: 'siblings',
        ...(blocker === 'hidden' ? { show_if: [{ field: 'choice', values: ['Summer'] }] } : {}),
      },
      { section_name: 'Approvals', fields: ['approval'], belongs_to_stage: 'approvals',
        show_if: [{ currentUser_audience: true, audience: ['admin'] }] },
    ],
    fields: {
      choice: { type: 'text', prompt: 'Choice', default: { value: 'Spring' } },
      sibling: { type: 'text', prompt: 'Sibling', required: true },
      approval: { type: 'text', prompt: 'Approved for' },
    },
  };
  render(<FormFillB request={{ form_id: 'form', person_id: 'person', previewFormRec: groupForm }} onClose={jest.fn()} />);
  await screen.findByText('Approved for');
  fireEvent.blur(inputFor('Approved for'), { target: { value: 'Approved' } });
  fireEvent.click(screen.getByText('Save/Continue'));
  await wait(() => expect(updateDocument).toHaveBeenCalled());
  expect(addMember.mock.calls[0][2]).toEqual(['Interest', 'AprilSession']);
  expect(removeMember.mock.calls[0][2]).toEqual(['ApprovalParent']);
  expect(updateDocument.mock.calls[0][0].docData.formLocked).toBe(false);
  expect(sendMessages).not.toHaveBeenCalled();
  expect(createNotification).not.toHaveBeenCalled();
  expect(putTask).not.toHaveBeenCalled();
});

it.each(['stage', 'final'])('opts %s group removals into subtrees and awaits them before additions', async scope => {
  addMember.mockClear();
  removeMember.mockClear();
  let finishRemoval;
  removeMember.mockImplementationOnce(() => new Promise(resolve => { finishRemoval = resolve; }));
  const rule = { remove: ['Parent'], add: ['Child1'] };
  const groupForm = {
    ...form,
    options: scope === 'final' ? { group_assignments: [rule] } : {},
    stages: [{ stage_name: 'default' }, { stage_name: 'complete', ...(scope === 'stage' ? { on_entry_groups: rule } : {}) }],
    sections: [{ section_name: 'Choices', fields: ['a'], belongs_to_stage: 'default' }],
    fields: { a: { type: 'text', prompt: 'Question A' } },
  };
  render(<FormFillB request={{ form_id: 'form', person_id: 'person', previewFormRec: groupForm }} onClose={jest.fn()} />);
  await screen.findByText('Question A');
  fireEvent.click(screen.getByText('Finish'));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete' }));
  await wait(() => expect(removeMember).toHaveBeenCalled());
  expect(removeMember).toHaveBeenCalledWith('person', 'client', ['Parent'], {
    includeDescendants: true, _personGroups: expect.any(Map),
  });
  expect(addMember).not.toHaveBeenCalled();
  finishRemoval([]);
  await wait(() => expect(addMember).toHaveBeenCalled());
  expect(addMember.mock.calls[0][3]._personGroups).toBe(removeMember.mock.calls[0][3]._personGroups);
});

it.each(['stage', 'final'])('reports %s removal failures without running paired additions', async scope => {
  addMember.mockClear();
  updateDocument.mockClear();
  removeMember.mockRejectedValueOnce(new Error('Removal failed'));
  const rule = { remove: ['Parent'], add: ['Child1'] };
  const groupForm = {
    ...form,
    options: scope === 'final' ? { group_assignments: [rule] } : {},
    stages: [{ stage_name: 'default' }, { stage_name: 'complete', ...(scope === 'stage' ? { on_entry_groups: rule } : {}) }],
    sections: [{ section_name: 'Choices', fields: ['a'], belongs_to_stage: 'default' }],
    fields: { a: { type: 'text', prompt: 'Question A' } },
  };
  const onClose = jest.fn();
  render(<FormFillB request={{ form_id: 'form', person_id: 'person', previewFormRec: groupForm }} onClose={onClose} />);
  await screen.findByText('Question A');
  fireEvent.click(screen.getByText('Finish'));
  fireEvent.click(await screen.findByRole('button', { name: 'Complete' }));
  await screen.findAllByText(/memberships.*Removal failed/);
  expect(addMember).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(updateDocument).toHaveBeenCalledTimes(scope === 'final' ? 1 : 0);
});

it.each([1, 3])('allows deselecting the last optional choice with maximum %s', async max => {
  const optional = {
    ...form, sections: [{ section_name: 'Choices', fields: ['a'] }],
    fields: { a: { type: 'select', prompt: 'Optional choice', value: { selection: { min: 0, max, selectionList: ['First', 'Second'] } } } },
  };
  render(<FormFillB request={{ form_id: 'form', previewFormRec: optional }} onClose={jest.fn()} />);
  await screen.findByText('Optional choice');
  fireEvent.mouseDown(screen.getByLabelText('a_0'));
  expect(screen.getByLabelText('a_0').querySelector('input').checked).toBe(true);
  fireEvent.mouseDown(screen.getByLabelText('a_0'));
  expect(screen.getByLabelText('a_0').querySelector('input').checked).toBe(false);
  fireEvent.click(screen.getByText('Finish'));
  expect(await screen.findByText('This form is complete!')).toBeInTheDocument();
});

it.each([{ min: 1 }, { min: 0, required: true }])('preserves required single-choice behavior for %j', async requirement => {
  const required = {
    ...form, sections: [{ section_name: 'Choices', fields: ['a'] }],
    fields: { a: { type: 'select', prompt: 'Required choice', required: !!requirement.required,
      value: { selection: { min: requirement.min, max: 1, selectionList: ['First', 'Second'] } } } },
  };
  render(<FormFillB request={{ form_id: 'form', previewFormRec: required }} onClose={jest.fn()} />);
  await screen.findByText('Required choice');
  fireEvent.mouseDown(screen.getByLabelText('a_0'));
  fireEvent.mouseDown(screen.getByLabelText('a_0'));
  expect(screen.getByLabelText('a_0').querySelector('input').checked).toBe(true);
  fireEvent.mouseDown(screen.getByLabelText('a_1'));
  expect(screen.getByLabelText('a_0').querySelector('input').checked).toBe(false);
  expect(screen.getByLabelText('a_1').querySelector('input').checked).toBe(true);
});

it.each(['First', ['First']])('deselects a saved optional single choice stored as %j without restoring its default', async saved => {
  dbClient.get.mockReturnValueOnce({ promise: async () => ({
    Item: { document_id: 'doc', form_type: 'form', pertains_to: 'person', status: 'in_process', field_values: { a: saved }, history: [] },
  }) });
  const optional = {
    ...form, sections: [{ section_name: 'Choices', fields: ['a'] }],
    fields: { a: { type: 'select', prompt: 'Optional choice', default: { value: 'First' },
      value: { selection: { min: 0, max: 1, selectionList: ['First', 'Second'] } } } },
  };
  render(<FormFillB request={{ document_id: 'doc', form_id: 'form', previewFormRec: optional }} onClose={jest.fn()} />);
  await screen.findByText('Optional choice');
  expect(screen.getByLabelText('a_0').querySelector('input').checked).toBe(true);
  fireEvent.mouseDown(screen.getByLabelText('a_0'));
  await wait(() => expect(screen.getByLabelText('a_0').querySelector('input').checked).toBe(false));
  fireEvent.mouseDown(screen.getByLabelText('a_1'));
  expect(screen.getByLabelText('a_1').querySelector('input').checked).toBe(true);
  fireEvent.mouseDown(screen.getByLabelText('a_1'));
  expect(screen.getByLabelText('a_1').querySelector('input').checked).toBe(false);
});

it.each([1, 3])('clears an optional dropdown with maximum %s', async max => {
  dbClient.get.mockReturnValueOnce({ promise: async () => ({
    Item: { document_id: 'doc', form_type: 'form', pertains_to: 'person', status: 'in_process', field_values: { a: ['First'] }, history: [] },
  }) });
  const optional = {
    ...form, sections: [{ section_name: 'Choices', fields: ['a'] }],
    fields: { a: { type: 'drop', prompt: 'Optional dropdown',
      value: { selection: { min: 0, max, selectionList: ['First', 'Second'] } } } },
  };
  render(<FormFillB request={{ document_id: 'doc', form_id: 'form', previewFormRec: optional }} onClose={jest.fn()} />);
  await screen.findByText('Optional dropdown');
  const dropdown = screen.getByText('Optional dropdown').closest('p').parentElement;
  expect(dropdown.querySelector('.react-dropdown-select-content').textContent).toContain('First');
  fireEvent.click(dropdown.querySelector('.react-dropdown-select-clear'));
  await wait(() => expect(screen.getByText('Optional dropdown').closest('p').parentElement.querySelector('.react-dropdown-select-content').textContent).not.toContain('First'));
  fireEvent.click(screen.getByText('Finish'));
  expect(await screen.findByText('This form is complete!')).toBeInTheDocument();
});

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
