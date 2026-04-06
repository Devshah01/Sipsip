import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/layout/Navbar/Navbar';
import MenuDrawer from '@/components/layout/MenuDrawer/MenuDrawer';
import BackButton from '@/components/layout/BackButton/BackButton';
import SEO from '@/components/SEO/SEO';
import styles from './Insights.module.css';

// ─── Insight Data ──────────────────────────────────────────────────────────────
const INSIGHTS = [
  {
    id: 'card0',
    icon: '🧠',
    title: 'Dehydration impairs cognitive performance',
    body: 'Even mild dehydration of 1–2% body weight loss can impair attention, memory, and psychomotor performance. Staying hydrated keeps your brain firing at full capacity.',
    tag: 'Brain',
  },
  {
    id: 'card1',
    icon: '💪',
    title: 'Muscles need water to function optimally',
    body: 'Water is essential for muscle contraction, nutrient delivery, and removing metabolic waste. Drink 500ml 2 hours before exercise and replace fluids consistently during activity.',
    tag: 'Performance',
  },
  {
    id: 'card2',
    icon: '✨',
    title: 'Hydration visibly improves skin health',
    body: 'Adequate water intake maintains skin elasticity and reduces fine lines. The skin is 64% water — keeping it hydrated from within gives a natural, healthy glow.',
    tag: 'Skin',
  },
  {
    id: 'card3',
    icon: '🔋',
    title: 'Fatigue is often just thirst in disguise',
    body: 'The mid-afternoon slump is frequently a sign of mild dehydration. Blood thickens slightly, making the heart work harder. A glass of water can restore energy in minutes.',
    tag: 'Energy',
  },
  {
    id: 'card4',
    icon: '🫀',
    title: 'Hydration protects heart health',
    body: 'Drinking enough water helps the heart pump blood more efficiently. Adults who stay well-hydrated have a meaningfully lower risk of developing heart failure over the long term.',
    tag: 'Heart',
  },
];

// ─── Insights Page ─────────────────────────────────────────────────────────────
export default function Insights() {
  const dispatch    = useDispatch();
  const navigate    = useNavigate();
  const cardRefs    = useRef([]);

  // ═══ REVEAL ANIMATIONS ═══
  const [backShow, setBackShow] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Stagger cards in after mount
  useEffect(() => {
    const t = setTimeout(() => setBackShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    cardRefs.current.forEach((el, i) => {
      setTimeout(() => el?.classList.add(styles.visible), 300 + i * 80);
    });
  }, []);

  return (
    <>
      <SEO
        title="Insights"
        description="Science-backed hydration knowledge to help you understand why staying hydrated matters."
        path="/insights"
      />
      <Navbar
        animateIn={true}
        onMenuClick={() => setMenuOpen(true)}
      />
      <MenuDrawer
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
      />

      <div className={styles.mainContent}>
        <div className={styles.subPage}>

          {/* Back button */}
          <BackButton revealed={backShow} delay={100} />

          {/* Page header */}
          <div className={styles.pageTitle}>Insights</div>
          <div className={styles.pageSub}>Science-backed hydration knowledge</div>

          {/* Insight cards */}
          {INSIGHTS.map((insight, i) => (
            <div
              key={insight.id}
              className={styles.insightCard}
              ref={(el) => (cardRefs.current[i] = el)}
            >
              <div className={styles.insightIconWrap}>{insight.icon}</div>
              <div className={styles.insightContent}>
                <div className={styles.insightTitle}>{insight.title}</div>
                <div className={styles.insightBody}>{insight.body}</div>
                <span className={styles.insightTag}>{insight.tag}</span>
              </div>
            </div>
          ))}

        </div>
      </div>
    </>
  );
}
