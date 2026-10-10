export const PERSON_TYPE_LABELS = {
  staff: 'Staff',
  family: 'Family Member',
  core: 'Core Member',
  guest: 'Guest',
  admin: 'Internal Administrator'
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
  if (!getPersonTypeLabel(personType)) {
    throw new Error(`Account type "${accountConfig?.account_type || '(not selected)'}" must configure person_type as staff, family, core, or guest in new_account_form.`);
  }
  return personType;
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
