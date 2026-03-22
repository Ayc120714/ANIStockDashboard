import React from 'react';
import { Navigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';

function AdminRoute({ children }) {
  const { isAuthenticated, isSuperAdmin } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AdminRoute;
