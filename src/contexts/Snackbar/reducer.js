import { SHOW_SNACKBAR, HIDE_SNACKBAR } from './actions';

export default (state, action) => {
  const { type, payload } = action;
  switch (type) {
    case SHOW_SNACKBAR:
      return {
        ...state,
        open: true,
        message: payload.message,
        anchor: { ...state.anchor, ...payload.anchor },
        direction: payload.direction,
      };
    case HIDE_SNACKBAR:
      return {
        ...state,
        open: false,
      };
    default:
      return state;
  }
};
