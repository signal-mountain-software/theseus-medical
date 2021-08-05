import React from 'react';
import Box from '@material-ui/core/Box';

import PatientDialog from '../components/dialogs/PatientDialog';
import { Storage } from 'aws-amplify';

import useSession from '../hooks/useSession';

export default () => {
  const { state } = useSession();
  const { patient } = state;
  const [picture, setPicture] = React.useState('');
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      if (patient) {
        const response = await Storage.get('patients/' + patient.person_id + '.jpg').catch(error => {
          console.log(`Whoops! Something went wrong when retrieving public object from s3: ${error.errors[0].message}`);
        });
        setPicture(response);
      }
    })();
  }, [patient]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      <PatientDialog
            patient={patient}
            picture={picture}
            open={open}
            onClose={() => {
              setOpen(false);
            }}
          />
    </Box>
  );
};
