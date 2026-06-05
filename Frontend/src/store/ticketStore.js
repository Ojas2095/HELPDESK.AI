import { create } from 'zustand';
import { createPersistedStore } from './persistenceMiddleware';
import {
    removeTicketFromQueue,
    updateTicketInQueue,
    upsertTicketInQueue,
} from './ticketStoreUtils';

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

            addTicket: (ticket) => set((state) => ({
                tickets: upsertTicketInQueue(state.tickets, ticket)
            })),

            upsertTicket: (ticket) => set((state) => ({
                tickets: upsertTicketInQueue(state.tickets, ticket)
            })),

            updateTicket: (ticketId, updates) => set((state) => ({
                tickets: updateTicketInQueue(state.tickets, ticketId, updates)
            })),

            removeTicket: (ticketId) => set((state) => ({
                tickets: removeTicketFromQueue(state.tickets, ticketId)
            })),

            updateTicketLocally: (ticketId, updates) => set((state) => ({
                tickets: updateTicketInQueue(state.tickets, ticketId, updates)
            })),

            appendMessage: (ticketId, message) => set((state) => ({
                tickets: updateTicketInQueue(
                    state.tickets,
                    ticketId,
                    {
                        messages: [
                            ...(
                                state.tickets.find((ticket) => (
                                    ticket.id === ticketId || ticket.ticket_id === ticketId
                                ))?.messages || []
                            ),
                            message,
                        ],
                    },
                )
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
