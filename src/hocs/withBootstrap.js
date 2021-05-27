import React from 'react';
import { useSnackbar } from 'notistack';
import { API, Auth, graphqlOperation } from 'aws-amplify';

import useSession from '../hooks/useSession';
import { getGroup, getPerson, getRoles, getSession } from '../graphql/queries';
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
      enqueueSnackbar(`Whoops! Something went wrong when fetching current user: ${error.errors[0].message}`, {
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
      var getPeopleByGroupResult;
      let getRolesResult;

      // get the session for the current user 
      // SessionsV2 delivers information about the current user environment.  Specifically...
      // session_id (primary key) is the authenticated user_id
      // user_id is the account that we will emulate for this session.  This should always be = session_id UNLESS we are trying to debug a user's account
      // patient_id is the account for which we are creating facts
      // Fred signs on as fred and we get Sessionv2 row with fred as primary key.  We assume this session is for user_id = fred.
      // That user_id will persist throughout the session and be used to determine which users you are allowed to work on behalf of (responsible_for)
      // The current user that you are working on behalf of (often and typically yourself), is stored in patient_id
      getSessionResult = await API.graphql(graphqlOperation(getSession, { session_id: user.username })).catch(error => {
        enqueueSnackbar(`Welcome to AVA, ${user.username}!  \nPlease select the "Associate my Account..." option and answer a couple of questions.
                We'll get your account finalized right away.\nNo worries, though.  You can use AVA in the meantime while we personalize things for you.`, {
              variant: 'info', persist: true,
            });
      });
      var session;
      if (!getSessionResult) {
        getSessionResult = await API.graphql(graphqlOperation(getSession, { session_id: 'SMSoft~default' }));
        session = getSessionResult.data.getSession;
        // session.user_id = user.username;
        session.user_display_name = 'Username ' + user.username;
      } else {
        session = getSessionResult.data.getSession;
        if ( session.user_id !== user.username ) {
          enqueueSnackbar(`You are emulating ${session.user_id}`, {
            variant: 'info',
          });
        }
      }

      // get person's Account information
      getProfileResult = await API.graphql(graphqlOperation(getPerson, { person_id: session.user_id }))
        .catch(error => {
            enqueueSnackbar(`You are assigned to ${session.user_id}, but we couldn't get their info.  The problem is: ${error.errors[0].message}`, {
              variant: 'error', persist: true,
            });
          console.log('using default user...');
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
      // var user_id = profile.person_id;

      // get the roles for the current user
      const client_group_id = session.client_id + '~' + (session.responsible_for || session.assigned_to);
      getRolesResult = await API.graphql(graphqlOperation(getRoles, { person_id: session.user_id, client_group_id })).catch(
        error => {
          enqueueSnackbar(`Warning! We couldn't get a security record for ${session.user_id} in ${client_group_id}.  
              Tell AVA support that the error is: ${error.errors[0].message}`, {
            variant: 'warning', persist: true,
          });
          console.log('security record not found (' + client_group_id + ')');
        }
      );
      const roles = getRolesResult ? getRolesResult.data.getRoles : null;

      // get the current patient information for a user; if the user does not have a current patient, use the user's id
      const patient_id = session.patient_id;
      const person_id = patient_id || session.user_id;
      getPatientResult = await API.graphql(graphqlOperation(getPerson, { person_id: person_id }));
      const patient = getPatientResult.data.getPerson;

      // get a group of patients a user is responsible for
      let patients = null;
      if (session.responsible_for) {
        getPeopleByGroupResult = await API.graphql(graphqlOperation(getGroup, { client_group_id })).catch(
          error => {
            enqueueSnackbar(`Warning! We couldn't get the names of the people in the ${client_group_id} group.  
              Tell AVA support that the error is: ${error.errors[0].message}`, {
            variant: 'warning', persist: true,
          });
            console.log(error.errors[0].message);
          }
        );
        if (getPeopleByGroupResult) {
          patients = getPeopleByGroupResult.data.getGroup;
        }
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
