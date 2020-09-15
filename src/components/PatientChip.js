import React from 'react';
import Avatar from '@material-ui/core/Avatar';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import FaceIcon from '@material-ui/icons/Face';

export default ({ patient }) => {
  const getInitials = () => {
    const first = patient?.name.first.charAt(0);
    const last = patient?.name.last.charAt(0);
    return first + last;
  };

  return (
    <Box>
      {patient ? (
        <Chip
          color='primary'
          label={`${patient?.name.last}, ${patient?.name.first}`}
          variant='outlined'
          avatar={<Avatar>{getInitials()}</Avatar>}
          clickable
        />
      ) : (
        <Chip
          color='primary'
          label='Choose a patient (not yet implemented)'
          variant='outlined'
          icon={<FaceIcon />}
          clickable
        />
      )}
    </Box>
  );
};
