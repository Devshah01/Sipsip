import { useState, useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar/Navbar';
import MenuDrawer from '@/components/layout/MenuDrawer/MenuDrawer';
import BackButton from '@/components/layout/BackButton/BackButton';
import {
  fetchVesselSettings,
  updateVesselSettings,
  selectSelectedGlassIdx,
  selectSelectedJarIdx,
  selectGlassVolume,
  selectJarVolume,
  selectCollectionLoading,
} from '@/store/slices/collectionSlice';
import { setVesselCapacities } from '@/store/slices/waterSlice';
import { GLASSES, JARS } from '@/utils/vessels.jsx';
import SEO from '@/components/SEO/SEO';
import styles from './Collection.module.css';

// ─────────────────────────────────────────────────────────────
// Confetti burst (same as Profile save button)
// ─────────────────────────────────────────────────────────────
const CONF_COLORS = ['#74b9ff','#60a5fa','#f59e0b','#10b981','#f43f5e','#8b5cf6','#fbbf24','#34d399','#fb923c','#e879f9'];
function runConfetti(canvas, btnRect) {
  const ctx = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
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
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; }
  }
  requestAnimationFrame(loop);
}

// ─────────────────────────────────────────────────────────────
// VolumePopup — ring dial
// ─────────────────────────────────────────────────────────────
function VolumePopup({ vessel, isGlass, onClose, onConfirm, currentVol, confCanvasRef }) {
  // Independent volume ranges — not derived from vessel definitions
  const minVol = isGlass ? 50  : 500;
  const maxVol = isGlass ? 500 : 5000;
  const step   = isGlass ? 10  : 100;

  const snap = useCallback((v) => {
    const clamped = Math.max(minVol, Math.min(maxVol, v));
    return Math.round(clamped / step) * step;
  }, [minVol, maxVol, step]);

  const [vol, setVol] = useState(() => snap(currentVol));
  const [saved, setSaved] = useState(false);
  const confirmBtnRef = useRef(null);

  const presets = isGlass
    ? [100, 150, 200, 250, 350]
    : [1000, 1500, 2000, 2500, 3000];

  // ── Arc dial constants ──
  const RING_R   = 38;
  const RING_C   = 2 * Math.PI * RING_R;   // circumference ≈ 238.8
  const ARC_FRAC = 0.50;                    // 50% visible arc (180° semicircle)
  const RING_ARC = RING_C * ARC_FRAC;       // ≈ 143.3
  const RING_GAP = RING_C - RING_ARC;       // ≈ 95.5

  const pct        = Math.max(0, Math.min(1, (vol - minVol) / (maxVol - minVol)));
  const fillLength = RING_ARC * pct;
  // Fill arc: draw fillLength, then gap the rest of the circumference
  const fillDash   = `${fillLength} ${RING_C - fillLength}`;
  const trackDash  = `${RING_ARC} ${RING_GAP}`;
  // rotate 150° so the arc starts at lower-left, gap sits at bottom
  const ringRotate = 'rotate(180 50 50)';

  const handleSliderChange = (rawVal) => setVol(snap(parseInt(rawVal)));

  const handleStep = (dir) => {
    setVol(v => snap(v + dir * step));
  };

  const sliderBg = () => {
    const p = ((vol - minVol) / (maxVol - minVol)) * 100;
    const trackColor = document.body.classList.contains('dark') ? '#3a3f52' : '#d0d5dd';
    return `linear-gradient(to right, var(--water) ${p}%, ${trackColor} ${p}%)`;
  };

  const fmt = (v) => v >= 1000 ? (v/1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'L' : v + 'ml';

  const handleConfirm = () => {
    setSaved(true);
    if (confCanvasRef?.current && confirmBtnRef.current) {
      runConfetti(confCanvasRef.current, confirmBtnRef.current.getBoundingClientRect());
    }
    onConfirm(vol);
  };

  return (
    <div className={`${styles.volPopup} ${styles.open}`}>

      {/* ── Header ── */}
      <div className={styles.volPopupHead}>
        <div>
          <div className={styles.volPopupTitle}>{vessel.name}</div>
          <div className={styles.volPopupType}>{isGlass ? 'Drinking glass' : 'Daily water jar'}</div>
        </div>
        <button className={styles.volPopupClose} onClick={onClose}>✕</button>
      </div>

      {/* ── Ring dial + vessel preview ── */}
      <div className={styles.volGaugeRow}>

        {/* Ring dial */}
        <div className={styles.volRingWrap}>
          <svg viewBox="0 0 100 100" width="130" height="130">
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#74b9ff"/>
                <stop offset="100%" stopColor="#a78bfa"/>
              </linearGradient>
            </defs>
            {/* Track */}
            <circle
              cx="50" cy="50" r={RING_R}
              fill="none"
              stroke="var(--surface2,#eef0f6)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={trackDash}
              transform={ringRotate}
            />
            {/* Fill */}
            <circle
              cx="50" cy="50" r={RING_R}
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={fillDash}
              transform={ringRotate}
            />
          </svg>
          {/* Centered label inside ring */}
          <div className={styles.volNumBlock}>
            <span className={styles.volNum}>
              {vol >= 1000 ? (vol/1000).toFixed(vol % 1000 === 0 ? 0 : 1) : vol}
            </span>
            <span className={styles.volUnitLbl}>{vol >= 1000 ? 'L' : 'ml'}</span>
          </div>
        </div>

        {/* Vessel preview — updated viewBox to 60×90 */}
        <div className={styles.volPreviewWrap}>
          <svg viewBox="0 0 60 90" fill="none"
               stroke="var(--text,#1a1a1a)"
               strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
               width="54" height="80">
            {vessel.svg}
          </svg>
          <span className={styles.volPreviewLbl}>{vessel.name}</span>
        </div>
      </div>

      {/* ── Slider ── */}
      <input
        className={styles.volRange}
        type="range" min={minVol} max={maxVol} step={step}
        value={vol}
        style={{ background: sliderBg() }}
        onChange={e => handleSliderChange(e.target.value)}
      />
      <div className={styles.volRangeLabels}>
        <span>{fmt(minVol)}</span>
        <span>{fmt(maxVol)}</span>
      </div>

      {/* ── Step buttons ── */}
      <div className={styles.volStepRow}>
        <button className={styles.volStepBtn} onClick={() => handleStep(-1)}>−</button>
        <span className={styles.volStepMid}>{fmt(vol)}</span>
        <button className={styles.volStepBtn} onClick={() => handleStep(1)}>+</button>
      </div>

      {/* ── Presets ── */}
      <div className={styles.volPresets}>
        {presets.map(p => (
          <button key={p}
                  className={`${styles.volPreset} ${vol === p ? styles.active : ''}`}
                  onClick={() => setVol(p)}>
            {fmt(p)}
          </button>
        ))}
      </div>

      {/* ── Confirm ── */}
      <button
        ref={confirmBtnRef}
        className={`${styles.volConfirm} ${saved ? styles.success : ''}`}
        onClick={handleConfirm}>
        {saved ? '✓ Saved!' : 'Set Volume'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Collection component
// ─────────────────────────────────────────────────────────────
export default function Collection() {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  // ═══ REVEAL ANIMATIONS ═══
  const [backShow, setBackShow] = useState(false);

  const selectedGlassIdx = useSelector(selectSelectedGlassIdx);
  const selectedJarIdx   = useSelector(selectSelectedJarIdx);
  const glassVolume      = useSelector(selectGlassVolume);
  const jarVolume        = useSelector(selectJarVolume);
  const isLoading        = useSelector(selectCollectionLoading);

  const [menuOpen,     setMenuOpen]     = useState(false);
  const [activeType,   setActiveType]   = useState('glass');
  const [popupVessel,  setPopupVessel]  = useState(null);
  const [visibleItems, setVisibleItems] = useState([]);
  const [toast,        setToast]        = useState({ msg: '', show: false });
  const confCanvasRef = useRef(null);


  useEffect(() => { dispatch(fetchVesselSettings()); }, [dispatch]);

  useEffect(() => {
    const t = setTimeout(() => setBackShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setVisibleItems([]);
    const list = activeType === 'glass' ? GLASSES : JARS;
    list.forEach((_, i) => {
      setTimeout(() => setVisibleItems(prev => [...prev, i]), 20 + i * 15);
    });
  }, [activeType]);

  const showToast = msg => {
    setToast({ msg, show: true });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 2400);
  };

  const handleVesselClick = (vessel, isGlass) => {
    setPopupVessel({ vessel, isGlass });
  };
  const handleClosePopup  = () => setPopupVessel(null);

  const handleConfirmVol = async (vol) => {
    const { isGlass } = popupVessel;
    const newGlassIdx = isGlass ? popupVessel.vessel.id : selectedGlassIdx;
    const newJarIdx   = isGlass ? selectedJarIdx        : popupVessel.vessel.id;
    const newGlassVol = isGlass ? vol : glassVolume;
    const newJarVol   = isGlass ? jarVolume : vol;

    await dispatch(updateVesselSettings({
      selectedGlass: newGlassIdx,
      selectedJar:   newJarIdx,
      glassVolume:   newGlassVol,
      jarVolume:     newJarVol,
    }));

    dispatch(setVesselCapacities({ gMax: newGlassVol, jMax: newJarVol }));


    const label = vol >= 1000
      ? (vol/1000).toFixed(vol % 1000 === 0 ? 0 : 1) + 'L'
      : vol + 'ml';
    showToast(`${isGlass ? 'Glass' : 'Jar'} set to ${label}`);
    setPopupVessel(null);
  };

  // For any vessel (selected or not), open the popup at the current active volume.
  // This ensures the profile-calculated jarVolume is preserved when switching jars,
  // rather than jumping to the jar's hardcoded definition volume.
  const currentVol = popupVessel
    ? (popupVessel.isGlass ? glassVolume : jarVolume)
    : 250;
  const isSelected  = (vessel, isGlass) => isGlass ? vessel.id === selectedGlassIdx : vessel.id === selectedJarIdx;
  const getVolBadge = (vessel, isGlass) => {
    if (!isSelected(vessel, isGlass)) return null;
    const v = isGlass ? glassVolume : jarVolume;
    return v >= 1000 ? (v/1000).toFixed(v % 1000 === 0 ? 0 : 1) + 'L' : v + 'ml';
  };

  const renderGrid = (vessels, isGlass) => (
    <div className={styles.vesselGrid}
         style={{ display: (isGlass ? activeType === 'glass' : activeType === 'jar') ? 'grid' : 'none' }}>
      {vessels.map((vessel, i) => {
        const selected = isSelected(vessel, isGlass);
        const badge    = getVolBadge(vessel, isGlass);
        const visible  = visibleItems.includes(i);
        return (
          <div key={vessel.id}
               className={`${styles.vesselItem} ${selected?styles.selected:''} ${visible?styles.visible:''}`}
               onClick={() => handleVesselClick(vessel, isGlass)}>
            {/* ✅ Updated viewBox to 60×90 to match new vessels.jsx */}
            <svg viewBox="0 0 60 90" fill="none"
                 className={isGlass ? styles.glassSvg : ''}
                 stroke="var(--text,#1a1a1a)"
                 strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              {vessel.svg}
            </svg>
            <span className={styles.vesselItemName}>{vessel.name}</span>
            {badge && <span className={styles.vesselVolBadge}>{badge}</span>}
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <SEO
        title="Collection"
        description="Choose your drinking vessel — customize glass and jar styles and volumes."
        path="/collection"
      />
      <Navbar animateIn={true} onMenuClick={() => setMenuOpen(true)} />
      <MenuDrawer isOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className={styles.mainContent}>
        <div className={styles.subPage}>
          <BackButton revealed={backShow} delay={100} />

          <div className={styles.pageTitle}>Collection</div>
          <div className={styles.pageSub}>Choose your vessel — tap any to set volume</div>

          <div className={styles.collSwitcher}>
            <button className={`${styles.collPill} ${activeType==='glass'?styles.active:''}`} onClick={() => setActiveType('glass')}>Glass</button>
            <button className={`${styles.collPill} ${activeType==='jar'  ?styles.active:''}`} onClick={() => setActiveType('jar')}>Jar</button>
          </div>

          {renderGrid(GLASSES, true)}
          {renderGrid(JARS,    false)}
        </div>
      </div>

      <div className={`${styles.popupBackdrop} ${popupVessel?styles.open:''}`} onClick={handleClosePopup}/>

      {popupVessel && (
        <VolumePopup
          vessel={popupVessel.vessel}
          isGlass={popupVessel.isGlass}
          currentVol={currentVol}
          onClose={handleClosePopup}
          onConfirm={handleConfirmVol}
          confCanvasRef={confCanvasRef}
        />
      )}

      <canvas ref={confCanvasRef} className={styles.confettiCanvas} />


      <div className={`${styles.toast} ${toast.show?styles.show:''}`}>{toast.msg}</div>
    </>
  );
}
