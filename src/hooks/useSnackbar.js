import React from 'react';
import { SnackbarContext } from '../contexts/Snackbar';

export default () => {
  const context = React.useContext(SnackbarContext);
  if (context === undefined) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
};
