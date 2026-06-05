import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import useAuthStore from '../../store/authStore';

/**
 * ProtectedRoute Component
 * Restricts access to routes to only authenticated users.
 * Redirects to the login page if not authenticated.
 */
const ProtectedRoute = () => {
    const { user, profile, loading, isCheckingSession } = useAuthStore();
    const location = useLocation();

    if (loading || isCheckingSession) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-white">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to='/login' replace />;
    }

    if (!profile || profile.role === undefined) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
            </div>
        );
    }

    if (
      profile.role === 'admin' &&
      profile.status === 'active' &&
      !location.pathname.startsWith('/admin')
    ) {
      return <Navigate to='/admin/dashboard' replace />;
    }

    if (
      profile.role === 'user' &&
      profile.status !== 'active' &&
      !location.pathname.startsWith('/user-lobby')
    ) {
      return <Navigate to='/user-lobby' replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
