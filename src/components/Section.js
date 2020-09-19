import React from 'react';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';

export default ({ title, outlined, children }) => (
  <Paper component={Box} m={2} variant={outlined ? 'outlined' : null}>
    <Box mt={1} py={1} px={3} borderBottom={2}>
      <Box flexGrow={1}>
        <Typography variant='h6'>{title}</Typography>
      </Box>
    </Box>
    <Box p={3} flexGrow={1}>
      {children}
    </Box>
  </Paper>
);
