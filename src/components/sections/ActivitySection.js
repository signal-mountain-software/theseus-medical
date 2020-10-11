import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { useSnackbar } from 'notistack';

import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';

//import FormControl from '@material-ui/core/FormControl';
import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';
import InputBase from '@material-ui/core/InputBase';
import Paper from '@material-ui/core/Paper';
import SearchIcon from '@material-ui/icons/Search';
import Typography from '@material-ui/core/Typography';

import BusinessCenterOutlinedIcon from '@material-ui/icons/BusinessCenterOutlined';

// import makeStyles from '@material-ui/core/styles/makeStyles';
import { fade, makeStyles } from '@material-ui/core/styles';
import { useMediaQuery } from '@material-ui/core';

import Button from '@material-ui/core/Button';
import HomeIcon from '@material-ui/icons/Home';
import CheckCircle from '@material-ui/icons/CheckCircle';

import { createPutFact } from '../../graphql/mutations';
//import { getActivityData, getActivityTypes, getEventsByClient } from '../../graphql/queries';
import { getActivityData } from '../../graphql/queries';
import NewFactDialog from '../dialogs/NewFactDialog';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    [theme.breakpoints.down('xs')]: {
      width: '100%',
      minWidth: 64,
    },
  },
  appBar: {
    position: 'relative',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    zIndex: 1,
  },
  gridList: {
    maxHeight: 400,
  },
  search: {
    backgroundColor: fade(theme.palette.common.white, 0.15),
    '&:hover': {
      backgroundColor: fade(theme.palette.common.white, 0.25),
    },
    position: 'absolute',
    right: 15,
    borderRadius: 50,
    px: 4,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  searchIcon: {
    padding: theme.spacing(0, 2),
    height: '100%',
    pointerEvents: 'auto',
  },
  inputRoot: {
    color: 'inherit',
  },
  inputInput: {
    padding: theme.spacing(1, 1, 1, 0),
    paddingLeft: 3,
    transition: theme.transitions.create('width'),
    [theme.breakpoints.up('md')]: {
      width: '20ch',
    },
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
  const [clearSearch, setClearSearch] = React.useState(true);
  const [searchString, setSearchString] = React.useState('');
  const [homeState, setHomeState] = React.useState(true);

  //const [title, setTitle] = React.useState('Activities');

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
  const { enqueueSnackbar } = useSnackbar();
  const classes = useStyles();

  var priorReason = '';

  const returnToHome = () => {
    setType(DEFAULT_TYPE);
    setLimit(DEFAULT_LIMIT);
    setEvent('');
    setSearchString('');
  };

  const onShowMore = () => {
    setLimit(limit + DEFAULT_LIMIT_INCREMENT);
  };

  const onTap = event => {
    setClearSearch(true);
    setEvent('');
    setLimit(DEFAULT_LIMIT);
    setType('%' + searchString);
    setSearchString('');
  };

  const checkEnter = event => {
    if (event.key === 'Enter') {
      onTap(event);
    }
  };

  const onSearch = event => {
    setSearchString(event.target.value);
    setClearSearch(false);
  };

  const onChooseActivity = activity => {
    if (activity.code.startsWith('event')) {
      setType(DEFAULT_TYPE);
      setLimit(DEFAULT_LIMIT);
      setEvent(activity.code.split('.')[1]);
    } else {
      setSelected(activity);
      setOpen(true);
    }
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
      //      let getEventsResult;
      //      let getActivitiesResult;
      if (session) {
        if (mounted) {
          setEvents(events);
          setTypes(types);
        } else {
          //          API.cancel(getEventsResult, 'ActivitySection unmounted, cancel getEventsByClient');
          //          API.cancel(getActivitiesResult, 'ActivitySection unmounted, cancel getActivityTypes');
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
              includeEvents: true,
              use_short_date: isMobile,
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
          if (event === '' && type === DEFAULT_TYPE) {
            setHomeState(true);
          } else {
            setHomeState(false);
          }
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
      <AppBar className={classes.appBar}>
        <Box
          px={3}
          display='flex'
          flexDirection='row'
          minHeight={40}
          width='100%'
          alignItems='center'
          mt={1}
          mb={1}
          justifyContent='flex-start'>
          <BusinessCenterOutlinedIcon />
          <Box
            flexDirection='row'
            pl={1}
            display={isMobile && !homeState ? 'none' : 'flex'}
            nowrap
            grow={1}
            justifyContent='flex-start'
            alignItems='center'>
            <Typography variant='h6' className={classes.title}>
              Activities
            </Typography>
          </Box>
          <Box pl={5} display={homeState ? 'none' : 'flex'}>
            <Button color='secondary' size='small' variant='contained' startIcon={<HomeIcon />} onClick={returnToHome}>
              Home
            </Button>
          </Box>
          <Box className={classes.search}>
            <Button type='submit' startIcon={<SearchIcon />} onTouchEnd={onTap} onClick={onTap} pointerEvents='auto' />
            <InputBase
              type='text'
              position='absolute'
              left={7}
              value={clearSearch ? '' : null}
              placeholder='Search…'
              onChange={onSearch}
              onKeyPress={checkEnter}
              classes={{
                root: classes.inputRoot,
                input: classes.inputInput,
              }}
              inputProps={{ 'aria-label': 'search' }}
            />
          </Box>
        </Box>
      </AppBar>
      <Box p={3} flexGrow={1}>
        <Grid container>
          <Grid sm={6} xs={12} item>
            <GridList className={classes.gridList} cellHeight='auto' cols={1}>
              {activities.map(activity => (
                <GridListTile key={activity.code} cols={1}>
                  <Box display={activity.reason === priorReason ? 'none' : 'block'}>
                    <Typography variant='body1' noWrap>
                      {(priorReason = activity.reason)}
                    </Typography>
                  </Box>
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
                    <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                      <Box display='flex' flexDirection='column' width='95%' textOverflow='ellipsis'>
                        <Box>
                          <Typography variant='h5' noWrap>
                            {activity.name}
                          </Typography>
                        </Box>
                        <Box display={activity.most_recent_observation ? 'block' : 'none'}>
                          <Typography variant='body2' noWrap>
                            {activity.most_recent_observation} - {activity.observation_status}
                          </Typography>
                        </Box>
                      </Box>
                      <Box
                        alignSelf='flex-end'
                        flexDirection='row'
                        alignItems='center'
                        display={
                          activity.hasOwnProperty('observation_status') &&
                          activity.observation_status !== null &&
                          !activity.observation_status.includes('expired')
                            ? 'flex'
                            : 'none'
                        }>
                        <CheckCircle style={{ color: 'green' }}></CheckCircle>
                      </Box>
                    </Box>
                  </Paper>
                </GridListTile>
              ))}
              <GridListTile cols={1}>
                <Box>
                  <Typography variant='body1' noWrap>
                    More items...
                  </Typography>
                </Box>
                <Paper component={Box} py={2} px={2} textAlign='start' variant='outlined' onClick={onShowMore} square>
                  {loading ? (
                    <CircularProgress />
                  ) : activities.length < limit ? (
                    <Typography variant='h5'>No more Activities</Typography>
                  ) : (
                    <Typography variant='h5'>Click for more</Typography>
                  )}
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
