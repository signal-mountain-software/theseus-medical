import React from 'react';
import { Storage } from 'aws-amplify';
import { useSnackbar } from 'notistack';
import Avatar from '@material-ui/core/Avatar';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import FaceIcon from '@material-ui/icons/Face';

import PatientDialog from './PatientDialog';

export default ({ patient }) => {
  const [picture, setPicture] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const onClick = () => {
    setOpen(true);
  };

  React.useEffect(() => {
    (async () => {
      if (patient) {
        const response = await Storage.get('patients/' + patient.person_id + '.jpg').catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when retrieving public object from s3: ${error.message}`, {
            variant: 'error',
          });
        });

        setPicture(response);
      }
    })();
  }, [patient]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Box>
      {patient ? (
        <Chip
          color='primary'
          label={`${patient?.name.last}, ${patient?.name.first}`}
          variant='outlined'
          avatar={<Avatar src={picture} />}
          onClick={onClick}
          clickable
        />
      ) : (
        <Chip
          color='primary'
          label='Choose a patient (not yet implemented)'
          variant='outlined'
          icon={<FaceIcon />}
          clickable
        />
      )}
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
