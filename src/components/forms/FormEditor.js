import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import makeStyles from '@material-ui/core/styles/makeStyles';

import {
  Box,
  Typography,
  TextField,
  Checkbox,
  FormControlLabel,
  Button,
  IconButton,
  Paper,
  Dialog
} from '@material-ui/core';
import { Add, Delete, Visibility, ExpandLess, ExpandMore } from '@material-ui/icons';
import { getDb, dbClient, recordExists, deepCopy } from '../../util/AVAUtilities';
import AVAConfirm from './AVAConfirm';
import { AVATextStyle } from '../../util/AVAStyles';
import FormFillB from '../forms/FormFillB';
import FieldEditor from './FieldEditor';

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


// Main Form Editor Component
const FormEditor = ({ form, onSave, onCancel }) => {
  // Unified drag handler for sections and fields
  const handleDragEnd = result => {
    const { destination, source, type } = result;
    if (!destination) return;
    if (type === 'section') {
      if (destination.index === source.index) return;
      const newSections = Array.from(editForm.sections);
      const [removed] = newSections.splice(source.index, 1);
      newSections.splice(destination.index, 0, removed);
      setEditForm(prev => ({ ...prev, sections: newSections }));
      return;
    }
    if (type === 'field') {
      const sourceId = source.droppableId;
      const destId = destination.droppableId;
      const newSections = Array.from(editForm.sections);
      const staging = Array.from(editForm.stagingFields || []);
      const getList = (id) => {
        if (id === 'staging-fields') return staging;
        if (id.startsWith('section-fields-')) {
          const idx = parseInt(id.replace('section-fields-', ''), 10);
          return Array.from(newSections[idx].fields);
        }
        return [];
      };
      const setList = (id, list) => {
        if (id === 'staging-fields') {
          staging.splice(0, staging.length, ...list);
        } else if (id.startsWith('section-fields-')) {
          const idx = parseInt(id.replace('section-fields-', ''), 10);
          newSections[idx] = { ...newSections[idx], fields: list };
        }
      };

      // Same list - reorder within same section
      if (sourceId === destId) {
        const list = getList(sourceId);
        const [moved] = list.splice(source.index, 1);
        list.splice(destination.index, 0, moved);
        setList(sourceId, list);
      } else {
        // Different lists - move between sections
        const sourceList = getList(sourceId);
        const destList = getList(destId);
        const [moved] = sourceList.splice(source.index, 1);
        destList.splice(destination.index, 0, moved);
        setList(sourceId, sourceList);
        setList(destId, destList);
      }
      setEditForm(prev => ({ ...prev, sections: newSections, stagingFields: staging }));
    }
  };
  const classes = useStyles();

  // Prepare Form for editing (async) - flatten prompt and ensure new schema defaults
  const prepareFormForEditing = async (form) => {
    const clonedForm = JSON.parse(JSON.stringify(form));
    if (!clonedForm.sections) clonedForm.sections = [];
    for (let section of clonedForm.sections) {
      if (!section.fields) section.fields = [];
      for (let i = 0; i < section.fields.length; i++) {
        let field = section.fields[i];
        if (typeof field === 'string') {
          // Field is a string reference - need to look it up
          let fieldData = null;

          // First check the form's local fields object
          if (clonedForm.fields && clonedForm.fields[field]) {
            fieldData = Object.assign({ field_name: field }, clonedForm.fields[field]);
          }
          // Then check Common_Fields table
          else {
            let commonFieldRec = await getDb({
              TableName: 'Common_Fields',
              Key: {
                client_id: clonedForm.client_id,
                field_id: field
              }
            });
            if (commonFieldRec) {
              fieldData = Object.assign({}, commonFieldRec);
            }
          }

          // Legacy fallback: check Form_Fields table
          if (!fieldData) {
            let fieldRec = await getDb({
              TableName: 'Form_Fields',
              Key: {
                client_id: clonedForm.client_id,
                field_id: field
              }
            });
            if (fieldRec) {
              fieldData = Object.assign({}, fieldRec);
            }
          }

          // If still not found, remove from section
          if (!fieldData) {
            section.fields.splice(i, 1);
            i--;
            continue;
          }

          section.fields[i] = fieldData;
        } else if (field.form_field) {
          // Legacy reference structure
          let fieldRec = await getDb({
            TableName: 'Form_Fields',
            Key: {
              client_id: clonedForm.client_id,
              field_name: field.form_field
            }
          });
          if (fieldRec) {
            section.fields[i] = Object.assign({}, fieldRec, field);
          }
        }
        let f = section.fields[i];
        // For legacy fields: use raw field_name as stable field_id, then normalize field_name
        if (!f.field_id && f.field_name) {
          const rawName = f.field_name;
          f.field_id = rawName; // preserve original identifier
          f.field_name = rawName.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_');
        }
        if (!f.prompt) {
          f.prompt = f.field_name || '';
        } else if (typeof f.prompt === 'object' && f.prompt !== null && 'value' in f.prompt) {
          f.prompt = f.prompt.value;
        }
        if (!f.value || typeof f.value !== 'object') f.value = {};
        if (!f.value.selection) f.value.selection = { selectionList: [], max: 1 };
        if (f.value.rows == null) f.value.rows = f.prompt?.rows || 1;
        if (f.value.width == null) f.value.width = f.prompt?.width || 500;
        if (f.value.occurrences == null) f.value.occurrences = 1;
        if (!f.value.type) f.value.type = f.prompt?.type || 'text';
      }
    }
    if (!clonedForm.stagingFields) clonedForm.stagingFields = [];
    return clonedForm;
  };

  const [editForm, setEditForm] = useState(() => ({ ...form }));
  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      const prepared = await prepareFormForEditing(form);
      if (isMounted) setEditForm(prepared);
    })();
    return () => { isMounted = false; };
  }, [form]);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, action: null });

  const [reactData, setReactData] = React.useState({
    //        administrative_account: (['admin', 'support', 'master'].includes(state.user.account_class)),
    selectedSectionIdx: null,
    addFieldDialogOpen: false,
    commonFields: [],
    commonFieldsFilter: ''
  });
  const [refreshTrigger, setRefreshTrigger] = React.useState(false);
  const updateReactData = (newData, force = false) => {
    setReactData((prevValues) => (Object.assign(
      prevValues,
      newData
    )));
    if (force) { setRefreshTrigger(refreshTrigger => !refreshTrigger); console.log(refreshTrigger); }
  };


  // Edit form-level fields
  const handleFormFieldChange = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  // Add new section
  const handleAddSection = () => {
    const newSections = [
      ...editForm.sections,
      { section_name: 'New Section', fields: [] }
    ];
    setEditForm(prev => ({ ...prev, sections: newSections }));
  };

  // Generate unique field name
  const generateUniqueFieldName = (base = 'new_field') => {
    const existing = new Set();
    editForm.sections.forEach(sec => (sec.fields || []).forEach(f => existing.add(typeof f === 'string' ? f : f.field_name)));
    (editForm.stagingFields || []).forEach(f => existing.add(f.field_name));
    if (!existing.has(base)) return base;
    let i = 1;
    while (existing.has(`${base}_${i}`)) i++;
    return `${base}_${i}`;
  };

  // Generate unique field_id (stable identifier)
  const generateUniqueFieldId = () => {
    return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Add new field to staging and open editor
  const handleAddField = async () => {
    // Fetch Common_Fields by client_id and prompt user to choose or create new
    const resp = await dbClient
      .query({
        TableName: 'Common_Fields',
        KeyConditionExpression: 'client_id = :c',
        ExpressionAttributeValues: { ':c': editForm.client_id }
      })
      .promise()
      .catch(() => null);
    const list = resp && recordExists(resp) ? (resp.Items || []) : [];
    updateReactData({ commonFields: list, addFieldDialogOpen: true }, true);
  };

  const createNewField = () => {
    const field_id = generateUniqueFieldId();
    const field_name = generateUniqueFieldName();
    const newField = {
      field_id,
      field_name,
      prompt: '',
      value: { type: 'text', rows: 1, width: 400, occurrences: 1, selection: { selectionList: [], max: 1 } },
      required: false,
      isNew: true
    };
    setEditForm(prev => ({ ...prev, stagingFields: [...(prev.stagingFields || []), newField] }));
    setFieldEditorField(newField);
    setFieldEditorOpen(true);
    updateReactData({ addFieldDialogOpen: false }, true);
  };

  const chooseCommonField = (common) => {
    // Use common field record; ensure field_id stable, clean field_name, and defaults
    const rawName = common.field_name || common.field_id || generateUniqueFieldName();
    const field_name = rawName.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '_');
    const field_id = common.field_id || rawName;
    // Handle legacy select&text type
    const fieldType = (common.value && common.value.type) || 'text';
    const isLegacySelectText = fieldType === 'select&text';
    const newField = {
      field_id,
      field_name,
      prompt: common.prompt && typeof common.prompt === 'string' ? common.prompt : (common.prompt?.value || ''),
      value: {
        ...(common.value || {}),
        type: isLegacySelectText ? 'select' : fieldType,
        custom_selection: isLegacySelectText ? true : (common.value?.custom_selection || false),
        selection: common.value?.selection || { selectionList: [], max: 1 },
        rows: common.value?.rows != null ? common.value.rows : 1,
        width: common.value?.width != null ? common.value.width : 400,
        occurrences: common.value?.occurrences != null ? common.value.occurrences : 1
      },
      required: !!common.required,
      isNew: true
    };
    setEditForm(prev => ({ ...prev, stagingFields: [...(prev.stagingFields || []), newField] }));
    setFieldEditorField(newField);
    setFieldEditorOpen(true);
    updateReactData({ addFieldDialogOpen: false }, true);
  };

  // Edit section name
  const handleSectionNameChange = (idx, value) => {
    const newSections = editForm.sections.map((section, i) =>
      i === idx ? { ...section, section_name: value } : section
    );
    setEditForm(prev => ({ ...prev, sections: newSections }));
  };

  // Remove section
  const handleRemoveSection = idx => {
    setConfirmDialog({
      open: true, action: () => {
        const newSections = editForm.sections.filter((_, i) => i !== idx);
        setEditForm(prev => ({ ...prev, sections: newSections }));
        updateReactData({ selectedSectionIdx: null }, true);
        setConfirmDialog({ open: false, action: null });
      }
    });
  };

  // Save changes (exclude stagingFields, process Common_Fields, build fields object)
  const handleSave = async () => {
    if (!onSave) return;

    const { stagingFields, ...formToSave } = editForm;

    // Step 1: Collect all fields from all sections
    const allFields = [];
    for (const section of formToSave.sections) {
      for (const field of section.fields) {
        if (typeof field !== 'string') {
          allFields.push(field);
        }
      }
    }

    // Step 2: Process fields - save to Common_Fields or local fields object
    const fieldsObject = {}; // Will hold fields WITHOUT saveAs
    const commonFieldsToSave = []; // Will hold fields WITH saveAs

    for (const field of allFields) {
      if (field.value?.saveAs) {
        // This field should be saved to Common_Fields table
        commonFieldsToSave.push({
          client_id: formToSave.client_id,
          field_id: field.field_id,
          field_name: field.field_name,
          prompt: field.prompt,
          value: field.value,
          required: field.required
        });
      } else {
        // This field should be stored in the form's fields object
        fieldsObject[field.field_id] = {
          field_id: field.field_id,
          field_name: field.field_name,
          prompt: field.prompt,
          value: field.value,
          required: field.required
        };
      }
    }

    // Step 3: Save all common fields to Common_Fields table
    for (const commonField of commonFieldsToSave) {
      try {
        await dbClient.put({
          TableName: 'Common_Fields',
          Item: commonField
        }).promise();
      } catch (error) {
        console.error('Error saving to Common_Fields:', error);
      }
    }

    // Step 4: Update sections to reference fields by field_id only
    const sectionsToSave = formToSave.sections.map(section => ({
      ...section,
      fields: section.fields.map(field =>
        typeof field === 'string' ? field : field.field_id
      )
    }));

    // Step 5: Prepare final form object for Forms table
    const finalForm = {
      ...formToSave,
      sections: sectionsToSave,
      fields: fieldsObject // Only contains fields without saveAs
    };

    onSave(finalForm);
  };

  // Cancel editing
  const handleCancel = () => {
    if (onCancel) onCancel();
  };

  // Field editor handlers
  const [fieldEditorOpen, setFieldEditorOpen] = React.useState(false);
  const [fieldEditorField, setFieldEditorField] = React.useState(null);

  const handleOpenFieldEditor = (sectionIdx, fieldIdx) => {
    const section = editForm.sections[sectionIdx];
    const field = section.fields[fieldIdx];
    // Handle legacy select&text type
    const fieldType = field.value?.type || 'text';
    const isLegacySelectText = fieldType === 'select&text';
    if (isLegacySelectText) {
      const updatedField = {
        ...field,
        value: {
          ...field.value,
          type: 'select',
          custom_selection: true
        }
      };
      setFieldEditorField(updatedField);
    } else {
      setFieldEditorField(field);
    }
    setFieldEditorOpen(true);
  };

  const handleSaveFieldEditor = async (updatedField) => {
    // Clean up any *delete* markers
    const cleanedField = { ...updatedField };
    if (cleanedField.value?.saveAs === '*delete*') {
      delete cleanedField.value.saveAs;
    }
    if (cleanedField.default?.source === '*delete*') {
      delete cleanedField.default;
    }

    // If field has saveAs, save/update to Common_Fields table immediately
    if (cleanedField.value?.saveAs) {
      try {
        await dbClient.put({
          TableName: 'Common_Fields',
          Item: {
            client_id: editForm.client_id,
            field_id: cleanedField.field_id,
            field_name: cleanedField.field_name,
            prompt: cleanedField.prompt,
            value: cleanedField.value,
            required: cleanedField.required
          }
        }).promise();
      } catch (error) {
        console.error('Error saving field to Common_Fields:', error);
      }
    }

    setEditForm(prev => {
      const newSections = prev.sections.map(section => {
        if (section.fields.find(f => (typeof f === 'string' ? f === cleanedField.field_id : f.field_id === cleanedField.field_id))) {
          return {
            ...section,
            fields: section.fields.map(f => (typeof f === 'string' ? (f === cleanedField.field_id ? cleanedField : f) : (f.field_id === cleanedField.field_id ? cleanedField : f)))
          };
        }
        return section;
      });
      const stagingFields = (prev.stagingFields || []).map(f => f.field_id === cleanedField.field_id ? { ...cleanedField, isNew: false } : f);
      return { ...prev, sections: newSections, stagingFields };
    });
    setFieldEditorOpen(false);
  };

  const handleCancelFieldEditor = () => {
    if (fieldEditorField && fieldEditorField.isNew) {
      setEditForm(prev => ({
        ...prev,
        stagingFields: (prev.stagingFields || []).filter(f => f.field_id !== fieldEditorField.field_id)
      }));
    }
    setFieldEditorOpen(false);
  };

  return (
    <Paper className={classes.root} elevation={0}>
      <Box className={classes.header}>
        <Box display="flex" alignItems="center"
          justifyContent={'space-between'}>
          <Typography variant="h5" style={{ fontWeight: 700 }}>Edit Form</Typography>
          <Visibility
            key={`view-button`}
            onClick={() => {
              updateReactData({
                isEditing: {
                  calledFrom: 'master',
                  person_id: editForm.client_id,
                  form_id: editForm.form_id,
                  document_id: 'new'
                }
              }, true);
            }}
            style={AVATextStyle({
              size: 1.5,
              margin: { right: 0.5 },
            })}
            size='small'
          />
        </Box>
        <Box mt={2} display="flex" gap={2}>
          <TextField
            label="Form Name"
            value={editForm.form_name}
            onChange={e => handleFormFieldChange('form_name', e.target.value)}
            fullWidth
          />
          <TextField
            label="Category"
            value={editForm.category}
            onChange={e => handleFormFieldChange('category', e.target.value)}
            fullWidth
            style={{ marginLeft: 16 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={!!editForm.active}
                onChange={e => handleFormFieldChange('active', e.target.checked)}
                color="primary"
              />
            }
            label="Active"
            style={{ marginLeft: 8 }}
          />
        </Box>
      </Box>
      {/* Add Field choice dialog */}
      {reactData.addFieldDialogOpen && (
        <Dialog
          open={true}
          onClose={() => updateReactData({ addFieldDialogOpen: false }, true)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            style: {
              borderRadius: '25px',
            }
          }}
        >
          <Box display="flex" flexDirection="column" style={{ minHeight: 300 }}>
            <Box p={2} style={{ borderBottom: '1px solid #eee' }}>
              <Typography variant="h6" gutterBottom>Use a common field?</Typography>
              <TextField
                label="Search common fields"
                value={reactData.commonFieldsFilter || ''}
                onChange={e => updateReactData({ commonFieldsFilter: e.target.value }, true)}
                fullWidth
              />
            </Box>
            <Box p={2} style={{ overflowY: 'auto', maxHeight: 360, flex: 1 }}>
              {reactData.commonFields && reactData.commonFields.length > 0 ? (
                <Box>
                  {(reactData.commonFields || [])
                    .filter(cf => {
                      const q = (reactData.commonFieldsFilter || '').trim().toLowerCase();
                      if (!q) return true;
                      const raw = (cf.field_name || cf.field_id || '').toLowerCase();
                      return raw.includes(q);
                    })
                    .map((cf, idx) => (
                      <Box
                        key={idx}
                        display="flex"
                        alignItems="center"
                        mb={1}
                        p={1.5}
                        style={{
                          cursor: 'pointer',
                          borderRadius: '8px',
                          border: '1px solid #e0e0e0',
                          transition: 'background-color 0.2s'
                        }}
                        onClick={() => chooseCommonField(cf)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <Typography>
                          {(() => {
                            const raw = cf.field_name || cf.field_id || '';
                            const words = raw.replace(/[_-]+/g, ' ').split(' ');
                            return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                          })()}
                        </Typography>
                      </Box>
                    ))}
                </Box>
              ) : (
                <Typography variant="body2" color="textSecondary">No common fields found for this client.</Typography>
              )}
            </Box>
            <Box p={2} display="flex" justifyContent="space-between" style={{ borderTop: '1px solid #eee' }}>
              <Button variant="outlined" onClick={() => updateReactData({ addFieldDialogOpen: false }, true)}>Cancel</Button>
              <Button variant="contained" color="primary" onClick={createNewField}>Create New Field</Button>
            </Box>
          </Box>
        </Dialog>
      )}
      <Typography variant="h6" style={{ marginLeft: 16, marginTop: 16, marginBottom: 2, fontWeight: 600 }}>Fields & Sections</Typography>
      <Box className={classes.sectionsArea}>
        <DragDropContext onDragEnd={handleDragEnd}>
          {(editForm.stagingFields && editForm.stagingFields.length > 0) && (
            <Droppable droppableId="staging-fields" type="field">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} style={{ marginBottom: 16 }}>
                  <Typography variant="subtitle2" style={{ marginLeft: 8, fontWeight: 600 }}>Unplaced Fields</Typography>
                  <ul style={{ margin: 0, paddingLeft: 24 }}>
                    {editForm.stagingFields.map((field, idx) => (
                      <Draggable key={field.field_id || field.field_name} draggableId={`field-${field.field_id || field.field_name}`} index={idx}>
                        {(dragProvided, dragSnapshot) => (
                          <li
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            style={{
                              ...dragProvided.draggableProps.style,
                              listStyleType: 'none',
                              fontSize: '0.95rem',
                              marginBottom: '6px',
                              opacity: dragSnapshot.isDragging ? 0.7 : 1,
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              setFieldEditorField(field);
                              setFieldEditorOpen(true);
                            }}
                          >
                            {(() => {
                              const raw = field.field_name;
                              if (!raw) return '';
                              const words = raw.replace(/[_-]+/g, ' ').split(' ');
                              return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                            })()}
                          </li>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </ul>
                </div>
              )}
            </Droppable>
          )}
          <Droppable droppableId="sections-droppable" type="section">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps}>
                {editForm.sections.map((section, idx) => (
                  <Draggable key={`section-${idx}`} draggableId={`section-${idx}`} index={idx}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        style={{
                          ...dragProvided.draggableProps.style,
                          marginBottom: 8,
                          opacity: dragSnapshot.isDragging ? 0.7 : 1,
                        }}
                      >
                        <Box>
                          <Box display="flex" marginLeft={2} alignItems="center">
                            {reactData[`editing_section_${idx}`] ? (
                              <TextField
                                value={section.section_name || ''}
                                onChange={(e) => handleSectionNameChange(idx, e.target.value)}
                                onBlur={() => updateReactData({ [`editing_section_${idx}`]: false }, true)}
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter') {
                                    updateReactData({ [`editing_section_${idx}`]: false }, true);
                                  }
                                }}
                                autoFocus
                                variant="standard"
                                style={{ flex: 1 }}
                              />
                            ) : (
                              <Typography
                                variant="subtitle1"
                                style={{ flex: 1, cursor: 'text' }}
                                onClick={() => updateReactData({ [`editing_section_${idx}`]: true }, true)}
                              >
                                {section.section_name || 'Untitled Section'}
                              </Typography>
                            )}
                            <IconButton onClick={() => handleRemoveSection(idx)}>
                              <Delete />
                            </IconButton>
                            <IconButton onClick={() => updateReactData({ [`collapse_${idx}`]: !reactData[`collapse_${idx}`] }, true)}>
                              {reactData[`collapse_${idx}`] ? <ExpandLess /> : <ExpandMore />}
                            </IconButton>
                          </Box>
                          {reactData[`collapse_${idx}`] && (
                            <Box ml={4} mt={1}>
                              <Droppable droppableId={`section-fields-${idx}`} type="field">
                                {(provided) => (
                                  <ul style={{ margin: 0, paddingLeft: 16, marginTop: -8 }} ref={provided.innerRef} {...provided.droppableProps}>
                                    {section.fields && section.fields.length > 0 ? (
                                      section.fields.map((field, fIdx) => {
                                        const fieldObj = typeof field === 'string' ? { field_id: field, field_name: field } : field;
                                        const fieldId = fieldObj.field_id || fieldObj.field_name;
                                        return (
                                          <Draggable key={fieldId} draggableId={`field-${fieldId}`} index={fIdx}>
                                            {(dragProvided, dragSnapshot) => (
                                              <li
                                                ref={dragProvided.innerRef}
                                                {...dragProvided.draggableProps}
                                                {...dragProvided.dragHandleProps}
                                                style={{
                                                  ...dragProvided.draggableProps.style,
                                                  listStyleType: 'none',
                                                  fontSize: '1rem',
                                                  marginBottom: '6px',
                                                  opacity: dragSnapshot.isDragging ? 0.7 : 1,
                                                  cursor: 'pointer',
                                                }}
                                                onClick={() => handleOpenFieldEditor(idx, fIdx)}
                                              >
                                                {(() => {
                                                  const raw = fieldObj.field_name;
                                                  if (!raw) return '';
                                                  const words = raw.replace(/[_-]+/g, ' ').split(' ');
                                                  return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                                                })()}
                                              </li>
                                            )}
                                          </Draggable>
                                        );
                                      })
                                    ) : (
                                      <Typography variant="body2" color="textSecondary" style={{ marginLeft: 8 }}>No fields</Typography>
                                    )}
                                    {provided.placeholder}
                                  </ul>
                                )}
                              </Droppable>
                            </Box>
                          )}
                        </Box>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </Box>
      {/* Field Editor dialog */}
      {fieldEditorOpen &&
        <FieldEditor
          field={fieldEditorField}
          open={fieldEditorOpen}
          onSave={(returnField) => handleSaveFieldEditor(returnField)}
          onCancel={handleCancelFieldEditor}
        />
      }
      <Box
        overflow='auto'
        display='flex'
        flexDirection='row'
        alignItems={'center'}
        justifyContent={'space-between'}
        className={classes.buttonBar}
      >
        <Box display="flex" alignItems="center">
          <Button
            startIcon={<Add />}
            onClick={handleAddSection}
            variant="contained"
            color="primary"
            className={classes.button}
          >
            Add Section
          </Button>
          <Button
            startIcon={<Add />}
            onClick={handleAddField}
            variant="contained"
            color="primary"
            className={classes.button}
            style={{ marginLeft: 12 }}
          >
            Add Field
          </Button>
        </Box>
        <Box>
          <Button onClick={handleCancel} style={{ backgroundColor: "red", color: "white" }} className={classes.button}>
            Cancel
          </Button>
          <Button onClick={handleSave} style={{ backgroundColor: "green", color: "white" }} variant="contained" className={classes.button}>
            Save
          </Button>
        </Box>
      </Box>
      {confirmDialog.open &&
        <AVAConfirm
          onConfirm={() => confirmDialog.action && confirmDialog.action()}
          onCancel={() => setConfirmDialog({ open: false, action: null })}
          promptText={["Confirm Delete", "Are you sure you want to delete this item?"]}
        />
      }
      {reactData.isEditing &&
        <FormFillB
          key={`doc_update_ffB`}
          request={{
            form_id: reactData.isEditing.form_id,
            person_id: reactData.isEditing.person_id,
            overrideFormRec: deepCopy(editForm),
            mode: 'new',
          }}
          onClose={async (ignore_me, statusObj) => {
            updateReactData({
              isEditing: false
            }, true);
          }}
        />
      }

    </Paper>
  );
};

export default FormEditor;
