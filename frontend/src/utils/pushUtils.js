/**
 * pushUtils.js — Web Push helper utilities for SipSip frontend
 *
 * Handles service worker registration, push subscription, and talking to the backend.
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function getClientTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (_) {
    return 'UTC';
  }
}

// Convert a base64 URL-safe string to a Uint8Array (required by PushManager)
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

// ─── Register SW ──────────────────────────────────────────────────────────────
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers are not supported in this browser.');
  }
  const reg = await navigator.serviceWorker.register('/push-sw.js', { scope: '/' });
  // Wait until the SW is active
  await navigator.serviceWorker.ready;
  return reg;
}

// ─── Subscribe ────────────────────────────────────────────────────────────────
export async function subscribeToPush(authToken) {
  const reg = await registerServiceWorker();

  // Fetch VAPID public key from server
  const keyRes  = await fetch(`${API_BASE}/notifications/vapid-public-key`);
  const keyData = await keyRes.json();
  const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);

  // Request push subscription from the browser
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey,
    });
  }

  // Save subscription to backend
  const res = await fetch(`${API_BASE}/notifications/subscribe`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      timeZone: getClientTimeZone(),
    }),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to save push subscription on server');
  return { subscription: sub, settings: data.settings };
}

// ─── Unsubscribe ──────────────────────────────────────────────────────────────
export async function unsubscribeFromPush(authToken) {
  if (!('serviceWorker' in navigator)) return;

  const reg = await navigator.serviceWorker.getRegistration('/push-sw.js');
  if (reg) {
    const sub = await reg.pushManager.getSubscription();
    if (sub) await sub.unsubscribe();
  }

  // Notify backend
  await fetch(`${API_BASE}/notifications/unsubscribe`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    credentials: 'include',
  });
}

// ─── Send test via server ─────────────────────────────────────────────────────
export async function sendTestPush(authToken) {
  const res = await fetch(`${API_BASE}/notifications/send-test`, {
    method:  'POST',
    headers: { 'Authorization': `Bearer ${authToken}` },
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Test push failed');
  return data;
}

// ─── Settings (authenticated) ────────────────────────────────────────────────
export async function fetchNotificationSettings(authToken) {
  const res = await fetch(`${API_BASE}/notifications/settings`, {
    headers: { Authorization: `Bearer ${authToken}` },
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to load notification settings');
  return data.settings;
}

export async function patchNotificationSettings(authToken, body) {
  const res = await fetch(`${API_BASE}/notifications/settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ ...body, timeZone: getClientTimeZone() }),
    credentials: 'include',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to update notification settings');
  return data.settings;
}
