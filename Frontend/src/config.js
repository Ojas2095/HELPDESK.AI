/**
 * Global Configuration for the AI Helpdesk
 */

const getBackendUrl = () => {
    const envUrl = import.meta.env.VITE_BACKEND_URL;
    if (envUrl) return envUrl.trim().replace(/\/$/, '');

    console.warn("VITE_BACKEND_URL is not set in the environment. Falling back to default URLs.");
    
    // Use production URL if in prod build, otherwise local dev server
    return import.meta.env.PROD 
        ? 'https://ritesh19180-ai-helpdesk-api.hf.space'
        : 'http://localhost:8000';
};

export const API_CONFIG = {
    BACKEND_URL: getBackendUrl(),
    FRONTEND_URL: window.location.origin,
    IS_PROD: import.meta.env.PROD
};
