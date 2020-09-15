import React from 'react';
import SessionProvider from '../contexts/Session';

export default Component => props => (
  <SessionProvider>
    <Component {...props} />
  </SessionProvider>
);
