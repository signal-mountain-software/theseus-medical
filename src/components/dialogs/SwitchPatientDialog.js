import React from 'react';
import { useSnackbar } from 'notistack';
import { API, graphqlOperation } from 'aws-amplify';
import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import List from '@material-ui/core/List';
import Paper from '@material-ui/core/Paper';

import { Lambda } from 'aws-sdk';

import { updateSession } from '../../graphql/mutations';
import { getPerson } from '../../graphql/queries';
import { SET_PATIENT, SET_SESSION, SET_PATIENTS } from '../../contexts/Session/actions';
import useSession from '../../hooks/useSession';
import PersonFilter from '../forms/PersonFilter';

export default ({ open, roles, onClose }) => {
  // const [selected, setSelected] = React.useState(null);
  const [callPending, setCallPending] = React.useState(false);

  const { enqueueSnackbar } = useSnackbar();
  const { state, dispatch } = useSession();
  const { patients, session, profile } = state;

  const lambda = new Lambda({
    region: 'us-east-1',
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY,
  });

  const getPeopleList = async (pClient, pGroup) => {
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
    };
    let invokeFailed = false;
    let lambdaPayload = {
      action: "get_group_members",
      clientId: pClient,
      request: {
        "group_id": pGroup,
      }
    };
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance';
    params.Payload = JSON.stringify(lambdaPayload);
    setCallPending(true);
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        console.log('Call failed.  Error is', JSON.stringify(err));
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let groupMemberList = JSON.parse(fResp.Payload);
      if (groupMemberList.status === 200) {
        setCallPending(false);
        return (groupMemberList.body.map(p => {
          return `${p.name.last.trim()}, ${p.name.first.trim()}:${p.person_id}:${p.search_data}`;
        }));
      }
    };
    setCallPending(false);
    return [];
  };

  const getGroupsManaged = async (pClient, pPerson) => {
    let params = {
      FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance',
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
    };
    let invokeFailed = false;
    params.Payload = JSON.stringify({
      action: "get_groups_responsible_for",
      clientId: pClient,
      request: {
        "person_id": pPerson,
      }
    });
    params.FunctionName = 'arn:aws:lambda:us-east-1:125549937716:function:GroupMemberMaintenance';
    const fResp = await lambda
      .invoke(params)
      .promise()
      .catch(err => {
        enqueueSnackbar(`AVA encountered an error while retrieving Group list.  Error is ${err.message}`, {
          variant: 'error'
        });
        invokeFailed = true;
      });
    if (!invokeFailed) {
      let groupsManagedReturn = JSON.parse(fResp.Payload);
      if (groupsManagedReturn.status === 200) {
        return groupsManagedReturn.body;
      }
    };
    return [];
  };

  React.useEffect(() => {
    let getPatients = (
      async () => {
        if ((!patients || (patients.length === 0)) && !callPending) {
          // get a group of patients a user is responsible for
          let responsibleList = [];
          if (session.responsible_for) {
            let respArray = [];
            if (Array.isArray(session.responsible_for)) { respArray.push(...session.responsible_for); }
            else if (session.responsible_for.startsWith('[')) { respArray = session.responsible_for.replace(/[[\s\]]/g, '').split(','); }
            else { respArray.push(session.responsible_for); }
            if (respArray.length > 0) {
              if (respArray.some(g => { return g.toLowerCase() === '*all'; })) {   // case insensitive array search
                responsibleList = await getPeopleList(session.client_id, '*all');
              }
              else {
                responsibleList = await getGroupsManaged(session.client_id, session.patient_id);
              };
              let myInfo = `${profile.name.last}, ${profile.name.first}:${profile.person_id}:${profile.search_data}`;
              if (responsibleList && responsibleList.length > 0 && (responsibleList[0].split(':')[1] !== profile.person_id)) {
                responsibleList.unshift(myInfo);
              }
              else {  responsibleList = [myInfo] }  
              dispatch({ type: SET_PATIENTS, payload: responsibleList });
            }
          };
        }
      }
    );
    getPatients();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (session) {
      // const { patient_id, patient_display_name } = session;
      // setSelected({ patient_id, patient_display_name });
    }
    onClose();
  };

  const handleConfirmation = (newPatient) => {
    (async () => {

      if (session) {
        const result1 = await API.graphql(
          graphqlOperation(updateSession, { input: { session_id: session.user_id, patient_id: newPatient.split(':')[1] } })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching a session: ${error.errors[0].message}`, {
            variant: 'error',
          });
        });

        const result2 = await API.graphql(
          graphqlOperation(getPerson, {
            person_id: result1.data.updateSession.patient_id || result1.data.updateSession.user_id,
          })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching a patient by session: ${error.errors[0].message}`, {
            variant: 'error',
          });
        });

        dispatch({ type: SET_SESSION, payload: result1.data.updateSession });
        dispatch({ type: SET_PATIENT, payload: result2.data.getPerson });
      }
      let jumpTo = window.location.href.replace('refresh', 'theseus');
      window.location.replace(jumpTo);
      //    onClose();
    })();
  };

  React.useEffect(() => {
    if (session) {
      // const { patient_id, patient_display_name } = session;
      // setSelected({ patient_id, patient_display_name });
    }
  }, [session]);

  return (
    <Dialog open={open} onClose={handleClose}>
      {patients &&
        <Box p={3}>
          <Paper component={Box} variant='outlined' width='100%' maxHeight={256} overflow='auto' square>
            <List component='nav'>
              {(patients.length > 0) &&
                <PersonFilter
                  prompt={'Switch to which account?'}
                  peopleList={patients}
                  onCancel={() => {
                    onClose();
                  }}
                  onSelect={(selectedPerson) => {
                    handleConfirmation(selectedPerson);
                  }}
                  showID={true}
                />
              }
            </List>
          </Paper>
        </Box>
      }
    </Dialog>
  );
};
