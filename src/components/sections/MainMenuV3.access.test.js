import React from 'react';
import { fireEvent, render, screen, wait, within } from '@testing-library/react';
import MainMenuV3 from './MainMenuV3';
import { dbClient } from '../../util/AVAUtilities';

let mockAccountClass = 'admin';
jest.mock('@aws-amplify/auth', () => ({ Auth: {} }));
jest.mock('react-cookie', () => ({ useCookies: () => [{}, jest.fn(), jest.fn()] }));
jest.mock('react-idle-timer', () => ({ useIdleTimer: () => ({ start: jest.fn(), reset: jest.fn(), pause: jest.fn() }) }));
jest.mock('../../hooks/useIosCheck', () => () => [false, false]);
jest.mock('../../hooks/useWebPrompt', () => () => [null, null, jest.fn()]);
jest.mock('../../hooks/useSession', () => () => ({
  state: {
    user: { account_class: mockAccountClass },
    session: { client_id: 'client', user_id: 'user', patient_id: 'user', client_style: {}, expireAt: 0 },
    roles: [],
    groups: { adminHierarchy: [] },
    accessList: {}
  }
}));
jest.mock('../../util/AVAUtilities', () => ({
  dbClient: { update: jest.fn(), query: jest.fn(), get: jest.fn(), put: jest.fn() },
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  cl: jest.fn(),
  listFromArray: () => '',
  stringToColor: () => 'white',
  recordExists: response => !!response?.Item
}));
jest.mock('../../util/AVAStyles', () => ({
  AVATextStyle: () => ({}), AVAclasses: () => ({}), AVADefaults: () => ({}),
  hexToRgb: () => 'white', isDark: () => false
}));
jest.mock('../../util/AVADateTime', () => ({
  makeDate: () => ({ absolute: 'Monday at noon', timeShort: 'noon', numeric: 20261027 }),
  makeTime: () => ({})
}));
jest.mock('../../util/AVAPeople', () => ({ getImage: () => '' }));
jest.mock('../../util/AVAPushNotifications', () => ({ isPushSupported: () => false }));
jest.mock('../../util/AVAActivityLoaderV3', () => ({}));
jest.mock('../../util/AVAObservations', () => ({}));
jest.mock('../../util/AVANotifications', () => ({}));
jest.mock('./QuickAdd', () => () => null);
jest.mock('../dialogs/SwitchPatientDialog', () => () => null);
jest.mock('../dialogs/PeopleMaintenance', () => () => null);
jest.mock('../dialogs/FormManagement', () => () => null);
jest.mock('../dialogs/FormBuilder', () => () => null);
jest.mock('../forms/FormFillB', () => () => null);
jest.mock('../dialogs/ClientMaintenance', () => () => null);
jest.mock('../forms/MessageForm', () => () => null);
jest.mock('../dialogs/ShowGroup', () => () => null);
jest.mock('../dialogs/ShowCalendar', () => () => null);
jest.mock('../forms/AVAConfirm', () => () => null);
jest.mock('../forms/LoadSpreadsheet', () => () => null);
jest.mock('../dialogs/NewCalendarEvent', () => () => null);
jest.mock('../forms/MessageMonitorV3', () => () => null);
jest.mock('../forms/CheckInCheckOut', () => () => null);
jest.mock('../dialogs/NotificationMaintenance', () => () => null);
jest.mock('../dialogs/MessageTemplateManager', () => () => null);
jest.mock('../forms/GroupPhotoDirectory', () => () => null);
jest.mock('../dialogs/TaskManager', () => () => null);
jest.mock('../forms/MultiObservationFormV3', () => () => null);
jest.mock('../forms/MultiObservationFormC', () => () => null);
jest.mock('../dialogs/RequestDashboardV3', () => () => null);
jest.mock('../dialogs/IosInstall', () => () => null);
jest.mock('../dialogs/ShowMenuB', () => () => null);
jest.mock('./QuickSearch', () => props => (
  <div data-testid='access-picker'>
    <span>{props.options.title}</span>
    <span data-testid='picker-selections'>{JSON.stringify(props.reactData.selections)}</span>
    <button onClick={() => props.onClose([{ person_id: 'chosen' }, { group_id: 'team' }, { person_id: '*admin' }])}>Choose access</button>
    <button onClick={() => props.onClose([])}>Clear access</button>
  </div>
));

let editorState;
let menuRec;
let openViaAlert;
let openAddMenu;
let initialAddType;
const realUseState = React.useState;

beforeEach(() => {
  jest.clearAllMocks();
  mockAccountClass = 'admin';
  window.matchMedia = jest.fn(() => ({ matches: false, addListener: jest.fn(), removeListener: jest.fn() }));
  menuRec = {
    menu_id: 'menu1', menu_itemType: 'menu',
    available_to: ['person:viewer', '!person:hidden'],
    allow_add: ['person:author', '*support', '!person:blocked', 'legacy-rule']
  };
  editorState = null;
  openViaAlert = false;
  openAddMenu = false;
  initialAddType = null;
  // Isolate the editor from menu bootstrapping, polling, and session-policy effects.
  jest.spyOn(React, 'useEffect').mockImplementation(() => {});
  jest.spyOn(React, 'useState').mockImplementation(initial => {
    if (initial?.menu_hierarchy) {
      const state = realUseState({
        ...initial,
        loading: false,
        editDescriptionDialog: !openViaAlert && !openAddMenu,
        addMenuDialog: openAddMenu,
        addMenuDialogTitle: 'New Function',
        addMenuDialogType: initialAddType,
        addMenuDialogParent: 'menu1',
        addMenuDialogLevel: 1,
        addMenuDialogAvailableTo: ['group:team'],
        addMenuDialogAccessReviewed: true,
        alert: openViaAlert ? {
          severity: 'info',
          message: 'Item details',
          editMenuItem: {
            menu_id: menuRec.menu_id,
            item_type: menuRec.menu_itemType,
            description_short: 'Resources',
            available_to: menuRec.available_to,
            allow_add: menuRec.allow_add
          }
        } : false,
        editDescriptionMenuId: menuRec.menu_id,
        editDescriptionShort: 'Resources',
        editDescriptionLong: '',
        editDescriptionItemType: menuRec.menu_itemType,
        editDescriptionAvailableTo: [...menuRec.available_to],
        editDescriptionAllowAdd: [...menuRec.allow_add],
        menu_hierarchy: [[{ menu_id: menuRec.menu_id, menuItemRec: menuRec }]]
      });
      editorState = state[0];
      return state;
    }
    return realUseState(initial);
  });
  dbClient.update.mockImplementation(() => ({ promise: async () => ({}) }));
  dbClient.put.mockImplementation(() => ({ promise: async () => ({}) }));
  dbClient.get.mockImplementation(({ Key }) => ({ promise: async () => Key.menu_id === 'menu1' ? { Item: menuRec } : {} }));
});

afterEach(() => jest.restoreAllMocks());

const menuInput = label => screen.getByLabelText(label);

it('allows a master to create a Function card through the main menu', async () => {
  mockAccountClass = 'master';
  openAddMenu = true;
  render(<MainMenuV3 />);
  fireEvent.click(screen.getByLabelText('Function'));
  fireEvent.change(menuInput('Function target'), { target: { value: 'ShowGroup' } });
  const params = { options: { pSession: '<sessionRec>', pGroup_id: ['residents', '*all_public'] }, request: { editable: true } };
  fireEvent.change(menuInput('Function params (JSON)'), { target: { value: JSON.stringify(params) } });
  fireEvent.click(screen.getByText('Add'));
  await wait(() => expect(dbClient.put).toHaveBeenCalled());
  expect(dbClient.put.mock.calls[0][0].Item).toMatchObject({
    client_id: 'client', menu_itemType: 'function', description: { short: 'New Function' },
    available_to: ['group:team'], call: { target: 'ShowGroup', params },
  });
  expect(dbClient.put.mock.calls[0][0].Item).not.toHaveProperty('children');
  await wait(() => expect(editorState.addMenuDialog).toBe(false));
  expect(editorState.addMenuDialogFunctionTarget).toBe('');
  expect(editorState.addMenuDialogFunctionParamsText).toBe('{}');
});

it.each(['admin', 'support', 'patient'])('hides the Function radio and blocks injected Function creation for %s', async accountClass => {
  mockAccountClass = accountClass;
  openAddMenu = true;
  initialAddType = 'function';
  render(<MainMenuV3 />);
  expect(screen.queryByLabelText('Function')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Add'));
  expect(await screen.findByText('Only master accounts can create Function menu items.')).toBeInTheDocument();
  expect(dbClient.put).not.toHaveBeenCalled();
});

it('blocks invalid Function JSON without a database write in the main menu', async () => {
  mockAccountClass = 'master';
  openAddMenu = true;
  initialAddType = 'function';
  render(<MainMenuV3 />);
  fireEvent.change(menuInput('Function target'), { target: { value: 'ShowGroup' } });
  fireEvent.change(menuInput('Function params (JSON)'), { target: { value: '{invalid' } });
  fireEvent.click(screen.getByText('Add'));
  expect(await screen.findByText(/Params must be valid JSON/)).toBeInTheDocument();
  expect(dbClient.put).not.toHaveBeenCalled();
});

it.each(['put', 'update'])('keeps the main-menu Function draft open on %s failure', async operation => {
  mockAccountClass = 'master';
  openAddMenu = true;
  initialAddType = 'function';
  dbClient[operation].mockImplementationOnce(() => ({ promise: async () => { throw new Error('offline'); } }));
  render(<MainMenuV3 />);
  fireEvent.change(menuInput('Function target'), { target: { value: 'ShowGroup' } });
  fireEvent.click(screen.getByText('Add'));
  expect(await screen.findByText(/Unable to finish adding the menu item/)).toBeInTheDocument();
  expect(editorState.addMenuDialog).toBe(true);
  expect(editorState.addMenuDialogSaving).toBe(false);
  expect(editorState.addMenuDialogFunctionTarget).toBe('ShowGroup');
});

function accessRow(prompt) {
  return screen.getByText(prompt).parentElement.parentElement;
}

it('shows menu-only add permissions with the existing picker and persists them independently', async () => {
  render(<MainMenuV3 />);
  const prompt = 'Who can add items under "Resources"?';
  const row = accessRow(prompt);
  fireEvent.click(within(row).getByText('Edit Access'));
  expect(within(screen.getByTestId('access-picker')).getByText(prompt)).toBeInTheDocument();
  expect(JSON.parse(screen.getByTestId('picker-selections').textContent)).toEqual([
    { person_id: 'author' }, { person_id: '*support', person_name: '* Support Staff' }
  ]);
  fireEvent.click(screen.getByText('Choose access'));
  expect(editorState.editDescriptionAllowAdd).toEqual([
    '!person:blocked', 'legacy-rule', 'person:chosen', 'group:team', '*admin'
  ]);
  expect(editorState.editDescriptionAvailableTo).toEqual(['person:viewer', '!person:hidden']);
  fireEvent.click(screen.getByText('Save'));
  await wait(() => expect(dbClient.update).toHaveBeenCalled());
  const spec = dbClient.update.mock.calls[0][0];
  expect(spec.UpdateExpression).toContain('allow_add = :allowAdd');
  expect(spec.ExpressionAttributeValues[':allowAdd']).toEqual(menuRec.allow_add);
  expect(menuRec.allow_add).toContain('person:chosen');
  expect(spec.ExpressionAttributeValues[':a']).toEqual(['person:viewer', '!person:hidden']);
});

it('preserves allow rules while editing exclusions and supports clearing each side', () => {
  render(<MainMenuV3 />);
  let row = accessRow('Who can add items under "Resources"?');
  fireEvent.click(within(row).getByRole('checkbox'));
  fireEvent.click(within(row).getByText('Edit Exclusions'));
  expect(JSON.parse(screen.getByTestId('picker-selections').textContent)).toEqual([{ person_id: 'blocked' }]);
  fireEvent.click(screen.getByText('Choose access'));
  expect(editorState.editDescriptionAllowAdd).toEqual([
    'person:author', '*support', 'legacy-rule', '!person:chosen', '!group:team', '!*admin'
  ]);
  row = accessRow('Who can add items under "Resources"?');
  fireEvent.click(within(row).getByText('Edit Exclusions'));
  fireEvent.click(screen.getByText('Clear access'));
  expect(editorState.editDescriptionAllowAdd).toEqual(['person:author', '*support', 'legacy-rule']);
  fireEvent.click(within(row).getByRole('checkbox'));
  fireEvent.click(within(row).getByText('Edit Access'));
  fireEvent.click(screen.getByText('Clear access'));
  expect(editorState.editDescriptionAllowAdd).toEqual(['*all', 'legacy-rule']);
});

it.each(['link', 'function', 'message_target'])('does not show or save allow_add for %s items', async type => {
  menuRec.menu_itemType = type;
  render(<MainMenuV3 />);
  expect(screen.queryByText('Who can add items under "Resources"?')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Save'));
  await wait(() => expect(dbClient.update).toHaveBeenCalled());
  const spec = dbClient.update.mock.calls[0][0];
  expect(spec.UpdateExpression).not.toContain('allow_add');
  expect(spec.ExpressionAttributeValues).not.toHaveProperty(':allowAdd');
  expect(menuRec.allow_add).toEqual(['person:author', '*support', '!person:blocked', 'legacy-rule']);
});

it('leaves allow_add unchanged when the visibility picker is edited', () => {
  render(<MainMenuV3 />);
  fireEvent.click(within(accessRow('Who can see this item')).getByText('Edit Access'));
  fireEvent.click(screen.getByText('Choose access'));
  expect(editorState.editDescriptionAvailableTo).toEqual(['!person:hidden', 'person:chosen', 'group:team', '*admin']);
  expect(editorState.editDescriptionAllowAdd).toEqual(menuRec.allow_add);
});

it('loads the saved add rules when opening the item edit panel and cancels without writing', () => {
  openViaAlert = true;
  render(<MainMenuV3 />);
  fireEvent.click(screen.getByLabelText('Edit menu item'));
  expect(editorState.editDescriptionAllowAdd).toEqual(menuRec.allow_add);
  fireEvent.click(within(accessRow('Who can add items under "Resources"?')).getByText('Edit Access'));
  fireEvent.click(screen.getByText('Choose access'));
  fireEvent.click(screen.getByText('Cancel'));
  expect(dbClient.update).not.toHaveBeenCalled();
  expect(menuRec.allow_add).toEqual(['person:author', '*support', '!person:blocked', 'legacy-rule']);
});

it('reports save errors without applying add rules to the cached item', async () => {
  dbClient.update.mockImplementation(() => ({ promise: async () => { throw new Error('write failed'); } }));
  render(<MainMenuV3 />);
  fireEvent.click(within(accessRow('Who can add items under "Resources"?')).getByText('Edit Access'));
  fireEvent.click(screen.getByText('Choose access'));
  fireEvent.click(screen.getByText('Save'));
  await wait(() => expect(editorState.alert.severity).toBe('error'));
  expect(menuRec.allow_add).toEqual(['person:author', '*support', '!person:blocked', 'legacy-rule']);
});
