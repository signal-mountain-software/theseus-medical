import React from 'react';
import { Box, Typography, TextField, Switch, FormControlLabel, RadioGroup, Radio } from '@material-ui/core/';
import { AVATextStyle } from '../../util/AVAStyles';

export default ({ currentValues, updateField }) => {
  const policy = currentValues.customizationRecs?.session_policy?.customization_value || {};

  const PERSISTENT_DEFAULTS = {
    mode: 'persistent',
    cookie_ttl_hours: 2160,
    absolute_session_max_hours: 2160,
    idle_timeout_minutes: null,
    force_reauth_on_resume: false,
    force_reauth_on_refresh: false,
    enforce_on_sensitive_actions: false,
    fallback_to_legacy_cookie_expiry_days: true,
  };

  const STRICT_DEFAULTS = {
    mode: 'strict',
    cookie_ttl_hours: 3,
    absolute_session_max_hours: 3,
    idle_timeout_minutes: 15,
    force_reauth_on_resume: false,
    force_reauth_on_refresh: false,
    enforce_on_sensitive_actions: false,
    fallback_to_legacy_cookie_expiry_days: false,
  };

  const readNumericValue = (rawValue) => {
    const trimmed = String(rawValue || '').trim();
    if (trimmed === '') {
      return null;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return parsed;
  };

  const setPresetDefaults = async (presetName) => {
    const defaults = (presetName === 'strict') ? STRICT_DEFAULTS : PERSISTENT_DEFAULTS;
    const updateList = Object.keys(defaults).map((key) => ({
      tableName: 'customizationRecs',
      fieldName: `session_policy.customization_value.${key}`,
      newData: defaults[key],
    }));
    await updateField({ updateList });
  };

  const updateManualField = async (fieldName, newData) => {
    await updateField({
      updateList: [{
        tableName: 'customizationRecs',
        fieldName: `session_policy.customization_value.${fieldName}`,
        newData,
      }, {
        tableName: 'customizationRecs',
        fieldName: 'session_policy.customization_value.mode',
        newData: 'custom',
      }]
    });
  };

  const selectedMode = (policy.mode === 'strict')
    ? 'strict'
    : ((policy.mode === 'custom') ? 'custom' : 'persistent');

  return (
    <Box key='sessionSecurity_masterBox' flexGrow={2} px={2} py={4} display='flex' flexDirection='column'>
      <Typography style={AVATextStyle({ italic: true, margin: { bottom: 1 } })}>
        {'Control sign-in persistence and re-auth behavior for this client.'}
      </Typography>

      <Typography style={AVATextStyle({ margin: { top: 1 } })}>{'Set Policy Defaults'}</Typography>
      <RadioGroup
        value={selectedMode}
        onChange={async (event) => {
          if (event.target.value === 'persistent') {
            await setPresetDefaults('persistent');
          }
          else if (event.target.value === 'strict') {
            await setPresetDefaults('strict');
          }
          // Selecting "custom" has no effect; it's display-only guidance.
        }}
      >
        <FormControlLabel
          value='persistent'
          control={<Radio color='primary' />}
          label='Persistent (long sessions, re-auth rarely required)'
        />
        <FormControlLabel
          value='strict'
          control={<Radio color='primary' />}
          label='Strict (short sessions, frequent re-auth)'
        />
        <FormControlLabel
          value='custom'
          control={<Radio color='primary' />}
          label='Custom Values'
        />
      </RadioGroup>

      <TextField
        key={`session_cookie_ttl_hours_${String(policy.cookie_ttl_hours ?? '')}`}
        id='session_cookie_ttl_hours'
        autoComplete='off'
        type='number'
        inputProps={{ min: 0.0167, step: 0.01 }}
        style={{ width: '240px', marginTop: '8px' }}
        onBlur={async (event) => {
          await updateManualField('cookie_ttl_hours', readNumericValue(event.target.value));
        }}
        defaultValue={policy.cookie_ttl_hours ?? 2160}
        helperText='Cookie TTL (hours)'
      />

      <TextField
        key={`session_absolute_max_hours_${String(policy.absolute_session_max_hours ?? '')}`}
        id='session_absolute_max_hours'
        autoComplete='off'
        type='number'
        inputProps={{ min: 0.0167, step: 0.01 }}
        style={{ width: '280px', marginTop: '8px' }}
        onBlur={async (event) => {
          await updateManualField('absolute_session_max_hours', readNumericValue(event.target.value));
        }}
        defaultValue={policy.absolute_session_max_hours ?? 2160}
        helperText='Absolute Session Max Age (hours)'
      />

      <TextField
        key={`session_idle_timeout_minutes_${String(policy.idle_timeout_minutes ?? '')}`}
        id='session_idle_timeout_minutes'
        autoComplete='off'
        type='number'
        inputProps={{ min: 0, step: 1 }}
        style={{ width: '280px', marginTop: '8px' }}
        onBlur={async (event) => {
          await updateManualField('idle_timeout_minutes', readNumericValue(event.target.value));
        }}
        defaultValue={policy.idle_timeout_minutes ?? ''}
        helperText='Idle Timeout (minutes, blank to disable)'
      />

      <TextField
        key={`session_logout_message_${String(policy.logout_message || '')}`}
        id='session_logout_message'
        autoComplete='off'
        style={{ width: '520px', marginTop: '12px' }}
        onBlur={async (event) => {
          await updateManualField('logout_message', event.target.value || 'Session expired. Please sign in again.');
        }}
        defaultValue={policy.logout_message || 'Session expired. Please sign in again.'}
        helperText='Message shown after forced sign-out'
      />

      <Box display='flex' flexDirection='column' marginTop={2}>
        <FormControlLabel
          control={
            <Switch
              color='primary'
              checked={policy.force_reauth_on_resume || false}
              onChange={async () => {
                await updateManualField('force_reauth_on_resume', !policy.force_reauth_on_resume);
              }}
            />
          }
          label='Force Re-auth on Resume'
        />

        <FormControlLabel
          control={
            <Switch
              color='primary'
              checked={policy.force_reauth_on_refresh || false}
              onChange={async () => {
                await updateManualField('force_reauth_on_refresh', !policy.force_reauth_on_refresh);
              }}
            />
          }
          label='Force Re-auth on Refresh'
        />

        <FormControlLabel
          control={
            <Switch
              color='primary'
              checked={policy.enforce_on_sensitive_actions || false}
              onChange={async () => {
                await updateManualField('enforce_on_sensitive_actions', !policy.enforce_on_sensitive_actions);
              }}
            />
          }
          label='Enforce on Sensitive Actions'
        />

        <FormControlLabel
          control={
            <Switch
              color='primary'
              checked={policy.fallback_to_legacy_cookie_expiry_days !== false}
              onChange={async () => {
                await updateManualField('fallback_to_legacy_cookie_expiry_days', !(policy.fallback_to_legacy_cookie_expiry_days !== false));
              }}
            />
          }
          label='Allow fallback to legacy cookie_expiry_days'
        />
      </Box>
    </Box>
  );
};
