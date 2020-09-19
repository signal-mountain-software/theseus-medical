import React from 'react';
import { useSnackbar } from 'notistack';
import { API, Auth, graphqlOperation } from 'aws-amplify';

import useSession from '../hooks/useSession';
import { getPeopleByGroup, getPerson, getRoles, getSession } from '../graphql/queries';
import { SET_PATIENT, SET_PATIENTS, SET_PROFILE, SET_ROLES, SET_SESSION, SET_USER } from '../contexts/Session/actions';

export default Component => props => {
  const { enqueueSnackbar } = useSnackbar();
  const { state, dispatch } = useSession();
  const { user } = state;

  React.useEffect(() => {
    (async () => {
      const user = await Auth.currentAuthenticatedUser();

      dispatch({ type: SET_USER, payload: user });
    })().catch(error => {
      enqueueSnackbar(`Whoops! Something went wrong when fetching current user: ${error.message}`, {
        variant: 'error',
      });
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      let getSessionResult;
      let getProfileResult;
      let getPatientResult;
      let getPeopleByGroupResult;
      let getRolesResult;
      if (user) {
        // get the session for the current user
        getSessionResult = await API.graphql(graphqlOperation(getSession, { session_id: user.username }));
        const session = getSessionResult.data.getSession;
        const user_id = session.user_id;

        // get the roles for the current user
        const client_group_id = session.client_id + '~' + (session.responsible_for || session.assigned_to);
        getRolesResult = await API.graphql(graphqlOperation(getRoles, { person_id: user_id, client_group_id }));
        const roles = getRolesResult.data.getRoles;

        // get the current profile information for a user
        getProfileResult = await API.graphql(graphqlOperation(getPerson, { person_id: user_id }));
        const profile = getProfileResult.data.getPerson;

        // get the current patient information for a user; if the user does not have a current patient, use the user's id
        const patient_id = session.patient_id;
        const person_id = patient_id || user_id;
        getPatientResult = await API.graphql(graphqlOperation(getPerson, { person_id: person_id }));
        const patient = getPatientResult.data.getPerson;

        // get a group of patients a user is responsible for
        let patients = null;
        if (session.responsible_for) {
          getPeopleByGroupResult = await API.graphql(
            graphqlOperation(getPeopleByGroup, { client_group_id, role: 'patient' })
          );
          patients = getPeopleByGroupResult.data.getPeopleByGroup;
        }

        if (mounted) {
          dispatch({ type: SET_SESSION, payload: session });
          dispatch({ type: SET_ROLES, payload: roles });
          dispatch({ type: SET_PROFILE, payload: profile });
          dispatch({ type: SET_PATIENT, payload: patient });
          dispatch({ type: SET_PATIENTS, payload: patients });
        } else {
          API.cancel(getSessionResult, 'App unmounted, cancel getSession');
          API.cancel(getRolesResult, 'App unmounted, cancel getRoles');
          API.cancel(getProfileResult, 'App unmounted, cancel getPerson');
          API.cancel(getPatientResult, 'App unmounted, cancel getPerson');
          API.cancel(getPeopleByGroupResult, 'App unmounted, getPeopleByGroup');
        }
      }
    })().catch(error => {
      const errors = [];
      if (error.hasOwnProperty('errors')) {
        error.errors.forEach(error => {
          errors.push(error.message);
        });
      } else {
        if (error.hasOwnProperty('message')) {
          errors.push(error.message);
        } else {
          errors.push('Error undefined...');
        }
      }

      if (errors.length === 0) {
        errors.push('Error undefined...');
      }

      enqueueSnackbar(`Whoops! Something went wrong: ${errors.join(', ')}`, {
        variant: 'error',
      });
    });

    return () => {
      mounted = false;
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Component {...props} />;
};
