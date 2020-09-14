import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import Box from '@material-ui/core/Box';

import { getSessionWithPatient } from '../graphql/queries';
import { SHOW_SNACKBAR } from '../contexts/Snackbar/actions';
import useSnackbar from '../hooks/useSnackbar';

export default () => {
  const [patient, setPatient] = React.useState(null);
  const [session, setSession] = React.useState(null);
  const { dispatch } = useSnackbar();

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      let result;
      result = await API.graphql(
        graphqlOperation(getSessionWithPatient, { client_id: 'SMSoft', device_id: 'TESTDEVICE' })
      ).catch(error => {
        dispatch({
          type: SHOW_SNACKBAR,
          payload: {
            message: `Whoops! Something went wrong when fetching a patient by session: ${error.message}`,
            anchor: { vertical: 'bottom' },
            direction: 'up',
          },
        });
      });

      if (mounted) {
        setPatient(result.data.getSessionWithPatient.patient);
        setSession(result.data.getSessionWithPatient.session);
      } else {
        API.cancel(result, 'ProfileScreen unmounted');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      {JSON.stringify(patient)}
      {JSON.stringify(session)}
    </Box>
  );
};
