/**
 * pushScheduler.js
 * Runs every wall-clock minute (setTimeout + setInterval — no node-cron).
 * Avoids NODE-CRON "missed execution" warnings when the event loop wakes late
 * (sleep, debugger, brief CPU spikes); pushes are still best-effort each minute.
 */

const webpush = require('./vapid');
const NotificationSettings = require('../models/NotificationSettings');
const DailySummary = require('../models/DailySummary');
const { getTodayString } = require('./dateHelper');

// Payload factory
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

// Current "wall clock" minutes in the user's zone (matches Notifications page + Profile wake/sleep)
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

function isInWindow(wakeTime, sleepTime, timeZone) {
  const nowMins = getClockMinutesInTimeZone(timeZone);
  const [wH, wM] = wakeTime.split(':').map(Number);
  const [sH, sM] = sleepTime.split(':').map(Number);
  const wakeMins  = wH * 60 + wM;
  const sleepMins = sH * 60 + sM;
  const crossesMidnight = sleepMins <= wakeMins;
  if (crossesMidnight) {
    return nowMins >= wakeMins || nowMins < sleepMins;
  }
  return nowMins >= wakeMins && nowMins < sleepMins;
}

async function runScheduler() {
  try {
    const candidates = await NotificationSettings.find({
      enabled: true,
      'pushSubscription.endpoint': { $exists: true, $ne: null },
    });

    const now = new Date();

    for (const settings of candidates) {
      const [wH, wM] = settings.wakeTime.split(':').map(Number);
      const [sH, sM] = settings.sleepTime.split(':').map(Number);
      const wakeMins  = wH * 60 + wM;
      const sleepMins = sH * 60 + sM;
      const nowMins = getClockMinutesInTimeZone(settings.timeZone);

      // Morning Nudge
      if (settings.reminderPreferences?.morning && nowMins === wakeMins) {
        try {
          await webpush.sendNotification(
            settings.pushSubscription,
            JSON.stringify({ title: 'Good Morning! 🌅', body: 'Time to start the day right with your first glass of water.', url: '/', tag: 'sipsip-morning', renotify: true })
          );
        } catch(e) { handlePushError(e, settings); }
      }

      // Weekly Summary (Sunday morning at wake time)
      if (settings.reminderPreferences?.weekly && now.getDay() === 0 && nowMins === wakeMins) {
        try {
          await webpush.sendNotification(
            settings.pushSubscription,
            JSON.stringify({ title: 'Weekly Summary 📊', body: 'Your weekly hydration review is here. Take a look at your progress!', url: '/', tag: 'sipsip-weekly', renotify: true })
          );
        } catch(e) { handlePushError(e, settings); }
      }

      // Bedtime Check-in (30 mins before sleep)
      const bedMins = sleepMins - 30 >= 0 ? sleepMins - 30 : sleepMins - 30 + 1440;
      if (settings.reminderPreferences?.bed && nowMins === bedMins) {
        try {
          await webpush.sendNotification(
            settings.pushSubscription,
            JSON.stringify({ title: 'Bedtime Check-in 🌙', body: 'Have a small sip of water before catching some Z\'s.', url: '/', tag: 'sipsip-bed', renotify: true })
          );
        } catch(e) { handlePushError(e, settings); }
      }

      // Streak Alerts (2 hours before sleep)
      const streakMins = sleepMins - 120 >= 0 ? sleepMins - 120 : sleepMins - 120 + 1440;
      if (settings.reminderPreferences?.streak && nowMins === streakMins) {
        const summary = await DailySummary.findOne({ userId: settings.userId, date: getTodayString() });
        if (!summary || summary.totalMl < summary.goalMl) {
          try {
            await webpush.sendNotification(
              settings.pushSubscription,
              JSON.stringify({ title: 'Don\'t break your streak! 🔥', body: 'You are close to missing your daily goal. Grab some water!', url: '/', tag: 'sipsip-streak', renotify: true })
            );
          } catch(e) { handlePushError(e, settings); }
        }
      }

      // Sip interval reminders (main hydration nudges)
      if (settings.reminderPreferences && settings.reminderPreferences.sip === false) continue;

      // Check active window
      if (!isInWindow(settings.wakeTime, settings.sleepTime, settings.timeZone)) continue;

      // Check frequency
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
        console.log(`[PushScheduler] Sent push to user ${settings.userId}`);
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

module.exports = { startScheduler };
