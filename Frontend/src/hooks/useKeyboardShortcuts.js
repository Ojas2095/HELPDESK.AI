import { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

const SEQUENCE_SHORTCUTS = [
  { keys: ['g', 'd'], label: 'Go to Dashboard', path: '/admin/dashboard' },
  { keys: ['g', 't'], label: 'Go to Tickets',    path: '/admin/tickets' },
  { keys: ['g', 'u'], label: 'Go to Users',      path: '/admin/users' },
  { keys: ['g', 'a'], label: 'Go to Analytics',  path: '/admin/analytics' },
  { keys: ['g', 's'], label: 'Go to Settings',   path: '/admin/settings' },
];

const GLOBAL_SHORTCUTS = [
  { key: '/', label: 'Focus search' },
  { key: '?', label: 'Toggle shortcuts help' },
];

export const SHORTCUTS = [...SEQUENCE_SHORTCUTS.map((s) => ({ ...s, combo: s.keys.join('+') })), ...GLOBAL_SHORTCUTS];

export default function useKeyboardShortcuts({ onToggleHelp } = {}) {
  const navigate = useNavigate();
  const sequenceRef = useRef([]);
  const timerRef = useRef(null);

  const resetSequence = useCallback(() => {
    sequenceRef.current = [];
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const editable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable;

      // Global shortcuts
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === '?' && !editable) {
          e.preventDefault();
          onToggleHelp?.();
          return;
        }
        if (e.key === '/' && !editable) {
          e.preventDefault();
          const searchInput = document.querySelector('input[type="search"], input[placeholder*="Search" i], input[aria-label*="search" i]');
          searchInput?.focus();
          return;
        }
      }

      // Two-key sequences (e.g. g then d)
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !editable) {
        if (sequenceRef.current.length === 0) {
          const first = e.key.toLowerCase();
          if (SEQUENCE_SHORTCUTS.some((s) => s.keys[0] === first)) {
            sequenceRef.current = [first];
            timerRef.current = setTimeout(resetSequence, 1500);
            return;
          }
        } else if (sequenceRef.current.length === 1) {
          const combo = [sequenceRef.current[0], e.key.toLowerCase()];
          const match = SEQUENCE_SHORTCUTS.find((s) => s.keys[0] === combo[0] && s.keys[1] === combo[1]);
          if (match) {
            e.preventDefault();
            navigate(match.path);
            resetSequence();
            return;
          }
        }
        resetSequence();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, onToggleHelp, resetSequence]);
}
