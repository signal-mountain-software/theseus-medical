import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  AmplifyAuthenticator,
  AmplifySignIn,
  AmplifyForgotPassword
} from '@aws-amplify/ui-react';
import useIosCheck from '../hooks/useIosCheck';
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
  const [inputName, setInputName] = React.useState('');
  const [inputLocationNumbers, setInputLocationNumbers] = React.useState('');
  const [inputPassword, setInputPassword] = React.useState('');
  const [inputCP, setInputCP] = React.useState('');

  const [resetPW, setResetPW] = React.useState(false);
  let [platform, showIOS] = useIosCheck();
  if (showIOS) { };

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

  const allParams = useParams();

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
              let [invokeFailed, response] = await tryPwdUpdate(inputName.trim(), 'updatePwd', inputCP.trim());
              if (!invokeFailed && response.status === 200) {
                accessLog(inputName.trim(), inputCP.trim(), `Reset successful`);
                enqueueSnackbar(`Your password has been reset to ${saveP[0]}.  Signing-in now...`, {
                  variant: 'warning'
                });
                try {
                  await Auth.signIn(inputName.trim(), inputCP.trim());
                }
                catch (e) {
                  console.log(e);
                  eHandler(e);
                }
              }
              else {
                if (response.body) {
                  let mOut = `The password "${inputCP.trim()}" doesn't work!  It looks like this is the problem...`;
                  mOut += (response.body?.message
                    ? response.body.message
                    : `AVA is unable to set "${inputCP.trim()}" as your password`);
                  setMessages(mOut);
                }
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

    accessLog(inputName.trim(), inputCP.trim(), mText.trim());
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
              window.location.replace(jumpTo);
              try {
                result = await Auth
                  .signIn(process.env.REACT_APP_AVA_PU, process.env.REACT_APP_AVA_PP);
              } catch (e) {
                console.log(e);
              }
              console.log(result);
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
      accessLog(inputName.trim(), inputCP.trim(), mText.trim());
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
      accessLog(inputName.trim(), inputCP.trim(), mText);
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
          platform,
          `Version=22.6.19.1${window.location.href.split('//')[1].slice(0, 1)}~${timeStamp}`,
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
      let urlQuery = getParams();
      if (urlQuery?.user) {
        accessLog(urlQuery.user, `*na*`, `URL supplied user ID`);
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
        let awsSession = await Auth.currentSession();
        console.log(awsSession);
        user = await Auth.currentAuthenticatedUser();
      }
      if (user) {
        setSignedIn(true);
      }
      else {
        enqueueSnackbar(`No authenticated user found.`, {
          variant: 'info'
        });
      }
    } catch (err) {
      enqueueSnackbar(`${err !== 'not authenticated' ? (err + '.  ') : ''}Please sign-in. (22.6.19.1${window.location.href.split('//')[1].slice(0, 1)})`, {
        variant: 'info'
      });
    }
  };

  const accessLog = async (pUser, pPwd, pMessage) => {
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

  const tryPwdUpdate = async (pUser, pLoc, pData) => {
    let invokeFailed = false;
    var payload =
    {
      person: pUser,
      locationTest: pLoc,
      newP: pData
    };
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:validatePRequest',
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

  const logChangeRequest = async (pUser, pLoc, pData) => {
    let [invokeFailed, response] = await tryPwdUpdate(pUser, pLoc, pData);
    if (!invokeFailed && response.status === 200) {
      accessLog(pUser, pData, `Manual password change was successful`);
      enqueueSnackbar(`Change was successful!  You may sign-in using your new password.`, {
        variant: 'success'
      });
      Auth.signOut();
      setSignedIn(false);
    }
    else {
      if (response.body) {
        setMessages(response.body);
      }
      else {
        setMessages(`We could not change your password at this time!  You may sign-in using your old password.`);
      }
    }
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

  const eHandler = async (data) => {
    saveU.push(inputName.trim().toLowerCase());
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
          await Auth.signIn(inputName.trim(), newP);
          break;
        }
        catch (e) {
          let [invokeFailed, response] = await tryPwdUpdate(inputName.trim(), 'checkUser', 'password');
          if (!invokeFailed && response.body === "That's not a valid AVA Username") {
            setMessages("That's not a valid AVA Username");
          }
          else {
            // If the last three attempts have all been the same exact user and password, then offer to reset 
            // the password to the one they keep trying
            let tries = saveP.length - 1;
            if (tries > 2 && (saveP[tries] === saveP[tries - 1] && saveP[tries - 1] === saveP[tries - 2]) && (saveU[tries] === saveU[tries - 1] && saveU[tries - 1] === saveU[tries - 2])) {
              pwdMessage(`That isn't your current password.  Should I reset your password to "${inputCP.trim()}"?`);
            }
            else { setMessages(`That's not the correct password for Username "${inputName.trim()}"`); }
          }
          break;
        }
      }
      case 'InvalidParameterException': {
        if (inputCP.trim() === '') { setMessages(`You left the password blank!  Please try again.`); }
        else if (inputName.trim() === '') { setMessages(`You left the User ID blank!  Please try again.`); }
        else { setMessages(`There are invalid characters in either the Username or the Password.  Please try again.`); }
        console.log(data.message);
        break;
      }
      case 'UserNotFoundException': {
        setMessages(`The Username "${inputName.trim()}" does not exist`);
        console.log('bad user, password entered');
        break;
      }
      case 'UserNotConfirmedException': {
        setMessages(`The Username "${inputName.trim()}" hasn't completed setup yet.`);
        console.log('bad user, password entered');
        break;
      }
      case 'NetworkError': {
        setMessages(`You are not connected to the Internet`);
        break;
      }
      default: {
        if (!inputName) {
          setMessages(`You left the Username blank!`);
        }
        else {
          setMessages(`An error occurred at login.  It is... ${data.message}`);
        }
        console.log('unknown error at login');
      }
    }
  };

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
                  label: "Username / ID",
                  value: inputName,
                  handleInputChange:
                    (e) => {
                      setInputName(e.target.value);
                    },
                  inputProps: { autocomplete: "off" },
                },
                {
                  type: "password",
                  label: "Password",
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
                    let resp = await Auth.signIn(inputName.trim(), inputCP.trim());
                    if (resp.challengeName === 'NEW_PASSWORD_REQUIRED') {
                      setResetPW(true);
                      accessLog(inputName, inputCP, `Temporary password used.  Must be reset.`);
                      enqueueSnackbar(`That's a temporary password.  Press "Reset password" to set a permanent one, please.`, {
                        variant: 'info',
                      });
                    }
                    else {
                      accessLog(inputName, inputCP, `Login successful`);
                      setResetPW(false);
                    }
                  }
                  catch (e) {
                    console.log(e);
                    eHandler(e);
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
                  console.log(`inputName is ${inputName}`);
                  console.log(`inputLocationNumbers is ${inputLocationNumbers}`);
                  setCount(0);
                  event.preventDefault();
                  await logChangeRequest(inputName, inputLocationNumbers, inputPassword);
                }
              }
              formFields={[
                {
                  type: "username",
                  label: "Username / ID",
                  value: inputName,
                  handleInputChange:
                    (e) => {
                      console.log(`inputName is ${e.target.value}`);
                      setInputName(e.target.value);
                    },
                  inputProps: { autocomplete: "off" },
                },
                {
                  type: "email",
                  label: "First Name",
                  placeholder: 'Enter your First Name',
                  value: inputLocationNumbers,
                  handleInputChange:
                    (e) => {
                      console.log(`location is ${e.target.value}`);
                      setInputLocationNumbers(e.target.value);
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