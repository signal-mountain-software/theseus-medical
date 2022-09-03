import React from 'react';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';

export default ({ patient, selected, onClick }) => {
  const { patient_id, patient_display_name } = patient;

  React.useEffect(() => {
    (async () => {
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ListItem selected={selected.patient_id === patient_id} onClick={onClick} button>
      <ListItemText>{patient_display_name} ({patient_id})</ListItemText>
    </ListItem>
  );
};
