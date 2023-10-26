import React from 'react';
import CssBaseline from '@material-ui/core/CssBaseline';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { ThemeProvider, unstable_createMuiStrictModeTheme } from '@material-ui/core/styles';

import useDarkMode from '../hooks/useDarkMode';
import { SET_MODE } from '../contexts/DarkMode/actions';

export default Component => props => {
  const { state, dispatch } = useDarkMode();
  const { mode } = state;        
  //TEMPORARY FIX TO FORCE LIGHT MODE
  //const { dispatch } = useDarkMode();
  //const mode = 'light';
  const theme = React.useMemo(
    () =>
      unstable_createMuiStrictModeTheme({
        palette: {
          type: mode,
          primary: {
            light: '#a6d4fa',
            main: '#90caf9',
            dark: '#648dae',
          },
          secondary: {
            light: '#f6a5c0',
            main: '#f48fb1',
            dark: '#aa647b',
          },
          confirm: {
            light: '#3bd12a',
            main: '#44f230',
            dark: '#459130',
          },
          reject: {
            light: '#f70531',
            main: '#d10228',
            dark: '#ad0322',
          },
          error: {
            light: '#e57373',
            main: '#f44336',
            dark: '#d32f2f',
          },
          warning: {
            light: '#ffb74d',
            main: '#ff9800',
            dark: '#f57c00',
          },
          info: {
            light: '#64b5f6',
            main: '#2196f3',
            dark: '#1976d2',
          },
          success: {
            light: '#81c784',
            main: '#4caf50',
            dark: '#388e3c',
          },
        },
      }),
    [mode]
  );

  let prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  //let prefersDarkMode = false;
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
