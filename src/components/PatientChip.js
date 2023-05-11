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

export default ({ patient, roles, session }) => {
  const [picture, setPicture] = React.useState('');
  const [reactData, setReactData] = React.useState({
    openPeopleEdit: false,
    groupData: {}
  })

  const history = useHistory();
  const { enqueueSnackbar } = useSnackbar();

  const onClick = async () => {
    if (!session?.kiosk_mode) {
      if (session.patient_id) {
        reactData.openPeopleEdit = true;
        reactData.groupData = await getAllGroups(session.patient_id);
        setReactData(reactData);
      } else {
        history.push('/theseus');
      }
    }
  };


  async function getAllGroups(pPatient) {
    let responseData = {};
    responseData.adminHierarchy = await getGroupHierarchy(session.client_id, { sort: true });
    for (let g = 0; g < responseData.adminHierarchy.length; g++) {
      if (responseData.adminHierarchy[g].selectable && isMemberOf(pPatient, responseData.adminHierarchy[g].id)) {
        responseData.selectedID = responseData.adminHierarchy[g].id;
      }
    }
    responseData.publicGroups = await getPublicGroupList(session.client_id, pPatient);
    responseData.privateGroups = await getGroupsBelongTo(pPatient);
    return responseData;
  };

  React.useEffect(() => {
    (async () => {
      if (patient) {
        const response = await Storage.get('patients/' + patient.person_id + '.jpg').catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when retrieving public object from s3: ${error.errors[0].message}`, {
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
              <Typography variant='caption'>
                {session?.kiosk_mode ? 'View/Update not available' : 'View/Update this Profile'}
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
          {reactData.openPeopleEdit &&
            <PatientDialog
              patient={patient}
            picture={picture}
            groupData={reactData.groupData}
              open={reactData.openPeopleEdit}
              onClose={() => {
                reactData.openPeopleEdit = false;
                setReactData(reactData);
              }}
            />
          }
        </>
      ) : (
        <Chip
          color='primary'
          label='Loading profile...'
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
