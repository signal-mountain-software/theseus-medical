import React from 'react';
import { useSnackbar } from 'notistack';
import { API, graphqlOperation } from 'aws-amplify';
import { AmplifyAuthenticator, AmplifyContainer, AmplifySignIn } from '@aws-amplify/ui-react';
import { Auth, appendToCognitoUserAgent } from '@aws-amplify/auth';
import { onAuthUIStateChange, AuthState } from '@aws-amplify/ui-components';

import { getPerson, getSession } from '../graphql/queries';
import { SET_PATIENT, SET_SESSION, SET_USER } from '../contexts/Session/actions';
import useSession from '../hooks/useSession';

export default Component => props => {
  const [signedIn, setSignedIn] = React.useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const { state, dispatch } = useSession();
  const { user } = state;

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
      dispatch({ type: SET_USER, payload: user });
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

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (user) {
        let result1;
        let result2;
        result1 = await API.graphql(graphqlOperation(getSession, { session_id: user.username })).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching a session: ${error.message}`, {
            variant: 'error',
          });
        });

        result2 = await API.graphql(
          graphqlOperation(getPerson, { person_id: result1.data.getSession.patient_id })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching a patient by session: ${error.message}`, {
            variant: 'error',
          });
        });

        if (mounted) {
          dispatch({ type: SET_SESSION, payload: result1.data.getSession });
          dispatch({ type: SET_PATIENT, payload: result2.data.getPerson });
        } else {
          API.cancel(result1, 'withAuth unmounted');
          API.cancel(result2, 'withAuth unmounted');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [dispatch, enqueueSnackbar, user]);

  if (!signedIn) {
    return (
      <AmplifyContainer>
        <AmplifyAuthenticator>
          <AmplifySignIn slot='sign-in' hideSignUp />
        </AmplifyAuthenticator>
      </AmplifyContainer>
    );
  } else {
    return <Component {...props} />;
  }
};
