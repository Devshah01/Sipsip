/**
 * pushScheduler.js
 * Runs every wall-clock minute (setTimeout + setInterval — no node-cron).
 * 
 * Fixes applied:
 * - Uses ±1 minute tolerance for special notifications (morning, bed, streak, weekly)
 *   with per-day dedup tracking to prevent double-sends.
 * - Uses user's IANA timezone for day-of-week checks (weekly summary).
 * - Falls back to Profile wake/sleep times if NotificationSettings has stale defaults.
 * - Sip interval is based on lastPushedAt (which is now also reset by logSip).
 */

const webpush = require('./vapid');
const NotificationSettings = require('../models/NotificationSettings');
const DailySummary = require('../models/DailySummary');
const Profile = require('../models/Profile');
const { getTodayString } = require('./dateHelper');

// ─── Payload factory ──────────────────────────────────────────────────────────
function makePayload(frequencyMinutes) {
  const messages = [
    '💧 Time to hydrate! Your next sip is due.',
    '🌊 Stay on track — grab a glass of water!',
    '💦 Hydration check! Don\'t forget to sip.',
    '🥤 Your body needs water. Take a sip now!',
    '💧 SipSip reminder — drink up and stay healthy!',
  ];
  const body = messages[Math.floor(Math.random() * messages.length)];
  return JSON.stringify({
    title: 'SipSip 💧',
    body,
    url:   '/',
    tag:   'sipsip-hydration',     // replaces previous notification instead of stacking
    renotify: true,
  });
}

// ─── Timezone helpers ─────────────────────────────────────────────────────────

/**
 * Current "wall clock" minutes (0–1439) in the user's IANA timezone.
 */
function getClockMinutesInTimeZone(ianaTimeZone) {
  if (!ianaTimeZone || typeof ianaTimeZone !== 'string') {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: ianaTimeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const h = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const m = parseInt(parts.find(p => p.type === 'minute').value, 10);
    return h * 60 + (Number.isNaN(m) ? 0 : m);
  } catch (_) {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

/**
 * Get the day of week (0=Sun … 6=Sat) in the user's timezone.
 */
function getDayOfWeekInTimeZone(ianaTimeZone) {
  if (!ianaTimeZone || typeof ianaTimeZone !== 'string') {
    return new Date().getDay();
  }
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimeZone,
      weekday: 'short',
    });
    const dayStr = fmt.format(new Date());
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return map[dayStr] ?? new Date().getDay();
  } catch (_) {
    return new Date().getDay();
  }
}

/**
 * Get today's date string (YYYY-MM-DD) in the user's timezone.
 */
function getTodayInTimeZone(ianaTimeZone) {
  if (!ianaTimeZone || typeof ianaTimeZone !== 'string') {
    return new Date().toISOString().split('T')[0];
  }
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ianaTimeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date());
    const y = parts.find(p => p.type === 'year').value;
    const m = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    return `${y}-${m}-${d}`;
  } catch (_) {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Parse "HH:MM" into total minutes.
 */
function parseHHMM(s) {
  if (!s || typeof s !== 'string') return 7 * 60;
  const [hStr, mStr] = s.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (Number.isNaN(h)) return 7 * 60;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

/**
 * Check if nowMins is within ±tolerance of targetMins (handles midnight wrap).
 */
function isNearMinute(nowMins, targetMins, tolerance = 1) {
  const diff = Math.abs(nowMins - targetMins);
  // Handle midnight wraparound (e.g., now=1439, target=0 → diff should be 1)
  return diff <= tolerance || (1440 - diff) <= tolerance;
}

function isInWindow(wakeTime, sleepTime, timeZone) {
  const nowMins = getClockMinutesInTimeZone(timeZone);
  const wakeMins  = parseHHMM(wakeTime);
  const sleepMins = parseHHMM(sleepTime);
  const crossesMidnight = sleepMins <= wakeMins;
  if (crossesMidnight) {
    return nowMins >= wakeMins || nowMins < sleepMins;
  }
  return nowMins >= wakeMins && nowMins < sleepMins;
}

// ─── Main scheduler loop ─────────────────────────────────────────────────────

async function runScheduler() {
  try {
    const candidates = await NotificationSettings.find({
      enabled: true,
      'pushSubscription.endpoint': { $exists: true, $ne: null },
    });

    const now = new Date();

    for (const settings of candidates) {
      // Resolve wake/sleep times: prefer NotificationSettings, fall back to Profile
      let wakeTime  = settings.wakeTime;
      let sleepTime = settings.sleepTime;

      // If the settings still have the schema defaults and a Profile exists with
      // different values, use the Profile values (handles legacy accounts)
      if (wakeTime === '07:00' && sleepTime === '23:00') {
        try {
          const profile = await Profile.findOne({ userId: settings.userId }).lean();
          if (profile) {
            if (profile.wakeTime && profile.wakeTime !== '07:00')  wakeTime = profile.wakeTime;
            if (profile.sleepTime && profile.sleepTime !== '23:00') sleepTime = profile.sleepTime;
            // Backfill so we don't query Profile every tick
            if (wakeTime !== settings.wakeTime || sleepTime !== settings.sleepTime) {
              settings.wakeTime  = wakeTime;
              settings.sleepTime = sleepTime;
              await settings.save();
            }
          }
        } catch (_) { /* ignore — use defaults */ }
      }

      const wakeMins  = parseHHMM(wakeTime);
      const sleepMins = parseHHMM(sleepTime);
      const nowMins   = getClockMinutesInTimeZone(settings.timeZone);
      const todayStr  = getTodayInTimeZone(settings.timeZone);

      // ── Morning Nudge ──────────────────────────────────────────────────
      if (
        settings.reminderPreferences?.morning &&
        isNearMinute(nowMins, wakeMins) &&
        settings.lastMorningSentDate !== todayStr
      ) {
        try {
          await webpush.sendNotification(
            settings.pushSubscription,
            JSON.stringify({
              title: 'Good Morning! 🌅',
              body: 'Time to start the day right with your first glass of water.',
              url: '/',
              tag: 'sipsip-morning',
              renotify: true,
            })
          );
          settings.lastMorningSentDate = todayStr;
          await settings.save();
          console.log(`[PushScheduler] Sent morning nudge to user ${settings.userId}`);
        } catch (e) { await handlePushError(e, settings); }
      }

      // ── Weekly Summary (Sunday at wake time) ───────────────────────────
      const dayOfWeek = getDayOfWeekInTimeZone(settings.timeZone);
      if (
        settings.reminderPreferences?.weekly &&
        dayOfWeek === 0 &&
        isNearMinute(nowMins, wakeMins) &&
        settings.lastWeeklySentDate !== todayStr
      ) {
        try {
          await webpush.sendNotification(
            settings.pushSubscription,
            JSON.stringify({
              title: 'Weekly Summary 📊',
              body: 'Your weekly hydration review is here. Take a look at your progress!',
              url: '/',
              tag: 'sipsip-weekly',
              renotify: true,
            })
          );
          settings.lastWeeklySentDate = todayStr;
          await settings.save();
          console.log(`[PushScheduler] Sent weekly summary to user ${settings.userId}`);
        } catch (e) { await handlePushError(e, settings); }
      }

      // ── Bedtime Check-in (30 min before sleep) ─────────────────────────
      const bedMins = sleepMins - 30 >= 0 ? sleepMins - 30 : sleepMins - 30 + 1440;
      if (
        settings.reminderPreferences?.bed &&
        isNearMinute(nowMins, bedMins) &&
        settings.lastBedSentDate !== todayStr
      ) {
        try {
          await webpush.sendNotification(
            settings.pushSubscription,
            JSON.stringify({
              title: 'Bedtime Check-in 🌙',
              body: 'Have a small sip of water before catching some Z\'s.',
              url: '/',
              tag: 'sipsip-bed',
              renotify: true,
            })
          );
          settings.lastBedSentDate = todayStr;
          await settings.save();
          console.log(`[PushScheduler] Sent bedtime check-in to user ${settings.userId}`);
        } catch (e) { await handlePushError(e, settings); }
      }

      // ── Streak Alert (2 hours before sleep) ────────────────────────────
      const streakMins = sleepMins - 120 >= 0 ? sleepMins - 120 : sleepMins - 120 + 1440;
      if (
        settings.reminderPreferences?.streak &&
        isNearMinute(nowMins, streakMins) &&
        settings.lastStreakSentDate !== todayStr
      ) {
        const summary = await DailySummary.findOne({
          userId: settings.userId,
          date: getTodayString(settings.timeZone),
        });
        if (!summary || summary.totalMl < summary.goalMl) {
          try {
            await webpush.sendNotification(
              settings.pushSubscription,
              JSON.stringify({
                title: 'Don\'t break your streak! 🔥',
                body: 'You are close to missing your daily goal. Grab some water!',
                url: '/',
                tag: 'sipsip-streak',
                renotify: true,
              })
            );
            settings.lastStreakSentDate = todayStr;
            await settings.save();
            console.log(`[PushScheduler] Sent streak alert to user ${settings.userId}`);
          } catch (e) { await handlePushError(e, settings); }
        }
      }

      // ── Sip interval reminders (main hydration nudges) ─────────────────
      if (settings.reminderPreferences && settings.reminderPreferences.sip === false) continue;

      // Check active window
      if (!isInWindow(wakeTime, sleepTime, settings.timeZone)) continue;

      // Check frequency — compare against lastPushedAt (which is now also
      // reset by logSip, so the timer truly starts from the last sip)
      if (settings.lastPushedAt) {
        const msSinceLast = now - new Date(settings.lastPushedAt);
        const minsSinceLast = msSinceLast / 60000;
        if (minsSinceLast < settings.frequencyMinutes) continue;
      }

      // Send sip push
      try {
        await webpush.sendNotification(
          settings.pushSubscription,
          makePayload(settings.frequencyMinutes),
        );
        settings.lastPushedAt = now;
        await settings.save();
        console.log(`[PushScheduler] Sent sip reminder to user ${settings.userId}`);
      } catch (pushErr) {
        await handlePushError(pushErr, settings);
      }
    }
  } catch (err) {
    console.error('[PushScheduler] Scheduler error:', err.message);
  }
}

async function handlePushError(pushErr, settings) {
  console.error(`[PushScheduler] Push error for user ${settings.userId}:`, pushErr.message);
  if (pushErr.statusCode === 410) {
    settings.pushSubscription = null;
    settings.enabled = false;
    await settings.save();
    console.log(`[PushScheduler] Cleaned expired subscription for user ${settings.userId}`);
  }
}

function startScheduler() {
  let busy = false;
  const tick = () => {
    if (busy) {
      console.warn('[PushScheduler] Previous run still in progress; skipping overlapping tick.');
      return;
    }
    busy = true;
    runScheduler().finally(() => { busy = false; });
  };

  const remainder = Date.now() % 60_000;
  const wait = remainder === 0 ? 0 : 60_000 - remainder;

  setTimeout(() => {
    tick();
    setInterval(tick, 60_000);
  }, wait);

  console.log('🔔 Push notification scheduler started (checks every minute)');
}

module.exports = { startScheduler, runScheduler };
