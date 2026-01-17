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
import { Add, Delete, Visibility, ExpandLess, ExpandMore, VerifiedUser, Shuffle } from '@material-ui/icons';
import { getDb, dbClient, recordExists, deepCopy, uuid, titleCase } from '../../util/AVAUtilities';
import AVAConfirm from './AVAConfirm';
import { AVATextStyle } from '../../util/AVAStyles';
import FormFillB from '../forms/FormFillB';
import FieldEditor from './FieldEditor';
import useSession from '../../hooks/useSession';

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
  const { state } = useSession();
  // Drag handler for reordering fields within a section
  const handleDragEnd = result => {
    const { destination, source } = result;

    // Only handle field reordering
    if (!destination) return;
    if (destination.droppableId !== source.droppableId) return; // Only reorder within same section
    if (destination.index === source.index) return; // No change

    // Extract section index from droppableId (format: "section-fields-{idx}")
    const sectionIdx = parseInt(destination.droppableId.replace('section-fields-', ''), 10);

    const newSections = Array.from(editForm.sections);
    const [movedField] = newSections[sectionIdx].fields.splice(source.index, 1);
    newSections[sectionIdx].fields.splice(destination.index, 0, movedField);

    setEditForm(prev => ({ ...prev, sections: newSections }));
  };

  // Helper: Convert rule to show_if format
  const ruleToShowIf = (rule) => {
    if (rule.rule_type === 'member of') {
      return {
        rule_name: rule.rule_name,
        memberOf: rule.selected_groups || []
      };
    }
    if (rule.rule_type === 'data dependent') {
      // Format: data: "field.{fieldname}", values: [...]
      return {
        rule_name: rule.rule_name,
        data: rule.selected_field ? `field.${rule.selected_field}` : rule.selected_field,
        values: rule.rule_values || []
      };
    }
    return {};
  };

  // Helper: Convert show_if entry back to rule format
  const showIfToRule = (showIfEntry) => {
    if (showIfEntry.memberOf) {
      return {
        rule_id: `rule_${Date.now()}_${uuid(6)}`,
        rule_type: 'member of',
        rule_name: showIfEntry.rule_name || 'Member Of Rule',
        selected_groups: showIfEntry.memberOf
      };
    }
    if (showIfEntry.data && showIfEntry.values) {
      // Extract field name from "field.{fieldname}" format
      const fieldName = showIfEntry.data.startsWith('field.') ? showIfEntry.data.replace('field.', '') : showIfEntry.data;
      return {
        rule_id: `rule_${Date.now()}_${uuid(6)}`,
        rule_type: 'data dependent',
        rule_name: showIfEntry.rule_name || 'Data Dependent Rule',
        selected_field: fieldName,
        rule_values: showIfEntry.values
      };
    }
    return null;
  };

  const classes = useStyles();

  const [editForm, setEditForm] = useState(() => ({ ...form }));
  React.useEffect(() => {
    let isMounted = true;
    (async () => {
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
                    field_name: field
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
            if (f.required == null) f.required = f.value?.required || false;
          }
        }
        if (!clonedForm.stagingFields) clonedForm.stagingFields = [];
        if (!clonedForm.stagingRules) clonedForm.stagingRules = [];

        // Parse existing show_if from sections into rules attached to sections
        for (let section of clonedForm.sections) {
          if (section.show_if && Array.isArray(section.show_if)) {
            if (!section.rules) section.rules = [];
            for (let showIfEntry of section.show_if) {
              const rule = showIfToRule(showIfEntry);
              if (rule) {
                section.rules.push(rule);
              }
            }
          }
        }

        return clonedForm;
      };

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
    commonFieldsFilter: '',
    addRuleDialogOpen: false
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

  // Add new field to a specific section
  const handleAddFieldToSection = async (sectionIdx) => {
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
    updateReactData({ commonFields: list, addFieldDialogOpen: true, targetSectionIdx: sectionIdx }, true);
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

    if (reactData.targetSectionIdx !== null && reactData.targetSectionIdx !== undefined) {
      // Add directly to the target section
      const newSections = editForm.sections.map((section, idx) =>
        idx === reactData.targetSectionIdx
          ? { ...section, fields: [...section.fields, newField] }
          : section
      );
      setEditForm(prev => ({ ...prev, sections: newSections }));
    } else {
      // Add to staging (legacy behavior)
      setEditForm(prev => ({ ...prev, stagingFields: [...(prev.stagingFields || []), newField] }));
    }

    setFieldEditorField(newField);
    setFieldEditorOpen(true);
    updateReactData({ addFieldDialogOpen: false, targetSectionIdx: null }, true);
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

    if (reactData.targetSectionIdx !== null && reactData.targetSectionIdx !== undefined) {
      // Add directly to the target section
      const newSections = editForm.sections.map((section, idx) =>
        idx === reactData.targetSectionIdx
          ? { ...section, fields: [...section.fields, newField] }
          : section
      );
      setEditForm(prev => ({ ...prev, sections: newSections }));
    } else {
      // Add to staging (legacy behavior)
      setEditForm(prev => ({ ...prev, stagingFields: [...(prev.stagingFields || []), newField] }));
    }

    setFieldEditorField(newField);
    setFieldEditorOpen(true);
    updateReactData({ addFieldDialogOpen: false, targetSectionIdx: null }, true);
  };

  // Edit section name
  const handleSectionNameChange = (idx, value) => {
    const newSections = editForm.sections.map((section, i) =>
      i === idx ? { ...section, section_name: value } : section
    );
    setEditForm(prev => ({ ...prev, sections: newSections }));
  };

  // Generate unique rule ID
  const generateUniqueRuleId = () => {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Add new rule to staging
  const handleAddRule = (ruleType, sectionIdx = null) => {
    const rule_id = generateUniqueRuleId();
    const newRule = {
      rule_id,
      rule_type: ruleType,
      rule_name: `New ${ruleType} Rule`,
      isNew: true
    };

    if (sectionIdx !== null && sectionIdx !== undefined) {
      // Add directly to the target section
      const newSections = editForm.sections.map((section, idx) =>
        idx === sectionIdx
          ? { ...section, rules: [...(section.rules || []), newRule] }
          : section
      );
      setEditForm(prev => ({ ...prev, sections: newSections }));
    } else {
      // Add to staging (legacy behavior)
      setEditForm(prev => ({ ...prev, stagingRules: [...(prev.stagingRules || []), newRule] }));
    }

    handleOpenRuleEditor(newRule);
    updateReactData({ addRuleDialogOpen: false, targetSectionIdx: null }, true);
  };

  // Add new rule directly to a specific section
  const handleAddRuleToSection = (sectionIdx) => {
    updateReactData({ addRuleDialogOpen: true, targetSectionIdx: sectionIdx }, true);
  };


  // Move section down
  const handleMoveSectionDown = (idx) => {
    if (idx === editForm.sections.length - 1) return; // Already at the bottom
    const newSections = [editForm.sections[idx + 1], editForm.sections[idx]];
    editForm.sections.splice(idx, 2, ...newSections);
    setEditForm(prev => ({ ...prev, sections: editForm.sections }));
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

  // Save changes (exclude stagingFields and stagingRules, process Common_Fields, build fields object)
  const handleSave = async () => {
    if (!onSave) return;

    const { stagingFields, stagingRules, ...formToSave } = editForm;

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
        commonFieldsToSave.push(Object.assign({}, field, {
          client_id: formToSave.client_id,
          field_id: field.field_id,
          field_name: field.field_name,
          prompt: field.prompt,
          show_if: field.show_if,
          value: field.value,
          required: field.required || field.value.required || false
        }));
      } else {
        // This field should be stored in the form's fields object
        fieldsObject[field.field_id] = Object.assign({}, field, {
          field_id: field.field_id,
          field_name: field.field_name,
          prompt: field.prompt,
          show_if: field.show_if,
          value: field.value,
          required: field.required || field.value.required || false
        });
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

    // Step 4: Update sections to reference fields by field_id only and convert rules to show_if
    const sectionsToSave = formToSave.sections.map(section => {
      const sectionToSave = {
        ...section,
        fields: section.fields.map(field =>
          typeof field === 'string' ? field : field.field_id
        )
      };

      // Convert rules to show_if format
      if (section.rules && section.rules.length > 0) {
        sectionToSave.show_if = section.rules.map(rule => ruleToShowIf(rule));
        delete sectionToSave.rules; // Remove rules property from saved section
      }

      return sectionToSave;
    });

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

  // Rule editor handlers
  const [ruleEditorOpen, setRuleEditorOpen] = React.useState(false);
  const [ruleEditorRule, setRuleEditorRule] = React.useState(null);

  const handleOpenRuleEditor = async (rule) => {
    // Fetch common fields if this is a data dependent rule
    if (rule.rule_type === 'data dependent' && editForm.client_id) {
      const resp = await dbClient
        .query({
          TableName: 'Common_Fields',
          KeyConditionExpression: 'client_id = :c',
          ExpressionAttributeValues: { ':c': editForm.client_id }
        })
        .promise()
        .catch(() => null);
      const list = resp && recordExists(resp) ? (resp.Items || []) : [];
      updateReactData({ ruleEditorCommonFields: list }, true);
    }
    setRuleEditorRule(rule);
    setRuleEditorOpen(true);
  };

  // Field editor handlers
  const [fieldEditorOpen, setFieldEditorOpen] = React.useState(false);
  const [fieldEditorField, setFieldEditorField] = React.useState(null);
  const [fieldEditorSectionIdx, setFieldEditorSectionIdx] = React.useState(null);
  const [fieldEditorFieldIdx, setFieldEditorFieldIdx] = React.useState(null);

  const handleOpenFieldEditor = async (sectionIdx, fieldIdx) => {
    setFieldEditorSectionIdx(sectionIdx);
    setFieldEditorFieldIdx(fieldIdx);
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

    // Fetch common fields for rule editor in FieldEditor
    if (editForm.client_id) {
      const resp = await dbClient
        .query({
          TableName: 'Common_Fields',
          KeyConditionExpression: 'client_id = :c',
          ExpressionAttributeValues: { ':c': editForm.client_id }
        })
        .promise()
        .catch(() => null);
      const list = resp && recordExists(resp) ? (resp.Items || []) : [];
      updateReactData({ ruleEditorCommonFields: list }, true);
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
          Item: Object.assign({}, cleanedField, {
            client_id: editForm.client_id,
          })
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
    setFieldEditorSectionIdx(null);
    setFieldEditorFieldIdx(null);
  };

  const handleRemoveFieldFromEditor = (sectionIdx, fieldIdx) => {
    setEditForm(prev => {
      const newSections = prev.sections.map((section, idx) => {
        if (idx === sectionIdx) {
          return {
            ...section,
            fields: section.fields.filter((_, fIdx) => fIdx !== fieldIdx)
          };
        }
        return section;
      });
      return { ...prev, sections: newSections };
    });
    setFieldEditorOpen(false);
    setFieldEditorSectionIdx(null);
    setFieldEditorFieldIdx(null);
  };

  const handleSaveRuleEditor = (updatedRule) => {
    setEditForm(prev => {
      const newStagingRules = (prev.stagingRules || []).map(r =>
        r.rule_id === updatedRule.rule_id ? updatedRule : r
      );
      const newSections = prev.sections.map(section => {
        if (section.rules && section.rules.find(r => r.rule_id === updatedRule.rule_id)) {
          return {
            ...section,
            rules: section.rules.map(r => r.rule_id === updatedRule.rule_id ? updatedRule : r)
          };
        }
        return section;
      });
      return { ...prev, sections: newSections, stagingRules: newStagingRules };
    });
    setRuleEditorOpen(false);
  };

  const handleCancelRuleEditor = () => {
    if (ruleEditorRule && ruleEditorRule.isNew) {
      setEditForm(prev => ({
        ...prev,
        stagingRules: (prev.stagingRules || []).filter(r => r.rule_id !== ruleEditorRule.rule_id)
      }));
    }
    setRuleEditorOpen(false);
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
      {/* Add Rule choice dialog */}
      {reactData.addRuleDialogOpen && (
        <Dialog
          open={true}
          onClose={() => updateReactData({ addRuleDialogOpen: false }, true)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            style: {
              borderRadius: '25px',
            }
          }}
        >
          <Box display="flex" flexDirection="column" style={{ minHeight: 250 }}>
            <Box p={2} style={{ borderBottom: '1px solid #eee' }}>
              <Typography variant="h6" gutterBottom>Select Rule Type</Typography>
            </Box>
            <Box p={2} style={{ overflowY: 'auto', flex: 1 }}>
              <Box
                display="flex"
                alignItems="center"
                mb={2}
                p={2}
                style={{
                  cursor: 'pointer',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  transition: 'background-color 0.2s'
                }}
                onClick={() => handleAddRule('member of', reactData.targetSectionIdx)}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Typography>
                  Member Of
                </Typography>
              </Box>
              <Box
                display="flex"
                alignItems="center"
                mb={2}
                p={2}
                style={{
                  cursor: 'pointer',
                  borderRadius: '8px',
                  border: '1px solid #e0e0e0',
                  transition: 'background-color 0.2s'
                }}
                onClick={() => handleAddRule('data dependent', reactData.targetSectionIdx)}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Typography>
                  Data Dependent
                </Typography>
              </Box>
            </Box>
            <Box p={2} display="flex" justifyContent="flex-end" style={{ borderTop: '1px solid #eee' }}>
              <Button variant="outlined" onClick={() => updateReactData({ addRuleDialogOpen: false }, true)}>Cancel</Button>
            </Box>
          </Box>
        </Dialog>
      )}
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
      <Typography variant="h6" style={{ marginLeft: 16, marginTop: 16, marginBottom: 2, fontWeight: 600 }}>Sections</Typography>
      <Box className={classes.sectionsArea}>
        <DragDropContext onDragEnd={handleDragEnd}>
          {editForm.sections.map((section, idx) => (
            <div key={`section-${idx}`}>
              <Box marginBottom={1}>
                <Box display="flex" marginTop={(idx > 0 ? '-60px' : '0')} minHeight={'100px'} marginLeft={2} alignItems="center">
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
                  {(idx !== (editForm.sections.length - 1)) &&
                    <Box style={{ paddingTop: '60px' }}>
                      <IconButton onClick={() => handleMoveSectionDown(idx)} disabled={idx === editForm.sections.length - 1} title="Move section down">
                        <Shuffle />
                      </IconButton>
                    </Box>
                  }
                  <IconButton onClick={() => handleAddFieldToSection(idx)} title="Add field to this section">
                    <Add />
                  </IconButton>
                  <IconButton onClick={() => handleAddRuleToSection(idx)} title="Add rule to this section">
                    <VerifiedUser />
                  </IconButton>
                  <IconButton onClick={() => handleRemoveSection(idx)}>
                    <Delete />
                  </IconButton>
                  <IconButton onClick={() => updateReactData({ [`collapse_${idx}`]: !reactData[`collapse_${idx}`] }, true)}>
                    {reactData[`collapse_${idx}`] ? <ExpandLess /> : <ExpandMore />}
                  </IconButton>
                </Box>
                {reactData[`collapse_${idx}`] && (
                  <Box ml={4} mt={1}>
                    {section.rules && section.rules.length > 0 &&
                      <React.Fragment>
                        <Typography variant="body2" style={{ fontWeight: 600, marginBottom: 8, marginTop: 12 }}>Rules</Typography>
                        <Droppable droppableId={`section-rules-${idx}`} type="rule">
                          {(provided) => (
                            <ul style={{ margin: 0, paddingLeft: 16, marginTop: -8, minHeight: 30 }} ref={provided.innerRef} {...provided.droppableProps}>
                              {(
                                section.rules.map((rule, rIdx) => (
                                  <Draggable key={rule.rule_id} draggableId={`rule-${rule.rule_id}`} index={rIdx}>
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
                                          handleOpenRuleEditor(rule);
                                        }}
                                      >
                                        <Box display="flex" alignItems="center">
                                          <Typography style={{ fontSize: '1rem' }}>
                                            {rule.rule_name || `${rule.rule_type} Rule`}
                                          </Typography>
                                        </Box>
                                      </li>
                                    )}
                                  </Draggable>
                                ))
                              )}
                              {provided.placeholder}
                            </ul>
                          )}
                        </Droppable>
                      </React.Fragment>
                    }
                    <Typography variant="body2" style={{ fontWeight: 600, marginBottom: 8, marginTop: 12 }}>Fields</Typography>
                    <Droppable droppableId={`section-fields-${idx}`} type="field">
                      {(dropProvided, dropSnapshot) => (
                        <ul
                          ref={dropProvided.innerRef}
                          {...dropProvided.droppableProps}
                          style={{
                            margin: 0,
                            paddingLeft: 16,
                            marginTop: -8,
                            backgroundColor: dropSnapshot.isDraggingOver ? '#e3f2fd' : 'transparent',
                            borderRadius: '4px',
                            transition: 'background-color 0.2s',
                          }}
                        >
                          {section.fields && section.fields.length > 0 ? (
                            section.fields.map((field, fIdx) => {
                              const fieldObj = typeof field === 'string' ? { field_id: field, field_name: field } : field;
                              const fieldId = fieldObj.field_id || fieldObj.field_name;
                              return (
                                <Draggable key={fieldId} draggableId={`field-${idx}-${fieldId}`} index={fIdx}>
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
                                      <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                                        <span>
                                          {(() => {
                                            const raw = fieldObj.field_name;
                                            if (!raw) return '';
                                            const words = raw.replace(/[_-]+/g, ' ');
                                            return `${titleCase(words)}${(fieldObj.show_if || fieldObj.ignore_if) ? ' *' : ''}`;
                                          })()}
                                        </span>
                                      </Box>
                                    </li>
                                  )}
                                </Draggable>
                              );
                            })
                          ) : (
                            <Typography variant="body2" color="textSecondary" style={{ marginLeft: 8 }}>No fields</Typography>
                          )}
                          {dropProvided.placeholder}
                        </ul>
                      )}
                    </Droppable>
                  </Box>
                )}
              </Box>
            </div>
          ))}
        </DragDropContext>
      </Box>
      {/* Field Editor dialog */};
      {
        fieldEditorOpen &&
        <FieldEditor
          field={fieldEditorField}
          open={fieldEditorOpen}
          onSave={(returnField) => handleSaveFieldEditor(returnField)}
          onCancel={handleCancelFieldEditor}
          fieldsMap={(() => {
            const map = {};
            editForm.sections.forEach(section => {
              section.fields.forEach(field => {
                const fieldObj = typeof field === 'string' ? { field_id: field, field_name: field, prompt: '' } : field;
                map[fieldObj.field_id || fieldObj.field_name] = fieldObj;
              });
            });
            (editForm.stagingFields || []).forEach(field => {
              map[field.field_id || field.field_name] = field;
            });
            return map;
          })()}
          onAddRule={(showIfObj) => {
            // Apply the rule to the field
            setEditForm(prev => {
              const newSections = prev.sections.map(section => {
                if (section.fields.find(f => (typeof f === 'string' ? f === fieldEditorField.field_id : f.field_id === fieldEditorField.field_id))) {
                  return {
                    ...section,
                    fields: section.fields.map(f => {
                      const fieldMatch = (typeof f === 'string' ? f === fieldEditorField.field_id : f.field_id === fieldEditorField.field_id);
                      if (fieldMatch) {
                        return { ...(typeof f === 'string' ? { field_id: f, field_name: f } : f), show_if: showIfObj };
                      }
                      return f;
                    })
                  };
                }
                return section;
              });
              return { ...prev, sections: newSections };
            });
            // Also update the editor field
            setFieldEditorField(prev => ({ ...prev, show_if: showIfObj }));
          }}
          ruleEditorCommonFields={reactData.ruleEditorCommonFields || []}
          onRemove={handleRemoveFieldFromEditor}
          sectionIdx={fieldEditorSectionIdx}
          fieldIdx={fieldEditorFieldIdx}
        />
      }
      {/* Rule Editor dialog */}
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
                  {ruleEditorRule.rule_type === 'member of'
                    ? 'Only show this section when the user is a member of one of the selected groups below'
                    : `Configure ${ruleEditorRule.rule_type} Rule`
                  }
                </Typography>
                <TextField
                  label="Rule Name"
                  defaultValue={ruleEditorRule.rule_name || ''}
                  onBlur={(e) => setRuleEditorRule(prev => ({ ...prev, rule_name: e?.target?.value || '' }))}
                  fullWidth
                  size="small"
                />
              </Box>
              {ruleEditorRule.rule_type === 'member of' && (
                <Box p={2} style={{ overflowY: 'auto', flex: 1, borderBottom: '1px solid #eee' }}>
                  <Typography variant="subtitle2" style={{ marginBottom: 8, fontWeight: 600 }}>
                    Select Groups
                  </Typography>
                  {editForm.client_id && state?.groups ? (
                    <Box>
                      {state.groups.adminHierarchy && state.groups.adminHierarchy.length > 0 && (
                        <Box mb={2}>
                          <Typography variant="body2" style={{ fontWeight: 600, marginBottom: 8 }}>
                            Administrative Groups
                          </Typography>
                          {state.groups.adminHierarchy.map((gObj, idx) => (
                            <Box
                              key={`admin-${idx}`}
                              display="flex"
                              alignItems="center"
                              style={{
                                marginLeft: `${gObj.level * 16}px`,
                                marginBottom: '4px'
                              }}
                            >
                              <Checkbox
                                size="small"
                                checked={(ruleEditorRule.selected_groups || []).includes(gObj.id)}
                                onChange={(e) => {
                                  const newGroups = ruleEditorRule.selected_groups || [];
                                  if (e.target.checked) {
                                    if (!newGroups.includes(gObj.id)) {
                                      newGroups.push(gObj.id);
                                    }
                                  } else {
                                    const idx = newGroups.indexOf(gObj.id);
                                    if (idx > -1) {
                                      newGroups.splice(idx, 1);
                                    }
                                  }
                                  setRuleEditorRule(prev => ({ ...prev, selected_groups: [...newGroups] }));
                                }}
                              />
                              <Typography>
                                {gObj.name}
                              </Typography>
                            </Box>
                          ))}
                        </Box>
                      )}
                      {state.groups.publicGroups && Object.keys(state.groups.publicGroups).length > 0 && (
                        <Box>
                          <Typography variant="body2" style={{ fontWeight: 600, marginBottom: 8 }}>
                            Public Groups
                          </Typography>
                          {Object.keys(state.groups.publicGroups).map((gID, idx) => {
                            const grp = state.groups.publicGroups[gID];
                            return (
                              <Box
                                key={`public-${idx}`}
                                display="flex"
                                alignItems="center"
                                style={{ marginBottom: '4px' }}
                              >
                                <Checkbox
                                  size="small"
                                  checked={(ruleEditorRule.selected_groups || []).includes(gID)}
                                  onChange={(e) => {
                                    const newGroups = ruleEditorRule.selected_groups || [];
                                    if (e.target.checked) {
                                      if (!newGroups.includes(gID)) {
                                        newGroups.push(gID);
                                      }
                                    } else {
                                      const idx = newGroups.indexOf(gID);
                                      if (idx > -1) {
                                        newGroups.splice(idx, 1);
                                      }
                                    }
                                    setRuleEditorRule(prev => ({ ...prev, selected_groups: [...newGroups] }));
                                  }}
                                />
                                <Typography>
                                  {grp.group_name}
                                </Typography>
                              </Box>
                            );
                          })}
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="textSecondary">
                      Loading groups...
                    </Typography>
                  )}
                </Box>
              )}
              {ruleEditorRule.rule_type === 'data dependent' && (
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
                    {reactData.ruleEditorCommonFields && reactData.ruleEditorCommonFields.length > 0 ? (
                      reactData.ruleEditorCommonFields.map((field) => (
                        <option key={field.field_id} value={field.field_id}>
                          {titleCase(field.field_name || field.field_id)}
                        </option>
                      ))
                    ) : (
                      <option disabled>No fields available</option>
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
              )}
              <Box p={2} display="flex" justifyContent="space-between" style={{ borderTop: '1px solid #eee' }}>
                <Button variant="outlined" onClick={handleCancelRuleEditor}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => handleSaveRuleEditor(ruleEditorRule)}
                >
                  Save Rule
                </Button>
              </Box>
            </Box>
          </Dialog>
        )
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
      {
        confirmDialog.open &&
        <AVAConfirm
          onConfirm={() => confirmDialog.action && confirmDialog.action()}
          onCancel={() => setConfirmDialog({ open: false, action: null })}
          promptText={["Confirm Delete", "Are you sure you want to delete this item?"]}
        />
      }
      {
        reactData.isEditing &&
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
