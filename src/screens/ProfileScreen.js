import React from 'react';
import Box from '@material-ui/core/Box';

import ProfileSection from '../components/ProfileSection';
import useSession from '../hooks/useSession';

export default () => {
  const { state } = useSession();
  const { session } = state;

  return (
    <Box>
      <ProfileSection session={session} />
    </Box>
  );
};
