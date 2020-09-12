import React from 'react';

import BottomNav from './components/BottomNav';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import withDarkMode from './hocs/withDarkMode';
import withRouter from './hocs/withRouter';
import withTheme from './hocs/withTheme';
import hocFactory from './util/hocFactory';

const App = () => (
  <Box>
    <Typography variant='h1'>Hello World</Typography>
    <BottomNav />
  </Box>
);

export default hocFactory(App, [withRouter, withDarkMode, withTheme]);
