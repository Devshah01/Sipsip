import { useEffect, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

/**
 * Pings the backend cron-tick endpoint every 60 seconds while the app tab is
 * visible. This keeps the Cloud Run container warm and triggers the push
 * notification scheduler reliably (Cloud Run throttles CPU when idle, which
 * kills setInterval-based schedulers).
 *
 * Uses document.visibilityState so it pauses when the tab is hidden/minimized
 * to avoid burning battery on mobile.
 */
export default function useSchedulerKeepAlive() {
  const intervalRef = useRef(null);

  useEffect(() => {
    const ping = () => {
      fetch(`${API_BASE}/notifications/cron-tick`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }).catch(() => { /* silent — best effort */ });
    };

    const start = () => {
      if (intervalRef.current) return;
      ping(); // immediate first tick
      intervalRef.current = setInterval(ping, 60_000);
    };

    const stop = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const onVisChange = () => {
      if (document.visibilityState === 'visible') start();
      else stop();
    };

    // Start immediately if tab is visible
    if (document.visibilityState === 'visible') start();

    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisChange);
    };
  }, []);
}
