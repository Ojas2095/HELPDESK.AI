import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import useAuthStore from "../../store/authStore";
import useToastStore from "../../store/toastStore";
import { supabase } from "../../lib/supabaseClient";
import useTicketsRealtime from "../../hooks/useTicketsRealtime";
import TagFilter from "../../components/TagFilter";
import TagChip from "../../components/TagChip";
import { TicketTableSkeleton } from "../../components/Skeletons";
import {
  Search,
  Filter,
  Inbox,
  Activity,
  ShieldAlert,
  Clock,
  ChevronRight,
  BarChart3,
  User,
  ArrowUpRight,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  RotateCcw,
} from 'lucide-react';
import { Select } from "../../components/ui/select";
import { formatTicketId } from "../../utils/format";
import SLABadge from "../components/SLABadge";
import { formatTimelineDate } from "../../utils/dateUtils";
import { sanitizeSearchQuery } from "../../utils/sanitizeText";

const AdminTicketsSkeleton = () => (
    <div className="animate-pulse" role="status" aria-live="polite" aria-atomic="true">
        <span className="sr-only">Loading tickets...</span>
        {[...Array(6)].map((_, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-[90px_180px_260px_120px_140px_120px_120px_100px_80px] gap-4 px-6 py-5 border-b border-slate-50 items-center">
                <div className="h-4 bg-emerald-100 rounded-full" />
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-100 rounded-lg" />
                    <div className="space-y-2 flex-1">
                        <div className="h-3 bg-slate-100 rounded-full" />
                        <div className="h-2 bg-slate-100 rounded-full w-2/3" />
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="h-3 bg-slate-100 rounded-full" />
                    <div className="h-2 bg-slate-100 rounded-full w-1/2" />
                </div>
                <div className="h-7 bg-amber-100 rounded-xl" />
                <div className="h-8 bg-slate-100 rounded-full" />
                <div className="h-4 bg-emerald-100 rounded-full" />
                <div className="h-7 bg-slate-100 rounded-xl" />
                <div className="h-6 bg-slate-100 rounded-full" />
                <div className="h-9 bg-slate-900/10 rounded-xl" />
            </div>
        ))}
    </div>
);

const AdminTickets = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useAuthStore();
    const { showToast } = useToastStore();

    // Data State
    const [tickets, setTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isUpdating, setIsUpdating] = useState(null);
    const [isUpdating, setIsUpdating] = useState(null); // ID of ticket being updated

    // Filter States
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [priorityFilter, setPriorityFilter] = useState('All');
    const [teamFilter, setTeamFilter] = useState('All');
    const [agents, setAgents] = useState([]);
    const [selectedTickets, setSelectedTickets] = useState([]);
    const [bulkAction, setBulkAction] = useState('');
    const [bulkValue, setBulkValue] = useState('');
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);
    const [languageFilter, setLanguageFilter] = useState('All');
    const [slaAtRisk, setSlaAtRisk] = useState(false);
    const [agents, setAgents] = useState([]); // All staff/admins in the company
    const [tagFilters, setTagFilters] = useState([]);

    // Pagination State
    const PAGE_SIZE = 25;
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const hasMore = totalCount === null ? false : (page + 1) * PAGE_SIZE < totalCount;

    const ticketMatchesFilters = useCallback((ticket) => {
        if (statusFilter !== 'All' && String(ticket.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
        if (categoryFilter !== 'All' && ticket.category !== categoryFilter) return false;
        if (priorityFilter !== 'All' && String(ticket.priority || '').toLowerCase() !== priorityFilter.toLowerCase()) return false;
        if (teamFilter !== 'All' && ticket.assigned_team !== teamFilter) return false;
        if (tagFilters.length > 0 && !(ticket.tags || []).length) return false;
        if (tagFilters.length > 0 && !tagFilters.every(tag => (ticket.tags || []).includes(tag))) return false;
        if (languageFilter !== 'All') {
            const translated = ticket?.metadata?.translation?.translated;
            if (languageFilter === 'Translated' && !translated) return false;
            if (languageFilter === 'English' && translated) return false;
        }
        return true;
    }, [categoryFilter, priorityFilter, statusFilter, teamFilter, languageFilter, tagFilters]);


    const handleRealtimeInsert = useCallback((ticket) => {
        showToast(`New Incident Reported: #${formatTicketId(ticket.id)}`, "success");
    }, [showToast]);

    const { lastChangedTicketId } = useTicketsRealtime({
        company: profile?.company,
        enabled: Boolean(profile),
        onTicketsChange: setTickets,
        onInsert: handleRealtimeInsert,
        shouldInclude: ticketMatchesFilters,
        channelName: 'admin_tickets_realtime',
    });

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { profile } = useAuthStore.getState();

      // 1. Fetch Agents for this company
      if (profile?.company) {
        const { data: agentData } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('company', profile.company)
          .in('role', ['admin', 'super_admin', 'agent']);
        setAgents(agentData || []);
      }

      // 2. Fetch Tickets (Join with both Creator and Assignee)
      fetchTickets();
    } catch (err) {
      console.error('Initialization error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    setError(null);
    try {
      const { profile } = useAuthStore.getState();

      // Join with profiles for both user_id (creator) and assigned_agent_id (assignee)
      let query = supabase.from('tickets').select(`
                    *,
                    creator:profiles!tickets_user_id_fkey(full_name, email, profile_picture),
                    assignee:profiles!tickets_assigned_agent_id_fkey(full_name, email, profile_picture)
                `, { count: 'exact' });

      if (profile?.role === 'admin' && profile?.company) {
        query = query.eq('company', profile.company);
      }

      if (statusFilter !== 'All') query = query.eq('status', statusFilter.toLowerCase());
      if (categoryFilter !== 'All') query = query.eq('category', categoryFilter);
      if (priorityFilter !== 'All') query = query.eq('priority', priorityFilter.toLowerCase());
      if (teamFilter !== 'All') query = query.eq('assigned_team', teamFilter);

      let { data, error: sbError } = await query.order('created_at', { ascending: false });

      if (sbError) {
        // Secondary check: If the FK alias fails, try a simpler select
        console.warn('Retrying fetch without relationship aliases...');
        const basicQuery = supabase.from('tickets').select('*, profiles(full_name, email)');
        const { data: basicData, error: basicError } = await basicQuery
          .eq('company', profile?.company)
          .order('created_at', { ascending: false });
        if (basicError) throw basicError;
        setTickets(basicData || []);
      } else {
        setTickets(data || []);
      }
    } catch (err) {
      console.error('Admin fetch error:', err);
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchInitialData();

    // 4. Real-time subscription to ticket changes
    const { profile } = useAuthStore.getState();
    const channel = supabase
      .channel('admin_tickets_realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: profile?.company ? `company=eq.${profile.company}` : undefined,
        },
        (payload) => {
          console.log('Admin tickets sync event:', payload.eventType, payload.new);
          if (payload.eventType === 'INSERT') {
            setTickets((prev) => [payload.new, ...prev]);
            showToast(`New Incident Reported: #${payload.new.id}`, 'success');
            // Play a subtle sound or visual cue if needed
          } else if (payload.eventType === 'UPDATE') {
            setTickets((prev) =>
              prev.map((t) => (t.id === payload.new.id ? { ...t, ...payload.new } : t))
            );
          } else if (payload.eventType === 'DELETE') {
            setTickets((prev) => prev.filter((t) => t.id === payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [statusFilter, categoryFilter, priorityFilter, teamFilter]);

    useEffect(() => {
        fetchInitialData();

        // 4. Real-time subscription to ticket changes
        const { profile } = useAuthStore.getState();
        const channel = supabase
            .channel('admin_tickets_realtime')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'tickets',
                    filter: profile?.company ? `company=eq.${profile.company}` : undefined
                },
                (payload) => {
                    console.log("Admin tickets sync event:", payload.eventType, payload.new);
                    if (payload.eventType === 'INSERT') {
                        setTickets(prev => [payload.new, ...prev]);
                        showToast(`New Incident Reported: #${payload.new.id}`, "success");
                        // Play a subtle sound or visual cue if needed
                    } else if (payload.eventType === 'UPDATE') {
                        setTickets(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t));
                    } else if (payload.eventType === 'DELETE') {
                        setTickets(prev => prev.filter(t => t.id === payload.old.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
     
    }, [statusFilter, categoryFilter, priorityFilter, teamFilter]);

      // Optimistic update already handled if real-time is fast,
      // but manual update ensures immediate feedback
      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
      showToast('System synchronization successful.', 'success');
    } catch (err) {
      console.error('Update failed:', err);
      showToast('Update failed: ' + err.message, 'error');
    } finally {
      setIsUpdating(null);
    }
  };

  const categories = ['All', 'Network', 'Hardware', 'Software', 'Access', 'Account'];
  const priorities = ['All', 'Low', 'Medium', 'High'];
  const statuses = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];
  const teams = [
    'All',
    'Software Team',
    'Hardware Support',
    'Network Ops',
    'Security Unit',
    'General Support',
  ];

            if (upError) throw upError;
            setTickets(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
            showToast("System synchronization successful.", "success");
        } catch (err) {
            console.error("Update failed:", err);
            showToast("Update failed: " + err.message, "error");
        } finally {
            setIsUpdating(null);
        }
    };

    // --- Bulk Operations ---
    const handleSelectAll = () => {
        if (selectedTickets.length === filteredTickets.length) {
            setSelectedTickets([]);
        } else {
            setSelectedTickets(filteredTickets.map(t => t.id));
        }
    };

    const handleSelectTicket = (id) => {
        setSelectedTickets(prev =>
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        );
    };

    const handleBulkExecute = async () => {
        if (!bulkAction || selectedTickets.length === 0) return;
        try {
            let updates = {};
            if (bulkAction === 'close') updates = { status: 'closed' };
            if (bulkAction === 'priority') updates = { priority: bulkValue };
            if (bulkAction === 'assign') updates = { assigned_agent_id: bulkValue, status: 'in progress' };

            for (const id of selectedTickets) {
                await supabase.from('tickets').update(updates).eq('id', id);
            }

            setTickets(prev => prev.map(t =>
                selectedTickets.includes(t.id) ? { ...t, ...updates } : t
            ));
            showToast(`${selectedTickets.length} tickets updated successfully.`, "success");
            setSelectedTickets([]);
            setBulkAction('');
            setBulkValue('');
            setShowBulkConfirm(false);
        } catch (err) {
            showToast("Bulk update failed: " + err.message, "error");
        }
    const exportCSV = () => {
        const exportData = filteredTickets.map(t => ({
            ID: formatTicketId(t.id),
            Title: t.summary || t.subject || '',
            Category: t.category || '',
            Priority: t.priority || '',
            Status: t.status || '',
            'Created Date': t.created_at ? new Date(t.created_at).toLocaleString() : '',
            'Resolved Date': t.resolved_at ? new Date(t.resolved_at).toLocaleString() : '',
            'Assigned Agent': t.assignee?.full_name || '',
        }));
        const csv = Papa.unparse(exportData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tickets_export_${Date.now()}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const exportPDF = () => {
        const doc = new jsPDF();
        doc.setFontSize(16);
        doc.text('Ticket Export Report', 14, 15);
        doc.setFontSize(8);
        let y = 25;
        filteredTickets.forEach((t, i) => {
            if (y > 270) { doc.addPage(); y = 15; }
            doc.text(
                `#${formatTicketId(t.id)} | ${t.summary || t.subject || 'N/A'} | ${t.category || ''} | ${t.priority || ''} | ${t.status || ''} | ${t.created_at ? new Date(t.created_at).toLocaleDateString() : ''}`,
                14, y
            );
            y += 7;
        });
        doc.save(`tickets_export_${Date.now()}.pdf`);
    };

    const categories = ['All', 'Network', 'Hardware', 'Software', 'Access', 'Account'];
    const priorities = ['All', 'Low', 'Medium', 'High'];
    const statuses = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];
    const teams = ['All', 'Software Team', 'Hardware Support', 'Network Ops', 'Security Unit', 'General Support'];

    const filteredTickets = useMemo(() => {
        if (!searchQuery) return tickets;
        const q = sanitizeSearchQuery(searchQuery).toLowerCase();
        return tickets.filter(t =>
            String(t.id).includes(q) ||
            (t.subject || '').toLowerCase().includes(q) ||
            (t.summary || '').toLowerCase().includes(q) ||
            (t.description || '').toLowerCase().includes(q) ||
            (t.profiles?.full_name || '').toLowerCase().includes(q)
        );
    }, [tickets, searchQuery]);

    const getPriorityStyle = (priority) => {
        const p = String(priority || '').toLowerCase();
        if (p === 'high' || p === 'critical') return 'text-red-600 bg-red-50 border-red-100';
        if (p === 'medium') return 'text-amber-600 bg-amber-50 border-amber-100';
        if (p === 'low') return 'text-emerald-600 bg-emerald-50 border-emerald-100';
        return 'text-slate-500 bg-slate-50 border-slate-100';
    };

    const getConfidenceColor = (conf) => {
        if (conf >= 0.8) return 'bg-emerald-500';
        if (conf >= 0.5) return 'bg-amber-500';
        return 'bg-red-500';
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* 1. Header & Utility Bar */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight italic uppercase">Ticket Management</h1>
                    <p className="text-sm font-bold text-slate-400 mt-1 flex items-center gap-2">
                        <Activity size={14} className="text-indigo-500" /> {totalCount !== null ? totalCount : filteredTickets.length} tickets{totalCount !== null ? ' in total' : ' matching current filters'}.
                    </p>
                </div>
            </div>

            {/* 2. Advanced Filtering Station */}
            <div className="bg-white dark:bg-slate-950 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="relative group lg:col-span-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-700 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                    </div>
                    <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} buttonClassName="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-left flex justify-between items-center" options={statuses.map(s => ({ value: s, label: s === 'All' ? 'All Statuses' : s }))} />
                    <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} buttonClassName="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-left flex justify-between items-center" options={categories.map(c => ({ value: c, label: c === 'All' ? 'All Categories' : c }))} />
                    <Select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} buttonClassName="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-left flex justify-between items-center" options={priorities.map(p => ({ value: p, label: p === 'All' ? 'All Priorities' : p }))} />
                    <Select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} buttonClassName="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-left flex justify-between items-center" options={teams.map(t => ({ value: t, label: t === 'All' ? 'All Teams' : t }))} />
                </div>
            </div>

            {/* 3. Bulk Action Toolbar — appears when tickets selected */}
            {selectedTickets.length > 0 && (
                <div className="bg-indigo-600 text-white px-6 py-4 rounded-2xl flex items-center justify-between gap-4 shadow-lg shadow-indigo-500/20 animate-in fade-in duration-200">
                    <span className="text-sm font-black uppercase tracking-widest">
                        {selectedTickets.length} ticket{selectedTickets.length > 1 ? 's' : ''} selected
                    </span>
                    <div className="flex items-center gap-3">
                        {/* Bulk Action Select */}
                        <select
                            value={bulkAction}
                            onChange={(e) => { setBulkAction(e.target.value); setBulkValue(''); }}
                            className="bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl px-3 py-2 border border-indigo-400 outline-none cursor-pointer"
                        >
                            <option value="">Select Action</option>
                            <option value="close">Close Tickets</option>
                            <option value="priority">Change Priority</option>
                            <option value="assign">Assign Agent</option>
                        </select>

                        {/* Bulk Value Select */}
                        {bulkAction === 'priority' && (
                            <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl px-3 py-2 border border-indigo-400 outline-none">
                                <option value="">Pick Priority</option>
                                {priorities.filter(p => p !== 'All').map(p => <option key={p} value={p.toLowerCase()}>{p}</option>)}
                            </select>
                        )}
                        {bulkAction === 'assign' && (
                            <select value={bulkValue} onChange={(e) => setBulkValue(e.target.value)} className="bg-indigo-500 text-white text-xs font-black uppercase tracking-widest rounded-xl px-3 py-2 border border-indigo-400 outline-none">
                                <option value="">Pick Agent</option>
                                {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                            </select>
                        )}

                        {/* Apply Button */}
                        {bulkAction && (bulkAction === 'close' || bulkValue) && (
                            <button onClick={() => setShowBulkConfirm(true)} className="bg-white text-indigo-600 text-xs font-black uppercase tracking-widest rounded-xl px-4 py-2 hover:bg-indigo-50 transition-colors">
                                Apply
                            </button>
                        )}

                        {/* Clear Selection */}
                        <button onClick={() => { setSelectedTickets([]); setBulkAction(''); setBulkValue(''); }} className="p-2 hover:bg-indigo-500 rounded-xl transition-colors">
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* 4. Bulk Confirm Modal */}
            {showBulkConfirm && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
                    <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl">
                        <h3 className="text-lg font-black text-slate-900 uppercase italic tracking-tight">Confirm Bulk Action</h3>
                        <p className="text-sm text-slate-500 mt-2">
                            You are about to <strong>{bulkAction}</strong> {selectedTickets.length} ticket(s). This cannot be undone.
                        </p>
                        <div className="flex gap-3 mt-6">
                            <button onClick={handleBulkExecute} className="flex-1 bg-indigo-600 text-white rounded-2xl py-3 text-xs font-black uppercase tracking-widest hover:bg-indigo-700 transition-colors">
                                Confirm
                            </button>
                            <button onClick={() => setShowBulkConfirm(false)} className="flex-1 bg-slate-100 text-slate-600 rounded-2xl py-3 text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. High-Density Data Terminal */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden relative min-h-[400px]">
                {loading && <TicketTableSkeleton rows={8} />}

                {!loading && error && (
                    <div className="p-12 text-center text-red-500 space-y-4">
                        <AlertCircle className="mx-auto w-12 h-12" />
                        <p className="font-bold uppercase tracking-widest text-xs">{error}</p>
                        <button onClick={fetchTickets} className="px-6 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest">Retry</button>
                    </div>
                )}

                {!loading && (
                <div className="bg-white rounded-[2rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                {/* Select All Checkbox */}
                                <th className="px-4 py-5 text-center w-10">
                                    <button onClick={handleSelectAll} className="text-slate-400 hover:text-indigo-600 transition-colors">
                                        {selectedTickets.length === filteredTickets.length && filteredTickets.length > 0
                                            ? <CheckSquare size={16} className="text-indigo-600" />
                                            : <Square size={16} />
                                        }
                                    </button>
                                </th>
                                <th className="px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <div className="flex items-center gap-2">
                                        ID
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                                    </div>
                                </th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">User</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Subject</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Priority</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">AI Score</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Agent</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-5 text-left text-xs font-black text-slate-400 uppercase tracking-widest">SLA</th>
                                <th className="px-6 py-5 text-center text-xs font-black text-slate-400 uppercase tracking-widest">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
<<<<<<< HEAD
                            {filteredTickets.map((ticket) => (
                                <tr key={ticket.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group ${isUpdating === ticket.id ? 'opacity-50 pointer-events-none' : ''}`}>
=======
                            {filteredTickets.map((ticket) => {
                                const wasLiveChanged = String(lastChangedTicketId) === String(ticket.id);
                                const isSelected = selectedTickets.includes(ticket.id);

                                return (
                                <tr key={ticket.id} className={`hover:bg-slate-50/50 transition-colors group ${wasLiveChanged ? 'bg-emerald-50/70 ring-1 ring-emerald-100' : ''} ${isUpdating === ticket.id ? 'opacity-50 pointer-events-none' : ''} ${isSelected ? 'bg-indigo-50/50 ring-1 ring-indigo-100' : ''}`}>
                                    {/* Row Checkbox */}
                                    <td className="px-4 py-6 text-center">
                                        <button onClick={() => handleSelectTicket(ticket.id)} className="text-slate-300 hover:text-indigo-600 transition-colors">
                                            {isSelected
                                                ? <CheckSquare size={16} className="text-indigo-600" />
                                                : <Square size={16} />
                                            }
                                        </button>
                                    </td>

                                const slaState = (ticket.sla_status || '').toUpperCase();
                                const slaRowClass =
                                    slaState === 'BREACHED' ? 'bg-red-50/60 ring-1 ring-red-100' :
                                    slaState === 'WARNING'  ? 'bg-amber-50/50 ring-1 ring-amber-100' : '';

                                return (
                                <tr key={ticket.id} className={`hover:bg-slate-50/50 transition-colors group ${wasLiveChanged ? 'bg-emerald-50/70 ring-1 ring-emerald-100' : slaRowClass} ${isUpdating === ticket.id ? 'opacity-50 pointer-events-none' : ''}`}>
>>>>>>> upstream/gssoc
                                    {/* Ticket ID */}
                                    <td className="px-6 py-6">
                                        <span className="font-mono text-xs font-black text-emerald-600">#{formatTicketId(ticket.id)}</span>
                                    </td>

                                    {/* User */}
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-3">
                                            {ticket.creator?.profile_picture || ticket.profiles?.profile_picture ? (
                                                <img src={ticket.creator?.profile_picture || ticket.profiles?.profile_picture} alt={ticket.creator?.full_name || ticket.profiles?.full_name || 'User'} className="w-8 h-8 rounded-lg object-cover border border-slate-100 shadow-sm" loading="lazy" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-100/50">
                                                    {(ticket.creator?.full_name || ticket.profiles?.full_name || 'System').charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-slate-800 tracking-tight italic uppercase truncate max-w-[120px]">{ticket.creator?.full_name || ticket.profiles?.full_name || 'System'}</span>
                                                <span className="text-[10px] font-bold text-slate-400 lowercase truncate max-w-[120px]">{ticket.creator?.email || ticket.profiles?.email || '—'}</span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Subject */}
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col">
                                            <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]" title={ticket.summary || ticket.subject}>{ticket.summary || ticket.subject}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]" title={ticket.summary || ticket.subject}>
                                                    {ticket.summary || ticket.subject}
                                                </span>
                                                {ticket.metadata?.spam_analysis?.is_spam && (
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider flex items-center gap-1 ${
                                                        ticket.metadata.spam_analysis.risk_level === 'high' 
                                                            ? 'bg-red-100 text-red-700 border border-red-200' 
                                                            : 'bg-amber-100 text-amber-700 border border-amber-200'
                                                    }`}>
                                                        <ShieldAlert size={10} />
                                                        {ticket.metadata.spam_analysis.risk_level} Risk
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                {ticket.category}
                                                <span className="text-[9px] font-medium text-slate-300">• {formatTimelineDate(ticket.created_at)}</span>
                                            </span>
                                            {ticket?.metadata?.translation?.translated && (
                                                <span className="text-[10px] text-sky-700 mt-1">Translated from {ticket.metadata.translation.source_language_name || ticket.metadata.translation.source_language || 'Unknown'}</span>
                                            )}
                                            <LanguageBadge detectedLanguage={ticket?.detected_language} compact />
                                        </div>
                                    </td>

                                    {/* Priority */}
                                    <td className="px-6 py-6">
                                        <select value={String(ticket.priority || 'medium').toLowerCase()} onChange={(e) => handleUpdateTicket(ticket.id, { priority: e.target.value })} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border outline-none cursor-pointer transition-all flex items-center justify-between ${getPriorityStyle(ticket.priority)}`}>
                                            {priorities.filter(p => p !== 'All').map(p => <option key={p} value={p.toLowerCase()}>{p}</option>)}
                                        </select>
                                    </td>

                                    {/* AI Score */}
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[8px] font-black ${ticket.confidence >= 0.8 ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : ticket.confidence >= 0.5 ? 'border-amber-500 text-amber-600 bg-amber-50' : 'border-red-500 text-red-600 bg-red-50'}`}>
                                                {(ticket.confidence * 100).toFixed(0)}%
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] font-black text-slate-400 uppercase">Confidence</span>
                                                <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden mt-0.5">
                                                    <div className={`h-full ${getConfidenceColor(ticket.confidence || 0)}`} style={{ width: `${(ticket.confidence || 0) * 100}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    {/* Agent */}
                                    <td className="px-6 py-6 text-emerald-600 font-bold text-[10px]">{ticket.assigned_team || 'General'}</td>

                                    {/* Assignee */}
                                    <td className="px-6 py-6">
                                        <div className="flex flex-col gap-1 min-w-[120px]">
                                            {ticket.assigned_agent_id ? (
                                                <select value={ticket.assigned_agent_id} onChange={(e) => handleUpdateTicket(ticket.id, { assigned_agent_id: e.target.value, status: 'in progress' })} className="bg-transparent text-[10px] font-black text-indigo-600 uppercase tracking-tight italic border-none focus:ring-0 cursor-pointer hover:underline">
                                                    {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                                                </select>
                                            ) : (
                                                <button onClick={() => handleUpdateTicket(ticket.id, { assigned_agent_id: user.id, status: 'in progress' })} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                                    Claim
                                                </button>
                                            )}
                                        </div>
                                    </td>

                                    {/* Status */}
                                    <td className="px-6 py-6">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${ticket.status?.toLowerCase() === 'resolved' || ticket.status?.toLowerCase() === 'closed' ? 'bg-emerald-400' : 'bg-amber-500 animate-pulse'}`}></div>
                                            <Select value={String(ticket.status || 'open').toLowerCase()} onChange={(e) => handleUpdateTicket(ticket.id, { status: e.target.value })} buttonClassName="bg-transparent text-[10px] font-black text-slate-600 uppercase tracking-widest outline-none cursor-pointer flex justify-between items-center w-full" options={statuses.filter(s => s !== 'All').map(s => ({ value: s.toLowerCase(), label: s }))} />
                                            <div className={`w-1.5 h-1.5 rounded-full ${
                                                ticket.status?.toLowerCase() === 'resolved' || ticket.status?.toLowerCase() === 'closed' 
                                                    ? 'bg-emerald-400' 
                                                    : ticket.status?.toLowerCase() === 'spam'
                                                        ? 'bg-slate-400 border border-slate-500'
                                                        : 'bg-amber-500 animate-pulse'
                                            }`}></div>
                                            <Select
                                                value={String(ticket.status || 'open').toLowerCase()}
                                                onChange={(e) => handleUpdateTicket(ticket.id, { status: e.target.value })}
                                                buttonClassName="bg-transparent text-xs font-black text-slate-600 uppercase tracking-widest outline-none cursor-pointer flex justify-between items-center w-full"
                                                options={statuses.filter(s => s !== 'All').map(s => ({ value: s.toLowerCase(), label: s }))}
                                            />
                                        </div>
                                    </td>

                                    {/* SLA Badge */}
                                    <td className="px-6 py-6">
                                        <SLABadge priority={ticket.priority} createdAt={ticket.created_at} slaBreachAt={ticket.sla_breach_at} slaStatus={ticket.sla_status} status={ticket.status} />
                                        <SLABadge
                                            priority={ticket.priority}
                                            createdAt={ticket.created_at}
                                            status={ticket.status}
                                        />
                                    </td>

                                    {/* Actions */}
                                    <td className="px-6 py-6 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => navigate(`/admin/ticket/${ticket.id}`)} className="p-2 bg-slate-900 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-slate-900/10 hover:shadow-emerald-500/20" title="Open Detailed View">
                                                <ArrowUpRight size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {!loading && filteredTickets.length === 0 && (
                    <div className="py-32 text-center bg-slate-50/30 w-full flex flex-col items-center">
                        <div className="w-20 h-20 bg-white border border-slate-100 rounded-[2rem] flex items-center justify-center text-slate-200 mb-6 shadow-sm">
                            <Inbox size={40} />
                        </div>
                        <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">No Incidents Found</h3>
                        <p className="text-sm text-slate-500 font-medium max-w-xs mx-auto mt-2 italic">Refine your search parameters to view more data points.</p>
                    </div>
                )}
                </div>
                )}
            </div>
        </div>
    );
  }, [tickets, searchQuery]);

  const getPriorityStyle = (priority) => {
    const p = String(priority || '').toLowerCase();
    if (p === 'high' || p === 'critical') return 'text-red-600 bg-red-50 border-red-100';
    if (p === 'medium') return 'text-amber-600 bg-amber-50 border-amber-100';
    if (p === 'low') return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    return 'text-slate-500 bg-slate-50 border-slate-100'; // Default
  };

  const getConfidenceColor = (conf) => {
    if (conf >= 0.8) return 'bg-emerald-500';
    if (conf >= 0.5) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className='space-y-8 animate-in fade-in duration-700'>
      {/* 1. Header & Utility Bar */}
      <div className='flex flex-col md:flex-row md:items-end justify-between gap-6'>
        <div>
          <h1 className='text-3xl font-black text-slate-900 tracking-tight italic uppercase'>
            Ticket Management
          </h1>
          <p className='text-sm font-bold text-slate-400 mt-1 flex items-center gap-2'>
            <Activity size={14} className='text-indigo-500' /> {filteredTickets.length} tickets
            matching current filters.
          </p>
        </div>
      </div>

      {/* 2. Advanced Filtering Station */}
      <div className='bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl shadow-slate-200/50 space-y-6'>
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4'>
          {/* Search Field */}
          <div className='relative group lg:col-span-1'>
            <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors w-5 h-5' />
            <input
              type='text'
              placeholder='Search...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full bg-slate-50 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-sm font-bold focus:outline-none focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white transition-all text-slate-700 placeholder:text-slate-400'
            />
          </div>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            buttonClassName='w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-left flex justify-between items-center'
            options={statuses.map((s) => ({ value: s, label: s === 'All' ? 'All Statuses' : s }))}
          />

          {/* Category Filter */}
          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            buttonClassName='w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-left flex justify-between items-center'
            options={categories.map((c) => ({
              value: c,
              label: c === 'All' ? 'All Categories' : c,
            }))}
          />

          {/* Priority Filter */}
          <Select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            buttonClassName='w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-left flex justify-between items-center'
            options={priorities.map((p) => ({
              value: p,
              label: p === 'All' ? 'All Priorities' : p,
            }))}
          />

          {/* Team Filter */}
          <Select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            buttonClassName='w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-600 focus:outline-none focus:ring-4 focus:ring-emerald-500/5 transition-all text-left flex justify-between items-center'
            options={teams.map((t) => ({ value: t, label: t === 'All' ? 'All Teams' : t }))}
          />
        </div>
      </div>

      {/* 3. High-Density Data Terminal */}
      <div className='bg-white rounded-[2rem] border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden relative min-h-[400px]'>
        {loading && (
          <div className='absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center'>
            <Loader2 className='w-10 h-10 text-emerald-600 animate-spin' />
          </div>
        )}

        {error && (
          <div className='p-12 text-center text-red-500 space-y-4'>
            <AlertCircle className='mx-auto w-12 h-12' />
            <p className='font-bold uppercase tracking-widest text-xs'>{error}</p>
            <button
              onClick={fetchTickets}
              className='px-6 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest'
            >
              Retry
            </button>
          </div>
        )}

        <div className='overflow-x-auto'>
          <table className='w-full border-collapse'>
            <thead>
              <tr className='bg-slate-50/80 border-b border-slate-100'>
                <th className='px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest'>
                  <div className='flex items-center gap-2'>
                    ID
                    <div className='w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse'></div>
                  </div>
                </th>
                <th className='px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest'>
                  User
                </th>
                <th className='px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest'>
                  Subject
                </th>
                <th className='px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest'>
                  Priority
                </th>
                <th className='px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest'>
                  AI Score
                </th>
                <th className='px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest'>
                  Agent
                </th>
                <th className='px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest'>
                  Status
                </th>
                <th className='px-6 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest'>
                  SLA
                </th>
                <th className='px-6 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest'>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className='divide-y divide-slate-50'>
              {filteredTickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className={`hover:bg-slate-50/50 transition-colors group ${isUpdating === ticket.id ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  {/* Ticket ID */}
                  <td className='px-6 py-6'>
                    <span className='font-mono text-xs font-black text-emerald-600'>
                      #{formatTicketId(ticket.id)}
                    </span>
                  </td>

                  {/* User (Joined with Profiles) */}
                  <td className='px-6 py-6'>
                    <div className='flex items-center gap-3'>
                      {ticket.creator?.profile_picture || ticket.profiles?.profile_picture ? (
                        <img
                          src={ticket.creator?.profile_picture || ticket.profiles?.profile_picture}
                          alt={ticket.creator?.full_name || ticket.profiles?.full_name || 'User'}
                          className='w-8 h-8 rounded-lg object-cover border border-slate-100 shadow-sm'
                        />
                      ) : (
                        <div className='w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs border border-emerald-100/50'>
                          {(ticket.creator?.full_name || ticket.profiles?.full_name || 'System')
                            .charAt(0)
                            .toUpperCase()}
                        </div>
                      )}
                      <div className='flex flex-col'>
                        <span className='text-xs font-black text-slate-800 tracking-tight italic uppercase truncate max-w-[120px]'>
                          {ticket.creator?.full_name || ticket.profiles?.full_name || 'System'}
                        </span>
                        <span className='text-[10px] font-bold text-slate-400 lowercase truncate max-w-[120px]'>
                          {ticket.creator?.email || ticket.profiles?.email || '—'}
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Subject */}
                  <td className='px-6 py-6'>
                    <div className='flex flex-col'>
                      <span
                        className='text-xs font-bold text-slate-700 truncate max-w-[200px]'
                        title={ticket.summary || ticket.subject}
                      >
                        {ticket.summary || ticket.subject}
                      </span>
                      <span className='text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2'>
                        {ticket.category}
                        <span className='text-[9px] font-medium text-slate-300'>
                          • {formatTimelineDate(ticket.created_at)}
                        </span>
                      </span>
                    </div>
                  </td>

                  {/* Priority (Editable) */}
                  <td className='px-6 py-6'>
                    <select
                      value={String(ticket.priority || 'medium').toLowerCase()}
                      onChange={(e) => handleUpdateTicket(ticket.id, { priority: e.target.value })}
                      className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider border outline-none cursor-pointer transition-all flex items-center justify-between ${getPriorityStyle(ticket.priority)}`}
                    >
                      {priorities
                        .filter((p) => p !== 'All')
                        .map((p) => (
                          <option key={p} value={p.toLowerCase()}>
                            {p}
                          </option>
                        ))}
                    </select>
                  </td>

                  {/* AI Score (Confidence) */}
                  <td className='px-6 py-6'>
                    <div className='flex items-center gap-2'>
                      <div
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[8px] font-black
                                                ${
                                                  ticket.confidence >= 0.8
                                                    ? 'border-emerald-500 text-emerald-600 bg-emerald-50'
                                                    : ticket.confidence >= 0.5
                                                      ? 'border-amber-500 text-amber-600 bg-amber-50'
                                                      : 'border-red-500 text-red-600 bg-red-50'
                                                }`}
                      >
                        {(ticket.confidence * 100).toFixed(0)}%
                      </div>
                      <div className='flex flex-col'>
                        <span className='text-[8px] font-black text-slate-400 uppercase'>
                          Confidence
                        </span>
                        <div className='w-12 h-1 bg-slate-100 rounded-full overflow-hidden mt-0.5'>
                          <div
                            className={`h-full ${getConfidenceColor(ticket.confidence || 0)}`}
                            style={{ width: `${(ticket.confidence || 0) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Assigned Team (Editable) */}
                  <td className='px-6 py-6 text-emerald-600 font-bold text-[10px]'>
                    {ticket.assigned_team || 'General'}
                  </td>

                  {/* Agent Assignee (Editable) */}
                  <td className='px-6 py-6'>
                    <div className='flex flex-col gap-1 min-w-[120px]'>
                      {ticket.assigned_agent_id ? (
                        <select
                          value={ticket.assigned_agent_id}
                          onChange={(e) =>
                            handleUpdateTicket(ticket.id, {
                              assigned_agent_id: e.target.value,
                              status: 'in progress',
                            })
                          }
                          className='bg-transparent text-[10px] font-black text-indigo-600 uppercase tracking-tight italic border-none focus:ring-0 cursor-pointer hover:underline'
                        >
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.full_name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <button
                          onClick={() =>
                            handleUpdateTicket(ticket.id, {
                              assigned_agent_id: user.id,
                              status: 'in progress',
                            })
                          }
                          className='px-3 py-1 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all shadow-sm'
                        >
                          Claim
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Status (Editable) */}
                  <td className='px-6 py-6'>
                    <div className='flex items-center gap-2'>
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${ticket.status?.toLowerCase() === 'resolved' || ticket.status?.toLowerCase() === 'closed' ? 'bg-emerald-400' : 'bg-amber-500 animate-pulse'}`}
                      ></div>
                      <Select
                        value={String(ticket.status || 'open').toLowerCase()}
                        onChange={(e) => handleUpdateTicket(ticket.id, { status: e.target.value })}
                        buttonClassName='bg-transparent text-[10px] font-black text-slate-600 uppercase tracking-widest outline-none cursor-pointer flex justify-between items-center w-full'
                        options={statuses
                          .filter((s) => s !== 'All')
                          .map((s) => ({ value: s.toLowerCase(), label: s }))}
                      />
                    </div>
                  </td>

                  {/* SLA Badge */}
                  <td className='px-6 py-6'>
                    <SLABadge
                      priority={ticket.priority}
                      createdAt={ticket.created_at}
                      status={ticket.status}
                    />
                  </td>

                  {/* Action: Open Ticket */}
                  <td className='px-6 py-6 text-center'>
                    <div className='flex items-center justify-center gap-2'>
                      <button
                        onClick={() => navigate(`/admin/ticket/${ticket.id}`)}
                        className='p-2 bg-slate-900 text-white rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-slate-900/10 hover:shadow-emerald-500/20'
                        title='Open Detailed View'
                      >
                        <ArrowUpRight size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && filteredTickets.length === 0 && (
          <div className='py-32 text-center bg-slate-50/30 w-full flex flex-col items-center'>
            <div className='w-20 h-20 bg-white border border-slate-100 rounded-[2rem] flex items-center justify-center text-slate-200 mb-6 shadow-sm'>
              <Inbox size={40} />
            </div>
            <h3 className='text-xl font-black text-slate-900 uppercase italic tracking-tight'>
              No Incidents Found
            </h3>
            <p className='text-sm text-slate-500 font-medium max-w-xs mx-auto mt-2 italic'>
              Refine your search parameters to view more data points.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTickets;