import React from 'react';
import { Badge } from "../../components/ui/badge";
import { motion } from 'framer-motion';

const TicketStatusBadge = ({ status }) => {
    const s = (status || '').toLowerCase();

    const getStatusConfig = () => {
        if (s.includes('resolv') || s.includes('closed')) {
            return {
                label: 'Resolved',
                className: 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10',
                dotColor: 'bg-slate-400 dark:bg-slate-500'
            };
        }
        if (s.includes('progress') || s.includes('active')) {
            return {
                label: 'In Progress',
                className: 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-sm shadow-emerald-500/5 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
                dotColor: 'bg-emerald-500',
                animate: true
            };
        }
        if (s.includes('escalate')) {
            return {
                label: 'Escalated',
                className: 'bg-rose-50 text-rose-600 border-rose-100 shadow-sm shadow-rose-500/5 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
                dotColor: 'bg-rose-500',
                animate: true
            };
        }
        
        return {
            label: status?.toUpperCase() || 'OPEN',
            className: 'bg-amber-50 text-amber-600 border-amber-100 shadow-sm shadow-amber-500/5 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
            dotColor: 'bg-amber-500',
            animate: s.includes('open') || s.includes('pend')
        };
    };

    const config = getStatusConfig();

    return (
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            key={status}
            className="inline-block"
        >
            <Badge className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-widest border rounded-xl transition-all shadow-none ${config.className}`}>
                <span className="relative flex h-2 w-2">
                    {config.animate && (
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${config.dotColor}`} />
                    )}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${config.dotColor}`} />
                </span>
                <span>{config.label}</span>
            </Badge>
        </motion.div>
    );
};

export default TicketStatusBadge;