*/
export function useKeyboardShortcuts(): UseKeyboardShortcutsReturn {
  const navigate = useNavigate();
  const [isHelpVisible, setIsHelpVisible] = useState(false);
  
  // Use refs for performance optimization to avoid re-renders
  const stateRef = useRef<ShortcutState>({
    buffer: [],
    lastKeyTime: 0,
    isHelpVisible: false,
  });

  // Memoized navigation action creator
  const createNavigationAction = useCallback((path: string, name: string): (() => void) => {
    return () => {
      try {
        if (!path || typeof path !== 'string') {
          throw new Error(`Invalid navigation path: ${path}`);
        }
        navigate(path);
        logger.info(`Navigated to ${name}`, { path });
      } catch (error) {
        logger.error(`Failed to navigate to ${name}`, error as Error);
      }
    };
  }, [navigate]);

  // Memoized shortcut configurations
  const shortcuts: ShortcutConfig[] = [
    // Navigation shortcuts
    {
      keys: ['g', 'd'],
      description: 'Go to Dashboard',
      category: 'navigation',
      action: createNavigationAction('/dashboard', 'Dashboard'),
      preventDefault: true,
    },
    {
      keys: ['g', 't'],
      description: 'Go to Tickets',
      category: 'navigation',
      action: createNavigationAction('/tickets', 'Tickets'),
      preventDefault: true,
    },
    {
      keys: ['g', 'u'],
      description: 'Go to Users',
      category: 'navigation',
      action: createNavigationAction('/users', 'Users'),
      preventDefault: true,
    },
    {
      keys: ['g', 's'],
      description: 'Go to Settings',
      category: 'navigation',
      action: createNavigationAction('/settings', 'Settings'),
      preventDefault: true,
    },
    // Action shortcuts
    {
      keys: ['control', 'f'],
      description: 'Search tickets',
      category: 'action',
      action: useCallback(() => {
        try {
          const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
          if (searchInput) {
            searchInput.focus();
            logger.info('Search input focused');
          } else {
            logger.warn('Search input element not found');
          }
        } catch (error) {
          logger.error('Failed to focus search input', error as Error);
        }
      }, []),
      requiresModifier: true,
      preventDefault: true,
    },
    {
      keys: ['?'],
      description: 'Show this help',
      category: 'action',
      action: useCallback(() => {
        try {
          setIsHelpVisible(prev => !prev);
          stateRef.current.isHelpVisible = !stateRef.current.isHelpVisible;
          logger.info('Help modal toggled');
        } catch (error) {
          logger.error('Failed to toggle help modal', error as Error);
        }
      }, []),
      preventDefault: true,
    },
    // General shortcuts
    {
      keys: ['escape'],
      description: 'Close modals / Clear search',
      category: 'general',
      action: useCallback(() => {
        try {
          // Close help modal if open
          if (stateRef.current.isHelpVisible) {
            setIsHelpVisible(false);
            stateRef.current.isHelpVisible = false;
            logger.info('Help modal closed via Escape');
          }
          
          // Clear search input
          const searchInput = document.querySelector<HTMLInputElement>('[data-search-input]');
          if (searchInput && document.activeElement === searchInput) {
            searchInput.value = '';
            searchInput.blur();
            logger.info('Search cleared via Escape');
          }
        } catch (error) {
          logger.error('Failed to handle Escape key', error as Error);
        }
      }, []),
      preventDefault: true,
    },
  ];

  // Validate shortcuts for conflicts
  const validateShortcuts = useCallback((configs: ShortcutConfig[]): void => {
    const keyMap = new Map<string, ShortcutConfig>();
    
    for (const config of configs) {
      const key = config.keys.join('+');
      if (keyMap.has(key)) {
        throw new ShortcutConflictError([key, keyMap.get(key)!.keys.join('+')]);
      }
      keyMap.set(key, config);
    }
  }, []);

  // Validate shortcuts on mount
  useEffect(() => {
    try {
      validateShortcuts(shortcuts);
      logger.info('Shortcuts validated successfully');
    } catch (error) {
      logger.error('Shortcut validation failed', error as Error);
    }
  }, [shortcuts, validateShortcuts]);

  // Process keyboard events
  const processKeyEvent = useCallback((event: KeyboardEvent): void => {
    try {
      // Input validation
      if (!event.key || typeof event.key !== 'string') {
        logger.warn('Invalid keyboard event received');
        return;
      }

      const key = event.key.toLowerCase();
      const state = stateRef.current;

      // Handle modifier keys
      if (MODIFIER_KEYS.has(key)) {
        return;
      }

      // Check for modifier-based shortcuts
      if (event.ctrlKey || event.metaKey) {
        const modifierShortcut = shortcuts.find(
          s => s.requiresModifier && 
          s.keys[0] === 'control' && 
          s.keys[1] === key
        );

        if (modifierShortcut) {
          if (modifierShortcut.preventDefault) {
            event.preventDefault();
          }
          modifierShortcut.action();
          state.buffer = [];
          return;
        }
      }

      // Handle single key shortcuts
      if (SINGLE_KEY_SHORTCUTS.has(key)) {
        const singleShortcut = shortcuts.find(s => s.keys[0] === key);
        if (singleShortcut) {
          if (singleShortcut.preventDefault) {
            event.preventDefault();
          }
          singleShortcut.action();
          state.buffer = [];
          return;
        }
      }

      // Handle sequence shortcuts (e.g., G + D)
      const now = Date.now();
      
      // Reset buffer if timeout exceeded
      if (now - state.lastKeyTime > BUFFER_TIMEOUT) {
        state.buffer = [];
      }

      state.buffer.push(key);
      state.lastKeyTime = now;

      // Limit buffer size
      if (state.buffer.length > MAX_BUFFER_SIZE) {
        state.buffer.shift();
      }

      // Check for matching sequence shortcuts
      const bufferStr = state.buffer.join(' ');
      const matchingShortcut = shortcuts.find(s => 
        !s.requiresModifier && 
        s.keys.length > 1 && 
        s.keys.join(' ') === bufferStr
      );

      if (matchingShortcut) {
        if (matchingShortcut.preventDefault) {
          event.preventDefault();
        }
        matchingShortcut.action();
        state.buffer = [];
        logger.info(`Sequence shortcut triggered: ${matchingShortcut.keys.join(' + ')}`);
      }
    } catch (error) {
      logger.error('Error processing keyboard event', error as Error);
    }
  }, [shortcuts]);

  // Register global event listener
  useEffect(() => {
    try {
      document.addEventListener('keydown', processKeyEvent);
      logger.info('Keyboard shortcut listener registered');
      
      return () => {
        document.removeEventListener('keydown', processKeyEvent);
        logger.info('Keyboard shortcut listener removed');
      };
    } catch (error) {
      logger.error('Failed to register keyboard shortcut listener', error as Error);
    }
  }, [processKeyEvent]);

  // Toggle help visibility
  const toggleHelp = useCallback(() => {
    try {
      setIsHelpVisible(prev => !prev);
      stateRef.current.isHelpVisible = !stateRef.current.isHelpVisible;
      logger.info('Help modal toggled via toggleHelp');
    } catch (error) {
      logger.error('Failed to toggle help modal', error as Error);
    }
  }, []);

  return {
    isHelpVisible,
    toggleHelp,
    shortcuts,
  };
}

/**
 * HelpModal component for displaying keyboard shortcuts
 * 
 * @component
 * @param {Object} props - Component props
 * @param {boolean} props.isVisible - Whether the modal is visible
 * @param {ShortcutConfig[]} props.shortcuts - Array of shortcut configurations
 * @param {() => void} props.onClose - Function to close the modal
 * 
 * @example
 *