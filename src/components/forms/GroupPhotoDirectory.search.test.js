import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles';
import GroupPhotoDirectory from './GroupPhotoDirectory';

jest.mock('../../hooks/useSession', () => {
  const state = { profile: { account_class: 'user' }, session: { client_id: 'client' }, accessList: {} };
  return () => ({ state });
});
jest.mock('../../util/AVAPeople', () => ({
  getImage: () => '',
  getPerson: jest.fn(),
  formatPhone: value => value,
  // Exercised for real (not re-implemented here) so these tests validate the actual wiring into
  // getSearchBlob's filtering, not a duplicate copy of the comparison logic.
  searchDataIncludes: jest.requireActual('../../util/AVAPeople').searchDataIncludes,
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

const theme = createMuiTheme();
const renderDirectory = (members) => render(<ThemeProvider theme={theme}><GroupPhotoDirectory options={{ groupMemberList: members }} /></ThemeProvider>);

const typeSearch = (text) => fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });

beforeEach(() => {
  jest.clearAllMocks();
});

// Covers the dash/parens-insensitive comparison searchDataIncludes() adds on top of getSearchBlob's
// existing preference for the precomputed search_data field - a phone number stored as a
// punctuation-free digit run (the standard shape for every phone in search_data, cell or
// DataDictionary-resolved) should still be found when the typed query includes a dash.
it('finds a person by phone number even when the typed query includes a dash', () => {
  const members = [
    { person_id: 'p1', name: { first: 'Jane', last: 'Doe' }, search_data: 'jane doe 14441234567' },
    { person_id: 'p2', name: { first: 'John', last: 'Roe' }, search_data: 'john roe 15559876543' },
  ];
  renderDirectory(members);

  typeSearch('123-4567');
  expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  expect(screen.queryByText('John Roe')).not.toBeInTheDocument();
});

// A hyphenated last name should be found whether or not the hyphen is typed - the accepted
// trade-off (discussed and approved) of stripping hyphens on both sides of the comparison.
it('finds a hyphenated last name when the hyphen is omitted from the typed query', () => {
  const members = [
    { person_id: 'p1', name: { first: 'Anthony', last: 'Smith-Shawver' }, search_data: 'anthony smith-shawver' },
    { person_id: 'p2', name: { first: 'Jane', last: 'Doe' }, search_data: 'jane doe' },
  ];
  renderDirectory(members);

  typeSearch('smithshawver');
  expect(screen.getByText('Anthony Smith-Shawver')).toBeInTheDocument();
  expect(screen.queryByText('Jane Doe')).not.toBeInTheDocument();
});
