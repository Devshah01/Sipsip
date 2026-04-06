import { createSlice } from '@reduxjs/toolkit';

function safeJsonParse(value, fallback = null) {
  if (value === null || value === undefined || value === 'undefined' || value === '') return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function safeGetToken() {
  const token = localStorage.getItem('sipsip_token');
  if (token === null || token === undefined || token === 'undefined' || token === '') return null;
  return token;
}

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    user: safeJsonParse(localStorage.getItem('sipsip_user'), null),
    token: safeGetToken(),
    isLoading: false,
    error:     null,
  },
  reducers: {
    setCredentials(state, action) {
      const { user, token } = action.payload;
      state.user  = user;
      state.token = token;
      state.error = null;
      localStorage.setItem('sipsip_token', token);
      localStorage.setItem('sipsip_user',  JSON.stringify(user));
    },
    setLoading(state, action) {
      state.isLoading = action.payload;
    },
    setError(state, action) {
      state.error     = action.payload;
      state.isLoading = false;
    },
    clearError(state) {
      state.error = null;
    },
    logout(state) {
      state.user  = null;
      state.token = null;
      state.error = null;
      localStorage.removeItem('sipsip_token');
      localStorage.removeItem('sipsip_user');
    },
  }
});

export const {
  setCredentials, setLoading,
  setError, clearError, logout,
} = authSlice.actions;

export default authSlice.reducer;