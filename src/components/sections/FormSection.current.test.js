import React from 'react';
import { render, wait } from '@testing-library/react';
import FormSection from './FormSection';
import { dbClient } from '../../util/AVAUtilities';

jest.mock('../../hooks/useSession', () => () => ({
  state: { session: { client_id: 'client' }, groups: {} },
}));
jest.mock('../../util/AVAUtilities', () => ({
  dbClient: { get: jest.fn(), query: jest.fn() },
  recordExists: result => !!result?.Item || !!result?.Items?.length,
  deepCopy: value => JSON.parse(JSON.stringify(value)),
  cl: jest.fn(),
}));
jest.mock('../../util/AVAStyles', () => ({ AVATextStyle: () => ({}) }));
jest.mock('../../util/AVADateTime', () => ({ makeDate: jest.fn() }));
jest.mock('../forms/FormFillB', () => () => null);

const forms = {
  current: { current: true },
  old: { current: false },
  missing: {},
  string: { current: 'true' },
  number: { current: 1 },
  documentCurrent: { current: true },
  documentOld: { current: false },
};

beforeEach(() => {
  jest.clearAllMocks();
  dbClient.get.mockImplementation(({ TableName, Key }) => ({
    promise: async () => ({
      Item: TableName === 'People'
        ? { person_id: 'person', name: { first: 'Test' }, groups: ['group'] }
        : TableName === 'Groups'
          ? { forms: ['current', 'old', 'missing', 'string', 'number'] }
          : { form_id: Key.form_id, form_name: Key.form_id, category: Key.form_id, ...forms[Key.form_id] },
    }),
  }));
  dbClient.query.mockImplementation(() => ({
    promise: async () => ({
      Items: Object.keys(forms).map(form_type => ({
        form_type, document_id: `doc_${form_type}`, status: 'assigned',
        history: [{ update_by: 'operator' }],
      })),
    }),
  }));
});

it.each([false, true])('filters both group and document-derived forms when currentOnly is %s', async currentOnly => {
  const updateReactData = jest.fn();
  render(<FormSection
    currentOnly={currentOnly}
    currentValues={{ peopleRec: { person_id: 'person' } }}
    reactData={{ groupObj: {}, administrative_account: true }}
    updateReactData={updateReactData}
  />);
  await wait(() => expect(updateReactData).toHaveBeenCalledWith(
    expect.objectContaining({ formsInitialized: true }), true
  ));
  const result = updateReactData.mock.calls.find(([data]) => data.formsInitialized)[0];
  const expected = currentOnly ? ['current', 'documentCurrent'] : Object.keys(forms);
  expect(Object.keys(result.masterFormList.person.myFormListObj).sort()).toEqual(expected.sort());
  expect(result.masterCategoryList.sort()).toEqual(expected.sort());
  expect(result.masterFormList.person.myFormListObj.current.assignedDocs).toHaveLength(1);
});
