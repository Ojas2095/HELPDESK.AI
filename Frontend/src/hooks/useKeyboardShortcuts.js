import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

const useKeyboardShortcuts = () => {
    const navigate = useNavigate();
    const { profile } = useAuthStore();

    useEffect(() => {
        let lastKeyPressed = '';
        let lastKeyTime = 0;

        const handleKeyDown = (e) => {
            // Find active element to see if user is currently typing in an input
            const activeEl = document.activeElement;
            const isInput = activeEl && (
                activeEl.tagName === 'INPUT' ||
                activeEl.tagName === 'TEXTAREA' ||
                activeEl.isContentEditable
            );

            const key = e.key.toLowerCase();

            // 1. Ctrl + F / Cmd + F (Focus search)
            if ((e.ctrlKey || e.metaKey) && key === 'f') {
                const searchInput = document.querySelector(
                    'input[placeholder*="Search" i], input[placeholder*="search" i], #search-input'
                );
                if (searchInput) {
                    e.preventDefault();
                    searchInput.focus();
                    searchInput.select();
                    return;
                }
            }

            // 2. Ignore navigation shortcuts if typing in any input field
            if (isInput) return;

            const now = Date.now();
            const timeDiff = now - lastKeyTime;

            // Sequence: G + Key (Gmail style navigation hotkeys)
            if (lastKeyPressed === 'g' && timeDiff < 1000) {
                if (key === 'd') {
                    e.preventDefault();
                    lastKeyPressed = '';
                    if (profile?.role === 'master_admin') {
                        navigate('/master-admin/dashboard');
                    } else if (profile?.role === 'admin' || profile?.role === 'super_admin') {
                        navigate('/admin/dashboard');
                    } else {
                        navigate('/dashboard');
                    }
                    return;
                }
                if (key === 't') {
                    e.preventDefault();
                    lastKeyPressed = '';
                    if (profile?.role === 'admin' || profile?.role === 'super_admin') {
                        navigate('/admin/tickets');
                    } else if (profile?.role === 'master_admin') {
                        navigate('/master-admin/dashboard');
                    } else {
                        navigate('/my-tickets');
                    }
                    return;
                }
                if (key === 'h') {
                    e.preventDefault();
                    lastKeyPressed = '';
                    navigate('/help');
                    return;
                }
            }

            // Record standard key presses to detect sequences
            if (key === 'g') {
                lastKeyPressed = 'g';
                lastKeyTime = now;
            } else {
                lastKeyPressed = '';
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [navigate, profile]);
};

export default useKeyboardShortcuts;
