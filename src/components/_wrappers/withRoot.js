import React from 'react';
import Root from '../Root';

const withRoot = Component => props => (
  <Root>
    <Component {...props} />
  </Root>
);

export default withRoot;
