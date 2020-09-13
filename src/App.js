import React from 'react';

import Box from '@material-ui/core/Box';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import AssignmentIcon from '@material-ui/icons/Assignment';
import ChatIcon from '@material-ui/icons/Chat';

import BottomNav from './components/BottomNav';
import TopBar from './components/TopBar';
import withDarkMode from './hocs/withDarkMode';
import withRouter from './hocs/withRouter';
import withTheme from './hocs/withTheme';
import RootNavigation from './navigation/RootNavigation';
import ChatScreen from './screens/ChatScreen';
import FactsScreen from './screens/FactsScreen';
import ProfileScreen from './screens/ProfileScreen';
import hocFactory from './util/hocFactory';

const menu = [
  { label: 'Profile', path: '/profile', icon: <AccountCircleIcon />, screen: <ProfileScreen /> },
  { label: 'Facts', path: '/facts', icon: <AssignmentIcon />, screen: <FactsScreen /> },
  { label: 'Chat', path: '/chat', icon: <ChatIcon />, screen: <ChatScreen /> },
];

const App = () => (
  <Box>
    <TopBar />
    <Box paddingBottom='50px'>
      <RootNavigation menu={menu} homePath='/facts' />
    </Box>
    <BottomNav menu={menu} homePath='/facts' />
  </Box>
);

export default hocFactory(App, [withDarkMode, withTheme, withRouter]);
