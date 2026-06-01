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
    const { user, profile, loading: storeLoading } = useAuthStore();
    const [serverVerified, setServerVerified] = useState(false);
    const [verifying, setVerifying] = useState(true);
    const [serverRole, setServerRole] = useState(null);
    const hasVerified = useRef(false);

    useEffect(() => {
        // Prevent double-invocation (React StrictMode)
        if (hasVerified.current) return;
        hasVerified.current = true;

        let cancelled = false;

        const verifyServerSide = async () => {
            try {
                // Step 1: get fresh user from Supabase auth (cannot be faked via localStorage)
                const { data: { user: freshUser }, error: userErr } = await supabase.auth.getUser();
                if (cancelled) return;

                if (userErr || !freshUser) {
                    setServerVerified(false);
                    setVerifying(false);
                    return;
                }

                // Step 2: fetch profile directly from DB (ignore Zustand cache)
                const { data: serverProfile, error: profileErr } = await supabase
                    .from('profiles')
                    .select('role, status, id, company_id')
                    .eq('id', freshUser.id)
                    .single();

                if (cancelled) return;

                if (profileErr || !serverProfile) {
                    setServerVerified(false);
                    setVerifying(false);
                    return;
                }

                // Step 3: detect localStorage tampering
                const cachedProfile = useAuthStore.getState().profile;
                if (
                    cachedProfile &&
                    cachedProfile.id === freshUser.id &&
                    cachedProfile.role !== serverProfile.role
                ) {
                    // Role mismatch: localStorage was tampered
                    useAuthStore.setState({ user: null, profile: null });
                    setServerVerified(false);
                    setServerRole(null);
                    setVerifying(false);
                    return;
                }

                // Step 4: sync fresh server profile into store
                useAuthStore.setState({
                    user: freshUser,
                    profile: { ...(cachedProfile || {}), ...serverProfile },
                });

                setServerRole(serverProfile.role);

                const allowedRoles = ['admin', 'super_admin', 'master_admin'];
                const isAdmin = allowedRoles.includes(serverProfile.role);
                const isActive = serverProfile.status === 'active';

                setServerVerified(isAdmin && isActive);
                setVerifying(false);
            } catch (_err) {
                if (!cancelled) {
                    setServerVerified(false);
                    setVerifying(false);
                }
            }
        };

        verifyServerSide();
        return () => { cancelled = true; };
    }, []);

    // Show spinner while initial store is loading
    if (storeLoading) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-white">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" aria-label="Authenticating..." role="status"></div>
            </div>
        );
    }

    // No authenticated user at all
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // Server verification in progress
    if (verifying) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-[#050508]" aria-label="Verifying permissions..." role="status" aria-live="polite">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
            </div>
        );
    }

    // Server says not an admin (or localStorage was tampered)
    if (!serverVerified) {
        return <Navigate to="/" replace />;
    }

    // Handle rejected / pending status
    const currentProfile = useAuthStore.getState().profile;
    if (currentProfile?.status === 'rejected') {
        return <Navigate to="/not-approved" replace />;
    }
    if (currentProfile?.status !== 'active') {
        return <Navigate to="/admin-lobby" replace />;
    }

    return <Outlet />;
};

export default AdminProtectedRoute;
