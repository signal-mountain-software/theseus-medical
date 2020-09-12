import { SET_MODE } from './actions';

export default (state, action) => {
  const { type, payload } = action;
  switch (type) {
    case SET_MODE:
      return { ...state, mode: payload };
    default:
      return state;
  }
};
