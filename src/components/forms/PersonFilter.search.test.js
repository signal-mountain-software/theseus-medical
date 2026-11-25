import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PersonFilter from './PersonFilter';

jest.mock('../../util/AVAPeople', () => ({
  getImage: () => '',
  // Exercised for real (not re-implemented here) so this test validates the actual wiring into
  // okToShow, not a duplicate copy of the comparison logic.
  searchDataIncludes: jest.requireActual('../../util/AVAPeople').searchDataIncludes,
}));
jest.mock('../../util/AVAStyles', () => ({
  AVAclasses: () => ({}),
  AVATextStyle: () => ({}),
  AVATextVariableStyle: () => ({}),
  AVADefaults: () => 1,
}));
jest.mock('../../util/AVAUtilities', () => ({
  makeArray: (input) => (Array.isArray(input) ? input : (input ? [input] : [])),
  isObject: (value) => (!!value) && (value.constructor === Object),
  deepCopy: (value) => JSON.parse(JSON.stringify(value)),
}));

const typeFilter = (text) => fireEvent.change(document.getElementById('List Filter'), { target: { value: text } });

const renderFilter = (peopleList) => render(
  <PersonFilter prompt='Pick someone' peopleList={peopleList} onCancel={jest.fn()} onSelect={jest.fn()} />
);

// Covers the same dash/punctuation-insensitivity searchDataIncludes() provides for
// GroupPhotoDirectory.js's getSearchBlob, now wired into PersonFilter's okToShow too - a typed
// query's punctuation (or a stored search_data value's) shouldn't block an otherwise-matching
// search, whether that's a phone number or a hyphenated name/location.
it('finds a hyphenated last name whether or not the hyphen is typed', async () => {
  const people = [
    { person_id: 'p1', display_name: 'Anthony Smith-Shawver', search_data: 'anthony smith-shawver' },
    { person_id: 'p2', display_name: 'Jane Doe', search_data: 'jane doe' },
  ];
  renderFilter(people);

  typeFilter('smithshawver');
  expect(await screen.findByText('Smith-Shawver')).toBeInTheDocument();
  expect(screen.queryByText('Doe')).not.toBeInTheDocument();
});

it('finds a phone number stored as a punctuation-free digit run when the typed query includes a dash', async () => {
  const people = [
    { person_id: 'p1', display_name: 'Jane Doe', search_data: 'jane doe 14441234567' },
    { person_id: 'p2', display_name: 'John Roe', search_data: 'john roe 15559876543' },
  ];
  renderFilter(people);

  typeFilter('123-4567');
  expect(await screen.findByText('Doe')).toBeInTheDocument();
  expect(screen.queryByText('Roe')).not.toBeInTheDocument();
});
