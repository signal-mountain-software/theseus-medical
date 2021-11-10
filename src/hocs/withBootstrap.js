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
      var getPeopleByGroupResult;
      let getRolesResult;
      let usingDefaultSession = false;

      // get the session for the current user 
      // SessionsV2 delivers information about the current user environment.  Specifically...
      // session_id (primary key) is the authenticated user_id
      // user_id is the account that we will emulate for this session.  This should always be = session_id UNLESS we are trying to debug a user's account
      // patient_id is the account for which we are creating facts
      // Fred signs on as fred and we get Sessionv2 row with fred as primary key.  We assume this session is for user_id = fred.
      // That user_id will persist throughout the session and be used to determine which users you are allowed to work on behalf of (responsible_for)
      // The current user that you are working on behalf of (often and typically yourself), is stored in patient_id
      getSessionResult = await API.graphql(graphqlOperation(getSession, { session_id: user.username })).catch(error => {
        enqueueSnackbar(`Welcome to AVA, ${user.username}! Please tap the Welcome button (the oval toward the top left of your screen).  That's where you'll be able to complete your account setup.
                Once that's complete, we'll get your account finalized right away.  No worries, though!  You can use many AVA features in the meantime while we personalize things for you.`, {
              variant: 'info', persist: true,
            })
      });

      var session;
      
      var userInfo = await Auth.currentUserInfo();
      const default_client_id = userInfo.attributes['custom:client'] || 'SMSoft';

      if (!getSessionResult) {
        usingDefaultSession = true;
        getSessionResult = await API.graphql(graphqlOperation(getSession, { session_id: `${default_client_id}~default` }))
          .catch(error => {
            enqueueSnackbar(`Contact AVA support.  There is no default Session`, { variant: 'error', persist: true, });
          });
        session = getSessionResult.data.getSession;
        session.user_display_name = 'Welcome ' + user.username;
      } else {
        session = getSessionResult.data.getSession;
        if ( session.user_id !== user.username ) {
          enqueueSnackbar(`You are emulating ${session.user_id}`, {
            variant: 'info',
          });
        }
      }

      // get person's Account information
      getProfileResult = await API.graphql(graphqlOperation(getPerson, { person_id: (session.user_id) }))
        .catch(error => {
            enqueueSnackbar(`You are user ID is ${(usingDefaultSession ? user.username : session.user_id)}, but we couldn't get your info.  The problem is: ${error.errors[0].message}`, {
              variant: 'error', persist: true,
            });
          console.log('using default user...');
      });

      if (!getProfileResult) {
        getProfileResult = await API.graphql(graphqlOperation(getPerson, { person_id: `${default_client_id}~default` }));
        usingDefaultSession = true;
      }

      if (usingDefaultSession) {
        getProfileResult.data.getPerson.messaging.email = user.attributes.email || null;
        getProfileResult.data.getPerson.messaging.sms = user.attributes.phone_number || null;
        getProfileResult.data.getPerson.messaging.voice = null;
        getProfileResult.data.getPerson.location = null;
        getProfileResult.data.getPerson.name.first = user.username;
        getProfileResult.data.getPerson.name.last = 'Welcome';
        getProfileResult.data.getPerson.clients = [ {"id": default_client_id, "groups": [`${default_client_id}_all`] } ];
      }

      let profile = getProfileResult.data.getPerson;
      profile.groups = getProfileResult.data.getPerson.clients[0].groups;
      // var user_id = profile.person_id;

      // get the roles for the current user
      var roles;
  //    if (session.responsible_for === 'ALL') { roles = ['admin'] }
  //    else {
        const client_group_id = session.client_id + '~' + session.assigned_to;
        getRolesResult = await API.graphql(graphqlOperation(getRoles, { person_id: session.user_id, client_group_id })).catch(
          error => {
            console.log('security record not found for user ' + session.user_id  + ' (' + client_group_id + ')');
          }
        );
        roles = getRolesResult?.data?.getRoles || ['patient'];
  //    }

      // get the current patient information for a user; if the user does not have a current patient, use the user's id
      // const patient_id = usingDefaultSession ? user.username : session.patient_id;
      var patient = {};
      if (profile.person_id === (session.patient_id || session.user_id)) { 
        Object.assign(patient, profile);
      }
      else {
        getPatientResult = await API.graphql(graphqlOperation(getPerson, { person_id: (session.patient_id || session.user_id) }));
        patient = getPatientResult.data.getPerson;
        if (usingDefaultSession) {
          patient.messaging.email = user.attributes.email || null;
          patient.messaging.sms = user.attributes.phone_number || null;
          patient.messaging.voice = null;
          patient.location = null;
          patient.name.first = user.username;
          patient.name.last = 'Welcome';
        }
      }
      patient.groups = patient.clients[0].groups;
      if (usingDefaultSession) { patient.person_id = user.username }

      // get a group of patients a user is responsible for
      let patients = [];
      if (session.responsible_for) {
        let respArray = [];
        if (Array.isArray(session.responsible_for)) { respArray.push(...session.responsible_for) }
        else if (session.responsible_for.startsWith('[')) { respArray = session.responsible_for.replace(/[[\s\]]/g,'').split(',') }
        else { respArray.push(session.responsible_for) }
        if (respArray.length > 0) {
          for (let r = 0; r < respArray.length; r++) {
            let pRec = await API
              .graphql(graphqlOperation(getPerson, { person_id: respArray[r] }))
              .catch(
                () => { console.log(`${respArray[r]} not found.  Trying Group table`) });
            if (pRec?.data?.getPerson) { 
              patients.push({
                display_name: `${pRec.data.getPerson.name.last}, ${pRec.data.getPerson.name.first}`,
                person_id: pRec.data.getPerson.person_id,
                roles: ['patient'],
                client_group_id: 'na'
              });
              continue;
            }
            if (!respArray[r].includes('~')) { respArray[r] = session.client_id + '~' + respArray[r] }
            getPeopleByGroupResult = await API
              .graphql(graphqlOperation(getGroup, { client_group_id: respArray[r] }))
              .catch(
                error => {
                  console.log(`Warning! We couldn't get the names of the people in the ${respArray[r]} group.  
                    Error is: ${error.errors[0].message}`);
                }
              );
            if (getPeopleByGroupResult) {
              patients.push(...getPeopleByGroupResult.data.getGroup);
            }
          };
        }
        /*
        else {
          let respFor = session.client_id + '~' + session.responsible_for;
          getPeopleByGroupResult = await API.graphql(graphqlOperation(getGroup, { client_group_id: respFor })).catch(
            error => {
              enqueueSnackbar(`Warning! We couldn't get the names of the people in the ${respFor} group.  
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
        */
      }
      if (patients.length > 0) { 
        patients.unshift({
          display_name: `${profile.name.last}, ${profile.name.first}`,
          person_id: profile.person_id,
          roles: ['patient'],
          client_group_id: 'na'
        })
        roles.push('responsible_for'); 
      };

      if (mounted) {
        session.session_id = 'v21.11.9~' + session.session_id;
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
