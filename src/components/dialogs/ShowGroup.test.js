import React from 'react';
import { render, wait } from '@testing-library/react';
import ShowGroup from './ShowGroup';
import GroupControl from '../forms/GroupControl';
import { getAllGroups } from '../../util/AVAGroups';

const mockGroups = {
  adminHierarchy: [
    { id: 'root', name: 'Root', level: 1 },
    { id: 'omitted', name: 'Omitted', belongs_to: 'root', level: 2 },
    { id: 'IL_residents', name: 'IL Residents', belongs_to: 'omitted', level: 3 },
    { id: 'child', name: 'Child', belongs_to: 'IL_residents', level: 4 },
    { id: 'grandchild', name: 'Grandchild', belongs_to: 'child', level: 5 },
    { id: 'other', name: 'Other', belongs_to: 'root', level: 2 },
  ],
  publicGroups: { club: { group_name: 'Club', role: 'member' } },
  privateGroups: {},
  belongsTo: {},
  authorizedGroups: ['IL_residents', 'child', 'grandchild', 'other', 'club'],
};
jest.mock('../../hooks/useSession', () => () => ({
  state: {
    session: { client_id: 'client', patient_id: 'person' },
    groups: mockGroups,
    accessList: { client: { groups: mockGroups.authorizedGroups } },
  },
  dispatch: jest.fn(),
}));
jest.mock('../../util/AVAGroups', () => ({
  getRole: async () => 'responsible',
  getAllGroups: jest.fn(),
}));
jest.mock('../../util/AVAUtilities', () => ({ makeArray: value => value || [] }));
jest.mock('../forms/GroupControl', () => jest.fn(() => null));

it.each([false, true])('rebases included admin trees with public groups=%s without changing stored hierarchy', async includePublic => {
  getAllGroups.mockResolvedValue(mockGroups);
  GroupControl.mockClear();
  render(<ShowGroup
    options={{
      pSession: {}, showList: 'select',
      pGroup_id: ['IL_residents', 'other', ...(includePublic ? ['*all_public'] : [])],
    }}
    defaults={{}}
  />);
  await wait(() => expect(GroupControl).toHaveBeenCalled());
  const { groupsManagedObject: list } = GroupControl.mock.calls.slice(-1)[0][0];
  expect(list.IL_residents.level).toBe(2);
  expect(list.child.level).toBe(3);
  expect(list.grandchild.level).toBe(4);
  expect(list.other.level).toBe(2);
  expect(list.root).toBeUndefined();
  expect(list.omitted).toBeUndefined();
  if (includePublic) {
    expect(list.__PUBLIC_GROUPS__.level).toBe(1);
    expect(list.club.level).toBe(2);
    const minimumGroupLevel = Math.min(...Object.values(list).map(group => group.level)) - 1;
    expect(list.IL_residents.level - minimumGroupLevel).toBeLessThan(3);
    expect(list.child.level - minimumGroupLevel).toBe(3);
  }
  expect(mockGroups.adminHierarchy.find(group => group.id === 'IL_residents').level).toBe(3);
});
