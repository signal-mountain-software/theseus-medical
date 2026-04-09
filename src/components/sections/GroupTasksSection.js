import React from 'react';

import { Box, CircularProgress, Typography, Button } from '@material-ui/core';

import { AVAclasses } from '../../util/AVAStyles';
import { getMemberList } from '../../util/AVAGroups';
import TaskCompletionRound from '../dialogs/TaskCompletionRound';

export default function GroupTasksSection({ currentValues, reactData }) {
  const AVAClass = AVAclasses();

  const group_id = currentValues?.Groups?.group_id;
  const client_id = reactData?.client_id;
  const viewer_id = reactData?.user_id;
  const isAdmin = !!reactData?.administrative_account;

  const [personIds, setPersonIds] = React.useState(null);  // null = loading
  const [open, setOpen] = React.useState(false);
  const isMounted = React.useRef(false);

  // Auto-load members on mount and auto-open when ready
  React.useEffect(() => {
    isMounted.current = true;
    if (!group_id) { return; }
    async function load() {
      const result = await getMemberList(group_id, client_id, { nameOnly: true });
      const ids = (result?.peopleList || []).map(p => p.person_id).filter(Boolean);
      if (!isMounted.current) { return; }
      setPersonIds(ids);
      setOpen(true);
    }
    load();
    return () => { isMounted.current = false; };
  }, [group_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Still loading
  if (personIds === null) {
    return (
      <Box p={2} display='flex' alignItems='center' style={{ gap: 8 }}>
        <CircularProgress size={20} />
        <Typography variant='body2' color='textSecondary'>Loading group members…</Typography>
      </Box>
    );
  }

  // No members
  if (personIds.length === 0) {
    return (
      <Box p={2}>
        <Typography variant='body2' color='textSecondary'>No members found in this group.</Typography>
      </Box>
    );
  }

  return (
    <Box p={2}>
      {!open && (
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'teal', color: 'white' }}
          size='small'
          onClick={() => setOpen(true)}
        >
          {'Re-open'}
        </Button>
      )}
      {open && (
        <TaskCompletionRound
          personIds={personIds}
          client_id={client_id}
          viewer_id={viewer_id}
          isAdmin={isAdmin}
          onClose={() => setOpen(false)}
        />
      )}
    </Box>
  );
}
