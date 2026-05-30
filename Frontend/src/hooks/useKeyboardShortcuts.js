import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * useKeyboardShortcuts — Registers global keyboard shortcut listeners
 * for rapid admin dashboard navigation.
 *
 * Shortcut map:
 *   G then D  → /admin/dashboard
 *   G then T  → /admin/tickets
 *   G then U  → /admin/users
 *   G then A  → /admin/analytics
 *   G then S  → /admin/settings
 *   G then P  → /admin/profile
 *   G then L  → /admin/sla
 *   ?        → toggle shortcuts help overlay
 */
const DEFAULT_SHORTCUTS = {
    'd': '/admin/dashboard',
    't': '/admin/tickets',
    'u': '/admin/users',
    'a': '/admin/analytics',
    's': '/admin/settings',
    'p': '/admin/profile',
    'l': '/admin/sla',
};

const useKeyboardShortcuts = ({ enabled = true, onHelpToggle } = {}) => {
    const navigate = useNavigate();

    const handleKeyDown = useCallback((e) => {
        if (!enabled) return;

        // Ignore typing in input/textarea/select elements
        const tag = e.target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
            return;
        }

        // '?' toggles the help overlay
        if (e.key === '?' && !e.shiftKey === false) {
            // Shift+/ = ?
            e.preventDefault();
            if (onHelpToggle) onHelpToggle();
            return;
        }

        // G-prefix shortcuts: G then [key] within 1 second
        if (e.key === 'g' || e.key === 'G') {
            window.__gKeyPressed = Date.now();
            return;
        }

        // If G was pressed within the last second, check for a matching route key
        if (window.__gKeyPressed && (Date.now() - window.__gKeyPressed) < 1000) {
            const key = e.key.toLowerCase();
            const path = DEFAULT_SHORTCUTS[key];
            if (path) {
                e.preventDefault();
                window.__gKeyPressed = null;
                navigate(path);
                return;
            }
        }
    }, [enabled, navigate, onHelpToggle]);

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.__gKeyPressed = null;
        };
    }, [enabled, handleKeyDown]);
};

export default useKeyboardShortcuts;
