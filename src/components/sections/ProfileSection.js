import React from 'react';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

export default ({ session }) => {
  const getGreeting = () => {
    const date = new Date();
    const hours = date.getHours();

    let greeting;
    if (hours >= 18) {
      greeting = 'Good Evening';
    } else if (hours >= 12) {
      greeting = 'Good Afternoon';
    } else if (hours >= 6) {
      greeting = 'Good Morning';
    } else {
      greeting = 'Good Evening';
    }
    return greeting;
  };

  return (
    <Paper component={Box} m={2}>
      <Box mt={1} py={1.25} px={3} borderBottom={2} display='flex' flexDirection='row'>
        <Box flexGrow={1} display='flex' flexDirection='row' alignItems='center'>
          <Typography variant='subtitle1'>Profile</Typography>
        </Box>
      </Box>
      <Box p={3} flexGrow={1}>
        <Typography variant='h5' gutterBottom>
          {getGreeting()}, {session?.user_display_name}!
        </Typography>
        {session?.patient_id ? (
          <Typography variant='body1'>Your current patient is {session?.patient_display_name}</Typography>
        ) : (
          <Typography variant='body1'>You are currently viewing your own facts</Typography>
        )}
      </Box>
    </Paper>
  );
};
