import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, CheckCircle2, X, Loader2, MessageSquare, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

/**
 * CSATModal — Shown when a ticket is resolved and no rating has been given yet.
 * Optimized with dual-mode dark/light styling and smooth entrance animations.
 */
export default function CSATModal({ ticketId, onSubmit, onDismiss }) {
    const [hovered, setHovered] = useState(0);
    const [selected, setSelected] = useState(0);
    const [comment, setComment] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const ratingLabels = {
        1: 'Very Dissatisfied',
        2: 'Dissatisfied',
        3: 'Neutral',
        4: 'Satisfied',
        5: 'Very Satisfied',
    };

    const handleSubmit = async () => {
        if (!selected) {
            setError('Please select a rating option.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const { error: upError } = await supabase
                .from('tickets')
                .update({
                    csat_rating: selected,
                    csat_comment: comment.trim() || null,
                })
                .eq('id', ticketId);

            if (upError) throw upError;
            setSubmitted(true);
            setTimeout(() => { onSubmit?.(selected); }, 1800);
        } catch (err) {
            setError('Failed to submit telemetry feedback. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop layer overlay */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={onDismiss}
                className="fixed inset-0 bg-slate-950/40 dark:bg-slate-950/60 backdrop-blur-sm"
            />

            <AnimatePresence mode="wait">
                {submitted ? (
                    /* Success Panel View State */
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-slate-150 dark:border-white/[0.08] p-8 sm:p-12 text-center w-full max-w-sm relative z-10"
                    >
                        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight font-syne mb-2">Thank you!</h3>
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">Your feedback parameters have been indexed into our optimization matrix.</p>
                    </motion.div>
                ) : (
                    /* Evaluation Interactive Card View State */
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 15 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 15 }}
                        className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-200 dark:border-white/[0.08] overflow-hidden relative z-10"
                    >
                        {/* Dynamic Header Block */}
                        <div className="bg-slate-50 dark:bg-white/[0.01] p-6 sm:p-8 border-b border-slate-150 dark:border-white/[0.05] relative text-left">
                            <button
                                onClick={onDismiss}
                                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5 rounded-full transition-all border-none bg-transparent cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            <div className="w-12 h-12 bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-4 shadow-sm">
                                <Star className="w-5 h-5 text-emerald-600 dark:text-emerald-400 fill-current" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight font-syne mb-1">
                                Resolution Rating
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium leading-relaxed">
                                This issue ticket partition is complete. Rate your engineering interaction profile.
                            </p>
                        </div>

                        {/* Interactive Parameters Content Body */}
                        <div className="p-6 sm:p-8 space-y-6 text-left">

                            {/* Star Selector System */}
                            <div className="flex flex-col items-center gap-3 bg-slate-50 dark:bg-slate-950 py-6 rounded-2xl border border-slate-150 dark:border-white/[0.02] shadow-inner">
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onMouseEnter={() => setHovered(star)}
                                            onMouseLeave={() => setHovered(0)}
                                            onClick={() => { setSelected(star); setError(''); }}
                                            className="bg-transparent border-none p-0 cursor-pointer transition-all duration-200"
                                            style={{ transform: hovered === star ? 'scale(1.15)' : 'scale(1)' }}
                                        >
                                            <Star
                                                className={`w-9 h-9 transition-all duration-300 ${star <= (hovered || selected)
                                                        ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                                                        : 'text-slate-200 dark:text-slate-800 fill-slate-200 dark:fill-slate-800'
                                                    }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                                <div className="h-5 flex items-center">
                                    {(hovered || selected) > 0 && (
                                        <motion.p
                                            initial={{ opacity: 0, y: 2 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 m-0"
                                        >
                                            {ratingLabels[hovered || selected]}
                                        </motion.p>
                                    )}
                                </div>
                            </div>

                            {/* Optional Comment Form Data Area */}
                            <div className="space-y-2">
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2">
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>Linguistic Comment Matrix <span className="text-slate-400 dark:text-slate-600 font-normal lowercase italic">(optional)</span></span>
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Detail process metrics, adjustments, or support delivery exceptions..."
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    className="w-full p-4 text-sm border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 resize-none font-medium shadow-inner leading-relaxed transition-all"
                                />
                            </div>

                            {/* System Exception Validation Notifications */}
                            <AnimatePresence mode="wait">
                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="flex items-start gap-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 overflow-hidden"
                                    >
                                        <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                        <p className="text-rose-500 text-xs font-bold uppercase tracking-wide leading-snug m-0">{error}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Execution Interface Controls */}
                            <div className="flex gap-3.5 pt-2">
                                <button
                                    type="button"
                                    onClick={onDismiss}
                                    className="flex-1 h-12 border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-colors cursor-pointer bg-transparent"
                                >
                                    Skip for now
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="flex-[1.5] flex-grow h-12 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-xl shadow-emerald-600/10 active:scale-[0.99] flex items-center justify-center gap-2 border-none cursor-pointer"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                    <span>Submit Feedback</span>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
