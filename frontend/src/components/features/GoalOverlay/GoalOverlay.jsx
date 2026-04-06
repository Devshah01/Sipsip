import styles from './GoalOverlay.module.css';

export default function GoalOverlay({ show, onClose }) {
  if (!show) return null;

  const colors = ['#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#1d4ed8'];
  const dots   = Array.from({ length: 60 }, (_, i) => ({
    id:   i,
    size: 6 + Math.random() * 10,
    left: Math.random() * 100,
    color: colors[Math.floor(Math.random() * colors.length)],
    duration: 2 + Math.random() * 2,
    delay:    Math.random() * 1.5,
  }));

  return (
    <div className={`${styles.overlay} ${show ? styles.show : ''}`}>
      <div className={styles.goalBg}/>
      <div className={styles.confettiWrap}>
        {dots.map(d => (
          <div key={d.id} className={styles.cDot} style={{
            width:             d.size + 'px',
            height:            d.size + 'px',
            left:              d.left + 'vw',
            top:               '-20px',
            background:        d.color,
            animationDuration: d.duration + 's',
            animationDelay:    d.delay + 's',
          }}/>
        ))}
      </div>
      <div className={styles.goalInner}>
        <div className={styles.goalEmoji}>💧</div>
        <div className={styles.goalTitle}>Goal Reached!</div>
        <div className={styles.goalSub}>
          You've hit your daily target. Amazing!
        </div>
        <button className={styles.goalClose} onClick={onClose}>
          Keep Going 🎉
        </button>
      </div>
    </div>
  );
}