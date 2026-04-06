import { createSlice } from '@reduxjs/toolkit';

// Note: G_MAX and J_MAX are now dynamic, driven by collectionSlice vessel volumes.
// These defaults match the original hardcoded values and are kept as fallbacks only.
const DEFAULT_G_MAX = 250;
const DEFAULT_J_MAX = 2000;

const waterSlice = createSlice({
  name: 'water',
  initialState: {
    glassVol:    0,
    jarVol:      0,
    sips:        [],
    totalPoured: 0,
    sipCount:    0,
    goalReached: false,
    isLoading:   false,
    // Dynamic vessel capacities — updated whenever vessel selection changes
    gMax: DEFAULT_G_MAX,
    jMax: DEFAULT_J_MAX,
  },
  reducers: {
    // ── Called by Dashboard when vessel selection changes ──────────────────
    setVesselCapacities(state, action) {
      const { gMax, jMax } = action.payload;
      if (gMax != null) state.gMax = gMax;
      if (jMax != null) {
        state.jMax = jMax;
        // Recalculate goalReached with new capacity
        state.goalReached = state.totalPoured >= jMax;
      }
      // Clamp glass vol to new max
      if (gMax != null) state.glassVol = Math.min(state.glassVol, gMax);
    },

    addToGlass(state, action) {
      const amount = action.payload || 1;
      state.glassVol = Math.min(state.glassVol + amount, state.gMax);
    },

    pourToJar(state, action) {
      const { amount, sipData } = action.payload;
      state.glassVol    = Math.max(0, state.glassVol - amount);
      state.jarVol      = Math.min(state.jarVol + amount, state.jMax);
      state.totalPoured += amount;
      state.sipCount    += 1;
      if (sipData) state.sips.push(sipData);
      if (state.jarVol >= state.jMax) state.goalReached = true;
    },

    resetGlass(state) {
      state.glassVol = 0;
    },

    setGoalReached(state, action) {
      state.goalReached = action.payload;
    },

    setLoading(state, action) {
      state.isLoading = action.payload;
    },

    loadTodayLogs(state, action) {
      const { logs, summary } = action.payload;
      state.sips        = logs;
      state.totalPoured = summary.totalMl;
      state.sipCount    = summary.sipCount;
      state.jarVol      = Math.min(summary.totalMl, state.jMax);
      state.goalReached = summary.goalHit;
    },

    addToJarRaw(state, action) {
      state.jarVol = Math.min(state.jarVol + action.payload, state.jMax);
    },

    // Full reset (e.g. new day)
    resetAll(state) {
      state.glassVol    = 0;
      state.jarVol      = 0;
      state.sips        = [];
      state.totalPoured = 0;
      state.sipCount    = 0;
      state.goalReached = false;
    },
  }
});

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectGlassVol    = s => s.water.glassVol;
export const selectJarVol      = s => s.water.jarVol;
export const selectTotalPoured = s => s.water.totalPoured;
export const selectSipCount    = s => s.water.sipCount;
export const selectGoalReached = s => s.water.goalReached;
export const selectGMax        = s => s.water.gMax;
export const selectJMax        = s => s.water.jMax;

export const {
  addToGlass, pourToJar, resetGlass,
  setGoalReached, setLoading, loadTodayLogs,
  addToJarRaw, setVesselCapacities, resetAll,
} = waterSlice.actions;

export default waterSlice.reducer;
