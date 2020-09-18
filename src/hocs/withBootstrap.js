import React from 'react';
import { useSnackbar } from 'notistack';
import { API, Auth, graphqlOperation } from 'aws-amplify';

import useSession from '../hooks/useSession';
import { getPeopleByGroup, getPerson, getRoles, getSession } from '../graphql/queries';
import { SET_PATIENT, SET_PATIENTS, SET_ROLES, SET_SESSION, SET_USER } from '../contexts/Session/actions';

export default Component => props => {
  const { enqueueSnackbar } = useSnackbar();
  const { state, dispatch } = useSession();
  const { user } = state;

  React.useEffect(() => {
    (async () => {
      const user = await Auth.currentAuthenticatedUser().catch(error => {
        enqueueSnackbar(`Whoops! Something went wrong when fetching current user: ${error.message}`, {
          variant: 'error',
        });
      });

      dispatch({ type: SET_USER, payload: user });
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      let getSessionResult;
      let getPersonResult;
      let getPeopleByGroupResult;
      let getRolesResult;
      if (user) {
        // get the session for the current user
        getSessionResult = await API.graphql(graphqlOperation(getSession, { session_id: user.username })).catch(
          error => {
            enqueueSnackbar(`Whoops! Something went wrong when fetching a session: ${error.message}`, {
              variant: 'error',
            });
          }
        );
        const session = getSessionResult.data.getSession;
        const user_id = session.user_id;

        // get the roles for the current user
        const client_group_id = session.client_id + '~' + (session.responsible_for || session.assigned_to);
        getRolesResult = await API.graphql(graphqlOperation(getRoles, { person_id: user_id, client_group_id })).catch(
          error => {
            enqueueSnackbar(`Whoops! Something went wrong when fetching roles: ${error.message}`, {
              variant: 'error',
            });
          }
        );
        const roles = getRolesResult.data.getRoles;

        // get the current patient information for a user; if the user is a patient, use the user's id
        const patient_id = session.patient_id;
        const person_id = roles.includes('patient') ? patient_id : user_id;
        getPersonResult = await API.graphql(graphqlOperation(getPerson, { person_id: person_id })).catch(error => {
          enqueueSnackbar(
            `Whoops! Something went wrong when fetching a patient for the current session: ${error.message}`,
            {
              variant: 'error',
            }
          );
        });
        const patient = getPersonResult.data.getPerson;

        // get a group of patients a user is responsible for
        if (session.responsible_for) {
          getPeopleByGroupResult = await API.graphql(
            graphqlOperation(getPeopleByGroup, { client_group_id, role: 'patient' })
          ).catch(error => {
            enqueueSnackbar(`Whoops! Something went wrong when fetching patients by group: ${error.message}`, {
              variant: 'error',
            });
          });
        }
        const patients = getPeopleByGroupResult.data.getPeopleByGroup;

        if (mounted) {
          dispatch({ type: SET_SESSION, payload: session });
          dispatch({ type: SET_ROLES, payload: roles });
          dispatch({ type: SET_PATIENT, payload: patient });
          dispatch({ type: SET_PATIENTS, payload: patients });
        } else {
          API.cancel(getSessionResult, 'App unmounted, cancel getSession');
          API.cancel(getRolesResult, 'App unmounted, cancel getRoles');
          API.cancel(getPersonResult, 'App unmounted, cancel getPerson');
          API.cancel(getPeopleByGroupResult, 'App unmounted, getPeopleByGroup');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Component {...props} />;
};
