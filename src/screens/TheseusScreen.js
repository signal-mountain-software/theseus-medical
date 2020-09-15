import React from 'react';
import Box from '@material-ui/core/Box';

import ActivitySection from '../components/ActivitySection';
import FactSection from '../components/FactSection';
import useSession from '../hooks/useSession';

export default () => {
  const [newFact, setNewFact] = React.useState(null);
  const { state } = useSession();
  const { patient, session } = state;

  return (
    <Box>
      <ActivitySection patient={patient} session={session} setNewFact={setNewFact} />
      <FactSection patient={patient} newFact={newFact} />
    </Box>
  );
};
