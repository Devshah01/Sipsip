import { useEffect }     from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import AppRoutes         from '@/routes/AppRoutes';
import GlobalPushToast   from '@/components/GlobalPushToast/GlobalPushToast';
import { fetchVesselSettings } from '@/store/slices/collectionSlice';
import { setCredentials } from '@/store/slices/authSlice';
import { getCurrentUser } from '@/services/authService';

function AppInner() {
  const theme    = useSelector(state => state.ui.theme);
  const token    = useSelector(state => state.auth?.token);
  const dispatch = useDispatch();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'dark') document.body.classList.add('dark');
    else                  document.body.classList.remove('dark');
  }, [theme]);

  // Restore vessel selection on every app load so the selected
  // glass/jar persists across refreshes and navigation.
  // Only fetch from server when user is logged in (endpoint requires auth).
  useEffect(() => {
    if (token) {
      dispatch(fetchVesselSettings());
    }
  }, [dispatch, token]);

  // Fix stale Redux/localStorage from older Google login (empty name/email).
  useEffect(() => {
    if (!token) return;
    const raw = localStorage.getItem('sipsip_user');
    if (!raw) return;
    let u;
    try {
      u = JSON.parse(raw);
    } catch {
      return;
    }
    if (!u?._id || u.email) return;

    let cancelled = false;
    (async () => {
      try {
        const data = await getCurrentUser();
        if (!cancelled && data?.user?.email) {
          dispatch(setCredentials({ token, user: data.user }));
        }
      } catch {
        /* keep existing state */
      }
    })();
    return () => { cancelled = true; };
  }, [token, dispatch]);

  return (
    <>
      <GlobalPushToast />
      <AppRoutes />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}