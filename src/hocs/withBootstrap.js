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

  async function onValidUser(user) {
    let mounted = true;
    if (user) {
      let getSessionResult;
      var getProfileResult;
      let getPatientResult;
      let getPeopleByGroupResult;
      let getRolesResult;

      getProfileResult = await API.graphql(graphqlOperation(getPerson, { person_id: user.username })).catch(error => {
        console.log('nothing to see here...');
      });

      if (!getProfileResult) {
        getProfileResult = await API.graphql(graphqlOperation(getPerson, { person_id: 'SMSoft~default' }));
        getProfileResult.data.getPerson.messaging.email = user.attributes.email || null;
        getProfileResult.data.getPerson.messaging.sms = user.attributes.phone_number || null;
        getProfileResult.data.getPerson.messaging.voice = null;
        getProfileResult.data.getPerson.messaging.location = null;
        getProfileResult.data.getPerson.name.first = user.username;
        getProfileResult.data.getPerson.name.last = 'Username';
      }
      let profile = getProfileResult.data.getPerson;
      var user_id = profile.person_id;

      // get the session for the current user
      getSessionResult = await API.graphql(graphqlOperation(getSession, { session_id: user.username })).catch(error => {
        console.log('nothing to see here either...');
      });
      var session;
      if (!getSessionResult) {
        getSessionResult = await API.graphql(graphqlOperation(getSession, { session_id: 'SMSoft~default' }));
        session = getSessionResult.data.getSession;
        session.user_id = user.username;
        session.user_display_name = 'Username ' + user.username;
      } else {
        session = getSessionResult.data.getSession;
      }

      // get the roles for the current user
      const client_group_id = session.client_id + '~' + (session.responsible_for || session.assigned_to);
      getRolesResult = await API.graphql(graphqlOperation(getRoles, { person_id: user_id, client_group_id }));
      const roles = getRolesResult.data.getRoles;

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
  }

  React.useEffect(() => {
    // let mounted;
    if (user) {
      onValidUser(user);
    }
    return () => {
      // let mounted = false;
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Component {...props} />;
};
