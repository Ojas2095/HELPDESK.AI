/**
 * useKeyboardShortcuts — Global keyboard shortcut system for the admin dashboard.
 *
 * Supports:
 *  - Single-key shortcuts (e.g. ? → help modal, / → focus search, Escape → close)
 *  - Chord shortcuts (two-key sequences with 1 second timeout, e.g. g+d → /admin/dashboard)
 *  - Skips all shortcuts when focus is inside an input / textarea / select / [contenteditable]
 */

import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const CHORD_TIMEOUT_MS = 1000;

/**
 * Check whether focus is currently inside a text-entry element.
 * Shortcuts must not fire while the user is typing.
 */
function isTypingTarget(element) {
    if (!element) return false;
    const tag = element.tagName?.toLowerCase();
    const editable = element.getAttribute?.('contenteditable') === 'true';
    return (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        editable
    );
}

/**
 * Navigation chord map: first key "g" → second key → route.
 */
const NAV_CHORD_MAP = {
    d: '/admin/dashboard',
    t: '/admin/tickets',
    u: '/admin/users',
    a: '/admin/analytics',
    s: '/admin/scorecard',
    p: '/admin/profile',
};

/**
 * useKeyboardShortcuts
 *
 * @param {object} options
 *   onOpenHelp      — called when "?" is pressed
 *   onCloseModal    — called when Escape is pressed
 *   onFocusSearch   — called when "/" is pressed
 */
export function useKeyboardShortcuts({
    onOpenHelp,
    onCloseModal,
    onFocusSearch,
} = {}) {
    const navigate = useNavigate();
    const pendingChord = useRef(null);        // first key of a chord sequence
    const chordTimer = useRef(null);          // timeout to reset pending chord

    const clearChord = useCallback(() => {
        pendingChord.current = null;
        if (chordTimer.current) {
            clearTimeout(chordTimer.current);
            chordTimer.current = null;
        }
    }, []);

    const handleKeyDown = useCallback(
        (e) => {
            // Never fire shortcuts when the user is typing
            if (isTypingTarget(document.activeElement)) return;

            // Never fire shortcuts when modifier keys are held (except Shift for ?)
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            const key = e.key;

            // --- Chord resolution (second key of a sequence) ---
            if (pendingChord.current) {
                const firstKey = pendingChord.current;
                clearChord();

                if (firstKey === 'g') {
                    const route = NAV_CHORD_MAP[key.toLowerCase()];
                    if (route) {
                        e.preventDefault();
                        navigate(route);
                    }
                }
                return;
            }

            // --- Single-key shortcuts ---
            switch (key) {
                case 'g':
                    // Begin a chord sequence — wait for second key
                    pendingChord.current = 'g';
                    chordTimer.current = setTimeout(clearChord, CHORD_TIMEOUT_MS);
                    break;

                case '?':
                    e.preventDefault();
                    onOpenHelp?.();
                    break;

                case 'Escape':
                    onCloseModal?.();
                    break;

                case '/':
                    e.preventDefault();
                    onFocusSearch?.();
                    break;

                default:
                    break;
            }
        },
        [navigate, onOpenHelp, onCloseModal, onFocusSearch, clearChord]
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            clearChord();
        };
    }, [handleKeyDown, clearChord]);
}

/**
 * SHORTCUT_GROUPS — definition array used to render the help modal.
 */
export const SHORTCUT_GROUPS = [
    {
        group: 'Navigation',
        shortcuts: [
            { keys: ['G', 'D'], description: 'Go to Dashboard' },
            { keys: ['G', 'T'], description: 'Go to Tickets' },
            { keys: ['G', 'U'], description: 'Go to Users' },
            { keys: ['G', 'A'], description: 'Go to Analytics' },
            { keys: ['G', 'S'], description: 'Go to Scorecard' },
            { keys: ['G', 'P'], description: 'Go to Profile' },
        ],
    },
    {
        group: 'UI',
        shortcuts: [
            { keys: ['?'], description: 'Open keyboard shortcuts help' },
            { keys: ['Esc'], description: 'Close modal / sidebar' },
            { keys: ['/'], description: 'Focus search input' },
        ],
    },
];

export default useKeyboardShortcuts;
