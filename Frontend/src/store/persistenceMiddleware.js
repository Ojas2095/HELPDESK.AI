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
        let serialized = '';
        try {
            serialized = JSON.stringify(value);
            localStorage.setItem(name, serialized);
        } catch (error) {
            if (error.name === 'QuotaExceededError' || error.code === 22 || error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
                console.warn(`[Sync] Storage quota exceeded for ${name}. Attempting cleanup...`);
                recoverStorageQuota();
                // Retry once
                try {
                    localStorage.setItem(name, serialized);
                } catch (retryError) {
                    console.error(`[Sync] Failed to save ${name} even after cleanup:`, retryError);
                }
            } else {
                console.error(`[Sync] Failed to save ${name}:`, error);
            }
        }
    },
    removeItem: (name) => {
        try {
            localStorage.removeItem(name);
        } catch (e) {
            console.error(`[Sync] Remove failed for ${name}:`, e);
        }
    }
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
    try {
        localStorage.setItem(`${STORAGE_PREFIX}sync-trigger`, Date.now().toString());
    } catch (e) {
        console.error("[Sync] Broadcast failed:", e);
    }
};

/**
 * Clear all project-related storage.
 */
export const clearGlobalState = () => {
    try {
        Object.keys(localStorage)
            .filter(key => key.startsWith(STORAGE_PREFIX) || key.startsWith('helpdesk-'))
            .forEach(key => localStorage.removeItem(key));
    } catch (e) {
        console.error("[Sync] Clear state failed:", e);
    }
    window.location.reload();
};

