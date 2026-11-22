import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import LinkedAccounts from './LinkedAccounts';

jest.mock('../../hooks/useSession', () => () => ({
  state: { session: { client_id: 'client' } },
}));
jest.mock('../../util/AVAStyles', () => ({
  AVATextStyle: () => ({}),
  AVAclasses: () => ({ AVAButton: 'AVAButton' }),
}));
jest.mock('@material-ui/core/styles/makeStyles', () => () => () => ({}));
jest.mock('../dialogs/PeopleMaintenance', () => () => null);
jest.mock('../sections/QuickSearch', () => () => null);
jest.mock('../sections/QuickAdd', () => () => null);
jest.mock('../forms/MakeMessage', () => () => null);

const mockDbGet = jest.fn();
const mockDbPut = jest.fn(() => ({ promise: async () => ({}) }));
const mockDbUpdate = jest.fn(() => ({ promise: async () => ({}) }));
const mockDbDelete = jest.fn(() => ({ promise: async () => ({}) }));

jest.mock('../../util/AVAUtilities', () => ({
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  getDb: jest.fn(),
  cl: jest.fn(),
  dbClient: {
    get: (...args) => mockDbGet(...args),
    put: (...args) => mockDbPut(...args),
    update: (...args) => mockDbUpdate(...args),
    delete: (...args) => mockDbDelete(...args),
  },
}));

const mockPersonRecords = {
  personA: { person_id: 'personA', family_groups: ['family_1'] },
  personB: { person_id: 'personB', family_groups: ['family_1'] },
};
jest.mock('../../util/AVAPeople', () => ({
  getPerson: jest.fn(async (id) => mockPersonRecords[id] || {}),
}));

function buildFamilyRec({ withOtherMember = true } = {}) {
  return {
    client_id: 'client',
    composite_key: 'family_1',
    family_id: 'family_1',
    family_name: 'The A Family',
    primary_contact: { id: 'personA', name: 'A Family', nickname: '' },
    other_members: withOtherMember
      ? [{ id: 'personB', name: 'B Member', nickname: '', role: 'messages' }]
      : [],
  };
}

function buildProps({ withOtherMember = true, editingPersonId = 'personA' } = {}) {
  return {
    currentValues: {
      peopleRec: {
        person_id: editingPersonId, client_id: 'client',
        name: { first: 'A', last: 'Family' },
        family_groups: ['family_1'], family_id: 'family_1',
      },
      familyRecs: [buildFamilyRec({ withOtherMember })],
    },
    updateField: jest.fn(),
  };
}

function renderLinkedAccounts(props) {
  const reactData = { OKtoShow_Family: true, administrative_account: false, user_id: 'personA' };
  const updateReactData = jest.fn((newData) => { Object.assign(reactData, newData); });
  const utils = render(<LinkedAccounts {...props} reactData={reactData} updateReactData={updateReactData} />);
  return { ...utils, updateReactData, reactData };
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('removes a non-primary member: updates FamilyGroups and the member\'s own People record', async () => {
  const props = buildProps({ withOtherMember: true });
  renderLinkedAccounts(props);

  fireEvent.click(await screen.findByText('B Member'));
  const removeButton = await screen.findByText('Remove from Family');
  fireEvent.click(removeButton);

  await screen.findByText('Remove B Member from The A Family? This cannot be undone.');
  fireEvent.click(screen.getByText('Confirm Removal'));

  await screen.findByText(/has been removed from/i);

  expect(mockDbPut).toHaveBeenCalledWith(expect.objectContaining({
    TableName: 'FamilyGroups',
    Item: expect.objectContaining({ other_members: [] }),
  }));
  expect(mockDbUpdate).toHaveBeenCalledWith(expect.objectContaining({
    Key: { person_id: 'personB' },
    TableName: 'People',
    UpdateExpression: 'SET family_groups = :fg REMOVE family_id',
    ExpressionAttributeValues: { ':fg': [] },
  }));
});

it('hides "Remove from Family" for the primary when other members still exist', async () => {
  const props = buildProps({ withOtherMember: true });
  renderLinkedAccounts(props);

  fireEvent.click(await screen.findByText('A Family'));
  await screen.findByText('Primary');
  expect(screen.queryByText('Remove from Family')).not.toBeInTheDocument();
});

it('syncs the open profile when it removes itself as a non-primary member', async () => {
  const props = buildProps({ withOtherMember: true, editingPersonId: 'personB' });
  renderLinkedAccounts(props);

  fireEvent.click(await screen.findByText('B Member'));
  fireEvent.click(await screen.findByText('Remove from Family'));
  await screen.findByText('Remove B Member from The A Family? This cannot be undone.');
  fireEvent.click(screen.getByText('Confirm Removal'));

  await screen.findByText(/has been removed from/i);

  expect(props.currentValues.familyRecs).toHaveLength(0);
  expect(props.currentValues.peopleRec.family_groups).toEqual([]);
  expect(props.currentValues.peopleRec.family_id).toBeUndefined();
});

it('keeps family_id pointing at a remaining family when the removed member still belongs to another', async () => {
  mockPersonRecords.personB.family_groups = ['family_1', 'family_2'];
  try {
    const props = buildProps({ withOtherMember: true });
    renderLinkedAccounts(props);

    fireEvent.click(await screen.findByText('B Member'));
    fireEvent.click(await screen.findByText('Remove from Family'));
    await screen.findByText('Remove B Member from The A Family? This cannot be undone.');
    fireEvent.click(screen.getByText('Confirm Removal'));

    await screen.findByText(/has been removed from/i);

    expect(mockDbUpdate).toHaveBeenCalledWith(expect.objectContaining({
      Key: { person_id: 'personB' },
      TableName: 'People',
      UpdateExpression: 'SET family_groups = :fg, family_id = :fid',
      ExpressionAttributeValues: { ':fg': ['family_2'], ':fid': 'family_2' },
    }));
  } finally {
    mockPersonRecords.personB.family_groups = ['family_1'];
  }
});

it('deletes the whole family when removing the primary who is the last member', async () => {
  const props = buildProps({ withOtherMember: false });
  renderLinkedAccounts(props);

  fireEvent.click(await screen.findByText('A Family'));
  const removeButton = await screen.findByText('Remove from Family');
  fireEvent.click(removeButton);

  await screen.findByText(/will delete the entire family group "The A Family"/);
  fireEvent.click(screen.getByText('Delete Family Group'));

  await screen.findByText(/removed, and the "The A Family" family group deleted/i);

  expect(mockDbDelete).toHaveBeenCalledWith(expect.objectContaining({
    TableName: 'FamilyGroups',
    Key: { client_id: 'client', composite_key: 'family_1' },
  }));
  expect(mockDbUpdate).toHaveBeenCalledWith(expect.objectContaining({
    Key: { person_id: 'personA' },
    TableName: 'People',
    UpdateExpression: 'SET family_groups = :fg REMOVE family_id',
    ExpressionAttributeValues: { ':fg': [] },
  }));
});
