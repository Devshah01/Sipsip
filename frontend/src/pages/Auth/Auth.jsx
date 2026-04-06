import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation }    from 'react-router-dom';
import { useDispatch, useSelector }    from 'react-redux';
import { setCredentials, setError, setLoading } from '@/store/slices/authSlice';
import { loginUser, registerUser, forgotPassword, getCurrentUser } from '@/services/authService';
import BackButton                     from '@/components/layout/BackButton/BackButton';
import SEO                             from '@/components/SEO/SEO';
import styles                          from './Auth.module.css';

export default function Auth() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const dispatch  = useDispatch();
  const canvasRef = useRef(null);

  // ═══ REVEAL ANIMATIONS ═══
  const [backShow, setBackShow] = useState(false);

  const { isLoading, error, token } = useSelector(state => state.auth);
  const isLoggedIn = !!token;

  // ── Tab state ──
  const [tab, setTab] = useState('login');  // 'login' | 'signup'

  // ── Form state ──
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showPw,   setShowPw]   = useState(false);

  // ── Forgot password state ──
  const [forgotMode,    setForgotMode]    = useState(false);
  const [forgotEmail,   setForgotEmail]   = useState('');
  const [forgotMsg,     setForgotMsg]     = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError,   setForgotError]   = useState('');

  // ── Validation errors ──
  const [errors, setErrors] = useState({});

  // ── Handle Google OAuth callback ──
  useEffect(() => {
    const t = setTimeout(() => setBackShow(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    // Only treat ?token= as Google OAuth JWT on the callback URL — not on /auth (login)
    if (location.pathname !== '/auth/callback') return;

    const params = new URLSearchParams(location.search);
    const token  = params.get('token');
    const err    = params.get('error');

    if (token) {
      let cancelled = false;
      (async () => {
        try {
          localStorage.setItem('sipsip_token', token);
          const data = await getCurrentUser();
          if (cancelled) return;
          dispatch(setCredentials({ token, user: data.user }));
          navigate('/dashboard', { replace: true });
        } catch {
          localStorage.removeItem('sipsip_token');
          localStorage.removeItem('sipsip_user');
          if (!cancelled) dispatch(setError('Google login failed'));
        }
      })();
      return () => { cancelled = true; };
    }

    if (err) {
      dispatch(setError('Google login failed. Please try again.'));
    }
  }, [location, dispatch, navigate]);

  // ── Particle canvas ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 35 }, () => ({
      x:    Math.random() * canvas.width,
      y:    Math.random() * canvas.height,
      r:    Math.random() * 3 + 1,
      dx:   (Math.random() - 0.5) * 0.4,
      dy:   (Math.random() - 0.5) * 0.4,
      o:    Math.random() * 0.4 + 0.1,
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

  // ── Switch tab ──
  function switchTab(t) {
    setTab(t);
    setErrors({});
    dispatch(setError(null));
    // Reset forgot password state when switching tabs
    setForgotMode(false);
    setForgotMsg('');
    setForgotError('');
  }

  // ── Validate ──
  function validate() {
    const e = {};
    if (tab === 'signup' && !name.trim())
      e.name = 'Name is required';
    if (!email.trim() || !/^\S+@\S+\.\S+$/.test(email))
      e.email = 'Enter a valid email';
    if (password.length < 6)
      e.password = 'Password must be at least 6 characters';
    if (tab === 'signup' && password !== confirm)
      e.confirm = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  // ── Submit ──
  async function handleSubmit() {
    if (!validate()) return;
    dispatch(setLoading(true));
    dispatch(setError(null));

    try {
      let data;
      if (tab === 'login') {
        data = await loginUser(email, password);
      } else {
        data = await registerUser(name, email, password);
      }
      dispatch(setCredentials({ token: data.token, user: data.user }));
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong';
      dispatch(setError(msg));
    } finally {
      dispatch(setLoading(false));
    }
  }

  // ── Google login ──
  function handleGoogle() {
    const backendUrl = import.meta.env.VITE_API_URL || '/api';
    // Strip trailing /api if present to get the base backend URL
    const baseUrl = backendUrl.replace(/\/api\/?$/, '');
    window.location.href = `${baseUrl}/api/auth/google`;
  }

  // ── Enter key submit ──
  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      if (forgotMode) handleForgotSubmit();
      else handleSubmit();
    }
  }

  // ── Forgot password submit ──
  async function handleForgotSubmit() {
    const addr = (forgotEmail || email).trim();
    if (!addr || !/^\S+@\S+\.\S+$/.test(addr)) {
      setForgotError('Please enter a valid email address');
      return;
    }
    setForgotLoading(true);
    setForgotError('');
    setForgotMsg('');
    try {
      const data = await forgotPassword(addr);
      setForgotMsg(data.message || 'If that email exists, a reset link has been sent.');
    } catch (err) {
      setForgotError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div className={styles.authBody}>
      <SEO
        title="Sign In"
        description="Sign in or create an account to track your daily hydration with Sipsip."
        path="/auth"
      />
      {/* Blobs */}
      <div className={`${styles.bgBlob} ${styles.bgBlob1}`} />
      <div className={`${styles.bgBlob} ${styles.bgBlob2}`} />

      {/* Particles */}
      <canvas className={styles.particleCanvas} ref={canvasRef} />

      <div className={styles.authWrapper}>
        <div className={styles.authInner}>

          {/* Back to Dashboard — left aligned above card */}
          <BackButton revealed={backShow} delay={100} />

          <div className={styles.authCard}>

            {/* Logo — same mark as tab favicon */}
            <div className={styles.logoWrap}>
              <img className={styles.logoMark} src="/favicon.svg" alt="" width="32" height="46" />
              <span className={styles.logoBrand}>Sipsip</span>
            </div>

            {/* Heading */}
            <div className={styles.authHeading}>
              <h1>{tab === 'login' ? 'Welcome back 👋' : 'Create account 🚀'}</h1>
              <p>{tab === 'login'
                ? 'Sign in to track your daily hydration'
                : 'Start your hydration journey today'}
              </p>
            </div>

            {/* Tabs */}
            <div className={styles.authTabs}>
              <button
                className={`${styles.tabBtn} ${tab === 'login' ? styles.active : ''}`}
                onClick={() => switchTab('login')}>
                Sign In
              </button>
              <button
                className={`${styles.tabBtn} ${tab === 'signup' ? styles.active : ''}`}
                onClick={() => switchTab('signup')}>
                <span className={styles.tabCreate}>Create</span>
                <span className={styles.tabAccount}> Account</span>
              </button>
            </div>

            {/* Global error */}
            {error && (
              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '10px', padding: '10px 14px',
                fontSize: '13px', color: '#dc2626', marginBottom: '14px'
              }}>
                {error}
              </div>
            )}

            {/* Name — signup only */}
            {tab === 'signup' && (
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Full Name</label>
                <div className={`${styles.inputWrap} ${errors.name ? styles.error : ''}`}>
                  <input
                    type="text"
                    placeholder="Alex Johnson"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="name"
                  />
                </div>
                {errors.name && (
                  <span className={`${styles.inputError} ${styles.show}`}>
                    {errors.name}
                  </span>
                )}
              </div>
            )}

            {/* Email */}
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Email</label>
              <div className={`${styles.inputWrap} ${errors.email ? styles.error : ''}`}>
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <span className={`${styles.inputError} ${styles.show}`}>
                  {errors.email}
                </span>
              )}
            </div>

            {/* Password */}
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Password</label>
              <div className={`${styles.inputWrap} ${errors.password ? styles.error : ''}`}>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                  style={{ paddingRight: '44px' }}
                />
                <button
                  className={styles.pwToggle}
                  type="button"
                  onClick={() => setShowPw(!showPw)}>
                  {showPw ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
              {errors.password && (
                <span className={`${styles.inputError} ${styles.show}`}>
                  {errors.password}
                </span>
              )}
            </div>

            {/* Confirm password — signup only */}
            {tab === 'signup' && (
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Confirm Password</label>
                <div className={`${styles.inputWrap} ${errors.confirm ? styles.error : ''}`}>
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="new-password"
                  />
                </div>
                {errors.confirm && (
                  <span className={`${styles.inputError} ${styles.show}`}>
                    {errors.confirm}
                  </span>
                )}
              </div>
            )}

            {/* Forgot password — login only */}
            {tab === 'login' && !forgotMode && (
              <div className={styles.forgotRow}>
                <button
                  type="button"
                  className={styles.forgotLink}
                  onClick={(e) => {
                    e.preventDefault();
                    setForgotMode(true);
                    setForgotEmail(email.trim());
                    setForgotMsg('');
                    setForgotError('');
                  }}
                >
                  Forgot password?
                </button>
              </div>
            )}

            {/* Forgot password form */}
            {forgotMode && (
              <div className={styles.forgotPanel}>
                <div className={styles.forgotPanelTitle}>Reset Password</div>
                <p className={styles.forgotPanelDesc}>
                  Enter your email and we'll send you a password reset link.
                </p>

                {forgotMsg && (
                  <div className={styles.forgotSuccess}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    {forgotMsg}
                  </div>
                )}
                {forgotError && (
                  <div className={styles.forgotErrorMsg}>{forgotError}</div>
                )}

                {!forgotMsg && (
                  <>
                    <div className={styles.inputGroup} style={{ animationDelay: '0s' }}>
                      <div className={styles.inputWrap}>
                        <input
                          type="email"
                          placeholder="you@example.com"
                          value={forgotEmail}
                          onChange={e => setForgotEmail(e.target.value)}
                          onKeyDown={handleKeyDown}
                          autoComplete="email"
                          autoFocus
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className={styles.submitBtn}
                      style={{ animationDelay: '0s' }}
                      onClick={handleForgotSubmit}
                      disabled={forgotLoading}
                    >
                      {forgotLoading ? (
                        <><div className={styles.spinnerRing} /> Sending...</>
                      ) : (
                        'Send Reset Link'
                      )}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className={styles.forgotBackLink}
                  onClick={() => { setForgotMode(false); setForgotMsg(''); setForgotError(''); }}
                >
                  ← Back to Sign In
                </button>
              </div>
            )}

            {/* Submit — hidden in forgot mode */}
            {!forgotMode && (
              <button
                className={styles.submitBtn}
                onClick={handleSubmit}
                disabled={isLoading}>
                {isLoading ? (
                  <><div className={styles.spinnerRing} /> Please wait...</>
                ) : (
                  tab === 'login' ? 'Sign In' : 'Create Account'
                )}
              </button>
            )}

            {/* Divider + Social — hidden in forgot mode */}
            {!forgotMode && (
              <>
                <div className={styles.authDivider}>or</div>

                <div className={styles.socialRow}>
                  <button className={styles.socialBtn} onClick={handleGoogle}>
                    <svg width="18" height="18" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </button>
                </div>
              </>
            )}

            {/* (Sign out removed from Auth page as requested) */}

          </div>
        </div>
      </div>
    </div>
  );
}
