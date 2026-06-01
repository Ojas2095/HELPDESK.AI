import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PlusCircle, ListTodo, Sparkles } from 'lucide-react';

const WelcomeCard = ({ userName = 'Ritesh' }) => {
  const navigate = useNavigate();

    return (
        <motion.div
            id="tour-welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full relative overflow-hidden bg-white dark:bg-slate-900 border-l-4 border-emerald-500 rounded-[2rem] shadow-sm dark:shadow-none p-8 sm:p-12 text-left"
        >
            {/* Ambient Background Glow */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[80px] pointer-events-none" />

            {/* AI Status Badge */}
            <div className="mb-6">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-[0.15em]">
                    <Sparkles size={12} className="fill-current" />
                    AI-Enhanced Support
                </span>
            </div>

            {/* Dynamic Heading */}
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mb-3 tracking-tight font-syne italic">
                Welcome back, <span className="text-emerald-500">{userName}</span>
            </h2>

            {/* Contextual Description */}
            <p className="text-slate-500 dark:text-slate-400 text-base sm:text-lg font-medium leading-relaxed max-w-xl mb-10">
                Our autonomous heuristics are primed for deployment. Most reported issues reach successful resolution nodes in under 300 seconds.
            </p>

            {/* Interactive Command Cluster */}
            <div className="flex flex-wrap gap-4">
                <motion.button
                    id="tour-create-ticket"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/create-ticket')}
                    className="inline-flex items-center gap-2.5 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold text-sm uppercase tracking-wider transition-all shadow-xl shadow-emerald-600/20 border-none cursor-pointer"
                >
                    <PlusCircle size={18} />
                    Report New Issue
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => navigate('/my-tickets')}
                    className="inline-flex items-center gap-2.5 px-8 py-4 bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 rounded-2xl font-bold text-sm uppercase tracking-wider transition-all cursor-pointer shadow-sm"
                >
                    <ListTodo size={18} />
                    View My Tickets
                </motion.button>
            </div>
        </motion.div>
    );
};

export default WelcomeCard;
