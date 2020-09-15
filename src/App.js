import React from 'react';
import Amplify, { API, graphqlOperation } from 'aws-amplify';
import { useSnackbar } from 'notistack';
import Box from '@material-ui/core/Box';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import AssignmentIcon from '@material-ui/icons/Assignment';
import ChatIcon from '@material-ui/icons/Chat';

import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import withAuth from './hocs/withAuth';
import withDarkMode from './hocs/withDarkMode';
import withRouter from './hocs/withRouter';
import withSession from './hocs/withSession';
import withSnackbar from './hocs/withSnackbar';
import withTheme from './hocs/withTheme';
import RootNavigation from './navigation/RootNavigation';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import TheseusScreen from './screens/TheseusScreen';
import hocFactory from './util/hocFactory';

import { getSessionWithPatient } from './graphql/queries';
import { SET_PATIENT, SET_SESSION } from './contexts/Session/actions';
import useSession from './hooks/useSession';

import config from './config/amplify.json';
Amplify.configure(config);

const menu = [
  { label: 'Profile', path: '/profile', icon: <AccountCircleIcon />, screen: <ProfileScreen /> },
  { label: 'Theseus', path: '/theseus', icon: <AssignmentIcon />, screen: <TheseusScreen /> },
  { label: 'Chat', path: '/chat', icon: <ChatIcon />, screen: <ChatScreen /> },
];

const HOME = '/theseus';

const App = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { state, dispatch } = useSession();
  const { patient } = state;

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      let result;
      result = await API.graphql(
        graphqlOperation(getSessionWithPatient, { client_id: 'SMSoft', device_id: 'TESTDEVICE' })
      ).catch(error => {
        enqueueSnackbar(`Whoops! Something went wrong when fetching a patient by session: ${error.message}`, {
          variant: 'error',
        });
      });

      if (mounted) {
        dispatch({ type: SET_PATIENT, payload: result.data.getSessionWithPatient.patient });
        dispatch({ type: SET_SESSION, payload: result.data.getSessionWithPatient.session });
      } else {
        API.cancel(result, 'App unmounted');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      <TopBar patient={patient} />
      <Box pb={7}>
        <RootNavigation menu={menu} homePath={HOME} />
      </Box>
      <BottomNav menu={menu} homePath={HOME} />
    </Box>
  );
};

export default hocFactory(App, [withRouter, withDarkMode, withTheme, withSnackbar, withAuth, withSession]);
