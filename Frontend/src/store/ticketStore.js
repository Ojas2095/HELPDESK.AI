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

            addTicket: (ticket) => set((state) => {
                if (state.tickets.some(t => t.id === ticket.id)) return state;
                return { tickets: [...state.tickets, ticket] };
            }),

            updateTicket: (ticketId, updates) => set((state) => ({
                tickets: state.tickets.map(t => t.id === ticketId ? { ...t, ...updates } : t)
            })),

            removeTicket: (ticketId) => set((state) => ({
                tickets: state.tickets.filter(t => t.id !== ticketId)
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

// Listen for storage changes from other tabs to keep the queue in sync
window.addEventListener('storage', () => {
  // Force rehydration on any storage change to catch updates reliably
  useTicketStore.persist.rehydrate();
});

export default useTicketStore;
