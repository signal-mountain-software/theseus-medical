import React from 'react';
import { useSnackbar } from 'notistack';
import { Auth } from 'aws-amplify';
import { useLocation } from 'react-router-dom';

import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import Card from '@material-ui/core/Card';
import CardMedia from '@material-ui/core/CardMedia';
import Typography from '@material-ui/core/Typography';
import Dialog from '@material-ui/core/Dialog';

import { Lambda } from 'aws-sdk';
import { useCookies } from 'react-cookie';
import useSession from '../hooks/useSession';
import useIosCheck from '../hooks/useIosCheck';
import makeStyles from '@material-ui/core/styles/makeStyles';

import useMediaQuery from '@material-ui/core/useMediaQuery';

import { SET_PATIENT, SET_PROFILE, SET_SESSION, SET_USER } from '../contexts/Session/actions';
import AVATextInput from '../components/forms/AVATextInput';

const useStyles = makeStyles(theme => ({
  logoSmall: {
    maxWidth: '100px',
    marginBottom: '15px'
  },
}));

const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});
const CognitoClient = new AWS.CognitoIdentityServiceProvider({
  region: "us-east-1"
});

export default Component => props => {

  // Constants and React state variables
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();

  const { dispatch } = useSession();
  // const { patient, session, profile } = state;
  // const AVASessionData = sessionStorage.getItem('AVASessionData');

  const [cookies, setCookie,] = useCookies(['AVAuser', 'AVAclient', 'AVAvalidated']);

  const [cognitoConfirmed, setCognitoConfirmed] = React.useState();
  const [AVAReady, setAVAReady] = React.useState(false);
  let localAVAReady = false;
  const [AVAFollowUpData, setAVAFollowUpData] = React.useState();

  const classes = useStyles();
  const [platform] = useIosCheck();

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  const allParams = useParams();
  function useParams() {
    const { search } = useLocation();
    return React.useMemo(() => new URLSearchParams(search), [search]);
  };

  let accessLogRecords = [];

  React.useEffect(() => {
    let currentUser, currentSession, currentClient;
    let currentPatient, currentProfile;
    let cognitoUser;
    let checkUser = (
      async () => {
        let cognitoSession = await Auth
          .currentSession()
          .catch(e => {
            console.log(e);
          });
        let cognitoCredentials = await Auth
          .currentCredentials()
          .catch(e => {
            console.log(e);
          });
        if (cognitoCredentials && cognitoCredentials.expiration) {
          let expirationTime = cognitoCredentials.expiration.getTime();
          let now = new Date().getTime();
          if (expirationTime < now) {
            enqueueSnackbar(`Your session expired on ${cognitoCredentials.expiration.toLocaleDateString()} at ${cognitoCredentials.expiration.toLocaleTimeString()}.`, { 'persist': true });
          }
        }
        let cognitoUser = await Auth
          .currentUserInfo()
          .catch(e => {
            console.log(e);
          });
        let cognitoPoolUser = await Auth
          .currentUserPoolUser()
          .catch(e => {
            console.log(e);
          });
        if (cognitoSession) {
          const refresh_token = await cognitoSession.getRefreshToken();
          let goodRefresh = CognitoClient.adminInitiateAuth(
            {
              'AuthFlow': 'REFRESH_TOKEN_AUTH',
              'ClientId': cognitoPoolUser.pool.clientId,
              'UserPoolId': cognitoPoolUser.pool.userPoolId,
              'AuthParameters': refresh_token
            });
        }
        // Does the URL contain a UserID?
        let urlData = getParamsFromURL();
        if (urlData) {
          if (urlData.client || urlData.client_id) {
            currentClient = urlData.client || urlData.client_id;
          }
          if (urlData.user || urlData.user_id) {
            currentUser = urlData.user || urlData.user_id;
            accessLog(currentUser, 'from URL', 'na',
              'Using URL supplied UserID -' + (currentClient ? `with Client = ${currentClient}` : 'No client')
            );
            let allGood = await prepareAVAEnv(false, null, currentUser, currentSession, currentClient, currentPatient, currentProfile, urlData);
            if (!allGood) { setAVAFollowUpData({ 'NeedUser': true }); }
          }
        }
        // Are we already authenticated with a "good" user?
        if (!currentUser) {
          cognitoUser = await Auth
            .currentAuthenticatedUser()
            .catch(e => {
              console.log(e);
            });
          if (cognitoUser && (cognitoUser.username !== process.env.REACT_APP_AVA_PU)) {
            // Someone is logged in (other than the default generic account)
            let [goodSession, foundSession] = await getSession(cognitoUser.username);
            if (goodSession) {
              setCognitoConfirmed(true);
              currentUser = foundSession.user_id;
              currentClient = foundSession.client_id;
              currentSession = foundSession;
              accessLog(cognitoUser.username, '', currentSession.last_login, 'Existing AVA session used.');
              let allGood = await prepareAVAEnv(true, currentSession.last_login, currentUser, currentSession, currentClient, currentPatient, currentProfile);
              if (!allGood) {
                setAVAFollowUpData({ 'NeedUser': true });
                enqueueSnackbar(`AVA tried couldn't continue your previous session.  Please enter your User ID or Name to sign into AVA.`, { variant: 'info', persist: true });
              }
            }
            else {
              accessLog(cognitoUser, 'Cached', '', 'Cached user info incomplete.  Log-in required.');
            }
          }
        }
        // Does a Cookie exist and contain a UserID?
        if (!currentUser) {
          let cookieValues = getCookie();
          if (cookieValues.client) {
            currentClient = cookieValues.client;
          }
          if (cookieValues.user_id) {
            currentUser = cookieValues.user_id;
            let [, currentSession] = await getSession(currentUser);
            currentClient = currentSession.client_id;
            accessLog(currentUser, 'from Cookie', '',
              'Using Cookie supplied UserID ' + (currentClient ? `with Client = ${currentClient}` : 'with no client')
            );
            let goodLogIn = false;
            let lActual;
            [goodLogIn, , lActual] = await logMeIn(cookieValues.user_id, cookieValues.last_login, !!cognitoUser);
            if (goodLogIn) {
              let allGood = await prepareAVAEnv(goodLogIn, lActual, currentUser, currentSession, currentClient, currentPatient, currentProfile);
              if (!allGood) {
                setAVAFollowUpData({ 'NeedUser': true });
                enqueueSnackbar(`AVA couldn't use the stored data.  Please enter your User ID or Name to sign into AVA.`, { variant: 'info', persist: true });
              }
            }
          }
        }
        else if (!currentClient) {
          let cookieValues = getCookie();
          if (cookieValues.client) {
            currentClient = cookieValues.client;
          }
        }
        if (!currentUser) {
          setAVAFollowUpData({ 'NeedUser': true });
          enqueueSnackbar(`Please enter your User ID or Name to sign into AVA.`, { variant: 'info', persist: true });
        }
      }
    );
    checkUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function promptForUser() {
    return (AVAFollowUpData && AVAFollowUpData.hasOwnProperty('NeedUser'));
  }

  function promptForPassword() {
    return (AVAFollowUpData && AVAFollowUpData.hasOwnProperty('enteredUserID'));
  }

  if (!AVAReady && !localAVAReady) {
    return (
      <Dialog
        open={!AVAReady && !localAVAReady}
        p={2}
        fullScreen
      >
        <React.Fragment>
          <Box
            display='flex' flexDirection='column' justifyContent='center' alignItems='center'
            key={'loadingBox'}
            ml={2} mr={2} mt={30}
          >
            <Card
              className={classes.logoSmall}
              raised={false}
              variant='elevation' elevation={0}
            >
              <CardMedia
                component="img"
                image={'https://ava-icons.s3.amazonaws.com/AVA+Logo.png'}
                alt='AVA'
              />
            </Card>
            <Typography align='center'>
              {`AVA version 22.11.11${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}
            </Typography>
            <CircularProgress />
          </Box>
        </React.Fragment>
        {promptForUser() &&
          <AVATextInput
            titleText="AVA Sign-in"
            promptText={isMobile ? "User ID / Name" : "Enter your User ID or Name"}
            buttonText='Sign In'
            onCancel={() => {
              enqueueSnackbar(`Please enter your User ID or Name to sign into AVA.`, { variant: 'info', persist: true });
            }}
            onSave={async (enteredUserID) => {
              closeSnackbar();
              enqueueSnackbar(`AVA is trying to sign you in with "${enteredUserID}"`, { variant: 'info' });
              let [goodSession, foundSession] = await getSession(enteredUserID);
              if (goodSession) {
                if (foundSession.requirePassword) {
                  let [, foundUser] = await getPerson(foundSession.user_id);
                  foundUser.sessionRec = foundSession;
                  accessLog(enteredUserID, '', '', 'Good UserID entered.  Password is required for this account.');
                  enqueueSnackbar(`This account requires a password.`, { variant: 'error', persist: true });
                  setAVAFollowUpData({ 'passwordRequired': true, 'enteredUserID': enteredUserID, 'possibleUserRecs': [foundUser] });
                }
                else {
                  accessLog(enteredUserID, '', '', 'Good UserID entered.');
                  let allGood = await prepareAVAEnv(
                    false,
                    null,
                    foundSession.user_id,
                    foundSession,
                    foundSession.client_id,
                    null,
                    null);
                  if (!allGood) {
                    setAVAFollowUpData({ 'NeedUser': true });
                    enqueueSnackbar(`AVA couldn't use that UserID.  Please try again.`, { variant: 'info', persist: true });
                  }
                }
              }
              else {
                let requestObj = { 'nameTest': enteredUserID };
                let cookieValues = getCookie();
                if (cookieValues.client) { requestObj.client = cookieValues.client; }
                let [goodUser, possibleUserRecs] = await validateUserAccount(requestObj);
                if (goodUser) {
                  if (possibleUserRecs.length === 1) {
                    if (possibleUserRecs[0].sessionRec.requirePassword) {
                      accessLog(enteredUserID, '', '', 'User found from name.  Password is required for this account.');
                      enqueueSnackbar(`This account requires a password.`, { variant: 'error', persist: true });
                      setAVAFollowUpData({ 'passwordRequired': true, 'enteredUserID': possibleUserRecs[0].person_id, 'possibleUserRecs': possibleUserRecs });
                    }
                    else {
                      accessLog(possibleUserRecs[0].person_id, '', '', `Good UserID found from entered name: ${enteredUserID}.`);
                      let allGood = await prepareAVAEnv(
                        false,
                        null,
                        possibleUserRecs[0].person_id,
                        possibleUserRecs[0].sessionRec,
                        possibleUserRecs[0].client_id,
                        (possibleUserRecs[0].sessionRec.patient_id === possibleUserRecs[0].person_id) ? possibleUserRecs[0] : null,
                        possibleUserRecs[0]);
                      if (!allGood) {
                        setAVAFollowUpData({ 'NeedUser': true });
                        enqueueSnackbar(`AVA couldn't use the UserID it found.  Please try again.`, { variant: 'info', persist: true });
                      }
                    }
                  }
                  else {
                    enqueueSnackbar(`AVA found ${possibleUserRecs.length} matches for "${enteredUserID}".  Please enter a password or apartment number to help figure out which one you are.`, { variant: 'error', persist: true });
                    setAVAFollowUpData({ 'enteredUserID': enteredUserID, 'possibleUserRecs': possibleUserRecs });
                  }
                }
                else {
                  accessLog('unknown', '', '', `No UserID found from entered name: ${enteredUserID}.`);
                  enqueueSnackbar(`"${enteredUserID}" is not a User ID or Name that AVA recognizes. Please try again.`, { variant: 'error', persist: true });
                }
              }
            }}
            allowCancel={false}
          />
        }
        {promptForPassword() &&
          <AVATextInput
            titleText="AVA Sign-in"
            promptText={`Enter your Password or Apartment Number.`}
            buttonText='Continue'
            onCancel={() => {
              closeSnackbar();
              enqueueSnackbar(`Please enter your User ID or Name`, { variant: 'info', persist: true });
              setAVAFollowUpData({ 'NeedUser': true });
            }}
            onSave={async (enteredPass) => {
              closeSnackbar();
              enqueueSnackbar(`AVA is verifying your information`, { variant: 'info', persist: true });
              let foundUserAt = -1;
              let confirmedPass;
              for (let p = 0; p < AVAFollowUpData.possibleUserRecs.length; p++) {
                let goodPwd = false;
                [goodPwd, , confirmedPass] = await cognitoLogin(AVAFollowUpData.possibleUserRecs[p].person_id, enteredPass);
                if (goodPwd) {
                  foundUserAt = p;
                  break;
                }
              }
              if (foundUserAt > -1) {
                setCognitoConfirmed(true);
                let allGood = await prepareAVAEnv(
                  true,
                  confirmedPass,
                  AVAFollowUpData.possibleUserRecs[foundUserAt].person_id,
                  AVAFollowUpData.possibleUserRecs[foundUserAt].sessionRec,
                  AVAFollowUpData.possibleUserRecs[foundUserAt].client_id,
                  (AVAFollowUpData.possibleUserRecs[foundUserAt].sessionRec.patient_id === AVAFollowUpData.possibleUserRecs[foundUserAt].person_id) ? AVAFollowUpData.possibleUserRecs[foundUserAt] : null,
                  AVAFollowUpData.possibleUserRecs[foundUserAt]);
                if (!allGood) {
                  setAVAFollowUpData({ 'NeedUser': true });
                  enqueueSnackbar(`AVA couldn't use the UserID that the location matched.  Please try again.`, { variant: 'info', persist: true });
                }
              }
              else {
                enqueueSnackbar(`Still looking...`, { variant: 'info', persist: true });
                let requestObj = { 'nameTest': AVAFollowUpData.enteredUserID, 'numbersTest': enteredPass };
                let cookieValues = getCookie();
                if (cookieValues.client) { requestObj.client = cookieValues.client; }
                let [goodUser, possibleUserRecs] = await validateUserAccount(requestObj);
                closeSnackbar();
                if (goodUser && (possibleUserRecs.length === 1)) {
                  if (possibleUserRecs[0].sessionRec.requirePassword) {
                    enqueueSnackbar(`Using that information, AVA located account "${possibleUserRecs[0].person_id}".  However, that account requires a password and "${enteredPass}" isn't the correct password.  Please try again.`, { variant: 'info', persist: true });
                  }
                  else {
                    accessLog(possibleUserRecs[0].person_id, '', '', `Good UserID found from name/location: ${AVAFollowUpData.enteredUserID}/${enteredPass}`);
                    let allGood = await prepareAVAEnv(
                      false,
                      null,
                      possibleUserRecs[0].person_id,
                      possibleUserRecs[0].sessionRec,
                      possibleUserRecs[0].client_id,
                      (possibleUserRecs[0].sessionRec.patient_id === possibleUserRecs[0].person_id) ? possibleUserRecs[0] : null,
                      possibleUserRecs[0]
                    );
                    if (!allGood) {
                      setAVAFollowUpData({ 'NeedUser': true });
                      enqueueSnackbar(`AVA matched that up but couldn't use the info to log you in.  Please try again.`, { variant: 'info', persist: true });
                    }
                  }
                }
                else if (goodUser && (possibleUserRecs.length > 1)) {
                  accessLog(AVAFollowUpData.enteredUserID, '', '', `Multiple matches for attempted user/password OR name/location. (${AVAFollowUpData.enteredUserID}/${enteredPass})`);
                  enqueueSnackbar(`"${enteredPass}" still matches ${possibleUserRecs.length} accounts.  Please try again`, { variant: 'error', persist: true });
                }
                else {
                  accessLog(AVAFollowUpData.enteredUserID, '', '', `No account found for attempted user/password OR name/location. (${AVAFollowUpData.enteredUserID}/${enteredPass})`);
                  enqueueSnackbar(`"${AVAFollowUpData.enteredUserID}" and "${enteredPass}" didn't match any account in AVA.  Please try again`, { variant: 'error', persist: true });
                }
              }
            }}
          />
        }
      </Dialog >
    );
  }
  else {
    return (<Component {...props} />);
  }

  async function logMeIn(pUser, pPass, pAlready = false) {
    if (pPass) {
      let [logInSuccess, logInUser, logInActual] = await cognitoLogin(pUser, pPass, pUser);
      if (logInSuccess) { return [logInSuccess, logInUser, logInActual]; }
    }
    if (!pAlready) {
      let [logInSuccess, ,] = await cognitoLogin(process.env.REACT_APP_AVA_PU, process.env.REACT_APP_AVA_PP, pUser);
      if (logInSuccess) { accessLog(pUser, '', '', 'Generic Login used.'); }
      return [logInSuccess, 'GenericUser', 'GenericPWD'];
    }
    else {
      accessLog(pUser, '', '', 'Retained Generic Login.');
      return [true, 'GenericUser', 'GenericPWD'];
    }

  };

  async function cognitoLogin(pUser, pPass, pWho = null) {
    try {
      await Auth.signIn({ username: pUser, password: pPass.trim(), validationData: { avaAccount: pWho || pUser } });
      setCognitoConfirmed(true);
      if (pUser !== process.env.REACT_APP_AVA_PU) {
        accessLog(pUser, pPass, pPass, 'Successful Log-in');
      }
      return [true, pUser, pPass];
    }
    catch (e) {
      if ((e.code !== 'NotAuthorizedException')
        || (e.message.includes('expired'))
        || (e.message.includes('exceeded'))) {
        setCognitoConfirmed(false);
        accessLog(pUser, pPass, '',
          `Failed Log-in. Reason:${e.code} Message:${e.message}`
        );
        return [false, null, null];
      }
      let c0 = pPass.trim().charAt(0);
      let newP;
      if (c0 === c0.toUpperCase()) {   // first character was a capital letter
        newP = c0.toLowerCase() + pPass.trim().substring(1);
      }
      else {   // first character was a lower case letter
        newP = c0.toUpperCase() + pPass.trim().substring(1);
      }
      try {
        await Auth.signIn({ username: pUser, password: newP, validationData: { avaAccount: pUser } });
        setCognitoConfirmed(true);
        accessLog(pUser, pPass, newP, 'Successful Log-in with case corrected password');
        return [true, pUser, newP];
      }
      catch (e2) {
        setCognitoConfirmed(false);
        accessLog(pUser, `${newP} (case corrected)`, '',
          `Failed Log-in. Reason:${e2.code} Message:${e2.message}`
        );
        return [false, null, null];
      }
    }
  }

  function bakeCookie(pUser, pPwd, pClient, pSession, pPatient, pProfile) {
    setCookie('AVAuser', JSON.stringify({
      user_id: pUser,
      client: pClient,
      last_login: pPwd || ''
    }), { path: '/' });
    if (pClient) {
      setCookie('AVAclient', JSON.stringify({
        client: pClient,
      }), { path: '/' });
    };
  }

  function putValidationCookie(recentlyConfirmed, confirmedLogin, currentUser, currentSession, currentClient, currentPatient, currentProfile, pURL) {
    setCookie('AVAvalidated', 'true', { path: '/' });
  }

  function getCookie() {
    let returnObj = { "empty": "no data" };
    if (cookies.AVAuser && cookies.AVAuser !== 'undefined') {
      if (typeof (cookies.AVAuser) === 'string') { returnObj = JSON.parse(cookies.AVAuser); }
      else { returnObj = cookies.AVAuser; }
    }
    if (!returnObj.hasOwnProperty('client')) {
      if (cookies.AVAclient && cookies.AVAclient !== 'undefined') {
        if (typeof (cookies.AVAclient) === 'string') { returnObj.client = cookies.AVAclient; }
        else { returnObj.client = cookies.AVAclient.client_id || cookies.AVAclient.client_id; }
      }
    }
    return returnObj;
  }

  function getParamsFromURL() {
    let returnObject = {};
    allParams.forEach((value, key) => {
      console.log(key, value);
      returnObject[key] = value;
    });
    if (Object.keys(returnObject).length > 0) {
      return returnObject;
    }
    else { return null; }
  }


  async function sendMessage(pClient, pSender, pMessage, pRecipient) {
    let payload = {
      "body": {
        "client": pClient,
        "author": pSender,
        "values": pRecipient + ' ~ MessageText = ' + pMessage
      }
    };
    await lambda
      .invoke({
        FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:messageEngine',
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
        Payload: JSON.stringify(payload)
      })
      .promise()
      .catch(err => {
        console.log('Call failed.  Error is', JSON.stringify(err));
      });
  };

  async function getSession(pSessionID) {
    let sessionRec = await dbClient
      .get({
        Key: { session_id: pSessionID.toLowerCase() },
        TableName: "SessionsV2"
      })
      .promise()
      .catch(error => {
        if (error.code === 'NetworkingError') {
          enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
        };
        console.log({ 'Bad get on Session - caught error is': error });
      });
    if (!recordExists(sessionRec)) {
      sessionRec = await dbClient
        .get({
          Key: { session_id: pSessionID },
          TableName: "SessionsV2"
        })
        .promise()
        .catch(error => {
          console.log({ 'Bad get on Session - caught error is': error });
        });
      return [false, null];
    }
    if (!recordExists(sessionRec)) {
      return [false, null];
    }
    let logoRec = await dbClient
      .get({
        Key: {
          client_id: sessionRec.Item.client_id,
          custom_key: 'logo'
        },
        TableName: "Customizations",
      })
      .promise()
      .catch(error => {
        console.log({ 'Bad get on Customizations - caught error is': error });
      });
    if (recordExists(logoRec)) {
      sessionRec.Item.client_icon = logoRec.Item.icon;
    }
    return [true, sessionRec.Item];
  }

  async function getPerson(pPersonID) {
    let peopleRec = await dbClient
      .get({
        Key: { person_id: pPersonID },
        TableName: "People"
      })
      .promise()
      .catch(error => {
        console.log({ 'Bad get on People - caught error is': error });
      });
    if (recordExists(peopleRec)) { return [true, peopleRec.Item]; }
    else { return [false, null]; }
  }

  async function accessLog(pUser, pAttempted, pActual, pResult) {
    let nowTime = new Date();
    let accessLogRec = {
      timestamp: nowTime.getTime(),
      timestring: nowTime.toLocaleString(),
      user_key: `${pUser}${pActual ? ('/' + pActual) : ''}`,
      attempted_user: pUser,
      attempted_password: pAttempted,
      result: pResult
    };
    accessLogRecords.push(accessLogRec);
  };

  async function putAccessLog() {
    let putObj = accessLogRecords.map(r => {
      return { PutRequest: { Item: r } };
    });
    await dbClient
      .batchWrite({
        RequestItems: { 'AccessLog': putObj }
      })
      .promise()
      .catch(error => {
        console.log({ 'Bad put to AccessLog - caught error is': error });
      });
  }

  async function updateSession(pSessionID, pSession, pPatient, pProfile, pLogin, pURL, pMessage) {
    let attributeValues = {
      ':s': {
        'version': `v22.11.11`,
        'environment': window.location.href.split('//')[1].charAt(0).toUpperCase(),
        'time': new Date().toString(),
        'signin_status': pMessage,
        'source': 'bootstrap'
      }
    };
    let updateExpression = 'set #s = :s, ';
    if (pLogin) {
      attributeValues[':p'] = pLogin;
      updateExpression += 'last_login = :p, ';
    }
    if (pSession.patient_id) {
      attributeValues[':pid'] = pSession.patient_id;
      updateExpression += 'patient_id = :pid, ';
    }
    if (pProfile.hasOwnProperty('name') || pPatient.patient_id) {
      let showName = (pProfile.hasOwnProperty('name') ? `${pPatient.name.first} ${pPatient.name.last}` : `Unnamed account (${pPatient.patient_id})`);
      attributeValues[':pn'] = showName;
      updateExpression += 'patient_display_name = :pn, ';
    }
    if (platform) {
      attributeValues[':dev'] = platform;
      updateExpression += 'platform = :dev, ';
    }
    if (pURL) {
      if (typeof (pURL) === 'object') {
        attributeValues[':u'] = JSON.stringify(pURL);
      }
      else {
        attributeValues[':u'] = pURL;
      }
      updateExpression += 'url_parameters = :u, ';
    }
    if (pProfile.person_id) {
      attributeValues[':uid'] = pProfile.person_id;
      updateExpression += 'user_id = :uid, ';
    }
    updateExpression = updateExpression.substring(0, updateExpression.length - 2);
    await dbClient
      .update({
        Key: { session_id: pSessionID },
        UpdateExpression: updateExpression,
        ExpressionAttributeValues: attributeValues,
        ExpressionAttributeNames: { "#s": "status" },
        TableName: "SessionsV2",
      })
      .promise()
      .catch(error => { console.log(`caught error updating SessionsV2; error is:`, error); });
  }

  async function validateUserAccount(payload) {
    const fResp = await lambda
      .invoke({
        FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:validateUserAccount',
        InvocationType: 'RequestResponse',
        LogType: 'Tail',
        Payload: JSON.stringify(payload)
      })
      .promise()
      .catch(err => {
        if (err.code === 'NetworkingError') {
          enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
        }
        console.log('Call failed.  Error is', JSON.stringify(err));
        return [false, 'AVA could not validate your Account'];
      });
    try {
      let fRespObj = JSON.parse(fResp.Payload);
      if (fRespObj.status === 400) {
        return [false, fRespObj.body];
      }
      else {
        return [true, fRespObj.body];
      }
    }
    catch { return [false, 'unknown']; }
  };

  async function prepareAVAEnv(recentlyConfirmed, confirmedLogin, currentUser, currentSession, currentClient, currentPatient, currentProfile, pURL = null) {
    // if no session, get the session
    if (!currentSession) {
      let goodSession = false;
      [goodSession, currentSession] = await getSession(currentUser);
      if (!goodSession) {
        accessLog(currentUser, '', '', `No SessionV2 record for ${currentUser}.  This is not a valid account.`);
        setAVAReady(false);
        setAVAFollowUpData();
        return false;
      }
    };
    // Get the User's profile (info about the logged in person)
    if (!currentProfile) {
      if (currentPatient && (currentPatient.person_id === currentUser)) {
        currentProfile = currentPatient;
      }
      else {
        let [goodUser, foundUser] = await getPerson(currentUser);
        if (goodUser) { currentProfile = foundUser; }
        else {
          enqueueSnackbar(`No AVA Profile information for ${currentUser}.  This is a valid Account but cannot be used.  AVA Support has been notified.`, { variant: 'error', persist: true });
          sendMessage('AVA', 'bootstrap', `Account ${currentUser} cannot map to any valid Person to use as its currentProfile`, 'ava_support');
          return false;
        }
      }
    }
    // assure you are logged in to Cognito
    if (!cognitoConfirmed && !recentlyConfirmed) {
      if (currentSession.last_login) {
        accessLog(currentUser, currentSession.last_login, '', 'Using password saved in Session record');
        recentlyConfirmed = await logMeIn(currentUser, currentSession.last_login);
      }
      else {
        accessLog(currentUser, currentSession.last_login, '', 'Found User.  No password stored.  Attempting generic login.');
        recentlyConfirmed = await logMeIn(currentUser, null);
      }
      setCognitoConfirmed(recentlyConfirmed);
      if (!recentlyConfirmed) {
        accessLog(currentUser, '', '', 'All login attempts failed.');
        return false;
      }
    }
    // Get Patient record (this is the person you are actively using)
    if (!currentPatient) {
      if (currentSession.patient_id) {
        let [goodUser, foundUser] = await getPerson(currentSession.patient_id);
        if (goodUser) { currentPatient = foundUser; }
      }
      if (!currentPatient && (!currentSession.patient_id || (currentSession.patient_id !== currentUser))) {
        let [goodUser, foundUser] = await getPerson(currentUser);
        if (goodUser) {
          currentPatient = foundUser;
          currentProfile = foundUser;
        }
      }
      if (!currentPatient) {
        enqueueSnackbar(`Incomplete User Account information for ${currentUser}.  This is a valid Account but cannot be used.  AVA Support has been notified.`, { variant: 'error', persist: true });
        sendMessage('AVA', 'bootstrap', `SessionV2 record for ${currentUser} cannot map to any valid Person to use as its currentPatient`, 'ava_support');
        return false;
      }
    }
    // 
    if ((cognitoConfirmed || recentlyConfirmed) && currentPatient && currentSession && currentProfile) {
      enqueueSnackbar(`Welcome to AVA!`, { variant: 'success' });
      let urlData = getParamsFromURL();
      if (urlData) {
        currentSession.url_parameters = urlData;
      }
      else {
        currentSession.url_parameters = null;
      }
      dispatch({ type: SET_SESSION, payload: currentSession });
      dispatch({ type: SET_PROFILE, payload: currentProfile });
      dispatch({ type: SET_USER, payload: currentProfile });
      dispatch({ type: SET_PATIENT, payload: currentPatient });

      sessionStorage.setItem('AVASessionData', JSON.stringify({ currentSession, currentProfile, currentPatient }));
      bakeCookie(currentSession.session_id, confirmedLogin, currentSession.client_id, currentSession, currentPatient, currentProfile);
      updateSession(currentSession.session_id, currentSession, currentPatient, currentProfile, currentSession.last_login, pURL, 'AVA Launch');
      putValidationCookie(recentlyConfirmed, confirmedLogin, currentUser, currentSession, currentClient, currentPatient, currentProfile, pURL);
      await putAccessLog();
      setAVAReady(true);
      localAVAReady = true;
      setAVAFollowUpData({ 'Completed': true });
      return true;
    }
    else {
      if (!cognitoConfirmed && !recentlyConfirmed) {
        enqueueSnackbar(`A security system error occurred.  AVA Support has been notified.`, { variant: 'error', persist: true });
        sendMessage('AVA', 'bootstrap', `No valid COGNITO login for ${currentUser} and generic login failed (${process.env.REACT_APP_AVA_PU}/${process.env.REACT_APP_AVA_PP}).`, 'ava_support');
      }
      else {
        enqueueSnackbar(`Something went wrong.  AVA can't use this information to log you in.  AVA Support has been notified.`, { variant: 'error', persist: true });
        sendMessage('AVA', 'bootstrap', `AVA data missing or invalid for ${currentUser}`, 'ava_support');
      }
      setAVAReady(false);
      setAVAFollowUpData();
      return false;
    }
  }

  function recordExists(recordId) {
    if (!recordId) { return false; }
    if (recordId.hasOwnProperty('Count')) { return (recordId.Count > 0); }
    else { return ((recordId.hasOwnProperty("Item") || recordId.hasOwnProperty("Items"))); }
  }
};
