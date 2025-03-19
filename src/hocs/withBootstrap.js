import React from 'react';
import { dbClient, lambda, makeArray, getCustomizations, deepCopy, uuid } from '../util/AVAUtilities';
import { accountAccess, getAllGroups, getGroupsBelongTo } from '../util/AVAGroups';
import { getAllOccurrences, v2buildCalendar } from '../util/AVACalendars';
import { sendMessages } from '../util/AVAMessages';
import { addDays } from '../util/AVADateTime';
import { useSnackbar } from 'notistack';
import { Auth } from 'aws-amplify';
import { useLocation } from 'react-router-dom';
import { AVAclasses, AVADefaults } from '../util/AVAStyles';
import AVAConfirm from '../components/forms/AVAConfirm';
import MakeAVAMenu from '../util/MakeAVAMenu';
import PatientDialog from '../components/dialogs/PatientDialog';
import SelectAccount from '../components/dialogs/SelectAccount';

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
  AVAButton: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginBottom: theme.spacing(1),
    variant: 'outlined',
    border: '0.75px solid gray',
    textTransform: 'none',
    textDecoration: 'none',
    textWrap: 'nowrap',
    fontWeight: 'bold',
    size: 'small',
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
  const AVAClass = AVAclasses();

  const [cookies, setCookie, removeCookie] = useCookies(['AVAuser', 'AVAclient', 'AVAvalidated', 'AVAaction']);

  const [doneTrying, setDoneTrying] = React.useState(false);
  const [AVAReady, setAVAReady] = React.useState(false);
  let localAVAReady = false;
  const [AVAFollowUpData, setAVAFollowUpData] = React.useState();

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
      ),
    customizationData: {
      client_name: 'AVA Sign-in'
    },
    urlData: {},
    multipleAccountList: false
  });

  const updateReactData = (newData) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
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
        sessionStorage.removeItem('cognito_expires');
        let localCognitoSession = await Auth
          .currentSession()
          .catch(e => {
            console.log(e);
          });
        if (localCognitoSession) {
          sessionStorage.setItem('cognito_expires', JSON.stringify(localCognitoSession.accessToken?.payload?.exp));
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
        // Does the URL contain a User ID and/or client?
        let urlData = getParamsFromURL();
        if (urlData) {
          updateReactData({
            urlData: Object.assign({}, urlData, {
              client_id: urlData.client || urlData.client_id,
              user_id: urlData.user || urlData.user_id
            })
          });
          if (reactData.urlData.client_id) {
            let cData = await getCustomizations('*all', reactData.urlData.client_id);
            updateReactData({
              customizationData: Object.assign({}, cData, reactData.urlData),
              currentClientLogo: cData.logo
            });
          }
          if (reactData.urlData.create) {
            await tryUser(`ava-${reactData.urlData.client_id}`, reactData.urlData.client_id, 'url');
            return;
          }
          if (reactData.urlData.user_id) {
            await tryUser(reactData.urlData.user_id, reactData.urlData.client_id, 'url');
            return;
          }
        }
        // Check for a cookie
        let cookieValues = getCookie();
        if (cookieValues) {
          if (reactData.urlData.client_id) {
            if (cookieValues.client !== reactData.urlData.client_id) {
              // the URL was asking for a client that was not the one in the cookie
              cookieValues = {};
            }
          }
          else if (cookieValues.client) {
            let cData = await getCustomizations('*all', (cookieValues.client));
            updateReactData({
              customizationData: Object.assign({}, cData, { client_id: cookieValues.client }),
              currentClientLogo: cData.logo
            });
          }
          if (cookieValues.user_id && (!reactData.urlData.user_id) && (!reactData.urlData.tfa)) {
            await tryUser(cookieValues.user_id, cookieValues.client, 'cookie');
            return;
          }
        }
        // No URL data and no cookie
        setAVAFollowUpData({ 'NeedUser': true });
        return;
      });
    checkUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function tryUser(pUser, pClient, pSource, options = {}) {
    // return values:
    //    good - locked and loaded.  AVA signed-in and ready
    //    invalid - not a valid user ID
    //    password - user ID is valid, but password needed to log in
    //
    // Do we know this person's password?
    pUser = pUser.trim();
    let [goodSessionV2, foundSession, dbError] = await getSessionV2(pUser);
    if (goodSessionV2) {
      options.waiveTFA = true;
    }
    else {     // That is not a valid User ID, maybe it's a name?
      if (dbError) {
        setDoneTrying(true);
        return 'network';
      }
      await logAccessAttempt(pUser, '', false, `${pUser} is not a valid User ID (no SessionV2).`);
      closeSnackbar();
      // does the entered information show up in the PeopleAccount table (used for alternate IDs)?
      updateReactData({
        enteredID: pUser
      }, false);
      let [accountFound, foundPerson] = await getByAlternateID(pUser);
      if (accountFound) {
        [goodSessionV2, foundSession, dbError] = await getSessionV2(foundPerson.person_id);
      }
      else if (Array.isArray(foundPerson)) {
        if (foundPerson.length === 1) {
          [goodSessionV2, foundSession, dbError] = await getSessionV2(foundPerson[0].person_id);
        }
        else {
          enqueueSnackbar(`"${pUser}" matches ${foundPerson.length} accounts.`, { variant: 'error', persist: true });
          updateReactData({ multipleAccountList: foundPerson });
          setDoneTrying(true);
          setAVAFollowUpData({ 'NeedUser': false, 'SelectfromList': true });
          return 'ambiguous';
        }
      }
      if (!goodSessionV2) {  // either !accountFound and null returned from getAlternate ID OR (accountFound and !goodSessionV2) will arrive here 
        enqueueSnackbar(`"${pUser}" can't be used to log in. Please try again.`, { variant: 'error', persist: true });
        setDoneTrying(true);
        setAVAFollowUpData({ 'NeedUser': true });
        return 'invalid';
      }
      else {
        pUser = foundSession.session_id;
      }
    }
    // if the entry was bad, we should have bailed out by now...
    if (reactData.urlData.client_id && (reactData.urlData.client_id !== foundSession.client_id)) {
      // good account, but not in the client that was requested
      await logAccessAttempt(pUser, '', true, 'Good UserID entered, but it was not in the URL Client');
      closeSnackbar();
      enqueueSnackbar(`This account does not exist in ${reactData.customizationData.client_name}.`, { variant: 'error', persist: true });
      setDoneTrying(true);
      setAVAFollowUpData({ 'NeedUser': true });
      return 'invalid';
    }
    let tempURLOBj = getParamsFromURL();
    if (tempURLOBj && tempURLOBj.tfa && !options.waiveTFA) {
      await logAccessAttempt(pUser, '', true, 'Two-factor authentication required.');
      closeSnackbar();
      let [goodUser, foundPatient] = await getPerson(pUser);
      foundPatient.sessionRec = foundSession;
      if (goodUser) {
        let cRec = await getCustomizations('client_name', foundPatient.client_id);
        let client_name = cRec.customization_value;
        let tempPass = uuid(6);
        foundPatient.sessionRec.last_login = tempPass;
        let source = reactData.enteredID;
        let prefMethod;
        let expectedAddress;
        if (source.includes('@')) {
          prefMethod = 'email';
          expectedAddress = foundPatient.messaging.email || source;
          enqueueSnackbar(
            `We've sent an e-Mail to ${expectedAddress}. Look for a security code in that message and enter it here.`,
            { variant: 'success', persist: true });
        }
        else {
          prefMethod = 'sms';
          expectedAddress = foundPatient.messaging.sms || source;
          enqueueSnackbar(
            `We've sent a text to (${expectedAddress.slice(2, 5)}) ${expectedAddress.slice(5, 8)}-${expectedAddress.slice(8)}. Look for a security code in that message and enter it here.`,
            { variant: 'success', persist: true });
        }
        await sendMessages({
          client: foundPatient.client_id,
          author: foundSession.user_id,
          person_id: foundSession.person_id,
          preferred_method: prefMethod,
          messageText: `To access your ${client_name} account, use this code: ${tempPass}`,
          recipientList: [foundPatient.person_id],
          subject: `Security message from ${client_name}`
        });
        setAVAFollowUpData({ 'passwordRequired': true, 'enteredUserID': pUser, 'possibleUserRecs': [foundPatient] });
        return 'password';
      }
      else {
        let eMessage = `When fetching People account for this two factor authentication request, ${pUser} is not found`;
        await logAccessAttempt(pUser, '', false, eMessage);
        setDoneTrying(true);
        enqueueSnackbar(`${eMessage}.  This is an unusual situation.  AVA Support has been notified.`, { variant: 'error', persist: true });
        sendMessage('AVA', 'bootstrap', eMessage, 'ava_support');
        setAVAFollowUpData({ 'NeedUser': true });
        return 'invalid';
      }
    }
    if (
      (foundSession.forceSetPassword || (reactData.customizationData.client_style?.mandatory_passwords && !foundSession.last_login))
      && ((pSource === 'entered') || (pSource === 'selection'))
    ) {
      await logAccessAttempt(pUser, '', true, 'Good UserID entered.  Password must be set/reset for this account.');
      closeSnackbar();
      enqueueSnackbar(`Please set a new password.`, { variant: 'error', persist: true });
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
      setAVAFollowUpData({ 'passwordRequired': true, 'forceSetPassword': true, 'enteredUserID': pUser, 'possibleUserRecs': [foundPatient] });
      return 'password';
    }
    else if (
      (foundSession.requirePassword || reactData.customizationData.client_style?.mandatory_passwords)
      && ((pSource === 'entered') || (pSource === 'selection'))
    ) {
      await logAccessAttempt(pUser, '', true, 'Good UserID entered.  Password is required for this account.');
      closeSnackbar();
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
    closeSnackbar();
    enqueueSnackbar(`We're having trouble logging you in automatically.  Please enter your password.`, { variant: 'error', persist: true });
    setAVAFollowUpData({ 'enteredUserID': pUser, 'NeedUser': false });
    setDoneTrying(true);
    return 'password';
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
      closeSnackbar();
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
    return (AVAFollowUpData && AVAFollowUpData.NeedUser);
  }

  function promptForPassword() {
    if (testModeErrorTrap()) { return false; }
    return (AVAFollowUpData && AVAFollowUpData.hasOwnProperty('enteredUserID') && !AVAFollowUpData.forceSetPassword);
  }

  function promptSetPassword() {
    if (testModeErrorTrap()) { return false; }
    return (AVAFollowUpData && AVAFollowUpData.hasOwnProperty('enteredUserID') && AVAFollowUpData.forceSetPassword);
  }

  function promptConfirmPassword() {
    if (testModeErrorTrap()) { return false; }
    return (AVAFollowUpData && AVAFollowUpData.hasOwnProperty('enteredUserID') && AVAFollowUpData.confirmSetPassword);
  }

  const selectFromMultipleAccounts = () => {
    return (!!reactData.multipleAccountList);
  };

  function newSubscriptionPrompt() {
    return (AVAFollowUpData && (AVAFollowUpData.hasOwnProperty('newSubscription') || AVAFollowUpData.hasOwnProperty('addAccount')));
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

  async function forgotPassword() {
    const showWarning = new Promise((resolve, reject) => {
      const snackAction = (
        <React-Fragment>
          <Button className={AVAClass.AVAButton}
            style={{ backgroundColor: 'green', color: 'white' }}
            size='small'
            onClick={() => { resolve('got_it'); }}
          >
            I got it!
          </Button>
          <Button className={AVAClass.AVAButton}
            style={{ backgroundColor: 'red', color: 'white' }}
            size='small'
            onClick={() => { resolve('need_help'); }}
          >
            That didn't help
          </Button>
        </React-Fragment>
      );
      closeSnackbar();
      let lKP = AVAFollowUpData.possibleUserRecs[0].sessionRec.last_login.length;
      let exposed = AVAFollowUpData.possibleUserRecs[0].sessionRec.last_login.slice(0, 3);
      let hint = exposed.padEnd(lKP, '*');
      enqueueSnackbar(
        `Here's a hint...  your password is ${hint}`,
        { variant: 'warning', persist: true, action: snackAction }
      );
    });
    let rValue = await showWarning;
    closeSnackbar();
    return rValue;
  }

  if (!AVAReady && !localAVAReady) {
    return (
      <Dialog
        open={!AVAReady && !localAVAReady}
        p={2}
        fullScreen
      >
        {reactData?.customizationData?.client_style?.checkin_image
          ?
          <Box
            display='flex' flexDirection='row' justifyContent='center' alignItems='center'
            width={'100%'}
            maxHeight={'100%'}
            minHeight={'100%'}
            overflow={'hidden'}
          >
            <Box
              component="img"
              m={2}
              alt=''
              style={{ width: '100%', height: '100%' }}
              src={reactData?.customizationData?.client_style?.checkin_image}
            />
          </Box>
          :
          <React.Fragment>
            <Box
              display='flex' flexDirection='column' justifyContent='flex-start' alignItems='center'
              key={'loadingBox'}
            >
              <Box
                display='flex' flexDirection='column' justifyContent='center' alignItems='center'
                key={'loadingBox'}
                ml={2} mr={2} mb={2} mt={2}
                minWidth={100}
                maxWidth={100}
                minHeight={100}
                maxHeight={100}
                borderColor={'black'}
                border={2}
                style={{ borderRadius: '120px 120px 120px 120px', overflow: 'hidden', backgroundColor: 'white', textDecoration: 'none' }}
              >
                <Box
                  component="img"
                  minWidth={'80%'}
                  minHeight={'80%'}
                  alt=''
                  src={reactData.currentClientLogo}
                />
              </Box>
            </Box>
          </React.Fragment>
        }
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
            titleText={reactData.customizationData.client_name}
            promptText={"User ID"}
            options={{ 'save_on_enter': true }}
            buttonText='Sign In'
            onCancel={() => {
              enqueueSnackbar(`Please enter your ID`, { variant: 'info', persist: true });
              setMessageList([]);
            }}
            onSave={async (enteredUserID) => {
              if (!enteredUserID) {
                enqueueSnackbar(`You must enter an ID`, { variant: 'info' });
              }
              else if (enteredUserID.toLowerCase() === 'client') {
                if (reactData.hasOwnProperty('urlData')) {
                  delete reactData.urlData.client_id;
                }
                updateReactData({
                  urlData: reactData.urlData,
                  customizationData: { client_name: 'AVA Sign-in' }
                });
                setAVAFollowUpData({
                  NeedUser: true,
                });
              }
              else {
                setMessageList([]);
                closeSnackbar();
                enqueueSnackbar(`Signing in with "${enteredUserID.toLowerCase()}"`, { variant: 'info' });
                let result = await tryUser(enteredUserID.toLowerCase(), reactData.customizationData.client_id, 'entered');
                if ((result === 'invalid') && (enteredUserID.toLowerCase() !== enteredUserID)) {
                  closeSnackbar();
                  enqueueSnackbar(`Signing in with "${enteredUserID}"`, { variant: 'info' });
                  await tryUser(enteredUserID, reactData.customizationData.client_id, 'entered');
                }
              }
              setDoneTrying(true);
            }}
            allowCancel={false}
          />
        }
        {promptForPassword() &&
          <AVATextInput
            titleText={reactData.customizationData.client_name}
            promptText={"Password"}
            options={{ 'save_on_enter': true }}
            buttonText={['Continue', 'Cancel', 'Forgot Password']}
            onCancel={() => {
              setMessageList([]);
              closeSnackbar();
              enqueueSnackbar(`Please enter your User ID or Name`, { variant: 'info', persist: true });
              setAVAFollowUpData({ 'NeedUser': true });
            }}
            onSave={async (enteredPass, whichButton) => {
              setMessageList([]);
              closeSnackbar();
              if (whichButton === 2) {
                let requestAction = await forgotPassword();
                if (requestAction === 'need_help') {
                  await sendMessages({
                    client: AVAFollowUpData.possibleUserRecs[0].sessionRec.client_id,
                    author: AVAFollowUpData.possibleUserRecs[0].sessionRec.user_id,
                    person_id: AVAFollowUpData.possibleUserRecs[0].person_id,
                    messageText: `Account holder ${AVAFollowUpData.possibleUserRecs[0].person_id} in client ${AVAFollowUpData.possibleUserRecs[0].sessionRec.client_id} has asked for password help.`,
                    recipientList: ['ava-support', 'rsteele'],
                    subject: 'Password Assistance Requested'
                  });
                  closeSnackbar();
                  enqueueSnackbar(`A request was sent to the AVA Support team`, { variant: 'info' });
                }
                return;
              }
              closeSnackbar();
              enqueueSnackbar(`AVA is verifying your information`, { variant: 'info' });
              for (let p = 0; p < AVAFollowUpData.possibleUserRecs.length; p++) {
                let [thatWorked, ,] = await cognitoLogin(AVAFollowUpData.possibleUserRecs[p].person_id, enteredPass);
                if (thatWorked) {
                  let userFrom = '';
                  if (AVAFollowUpData.possibleUserRecs.length > 1) {
                    userFrom = `- user ID is #${p + 1} of ${AVAFollowUpData.possibleUserRecs.length} possible matches`;
                  }
                  await logAccessAttempt(AVAFollowUpData.possibleUserRecs[p].person_id, enteredPass, true, `Successful Log-in using entered password ${userFrom}`);
                  launchAVA(AVAFollowUpData.possibleUserRecs[p].person_id);
                  return;
                }
              }
              // the entered data did not work as a password; perhaps as a apartment number, etc?
              closeSnackbar();
              for (let p = 0; p < AVAFollowUpData.possibleUserRecs.length; p++) {
                let possibility = AVAFollowUpData.possibleUserRecs[p];
                if (AVAFollowUpData.possibleUserRecs[p].sessionRec.last_login.toLowerCase() === enteredPass.toLowerCase()) {
                  let result = await tryUser(possibility.person_id, possibility.client_id, 'stored password match', { waiveTFA: true });
                  if (result === 'good') {
                    let eMessage = `Successful Login for ${possibility.person_id}`;
                    enqueueSnackbar(eMessage, { variant: 'info', persist: false });
                    await logAccessAttempt(possibility.person_id, '', true, eMessage);
                    launchAVA(possibility.person_id);
                    return;
                  }
                }
                else if (enteredPass && possibility.location && possibility.location.toLowerCase().includes(enteredPass.toLowerCase())) {
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
                    enqueueSnackbar(eMessage, { variant: 'info', persist: false });
                    await logAccessAttempt(possibility.person_id, '', true, eMessage);
                    launchAVA(possibility.person_id);
                    return;
                  }
                }
              }
              let eMessage = `AVA could not log you in with "${enteredPass}"`;
              await logAccessAttempt('Text - not a UserID', '', false, eMessage);
              enqueueSnackbar(`${eMessage} Please try again.`, { variant: 'error', persist: true });
              setDoneTrying(true);
              return;
            }}
          />
        }
        {promptSetPassword() &&
          <AVATextInput
            titleText={reactData.customizationData.client_name}
            promptText={"New Password"}
            options={{ 'save_on_enter': true }}
            buttonText={['Continue', 'Cancel']}
            onCancel={() => {
              setMessageList([]);
              closeSnackbar();
              enqueueSnackbar(`Please enter your User ID or Name`, { variant: 'info', persist: true });
              setAVAFollowUpData({ 'NeedUser': true });
            }}
            onSave={async (enteredPass) => {
              setMessageList([]);
              closeSnackbar();
              setAVAFollowUpData({
                passwordRequired: true,
                proposedPassword: enteredPass,
                confirmSetPassword: true,
                enteredUserID: AVAFollowUpData.enteredUserID,
                possibleUserRecs: AVAFollowUpData.possibleUserRecs
              });
              return;
            }}
          />
        }
        {promptConfirmPassword() &&
          <AVAConfirm
            promptText={[
              reactData.customizationData.client_name,
              `[style={size:0.7,top:0}]Please confirm that you wish to set ${AVAFollowUpData.proposedPassword} as your new password`,
            ]}
            cancelText={`No, that's not right`}
            confirmText={`Yes - set ${AVAFollowUpData.proposedPassword} as my password`}
            onCancel={() => {
              setMessageList([]);
              closeSnackbar();
              setAVAFollowUpData({
                passwordRequired: true,
                forceSetPassword: true,
                enteredUserID: AVAFollowUpData.enteredUserID,
                possibleUserRecs: AVAFollowUpData.possibleUserRecs
              });
              return;
            }}
            onConfirm={async () => {
              setMessageList([]);
              let this_user = AVAFollowUpData.possibleUserRecs[0];
              // update SessionV2 with this password
              await updateDb(
                [                  
                  {
                    table: "SessionsV2",
                    key: {
                      session_id: AVAFollowUpData.enteredUserID.toLowerCase()
                    },
                    data: {
                      last_login: AVAFollowUpData.proposedPassword,
                      forceSetPassword: false,
                      storePassword: true,
                      password_change_date: new Date().toLocaleString()
                    }
                  },
                  {
                    table: "People",
                    key: {
                      person_id: AVAFollowUpData.enteredUserID.toLowerCase()
                    },
                    data: {
                      newPassword: AVAFollowUpData.proposedPassword,
                      storePassword: true,
                      password_change_date: new Date().toLocaleString()
                    }
                  },
                ]
              );
              closeSnackbar();
              enqueueSnackbar(`Your new password has been set to ${AVAFollowUpData.proposedPassword} and you are being signed-in now...`, { variant: 'info' });
              let result = await tryUser(this_user.person_id, this_user.client_id, 'stored password match', { waiveTFA: true });
              if (result === 'good') {
                let eMessage = `Successful Login for ${this_user.person_id}`;
                enqueueSnackbar(eMessage, { variant: 'info', persist: false });
                await logAccessAttempt(this_user.person_id, '', true, eMessage);
                launchAVA(this_user.person_id);
                return;
              }
              let eMessage = `Something went wrong.`;
              await logAccessAttempt('Text - new password set, but login failed', '', false, eMessage);
              enqueueSnackbar(`${eMessage} Please try again.`, { variant: 'error', persist: true });
              setDoneTrying(true);
              return;
            }}
          />
        }
        {selectFromMultipleAccounts() &&
          <SelectAccount
            selectionList={reactData.multipleAccountList}
            onCancel={() => {
              setAVAFollowUpData({ 'NeedUser': true });
              updateReactData({
                multipleAccountList: false
              }, true);
            }}
            onSelect={async (response) => {
              updateReactData({
                multipleAccountList: false
              }, false);
              let result = await tryUser(response.person_id, response.client_id, "selection");
              if (result === 'good') {
                let eMessage = `Successful Login for ${response.person_id}`;
                await logAccessAttempt(response.person_id, '', true, eMessage);
                launchAVA(response.person_id);
                return;
              }
            }}
          />
        }
        {promptSignUp() &&
          <AVAConfirm
            promptText={[
              reactData.customizationData.client_name,
              '[style={size:0.7,top:0}]Welcome!',
              '[style={size:0.7,top:0}]That e-Mail address is not currently associated with any Account.',
              '[style={size:0.7,top:0}]If you would like to create a new account, tap "Sign up" below.',
              '[style={size:0.7,top:0}]Thank you!',
              '[style={size:0.7,top:0}]'
            ]}
            cancelText={`Cancel`}
            confirmText={`Sign up`}
            onCancel={() => {
              setMessageList([]);
              closeSnackbar();
              enqueueSnackbar(`Please enter your User ID`, { variant: 'info', persist: true });
              setAVAFollowUpData({ 'NeedUser': true });
            }}
            onConfirm={() => {
              setAVAFollowUpData({
                'addAccount': true,
                'prompt': [
                  'Tap below to continue'
                ],
                pUser: AVAFollowUpData.pUser,
                pSource: AVAFollowUpData.pSource,
                pClient: AVAFollowUpData.pClient,
                client_id: AVAFollowUpData.pClient
              });
              setDoneTrying(true);
              return 'subscription';
            }}
          />
        }
        {newSubscriptionPrompt() &&
          <PatientDialog
            patient={{
              "person_id": AVAFollowUpData.pUser,
              "client_id": AVAFollowUpData.pClient,
              "groups": [],
              "name": {
                "first": 'New',
                "last": 'Account'
              },
              "clients": [
                {
                  "groups": [],
                  "id": AVAFollowUpData.pClient,
                }
              ],
            }}
            groupData={{}}
            open={true}
            onClose={async (response) => {
              if (response) {
                let request = {
                  client: AVAFollowUpData.client_id,
                  author: AVAFollowUpData.pUser.toLowerCase(),
                  person_id: AVAFollowUpData.pUser.toLowerCase(),
                  messageText:
                    `${(response.first + ' ' + response.last).trim()} has created an account in ${AVAFollowUpData.client_id} with the ID ${response.person_id}.`,
                  recipientList: ['ava-support'],
                  subject: `New Account for ${(response.first + ' ' + response.last).trim()}`
                };
                await sendMessages(request);
                setDoneTrying(true);
                setAVAFollowUpData({
                  'addAccount': true,
                  'prompt': [
                    'Tap below to continue'
                  ],
                  pUser: AVAFollowUpData.pUser,
                  pSource: AVAFollowUpData.pSource,
                  pClient: AVAFollowUpData.pClient,
                  client_id: AVAFollowUpData.pClient
                });
                setDoneTrying(true);
                return (await genericLogin(response.person_id, AVAFollowUpData.pSource));
              }
              else {
                setDoneTrying(true);
                setAVAFollowUpData({ 'NeedUser': true });
              }
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

  function putActionCookie(urlObj) {
    removeCookie("AVAaction");
    setCookie('AVAaction', JSON.stringify({
      document: (urlObj.document || null),
      docUser: (urlObj.docUser || null)
    }), { path: '/' });
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
          let eMessageText = JSON.stringify(error.message);
          if (eMessageText.startsWith('Signature not yet current')) {
            enqueueSnackbar(`The clock on this device is incorrect.  Please sync your device's time settings.`, { variant: 'error', persist: true });
          }
          else {
            await logAccessAttempt(pSessionID.toLowerCase(), '', false, `Error reading SessionsV2 (case converted) is ${eMessageText}`);
          }
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

  async function getByAlternateID(pInput) {
    var altIDs = await dbClient
      .query({
        KeyConditionExpression: 'identifier = :i',
        ExpressionAttributeValues: { ':i': pInput },
        TableName: "PeopleAccounts",
        IndexName: 'alternate_id-index'
      })
      .promise()
      .catch(error => { console.log(`getGroup ERROR reading Customizations; caught error is: ${error}`); });
    if (recordExists(altIDs)) {
      let foundIDs = [];
      for (let p = 0; p < altIDs.Items.length; p++) {
        let [goodGet, this_person] = await getPerson(altIDs.Items[p].person_id);
        if (goodGet &&
          ((!reactData.urlData.client_id)
            || (this_person.client_id === reactData.urlData.client_id)
          )) {
          foundIDs.push(this_person);
        }
      }
      if (foundIDs.length === 0) {
        enqueueSnackbar(`This account does not exist in ${reactData.customizationData.client_name}.`, { variant: 'error', persist: true });
        return [false, null];
      }
      else {
        return [false, foundIDs];
      }
    }
    return [false, null];
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
      let client_list = ['*all', currentSession.client_id];
      for (let cN = 0; cN < client_list.length; cN++) {
        var customizationsRec = await dbClient
          .query({
            KeyConditionExpression: 'client_id = :c',
            ExpressionAttributeValues: { ':c': client_list[cN] },
            TableName: "Customizations",
          })
          .promise()
          .catch(error => { console.log(`getGroup ERROR reading Customizations; caught error is: ${error}`); });
        if (recordExists(customizationsRec)) {
          for (let c = 0; c < customizationsRec.Items.length; c++) {
            let cRec = customizationsRec.Items[c];
            AVADefaults({ [cRec.custom_key]: cRec.customization_value });
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
                currentSession.inactiveGroupList = ['inactive'];
                let inactiveAssignment = makeArray(currentSession?.group_assignments?.inactive);
                if (inactiveAssignment.length > 0) {
                  currentSession.inactiveGroupList.push(...inactiveAssignment);
                }
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
              case 'working_hours': {
                currentSession['working_hours'] = cRec.customization_value;
                currentSession['working_hours'].isHoliday = false;
                if (cRec.customization_value.hasOwnProperty('holidays')) {
                  let today = new Date();
                  let this_year = today.getFullYear();
                  let this_month = today.getMonth() + 1;
                  let this_day = today.getDate();
                  let mmdd = `${this_month}.${this_day}`;
                  let yymmdd = `${this_year % 100}.${mmdd}`;
                  if (cRec.customization_value.holidays.hasOwnProperty(yymmdd)) {
                    currentSession['working_hours'].isHoliday = true;
                  }
                  else if (cRec.customization_value.holidays.hasOwnProperty(mmdd)) {
                    currentSession['working_hours'].isHoliday = true;
                  }
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
    }

    belongsTo = await getGroupsBelongTo(currentSession.client_id, currentSession.patient_id, { sort: true });
    let group_structure = await getAllGroups(currentSession.patient_id, currentSession.client_id);
    dispatch({ type: SET_GROUPS, payload: Object.assign({}, group_structure, { belongsTo }) });

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
    sessionStorage.setItem('AVASessionData', JSON.stringify({ currentProfile }));

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

    // localStorage.setItem('AVASessionData', JSON.stringify({ currentSession, currentProfile, currentPatient, sessionInfo }));
    // sessionStorage.setItem('AVASessionData', JSON.stringify({ currentSession, currentProfile, currentPatient, sessionInfo }));
    bakeCookie(currentSession.session_id, currentSession.client_id, currentPatient.person_id);

    currentSession.url_parameters = getParamsFromURL();
    updateSession(currentSession.session_id, currentSession, currentPatient, currentProfile, currentSession.last_login, currentSession.url_parameters, 'AVA Launch', sessionInfo);

    // synchronous load other data
    loadSyncInfo(currentSession, currentPatient);

    putValidationCookie();
    if (currentSession.url_parameters) {
      if (currentSession.url_parameters.hasOwnProperty('document')) {
        putActionCookie(currentSession.url_parameters);
      }
      else if (currentSession.url_parameters.hasOwnProperty('forms')) {
        removeCookie("AVAaction");
        setCookie('AVAaction', JSON.stringify({
          forms: true
        }), { path: '/' });
      }
    }
    else if (reactData.urlData.hasOwnProperty('document')) {
      putActionCookie(reactData.urlData);
    }
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
    // let cPromise = getAllGroups(pSession.patient_id, pSession.client_id)
    //  .then(groups => {
    //    dispatch({ type: SET_GROUPS, payload: Object.assign({}, { belongsTo }, membersObj, groups) });
    //    console.log(`done with loadSyncInfo Groups. Retrieved groups keys as ${Object.keys(groups)}`);
    //    groupsObj = groups;
    //  });

    let rightNow = new Date();
    let dPromise = getAllOccurrences(
      {
        client_id: pSession.client_id,
        this_person: pSession.patient_id,
        start_date: rightNow,
        end_date: addDays(rightNow, 35),
        filter: { group: belongsTo },
      },
    ).then(occList => {
      dispatch({ type: SET_CALENDAR, payload: occList });
      bootState.calendar = occList;
      console.log(`done with loadSyncInfo Calendar. Loaded ${Object.keys(occList).length - 1} dates`);
    })
      .catch(error => {
        console.log(`error in loadSyncInfo Calendar. Message is ${error.message}`);
      });
    v2buildCalendar(
      {
        client_id: pSession.client_id,
        this_person: pSession.patient_id,
        start_date: rightNow,
        end_date: addDays(rightNow, 35),
        filter: { group: belongsTo },
      },
    ).then(sampleList => {
      console.log(`done with test calendar load.`);
      console.log({ sampleList });
    })
      .catch(error => {
        console.log(`error in test load Calendar. Message is ${error.message}`);
      });
    // await Promise.allSettled([aPromise, cPromise, dPromise])
    await Promise.allSettled([aPromise, dPromise])
      .then(results => {
        console.log(`All resolved; results are ${JSON.stringify(results)}`, 'Launching MakeAVAMenu');
        bootState.groups = Object.assign({}, { belongsTo }, membersObj, groupsObj);
        MakeAVAMenu(this_patient, pSession.client_id, screenQuiet, null, null, bootState)
          .then(() => {
            console.log(`Menu reload complete`);
          });
        /*
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
        */
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
