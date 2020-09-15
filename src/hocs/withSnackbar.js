import React from 'react';
import SnackbarProvider from '../contexts/Snackbar';

export default Component => props => (
  <SnackbarProvider>
    <Component {...props} />
  </SnackbarProvider>
);
