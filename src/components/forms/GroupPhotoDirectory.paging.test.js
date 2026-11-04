import React from 'react';
import { fireEvent, render, screen, wait } from '@testing-library/react';
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles';
import GroupPhotoDirectory from './GroupPhotoDirectory';
import { getPerson } from '../../util/AVAPeople';

jest.mock('../../hooks/useSession', () => {
  const state = { profile: { account_class: 'user' }, session: { client_id: 'client' }, accessList: {} };
  return () => ({ state });
});
jest.mock('../../util/AVAPeople', () => ({
  getImage: () => '',
  getPerson: jest.fn(),
  formatPhone: value => value
}));
jest.mock('../../util/AVAStyles', () => ({ AVAclasses: () => ({}) }));
jest.mock('../../util/AVAUtilities', () => ({
  isEmpty: value => !value || (typeof value === 'object' && !Object.keys(value).length),
  sentenceCase: value => value,
  getObject: () => null,
  lambda: jest.fn(),
  titleCase: value => value
}));
jest.mock('../../util/AVAGroups', () => ({ determineClass: jest.fn(), getRole: jest.fn() }));
jest.mock('../dialogs/PeopleMaintenance', () => () => null);
jest.mock('./MakeMessage', () => () => null);

const person = (n) => ({ person_id: `p${n}`, name: { first: 'Person', last: `L${String(n).padStart(3, '0')}` } });
const theme = createMuiTheme();
const renderDirectory = (members) => render(<ThemeProvider theme={theme}><GroupPhotoDirectory options={{ groupMemberList: members }} /></ThemeProvider>);
const cardCount = () => screen.queryAllByText(/^Person L\d{3}$/).length;

let scrollHeight = 0;
let clientHeight = 0;
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', { configurable: true, get: () => scrollHeight });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => clientHeight });
});
beforeEach(() => {
  jest.clearAllMocks();
  scrollHeight = 5000;
  clientHeight = 600;
});

it('shows a full first batch plus a "more..." card, which loads the next batch when tapped', async () => {
  const members = Array.from({ length: 75 }, (_, i) => person(i));
  renderDirectory(members);

  expect(cardCount()).toBe(30);
  const more = screen.getByText('more...');
  fireEvent.click(more);
  expect(cardCount()).toBe(60);
  fireEvent.click(screen.getByText('more...'));
  expect(cardCount()).toBe(75);
  expect(screen.queryByText('more...')).not.toBeInTheDocument();
});

it('keeps adding batches until the screen is full', async () => {
  scrollHeight = 0;
  const members = Array.from({ length: 75 }, (_, i) => person(i));
  renderDirectory(members);
  await wait(() => expect(cardCount()).toBe(75));
  expect(screen.queryByText('more...')).not.toBeInTheDocument();
});

it('does not let still-loading people consume the first batch', async () => {
  getPerson.mockImplementation(() => new Promise(() => { }));
  const members = [
    ...Array.from({ length: 20 }, (_, i) => `id${i}`),
    ...Array.from({ length: 40 }, (_, i) => person(i))
  ];
  renderDirectory(members);
  expect(cardCount()).toBe(30);
  expect(screen.getByText('more...')).toBeInTheDocument();
});
