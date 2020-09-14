import React from 'react';
import { Auth } from 'aws-amplify';

import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import useScrollTrigger from '@material-ui/core/useScrollTrigger';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';

import { SHOW_SNACKBAR } from '../contexts/Snackbar/actions';
import useSnackbar from '../hooks/useSnackbar';

const HideOnScroll = ({ children }) => {
  const trigger = useScrollTrigger();

  return (
    <Slide appear={false} direction='down' in={!trigger}>
      {children}
    </Slide>
  );
};

export default () => {
  const { dispatch } = useSnackbar();

  const onSignOut = () => {
    dispatch({
      type: SHOW_SNACKBAR,
      payload: {
        message: 'Successfully logged out!',
        anchor: { vertical: 'top' },
        direction: 'down',
      },
    });
    Auth.signOut().then(() => {
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    });
  };

  return (
    <Box flexGrow={1}>
      <HideOnScroll>
        <AppBar color='inherit'>
          <Toolbar>
            <Box flexGrow={1}>
              <Typography variant='h6'>Theseus Medical</Typography>
            </Box>
            <IconButton onClick={onSignOut}>
              <ExitToAppIcon />
            </IconButton>
          </Toolbar>
        </AppBar>
      </HideOnScroll>
      <Toolbar />
    </Box>
  );
};
