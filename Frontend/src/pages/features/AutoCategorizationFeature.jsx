import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Folder, Cpu, HardDrive, Wifi, Lock, CheckCircle2 } from 'lucide-react';
import Header from "../../components/landing/Header";
import Footer from "../../components/landing/Footer";

const categories = [
    { icon: Wifi, name: 'Network', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', desc: 'VPN, internet, DNS, routing issues' },
    { icon: HardDrive, name: 'Hardware', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', desc: 'Printers, monitors, peripherals' },
    { icon: Cpu, name: 'Software', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', desc: 'Crashes, installs, license errors' },
    { icon: Lock, name: 'Access', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', desc: 'Passwords, SSO, permissions' },
];

const examples = [
    { input: "My laptop won't connect to the office WiFi after the Windows update", output: { category: 'Network', subcategory: 'WiFi Connectivity', confidence: '97%', team: 'NetOps Team' } },
    { input: "I can't log in to Jira with my SSO credentials since yesterday", output: { category: 'Access', subcategory: 'SSO / Identity', confidence: '95%', team: 'IAM Team' } },
    { input: "The projector in Conference Room B keeps disconnecting mid-call", output: { category: 'Hardware', subcategory: 'AV Equipment', confidence: '92%', team: 'Hardware Support' } },
];

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 60, damping: 15 } }
};

export default function AutoCategorizationFeature() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
            {/* Header */}
            <Header />

            {/* Hero Section */}
            <section className="px-4 sm:px-6 py-16 sm:py-24 text-center relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
                <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="max-w-4xl mx-auto space-y-6"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 dark:text-emerald-400 text-xs font-extrabold uppercase tracking-wider">
                        <Folder size={14} /> Auto-Categorization
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.15] font-syne">
                        Zero-Touch <br /><span className="text-emerald-500">Ticket Sorting</span>
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg md:text-xl leading-relaxed max-w-2xl mx-auto font-medium">
                        Our AI reads the exact intent of every ticket and tags it with the correct category, subcategory, and resolution group — in under 200ms.
                    </p>
                </motion.div>
            </section>

            {/* Categories Grid */}
            <section className="py-12 sm:py-20 px-4 sm:px-6 max-w-7xl w-full mx-auto space-y-12">
                <div className="text-center space-y-3">
                    <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-syne">Four Core Categories</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base font-medium">Every incoming problem matrix is mapped to one of these intelligent domains.</p>
                </div>
                
                <motion.div 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                    {categories.map(({ icon: Icon, name, color, desc }) => (
                        <motion.div 
                            key={name}
                            variants={itemVariants}
                            className="p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-white dark:hover:bg-slate-950 flex flex-col items-center text-center hover:shadow-xl dark:hover:shadow-black/20 hover:-translate-y-1 transition-all duration-300 group"
                        >
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shrink-0 border group-hover:scale-110 transition-transform ${color}`}>
                                <Icon size={24} />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-extrabold text-slate-900 dark:text-white text-xl tracking-tight">{name}</h3>
                                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{desc}</p>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </section>

            {/* Live Action Code Simulator Section */}
            <section className="bg-emerald-950 dark:bg-slate-950/50 text-white py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
                <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
                <div className="max-w-4xl w-full mx-auto space-y-12">
                    <div className="text-center space-y-3">
                        <h2 className="text-3xl sm:text-4xl font-black tracking-tight font-syne">See It in Action</h2>
                        <p className="text-slate-400 text-sm sm:text-base font-medium">Real-time telemetry strings translated into machine-readable routing profiles.</p>
                    </div>

                    <div className="space-y-6">
                        {examples.map((ex, i) => (
                            <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.01] shadow-2xl overflow-hidden text-left">
                                <div className="p-6 border-b border-white/5 bg-white/[0.01]">
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">User Entry Pipeline</span>
                                    <p className="text-slate-200 text-base sm:text-lg font-mono italic">"{ex.input}"</p>
                                </div>
                                <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6 bg-emerald-500/[0.02]">
                                    {Object.entries(ex.output).map(([key, val]) => (
                                        <div key={key} className="space-y-1">
                                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">{key}</span>
                                            <p className="text-white font-extrabold text-sm sm:text-base tracking-tight">{val}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Segment Block */}
            <section className="py-16 sm:py-24 px-4 sm:px-6 text-center max-w-3xl w-full mx-auto space-y-8">
                <div className="space-y-3">
                    <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-syne">Ready to automate?</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-base font-medium">Start routing tickets smarter without human bottleneck interventions.</p>
                </div>
                <button 
                    onClick={() => navigate('/admin-signup')} 
                    className="inline-flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-xl font-bold text-base transition-all shadow-xl shadow-emerald-600/10 active:scale-95 cursor-pointer border-none uppercase tracking-wider"
                >
                    <span>Get Started Free</span> <ArrowRight size={18} />
                </button>
            </section>

            {/* Footer */}
            <Footer />
        </div>
    );
}
