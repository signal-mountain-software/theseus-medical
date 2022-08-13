import React from 'react';
import Box from '@material-ui/core/Box';
// import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import AssignmentIcon from '@material-ui/icons/Assignment';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
// import ChatIcon from '@material-ui/icons/Chat';
import { Auth } from '@aws-amplify/auth';

// import withA2HS from './wrappers/withA2HS';
import withRecoil from './wrappers/withRecoil';
import withRoot from './wrappers/withRoot';
import hocFactory from './util/hocFactory';
import TheseusScreen from './screens/TheseusScreen';
import ThankYouScreen from './screens/ThankYouScreen';

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
  { label: 'AVA', path: '/theseus', icon: <AssignmentIcon />, screen: <TheseusScreen /> },
  { label: 'Refresh', path: '/refresh', icon: <AutorenewIcon />, screen: <Reloader /> },
  { label: 'Thanks', path: '/thankyou', icon: <ExitToAppIcon />, screen: <ThankYouScreen /> },
];

const HOME = '/refresh';
var hasError = false;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    hasError = false;
  }

  static getDerivedStateFromError(error) {
    if (window.location.href.split('//')[1].slice(0, 1) !== 'd') {
      alert(`Error "${error.toString()}" caught by getDerviedStateFromError`);
    }
    hasError = true;
    handleWriteError(`Error "${error.toString()}" caught by getDerviedStateFromError`);
  }

  componentDidCatch(error, info) {
    if (window.location.href.split('//')[1].slice(0, 1) !== 'd') {
      alert(`Error "${error.toString()}" encountered.`);
    }
    hasError = true;
    handleWriteError(`Error "${error.toString()}" encountered.  Info is ${JSON.stringify(info)}`);
  }

  render() {
    if (hasError) {
      return <h3>AVA encountered an error</h3>;
    }
    else {
      return this.props.children;
    }
  }
}

const handleWriteError = async (parmMessage) => {
  const user = await Auth
    .currentAuthenticatedUser()
    .catch(e => {
      parmMessage += 'Auth error thrown = ' + JSON.stringify(e);

    });
  let errorTime = new Date().toString();
  let instruction = {
    patient_id: user?.username || 'no info',
    activity_key: '***ERROR_CAUGHT***',
    value: `error.${parmMessage}`,
    status: `Version = 22.8.15~${errorTime}`,
    session: {
      user_id: user?.username || 'no user logged',
      session_id: 'no session recorded',
    },
  };
  await API
    .graphql(graphqlOperation(createPutFact, { input: instruction }))
    .catch(e => { alert(`Temporary connection failure, possible cause: ${parmMessage}`); });
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

export default hocFactory(
  App,
  [
    withRecoil,
    withRoot,
    withRouter,
    withDarkMode,
    withTheme,
    withSnackbar,
    withSession,
    withAuth,
    withBootstrap,
    // withA2HS,
  ]);
