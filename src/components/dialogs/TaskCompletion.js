import React from 'react';

import {
  Box, Button, Checkbox, Dialog, DialogActions, DialogContent,
  FormControl, FormControlLabel, FormLabel,
  MenuItem, Radio, RadioGroup, Select, Slider, Switch,
  TextField, Typography
} from '@material-ui/core';
import makeStyles from '@material-ui/core/styles/makeStyles';

import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { recordTaskCompletion, getScheduledSlots } from '../../util/AVATasks';
import { makeDate } from '../../util/AVADateTime';

const useStyles = makeStyles(theme => ({
  paperPallette: {
    borderRadius: '30px 30px 30px 30px',
    width: '95%',
    maxWidth: '640px',
    margin: 0,
    maxHeight: '98%',
  },
  fieldCard: {
    border: '1px solid #ddd',
    borderRadius: '10px',
    padding: theme.spacing(1.5),
    marginBottom: theme.spacing(1.5),
  },
  prompt: {
    fontWeight: 'bold',
    marginBottom: theme.spacing(0.75),
  },
  confirm: {
    textTransform: 'none',
    color: theme.palette.confirm ? theme.palette.confirm[theme.palette.type] : 'green',
  },
  reject: {
    textTransform: 'none',
    color: theme.palette.reject ? theme.palette.reject[theme.palette.type] : 'red',
  },
  sliderBox: {
    paddingLeft: theme.spacing(1),
    paddingRight: theme.spacing(2),
    paddingTop: theme.spacing(1),
  },
}));

/**
 * TaskCompletion
 *
 * Records a completion for a single task for one person (or group).
 *
 * Props:
 *   taskRec         {object}   - the full Task record
 *   person_id       {string}   - the person the completion is for
 *   client_id       {string}
 *   by_whom         {string}   - person_id of the user recording
 *   onClose         {function}
 *   onSaved         {function(completionRec)}
 */
export default function TaskCompletion({ taskRec, person_id, client_id, by_whom, onClose, onSaved }) {
  const classes = useStyles();
  const AVAClass = AVAclasses();

  const isMounted = React.useRef(false);

  // ── Collected values: { [field_id]: value } ───────────────────────────────
  const [collectedValues, setCollectedValues] = React.useState(() => {
    let init = {};
    (taskRec.data_to_collect || []).forEach(f => {
      switch (f.value_type) {
        case 'boolean': init[f.field_id] = false; break;
        case 'number':  init[f.field_id] = ''; break;
        case 'scale':   {
          let min = f.options && f.options[0] !== undefined ? f.options[0] : 1;
          init[f.field_id] = min;
          break;
        }
        case 'choice':  init[f.field_id] = ''; break;
        default:        init[f.field_id] = '';
      }
    });
    return init;
  });

  const [notes, setNotes] = React.useState('');
  const [isRetroactive, setIsRetroactive] = React.useState(false);
  const [scheduledFor, setScheduledFor] = React.useState('');

  // Group task handling
  const [isGroupTask, setIsGroupTask] = React.useState(false);
  const [groupPromptAnswered, setGroupPromptAnswered] = React.useState(false);
  const [groupId, setGroupId] = React.useState(null);

  const [saving, setSaving] = React.useState(false);

  // ── Detect if applies_to contains a group ────────────────────────────────
  const hasGroupTarget = React.useMemo(() => {
    return Array.isArray(taskRec.applies_to) &&
      taskRec.applies_to.some(e => e.type === 'group');
  }, [taskRec]);

  const firstGroupId = React.useMemo(() => {
    if (!hasGroupTarget) { return null; }
    let entry = taskRec.applies_to.find(e => e.type === 'group');
    return entry ? entry.id : null;
  }, [hasGroupTarget, taskRec]);

  // ── Available scheduled slots for retroactive dropdown ───────────────────
  const recentSlots = React.useMemo(() => {
    if (!taskRec.schedule) { return []; }
    let end = new Date();
    let start = new Date();
    start.setDate(start.getDate() - 30);
    return getScheduledSlots(taskRec.schedule, start, end).reverse().slice(0, 20);
  }, [taskRec]);

  React.useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ── Field value updater ──────────────────────────────────────────────────
  const setFieldValue = (field_id, value) => {
    setCollectedValues(prev => Object.assign({}, prev, { [field_id]: value }));
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (saving) { return; }
    setSaving(true);

    let completionRec = await recordTaskCompletion({
      taskRec,
      person_id: isGroupTask ? null : person_id,
      group_id: isGroupTask ? groupId : null,
      is_group_completion: isGroupTask,
      by_whom,
      notes: notes.trim() || null,
      collectedValues,
      scheduled_for: isRetroactive && scheduledFor ? scheduledFor : null,
      source: 'manual',
      is_retroactive: isRetroactive,
    });

    if (isMounted.current) { setSaving(false); }
    if (onSaved) { onSaved(completionRec); }
  };

  // ── Render: field input by value_type ────────────────────────────────────
  const renderFieldInput = (field) => {
    const value = collectedValues[field.field_id];
    switch (field.value_type) {
      case 'boolean': {
        return (
          <FormControlLabel
            control={
              <Switch
                checked={!!value}
                onChange={e => setFieldValue(field.field_id, e.target.checked)}
                color='primary'
              />
            }
            label={value ? 'Yes / Complete' : 'No / Incomplete'}
          />
        );
      }
      case 'text': {
        return (
          <TextField
            fullWidth
            multiline
            minRows={2}
            variant='outlined'
            size='small'
            value={value || ''}
            onChange={e => setFieldValue(field.field_id, e.target.value)}
          />
        );
      }
      case 'number': {
        return (
          <TextField
            type='number'
            variant='outlined'
            size='small'
            value={value || ''}
            onChange={e => setFieldValue(field.field_id, e.target.value)}
            style={{ width: 160 }}
          />
        );
      }
      case 'scale': {
        let min = field.options && field.options[0] !== undefined ? Number(field.options[0]) : 1;
        let max = field.options && field.options[1] !== undefined ? Number(field.options[1]) : 10;
        return (
          <Box className={classes.sliderBox}>
            <Slider
              value={typeof value === 'number' ? value : min}
              min={min}
              max={max}
              step={1}
              marks
              valueLabelDisplay='auto'
              onChange={(e, v) => setFieldValue(field.field_id, v)}
            />
            <Box display='flex' justifyContent='space-between'>
              <Typography variant='caption'>{min}</Typography>
              <Typography variant='caption'>{max}</Typography>
            </Box>
          </Box>
        );
      }
      case 'choice': {
        let opts = Array.isArray(field.options) ? field.options : [];
        return (
          <RadioGroup
            value={value || ''}
            onChange={e => setFieldValue(field.field_id, e.target.value)}
          >
            {opts.map(opt => (
              <FormControlLabel key={opt} value={opt} control={<Radio size='small' color='primary' />} label={opt} />
            ))}
          </RadioGroup>
        );
      }
      default: return null;
    }
  };

  // ── Group prompt (shown once before main form) ────────────────────────────
  if (hasGroupTarget && !groupPromptAnswered) {
    return (
      <Dialog open fullWidth PaperProps={{ className: classes.paperPallette }}>
        <DialogContent>
          <Typography style={AVATextStyle({ size: 1.3, bold: true })} gutterBottom>
            Group Task?
          </Typography>
          <Typography variant='body1' gutterBottom>
            This task applies to a group. Would you like to record a single completion
            for the whole group, or a completion for this individual person only?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button className={classes.reject} onClick={onClose}>
            Cancel
          </Button>
          <Button
            className={AVAClass.AVAButton}
            onClick={() => {
              setIsGroupTask(false);
              setGroupPromptAnswered(true);
            }}
          >
            Individual only
          </Button>
          <Button
            className={classes.confirm}
            onClick={() => {
              setIsGroupTask(true);
              setGroupId(firstGroupId);
              setGroupPromptAnswered(true);
            }}
          >
            Whole group
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  // ── Main completion form ──────────────────────────────────────────────────
  return (
    <Dialog
      open
      fullWidth
      PaperProps={{ className: classes.paperPallette }}
      scroll='paper'
    >
      <DialogContent>
        <Typography style={AVATextStyle({ size: 1.3, bold: true })} gutterBottom>
          Record Completion
        </Typography>
        <Typography variant='body2' color='textSecondary' gutterBottom>
          {taskRec.description}
          {isGroupTask && ' (group)'}
        </Typography>

        {/* ── Data collection fields ── */}
        {(taskRec.data_to_collect || []).length === 0 && (
          <Box className={classes.fieldCard}>
            <Typography variant='body2' color='textSecondary'>
              No data fields — tap Save to mark this task complete.
            </Typography>
          </Box>
        )}

        {(taskRec.data_to_collect || []).map((field, i) => (
          <Box key={i} className={classes.fieldCard}>
            <Typography className={classes.prompt}>
              {field.prompt || field.field_id}
            </Typography>
            {renderFieldInput(field)}
          </Box>
        ))}

        {/* ── Notes ── */}
        <Box mb={1.5}>
          <TextField
            label='Notes (optional)'
            fullWidth
            multiline
            minRows={2}
            variant='outlined'
            size='small'
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </Box>

        {/* ── Retroactive ── */}
        <FormControlLabel
          control={
            <Checkbox
              checked={isRetroactive}
              onChange={e => setIsRetroactive(e.target.checked)}
              color='primary'
              size='small'
            />
          }
          label='Recording retroactively'
        />

        {isRetroactive && (
          <Box mt={1}>
            <FormControl fullWidth size='small'>
              <FormLabel style={{ fontSize: '0.8rem', marginBottom: 4 }}>
                Which scheduled slot does this satisfy?
              </FormLabel>
              {recentSlots.length > 0 ? (
                <Select
                  value={scheduledFor}
                  onChange={e => setScheduledFor(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value=''><em>Select a slot…</em></MenuItem>
                  {recentSlots.map(slot => (
                    <MenuItem key={slot} value={slot}>
                      {makeDate(slot).absolute}
                    </MenuItem>
                  ))}
                </Select>
              ) : (
                <TextField
                  type='datetime-local'
                  size='small'
                  InputLabelProps={{ shrink: true }}
                  value={scheduledFor}
                  onChange={e => setScheduledFor(e.target.value)}
                />
              )}
            </FormControl>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button className={classes.reject} onClick={onClose}>
          Cancel
        </Button>
        <Button
          className={classes.confirm}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
