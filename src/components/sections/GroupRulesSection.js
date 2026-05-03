import React from 'react';
import useSession from '../../hooks/useSession';

import {
  Box, Typography, Button, TextField,
  Select, MenuItem, FormControl, InputLabel,
  IconButton, Chip, Paper
} from '@material-ui/core/';

import { AVATextStyle } from '../../util/AVAStyles';
import { AVAclasses } from '../../util/AVAStyles';
import { cl, dbClient, recordExists, deepCopy } from '../../util/AVAUtilities';
import { backfillOnAddRule } from '../../util/AVAGroups';

import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import DeleteIcon from '@material-ui/icons/Delete';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ExpandLessIcon from '@material-ui/icons/ExpandLess';

// ── Constants ─────────────────────────────────────────────────────────────────

const RULE_TYPES = [
  { value: 'onAdd',      label: 'When a member is added to this group' },
  { value: 'onRemove',   label: 'When a member is removed from this group' },
  { value: 'withData',   label: 'When a data condition is met' },
];

const ACTION_TYPES = [
  { value: 'addMember',    label: 'Add member' },
  { value: 'removeMember', label: 'Remove member' },
];

const WHO_TYPES = [
  { value: 'self',        label: 'The person themselves' },
  { value: 'allFamily',   label: 'All family members' },
  { value: 'otherFamily', label: 'Other family members (not self)' },
  { value: 'primary',     label: 'Primary contact' },
];

const TEST_TYPES = [
  { value: 'eq',       label: '= equals' },
  { value: 'ne',       label: '≠ not equals' },
  { value: 'contains', label: 'contains' },
  { value: 'gt',       label: '> greater than' },
  { value: 'lt',       label: '< less than' },
];

const emptyAction = () => ({ action: 'addMember', who: 'self', where: [] });
const emptyRule   = () => ({
  rule_type: 'onAdd',
  actions: [emptyAction()],
  data_test: { dictionaryField: '', test: 'eq', testValue: '' },
});

// ── Component ─────────────────────────────────────────────────────────────────

export default ({ currentValues, updateField, updateReactData: parentUpdateReactData }) => {

  const AVAClass = AVAclasses();
  const { state } = useSession();

  const [local, setLocal] = React.useState({
    initialized: false,
    dictionaryFields: [],    // [{field_key, description}] from DataDictionaryV3
    expandedIndex: null,     // null = none; -1 = new rule form; n = editing rule n
    editingRule: null,       // deep copy of the rule being edited (or emptyRule() for new)
    backfillState: {},       // keyed by ruleIndex: null | { running, done, total }
  });

  const update = (newData) => setLocal((prev) => Object.assign({}, prev, newData));

  // ── Init: load DataDictionaryV3 ─────────────────────────────────────────────
  React.useEffect(() => {
    async function initialize() {
      const dictRec = await dbClient
        .query({
          TableName: 'DataDictionaryV3',
          KeyConditionExpression: 'client_id = :c',
          ExpressionAttributeValues: { ':c': state.session.client_id },
        })
        .promise()
        .catch((error) => { cl({ 'GroupRulesSection — Error reading DataDictionaryV3': error }); });

      const dictionaryFields = recordExists(dictRec)
        ? (dictRec.Items || []).sort((a, b) =>
            (a.field_key || '').localeCompare(b.field_key || ''))
        : [];

      update({ initialized: true, dictionaryFields });
    }
    initialize();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived data ────────────────────────────────────────────────────────────
  const currentRules  = currentValues?.Groups?.group_rules || [];
  const adminHierarchy = state.groups?.adminHierarchy || [];

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const saveRules = async (newRules) => {
    await updateField({
      updateList: [{ tableName: 'Groups', fieldName: 'group_rules', newData: newRules }],
    });
  };

  const deleteRule = async (ruleIndex) => {
    await saveRules(currentRules.filter((_, i) => i !== ruleIndex));
    update({ expandedIndex: null, editingRule: null });
  };

  const startEdit = (index) => {
    if (local.expandedIndex === index) {
      update({ expandedIndex: null, editingRule: null });
      if (parentUpdateReactData) { parentUpdateReactData({ unsavedRuleEdit: false }, true); }
    } else {
      update({
        expandedIndex: index,
        editingRule: index === -1 ? emptyRule() : deepCopy(currentRules[index]),
      });
      if (parentUpdateReactData) { parentUpdateReactData({ unsavedRuleEdit: true }); }
    }
  };

  const cancelEdit = () => {
    update({ expandedIndex: null, editingRule: null });
    if (parentUpdateReactData) { parentUpdateReactData({ unsavedRuleEdit: false }, true); }
  };

  const saveEdit = async () => {
    if (!local.editingRule) { return; }
    let ruleToSave = { ...local.editingRule };
    if (ruleToSave.rule_type === 'withData') {
      // Strip actions — withData rules are condition-only; the Lambda handles add/remove
      delete ruleToSave.actions;
      // Resolve field_path from dictionary record so the Lambda doesn't need to re-query
      const dictField = local.dictionaryFields.find(f => f.field_key === ruleToSave.data_test?.dictionaryField);
      if (dictField) {
        // Find the first candidate with a People source to get the right path
        const multiCandidates = [
          ...(dictField.sources || []),
          ...(dictField.source_options || []),
          ...(dictField.source_candidates || []),
          ...(dictField.resolution_sources || []),
        ].filter(c => c && typeof c === 'object');
        const peopleSources = multiCandidates.filter(c => {
          const src = (c.source || '').toLowerCase();
          return !src || src === 'person' || src === 'people';
        });
        const candidateWithPath = peopleSources.find(c => c.path) || {
          path: dictField.path,
          source: dictField.source,
        };
        const rawPath = candidateWithPath.path;
        const field_path = Array.isArray(rawPath)
          ? rawPath.join('.')
          : (typeof rawPath === 'string' && rawPath.trim()
              ? rawPath.trim()
              : ruleToSave.data_test.dictionaryField);
        ruleToSave = {
          ...ruleToSave,
          data_test: { ...ruleToSave.data_test, field_path },
        };
      }
    }
    let newRules = local.expandedIndex === -1
      ? [...currentRules, ruleToSave]
      : currentRules.map((r, i) => (i === local.expandedIndex ? ruleToSave : r));

    // Auto-create a mirror onRemove rule whenever a NEW onAdd rule is saved
    if (local.expandedIndex === -1 && ruleToSave.rule_type === 'onAdd' && Array.isArray(ruleToSave.actions)) {
      const mirrorActions = ruleToSave.actions.map(a => ({
        ...a,
        action: a.action === 'addMember' ? 'removeMember' : 'addMember',
      }));
      // Only append if no existing onRemove rule already has the same who+where for every action
      const alreadyExists = newRules.some(r =>
        r.rule_type === 'onRemove' &&
        Array.isArray(r.actions) &&
        mirrorActions.every(ma =>
          r.actions.some(ra =>
            ra.action === ma.action &&
            ra.who === ma.who &&
            JSON.stringify((ra.where || []).slice().sort()) === JSON.stringify((ma.where || []).slice().sort())
          )
        )
      );
      if (!alreadyExists) {
        newRules = [...newRules, { rule_type: 'onRemove', actions: mirrorActions }];
      }
    }

    await saveRules(newRules);
    update({ expandedIndex: null, editingRule: null });
    if (parentUpdateReactData) { parentUpdateReactData({ unsavedRuleEdit: false }, true); }
  };

  const patchRule = (updater) => {
    update({ editingRule: updater(local.editingRule) });
  };

  const patchAction = (actionIndex, patch) => {
    patchRule((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) => (i === actionIndex ? { ...a, ...patch } : a)),
    }));
  };

  const addGroupToAction = (actionIndex, groupId) => {
    if (!groupId) { return; }
    patchRule((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) => {
        if (i !== actionIndex) { return a; }
        const where = [...(a.where || [])];
        if (!where.includes(groupId)) { where.push(groupId); }
        return { ...a, where };
      }),
    }));
  };

  const removeGroupFromAction = (actionIndex, groupIndex) => {
    patchRule((prev) => ({
      ...prev,
      actions: prev.actions.map((a, i) => {
        if (i !== actionIndex) { return a; }
        return { ...a, where: a.where.filter((_, wi) => wi !== groupIndex) };
      }),
    }));
  };

  const removeAction = (actionIndex) => {
    patchRule((prev) => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== actionIndex),
    }));
  };

  // ── Rule-type label ─────────────────────────────────────────────────────────
  const ruleTypeLabel = (rule_type) =>
    RULE_TYPES.find((t) => t.value === rule_type)?.label || rule_type;

  // ── Action summary line (read-only view) ────────────────────────────────────
  const renderActionSummary = (action, i, rule_type) => {
    if (rule_type === 'withData') {
      const verb = action.action === 'removeMember' ? 'Remove' : 'Add';
      const prep = action.action === 'removeMember' ? 'from' : 'to';
      return (
        <Typography key={`actsum_${i}`} style={AVATextStyle({ size: 0.82, margin: { left: 1.5, top: 0.2 } })}>
          {`${i + 1}. ${verb} members matching the condition ${prep} this group`}
        </Typography>
      );
    }
    const actionLabel = ACTION_TYPES.find((t) => t.value === action.action)?.label || action.action;
    const whoLabel    = WHO_TYPES.find((t) => t.value === action.who)?.label || action.who;
    const whereText   = (action.where || []).length
      ? (action.where || []).map((gid) => {
          const match = adminHierarchy.find((g) => g.id === gid);
          return match ? match.name : gid;
        }).join(', ')
      : '(no groups)';
    return (
      <Typography key={`actsum_${i}`} style={AVATextStyle({ size: 0.82, margin: { left: 1.5, top: 0.2 } })}>
        {`${i + 1}. ${actionLabel} — ${whoLabel} → ${whereText}`}
      </Typography>
    );
  };

  // ── Action editor ───────────────────────────────────────────────────────────
  const renderActionEditor = (action, actionIndex) => {
    const isDataRule = local.editingRule?.rule_type === 'withData';
    const thisGroupId = currentValues?.Groups?.group_id;
    const isThisGroupAParent = adminHierarchy.some((g) => g.belongs_to === thisGroupId);
    const selectedGroupIds = new Set(action.where || []);
    const parentGroupIds = new Set(adminHierarchy.map((g) => g.belongs_to).filter(Boolean));
    const availableGroups = adminHierarchy.filter((g) => !selectedGroupIds.has(g.id));

    // Special case: data rule on a parent group — only removeMember is valid
    if (isDataRule && isThisGroupAParent) {
      return (
        <Paper key={`actedit_${actionIndex}`} elevation={1}
          style={{ padding: '12px 16px', marginBottom: 10, borderRadius: 12 }}
        >
          <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
            <Typography style={AVATextStyle({ size: 0.95, bold: true })}>
              {`Action ${actionIndex + 1}`}
            </Typography>
            <IconButton size='small' onClick={() => removeAction(actionIndex)}>
              <DeleteIcon fontSize='small' />
            </IconButton>
          </Box>
          <Typography style={AVATextStyle({ size: 0.9, margin: { top: 1 } })}>
            {'This group has sub-groups. Members can be removed from it by data rule, but not added. This action will remove members that match the condition.'}
          </Typography>
          {/* keep action value as removeMember silently */}
          {action.action !== 'removeMember' && patchAction(actionIndex, { action: 'removeMember' })}
        </Paper>
      );
    }

    return (
      <Paper key={`actedit_${actionIndex}`} elevation={1}
        style={{ padding: '12px 16px', marginBottom: 10, borderRadius: 12 }}
      >
        <Box display='flex' flexDirection='row' justifyContent='space-between' alignItems='center'>
          <Typography style={AVATextStyle({ size: 0.95, bold: true })}>
            {`Action ${actionIndex + 1}`}
          </Typography>
          <IconButton size='small' onClick={() => removeAction(actionIndex)}>
            <DeleteIcon fontSize='small' />
          </IconButton>
        </Box>

        {/* action type */}
        <FormControl fullWidth margin='dense'>
          <InputLabel>What to do</InputLabel>
          <Select
            value={action.action}
            onChange={(e) => patchAction(actionIndex, { action: e.target.value })}
          >
            {isDataRule
              ? [
                  <MenuItem key='addMember' value='addMember'>{'Add people matching the condition to this group'}</MenuItem>,
                  <MenuItem key='removeMember' value='removeMember'>{'Remove people matching the condition from this group'}</MenuItem>,
                ]
              : ACTION_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))
            }
          </Select>
        </FormControl>

        {/* who */}
        {isDataRule
          ? (
            <Box mt={1} mb={0.5}>
              <Typography style={AVATextStyle({ size: 0.85, color: 'grey' })}>{'Who'}</Typography>
              <Typography style={AVATextStyle({ size: 0.95 })}>{'Every person that meets the condition'}</Typography>
            </Box>
          ) : (
            <FormControl fullWidth margin='dense'>
              <InputLabel>Who</InputLabel>
              <Select
                value={action.who}
                onChange={(e) => patchAction(actionIndex, { who: e.target.value })}
              >
                {WHO_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )
        }

        {/* where (group chips + picker) */}
        {isDataRule
          ? (
            <Box mt={1} mb={0.5}>
              <Typography style={AVATextStyle({ size: 0.85, color: 'grey' })}>{'Target Group'}</Typography>
              <Typography style={AVATextStyle({ size: 0.95 })}>{'This group'}</Typography>
            </Box>
          ) : (
            <Box mt={1}>
              <Typography style={AVATextStyle({ size: 0.85, margin: { bottom: 0.5 } })}>
                {'Target Groups (where)'}
              </Typography>
              {(action.where || []).length > 0 && (
                <Box display='flex' flexWrap='wrap' style={{ gap: 6, marginBottom: 8 }}>
                  {(action.where || []).map((gid, gIdx) => {
                    const match = adminHierarchy.find((g) => g.id === gid);
                    return (
                      <Chip
                        key={`chip_${actionIndex}_${gIdx}`}
                        label={match ? `${match.name}` : gid}
                        size='small'
                        onDelete={() => removeGroupFromAction(actionIndex, gIdx)}
                      />
                    );
                  })}
                </Box>
              )}
              {availableGroups.length > 0
                ? (
                  <FormControl fullWidth margin='dense'>
                    <InputLabel>Add a group</InputLabel>
                    <Select
                      value=''
                      onChange={(e) => addGroupToAction(actionIndex, e.target.value)}
                    >
                      {availableGroups.map((g) => {
                        const isParent = parentGroupIds.has(g.id);
                        return (
                          <MenuItem
                            key={g.id}
                            value={g.id}
                            disabled={isParent}
                            style={{
                              paddingLeft: isParent ? 8 + (g.level || 0) * 16 : 24 + (g.level || 0) * 16,
                              fontStyle: isParent ? 'italic' : 'normal',
                            }}
                          >
                            {isParent ? `▸ ${g.name || g.id}` : (g.name || g.id)}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                ) : (
                  <Typography style={AVATextStyle({ size: 0.8 })}>
                    {'All available groups have been added.'}
                  </Typography>
                )
              }
            </Box>
          )
        }
      </Paper>
    );
  };

  // ── Full rule editor ────────────────────────────────────────────────────────
  const renderRuleEditor = () => {
    const rule = local.editingRule;
    if (!rule) { return null; }

    return (
      <Box mt={1} mb={1} px={2} py={2}
        style={{ backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: '0 0 12px 12px' }}
      >
        {/* rule_type */}
        <FormControl fullWidth margin='dense'>
          <InputLabel>Trigger</InputLabel>
          <Select
            value={rule.rule_type}
            onChange={(e) => patchRule((prev) => ({ ...prev, rule_type: e.target.value }))}
          >
            {RULE_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* data_test — only shown when rule_type === 'withData' */}
        {rule.rule_type === 'withData' && (
          <Box mt={1.5} mb={1} px={2} py={1.5}
            style={{ border: '1px solid rgba(0,0,0,0.15)', borderRadius: 12 }}
          >
            <Typography style={AVATextStyle({ size: 0.9, bold: true, margin: { bottom: 0.5 } })}>
              {'Data Condition'}
            </Typography>

            <FormControl fullWidth margin='dense'>
              <InputLabel>Dictionary Field</InputLabel>
              <Select
                value={rule.data_test?.dictionaryField || ''}
                onChange={(e) => patchRule((prev) => ({
                  ...prev,
                  data_test: { ...(prev.data_test || {}), dictionaryField: e.target.value },
                }))}
              >
                {local.dictionaryFields.length === 0 && (
                  <MenuItem value=''><em>No fields found</em></MenuItem>
                )}
                {local.dictionaryFields.map((f, ndx) => (
                  <MenuItem key={`${f.field_key}-${ndx}`} value={f.field_key}>
                    {f.description || f.field_key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* allow typing a field ID directly if the dictionary is empty or the ID isn't in the list */}
            {local.dictionaryFields.length === 0 && (
              <TextField
                fullWidth
                margin='dense'
                label='Field ID (manual)'
                value={rule.data_test?.dictionaryField || ''}
                onChange={(e) => patchRule((prev) => ({
                  ...prev,
                  data_test: { ...(prev.data_test || {}), dictionaryField: e.target.value },
                }))}
              />
            )}

            <FormControl fullWidth margin='dense'>
              <InputLabel>Comparison</InputLabel>
              <Select
                value={rule.data_test?.test || 'eq'}
                onChange={(e) => patchRule((prev) => ({
                  ...prev,
                  data_test: { ...(prev.data_test || {}), test: e.target.value },
                }))}
              >
                {TEST_TYPES.map((t) => (
                  <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              margin='dense'
              label='Test Value'
              value={rule.data_test?.testValue || ''}
              onChange={(e) => patchRule((prev) => ({
                ...prev,
                data_test: { ...(prev.data_test || {}), testValue: e.target.value },
              }))}
            />
          </Box>
        )}

        {/* actions list — only for onAdd / onRemove rules; withData rules have no actions */}
        {rule.rule_type !== 'withData' && (
          <Box mt={2}>
            <Typography style={AVATextStyle({ size: 0.9, bold: true, margin: { bottom: 0.5 } })}>
              {'Actions'}
            </Typography>
            {(rule.actions || []).map((action, actionIndex) =>
              renderActionEditor(action, actionIndex)
            )}

            {/* Save / Cancel — above Add Action */}
            <Box display='flex' flexDirection='row' justifyContent='flex-end' mt={1} mb={1} style={{ gap: 8 }}>
              <Button size='small' className={AVAClass.AVAButton} onClick={cancelEdit}>
                {'Cancel'}
              </Button>
              <Button
                size='small'
                className={AVAClass.AVAButton}
                style={{ backgroundColor: 'green', color: 'white' }}
                onClick={saveEdit}
                disabled={!(rule.actions || []).length}
              >
                {'Save Rule'}
              </Button>
            </Box>

            <Button
              size='small'
              className={AVAClass.AVAButton}
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => patchRule((prev) => ({
                ...prev,
                actions: [...(prev.actions || []), emptyAction()],
              }))}
            >
              {'Add Action'}
            </Button>
          </Box>
        )}

        {/* Save / Cancel — for withData rules (no actions section) */}
        {rule.rule_type === 'withData' && (
          <Box display='flex' flexDirection='row' justifyContent='flex-end' mt={2} style={{ gap: 8 }}>
            <Button size='small' className={AVAClass.AVAButton} onClick={cancelEdit}>
              {'Cancel'}
            </Button>
            <Button
              size='small'
              className={AVAClass.AVAButton}
              style={{ backgroundColor: 'green', color: 'white' }}
              onClick={saveEdit}
              disabled={!rule.data_test?.dictionaryField || !rule.data_test?.testValue}
            >
              {'Save Rule'}
            </Button>
          </Box>
        )}
      </Box>
    );
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Box key='groupRulesSection_masterBox' flexGrow={2} px={2} py={4} display='flex' flexDirection='column'>
      <Typography style={AVATextStyle({ bold: true, size: 1.2, margin: { bottom: 0.5 } })}>
        {'Group Rules'}
      </Typography>
      <Typography style={AVATextStyle({ size: 0.9, margin: { bottom: 1.5 } })}>
        {'Rules define automatic membership actions that fire when a member is added to or removed from this group, or when a data condition is met.'}
      </Typography>

      {currentRules.length === 0 && local.expandedIndex !== -1 && (
        <Typography style={AVATextStyle({ size: 0.9, margin: { bottom: 1 } })}>
          {'No rules defined yet.'}
        </Typography>
      )}

      {/* Existing rules */}
      {currentRules.map((rule, ruleIndex) => (
        <Box key={`rule_${ruleIndex}`} mb={1}>
          {/* Header row — click to expand/collapse */}
          <Box
            display='flex' flexDirection='row' alignItems='center' justifyContent='space-between'
            px={2} py={1.5}
            style={{
              backgroundColor: 'rgba(0,0,0,0.06)',
              borderRadius: local.expandedIndex === ruleIndex ? '12px 12px 0 0' : 12,
              cursor: 'pointer',
            }}
            onClick={() => startEdit(ruleIndex)}
          >
            <Box flexGrow={1}>
              <Typography style={AVATextStyle({ bold: true, size: 1 })}>
                {ruleTypeLabel(rule.rule_type)}
              </Typography>
              {rule.rule_type === 'withData' && rule.data_test?.dictionaryField && (
                <Typography style={AVATextStyle({ size: 0.82, margin: { top: 0.2 } })}>
                  {`${rule.data_test.dictionaryField} ${rule.data_test.test || ''} "${rule.data_test.testValue || ''}"`}
                </Typography>
              )}
              {rule.rule_type === 'withData'
                ? (
                  <Typography style={AVATextStyle({ size: 0.82, margin: { top: 0.2 }, color: 'grey' })}>
                    {'Members matching the condition are managed automatically'}
                  </Typography>
                )
                : (rule.actions || []).map((action, ai) => renderActionSummary(action, ai, rule.rule_type))
              }
            </Box>
            <Box display='flex' flexDirection='row' alignItems='center'>
              {/* Backfill button — only for onAdd rules */}
              {(rule.rule_type === 'onAdd') && (() => {
                const bf = local.backfillState[ruleIndex];
                const group_id = currentValues?.Groups?.group_id;
                const client_id = state.session.client_id;
                if (bf?.running) {
                  return (
                    <Typography
                      style={AVATextStyle({ size: 0.78, color: 'grey', margin: { right: 1 } })}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {`Running… ${bf.done}/${bf.total}`}
                    </Typography>
                  );
                }
                if (bf?.done != null && !bf.running) {
                  return (
                    <Typography
                      style={AVATextStyle({ size: 0.78, color: 'green', margin: { right: 1 } })}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {`Done (${bf.total} processed)`}
                    </Typography>
                  );
                }
                return (
                  <Button
                    size='small'
                    className={AVAClass.AVAButton}
                    style={{ marginRight: 4, fontSize: '0.72rem' }}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!group_id) { return; }
                      update({ backfillState: { ...local.backfillState, [ruleIndex]: { running: true, done: 0, total: 0 } } });
                      let lastTotal = 0;
                      await backfillOnAddRule(group_id, client_id, ({ done, total }) => {
                        lastTotal = total;
                        update({ backfillState: { ...local.backfillState, [ruleIndex]: { running: true, done, total } } });
                      });
                      update({ backfillState: { ...local.backfillState, [ruleIndex]: { running: false, done: lastTotal, total: lastTotal } } });
                      if (parentUpdateReactData) { parentUpdateReactData({ membershipChange: true }); }
                    }}
                  >
                    {'Run for existing members'}
                  </Button>
                );
              })()}
              <IconButton
                size='small'
                onClick={(e) => { e.stopPropagation(); deleteRule(ruleIndex); }}
                title='Delete this rule'
              >
                <DeleteIcon fontSize='small' />
              </IconButton>
              {local.expandedIndex === ruleIndex ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>
          </Box>

          {/* Inline editor */}
          {local.expandedIndex === ruleIndex && renderRuleEditor()}
        </Box>
      ))}

      {/* New rule form */}
      {local.expandedIndex === -1 && (
        <Box mb={1}>
          <Box
            px={2} py={1.5}
            style={{ backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '12px 12px 0 0' }}
          >
            <Typography style={AVATextStyle({ bold: true, size: 1 })}>
              {'New Rule'}
            </Typography>
          </Box>
          {renderRuleEditor()}
        </Box>
      )}

      {/* Add rule button */}
      {local.expandedIndex !== -1 && (
        <Button
          className={AVAClass.AVAButton}
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => startEdit(-1)}
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        >
          {'Add Rule'}
        </Button>
      )}
    </Box>
  );
};
