import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import GroupAssignments from './GroupAssignments';

jest.mock('../../hooks/useSession', () => () => ({
  state: { session: { client_id: 'client' }, groups: {} },
}));
jest.mock('../../util/AVAUtilities', () => ({
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  isMobile: () => false,
}));
jest.mock('../../util/AVAGroups', () => ({
  ...jest.requireActual('../../util/AVAGroups'),
  addMember: jest.fn(async () => []),
  removeMember: jest.fn(async () => []),
}));
jest.mock('../../util/AVAStyles', () => ({
  AVATextStyle: options => ({
    fontWeight: options.bold ? 'bold' : undefined,
    color: options.color,
  }),
}));

const adminHierarchy = [
  { id: 'root1', belongs_to: '__TOP__', level: 0, name: 'Root One', selectable: false },
  { id: 'child1', belongs_to: 'root1', level: 1, name: 'Child One', selectable: false },
  { id: 'grandchild1', belongs_to: 'child1', level: 2, name: 'Grandchild One', selectable: true },
  { id: 'root2', belongs_to: '__TOP__', level: 0, name: 'Root Two', selectable: true },
];

const baseProps = {
  currentValues: { peopleRec: { person_id: 'person', client_id: 'client', groups: ['grandchild1'] } },
  updateField: jest.fn(),
};

function renderGroupAssignments() {
  const updateReactData = jest.fn();
  const utils = render(<GroupAssignments
    {...baseProps}
    reactData={{
      groupObj: { adminHierarchy, publicGroups: {} },
      inactive_groups: [],
    }}
    updateReactData={updateReactData}
  />);
  return { ...utils, updateReactData };
}

it('shows member groups highlighted and non-member ancestors dimmed for context in the reference list', async () => {
  renderGroupAssignments();
  await screen.findByText('Current Groups (reference only)');

  const memberRow = screen.getByText('Grandchild One');
  expect(memberRow.style.fontWeight).toBe('bold');
  expect(memberRow.style.color).toBe('rgb(46, 125, 50)');

  const ancestorRow = screen.getAllByText('Child One')[0];
  expect(ancestorRow.style.fontWeight).toBe('');
  expect(ancestorRow.style.color).toBe('gray');

  // Root Two is neither a member nor an ancestor of a membership - it shouldn't appear at all.
  expect(screen.queryAllByText('Root Two')).toHaveLength(1); // only the selection-list copy below
});

it('hides levels beyond the top 2 by default and reveals them via the eyeball icon', async () => {
  renderGroupAssignments();
  await screen.findByText('Administrative Groups');

  // "Grandchild One" appears once already (reference list); the selection list's copy should
  // not be rendered until its parent ("Child One") is expanded.
  expect(screen.getAllByText('Grandchild One')).toHaveLength(1);

  const childRows = screen.getAllByText('Child One');
  const selectionChildRow = childRows[childRows.length - 1].closest('div');
  const eyeballIcon = selectionChildRow.querySelector('svg');
  fireEvent.click(eyeballIcon);

  expect(screen.getAllByText('Grandchild One')).toHaveLength(2);
});

it('omits the eyeball icon on top-level rows, where it could never toggle anything', async () => {
  renderGroupAssignments();
  await screen.findByText('Administrative Groups');

  const rootRows = screen.getAllByText('Root One');
  const selectionRootRow = rootRows[rootRows.length - 1].closest('div');
  expect(selectionRootRow.querySelector('svg')).toBeNull();
});
