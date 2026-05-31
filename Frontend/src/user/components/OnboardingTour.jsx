import React, { useState, useEffect } from 'react';
import Joyride, { STATUS } from 'react-joyride';

const OnboardingTour = () => {
    const [run, setRun] = useState(false);

    useEffect(() => {
        const isComplete = localStorage.getItem('emerald_onboarding_complete');
        if (!isComplete) {
            const timer = setTimeout(() => {
                setRun(true);
            }, 1500); // Slightly longer delay for high-fidelity assets to settle
            return () => clearTimeout(timer);
        }
    }, []);

    const steps = [
        {
            target: '#tour-welcome',
            content: 'Welcome to the HelpDesk.ai ecosystem. Our autonomous heuristics resolve most tickets instantly.',
            placement: 'bottom',
            disableBeacon: true,
        },
        {
            target: '#tour-create-ticket',
            content: 'Initiate a new diagnostic session. The neural engine will map and route your issue immediately.',
            placement: 'bottom',
        },
        {
            target: '#tour-quick-actions',
            content: 'Use these telemetry shortcuts for recurring infrastructure or software exceptions.',
            placement: 'top',
        },
        {
            target: '#tour-recent-tickets',
            content: 'Monitor real-time status updates and communication nodes for your active requests.',
            placement: 'top',
        },
    ];

    const handleJoyrideCallback = (data) => {
        const { status } = data;
        const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

        if (finishedStatuses.includes(status)) {
            setRun(false);
            localStorage.setItem('emerald_onboarding_complete', 'true');
        }
    };

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous={true}
            showSkipButton={true}
            disableScrolling={false}
            callback={handleJoyrideCallback}
            // Customizing the overlay and beacon to match dark mode
            styles={{
                options: {
                    arrowColor: '#111927', // Deep slate card color
                    backgroundColor: '#111927', 
                    overlayColor: 'rgba(5, 5, 8, 0.8)', // Main background blur color
                    primaryColor: '#10b981', // Emerald-500
                    textColor: '#f8fafc', // Slate-50
                    zIndex: 1000,
                    beaconSize: 36,
                },
                tooltip: {
                    borderRadius: '2rem',
                    padding: '1.5rem',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                },
                tooltipContainer: {
                    textAlign: 'left',
                    fontFamily: 'Syne, sans-serif',
                },
                tooltipContent: {
                    padding: '1rem 0',
                    fontSize: '14px',
                    fontWeight: 500,
                    lineHeight: 1.6,
                    color: '#94a3b8', // Slate-400
                },
                buttonNext: {
                    borderRadius: '0.75rem',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    fontSize: '10px',
                    letterSpacing: '0.2em',
                    backgroundColor: '#10b981',
                    padding: '12px 24px',
                    marginLeft: '10px',
                },
                buttonBack: {
                    fontWeight: 800,
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    color: '#64748b', // Slate-500
                    marginRight: '10px',
                },
                buttonSkip: {
                    fontWeight: 800,
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    color: '#475569', // Slate-600
                }
            }}
        />
    );
};

export default OnboardingTour;