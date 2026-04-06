// Returns "YYYY-MM-DD" string for today
const getTodayString = () => {
  return new Date().toISOString().split('T')[0];
};

// Returns array of "YYYY-MM-DD" strings for last N days
const getDateRange = (days) => {
  const dates = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

// Returns "9:42 am" from a Date object
const formatTime = (date) => {
  const d = new Date(date);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ap = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};

module.exports = { getTodayString, getDateRange, formatTime };