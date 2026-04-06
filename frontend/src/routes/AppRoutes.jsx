import { Routes, Route, Navigate } from 'react-router-dom';
import { useSelector }             from 'react-redux';

import Preloader      from '@/pages/Preloader/Preloader';
import Auth           from '@/pages/Auth/Auth';
import ResetPassword  from '@/pages/Auth/ResetPassword';
import Dashboard      from '@/pages/Dashboard/Dashboard';
import Statistics     from '@/pages/Statistics/Statistics';
import Insights       from '@/pages/Insights/Insights';
import Collection     from '@/pages/Collection/Collection';
import Notifications  from '@/pages/Notifications/Notifications';
import Profile        from '@/pages/Profile/Profile';
import Account        from '@/pages/Account/Account';
import ProtectedRoute from './ProtectedRoute';

export default function AppRoutes() {
  return (
    <Routes>
      {/* Reset link must match before "/" and "*" so deep links always open this screen */}
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/"              element={<Preloader />} />
      <Route path="/auth"               element={<Auth />} />
      <Route path="/auth/callback"      element={<Auth />} />
      <Route path="/auth/reset-password/:token" element={<ResetPassword />} />
      <Route path="/auth/reset-password" element={<ResetPassword />} />

      <Route path="/dashboard"       element={<Dashboard />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/statistics"    element={<Statistics />} />
        <Route path="/insights"      element={<Insights />} />
        <Route path="/collection"    element={<Collection />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile"       element={<Profile />} />
        <Route path="/account"       element={<Account />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}