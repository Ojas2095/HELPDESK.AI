/**
 * Centralized Store Sync Middleware for Zustand.
 * Provides a unified point of entry for all LocalStorage operations,
 * quota management, and cross-tab state synchronization.
 */

import { persist, createJSONStorage } from 'zustand/middleware';

const STORAGE_PREFIX = 'helpdesk-v2-';

/**
 * Custom storage adapter with centralized error handling and quota recovery.
 */
const safeLocalStorage = {
    getItem: (name) => {
        try {
            const str = localStorage.getItem(name);
            if (!str) return null;
            return JSON.parse(str);
        } catch (e) {
            console.error(`[Sync] Read failed for ${name}:`, e);
            return null;
        }
    },
    setItem: (name, value) => {
        try {
            localStorage.setItem(name, JSON.stringify(value));
        } catch (e) {
            if (e.name === 'QuotaExceededError') {
                console.warn(`[Sync] Storage quota exceeded. Cleaning up...`);
                recoverStorageQuota();
                // Retry once
                try {
                    localStorage.setItem(name, JSON.stringify(value));
                } catch (retryError) {
                    console.error(`[Sync] Failed after cleanup:`, retryError);
                }
            }
        }
    },
    removeItem: (name) => localStorage.removeItem(name),
};

/**
 * Attempt to free up storage by removing older or non-essential Helpdesk keys.
 */
function recoverStorageQuota() {
    try {
        const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
        // Remove 20% of stored keys to free up block
        const toRemove = keys.slice(0, Math.ceil(keys.length * 0.2));
        toRemove.forEach(k => localStorage.removeItem(k));
    } catch (e) {
        console.error("[Sync] Recovery failed:", e);
    }
}

/**
 * Centralized persisted store creator.
 * 
 * @param {string} storeName - Unique identifier for the store
 * @param {Function} creator - Zustand state creator
 * @param {Object} options - Configuration (partialize, version, etc)
 */
export const createPersistedStore = (storeName, creator, options = {}) => {
    const { 
        partialize, 
        version = 1,
        onRehydrate
    } = options;

    return persist(creator, {
        name: `${STORAGE_PREFIX}${storeName}`,
        storage: createJSONStorage(() => safeLocalStorage),
        version,
        partialize,
        onRehydrateStorage: (state) => {
            return (rehydratedState, error) => {
                if (error) {
                    console.error(`[Sync] Rehydration error for ${storeName}:`, error);
                } else if (onRehydrate) {
                    onRehydrate(rehydratedState);
                }
            };
        }
    });
};

/**
 * Force sync all stores across tabs by triggering a storage event.
 */
export const broadcastStoreSync = () => {
    localStorage.setItem(`${STORAGE_PREFIX}sync-trigger`, Date.now().toString());
};

/**
 * Clear all project-related storage.
 */
export const clearGlobalState = () => {
    Object.keys(localStorage)
        .filter(key => key.startsWith(STORAGE_PREFIX) || key.startsWith('helpdesk-'))
        .forEach(key => localStorage.removeItem(key));
    window.location.reload();
};
