/**
 * AVAPushNotifications.js
 *
 * Client-side utilities for Web Push Notifications in the AVA PWA.
 *
 * Usage summary:
 *   1. Call `initPushNotifications(personId)` when the user clicks "Enable Alert Notifications".
 *      This registers the service worker if needed, requests browser permission, subscribes the
 *      browser, and stores the subscription in PushSubscriptions (DynamoDB) keyed by
 *      (endpoint, person_id). Multiple users on the same device each get their own row.
 *      Multiple devices per user are also supported — the Lambda queries by person_id GSI
 *      and sends to all of that user's active subscriptions.
 *   2. Call `sendLocalNotification(title, body, options)` to show an
 *      in-app/foreground notification immediately (no server required).
 *   3. For background/offline notifications, use the Lambda sender
 *      (see lambda/send-push-notification/index.js).
 *
 * localStorage key 'ava_push_users':
 *   Stores a JSON array of person_id strings that have opted in on this device,
 *   e.g. ["jsmith-acme", "bjones-acme"]. Used as a fast, synchronous signal to
 *   drive the Enable/Disable menu label without a DB round-trip.
 *   Sign-out takes no action on this value — each user manages their own entry.
 *
 * PushSubscriptions table schema:
 *   PK: endpoint (String)  — the push endpoint URL; unique per browser install
 *   SK: person_id (String)
 *   GSI person-index: PK = person_id, SK = created_at
 *   Attributes: subscription (String, JSON), sub_status ('active'|'stale'|'disabled'),
 *               created_at (String, ISO), last_seen_at (String, ISO)
 *
 * Prerequisites:
 *   - Generate VAPID keys:  npx web-push generate-vapid-keys
 *   - Add REACT_APP_VAPID_PUBLIC_KEY to .env (public key only — never the private key)
 *   - Deploy lambda/send-push-notification with both keys as Lambda env vars
 */

import { dbClient } from './AVAUtilities';

const SW_URL = `${process.env.PUBLIC_URL || ''}/push-service-worker.js`;
const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;
const PUSH_OPT_IN_KEY = 'ava_push_users';

// ── localStorage helpers ──────────────────────────────────────────────────────

function getPushOptedInUsers() {
  try {
    return JSON.parse(localStorage.getItem(PUSH_OPT_IN_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

function addPushOptedInUser(personId) {
  const users = getPushOptedInUsers();
  if (!users.includes(personId)) {
    localStorage.setItem(PUSH_OPT_IN_KEY, JSON.stringify([...users, personId]));
  }
}

function removePushOptedInUser(personId) {
  const users = getPushOptedInUsers().filter(id => id !== personId);
  if (users.length > 0) {
    localStorage.setItem(PUSH_OPT_IN_KEY, JSON.stringify(users));
  } else {
    localStorage.removeItem(PUSH_OPT_IN_KEY);
  }
}

/**
 * Returns true if this person_id has explicitly opted in to push notifications
 * on this device. Uses localStorage so it survives page reloads without needing
 * an async DB lookup. Notification.permission is NOT reliable for this — once
 * granted it stays 'granted' even after the user disables in our UI.
 *
 * @param {string} personId
 */
export function isPushOptedIn(personId) {
  return getPushOptedInUsers().includes(personId);
}

// Convert URL-safe base64 VAPID public key to Uint8Array as required by the Push API
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

/**
 * Returns true if this browser supports all required push APIs.
 */
export function isPushSupported() {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Returns an existing push SW registration if one is active, or registers
 * a new one. The SW is never unregistered from app code — Chrome's normal
 * update mechanism handles SW lifecycle. Only one register/activate cycle
 * per browser install.
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerPushServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const r of registrations) {
      const worker = r.active || r.installing || r.waiting;
      if (worker?.scriptURL?.includes('push-service-worker.js')) {
        try { await r.pushManager.getSubscription(); } catch (_) { continue; }
        if (r.active) return r;
        return await new Promise((resolve) => {
          const sw = r.installing || r.waiting;
          if (!sw) return resolve(r);
          sw.addEventListener('statechange', function handler() {
            if (this.state === 'activated') { sw.removeEventListener('statechange', handler); resolve(r); }
            else if (this.state === 'redundant') { sw.removeEventListener('statechange', handler); resolve(null); }
          });
        });
      }
    }
    const registration = await navigator.serviceWorker.register(SW_URL);
    if (registration.active) return registration;
    return await new Promise((resolve) => {
      const sw = registration.installing || registration.waiting;
      if (!sw) return resolve(registration);
      sw.addEventListener('statechange', function handler() {
        if (this.state === 'activated') { sw.removeEventListener('statechange', handler); resolve(registration); }
        else if (this.state === 'redundant') { sw.removeEventListener('statechange', handler); resolve(null); }
      });
    });
  } catch (error) {
    console.error('AVAPush: service worker registration failed', error);
    return null;
  }
}

/**
 * Prompts the user for notification permission.
 * @returns {Promise<'granted'|'denied'|'default'|'unsupported'>}
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return await Notification.requestPermission();
}

/**
 * Enables push notifications for this person on this device.
 * Registers the SW if needed, requests browser permission, then reuses the
 * existing browser push subscription (or creates one if none exists).
 * Writes an 'active' row to PushSubscriptions keyed by (endpoint, person_id)
 * so multiple users on this device — and multiple devices per user — are all
 * independently tracked. Does NOT unsubscribe the browser-level subscription
 * first, since all users on this device share the same push endpoint.
 *
 * @param {string} personId  - The user's person_id / session_id
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function initPushNotifications(personId) {
  if (!isPushSupported()) return { success: false, reason: 'unsupported' };
  if (!VAPID_PUBLIC_KEY) {
    console.warn('AVAPush: REACT_APP_VAPID_PUBLIC_KEY is not set — push disabled');
    return { success: false, reason: 'no_vapid_key' };
  }

  const registration = await registerPushServiceWorker();
  if (!registration) return { success: false, reason: 'sw_registration_failed' };

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return { success: false, reason: 'permission_denied' };

  try {
    // Reuse an existing browser subscription if one is present — creating a new
    // one would invalidate the stored endpoint for every other user on this device.
    const subscription = (await registration.pushManager.getSubscription().catch(() => null))
      || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

    const endpoint = subscription.endpoint;
    const now = new Date().toISOString();

    await dbClient
      .update({
        TableName: 'PushSubscriptions',
        Key: { endpoint, person_id: personId },
        UpdateExpression: [
          'set subscription = :sub',
          'sub_status = :active',
          'last_seen_at = :now',
          'created_at = if_not_exists(created_at, :now)',
        ].join(', '),
        ExpressionAttributeValues: {
          ':sub': JSON.stringify(subscription),
          ':active': 'active',
          ':now': now,
        },
      })
      .promise();

    addPushOptedInUser(personId);
    return { success: true };
  } catch (error) {
    console.error(`AVAPush: subscribe error for ID ${personId}`, error);
    const isStorageError = error.name === 'AbortError' && /storage/i.test(error.message);
    const isNoActiveSW = error.name === 'AbortError' && /no active service worker/i.test(error.message);
    const isInvalidState = error.name === 'InvalidStateError';
    const reason = (isStorageError || isNoActiveSW || isInvalidState) ? 'storage_error' : error.message;
    return { success: false, reason };
  }
}

/**
 * No-op at sign-out. Push subscriptions now live in PushSubscriptions (keyed
 * by endpoint + person_id), so they remain valid across sign-out/sign-in cycles.
 * Each user's row persists and the browser endpoint is shared by all users on
 * this device — there is nothing to clean up at sign-out.
 *
 * This function is retained so existing sign-out call sites don't break.
 *
 * @param {string} _personId
 * @returns {Promise<void>}
 */
// eslint-disable-next-line no-unused-vars
export async function clearPushSubscriptionFromDB(_personId) {
  // intentional no-op
}

/**
 * Disables push notifications for this person on this device.
 * Marks their (endpoint, person_id) row in PushSubscriptions as 'disabled'
 * and removes them from the localStorage per-user opt-in list.
 * Does NOT unsubscribe the browser-level push subscription — other users on
 * this device may still be opted in and share the same endpoint.
 *
 * @param {string} personId
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function unsubscribeFromPush(personId) {
  if (!('serviceWorker' in navigator)) return { success: false, reason: 'unsupported' };
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    let endpoint = null;
    for (const r of registrations) {
      const sub = await r.pushManager.getSubscription().catch(() => null);
      if (sub) { endpoint = sub.endpoint; break; }
    }

    if (endpoint) {
      await dbClient
        .update({
          TableName: 'PushSubscriptions',
          Key: { endpoint, person_id: personId },
          UpdateExpression: 'set sub_status = :disabled',
          ExpressionAttributeValues: { ':disabled': 'disabled' },
        })
        .promise();
    }

    removePushOptedInUser(personId);
    return { success: true };
  } catch (error) {
    console.error(`AVAPush: unsubscribe error for ID ${personId}`, error);
    return { success: false, reason: error.message };
  }
}

/**
 * Shows a local (foreground) notification immediately using the Notification API.
 * Works only if the app IS active and permission has been granted.
 * No server or push subscription required.
 *
 * @param {string} title
 * @param {string} body
 * @param {object} [options]  - Any valid NotificationOptions (icon, tag, data, etc.)
 */
export function sendLocalNotification(title, body, options = {}) {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  // Prefer service-worker-based notification so it works uniformly on mobile
  navigator.serviceWorker.ready.then((registration) => {
    registration.showNotification(title, {
      body,
      icon: options.icon || '/logo192.png',
      badge: options.badge || '/favicon-32x32.png',
      tag: options.tag || 'ava-local',
      data: options.data || {},
      requireInteraction: options.requireInteraction || false,
      ...options,
    });
  });
}
