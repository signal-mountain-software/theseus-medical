import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PeopleMaintenance from './PeopleMaintenance';
import { dbClient } from '../../util/AVAUtilities';

const mockState = {
  user: { account_class: 'master', person_id: 'operator' },
  session: { client_id: 'client', patient_id: 'person', client_style: {} },
  groups: {},
};

jest.mock('../../hooks/useSession', () => () => ({ state: mockState, dispatch: jest.fn() }));
jest.mock('aws-sdk', () => ({ config: { update: jest.fn() } }));
jest.mock('../../util/AVAPeople', () => ({ getPerson: jest.fn(), getImage: () => '' }));
jest.mock('../../util/AVAUtilities', () => ({
  dbClient: { get: jest.fn(), query: jest.fn() },
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  isEmpty: value => value == null || value === '',
  recordExists: result => !!result?.Item || !!result?.Items?.length,
  cl: jest.fn(),
}));
jest.mock('../../util/AVAStyles', () => ({ AVAclasses: () => ({}), AVATextStyle: () => ({}), isDark: () => false }));
jest.mock('../../util/AVAGroups', () => ({}));
jest.mock('../../util/AVASessionSync', () => ({}));
jest.mock('../sections/ProfileSection', () => () => <div>Contact content</div>);
jest.mock('../sections/AdministrativeSection', () => () => null);
jest.mock('../sections/Snapshot', () => () => null);
jest.mock('../sections/FormSection', () => ({ currentOnly, reactData, updateReactData }) => (
  <div>
    <span>{currentOnly ? 'Current forms content' : 'All forms content'}</span>
    <span>{`${currentOnly ? 'Current' : 'All'} cache: ${reactData.masterCategoryList?.join(',') || 'empty'}`}</span>
    <button onClick={() => updateReactData({ masterCategoryList: ['current-category'], formsInitialized: true }, true)}>
      {currentOnly ? 'Update current cache' : 'Update all cache'}
    </button>
  </div>
));
jest.mock('../sections/TechInfoSection', () => () => null);
jest.mock('../sections/MessagePreferencesSection', () => () => <div>Messaging content</div>);
jest.mock('../sections/PeopleDocumentsSection', () => () => null);
jest.mock('./PersonNotes', () => () => null);
jest.mock('./CheckoutHistory', () => () => null);
jest.mock('../sections/LinkedAccounts', () => () => null);
jest.mock('../sections/PersonalizationSection', () => () => null);
jest.mock('../sections/GroupAssignments', () => () => null);
jest.mock('../sections/ActivitiesSection', () => () => null);
jest.mock('../sections/TaskManagerSection', () => () => null);
jest.mock('../forms/MessageMonitorV3', () => () => <div>Message monitor</div>);

const sections = [
  ['snapshot', 'Snapshot'],
  ['admin', 'Additional Data'],
  ['contact', 'Name & Contact info'],
  ['messaging', 'Messaging'],
  ['message_history', 'Message History'],
  ['activities', 'Events & Participation'],
  ['task_manager', 'Daily Activities & Tasks'],
  ['family', 'My Family'],
  ['personal', 'Photo & Personalization'],
  ['groups', 'Groups'],
  ['forms', 'Forms & Documents'],
  ['current', 'Current Forms'],
  ['documents', 'Archived Documents'],
  ['notes', 'Notes'],
  ['checkout', 'Check-in/Check-out History'],
  ['tech', 'Password & Tech Stuff'],
];

beforeEach(() => {
  jest.clearAllMocks();
  mockState.user.account_class = 'master';
  mockState.session.client_style = {};
  mockState.session.profile_style = {};
  dbClient.query.mockImplementation(({ TableName }) => ({
    promise: async () => ({ Items: TableName === 'PeopleGroups' ? [{ client_group_id: 'client~group' }] : [] }),
  }));
  dbClient.get.mockImplementation(({ TableName }) => ({
    promise: async () => ({
      Item: TableName === 'People'
        ? { person_id: 'person', client_id: 'client', account_class: 'user', name: { first: 'Test', last: 'Person' } }
        : TableName === 'Groups' ? { linked_accounts: { isEnabled: false } } : {},
    }),
  }));
});

const openProfile = async (options = {}) => {
  render(<PeopleMaintenance person_id='person' options={options} onClose={jest.fn()} />);
  await screen.findByText('Test Person');
};

const expectOnlySections = keys => {
  sections.forEach(([key, title]) => {
    if (keys.includes(key)) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
    else {
      expect(screen.queryByText(title)).not.toBeInTheDocument();
    }
  });
};

it.each(['user', 'admin', 'support', 'master'])('limits %s accounts to the explicit list', async accountClass => {
  mockState.user.account_class = accountClass;
  await openProfile({ sectionList: ['contact'] });
  expectOnlySections(['contact']);
});

it.each(sections)('shows only the explicitly listed %s section', async key => {
  mockState.session.client_style.profile_sections_visible = Object.fromEntries(sections.map(([id]) => [id, false]));
  await openProfile({ sectionList: [key] });
  expectOnlySections([key]);
});

it('treats an empty list as showing no sections', async () => {
  await openProfile({ sectionList: [] });
  expectOnlySections([]);
});

it('gives the list precedence over section security and sectionToShow', async () => {
  mockState.user.account_class = 'user';
  mockState.session.profile_style.section_security = {
    ProfileSection: ['*all'],
    PersonNotes: ['*master'],
  };
  await openProfile({ sectionList: ['notes'], sectionToShow: 'ProfileSection' });
  expectOnlySections(['notes']);
});

it('preserves client visibility settings when no list is supplied', async () => {
  mockState.user.account_class = 'user';
  mockState.session.client_style.profile_sections_visible = Object.fromEntries(sections.map(([id]) => [id, false]));
  await openProfile();
  expectOnlySections([]);
});

it('honors explicit visibility settings for master accounts when no list is supplied', async () => {
  mockState.session.client_style.profile_sections_visible = Object.fromEntries(sections.map(([id]) => [id, false]));
  await openProfile();
  expectOnlySections([]);
});

it('honors explicit visibility settings for admin accounts when no list is supplied', async () => {
  mockState.user.account_class = 'admin';
  mockState.session.client_style.profile_sections_visible = Object.fromEntries(sections.map(([id]) => [id, false]));
  await openProfile();
  expectOnlySections([]);
});

it.each([
  ['personal', 'Photo & Personalization'],
  ['documents', 'Archived Documents'],
  ['task_manager', 'Daily Activities & Tasks'],
  ['current', 'Current Forms'],
])('uses the existing %s visibility toggle without renaming stored settings', async (key, title) => {
  mockState.session.client_style.profile_sections_visible = { [key]: false };
  await openProfile();
  expect(screen.queryByText(title)).not.toBeInTheDocument();
  expect(screen.getByText('Name & Contact info')).toBeInTheDocument();
});

it('keeps the admin visibility toggle separate from Name & Contact info', async () => {
  mockState.session.client_style.profile_sections_visible = { admin: false };
  await openProfile();
  expect(screen.queryByText('Additional Data')).not.toBeInTheDocument();
  expect(screen.getByText('Name & Contact info')).toBeInTheDocument();
});

it('uses contact to hide Name & Contact info independently of Additional Data', async () => {
  mockState.session.client_style.profile_sections_visible = { contact: false };
  await openProfile();
  expect(screen.queryByText('Name & Contact info')).not.toBeInTheDocument();
  expect(screen.getByText('Additional Data')).toBeInTheDocument();
});

it.each([
  ['ProfileSection', 'MessagePreferencesSection'],
  ['messaging', 'contact'],
  ['Name & Contact info', 'Messaging'],
])('opens all requested sections using %s and %s', async (first, second) => {
  mockState.user.account_class = 'user';
  await openProfile({ sectionToShow: [first, second] });
  expectOnlySections(['contact', 'messaging']);
  expect(screen.getByText('Contact content')).toBeInTheDocument();
  expect(screen.getByText('Messaging content')).toBeInTheDocument();
});

it.each(['ProfileSection', ['contact']])('allows a requested section to collapse from its footer (%s)', async sectionToShow => {
  await openProfile({ sectionToShow });
  const content = screen.getByText('Contact content');
  fireEvent.click(content.parentElement.nextElementSibling);
  expect(screen.queryByText('Contact content')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Name & Contact info'));
  expect(screen.getByText('Contact content')).toBeInTheDocument();
});

it.each(['MessagesSection', 'message_history', 'Message History'])('opens %s in the message monitor', async sectionToShow => {
  mockState.user.account_class = 'user';
  await openProfile({ sectionToShow });
  expect(screen.getByText('Message monitor')).toBeInTheDocument();
});

it('does not open a hidden message monitor automatically', async () => {
  mockState.session.client_style.profile_sections_visible = { message_history: false };
  await openProfile({ sectionToShow: 'message_history' });
  expect(screen.queryByText('Message monitor')).not.toBeInTheDocument();
});

it('does not let section security re-enable hidden or admin-only sections', async () => {
  mockState.user.account_class = 'user';
  mockState.session.client_style.profile_sections_visible = { contact: false };
  mockState.session.profile_style.section_security = {
    ProfileSection: ['*all'],
    AdministrativeSection: ['*all'],
  };
  await openProfile();
  expect(screen.queryByText('Name & Contact info')).not.toBeInTheDocument();
  expect(screen.queryByText('Additional Data')).not.toBeInTheDocument();
});

it('allows section security to restrict an otherwise visible section', async () => {
  mockState.user.account_class = 'user';
  mockState.session.profile_style.section_security = { ProfileSection: ['*master'] };
  await openProfile();
  expect(screen.queryByText('Name & Contact info')).not.toBeInTheDocument();
});

it('does not let section security bypass add-mode restrictions', async () => {
  mockState.session.profile_style.section_security = { ActivitiesSection: ['*all'] };
  await openProfile({ mode: 'add' });
  expect(screen.queryByText('Events & Participation')).not.toBeInTheDocument();
});

it('reuses FormSection with separate caches for current and all forms', async () => {
  await openProfile({ sectionToShow: ['forms', 'current'] });
  expect(screen.getByText('All forms content')).toBeInTheDocument();
  expect(screen.getByText('Current forms content')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Update current cache'));
  expect(screen.getByText('Current cache: current-category')).toBeInTheDocument();
  expect(screen.getByText('All cache: empty')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Update all cache'));
  expect(screen.getByText('All cache: current-category')).toBeInTheDocument();
  expect(screen.getByText('Current cache: current-category')).toBeInTheDocument();
});
