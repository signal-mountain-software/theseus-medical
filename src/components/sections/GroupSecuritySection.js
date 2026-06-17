import React from 'react';
import useSession from '../../hooks/useSession';

import { Box, Typography, Button } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';
import QuickSearch from './QuickSearch';

export default ({ currentValues, reactData, updateReactData, updateField }) => {

  const { state } = useSession();

  // Convert an accessible_to rule string to a human-readable label
  function accessLabel(rule) {
    if (rule.startsWith('group:')) {
      const gId = rule.split(':')[1].trim();
      const hierarchy = state.groups?.adminHierarchy || [];
      const found = hierarchy.find(g => g.id === gId || g.group_id === gId);
      const groupName = found?.name || found?.description || gId;
      if (found?.belongs_to) {
        const parent = hierarchy.find(g => g.id === found.belongs_to || g.group_id === found.belongs_to);
        const parentName = parent?.name || parent?.description || found.belongs_to;
        return `Group: ${parentName} / ${groupName}`;
      }
      return `Group: ${groupName}`;
    }
    if (rule.startsWith('person:')) {
      return `Person: ${rule.split(':')[1].trim()}`;
    }
    return rule;
  }

  const currentAccessibleTo = currentValues.Groups?.accessible_to || [];
  const isNone = currentAccessibleTo.length === 0 || currentAccessibleTo.includes('*none');
  const isAll = !isNone && currentAccessibleTo.includes('*all');
  const hasSpecificRestrictions = currentAccessibleTo.some(r => r.startsWith('group:') || r.startsWith('person:'));

  // Build initial QuickSearch selections from the current accessible_to rules
  const existingSelections = currentAccessibleTo
    .filter(r => r.startsWith('group:') || r.startsWith('person:'))
    .map(r => r.startsWith('group:')
      ? { group_id: r.split(':')[1].trim() }
      : { person_id: r.split(':')[1].trim() }
    );

  function saveAccessibleTo(newAccessibleTo, extraReactUpd = {}) {
    updateField({
      updateList: [{
        tableName: 'Groups',
        fieldName: 'accessible_to',
        newData: newAccessibleTo
      }],
      reactUpd: {
        showGroupAccessSearch: false,
        ...extraReactUpd
      }
    });
  }

  return (
    <Box
      key='groupSecurity_masterBox'
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Typography style={AVATextStyle({ bold: true, size: 1.2, margin: { top: 0, bottom: 1 } })}>
        Access restrictions for the {currentValues.Groups.name} group.
      </Typography>

      <Box mb={2}>
        {isNone
          ? <Typography style={AVATextStyle({ margin: { top: 0.5 }, color: 'red' })}>
              No one is allowed to access this group.
            </Typography>
          : isAll
            ? <Typography style={AVATextStyle({ margin: { top: 0.5 } })}>
                Anyone may access this group.
              </Typography>
            : currentAccessibleTo.map((rule, i) => (
                <Typography key={i} style={AVATextStyle({ margin: { top: 0.3 } })}>
                  {accessLabel(rule)}
                </Typography>
              ))
        }
      </Box>

      <Box display='flex' flexDirection='row' style={{ gap: '8px', flexWrap: 'wrap' }}>
        <Button
          onClick={() => {
            updateReactData({ showGroupAccessSearch: true, selections: existingSelections }, true);
          }}
          style={{ backgroundColor: 'orange', color: 'white' }}
        >
          {hasSpecificRestrictions ? 'Change Access Restrictions' : 'Restrict to Specific Groups/People'}
        </Button>
        <Button
          onClick={() => saveAccessibleTo(['*all'])}
          style={{ backgroundColor: 'green', color: 'white' }}
        >
          Allow Everyone
        </Button>
        <Button
          onClick={() => saveAccessibleTo(['*none'])}
          style={{ backgroundColor: 'red', color: 'white' }}
        >
          Allow No One
        </Button>
      </Box>

      {reactData.showGroupAccessSearch &&
        <QuickSearch
          reactData={reactData}
          updateReactData={updateReactData}
          options={{
            title: `Who Can Access "${currentValues.Groups.name}"?`,
            withGroups: true,
            showGroupList: true,
            showAll: true,
            pickAndGo: true,
            keepSelections: true,
            buttonText: {
              empty: 'No One (deny all)',
              selected: 'Use These'
            }
          }}
          onClose={(selections) => {
            const cleanSelections = ([selections].flat()).filter(s => s && (s.person_id || s.group_id));
            // Preserve special rules other than *all/*none and group:/person: entries
            const keptRules = currentAccessibleTo
              .filter(r => !r.startsWith('group:') && !r.startsWith('person:') && r !== '*all' && r !== '*none');
            const newAccessibleTo = cleanSelections.length === 0
              ? ['*none']
              : [
                  ...keptRules,
                  ...cleanSelections.map(s => s.group_id ? `group:${s.group_id}` : `person:${s.person_id}`)
                ];
            saveAccessibleTo(newAccessibleTo, { selections: cleanSelections });
          }}
        />
      }
    </Box>
  );
};
