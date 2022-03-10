import React from 'react';

// import "react-datepicker/dist/react-datepicker.css";

import Grid from '@material-ui/core/Grid';
import GridList from '@material-ui/core/GridList';
import GridListTile from '@material-ui/core/GridListTile';

import { Lambda } from 'aws-sdk';
import { useSnackbar } from 'notistack';


import Box from '@material-ui/core/Box';
import CheckCircleIcon from '@material-ui/icons/CheckCircle';
import CancelIcon from '@material-ui/icons/Cancel';
import Paper from '@material-ui/core/Paper';
import Typography from '@material-ui/core/Typography';
import makeStyles from '@material-ui/core/styles/makeStyles';

import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';

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
    noDisplay: {
        display: 'none',
        visibility: 'hidden'
    },
    defaultButton: {
        alignSelf: 'end',
        variant: 'outlined',
        verticalAlign: 'end',
        backgroundColor: theme.palette.confirm[theme.palette.type],
    },
    confirm: {
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

let working_date = '';

export default ({ myCalendar, person_id, display_name }) => {
    const classes = useStyles();

    const lambda = new Lambda({
        region: 'us-east-1',
        accessKeyId: process.env.REACT_APP_AVA_ID,
        secretAccessKey: process.env.REACT_APP_AVA_KEY,
    });

    const { enqueueSnackbar } = useSnackbar();

    function formatDate(pDate) {
        let yyyy = pDate.substr(0, 4);
        let mm = pDate.substr(4, 2);
        let dd = pDate.substr(6, 2);
        let dDate = new Date(yyyy, Number(mm) - 1, dd);
        let rString = dDate.toDateString();
        return rString;
    }

    const handleSeatSignup = (pEvent) => {
        console.log(pEvent);
        return;
    };

    const handleTimeSignup = async (pEvent, pSlot) => {
        let invokeFailed = false;
        let releaseSlot = false;
        let reserveSlot = false;
        if (!pSlot.owner || (pSlot.owner === 'available')) {
            reserveSlot = true;
        }
        else if (pSlot.owner === person_id) {
            releaseSlot = true;
        }
        else { return }  // clicked a slot not owner by the current user
        var payload = {
            action: "sign_up",
            clientId: pEvent.client,
            sign_up: {
                "event_key": pEvent.event_key,
                "slot_id": pSlot.id,
                "owner": releaseSlot ? 'available' : person_id,
                "requestor": releaseSlot ? 'available' : person_id,
                "display_name": releaseSlot ? null : display_name,
                "new_list_key": (releaseSlot ? 'available' : person_id) + '#' + pEvent.schedule_key,
            }
        };
        let params = {
            FunctionName: 'arn:aws:lambda:us-east-1:125549937716:function:CalendarMaintenance',
            InvocationType: 'RequestResponse',
            LogType: 'Tail',
            Payload: JSON.stringify(payload)
        };
        const fResp = await lambda
            .invoke(params)
            .promise()
            .catch(err => {
                console.log("AVA couldn't save this event.  Error is", JSON.stringify(err));
                enqueueSnackbar(`AVA couldn't save this event.  Error is ${err.message}`, {
                    variant: 'error'
                });
                invokeFailed = true;
            });
        if (!invokeFailed && JSON.parse(fResp.Payload).status === 200) {
            enqueueSnackbar(`Slot is (releaseSlot ? 'available' : person_id)!`, {
                variant: 'success'
            });
        };
        return;
    };

    return (
        <Box p={3}  >
            <Grid md={12} sm={12} xs={12} item>
                <GridList cellHeight='auto' cols={1}>
                    {!myCalendar || myCalendar.length === 0
                        ? null
                        : myCalendar.map((this_event, index) => (
                            <GridListTile
                                key={this_event.id + 'r' + index}
                                style={{ marginBottom: '0px', marginTop: '0px' }}
                                cols={1}
                            >
                                {this_event.occData.date === working_date ? null :
                                    <Paper mt={3} mb={0} component={Box} variant={'outlined'}>
                                        <Box mb={0} py={1} px={3} borderBottom={2}>
                                            <Box flexGrow={1}>
                                                <Typography
                                                    className={classes.noDisplay}
                                                >
                                                    {working_date = this_event.occData.date}
                                                </Typography>
                                                <Typography variant='h6'>
                                                    {formatDate(working_date)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Paper>
                                }

                                <Paper
                                    component={Box}
                                    p={2}
                                    mt={0} mb={1}
                                    variant='outlined'
                                    style={{ background: this_event, marginBottom: '0px', marginTop: '0px' }}
                                    textAlign='left'
                                    onClick={() => {
                                        // onChooseCalendar(this_event);
                                    }}
                                    square>
                                    <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                        <Box display='flex' flexDirection='column' className={classes.activityText} width='95%' textOverflow='ellipsis'>
                                            <React.Fragment key={`act_box_${this_event.id}`}>
                                                <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                                    <Box display='flex' flexDirection='column'>
                                                        <Typography variant='h6'>{this_event.occData.time_from}</Typography>
                                                        <Typography variant='body2'>{this_event.occData.time_to}</Typography>
                                                    </Box>
                                                    <Box display='flex' flexGrow={1} flexDirection='column' ml={2}>
                                                        <Typography variant='h5'>{this_event.occData.description}</Typography>
                                                        {this_event.occData.location ? <Typography variant='body2'>{this_event.occData.location}</Typography> : null}
                                                    </Box>
                                                </Box>
                                                {this_event.slots[0].owner === person_id
                                                    ? (this_event.calData.signup_type === 'time'
                                                        ?
                                                        <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                                            <Typography variant='subtitle2'>
                                                                You are signed-up for {Math.floor((this_event.slots[0].id - (this_event.slots[0].id > 1299 ? 1200 : 0)) / 100).toString() + ':' + ('0' + (this_event.slots[0].id % 100).toString()).substr(-2)}.  Tap to remove or select another time.
                                                            </Typography>
                                                        </Box>
                                                        :
                                                        <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                                            <Typography variant='subtitle2'>
                                                                You are signed-up for this event!  Tap to remove your registration.
                                                            </Typography>
                                                            <Button sx={{ backgroundColor: 'red' }} startIcon={<CancelIcon />}>
                                                            </Button>
                                                        </Box>
                                                    )
                                                    : (this_event.calData.signup_type === 'none'
                                                        ? null
                                                        : (
                                                            this_event.calData.signup_type === 'time' ?
                                                                <Box display='flex' flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                                                    <Typography variant='subtitle2'>
                                                                        This event requires you to sign-up.  Choose a time below.
                                                                    </Typography>                                                                </Box>
                                                                :
                                                                <Box display='flex'
                                                                    flexDirection='row'
                                                                    justifyContent='flex-start'
                                                                    alignItems='center'
                                                                    onClick={handleSeatSignup(this_event)}
                                                                >
                                                                    <Typography variant='subtitle2'>
                                                                        This event requires you to sign-up.  Check here to reserve your spot!
                                                                    </Typography>
                                                                    <Button sx={{ backgroundColor: 'green' }} startIcon={<CheckCircleIcon />}>
                                                                    </Button>
                                                                </Box>
                                                        )
                                                    )
                                                }
                                                {(this_event.calData.signup_type !== 'time') ? null :
                                                    <Box display='flex' mt={2} flexDirection='row' justifyContent='flex-start' alignItems='center'>
                                                        <ButtonGroup variant="text" aria-label="text button group">
                                                            {this_event.slots.map((this_slot, index) => (
                                                                index === 0 ? null :
                                                                    <Button
                                                                        key={'time_button' + this_slot.id + this_event.occData.date}
                                                                        disabled={this_slot.owner && (this_slot.owner !== person_id) && (this_slot.owner !== '') && (this_slot.owner !== 'available')}
                                                                        variant={this_slot.owner === person_id ? "contained" : "text"}
                                                                        className={this_slot.owner === person_id ? classes.confirm : null}
                                                                        onClick={() => {
                                                                            handleTimeSignup(this_event, this_slot);
                                                                        }}
                                                                    >
                                                                        {Math.floor((this_slot.id - (this_slot.id > 1299 ? 1200 : 0)) / 100).toString() + ':' + ('0' + (this_slot.id % 100).toString()).substr(-2)}
                                                                    </Button>

                                                            ))};
                                                        </ButtonGroup>
                                                    </Box>
                                                }
                                            </React.Fragment>
                                        </Box>
                                    </Box>
                                </Paper>
                            </GridListTile>
                        ))}

                </GridList>
            </Grid>

        </Box>
    );
};