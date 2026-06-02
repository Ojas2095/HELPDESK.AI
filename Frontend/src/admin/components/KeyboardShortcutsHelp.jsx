import { useState, useEffect } from 'react';
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts';

export default function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    if (open) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const sequences = SHORTCUTS.filter((s) => s.combo);
  const globals = SHORTCUTS.filter((s) => !s.combo);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
          <button className="text-gray-500 hover:text-gray-700" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <p className="mb-1 font-medium text-gray-900">Navigation</p>
            <ul className="space-y-1">
              {sequences.map((s) => (
                <li key={s.combo} className="flex items-center justify-between">
                  <span>{s.label}</span>
                  <kbd className="rounded border bg-gray-100 px-2 py-0.5 font-mono text-xs">
                    {s.combo}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 font-medium text-gray-900">Global</p>
            <ul className="space-y-1">
              {globals.map((s) => (
                <li key={s.key} className="flex items-center justify-between">
                  <span>{s.label}</span>
                  <kbd className="rounded border bg-gray-100 px-2 py-0.5 font-mono text-xs">
                    {s.key}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
