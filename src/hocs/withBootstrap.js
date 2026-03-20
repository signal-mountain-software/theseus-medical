import React from 'react';
import { dbClient, lambda, makeArray, getCustomizations, deepCopy, uuid } from '../util/AVAUtilities';
import { accountAccess, getAllGroups, getGroupsBelongTo } from '../util/AVAGroups';
import { getAllOccurrences, v2buildCalendar, createNewOccurrences } from '../util/AVACalendars';
import { sendMessages } from '../util/AVAMessages';
import { addDays } from '../util/AVADateTime';
import { useSnackbar } from 'notistack';
import { Auth } from 'aws-amplify';
import { useLocation } from 'react-router-dom';
import { AVADefaults } from '../util/AVAStyles';
import MakeAVAMenu from '../util/MakeAVAMenu';
import QuickAdd from '../components/sections/QuickAdd';
import LoginModuleV2 from '../components/sections/LoginModuleV2';
import FormFillB from '../components/forms/FormFillB';
import PeopleMaintenance from '../components/dialogs/PeopleMaintenance';


import { useCookies } from 'react-cookie';
import useSession from '../hooks/useSession';
import useIosCheck from '../hooks/useIosCheck';

// import useMediaQuery from '@material-ui/core/useMediaQuery';

import { SET_PATIENT, SET_PROFILE, SET_GROUPS, SET_ACCESSLIST, SET_CALENDAR, SET_SESSION, SET_USER } from '../contexts/Session/actions';

const AWS = require('aws-sdk');
const CognitoClient = new AWS.CognitoIdentityServiceProvider({
  region: "us-east-1"
});

export default Component => props => {

  // Constants and React state variables
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();

  const { dispatch, state } = useSession();

  const [cookies, setCookie, removeCookie] = useCookies(['AVAuser', 'AVAclient', 'AVAvalidated', 'AVAaction']);

  const [doneTrying, setDoneTrying] = React.useState(false);
  const [AVAReady, setAVAReady] = React.useState(false);
  let localAVAReady = false;
  const [AVAFollowUpData, setAVAFollowUpData] = React.useState();
  console.log(AVAFollowUpData, doneTrying);

  const [platform] = useIosCheck();
  const isTestEnv = ['L', 'T'].includes(window.location.href.split('//')[1]?.slice(0, 1)?.toUpperCase());
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
        // Check URL parameters first - these override any existing session
        let urlData = await getParamsFromURL();

        // If ?create=<client_id> is in the URL, launch QuickAdd for that client
        if (urlData && urlData.create && !(urlData.user || urlData.user_id)) {
          const clientId = urlData.create;
          let cData = await getCustomizations('*all', clientId);
          updateReactData({
            customizationData: Object.assign({}, cData, urlData, { client_id: clientId }),
            currentClientLogo: cData.logo,
            urlData: Object.assign({}, urlData, {
              client_id: clientId,
              launch_quickadd: true,
              quickadd_source: 'url_parameter'
            })
          });
          setAVAFollowUpData({ 'Completed': true });
          setAVAReady(true);
          return;
        }

        // On localhost/test servers, skip auto-login and show the login screen
        if (isTestEnv) {
          return;
        }

        // Handle ?user= parameter - force login as specific user
        if (urlData && urlData.user) {
          console.log('User parameter detected:', urlData.user);

          // Clear any existing sessions
          sessionStorage.removeItem('AVASessionData');
          try {
            await Auth.signOut();
          } catch (e) {
            console.log('No existing Cognito session to sign out');
          }

          // Set up URL data with client info if available
          updateReactData({
            urlData: Object.assign({}, urlData, {
              client_id: urlData.client || urlData.client_id,
              user_id: urlData.user || urlData.user_id
            })
          });

          // Load client customizations if client is specified
          if (urlData.client || urlData.client_id) {
            const clientId = urlData.client || urlData.client_id;
            let cData = await getCustomizations('*all', clientId);
            updateReactData({
              customizationData: Object.assign({}, cData, urlData),
              currentClientLogo: cData.logo
            });
          }

          console.log('Trying user login:', urlData.user);
          let results = await tryUser(urlData.user, urlData.client || urlData.client_id, 'url');
          if ((Object.keys(urlData).length === 1) || (results !== 'good')) return;
        }

        // Handle ?create= parameter - force logout and launch QuickAdd
        if (urlData) {
          if (urlData.my_forms) {
            console.log('Document parameter detected:', urlData.document_id);
            updateReactData({
              urlData: Object.assign({}, urlData, {
                launch_myForms: true
              })
            });
          }
          else if (urlData.document_id) {
            console.log('Document parameter detected:', urlData.document_id);
            updateReactData({
              urlData: Object.assign({}, urlData, {
                launch_formFill: true,
                formFill_documentID: urlData.document_id
              })
            });
          }
        }

        // If a client is provided via URL, always prompt for user and ignore session/cookie
        if (urlData && (urlData.client || urlData.client_id) && !(urlData.user || urlData.user_id)) {
          const clientId = urlData.client || urlData.client_id;
          updateReactData({
            urlData: Object.assign({}, urlData, {
              client_id: clientId
            })
          });
          let cData = await getCustomizations('*all', clientId);
          updateReactData({
            customizationData: Object.assign({}, cData, urlData, { client_id: clientId }),
            currentClientLogo: cData.logo
          });
          setAVAFollowUpData({ 'NeedUser': true });
          return;
        }

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
        let urlDataCheck = await getParamsFromURL();
        if (urlDataCheck) {
          updateReactData({
            urlData: Object.assign({}, urlDataCheck, {
              client_id: urlDataCheck.client || urlDataCheck.client_id,
              user_id: urlDataCheck.user || urlDataCheck.user_id
            })
          });
          if (reactData.urlData.client_id) {
            let cData = await getCustomizations('*all', reactData.urlData.client_id);
            updateReactData({
              customizationData: Object.assign({}, cData, reactData.urlData),
              currentClientLogo: cData.logo
            });
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
    let tempURLOBj = await getParamsFromURL();
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

  function showQuickAdd() {
    return (AVAReady && reactData?.urlData?.launch_quickadd);
  }

  function showFormFill() {
    return (AVAReady && reactData?.urlData?.launch_formFill);
  }

  function showMyForms() {
    return (AVAReady && reactData?.urlData?.launch_myForms);
  }

  if (!AVAReady && !localAVAReady) {
    if (isTestEnv || true) {
      return (
        <LoginModuleV2
          onReady={() => {
            setAVAReady(true);
            setAVAFollowUpData({ 'Completed': true });
          }}
        />
      );
    }
  }
  else if (showQuickAdd()) {
    return (
      <QuickAdd
        onClose={(createdPersonIds, onSaveCallback = null) => {
          // QuickAdd finished - redirect to login with first created person
          if (createdPersonIds && createdPersonIds.length > 0) {
            const firstPersonId = createdPersonIds[0];
            const baseUrl = window.location.href.split('?')[0];
            let loginUrl = `${baseUrl}?user=${firstPersonId}`;
            if (onSaveCallback) { loginUrl += `&${onSaveCallback}=true`; }
            window.location.replace(loginUrl);
          } else {
            // No accounts created, clear the QuickAdd flag
            updateReactData({
              urlData: Object.assign({}, reactData.urlData, {
                launch_quickadd: false
              })
            });
          }
        }}
        options={{
          source: reactData.urlData?.quickadd_source || 'normal',
          client_id: reactData.urlData?.client_id || null
        }}
      />
    );
  }
  else if (showFormFill()) {
    return (
      <FormFillB
        onClose={(ignore_me, statusObj) => {
          sessionStorage.removeItem('AVASessionData');
          let jumpTo = `${window.location.href.replace('refresh', 'theseus').split('?')[0]}?continue`;
          window.location.replace(jumpTo);
        }}
        request={{
          document_id: reactData.urlData?.formFill_documentID
        }}
      />
    );
  }
  else if (showMyForms()) {
    return (
      <PeopleMaintenance
        person_id={reactData.urlData?.user_id || getCookie()?.user_id || null}
        options={{
          "sectionList": [
            "forms"
          ],
          "sectionToShow": [
            "FormSection"
          ]
        }}
        onClose={() => {
          sessionStorage.removeItem('AVASessionData');
          window.location.replace(`${window.location.href.split('?')[0]}?rel=${new Date().getTime()}`);
        }}
      />
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
    removeCookie("AVAaction", { path: '/' });
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

  async function getParamsFromURL() {
    let returnObject = {};
    allParams.forEach((value, key) => {
      console.log(key, value);
      returnObject[key] = value;
    });
    if (Object.keys(returnObject).length > 0) {
      if (returnObject.message) {
        returnObject = await extractMessageData(returnObject);
      }
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

    bakeCookie(currentSession.session_id, currentSession.client_id, currentPatient.person_id);

    currentSession.url_parameters = await getParamsFromURL();
    updateSession(currentSession.session_id, currentSession, currentPatient, currentProfile, currentSession.last_login, currentSession.url_parameters, 'AVA Launch', sessionInfo);

    // synchronous load other data
    loadSyncInfo(currentSession, currentPatient);

    putValidationCookie();
    let URLmsg = false;
    if (currentSession.url_parameters) {
      if (currentSession.url_parameters.hasOwnProperty('document')) {
        putActionCookie(currentSession.url_parameters);
      }
      else if (currentSession.url_parameters.hasOwnProperty('forms')) {
        removeCookie("AVAaction", { path: '/' });
        setCookie('AVAaction', JSON.stringify({
          forms: true
        }), { path: '/' });
      }
      else if (currentSession.url_parameters.hasOwnProperty('message')) {
        URLmsg = Object.assign({}, currentSession.url_parameters);
      }
    }
    else if (reactData.urlData.hasOwnProperty('document')) {
      putActionCookie(reactData.urlData);
    }
    else if (reactData.urlData.hasOwnProperty('message')) {
      URLmsg = Object.assign({}, reactData.urlData);
    }
    if (URLmsg) {
      removeCookie("AVAaction", { path: '/' });
      setCookie('AVAaction', JSON.stringify({
        message: URLmsg.message,
        sender: (URLmsg.sender || null),
        client_id: (URLmsg.client || URLmsg.client_id || null),
        recipient: (URLmsg.recipient || null),
        recipient_name: (URLmsg.recipient_name || null),
        text: (URLmsg.text || null),
        thread_id: (URLmsg.thread || URLmsg.thread_id || null),
        subject: (URLmsg.subject || null),
      }), { path: '/' });
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

    await createNewOccurrences({
      client: pSession.client_id
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

  async function extractMessageData(urlData) {
    let urlMessageRec = await dbClient
      .get({
        Key: { message_key: urlData.message },
        TableName: "MessageReplyTrigger"
      })
      .promise()
      .catch(async (error) => {
        if (error.code === 'NetworkingError') {
          enqueueSnackbar(`There is no internet connection.`, { variant: 'error', persist: true });
        }
        console.log({ 'Bad get on MessageReplyTrigger - caught error is': error });
      });
    if (recordExists(urlMessageRec)) {
      Object.assign(urlData, urlMessageRec.Item);
    }
    return urlData;
  };
};
