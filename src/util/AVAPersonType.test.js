import { getConfiguredPersonType, getPersonTypeLabel, resolvePersonType } from './AVAPersonType';

describe('getConfiguredPersonType', () => {
  it.each(['staff', 'family', 'core', 'guest'])('accepts explicit %s configuration', person_type => {
    expect(getConfiguredPersonType({ account_type: 'client-specific', person_type })).toBe(person_type);
  });

  it.each([undefined, null, '', 'resident', 'Guest', 'toString', 1, ['staff']])('rejects invalid configuration %p', person_type => {
    expect(() => getConfiguredPersonType({ account_type: 'camper', person_type }))
      .toThrow('Account type "camper" must configure person_type');
  });

  it('does not infer a classification from the account type', () => {
    expect(() => getConfiguredPersonType({ account_type: 'staff' })).toThrow('must configure person_type');
  });

  it('displays core as Core Member', () => {
    expect(getPersonTypeLabel('core')).toBe('Core Member');
  });

  it('recognizes admin for display but rejects it as an app-assigned type', () => {
    expect(getPersonTypeLabel('admin')).toBe('Internal Administrator');
    expect(() => getConfiguredPersonType({ account_type: 'support', person_type: 'admin' }))
      .toThrow('reserved for database administrators');
  });
});

describe('resolvePersonType', () => {
  const config = { account_type: 'caregiver', person_type: 'family' };

  it.each(['staff', 'family', 'core', 'guest'])('preserves database-managed admin when configuration requests %s', async person_type => {
    const confirm = jest.fn();
    expect(await resolvePersonType({ person_type }, 'admin', confirm)).toBe('admin');
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each([undefined, null, 'family'])('uses configuration without prompting for %p', async existingType => {
    const confirm = jest.fn();
    expect(await resolvePersonType(config, existingType, confirm)).toBe('family');
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each(['staff', 'core', 'guest', '', 'resident'])('preserves %p when the user chooses keep', async existingType => {
    const confirm = jest.fn().mockResolvedValue(false);
    expect(await resolvePersonType(config, existingType, confirm)).toBe(existingType);
    expect(confirm).toHaveBeenCalledWith(existingType, 'family');
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it.each(['staff', 'core', 'guest', '', 'resident'])('replaces %p only after confirmation', async existingType => {
    const confirm = jest.fn().mockResolvedValue(true);
    expect(await resolvePersonType(config, existingType, confirm)).toBe('family');
    expect(confirm).toHaveBeenCalledWith(existingType, 'family');
  });

  it('waits for an explicit decision', async () => {
    let decide;
    const confirm = jest.fn(() => new Promise(resolve => { decide = resolve; }));
    const result = resolvePersonType(config, 'guest', confirm);
    let completed = false;
    result.then(() => { completed = true; });
    await Promise.resolve();
    expect(completed).toBe(false);
    decide(true);
    expect(await result).toBe('family');
  });

  it('rejects invalid configuration before asking to change an existing value', async () => {
    const confirm = jest.fn();
    await expect(resolvePersonType({ account_type: 'caregiver' }, 'guest', confirm))
      .rejects.toThrow('must configure person_type');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('does not silently continue when confirmation is interrupted', async () => {
    const confirm = jest.fn().mockRejectedValue(new Error('interrupted'));
    await expect(resolvePersonType(config, 'guest', confirm)).rejects.toThrow('interrupted');
  });
});
