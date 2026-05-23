import React from 'react';

import {
  Box, Button, Chip, CircularProgress,
  Divider, IconButton, Paper, TextField, Tooltip, Typography
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import EditIcon from '@material-ui/icons/Edit';
import SaveIcon from '@material-ui/icons/Save';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { getTasksForPerson, calculateStreaks, describeSchedule, putTask, parseQuickActivity } from '../../util/AVATasks';
import useSession from '../../hooks/useSession';
import TaskEditor from '../dialogs/TaskEditor';
import TaskCompletion from '../dialogs/TaskCompletion';
import TaskCompletionRound from '../dialogs/TaskCompletionRound';

const useStyles = makeStyles(theme => ({
  taskCard: {
    borderRadius: '12px',
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    border: '1px solid #ddd',
  },
  taskCardInactive: {
    borderRadius: '12px',
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
    border: '1px dashed #bbb',
    opacity: 0.6,
  },
  actionRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing(0.5),
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
  scheduleText: {
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    marginTop: 2,
  },
  streakChip: {
    fontSize: '0.7rem',
    height: 20,
  },
  sectionHeader: {
    fontWeight: 'bold',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(0.5),
    fontSize: '0.85rem',
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
}));

/**
 * TaskManagerSection
 *
 * Activities list rendered inline — no Dialog wrapper.
 * TaskEditor and TaskCompletion still open as their own Dialogs on top.
 *
 * Usage 1 — standalone (e.g. inside TaskManager dialog):
 *   <TaskManagerSection person_id={...} client_id={...} options={...} />
 *
 * Usage 2 — PeopleMaintenance section catalog:
 *   renderSection passes: reactData (PM's state, has .person_id), updateReactData, onClose
 *   <TaskManagerSection reactData={pmReactData} onClose={...} />
 */
export default function TaskManagerSection({
  // standalone props
  person_id: personIdProp,
  client_id: clientIdProp,
  options: optionsProp,
  // PeopleMaintenance catalog props (reactData here is PM's state object)
  reactData: pmReactData,
  // onClose is unused in section context but accepted to satisfy catalog interface
  // eslint-disable-next-line no-unused-vars
  onClose,
  // remaining catalog props we don't need
  // eslint-disable-next-line no-unused-vars
  currentValues, ogValues, errorList, setError, updateField, updateReactData: pmUpdateReactData,
}) {
  const { state } = useSession();
  const classes = useStyles();
  const AVAClass = AVAclasses();

  // Resolve person_id and client_id from whichever call style is used
  const person_id = personIdProp || pmReactData?.person_id || state.session.patient_id;
  const client_id = clientIdProp || state.session.client_id;
  const options = optionsProp || {};

  const isMounted = React.useRef(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(false);
  const [quickAddText, setQuickAddText] = React.useState('');
  const [quickAddSaving, setQuickAddSaving] = React.useState(false);

  const [data, setData] = React.useState({
    initialized: false,
    tasks: [],
    streaksByTask: {},
    editingTask: null,       // task record being edited, or 'new'
    completingTask: null,    // task record being completed
    allowCreate: options.allowCreate !== false,
    administrative: options.administrative || ['admin', 'support', 'master'].includes(state.user.account_class),
  });

  const [showCompletionRound, setShowCompletionRound] = React.useState(false);

  const updateData = (newData, force = false) => {
    if (isMounted.current) {
      setData(prev => Object.assign({}, prev, newData));
      if (force) { setRefreshTrigger(t => !t); }
    }
  };

  // ── Initialize ────────────────────────────────────────────────────────────

  React.useEffect(() => {
    isMounted.current = true;
    async function initialize() {
      // person_id = subject (whose tasks), state.session.user_id = viewer (available_to check)
      let tasks = await getTasksForPerson(client_id, person_id, state.session.user_id);

      tasks.sort((a, b) => {
        if (a.status !== b.status) { return a.status === 'active' ? -1 : 1; }
        return (a.description || '').localeCompare(b.description || '');
      });

      let streaksByTask = {};
      for (let t of tasks) {
        if (t.status === 'active' && Array.isArray(t.streak_rules) && t.streak_rules.length > 0) {
          streaksByTask[t.task_id] = await calculateStreaks(t, person_id);
        }
      }

      updateData({ initialized: true, tasks, streaksByTask });
    }
    initialize();
    return () => { isMounted.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshTrigger]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTaskSaved = () => {
    updateData({ editingTask: null });
    setRefreshTrigger(t => !t);
  };

  const handleTaskDeleted = (task_id) => {
    updateData({
      editingTask: null,
      tasks: data.tasks.filter(t => t.task_id !== task_id),
    }, true);
  };

  const handleCompletionRecorded = () => {
    updateData({ completingTask: null });
    setRefreshTrigger(t => !t);
  };

  // ── Quick-add parsing (parseQuickActivity imported from AVATasks) ──────────

  const handleQuickAdd = async () => {
    const text = quickAddText.trim();
    if (!text || quickAddSaving) { return; }
    setQuickAddSaving(true);
    const { description, schedule, start_date } = parseQuickActivity(text);
    const newTask = {
      task_id: null,
      client_id,
      description,
      status: 'active',
      start_date,
      end_date: '',
      available_to: ['*all'],
      applies_to: [{ type: 'person', id: person_id, name: state.session.patient_display_name || person_id }],
      data_to_collect: [],
      schedule,
      remind_who: [],
      reminders: [],
      streak_rules: [],
      created_by: state.session.user_id,
      source: 'user',
    };
    await putTask(newTask);
    if (isMounted.current) {
      setQuickAddSaving(false);
      setQuickAddText('');
      updateData({ editingTask: null });
      setRefreshTrigger(t => !t);
    }
  };

  // ── Sub-renders ───────────────────────────────────────────────────────────

  const ruleLabel = (rule) => {
    switch (rule.rule_type) {
      case 'recorded':  return rule.field_id ? `${rule.field_id} recorded` : 'Completed';
      case 'threshold': return `${rule.field_id} ${rule.operator} ${rule.threshold_value}`;
      case 'on_time':   return `On-time (${rule.on_time_window_minutes}min)`;
      default:          return rule.rule_type;
    }
  };

  const renderStreakBadges = (taskRec) => {
    let streaks = data.streaksByTask[taskRec.task_id];
    if (!streaks || streaks.length === 0) { return null; }
    return (
      <Box display='flex' flexWrap='wrap' style={{ gap: 4, marginTop: 4 }}>
        {streaks.map((s, i) => (
          <Tooltip key={i} title={`Current: ${s.current_streak}  |  Best: ${s.longest_streak}`}>
            <Chip
              label={`${ruleLabel(s.rule)}: ${s.current_streak} 🔥`}
              size='small'
              className={classes.streakChip}
              color={s.current_streak > 0 ? 'primary' : 'default'}
              variant={s.current_streak > 0 ? 'default' : 'outlined'}
            />
          </Tooltip>
        ))}
      </Box>
    );
  };

  const renderTaskCard = (taskRec) => {
    let isActive = taskRec.status === 'active';
    return (
      <Paper
        key={taskRec.task_id}
        elevation={isActive ? 2 : 0}
        className={isActive ? classes.taskCard : classes.taskCardInactive}
      >
        <Box display='flex' alignItems='center' justifyContent='space-between'>
          <Box flex={1} mr={1}>
            <Typography style={AVATextStyle({ size: 1, bold: isActive })}>
              {taskRec.description}
            </Typography>
            {isActive
              ? (
                <Typography className={classes.scheduleText}>
                  {describeSchedule(taskRec.schedule)}
                </Typography>
              )
              : (
                <Chip
                  label='INACTIVE'
                  size='small'
                  style={{ fontSize: '0.65rem', height: 18, marginTop: 3, backgroundColor: '#e0e0e0', color: '#757575', fontWeight: 'bold', letterSpacing: '0.05em' }}
                />
              )
            }
          </Box>

          <Box display='flex' alignItems='center'>
            <Tooltip title='Edit activity'>
              <IconButton size='small' onClick={() => updateData({ editingTask: taskRec }, true)}>
                <EditIcon fontSize='small' />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {isActive && renderStreakBadges(taskRec)}

        {isActive && Array.isArray(taskRec.data_to_collect) && taskRec.data_to_collect.length > 0 && (
          <Box className={classes.actionRow}>
            {taskRec.data_to_collect.map((f, i) => (
              <Chip
                key={i}
                label={f.prompt || f.field_id}
                size='small'
                variant='outlined'
                style={{ fontSize: '0.7rem', height: 20 }}
              />
            ))}
          </Box>
        )}
      </Paper>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Box paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={2}>
      {/* Header */}
      <Box display='flex' alignItems='center' justifyContent='space-between' mb={1}>
        <Typography style={AVATextStyle({ size: 1.3, bold: true })}>
          Daily Activities
        </Typography>
        <Box display='flex' alignItems='center' style={{ gap: 8 }}>
          {data.administrative && (
            <Button
              className={AVAClass.AVAButton}
              size='small'
              style={{ backgroundColor: 'teal', color: 'white' }}
              onClick={() => setShowCompletionRound(true)}
            >
              {'Record Activity'}
            </Button>
          )}
          {data.allowCreate && (
            <Button
              className={AVAClass.AVAButton}
              size='small'
              startIcon={<AddIcon />}
              onClick={() => updateData({ editingTask: 'new' }, true)}
            >
              New Activity
            </Button>
          )}
        </Box>
      </Box>

      {/* Inline quick-add card */}
      {data.editingTask === 'new' && (
        <Paper elevation={2} className={classes.taskCard}>
          <Box display='flex' alignItems='center' justifyContent='space-between'>
            <Box flex={1} mr={1}>
              <TextField
                autoFocus
                fullWidth
                size='small'
                placeholder='e.g. take medication at 8am, or morning walk…'
                value={quickAddText}
                onChange={e => setQuickAddText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && quickAddText.trim()) { handleQuickAdd(); }
                  if (e.key === 'Escape') { updateData({ editingTask: null }, true); setQuickAddText(''); }
                }}
                inputProps={{ style: { fontSize: '1rem' } }}
              />
            </Box>
            <Box display='flex' alignItems='center'>
              <Tooltip title='Save activity'>
                <span>
                  <IconButton
                    size='small'
                    disabled={!quickAddText.trim() || quickAddSaving}
                    onClick={handleQuickAdd}
                  >
                    <SaveIcon fontSize='small' />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Loading */}
      {!data.initialized && (
        <Box display='flex' justifyContent='center' py={4}>
          <CircularProgress size={28} />
        </Box>
      )}

      {/* Empty state */}
      {data.initialized && data.tasks.length === 0 && (
        <Typography variant='body2' color='textSecondary' style={{ textAlign: 'center', padding: 24 }}>
          No activities found for this person.
        </Typography>
      )}

      {/* Task list */}
      {data.initialized && data.tasks.length > 0 && (() => {
        const active = data.tasks.filter(t => t.status === 'active');
        const inactive = data.tasks.filter(t => t.status !== 'active');
        return (
          <>
            {active.length > 0 && (
              <>
                <Typography className={classes.sectionHeader}>Active</Typography>
                {active.map(renderTaskCard)}
              </>
            )}
            {inactive.length > 0 && (
              <>
                <Divider style={{ marginTop: 8, marginBottom: 8 }} />
                <Typography className={classes.sectionHeader}>Inactive</Typography>
                {inactive.map(renderTaskCard)}
              </>
            )}
          </>
        );
      })()}

      {/* TaskEditor — opens as a Dialog portal on top */}
      {data.editingTask && data.editingTask !== 'new' && (
        <TaskEditor
          existingTask={data.editingTask}
          client_id={client_id}
          onClose={() => updateData({ editingTask: null }, true)}
          onSaved={handleTaskSaved}
          onDeleted={handleTaskDeleted}
        />
      )}

      {/* TaskCompletion — opens as a Dialog portal on top */}
      {data.completingTask && (
        <TaskCompletion
          taskRec={data.completingTask}
          person_id={person_id}
          client_id={client_id}
          by_whom={state.session.user_id}
          onClose={() => updateData({ completingTask: null }, true)}
          onSaved={handleCompletionRecorded}
        />
      )}

      {/* TaskCompletionRound — admin batch completion */}
      {showCompletionRound && (
        <TaskCompletionRound
          personIds={[person_id]}
          client_id={client_id}
          viewer_id={state.session.user_id}
          isAdmin={data.administrative}
          onClose={() => setShowCompletionRound(false)}
        />
      )}
    </Box>
  );
}
