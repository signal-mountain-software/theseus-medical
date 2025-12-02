import React, { useState, useRef } from 'react';
import makeStyles from '@material-ui/core/styles/makeStyles';
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


const FieldEditor = ({ field, open, onSave, onCancel }) => {
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

    return (
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
                            <Box style={{ marginTop: '-50px', marginBottom: '20px' }}>
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

                    <Button onClick={onCancel} style={{ backgroundColor: "red", color: "white" }} className={classes.button}>Cancel</Button>
                    <Button onClick={handleSave} style={{ backgroundColor: "green", color: "white" }} variant="contained" className={classes.button}>Save</Button>
                </Box>
            </Box >
        </Dialog >
    );
};

export default FieldEditor;
