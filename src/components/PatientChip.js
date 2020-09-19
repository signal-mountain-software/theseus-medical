import React from 'react';
import { useHistory } from 'react-router-dom';
import { Storage } from 'aws-amplify';
import { useSnackbar } from 'notistack';
import Avatar from '@material-ui/core/Avatar';
import Box from '@material-ui/core/Box';
import Chip from '@material-ui/core/Chip';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import FaceIcon from '@material-ui/icons/Face';

import PatientDialog from './dialogs/PatientDialog';

export default ({ patient, session }) => {
  const [picture, setPicture] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const history = useHistory();
  const { enqueueSnackbar } = useSnackbar();

  const onClick = () => {
    if (session.patient_id) {
      setOpen(true);
    } else {
      history.push('/profile');
    }
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
      {patient && session ? (
        <>
          <Tooltip
            title={
              <Typography variant='subtitle1'>
                {session.patient_id ? 'View current patient' : 'View your profile'}
              </Typography>
            }
            placement='bottom-start'>
            <Chip
              color='primary'
              label={`${patient.name.last}, ${patient.name.first}`}
              variant='outlined'
              avatar={
                <Avatar src={picture}>
                  <FaceIcon />
                </Avatar>
              }
              onClick={onClick}
              clickable
            />
          </Tooltip>
          <PatientDialog
            patient={patient}
            picture={picture}
            open={open}
            onClose={() => {
              setOpen(false);
            }}
          />
        </>
      ) : (
        <Chip
          color='primary'
          label='Loading patient...'
          variant='outlined'
          avatar={
            <Avatar>
              <FaceIcon />
            </Avatar>
          }
        />
      )}
    </Box>
  );
};
