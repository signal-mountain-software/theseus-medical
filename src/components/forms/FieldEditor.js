import React, { useState, useRef } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
import { listFromArray, titleCase } from '../../util/AVAUtilities';
import RichTextEditor from './RichTextEditor';
import {
  Box,
  TextField,
  Checkbox,
  FormControlLabel,
  Button,
  Dialog,
  DialogContent,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  IconButton
} from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';
// Removed drag-and-drop imports

const useStyles = makeStyles(theme => ({
  root: {
    borderRadius: '30px',
    width: '100%',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  radioDays: {
    fontSize: theme.typography.fontSize * 0.8,
    marginLeft: '-8px',
    marginRight: '16px',
    '&.MuiInputBase-input': {
      paddingBottom: '0px'
    }
  },
  header: {
    padding: theme.spacing(3),
    borderBottom: '1px solid #eee',
    zIndex: 2,
  },
  sectionsArea: {
    flex: 1,
    overflowY: 'auto',
    paddingTop: 0,
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
    paddingBottom: theme.spacing(2),
  },
  buttonBar: {
    padding: theme.spacing(2),
    borderTop: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  sectionPaper: {
    borderRadius: '18px',
    margin: '12px 0',
    padding: 12,
  },
  selectedSection: {
    border: '2px solid #1976d2',
  },
  button: {
    borderRadius: '20px',
    textTransform: 'none',
    fontWeight: 500,
    marginLeft: theme.spacing(1),
    padding: '8px 24px',
  },
}));


const FieldEditor = ({ field, open, onSave, onCancel, fieldsMap = {}, onAddRule, ruleEditorCommonFields = [], onRemove, sectionIdx, fieldIdx }) => {
  const [editField, setEditField] = useState(() => {
    // Migrate legacy schema: prompt.value + prompt.rows/width/occurrences -> prompt (string) & value.*
    const initial = { ...field };
    if (initial.prompt && typeof initial.prompt === 'object' && initial.prompt.hasOwnProperty('value')) {
      const { value: promptText, ...promptMeta } = initial.prompt;
      initial.prompt = promptText || '';
      initial.value = { ...(initial.value || {}), ...promptMeta }; // rows, width, occurrences, etc
    }
    // Ensure value object exists for new flattened properties
    if (!initial.value) initial.value = {};
    // Default sub-objects
    if (!initial.value.selection) initial.value.selection = { selectionList: [], max: 1 };
    // Default custom selection flag (for select type allowing user-provided value)
    if (initial.value.custom_selection === undefined) initial.value.custom_selection = false;
    // Legacy field_id assignment: if absent, use raw field_name then normalize field_name
    if (!initial.field_id && initial.field_name) {
      const rawName = initial.field_name;
      initial.field_id = rawName;
      initial.field_name = rawName.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_');
    }
    return initial;
  });
  const [fieldNameDisplay, setFieldNameDisplay] = useState(() => {
    const raw = editField.field_name || '';
    const cleaned = raw.replace(/[^a-zA-Z0-9]+/g, ' ');
    return cleaned.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  });
  const quillRef = useRef(null);

  const [ruleEditorOpen, setRuleEditorOpen] = useState(false);
  const [ruleEditorRule, setRuleEditorRule] = useState(null);
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

  const classes = useStyles();

  const handleChange = (key, value) => {
    if (key.includes('.')) {
      // Support dot notation, e.g. 'prompt.value'
      const keys = key.split('.');
      setEditField(prev => {
        const updated = { ...prev };
        let obj = updated;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!obj[keys[i]]) obj[keys[i]] = {};
          obj = obj[keys[i]];
        }
        if (value === '*delete*') {
          delete obj[keys[keys.length - 1]];
        } else {
          obj[keys[keys.length - 1]] = value;
        }
        return updated;
      });
    } else {
      setEditField(prev => {
        const updated = { ...prev };
        if (value === '*delete*') {
          delete updated[key];
        } else {
          updated[key] = value;
        }
        return updated;
      });
    }
    return;
  };

  const handleSave = () => {
    if (onSave) onSave(editField);
  };

  const handleRemoveField = () => {
    setRemoveConfirmOpen(true);
  };

  const handleConfirmRemove = () => {
    setRemoveConfirmOpen(false);
    if (onRemove && sectionIdx !== undefined && fieldIdx !== undefined) {
      onRemove(sectionIdx, fieldIdx);
    }
  };

  const handleCancelRemove = () => {
    setRemoveConfirmOpen(false);
  };

  // Helper: Convert rule to show_if format (same as FormEditor)
  const ruleToShowIf = (rule) => {
    if (rule.rule_type === 'member of') {
      return {
        rule_name: rule.rule_name,
        memberOf: rule.selected_groups || []
      };
    }
    if (rule.rule_type === 'data dependent') {
      return {
        rule_name: rule.rule_name,
        data: rule.selected_field ? `field.${rule.selected_field}` : rule.selected_field,
        values: rule.rule_values || []
      };
    }
    return {};
  };

  const handleOpenRuleEditor = (ruleType = 'show_if') => {
    // Create a new data-dependent rule
    const newRule = {
      rule_id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      rule_type: 'data dependent',
      rule_name: 'New Data Dependent Rule',
      selected_field: '',
      rule_values: [],
      _targetRule: ruleType  // Track which rule type to save to
    };
    setRuleEditorRule(newRule);
    setRuleEditorOpen(true);
  };

  const handleSaveRuleEditor = () => {
    if (ruleEditorRule && onAddRule) {
      const ruleType = ruleEditorRule._targetRule || 'show_if';
      const convertedRule = ruleToShowIf(ruleEditorRule);  // Same conversion logic works for both

      // Update local state first so the rule is immediately visible
      setEditField(prev => ({
        ...prev,
        [ruleType]: convertedRule
      }));
      // Then notify parent
      handleChange(ruleType, convertedRule);
      setRuleEditorOpen(false);
      setRuleEditorRule(null);
    }
  };

  const handleCancelRuleEditor = () => {
    setRuleEditorOpen(false);
    setRuleEditorRule(null);
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={onCancel}
        classes={{
          paper: classes.paperPallette
        }}
        PaperProps={{
          style: {
            width: '100%',
            maxWidth: '100%',
            minWidth: 300,
            borderRadius: ('25px 25px 25px 25px'),
          },
        }}
        style={{
          borderRadius: ('25px 25px 25px 25px'),
          padding: 20,
        }}
      >
        <Box style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <Box style={{ padding: '20px 24px 0', borderBottom: '1px solid #eee' }}>
            <Typography variant="h6" gutterBottom>Edit Field Properties</Typography>
          </Box>
          <DialogContent style={{ flex: 1, overflowY: 'auto', paddingTop: '16px' }}>
            <Box display="flex" flexDirection="column" gap={2}>
              <TextField
                label="Field Name"
                value={fieldNameDisplay}
                onChange={e => setFieldNameDisplay(e.target.value)}
                onBlur={(e) => {
                  const val = e.target.value;
                  // Save as all lowercase, spaces replaced with _
                  const formatted = val.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                  handleChange('field_name', formatted);
                  // Update display to title case with exception for small words
                  const cleaned = formatted.replace(/_/g, ' ');
                  const smallWords = ['of', 'and', 'or', 'a', 'an', 'the', 'in', 'on', 'at', 'to', 'for', 'with', 'from', 'by'];
                  const words = cleaned.split(' ');
                  const titleCased = words.map((w, idx) => {
                    // Always capitalize first word, otherwise check if it's a small word
                    if (idx === 0 || !smallWords.includes(w.toLowerCase())) {
                      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
                    }
                    return w.toLowerCase();
                  }).join(' ');
                  setFieldNameDisplay(titleCased);
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.target.blur();
                  }
                }}
                fullWidth
              />
              <Box
                display="flex"
                flexDirection="column"
                gap={2}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '25px',
                  padding: '16px',
                  marginTop: '16px',
                  marginBottom: '8px',
                  marginRight: '8px',
                }}
              >
                <Typography variant="subtitle1">Prompt</Typography>
                <Box style={{ marginTop: '-30px', marginBottom: '20px' }}>
                  <RichTextEditor
                    ref={quillRef}
                    value={editField.prompt || ''}
                    onChange={(value) => handleChange('prompt', value)}
                    placeholder="Enter prompt text (supports HTML formatting)"
                  />
                </Box>
              </Box>
              {/* Value Box */}
              <Box
                display="flex"
                flexDirection="column"
                gap={2}
                style={{
                  border: '1px solid #ccc',
                  borderRadius: '25px',
                  padding: '16px',
                  marginTop: '8px',
                  marginBottom: '8px',
                  marginRight: '8px',
                }}
              >
                <Typography variant="subtitle1">Value</Typography>
                <FormControl style={{ width: '200px', marginTop: '8px' }}>
                  <InputLabel id="field-type-label">Type</InputLabel>
                  <Select
                    labelId="field-type-label"
                    value={editField.value.type || ''}
                    onChange={e => handleChange('value.type', e.target.value)}
                  >
                    <MenuItem value="header">Header</MenuItem>
                    <MenuItem value="text">Text</MenuItem>
                    <MenuItem value="date">Date</MenuItem>
                    <MenuItem value="phone">Phone</MenuItem>
                    <MenuItem value="yes/no">Yes/No</MenuItem>
                    <MenuItem value="family">Family Member List</MenuItem>
                    <MenuItem value="select">Selection</MenuItem>
                    <MenuItem value="signature">Signature</MenuItem>
                    <MenuItem value="initials">Initials</MenuItem>
                  </Select>
                </FormControl>
                {(editField.value.type === 'text' || editField.value.type === 'date') && (
                  <>
                    {editField.value.type === 'text' && (
                      <FormControl style={{ width: '200px', marginTop: '8px' }}>
                        <InputLabel>Input Size</InputLabel>
                        <Select
                          value={(() => {
                            const rows = editField.value?.rows || 1;
                            const width = editField.value?.width || 500;
                            if (rows > 2) return 'box';
                            if (width <= 200) return 'short';
                            if (width <= 400) return 'medium';
                            return 'long';
                          })()}
                          onChange={(e) => {
                            const size = e.target.value;
                            let newRows = 1;
                            let newWidth = 500;
                            switch (size) {
                              case 'short':
                                newRows = 1;
                                newWidth = 200;
                                break;
                              case 'medium':
                                newRows = 1;
                                newWidth = 400;
                                break;
                              case 'long':
                                newRows = 1;
                                newWidth = 600;
                                break;
                              case 'box':
                                newRows = 4;
                                newWidth = 600;
                                break;
                              default:
                                newRows = 1;
                                newWidth = 400;
                                break;
                            }
                            setEditField(prev => ({
                              ...prev,
                              value: {
                                ...prev.value,
                                rows: newRows,
                                width: newWidth
                              }
                            }));
                          }}
                        >
                          <MenuItem value="short">Short</MenuItem>
                          <MenuItem value="medium">Medium</MenuItem>
                          <MenuItem value="long">Long</MenuItem>
                          <MenuItem value="box">Box</MenuItem>
                        </Select>
                      </FormControl>
                    )}
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={!!(editField.value?.occurrences && editField.value.occurrences > 1)}
                          onChange={e => {
                            if (e.target.checked) {
                              handleChange('value.occurrences', 2);
                            } else {
                              handleChange('value.occurrences', 1);
                            }
                          }}
                          color="primary"
                        />
                      }
                      label="Capture multiple responses?"
                      style={{ marginTop: 8 }}
                    />
                    {(editField.value?.occurrences && editField.value.occurrences > 1) && (
                      <TextField
                        label="Number of responses to capture"
                        type="number"
                        value={editField.value?.occurrences || 2}
                        onChange={e => handleChange('value.occurrences', Number(e.target.value))}
                        size="small"
                        style={{ width: '200px', marginTop: '8px' }}
                        inputProps={{ min: 2 }}
                        InputLabelProps={{ style: { whiteSpace: 'nowrap' } }}
                      />
                    )}
                  </>
                )}
                {editField.value.type === 'select' && (
                  <>
                    <Box mt={2}>
                      <Typography variant="subtitle2">Valid selections</Typography>
                      {(editField.value?.selection?.selectionList || []).map((option, idx) => (
                        <Box key={idx} display="flex" alignItems="center" mb={1}>
                          <TextField
                            value={option}
                            onChange={e => {
                              const newOptions = [...(editField.value?.selection?.selectionList || [])];
                              newOptions[idx] = e.target.value;
                              handleChange('value.selection.selectionList', newOptions);
                            }}
                            style={{ marginRight: 8, width: '500px' }}
                            size="small"
                          />
                          <IconButton
                            onClick={() => {
                              const newOptions = [...(editField.value?.selection?.selectionList || [])];
                              newOptions.splice(idx, 1);
                              handleChange('value.selection.selectionList', newOptions);
                            }}
                            size="small"
                            aria-label="Remove"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      ))}
                      <Button
                        onClick={() => {
                          const newOptions = [...(editField.value?.selection?.selectionList || []), ''];
                          handleChange('value.selection.selectionList', newOptions);
                        }}
                        size="small"
                        variant="outlined"
                      >Add Selection</Button>
                    </Box>
                    <Box mt={2}>
                      <TextField
                        label="Maximum number of selections allowed"
                        type="number"
                        value={editField.value?.selection?.max || 1}
                        onChange={e => handleChange('value.selection.max', Number(e.target.value))}
                        size="small"
                        style={{ width: '200px' }}
                        InputLabelProps={{ style: { whiteSpace: 'nowrap' } }}
                      />
                    </Box>
                    <Box mt={2}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={!!editField.value.custom_selection}
                            onChange={e => handleChange('value.custom_selection', e.target.checked)}
                            color="primary"
                          />
                        }
                        label="Include space for a user custom value?"
                      />
                    </Box>
                  </>
                )}
                {editField.value.type && editField.value.type !== 'header' && (
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={!!editField.required}
                        onChange={e => handleChange('required', e.target.checked)}
                        color="primary"
                      />
                    }
                    label="Required"
                    style={{ marginTop: 16 }}
                  />
                )}
                {editField.value.type && editField.value.type !== 'header' && editField.value.type !== 'signature' && editField.value.type !== 'initials' && (
                  <>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={editField.value?.saveAs !== undefined && editField.value?.saveAs !== null}
                          onChange={e => {
                            if (e.target.checked) {
                              const base = `peopleRec.form_data.${editField.field_name || ''}`;
                              handleChange('value.saveAs', base);
                            } else {
                              handleChange('value.saveAs', '*delete*');
                              handleChange('default.source', '*delete*');
                            }
                          }}
                          color="primary"
                        />
                      }
                      label="Store the most recent response in the database?"
                      style={{ marginTop: 16 }}
                    />
                    {editField.value?.saveAs !== undefined && editField.value?.saveAs !== null && (
                      <TextField
                        label="Tech info"
                        value={(editField.value?.saveAs || '').replace(/^(peopleRec\.|personRec\.)/, '')}
                        onChange={e => handleChange('value.saveAs', `peopleRec.${e.target.value}`)}
                        size="small"
                        style={{ width: '300px', marginTop: '8px', marginLeft: '16px' }}
                      />
                    )}
                  </>
                )}
              </Box>
              {/* Show If / Visibility Rule Section */}
              {editField.value.type && editField.value.type !== 'header' && (
                <Box
                  display="flex"
                  flexDirection="column"
                  gap={2}
                  style={{
                    border: '1px solid #ccc',
                    borderRadius: '25px',
                    padding: '16px',
                    marginTop: '16px',
                    marginBottom: '8px',
                    marginRight: '8px',
                  }}
                >
                  <Typography variant="subtitle1">Rules</Typography>
                  <Box display="flex" flexDirection="row" gap={2} marginLeft={2} marginBottom={2} alignItems="center">
                    <Box flexDirection='column' key={`Box__check`} className={classes.formControlCheckGroup}>
                      <Box
                        display='flex'
                        flexDirection={'row'}
                        alignItems='flex-start'
                        flexWrap={'wrap'}
                        key={`CheckGroup`}
                      >
                        <React.Fragment
                          key={`groupFrag`}
                        >
                          {['None', 'Show if', 'Ignore if'].map((text, tIndex) => (
                            <FormControlLabel
                              className={classes.formControlDays}
                              key={`rule_pick_${tIndex}`}
                              control={
                                <Checkbox
                                  aria-label={`rule_pick_${tIndex}`}
                                  name={`rule_pick_${tIndex}`}
                                  key={`CheckGroup__rule_pick_${tIndex}`}
                                  size='small'
                                  checked={editField.show_if ? (text === 'Show if') : (editField.ignore_if ? (text === 'Ignore if') : (text === 'None'))}
                                  onClick={() => {
                                    if (text === 'None') {
                                      handleChange('show_if', '*delete*');
                                      handleChange('ignore_if', '*delete*');
                                    } else if (text === 'Show if' && !editField.show_if) {
                                      handleOpenRuleEditor('show_if');
                                    } else if (text === 'Ignore if' && !editField.ignore_if) {
                                      handleOpenRuleEditor('ignore_if');
                                    }
                                  }}
                                  disableRipple
                                  inputProps={{ 'aria-labelledby': `message_routing_3` }}
                                />
                              }
                              label={<Typography className={classes.radioDays} style={{ whiteSpace: 'nowrap' }}>{text}</Typography>}
                              labelPlacement='end'
                            />
                          ))}
                        </React.Fragment>
                      </Box>
                    </Box>
                  </Box>
                  {editField.show_if &&
                    <Box>
                      <Typography variant="subtitle1">Only show this field if:</Typography>
                      <Box display="flex" flexDirection="column" gap={1} marginLeft={2}>
                        {editField.show_if.data && (
                          <Typography variant="body2"
                            dangerouslySetInnerHTML={{
                              __html:
                                (() => {
                                  const fieldName = editField.show_if.data.startsWith('field.') ? editField.show_if.data.replace('field.', '') : editField.show_if.data;
                                  const referencedField = fieldsMap[fieldName];
                                  const displayName = referencedField?.prompt || fieldName;
                                  return `${displayName}`;
                                })()
                            }}
                          />
                        )}
                      </Box>
                      <Typography variant="subtitle1">is</Typography>
                      {editField.show_if.values && editField.show_if.values.length > 0 && (
                        <Box display="flex" flexDirection="column" gap={1} marginLeft={2}>
                          <Typography variant="body2">
                            {listFromArray(editField.show_if.values, { "or": true })}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  }
                  {editField.ignore_if &&
                    <Box>
                      <Typography variant="subtitle1">Ignore this field if:</Typography>
                      <Box display="flex" flexDirection="column" gap={1} marginLeft={2}>
                        {editField.ignore_if.data && (
                          <Typography variant="body2"
                            dangerouslySetInnerHTML={{
                              __html:
                                (() => {
                                  const fieldName = editField.ignore_if.data.startsWith('field.') ? editField.ignore_if.data.replace('field.', '') : editField.ignore_if.data;
                                  const referencedField = fieldsMap[fieldName];
                                  const displayName = referencedField?.prompt || fieldName;
                                  return `${displayName}`;
                                })()
                            }}
                          />
                        )}
                      </Box>
                      <Typography variant="subtitle1">is</Typography>
                      {editField.ignore_if.values && editField.ignore_if.values.length > 0 && (
                        <Box display="flex" flexDirection="column" gap={1} marginLeft={2}>
                          <Typography variant="body2">
                            {listFromArray(editField.ignore_if.values, { "or": true })}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  }
                  {(editField.show_if || editField.ignore_if) &&
                    <Button
                      onClick={() =>
                        handleChange(editField.show_if ? 'show_if' : 'ignore_if', '*delete*')
                      }
                      size="small"
                      variant="outlined"
                      color="error"
                      style={{ marginTop: '8px', alignSelf: 'flex-start' }}
                    >
                      Remove this Rule
                    </Button>
                  }
                </Box>
              )}

            </Box>
          </DialogContent>
          <Box
            overflow='auto'
            display='flex'
            flexDirection='row'
            alignItems={'center'}
            justifyContent={'center'}
            className={classes.buttonBar}
            style={{ borderTop: '1px solid #eee', flexShrink: 0 }}
          >

            <Box display="flex" gap={1}>
              <Button onClick={onCancel} style={{ backgroundColor: "red", color: "white" }} className={classes.button}>Cancel</Button>
              {onRemove && <Button onClick={handleRemoveField} style={{ backgroundColor: "#ff9800", color: "white" }} className={classes.button}>Remove Field</Button>}
            </Box>
            <Button onClick={handleSave} style={{ backgroundColor: "green", color: "white" }} variant="contained" className={classes.button}>Save</Button>
          </Box>
        </Box >
      </Dialog >
      {/* Rule Editor Dialog */};
      {
        ruleEditorOpen && ruleEditorRule && (
          <Dialog
            open={true}
            onClose={handleCancelRuleEditor}
            maxWidth="sm"
            fullWidth
            PaperProps={{
              style: {
                borderRadius: '25px',
              }
            }}
          >
            <Box display="flex" flexDirection="column" style={{ minHeight: 400 }}>
              <Box p={2} style={{ borderBottom: '1px solid #eee' }}>
                <Typography variant="h6" gutterBottom>
                  Configure Data Dependent Rule
                </Typography>
                <TextField
                  label="Rule Name"
                  defaultValue={ruleEditorRule.rule_name || ''}
                  onBlur={(e) => setRuleEditorRule(prev => ({ ...prev, rule_name: e?.target?.value || '' }))}
                  fullWidth
                  size="small"
                />
              </Box>
              <Box p={2} style={{ overflowY: 'auto', flex: 1, borderBottom: '1px solid #eee' }}>
                <Typography variant="subtitle2" style={{ marginBottom: 8, fontWeight: 600 }}>
                  Select Field
                </Typography>
                <TextField
                  select
                  value={ruleEditorRule.selected_field || ''}
                  onChange={(e) => setRuleEditorRule(prev => ({ ...prev, selected_field: e.target.value }))}
                  fullWidth
                  size="small"
                  style={{ marginBottom: 16 }}
                >
                  {ruleEditorCommonFields && ruleEditorCommonFields.length > 0 ? (
                    [...ruleEditorCommonFields].sort((a, b) => {
                      const aName = a.field_name || a.field_id;
                      const bName = b.field_name || b.field_id;
                      return aName.localeCompare(bName);
                    }).map((field) => (
                      <MenuItem key={field.field_id} value={field.field_id}>
                        {titleCase(field.field_name || field.field_id)}
                      </MenuItem>
                    ))
                  ) : (
                    <MenuItem disabled>No fields available</MenuItem>
                  )}
                </TextField>

                <Typography variant="subtitle2" style={{ marginBottom: 8, fontWeight: 600 }}>
                  Enter Values (one per line)
                </Typography>
                <TextField
                  multiline
                  minRows={4}
                  variant="outlined"
                  defaultValue={(ruleEditorRule.rule_values || []).join('\n')}
                  onBlur={(e) => {
                    const lines = e.target.value.split('\n').map(line => line.trim()).filter(line => line);
                    setRuleEditorRule(prev => ({ ...prev, rule_values: lines }));
                  }}
                  fullWidth
                  placeholder="Enter each value on a new line"
                  size="small"
                />
              </Box>
              <Box p={2} display="flex" justifyContent="space-between" style={{ borderTop: '1px solid #eee' }}>
                <Button variant="outlined" onClick={handleCancelRuleEditor}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveRuleEditor}
                >
                  Save Rule
                </Button>
              </Box>
            </Box>
          </Dialog>
        )
      }
      {/* Remove Field Confirmation Dialog */}
      {
        removeConfirmOpen && (
          <Dialog
            open={true}
            onClose={handleCancelRemove}
            maxWidth="sm"
            fullWidth
            PaperProps={{
              style: {
                borderRadius: '25px',
              }
            }}
          >
            <Box display="flex" flexDirection="column">
              <Box p={2} style={{ borderBottom: '1px solid #eee' }}>
                <Typography variant="h6">Remove Field</Typography>
              </Box>
              <Box p={2}>
                <Typography variant="body1">
                  Are you sure you want to remove this field from the section?
                </Typography>
              </Box>
              <Box p={2} display="flex" justifyContent="space-between" style={{ borderTop: '1px solid #eee' }}>
                <Button variant="outlined" onClick={handleCancelRemove}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  style={{ backgroundColor: '#f44336', color: 'white' }}
                  onClick={handleConfirmRemove}
                >
                  Remove Field
                </Button>
              </Box>
            </Box>
          </Dialog>
        )
      }
    </>
  );
};

export default FieldEditor;
