import React from 'react';
import { useSnackbar } from 'notistack';
import { Storage } from 'aws-amplify';
import Avatar from '@material-ui/core/Avatar';
import ListItem from '@material-ui/core/ListItem';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import ListItemText from '@material-ui/core/ListItemText';
import FaceIcon from '@material-ui/icons/Face';

export default ({ patient, selected, onClick }) => {
  const [picture, setPicture] = React.useState('');
  const { enqueueSnackbar } = useSnackbar();
  const { patient_id, patient_display_name } = patient;

  React.useEffect(() => {
    (async () => {
      if (patient_id) {
        const response = await Storage.get('patients/' + patient_id + '.jpg').catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when retrieving public object from s3: ${error.message}`, {
            variant: 'error',
          });
        });

        setPicture(response);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ListItem selected={selected.patient_id === patient_id} onClick={onClick} button>
      <ListItemAvatar>
        {patient_id ? (
          <Avatar src={picture}>
            <FaceIcon style={{ width: '100%', height: '100%' }} />
          </Avatar>
        ) : (
          <Avatar>
            <FaceIcon style={{ width: '100%', height: '100%' }} />
          </Avatar>
        )}
      </ListItemAvatar>
      <ListItemText>{patient_display_name}</ListItemText>
    </ListItem>
  );
};
