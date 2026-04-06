const DailySummary = require('../models/DailySummary');
const WaterLog     = require('../models/WaterLog');
const Profile      = require('../models/Profile');
const { getTodayString, getDateRange } = require('../utils/dateHelper');
const {
  calculateWeeklyAvg,
  calculateStreak,
  calculateAvgFrequency
} = require('../utils/statsHelper');

// ─────────────────────────────────────
// @route  GET /api/stats/overview
// @access Private
// ─────────────────────────────────────
const getOverview = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const today  = getTodayString();

    // Get profile for goal
    const profile  = await Profile.findOne({ userId });
    const goalMl   = profile?.dailyGoal || 2000;

    // Today's summary
    const todaySummary = await DailySummary.findOne({ userId, date: today });
    const totalMl      = todaySummary?.totalMl  || 0;
    const sipCount     = todaySummary?.sipCount || 0;
    const goalHit      = todaySummary?.goalHit  || false;
    const goalPct      = Math.min(Math.round((totalMl / goalMl) * 100), 100);

    // Last 7 days for weekly avg
    const last7Dates    = getDateRange(7);
    const weeklySummaries = await DailySummary.find({
      userId,
      date: { $in: last7Dates }
    });
    const weeklyAvg  = calculateWeeklyAvg(weeklySummaries, last7Dates);
    const goalsHit   = weeklySummaries.filter(s => s.goalHit).length;

    // Last 30 days for streak + frequency
    const last30Dates   = getDateRange(30);
    const last30Summaries = await DailySummary.find({
      userId,
      date: { $in: last30Dates }
    }).sort({ date: -1 });

    const streak       = calculateStreak(last30Summaries);
    const avgFrequency = calculateAvgFrequency(last30Summaries);

    res.status(200).json({
      success: true,
      today: {
        totalMl,
        goalMl,
        goalPct,
        sipCount,
        goalHit,
      },
      weekly: {
        avg:      weeklyAvg,
        goalsHit,
      },
      avgFrequency,
      streak,
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────
// @route  GET /api/stats/weekly
// @access Private
// ─────────────────────────────────────
const getWeekly = async (req, res, next) => {
  try {
    const userId = req.user._id;

    let weekDates;
    if (req.query.start) {
      const base = new Date(String(req.query.start) + 'T12:00:00');
      if (Number.isNaN(base.getTime())) {
        return res.status(400).json({ success: false, message: 'Invalid start date' });
      }
      weekDates = [];
      for (let i = 0; i < 7; i++) {
        const x = new Date(base);
        x.setDate(base.getDate() + i);
        weekDates.push(x.toISOString().split('T')[0]);
      }
    } else {
      weekDates = getDateRange(7).reverse();
    }

    const summaries = await DailySummary.find({
      userId,
      date: { $in: weekDates }
    }).sort({ date: 1 });

    const days = weekDates.map(date => {
      const found = summaries.find(s => s.date === date);
      return {
        date,
        totalMl:  found?.totalMl  || 0,
        goalHit:  found?.goalHit  || false,
        sipCount: found?.sipCount || 0,
        goalMl:   found?.goalMl   || 2000,
      };
    });

    const weeklyAvg = Math.round(days.reduce((a, d) => a + d.totalMl, 0) / 7) || 0;
    const goalsHit  = days.filter(d => d.goalHit).length;

    res.status(200).json({
      success: true,
      weeklyAvg,
      goalsHit,
      totalDays: 7,
      days,
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────
// @route  GET /api/stats/summary?days=90
// @access Private
// ─────────────────────────────────────
const getSummary = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const days   = parseInt(req.query.days) || 90;
    const dates  = getDateRange(days);

    const summaries = await DailySummary.find({
      userId,
      date: { $in: dates }
    }).sort({ date: -1 });

    res.status(200).json({
      success: true,
      summaries: summaries.map(s => ({
        date:     s.date,
        totalMl:  s.totalMl,
        goalHit:  s.goalHit,
        sipCount: s.sipCount,
        goalMl:   s.goalMl,
        bestSip:  s.bestSip,
      }))
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────
// @route  GET /api/stats/best-day
// @access Private
// ─────────────────────────────────────
const getBestDay = async (req, res, next) => {
  try {
    const userId  = req.user._id;
    const dates   = getDateRange(90);

    const best = await DailySummary.findOne({
      userId,
      date: { $in: dates }
    }).sort({ totalMl: -1 });

    res.status(200).json({
      success: true,
      bestDay: best ? {
        date:     best.date,
        totalMl:  best.totalMl,
        sipCount: best.sipCount,
        goalHit:  best.goalHit,
      } : null
    });

  } catch (err) {
    next(err);
  }
};

module.exports = { getOverview, getWeekly, getSummary, getBestDay };