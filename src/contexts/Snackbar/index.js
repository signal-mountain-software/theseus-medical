import React from 'react';
import reducer from './reducer';

const initialState = {
  open: false,
  message: 'This is the default snackbar message.',
  anchor: {
    vertical: 'bottom',
    horizontal: 'center',
  },
  direction: 'up',
};

export const SnackbarContext = React.createContext(initialState);

export default ({ children }) => {
  const [state, dispatch] = React.useReducer(reducer, initialState);
  return <SnackbarContext.Provider value={{ state, dispatch }}>{children}</SnackbarContext.Provider>;
};
