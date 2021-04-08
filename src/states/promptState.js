import { atom } from 'recoil';

const promptState = atom({
  key: 'promptState',
  default: null,
});

export default promptState;
