import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import Box from '@material-ui/core/Box';
import Divider from '@material-ui/core/Divider';
import FormControl from '@material-ui/core/FormControl';
import Grid from '@material-ui/core/Grid';
import InputLabel from '@material-ui/core/InputLabel';
import NativeSelect from '@material-ui/core/NativeSelect';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { useMediaQuery } from '@material-ui/core';

import { getEventsByClient } from '../graphql/queries';

// TODO: Pull from Activity_Types table
const types = [
  { activity_type_code: 'activity', name: 'Activity' },
  { activity_type_code: 'characteristic_level', name: 'Characteristic (level)' },
  { activity_type_code: 'characteristic_list', name: 'Characteristic' },
  { activity_type_code: 'characteristic_num', name: 'Characteristic (numeric)' },
  { activity_type_code: 'characteristic_num2', name: 'Characteristic (two-number)' },
  { activity_type_code: 'condition', name: 'Condition' },
  { activity_type_code: 'event', name: 'Event' },
  { activity_type_code: 'service', name: 'Service' },
  { activity_type_code: 'state', name: 'State' },
];

// TODO: Pull from Facts table
const facts = [
  { code: 1, name: 'sm=3, xs=6' },
  { code: 2, name: 'sm=3, xs=6' },
  { code: 3, name: 'sm=3, xs=6' },
  { code: 4, name: 'sm=3, xs=6' },
  { code: 5, name: 'sm=3, xs=6' },
  { code: 6, name: 'sm=3, xs=6' },
  { code: 7, name: 'sm=3, xs=6' },
  { code: 8, name: 'sm=3, xs=6' },
];

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    [theme.breakpoints.down('xs')]: {
      width: '100%',
      minWidth: 64,
    },
  },
}));

export default () => {
  const [events, setEvents] = React.useState([]);
  const [event, setEvent] = React.useState('');
  const [type, setType] = React.useState('');
  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs'));
  const classes = useStyles();

  React.useEffect(() => {
    (async () => {
      const result = await API.graphql(graphqlOperation(getEventsByClient, { client_id: 'SMSoft' })).catch(error => {
        alert(`Whoops! Something went wrong when fetching events by client id: ${error.message}`);
      });
      setEvents(result.data.getEventsByClient.items);
    })();
  }, []);

  return (
    <Paper component={Box} m={2}>
      <Box mt={1} px={3} borderBottom={2} display='flex' flexDirection='row'>
        <Box flexGrow={1} display='flex' flexDirection='row' alignItems='center'>
          <Typography variant='subtitle1'>Activities</Typography>
        </Box>
        <Divider orientation='vertical' variant='middle' flexItem />
        <Box flexGrow={1} display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
          {isMobile ? null : <Typography variant='subtitle1'>Event:</Typography>}
          <FormControl className={classes.formControl}>
            {isMobile ? <InputLabel htmlFor='event-label'>Event</InputLabel> : null}
            <NativeSelect
              value={event}
              onChange={event => {
                setEvent(event.target.value);
              }}
              id='event-label'
              name='event'
              inputProps={{ 'aria-label': 'event' }}>
              <option value=''>{isMobile ? '' : 'None'}</option>
              {events.map(event => (
                <option key={event.event_id} value={event.event_id}>
                  {event.event_id}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
        </Box>
        <Divider orientation='vertical' variant='middle' flexItem />
        <Box flexGrow={1} display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
          {isMobile ? null : <Typography variant='subtitle1'>Type:</Typography>}
          <FormControl className={classes.formControl}>
            {isMobile ? <InputLabel htmlFor='type-label'>Type</InputLabel> : null}
            <NativeSelect
              value={type}
              onChange={event => {
                setType(event.target.value);
              }}
              id='type-label'
              name='type'
              inputProps={{ 'aria-label': 'type' }}>
              <option value=''>{isMobile ? '' : 'None'}</option>
              {types.map(type => (
                <option key={type.activity_type_code} value={type.activity_type_code}>
                  {type.name}
                </option>
              ))}
            </NativeSelect>
          </FormControl>
        </Box>
      </Box>
      <Box p={3} flexGrow={1}>
        <Grid spacing={3} container>
          {facts.slice(0, 7).map(fact => (
            <Grid key={fact.code} sm={3} xs={6} item>
              <Box py={6} px={2} textAlign='center' clone>
                <Paper elevation={4} square>
                  {fact.name}
                </Paper>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Paper>
  );
};
