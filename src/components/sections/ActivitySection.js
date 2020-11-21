import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';
import { useSnackbar } from 'notistack';
import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import CircularProgress from '@material-ui/core/CircularProgress';
import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';
import InputBase from '@material-ui/core/InputBase';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import useMediaQuery from '@material-ui/core/useMediaQuery';
import { fade } from '@material-ui/core/styles/colorManipulator';
import makeStyles from '@material-ui/core/styles/makeStyles';
//import AssignmentOutlinedIcon from '@material-ui/icons/AssignmentOutlined';
import BusinessCenterOutlinedIcon from '@material-ui/icons/BusinessCenterOutlined';
import CheckCircle from '@material-ui/icons/CheckCircle';
// import HomeIcon from '@material-ui/icons/Home';
import AssignmentTurnedInOutlinedIcon from '@material-ui/icons/AssignmentTurnedInOutlined';
import SearchIcon from '@material-ui/icons/Search';

import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import { createPutFact } from '../../graphql/mutations';
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
    width: 150,
    flexShrink: 2,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  defaultButton: {
    borderRadius: 50,
    marginLeft: 0,
    paddingLeft: 13,
    paddingRight: 10,
    backgroundColor: fade(theme.palette.info[theme.palette.type], 0.05),
    variant: 'outlined',
    fontSize: theme.typography.fontSize * 0.6,
    color: theme.palette.info[theme.palette.type],
    height: theme.typography.fontSize * 1.8,
  },
  confirm: {
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  reject: {
    backgroundColor: theme.palette.reject[theme.palette.type],
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
  descriptionText: {
    marginLeft: theme.spacing(1),
    marginRight: theme.spacing(1),
  },
}));

const DEFAULT_TYPE = 'My_activities';
const DEFAULT_LIMIT = 5;
const DEFAULT_LIMIT_INCREMENT = 5;

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
  //const [defaultRequested, setDefaultRequested] = React.useState(false);

  const [activePatient, setActivePatient] = React.useState(null);

  const [showSummary, setSummary] = React.useState(false);
  var timeNow = new Date().getTime();

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
  const { enqueueSnackbar } = useSnackbar();
  const classes = useStyles();

  var priorReason = '';
  var defaultRequested = false;
  var selectedActivityName = '';

  const doneWithEvent = () => {
    if (activities[0].reason.startsWith('Search')) {
      setSummary(false);
      returnToHome();
    } else {
      setSummary(true);
    }
  };

  const handleSummarySubmit = () => {
    setSummary(false);
    newFact = {
      patient_id: session.patient_id || session.user_id,
      activity_key: 'confirmation.' + event,
      value: 'action.confirmed',
      session: {
        user_id: session.user_id,
        session_id: session.session_id,
      },
    };
    selectedActivityName = activities[0].reason.substr(0, activities[0].reason.length - 6);
    setNewFact(newFact);
    onSaveFact(newFact);
    returnToHome();
  };

  const handleSummaryBack = () => {
    setSummary(false);
  };

  const handleSummaryExit = () => {
    setSummary(false);
    returnToHome();
  };

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
    if (searchString !== '') {
      setEvent('');
      setLimit(DEFAULT_LIMIT);
      setType('%' + searchString);
    }
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

  const onChooseDefault = () => {
    defaultRequested = true;
  };

  const onChooseActivity = activity => {
    if (defaultRequested) {
      //setDefaultRequested(false);
      defaultRequested = false;
      selectedActivityName = activity.name;

      if (activity.code.startsWith('event')) {
        newFact = {
          patient_id: session.patient_id || session.user_id,
          activity_key: 'defaults.' + activity.code,
          value: 'action.set_defaults',
          session: {
            user_id: session.user_id,
            session_id: session.session_id,
          },
        };
      } else {
        newFact = {
          patient_id: session.patient_id || session.user_id,
          activity_key: activity.code,
          value: activity.observation_key + '.' + activity.default_value,
          session: {
            user_id: session.user_id,
            session_id: session.session_id,
          },
        };
      }
      setSelected(activity);
      setNewFact(newFact);
      onSaveFact(newFact);
    } else if (activity.code.startsWith('event')) {
      setType(DEFAULT_TYPE);
      setLimit(DEFAULT_LIMIT);
      setEvent(activity.code.split('.')[1]);
    } else {
      setSelected(activity);
      selectedActivityName = activity.name;
      setOpen(true);
    }
  };

  const onSaveFact = async newFact => {
    //   (async () => {
    let sVal = '';
    let mVal = '';
    if (typeof newFact.value === 'object') {
      let factObject = newFact.value;
      let selectCount = 0;
      for (mVal in factObject) {
        if (factObject[mVal] === true) {
          newFact.value = 'selection.' + mVal;
          await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
          selectCount++;
        }
      }
      switch (selectCount) {
        case 0: {
          sVal = 'No selections';
          break;
        }
        case 1: {
          sVal = mVal;
          break;
        }
        default: {
          sVal = selectCount.toString() + ' selections';
        }
      }
    } else {
      [, sVal] = newFact.value.replace('.', '~').split('~');
      await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
    }
    setNewFact(newFact);
    setLimit(limit);
    setOpen(false);
    if (!selectedActivityName && selected.hasOwnProperty('name')) {
      selectedActivityName = selected.name;
    }
    if (selectedActivityName) {
      enqueueSnackbar(
        `${selectedActivityName} ${sVal === 'set_defaults' ? 'items set to their default values' : 'is ' + sVal}`,
        {
          variant: 'success',
        }
      );
    }
    selectedActivityName = '';
    //    })().catch(error => {
    //     setOpen(false);
    //     enqueueSnackbar(`Whoops! Something went wrong when creating a new fact: ${error.message}`, {
    //       variant: 'error',
    //     });
    //   });
  };

  const onNextFact = async newFact => {
    await onSaveFact(newFact);
    let aL = activities.length;
    let a = 0;
    for (a; a < aL; a++) {
      if (activities[a].code === selected.code) {
        break;
      }
    }
    a++;
    if (a < aL) {
      onChooseActivity(activities[a]);
    }
  };

  // build the event and activity lists for drop downs
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      if (session) {
        if (mounted) {
          setEvents(events);
          setTypes(types);
        } else {
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

    if (patient !== activePatient) {
      returnToHome();
      setActivePatient(patient);
    }

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
            grow={1}
            justifyContent='flex-start'
            alignItems='center'>
            <Typography variant='h6' className={classes.title}>
              Activities
            </Typography>
          </Box>
          <Box pl={5} display={homeState ? 'none' : 'flex'}>
            <Button
              color='secondary'
              size='small'
              variant='contained'
              startIcon={<AssignmentTurnedInOutlinedIcon />}
              onClick={doneWithEvent}>
              Done
            </Button>
          </Box>
          <Box paddingLeft={1} className={classes.search}>
            <SearchIcon />
            <InputBase
              type='text'
              value={clearSearch ? '' : null}
              placeholder='Search…'
              onChange={onSearch}
              onKeyPress={checkEnter}
              classes={{
                root: classes.inputRoot,
                input: classes.inputInput,
              }}
            />
          </Box>
        </Box>
      </AppBar>
      <Box p={3} flexGrow={1}>
        <Grid container>
          <Grid md={6} sm={7} xs={12} item>
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
                    p={2}
                    variant='outlined'
                    textAlign='left'
                    onClick={() => {
                      onChooseActivity(activity);
                    }}
                    square>
                    <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                      <Box display='flex' flexDirection='column' width='95%' textOverflow='ellipsis'>
                        <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                          <Typography variant='h5' noWrap>
                            {activity.name}
                          </Typography>
                          <Box
                            pl={7}
                            position='absolute'
                            right={15}
                            display={
                              activity.hasOwnProperty('default_value') && activity.default_value ? 'flex' : 'none'
                            }>
                            <Button onClick={onChooseDefault} className={classes.defaultButton}>
                              <Typography noWrap>{activity.default_value}</Typography>
                            </Button>
                          </Box>
                        </Box>
                        <Box display={activity.most_recent_observation ? 'block' : 'none'}>
                          <Typography variant='body2' noWrap>
                            {activity.most_recent_observation} - {activity.observation_status}
                          </Typography>
                        </Box>
                      </Box>
                      <Box alignSelf='flex-end' flexDirection='row' color='white' display={'none'}>
                        <CheckCircle style={{ color: 'orange' }}></CheckCircle>
                      </Box>
                    </Box>
                  </Paper>
                </GridListTile>
              ))}
              <GridListTile cols={1}>
                <Box>
                  <Typography variant='body1' noWrap>
                    {activities.length < limit ? 'No more items' : 'More items...'}
                  </Typography>
                </Box>
                <Paper
                  display={activities.length < limit ? 'none' : 'block'}
                  component={Box}
                  py={2}
                  px={2}
                  textAlign='start'
                  variant='outlined'
                  onClick={onShowMore}
                  square>
                  {loading ? <CircularProgress /> : <Typography variant='h5'>Click for more</Typography>}
                </Paper>
              </GridListTile>
            </GridList>
          </Grid>
        </Grid>
      </Box>
      {open ? (
        <NewFactDialog
          fact={selected}
          session={session}
          open={open}
          onClose={() => {
            setOpen(false);
          }}
          onSave={onSaveFact}
          onNext={onNextFact}
        />
      ) : null}
      <Dialog
        open={showSummary}
        onClose={handleSummaryBack}
        scroll='paper'
        fullWidth={true}
        aria-labelledby='scroll-dialog-title'
        aria-describedby='scroll-dialog-description'>
        <DialogTitle id='scroll-dialog-title' className={classes.descriptionText}>
          {activities[0] && activities[0].reason
            ? activities[0].reason.substr(0, activities[0].reason.length - 6)
            : null}
        </DialogTitle>
        <DialogContent dividers={true} className={classes.descriptionText}>
          <DialogContentText id='scroll-dialog-description' tabIndex={-1}>
            {activities.map(activity =>
              activity.observation_expires < timeNow ? null : (
                <Typography key={activity.name}>
                  <Box key={activity.name + '.name'} pt={2}>
                    {activity.name + ': '}
                  </Box>
                  <Box key={activity.name + '.value'} fontWeight='fontWeightBold'>
                    {activity.most_recent_observation}
                  </Box>
                </Typography>
              )
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button className={classes.reject} size='small' variant='contained' onClick={handleSummaryBack}>
            Back
          </Button>
          <Button color='secondary' size='small' variant='contained' onClick={handleSummaryExit}>
            Exit
          </Button>
          <Button variant='contained' className={classes.confirm} size='small' onClick={handleSummarySubmit}>
            Submit
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
