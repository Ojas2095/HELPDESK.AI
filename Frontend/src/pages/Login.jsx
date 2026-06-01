import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
 
import { motion } from "framer-motion";
import useAuthStore from "../store/authStore";
import { Eye, EyeOff, BrainCircuit, ArrowRight, Loader2, ArrowLeft } from "lucide-react";
import ThemeToggle from "../components/shared/ThemeToggle";
import { useTheme } from "../components/shared/ThemeProvider";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const [isMagicLink, setIsMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const navigate = useNavigate();
  const { login, signInWithMagicLink, loading, user, profile } = useAuthStore();
  const { isDark } = useTheme();

  const theme = {
    page: isDark ? '#07140f' : '#ffffff',
    leftBg: isDark
      ? 'linear-gradient(160deg, #061a13 0%, #0f2a1d 58%, #123d28 100%)'
      : 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 60%, #bbf7d0 100%)',
    rightBg: isDark ? '#0b1712' : '#ffffff',
    panelBorder: isDark ? '1px solid rgba(52, 211, 153, 0.16)' : '1px solid #f0fdf4',
    title: isDark ? '#f8fafc' : '#0f1f12',
    body: isDark ? '#cbd5e1' : '#374151',
    muted: isDark ? '#94a3b8' : '#6b7280',
    inputBg: isDark ? '#102219' : '#f9fafb',
    inputBorder: isDark ? 'rgba(148, 163, 184, 0.24)' : '#e5e7eb',
    cardBg: isDark ? 'rgba(15, 31, 24, 0.94)' : '#ffffff',
    cardBorder: isDark ? 'rgba(52, 211, 153, 0.24)' : '#d1fae5',
    softGreen: isDark ? 'rgba(16, 185, 129, 0.12)' : '#f0fdf4',
    accent: isDark ? '#34d399' : '#16a34a',
    accentStrong: isDark ? '#86efac' : '#15803d',
  };

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
        return; // Navigation will happen, but just return to prevent further execution
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
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif", background: theme.page }}>

      {/* ── Left Panel ── */}
      <div
        className="hidden lg:flex w-1/2 items-center justify-center p-12 relative overflow-hidden"
        style={{
          background: theme.leftBg,
        }}
      >
        {/* Radial glow */}
        <div
          className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background: isDark ? 'radial-gradient(circle, rgba(52,211,153,0.16) 0%, transparent 70%)' : 'radial-gradient(circle, rgba(34,160,69,0.12) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 max-w-lg">
          {/* Logo / Icon */}
          <div
            className="p-3 rounded-2xl w-fit mb-8"
            style={{ background: theme.softGreen, border: theme.cardBorder }}
          >
            <BrainCircuit className="w-10 h-10" style={{ color: theme.accent }} />
          </div>

          {/* Headline */}
          <h1
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: '48px',
              fontWeight: 800,
              color: theme.title,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              marginBottom: '24px',
            }}
          >
            Automate your{' '}
            <span style={{ color: theme.accent }}>IT Support</span>
          </h1>

          {/* Subtext */}
          <p style={{ color: theme.body, fontSize: '16px', lineHeight: 1.7, marginBottom: '32px' }}>
            Join thousands of IT teams using HelpDesk.ai to categorize, route, and resolve tickets instantly.
          </p>

          {/* System Status Badge */}
          <div
            style={{
              background: theme.cardBg,
              border: theme.cardBorder,
              borderRadius: '14px',
              padding: '14px 18px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex gap-4 items-start">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: theme.softGreen }}>
                <div style={{ color: theme.title, fontWeight: 800, fontSize: '14px' }}>AI</div>
              </div>
              <div>
                <p className="flex items-center gap-2" style={{ fontSize: '12px', fontWeight: 600, color: theme.body, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                  <span
                    className="inline-block w-2 h-2 rounded-full animate-pulse"
                    style={{ background: '#22c55e' }}
                  />
                  System Status
                </p>
                <p style={{ color: theme.title, fontWeight: 500, fontSize: '14px' }}>All systems operational. 99.9% uptime this month.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right Panel ── */}
      <div
        className="flex w-full lg:w-1/2 items-center justify-center p-6 relative"
        style={{ background: theme.rightBg, borderLeft: theme.panelBorder }}
      >
        <div className="absolute top-8 right-8">
          <ThemeToggle />
        </div>

        {/* Back Button */}
        <Link
          to="/"
          className="absolute top-8 left-8 flex items-center gap-2 transition-all group"
          style={{ color: theme.body, fontWeight: 500, fontSize: '14px' }}
          onMouseEnter={(e) => e.currentTarget.style.color = theme.accent}
          onMouseLeave={(e) => e.currentTarget.style.color = theme.body}
        >
          <div className="p-2 rounded-full transition-all" style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}` }}>
            <ArrowLeft className="w-4 h-4" />
          </div>
          <span>Back to Home</span>
        </Link>

        <div className="w-full max-w-md mt-8 lg:mt-0" style={{ padding: '32px' }}>
          {/* Header */}
          <div className="text-center" style={{ marginBottom: '40px' }}>
            <h2
              style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: '28px',
                fontWeight: 800,
                color: theme.title,
                letterSpacing: '-0.02em',
                marginBottom: '8px',
              }}
            >
              Welcome Back
            </h2>
            <p style={{ color: theme.muted, fontSize: '14px' }}>Please sign in to continue</p>
          </div>

          {/* Role Toggle Removed */}

          {error && (
            <div className="mb-6 flex items-start gap-3" style={{ background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '14px 16px' }}>
              <div className="rounded-full p-1 mt-0.5" style={{ background: '#fee2e2' }}>
                <ArrowRight className="w-3 h-3 text-red-600 rotate-45" />
              </div>
              <p className="text-sm font-medium" style={{ color: '#b91c1c' }}>{error}</p>
            </div>
          )}

          {magicLinkSent ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6" style={{ background: '#f0fdf4', border: '1px solid #d1fae5' }}>
                <BrainCircuit className="w-8 h-8" style={{ color: '#16a34a' }} />
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: theme.title, marginBottom: '8px' }}>Check your email</h3>
              <p style={{ color: theme.muted, fontSize: '14px', marginBottom: '24px' }}>We've sent a magic link to <span style={{ fontWeight: 600, color: theme.title }}>{email}</span></p>
              <button
                onClick={() => setMagicLinkSent(false)}
                className="hover:underline transition-all"
                style={{ color: theme.accent, fontWeight: 700, fontSize: '14px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Try another email
              </button>
            </div>
          ) : (
            <form onSubmit={currentSubmitHandler} className="space-y-5">
              {/* Email Field */}
              <div>
                <label
                  className="block mb-2"
                  style={{ fontSize: '12px', fontWeight: 600, color: theme.body, letterSpacing: '0.05em', textTransform: 'uppercase' }}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  placeholder="Enter your system email"
                  style={{
                    width: '100%',
                    background: theme.inputBg,
                    border: `1.5px solid ${theme.inputBorder}`,
                    borderRadius: '12px',
                    padding: '13px 16px',
                    fontSize: '15px',
                    color: theme.title,
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#22c55e'; e.target.style.boxShadow = '0 0 0 3px rgba(34,160,69,0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = theme.inputBorder; e.target.style.boxShadow = 'none'; }}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {/* Password Field */}
              {!isMagicLink && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                  <div className="flex justify-between items-center mb-2">
                    <label
                      className="block"
                      style={{ fontSize: '12px', fontWeight: 600, color: theme.body, letterSpacing: '0.05em', textTransform: 'uppercase' }}
                    >
                      Password
                    </label>
                    <Link
                      to="/forgot-password"
                      title="Reset your password"
                      className="transition-all"
                      style={{ fontSize: '12px', fontWeight: 600, color: theme.accent }}
                    >
                      Forgot password?
                    </Link>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      style={{
                        width: '100%',
                        background: theme.inputBg,
                        border: `1.5px solid ${theme.inputBorder}`,
                        borderRadius: '12px',
                        padding: '13px 16px',
                        paddingRight: '44px',
                        fontSize: '15px',
                        color: theme.title,
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                      }}
                      onFocus={(e) => { e.target.style.borderColor = '#22c55e'; e.target.style.boxShadow = '0 0 0 3px rgba(34,160,69,0.1)'; }}
                      onBlur={(e) => { e.target.style.borderColor = theme.inputBorder; e.target.style.boxShadow = 'none'; }}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}
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
                className="w-full flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                  color: '#ffffff',
                  borderRadius: '12px',
                  padding: '14px',
                  fontWeight: 600,
                  fontSize: '15px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(34,160,69,0.3)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(34,160,69,0.35)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(34,160,69,0.3)'; }}
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {!loading && (isMagicLink ? "Send Magic Link" : "Sign In")}
              </button>

              {/* Divider */}
              <div className="relative flex items-center py-2">
                <div className="flex-grow" style={{ borderTop: `1px solid ${theme.inputBorder}` }}></div>
                <span className="flex-shrink-0 mx-4" style={{ color: theme.muted, fontSize: '13px', fontWeight: 500 }}>Or</span>
                <div className="flex-grow" style={{ borderTop: `1px solid ${theme.inputBorder}` }}></div>
              </div>

              {/* Magic Link Toggle */}
              <button
                type="button"
                onClick={() => { setIsMagicLink(!isMagicLink); setError(""); }}
                className="w-full flex items-center justify-center gap-2 transition-all"
                style={{
                  background: theme.cardBg,
                  border: `1.5px solid ${isDark ? 'rgba(52, 211, 153, 0.3)' : '#d1fae5'}`,
                  color: theme.accentStrong,
                  borderRadius: '12px',
                  padding: '13px',
                  fontWeight: 500,
                  fontSize: '15px',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = theme.softGreen}
                onMouseLeave={(e) => e.currentTarget.style.background = theme.cardBg}
              >
                {isMagicLink ? "Sign in with Password" : "Sign in with Magic Link"}
              </button>

              {/* Create Account */}
              <p className="text-center" style={{ fontSize: '14px', color: theme.muted, marginTop: '32px' }}>
                Don't have an account?{" "}
                <Link to="/signup" className="hover:underline transition-all" style={{ color: theme.accent, fontWeight: 600 }}>
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
