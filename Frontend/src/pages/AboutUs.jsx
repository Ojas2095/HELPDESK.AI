import React, { useRef, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useInView, useAnimation } from 'framer-motion';
import { Heart, Target, Award, Shield, Cpu, Activity, HelpCircle, ChevronLeft } from 'lucide-react';
import { Card } from '../components/ui/card';
import Footer from "../components/landing/Footer";
import Header from "../components/landing/Header";

// --- COUNT-UP COUNTER SUB-COMPONENT ---
function CounterNumber({ target, prefix = '', suffix = '', duration = 1500, isWord = false }) {
    const [display, setDisplay] = useState(isWord ? target : '0');
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, amount: 0.5 });

    useEffect(() => {
        if (!isInView || isWord) return;

        let startTimestamp = null;
        const targetNum = parseFloat(target);

        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // Cubic Ease Out

            setDisplay(String(Math.round(eased * targetNum)));

            if (progress < 1) {
                requestAnimationFrame(step);
            }
        };

        requestAnimationFrame(step);
    }, [isInView, target, duration, isWord]);

    return (
        <span ref={ref} className="tabular-nums">
            {prefix}{display}{suffix}
        </span>
    );
}

// --- ANIMATION VARIANTS CONFIGURATION ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.15 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { type: 'spring', stiffness: 60, damping: 15 }
    }
};

export default function AboutUs() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
            <Header />

            {/* Main Wrapper with Framer Motion Orchestration */}
            <motion.main
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="flex-grow max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-20 sm:space-y-32 relative z-10"
            >
                {/* Back to Home Button */}
                <motion.div variants={itemVariants} className="flex justify-center lg:justify-start">
                    <Link to="/" className="flex items-center gap-2 font-bold text-base text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors group">
                        <div className="p-2.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-emerald-500/30 transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </div>
                        <span>Back to Home</span>
                    </Link>
                </motion.div>

                {/* Hero / Identity Section */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                    <motion.div variants={itemVariants} className="space-y-6 lg:col-span-7 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-700 dark:text-emerald-400 text-sm font-extrabold uppercase tracking-wider">
                            <Heart size={16} className="animate-pulse" /> Our Mission
                        </div>
                        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] font-syne">
                            Pioneering Intelligent Triage
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg md:text-xl leading-relaxed max-w-2xl mx-auto lg:mx-0 font-medium">
                            At HelpDesk.ai, we strive to build local machine learning workflows that eliminate manual ticket tagging, priority guessing, and routing bottlenecks. By moving infrastructure closer to where data resides, we deliver hyper-secure, deterministic automation scales.
                        </p>
                    </motion.div>

                    {/* Visual Performance Metrics Grid with Counter Hooks */}
                    <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4 lg:col-span-5 w-full">
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl text-center shadow-sm hover:shadow-md hover:border-emerald-500/30 transition-all duration-300">
                            <span className="block text-2xl sm:text-4xl xl:text-5xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight font-mono">
                                &lt; <CounterNumber target="1.2" suffix="s" />
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mt-2">Classification Latency</span>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl text-center shadow-sm hover:shadow-md hover:border-blue-500/30 transition-all duration-300">
                            <span className="block text-2xl sm:text-4xl xl:text-5xl font-black text-blue-600 dark:text-blue-400 tracking-tight font-mono">
                                <CounterNumber target="99" suffix=".4%" />
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mt-2">Triage Accuracy</span>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl text-center shadow-sm hover:shadow-md hover:border-purple-500/30 transition-all duration-300">
                            <span className="block text-2xl sm:text-4xl xl:text-5xl font-black text-purple-600 dark:text-purple-400 tracking-tight font-mono">
                                <CounterNumber target="100" suffix="%" />
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mt-2">Data Sovereignty</span>
                        </div>
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/80 rounded-2xl text-center shadow-sm hover:shadow-md hover:border-amber-500/30 transition-all duration-300">
                            <span className="block text-2xl sm:text-4xl xl:text-5xl font-black text-amber-600 dark:text-amber-400 tracking-tight font-mono">
                                <CounterNumber target="Zero" isWord={true} />
                            </span>
                            <span className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mt-2">Manual Queues</span>
                        </div>
                    </motion.div>
                </section>

                {/* Core Architectural Foundations */}
                <motion.section variants={itemVariants} className="space-y-8 sm:space-y-12 py-6 rounded-3xl">
                    <div className="text-center lg:text-left space-y-3 px-2">
                        <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-syne">
                            Architectural Foundations
                        </h3>
                        <p className="text-base text-slate-500 dark:text-slate-400 font-semibold">
                            High-performance technical principles underlying the enterprise engine.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-center items-stretch justify-items-center max-w-7xl mx-auto">
                        {/* Card 1: Self-Healing Backups */}
                        <Card className="p-6 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center text-center shadow-sm dark:shadow-none hover:-translate-y-1 transition-all duration-300 group relative border-b-4 border-b-transparent dark:hover:border-b-emerald-400 w-full max-w-sm">
                            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mb-6 mx-auto border border-emerald-500/20 group-hover:scale-105 transition-transform">
                                <Target size={24} />
                            </div>
                            <div className="space-y-3 flex-grow w-full flex flex-col items-center justify-center">
                                <h4 className="font-extrabold text-slate-900 dark:text-white text-xl tracking-tight">Self-Healing Backups</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                    By backing up offline sentence embeddings with fast Gemini failover pipelines, we achieve 100% platform availability under tight network margins.
                                </p>
                            </div>
                        </Card>

                        {/* Card 2: Data Sovereignty */}
                        <Card className="p-6 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center text-center shadow-sm dark:shadow-none hover:-translate-y-1 transition-all duration-300 group border-b-4 border-b-transparent dark:hover:border-b-blue-400 w-full max-w-sm">
                            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 mb-6 mx-auto border border-blue-500/20 group-hover:scale-105 transition-transform">
                                <Award size={24} />
                            </div>
                            <div className="space-y-3 flex-grow w-full flex flex-col items-center justify-center">
                                <h4 className="font-extrabold text-slate-900 dark:text-white text-xl tracking-tight">Data Sovereignty</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                    All ticket summaries, OCR attachments, and database timelines remain securely locked under regional cloud networks.
                                </p>
                            </div>
                        </Card>

                        {/* Card 3: Hybrid Inference */}
                        <Card className="p-6 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col items-center text-center shadow-sm dark:shadow-none hover:-translate-y-1 transition-all duration-300 group border-b-4 border-b-transparent dark:hover:border-b-purple-400 w-full max-w-sm">
                            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 mb-6 mx-auto border border-purple-500/20 group-hover:scale-105 transition-transform">
                                <Cpu size={24} />
                            </div>
                            <div className="space-y-3 flex-grow w-full flex flex-col items-center justify-center">
                                <h4 className="font-extrabold text-slate-900 dark:text-white text-xl tracking-tight">Hybrid Inference</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                    Utilizes locally compiled deep learning checkpoints alongside lightweight linguistic rules to ensure immediate offline priority generation.
                                </p>
                            </div>
                        </Card>

                        {/* Card 4: Zero Trust Isolation */}
                        <Card className="p-6 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 flex flex-col items-center text-center shadow-sm dark:shadow-none hover:-translate-y-1 transition-all duration-300 group border-b-4 border-b-transparent dark:hover:border-b-amber-400 w-full max-w-sm">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 mb-6 mx-auto border border-amber-500/20 group-hover:scale-105 transition-transform">
                                <Shield size={24} />
                            </div>
                            <div className="space-y-3 flex-grow w-full flex flex-col items-center justify-center">
                                <h4 className="font-extrabold text-slate-900 dark:text-white text-xl tracking-tight">Zero Trust Isolation</h4>
                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                                    Strict role-based row-level permissions ensure support logs are containerized per organization and protected against external vector leakage.
                                </p>
                            </div>
                        </Card>
                    </div>
                </motion.section>

                {/* The Processing Engine Pipeline */}
                <motion.section variants={itemVariants} className="space-y-10 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-6 sm:p-12 shadow-sm transition-colors duration-300">
                    <div className="space-y-3 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-700 dark:text-blue-400 text-xs font-bold uppercase tracking-wider">
                            <Activity size={14} /> Lifecycle Engine
                        </div>
                        <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-syne">How Ingestion Works</h3>
                        <p className="text-base text-slate-500 dark:text-slate-400 font-semibold max-w-xl">Tracing the systemic timeline from unstructured customer intake to automated resolution queues.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 relative mt-10">
                        <div className="space-y-4 relative z-10 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 md:p-8 shadow-sm hover:scale-[1.02] hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-4">
                                <span className="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-800 text-white dark:text-emerald-400 font-black text-sm flex items-center justify-center shrink-0 font-mono ring-4 ring-slate-100 dark:ring-slate-800">01</span>
                                <h5 className="font-extrabold text-slate-900 dark:text-white text-lg">Multimodal Ingestion</h5>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium m-0 pl-13">
                                Unstructured issues, email logs, or system images are parsed instantly via cloud-native storage nodes and OCR pipelines.
                            </p>
                        </div>

                        <div className="space-y-4 relative z-10 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 md:p-8 shadow-sm hover:scale-[1.02] hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-4">
                                <span className="w-9 h-9 rounded-full bg-emerald-500 text-white font-black text-sm flex items-center justify-center shrink-0 font-mono ring-4 ring-emerald-100 dark:ring-emerald-950">02</span>
                                <h5 className="font-extrabold text-slate-900 dark:text-white text-lg">Neural Feature Triage</h5>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium m-0 pl-13">
                                Transformers run semantic classifications on text vectors to append intent targets and auto-assign emergency levels within milliseconds.
                            </p>
                        </div>

                        <div className="space-y-4 relative z-10 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-800 md:p-8 shadow-sm hover:scale-[1.02] hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-4">
                                <span className="w-9 h-9 rounded-full bg-slate-900 dark:bg-slate-800 text-white dark:text-emerald-400 font-black text-sm flex items-center justify-center shrink-0 font-mono ring-4 ring-slate-100 dark:ring-slate-800">03</span>
                                <h5 className="font-extrabold text-slate-900 dark:text-white text-lg">Deterministic Routing</h5>
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium m-0 pl-13">
                                Resolved routing graphs distribute tasks directly to corresponding technical support tiers without introducing queue friction.
                            </p>
                        </div>
                    </div>
                </motion.section>

                {/* Frequently Asked Questions */}
                <motion.section variants={itemVariants} className="space-y-8">
                    <div className="text-center lg:text-left space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full text-purple-700 dark:text-purple-400 text-xs font-bold uppercase tracking-wider">
                            <HelpCircle size={14} /> FAQ
                        </div>
                        <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight font-syne">Common Technical Queries</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-6 sm:p-8 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 transition-all duration-200">
                            <h5 className="font-extrabold text-slate-900 dark:text-white text-lg">How does the platform preserve operation when offline?</h5>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium m-0">
                                The application holds compressed local classifiers. If internet access limits upstream API performance, local fallback paths continue matching metadata fields smoothly.
                            </p>
                        </div>

                        <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-6 sm:p-8 rounded-2xl border border-slate-100 dark:border-slate-800 hover:bg-slate-100/50 dark:hover:bg-slate-800/80 transition-all duration-200">
                            <h5 className="font-extrabold text-slate-900 dark:text-white text-lg">Are external data providers used during ticket inference?</h5>
                            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium m-0">
                                Core categorizations rely on internal model layers. External large models act solely as high-confidence verification overlays when processing ambiguous linguistic data.
                            </p>
                        </div>
                    </div>
                </motion.section>
            </motion.main>

            <Footer />
        </div>
    );
}
