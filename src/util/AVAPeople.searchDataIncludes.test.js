import { searchDataIncludes } from './AVAPeople';

jest.mock('./AVAUtilities', () => ({}));

// Shared comparison used by every "search_data only" consumer (GroupPhotoDirectory.js's
// getSearchBlob, PersonFilter.js's okToShow) - see AVAPeople.search_data.test.js for the
// write-time half of this fix (buildPersonSearchData preferring a phone field's digits-only
// details.raw over its punctuated formatted display).
describe('searchDataIncludes', () => {
  it('matches regardless of case', () => {
    expect(searchDataIncludes('Jane Doe', 'JANE')).toBe(true);
  });

  it('finds a parens/dash-formatted phone number when the query includes a dash', () => {
    expect(searchDataIncludes('jane doe (444) 112-3456', '112-3456')).toBe(true);
  });

  it('finds a punctuation-free digit run when the query includes a dash', () => {
    expect(searchDataIncludes('jane doe 14441123456', '112-3456')).toBe(true);
  });

  it('finds a dash-formatted stored value even when the query omits the dash', () => {
    expect(searchDataIncludes('jane doe (444) 112-3456', '1123456')).toBe(true);
  });

  it('finds a hyphenated last name whether or not the query includes the hyphen', () => {
    expect(searchDataIncludes('anthony smith-shawver', 'smithshawver')).toBe(true);
    expect(searchDataIncludes('anthony smith-shawver', 'smith-shawver')).toBe(true);
  });

  it('finds a hyphenated apartment/location number whether or not the query includes the hyphen', () => {
    expect(searchDataIncludes('alice apt cv-43', 'cv43')).toBe(true);
  });

  it('does not match when the text is genuinely absent', () => {
    expect(searchDataIncludes('jane doe', 'smith')).toBe(false);
  });

  it('treats a blank or whitespace-only query as matching everything', () => {
    expect(searchDataIncludes('jane doe', '')).toBe(true);
    expect(searchDataIncludes('jane doe', '   ')).toBe(true);
  });

  it('treats missing search_data as never matching a non-blank query', () => {
    expect(searchDataIncludes('', 'jane')).toBe(false);
    expect(searchDataIncludes(undefined, 'jane')).toBe(false);
  });
});
