import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BrainCircuit, Upload, X, ImageIcon, ArrowRight, AlertCircle, Sparkles, ChevronRight, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import useTicketStore from "../store/ticketStore";
import { api } from "../services/api";

function Submit() {
  const [issue, setIssue] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("api-integration");
  const [file, setFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  const navigate = useNavigate();
  const setAITicket = useTicketStore((state) => state.setAITicket);
  const setActiveTicket = useTicketStore((state) => state.setActiveTicket);
  const currentUser = JSON.parse(sessionStorage.getItem("currentUser") || "{}");

  const location = useLocation();
  const locationState = location.state || {};

  useEffect(() => {
    setActiveTicket(null);
    if (!currentUser || !currentUser.username) {
      navigate("/login");
    }

    if (locationState.prefilledCategory) {
      setCategory(locationState.prefilledCategory.toLowerCase());
    }
  }, [currentUser, navigate, locationState.prefilledCategory]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setFile(selected);
    setImagePreview(URL.createObjectURL(selected));
  };

  const handleRemoveImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!issue.trim() || !title.trim()) {
      setError("Please provide a title and describe your issue before submitting.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      let imageBase64 = "";
      if (file) {
        imageBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
          };
          reader.readAsDataURL(file);
        });
      }

      const fullIssue = `Title: ${title}\nCategory: ${category}\n\nDescription:\n${issue}`;
      const response = await api.predictTicket(fullIssue, imageBase64);
      const ticketData = response.data;

      setAITicket({
        ...ticketData,
        originalIssue: fullIssue,
        capturedFile: file
      });

      navigate("/ai-understanding");
    } catch (_err) {
      setError("AI Analysis failed. Please try again.");
      loading => setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-start py-12 px-4 sm:px-6 bg-white dark:bg-slate-900 transition-colors duration-300 min-h-screen">
        <main className="flex-1 flex flex-col items-center justify-start py-12 px-4 sm:px-6 w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-[680px] flex flex-col gap-6"
          >
            <div className="flex items-center gap-2 text-sm text-[var(--stitch-text-muted,#618975)] dark:text-slate-400">
              <span>Support</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-[var(--stitch-text-main,#111814)] dark:text-white font-medium">New Ticket</span>
            </div>

            <div className="bg-[var(--stitch-surface-light,#ffffff)] dark:bg-slate-800 rounded-[var(--stitch-radius,0.5rem)] shadow-lg border border-[var(--stitch-border-light,#e2e8e5)] dark:border-slate-700 overflow-hidden transition-colors duration-300">
              <div className="relative h-48 w-full bg-slate-100 dark:bg-slate-950 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-[var(--stitch-primary,#13ec80)]/20 to-blue-500/20 mix-blend-multiply"></div>
                <div className="w-full h-full bg-gradient-to-br from-[var(--stitch-background-light,#f6f8f7)] dark:from-slate-900 to-slate-200 dark:to-slate-950 opacity-80"></div>
                <div className="absolute bottom-0 left-0 w-full p-6 bg-gradient-to-t from-black/60 to-transparent">
                  <h1 className="text-white text-2xl font-bold tracking-tight">Describe your issue</h1>
                  <p className="text-white/90 text-sm mt-1">Our AI agent focuses on this issue instantly.</p>
                </div>
              </div>

              <div className="p-8 flex flex-col gap-6">
                <div className="space-y-6 opacity-60 pointer-events-none select-none grayscale-[0.5]">
                  <div className="flex flex-col gap-2 text-left">
                    <label className="text-[var(--stitch-text-main,#111814)] dark:text-white text-sm font-bold">Issue Title</label>
                    <input
                      type="text"
                      className="w-full h-11 rounded-lg border border-[var(--stitch-border-light,#e2e8e5)] dark:border-slate-700 bg-[var(--stitch-background-light,#f6f8f7)] dark:bg-slate-950 text-[var(--stitch-text-main,#111814)] dark:text-white px-4 text-base outline-none"
                      readOnly
                      value={title}
                    />
                  </div>

                  <div className="flex flex-col gap-2 text-left">
                    <label className="text-[var(--stitch-text-main,#111814)] dark:text-white text-sm font-bold">Detailed Description</label>
                    <textarea
                      className="w-full rounded-lg border border-[var(--stitch-border-light,#e2e8e5)] dark:border-slate-700 bg-[var(--stitch-background-light,#f6f8f7)] dark:bg-slate-950 text-[var(--stitch-text-main,#111814)] dark:text-white px-4 py-3 text-base min-h-[140px] resize-none outline-none"
                      readOnly
                      value={issue}
                    />
                  </div>

                  {file && (
                    <div className="flex flex-col gap-2 text-left">
                      <label className="text-[var(--stitch-text-main,#111814)] dark:text-white text-sm font-bold">Attachments</label>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--stitch-border-light,#e2e8e5)] dark:border-slate-700 bg-[var(--stitch-background-light,#f6f8f7)] dark:bg-slate-950">
                        <div className="size-10 rounded bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 overflow-hidden">
                          {imagePreview ? <img src={imagePreview} className="w-full h-full object-cover" /> : <ImageIcon />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--stitch-text-main,#111814)] dark:text-white truncate">{file.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                        </div>
                        <Sparkles className="text-[var(--stitch-primary,#13ec80)] w-5 h-5" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-px w-full bg-[var(--stitch-border-light,#e2e8e5)] dark:bg-slate-700"></div>

                <div className="flex flex-col items-center justify-center py-6 gap-4 animate-pulse">
                  <div className="relative flex items-center justify-center size-16">
                    <div className="absolute inset-0 border-4 border-[var(--stitch-border-light,#e2e8e5)] dark:border-slate-700 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-[var(--stitch-primary,#13ec80)] border-t-transparent rounded-full animate-spin"></div>
                    <BrainCircuit className="text-[var(--stitch-primary,#13ec80)] w-8 h-8" />
                  </div>
                  <div className="text-center space-y-1">
                    <h3 className="text-lg font-bold text-[var(--stitch-text-main,#111814)] dark:text-white">Analyzing text {file && "and screenshot"}...</h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">Identifying potential solutions and error codes.</p>
                  </div>
                  <div className="w-full max-w-xs h-1.5 bg-[var(--stitch-border-light,#e2e8e5)] dark:bg-slate-700 rounded-full overflow-hidden mt-2 relative">
                    <motion.div
                      className="absolute top-0 left-0 h-full bg-[var(--stitch-primary,#13ec80)] shadow-[0_0_10px_rgba(19,236,128,0.5)]"
                      initial={{ width: "20%" }}
                      animate={{ width: "85%" }}
                      transition={{ duration: 4, ease: "easeInOut" }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-2">
              HelpDesk AI uses advanced models to process your data securely.
            </p>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <main className="flex-1 flex justify-center py-10 px-4 sm:px-6 bg-white dark:bg-slate-900 min-h-screen transition-colors duration-300">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-[680px]"
      >
        <nav className="flex items-center gap-2 text-sm text-[var(--stitch-text-muted,#618975)] dark:text-slate-400 mb-6">
          <span className="hover:text-[var(--stitch-primary,#13ec80)] transition-colors cursor-pointer" onClick={() => navigate('/')}>Home</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-[var(--stitch-text-main,#111814)] dark:text-white font-medium">New Ticket</span>
        </nav>

        <div className="bg-[var(--stitch-surface-light,#ffffff)] dark:bg-slate-800 rounded-[var(--stitch-radius,0.5rem)] shadow-xl border border-[var(--stitch-border-light,#e2e8e5)] dark:border-slate-700 overflow-hidden p-6 sm:p-10 transition-colors duration-300">
          <div className="flex flex-col gap-3 mb-8 text-left">
            <div className="flex items-center gap-3">
              <span className="bg-[var(--stitch-primary,#13ec80)]/20 text-emerald-700 dark:text-emerald-300 p-2 rounded-lg">
                <Sparkles className="w-6 h-6 text-[#0fd472]" />
              </span>
              <h2 className="text-3xl font-bold text-[var(--stitch-text-main,#111814)] dark:text-white tracking-tight font-syne">Describe Your Issue</h2>
            </div>
            <p className="text-[var(--stitch-text-muted,#618975)] dark:text-slate-400 text-base leading-relaxed sm:pl-[52px]">
              Our AI will analyze your description and guide you instantly towards a solution. The more details you provide, the better the assistance.
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 dark:bg-red-950/30 border text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/50 text-sm p-4 rounded-xl flex items-center gap-2 mb-6 text-left"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <p className="m-0 font-medium">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6 text-left">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-[var(--stitch-text-main,#111814)] dark:text-white" htmlFor="ticket-title">
                Issue Title
              </label>
              <input
                id="ticket-title"
                type="text"
                className="w-full h-12 px-4 rounded-xl border border-[var(--stitch-border-light,#e2e8e5)] dark:border-slate-700 bg-white dark:bg-slate-950 text-[var(--stitch-text-main,#111814)] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-base focus:outline-none focus:ring-2 focus:ring-[var(--stitch-primary,#13ec80)]/50 focus:border-[var(--stitch-primary,#13ec80)] transition-all shadow-sm"
                placeholder="Give your issue a short, descriptive title..."
                value={title}
                onChange={(e) => { setTitle(e.target.value); setError(""); }}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-bold text-[var(--stitch-text-main,#111814)] dark:text-white" htmlFor="issue-description">
                Issue Description
              </label>
              <div className="relative group">
                <textarea
                  id="issue-description"
                  className="w-full min-h-[160px] p-4 rounded-xl border border-[var(--stitch-border-light,#e2e8e5)] dark:border-slate-700 bg-white dark:bg-slate-950 text-[var(--stitch-text-main,#111814)] dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-base leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[var(--stitch-primary,#13ec80)]/50 focus:border-[var(--stitch-primary,#13ec80)] transition-all shadow-sm"
                  placeholder="Please describe the problem you're facing, including any error messages..."
                  value={issue}
                  onChange={(e) => { setIssue(e.target.value); setError(""); }}
                  disabled={loading}
                />
                <div className="absolute bottom-3 right-3 cursor-pointer">
                  <Mic className="w-6 h-6 text-slate-400 dark:text-slate-600 hover:text-[var(--stitch-primary,#13ec80)] transition-colors" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-bold text-[var(--stitch-text-main,#111814)] dark:text-white">
                Attachments (Optional)
              </span>

              <AnimatePresence mode="popLayout">
                {!imagePreview ? (
                  <motion.div
                    key="upload"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="group relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-[var(--stitch-border-light,#e2e8e5)] dark:border-slate-700 rounded-xl bg-[var(--stitch-background-light,#f6f8f7)]/50 dark:bg-slate-950/40 hover:bg-[var(--stitch-background-light,#f6f8f7)] dark:hover:bg-slate-950/80 hover:border-[var(--stitch-primary,#13ec80)]/50 transition-all cursor-pointer"
                  >
                    <label htmlFor="file-upload" className="flex flex-col items-center justify-center pt-5 pb-6 w-full h-full cursor-pointer">
                      <div className="bg-white dark:bg-slate-800 p-3 rounded-full shadow-sm mb-3 group-hover:scale-110 transition-transform duration-200 border border-slate-100 dark:border-slate-700">
                        <Upload className="text-[var(--stitch-primary,#13ec80)] w-6 h-6" />
                      </div>
                      <p className="mb-1 text-sm text-[var(--stitch-text-main,#111814)] dark:text-white font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-[var(--stitch-text-muted,#618975)] dark:text-slate-500">SVG, PNG, JPG or GIF (max. 10MB)</p>
                    </label>
                    <input
                      id="file-upload"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={loading}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="relative rounded-xl border overflow-hidden bg-white dark:bg-slate-950 shadow-sm group border-[var(--stitch-primary,#13ec80)]"
                  >
                    <div className="flex items-center gap-4 p-4">
                      <div className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 shadow-inner bg-slate-50 dark:bg-slate-900">
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <ImageIcon size={16} className="text-[var(--stitch-primary,#13ec80)] shrink-0" />
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate m-0">{file.name}</p>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 m-0">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="shrink-0 flex items-center justify-center w-8 h-8 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-full transition-all border-none bg-transparent cursor-pointer"
                        disabled={loading}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700/60">
              <span className="text-sm font-semibold text-[var(--stitch-text-muted,#618975)] dark:text-slate-400">Detected Priority</span>
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500 bg-[var(--stitch-background-light,#f6f8f7)] dark:bg-slate-950 px-2.5 py-1 rounded border border-[var(--stitch-border-light,#e2e8e5)] dark:border-slate-800">Auto-Assigned</span>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[var(--stitch-primary,#13ec80)] hover:bg-[#0fd472] text-[var(--stitch-text-main,#111814)] font-bold text-base rounded-[var(--stitch-radius,0.5rem)] shadow-[0_4px_14px_0_rgba(19,236,128,0.39)] hover:shadow-[0_6px_20px_rgba(19,236,128,0.23)] hover:translate-y-[-1px] active:translate-y-[0px] transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:hover:translate-y-0 cursor-pointer border-none"
              >
                <span>{file ? "Analyze Text & Image" : "Analyze Issue"}</span>
                <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-[var(--stitch-text-muted,#618975)] dark:text-slate-500 mt-8">
          By submitting this ticket, you agree to allow our AI to process your data according to our <span className="underline hover:text-[var(--stitch-primary,#13ec80)] cursor-pointer">Privacy Policy</span>.
        </p>
      </motion.div>
    </main>
  );
}

export default Submit;