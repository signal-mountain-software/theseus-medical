import React from 'react';
import { useSnackbar } from 'notistack';
import { API, Auth, graphqlOperation } from 'aws-amplify';

import useSession from '../hooks/useSession';
// import { getGroup } from '../graphql/queries';
import { getPerson, getRoles, getSession, getCustomizations } from '../graphql/queries';
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
      console.log(JSON.stringify(error));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function onValidUser(user) {
    try {
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
        getSessionResult = await API
          .graphql(graphqlOperation(getSession, { session_id: user.username }))
          .catch(error => {
            if (error.message === 'Network Error' || error.errors[0].message === 'Network Error') {
              enqueueSnackbar(`You aren't connected to the Internet!`, {
                variant: 'error', persist: true,
              });
            }
            else {
              enqueueSnackbar(`Welcome to AVA, ${user.username}! Please tap the Welcome button (the oval toward the top left of your screen).  That's where you'll be able to complete your account setup.
                Once that's complete, we'll get your account finalized right away.  No worries, though!  You can use many AVA features in the meantime while we personalize things for you.`, {
                variant: 'info', persist: true,
              });
            };
          });

        var session;

        var userInfo = await Auth
          .currentUserInfo()
          .catch(e => { console.log('Not logged in - or - network error'); });
        const default_client_id = userInfo?.attributes?.['custom:client'] || 'SMSoft';

        if (!getSessionResult) {
          usingDefaultSession = true;
          getSessionResult = await API
            .graphql(graphqlOperation(getSession, { session_id: `${default_client_id}~default` }))
            .catch(error => {
              enqueueSnackbar(`You may not be connected to the internet.  AVA requires a network connection.`, { variant: 'error', persist: true, });
              getSessionResult = null;
            });
          if (getSessionResult?.data) {
            session = getSessionResult.data.getSession;
            session.user_display_name = 'Welcome ' + user.username;
          }
        }
        else {
          session = getSessionResult.data.getSession;
          if (session?.user_id !== user.username) {
            enqueueSnackbar(`You are emulating ${session?.user_id}`, {
              variant: 'info',
            });
            let emulatingSession = await API
              .graphql(graphqlOperation(getSession, { session_id: getSessionResult.data.getSession.user_id }))
              .catch(error => {
                enqueueSnackbar(`Request to emulate ${getSessionResult.data.getSession.user_id} failed.  Using ${user.user_id} for this session.`, {
                  variant: 'info', persist: true,
                });
                emulatingSession = null;
              });
            if (emulatingSession) { session = emulatingSession.data.getSession; }
          }
          session.session_id = `v22.4.1${window.location.href.split('//')[1].slice(0, 1)}`;
        }

        // get person's Account information
        getProfileResult = await API
          .graphql(graphqlOperation(getPerson, { person_id: (session.user_id) }))
          .catch(error => {
            enqueueSnackbar(`You are user ID ${(usingDefaultSession ? user.username : session.user_id)}, but we couldn't get your info.  The problem is: ${error.errors[0].message}`, {
              variant: 'error', persist: true,
            });
            console.log('using default user...');
          });

        if (!getProfileResult) {
          getProfileResult = await API
            .graphql(graphqlOperation(getPerson, { person_id: `${default_client_id}~default` }))
            .catch(error => {
              console.log('using default session...');
            });
          usingDefaultSession = true;
        }

        if (usingDefaultSession) {
          getProfileResult.data.getPerson.messaging.email = user.attributes.email || null;
          getProfileResult.data.getPerson.messaging.sms = user.attributes.phone_number || null;
          getProfileResult.data.getPerson.messaging.voice = null;
          getProfileResult.data.getPerson.location = null;
          getProfileResult.data.getPerson.name.first = user.username;
          getProfileResult.data.getPerson.name.last = 'Welcome';
          getProfileResult.data.getPerson.clients = [{ "id": default_client_id, "groups": [`${default_client_id}_all`] }];
        }

        let profile = getProfileResult.data.getPerson;
        profile.groups = getProfileResult.data.getPerson.clients[0].groups;
        // var user_id = profile.person_id;

        // get the roles for the current user
        var roles;
        //    if (session.responsible_for === 'ALL') { roles = ['admin'] }
        //    else {
        const client_group_id = session.client_id + '~' + session.assigned_to;

        let getClientResult = await API
          .graphql(graphqlOperation(getCustomizations, { client_id: session.client_id, custom_key: 'logo' }))
          .catch(
            error => {
              console.log('logo not found for client ' + session.client_id);
            }
          );
        session.client_icon = getClientResult?.data?.getCustomizations?.icon || 'https://ava-icons.s3.amazonaws.com/AVA-logo.jpg';

        let getSearchCustomizationResult = await API
          .graphql(graphqlOperation(getCustomizations, { client_id: session.client_id, custom_key: 'search_terms' }))
          .catch(
            error => {
              console.log('no search Customizations found for ' + session.client_id);
            }
          );
        let customization_value = getSearchCustomizationResult?.data?.getCustomizations?.customization_value;
        session.search_terms = customization_value ? JSON.parse(customization_value) : {};

        // get the Client's information
        getRolesResult = await API
          .graphql(graphqlOperation(getRoles, { person_id: session.user_id, client_group_id }))
          .catch(
            error => {
              console.log('security record not found for user ' + session.user_id + ' (' + client_group_id + ')');
            }
          );
        roles = getRolesResult?.data?.getRoles || ['patient'];


        // get the current patient information for a user; if the user does not have a current patient, use the user's id
        // const patient_id = usingDefaultSession ? user.username : session.patient_id;
        var patient = {};
        if (profile.person_id === (session.patient_id || session.user_id)) {
          Object.assign(patient, profile);
        }
        else {
          getPatientResult = await API
            .graphql(graphqlOperation(getPerson, { person_id: (session.patient_id || session.user_id) }))
            .catch(error => {
              if (error.message === 'Network Error' || error.errors[0].message === 'Network Error') {
                enqueueSnackbar(`You aren't connected to the Internet!`, {
                  variant: 'error', persist: true,
                });
              }
            });
          if (!getPatientResult || !getPatientResult.data) {
            enqueueSnackbar(`You are trying to work with user ${session.patient_id || session.user_id}.  But that account doesn't exist.  Reverting to your own account.`, {
              variant: 'info', persist: false,
            });
            Object.assign(patient, profile);
          }
          else {
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
        }
        patient.groups = patient.clients[0].groups;
        if (usingDefaultSession) { patient.person_id = user.username; }

        // get a group of patients a user is responsible for
        let patients = [];

        if (session.responsible_for) {
          roles.push('responsible_for');  // remove this line when ready to fully depreciate OG switch account process
          /*  DEPRECIATED
                    let pArray = [];
                    let respArray = [];
                    if (Array.isArray(session.responsible_for)) { respArray.push(...session.responsible_for); }
                    else if (session.responsible_for.startsWith('[')) { respArray = session.responsible_for.replace(/[[\s\]]/g, '').split(','); }
                    else { respArray.push(session.responsible_for); }
                    if (respArray.length > 0) {
                      for (let r = 0; r < respArray.length; r++) {
                        let pRec = await API
                          .graphql(graphqlOperation(getPerson, { person_id: respArray[r] }))
                          .catch(
                            (err) => {
                              // console.log(`${respArray[r]} not found.  Trying Group table`);
                            });
                        if (pRec?.data?.getPerson) {
                          pArray.push({
                            display_name: `${pRec.data.getPerson.name.last}, ${pRec.data.getPerson.name.first}`,
                            person_id: pRec.data.getPerson.person_id,
                            roles: ['patient'],
                            client_group_id: 'na'
                          });
                          continue;
                        }
                        if (!respArray[r].includes('~')) { respArray[r] = session.client_id + '~' + respArray[r]; }
                        getPeopleByGroupResult = await API
                          .graphql(graphqlOperation(getGroup, { client_group_id: respArray[r] }))
                          .catch(
                            (error) => {
                              console.log(`Warning! We couldn't get the names of the people in the ${respArray[r]} group.  
                              Error is: ${error.errors[0].message}`);
                            }
                          );
                        if (getPeopleByGroupResult) {
                          pArray.push(...getPeopleByGroupResult.data.getGroup);
                        }
                      };
                      // sort resulting array and remove duplicates
                      let pSet = pArray.sort((a, b) => {
                        return (a.person_id > b.person_id ? 1 : -1);
                      });
                      let aSet = pSet.filter((e, x, a) => {
                        return (x === 0 || e.person_id !== a[x - 1].person_id);
                      });
                      patients = aSet.sort((a, b) => {
                        return (a.display_name > b.display_name ? 1 : -1);
                      });
                    }
          
                  }
                    if (patients.length > 0) {
                      patients.unshift({
                        display_name: `${profile.name.last}, ${profile.name.first}`,
                        person_id: profile.person_id,
                        roles: ['patient'],
                        client_group_id: 'na'
                      });
                      roles.push('responsible_for');
                    };
          */
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
    catch (err) {
      console.log('random catch', err);
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
