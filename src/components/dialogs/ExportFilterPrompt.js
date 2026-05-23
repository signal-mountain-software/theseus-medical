import React, { useState } from 'react';

import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, Typography,
  FormGroup, FormControlLabel, Checkbox,
  Switch, TextField, Select, MenuItem, FormControl,
} from '@material-ui/core';

import { AVATextStyle, AVAclasses } from '../../util/AVAStyles';

// ─── Date preset helpers ─────────────────────────────────────────────────────

const DATE_PRESETS = [
  { label: 'Last 7 days',  value: 'last7'     },
  { label: 'Last 30 days', value: 'last30'    },
  { label: 'Last 90 days', value: 'last90'    },
  { label: 'This month',   value: 'thisMonth' },
  { label: 'This year',    value: 'thisYear'  },
  { label: 'Custom range', value: 'custom'    },
];

function resolveDatePreset(preset, customFrom, customTo) {
  const now  = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (preset) {
    case 'last7':     return { from: now - 7  * 86400000, to: now };
    case 'last30':    return { from: now - 30 * 86400000, to: now };
    case 'last90':    return { from: now - 90 * 86400000, to: now };
    case 'thisMonth': return { from: new Date(today.getFullYear(), today.getMonth(), 1).getTime(), to: now };
    case 'thisYear':  return { from: new Date(today.getFullYear(), 0, 1).getTime(), to: now };
    case 'custom': {
      const from = customFrom ? new Date(customFrom).getTime()             : today.getTime();
      const to   = customTo   ? new Date(customTo + 'T23:59:59').getTime() : now;
      return { from, to };
    }
    default: return { from: undefined, to: now };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Pre-flight prompt dialog for PDF exports that have notes fields with
 * source: "prompt" filters (e.g. date ranges, category multi-selects).
 *
 * Props:
 *   promptSpecs  – array of { prompt_label, value_type, operator, field }
 *   onComplete   – called with { [prompt_label]: resolvedValue } when user taps Continue
 *   onCancel     – called when user taps Cancel
 */
export default function ExportFilterPrompt({ promptSpecs = [], onComplete, onCancel }) {
  const AVAClass = AVAclasses();

  const buildInitialValues = () =>
    Object.fromEntries(promptSpecs.map(spec => {
      if (spec.value_type === 'boolean')     return [spec.prompt_label, false];
      if (spec.value_type === 'date_preset') return [spec.prompt_label, { preset: 'last30', customFrom: '', customTo: '' }];
      if (Array.isArray(spec.value_type))    return [spec.prompt_label, []];
      return [spec.prompt_label, ''];
    }));

  const [rawValues, setRawValues] = useState(buildInitialValues);

  const setVal = (label, val) =>
    setRawValues(prev => ({ ...prev, [label]: val }));

  const handleComplete = () => {
    const resolved = {};
    for (const spec of promptSpecs) {
      const raw = rawValues[spec.prompt_label];
      if (spec.value_type === 'date_preset') {
        resolved[spec.prompt_label] = resolveDatePreset(raw.preset, raw.customFrom, raw.customTo);
      } else if (spec.value_type === 'number') {
        resolved[spec.prompt_label] = (raw === '' || raw === undefined) ? undefined : Number(raw);
      } else {
        resolved[spec.prompt_label] = raw;
      }
    }
    onComplete(resolved);
  };

  if (!promptSpecs.length) { return null; }

  return (
    <Dialog open maxWidth='xs' fullWidth>
      <DialogTitle disableTypography>
        <Typography style={AVATextStyle({ bold: true, size: 1.1 })}>
          {'Filter Options'}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {promptSpecs.map(spec => {
          const { prompt_label, value_type, operator } = spec;
          const raw = rawValues[prompt_label];

          return (
            <Box key={prompt_label} mb={2}>
              <Typography style={AVATextStyle({ bold: true, size: 0.9, margin: { bottom: 0.25 } })}>
                {prompt_label}
              </Typography>

              {/* ── Array of options → checkbox list (ct = multi-select, else single) ── */}
              {Array.isArray(value_type) && (
                <FormGroup>
                  {value_type.map(option => (
                    <FormControlLabel
                      key={option}
                      control={
                        <Checkbox
                          size='small'
                          color='primary'
                          checked={Array.isArray(raw) ? raw.includes(option) : raw === option}
                          onChange={() => {
                            if (operator === 'ct') {
                              const next = Array.isArray(raw) ? [...raw] : [];
                              setVal(prompt_label,
                                next.includes(option)
                                  ? next.filter(v => v !== option)
                                  : [...next, option]
                              );
                            } else {
                              setVal(prompt_label, option);
                            }
                          }}
                        />
                      }
                      label={<Typography style={AVATextStyle({ size: 0.85 })}>{option}</Typography>}
                    />
                  ))}
                </FormGroup>
              )}

              {/* ── Boolean → yes / no switch ── */}
              {value_type === 'boolean' && (
                <Box display='flex' alignItems='center' style={{ gap: '6px' }}>
                  <Typography style={AVATextStyle({ size: 0.85 })}>{'No'}</Typography>
                  <Switch
                    size='small'
                    color='primary'
                    checked={!!raw}
                    onChange={e => setVal(prompt_label, e.target.checked)}
                  />
                  <Typography style={AVATextStyle({ size: 0.85 })}>{'Yes'}</Typography>
                </Box>
              )}

              {/* ── Date preset → select + optional date pickers ── */}
              {value_type === 'date_preset' && (
                <Box>
                  <FormControl fullWidth size='small' variant='outlined'>
                    <Select
                      value={raw.preset || 'last30'}
                      onChange={e => setVal(prompt_label, { ...raw, preset: e.target.value })}
                    >
                      {DATE_PRESETS.map(p => (
                        <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  {raw.preset === 'custom' && (
                    <Box display='flex' mt={1} style={{ gap: '8px' }}>
                      <TextField
                        label='From' type='date' size='small' variant='outlined'
                        InputLabelProps={{ shrink: true }}
                        value={raw.customFrom || ''}
                        onChange={e => setVal(prompt_label, { ...raw, customFrom: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      <TextField
                        label='To' type='date' size='small' variant='outlined'
                        InputLabelProps={{ shrink: true }}
                        value={raw.customTo || ''}
                        onChange={e => setVal(prompt_label, { ...raw, customTo: e.target.value })}
                        style={{ flex: 1 }}
                      />
                    </Box>
                  )}
                </Box>
              )}

              {/* ── Single date picker ── */}
              {value_type === 'date' && (
                <TextField
                  type='date' size='small' variant='outlined' fullWidth
                  InputLabelProps={{ shrink: true }}
                  value={raw || ''}
                  onChange={e => setVal(prompt_label, e.target.value)}
                />
              )}

              {/* ── Number input ── */}
              {value_type === 'number' && (
                <TextField
                  type='number' size='small' variant='outlined' fullWidth
                  value={raw || ''}
                  onChange={e => setVal(prompt_label, e.target.value)}
                />
              )}

              {/* ── Default: plain text ── */}
              {(!value_type || value_type === 'text') && (
                <TextField
                  size='small' variant='outlined' fullWidth
                  value={raw || ''}
                  onChange={e => setVal(prompt_label, e.target.value)}
                />
              )}
            </Box>
          );
        })}
      </DialogContent>

      <DialogActions>
        <Button
          className={AVAClass.AVAButton}
          size='small'
          style={{ backgroundColor: 'green', color: 'white' }}
          onClick={handleComplete}
        >
          {'Continue'}
        </Button>
        <Button
          className={AVAClass.AVAButton}
          size='small'
          style={{ backgroundColor: 'red', color: 'white' }}
          onClick={onCancel}
        >
          {'Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
