import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import statsService from '../../services/statsService';
import { getLogsByDate } from '../../services/waterService';

// ── Async Thunks ──────────────────────────────────────────────────────────────

export const fetchOverview = createAsyncThunk(
  'stats/fetchOverview',
  async (_, { rejectWithValue }) => {
    try {
      return await statsService.getOverview();
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch overview');
    }
  }
);

export const fetchWeekly = createAsyncThunk(
  'stats/fetchWeekly',
  async (startDate, { rejectWithValue }) => {
    try {
      return await statsService.getWeekly(startDate);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch weekly data');
    }
  }
);

export const fetchSummary = createAsyncThunk(
  'stats/fetchSummary',
  async (days = 90, { rejectWithValue }) => {
    try {
      return await statsService.getSummary(days);
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch summary');
    }
  }
);

export const fetchBestDay = createAsyncThunk(
  'stats/fetchBestDay',
  async (_, { rejectWithValue }) => {
    try {
      return await statsService.getBestDay();
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch best day');
    }
  }
);

/** Merge per-sip logs into summaryMap for Statistics day modal */
export const fetchDayLogs = createAsyncThunk(
  'stats/fetchDayLogs',
  async (date, { rejectWithValue }) => {
    try {
      const data = await getLogsByDate(date);
      return {
        date,
        logs: data.logs || [],
        summary: data.summary || {},
      };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch day logs');
    }
  }
);

// ── Initial State ─────────────────────────────────────────────────────────────

const initialState = {
  // Period navigation
  period: 'weekly',           // 'weekly' | 'monthly' | 'yearly'
  weekStart: null,            // ISO string of Monday
  monthView: { year: new Date().getFullYear(), month: new Date().getMonth() },
  yearView: new Date().getFullYear(),

  // Data
  overview: null,             // { totalMl, sipCount, goalMl, goalHit }
  weeklyData: [],             // [{ date, totalMl, sipCount, goalMl, goalHit }]
  summaryMap: {},             // { 'YYYY-MM-DD': { totalMl, sipCount, goalMl, goalHit } }
  bestDay: null,              // { date, totalMl, goalMl, pct }

  // Selected day detail modal
  selectedDate: null,         // ISO date string
  dayDetail: null,            // { date, totalMl, sipCount, goalMl, goalHit, logs[] }

  // Loading / error
  loading: {
    overview: false,
    weekly: false,
    summary: false,
    bestDay: false,
  },
  error: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMondayISO(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().split('T')[0];
}

// ── Slice ─────────────────────────────────────────────────────────────────────

const statsSlice = createSlice({
  name: 'stats',
  initialState,

  reducers: {
    setPeriod(state, action) {
      state.period = action.payload;
    },
    setWeekStart(state, action) {
      state.weekStart = action.payload; // ISO string 'YYYY-MM-DD'
    },
    setMonthView(state, action) {
      state.monthView = action.payload; // { year, month }
    },
    setYearView(state, action) {
      state.yearView = action.payload;
    },
    navigatePrev(state) {
      if (state.period === 'weekly') {
        const d = new Date(state.weekStart);
        d.setDate(d.getDate() - 7);
        state.weekStart = d.toISOString().split('T')[0];
      } else if (state.period === 'monthly') {
        let { year, month } = state.monthView;
        month--;
        if (month < 0) { month = 11; year--; }
        state.monthView = { year, month };
      } else {
        state.yearView--;
      }
    },
    navigateNext(state) {
      if (state.period === 'weekly') {
        const d = new Date(state.weekStart);
        d.setDate(d.getDate() + 7);
        state.weekStart = d.toISOString().split('T')[0];
      } else if (state.period === 'monthly') {
        let { year, month } = state.monthView;
        month++;
        if (month > 11) { month = 0; year++; }
        state.monthView = { year, month };
      } else {
        state.yearView++;
      }
    },
    goToToday(state) {
      const today = new Date();
      state.weekStart = getMondayISO();
      state.monthView = { year: today.getFullYear(), month: today.getMonth() };
      state.yearView = today.getFullYear();
    },
    openDayDetail(state, action) {
      state.selectedDate = action.payload; // 'YYYY-MM-DD'
      const summary = state.summaryMap[action.payload];
      state.dayDetail = summary || null;
    },
    closeDayDetail(state) {
      state.selectedDate = null;
      state.dayDetail = null;
    },
    clearError(state) {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    // Overview
    builder
      .addCase(fetchOverview.pending, (state) => { state.loading.overview = true; })
      .addCase(fetchOverview.fulfilled, (state, action) => {
        state.loading.overview = false;
        state.overview = action.payload;
      })
      .addCase(fetchOverview.rejected, (state, action) => {
        state.loading.overview = false;
        state.error = action.payload;
      });

    // Weekly
    builder
      .addCase(fetchWeekly.pending, (state) => { state.loading.weekly = true; })
      .addCase(fetchWeekly.fulfilled, (state, action) => {
        state.loading.weekly = false;
        const days = action.payload?.days || [];
        state.weeklyData = days;
        days.forEach(day => {
          const prev = state.summaryMap[day.date] || {};
          state.summaryMap[day.date] = { ...prev, ...day };
        });
      })
      .addCase(fetchWeekly.rejected, (state, action) => {
        state.loading.weekly = false;
        state.error = action.payload;
      });

    // Summary
    builder
      .addCase(fetchSummary.pending, (state) => { state.loading.summary = true; })
      .addCase(fetchSummary.fulfilled, (state, action) => {
        state.loading.summary = false;
        action.payload.forEach(day => {
          const prev = state.summaryMap[day.date] || {};
          state.summaryMap[day.date] = { ...prev, ...day };
        });
      })
      .addCase(fetchSummary.rejected, (state, action) => {
        state.loading.summary = false;
        state.error = action.payload;
      });

    // Best Day
    builder
      .addCase(fetchBestDay.pending, (state) => { state.loading.bestDay = true; })
      .addCase(fetchBestDay.fulfilled, (state, action) => {
        state.loading.bestDay = false;
        state.bestDay = action.payload;
      })
      .addCase(fetchBestDay.rejected, (state, action) => {
        state.loading.bestDay = false;
        state.error = action.payload;
      });

    builder
      .addCase(fetchDayLogs.fulfilled, (state, action) => {
        const { date, logs, summary } = action.payload;
        const prev = state.summaryMap[date] || {};
        state.summaryMap[date] = {
          ...prev,
          totalMl:  summary.totalMl  ?? prev.totalMl  ?? 0,
          sipCount: summary.sipCount ?? prev.sipCount ?? 0,
          goalHit:  summary.goalHit  ?? prev.goalHit  ?? false,
          goalMl:   summary.goalMl   ?? prev.goalMl   ?? 2000,
          logs: logs.map((l) => ({
            amount: l.amount,
            timestamp: l.timestamp,
            at: l.at,
            glass: l.glass,
            jar: l.jar,
          })),
        };

        // Keep the modal content stable for the selected date.
        // After fetching logs, ensure `dayDetail` contains the merged goalMl + logs.
        if (state.selectedDate === date) {
          state.dayDetail = state.summaryMap[date];
        }
      });
  },
});

export const {
  setPeriod,
  setWeekStart,
  setMonthView,
  setYearView,
  navigatePrev,
  navigateNext,
  goToToday,
  openDayDetail,
  closeDayDetail,
  clearError,
} = statsSlice.actions;

// ── Selectors ─────────────────────────────────────────────────────────────────

export const selectStatsPeriod   = (s) => s.stats.period;
export const selectWeekStart     = (s) => s.stats.weekStart;
export const selectMonthView     = (s) => s.stats.monthView;
export const selectYearView      = (s) => s.stats.yearView;
export const selectOverview      = (s) => s.stats.overview;
export const selectWeeklyData    = (s) => s.stats.weeklyData;
export const selectSummaryMap    = (s) => s.stats.summaryMap;
export const selectBestDay       = (s) => s.stats.bestDay;
export const selectSelectedDate  = (s) => s.stats.selectedDate;
export const selectDayDetail     = (s) => s.stats.dayDetail;
export const selectStatsLoading  = (s) => s.stats.loading;
export const selectStatsError    = (s) => s.stats.error;

export default statsSlice.reducer;
