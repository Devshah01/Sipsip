import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as profileService from '../../services/profileService';
import { updateVesselSettings } from './collectionSlice';

export const fetchProfile = createAsyncThunk(
  'profile/fetchProfile',
  async (_, { rejectWithValue }) => {
    try {
      const data = await profileService.getProfile();
      return data.profile ?? data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load profile');
    }
  }
);

export const saveProfile = createAsyncThunk(
  'profile/saveProfile',
  async (payload, { dispatch, getState, rejectWithValue }) => {
    try {
      const data = await profileService.updateProfile(payload);
      const profile = data.profile ?? data;
      const weightSent = payload?.weight != null && Number.isFinite(Number(payload.weight));
      if (weightSent && Number.isFinite(profile?.dailyGoal)) {
        const st = getState();
        await dispatch(updateVesselSettings({
          selectedGlass: st.collection.selectedGlass,
          selectedJar: st.collection.selectedJar,
          glassVolume: st.collection.selectedGlassVolume,
          jarVolume: profile.dailyGoal,
        })).unwrap();
      }
      return profile;
    } catch (err) {
      const msg = err?.payload || err?.response?.data?.message || err?.message || 'Failed to save profile';
      return rejectWithValue(msg);
    }
  }
);

const profileSlice = createSlice({
  name: 'profile',
  initialState: {
    gender: null,
    age: null,
    weight: null,
    wakeTime: '07:00',
    sleepTime: '23:00',
    dailyGoal: 2000,
    isLoading: false,
    isSaving: false,
    error: null,
  },
  reducers: {
    setProfile(state, action) {
      return { ...state, ...action.payload, isLoading: false, error: null };
    },
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProfile.pending, (s) => { s.isLoading = true; s.error = null; })
      .addCase(fetchProfile.fulfilled, (s, { payload }) => {
        s.isLoading = false;
        if (!payload) return;
        if (payload.gender !== undefined) s.gender = payload.gender;
        if (payload.age != null) s.age = payload.age;
        if (payload.weight != null) s.weight = payload.weight;
        if (payload.wakeTime) s.wakeTime = payload.wakeTime;
        if (payload.sleepTime) s.sleepTime = payload.sleepTime;
        if (payload.dailyGoal != null) s.dailyGoal = payload.dailyGoal;
      })
      .addCase(fetchProfile.rejected, (s, { payload }) => {
        s.isLoading = false;
        s.error = payload;
      })
      .addCase(saveProfile.pending, (s) => { s.isSaving = true; s.error = null; })
      .addCase(saveProfile.fulfilled, (s, { payload }) => {
        s.isSaving = false;
        if (!payload) return;
        if (payload.gender !== undefined) s.gender = payload.gender;
        if (payload.age != null) s.age = payload.age;
        if (payload.weight != null) s.weight = payload.weight;
        if (payload.wakeTime) s.wakeTime = payload.wakeTime;
        if (payload.sleepTime) s.sleepTime = payload.sleepTime;
        if (payload.dailyGoal != null) s.dailyGoal = payload.dailyGoal;
      })
      .addCase(saveProfile.rejected, (s, { payload }) => {
        s.isSaving = false;
        s.error = payload;
      });
  },
});

export const selectProfile = (state) => state.profile;
export const selectDailyGoal = (state) => state.profile.dailyGoal;

export const { setProfile, setLoading, setError } = profileSlice.actions;
export default profileSlice.reducer;
