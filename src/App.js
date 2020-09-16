import React from 'react';
import { useSnackbar } from 'notistack';
import { API, Auth, graphqlOperation } from 'aws-amplify';
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
import useSession from './hooks/useSession';
import RootNavigation from './navigation/RootNavigation';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import TheseusScreen from './screens/TheseusScreen';
import hocFactory from './util/hocFactory';

import { getPerson, getSession } from './graphql/queries';
import { SET_PATIENT, SET_SESSION, SET_USER } from './contexts/Session/actions';

const menu = [
  { label: 'Profile', path: '/profile', icon: <AccountCircleIcon />, screen: <ProfileScreen /> },
  { label: 'Theseus', path: '/theseus', icon: <AssignmentIcon />, screen: <TheseusScreen /> },
  { label: 'Chat', path: '/chat', icon: <ChatIcon />, screen: <ChatScreen /> },
];

const HOME = '/theseus';

const App = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { state, dispatch } = useSession();
  const { user } = state;

  React.useEffect(() => {
    (async () => {
      const user = await Auth.currentAuthenticatedUser().catch(error => {
        enqueueSnackbar(`Whoops! Something went wrong when fetching current user: ${error.message}`, {
          variant: 'error',
        });
      });

      dispatch({ type: SET_USER, payload: user });
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      let result1;
      let result2;
      if (user) {
        result1 = await API.graphql(graphqlOperation(getSession, { session_id: user.username })).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching a session: ${error.message}`, {
            variant: 'error',
          });
        });

        result2 = await API.graphql(
          graphqlOperation(getPerson, { person_id: result1.data.getSession.patient_id })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching a patient by session: ${error.message}`, {
            variant: 'error',
          });
        });

        if (mounted) {
          dispatch({ type: SET_SESSION, payload: result1.data.getSession });
          dispatch({ type: SET_PATIENT, payload: result2.data.getPerson });
        } else {
          API.cancel(result1, 'App unmounted');
          API.cancel(result2, 'App unmounted');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      <TopBar />
      <Box pb={7}>
        <RootNavigation menu={menu} homePath={HOME} />
      </Box>
      <BottomNav menu={menu} homePath={HOME} />
    </Box>
  );
};

export default hocFactory(App, [withRouter, withDarkMode, withTheme, withSnackbar, withSession, withAuth]);
