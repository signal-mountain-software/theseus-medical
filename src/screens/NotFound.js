import React from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';

export default () => (
  <Box m={10} display='flex' flexDirection='column' alignItems='center' justifyContent='center'>
    <Typography variant='h1' color='error' gutterBottom noWrap>
      404
    </Typography>
    <Typography variant='h1' color='error' noWrap>
      Not Found
    </Typography>
  </Box>
);
