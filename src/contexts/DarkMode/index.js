import React from 'react';
import reducer from './reducer';

const initialState = {
  mode: 'dark',
};

export const DarkModeContext = React.createContext(initialState);

export default ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  return <DarkModeContext.Provider value={{ state, dispatch }}>{children}</DarkModeContext.Provider>;
};
