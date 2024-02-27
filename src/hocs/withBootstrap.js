import React from 'react';
import { dbClient, lambda, makeArray, getCustomizations, deepCopy } from '../util/AVAUtilities';
import { accountAccess, getAllGroups, getGroupsBelongTo } from '../util/AVAGroups';
import { makeName } from '../util/AVAPeople';
import { getAllOccurrences } from '../util/AVACalendars';
import { sendMessages } from '../util/AVAMessages';
import { addDays } from '../util/AVADateTime';
import { useSnackbar } from 'notistack';
import { Auth } from 'aws-amplify';
import { useLocation } from 'react-router-dom';
import { AVADefaults, AVATextStyle } from '../util/AVAStyles';
import AVAConfirm from '../components/forms/AVAConfirm';
import MakeAVAMenu from '../util/MakeAVAMenu';

import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import Dialog from '@material-ui/core/Dialog';

import { useCookies } from 'react-cookie';
import useSession from '../hooks/useSession';
import useIosCheck from '../hooks/useIosCheck';
import makeStyles from '@material-ui/core/styles/makeStyles';

// import useMediaQuery from '@material-ui/core/useMediaQuery';

import { SET_PATIENT, SET_PROFILE, SET_GROUPS, SET_ACCESSLIST, SET_CALENDAR, SET_SESSION, SET_USER } from '../contexts/Session/actions';
import AVATextInput from '../components/forms/AVATextInput';

const useStyles = makeStyles(theme => ({
  logoSmall: {
    maxWidth: '100px',
    marginBottom: '15px'
  },
  notTitle: {
    marginTop: theme.spacing(2),
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    fontSize: theme.typography.fontSize * 1.0,
  },
  buttonArea: {
    marginTop: theme.spacing(4)
  },
}));

const AWS = require('aws-sdk');
const CognitoClient = new AWS.CognitoIdentityServiceProvider({
  region: "us-east-1"
});

export default Component => props => {

  // Constants and React state variables
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();

  const { dispatch, state } = useSession();

  const [cookies, setCookie,] = useCookies(['AVAuser', 'AVAclient', 'AVAvalidated']);

  const [doneTrying, setDoneTrying] = React.useState(false);
  const [AVAReady, setAVAReady] = React.useState(false);
  let localAVAReady = false;
  const [AVAFollowUpData, setAVAFollowUpData] = React.useState();
  const [customizationData, setCustomizationData] = React.useState();

  const classes = useStyles();
  const [platform] = useIosCheck();

  const AVA_default_user = process.env.REACT_APP_AVA_PU;
  const AVA_default_password = process.env.REACT_APP_AVA_PP;

  const [messageList, setMessageList] = React.useState([]);

  const [reactData, setReactData] = React.useState({
    currentClientLogo:
      ((state.session && state.session.client_logo)
        ? state.session.client_logo
        : process.env.REACT_APP_AVA_LOGO
      )
  });

  const updateReactData = (newData, force = false) => {
    for (let oKey in newData) {
      setReactData((prevValues) => ({
        ...prevValues,
        [oKey]: newData[oKey],
      }));
    }
  };

  let bootState = {};
  let belongsTo;

  const allParams = useParams();
  function useParams() {
    const { search } = useLocation();
    return React.useMemo(() => new URLSearchParams(search), [search]);
  };

  React.useEffect(() => {
    let checkUser = (
      async () => {
        let activeUser;
        let sessionObject = JSON.parse(sessionStorage.getItem('AVASessionData'));
        let localCognitoSession = await Auth
          .currentSession()
          .catch(e => {
            console.log(e);
          });
        if (localCognitoSession) {
          await refreshSession(localCognitoSession.getRefreshToken());
          if (sessionObject) {          // There is a good sessionObject.  This contains actual info about user
            activeUser = sessionObject.currentProfile.person_id;
            let uMessage = `Found ${activeUser} in session memory (AVASessionData)`;
            await logAccessAttempt(activeUser, '', true, uMessage);
            let goodLaunch = await launchAVA(activeUser);
            if (goodLaunch) {
              setAVAFollowUpData({ 'Completed': true });
              await logAccessAttempt(activeUser, '', true, `Good AVA session object found in memory; AVA launched successfully`);
              setDoneTrying(true);
              return;
            }
          }
          else if (localCognitoSession.idToken.payload['cognito:username'] !== AVA_default_user) {
            activeUser = localCognitoSession.idToken.payload['cognito:username'];
            let uMessage = `${activeUser} is already logged in`;
            await logAccessAttempt(activeUser, '', true, uMessage);
            let goodLaunch = await launchAVA(activeUser);
            if (goodLaunch) {
              setAVAFollowUpData({ 'Completed': true });
              await logAccessAttempt(activeUser, '', true, `No AVA session in memory; Cognito session for known user found; AVA launched successfully`);
              setDoneTrying(true);
              return;
            }
          }
          else if (localCognitoSession.idToken.payload.jti) {
            let AVAsession = await getSessions(localCognitoSession.idToken.payload.jti);
            if (AVAsession && AVAsession.login.user_id) {
              activeUser = AVAsession.login.user_id;
              let uMessage = `Found ${activeUser} in Sessions table with jti (session_id) ${localCognitoSession.idToken.payload.jti}`;
              await logAccessAttempt(activeUser, '', true, uMessage);
              let goodLaunch = await launchAVA(activeUser);
              if (goodLaunch) {
                setAVAFollowUpData({ 'Completed': true });
                await logAccessAttempt(activeUser, '', true, `Device found in Sessions table; AVA launched successfully`);
                setDoneTrying(true);
                return;
              }
            }
          }
        }
        // No security session OR already logged in, but with an unknown user.  Do we know who this is?
        let sessionUserID = null;
        // Does the URL contain a User ID and/or client?
        let urlData = getParamsFromURL();
        if (urlData) {
          if (urlData.client || urlData.client_id) {
            let cData = await getCustomizations('*all', (urlData.client || urlData.client_id));
            cData.client_id = urlData.client || urlData.client_id;
            setCustomizationData(cData);
          }
          if (urlData.user || urlData.user_id) {
            sessionUserID = urlData.user || urlData.user_id;
            await tryUser(sessionUserID, (urlData.client || urlData.client_id || null), 'url');
            return;
          }
        }
        // Check for a cookie
        let cookieValues = getCookie();
        if (cookieValues) {
          if (cookieValues.client) {
            let cData = await getCustomizations('*all', (cookieValues.client));
            cData.client_id = cookieValues.client;
            setCustomizationData(cData);
          }
          if (cookieValues.user_id) {
            sessionUserID = cookieValues.user_id;
            await tryUser(sessionUserID, cookieValues.client, 'cookie');
            return;
          }
        }
        // No URL data and no cookie
        setAVAFollowUpData({ 'NeedUser': true });
        return;
      });
    checkUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function tryUser(pUser, pClient, pSource) {
    // return values:
    //    good - locked and loaded.  AVA signed-in and ready
    //    invalid - not a valid user ID
    //    password - user ID is valid, but password needed to log in
    //
    // Do we know this person's password?
    pUser = pUser.trim();
    let [goodSessionV2, foundSession, dbError] = await getSessionV2(pUser);
    if (!goodSessionV2) {     // That is not a valid User ID, maybe it's a name?
      if (dbError) {
        setDoneTrying(true);
        return 'network';
      }
      await logAccessAttempt(pUser, '', false, `${pUser} is not a valid User ID (no SessionV2).`);
      const valideMail = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
      if (pUser.match(valideMail)) {
        setAVAFollowUpData({
          'PromptSignUp': true,
          'link': 'https://buy.stripe.com/3cs5lzbSS9RXecwcMN',
          pUser,
          pSource
        });
        setDoneTrying(true);
        return 'promptSubscribe';
      }
      else {
        enqueueSnackbar(`"${pUser}" is not a User ID or Name that AVA recognizes. Please try again.`, { variant: 'error', persist: true });
        setDoneTrying(true);
        setAVAFollowUpData({ 'NeedUser': true });
        return 'invalid';
      }
    }
    else {
      if ((foundSession.hasOwnProperty('subscription_status'))
        && (foundSession.hasOwnProperty('responsible_for'))) {
        switch (foundSession.subscription_status) {
          case 'na':
          case 'active': {
            break;
          }
          case 'none':
          case 'new': {
            let respID = makeArray(foundSession.responsible_for)[0];
            let respName = await makeName(respID);
            setAVAFollowUpData({
              'newSubscription': true,
              'prompt': [
                'Welcome to AVA!',
                '[style={size:1.2}]Subscribe now to gain access to Community services, information, and direct communication with Community Leaders and Staff',
                '',
                `[style={size:1.2}]You will be redirected to our subscription partner site.  Return here after you've completed that form.`,
                '',
                '[style={size:1.2}]Thank you!',
                '',
              ],
              'link': 'https://buy.stripe.com/3cs5lzbSS9RXecwcMN',
              pUser,
              pSource,
              client_id: foundSession.client_id,
              responsible_for: respID,
              responsible_name: respName
            });
            setDoneTrying(true);
            return 'subscription';
          }
          case 'pending': {
            break;
          }
          case 'cancelled': {
            break;
          }
          case 'suspended': {
            break;
          }
          case 'inactive': {
            break;
          }
          default: { }
        }
      }
      if (foundSession.requirePassword && (pSource === 'entered')) {
        await logAccessAttempt(pUser, '', true, 'Good UserID entered.  Password is required for this account.');
        enqueueSnackbar(`This account requires a password.`, { variant: 'error', persist: true });
        let [goodUser, foundPatient] = await getPerson(pUser);
        if (!goodUser) {
          let eMessage = `When fetching People account for this password-required Session, ${pUser} is not found`;
          await logAccessAttempt(pUser, '', false, eMessage);
          setDoneTrying(true);
          enqueueSnackbar(`${eMessage}.  This is an unusual situation.  AVA Support has been notified.`, { variant: 'error', persist: true });
          sendMessage('AVA', 'bootstrap', eMessage, 'ava_support');
          setAVAFollowUpData({ 'NeedUser': true });
          return 'invalid';
        }
        foundPatient.sessionRec = foundSession;
        setAVAFollowUpData({ 'passwordRequired': true, 'enteredUserID': pUser, 'possibleUserRecs': [foundPatient] });
        return 'password';
      }
      else if (foundSession.last_login) {   // Yes!  We have a User and a Password
        let [goodLogin, ,] = await cognitoLogin(pUser, foundSession.last_login);
        if (goodLogin) {
          await logAccessAttempt(pUser, foundSession.last_login, true, `Successful Log-in using stored password; user ID supplied from ${pSource}`);
          await launchAVA(pUser);
          return 'good';
        }
        else {
          await logAccessAttempt(pUser, foundSession.last_login, false, `Failed Log-in.  Attempted stored password; user ID supplied from ${pSource}`);
          setDoneTrying(false);
          // intentionally fall through to attempt default credentials
        }
      }
      // We know the person, but have not been able to log them in yet
      // Attempt to log person is with generic credentials
      let result = await genericLogin(pUser, pSource);
      if (result === 'good') {
        return 'good';
      }
      // If we got to here...  we had a good User, but did not get that user authenticated
      // Let's ask for the password and try to get in that way...
      enqueueSnackbar(`We're having trouble logging you in automatically.  Please enter your password.`, { variant: 'error', persist: true });
      setAVAFollowUpData({ 'enteredUserID': pUser, 'NeedUser': false });
      setDoneTrying(true);
      return 'password';
    }
  }

  async function genericLogin(pUser, pSource) {
    let [goodLogin, ,] = await cognitoLogin(AVA_default_user, AVA_default_password);
    if (goodLogin) {
      await logAccessAttempt(pUser, '', true, `Successful Log-in using generic credentials; user ID supplied from ${pSource}`);
      await launchAVA(pUser);
      return 'good';
    }
    else {
      let eMessage = `Failed Log-in using generic credentials; user ID supplied from ${pSource}`;
      await logAccessAttempt(pUser, '', false, eMessage);
      enqueueSnackbar(`${eMessage}..  AVA support has been notified.`, { variant: 'error', persist: true });
      sendMessage('AVA', 'bootstrap', eMessage, 'ava_support');
      return 'failed';
    }
  }

  async function refreshSession(refresh_token) {
    let cognitoPoolUser = await Auth
      .currentUserPoolUser()
      .catch(e => {
        console.log(e);
      });
    CognitoClient.adminInitiateAuth(
      {
        'AuthFlow': 'REFRESH_TOKEN_AUTH',
        'ClientId': cognitoPoolUser.pool.clientId,
        'UserPoolId': cognitoPoolUser.pool.userPoolId,
        'AuthParameters': refresh_token
      });
  }

  function promptForUser() {
    if (testModeErrorTrap()) { return false; }
    return (AVAFollowUpData && AVAFollowUpData.hasOwnProperty('NeedUser'));
  }

  function promptForPassword() {
    if (testModeErrorTrap()) { return false; }
    return (AVAFollowUpData && AVAFollowUpData.hasOwnProperty('enteredUserID'));
  }

  function newSubscriptionPrompt() {
    return (AVAFollowUpData && AVAFollowUpData.hasOwnProperty('newSubscription'));
  }

  function promptSignUp() {
    return (AVAFollowUpData && AVAFollowUpData.hasOwnProperty('PromptSignUp'));
  }

  function verifySubscription() {
    return (AVAFollowUpData && AVAFollowUpData.hasOwnProperty('checkSubscription'));
  }

  function verifySignUp() {
    return (AVAFollowUpData && AVAFollowUpData.hasOwnProperty('checkSignUp'));
  }

  function testModeErrorTrap() {
    return (
      doneTrying
      && (messageList.length > 0)
      && (window.location.href.split('//')[1].slice(0, 1).toUpperCase() === 'T')
    );
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
            ml={2} mr={2} mt={20}
          >
            <Box
              display='flex' flexDirection='column' justifyContent='center' alignItems='center'
              key={'loadingBox'}
              ml={2} mr={2} mb={2} mt={2}
              minWidth={250}
              maxWidth={250}
              minHeight={250}
              maxHeight={250}
              borderColor={'black'}
              border={2}
              style={{ borderRadius: '120px 120px 120px 120px', backgroundColor: 'white', textDecoration: 'none' }}
            >
              <Box
                component="img"
                mb={2}
                minHeight={'35%'}
                maxHeight={'35%'}
                alt=''
                src={reactData.currentClientLogo}
              />
              <React.Fragment>
                <Box
                  display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                  flexWrap='wrap' textOverflow='ellipsis' width='100%' overflow={'hidden'}
                  key={'loadingBox'}
                  mb={2}
                >
                  <Typography style={AVATextStyle({ size: 1.5, color: 'black', align: 'center' })}  >{`Loading AVA`}</Typography>
                  <Typography style={AVATextStyle({ size: 0.8, color: 'black', align: 'center' })} >{`version ${process.env.REACT_APP_AVA_VERSION}${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}`}</Typography>
                </Box>
              </React.Fragment>
            </Box>
          </Box>
        </React.Fragment>
        {testModeErrorTrap() &&
          <Box
            display='flex' flexDirection='column' justifyContent='flex-start' alignItems='center'
            flexWrap='wrap' textOverflow='ellipsis' width='100%'
            key={'loadingBox'}
            mb={2}
          >
            <Typography variant='h5' >{`AVA Assistant`}</Typography>
            {messageList.map((pLine, index) => (
              <Typography
                className={classes.notTitle}
                id='scroll-dialog-title'
                key={'promptConfirm' + index}
              >
                {pLine}
              </Typography>
            ))}
            <Button
              className={classes.buttonArea}
              aria-label='showActivities'
              variant='contained'
              onClick={() => {
                let emptyList = [];
                setMessageList(emptyList);
              }}
            >
              {'Dismiss'}
            </Button>
          </Box>
        }
        {promptForUser() &&
          <AVATextInput
            titleText={customizationData ? customizationData.client_name : 'AVA Sign-in'}
            promptText={"User ID"}
            options={{ 'save_on_enter': true }}
            buttonText='Sign In'
            onCancel={() => {
              enqueueSnackbar(`Please enter your AVA ID`, { variant: 'info', persist: true });
              setMessageList([]);
            }}
            onSave={async (enteredUserID) => {
              if (!enteredUserID) {
                enqueueSnackbar(`You must enter an ID`, { variant: 'info' });
              }
              else {
                setMessageList([]);
                closeSnackbar();
                enqueueSnackbar(`AVA is trying to sign you in with "${enteredUserID.toLowerCase()}"`, { variant: 'info' });
                let cookieValues = getCookie();
                let result = await tryUser(enteredUserID.toLowerCase(), cookieValues.client, 'entered');
                if ((result === 'invalid') && (enteredUserID.toLowerCase() !== enteredUserID)) {
                  enqueueSnackbar(`AVA is trying to sign you in with "${enteredUserID}"`, { variant: 'info' });
                  await tryUser(enteredUserID, cookieValues.client, 'entered');
                }
              }
              setDoneTrying(true);
            }}
            allowCancel={false}
          />
        }
        {promptForPassword() &&
          <AVATextInput
            titleText={customizationData ? customizationData.client_name : 'AVA Sign-in'}
            promptText={"Password"}
            options={{ 'save_on_enter': true }}
            buttonText='Continue'
            onCancel={() => {
              setMessageList([]);
              closeSnackbar();
              enqueueSnackbar(`Please enter your User ID or Name`, { variant: 'info', persist: true });
              setAVAFollowUpData({ 'NeedUser': true });
            }}
            onSave={async (enteredPass) => {
              setMessageList([]);
              closeSnackbar();
              enqueueSnackbar(`AVA is verifying your information`, { variant: 'info' });
              for (let p = 0; p < AVAFollowUpData.possibleUserRecs.length; p++) {
                let [thatWorked, ,] = await cognitoLogin(AVAFollowUpData.possibleUserRecs[p].person_id, enteredPass);
                if (thatWorked) {
                  let userFrom = '';
                  if (AVAFollowUpData.possibleUserRecs.length > 1) { userFrom = `- user ID is #${p + 1} of ${AVAFollowUpData.possibleUserRecs.length} possible matches`; }
                  await logAccessAttempt(AVAFollowUpData.possibleUserRecs[p].person_id, enteredPass, true, `Successful Log-in using entered password ${userFrom}`);
                  launchAVA(AVAFollowUpData.possibleUserRecs[p].person_id);
                  return;
                }
              }
              // the entered data did not work as a password; perhaps as a apartment number, etc?
              enqueueSnackbar(`Still looking...`, { variant: 'info' });
              for (let p = 0; p < AVAFollowUpData.possibleUserRecs.length; p++) {
                let possibility = AVAFollowUpData.possibleUserRecs[p];
                if (enteredPass && possibility.location && possibility.location.toLowerCase().includes(enteredPass.toLowerCase())) {
                  if (possibility.sessionRec.requirePassword) {
                    let eMessage = `Using the information provided, AVA located account "${possibility.person_id}", but that account requires a password.  ("${enteredPass}" is not the right password.)`;
                    await logAccessAttempt(possibility.person_id, '', false, eMessage);
                    setDoneTrying(false);
                    enqueueSnackbar(`${eMessage} Please try again.`, { variant: 'error', persist: true });
                    return;
                  }
                  let result = await tryUser(possibility.person_id, possibility.client_id, 'location match');
                  if (result !== 'good') {
                    let eMessage = `Using the information provided, AVA located account "${possibility.person_id}".  However, we can't log that account into AVA.`;
                    await logAccessAttempt(possibility.person_id, '', false, eMessage);
                    enqueueSnackbar(`${eMessage} Please try again.`, { variant: 'error', persist: true });
                    return;
                  }
                  else {
                    let eMessage = `Successful Login for ${possibility.person_id} using entered location list of ${AVAFollowUpData.possibleUserRecs.length} possible matches`;
                    enqueueSnackbar(eMessage, { variant: 'info', persist: true });
                    await logAccessAttempt(possibility.person_id, '', true, eMessage);
                    launchAVA(possibility.person_id);
                    return;
                  }
                }
              }
              let eMessage = `None of the accounts we found have "${enteredPass}" as a password or location`;
              await logAccessAttempt('Text - not a UserID', '', false, eMessage);
              enqueueSnackbar(`${eMessage} Please try again.`, { variant: 'error', persist: true });
              setDoneTrying(true);
              return;
            }}
          />
        }
        {promptSignUp() &&
          <AVATextInput
            titleText={"Sign-up for a new account?"}
            promptText={[
              "Community Name",
              '[style={size:0.9,top:0}]Welcome to AVA!',
              '[style={size:0.9,top:0}]That e-Mail address is not yet associated with an AVA Account.',
              '[style={size:0.9,top:0}]Enter your Senior Living Community name above and tap "Sign up".',
              '[style={size:0.9,top:0}]You will be redirected to our subscription partner site.',
              `[style={size:0.9,top:0}]Return here after you've completed that form.`,
              '[style={size:0.9,top:0}]Thank you!',
              '[style={size:0.9,top:0}]'
            ]}
            valueText={[
              (customizationData ? customizationData.client_name : null)
            ]}
            options={{ 'save_on_enter': true }}
            buttonText='Sign-up!'
            onCancel={() => {
              setMessageList([]);
              closeSnackbar();
              enqueueSnackbar(`Please enter your User ID`, { variant: 'info', persist: true });
              setAVAFollowUpData({ 'NeedUser': true });
            }}
            onSave={(enteredCommunityName) => {
              window.open(AVAFollowUpData.link, 'AVA Subscription');
              setAVAFollowUpData({
                'checkSignUp': true,
                'prompt': [
                  'Welcome to AVA!',
                  `[style={size:0.6, top:0, italic: true }]Software for Seniors and those that care for them`,
                  '',
                  `[style={size:0.8, top:0 }]For the security of our residents, your information will be validated with ${enteredCommunityName}.`,
                  '',
                  `[style={size:0.8, top:0 }]When your account is set up and ready, we'll contact you at ${AVAFollowUpData.pUser}.`,
                  '',
                  '[style={size:0.8, top:0 }]Thank you for using AVA!',
                  '',
                ],
                pUser: AVAFollowUpData.pUser,
                pSource: AVAFollowUpData.pSource,
                client_name: enteredCommunityName[0],
                client_id: (customizationData ? customizationData.client_id : null)
              });
              setDoneTrying(true);
              return 'subscription';
            }}
          />
        }
        {newSubscriptionPrompt() &&
          <AVAConfirm
            promptText={AVAFollowUpData.prompt}
            cancelText={`Cancel`}
            confirmText={`Subscribe`}
            onCancel={async () => {
              return (await genericLogin(AVAFollowUpData.pUser, AVAFollowUpData.pSource));
            }}
            onConfirm={() => {
              window.open(AVAFollowUpData.link, 'AVA Subscription');
              setAVAFollowUpData({
                'checkSubscription': true,
                'prompt': [
                  'Tap below to continue'
                ],
                pUser: AVAFollowUpData.pUser,
                pSource: AVAFollowUpData.pSource,
                client_id: AVAFollowUpData.client_id,
                responsible_for: AVAFollowUpData.responsible_for,
                responsible_name: AVAFollowUpData.responsible_name
              });
              setDoneTrying(true);
              return 'subscription';
            }}
          />
        }
        {verifySubscription() &&
          <AVAConfirm
            promptText={AVAFollowUpData.prompt}
            cancelText={`I didn't subscribe this time`}
            confirmText={`Yes! I subscribed!`}
            onCancel={async () => {
              return (await genericLogin(AVAFollowUpData.pUser, AVAFollowUpData.pSource));
            }}
            onConfirm={async () => {
              await updateDb(
                [
                  {
                    "table": "People",
                    "key": { "person_id": AVAFollowUpData.pUser.toLowerCase() },
                    "data": {
                      "clients": [
                        {
                          "groups": [
                            "friends&family",
                            "ALL",
                            "_TOP_"
                          ],
                          "id": AVAFollowUpData.client_id
                        }
                      ],
                      "groups": [
                        "friends&family",
                        "ALL",
                        "_TOP_"
                      ]
                    }
                  },
                  {
                    "table": "SessionsV2",
                    "key": { "session_id": AVAFollowUpData.pUser.toLowerCase() },
                    "data": {
                      "assigned_to": "friends&family",
                      "subscription_status": "pending",
                      "patient_id": AVAFollowUpData.responsible_for,
                      "patient_display_name": AVAFollowUpData.responsible_name,
                    }
                  }
                ]
              );
              let request = {
                client: AVAFollowUpData.client_id,
                author: AVAFollowUpData.pUser.toLowerCase(),
                person_id: AVAFollowUpData.pUser.toLowerCase(),
                messageText:
                  `The owner of this e-Mail address indicated their intention to subscribe to AVA in the ${AVAFollowUpData.client_id} client.  Please check the Stripe reports for more information.`,
                recipientList: ['ava-support'],
                subject: `New Subscription for ${AVAFollowUpData.pUser.toLowerCase()}`
              };
              await sendMessages(request);
              return (await genericLogin(AVAFollowUpData.pUser, AVAFollowUpData.pSource));
            }}
          />
        }
        {verifySignUp() &&
          <AVAConfirm
            promptText={AVAFollowUpData.prompt}
            cancelText={`I didn't subscribe this time`}
            confirmText={`Yes! I subscribed!`}
            onCancel={async () => {
              setMessageList([]);
              closeSnackbar();
              enqueueSnackbar(`Please enter your User ID`, { variant: 'info', persist: true });
              setAVAFollowUpData({ 'NeedUser': true });
            }}
            onConfirm={async () => {
              await updateDb(
                [
                  {
                    "table": "People",
                    "key": { "person_id": AVAFollowUpData.pUser.toLowerCase() },
                    "data": {
                      "client_id": AVAFollowUpData.client_id || AVAFollowUpData.client_name,
                      "name": {
                        "first": AVAFollowUpData.pUser,
                        "last": "New Subscriber"
                      },
                      "search_data": AVAFollowUpData.pUser.toLowerCase(),
                      "messaging": {
                        "email": AVAFollowUpData.pUser,
                      },
                      "preferred_method": "email",
                      "clients": [
                        {
                          "groups": [
                            "message_only",
                            "_TOP_"
                          ],
                          "id": AVAFollowUpData.client_id || AVAFollowUpData.client_name
                        }
                      ],
                      "groups": [
                        "message_only",
                        "_TOP_"
                      ]
                    }
                  },
                  {
                    "table": "SessionsV2",
                    "key": { "session_id": AVAFollowUpData.pUser.toLowerCase() },
                    "data": {
                      "client_id": AVAFollowUpData.client_id || AVAFollowUpData.client_name,
                      "user_id": AVAFollowUpData.pUser.toLowerCase(),
                      "assigned_to": "message_only",
                      "subscription_status": "inactive"
                    }
                  }
                ]
              );
              let request = {
                client: AVAFollowUpData.client_id || AVAFollowUpData.client_name,
                author: AVAFollowUpData.pUser.toLowerCase(),
                person_id: AVAFollowUpData.pUser.toLowerCase(),
                messageText: `The owner of this e-Mail address indicated their intention to subscribe to AVA in the ${AVAFollowUpData.client_id || AVAFollowUpData.client_name} client.  Please check the Stripe reports for more information.`,
                recipientList: ['ava-support'],
                subject: `New Subscription for ${AVAFollowUpData.pUser.toLowerCase()}`
              };
              await sendMessages(request);
              setMessageList([]);
              closeSnackbar();
              enqueueSnackbar(`Please enter your User ID`, { variant: 'info', persist: true });
              setAVAFollowUpData({ 'NeedUser': true });
            }}
          />
        }
      </Dialog >
    );
  }
  else {
    return (<Component {...props} />);
  }

  async function cognitoLogin(pUser, pPass, pWho = null) {
    try {
      await Auth.signIn({ username: pUser, password: pPass.trim(), clientMetadata: { avaAccount: pWho || pUser } });
      return [true, pUser, pPass];
    }
    catch (e) {
      if (!pPass) {
        await logAccessAttempt(pUser, pPass, false, `You left the password blank!`);
      }
      else {
        await logAccessAttempt(pUser, pPass, false,
          `Failed login. Attempted ${pUser} and ${pPass.trim()}.  Cognito responded with ${e.code} - ${e.message}`
        );
      }
      setDoneTrying(false);
      if ((e.code !== 'NotAuthorizedException')
        || (e.message.includes('expired'))
        || (e.message.includes('exceeded'))) {
        return [false, null, null];
      }
      // Likely this is a bad password situation
      // First, try to case-correct the first character of the passed in password
      let c0 = pPass.trim().charAt(0);
      let caseCorrectedPassword;
      if (c0 === c0.toUpperCase()) {   // first character was a capital letter
        caseCorrectedPassword = c0.toLowerCase() + pPass.trim().substring(1);
      }
      else {   // first character was a lower case letter
        caseCorrectedPassword = c0.toUpperCase() + pPass.trim().substring(1);
      }
      try {
        await Auth.signIn({ username: pUser, password: caseCorrectedPassword, validationData: { avaAccount: pUser } });
        await logAccessAttempt(pUser, pPass, true, 'Successful Log-in with case corrected password');
        return [true, pUser, caseCorrectedPassword];
      }
      catch (e2) {
        await logAccessAttempt(pUser, `${caseCorrectedPassword} (case corrected)`, false,
          `Failed case corrected login. Reason:${e2.code} Message:${e2.message}`
        );
        setDoneTrying(true);
        return [false, null, null];
      }
    }
  }

  function bakeCookie(pUser, pClient, pPerson) {
    let ninetyDays = 90 * (24 * 60 * 60);
    setCookie('AVAuser',
      JSON.stringify({
        user_id: pUser,
        client: pClient,
        person_id: pPerson
      }), { path: '/', maxAge: ninetyDays });
    if (pClient) {
      setCookie('AVAclient', JSON.stringify({
        client: pClient,
      }), { path: '/' });
    };
  }

  function putValidationCookie() {
    setCookie('AVAvalidated', 'true', { path: '/' });
  }

  function getCookie() {
    let returnObj;
    if (cookies.AVAuser && cookies.AVAuser !== 'undefined') {
      if (typeof (cookies.AVAuser) === 'string') { returnObj = JSON.parse(cookies.AVAuser); }
      else { returnObj = cookies.AVAuser; }
      if (!('client' in returnObj)) { returnObj.client = getClientCookie(); }
      return returnObj;
    }
    else {
      let cClient = getClientCookie();
      if (cClient) { return { 'client': cClient }; }
      return false;
    };
  }

  function getClientCookie() {
    if (cookies.AVAclient && cookies.AVAclient !== 'undefined') {
      if (typeof (cookies.AVAclient) === 'string') { return cookies.AVAclient; }
      else { return (cookies.AVAclient.client_id || cookies.AVAclient.client_id); }
    }
    else { return null; }
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

  async function getSessionV2(pSessionID) {
    let goodIO = true;
    let sessionRec = await dbClient
      .get({
        Key: { session_id: pSessionID.toLowerCase() },
        TableName: "SessionsV2"
      })
      .promise()
      .catch(async (error) => {
        if (error.code === 'NetworkingError') {
          enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
        }
        else {
          await logAccessAttempt(pSessionID.toLowerCase(), '', false, `Error reading SessionsV2 (case converted) is ${JSON.stringify(error.message)}`);
        }
        console.log({ 'Bad get on Session - caught error is': error });
        goodIO = false;
      });
    if (!goodIO) {
      setDoneTrying(true);
      return [false, null, true];
    }
    if (!recordExists(sessionRec) && (pSessionID.toLowerCase() !== pSessionID)) {
      sessionRec = await dbClient
        .get({
          Key: { session_id: pSessionID },
          TableName: "SessionsV2"
        })
        .promise()
        .catch(async (error) => {
          await logAccessAttempt(pSessionID, '', false, `Error reading SessionsV2 is: ${JSON.stringify(error)}`);
          console.log({ 'Bad get on Session - caught error is': error });
          goodIO = false;
        });
    }
    if (!goodIO) {
      setDoneTrying(true);
      return [false, null, true];
    }
    if (!recordExists(sessionRec)) {
      setDoneTrying(true);
      return [false, null];
    }
    let user_fontSize = 1;
    if (sessionRec.Item.customizations && sessionRec.Item.customizations.font_size) {
      user_fontSize = sessionRec.Item.customizations.font_size;
    }
    AVADefaults({ fontSize: Math.max(user_fontSize, 1) });
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
      updateReactData({
        currentClientLogo: sessionRec.Item.client_icon
      });
    }
    setDoneTrying(true);
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

  async function getSessions(pSession) {
    let sessionRec = await dbClient
      .get({
        Key: { session_key: pSession },
        TableName: "Sessions"
      })
      .promise()
      .catch(error => {
        console.log({ 'Bad get on Sessions - caught error is': error });
      });
    if (recordExists(sessionRec)) { return sessionRec.Item; }
    else { return null; }
  }

  async function logAccessAttempt(pUser, pAttempted, pOK, pMessage) {
    let pMessageList = messageList;
    if (!pOK) {
      pMessageList.push(pMessage);
    }
    let nowTime = new Date();
    await dbClient
      .put({
        TableName: 'AccessLog',
        Item: {
          timestamp: nowTime.getTime(),
          timestring: nowTime.toLocaleString(),
          user_key: pUser,
          attempted_user: pUser,
          attempted_password: pAttempted,
          result: pMessage
        }
      })
      .promise()
      .catch(error => {
        console.log('Error adding an access log record:', error.message);
        pMessageList.push(`Error adding accessLog is ${error.message}`);
      });
    if (!pOK) {
      setMessageList(pMessageList);
    }
    return;
  };


  async function updateDb(pData) {
    // pData in the form {["table": <tablename>, "key": {"key1": "keydata1", etc...}, "data": {"field_name1": "new value", "field_name2", "new value", ...}]}
    let response = [];
    for (let t = 0; t < pData.length; t++) {
      let k_num = 0;
      let aNamesObj = {};
      let aValuesObj = {};
      let expression = 'set';
      for (let pKey in pData[t].data) {
        let aKey = `n${k_num++}`;
        aNamesObj[`#${aKey}`] = pKey;
        aValuesObj[`:${aKey}`] = pData[t].data[pKey];
        if (k_num > 1) {
          expression += ', ';
        }
        expression += ` #${aKey} = :${aKey}`;
      }
      await dbClient
        .update({
          Key: pData[t].key,
          UpdateExpression: expression,
          ExpressionAttributeValues: aValuesObj,
          ExpressionAttributeNames: aNamesObj,
          TableName: pData[t].table,
        })
        .promise()
        .catch(error => {
          console.log(`caught error updating ${pData[t].table}; error is:`, error);
          response.push(error);
        });
      response.push('OK');
    }
    return response;
  }


  async function updateSession(pSessionID, pSession, pPatient, pProfile, pLogin, pURL, pMessage, pSessionInfo) {
    let attributeValues = {
      ':s': {
        'version': `v${process.env.REACT_APP_AVA_VERSION}`,
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
    await dbClient
      .put({
        TableName: 'Sessions',
        Item: {
          session_key: pSessionInfo.accessToken.payload.jti,
          last_update: new Date().toLocaleString(),
          platform: platform,
          login: {
            user_id: pSessionID
          }
        }
      })
      .promise()
      .catch(error => { console.error('Error adding a fact:', error.message); });
  }

  async function launchAVA(pLaunchUser) {
    // Get the sessionlaunchAVA
    let goodSession, currentSession, dbError;
    [goodSession, currentSession, dbError] = await getSessionV2(pLaunchUser);
    if (!goodSession) {
      let eMessage;
      if (dbError) {
        eMessage = `No Internet connection.  Can't connect to the AVA database.`;
      }
      else {
        eMessage = `No SessionV2 record for ${pLaunchUser}.  This Account is not set up properly in AVA.`;
      }
      await logAccessAttempt(pLaunchUser, '', false, eMessage);
      enqueueSnackbar(eMessage, { variant: 'error', persist: true });
      sendMessage('AVA', 'bootstrap', eMessage, 'ava_support');
      setAVAReady(false);
      setAVAFollowUpData();
      setDoneTrying(true);
      return false;
    }
    if (currentSession.customizations && currentSession.customizations.font_size) {
      AVADefaults({ fontSize: Math.max(currentSession.customizations.font_size, 1) });
    }
    // Get the User's profile (info about the logged in person)
    let goodUser, currentProfile;
    [goodUser, currentProfile] = await getPerson(pLaunchUser);
    if (!goodUser) {
      let eMessage = `No People record for ${pLaunchUser}.  This Account is not set up properly in AVA.`;
      await logAccessAttempt(pLaunchUser, '', false, eMessage);
      enqueueSnackbar(eMessage, { variant: 'error', persist: true });
      sendMessage('AVA', 'bootstrap', eMessage, 'ava_support');
      setAVAReady(false);
      setAVAFollowUpData();
      setDoneTrying(true);
      return false;
    }
    // Get the Patient's profile (info about the active person - usually the same as the logged in user)
    let currentPatient;
    if (currentSession.patient_id === pLaunchUser) {
      currentPatient = currentProfile;
    }
    else {
      if (!currentSession.patient_id && pLaunchUser) {
        currentSession.patient_id = pLaunchUser;
      }
      [goodUser, currentPatient] = await getPerson(currentSession.patient_id);
      if (!goodUser) {
        let eMessage = `Attempt to use account ${currentSession.patient_id} failed.  That Account is not set up properly in AVA.  Using ${pLaunchUser} instead.`;
        await logAccessAttempt(pLaunchUser, '', false, eMessage);
        enqueueSnackbar(eMessage, { variant: 'error' });
        sendMessage('AVA', 'bootstrap', eMessage, 'ava_support');
        currentPatient = currentProfile;
        currentSession.patient_id = pLaunchUser;
        if (!currentProfile.name) {
          currentSession.patient_name = pLaunchUser;
        }
        else {
          currentSession.patient_name = (`${currentProfile.name.first} ${currentProfile.name.last}`).trim();
        }
      }
    }
    // Get Client Defaults
    if (!currentSession || !currentSession.client_name) {
      var customizationsRec = await dbClient
        .query({
          KeyConditionExpression: 'client_id = :c',
          ExpressionAttributeValues: { ':c': currentSession.client_id },
          TableName: "Customizations",
        })
        .promise()
        .catch(error => { console.log(`getGroup ERROR reading Customizations; caught error is: ${error}`); });
      if (recordExists(customizationsRec)) {
        for (let c = 0; c < customizationsRec.Items.length; c++) {
          let cRec = customizationsRec.Items[c];
          switch (cRec.custom_key) {
            case 'logo': {
              currentSession.client_logo = cRec.icon;
              updateReactData({
                currentClientLogo: cRec.icon
              });
              break;
            }
            case 'client_name': {
              currentSession.client_name = cRec.customization_value;
              break;
            }
            case 'group_assignments': {
              currentSession.group_assignments = cRec.customization_value;
              break;
            }
            case 'greeting':
            case 'greetings': {
              let today = new Date();
              let this_year = today.getFullYear();
              let this_month = today.getMonth() + 1;
              let this_day = today.getDate();
              let mmdd = `${this_month}.${this_day}`;
              let yymmdd = `${this_year % 100}.${mmdd}`;
              if (cRec.customization_value.hasOwnProperty(yymmdd)) {
                currentSession.custom_greeting = cRec.customization_value[yymmdd];
              }
              else if (cRec.customization_value.hasOwnProperty(mmdd)) {
                currentSession.custom_greeting = cRec.customization_value[mmdd];
              }
              break;
            }
            default: {
              if (cRec.customization_value) {
                currentSession[cRec.custom_key] = cRec.customization_value;
              }
              break;
            }
          }
        }
      }
    }

    belongsTo = await getGroupsBelongTo(currentSession.client_id, currentSession.patient_id, {});

    currentSession.adminAccount = false;
    if (currentProfile.account_class) {
      if ((currentProfile.account_class === 'master')
        || ((currentProfile.account_class === 'support')
          && (makeArray(currentProfile.clients).some(a => { return (a.id === currentSession.client_id); })))) {
        currentSession.adminAccount = true;
      };
    }
    if (!currentSession.adminAccount) {
      currentSession.adminAccount = await adminAccount(currentSession, currentPatient);
    }

    if ((currentSession.adminAccount) && (currentProfile.account_class !== 'master') && (currentProfile.account_class !== 'support')) {
      currentProfile.account_class = 'admin';
    }

    dispatch({ type: SET_SESSION, payload: currentSession });
    dispatch({ type: SET_PROFILE, payload: currentProfile });
    dispatch({ type: SET_USER, payload: currentProfile });
    dispatch({ type: SET_PATIENT, payload: currentPatient });

    bootState = {
      session: currentSession,
      profile: currentProfile,
      user: currentProfile,
      patient: currentPatient
    };

    let sessionInfo = await Auth
      .currentSession()
      .catch(e => {
        console.log(e);
      });

    localStorage.setItem('AVASessionData', JSON.stringify({ currentSession, currentProfile, currentPatient, sessionInfo }));
    sessionStorage.setItem('AVASessionData', JSON.stringify({ currentSession, currentProfile, currentPatient, sessionInfo }));
    bakeCookie(currentSession.session_id, currentSession.client_id, currentPatient.person_id);

    currentSession.url_parameters = getParamsFromURL();
    updateSession(currentSession.session_id, currentSession, currentPatient, currentProfile, currentSession.last_login, currentSession.url_parameters, 'AVA Launch', sessionInfo);

    // synchronous load other data
    loadSyncInfo(currentSession, currentPatient);

    putValidationCookie();
    setAVAReady(true);
    localAVAReady = true;
    setAVAFollowUpData({ 'Completed': true });
    return true;
  }

  async function loadSyncInfo(workSession, this_patient) {
    console.log(`in loadSyncInfo`);
    let pSession = deepCopy(workSession);
    let groupsObj = {};
    let membersObj = {};
    let aPromise = accountAccess(pSession.user_id, pSession.client_id, dispatch)
      .then(accessList => {
        dispatch({ type: SET_ACCESSLIST, payload: accessList });
        bootState.accessList = accessList;
        console.log(`done with loadSyncInfo AccessList.`);
      })
      .catch(error => {
        console.log(`error in loadSyncInfo AccessList. Message is ${error.message}`);
      });
    let cPromise = getAllGroups(pSession.patient_id, pSession.client_id)
      .then(groups => {
        dispatch({ type: SET_GROUPS, payload: Object.assign({}, { belongsTo }, membersObj, groups) });
        console.log(`done with loadSyncInfo Groups. Retrieved groups keys as ${Object.keys(groups)}`);
        groupsObj = groups;
      });

    let rightNow = new Date();
    let dPromise = getAllOccurrences(
      {
        client_id: pSession.client_id,
        start_date: rightNow,
        end_date: addDays(rightNow, 90)
      },
    ).then(occList => {
      dispatch({ type: SET_CALENDAR, payload: occList });
      bootState.calendar = occList;
      console.log(`done with loadSyncInfo Calendar. Loaded ${occList.length} ocurrence`);
    })
      .catch(error => {
        console.log(`error in loadSyncInfo Calendar. Message is ${error.message}`);
      });
    await Promise.allSettled([aPromise, cPromise, dPromise])
      .then(results => {
        console.log(`All resolved; results are ${JSON.stringify(results)}`, 'Launching MakeAVAMenu');
        bootState.groups = Object.assign({}, { belongsTo }, membersObj, groupsObj);
        MakeAVAMenu(this_patient, pSession.client_id, screenQuiet, null, null, bootState)
          .then(() => {
            console.log(`Menu reload complete`);
          });
        let last_state = {
          list: deepCopy(bootState.accessList[pSession.client_id].list)
        };
        console.log(`lastState size is approx ${JSON.stringify(last_state).length}`);
        dbClient
          .update({
            Key: { session_id: pSession.user_id },
            UpdateExpression: 'set last_state = :s',
            ExpressionAttributeValues: { ":s": last_state },
            TableName: "SessionsV2",
          })
          .promise()
          .catch(error => {
            console.log(`caught error updating SessionsV2; error is:`, error);
          });
      });
    return;
  }

  async function adminAccount(currentSession) {
    if (!currentSession.hasOwnProperty('group_assignments')) { return true; }
    let groupObject = currentSession.group_assignments;
    let adminArray = [];
    if (groupObject.hasOwnProperty('admin')) { adminArray.push(...(makeArray(groupObject.admin))); }
    if (groupObject.hasOwnProperty('staff')) { adminArray.push(...(makeArray(groupObject.staff))); }
    if (adminArray.length === 0) { return true; }
    return adminArray.some(g => {
      return belongsTo.hasOwnProperty[g];
    });
  }


  function screenQuiet(statusMessage) {
    return;
  };

  function recordExists(recordId) {
    if (!recordId) { return false; }
    if (recordId.hasOwnProperty('Count')) { return (recordId.Count > 0); }
    else { return ((recordId.hasOwnProperty("Item") || recordId.hasOwnProperty("Items"))); }
  }
};
