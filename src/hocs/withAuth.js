import React from 'react';
import { AmplifyAuthenticator, AmplifyContainer, AmplifySignIn } from '@aws-amplify/ui-react';
import { Auth, appendToCognitoUserAgent } from '@aws-amplify/auth';
import { onAuthUIStateChange, AuthState } from '@aws-amplify/ui-components';

export default Component => props => {
  const [signedIn, setSignedIn] = React.useState(false);

  const checkUser = () => {
    setUser();

    return onAuthUIStateChange(authState => {
      if (authState === AuthState.SignedIn) {
        setSignedIn(true);
      } else if (authState === AuthState.SignedOut) {
        setSignedIn(false);
      }
    });
  };

  const setUser = async () => {
    try {
      const user = await Auth.currentAuthenticatedUser();
      if (user) setSignedIn(true);
    } catch (err) {
      console.error(err);
    }
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
          <AmplifySignIn headerText='Welcome to Theseus' slot='sign-in' hideSignUp />
        </AmplifyAuthenticator>
      </AmplifyContainer>
    );
  } else {
    return <Component {...props} />;
  }
};
