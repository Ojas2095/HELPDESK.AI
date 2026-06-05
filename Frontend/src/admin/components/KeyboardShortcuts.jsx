import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Keyboard, X } from 'lucide-react';

const KeyboardShortcuts = () => {
    const navigate = useNavigate();
    const [showHelpModal, setShowHelpModal] = useState(false);
    const lastKeyRef = useRef({ key: '', time: 0 });

    useEffect(() => {
        const handleKeyDown = (e) => {
            // Safely check active element
            const activeElement = document.activeElement;
            const activeTag = activeElement ? activeElement.tagName.toLowerCase() : '';
            const isInput = activeTag === 'input' || activeTag === 'textarea' || (activeElement && activeElement.isContentEditable);
            
            if (isInput) {
                // Allow Escape to blur inputs
                if (e.key === 'Escape') {
                    if (activeElement) activeElement.blur();
                    window.dispatchEvent(new Event('close-modals'));
                }
                return;
            }

            const now = Date.now();
            const currentKey = e.key.toLowerCase();

            // Handle Help Modal toggle (Shift + / -> ?)
            if (e.key === '?') {
                e.preventDefault();
                setShowHelpModal(prev => !prev);
                return;
            }

            // Handle Escape
            if (e.key === 'Escape') {
                setShowHelpModal(false);
                window.dispatchEvent(new Event('close-modals'));
                return;
            }

            // Handle Search focus
            if (e.key === '/') {
                e.preventDefault();
                const searchInput = document.getElementById('admin-search-input');
                if (searchInput) {
                    searchInput.focus();
                }
                return;
            }

            // Handle sequence commands (e.g. G + T)
            // Time window for sequence is 500ms
            const lastKeyPressed = lastKeyRef.current;
            if (lastKeyPressed.key === 'g' && now - lastKeyPressed.time < 500) {
                if (currentKey === 't') {
                    e.preventDefault();
                    navigate('/admin/tickets');
                    lastKeyRef.current = { key: '', time: 0 };
                    return;
                }
                if (currentKey === 'a') {
                    e.preventDefault();
                    navigate('/admin/analytics');
                    lastKeyRef.current = { key: '', time: 0 };
                    return;
                }
                if (currentKey === 's') {
                    e.preventDefault();
                    navigate('/admin/settings');
                    lastKeyRef.current = { key: '', time: 0 };
                    return;
                }
            }

            // Update last key pressed
            if (currentKey === 'g') {
                lastKeyRef.current = { key: 'g', time: now };
            } else {
                // Only reset if it's not a modifier key to avoid breaking sequences if they hold shift
                if (!['shift', 'control', 'alt', 'meta'].includes(currentKey)) {
                    lastKeyRef.current = { key: '', time: 0 };
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [navigate]);

    if (!showHelpModal) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-5 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
                            <Keyboard size={20} />
                        </div>
                        <h2 className="font-bold text-slate-800 text-lg">Keyboard Shortcuts</h2>
                    </div>
                    <button 
                        onClick={() => setShowHelpModal(false)}
                        className="text-slate-400 hover:bg-slate-50 hover:text-slate-600 p-2 rounded-xl transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-5">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600 font-medium text-sm">Go to Tickets</span>
                            <div className="flex items-center gap-1">
                                <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono text-xs font-bold">G</kbd>
                                <span className="text-slate-400 text-xs">+</span>
                                <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono text-xs font-bold">T</kbd>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600 font-medium text-sm">Go to Analytics</span>
                            <div className="flex items-center gap-1">
                                <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono text-xs font-bold">G</kbd>
                                <span className="text-slate-400 text-xs">+</span>
                                <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono text-xs font-bold">A</kbd>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600 font-medium text-sm">Go to Settings</span>
                            <div className="flex items-center gap-1">
                                <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono text-xs font-bold">G</kbd>
                                <span className="text-slate-400 text-xs">+</span>
                                <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono text-xs font-bold">S</kbd>
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600 font-medium text-sm">Focus search</span>
                            <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono text-xs font-bold">/</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600 font-medium text-sm">Close modals/blur</span>
                            <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono text-xs font-bold">Esc</kbd>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-slate-600 font-medium text-sm">Show shortcuts</span>
                            <kbd className="px-2 py-1 bg-slate-100 border border-slate-200 rounded text-slate-600 font-mono text-xs font-bold">?</kbd>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcuts;
