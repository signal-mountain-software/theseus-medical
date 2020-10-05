import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { useSnackbar } from 'notistack';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import Divider from '@material-ui/core/Divider';
import FormControl from '@material-ui/core/FormControl';
import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';
import NativeSelect from '@material-ui/core/NativeSelect';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { useMediaQuery } from '@material-ui/core';

import { createPutFact } from '../../graphql/mutations';
import { getActivityData, getActivityTypes, getEventsByClient } from '../../graphql/queries';
import NewFactDialog from '../dialogs/NewFactDialog';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    [theme.breakpoints.down('xs')]: {
      width: '100%',
      minWidth: 64,
    },
  },
  gridList: {
    maxHeight: 400,
  },
}));

const DEFAULT_TYPE = 'My_activities';
const DEFAULT_LIMIT = 7;
const DEFAULT_LIMIT_INCREMENT = 8;

export default ({ patient, session, newFact, setNewFact }) => {
  const [activities, setActivities] = React.useState([]); // populates the activity buttons
  const [events, setEvents] = React.useState([]); // populates the events dropdown list
  const [types, setTypes] = React.useState([]); // populates the types dropdown list

  const [event, setEvent] = React.useState(''); // stores the current selected event filter
  const [type, setType] = React.useState(DEFAULT_TYPE); // stores the current selected type filter
  const [limit, setLimit] = React.useState(DEFAULT_LIMIT); // stores the current limit of activity buttons displayed

  const [loading, setLoading] = React.useState(false); // a flag that shows/hides loading spinner
  const [open, setOpen] = React.useState(false); // a flag that shows/hides the NewFactDialog
  const [selected, setSelected] = React.useState(null); // stores the current selected fact being added

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
  const { enqueueSnackbar } = useSnackbar();
  const classes = useStyles();

  const onChangeEvent = event => {
    setType(DEFAULT_TYPE);
    setLimit(DEFAULT_LIMIT);
    setEvent(event.target.value);
  };

  const onChangeType = event => {
    setEvent('');
    setLimit(DEFAULT_LIMIT);
    setType(event.target.value);
  };

  const onShowMore = () => {
    setLimit(limit + DEFAULT_LIMIT_INCREMENT);
  };

  const onChooseActivity = activity => {
    setSelected(activity);
    setOpen(true);
  };

  const onSaveFact = newFact => {
    (async () => {
      await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
      setNewFact(newFact);
      setOpen(false);
      enqueueSnackbar(`Successfully saved '${selected.name}' fact!`, {
        variant: 'success',
      });
    })().catch(error => {
      setOpen(false);
      enqueueSnackbar(`Whoops! Something went wrong when creating a new fact: ${error.message}`, {
        variant: 'error',
      });
    });
  };

  // build the event and activity lists for drop downs
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      let getEventsResult;
      let getActivitiesResult;
      if (session) {
        getEventsResult = await API.graphql(
          graphqlOperation(getEventsByClient, { client_id: session.client_id })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching events by client id: ${error.message}`, {
            variant: 'error',
          });
        });
        const events = getEventsResult.data.getEventsByClient.items;

        getActivitiesResult = await API.graphql(
          graphqlOperation(getActivityTypes, { client_id: session.client_id })
        ).catch(error => {
          enqueueSnackbar(`Whoops! Something went wrong when fetching activity types by client id: ${error.message}`, {
            variant: 'error',
          });
        });
        const types = getActivitiesResult.data.getActivityTypes;

        if (mounted) {
          setEvents(events);
          setTypes(types);
        } else {
          API.cancel(getEventsResult, 'ActivitySection unmounted, cancel getEventsByClient');
          API.cancel(getActivitiesResult, 'ActivitySection unmounted, cancel getActivityTypes');
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // retrieve the activities for the main part of the screen
  React.useEffect(() => {
    setLoading(true);
    let mounted = true;
    (async () => {
      let result;
      if (patient && session) {
        result = await API.graphql(
          graphqlOperation(getActivityData, {
            input: {
              client_id: session.client_id,
              person_id: patient.person_id,
              event_id: event,
              activity_type: type,
              limit: limit,
              fact_data: true,
            },
          })
        ).catch(error => {
          setLoading(false);
          enqueueSnackbar(`Whoops! Something went wrong when fetching activity data: ${error.message}`, {
            variant: 'error',
          });
        });

        if (mounted) {
          setLoading(false);
          setActivities(result.data.getActivityData);
        } else {
          setLoading(false);
          API.cancel(result, 'ActivitySection unmounted, cancel getActivityData');
        }
      }
    })();

    return () => {
      setLoading(false);
      mounted = false;
    };
  }, [patient, session, event, type, limit, newFact]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Paper component={Box} m={2}>
      <Box mt={1} px={3} borderBottom={2} display='flex' flexDirection='row'>
        <Box flexGrow={1} display='flex' flexDirection='row' alignItems='center'>
          <Typography variant='h6'>Activities</Typography>
        </Box>
        <Divider orientation='vertical' variant='middle' flexItem />
        <Box flexGrow={1} display='flex' flexDirection='row' justifyContent='center' alignItems='center'>
          {isMobile ? null : <Typography variant='subtitle1'>Event:</Typography>}
          <FormControl className={classes.formControl}>
            <NativeSelect value={event} onChange={onChangeEvent} name='event' inputProps={{ 'aria-label': 'event' }}>
              <option value=''>None</option>
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
            <NativeSelect value={type} onChange={onChangeType} name='type' inputProps={{ 'aria-label': 'type' }}>
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
        <Grid container>
          <Grid sm={6} xs={12} item>
            <GridList className={classes.gridList} cellHeight='auto' cols={1}>
              {activities.map(activity => (
                <GridListTile key={activity.code} cols={1}>
                  <Paper
                    component={Box}
                    py={2}
                    px={2}
                    variant='outlined'
                    textAlign='left'
                    onClick={() => {
                      onChooseActivity(activity);
                    }}
                    square>
                    <Typography variant='h5' noWrap>
                      {activity.name}
                    </Typography>
                    <Typography variant='body1' noWrap>
                      Recent: {activity.most_recent_observation}
                    </Typography>
                    <Typography variant='body2' noWrap>
                      {activity.observation_status}
                    </Typography>
                  </Paper>
                </GridListTile>
              ))}
              <GridListTile cols={1}>
                <Paper component={Box} py={2} px={2} textAlign='center' variant='outlined' onClick={onShowMore} square>
                  {loading ? <CircularProgress /> : <Typography variant='h4'>Show More</Typography>}
                </Paper>
              </GridListTile>
            </GridList>
          </Grid>
        </Grid>
      </Box>
      <NewFactDialog
        fact={selected}
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
