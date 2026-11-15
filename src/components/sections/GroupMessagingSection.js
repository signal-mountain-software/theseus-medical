import React from 'react';
import useSession from '../../hooks/useSession';

import { Box, Typography, CircularProgress, Checkbox, FormControlLabel } from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';
import { getGroupAccessibleGroups } from '../../util/AVAGroups';
import { buildShortcutMenuId, getExistingShortcutStates, setMessageShortcut } from '../../util/AVAMessageShortcuts';

// Reverse-lookup counterpart to GroupSecuritySection's accessible_to editor - see the Group
// Security / Messaging Shortcuts design notes. Where GroupSecuritySection answers "who may
// access this group" (edited here, on this group's own record), this section answers "what has
// everyone ELSE granted to this group's members" (computed via getGroupAccessibleGroups, never
// stored on this group's own record at all).
//
// Both screens can end up toggling the SAME underlying MenuV3 shortcut record when the
// relationship is a direct group<->group grant - that's intentional, not a bug. There is
// genuinely only one shared on/off switch per (granteeRule, targetGroupId) pair, exposed from
// two screens; see AVAMessageShortcuts.js.
export default ({ currentValues }) => {

  const { state } = useSession();
  const group_id = currentValues.Groups?.group_id;
  const client_id = currentValues.Groups?.client_id || state.session?.client_id;
  const granteeRule = `group:${group_id}`;

  const [candidates, setCandidates] = React.useState([]);
  const [shortcutStates, setShortcutStates] = React.useState({});
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!group_id || !client_id) { setCandidates([]); setShortcutStates({}); return; }
      setLoading(true);
      const found = await getGroupAccessibleGroups(client_id, group_id);
      if (cancelled) { return; }
      const states = await getExistingShortcutStates(
        client_id,
        found.map(c => ({ granteeRule, targetGroupId: c.group_id }))
      );
      if (cancelled) { return; }
      setCandidates(found);
      setShortcutStates(states);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client_id, group_id]);

  async function toggleShortcut(targetGroupId, targetGroupName, enabled) {
    const menu_id = buildShortcutMenuId(granteeRule, targetGroupId);
    setShortcutStates(prev => ({ ...prev, [menu_id]: enabled }));  // optimistic
    const result = await setMessageShortcut({ client_id, granteeRule, targetGroupId, targetGroupName, enabled });
    if (result === null) {
      setShortcutStates(prev => ({ ...prev, [menu_id]: !enabled }));  // revert on failure
    }
  }

  return (
    <Box
      key='groupMessaging_masterBox'
      flexGrow={2} px={2} py={4} display='flex' flexDirection='column'
    >
      <Typography style={AVATextStyle({ bold: true, size: 1.2, margin: { top: 0, bottom: 1 } })}>
        Messaging shortcuts for the {currentValues.Groups?.name} group.
      </Typography>
      <Typography variant='body2' style={{ color: 'gray', marginBottom: 8 }}>
        A curated selection of what this group's members can already reach, based on access
        granted by other groups. Turning one on gives members a one-tap button to message it.
      </Typography>

      {loading
        ? <CircularProgress size={18} />
        : candidates.length === 0
          ? <Typography variant='body2'>This group has not been granted access to any other groups yet.</Typography>
          : candidates.map((candidate) => {
              const menu_id = buildShortcutMenuId(granteeRule, candidate.group_id);
              return (
                <Box
                  key={candidate.group_id}
                  display='flex' flexDirection='row' alignItems='center' justifyContent='space-between'
                  style={{
                    marginBottom: 6,
                    padding: '6px 14px',
                    borderRadius: 16,
                    backgroundColor: '#f5f7fa',
                    border: '1px solid #e0e4ea'
                  }}
                >
                  <Box display='flex' flexDirection='column'>
                    <Typography variant='body2'>{`${currentValues.Groups?.name || group_id} → ${candidate.group_name}`}</Typography>
                    <Typography variant='caption' style={{ color: 'gray' }}>{candidate.reason}</Typography>
                  </Box>
                  <FormControlLabel
                    style={{ marginRight: 0 }}
                    control={
                      <Checkbox
                        size='small'
                        checked={!!shortcutStates[menu_id]}
                        onChange={(e) => toggleShortcut(candidate.group_id, candidate.group_name, e.target.checked)}
                      />
                    }
                    label={<Typography variant='caption'>One-tap button</Typography>}
                  />
                </Box>
              );
            })
      }
    </Box>
  );
};
