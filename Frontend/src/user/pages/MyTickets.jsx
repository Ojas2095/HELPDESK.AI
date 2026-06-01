import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ticket,
  Inbox,
  Search,
  Filter,
  ChevronDown,
  ShieldCheck,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import useAuthStore from "../../store/authStore";
import { supabase } from "../../lib/supabaseClient";
import { Card } from "../../components/ui/card";
import { formatTicketId } from "../../utils/format";
import TicketStatusBadge from "../components/TicketStatusBadge";
import SLABadge from "../../admin/components/SLABadge";
import { formatTimelineDate, getTimeZoneAbbr } from "../../utils/dateUtils";
import LanguageBadge from "../../components/shared/LanguageBadge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "../../components/ui/tooltip";
import { safeDisplayText } from "../../utils/sanitizeText";

function MyTickets() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');

  // Fetch tickets from Supabase
  const fetchTickets = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const { data, error: sbError } = await supabase
      .from('tickets')
      .select('*') // Select all columns
      .eq('user_id', user.id) // Filter by the current user's ID
      .order('created_at', { ascending: false });

    if (sbError) {
      console.error('Error fetching tickets:', sbError);
      setError(sbError.message);
      setTickets([]);
    } else {
      setTickets(data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTickets();

    if (!user?.id) return;

    // Real-time subscription for THIS user's tickets
    const channel = supabase
      .channel(`user_tickets_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('User tickets real-time event:', payload.eventType, payload.new);
          if (payload.eventType === 'INSERT') {
            setTickets((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            setTickets((prev) =>
              prev.map((t) => (t.id === payload.new.id ? { ...t, ...payload.new } : t))
            );
          } else if (payload.eventType === 'DELETE') {
            setTickets((prev) => prev.filter((t) => t.id !== payload.old.id));
          }
        }
      )
      .subscribe();

        setLoading(true);
        setError(null);
        try {
            const { data, error: sbError } = await supabase
                .from('tickets')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (sbError) throw sbError;
            setTickets(data || []);
        } catch (err) {
            console.error("Error fetching tickets:", err);
            setError(err.message);
            setTickets([]);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        fetchTickets();

        if (!user?.id) return;

        const channel = supabase
            .channel(`user_tickets_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tickets',
                    filter: `user_id=eq.${user.id}`
                },
                (payload) => {
                    console.log("User tickets real-time event:", payload.eventType, payload.new);
                    if (payload.eventType === 'INSERT') {
                        setTickets(prev => [payload.new, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        setTickets(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
                    } else if (payload.eventType === 'DELETE') {
                        setTickets(prev => prev.filter(t => t.id !== payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, fetchTickets]);

    const filteredTickets = useMemo(() => {
        return tickets.filter(ticket => {
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch =
                (ticket.subject || '').toLowerCase().includes(searchLower) ||
                (ticket.summary || '').toLowerCase().includes(searchLower) ||
                safeDisplayText(ticket.description).toLowerCase().includes(searchLower) ||
                String(ticket.id).includes(searchLower);

            const ticketStatus = ticket.status || 'open';
            const matchesStatus = statusFilter === 'All' ? true : ticketStatus.toLowerCase() === statusFilter.toLowerCase();

            const ticketPriority = ticket.priority || 'medium';
            const matchesPriority = priorityFilter === 'All' ? true : ticketPriority.toLowerCase() === priorityFilter.toLowerCase();

            return matchesSearch && matchesStatus && matchesPriority;
        });
    }, [tickets, searchQuery, statusFilter, priorityFilter]);

    const getPriorityColor = (priority) => {
        const p = (priority || '').toLowerCase();
        if (p === 'high' || p === 'critical') return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
        if (p === 'medium') return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
        if (p === 'low') return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        return 'text-slate-400 bg-white/5 border-white/10';
    };
  }, [user, fetchTickets]); // Re-subscribe when user changes


    return (
        <div className="min-h-screen bg-slate-950 pb-20 relative overflow-hidden font-sans">
            {/* Background Glow Context */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 flex flex-col gap-8 relative z-10 text-left">
                
                {/* Live region for screen reader announcements */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
                {filteredTickets.length === 0
                    ? 'No tickets match your current filters'
                    : `Showing ${filteredTickets.length} ${filteredTickets.length === 1 ? 'ticket' : 'tickets'}`
                }
            </div>
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 tracking-tight flex items-center gap-3">
                        <Ticket className="text-emerald-600 w-8 h-8" aria-hidden="true" /> My Tickets
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">Manage and track your support requests</p>
                </div>
                <button
                    onClick={() => navigate('/create-ticket')}
                    aria-label="Create a new support ticket"
                    className="px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap"
                >
                    Create New Ticket
                </button>
            </div>

            {/* Toolbar section */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Search tickets by ID or subject..."
                        aria-label="Search tickets by ID or subject"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-gray-900 font-medium"
                    />
                </div>
                <div className="flex items-center gap-3">
                    <Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        aria-label="Filter by status"
                        options={[
                            { value: 'All', label: 'All Statuses' },
                            { value: 'Resolved', label: 'Resolved' },
                            { value: 'Pending', label: 'Pending' },
                            { value: 'In Progress', label: 'In Progress' },
                            { value: 'Escalated', label: 'Escalated' }
                        ]}
                    />
                    <Select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        aria-label="Filter by priority"
                        options={[
                            { value: 'All', label: 'All Priorities' },
                            { value: 'Critical', label: 'Critical' },
                            { value: 'High', label: 'High' },
                            { value: 'Medium', label: 'Medium' },
                            { value: 'Low', label: 'Low' }
                        ]}
                    />
                </div>
                <div className='h-6 w-24 bg-slate-100 rounded-md relative overflow-hidden shrink-0'>
                  <div className='absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[shimmer_1.5s_infinite]' />
                </div>
                <div className='h-6 w-20 bg-slate-100 rounded-full relative overflow-hidden shrink-0'>
                  <div className='absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[shimmer_1.5s_infinite]' />
                </div>
                <div className='h-5 w-16 bg-slate-100 rounded-md relative overflow-hidden shrink-0'>
                  <div className='absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[shimmer_1.5s_infinite]' />
                </div>
                <div className='h-8 w-24 bg-slate-100 rounded-md relative overflow-hidden shrink-0 hidden sm:block'>
                  <div className='absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/60 to-transparent animate-[shimmer_1.5s_infinite]' />
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : error ? (
        <Card className='p-8 border-red-100 bg-red-50/50 rounded-2xl flex flex-col items-center text-center'>
          <AlertCircle className='w-12 h-12 text-red-500 mb-4' />
          <h3 className='text-lg font-bold text-red-900 mb-1'>Database Sync Error</h3>
          <p className='text-red-700/70 text-sm max-w-sm mb-6'>{error}</p>
          <button
            onClick={fetchTickets}
            className='px-6 py-2 bg-white border border-red-200 text-red-700 font-bold rounded-xl hover:bg-red-50 transition-colors shadow-sm'
          >
            Retry Connection
          </button>
        </Card>
      ) : tickets.length === 0 ? (
        // True Empty State
        <Card className='flex flex-col items-center justify-center py-20 text-center border-dashed border-2 border-gray-200 bg-transparent shadow-none rounded-2xl'>
          <div className='w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4'>
            <Inbox className='text-gray-400 w-8 h-8' />
          </div>
          <h3 className='text-xl font-bold text-gray-800 mb-1'>No tickets yet</h3>
          <p className='text-gray-500 max-w-sm mb-8'>
            You haven't submitted any support requests. Create a ticket to get help from our AI and
            support team.
          </p>
          <button
            onClick={() => navigate('/create-ticket')}
            className='px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors shadow-sm'
          >
            Create your first ticket
          </button>
        </Card>
      ) : filteredTickets.length === 0 ? (
        // Filter Empty State
        <Card className='flex flex-col items-center justify-center py-16 text-center border border-gray-100 shadow-sm rounded-2xl bg-white'>
          <Filter className='text-gray-300 w-12 h-12 mb-4' />
          <h3 className='text-lg font-bold text-gray-900 mb-1'>No matching tickets found</h3>
          <p className='text-gray-500 text-sm mb-4'>Try adjusting your search or filters.</p>
          <button
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('All');
              setPriorityFilter('All');
            }}
            className='text-emerald-600 font-semibold hover:text-emerald-700 text-sm'
          >
            Clear all filters
          </button>
        </Card>
      ) : (
        // Table View
        <Card className='border border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden'>
          <div className='overflow-x-auto'>
            <table className='w-full text-left whitespace-nowrap'>
              <thead>
                <tr className='bg-gray-50/50 border-b border-gray-100'>
                  <th className='px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest'>
                    ID
                  </th>
                  <th className='px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest'>
                    Subject
                  </th>
                  <th className='px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest'>
                    Category
                  </th>
                  <th className='px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest'>
                    Status
                  </th>
                  <th className='px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest'>
                    Priority
                  </th>
                  <th className='px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest'>
                    Submitted
                  </th>
                </tr>
              </thead>
              <TooltipProvider delayDuration={300}>
                <tbody className='divide-y divide-gray-100'>
                  {filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => navigate(`/ticket/${ticket.id}`)}
                      className='group hover:bg-emerald-50/30 transition-colors cursor-pointer'
                    >
                      <td className='px-6 py-4'>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className='font-mono font-bold text-gray-900 text-sm'>
                              #{formatTicketId(ticket.id)}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side='top'
                            className='bg-gray-900 text-white border-none p-4 w-[300px] shadow-xl rounded-xl'
                            sideOffset={10}
                          >
                            <div className='space-y-3'>
                              <div>
                                <p className='text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1'>
                                  Issue Overview
                                </p>
                                <p className='text-sm font-medium leading-relaxed overflow-hidden text-ellipsis whitespace-nowrap'>
                                  {ticket.summary ||
                                    ticket.description ||
                                    'No description provided'}
                                </p>
                              </div>
                              <div className='grid grid-cols-2 gap-3'>
                                <div>
                                  <p className='text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1'>
                                    Category
                                  </p>
                                  <p className='text-sm font-medium'>
                                    {ticket.category || 'General'}
                                  </p>
                                </div>
                                <div>
                                  <p className='text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1'>
                                    Priority
                                  </p>
                                  <p className='text-sm font-medium capitalize'>
                                    {ticket.priority || 'medium'}
                                  </p>
                                </div>
                              </div>
                              <div>
                                <p className='text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1'>
                                  Assigned Unit
                                </p>
                                <p className='text-sm font-medium flex items-center gap-1.5'>
                                  <ShieldCheck size={14} className='text-emerald-400' />
                                  {ticket.assigned_team || 'General Support'}
                                </p>
                              </div>
                            </div>
                        ))}
                    </div>
                </Card>
            ) : error ? (
                <Card className="p-8 border-red-100 bg-red-50/50 rounded-2xl flex flex-col items-center text-center" role="alert" aria-live="assertive">
                    <AlertCircle className="w-12 h-12 text-red-500 mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-bold text-red-900 mb-1">Database Sync Error</h3>
                    <p className="text-red-700/70 text-sm max-w-sm mb-6">{error}</p>
                    <button
                        onClick={fetchTickets}
                        className="px-6 py-2 bg-white border border-red-200 text-red-700 font-bold rounded-xl hover:bg-red-50 transition-colors shadow-sm"
                    >
                        Retry Connection
                    </button>
                </Card>
            ) : tickets.length === 0 ? (
                // True Empty State
                <Card className="flex flex-col items-center justify-center py-20 text-center border-dashed border-2 border-gray-200 bg-transparent shadow-none rounded-2xl" role="status">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <Inbox className="text-gray-400 w-8 h-8" aria-hidden="true" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-1">No tickets yet</h3>
                    <p className="text-gray-500 max-w-sm mb-8">
                        You haven't submitted any support requests. Create a ticket to get help from our AI and support team.
                    </p>
                    <button
                        onClick={() => navigate('/create-ticket')}
                        className="px-6 h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-xl shadow-emerald-600/10 active:scale-[0.99] flex items-center justify-center gap-2 border-none cursor-pointer whitespace-nowrap self-start sm:self-auto"
                    >
                        <span>Create New Ticket</span>
                        <ArrowRight size={14} />
                    </button>
                </Card>
            ) : filteredTickets.length === 0 ? (
                // Filter Empty State
                <Card className="flex flex-col items-center justify-center py-16 text-center border border-gray-100 shadow-sm rounded-2xl bg-white" role="status">
                    <Filter className="text-gray-300 w-12 h-12 mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-bold text-gray-900 mb-1">No matching tickets found</h3>
                    <p className="text-gray-500 text-sm mb-4">Try adjusting your search or filters.</p>
                    <button
                        onClick={() => {
                            setSearchQuery('');
                            setStatusFilter('All');
                            setPriorityFilter('All');
                        }}
                        className="text-emerald-600 font-semibold hover:text-emerald-700 text-sm"
                    >
                        Clear all filters
                    </button>
                </Card>
            ) : (
                // Table View
                <Card className="border border-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left whitespace-nowrap" role="table" aria-label="Support tickets">
                            <thead>
                                <tr className="bg-gray-50/50 border-b border-gray-100">
                                    <th scope="col" className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">ID</th>
                                    <th scope="col" className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Subject</th>
                                    <th scope="col" className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Category</th>
                                    <th scope="col" className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Status</th>
                                    <th scope="col" className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Priority</th>
                                    <th scope="col" className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Est. SLA</th>
                                    <th scope="col" className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Submitted</th>
                                </tr>
                            </thead>
                            <TooltipProvider delayDuration={300}>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredTickets.map(ticket => (
                                        <tr
                                            key={ticket.id}
                                            onClick={() => navigate(`/ticket/${ticket.id}`)}
                                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`/ticket/${ticket.id}`); } }}
                                            tabIndex={0}
                                            role="row"
                                            aria-rowindex={filteredTickets.indexOf(ticket) + 2}
                                            aria-label={`Ticket ${formatTicketId(ticket.id)}: ${ticket.subject || ticket.summary || 'No subject'}, Status: ${ticket.status || 'open'}, Priority: ${ticket.priority || 'medium'}`}
                                            className="group hover:bg-emerald-50/30 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-inset"
                                        >
                                            <td className="px-6 py-4">
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="font-mono font-bold text-gray-900 text-sm">#{formatTicketId(ticket.id)}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent
                                                        side="top"
                                                        className="bg-gray-900 text-white border-none p-4 w-[300px] shadow-xl rounded-xl"
                                                        sideOffset={10}
                                                    >
                                                        <td className="px-6 py-4">
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <span className="font-mono font-black text-emerald-400 text-xs">#{formatTicketId(ticket.id)}</span>
                                                                </TooltipTrigger>
                                                                <TooltipContent
                                                                    side="top"
                                                                    className="bg-slate-950 text-slate-200 border border-white/10 p-5 w-[320px] shadow-2xl rounded-2xl text-left"
                                                                    sideOffset={10}
                                                                >
                                                                    <div className="space-y-4">
                                                                        <div>
                                                                            <p className="text-[9px] uppercase font-black text-slate-500 tracking-widest mb-1.5">Issue Analytical Summary</p>
                                                                            <p className="text-xs font-semibold leading-relaxed m-0 text-slate-200 line-clamp-3 whitespace-normal">{safeDisplayText(ticket.summary || ticket.description, "No parameter summary details mapped.")}</p>
                                                                        </div>
                                                                        <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3">
                                                                            <div>
                                                                                <p className="text-[9px] uppercase font-black text-slate-500 tracking-widest mb-1">Domain</p>
                                                                                <p className="text-xs font-bold text-slate-300 m-0">{ticket.category || 'General'}</p>
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[9px] uppercase font-black text-slate-500 tracking-widest mb-1">Priority</p>
                                                                                <p className="text-xs font-bold text-slate-300 m-0 capitalize">{ticket.priority || 'medium'}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="border-t border-white/5 pt-3">
                                                                            <p className="text-[9px] uppercase font-black text-slate-500 tracking-widest mb-1">Routing Unit Group</p>
                                                                            <p className="text-xs font-bold text-slate-300 m-0 flex items-center gap-1.5"><ShieldCheck size={13} className="text-emerald-400 shrink-0" />{ticket.assigned_team || 'General Support'}</p>
                                                                        </div>
                                                                    </div>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </td>
                                                        <td className="px-6 py-4 max-w-[280px] sm:max-w-xs md:max-w-sm truncate">
                                                            <p className="text-sm font-semibold text-slate-200 m-0 truncate group-hover:text-emerald-400 transition-colors font-medium">
                                                                {safeDisplayText(ticket.summary || ticket.subject || ticket.description, "No operational text defined.")}
                                                            </p>
                                                             <div className="mt-1">
                                                     <LanguageBadge detectedLanguage={ticket?.detected_language} compact />
                                                 </div>
                                            </td>
                                                        <td className="px-6 py-4">
                                                            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 bg-white/5 px-2.5 h-6 inline-flex items-center rounded-lg border border-white/5">
                                                                {ticket.category || 'General'}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <TicketStatusBadge status={ticket.status} />
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 h-6 inline-flex items-center rounded-lg border ${getPriorityColor(ticket.priority)}`}>
                                                                {ticket.priority || 'medium'}
                                                            </span>
                                                        </td>
                                                       <td className="px-6 py-4">
                                                <SLABadge
                                                    priority={ticket.priority}
                                                    createdAt={ticket.created_at}
                                                    slaBreachAt={ticket.sla_breach_at}
                                                    slaStatus={ticket.sla_status}
                                                    status={ticket.status}
                                                    ticketId={ticket.id}
                                                />
                                            </td>
                                             <td className="px-6 py-4">
                                                            <div className="flex flex-col text-left">
                                                                <span className="text-xs font-bold text-slate-400 font-mono">
                                                                    {formatTimelineDate(ticket.created_at)}
                                                                </span>
                                                                <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mt-0.5">
                                                                    {getTimeZoneAbbr()} Cluster Node
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </TooltipProvider>
                                    </table>
                                </div>
                            </Card>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Local Scrollbar Style Modifiers */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                    .customize-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; }
                    .customize-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .customize-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.04); border-radius: 99px; }
                    .customize-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.08); }
                `}} />
            </main>
        </div>
    );
}

export default MyTickets;

