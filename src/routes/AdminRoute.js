import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';

/**
 * @param {'super' | 'admin'} level
 *   - super: is_super_admin (default; telegram-admin, admin-users, next-week-setup)
 *   - admin: is_admin or configured admin emails (algo-performance)
 */
function AdminRoute({ children, level = 'super' }) {
  const { isAuthenticated, isSuperAdmin, isAdmin } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const allowed = level === 'admin' ? isAdmin : isSuperAdmin;
  if (!allowed) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AdminRoute;
