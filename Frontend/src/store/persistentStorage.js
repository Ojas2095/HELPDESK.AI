import { createJSONStorage } from 'zustand/middleware';

// In-memory fallback cache when localStorage is unavailable (e.g. private mode, quota limits)
const inMemoryCache = {};

export const robustLocalStorage = {
    getItem: (name) => {
        try {
            return localStorage.getItem(name);
        } catch (error) {
            console.warn(`[PersistentStorage Read Error] Failed to read key "${name}" from localStorage. Falling back to memory.`, error);
            return inMemoryCache[name] || null;
        }
    },
    setItem: (name, value) => {
        try {
            localStorage.setItem(name, value);
        } catch (error) {
            console.error(`[PersistentStorage Write Error] Failed to write key "${name}" to localStorage. Falling back to memory.`, error);
            inMemoryCache[name] = value;
            
            // Dispatch custom event to notify components or loggers about storage failure (e.g. QuotaExceededError)
            const isQuotaExceeded = error.name === 'QuotaExceededError' || error.code === 22;
            window.dispatchEvent(new CustomEvent('persistent-storage-error', {
                detail: { name, error, isQuotaExceeded }
            }));
        }
    },
    removeItem: (name) => {
        try {
            localStorage.removeItem(name);
            delete inMemoryCache[name];
        } catch (error) {
            console.warn(`[PersistentStorage Remove Error] Failed to remove key "${name}" from localStorage.`, error);
            delete inMemoryCache[name];
        }
    }
};

export const safePersistStorage = createJSONStorage(() => robustLocalStorage);
