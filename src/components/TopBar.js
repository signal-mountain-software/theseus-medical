import React from 'react';
import { useRecoilState } from 'recoil';
import { Auth } from 'aws-amplify';

import { API, graphqlOperation } from 'aws-amplify';
import { updateSession } from '../graphql/mutations';
import { SET_PATIENT, SET_SESSION } from '../contexts/Session/actions';
import { useSnackbar } from 'notistack';
import { getPerson } from '../graphql/queries';

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
import AssignmentIndIcon from '@material-ui/icons/AssignmentInd';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import HomeIcon from '@material-ui/icons/Home';
import GetAppIcon from '@material-ui/icons/GetApp';
import PersonAddIcon from '@material-ui/icons/PersonAdd';
import PatientDialog from './dialogs/PatientDialog';
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
  const [hideSwitchAccountButton, setHideSwitchAccountButton] = React.useState(true);
  const { enqueueSnackbar } = useSnackbar();
  const { dispatch } = useSession();
  const [open, setOpen] = React.useState(false);
  const [addAccount, setAddAccount] = React.useState(false);
  const [templatePatient, setTemplatePatient] = React.useState({});
  const [anchorEl, setAnchorEl] = React.useState(null);
  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
  const isStandalone = useMediaQuery('(display-mode: standalone)');
  const [ platform, showIOS ] = useIosCheck();
  const { state } = useSession();
  const { patient, roles, session } = state;
  if (session) { session.platform = platform; }
  state.platform = platform;

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

  const onAddAccount = () => {
    setTemplatePatient({
      "person_id": "*NEW~" + new Date().getTime().toString(),
      "location": "",
      "client_id": session.client_id,
      "search_data": "",
      "clients": [
        {
          "groups": [],
          "id": session.client_id
        }
      ],
      "name": {
        "last": "",
        "first": ""
      },
      "display_name": "",
      "groups": [],
      "preferred_method": "AVA",
      "relationships": null,
      "roles": ["patient"],
      "messaging": {},
      "time_offset": -5,
    });
    setAddAccount(true);
  };

  const onReset = async () => {
    if (session) {
      let newPatient = {
        patient_id: session.user_id,
        patient_display_name: session.user_display_name
      };
      const result1 = await API.graphql(
        graphqlOperation(updateSession, { input: { session_id: session.user_id, ...newPatient } })
      ).catch(error => {
        enqueueSnackbar(`Whoops! Something went wrong when fetching a session: ${error.errors[0].message}`, {
          variant: 'error',
        });
      });

      const result2 = await API.graphql(
        graphqlOperation(getPerson, {
          person_id: session.user_id,
        })
      ).catch(error => {
        enqueueSnackbar(`Whoops! Something went wrong when fetching a patient by session: ${error.errors[0].message}`, {
          variant: 'error',
        });
      });

      dispatch({ type: SET_SESSION, payload: result1.data.updateSession });
      dispatch({ type: SET_PATIENT, payload: result2.data.getPerson });
      let jumpTo = window.location.href.replace('refresh', 'theseus');
      window.location.replace(jumpTo);
    }
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
      setHideSwitchAccountButton(!roles.includes('responsible_for'));
    }
  }, [roles]);

  return (
    <Box flexGrow={1}>
      <AppBar color='inherit'>
        <Toolbar>
          <Box flexGrow={1}>
            <PatientChip patient={patient} roles={roles} session={session} />
          </Box>
          
          {!isMobile && !hideSwitchAccountButton && (
            <Box >
              <Tooltip
                enterDelay={2000}
                title={<Typography variant='caption'>{session.responsible_for}</Typography>}
                placement='bottom-end'>
                <Button
                  color='primary'
                  size='small'
                  variant='contained'
                  startIcon={<AssignmentIndIcon />}
                  endIcon={<SwapHorizIcon />}
                  onClick={onSwitchPatient}>
                  Switch Account
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
            {isMobile && !hideSwitchAccountButton && (
              <MenuItem onClick={onSwitchPatient}>
                <ListItemIcon>
                  <SwapHorizIcon />
                </ListItemIcon>
                <ListItemText primary={'Switch Account'} />
              </MenuItem>
            )}
            {session && (session.patient_id !== session.user_id) &&
              <MenuItem onClick={onReset}>
                <ListItemIcon>
                  <HomeIcon />
                </ListItemIcon>
                <ListItemText primary={`Use ${session.user_display_name} (${session.user_id})`} />
              </MenuItem>
            }
            <MenuItem onClick={onSignOut}>
              <ListItemIcon>
                <ExitToAppIcon />
              </ListItemIcon>
              <ListItemText primary='Sign Out' />
            </MenuItem>
            {session?.responsible_for && (
              <MenuItem onClick={onAddAccount}>
                <ListItemIcon>
                  <PersonAddIcon />
                </ListItemIcon>
                <ListItemText primary='Create Account' />
              </MenuItem>
            )}
            {false && showInstall() && (
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
      {addAccount && (
        <PatientDialog
          patient={templatePatient}
          picture={''}
          open={addAccount}
          onClose={() => {
            setAddAccount(false);
          }}
        />
      )}
    </Box>
  );
};
