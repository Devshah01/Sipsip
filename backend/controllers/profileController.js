const Profile = require('../models/Profile');
const { calculateDailyGoal } = require('../utils/hydrationGoal');

const getMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    let profile = await Profile.findOne({ userId });
    if (!profile) {
      profile = await Profile.create({ userId });
    }
    res.status(200).json({
      success: true,
      profile: profile.toObject(),
    });
  } catch (err) {
    next(err);
  }
};

const updateMyProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const {
      gender,
      age,
      weight,
      wakeTime,
      sleepTime,
    } = req.body;

    let currentProfile = await Profile.findOne({ userId });
    const update = {};

    if (gender !== undefined) {
      if (['male', 'female', 'other', null].includes(gender)) update.gender = gender;
    }
    if (age !== undefined && age !== null) {
      const a = Number(age);
      if (Number.isFinite(a) && a >= 1 && a <= 120) update.age = a;
    }
    if (weight !== undefined && weight !== null) {
      const w = Number(weight);
      if (Number.isFinite(w) && w >= 1 && w <= 500) {
        update.weight = w;
      }
    }

    if (update.weight !== undefined || update.age !== undefined || update.gender !== undefined) {
      const w = update.weight ?? currentProfile?.weight ?? 72;
      const a = update.age ?? currentProfile?.age ?? 27;
      const gen = update.gender ?? currentProfile?.gender ?? 'other';
      const { amount } = calculateDailyGoal(w, a, gen);
      if (amount) update.dailyGoal = amount;
    }

    if (typeof wakeTime === 'string' && wakeTime.trim()) update.wakeTime = wakeTime.trim();
    if (typeof sleepTime === 'string' && sleepTime.trim()) update.sleepTime = sleepTime.trim();

    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: update },
      { returnDocument: 'after', upsert: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      profile: profile.toObject(),
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getMyProfile, updateMyProfile };
