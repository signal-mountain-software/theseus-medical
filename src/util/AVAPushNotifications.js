/**
 * AVAPushNotifications.js
 *
 * Client-side utilities for Web Push Notifications in the AVA PWA.
 *
 * Usage summary:
 *   1. Call `initPushNotifications(personId)` once after the user logs in.
 *      This registers the service worker, requests permission, subscribes the
 *      browser, and stores the subscription in SessionsV2 so the server can
 *      target this device.
 *   2. Call `sendLocalNotification(title, body, options)` to show an
 *      in-app/foreground notification immediately (no server required).
 *   3. For background/offline notifications, use the Lambda sender
 *      (see lambda/send-push-notification/index.js).
 *
 * Prerequisites:
 *   - Generate VAPID keys:  npx web-push generate-vapid-keys
 *   - Add REACT_APP_VAPID_PUBLIC_KEY to .env (public key only — never the private key)
 *   - Deploy lambda/send-push-notification with both keys as Lambda env vars
 */

import { dbClient } from './AVAUtilities';

const SW_URL = `${process.env.PUBLIC_URL || ''}/push-service-worker.js`;
const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;

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
 * Registers push-service-worker.js.
 * Safe to call multiple times — returns the existing registration if present.
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export async function registerPushServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    // Check if already registered under this URL
    const registrations = await navigator.serviceWorker.getRegistrations();
    const existing = registrations.find((r) =>
      (r.active || r.installing || r.waiting)?.scriptURL?.includes('push-service-worker.js')
    );
    if (existing) return existing;
    return await navigator.serviceWorker.register(SW_URL);
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
 * Full initialization: registers SW, requests permission, subscribes the
 * browser to push, and persists the subscription in DynamoDB SessionsV2.
 *
 * Call this once when the user logs in (e.g., inside withBootstrap or TheseusScreen).
 *
 * @param {string} personId  - The user's person_id / session_id
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function initPushNotifications(personId) {
  if (!isPushSupported()) {
    return { success: false, reason: 'unsupported' };
  }
  if (!VAPID_PUBLIC_KEY) {
    console.warn('AVAPush: REACT_APP_VAPID_PUBLIC_KEY is not set — push disabled');
    return { success: false, reason: 'no_vapid_key' };
  }

  const registration = await registerPushServiceWorker();
  if (!registration) return { success: false, reason: 'sw_registration_failed' };

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    return { success: false, reason: 'permission_denied' };
  }

  try {
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    // Persist in SessionsV2 so the Lambda sender can look it up by person_id
    await dbClient
      .update({
        TableName: 'SessionsV2',
        Key: { session_id: personId },
        UpdateExpression: 'set push_subscription = :s',
        ExpressionAttributeValues: { ':s': JSON.stringify(subscription) },
      })
      .promise();

    return { success: true };
  } catch (error) {
    console.error('AVAPush: subscribe error', error);
    return { success: false, reason: error.message };
  }
}

/**
 * Removes the push subscription from this browser and from DynamoDB.
 * Call when a user explicitly opts out of notifications.
 *
 * @param {string} personId
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function unsubscribeFromPush(personId) {
  if (!('serviceWorker' in navigator)) return { success: false, reason: 'unsupported' };
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const reg of registrations) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
    await dbClient
      .update({
        TableName: 'SessionsV2',
        Key: { session_id: personId },
        UpdateExpression: 'remove push_subscription',
      })
      .promise();
    return { success: true };
  } catch (error) {
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
