import { create } from 'zustand';
import { createPersistedStore } from './persistenceMiddleware';

const useTicketStore = create(
    createPersistedStore(
        'tickets',
        (set, get) => ({
            aiTicket: null,
            activeTicket: null,
            autoResolvedTickets: [], // For analytics
            tickets: [], // Global queue for admins
            notifications: [], // User notifications
            wsConnected: false, // WebSocket connection status

            setAITicket: (data) => set({ aiTicket: data }),
            setActiveTicket: (ticket) => set({ activeTicket: ticket }),

            setWsConnected: (connected) => set({ wsConnected: connected }),

            addNotification: (notif) => set((state) => ({
                notifications: [notif, ...state.notifications].slice(0, 50)
            })),

            clearNotifications: () => set({ notifications: [] }),

            updateTicketLocally: (ticketId, updates) => set((state) => ({
                tickets: state.tickets.map(t => t.id === ticketId ? { ...t, ...updates } : t)
            })),

            reset: () => set({
                aiTicket: null,
                activeTicket: null,
                notifications: [],
                wsConnected: false
            })
        }),
        {
            partialize: (state) => ({
                notifications: state.notifications
            })
        }
    )
);

export default useTicketStore;
