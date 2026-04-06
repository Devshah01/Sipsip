import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { resetPasswordWithToken } from '@/services/authService';
import BackButton from '@/components/layout/BackButton/BackButton';
import SEO from '@/components/SEO/SEO';
import styles from './Auth.module.css';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { token: tokenFromPath } = useParams();
  const [searchParams] = useSearchParams();
  const canvasRef = useRef(null);
  const [backShow, setBackShow] = useState(false);

  const rawToken = (tokenFromPath || searchParams.get('token') || '').trim();
  let token = rawToken;
  try {
    if (rawToken) token = decodeURIComponent(rawToken);
  } catch {
    token = rawToken;
  }
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBackShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 35 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 3 + 1,
      dx: (Math.random() - 0.5) * 0.4,
      dy: (Math.random() - 0.5) * 0.4,
      o: Math.random() * 0.4 + 0.1,
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
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
      });
      raf = requestAnimationFrame(draw);
    }
    draw();

    const onResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  async function handleSubmit() {
    setError('');
    if (!token) {
      setError('This reset link is invalid. Request a new one from Sign In.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await resetPasswordWithToken(token, password);
      setDone(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <div className={styles.authBody}>
      <SEO
        title="Reset Password"
        description="Reset your Sipsip account password securely."
        path="/reset-password"
      />
      <div className={`${styles.bgBlob} ${styles.bgBlob1}`} />
      <div className={`${styles.bgBlob} ${styles.bgBlob2}`} />
      <canvas className={styles.particleCanvas} ref={canvasRef} />

      <div className={styles.authWrapper}>
        <div className={styles.authInner}>
          <BackButton revealed={backShow} delay={100} />

          <div className={styles.authCard}>
            <div className={styles.logoWrap}>
              <img className={styles.logoMark} src="/favicon.svg" alt="" width="32" height="46" />
              <span className={styles.logoBrand}>Sipsip</span>
            </div>

            <div className={styles.authHeading}>
              <h1>Set new password</h1>
              <p>Choose a strong password for your account</p>
            </div>

            {!token && (
              <div className={styles.forgotErrorMsg}>
                This reset link is missing a token. Open the link from your email or request a new reset from Sign
                In.
              </div>
            )}

            {done ? (
              <div className={styles.forgotSuccess}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
                Password updated. You can sign in now.
              </div>
            ) : (
              <>
                {error && <div className={styles.forgotErrorMsg}>{error}</div>}

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>New password</label>
                  <div className={styles.inputWrap}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoComplete="new-password"
                      disabled={!token}
                      style={{ paddingRight: '44px' }}
                    />
                    <button className={styles.pwToggle} type="button" onClick={() => setShowPw(!showPw)}>
                      {showPw ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.inputLabel}>Confirm password</label>
                  <div className={styles.inputWrap}>
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      onKeyDown={handleKeyDown}
                      autoComplete="new-password"
                      disabled={!token}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.submitBtn}
                  onClick={handleSubmit}
                  disabled={loading || !token}
                >
                  {loading ? (
                    <>
                      <div className={styles.spinnerRing} /> Please wait...
                    </>
                  ) : (
                    'Update password'
                  )}
                </button>
              </>
            )}

            <button type="button" className={styles.forgotBackLink} onClick={() => navigate('/auth')}>
              ← Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
