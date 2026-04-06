import { useSelector } from 'react-redux';
import styles          from './DrinkReport.module.css';

const CIRCUMFERENCE = 2 * Math.PI * 55;

export default function DrinkReport({ overview, statsBarRef }) {
  const isDark  = useSelector(s => s.ui.theme) === 'dark';

  const today   = overview?.today   || {};
  const weekly  = overview?.weekly  || {};
  const goalPct = today.goalPct     || 0;
  const offset  = CIRCUMFERENCE - (goalPct / 100) * CIRCUMFERENCE;

  const fmt = n => n >= 1000 ? (n/1000).toFixed(1)+'L' : n+'ml';

  return (
    <div
      ref={statsBarRef}
      className={`${styles.statsBar} ${isDark ? styles.dark : ''}`}
    >
      {/* ── Ring ── */}
      <div className={styles.drRingSection}>
        <div className={styles.drRingContainer}>
          <svg className={styles.drRingSvg} viewBox="0 0 140 140">
            <defs>
              <linearGradient id="drRingGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#93c5fd"/>
                <stop offset="100%" stopColor="#2563eb"/>
              </linearGradient>
            </defs>
            <circle className={styles.drRingTrack} cx="70" cy="70" r="55"/>
            <circle
              className={styles.drRingFill}
              cx="70" cy="70" r="55"
              style={{ strokeDashoffset: offset }}
            />
          </svg>
          <div className={styles.drRingInner}>
            <div className={styles.drRingEmoji}>💧</div>
            <div className={styles.drRingPct}>{goalPct}%</div>
            <div className={styles.drRingMl}>{today.totalMl || 0} ml</div>
          </div>
        </div>
        <div className={styles.drRingInfo}>
          <div className={styles.drRingGoal}>Goal: {fmt(today.goalMl || 2000)}</div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className={styles.drDivider}/>

      {/* ── Stat cards ── */}
      <div className={styles.drGrid}>

        <div className={`${styles.drCard} ${isDark ? styles.darkCard : ''}`}>
          <div className={styles.drCardTop}>
            <div className={`${styles.drIcon} ${styles.iconBlue}`}>💧</div>
            <div className={`${styles.drBadge} ${styles.badgeBlue}`}>TODAY</div>
          </div>
          <div className={styles.drLabel}>Goal Progress</div>
          <div className={styles.drValue}>{goalPct}%</div>
          <div className={`${styles.drSub} ${styles.blue}`}>of {fmt(today.goalMl || 2000)}</div>
        </div>

        <div className={`${styles.drCard} ${isDark ? styles.darkCard : ''}`}>
          <div className={styles.drCardTop}>
            <div className={`${styles.drIcon} ${styles.iconPurple}`}>📈</div>
            <div className={`${styles.drBadge} ${styles.badgePurple}`}>WEEK</div>
          </div>
          <div className={styles.drLabel}>Weekly Avg</div>
          <div className={styles.drValue}>{fmt(weekly.avg || 0)}</div>
          <div className={`${styles.drSub} ${styles.purple}`}>ml / day</div>
        </div>

        <div className={`${styles.drCard} ${isDark ? styles.darkCard : ''}`}>
          <div className={styles.drCardTop}>
            <div className={`${styles.drIcon} ${styles.iconGreen}`}>🏆</div>
            <div className={`${styles.drBadge} ${styles.badgeGreen}`}>7 DAYS</div>
          </div>
          <div className={styles.drLabel}>Goals Reached</div>
          <div className={styles.drValue}>{weekly.goalsHit || 0}</div>
          <div className={`${styles.drSub} ${styles.green}`}>this week</div>
        </div>

        <div className={`${styles.drCard} ${isDark ? styles.darkCard : ''}`}>
          <div className={styles.drCardTop}>
            <div className={`${styles.drIcon} ${styles.iconOrange}`}>⚡</div>
            <div className={`${styles.drBadge} ${styles.badgeOrange}`}>AVG</div>
          </div>
          <div className={styles.drLabel}>Avg Frequency</div>
          <div className={styles.drValue}>{overview?.avgFrequency || 0}</div>
          <div className={`${styles.drSub} ${styles.orange}`}>sips / day</div>
        </div>

      </div>
    </div>
  );
}
