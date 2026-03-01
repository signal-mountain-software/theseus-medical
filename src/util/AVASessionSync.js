import { SET_ACCESSLIST, SET_PATIENT, SET_PROFILE, SET_SESSION, SET_USER } from '../contexts/Session/actions';

const replacePersonInList = (list = [], personRec = {}) => {
  const person_id = personRec?.person_id;
  if (!person_id || !Array.isArray(list)) {
    return { list, changed: false };
  }

  let changed = false;
  const nextList = list.map((listRec) => {
    if (listRec?.person_id !== person_id) {
      return listRec;
    }
    changed = true;
    return Object.assign({}, listRec, personRec);
  });

  return {
    list: changed ? nextList : list,
    changed,
  };
};

export const syncPersonToSessionCaches = ({ state, dispatch, personRec }) => {
  if (!dispatch || !state || !personRec?.person_id) {
    return false;
  }

  const person_id = personRec.person_id;

  let accessChanged = false;
  if (state.accessList && typeof state.accessList === 'object') {
    const nextAccessList = Object.assign({}, state.accessList);

    Object.keys(nextAccessList).forEach((clientKey) => {
      const clientRec = nextAccessList[clientKey];
      if (!Array.isArray(clientRec?.list)) {
        return;
      }
      const replaced = replacePersonInList(clientRec.list, personRec);
      if (replaced.changed) {
        accessChanged = true;
        nextAccessList[clientKey] = Object.assign({}, clientRec, {
          list: replaced.list
        });
      }
    });

    if (accessChanged) {
      dispatch({ type: SET_ACCESSLIST, payload: nextAccessList });
    }
  }

  let sessionChanged = false;
  if (Array.isArray(state.session?.last_state?.list)) {
    const replacedLastState = replacePersonInList(state.session.last_state.list, personRec);
    if (replacedLastState.changed) {
      sessionChanged = true;
      dispatch({
        type: SET_SESSION,
        payload: Object.assign({}, state.session, {
          last_state: Object.assign({}, state.session.last_state, {
            list: replacedLastState.list
          })
        })
      });
    }
  }

  if (state.patient?.person_id === person_id) {
    dispatch({ type: SET_PATIENT, payload: Object.assign({}, state.patient, personRec) });
  }
  if (state.profile?.person_id === person_id) {
    dispatch({ type: SET_PROFILE, payload: Object.assign({}, state.profile, personRec) });
  }
  if (state.user?.person_id === person_id) {
    dispatch({ type: SET_USER, payload: Object.assign({}, state.user, personRec) });
  }

  return (accessChanged || sessionChanged || (state.patient?.person_id === person_id) || (state.profile?.person_id === person_id) || (state.user?.person_id === person_id));
};
