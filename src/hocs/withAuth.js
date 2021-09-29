import React from 'react';
import { AmplifyAuthenticator, AmplifyContainer, AmplifySignIn } from '@aws-amplify/ui-react';
import { Auth, appendToCognitoUserAgent } from '@aws-amplify/auth';
import { onAuthUIStateChange, AuthState } from '@aws-amplify/ui-components';
import { createPutFact } from '../graphql/mutations';
import { API, graphqlOperation } from 'aws-amplify';

export default Component => props => {
  const [signedIn, setSignedIn] = React.useState(false);

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

  const logSession = async () => {
    try {
      const data = await Auth.currentSession();
      if (data) {
        logAVAAccess(
          data.idToken.payload['cognito:username'], 
          data.accessToken.payload.sub,
          `Version=${process.env.REACT_APP_AVA_VERSION} ~ TimeRef=${data.idToken.payload['auth_time']}`
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

  const logAVAAccess = async (pUser, pSession, pMessage) => {
    let instruction = {
      patient_id: pUser,
      activity_key: 'event.logusage',
      value: pMessage,
      session: {
        user_id: pUser,
        session_id: pSession,
      },
    };    
    // await API.graphql(graphqlOperation(createPutFact, { input: instruction }));
  };

  React.useEffect(() => {
    appendToCognitoUserAgent('withAuthenticator');

    // checkUser returns an "unsubscribe" function to stop side-effects
    return checkUser();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!signedIn) {
    return (
      <AmplifyContainer>
        <AmplifyAuthenticator>
          <AmplifySignIn headerText='Welcome to AVA!' slot='sign-in' />
        </AmplifyAuthenticator>
      </AmplifyContainer>
    );
  } 
  else {
    return <Component {...props} />;
  }
};
