import { createSlice } from '@reduxjs/toolkit';

const getInitialTheme = () => {
  return localStorage.getItem('sipsip_theme') || 'light';
};

const getInitialSound = () => {
  const stored = localStorage.getItem('sipsip_sound');
  return stored === null ? true : stored === 'true';
};

const uiSlice = createSlice({
  name: 'ui',
  initialState: {
    theme:         getInitialTheme(),
    soundEnabled:  getInitialSound(),
    menuOpen:      false,
    activeModal:   null,
    preloaderDone: false,
    toasts:        [],
  },
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('sipsip_theme', state.theme);
    },
    toggleSound(state) {
      state.soundEnabled = !state.soundEnabled;
      localStorage.setItem('sipsip_sound', String(state.soundEnabled));
    },
    setTheme(state, action) {
      state.theme = action.payload;
      localStorage.setItem('sipsip_theme', state.theme);
    },
    toggleMenu(state) {
      state.menuOpen = !state.menuOpen;
    },
    closeMenu(state) {
      state.menuOpen = false;
    },
    openModal(state, action) {
      state.activeModal = action.payload;
    },
    closeModal(state) {
      state.activeModal = null;
    },
    setPreloaderDone(state) {
      state.preloaderDone = true;
    },
    addToast(state, action) {
      state.toasts.push({ id: Date.now(), ...action.payload });
    },
    removeToast(state, action) {
      state.toasts = state.toasts.filter(t => t.id !== action.payload);
    },
  }
});

export const {
  toggleTheme, setTheme, toggleSound, toggleMenu, closeMenu,
  openModal, closeModal, setPreloaderDone,
  addToast, removeToast,
} = uiSlice.actions;

export default uiSlice.reducer;