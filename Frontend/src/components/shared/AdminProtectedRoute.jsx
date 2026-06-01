import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import useAuthStore from '../../store/authStore';
import { supabase } from '../../lib/supabaseClient';

/**
 * AdminProtectedRoute Component
 * Restricts access to routes to only users with the 'admin' role.
 * 
 * SECURITY: Forces server-side role verification on every mount.
 * Never trusts client-side persisted role from localStorage.
 */
const AdminProtectedRoute = () => {
    const { user, profile, loading } = useAuthStore();
    const [serverRole, setServerRole] = useState(null);
    const [verifying, setVerifying] = useState(true);

    // SERVER-SIDE ROLE VERIFICATION — runs on every mount
    useEffect(() => {
        let cancelled = false;

        const verifyRole = async () => {
            if (!user?.id) {
                setVerifying(false);
                return;
            }

            try {
                // Direct DB check — bypasses any client-side cache
                const { data, error } = await supabase
                    .from('profiles')
                    .select('role, status')
                    .eq('id', user.id)
                    .single();

                if (!cancelled) {
                    if (error || !data) {
                        console.warn("Server role verification failed:", error?.message);
                        setServerRole(null);
                    } else {
                        console.log("Server-verified role:", data.role);
                        setServerRole(data);
                    }
                    setVerifying(false);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("Role verification error:", err);
                    setServerRole(null);
                    setVerifying(false);
                }
            }
        };

        verifyRole();
        return () => { cancelled = true; };
    }, [user?.id]);

    // Show spinner while initial auth load or server verification
    if (loading || verifying) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-white">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
            </div>
        );
    }

    // Check if the user is authenticated from Supabase
    if (!user) {
        return <Navigate to="/login" replace />;
    }

    // If we have a user but no profile yet, wait for the database fetch
    if (!profile) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-[#050508]">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
            </div>
        );
    }

    // SERVER-SIDE ROLE CHECK: Use server-verified role from DB, not client-side cache
    if (!serverRole) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-[#050508]">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
            </div>
        );
    }

    // Check if the server-verified role is 'admin' or 'super_admin'
    if (serverRole.role !== "admin" && serverRole.role !== "super_admin") {
        return <Navigate to="/" replace />;
    }

    // Enforce active status (server-verified)
    if (serverRole.status === "rejected") {
        return <Navigate to="/not-approved" replace />;
    } else if (serverRole.status !== "active") {
        return <Navigate to="/admin-lobby" replace />;
    }

    // Authorised and active: render the protected layout
    return <Outlet />;
};

export default AdminProtectedRoute;
