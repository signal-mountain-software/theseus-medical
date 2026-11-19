import { resolveData } from './AVAUtilities';

// This mirrors the mocking setup used by AVAUtilities.names.test.js: AWS SDK is stubbed out with
// no working DynamoDB client, so any dictionary resolution path that falls through to an actual
// dbClient.get() call would throw. That makes these tests a strong proof that recordOverrides
// truly bypasses the DB read rather than merely being accepted and ignored.
jest.mock('./AVAPeople', () => ({ getPerson: jest.fn(), makeName: jest.fn() }));
jest.mock('./AVADateTime', () => ({ makeDate: jest.fn(), isDate: jest.fn() }));
jest.mock('./AVACalendars', () => ({ getOccurenceList: jest.fn() }));
jest.mock('aws-sdk', () => ({
  DynamoDB: { DocumentClient: jest.fn() },
  CognitoIdentityServiceProvider: jest.fn(),
  S3: jest.fn(),
  Polly: jest.fn(),
  Lambda: jest.fn(),
  CloudFront: jest.fn()
}));
jest.mock('aws-sdk/clients/mediaconvert', () => jest.fn());
jest.mock('aws-sdk/clients/stepfunctions', () => jest.fn());

it('resolves a person-sourced DataDictionary field from an in-memory recordOverrides entry instead of reading the DB', async () => {
  const pendingPersonEdit = { person_id: 'p1', name: { first: 'Pending', last: 'Edit' } };

  const [result] = await resolveData('client', 'p1', ['field'], {
    dictionaryCache: {
      'client::field': { type: 'string', source: 'person', locator: 'person_id', path: 'name.first' }
    },
    recordOverrides: { People: pendingPersonEdit }
  });

  expect(result.raw).toBe('Pending');
  expect(result.formatted).toBe('Pending');
});

it('falls back to a dictionary-declared table name match for recordOverrides, not just the person/people source alias', async () => {
  const pendingRecord = { some_id: 'abc', field: 'Overridden Value' };

  const [result] = await resolveData('client', 'owner', ['field'], {
    dictionaryCache: {
      'client::field': { type: 'string', source: 'SomeOtherTable', table: 'SomeOtherTable', locator: 'person_id', path: 'field' }
    },
    recordOverrides: { SomeOtherTable: pendingRecord }
  });

  expect(result.raw).toBe('Overridden Value');
});
