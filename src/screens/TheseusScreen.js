import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import Box from '@material-ui/core/Box';

import ActivitySection from '../components/ActivitySection';
import FactSection from '../components/FactSection';
import { getSessionWithPatient } from '../graphql/queries';

export default () => {
  const [patient, setPatient] = React.useState(null);

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

  return (
    <Box>
      <ActivitySection patient={patient} />
      <FactSection patient={patient} />
    </Box>
  );
};
