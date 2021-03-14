import React from 'react';
import { RecoilRoot } from 'recoil';

export default Component => props => (
  <RecoilRoot>
    <Component {...props} />
  </RecoilRoot>
);
