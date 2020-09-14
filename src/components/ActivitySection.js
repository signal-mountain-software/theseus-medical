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

import { createPutFact } from '../graphql/mutations';
import { getActivityData, getEventsByClient } from '../graphql/queries';
import { SHOW_SNACKBAR } from '../contexts/Snackbar/actions';
import useSnackbar from '../hooks/useSnackbar';
import NewFactDialog from './NewFactDialog';

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

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    [theme.breakpoints.down('xs')]: {
      width: '100%',
      minWidth: 64,
    },
  },
}));

export default ({ patient, session, setNewFact }) => {
  const [events, setEvents] = React.useState([]);
  const [facts, setFacts] = React.useState([]);
  const [event, setEvent] = React.useState('');
  const [type, setType] = React.useState('activity');
  const [limit, setLimit] = React.useState(7);
  const [open, setOpen] = React.useState(false);
  const [fact, setFact] = React.useState(null);
  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs'));
  const classes = useStyles();
  const { dispatch } = useSnackbar();

  const onChangeEvent = event => {
    setType('activity');
    setLimit(7);
    setEvent(event.target.value);
  };

  const onChangeType = event => {
    setEvent('');
    setLimit(7);
    setType(event.target.value);
  };

  const onShowMore = () => {
    setLimit(limit + 8);
  };

  const onChooseFact = fact => {
    setFact(fact);
    setOpen(true);
  };

  const onSaveFact = newFact => {
    (async () => {
      await API.graphql(graphqlOperation(createPutFact, { input: newFact })).catch(error => {
        dispatch({
          type: SHOW_SNACKBAR,
          payload: {
            message: `Whoops! Something went wrong when fetching events by client id: ${error.message}`,
            anchor: { vertical: 'bottom' },
            direction: 'up',
          },
        });
      });
      setNewFact(newFact);
      setOpen(false);
      dispatch({
        type: SHOW_SNACKBAR,
        payload: {
          message: `Successfully saved '${fact.name}' fact!`,
          anchor: { vertical: 'bottom' },
          direction: 'up',
        },
      });
    })();
  };

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      let result;
      result = await API.graphql(graphqlOperation(getEventsByClient, { client_id: 'SMSoft' })).catch(error => {
        dispatch({
          type: SHOW_SNACKBAR,
          payload: {
            message: `Whoops! Something went wrong when fetching events by client id: ${error.message}`,
            anchor: { vertical: 'bottom' },
            direction: 'up',
          },
        });
      });

      if (mounted) {
        setEvents(result.data.getEventsByClient.items);
      } else {
        API.cancel(result, 'ActivitySection unmounted');
      }
    })();

    return () => {
      mounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (patient) {
        let result;
        result = await API.graphql(
          graphqlOperation(getActivityData, {
            input: { client_id: 'SMSoft', event_id: event, activity_type: type, limit: limit },
          })
        ).catch(error => {
          dispatch({
            type: SHOW_SNACKBAR,
            payload: {
              message: `Whoops! Something went wrong when fetching activity data: ${error.message}`,
              anchor: { vertical: 'bottom' },
              direction: 'up',
            },
          });
        });

        if (mounted) {
          setFacts(result.data.getActivityData);
        } else {
          API.cancel(result, 'ActivitySection unmounted');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [patient, event, type, limit]); // eslint-disable-line react-hooks/exhaustive-deps

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
              onChange={onChangeEvent}
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
              onChange={onChangeType}
              id='type-label'
              name='type'
              inputProps={{ 'aria-label': 'type' }}>
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
          {facts.slice(0, limit).map(fact => (
            <Grid key={fact.code} sm={3} xs={6} item>
              <Box py={6} px={2} textAlign='center' clone>
                <Paper
                  elevation={4}
                  onClick={() => {
                    onChooseFact(fact);
                  }}
                  square>
                  <Typography noWrap>{fact.name}</Typography>
                </Paper>
              </Box>
            </Grid>
          ))}
          <Grid sm={3} xs={6} item>
            <Box py={6} px={2} textAlign='center' clone>
              <Paper elevation={4} onClick={onShowMore} square>
                <Typography>Show more</Typography>
              </Paper>
            </Box>
          </Grid>
        </Grid>
      </Box>
      <NewFactDialog
        fact={fact}
        session={session}
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        onSave={onSaveFact}
      />
    </Paper>
  );
};
