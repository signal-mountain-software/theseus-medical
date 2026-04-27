import React from 'react';

import Box from '@material-ui/core/Box';

import AssignmentIcon from '@material-ui/icons/Assignment';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import ExitToAppIcon from '@material-ui/icons/ExitToApp';
import Typography from '@material-ui/core/Typography';
import Button from '@material-ui/core/Button';

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

import { dbClient } from './util/AVAUtilities';
import { sendMessages } from './util/AVAMessages';

const menu = [
  { label: 'AVA', path: '/theseus', icon: <AssignmentIcon />, screen: <TheseusScreen /> },
  { label: 'Refresh', path: '/refresh', icon: <AutorenewIcon />, screen: <Reloader /> },
  { label: 'Thanks', path: '/thankyou', icon: <ExitToAppIcon />, screen: <ThankYouScreen /> },
];

const HOME = '/theseus';
var hasError = false;
let errorInfo = {};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    hasError = false;
  }

  static getDerivedStateFromError(error) {
    hasError = true;
    errorInfo.message = error.message;
    errorInfo.location = error.lineNumber;
    errorInfo.fileName = error.fileName;
    return { hasError: true };
    // handleWriteError(`AVA caught error "${error.message}" at line ${error.lineNumber} in file ${error.fileName}`);
  }

  componentDidCatch(error, info) {
    hasError = true;
    errorInfo.message = error.message || error.cause;
    errorInfo.location = error.stack;
    errorInfo.fileName = error.toString();
    // handleWriteError(`AVA caught error.  String is "${error.toString()}". Cause is ${error.cause} on stack ${error.stack}`);
  }

  render() {
    if (hasError) {
      // Wrap ALL cookie/logging/messaging work in try/catch so that a failure
      // here cannot throw a second error (which would cause iOS to show
      // "an error repeatedly occurred" with no recovery).
      try {
        let cookieValues = {};
        let cookies = document.cookie;
        let cookieList = cookies.split('; ');
        for (let this_string of cookieList) {
          try {
            let [this_key, this_value] = this_string.split('=');
            if (this_key && this_value) {
              cookieValues[this_key] = JSON.parse(decodeURIComponent(this_value));
            }
          }
          catch {
            // skip any individual malformed cookie — don't let it abort the loop
          }
        }
        let timestamp = new Date().getTime();
        const avaUser = cookieValues.AVAuser || {};
        dbClient
          .put({
            TableName: 'ActivityLog',
            Item: {
              timestamp,
              user_id: avaUser.user_id || 'error-no_cookie',
              activity_code: 'ERROR log',
              activity_name: 'see previous',
              cookieValues,
              errorInfo,
              AVA_version: `${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
            }
          })
          .promise()
          .catch(putError => {
            console.log(`Bad put to ActivityLog - caught error is: ${putError}`);
          });
        const env = window.location.href.split('//')[1].slice(0, 1).toUpperCase();
        if (env !== 'L') {
          let messageObj = {
            client: avaUser.client || 'unknown',
            author: avaUser.user_id || 'error-no_cookie',
            messageText: `AVA ERROR ${errorInfo.message} in ${errorInfo.fileName} at ${errorInfo.location || 'n/a'}.  See Activity Log for User ${avaUser.user_id || 'error-no_cookie'} at ${timestamp}`,
            thread_id: `error_thread_${timestamp}`,
            recipientList: 'rsteele',
            subject: `AVA ERROR at ${avaUser.client || 'unknown'} for ${avaUser.user_id || 'unknown'} in ${env}`
          };
          sendMessages(messageObj);
        }
      }
      catch (loggingError) {
        console.log(`ErrorBoundary: logging/messaging failed: ${loggingError}`);
      }
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
              <Typography variant='caption' >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
              <Button
                aria-label='showActivities'
                variant='contained'
                onClick={() => {
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
