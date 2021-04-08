import React from 'react';
import Box from '@material-ui/core/Box';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import AssignmentIcon from '@material-ui/icons/Assignment';
import ChatIcon from '@material-ui/icons/Chat';

import withA2HS from './wrappers/withA2HS';
import withRecoil from './wrappers/withRecoil';
import withRoot from './wrappers/withRoot';
import hocFactory from './util/hocFactory';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import TheseusScreen from './screens/TheseusScreen';
import RootNavigation from './navigation/RootNavigation';
import withAuth from './hocs/withAuth';
import withBootstrap from './hocs/withBootstrap';
import withDarkMode from './hocs/withDarkMode';
import withRouter from './hocs/withRouter';
import withSession from './hocs/withSession';
import withSnackbar from './hocs/withSnackbar';
import withTheme from './hocs/withTheme';
import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';

const menu = [
  { label: 'Profile', path: '/profile', icon: <AccountCircleIcon />, screen: <ProfileScreen /> },
  { label: 'AVA', path: '/theseus', icon: <AssignmentIcon />, screen: <TheseusScreen /> },
  { label: 'Chat', path: '/chat', icon: <ChatIcon />, screen: <ChatScreen /> },
];

const HOME = '/theseus';

const App = () => (
  <Box>
    <TopBar />
    <Box pb={7}>
      <RootNavigation menu={menu} homePath={HOME} />
    </Box>
    <BottomNav menu={menu} homePath={HOME} />
  </Box>
);

export default hocFactory(App, [
  withRecoil,
  withRoot,
  withRouter,
  withDarkMode,
  withTheme,
  withSnackbar,
  withSession,
  withAuth,
  withBootstrap,
  withA2HS,
]);
