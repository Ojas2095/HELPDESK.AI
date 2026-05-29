import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { BrainCircuit, Lock, Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

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
            setTimeout(() => navigate("/login"), 3000);
        } catch (err) {
            console.error("Password update error:", err);
            setError(err.message || "Failed to update password. Link may have expired.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center font-inter bg-gradient-to-br from-green-50 via-green-100 to-green-200 dark:from-emerald-950 dark:via-slate-900 dark:to-emerald-950 relative overflow-hidden p-4 sm:p-6 py-12">
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>

            <div className="w-full max-w-md relative z-10">
                {/* Logo Header */}
                <div className="flex justify-center mb-8">
                    <Link to="/" className="flex items-center gap-2 bg-white/40 dark:bg-emerald-500/10 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/40 dark:border-emerald-500/20 shadow-xl transition hover:scale-105 group">
                        <BrainCircuit className="w-6 h-6 text-green-600 dark:text-emerald-400 transition-transform group-hover:rotate-12" />
                        <span className="font-syne font-extrabold text-xl tracking-tight text-slate-900 dark:text-white uppercase italic">HelpDesk<span className="text-green-600 dark:text-emerald-400">.ai</span></span>
                    </Link>
                </div>

                <div className="bg-white dark:bg-gray-950 shadow-2xl rounded-[2.5rem] p-8 sm:p-10 border border-green-50 dark:border-emerald-900/30 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600 opacity-20"></div>

                    <div className="text-center mb-8">
                        <h2 className="font-syne text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase italic">Set New Password</h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-sm">Choose a strong, secure password.</p>
                    </div>

                    {message ? (
                        <div className="text-center py-6 animate-in fade-in zoom-in duration-300">
                            <div className="w-20 h-20 rounded-3xl bg-green-50 dark:bg-emerald-500/10 border border-green-100 dark:border-emerald-500/20 flex items-center justify-center mx-auto mb-8 shadow-inner">
                                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-emerald-400" />
                            </div>
                            <p className="text-slate-900 dark:text-white font-bold text-xl mb-2 italic">{message}</p>
                            <p className="text-slate-500 dark:text-slate-400 text-sm">Redirecting to login sequence...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {error && (
                                <div className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 px-5 py-4 rounded-2xl text-sm font-semibold flex items-start gap-3">
                                    <p>{error}</p>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 ml-1">New Security Sequence</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                            <Lock className="w-5 h-5" />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Min. 8 characters"
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 pl-12 pr-12 py-4 rounded-2xl focus:border-green-500 focus:ring-4 focus:ring-green-500/5 transition-all outline-none text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2 ml-1">Confirm Identity Key</label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                            <Lock className="w-5 h-5" />
                                        </div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Repeat sequence"
                                            className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 pl-12 pr-4 py-4 rounded-2xl focus:border-green-500 focus:ring-4 focus:ring-green-500/5 transition-all outline-none text-slate-900 dark:text-white font-bold placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-gradient-to-r from-green-600 to-green-500 dark:from-emerald-600 dark:to-emerald-500 text-white rounded-2xl py-4 font-bold shadow-lg shadow-green-600/20 active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 transition-all"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Update Password"}
                            </button>

                            <div className="text-center pt-6 border-t border-slate-50 dark:border-slate-800 mt-4">
                                <Link
                                    to="/login"
                                    className="inline-flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-green-600 dark:hover:text-emerald-400 text-[10px] font-bold uppercase tracking-widest transition-all"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Return to Secure Gate
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ResetPassword;
