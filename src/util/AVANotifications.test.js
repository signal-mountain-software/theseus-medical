import { getNotificationDisplayOptions, normalizeNotificationSince, INITIAL_NOTIFICATION_CHECK_TIME } from './AVANotifications';

describe('getNotificationDisplayOptions', () => {
  it('persists until dismissal when requested and uses the supplied position', () => {
    const result = getNotificationDisplayOptions({
      priority: 'high',
      persist_until_dismissed: true,
      position_vertical: 'top',
      position_horizontal: 'right',
      play_sound: true
    });

    expect(result.autoHideDuration).toBeNull();
    expect(result.anchorOrigin).toEqual({ vertical: 'top', horizontal: 'right' });
    expect(result.playSound).toBe(true);
  });

  it('falls back to the default snackbar position and regular timeout', () => {
    const result = getNotificationDisplayOptions({ priority: 'low' });

    expect(result.autoHideDuration).toBe(8000);
    expect(result.anchorOrigin).toEqual({ vertical: 'bottom', horizontal: 'center' });
    expect(result.playSound).toBe(false);
  });

  it('uses the historical initial notification checkpoint when none is set', () => {
    expect(normalizeNotificationSince(null)).toBe(INITIAL_NOTIFICATION_CHECK_TIME);
    expect(normalizeNotificationSince('')).toBe(INITIAL_NOTIFICATION_CHECK_TIME);
    expect(normalizeNotificationSince('2026-01-01T00:00:00.000Z')).toBe('2026-01-01T00:00:00.000Z');
  });
});
