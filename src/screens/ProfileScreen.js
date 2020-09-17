import React from 'react';
import Box from '@material-ui/core/Box';

import useSession from '../hooks/useSession';
import ProfileSection from '../components/sections/ProfileSection';

export default () => {
  const { state } = useSession();
  const { session } = state;

  return (
    <Box>
      <ProfileSection session={session} />
    </Box>
  );
};
