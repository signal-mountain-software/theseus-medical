import React from 'react';
import { DarkModeContext } from '../contexts/DarkMode';

export default () => {
  const context = React.useContext(DarkModeContext);
  if (context === undefined) {
    throw new Error('useDarkMode must be used within a DarkModeProvider');
  }
  return context;
};
