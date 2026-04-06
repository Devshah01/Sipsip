import { useState, useEffect, useRef } from 'react';
import { useNavigate }                 from 'react-router-dom';
import { useDispatch }                 from 'react-redux';
import { setPreloaderDone }            from '@/store/slices/uiSlice';
import SEO                             from '@/components/SEO/SEO';
import styles                          from './Preloader.module.css';

const LETTERS = 'Sipsip'.split('');

export default function Preloader() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const brandRowRef     = useRef(null);
  const progressSecRef  = useRef(null);
  const progressFillRef = useRef(null);
  const progressNumRef  = useRef(null);
  const waterRectRef    = useRef(null);
  const audioRef        = useRef(null);

  const [glassSlide,    setGlassSlide]    = useState(false);
  const [lettersRun,    setLettersRun]    = useState(false);
  const [showExplore,   setShowExplore]   = useState(false);
  const [done,          setDone]          = useState(false);
  const [started,       setStarted]       = useState(false);
  const [showProgress,  setShowProgress]  = useState(false);

  // ── Sync progress bar width to brand row ──
  function syncWidth() {
    if (brandRowRef.current && progressSecRef.current) {
      const w = brandRowRef.current.getBoundingClientRect().width;
      if (w > 0) progressSecRef.current.style.width = w + 'px';
    }
  }

  // ── Orchestrated animation sequence ──
  useEffect(() => {
    // Preload audio
    const audio = new Audio('/preloader_audio.mp3');
    audio.preload = 'auto';
    audioRef.current = audio;

    // Step 1: Glass slides in
    const t1 = setTimeout(() => setGlassSlide(true), 200);

    // Step 2: Letters start after glass begins
    const t2 = setTimeout(() => setLettersRun(true), 400);

    // Step 3: Explore button fades in
    const t3 = setTimeout(() => {
      syncWidth();
      setShowExplore(true);
    }, 2200);

    // Sync on resize
    window.addEventListener('resize', syncWidth);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      window.removeEventListener('resize', syncWidth);
      // Cleanup audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ── Fill progress animation ──
  function startFilling() {
    if (started) return;
    setStarted(true);
    setShowExplore(false);
    setShowProgress(true);

    // Play preloader audio
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }

    setTimeout(() => {
      syncWidth();
      let progress  = 0;
      const duration = 3500;
      const interval = 40;
      const step     = 100 / (duration / interval);

      const timer = setInterval(() => {
        progress += step;
        const p = Math.min(progress, 100);

        // Update progress bar
        if (progressFillRef.current)
          progressFillRef.current.style.width = p + '%';
        if (progressNumRef.current)
          progressNumRef.current.textContent = Math.round(p) + '%';

        // Update water in glass SVG
        if (waterRectRef.current) {
          const waterHeight = (p / 100) * 76;
          waterRectRef.current.setAttribute('y', 96 - waterHeight);
          waterRectRef.current.setAttribute('height', waterHeight);
        }

        if (p >= 100) {
          clearInterval(timer);
          // Fade out preloader
          setTimeout(() => {
            // Stop audio on fade out
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
            setDone(true);
            dispatch(setPreloaderDone());
            // Navigate to auth after fade
            setTimeout(() => navigate('/dashboard'), 1000);
          }, 600);
        }
      }, interval);
    }, 100);
  }

  return (
    <div className={styles.preloaderBody}>
      <SEO
        title="Sipsip — Smart Hydration Tracker"
        description="Track your daily water intake, set hydration goals, and build healthy drinking habits with Sipsip."
        path="/"
      />
      <div className={`${styles.preloader} ${done ? styles.done : ''}`}>

        {/* ── Brand row ── */}
        <div className={styles.brandRow} ref={brandRowRef}>

          {/* Glass SVG */}
          <div className={`${styles.glassWrap} ${glassSlide ? styles.slideIn : ''}`}>
            <svg className={styles.glassSvg} viewBox="0 0 60 104">
              <clipPath id="innerClip">
                <polygon points="9,5 51,5 45,96 15,96"/>
              </clipPath>
              <g clipPath="url(#innerClip)">
                <rect
                  ref={waterRectRef}
                  id="waterRect"
                  x="0" y="96"
                  width="60" height="0"
                  fill="#74b9ff" opacity="0.9"
                />
              </g>
              <polygon
                points="9,5 51,5 45,96 15,96"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
              />
            </svg>
          </div>

          {/* Wordmark — letter by letter */}
          <div className={styles.wordmark}>
            {LETTERS.map((char, i) => (
              <span key={i} className={styles.letterClip}>
                <span
                  className={`${styles.letterInner} ${lettersRun ? styles.running : ''}`}
                  style={{ animationDelay: `${i * 120}ms` }}
                >
                  {char}
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* ── Progress bar ── */}
        <div
          className={`${styles.progressSection} ${showProgress ? styles.visible : ''}`}
          ref={progressSecRef}
        >
          <div className={styles.progressPct} ref={progressNumRef}>0%</div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} ref={progressFillRef} />
          </div>
        </div>

        {/* ── Explore button ── */}
        <button
          className={`${styles.exploreBtn} ${showExplore ? styles.show : ''}`}
          onClick={startFilling}
        >
          Explore
          <span className={styles.btnArrow}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>

      </div>
    </div>
  );
}
