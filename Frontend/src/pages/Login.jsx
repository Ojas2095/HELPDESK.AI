import { useState, useEffect } from "react";
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
  const { login, signInWithMagicLink, loginWithGoogle, loading, user, profile } = useAuthStore();

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
        errMsg = "Network Error: Failed to fetch. This usually happens if your browser's ad-blocker is blocking Supabase requests. Please try disabling your ad-blocker for this site and refresh!";
      }
      setError(errMsg);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError("");
      await loginWithGoogle();
    } catch (err) {
      console.error("Google login error:", err);
      setError(err.message || "Google Sign-In failed.");
    }
  };

  const currentSubmitHandler = isMagicLink ? handleMagicLink : handleLogin;

  return (
    <div className="min-h-screen flex text-slate-900 dark:text-slate-100 bg-white dark:bg-[#102219] font-sans transition-colors duration-200">

      {/* ── Left Panel ── */}
      <div className="hidden lg:flex w-1/2 items-center justify-center p-12 relative overflow-hidden bg-gradient-to-br from-[#f0fdf4] via-[#dcfce7] to-[#bbf7d0] dark:from-[#0a1811] dark:via-[#102219] dark:to-[#152a1e] border-r border-emerald-100 dark:border-emerald-950/20">
        {/* Radial glow */}
        <div
          className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none opacity-100 dark:opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(34,160,69,0.12) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-lg">
          {/* Logo / Icon */}
          <div className="p-3 rounded-2xl w-fit mb-8 bg-[#16a34a]/10 border border-emerald-200 dark:border-emerald-800">
            <BrainCircuit className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-black text-[#0f1f12] dark:text-emerald-400 tracking-tight leading-none mb-6 font-syne">
            Automate your <span className="text-emerald-600 dark:text-emerald-300">IT Support</span>
          </h1>

          {/* Subtext */}
          <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed mb-8">
            Join thousands of IT teams using HelpDesk.ai to categorize, route, and resolve tickets instantly.
          </p>

          {/* System Status Badge */}
          <div className="bg-white dark:bg-[#1a2e24] border border-emerald-100 dark:border-[#2a4034] rounded-2xl p-4 shadow-sm text-slate-800 dark:text-slate-200">
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
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 lg:p-12 relative bg-white dark:bg-[#102219] transition-colors duration-200">
        
        {/* Back Button - Responsive layout to prevent overlap on mobile */}
        <div className="w-full max-w-md flex flex-col min-h-[85vh] lg:min-h-0 justify-between lg:justify-center py-8">
          
          <div className="w-full">
            <Link
              to="/"
              className="lg:absolute lg:top-8 lg:left-8 flex items-center gap-2 mb-8 lg:mb-0 text-slate-700 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all group w-fit"
            >
              <div className="p-2 rounded-full bg-slate-50 dark:bg-[#1a2e24] border border-slate-200 dark:border-[#2a4034] group-hover:border-emerald-500 transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold">Back to Home</span>
            </Link>

            {/* Header */}
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-[#0f1f12] dark:text-emerald-400 tracking-tight mb-2 font-syne">
                Welcome Back
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm">Please sign in to continue</p>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/50 rounded-2xl p-4">
                <div className="rounded-full p-1 mt-0.5 bg-red-100 dark:bg-red-900/50">
                  <ArrowRight className="w-3 h-3 text-red-600 dark:text-red-400 rotate-45" />
                </div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            {magicLinkSent ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-emerald-50 dark:bg-[#1a2e24] border border-emerald-100 dark:border-[#2a4034]">
                  <BrainCircuit className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Check your email</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">We've sent a magic link to <span className="font-semibold text-slate-800 dark:text-slate-200">{email}</span></p>
                <button
                  onClick={() => setMagicLinkSent(false)}
                  className="text-emerald-600 dark:text-emerald-400 font-bold text-sm hover:underline"
                >
                  Try another email
                </button>
              </div>
            ) : (
              <form onSubmit={currentSubmitHandler} className="space-y-5">
                {/* Email Field */}
                <div>
                  <label className="block mb-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="Enter your system email"
                    className="w-full bg-slate-50 dark:bg-[#1a2e24] border border-slate-200 dark:border-[#2a4034] rounded-xl px-4 py-3 text-sm focus:border-emerald-600 focus:bg-white dark:focus:bg-[#102219] text-slate-900 dark:text-slate-100 outline-none transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                {/* Password Field */}
                {!isMagicLink && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                        Password
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline transition-all"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className="w-full bg-slate-50 dark:bg-[#1a2e24] border border-slate-200 dark:border-[#2a4034] rounded-xl px-4 py-3 text-sm pr-11 focus:border-emerald-600 focus:bg-white dark:focus:bg-[#102219] text-slate-900 dark:text-slate-100 outline-none transition-all focus:ring-4 focus:ring-emerald-500/5 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Sign In Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                  {!loading && (isMagicLink ? "Send Magic Link" : "Sign In")}
                </button>

                {/* Divider */}
                <div className="relative flex items-center py-2">
                  <div className="flex-grow border-t border-slate-200 dark:border-[#2a4034]"></div>
                  <span className="flex-shrink-0 mx-4 text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-widest">Or</span>
                  <div className="flex-grow border-t border-slate-200 dark:border-[#2a4034]"></div>
                </div>

                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 bg-white dark:bg-[#1a2e24] border border-slate-200 dark:border-[#2a4034] hover:bg-slate-50 dark:hover:bg-[#223c2f] text-slate-700 dark:text-slate-200 rounded-xl py-3.5 font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.1.14-.14 3.01l3.07 2.38c1.8-1.66 2.84-4.11 2.84-7.24z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.07-2.38c-.9.6-2.03.96-3.23.96-2.48 0-4.58-1.67-5.33-3.92L1.13 19.38C3.11 23.3 7.18 24 12 24z"/>
                    <path fill="#FBBC05" d="M6.67 15.75c-.2-.6-.31-1.25-.31-1.92s.11-1.32.31-1.92L1.13 7.99C.41 9.43 0 11.08 0 12.8s.41 3.37 1.13 4.81l5.54-3.86z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.18 0 3.11 3.7 1.13 7.99l5.54 3.86c.75-2.25 2.85-3.92 5.33-3.92z"/>
                  </svg>
                  <span>Continue with Google</span>
                </button>

                {/* Magic Link Toggle */}
                <button
                  type="button"
                  onClick={() => { setIsMagicLink(!isMagicLink); setError(""); }}
                  className="w-full flex items-center justify-center gap-2 bg-white dark:bg-[#1a2e24] border border-emerald-200 dark:border-emerald-900/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 rounded-xl py-3.5 font-bold text-sm transition-all active:scale-[0.98]"
                >
                  {isMagicLink ? "Sign in with Password" : "Sign in with Magic Link"}
                </button>
              </form>
            )}
          </div>

          {/* Create Account Link */}
          {!magicLinkSent && (
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
              Don't have an account?{" "}
              <Link to="/signup" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
                Create Account
              </Link>
            </p>
          )}

        </div>
      </div>
    </div>
  );
}

export default Login;
