import React from 'react';
import { SnackbarProvider } from 'notistack';
import Button from '@material-ui/core/Button';
// import useMediaQuery from '@material-ui/core/useMediaQuery';

export default Component => props => {
  const notistackRef = React.createRef();

  const onCLickDismiss = key => () => {
    notistackRef.current.closeSnackbar(key);
  };

  return (
    <SnackbarProvider
      ref={notistackRef}
      maxSnack={3}
      dense={false}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'center',
      }}
      action={key => (
        <Button color='inherit' onClick={onCLickDismiss(key)}>
          Dismiss
        </Button>
      )}>
      <Component {...props} />
    </SnackbarProvider>
  );
};
