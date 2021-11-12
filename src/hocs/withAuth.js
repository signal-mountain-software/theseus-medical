import React from 'react';
import { AmplifyAuthenticator, AmplifyContainer, AmplifySignIn } from '@aws-amplify/ui-react';
import { Auth, appendToCognitoUserAgent } from '@aws-amplify/auth';
import { onAuthUIStateChange, AuthState } from '@aws-amplify/ui-components';
import { updateSession } from '../graphql/mutations';
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
          `Version=v21.11.12`
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
    /*
      let instruction = {
        patient_id: pUser,
        activity_key: 'event.logusage',
        value: pMessage,
        session: {
          user_id: pUser,
          session_id: pSession,
        },
      };    
      await API.graphql(graphqlOperation(createPutFact, { input: instruction }));
    */
    let timeOut = new Date().toString();
    await API
      .graphql(graphqlOperation(
          updateSession, 
          { input: { session_id: pUser, status: `v21.11.12~${timeOut}` } }
        ))
      .catch(error => { console.log(`Can't update session in logusage: ${error.errors[0].message}`) });
  };

  React.useEffect(() => {
    appendToCognitoUserAgent('withAuthenticator');
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
