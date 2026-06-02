import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Keyboard shortcuts configuration for admin dashboard navigation.
 * Format: { keys: string[], action: Function, description: string }
 * 
 * Sequences like 'g + d' require pressing g first, then d within 800ms.
 * Modifiers like 'ctrl+k' require holding ctrl and pressing k simultaneously.
 */
const SHORTCUTS = [
    // Navigation sequences (g + key)
    { keys: ['g', 'd'], path: '/admin', description: 'Go to Dashboard' },
    { keys: ['g', 't'], path: '/admin/tickets', description: 'Go to Tickets' },
    { keys: ['g', 'a'], path: '/admin/analytics', description: 'Go to Analytics' },
    { keys: ['g', 's'], path: '/admin/settings', description: 'Go to Settings' },
    { keys: ['g', 'u'], path: '/admin/users', description: 'Go to Users' },
    { keys: ['g', 'k'], path: '/admin/knowledge', description: 'Go to Knowledge Base' },

    // Modifier shortcuts
    { keys: ['ctrl', 'k'], action: 'search', description: 'Focus Search' },
    { keys: ['ctrl', '/'], action: 'help', description: 'Show Shortcuts Help' },
    { keys: ['Escape'], action: 'close', description: 'Close Modal/Panel' },
];

/**
 * Custom hook for keyboard shortcuts in admin dashboard.
 * 
 * Supports two types of shortcuts:
 * 1. Sequence shortcuts (e.g., 'g' then 'd') - for navigation
 * 2. Modifier shortcuts (e.g., 'ctrl+k') - for actions
 * 
 * @param {Object} options
 * @param {boolean} options.enabled - Whether shortcuts are active (default: true)
 * @param {Function} options.onSearch - Callback when search shortcut fires
 * @param {Function} options.onHelp - Callback when help shortcut fires
 * @param {Function} options.onClose - Callback when close shortcut fires
 */
const useKeyboardShortcuts = ({ enabled = true, onSearch, onHelp, onClose } = {}) => {
    const navigate = useNavigate();

    const handleKeyDown = useCallback((e) => {
        if (!enabled) return;

        // Ignore shortcuts when user is typing in an input/textarea
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
            // Allow Escape even in inputs
            if (e.key !== 'Escape') return;
        }

        // Modifier shortcuts (ctrl+key)
        if (e.ctrlKey || e.metaKey) {
            if (e.key === 'k') {
                e.preventDefault();
                onSearch?.();
                return;
            }
            if (e.key === '/') {
                e.preventDefault();
                onHelp?.();
                return;
            }
        }

        // Escape
        if (e.key === 'Escape') {
            onClose?.();
            return;
        }
    }, [enabled, navigate, onSearch, onHelp, onClose]);

    // Sequence tracking for 'g + key' shortcuts
    useEffect(() => {
        if (!enabled) return;

        let lastKeyTime = 0;
        let lastKey = '';
        const SEQUENCE_TIMEOUT = 800; // ms

        const handleSequence = (e) => {
            const tag = e.target.tagName.toLowerCase();
            if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

            const now = Date.now();
            const key = e.key.toLowerCase();

            // Check for sequence (g + key)
            if (lastKey === 'g' && (now - lastKeyTime) < SEQUENCE_TIMEOUT) {
                const shortcut = SHORTCUTS.find(s =>
                    s.keys.length === 2 && s.keys[0] === 'g' && s.keys[1] === key
                );

                if (shortcut?.path) {
                    e.preventDefault();
                    navigate(shortcut.path);
                    lastKey = '';
                    return;
                }
            }

            lastKey = key;
            lastKeyTime = now;
        };

        window.addEventListener('keydown', handleSequence);
        return () => window.removeEventListener('keydown', handleSequence);
    }, [enabled, navigate]);

    // Modifier shortcuts
    useEffect(() => {
        if (!enabled) return;
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, handleKeyDown]);

    return { SHORTCUTS };
};

export default useKeyboardShortcuts;
export { SHORTCUTS };
