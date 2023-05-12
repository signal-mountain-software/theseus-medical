import React from 'react';
import Box from '@material-ui/core/Box';

import useSession from '../hooks/useSession';
// import ActivitySection from '../components/sections/ActivitySection';
import AVAMenu from '../components/sections/AVAMenu';

export default () => {
  const { state } = useSession();
  const { patient, session } = state;

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(registration => {
        registration.update();
      })
      .catch(error => {
        console.error(error.message);
        throw error.message;
      });
  }

  return (
    <Box>
      <AVAMenu pPerson={patient.person_id} patient={patient} pClient={session.client_id} />
    </Box>
  );
};
