import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProfile } from '@/store/slices/profileSlice';
import { fetchVesselSettings } from '@/store/slices/collectionSlice';

function ProfileBootstrap() {
  const dispatch = useDispatch();
  const token = useSelector(s => s.auth.token);
  useEffect(() => {
    if (token) {
      dispatch(fetchProfile()).then(() => dispatch(fetchVesselSettings()));
    }
  }, [token, dispatch]);
  return null;
}

export default function ProtectedRoute() {
  const token = useSelector(state => state.auth.token);
  return token ? (
    <>
      <ProfileBootstrap />
      <Outlet />
    </>
  ) : (
    <Navigate to="/auth" replace />
  );
}