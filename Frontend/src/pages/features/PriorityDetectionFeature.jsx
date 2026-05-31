import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, AlertCircle, Calendar, ShieldAlert, ChevronLeft } from 'lucide-react';
import Header from "../../components/landing/Header";
import Footer from "../../components/landing/Footer";

const priorities = [
    { level: 'Critical', color: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/[0.02] dark:bg-rose-500/[0.03] border-rose-500/10 dark:border-rose-500/20', desc: 'System outages, data breaches, or complete operational blockers demanding immediate telemetry execution.', examples: ['Server completely down', 'Security breach detected', 'All users locked out'] },
    { level: 'High', color: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/[0.02] dark:bg-orange-500/[0.03] border-orange-500/10 dark:border-orange-500/20', desc: 'Major components broken, impacting broad departments under tight SLA timelines (Target: < 1 hr).', examples: ['Production deploy failing', 'VPN down for team', 'Payment system error'] },
    { level: 'Medium', color: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/[0.02] dark:bg-amber-500/[0.03] border-amber-500/10 dark:border-amber-500/20', desc: 'Partial functionality constraints with standard workaround procedures active (Target: < 4 hrs).', examples: ['Printer not working', 'Email delays', 'Slow performance'] },
    { level: 'Low', color: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/[0.02] dark:bg-emerald-500/[0.03] border-emerald-500/10 dark:border-emerald-500/20', desc: 'Minor localized inconveniences, trivial performance nuances, or general cosmetic enhancement proposals.', examples: ['Wrong timezone on dashboard', 'Typo in email', 'Dark mode request'] },
];

const signals = [
    { signal: '"ASAP"', priority: 'Critical', weight: '↑↑↑', color: 'text-rose-400 border-rose-500/20 bg-rose-500/5' },
    { signal: '"urgent"', priority: 'High', weight: '↑↑', color: 'text-orange-400 border-orange-500/20 bg-orange-500/5' },
    { signal: '"all users affected"', priority: 'Critical', weight: '↑↑↑', color: 'text-rose-400 border-rose-500/20 bg-rose-500/5' },
    { signal: '"minor issue"', priority: 'Low', weight: '↓', color: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5' },
    { signal: '"when you can"', priority: 'Low', weight: '↓↓', color: 'text-slate-400 border-white/10 bg-white/5' },
    { signal: '"class starts in 20 mins"', priority: 'High', weight: '↑t', color: 'text-orange-400 border-orange-500/20 bg-orange-500/5' },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 60, damping: 15 } }
};

export default function PriorityDetectionFeature() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
            {/* Header */}
            <Header />

            {/* Hero Section */}
            <section className="px-4 sm:px-6 py-16 sm:py-24 text-center relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-rose-500/5 dark:bg-rose-500/10 rounded-full blur-[120px] pointer-events-none" />
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-4xl mx-auto space-y-6"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-rose-500/10 border border-rose-500/20 rounded-full text-rose-600 dark:text-rose-400 text-xs font-extrabold uppercase tracking-wider">
                        <AlertCircle size={14} /> Priority Detection
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15] font-syne">
                        No More Missing <br /><span className="text-rose-500">Critical Urgencies</span>
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg md:text-xl leading-relaxed max-w-2xl mx-auto font-medium">
                        Our internal linguistic models analyze semantic emotional weights, panic keyword indexes, and blast radius metrics to map true operational urgency dynamically.
                    </p>
                </motion.div>
            </section>

            {/* Priorities Tier List */}
            <section className="py-12 sm:py-20 px-4 sm:px-6 max-w-5xl w-full mx-auto space-y-12">
                <div className="text-center space-y-3">
                    <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-syne">The Four Priority Levels</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base font-medium">Dynamic queue optimization parameters calculated at initial payload reception nodes.</p>
                </div>
                
                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-4"
                >
                    {priorities.map(({ level, color, text, bg, desc, examples }) => (
                        <motion.div 
                            key={level}
                            variants={itemVariants}
                            className={`rounded-[2rem] border p-6 sm:p-8 ${bg} flex flex-col md:flex-row md:items-start gap-6 hover:shadow-xl dark:hover:shadow-black/10 transition-all duration-300 text-left`}
                        >
                            <div className="flex items-center gap-4 min-w-[180px] shrink-0 pt-0.5">
                                <div className={`w-3 h-3 rounded-full ${color} shadow-[0_0_12px_rgba(244,63,94,0.4)] animate-pulse`} />
                                <span className={`text-xl font-black uppercase tracking-wider font-syne ${text}`}>{level}</span>
                            </div>
                            <div className="space-y-4 flex-1">
                                <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed font-medium">{desc}</p>
                                <div className="flex flex-wrap gap-2">
                                    {examples.map(ex => (
                                        <span key={ex} className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 px-3.5 py-1.5 rounded-full font-bold">
                                            {ex}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* Signal Telemetry Radar */}
            <section className="bg-emerald-950 dark:bg-slate-950 text-white py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-96 h-96 bg-rose-500/[0.02] blur-[120px] rounded-full pointer-events-none" />
                <div className="max-w-4xl w-full mx-auto space-y-12">
                    <div className="text-center space-y-3">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight font-syne">Urgency Signals Detected</h2>
                        <p className="text-slate-400 text-sm sm:text-base font-medium">Linguistic expressions mapped and weighted in real-time by the neural routing matrix.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {signals.map(({ signal, priority, weight, color }) => (
                            <div key={signal} className={`border rounded-2xl p-6 flex flex-col justify-between gap-4 text-left shadow-2xl transition-transform duration-300 hover:-translate-y-0.5 ${color}`}>
                                <p className="font-mono text-base font-extrabold tracking-tight">{signal}</p>
                                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black">→ {priority}</span>
                                    <span className="text-xs font-mono font-black px-2.5 py-0.5 rounded bg-black/40 border border-white/5">{weight}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Call To Action Block */}
            <section className="py-16 sm:py-24 px-4 sm:px-6 text-center max-w-3xl w-full mx-auto space-y-8">
                <div className="space-y-3">
                    <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-syne">Stop firefighting. Start triaging.</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-base font-medium">Let autonomous heuristics establish processing queue positions while your team handles resolution loops.</p>
                </div>
                <button 
                    onClick={() => navigate('/admin-signup')} 
                    className="inline-flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold text-base transition-all shadow-xl shadow-emerald-600/10 active:scale-95 cursor-pointer border-none uppercase tracking-wider"
                >
                    <span>Get Started Free</span> <ArrowRight size={18} />
                </button>
            </section>
            <Footer />
        </div>
    );
}