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
          `Version=22.6.24${window.location.href.split('//')[1].slice(0, 1).toUpperCase()}~${timeStamp}`,
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
        user = {
          username: urlQuery.user,
          attributes: {
            email: 'no-email@none.com',
            phone_number: '+12225559999',
            'custom:client': urlQuery.client
          }
        };
      }
      else {
        user = await Auth.currentAuthenticatedUser();
      }
      if (user) { setSignedIn(true); }
      else {
        enqueueSnackbar(`No authenticated user found.`, {
          variant: 'info'
        });
      }
    } catch (err) {
      enqueueSnackbar(`${err !== 'not authenticated' ? (err + '.  ') : ''}Please sign-in. (22.6.24${window.location.href.split('//')[1].slice(0, 1).toUpperCase()})`, {
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
      if (JSON.parse(fResp.Payload).body) {
        setMessages(JSON.parse(fResp.Payload).body);
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
    switch (data.code) {
      case 'NotAuthorizedException': {
        if (data.message.includes('expired')) {
          setMessages(`Your password has expired and must be reset`);
          break;
        };
        let newP;
        let c0 = inputCP.trim().charAt(0);
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
          setMessages(data.message);
          // setMessages(`That's not the correct password for Username "${inputName.trim()}"`);
          console.log(`user ${data.message}`);
          break;
        }
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
      console.log(`>${messageOut}<`);
      enqueueSnackbar(messageOut.trim(), {
        variant: 'error'
      });
    }
  }, [messageOut, enqueueSnackbar]);

  if (!signedIn) {
    return (
      <Dialog
        open={true}
        p={2}
        fullWidth
        variant={'elevation'} elevation={2}
        TransitionComponent={Transition}
      >
        {Object.keys(groupsManagedObject).length === 0
          ?
          <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
            <Typography className={classes.formControl} variant='h5' >
              {'Welcome to AVA'}
            </Typography>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </div>
          </Box>
          :
          <React.Fragment>
            <DialogContentText
              className={classes.title}
              id='scroll-dialog-title'
            >
              {'Please identify yourself'}
            </DialogContentText>
            <TextField
              id='UserID'
              value={input_userID}
              onChange={handleChangeUserID}
              className={classes.freeInput}
              label={isMobile ? 'ID or Name' : 'Type a few letters to filter the list'}
              variant={'standard'}
              autoComplete='off'
            />
            <Paper component={Box} variant='outlined' width='100%' overflow='auto' square>
              <List component='nav'>
                {Object.keys(groupsManagedObject).sort().map((listEntry, x) => (
                  (
                    listEntry.toLowerCase().includes(activity_filter.toLowerCase()) ?
                      <ListItem
                        key={'activity-list_' + listEntry}
                        onClick={() => {
                          onSelect(listEntry);
                        }}
                        button
                      >
                        <Box display='flex' flexDirection='row' minWidth='100%' justifyContent='space-between' alignItems='center'>
                          <Typography className=
                            {groupsManagedObject[listEntry].role === 'member' ? classes.listItemAVA :
                              (groupsManagedObject[listEntry].role === 'non-member' ? classes.listItemAVALight :
                                classes.listItemAVABold)}>
                            {listEntry}
                          </Typography>
                          <Typography className={classes.rightEdgeSmall}>
                            {groupsManagedObject[listEntry].role}
                          </Typography>
                        </Box>
                      </ListItem>
                      : null
                  )
                ))
                }
                {promptForName &&
                  <AVATextInput
                    promptText="Enter a Name for the Group you're creating"
                    buttonText='Create'
                    onCancel={() => { setPromptForName(false); }}
                    onSave={(newGroupName) => {
                      setPromptForName(false);
                      handleCreateAGroup(newGroupName);
                    }}
                  />
                }
              </List>
            </Paper>
          </React.Fragment>
        }
        <DialogActions className={classes.buttonArea} >
          <Button
            className={classes.rowButtonRed}
            onClick={() => {
              onCancel();
            }}
            startIcon={<CloseIcon fontSize="small" />}
          >
            {'Done'}
          </Button>
          {Object.keys(groupsManagedObject).length > 0 &&
            <Button
              onClick={() => {
                setPromptForName(true);
              }}
              className={classes.rowButtonGreen}
              startIcon={<GroupAddIcon fontSize="small" />}
            >
              {`Create ${!isMobile ? 'New Group' : ''}`}
            </Button>
          }
        </DialogActions>
      </Dialog>
    );
  } else {
    return <Component {
      ...props
    }
    />;
  }
};