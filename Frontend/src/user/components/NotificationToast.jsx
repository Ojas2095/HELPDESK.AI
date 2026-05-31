import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, MessageSquare, X, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useTicketStore from "../../store/ticketStore";

const NotificationToast = () => {
    const notifications = useTicketStore(state => state.notifications);
    const [currentToast, setCurrentToast] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (notifications.length > 0) {
            const latest = notifications[0];
            const shownToasts = JSON.parse(sessionStorage.getItem('shownToasts') || '[]');

            if (!latest.read && !shownToasts.includes(latest.id)) {
                setCurrentToast(latest);
                sessionStorage.setItem('shownToasts', JSON.stringify([...shownToasts, latest.id]));

                const timer = setTimeout(() => {
                    setCurrentToast(null);
                }, 5000);

                return () => clearTimeout(timer);
            }
        }
    }, [notifications]);

    const getIcon = () => {
        if (!currentToast) return null;
        if (currentToast.title.includes('Resolved')) {
            return <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />;
        }
        return <MessageSquare className="w-5 h-5 text-blue-500 dark:text-blue-400 shrink-0" />;
    };

    return (
        <AnimatePresence>
            {currentToast && (
                <motion.div
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.2 } }}
                    className="fixed bottom-6 right-6 z-[100] w-full max-w-sm px-4 sm:px-0"
                >
                    <div
                        onClick={() => {
                            navigate(`/ticket/${currentToast.ticketId}`);
                            setCurrentToast(null);
                        }}
                        className="bg-white dark:bg-slate-900 border border-slate-150 dark:border-white/[0.08] shadow-2xl rounded-2xl p-4 flex gap-4 cursor-pointer hover:border-emerald-500/30 dark:hover:border-emerald-500/30 transition-all group relative overflow-hidden text-left"
                    >
                        {/* High-fidelity visual countdown timer bar */}
                        <motion.div
                            initial={{ width: '100%' }}
                            animate={{ width: 0 }}
                            transition={{ duration: 5, ease: "linear" }}
                            className="absolute bottom-0 left-0 h-1 bg-emerald-500 dark:bg-emerald-400 opacity-30 dark:opacity-40 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                        />

                        {/* Icon Wrapper Context Node */}
                        <div className="size-10 bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.05] rounded-xl flex items-center justify-center shrink-0 group-hover:bg-emerald-500/10 transition-colors">
                            {getIcon()}
                        </div>

                        {/* Text and Controls Layout Container */}
                        <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                                <h4 className="text-sm font-black text-slate-900 dark:text-white truncate font-syne tracking-tight">
                                    {currentToast.title}
                                </h4>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setCurrentToast(null);
                                    }}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-all bg-transparent border-none cursor-pointer shrink-0"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                {currentToast.message}
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default NotificationToast;
