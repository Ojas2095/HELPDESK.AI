import React, { useState, useCallback } from 'react';
import Joyride, { ACTIONS, EVENTS, STATUS } from 'react-joyride';

const TOUR_KEY = 'userTourCompleted';

const steps = [
    {
        target: '#tour-welcome-card',
        title: 'Welcome to Emerald Prime 👋',
        content: 'This is your personal support hub. From here you can track all your tickets and access AI-powered help.',
        placement: 'bottom',
        disableBeacon: true,
    },
    {
        target: '#tour-report-btn',
        title: 'Report a New Issue',
        content: 'Click here to submit a new support ticket. Our AI will triage it instantly—most issues are resolved in minutes.',
        placement: 'bottom',
        disableBeacon: true,
    },
    {
        target: '#tour-quick-actions',
        title: 'Quick Actions',
        content: 'Jump straight to the most common issue types. Each tile routes your problem to the right team automatically.',
        placement: 'top',
        disableBeacon: true,
    },
    {
        target: '#tour-recent-tickets',
        title: 'Your Recent Tickets',
        content: 'Keep tabs on all your open and resolved tickets in real-time. Click any row to view the full conversation thread.',
        placement: 'top',
        disableBeacon: true,
    },
];

function EmeraldTooltip({
    continuous,
    index,
    step,
    backProps,
    closeProps,
    primaryProps,
    skipProps,
    tooltipProps,
    size,
}) {
    return (
        <div
            {...tooltipProps}
            className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-white/[0.08] p-6 max-w-xs w-72 text-left relative z-50 font-sans"
        >
            {/* Step counter pill */}
            <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20">
                    Step {index + 1} of {size}
                </span>
                <button
                    {...skipProps}
                    className="text-[11px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors bg-transparent border-none cursor-pointer"
                    title="Skip tour"
                >
                    Skip
                </button>
            </div>

            {/* Title */}
            <h3 className="text-base font-black text-slate-900 dark:text-white mb-2 leading-tight font-syne uppercase tracking-tight">
                {step.title}
            </h3>

            {/* Body */}
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-5 m-0">
                {step.content}
            </p>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5 mb-5">
                {Array.from({ length: size }).map((_, i) => (
                    <div
                        key={i}
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            i === index
                                ? 'w-5 bg-emerald-600 dark:bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                                : i < index
                                ? 'w-1.5 bg-emerald-300 dark:bg-emerald-500/40'
                                : 'w-1.5 bg-slate-200 dark:bg-slate-800'
                        }`}
                    />
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
                {index > 0 && (
                    <button
                        {...backProps}
                        className="flex-1 h-10 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 text-xs font-black uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-white/5 transition-all active:scale-95 cursor-pointer bg-transparent"
                    >
                        Back
                    </button>
                )}
                {continuous ? (
                    <button
                        {...primaryProps}
                        className="flex-1 h-10 rounded-xl bg-emerald-600 dark:bg-emerald-400 hover:bg-emerald-500 dark:hover:bg-emerald-300 text-white dark:text-slate-900 text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow-xl shadow-emerald-600/10 dark:shadow-none border-none cursor-pointer"
                    >
                        {index === size - 1 ? "Got it 🎉" : "Next →"}
                    </button>
                ) : (
                    <button
                        {...closeProps}
                        className="flex-1 h-10 rounded-xl bg-emerald-600 dark:bg-emerald-400 hover:bg-emerald-500 dark:hover:bg-emerald-300 text-white dark:text-slate-900 text-xs font-black uppercase tracking-wider transition-all active:scale-95 border-none cursor-pointer"
                    >
                        Close
                    </button>
                )}
            </div>
        </div>
    );
}

const UserTour = () => {
    const [run, setRun] = useState(() => {
        return localStorage.getItem(TOUR_KEY) !== 'true';
    });

    const handleCallback = useCallback((data) => {
        const { action, status, type } = data;

        const isFinished = status === STATUS.FINISHED;
        const isSkipped = status === STATUS.SKIPPED;
        const isClosed = action === ACTIONS.CLOSE && type === EVENTS.STEP_AFTER;

        if (isFinished || isSkipped || isClosed) {
            localStorage.setItem(TOUR_KEY, 'true');
            setRun(false);
        }
    }, []);

    // Get the current document theme fallback configuration values
    const isDark = document.documentElement.classList.contains('dark');

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            showSkipButton
            scrollToFirstStep
            scrollOffset={80}
            tooltipComponent={EmeraldTooltip}
            callback={handleCallback}
            floaterProps={{ disableAnimation: false }}
            styles={{
                options: {
                    arrowColor: isDark ? '#111927' : '#ffffff',
                    overlayColor: isDark ? 'rgba(5, 5, 8, 0.6)' : 'rgba(15, 23, 42, 0.45)',
                    zIndex: 9999,
                },
                spotlight: {
                    borderRadius: '24px',
                },
            }}
        />
    );
};

export default UserTour;
