import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, User, ChevronDown, Settings, LogOut, UserCircle, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NotificationPopover from '../../user/components/NotificationPopover';
import useAuthStore from '../../store/authStore';
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import ThemeToggle from '../../components/shared/ThemeToggle';
import { supabase } from '../../lib/supabaseClient';

/**
 * AdminHeader Component
 * Refined 64px header for the administrative console.
 * Features a solid white background, specific search placeholder, 
 * and a functional avatar dropdown menu.
 */
const AdminHeader = ({ onMobileNavToggle, isSidebarCollapsed, onToggleSidebar }) => {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    
    const dropdownRef = useRef(null);
    const searchRef = useRef(null);
    const searchContainerRef = useRef(null);
    const navigate = useNavigate();
    
    const { logout, profile: adminProfile } = useAuthStore();
    const initials = adminProfile?.full_name ? adminProfile.full_name.split(' ').map(n => n[0]).join('').toUpperCase() : 'AD';

    // Debounced pg_trgm trigram global search implementation
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        setIsLoading(true);
        const delayDebounce = setTimeout(async () => {
            try {
                const query = searchQuery.trim();
                let dbQuery = supabase
                    .from('tickets')
                    .select('id, ticket_id, subject, description, category, status, priority, company_id')
                    .order('created_at', { ascending: false });

                // Filter by role and company_id
                if (adminProfile?.role !== 'master_admin' && adminProfile?.company_id) {
                    dbQuery = dbQuery.eq('company_id', adminProfile.company_id);
                }

                // Trigram search across subject, description, category, status, assigned_team, and ticket_id
                const orConditions = [
                    `subject.ilike.%${query}%`,
                    `description.ilike.%${query}%`,
                    `category.ilike.%${query}%`,
                    `status.ilike.%${query}%`,
                    `assigned_team.ilike.%${query}%`,
                    `ticket_id.ilike.%${query}%`
                ];
                
                dbQuery = dbQuery.or(orConditions.join(','));
                
                const { data, error } = await dbQuery.limit(8);
                
                if (error) {
                    console.error("[Search Error] Supabase query failed:", error);
                } else {
                    setSearchResults(data || []);
                }
            } catch (err) {
                console.error("[Search Error] Exception inside search query:", err);
            } finally {
                setIsLoading(false);
                setHighlightedIndex(-1);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(delayDebounce);
    }, [searchQuery, adminProfile]);

    const handleSearchKeyDown = (e) => {
        if (e.key === 'Enter') {
            if (highlightedIndex >= 0 && highlightedIndex < searchResults.length) {
                const selected = searchResults[highlightedIndex];
                navigate(`/admin/ticket/${selected.ticket_id || selected.id}`);
                setIsSearchFocused(false);
                setSearchQuery('');
            } else if (searchQuery.trim()) {
                navigate(`/admin/tickets?q=${encodeURIComponent(searchQuery.trim())}`);
                setIsSearchFocused(false);
                searchRef.current?.blur();
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => (searchResults.length ? (prev + 1) % searchResults.length : -1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => (searchResults.length ? (prev - 1 + searchResults.length) % searchResults.length : -1));
        } else if (e.key === 'Escape') {
            setSearchQuery('');
            setIsSearchFocused(false);
            searchRef.current?.blur();
        }
    };

    const handleSearchClear = () => {
        setSearchQuery('');
        setSearchResults([]);
        searchRef.current?.focus();
    };

    // Handle clicks outside of dropdowns to close them
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
                setIsSearchFocused(false);
            }
        };
        const handleCloseModals = () => setIsProfileOpen(false);

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('close-modals', handleCloseModals);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('close-modals', handleCloseModals);
        };
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 px-6 md:px-10 flex items-center justify-between transition-colors duration-200">
            <div className="flex items-center gap-4 flex-1">
                {/* Mobile Menu Toggle */}
                <button
                    onClick={onMobileNavToggle}
                    className="lg:hidden p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-500 dark:text-slate-400 transition-colors"
                >
                    <Menu size={20} />
                </button>

                {/* Desktop Sidebar Toggle */}
                {onToggleSidebar && (
                    <button
                        onClick={onToggleSidebar}
                        className="hidden md:flex p-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-xl text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all"
                        title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    >
                        {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                    </button>
                )}

                {/* Primary Search Terminal */}
                <div className="flex-1 max-w-xl relative hidden md:block" ref={searchContainerRef}>
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4 pointer-events-none" />
                    <input
                        id="admin-search-input"
                        ref={searchRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        onFocus={() => setIsSearchFocused(true)}
                        placeholder="Search tickets by title, description, category, status, assignee… (press Enter)"
                        className="w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl pl-11 pr-9 py-2 text-sm font-medium tracking-tight focus:outline-none focus:ring-4 focus:ring-emerald-600/5 focus:border-emerald-600 dark:focus:border-emerald-500 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-600 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                    />
                    {searchQuery && (
                        <button
                            onClick={handleSearchClear}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors"
                            tabIndex={-1}
                        >
                            <X size={14} />
                        </button>
                    )}

                    {/* Debounced Search Results Floating Dropdown Dropdown */}
                    {isSearchFocused && searchQuery.trim() && (
                        <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden z-50 py-2 max-h-[400px] overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center py-6 text-slate-400 text-xs font-bold gap-2">
                                    <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
                                    Searching tickets…
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="py-6 text-center text-slate-400 text-xs font-bold leading-normal">
                                    No tickets found matching "{searchQuery}"
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    <div className="px-4 py-1 text-[9px] font-black text-slate-400 dark:text-slate-500 tracking-wider uppercase border-b border-slate-50 dark:border-slate-800 mb-1">
                                        Matching Tickets ({searchResults.length})
                                    </div>
                                    {searchResults.map((ticket, idx) => {
                                        const isHighlighted = idx === highlightedIndex;
                                        return (
                                            <div
                                                key={ticket.id}
                                                onClick={() => {
                                                    navigate(`/admin/ticket/${ticket.ticket_id || ticket.id}`);
                                                    setIsSearchFocused(false);
                                                    setSearchQuery('');
                                                }}
                                                className={`flex flex-col px-4 py-2.5 cursor-pointer border-b border-slate-50 dark:border-slate-800 last:border-none transition-colors ${
                                                    isHighlighted ? 'bg-slate-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-emerald-600 dark:hover:text-emerald-400'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-2 mb-0.5">
                                                    <span className={`text-[10px] font-mono font-black ${isHighlighted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                        #{ticket.ticket_id || ticket.id.substring(0, 8)}
                                                    </span>
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                        ticket.priority === 'Critical' ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30' :
                                                        ticket.priority === 'High' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30' :
                                                        'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                                                    }`}>
                                                        {ticket.priority}
                                                    </span>
                                                </div>
                                                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight line-clamp-1">
                                                    {ticket.subject}
                                                </h4>
                                                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                                                    {ticket.description}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Header Operations */}
            <div className="flex items-center gap-4 lg:gap-6">
                <ThemeToggle />

                {/* Communications Hub */}
                <div className="relative border-r border-slate-200 dark:border-slate-850 pr-4 lg:pr-6 hidden sm:block">
                    <NotificationPopover isAdmin={true} />
                </div>

                {/* Identity Access & Dropdown */}
                <div className="relative" ref={dropdownRef}>
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-800 p-1 rounded-2xl border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all group cursor-pointer"
                    >
                        <Avatar className="w-8 h-8 rounded-lg shadow-md group-hover:scale-105 transition-transform">
                            <AvatarImage src={adminProfile?.profile_picture} className="object-cover" />
                            <AvatarFallback className="bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-300 font-black text-xs rounded-lg">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="hidden lg:block text-left">
                            <div className="flex items-center gap-1">
                                <p className="text-xs font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none italic uppercase">Admin</p>
                                <ChevronDown size={12} className={`text-slate-400 transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`} />
                            </div>
                        </div>
                    </button>

                    {/* Dropdown Menu */}
                    {isProfileOpen && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 py-2 animate-in fade-in zoom-in-95 duration-200">
                            <button
                                onClick={() => { navigate('/admin/profile'); setIsProfileOpen(false); }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                            >
                                <UserCircle size={16} /> Profile
                            </button>
                            <button
                                onClick={() => { navigate('/admin/settings'); setIsProfileOpen(false); }}
                                className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                            >
                                <Settings size={16} /> Settings
                            </button>
                            <div className="my-1 border-t border-slate-100 dark:border-slate-800"></div>
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                            >
                                <LogOut size={16} /> Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default AdminHeader;
