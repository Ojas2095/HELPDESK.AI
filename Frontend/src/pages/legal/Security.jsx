import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    ArrowLeft, 
    ShieldCheck, 
    Lock, 
    Server, 
    Eye, 
    Key, 
    Activity, 
    AlertCircle, 
    ShieldAlert, 
    FileCheck2, 
    Zap 
} from 'lucide-react';
import { motion } from 'framer-motion';

const pillars = [
    { icon: Lock, title: 'Encryption at Rest & In Transit', color: 'bg-indigo-500/10 text-indigo-500', border: 'border-indigo-500/20', desc: 'All data stored on our servers is encrypted with AES-256. All connections are secured via TLS 1.3. API keys and secrets are never stored in plaintext.' },
    { icon: Server, title: 'Multi-tenant Data Isolation', color: 'bg-blue-500/10 text-blue-500', border: 'border-blue-500/20', desc: 'Each company\'s data is siloed using Row Level Security (RLS) in Supabase. No data from one organization can ever be accessed by another — enforced at the database level.' },
    { icon: Key, title: 'Role-Based Access Control', color: 'bg-purple-500/10 text-purple-600', border: 'border-purple-500/20', desc: 'Access is governed by strict RBAC. Employees can only see their own tickets. Admins see only their company. Master Admins have audit-only visibility with no data access.' },
    { icon: Eye, title: 'Audit Logging', color: 'bg-emerald-500/10 text-emerald-500', border: 'border-emerald-500/20', desc: 'All sensitive actions (admin approvals, ticket corrections, settings changes) are logged with timestamps, user IDs, and intent. Logs are immutable and retained for 12 months.' },
    { icon: Activity, title: 'Infrastructure Security', color: 'bg-orange-500/10 text-orange-500', border: 'border-orange-500/20', desc: 'Deployed on Vercel (frontend) and Cloud Run (AI backend). Auto-scaling protects against DDoS. Backend endpoints are rate-limited and secured behind API keys.' },
    { icon: AlertCircle, title: 'Responsible Disclosure', color: 'bg-rose-500/10 text-rose-500', border: 'border-rose-500/20', desc: 'Found a vulnerability? We run a responsible disclosure program. Contact security@helpdesk.ai with a description and reproduction steps. We commit to responding within 72 hours.' },
];

export default function Security() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors duration-300 w-full overflow-x-hidden">
            {/* Minimal Sub-Navigation */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
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

            {/* Hero Section */}
            <section className="px-4 sm:px-6 py-12 sm:py-20 text-center relative">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-3xl mx-auto space-y-6"
                >
                    <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <ShieldCheck className="w-8 h-8 text-emerald-500" />
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight font-syne">
                        Enterprise-Grade <br/> <span className="text-emerald-500">Security Layers</span>
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 text-lg md:text-xl leading-relaxed max-w-2xl mx-auto font-medium">
                        We prioritize data integrity and organizational isolation. HelpDesk.ai is built from the ground up with security as a mechanical necessity, not a feature.
                    </p>
                </motion.div>
            </section>

            {/* Security Pillars Grid */}
            <section className="px-4 sm:px-6 py-12 max-w-7xl mx-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {pillars.map(({ icon: Icon, title, color, border, desc }, idx) => (
                        <motion.div 
                            key={title}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 p-8 rounded-[2rem] flex flex-col items-center text-center hover:shadow-xl dark:hover:shadow-black/30 hover:-translate-y-1 transition-all duration-300 group"
                        >
                            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 shrink-0 border ${color} ${border} group-hover:scale-110 transition-transform duration-300`}>
                                <Icon size={28} />
                            </div>
                            <div className="space-y-3">
                                <h3 className="font-extrabold text-slate-900 dark:text-white text-xl tracking-tight leading-tight">
                                    {title}
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed font-medium">
                                    {desc}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Compliance Matrix */}
            <section className="px-4 sm:px-6 py-20">
                <div className="max-w-5xl mx-auto bg-emerald-950 dark:bg-slate-950 rounded-[3rem] p-8 sm:p-16 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full" />
                    
                    <div className="relative z-10 text-center space-y-12">
                        <div className="space-y-4">
                            <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-syne">Compliance & Standards</h2>
                            <p className="text-slate-400 text-lg font-medium">Aligning with global frameworks to ensure sovereign data handling.</p>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'DPDP Act 2023', icon: ShieldAlert },
                                { label: 'GDPR Standard', icon: FileCheck2 },
                                { label: 'TLS 1.3 Protocol', icon: Zap },
                                { label: 'AES-256 Storage', icon: Lock }
                            ].map((item) => (
                                <div key={item.label} className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center gap-4 hover:bg-white/10 transition-colors">
                                    <item.icon className="w-6 h-6 text-emerald-400" />
                                    <p className="text-white font-bold text-sm tracking-tight">{item.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Vulnerability Reporting CTA */}
            <section className="px-4 sm:px-6 py-20 text-center">
                <div className="max-w-2xl mx-auto space-y-8 p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem]">
                    <div className="space-y-3">
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight font-syne">Responsible Disclosure</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Found a vulnerability? We appreciate security researchers who help us keep HelpDesk.ai safe.</p>
                    </div>
                    <a 
                        href="mailto:security@helpdesk.ai" 
                        className="inline-flex items-center gap-3 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-600/20 active:scale-95"
                    >
                        <AlertCircle className="w-5 h-5" /> security@helpdesk.ai
                    </a>
                </div>
            </section>
        </div>
    );
}