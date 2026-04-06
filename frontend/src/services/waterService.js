import api from './api';

export const logSip = async (amount, glass, jar) => {
  const res = await api.post('/water/log', { amount, glass, jar });
  return res.data;
};

/** Single in-flight POST per token + day + payload — avoids duplicate imports on Strict Mode double mount. */
let guestSyncInFlight = null;
let guestSyncInFlightKey = null;

/** Merge local guest sips into the account (only when today is still empty on the server). */
export const syncGuestSips = async (amounts, glass, jar) => {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('sipsip_token') : '';
  const dayKey = new Date().toISOString().split('T')[0];
  const key = `${token}|${dayKey}|${JSON.stringify(amounts)}`;

  if (guestSyncInFlight && guestSyncInFlightKey === key) {
    return guestSyncInFlight;
  }
  guestSyncInFlightKey = key;
  guestSyncInFlight = (async () => {
    try {
      const res = await api.post('/water/sync-guest', { amounts, glass, jar });
      return res.data;
    } finally {
      guestSyncInFlight = null;
      guestSyncInFlightKey = null;
    }
  })();
  return guestSyncInFlight;
};

export const getTodayLogs = async () => {
  const res = await api.get('/water/logs/today');
  return res.data;
};

export const getLogsByDate = async (date) => {
  const res = await api.get(`/water/logs?date=${date}`);
  return res.data;
};

export const deleteSip = async (id) => {
  const res = await api.delete(`/water/log/${id}`);
  return res.data;
};