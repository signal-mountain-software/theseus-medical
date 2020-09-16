import React from 'react';
import { Auth } from 'aws-amplify';
import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import useScrollTrigger from '@material-ui/core/useScrollTrigger';
import AssignmentIndIcon from '@material-ui/icons/AssignmentInd';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';

import useSession from '../hooks/useSession';
import SwitchPatientDialog from './dialogs/SwitchPatientDialog';
import PatientChip from './PatientChip';

const HideOnScroll = ({ children }) => {
  const trigger = useScrollTrigger();

  return (
    <Slide appear={false} direction='down' in={!trigger}>
      {children}
    </Slide>
  );
};

export default () => {
  const [open, setOpen] = React.useState(false);
  const { state } = useSession();
  const { patient } = state;

  const onSwitchPatient = () => {
    setOpen(true);
  };

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
            <Box mr={1}>
              <Tooltip
                title={<Typography variant='subtitle1'>Switch current patient</Typography>}
                placement='bottom-end'>
                <Button
                  color='primary'
                  size='small'
                  variant='contained'
                  startIcon={<AssignmentIndIcon />}
                  endIcon={<SwapHorizIcon />}
                  onClick={onSwitchPatient}>
                  Patient
                </Button>
              </Tooltip>
            </Box>
            <Tooltip
              title={<Typography variant='subtitle1'>Sign out of Theseus Medical</Typography>}
              placement='bottom-end'>
              <Button
                color='secondary'
                size='small'
                variant='contained'
                endIcon={<ExitToAppIcon />}
                onClick={onSignOut}>
                Sign Out
              </Button>
            </Tooltip>
          </Toolbar>
        </AppBar>
      </HideOnScroll>
      <Toolbar />
      <SwitchPatientDialog
        patient={patient}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
      />
    </Box>
  );
};
