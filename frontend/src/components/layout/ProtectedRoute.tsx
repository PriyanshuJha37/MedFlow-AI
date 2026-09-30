import React, { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    if (user.role === 'phc_staff') {
      return <Navigate to="/staff/dashboard" replace />;
    }
    if (user.role === 'admin') {
      return <Navigate to="/admin/overview" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export const RoleRedirect: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role === 'phc_staff') {
    return <Navigate to="/staff/dashboard" replace />;
  }

  if (user.role === 'admin') {
    return <Navigate to="/admin/overview" replace />;
  }

  return <Navigate to="/login" replace />;
};
