import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Inbox, AlertCircle, ArrowRight } from 'lucide-react';
import useAuthStore from '../../store/authStore';
import { supabase } from '../../lib/supabaseClient';
import { formatTimelineDate } from '../../utils/dateUtils';
import { Card, CardContent } from "../../components/ui/card";

const RecentTickets = () => {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchRecentTickets = async () => {
        if (!user?.id) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const { data, error: sbError } = await supabase
                .from('tickets')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(5);

            if (sbError) throw sbError;
            setTickets(data || []);
        } catch (err) {
            console.error("Error fetching recent tickets:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRecentTickets();
    }, []);

    const getStatusBadge = (status) => {
        const s = String(status || '').toLowerCase();
        const baseStyle = "px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-full border inline-block whitespace-nowrap";
        
        switch (s) {
            case 'resolved':
            case 'resolved by human support':
                return <span className={`${baseStyle} bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.1)]`}>Resolved</span>;
            case 'pending':
            case 'pending human support':
            case 'pending_human':
                return <span className={`${baseStyle} bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse`}>Pending</span>;
            case 'in progress':
                return <span className={`${baseStyle} bg-blue-500/10 text-blue-400 border-blue-500/20`}>In Progress</span>;
            case 'open':
                return <span className={`${baseStyle} bg-purple-500/10 text-purple-400 border-purple-500/20`}>Open</span>;
            default:
                return <span className={`${baseStyle} bg-white/5 text-slate-300 border-white/10`}>{status || 'Open'}</span>;
        }
    };

    return (
        <Card className="p-0 overflow-hidden rounded-[2.5rem] border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-900 shadow-sm dark:shadow-none text-left w-full">
            {/* Header section layout */}
            <div className="p-6 sm:px-8 border-b border-slate-150 dark:border-white/[0.05] flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 shadow-sm">
                        <Clock size={16} />
                    </div>
                    <span className="font-bold text-slate-900 dark:text-white text-base tracking-tight font-syne">
                        Recent Tickets
                    </span>
                </div>
                <button
                    onClick={() => navigate('/my-tickets')}
                    className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-transparent border-none cursor-pointer hover:text-emerald-500 dark:hover:text-emerald-300 group transition-colors p-1"
                >
                    <span>View All</span>
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                </button>
            </div>

            {/* Content Switcher Frame */}
            <CardContent className="p-0">
                <AnimatePresence mode="wait">
                    {loading ? (
                        /* Telemetry Data Loading Skeleton Frame */
                        <motion.div 
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-6 sm:p-8 space-y-4"
                        >
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="flex items-center gap-4 py-2 border-b border-slate-100 dark:border-white/[0.02] last:border-none">
                                    <div className="h-4 w-12 bg-slate-100 dark:bg-white/5 rounded animate-pulse shrink-0" />
                                    <div className="h-4 flex-1 bg-slate-100 dark:bg-white/5 rounded animate-pulse" />
                                    <div className="h-6 w-20 bg-slate-100 dark:bg-white/5 rounded-full animate-pulse shrink-0" />
                                </div>
                            ))}
                        </motion.div>
                    ) : error ? (
                        /* Network Error Exception Frame mapping */
                        <motion.div 
                            key="error"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-8 sm:p-12 text-center"
                        >
                            <div className="max-w-xs mx-auto flex flex-col items-center gap-3 p-6 rounded-2xl border border-dashed border-rose-500/20 bg-rose-500/[0.02]">
                                <AlertCircle size={28} className="text-rose-500/60" />
                                <p className="text-sm font-black uppercase tracking-wider text-rose-500 m-0">Sync Fault Exception</p>
                                <p className="text-[10px] font-mono text-rose-400/80 m-0 leading-normal truncate w-full" title={error}>{error}</p>
                            </div>
                        </motion.div>
                    ) : tickets.length === 0 ? (
                        /* Empty Repository Tracking Pipeline Block */
                        <motion.div 
                            key="empty"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="p-8 sm:p-12 text-center"
                        >
                            <div className="max-w-sm mx-auto flex flex-col items-center gap-3 p-6 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01]">
                                <Inbox size={28} className="text-slate-300 dark:text-slate-700" />
                                <h4 className="text-sm font-extrabold text-slate-900 dark:text-white m-0 tracking-tight font-syne">No Active Tickets Found</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium m-0 leading-relaxed">
                                    Report an infrastructure exception model to activate immediate automated heuristics pipelines.
                                </p>
                            </div>
                        </motion.div>
                    ) : (
                        /* Populated Interactive Data Node Cluster Table grid */
                        <motion.div 
                            key="data"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="overflow-x-auto customize-scrollbar w-full"
                        >
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr className="bg-slate-50/50 dark:bg-white/[0.01] border-b border-slate-150 dark:border-white/[0.05]">
                                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-6 sm:px-8 py-3.5 w-24">Cluster ID</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-6 sm:px-8 py-3.5">Incident Subject Description</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-6 sm:px-8 py-3.5 w-32">Status Flag</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 px-6 sm:px-8 py-3.5 w-40">Pipeline Record</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tickets.map((ticket) => (
                                        <tr
                                            key={ticket.id}
                                            onClick={() => navigate(`/ticket/${ticket.id}`)}
                                            className="border-b border-slate-100 dark:border-white/[0.02] last:border-none cursor-pointer bg-transparent hover:bg-slate-50/60 dark:hover:bg-white/[0.01] transition-colors"
                                        >
                                            <td className="px-6 sm:px-8 py-4">
                                                <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                    #{ticket.id}
                                                </span>
                                            </td>
                                            <td className="px-6 sm:px-8 py-4 max-w-[280px] sm:max-w-xs md:max-w-md">
                                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 m-0 truncate leading-normal font-medium">
                                                    {ticket.summary || ticket.subject || ticket.description || "No parameter payload definition provided."}
                                                </p>
                                            </td>
                                            <td className="px-6 sm:px-8 py-4">
                                                {getStatusBadge(ticket.status)}
                                            </td>
                                            <td className="px-6 sm:px-8 py-4 whitespace-nowrap">
                                                <span className="text-xs font-bold text-slate-400 dark:text-slate-500 font-mono">
                                                    {formatTimelineDate(ticket.created_at)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>

            <style dangerouslySetInnerHTML={{
                __html: `
                .customize-scrollbar::-webkit-scrollbar { height: 4px; }
                .customize-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .customize-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.15); border-radius: 99px; }
                .dark .customize-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
            `}} />
        </Card>
    );
};

export default RecentTickets;
