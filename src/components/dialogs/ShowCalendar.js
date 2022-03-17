import React from 'react';

import { API, graphqlOperation } from 'aws-amplify';

import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Input from '@material-ui/core/Input';
import SearchIcon from '@material-ui/icons/Search';
import InputAdornment from '@material-ui/core/InputAdornment';

import CalendarForm from '../forms/CalendarForm';

import { getCalendar } from '../../graphql/queries';
import useMediaQuery from '@material-ui/core/useMediaQuery';

const useStyles = makeStyles(theme => ({
  title: {
    marginLeft: theme.spacing(2),
    marginRight: theme.spacing(2),
    flexGrow: 1
  },
  formControl: {
    margin: 0,
    paddingTop: 0,
  },
  formControlLbl: {
    margin: 0,
    paddingTop: 0,
    height: theme.spacing(2.5),
  },
  picture: {
    width: theme.spacing(16),
    height: theme.spacing(16),
    [theme.breakpoints.down('xs')]: {
      width: theme.spacing(8),
      height: theme.spacing(8),
    },
  },
  photoButton: {
    alignSelf: 'center',
    size: 'sm',
    variant: 'outlined',
    verticalAlign: 'middle',
  },
  defaultButton: {
    alignSelf: 'end',
    variant: 'outlined',
    verticalAlign: 'end',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  topButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.confirm[theme.palette.type],
  },
  resetButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.confirm[theme.palette.type],
    marginRight: 10,
  },
  infoButton: {
    variant: 'outlined',
    backgroundColor: theme.palette.info[theme.palette.type],
    marginRight: 10,
    paddingRight: 10,
    marginLeft: 10,
    paddingLeft: 10,
  },
  radioText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  idText: {
    fontSize: theme.typography.fontSize * 0.8,
    marginTop: 10,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 10,
  },
  radioButton: {
    marginTop: 0,
    marginRight: 0,
    marginLeft: 0,
    paddingLeft: 0,
    paddingRight: 5,
  },
}));

const Transition = React.forwardRef((props, ref) => <Slide direction='up' ref={ref} {...props} />);

export default ({ patient, currentEvents, showCalendar, onClose }) => {
  const [myCalendar, setMyCalendar] = React.useState([]);
  const [filterText, setFilterText] = React.useState('');
  const [myFilter, setMyFilter] = React.useState('');

  const classes = useStyles();

  const [changes, setChanges] = React.useState(false);
  if (changes) { console.log(changes); }

  const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
  if (isMobile) { console.log(isMobile); }

  const AWS = require('aws-sdk');
  AWS.config.update({ region: 'us-east-1' });

  React.useEffect(() => {
    return (async () => {
      let invokeFailed = false;
      let rightNow = new Date();
      let event_time = rightNow.getTime();
      let this_year = rightNow.getFullYear();
      let this_month = rightNow.getMonth() + 1;
      let this_date = rightNow.getDate();
      let twoWeeksFromNow = new Date(rightNow.setDate(this_date + 14));
      let fortnight_year = twoWeeksFromNow.getFullYear();
      let fortnight_month = twoWeeksFromNow.getMonth() + 1;
      let fortnight_date = twoWeeksFromNow.getDate();
      let result = await API
        .graphql(
          graphqlOperation(getCalendar, {
            input: {
              "action": `list_events#${event_time}`,
              "clientId": patient.client_id,
              "list_start": ((this_year * 10000) + (this_month * 100) + this_date).toString(),
              "list_end": ((fortnight_year * 10000) + (fortnight_month * 100) + fortnight_date).toString(),
              "person_id": patient.patient_id
            }
          })
        )
        .catch(error => {
          console.log(error);
          invokeFailed = true;
        });
      let theCalendar = [];
      if (!invokeFailed) {
        result.data.getCalendar.body.forEach(cEv => {
          theCalendar.push(cEv);
        });
      };
      setMyCalendar(theCalendar);
      return theCalendar;
    });
  }, [currentEvents]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCheckEnter = event => {
    if (event.key === 'Enter' || event.type === 'blur') {
      handleFilterText(event.target.value);
    }
  };

  const onChangeFilterText = event => {
    setFilterText(event.target.value);
    // var resetter = formState + 1;
    // setFormState(resetter);
  };

  const handleFilterText = event => {
    setMyFilter(filterText);
    // var resetter = formState + 1;
    // setFormState(resetter);
  };

  const handleAbort = () => {
    setChanges(false);
    onClose();
  };

  // **************************

  return (
    showCalendar ?
      <Dialog
        open={showCalendar}
        onClose={handleAbort}
        TransitionComponent={Transition}
        fullScreen
      >
        <AppBar>
          <Toolbar>
            <IconButton color='inherit' edge='start' onClick={handleAbort}>
              <CloseIcon />
            </IconButton>
            {isMobile ? null :
              <Typography variant='h6' className={classes.title}>
                {`Current Events`}
              </Typography>
            }
            <Box display='flex' flexDirection='row' mr={isMobile ? 0 : 5}>
              <Input
                id='event_search'
                type='text'
                variant={'contained'}
                style={{ flexGrow: 1, marginRight: 5 }}
                onKeyPress={onCheckEnter}
                onBlur={onCheckEnter}
                onChange={onChangeFilterText}
                startAdornment={
                  <InputAdornment position="start">
                    Search
                  </InputAdornment>
                }
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => { handleFilterText(filterText); }}
                      edge="end"
                    >
                      {<SearchIcon />}
                    </IconButton>
                  </InputAdornment>
                }
                autoComplete='off'
                value={filterText}
              />
            </Box>
            {isMobile ? null :
              <Button
                onClick={handleAbort}
                variant='contained'
                className={classes.topButton}
              >
                Done
              </Button>
            }
          </Toolbar>
        </AppBar>
        <Toolbar />
        <Box m={2}>
          <CalendarForm
            myCalendar={myCalendar}
            person_id={patient.patient_id}
            display_name={patient.patient_display_name}
            filter={myFilter}
          />
        </Box>
      </Dialog>
      : null
  );
};
