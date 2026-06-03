import { useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import useAuthStore from '../store/authStore';
import useTicketStore from '../store/ticketStore';

const useTicketsRealtime = () => {
    const { user, profile } = useAuthStore();
    const { addTicket, updateTicket, removeTicket } = useTicketStore();
    const userId = user?.id;
    const userRole = profile?.role;
    const companyId = profile?.company_id;

    useEffect(() => {
        if (!userId || !userRole || !companyId) return;

        // Only admins see the live ticket queue
        const isAdmin = userRole === 'admin' || userRole === 'master_admin';
        if (!isAdmin) return;

        const channel = supabase
            .channel('tickets-realtime-dashboard')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tickets',
                    filter: `company_id=eq.${companyId}`,
                },
                (payload) => {
                    const { eventType, new: newRecord, old: oldRecord } = payload;

                    if (eventType === 'INSERT') {
                        addTicket(newRecord);
                    }

                    if (eventType === 'UPDATE') {
                        updateTicket(newRecord.ticket_id, newRecord);
                    }

                    if (eventType === 'DELETE') {
                        removeTicket(oldRecord.ticket_id);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, userRole, companyId, addTicket, updateTicket, removeTicket]);
};

export default useTicketsRealtime;