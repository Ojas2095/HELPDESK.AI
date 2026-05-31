import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabaseClient";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ShieldAlert, KeyRound } from "lucide-react";

function ResetPassword() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session && !window.location.hash.includes('access_token')) {
                console.warn("ResetPassword visited without active recovery session");
            }
        };
        checkSession();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password.length < 8) {
            setError("Password must be at least 8 characters long");
            return;
        }
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);
        setError("");
        setMessage("");

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) throw error;

            setMessage("Password successfully updated!");
            setTimeout(() => navigate("/login"), 3500);
        } catch (err) {
            console.error("Password update error:", err);
            setError(err.message || "Failed to update password. Link may have expired.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Ambient System Glows */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-emerald-500/10 rounded-full blur-[110px]" />
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-500/5 rounded-full blur-[90px]" />
                <div className="absolute inset-0 opacity-[0.02]"
                    style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
            </div>

            <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="w-full max-w-md relative z-10"
            >
                {/* Visual Context Header */}
                <div className="flex flex-col items-center mb-8">
                    <Link to="/" className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 hover:scale-105 transition-transform shadow-lg shadow-black/40">
                        <KeyRound className="w-5 h-5 text-emerald-400" />
                    </Link>
                    <h1 className="text-white text-2xl font-black tracking-tight font-syne uppercase">
                        Account Recovery
                    </h1>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                        Secure Authentication Node
                    </p>
                </div>

                {/* Form Core Interface Card */}
                <div className="bg-white/[0.02] border border-white/[0.06] rounded-[2.5rem] p-8 sm:p-10 shadow-2xl backdrop-blur-xl relative">
                    
                    <AnimatePresence mode="wait">
                        {message ? (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-6 flex flex-col items-center"
                            >
                                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6 shadow-inner">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                </div>
                                <h2 className="text-xl font-bold text-white tracking-tight font-syne mb-2">{message}</h2>
                                <p className="text-slate-400 text-sm font-medium flex items-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                                    <span>Syncing environment redirect parameters...</span>
                                </p>
                            </motion.div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6" noValidate>
                                
                                <AnimatePresence mode="wait">
                                    {error && (
                                        <motion.div 
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 text-left overflow-hidden"
                                        >
                                            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                            <p className="text-rose-400 text-sm font-medium leading-snug">{error}</p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="space-y-5 text-left">
                                    {/* Password Field Input Element */}
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            New Security Credential
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                                                <Lock className="w-4 h-4" />
                                            </div>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Minimum 8 characters"
                                                className="w-full pl-12 pr-12 h-12 rounded-xl border border-white/10 bg-white/[0.02] text-white placeholder-slate-600 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm shadow-inner font-medium"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-2 border-none bg-transparent cursor-pointer"
                                            >
                                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Confirm Password Field Input Element */}
                                    <div className="space-y-2">
                                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                            Verify Security Credential
                                        </label>
                                        <div className="relative">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                                                <Lock className="w-4 h-4" />
                                            </div>
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                placeholder="Repeat password validation matrix"
                                                className="w-full pl-12 pr-4 h-12 rounded-xl border border-white/10 bg-white/[0.02] text-white placeholder-slate-600 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all text-sm shadow-inner font-medium"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition-all shadow-xl shadow-emerald-600/10 active:scale-[0.99] flex items-center justify-center gap-2 border-none cursor-pointer uppercase tracking-wider mt-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>Transmitting...</span>
                                        </>
                                    ) : (
                                        "Update Password"
                                    )}
                                </button>
                            </form>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

export default ResetPassword;
