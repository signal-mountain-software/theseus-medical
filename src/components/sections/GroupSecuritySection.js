import React from 'react';
import useSession from '../../hooks/useSession';

import { Box, Typography, Button, Checkbox, FormControlLabel, CircularProgress } from '@material-ui/core/';

import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';
import { buildShortcutMenuId, getExistingShortcutStates, setMessageShortcut } from '../../util/AVAMessageShortcuts';
import QuickSearch from './QuickSearch';

export default ({ currentValues, reactData, updateReactData, updateField }) => {

  const { state } = useSession();
  const AVAClass = AVAclasses();

  // The three named star-values that can appear as access rules in accessible_to
  // and need to be selectable (and pre-selected) in the QuickSearch dialog. Unlike
  // group:/person: rules, these are stored bare (no prefix) in accessible_to.
  const SPECIAL_ACCESS_VALUES = [
    { person_id: '*all', first: '* Everybody', last: '' },
    { person_id: '*admin', first: '* Administrators', last: '' },
    { person_id: '*support', first: '* Support Staff', last: '' },
  ];
  const SPECIAL_ACCESS_IDS = SPECIAL_ACCESS_VALUES.map(v => v.person_id);

  // Convert an accessible_to rule string to a human-readable label, with no "Group:"/"Person:"
  // type prefix - shared by accessLabel (which adds its own prefix, for the "Who can access"
  // summary) and shortcutRowLabel (which appends an explicit destination arrow instead, for the
  // one-tap toggle rows, where the type prefix is redundant once the arrow makes the direction
  // of the message explicit).
  function bareRuleLabel(rule) {
    if (rule.startsWith('group:')) {
      const gId = rule.split(':')[1].trim();
      const hierarchy = state.groups?.adminHierarchy || [];
      const found = hierarchy.find(g => g.id === gId || g.group_id === gId);
      const groupName = found?.name || found?.description || gId;
      if (found?.belongs_to) {
        const parent = hierarchy.find(g => g.id === found.belongs_to || g.group_id === found.belongs_to);
        const parentName = parent?.name || parent?.description || found.belongs_to;
        return `${parentName} / ${groupName}`;
      }
      return groupName;
    }
    if (rule.startsWith('person:')) {
      return rule.split(':')[1].trim();
    }
    const special = SPECIAL_ACCESS_VALUES.find(v => v.person_id === rule);
    if (special) { return special.first; }
    return rule;
  }

  // Convert an accessible_to rule string to a human-readable label
  function accessLabel(rule) {
    if (rule.startsWith('group:')) { return `Group: ${bareRuleLabel(rule)}`; }
    if (rule.startsWith('person:')) { return `Person: ${bareRuleLabel(rule)}`; }
    return bareRuleLabel(rule);
  }

  // Label for a one-tap message shortcut row - the destination (this group) is spelled out
  // explicitly with an arrow, since "who it's for" is the whole point of this row; the bare
  // type-free label plus the arrow reads the same whether the rule is a group, a person, or a
  // special value.
  function shortcutRowLabel(rule) {
    return `${bareRuleLabel(rule)} → ${currentValues.Groups?.name || group_id}`;
  }

  const currentAccessibleTo = currentValues.Groups?.accessible_to || [];
  const isNone = currentAccessibleTo.length === 0 || currentAccessibleTo.includes('*none');
  const isAll = !isNone && currentAccessibleTo.includes('*all');
  const group_id = currentValues.Groups?.group_id;
  const client_id = currentValues.Groups?.client_id || state.session?.client_id;

  // One-tap message shortcut toggles - see the Group Security / Messaging Shortcuts design
  // notes. Each row here mirrors one accessible_to rule verbatim into a MenuV3 shortcut's
  // available_to, so the shortcut can never reach a broader audience than the access it
  // mirrors. Keyed by the deterministic menu_id so a given rule's on/off state survives
  // currentAccessibleTo being re-ordered or re-fetched.
  const [shortcutStates, setShortcutStates] = React.useState({});
  const [shortcutsLoading, setShortcutsLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function loadShortcutStates() {
      if (isNone || !group_id || !client_id) { setShortcutStates({}); return; }
      setShortcutsLoading(true);
      const states = await getExistingShortcutStates(
        client_id,
        currentAccessibleTo.map(rule => ({ granteeRule: rule, targetGroupId: group_id }))
      );
      if (!cancelled) {
        setShortcutStates(states);
        setShortcutsLoading(false);
      }
    }
    loadShortcutStates();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client_id, group_id, isNone, JSON.stringify(currentAccessibleTo)]);

  async function toggleShortcut(rule, enabled) {
    const menu_id = buildShortcutMenuId(rule, group_id);
    setShortcutStates(prev => ({ ...prev, [menu_id]: enabled }));  // optimistic
    const result = await setMessageShortcut({
      client_id, granteeRule: rule, targetGroupId: group_id, targetGroupName: currentValues.Groups.name, enabled
    });
    if (result === null) {
      setShortcutStates(prev => ({ ...prev, [menu_id]: !enabled }));  // revert on failure
    }
  }

  // Build initial QuickSearch selections from the current accessible_to rules.
  // SPECIAL_ACCESS_IDS rules are stored bare (no prefix) - include those directly.
  const existingSelections = currentAccessibleTo
    .filter(r => r.startsWith('group:') || r.startsWith('person:') || SPECIAL_ACCESS_IDS.includes(r))
    .map(r => r.startsWith('group:')
      ? { group_id: r.split(':')[1].trim() }
      : r.startsWith('person:')
        ? { person_id: r.split(':')[1].trim() }
        : { person_id: r }
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

      <Box
        display='flex' alignItems='flex-start' justifyContent='space-between'
        style={{
          marginTop: 8,
          marginBottom: 12,
          padding: '10px 14px',
          borderRadius: 16,
          backgroundColor: '#f5f7fa',
          border: '1px solid #e0e4ea'
        }}
      >
        <Box display='flex' flexDirection='column' style={{ minWidth: 0, paddingRight: 8 }}>
          <Typography variant='caption' style={{ color: 'gray' }}>Who can access this group</Typography>
          {isNone
            ? <Typography variant='body2' style={{ color: 'red' }}>
                No one is allowed to access this group.
              </Typography>
            : isAll
              ? <Typography variant='body2'>
                  Anyone may access this group.
                </Typography>
              : currentAccessibleTo.map((rule, i) => (
                  <Typography key={i} variant='body2'>
                    {accessLabel(rule)}
                  </Typography>
                ))
          }
        </Box>
        <Button
          className={AVAClass.AVAButton}
          size='small'
          style={{ marginLeft: 8, backgroundColor: '#c8e6c9', flexShrink: 0 }}
          onClick={() => {
            updateReactData({ showGroupAccessSearch: true, selections: existingSelections }, true);
          }}
        >
          Edit Access
        </Button>
      </Box>

      {!isNone &&
        <Box mb={2}>
          <Typography variant='subtitle2' style={{ marginBottom: 4 }}>
            Give members a one-tap way to message this group
          </Typography>
          {shortcutsLoading
            ? <CircularProgress size={18} />
            : currentAccessibleTo.map((rule, i) => {
                const menu_id = buildShortcutMenuId(rule, group_id);
                return (
                  <Box
                    key={i}
                    display='flex' flexDirection='row' alignItems='center' justifyContent='space-between'
                    style={{
                      marginBottom: 6,
                      padding: '6px 14px',
                      borderRadius: 16,
                      backgroundColor: '#f5f7fa',
                      border: '1px solid #e0e4ea'
                    }}
                  >
                    <Typography variant='body2'>{shortcutRowLabel(rule)}</Typography>
                    <FormControlLabel
                      style={{ marginRight: 0 }}
                      control={
                        <Checkbox
                          size='small'
                          checked={!!shortcutStates[menu_id]}
                          onChange={(e) => toggleShortcut(rule, e.target.checked)}
                        />
                      }
                      label={<Typography variant='caption'>One-tap button</Typography>}
                    />
                  </Box>
                );
              })
          }
        </Box>
      }

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
            withSpecialValues: true,
            specialValueList: SPECIAL_ACCESS_VALUES,
            buttonText: {
              empty: 'No One (deny all)',
              selected: 'Use These'
            }
          }}
          onClose={(selections) => {
            const cleanSelections = ([selections].flat()).filter(s => s && (s.person_id || s.group_id));
            // Preserve rules outside this dialog's scope: anything that isn't a group:/person:
            // entry or one of SPECIAL_ACCESS_IDS (those round-trip through cleanSelections instead,
            // which already reflects any SPECIAL_ACCESS_IDS the user kept/added/removed).
            const keptRules = currentAccessibleTo
              .filter(r => !r.startsWith('group:') && !r.startsWith('person:') && !SPECIAL_ACCESS_IDS.includes(r) && r !== '*none');
            const newAccessibleTo = cleanSelections.length === 0
              ? ['*none']
              : [
                  ...keptRules,
                  // SPECIAL_ACCESS_IDS (*all/*admin/*support) are stored bare - no person: prefix
                  ...cleanSelections.map(s => s.group_id
                    ? `group:${s.group_id}`
                    : SPECIAL_ACCESS_IDS.includes(s.person_id) ? s.person_id : `person:${s.person_id}`)
                ];
            saveAccessibleTo(newAccessibleTo, { selections: cleanSelections });
          }}
        />
      }
    </Box>
  );
};
