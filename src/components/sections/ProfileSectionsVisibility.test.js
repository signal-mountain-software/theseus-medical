import React from 'react';
import { fireEvent, render, wait } from '@testing-library/react';
import ProfileSectionsVisibility from './ProfileSectionsVisibility';

jest.mock('../../util/AVAStyles', () => ({ AVATextStyle: () => ({}) }));

it.each([undefined, false, true])('loads and toggles current visibility from %s', async current => {
  const updateField = jest.fn();
  const { container, getByText } = render(<ProfileSectionsVisibility
    currentValues={{
      customizationRecs: {
        client_style: { customization_value: { profile_sections_visible: { current } } },
      },
    }}
    updateField={updateField}
  />);
  expect(getByText('Current Forms')).toBeInTheDocument();
  const toggle = container.querySelector('input[name="profile_sections_visible_current"]');
  expect(toggle.checked).toBe(current !== false);
  fireEvent.click(toggle);
  await wait(() => expect(updateField).toHaveBeenCalledWith({
    updateList: [{
      tableName: 'customizationRecs',
      fieldName: 'client_style.customization_value.profile_sections_visible.current',
      newData: current === false,
    }],
  }));
});
