import React from 'react';
import { fireEvent, render, screen, within, wait } from '@testing-library/react';
import GroupSecuritySection from './GroupSecuritySection';

jest.mock('../../hooks/useSession', () => () => ({
  state: {
    session: { client_id: 'client' },
    groups: {
      adminHierarchy: [
        { id: 'Parent', belongs_to: '__TOP__', name: 'Parent Group' },
        { id: 'Nursing', belongs_to: 'Parent', name: 'Nursing' },
      ]
    }
  }
}));
jest.mock('../../util/AVAStyles', () => ({ AVAclasses: () => ({}), AVATextStyle: () => ({}) }));
jest.mock('../../util/AVAMessageShortcuts', () => ({
  buildShortcutMenuId: (rule, targetGroupId) => `msgshortcut~${rule}~${targetGroupId}`,
  getExistingShortcutStates: jest.fn(async () => ({})),
  setMessageShortcut: jest.fn(async () => true),
}));
jest.mock('./QuickSearch', () => props => (
  <div data-testid='access-picker'>
    <span>{props.options.title}</span>
    <span data-testid='picker-selections'>{JSON.stringify(props.reactData.selections)}</span>
    <button onClick={() => props.onClose([{ group_id: 'Kitchen' }])}>Choose access</button>
    <button onClick={() => props.onClose([])}>Clear access</button>
  </div>
));

const { getExistingShortcutStates, setMessageShortcut } = require('../../util/AVAMessageShortcuts');

const baseProps = (accessible_to) => ({
  currentValues: { Groups: { client_id: 'client', group_id: 'Nursing', name: 'Nursing', accessible_to } },
  reactData: { showGroupAccessSearch: false },
  updateReactData: jest.fn(),
  updateField: jest.fn(),
});

beforeEach(() => {
  getExistingShortcutStates.mockClear();
  getExistingShortcutStates.mockImplementation(async () => ({}));
  setMessageShortcut.mockClear();
  setMessageShortcut.mockImplementation(async () => true);
});

it('shows "no one" messaging and hides the picker when accessible_to is empty', async () => {
  render(<GroupSecuritySection {...baseProps([])} />);
  expect(screen.getByText('No one is allowed to access this group.')).toBeInTheDocument();
  await wait(() => {});
});

it('shows "anyone" messaging when accessible_to includes *all', async () => {
  render(<GroupSecuritySection {...baseProps(['*all'])} />);
  expect(screen.getByText('Anyone may access this group.')).toBeInTheDocument();
  await wait(() => {});
});

it('lists named rules, resolving a group rule to its hierarchy name', async () => {
  render(<GroupSecuritySection {...baseProps(['group:Parent', 'person:jane', '*admin'])} />);
  expect(screen.getByText('Group: __TOP__ / Parent Group')).toBeInTheDocument();
  expect(screen.getByText('Person: jane')).toBeInTheDocument();
  expect(screen.getByText('* Administrators')).toBeInTheDocument();
  await wait(() => {});
});

it('no longer renders the old big-button Allow/Restrict controls', async () => {
  render(<GroupSecuritySection {...baseProps(['*all'])} />);
  expect(screen.queryByText('Allow Everyone')).not.toBeInTheDocument();
  expect(screen.queryByText('Allow No One')).not.toBeInTheDocument();
  expect(screen.queryByText('Restrict to Specific Groups/People')).not.toBeInTheDocument();
  expect(screen.getByText('Edit Access')).toBeInTheDocument();
  await wait(() => {});
});

it('opens the QuickSearch picker, pre-seeded with current selections, on Edit Access', async () => {
  const props = baseProps(['group:Kitchen', 'person:jane']);
  const { rerender } = render(<GroupSecuritySection {...props} />);
  fireEvent.click(screen.getByText('Edit Access'));
  expect(props.updateReactData).toHaveBeenCalledWith(
    { showGroupAccessSearch: true, selections: [{ group_id: 'Kitchen' }, { person_id: 'jane' }] },
    true
  );
  rerender(<GroupSecuritySection {...props} reactData={{ showGroupAccessSearch: true }} />);
  expect(within(screen.getByTestId('access-picker')).getByText('Who Can Access "Nursing"?')).toBeInTheDocument();
  await wait(() => {});
});

it('saves the new accessible_to array and preserves rules the picker does not model', async () => {
  const props = baseProps(['class:family', 'group:Kitchen']);
  render(<GroupSecuritySection {...props} reactData={{ showGroupAccessSearch: true }} />);
  fireEvent.click(screen.getByText('Choose access'));
  expect(props.updateField).toHaveBeenCalledWith({
    updateList: [{ tableName: 'Groups', fieldName: 'accessible_to', newData: ['class:family', 'group:Kitchen'] }],
    reactUpd: { showGroupAccessSearch: false, selections: [{ group_id: 'Kitchen' }] }
  });
  await wait(() => {});
});

it('saves *none when every selection is cleared', async () => {
  const props = baseProps(['group:Kitchen']);
  render(<GroupSecuritySection {...props} reactData={{ showGroupAccessSearch: true }} />);
  fireEvent.click(screen.getByText('Clear access'));
  expect(props.updateField).toHaveBeenCalledWith({
    updateList: [{ tableName: 'Groups', fieldName: 'accessible_to', newData: ['*none'] }],
    reactUpd: { showGroupAccessSearch: false, selections: [] }
  });
});

it('does not render any one-tap shortcut rows when no one has access', async () => {
  render(<GroupSecuritySection {...baseProps([])} />);
  expect(screen.queryByText('Give members a one-tap way to message this group')).not.toBeInTheDocument();
  await new Promise(resolve => setTimeout(resolve, 0));
});

it('renders a shortcut toggle per accessible_to rule, reflecting existing shortcut state', async () => {
  getExistingShortcutStates.mockImplementation(async () => ({
    'msgshortcut~group:Kitchen~Nursing': true,
    'msgshortcut~person:jane~Nursing': false,
  }));
  render(<GroupSecuritySection {...baseProps(['group:Kitchen', 'person:jane'])} />);
  await wait(() => expect(getExistingShortcutStates).toHaveBeenCalledWith('client', [
    { granteeRule: 'group:Kitchen', targetGroupId: 'Nursing' },
    { granteeRule: 'person:jane', targetGroupId: 'Nursing' },
  ]));
  const checkboxes = await screen.findAllByRole('checkbox');
  expect(checkboxes[0]).toBeChecked();
  expect(checkboxes[1]).not.toBeChecked();
});

it('labels each one-tap shortcut row without a type prefix, with an explicit arrow to this group', async () => {
  render(<GroupSecuritySection {...baseProps(['group:Kitchen', 'person:jane', '*admin'])} />);
  expect(await screen.findByText('Kitchen → Nursing')).toBeInTheDocument();
  expect(screen.getByText('jane → Nursing')).toBeInTheDocument();
  expect(screen.getByText('* Administrators → Nursing')).toBeInTheDocument();
  // The "Who can access" summary above keeps its type prefixes - only the shortcut rows change.
  expect(screen.getByText('Group: Kitchen')).toBeInTheDocument();
  expect(screen.getByText('Person: jane')).toBeInTheDocument();
});

it('enables a one-tap shortcut mirroring the exact rule, targeting the group being maintained', async () => {
  render(<GroupSecuritySection {...baseProps(['group:Kitchen'])} />);
  const checkbox = await screen.findByRole('checkbox');
  fireEvent.click(checkbox);
  await wait(() => expect(setMessageShortcut).toHaveBeenCalledWith({
    client_id: 'client', granteeRule: 'group:Kitchen', targetGroupId: 'Nursing', targetGroupName: 'Nursing', enabled: true
  }));
});

it('disables a one-tap shortcut that was previously on', async () => {
  getExistingShortcutStates.mockImplementation(async () => ({ 'msgshortcut~group:Kitchen~Nursing': true }));
  render(<GroupSecuritySection {...baseProps(['group:Kitchen'])} />);
  const checkbox = await screen.findByRole('checkbox');
  await wait(() => expect(checkbox).toBeChecked());
  fireEvent.click(checkbox);
  await wait(() => expect(setMessageShortcut).toHaveBeenCalledWith(expect.objectContaining({ enabled: false })));
});

it('reverts the checkbox if the shortcut write fails', async () => {
  setMessageShortcut.mockImplementation(async () => null);
  render(<GroupSecuritySection {...baseProps(['group:Kitchen'])} />);
  const checkbox = await screen.findByRole('checkbox');
  fireEvent.click(checkbox);
  await wait(() => expect(setMessageShortcut).toHaveBeenCalled());
  await wait(() => expect(checkbox).not.toBeChecked());
});
