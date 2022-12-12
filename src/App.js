import React from 'react';
import Box from '@material-ui/core/Box';

import AssignmentIcon from '@material-ui/icons/Assignment';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';

import { Auth } from '@aws-amplify/auth';

import withRecoil from './wrappers/withRecoil';
import withRoot from './wrappers/withRoot';
import hocFactory from './util/hocFactory';
import TheseusScreen from './screens/TheseusScreen';
import ThankYouScreen from './screens/ThankYouScreen';

import Reloader from './screens/Reloader';
import RootNavigation from './navigation/RootNavigation';
import withBootstrap from './hocs/withBootstrap';
import withDarkMode from './hocs/withDarkMode';
import withRouter from './hocs/withRouter';
import withSession from './hocs/withSession';
import withSnackbar from './hocs/withSnackbar';
import withTheme from './hocs/withTheme';
import { createPutFact } from './graphql/mutations';
import { API, graphqlOperation } from 'aws-amplify';

const menu = [
  { label: 'AVA', path: '/theseus', icon: <AssignmentIcon />, screen: <TheseusScreen /> },
  { label: 'Refresh', path: '/refresh', icon: <AutorenewIcon />, screen: <Reloader /> },
  { label: 'Thanks', path: '/thankyou', icon: <ExitToAppIcon />, screen: <ThankYouScreen /> },
];

const HOME = '/theseus';
var hasError = false;

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    hasError = false;
  }

  static getDerivedStateFromError(error) {
    hasError = true;
    handleWriteError(`AVA caught error "${error.message}"`);
  }

  componentDidCatch(error, info) {
    hasError = true;
    handleWriteError(`AVA caught error "${error.message}"`);
  }

  render() {
    if (hasError) {
      return (
        <Box
          display='flex' flexDirection='column' justifyContent='center' alignItems='center'
          key={'loadingBox'}
          ml={2} mr={2} mb={2} mt={12}
        >
          <React.Fragment>
            <Box
              display='flex' flexDirection='column' justifyContent='center' alignItems='center'
              flexWrap='wrap' textOverflow='ellipsis' width='100%'
              key={'loadingBox'}
              mb={2}
            >
              <Typography variant='h5' >{`AVA Encountered an Error`}</Typography>
              <Typography variant='caption' >{`version 22.12.04${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
              <Button
                aria-label='showActivities'
                variant='contained'
                onClick={async () => {
                  let jumpTo = window.location.href.replace('refresh', 'theseus');
                  window.location.replace(jumpTo);
                }}
              >
                {'Tap here'}
              </Button>
            </Box>
          </React.Fragment>
        </Box>
      );
    }
    else {
      return this.props.children;
    }
  }
}

const handleWriteError = async (parmMessage) => {
  if (window.location.href.split('//')[1].slice(0, 1).toLocaleLowerCase() === 'l') {
    alert(parmMessage);
  }
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
    status: `Version = 22.12.04~${errorTime}`,
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
      <Box pb={7}>
        <RootNavigation menu={menu} homePath={HOME} />
      </Box>
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
    // withAuth,
    withBootstrap,
    // withA2HS,
  ]);
