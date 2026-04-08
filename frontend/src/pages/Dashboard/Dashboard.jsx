import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toggleTheme, toggleSound } from '@/store/slices/uiSlice';
import { setVesselCapacities } from '@/store/slices/waterSlice';
import {
  selectGlassVolume, selectJarVolume,
  selectSelectedGlassIdx, selectSelectedJarIdx,
  GLASSES as COLL_GLASSES, JARS as COLL_JARS,
} from '@/store/slices/collectionSlice';
import { getGlassPath, getJarPath, scaleVesselPath, fitPathToSourceBox, GLASS_PATHS, JAR_PATHS } from '@/utils/vessels.jsx';
import { logSip as logSipAPI, getTodayLogs, syncGuestSips as syncGuestSipsAPI } from '@/services/waterService';
import statsService from '@/services/statsService';
import styles from './Dashboard.module.css';
import Navbar from '@/components/layout/Navbar/Navbar';
import MenuDrawer from '@/components/layout/MenuDrawer/MenuDrawer';
import SEO from '@/components/SEO/SEO';

/* ─── Static constants ───────────────────────────────────────────────────── */
const NS = 'http://www.w3.org/2000/svg';
const ML_PER_TAP = 1;
/** Jar pour anim uses 60 float steps; sum can land just under jMax (e.g. 1999.999…), so treat as full */
const J_VOL_EPS = 0.02;
const HOLD_THRESHOLD = 180;
const HOLD_RATE = 1.8;
const BUBBLE_AREA_Y_START = 66;
const BUBBLE_PADDING = 10;
const SVG_W = 500, SVG_H = 500;
const WEEK_HISTORY_DEFAULT = [0, 0, 0, 0, 0, 0, 0];

function mondayISO(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  x.setDate(x.getDate() - (day === 0 ? 6 : day - 1));
  return x.toISOString().split('T')[0];
}

/** Index 0 = Monday … 6 = Sunday; must match GET /stats/weekly?start=mondayISO day order */
function todayIndexInWeekStartingMonday(mondayStr) {
  const todayStr = new Date().toISOString().split('T')[0];
  const start = new Date(`${mondayStr}T12:00:00`).getTime();
  const today = new Date(`${todayStr}T12:00:00`).getTime();
  let idx = Math.round((today - start) / 86400000);
  if (Number.isNaN(idx)) idx = 0;
  return Math.max(0, Math.min(6, idx));
}

/** `weekDayTotals` already includes today from the server; replace that slot with live `todayTotalMl`. */
function weekTotalMlReplacingToday(weekDayTotals, todayTotalMl) {
  const wh = weekDayTotals || [];
  const idx = todayIndexInWeekStartingMonday(mondayISO());
  const padded = wh.length >= 7 ? wh.slice(0, 7) : [...wh, ...Array(Math.max(0, 7 - wh.length)).fill(0)];
  const prevToday = padded[idx] || 0;
  return padded.reduce((a, b) => a + b, 0) - prevToday + todayTotalMl;
}

function weekGoalsHitWithLiveToday(weekDayTotals, todayTotalMl, goalMl) {
  const wh = weekDayTotals || [];
  const idx = todayIndexInWeekStartingMonday(mondayISO());
  const padded = wh.length >= 7 ? wh.slice(0, 7) : [...wh, ...Array(Math.max(0, 7 - wh.length)).fill(0)];
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const ml = i === idx ? todayTotalMl : (padded[i] || 0);
    if (ml >= goalMl) n++;
  }
  return n;
}

const BUBBLE_PALETTES = {
  light: [
    { fill: '#dbeeff', stroke: '#93c5fd', text: '#2563eb' },
    { fill: '#e0f2fe', stroke: '#7dd3fc', text: '#0369a1' },
    { fill: '#eff6ff', stroke: '#bfdbfe', text: '#3b82f6' },
    { fill: '#d1eaff', stroke: '#60a5fa', text: '#1d4ed8' },
    { fill: '#cfe8ff', stroke: '#74b9ff', text: '#2563eb' },
  ],
  dark: [
    { fill: '#1e3a5f', stroke: '#3b82f6', text: '#93c5fd' },
    { fill: '#172d4a', stroke: '#2563eb', text: '#7dd3fc' },
    { fill: '#1a3350', stroke: '#60a5fa', text: '#bfdbfe' },
    { fill: '#1c3560', stroke: '#74b9ff', text: '#60a5fa' },
    { fill: '#152840', stroke: '#3b82f6', text: '#93c5fd' },
  ],
};

/* ─── Vessel shape definitions ───────────────────────────────────────────── */
const VESSEL_BOTTOM = 440;

const G_X = 113, G_Y = 288, G_W = 94, G_H = 152;
const J_X = 275, J_Y = 212, J_W = 150, J_H = 228;

const GLASS_VESSELS = Array.from({ length: GLASS_PATHS.length }, (_, i) => {
  const rawPath = getGlassPath(i);
  const p = scaleVesselPath(fitPathToSourceBox(rawPath), G_X, G_Y, G_W, G_H);
  return { p, wx: G_X + 2, ww: G_W - 4, top: G_Y };
});

const JAR_VESSELS = Array.from({ length: JAR_PATHS.length }, (_, i) => {
  const rawPath = getJarPath(i);
  const p = scaleVesselPath(fitPathToSourceBox(rawPath), J_X, J_Y, J_W, J_H);
  return { p, wx: J_X + 2, ww: J_W - 4, top: J_Y };
});

function getGlassVessel(idx) { return GLASS_VESSELS[idx] ?? GLASS_VESSELS[0]; }
function getJarVessel(idx) { return JAR_VESSELS[idx] ?? JAR_VESSELS[0]; }

/* ─── Letter reveal animation ────────────────────────────────────────────── */
function letterReveal(el, startDelay, charGap, onDone) {
  if (!el) return;
  const nodes = Array.from(el.childNodes);
  el.innerHTML = '';
  let d = startDelay;
  nodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      node.textContent.split('').forEach(ch => {
        const s = document.createElement('span');
        s.style.cssText = `display:inline;opacity:0;transition:opacity 0.5s cubic-bezier(0.16,1,0.3,1) ${d}ms`;
        s.textContent = ch;
        el.appendChild(s);
        if (ch.trim()) d += charGap; else d += charGap * 0.4;
      });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = document.createElement(node.tagName);
      tag.className = node.className;
      node.textContent.split('').forEach(ch => {
        const s = document.createElement('span');
        s.style.cssText = `display:inline;opacity:0;transition:opacity 0.5s cubic-bezier(0.16,1,0.3,1) ${d}ms`;
        s.textContent = ch;
        tag.appendChild(s);
        if (ch.trim()) d += charGap; else d += charGap * 0.4;
      });
      el.appendChild(tag);
    }
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.querySelectorAll('span').forEach(s => { s.style.opacity = '1'; });
    });
  });
  if (onDone) setTimeout(onDone, d + 200);
}

/* ── Module-level sound-enabled flag (synced from Redux via ref in component) ── */
let _soundEnabled = localStorage.getItem('sipsip_sound') !== 'false';

const WATER_DROP_SOUND = new Audio('/waterdrop_audio.mp3');
WATER_DROP_SOUND.load();
function playWaterSound() {
  if (!_soundEnabled) return;
  WATER_DROP_SOUND.currentTime = 0;
  WATER_DROP_SOUND.play().catch(() => {});
}

const TRANSFER_SOUND = new Audio('/transfer_audio.mp3');
TRANSFER_SOUND.load();
function playTransferSound() {
  if (!_soundEnabled) return;
  TRANSFER_SOUND.currentTime = 0;
  TRANSFER_SOUND.play().catch(() => {});
}

// ── Shared Audio Context for Seamless Liquid Cross-fade Loop ──
let audioCtx = null;
let fillBuffer = null;
let fillGain = null;
let currentSource = null;
let loopTimer = null;
let isFillingNow = false;

async function initFillAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  fillGain = audioCtx.createGain();
  fillGain.connect(audioCtx.destination);
  try {
    const res = await fetch('/filling_audio.mp3');
    const arrayBuffer = await res.arrayBuffer();
    fillBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } catch (e) {
    console.error("Fill audio load failed", e);
  }
}

function startFillSound() {
  if (!_soundEnabled) return;
  if (!fillBuffer || !audioCtx) { initFillAudio(); return; }
  if (isFillingNow) return;
  isFillingNow = true;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  fillGain.gain.cancelScheduledValues(audioCtx.currentTime);
  fillGain.gain.setValueAtTime(0, audioCtx.currentTime);
  fillGain.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 0.1);

  function playNextSegment() {
    if (!isFillingNow) return;
    const now = audioCtx.currentTime;
    const dur = fillBuffer.duration;
    const fade = 0.12; // 120ms cross-fade overlap
    
    const src = audioCtx.createBufferSource();
    src.buffer = fillBuffer;
    src.connect(fillGain);
    
    // Cross-fade internal loop points if we can overlap:
    // We start this one slightly early (dur - fade)
    src.start(now);
    currentSource = src;
    
    // Schedule next segment start
    loopTimer = setTimeout(playNextSegment, (dur - fade) * 1000);
  }
  
  playNextSegment();
}

function stopFillSound() {
  isFillingNow = false;
  if (loopTimer) clearTimeout(loopTimer);
  if (!fillGain || !audioCtx) return;
  
  const now = audioCtx.currentTime;
  fillGain.gain.cancelScheduledValues(now);
  fillGain.gain.setValueAtTime(fillGain.gain.value, now);
  fillGain.gain.linearRampToValueAtTime(0, now + 0.25);
  
  setTimeout(() => {
    if (currentSource) try { currentSource.stop(); } catch(e){}
    currentSource = null;
  }, 300);
}

initFillAudio();

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isDarkVal = useSelector(s => s.ui?.theme) === 'dark';
  const isDarkRef = useRef(isDarkVal);
  isDarkRef.current = isDarkVal;
  const soundEnabled = useSelector(s => s.ui?.soundEnabled ?? true);
  // Keep module-level flag in sync so audio functions outside React can read it
  _soundEnabled = soundEnabled;
  const [menuOpen, setMenuOpen] = useState(false);
  const authToken = useSelector(s => s.auth?.token);
  const authTokenRef = useRef(authToken);
  authTokenRef.current = authToken;
  const [signInNudge, setSignInNudge] = useState(false);
  const nudgeShownRef = useRef(false);
  const weekHistoryRef = useRef(WEEK_HISTORY_DEFAULT);
  const weekGoalsHitRef = useRef(0);
  const weekAvgRef = useRef(0);

  /* ── Vessel volumes + indices from Redux ─────────────────────────────── */
  const glassVolume = useSelector(selectGlassVolume);
  const jarVolume = useSelector(selectJarVolume);
  const glassIdx = useSelector(selectSelectedGlassIdx);
  const jarIdx = useSelector(selectSelectedJarIdx);

  /* ── Live refs so animation loops always read current values ─────────── */
  const gMaxRef = useRef(glassVolume);
  const jMaxRef = useRef(jarVolume);
  const gVesselRef = useRef(getGlassVessel(glassIdx));
  const jVesselRef = useRef(getJarVessel(jarIdx));
  const glassIdxRef = useRef(glassIdx);
  const jarIdxRef = useRef(jarIdx);

  /* keep idx refs in sync */
  useEffect(() => { glassIdxRef.current = glassIdx; }, [glassIdx]);
  useEffect(() => { jarIdxRef.current = jarIdx; }, [jarIdx]);

  /* ── Keep volume refs in sync with Redux ─────────────────────────────── */
  useEffect(() => {
    gMaxRef.current = glassVolume;
    jMaxRef.current = jarVolume;
    dispatch(setVesselCapacities({ gMax: glassVolume, jMax: jarVolume }));
  }, [glassVolume, jarVolume, dispatch]);

  /* ── Sync vessel geometry refs + labels whenever Redux vessel selection changes ── */
  useEffect(() => {
    const mainSvg = mainSvgRef.current;
    if (!mainSvg) return;

    const gv = getGlassVessel(glassIdx);
    const jv = getJarVessel(jarIdx);

    gVesselRef.current = gv;
    jVesselRef.current = jv;
    gMaxRef.current = glassVolume;
    jMaxRef.current = jarVolume;

    const gWaterGroup = mainSvg.querySelector('#glassWaterGroup');
    const jWaterGroup = mainSvg.querySelector('#jarWaterGroup');
    const gOutline = mainSvg.querySelector('#glassOutline');
    const gHitArea = mainSvg.querySelector('#glassHitArea');
    const jOutline = mainSvg.querySelector('#jarOutline');
    if (gWaterGroup) gWaterGroup.setAttribute('clip-path', `url(#glassClip${glassIdx})`);
    if (jWaterGroup) jWaterGroup.setAttribute('clip-path', `url(#jarClip${jarIdx})`);
    if (gHitArea) gHitArea.setAttribute('d', gv.p);
    if (gOutline) gOutline.setAttribute('d', gv.p);
    if (jOutline) jOutline.setAttribute('d', jv.p);

    const gWater = mainSvg.querySelector('#gWater');
    const jWater = mainSvg.querySelector('#jWater');
    if (gWater) { gWater.setAttribute('x', gv.wx); gWater.setAttribute('width', gv.ww); }
    if (jWater) { jWater.setAttribute('x', jv.wx); jWater.setAttribute('width', jv.ww); }

    if (gVol.current > glassVolume) gVol.current = glassVolume;
    // Keep visible jar volume consistent with the true daily total.
    const totalMl = totalPoured.current;
    const EPS = 0.0001;
    jarFillCount.current = Math.floor((totalMl + EPS) / jarVolume);
    jVol.current = totalMl - jarFillCount.current * jarVolume;
    if (jVol.current < EPS) jVol.current = 0;
    displayJ.current = jVol.current;
    if (jarFillCountTxtRef.current) {
      jarFillCountTxtRef.current.textContent = `x${jarFillCount.current}`;
      const badge = mainSvg.querySelector('#jarFillCountBadge');
      if (badge) badge.style.opacity = jarFillCount.current > 0 ? '1' : '0';
    }

    goalShown.current = false;

    const jTxt = mainSvg.querySelector('#jTxt');
    const gTxt = mainSvg.querySelector('#gTxt');
    if (gTxt) gTxt.textContent = `${Math.floor(gVol.current)}ml`;
    if (jTxt) {
      // Always display the cumulative daily total, not the jar remainder.
      displayTotal.current = totalPoured.current;  // snap display to match
      jTxt.textContent = `${Math.round(totalPoured.current)} / ${jarVolume}ml`;
    }

    const sr = statsBarRef.current;
    if (sr) {
      const goalEl = sr.querySelector('#drRingGoal');
      if (goalEl) goalEl.textContent = `Goal: ${jarVolume} ml`;
      const subEl = sr.querySelector('#statGoalSub');
      if (subEl) subEl.textContent = `${Math.round(totalPoured.current)} / ${jarVolume}ml`;
      const goalPct = Math.round((totalPoured.current / jarVolume) * 100);
      const pctEl = sr.querySelector('#statGoalPct');
      if (pctEl) pctEl.textContent = goalPct + '%';
      const circ = 2 * Math.PI * 55;
      const arc = sr.querySelector('#drRingArc');
      if (arc) arc.style.strokeDashoffset = circ - (goalPct / 100) * circ;
      const rPct = sr.querySelector('#drRingPct');
      if (rPct) rPct.textContent = goalPct + '%';
    }
  }, [glassIdx, jarIdx, glassVolume, jarVolume]);

  /* ── Reveal flags ── */
  const [card1Show, setCard1Show] = useState(false);
  const [card2Show, setCard2Show] = useState(false);
  const [fillShow, setFillShow] = useState(false);
  const [statsShow, setStatsShow] = useState(false);

  /* ── DOM refs ── */
  const mainSvgRef = useRef(null);
  const actSvgRef = useRef(null);
  const statsBarRef = useRef(null);
  const fillBtnRef = useRef(null);
  const fillBtnWrapRef = useRef(null);
  const tapHintRef = useRef(null);
  const goalOverlayRef = useRef(null);
  const goalConfRef = useRef(null);
  const card1Ref = useRef(null);
  const card2Ref = useRef(null);
  const hydraParaRef = useRef(null);
  const paraEyeRef = useRef(null);
  const paraTextRef = useRef(null);
  const paraLineRef = useRef(null);
  const actSideRef = useRef(null);
  const actEyeRef = useRef(null);
  const actTextRef = useRef(null);
  const actLineRef = useRef(null);

  /* ── Mutable animation state ── */
  const gVol = useRef(0);
  const jVol = useRef(0);
  const displayG = useRef(0);
  const displayJ = useRef(0);
  const wavePhase = useRef(0);
  const sips = useRef([]);
  const totalPoured = useRef(0);
  const displayTotal = useRef(0);  // smoothly animated mirror of totalPoured
  const sipCount = useRef(0);

  const goalShown = useRef(false);
  // Counts how many times the jar reached `jMaxRef.current` today.
  const jarFillCount = useRef(0);
  const jarFillCountTxtRef = useRef(null);
  const isPouringLock = useRef(false);
  const shaking = useRef(false);
  const wasFilling = useRef(false);
  const fillRaf = useRef(null);
  const holdTimer = useRef(null);
  const tapHintTimer = useRef(null);
  const tapHintShowing = useRef(false);
  const activityReplayTimers = useRef([]);
  const startFillRef = useRef(null);
  const stopFillRef = useRef(null);
  const pendingFillTimers = useRef([]);

  // Map SVG viewBox (0..500) -> pixels inside the appCard.
  const svgMetricsRef = useRef({ originX: 0, originY: 0, scaleX: 1, scaleY: 1 });

  // Keep Fill button pinned to the glass rim (where the water top sits when full).
  function positionFillBtnToGlassWater() {
    const wrap = fillBtnWrapRef.current;
    const gv = gVesselRef.current;
    const gMax = gMaxRef.current;
    if (!wrap || !gv || !gMax) return;

    const parent = wrap.parentElement;
    const svg = mainSvgRef.current;
    if (!parent || !svg) return;

    // Pixel-accurate alignment (fixes small left/right drift on mobile/responsive sizes).
    const gWaterEl = svg.querySelector('#gWater');
    if (gWaterEl) {
      const r = gWaterEl.getBoundingClientRect();
      const pr = parent.getBoundingClientRect();
      wrap.style.left = `${(r.left - pr.left) + (r.width / 2)}px`; // center over water
    } else {
      // Fallback: viewBox math.
      const { originX, scaleX } = svgMetricsRef.current;
      const centerXInViewBox = gv.wx + gv.ww / 2;
      wrap.style.left = `${originX + centerXInViewBox * scaleX}px`;
    }
    // User request: make the Fill button rim visually touch the parent card's
    // top border, so nudge it up by 1px to compensate for border/rounding.
    wrap.style.top = '-1px';
  }

  useEffect(() => {
    const recomputeMetrics = () => {
      const wrap = fillBtnWrapRef.current;
      const svg = mainSvgRef.current;
      if (!wrap || !svg) return;

      const parent = wrap.parentElement;
      if (!parent) return;

      const parentRect = parent.getBoundingClientRect();
      const svgRect = svg.getBoundingClientRect();

      svgMetricsRef.current = {
        originX: svgRect.left - parentRect.left,
        originY: svgRect.top - parentRect.top,
        scaleX: svgRect.width / 500,
        scaleY: svgRect.height / 500,
      };
    };

    const repin = () => {
      recomputeMetrics();
      positionFillBtnToGlassWater();
    };

    // Initial pin (may run during reveal transitions; observers below keep it accurate).
    repin();

    // Keep pin accurate across responsive breakpoints + card/SVG resize during transitions.
    window.addEventListener('resize', repin);

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => repin());
      const wrap = fillBtnWrapRef.current;
      const parent = wrap?.parentElement || null;
      const svg = mainSvgRef.current;
      if (parent) ro.observe(parent);
      if (svg) ro.observe(svg);
    }

    // One extra repin after the reveal transition settles (covers font/svg paint timing).
    const settleId = setTimeout(repin, 850);

    return () => {
      window.removeEventListener('resize', repin);
      if (ro) ro.disconnect();
      clearTimeout(settleId);
    };
  }, [glassIdx, card1Show, fillShow]);

  useEffect(() => {
    const mainSvg = mainSvgRef.current;
    const actSvg = actSvgRef.current;
    if (!mainSvg || !actSvg) return;

    const gWater = mainSvg.querySelector('#gWater');
    const jWater = mainSvg.querySelector('#jWater');
    const gWaveEl = mainSvg.querySelector('#gWave');
    const gWaveFr = mainSvg.querySelector('#gWaveFront');
    const jWaveEl = mainSvg.querySelector('#jWave');
    const jWaveFr = mainSvg.querySelector('#jWaveFront');
    const gTxt = mainSvg.querySelector('#gTxt');
    const jTxt = mainSvg.querySelector('#jTxt');
    const pGroup = mainSvg.querySelector('#pGroup');
    const glassGrp = mainSvg.querySelector('#glassGroup');
    const tapHint = tapHintRef.current;

    const sipCountEl = actSvg.querySelector('#sipCount');
    const emptyState = actSvg.querySelector('#emptyState');
    const bubblesGrp = actSvg.querySelector('#bubblesGroup');

    // Card + fill reveal timings (nav animation now handled by Navbar component)
    setTimeout(() => setCard1Show(true), 1600);
    setTimeout(() => setFillShow(true), 1950);
    setTimeout(() => setCard2Show(true), 2400);

    /* ── Load today's logs + weekly stats from backend (skip for guests) ── */
    if (authTokenRef.current) {
    (async () => {
      try {
        let todayData = await getTodayLogs();

        // Merge guest (offline) sips into the account after sign-in — server was empty.
        const todayISO = new Date().toISOString().split('T')[0];
        let guest = null;
        try {
          const rawGuest = localStorage.getItem('sipsip_guest');
          if (rawGuest) guest = JSON.parse(rawGuest);
        } catch { /* ignore invalid JSON */ }

        const guestForToday = guest
          && guest.date === todayISO
          && ((guest.totalPoured || 0) > 0 || (Array.isArray(guest.logs) && guest.logs.length > 0));

        const serverEmpty = todayData?.success
          && (todayData.summary?.totalMl || 0) === 0
          && (todayData.summary?.sipCount || 0) === 0
          && (!todayData.logs || todayData.logs.length === 0);

        if (guestForToday && serverEmpty) {
          let amounts = [];
          if (Array.isArray(guest.logs) && guest.logs.length > 0) {
            amounts = guest.logs
              .map((log) => Math.max(1, Math.round(Number(log.vol ?? log.amount ?? 0))))
              .filter((a) => Number.isFinite(a) && a >= 1);
          }
          if (amounts.length === 0 && (guest.totalPoured || 0) > 0) {
            amounts = [Math.round(guest.totalPoured)];
          }
          if (amounts.length > 0) {
            const gIdx = glassIdxRef.current;
            const jIdx = jarIdxRef.current;
            const gDef = COLL_GLASSES[gIdx] || COLL_GLASSES[0];
            const jDef = COLL_JARS[jIdx] || COLL_JARS[0];
            const glassSnap = { id: gDef.id, name: gDef.label, volumeMl: gMaxRef.current };
            const jarSnap = { id: jDef.id, name: jDef.label, volumeMl: jMaxRef.current };
            try {
              const syncRes = await syncGuestSipsAPI(amounts, glassSnap, jarSnap);
              if (syncRes?.merged) {
                localStorage.removeItem('sipsip_guest');
              }
              // Refetch after merge or skip (skip = concurrent import or server already filled).
              if (syncRes?.merged || syncRes?.skipped) {
                todayData = await getTodayLogs();
                if (
                  syncRes?.skipped
                  && todayData?.success
                  && (((todayData.summary?.sipCount || 0) > 0) || (todayData.logs && todayData.logs.length > 0))
                ) {
                  localStorage.removeItem('sipsip_guest');
                }
              }
            } catch { /* leave sipsip_guest so user can retry */ }
          }
        }

        if (todayData.success && todayData.summary) {
          totalPoured.current = todayData.summary.totalMl || 0;
          sipCount.current = todayData.summary.sipCount || 0;
          const J_MAX = jMaxRef.current;
          // Keep the visible jar volume consistent: show only the remainder,
          // while `totalPoured.current` keeps the true daily total.
          const totalMl = todayData.summary.totalMl || 0;
          const EPS = 0.0001;
          jarFillCount.current = Math.floor((totalMl + EPS) / J_MAX);
          jVol.current = totalMl - jarFillCount.current * J_MAX;
          if (jVol.current < EPS) jVol.current = 0;
          displayJ.current = jVol.current;
          displayTotal.current = totalPoured.current;  // snap to restored total
          if (jarFillCountTxtRef.current) {
            jarFillCountTxtRef.current.textContent = `x${jarFillCount.current}`;
            const badge = mainSvgRef.current?.querySelector('#jarFillCountBadge');
            if (badge) badge.style.opacity = jarFillCount.current > 0 ? '1' : '0';
          }
          goalShown.current = false;
          updateUI();
          replaySipBubbles(todayData.logs);
          // update stats bar with today's data
          const goalPct = Math.round((totalPoured.current / J_MAX) * 100);
          const $ = id => statsBarRef.current?.querySelector(`#${id}`);
          const pctEl = $('statGoalPct'); if (pctEl) pctEl.textContent = goalPct + '%';
          const subEl = $('statGoalSub'); if (subEl) subEl.textContent = Math.round(totalPoured.current) + ' / ' + J_MAX + 'ml';
          const circ = 2 * Math.PI * 55;
          const arc = $('drRingArc'); if (arc) arc.style.strokeDashoffset = circ - (goalPct / 100) * circ;
          const rPct = $('drRingPct'); if (rPct) rPct.textContent = goalPct + '%';
          const rMl = $('drRingMl'); if (rMl) rMl.textContent = Math.round(totalPoured.current) + ' ml';
        }
      } catch { }
      try {
        const weeklyRes = await statsService.getWeekly(mondayISO());
        if (weeklyRes.success && weeklyRes.days) {
          weekHistoryRef.current = weeklyRes.days.map(d => d.totalMl || 0);
          weekGoalsHitRef.current = weeklyRes.goalsHit || 0;
          weekAvgRef.current = weeklyRes.weeklyAvg || 0;
          // Update stats bar with weekly data
          const J_MAX = jMaxRef.current;
          const fmt = n => n >= 1000 ? (n / 1000).toFixed(1) + 'L' : n + 'ml';
          const $ = id => statsBarRef.current?.querySelector(`#${id}`);
          const wkEl = $('statWeekly'); if (wkEl) wkEl.textContent = fmt(weeklyRes.weeklyAvg || 0);
          const wkSub = $('statWeeklySub'); if (wkSub) wkSub.textContent = fmt(weeklyRes.weeklyAvg || 0) + ' / day';
          const grEl = $('statGoalsReached'); if (grEl) grEl.textContent = weeklyRes.goalsHit || 0;
          const grSub = $('statGoalsSub'); if (grSub) grSub.textContent = (weeklyRes.goalsHit || 0) + ' of 7 days';
        }
      } catch { }
      try {
        const ov = await statsService.getOverview();
        if (ov) {
          const $ = id => statsBarRef.current?.querySelector(`#${id}`);
          const frEl = $('statFreq'); if (frEl) frEl.textContent = ov.avgFrequency ?? 0;
        }
      } catch { }
    })();
    } else {
      try {
        const str = localStorage.getItem('sipsip_guest');
        if (str) {
          const dt = JSON.parse(str);
          const tDay = new Date().toISOString().split('T')[0];
          if (dt.date === tDay) {
            totalPoured.current = dt.totalPoured || 0;
            sipCount.current = dt.sipCount || 0;
            const J_MAX = jMaxRef.current;
            const EPS = 0.0001;
            jarFillCount.current = Math.floor((totalPoured.current + EPS) / J_MAX);
            jVol.current = totalPoured.current - jarFillCount.current * J_MAX;
            if (jVol.current < EPS) jVol.current = 0;
            displayJ.current = jVol.current;
            displayTotal.current = totalPoured.current;
            if (jarFillCountTxtRef.current) {
              jarFillCountTxtRef.current.textContent = `x${jarFillCount.current}`;
              const badge = mainSvgRef.current?.querySelector('#jarFillCountBadge');
              if (badge) badge.style.opacity = jarFillCount.current > 0 ? '1' : '0';
            }
            goalShown.current = false;
            updateUI();
            
            replaySipBubbles(dt.logs);

            const goalPct = Math.round((totalPoured.current / J_MAX) * 100);
            const $ = id => statsBarRef.current?.querySelector(`#${id}`);
            const pctEl = $('statGoalPct'); if (pctEl) pctEl.textContent = goalPct + '%';
            const subEl = $('statGoalSub'); if (subEl) subEl.textContent = Math.round(totalPoured.current) + ' / ' + J_MAX + 'ml';
            const circ = 2 * Math.PI * 55;
            const arc = $('drRingArc'); if (arc) arc.style.strokeDashoffset = circ - (goalPct / 100) * circ;
            const rPct = $('drRingPct'); if (rPct) rPct.textContent = goalPct + '%';
            const rMl = $('drRingMl'); if (rMl) rMl.textContent = Math.round(totalPoured.current) + ' ml';

            const wh = weekHistoryRef.current || [];
            const weekTotal = weekTotalMlReplacingToday(wh, totalPoured.current);
            const weekAvg = Math.round(weekTotal / 7);
            const fmt = n => n >= 1000 ? (n / 1000).toFixed(1) + 'L' : n + 'ml';
            const wkEl = $('statWeekly'); if (wkEl) wkEl.textContent = fmt(weekAvg);
            const wkSub = $('statWeeklySub'); if (wkSub) wkSub.textContent = fmt(weekAvg) + ' / day';
            const histGoals = weekGoalsHitWithLiveToday(wh, totalPoured.current, J_MAX);
            const grEl = $('statGoalsReached'); if (grEl) grEl.textContent = histGoals;
            const grSub = $('statGoalsSub'); if (grSub) grSub.textContent = histGoals + ' of 7 days';
            const frEl = $('statFreq'); if (frEl) frEl.textContent = sipCount.current;
          }
        }
      } catch (e) {}
    } /* end token guard */

    setTimeout(() => {
      if (hydraParaRef.current) hydraParaRef.current.style.visibility = 'visible';
      if (paraEyeRef.current) paraEyeRef.current.style.opacity = '0.8';
      letterReveal(paraTextRef.current, 80, 22, () => {
        if (paraLineRef.current) {
          paraLineRef.current.style.opacity = '0.5';
          paraLineRef.current.style.transform = 'scaleX(1)';
        }
      });
    }, 2750);

    setTimeout(() => {
      if (actSideRef.current) actSideRef.current.style.visibility = 'visible';
      if (actEyeRef.current) actEyeRef.current.style.opacity = '0.7';
      letterReveal(actTextRef.current, 80, 20, () => {
        if (actLineRef.current) {
          actLineRef.current.style.opacity = '0.45';
          actLineRef.current.style.transform = 'scaleX(1)';
        }
      });
    }, 3200);

    let statsTriggered = false;
    const statsObs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !statsTriggered) {
        statsTriggered = true;
        statsObs.disconnect();
        setStatsShow(true);
      }
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    if (statsBarRef.current) statsObs.observe(statsBarRef.current);

    setTimeout(() => {
      if (tapHint) {
        tapHint.innerHTML = 'Press &amp; hold to fill 💧';
        tapHint.classList.add(styles.tapHintShow);
        setTimeout(() => {
          tapHint.classList.remove(styles.tapHintShow);
          setTimeout(() => { if (tapHint) tapHint.textContent = 'Tap glass to pour 💧'; }, 400);
        }, 2800);
      }
    }, 900);

    /* ── Core functions ── */
    function showTapHint(msg) {
      if (tapHintShowing.current) return;
      tapHintShowing.current = true;
      if (tapHintTimer.current) clearTimeout(tapHintTimer.current);
      if (tapHint) {
        if (msg) tapHint.textContent = msg;
        tapHint.classList.add(styles.tapHintShow);
        tapHintTimer.current = setTimeout(() => {
          tapHint.classList.remove(styles.tapHintShow);
          tapHintShowing.current = false;
        }, 2200);
      }
    }

    function triggerGlassShake() {
      if (shaking.current) return;
      shaking.current = true;
      if (glassGrp) {
        glassGrp.style.cssText = 'animation:glassShake 0.5s cubic-bezier(0.36,0.07,0.19,0.97) both;transform-origin:160px 440px;cursor:pointer;';
        setTimeout(() => { glassGrp.style.cssText = 'cursor:pointer;'; shaking.current = false; }, 520);
      }
      showTapHint('Glass is full! 💧');
    }

    function triggerGoalReached() {
      if (goalShown.current) return;
      goalShown.current = true;

      if (!authTokenRef.current) {
        setSignInNudge(true);
      }

      goalOverlayRef.current?.classList.add(styles.goalShow);
      const c = goalConfRef.current;
      if (c) {
        c.innerHTML = '';
        const cols = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#1d4ed8'];
        for (let i = 0; i < 60; i++) {
          const d = document.createElement('div');
          d.className = styles.cDot;
          const sz = 6 + Math.random() * 10;
          d.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random() * 100}vw;top:-20px;background:${cols[Math.floor(Math.random() * cols.length)]};animation-duration:${2 + Math.random() * 2}s;animation-delay:${Math.random() * 1.5}s;`;
          c.appendChild(d);
        }
      }
    }

    function spawnParticle(x, y, vx, vy, r, type) {
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r);
      c.setAttribute('fill', type === 'celebrate'
        ? ['#74b9ff', '#a29bfe', '#fd79a8', '#55efc4'][Math.floor(Math.random() * 4)]
        : '#74b9ff');
      pGroup.appendChild(c);
      let px = x, py = y, pvx = vx, pvy = vy; const gravity = 0.32; let reflected = false;
      function step() {
        px += pvx; py += pvy; pvy += gravity;
        if (type === 'toGlass') {
          const gv = gVesselRef.current;
          const waterPct = Math.min(Math.max(5, gVol.current) / gMaxRef.current, 1);
          const sY = gv.top + (1 - waterPct) * (VESSEL_BOTTOM - gv.top);
          if (py >= sY) { if (!reflected && Math.random() > 0.4) { pvy *= -0.3; pvx = (Math.random() - 0.5) * 3; reflected = true; py = sY - 1; } else { c.remove(); return; } }
        } else if (type === 'celebrate' || type === 'overflow') {
          if (py > 480 || px < 0 || px > 500) { c.remove(); return; }
        } else {
          const jv = jVesselRef.current;
          const withinJarMouthX = px >= jv.wx && px <= (jv.wx + jv.ww);
          if ((withinJarMouthX && py >= jv.top) || py > 460 || px < 0 || px > 500) {
            c.remove();
            return;
          }
        }
        c.setAttribute('cx', px); c.setAttribute('cy', py);
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function scheduleGlassFill(addMl, delayMs = 170) {
      if (addMl <= 0) return;
      const tid = setTimeout(() => {
        const cap = gMaxRef.current;
        gVol.current = Math.min(cap, gVol.current + addMl);
        updateUI();
        pendingFillTimers.current = pendingFillTimers.current.filter(id => id !== tid);
      }, delayMs);
      pendingFillTimers.current.push(tid);
    }

    function updateUI() {
      const G_MAX = gMaxRef.current;
      const J_MAX = jMaxRef.current;
      const gv = gVesselRef.current;
      const jv = jVesselRef.current;
      const gh = (gVol.current / G_MAX) * (VESSEL_BOTTOM - gv.top);
      gWater.setAttribute('height', gh);
      gWater.setAttribute('y', VESSEL_BOTTOM - gh);
      // Keep Fill button pinned to the glass rim.
      positionFillBtnToGlassWater();
      const jFill = Math.min(jVol.current, J_MAX);
      const jh = (jFill / J_MAX) * (VESSEL_BOTTOM - jv.top);
      jWater.setAttribute('height', jh);
      jWater.setAttribute('y', VESSEL_BOTTOM - jh);
      if (jVol.current + J_VOL_EPS >= J_MAX) triggerGoalReached();
    }

    function spawnOverflowSplash() {
      const jv = jVesselRef.current;
      const cx = jv.wx + jv.ww / 2;
      for (let i = 0; i < 8; i++) {
        setTimeout(() => {
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
          const speed = 2.5 + Math.random() * 4;
          spawnParticle(cx + (Math.random() - 0.5) * 50, jv.top, Math.cos(angle) * speed, Math.sin(angle) * speed, 5 + Math.random() * 4, 'overflow');
        }, i * 30);
      }
    }

    function volToRadius(vol) {
      const G_MAX = gMaxRef.current;
      const MIN_R = 22, MAX_R = 56, c = Math.min(Math.max(vol, 10), G_MAX);
      return MIN_R + ((c - 10) / (G_MAX - 10)) * (MAX_R - MIN_R);
    }

    function clearActivityReplayTimers() {
      activityReplayTimers.current.forEach(clearTimeout);
      activityReplayTimers.current = [];
    }

    function placeBubble(r) {
      const mg = 14, yMin = BUBBLE_AREA_Y_START + r + mg, yMax = SVG_H - r - mg, xMin = mg + r, xMax = SVG_W - mg - r;
      for (let i = 0; i < 300; i++) {
        const x = xMin + Math.random() * (xMax - xMin), y = yMin + Math.random() * (yMax - yMin);
        let ok = true;
        for (const s of sips.current) { if (Math.hypot(x - s.x, y - s.y) < r + s.r + BUBBLE_PADDING) { ok = false; break; } }
        if (ok) return { x, y };
      }
      return null;
    }

    function getTime(value = new Date()) {
      const n = value instanceof Date ? new Date(value) : new Date(value);
      if (Number.isNaN(n.getTime())) return '';
      let h = n.getHours();
      const m = String(n.getMinutes()).padStart(2, '0');
      const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12;
      return `${h}:${m} ${ap}`;
    }

    function getSipBubbleTime(sip = {}) {
      if (typeof sip.timestamp === 'string' && sip.timestamp.trim()) return sip.timestamp.trim();
      if (typeof sip.time === 'string' && sip.time.trim()) return sip.time.trim();
      const fallbackTime = sip.at ? getTime(sip.at) : '';
      return fallbackTime || getTime();
    }

    function getBubblePalette(savedPalIdx) {
      const set = isDarkRef.current ? BUBBLE_PALETTES.dark : BUBBLE_PALETTES.light;
      if (Number.isInteger(savedPalIdx) && savedPalIdx >= 0 && savedPalIdx < set.length) {
        return { pal: set[savedPalIdx], palIdx: savedPalIdx };
      }
      const palIdx = Math.floor(Math.random() * set.length);
      return { pal: set[palIdx], palIdx };
    }

    function replaySipBubbles(logs = []) {
      if (!Array.isArray(logs) || logs.length === 0) return;

      const validLogs = logs
        .map((log) => {
          const vol = Number(log?.vol ?? log?.amount ?? 0);
          if (!Number.isFinite(vol) || vol <= 0) return null;
          return { ...log, _bubbleVol: vol };
        })
        .filter(Boolean);

      if (validLogs.length === 0) return;

      if (emptyState) emptyState.setAttribute('display', 'none');
      clearActivityReplayTimers();
      sips.current = [];
      if (bubblesGrp) bubblesGrp.innerHTML = '';

      validLogs.forEach((log, i) => {
        const tid = setTimeout(() => addSipBubble(log._bubbleVol, log), 50 * i);
        activityReplayTimers.current.push(tid);
      });

      if (sipCountEl) sipCountEl.textContent = `${validLogs.length} Sip${validLogs.length !== 1 ? 's' : ''}`;
    }

    function addSipBubble(vol, sipMeta = {}) {
      const r = volToRadius(vol);
      const hasStoredPosition = Number.isFinite(sipMeta.x) && Number.isFinite(sipMeta.y);
      const pos = hasStoredPosition ? { x: sipMeta.x, y: sipMeta.y } : placeBubble(r);
      if (!pos) return;
      const timeStr = getSipBubbleTime(sipMeta);
      const { pal, palIdx } = getBubblePalette(sipMeta.palIdx);
      sips.current.push({ vol, time: timeStr, timestamp: timeStr, r, x: pos.x, y: pos.y, palIdx });
      if (sips.current.length === 1) emptyState.setAttribute('display', 'none');
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('class', 'sip-bubble');
      g.setAttribute('style', 'opacity:0');
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('cx', pos.x); circle.setAttribute('cy', pos.y); circle.setAttribute('r', r);
      circle.setAttribute('fill', pal.fill); circle.setAttribute('stroke', pal.stroke);
      circle.setAttribute('stroke-width', '1.5'); circle.setAttribute('filter', 'url(#bubbleShadow)');
      g.appendChild(circle);
      const volText = document.createElementNS(NS, 'text');
      volText.setAttribute('x', pos.x); volText.setAttribute('y', pos.y + 5);
      volText.setAttribute('text-anchor', 'middle');
      volText.setAttribute('font-family', 'DM Sans,sans-serif');
      volText.setAttribute('font-size', Math.max(12, r * 0.42));
      volText.setAttribute('font-weight', '600');
      volText.setAttribute('fill', pal.text);
      volText.setAttribute('data-role', 'vol');
      volText.setAttribute('pointer-events', 'none');
      volText.textContent = `${vol}ml`;
      g.appendChild(volText);
      const angle = (Math.random() * 0.8 + 0.1) * Math.PI;
      const dist = r + 18;
      const tx = pos.x + Math.cos(angle) * dist, ty = pos.y + Math.sin(angle) * dist;
      const timeText = document.createElementNS(NS, 'text');
      timeText.setAttribute('x', tx); timeText.setAttribute('y', ty + 4);
      timeText.setAttribute('text-anchor', 'middle');
      timeText.setAttribute('font-family', 'DM Sans,sans-serif');
      timeText.setAttribute('font-size', '13'); timeText.setAttribute('font-weight', '500');
      timeText.setAttribute('fill', isDarkRef.current ? '#4a5a7a' : '#999');
      timeText.setAttribute('data-role', 'time');
      timeText.setAttribute('pointer-events', 'none');
      timeText.textContent = timeStr;
      g.appendChild(timeText);
      bubblesGrp.appendChild(g);
      let sc = 0;
      function popIn() {
        sc += 0.07;
        if (sc >= 1) { sc = 1; g.setAttribute('style', 'opacity:1'); return; }
        g.setAttribute('style', `opacity:${sc};transform-origin:${pos.x}px ${pos.y}px;transform:scale(${sc})`);
        requestAnimationFrame(popIn);
      }
      requestAnimationFrame(popIn);
      sipCountEl.textContent = `${sips.current.length} Sip${sips.current.length !== 1 ? 's' : ''}`;
    }

    function updateStats(ml) {
      const J_MAX = jMaxRef.current;
      totalPoured.current += ml;
      sipCount.current++;
      const goalPct = Math.round((totalPoured.current / J_MAX) * 100);
      const $ = id => statsBarRef.current?.querySelector(`#${id}`);
      const pctEl = $('statGoalPct'); if (pctEl) pctEl.textContent = goalPct + '%';
      const subEl = $('statGoalSub'); if (subEl) subEl.textContent = Math.round(totalPoured.current) + ' / ' + J_MAX + 'ml';
      const circ = 2 * Math.PI * 55, offset = circ - (goalPct / 100) * circ;
      const arc = $('drRingArc'); if (arc) arc.style.strokeDashoffset = offset;
      const rPct = $('drRingPct'); if (rPct) rPct.textContent = goalPct + '%';
      const rMl = $('drRingMl'); if (rMl) rMl.textContent = Math.round(totalPoured.current) + ' ml';
      const wh = weekHistoryRef.current;
      const weekTotal = weekTotalMlReplacingToday(wh, totalPoured.current);
      const weekAvg = Math.round(weekTotal / 7);
      const fmt = n => n >= 1000 ? (n / 1000).toFixed(1) + 'L' : n + 'ml';
      const wkEl = $('statWeekly'); if (wkEl) wkEl.textContent = fmt(weekAvg);
      const wkSub = $('statWeeklySub'); if (wkSub) wkSub.textContent = fmt(weekAvg) + ' / day';
      const histGoals = weekGoalsHitWithLiveToday(wh, totalPoured.current, J_MAX);
      const grEl = $('statGoalsReached'); if (grEl) grEl.textContent = histGoals;
      const grSub = $('statGoalsSub'); if (grSub) grSub.textContent = histGoals + ' of 7 days';
      const frEl = $('statFreq'); if (frEl) frEl.textContent = sipCount.current;
    }

    function doPourToJar(sipVol, overflowMode) {
      playTransferSound();
      const J_MAX = jMaxRef.current;
      const jv = jVesselRef.current;
      const gv = gVesselRef.current;
      const exactVol = Math.floor(sipVol);
      const transfer = overflowMode ? sipVol : Math.min(sipVol, J_MAX - jVol.current);
      const steps = 60, stepVol = transfer / steps;
      const startX = gv.wx + gv.ww / 2;
      const startY = gv.top + 2;
      const endX = jv.wx + jv.ww / 2;
      const endY = jv.top + 2;
      const dx = endX - startX;
      const dy = endY - startY;
      const frames = 28;
      const gravity = 0.32;
      const vx = dx / frames;
      const vy = (dy - 0.5 * gravity * frames * frames) / frames;
      const baseTotal = displayTotal.current;  // snapshot before pour starts
      for (let i = 0; i < steps; i++) {
        setTimeout(() => {
          spawnParticle(startX + (Math.random() - 0.5) * 2, startY, vx, vy, 9, 'toJar');
          gVol.current = Math.max(0, gVol.current - stepVol);
          jVol.current = Math.min(jVol.current + stepVol, J_MAX);
          // Use fraction-based accounting to avoid floating-point drift
          displayTotal.current = baseTotal + transfer * ((i + 1) / steps);
          updateUI();
        }, i * 15);
      }
      setTimeout(() => {
        const prevTotal = totalPoured.current;
        addSipBubble(exactVol); updateStats(transfer);

        // Keep jar volume consistent by deriving it from true daily total:
        // jar remainder = totalPoured % jarCapacity.
        const newTotal = totalPoured.current;
        const EPS = 0.0001;
        const newCycles = Math.floor((newTotal + EPS) / J_MAX);
        jarFillCount.current = newCycles;
        if (jarFillCountTxtRef.current) {
          jarFillCountTxtRef.current.textContent = `x${jarFillCount.current}`;
          const badge = mainSvgRef.current?.querySelector('#jarFillCountBadge');
          if (badge) badge.style.opacity = jarFillCount.current > 0 ? '1' : '0';
        }

        let remainder = newTotal - newCycles * J_MAX;
        if (remainder < EPS) remainder = 0;
        if (remainder > J_MAX) remainder = J_MAX;
        jVol.current = remainder;
        displayJ.current = remainder;
        updateUI();
        // Snap displayTotal to match the authoritative totalPoured (fixes float drift)
        displayTotal.current = totalPoured.current;

        if (prevTotal + J_VOL_EPS < J_MAX && totalPoured.current + J_VOL_EPS >= J_MAX) {
          triggerGoalReached();
        }

        const gIdx = glassIdxRef.current;
        const jIdx = jarIdxRef.current;
        const gDef = COLL_GLASSES[gIdx] || COLL_GLASSES[0];
        const jDef = COLL_JARS[jIdx] || COLL_JARS[0];
        const glassSnap = { id: gDef.id, name: gDef.label, volumeMl: gMaxRef.current };
        const jarSnap = { id: jDef.id, name: jDef.label, volumeMl: jMaxRef.current };
        const mlToLog = Math.round(transfer);
        if (mlToLog < 1) return;
        // Guest mode: skip API call, save to local storage, show sign-in nudge after first sip
        if (!authTokenRef.current) {
          if (!nudgeShownRef.current) {
            nudgeShownRef.current = true;
            setSignInNudge(true);
          }
          const today = new Date().toISOString().split('T')[0];
          const gData = {
            date: today,
            totalPoured: totalPoured.current,
            sipCount: sipCount.current,
            logs: sips.current
          };
          localStorage.setItem('sipsip_guest', JSON.stringify(gData));
          return;
        }
        logSipAPI(mlToLog, glassSnap, jarSnap)
          .then((res) => {
            if (res?.dailySummary) {
              totalPoured.current = res.dailySummary.totalMl ?? totalPoured.current;
              sipCount.current = res.dailySummary.sipCount ?? sipCount.current;
            }
            return statsService.getWeekly(mondayISO());
          })
          .then((w) => {
            if (!w?.days?.length) return;
            weekHistoryRef.current = w.days.map(d => d.totalMl || 0);
            weekGoalsHitRef.current = w.goalsHit ?? 0;
            weekAvgRef.current = w.weeklyAvg ?? 0;
            const J_MAX = jMaxRef.current;
            const fmt = n => n >= 1000 ? (n / 1000).toFixed(1) + 'L' : n + 'ml';
            const $ = id => statsBarRef.current?.querySelector(`#${id}`);
            const wkEl = $('statWeekly'); if (wkEl) wkEl.textContent = fmt(w.weeklyAvg || 0);
            const wkSub = $('statWeeklySub'); if (wkSub) wkSub.textContent = fmt(w.weeklyAvg || 0) + ' / day';
            const grEl = $('statGoalsReached'); if (grEl) grEl.textContent = w.goalsHit ?? 0;
            const grSub = $('statGoalsSub'); if (grSub) grSub.textContent = (w.goalsHit ?? 0) + ' of 7 days';
            const goalPct = Math.round((totalPoured.current / J_MAX) * 100);
            const pctEl = $('statGoalPct'); if (pctEl) pctEl.textContent = goalPct + '%';
            const subEl = $('statGoalSub'); if (subEl) subEl.textContent = Math.round(totalPoured.current) + ' / ' + J_MAX + 'ml';
            const circ = 2 * Math.PI * 55;
            const arc = $('drRingArc'); if (arc) arc.style.strokeDashoffset = circ - (goalPct / 100) * circ;
            const rPct = $('drRingPct'); if (rPct) rPct.textContent = goalPct + '%';
            const rMl = $('drRingMl'); if (rMl) rMl.textContent = Math.round(totalPoured.current) + ' ml';
            // Refresh avg frequency from backend
            return statsService.getOverview();
          })
          .then((ov) => {
            if (ov) {
              const $ = id => statsBarRef.current?.querySelector(`#${id}`);
              const frEl = $('statFreq'); if (frEl) frEl.textContent = ov.avgFrequency ?? 0;
            }
          })
          .catch(() => { });
      }, steps * 15 + 100);
    }

    function onGlassDown(e) {
      const G_MAX = gMaxRef.current;
      const J_MAX = jMaxRef.current;
      e.preventDefault();
      if (isPouringLock.current || gVol.current < 10) return;
      tapHint.classList.remove(styles.tapHintShow);
      tapHintShowing.current = false;
      if (tapHintTimer.current) clearTimeout(tapHintTimer.current);
      if (jVol.current + J_VOL_EPS >= J_MAX) {
        isPouringLock.current = true;
        spawnOverflowSplash();
        doPourToJar(gVol.current, true);
        setTimeout(() => { isPouringLock.current = false; }, 1200);
        return;
      }

      isPouringLock.current = true;
      doPourToJar(gVol.current, false);
      setTimeout(() => { isPouringLock.current = false; }, 1200);
    }

    function startFill(e) {
      const G_MAX = gMaxRef.current;
      e.preventDefault();
      if (gVol.current >= G_MAX) { triggerGlassShake(); return; }
      wasFilling.current = true;
      fillBtnRef.current?.classList.add(styles.pressing);
      holdTimer.current = setTimeout(() => {
        startFillSound();
        function flowLoop() {
          const G_MAX2 = gMaxRef.current;
          const gv2 = gVesselRef.current;
          if (!wasFilling.current) return;
          if (gVol.current >= G_MAX2) { triggerGlassShake(); stopFill(); return; }
          const queuedFill = Math.min(HOLD_RATE, Math.max(0, G_MAX2 - gVol.current));

          const fillBtn = fillBtnRef.current;
          const svgEl = mainSvgRef.current;
          const gCx2 = gv2.wx + gv2.ww / 2;
          let spawnX = gCx2;
          let spawnY = gv2.top - 10;
          if (fillBtn && svgEl) {
            const btnRect = fillBtn.getBoundingClientRect();
            const svgRect = svgEl.getBoundingClientRect();
            const scaleX = 500 / svgRect.width;
            const scaleY = 500 / svgRect.height;
            spawnX = (btnRect.left + btnRect.width / 2 - svgRect.left) * scaleX;
            spawnY = (btnRect.top + btnRect.height / 2 - svgRect.top) * scaleY;
          }
          spawnParticle(spawnX + (Math.random() - 0.5) * 3, spawnY, (Math.random() - 0.5) * 0.5, 5, 9, 'toGlass');
          spawnParticle(spawnX + (Math.random() - 0.5) * 3, spawnY, (Math.random() - 0.5) * 0.5, 5, 9, 'toGlass');

          scheduleGlassFill(queuedFill);
          fillRaf.current = requestAnimationFrame(flowLoop);
        }
        fillRaf.current = requestAnimationFrame(flowLoop);
      }, HOLD_THRESHOLD);
    }

    function stopFill() {
      const G_MAX = gMaxRef.current;
      const gv = gVesselRef.current;
      if (!wasFilling.current) return;
      if (fillRaf.current === null && holdTimer.current !== null) {
        clearTimeout(holdTimer.current); holdTimer.current = null;
        if (gVol.current < G_MAX) {
          playWaterSound();
          const queuedTapFill = Math.min(ML_PER_TAP, Math.max(0, G_MAX - gVol.current));
          const fillBtn = fillBtnRef.current;
          const svgEl = mainSvgRef.current;
          const gCx = gv.wx + gv.ww / 2;
          let spawnX = gCx;
          let spawnY = gv.top - 10;
          if (fillBtn && svgEl) {
            const btnRect = fillBtn.getBoundingClientRect();
            const svgRect = svgEl.getBoundingClientRect();
            const scaleX = 500 / svgRect.width;
            const scaleY = 500 / svgRect.height;
            spawnX = (btnRect.left + btnRect.width / 2 - svgRect.left) * scaleX;
            spawnY = (btnRect.top + btnRect.height / 2 - svgRect.top) * scaleY;
          }
          spawnParticle(spawnX + (Math.random() - 0.5) * 4, spawnY, (Math.random() - 0.5) * 0.4, 4, 6, 'toGlass');
          scheduleGlassFill(queuedTapFill);
        }
      }
      if (fillRaf.current !== null) {
        cancelAnimationFrame(fillRaf.current);
        fillRaf.current = null;
        stopFillSound();
      }
      if (holdTimer.current !== null) { clearTimeout(holdTimer.current); holdTimer.current = null; }
      wasFilling.current = false;
      fillBtnRef.current?.classList.remove(styles.pressing);
      if (gVol.current >= 10) showTapHint();
    }

    startFillRef.current = startFill;
    stopFillRef.current = stopFill;

    glassGrp.addEventListener('pointerdown', onGlassDown);
    window.addEventListener('pointerup', stopFill);
    window.addEventListener('pointercancel', stopFill);

    /* ── Wave loop ── */
    function drawWave(backEl, frontEl, waterY, x0, x1, amplitude) {
      if (!backEl || !frontEl) return;
      if (waterY >= VESSEL_BOTTOM) { backEl.setAttribute('d', ''); frontEl.setAttribute('d', ''); return; }
      const w = x1 - x0, a = amplitude, p = wavePhase.current;
      const b0 = waterY + a * 0.6 * Math.sin(p), b1 = waterY - a * 0.8 * Math.sin(p + 1.2), b2 = waterY + a * 0.5 * Math.sin(p + 2.4);
      const back = `M ${x0} ${b0} C ${x0 + w * 0.2} ${b0 - a * 1.1},${x0 + w * 0.35} ${b1 + a * 0.9},${x0 + w * 0.5} ${b1} C ${x0 + w * 0.65} ${b1 - a * 0.8},${x0 + w * 0.8} ${b2 + a},${x1} ${b2} L ${x1} ${VESSEL_BOTTOM} L ${x0} ${VESSEL_BOTTOM} Z`;
      const f0 = waterY + a * 0.3 * Math.sin(p + 0.8), f1 = waterY - a * 0.6 * Math.sin(p + 2.0), f2 = waterY + a * 0.4 * Math.sin(p + 3.2);
      const front = `M ${x0} ${f0} C ${x0 + w * 0.25} ${f0 - a * 1.3},${x0 + w * 0.45} ${f1 + a * 1.1},${x0 + w * 0.6} ${f1} C ${x0 + w * 0.75} ${f1 - a * 0.9},${x0 + w * 0.88} ${f2 + a * 0.7},${x1} ${f2} L ${x1} ${VESSEL_BOTTOM} L ${x0} ${VESSEL_BOTTOM} Z`;
      backEl.setAttribute('d', back); frontEl.setAttribute('d', front);
    }

    let waveRafId;
    function waveLoop() {
      const G_MAX = gMaxRef.current;
      const J_MAX = jMaxRef.current;
      const gv = gVesselRef.current;
      const jv = jVesselRef.current;
      wavePhase.current += 0.04;
      const gH = (gVol.current / G_MAX) * (VESSEL_BOTTOM - gv.top);
      const jH = (jVol.current / J_MAX) * (VESSEL_BOTTOM - jv.top);
      const gY = VESSEL_BOTTOM - gH;
      const jY = VESSEL_BOTTOM - jH;
      drawWave(gWaveEl, gWaveFr, gY, gv.wx, gv.wx + gv.ww, 7);
      drawWave(jWaveEl, jWaveFr, jY, jv.wx, jv.wx + jv.ww, 9);
      gWater.setAttribute('height', gH); gWater.setAttribute('y', gY);
      gWater.setAttribute('x', gv.wx); gWater.setAttribute('width', gv.ww);
      jWater.setAttribute('height', jH); jWater.setAttribute('y', jY);
      jWater.setAttribute('x', jv.wx); jWater.setAttribute('width', jv.ww);
      waveRafId = requestAnimationFrame(waveLoop);
    }
    waveRafId = requestAnimationFrame(waveLoop);

    /* ── Ticker ── */
    let tickRafId;
    function ticker() {
      const J_MAX = jMaxRef.current;
      const tG = Math.floor(gVol.current), tJ = Math.floor(jVol.current);
      const stepG = Math.max(1, Math.ceil(Math.abs(tG - displayG.current) / 4));
      const stepJ = Math.max(1, Math.ceil(Math.abs(tJ - displayJ.current) / 4));
      if (displayG.current < tG) displayG.current = Math.min(tG, displayG.current + stepG);
      else if (displayG.current > tG) displayG.current = Math.max(0, displayG.current - stepG);
      if (displayJ.current < tJ) displayJ.current = Math.min(tJ, displayJ.current + stepJ);
      else if (displayJ.current > tJ) displayJ.current = Math.max(0, displayJ.current - stepJ);
      if (gTxt) gTxt.textContent = `${displayG.current}ml`;
      if (jTxt) {
        // displayTotal is updated by the pour loop (smooth) or snapped on restore.
        // No interpolation here — just render the current value.
        jTxt.textContent = `${Math.round(displayTotal.current)} / ${J_MAX}ml`;
      }
      tickRafId = requestAnimationFrame(ticker);
    }
    tickRafId = requestAnimationFrame(ticker);
    if (gTxt) gTxt.textContent = '0ml';
    if (jTxt) jTxt.textContent = `0 / ${jMaxRef.current}ml`;

    return () => {
      cancelAnimationFrame(waveRafId);
      cancelAnimationFrame(tickRafId);
      if (fillRaf.current) cancelAnimationFrame(fillRaf.current);
      if (holdTimer.current) clearTimeout(holdTimer.current);
      pendingFillTimers.current.forEach(clearTimeout);
      pendingFillTimers.current = [];
      clearActivityReplayTimers();
      glassGrp.removeEventListener('pointerdown', onGlassDown);
      window.removeEventListener('pointerup', stopFill);
      window.removeEventListener('pointercancel', stopFill);
      statsObs.disconnect();
      // Clear activity bubbles so StrictMode re-mount doesn't duplicate them
      if (bubblesGrp) bubblesGrp.innerHTML = '';
      if (emptyState) emptyState.setAttribute('display', 'block');
      sips.current = [];
      sipCount.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Sync SVG text colours when theme changes ── */
  useEffect(() => {
    const actSvg = actSvgRef.current; if (!actSvg) return;
    actSvg.querySelector('#activityTitle')?.setAttribute('fill', isDarkVal ? '#e8ecf4' : '#1a1a1a');
    actSvg.querySelector('#activityLine')?.setAttribute('stroke', isDarkVal ? '#262b3d' : '#eee');
    actSvg.querySelector('#sipCount')?.setAttribute('fill', isDarkVal ? '#3d4560' : '#bbb');

    // Recolor existing activity bubbles on theme change (no refresh needed).
    const bubblesGrp = actSvg.querySelector('#bubblesGroup');
    if (bubblesGrp) {
      const timeFill = isDarkVal ? '#4a5a7a' : '#999';
      const paletteSet = isDarkVal ? BUBBLE_PALETTES.dark : BUBBLE_PALETTES.light;
      Array.from(bubblesGrp.children).forEach((g, idx) => {
        const sip = sips.current[idx];
        const palIdx = sip?.palIdx ?? 0;
        const pal = paletteSet[palIdx] ?? paletteSet[0];
        const circle = g.querySelector('circle');
        const volText = g.querySelector('text[data-role="vol"]');
        const timeText = g.querySelector('text[data-role="time"]');
        if (circle) {
          circle.setAttribute('fill', pal.fill);
          circle.setAttribute('stroke', pal.stroke);
        }
        if (volText) volText.setAttribute('fill', pal.text);
        if (timeText) timeText.setAttribute('fill', timeFill);
      });
    }
  }, [isDarkVal]);

  function closeGoal() {
    goalOverlayRef.current?.classList.remove(styles.goalShow);
    goalShown.current = false;
  }

  const vStroke = isDarkVal ? 'rgba(255,255,255,0.6)' : '#2d2d2d';
  const lFill = isDarkVal ? '#6a7a94' : '#444';

  return (
    <>
      <SEO
        title="Dashboard"
        description="Track your water intake in real-time. Tap to sip, fill your glass, and reach your daily hydration goal."
        path="/dashboard"
      />
      <div className={`${styles.page} ${isDarkVal ? styles.dark : ''}`}>

        {/* ══════════ SHARED NAVBAR ══════════ */}
        <Navbar animateIn={true} onMenuClick={() => setMenuOpen(o => !o)} showSignInNudge={signInNudge} onDismissNudge={() => setSignInNudge(false)} />

        {/* ══════════ PAGE CONTENT ══════════ */}
        <div className={styles.pageContent}>
          <div className={styles.cardsWrapper}>

            {/* Card 1: Water tracker */}
            <div className={`${styles.appCard} ${isDarkVal ? styles.cardDark : ''} ${card1Show ? styles.visible : ''}`} ref={card1Ref}>
              {/* ── Sound toggle icon ── */}
              <button
                className={`${styles.soundToggle} ${isDarkVal ? styles.soundToggleDark : ''}`}
                onClick={() => dispatch(toggleSound())}
                aria-label={soundEnabled ? 'Mute sounds' : 'Unmute sounds'}
                title={soundEnabled ? 'Sound on' : 'Sound off'}
              >
                {soundEnabled ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                    <line x1="23" y1="9" x2="17" y2="15" />
                    <line x1="17" y1="9" x2="23" y2="15" />
                  </svg>
                )}
              </button>
              <div className={`${styles.fillBtnWrap} ${fillShow ? styles.fillVisible : ''}`} ref={fillBtnWrapRef}>
                <div className={`${styles.fillBtn} ${isDarkVal ? styles.fillBtnDark : ''}`} ref={fillBtnRef}
                  onPointerDown={e => startFillRef.current?.(e)}
                  onPointerUp={e => stopFillRef.current?.(e)}
                  onPointerCancel={e => stopFillRef.current?.(e)}>
                  <span>Fill</span>
                </div>
              </div>
              <div className={styles.appCardInner}>
                <div className={`${styles.tapHint} ${isDarkVal ? styles.tapHintDark : ""}`} ref={tapHintRef}>Press &amp; hold to fill 💧</div>
                <svg ref={mainSvgRef} viewBox="0 0 500 500" style={{ width: '100%', height: '100%', display: 'block', outline: 'none' }}>
                  <defs>
                    <filter id="goo" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                      <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" />
                    </filter>
                    {GLASS_VESSELS.map((g, i) => (
                      <clipPath key={i} id={`glassClip${i}`}>
                        <path d={g.p} />
                      </clipPath>
                    ))}
                    {JAR_VESSELS.map((j, i) => (
                      <clipPath key={i} id={`jarClip${i}`}>
                        <path d={j.p} />
                      </clipPath>
                    ))}
                  </defs>
                  <g id="pGroup" filter="url(#goo)" pointerEvents="none" />

                  {/* ── Glass ── */}
                  <g id="glassGroup" style={{ cursor: 'pointer' }}>
                    <g id="glassWaterGroup" clipPath={`url(#glassClip${glassIdx})`}>
                      <rect id="gWater"
                        x={gVesselRef.current.wx} y={VESSEL_BOTTOM}
                        width={gVesselRef.current.ww} height="0"
                        fill="#74b9ff" opacity="0.9" />
                      <path id="gWave" d="" fill="rgba(116,185,255,0.35)" />
                      <path id="gWaveFront" d="" fill="rgba(88,168,255,0.55)" />
                    </g>
                    {/* Invisible hit area so whole glass body is clickable */}
                    <path id="glassHitArea" d={gVesselRef.current.p} fill="rgba(0,0,0,0.001)" stroke="none" />
                    <path id="glassOutline" d={gVesselRef.current.p}
                      fill="none" stroke={vStroke} strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                    <text x="160" y="475" id="gTxt"
                      fill={lFill} fontSize="13" textAnchor="middle"
                      fontWeight="600" letterSpacing="0.4"
                      fontFamily="DM Sans,sans-serif" pointerEvents="none" />
                  </g>

                  {/* ── Jar ── */}
                  <g id="jarGroup">
                    <g id="jarWaterGroup" clipPath={`url(#jarClip${jarIdx})`}>
                      <rect id="jWater"
                        x={jVesselRef.current.wx} y={VESSEL_BOTTOM}
                        width={jVesselRef.current.ww} height="0"
                        fill="#74b9ff" opacity="0.9" />
                      <path id="jWave" d="" fill="rgba(116,185,255,0.35)" />
                      <path id="jWaveFront" d="" fill="rgba(88,168,255,0.55)" />
                    </g>
                    <path id="jarOutline" d={jVesselRef.current.p}
                      fill="none" stroke={vStroke} strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                    <text x="350" y="475" id="jTxt"
                      fill={lFill} fontSize="13" textAnchor="middle"
                      fontWeight="600"
                      fontFamily="DM Sans,sans-serif" pointerEvents="none" />

                    {/* Bottom-right jar cycle counter */}
                    <g
                      id="jarFillCountBadge"
                      transform={`translate(${jVesselRef.current.wx + jVesselRef.current.ww - 40},446)`}
                      style={{ opacity: jarFillCount.current > 0 ? '1' : '0', transition: 'opacity 0.4s cubic-bezier(0.16,1,0.3,1)' }}
                    >
                      <rect
                        x="0"
                        y="0"
                        width="38"
                        height="24"
                        rx="12"
                        ry="12"
                        fill="rgba(116,185,255,0.15)"
                        stroke="rgba(116,185,255,0.4)"
                        strokeWidth="1.5"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))', backdropFilter: 'blur(4px)' }}
                      />
                      <text
                        x="19"
                        y="16"
                        ref={jarFillCountTxtRef}
                        id="jarFillCountTxt"
                        fill="#74b9ff"
                        fontSize="13"
                        fontFamily="DM Sans,sans-serif"
                        fontWeight="800"
                        textAnchor="middle"
                        pointerEvents="none"
                      >
                        x{jarFillCount.current}
                      </text>
                    </g>
                  </g>
                </svg>
              </div>
            </div>

            {/* Hydration paragraph */}
            <div className={styles.hydrationPara} ref={hydraParaRef} style={{ visibility: 'hidden' }}>
              <div className={styles.paraEyebrow} ref={paraEyeRef}
                style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--water)', marginBottom: '16px', opacity: 0, transition: 'opacity 0.8s' }}>
                Hydration
              </div>
              <p className={styles.paraText} ref={paraTextRef}>
                Water is the quietest form of self‑care — <em>it asks for nothing, yet gives everything.</em> Every sip you take is a small act of love toward your body, a gentle promise to stay present and alive. Let each drop remind you that the simplest rituals are often the most profound.
              </p>
              <div ref={paraLineRef} style={{ width: '40px', height: '2px', background: 'linear-gradient(90deg,var(--water),transparent)', borderRadius: '2px', marginTop: '22px', opacity: 0, transform: 'scaleX(0)', transformOrigin: 'left', transition: 'opacity 0.6s,transform 0.8s cubic-bezier(0.16,1,0.3,1)' }} />
            </div>

          </div>

          {/* ── Activity row ── */}
          <div className={styles.activityTextWrap}>
            <div className={styles.activitySideText} ref={actSideRef} style={{ visibility: 'hidden' }}>
              <div ref={actEyeRef}
                style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--water)', marginBottom: '14px', opacity: 0, transition: 'opacity 0.8s' }}>
                Every Drop
              </div>
              <p ref={actTextRef} style={{ fontSize: 'clamp(16px,1.9vw,28px)', fontWeight: 300, color: '#8a9db5', lineHeight: 1.7 }}>
                Every drop you track is a quiet conversation with your body. Water doesn't ask for attention — it simply sustains. When you pause to notice each sip, you begin to understand the language of your own needs. Awareness is the first step to every lasting change.
              </p>
              <div ref={actLineRef} style={{ width: '30px', height: '2px', background: 'linear-gradient(90deg,var(--water),transparent)', borderRadius: '2px', marginTop: '18px', opacity: 0, transform: 'scaleX(0)', transformOrigin: 'left', transition: 'opacity 0.6s,transform 0.7s cubic-bezier(0.16,1,0.3,1)' }} />
            </div>
            <div className={styles.activityCardCol}>
              <div className={`${styles.activityCard} ${isDarkVal ? styles.cardDark : ''} ${card2Show ? styles.visible : ''}`} ref={card2Ref}>
                <svg ref={actSvgRef} viewBox="0 0 500 500" style={{ width: '100%', height: '100%', display: 'block' }}>
                  <defs>
                    <filter id="bubbleShadow" x="-40%" y="-40%" width="180%" height="180%">
                      <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#a0bcd8" floodOpacity="0.3" />
                    </filter>
                  </defs>
                  <text id="activityTitle" x="36" y="44" fontFamily="DM Sans,sans-serif" fontSize="21" fontWeight="600" fill="#1a1a1a">Activity</text>
                  <text x="464" y="44" id="sipCount" fontFamily="DM Sans,sans-serif" fontSize="15" fill="#bbb" textAnchor="end">0 Sip</text>
                  <line id="activityLine" x1="36" y1="58" x2="464" y2="58" stroke="#eee" strokeWidth="1" />
                  <g id="emptyState">
                    <text x="250" y="290" fontFamily="DM Sans,sans-serif" fontSize="17" fill="#ccc" textAnchor="middle">Take a sip 💧</text>
                  </g>
                  <g id="bubblesGroup" />
                </svg>
              </div>
            </div>
          </div>

          {/* ── Drink Report ── */}
          <div className={`${styles.statsBar} ${isDarkVal ? styles.statsBarDark : ''} ${statsShow ? styles.drVisible : ''}`} ref={statsBarRef}>
            <div className={styles.drRingSection}>
              <div className={styles.drRingContainer}>
                <svg className={styles.drRingSvg} viewBox="0 0 140 140">
                  <defs>
                    <linearGradient id="drRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#93c5fd" />
                      <stop offset="100%" stopColor="#2563eb" />
                    </linearGradient>
                  </defs>
                  <circle className={`${styles.drRingTrack} ${isDarkVal ? styles.drRingTrackDark : ""}`} cx="70" cy="70" r="55" />
                  <circle className={styles.drRingFill} id="drRingArc" cx="70" cy="70" r="55" />
                </svg>
                <div className={styles.drRingInner}>
                  <div className={styles.drRingEmoji}>💧</div>
                  <div className={`${styles.drRingPct} ${isDarkVal ? styles.drRingPctDark : ""}`} id="drRingPct">0%</div>
                  <div className={styles.drRingMl} id="drRingMl">0 ml</div>
                </div>
              </div>
              <div className={styles.drRingInfo}>
                <div className={`${styles.drRingGoal} ${isDarkVal ? styles.drRingGoalDark : ""}`} id="drRingGoal">
                  Goal: {jarVolume} ml
                </div>
              </div>
            </div>
            <div className={`${styles.drDivider} ${isDarkVal ? styles.drDividerDark : ""}`} />
            <div className={styles.drGrid}>
              {[
                { n: 1, cls: styles.drCard1, icon: '💧', badge: 'TODAY', label: 'Goal Progress', valId: 'statGoalPct', subId: 'statGoalSub', defaultSub: `of ${jarVolume}ml` },
                { n: 2, cls: styles.drCard2, icon: '📈', badge: 'WEEK', label: 'Weekly Avg', valId: 'statWeekly', subId: 'statWeeklySub', defaultSub: 'ml / day' },
                { n: 3, cls: styles.drCard3, icon: '🏆', badge: '7 DAYS', label: 'Goals Reached', valId: 'statGoalsReached', subId: 'statGoalsSub', defaultSub: 'this week' },
                { n: 4, cls: styles.drCard4, icon: '⚡', badge: 'AVG', label: 'Avg Frequency', valId: 'statFreq', subId: null, defaultSub: 'sips / day' },
              ].map(({ n, cls, icon, badge, label, valId, subId, defaultSub }) => {
                const iconCls = isDarkVal ? styles[`icon${n}d`] : styles[`icon${n}`];
                const badgeCls = isDarkVal ? styles[`badge${n}d`] : styles[`badge${n}`];
                const subCls = isDarkVal ? styles[`sub${n}d`] : styles[`sub${n}`];
                return (
                  <div key={valId} className={`${styles.drCard} ${cls} ${isDarkVal ? styles.drCardDark : ''}`}>
                    <div className={styles.drCardTop}>
                      <div className={`${styles.drIcon} ${iconCls}`}>{icon}</div>
                      <div className={`${styles.drBadge} ${badgeCls}`}>{badge}</div>
                    </div>
                    <div className={`${styles.drLabel} ${isDarkVal ? styles.drLabelDark : ''}`}>{label}</div>
                    <div className={`${styles.drValue} ${isDarkVal ? styles.drValueDark : ''}`} id={valId}>{valId === 'statWeekly' ? '—' : '0'}{valId === 'statGoalPct' ? '%' : ''}</div>
                    <div className={`${styles.drSub} ${subCls}`} id={subId || undefined}>{defaultSub}</div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* ══════════ GOAL OVERLAY ══════════ */}
        <div className={`${styles.goalOverlay} ${isDarkVal ? styles.goalDark : ''}`} ref={goalOverlayRef}>
          <div className={`${styles.goalBg} ${isDarkVal ? styles.goalBgDark : ""}`} />
          <div className={styles.goalConfettiWrap} ref={goalConfRef} />
          <div className={styles.goalInner}>
            <div className={styles.goalEmoji}>💧</div>
            <div className={`${styles.goalTitle} ${isDarkVal ? styles.goalTitleDark : ''}`}>Goal Reached!</div>
            <div className={`${styles.goalSub} ${isDarkVal ? styles.goalSubDark : ''}`}>
              You've hit your {jarVolume} ml daily target. Amazing!
            </div>
            <button className={`${styles.goalClose} ${isDarkVal ? styles.goalCloseDark : ''}`} onClick={closeGoal}>
              Keep Going 🎉
            </button>
          </div>
        </div>

      </div>

      {/* ══════════ MENU DRAWER ══════════ */}
      <MenuDrawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
