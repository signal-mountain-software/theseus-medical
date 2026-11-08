import React from 'react';
import { fireEvent, render, screen, wait } from '@testing-library/react';
import CalendarEventEditForm from './CalendarEventEditForm';
import { getSlotList, writeSlot } from '../../util/AVACalendars';
import { getPerson } from '../../util/AVAPeople';

jest.mock('../../hooks/useSession', () => () => ({
  state: {
    session: { adminAccount: true, client_id: 'client', patient_id: 'admin', user_id: 'admin' },
    user: { account_class: 'admin' }
  }
}));
jest.mock('@material-ui/core/styles/makeStyles', () => () => () => ({}));
jest.mock('../../util/AVAStyles', () => ({
  AVAclasses: () => ({}), AVATextStyle: () => ({}), AVADefaults: () => 1
}));
jest.mock('../../util/AVAUtilities', () => ({
  cl: jest.fn(), makeArray: value => [value].flat(),
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  isEmpty: value => value == null || value === '',
  titleCase: value => value, isMobile: () => false,
  recordExists: result => !!(result?.Item || result?.Items?.length),
  dbClient: { query: () => ({ promise: async () => ({ Items: [] }) }) }
}));
jest.mock('../../util/AVADateTime', () => ({
  makeDate: () => ({ relative: 'Today', numeric: 20261106 }),
  makeTime: () => ({ short: '9 AM' })
}));
jest.mock('../../util/AVACalendars', () => ({
  getSlotList: jest.fn(), writeSlot: jest.fn(), myAvailability: async () => []
}));
jest.mock('../../util/AVAPeople', () => ({
  makeName: async () => 'Ann Bradley', getPerson: jest.fn(), getImage: () => ''
}));
jest.mock('../../util/AVAGroups', () => ({
  getMemberList: async () => ({
    peopleList: [{
      person_id: 'abradley-hvrc', name: { first: 'Ann', last: 'Bradley' },
      search_data: 'Populated search metadata', groups: []
    }]
  })
}));
jest.mock('../../util/AVAServiceRequest', () => ({ getServiceRequests: async () => [] }));
jest.mock('../../util/AVAMessages', () => ({}));
jest.mock('./MakeMessage', () => () => null);
jest.mock('./FormFillB', () => () => null);
jest.mock('./AVATextInput', () => () => null);
jest.mock('react-geolocated', () => ({ useGeolocated: () => ({}) }));
jest.mock('@aws-sdk/client-location', () => ({}));
jest.mock('@aws/amazon-location-utilities-auth-helper', () => ({}));
jest.mock('../sections/QuickSearch', () => ({ onClose }) => (
  <button onClick={() => onClose([mockSelection])}>Choose Ann</button>
));

let mockSelection;

beforeEach(() => {
  jest.clearAllMocks();
  getSlotList.mockResolvedValue({ slotObj: {}, occRec: { event_key: 'event#20261106' } });
  getPerson.mockResolvedValue({
    person_id: 'abradley-hvrc', client_id: 'client',
    name: { first: 'Ann', last: 'Bradley' }, search_data: 'Populated search metadata'
  });
  writeSlot.mockImplementation(async body => ({
    event_key: `${body.event.split('#')[0]}#${body.occurrence_date}#${body.slot}`
  }));
});

it.each([undefined, 'Populated search metadata'])('allocates only the actual ID with selection search_data=%s', async search_data => {
  mockSelection = {
    person_id: 'abradley-hvrc', person_name: 'Ann Bradley',
    person_firstName: 'Ann', person_lastName: 'Bradley',
    ...(search_data === undefined ? {} : { search_data })
  };
  render(<CalendarEventEditForm
    pEventCode="event#20261106" pEvent={{}} peopleList={['*all']}
    pPatient="admin" pClient="client" onReset={jest.fn()}
    pOccData={{
      date: 20261106, occurrence_date: 20261106, event_id: 'event',
      description: 'Test event', signup_type: 'none', owner: ['admin']
    }}
  />);
  fireEvent.click(await screen.findByRole('button', { name: 'Add someone' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Choose Ann' }));
  await wait(() => expect(writeSlot).toHaveBeenCalledTimes(1));
  expect(writeSlot).toHaveBeenCalledWith(expect.objectContaining({
    owner: 'abradley-hvrc', slot: 'abradley-hvrc', override_name: 'Ann Bradley',
    occurrence_date: 20261106
  }));
  expect(getPerson).toHaveBeenCalledWith('abradley-hvrc', '*all');
  await wait(() => expect(screen.queryByRole('button', { name: 'Choose Ann' })).toBeNull());
});
