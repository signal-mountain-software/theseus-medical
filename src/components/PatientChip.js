import React from 'react';
import { Storage } from 'aws-amplify';
import Avatar from '@material-ui/core/Avatar';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import FaceIcon from '@material-ui/icons/Face';

import { SHOW_SNACKBAR } from '../contexts/Snackbar/actions';
import useSnackbar from '../hooks/useSnackbar';

export default ({ patient }) => {
  const [picture, setPicture] = React.useState('');
  const { dispatch } = useSnackbar();

  React.useEffect(() => {
    (async () => {
      if (patient) {
        const response = await Storage.get('patients/' + patient.person_id + '.jpg').catch(error => {
          dispatch({
            type: SHOW_SNACKBAR,
            payload: {
              message: `Whoops! Something went wrong when retrieving public object from s3: ${error.message}`,
              anchor: { vertical: 'bottom' },
              direction: 'up',
            },
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
    </Box>
  );
};
