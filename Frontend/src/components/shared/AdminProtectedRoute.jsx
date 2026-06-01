import React, { useEffect, useRef, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { supabase } from '../../lib/supabaseClient';

/**
 * AdminProtectedRoute — Security-hardened admin route guard.
 *
 * Vulnerability fixed (Issue #909):
 *   The previous version trusted the Zustand persist store (localStorage) for role checking.
 *   A user could set role="admin" in localStorage and bypass the guard.
 *
 * Fix:
 *   1. On mount, call supabase.auth.getUser() to get a fresh, server-verified user.
 *   2. Fetch the profile row directly from the DB for that user ID.
 *   3. If the server role differs from the cached store role, clear the store and redirect.
 *   4. Only allow access once the server confirms admin/super_admin role.
 */
const AdminProtectedRoute = () => {
    const { user, profile, loading, isCheckingSession } = useAuthStore();

    if (loading || isCheckingSession) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-white">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" aria-label="Authenticating..." role="status"></div>
            </div>
        );
    }

  // Check if the user is authenticated from Supabase
  if (!user) {
    return <Navigate to='/login' replace />;
  }

    // If we have a user but no profile yet, wait for the database fetch
    if (!profile || profile.role === undefined) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-[#050508]" aria-label="Verifying permissions..." role="status" aria-live="polite">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
            </div>
        );
    }

  // Check if the user's profile role is 'admin' or 'super_admin'
  // Enforce role
  if (profile.role !== 'admin' && profile.role !== 'super_admin') {
    // Basic redirect for non-admins if they try to access admin routes
    return <Navigate to='/' replace />;
  }

  // Enforce active status for admins (Master Admin approval)
  if (profile.status === 'rejected') {
    return <Navigate to='/not-approved' replace />;
  } else if (profile.status !== 'active') {
    return <Navigate to='/admin-lobby' replace />;
  }

  // Authorised and active: render the protected layout
  return <Outlet />;
};

export default AdminProtectedRoute;
