import React from 'react';
import { fireEvent, render, screen, wait, act } from '@testing-library/react';
import LoginModuleV2 from './LoginModuleV2';
import { dbClient } from '../../util/AVAUtilities';

let mockStyle = {};
jest.mock('../../hooks/useSession', () => () => ({
  state: { session: { client_id: 'client', client_name: 'Theseus Clinic', client_style: mockStyle } },
  dispatch: jest.fn(),
}));
jest.mock('aws-amplify', () => ({ Auth: {} }));
jest.mock('react-cookie', () => ({ useCookies: () => [{}, jest.fn(), jest.fn()] }));
jest.mock('../../hooks/useIosCheck', () => () => [false]);
jest.mock('../../util/AVAUtilities', () => ({ dbClient: { get: jest.fn(), query: jest.fn(), scan: jest.fn() } }));
jest.mock('../../util/AVAMessages', () => ({}));
jest.mock('../../util/AVAStyles', () => ({ AVAclasses: () => ({}), AVADefaults: () => ({}) }));
jest.mock('../../util/AVAGroups', () => ({}));
jest.mock('../../util/AVACalendars', () => ({}));
jest.mock('../../util/AVADateTime', () => ({}));
jest.mock('../../util/MakeAVAMenu', () => () => null);
jest.mock('./QuickAdd', () => props => <div data-testid='quick-add'>{JSON.stringify(props.options)}</div>);

beforeEach(() => {
  jest.clearAllMocks();
  mockStyle = {};
  window.history.replaceState({}, '', '/');
  window.matchMedia = jest.fn(() => ({ matches: false, addListener: jest.fn(), removeListener: jest.fn() }));
  dbClient.query.mockImplementation(() => ({ promise: async () => ({ Items: [
    { client_id: 'client', preauth_key: 'Default-Code', preauth_data: { account_type: 'resident' } },
    { client_id: 'client', preauth_key: 'Manual-Code', preauth_data: { account_type: 'visitor' } },
  ] }) }));
  dbClient.scan.mockImplementation(() => ({ promise: async () => ({ Items: [] }) }));
});

function open(preAuth) {
  mockStyle = preAuth === undefined ? {} : { preAuth };
  render(<LoginModuleV2 initialStep='preauth' />);
}

function codeInput() {
  return screen.getByText('Authorization code', { selector: 'label' }).parentElement.querySelector('input');
}

it.each([true, 1, 'true', 'false'])('requires manual entry when require_pre_auth is truthy (%s)', value => {
  open({ require_pre_auth: value, default_code: 'Default-Code' });
  expect(screen.queryByText('Skip')).not.toBeInTheDocument();
  expect(screen.getByText("New accounts require an authorization code. Please check with Theseus Clinic if you don't have one.")).toBeInTheDocument();
});

it.each([false, null, 0, '', undefined])('uses the default code on Skip when require_pre_auth is falsy (%s)', async value => {
  open({ require_pre_auth: value, default_code: ' default-code ' });
  fireEvent.click(screen.getByText('Skip'));
  const quickAdd = await screen.findByTestId('quick-add');
  expect(JSON.parse(quickAdd.textContent)).toEqual({
    client_id: 'client', preauth_code: 'Default-Code', source: 'login_preauth',
  });
  expect(dbClient.query.mock.calls[0][0]).toMatchObject({
    TableName: 'PreAuthorization', ExpressionAttributeValues: { ':c': 'client' },
  });
  expect(dbClient.scan).not.toHaveBeenCalled();
});

it('allows skipping when the entire preAuth configuration is absent but requires a code without a default', () => {
  open();
  fireEvent.click(screen.getByText('Skip'));
  expect(screen.getByText(/No default authorization code is configured/)).toBeInTheDocument();
  expect(screen.queryByTestId('quick-add')).not.toBeInTheDocument();
  expect(dbClient.query).not.toHaveBeenCalled();
});

it.each([{}, { default_code: '' }, { default_code: 'missing' }])('warns for missing/invalid defaults %j and accepts a manual code afterward', async config => {
  open({ require_pre_auth: false, ...config });
  fireEvent.click(screen.getByText('Skip'));
  expect(await screen.findByText(/Please enter a valid authorization code to continue/)).toBeInTheDocument();
  expect(screen.queryByTestId('quick-add')).not.toBeInTheDocument();
  fireEvent.change(codeInput(), { target: { value: 'manual-code' } });
  fireEvent.click(screen.getByText('Continue'));
  expect(JSON.parse((await screen.findByTestId('quick-add')).textContent).preauth_code).toBe('Manual-Code');
});

it.each([true, false])('uses the entered code rather than the default on Continue (required=%s)', async required => {
  open({ require_pre_auth: required, default_code: 'Default-Code' });
  fireEvent.change(codeInput(), { target: { value: ' Manual-code ' } });
  fireEvent.click(screen.getByText('Continue'));
  expect(JSON.parse((await screen.findByTestId('quick-add')).textContent).preauth_code).toBe('Manual-Code');
});

it('uses the default rather than text in the input on Skip', async () => {
  open({ default_code: 'Default-Code' });
  fireEvent.change(codeInput(), { target: { value: 'Manual-Code' } });
  fireEvent.click(screen.getByText('Skip'));
  expect(JSON.parse((await screen.findByTestId('quick-add')).textContent).preauth_code).toBe('Default-Code');
});

it('keeps an invalid manual code at the prompt even when a valid default exists', async () => {
  open({ default_code: 'Default-Code' });
  fireEvent.change(codeInput(), { target: { value: 'Not-a-code' } });
  fireEvent.click(screen.getByText('Continue'));
  expect(await screen.findByText('That authorization code was not recognized. Please check it and try again.')).toBeInTheDocument();
  expect(screen.queryByTestId('quick-add')).not.toBeInTheDocument();
  expect(codeInput().value).toBe('Not-a-code');
});

it('continues manual code entry with Enter', async () => {
  open({ require_pre_auth: true });
  fireEvent.change(codeInput(), { target: { value: 'Manual-Code' } });
  fireEvent.keyDown(codeInput(), { key: 'Enter' });
  expect(JSON.parse((await screen.findByTestId('quick-add')).textContent).preauth_code).toBe('Manual-Code');
});

it('searches subsequent lookup pages before treating a default as invalid', async () => {
  const lastKey = { client_id: 'client', preauth_key: 'first-page' };
  dbClient.query.mockImplementationOnce(() => ({ promise: async () => ({ Items: [], LastEvaluatedKey: lastKey }) }));
  open({ default_code: 'Default-Code' });
  fireEvent.click(screen.getByText('Skip'));
  await screen.findByTestId('quick-add');
  expect(dbClient.query.mock.calls[1][0].ExclusiveStartKey).toEqual(lastKey);
});

it('reports lookup errors without proceeding and re-enables actions', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  dbClient.query.mockImplementationOnce(() => ({ promise: async () => { throw new Error('offline'); } }));
  open({ default_code: 'Default-Code' });
  fireEvent.click(screen.getByText('Skip'));
  expect(await screen.findByText('Unable to check the authorization code right now. Please try again.')).toBeInTheDocument();
  expect(screen.queryByTestId('quick-add')).not.toBeInTheDocument();
  expect(screen.getByText('Skip').closest('button').disabled).toBe(false);
  expect(errorLog).toHaveBeenCalled();
  errorLog.mockRestore();
});

it('disables the input and both actions while a code lookup is pending', async () => {
  let resolveQuery;
  dbClient.query.mockImplementationOnce(() => ({ promise: () => new Promise(resolve => { resolveQuery = resolve; }) }));
  open({ default_code: 'Default-Code' });
  fireEvent.change(codeInput(), { target: { value: 'Manual-Code' } });
  fireEvent.click(screen.getByText('Skip'));
  expect(codeInput().disabled).toBe(true);
  expect(screen.getByText('Continue').closest('button').disabled).toBe(true);
  expect(screen.getByText('Skip').closest('button').disabled).toBe(true);
  await act(async () => { resolveQuery({ Items: [] }); });
  await wait(() => expect(codeInput().disabled).toBe(false));
});
