import { useEffect, useState, useRef, useCallback } from 'react';
import styles from './GlobalPushToast.module.css';

const SIPSIP_MSG = 'SIPSIP_PUSH';

function formatNowTime() {
  const now = new Date();
  const mm = String(now.getMinutes()).padStart(2, '0');
  let h = now.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, '0')}:${mm} ${ampm}`;
}

/**
 * Listens for postMessage from sw.js when a Web Push arrives, and shows the same
 * kind of in-app toast as the Notifications page — so users see a popup while
 * the app is open (OS notifications are easy to miss or disabled).
 */
export default function GlobalPushToast() {
  const [data, setData]   = useState(null);
  const [exiting, setExiting] = useState(false);
  const dismissTimer = useRef(null);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setData(null);
      setExiting(false);
    }, 400);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onMessage = (event) => {
      const d = event.data;
      if (!d || d.type !== SIPSIP_MSG) return;

      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      setExiting(false);
      setData({
        title: d.title || 'SipSip 💧',
        body:  d.body  || 'Time for a sip!',
        time:  formatNowTime(),
      });

      dismissTimer.current = setTimeout(dismiss, 4000);
    };

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => {
      navigator.serviceWorker.removeEventListener('message', onMessage);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [dismiss]);

  if (!data) return null;

  return (
    <div className={styles.overlay}>
      <div
        className={`${styles.card} ${exiting ? styles.cardExiting : ''}`}
        onClick={dismiss}
        role="status"
      >
        <div className={styles.header}>
          <div className={styles.appIcon}>💧</div>
          <div className={styles.appName}>SipSip</div>
          <div className={styles.time}>{data.time}</div>
        </div>
        <div className={styles.body}>
          <div className={styles.emoji}>💧</div>
          <div className={styles.content}>
            <div className={styles.title}>{data.title}</div>
            <div className={styles.message}>{data.body}</div>
          </div>
        </div>
        <div className={styles.dismiss}>tap to dismiss</div>
        <div className={styles.progress} />
      </div>
    </div>
  );
}
