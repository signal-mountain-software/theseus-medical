import React from 'react';
import Box from '@material-ui/core/Box';

import useSession from '../hooks/useSession';
import ActivitySection from '../components/sections/ActivitySection';
import FactSection from '../components/sections/FactSection';

export default () => {
  const [newFact, setNewFact] = React.useState(null);
  const { state } = useSession();
  const { patient, session } = state;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.update();
      })
      .catch(error => {
        console.error(error.message);
      });
  }

  return (
    <Box>
      <ActivitySection patient={patient} session={session} newFact={newFact} setNewFact={setNewFact} />
      {false ? <FactSection patient={patient} session={session} newFact={newFact} /> : null}
    </Box>
  );
};
