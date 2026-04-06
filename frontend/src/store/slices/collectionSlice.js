import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { getVesselSettings, saveVesselSettings } from '../../services/vesselService';

// ─── Vessel Definitions ───────────────────────────────────────────────────────
// 18 glass shapes — labels match water_system.html, volumes spread across range
export const GLASSES = [
  { id: 0,  label: 'Hex Facet',    volume: 250 },
  { id: 1,  label: 'Geo Cup',      volume: 250 },
  { id: 2,  label: 'Lantern',      volume: 250 },
  { id: 3,  label: 'Barrel Top',   volume: 250 },
  { id: 4,  label: 'Hex Tall',     volume: 250 },
  { id: 5,  label: 'Wide Top',     volume: 250 },
  { id: 6,  label: 'Geo Diamond',  volume: 250 },
  { id: 7,  label: 'Tulip',        volume: 250 },
  { id: 8,  label: 'Highball',     volume: 250 },
  { id: 9,  label: 'Tumbler',      volume: 250 },
  { id: 10, label: 'Balloon',      volume: 250 },
  { id: 11, label: 'Snifter S',    volume: 250 },
  { id: 12, label: 'Slim Taper',   volume: 250 },
  { id: 13, label: 'Cylinder',     volume: 250 },
  { id: 14, label: 'Teardrop',     volume: 250 },
  { id: 15, label: 'Facet Pear',   volume: 250 },
  { id: 16, label: 'Bubble',       volume: 250 },
  { id: 17, label: 'Decanter',     volume: 250 },
];

// 18 jar shapes — labels match water_system.html, volumes spread across range
export const JARS = [
  { id: 0,  label: 'Amphora',         volume: 500  },
  { id: 1,  label: 'Decanter',        volume: 600  },
  { id: 2,  label: 'Jug Slim',        volume: 700  },
  { id: 3,  label: 'Wide Jug',        volume: 800  },
  { id: 4,  label: 'Geo Bottle',      volume: 900  },
  { id: 5,  label: 'Tall Bottle',     volume: 1000 },
  { id: 6,  label: 'Square Jug',      volume: 1100 },
  { id: 7,  label: 'Classic Jug',     volume: 1200 },
  { id: 8,  label: 'Fat Belly',       volume: 1300 },
  { id: 9,  label: 'Diamond Jug',     volume: 1400 },
  { id: 10, label: 'Oval Flask',      volume: 1500 },
  { id: 11, label: 'Teardrop Jug',    volume: 1600 },
  { id: 12, label: 'Pitcher',         volume: 1700 },
  { id: 13, label: 'Slim Vase',       volume: 1800 },
  { id: 14, label: 'Bubble Jug',      volume: 1900 },
  { id: 15, label: 'Facet Vase',      volume: 2000 },
  { id: 16, label: 'Hex Vase',        volume: 2100 },
  { id: 17, label: 'Milk Bottle',     volume: 2200 },
];

// Defaults: first shapes
const DEFAULT_GLASS_IDX = 0;  // Hex Facet
const DEFAULT_JAR_IDX   = 0;  // Amphora
const DEFAULT_GLASS_VOLUME = GLASSES[DEFAULT_GLASS_IDX].volume;
const DEFAULT_JAR_VOLUME   = 2000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveGlassIdx(val) {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val?.id != null) {
    const idx = Number(val.id);
    if (Number.isFinite(idx)) return idx;
  }
  return DEFAULT_GLASS_IDX;
}
function resolveJarIdx(val) {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val?.id != null) {
    const idx = Number(val.id);
    if (Number.isFinite(idx)) return idx;
  }
  return DEFAULT_JAR_IDX;
}

// ─── Thunks ───────────────────────────────────────────────────────────────────
export const fetchVesselSettings = createAsyncThunk(
  'collection/fetchVesselSettings',
  async (_, { getState, rejectWithValue }) => {
    try {
      const result = await getVesselSettings();
      // Attach profile's dailyGoal so the reducer can use it as jar default
      const profileGoal = getState()?.profile?.dailyGoal;
      return { ...result, _profileGoal: profileGoal };
    } catch (err) {
      return rejectWithValue(err.message);
    }
  }
);

export const updateVesselSettings = createAsyncThunk(
  'collection/updateVesselSettings',
  async ({ selectedGlass, selectedJar, glassVolume, jarVolume }) => {
    const glassIdx = resolveGlassIdx(selectedGlass);
    const jarIdx   = resolveJarIdx(selectedJar);
    const nextGlassVolume = Number.isFinite(glassVolume)
      ? glassVolume
      : (GLASSES[glassIdx]?.volume ?? DEFAULT_GLASS_VOLUME);
    const nextJarVolume = Number.isFinite(jarVolume)
      ? jarVolume
      : (JARS[jarIdx]?.volume ?? DEFAULT_JAR_VOLUME);
    try {
      const glass = GLASSES[glassIdx] ?? GLASSES[DEFAULT_GLASS_IDX];
      const jar   = JARS[jarIdx]      ?? JARS[DEFAULT_JAR_IDX];
      await saveVesselSettings(
        { id: glass.id, name: glass.label, volumeMl: nextGlassVolume },
        { id: jar.id,   name: jar.label,   volumeMl: nextJarVolume }
      );
      return {
        selectedGlass: glassIdx,
        selectedJar: jarIdx,
        selectedGlassVolume: nextGlassVolume,
        selectedJarVolume: nextJarVolume,
      };
    } catch (err) {
      // Keep UI consistent even when persistence fails.
      // This ensures Collection highlight + Dashboard vessel update immediately.
      return {
        selectedGlass: glassIdx,
        selectedJar: jarIdx,
        selectedGlassVolume: nextGlassVolume,
        selectedJarVolume: nextJarVolume,
        saveError: err?.message ?? 'Failed to persist vessel settings',
      };
    }
  }
);

// ─── Slice ────────────────────────────────────────────────────────────────────
const collectionSlice = createSlice({
  name: 'collection',
  initialState: {
    selectedGlass: DEFAULT_GLASS_IDX,  // index into GLASSES[]
    selectedJar:   DEFAULT_JAR_IDX,    // index into JARS[]
    selectedGlassVolume: DEFAULT_GLASS_VOLUME,
    selectedJarVolume:   DEFAULT_JAR_VOLUME,
    isLoading:     false,
    isSaving:      false,
    error:         null,
  },
  reducers: {
    setSelectedGlass(state, action) {
      state.selectedGlass = resolveGlassIdx(action.payload);
    },
    setSelectedJar(state, action) {
      state.selectedJar = resolveJarIdx(action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchVesselSettings.pending,    state => { state.isLoading = true; state.error = null; })
      .addCase(fetchVesselSettings.fulfilled,  (state, { payload }) => {
        state.isLoading = false;
        if (payload?.selectedGlass != null) state.selectedGlass = resolveGlassIdx(payload.selectedGlass);
        if (payload?.selectedJar   != null) state.selectedJar   = resolveJarIdx(payload.selectedJar);
        if (Number.isFinite(payload?.selectedGlass?.volumeMl)) {
          state.selectedGlassVolume = payload.selectedGlass.volumeMl;
        } else {
          state.selectedGlassVolume = GLASSES[state.selectedGlass]?.volume ?? DEFAULT_GLASS_VOLUME;
        }
        if (Number.isFinite(payload?.selectedJar?.volumeMl)) {
          state.selectedJarVolume = payload.selectedJar.volumeMl;
        } else {
          // Use profile's dailyGoal as jar default, fall back to JARS definition
          const profileGoal = payload?._profileGoal;
          state.selectedJarVolume = (Number.isFinite(profileGoal) && profileGoal > 0)
            ? profileGoal
            : (JARS[state.selectedJar]?.volume ?? DEFAULT_JAR_VOLUME);
        }
      })
      .addCase(fetchVesselSettings.rejected,   (state, { payload }) => { state.isLoading = false; state.error = payload; })
      .addCase(updateVesselSettings.pending,   state => { state.isSaving = true; state.error = null; })
      .addCase(updateVesselSettings.fulfilled, (state, { payload }) => {
        state.isSaving      = false;
        state.selectedGlass = payload.selectedGlass;
        state.selectedJar   = payload.selectedJar;
        state.selectedGlassVolume = payload.selectedGlassVolume ?? (GLASSES[state.selectedGlass]?.volume ?? DEFAULT_GLASS_VOLUME);
        state.selectedJarVolume   = payload.selectedJarVolume   ?? (JARS[state.selectedJar]?.volume ?? DEFAULT_JAR_VOLUME);
        state.error         = payload.saveError ?? null;
      })
      .addCase(updateVesselSettings.rejected,  (state, { payload }) => { state.isSaving = false; state.error = payload; })
  },
});

// ─── Selectors ────────────────────────────────────────────────────────────────
export const selectSelectedGlassIdx  = s => s.collection.selectedGlass;
export const selectSelectedJarIdx    = s => s.collection.selectedJar;
export const selectSelectedGlass     = s => GLASSES[s.collection.selectedGlass] ?? GLASSES[DEFAULT_GLASS_IDX];
export const selectSelectedJar       = s => JARS[s.collection.selectedJar]      ?? JARS[DEFAULT_JAR_IDX];
export const selectGlassVolume       = s => s.collection.selectedGlassVolume ?? (GLASSES[s.collection.selectedGlass] ?? GLASSES[DEFAULT_GLASS_IDX]).volume;
export const selectJarVolume         = s => s.collection.selectedJarVolume   ?? (JARS[s.collection.selectedJar]      ?? JARS[DEFAULT_JAR_IDX]).volume;
export const selectCollectionLoading = s => s.collection.isLoading;
export const selectCollectionSaving  = s => s.collection.isSaving;

export const { setSelectedGlass, setSelectedJar } = collectionSlice.actions;
export default collectionSlice.reducer;