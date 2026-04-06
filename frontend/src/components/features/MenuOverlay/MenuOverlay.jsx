import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import styles from './MenuOverlay.module.css';

/* ── Menu items (exact order from original, Profile first) ── */
const MENU_ITEMS = [
  {
    id: 'profile',
    label: 'Profile',
    route: '/profile',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
  },
  {
    id: 'statistics',
    label: 'Statistics',
    route: '/statistics',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
  {
    id: 'collection',
    label: 'Collection',
    route: '/collection',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  },
  {
    id: 'insights',
    label: 'Insights',
    route: '/insights',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21h6"/><path d="M12 3a6 6 0 0 1 6 6c0 2.5-1.5 4.5-3 6H9c-1.5-1.5-3-3.5-3-6a6 6 0 0 1 6-6z"/></svg>,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    route: '/notifications',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  },
];

export default function MenuOverlay({ isOpen, onClose }) {
  const navigate = useNavigate();
  const isDark   = useSelector(s => s.ui?.theme) === 'dark';

  const [menuShow,   setMenuShow]   = useState(false);
  const [rowsReady,  setRowsReady]  = useState([]);
  const [charLabels, setCharLabels] = useState({});
  const rowTimers = useRef([]);

  useEffect(() => {
    if (isOpen) {
      openMenu();
    } else {
      closeMenu();
    }
    return () => rowTimers.current.forEach(clearTimeout);
  }, [isOpen]);

  function openMenu() {
    setMenuShow(true);
    setRowsReady([]);
    setCharLabels({});
    rowTimers.current.forEach(clearTimeout);
    const ROW_START = 380, ROW_GAP = 90, CHAR_DELAY_TRIGGER = 20;
    rowTimers.current = MENU_ITEMS.map((_, ri) =>
      setTimeout(() => {
        setRowsReady(prev => [...prev, ri]);
        setTimeout(() => setCharLabels(prev => ({ ...prev, [ri]: true })), CHAR_DELAY_TRIGGER);
      }, ROW_START + ri * ROW_GAP)
    );
  }

  function closeMenu() {
    setMenuShow(false);
    setRowsReady([]);
    setCharLabels({});
    rowTimers.current.forEach(clearTimeout);
  }

  function handleRowClick(route) {
    onClose();
    setTimeout(() => navigate(route), 180); // let menu close first
  }

  return (
    <>
      {/* Blur backdrop */}
      <div
        className={`${styles.backdrop} ${isOpen ? styles.backdropShow : ''} ${isDark ? styles.backdropDark : ''}`}
        onClick={onClose}
      />

      {/* Floating menu card */}
      <div className={`${styles.menuCard} ${menuShow ? styles.menuCardShow : ''} ${isDark ? styles.menuCardDark : ''}`}>

        {/* Close X */}
        <button className={`${styles.cardClose} ${isDark ? styles.cardCloseDark : ''}`} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Menu rows */}
        {MENU_ITEMS.map((item, ri) => {
          const visible    = rowsReady.includes(ri);
          const charsBuilt = charLabels[ri];
          const CHAR_DELAY = 38;

          return (
            <button
              key={item.id}
              className={`${styles.menuRow} ${isDark ? styles.menuRowDark : ''}`}
              style={{ opacity: visible ? 1 : 0 }}
              onClick={() => handleRowClick(item.route)}
            >
              <div className={styles.menuRowInner}>
                <div className={styles.menuRowIcon}>{item.icon}</div>
                <span className={`${styles.menuRowLabel} ${isDark ? styles.menuRowLabelDark : ''}`}>
                  {charsBuilt
                    ? item.label.split('').map((ch, ci) => (
                        <span key={ci} className={styles.ch}
                          style={{
                            opacity: 0,
                            transform: 'translateY(6px)',
                            transitionDelay: `${ci * CHAR_DELAY}ms`,
                            // Force reflow then animate via ref trick — we set visible in next frame
                          }}
                          ref={el => {
                            if (el) requestAnimationFrame(() => {
                              el.style.opacity = '1';
                              el.style.transform = 'translateY(0)';
                            });
                          }}
                        >
                          {ch === ' ' ? '\u00a0' : ch}
                        </span>
                      ))
                    : item.label
                  }
                </span>
                <svg className={styles.menuRowArrow} viewBox="0 0 24 24" fill="none"
                  stroke={isDark ? '#74b9ff' : '#2563eb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
}
