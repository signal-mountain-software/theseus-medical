import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import FormBuilder from './FormBuilder';

jest.mock('../../hooks/useSession', () => {
  const state = { user: { account_class: 'admin' }, session: { client_id: 'client', client_name: 'Client', client_style: {} } };
  return () => ({ state });
});
jest.mock('../../util/AVAUtilities', () => ({
  dbClient: { query: jest.fn(() => ({ promise: async () => ({ Items: [] }) })), put: jest.fn() },
  getDb: jest.fn(),
  putDb: jest.fn(),
  cl: jest.fn(),
  recordExists: result => !!result?.Items?.length,
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  uuid: () => 'id',
  titleCase: value => value
}));
jest.mock('../../util/AVAStyles', () => ({ AVAclasses: () => ({}), AVATextStyle: () => ({}) }));
jest.mock('../../util/AVACalendars', () => ({ getEventMasterList: async () => [] }));
jest.mock('../../util/AVAGroups', () => ({ getMemberList: jest.fn() }));
jest.mock('../../util/AVAPeople', () => ({ getPerson: jest.fn(), getImage: jest.fn() }));
jest.mock('../../util/AVADateTime', () => ({
  makeDate: () => ({ numeric$: 20261026, numeric: 20261026, date: new Date(2026, 9, 26) }),
  addDays: () => ({ numeric$: 20271026 }),
  makeTime: jest.fn()
}));
jest.mock('../../util/AVADocuments', () => ({ createDocument: jest.fn() }));
jest.mock('../../util/AVAUploadFile', () => () => null);
jest.mock('../../util/AVAPeopleListExport', () => ({}));
jest.mock('./ExportFilterPrompt', () => () => null);
jest.mock('./PeopleMaintenance', () => () => null);
jest.mock('../forms/MessageForm', () => () => null);
jest.mock('../forms/FormFillB', () => () => null);
jest.mock('../sections/QuickSearch', () => () => null);

const form = {
  client_id: 'client',
  form_id: 'f1',
  form_name: 'Locked Rules',
  category: 'Forms',
  active: true,
  sections: [],
  fields: {},
  options: {},
  stages: [{
    stage_name: 'complete',
    on_complete_message: [
      { text: 'ok', recipientList: ['pertains_to'] },
      { text: 'second', template_id: 'tpl', recipientList: ['*all'], cc: 'x' }
    ],
    on_complete_notify: [
      { text: 'n', options: { priority: 'high', custom: { a: 1 } } }
    ]
  }]
};

beforeEach(() => {
  Element.prototype.scrollIntoView = jest.fn();
  // Popper.js (used by MUI Tooltip) needs createRange, which this jsdom version lacks.
  document.createRange = () => ({
    setStart: () => {},
    setEnd: () => {},
    commonAncestorContainer: { nodeName: 'BODY', ownerDocument: document }
  });
});

it('explains exactly why complete-stage rules are locked on hover', async () => {
  render(<FormBuilder directForm={form} onClose={jest.fn()} />);
  const indicator = await screen.findByText('Existing rule requires IT edit');
  fireEvent.mouseOver(indicator);

  expect(await screen.findByText(/2 rule\(s\) on the form's "complete" stage/)).toBeInTheDocument();
  expect(screen.getByText('Message rule - stage "complete", on_complete_message[1]')).toBeInTheDocument();
  expect(screen.getByText(/Another unconditional rule of this kind already exists/)).toBeInTheDocument();
  expect(screen.getByText('Uses key(s) FormBuilder doesn\'t model: "cc"')).toBeInTheDocument();
  expect(screen.getByText('Has both "template_id" and "text" - FormBuilder uses one or the other')).toBeInTheDocument();
  expect(screen.getByText('"recipientList" has unrecognized entry: "*all"')).toBeInTheDocument();
  expect(screen.getByText('Notification rule - stage "complete", on_complete_notify[0]')).toBeInTheDocument();
  expect(screen.getByText('"options" has unsupported key(s): "custom"')).toBeInTheDocument();
  expect(screen.getByText('"options" has nested value(s) in: "custom"')).toBeInTheDocument();
});

