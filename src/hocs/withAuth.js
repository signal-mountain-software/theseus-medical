import React from 'react';
import {
  AmplifyAuthenticator,
  AmplifyContainer,
  AmplifyFormSection,
  AmplifyFormField,
  AmplifySignIn
} from '@aws-amplify/ui-react';
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
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import { IconButton } from '@material-ui/core';
import ArrowBack from '@material-ui/icons/ArrowBack';

export default Component => props => {
  const [signedIn, setSignedIn] = React.useState(false);
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

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: 'AKIAR2O24AQ2HD72XKW4',
    secretAccessKey: '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',
  });

  const checkUser = () => {
    setUser();

    return onAuthUIStateChange(authState => {
      if (authState === AuthState.SignedIn) {
        logSession();
        setSignedIn(true);
      } else if (authState === AuthState.SignedOut) {
        setSignedIn(false);
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
    else {
      return (
        <React-Fragment>
          <Box>
            <Typography variant='caption'>(v21.11.15{process.env.NODE_ENV.slice(0, 1)})</Typography>
          </Box >
        </React-Fragment>
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
        logAVAAccess(
          data.idToken.payload['cognito:username'],
          data.accessToken.payload.sub,
          `Version=v21.11.15${process.env.NODE_ENV.slice(0, 1)}`
        );
      };
    } catch (err) {
      console.error(err);
    }
    return;
  };

  const setUser = async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      if (user) setSignedIn(true);
    } catch (err) {
      console.error(err);
    }
  };

  const logChangeRequest = async (pUser, pLoc, pData) => {
    /*
    let result;
    try {
      result = await Auth
        .signIn(process.env.REACT_APP_AVA_PU, process.env.REACT_APP_AVA_PP);
    } catch (e) {
      console.log(e);
    }
    console.log(result);
    let instruction = {
      patient_id: pUser,
      activity_key: 'event.pChange',
      value: {
        pLoc,
        pData
      },
      session: {
        user_id: pUser,
        session_id: 'withAuth',
      },
    };
    let resp = await API
      .graphql(graphqlOperation(
        createPutFact,
        {
          input: instruction,
        }))
      .catch(error => {
        console.log(`Can't put Fact pChange: ${error}`);
      });
    console.log(JSON.stringify(resp));
    */
    let invokeFailed = false;
    if (pUser !== '%abort%') {
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
          console.log('call for activity details failed.  Error is', JSON.stringify(err));
          setMessages(`There was a technical problem resetting the Password.  Contact AVA Support.`);
          invokeFailed = true;
        });

      if (!invokeFailed && JSON.parse(fResp.Payload).status === 200) {
        enqueueSnackbar(`Change was successful!  You may sign-in using your new password.`, {
          variant: 'success'
        });
      }
      else {
        setMessages(JSON.parse(fResp.Payload).body);
      }
    }
    else {
      invokeFailed = true;
    }
    Auth.signOut();
    setSignedIn(false);
  };

  const logAVAAccess = async (pUser, pSession, pMessage) => {
    let timeOut = new Date().toString();
    await API
      .graphql(graphqlOperation(
        updateSession, {
        input: {
          session_id: pUser,
          status: `v21.11.15${process.env.NODE_ENV.slice(0, 1)}~${timeOut}`
        }
      }
      ))
      .catch(error => {
        console.log(`Can't update session in logusage: ${error.errors[0].message}`);
      });
  };
  /*
    const listener = (data) => {
      switch (data.payload.event) {
        case 'signIn': {
          console.log('user signed in');
          break;
        }
        case 'signUp': {
          console.log('user signed up');
          break;
        }
        case 'signOut': {
          console.log(`You successfully signed out!`);
          break;
        }
        case 'signIn_failure': {
          switch (data.payload.data.code) {
            case 'NotAuthorizedException': {
              setMessages(`That's not the correct password for ${data.payload.message.split(' ')[0]}`);
              console.log(`user ${data.payload.message.split(' ')[0]} OK, bad password`);
              break;
            }
            case 'InvalidParameterException': {
              let rawLength = data.payload.message.length;
              let splitMessage = data.payload.message.replace(' ', '%%').split('%%');
              let trimLength = (splitMessage[0].length || 1) + splitMessage[1].trim().length + 1;
              if (rawLength !== trimLength) {
                setMessages(`There are blank spaces ${splitMessage[0] ? 'after' : 'before'} the username you entered.  Please try again.`);
              } else {
                setMessages(data.payload.message);
              }
              console.log(data.payload.message);
              break;
            }
            case 'UserNotFoundException': {
              setMessages(`The username ${data.payload.message.split(' ')[0]} does not exist`);
              console.log('bad user, password entered');
              break;
            }
            default: {
              setMessages(`An error occurred at login.  It is... ${data.payload.message}`);
              console.log('unknown error at login');
            }
          }
          break;
        }
        case 'tokenRefresh': {
          console.log('token refresh succeeded');
          break;
        }
        case 'tokenRefresh_failure': {
          console.log('token refresh failed');
          break;
        }
        case 'configured': {
          //  console.log('the Auth module is configured');
          break;
        }
        default: {
          setMessages(`Password reset requested for ${data.payload.message.split(' ')[0]}`);
          console.log('password reset requested');
        }
      }
    };
  */
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
      default: {
        setMessages(`An error occurred at login.  It is... ${data.message}`);
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
      <Paper component={Box}
        p={3}
        variant='outlined'
        display='flex'
        flexDirection='row'
        justifyContent='center'
        alignItems='center'>
        <Box flexGrow={1} mr={3}
          display="flex"
          flexDirection='column'
          alignItems="center"
          justifyContent="center"
        >
          <AmplifyAuthenticator
            hideToast
          >
            <AmplifySignIn headerText='Welcome to AVA!'
              slot='sign-in'
              hideToast
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
              key={'signIn'}
              handleSubmit={
                async (event) => {
                  console.log(`inputName is ${inputName}`);
                  console.log(`inputCP is ${inputCP}`);
                  event.preventDefault();
                  try {
                    await Auth.signIn(inputName.trim(), inputCP.trim());
                    calledFrom = 'signIn';
                    enqueueSnackbar(`Signing into AVA`, {
                      variant: 'info',
                      action
                    });
                  }
                  catch (e) {
                    console.log(e);
                    eHandler(e);
                  }
                }
              }
              hideSignUp />
            <AmplifyFormSection headerText="AVA Password Reset request"
              slot="forgot-password"
              sendButtonText="Confirm"
              handleSubmit={
                async (event) => {
                  console.log(`inputName is ${inputName}`);
                  console.log(`inputLocationNumbers is ${inputLocationNumbers}`);
                  enqueueSnackbar('Changing AVA password', {
                    variant: 'info'
                  });
                  setCount(0);
                  event.preventDefault();
                  await logChangeRequest(inputName, inputLocationNumbers, inputPassword);
                }
              } >
              <AmplifyFormField fieldId='changeUser'
                label='Username'
                placeholder='Enter the Username to reset'
                required={
                  true
                }
                type='username'
                value={
                  inputName
                }
                handleInputChange={
                  (event, cb) => {
                    setInputName(event.target.value);
                    // cb(event);
                  }
                } >
              </AmplifyFormField>
              <AmplifyFormField fieldId='userLocation'
                label='Location'
                placeholder='Apartment or Location Address numbers'
                required={
                  true
                }
                type='username'
                value={
                  inputLocationNumbers
                }
                handleInputChange={
                  (event, cb) => {
                    setInputLocationNumbers(event.target.value);
                    // cb(event);
                  }
                } >
              </AmplifyFormField>
              <AmplifyFormField fieldId='userLocation'
                label='New Password'
                placeholder='Password'
                required={
                  true
                }
                type='text'
                value={
                  inputPassword
                }
                handleInputChange={
                  (event, cb) => {
                    setInputPassword(event.target.value);
                  }
                } >
              </AmplifyFormField>
              <IconButton onClick={async () => { await logChangeRequest('%abort%', null, null); }}>
                <ArrowBack />
              </IconButton>
            </AmplifyFormSection>
          </AmplifyAuthenticator>


        </Box>
      </Paper>

    );
  } else {
    return <Component {
      ...props
    }
    />;
  }
};