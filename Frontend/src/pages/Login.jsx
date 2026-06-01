import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import useAuthStore from "../store/authStore";
import { Eye, EyeOff, BrainCircuit, ArrowRight, Loader2, ArrowLeft } from "lucide-react";

function Login() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isMagicLink, setIsMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const navigate = useNavigate();
  const { login, signInWithMagicLink, loginWithGoogle, loading, user, profile } = useAuthStore();

  const [googleLoading, setGoogleLoading] = useState(false);

  // Auto-redirect if already logged in
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
    setIsSubmitting(true);

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
        errMsg = "Network Error: Failed to fetch. This usually happens if your browser's ad-blocker is blocking Supabase requests. Please try disabling your ad-blocker for this site and refresh!";
      }
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMagicLink = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address");
      return;
    }

    setError("");
    setIsSubmitting(true);
    try {
      await signInWithMagicLink(email);
      setMagicLinkSent(true);
    } catch (err) {
      console.error("Magic link error:", err);
      let errMsg = err.message || "Failed to send magic link. Please check your email.";
      if (errMsg.toLowerCase().includes("failed to fetch")) {
        errMsg = "Network Error: Failed to fetch. This usually happens if your browser's ad-blocker is blocking Supabase requests. Please try disabling your ad-blocker for this site and refresh!";
      }
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error("Google login failed", err.message);
      let errMsg = err.message || "Google sign-in failed. Please try again.";
      if (errMsg.toLowerCase().includes("failed to fetch")) {
        errMsg = "Network Error: Failed to fetch. Please disable your ad-blocker for this site and try again.";
      }
      setError(errMsg);
      setGoogleLoading(false);
    }
  };

  const currentSubmitHandler = isMagicLink ? handleMagicLink : handleLogin;

  return (
    <div className="min-h-screen flex text-slate-900 dark:text-slate-100 bg-white dark:bg-[#102219] font-sans transition-colors duration-200">

      {/* ── Left Panel ── */}
      <div
        className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 relative overflow-hidden bg-gradient-to-br from-green-50 via-green-100 to-green-200 dark:from-emerald-950 dark:via-slate-900 dark:to-emerald-950 border-r border-green-100 dark:border-emerald-900/30"
      >
        <div
          className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none opacity-100 dark:opacity-20"
          style={{
            background: isDark
              ? 'radial-gradient(circle, rgba(34,160,69,0.08) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(34,160,69,0.12) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-lg">
          <div
            className="p-3 rounded-2xl w-fit mb-8 bg-green-600/10 border border-green-200 dark:border-emerald-500/20"
          >
            <BrainCircuit className="w-10 h-10 text-green-600 dark:text-emerald-400" />
          </div>

          <h1 className="font-syne text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-[1.1] mb-6">
            Automate your{' '}
            <span className="text-green-600 dark:text-emerald-400">IT Support</span>
          </h1>

          <p className="text-slate-600 dark:text-emerald-100/70 text-lg leading-relaxed mb-10">
            Join thousands of IT teams using HelpDesk.ai to categorize, route, and resolve tickets instantly.
          </p>

          <div className="bg-white dark:bg-slate-900/50 border border-green-100 dark:border-emerald-500/20 rounded-2xl p-5 shadow-sm backdrop-blur-sm">
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-[#102219]">
                <div className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">AI</div>
              </div>
              <div>
                <p className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                  <span className="inline-block w-2 h-2 rounded-full animate-pulse bg-emerald-500" />
                  System Status
                </p>
                <p className="text-slate-800 dark:text-slate-100 font-medium text-sm">All systems operational. 99.9% uptime this month.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div
        className="flex w-full lg:w-1/2 items-center justify-center p-4 sm:p-6 relative"
        style={{ background: isDark ? '#111827' : '#ffffff', borderLeft: '1px solid #f0fdf4' }}
      >
        <Link
          to="/"
          className="absolute top-4 left-4 sm:top-8 sm:left-8 flex items-center gap-2 transition-all group"
          style={{ color: isDark ? '#a7d5c4' : '#374151', fontWeight: 500, fontSize: '14px' }}
        >
          <div className="p-2 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 group-hover:border-green-200 dark:group-hover:border-emerald-500/30 transition-all">
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span className="hidden sm:inline">Back to Home</span>
        </Link>

        <div className="w-full max-w-md mt-12 sm:mt-8 lg:mt-0 px-2 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6 lg:hidden">
              <Link to="/" className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(34,160,69,0.08)', border: '1px solid #d1fae5' }}>
                <BrainCircuit className="w-4 h-4" style={{ color: '#16a34a' }} />
                <span style={{ fontWeight: 800, fontSize: '16px', color: '#0f1f12' }}>HelpDesk.ai</span>
              </Link>
            </div>
            <h2 className="text-3xl font-black text-[#0f1f12] dark:text-emerald-400 tracking-tight mb-2 font-syne">
              Welcome Back
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Please sign in to continue</p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="rounded-full p-1 mt-0.5 bg-red-100 dark:bg-red-900/40">
                <ArrowRight className="w-3 h-3 text-red-600 dark:text-red-400 rotate-45" />
              </div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {magicLinkSent ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-green-50 dark:bg-emerald-950/40 border border-green-100 dark:border-emerald-900/30">
                <BrainCircuit className="w-8 h-8 text-green-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Check your email</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">We've sent a magic link to <span className="font-bold text-slate-900 dark:text-emerald-50">{email}</span></p>
              <button
                onClick={() => setMagicLinkSent(false)}
                className="text-green-600 dark:text-emerald-400 font-bold text-sm hover:underline underline-offset-4 transition-all"
              >
                Try another email
              </button>
            </div>
          ) : (
            <form onSubmit={currentSubmitHandler} className="space-y-4 sm:space-y-5">
              <div>
                <label className="block mb-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your system email"
                  className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 dark:focus:border-emerald-500/50 transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {!isMagicLink && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <div className="flex justify-between items-center mb-2">
                    <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      className="text-[10px] font-bold text-green-600 dark:text-emerald-400 hover:underline underline-offset-2 tracking-wide uppercase"
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 dark:focus:border-emerald-500/50 transition-all"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required={!isMagicLink}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </motion.div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || loading}
                className="w-full py-4 bg-gradient-to-r from-green-600 to-green-500 dark:from-emerald-600 dark:to-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-600/20 hover:shadow-green-600/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {(isSubmitting || loading) && <Loader2 className="w-5 h-5 animate-spin" />}
                {!(isSubmitting || loading) && (isMagicLink ? "Send Magic Link" : "Sign In")}
              </button>

              {/* Google Button */}
              <button
                type="button"
                disabled={loading || googleLoading}
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background: isDark ? '#1f2937' : '#ffffff',
                  border: isDark ? '1.5px solid #374151' : '1.5px solid #e5e7eb',
                  color: isDark ? '#f9fafb' : '#374151',
                  borderRadius: '12px',
                  padding: '13px',
                  fontWeight: 500,
                  fontSize: '15px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>{googleLoading ? "Redirecting to Google..." : "Continue with Google"}</span>
              </button>

              {/* Divider */}
              <div className="relative flex items-center py-2">
                <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
                <span className="flex-shrink-0 mx-4 text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Or</span>
                <div className="flex-grow border-t border-slate-100 dark:border-slate-800"></div>
              </div>

              <button
                type="button"
                onClick={() => { setIsMagicLink(!isMagicLink); setError(""); }}
                className="w-full py-3.5 bg-transparent border border-green-100 dark:border-emerald-500/20 text-green-700 dark:text-emerald-400 rounded-xl font-semibold text-sm hover:bg-green-50 dark:hover:bg-emerald-500/10 transition-all active:scale-[0.98]"
              >
                {isMagicLink ? "Sign in with Password" : "Sign in with Magic Link"}
              </button>

              <p className="text-center" style={{ fontSize: '14px', color: '#6b7280', marginTop: '20px' }}>
                Don't have an account?{" "}
                <Link to="/signup" className="text-green-600 dark:text-emerald-400 font-bold hover:underline underline-offset-4">
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
