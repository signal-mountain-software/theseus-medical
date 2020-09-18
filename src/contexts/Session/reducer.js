import { SET_PATIENT, SET_PATIENTS, SET_ROLES, SET_SESSION, SET_USER } from './actions';

export default (state, action) => {
  const { type, payload } = action;
  switch (type) {
    case SET_PATIENT:
      return { ...state, patient: payload };
    case SET_PATIENTS:
      return { ...state, patients: payload };
    case SET_ROLES:
      return { ...state, roles: payload };
    case SET_SESSION:
      return { ...state, session: payload };
    case SET_USER:
      return { ...state, user: payload };
    default:
      return state;
  }
};
