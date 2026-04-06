import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MenuDrawer.module.css';

const MENU_ITEMS = [
  {
    id: 'profile',
    label: 'Profile',
    route: '/profile',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="8" r="4"/>
        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
      </svg>
    ),
  },
  {
    id: 'statistics',
    label: 'Statistics',
    route: '/statistics',
    icon: (
      <svg viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'collection',
    label: 'Collection',
    route: '/collection',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    ),
  },
  {
    id: 'insights',
    label: 'Insights',
    route: '/insights',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M9 21h6"/>
        <path d="M12 3a6 6 0 0 1 6 6c0 2.5-1.5 4.5-3 6H9c-1.5-1.5-3-3.5-3-6a6 6 0 0 1 6-6z"/>
      </svg>
    ),
  },
  {
    id: 'notifications',
    label: 'Notifications',
    route: '/notifications',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    ),
  },
];

const CHAR_DELAY = 38; // ms between each character
const ROW_START  = 380; // after card is fully open
const ROW_GAP    = 90;  // ms between rows

export default function MenuDrawer({ isOpen, onClose }) {
  const navigate = useNavigate();
  const [visibleRows, setVisibleRows] = useState([]);
  const [charVisible, setCharVisible] = useState([]); // array of arrays
  const timersRef = useRef([]);

  // Clear all timers helper
  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    if (isOpen) {
      // Reset first
      setVisibleRows([]);
      setCharVisible(MENU_ITEMS.map(() => []));

      // Stagger rows in after card opens
      MENU_ITEMS.forEach((item, ri) => {
        const rowDelay = ROW_START + ri * ROW_GAP;

        const t1 = setTimeout(() => {
          setVisibleRows(prev => [...prev, ri]);

          // Then reveal chars one by one
          const text = item.label;
          text.split('').forEach((_, ci) => {
            const t2 = setTimeout(() => {
              setCharVisible(prev => {
                const next = prev.map(arr => [...arr]);
                if (!next[ri]) next[ri] = [];
                next[ri] = [...next[ri], ci];
                return next;
              });
            }, ci * CHAR_DELAY);
            timersRef.current.push(t2);
          });
        }, rowDelay);

        timersRef.current.push(t1);
      });
    } else {
      clearTimers();
      setVisibleRows([]);
      setCharVisible(MENU_ITEMS.map(() => []));
    }

    return clearTimers;
  }, [isOpen]);

  const handleNavigate = (route) => {
    onClose();
    navigate(route);
  };

  return (
    <>
      {/* Blur backdrop */}
      <div
        className={`${styles.backdrop} ${isOpen ? styles.show : ''}`}
        onClick={onClose}
      />

      {/* Floating menu card */}
      <div className={`${styles.menuCard} ${isOpen ? styles.show : ''}`}>
        {/* Close button */}
        <button className={styles.cardClose} onClick={onClose}>
          <svg viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* Menu rows */}
        {MENU_ITEMS.map((item, ri) => {
          const isVisible   = visibleRows.includes(ri);
          const visibleChars = charVisible[ri] || [];
          const chars        = item.label.split('');

          return (
            <button
              key={item.id}
              className={`${styles.menuRow} ${isVisible ? styles.visible : ''}`}
              onClick={() => handleNavigate(item.route)}
            >
              <div className={styles.menuRowInner}>
                <div className={styles.menuRowIcon}>{item.icon}</div>

                <span className={styles.menuRowLabel}>
                  {isVisible
                    ? chars.map((ch, ci) => (
                        <span
                          key={ci}
                          className={styles.ch}
                          style={{
                            opacity:          visibleChars.includes(ci) ? 1 : 0,
                            transform:        visibleChars.includes(ci) ? 'translateY(0)' : 'translateY(6px)',
                            transitionDelay:  `0ms`,
                          }}
                        >
                          {ch === ' ' ? '\u00A0' : ch}
                        </span>
                      ))
                    : item.label}
                </span>

                <svg
                  className={styles.menuRowArrow}
                  viewBox="0 0 24 24"
                >
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
