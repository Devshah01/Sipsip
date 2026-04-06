const WaterLog       = require('../models/WaterLog');
const DailySummary   = require('../models/DailySummary');
const Profile        = require('../models/Profile');
const GuestSyncLock  = require('../models/GuestSyncLock');
const { getTodayString, formatTime } = require('../utils/dateHelper');

function normalizeVesselSnapshot(v) {
  if (!v || typeof v !== 'object') return null;
  const id = Number(v.id);
  const volumeMl = Number(v.volumeMl);
  const name = typeof v.name === 'string' ? v.name.trim() : '';
  if (!Number.isFinite(id) || id < 0) return null;
  if (!Number.isFinite(volumeMl) || volumeMl <= 0) return null;
  return { id, name: name || 'Vessel', volumeMl };
}

function mapLogForClient(log, timeZone) {
  return {
    _id:       log._id,
    amount:    log.amount,
    timestamp: formatTime(log.createdAt, timeZone),
    at:        log.createdAt,
    glass:     log.glass,
    jar:       log.jar,
  };
}

// ─────────────────────────────────────
// Helper — update or create DailySummary
// Called after every sip
// ─────────────────────────────────────
const updateDailySummary = async (userId, date, amount) => {
  // Get user's current daily goal
  const profile   = await Profile.findOne({ userId });
  const goalMl    = profile?.dailyGoal || 2000;

  // Find existing summary for today
  let summary = await DailySummary.findOne({ userId, date });
  let justHitGoal = false;

  if (summary) {
    const oldGoalHit = summary.totalMl >= summary.goalMl;
    // Update existing
    summary.totalMl  += amount;
    summary.sipCount += 1;
    summary.goalMl    = goalMl;
    summary.goalHit   = summary.totalMl >= goalMl;
    summary.bestSip   = Math.max(summary.bestSip, amount);
    await summary.save();
    
    if (!oldGoalHit && summary.goalHit) justHitGoal = true;
  } else {
    // Create new summary for today
    summary = await DailySummary.create({
      userId,
      date,
      totalMl:  amount,
      sipCount: 1,
      goalMl,
      goalHit:  amount >= goalMl,
      bestSip:  amount,
    });
    if (summary.goalHit) justHitGoal = true;
  }

  return { summary, justHitGoal };
};

// ─────────────────────────────────────
// @route  POST /api/water/log
// @access Private
// ─────────────────────────────────────
const logSip = async (req, res, next) => {
  try {
    const { amount: rawAmount, glass, jar } = req.body;
    const userId = req.user._id;

    const amount = Number(rawAmount);
    const glassNorm = normalizeVesselSnapshot(glass);
    const jarNorm   = normalizeVesselSnapshot(jar);

    if (!Number.isFinite(amount) || amount < 1) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid amount (ml)',
      });
    }
    if (!glassNorm || !jarNorm) {
      return res.status(400).json({
        success: false,
        message: 'Please provide glass and jar as { id, name, volumeMl }',
      });
    }

    const timeZone = req.headers['x-timezone'];
    const date = getTodayString(timeZone);

    // Create water log
    const log = await WaterLog.create({
      userId,
      date,
      amount,
      glass: glassNorm,
      jar:   jarNorm,
    });

    // Update daily summary
    const { summary, justHitGoal } = await updateDailySummary(userId, date, amount);

    res.status(201).json({
      success: true,
      log: mapLogForClient(log, timeZone),
      dailySummary: {
        totalMl:  summary.totalMl,
        sipCount: summary.sipCount,
        goalHit:  summary.goalHit,
        goalMl:   summary.goalMl,
      }
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────
// @route  GET /api/water/logs/today
// @access Private
// ─────────────────────────────────────
const getTodayLogs = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const timeZone = req.headers['x-timezone'];
    const date   = getTodayString(timeZone);

    // Get all logs for today
    const logs = await WaterLog.find({ userId, date })
      .sort({ createdAt: 1 });

    // Get today's summary
    const summary = await DailySummary.findOne({ userId, date });

    res.status(200).json({
      success: true,
      date,
      logs: logs.map(log => mapLogForClient(log, timeZone)),
      summary: {
        totalMl:  summary?.totalMl  || 0,
        sipCount: summary?.sipCount || 0,
        goalHit:  summary?.goalHit  || false,
        goalMl:   summary?.goalMl   || 2000,
      }
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────
// @route  GET /api/water/logs?date=YYYY-MM-DD
// @access Private
// ─────────────────────────────────────
const getLogsByDate = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const timeZone = req.headers['x-timezone'];
    const date   = req.query.date || getTodayString(timeZone);

    const logs = await WaterLog.find({ userId, date })
      .sort({ createdAt: 1 });

    const summary = await DailySummary.findOne({ userId, date });

    res.status(200).json({
      success: true,
      date,
      logs: logs.map(log => mapLogForClient(log, timeZone)),
      summary: {
        totalMl:  summary?.totalMl  || 0,
        sipCount: summary?.sipCount || 0,
        goalHit:  summary?.goalHit  || false,
        goalMl:   summary?.goalMl   || 2000,
      }
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────
// @route  DELETE /api/water/log/:id
// @access Private
// ─────────────────────────────────────
const deleteSip = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const log    = await WaterLog.findById(req.params.id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Log not found'
      });
    }

    // Make sure log belongs to this user
    if (log.userId.toString() !== userId.toString()) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Update daily summary — subtract the amount
    const summary = await DailySummary.findOne({
      userId,
      date: log.date
    });

    if (summary) {
      summary.totalMl  = Math.max(0, summary.totalMl - log.amount);
      summary.sipCount = Math.max(0, summary.sipCount - 1);
      summary.goalHit  = summary.totalMl >= summary.goalMl;
      summary.bestSip  = summary.sipCount === 0 ? 0 : summary.bestSip;
      await summary.save();
    }

    await log.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Sip deleted',
      dailySummary: {
        totalMl:  summary?.totalMl  || 0,
        sipCount: summary?.sipCount || 0,
        goalHit:  summary?.goalHit  || false,
      }
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────
// @route  POST /api/water/sync-guest
// @access Private
// Imports offline guest sips into the account when today has no server data yet
// (avoids duplicates after login + refresh).
// ─────────────────────────────────────
const MAX_GUEST_SIPS = 200;

const syncGuestSips = async (req, res, next) => {
  try {
    const { amounts: rawAmounts, glass, jar } = req.body;
    const userId = req.user._id;
    const glassNorm = normalizeVesselSnapshot(glass);
    const jarNorm = normalizeVesselSnapshot(jar);

    if (!glassNorm || !jarNorm) {
      return res.status(400).json({
        success: false,
        message: 'Please provide glass and jar as { id, name, volumeMl }',
      });
    }

    if (!Array.isArray(rawAmounts) || rawAmounts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a non-empty amounts array',
      });
    }

    const timeZone = req.headers['x-timezone'];
    const date = getTodayString(timeZone);

    const validAmounts = rawAmounts
      .map((a) => Math.round(Number(a)))
      .filter((a) => Number.isFinite(a) && a >= 1 && a <= 5000)
      .slice(0, MAX_GUEST_SIPS);

    if (validAmounts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid sip amounts (1–5000 ml each)',
      });
    }

    // Atomic claim: only one guest import per user/day (avoids duplicate rows when two requests
    // both see an empty WaterLog collection — e.g. React Strict Mode double mount).
    try {
      await GuestSyncLock.create({ userId, date });
    } catch (e) {
      if (e.code === 11000) {
        return res.status(200).json({
          success: true,
          skipped: true,
          message: 'Guest sync already applied or in progress',
        });
      }
      throw e;
    }

    const logCount = await WaterLog.countDocuments({ userId, date });
    const existingSummary = await DailySummary.findOne({ userId, date });
    if (logCount > 0 || (existingSummary && (existingSummary.totalMl > 0 || existingSummary.sipCount > 0))) {
      await GuestSyncLock.deleteOne({ userId, date });
      return res.status(200).json({
        success: true,
        skipped: true,
        message: 'Today already has logged data',
      });
    }

    let anyGoalHit = false;
    try {
      for (const amount of validAmounts) {
        await WaterLog.create({
          userId,
          date,
          amount,
          glass: glassNorm,
          jar: jarNorm,
        });
        const { justHitGoal } = await updateDailySummary(userId, date, amount);
        if (justHitGoal) anyGoalHit = true;
      }
    } catch (importErr) {
      await GuestSyncLock.deleteOne({ userId, date });
      throw importErr;
    }

    const summary = await DailySummary.findOne({ userId, date });

    res.status(201).json({
      success: true,
      merged: true,
      imported: validAmounts.length,
      dailySummary: {
        totalMl: summary?.totalMl ?? 0,
        sipCount: summary?.sipCount ?? 0,
        goalHit: summary?.goalHit ?? false,
        goalMl: summary?.goalMl ?? 2000,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { logSip, getTodayLogs, getLogsByDate, deleteSip, syncGuestSips };