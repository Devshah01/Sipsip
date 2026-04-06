import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector }     from 'react-redux';
import { useNavigate }                  from 'react-router-dom';
import { toggleTheme }                  from '@/store/slices/uiSlice';
import styles                           from './Navbar.module.css';


const LETTERS = 'Sipsip'.split('');

/**
 * Shared Navbar used across all pages.
 *
 * Props:
 *   onMenuClick  — called when the wavy-lines menu button is clicked
 *   animateIn    — true (default) = full glass-drop + letter reveal on mount
 *                  false = appears instantly (for pages navigated to, not app load)
 */
export default function Navbar({ onMenuClick, animateIn = true, showSignInNudge = false, onDismissNudge }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isDark   = useSelector(s => s.ui.theme) === 'dark';
  const token    = useSelector(s => s.auth?.token);

  const logoWaterRef = useRef(null);

  const [lettersRun,   setLettersRun]   = useState(!animateIn);
  const [glassAnimate, setGlassAnimate] = useState(false);
  const [iconsVisible, setIconsVisible] = useState(
    animateIn ? [false, false, false] : [true, true, true]
  );

  useEffect(() => {
    if (!animateIn) return;

    // Step 1: Sipsip letters start immediately
    const t1 = setTimeout(() => setLettersRun(true), 0);

    // Step 2: After last letter done, glass drops
    const glassTrigger = 150 + (LETTERS.length - 1) * 90 + 480;
    const t2 = setTimeout(() => setGlassAnimate(true), glassTrigger);

    // Step 3: water fills after glass lands (smooth animation)
    const t3 = setTimeout(() => {
      // Smooth water fill animation
      setTimeout(() => {
        let progress = 0;
        const duration = 1200; // Faster fill (was 2000)
        const interval = 40;
        const step = 100 / (duration / interval);

        const timer = setInterval(() => {
          progress += step;
          const p = Math.min(progress, 100);

          if (logoWaterRef.current) {
            const waterHeight = (p / 100) * 27;
            logoWaterRef.current.setAttribute('y', 37 - waterHeight);
            logoWaterRef.current.setAttribute('height', waterHeight);
          }

          if (p >= 100) {
            clearInterval(timer);
          }
        }, interval);
      }, 100);
    }, glassTrigger + 720);

    // Nav icon buttons stagger in at 1200ms
    const t4 = setTimeout(() => setIconsVisible([true, false, false]), 1200);
    const t5 = setTimeout(() => setIconsVisible([true, true,  false]), 1340);
    const t6 = setTimeout(() => setIconsVisible([true, true,  true]),  1480);

    return () => [t1, t2, t3, t4, t5, t6].forEach(clearTimeout);
  }, [animateIn]);

  // ── Auto-dismiss sign-in nudge ──
  useEffect(() => {
    if (!showSignInNudge) return;
    const t = setTimeout(() => { if (onDismissNudge) onDismissNudge(); }, 8000);
    return () => clearTimeout(t);
  }, [showSignInNudge, onDismissNudge]);

  function getThemeIcon() {
    if (isDark) return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    );
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
      </svg>
    );
  }

  return (
    <div className={styles.navWrapper}>
      <nav className={`${styles.nav} ${isDark ? styles.dark : ''}`}>

        <div className={styles.navLeft}>
          {/* Glass drops AFTER Sipsip, but visually left via order:-1 */}
          <div className={`${styles.navGlassWrap} ${glassAnimate ? styles.animate : ''}`}
            style={!animateIn ? { opacity: 1, transform: 'translateY(0)' } : undefined}>
            <svg className={styles.navGlassSvg} viewBox="0 0 28 40">
              <clipPath id="logoClip">
                <path d="M3,3 L25,3 L22,37 L6,37 Z"/>
              </clipPath>
              <rect
                ref={logoWaterRef}
                id="logoWater"
                x="2" y="37" width="24" height="0"
                clipPath="url(#logoClip)"
                fill="#74b9ff"
                opacity="0.9"
              />
              <path
                id="navLogoPath"
                d="M3,3 L25,3 L22,37 L6,37 Z"
                fill="none"
                stroke={isDark ? '#a8b4c8' : '#1a1a1a'}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          {/* Sipsip text — letter by letter */}
          <div className={styles.navBrand}>
            {LETTERS.map((ch, i) => (
              <span key={i} className={styles.charClip}>
                <span
                  className={`${styles.char} ${lettersRun ? styles.charVisible : ''}`}
                  style={
                    animateIn
                      ? { animationDelay: `${150 + i * 90}ms` }
                      : { opacity: 1, transform: 'translateY(0)', animation: 'none' }
                  }
                >
                  {ch}
                </span>
              </span>
            ))}
          </div>
        </div>

        <div className={styles.navRight}>
          {/* Account */}
          <div className={styles.accountWrap}>
          <button
            className={`${styles.navIconBtn} ${isDark ? styles.darkBtn : ''} ${iconsVisible[0] ? styles.navVisible : ''}`}
            title="Account"
            onClick={() => navigate(token ? '/account' : '/auth')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </button>
          {showSignInNudge && (
            <div className={`${styles.nudge} ${isDark ? styles.nudgeDark : ''}`}>
              <div className={styles.nudgeContent}>
                <div className={styles.nudgeIconWrap}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path
                      d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"
                      fill="#74b9ff"
                      fillOpacity={0.9}
                    />
                  </svg>
                </div>
                <span className={styles.nudgeText}>Track your sip, </span>
                <button className={styles.nudgeAction} onClick={() => navigate('/auth')}>
                  Sign in
                </button>
              </div>
              <button className={styles.nudgeClose} onClick={onDismissNudge} aria-label="Dismiss">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          )}
          </div>

          {/* Theme */}
          <button
            className={`${styles.navIconBtn} ${isDark ? styles.darkBtn : ''} ${iconsVisible[1] ? styles.navVisible : ''}`}
            title="Toggle theme"
            onClick={() => dispatch(toggleTheme())}
          >
            {getThemeIcon()}
          </button>

          {/* Menu */}
          <button
            className={`${styles.navIconBtn} ${isDark ? styles.darkBtn : ''} ${iconsVisible[2] ? styles.navVisible : ''}`}
            title="Menu"
            onClick={onMenuClick}
          >
            <svg viewBox="0 0 24 18" fill="none">
              <path d="M2,3 C6,1 10,5 14,3 C18,1 22,4 22,3"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M2,9 C5,7 8,11 12,9 C16,7 20,11 22,9"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M2,15 C6,13 10,17 14,15 C18,13 22,16 22,15"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </nav>
    </div>
  );
}
