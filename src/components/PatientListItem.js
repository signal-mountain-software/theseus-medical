import React from 'react';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';

export default ({ patient, selected, onClick }) => {
  const { patient_id, patient_display_name } = patient;

  React.useEffect(() => {
    (async () => {
  /*    if (patient_id) {
        const response = await Storage.get('patients/' + patient_id + '.jpg').catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when retrieving public object from s3: ${error.errors[0].message}`, {
            variant: 'error',
          });
        });

        setPicture(response);
      }  */
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ListItem selected={selected.patient_id === patient_id} onClick={onClick} button>
      <ListItemText>{patient_display_name} ({patient_id})</ListItemText>
    </ListItem>
  );
};
