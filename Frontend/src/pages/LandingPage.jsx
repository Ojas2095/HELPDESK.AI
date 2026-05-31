import React, { useRef, useEffect, useState } from 'react';

import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
    Menu, X, Check, Activity,
    MapPin, AlertCircle, Folder, Zap, Bot, ArrowRight,
    Clock, CheckCircle,
    Star, Twitter, Linkedin, Github, Globe, MessageSquare,
    Mail, Search, Bell, Play, ChevronRight,
    Shield, Lock, Network, HardDrive, Cpu, Copy,
    Users, BarChart3, Inbox, Building2, BrainCircuit
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import TeamSection from '../components/landing/TeamSection';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import Pricing from '@/components/landing/Pricing';
import HowItWorks from '@/components/landing/HowItWorks';
import FeaturesGrid from '@/components/landing/FeaturesGrid';
import AnimatedStat from '@/components/landing/AnimatedStat';
import Hero from '@/components/landing/Hero';
import Promote from '@/components/landing/Promote';

// ---- Demo Modal ----
function DemoModal({ onClose }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const videoId = "Bj00LzeMylM";

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
            <div
                className="relative bg-gray-950 rounded-3xl border border-white/10 shadow-2xl w-full max-w-4xl overflow-hidden z-10 animate-in fade-in zoom-in duration-300"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white bg-white/10 rounded-full p-2 transition-colors z-30"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Video Container */}
                <div className="aspect-video w-full bg-black flex items-center justify-center relative group">
                    {!isPlaying ? (
                        <div
                            className="absolute inset-0 cursor-pointer overflow-hidden"
                            onClick={() => setIsPlaying(true)}
                        >
                            {/* YouTube Thumbnail Poster */}
                            <img
                                src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                                alt="Video Thumbnail"
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                            />
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300" />

                            {/* Play Button Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-20 h-20 bg-emerald-600 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-600/50 transform group-hover:scale-110 transition-transform duration-300">
                                    <Play className="w-8 h-8 text-white fill-white ml-1" />
                                </div>
                            </div>

                            {/* Badge */}
                            <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-xs font-black text-white uppercase tracking-widest">Click to Watch</span>
                            </div>
                        </div>
                    ) : (
                        <iframe
                            className="w-full h-full"
                            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                            title="HelpDesk.ai Platform Demo"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        ></iframe>
                    )}
                </div>

                <div className="p-6 bg-gray-900 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-extrabold text-white italic uppercase tracking-tight">Full Platform Walkthrough</h2>
                        <p className="text-gray-400 text-xs font-medium">Experience the synergy of AI and human expertise.</p>
                    </div>
                    <div className="flex gap-3 w-full md:w-auto">
                        <button
                            onClick={() => { onClose(); window.location.href = '/admin-signup'; }}
                            className="flex-1 md:px-8 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-black italic uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                            Start Free <ArrowRight className="w-4 h-4 ml-1" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}


export default function LandingPage() {
    const navigate = useNavigate();
    const { user, profile, loading } = useAuthStore();
    const [showDemo, setShowDemo] = useState(false);
    const [billingAnnual, setBillingAnnual] = useState(false);
    const [activeStep, setActiveStep] = useState(0);
    const [isRedirecting, setIsRedirecting] = useState(false);

    useEffect(() => {
        if (!loading && user && profile) {
            if (profile.role === 'master_admin') navigate('/master-admin/dashboard');
            else if (profile.role === 'admin') navigate('/admin/dashboard');
            else navigate('/dashboard');
        }
    }, [user, profile, loading, navigate]);

    const pricingPlans = [
        {
            name: 'Starter',
            price: 0,
            period: '/mo',
            desc: 'Perfect for small teams exploring AI helpdesk.',
            cta: 'Get Started Free',
            ctaStyle: 'border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:border-emerald-900 hover:text-emerald-800 dark:hover:border-emerald-400 dark:hover:text-emerald-400',
            features: ['Up to 50 tickets/mo', 'Basic AI Categorization', 'Email Support', '1 Team Member', 'Public API Access'],
            popular: false,
        },
        {
            name: 'Growth',
            price: billingAnnual ? 3199 : 3999,
            period: '/mo',
            desc: 'For growing IT teams needing full automation.',
            cta: 'Start Free Trial',
            ctaStyle: 'bg-emerald-900 dark:bg-emerald-600 text-white hover:bg-emerald-800 dark:hover:bg-emerald-500 shadow-lg shadow-emerald-900/20',
            features: ['Up to 500 tickets/mo', 'Advanced AI Parsing', 'Priority Detection Engine', 'Duplicate Detection', '5 Team Members', 'Priority Email Support'],
            popular: true,
        },
        {
            name: 'Enterprise',
            priceLabel: 'Custom',
            period: '',
            desc: 'For large organizations with complex IT landscapes.',
            cta: 'Contact Sales',
            ctaStyle: 'border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:border-emerald-900 hover:text-emerald-800 dark:hover:border-emerald-400 dark:hover:text-emerald-400',
            features: ['Unlimited tickets', 'Custom AI Fine-Tuning', 'SSO & Audit Logs', 'Dedicated SLA Manager', 'Unlimited Members', 'VAPT & Compliance Reports'],
            popular: false,
        },
    ];

    return (
        <div className="min-h-screen bg-white font-sans text-slate-800">
            {showDemo && <DemoModal onClose={() => setShowDemo(false)} />}

            <Header setShowDemo={setShowDemo} />

            {/* ==================== HERO ==================== */}
            <Hero />

            {/* ==================== STATS BAR ==================== */}
            <section className="bg-emerald-900 dark:bg-slate-950 py-12 border-y border-emerald-800/20 dark:border-slate-800 text-white transition-colors duration-300">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center divide-y-2 sm:divide-y-0 sm:divide-x divide-white/10 dark:divide-slate-800">
                        <div className="pt-0">
                            <AnimatedStat prefix="+" target="80" suffix="%" label="Faster Ticket Triage" />
                        </div>
                        <div className="pt-4 sm:pt-0">
                            <AnimatedStat target="99" suffix="%" label="Classification Accuracy" />
                        </div>
                        <div className="pt-4 lg:pt-0">
                            <AnimatedStat target="Zero" label="Manual Routing Needed" isWord={true} />
                        </div>
                        <div className="pt-4 lg:pt-0">
                            <AnimatedStat target="24" suffix="/7" label="AI Auto-Resolution" />
                        </div>
                    </div>
                </div>
            </section>

            {/* ==================== FEATURES GRID ==================== */}
            <FeaturesGrid />

            {/* ==================== HOW IT WORKS ==================== */}
            <HowItWorks
                activeStep={activeStep}
                setActiveStep={setActiveStep}
            />

            {/* ==================== PRICING ==================== */}
            <Pricing
                billingAnnual={billingAnnual}
                setBillingAnnual={setBillingAnnual}
                pricingPlans={pricingPlans}
                isRedirecting={isRedirecting}
                setIsRedirecting={setIsRedirecting}
            />

            {/* ==================== TEAM SECTION ==================== */}
            <TeamSection />
            <Promote />
            {/* ==================== FOOTER ==================== */}
            <Footer />
        </div>
    );
}
// Nudge for redeploy
