import api from './api';

const statsService = {
  /**
   * GET /api/stats/overview
   * Returns { totalMl, sipCount, goalMl, goalHit } for today
   */
  getOverview: async () => {
    const { data } = await api.get('/stats/overview');
    return data;
  },

  /**
   * GET /api/stats/weekly?start=YYYY-MM-DD
   * Returns array of 7 daily summaries starting from Monday
   */
  getWeekly: async (startDate) => {
    const params = startDate ? { start: startDate } : {};
    const { data } = await api.get('/stats/weekly', { params });
    return {
      success: data.success !== false,
      days: data.days || [],
      weeklyAvg: data.weeklyAvg ?? 0,
      goalsHit: data.goalsHit ?? 0,
    };
  },

  /**
   * GET /api/stats/summary?days=90
   * Returns array of DailySummary docs for last N days
   */
  getSummary: async (days = 90) => {
    const { data } = await api.get('/stats/summary', { params: { days } });
    return data.summaries || [];
  },

  /**
   * GET /api/stats/best-day
   * Returns the single best day in the last 90 days
   * { date, totalMl, goalMl, pct }
   */
  getBestDay: async () => {
    const { data } = await api.get('/stats/best-day');
    return data.bestDay ?? null;
  },

};

export default statsService;
