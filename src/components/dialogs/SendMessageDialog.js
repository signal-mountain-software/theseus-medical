import React from 'react';
import Box from '@material-ui/core/Box';
import Dialog from '@material-ui/core/Dialog';
import List from '@material-ui/core/List';
import Paper from '@material-ui/core/Paper';

import { SET_MESSAGE_TARGETS } from '../../contexts/Session/actions';
import useSession from '../../hooks/useSession';
import PersonFilter from '../forms/PersonFilter';

const AWS = require('aws-sdk');
const dbClient = new AWS.DynamoDB.DocumentClient({
  apiVersion: '2012-08-10',
  region: "us-east-1",
  accessKeyId: process.env.REACT_APP_AVA_ID,
  secretAccessKey: process.env.REACT_APP_AVA_KEY
});

export default ({ open, onClose, onSelect }) => {

  const { state, dispatch } = useSession();
  const { message_targets, session, profile } = state;

  const getPeopleList = async (pClient, pGroupArray) => {
    let queryExpression = {
      KeyConditionExpression: 'client_id = :c',
      ExpressionAttributeValues: { ':c': pClient },
      ExpressionAttributeNames: { '#n': 'name', '#f': 'first', '#l': 'last' },
      TableName: "People",
      IndexName: "client_id-index",
      ProjectionExpression: "person_id, #n.#f, #n.#l, search_data, messaging, groups"
    };
    var peopleRecs = await dbClient
      .query(queryExpression)
      .promise()
      .catch(error => {
        console.log({ 'Bad query on People in getGroupMembers - caught error is': error });
      });
    if (!recordExists(peopleRecs)) { return []; }
    let allPeople = (pGroupArray.find(g => { return (g.toLowerCase() === '*all'); }));
    let returnArray = [];
    peopleRecs.Items.forEach(p => {
      if (allPeople || (p.groups && p.groups.some(g => pGroupArray.includes(g)))) {
        returnArray.push((`${p.name?.last}, ${p.name?.first}:${p.person_id}:${p.search_data} ${((typeof p.messaging) === 'object') ? JSON.stringify(p.messaging) : ''}`).trim());
      }
    });
    return returnArray.sort();
  };


  async function getGroupInfo(pClient, pGroupArray) {
    if (pGroupArray.length === 0) { return []; }
    let batchGetRequest = {
      RequestItems: {
        'Groups': {
          Keys: []
        }
      }
    };
    [...new Set(pGroupArray)].forEach(g => {
      batchGetRequest.RequestItems.Groups.Keys.push(
        {
          client_id: pClient,
          group_id: g
        }
      );
    });
    let groupRecs = await dbClient
      .batchGet(batchGetRequest)
      .promise()
      .catch(error => {
        console.log({ 'Bad get on Groups - caught error is': error });
      });
    let returnArray = [];
    if (groupRecs && ('Responses' in groupRecs)) {
      groupRecs.Responses.Groups.forEach(gRec => {
        returnArray.push(`${gRec.name}:GRP//${pClient}/${gRec.group_id}`);
      });
    }
    return returnArray;
  }

  React.useEffect(() => {
    let getTargets = (     // get a list of people a user may send messages to: 
      async () => {
        if (!message_targets || (message_targets.length === 0)) {

          // if user is proxy for someone, get the proxied person's responsibilities... 
          if (session.patient_id !== session.user_id) {
            let sessionRec = await dbClient
              .get({
                Key: { session_id: session.patient_id },
                TableName: "SessionsV2",
                ProjectionExpression: "responsible_for, groups_managed"
              })
              .promise()
              .catch(async (error) => {
                console.log({ 'Bad get on Session - caught error is': error });
              });
            if (recordExists(sessionRec)) {
              session.responsible_for = sessionRec.Item.responsible_for;
              session.groups_managed = sessionRec.Item.groups_managed;
            }
          }

          // for groups you are responsible for, you can message the group as a whole...
          let responsibleList = [];
          let respArray = [];
          if (session.responsible_for) {
            if (Array.isArray(session.responsible_for)) { respArray.push(...session.responsible_for); }
            else if (session.responsible_for.startsWith('[')) { respArray = session.responsible_for.replace(/[[\s\]]/g, '').split(','); }
            else { respArray.push(session.responsible_for); }
          };
          if (session.groups_managed) {
            session.groups_managed.forEach(gM => {
              respArray.push(gM.split('~')[1].trim());
            });
          }
          responsibleList.push(...await getGroupInfo(profile.client_id, respArray));

          // you can message any individual in a group that you are responsible for OR are a member of
          respArray.push(...profile.groups);
          if (respArray.length > 0) {
            responsibleList.push(...await getPeopleList(profile.client_id, respArray));
            dispatch({ type: SET_MESSAGE_TARGETS, payload: responsibleList.sort() });
          }
        }
      }
    );
    getTargets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    if (session) {
      // const { patient_id, patient_display_name } = session;
      // setSelected({ patient_id, patient_display_name });
    }
    onClose();
  };

  /*
    const handleConfirmation = (newPatient) => {
      (async () => {
  
        if (session) {
          let [pName, pID] = newPatient.split(':');
          session.patient_id = pID;
          let ans = pName.split(',');
          switch (ans.length) {
            case 3: {
              session.patient_display_name = `${ans[2].trim()} ${ans[0].trim()}, ${ans[1].trim()}`;
              break;
            }
            case 2: {
              if (ans[1].startsWith('group=')) { session.patient_display_name = ''; }
              else { session.patient_display_name = `${ans[1].trim()} ${ans[0].trim()}`; }
              break;
            }
            default: { session.patient_display_name = ans[0].trim(); }
          }
          await dbClient
            .update({
              Key: { session_id: session.user_id },
              UpdateExpression: 'set patient_id = :p, patient_display_name = :d',
              ExpressionAttributeValues: {
                ':p': session.patient_id,
                ':d': session.patient_display_name
              },
              TableName: "SessionsV2",
            })
            .promise()
            .catch(error => { console.log(`caught error updating SessionsV2; error is:`, error); });
          let personRec = await dbClient
            .get({
              Key: { person_id: (session.patient_id || session.user_id) },
              TableName: "People"
            })
            .promise()
            .catch(error => { console.log(`caught error getting People record; error is:`, error); });
          if (recordExists(personRec)) {
            dispatch({ type: SET_PATIENT, payload: personRec.Item });
          }
          dispatch({ type: SET_SESSION, payload: session });
        }
        let jumpTo = window.location.href.replace('refresh', 'theseus');
        window.location.replace(jumpTo);
        //    onClose();
      })();
    };
  */

  function recordExists(recordId) {
    if (!recordId) { return false; }
    if (recordId.hasOwnProperty('Count')) { return (recordId.Count > 0); }
    else { return ((recordId.hasOwnProperty("Item") || recordId.hasOwnProperty("Items"))); }
  }

  return (
    <Dialog open={open} onClose={handleClose}>
      {message_targets &&
        <Box p={3}>
          <Paper component={Box} variant='outlined' width='100%' maxHeight={256} overflow='auto' square>
            <List component='nav'>
              {(message_targets.length > 0) &&
                <PersonFilter
                  prompt={'Send a message to...?'}
                  peopleList={message_targets}
                  onCancel={() => {
                    onClose();
                  }}
                  onSelect={(selectedPerson) => {
                    open = false;
                    onSelect(selectedPerson);
                  }}
                  allowRandom={true}
                />
              }
            </List>
          </Paper>
        </Box>
      }
    </Dialog>
  );
};
