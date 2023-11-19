import { SET_PATIENT, SET_PATIENTS, SET_MESSAGE_TARGETS, SET_PROFILE, SET_GROUPS, SET_PRELOADS, SET_CALENDAR, SET_ROLES, SET_SESSION, SET_ACCESSLIST, SET_USER } from './actions';

export default (state, action) => {
  const { type, payload } = action;
  switch (type) {
    case SET_PATIENT:
      return { ...state, patient: payload };
    case SET_PATIENTS:
      return { ...state, patients: payload };
    case SET_ACCESSLIST:
      return { ...state, accessList: payload };
    case SET_MESSAGE_TARGETS:
      return { ...state, message_targets: payload };
    case SET_PROFILE:
      return { ...state, profile: payload };
    case SET_GROUPS:
      return { ...state, groups: payload };
    case SET_PRELOADS:
      return { ...state, preloads: payload };
    case SET_CALENDAR:
      return { ...state, calendar: payload };
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
