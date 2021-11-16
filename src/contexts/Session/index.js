import React from 'react';
import reducer from './reducer';

const initialState = {
  patient: null,
  patients: null,
  profile: null,
  roles: null,
  session: null,
  user: null,
  version: `v21.11.15${window.location.href.split('//')[1].slice(0, 1)}`
};

export const SessionContext = React.createContext(initialState);

export default ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  return <SessionContext.Provider value={{ state, dispatch }}>{children}</SessionContext.Provider>;
};
