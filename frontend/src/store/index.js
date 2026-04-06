import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import authReducer          from './slices/authSlice';
import waterReducer         from './slices/waterSlice';
import profileReducer       from './slices/profileSlice';
import collectionReducer    from './slices/collectionSlice';
import notificationsReducer from './slices/notificationsSlice';
import uiReducer            from './slices/uiSlice';
import statsReducer         from './slices/statsSlice';
import { setSelectedGlass, setSelectedJar,
         fetchVesselSettings, updateVesselSettings,
         selectGlassVolume, selectJarVolume }  from './slices/collectionSlice';
import { setVesselCapacities }                 from './slices/waterSlice';

// ─── Listener middleware ───────────────────────────────────────────────────
// Whenever glass or jar selection changes (locally or from server),
// immediately sync the volumes into waterSlice so ALL pages see the
// latest gMax / jMax without needing to visit Dashboard first.
const vesselSyncListener = createListenerMiddleware();

function syncVessels(listenerApi) {
  const state      = listenerApi.getState();
  const gMax       = selectGlassVolume(state);
  const jMax       = selectJarVolume(state);
  listenerApi.dispatch(setVesselCapacities({ gMax, jMax }));
}

// Fires on direct local updates
vesselSyncListener.startListening({ actionCreator: setSelectedGlass,                    effect: (_, api) => syncVessels(api) });
vesselSyncListener.startListening({ actionCreator: setSelectedJar,                      effect: (_, api) => syncVessels(api) });
// Fires when server fetch completes (app load / page refresh)
vesselSyncListener.startListening({ actionCreator: fetchVesselSettings.fulfilled,       effect: (_, api) => syncVessels(api) });
// Fires when user confirms a new vessel in Collection page
vesselSyncListener.startListening({ actionCreator: updateVesselSettings.fulfilled,      effect: (_, api) => syncVessels(api) });

// ─── Store ────────────────────────────────────────────────────────────────────
export const store = configureStore({
  reducer: {
    auth:          authReducer,
    water:         waterReducer,
    profile:       profileReducer,
    collection:    collectionReducer,
    notifications: notificationsReducer,
    ui:            uiReducer,
    stats:         statsReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware().prepend(vesselSyncListener.middleware),
});

export default store;
