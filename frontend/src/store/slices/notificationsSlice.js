import { createSlice } from '@reduxjs/toolkit';

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState: {
    enabled:          false,
    frequencyMinutes: 60,
    wakeTime:         '07:00',
    sleepTime:        '23:00',
    reminderPreferences: {
      sip: true, morning: false, weekly: true, bed: false,
    },
    isLoading:        false,
  },
  reducers: {
    setNotificationSettings(state, action) {
      return { ...state, ...action.payload, isLoading: false };
    },
    toggleEnabled(state) {
      state.enabled = !state.enabled;
    },
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
  }
});

export const {
  setNotificationSettings, toggleEnabled, setLoading,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;