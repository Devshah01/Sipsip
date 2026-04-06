const getDateString = (dateObj, timeZone) => {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).formatToParts(dateObj);
      const y = parts.find((p) => p.type === 'year').value;
      const m = parts.find((p) => p.type === 'month').value;
      const d = parts.find((p) => p.type === 'day').value;
      return `${y}-${m}-${d}`;
    } catch (e) {
      // ignore
    }
  }
  return dateObj.toISOString().split('T')[0];
};

// Returns "YYYY-MM-DD" string for today in the specified timezone
const getTodayString = (timeZone) => {
  return getDateString(new Date(), timeZone);
};

// Returns array of "YYYY-MM-DD" strings for last N days
const getDateRange = (days, timeZone) => {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(getDateString(d, timeZone));
  }
  return dates;
};

// Returns "9:42 am" from a Date object
const formatTime = (date, timeZone) => {
  if (timeZone) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(new Date(date)).toLowerCase();
    } catch(e) {}
  }
  const d = new Date(date);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};

module.exports = { getTodayString, getDateRange, formatTime };