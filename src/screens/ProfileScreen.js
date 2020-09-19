import React from 'react';
import Box from '@material-ui/core/Box';

import ActivityCustomizationsSection from '../components/sections/ActivityCustomizationsSection';
import ClientsSection from '../components/sections/ClientsSection';
import ProfileSection from '../components/sections/ProfileSection';
import RelationshipSection from '../components/sections/RelationshipSection';

import useSession from '../hooks/useSession';

export default () => {
  const { state } = useSession();
  const { profile, session } = state;

  return (
    <Box>
      <ProfileSection session={session} />
      <RelationshipSection person={profile} />
      <ActivityCustomizationsSection person={profile} />
      <ClientsSection person={profile} />
    </Box>
  );
};
