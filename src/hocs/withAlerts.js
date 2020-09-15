import React from 'react';
import Box from '@material-ui/core/Box';
import IconButton from '@material-ui/core/IconButton';
import Slide from '@material-ui/core/Slide';
import Snackbar from '@material-ui/core/Snackbar';
import CloseIcon from '@material-ui/icons/Close';

import { HIDE_SNACKBAR } from '../contexts/Snackbar/actions';
import useSnackbar from '../hooks/useSnackbar';

export default Component => props => {
  const { state, dispatch } = useSnackbar();
  const { open, message, anchor, direction } = state;

  const handleClose = (event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    dispatch({ type: HIDE_SNACKBAR });
  };

  return (
    <Box>
      <Snackbar
        color='inherit'
        open={open}
        message={message}
        anchorOrigin={anchor}
        autoHideDuration={6000}
        action={
          <IconButton color='inherit' size='small' onClick={handleClose}>
            <CloseIcon fontSize='small' />
          </IconButton>
        }
        TransitionComponent={Slide}
        TransitionProps={{ direction }}
        onClose={handleClose}
      />
      <Component {...props} />
    </Box>
  );
};
