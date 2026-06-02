<<<<<<< HEAD
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, GitCommit, ArrowLeft, Zap, Sparkles, ChevronLeft } from 'lucide-react';
import { Card } from '../components/ui/card';
import Header from "../components/landing/Header";
import Footer from "../components/landing/Footer";

// --- ANIMATION VARIANTS ---
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: { staggerChildren: 0.15 }
    }
};

const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { type: 'spring', stiffness: 60, damping: 15 }
    }
};
=======
import React from "react";
import {
  Rocket,
  Sparkles,
  Bug,
  ShieldCheck,
  CalendarDays,
  GitCommitHorizontal,
} from "lucide-react";
>>>>>>> upstream/gssoc

import { motion } from "framer-motion";

<<<<<<< HEAD
    const changes = [
        {
            version: 'v1.2.0',
            date: 'May 2026',
            badge: 'Latest Release',
            badgeColor: 'emerald',
            highlight: 'Standalone Docs Portal & Dynamic Search',
            items: [
                'Created complete standalone Docs Portal (/docs) outside authenticated routing grids.',
                'Integrated interactive on-screen endpoint payload simulation and terminal output logs.',
                'Resolved jsconfig compiler issues by deprecating outdated ignoreDeprecations keys.',
                'Optimized responsive layout transitions across both mobile drawer and desktop headers.'
            ]
        },
        {
            version: 'v1.1.0',
            date: 'April 2026',
            badge: 'Update',
            badgeColor: 'blue',
            highlight: 'Local Tesseract.js OCR and Siri Voice Recognition',
            items: [
                'Added client-side webkitSpeechRecognition API dictation assistant with live amplitude waveforms.',
                'Implemented offline image OCR with local Tesseract.js engine parsing image attachment telemetry.',
                'Connected Supabase tables to log AI entities scanned directly from ticket descriptions.',
                'Enacted dynamic SLA fallback computations based on category routing priorities.'
            ]
        },
        {
            version: 'v1.0.0',
            date: 'March 2026',
            badge: 'Major Release',
            badgeColor: 'purple',
            highlight: 'Core AI Routing Engine Deployment',
            items: [
                'Launched main multi-tenant portal with full dashboard telemetry, tracking, and company lobbies.',
                'Connected Gemini API fallback interfaces to self-heal local database load degradation issues.',
                'Created admin console enabling support agents to claim, claim-override, or resolve tickets live.'
            ]
        }
    ];

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
            <Header />

            <motion.main 
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="flex-grow max-w-3xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12 sm:space-y-20 relative z-10"
            >
                {/* Hero Header */}
                <motion.div variants={itemVariants} className="space-y-6 text-center sm:text-left">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-700 dark:text-indigo-400 text-sm font-extrabold uppercase tracking-wider">
                        <Sparkles size={16} /> System Changelog
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] font-syne">
                        Product Updates <br /> & Features
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl font-medium">
                        Stay informed about system features, framework optimizations, and local AI training models introduced into the HELPDESK.AI ecosystem.
                    </p>
                </motion.div>

                {/* Timeline Implementation */}
                <div className="relative border-l-2 border-slate-100 dark:border-slate-800/60 ml-4 sm:ml-6 space-y-16 py-4">
                    {changes.map((change, idx) => (
                        <motion.div 
                            key={change.version} 
                            variants={itemVariants}
                            className="relative pl-8 sm:pl-12 group"
                        >
                            {/* Timeline Node */}
                            <div className="absolute -left-[13px] top-1.5 w-6 h-6 rounded-full bg-white dark:bg-slate-900 border-2 border-indigo-500 flex items-center justify-center text-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)] group-hover:scale-125 transition-transform duration-300 z-10">
                                <GitCommit size={14} />
                            </div>

                            <div className="space-y-6">
                                {/* Header Info */}
                                <div className="flex flex-wrap items-center gap-4">
                                    <span className="text-2xl font-black text-slate-900 dark:text-white font-syne tracking-tight">
                                        {change.version}
                                    </span>
                                    <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500 text-sm font-bold">
                                        <Calendar size={16} />
                                        <span>{change.date}</span>
                                    </div>
                                    <span className={`px-3 py-1 rounded-full bg-${change.badgeColor}-500/10 border border-${change.badgeColor}-500/20 text-[10px] font-black text-${change.badgeColor}-600 dark:text-${change.badgeColor}-400 uppercase tracking-[0.2em]`}>
                                        {change.badge}
                                    </span>
                                </div>

                                {/* Content Card */}
                                <Card className="p-6 sm:p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl dark:shadow-none hover:border-indigo-500/30 transition-all duration-300 relative overflow-hidden">
                                    <div className="space-y-6 relative z-10 text-left">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                                                <Zap size={16} fill="currentColor" />
                                            </div>
                                            <h4 className="font-extrabold text-slate-900 dark:text-white text-lg tracking-tight">
                                                {change.highlight}
                                            </h4>
                                        </div>
                                        
                                        <ul className="space-y-3">
                                            {change.items.map((item, itemIdx) => (
                                                <li key={itemIdx} className="flex items-start gap-3 text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed font-medium">
                                                    <span className="mt-2.5 w-1.5 h-1.5 rounded-full bg-indigo-500/40 shrink-0" />
                                                    {item}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </Card>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Bottom Attribution */}
                <div className="pt-12 text-center border-t border-slate-100 dark:border-slate-800/60">
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 dark:text-slate-600">
                        System Versioning &copy; 2026 HELPDESK.AI
                    </p>
                </div>
            </motion.main>

            <Footer />
=======
const releases = [
  {
    version: "v2.1.0",
    date: "May 20, 2026",
    type: "Major Release",
    status: "Live",
    features: [
      "Introduced AI-powered smart ticket routing engine",
      "Added enterprise analytics dashboard with live metrics",
      "Integrated multilingual support for global organizations",
    ],
    enhancements: [
      "Improved dashboard loading performance by 35%",
      "Enhanced accessibility contrast and readability",
      "Optimized backend request caching for faster responses",
    ],
    fixes: [
      "Fixed session timeout issue after inactivity",
      "Resolved notification synchronization bug",
      "Fixed mobile sidebar overlap on smaller devices",
    ],
  },

  {
    version: "v2.0.2",
    date: "May 10, 2026",
    type: "Patch Update",
    status: "Stable",
    features: [
      "Added bulk export functionality for support tickets",
      "Introduced advanced ticket filtering system",
    ],
    enhancements: [
      "Improved authentication flow security",
      "Optimized API request handling",
    ],
    fixes: [
      "Resolved login redirect issue",
      "Fixed navbar responsiveness on tablets",
    ],
  },

  {
    version: "v2.0.0",
    date: "April 28, 2026",
    type: "Platform Launch",
    status: "Released",
    features: [
      "Official launch of HelpDesk.AI platform",
      "AI-based issue auto-categorization system",
      "Role-based admin management implementation",
    ],
    enhancements: [
      "Modernized UI architecture using Tailwind CSS",
      "Improved dark mode consistency",
    ],
    fixes: [
      "Initial stability improvements",
      "Security hardening patches",
    ],
  },
];

const FadeIn = {
  hidden: {
    opacity: 0,
    y: 40,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
};

const Section = ({
  title,
  icon,
  items,
  glow,
}) => {
  return (
    <div className="mb-8">

      <div className="flex items-center gap-3 mb-4">
        <div
          className={`p-2 rounded-xl ${glow}`}
        >
          {icon}
>>>>>>> upstream/gssoc
        </div>

        <h3 className="text-2xl font-semibold text-white">
          {title}
        </h3>
      </div>

      <div className="space-y-3">
        {items.map((item, index) => (
          <motion.div
            key={index}
            whileHover={{ x: 6 }}
            className="flex gap-3 text-gray-300 leading-relaxed"
          >
            <span className="text-green-400 mt-1">
              •
            </span>

            <p>{item}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

const Changelog = () => {
  return (
    <div className="min-h-screen bg-[#021510] overflow-hidden text-white relative">

      {/* Background Glow Effects */}
      <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-green-500/10 blur-[120px]" />

      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-emerald-400/10 blur-[120px]" />

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-24 pb-16">

        <motion.div
          initial="hidden"
          animate="visible"
          variants={FadeIn}
          transition={{ duration: 0.7 }}
          className="max-w-6xl mx-auto text-center"
        >

          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-5 py-2 rounded-full text-green-400 mb-8 backdrop-blur-md">

            <GitCommitHorizontal size={16} />

            <span className="text-sm font-medium tracking-wide">
              PRODUCT RELEASE NOTES
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">

            Platform
            <span className="text-green-400">
              {" "}Changelog
            </span>
          </h1>

          {/* Description */}
          <p className="text-gray-400 text-lg md:text-xl max-w-3xl mx-auto leading-relaxed">

            Stay updated with the latest platform improvements,
            AI enhancements, security patches, and feature
            releases across HelpDesk.AI.
          </p>

        </motion.div>
      </section>

      {/* Timeline */}
      <section className="relative z-10 px-6 pb-24">

        <div className="max-w-5xl mx-auto relative">

          {/* Vertical Line */}
          <div className="absolute left-4 top-0 w-[2px] h-full bg-gradient-to-b from-green-500/70 via-green-500/20 to-transparent" />

          {/* Release Cards */}
          <div className="space-y-16">

            {releases.map((release, index) => (
              <motion.div
                key={index}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={FadeIn}
                transition={{
                  duration: 0.6,
                  delay: index * 0.1,
                }}
                className="relative pl-14"
              >

                {/* Timeline Dot */}
                <div className="absolute left-0 top-8">

                  <div className="w-8 h-8 rounded-full bg-green-500 border-4 border-[#021510] shadow-[0_0_25px_rgba(34,197,94,0.8)]" />

                </div>

                {/* Card */}
                <motion.div
                  whileHover={{
                    scale: 1.01,
                  }}
                  transition={{
                    duration: 0.3,
                  }}
                  className="relative bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 md:p-10 shadow-2xl overflow-hidden"
                >

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />

                  {/* Header */}
                  <div className="relative flex flex-wrap items-center justify-between gap-4 mb-10">

                    <div className="flex items-center gap-4 flex-wrap">

                      {/* Version */}
                      <div className="bg-green-500 text-black font-bold px-5 py-2 rounded-full text-sm shadow-lg">
                        {release.version}
                      </div>

                      {/* Type */}
                      <div className="bg-white/10 border border-white/10 text-gray-300 px-4 py-2 rounded-full text-sm">
                        {release.type}
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2 text-green-400 text-sm">

                        <ShieldCheck size={16} />

                        {release.status}
                      </div>
                    </div>

                    {/* Date */}
                    <div className="flex items-center gap-2 text-gray-400">

                      <CalendarDays size={18} />

                      <span>{release.date}</span>
                    </div>
                  </div>

                  {/* Sections */}
                  <div className="relative">

                    <Section
                      title="New Features"
                      glow="bg-green-500/20"
                      icon={
                        <Rocket className="text-green-400" />
                      }
                      items={release.features}
                    />

                    <Section
                      title="Enhancements"
                      glow="bg-blue-500/20"
                      icon={
                        <Sparkles className="text-blue-400" />
                      }
                      items={release.enhancements}
                    />

                    <Section
                      title="Bug Fixes"
                      glow="bg-red-500/20"
                      icon={
                        <Bug className="text-red-400" />
                      }
                      items={release.fixes}
                    />

                  </div>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Changelog;