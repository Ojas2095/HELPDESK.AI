import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import useAuthStore from '../../store/authStore';

/**
 * ProtectedRoute Component
 * Restricts access to routes to only authenticated users.
 * Redirects to the login page if not authenticated.
 */
const ProtectedRoute = () => {
    const { user, profile, loading, getCurrentUser } = useAuthStore();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkSession = async () => {
            // Re-verify the session via Supabase
            const { data: { session } } = await supabase.auth.getSession();

            if (!session) {
                setIsChecking(false);
                return;
            }

            // If session exists, sync the store
            if (!user) {
                await getCurrentUser();
            }
            setIsChecking(false);
        };

        checkSession();
    }, [user, getCurrentUser]);

    // High-fidelity dark loading state
    if (loading || isChecking) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-slate-950">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    const currentPath = window.location.pathname;

    // Role-based routing enforcement
    if (profile) {
        if (profile.role === 'master_admin' && !currentPath.startsWith('/master-admin')) {
            return <Navigate to="/master-admin/dashboard" replace />;
        }
        if (profile.role === 'admin' && profile.status === 'active' && !currentPath.startsWith('/admin')) {
            return <Navigate to="/admin/dashboard" replace />;
        }
        if (profile.role === 'user' && profile.status !== 'active' && !currentPath.startsWith('/user-lobby')) {
            return <Navigate to="/user-lobby" replace />;
        }
    }

    return <Outlet />;
};

export default ProtectedRoute;
