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
import BusinessCenterOutlinedIcon from '@material-ui/icons/BusinessCenterOutlined';
import AssignmentTurnedInOutlinedIcon from '@material-ui/icons/AssignmentTurnedInOutlined';
import SearchIcon from '@material-ui/icons/Search';
import IconButton from '@material-ui/core/IconButton';
import AddToQueueOutlinedIcon from '@material-ui/icons/AddToQueueOutlined';

import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';

import { createPutFact } from '../../graphql/mutations';
import { updateReservation } from '../../graphql/mutations';
import { getActivityData } from '../../graphql/queries';
import { getReservation } from '../../graphql/queries';
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
    // maxHeight: 400,
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
const DEFAULT_LIMIT = 50;
const DEFAULT_LIMIT_INCREMENT = 20;

export default ({ patient, session, newFact, setNewFact }) => {
  const [activities, setActivities] = React.useState([]); // populates the activity buttons
  const [events, setEvents] = React.useState([]); // populates the events dropdown list
  const [types, setTypes] = React.useState([]); // populates the types dropdown list

  const [event, setEvent] = React.useState(''); // stores the current selected event filter
  const [type, setType] = React.useState(DEFAULT_TYPE); // stores the current selected type filter
  const [limit, setLimit] = React.useState(DEFAULT_LIMIT); // stores the current limit of activity buttons displayed

  const [lastEvent, setLastEvent] = React.useState(''); // stores the current selected event filter
  const [lastType, setLastType] = React.useState(''); // stores the current selected type filter
  const [lastLimit, setLastLimit] = React.useState(0); // stores the current limit of activity buttons displayed

  const [loading, setLoading] = React.useState(false); // a flag that shows/hides loading spinner
  const [open, setOpen] = React.useState(false); // a flag that shows/hides the NewFactDialog
  const [selected, setSelected] = React.useState(null); // stores the current selected fact being added
  const [searchString, setSearchString] = React.useState('');
  const [homeState, setHomeState] = React.useState('home');
  //const [defaultRequested, setDefaultRequested] = React.useState(false);

  const [activePatient, setActivePatient] = React.useState(null);

  const [showSummary, setSummary] = React.useState(false);
  const [showConfirmation, setConfirmation] = React.useState(false);
  // eslint-disable-next-line
  const [showFreeText, setFreeText] = React.useState({});

  const [lastWrittenFact, setLastWrittenFact] = React.useState({});

  var timeNow = new Date().getTime();

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
  const { enqueueSnackbar } = useSnackbar();
  const classes = useStyles();

  var priorReason = '';
  var defaultRequested = false;
  var selectedActivityName = '';
  var addedAFavorite = false;

  const doneWithEvent = () => {
    if (
      homeState === 'search' ||
      !newFact ||
      !newFact.value ||
      activities.every(aObj => {
        return aObj.observation_expires !== null && aObj.observation_expires < timeNow;
      })
    ) {
      setSummary(false);
      setConfirmation(false);
      if (homeState === 'home') {
        window.location.reload();
      }
      returnToHome();
    } else {
      setSummary(true);
    }
  };

  const handleSummarySubmit = () => {
    setSummary(false);
    setConfirmation(false);
    let confirmedData = [newFact.value];
    if (newFact.qualifier) {
      confirmedData.push(newFact.qualifier);
    }
    newFact = {
      patient_id: session.patient_id || session.user_id,
      activity_key: 'confirmation.' + (event ? event : selected.code),
      value: 'action.confirmed',
      qualifier: confirmedData,
      session: {
        user_id: session.user_id,
        session_id: session.session_id,
      },
    };
    if (event) {
      selectedActivityName = activities[0].reason.substr(0, activities[0].reason.length - 6);
    } else {
      selectedActivityName = selected.name;
    }
    setNewFact(newFact);
    onSaveFact(newFact);
    returnToHome();
  };

  const handleConfirmSubmit = () => {
    setSummary(false);
    setConfirmation(false);
    newFact.status = 'confirmed';
    selectedActivityName = selected.name;
    setNewFact(newFact);
    onSaveFact(newFact);
    //    returnToHome();
  };

  const handleSummaryBack = () => {
    setSummary(false);
    setConfirmation(false);
  };

  const handleConfirmBack = () => {
    setSummary(false);
    setConfirmation(false);
    if (newFact.value.hasOwnProperty('selected')) {
      let valueSelectedObject = newFact.value.selected;
      let qualObject = newFact.value.qualifiers;
      let freeTextObject = newFact.value.freeText;
      let separator = '';
      let qualSeparator = '';
      let fOL = valueSelectedObject.length;
      let constructedValue = '';
      // eslint-disable-next-line
      let constructedQualifier = '';
      let mVal;
      for (let f = 0; f < fOL; f++) {
        mVal = valueSelectedObject[f];
        constructedValue += separator + mVal;
        separator = ' ~ ';
        if (qualObject && qualObject[mVal] && qualObject[mVal] !== '') {
          constructedQualifier += qualSeparator + mVal + ': ' + qualObject[mVal].join(' ~ ');
          qualSeparator = ' / ';
        }
      }
      for (const [key, value] of Object.entries(freeTextObject)) {
        constructedValue += separator + key + ' = ' + value;
        separator = ' ~ ';
      }
      selected.most_recent_observation = constructedValue;
      selected.default_value = 'defaults.' + constructedValue;
    }
    setSelected(selected);
    setOpen(true);
  };

  const handleSummaryExit = () => {
    setSummary(false);
    setConfirmation(false);
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
  };

  const onChooseDefault = () => {
    defaultRequested = true;
  };

  const onChooseActivity = async activity => {
    if (addedAFavorite) {
      return;
    }
    if (defaultRequested) {
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
      setNewFact();
    } else if (activity.type === 'reservation') {
      let result = await API.graphql(
        graphqlOperation(getActivityData, {
          input: {
            client_id: session.client_id,
            person_id: patient.person_id,
            event_id: '',
            activity_type: '$$' + activity.code,
            limit: limit,
            fact_data: false,
            includeEvents: true,
            history_only: false,
            use_short_date: isMobile,
          },
        })
      ).catch(error => {
        enqueueSnackbar(`We had a problem getting current information: ${error}`, {
          variant: 'error',
        });
      });
      let selectedActivity = result.data.getActivityData[0];
      selectedActivityName = activity.name;
      result = await API.graphql(
        graphqlOperation(getReservation, {
          client_id: session.client_id,
          event_code: activity.code,
        })
      ).catch(error => {
        enqueueSnackbar(`We had a problem getting that event: ${JSON.stringify(error)}`, {
          variant: 'error',
        });
      });
      selectedActivity.default_value = result.data.getReservation;
      setSelected(selectedActivity);
      setOpen(true);
    } else {
      let result = await API.graphql(
        graphqlOperation(getActivityData, {
          input: {
            client_id: session.client_id,
            person_id: patient.person_id,
            event_id: '',
            activity_type: '$$' + activity.code,
            limit: limit,
            fact_data: false,
            includeEvents: true,
            history_only: false,
            use_short_date: isMobile,
          },
        })
      ).catch(error => {
        enqueueSnackbar(`We had a problem getting current information: ${error}`, {
          variant: 'error',
        });
      });
      setSelected(result.data.getActivityData[0]);
      selectedActivityName = activity.name;
      setOpen(true);
    }
  };

  const handleAddFavorite = async activity => {
    let instruction = {
      patient_id: session.patient_id || session.user_id,
      activity_key: '___addToFavorites___',
      value: activity.code,
      session: {
        user_id: session.user_id,
        session_id: session.session_id,
      },
    };
    await API.graphql(graphqlOperation(createPutFact, { input: instruction }));
    addedAFavorite = false;
  };

  const onSaveFact = async newFact => {
    let sVal = '';
    let mVal = '';
    let constructedValue = '';
    let constructedQualifier = [];
    setConfirmation(false);
    let showMessage = true;
    let dataType = typeof newFact.value;
    if (dataType === 'string') {
      let writtenFact = await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
      setLastWrittenFact(writtenFact.data.createPutFact);
      [, constructedValue] = newFact.value.replace('.', '^').split('^');
    } else {
      if (newFact.hasOwnProperty('value') && newFact.value) {
        if (newFact.value.hasOwnProperty('selected')) {
          let valueSelectedObject = newFact.value.selected;
          let qualObject = newFact.value.qualifiers;
          let freeTextObject = newFact.value.freeText;
          setFreeText(freeTextObject);
          let associationsObject = newFact.value.associations;
          let masterKey = newFact.activity_key;
          let separator = '';
          //          let qualSeparator = '';
          let fOL = valueSelectedObject.length;
          if (newFact.activity_key.startsWith('form.')) {
            if (newFact.status && newFact.status === 'confirmed') {
              for (let f = 0; f < fOL; f++) {
                mVal = valueSelectedObject[f];
                if (!freeTextObject.hasOwnProperty(mVal)) {
                  constructedValue += separator + mVal;
                  separator = ' ~ ';
                  if (qualObject && qualObject[mVal] && qualObject[mVal] !== '') {
                    constructedQualifier.push(mVal + ':' + qualObject[mVal]);
                  }
                }
              }
              for (const [key, value] of Object.entries(freeTextObject)) {
                if (key !== '%filter%') {
                  constructedValue += separator + key + ' = ' + value;
                  separator = ' ~ ';
                }
              }
              newFact.activity_key = masterKey;
              newFact.value = 'form_selections.' + constructedValue;
              if (constructedQualifier.length > 0) {
                newFact.qualifier = constructedQualifier;
              } else {
                if (newFact.hasOwnProperty('qualifier')) {
                  delete newFact.qualifier;
                }
              }
              let writtenFact = await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
              setLastWrittenFact(writtenFact.data.createPutFact);
            } else {
              setConfirmation(true);
              showMessage = false;
            }
          } else {
            for (let f = 0; f < fOL; f++) {
              mVal = valueSelectedObject[f];
              constructedValue += separator + mVal;
              separator = ' ~ ';
              if (qualObject && qualObject[mVal] && qualObject[mVal] !== '') {
                newFact.qualifier = qualObject[mVal];
              } else {
                if (newFact.hasOwnProperty('qualifier')) {
                  delete newFact.qualifier;
                }
              }
              newFact.activity_key = masterKey;
              newFact.value = 'selection.' + mVal;
              let writtenFact = await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
              setLastWrittenFact(writtenFact.data.createPutFact);
              if (associationsObject && associationsObject.hasOwnProperty(mVal)) {
                newFact.value = 'association.' + mVal;
                newFact.activity_key = associationsObject[mVal];
                await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
              }
            }
          }
        } else if (newFact.value.hasOwnProperty('event_code')) {
          constructedValue = '';
          let nS = newFact.value.slot.length;
          for (let s = 0; s < nS; s++) {
            if (newFact.value.slot[s].hasOwnProperty('action')) {
              if (newFact.value.slot[s].action) {
                constructedValue +=
                  'ID ' + newFact.value.slot[s].identifier + ' ' + newFact.value.slot[s].action + ' ~ ';
              }
              delete newFact.value.slot[s].action;
            }
          }
          if (constructedValue) {
            constructedValue += '*END*';
            let writtenFact = await API.graphql(graphqlOperation(createPutFact, { input: newFact }));
            writtenFact.data.createPutFact.value = 'update.' + constructedValue;
            setLastWrittenFact(writtenFact.data.createPutFact);
            await API.graphql(graphqlOperation(updateReservation, { input: newFact.value })).catch(error => {
              enqueueSnackbar(
                `Uh oh! We couldn't update that.  You may want to check, and try again: ${JSON.stringify(
                  error.message || error.errors[0].message
                )}`,
                {
                  variant: 'error',
                }
              );
            });
          }
        }
      }
    }
    sVal = constructedValue || '~~ no value ~~';

    setNewFact(newFact);
    setLimit(limit);
    setOpen(false);

    if (showMessage) {
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
    }
    selectedActivityName = '';
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
        if (event !== lastEvent || type !== lastType || limit !== lastLimit) {
          result = await API.graphql(
            graphqlOperation(getActivityData, {
              input: {
                client_id: session.client_id,
                person_id: patient.person_id,
                event_id: event,
                activity_type: type,
                limit: limit,
                fact_data: false,
                includeEvents: true,
                history_only: false,
                use_short_date: isMobile,
              },
            })
          ).catch(error => {
            setLoading(false);
            enqueueSnackbar(`Whoops! Something went wrong when fetching activity data: ${error.message}`, {
              variant: 'error',
            });
          });
          setLastEvent(event);
          setLastType(type);
          setLastLimit(limit);
        } else {
          result = {
            data: { getActivityData: activities },
          };
        }

        if (mounted) {
          setLoading(false);
          if (Object.keys(lastWrittenFact).length > 0) {
            let [findAKey] = lastWrittenFact.activity_key.split('#');
            result.data.getActivityData.some((checkObj, aIndex) => {
              if (checkObj.code !== findAKey) {
                return false;
              }
              result.data.getActivityData[aIndex].fact_history = [lastWrittenFact];
              result.data.getActivityData[aIndex].observation_status = 'Updated moments ago';
              [, result.data.getActivityData[aIndex].most_recent_observation] = lastWrittenFact.value
                .replace('.', '^')
                .split('^');
              setLastWrittenFact({});
              return true;
            });
          }
          setActivities(result.data.getActivityData);
          if (event === '' && type === DEFAULT_TYPE) {
            setHomeState('home');
          } else {
            if (type.includes('%')) {
              setHomeState('search');
            } else {
              setHomeState('event');
            }
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
  }, [patient, session, event, type, limit, newFact, showConfirmation, lastWrittenFact]); // eslint-disable-line react-hooks/exhaustive-deps

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
            display={isMobile ? 'none' : 'flex'}
            grow={1}
            justifyContent='flex-start'
            alignItems='center'>
            <Typography variant='h6' className={classes.title}>
              Activities
            </Typography>
          </Box>
          <Box pl={5} display='flex'>
            <Button
              color='secondary'
              size='small'
              variant='contained'
              startIcon={<AssignmentTurnedInOutlinedIcon />}
              onClick={doneWithEvent}>
              {homeState === 'event' ? 'Done' : homeState === 'search' ? 'Home' : 'Refresh'}
            </Button>
          </Box>
          <Box paddingLeft={1} className={classes.search}>
            <SearchIcon />
            <InputBase
              type='text'
              placeholder='Search…'
              value={searchString}
              onChange={onSearch}
              onKeyPress={checkEnter}
              classes={{
                root: classes.inputRoot,
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
                          <Typography variant='h5'>{activity.name}</Typography>
                          <Box
                            alignSelf='center'
                            flexDirection='row'
                            paddingLeft={5}
                            display={
                              activity.hasOwnProperty('default_value') &&
                              activity.default_value &&
                              !activity.default_value.includes('.')
                                ? 'flex'
                                : 'none'
                            }>
                            <Button onClick={onChooseDefault} className={classes.defaultButton}>
                              <Typography noWrap>{activity.default_value}</Typography>
                            </Button>
                          </Box>
                        </Box>
                        <Box display={activity.most_recent_observation ? 'block' : 'none'}>
                          {activity.observation_status && activity.observation_status.includes('(exp)') ? (
                            <Typography variant='body2'>
                              No current data - Last {activity.observation_status.replace('(exp)', '')}
                            </Typography>
                          ) : (
                            <Typography variant='body2'>
                              {activity.most_recent_observation} - {activity.observation_status}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <Box
                        alignSelf='center'
                        flexDirection='row'
                        color='white'
                        display={activity.reason.startsWith('Search') ? 'flex' : 'none'}>
                        <IconButton
                          aria-label='add to favorites'
                          onClick={() => {
                            addedAFavorite = true;
                            handleAddFavorite(activity);
                          }}>
                          <AddToQueueOutlinedIcon />
                        </IconButton>
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
          fromHome={homeState}
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
              activity.observation_expires && activity.observation_expires < timeNow ? (
                <Typography key={activity.name}>
                  <Box key={activity.name + '.name'} pt={2}>
                    {activity.name + ':  (no data)'}
                  </Box>
                </Typography>
              ) : (
                <Typography key={activity.name}>
                  <Box key={activity.name + '.name'} pt={2}>
                    {activity.name + ':'}
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
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={showConfirmation}
        onClose={handleSummaryBack}
        scroll='paper'
        fullWidth={true}
        aria-labelledby='scroll-dialog-title'
        aria-describedby='scroll-dialog-description'>
        <DialogTitle id='scroll-dialog-title' className={classes.descriptionText}>
          {selected ? selected.name : null}
        </DialogTitle>
        <DialogContent dividers={true} className={classes.descriptionText}>
          <DialogContentText id='scroll-dialog-description' tabIndex={-1}>
            {newFact && newFact.value && newFact.value.selected
              ? newFact.value.selected.map(selectedValue => (
                  <Typography key={selectedValue}>
                    {newFact.value.freeText[selectedValue] ? null : (
                      <Box key={selectedValue + '.value'} pt={2} fontWeight='fontWeightBold'>
                        {selectedValue.split(':')[0]}
                      </Box>
                    )}
                    {newFact.value.qualifiers &&
                    !newFact.value.freeText[selectedValue] &&
                    newFact.value.qualifiers.hasOwnProperty(selectedValue) ? (
                      <Box key={selectedValue + '.qualifier'} pl={2} fontSize='0.8rem'>
                        {newFact.value.qualifiers[selectedValue].join(' ~ ')}
                      </Box>
                    ) : null}
                  </Typography>
                ))
              : null}
          </DialogContentText>
          <DialogContentText id='scroll-dialog-description' tabIndex={-1}>
            {newFact && newFact.value && newFact.value.freeText
              ? Object.keys(newFact.value.freeText).map(selectedValue =>
                  !selectedValue.startsWith('%filter%') ? (
                    <Typography key={selectedValue}>
                      <Box key={selectedValue + '.name'} pt={2} fontWeight='fontWeightBold'>
                        {selectedValue}
                      </Box>
                      <Box key={selectedValue + '.value'} pl={2} fontSize='0.8rem'>
                        {newFact.value.freeText[selectedValue]}
                      </Box>
                    </Typography>
                  ) : null
                )
              : null}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button className={classes.reject} size='small' variant='contained' onClick={handleConfirmBack}>
            Back
          </Button>
          <Button variant='contained' className={classes.confirm} size='small' onClick={handleConfirmSubmit}>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};
