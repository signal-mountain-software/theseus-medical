import React from 'react';

import useSession from '../../hooks/useSession';
import { dbClient, recordExists, cl, getDb, putDb, deepCopy, uuid, titleCase } from '../../util/AVAUtilities';
import { AVAclasses, AVATextStyle } from '../../util/AVAStyles';
import { getEventMasterList } from '../../util/AVACalendars';
import { isFormActive, findFormReferences, formHasReferences, softDeleteForm } from '../../util/AVAForms';
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
    Chip,
    Tooltip,
} from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import { Alert, Autocomplete } from '@material-ui/lab/';

import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import CloseIcon from '@material-ui/icons/Close';
import EditIcon from '@material-ui/icons/Edit';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';
import MailOutlineIcon from '@material-ui/icons/MailOutline';
import NotificationsNoneIcon from '@material-ui/icons/NotificationsNone';
import GroupIcon from '@material-ui/icons/Group';
import WarningIcon from '@material-ui/icons/Warning';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';
import ArrowUpwardIcon from '@material-ui/icons/ArrowUpward';
import ArrowDownwardIcon from '@material-ui/icons/ArrowDownward';

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
    { value: 'signature', label: 'Signature' },
    { value: 'upload', label: 'File Upload' },
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

// The three per-value stage-rule icons rendered beside each selectable value - see the
// "Per-value stage rules" block further down for the classify/serialize logic they drive.
const STAGE_RULE_ICON_DEFS = [
    { kind: 'on_complete_message', Icon: MailOutlineIcon, label: 'Message' },
    { kind: 'on_complete_notify', Icon: NotificationsNoneIcon, label: 'Notification' },
    { kind: 'on_complete_groups', Icon: GroupIcon, label: 'Groups' },
];

const LockedRuleTooltip = withStyles({
    tooltip: { maxWidth: 520, fontSize: 12, padding: '8px 12px' },
})(Tooltip);

const truncateJson = (obj, max = 400) => {
    let s;
    try { s = JSON.stringify(obj); } catch (e) { s = String(obj); }
    return (s && s.length > max) ? `${s.slice(0, max)}…` : s;
};

// Hover content for the "Existing rule requires IT edit" indicator - lists every locked rule
// (by stage + on_complete_<kind>[index] so IT can find it in the Forms record) with the
// specific reasons FormBuilder couldn't model it, plus a truncated copy of the raw rule.
const LockedRuleDetails = ({ ruleState, stageName, intro }) => {
    const entries = STAGE_RULE_ICON_DEFS.flatMap(({ kind, label }) => (
        (ruleState?.[kind]?.lockedDetails || []).map((d) => ({ kind, label, ...d }))
    ));
    return (
        <Box>
            {intro && <Typography style={{ fontSize: 12, marginBottom: 6 }}>{intro}</Typography>}
            {entries.map(({ kind, label, index, block, reasons }) => (
                <Box key={`${kind}-${index}`} style={{ marginBottom: 8 }}>
                    <Typography style={{ fontSize: 12, fontWeight: 'bold' }}>
                        {`${label} rule - ${stageName ? `stage "${stageName}", ` : ''}${kind}[${index}]`}
                    </Typography>
                    <ul style={{ margin: '2px 0 2px 16px', padding: 0 }}>
                        {reasons.map((r, rIdx) => <li key={rIdx}>{r}</li>)}
                    </ul>
                    <Typography style={{ fontSize: 11, fontFamily: 'monospace', opacity: 0.85, wordBreak: 'break-all' }}>
                        {truncateJson(block)}
                    </Typography>
                </Box>
            ))}
            <Typography style={{ fontSize: 11, fontStyle: 'italic' }}>
                {'FormBuilder leaves these rules untouched on save - edit them directly in the Forms record if they need to change.'}
            </Typography>
        </Box>
    );
};

// A short "The person this form is about" / "Group: Staff" label for a single recognized
// recipient/available_to entry - shared by the message and notify rule editors.
const describeRecipientValue = (entry, groupNameLookup) => {
    if (!entry) { return 'Not set'; }
    if (entry === 'pertains_to') { return 'The person this form is about'; }
    if (entry === 'primary_caregiver') { return 'The Primary Caregiver for the Person this form is about'; }
    if (entry === 'user') { return 'The logged-in staff member'; }
    if (entry.startsWith('group:')) { return `Group: ${groupNameLookup?.(entry.slice(6)) || entry.slice(6)}`; }
    if (entry.startsWith('person:')) { return `Person: ${entry.slice(7)}`; }
    if (entry === '*all') { return 'Everybody'; }
    if (entry === '*admin') { return 'Admin Accounts'; }
    if (entry === '*support') { return 'Support Staff'; }
    return entry;
};


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

// Every form implicitly has one more "stage" beyond its last real section: the whole form
// being complete. FormFillB's initializeFromFormDefinition always normalizes exactly this into
// formRec.stages (stripping out and re-appending it last - see that function's comments) so
// on_complete_message/on_complete_notify/on_complete_groups can be attached to "the form
// finished" itself, not just to one section's stage. This mirrors that same stage_name here so
// the editor can model it with the identical per-stage rule-icon machinery used everywhere else.
const COMPLETE_STAGE_NAME = 'complete';

// Returns stages with a COMPLETE_STAGE_NAME entry guaranteed present - preserving one that
// already exists (and whatever on_complete_* properties it carries) rather than ever touching
// it, only synthesizing a blank one if none is found yet (e.g. a form saved before this existed).
const ensureCompleteStage = (stages) => (
    stages.some((stage) => stage.stage_name === COMPLETE_STAGE_NAME)
        ? stages
        : [...stages, { stage_name: COMPLETE_STAGE_NAME }]
);

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
        stages: ensureCompleteStage([{ stage_name }]),
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
        confirmClone: false,
        selectedFormId: null,
        saving: false,
        previewFormRec: null, // set while the Preview overlay (FormFillB) is open
        showConditionAudienceSearch: false, // true while QuickSearch is open, picking a condition's person/group/class audience
        messageTemplates: [], // lazily loaded on first use by a message/notify rule editor
        messageTemplatesLoaded: false,
        showRuleRecipientSearch: false, // true while QuickSearch is open, picking a single group or person for a message/notify rule's recipient
        showRuleGroupsSearch: null, // 'add' | 'remove' | null - which groups list a groups-rule QuickSearch picker is editing
        alert: false,
        editingIsStored: false, // false while editing a brand-new form that has never been saved
        deleteCheck: null, // null | { checking } | { refs, blocked } - drives the Delete dialogs
        deleteTypedName: '',
        deleting: false,
    });
    // A counter (not a boolean) - a boolean toggle would cancel itself out when `force` is
    // invoked twice in the same event/batch (e.g. Autocomplete fires both onChange and
    // onInputChange for a single select/clear), silently leaving React with nothing to re-render.
    // Only the setter is used - the count itself has no meaning outside forcing a re-render.
    const [, setRefreshTrigger] = React.useState(0);
    const pendingFormFocusRef = React.useRef(null);
    const focusClonedForm = (element) => {
        if (element && pendingFormFocusRef.current === reactData.selectedFormId) {
            pendingFormFocusRef.current = null;
            requestAnimationFrame(() => {
                if (element.isConnected) {
                    element.focus();
                    element.scrollIntoView({ block: 'nearest' });
                }
            });
        }
    };
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

    // Which sections are collapsed (showing only their name + icon cluster) - pure UI state, keyed
    // by section.key so it survives reordering (moveSection below) without needing remapping.
    const [collapsedSections, setCollapsedSections] = React.useState(new Set());
    const toggleSectionCollapsed = (sectionKey) => {
        const next = new Set(collapsedSections);
        if (next.has(sectionKey)) { next.delete(sectionKey); } else { next.add(sectionKey); }
        setCollapsedSections(next);
    };

    // Which field's "Conditional Display" popup is open, if any.
    const [conditionEditorTarget, setConditionEditorTarget] = React.useState(null); // { sectionIdx, fieldIdx } - fieldIdx null means a section-level condition

    // Which value's message/notify/groups rule popup is open, if any - see the "Per-value stage
    // rules" block below for classifyFieldStageRules/buildFieldStageRuleOutput.
    const [ruleEditorTarget, setRuleEditorTarget] = React.useState(null); // { sectionIdx, fieldIdx, value, kind }
    // The rule editor's working copy, seeded (see both icons' onClick below) from the existing
    // rule - or a blank defaultEditForKind(kind) - the moment the dialog opens. Every edit made
    // while the dialog is open only updates this draft; nothing is written back into
    // editingForm's stage array until the Save button (see the Rule Editor dialog body) is
    // clicked. This is what lets Exit (the button, backdrop click, or Escape) and "Remove Rule"
    // have the unambiguous meaning their names imply, instead of every keystroke already having
    // half-committed a change you might then tap away from.
    const [ruleEditorDraft, setRuleEditorDraft] = React.useState(null);
    // Transient UI-only toggle for the open rule editor's content source - deliberately NOT part
    // of the persisted edit (template_id/text must never both be set, including transiently as ''
    // - see the Rule Editor dialog body for why this stays separate from currentEdit).
    const [ruleContentMode, setRuleContentMode] = React.useState('text'); // 'text' | 'template'

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

    // Loads the client's MessageTemplates (lazily, the first time a message/notify rule editor
    // needs the template picker) so an author can pick one by name instead of typing a template_id.
    const loadMessageTemplatesIfNeeded = async () => {
        if (reactData.messageTemplatesLoaded) { return; }
        let items = [];
        let lastKey;
        do {
            const result = await dbClient.query({
                TableName: 'MessageTemplates',
                KeyConditionExpression: 'client_id = :c',
                ExpressionAttributeValues: { ':c': client_id },
                ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
            }).promise().catch((error) => {
                cl(`Error reading MessageTemplates in FormBuilder: ${error}`);
                return { Items: [] };
            });
            items = items.concat(result.Items || []);
            lastKey = result.LastEvaluatedKey;
        } while (lastKey);
        items.sort((a, b) => (a.template_name || a.template_id || '').localeCompare(b.template_name || b.template_id || ''));
        updateReactData({ messageTemplates: items, messageTemplatesLoaded: true }, true);
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
            active: isFormActive(cloned),
            sections: resolvedSections,
            stages: ensureCompleteStage(stages),
        };
        updateReactData({
            view: 'edit',
            editingForm: loadedForm,
            savedSnapshot: JSON.stringify(loadedForm),
            editingIsStored: true,
            loading: false,
        }, true);
    };

    const startNewForm = () => {
        const newForm = blankForm(client_id);
        updateReactData({
            view: 'edit',
            editingForm: newForm,
            savedSnapshot: JSON.stringify(newForm),
            editingIsStored: false,
        }, true);
    };

    // Clones a form as a raw DB duplicate - a direct deepCopy of the stored Forms item (sections,
    // fields, stages, options, and anything else FormBuilder's editor doesn't explicitly model),
    // not a round-trip through startEditingForm/buildFormRecord's reconstruction. form_id is
    // regenerated (it's the table's key, so it must be unique) and form_name is prefixed; every
    // other attribute is carried over untouched. Returns to the owning list and focuses the clone.
    const cloneForm = async (formRec) => {
        updateReactData({ loading: true }, true);
        const cloned = deepCopy(formRec);
        cloned.form_id = `form_${uuid(12)}`;
        cloned.form_name = `Copy of ${formRec.form_name || formRec.form_id}`;
        try {
            // putDb logs and swallows write failures, so use the client to verify clone creation.
            await dbClient.put({ TableName: 'Forms', Item: cloned }).promise();
        } catch (error) {
            cl(`Error cloning form in FormBuilder: ${error}`);
            updateReactData({
                loading: false,
                saving: false,
                alert: { severity: 'error', message: 'Could not clone this form. Please try again.' },
            }, true);
            return;
        }
        if (directEditMode) {
            onClose && onClose(true, cloned, { focusForm: true });
            return;
        }
        await loadFormList(false);
        const forms = reactData.forms.filter(form => form.form_id !== cloned.form_id).concat(cloned);
        forms.sort((a, b) => (a.form_name || '').localeCompare(b.form_name || ''));
        pendingFormFocusRef.current = cloned.form_id;
        updateReactData({
            forms,
            view: 'list',
            editingForm: null,
            selectedFormId: cloned.form_id,
            loading: false,
            saving: false,
            alert: { severity: 'success', message: `Cloned as "${cloned.form_name}"` },
        }, true);
    };

    // Clone button for the edit view (reachable from directEditMode, where the list view - and
    // its own Clone icon - never renders). Re-fetches the raw, currently-SAVED record by form_id
    // rather than cloning reactData.editingForm directly, so the clone is a true DB copy and isn't
    // subject to buildFormRecord's reconstruction; if there are unsaved changes here, they are
    // deliberately NOT included; requestClone confirms before discarding them.
    const cloneCurrentForm = async () => {
        const form_id = reactData.editingForm?.form_id;
        if (!form_id) { return; }
        updateReactData({ saving: true }, true);
        const rawRec = await getDb({ Key: { client_id, form_id }, TableName: 'Forms' }).catch((error) => {
            cl(`Error reading form to clone in FormBuilder: ${error}`);
            return null;
        });
        if (!rawRec) {
            updateReactData({
                saving: false,
                alert: { severity: 'error', message: 'Could not find a saved version of this form to clone - save it first.' },
            }, true);
            return;
        }
        await cloneForm(rawRec);
    };

    // True once editingForm has diverged from the last loaded/saved snapshot.
    const hasUnsavedChanges = () => JSON.stringify(reactData.editingForm) !== reactData.savedSnapshot;

    const requestClone = () => {
        if (hasUnsavedChanges()) {
            updateReactData({ confirmClone: true }, true);
            return;
        }
        cloneCurrentForm();
    };

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

    const canDeleteForms = ['admin', 'support', 'master'].includes(state.user?.account_class);

    // Step 1 of Delete: check every place that could still use this form. The dialog that
    // follows either explains what blocks the delete or asks for the typed-name confirmation.
    const requestDelete = async () => {
        const { form_id } = reactData.editingForm;
        updateReactData({ deleteCheck: { checking: true }, deleteTypedName: '' }, true);
        const refs = await findFormReferences({ client_id, form_id })
            .catch((error) => ({ documentCount: 0, groups: [], events: [], menus: [], errors: [`${error.message || error}`] }));
        updateReactData({ deleteCheck: { refs, blocked: formHasReferences(refs) } }, true);
    };

    const cancelDelete = () => {
        updateReactData({ deleteCheck: null, deleteTypedName: '', deleting: false }, true);
    };

    // Step 2: re-check references right before writing (something may have started using the
    // form while the dialog was open), then move the stored record to the deleted-forms area.
    const confirmDelete = async () => {
        const { form_id, form_name } = reactData.editingForm;
        updateReactData({ deleting: true }, true);
        const refs = await findFormReferences({ client_id, form_id })
            .catch((error) => ({ documentCount: 0, groups: [], events: [], menus: [], errors: [`${error.message || error}`] }));
        if (formHasReferences(refs)) {
            updateReactData({ deleting: false, deleteCheck: { refs, blocked: true } }, true);
            return;
        }
        let archived;
        try {
            archived = await softDeleteForm({ client_id, form_id, deleted_by: state.session.user_id });
        }
        catch (error) {
            cl(`Error deleting form ${form_id}: ${error}`);
            updateReactData({
                deleting: false,
                alert: { severity: 'error', message: `"${form_name}" was NOT deleted: ${error.message || error}` },
            }, true);
            return;
        }
        updateReactData({ deleting: false, deleteCheck: null, deleteTypedName: '' }, true);
        if (directEditMode) {
            onClose && onClose(true, Object.assign({}, archived, { client_id }), { deleted: true });
            return;
        }
        updateReactData({ view: 'list', editingForm: null }, true);
        await loadFormList();
        updateReactData({ alert: { severity: 'success', message: `"${form_name}" deleted.` } }, true);
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

    // Updates one stage's attributes by stage_name (e.g. its on_complete_message/
    // on_complete_groups/on_complete_notify arrays) - a `changes` value of `undefined` deletes
    // that key entirely (buildFieldStageRuleOutput returns undefined when nothing remains for a
    // kind - we never want to persist an explicit `on_complete_groups: undefined`).
    const updateStage = (stage_name, changes) => {
        const stages = (reactData.editingForm.stages || []).map((stage) => {
            if (stage.stage_name !== stage_name) { return stage; }
            const next = Object.assign({}, stage);
            Object.entries(changes).forEach(([key, value]) => {
                if (value === undefined) { delete next[key]; }
                else { next[key] = value; }
            });
            return next;
        });
        updateEditingForm({ stages });
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

    // Moves a section up (-1) or down (+1) in display order. The stages array is reordered to
    // match - FormFillB's forward-progression logic (validateForm walking formStages to find the
    // first stage with an error) assumes stage order mirrors section order, so reordering sections
    // without also reordering stages would silently break stage progress for any form that relies
    // on it. Any stage not referenced by a section (shouldn't normally happen under FormBuilder's
    // one-stage-per-section model, but defensive) is left in its original relative position,
    // appended after the ones that are.
    const moveSection = (sectionIdx, direction) => {
        const sections = reactData.editingForm.sections;
        const targetIdx = sectionIdx + direction;
        if ((targetIdx < 0) || (targetIdx >= sections.length)) { return; }
        const newSections = [...sections];
        const [moved] = newSections.splice(sectionIdx, 1);
        newSections.splice(targetIdx, 0, moved);

        const stages = reactData.editingForm.stages || [];
        const stageByName = Object.fromEntries(stages.map((s) => [s.stage_name, s]));
        const seen = new Set();
        const orderedStageNames = [];
        newSections.forEach((s) => {
            if (s.belongs_to_stage && !seen.has(s.belongs_to_stage)) {
                seen.add(s.belongs_to_stage);
                orderedStageNames.push(s.belongs_to_stage);
            }
        });
        const newStages = [
            ...orderedStageNames.map((name) => stageByName[name]).filter(Boolean),
            ...stages.filter((s) => !seen.has(s.stage_name)),
        ];
        updateEditingForm({ sections: newSections, stages: newStages });
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

    // ---------------------------------------------------------------------------------------
    // Per-value stage rules (on_complete_message / on_complete_groups / on_complete_notify)
    //
    // FormBuilder renders one small icon per selectable value of a select/select&text/select_event
    // field (message/notify/groups), each editable via a popup, mapping to a single showIf-gated
    // instruction block - { showIf: [{ field: field_name, values: [value] }], ... } - appended to
    // the owning stage's on_complete_<kind> array (see FormFillB.js for how those arrays are
    // consumed at save time; nothing there needs to change for this).
    //
    // Recognition is purely structural and re-evaluated fresh every time the form loads - there is
    // deliberately no persisted tag/flag marking a block as "FormBuilder-owned". A block is
    // editable via the icon/popup UI if and only if it matches the exact shape FormBuilder itself
    // would generate (classify*Rule below); anything else - including something a human wrote by
    // hand - is left completely untouched on save and surfaced as a locked "Existing rule requires
    // IT edit" indicator instead. This means a human can "promote" a hand-written rule to
    // FormBuilder-editable just by writing it in the recognized shape, and FormBuilder can never
    // silently reinterpret or clobber something it doesn't fully understand.
    // ---------------------------------------------------------------------------------------

    const STAGE_RULE_KINDS = ['on_complete_groups', 'on_complete_message', 'on_complete_notify'];

    // Keys each kind's recognized shape is allowed to use - an instruction block carrying any
    // other key is treated as not-simple, however its showIf/add/remove/etc. look otherwise.
    const STAGE_RULE_RECOGNIZED_KEYS = {
        on_complete_groups: ['showIf', 'add', 'remove'],
        on_complete_message: ['showIf', 'template_id', 'text', 'subject', 'recipientList'],
        on_complete_notify: ['showIf', 'template_id', 'text', 'title', 'available_to', 'options'],
    };

    // on_complete_notify's 'options' is Object.assign'd directly into the Notifications record by
    // FormFillB - FormBuilder's popup only models this small subset as first-class controls, so an
    // options object carrying any other key (or a nested object value) isn't recognized.
    const STAGE_RULE_RECOGNIZED_NOTIFY_OPTION_KEYS = ['priority', 'dismissible', 'persist_until_dismissed', 'play_sound', 'action_url', 'resolution'];

    // 'pertains_to'/'user'/'primary_caregiver' are FormFillB special values (resolved to
    // person:<id> at send time); person:<id>/group:<id> are the normal explicit forms - shared by
    // on_complete_message's recipientList and on_complete_notify's available_to.
    const isRecognizedRecipientValue = (entry) => (
        entry === 'pertains_to' || entry === 'user' || entry === 'primary_caregiver' || (typeof entry === 'string' && (entry.startsWith('person:') || entry.startsWith('group:')))
    );
    // available_to additionally accepts the broadcast/class values - recipientList has no
    // equivalent (on_complete_message has no "everybody"/"all admins" concept today).
    const isRecognizedAvailableToValue = (entry) => (
        isRecognizedRecipientValue(entry) || entry === '*all' || entry === '*admin' || entry === '*support'
    );

    // Strips classifyFieldStageRules/classifyUnconditionalStageRules' bookkeeping-only keys
    // (the original array `index`, and the `value` a field-scoped match fired on) off a
    // classified rule, leaving just the editable descriptor serializeStageRule expects back.
    const stripHelperKeys = (e) => {
        const { index, value: _v, ...rest } = e;
        return rest;
    };

    // The blank editable descriptor for a brand-new (not-yet-existing) rule of this kind - used
    // both to seed the rule editor's draft when opening on a value/section with no existing rule,
    // and as a fallback shape if the draft is somehow unset.
    const defaultEditForKind = (kind) => (
        (kind === 'on_complete_groups')
            ? { add: [], remove: [] }
            : (kind === 'on_complete_message')
                ? { template_id: null, text: '', subject: '', recipientList: ['pertains_to'] }
                : { template_id: null, text: '', title: '', available_to: ['pertains_to'], options: {} }
    );

    // A "simple" showIf is exactly one test, a plain {field, values} test (not currentUser_audience/
    // memberOf/pertainsTo_memberOf), for the field FormBuilder is rendering icons for, matching
    // exactly one of that field's known values. Two or more tests (effectively an OR condition),
    // an ignoreIf, an audience/group test, or a test matching more than one value all fall outside
    // what the per-value icon UI models and return null ("not simple").
    const parseSimpleFieldShowIf = (block, field_name, validValues) => {
        if (!block || block.ignoreIf || !Array.isArray(block.showIf) || block.showIf.length !== 1) { return null; }
        const test = block.showIf[0];
        if (!test || typeof test !== 'object') { return null; }
        if (test.currentUser_audience || test.pertainsTo_memberOf || test.memberOf) { return null; }
        if (test.field !== field_name) { return null; }
        const values = Array.isArray(test.values) ? test.values : (test.values !== undefined ? [test.values] : []);
        if (values.length !== 1 || !validValues.includes(values[0])) { return null; }
        return { value: values[0] };
    };

    const hasOnlyRecognizedKeys = (block, kind) => (
        Object.keys(block).every((k) => STAGE_RULE_RECOGNIZED_KEYS[kind].includes(k))
    );

    // template_id XOR text - shared by on_complete_message/on_complete_notify.
    const hasRecognizedTemplateOrText = (block) => (!!block.template_id !== !!block.text);

    // An "unconditional" gate is simply the absence of showIf/ignoreIf entirely - the instruction
    // always applies when this stage completes/changes, regardless of any field's value. This is
    // what lets a rule be associated with a whole section instead of one of its fields' values -
    // see classifyUnconditionalStageRules below.
    const parseUnconditionalGate = (block) => ((!block.showIf && !block.ignoreIf) ? {} : null);

    // Each classify*Rule below is the field-value-scoped entry point (used by
    // classifyFieldStageRules); classifyUnconditional*Rule is the section-scoped counterpart
    // (used by classifyUnconditionalStageRules) - both share the same *RuleCore so "is this
    // instruction shaped the way this editor models it" is defined exactly once per kind. gateResult
    // is {} for an unconditional match, {value} for a field-value match, or null if the gate itself
    // didn't match (wrong field, wrong value count, ignoreIf present, etc.).
    const classifyGroupsRuleCore = (block, gateResult) => {
        if (!gateResult || !hasOnlyRecognizedKeys(block, 'on_complete_groups')) { return null; }
        const isStringArrayOrAbsent = (v) => (v === undefined) || (Array.isArray(v) && v.every((g) => typeof g === 'string'));
        if (!isStringArrayOrAbsent(block.add) || !isStringArrayOrAbsent(block.remove)) { return null; }
        return { ...gateResult, add: block.add || [], remove: block.remove || [] };
    };
    const classifyGroupsRule = (block, field_name, validValues) => (
        classifyGroupsRuleCore(block, parseSimpleFieldShowIf(block, field_name, validValues))
    );
    const classifyUnconditionalGroupsRule = (block) => classifyGroupsRuleCore(block, parseUnconditionalGate(block));

    // `requireContent` (default true) gates the non-blank template_id/text requirement. It's
    // turned off only when buildFieldStageRuleOutput/buildUnconditionalStageRuleOutput need to
    // find "the single existing block FormBuilder itself wrote for this slot" so they can
    // replace it in place - otherwise, every keystroke typed into an optional field (e.g.
    // Subject/Title) before any Text/template was entered left its predecessor behind as an
    // orphaned, permanently-unrecognized block instead of being replaced by it. Everything
    // read-only (icon "configured" state, locked counts, the editor's prefilled values) keeps
    // using the default strict (content-required) behavior.
    const classifyMessageRuleCore = (block, gateResult, { requireContent = true } = {}) => {
        if (!gateResult || !hasOnlyRecognizedKeys(block, 'on_complete_message')) { return null; }
        if (requireContent && !hasRecognizedTemplateOrText(block)) { return null; }
        if (block.subject !== undefined && typeof block.subject !== 'string') { return null; }
        if (block.recipientList !== undefined && (!Array.isArray(block.recipientList) || !block.recipientList.every(isRecognizedRecipientValue))) { return null; }
        return {
            ...gateResult,
            template_id: block.template_id || null,
            text: block.text || '',
            subject: block.subject || '',
            recipientList: block.recipientList || ['pertains_to'],
        };
    };
    const classifyMessageRule = (block, field_name, validValues, opts) => (
        classifyMessageRuleCore(block, parseSimpleFieldShowIf(block, field_name, validValues), opts)
    );
    const classifyUnconditionalMessageRule = (block, opts) => classifyMessageRuleCore(block, parseUnconditionalGate(block), opts);

    // An explicit notification_id is deliberately NOT part of the recognized key set -
    // FormBuilder's popup never sets one, so its presence signals a hand-authored choice (e.g. a
    // custom dedup key) FormBuilder shouldn't silently take over.
    const classifyNotifyRuleCore = (block, gateResult, { requireContent = true } = {}) => {
        if (!gateResult || !hasOnlyRecognizedKeys(block, 'on_complete_notify')) { return null; }
        if (requireContent && !hasRecognizedTemplateOrText(block)) { return null; }
        if (block.title !== undefined && typeof block.title !== 'string') { return null; }
        if (block.available_to !== undefined && (!Array.isArray(block.available_to) || !block.available_to.every(isRecognizedAvailableToValue))) { return null; }
        if (block.options !== undefined) {
            if (typeof block.options !== 'object' || Array.isArray(block.options) || block.options === null) { return null; }
            const optionKeys = Object.keys(block.options);
            if (!optionKeys.every((k) => STAGE_RULE_RECOGNIZED_NOTIFY_OPTION_KEYS.includes(k))) { return null; }
            if (optionKeys.some((k) => typeof block.options[k] === 'object' && block.options[k] !== null)) { return null; }
        }
        return {
            ...gateResult,
            template_id: block.template_id || null,
            text: block.text || '',
            title: block.title || '',
            available_to: block.available_to || ['pertains_to'],
            options: block.options || {},
        };
    };
    const classifyNotifyRule = (block, field_name, validValues, opts) => (
        classifyNotifyRuleCore(block, parseSimpleFieldShowIf(block, field_name, validValues), opts)
    );
    const classifyUnconditionalNotifyRule = (block, opts) => classifyNotifyRuleCore(block, parseUnconditionalGate(block), opts);

    const STAGE_RULE_CLASSIFIERS = {
        on_complete_groups: classifyGroupsRule,
        on_complete_message: classifyMessageRule,
        on_complete_notify: classifyNotifyRule,
    };

    const STAGE_RULE_UNCONDITIONAL_CLASSIFIERS = {
        on_complete_groups: classifyUnconditionalGroupsRule,
        on_complete_message: classifyUnconditionalMessageRule,
        on_complete_notify: classifyUnconditionalNotifyRule,
    };

    // Human-readable reasons a block was rejected by classify*Rule above - mirrors those checks
    // (same recognized key/value sets) so the locked indicator's tooltip can say exactly what
    // FormBuilder didn't understand. field_name null means the block was evaluated as an
    // unconditional (section/complete-level) rule.
    const explainLockedStageRule = (kind, block, { field_name = null, validValues = [], duplicate = false } = {}) => {
        const reasons = [];
        if (!block || typeof block !== 'object' || Array.isArray(block)) {
            return ['Rule is not an object'];
        }
        const quote = (v) => JSON.stringify(v);
        if (duplicate) {
            reasons.push('Another unconditional rule of this kind already exists in this stage - FormBuilder models only one per kind');
        }
        if (field_name) {
            if (block.ignoreIf) { reasons.push('Uses an "ignoreIf" condition - FormBuilder only models a single "showIf" test'); }
            if (block.showIf !== undefined && !Array.isArray(block.showIf)) {
                reasons.push('"showIf" is not a list');
            }
            else if (Array.isArray(block.showIf)) {
                if (block.showIf.length === 0) { reasons.push('"showIf" is empty'); }
                if (block.showIf.length > 1) {
                    reasons.push(`Has ${block.showIf.length} "showIf" tests (an OR condition) - FormBuilder models exactly one`);
                }
                block.showIf.forEach((test, tIdx) => {
                    const prefix = (block.showIf.length > 1) ? `showIf test #${tIdx + 1}: ` : '';
                    if (!test || typeof test !== 'object') { reasons.push(`${prefix}test is not an object`); return; }
                    if (test.currentUser_audience) { reasons.push(`${prefix}tests the current user's audience`); }
                    if (test.memberOf) { reasons.push(`${prefix}tests group membership (memberOf)`); }
                    if (test.pertainsTo_memberOf) { reasons.push(`${prefix}tests the subject's group membership (pertainsTo_memberOf)`); }
                    if (test.field !== field_name) {
                        reasons.push(`${prefix}tests field ${quote(test.field)} instead of ${quote(field_name)}`);
                        return;
                    }
                    const values = Array.isArray(test.values) ? test.values : (test.values !== undefined ? [test.values] : []);
                    if (values.length === 0) { reasons.push(`${prefix}has no "values" to match`); }
                    if (values.length > 1) {
                        reasons.push(`${prefix}fires on ${values.length} values (${values.map(quote).join(', ')}) - FormBuilder models one value per rule`);
                    }
                    const unknown = values.filter((v) => !validValues.includes(v));
                    if (unknown.length) {
                        reasons.push(`${prefix}matches ${unknown.map(quote).join(', ')}, which ${unknown.length > 1 ? 'are not' : 'is not'} one of this Item's current choices`);
                    }
                });
            }
        }
        const extraKeys = Object.keys(block).filter((k) => !STAGE_RULE_RECOGNIZED_KEYS[kind].includes(k));
        if (extraKeys.length) {
            reasons.push(`Uses key(s) FormBuilder doesn't model: ${extraKeys.map(quote).join(', ')}`);
        }
        if (kind === 'on_complete_groups') {
            ['add', 'remove'].forEach((k) => {
                const v = block[k];
                if (v !== undefined && !(Array.isArray(v) && v.every((g) => typeof g === 'string'))) {
                    reasons.push(`"${k}" must be a list of group IDs`);
                }
            });
        }
        else {
            if (block.template_id && block.text) { reasons.push('Has both "template_id" and "text" - FormBuilder uses one or the other'); }
            if (!block.template_id && !block.text) { reasons.push('Has neither "template_id" nor "text"'); }
            const textKey = (kind === 'on_complete_message') ? 'subject' : 'title';
            if (block[textKey] !== undefined && typeof block[textKey] !== 'string') {
                reasons.push(`"${textKey}" is not plain text`);
            }
            const recipKey = (kind === 'on_complete_message') ? 'recipientList' : 'available_to';
            const recipCheck = (kind === 'on_complete_message') ? isRecognizedRecipientValue : isRecognizedAvailableToValue;
            const recip = block[recipKey];
            if (recip !== undefined) {
                if (!Array.isArray(recip)) { reasons.push(`"${recipKey}" is not a list`); }
                else {
                    const bad = recip.filter((r) => !recipCheck(r));
                    if (bad.length) { reasons.push(`"${recipKey}" has unrecognized entr${bad.length > 1 ? 'ies' : 'y'}: ${bad.map(quote).join(', ')}`); }
                }
            }
            if (kind === 'on_complete_notify' && block.options !== undefined) {
                if (typeof block.options !== 'object' || Array.isArray(block.options) || block.options === null) {
                    reasons.push('"options" is not an object');
                }
                else {
                    const badOpt = Object.keys(block.options).filter((k) => !STAGE_RULE_RECOGNIZED_NOTIFY_OPTION_KEYS.includes(k));
                    if (badOpt.length) { reasons.push(`"options" has unsupported key(s): ${badOpt.map(quote).join(', ')}`); }
                    const nested = Object.keys(block.options).filter((k) => typeof block.options[k] === 'object' && block.options[k] !== null);
                    if (nested.length) { reasons.push(`"options" has nested value(s) in: ${nested.map(quote).join(', ')}`); }
                }
            }
        }
        if (!reasons.length) { reasons.push('Rule shape not recognized'); }
        return reasons;
    };

    // Scans one stage's on_complete_<kind> array for instructions that test field_name, split into
    // byValue (recognized - keyed by the value they fire on, each carrying its original array
    // index for buildFieldStageRuleOutput below) and lockedCount (instructions that mention this
    // field but aren't in a shape FormBuilder models - the icon UI shows these as locked).
    // Instructions unrelated to field_name entirely are skipped, not counted either way.
    const classifyFieldStageRules = ({ stageDef, field_name, validValues }) => {
        const result = {};
        for (const kind of STAGE_RULE_KINDS) {
            const instructionList = [stageDef?.[kind]].flat().filter(Boolean);
            const classifier = STAGE_RULE_CLASSIFIERS[kind];
            const byValue = {};
            let lockedCount = 0;
            const lockedDetails = [];
            instructionList.forEach((block, index) => {
                const mentionedTests = [...(block.showIf || []), ...(block.ignoreIf || [])];
                if (!mentionedTests.some((t) => t?.field === field_name)) { return; } // unrelated to this field
                const parsed = classifier(block, field_name, validValues);
                if (parsed) { byValue[parsed.value] = { index, ...parsed }; }
                else {
                    lockedCount += 1;
                    lockedDetails.push({ index, block, reasons: explainLockedStageRule(kind, block, { field_name, validValues }) });
                }
            });
            result[kind] = { byValue, lockedCount, lockedDetails };
        }
        return result;
    };

    // Section-scoped counterpart to classifyFieldStageRules - scans for UNCONDITIONAL
    // instructions (no showIf/ignoreIf at all) in each kind. At most one recognized rule per kind
    // is modeled (the single section-level icon); a second unconditional block for the same kind,
    // or one using a shape this editor doesn't model, counts toward lockedCount instead of being
    // silently merged or dropped. Instructions gated on any field (showIf/ignoreIf present) are
    // skipped entirely - classifyFieldStageRules owns those.
    const classifyUnconditionalStageRules = (stageDef) => {
        const result = {};
        for (const kind of STAGE_RULE_KINDS) {
            const instructionList = [stageDef?.[kind]].flat().filter(Boolean);
            const classifier = STAGE_RULE_UNCONDITIONAL_CLASSIFIERS[kind];
            let rule = null;
            let lockedCount = 0;
            const lockedDetails = [];
            instructionList.forEach((block, index) => {
                if (block.showIf || block.ignoreIf) { return; } // gated - classifyFieldStageRules' concern
                const parsed = !rule && classifier(block);
                if (parsed) { rule = { index, ...parsed }; }
                else {
                    lockedCount += 1;
                    lockedDetails.push({ index, block, reasons: explainLockedStageRule(kind, block, { duplicate: !!rule }) });
                }
            });
            result[kind] = { rule, lockedCount, lockedDetails };
        }
        return result;
    };

    // Builds one on_complete_<kind> instruction block from an editable descriptor - the inverse of
    // classify*Rule above. field_name/value null builds an unconditional (no showIf) block.
    const serializeStageRule = (kind, field_name, value, edit) => {
        const showIf = field_name ? [{ field: field_name, values: [value] }] : null;
        if (kind === 'on_complete_groups') {
            return {
                ...(showIf ? { showIf } : {}),
                ...(edit.add?.length ? { add: edit.add } : {}),
                ...(edit.remove?.length ? { remove: edit.remove } : {}),
            };
        }
        const templateOrText = edit.template_id ? { template_id: edit.template_id } : { text: edit.text || '' };
        if (kind === 'on_complete_message') {
            return {
                ...(showIf ? { showIf } : {}),
                ...templateOrText,
                ...(edit.subject ? { subject: edit.subject } : {}),
                ...(edit.recipientList?.length ? { recipientList: edit.recipientList } : {}),
            };
        }
        return { // on_complete_notify
            ...(showIf ? { showIf } : {}),
            ...templateOrText,
            ...(edit.title ? { title: edit.title } : {}),
            ...(edit.available_to?.length ? { available_to: edit.available_to } : {}),
            ...(edit.options && Object.keys(edit.options).length ? { options: edit.options } : {}),
        };
    };

    // Regenerates one stage's on_complete_<kind> array after editing field_name's per-value rules.
    // valueEdits is { [value]: editableDescriptor | null|undefined } - null/undefined removes that
    // value's rule if one existed. Every block NOT classified as "recognized for field_name" this
    // kind (locked rules, rules for other fields, anything shaped differently) is preserved
    // byte-for-byte at its original array position; recognized blocks for field_name are replaced
    // by the freshly-serialized edited set, appended after the preserved blocks. Returns undefined
    // (so the key can be omitted entirely) if nothing remains for this kind.
    const buildFieldStageRuleOutput = ({ stageDef, kind, field_name, validValues, valueEdits }) => {
        const instructionList = [stageDef?.[kind]].flat().filter(Boolean);
        const classifier = STAGE_RULE_CLASSIFIERS[kind];
        const recognizedIndices = new Set();
        instructionList.forEach((block, index) => {
            const showIfTests = Array.isArray(block.showIf) ? block.showIf : [];
            // requireContent:false - a block FormBuilder itself wrote for this exact
            // (field_name, value) slot still belongs to it even before any text/template has
            // been filled in (e.g. typing a notification's Title before its Text/template).
            // Matching only the strict (content-required) classifier here left each such
            // in-progress block behind as a permanent orphan instead of replacing it on the
            // next keystroke - see classifyNotifyRuleCore/classifyMessageRuleCore.
            if (showIfTests.some((t) => t?.field === field_name) && classifier(block, field_name, validValues, { requireContent: false })) {
                recognizedIndices.add(index);
            }
        });
        const preserved = instructionList.filter((_, index) => !recognizedIndices.has(index));
        const regenerated = Object.entries(valueEdits || {})
            .filter(([, edit]) => !!edit)
            .map(([value, edit]) => serializeStageRule(kind, field_name, value, edit));
        const finalList = [...preserved, ...regenerated];
        return finalList.length ? finalList : undefined;
    };

    // Section-scoped counterpart to buildFieldStageRuleOutput - regenerates one stage's
    // on_complete_<kind> array after editing its unconditional rule. edit is the editableDescriptor,
    // or null/undefined to remove it if one existed. Every block other than the single recognized
    // unconditional one (locked rules, per-field rules, anything shaped differently) is preserved
    // byte-for-byte at its original array position.
    const buildUnconditionalStageRuleOutput = ({ stageDef, kind, edit }) => {
        const instructionList = [stageDef?.[kind]].flat().filter(Boolean);
        const classifier = STAGE_RULE_UNCONDITIONAL_CLASSIFIERS[kind];
        let recognizedIndex = -1;
        instructionList.forEach((block, index) => {
            // requireContent:false - see buildFieldStageRuleOutput's identical comment; same
            // orphaning bug applies to the section-level unconditional rule.
            if ((recognizedIndex === -1) && !block.showIf && !block.ignoreIf && classifier(block, { requireContent: false })) { recognizedIndex = index; }
        });
        const preserved = instructionList.filter((_, index) => index !== recognizedIndex);
        const finalList = edit ? [...preserved, serializeStageRule(kind, null, null, edit)] : preserved;
        return finalList.length ? finalList : undefined;
    };

    // Advisory only - true if attaching a message/notify rule to this value risks firing
    // alongside another already-configured value's rule in the same save (the field allows >1
    // simultaneous selections AND more than one of its values already has a message/notify rule).
    // on_complete_groups is unaffected - cumulative additions are usually desirable even when
    // multiple values are selected at once, so this isn't checked there.
    const messageNotifyMultiSelectRisk = ({ field, messageByValue, notifyByValue }) => {
        const { min } = computeSelectMinMax(field);
        if (min <= 1) { return false; }
        const configuredValueCount = new Set([...Object.keys(messageByValue || {}), ...Object.keys(notifyByValue || {})]).size;
        return configuredValueCount > 1;
    };

    // True if this field can only ever have one value selected at a time (max selections capped at
    // 1) - the only case where auto-generating "remove this field's OTHER values' groups" alongside
    // an add-to-group rule is safe. Where more than one value can be selected at once, two values'
    // auto-generated removals of each other's groups can overwrite one another (on_complete_groups'
    // last-mention-wins resolution in FormFillB.js) even while both are still simultaneously
    // selected - so this convenience should only be offered/auto-applied here.
    const fieldSupportsSiblingGroupRemoval = (field) => (computeSelectMinMax(field).max <= 1);

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
            active: isFormActive(editingForm),
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
            editingIsStored: true,
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
                                    ref={formRec.form_id === reactData.selectedFormId ? focusClonedForm : null}
                                    tabIndex={-1}
                                    aria-current={formRec.form_id === reactData.selectedFormId ? 'true' : undefined}
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
                                        <IconButton size='small' title='Clone this form' onClick={(e) => { e.stopPropagation(); cloneForm(formRec); }}>
                                            <FileCopyIcon fontSize='small' />
                                        </IconButton>
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

    const renderDeleteDialog = () => {
        const editingForm = reactData.editingForm;
        const { checking, refs, blocked } = reactData.deleteCheck;
        const formName = (editingForm.form_name || '').trim() || editingForm.form_id;
        const nameMatches = !!formName.trim() && (reactData.deleteTypedName.trim() === formName.trim());
        const fieldCount = (editingForm.sections || []).reduce((n, s) => n + (s.fields || []).length, 0);
        const refLines = (label, list) => (list.length > 0) && (
            <Box mb={1}>
                <Typography style={AVATextStyle({ bold: true })}>{`${label} (${list.length})`}</Typography>
                {list.slice(0, 10).map((r) => (
                    <Typography key={r.id || r.name} style={AVATextStyle({ size: 0.9, margin: { left: 1 } })}>{r.name}</Typography>
                ))}
                {(list.length > 10) &&
                    <Typography style={AVATextStyle({ size: 0.9, margin: { left: 1 }, color: 'textSecondary' })}>{`...and ${list.length - 10} more`}</Typography>
                }
            </Box>
        );
        return (
            <Dialog open={true} onClose={() => { if (!reactData.deleting) { cancelDelete(); } }} maxWidth='sm' fullWidth>
                <DialogTitle>{checking ? 'Checking form usage...' : (blocked ? 'This form cannot be deleted' : 'Delete this form?')}</DialogTitle>
                <DialogContent>
                    {checking &&
                        <Box display='flex' justifyContent='center' p={2}><CircularProgress /></Box>
                    }
                    {!checking && blocked &&
                        <React.Fragment>
                            <Typography style={AVATextStyle({ margin: { bottom: 1 } })}>
                                {`"${formName}" is still in use, so it cannot be deleted:`}
                            </Typography>
                            {(refs.documentCount > 0) &&
                                <Typography style={AVATextStyle({ bold: true, margin: { bottom: 1 } })}>
                                    {`${refs.documentCount} document${refs.documentCount === 1 ? '' : 's'} created from this form`}
                                </Typography>
                            }
                            {refLines('Groups using this form', refs.groups)}
                            {refLines('Events / templates using this form', refs.events)}
                            {refLines('Menu items that may open this form', refs.menus)}
                            {(refs.errors.length > 0) &&
                                <Alert severity='warning' style={{ marginBottom: '8px' }}>
                                    {`Usage could not be fully checked (${refs.errors.join('; ')}). Please try again later.`}
                                </Alert>
                            }
                            <Typography style={AVATextStyle({ size: 0.9, color: 'textSecondary' })}>
                                {'To retire this form without deleting it, check "Inactive Form?" and save.'}
                            </Typography>
                        </React.Fragment>
                    }
                    {!checking && !blocked &&
                        <React.Fragment>
                            <Alert severity='warning' style={{ marginBottom: '12px' }}>
                                {'Deleting removes this form from every list. It is kept in an archive and can only be restored by a technician.'}
                            </Alert>
                            <Typography style={AVATextStyle({ bold: true })}>{formName}</Typography>
                            <Typography style={AVATextStyle({ size: 0.9, color: 'textSecondary', margin: { bottom: 1 } })}>
                                {`${editingForm.category || 'No Category'} - ${(editingForm.sections || []).length} section(s), ${fieldCount} field(s)`}
                            </Typography>
                            <Typography style={AVATextStyle({ size: 0.9, margin: { bottom: 1 } })}>
                                {'No documents, groups, events, or menu items use this form.'}
                            </Typography>
                            {hasUnsavedChanges() &&
                                <Typography style={AVATextStyle({ size: 0.9, color: 'red', margin: { bottom: 1 } })}>
                                    {'You have unsaved changes - the last saved version is what will be deleted.'}
                                </Typography>
                            }
                            <TextField
                                fullWidth
                                autoFocus
                                label='Type the form name to confirm'
                                value={reactData.deleteTypedName}
                                onChange={(e) => updateReactData({ deleteTypedName: e.target.value }, true)}
                                disabled={reactData.deleting}
                                inputProps={{ 'aria-label': 'Type the form name to confirm' }}
                            />
                        </React.Fragment>
                    }
                </DialogContent>
                <DialogActions>
                    <Button
                        className={AVAClass.AVAButton}
                        variant='contained'
                        color='primary'
                        size='small'
                        onClick={cancelDelete}
                        disabled={reactData.deleting}
                    >
                        {blocked ? 'OK' : 'Cancel'}
                    </Button>
                    {!checking && !blocked &&
                        <Button
                            className={AVAClass.AVAButton}
                            size='small'
                            style={nameMatches && !reactData.deleting ? { backgroundColor: 'red', color: 'white' } : {}}
                            startIcon={<DeleteIcon fontSize='small' />}
                            onClick={confirmDelete}
                            disabled={!nameMatches || reactData.deleting}
                        >
                            {reactData.deleting ? <CircularProgress size={18} /> : 'Delete Form'}
                        </Button>
                    }
                </DialogActions>
            </Dialog>
        );
    };

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
                        <Tooltip title='Inactive forms stay in the system (and keep their documents) but are listed separately and not offered for new documents'>
                            <FormControlLabel
                                style={{ marginRight: 0, whiteSpace: 'nowrap' }}
                                control={
                                    <Checkbox
                                        checked={!isFormActive(editingForm)}
                                        onChange={(e) => updateEditingForm({ active: !e.target.checked })}
                                    />
                                }
                                label='Inactive Form?'
                            />
                        </Tooltip>
                    </Box>
                    <Typography style={AVATextStyle({ size: 0.75, color: 'textSecondary', margin: { top: 1, bottom: 1 } })}>
                        {`Form ID: ${editingForm.form_id}`}
                    </Typography>
                </Box>
                <Divider />
                <DialogContent>
                    <Box display='flex' flexDirection='column'>
                        {editingForm.sections.map((section, sectionIdx) => {
                            const isCollapsed = collapsedSections.has(section.key);
                            return (
                            <Paper key={section.key} variant='outlined' style={{ padding: '12px', marginBottom: '60px' }}>
                                <Box display='flex' flexDirection='row' alignItems='center' style={{ gap: '8px' }}>
                                    <TextField
                                        label='Section Name'
                                        value={section.section_name}
                                        onChange={(e) => updateSection(sectionIdx, { section_name: e.target.value })}
                                        style={{ flexGrow: 1 }}
                                    />
                                    {(() => {
                                        const stageDef = (editingForm.stages || []).find((s) => s.stage_name === section.belongs_to_stage);
                                        if (!stageDef) { return null; }
                                        const unconditionalRuleState = classifyUnconditionalStageRules(stageDef);
                                        const totalLocked = STAGE_RULE_ICON_DEFS.reduce((sum, { kind }) => sum + (unconditionalRuleState[kind]?.lockedCount || 0), 0);
                                        return (
                                            <React.Fragment>
                                                {STAGE_RULE_ICON_DEFS.map(({ kind, Icon, label }) => {
                                                    const existingForIcon = unconditionalRuleState[kind]?.rule;
                                                    const configured = !!existingForIcon;
                                                    return (
                                                        <IconButton
                                                            key={kind}
                                                            size='small'
                                                            title={`${configured ? 'Edit' : 'Add'} an unconditional ${label.toLowerCase()} rule for this section (applies every time, regardless of field values)`}
                                                            style={{ color: configured ? '#1976d2' : '#bbb' }}
                                                            onClick={() => {
                                                                setRuleContentMode(existingForIcon?.template_id ? 'template' : 'text');
                                                                setRuleEditorTarget({ sectionIdx, fieldIdx: null, value: null, kind });
                                                                setRuleEditorDraft(existingForIcon ? stripHelperKeys(existingForIcon) : defaultEditForKind(kind));
                                                                if (kind !== 'on_complete_groups') { loadMessageTemplatesIfNeeded(); }
                                                            }}
                                                        >
                                                            <Icon fontSize='small' />
                                                        </IconButton>
                                                    );
                                                })}
                                                {totalLocked > 0 &&
                                                    <LockedRuleTooltip
                                                        interactive
                                                        title={<LockedRuleDetails
                                                            ruleState={unconditionalRuleState}
                                                            stageName={stageDef.stage_name}
                                                            intro={`${totalLocked} unconditional rule(s) on this section use a shape FormBuilder doesn't model:`}
                                                        />}
                                                    >
                                                        <WarningIcon
                                                            fontSize='small'
                                                            style={{ color: '#f44336', cursor: 'help' }}
                                                        />
                                                    </LockedRuleTooltip>
                                                }
                                            </React.Fragment>
                                        );
                                    })()}
                                    <IconButton
                                        size='small'
                                        title='Move section up'
                                        onClick={() => moveSection(sectionIdx, -1)}
                                        disabled={sectionIdx === 0}
                                    >
                                        <ArrowUpwardIcon fontSize='small' />
                                    </IconButton>
                                    <IconButton
                                        size='small'
                                        title='Move section down'
                                        onClick={() => moveSection(sectionIdx, 1)}
                                        disabled={sectionIdx === editingForm.sections.length - 1}
                                    >
                                        <ArrowDownwardIcon fontSize='small' />
                                    </IconButton>
                                    <IconButton
                                        size='small'
                                        title={isCollapsed ? 'Expand section' : 'Collapse section'}
                                        onClick={() => toggleSectionCollapsed(section.key)}
                                    >
                                        {isCollapsed ? <ExpandMoreIcon fontSize='small' /> : <ExpandLessIcon fontSize='small' />}
                                    </IconButton>
                                    <IconButton
                                        size='small'
                                        onClick={() => removeSection(sectionIdx)}
                                        disabled={editingForm.sections.length <= 1}
                                    >
                                        <DeleteIcon fontSize='small' />
                                    </IconButton>
                                </Box>
                                {!isCollapsed &&
                                <React.Fragment>
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
                                                    (() => {
                                                        const validValues = field.selectionList.filter((v) => (v || '').trim());
                                                        const stageDef = (reactData.editingForm.stages || []).find((s) => s.stage_name === section.belongs_to_stage);
                                                        const stageRuleState = stageDef
                                                            ? classifyFieldStageRules({ stageDef, field_name: field.field_name, validValues })
                                                            : null;
                                                        const totalLocked = stageRuleState
                                                            ? STAGE_RULE_ICON_DEFS.reduce((sum, { kind }) => sum + (stageRuleState[kind]?.lockedCount || 0), 0)
                                                            : 0;
                                                        return (
                                                    <Box display='flex' flexDirection='column' style={{ marginTop: '20px', width: '60%', gap: '6px' }}>
                                                        <Box display='flex' flexDirection='row' alignItems='center' style={{ gap: '8px' }}>
                                                            <Typography style={AVATextStyle({ size: 0.8, color: 'textSecondary', margin: { bottom: 0 } })}>
                                                                {'Values to choose from:'}
                                                            </Typography>
                                                            {totalLocked > 0 &&
                                                                <LockedRuleTooltip
                                                                    interactive
                                                                    title={<LockedRuleDetails
                                                                        ruleState={stageRuleState}
                                                                        stageName={stageDef?.stage_name}
                                                                        intro={`${totalLocked} rule(s) on "${field.field_name}" use a condition FormBuilder doesn't model:`}
                                                                    />}
                                                                >
                                                                    <Typography style={{ ...AVATextStyle({ size: 0.75, color: 'error' }), cursor: 'help' }}>
                                                                        <WarningIcon fontSize='inherit' style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                                                                        {'Existing rule requires IT edit'}
                                                                    </Typography>
                                                                </LockedRuleTooltip>
                                                            }
                                                        </Box>
                                                        {field.selectionList.map((value, valueIdx) => (
                                                            <Box key={valueIdx} display='flex' flexDirection='row' alignItems='center' style={{ gap: '2px' }}>
                                                                <TextField
                                                                    fullWidth
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
                                                                {stageDef && (value || '').trim() && STAGE_RULE_ICON_DEFS.map(({ kind, Icon, label }) => {
                                                                    const existingForIcon = stageRuleState?.[kind]?.byValue?.[value];
                                                                    const configured = !!existingForIcon;
                                                                    return (
                                                                        <IconButton
                                                                            key={kind}
                                                                            size='small'
                                                                            title={`${configured ? 'Edit' : 'Add'} ${label.toLowerCase()} rule for "${value}"`}
                                                                            style={{ color: configured ? '#1976d2' : '#bbb' }}
                                                                            onClick={() => {
                                                                                setRuleContentMode(existingForIcon?.template_id ? 'template' : 'text');
                                                                                setRuleEditorTarget({ sectionIdx, fieldIdx, value, kind });
                                                                                setRuleEditorDraft(existingForIcon ? stripHelperKeys(existingForIcon) : defaultEditForKind(kind));
                                                                                if (kind !== 'on_complete_groups') { loadMessageTemplatesIfNeeded(); }
                                                                            }}
                                                                        >
                                                                            <Icon fontSize='small' />
                                                                        </IconButton>
                                                                    );
                                                                })}
                                                            </Box>
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
                                                        );
                                                    })()
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
                                </React.Fragment>
                                }
                            </Paper>
                            );
                        })}

                        <Button
                            size='small'
                            startIcon={<AddIcon fontSize='small' />}
                            onClick={addSection}
                            style={{ marginTop: '-36px', alignSelf: 'flex-start' }}
                        >                            {'Add Section'}
                        </Button>

                        {(() => {
                            const completeStageDef = (editingForm.stages || []).find((s) => s.stage_name === COMPLETE_STAGE_NAME) || { stage_name: COMPLETE_STAGE_NAME };
                            const unconditionalRuleState = classifyUnconditionalStageRules(completeStageDef);
                            const totalLocked = STAGE_RULE_ICON_DEFS.reduce((sum, { kind }) => sum + (unconditionalRuleState[kind]?.lockedCount || 0), 0);
                            return (
                                <Paper variant='outlined' style={{ padding: '12px', marginTop: '12px' }}>
                                    <Box display='flex' flexDirection='row' alignItems='center' style={{ gap: '8px' }}>
                                        <Typography style={{ flexGrow: 1 }}>
                                            {'When the entire form is completed...'}
                                        </Typography>
                                        {STAGE_RULE_ICON_DEFS.map(({ kind, Icon, label }) => {
                                            const existingForIcon = unconditionalRuleState[kind]?.rule;
                                            const configured = !!existingForIcon;
                                            return (
                                                <IconButton
                                                    key={kind}
                                                    size='small'
                                                    title={`${configured ? 'Edit' : 'Add'} a ${label.toLowerCase()} rule for when the entire form is completed (every section cleared)`}
                                                    style={{ color: configured ? '#1976d2' : '#bbb' }}
                                                    onClick={() => {
                                                        setRuleContentMode(existingForIcon?.template_id ? 'template' : 'text');
                                                        setRuleEditorTarget({ sectionIdx: null, fieldIdx: null, value: null, kind, stage_name: COMPLETE_STAGE_NAME });
                                                        setRuleEditorDraft(existingForIcon ? stripHelperKeys(existingForIcon) : defaultEditForKind(kind));
                                                        if (kind !== 'on_complete_groups') { loadMessageTemplatesIfNeeded(); }
                                                    }}
                                                >
                                                    <Icon fontSize='small' />
                                                </IconButton>
                                            );
                                        })}
                                    </Box>
                                    {totalLocked > 0 &&
                                        <LockedRuleTooltip
                                            interactive
                                            title={<LockedRuleDetails
                                                ruleState={unconditionalRuleState}
                                                stageName={COMPLETE_STAGE_NAME}
                                                intro={`${totalLocked} rule(s) on the form's "complete" stage use a shape FormBuilder doesn't model:`}
                                            />}
                                        >
                                            <Typography style={{ ...AVATextStyle({ size: 0.75, color: 'error' }), cursor: 'help', display: 'inline-block' }}>
                                                <WarningIcon fontSize='inherit' style={{ verticalAlign: 'middle', marginRight: '2px' }} />
                                                {'Existing rule requires IT edit'}
                                            </Typography>
                                        </LockedRuleTooltip>
                                    }
                                </Paper>
                            );
                        })()}
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
                    {canDeleteForms && reactData.editingIsStored &&
                        <Button
                            className={AVAClass.AVAButton}
                            size='small'
                            style={{ color: 'red' }}
                            startIcon={<DeleteIcon fontSize='small' />}
                            onClick={requestDelete}
                            disabled={reactData.saving || reactData.deleting}
                            title={hasUnsavedChanges() ? 'Deletes the last saved version of this form' : 'Delete this form'}
                        >
                            {'Delete'}
                        </Button>
                    }
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
                        startIcon={<FileCopyIcon fontSize='small' />}
                        onClick={requestClone}
                        disabled={reactData.saving || (directForm === 'new')}
                        title={hasUnsavedChanges() ? 'Clones the last saved version - unsaved changes here will not be included' : 'Clone this form'}
                    >
                        {'Clone'}
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
                {reactData.confirmClone &&
                    <AVAConfirm
                        promptText={['You have unsaved changes.', 'Clone the last saved version and return to the form list? Your unsaved changes will be discarded.']}
                        cancelText={'No, keep editing'}
                        confirmText={'Yes, clone and discard changes'}
                        onCancel={() => updateReactData({ confirmClone: false }, true)}
                        onConfirm={() => {
                            updateReactData({ confirmClone: false }, true);
                            cloneCurrentForm();
                        }}
                    />
                }
                {reactData.deleteCheck && renderDeleteDialog()}
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
            {ruleEditorTarget && (() => {
                const { sectionIdx, fieldIdx, value, kind, stage_name } = ruleEditorTarget;
                // The form-level "whole form completed" rule (see the card rendered after "Add
                // Section" above) isn't tied to any section - it carries an explicit stage_name
                // instead, so the stage is looked up directly rather than via a section's
                // belongs_to_stage.
                const isFormLevel = !!stage_name;
                const isUnconditional = isFormLevel || (fieldIdx === null || fieldIdx === undefined);
                const section = isFormLevel ? null : reactData.editingForm?.sections[sectionIdx];
                const field = (isUnconditional || isFormLevel) ? null : section?.fields[fieldIdx];
                const stages = reactData.editingForm?.stages || [];
                const stageDef = isFormLevel
                    ? stages.find((s) => s.stage_name === stage_name)
                    : stages.find((s) => s.stage_name === section?.belongs_to_stage);
                if (!stageDef || (!isFormLevel && !section) || (!isUnconditional && !field)) { return null; }
                const validValues = isUnconditional ? [] : field.selectionList.filter((v) => (v || '').trim());
                const classified = isUnconditional
                    ? classifyUnconditionalStageRules(stageDef)
                    : classifyFieldStageRules({ stageDef, field_name: field.field_name, validValues });
                const existingRaw = isUnconditional ? (classified[kind]?.rule || null) : (classified[kind]?.byValue?.[value] || null);
                // The dialog's working copy - seeded once into ruleEditorDraft when the icon that
                // opened it was clicked (see both onClick handlers above) and never re-derived
                // from the live array while open, so nothing here reflects a half-typed value
                // until Save explicitly writes it back.
                const currentEdit = ruleEditorDraft || defaultEditForKind(kind);

                const applyRuleEdit = (edit) => {
                    if (isUnconditional) {
                        const newArray = buildUnconditionalStageRuleOutput({ stageDef, kind, edit });
                        updateStage(stageDef.stage_name, { [kind]: newArray });
                        return;
                    }
                    const valueEdits = {};
                    Object.entries(classified[kind].byValue).forEach(([v, e]) => {
                        if (v === value) { return; }
                        valueEdits[v] = stripHelperKeys(e);
                    });
                    if (edit) { valueEdits[value] = edit; }
                    const newArray = buildFieldStageRuleOutput({ stageDef, kind, field_name: field.field_name, validValues, valueEdits });
                    updateStage(stageDef.stage_name, { [kind]: newArray });
                };

                // Advisory only - warns (doesn't block) when this is a brand-new message/notify
                // rule landing on a 2nd+ configured value of a field that allows multiple
                // simultaneous selections (see messageNotifyMultiSelectRisk above). Not
                // applicable to an unconditional (section-level) rule - there's no specific value
                // to collide with another value's rule.
                const warnIfMultiSelectRisk = () => {
                    if (isUnconditional || (kind === 'on_complete_groups') || existingRaw) { return; }
                    const risk = messageNotifyMultiSelectRisk({
                        field,
                        messageByValue: Object.assign({}, classified.on_complete_message.byValue, (kind === 'on_complete_message') ? { [value]: true } : {}),
                        notifyByValue: Object.assign({}, classified.on_complete_notify.byValue, (kind === 'on_complete_notify') ? { [value]: true } : {}),
                    });
                    if (risk) {
                        updateReactData({
                            alert: {
                                severity: 'warning',
                                message: `"${field.prompt || field.field_name}" allows more than one selection at once - if more than one of its values is selected at the same time, more than one message/notification may be sent for the same save.`,
                            },
                        }, true);
                    }
                };

                // Updates only the local draft (ruleEditorDraft) - nothing is written back into
                // editingForm's stage array until saveRule runs. warnIfMultiSelectRisk is still
                // safe to run live here since it's a read-only advisory check against OTHER
                // already-saved values' rules, not a write of its own.
                const patchEdit = (patch) => {
                    setRuleEditorDraft(Object.assign({}, currentEdit, patch));
                    warnIfMultiSelectRisk();
                };

                // Closes the dialog without writing anything - the draft is simply discarded, so
                // whatever rule existed (or didn't) before this dialog opened is left exactly as
                // it was. Used by the Exit button and by backdrop-click/Escape (the Dialog's
                // onClose below), so every way of leaving without an explicit Save behaves
                // identically.
                const exitRuleEditor = () => { setRuleEditorTarget(null); setRuleEditorDraft(null); };

                const saveRule = () => { applyRuleEdit(currentEdit); exitRuleEditor(); };

                const removeRule = () => { applyRuleEdit(null); exitRuleEditor(); };

                const kindLabel = STAGE_RULE_ICON_DEFS.find((d) => d.kind === kind)?.label || '';
                const recipientKey = (kind === 'on_complete_message') ? 'recipientList' : 'available_to';
                const currentRecipient = (currentEdit[recipientKey] || ['pertains_to'])[0];
                const isSpecificRecipient = (currentRecipient || '').startsWith('group:') || (currentRecipient || '').startsWith('person:');

                return (
                    <React.Fragment>
                        <Dialog open={true} onClose={exitRuleEditor} maxWidth='sm' fullWidth>
                            <DialogTitle>{isFormLevel ? `Form Complete: ${kindLabel} Rule` : `${kindLabel} Rule`}</DialogTitle>
                            <DialogContent>
                                <Box display='flex' flexDirection='column' style={{ gap: '16px' }}>
                                    <Typography style={AVATextStyle({ size: 0.85, color: 'textSecondary' })}>
                                        {isFormLevel
                                            ? 'Applies once, when every section of this form has been completed (fires only on the save that finishes the last stage - not on later resaves of an already-complete document).'
                                            : isUnconditional
                                                ? 'Applies every time data in this section is changed, regardless of any field value.'
                                                : `When "${(field.prompt || field.field_name).toString().replace(/<[^>]+>/g, '')}" is "${value}"...`}
                                    </Typography>

                                    {(kind === 'on_complete_groups') &&
                                        <React.Fragment>
                                            <Box>
                                                <Typography style={AVATextStyle({ size: 0.8 })}>{'Add to these groups:'}</Typography>
                                                <Box display='flex' flexDirection='row' flexWrap='wrap' style={{ gap: '4px', marginTop: '4px' }}>
                                                    {(currentEdit.add || []).map((g) => (
                                                        <Chip key={g} label={state.groups?.groupNames?.[g] || g} size='small' onDelete={() => patchEdit({ add: currentEdit.add.filter((x) => x !== g) })} />
                                                    ))}
                                                </Box>
                                                <Button
                                                    size='small'
                                                    style={{ marginTop: '4px' }}
                                                    onClick={() => updateReactData({
                                                        showRuleGroupsSearch: 'add',
                                                        selections: (currentEdit.add || []).map((g) => ({ group_id: g, group_name: state.groups?.groupNames?.[g] || g })),
                                                    }, true)}
                                                >
                                                    {'+ Add Group'}
                                                </Button>
                                            </Box>
                                            <Box>
                                                <Typography style={AVATextStyle({ size: 0.8 })}>{'Remove from these groups:'}</Typography>
                                                <Box display='flex' flexDirection='row' flexWrap='wrap' style={{ gap: '4px', marginTop: '4px' }}>
                                                    {(currentEdit.remove || []).map((g) => (
                                                        <Chip key={g} label={state.groups?.groupNames?.[g] || g} size='small' onDelete={() => patchEdit({ remove: currentEdit.remove.filter((x) => x !== g) })} />
                                                    ))}
                                                </Box>
                                                <Box display='flex' flexDirection='row' style={{ gap: '8px', marginTop: '4px' }}>
                                                    <Button
                                                        size='small'
                                                        onClick={() => updateReactData({
                                                            showRuleGroupsSearch: 'remove',
                                                            selections: (currentEdit.remove || []).map((g) => ({ group_id: g, group_name: state.groups?.groupNames?.[g] || g })),
                                                        }, true)}
                                                    >
                                                        {'+ Remove Group'}
                                                    </Button>
                                                    {!isUnconditional && fieldSupportsSiblingGroupRemoval(field) &&
                                                        <Button
                                                            size='small'
                                                            title="Fills in 'remove' with every group this field's OTHER values add - safe only because at most one value of this field can ever be selected at a time"
                                                            onClick={() => {
                                                                const siblingAdds = new Set();
                                                                Object.entries(classified.on_complete_groups.byValue).forEach(([v, e]) => {
                                                                    if (v === value) { return; }
                                                                    (e.add || []).forEach((g) => siblingAdds.add(g));
                                                                });
                                                                const nextRemove = new Set(currentEdit.remove || []);
                                                                siblingAdds.forEach((g) => { if (!(currentEdit.add || []).includes(g)) { nextRemove.add(g); } });
                                                                patchEdit({ remove: [...nextRemove] });
                                                            }}
                                                        >
                                                            {'Auto-fill from other values'}
                                                        </Button>
                                                    }
                                                </Box>
                                            </Box>
                                        </React.Fragment>
                                    }

                                    {(kind === 'on_complete_message' || kind === 'on_complete_notify') &&
                                        <React.Fragment>
                                            <FormControl>
                                                <InputLabel>{'Content'}</InputLabel>
                                                <Select
                                                    value={ruleContentMode}
                                                    onOpen={loadMessageTemplatesIfNeeded}
                                                    onChange={(e) => {
                                                        const mode = e.target.value;
                                                        setRuleContentMode(mode);
                                                        if (mode === 'template') { loadMessageTemplatesIfNeeded(); }
                                                        else { patchEdit({ template_id: null }); }
                                                    }}
                                                >
                                                    <MenuItem value='text'>{'Write custom text'}</MenuItem>
                                                    <MenuItem value='template'>{'Use a saved template'}</MenuItem>
                                                </Select>
                                            </FormControl>
                                            {(ruleContentMode === 'template') ?
                                                <FormControl fullWidth>
                                                    <InputLabel>{'Template'}</InputLabel>
                                                    <Select
                                                        value={currentEdit.template_id || ''}
                                                        onOpen={loadMessageTemplatesIfNeeded}
                                                        onChange={(e) => patchEdit({ template_id: e.target.value, text: '' })}
                                                    >
                                                        {reactData.messageTemplates.map((t) => (
                                                            <MenuItem key={t.template_id} value={t.template_id}>{t.template_name || t.template_id}</MenuItem>
                                                        ))}
                                                        {/* Keeps a stored template_id visible (rather than rendering blank) even if it
                                                            doesn't match any currently-loaded template - e.g. templates still loading,
                                                            the template was since deleted, or (as with hand-edited test data) the id
                                                            doesn't correspond to a real template_id at all. Never silently hides what's
                                                            actually persisted. */}
                                                        {currentEdit.template_id && !reactData.messageTemplates.some((t) => t.template_id === currentEdit.template_id) &&
                                                            <MenuItem value={currentEdit.template_id}>
                                                                {`${currentEdit.template_id} ${reactData.messageTemplatesLoaded ? '(not found)' : '(loading…)'}`}
                                                            </MenuItem>
                                                        }
                                                    </Select>
                                                    {(reactData.messageTemplatesLoaded && reactData.messageTemplates.length === 0) &&
                                                        <Typography style={AVATextStyle({ size: 0.75, color: 'textSecondary' })}>
                                                            {'No message templates found for this client yet.'}
                                                        </Typography>
                                                    }
                                                </FormControl>
                                                :
                                                <TextField
                                                    label='Text'
                                                    value={currentEdit.text || ''}
                                                    onChange={(e) => patchEdit({ text: e.target.value, template_id: null })}
                                                    multiline
                                                    minRows={2}
                                                    fullWidth
                                                />
                                            }
                                            {(kind === 'on_complete_notify') &&
                                                <TextField
                                                    label='Title (optional)'
                                                    value={currentEdit.title || ''}
                                                    onChange={(e) => patchEdit({ title: e.target.value })}
                                                    fullWidth
                                                />
                                            }
                                            {(kind === 'on_complete_message') &&
                                                <TextField
                                                    label='Subject (optional)'
                                                    value={currentEdit.subject || ''}
                                                    onChange={(e) => patchEdit({ subject: e.target.value })}
                                                    fullWidth
                                                />
                                            }
                                            <FormControl fullWidth>
                                                <InputLabel>{'Who receives this'}</InputLabel>
                                                <Select
                                                    value={isSpecificRecipient ? 'specific' : currentRecipient}
                                                    onChange={(e) => {
                                                        if (e.target.value === 'specific') {
                                                            let preSeed = [];
                                                            if (currentRecipient?.startsWith('group:')) {
                                                                const gid = currentRecipient.slice(6);
                                                                preSeed = [{ group_id: gid, group_name: state.groups?.groupNames?.[gid] || gid }];
                                                            }
                                                            else if (currentRecipient?.startsWith('person:')) {
                                                                preSeed = [{ person_id: currentRecipient.slice(7) }];
                                                            }
                                                            updateReactData({ showRuleRecipientSearch: true, selections: preSeed }, true);
                                                            return;
                                                        }
                                                        patchEdit({ [recipientKey]: [e.target.value] });
                                                    }}
                                                >
                                                    <MenuItem value='pertains_to'>{'The person this form is about'}</MenuItem>
                                                    <MenuItem value='primary_caregiver'>{'The Primary Caregiver for the Person this form is about'}</MenuItem>
                                                    <MenuItem value='user'>{'The person that is completing the form'}</MenuItem>
                                                    <MenuItem value='specific'>{isSpecificRecipient ? describeRecipientValue(currentRecipient, (gid) => state.groups?.groupNames?.[gid]) : 'A specific group or person...'}</MenuItem>
                                                </Select>
                                            </FormControl>
                                            {(kind === 'on_complete_notify') &&
                                                <Box display='flex' flexDirection='row' style={{ gap: '16px' }} alignItems='center' flexWrap='wrap'>
                                                    <FormControl style={{ minWidth: 140 }}>
                                                        <InputLabel>{'Priority'}</InputLabel>
                                                        <Select
                                                            value={currentEdit.options?.priority || 'low'}
                                                            onChange={(e) => patchEdit({ options: Object.assign({}, currentEdit.options, { priority: e.target.value }) })}
                                                        >
                                                            <MenuItem value='low'>{'Low'}</MenuItem>
                                                            <MenuItem value='medium'>{'Medium'}</MenuItem>
                                                            <MenuItem value='high'>{'High'}</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                size='small'
                                                                checked={currentEdit.options?.persist_until_dismissed !== false}
                                                                onChange={(e) => patchEdit({ options: Object.assign({}, currentEdit.options, { persist_until_dismissed: e.target.checked }) })}
                                                            />
                                                        }
                                                        label='Stay until dismissed'
                                                    />
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                size='small'
                                                                checked={!!currentEdit.options?.play_sound}
                                                                onChange={(e) => patchEdit({ options: Object.assign({}, currentEdit.options, { play_sound: e.target.checked }) })}
                                                            />
                                                        }
                                                        label='Play sound'
                                                    />
                                                </Box>
                                            }
                                        </React.Fragment>
                                    }
                                </Box>
                            </DialogContent>
                            <DialogActions>
                                {existingRaw &&
                                    <Button style={{ color: 'red' }} onClick={removeRule}>{'Remove Rule'}</Button>
                                }
                                <Button onClick={exitRuleEditor}>{'Exit'}</Button>
                                <Button variant='contained' color='primary' onClick={saveRule}>{'Save'}</Button>
                            </DialogActions>
                        </Dialog>
                        {reactData.showRuleGroupsSearch &&
                            <QuickSearch
                                reactData={reactData}
                                updateReactData={updateReactData}
                                options={{
                                    title: (reactData.showRuleGroupsSearch === 'add') ? 'Add To Which Groups?' : 'Remove From Which Groups?',
                                    withGroups: true,
                                    showGroupList: true,
                                    showAll: true,
                                    hidePeople: true,
                                    pickAndGo: true,
                                    keepSelections: true,
                                    buttonText: { empty: 'Done', selected: 'Use These' },
                                }}
                                onClose={(selections) => {
                                    const targetKey = reactData.showRuleGroupsSearch;
                                    const picked = ([selections].flat()).filter((s) => s && s.group_id);
                                    updateReactData({ showRuleGroupsSearch: null, selections: [] }, true);
                                    // Replaces (not merges) - QuickSearch opened with the current list pre-checked,
                                    // so whatever comes back (including unchecked removals) is the new full list.
                                    if (targetKey) { patchEdit({ [targetKey]: picked.map((s) => s.group_id) }); }
                                }}
                            />
                        }
                        {reactData.showRuleRecipientSearch &&
                            <QuickSearch
                                reactData={reactData}
                                updateReactData={updateReactData}
                                options={{
                                    title: 'Which Group or Person?',
                                    withGroups: true,
                                    showGroupList: true,
                                    showAll: true,
                                    pickOne: true,
                                    keepSelections: true,
                                    buttonText: { empty: 'Cancel', selected: 'Use This' },
                                }}
                                onClose={(selections) => {
                                    // Same clean/map convention as other available_to pickers (e.g.
                                    // NotificationMaintenance's access picker): group_id -> 'group:<id>',
                                    // else person_id -> 'person:<id>'.
                                    const cleanSelections = ([selections].flat()).filter((s) => s && (s.person_id || s.group_id));
                                    const picked = cleanSelections[0];
                                    updateReactData({ showRuleRecipientSearch: false, selections: [] }, true);
                                    if (picked) {
                                        const mapped = picked.group_id ? `group:${picked.group_id}` : `person:${picked.person_id}`;
                                        patchEdit({ [recipientKey]: [mapped] });
                                    }
                                }}
                            />
                        }
                    </React.Fragment>
                );
            })()}
        </Dialog>
    );
};
