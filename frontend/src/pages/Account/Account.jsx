import { useState, useEffect, useRef } from 'react';
import { useNavigate }                 from 'react-router-dom';
import { useDispatch, useSelector }    from 'react-redux';
import { logout }                      from '@/store/slices/authSlice';
import BackButton                      from '@/components/layout/BackButton/BackButton';
import SEO                             from '@/components/SEO/SEO';
import styles                          from './Account.module.css';

export default function Account() {
  const navigate  = useNavigate();
  const dispatch  = useDispatch();
  const canvasRef = useRef(null);

  const { user }  = useSelector(state => state.auth);

  // ═══ REVEAL ANIMATIONS ═══
  const [backShow, setBackShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBackShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  // ── Particle canvas (same as Auth) ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 35 }, () => ({
      x:  Math.random() * canvas.width,
      y:  Math.random() * canvas.height,
      r:  Math.random() * 3 + 1,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      o:  Math.random() * 0.4 + 0.1,
    }));

    let raf;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(116,185,255,${p.o})`;
        ctx.fill();
        p.x += p.dx;
        p.y += p.dy;
        if (p.x < 0 || p.x > canvas.width)  p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });
      raf = requestAnimationFrame(draw);
    }
    draw();

    const onResize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, []);

  // ── Sign-out handler ──
  function handleSignOut() {
    dispatch(logout());
    navigate('/auth', { replace: true });
  }

  // Derive display values
  const displayName  = user?.name  || 'User';
  const displayEmail = user?.email || 'No email available';

  // User initial for avatar
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className={styles.authBody}>
      <SEO
        title="Account"
        description="View and manage your Sipsip account details."
        path="/account"
      />
      {/* Blobs */}
      <div className={`${styles.bgBlob} ${styles.bgBlob1}`} />
      <div className={`${styles.bgBlob} ${styles.bgBlob2}`} />

      {/* Particles */}
      <canvas className={styles.particleCanvas} ref={canvasRef} />

      <div className={styles.authWrapper}>
        <div className={styles.authInner}>

          {/* Back to Dashboard */}
          <BackButton revealed={backShow} delay={100} />

          <div className={styles.authCard}>

            {/* Logo — same mark as tab favicon */}
            <div className={styles.logoWrap}>
              <img className={styles.logoMark} src="/favicon.svg" alt="" width="32" height="46" />
              <span className={styles.logoBrand}>Sipsip</span>
            </div>

            {/* Heading */}
            <div className={styles.authHeading}>
              <h1>Your Account 👤</h1>
              <p>Manage your profile and preferences</p>
            </div>

            {/* User info card */}
            <div className={styles.userInfoSection}>
              {/* Avatar */}
              <div className={styles.avatarWrap}>
                <div className={styles.avatar}>{initial}</div>
              </div>

              {/* Info rows */}
              <div className={styles.infoGroup}>
                <label className={styles.infoLabel}>Name</label>
                <div className={styles.infoValue}>{displayName}</div>
              </div>

              <div className={styles.infoGroup}>
                <label className={styles.infoLabel}>Email</label>
                <div className={styles.infoValue}>{displayEmail}</div>
              </div>
            </div>

            {/* Sign out */}
            <button className={styles.signOutBtn} onClick={handleSignOut}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              Sign Out
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}
