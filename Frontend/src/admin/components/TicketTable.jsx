import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Clock, ExternalLink } from 'lucide-react';
import { formatTimelineDate } from '../../utils/dateUtils';

const categoryDotColors = {
    'Hardware': 'bg-orange-500',
    'Network': 'bg-blue-500',
    'Access': 'bg-purple-500',
    'Software': 'bg-green-600',
    'Human Resources': 'bg-pink-500',
    'Other': 'bg-gray-500'
};

const TicketTable = ({ tickets = [], isLoading = false, limit = null }) => {
    const navigate = useNavigate();

    const teamMap = {
        'Network': 'Network Services', 'Hardware': 'IT Inventory', 'Software': 'Cloud Apps Team',
        'Access': 'Security Ops', 'Human Resources': 'HR Systems', 'Other': 'IT Service Desk'
    };

    const getPriorityStyle = (priority) => {
        const p = priority?.toLowerCase();
        if (p === 'critical') return 'bg-red-50 text-red-600 border border-red-200';
        if (p === 'high') return 'bg-orange-50 text-orange-600 border border-orange-200';
        if (p === 'medium') return 'bg-yellow-50 text-yellow-600 border border-yellow-200';
        return 'bg-green-50 text-green-600 border border-green-200';
    };

    const getStatusStyle = (status) => {
        const s = status?.toLowerCase() || '';
        if (s.includes('resolv')) return 'bg-slate-100 text-slate-500 border border-slate-200';
        if (s.includes('progress')) return 'bg-blue-50 text-blue-600 border border-blue-200';
        return 'bg-amber-50 text-amber-600 border border-amber-200';
    };

    const displayTickets = limit ? tickets.slice(0, limit) : tickets;

    if (isLoading) return (
        <div className="py-24 text-center">
            <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-[0.1em]">Synchronizing System Data...</p>
        </div>
    );

    if (displayTickets.length === 0) return (
        <div className="py-24 text-center border-2 border-dashed border-gray-200 rounded-2xl m-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 text-green-200">
                <ShieldCheck size={32} />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-1">No Active Tickets</h3>
            <p className="text-[13px] text-gray-500">All systems green. No tickets require review.</p>
        </div>
    );

    return (
        <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full border-collapse">
                <thead>
                    <tr className="bg-slate-50 border-b border-green-50">
                        {['Ticket ID', 'Ticket Info', 'Category', 'Priority', 'Assigned Team', 'Status'].map((h, i) => (
                            <th key={i} className="py-3.5 px-6 text-left text-[10px] text-gray-400 tracking-[0.1em] font-semibold uppercase">
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {displayTickets.map((ticket) => {
                        const effectiveCategory = ticket.correction?.corrected_category || ticket.category;
                        const effectiveSubcategory = ticket.correction?.corrected_subcategory || ticket.subcategory;
                        const effectivePriority = ticket.correction?.corrected_priority || ticket.priority;
                        const effectiveTeam = ticket.reassigned_at
                            ? ticket.assigned_team
                            : (teamMap[effectiveCategory] || ticket.assigned_team || 'L1 Helpdesk');
                        const statusSt = getStatusStyle(ticket.status);

                        const subject = ticket.subject || ticket.summary || 'Untitled ticket';
                        const truncSubject = subject.length > 28 ? subject.slice(0, 28) + '...' : subject;

                        const tid = ticket.ticket_id || ticket.id || '';
                        const truncId = tid.length > 8 ? tid.slice(0, 8) + '...' : tid;

                        const userProfile = ticket.creator || ticket.profiles;
                        const userName = userProfile?.full_name || ticket.user_name || 'User';
                        const initial = userName.charAt(0).toUpperCase();
                        const profilePic = userProfile?.profile_picture;

                        return (
                            <tr
                                key={ticket.ticket_id || ticket.id}
                                onClick={() => navigate(`/admin/ticket/${ticket.ticket_id || ticket.id}`)}
                                className="cursor-pointer group transition-colors hover:bg-green-50 border-b border-gray-50"
                            >
                                {/* Request Identity */}
                                <td className="py-3.5 px-6">
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-[11px] font-bold text-green-600">#{truncId}</span>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400">
                                                <ExternalLink size={12} />
                                            </div>
                                        </div>
                                        <span className="text-[11px] text-gray-400 flex items-center gap-1">
                                            <Clock size={10} className="text-gray-300" />
                                            {formatTimelineDate(ticket.created_at || ticket.createdAt || ticket.timestamp)}
                                        </span>
                                    </div>
                                </td>

                                {/* Incident Context */}
                                <td className="py-3.5 px-6">
                                    <div className="flex items-center gap-3">
                                        {profilePic ? (
                                            <img
                                                src={profilePic}
                                                alt={userName}
                                                className="w-8 h-8 rounded-full object-cover border border-green-100 shrink-0"
                                            />
                                        ) : (
                                            <div className="w-8 h-8 bg-green-50 border border-green-100 rounded-full flex items-center justify-center shrink-0">
                                                <span className="text-green-600 text-xs font-semibold">{initial}</span>
                                            </div>
                                        )}
                                        <div className="flex flex-col max-w-[220px]">
                                            <span className="text-[13px] font-medium text-gray-900 overflow-hidden text-ellipsis whitespace-nowrap">
                                                {truncSubject}
                                            </span>
                                            <span className="text-[11px] text-gray-500">
                                                {effectiveCategory || 'General'}
                                            </span>
                                        </div>
                                    </div>
                                </td>

                                {/* Category */}
                                <td className="py-3.5 px-6">
                                    <div className="flex flex-col gap-1">
                                        <span className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5 text-[11px] font-semibold text-slate-600 tracking-wide uppercase w-fit">
                                            <span className={`w-1 h-1 rounded-full ${categoryDotColors[effectiveCategory] || 'bg-gray-500'} inline-block`}></span>
                                            {effectiveCategory}
                                        </span>
                                        {effectiveSubcategory && <span className="text-[10px] text-gray-400 ml-1">{effectiveSubcategory}</span>}
                                    </div>
                                </td>

                                {/* Priority */}
                                <td className="py-3.5 px-6">
                                    <span className={`${getPriorityStyle(effectivePriority)} py-0.5 px-3 rounded-full text-[11px] font-bold uppercase tracking-wider inline-block`}>
                                        {effectivePriority || 'NORMAL'}
                                    </span>
                                </td>

                                {/* Assigned Team */}
                                <td className="py-3.5 px-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center border border-green-100">
                                            <span className="text-[10px] font-bold text-green-600">{effectiveTeam?.charAt(0)}</span>
                                        </div>
                                        <span className="text-xs font-medium text-gray-700 whitespace-nowrap">{effectiveTeam}</span>
                                    </div>
                                </td>

                                {/* Status */}
                                <td className="py-3.5 px-6">
                                    <span className={`inline-flex items-center gap-1.5 py-1 px-3 rounded-full text-[10px] font-bold uppercase ${statusSt}`}>
                                        <span className={`w-1.5 h-1.5 rounded-full bg-current ${ticket.status?.includes('Resolv') ? 'opacity-40' : 'opacity-100'}`}></span>
                                        {ticket.status?.replace('by Human Support', '').trim()}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default TicketTable;
