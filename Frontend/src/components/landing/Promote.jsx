import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Play } from 'lucide-react';

/**
 * Promote Component
 * A conversion-focused hero/promo section with full light and dark mode support.
 * Synchronized with the HelpDesk.ai design system.
 */
export default function Promote({ setShowDemo }) {
    const navigate = useNavigate();

    return (
        <div className="mx-auto px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-10 sm:pb-16 text-center border-b border-slate-100 dark:border-slate-900 bg-white dark:bg-slate-950 transition-colors duration-500">
            {/* Main Headline */}
            <h2 className="text-xl sm:text-3xl md:text-5xl font-black tracking-tighter mb-4 max-w-3xl mx-auto leading-tight text-slate-900 dark:text-white font-syne uppercase">
                The Smartest IT Helpdesk for <br className="hidden sm:block" /> 
                <span className="text-emerald-600 dark:text-emerald-400">Indian Businesses</span>
            </h2>

            {/* Sub-headline */}
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-base md:text-lg mb-6 sm:mb-8 max-w-xl mx-auto px-2 font-medium">
                Start automating ticket triage today. No credit card required.
            </p>

            {/* Primary Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 max-w-xs sm:max-w-none mx-auto">
                <button
                    onClick={() => navigate('/admin-signup')}
                    className="w-full sm:w-auto px-8 py-4 bg-emerald-900 dark:bg-white text-white dark:text-slate-950 font-black uppercase tracking-widest rounded-xl hover:bg-emerald-800 dark:hover:bg-emerald-50 transition-all text-xs shadow-2xl shadow-emerald-900/10 active:scale-95 cursor-pointer border-none"
                >
                    Get Started Free
                </button>
                
                <button
                    onClick={() => setShowDemo(true)}
                    className="w-full sm:w-auto px-8 py-4 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-black uppercase tracking-widest rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all flex items-center justify-center gap-2 text-xs active:scale-95 cursor-pointer bg-transparent"
                >
                    <Play className="w-3.5 h-3.5 fill-slate-700 dark:fill-slate-200" /> Watch Demo
                </button>
            </div>

            {/* Secondary Login Link */}
            <div className="mt-8">
                <button
                    onClick={() => navigate('/login')}
                    className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] transition-colors cursor-pointer bg-transparent border-none"
                >
                    Already have an account? <span className="underline underline-offset-8 decoration-slate-200 dark:decoration-slate-800">Sign in</span>
                </button>
            </div>
        </div>
    );
}