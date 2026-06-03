import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText, Database, Zap,
    CheckCircle2, AlertTriangle, ArrowRight,
    Lightbulb, SearchX, TicketCheck, Search, Bell, Link2
} from 'lucide-react';
import useTicketStore from '../../store/ticketStore';
import { API_CONFIG } from '../../config';
import { supabase } from '../../lib/supabaseClient';

// ─── Shimmer Skeleton ─────────────────────────────────────────────────────────
const Shimmer = ({ className = '' }) => (
  <div className={`relative overflow-hidden rounded-xl bg-slate-100 ${className}`}>
    <div className='absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[shimmer_1.5s_infinite]' />
  </div>
);

const SkeletonLoader = () => (
  <div className='min-h-screen bg-[#f6f8f7] pb-20 pt-28 px-6'>
    <style>{`@keyframes shimmer{100%{transform:translateX(100%)}}`}</style>
    <div className='w-full max-w-[820px] mx-auto space-y-8'>
      <Shimmer className='h-44 w-full rounded-3xl' />
      <Shimmer className='h-52 w-full rounded-3xl' />
      <Shimmer className='h-36 w-full rounded-3xl' />
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const DuplicateDetection = () => {
  const navigate = useNavigate();
  const aiTicket = useTicketStore((state) => state.aiTicket);
  const [isLoading, setIsLoading] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [countdown, setCountdown] = useState(2);
  const [totalCases, setTotalCases] = useState('10,000+');

  // ─── Animated Step Pipeline (Dynamic) ───────────────────────────────────────────
  const pipelineSteps = [
    { icon: FileText, label: 'Your Issue', desc: 'Captured & analysed' },
    { icon: Database, label: 'Case History', desc: `Scanned ${totalCases} cases` },
    { icon: Zap, label: 'Match Found', desc: 'Similarity calculated' },
  ];

  // Fetch dynamic case count from Supabase database
  useEffect(() => {
    const fetchCaseCount = async () => {
      try {
        if (supabase) {
          const { count, error } = await supabase
            .from('tickets')
            .select('id', { count: 'exact', head: true });
          if (!error && count != null) {
            setTotalCases(count.toLocaleString());
          }
        }
      } catch (err) {
        console.warn(
          '[DuplicateDetection] Failed to fetch live case count fallback to default:',
          err
        );
      }
    };
    fetchCaseCount();
  }, []);

  // Loading delay + step animation
  useEffect(() => {
    const t0 = setTimeout(() => setIsLoading(false), 600);
    const t1 = setTimeout(() => setActiveStep(1), 900);
    const t2 = setTimeout(() => setActiveStep(2), 1700);
    return () => [t0, t1, t2].forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (!isLoading && !aiTicket) navigate('/create-ticket');
  }, [isLoading, aiTicket, navigate]);

    const isDuplicate = aiTicket?.duplicate_ticket?.is_duplicate === true;
    const duplicateParentTicketId = aiTicket?.parent_ticket_id || aiTicket?.duplicate_ticket?.parent_ticket_id || aiTicket?.duplicate_ticket?.duplicate_ticket_id;

  // Auto-redirect when no duplicate
  useEffect(() => {
    if (isLoading || !aiTicket || isDuplicate) return;
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading, aiTicket, isDuplicate]);

  const duplicate = aiTicket?.duplicate_ticket || {};
  const similarity = duplicate.similarity ? Math.round(duplicate.similarity * 100) : 0;

  // ── Dynamic solution steps — from AI data, no hardcoding ──────────────────
  let resolutionSteps = null;
  const rawSteps =
    aiTicket?.resolution_steps ||
    aiTicket?.suggested_solution ||
    aiTicket?.solution_steps ||
    duplicate.solution_steps ||
    null;

  if (Array.isArray(rawSteps) && rawSteps.length > 0) {
    resolutionSteps = rawSteps;
  } else if (typeof rawSteps === 'string' && rawSteps.trim()) {
    resolutionSteps = rawSteps
      .split(/\n+/)
      .map((s) => s.replace(/^\d+[.)]/, '').trim())
      .filter(Boolean);
  }

  const handleCreateTicket = useCallback(async () => {
    if (!aiTicket) return;
    setIsLoading(true);
    try {
      // Forward user to TicketTracking to handle the actual creation
      navigate('/ticket-tracking', { state: { resolutionSteps } });
    } catch (err) {
      console.error('Failed to navigate to tracking:', err);
      navigate('/create-ticket');
    } finally {
      setIsLoading(false);
    }
  }, [aiTicket, navigate, resolutionSteps]);

  // Navigate when countdown reaches 0
  useEffect(() => {
    if (countdown === 0 && !isDuplicate && aiTicket) {
      handleCreateTicket();
    }
  }, [countdown, isDuplicate, aiTicket, handleCreateTicket]);

  if (isLoading) return <SkeletonLoader />;
  if (!aiTicket) return null;

    if (isLoading) return <SkeletonLoader />;
    if (!aiTicket) return null;

    return (
        <div className="min-h-screen bg-slate-950 pb-20 pt-28 px-4 sm:px-6 relative overflow-hidden font-sans">
            <style dangerouslySetInnerHTML={{ __html: `@keyframes knowledgeScan{0%{left:0%;opacity:0}10%{opacity:1}90%{opacity:1}100%{left:100%;opacity:0}}` }} />
            
            {/* Ambient Background Matrix */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.02]" 
                 style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />

            <div className="w-full max-w-4xl mx-auto space-y-8 relative z-10 text-left">

                {/* ── Premium Dark Hero Header ──────────────────────────── */}
                <div className="relative rounded-[2.5rem] overflow-hidden bg-white/[0.02] border border-white/[0.08] backdrop-blur-xl px-6 sm:px-10 py-10 shadow-2xl">
                    {/* Scanning beam line element */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <div className="absolute top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-emerald-400/50 to-transparent"
                            style={{ animation: 'knowledgeScan 3.5s ease-in-out infinite' }} />
                    </div>

                    <div className="relative z-10">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-5">
                            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.18em]">Analyzing History</span>
                        </div>

                        <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mb-2 font-syne uppercase">
                            Scanning our <span className="text-emerald-400">case history</span>
                        </h1>
                        <p className="text-slate-400 text-sm sm:text-base font-medium max-w-xl leading-relaxed mb-10">
                            We cross-reference historical database clusters to evaluate whether a matching solution node exists for your context boundaries.
                        </p>

                        {/* ── Animated step nodes ── */}
                        <div className="flex items-center overflow-x-auto customize-scrollbar pb-2">
                            {pipelineSteps.map((step, i) => {
                                const Icon = step.icon;
                                const done = i <= activeStep;
                                const active = i === activeStep;
                                return (
                                    <React.Fragment key={i}>
                                        <div className={`flex flex-col items-center text-center transition-all duration-700 min-w-[90px] ${done ? 'opacity-100' : 'opacity-20'}`}>
                                            <div className="relative mb-3">
                                                {active && (
                                                    <>
                                                        <span className="absolute inset-0 rounded-2xl bg-emerald-500/40 animate-ping" />
                                                        <span className="absolute -inset-2 rounded-3xl bg-emerald-500/10 blur-md" />
                                                    </>
                                                )}
                                                <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500
                                                    ${active ? 'bg-emerald-500 text-slate-950 scale-110 shadow-emerald-500/20 border-emerald-400'
                                                        : done ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                            : 'bg-white/5 text-slate-600 border border-white/5'}`}>
                                                    <Icon size={20} />
                                                </div>
                                            </div>
                                            <p className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1 transition-colors duration-500
                                                ${active ? 'text-white' : done ? 'text-slate-300' : 'text-slate-600'}`}>
                                                {step.label}
                                            </p>
                                            <p className={`text-[11px] font-medium hidden sm:block transition-colors duration-500 m-0 whitespace-nowrap
                                                ${active ? 'text-emerald-400' : 'text-slate-500'}`}>
                                                {step.desc}
                                            </p>
                                        </div>
                                        {i < pipelineSteps.length - 1 && (
                                            <div className="flex-1 mx-4 mt-[-28px] relative h-px min-w-[30px]">
                                                <div className="absolute inset-0 bg-white/5 rounded-full" />
                                                <div className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-700"
                                                    style={{ width: i < activeStep ? '100%' : '0%', boxShadow: '0 0 8px rgba(16,185,129,0.4)' }} />
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ── Match / No-match result card ─────────────────────── */}
                <AnimatePresence mode="wait">
                    {isDuplicate ? (
                        <motion.div 
                            key="duplicate"
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/[0.08] shadow-2xl overflow-hidden"
                        >
                            <div className="px-6 sm:px-8 py-6 bg-amber-500/5 border-b border-white/[0.05] flex items-start gap-4 text-left">
                                <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl shrink-0">
                                    <AlertTriangle className="w-5 h-5 text-amber-400" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-base font-black text-white font-syne uppercase tracking-wider m-0">Similar Issue Isolated</h2>
                                    <p className="text-sm text-slate-400 m-0 font-medium leading-relaxed">
                                        We identified a previously resolved ticket pattern mapping that is{' '}
                                        <span className="text-amber-400 font-extrabold">{similarity}% identical</span> to your current incident signature.
                                    </p>
                                </div>
                            </div>

                            <div className="p-6 sm:p-8 space-y-6">
                                <div className="bg-white/[0.01] rounded-2xl border border-white/[0.05] p-5 space-y-4 text-left">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                            <TicketCheck size={14} className="text-emerald-400" />
                                            <span>Matched Ticket Base</span>
                                        </div>
                                        <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-400 text-[10px] font-black rounded-full uppercase tracking-widest border border-emerald-500/20">
                                            Resolved
                                        </span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-300 leading-relaxed m-0 font-medium">
                                        #{duplicate.duplicate_ticket_id || '—'} — {aiTicket.summary}
                                    </p>

                                    <div className="space-y-1.5 pt-2 border-t border-white/5">
                                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                                            <span className="text-slate-500">Proximity Vector Match</span>
                                            <span className="text-emerald-400 font-mono">{similarity}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden shadow-inner">
                                            <div className={`h-full rounded-full transition-all duration-1000 ${similarity >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}
                                                style={{ width: `${similarity}%` }} />
                                        </div>
                                    </div>
                                </div>

                                {resolutionSteps && resolutionSteps.length > 0 && (
                                    <div className="space-y-4 text-left">
                                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">
                                            <Lightbulb size={14} className="text-amber-400" />
                                            <span>Suggested Automated Resolution Steps</span>
                                        </div>
                                        <ol className="space-y-3 m-0 p-0 list-none">
                                            {resolutionSteps.map((step, i) => (
                                                <li key={i} className="flex items-start gap-4 p-4 bg-white/[0.01] border border-white/[0.05] rounded-2xl shadow-inner">
                                                    <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                                                        {i + 1}
                                                    </span>
                                                    <span className="text-sm font-medium text-slate-300 leading-relaxed">{step}</span>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-4 pt-2">
                                    <button onClick={() => navigate('/auto-resolve')}
                                        className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-xl shadow-emerald-600/10 flex items-center justify-center gap-2 border-none cursor-pointer">
                                        <CheckCircle2 size={16} />
                                        <span>Deploy Automated Assistant Flow</span>
                                    </button>
                                    <button onClick={handleCreateTicket}
                                        className="flex-1 h-12 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer">
                                        <span>Override & Create New Ticket</span>
                                        <ArrowRight size={14} className="text-slate-400" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div 
                            key="nomatch"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/[0.08] p-6 sm:p-8 flex items-center gap-5 text-left shadow-2xl"
                        >
                            <div className="w-14 h-14 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
                                <SearchX className="w-6 h-6 text-slate-500" />
                            </div>
                            <div className="space-y-0.5">
                                <h2 className="text-lg font-black text-white font-syne uppercase tracking-tight m-0">Zero Duplicate Signatures Isolated</h2>
                                <p className="text-sm text-slate-400 font-medium m-0 leading-relaxed">
                                    This incident appears uniquely segmented. Routing processing token down submission paths in{' '}
                                    <span className="font-mono font-black text-emerald-400">{countdown}s</span>...
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

          <div className='relative z-10'>
            {/* Live badge */}
            <div className='inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/25 rounded-full mb-5'>
              <span className='w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse' />
              <span className='text-[10px] font-black text-emerald-400 uppercase tracking-[0.18em]'>
                Analyzing History
              </span>
            </div>

            <h1 className='text-2xl md:text-3xl font-black text-white tracking-tight mb-1.5'>
              Scanning our <span className='text-emerald-400'>case history</span>
            </h1>
            <p className='text-slate-400 text-sm font-medium mb-9'>
              We searched previous issues to see if this problem was already solved.
            </p>

            {/* ── Animated step nodes ── */}
            <div className='flex items-center'>
              {pipelineSteps.map((step, i) => {
                const Icon = step.icon;
                const done = i <= activeStep;
                const active = i === activeStep;
                return (
                  <React.Fragment key={i}>
                    <div
                      className={`flex flex-col items-center text-center transition-all duration-700 ${done ? 'opacity-100' : 'opacity-20'}`}
                    >
                      <div className='relative mb-3'>
                        {active && (
                          <>
                            <span className='absolute inset-0 rounded-2xl bg-emerald-500/40 animate-ping' />
                            <span className='absolute -inset-2 rounded-3xl bg-emerald-500/10 blur-lg' />
                          </>
                        )}
                        <div
                          className={`relative w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all duration-500
                                                    ${
                                                      active
                                                        ? 'bg-emerald-500 text-white scale-110 shadow-emerald-500/50'
                                                        : done
                                                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                          : 'bg-white/5 text-slate-500 border border-white/10'
                                                    }`}
                        >
                          <Icon size={22} />
                        </div>
                      </div>
                      <p
                        className={`text-[11px] font-black uppercase tracking-widest leading-none mb-1 transition-colors duration-500
                                                ${active ? 'text-white' : done ? 'text-slate-300' : 'text-slate-600'}`}
                      >
                        {step.label}
                      </p>
                      <p
                        className={`text-[10px] font-medium hidden sm:block transition-colors duration-500
                                                ${active ? 'text-emerald-400' : 'text-slate-500'}`}
                      >
                        {step.desc}
                      </p>
                    </div>
                    {i < pipelineSteps.length - 1 && (
                      <div className='flex-1 mx-4 mt-[-28px] relative h-[2px]'>
                        <div className='absolute inset-0 bg-white/10 rounded-full' />
                        <div
                          className='absolute inset-y-0 left-0 bg-emerald-400 rounded-full transition-all duration-700'
                          style={{
                            width: i < activeStep ? '100%' : '0%',
                            boxShadow: '0 0 6px rgba(52,211,153,0.5)',
                          }}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Match / No-match result card ─────────────────────── */}
        {isDuplicate ? (
          <div className='bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden'>
            {/* Card header */}
            <div className='px-8 py-6 bg-amber-50 border-b border-amber-100 flex items-start gap-4'>
              <div className='p-2.5 bg-amber-100 rounded-xl shrink-0'>
                <AlertTriangle className='w-5 h-5 text-amber-600' />
              </div>
              <div>
                <h2 className='text-base font-black text-amber-900 tracking-tight'>
                  Similar Issue Found
                </h2>
                <p className='text-sm text-amber-700/80 mt-0.5 font-medium'>
                  We found a previously resolved ticket that is{' '}
                  <strong className='text-amber-900'>{similarity}% similar</strong> to your issue.
                </p>
              </div>
            </div>

            <div className='p-8 space-y-6'>
              {/* Matched ticket chip */}
              <div className='bg-slate-50 rounded-2xl border border-slate-100 p-5 space-y-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest'>
                    <TicketCheck size={14} className='text-emerald-500' />
                    Matched Ticket
                  </div>
                  <span className='px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-widest'>
                    Resolved
                  </span>
                </div>
                <p className='text-sm font-bold text-slate-700 leading-relaxed'>
                  #{duplicate.duplicate_ticket_id || '—'} — {aiTicket.summary}
                </p>

                {/* Similarity bar */}
                <div className='space-y-1.5'>
                  <div className='flex justify-between'>
                    <span className='text-[10px] font-black text-slate-400 uppercase tracking-widest'>
                      Similarity
                    </span>
                    <span className='text-xs font-black text-emerald-600'>{similarity}%</span>
                  </div>
                  <div className='w-full h-2 bg-slate-200 rounded-full overflow-hidden'>
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ${similarity >= 80 ? 'bg-emerald-500' : similarity >= 50 ? 'bg-amber-500' : 'bg-slate-400'}`}
                      style={{ width: `${similarity}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Suggested Solution — only shown if AI provides steps */}
              {resolutionSteps && resolutionSteps.length > 0 && (
                <div className='space-y-4'>
                  <div className='flex items-center gap-2'>
                    <Lightbulb size={15} className='text-amber-500' />
                    <h3 className='text-xs font-black text-slate-800 uppercase tracking-widest'>
                      Suggested Solution
                    </h3>
                  </div>
                  <ol className='space-y-2.5'>
                    {resolutionSteps.map((step, i) => (
                      <li
                        key={i}
                        className='flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100'
                      >
                        <span className='w-6 h-6 rounded-lg bg-emerald-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5'>
                          {i + 1}
                        </span>
                        <span className='text-sm font-medium text-slate-700 leading-relaxed'>
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Actions */}
              <div className='flex flex-col sm:flex-row gap-3 pt-1'>
                <button
                  onClick={() => navigate('/auto-resolve')}
                  className='flex-1 bg-emerald-600 text-white px-6 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2'
                >
                  <CheckCircle2 size={16} />
                  Try This Solution
                </button>
                <button
                  onClick={handleCreateTicket}
                  className='flex-1 bg-white border border-slate-200 text-slate-700 px-6 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2'
                >
                  Create New Ticket
                  <ArrowRight size={16} className='text-slate-400' />
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ── No duplicate found ── */
          <div className='bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 p-8 flex items-center gap-5'>
            <div className='w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center shrink-0'>
              <SearchX className='w-7 h-7 text-slate-400' />
            </div>
            <div>
              <h2 className='text-lg font-black text-slate-900 mb-1'>No previous match found</h2>
              <p className='text-sm text-slate-500 font-medium'>
                This issue appears to be new. Redirecting to ticket creation in{' '}
                <span className='font-black text-emerald-600'>{countdown}s</span>…
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DuplicateDetection;

