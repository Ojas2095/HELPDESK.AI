import React, { useEffect, useState, useRef } from 'react';
import {
    CheckCircle2, Clock, Hash, Flag, FolderOpen, Users, 
    BrainCircuit, ScanSearch, Layers, Network, Zap
} from 'lucide-react';
import { formatFullTimestamp } from '../../utils/dateUtils';
import { motion, AnimatePresence } from 'framer-motion';
import useTicketStore from '../../store/ticketStore';

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
    {
        Icon: ScanSearch,
        title: '1. Ingestion',
        description: 'Ticket received and OCR text extracted.',
        timelineKey: 'created'
    },
    {
        Icon: BrainCircuit,
        title: '2. AI Analysis',
        description: 'Context understood by LLM Engine.',
        timelineKey: 'ai_analyzed'
    },
    {
        Icon: Layers,
        title: '3. Neural Triage',
        description: 'Category & Priority identified.',
        timelineKey: 'triaged'
    },
    {
        Icon: ScanSearch,
        title: '4. Metadata Harvesting',
        description: 'IPs, Hostnames & Errors extracted.',
        timelineKey: 'metadata_harvested'
    },
    {
        Icon: Network,
        title: '5. Intelligent Routing',
        description: 'Routed to optimal support team.',
        timelineKey: 'routed'
    },
    {
        Icon: Zap,
        title: '6. Resolution Phase',
        description: 'Solving / Auto-resolution in progress.',
        timelineKey: 'resolution_started',
        finalKey: 'resolved_at'
    },
];

// ─── Status → step index ──────────────────────────────────────────────────────

const STATUS_STEP_MAP = {
    submitted: 0,
    open: 0,
    new: 0,
    analyzing: 1,
    processing: 1,
    duplicate_check: 2,
    checking_duplicates: 2,
    auto_resolve: 3,
    troubleshooting: 3,
    pending_human: 4,
    escalated: 4,
    assigned: 4,
    in_progress: 4,
    resolved: 5,
    closed: 5,
    done: 5,
};

const getActiveStep = (status = '') => {
    const key = (status || '').toLowerCase().replace(/\s+/g, '_').trim();
    if (key in STATUS_STEP_MAP) return STATUS_STEP_MAP[key];

    // Fuzzy matching
    if (key.includes('resolv') || key.includes('closed') || key.includes('done')) return 5;
    if (key.includes('human') || key.includes('escalat') || key.includes('assign') || key.includes('progress')) return 4;
    if (key.includes('auto') || key.includes('plan')) return 3;
    if (key.includes('duplicate')) return 2;
    if (key.includes('analys') || key.includes('process') || key.includes('understanding')) return 1;
    if (key.includes('submit') || key.includes('open') || key.includes('new')) return 0;

    return 0;
};

// ─── Priority style mappings ───────────────────────────────────────────────────

const priorityStyle = (p = '') => {
    const l = String(p || '').toLowerCase();
    if (l === 'critical' || l === 'high') {
        return 'text-rose-600 bg-rose-50 border-rose-100 dark:text-rose-400 dark:bg-rose-500/10 dark:border-rose-500/20';
    }
    if (l === 'medium') {
        return 'text-amber-600 bg-amber-50 border-amber-100 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20';
    }
    return 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const StepNode = ({ state, Icon }) => {
    const ring = 'w-10 h-10 rounded-xl flex items-center justify-center';

    if (state === 'completed') {
        return (
            <div className={`${ring} bg-emerald-600 dark:bg-emerald-500 shadow-md shadow-emerald-500/10 shrink-0 z-10 border border-emerald-500/20`}>
                <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
        );
    }
    if (state === 'active') {
        return (
            <div className="relative shrink-0 z-10">
                <div className={`${ring} bg-emerald-600 dark:bg-emerald-500 border border-emerald-500/30 shadow-lg shadow-emerald-500/20`}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
                <motion.div
                    className="absolute inset-0 rounded-xl border-2 border-emerald-500/50"
                    animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
            </div>
        );
    }
    return (
        <div className={`${ring} bg-slate-50 dark:bg-white/[0.02] border-2 border-dashed border-slate-200 dark:border-white/10 shrink-0 z-10`}>
            <Icon className="w-4 h-4 text-slate-300 dark:text-slate-700" />
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const TicketTimeline = ({ ticketId, ticket: passedTicket, className = '', forceStep }) => {
    const activeTicket = useTicketStore(s => s.activeTicket);
    const tickets = useTicketStore(s => s.tickets);
    const aiTicket = useTicketStore(s => s.aiTicket);

    const ticket = passedTicket || (ticketId
        ? (tickets.find(t => t.ticket_id === ticketId) || activeTicket)
        : (activeTicket || aiTicket));

    if (!ticket) return null;

    const activeStep = forceStep !== undefined ? forceStep : getActiveStep(ticket.status);
    const completedCount = activeStep;
    const progressPct = Math.round((completedCount / (STEPS.length - 1)) * 100);

    const getTimestamp = (idx, state) => {
        if (state === 'pending') return null;
        
        const step = STEPS[idx];
        const timeline = ticket.timeline || {};
        
        if (timeline[step.timelineKey]) {
            return formatFullTimestamp(timeline[step.timelineKey]);
        }

        if (idx === STEPS.length - 1 && (ticket.resolved_at || ticket.status === 'resolved')) {
            return formatFullTimestamp(ticket.resolved_at || ticket.updated_at);
        }

        if (idx === 0) return formatFullTimestamp(ticket.created_at || ticket.timestamp);
        
        return state === 'active' ? 'Processing telemetry...' : 'Triage node complete';
    };

    return (
        <div className={`bg-white dark:bg-slate-900 border border-slate-150 dark:border-white/[0.08] rounded-[2.5rem] shadow-sm dark:shadow-none overflow-hidden text-left transition-colors duration-300 ${className}`}>

            {/* TICKET SUMMARY METADATA GRID CARD */}
            <div className="p-6 sm:p-8 border-b border-slate-150 dark:border-white/[0.05]">
                <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-5 ml-1">
                    System Core Payload Summary
                </h3>

                <div className="grid grid-cols-2 gap-4">
                    <SummaryField
                        Icon={Hash}
                        label="Telemetry ID"
                        value={ticket.ticket_id ? `#${ticket.ticket_id}` : '—'}
                    />
                    <SummaryField
                        Icon={Flag}
                        label="Urgency Vector"
                        value={ticket.priority || '—'}
                        valueClass={`font-black text-[10px] uppercase tracking-wider px-3 h-6 flex items-center justify-center rounded-full border ${priorityStyle(ticket.priority)}`}
                    />
                    <SummaryField
                        Icon={FolderOpen}
                        label="Domain Classification"
                        value={ticket.category || '—'}
                    />
                    <SummaryField
                        Icon={Users}
                        label="Operational Cluster Group"
                        value={ticket.assigned_team || '—'}
                    />
                </div>
            </div>

            {/* PIPELINE PROGRESS DYNAMICS TRACKER */}
            <div className="px-6 sm:px-8 pt-6 pb-5 border-b border-slate-150 dark:border-white/[0.05]">
                <div className="flex items-center justify-between mb-4">
                    <div className="space-y-0.5">
                        <p className="text-sm font-black text-slate-900 dark:text-white font-syne uppercase tracking-wider">Processing Sequence Status</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
                            {completedCount} of {STEPS.length} sequential pipelines executed
                        </p>
                    </div>
                    <AnimatePresence mode="wait">
                        <motion.span
                            key={progressPct}
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums font-syne"
                        >
                            {progressPct}%
                        </motion.span>
                    </AnimatePresence>
                </div>

                {/* Progress bar pipeline track */}
                <div className="h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden shadow-inner">
                    <motion.div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.3)]"
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                </div>
            </div>

            {/* SEQUENTIAL STEPS TIMELINE */}
            <div className="p-6 sm:p-8 space-y-2">
                {STEPS.map((step, idx) => {
                    const state = getStepState(idx, activeStep);
                    const ts = getTimestamp(idx, state);
                    const isLast = idx === STEPS.length - 1;

                    return (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.22, delay: idx * 0.04 }}
                            className="relative flex gap-5"
                        >
                            {/* Left layout column: Node icons and logic lines */}
                            <div className="flex flex-col items-center">
                                <StepNode state={state} Icon={step.Icon} />
                                {!isLast && (
                                    <div className="w-[2px] flex-1 my-1.5 min-h-[42px]">
                                        <motion.div
                                            className="w-full h-full rounded-full"
                                            animate={{
                                                backgroundColor: state === 'completed' ? '#10b981' : 'rgba(255, 255, 255, 0.04)'
                                            }}
                                            style={state !== 'completed' ? { backgroundColor: '#e2e8f0' } : undefined}
                                            transition={{ duration: 0.4 }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Right layout column: Linguistic labels metadata outputs */}
                            <div className={`flex-1 min-w-0 pt-1.5 ${isLast ? 'pb-0' : 'pb-8'}`}>
                                <p className={`text-sm font-black tracking-wide mb-1 uppercase font-syne ${
                                    state === 'pending' ? 'text-slate-300 dark:text-slate-700' :
                                    state === 'active' ? 'text-slate-900 dark:text-white font-extrabold' :
                                    'text-slate-600 dark:text-slate-400'
                                }`}>
                                    {step.title}
                                </p>

                                <p className={`text-xs font-medium leading-relaxed m-0 ${
                                    state === 'pending' ? 'text-slate-300/60 dark:text-slate-800' :
                                    state === 'active' ? 'text-slate-500 dark:text-slate-300' :
                                    'text-slate-400 dark:text-slate-500'
                                }`}>
                                    {step.description}
                                </p>

                                {ts && (
                                    <div className="flex items-center gap-1.5 mt-2.5">
                                        <Clock className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 shrink-0" />
                                        <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                                            state === 'active' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-600'
                                        }`}>
                                            {ts}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
};

// ─── Component Field Definition Helper ─────────────────────────────────────────

const SummaryField = ({ Icon, label, value, valueClass }) => (
    <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-150 dark:border-white/[0.05] flex items-center justify-center shrink-0 mt-0.5 shadow-inner">
            <Icon className="w-4 h-4 text-slate-400 dark:text-slate-600" />
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block pl-0.5">{label}</span>
            {valueClass ? (
                <div className="flex justify-start items-center">
                    <span className={valueClass}>{value}</span>
                </div>
            ) : (
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate m-0 font-medium">{value}</p>
            )}
        </div>
    </div>
);

export default TicketTimeline;
