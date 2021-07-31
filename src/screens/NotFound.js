import React from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';

export default () => (
  <Box m={10} display='flex' flexDirection='column' alignItems='center' justifyContent='center'>
    <Typography variant='h1' color='error' gutterBottom noWrap={true}>
      404
    </Typography>
    <Typography variant='h1' color='error' noWrap={true}>
      Not Found
    </Typography>
  </Box>
);
