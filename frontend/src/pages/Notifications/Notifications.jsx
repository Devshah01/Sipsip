import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Navbar from '@/components/layout/Navbar/Navbar';
import MenuDrawer from '@/components/layout/MenuDrawer/MenuDrawer';
import BackButton from '@/components/layout/BackButton/BackButton';
import { toggleEnabled, setNotificationSettings } from '@/store/slices/notificationsSlice';
import {
  subscribeToPush,
  unsubscribeFromPush,
  sendTestPush,
  registerServiceWorker,
  fetchNotificationSettings,
  patchNotificationSettings,
} from '@/utils/pushUtils';
import styles from './Notifications.module.css';
import SEO from '@/components/SEO/SEO';

// ─── Arc Speedometer constants ────────────────────────────────────────────────
const OPTIONS = [15, 30, 45, 60, 90, 120, 180];
const LABELS  = ['15 min','30 min','45 min','Every hour','90 min','2 hours','3 hours'];
const DISP    = ['15m','30m','45m','1h','90m','2h','3h'];
const TOTAL   = Math.PI * 118;
const CX = 150, CY = 152, R_ARC = 118, R_NEEDLE = 104;
const N = OPTIONS.length - 1;

function fracToXY(frac, r) {
  const a = frac * Math.PI;
  return { x: CX - r * Math.cos(a), y: CY - r * Math.sin(a) };
}

// ─── Reminder settings rows ───────────────────────────────────────────────────
const REMINDER_ROWS = [
  { id: 'sip',     icon: '💧', title: 'Sip Reminders',         sub: 'Every hour · Wake to Sleep', defaultOn: true  },
  { id: 'morning', icon: '🌅', title: 'Morning Nudge',          sub: 'First sip reminder at wake time',  defaultOn: false },
  { id: 'weekly',  icon: '📊', title: 'Weekly Summary',         sub: 'Every Sunday morning · Your week in review', defaultOn: true  },
  { id: 'bed',     icon: '🌙', title: 'Bedtime Check-in',       sub: '30 min before sleep · Final reminder',        defaultOn: false },
];

// ─── Hydration reminder messages (randomized for test) ────────────────────────
const HYDRATION_MESSAGES = [
  { emoji: '💧', title: 'Time for a sip!',            body: 'Your body is 60% water — keep it topped up! Take a refreshing sip right now.' },
  { emoji: '🥤', title: 'Hydration check!',            body: "You've been busy — grab your bottle and take a nice long sip. You deserve it!" },
  { emoji: '🌊', title: 'Sip o\'clock!',               body: 'A quick sip now keeps dehydration away. Your future self will thank you!' },
  { emoji: '💦', title: 'Hey, drink some water!',       body: "It's been a while since your last sip. Time to hydrate and feel amazing!" },
  { emoji: '🧊', title: 'Stay refreshed!',              body: 'Dehydration sneaks up on you. Take a sip and keep your energy levels high!' },
  { emoji: '🫧', title: 'Bubble reminder!',             body: 'Pop! Time to hydrate. Even a small sip makes a big difference.' },
  { emoji: '☕', title: 'Quick hydration break',         body: 'Step away from the screen for a moment. Grab some water and stretch!' },
  { emoji: '🏃', title: 'Fuel up with water!',          body: 'Water powers everything you do. Take a sip and keep crushing it!' },
  { emoji: '🌿', title: 'Natural reminder',              body: 'Your body is calling for water. Listen to it — take a refreshing sip!' },
  { emoji: '⚡', title: 'Energy boost incoming!',       body: 'Did you know mild dehydration causes fatigue? A sip of water = instant energy!' },
];

function getRandomMessage() {
  return HYDRATION_MESSAGES[Math.floor(Math.random() * HYDRATION_MESSAGES.length)];
}

const GUEST_PREFS_KEY = 'sipsip_notification_prefs';

function parseHHMM(s) {
  if (!s || typeof s !== 'string') return 7 * 60;
  const p = s.split(':');
  const h = Number(p[0]);
  const m = Number(p[1]);
  if (Number.isNaN(h)) return 7 * 60;
  return h * 60 + (Number.isNaN(m) ? 0 : m);
}

function nearestFrequencyOption(minutes) {
  if (minutes == null || Number.isNaN(Number(minutes))) return 60;
  const n = Number(minutes);
  if (OPTIONS.includes(n)) return n;
  return OPTIONS.reduce((best, opt) =>
    (Math.abs(opt - n) < Math.abs(best - n) ? opt : best));
}

function format24hTo12hStr(time24) {
  if (!time24 || typeof time24 !== 'string') return '';
  const cleanTime = time24.replace(/[^\d:]/g, '');
  const parts = cleanTime.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  if (Number.isNaN(h)) return '';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

function mapServerSettingsToRedux(s) {
  if (!s) return null;
  const prefs = s.reminderPreferences || {};
  return {
    enabled: s.enabled,
    frequencyMinutes: nearestFrequencyOption(s.frequencyMinutes),
    wakeTime: s.wakeTime || '07:00',
    sleepTime: s.sleepTime || '23:00',
    reminderPreferences: {
      sip: prefs.sip !== undefined ? prefs.sip : true,
      morning: prefs.morning !== undefined ? prefs.morning : false,
      weekly: prefs.weekly !== undefined ? prefs.weekly : true,
      bed: prefs.bed !== undefined ? prefs.bed : false,
    },
  };
}

// ─── Polaroid / Active Window ─────────────────────────────────────────────────
function useLiveClock(wakeTimeStr, sleepTimeStr) {
  const getState = useCallback(() => {
    const now   = new Date();
    const mins  = now.getHours() * 60 + now.getMinutes();
    const wake  = parseHHMM(wakeTimeStr);
    const sleep = parseHHMM(sleepTimeStr);
    const mm    = String(now.getMinutes()).padStart(2, '0');
    
    let nowH = now.getHours();
    const ampm = nowH >= 12 ? 'PM' : 'AM';
    if (nowH === 0) nowH = 12;
    else if (nowH > 12) nowH -= 12;
    const now12 = `${String(nowH).padStart(2, '0')}:${mm} ${ampm}`;

    // Handle overnight windows (e.g., wake 10:00, sleep 02:00)
    const crossesMidnight = sleep <= wake;
    const total = crossesMidnight ? (1440 - wake + sleep) : (sleep - wake);
    const safeTot = Math.max(1, total);

    // Determine if current time is inside the active window
    const inWin = crossesMidnight
      ? (mins >= wake || mins < sleep)   // e.g. 10:00→02:00: active if ≥10:00 OR <02:00
      : (mins >= wake && mins < sleep);   // e.g. 07:00→23:00: active if ≥07:00 AND <23:00

    // Elapsed minutes since wake (wrapping past midnight if needed)
    const elapsed = inWin
      ? (mins >= wake ? mins - wake : (1440 - wake + mins))
      : 0;

    const pct = inWin ? Math.min((elapsed / safeTot) * 100, 100)
              : (crossesMidnight
                  ? (mins >= sleep && mins < wake ? 0 : 100)  // between sleep→wake = 0
                  : (mins < wake ? 0 : 100));                 // before wake = 0, after sleep = 100

    let remaining = '', statusText = '';
    if (inWin) {
      // Minutes remaining until sleep
      const left = crossesMidnight
        ? (mins >= wake ? (1440 - mins + sleep) : (sleep - mins))
        : (sleep - mins);
      remaining  = `${Math.floor(left / 60)}h ${left % 60}m left`;
      statusText = `Now ${now12} · Reminders active — ${Math.floor(left / 60)}h ${left % 60}m left in window`;
    } else {
      const toWake = mins < wake ? wake - mins : (1440 - mins) + wake;
      remaining  = 'Quiet mode';
      statusText = `Now ${now12} · Quiet mode — reminders resume in ${Math.floor(toWake / 60)}h ${toWake % 60}m`;
    }
    return { nowTime: now12, pct, inWin, remaining, statusText };
  }, [wakeTimeStr, sleepTimeStr]);

  const [clock, setClock] = useState(getState);
  useEffect(() => {
    setClock(getState());
    const id = setInterval(() => setClock(getState()), 60000);
    return () => clearInterval(id);
  }, [getState]);
  return clock;
}

// ─── Arc Speedometer ──────────────────────────────────────────────────────────
function ArcSpeedometer({ value, onChange, onSipLabelChange }) {
  const svgRef = useRef(null);

  const idx  = OPTIONS.indexOf(value);
  const frac = idx / N;

  useEffect(() => {
    if (onSipLabelChange) onSipLabelChange(LABELS[idx] + ' · Wake to Sleep');
  }, [idx, onSipLabelChange]);

  const needle = fracToXY(frac, R_NEEDLE);
  const dashOffset = (TOTAL * (1 - frac)).toFixed(3);

  const handleSvgClick = (e) => {
    const rect   = svgRef.current.getBoundingClientRect();
    const scaleX = 300 / rect.width;
    const scaleY = 160 / rect.height;
    const vx = (e.clientX - rect.left) * scaleX;
    const vy = (e.clientY - rect.top)  * scaleY;
    let angle = Math.atan2(CY - vy, vx - CX);
    if (angle < 0) angle = 0;
    if (angle > Math.PI) angle = Math.PI;
    const clickFrac = 1 - (angle / Math.PI);
    const newIdx = Math.min(Math.max(Math.round(clickFrac * N), 0), N);
    onChange(OPTIONS[newIdx]);
  };

  return (
    <div className={styles.arcSpeedo}>
      <div className={styles.arcGaugeWrap}>
        <svg ref={svgRef} viewBox="0 0 300 168" preserveAspectRatio="xMidYMid meet"
             className={styles.arcSvg} onClick={handleSvgClick}>
          <defs>
            <linearGradient id="arcGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%"   stopColor="#74b9ff"/>
              <stop offset="50%"  stopColor="#22C55E"/>
              <stop offset="100%" stopColor="#F59E0B"/>
            </linearGradient>
          </defs>
          {/* Track */}
          <path d="M 32,152 A 118,118 0 0,1 268,152"
                fill="none" stroke="var(--bg)" strokeWidth="13" strokeLinecap="round"/>
          {/* Fill */}
          <path d="M 32,152 A 118,118 0 0,1 268,152"
                fill="none" stroke="url(#arcGrad)" strokeWidth="13" strokeLinecap="round"
                strokeDasharray="370.7" strokeDashoffset={dashOffset}
                style={{ transition: 'stroke-dashoffset 0.3s ease' }}/>
          {/* Dots */}
          {OPTIONS.map((_, i) => {
            const f  = i / N;
            const pt = fracToXY(f, R_ARC);
            const active = i === idx;
            return (
              <circle key={i}
                cx={pt.x.toFixed(2)} cy={pt.y.toFixed(2)}
                r={active ? 9 : 7}
                fill={active ? 'var(--text)' : 'var(--card)'}
                stroke={active ? 'var(--text)' : 'var(--text4)'}
                strokeWidth="1.5"
                style={{ cursor: 'pointer', transition: 'all .22s cubic-bezier(.34,1.56,.64,1)' }}
                onClick={(e) => { e.stopPropagation(); onChange(OPTIONS[i]); }}
              />
            );
          })}
          {/* Needle */}
          <line x1={CX} y1={CY} x2={needle.x.toFixed(2)} y2={needle.y.toFixed(2)}
                stroke="var(--text)" strokeWidth="2.5" strokeLinecap="round"
                style={{ transition: 'x2 0.3s ease, y2 0.3s ease' }}/>
          <circle cx={CX} cy={CY} r="8" fill="var(--text)"/>
          <circle cx={CX} cy={CY} r="3" fill="var(--card)"/>
        </svg>

        {/* Center value */}
        <div className={styles.arcCenter}>
          <div className={styles.ascVal}>{DISP[idx]}</div>
          <div className={styles.ascLabel}>interval</div>
        </div>
      </div>

      {/* Tick labels */}
      <div className={styles.arcTicks}>
        {DISP.map((d, i) => (
          <span key={i}
                className={i === idx ? styles.activeTick : ''}
                onClick={() => onChange(OPTIONS[i])}>
            {d}
          </span>
        ))}
      </div>

      {/* Pill buttons */}
      <div className={styles.arcPills}>
        {LABELS.map((l, i) => (
          <button key={i}
                  className={`${styles.arcPill} ${i === idx ? styles.arcPillActive : ''}`}
                  onClick={() => onChange(OPTIONS[i])}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Notifications Page ──────────────────────────────────────────────────
export default function Notifications() {
  const dispatch = useDispatch();
  const isAppEnabled = useSelector(state => state.notifications?.enabled);
  const authToken    = useSelector(state => state.auth?.token);
  const profileState = useSelector(state => state.profile);
  const [pushLoading, setPushLoading] = useState(false);

  // ═══ REVEAL ANIMATIONS ═══
  const [backShow, setBackShow] = useState(false);

  const [menuOpen,     setMenuOpen]     = useState(false);
  const [frequency,    setFrequency]    = useState(60);   // minutes
  const [sipFreqLabel, setSipFreqLabel] = useState('Every hour · Wake to Sleep');
  const [toggles,      setToggles]      = useState(() =>
    Object.fromEntries(REMINDER_ROWS.map(r => [r.id, r.defaultOn]))
  );
  // Wake/sleep times are read-only here — sourced from Profile page
  const wakeTimeStr  = profileState?.wakeTime || '07:00';
  const sleepTimeStr = profileState?.sleepTime || '23:00';
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [permState,    setPermState]    = useState('default'); // 'default' | 'granted' | 'denied'

  const clock  = useLiveClock(wakeTimeStr, sleepTimeStr);

  const wakeStr  = format24hTo12hStr(wakeTimeStr);
  const sleepStr = format24hTo12hStr(sleepTimeStr);
  const rawSpan = parseHHMM(sleepTimeStr) - parseHHMM(wakeTimeStr);
  const spanMins = rawSpan <= 0 ? rawSpan + 1440 : rawSpan;  // handle overnight
  const totalHrs = Math.round((spanMins / 60) * 10) / 10;

  const freqSaveTimer = useRef(null);

  // Particle canvas ref
  const canvasRef = useRef(null);

  // Check permission on mount
  useEffect(() => {
    const t = setTimeout(() => setBackShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission !== 'default') {
      setPermState(Notification.permission);
    }
    // Pre-register the service worker so it's ready when the user subscribes
    if ('serviceWorker' in navigator) {
      registerServiceWorker().catch(err => console.warn('[SW register]', err));
    }
  }, []);

  // Particles
  const spawnParticles = useCallback((cx, cy) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const cols = ['#74b9ff','#818CF8','#f472b6','#22C55E','#F59E0B','#a78bfa'];
    let pts = [];
    for (let i = 0; i < 55; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6;
      pts.push({ x: cx, y: cy, vx: Math.cos(a)*s, vy: Math.sin(a)*s - 2,
                 r: 2+Math.random()*4, c: cols[Math.floor(Math.random()*cols.length)],
                 a: 1, d: 0.012+Math.random()*0.018, circ: Math.random()>.4 });
    }
    let raf = null;
    function loop() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pts = pts.filter(p => p.a > 0.02);
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.a -= p.d;
        ctx.save(); ctx.globalAlpha = Math.max(0, p.a); ctx.fillStyle = p.c;
        ctx.translate(p.x, p.y); ctx.beginPath();
        if (p.circ) { ctx.arc(0,0,p.r,0,Math.PI*2); }
        else {
          const h = p.r*2;
          ctx.moveTo(0,-h); ctx.bezierCurveTo(p.r*.8,-h*.5,p.r*.8,0,0,p.r*.7);
          ctx.bezierCurveTo(-p.r*.8,0,-p.r*.8,-h*.5,0,-h);
        }
        ctx.fill(); ctx.restore();
      }
      raf = pts.length ? requestAnimationFrame(loop) : null;
      if (!raf) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    loop();
  }, []);

  // Resize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Load settings (API when logged in; localStorage for guests)
  useEffect(() => {
    if (authToken) {
      let cancelled = false;
      (async () => {
        try {
          const s = await fetchNotificationSettings(authToken);
          if (cancelled) return;
          if (s) {
            const mapped = mapServerSettingsToRedux(s);
            dispatch(setNotificationSettings(mapped));
            setFrequency(mapped.frequencyMinutes);
            setToggles(Object.fromEntries(REMINDER_ROWS.map(r => [
              r.id,
              mapped.reminderPreferences?.[r.id] ?? r.defaultOn,
            ])));
            // wakeTime/sleepTime now come from profile — no local set needed
            // Backfill IANA time zone for older accounts (server used local TZ before)
            if (!s.timeZone) {
              patchNotificationSettings(authToken, {}).catch(() => {});
            }
          }
        } catch (e) {
          console.error('[fetchNotificationSettings]', e);
        } finally {
          if (!cancelled) setSettingsHydrated(true);
        }
      })();
      return () => { cancelled = true; };
    }
    const raw = localStorage.getItem(GUEST_PREFS_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        dispatch(setNotificationSettings({ enabled: p.enabled ?? false }));
        setFrequency(nearestFrequencyOption(p.frequencyMinutes));
        setToggles(Object.fromEntries(REMINDER_ROWS.map(r => [
          r.id,
          p.reminderPreferences?.[r.id] ?? r.defaultOn,
        ])));
        // wakeTime/sleepTime now come from profile — no local set needed
      } catch (_) { /* ignore */ }
    }
    setSettingsHydrated(true);
    return undefined;
  }, [authToken, dispatch]);

  useEffect(() => {
    if (authToken || !settingsHydrated) return;
    localStorage.setItem(GUEST_PREFS_KEY, JSON.stringify({
      enabled: isAppEnabled,
      reminderPreferences: toggles,
      frequencyMinutes: frequency,
    }));
  }, [authToken, settingsHydrated, isAppEnabled, toggles, frequency]);

  const scheduleFreqSave = useCallback((min) => {
    if (freqSaveTimer.current) clearTimeout(freqSaveTimer.current);
    freqSaveTimer.current = setTimeout(async () => {
      if (!authToken || !settingsHydrated) return;
      try {
        const s = await patchNotificationSettings(authToken, { frequencyMinutes: min });
        dispatch(setNotificationSettings(mapServerSettingsToRedux(s)));
      } catch (e) {
        console.error('[patch freq]', e);
      }
    }, 500);
  }, [authToken, settingsHydrated, dispatch]);

  const onFrequencyChange = useCallback((min) => {
    setFrequency(min);
    const idx = OPTIONS.indexOf(min);
    if (idx >= 0) setSipFreqLabel(`${LABELS[idx]} · Wake to Sleep`);
    if (!settingsHydrated) return;
    if (authToken) scheduleFreqSave(min);
  }, [settingsHydrated, authToken, scheduleFreqSave]);

  const handleAllowNotif = async () => {
    if (!('Notification' in window)) { setPermState('denied'); return; }
    if (Notification.permission === 'granted') {
      window.open('about:preferences#privacy', '_blank') ||
        window.open('chrome://settings/content/notifications', '_blank');
      return;
    }
    const permission = await Notification.requestPermission();
    setPermState(permission);
    if (permission === 'granted') {
      if (authToken) {
        setPushLoading(true);
        try {
          const { settings } = await subscribeToPush(authToken);
          if (settings) dispatch(setNotificationSettings(mapServerSettingsToRedux(settings)));
          else dispatch(setNotificationSettings({ enabled: true }));
          const hero = document.getElementById('notifHeroCard');
          if (hero) {
            const r = hero.getBoundingClientRect();
            spawnParticles(r.left + r.width / 2, r.top + r.height / 2);
          }
        } catch (err) {
          console.error('[subscribeToPush]', err);
          dispatch(setNotificationSettings({ enabled: true }));
          alert('Push subscription saved locally. Background reminders require the server to be running.');
        } finally {
          setPushLoading(false);
        }
      } else {
        // Guest user — local-only
        dispatch(setNotificationSettings({ enabled: true }));
        new Notification('SipSip 💧', { body: "You're all set! We'll remind you to stay hydrated." });
      }
    }
  };

  const handleMasterToggle = async () => {
    if (!authToken) {
      dispatch(toggleEnabled());
      if (isAppEnabled) {
        showToast({ emoji: '📱', title: 'Notifications Paused', body: 'App reminders have been disabled locally.' });
      } else {
        showToast({ emoji: '📱', title: 'Notifications Active', body: 'App reminders are now enabled.' });
      }
      return;
    }
    setPushLoading(true);
    try {
      if (isAppEnabled) {
        await unsubscribeFromPush(authToken);
        dispatch(setNotificationSettings({ enabled: false }));
        showToast({ emoji: '📱', title: 'Notifications Paused', body: 'App reminders have been turned off.' });
      } else {
        const { settings } = await subscribeToPush(authToken);
        if (settings) dispatch(setNotificationSettings(mapServerSettingsToRedux(settings)));
        else dispatch(setNotificationSettings({ enabled: true }));
        showToast({ emoji: '📱', title: 'Notifications Active', body: 'App reminders are now enabled.' });
      }
    } catch (err) {
      console.error('[masterToggle]', err);
      dispatch(toggleEnabled());
      showToast({ emoji: '⚠️', title: 'Error', body: 'Failed to update toggle setting.' });
    } finally {
      setPushLoading(false);
    }
  };

  const handleRevokeHelp = (e) => {
    e.stopPropagation();
    alert(
      'To turn off browser notifications:\n\n' +
      '1. Click the 🔒 lock (or ⓘ) icon in your browser\'s address bar\n' +
      '2. Find "Notifications" and set it to "Block"\n' +
      '3. Reload the page'
    );
  };

  const [testSent, setTestSent] = useState(false);
  const [toastData, setToastData] = useState(null); // { emoji, title, body, time }
  const [toastExiting, setToastExiting] = useState(false);
  const toastTimerRef = useRef(null);

  const dismissToast = useCallback(() => {
    setToastExiting(true);
    setTimeout(() => {
      setToastData(null);
      setToastExiting(false);
    }, 400);
  }, []);

  const showToast = useCallback((msg) => {
    // Clear any existing timer
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastExiting(false);

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    setToastData({ emoji: msg.emoji, title: msg.title, body: msg.body, time });

    // Auto-dismiss after 4s
    toastTimerRef.current = setTimeout(() => dismissToast(), 4000);
  }, [dismissToast]);

  const handleSendTest = async () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      alert('Please allow browser notifications to test this feature.');
      return;
    }

    const msg = getRandomMessage();

    // Always show the in-app toast so the user sees it visually
    showToast(msg);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);

    // Also try to send a real push/browser notification in the background
    if (authToken && isAppEnabled) {
      try {
        await sendTestPush(authToken);
        return;
      } catch (err) {
        console.warn('[sendTestPush fallback]', err.message);
      }
    }

    // Fallback: local browser notification
    try {
      new Notification(`SipSip — ${msg.title}`, {
        body: msg.body,
        icon: '/favicon.ico',
      });
    } catch (_) { /* silent */ }
  };

  const handleToggle = (id) => {
    const isNowOn = !toggles[id];
    
    setToggles(prev => {
      const next = { ...prev, [id]: isNowOn };
      if (authToken && settingsHydrated) {
        patchNotificationSettings(authToken, { reminderPreferences: { [id]: next[id] } })
          .then(s => dispatch(setNotificationSettings(mapServerSettingsToRedux(s))))
          .catch(e => console.error('[toggle]', e));
      }
      return next;
    });

    const rowInfo = REMINDER_ROWS.find(r => r.id === id);
    if (rowInfo) {
      if (isNowOn) {
        const bodyText = id === 'sip' ? sipFreqLabel : rowInfo.sub;
        showToast({ emoji: rowInfo.icon, title: `${rowInfo.title} On`, body: bodyText });
      } else {
        showToast({ emoji: rowInfo.icon, title: `${rowInfo.title} Off`, body: `You will no longer receive these reminders.` });
      }
    }
  };

  return (
    <>
      <SEO
        title="Notifications"
        description="Configure smart hydration reminders based on your schedule."
        path="/notifications"
      />
      {/* ── In-App Notification Toast ── */}
      {toastData && (
        <div className={styles.toastOverlay}>
          <div
            className={`${styles.toastCard} ${toastExiting ? styles.toastExiting : ''}`}
            onClick={dismissToast}
          >
            <div className={styles.toastHeader}>
              <div className={styles.toastAppIcon}>💧</div>
              <div className={styles.toastAppName}>SipSip</div>
              <div className={styles.toastTime}>{toastData.time}</div>
            </div>
            <div className={styles.toastBody}>
              <div className={styles.toastEmoji}>{toastData.emoji}</div>
              <div className={styles.toastContent}>
                <div className={styles.toastTitle}>{toastData.title}</div>
                <div className={styles.toastMessage}>{toastData.body}</div>
              </div>
            </div>
            <div className={styles.toastDismiss}>tap to dismiss</div>
            <div className={styles.toastProgress} />
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className={styles.particleCanvas} />

      <Navbar animateIn={true} onMenuClick={() => setMenuOpen(true)} />
      <MenuDrawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className={styles.pageWrapper}>
        <div className={styles.notifWrap}>

          {/* Back button */}
          <BackButton revealed={backShow} delay={100} />

          {/* Heading */}
          <div className={`${styles.pageHeading} ${styles.reveal} ${styles.d2}`}>
            Notifications
          </div>
          <div className={`${styles.pageSub} ${styles.reveal} ${styles.d3}`}>
            Smart hydration reminders
          </div>

          {/* ── Hero Card ── */}
          <div id="notifHeroCard" className={`${styles.neoCard} ${styles.notifHero} ${styles.reveal} ${styles.d4}`}>
            <span className={styles.notifBell}>🔔</span>
            <div className={styles.notifHeroTitle}>Gentle Reminders</div>
            <div className={styles.notifHeroSub}>
              SipSip sends intelligent reminders based on your schedule — not fixed timers. We respect your focus time.
            </div>
            <div className={styles.notifBtnWrap}>
              
              {permState === 'granted' ? (
                <div 
                  className={`${styles.notifRow} ${isAppEnabled ? styles.activeRow : ''} ${pushLoading ? styles.loadingOpt : ''}`}
                  onClick={pushLoading ? undefined : handleMasterToggle}
                  style={{ width: '100%', maxWidth: '340px', padding: '1rem 1.25rem', opacity: pushLoading ? 0.6 : 1, cursor: pushLoading ? 'wait' : 'pointer' }}
                >
                  <div className={styles.notifRowLeft}>
                    <div className={styles.notifIcon}>📱</div>
                    <div className={styles.notifRowInfo} style={{ textAlign: 'left' }}>
                      <div className={styles.notifRowTitle}>App Notifications</div>
                      <div className={styles.notifRowSub}>
                        {pushLoading ? 'Updating...' : isAppEnabled ? 'Active (Background push enabled)' : 'Paused'}
                      </div>
                    </div>
                  </div>
                  <div className={`${styles.toggle} ${isAppEnabled ? styles.toggleOn : ''}`} />
                </div>
              ) : (
                <button
                  id="notifAllowBtn"
                  className={`${styles.notifAllowBtn} ${permState === 'denied' ? styles.denied : ''}`}
                  onClick={handleAllowNotif}
                >
                  {permState === 'denied' ? 'Permission Denied' : 'Allow Notifications'}
                </button>
              )}

              <div className={`${styles.permBadge} ${permState !== 'default' ? styles.permShow : ''} ${permState === 'granted' ? styles.grantedBadge : ''} ${permState === 'denied' ? styles.deniedBadge : ''}`}>
                <span className={styles.permDot} />
                <span>
                  {permState === 'granted' ? 'Browser permission granted'
                    : permState === 'denied'  ? 'Denied — enable in browser settings'
                    : ''}
                </span>
              </div>
              
              {permState === 'granted' && (
                <button className={styles.revokeHint} onClick={handleRevokeHelp}>
                  Want to revoke browser permission? Instructions ↗
                </button>
              )}
              {permState === 'denied' && (
                <button className={styles.revokeHint} onClick={() =>
                  alert(
                    'To enable notifications:\n\n' +
                    '1. Click the 🔒 lock (or ⓘ) icon in your browser\'s address bar\n' +
                    '2. Find "Notifications" and set it to "Allow"\n' +
                    '3. Reload the page'
                  )
                }>
                  How to enable in browser settings ↗
                </button>
              )}
            </div>
          </div>

          {/* ── Active Window ── */}
          <div className={`${styles.sectionLabel} ${styles.reveal} ${styles.d5}`}>
            Active Window
          </div>
          <div className={`${styles.neoCard} ${styles.windowCard} ${styles.reveal} ${styles.d5}`}>
            <div className={styles.polaroidSection}>

              <div className={styles.polaroidRow}>
                {/* Wake card */}
                <div className={`${styles.polaroidCard} ${styles.wakeCard}`}>
                  <div className={`${styles.polImg} ${styles.wakeImg}`}>☀</div>
                  <div className={styles.polCap}>
                    <div className={styles.polTime}>{wakeStr}</div>
                    <div className={styles.polLabel}>Wake</div>
                  </div>
                </div>

                {/* Middle */}
                <div className={styles.polaroidMiddle}>
                  <div className={styles.polMidDur}>{totalHrs} hours</div>
                  <div className={styles.polMidArrow}>→</div>
                  <div className={styles.polMidNow}>
                    <div className={styles.polMidNowDot} />
                    <div className={styles.polMidNowTime}>{clock.nowTime}</div>
                    <div className={styles.polMidNowLabel}>now</div>
                  </div>
                  <div className={styles.polMidRemaining}>{clock.remaining}</div>
                </div>

                {/* Sleep card */}
                <div className={`${styles.polaroidCard} ${styles.sleepCard}`}>
                  <div className={`${styles.polImg} ${styles.sleepImg}`}>🌙</div>
                  <div className={styles.polCap}>
                    <div className={styles.polTime}>{sleepStr}</div>
                    <div className={styles.polLabel}>Sleep</div>
                  </div>
                </div>
              </div>

              <div className={styles.timeRow}>
                <div className={styles.timeField}>
                  <span>Wake</span>
                  <span className={styles.timeValue}>{wakeStr}</span>
                </div>
                <div className={styles.timeField}>
                  <span>Sleep</span>
                  <span className={styles.timeValue}>{sleepStr}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className={styles.polProgressWrap}>
                <div className={styles.polProgressBar}>
                  <div className={styles.polProgressFill}
                       style={{ width: `${clock.pct}%` }} />
                </div>
                <div className={styles.polProgressLabels}>
                  <span>{wakeStr}</span>
                  <span className={styles.lblNow}>Now {clock.nowTime}</span>
                  <span>{sleepStr}</span>
                </div>
              </div>
            </div>

            {/* Status row */}
            <div className={styles.wstatus}>
              <span className={`${styles.wstatusPulse} ${!clock.inWin ? styles.inactive : ''}`} />
              <span>{clock.statusText}</span>
            </div>
          </div>

          {/* ── Reminder Frequency ── */}
          <div className={`${styles.sectionLabel} ${styles.reveal} ${styles.d6}`}>
            Reminder Frequency
          </div>
          <div className={`${styles.neoCard} ${styles.freqCard} ${styles.reveal} ${styles.d6}`}>
            <div className={styles.freqHeader}>
              <div className={styles.freqIcon}>⏱️</div>
              <div>
                <div className={styles.freqTitle}>How often should we nudge you?</div>
                <div className={styles.freqSub}>Gauge your interval · Select below</div>
              </div>
            </div>
            <ArcSpeedometer
              value={frequency}
              onChange={onFrequencyChange}
              onSipLabelChange={setSipFreqLabel}
            />
          </div>

          {/* ── Reminder Settings ── */}
          <div className={`${styles.sectionLabel} ${styles.reveal} ${styles.d7}`}>
            Reminder Settings
          </div>
          <div className={`${styles.notifSettings} ${styles.reveal} ${styles.d7}`}>
            {REMINDER_ROWS.map(row => {
              const on  = toggles[row.id];
              const sub = row.id === 'sip' ? sipFreqLabel : row.sub;
              return (
                <div key={row.id}
                     className={`${styles.notifRow} ${on ? styles.activeRow : ''}`}
                     onClick={() => handleToggle(row.id)}>
                  <div className={styles.notifRowLeft}>
                    <div className={styles.notifIcon}>{row.icon}</div>
                    <div className={styles.notifRowInfo}>
                      <div className={styles.notifRowTitle}>{row.title}</div>
                      <div className={styles.notifRowSub}>{sub}</div>
                    </div>
                  </div>
                  <div className={`${styles.toggle} ${on ? styles.toggleOn : ''}`} />
                </div>
              );
            })}
          </div>

          {/* Test button */}
          <button className={`${styles.testBtn} ${testSent ? styles.testBtnSent : ''} ${styles.reveal} ${styles.d9}`}
                  onClick={handleSendTest}>
            {testSent ? (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
                Notification Sent!
              </>
            ) : (
              <>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                Send Test Notification
              </>
            )}
          </button>

        </div>
      </div>
    </>
  );
}
