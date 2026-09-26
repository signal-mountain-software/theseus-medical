import React from 'react';

import useSession from '../../hooks/useSession';
import { dbClient, recordExists, cl, getDb, putDb, deepCopy, uuid, titleCase } from '../../util/AVAUtilities';
import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { getEventMasterList } from '../../util/AVACalendars';
import FormFillB from '../forms/FormFillB';
import AVAConfirm from '../forms/AVAConfirm';
import QuickSearch from '../sections/QuickSearch';

import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    IconButton,
    TextField,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
    FormControlLabel,
    Checkbox,
    Box,
    Paper,
    Typography,
    Divider,
    CircularProgress,
    Snackbar,
    InputAdornment,
} from '@material-ui/core';
import { Alert, Autocomplete } from '@material-ui/lab/';

import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import CloseIcon from '@material-ui/icons/Close';
import EditIcon from '@material-ui/icons/Edit';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';

// The list of field types a user can choose from when bootstrapping a field.
// More types (header, signature, date-driven rules, saved/shared fields, etc.)
// will be added in later passes - this is intentionally just the basics.
const FIELD_TYPES = [
    { value: 'text', label: 'Text' },
    { value: 'date', label: 'Date' },
    { value: 'phone', label: 'Phone Number' },
    { value: 'numeric', label: 'Number' },
    { value: 'yes/no', label: 'Yes / No' },
    { value: 'select', label: 'Select from a list' },
    { value: 'family', label: 'Family Member(s) selector' },
    { value: 'select_event', label: 'Event Signup' },
    { value: 'header', label: 'Header (label only)' },
];

// Field types whose answer box width is actually controllable (rendered via FormFillB's
// renderTextLikeField) - select/yes-no/header size themselves and ignore prompt.width.
const WIDTH_ADJUSTABLE_TYPES = ['text', 'date', 'phone', 'numeric'];

// Named presets in place of raw pixel entry - values are the pixel widths FormFillB expects
// in prompt.width. '' means "unset", letting FormFillB fall back to its own default.
const WIDTH_PRESETS = [
    { value: '', label: 'Default width' },
    { value: '400', label: 'Narrow' },
    { value: '600', label: 'Medium' },
    { value: '900', label: 'Wide' },
    { value: '1400', label: 'Full width' },
];

// Text fields only - values are the row counts FormFillB expects in prompt.rows.
// '' means "unset" (single line).
const HEIGHT_PRESETS = [
    { value: '', label: 'Single line' },
    { value: '3', label: 'Medium (3 lines)' },
    { value: '5', label: 'Large (5 lines)' },
];

// DataDictionary/legacy field records sometimes store their type as the generic 'string', or
// as 'boolean'/'bool' (DataDictionary's true/false type) - coerce those onto real FIELD_TYPES
// entries. 'boolean' becomes 'yes/no' since that's the only boolean-capable type FormFillB and
// this editor's condition-value UI actually know how to render/test.
const coerceFieldType = (rawType) => {
    const normalizedType = (rawType || '').toString().toLowerCase();
    if (normalizedType === 'string') { return 'text'; }
    if (normalizedType === 'boolean' || normalizedType === 'bool') { return 'yes/no'; }
    return rawType || 'text';
};

// 'select&text' is not its own FIELD_TYPES entry - it's 'select' plus the "allow custom
// value" checkbox checked. Both share the same list-of-values editor UI.
const isSelectType = (type) => (type === 'select' || type === 'select&text');

// 'family&guests' is not its own FIELD_TYPES entry either - it's 'family' plus the "allow
// guests" checkbox checked, letting FormFillB accept free-text guest names alongside the
// checkbox list of actual family members.
const isFamilyType = (type) => (type === 'family' || type === 'family&guests');

// select_event has no flavor variants, but shares select's required <-> min-selections sync.
const usesSelectionCount = (type) => (isSelectType(type) || type === 'select_event');

// Numeric YYYYMMDD (from Calendar event records) -> a readable date/range for the event picker.
const formatNumericDateRange = (start, end) => {
    const fmt = (n) => {
        const s = String(n || '');
        return (s.length === 8) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s;
    };
    if (!start && !end) { return ''; }
    return `${fmt(start)}${(end && end !== start) ? ` – ${fmt(end)}` : ''}`;
};

// Turns a free-form field label into a safe, unique-ish field_name key
// (lowercase, underscores, no punctuation).
const slugifyFieldName = (rawValue) => {
    return (rawValue || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || `field_${uuid(6).toLowerCase()}`;
};

// Builds a unique, internal-only stage_name for a section (slugified from its name, deduped
// against names already in use; falls back to a random id) - forms auto-assign one stage per
// section so stage-exit handling has something to key off of from the moment a section exists.
const makeSectionStageName = (sectionName, existingStageNames) => {
    const used = new Set(existingStageNames || []);
    const base = (sectionName || '')
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || `stage_${uuid(6).toLowerCase()}`;
    let candidate = base;
    let suffix = 2;
    while (used.has(candidate)) {
        candidate = `${base}_${suffix}`;
        suffix += 1;
    }
    return candidate;
};

// field_name is an internal key only - never shown or typed by the author.
const blankField = () => ({
    key: uuid(8),
    field_name: `field_${uuid(10).toLowerCase()}`,
    type: 'text',
    prompt: '',
    selectionList: [''],
    selectMin: '0',
    selectMax: '1',
    column: false,
    dictionary_field_key: null,
    required: false,
    promptWidth: '',
    promptRows: '',
    // numeric only: optional inclusive bounds on the entered number.
    numericMin: '',
    numericMax: '',
    // select_event only: event(s) offered, an optional occurrence cap, and an optional link
    // to a family/family&guests Item whose members should each get their own signup slot.
    eventIds: [],
    eventOccurrenceLimit: '',
    familySignupField: '',
    // Conditional display: 'none' | 'show_if' | 'ignore_if', mutually exclusive.
    // conditionKind: 'field' (test another Item's value) - fields don't support 'audience' yet.
    conditionType: 'none',
    conditionKind: 'field',
    conditionField: '',
    conditionValues: [],
});

const blankSection = () => ({
    key: uuid(8),
    section_name: 'New Section',
    fields: [blankField()],
    // Conditional display: 'none' | 'show_if' | 'ignore_if', mutually exclusive.
    // conditionKind: 'field' (test another Item's value) or 'audience' (person/group/class restriction).
    conditionType: 'none',
    conditionKind: 'field',
    conditionField: '',
    conditionValues: [],
});

// The three privileged account_class values a section's audience restriction can target,
// presented as QuickSearch's fake-person "special value" entries (same trick MainMenuV3 uses
// for *all/*admin/*support) - but this feature stores the bare class name (no '*' prefix).
const CONDITION_CLASS_VALUES = [
    { person_id: '*master', first: '* Master Accounts', last: '' },
    { person_id: '*support', first: '* Support Staff', last: '' },
    { person_id: '*admin', first: '* Admin Accounts', last: '' },
];

// A short "2 Groups, 1 Person, Admin" summary of a stored audience array
// (mixed 'group:<id>' / 'person:<id>' / bare class-name strings).
const describeConditionAudience = (conditionValues) => {
    const values = conditionValues || [];
    if (values.length === 0) { return 'No one selected yet'; }
    const groupCount = values.filter((v) => v.startsWith('group:')).length;
    const personCount = values.filter((v) => v.startsWith('person:')).length;
    const classNames = values.filter((v) => !v.startsWith('group:') && !v.startsWith('person:'));
    const parts = [];
    if (groupCount > 0) { parts.push(`${groupCount} Group${groupCount === 1 ? '' : 's'}`); }
    if (personCount > 0) { parts.push(`${personCount} ${personCount === 1 ? 'Person' : 'People'}`); }
    classNames.forEach((c) => parts.push(titleCase(c)));
    return parts.join(', ');
};

const blankForm = (client_id) => {
    const initialSection = blankSection();
    const stage_name = makeSectionStageName(initialSection.section_name, []);
    initialSection.belongs_to_stage = stage_name;
    return {
        client_id,
        form_id: `form_${uuid(12)}`,
        form_name: '',
        category: '',
        active: true,
        sections: [initialSection],
        stages: [{ stage_name }],
    };
};

export default ({ onClose, directForm }) => {

    const { state } = useSession();
    const AVAClass = AVAclasses();
    const client_id = state.session.client_id;
    // When directForm is supplied (an existing form record, or the string 'new'), the editor
    // opens straight into edit mode for that one form and skips its own list view entirely -
    // used when launched from FormManagement's pencil/"New Form" icons, which own the form list.
    const directEditMode = !!directForm;

    // view always starts at 'list' - even in directEditMode, so the loading spinner
    // (renderListView) shows until the effect below populates editingForm and flips
    // view to 'edit' in the same update; flipping view eagerly here would render
    // renderEditView() against a still-null editingForm on the very first paint.
    const [reactData, setReactData] = React.useState({
        view: 'list',       // 'list' | 'edit'
        loading: true,
        forms: [],
        dictionaryFields: [], // reusable Item definitions loaded from DataDictionaryV3
        calendarEvents: [], // event master records, for select_event's event picker
        editingForm: null,
        savedSnapshot: null, // JSON.stringify of editingForm as of the last load/save, for the unsaved-changes check
        confirmExit: false, // true while the "unsaved changes" exit confirmation is showing
        saving: false,
        previewFormRec: null, // set while the Preview overlay (FormFillB) is open
        showConditionAudienceSearch: false, // true while QuickSearch is open, picking a condition's person/group/class audience
        alert: false,
    });
    // A counter (not a boolean) - a boolean toggle would cancel itself out when `force` is
    // invoked twice in the same event/batch (e.g. Autocomplete fires both onChange and
    // onInputChange for a single select/clear), silently leaving React with nothing to re-render.
    // Only the setter is used - the count itself has no meaning outside forcing a re-render.
    const [, setRefreshTrigger] = React.useState(0);
    const updateReactData = (newData, force = false) => {
        setReactData((prevValues) => (Object.assign(prevValues, newData)));
        if (force) { setRefreshTrigger((prev) => prev + 1); }
    };

    // Drag-to-reorder state for Items - lives outside reactData (like the export field
    // picker's drag state) since it's pure hover/drag UI feedback, not editingForm data.
    const [dragFieldOrigin, setDragFieldOrigin] = React.useState(null); // { sectionIdx, fieldIdx }
    const [dropTarget, setDropTarget] = React.useState(null); // { sectionIdx, fieldIdx } | { sectionIdx, end: true }
    // The row stays draggable="true" only while the pointer is down on its 6-dot handle -
    // otherwise clicking/selecting text anywhere else in the row would also start a drag.
    const [dragHandleKey, setDragHandleKey] = React.useState(null); // field.key of the row whose handle is pressed

    // Which field's "Conditional Display" popup is open, if any.
    const [conditionEditorTarget, setConditionEditorTarget] = React.useState(null); // { sectionIdx, fieldIdx } - fieldIdx null means a section-level condition

    // Flat list of every other Item in the form (excluding the one being configured and any
    // header rows, which hold no value to test against) - used to populate the "other item"
    // picker in the Conditional Display popup. Pass fieldIdx null (a section-level condition)
    // to exclude nothing - a section may key off any field, including ones inside itself.
    const getConditionFieldOptions = (excludeSectionIdx, excludeFieldIdx) => {
        const options = [];
        (reactData.editingForm?.sections || []).forEach((section, sIdx) => {
            section.fields.forEach((f, fIdx) => {
                if ((sIdx === excludeSectionIdx) && (fIdx === excludeFieldIdx)) { return; }
                if (f.type === 'header') { return; }
                const plainPrompt = (f.prompt || '').toString().replace(/<[^>]+>/g, '').trim();
                options.push({
                    field_name: f.field_name,
                    label: plainPrompt || f.field_name,
                    type: f.type,
                    selectionList: f.selectionList || [],
                });
            });
        });
        return options;
    };

    // A single-line "<field label>: v1, v2, v3…" summary shown next to the Conditional? button,
    // for both fields and sections - truncated with CSS ellipsis so it never wraps the row.
    const renderConditionSummary = (target, fieldOptions) => {
        if (!target || target.conditionType === 'none') { return null; }
        const isAudienceKind = target.conditionKind === 'audience';
        if (!isAudienceKind && !target.conditionField) { return null; }
        const label = isAudienceKind
            ? 'Restricted to'
            : (fieldOptions.find((f) => f.field_name === target.conditionField)?.label || target.conditionField);
        const valuesText = isAudienceKind
            ? describeConditionAudience(target.conditionValues)
            : (target.conditionValues || []).join(', ');
        return (
            <Typography
                style={Object.assign(
                    { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 },
                    AVATextStyle({ size: 0.8, color: 'textSecondary' })
                )}
            >
                {`${label}: ${valuesText}`}
            </Typography>
        );
    };

    // trackLoading is false in directEditMode, where the list view is skipped entirely and
    // startEditingForm/startNewForm own the loading/view flip - here we only need the forms
    // list to derive the existing Category suggestions.
    const loadFormList = async (trackLoading = true) => {
        if (trackLoading) { updateReactData({ loading: true }, true); }
        let allFormsItems = [];
        let lastKey = undefined;
        do {
            const querySpec = {
                TableName: 'Forms',
                KeyConditionExpression: 'client_id = :c',
                ExpressionAttributeValues: { ':c': client_id },
            };
            if (lastKey) { querySpec.ExclusiveStartKey = lastKey; }
            const result = await dbClient.query(querySpec).promise().catch((error) => {
                cl(`Error reading Forms in FormBuilder: ${error}`);
            });
            if (recordExists(result)) {
                allFormsItems = allFormsItems.concat(result.Items || []);
            }
            lastKey = result?.LastEvaluatedKey;
        } while (lastKey);

        allFormsItems.sort((a, b) => (a.form_name || '').localeCompare(b.form_name || ''));
        updateReactData(trackLoading ? { forms: allFormsItems, loading: false } : { forms: allFormsItems }, true);
    };

    // Loads the reusable Item catalog (source/locator anchored definitions) so authors
    // can link a form Item to one instead of typing a brand-new one from scratch.
    const loadDictionaryFields = async () => {
        let allDictItems = [];
        let lastKey = undefined;
        do {
            const querySpec = {
                TableName: 'DataDictionaryV3',
                KeyConditionExpression: 'client_id = :c',
                ExpressionAttributeValues: { ':c': client_id },
            };
            if (lastKey) { querySpec.ExclusiveStartKey = lastKey; }
            const result = await dbClient.query(querySpec).promise().catch((error) => {
                cl(`Error reading DataDictionaryV3 in FormBuilder: ${error}`);
            });
            if (recordExists(result)) {
                allDictItems = allDictItems.concat(result.Items || []);
            }
            lastKey = result?.LastEvaluatedKey;
        } while (lastKey);

        allDictItems.sort((a, b) => (a.description || a.field_key || '').localeCompare(b.description || b.field_key || ''));
        updateReactData({ dictionaryFields: allDictItems }, true);
    };

    // Loads the client's calendar events (master records only) so select_event fields can
    // offer a picker instead of requiring an author to know an event's opaque generated id.
    const loadCalendarEvents = async () => {
        const events = await getEventMasterList({ client_id }).catch((error) => {
            cl(`Error reading Calendar events in FormBuilder: ${error}`);
            return [];
        });
        updateReactData({ calendarEvents: events || [] }, true);
    };

    React.useEffect(() => {
        loadDictionaryFields();
        loadCalendarEvents();
        loadFormList(!directEditMode);
        if (directEditMode) {
            if (directForm === 'new') { startNewForm(); } else { startEditingForm(directForm); }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Legacy forms could reference a field by key without an entry in the Forms record's own
    // `fields` object - the definition lived instead in Form_Fields (keyed by field_name) and/or
    // Common_Fields (keyed by field_id), with Common_Fields values taking precedence - same
    // precedence FormFillB uses at render time. Used only to backfill data for editing; once the
    // form is saved again, the field is written into fields object like any other (retiring the
    // dependency on these tables over time).
    const loadLegacyFieldDef = async (field_key) => {
        const [formFieldRec, commonFieldRec] = await Promise.all([
            getDb({ Key: { client_id, field_name: field_key }, TableName: 'Form_Fields' }),
            getDb({ Key: { client_id, field_id: field_key }, TableName: 'Common_Fields' }),
        ]);
        if (!formFieldRec && !commonFieldRec) { return null; }
        return Object.assign({}, formFieldRec || {}, commonFieldRec || {}, commonFieldRec?.value || {});
    };

    // Reads back a stored show_if/ignore_if test array (or legacy single-test object) into the
    // editor's flat conditionType/conditionKind/conditionField/conditionValues shape - shared by
    // fields and sections (fields never actually produce an 'audience' kind test today - FormFillB's
    // field-level checkIgnore doesn't support person/group/class restrictions - but parsing one back
    // defensively rather than dropping it costs nothing).
    const parseConditionTest = (obj) => {
        const conditionRaw = obj.show_if || obj.ignore_if;
        const conditionTest = conditionRaw ? (Array.isArray(conditionRaw) ? conditionRaw[0] : conditionRaw) : null;
        const isAudienceTest = !!(conditionTest?.currentUser_audience || conditionTest?.pertainsTo_memberOf);
        const conditionField = (conditionTest && !isAudienceTest)
            ? (conditionTest.field || (conditionTest.data ? conditionTest.data.replace(/^field\./, '') : ''))
            : '';
        let conditionValues;
        if (conditionTest?.currentUser_audience) {
            conditionValues = conditionTest.audience ? (Array.isArray(conditionTest.audience) ? conditionTest.audience : [conditionTest.audience]) : [];
        }
        else if (conditionTest?.pertainsTo_memberOf) {
            // Legacy shape from an earlier iteration of this feature - bare group ids, no "group:" prefix.
            const legacyGroups = conditionTest.memberOf ? (Array.isArray(conditionTest.memberOf) ? conditionTest.memberOf : [conditionTest.memberOf]) : [];
            conditionValues = legacyGroups.map((groupId) => `group:${groupId}`);
        }
        else {
            conditionValues = conditionTest?.values ? (Array.isArray(conditionTest.values) ? conditionTest.values : [conditionTest.values]) : [];
        }
        return {
            conditionType: obj.show_if ? 'show_if' : (obj.ignore_if ? 'ignore_if' : 'none'),
            conditionKind: isAudienceTest ? 'audience' : 'field',
            conditionField,
            conditionValues,
        };
    };


    // Converts a stored Forms record (sections referencing fields by name +
    // a flat fields object) into the section/field row shape this editor works with.
    const startEditingForm = async (formRec) => {
        updateReactData({ loading: true }, true);
        const cloned = deepCopy(formRec);
        const legacyFieldCache = {};
        const sections = await Promise.all((cloned.sections || []).map(async (section) => {
            const fields = await Promise.all((section.fields || []).map(async (fieldRef) => {
                const field_name = (typeof fieldRef === 'string') ? fieldRef : (fieldRef.field_name || fieldRef.field_key);
                const field_key = (typeof fieldRef === 'string')
                    ? fieldRef
                    : (fieldRef.field_key || fieldRef.form_field || fieldRef.field_id || fieldRef.field_name || field_name);
                let fieldDef = cloned.fields && cloned.fields[field_name];
                if (!fieldDef) {
                    if (!Object.prototype.hasOwnProperty.call(legacyFieldCache, field_key)) {
                        legacyFieldCache[field_key] = await loadLegacyFieldDef(field_key);
                    }
                    fieldDef = legacyFieldCache[field_key] || {};
                }
                const selectionList = fieldDef.value?.selection?.selectionList || [''];
                const selectionMin = fieldDef.value?.selection?.min;
                const selectionMax = fieldDef.value?.selection?.max;
                const rawEventIds = fieldDef.value?.selection?.event_id;
                const eventOccurrenceLimit = fieldDef.value?.selection?.event_filter?.count;
                const numericMin = fieldDef.options?.minValue ?? fieldDef.options?.min_value;
                const numericMax = fieldDef.options?.maxValue ?? fieldDef.options?.max_value;
                return {
                    key: uuid(8),
                    field_name,
                    type: coerceFieldType(fieldDef.type),
                    prompt: (typeof fieldDef.prompt === 'string') ? fieldDef.prompt : (fieldDef.prompt?.value || ''),
                    selectionList: selectionList.length ? selectionList : [''],
                    selectMin: (selectionMin !== undefined && selectionMin !== null) ? String(selectionMin) : '0',
                    selectMax: (selectionMax !== undefined && selectionMax !== null) ? String(selectionMax) : '1',
                    column: !!fieldDef.value?.column,
                    dictionary_field_key: fieldDef.dictionary_field_key || null,
                    required: !!fieldDef.required,
                    promptWidth: (typeof fieldDef.prompt === 'object' && fieldDef.prompt?.width) ? String(fieldDef.prompt.width) : '',
                    promptRows: (typeof fieldDef.prompt === 'object' && fieldDef.prompt?.rows) ? String(fieldDef.prompt.rows) : '',
                    numericMin: (numericMin !== undefined && numericMin !== null) ? String(numericMin) : '',
                    numericMax: (numericMax !== undefined && numericMax !== null) ? String(numericMax) : '',
                    eventIds: rawEventIds ? (Array.isArray(rawEventIds) ? rawEventIds : [rawEventIds]) : [],
                    eventOccurrenceLimit: (eventOccurrenceLimit !== undefined && eventOccurrenceLimit !== null) ? String(eventOccurrenceLimit) : '',
                    familySignupField: fieldDef.value?.selection?.family_signup_field || '',
                    ...parseConditionTest(fieldDef),
                };
            }));
            return {
                key: uuid(8),
                section_name: section.section_name || '',
                belongs_to_stage: section.belongs_to_stage || '',
                fields,
                ...parseConditionTest(section),
            };
        }));

        const resolvedSections = sections.length ? sections : [blankSection()];

        // Backfill stages/belongs_to_stage for brand new forms or forms saved before stage
        // support existed - one stage per section, keyed by a slug of the section's name.
        const stages = Array.isArray(cloned.stages) ? cloned.stages.map((stage) => ({ ...stage })) : [];
        const usedStageNames = new Set(stages.map((stage) => stage.stage_name));
        for (const section of resolvedSections) {
            if (!section.belongs_to_stage) {
                const stage_name = makeSectionStageName(section.section_name, usedStageNames);
                section.belongs_to_stage = stage_name;
                usedStageNames.add(stage_name);
                stages.push({ stage_name });
            }
        }

        const loadedForm = {
            client_id: cloned.client_id || client_id,
            form_id: cloned.form_id,
            form_name: cloned.form_name || '',
            category: cloned.category || '',
            active: (cloned.active !== undefined) ? cloned.active : true,
            sections: resolvedSections,
            stages,
        };
        updateReactData({
            view: 'edit',
            editingForm: loadedForm,
            savedSnapshot: JSON.stringify(loadedForm),
            loading: false,
        }, true);
    };

    const startNewForm = () => {
        const newForm = blankForm(client_id);
        updateReactData({
            view: 'edit',
            editingForm: newForm,
            savedSnapshot: JSON.stringify(newForm),
        }, true);
    };

    // True once editingForm has diverged from the last loaded/saved snapshot.
    const hasUnsavedChanges = () => JSON.stringify(reactData.editingForm) !== reactData.savedSnapshot;

    const exitEditing = () => {
        if (directEditMode) { onClose && onClose(false); return; }
        updateReactData({ view: 'list', editingForm: null }, true);
    };

    // Bound to the Exit button - warns via AVAConfirm if there are unsaved changes
    // instead of silently discarding them.
    const requestExit = () => {
        if (hasUnsavedChanges()) { updateReactData({ confirmExit: true }, true); return; }
        exitEditing();
    };

    const updateEditingForm = (changes) => {
        updateReactData({ editingForm: Object.assign({}, reactData.editingForm, changes) }, true);
    };

    const updateSection = (sectionIdx, changes) => {
        const sections = reactData.editingForm.sections.map((section, idx) => (
            (idx === sectionIdx) ? Object.assign({}, section, changes) : section
        ));
        updateEditingForm({ sections });
    };

    const updateField = (sectionIdx, fieldIdx, changes) => {
        const sections = reactData.editingForm.sections.map((section, sIdx) => {
            if (sIdx !== sectionIdx) { return section; }
            return Object.assign({}, section, {
                fields: section.fields.map((field, fIdx) => (
                    (fIdx === fieldIdx) ? Object.assign({}, field, changes) : field
                )),
            });
        });
        updateEditingForm({ sections });
    };

    const addSection = () => {
        const existingStageNames = (reactData.editingForm.stages || []).map((stage) => stage.stage_name);
        const newSection = blankSection();
        newSection.belongs_to_stage = makeSectionStageName(newSection.section_name, existingStageNames);
        updateEditingForm({
            sections: [...reactData.editingForm.sections, newSection],
            stages: [...(reactData.editingForm.stages || []), { stage_name: newSection.belongs_to_stage }],
        });
    };

    const removeSection = (sectionIdx) => {
        updateEditingForm({ sections: reactData.editingForm.sections.filter((_, idx) => idx !== sectionIdx) });
    };

    const addField = (sectionIdx) => {
        const sections = reactData.editingForm.sections.map((section, idx) => (
            (idx === sectionIdx) ? Object.assign({}, section, { fields: [...section.fields, blankField()] }) : section
        ));
        updateEditingForm({ sections });
    };

    // Adds an Item linked to a DataDictionaryV3 record. Type is locked from the dictionary
    // (so the stored data always matches how it's read/written elsewhere); prompt defaults
    // from the dictionary's full_prompt/description but stays editable per-form.
    const addFieldFromDictionary = (sectionIdx, field_key) => {
        if (!field_key) { return; }
        const dictRec = reactData.dictionaryFields.find((f) => f.field_key === field_key);
        if (!dictRec) { return; }
        const newField = {
            key: uuid(8),
            field_name: dictRec.field_key,
            type: coerceFieldType(dictRec.type),
            prompt: dictRec.full_prompt || dictRec.description || dictRec.field_key,
            selectionList: [''],
            selectMin: '0',
            selectMax: '1',
            column: false,
            dictionary_field_key: dictRec.field_key,
            required: false,
            promptWidth: '',
            promptRows: '',
            numericMin: '',
            numericMax: '',
            eventIds: [],
            eventOccurrenceLimit: '',
            familySignupField: '',
            conditionType: 'none',
            conditionField: '',
            conditionValues: [],
        };
        const sections = reactData.editingForm.sections.map((section, idx) => (
            (idx === sectionIdx) ? Object.assign({}, section, { fields: [...section.fields, newField] }) : section
        ));
        updateEditingForm({ sections });
    };

    const removeField = (sectionIdx, fieldIdx) => {
        const sections = reactData.editingForm.sections.map((section, idx) => (
            (idx === sectionIdx) ? Object.assign({}, section, { fields: section.fields.filter((_, fIdx) => fIdx !== fieldIdx) }) : section
        ));
        updateEditingForm({ sections });
    };

    // Moves an Item from one section/position to another (or reorders within the same
    // section). `to.fieldIdx` is treated as "insert before this row"; pass `to.end: true`
    // to append at the end of `to.sectionIdx` instead (used by the section's drop zone).
    const moveField = (from, to) => {
        if (!from || !to) { return; }
        const sections = reactData.editingForm.sections.map((section) => Object.assign({}, section, { fields: [...section.fields] }));
        const fromFields = sections[from.sectionIdx]?.fields;
        const toFields = sections[to.sectionIdx]?.fields;
        if (!fromFields || !toFields) { return; }
        if ((from.sectionIdx === to.sectionIdx) && (from.fieldIdx === to.fieldIdx)) { return; }

        const [movedField] = fromFields.splice(from.fieldIdx, 1);
        if (!movedField) { return; }
        const insertAt = to.end ? toFields.length : to.fieldIdx;
        toFields.splice(insertAt, 0, movedField);
        updateEditingForm({ sections });
    };

    const addSelectionValue = (sectionIdx, fieldIdx) => {
        const field = reactData.editingForm.sections[sectionIdx].fields[fieldIdx];
        updateField(sectionIdx, fieldIdx, { selectionList: [...field.selectionList, ''] });
    };

    const updateSelectionValue = (sectionIdx, fieldIdx, valueIdx, newValue) => {
        const field = reactData.editingForm.sections[sectionIdx].fields[fieldIdx];
        const selectionList = field.selectionList.map((v, idx) => (idx === valueIdx ? newValue : v));
        updateField(sectionIdx, fieldIdx, { selectionList });
    };

    const removeSelectionValue = (sectionIdx, fieldIdx, valueIdx) => {
        const field = reactData.editingForm.sections[sectionIdx].fields[fieldIdx];
        updateField(sectionIdx, fieldIdx, { selectionList: field.selectionList.filter((_, idx) => idx !== valueIdx) });
    };

    // Shared by select/select&text and select_event's "Min/Max selections" rows - required
    // and min stay in sync (required implies at least 1), and max is never left below min.
    const handleSelectMinChange = (sectionIdx, fieldIdx, field, rawValue) => {
        const parsedMin = parseInt(rawValue, 10);
        const nextMin = (Number.isFinite(parsedMin) && parsedMin > 0) ? parsedMin : 0;
        const currentMax = parseInt(field.selectMax, 10);
        const changes = { selectMin: rawValue, required: (nextMin > 0) };
        if (Number.isFinite(currentMax) && currentMax < nextMin) {
            changes.selectMax = String(nextMin);
        }
        updateField(sectionIdx, fieldIdx, changes);
    };

    const handleSelectMaxChange = (sectionIdx, fieldIdx, field, rawValue) => {
        const parsedMax = parseInt(rawValue, 10);
        const currentMin = parseInt(field.selectMin, 10) || 0;
        const nextMax = (Number.isFinite(parsedMax) && parsedMax >= currentMin) ? rawValue : String(currentMin || 1);
        updateField(sectionIdx, fieldIdx, { selectMax: nextMax });
    };

    // Shared min/max computation for select/select&text/select_event's stored value.selection.
    const computeSelectMinMax = (field) => {
        const parsedMin = parseInt(field.selectMin, 10);
        const baseMin = (Number.isFinite(parsedMin) && parsedMin > 0) ? parsedMin : 0;
        const min = field.required ? Math.max(1, baseMin) : baseMin;
        const parsedMax = parseInt(field.selectMax, 10);
        const max = (Number.isFinite(parsedMax) && parsedMax >= min) ? parsedMax : Math.max(min, 1);
        return { min, max };
    };

    // Turns the editor's flat conditionType/conditionKind/conditionField/conditionValues into the
    // stored show_if/ignore_if array shape - shared by fields and sections. An 'audience' kind test
    // is only meaningful at the section level. It tests the CURRENT (logged-in) user, not the
    // form's pertains_to subject - this is how specific people are authorized to view/edit
    // sections of someone else's form (FormFillB's okToShowSection reads currentUser_audience;
    // its field-level checkIgnore has no equivalent support).
    const buildConditionOutput = (obj) => {
        if (!(obj.conditionValues || []).length) { return {}; }
        const test = (obj.conditionKind === 'audience')
            ? { currentUser_audience: true, audience: obj.conditionValues }
            : (obj.conditionField ? { field: obj.conditionField, values: obj.conditionValues } : null);
        if (!test) { return {}; }
        if (obj.conditionType === 'show_if') { return { show_if: [test] }; }
        if (obj.conditionType === 'ignore_if') { return { ignore_if: [test] }; }
        return {};
    };

    // Converts the editor's section/field row shape back into a Forms record
    // (sections referencing fields by name + a flat fields object). Shared by
    // saveForm (writes it) and previewForm (hands it to FormFillB without writing it).
    const buildFormRecord = (editingForm) => {
        const fields = {};
        const sections = editingForm.sections.map((section) => ({
            section_name: section.section_name || '',
            belongs_to_stage: section.belongs_to_stage || '',
            ...buildConditionOutput(section),
            fields: section.fields
                .filter((field) => (field.field_name || '').trim())
                .map((field) => {
                    // Dictionary-linked items keep the dictionary's field_key verbatim so the link holds.
                    const field_name = field.dictionary_field_key || slugifyFieldName(field.field_name);
                    const promptExtras = {};
                    if (field.promptWidth) { promptExtras.width = Number(field.promptWidth); }
                    if (field.type === 'text' && field.promptRows) { promptExtras.rows = Number(field.promptRows); }
                    const fieldDef = {
                        type: field.type,
                        prompt: Object.keys(promptExtras).length
                            ? Object.assign({ value: field.prompt || '' }, promptExtras)
                            : (field.prompt || ''),
                        required: !!field.required,
                    };
                    if (field.dictionary_field_key) {
                        fieldDef.dictionary_field_key = field.dictionary_field_key;
                    }
                    Object.assign(fieldDef, buildConditionOutput(field));
                    if (isSelectType(field.type)) {
                        const { min, max } = computeSelectMinMax(field);
                        fieldDef.value = {
                            selection: {
                                selectionList: field.selectionList.filter((v) => (v || '').trim()),
                                min,
                                max,
                            },
                            column: !!field.column,
                        };
                    } else if (field.type === 'select_event') {
                        const { min, max } = computeSelectMinMax(field);
                        const selection = { min, max };
                        if ((field.eventIds || []).length) {
                            selection.event_id = (field.eventIds.length === 1) ? field.eventIds[0] : field.eventIds;
                        }
                        const parsedLimit = parseInt(field.eventOccurrenceLimit, 10);
                        if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
                            selection.event_filter = { count: parsedLimit };
                        }
                        if (field.familySignupField) {
                            selection.family_signup_field = field.familySignupField;
                        }
                        fieldDef.value = {
                            selection,
                            column: !!field.column,
                        };
                    } else if (field.type === 'numeric') {
                        const numericOptions = {};
                        const parsedMin = parseInt(field.numericMin, 10);
                        const parsedMax = parseInt(field.numericMax, 10);
                        if (Number.isFinite(parsedMin)) { numericOptions.minValue = parsedMin; }
                        if (Number.isFinite(parsedMax)) { numericOptions.maxValue = parsedMax; }
                        if (Object.keys(numericOptions).length) { fieldDef.options = numericOptions; }
                    }
                    fields[field_name] = fieldDef;
                    return field_name;
                }),
        }));

        return {
            client_id,
            form_id: editingForm.form_id,
            form_name: editingForm.form_name,
            category: editingForm.category || '',
            active: editingForm.active,
            sections,
            fields,
            stages: editingForm.stages || [],
        };
    };

    // Opens a live FormFillB overlay against the in-progress (possibly unsaved) form
    // definition - no DB write is involved, so there's nothing to clean up afterward.
    const previewForm = () => {
        updateReactData({
            previewFormRec: buildFormRecord(Object.assign({}, reactData.editingForm, {
                form_name: reactData.editingForm.form_name || 'Untitled Form',
            })),
        }, true);
    };

    const saveForm = async () => {
        const editingForm = reactData.editingForm;

        if (!(editingForm.form_name || '').trim()) {
            updateReactData({ alert: { severity: 'error', message: 'Please enter a form name before saving.' } }, true);
            return;
        }

        updateReactData({ saving: true }, true);

        const finalForm = buildFormRecord(editingForm);

        await putDb({ TableName: 'Forms', Item: finalForm });

        if (directEditMode) {
            updateReactData({ saving: false, savedSnapshot: JSON.stringify(editingForm) }, true);
            onClose && onClose(true, finalForm);
            return;
        }

        updateReactData({ saving: false, view: 'list', editingForm: null }, true);
        await loadFormList();
        updateReactData({ alert: { severity: 'success', message: `"${finalForm.form_name}" saved.` } }, true);
    };

    // Writes the form like saveForm, but stays on the edit screen instead of exiting.
    const saveAndContinue = async () => {
        const editingForm = reactData.editingForm;

        if (!(editingForm.form_name || '').trim()) {
            updateReactData({ alert: { severity: 'error', message: 'Please enter a form name before saving.' } }, true);
            return;
        }

        updateReactData({ saving: true }, true);

        const finalForm = buildFormRecord(editingForm);

        await putDb({ TableName: 'Forms', Item: finalForm });

        updateReactData({
            saving: false,
            savedSnapshot: JSON.stringify(editingForm),
            alert: { severity: 'success', message: `"${finalForm.form_name}" saved.` },
        }, true);
    };

    const renderListView = () => (
        <React.Fragment>
            <DialogContent>
                {reactData.loading
                    ? <Box display='flex' justifyContent='center' p={4}><CircularProgress /></Box>
                    : (
                        <Box display='flex' flexDirection='column'>
                            {reactData.forms.length === 0 &&
                                <Typography style={AVATextStyle({ color: 'textSecondary' })}>
                                    {'No forms yet - use "+ New Form" to create one.'}
                                </Typography>
                            }
                            {reactData.forms.map((formRec) => (
                                <Paper
                                    key={formRec.form_id}
                                    variant='outlined'
                                    style={{ padding: '8px 16px', marginBottom: '8px', cursor: 'pointer' }}
                                    onClick={() => startEditingForm(formRec)}
                                >
                                    <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
                                        <Box display='flex' flexDirection='column'>
                                            <Typography style={AVATextStyle({ bold: true })}>{formRec.form_name || formRec.form_id}</Typography>
                                            <Typography style={AVATextStyle({ size: 0.85, color: 'textSecondary' })}>
                                                {formRec.category || 'No Category'}{formRec.active === false ? ' - Inactive' : ''}
                                            </Typography>
                                        </Box>
                                        <IconButton size='small' onClick={(e) => { e.stopPropagation(); startEditingForm(formRec); }}>
                                            <EditIcon fontSize='small' />
                                        </IconButton>
                                    </Box>
                                </Paper>
                            ))}
                        </Box>
                    )
                }
            </DialogContent>
            <DialogActions style={{ justifyContent: 'center' }}>
                <Button
                    className={AVAClass.AVAButton}
                    style={{ backgroundColor: 'red', color: 'white' }}
                    size='small'
                    startIcon={<CloseIcon fontSize='small' />}
                    onClick={() => onClose && onClose()}
                >
                    {'Done'}
                </Button>
                <Button
                    className={AVAClass.AVAButton}
                    variant='contained'
                    color='primary'
                    size='small'
                    startIcon={<AddIcon fontSize='small' />}
                    onClick={startNewForm}
                >
                    {'New Form'}
                </Button>
            </DialogActions>
        </React.Fragment>
    );

    const renderEditView = () => {
        const editingForm = reactData.editingForm;
        // Existing categories across every form for this client, offered as Autocomplete options -
        // freeSolo still lets the author type a brand-new category that isn't in the list yet.
        const existingCategories = [...new Set(
            (reactData.forms || []).map((f) => (f.category || '').trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));
        return (
            <React.Fragment>
                <Box px={3} pt={2}>
                    <Box display='flex' flexDirection='row' style={{ gap: '16px' }}>
                        <TextField
                            label='Form Name'
                            value={editingForm.form_name}
                            onChange={(e) => updateEditingForm({ form_name: e.target.value })}
                            style={{ flexGrow: 1 }}
                        />
                        <Autocomplete
                            freeSolo
                            options={existingCategories}
                            value={editingForm.category || ''}
                            inputValue={editingForm.category || ''}
                            onInputChange={(e, newValue) => updateEditingForm({ category: newValue })}
                            onChange={(e, newValue) => updateEditingForm({ category: newValue || '' })}
                            style={{ flexGrow: 1 }}
                            renderInput={(params) => <TextField {...params} label='Category' />}
                        />
                    </Box>
                    <Typography style={AVATextStyle({ size: 0.75, color: 'textSecondary', margin: { top: 1, bottom: 1 } })}>
                        {`Form ID: ${editingForm.form_id}`}
                    </Typography>
                </Box>
                <Divider />
                <DialogContent>
                    <Box display='flex' flexDirection='column'>
                        {editingForm.sections.map((section, sectionIdx) => (
                            <Paper key={section.key} variant='outlined' style={{ padding: '12px', marginTop: '16px' }}>
                                <Box display='flex' flexDirection='row' alignItems='center' style={{ gap: '8px' }}>
                                    <TextField
                                        label='Section Name'
                                        value={section.section_name}
                                        onChange={(e) => updateSection(sectionIdx, { section_name: e.target.value })}
                                        style={{ flexGrow: 1 }}
                                    />
                                    <IconButton
                                        size='small'
                                        onClick={() => removeSection(sectionIdx)}
                                        disabled={editingForm.sections.length <= 1}
                                    >
                                        <DeleteIcon fontSize='small' />
                                    </IconButton>
                                </Box>
                                <Box display='flex' flexDirection='row' alignItems='center' style={{ gap: '8px', marginTop: '8px' }}>
                                    <Button
                                        size='small'
                                        onClick={() => setConditionEditorTarget({ sectionIdx, fieldIdx: null })}
                                        style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                                    >
                                        {section.conditionType === 'show_if' ? 'Show if…' : section.conditionType === 'ignore_if' ? 'Ignore if…' : 'Conditional?'}
                                    </Button>
                                    {renderConditionSummary(section, getConditionFieldOptions(sectionIdx, null))}
                                </Box>

                                {section.fields.map((field, fieldIdx) => {
                                    const isDragSource = (dragFieldOrigin?.sectionIdx === sectionIdx) && (dragFieldOrigin?.fieldIdx === fieldIdx);
                                    const isDropTarget = !isDragSource
                                        && (dropTarget?.sectionIdx === sectionIdx) && (dropTarget?.fieldIdx === fieldIdx) && !dropTarget?.end;
                                    const requiredControl = field.type !== 'header' &&
                                        <FormControlLabel
                                            style={{ whiteSpace: 'nowrap', marginLeft: 0 }}
                                            control={
                                                <Checkbox
                                                    size='small'
                                                    checked={!!field.required}
                                                    onChange={(e) => {
                                                        const nextRequired = e.target.checked;
                                                        if (!usesSelectionCount(field.type)) {
                                                            updateField(sectionIdx, fieldIdx, { required: nextRequired });
                                                            return;
                                                        }
                                                        // required and min selections stay in sync for select types - required
                                                        // implies at least 1, and un-requiring drops min back to 0.
                                                        const nextMin = nextRequired ? Math.max(1, parseInt(field.selectMin, 10) || 0) : 0;
                                                        const currentMax = parseInt(field.selectMax, 10);
                                                        const changes = { required: nextRequired, selectMin: String(nextMin) };
                                                        if (!(Number.isFinite(currentMax) && currentMax >= nextMin)) {
                                                            changes.selectMax = String(nextMin || 1);
                                                        }
                                                        updateField(sectionIdx, fieldIdx, changes);
                                                    }}
                                                />
                                            }
                                            label='Required'
                                        />;
                                    return (
                                        <Box
                                            key={field.key}
                                            display='flex'
                                            flexDirection='row'
                                            alignItems='center'
                                            draggable={dragHandleKey === field.key}
                                            onDragStart={(e) => {
                                                e.dataTransfer.effectAllowed = 'move';
                                                e.dataTransfer.setData('text/plain', JSON.stringify({ sectionIdx, fieldIdx }));
                                                setDragFieldOrigin({ sectionIdx, fieldIdx });
                                                setDropTarget({ sectionIdx, fieldIdx });
                                            }}
                                            onDragEnd={() => {
                                                setDragFieldOrigin(null);
                                                setDropTarget(null);
                                                setDragHandleKey(null);
                                            }}
                                            onMouseUp={() => setDragHandleKey(null)}
                                            onDragOver={(e) => {
                                                e.preventDefault();
                                                if ((dropTarget?.sectionIdx !== sectionIdx) || (dropTarget?.fieldIdx !== fieldIdx) || dropTarget?.end) {
                                                    setDropTarget({ sectionIdx, fieldIdx });
                                                }
                                            }}
                                            onDragLeave={(e) => {
                                                if (!e.currentTarget.contains(e.relatedTarget)) { setDropTarget(null); }
                                            }}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setDropTarget(null);
                                                setDragFieldOrigin(null);
                                                let from = null;
                                                try { from = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (error) { from = null; }
                                                if (from) { moveField(from, { sectionIdx, fieldIdx }); }
                                            }}
                                            style={{
                                                marginTop: '12px',
                                                padding: '12px 16px',
                                                border: isDropTarget ? '2px dashed #1976d2' : '1px solid #ccc',
                                                borderRadius: '30px',
                                                backgroundColor: isDropTarget ? '#e3f2fd' : 'transparent',
                                                opacity: isDragSource ? 0.5 : 1,
                                            }}
                                        >
                                            <DragIndicatorIcon
                                                fontSize='small'
                                                style={{ color: '#999', marginRight: '4px', cursor: 'grab' }}
                                                onMouseDown={() => setDragHandleKey(field.key)}
                                            />
                                            <Box display='flex' flexDirection='column' style={{ flexGrow: 1, minWidth: 0 }}>
                                                <Box display='flex' flexDirection='row' alignItems='flex-start' style={{ gap: '16px' }}>
                                                    {field.dictionary_field_key &&
                                                        <Box display='flex' flexDirection='column' style={{ flexGrow: 1 }}>
                                                            <Typography style={AVATextStyle({ size: 0.7, color: 'textSecondary' })}>
                                                                {'Linked to Data Dictionary'}
                                                            </Typography>
                                                            <Typography style={AVATextStyle({ size: 0.95, bold: true })}>
                                                                {reactData.dictionaryFields.find((f) => f.field_key === field.dictionary_field_key)?.description
                                                                    || field.dictionary_field_key}
                                                            </Typography>
                                                        </Box>
                                                    }
                                                    {field.dictionary_field_key
                                                        ? <Box display='flex' flexDirection='column' style={{ minWidth: 160 }}>
                                                            <Typography style={AVATextStyle({ size: 0.7, color: 'textSecondary' })}>
                                                                {'Type (locked)'}
                                                            </Typography>
                                                            <Typography style={AVATextStyle({ size: 0.95 })}>
                                                                {FIELD_TYPES.find((t) => t.value === (isFamilyType(field.type) ? 'family' : field.type))?.label || field.type}
                                                            </Typography>
                                                        </Box>
                                                        : <FormControl style={{ minWidth: 160, flexGrow: 1 }}>
                                                            <InputLabel>{'Type'}</InputLabel>
                                                            <Select
                                                                value={isSelectType(field.type) ? 'select' : (isFamilyType(field.type) ? 'family' : field.type)}
                                                                onChange={(e) => updateField(sectionIdx, fieldIdx, { type: e.target.value })}
                                                            >
                                                                {FIELD_TYPES.map((t) => (
                                                                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                    }
                                                    {field.dictionary_field_key &&
                                                        <Button
                                                            size='small'
                                                            onClick={() => updateField(sectionIdx, fieldIdx, { dictionary_field_key: null })}
                                                            style={{ alignSelf: 'center', whiteSpace: 'nowrap' }}
                                                        >
                                                            {'Unlink'}
                                                        </Button>
                                                    }
                                                    {field.type !== 'text' && field.type !== 'numeric' && requiredControl}
                                                    {WIDTH_ADJUSTABLE_TYPES.includes(field.type) &&
                                                        <FormControl style={{ minWidth: 140 }}>
                                                            <InputLabel>{'Width'}</InputLabel>
                                                            <Select
                                                                value={field.promptWidth || ''}
                                                                onChange={(e) => updateField(sectionIdx, fieldIdx, { promptWidth: e.target.value })}
                                                            >
                                                                {WIDTH_PRESETS.map((w) => (
                                                                    <MenuItem key={w.value || 'default'} value={w.value}>{w.label}</MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                    }
                                                    {field.type === 'text' &&
                                                        <FormControl style={{ minWidth: 140 }}>
                                                            <InputLabel>{'Height'}</InputLabel>
                                                            <Select
                                                                value={field.promptRows || ''}
                                                                onChange={(e) => updateField(sectionIdx, fieldIdx, { promptRows: e.target.value })}
                                                            >
                                                                {HEIGHT_PRESETS.map((h) => (
                                                                    <MenuItem key={h.value || 'default'} value={h.value}>{h.label}</MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                    }
                                                    {(field.type === 'text' || field.type === 'numeric') && requiredControl}
                                                </Box>
                                                <TextField
                                                    label='Prompt'
                                                    value={field.prompt}
                                                    onChange={(e) => updateField(sectionIdx, fieldIdx, { prompt: e.target.value })}
                                                    multiline
                                                    fullWidth
                                                    style={{ marginTop: '20px' }}
                                                />
                                                {isSelectType(field.type) &&
                                                    <Box display='flex' flexDirection='column' style={{ marginTop: '20px', width: '60%', gap: '6px' }}>
                                                        <Typography style={AVATextStyle({ size: 0.8, color: 'textSecondary', margin: { bottom: 0 } })}>
                                                            {'Values to choose from:'}
                                                        </Typography>
                                                        {field.selectionList.map((value, valueIdx) => (
                                                            <TextField
                                                                key={valueIdx}
                                                                value={value}
                                                                onChange={(e) => updateSelectionValue(sectionIdx, fieldIdx, valueIdx, e.target.value)}
                                                                InputProps={{
                                                                    endAdornment: field.selectionList.length > 1 && (
                                                                        <InputAdornment position='end'>
                                                                            <IconButton
                                                                                size='small'
                                                                                edge='end'
                                                                                style={{ color: '#999' }}
                                                                                onClick={() => removeSelectionValue(sectionIdx, fieldIdx, valueIdx)}
                                                                            >
                                                                                <CloseIcon fontSize='small' />
                                                                            </IconButton>
                                                                        </InputAdornment>
                                                                    ),
                                                                }}
                                                            />
                                                        ))}
                                                        <Button
                                                            size='small'
                                                            startIcon={<AddIcon fontSize='small' />}
                                                            onClick={() => addSelectionValue(sectionIdx, fieldIdx)}
                                                            style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                                                        >
                                                            {'Add Value'}
                                                        </Button>
                                                        <Box display='flex' flexDirection='row' alignItems='center' style={{ marginTop: '0px', gap: '0px', flexWrap: 'wrap' }}>
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        size='small'
                                                                        checked={field.type === 'select&text'}
                                                                        onChange={(e) => updateField(sectionIdx, fieldIdx, { type: e.target.checked ? 'select&text' : 'select' })}
                                                                    />
                                                                }
                                                                label='Allow custom value (not in list)'
                                                            />
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        size='small'
                                                                        checked={!!field.column}
                                                                        onChange={(e) => updateField(sectionIdx, fieldIdx, { column: e.target.checked })}
                                                                    />
                                                                }
                                                                label='Stack values in a column (instead of a row)'
                                                            />
                                                        </Box>
                                                        <Box display='flex' flexDirection='row' alignItems='center' style={{ gap: '16px' }}>
                                                            <TextField
                                                                label='Min selections'
                                                                type='number'
                                                                value={field.selectMin}
                                                                onChange={(e) => handleSelectMinChange(sectionIdx, fieldIdx, field, e.target.value)}
                                                                inputProps={{ min: 0 }}
                                                                style={{ width: 130 }}
                                                            />
                                                            <TextField
                                                                label='Max selections'
                                                                type='number'
                                                                value={field.selectMax}
                                                                onChange={(e) => handleSelectMaxChange(sectionIdx, fieldIdx, field, e.target.value)}
                                                                inputProps={{ min: 1 }}
                                                                style={{ width: 130 }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                }
                                                {isFamilyType(field.type) &&
                                                    <Box display='flex' flexDirection='row' alignItems='center' style={{ marginTop: '20px' }}>
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    size='small'
                                                                    checked={field.type === 'family&guests'}
                                                                    onChange={(e) => updateField(sectionIdx, fieldIdx, { type: e.target.checked ? 'family&guests' : 'family' })}
                                                                />
                                                            }
                                                            label='Allow others? (Guests)'
                                                        />
                                                    </Box>
                                                }
                                                {field.type === 'numeric' &&
                                                    <Box display='flex' flexDirection='row' alignItems='center' style={{ marginTop: '20px', gap: '16px' }}>
                                                        <TextField
                                                            label='Minimum value'
                                                            type='number'
                                                            value={field.numericMin}
                                                            onChange={(e) => updateField(sectionIdx, fieldIdx, { numericMin: e.target.value })}
                                                            style={{ width: 180 }}
                                                        />
                                                        <TextField
                                                            label='Maximum value'
                                                            type='number'
                                                            value={field.numericMax}
                                                            onChange={(e) => updateField(sectionIdx, fieldIdx, { numericMax: e.target.value })}
                                                            style={{ width: 180 }}
                                                        />
                                                    </Box>
                                                }
                                                {field.type === 'select_event' &&
                                                    <Box display='flex' flexDirection='column' style={{ marginTop: '20px', width: '70%', gap: '6px' }}>
                                                        <Typography style={AVATextStyle({ size: 0.8, color: 'textSecondary', margin: { bottom: 0 } })}>
                                                            {'Event(s) to offer:'}
                                                        </Typography>
                                                        <FormControl>
                                                            <InputLabel>{'Events'}</InputLabel>
                                                            <Select
                                                                multiple
                                                                value={field.eventIds || []}
                                                                onChange={(e) => updateField(sectionIdx, fieldIdx, { eventIds: e.target.value })}
                                                                renderValue={(selected) => selected
                                                                    .map((id) => reactData.calendarEvents.find((ev) => ev.event_id === id)?.description || id)
                                                                    .join(', ')}
                                                                disabled={reactData.calendarEvents.length === 0}
                                                            >
                                                                {reactData.calendarEvents.map((ev) => (
                                                                    <MenuItem key={ev.event_id} value={ev.event_id}>
                                                                        <Checkbox size='small' checked={(field.eventIds || []).includes(ev.event_id)} />
                                                                        <Box display='flex' flexDirection='column'>
                                                                            <Typography style={AVATextStyle({ size: 0.95 })}>{ev.description}</Typography>
                                                                            {(ev.start_Date || ev.end_date) &&
                                                                                <Typography style={AVATextStyle({ size: 0.7, color: 'textSecondary' })}>
                                                                                    {formatNumericDateRange(ev.start_Date, ev.end_date)}
                                                                                </Typography>
                                                                            }
                                                                        </Box>
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                        {reactData.calendarEvents.length === 0 &&
                                                            <Typography style={AVATextStyle({ size: 0.75, color: 'textSecondary' })}>
                                                                {'No calendar events found for this client yet.'}
                                                            </Typography>
                                                        }
                                                        <TextField
                                                            label='Limit to next N occurrences (optional)'
                                                            type='number'
                                                            value={field.eventOccurrenceLimit}
                                                            onChange={(e) => updateField(sectionIdx, fieldIdx, { eventOccurrenceLimit: e.target.value })}
                                                            inputProps={{ min: 1 }}
                                                            helperText='Leave blank to show all upcoming occurrences (up to 20)'
                                                            style={{ width: 280 }}
                                                        />
                                                        {(() => {
                                                            // Moot if the form has no family/family&guests field to draw names from.
                                                            const familyFieldOptions = getConditionFieldOptions(sectionIdx, fieldIdx).filter((o) => isFamilyType(o.type));
                                                            if (!familyFieldOptions.length) { return null; }
                                                            return (
                                                                <React.Fragment>
                                                                    <FormControlLabel
                                                                        control={
                                                                            <Checkbox
                                                                                size='small'
                                                                                checked={!!field.familySignupField}
                                                                                onChange={(e) => updateField(sectionIdx, fieldIdx, {
                                                                                    familySignupField: e.target.checked
                                                                                        ? (familyFieldOptions.some((o) => o.field_name === field.familySignupField)
                                                                                            ? field.familySignupField
                                                                                            : familyFieldOptions[0].field_name)
                                                                                        : '',
                                                                                })}
                                                                            />
                                                                        }
                                                                        label='Automatically sign up family members and their guests?'
                                                                    />
                                                                    {field.familySignupField && (familyFieldOptions.length > 1) &&
                                                                        <FormControl style={{ marginTop: '4px' }}>
                                                                            <InputLabel>{'Which Family selection field will supply the names to automatically sign up?'}</InputLabel>
                                                                            <Select
                                                                                value={field.familySignupField}
                                                                                onChange={(e) => updateField(sectionIdx, fieldIdx, { familySignupField: e.target.value })}
                                                                            >
                                                                                {familyFieldOptions.map((o) => (
                                                                                    <MenuItem key={o.field_name} value={o.field_name}>{o.label}</MenuItem>
                                                                                ))}
                                                                            </Select>
                                                                        </FormControl>
                                                                    }
                                                                </React.Fragment>
                                                            );
                                                        })()}
                                                        <FormControlLabel
                                                            control={
                                                                <Checkbox
                                                                    size='small'
                                                                    checked={!!field.column}
                                                                    onChange={(e) => updateField(sectionIdx, fieldIdx, { column: e.target.checked })}
                                                                />
                                                            }
                                                            label='Stack occurrences in a column (instead of a row)'
                                                        />
                                                        <Box display='flex' flexDirection='row' alignItems='center' style={{ gap: '16px' }}>
                                                            <TextField
                                                                label='Min selections'
                                                                type='number'
                                                                value={field.selectMin}
                                                                onChange={(e) => handleSelectMinChange(sectionIdx, fieldIdx, field, e.target.value)}
                                                                inputProps={{ min: 0 }}
                                                                style={{ width: 130 }}
                                                            />
                                                            <TextField
                                                                label='Max selections'
                                                                type='number'
                                                                value={field.selectMax}
                                                                onChange={(e) => handleSelectMaxChange(sectionIdx, fieldIdx, field, e.target.value)}
                                                                inputProps={{ min: 1 }}
                                                                style={{ width: 130 }}
                                                            />
                                                        </Box>
                                                    </Box>
                                                }
                                                {field.type !== 'header' &&
                                                    <Box display='flex' flexDirection='row' alignItems='center' style={{ gap: '8px', marginTop: '12px', minWidth: 0 }}>
                                                        <Button
                                                            size='small'
                                                            onClick={() => setConditionEditorTarget({ sectionIdx, fieldIdx })}
                                                            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
                                                        >
                                                            {field.conditionType === 'show_if' ? 'Show if…' : field.conditionType === 'ignore_if' ? 'Ignore if…' : 'Conditional?'}
                                                        </Button>
                                                        {renderConditionSummary(field, getConditionFieldOptions(sectionIdx, fieldIdx))}
                                                    </Box>
                                                }
                                            </Box>
                                            <IconButton size='small' onClick={() => removeField(sectionIdx, fieldIdx)}>
                                                <DeleteIcon fontSize='small' />
                                            </IconButton>
                                        </Box>
                                    );
                                })}

                                <Box
                                    display='flex'
                                    flexDirection='row'
                                    alignItems='center'
                                    style={{
                                        gap: '12px',
                                        marginTop: '12px',
                                        padding: '6px 8px',
                                        flexWrap: 'wrap',
                                        borderRadius: '12px',
                                        border: (dropTarget?.sectionIdx === sectionIdx && dropTarget?.end) ? '2px dashed #1976d2' : '2px dashed transparent',
                                        backgroundColor: (dropTarget?.sectionIdx === sectionIdx && dropTarget?.end) ? '#e3f2fd' : 'transparent',
                                    }}
                                    onDragOver={(e) => {
                                        if (!dragFieldOrigin) { return; }
                                        e.preventDefault();
                                        if ((dropTarget?.sectionIdx !== sectionIdx) || !dropTarget?.end) {
                                            setDropTarget({ sectionIdx, end: true });
                                        }
                                    }}
                                    onDragLeave={(e) => {
                                        if (!e.currentTarget.contains(e.relatedTarget)) { setDropTarget(null); }
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDropTarget(null);
                                        setDragFieldOrigin(null);
                                        let from = null;
                                        try { from = JSON.parse(e.dataTransfer.getData('text/plain')); } catch (error) { from = null; }
                                        if (from) { moveField(from, { sectionIdx, end: true }); }
                                    }}
                                >
                                    <Button
                                        size='small'
                                        startIcon={<AddIcon fontSize='small' />}
                                        onClick={() => addField(sectionIdx)}
                                    >
                                        {'Add Item'}
                                    </Button>
                                    <FormControl style={{ minWidth: 240 }}>
                                        <Select
                                            displayEmpty
                                            value=''
                                            renderValue={() => '+ Add from Data Dictionary'}
                                            onChange={(e) => addFieldFromDictionary(sectionIdx, e.target.value)}
                                            disabled={reactData.dictionaryFields.length === 0}
                                        >
                                            {reactData.dictionaryFields.map((f) => (
                                                <MenuItem key={f.field_key} value={f.field_key}>{f.description || f.field_key}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Paper>
                        ))}

                        <Button
                            size='small'
                            startIcon={<AddIcon fontSize='small' />}
                            onClick={addSection}
                            style={{ marginTop: '16px', alignSelf: 'flex-start' }}
                        >
                            {'Add Section'}
                        </Button>
                    </Box>
                </DialogContent>
                <Divider />
                <DialogActions style={{ justifyContent: 'center' }}>
                    <Button
                        className={AVAClass.AVAButton}
                        size='small'
                        startIcon={<ArrowBackIcon fontSize='small' />}
                        onClick={requestExit}
                        disabled={reactData.saving}
                    >
                        {'Exit'}
                    </Button>
                    <Button
                        className={AVAClass.AVAButton}
                        size='small'
                        onClick={previewForm}
                        disabled={reactData.saving}
                    >
                        {'Preview'}
                    </Button>
                    <Button
                        className={AVAClass.AVAButton}
                        size='small'
                        onClick={saveAndContinue}
                        disabled={reactData.saving}
                    >
                        {reactData.saving ? <CircularProgress size={18} /> : 'Save and Continue'}
                    </Button>
                    <Button
                        className={AVAClass.AVAButton}
                        variant='contained'
                        color='primary'
                        size='small'
                        onClick={saveForm}
                        disabled={reactData.saving}
                    >
                        {reactData.saving ? <CircularProgress size={18} /> : 'Save Form'}
                    </Button>
                </DialogActions>
                {reactData.confirmExit &&
                    <AVAConfirm
                        promptText={['You have unsaved changes.', 'Are you sure you want to exit?']}
                        cancelText={'No, keep editing'}
                        confirmText={'Yes, discard changes'}
                        onCancel={() => updateReactData({ confirmExit: false }, true)}
                        onConfirm={() => { updateReactData({ confirmExit: false }, true); exitEditing(); }}
                    />
                }
            </React.Fragment>
        );
    };

    return (
        <Dialog
            open={true}
            onClose={() => ((reactData.view === 'edit') ? requestExit() : (onClose && onClose()))}
            maxWidth='md'
            PaperProps={{ style: { borderRadius: '30px' } }}
            fullWidth
        >
            <DialogTitle>{reactData.view === 'edit' ? ((directForm === 'new') ? 'New Form' : 'Edit Form') : 'Forms'}</DialogTitle>
            {reactData.view === 'edit' ? renderEditView() : renderListView()}
            {reactData.alert &&
                <Snackbar
                    open={!!reactData.alert}
                    autoHideDuration={4000}
                    onClose={() => updateReactData({ alert: false }, true)}
                >
                    <Alert severity={reactData.alert.severity} onClose={() => updateReactData({ alert: false }, true)}>
                        {reactData.alert.message}
                    </Alert>
                </Snackbar>
            }
            {reactData.previewFormRec &&
                <FormFillB
                    request={{
                        previewFormRec: reactData.previewFormRec,
                        mode: 'preview',
                        person_id: state.session.patient_id,
                    }}
                    onClose={() => updateReactData({ previewFormRec: null }, true)}
                />
            }
            {conditionEditorTarget && (() => {
                const { sectionIdx, fieldIdx } = conditionEditorTarget;
                const isSectionCondition = (fieldIdx === null || fieldIdx === undefined);
                const target = isSectionCondition
                    ? reactData.editingForm?.sections[sectionIdx]
                    : reactData.editingForm?.sections[sectionIdx]?.fields[fieldIdx];
                if (!target) { return null; }
                const applyChanges = (changes) => (
                    isSectionCondition ? updateSection(sectionIdx, changes) : updateField(sectionIdx, fieldIdx, changes)
                );
                const fieldOptions = getConditionFieldOptions(sectionIdx, isSectionCondition ? null : fieldIdx);
                const targetField = fieldOptions.find((f) => f.field_name === target.conditionField);
                const targetNoun = isSectionCondition ? 'section' : 'item';
                return (
                    <React.Fragment>
                        <Dialog open={true} onClose={() => setConditionEditorTarget(null)} maxWidth='sm' fullWidth>
                        <DialogTitle>{'Conditional Display'}</DialogTitle>
                        <DialogContent>
                            <Box display='flex' flexDirection='column' style={{ gap: '16px' }}>
                                <Box display='flex' flexDirection='row' style={{ gap: '16px' }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={target.conditionType === 'show_if'}
                                                onChange={(e) => applyChanges({ conditionType: e.target.checked ? 'show_if' : 'none' })}
                                            />
                                        }
                                        label={`Only show this ${targetNoun} when...`}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={target.conditionType === 'ignore_if'}
                                                onChange={(e) => applyChanges({ conditionType: e.target.checked ? 'ignore_if' : 'none' })}
                                            />
                                        }
                                        label={`Ignore this ${targetNoun} when...`}
                                    />
                                </Box>
                                {target.conditionType !== 'none' && isSectionCondition &&
                                    <FormControl fullWidth>
                                        <InputLabel>{'Test based on'}</InputLabel>
                                        <Select
                                            value={target.conditionKind || 'field'}
                                            onChange={(e) => applyChanges({ conditionKind: e.target.value, conditionField: '', conditionValues: [] })}
                                        >
                                            <MenuItem value='field'>{'Another item\'s value'}</MenuItem>
                                            <MenuItem value='audience'>{'Specific people, groups, or account types'}</MenuItem>
                                        </Select>
                                    </FormControl>
                                }
                                {target.conditionType !== 'none' && (target.conditionKind !== 'audience') &&
                                    <FormControl fullWidth>
                                        <InputLabel>{'Other item'}</InputLabel>
                                        <Select
                                            value={target.conditionField || ''}
                                            onChange={(e) => applyChanges({ conditionField: e.target.value, conditionValues: [] })}
                                        >
                                            {fieldOptions.map((f) => (
                                                <MenuItem key={f.field_name} value={f.field_name}>{f.label}</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                }
                                {target.conditionType !== 'none' && (target.conditionKind === 'audience') &&
                                    <Box display='flex' flexDirection='column' style={{ gap: '8px' }}>
                                        <Typography style={AVATextStyle({ size: 0.85, color: 'textSecondary' })}>
                                            {'...the current user is one of these people, in one of these groups, or holds one of these account types:'}
                                        </Typography>
                                        <Box display='flex' flexDirection='row' alignItems='center' style={{ gap: '12px' }}>
                                            <Button
                                                variant='outlined'
                                                size='small'
                                                onClick={() => {
                                                    const existingSelections = (target.conditionValues || []).map((v) => {
                                                        if (v.startsWith('group:')) { return { group_id: v.slice(6) }; }
                                                        if (v.startsWith('person:')) { return { person_id: v.slice(7) }; }
                                                        const specialValue = CONDITION_CLASS_VALUES.find((c) => c.person_id === `*${v}`);
                                                        return { person_id: `*${v}`, person_name: specialValue?.first || v };
                                                    });
                                                    updateReactData({
                                                        showConditionAudienceSearch: true,
                                                        groupInfo: null,
                                                        linkedPersonFilter: { raw: '', lower: '' },
                                                        selections: existingSelections,
                                                        special_values: CONDITION_CLASS_VALUES,
                                                    }, true);
                                                }}
                                            >
                                                {'Choose People / Groups / Account Types'}
                                            </Button>
                                            <Typography style={AVATextStyle({ size: 0.85, color: 'textSecondary' })}>
                                                {describeConditionAudience(target.conditionValues)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                }
                                {(target.conditionType !== 'none') && target.conditionField &&
                                    <Box display='flex' flexDirection='column' style={{ gap: '8px' }}>
                                        <Typography style={AVATextStyle({ size: 0.85, color: 'textSecondary' })}>
                                            {`...has ${(targetField?.type === 'yes/no' || isSelectType(targetField?.type)) ? 'one of these values' : 'a value in this list'}:`}
                                        </Typography>
                                        {targetField?.type === 'yes/no' &&
                                            <Box display='flex' flexDirection='row' style={{ gap: '16px' }}>
                                                {[{ label: 'Yes', value: 'true' }, { label: 'No', value: 'false' }].map((opt) => (
                                                    <FormControlLabel
                                                        key={opt.value}
                                                        control={
                                                            <Checkbox
                                                                checked={(target.conditionValues || []).includes(opt.value)}
                                                                onChange={(e) => {
                                                                    const current = target.conditionValues || [];
                                                                    const next = e.target.checked ? [...current, opt.value] : current.filter((v) => v !== opt.value);
                                                                    applyChanges({ conditionValues: next });
                                                                }}
                                                            />
                                                        }
                                                        label={opt.label}
                                                    />
                                                ))}
                                            </Box>
                                        }
                                        {isSelectType(targetField?.type) &&
                                            <Box display='flex' flexDirection='column'>
                                                {targetField.selectionList.filter((v) => (v || '').trim()).map((option) => (
                                                    <FormControlLabel
                                                        key={option}
                                                        control={
                                                            <Checkbox
                                                                checked={(target.conditionValues || []).includes(option)}
                                                                onChange={(e) => {
                                                                    const current = target.conditionValues || [];
                                                                    const next = e.target.checked ? [...current, option] : current.filter((v) => v !== option);
                                                                    applyChanges({ conditionValues: next });
                                                                }}
                                                            />
                                                        }
                                                        label={option}
                                                    />
                                                ))}
                                            </Box>
                                        }
                                        {targetField && targetField.type !== 'yes/no' && !isSelectType(targetField.type) &&
                                            <TextField
                                                key={`condition_values_${sectionIdx}_${fieldIdx ?? 'section'}_${target.conditionField}`}
                                                fullWidth
                                                multiline
                                                minRows={2}
                                                variant='outlined'
                                                placeholder='Enter each triggering value on its own line'
                                                defaultValue={(target.conditionValues || []).join('\n')}
                                                onBlur={(e) => applyChanges({
                                                    conditionValues: e.target.value.split('\n').map((v) => v.trim()).filter((v) => v),
                                                })}
                                            />
                                        }
                                    </Box>
                                }
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setConditionEditorTarget(null)}>{'Done'}</Button>
                        </DialogActions>
                        </Dialog>
                        {reactData.showConditionAudienceSearch &&
                            <QuickSearch
                                reactData={reactData}
                                updateReactData={updateReactData}
                                options={{
                                    title: 'Who Does This Apply To?',
                                    withGroups: true,
                                    showGroupList: true,
                                    showAll: true,
                                    pickAndGo: true,
                                    keepSelections: true,
                                    withSpecialValues: true,
                                    buttonText: {
                                        empty: 'Done (no restriction)',
                                        selected: 'Use These'
                                    }
                                }}
                                onClose={(selections) => {
                                    const cleanSelections = ([selections].flat()).filter((s) => s && (s.person_id || s.group_id));
                                    const mappedValues = cleanSelections.map((s) => {
                                        if (s.group_id) { return `group:${s.group_id}`; }
                                        if (s.person_id && s.person_id.startsWith('*')) { return s.person_id.slice(1); }
                                        return `person:${s.person_id}`;
                                    });
                                    updateReactData({
                                        showConditionAudienceSearch: false,
                                        selections: cleanSelections,
                                    }, true);
                                    applyChanges({ conditionValues: mappedValues });
                                }}
                            />
                        }
                    </React.Fragment>
                );
            })()}
        </Dialog>
    );
};
