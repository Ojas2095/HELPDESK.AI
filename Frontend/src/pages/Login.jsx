import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import useAuthStore from "../store/authStore";
import { Eye, EyeOff, BrainCircuit, ArrowRight, Loader2, ArrowLeft } from "lucide-react";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const [isMagicLink, setIsMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const navigate = useNavigate();
  const { login, signInWithMagicLink, loading, user, profile } = useAuthStore();

  useEffect(() => {
    if (user && profile) {
      if (profile.status === "active") {
        if (profile.role === "master_admin") navigate("/master-admin/dashboard");
        else if (profile.role === "admin") navigate("/admin/dashboard");
        else if (profile.role === "user") navigate("/dashboard");
      } else if (profile.status === "pending_approval") {
        if (profile.role === "admin") navigate("/admin-lobby");
        else if (profile.role === "user") navigate("/user-lobby");
      } else if (profile.status === "rejected") {
        navigate("/not-approved");
      }
    }
  }, [user, profile, navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please enter your email and password");
      return;
    }

    setError("");

    try {
      const { profile } = await login(email, password);

      if (!profile) {
        throw new Error("User profile not found. Please contact support.");
      }

      if (profile.status === "pending_email_verification") {
        throw new Error("Please verify your email first.");
      }

      if (profile.status === "rejected") {
        navigate("/not-approved");
        return;
      }

      if (profile.role === "master_admin" && profile.status === "active") {
        navigate("/master-admin/dashboard");
      } else if (profile.role === "admin") {
        if (profile.status === "active") navigate("/admin/dashboard");
        else if (profile.status === "pending_approval") navigate("/admin-lobby");
      } else if (profile.role === "user") {
        if (profile.status === "active") navigate("/dashboard");
        else if (profile.status === "pending_approval") navigate("/user-lobby");
      }
    } catch (err) {
      console.error("Login component error:", err);
      let errMsg = err.message || "Invalid credentials. Please try again.";
      if (errMsg.toLowerCase().includes("failed to fetch")) {
        errMsg = "Network Error: Failed to fetch. This usually happens if your browser's ad-blocker (like Brave Shields, uBlock Origin, etc.) is blocking Supabase requests. Please try disabling your ad-blocker for this site and refresh!";
      }
      setError(errMsg);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setError("");
    try {
      await signInWithMagicLink(email);
      setMagicLinkSent(true);
    } catch (err) {
      console.error("Magic link error:", err);
      let errMsg = err.message || "Failed to send magic link. Please check your email.";
      if (errMsg.toLowerCase().includes("failed to fetch")) {
        errMsg = "Network Error: Failed to fetch. This usually happens if your browser's ad-blocker (like Brave Shields, uBlock Origin, etc.) is blocking Supabase requests. Please try disabling your ad-blocker for this site and refresh!";
      }
      setError(errMsg);
    }
  };

  const currentSubmitHandler = isMagicLink ? handleMagicLink : handleLogin;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 font-sans transition-colors duration-300">

      {/* ── Left Panel ── */}
      <div className="hidden lg:flex w-1/2 items-center justify-center p-12 relative overflow-hidden bg-gradient-to-br from-green-50 via-green-100/30 to-emerald-100/50 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950 border-r border-slate-100 dark:border-slate-900">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none bg-radial from-emerald-500/10 dark:from-emerald-500/5 to-transparent blur-3xl" />

        <div className="relative z-10 max-w-lg">
          <div className="p-3 rounded-2xl w-fit mb-8 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-100 dark:border-emerald-900/30">
            <BrainCircuit className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>

          <h1 className="font-black text-5xl text-slate-900 dark:text-white tracking-tight leading-[1.1] mb-6 font-syne uppercase">
            Automate your <br/>
            <span className="text-emerald-600 dark:text-emerald-400">IT Support</span>
          </h1>

          <p className="text-slate-600 dark:text-slate-400 text-base leading-relaxed mb-8 font-medium">
            Join thousands of IT teams using HelpDesk.ai to categorize, route, and resolve tickets instantly.
          </p>

          <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-[14px] px-[18px] shadow-sm dark:shadow-none backdrop-blur-sm">
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100/40 dark:border-emerald-900/20">
                <div className="text-emerald-700 dark:text-emerald-400 font-black text-sm">AI</div>
              </div>
              <div>
                <p className="flex items-center gap-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  System Status
                </p>
                <p className="text-slate-800 dark:text-slate-200 font-bold text-sm">All systems operational. 99.9% uptime this month.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 relative bg-white dark:bg-slate-900 transition-colors duration-300">
        <Link
          to="/"
          className="absolute top-8 left-8 flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group"
        >
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:border-emerald-500/30 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span>Back to Home</span>
        </Link>

        <div className="w-full max-w-md mt-8 lg:mt-0 p-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2 font-syne uppercase">
              Welcome Back
            </h2>
            <p className="text-slate-400 dark:text-slate-500 text-xs font-bold uppercase tracking-widest">Please sign in to continue</p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-4">
              <div className="rounded-full p-1 mt-0.5 bg-red-100 dark:bg-red-900/50 shrink-0">
                <ArrowRight className="w-3 h-3 text-red-600 dark:text-red-400 rotate-45" />
              </div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-400 leading-snug">{error}</p>
            </div>
          )}

          {magicLinkSent ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30">
                <BrainCircuit className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 font-syne uppercase">Check your email</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 font-medium">We've sent a magic link to <span className="font-bold text-slate-950 dark:text-slate-100">{email}</span></p>
              <button
                type="button"
                onClick={() => setMagicLinkSent(false)}
                className="text-xs font-black text-emerald-600 dark:text-emerald-400 hover:underline uppercase tracking-wider cursor-pointer bg-transparent border-none"
              >
                Try another email
              </button>
            </div>
          ) : (
            <form onSubmit={currentSubmitHandler} className="space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-widest uppercase mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your system email"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 px-4 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:focus:ring-emerald-500/5 transition-all duration-200"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {!isMagicLink && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 tracking-widest uppercase">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 px-4 pr-11 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:focus:ring-emerald-500/5 transition-all duration-200"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 cursor-pointer bg-transparent border-none"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-emerald-900 dark:bg-white text-white dark:text-slate-950 rounded-xl p-3.5 text-xs font-black uppercase tracking-widest hover:bg-emerald-800 dark:hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer border-none shadow-xl shadow-emerald-950/10 dark:shadow-none"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {!loading && (isMagicLink ? "Send Magic Link" : "Sign In")}
              </button>

              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-100 dark:border-slate-800/60"></div>
                <span className="flex-shrink-0 mx-4 text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">Or</span>
                <div className="flex-grow border-t border-slate-100 dark:border-slate-800/60"></div>
              </div>

              <button
                type="button"
                onClick={() => { setIsMagicLink(!isMagicLink); setError(""); }}
                className="w-full flex items-center justify-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 rounded-xl p-3 text-xs font-black uppercase tracking-widest transition-colors duration-200 cursor-pointer"
              >
                {isMagicLink ? "Sign in with Password" : "Sign in with Magic Link"}
              </button>

              <p className="text-center text-sm text-slate-400 dark:text-slate-500 mt-8 font-medium">
                Don't have an account?{" "}
                <Link to="/signup" className="text-emerald-600 dark:text-emerald-400 font-black hover:underline transition-all">
                  Create Account
                </Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default Login;