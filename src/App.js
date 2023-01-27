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

const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

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
    handleWriteError(`AVA caught error "${error.message}" at line ${error.lineNumber} in file ${error.fileName}`);
  }

  componentDidCatch(error, info) {
    hasError = true;
    handleWriteError(`AVA caught error.  String is "${error.toString()}". Cause is ${error.cause} on stack ${error.stack}`);
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
              <Typography variant='caption' >{`version 23.1.28${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
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
  let AVA_env = window.location.href.split('//')[1].slice(0, 1).toLocaleUpperCase();
  if (AVA_env === 'L') {
    alert(parmMessage);
  }
  const user = await Auth
    .currentAuthenticatedUser()
    .catch(e => {
      parmMessage = `*** Auth error thrown is ${JSON.stringify(e)} *** original error is ${parmMessage}`;

    });

  let sObj_user = 'no sessionObject';
  let sessionObject = JSON.parse(sessionStorage.getItem('AVASessionData'));
  if (sessionObject.currentProfile?.person_id) {
    sObj_user = sessionObject.currentProfile.person_id;
  }

  let errorTime = new Date();
  const newFact = {
    person_id: user?.username || 'no info',
    activity_key: '***ERROR_CAUGHT***',
    value: `error.${parmMessage}`,
    status: {
      'version': '23.1.28',
      'env': AVA_env,
      'time': errorTime.toString(),
      'cognito_user': user?.username,
      'sessObj_user': sObj_user
    },
    user_id: user?.username || 'no user logged',
    session_id: 'no session recorded',
    method: 'AVAMenu',
    posted_time: errorTime.getTime()
  };
  await dbClient
    .put({
      TableName: 'Facts',
      Item: newFact
    })
    .promise()
    .catch(async (error) => {
      let instruction = {
        patient_id: newFact.person_id,
        activity_key: '***ERROR_CAUGHT***',
        value: `error.*** Write to Fact failed; used graphQL *** ${parmMessage}`,
        status: `Version = 23.1.28~${errorTime}`,
        session: {
          user_id: user?.username || 'no user logged',
          session_id: 'no session recorded',
        },
      };
      await API
        .graphql(graphqlOperation(createPutFact, { input: instruction }))
        .catch(e => { alert(`Temporary connection failure, possible cause: ${parmMessage}`); }); console.error('Error adding a fact:', error.message);
    });

  let activityLogRec = {
    timestamp: errorTime.getTime(),
    user_id: newFact.person_id,
    activity_code: newFact.activity_key,
    activity_name: newFact.value,
    AVA_version: `23.1.28${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`
  };
  await dbClient
    .put({
      Item: activityLogRec,
      TableName: "ActivityLog",
    })
    .promise()
    .catch(error => { console.log(`caught error updating ActivityLog; error is:`, error); });
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
