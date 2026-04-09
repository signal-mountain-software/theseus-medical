import React from 'react';

import {
  Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, IconButton, InputAdornment, MenuItem, Paper, Select, TextField, Typography
} from '@material-ui/core'; import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import EventIcon from '@material-ui/icons/Event';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import AVAConfirm from '../forms/AVAConfirm';
import QuickSearch from '../sections/QuickSearch';
import { deepCopy, uuid } from '../../util/AVAUtilities';
import { makeDate } from '../../util/AVADateTime';
import { putTask, deleteTask, getCompletionsForTask } from '../../util/AVATasks';
import useSession from '../../hooks/useSession';

const useStyles = makeStyles(theme => ({
  paperPallette: {
    borderRadius: '30px 30px 30px 30px',
    width: '95%',
    maxWidth: '720px',
    margin: 0,
    maxHeight: '98%',
  },
  sectionBox: {
    border: '1px solid #ccc',
    borderRadius: '12px',
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  sectionTitle: {
    fontWeight: 'bold',
    marginBottom: theme.spacing(1),
    fontSize: '1rem',
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(0.5),
  },
  fieldRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
}));

// ─── Constants ────────────────────────────────────────────────────────────────

const VALUE_TYPES = [
  { key: 'boolean', label: 'Yes/No' },
  { key: 'text', label: 'text' },
  { key: 'number', label: 'number' },
  { key: 'scale', label: 'scale' },
  { key: 'choice', label: 'choice' },
];
const RECURRENCE_OPTIONS = ['once', 'daily', 'weekly', 'monthly'];
const TIMES_OF_DAY_OPTIONS = ['morning', 'midday', 'afternoon', 'breakfast', 'lunch', 'dinner', 'bedtime'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const REMINDER_METHODS = ['ava_only', 'sms', 'email', 'push'];

// ─── Helper: blank structures ─────────────────────────────────────────────────

const blankField = () => ({ field_id: `f_${uuid(8)}`, prompt: '', value_type: 'boolean', options: [] });
const blankReminder = () => ({ minutes_before: 60, method: 'ava_only', allow_response_as_completion: false });
const blankSchedule = () => ({ recurrence: 'once', times_of_day: [], dow: [], dom: 1, due_date: '' });

const blankTask = (client_id, created_by) => ({
  task_id: null,
  client_id,
  description: '',
  status: 'active',
  start_date: '',
  end_date: '',
  available_to: ['*all'],
  applies_to: [],
  data_to_collect: [],
  schedule: blankSchedule(),
  remind_who: [],
  reminders: [],
  streak_rules: [],
  created_by,
  source: 'user',
});

// ─── SmartDateField ───────────────────────────────────────────────────────────
// Text field with natural-language date parsing + native calendar picker.
// Stores yyyy-mm-dd internally; displays a friendly resolved string after entry.
function SmartDateField({ label, value, onChange, style }) {
  const pickerRef = React.useRef(null);
  const editingRef = React.useRef(false);

  const toDisplay = (iso) => {
    if (!iso) { return ''; }
    const p = makeDate(iso);
    return (!p.error && p.absolute) ? p.absolute : iso;
  };

  const [displayText, setDisplayText] = React.useState(() => toDisplay(value));

  React.useEffect(() => {
    if (!editingRef.current) { setDisplayText(toDisplay(value)); }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveAndStore = (raw) => {
    editingRef.current = false;
    if (!raw) { onChange(''); setDisplayText(''); return; }
    const parsed = makeDate(raw);
    if (!parsed.error && parsed.input) {
      onChange(parsed.input);
      setDisplayText(parsed.absolute);
    } else {
      setDisplayText(toDisplay(value)); // revert to last good value
    }
  };

  return (
    <Box style={{ position: 'relative', ...(style || {}) }}>
      <TextField
        label={label}
        size='small'
        value={displayText}
        placeholder='e.g. tomorrow, Apr 15'
        InputLabelProps={{ shrink: true }}
        onChange={e => { editingRef.current = true; setDisplayText(e.target.value); }}
        onBlur={e => resolveAndStore(e.target.value.trim())}
        margin='dense'
        fullWidth
        InputProps={{
          endAdornment: (
            <InputAdornment position='end'>
              <IconButton
                size='small'
                tabIndex={-1}
                onClick={() => {
                  if (pickerRef.current) {
                    if (pickerRef.current.showPicker) { pickerRef.current.showPicker(); }
                    else { pickerRef.current.click(); }
                  }
                }}
              >
                <EventIcon fontSize='small' />
              </IconButton>
            </InputAdornment>
          )
        }}
      />
      <input
        ref={pickerRef}
        type='date'
        value={value || ''}
        onChange={e => {
          editingRef.current = false;
          const iso = e.target.value;
          onChange(iso || '');
          setDisplayText(toDisplay(iso));
        }}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0 }}
        tabIndex={-1}
      />
    </Box>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * TaskEditor
 *
 * Props:
 *   existingTask  {object|null}  - pass null to create a new task
 *   client_id     {string}
 *   onClose       {function}     - called with no args on cancel
 *   onSaved       {function(savedTaskRec)} - called after successful save
 */
export default function TaskEditor({ existingTask, client_id, onClose, onSaved, onDeleted }) {
  const { state } = useSession();
  const classes = useStyles();
  const AVAClass = AVAclasses();

  const isMounted = React.useRef(false);

  const [task, setTask] = React.useState(() =>
    existingTask ? deepCopy(existingTask) : blankTask(client_id, state.session.user_id)
  );
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleteBlocked, setDeleteBlocked] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [quickSearchTarget, setQuickSearchTarget] = React.useState(null); // 'available_to' | 'applies_to' | 'remind_who'
  const [qsData, setQsData] = React.useState({ selections: [], accessList: null });
  const updateQsData = (newData) => setQsData(prev => Object.assign({}, prev, newData));
  // Maps encoded keys ('person:id', 'group:id') to display names for chip labels
  const [chipNames, setChipNames] = React.useState(() => {
    const names = {};
    if (existingTask) {
      (existingTask.applies_to || []).forEach(e => { if (e.name) { names[`${e.type}:${e.id}`] = e.name; } });
      (existingTask.remind_who || []).forEach(e => { if (e.name) { names[`${e.type}:${e.id}`] = e.name; } });
    }
    return names;
  });

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const update = (path, value) => {
    setTask(prev => {
      let next = deepCopy(prev);
      // path can be 'field' or 'schedule.field'
      let parts = path.split('.');
      let obj = next;
      for (let i = 0; i < parts.length - 1; i++) { obj = obj[parts[i]]; }
      obj[parts[parts.length - 1]] = value;
      return next;
    });
  };

  // ── data_to_collect helpers ────────────────────────────────────────────────

  const addField = () => {
    setTask(prev => {
      let next = deepCopy(prev);
      next.data_to_collect.push(blankField());
      return next;
    });
  };

  const updateField = (index, key, value) => {
    setTask(prev => {
      let next = deepCopy(prev);
      next.data_to_collect[index][key] = value;
      return next;
    });
  };

  const removeField = (index) => {
    setTask(prev => {
      let next = deepCopy(prev);
      next.data_to_collect.splice(index, 1);
      return next;
    });
  };

  // ── reminders helpers ─────────────────────────────────────────────────────

  const addReminder = () => {
    setTask(prev => {
      let next = deepCopy(prev);
      next.reminders.push(blankReminder());
      return next;
    });
  };

  const updateReminder = (index, key, value) => {
    setTask(prev => {
      let next = deepCopy(prev);
      next.reminders[index][key] = value;
      return next;
    });
  };

  const removeReminder = (index) => {
    setTask(prev => {
      let next = deepCopy(prev);
      next.reminders.splice(index, 1);
      return next;
    });
  };

  const removeChip = (field, index) => {
    setTask(prev => {
      let next = deepCopy(prev);
      next[field].splice(index, 1);
      // Restore the *all fallback when the last specific available_to entry is removed
      if (field === 'available_to' && next.available_to.length === 0) {
        next.available_to = ['*all'];
      }
      return next;
    });
  };

  // ── QuickSearch close handler ─────────────────────────────────────────────

  const handleQuickSearchClose = (target, selections) => {
    setQuickSearchTarget(null);
    setQsData({ selections: [], accessList: null });
    if (!selections || selections.length === 0) { return; }
    // Collect display names for chip labels
    const newNames = {};
    selections.forEach(sel => {
      if (sel.group_id) { newNames[`group:${sel.group_id}`] = sel.group_name || sel.group_id; }
      else if (sel.person_id) { newNames[`person:${sel.person_id}`] = sel.person_name || sel.person_id; }
    });
    setChipNames(prev => Object.assign({}, prev, newNames));
    setTask(prev => {
      let next = deepCopy(prev);
      if (target === 'available_to') {
        // Remove the *all fallback when specific entries are being added
        next.available_to = next.available_to.filter(e => e !== '*all');
        selections.forEach(sel => {
          let entry = sel.group_id ? `group:${sel.group_id}` : `person:${sel.person_id}`;
          if (!next.available_to.includes(entry)) { next.available_to.push(entry); }
        });
      }
      else {
        // applies_to / remind_who — {type, id, name} objects
        selections.forEach(sel => {
          let entry = sel.group_id
            ? { type: 'group', id: sel.group_id, name: sel.group_name || sel.group_id }
            : { type: 'person', id: sel.person_id, name: sel.person_name || sel.person_id };
          if (!next[target].some(e => e.type === entry.type && e.id === entry.id)) {
            next[target].push(entry);
          }
        });
      }
      return next;
    });
  };

  // ── schedule: times of day toggle ─────────────────────────────────────────

  const toggleTimeOfDay = (t) => {
    setTask(prev => {
      let next = deepCopy(prev);
      let arr = next.schedule.times_of_day || [];
      let idx = arr.indexOf(t);
      if (idx >= 0) { arr.splice(idx, 1); }
      else { arr.push(t); }
      next.schedule.times_of_day = arr;
      return next;
    });
  };

  const toggleDow = (d) => {
    setTask(prev => {
      let next = deepCopy(prev);
      let arr = next.schedule.dow || [];
      let idx = arr.indexOf(d);
      if (idx >= 0) { arr.splice(idx, 1); }
      else { arr.push(d); }
      next.schedule.dow = arr;
      return next;
    });
  };

  // ── delete ────────────────────────────────────────────────────────────────

  const handleDeleteClick = async () => {
    if (!existingTask || !existingTask.task_id) { return; }
    const completions = await getCompletionsForTask(existingTask.task_id);
    if (completions && completions.length > 0) {
      setDeleteBlocked(true);
    } else {
      setConfirmDelete(true);
    }
  };

  const handleDeleteConfirmed = async () => {
    setConfirmDelete(false);
    setDeleting(true);
    await deleteTask(task.client_id, task.task_id);
    if (isMounted.current) { setDeleting(false); }
    if (onDeleted) { onDeleted(task.task_id); }
  };

  // ── save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!task.description.trim()) { return; }
    if (saving) { return; }
    setSaving(true);
    let saved = await putTask(task);
    if (isMounted.current) { setSaving(false); }
    if (onSaved) { onSaved(saved); }
  };

  // ── render ────────────────────────────────────────────────────────────────

  const { schedule } = task;

  return (
    <Dialog
      open
      fullWidth
      PaperProps={{ className: classes.paperPallette }}
      scroll='paper'
    >
      <DialogTitle disableTypography style={{ paddingBottom: '16px', paddingTop: '32px', borderBottom: '1px solid #ccc' }}>
        <Typography style={AVATextStyle({ size: 1.3, bold: true })}>
          {existingTask ? 'Edit Activity' : 'Add a New Activity'}
        </Typography>
      </DialogTitle>
      <DialogContent>

        {/* ── Basic Info ── */}
        <Box className={classes.sectionBox}>
          <Typography className={classes.sectionTitle}>Basic Information</Typography>
          <TextField
            label='Description'
            fullWidth
            value={task.description}
            onChange={e => update('description', e.target.value)}
            margin='dense'
          />
          <Box display='flex' flexDirection='row' mt={1} style={{ gap: 16 }}>
            <SmartDateField
              label='Start Date'
              value={task.start_date || ''}
              onChange={val => update('start_date', val)}
              style={{ flex: 1 }}
            />
            <SmartDateField
              label='End Date'
              value={task.end_date || ''}
              onChange={val => update('end_date', val)}
              style={{ flex: 1 }}
            />
          </Box>
          <Box mt={1} display='flex' alignItems='center' style={{ gap: 16 }}>
            <Typography variant='body2'>Status:</Typography>
            <FormControlLabel
              control={
                <Checkbox
                  checked={task.status === 'active'}
                  onChange={e => update('status', e.target.checked ? 'active' : 'inactive')}
                  color='primary'
                />
              }
              label='Active'
            />
          </Box>
        </Box>

        {/* ── applies_to ── */}
        <Box className={classes.sectionBox}>
          <Typography className={classes.sectionTitle}>Pertains To</Typography>
          <Typography variant='caption' color='textSecondary'>
            Who this task pertains to — the person or group that we are recording data for.
          </Typography>
          <Box mt={1}>
            <Button
              className={AVAClass.AVAButton}
              size='small'
              startIcon={<AddIcon />}
              onClick={() => {
                setQsData({ selections: [], accessList: null });
                setQuickSearchTarget('applies_to');
              }}
            >
              Pick People / Groups
            </Button>
          </Box>
          <Box className={classes.chipRow} mt={0.5}>
            {(task.applies_to || []).map((entry, i) => {
              const isGroup = entry.type === 'group';
              const displayName = entry.name || chipNames[`${entry.type}:${entry.id}`] || entry.id;
              const label = isGroup ? `👥 ${displayName}` : displayName;
              return <Chip key={i} label={label} size='small' onDelete={() => removeChip('applies_to', i)} />;
            })}
          </Box>
        </Box>

        {/* ── Schedule ── */}
        <Box className={classes.sectionBox}>
          <Typography className={classes.sectionTitle}>Schedule</Typography>
          <Box display='flex' alignItems='center' style={{ gap: 12 }}>
            <Typography variant='body2'>Recurrence:</Typography>
            <Select
              value={schedule.recurrence || 'once'}
              onChange={e => update('schedule.recurrence', e.target.value)}
              style={{ minWidth: 120 }}
            >
              {RECURRENCE_OPTIONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </Select>
          </Box>

          {schedule.recurrence === 'once' && (
            <SmartDateField
              label='Due Date'
              value={schedule.due_date || ''}
              onChange={val => update('schedule.due_date', val)}
            />
          )}

          {schedule.recurrence === 'weekly' && (
            <Box mt={1}>
              <Typography variant='body2'>Days of week:</Typography>
              <Box display='flex' flexWrap='wrap' style={{ gap: 4 }}>
                {DAY_NAMES.map((d, i) => (
                  <FormControlLabel
                    key={d}
                    control={
                      <Checkbox
                        size='small'
                        checked={Array.isArray(schedule.dow) && schedule.dow.includes(i)}
                        onChange={() => toggleDow(i)}
                        color='primary'
                      />
                    }
                    label={d}
                  />
                ))}
              </Box>
            </Box>
          )}

          {schedule.recurrence === 'monthly' && (
            <TextField
              label='Day of month'
              type='number'
              value={schedule.dom || ''}
              onChange={e => update('schedule.dom', Number(e.target.value))}
              inputProps={{ min: 1, max: 31 }}
              margin='dense'
              style={{ width: 120 }}
            />
          )}

          <Box mt={1}>
            <Typography variant='body2' gutterBottom>Times of day:</Typography>
            <Box display='flex' flexWrap='wrap' style={{ gap: 4 }}>
              {TIMES_OF_DAY_OPTIONS.map(t => (
                <FormControlLabel
                  key={t}
                  control={
                    <Checkbox
                      size='small'
                      checked={Array.isArray(schedule.times_of_day) && schedule.times_of_day.includes(t)}
                      onChange={() => toggleTimeOfDay(t)}
                      color='primary'
                    />
                  }
                  label={t}
                />
              ))}
            </Box>
            <Box display='flex' alignItems='center' mt={0.5} style={{ gap: 8 }}>
              <Typography variant='caption' color='textSecondary'>Specific time (HH:MM):</Typography>
              <TextField
                size='small'
                placeholder='08:30'
                onBlur={e => {
                  let val = e.target.value.trim();
                  if (val && /^\d{1,2}:\d{2}$/.test(val)) {
                    let arr = deepCopy(schedule.times_of_day || []);
                    if (!arr.includes(val)) { arr.push(val); }
                    update('schedule.times_of_day', arr);
                    e.target.value = '';
                  }
                }}
                style={{ width: 90 }}
              />
            </Box>
            {(schedule.times_of_day || []).some(t => /^\d{1,2}:\d{2}$/.test(t)) && (
              <Box className={classes.chipRow} mt={0.5}>
                {(schedule.times_of_day || []).filter(t => /^\d{1,2}:\d{2}$/.test(t)).map((t, i) => {
                  const [hh, mm] = t.split(':').map(Number);
                  const ampm = hh < 12 ? 'am' : 'pm';
                  const h12 = hh % 12 || 12;
                  const chipLabel = `${h12}:${String(mm).padStart(2, '0')} ${ampm}`;
                  return (
                  <Chip
                    key={t}
                    size='small'
                    label={chipLabel}
                    onDelete={() => {
                      let arr = deepCopy(schedule.times_of_day || []).filter(x => x !== t);
                      update('schedule.times_of_day', arr);
                    }}
                  />
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>

        {/* ── data_to_collect ── */}
        <Box className={classes.sectionBox}>
          <Typography className={classes.sectionTitle}>Data to Collect</Typography>
          {(task.data_to_collect || []).map((field, i) => (
            <Paper key={i} elevation={1} style={{ padding: 8, marginBottom: 8, borderRadius: 8 }}>
              <Box className={classes.fieldRow}>
                <TextField
                  size='small'
                  label='Prompt'
                  value={field.prompt}
                  onChange={e => updateField(i, 'prompt', e.target.value)}
                  style={{ flex: 1 }}
                />
                <Select
                  value={field.value_type}
                  onChange={e => updateField(i, 'value_type', e.target.value)}
                  style={{ minWidth: 100, paddingTop: '12px' }}
                >
                  {VALUE_TYPES.map(vt => <MenuItem key={vt.key} value={vt.key}>{vt.label}</MenuItem>)}
                </Select>
                <IconButton size='small' onClick={() => removeField(i)}>
                  <DeleteIcon fontSize='small' />
                </IconButton>
              </Box>
              {field.value_type === 'choice' && (
                <TextField
                  size='small'
                  label='Options (comma-separated)'
                  value={Array.isArray(field.options) ? field.options.join(', ') : ''}
                  onChange={e => updateField(i, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                  fullWidth
                />
              )}
              {field.value_type === 'scale' && (
                <Box display='flex' style={{ gap: 8 }}>
                  <TextField
                    size='small'
                    label='Min'
                    type='number'
                    value={field.options && field.options[0] !== undefined ? field.options[0] : ''}
                    onChange={e => {
                      let opts = deepCopy(field.options || [null, null]);
                      opts[0] = Number(e.target.value);
                      updateField(i, 'options', opts);
                    }}
                    style={{ width: 80 }}
                  />
                  <TextField
                    size='small'
                    label='Max'
                    type='number'
                    value={field.options && field.options[1] !== undefined ? field.options[1] : ''}
                    onChange={e => {
                      let opts = deepCopy(field.options || [null, null]);
                      opts[1] = Number(e.target.value);
                      updateField(i, 'options', opts);
                    }}
                    style={{ width: 80 }}
                  />
                </Box>
              )}
            </Paper>
          ))}
          <Button
            className={AVAClass.AVAButton}
            size='small'
            startIcon={<AddIcon />}
            onClick={addField}
          >
            Add Field
          </Button>
        </Box>

        {/* ── remind_who ── */}
        <Box className={classes.sectionBox}>
          <Typography className={classes.sectionTitle}>Send Reminders To</Typography>
          <Typography variant='caption' color='textSecondary'>
            Who receives reminder messages. Leave blank to send no reminders.
          </Typography>
          <Box mt={1}>
            <Button
              className={AVAClass.AVAButton}
              size='small'
              startIcon={<AddIcon />}
              onClick={() => {
                setQsData({ selections: [], accessList: null });
                setQuickSearchTarget('remind_who');
              }}
            >
              Pick People / Groups
            </Button>
            {task.applies_to && task.applies_to.length > 0 && (
              <Button
                className={AVAClass.AVAButton}
                size='small'
                onClick={() => {
                  setTask(prev => {
                    let next = deepCopy(prev);
                    next.applies_to.forEach(entry => {
                      if (!next.remind_who.some(e => e.type === entry.type && e.id === entry.id)) {
                        next.remind_who.push(Object.assign({}, entry));
                      }
                    });
                    return next;
                  });
                }}
              >
                + Same as Assigned To
              </Button>
            )}
          </Box>
          <Box className={classes.chipRow} mt={0.5}>
            {(task.remind_who || []).map((entry, i) => {
              const isGroup = entry.type === 'group';
              const displayName = entry.name || chipNames[`${entry.type}:${entry.id}`] || entry.id;
              const label = isGroup ? `👥 ${displayName}` : displayName;
              return <Chip key={i} label={label} size='small' onDelete={() => removeChip('remind_who', i)} />;
            })}
          </Box>
        </Box>

        {/* ── reminders ── */}
        {(task.remind_who || []).length > 0 && (
          <Box className={classes.sectionBox}>
            <Typography className={classes.sectionTitle}>Reminder Specifications</Typography>
            {(task.reminders || []).map((rem, i) => (
              <Paper key={i} elevation={1} style={{ padding: 8, marginBottom: 8, borderRadius: 8 }}>
                <Box className={classes.fieldRow}>
                  <TextField
                    size='small'
                    label='Minutes before'
                    type='number'
                    value={rem.minutes_before}
                    onChange={e => updateReminder(i, 'minutes_before', Number(e.target.value))}
                    style={{ width: 120 }}
                  />
                  <Select
                    value={rem.method}
                    onChange={e => updateReminder(i, 'method', e.target.value)}
                    style={{ minWidth: 120 }}
                  >
                    {REMINDER_METHODS.map(m => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </Select>
                  <FormControlLabel
                    control={
                      <Checkbox
                        size='small'
                        checked={!!rem.allow_response_as_completion}
                        onChange={e => updateReminder(i, 'allow_response_as_completion', e.target.checked)}
                        color='primary'
                      />
                    }
                    label='Response = completion'
                  />
                  <IconButton size='small' onClick={() => removeReminder(i)}>
                    <DeleteIcon fontSize='small' />
                  </IconButton>
                </Box>
              </Paper>
            ))}
            <Button
              className={AVAClass.AVAButton}
              size='small'
              startIcon={<AddIcon />}
              onClick={addReminder}
            >
              Add Reminder
            </Button>
          </Box>
        )}

      </DialogContent>

      {quickSearchTarget && (
        <QuickSearch
          reactData={qsData}
          updateReactData={updateQsData}
          options={{
            pickAndGo: true,
            keepSelections: true,
            withGroups: true,
            showAll: true,
            title: quickSearchTarget === 'available_to'
              ? 'Select who can view/complete this task'
              : quickSearchTarget === 'applies_to'
                ? 'Select who this task applies to'
                : 'Select who to remind',
            buttonText: 'Done',
            buttonColor: 'green',
          }}
          onClose={(selections) => handleQuickSearchClose(quickSearchTarget, selections)}
        />
      )}

      {confirmDelete && (
        <AVAConfirm
          promptText={['Delete this activity?', 'This cannot be undone.']}
          cancelText='No, keep it'
          confirmText='Yes, delete'
          onCancel={() => setConfirmDelete(false)}
          onConfirm={handleDeleteConfirmed}
        />
      )}

      {deleteBlocked && (
        <AVAConfirm
          promptText={['Cannot delete this activity.', 'It has completion records on file.']}
          cancelText='OK'
          confirmText=''
          onCancel={() => setDeleteBlocked(false)}
          onConfirm={() => setDeleteBlocked(false)}
        />
      )}

      <DialogActions style={{ paddingTop: '12px', paddingBottom: '12px', borderTop: '1px solid #ccc' }}>
        {existingTask && existingTask.task_id && (
          <Button
            className={AVAClass.AVAButton}
            style={{ backgroundColor: (deleting ? 'gray' : '#b71c1c'), color: 'white', marginRight: 'auto' }}
            size='small'
            onClick={handleDeleteClick}
            disabled={deleting || saving}
            startIcon={<DeleteIcon fontSize='small' />}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        )}
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: 'red', color: 'white' }}
          size='small'
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          className={AVAClass.AVAButton}
          style={{ backgroundColor: (saving ? 'gray' : 'green'), color: 'white' }}
          size='small'
          onClick={handleSave}
          disabled={!task.description.trim() || saving}
        >
          {saving ? 'Saving…' : 'Save Activity'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
