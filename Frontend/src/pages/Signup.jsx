import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { supabase } from "../lib/supabaseClient";
import { Eye, EyeOff, BrainCircuit, ArrowRight, Loader2, CheckCircle2, ChevronDown, Search, Building2, ArrowLeft } from "lucide-react";

function Signup() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [companies, setCompanies] = useState([]);
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);

  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { signup, user, profile } = useAuthStore();

  useEffect(() => {
    const fetchCompanies = async () => {
      setIsLoadingCompanies(true);
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('status', 'active')
        .order('name');

      if (data) {
        setCompanies(data);
        setFilteredCompanies(data);
      }
      if (error) console.error("Error fetching companies:", error);
      setIsLoadingCompanies(false);
    };

    fetchCompanies();

    const channel = supabase
      .channel('public:companies')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'companies' },
        () => {
          fetchCompanies();
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (companySearch.trim() === "") {
      setFilteredCompanies(companies);
    } else {
      const lowerSearch = companySearch.toLowerCase();
      setFilteredCompanies(
        companies.filter((c) => c.name.toLowerCase().includes(lowerSearch))
      );
    }
  }, [companySearch, companies]);

  useEffect(() => {
    if (user && profile) {
      if (profile.role === 'admin' || profile.role === 'super_admin') {
        navigate("/admin/dashboard");
      } else if (profile.status === "active") {
        navigate("/dashboard");
      } else if (profile.status === "pending_approval") {
        navigate("/user-lobby");
      }
    }
  }, [user, profile, navigate]);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    const validatePassword = (pw) => {
      if (pw.length < 8) return 'Password must be at least 8 characters long.';
      if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter (a-z).';
      if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter (A-Z).';
      if (!/[0-9]/.test(pw)) return 'Password must contain at least one number (0-9).';
      return null;
    };

    if (!email || !password || !confirmPassword || !fullName) {
      setError("All fields are required.");
      return;
    }

    if (!selectedCompany) {
      setError("Please select your company.");
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);

    try {
      const newUser = await signup(
        email,
        password,
        fullName,
        'user',
        selectedCompany.name,
        { company_id: selectedCompany.id },
        window.location.origin + '/login'
      );

      if (newUser) {
        const updatedProfile = useAuthStore.getState().profile;
        if (updatedProfile?.status === 'pending_approval') {
          navigate('/user-lobby');
        } else {
          setSuccessMsg(`📧 Check your email! We sent a verification link to ${email}. After verifying your email, your request will be reviewed by your company admin.`);
        }
      }
    } catch (err) {
      console.error("Signup component error:", err);
      let errMsg = err.message || "Signup failed. Please try again.";
      if (errMsg.toLowerCase().includes("failed to fetch")) {
        errMsg = "Network Error: Failed to fetch. This usually happens if your browser's ad-blocker (like Brave Shields, uBlock Origin, etc.) is blocking Supabase requests. Please try disabling your ad-blocker for this site and refresh!";
      }
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successMsg) {
    return (
      <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-6 bg-gradient-to-br from-green-50 via-green-100/50 to-green-200 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950 font-sans transition-colors duration-300">
        <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none bg-radial from-emerald-500/10 dark:from-emerald-500/5 to-transparent blur-3xl" />
        <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl p-8 relative z-10 text-center shadow-xl dark:shadow-black/20 border border-emerald-50/50 dark:border-slate-700/50">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white mb-4 font-syne tracking-tight">Registration Successful</h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-8">{successMsg}</p>
          <Link
            to="/login"
            className="w-full flex items-center justify-center bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl p-3.5 text-sm font-semibold shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-6 py-12 bg-gradient-to-br from-green-50 via-green-100/50 to-green-200 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-950 font-sans transition-colors duration-300">
      <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none bg-radial from-emerald-500/10 dark:from-emerald-500/5 to-transparent blur-3xl" />

      {/* Back Button */}
      <Link
        to="/"
        className="absolute top-8 left-8 flex items-center gap-2 font-medium text-sm text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group"
      >
        <div className="p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-emerald-500/30">
          <ArrowLeft className="w-4 h-4" />
        </div>
        <span>Back to Home</span>
      </Link>

      <div className="w-full max-w-md relative z-10">
        {/* Logo Header */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-100 dark:border-emerald-900/30 transition">
            <BrainCircuit className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span className="font-extrabold text-lg text-slate-900 dark:text-white">HelpDesk.ai</span>
          </Link>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl dark:shadow-black/20 border border-emerald-50/50 dark:border-slate-700/50">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2 font-syne">Create Account</h2>
            <p className="text-slate-400 dark:text-slate-400 text-sm">Start automating your IT support today</p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl p-4">
              <div className="rounded-full p-1 mt-0.5 bg-red-100 dark:bg-red-900/50">
                <ArrowRight className="w-3 h-3 text-red-600 dark:text-red-400 rotate-45" />
              </div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400 leading-snug">{error}</p>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-5">
            {/* Company Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase mb-2">Company</label>
              <div 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full bg-slate-50 dark:bg-slate-950 border rounded-xl p-3 px-4 text-sm outline-none flex items-center justify-between transition-all duration-200 cursor-pointer ${
                  isDropdownOpen 
                    ? 'border-emerald-500 ring-4 ring-emerald-500/10 dark:ring-emerald-500/5' 
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {selectedCompany ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-950/50">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white">{selectedCompany.name}</span>
                  </div>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 font-medium">Select your company...</span>
                )}
                <ChevronDown className={`w-5 h-5 transition-transform text-slate-400 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </div>

              {isDropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-2 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
                    <Search className="w-4 h-4 ml-2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search companies..." 
                      className="w-full bg-transparent border-none outline-none text-sm p-1 text-slate-900 dark:text-white placeholder-slate-400"
                      value={companySearch} 
                      onChange={(e) => setCompanySearch(e.target.value)} 
                      onClick={(e) => e.stopPropagation()} 
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1 bg-white dark:bg-slate-900">
                    {isLoadingCompanies ? (
                      <div className="py-6 flex flex-col items-center justify-center gap-2 opacity-50">
                        <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin border-emerald-500"></div>
                        <span className="text-[12px] font-semibold text-slate-400">Loading companies...</span>
                      </div>
                    ) : filteredCompanies.length > 0 ? (
                      filteredCompanies.map((c) => (
                        <div 
                          key={c.id} 
                          onClick={() => { setSelectedCompany(c); setIsDropdownOpen(false); setCompanySearch(""); }}
                          className="px-3 py-2.5 rounded-lg cursor-pointer flex items-center gap-3 transition-colors hover:bg-emerald-50 dark:hover:bg-slate-800/60 group"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                            <Building2 className="w-4 h-4 text-slate-400 group-hover:text-emerald-500" />
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">{c.name}</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-6 text-center rounded-lg mx-1 my-1 text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/40 border border-dashed border-slate-200 dark:border-slate-800">
                        No companies found.<br />
                        <span className="text-[12px] text-slate-400 dark:text-slate-500 mt-1 block font-normal">Ask your IT Admin to register your company first.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase mb-2">Full Name</label>
              <input 
                type="text" 
                placeholder="Enter your name" 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 px-4 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:focus:ring-emerald-500/5 transition-all duration-200"
                value={fullName} 
                onChange={(e) => { setFullName(e.target.value); setError(""); }} 
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase mb-2">Email Address</label>
              <input 
                type="email" 
                placeholder="Enter your system email" 
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 px-4 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:focus:ring-emerald-500/5 transition-all duration-200"
                value={email} 
                onChange={(e) => { setEmail(e.target.value); setError(""); }} 
              />
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase mb-2">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Min 8 chars" 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 px-4 pr-11 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:focus:ring-emerald-500/5 transition-all duration-200"
                    value={password} 
                    onChange={(e) => { setPassword(e.target.value); setError(""); }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 cursor-pointer bg-transparent border-none"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2">
                    {[
                      { label: '8+ characters', ok: password.length >= 8 },
                      { label: 'Uppercase (A-Z)', ok: /[A-Z]/.test(password) },
                      { label: 'Lowercase (a-z)', ok: /[a-z]/.test(password) },
                      { label: 'Number (0-9)', ok: /[0-9]/.test(password) },
                    ].map(({ label, ok }) => (
                      <span key={label} className={`text-xs font-semibold flex items-center gap-1 transition-colors ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-400 dark:text-red-500'}`}>
                        <span>{ok ? '✓' : '○'}</span> {label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider uppercase mb-2">Confirm</label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="Repeat" 
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 px-4 pr-11 text-sm text-slate-900 dark:text-white outline-none focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:focus:ring-emerald-500/5 transition-all duration-200"
                    value={confirmPassword} 
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 cursor-pointer bg-transparent border-none"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Submit */}
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white rounded-xl p-3.5 text-sm font-semibold shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed hover:translate-y-[-1px] transition-all duration-200 cursor-pointer border-none mt-2"
            >
              {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
              {isSubmitting ? "Creating Profile..." : "Submit Registration"}
            </button>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-6">
              Already have an account?{" "}
              <Link to="/login" className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline transition-all">Login here</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Signup;