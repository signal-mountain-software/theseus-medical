import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import useMediaQuery from '@material-ui/core/useMediaQuery';

import { getActivityData, getSessionWithPatient } from '../graphql/queries';

export default () => {
  const [patient, setPatient] = React.useState(null);
  const [facts, setFacts] = React.useState([]);
  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs'));

  React.useEffect(() => {
    (async () => {
      const result = await API.graphql(
        graphqlOperation(getSessionWithPatient, { client_id: 'SMSoft', device_id: 'TESTDEVICE' })
      ).catch(error => {
        alert(`Whoops! Something went wrong when fetching a patient by session: ${error.message}`);
      });
      setPatient(result.data.getSessionWithPatient.patient);
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      if (patient) {
        const result = await API.graphql(
          graphqlOperation(getActivityData, {
            input: { client_id: 'SMSoft', person_id: patient.person_id, fact_data: true },
          })
        ).catch(error => {
          alert(`Whoops! Something went wrong when fetching activity data: ${JSON.stringify(error)}`);
        });
        setFacts(result.data.getActivityData);
        console.log(result.data.getActivityData);
      }
    })();
  }, [patient]);

  return (
    <Paper component={Box} m={2}>
      <Box mt={1} py={isMobile ? 2.25 : 1.25} px={3} borderBottom={2} display='flex' flexDirection='row'>
        <Box flexGrow={1} display='flex' flexDirection='row' alignItems='center'>
          <Typography variant='subtitle1'>Facts</Typography>
        </Box>
      </Box>
      <Box p={3} flexGrow={1}>
        <Typography variant='h1'>Facts</Typography>
      </Box>
    </Paper>
  );
};
