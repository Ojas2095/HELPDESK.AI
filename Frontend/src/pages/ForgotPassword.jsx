import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { BrainCircuit, Mail, ArrowLeft, Loader2, CheckCircle2, Lock, KeyRound, AlertCircle } from "lucide-react";
 
import { motion, AnimatePresence } from "framer-motion";

function ForgotPassword() {
    const [step, setStep] = useState(1);
    const [email, setEmail] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [timeLeft, setTimeLeft] = useState(900);
    const [timerExpired, setTimerExpired] = useState(false);

    useEffect(() => {
        if (step !== 2) return;
        setTimerExpired(false);
        setTimeLeft(900);
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    setTimerExpired(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [step]);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleSendOtp = async (e) => {
        e.preventDefault();
        if (!email) {
            setError("Please enter your email address");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email);
            if (error) throw error;
            setMessage("Check your email for the 6-digit recovery code!");
            setStep(2);
        } catch (err) {
            console.error("Password reset error:", err);
            setError(err.message || "An error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (!otp || otp.length !== 6) {
            setError("Please enter the 6-digit code");
            return;
        }
        if (timerExpired) {
            setError("Your code has expired. Please request a new one.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const { error } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'recovery'
            });

            if (error) throw error;
            setStep(3);
            setMessage("Code verified. Please enter your new password.");
        } catch (err) {
            console.error("OTP verification error:", err);
            setError("Invalid or expired code. Please check your email and try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (!newPassword || newPassword.length < 6) {
            setError("Password must be at least 6 characters long.");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (error) throw error;
            setStep(4);
        } catch (err) {
            console.error("Update password error:", err);
            setError(err.message || "Failed to update password.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center font-inter relative overflow-hidden p-4 sm:p-6 py-12 bg-gradient-to-br from-green-50 via-green-100 to-green-200 dark:from-emerald-950 dark:via-slate-900 dark:to-emerald-950">
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            
            <div className="w-full max-w-md relative z-10">
                {/* Logo Header */}
                <div className="flex justify-center mb-10">
                    <Link to="/" className="flex items-center gap-2 bg-white/40 dark:bg-emerald-500/10 backdrop-blur-xl px-5 py-2.5 rounded-2xl border border-white/40 dark:border-emerald-500/20 shadow-xl transition hover:scale-105 group">
                        <BrainCircuit className="w-6 h-6 text-green-600 dark:text-emerald-400 transition-transform group-hover:rotate-12" />
                        <span className="font-syne font-extrabold text-xl tracking-tight text-slate-900 dark:text-white uppercase italic">HelpDesk<span className="text-green-600 dark:text-emerald-400">.ai</span></span>
                    </Link>
                </div>

                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-950 shadow-2xl rounded-[2.5rem] p-8 sm:p-10 border border-green-50 dark:border-emerald-900/30 relative overflow-hidden"
                >
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-400 to-emerald-600 opacity-20"></div>

                    <div className="text-center mb-8">
                        <h2 className="font-syne text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase italic">
                            {step === 1 ? "Recovery Access" : step === 2 ? "Verify Identity" : "Secure Protocol"}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium text-sm">
                            {step === 1 ? "Enter your email to initiate recovery." : step === 2 ? "Enter the 6-digit code sent to your email." : "Set a new high-security password."}
                        </p>
                    </div>

                    <AnimatePresence mode="wait">
                        {step === 4 ? (
                            <motion.div 
                                key="success"
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="text-center py-6"
                            >
                                <div className="w-20 h-20 rounded-3xl bg-green-50 dark:bg-emerald-500/10 border border-green-100 dark:border-emerald-500/20 flex items-center justify-center mx-auto mb-8 shadow-inner">
                                    <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-emerald-400" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-3 italic">Sync Successful</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium mb-10 leading-relaxed text-sm">
                                    Your security credentials have been updated across all nodes.
                                </p>
                                <Link
                                    to="/login"
                                    className="inline-flex items-center justify-center w-full px-8 py-4 bg-gradient-to-r from-green-600 to-green-500 dark:from-emerald-600 dark:to-emerald-500 text-white rounded-2xl font-bold shadow-lg shadow-green-600/20 active:scale-[0.98] transition-all"
                                >
                                    Proceed to Terminal
                                </Link>
                            </motion.div>
                        ) : (
                            <div className="space-y-6">
                                {error && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 px-5 py-4 rounded-2xl text-sm font-semibold flex items-start gap-3"
                                    >
                                        <AlertCircle className="w-5 h-5 shrink-0" />
                                        <p>{error}</p>
                                    </motion.div>
                                )}

                                {message && step !== 1 && (
                                    <div className="bg-green-50 dark:bg-emerald-950/20 border border-green-100 dark:border-emerald-900/30 text-green-700 dark:text-emerald-400 px-5 py-4 rounded-2xl text-sm font-semibold flex items-start gap-3">
                                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                                        <p>{message}</p>
                                    </div>
                                )}

                                {/* STEP 1: Email */}
                                {step === 1 && (
                                    <form onSubmit={handleSendOtp} className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">Identity Terminal</label>
                                            <div className="relative">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                                    <Mail className="w-5 h-5" />
                                                </div>
                                                <input
                                                    type="email"
                                                    placeholder="personnel@helpdesk.ai"
                                                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 pl-12 pr-4 py-4 rounded-2xl focus:border-green-500 focus:ring-4 focus:ring-green-500/5 transition-all outline-none text-slate-900 dark:text-white font-bold"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full rounded-2xl py-4 bg-gradient-to-r from-green-600 to-green-500 dark:from-emerald-600 dark:to-emerald-500 text-white font-bold shadow-lg shadow-green-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
                                        >
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Request Access Key <ArrowLeft className="w-5 h-5 rotate-180 transition-transform group-hover:translate-x-1" /></>}
                                        </button>
                                    </form>
                                )}

                                {/* STEP 2: OTP */}
                                {step === 2 && (
                                    <form onSubmit={handleVerifyOtp} className="space-y-8">
                                        <div className="space-y-4">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center block">Verification Sequence</label>
                                            <div className="relative flex justify-center">
                                                <input
                                                    type="text"
                                                    maxLength="6"
                                                    placeholder="000000"
                                                    className="w-full text-center tracking-[0.5em] text-4xl px-4 py-6 rounded-3xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 focus:border-green-500 focus:ring-8 focus:ring-green-500/5 transition-all outline-none text-green-600 dark:text-emerald-400 font-mono font-black shadow-inner"
                                                    value={otp}
                                                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                                                    autoFocus
                                                />
                                            </div>
                                            <p className={`text-center text-xs font-bold mt-1 ${
                                                timerExpired ? 'text-red-500' : timeLeft < 60 ? 'text-orange-500' : 'text-slate-400'
                                            }`}>
                                                {timerExpired ? '⚠ Code expired — request a new one below' : `Expires in ${formatTime(timeLeft)}`}
                                            </p>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading || otp.length < 6 || timerExpired}
                                            className={`w-full rounded-2xl py-4 font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-70 ${timerExpired ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-green-600 to-green-500 dark:from-emerald-600 dark:to-emerald-500 text-white shadow-lg shadow-green-600/20 active:scale-[0.98]'}`}
                                        >
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Identity Signature"}
                                        </button>
                                        {timerExpired && (
                                            <button
                                                type="button"
                                                onClick={() => { setStep(1); setOtp(""); setError(""); }}
                                                className="w-full rounded-2xl py-3 font-bold text-sm transition-all flex items-center justify-center gap-2 border-2 border-green-500 text-green-600 dark:text-emerald-400 hover:bg-green-50 dark:hover:bg-emerald-950/20"
                                            >
                                                Request New Code
                                            </button>
                                        )}
                                    </form>
                                )}

                                {/* STEP 3: New Password */}
                                {step === 3 && (
                                    <form onSubmit={handleUpdatePassword} className="space-y-6">
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 ml-1">New Security Sequence</label>
                                                <div className="relative">
                                                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                                        <Lock className="w-5 h-5" />
                                                    </div>
                                                    <input
                                                        type="password"
                                                        placeholder="••••••••"
                                                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 pl-12 pr-4 py-4 rounded-2xl focus:border-green-500 focus:ring-4 focus:ring-green-500/5 transition-all outline-none text-slate-900 dark:text-white font-bold"
                                                        value={newPassword}
                                                        onChange={(e) => setNewPassword(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading || newPassword.length < 6}
                                            className="w-full rounded-2xl py-4 bg-gradient-to-r from-green-600 to-green-500 dark:from-emerald-600 dark:to-emerald-500 text-white font-bold shadow-lg shadow-green-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                                        >
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Sync Credentials <KeyRound className="w-5 h-5" /></>}
                                        </button>
                                    </form>
                                )}

                                <div className="text-center pt-6 border-t border-slate-50 dark:border-slate-800 mt-4">
                                    <Link
                                        to="/login"
                                        className="inline-flex items-center gap-2 text-slate-400 dark:text-slate-500 hover:text-green-600 dark:hover:text-emerald-400 text-[10px] font-bold uppercase tracking-widest transition-all"
                                    >
                                        <ArrowLeft className="w-4 h-4" />
                                        Return to Secure Gate
                                    </Link>
                                </div>
                            </div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    );
}

export default ForgotPassword;
