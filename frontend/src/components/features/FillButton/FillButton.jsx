import { useRef, useCallback }      from 'react';
import { useSelector, useDispatch }  from 'react-redux';
import { addToGlass }                from '@/store/slices/waterSlice';
import styles                        from './FillButton.module.css';

const NS             = 'http://www.w3.org/2000/svg';
const G_MAX          = 250;
const ML_PER_TAP     = 1;
const HOLD_THRESHOLD = 180;
const HOLD_RATE      = 1.8;

const WATER_DROP_SOUND = new Audio('/waterdrop_audio.mp3');
WATER_DROP_SOUND.load();
function playWaterSound() {
  WATER_DROP_SOUND.currentTime = 0;
  WATER_DROP_SOUND.play().catch(() => {});
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
    const fade = 0.12; 
    const src = audioCtx.createBufferSource();
    src.buffer = fillBuffer;
    src.connect(fillGain);
    src.start(now);
    currentSource = src;
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

export default function FillButton({ svgRef, pGroupRef, onFilled, onFull }) {
  const dispatch = useDispatch();
  const isDark   = useSelector(s => s.ui.theme) === 'dark';
  const glassVol = useSelector(s => s.water.glassVol);

  const gVolRef      = useRef(glassVol);
  const fillRafRef   = useRef(null);
  const holdTimerRef = useRef(null);
  const isFillingRef = useRef(false);
  const btnRef       = useRef(null);

  // Keep gVolRef in sync
  gVolRef.current = glassVol;

  // ── Spawn particle from fill button down into glass ──
  function spawnFillParticle(x, y, vx, vy, r) {
    const pg = pGroupRef?.current;
    if (!pg) return;
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', r);
    c.setAttribute('fill', '#74b9ff');
    pg.appendChild(c);
    let px=x, py=y, pvx=vx, pvy=vy;
    const gravity = 0.45;
    let reflected = false;
    function step() {
      px+=pvx; py+=pvy; pvy+=gravity;
      const sY = 440 - (Math.max(5, gVolRef.current) / G_MAX * 140);
      if (py >= sY) {
        if (!reflected && Math.random() > 0.4) {
          pvy *= -0.35; pvx = (Math.random()-0.5)*4; reflected=true; py=sY-1;
        } else { c.remove(); return; }
      }
      c.setAttribute('cx', px); c.setAttribute('cy', py);
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const startFill = useCallback((e) => {
    e.preventDefault();
    if (gVolRef.current >= G_MAX) {
      if (onFull) onFull();
      return;
    }
    isFillingRef.current = true;
    btnRef.current?.classList.add(styles.pressing);

    holdTimerRef.current = setTimeout(() => {
      startFillSound();
      function flowLoop() {
        if (!isFillingRef.current) return;
        if (gVolRef.current >= G_MAX) {
          if (onFull) onFull();
          stopFill();
          return;
        }
        dispatch(addToGlass(HOLD_RATE));
        spawnFillParticle(
          160 + (Math.random()-0.5)*3, 58,
          (Math.random()-0.5)*0.5, 5, 9
        );
        spawnFillParticle(
          160 + (Math.random()-0.5)*3, 58,
          (Math.random()-0.5)*0.5, 5, 9
        );
        fillRafRef.current = requestAnimationFrame(flowLoop);
      }
      fillRafRef.current = requestAnimationFrame(flowLoop);
    }, HOLD_THRESHOLD);
  }, [dispatch, onFull]);

  const stopFill = useCallback(() => {
    if (!isFillingRef.current) return;

    // Single tap — no hold triggered yet
    if (fillRafRef.current === null && holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      if (gVolRef.current < G_MAX) {
        playWaterSound();
        dispatch(addToGlass(ML_PER_TAP));
        spawnFillParticle(
          160 + (Math.random()-0.5)*4, 58,
          (Math.random()-0.5)*0.4, 4, 6
        );
        if (gVolRef.current + ML_PER_TAP >= 10 && onFilled) onFilled();
      }
    }

    if (fillRafRef.current !== null) {
      cancelAnimationFrame(fillRafRef.current);
      fillRafRef.current = null;
      stopFillSound();
    }
    if (holdTimerRef.current !== null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    isFillingRef.current = false;
    btnRef.current?.classList.remove(styles.pressing);
  }, [dispatch, onFilled]);

  const isFull = glassVol >= G_MAX;

  return (
    <div className={styles.fillBtnWrap}>
      <div
        ref={btnRef}
        className={`${styles.fillBtn} ${isDark ? styles.dark : ''} ${isFull ? styles.full : ''}`}
        onPointerDown={startFill}
        onPointerUp={stopFill}
        onPointerLeave={stopFill}
        onPointerCancel={stopFill}
      >
        <span>{isFull ? 'Full' : 'Fill'}</span>
      </div>
    </div>
  );
}
