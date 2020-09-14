import React from 'react';
import DarkModeProvider from '../contexts/DarkMode';

export default Component => props => (
  <DarkModeProvider>
    <Component {...props} />
  </DarkModeProvider>
);
