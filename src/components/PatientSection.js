import React from 'react';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

export default ({ patient }) => (
  <Paper component={Box} m={2}>
    <Box mt={1} py={1.25} px={3} borderBottom={2} display='flex' flexDirection='row'>
      <Box flexGrow={1} display='flex' flexDirection='row' alignItems='center'>
        <Typography variant='subtitle1'>Current Patient</Typography>
      </Box>
    </Box>
    <Box p={3} flexGrow={1}>
      <Typography variant='body1'>
        Your patient is {patient?.name.last}, {patient?.name.first}
      </Typography>
      <Typography variant='body1'>He is in room #{patient?.location}</Typography>
    </Box>
  </Paper>
);
