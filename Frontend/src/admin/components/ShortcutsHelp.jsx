import React from 'react';
import { X, Command } from 'lucide-react';

/**
 * ShortcutsHelp — Modal overlay showing available keyboard shortcuts.
 * Toggled by pressing '?' or Ctrl+/.
 */
const ShortcutsHelp = ({ isOpen, onClose, shortcuts }) => {
    if (!isOpen) return null;

    const isMac = typeof navigator !== 'undefined' && navigator.platform?.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? '⌘' : 'Ctrl';

    const items = Object.entries(shortcuts);

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center"
            onClick={onClose}
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className="relative bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-md mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                            <Command size={20} className="text-emerald-600" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">Keyboard Shortcuts</h2>
                            <p className="text-xs text-gray-400 font-medium mt-0.5">
                                Rapid admin navigation
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
                    >
                        <X size={16} className="text-gray-400" />
                    </button>
                </div>

                {/* Shortcuts list */}
                <div className="px-6 py-4 space-y-1">
                    {items.map(([key, label]) => (
                        <div
                            key={key}
                            className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                            <span className="text-sm font-medium text-gray-700">{label}</span>
                            <kbd className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 border border-gray-200 text-xs font-bold text-gray-500 font-mono">
                                <span className="text-[10px] text-gray-400">{modKey}</span>
                                <span>+</span>
                                <span>{key}</span>
                            </kbd>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-50 bg-gray-50/50">
                    <div className="flex items-center justify-between text-[11px] text-gray-400 font-medium">
                        <span>Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-mono text-[10px]">?</kbd> to toggle</span>
                        <span>Press <kbd className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-500 font-mono text-[10px]">Esc</kbd> to close</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShortcutsHelp;
