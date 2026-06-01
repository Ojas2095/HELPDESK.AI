import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

const ThemeToggle = ({ className = '' }) => {
    const { isDark, toggleTheme } = useTheme();
    const Icon = isDark ? Sun : Moon;

    return (
        <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`theme-toggle inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-200 ${className}`}
        >
            <Icon className="h-4 w-4" />
        </button>
    );
};

export default ThemeToggle;
