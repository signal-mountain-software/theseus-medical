import React from 'react';

import { dbClient, getMarqueeMessage } from '../../util/AVAUtilities';
import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { makeDate } from '../../util/AVADateTime';
import { getGroup } from '../../util/AVAGroups';
import { createNotification, updateNotification, listNotificationsForClient, listNotificationViewers, cancelNotification, resetNotificationViewer, resetAllNotificationViewers } from '../../util/AVANotifications';
import { makeName } from '../../util/AVAPeople';
import AVAConfirm from '../forms/AVAConfirm';
import RichTextEditor from '../forms/RichTextEditor';
import QuickSearch from '../sections/QuickSearch';

import { TextField, Button, Typography, Paper, Box, Chip, Divider, List, ListItem, ListItemText, IconButton } from '@material-ui/core';
import { RadioGroup, Radio, FormControl, FormControlLabel, Checkbox } from '@material-ui/core';
import { Dialog, DialogActions, DialogContent } from '@material-ui/core';

import { useSnackbar } from 'notistack';

import CloseIcon from '@material-ui/icons/Close';
import DeleteIcon from '@material-ui/icons/TimerOff';
import AddIcon from '@material-ui/icons/Add';
import VisibilityIcon from '@material-ui/icons/Visibility';
import ReplayIcon from '@material-ui/icons/Replay';
import makeStyles from '@material-ui/core/styles/makeStyles';

import useSession from '../../hooks/useSession';

// The three named star-values that can appear as access rules in available_to
// and need to be selectable (and pre-selected) in the QuickSearch dialog.
const SPECIAL_ACCESS_VALUES = [
    { person_id: '*all', first: '* Everybody', last: '' },
    { person_id: '*admin', first: '* Administrators', last: '' },
    { person_id: '*support', first: '* Support Staff', last: '' },
];

const EMPTY_FORM_STATE = {
    editingNotificationId: null,
    title: '',
    message: '',
    priority: 'medium',
    dismissible: true,
    persistUntilDismissed: true,
    playSound: false,
    actionUrl: '',
    dontShowBeforeDisplay: '',
    dontShowAfterDisplay: '',
    StartAsADateObj: {},
    EndAsADateObj: {},
    availableTo: ['*all'],
    selections: [],
    viewerList: [],
    viewerListLoading: false,
    // Marquee-only fields (targeting reuses availableTo/selections, shared with Notifications)
    criticalMessage: false,
    priorityMessage: false,
};

// Describes a notification's lifecycle state for the list badge, and whether
// it can still be cancelled (i.e. hasn't already been cancelled or expired).
const describeStatus = (notificationRec) => {
    const now = Date.now();
    if (notificationRec.status === 'cancelled') {
        return { label: 'Cancelled', color: '#9e9e9e', cancellable: false };
    }
    if (notificationRec.dont_show_after && new Date(notificationRec.dont_show_after).getTime() < now) {
        return { label: 'Expired', color: '#9e9e9e', cancellable: false };
    }
    if (notificationRec.dont_show_before && new Date(notificationRec.dont_show_before).getTime() > now) {
        return { label: 'Upcoming', color: '#1565c0', cancellable: true };
    }
    return { label: 'Active', color: '#2e7d32', cancellable: true };
};

const useStyles = makeStyles(theme => ({
    freeInput: {
        marginLeft: theme.spacing(1),
        marginTop: '15px',
        marginRight: 2,
        marginBottom: '10px',
        paddingLeft: 0,
        paddingRight: 0,
        width: '90%',
        verticalAlign: 'middle',
        fontSize: theme.typography.fontSize * 0.4,
        minHeight: theme.typography.fontSize * 2.8,
    },
    dialogBox: {
        paddingTop: 0,
        paddingLeft: 0,
        paddingBottom: theme.spacing(1),
        minWidth: '100%',
        overflowX: 'hidden',
    },
    radioText: {
        fontSize: theme.typography.fontSize * 0.8,
        marginLeft: 0,
        paddingLeft: 0,
        paddingRight: 10,
    },
    sectionPaper: {
        borderRadius: '16px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.06)',
    },
    sectionHeader: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: theme.spacing(2),
    },
    listRow: {
        borderRadius: '10px',
        marginBottom: theme.spacing(1),
        border: '1px solid rgba(0,0,0,0.08)',
        '&.Mui-selected, &.Mui-selected:hover': {
            backgroundColor: 'rgba(46, 125, 50, 0.08)',
            border: '1px solid rgba(46, 125, 50, 0.4)',
        },
    },
}));

export default ({ initialMode, showNewEvent, onClose }) => {
    const classes = useStyles();
    const AVAClass = AVAclasses();

    const { state } = useSession();

    const { closeSnackbar, enqueueSnackbar } = useSnackbar();

    const [reactData, setReactData] = React.useState({
        mode: (initialMode === 'marquee') ? 'marquee' : 'notification',
        notificationList: [],
        marqueeList: [],
        groupInfo: null,
        special_values: SPECIAL_ACCESS_VALUES,
        showAccessSearch: false,
        cancelPendingId: false,
        cancelPendingText: '',
        resetPendingUserId: false,
        resetPendingName: '',
        resetAllPending: false,
        stopPendingKey: false,
        stopPendingText: '',
        saving: false,
        ...EMPTY_FORM_STATE
    });

    const [, setForceRedisplay] = React.useState(false);
    const updateReactData = (newData, force = false) => {
        setReactData((prevValues) => (Object.assign(
            prevValues,
            newData
        )));
        if (force) { setForceRedisplay(forceRedisplay => !forceRedisplay); }
    };

    React.useEffect(() => {
        async function initialize() {
            const [notificationList, marqueeRaw] = await Promise.all([
                listNotificationsForClient({ dbClient, clientId: state.session.client_id }),
                getMarqueeMessage(state.session.client_id, { futureOK: true, rawData: true })
            ]);
            for (let m = 0; m < marqueeRaw.length; m++) {
                if (marqueeRaw[m].groups && (marqueeRaw[m].groups.length > 0)) {
                    marqueeRaw[m].groupNames = [];
                    for (let g = 0; g < marqueeRaw[m].groups.length; g++) {
                        const gObj = await getGroup(marqueeRaw[m].groups[g]);
                        marqueeRaw[m].groupNames.push(gObj.name);
                    }
                }
            }
            updateReactData({ notificationList, marqueeList: marqueeRaw }, true);
        }
        initialize();
    }, []);  // eslint-disable-line react-hooks/exhaustive-deps

    const describeAvailableTo = (available_to) => {
        const rules = available_to || [];
        if (rules.length === 0) { return 'No access assigned'; }
        const starRules = rules.filter(r => r.trimStart().startsWith('*'));
        const groupIds = rules.filter(r => r.startsWith('group:'));
        const personIds = rules.filter(r => r.startsWith('person:'));
        const parts = [];
        if (starRules.length > 0) { parts.push(...starRules); }
        if (groupIds.length > 0) { parts.push(`${groupIds.length} Group${groupIds.length === 1 ? '' : 's'}`); }
        if (personIds.length > 0) { parts.push(`${personIds.length} ${personIds.length === 1 ? 'Person' : 'People'}`); }
        return parts.length > 0 ? parts.join(', ') : 'Everyone';
    };

    const handleAbort = () => {
        onClose();
    };

    function OK2Save() {
        const plainTextMessage = reactData.message.replace(/<[^>]*>/g, '').trim();
        return (plainTextMessage !== '')
            && (!reactData.StartAsADateObj || !reactData.StartAsADateObj.error)
            && (!reactData.EndAsADateObj || !reactData.EndAsADateObj.error);
    }

    const switchMode = (newMode) => {
        updateReactData({ mode: newMode, ...EMPTY_FORM_STATE }, true);
    };

    const resolveFromDate = vCheck => {
        if (!vCheck) {
            updateReactData({ dontShowBeforeDisplay: '', StartAsADateObj: {} }, true);
            return;
        }
        let goodDate = makeDate(vCheck);
        if (!goodDate.error) {
            updateReactData({
                dontShowBeforeDisplay: goodDate.absolute,
                StartAsADateObj: goodDate
            }, true);
        }
    };

    const resolveToDate = vCheck => {
        if (!vCheck) {
            updateReactData({ dontShowAfterDisplay: '', EndAsADateObj: {} }, true);
            return;
        }
        let goodDate = makeDate(vCheck);
        if (!goodDate.error) {
            updateReactData({
                dontShowAfterDisplay: goodDate.absolute,
                EndAsADateObj: goodDate
            }, true);
        }
    };

    const resetForm = () => {
        updateReactData({ ...EMPTY_FORM_STATE }, true);
    };

    // Populate the create/edit form from an existing notification record and
    // load who has seen/dismissed it so far.
    const selectNotification = async (notificationRec) => {
        updateReactData({
            editingNotificationId: notificationRec.notification_id,
            title: notificationRec.title || '',
            message: notificationRec.message || '',
            priority: notificationRec.priority || 'medium',
            dismissible: notificationRec.dismissible !== false,
            persistUntilDismissed: notificationRec.persist_until_dismissed !== false,
            playSound: !!notificationRec.play_sound,
            actionUrl: notificationRec.action_url || '',
            dontShowBeforeDisplay: notificationRec.dont_show_before ? makeDate(notificationRec.dont_show_before).absolute : '',
            dontShowAfterDisplay: notificationRec.dont_show_after ? makeDate(notificationRec.dont_show_after).absolute : '',
            StartAsADateObj: notificationRec.dont_show_before ? makeDate(notificationRec.dont_show_before) : {},
            EndAsADateObj: notificationRec.dont_show_after ? makeDate(notificationRec.dont_show_after) : {},
            availableTo: notificationRec.available_to || ['*all'],
            selections: [],
            viewerList: [],
            viewerListLoading: true,
        }, true);

        const viewers = await listNotificationViewers({ dbClient, notificationId: notificationRec.notification_id });
        const resolvedViewers = await Promise.all(viewers.map(async viewer => ({
            ...viewer,
            name: await makeName(viewer.user_id)
        })));
        resolvedViewers.sort((a, b) => new Date(a.shown_at) - new Date(b.shown_at));
        updateReactData({ viewerList: resolvedViewers, viewerListLoading: false }, true);
    };

    // Create a new scrolling marquee message (marquee messages support create + stop-early only, no edit-in-place).
    // Targeting uses the same available_to rule format as Notifications; legacy records using the older
    // raw groups[] attribute are left untouched and are still honored for display/consumption elsewhere.
    const handleSaveMarquee = async () => {
        updateReactData({ saving: true }, true);
        const putMarquee = {
            client_id: state.session.client_id,
            message_key: new Date().getTime(),
            start_time: reactData.StartAsADateObj?.timestamp,
            end_time: reactData.EndAsADateObj?.timestamp,
            available_to: reactData.availableTo,
            message: reactData.message,
            style: (reactData.criticalMessage ? { color: 'red' } : ''),
            author: state.session.user_id,
            criticalMessage: reactData.criticalMessage,
            priorityMessage: reactData.priorityMessage
        };
        let goodPut = true;
        await dbClient.put({ Item: putMarquee, TableName: 'MarqueeMessages' }).promise().catch(error => {
            console.log(`caught error updating MarqueeMessages; error is:`, error);
            goodPut = false;
        });
        closeSnackbar();
        if (goodPut) {
            reactData.marqueeList.unshift(putMarquee);
            updateReactData({
                marqueeList: reactData.marqueeList,
                ...EMPTY_FORM_STATE,
                saving: false
            }, true);
            enqueueSnackbar(`Marquee message saved.`, { variant: 'success' });
        }
        else {
            updateReactData({ saving: false }, true);
            enqueueSnackbar(`Sorry.  AVA could not save this message!`, { variant: 'error' });
        }
    };

    const handleStopMarqueeMessage = async (messageKey) => {
        let worked = true;
        await dbClient.update({
            Key: { client_id: state.session.client_id, message_key: messageKey },
            UpdateExpression: 'set end_time = :now',
            ExpressionAttributeValues: { ':now': new Date().getTime() },
            TableName: 'MarqueeMessages',
        }).promise().catch(() => { worked = false; });
        if (worked) {
            const foundAt = reactData.marqueeList.findIndex(m => m.message_key === messageKey);
            if (foundAt > -1) { reactData.marqueeList.splice(foundAt, 1); }
        }
        updateReactData({
            marqueeList: reactData.marqueeList,
            stopPendingKey: false,
            stopPendingText: ''
        }, true);
    };

    const handleSave = async () => {
        if (reactData.mode === 'marquee') {
            await handleSaveMarquee();
            return;
        }
        updateReactData({ saving: true }, true);
        const existingRec = reactData.editingNotificationId
            ? reactData.notificationList.find(n => n.notification_id === reactData.editingNotificationId)
            : null;

        const notificationRec = {
            ...(existingRec ? {
                notification_id: existingRec.notification_id,
                client_id: existingRec.client_id,
                created_at: existingRec.created_at,
                status: existingRec.status
            } : {}),
            title: reactData.title.trim(),
            message: reactData.message,
            priority: reactData.priority,
            dismissible: reactData.dismissible,
            persist_until_dismissed: reactData.persistUntilDismissed,
            play_sound: reactData.playSound,
            ...(reactData.actionUrl.trim() ? { action_url: reactData.actionUrl.trim() } : {}),
            available_to: reactData.availableTo,
            ...(reactData.StartAsADateObj?.iso ? { dont_show_before: reactData.StartAsADateObj.iso } : {}),
            ...(reactData.EndAsADateObj?.iso ? { dont_show_after: reactData.EndAsADateObj.iso } : {}),
        };

        const result = existingRec
            ? await updateNotification({ dbClient, notificationRec })
            : await createNotification({ dbClient, state, session: state.session, notificationRec });

        closeSnackbar();
        if (result.success) {
            if (existingRec) {
                const foundAt = reactData.notificationList.findIndex(n => n.notification_id === existingRec.notification_id);
                if (foundAt > -1) { reactData.notificationList[foundAt] = result.notification; }
            }
            else {
                reactData.notificationList.unshift(result.notification);
            }
            updateReactData({
                notificationList: reactData.notificationList,
                ...EMPTY_FORM_STATE,
                saving: false
            }, true);
            enqueueSnackbar(`Notification saved.`, { variant: 'success' });
        }
        else {
            updateReactData({ saving: false }, true);
            enqueueSnackbar(`Sorry.  AVA could not save this notification!`, { variant: 'error' });
        }
    };

    const handleCancelNotification = async (notification_id) => {
        const worked = await cancelNotification({ dbClient, notificationId: notification_id });
        if (worked) {
            const foundAt = reactData.notificationList.findIndex(n => n.notification_id === notification_id);
            if (foundAt > -1) {
                reactData.notificationList[foundAt].status = 'cancelled';
            }
        }
        updateReactData({
            notificationList: reactData.notificationList,
            cancelPendingId: false,
            cancelPendingText: ''
        }, true);
    };

    // Un-dismiss a notification for one viewer so it will show for them again.
    const handleResetViewer = async (userId) => {
        const worked = await resetNotificationViewer({ dbClient, notificationId: reactData.editingNotificationId, userId });
        if (worked) {
            updateReactData({
                viewerList: reactData.viewerList.filter(v => v.user_id !== userId),
                resetPendingUserId: false,
                resetPendingName: ''
            }, true);
            enqueueSnackbar(`Reset. They will see this notification again.`, { variant: 'success' });
        }
        else {
            updateReactData({ resetPendingUserId: false, resetPendingName: '' }, true);
            enqueueSnackbar(`Sorry.  AVA could not reset that viewer.`, { variant: 'error' });
        }
    };

    // Un-dismiss a notification for every viewer so it will show for everyone again.
    const handleResetAllViewers = async () => {
        const worked = await resetAllNotificationViewers({ dbClient, notificationId: reactData.editingNotificationId });
        if (worked) {
            updateReactData({ viewerList: [], resetAllPending: false }, true);
            enqueueSnackbar(`Reset. Everyone will see this notification again.`, { variant: 'success' });
        }
        else {
            updateReactData({ resetAllPending: false }, true);
            enqueueSnackbar(`Sorry.  AVA could not reset the viewers.`, { variant: 'error' });
        }
    };

    return (
        <Dialog
            open={true}
            onClose={handleAbort}
            fullScreen
        >
            <React.Fragment>
                <Box m={2}>
                    <Typography style={AVATextStyle({
                        size: 1.3, bold: true, margin: {
                            bottom: 1,
                            top: 1,
                        }
                    })}>
                        {'Manage Notifications & Marquee Messages'}
                    </Typography>
                    <FormControl component='fieldset' style={{ marginTop: 4 }}>
                        <RadioGroup row value={reactData.mode} onChange={(event) => switchMode(event.target.value)}>
                            <FormControlLabel
                                value='notification'
                                control={<Radio color='primary' size='small' />}
                                label={<Typography className={classes.radioText}>{'Notification (pop-up)'}</Typography>}
                            />
                            <FormControlLabel
                                value='marquee'
                                control={<Radio color='primary' size='small' />}
                                label={<Typography className={classes.radioText}>{'Marquee (scrolling ticker)'}</Typography>}
                            />
                        </RadioGroup>
                    </FormControl>
                </Box>
                <DialogContent dividers={true} classes={{ dividers: classes.dialogBox }}>
                    <Box m={2} minWidth={'100%'}>
                        <Paper
                            component={Box}
                            mr={2}
                            p={3}
                            className={classes.sectionPaper}
                            display='flex'
                            flexDirection='column'
                            justifyContent='flex-start'
                            alignItems='flex-start'
                        >
                            <Box className={classes.sectionHeader} width={'100%'}>
                                <Typography variant='h6'>
                                    {(reactData.mode === 'marquee')
                                        ? 'Create a New Marquee Message'
                                        : (reactData.editingNotificationId ? 'Edit Notification' : 'Create a New Notification')}
                                </Typography>
                                {(reactData.mode === 'notification') && reactData.editingNotificationId &&
                                    <Button
                                        className={AVAClass.AVAButton}
                                        size='small'
                                        startIcon={<AddIcon fontSize='small' />}
                                        onClick={resetForm}
                                    >
                                        {'New Notification'}
                                    </Button>
                                }
                            </Box>
                            <Box flexGrow={2} width={'100%'} display='flex' flexDirection='column'>
                                {(reactData.mode === 'notification') &&
                                    <TextField
                                        key={`title`}
                                        helperText={'Title (optional)'}
                                        inputProps={{ style: { color: 'black', fontSize: `1.3rem`, lineHeight: `1.5rem` } }}
                                        FormHelperTextProps={{ style: { color: 'black' } }}
                                        className={classes.freeInput}
                                        variant={'standard'}
                                        autoComplete='off'
                                        id='title'
                                        value={reactData.title}
                                        fullWidth
                                        onChange={event => updateReactData({ title: event.target.value }, true)}
                                    />
                                }
                                <Box mt={2} mb={1} width={'90%'} marginLeft={1}>
                                    <Typography className={classes.radioText}>{`Message`}</Typography>
                                    {(reactData.mode === 'notification')
                                        ? <RichTextEditor
                                            value={reactData.message}
                                            onChange={(html) => updateReactData({ message: html }, true)}
                                            placeholder={'Enter the notification message...'}
                                        />
                                        : <TextField
                                            key={`marqueeMessage`}
                                            multiline
                                            fullWidth
                                            inputProps={{ style: { color: 'black', fontSize: `1.3rem`, lineHeight: `1.5rem` } }}
                                            FormHelperTextProps={{ style: { color: 'black' } }}
                                            className={classes.freeInput}
                                            variant={'standard'}
                                            autoComplete='off'
                                            value={reactData.message}
                                            onChange={event => updateReactData({ message: event.target.value }, true)}
                                        />
                                    }
                                </Box>
                                <div>
                                    <TextField
                                        key={`input_fromDate`}
                                        style={{ width: '40%', marginLeft: '8px' }}
                                        helperText={'Start showing (optional - blank = immediately)'}
                                        FormHelperTextProps={{ style: { color: 'black' } }}
                                        className={classes.freeInput}
                                        variant={'standard'}
                                        value={reactData.dontShowBeforeDisplay}
                                        autoComplete='off'
                                        onBlur={(event) => resolveFromDate(event.target.value)}
                                        onChange={(event) => updateReactData({ dontShowBeforeDisplay: event.target.value }, true)}
                                    />
                                </div>
                                <div>
                                    <TextField
                                        key={`input_toDate`}
                                        style={{ width: '40%', marginLeft: '8px' }}
                                        helperText={(reactData.mode === 'marquee') ? 'Stop showing (optional - blank = never)' : 'Stop showing (optional - blank = 1 month)'}
                                        FormHelperTextProps={{ style: { color: 'black' } }}
                                        variant={'standard'}
                                        value={reactData.dontShowAfterDisplay}
                                        autoComplete='off'
                                        onBlur={(event) => resolveToDate(event.target.value)}
                                        onChange={(event) => updateReactData({ dontShowAfterDisplay: event.target.value }, true)}
                                    />
                                </div>
                                {(reactData.mode === 'marquee') &&
                                    <Box display="flex" flexDirection='column' pt={1} pl={1}>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    color='primary'
                                                    size='small'
                                                    checked={reactData.criticalMessage}
                                                    onChange={(event) => updateReactData({ criticalMessage: event.target.checked }, true)}
                                                />
                                            }
                                            label={<Typography className={classes.radioText}>{'Mark as critical?  This will display in red, and be the only message on the screen.'}</Typography>}
                                        />
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    color='primary'
                                                    size='small'
                                                    checked={reactData.priorityMessage}
                                                    onChange={(event) => updateReactData({ priorityMessage: event.target.checked }, true)}
                                                />
                                            }
                                            label={<Typography className={classes.radioText}>{'Suppress weather and other greetings while displayed?'}</Typography>}
                                        />
                                    </Box>
                                }
                                <Box display="flex" pt={2} pl={1} flexDirection='row' alignItems='center'>
                                    <Button
                                        className={AVAClass.AVAButton}
                                        style={{ backgroundColor: '#c8e6c9' }}
                                        size='small'
                                        onClick={() => {
                                            const existingSelections = (reactData.availableTo || [])
                                                .map(r => {
                                                    if (r.startsWith('group:')) { return { group_id: r.slice(6) }; }
                                                    if (r.startsWith('*')) {
                                                        const sv = SPECIAL_ACCESS_VALUES.find(s => s.person_id === r);
                                                        return { person_id: r, person_name: sv ? sv.first : r };
                                                    }
                                                    return { person_id: r.slice(7) };
                                                });
                                            updateReactData({
                                                showAccessSearch: true,
                                                groupInfo: null,
                                                selections: existingSelections,
                                            }, true);
                                        }}
                                    >
                                        {`Set Access`}
                                    </Button>
                                    <Typography className={classes.radioText} style={{ marginLeft: 10 }}>
                                        {describeAvailableTo(reactData.availableTo)}
                                    </Typography>
                                </Box>

                                {(reactData.mode === 'notification') && reactData.editingNotificationId &&
                                    <Box mt={3} width={'100%'}>
                                        <Divider />
                                        <Box mt={2} mb={1} display='flex' alignItems='center' justifyContent='space-between'>
                                            <Box display='flex' alignItems='center'>
                                                <VisibilityIcon fontSize='small' style={{ marginRight: 6, opacity: 0.6 }} />
                                                <Typography variant='subtitle2'>{'Viewed & Dismissed By'}</Typography>
                                            </Box>
                                            {!reactData.viewerListLoading && reactData.viewerList.length > 0 &&
                                                <Button
                                                    className={AVAClass.AVAButton}
                                                    size='small'
                                                    startIcon={<ReplayIcon fontSize='small' />}
                                                    onClick={() => updateReactData({ resetAllPending: true }, true)}
                                                >
                                                    {'Reset All'}
                                                </Button>
                                            }
                                        </Box>
                                        {reactData.viewerListLoading &&
                                            <Typography className={classes.radioText}>{'Loading...'}</Typography>
                                        }
                                        {!reactData.viewerListLoading && reactData.viewerList.length === 0 &&
                                            <Typography className={classes.radioText} style={{ opacity: 0.6 }}>
                                                {'No one has dismissed this notification yet.'}
                                            </Typography>
                                        }
                                        {!reactData.viewerListLoading && reactData.viewerList.length > 0 &&
                                            <List dense>
                                                {reactData.viewerList.map((viewer, index) => (
                                                    <ListItem
                                                        key={`viewer_${index}`}
                                                        disableGutters
                                                        button
                                                        onClick={() => updateReactData({ resetPendingUserId: viewer.user_id, resetPendingName: viewer.name }, true)}
                                                    >
                                                        <ListItemText
                                                            primary={viewer.name}
                                                            secondary={`Dismissed ${makeDate(viewer.shown_at).absolute}`}
                                                        />
                                                        <IconButton
                                                            size='small'
                                                            title='Reset - show this to them again'
                                                            onClick={(ev) => {
                                                                ev.stopPropagation();
                                                                updateReactData({ resetPendingUserId: viewer.user_id, resetPendingName: viewer.name }, true);
                                                            }}
                                                        >
                                                            <ReplayIcon fontSize='small' />
                                                        </IconButton>
                                                    </ListItem>
                                                ))}
                                            </List>
                                        }
                                    </Box>
                                }
                            </Box>
                        </Paper>
                    </Box>
                    <Box m={2} minWidth={'100%'}>
                        {(reactData.mode === 'notification') &&
                            <Paper
                                component={Box}
                                mr={2}
                                p={3}
                                className={classes.sectionPaper}
                                display='flex'
                                flexDirection='column'
                                justifyContent='flex-start'
                                alignItems='flex-start'
                            >
                                <Typography variant='h6' style={{ marginBottom: 12 }}>{'All Notifications'}</Typography>
                                <List style={{ width: '100%' }}>
                                    {reactData.notificationList.map((this_notification, index) => {
                                        const statusInfo = describeStatus(this_notification);
                                        return (
                                            <ListItem
                                                key={`notif_row_${index}`}
                                                button
                                                selected={reactData.editingNotificationId === this_notification.notification_id}
                                                className={classes.listRow}
                                                onClick={() => selectNotification(this_notification)}
                                            >
                                                <ListItemText
                                                    primary={this_notification.title || '(untitled)'}
                                                    secondary={`Start: ${this_notification.dont_show_before ? makeDate(this_notification.dont_show_before).absolute : 'Immediately'}`}
                                                />
                                                <Chip
                                                    size='small'
                                                    label={statusInfo.label}
                                                    style={{ backgroundColor: statusInfo.color, color: 'white', marginRight: 8 }}
                                                />
                                                {statusInfo.cancellable &&
                                                    <IconButton
                                                        size='small'
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            updateReactData({
                                                                cancelPendingId: this_notification.notification_id,
                                                                cancelPendingText: this_notification.title || this_notification.message.replace(/<[^>]*>/g, '')
                                                            }, true);
                                                        }}
                                                    >
                                                        <DeleteIcon fontSize='small' />
                                                    </IconButton>
                                                }
                                            </ListItem>
                                        );
                                    })}
                                    {reactData.notificationList.length === 0 &&
                                        <Typography className={classes.radioText} style={{ opacity: 0.6 }}>
                                            {'No notifications yet.'}
                                        </Typography>
                                    }
                                </List>
                            </Paper>
                        }
                        {(reactData.mode === 'marquee') &&
                            <Paper
                                component={Box}
                                mr={2}
                                p={3}
                                className={classes.sectionPaper}
                                display='flex'
                                flexDirection='column'
                                justifyContent='flex-start'
                                alignItems='flex-start'
                            >
                                <Typography variant='h6' style={{ marginBottom: 12 }}>{'Current and Upcoming Messages'}</Typography>
                                <List style={{ width: '100%' }}>
                                    {reactData.marqueeList.map((this_message, index) => (
                                        <ListItem
                                            key={`marquee_row_${index}`}
                                            className={classes.listRow}
                                            alignItems='flex-start'
                                        >
                                            <ListItemText
                                                primary={
                                                    <span style={this_message.criticalMessage ? { color: 'red' } : undefined}>
                                                        {this_message.message}
                                                    </span>
                                                }
                                                secondary={
                                                    <React.Fragment>
                                                        {this_message.criticalMessage &&
                                                            <Typography component='span' className={classes.radioText} style={{ color: 'red', display: 'block' }}>
                                                                {'CRITICAL'}
                                                            </Typography>
                                                        }
                                                        {this_message.priorityMessage &&
                                                            <Typography component='span' className={classes.radioText} style={{ display: 'block' }}>
                                                                {'Suppresses weather/greetings'}
                                                            </Typography>
                                                        }
                                                        {`Start: ${this_message.start_time ? makeDate(this_message.start_time).absolute : 'Immediately'}`}
                                                        {this_message.end_time ? ` — End: ${makeDate(this_message.end_time).absolute}` : ''}
                                                        {this_message.available_to
                                                            ? ` — ${describeAvailableTo(this_message.available_to)}`
                                                            : ((this_message.groupNames && this_message.groupNames.length > 0) ? ` — Restricted to: ${[...this_message.groupNames].sort().join(', ')}` : '')}
                                                    </React.Fragment>
                                                }
                                            />
                                            <IconButton
                                                size='small'
                                                onClick={() => updateReactData({
                                                    stopPendingKey: this_message.message_key,
                                                    stopPendingText: this_message.message
                                                }, true)}
                                            >
                                                <DeleteIcon fontSize='small' />
                                            </IconButton>
                                        </ListItem>
                                    ))}
                                    {reactData.marqueeList.length === 0 &&
                                        <Typography className={classes.radioText} style={{ opacity: 0.6 }}>
                                            {'No marquee messages yet.'}
                                        </Typography>
                                    }
                                </List>
                            </Paper>
                        }
                    </Box>
                </DialogContent>
                <Box display='flex' flexDirection='column' justifyContent='center' alignItems='center'>
                    <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
                        <DialogActions className={classes.buttonArea}>
                            <Button
                                className={AVAClass.AVAButton}
                                style={{ backgroundColor: 'red', color: 'white' }}
                                size='small'
                                onClick={() => { onClose(); }}
                                startIcon={<CloseIcon fontSize="small" />}
                            >
                                {'Exit'}
                            </Button>
                            {OK2Save() &&
                                <Button
                                    onClick={handleSave}
                                    disabled={reactData.saving}
                                    className={AVAClass.AVAButton}
                                    style={{ backgroundColor: 'green', color: 'white' }}
                                    size='small'
                                >
                                    {reactData.editingNotificationId ? 'Update' : 'Save'}
                                </Button>
                            }
                        </DialogActions>
                    </Box>
                </Box>
            </React.Fragment>

            {reactData.showAccessSearch &&
                <QuickSearch
                    reactData={reactData}
                    updateReactData={updateReactData}
                    options={{
                        title: (reactData.mode === 'marquee') ? 'Who Should See This Marquee Message?' : 'Who Should See This Notification?',
                        withGroups: true,
                        showGroupList: true,
                        showAll: true,
                        pickAndGo: true,
                        keepSelections: true,
                        withSpecialValues: true,
                        buttonText: {
                            empty: 'Done (everyone)',
                            selected: 'Use These'
                        }
                    }}
                    onClose={(selections) => {
                        const cleanSelections = ([selections].flat()).filter(s => s && (s.person_id || s.group_id));
                        const mappedSelections = cleanSelections.map(s => {
                            if (s.group_id) { return `group:${s.group_id}`; }
                            if (s.person_id && s.person_id.startsWith('*')) { return s.person_id; }
                            return `person:${s.person_id}`;
                        });
                        updateReactData({
                            showAccessSearch: false,
                            availableTo: mappedSelections.length > 0 ? mappedSelections : ['*all'],
                            selections: cleanSelections,
                        }, true);
                    }}
                />
            }

            {reactData.cancelPendingId &&
                <AVAConfirm
                    promptText={`Please confirm.  AVA will stop showing the notification: ${reactData.cancelPendingText}`}
                    onCancel={() => {
                        updateReactData({ cancelPendingId: false, cancelPendingText: '' }, true);
                    }}
                    onConfirm={async () => {
                        await handleCancelNotification(reactData.cancelPendingId);
                    }}
                >
                </AVAConfirm>
            }
            {reactData.resetPendingUserId &&
                <AVAConfirm
                    promptText={`Reset this notification for ${reactData.resetPendingName}?  They will see it again the next time they use AVA.`}
                    onCancel={() => {
                        updateReactData({ resetPendingUserId: false, resetPendingName: '' }, true);
                    }}
                    onConfirm={async () => {
                        await handleResetViewer(reactData.resetPendingUserId);
                    }}
                >
                </AVAConfirm>
            }
            {reactData.resetAllPending &&
                <AVAConfirm
                    promptText={`Reset this notification for everyone who has seen it?  It will show again for all ${reactData.viewerList.length} of them.`}
                    onCancel={() => {
                        updateReactData({ resetAllPending: false }, true);
                    }}
                    onConfirm={async () => {
                        await handleResetAllViewers();
                    }}
                >
                </AVAConfirm>
            }
            {reactData.stopPendingKey &&
                <AVAConfirm
                    promptText={`Please confirm.  AVA will stop playing the message that says: ${reactData.stopPendingText}`}
                    onCancel={() => {
                        updateReactData({ stopPendingKey: false, stopPendingText: '' }, true);
                    }}
                    onConfirm={async () => {
                        await handleStopMarqueeMessage(reactData.stopPendingKey);
                    }}
                >
                </AVAConfirm>
            }
        </Dialog>
    );
};

