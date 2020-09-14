import React from 'react';
import CssBaseline from '@material-ui/core/CssBaseline';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { ThemeProvider, unstable_createMuiStrictModeTheme } from '@material-ui/core/styles';

import { SET_MODE } from '../contexts/DarkMode/actions';
import useDarkMode from '../hooks/useDarkMode';

export default Component => props => {
  const { state, dispatch } = useDarkMode();
  const { mode } = state;
  const theme = React.useMemo(
    () =>
      unstable_createMuiStrictModeTheme({
        palette: {
          type: mode,
        },
      }),
    [mode]
  );

  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  React.useEffect(() => {
    const localTheme = localStorage.getItem('theseus-medical-theme');
    const initial = localTheme || (prefersDarkMode ? 'dark' : 'light');
    dispatch({ type: SET_MODE, payload: initial });
  }, [dispatch, prefersDarkMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Component {...props} />
    </ThemeProvider>
  );
};
