import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, ShieldCheck } from 'lucide-react';

// SLA resolution limits in milliseconds based on priority.
const SLA_LIMITS = {
    critical: 4 * 60 * 60 * 1000,
    high: 12 * 60 * 60 * 1000,
    medium: 24 * 60 * 60 * 1000,
    low: 72 * 60 * 60 * 1000,
};

function formatDuration(ms) {
    if (ms <= 0) return 'Breached';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

/**
 * SLABadge — shows SLA status for a ticket.
 * 
 * Props:
 *  - priority: string ('critical' | 'high' | 'medium' | 'low')
 *  - createdAt: string (ISO date string)
 *  - slaBreachAt: string (ISO date string) — preferred persisted deadline
 *  - slaStatus: string ('ACTIVE' | 'WARNING' | 'BREACHED')
 *  - status: string — if ticket is resolved/closed, show "Met" without countdown
 *  - compact: bool — if true, shows just the badge with no label text
 */
export default function SLABadge({ priority, createdAt, slaBreachAt, slaStatus, status, compact = false }) {
    const [remaining, setRemaining] = useState(null);

    const normalizedStatus = status?.toLowerCase();
    const normalizedSlaStatus = slaStatus?.toUpperCase();
    const isResolved = ['resolved', 'closed', 'auto-resolved', 'auto resolved'].includes(normalizedStatus);

    useEffect(() => {
        if (isResolved) return;
        if (normalizedSlaStatus === 'BREACHED') {
            setRemaining(-1);
            return;
        }

        const priorityKey = priority?.toLowerCase?.() || 'medium';
        const limit = SLA_LIMITS[priorityKey] || SLA_LIMITS.medium;
        const deadlineMs = slaBreachAt
            ? new Date(slaBreachAt).getTime()
            : new Date(createdAt).getTime() + limit;

        if (!Number.isFinite(deadlineMs)) return;

        const calculate = () => {
            const rem = deadlineMs - Date.now();
            setRemaining(rem);
        };

        calculate();
        const timer = setInterval(calculate, 60 * 1000); // update every minute
        return () => clearInterval(timer);
    }, [priority, createdAt, slaBreachAt, normalizedSlaStatus, isResolved]);

    if (isResolved) {
        return (
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-wide whitespace-nowrap`}>
                <ShieldCheck className="w-3 h-3" />
                {!compact && 'SLA Met'}
            </span>
        );
    }

    if (remaining === null) return null;

    const isBreached = remaining <= 0;
    const isCritical = remaining <= 30 * 60 * 1000 && remaining > 0; // < 30 min
    const isWarning = remaining <= 60 * 60 * 1000 && remaining > 30 * 60 * 1000; // 30–60 min

    let colorClasses = 'bg-blue-50 text-blue-700 border-blue-100';
    let Icon = Clock;

    if (isBreached) {
        colorClasses = 'bg-red-100 text-red-700 border-red-200 animate-pulse';
        Icon = AlertTriangle;
    } else if (isCritical) {
        colorClasses = 'bg-red-50 text-red-600 border-red-100';
        Icon = AlertTriangle;
    } else if (isWarning) {
        colorClasses = 'bg-amber-50 text-amber-700 border-amber-100';
        Icon = Clock;
    } else {
        colorClasses = 'bg-green-50 text-emerald-700 border-emerald-100';
        Icon = Clock;
    }

    return (
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full border uppercase tracking-wide whitespace-nowrap ${colorClasses}`}>
            <Icon className="w-3 h-3" />
            {isBreached ? 'SLA Breached' : formatDuration(remaining)}
        </span>
    );
}
