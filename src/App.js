import React from 'react';
import Box from '@material-ui/core/Box';
import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import AssignmentIcon from '@material-ui/icons/Assignment';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import ChatIcon from '@material-ui/icons/Chat';

import withA2HS from './wrappers/withA2HS';
import withRecoil from './wrappers/withRecoil';
import withRoot from './wrappers/withRoot';
import hocFactory from './util/hocFactory';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import TheseusScreen from './screens/TheseusScreen';
import Reloader from './screens/Reloader';
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
import { createPutFact } from './graphql/mutations';
import { API, graphqlOperation } from 'aws-amplify';

const menu = [
  { label: 'Profile', path: '/profile', icon: <AccountCircleIcon />, screen: <ProfileScreen /> },
  { label: 'AVA', path: '/theseus', icon: <AssignmentIcon />, screen: <TheseusScreen /> },
  { label: 'Refresh', path: '/refresh', icon: <AutorenewIcon />, screen: <Reloader /> },
  { label: 'Chat', path: '/chat', icon: <ChatIcon />, screen: <ChatScreen /> },
];

const HOME = '/theseus';
var hasError = false;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    hasError = false;
  }
  
  componentDidCatch(error, info) {
    hasError = true;
    handleWriteError(error.message);
  }

  render() {
    if (hasError) {
      return <h1>`Whoops! We had a problem. Contact support please.`</h1>;
    }
    return this.props.children
  }
  
}

const handleWriteError = async message => {
  let instruction = {
    patient_id: 'no info',
    activity_key: '***ERROR_CAUGHT***',
    value: 'see error',
    session: {
      user_id: 'no user logged',
      session_id: 'no session logged',
    },
  };
  await API.graphql(graphqlOperation(createPutFact, { input: instruction }));
};

const App = () => (
  <ErrorBoundary>
    <Box>
      <TopBar />
      <Box pb={7}>
        <RootNavigation menu={menu} homePath={HOME} />
      </Box>
      <BottomNav menu={menu} homePath={HOME} />
    </Box>
  </ErrorBoundary>
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
