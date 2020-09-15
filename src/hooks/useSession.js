import React from 'react';
import { SessionContext } from '../contexts/Session';

export default () => {
  const context = React.useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
