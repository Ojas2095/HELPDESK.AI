import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const SEQUENCE_TIMEOUT = 800;

export default function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const location = useLocation();
  const pendingKeyRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    const resetSequence = () => {
      pendingKeyRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const beginSequence = (key) => {
      pendingKeyRef.current = key;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(resetSequence, SEQUENCE_TIMEOUT);
    };

    const isTypingTarget = (target) => {
      if (!target) return false;
      const tagName = target.tagName?.toLowerCase();
      return (
        target.isContentEditable ||
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select'
      );
    };

    const focusSearch = () => {
      const searchElement =
        document.querySelector('[data-global-search]') ||
        document.querySelector('input[type="search"]') ||
        document.querySelector('input[name="search"]') ||
        document.querySelector('input[placeholder*="Search"]');

      if (searchElement) {
        searchElement.focus();
        if (typeof searchElement.select === 'function') {
          searchElement.select();
        }
      }
    };

    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase();
      const typing = isTypingTarget(event.target);

      if ((event.ctrlKey || event.metaKey) && key === 'f') {
        event.preventDefault();
        focusSearch();
        resetSequence();
        return;
      }

      if (!typing && event.shiftKey && event.key === '?') {
        event.preventDefault();
        if (location.pathname !== '/help') {
          navigate('/help');
        }
        resetSequence();
        return;
      }

      if (typing || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }

      if (pendingKeyRef.current === 'g') {
        if (key === 'd') {
          event.preventDefault();
          navigate('/dashboard');
        } else if (key === 't') {
          event.preventDefault();
          navigate('/tickets');
        }
        resetSequence();
        return;
      }

      if (key === 'g') {
        beginSequence('g');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      resetSequence();
    };
  }, [location.pathname, navigate]);
}
