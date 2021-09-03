import React from 'react';

import { API, graphqlOperation } from 'aws-amplify';

import Box from '@material-ui/core/Box';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Checkbox from '@material-ui/core/Checkbox';

import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import ListItemIcon from '@material-ui/core/ListItemIcon';
import { getActivityData } from '../../graphql/queries';
import useSession from '../../hooks/useSession';

import Section from '../Section';

const useStyles = makeStyles({
  container: {
    maxHeight: 400,
  },
});

var gNames = [];
var gCodes = [];

export default ({ person, updateGroups }) => {
  const classes = useStyles();
  const { state } = useSession();

  // const [allGroupNames, setAllGroupNames] = React.useState([]);
  // const [allGroupCodes, setAllGroupCodes] = React.useState([]);
  const [patientGroups, setPatientGroups] = React.useState([]);
  const [notMyFirstTime, setNotMyFirstTime] = React.useState(false);
  const [renderCount, setRenderCount] = React.useState(1);

  // retrieve a list of every group
  React.useEffect(() => {
    if (notMyFirstTime) { return; }
    else {
      (async () => {
        await getAllGroups();
      })();
      setNotMyFirstTime(true);
    }
    async function getAllGroups() {
      let result;
      if (person) {
        result = await API.graphql(
          graphqlOperation(getActivityData, {
            input: {
              client_id: person.client_id,
              person_id: state.session.user_id,
              event_id: '',
              activity_type: '$$query.get_group',
              limit: 500,
              history_only: false
            },
          })
        ).catch(error => {
          console.log(`Whoops! Something went wrong when fetching activity data: ${error.errors[0].message}`);
        });
      };
      let gKeys = [...new Set(result?.data?.getActivityData[0]?.valid_values_list.sort())];
      gNames = [];
      gCodes = [];
      gKeys.forEach(e => { let [n, c] = e.split(':group='); gNames.push(n); gCodes.push(c); });
      // setAllGroupNames(gNames);
      // setAllGroupCodes(gCodes);
      let foundAt;
      let groupFound;
      if (Array.isArray(person.clients)) {
        groupFound = person.clients.some((e, i) => { foundAt = i; return (e.id === person.client_id); });
        if (groupFound) {
          setPatientGroups(person.clients[foundAt].groups.map(e => { return (`${person.client_id}~${e}`); }));
        }
      }
    }
  }, [notMyFirstTime, person, state.session.user_id]);

  function handleToggle(rowData, remove) {
    if (remove) {
      patientGroups.splice(patientGroups.indexOf(rowData), 1);
    }
    else {
      patientGroups.push(rowData);
    }
    setRenderCount(renderCount + 1);
    updateGroups(patientGroups);
  };

  return (
    <Section title='Groups' outlined>
      {person && person.clients && (renderCount > 0) ? (
        <Box display='flex' flexDirection='column' justifyContent='center' alignItems='flex-start'>
          <List className={classes.root}>
          {gNames.map((groupName, ndx) => (
            <ListItem
              key={'key-' + gCodes[ndx]}
              role={undefined}
              dense
              button
              onClick={() => {handleToggle(gCodes[ndx], patientGroups.includes(gCodes[ndx]))}}>
              <ListItemIcon>
                <Checkbox
                  edge='start'
                  checked={patientGroups.includes(gCodes[ndx])}
                  tabIndex={-1}
                  disableRipple
                  inputProps={{ 'aria-labelledby': gCodes[ndx] }}
                />
              </ListItemIcon>
              <ListItemText id={'id-' + gCodes[ndx]} primary={groupName} />
            </ListItem>
          ))}
          </List>
        </Box>
      ) : null}
    </Section>
  );
};
