import React from 'react';

import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import useScrollTrigger from '@material-ui/core/useScrollTrigger';

const HideOnScroll = ({ children }) => {
  const trigger = useScrollTrigger();

  return (
    <Slide appear={false} direction='down' in={!trigger}>
      {children}
    </Slide>
  );
};

export default () => (
  <Box flexGrow={1}>
    <HideOnScroll>
      <AppBar color='inherit'>
        <Toolbar>
          <Box flexGrow={1}>
            <Typography variant='h6'>Theseus Medical</Typography>
          </Box>
        </Toolbar>
      </AppBar>
    </HideOnScroll>
    <Toolbar />
  </Box>
);
