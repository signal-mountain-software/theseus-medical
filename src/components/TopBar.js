import React from 'react';
import { useRecoilState } from 'recoil';
import { Auth } from 'aws-amplify';
import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import ListItemText from '@material-ui/core/ListItemText';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
//import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import useMediaQuery from '@material-ui/core/useMediaQuery';
//import useScrollTrigger from '@material-ui/core/useScrollTrigger';
import AssignmentIndIcon from '@material-ui/icons/AssignmentInd';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import GetAppIcon from '@material-ui/icons/GetApp';
import SwapHorizIcon from '@material-ui/icons/SwapHoriz';
import MoreVertIcon from '@material-ui/icons/MoreVert';

import useIosCheck from '../hooks/useIosCheck';
import useSession from '../hooks/useSession';
import promptState from '../states/promptState';
import IosInstall from './dialogs/IosInstall';
import SwitchPatientDialog from './dialogs/SwitchPatientDialog';
import PatientChip from './PatientChip';

import * as serviceWorker from '../serviceWorker';

const ITEM_HEIGHT = 48;

export default () => {
  const [showIOSDialog, setShowIOSDialog] = React.useState(false);
  const [hide, setHide] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [anchorEl, setAnchorEl] = React.useState(null);
  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
  const isStandalone = useMediaQuery('(display-mode: standalone)');
  const showIOS = useIosCheck();
  const { state } = useSession();
  const { patient, roles, session } = state;

  const [prompt, setPrompt] = useRecoilState(promptState);

  const showInstall = () => showIOS || !isStandalone;

  const handleClick = event => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const onSwitchPatient = () => {
    setAnchorEl(null);
    setOpen(true);
  };

  const onIOSInstallClose = () => {
    setShowIOSDialog(false);
  };

  const onSignOut = () => {
    setAnchorEl(null);
    Auth.signOut().then(() => {
      serviceWorker.unregister();
      window.location.reload();
    });
  };

  const onInstall = () => {
    if (showIOS) {
      setShowIOSDialog(true);
    } else {
      // show native prompt
      prompt.prompt();

      // decide what to do after the user chooses
      prompt.userChoice.then(choice => {
        if (choice.outcome === 'accepted') {
          setPrompt(null);
        }
      });
    }
  };

  React.useEffect(() => {
    if (roles) {
      setHide(roles.includes('patient') && !roles.includes('patient_with_partner'));
    }
  }, [roles]);

  return (
    <Box flexGrow={1}>
      <AppBar color='inherit'>
        <Toolbar>
          <Box flexGrow={1}>
            <PatientChip patient={patient} roles={roles} session={session} />
          </Box>
          {!isMobile && !hide && (
                <Box >
                  <Tooltip title={<Typography variant='subtitle1'>Change Account</Typography>} placement='bottom-end'>
                    <Button
                      color='primary'
                      size='small'
                      variant='contained'
                      startIcon={<AssignmentIndIcon />}
                      endIcon={<SwapHorizIcon />}
                      onClick={onSwitchPatient}>
                      Change Account
                    </Button>
                  </Tooltip>
                </Box>
              )}
               
              <IconButton aria-controls='hidden-menu' aria-haspopup='true' onClick={handleClick}>
                <MoreVertIcon />
              </IconButton>
              <Menu
                id='hidden-menu'
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleClose}
                PaperProps={{
                  style: {
                    maxHeight: ITEM_HEIGHT * 4.5,
                  },
                }}
                keepMounted>
                {isMobile && !hide && (
                  <MenuItem onClick={onSwitchPatient}>
                    <ListItemIcon>
                      <SwapHorizIcon />
                    </ListItemIcon>
                    <ListItemText primary={'Change Account'} />
                  </MenuItem>
                )}
                <MenuItem onClick={onSignOut}>
                  <ListItemIcon>
                    <ExitToAppIcon />
                  </ListItemIcon>
                  <ListItemText primary='Sign Out' />
                </MenuItem>
                <MenuItem onClick={() => {
                    window.location.replace(window.location.href + '?v=latest');
                  }}>
                  <ListItemIcon>
                    <AutorenewIcon />
                  </ListItemIcon>
                  <ListItemText primary='Reload' />
                </MenuItem>
                {showInstall() && (
                  <MenuItem onClick={onInstall}>
                    <ListItemIcon>
                      <GetAppIcon />
                    </ListItemIcon>
                    <ListItemText primary='Install' />
                  </MenuItem>
                )}
              </Menu>
        </Toolbar>
      </AppBar>
      <Toolbar />
      <SwitchPatientDialog
        open={open}
        roles={roles}
        onClose={() => {
          setOpen(false);
        }}
      />
      <IosInstall open={showIOSDialog} onClose={onIOSInstallClose} />
    </Box>
  );
};
