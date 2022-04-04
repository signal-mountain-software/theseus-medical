import React from 'react';
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

export default Component => props => {
  const [signedIn, setSigned] = React.useState(true);
  let localSignedIn = true;
  const setSignedIn = (setV) => {
    localSignedIn = setV;
    setSigned(setV);
  };

  const {
    enqueueSnackbar, closeSnackbar
  } = useSnackbar();

  let calledFrom = '';

  const [count, setCount] = React.useState(0);
  const [messageOut, setMessageOut] = React.useState('');
  const [inputName, setInputName] = React.useState('');
  const [inputLocationNumbers, setInputLocationNumbers] = React.useState('');
  const [inputPassword, setInputPassword] = React.useState('');
  const [inputCP, setInputCP] = React.useState('');

  const [resetPW, setResetPW] = React.useState(false);
  let [platform, showIOS] = useIosCheck();
  if (showIOS) { };

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
      else if (authState === AuthState.SignedOut || authState === AuthState.SignIn) {
        if (localSignedIn) {
          setSignedIn(false);
          enqueueSnackbar(`Authentication state is ${authState}.  Signed out.`, {
            variant: 'info'
          });
        }
      }
      else {
        console.log(authState);
        enqueueSnackbar(`Authentication state is ${authState}.`, {
          variant: 'info'
        });
      }
    });
  };

  const action = key => {
    if (calledFrom !== 'signIn') {
      return (
        <React-Fragment>
          <Button onClick={async () => {
            let result;
            closeSnackbar(key);
            try {
              result = await Auth
                .signIn(process.env.REACT_APP_AVA_PU, process.env.REACT_APP_AVA_PP);
            } catch (e) {
              console.log(e);
            }
            console.log(result);
          }}>
            Guest Sign-in
          </Button>
          <Button onClick={() => {
            console.log(key);
            closeSnackbar(key);
          }}>
            Try Again
          </Button>
        </React-Fragment >
      );
    }
  };

  const setMessages = (mText) => {
    if (count > 2) {
      calledFrom = 'failure';
      enqueueSnackbar(`${mText.trim()}.  It seems you're having trouble.  Would you like to use AVA as a guest?  As a guest, you can perform basic tasks and use "Send a Message" to get help with your account.`, {
        variant: 'error',
        persist: true,
        preventDuplicate: true,
        action
      });
    }
    else {
      setCount(count + 1);
      if (messageOut === mText) { mText += ' '; }
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
          `Version=v22.4.4${window.location.href.split('//')[1].slice(0, 1)}~${timeStamp}`
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
      const user = await Auth.currentAuthenticatedUser();
      if (user) { setSignedIn(true); }
      else {
        enqueueSnackbar(`No authenticated user found.`, {
          variant: 'info'
        });
      }
    } catch (err) {
      enqueueSnackbar(`${err !== 'not authenticated' ? (err + '.  ') : ''}Please sign-in. (v22.4.4${window.location.href.split('//')[1].slice(0, 1)})`, {
        variant: 'info'
      });
    }
  };

  const logChangeRequest = async (pUser, pLoc, pData) => {
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
    if (!invokeFailed && JSON.parse(fResp.Payload).status === 200) {
      enqueueSnackbar(`Change was successful!  You may sign-in using your new password.`, {
        variant: 'success'
      });
      Auth.signOut();
      setSignedIn(false);
    }
    else {
      setMessages(`We could not change your password at this time!  You may sign-in using your old password.`);
    }

  };

  const logAVAAccess = async (pUser, pPlatform, pMessage) => {
    await API
      .graphql(graphqlOperation(
        updateSession, {
        input: {
          session_id: pUser,
          status: pMessage,
          platform: pPlatform
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

  const eHandler = (data) => {
    switch (data.code) {
      case 'NotAuthorizedException': {
        setMessages(`That's not the correct password for Username "${inputName.trim()}"`);
        console.log(`user ${data.message.split(' ')[0]} OK, bad password`);
        break;
      }
      case 'InvalidParameterException': {
        setMessages(`There are invalid characters in the Username "${inputName.trim()}".  Please try again.`);
        console.log(data.message);
        break;
      }
      case 'UserNotFoundException': {
        setMessages(`The Username "${inputName.trim()}" does not exist`);
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
      console.log(`>${messageOut}<`);
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
                    calledFrom = 'signIn';
                    enqueueSnackbar(`Signing into AVA`, {
                      variant: 'info',
                      action
                    });
                    let resp = await Auth.signIn(inputName.trim(), inputCP.trim());
                    if (resp.challengeName === 'NEW_PASSWORD_REQUIRED') {
                      setResetPW(true);
                      enqueueSnackbar(`That's a temporary password.  Press "Reset password" to set a permanent one, please.`, {
                        variant: 'info',
                        action
                      });
                    }
                    else {
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
                  label: "Location",
                  placeholder: 'Apartment or Location Address numbers',
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