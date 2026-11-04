export const hasAnswer = value => {
  if (Array.isArray(value)) { return value.some(hasAnswer); }
  return value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '');
};

export const resolveAnswerFieldKey = (key, occurrence, fields) => {
  if (!occurrence || occurrence === 1 || !key) { return key; }
  if (key.endsWith('_occ1')) { return `${key.slice(0, -5)}_occ${occurrence}`; }
  const substituted = key.replace(/(^|[^0-9])1($|[^0-9])/, `$1${occurrence}$2`);
  return substituted !== key && fields[substituted] ? substituted : `${key}_occ${occurrence}`;
};

export const answerSnapshot = fields => Object.fromEntries(Object.entries(fields || {}).map(([key, field]) => [
  key, JSON.stringify([field.value, field.bonusText, field.guestNames]),
]));

// Each target can be cleared at most once per edit; explicitly edited fields win over
// reciprocal rules. Only conditions referencing a changed answer can trigger a clear.
export const applyClearRules = ({ fields, previous, matches, editedKey, resolveKey = key => key, canClear = () => true }) => {
  const current = answerSnapshot(fields);
  const changed = new Set(Object.keys(fields).filter(key => previous[key] !== undefined
    && previous[key] !== current[key]));
  const protectedKeys = editedKey ? new Set([editedKey]) : new Set(changed);
  const cleared = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (const [key, field] of Object.entries(fields)) {
      if (protectedKeys.has(key) || cleared.includes(key) || !canClear(key, field)
        || ![field.value, field.bonusText, field.guestNames].some(hasAnswer)) { continue; }
      const tests = [field.clear_if || []].flat();
      const triggered = tests.some(test => {
        const source = resolveKey(test.field || test.data?.split('.').pop(), field);
        return source && changed.has(source) && matches(test, field);
      });
      if (!triggered) { continue; }
      field.value = Array.isArray(field.value) ? [] : '';
      field.valueText = '';
      field.bonusText = '';
      if (field.guestNames) { field.guestNames = []; }
      field.isError = false;
      field.errorMessage = '';
      field._clearedByRule = true;
      cleared.push(key);
      changed.add(key);
      progress = true;
    }
  }
  return cleared;
};

export const countSectionAnswers = (fields, mode) => fields.reduce((total, field) => {
  if (['header', 'html', 'message', 'button'].includes(field.type)) { return total; }
  const selected = [field.value].flat().filter(hasAnswer);
  const answered = selected.length > 0 || hasAnswer(field.bonusText) || hasAnswer(field.guestNames);
  if (mode === 'fields') { return total + (answered ? 1 : 0); }
  // "Other" text supplies an answer when no option is selected, but never counts twice.
  const selectionField = field.type?.startsWith('select') || field.type?.startsWith('drop');
  return total + (selectionField ? Math.max(selected.length, answered ? 1 : 0) : (answered ? 1 : 0));
}, 0);

export const sectionAnswerError = (section, fields) => {
  const limits = section.answer_limits;
  if (!limits) { return null; }
  if (!['fields', 'selections'].includes(limits.mode)
    || ['min', 'max'].some(key => limits[key] !== undefined && (!Number.isSafeInteger(limits[key]) || limits[key] < 0))
    || (limits.min !== undefined && limits.max !== undefined && limits.min > limits.max)) {
    return `Invalid answer limits for "${section.section_name}". Please contact the form administrator.`;
  }
  const count = countSectionAnswers(fields, limits.mode);
  const unit = limits.mode === 'fields' ? 'answered fields' : 'answers/selections';
  if (limits.min !== undefined && count < limits.min) {
    return `"${section.section_name}" requires at least ${limits.min} ${unit}; currently ${count}.`;
  }
  if (limits.max !== undefined && count > limits.max) {
    return `"${section.section_name}" allows at most ${limits.max} ${unit}; currently ${count}.`;
  }
  return null;
};
