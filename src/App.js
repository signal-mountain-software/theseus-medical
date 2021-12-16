import React from 'react';
import Box from '@material-ui/core/Box';
// import AccountCircleIcon from '@material-ui/icons/AccountCircle';
import AssignmentIcon from '@material-ui/icons/Assignment';
import AutorenewIcon from '@material-ui/icons/Autorenew';
// import ChatIcon from '@material-ui/icons/Chat';
import { Auth } from '@aws-amplify/auth';

// import withA2HS from './wrappers/withA2HS';
import withRecoil from './wrappers/withRecoil';
import withRoot from './wrappers/withRoot';
import hocFactory from './util/hocFactory';
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
  { label: 'AVA', path: '/theseus', icon: <AssignmentIcon />, screen: <TheseusScreen /> },
  { label: 'Refresh', path: '/refresh', icon: <AutorenewIcon />, screen: <Reloader /> },
];

const HOME = '/refresh';
var hasError = false;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    hasError = false;
  }

  componentDidCatch(error, info) {
    hasError = true;
    handleWriteError(`Error "${error}" encountered.  Info is ${info} (${JSON.stringify(info)})` );
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

const handleWriteError = async message => {
  const user = await Auth.currentAuthenticatedUser();
  let instruction = {
    patient_id: 'no info',
    activity_key: '***ERROR_CAUGHT***',
    value: message,
    status: new Date().toString(),
    session: {
      user_id: user?.username || 'no user logged',
      session_id: 'no session recorded',
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
