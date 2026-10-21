export const PERSON_TYPE_LABELS = {
  staff: 'Staff',
  family: 'Family Member',
  core: 'Core Member',
  guest: 'Guest',
  admin: 'Internal Administrator',
  inactive: 'Inactive'
};

export function getPersonTypeLabel(personType) {
  return typeof personType === 'string' && Object.prototype.hasOwnProperty.call(PERSON_TYPE_LABELS, personType)
    ? PERSON_TYPE_LABELS[personType]
    : null;
}

export function getConfiguredPersonType(accountConfig) {
  const personType = accountConfig?.person_type;
  if (personType === 'admin') {
    throw new Error('The admin person_type is reserved for database administrators and cannot be assigned through new_account_form.');
  }
  if (personType === 'inactive') {
    throw new Error('The inactive person_type is computed from inactive_account and cannot be assigned through new_account_form.');
  }
  if (!getPersonTypeLabel(personType)) {
    throw new Error(`Account type "${accountConfig?.account_type || '(not selected)'}" must configure person_type as staff, family, core, or guest in new_account_form.`);
  }
  return personType;
}

// Display-only: the raw stored person_type (staff/family/core/guest/admin) never changes just
// because an account goes inactive - this only governs what's shown to users, so the original
// classification is still there, intact, if the account is later reactivated.
export function getDisplayPersonType(personRecord) {
  return personRecord?.inactive_account ? 'inactive' : personRecord?.person_type;
}

// Matches a person record against a requested person_type. By default, an inactive account
// never matches its original type (only 'inactive' itself does) - so "give me all core people"
// naturally excludes anyone deactivated. Pass { includeInactive: true } to match against the
// underlying stored person_type regardless of inactive_account status (e.g. a full audit/export
// that wants deactivated accounts included under their original type).
export function personTypeMatches(personRecord, personType, { includeInactive = false } = {}) {
  const typeToCompare = includeInactive ? personRecord?.person_type : getDisplayPersonType(personRecord);
  return typeToCompare === personType;
}

export function filterByPersonType(peopleList, personType, options = {}) {
  return (peopleList || []).filter(p => personTypeMatches(p, personType, options));
}

export async function resolvePersonType(accountConfig, existingPersonType, confirmChange) {
  const configuredType = getConfiguredPersonType(accountConfig);
  if (existingPersonType === 'admin') {
    return existingPersonType;
  }
  if (existingPersonType === undefined || existingPersonType === null || existingPersonType === configuredType) {
    return configuredType;
  }
  return await confirmChange(existingPersonType, configuredType)
    ? configuredType
    : existingPersonType;
}
