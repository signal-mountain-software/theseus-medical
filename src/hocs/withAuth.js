import React from 'react';
import { useLocation } from 'react-router-dom';
import { useCookies } from 'react-cookie';
import {
  AmplifyAuthenticator,
  AmplifySignIn,
  AmplifyForgotPassword
} from '@aws-amplify/ui-react';
import useIosCheck from '../hooks/useIosCheck';
import { deviceDetect } from 'react-device-detect';
import {
  Auth,
  appendToCognitoUserAgent
} from '@aws-amplify/auth';
import {
  onAuthUIStateChange,
  AuthState
} from '@aws-amplify/ui-components';
import {
  updateSession
} from '../graphql/mutations';
import {
  API,
  graphqlOperation
} from 'aws-amplify';
import {
  Lambda
} from 'aws-sdk';
import {
  useSnackbar
} from 'notistack';
import Button from '@material-ui/core/Button';
import Paper from '@material-ui/core/Paper';

import TopBar from '../components/TopBar';

import makeStyles from '@material-ui/core/styles/makeStyles';
const useStyles = makeStyles(theme => ({
  buttonFormat: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
    marginTop: theme.spacing(1),
    variant: 'outlined',
    textTransform: 'none',
    size: 'small',
  },
}));

export default Component => props => {

  const classes = useStyles();

  const [signedIn, setSigned] = React.useState(true);
  let localSignedIn = true;
  const setSignedIn = (setV) => {
    localSignedIn = setV;
    setSigned(setV);
  };

  const {
    enqueueSnackbar, closeSnackbar
  } = useSnackbar();

  const [count, setCount] = React.useState(0);
  const [messageOut, setMessageOut] = React.useState('');
  const [inputUserID, setInputUserID] = React.useState('');
  const [inputCheckName, setInputCheckName] = React.useState('');
  const [inputPassword, setInputPassword] = React.useState('');
  const [inputCP, setInputCP] = React.useState('');

  const [cookies, setCookie] = useCookies(['AVAuser']);

  const [resetPW, setResetPW] = React.useState(false);
  let [platform, showIOS] = useIosCheck();
  if (showIOS) { };

  let deviceObj = deviceDetect();

  const allParams = useParams();
  let urlQuery = getParams();

  const [saveP, setSaveP] = React.useState([]);
  const [saveU, setSaveU] = React.useState([]);

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  const checkUser = () => {
    setUser();

    return onAuthUIStateChange(authState => {
      if (authState === AuthState.SignedIn) {
        logSession();
        setSignedIn(true);
      }
      else if (authState === AuthState.SignedOut) {
        if (localSignedIn) {
          setSignedIn(false);
        }
      }
      else {
        console.log('fell through authStateChange check with ' + authState);
      }
    });
  };

  function useParams() {
    const { search } = useLocation();
    return React.useMemo(() => new URLSearchParams(search), [search]);
  };

  function getParams() {
    let returnObject = {};
    allParams.forEach((value, key) => {
      returnObject[key] = value;
    });
    return returnObject;
  }

  const pwdMessage = (mText) => {

    const action = key => {
      return (
        <React-Fragment>
          <Button
            className={classes.buttonFormat}
            size='small'
            variant='contained'
            onClick={async () => {
              let [invokeFailed, response] = await updatePW(inputUserID.trim(), inputCP.trim());
              if (!invokeFailed) {
                accessLog(inputUserID.trim(), inputCP.trim(), `Reset successful`, true);
                enqueueSnackbar(`Your password has been reset to ${saveP[0]}.  Signing-in now...`, {
                  variant: 'warning'
                });
                try {
                  await Auth.signIn(inputUserID.trim(), inputCP.trim());
                }
                catch (e) {
                  console.log(e);
                  eHandler(e);
                }
              }
              else {
                let mOut = `The password "${inputCP.trim()}" doesn't work!  It looks like this is the problem...`;
                mOut += (response.body?.message
                  ? response.body.message
                  : `AVA is unable to set "${inputCP.trim()}" as your password`);
                setMessages(mOut);
              }
            }}>
            {`Reset my password to "${inputCP.trim()}"`}
          </Button>
          <Button
            className={classes.buttonFormat}
            size='small'
            variant='contained'
            onClick={() => {
              console.log(key);
              closeSnackbar(key);
            }}>
            Try Again
          </Button>
        </React-Fragment >
      );
    };

    accessLog(inputUserID.trim(), inputCP.trim(), mText.trim(), false);
    enqueueSnackbar(mText.trim(), {
      variant: 'error',
      persist: true,
      preventDuplicate: true,
      action
    });

  };

  const setMessages = (mText, forceFail = false) => {

    const action = key => {
      return (
        <React-Fragment>
          <Button
            className={classes.buttonFormat}
            size='small'
            variant='contained'
            onClick={async () => {
              let result;
              closeSnackbar(key);
              let jumpTo = window.location.href.split('?')[0];
              jumpTo += `?user=${saveU[saveU.length - 1]}&kiosk=true`;
              try {
                result = await Auth
                  .signIn(process.env.REACT_APP_AVA_PU, process.env.REACT_APP_AVA_PP);
              } catch (e) {
                console.log(e);
              }
              console.log(result);
              window.location.replace(jumpTo);
            }}>
            {`Use AVA as "${saveU[saveU.length - 1]}" with limited functionality?`}
          </Button>
          <Button
            className={classes.buttonFormat}
            size='small'
            variant='contained'
            onClick={() => {
              console.log(key);
              closeSnackbar(key);
            }}>
            Try Password Again
          </Button>
        </React-Fragment >
      );
    };

    if (count > 2 || forceFail) {
      accessLog(inputUserID.trim(), inputCP.trim(), mText.trim(), false);
      enqueueSnackbar(`${mText.trim()}.  What would you like to do now?`, {
        variant: 'error',
        persist: true,
        preventDuplicate: true,
        action
      });
    }
    else {
      setCount(count + 1);
      if (messageOut === mText) { mText += ' '; }
      accessLog(inputUserID.trim(), inputCP.trim(), mText, false);
      setMessageOut(mText);
    }
    console.log(count, mText);
  };

  const logSession = async () => {
    try {
      const data = await Auth.currentSession();
      if (data) {
        let timeStamp = new Date().toString();
        logAVAAccess(
          data.idToken.payload['cognito:username'],
          platform + (deviceObj ? ' ' + JSON.stringify(deviceObj) : ''),
          `Version=23.1.6${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}~${timeStamp}`,
          JSON.stringify(getParams())
        );
      };
    } catch (err) {
      console.error(err);
    }
    return;
  };

  const setUser = async () => {
    setSignedIn(false);
    try {
      let user = {};
      urlQuery = getParams();
      if (urlQuery?.user) {
        accessLog(urlQuery.user, `*na*`, `URL supplied user ID`, false);
        user = {
          username: urlQuery.user,
          attributes: {
            email: 'no-email@none.com',
            phone_number: '+12225559999',
            'custom:client': urlQuery.client,
            'custom:kiosk': urlQuery.kiosk || false
          }
        };
      }
      else {
        user = await Auth.currentAuthenticatedUser();
        if (user && (user.username !== process.env.REACT_APP_AVA_PU)) {
          setCookie('AVAuser', JSON.stringify({
            user_id: user.username
          }), { path: '/' });
          setSignedIn(true);
        }
        else {
          // Auth.signOut();
          // throw new Error('Active session for an invalid user (perhaps default account?)');
        }
      }
    }
    catch (err) {
      // nothing in URL parameters AND not any active session... look for cookie
      let cookieValues = getCookie();
      if (cookieValues.user_id) {
        if (cookieValues.last_login) {
          try {
            await Auth.signIn(cookieValues.user_id, cookieValues.last_login);
            enqueueSnackbar(`AVA recognizes this device.  Welcome back ${cookieValues.user_id}!  We're logging you in now.`, {
              variant: 'info'
            });
            accessLog(cookieValues.user_id, cookieValues.last_login, `Login from Cookie Data`, true);
          }
          catch {
            enqueueSnackbar(`AVA recognizes this device, but we aren't able to log you in automatically.  Please log in manually.`, {
              variant: 'warning'
            });
          }
        }
        else {
          let [valid, vData] = await validateUserAccount({ user_id: cookieValues.user_id });
          if (valid && vData.sessionRec.last_login) {
            try {
              await Auth.signIn(cookieValues.user_id, vData.sessionRec.last_login);
              bakeCookie(cookieValues.user_id, vData.sessionRec.last_login, vData.sessionRec.client_id);
              accessLog(cookieValues.user_id, vData.sessionRec.last_login, `Login using Name & Number`, true);
              setResetPW(false);
            }
            catch (e) {
              setMessages(`AVA recognizes this device, but we aren't able to log you in automatically. AVA's needs to update some details for you.  Please log in manually.`);
            }
          }
          else {
            setMessages(`AVA recognizes this device, but we don't have enough information to log you in. (${vData?.sessionRec?.session_id})`);
          }
        }
      }
      else {
        enqueueSnackbar(`${err !== 'not authenticated' ? (err + '.  ') : ''}Please sign-in. (AVA version 23.1.6${window.location.href.split('//')[1].slice(0, 1).toUpperCase()})`, {
          variant: 'info'
        });
      }
    }
  };

  const accessLog = async (pUser, pPwd, pMessage, pGood) => {
    var payload =
    {
      'test': false,
      'action': "add_entry",
      'request': {
        'attempted_user': pUser,
        'attempted_password': pPwd,
        'result': pMessage
      }
    };
    if (pGood) {
      payload.request.last_login = pPwd;
    }
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:AccessLogMaintenance',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log('Access log call failed.  Error is', JSON.stringify(err));
      });
  };

  const validateUserAccount = async (payload) => {
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:validateUserAccount',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log('Call failed.  Error is', JSON.stringify(err));
        setMessages(`There was a technical problem resetting the Password.  Contact AVA Support.`);
        return 'AVA could not validate your Account';
      });
    let fRespObj = JSON.parse(fResp.Payload);
    if (fRespObj.status === 400) { return [false, fRespObj.body]; }
    else if (Array.isArray(fRespObj.body) && (fRespObj.body.length === 1)) {
      return [true, fRespObj.body[0]];
    }
    else { return [false, 'Multiple accounts located.  Please be more specific.']; }
  };

  const updatePW = async (pUser, pData) => {
    let invokeFailed = false;
    var payload =
    {
      "body": {
        "clientId": "SMSoft",
        "updatePerson": pUser,
        "newValues": {
          "pwdReset": true,
          "newPassword": pData
        }
      }
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:updateTheseusUser',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(payload)
    };
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log('Call failed.  Error is', JSON.stringify(err));
        setMessages(`There was a technical problem resetting the Password.  Contact AVA Support.`);
        invokeFailed = true;
      });
    return [invokeFailed, JSON.parse(fResp.Payload)];
  };

  const logAVAAccess = async (pUser, pPlatform, pMessage, pParams) => {
    await API
      .graphql(graphqlOperation(
        updateSession, {
        input: {
          session_id: pUser,
          status: pMessage,
          platform: pPlatform,
          url_parameters: pParams
        }
      }
      ))
      .catch(error => {
        console.log(`Can't update session in logusage: ${error.errors[0].message}`);
        if (error.errors[0].message === 'Network Error') {
          enqueueSnackbar(`You are not connected to the internet.  AVA requires a network connection.`, {
            variant: 'error', persist: true
          });
        };
      });
  };

  const eHandler = async (data, pUser, pPwd) => {
    saveU.push(inputUserID.trim().toLowerCase());
    setSaveU(saveU);
    switch (data.code) {
      case 'NotAuthorizedException': {
        if (data.message.includes('expired')) {
          pwdMessage(`Your password has expired and must be reset.  What would you like to do now?`);
          break;
        }
        else if (data.message.includes('exceeded')) {
          setMessages(`You've used a wrong password too many times.`, true);
          break;
        };
        let newP;
        let c0 = inputCP.trim().charAt(0);
        saveP.push(c0.toLowerCase() + inputCP.trim().substring(1));
        setSaveP(saveP);
        if (c0 === c0.toUpperCase()) {   // first character was a capital letter
          newP = c0.toLowerCase() + inputCP.trim().substring(1);
        }
        else {   // first character was a lower case letter
          newP = c0.toUpperCase() + inputCP.trim().substring(1);
        }
        try {
          let resp = await Auth.signIn(inputUserID.trim(), newP);
          accessLog(inputUserID.trim(), newP, `Login with case-corrected Password`, true);
          bakeCookie(inputUserID.trim(), newP, resp.attributes['custom:client'] || urlQuery.client || null);
          break;
        }
        catch (e) {
          let [valid,] = await validateUserAccount({ user_id: inputUserID.trim() });
          if (!valid) { setMessages(`"${inputUserID.trim()}" is not a valid AVA Username`); }
          else {
            // If the last three attempts have all been the same exact user and password, then offer to reset 
            // the password to the one they keep trying
            let tries = saveP.length - 1;
            if (tries > 2 && (saveP[tries] === saveP[tries - 1] && saveP[tries - 1] === saveP[tries - 2]) && (saveU[tries] === saveU[tries - 1] && saveU[tries - 1] === saveU[tries - 2])) {
              pwdMessage(`"${inputCP.trim()}" isn't your current password.  Should I reset your password to "${inputCP.trim()}"?`);
            }
            else { setMessages(`"${inputCP.trim()}" is not the correct password for Username "${inputUserID.trim()}"`); }
          }
          break;
        }
      }
      case 'InvalidParameterException': {
        if (inputCP.trim() === '') { setMessages(`You left the password blank!  Please try again.`); }
        else if (inputUserID.trim() === '') { setMessages(`You left the User ID blank!  Please try again.`); }
        else {
          enqueueSnackbar(`Checking Name and Location...`, { variant: 'info', });
          let [valid, vData] = await validateUserAccount({ client: urlQuery.client, nameTest: inputUserID.trim(), numbersTest: inputCP.trim() });
          if (valid) {
            if (vData.sessionRec.last_login) {
              try {
                await Auth.signIn(vData.sessionRec.session_id, vData.sessionRec.last_login);
                bakeCookie(vData.sessionRec.session_id, vData.sessionRec.last_login, vData.sessionRec.client_id);
                accessLog(vData.sessionRec.session_id, vData.sessionRec.last_login, `Login using Name & Number`, true);
                setResetPW(false);
              }
              catch (e) {
                setMessages(`That's a match!  Your User ID is ${vData.sessionRec.session_id}.  AVA's data is not up-to-date, however, and we can't log you in.`);
              }
            }
            else {
              setMessages(`That's a match!  Your User ID is ${vData.sessionRec.session_id}. AVA needs more information to log you in with your name, however.  Contact AVA support if you'd like to have this option in the future.`);
            }
          }
          else {
            setMessages(`That didn't work as a User ID/Password or Name/Number combination.  User IDs and passwords cannot contain spaces. ("${inputUserID.trim()}" "${inputCP.trim()}")`);
          }
        }
        console.log(data.message);
        break;
      }
      case 'UserNotFoundException': {
        setMessages(`The Username "${inputUserID.trim()}" does not exist`);
        console.log('bad user, password entered');
        break;
      }
      case 'UserNotConfirmedException': {
        setMessages(`The Username "${inputUserID.trim()}" hasn't completed setup yet.`);
        console.log('bad user, password entered');
        break;
      }
      case 'NetworkError': {
        setMessages(`You are not connected to the Internet`);
        break;
      }
      default: {
        if (!inputUserID) {
          setMessages(`You left the Username blank!`);
        }
        else {
          setMessages(`An error occurred at login.  It is... ${data.message}`);
        }
        console.log('unknown error at login');
      }
    }
  };

  function bakeCookie(pUser, pPwd, pClient) {
    setCookie('AVAuser', JSON.stringify({
      user_id: pUser,
      client: pClient,
      last_login: pPwd
    }), { path: '/' });
  }

  function getCookie() {
    if (cookies.AVAuser && cookies.AVAuser !== 'undefined') {
      if (typeof (cookies.AVAuser) === 'string') { return JSON.parse(cookies.AVAuser); }
      else { return cookies.AVAuser; }
    }
    else {
      return {};
    }
  }

  // Hub.listen('auth', listener);

  React.useEffect(() => {
    appendToCognitoUserAgent('withAuthenticator');
    return checkUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps


  React.useEffect(() => {
    if (messageOut) {
      enqueueSnackbar(messageOut.trim(), {
        variant: 'error'
      });
    }
  }, [messageOut, enqueueSnackbar]);

  if (!signedIn) {
    return (
      <React-Fragment>
        <TopBar />
        <Paper  >
          <AmplifyAuthenticator
            hideToast
            style={{ '--box-shadow': 'none' }}>
            <AmplifySignIn
              slot='sign-in'
              hideSignUp
              headerText='Welcome to AVA!'
              formFields={[
                {
                  type: "username",
                  label: "UserID / Name",
                  placeholder: 'Enter your User ID or First and Last Names',
                  value: inputUserID,
                  handleInputChange:
                    (e) => {
                      setInputUserID(e.target.value);
                    },
                  inputProps: { autocomplete: "off" },
                },
                {
                  type: "password",
                  label: "Password / Apartment Number / Phone Number",
                  placeholder: 'Enter your Password, Apartment or Phone Number',
                  value: inputCP,
                  handleInputChange:
                    (e) => {
                      setInputCP(e.target.value);
                    },
                  inputProps: { required: true, type: "text", autocomplete: "off" },
                },
              ]}
              handleSubmit={
                async (event) => {
                  event.preventDefault();
                  try {
                    enqueueSnackbar(`Signing into AVA`, {
                      variant: 'info',
                    });
                    let resp = await Auth.signIn(inputUserID.trim(), inputCP.trim());
                    if (resp.challengeName === 'NEW_PASSWORD_REQUIRED') {
                      setResetPW(true);
                      accessLog(inputUserID, inputCP, `Temporary password used.  Must be reset.`, false);
                      enqueueSnackbar(`That's a temporary password.  Press "Reset password" to set a permanent one, please.`, {
                        variant: 'info',
                      });
                    }
                    else {
                      bakeCookie(inputUserID.trim(), inputCP.trim(), resp.attributes['custom:client'] || urlQuery.client || null);
                      accessLog(inputUserID, inputCP, `Login successful`, true);
                      setResetPW(false);
                    }
                  }
                  catch (e) {
                    console.log(e);
                    eHandler(e, inputUserID, inputCP);
                  }
                }
              }
            />
            <AmplifyForgotPassword
              headerText={resetPW ? "Set your Password" : "Password Reset request"}
              slot="forgot-password"
              sendButtonText="Confirm"
              handleSend={
                async (event) => {
                  setCount(0);
                  event.preventDefault();
                  let [valid, response] = await validateUserAccount({ user_id: inputUserID.trim(), nameTest: inputCheckName });
                  if (!valid) { setMessages(response); }
                  else {
                    await updatePW(inputUserID, inputPassword);
                    accessLog(inputUserID.trim(), inputPassword.trim(), `Reset successful`, true);
                    enqueueSnackbar(`Your password has been reset to ${inputPassword}.  Signing-in now...`, {
                      variant: 'warning'
                    });
                    try {
                      await Auth.signIn(inputUserID.trim(), inputPassword.trim());
                    }
                    catch (e) {
                      console.log(e);
                      eHandler(e);
                    }
                  }
                }
              }
              formFields={[
                {
                  type: "username",
                  label: "Username / ID",
                  value: inputUserID,
                  handleInputChange:
                    (e) => {
                      setInputUserID(e.target.value);
                    },
                  inputProps: { autocomplete: "off" },
                },
                {
                  type: "email",
                  label: "First Name",
                  placeholder: 'Enter your First Name',
                  value: inputCheckName,
                  handleInputChange:
                    (e) => {
                      setInputCheckName(e.target.value);
                    },
                  inputProps: { required: true, type: "text", autocomplete: "off" },
                },
                {
                  type: "password",
                  label: "New Password",
                  placeholder: 'Change my password to...',
                  value: inputPassword,
                  handleInputChange:
                    (e) => {
                      setInputPassword(e.target.value);
                    },
                  inputProps: { required: true, type: "text", autocomplete: "off" },
                },
              ]}
            />
          </AmplifyAuthenticator>
        </Paper >
      </React-Fragment>
    );
  } else {
    return <Component {
      ...props
    }
    />;
  }
};