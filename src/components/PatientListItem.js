import React from 'react';
import { useSnackbar } from 'notistack';
import { Storage } from 'aws-amplify';
import Avatar from '@material-ui/core/Avatar';
import ListItem from '@material-ui/core/ListItem';
import ListItemAvatar from '@material-ui/core/ListItemAvatar';
import ListItemText from '@material-ui/core/ListItemText';
import FaceIcon from '@material-ui/icons/Face';

export default ({ patientId, patientDisplayName, selected, onClick }) => {
  const [picture, setPicture] = React.useState('');
  const { enqueueSnackbar } = useSnackbar();

  React.useEffect(() => {
    (async () => {
      if (patientId) {
        const response = await Storage.get('patients/' + patientId + '.jpg').catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when retrieving public object from s3: ${error.message}`, {
            variant: 'error',
          });
        });

        setPicture(response);
      }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ListItem selected={selected === patientId} onClick={onClick} button>
      <ListItemAvatar>
        {patientId ? (
          <Avatar src={picture}>
            <FaceIcon />
          </Avatar>
        ) : (
          <Avatar>
            <FaceIcon />
          </Avatar>
        )}
      </ListItemAvatar>
      <ListItemText>{patientDisplayName}</ListItemText>
    </ListItem>
  );
};
