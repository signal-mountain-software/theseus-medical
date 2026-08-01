/**
 * AVANotifications.js
 * 
 * Notification system utilities for displaying database-driven one-time alerts.
 * 
 * Supports:
 * - Broadcast notifications (available_to: ['*all'])
 * - Targeted notifications (available_to: ['person:X'] or ['group:Y'])
 * - Time-window visibility (dont_show_before, dont_show_after)
 * - One-time display guarantee (via NotificationsShown tracking)
 * - Optional persistence until dismissal and sound playback
 */

import AVA_AlertSound from '../ava_alert.mp3';
import { makeDate, addMonths } from './AVADateTime';

export const INITIAL_NOTIFICATION_CHECK_TIME = new Date('1990-01-01T00:00:00.000Z').toISOString();

let notificationAudioRef = null;

export const playNotificationSound = () => {
    try {
        if (typeof window === 'undefined') {
            return false;
        }

        if (!notificationAudioRef) {
            notificationAudioRef = new Audio(AVA_AlertSound);
            notificationAudioRef.preload = 'auto';
            notificationAudioRef.volume = 1;
        }

        notificationAudioRef.currentTime = 0;
        const playbackPromise = notificationAudioRef.play();
        if (playbackPromise && typeof playbackPromise.catch === 'function') {
            playbackPromise.catch(() => {
                // Ignore autoplay restrictions and other browser playback blocks.
            });
        }
        return true;
    } catch (err) {
        console.warn('Unable to play notification sound:', err);
        return false;
    }
};

export const normalizeNotificationSince = (lastCheckTime) => {
    if (lastCheckTime === null || lastCheckTime === undefined || lastCheckTime === '') {
        return INITIAL_NOTIFICATION_CHECK_TIME;
    }
    return lastCheckTime;
};

const normalizeIsoOrDefault = (inputValue, defaultIso) => {
    if (inputValue !== null && inputValue !== undefined && inputValue !== '') {
        const parsed = makeDate(inputValue);
        if (!parsed?.error && parsed?.iso) {
            return parsed.iso;
        }
    }
    return defaultIso;
};

// Shared by createNotification/updateNotification - blank dates default to "now" / "1 month out".
const resolveNotificationWindow = (notificationRec) => {
    const nowIso = new Date().toISOString();
    const defaultDontShowAfter = addMonths(new Date(), 1)?.iso || makeDate(Date.now() + (30 * 24 * 60 * 60 * 1000)).iso;
    return {
        dont_show_before: normalizeIsoOrDefault(notificationRec.dont_show_before, nowIso),
        dont_show_after: normalizeIsoOrDefault(notificationRec.dont_show_after, defaultDontShowAfter)
    };
};

export const getNotificationDisplayOptions = (notif = {}) => {
    const priority = notif.priority || 'low';
    const severity = priorityToSeverity(priority);
    const autoHideDuration = notif.persist_until_dismissed
        ? null
        : getAutoDismissDuration(severity);

    const anchorOrigin = {
        vertical: notif.position_vertical || 'bottom',
        horizontal: notif.position_horizontal || 'center'
    };

    return {
        autoHideDuration,
        anchorOrigin,
        playSound: !!notif.play_sound
    };
};

/**
 * Load notifications from DynamoDB, filter by authorization and time window,
 * check if already shown to user, and queue for display.
 * 
 * @param {object} params
 * @param {object} params.dbClient - AWS DynamoDB client
 * @param {string} params.clientId - Current client_id
 * @param {string} params.userId - Current user_id
 * @param {string} params.lastCheckTime - ISO timestamp of last notification check
 * @param {function} params.authorizedToMenuItem - Function(available_to) => boolean
 * @returns {Promise<object>} { notificationQueue: [], lastCheckTime: ISO }
 */
export const loadAndQueueNotifications = async ({
    dbClient,
    clientId,
    userId,
    lastCheckTime,
    authorizedToMenuItem
}) => {
    try {
        const nowIso = new Date().toISOString();
        const effectiveLastCheckTime = normalizeNotificationSince(lastCheckTime);

        // Query Notifications table for records created since last check
        const result = await dbClient.query({
            TableName: 'Notifications',
            IndexName: 'client_id-created_at-index',
            KeyConditionExpression: 'client_id = :cid AND created_at > :ts',
            ExpressionAttributeValues: {
                ':cid': clientId,
                ':ts': effectiveLastCheckTime,
                ':p': 'pending',
                ':a': 'active'
            },
            FilterExpression: '#status IN (:p, :a)',
            ExpressionAttributeNames: { '#status': 'status' }
        }).promise().catch(err => {
            console.error('Error querying Notifications:', err);
            return { Items: [] };
        });

        const toDisplay = [];

        // Filter and de-duplicate
        for (const notif of (result.Items || [])) {
            // Check time window
            const now = new Date(nowIso);
            const inWindow = (!notif.dont_show_before || now >= new Date(notif.dont_show_before))
                && (!notif.dont_show_after || now <= new Date(notif.dont_show_after));
            if (!inWindow) continue;

            // Check authorization
            if (!authorizedToMenuItem(notif.available_to)) continue;

            // Check if already shown to this user (de-duplication via GSI)
            const shownRec = await dbClient.get({
                TableName: 'NotificationsShown',
                Key: {
                    notification_id: notif.notification_id,
                    user_id: userId
                }
            }).promise().catch(err => {
                console.error('Error querying NotificationsShown:', err);
                return { Item: null };
            });

            if (!shownRec.Item) {
                toDisplay.push(notif);
            }
        }

        return {
            notificationQueue: toDisplay,
            effectiveLastCheckTime,
            lastCheckTime: nowIso,
            success: true
        };
    } catch (err) {
        console.error('loadAndQueueNotifications error:', err);
        return {
            notificationQueue: [],
            effectiveLastCheckTime: normalizeNotificationSince(lastCheckTime),
            lastCheckTime: new Date().toISOString(),
            success: false
        };
    }
};

/**
 * Create a notification record in Notifications table.
 *
 * Pass a full notification record in notificationRec; this helper will fill
 * in missing notification_id, created_at, status, and available_to defaults.
 *
 * @param {object} params
 * @param {object} params.dbClient - AWS DynamoDB client
 * @param {object} params.notificationRec - Notification record to write
 * @returns {Promise<object>} { success, notification }
 */
export const createNotification = async ({
    dbClient,
    state,
    session,
    notificationRec
}) => {
    try {
        if (!dbClient || !notificationRec || typeof notificationRec !== 'object') {
            return {
                success: false,
                notification: null
            };
        }

        const requiredMessage = `${notificationRec.message || ''}`.trim();
        if (!requiredMessage) {
            return {
                success: false,
                notification: null
            };
        }

        const nowIso = new Date().toISOString();
        const clientIdFromState = state?.session?.client_id || session?.client_id;
        const clientId = clientIdFromState || notificationRec.client_id || null;
        if (!clientId) {
            return {
                success: false,
                notification: null
            };
        }

        const item = {
            ...notificationRec,
            client_id: clientId,
            message: requiredMessage,
            created_at: notificationRec.created_at || nowIso,
            status: notificationRec.status || 'active',
            available_to: Array.isArray(notificationRec.available_to) ? notificationRec.available_to : ['*all'],
            ...resolveNotificationWindow(notificationRec)
        };

        const makeRandomNotificationId = () => {
            if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
                return crypto.randomUUID();
            }
            return `notif_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
        };

        let attempts = 0;
        let created = false;
        let writeError = null;

        while (!created && attempts < 5) {
            attempts += 1;
            item.notification_id = notificationRec.notification_id || makeRandomNotificationId();

            try {
                await dbClient.put({
                    TableName: 'Notifications',
                    Item: item,
                    ConditionExpression: 'attribute_not_exists(notification_id)'
                }).promise();
                created = true;
            } catch (err) {
                writeError = err;
                if (err?.code === 'ConditionalCheckFailedException' && !notificationRec.notification_id) {
                    continue;
                }
                throw err;
            }
        }

        if (!created) {
            console.error('Error creating notification: unable to generate a unique notification_id', writeError);
            return {
                success: false,
                notification: null
            };
        }

        return {
            success: true,
            notification: item
        };
    } catch (err) {
        console.error('Error creating notification:', err);
        return {
            success: false,
            notification: null
        };
    }
};

/**
 * Update an existing notification record in place (overwrites the item).
 * Unlike createNotification, this requires notification_id to already be set
 * and does not attempt to generate a new one.
 *
 * @param {object} params
 * @param {object} params.dbClient - AWS DynamoDB client
 * @param {object} params.notificationRec - Full notification record (must include notification_id, client_id, created_at, status)
 * @returns {Promise<object>} { success, notification }
 */
export const updateNotification = async ({ dbClient, notificationRec }) => {
    try {
        if (!dbClient || !notificationRec?.notification_id || !notificationRec?.client_id) {
            return {
                success: false,
                notification: null
            };
        }

        const requiredMessage = `${notificationRec.message || ''}`.trim();
        if (!requiredMessage) {
            return {
                success: false,
                notification: null
            };
        }

        const item = {
            ...notificationRec,
            message: requiredMessage,
            available_to: Array.isArray(notificationRec.available_to) ? notificationRec.available_to : ['*all'],
            ...resolveNotificationWindow(notificationRec)
        };

        await dbClient.put({
            TableName: 'Notifications',
            Item: item
        }).promise();

        return {
            success: true,
            notification: item
        };
    } catch (err) {
        console.error('Error updating notification:', err);
        return {
            success: false,
            notification: null
        };
    }
};

/**
 * List everyone who has seen/dismissed a given notification (NotificationsShown is
 * only written at dismiss-time, so shown_at doubles as the dismissal timestamp).
 *
 * @param {object} params
 * @param {object} params.dbClient - AWS DynamoDB client
 * @param {string} params.notificationId - notification_id to look up
 * @returns {Promise<Array>} [{ notification_id, user_id, shown_at, ttl }]
 */
export const listNotificationViewers = async ({ dbClient, notificationId }) => {
    try {
        const result = await dbClient.query({
            TableName: 'NotificationsShown',
            KeyConditionExpression: 'notification_id = :n',
            ExpressionAttributeValues: { ':n': notificationId }
        }).promise().catch(err => {
            console.error('Error listing NotificationsShown:', err);
            return { Items: [] };
        });
        return result.Items || [];
    } catch (err) {
        console.error('listNotificationViewers error:', err);
        return [];
    }
};

/**
 * Mark a notification as shown for the current user by writing to NotificationsShown table.
 * 
 * @param {object} params
 * @param {object} params.dbClient - AWS DynamoDB client
 * @param {string} params.notificationId - notification_id to mark as shown
 * @param {string} params.userId - Current user_id
 * @returns {Promise<boolean>} true if successful
 */
export const markNotificationShown = async ({
    dbClient,
    notificationId,
    userId
}) => {
    try {
        const ttlEpoch = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days

        await dbClient.put({
            TableName: 'NotificationsShown',
            Item: {
                notification_id: notificationId,
                user_id: userId,
                shown_at: new Date().toISOString(),
                ttl: ttlEpoch
            }
        }).promise();

        return true;
    } catch (err) {
        console.error('Error marking notification as shown:', err);
        return false;
    }
};

/**
 * Reset (un-dismiss) a notification for a single viewer by deleting their
 * NotificationsShown record, so it will be shown to them again.
 *
 * @param {object} params
 * @param {object} params.dbClient - AWS DynamoDB client
 * @param {string} params.notificationId - notification_id to reset
 * @param {string} params.userId - user_id whose viewed/dismissed record should be cleared
 * @returns {Promise<boolean>} true if successful
 */
export const resetNotificationViewer = async ({ dbClient, notificationId, userId }) => {
    try {
        await dbClient.delete({
            TableName: 'NotificationsShown',
            Key: { notification_id: notificationId, user_id: userId }
        }).promise();
        return true;
    } catch (err) {
        console.error('Error resetting notification viewer:', err);
        return false;
    }
};

/**
 * Reset (un-dismiss) a notification for all viewers by deleting every
 * NotificationsShown record for that notification_id.
 *
 * @param {object} params
 * @param {object} params.dbClient - AWS DynamoDB client
 * @param {string} params.notificationId - notification_id to reset
 * @returns {Promise<boolean>} true if successful
 */
export const resetAllNotificationViewers = async ({ dbClient, notificationId }) => {
    try {
        const viewers = await listNotificationViewers({ dbClient, notificationId });
        await Promise.all(viewers.map(viewer => dbClient.delete({
            TableName: 'NotificationsShown',
            Key: { notification_id: notificationId, user_id: viewer.user_id }
        }).promise()));
        return true;
    } catch (err) {
        console.error('Error resetting all notification viewers:', err);
        return false;
    }
};

/**
 * List notifications created for a client (newest first), for management/maintenance UI.
 * Unlike loadAndQueueNotifications, this returns all statuses and ignores per-user dedup.
 *
 * @param {object} params
 * @param {object} params.dbClient - AWS DynamoDB client
 * @param {string} params.clientId - Current client_id
 * @returns {Promise<Array>} notification records, newest first
 */
export const listNotificationsForClient = async ({ dbClient, clientId }) => {
    try {
        const result = await dbClient.query({
            TableName: 'Notifications',
            IndexName: 'client_id-created_at-index',
            KeyConditionExpression: 'client_id = :cid',
            ExpressionAttributeValues: { ':cid': clientId },
            ScanIndexForward: false
        }).promise().catch(err => {
            console.error('Error listing Notifications:', err);
            return { Items: [] };
        });
        return result.Items || [];
    } catch (err) {
        console.error('listNotificationsForClient error:', err);
        return [];
    }
};

/**
 * Stop a notification immediately - marks it cancelled so it's excluded from
 * future queries (loadAndQueueNotifications filters on status pending/active).
 *
 * @param {object} params
 * @param {object} params.dbClient - AWS DynamoDB client
 * @param {string} params.notificationId - notification_id to cancel
 * @returns {Promise<boolean>} true if successful
 */
export const cancelNotification = async ({ dbClient, notificationId }) => {
    try {
        const nowIso = new Date().toISOString();
        await dbClient.update({
            TableName: 'Notifications',
            Key: { notification_id: notificationId },
            UpdateExpression: 'set #status = :cancelled, dont_show_after = :now',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':cancelled': 'cancelled', ':now': nowIso }
        }).promise();
        return true;
    } catch (err) {
        console.error('Error cancelling notification:', err);
        return false;
    }
};

/**
 * Convert notification priority to Alert severity for MUI rendering.
 * 
 * @param {string} priority - 'low' | 'medium' | 'high'
 * @returns {string} 'info' | 'warning' | 'error'
 */
export const priorityToSeverity = (priority) => {
    switch (priority) {
        case 'high':
            return 'error';
        case 'medium':
            return 'warning';
        case 'low':
        default:
            return 'info';
    }
};

/**
 * Get auto-dismiss duration (ms) for notification based on severity.
 * 
 * @param {string} severity - 'success' | 'info' | 'warning' | 'error'
 * @returns {number|null} milliseconds, or null for no auto-dismiss
 */
export const getAutoDismissDuration = (severity) => {
    switch (severity) {
        case 'success':
            return 5000;
        case 'info':
            return 8000;
        case 'warning':
            return 10000;
        case 'error':
            return null; // No auto-dismiss for errors
        default:
            return 8000;
    }
};
