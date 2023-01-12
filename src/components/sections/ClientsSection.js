import React from 'react';

import Box from '@material-ui/core/Box';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Checkbox from '@material-ui/core/Checkbox';
import Typography from '@material-ui/core/Typography';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';

import useSession from '../../hooks/useSession';

import Section from '../Section';

const useStyles = makeStyles(theme => ({
  container: {
    maxHeight: 400,
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
}));

export default ({ person, updateGroups, patientSession }) => {
 
  const classes = useStyles();
  const { state } = useSession();

  const [patientGroups, setPatientGroups] = React.useState([]);
  const [notMyFirstTime, setNotMyFirstTime] = React.useState(false);
  const [renderCount, setRenderCount] = React.useState(1);
  const [gNamesList, setGNamesList] = React.useState();
  const [gCodesList, setGCodesList] = React.useState();

  const AWS = require('aws-sdk');
  const dbClient = new AWS.DynamoDB.DocumentClient({
    apiVersion: '2012-08-10',
    region: "us-east-1",
    accessKeyId: process.env.REACT_APP_AVA_ID,
    secretAccessKey: process.env.REACT_APP_AVA_KEY
  });


  // retrieve a list of every group that you have authority to maintainn
  React.useEffect(() => {
    
    async function getGroupDetails(pClient, pGroup) {
      let groupRec = await dbClient
        .get({
          Key: {
            client_id: pClient,
            group_id: pGroup
          },
          TableName: "Groups"
        })
        .promise()
        .catch(error => {
          console.log({ 'Bad get on Groups - caught error is': error });
        });
      if ('Item' in groupRec) { return groupRec.Item; }
      else { return {}; }
    }

    async function getAllGroups(pPatient) {
      if (notMyFirstTime) { return; }

      var returnObject = {};
      let foundGroups = [];
      // First, get Groups that this person explicitly manages (as per the SessionsV2 table)
      if ('groups_managed' in patientSession) {
        patientSession.groups_managed.forEach(group => {
          let [gID, gName] = group.split('~');
          returnObject[gName.trim()] = {
            group_id: gID.trim(),
            role: 'responsible'
          };
          foundGroups.push(gID.trim());
        });
      }

      // If there are groups in the "responsible for" array, include those
      let respArray = [];
      if ('responsible_for' in patientSession) {
        if (Array.isArray(patientSession.responsible_for)) { respArray.push(...patientSession.responsible_for); }
        else if (patientSession.responsible_for.startsWith('[')) { respArray = patientSession.responsible_for.replace(/[[\s\]]/g, '').split(','); }
        else { respArray.push(patientSession.responsible_for); }
      }
      for (let g = 0; g < respArray.length; g++) {
        let group = respArray[g];
        if (!foundGroups.includes(group)) {
          let checkGroup = await getGroupDetails(patientSession.client_id, group);
          if (checkGroup.hasOwnProperty('name')) {
            returnObject[checkGroup.name.trim()] = {
              group_id: group.trim(),
              role: 'responsible'
            };
            foundGroups.push(group.trim());
          }
        }
      };

      // Next, get any other Groups that this person belongs to
      if ('groups' in person) {
        for (let g = 0; g < person.groups.length; g++) {
          let group = person.groups[g];
          if (!foundGroups.includes(group)) {
            let checkGroup = await getGroupDetails(patientSession.client_id, group);
            if (checkGroup.hasOwnProperty('name')) {
              returnObject[checkGroup.name.trim()] = {
                group_id: group.trim(),
                role: 'member'
              };
              foundGroups.push(group.trim());
            }
          }
        };
      }

      // Finally, get open Groups that this person does not already belong to
      let openGroups = await dbClient
        .scan({
          FilterExpression: 'client_id = :c and group_type = :o',
          ExpressionAttributeValues: { ':c': patientSession.client_id, ':o': 'open' },
          TableName: 'Groups',
        })
        .promise()
        .catch(error => {
          console.log({ 'Bad query on Groups in getGroupsPersonBelongsTo - caught error is': error });
        });
      if (openGroups && ('Items' in openGroups)) {
        openGroups.Items.forEach(groupRec => {
          if (!foundGroups.includes(groupRec.group_id)) {
            returnObject[groupRec.name] =
            {
              group_id: groupRec.group_id,
              role: 'non-member'
            };
            foundGroups.push(groupRec.group_id);
          }
        });
      }

      // Sort on name
      // First - Create a sorted array of the Keys (names)
      let gNames = Object.keys(returnObject).sort((a, b) => {
        if (a.toLowerCase() > b.toLowerCase()) { return 1; }
        else { return -1; }
      });

      //  ...then build an array of code to match the names
      let gCodes = [];
      gNames.forEach(key => {
        gCodes.push(returnObject[key].group_id);
      });

      setGNamesList(gNames);
      setGCodesList(gCodes);
      setPatientGroups(person.groups);
      setNotMyFirstTime(true);
    };
    
    let executioner = async () => { await getAllGroups(patientSession.user_id); };
    executioner();
    
  }, [notMyFirstTime, person, state.session.user_id]);

  function handleToggle(rowData, remove) {
    if (remove) {
      patientGroups.splice(patientGroups.indexOf(rowData), 1);
    }
    else {
      if (patientGroups) { patientGroups.push(rowData); }
      else { setPatientGroups([rowData]); }
    }
    setRenderCount(renderCount + 1);
    updateGroups(patientGroups);
  };

  return (
    <Section title='Groups' outlined>
      <Typography className={classes.radioText}>{`Selecting from Groups available to ${patientSession.user_id}`}</Typography>
      {gNamesList && (gNamesList.length > 0) && gCodesList && (gCodesList.length > 0) && (renderCount > 0) && 
        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
          <List className={classes.root}>
          {gNamesList.map((groupName, ndx) => (
            <ListItem
              key={'key-' + gCodesList[ndx]}
              role={undefined}
              dense
              button
              onClick={() => {handleToggle(gCodesList[ndx], (patientGroups && patientGroups.includes(gCodesList[ndx])))}}>
              <ListItemIcon>
                <Checkbox
                  edge='start'
                  checked={patientGroups && patientGroups.includes(gCodesList[ndx])}
                  tabIndex={-1}
                  disableRipple
                  inputProps={{ 'aria-labelledby': gCodesList[ndx] }}
                />
              </ListItemIcon>
              <ListItemText id={'id-' + gCodesList[ndx]} primary={groupName} />
            </ListItem>
          ))}
          </List>
        </Box>
      }
    </Section>
  );
};
