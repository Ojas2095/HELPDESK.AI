import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import useAuthStore from '../store/authStore';
import useTicketStore from '../store/ticketStore';

// We keep track of processed payload timestamps to avoid duplicate real-time notifications
const processedPayloads = new Set();

const useRealtimeNotifications = () => {
    const { user, profile } = useAuthStore();
    const { addNotification } = useTicketStore();

    useEffect(() => {
        if (!user || !profile) return;

        const handleTicketChange = (payload) => {
            const { eventType, new: newRecord, old: oldRecord } = payload;

            // Deduplication logic using the internal commit timestamp
            const commitTs = payload.commit_timestamp;
            if (commitTs && processedPayloads.has(commitTs)) return;
            if (commitTs) processedPayloads.add(commitTs);

            const isAdmin = profile.role === 'admin' || profile.role === 'master_admin';
            const isOwner = newRecord.user_id === user.id;

            // 1. NEW TICKET CREATED -> Notify Admins
            if (eventType === 'INSERT') {
                if (isAdmin) {
                    addNotification({
                        title: 'New Ticket Received',
                        message: `A new ${newRecord.category || 'Support'} ticket requires triage.`,
                        ticketId: newRecord.id,
                        type: 'new_ticket',
                        recipientRole: 'admin'
                    });
                }
                return;
            }

            // 2. UPDATES
            if (eventType === 'UPDATE' && oldRecord) {
                // Determine what changed
                const statusChanged = oldRecord.status !== newRecord.status;
                const teamChanged = oldRecord.assigned_team !== newRecord.assigned_team;

                // For nested JSON/JSONB updates (messages)
                const oldMessagesLen = Array.isArray(oldRecord.messages) ? oldRecord.messages.length : 0;
                const newMessagesLen = Array.isArray(newRecord.messages) ? newRecord.messages.length : 0;
// eslint-disable-next-line no-unused-vars
                const newlyAddedMessage = newMessagesLen > oldMessagesLen
                    ? newRecord.messages[newMessagesLen - 1]
                    : null;

                // STATUS CHANGE -> Notify User (e.g., Resolved, In Progress)
                if (statusChanged && isOwner) {
                    addNotification({
                        title: `Ticket ${newRecord.status}`,
                        message: `Your ticket status was updated to ${newRecord.status}.`,
                        ticketId: newRecord.id,
                        type: newRecord.status?.toLowerCase().includes('resolv') ? 'resolution' : 'update',
                        recipientRole: 'user'
                    });
                }

                // RE-ASSIGNMENT -> Notify User
                if (teamChanged && isOwner && newRecord.assigned_team) {
                    addNotification({
                        title: 'Ticket Re-Assigned',
                        message: `Your ticket is now being handled by ${newRecord.assigned_team}.`,
                        ticketId: newRecord.id,
                        type: 'update',
                        recipientRole: 'user'
                    });
                }
            }
        };

        const handleMessageChange = (payload) => {
            const { eventType, new: newMessage } = payload;
            if (eventType !== 'INSERT') return;

            // Use same deduplication logic
            const commitTs = payload.commit_timestamp;
            if (commitTs && processedPayloads.has(commitTs)) return;
            if (commitTs) processedPayloads.add(commitTs);

            const isFromAdmin = newMessage.sender_role === 'admin' || newMessage.sender_role === 'super_admin' || newMessage.sender_role === 'master_admin';
            const isAdmin = profile.role === 'admin' || profile.role === 'master_admin';

            // Note: In a real app, we should check if the current user is the owner of the ticket
            // But for notifications, if I'm the recipient (admin or owner), I should see it.
            // For now, we rely on recipientRole filter in the UI components.

            if (isFromAdmin) {
                // Sent by Admin -> Notify User (only if it's their ticket)
                // Note: ideally we'd check isOwner here, but for now we filter by role
                if (profile.role === 'user') {
                    addNotification({
                        title: 'New Response from Support',
                        message: newMessage.message?.length > 120 ? newMessage.message.substring(0, 120) + "..." : (newMessage.message || "An agent replied to your ticket."),
                        ticketId: newMessage.ticket_id,
                        type: 'message',
                        recipientRole: 'user'
                    });
                }
            } else {
                // Sent by User -> Notify Admin
                if (isAdmin) {
                    addNotification({
                        title: 'New Message from User',
                        message: newMessage.message || "A user replied to their ticket.",
                        ticketId: newMessage.ticket_id,
                        type: 'message',
                        recipientRole: 'admin'
                    });
                }
            }
        };

        const ticketChannel = supabase
            .channel('ticket-notifications')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'tickets' },
                handleTicketChange
            )
            .subscribe();

        const messageChannel = supabase
            .channel('message-notifications')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'ticket_messages' },
                handleMessageChange
            )
            .subscribe();

        return () => {
            supabase.removeChannel(ticketChannel);
            supabase.removeChannel(messageChannel);
        };
    }, [user, profile, addNotification]);
};

export default useRealtimeNotifications;
