import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, Cookie } from 'lucide-react';
import { Card } from '../../components/ui/card';

export default function CookiePolicy() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300 w-full overflow-x-hidden">
            {/* Minimal Navigation */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
                <button 
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 font-bold text-base text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group cursor-pointer border-none bg-transparent"
                >
                    <div className="p-2.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-emerald-500/30">
                        <ArrowLeft size={18} />
                    </div>
                    <span>Back</span>
                </button>
            </div>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 sm:px-6 pb-20 space-y-10 relative z-10">
                
                {/* Header Section */}
                <div className="space-y-6 text-center sm:text-left">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-500/10 border border-slate-500/20 rounded-full text-slate-700 dark:text-slate-400 text-sm font-extrabold uppercase tracking-wider">
                        <ShieldAlert size={16} /> Compliance Guide
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight font-syne">
                            Cookie Policy
                        </h1>
                        <p className="text-slate-400 dark:text-slate-500 text-sm font-bold uppercase tracking-widest">
                            Last Updated: May 2026
                        </p>
                    </div>
                </div>

                {/* Content Card */}
                <Card className="p-8 sm:p-12 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl dark:shadow-none relative overflow-hidden">
                    {/* Decorative Icon */}
                    <div className="absolute -top-6 -right-6 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
                        <Cookie size={200} className="text-slate-900 dark:text-white" />
                    </div>

                    <div className="space-y-10 relative z-10 text-left">
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-syne">
                                1. Why We Use Cookies
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg leading-relaxed font-medium">
                                HELPDESK.AI uses secure, essential first-party cookies to manage active user sessions, retain user preferences, and authenticate client tokens accessing our Supabase data gateway.
                            </p>
                        </div>
                        
                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-syne">
                                2. Third-Party Trackers
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg leading-relaxed font-medium">
                                We do not run external tracking scripts or advertising scripts. Stripe cookies are injected solely during active checkouts to maintain secure payment processing integrity.
                            </p>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight font-syne">
                                3. Managing Preferences
                            </h3>
                            <p className="text-slate-600 dark:text-slate-400 text-base sm:text-lg leading-relaxed font-medium">
                                You can clean, block, or disable active cookies via your browser's security panel settings at any time. Disabling essential cookies may result in the loss of session persistence and authentication.
                            </p>
                        </div>
                    </div>
                </Card>

                {/* Bottom Legal Attribution */}
                <div className="pt-8 text-center border-t border-slate-100 dark:border-slate-800/60">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600">
                        Secure Enterprise Data Protocols &copy; 2026 HelpDesk.ai
                    </p>
                </div>
            </main>
        </div>
    );
}
