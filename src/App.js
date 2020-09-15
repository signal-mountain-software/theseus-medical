import React from 'react';
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

const menu = [
  { label: 'Profile', path: '/profile', icon: <AccountCircleIcon />, screen: <ProfileScreen /> },
  { label: 'Theseus', path: '/theseus', icon: <AssignmentIcon />, screen: <TheseusScreen /> },
  { label: 'Chat', path: '/chat', icon: <ChatIcon />, screen: <ChatScreen /> },
];

const HOME = '/theseus';

const App = () => {
  const { state } = useSession();
  const { patient } = state;

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

export default hocFactory(App, [withRouter, withDarkMode, withTheme, withSnackbar, withSession, withAuth]);
