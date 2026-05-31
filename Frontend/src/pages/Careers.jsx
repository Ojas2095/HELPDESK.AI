import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Briefcase, ArrowLeft, ArrowRight, MapPin, Clock, CircleDollarSign } from 'lucide-react';
import { Card } from '../components/ui/card';
import Header from "../components/landing/Header";
import Footer from "../components/landing/Footer";

export default function Careers() {
    const navigate = useNavigate();

    const jobs = [
        { title: 'Senior NLP Architect', location: 'Bengaluru / Remote', type: 'Full-Time', scale: '自24L - 自32L' },
        { title: 'Lead Full-Stack Engineer (React / Node)', location: 'Mumbai / Hybrid', type: 'Full-Time', scale: '自18L - 自26L' },
        { title: 'AI Support Specialist (Tier 2 Override Ops)', location: 'Bengaluru', type: 'Full-Time', scale: '自8L - 自12L' }
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
            {/* Header */}
            <Header />

            {/* Main Content */}
            <main className="flex-grow max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12 sm:space-y-16 relative z-10">
                <div className="space-y-6 text-center sm:text-left">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-700 dark:text-emerald-400 text-sm font-extrabold uppercase tracking-wider">
                        <Briefcase size={16} /> Open Positions
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] font-syne">
                        Shape the Future of IT Triage
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg md:text-xl leading-relaxed max-w-3xl font-medium">
                        Join our engineering-first team. We build self-healing pipelines, Tesseract OCR integrations, and dynamic telemetry mapping products.
                    </p>
                </div>

                {/* Listings Grid */}
                <div className="space-y-4 pt-4">
                    {jobs.map((job, idx) => (
                        <Card 
                            key={idx} 
                            className="p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center sm:justify-between shadow-sm dark:shadow-none hover:shadow-xl dark:hover:shadow-black/20 hover:-translate-y-1 transition-all duration-300 group gap-6"
                        >
                            <div className="space-y-3 flex-1 text-left">
                                <h3 className="font-bold text-slate-900 dark:text-white text-xl sm:text-2xl tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                    {job.title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400 font-semibold">
                                    <span className="flex items-center gap-1.5">
                                        <MapPin size={16} className="text-slate-400 shrink-0" />
                                        {job.location}
                                    </span>
                                    <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                                    <span className="flex items-center gap-1.5">
                                        <Clock size={16} className="text-slate-400 shrink-0" />
                                        {job.type}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-6 border-t sm:border-t-0 border-slate-100 dark:border-slate-800/60 pt-4 sm:pt-0 shrink-0">
                                <div className="flex items-center gap-2 text-base font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 dark:bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/10 font-mono">
                                    <CircleDollarSign size={18} className="shrink-0 text-emerald-500" />
                                    {job.scale}
                                </div>
                                <div className="w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:bg-emerald-600 group-hover:text-white group-hover:border-emerald-600 dark:group-hover:bg-emerald-500 dark:group-hover:border-emerald-500 transition-all shadow-sm">
                                    <ArrowRight size={20} className="transition-transform group-hover:translate-x-0.5" />
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            </main>

            {/* Footer */}
            <Footer />
        </div>
    );
}
