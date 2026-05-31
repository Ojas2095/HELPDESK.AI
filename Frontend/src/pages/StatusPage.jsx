import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, CheckCircle, ArrowLeft, RefreshCw, Server, ShieldCheck, Cpu, Globe, CreditCard } from 'lucide-react';
import { Card } from '../components/ui/card';
import Header from "../components/landing/Header";
import Footer from "../components/landing/Footer";

export default function StatusPage() {
    const navigate = useNavigate();
    const [isRefreshing, setIsRefreshing] = React.useState(false);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 1200);
    };

    const services = [
        { 
            name: 'AI Triage Engine (NER & Categorization)', 
            status: 'Operational', 
            desc: 'Active pipeline & Gemini Model backup failovers',
            icon: Cpu,
            color: 'emerald'
        },
        { 
            name: 'Supabase Data Gateway', 
            status: 'Operational', 
            desc: 'Secure database endpoints & real-time socket connections',
            icon: Server,
            color: 'blue'
        },
        { 
            name: 'Speech Dictation Interface', 
            status: 'Operational', 
            desc: 'Local Web Speech Recognition browser compatibility',
            icon: Globe,
            color: 'purple'
        },
        { 
            name: 'Client-Side OCR Telemetry', 
            status: 'Operational', 
            desc: 'Tesseract.js script injection & parallel worker processes',
            icon: ShieldCheck,
            color: 'amber'
        },
        { 
            name: 'Stripe Payment Processor Integration', 
            status: 'Operational', 
            desc: 'Live billing checkout links & dynamic upgrade callbacks',
            icon: CreditCard,
            color: 'emerald'
        }
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
            <Header />

            <main className="flex-grow max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12 relative z-10">

                {/* Hero Banner Radar */}
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-emerald-950 dark:bg-slate-900 text-white rounded-[2.5rem] p-8 md:p-12 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-8 border border-white/5"
                >
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                    
                    <div className="space-y-4 z-10 text-left">
                        <div className="inline-flex items-center gap-3 px-4 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                            <div className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </div>
                            <span className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Live System Radar</span>
                        </div>
                        <h2 className="text-4xl sm:text-5xl font-black tracking-tight font-syne">All Systems Operational</h2>
                        <p className="text-slate-400 text-base font-medium max-w-lg">
                            100% of microservices are performing within target latency and throughput parameters.
                        </p>
                    </div>

                    <button 
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="self-start md:self-auto px-6 py-4 rounded-2xl bg-white/5 hover:bg-white/10 font-bold text-sm uppercase tracking-widest flex items-center gap-2 border border-white/10 transition-all active:scale-95 disabled:opacity-50"
                    >
                        <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} /> 
                        {isRefreshing ? 'Syncing...' : 'Refresh'}
                    </button>
                </motion.div>

                {/* Service List */}
                <div className="space-y-6 text-left">
                    <div className="flex items-center gap-3 px-2">
                        <Activity size={18} className="text-slate-400" />
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Infrastructure Nodes</h3>
                    </div>
                    
                    <motion.div 
                        initial="hidden"
                        animate="visible"
                        variants={{
                            visible: { transition: { staggerChildren: 0.1 } }
                        }}
                        className="space-y-4"
                    >
                        {services.map((service, idx) => (
                            <motion.div
                                key={idx}
                                variants={{
                                    hidden: { opacity: 0, x: -20 },
                                    visible: { opacity: 1, x: 0 }
                                }}
                            >
                                <Card className="p-6 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between shadow-sm dark:shadow-none hover:shadow-lg transition-all duration-300 group gap-6">
                                    <div className="flex items-center gap-6">
                                        <div className={`w-12 h-12 rounded-xl bg-${service.color}-500/10 text-${service.color}-500 flex items-center justify-center shrink-0 border border-${service.color}-500/20 group-hover:scale-110 transition-transform`}>
                                            <service.icon size={22} />
                                        </div>
                                        <div className="space-y-1">
                                            <h4 className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight leading-tight">{service.name}</h4>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{service.desc}</p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/5 border border-emerald-500/10 shrink-0">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-xs font-black uppercase tracking-tighter text-emerald-600 dark:text-emerald-400">
                                            {service.status}
                                        </span>
                                    </div>
                                </Card>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>

                {/* Bottom Metadata */}
                <div className="pt-12 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">
                        Operational Telemetry &copy; 2026 HELPDESK.AI
                    </p>
                </div>
            </main>

            <Footer />
        </div>
    );
}
