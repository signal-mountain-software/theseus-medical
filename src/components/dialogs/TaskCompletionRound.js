import React from 'react';

import {
    Box, Button, Checkbox, CircularProgress,
    Dialog, DialogActions, DialogContent, DialogTitle,
    Divider, IconButton, Typography,
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { makeName } from '../../util/AVAPeople';
import {
    getTasksForPeopleList,
    getCompletionsForPeopleOnDate,
    recordTaskCompletion,
    deleteTaskCompletion,
    voidTaskCompletion,
    describeSchedule,
} from '../../util/AVATasks';
import TaskCompletion from './TaskCompletion';

const useStyles = makeStyles(theme => ({
    paper: {
        borderRadius: '30px 30px 30px 30px',
        width: '95%',
        maxWidth: '680px',
        margin: 0,
        maxHeight: '98%',
    },
    personHeader: {
        fontWeight: 'bold',
        marginTop: theme.spacing(1.5),
        marginBottom: theme.spacing(0.5),
    },
    taskRow: {
        display: 'flex',
        alignItems: 'center',
        paddingTop: theme.spacing(0.5),
        paddingBottom: theme.spacing(0.5),
    },
    taskText: {
        flex: 1,
    },
    undoButton: {
        textTransform: 'none',
        fontSize: '0.75rem',
        marginLeft: theme.spacing(0.5),
        color: theme.palette.warning?.main || 'orange',
        border: `1px solid ${theme.palette.warning?.main || 'orange'}`,
        padding: '2px 8px',
        borderRadius: '12px',
        whiteSpace: 'nowrap',
    },
    reject: {
        textTransform: 'none',
        color: theme.palette.reject ? theme.palette.reject[theme.palette.type] : 'red',
    },
}));

/**
 * TaskCompletionRound
 *
 * Show all active tasks for a list of people, grouped by person name,
 * and let the user check off completions with optional data collection.
 *
 * Props:
 *   personIds   {string[]}   - people to record for
 *   client_id   {string}
 *   viewer_id   {string}     - logged-in user performing the recording
 *   isAdmin     {boolean}    - show void (trash) controls
 *   date        {string}     - yyyy-mm-dd (defaults to today)
 *   onClose     {function}
 */
export default function TaskCompletionRound({
    personIds,
    client_id,
    viewer_id,
    isAdmin = false,
    date,
    onClose,
}) {
    const classes = useStyles();
    const AVAClass = AVAclasses();
    const isMounted = React.useRef(false);

    const todayStr = React.useMemo(
        () => date || new Date().toISOString().split('T')[0],
        [date],
    );

    const headerDate = React.useMemo(() => {
        try {
            return new Date(todayStr + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
            });
        }
        catch { return todayStr; }
    }, [todayStr]);

    // ── State ─────────────────────────────────────────────────────────────
    const [loading, setLoading] = React.useState(true);
    const [people, setPeople] = React.useState([]);          // [{ person_id, name }]
    const [tasksByPerson, setTasksByPerson] = React.useState({});  // { [pid]: task[] }
    // { [pid]: { [task_id]: completion_sk } }  — active non-voided completions for today
    const [activeCompletions, setActiveCompletions] = React.useState({});
    const [pendingUndo, setPendingUndo] = React.useState(new Set()); // Set<completion_sk>
    const [dataCollectionTask, setDataCollectionTask] = React.useState(null); // { taskRec, person_id }
    const [savingSet, setSavingSet] = React.useState(new Set());    // Set<pid_taskId>

    // ── Load ──────────────────────────────────────────────────────────────
    React.useEffect(() => {
        isMounted.current = true;
        async function load() {
            const [tasksMap, completionsMap] = await Promise.all([
                getTasksForPeopleList(client_id, personIds, viewer_id, todayStr),
                getCompletionsForPeopleOnDate(personIds, todayStr),
            ]);

            const peopleArr = await Promise.all(
                personIds.map(async pid => ({
                    person_id: pid,
                    name: (await makeName(pid)) || pid,
                })),
            );

            // Build initial activeCompletions from today's loaded completions
            const activeComp = {};
            for (const pid of personIds) {
                activeComp[pid] = {};
                for (const comp of (completionsMap[pid] || [])) {
                    if (!comp.voided) {
                        activeComp[pid][comp.task_id] = comp.completion_sk;
                    }
                }
            }

            if (!isMounted.current) { return; }
            setPeople(peopleArr);
            setTasksByPerson(tasksMap);
            setActiveCompletions(activeComp);
            setLoading(false);
        }
        load();
        return () => { isMounted.current = false; };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ── After a completion is recorded, update state + start undo timer ───
    const handleCompletionRecorded = React.useCallback((person_id, completion_sk, task_id) => {
        if (!isMounted.current) { return; }
        setActiveCompletions(prev => {
            const next = { ...prev, [person_id]: { ...(prev[person_id] || {}), [task_id]: completion_sk } };
            return next;
        });
        setPendingUndo(prev => new Set([...prev, completion_sk]));
        setTimeout(() => {
            if (!isMounted.current) { return; }
            setPendingUndo(prev => {
                const next = new Set(prev);
                next.delete(completion_sk);
                return next;
            });
        }, 10000);
    }, []);

    // ── Direct record (no data collection form needed) ────────────────────
    const recordDirect = React.useCallback(async (taskRec, person_id) => {
        const saveKey = `${person_id}_${taskRec.task_id}`;
        setSavingSet(prev => new Set([...prev, saveKey]));
        const comp = await recordTaskCompletion({
            taskRec,
            person_id,
            by_whom: viewer_id,
            collectedValues: {},
            source: 'manual',
        });
        if (isMounted.current) {
            setSavingSet(prev => { const n = new Set(prev); n.delete(saveKey); return n; });
        }
        handleCompletionRecorded(person_id, comp.completion_sk, taskRec.task_id);
    }, [viewer_id, handleCompletionRecorded]);

    // ── Checkbox click ────────────────────────────────────────────────────
    const handleCheck = React.useCallback((taskRec, person_id) => {
        const saveKey = `${person_id}_${taskRec.task_id}`;
        if (savingSet.has(saveKey)) { return; }
        // Already complete?
        if (activeCompletions[person_id]?.[taskRec.task_id]) { return; }
        // Needs data collection?
        if ((taskRec.data_to_collect || []).length > 0) {
            setDataCollectionTask({ taskRec, person_id });
        } else {
            recordDirect(taskRec, person_id);
        }
    }, [savingSet, activeCompletions, recordDirect]);

    // ── Undo ──────────────────────────────────────────────────────────────
    const handleUndo = React.useCallback(async (person_id, task_id) => {
        const completion_sk = activeCompletions[person_id]?.[task_id];
        if (!completion_sk) { return; }
        await deleteTaskCompletion(person_id, completion_sk);
        if (!isMounted.current) { return; }
        setActiveCompletions(prev => {
            const next = { ...prev, [person_id]: { ...(prev[person_id] || {}) } };
            delete next[person_id][task_id];
            return next;
        });
        setPendingUndo(prev => { const n = new Set(prev); n.delete(completion_sk); return n; });
    }, [activeCompletions]);

    // ── Admin void ────────────────────────────────────────────────────────
    const handleVoid = React.useCallback(async (person_id, task_id) => {
        const completion_sk = activeCompletions[person_id]?.[task_id];
        if (!completion_sk) { return; }
        await voidTaskCompletion(person_id, completion_sk);
        if (!isMounted.current) { return; }
        setActiveCompletions(prev => {
            const next = { ...prev, [person_id]: { ...(prev[person_id] || {}) } };
            delete next[person_id][task_id];
            return next;
        });
        setPendingUndo(prev => { const n = new Set(prev); n.delete(completion_sk); return n; });
    }, [activeCompletions]);

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <>
            <Dialog open fullWidth scroll='paper' PaperProps={{ className: classes.paper }}>
                <DialogTitle disableTypography>
                    <Typography style={AVATextStyle({ size: 1.3, bold: true })}>
                        {'Record Activity'}
                    </Typography>
                    <Typography variant='body2' color='textSecondary'>
                        {headerDate}
                    </Typography>
                </DialogTitle>
                <DialogContent dividers>

                    {loading && (
                        <Box display='flex' justifyContent='center' mt={4} mb={4}>
                            <CircularProgress size={36} />
                        </Box>
                    )}

                    {!loading && people
                        .filter(person => (tasksByPerson[person.person_id] || []).length > 0)
                        .map((person, pIdx) => {
                        const tasks = tasksByPerson[person.person_id] || [];
                        return (
                            <Box key={person.person_id}>
                                {pIdx > 0 && <Divider style={{ marginTop: 8, marginBottom: 4 }} />}
                                {people.length > 1 && (
                                    <Typography className={classes.personHeader}>
                                        {person.name}
                                    </Typography>
                                )}
                                {tasks.map(taskRec => {
                                    const saveKey = `${person.person_id}_${taskRec.task_id}`;
                                    const isSaving = savingSet.has(saveKey);
                                    const completion_sk = activeCompletions[person.person_id]?.[taskRec.task_id];
                                    const isDone = !!completion_sk;
                                    const canUndo = isDone && pendingUndo.has(completion_sk);
                                    return (
                                        <Box key={taskRec.task_id} className={classes.taskRow}>
                                            <Checkbox
                                                checked={isDone}
                                                disabled={isSaving || isDone}
                                                color='primary'
                                                size='small'
                                                onClick={() => handleCheck(taskRec, person.person_id)}
                                            />
                                            <Box className={classes.taskText}>
                                                <Typography variant='body2' style={{ fontWeight: isDone ? 'bold' : 'normal' }}>
                                                    {taskRec.description}
                                                </Typography>
                                                {taskRec.schedule && (
                                                    <Typography variant='caption' color='textSecondary'>
                                                        {describeSchedule(taskRec.schedule)}
                                                    </Typography>
                                                )}
                                            </Box>
                                            {canUndo && (
                                                <Button
                                                    className={classes.undoButton}
                                                    size='small'
                                                    onClick={() => handleUndo(person.person_id, taskRec.task_id)}
                                                >
                                                    {'Undo'}
                                                </Button>
                                            )}
                                            {isAdmin && isDone && (
                                                <IconButton
                                                    size='small'
                                                    style={{ color: 'darkred', marginLeft: 4 }}
                                                    title='Void this completion'
                                                    onClick={() => handleVoid(person.person_id, taskRec.task_id)}
                                                >
                                                    <DeleteIcon fontSize='small' />
                                                </IconButton>
                                            )}
                                        </Box>
                                    );
                                })}
                            </Box>
                        );
                    })}

                    {!loading && people.every(p => (tasksByPerson[p.person_id] || []).length === 0) && (
                        <Typography variant='body2' color='textSecondary' style={{ marginTop: 16 }}>
                            {'No active tasks found for the selected people.'}
                        </Typography>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button
                        className={AVAClass.AVAButton}
                        style={{ backgroundColor: 'red', color: 'white' }}
                        size='small'
                        onClick={onClose}
                    >
                        {'Done'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Data-collection inner dialog */}
            {dataCollectionTask && (
                <TaskCompletion
                    taskRec={dataCollectionTask.taskRec}
                    person_id={dataCollectionTask.person_id}
                    client_id={client_id}
                    by_whom={viewer_id}
                    onClose={() => setDataCollectionTask(null)}
                    onSaved={(completionRec) => {
                        const pid = dataCollectionTask.person_id;
                        const tid = dataCollectionTask.taskRec.task_id;
                        setDataCollectionTask(null);
                        handleCompletionRecorded(pid, completionRec.completion_sk, tid);
                    }}
                />
            )}
        </>
    );
}
