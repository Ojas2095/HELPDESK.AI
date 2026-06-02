/**
 * Keyboard Shortcuts Hook
 * Provides global keyboard shortcuts for rapid navigation.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createRoleAwareShortcuts,
  getShortcutDescription,
  getShortcutAction,
  isShortcutTypingTarget,
  SHORTCUTS_LEGEND,
  SHORTCUT_GROUPS,
  SHORTCUT_LIST,
} from './keyboard_shortcuts_config';

const SEQUENCE_TIMEOUT_MS = 1000;
const SEARCH_SELECTOR = [
  '[data-shortcut-search]',
  'input[type="search"]',
  'input[placeholder*="Search" i]',
  'input[aria-label*="Search" i]',
].join(',');

const focusSearchField = () => {
  const searchInput = document.querySelector(SEARCH_SELECTOR);
  if (searchInput && typeof searchInput.focus === 'function') {
    searchInput.focus();
    return true;
  }
  return false;
};

const closeOpenModal = () => {
  const closeButton = document.querySelector(
    '[data-modal-close], [aria-label="Close shortcuts help"], [aria-label="Close keyboard shortcuts"], [aria-label="Close shortcuts legend"]'
  );

  if (closeButton && typeof closeButton.click === 'function') {
    closeButton.click();
    return true;
  }

  return false;
};

/**
 * Hook to register keyboard shortcuts.
 *
 * @param {Object} customShortcuts - Additional shortcuts to merge with defaults.
 * @param {Object} options - Configuration options.
 * @param {boolean|string|Object} options.role - Current role; admin receives admin routes.
 * @param {boolean} options.enabled - Whether shortcuts are enabled.
 * @param {Function} options.onSearch - Callback for search shortcut.
 * @param {Function} options.onShortcutsHelp - Callback for shortcuts help.
 */
export const useKeyboardShortcuts = (customShortcuts = {}, options = {}) => {
  const normalizedOptions = customShortcuts?.isAdmin
    ? { ...options, role: 'admin' }
    : options;
  const normalizedCustomShortcuts = customShortcuts?.isAdmin ? {} : customShortcuts;

  const {
    enabled = true,
    role = 'user',
    onSearch = null,
    onShortcutsHelp = null,
  } = normalizedOptions;

  const navigate = useNavigate();
  const [pendingKey, setPendingKey] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const timeoutRef = useRef(null);
  const pendingKeyRef = useRef(null);
  const customShortcutsKey = JSON.stringify(normalizedCustomShortcuts || {});

  const shortcuts = useMemo(
    () => ({
      ...createRoleAwareShortcuts(role),
      ...(normalizedCustomShortcuts || {}),
    }),
    [role, customShortcutsKey]
  );

  const clearPendingKey = () => {
    pendingKeyRef.current = null;
    setPendingKey(null);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (!enabled) return undefined;

    const handleAction = (action) => {
      if (!action) return;

      if (action === 'search') {
        if (onSearch) {
          onSearch();
        } else {
          focusSearchField();
        }
        return;
      }

      if (action === 'shortcuts-help') {
        if (onShortcutsHelp) {
          onShortcutsHelp();
        } else {
          setShowHelp(true);
        }
        return;
      }

      if (action === 'close-modal') {
        setShowHelp(false);
        closeOpenModal();
        return;
      }

      navigate(action);
    };

    const handleKeyDown = (event) => {
      if (isShortcutTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const isCtrl = event.ctrlKey || event.metaKey;
      const isAlt = event.altKey;
      const isShift = event.shiftKey;

      if (key === 'escape') {
        event.preventDefault();
        handleAction(shortcuts.escape);
        clearPendingKey();
        return;
      }

      if (isCtrl && key === 'f') {
        event.preventDefault();
        handleAction(getShortcutAction(shortcuts, ['ctrl', 'f']));
        clearPendingKey();
        return;
      }

      if (isCtrl && key === 'k') {
        event.preventDefault();
        handleAction(getShortcutAction(shortcuts, ['ctrl', 'k']));
        clearPendingKey();
        return;
      }

      if (isCtrl && key === '/') {
        event.preventDefault();
        handleAction(getShortcutAction(shortcuts, ['ctrl', '/']));
        clearPendingKey();
        return;
      }

      if (!isCtrl && !isAlt && key === '?') {
        event.preventDefault();
        handleAction(getShortcutAction(shortcuts, ['?']));
        clearPendingKey();
        return;
      }

      if (pendingKeyRef.current === 'g') {
        const action = getShortcutAction(shortcuts, ['g', key]);
        if (action) {
          event.preventDefault();
          handleAction(action);
        }
        clearPendingKey();
        return;
      }

      if (!isCtrl && !isAlt && !isShift && key === 'g') {
        event.preventDefault();
        pendingKeyRef.current = 'g';
        setPendingKey('g');
        timeoutRef.current = setTimeout(clearPendingKey, SEQUENCE_TIMEOUT_MS);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearPendingKey();
    };
  }, [enabled, navigate, onSearch, onShortcutsHelp, shortcuts]);

  return {
    shortcuts,
    pendingKey,
    showHelp,
    setShowHelp,
  };
};

/**
 * Get shortcut display string.
 * @param {string} shortcut - Shortcut key combination.
 * @returns {string} - Formatted string for display.
 */
export const formatShortcut = (shortcut) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  return shortcut
    .split('+')
    .map((key) => {
      switch (key.toLowerCase()) {
        case 'ctrl':
          return isMac ? '⌘' : 'Ctrl';
        case 'shift':
          return isMac ? '⇧' : 'Shift';
        case 'alt':
          return isMac ? '⌥' : 'Alt';
        case 'g':
          return 'G';
        default:
          return key.toUpperCase();
      }
    })
    .join(isMac ? '' : '+');
};

export {
  getShortcutDescription,
  SHORTCUTS_LEGEND,
  SHORTCUT_GROUPS,
  SHORTCUT_LIST,
  createRoleAwareShortcuts,
  getShortcutAction,
  isShortcutTypingTarget,
};

export default useKeyboardShortcuts;
