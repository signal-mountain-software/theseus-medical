import React from 'react';
import { API, graphqlOperation } from 'aws-amplify';

import { useSnackbar } from 'notistack';

import { getCalendar } from '../../graphql/queries';

import "react-datepicker/dist/react-datepicker.css";

import AppBar from '@material-ui/core/AppBar';
import Box from '@material-ui/core/Box';
import CloseIcon from '@material-ui/icons/Close';
import Dialog from '@material-ui/core/Dialog';
import IconButton from '@material-ui/core/IconButton';
import Paper from '@material-ui/core/Paper';
import Slide from '@material-ui/core/Slide';
import Toolbar from '@material-ui/core/Toolbar';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import CalendarForm from '../forms/CalendarForm';

import Button from '@material-ui/core/Button';

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
    let myCalendar = [];

    const classes = useStyles();

    const [signup_type, setSignUpType] = React.useState('none');
    console.log(signup_type);

    const [currentEventsDisplay, setCurrentEvents] = React.useState(currentEvents);
    
    const { enqueueSnackbar } = useSnackbar();

    // const [patientGroups, setPatientGroups] = React.useState();

    const [changes, setChanges] = React.useState(false);
    console.log(changes);

    const isMobile = useMediaQuery(theme => theme.breakpoints.down('xs')); // checks if current device is a smart phone
    console.log(isMobile);

    const AWS = require('aws-sdk');
    AWS.config.update({ region: 'us-east-1' });

    let working_date = '';

    React.useEffect(() => { 
        setCurrentEvents(currentEvents);
        currentEvents.forEach(cEv => { myCalendar.push(cEv); });
    }, [currentEvents]);

    /*
        const runCalendarQuery = async () => {
            let invokeFailed = false;
            let rightNow = new Date();
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
                            "action": "list_events",
                            "clientId": patient.client_id,
                            "list_start": ((this_year * 10000) + (this_month * 100) + this_date).toString(),
                            "list_end": ((fortnight_year * 10000) + (fortnight_month * 100) + fortnight_date).toString(),
                            "person_id": patient.person_id
                        }
                    })
                )
                .catch(error => {
                    enqueueSnackbar(`We had a problem getting current information: ${error.errors[0].message}`, {
                        variant: 'error',
                    });
                    invokeFailed = true;
                });
            if (!invokeFailed) {
                setCurrentEvents(result.data.getCalendar.body);
                currentEvents = result.data.getCalendar.body;
                return result.data.getCalendar.body;
            }
            else { return []; };
        };
    */

    const handleAbort = () => {
        setChanges(false);
        onClose();
    };

    const handleSignUp = event => {
        setSignUpType(event.target.value);
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
                        <Typography variant='h6' className={classes.title}>
                            {`Current Events`}
                        </Typography>
                    </Toolbar>
                </AppBar>
                <Toolbar />
                <Box m={2}>
                    <CalendarForm
                        myCalendar={myCalendar}
                        person_id={patient.person_id}
                    />
                </Box>
            </Dialog>
            : null
    );
};
