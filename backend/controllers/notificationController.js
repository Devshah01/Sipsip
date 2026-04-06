const NotificationSettings = require('../models/NotificationSettings');
const webpush              = require('../utils/vapid');

// ── GET /api/notifications/vapid-public-key ───────────────────────────────────
// Returns the VAPID public key so the frontend can subscribe
exports.getVapidKey = (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

// ── POST /api/notifications/subscribe ─────────────────────────────────────────
// Saves the browser's push subscription for this user
exports.subscribe = async (req, res) => {
  try {
    const { subscription, timeZone: tzRaw } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ success: false, message: 'Invalid subscription object' });
    }

    const update = { pushSubscription: subscription, enabled: true };
    if (typeof tzRaw === 'string') {
      const tz = tzRaw.trim();
      if (tz.length > 0 && tz.length <= 120) update.timeZone = tz;
    }

    const settings = await NotificationSettings.findOneAndUpdate(
      { userId: req.user._id },
      update,
      { upsert: true, returnDocument: 'after' },
    );

    res.json({ success: true, settings });
  } catch (err) {
    console.error('[subscribe]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/notifications/unsubscribe ───────────────────────────────────────
// Clears the push subscription and disables pushes
exports.unsubscribe = async (req, res) => {
  try {
    await NotificationSettings.findOneAndUpdate(
      { userId: req.user._id },
      { pushSubscription: null, enabled: false },
      { upsert: true },
    );
    res.json({ success: true });
  } catch (err) {
    console.error('[unsubscribe]', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/notifications/settings ──────────────────────────────────────────
exports.getSettings = async (req, res) => {
  try {
    const settings = await NotificationSettings.findOne({ userId: req.user._id });
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── PATCH /api/notifications/settings ────────────────────────────────────────
exports.updateSettings = async (req, res) => {
  try {
    const fields = ['enabled', 'frequencyMinutes', 'wakeTime', 'sleepTime', 'timeZone'];
    const update = {};
    fields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });

    if (update.timeZone !== undefined) {
      const z = String(update.timeZone).trim();
      update.timeZone = z.length === 0 ? null : z.length <= 120 ? z : undefined;
      if (update.timeZone === undefined) delete update.timeZone;
    }

    if (update.frequencyMinutes !== undefined) {
      const n = Number(update.frequencyMinutes);
      if (Number.isNaN(n)) delete update.frequencyMinutes;
      else update.frequencyMinutes = Math.max(15, Math.min(480, n));
    }

    const REMINDER_KEYS = ['sip', 'goal', 'morning', 'streak', 'weekly', 'bed'];
    if (req.body.reminderPreferences && typeof req.body.reminderPreferences === 'object') {
      const prev = await NotificationSettings.findOne({ userId: req.user._id }).lean();
      const prevPrefs = prev?.reminderPreferences || {};
      const merged = { ...prevPrefs };
      for (const k of REMINDER_KEYS) {
        if (req.body.reminderPreferences[k] !== undefined) {
          merged[k] = Boolean(req.body.reminderPreferences[k]);
        }
      }
      update.reminderPreferences = merged;
    }

    if (Object.keys(update).length === 0) {
      const settings = await NotificationSettings.findOne({ userId: req.user._id });
      return res.json({ success: true, settings });
    }

    const settings = await NotificationSettings.findOneAndUpdate(
      { userId: req.user._id },
      update,
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
    );
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ── POST /api/notifications/send-test ────────────────────────────────────────
exports.sendTest = async (req, res) => {
  try {
    const settings = await NotificationSettings.findOne({ userId: req.user._id });
    if (!settings || !settings.pushSubscription) {
      return res.status(400).json({ success: false, message: 'No push subscription found. Please enable notifications first.' });
    }

    const messages = [
      { title: 'Time for a sip! 💧',       body: 'Your body is 60% water — keep it topped up! Take a refreshing sip right now.' },
      { title: 'Hydration check! 🥤',       body: 'You have been busy — grab your bottle and take a nice long sip. You deserve it!' },
      { title: 'Sip o\'clock! 🌊',          body: 'A quick sip now keeps dehydration away. Your future self will thank you!' },
      { title: 'Hey, drink some water! 💦', body: 'It has been a while since your last sip. Time to hydrate and feel amazing!' },
      { title: 'Stay refreshed! 🧊',        body: 'Dehydration sneaks up on you. Take a sip and keep your energy levels high!' },
      { title: 'Energy boost incoming! ⚡',  body: 'Did you know mild dehydration causes fatigue? A sip of water = instant energy!' },
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];

    const payload = JSON.stringify({
      title: msg.title,
      body:  msg.body,
      url:   '/',
    });

    await webpush.sendNotification(settings.pushSubscription, payload);
    res.json({ success: true });
  } catch (err) {
    console.error('[sendTest]', err);
    if (err.statusCode === 410) {
      // Subscription expired — clean it up
      await NotificationSettings.findOneAndUpdate({ userId: req.user._id }, { pushSubscription: null, enabled: false });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};
