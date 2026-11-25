import React from 'react';
import { cleanup, fireEvent, render, wait } from '@testing-library/react';
import QuickAdd from './QuickAdd';
import useSession from '../../hooks/useSession';
import { dbClient, getDb, putDb } from '../../util/AVAUtilities';
import { addMember } from '../../util/AVAGroups';

jest.mock('../../hooks/useSession', () => jest.fn());
jest.mock('react-cookie', () => ({ useCookies: () => [{}, jest.fn(), jest.fn()] }));
jest.mock('aws-amplify', () => ({ Auth: {} }));
jest.mock('../../util/AVAMessages', () => ({ sendMessages: jest.fn() }));
jest.mock('../forms/FormFillB', () => (props) => (
  <div data-testid='form-fill-mock'>
    <div data-testid='form-fill-request'>{JSON.stringify(props.request)}</div>
    <button onClick={() => props.onClose(null, { document_status: 'complete', recWritten: {} })}>
      Complete Form Fill
    </button>
    <button onClick={() => props.onClose(null, { document_status: 'aborted' })}>
      Abort Form Fill
    </button>
  </div>
));
jest.mock('../../util/AVAStyles', () => ({
  AVATextStyle: () => ({}),
  AVAclasses: () => ({})
}));
jest.mock('../../util/AVADateTime', () => ({ makeDate: jest.fn() }));
jest.mock('../../util/AVAGroups', () => ({
  addMember: jest.fn().mockResolvedValue([]),
  getGroupAccess: jest.fn().mockResolvedValue([{}, {}])
}));
jest.mock('../../util/AVAUtilities', () => ({
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  titleCase: value => String(value).replace(/\b\w/g, c => c.toUpperCase()),
  isEmpty: value => !value,
  uuid: () => 'test-id',
  recordExists: value => !!(value?.Item || value?.Items?.length),
  getDb: jest.fn(),
  putDb: jest.fn(),
  // getCustomizations/cl are pulled in transitively via AVAPeople.js's buildPersonSearchData
  // (called when QuickAdd builds a new person's search_data) - not used directly by QuickAdd.js.
  getCustomizations: jest.fn().mockResolvedValue(false),
  cl: jest.fn(),
  dbClient: { get: jest.fn(), query: jest.fn(), batchWrite: jest.fn(), update: jest.fn() }
}));

let config;
let existingPerson;
let onClose;

beforeEach(() => {
  jest.clearAllMocks();
  config = {
    account_type: 'caregiver',
    person_type: 'family',
    field_list: ['first_name', 'last_name', 'classification_override'],
    default_groups: ['family'],
    family_role: 'none'
  };
  existingPerson = null;
  onClose = jest.fn();
  useSession.mockImplementation(() => ({
    state: {
      user: { account_class: 'admin' },
      session: {
        client_id: 'test',
        new_account_form: [config],
        client_style: { preAuth: { require_pre_auth: true, preauth_match_on: 'code' } }
      },
      accessList: { test: { groups: ['family'] } }
    }
  }));
  getDb.mockImplementation(async request => {
    if (request.TableName === 'Form_Fields') {
      const field = request.Key.field_name;
      if (field === 'classification_override') {
        return { saveAs: 'personRec.person_type', value: { type: 'hidden', fixed: 'staff' } };
      }
      return {
        prompt: { value: field === 'first_name' ? 'First Name' : 'Last Name' },
        saveAs: field === 'first_name' ? 'personRec.name.first' : 'personRec.name.last',
        value: { type: 'text' }
      };
    }
    if (request.TableName === 'People' && existingPerson?.person_id === request.Key.person_id) {
      return JSON.parse(JSON.stringify(existingPerson));
    }
    return null;
  });
  putDb.mockResolvedValue({});
  dbClient.get.mockImplementation(() => ({ promise: async () => ({}) }));
  dbClient.query.mockImplementation(request => ({
    promise: async () => request.TableName === 'PreAuthorization'
      ? { Items: [{
        preauth_key: 'test-code',
        preauth_data: {
          account_type: 'caregiver',
          first_name: 'Amy',
          last_name: 'Smith',
          person_type: 'staff'
        }
      }] }
      : { Items: [] }
  }));
  dbClient.batchWrite.mockImplementation(() => ({ promise: async () => ({}) }));
  dbClient.update.mockImplementation(() => ({ promise: async () => ({}) }));
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

async function collectNewPerson() {
  const view = render(<QuickAdd onClose={onClose} />);
  fireEvent.click(await view.findByLabelText('Caregiver'));
  fireEvent.change((await view.findByText('First Name', { selector: 'label' })).parentElement.querySelector('input'), { target: { value: 'Amy' } });
  fireEvent.change(view.getByText('Last Name', { selector: 'label' }).parentElement.querySelector('input'), { target: { value: 'Smith' } });
  fireEvent.click(view.getByText('Save and Continue'));
  await view.findByText('Save Data');
  return view;
}

async function collectExistingPerson(personType) {
  existingPerson = {
    person_id: 'asmith',
    client_id: 'test',
    name: { first: 'Amy', last: 'Smith' },
    groups: ['ALL'],
    ...(personType === undefined ? {} : { person_type: personType })
  };
  const view = render(<QuickAdd
    onClose={onClose}
    options={{ source: 'url_parameter', preauth_code: 'test-code' }}
  />);
  const nameLabel = await view.findByText('Name (first and last), e-Mail, Phone Number, or User ID', { selector: 'label' });
  fireEvent.change(nameLabel.parentElement.querySelector('input'), {
    target: { value: 'asmith' }
  });
  fireEvent.click(view.getByText('Continue'));
  await view.findByText('First Name', { selector: 'label' });
  fireEvent.click(view.getByText('Save and Continue'));
  await view.findByText('Save Data');
  return view;
}

function peopleWrites() {
  return putDb.mock.calls.map(([request]) => request).filter(request => request.TableName === 'People');
}

it.each(['staff', 'family', 'core', 'guest'])('persists configured %s on new People records despite saveAs overrides', async personType => {
  config.person_type = personType;
  const view = await collectNewPerson();
  fireEvent.click(view.getByText('Save Data'));
  await wait(() => expect(onClose).toHaveBeenCalled());
  expect(peopleWrites()).toHaveLength(1);
  expect(peopleWrites()[0].Item.person_type).toBe(personType);
  expect(peopleWrites()[0].Item.account_type).toBe('caregiver');
});

it.each([undefined, null, 'family'])('fills or preserves %p on existing People without prompting or accepting overrides', async personType => {
  const view = await collectExistingPerson(personType);
  fireEvent.click(view.getByText('Save Data'));
  await wait(() => expect(onClose).toHaveBeenCalled());
  expect(view.queryByText('Confirm Person Type')).toBeNull();
  expect(peopleWrites()[0].Item.person_type).toBe('family');
});

it('preserves database-managed admin without offering reclassification', async () => {
  const view = await collectExistingPerson('admin');
  fireEvent.click(view.getByText('Save Data'));
  await wait(() => expect(onClose).toHaveBeenCalled());
  expect(view.queryByText('Confirm Person Type')).toBeNull();
  expect(peopleWrites()[0].Item.person_type).toBe('admin');
});

it.each(['new', 'existing'])('does not allow form or preauthorization data to assign admin on %s accounts', async mode => {
  const originalGetDb = getDb.getMockImplementation();
  getDb.mockImplementation(async request => {
    const result = await originalGetDb(request);
    if (request.TableName === 'Form_Fields' && request.Key.field_name === 'classification_override') {
      result.value.fixed = 'admin';
    }
    return result;
  });
  dbClient.query.mockImplementation(() => ({
    promise: async () => ({ Items: [{
      preauth_key: 'test-code',
      preauth_data: { account_type: 'caregiver', first_name: 'Amy', last_name: 'Smith', person_type: 'admin' }
    }] })
  }));
  const view = mode === 'new' ? await collectNewPerson() : await collectExistingPerson(null);
  fireEvent.click(view.getByText('Save Data'));
  await wait(() => expect(onClose).toHaveBeenCalled());
  expect(peopleWrites()[0].Item.person_type).toBe('family');
});

it.each([
  ['guest', 'Keep Guest', 'guest'],
  ['guest', 'Change to Family Member', 'family'],
  ['', 'Keep Current Value', ''],
  ['resident', 'Change to Family Member', 'family']
])('waits for confirmation for existing %p and persists the choice', async (currentType, button, expectedType) => {
  const view = await collectExistingPerson(currentType);
  fireEvent.click(view.getByText('Save Data'));
  await view.findByText('Confirm Person Type');
  expect(peopleWrites()).toHaveLength(0);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(view.getByText('Save Data'));
  fireEvent.click(view.getByText(button));
  await wait(() => expect(onClose).toHaveBeenCalled());
  expect(peopleWrites()).toHaveLength(1);
  expect(peopleWrites()[0].Item.person_type).toBe(expectedType);
});

it('does not save or consume preauthorization when closed during confirmation', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const view = await collectExistingPerson('guest');
  fireEvent.click(view.getByText('Save Data'));
  await view.findByText('Confirm Person Type');
  view.unmount();
  await wait(() => expect(console.error).toHaveBeenCalled());
  expect(putDb).not.toHaveBeenCalled();
  expect(dbClient.update).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
});

it.each([undefined, null, 'resident', 'admin'])('blocks missing, invalid, or reserved configured person_type %p before saving', async personType => {
  config.person_type = personType;
  jest.spyOn(console, 'error').mockImplementation(() => {});
  const view = render(<QuickAdd onClose={onClose} />);
  fireEvent.click(await view.findByLabelText('Caregiver'));
  await view.findByText('Account Configuration Error');
  expect(view.queryByText('Save and Continue')).toBeNull();
  expect(putDb).not.toHaveBeenCalled();
});

describe('*user_id special field (Pattern B: custom or AVA-generated)', () => {
  function configWithUserIdField() {
    return { ...config, field_list: [...config.field_list, '*user_id'] };
  }

  async function fillNameFields(view) {
    fireEvent.change((await view.findByText('First Name', { selector: 'label' })).parentElement.querySelector('input'), { target: { value: 'Amy' } });
    fireEvent.change(view.getByText('Last Name', { selector: 'label' }).parentElement.querySelector('input'), { target: { value: 'Smith' } });
  }

  it('uses a provided, available User ID directly as the new person_id', async () => {
    const view = render(<QuickAdd onClose={onClose} new_account_form={configWithUserIdField()} />);
    await fillNameFields(view);
    const userIdLabel = await view.findByText('User ID (optional)', { selector: 'label' });
    fireEvent.change(userIdLabel.parentElement.querySelector('input'), { target: { value: 'amy_custom' } });
    fireEvent.click(view.getByText('Save and Continue'));
    fireEvent.click(await view.findByText('Save Data'));
    await wait(() => expect(onClose).toHaveBeenCalled());
    expect(peopleWrites()[0].Item.person_id).toBe('amy_custom');
  });

  it('rejects a provided User ID that already exists, without advancing or writing anything', async () => {
    existingPerson = { person_id: 'amy_custom', client_id: 'test', name: { first: 'Someone', last: 'Else' } };
    const view = render(<QuickAdd onClose={onClose} new_account_form={configWithUserIdField()} />);
    await fillNameFields(view);
    const userIdLabel = await view.findByText('User ID (optional)', { selector: 'label' });
    fireEvent.change(userIdLabel.parentElement.querySelector('input'), { target: { value: 'amy_custom' } });
    fireEvent.click(view.getByText('Save and Continue'));
    await view.findByText('That User ID is already taken. Please try another.');
    expect(view.queryByText('Save Data')).toBeNull();
    expect(putDb).not.toHaveBeenCalled();
  });

  it('falls back to an AVA-generated ID when the User ID field is left blank', async () => {
    const view = render(<QuickAdd onClose={onClose} new_account_form={configWithUserIdField()} />);
    await fillNameFields(view);
    fireEvent.click(view.getByText('Save and Continue'));
    fireEvent.click(await view.findByText('Save Data'));
    await wait(() => expect(onClose).toHaveBeenCalled());
    // The mocked AVAUtilities.uuid() always returns 'test-id' - see jest.mock at the top of this file.
    expect(peopleWrites()[0].Item.person_id).toBe('test-id');
  });

  it('never treats *user_id as required, even if the config lists it in required', async () => {
    config.required = ['*user_id'];
    const view = render(<QuickAdd onClose={onClose} new_account_form={configWithUserIdField()} />);
    await fillNameFields(view);
    fireEvent.click(view.getByText('Save and Continue'));
    await view.findByText('Save Data');
    expect(view.queryByText('Required Fields Missing')).toBeNull();
  });
});

describe('supplied new_account_form', () => {
  function suppliedConfig(overrides = {}) {
    return {
      ...config,
      account_type: 'visitor',
      person_type: 'guest',
      default_groups: ['visitors'],
      ...overrides
    };
  }

  async function fillAndCollect(view) {
    fireEvent.change((await view.findByText('First Name', { selector: 'label' })).parentElement.querySelector('input'), { target: { value: 'Amy' } });
    fireEvent.change(view.getByText('Last Name', { selector: 'label' }).parentElement.querySelector('input'), { target: { value: 'Smith' } });
    fireEvent.click(view.getByText('Save and Continue'));
  }

  it('uses the supplied entry instead of selecting a database entry and leaves the caller object untouched', async () => {
    const entry = suppliedConfig();
    const original = JSON.parse(JSON.stringify(entry));
    const view = render(<QuickAdd onClose={onClose} new_account_form={entry} />);
    await fillAndCollect(view);
    expect(view.queryByText('Choose the type of account to create:')).toBeNull();
    fireEvent.click(await view.findByText('Save Data'));
    await wait(() => expect(onClose).toHaveBeenCalled());
    expect(peopleWrites()[0].Item).toMatchObject({
      account_type: 'visitor',
      person_type: 'guest',
      groups: ['__TOP__', 'ALL', 'visitors']
    });
    expect(addMember).toHaveBeenCalledWith(expect.any(String), 'test', ['visitors'], { allowParent: true });
    expect(entry).toEqual(original);
  });

  it('works when neither session nor database supplies new_account_form', async () => {
    const sessionImplementation = useSession.getMockImplementation();
    useSession.mockImplementation(() => {
      const session = sessionImplementation();
      delete session.state.session.new_account_form;
      return session;
    });
    const view = render(<QuickAdd onClose={onClose} new_account_form={suppliedConfig()} />);
    await fillAndCollect(view);
    fireEvent.click(await view.findByText('Save Data'));
    await wait(() => expect(onClose).toHaveBeenCalled());
    expect(peopleWrites()[0].Item.person_type).toBe('guest');
  });

  it.each([
    {},
    [],
    'visitor',
    { account_type: '', person_type: 'guest', field_list: [] },
    { account_type: 'visitor', person_type: 'guest' },
    { account_type: 'visitor', person_type: 'admin', field_list: [] }
  ])('rejects malformed or reserved supplied configuration %p without falling back', async entry => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(<QuickAdd onClose={onClose} new_account_form={entry} />);
    await view.findByText('Account Configuration Error');
    expect(view.queryByLabelText('Caregiver')).toBeNull();
    expect(getDb).not.toHaveBeenCalled();
    expect(putDb).not.toHaveBeenCalled();
  });

  it.each([
    { restrict_to_groups: ['not-accessible'] },
    { restrict_to_admin: true, source: 'url_parameter' },
    { restrict_to_admin: true, source: 'login_preauth' }
  ])('enforces supplied eligibility restrictions %p', async ({ source, ...restrictions }) => {
    const view = render(<QuickAdd onClose={onClose} new_account_form={suppliedConfig(restrictions)} options={{ source }} />);
    await view.findByText('Account Type Unavailable');
    expect(view.queryByText('First Name', { selector: 'label' })).toBeNull();
    expect(putDb).not.toHaveBeenCalled();
  });

  it('applies required-field rules to the supplied configuration', async () => {
    const view = render(<QuickAdd onClose={onClose} new_account_form={suppliedConfig({ required: ['first_name'] })} />);
    await view.findByText('First Name', { selector: 'label' });
    fireEvent.click(view.getByText('Save and Continue'));
    await view.findByText('First Name is required');
    expect(view.queryByText('Save Data')).toBeNull();
    expect(putDb).not.toHaveBeenCalled();
  });

  it('allows eligible admin/group-restricted configurations', async () => {
    const view = render(<QuickAdd onClose={onClose} new_account_form={suppliedConfig({
      restrict_to_admin: true,
      restrict_to_groups: 'family'
    })} />);
    await view.findByText('First Name', { selector: 'label' });
    expect(view.queryByText('Account Type Unavailable')).toBeNull();
  });

  it('rejects admin-restricted configurations for non-administrative users', async () => {
    const sessionImplementation = useSession.getMockImplementation();
    useSession.mockImplementation(() => {
      const session = sessionImplementation();
      session.state.user.account_class = 'local';
      return session;
    });
    const view = render(<QuickAdd onClose={onClose} new_account_form={suppliedConfig({ restrict_to_admin: true })} />);
    await view.findByText('Account Type Unavailable');
    expect(putDb).not.toHaveBeenCalled();
  });

  it('uses the supplied configuration when adding to an existing family', async () => {
    const originalGetDb = getDb.getMockImplementation();
    getDb.mockImplementation(request => request.TableName === 'FamilyGroups'
      ? Promise.resolve({ family_id: 'family_test', family_name: 'Smith Family' })
      : originalGetDb(request));
    const view = render(<QuickAdd onClose={onClose} new_account_form={suppliedConfig()} options={{ family_id: 'family_test' }} />);
    await view.findByText('First Name', { selector: 'label' });
    expect(view.queryByText('Choose the type of account to create:')).toBeNull();
    expect(view.getByText('Adding to Family')).toBeTruthy();
  });

  it('retains the URL identity prompt and rejects mismatched authorization', async () => {
    const view = render(<QuickAdd
      onClose={onClose}
      new_account_form={suppliedConfig()}
      options={{ source: 'url_parameter', preauth_code: 'test-code' }}
    />);
    const label = await view.findByText('Name (first and last), e-Mail, Phone Number, or User ID', { selector: 'label' });
    expect(view.queryByText('First Name', { selector: 'label' })).toBeNull();
    fireEvent.change(label.parentElement.querySelector('input'), { target: { value: 'Amy Smith' } });
    fireEvent.click(view.getByText('Continue'));
    await view.findByText('This authorization code does not match the supplied account type. Please contact support.');
    expect(putDb).not.toHaveBeenCalled();
  });

  it('retains verification even when a family_id is supplied', async () => {
    const originalGetDb = getDb.getMockImplementation();
    getDb.mockImplementation(request => request.TableName === 'FamilyGroups'
      ? Promise.resolve({ family_id: 'family_test', family_name: 'Smith Family' })
      : originalGetDb(request));
    const view = render(<QuickAdd onClose={onClose} new_account_form={suppliedConfig()}
      options={{ source: 'url_parameter', family_id: 'family_test' }} />);
    await view.findByText('Name (first and last), e-Mail, Phone Number, or User ID', { selector: 'label' });
    expect(view.queryByText('First Name', { selector: 'label' })).toBeNull();
  });

  it('skips selection after the URL new-account identity check without preauthorization', async () => {
    const sessionImplementation = useSession.getMockImplementation();
    useSession.mockImplementation(() => {
      const session = sessionImplementation();
      session.state.session.client_style = {};
      return session;
    });
    const view = render(<QuickAdd onClose={onClose} new_account_form={suppliedConfig()} options={{ source: 'url_parameter' }} />);
    const label = await view.findByText('Name (first and last), e-Mail, Phone Number, or User ID', { selector: 'label' });
    fireEvent.change(label.parentElement.querySelector('input'), { target: { value: 'Amy Smith' } });
    fireEvent.click(view.getByText('Continue'));
    fireEvent.click(await view.findByText('Create a New Account'));
    await view.findByText('First Name', { selector: 'label' });
    expect(view.queryByText('Choose the type of account to create:')).toBeNull();
  });

  it('uses the supplied entry over a same-type database entry after matching preauthorization', async () => {
    const view = render(<QuickAdd
      onClose={onClose}
      new_account_form={suppliedConfig({ account_type: 'caregiver' })}
      options={{ source: 'login_preauth', preauth_code: 'test-code' }}
    />);
    await view.findByText('First Name', { selector: 'label' });
    fireEvent.click(view.getByText('Save and Continue'));
    fireEvent.click(await view.findByText('Save Data'));
    await wait(() => expect(onClose).toHaveBeenCalled());
    expect(peopleWrites()[0].Item.person_type).toBe('guest');
  });

  it('retains automatic follow-on account creation from database configuration', async () => {
    const view = render(<QuickAdd onClose={onClose} new_account_form={suppliedConfig({
      family_role: 'primary',
      auto_next_account_type: 'caregiver'
    })} />);
    await fillAndCollect(view);
    await view.findByText('Enter Information for Caregiver:');
    expect(view.queryByText('Choose the type of account to create:')).toBeNull();
  });
});

describe('form_id delegation to FormFillB', () => {
  // Matches the name-lookup fixture collectExistingPerson() uses: a single-word entry resolves
  // via a direct person_id lookup (validateUser's single-word branch), so no PeopleAccounts
  // query mocking is needed here.
  function existingPersonConfig(overrides = {}) {
    existingPerson = {
      person_id: 'asmith',
      client_id: 'test',
      name: { first: 'Amy', last: 'Smith' },
      groups: ['ALL'],
    };
    return { ...config, account_type: 'caregiver', form_id: 'test_form', default_groups: ['caregivers'], ...overrides };
  }

  async function reachFormFillDelegation(overrides = {}) {
    const view = render(<QuickAdd
      onClose={onClose}
      new_account_form={existingPersonConfig(overrides)}
      options={{ source: 'url_parameter', preauth_code: 'test-code' }}
    />);
    const nameLabel = await view.findByText('Name (first and last), e-Mail, Phone Number, or User ID', { selector: 'label' });
    fireEvent.change(nameLabel.parentElement.querySelector('input'), { target: { value: 'asmith' } });
    fireEvent.click(view.getByText('Continue'));
    await view.findByTestId('form-fill-mock');
    return view;
  }

  it('renders FormFillB (not its own field rendering) for an existing-account pre-auth match, and applies default_groups on completion', async () => {
    const view = await reachFormFillDelegation();
    const request = JSON.parse(view.getByTestId('form-fill-request').textContent);
    expect(request.form_id).toBe('test_form');
    expect(request.person_id).toBe('asmith');
    expect(request.client_id).toBe('test');
    expect(view.queryByText('First Name', { selector: 'label' })).toBeNull();

    fireEvent.click(view.getByText('Complete Form Fill'));
    fireEvent.click(await view.findByText('Save Data'));
    await wait(() => expect(onClose).toHaveBeenCalled());
    expect(peopleWrites()).toHaveLength(1);
    expect(peopleWrites()[0].Item.person_id).toBe('asmith');
    expect(addMember).toHaveBeenCalledWith('asmith', 'test', ['caregivers']);
  });

  it('returns to account selection without writing anything when FormFillB is aborted', async () => {
    const view = await reachFormFillDelegation();
    fireEvent.click(view.getByText('Abort Form Fill'));
    await wait(() => expect(view.queryByTestId('form-fill-mock')).toBeNull());
    expect(putDb).not.toHaveBeenCalled();
    expect(addMember).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('skips name-verification entirely when options.preauth_person_id is already known (e.g. redeeming a code post-login)', async () => {
    const view = render(<QuickAdd
      onClose={onClose}
      new_account_form={existingPersonConfig()}
      options={{ source: 'login_preauth', preauth_code: 'test-code', preauth_person_id: 'asmith' }}
    />);
    await view.findByTestId('form-fill-mock');
    expect(view.queryByText('Name (first and last), e-Mail, Phone Number, or User ID', { selector: 'label' })).toBeNull();
    const request = JSON.parse(view.getByTestId('form-fill-request').textContent);
    expect(request.person_id).toBe('asmith');
  });
});

describe('post-login code redemption sources (menu_redeem / deep_link_redeem)', () => {
  function redeemConfig() {
    return { ...config, account_type: 'caregiver', default_groups: ['caregivers'] };
  }

  function mockAlreadyUsedPreAuth() {
    dbClient.query.mockImplementation(() => ({
      promise: async () => ({ Items: [{
        preauth_key: 'test-code',
        used_by: ['asmith'],
        preauth_data: { account_type: 'caregiver', first_name: 'Amy', last_name: 'Smith' }
      }] })
    }));
  }

  it('menu_redeem shows an explicit "already registered" message and closes, without a page redirect', async () => {
    mockAlreadyUsedPreAuth();
    const originalReplace = window.location.replace;
    window.location.replace = jest.fn();
    const view = render(<QuickAdd
      onClose={onClose}
      new_account_form={redeemConfig()}
      options={{ source: 'menu_redeem', preauth_code: 'test-code', preauth_person_id: 'asmith' }}
    />);
    await view.findByText('You\'ve already registered with that code.');
    await wait(() => expect(onClose).toHaveBeenCalledWith([], null));
    expect(window.location.replace).not.toHaveBeenCalled();
    window.location.replace = originalReplace;
  });

  it('deep_link_redeem silently closes on an already-used code, with no visible message', async () => {
    mockAlreadyUsedPreAuth();
    const view = render(<QuickAdd
      onClose={onClose}
      new_account_form={redeemConfig()}
      options={{ source: 'deep_link_redeem', preauth_code: 'test-code', preauth_person_id: 'asmith' }}
    />);
    await wait(() => expect(onClose).toHaveBeenCalledWith([], null));
    expect(view.queryByText('Already Registered')).toBeNull();
    expect(view.queryByText('Welcome Back')).toBeNull();
  });

  it('deep_link_redeem silently closes on an invalid/unrecognized code, with no error message', async () => {
    dbClient.query.mockImplementation(() => ({ promise: async () => ({ Items: [] }) }));
    const view = render(<QuickAdd
      onClose={onClose}
      new_account_form={redeemConfig()}
      options={{ source: 'deep_link_redeem', preauth_code: 'no-such-code', preauth_person_id: 'asmith' }}
    />);
    await wait(() => expect(onClose).toHaveBeenCalledWith([], null));
    expect(view.queryByText('Invalid Code')).toBeNull();
  });
});

describe('form_id delegation for brand-new accounts (User ID prompt)', () => {
  function newAccountFormIdConfig(overrides = {}) {
    return { ...config, account_type: 'caregiver', form_id: 'test_form', default_groups: ['caregivers'], ...overrides };
  }

  it('prompts for a User ID, creates a placeholder People record, then opens FormFillB with it', async () => {
    const view = render(<QuickAdd onClose={onClose} new_account_form={newAccountFormIdConfig()} />);
    await view.findByText('Choose a User ID');
    const userIdLabel = await view.findByText('User ID (optional)', { selector: 'label' });
    fireEvent.change(userIdLabel.parentElement.querySelector('input'), { target: { value: 'my_custom_id' } });
    fireEvent.click(view.getByText('Continue'));

    await view.findByTestId('form-fill-mock');
    expect(putDb).toHaveBeenCalledWith({ TableName: 'People', Item: { person_id: 'my_custom_id', client_id: 'test' } });
    const request = JSON.parse(view.getByTestId('form-fill-request').textContent);
    expect(request.form_id).toBe('test_form');
    expect(request.person_id).toBe('my_custom_id');
    expect(request.client_id).toBe('test');

    // The placeholder putDb call above is asserted directly; getDb is independently mocked (not
    // backed by a real store), so reflect that the placeholder now exists for the final-save
    // lookup in savePeopleRecord, same as a real putDb -> getDb round trip would.
    existingPerson = { person_id: 'my_custom_id', client_id: 'test' };

    fireEvent.click(view.getByText('Complete Form Fill'));
    fireEvent.click(await view.findByText('Save Data'));
    await wait(() => expect(onClose).toHaveBeenCalled());
    expect(addMember).toHaveBeenCalledWith('my_custom_id', 'test', ['caregivers']);
  });

  it('rejects a taken User ID without creating a placeholder or opening FormFillB', async () => {
    existingPerson = { person_id: 'taken_id', client_id: 'test', name: {} };
    const view = render(<QuickAdd onClose={onClose} new_account_form={newAccountFormIdConfig()} />);
    await view.findByText('Choose a User ID');
    const userIdLabel = await view.findByText('User ID (optional)', { selector: 'label' });
    fireEvent.change(userIdLabel.parentElement.querySelector('input'), { target: { value: 'taken_id' } });
    fireEvent.click(view.getByText('Continue'));
    await view.findByText('That User ID is already taken. Please try another.');
    expect(view.queryByTestId('form-fill-mock')).toBeNull();
    expect(putDb).not.toHaveBeenCalled();
  });

  it('falls back to an AVA-generated placeholder ID when left blank', async () => {
    const view = render(<QuickAdd onClose={onClose} new_account_form={newAccountFormIdConfig()} />);
    await view.findByText('Choose a User ID');
    fireEvent.click(view.getByText('Continue'));
    await view.findByTestId('form-fill-mock');
    // The mocked AVAUtilities.uuid() always returns 'test-id' - see jest.mock at the top of this file.
    const request = JSON.parse(view.getByTestId('form-fill-request').textContent);
    expect(request.person_id).toBe('test-id');
    expect(putDb).toHaveBeenCalledWith({ TableName: 'People', Item: { person_id: 'test-id', client_id: 'test' } });
  });

  it('returns to account type selection from the User ID prompt via Back, without creating a placeholder', async () => {
    config.form_id = 'test_form';
    const view = render(<QuickAdd onClose={onClose} />);
    fireEvent.click(await view.findByLabelText('Caregiver'));
    await view.findByText('Choose a User ID');
    fireEvent.click(view.getByText('Back'));
    await view.findByText('Choose the type of account to create:');
    expect(view.queryByText('Choose a User ID')).toBeNull();
    expect(putDb).not.toHaveBeenCalled();
  });
});
