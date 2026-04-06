// Average ml per day over a fixed set of calendar days (missing summaries = 0 ml that day).
// Must divide by dates.length, not summaries.length, or days without logs inflate the average.
const calculateWeeklyAvg = (summaries, dates) => {
  if (!dates || dates.length === 0) return 0;
  const list = summaries || [];
  const total = dates.reduce((sum, date) => {
    const s = list.find((x) => x.date === date);
    return sum + (s?.totalMl || 0);
  }, 0);
  return Math.round(total / dates.length);
};

// Calculate consecutive days streak of goal being hit
const calculateStreak = (summaries) => {
  if (!summaries || summaries.length === 0) return 0;
  // summaries should be sorted newest first
  let streak = 0;
  for (const s of summaries) {
    if (s.goalHit) streak++;
    else break;
  }
  return streak;
};

// Calculate average sips per day
const calculateAvgFrequency = (summaries) => {
  if (!summaries || summaries.length === 0) return 0;
  const daysWithSips = summaries.filter(s => s.sipCount > 0);
  if (daysWithSips.length === 0) return 0;
  const total = daysWithSips.reduce((sum, s) => sum + s.sipCount, 0);
  return Math.round(total / daysWithSips.length);
};

module.exports = { calculateWeeklyAvg, calculateStreak, calculateAvgFrequency };