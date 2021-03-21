import React from 'react';
import Root from '../components/Root';

const withRoot = Component => props => (
  <Root>
    <Component {...props} />
  </Root>
);

export default withRoot;
