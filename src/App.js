import React from 'react';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';

import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import withDarkMode from './hocs/withDarkMode';
import withRouter from './hocs/withRouter';
import withTheme from './hocs/withTheme';
import hocFactory from './util/hocFactory';

const App = () => (
  <Box>
    <TopBar />
    <Box paddingBottom='50px'>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
      <Typography variant='h1'>Hello World</Typography>
    </Box>
    <BottomNav />
  </Box>
);

export default hocFactory(App, [withDarkMode, withTheme, withRouter]);
