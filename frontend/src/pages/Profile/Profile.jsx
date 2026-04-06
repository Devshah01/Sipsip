import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate }   from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { saveProfile, selectProfile } from '@/store/slices/profileSlice';
import { calculateDailyGoal } from '@/utils/hydrationGoal';
import { patchNotificationSettings, fetchNotificationSettings } from '@/utils/pushUtils';
import { setNotificationSettings } from '@/store/slices/notificationsSlice';
import styles            from './Profile.module.css';
import Navbar             from '@/components/layout/Navbar/Navbar';
import MenuDrawer         from '@/components/layout/MenuDrawer/MenuDrawer';
import BackButton         from '@/components/layout/BackButton/BackButton';
import SEO                from '@/components/SEO/SEO';

/* ═══════════════════════════════════════════════
   DRUM FACTORY — iOS-style smooth momentum scroll
═══════════════════════════════════════════════ */
function makeDrum(innerId, items, defaultIdx, itemHeight, onChangeCallback, itemCls, activeCls) {
  const inner = document.getElementById(innerId);
  if (!inner) return null;
  const drum = inner.closest(`.${styles.drumWrap}`);
  if (!drum) return null;
  const IH = itemHeight;
  let cur = defaultIdx, offset = 0, velocity = 0, samples = [], rafId = null;

  // Build DOM
  items.forEach((v, i) => {
    const el = document.createElement('div');
    el.className = (itemCls || 'drum-item') + (i === defaultIdx ? ' ' + (activeCls || 'drum-item-active') : '');
    el.textContent = v;
    inner.appendChild(el);
  });

  function clampOffset(o) {
    const minO = -(items.length - 1 - defaultIdx) * IH;
    const maxO = defaultIdx * IH;
    if (o < minO) o = minO + (o - minO) * 0.18;
    if (o > maxO) o = maxO + (o - maxO) * 0.18;
    return o;
  }
  function offsetToCur(o) {
    const idx = defaultIdx - Math.round(o / IH);
    return Math.max(0, Math.min(idx, items.length - 1));
  }
  function snapOffset() { return (defaultIdx - cur) * IH; }

  function applyOffset(o, transition) {
    inner.style.transition = transition || 'none';
    const drumH = drum.offsetHeight;
    const baseY = (drumH / 2) - (defaultIdx * IH) - (IH / 2);
    inner.style.transform = `translateY(${baseY + o}px)`;
    const newCur = offsetToCur(o);
    if (newCur !== cur) {
      cur = newCur;
      inner.querySelectorAll('.' + (itemCls || 'drum-item')).forEach((el, j) => {
        el.classList.toggle(activeCls || 'drum-item-active', j === cur);
      });
      if (onChangeCallback) onChangeCallback(items[cur], cur);
    }
  }

  function snapToCur(fast) {
    offset = snapOffset();
    applyOffset(offset, fast
      ? 'transform 0.12s cubic-bezier(0.25,0.8,0.25,1)'
      : 'transform 0.38s cubic-bezier(0.25,0.46,0.45,0.94)');
  }

  function goTo(idx, animated) {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    cur = Math.max(0, Math.min(idx, items.length - 1));
    offset = snapOffset();
    inner.querySelectorAll(`.${styles.drumItem}`).forEach((el, j) => {
      el.classList.toggle(styles.drumItemActive, j === cur);
    });
    applyOffset(offset, animated ? 'transform 0.22s cubic-bezier(0.25,0.8,0.25,1)' : 'none');
    if (onChangeCallback) onChangeCallback(items[cur], cur);
  }

  goTo(defaultIdx, false);

  function recordSample(y) {
    const now = Date.now();
    samples.push({ t: now, y });
    while (samples.length > 1 && now - samples[0].t > 80) samples.shift();
  }
  function computeVelocity() {
    if (samples.length < 2) return 0;
    const first = samples[0], last = samples[samples.length - 1];
    const dt = last.t - first.t;
    if (dt < 1) return 0;
    return ((last.y - first.y) / dt) * 16;
  }

  function momentumLoop() {
    velocity *= 0.94;
    offset += velocity;
    offset = clampOffset(offset);
    const newCur = offsetToCur(offset);
    if (newCur !== cur) {
      cur = newCur;
      inner.querySelectorAll(`.${styles.drumItem}`).forEach((el, j) => {
        el.classList.toggle(styles.drumItemActive, j === cur);
      });
      if (onChangeCallback) onChangeCallback(items[cur], cur);
    }
    applyOffset(offset, 'none');
    if (Math.abs(velocity) > 0.4) {
      rafId = requestAnimationFrame(momentumLoop);
    } else {
      velocity = 0;
      snapToCur(true);
    }
  }

  // Touch
  let touchStartY = 0, touchStartOffset = 0, isTouching = false;
  drum.addEventListener('touchstart', e => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    isTouching = true; touchStartY = e.touches[0].clientY;
    touchStartOffset = offset; velocity = 0; samples = [];
    recordSample(touchStartY);
  }, { passive: false });
  drum.addEventListener('touchmove', e => {
    if (!isTouching) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    offset = clampOffset(touchStartOffset + (y - touchStartY));
    recordSample(y);
    applyOffset(offset, 'none');
  }, { passive: false });
  drum.addEventListener('touchend', e => {
    if (!isTouching) return;
    isTouching = false;
    if (e.changedTouches.length) recordSample(e.changedTouches[0].clientY);
    velocity = computeVelocity();
    Math.abs(velocity) > 1.5 ? rafId = requestAnimationFrame(momentumLoop) : snapToCur(false);
  }, { passive: true });

  // Mouse
  let mouseStartY = 0, mouseStartOffset = 0, isDragging = false;
  drum.addEventListener('mousedown', e => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    isDragging = true; mouseStartY = e.clientY;
    mouseStartOffset = offset; velocity = 0; samples = [];
    recordSample(mouseStartY); e.preventDefault();
  });
  const onMouseMove = e => {
    if (!isDragging) return;
    offset = clampOffset(mouseStartOffset + (e.clientY - mouseStartY));
    recordSample(e.clientY);
    applyOffset(offset, 'none');
  };
  const onMouseUp = e => {
    if (!isDragging) return;
    isDragging = false;
    recordSample(e.clientY);
    velocity = computeVelocity();
    Math.abs(velocity) > 1.5 ? rafId = requestAnimationFrame(momentumLoop) : snapToCur(false);
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // Wheel
  drum.addEventListener('wheel', e => {
    e.preventDefault();
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    goTo(Math.max(0, Math.min(cur + Math.sign(e.deltaY), items.length - 1)), true);
  }, { passive: false });

  return {
    getVal: () => items[cur],
    getIdx: () => cur,
    step:   (dir) => goTo(Math.max(0, Math.min(cur + dir, items.length - 1)), true),
    goTo:   (idx, animated = true) => goTo(idx, animated),
    destroy: () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      if (rafId) cancelAnimationFrame(rafId);
    }
  };
}

/* ═══════════════════════════════════════════════
   CONFETTI
═══════════════════════════════════════════════ */
const CONF_COLORS = ['#1a3a6e','#2563b8','#3b82f6','#93c5fd','#74b9ff','#0a0a0a','#1c1b18','#ffffff','#60a5fa','#dbeafe'];
function runConfetti(canvas, btnRect) {
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  let particles = [];
  for (let i = 0; i < 180; i++) {
    particles.push({
      x: btnRect.left + btnRect.width / 2 + (Math.random() - 0.5) * btnRect.width,
      y: btnRect.top,
      r: Math.random() * 8 + 4,
      color: CONF_COLORS[Math.floor(Math.random() * CONF_COLORS.length)],
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -18 - 6,
      gravity: 0.55, alpha: 1,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.18,
      shape: Math.random() < 0.5 ? 'rect' : 'circle',
      w: Math.random() * 10 + 5, h: Math.random() * 5 + 3,
    });
  }
  function loop() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles = particles.filter(p => p.alpha > 0 && p.y < canvas.height + 20);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
      p.vx *= 0.98; p.rot += p.rotV; p.alpha -= 0.013;
      ctx.save();
      ctx.globalAlpha = Math.max(p.alpha, 0);
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.shape === 'rect') ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
    if (particles.length > 0) requestAnimationFrame(loop);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(loop);
}

/* ═══════════════════════════════════════════════
   DRUM WRAPPER COMPONENT
═══════════════════════════════════════════════ */
function DrumScroller({ id, className, selHeight, onUp, onDown, children }) {
  return (
    <div className={styles.drumWithBtns}>
      <button className={styles.drumBtn} onClick={onUp}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>
      <div className={`${styles.drumWrap} ${className || ''}`} id={id}>
        <div className={styles.drumSel} style={{ height: selHeight }}/>
        <div className={styles.drumFadeTop} style={{ height: selHeight }}/>
        <div className={styles.drumFadeBot} style={{ height: selHeight }}/>
        <div className={styles.drumInner} id={`${id}-inner`}/>
      </div>
      <button className={styles.drumBtn} onClick={onDown}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
    </div>
  );
}

function parseTimeTo24h(s) {
  const m = String(s).trim().match(/^(\d{1,2}):(\d{2}).*(AM|PM)$/i);
  if (!m) return '07:00';
  let h = parseInt(m[1], 10);
  const min = m[2];
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

function format24hTo12h(time24) {
  if (!time24 || typeof time24 !== 'string') return { h: '06', m: '00', ampm: 'AM' };
  const cleanTime = time24.replace(/[^\d:]/g, '');
  const parts = cleanTime.split(':');
  let h = parseInt(parts[0], 10);
  const m = parts[1] || '00';
  if (Number.isNaN(h)) return { h: '06', m: '00', ampm: 'AM' };
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return { h: String(h).padStart(2, '0'), m, ampm };
}

/* ═══════════════════════════════════════════════
   MAIN PROFILE PAGE
═══════════════════════════════════════════════ */
export default function Profile() {
  const navigate     = useNavigate();
  const dispatch     = useDispatch();
  const isDark       = useSelector(s => s.ui?.theme === 'dark');
  const reduxProfile = useSelector(selectProfile);
  const authUser     = useSelector(s => s.auth.user);
  const authToken    = useSelector(s => s.auth?.token);

  const [menuOpen, setMenuOpen] = useState(false);

  // Reveal states (same pattern as Dashboard)
  const [backShow,     setBackShow]     = useState(false);
  const [headerShow,   setHeaderShow]   = useState(false);
  const [avatarShow,   setAvatarShow]   = useState(false);
  const [h1Show,       setH1Show]       = useState(false);
  const [card1Show,    setCard1Show]    = useState(false);
  const [h2Show,       setH2Show]       = useState(false);
  const [card2Show,    setCard2Show]    = useState(false);
  const [h3Show,       setH3Show]       = useState(false);
  const [card3Show,    setCard3Show]    = useState(false);
  const [saveShow,     setSaveShow]     = useState(false);

  const initWake  = format24hTo12h(reduxProfile?.wakeTime);
  const initSleep = format24hTo12h(reduxProfile?.sleepTime);

  const [name,     setName]     = useState(() => authUser?.name?.trim() || '');
  const [gender,   setGender]   = useState(() => reduxProfile?.gender || 'male');
  const genderRef = useRef(gender);
  useEffect(() => { genderRef.current = gender; }, [gender]);
  const [emojiIdx, setEmojiIdx] = useState(0);
  const [goal,     setGoal]     = useState(() => reduxProfile?.dailyGoal || 2376);
  const [goalNote, setGoalNote] = useState(() => {
    const w = reduxProfile?.weight || 72;
    const g = reduxProfile?.dailyGoal || 2376;
    return `Auto-calculated: ${w} kg × 33 ml = ${g.toLocaleString()} ml`;
  });
  const [wakeHM,   setWakeHM]   = useState(`${initWake.h}:${initWake.m}`);
  const [sleepHM,  setSleepHM]  = useState(`${initSleep.h}:${initSleep.m}`);
  const [wakeAmpm, setWakeAmpm]  = useState(initWake.ampm);
  const [sleepAmpm,setSleepAmpm] = useState(initSleep.ampm);
  const [saveAnimating, setSaveAnimating] = useState(false);
  const [saveStatus,    setSaveStatus]    = useState(false);
  const [toast,         setToast]         = useState('');
  const [toastShow,     setToastShow]     = useState(false);

  // Derived display strings
  const wakeStr  = `${wakeHM} ${wakeAmpm}`;
  const sleepStr = `${sleepHM} ${sleepAmpm}`;

  const weightDrumRef = useRef(null);
  const ageDrumRef    = useRef(null);
  const whDrumRef     = useRef(null);
  const wmDrumRef     = useRef(null);
  const shDrumRef     = useRef(null);
  const smDrumRef     = useRef(null);
  const confCanvasRef = useRef(null);
  const saveBtnRef    = useRef(null);
  const toastTimer    = useRef(null);

  const avatarEmojis = ['👤','👦','👧','👨','👩'];

  // Build items
  const weightItems = Array.from({ length: 150 }, (_, i) => `${i + 1} kg`);
  const ageItems    = Array.from({ length: 120 }, (_, i) => `${i + 1} yrs`);
  const hours12     = Array.from({ length: 12 },  (_, i) => String(i + 1).padStart(2, '0'));
  const mins5       = Array.from({ length: 12 },  (_, i) => String(i * 5).padStart(2, '0'));

  /* ── Helpers ── */
  function updateGoal() {
    const kg = weightDrumRef.current ? parseInt(String(weightDrumRef.current.getVal()).replace(/\D/g, ''), 10) : 72;
    const yrs = ageDrumRef.current ? parseInt(String(ageDrumRef.current.getVal()).replace(/\D/g, ''), 10) : 27;
    const gen = genderRef.current || 'other';

    if (!Number.isFinite(kg) || !Number.isFinite(yrs)) return;
    
    const { amount, factor, added } = calculateDailyGoal(kg, yrs, gen);
    setGoal(amount);
    
    let note = `Auto-calculated: ${kg} kg × ${factor} ml`;
    if (added) note += ` + ${added} ml (${gen})`;
    note += ` = ${amount.toLocaleString()} ml`;
    setGoalNote(note);
  }

  function showToastMsg(msg) {
    setToast(msg); setToastShow(true);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastShow(false), 2200);
  }

  /* ── Drum init ── */
  useEffect(() => {
    // Staggered reveal
    setTimeout(() => setBackShow(true),   100);
    setTimeout(() => setHeaderShow(true), 800);
    setTimeout(() => setAvatarShow(true), 950);
    setTimeout(() => setH1Show(true),    1100);
    setTimeout(() => setCard1Show(true), 1160);
    setTimeout(() => setH2Show(true),    1220);
    setTimeout(() => setCard2Show(true), 1280);
    setTimeout(() => setH3Show(true),    1340);
    setTimeout(() => setCard3Show(true), 1400);
    setTimeout(() => setSaveShow(true),  1460);

    // Init drums after DOM is ready
    // Compute initial drum indices from saved profile
    const savedWeight = reduxProfile?.weight || 72;
    const savedAge    = reduxProfile?.age || 27;
    const wk = format24hTo12h(reduxProfile?.wakeTime);
    const sl = format24hTo12h(reduxProfile?.sleepTime);
    const weightIdx = Math.max(0, Math.min(savedWeight - 1, weightItems.length - 1));
    const ageIdx    = Math.max(0, Math.min(savedAge - 1, ageItems.length - 1));
    const whIdx     = Math.max(0, parseInt(wk.h, 10) - 1);    // hours12 is 01..12 → index 0..11
    const wmIdx     = Math.max(0, Math.min(Math.round(parseInt(wk.m, 10) / 5), 11));
    const shIdx     = Math.max(0, parseInt(sl.h, 10) - 1);
    const smIdx     = Math.max(0, Math.min(Math.round(parseInt(sl.m, 10) / 5), 11));

    const t = setTimeout(() => {
      weightDrumRef.current = makeDrum('weight-drum-inner', weightItems, weightIdx, 44, () => {
        updateGoal();
      }, styles.drumItem, styles.drumItemActive);
      ageDrumRef.current = makeDrum('age-drum-inner', ageItems, ageIdx, 44, () => {
        updateGoal();
      }, styles.drumItem, styles.drumItemActive);
      whDrumRef.current  = makeDrum('wh-drum-inner',  hours12, whIdx,  30, (val) => {
        setWakeHM(prev => {
          const m = prev.split(':')[1] || '00';
          return `${val}:${m}`;
        });
      }, styles.drumItem, styles.drumItemActive);
      wmDrumRef.current  = makeDrum('wm-drum-inner',  mins5,   wmIdx,  30, (val) => {
        setWakeHM(prev => {
          const h = prev.split(':')[0];
          return `${h}:${val}`;
        });
      }, styles.drumItem, styles.drumItemActive);
      shDrumRef.current  = makeDrum('sh-drum-inner',  hours12, shIdx,  30, (val) => {
        setSleepHM(prev => {
          const m = prev.split(':')[1] || '00';
          return `${val}:${m}`;
        });
      }, styles.drumItem, styles.drumItemActive);
      smDrumRef.current  = makeDrum('sm-drum-inner',  mins5,   smIdx,  30, (val) => {
        setSleepHM(prev => {
          const h = prev.split(':')[0];
          return `${h}:${val}`;
        });
      }, styles.drumItem, styles.drumItemActive);
    }, 200);

    return () => {
      clearTimeout(t);
      clearTimeout(toastTimer.current);
      [weightDrumRef, ageDrumRef, whDrumRef, wmDrumRef, shDrumRef, smDrumRef].forEach(r => r.current?.destroy?.());
    };
  }, []);

  // wakeStr / sleepStr are now derived — no ampm sync effects needed

  useEffect(() => {
    const n = authUser?.name?.trim();
    if (n) setName(n);
  }, [authUser?._id]);

  useEffect(() => {
    if (reduxProfile?.dailyGoal != null) {
      setGoal(reduxProfile.dailyGoal);
      if (reduxProfile.weight != null) {
        setGoalNote(
          `Auto-calculated: ${reduxProfile.weight} kg × 33 ml = ${reduxProfile.dailyGoal.toLocaleString()} ml`
        );
      }
    }
    if (reduxProfile?.gender) setGender(reduxProfile.gender);
  }, [reduxProfile?.dailyGoal, reduxProfile?.weight, reduxProfile?.gender]);

  useEffect(() => {
    if (!reduxProfile || reduxProfile.isLoading) return;

    const savedWeight = reduxProfile.weight || 72;
    const savedAge    = reduxProfile.age || 27;
    const wk = format24hTo12h(reduxProfile.wakeTime);
    const sl = format24hTo12h(reduxProfile.sleepTime);

    setWakeAmpm(wk.ampm);
    setSleepAmpm(sl.ampm);
    setWakeHM(`${wk.h}:${wk.m}`);
    setSleepHM(`${sl.h}:${sl.m}`);

    const weightIdx = Math.max(0, Math.min(savedWeight - 1, weightItems.length - 1));
    const ageIdx    = Math.max(0, Math.min(savedAge - 1, ageItems.length - 1));
    const whIdx     = Math.max(0, parseInt(wk.h, 10) - 1);
    const wmIdx     = Math.max(0, Math.min(Math.round(parseInt(wk.m, 10) / 5), 11));
    const shIdx     = Math.max(0, parseInt(sl.h, 10) - 1);
    const smIdx     = Math.max(0, Math.min(Math.round(parseInt(sl.m, 10) / 5), 11));

    if (weightDrumRef.current) weightDrumRef.current.goTo(weightIdx, true);
    if (ageDrumRef.current)    ageDrumRef.current.goTo(ageIdx, true);
    if (whDrumRef.current)     whDrumRef.current.goTo(whIdx, true);
    if (wmDrumRef.current)     wmDrumRef.current.goTo(wmIdx, true);
    if (shDrumRef.current)     shDrumRef.current.goTo(shIdx, true);
    if (smDrumRef.current)     smDrumRef.current.goTo(smIdx, true);

  }, [reduxProfile?.age, reduxProfile?.weight, reduxProfile?.wakeTime, reduxProfile?.sleepTime, reduxProfile?.isLoading]);

  async function handleSave() {
    setSaveAnimating(true);
    setTimeout(() => setSaveAnimating(false), 2200);
    const weight = weightDrumRef.current
      ? parseInt(String(weightDrumRef.current.getVal()).replace(/\D/g, ''), 10)
      : null;
    const age = ageDrumRef.current
      ? parseInt(String(ageDrumRef.current.getVal()).replace(/\D/g, ''), 10)
      : null;
    const wake24  = parseTimeTo24h(wakeStr);
    const sleep24 = parseTimeTo24h(sleepStr);
    try {
      await dispatch(
        saveProfile({
          gender: gender || 'other',
          age: Number.isFinite(age) ? age : undefined,
          weight: Number.isFinite(weight) ? weight : undefined,
          wakeTime: wake24,
          sleepTime: sleep24,
        })
      ).unwrap();
      setSaveStatus(true);
      setTimeout(() => setSaveStatus(false), 3000);
      showToastMsg('Profile saved ✓');
      if (confCanvasRef.current && saveBtnRef.current) {
        runConfetti(confCanvasRef.current, saveBtnRef.current.getBoundingClientRect());
      }

      // Sync wake/sleep times to notification settings so the Active Window reflects them
      if (authToken) {
        try {
          const s = await patchNotificationSettings(authToken, {
            wakeTime: wake24,
            sleepTime: sleep24,
          });
          if (s) {
            dispatch(setNotificationSettings({
              wakeTime: s.wakeTime || wake24,
              sleepTime: s.sleepTime || sleep24,
            }));
          }
        } catch (_) { /* notification sync is best-effort */ }
      }
    } catch (err) {
      showToastMsg(typeof err === 'string' ? err : 'Could not save profile');
    }
  }

  function handleReset() {
    setName(authUser?.name?.trim() || 'Alex Morgan');
    setGender('male');
    setEmojiIdx(0);
    
    setWakeAmpm('AM'); 
    setSleepAmpm('PM');
    
    if (ageDrumRef.current) ageDrumRef.current.goTo(19, true);      // 20 years
    if (weightDrumRef.current) weightDrumRef.current.goTo(59, true);   // 60 kg
    if (whDrumRef.current) whDrumRef.current.goTo(6, true);       // 07
    if (wmDrumRef.current) wmDrumRef.current.goTo(0, true);       // 00
    if (shDrumRef.current) shDrumRef.current.goTo(10, true);      // 11
    if (smDrumRef.current) smDrumRef.current.goTo(0, true);       // 00

    showToastMsg('Reset to defaults');
  }

  const avMeta = `${ageDrumRef.current ? parseInt(ageDrumRef.current.getVal()) : 27} years · ${gender.charAt(0).toUpperCase() + gender.slice(1)} · ${weightDrumRef.current ? weightDrumRef.current.getVal() : '72 kg'}`;

  return (
    <div className={`${styles.page} ${isDark ? styles.dark : ''}`}>
      <SEO
        title="Profile"
        description="Set up your personal hydration profile — age, weight, gender, and daily schedule."
        path="/profile"
      />
      <canvas ref={confCanvasRef} className={styles.confettiCanvas}/>
      <div className={`${styles.toast} ${toastShow ? styles.toastShow : ''}`}>{toast}</div>

      {/* ══ NAVBAR ══ */}
      <Navbar onMenuClick={() => setMenuOpen(o => !o)} />
      <MenuDrawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* ══ PAGE WRAP ══ */}
      <div className={styles.pageWrap}>

        {/* Back button */}
        <BackButton revealed={backShow} delay={100} />

        {/* Page header */}
        <div className={`${styles.pageHeader} ${headerShow ? styles.pageHeaderShow : ''}`}>
          <div className={styles.pageTitle}>Profile</div>
          <div className={styles.pageSubtitle}>Personal hydration details</div>
        </div>

        {/* Avatar row */}
        <div className={`${styles.avatarRow} ${avatarShow ? styles.avatarRowShow : ''}`}>
          <div className={styles.avatar} onClick={() => setEmojiIdx(i => (i + 1) % avatarEmojis.length)}>
            <span>{avatarEmojis[emojiIdx]}</span>
            <div className={styles.avatarEdit}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </div>
          </div>
          <div>
            <div className={styles.avatarName}>{name}</div>
            <div className={styles.avatarMeta}>{avMeta}</div>
          </div>
          <div className={styles.avatarStats}>
            <div className={styles.avStat}>
              <div className={styles.avStatVal}>{goal.toLocaleString()}</div>
              <div className={styles.avStatLbl}>ml Goal</div>
            </div>
            <div className={styles.avStat}>
              <div className={styles.avStatVal}>{wakeStr}</div>
              <div className={styles.avStatLbl}>Wake Up</div>
            </div>
            <div className={styles.avStat}>
              <div className={styles.avStatVal}>{sleepStr}</div>
              <div className={styles.avStatLbl}>Sleep</div>
            </div>
          </div>
        </div>

        {/* ── BASIC INFO ── */}
        <div className={`${styles.sectionHeading} ${h1Show ? styles.sectionHeadingRevealed : ''}`}>
          Basic Information
        </div>
        <div className={`${styles.formCard} ${card1Show ? styles.formCardVisible : ''}`}>
          <div className={styles.formGrid}>
            {/* Name */}
            <div className={styles.formField}>
              <label>Full Name</label>
              <input
                type="text" className={styles.formInput}
                value={name} placeholder="Your full name"
                onChange={e => setName(e.target.value)}
              />
            </div>
            {/* Age drum */}
            <div className={styles.formField}>
              <label>Age — drag or scroll</label>
              <DrumScroller
                id="age-drum" className={styles.drumAge}
                selHeight="44px"
                onUp={() => ageDrumRef.current?.step(-1)}
                onDown={() => ageDrumRef.current?.step(1)}
              />
              <div className={styles.drumHint}>↕ scroll / drag to adjust</div>
            </div>
            {/* Gender */}
            <div className={`${styles.formField} ${styles.formFieldFull}`}>
              <label>Gender</label>
              <div className={styles.genderSelector}>
                {[
                  { key: 'male',   label: 'Male',
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="14" r="5"/><line x1="18" y1="6" x2="14.5" y2="9.5"/><polyline points="14 6 18 6 18 10"/></svg> },
                  { key: 'female', label: 'Female',
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="9" r="5"/><line x1="12" y1="14" x2="12" y2="21"/><line x1="9" y1="18" x2="15" y2="18"/></svg> },
                  { key: 'other',  label: 'Other',
                    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg> },
                ].map(({ key, label, icon }) => (
                  <div
                    key={key}
                    className={`${styles.genderOption} ${styles[`genderOption_${key}`]} ${gender === key ? styles.genderOptionSelected : ''}`}
                    onClick={() => { setGender(key); genderRef.current = key; updateGoal(); }}
                  >
                    <div className={styles.genderOptionContent}>
                      <div className={styles.genderIconWrap}>{icon}</div>
                      <div className={styles.genderLbl}>{label}</div>
                      <div className={styles.genderDot}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── BODY METRICS ── */}
        <div className={`${styles.sectionHeading} ${h2Show ? styles.sectionHeadingRevealed : ''}`}>
          Body Metrics
        </div>
        <div className={`${styles.formCard} ${card2Show ? styles.formCardVisible : ''}`}>
          <div className={styles.formGrid}>
            {/* Weight drum */}
            <div className={styles.formField}>
              <label>Weight — drag or scroll</label>
              <DrumScroller
                id="weight-drum" className={styles.drumWeight}
                selHeight="44px"
                onUp={() => weightDrumRef.current?.step(-1)}
                onDown={() => weightDrumRef.current?.step(1)}
              />
              <div className={styles.drumHint}>↕ scroll / drag to adjust</div>
            </div>
            {/* Goal slider */}
            <div className={styles.formField}>
              <label>Daily Hydration Goal</label>
              <div className={styles.goalDisplay}>
                {goal.toLocaleString()} <span>ml / day</span>
              </div>
              <input
                type="range" className={styles.goalInput}
                min="500" max="5000" step="10" value={goal}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  setGoal(v);
                  const kg = weightDrumRef.current ? parseInt(weightDrumRef.current.getVal()) : 72;
                  setGoalNote(`Manual: ${v.toLocaleString()} ml (formula: ${kg} × 33 = ${(kg * 33).toLocaleString()})`);
                }}
              />
              <div className={styles.goalLabels}><span>500 ml</span><span>5,000 ml</span></div>
              <div className={styles.goalCalcNote}>{goalNote}</div>
            </div>
          </div>
        </div>

        {/* ── DAILY SCHEDULE ── */}
        <div className={`${styles.sectionHeading} ${h3Show ? styles.sectionHeadingRevealed : ''}`}>
          Daily Schedule
        </div>
        <div className={`${styles.formCard} ${card3Show ? styles.formCardVisible : ''}`}>
          <div className={styles.formGrid}>
            {/* Wake time */}
            <div className={styles.formField}>
              <label>Wake Up Time</label>
              <div className={styles.timeRow}>
                <div className={styles.timeDrumCol}>
                  <label>Hour</label>
                  <DrumScroller id="wh-drum" className={styles.drumTime} selHeight="30px"
                    onUp={() => whDrumRef.current?.step(-1)} onDown={() => whDrumRef.current?.step(1)}/>
                </div>
                <div className={styles.timeSep}>:</div>
                <div className={styles.timeDrumCol}>
                  <label>Min</label>
                  <DrumScroller id="wm-drum" className={styles.drumTime} selHeight="30px"
                    onUp={() => wmDrumRef.current?.step(-1)} onDown={() => wmDrumRef.current?.step(1)}/>
                </div>
                <div className={styles.ampmToggle}>
                  {['AM','PM'].map(v => (
                    <button key={v}
                      className={`${styles.ampmBtn} ${wakeAmpm === v ? styles.ampmBtnActive : ''}`}
                      onClick={() => setWakeAmpm(v)}
                    >{v}</button>
                  ))}
                </div>
              </div>
            </div>
            {/* Sleep time */}
            <div className={styles.formField}>
              <label>Sleep Time</label>
              <div className={styles.timeRow}>
                <div className={styles.timeDrumCol}>
                  <label>Hour</label>
                  <DrumScroller id="sh-drum" className={styles.drumTime} selHeight="30px"
                    onUp={() => shDrumRef.current?.step(-1)} onDown={() => shDrumRef.current?.step(1)}/>
                </div>
                <div className={styles.timeSep}>:</div>
                <div className={styles.timeDrumCol}>
                  <label>Min</label>
                  <DrumScroller id="sm-drum" className={styles.drumTime} selHeight="30px"
                    onUp={() => smDrumRef.current?.step(-1)} onDown={() => smDrumRef.current?.step(1)}/>
                </div>
                <div className={styles.ampmToggle}>
                  {['AM','PM'].map(v => (
                    <button key={v}
                      className={`${styles.ampmBtn} ${sleepAmpm === v ? styles.ampmBtnActive : ''}`}
                      onClick={() => setSleepAmpm(v)}
                    >{v}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── SAVE ── */}
        <div className={`${styles.formCard} ${styles.saveCard} ${saveShow ? styles.formCardVisible : ''}`}>
          <button
            ref={saveBtnRef}
            className={`${styles.saveBtn} ${saveAnimating ? styles.saveBtnAnimating : ''}`}
            onClick={handleSave}
          >
            Save Profile
          </button>
          <button className={styles.resetBtn} onClick={handleReset}>Reset</button>
          <span className={`${styles.saveStatus} ${saveStatus ? styles.saveStatusShow : ''}`}>✓ Saved successfully</span>
        </div>

      </div>{/* /pageWrap */}
    </div>
  );
}
