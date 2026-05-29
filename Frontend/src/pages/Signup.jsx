import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { supabase } from "../lib/supabaseClient";
import { Eye, EyeOff, BrainCircuit, ArrowRight, Loader2, CheckCircle2, ChevronDown, Search, Building2, ArrowLeft } from "lucide-react";
import { getPasswordValidation, getPasswordValidationMessage } from "../utils/passwordValidation";

function Signup() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Company Dropdown state
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
  const passwordRules = { minLength: 6 };
  const passwordChecks = getPasswordValidation(password, passwordRules);
  const passwordWarning = getPasswordValidationMessage(passwordChecks, passwordRules);
  const confirmPasswordWarning = confirmPassword && password !== confirmPassword ? "Passwords do not match." : "";

  // Fetch and subscribe to companies
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

    // Realtime subscription for companies
    const channel = supabase
      .channel('public:companies')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'companies' },
        () => {
          fetchCompanies(); // Refetch on any change
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Handle clicks outside dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter companies
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

  // Redirect if already logged in and active
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

    if (!email || !password || !confirmPassword || !fullName) {
      setError("All fields are required.");
      return;
    }

    if (!selectedCompany) {
      setError("Please select your company.");
      return;
    }

    if (passwordWarning) {
      setError(passwordWarning);
      return;
    }

    if (confirmPasswordWarning) {
      setError(confirmPasswordWarning);
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
        {
          company_id: selectedCompany.id
        },
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
        errMsg = "Network Error: Failed to fetch. This usually happens if your browser's ad-blocker is blocking Supabase requests. Please try disabling your ad-blocker for this site and refresh!";
      }
      setError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render Success State
  if (successMsg) {
    return (
      <div
        className="min-h-screen flex items-center justify-center relative overflow-hidden p-4 sm:p-6 font-inter bg-gradient-to-br from-green-50 via-green-100 to-green-200 dark:from-emerald-950 dark:via-slate-900 dark:to-emerald-950"
      >
        <div
          className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none bg-emerald-500/10 dark:bg-emerald-500/5 blur-[100px]"
        />
        <div className="w-full max-w-md bg-white dark:bg-gray-950 rounded-3xl p-8 relative z-10 text-center shadow-xl border border-green-50 dark:border-emerald-900/30">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 bg-green-50 dark:bg-emerald-500/10 border border-green-100 dark:border-emerald-500/20">
            <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-emerald-400" />
          </div>
          <h2 className="font-syne text-2xl font-extrabold text-slate-900 dark:text-white mb-4 italic uppercase tracking-tight">Registration Successful</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mb-8">{successMsg}</p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center w-full px-6 py-4 bg-gradient-to-r from-green-600 to-green-500 dark:from-emerald-600 dark:to-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-600/20 hover:shadow-green-600/30 transition-all active:scale-[0.98]"
          >
            Return to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden p-4 sm:p-6 py-12 font-inter bg-gradient-to-br from-green-50 via-green-100 to-green-200 dark:from-emerald-950 dark:via-slate-900 dark:to-emerald-950">
      <div className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none bg-emerald-500/10 dark:bg-emerald-500/5 blur-[100px]" />

      {/* Back Button */}
      <Link
        to="/"
        className="absolute top-6 left-6 sm:top-8 sm:left-8 flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-green-600 dark:hover:text-emerald-400 transition-colors group"
      >
        <div className="p-2 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 group-hover:border-green-200 dark:group-hover:border-emerald-500/30 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </div>
        <span className="hidden sm:inline">Back to Home</span>
      </Link>

      <div className="w-full max-w-md relative z-10">

        {/* Logo Header */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-600/10 dark:bg-emerald-500/10 border border-green-200 dark:border-emerald-500/20 backdrop-blur-sm transition-transform hover:scale-105">
            <BrainCircuit className="w-5 h-5 text-green-600 dark:text-emerald-400" />
            <span className="font-extrabold text-lg text-slate-900 dark:text-white italic uppercase tracking-tighter">HelpDesk.ai</span>
          </Link>
        </div>

        <div className="bg-white dark:bg-gray-950 rounded-[32px] p-6 sm:p-10 shadow-xl border border-green-50 dark:border-emerald-900/30">
          <div className="text-center mb-8">
            <h2 className="font-syne text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-2 uppercase italic">Create Account</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Start automating your IT support today</p>
          </div>

          {error && (
            <div className="mb-6 flex items-start gap-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="rounded-full p-1 mt-0.5 bg-red-100 dark:bg-red-900/40">
                <ArrowRight className="w-3 h-3 text-red-600 dark:text-red-400 rotate-45" />
              </div>
              <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-5">
            {/* Company Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <label className="block mb-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Company</label>
              <div 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`w-full flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 border rounded-xl px-4 py-3 cursor-pointer transition-all ${isDropdownOpen ? 'border-green-500 ring-2 ring-green-500/20' : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'}`}
              >
                {selectedCompany ? (
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-green-50 dark:bg-emerald-500/10">
                      <Building2 className="w-3.5 h-3.5 text-green-600 dark:text-emerald-400" />
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white text-sm">{selectedCompany.name}</span>
                  </div>
                ) : (<span className="text-slate-400 dark:text-slate-600 text-sm font-medium">Select your company...</span>)}
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180 text-green-500' : ''}`} />
              </div>

              {isDropdownOpen && (
                <div className="absolute z-50 top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <div className="p-2 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <Search className="w-4 h-4 ml-2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search companies..." 
                      className="w-full bg-transparent border-none outline-none text-sm py-2 text-slate-900 dark:text-white placeholder:text-slate-400"
                      value={companySearch} 
                      onChange={(e) => setCompanySearch(e.target.value)} 
                      onClick={(e) => e.stopPropagation()} 
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                    {isLoadingCompanies ? (
                      <div className="py-8 flex flex-col items-center justify-center gap-3 opacity-60">
                        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Syncing companies...</span>
                      </div>
                    ) : filteredCompanies.length > 0 ? (
                      filteredCompanies.map((c) => (
                        <div 
                          key={c.id} 
                          onClick={() => { setSelectedCompany(c); setIsDropdownOpen(false); setCompanySearch(""); }}
                          className="px-3 py-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all hover:bg-green-50 dark:hover:bg-emerald-500/10 group"
                        >
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 group-hover:border-green-200 dark:group-hover:border-emerald-500/30 transition-colors">
                            <Building2 className="w-4 h-4 text-slate-400 group-hover:text-green-600 dark:group-hover:text-emerald-400 transition-colors" />
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{c.name}</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-center rounded-xl mx-1 my-1 bg-slate-50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800">
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-500">No companies found</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1 font-medium italic">Ask your admin to register your organization first.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Full Name */}
            <div>
              <label className="block mb-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Full Name</label>
              <input 
                type="text" 
                placeholder="Enter your name" 
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 dark:focus:border-emerald-500/50 transition-all"
                value={fullName} 
                onChange={(e) => { setFullName(e.target.value); setError(""); }} 
              />
            </div>

            {/* Email */}
            <div>
              <label className="block mb-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Email Address</label>
              <input 
                type="email" 
                placeholder="Enter your system email" 
                className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 dark:focus:border-emerald-500/50 transition-all"
                value={email} 
                onChange={(e) => { setEmail(e.target.value); setError(""); }} 
              />
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className="block mb-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    placeholder="Min 6 chars" 
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 dark:focus:border-emerald-500/50 transition-all"
                    value={password} 
                    onChange={(e) => { setPassword(e.target.value); setError(""); }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {password && (
                  <p aria-live="polite" className={`mt-2 text-[10px] font-bold tracking-tight uppercase ${passwordWarning ? "text-red-500" : "text-emerald-600 dark:text-emerald-400"}`}>
                    {passwordWarning || "Password Secure"}
                  </p>
                )}
              </div>
              <div className="relative">
                <label className="block mb-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Confirm</label>
                <div className="relative">
                  <input 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="Repeat" 
                    className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 pr-11 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 dark:focus:border-emerald-500/50 transition-all"
                    value={confirmPassword} 
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }} 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPasswordWarning && (
                  <p aria-live="polite" className="mt-2 text-[10px] font-bold tracking-tight uppercase text-red-500">
                    Mismatch
                  </p>
                )}
              </div>
            </div>

            {/* Submit */}
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full mt-4 py-4 bg-gradient-to-r from-green-600 to-green-500 dark:from-emerald-600 dark:to-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-green-600/20 hover:shadow-green-600/30 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
              {isSubmitting ? "Processing..." : "Submit Registration"}
            </button>

            <p className="text-center text-sm text-slate-500 dark:text-slate-400 pt-4">
              Already have an account?{" "}
              <Link to="/login" className="text-green-600 dark:text-emerald-400 font-bold hover:underline underline-offset-4 transition-all">Login here</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Signup;
