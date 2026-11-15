import React from 'react';
import { fireEvent, render, screen, wait } from '@testing-library/react';
import GroupMessagingSection from './GroupMessagingSection';

jest.mock('../../hooks/useSession', () => () => ({ state: { session: { client_id: 'client' } } }));
jest.mock('../../util/AVAStyles', () => ({ AVATextStyle: () => ({}) }));
jest.mock('../../util/AVAGroups', () => ({ getGroupAccessibleGroups: jest.fn() }));
jest.mock('../../util/AVAMessageShortcuts', () => ({
  buildShortcutMenuId: (rule, targetGroupId) => `msgshortcut~${rule}~${targetGroupId}`,
  getExistingShortcutStates: jest.fn(async () => ({})),
  setMessageShortcut: jest.fn(async () => true),
}));

const { getGroupAccessibleGroups } = require('../../util/AVAGroups');
const { getExistingShortcutStates, setMessageShortcut } = require('../../util/AVAMessageShortcuts');

const props = { currentValues: { Groups: { client_id: 'client', group_id: 'Nursing', name: 'Nursing' } } };

beforeEach(() => {
  getGroupAccessibleGroups.mockReset();
  getGroupAccessibleGroups.mockResolvedValue([]);
  getExistingShortcutStates.mockClear();
  getExistingShortcutStates.mockImplementation(async () => ({}));
  setMessageShortcut.mockClear();
  setMessageShortcut.mockImplementation(async () => true);
});

it('shows a message when the group has not been granted access to anything', async () => {
  render(<GroupMessagingSection {...props} />);
  expect(await screen.findByText('This group has not been granted access to any other groups yet.')).toBeInTheDocument();
});

it('lists each candidate with an arrow from this group to the candidate, plus its reason, and queries shortcut states keyed on this group as the grantee', async () => {
  getGroupAccessibleGroups.mockResolvedValue([
    { group_id: 'Admin', group_name: 'Admin', reason: 'Granted directly' },
    { group_id: 'AllStaff', group_name: 'All Staff', reason: 'Inherited from parent group "All Staff"' },
  ]);
  render(<GroupMessagingSection {...props} />);
  expect(await screen.findByText('Nursing → Admin')).toBeInTheDocument();
  expect(screen.getByText('Granted directly')).toBeInTheDocument();
  expect(screen.getByText('Nursing → All Staff')).toBeInTheDocument();
  expect(screen.getByText('Inherited from parent group "All Staff"')).toBeInTheDocument();
  expect(getGroupAccessibleGroups).toHaveBeenCalledWith('client', 'Nursing');
  await wait(() => expect(getExistingShortcutStates).toHaveBeenCalledWith('client', [
    { granteeRule: 'group:Nursing', targetGroupId: 'Admin' },
    { granteeRule: 'group:Nursing', targetGroupId: 'AllStaff' },
  ]));
});

it('reflects existing shortcut state per candidate', async () => {
  getGroupAccessibleGroups.mockResolvedValue([
    { group_id: 'Admin', group_name: 'Admin', reason: 'Granted directly' },
    { group_id: 'AllStaff', group_name: 'All Staff', reason: 'Open to everyone' },
  ]);
  getExistingShortcutStates.mockImplementation(async () => ({ 'msgshortcut~group:Nursing~Admin': true }));
  render(<GroupMessagingSection {...props} />);
  const checkboxes = await screen.findAllByRole('checkbox');
  await wait(() => expect(checkboxes[0]).toBeChecked());
  expect(checkboxes[1]).not.toBeChecked();
});

it('enables a shortcut with this group as the grantee and the candidate as the message target', async () => {
  getGroupAccessibleGroups.mockResolvedValue([{ group_id: 'Admin', group_name: 'Admin', reason: 'Granted directly' }]);
  render(<GroupMessagingSection {...props} />);
  const checkbox = await screen.findByRole('checkbox');
  fireEvent.click(checkbox);
  await wait(() => expect(setMessageShortcut).toHaveBeenCalledWith({
    client_id: 'client', granteeRule: 'group:Nursing', targetGroupId: 'Admin', targetGroupName: 'Admin', enabled: true
  }));
});

it('reverts the checkbox if the shortcut write fails', async () => {
  getGroupAccessibleGroups.mockResolvedValue([{ group_id: 'Admin', group_name: 'Admin', reason: 'Granted directly' }]);
  setMessageShortcut.mockImplementation(async () => null);
  render(<GroupMessagingSection {...props} />);
  const checkbox = await screen.findByRole('checkbox');
  fireEvent.click(checkbox);
  await wait(() => expect(setMessageShortcut).toHaveBeenCalled());
  await wait(() => expect(checkbox).not.toBeChecked());
});
