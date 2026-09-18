import React from 'react';
import { Box, Typography, Switch } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';

// keys here must match the section tokens used by PeopleMaintenance.js's isAuthorized checks
const GATED_SECTIONS = [
  { key: 'admin', label: 'Additional Data' },
  { key: 'family', label: 'My Family' },
  { key: 'personal', label: 'Photo & Personalization' },
  { key: 'groups', label: 'Groups' },
  { key: 'notes', label: 'Notes' },
  { key: 'checkout', label: 'Check-in/Check-out History' },
  { key: 'documents', label: 'Archived Documents' },
  { key: 'forms', label: 'Forms & Documents' },
  { key: 'activities', label: 'Events & Participation' },
  { key: 'task_manager', label: 'Daily Activities & Tasks' },
];

export default ({ currentValues, updateField }) => {

  const profile_sections_visible = currentValues.customizationRecs.client_style?.customization_value?.profile_sections_visible || {};

  return (
    <Box
      key={`profileSectionsVisibility_masterBox`}
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Typography style={AVATextStyle({ margin: { bottom: 0.5 } })}>
        {'Profile Section Visibility'}
      </Typography>
      <Typography style={AVATextStyle({ size: 0.8, margin: { bottom: 1 } })}>
        {'Master accounts always see every section, and Admin accounts always see Password & Tech Stuff. '
          + 'Toggle the switches below to control whether other staff can see each section on a person\u2019s profile.'}
      </Typography>
      {GATED_SECTIONS.map(({ key, label }) => {
        // a gate that has never been set defaults to visible
        const isVisible = profile_sections_visible[key] !== false;
        return (
          <Box key={key} display='flex' alignItems='flex-start'
            justifyContent='flex-start' marginBottom={2.5} flexDirection='column'
          >
            <Typography
              style={AVATextStyle({ size: 1.1, bold: true, margin: { bottom: 0 } })}
            >
              {label}
            </Typography>
            <Box display='flex' alignItems='center'
              justifyContent='flex-start' flexDirection='row'
            >
              <Typography
                style={AVATextStyle({
                  size: 0.8, margin: { right: 0.8 },
                  bold: !isVisible
                })}
              >
                {'Hidden'}
              </Typography>
              <Switch
                checked={isVisible}
                onClick={async () => {
                  await updateField({
                    updateList: [{
                      tableName: 'customizationRecs',
                      fieldName: `client_style.customization_value.profile_sections_visible.${key}`,
                      newData: !isVisible
                    }]
                  });
                }}
                name={`profile_sections_visible_${key}`}
                color="primary"
              />
              <Typography
                style={AVATextStyle({
                  size: 0.8, margin: { left: 0.8 },
                  bold: isVisible
                })}
              >
                {'Visible'}
              </Typography>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};
