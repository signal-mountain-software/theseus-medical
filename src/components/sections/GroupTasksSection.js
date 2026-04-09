import React from 'react';

import { Box, Button, CircularProgress, Typography } from '@material-ui/core';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { getMemberList } from '../../util/AVAGroups';
import TaskCompletionRound from '../dialogs/TaskCompletionRound';

/**
 * GroupTasksSection
 *
 * Section for GroupMaintenance that lets an admin record activity completions
 * for all members of this group.
 *
 * Receives standard GroupMaintenance section props:
 *   currentValues, reactData
 */
export default function GroupTasksSection({ currentValues, reactData }) {
  const AVAClass = AVAclasses();

  const group_id = currentValues?.Groups?.group_id;
  const client_id = reactData?.client_id;
  const viewer_id = reactData?.user_id;
  const isAdmin = !!reactData?.administrative_account;

  const [open, setOpen] = React.useState(false);
  const [personIds, setPersonIds] = React.useState(null); // null = not yet loaded
  const [loading, setLoading] = React.useState(false);
  const isMounted = React.useRef(false);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const handleOpen = async () => {
    if (personIds) {
      setOpen(true);
      return;
    }
    setLoading(true);
    const result = await getMemberList(group_id, client_id, { nameOnly: true });
    const ids = (result?.peopleList || []).map(p => p.person_id).filter(Boolean);
    if (isMounted.current) {
      setPersonIds(ids);
      setLoading(false);
      setOpen(true);
    }
  };

  return (
    <Box p={2}>
      <Typography style={AVATextStyle({ size: 1.1, bold: true })} gutterBottom>
        {'Daily Activities & Tasks'}
      </Typography>
      <Typography variant='body2' color='textSecondary' gutterBottom>
        {'Record activity completions for all members of this group.'}
      </Typography>
      <Box mt={1}>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'teal', color: 'white' }}
          size='small'
          disabled={loading || !group_id}
          onClick={handleOpen}
          startIcon={loading ? <CircularProgress size={14} style={{ color: 'white' }} /> : null}
        >
          {loading ? 'Loading members…' : 'Record Completions'}
        </Button>
      </Box>

      {open && personIds && personIds.length > 0 && (
        <TaskCompletionRound
          personIds={personIds}
          client_id={client_id}
          viewer_id={viewer_id}
          isAdmin={isAdmin}
          onClose={() => setOpen(false)}
        />
      )}

      {open && personIds && personIds.length === 0 && (
        <Typography variant='body2' color='textSecondary' style={{ marginTop: 8 }}>
          {'No members found in this group.'}
        </Typography>
      )}
    </Box>
  );
}
