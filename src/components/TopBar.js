import React from 'react';
import { Auth } from 'aws-amplify';

import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import useScrollTrigger from '@material-ui/core/useScrollTrigger';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';

import PatientChip from './PatientChip';

const HideOnScroll = ({ children }) => {
  const trigger = useScrollTrigger();

  return (
    <Slide appear={false} direction='down' in={!trigger}>
      {children}
    </Slide>
  );
};

export default ({ patient }) => {
  const onSignOut = () => {
    Auth.signOut().then(() => {
      window.location.reload();
    });
  };

  return (
    <Box flexGrow={1}>
      <HideOnScroll>
        <AppBar color='inherit'>
          <Toolbar>
            <Box flexGrow={1}>
              <PatientChip patient={patient} />
            </Box>
            <Button color='secondary' size='small' variant='contained' endIcon={<ExitToAppIcon />} onClick={onSignOut}>
              Logout
            </Button>
          </Toolbar>
        </AppBar>
      </HideOnScroll>
      <Toolbar />
    </Box>
  );
};
