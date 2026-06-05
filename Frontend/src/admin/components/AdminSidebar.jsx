import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Inbox,
    Users,
    BarChart3,
    UserCircle,
    Settings,
    LogOut,
    Activity,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import useAuthStore from '../../store/authStore';

const AdminSidebar = ({ isMobile, onClose, isCollapsed, onToggleCollapse }) => {
    const navItems = [
        { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
        { label: 'Tickets', path: '/admin/tickets', icon: Inbox },
        { label: 'Users', path: '/admin/users', icon: Users },
        { label: 'Analytics', path: '/admin/analytics', icon: BarChart3 },
        { label: 'Profile', path: '/admin/profile', icon: UserCircle },
    ];

    const { logout } = useAuthStore();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const showLabels = isMobile || !isCollapsed;

    return (
        <aside 
            className={`${isMobile ? 'w-full h-full' : 'fixed left-0 top-0 h-full'} bg-white dark:bg-slate-900 border-r border-gray-100 dark:border-slate-800 shadow-md z-40 transition-all duration-300 overflow-hidden flex flex-col`}
            style={{
                width: isMobile ? '100%' : (isCollapsed ? '80px' : '260px'),
            }}
        >
            {/* Logo Section */}
            <div className="p-6 border-b border-gray-50 dark:border-slate-800 flex items-center" style={{ justifyContent: showLabels ? 'space-between' : 'center', padding: isCollapsed && !isMobile ? '24px 16px' : '24px 32px' }}>
                <div className="flex items-center gap-3">
                    <img 
                        src="/favicon.png" 
                        alt="HelpDesk.ai Logo" 
                        style={{ 
                            height: '32px', 
                            width: '32px',
                            objectFit: 'contain',
                        }} 
                    />
                    {showLabels && (
                        <div className="animate-in fade-in duration-500 flex flex-col justify-center">
                            <p className="text-[10px] text-gray-500 dark:text-slate-400 font-bold uppercase tracking-[0.2em]">Admin Console</p>
                        </div>
                    )}
                </div>
                {!isMobile && onToggleCollapse && (
                    <button
                        onClick={onToggleCollapse}
                        style={{
                            position: isCollapsed ? 'absolute' : 'relative',
                            right: isCollapsed ? '-12px' : 'auto',
                            top: isCollapsed ? '28px' : 'auto',
                        }}
                        className="bg-[#f0fdf4] dark:bg-emerald-950/30 border border-[#d1fae5] dark:border-emerald-900/50 rounded-lg p-1 cursor-pointer text-[#15803d] dark:text-emerald-400 flex items-center justify-center transition-all duration-200 z-50 shadow-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                    >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                )}
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-3 py-8 space-y-1.5 overflow-y-auto custom-scrollbar">
                {showLabels && (
                    <p style={{ fontSize: '10px', letterSpacing: '0.14em', fontWeight: 600, paddingLeft: '14px', marginBottom: '16px' }} className="text-gray-400 dark:text-slate-500 uppercase">
                        CORE MODULES
                    </p>
                )}
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={isMobile ? onClose : undefined}
                        style={{
                            justifyContent: isCollapsed && !isMobile ? 'center' : 'flex-start'
                        }}
                        className={({ isActive }) => 
                            `flex items-center gap-3 rounded-xl transition-all duration-200 group relative ${
                                isCollapsed && !isMobile ? 'p-2.5' : 'px-3.5 py-2'
                            } ${
                                isActive 
                                ? 'bg-[#f0fdf4] dark:bg-emerald-950/30 text-[#15803d] dark:text-emerald-400 font-bold' 
                                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white font-medium'
                            }`
                        }
                    >
                        <item.icon size={20} className="shrink-0 transition-transform group-hover:scale-110" />
                        {showLabels && (
                            <span className="text-sm tracking-tight truncate animate-in fade-in slide-in-from-left-2 duration-300">
                                {item.label}
                            </span>
                        )}
                        {/* Tooltip for collapsed mode */}
                        {isCollapsed && !isMobile && (
                            <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white text-xs py-1.5 px-3 rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap shadow-lg">
                                {item.label}
                            </div>
                        )}
                    </NavLink>
                ))}
            </nav>

            {/* Bottom Profile / Logout Shortcut */}
            <div className="p-4 border-t border-gray-50 dark:border-slate-800 space-y-1.5 pb-8 flex flex-col items-stretch">
                <NavLink
                    to="/admin/settings"
                    onClick={isMobile ? onClose : undefined}
                    style={{
                        justifyContent: isCollapsed && !isMobile ? 'center' : 'flex-start'
                    }}
                    className={({ isActive }) => 
                        `flex items-center gap-3 rounded-xl transition-all duration-200 group relative ${
                            isCollapsed && !isMobile ? 'p-2.5' : 'px-3.5 py-2'
                        } ${
                            isActive 
                            ? 'bg-[#f0fdf4] dark:bg-emerald-950/30 text-[#15803d] dark:text-emerald-400 font-bold' 
                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-white font-medium'
                        }`
                    }
                >
                    <Settings size={20} className="shrink-0 group-hover:rotate-45 transition-transform duration-300" />
                    {showLabels && <span className="text-sm tracking-tight animate-in fade-in duration-300">Settings</span>}
                </NavLink>

                <button
                    onClick={handleLogout}
                    style={{
                        justifyContent: isCollapsed && !isMobile ? 'center' : 'flex-start'
                    }}
                    className={`flex items-center gap-3 rounded-xl transition-all duration-200 group cursor-pointer w-full text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-600 dark:hover:text-red-400 font-medium ${
                        isCollapsed && !isMobile ? 'p-2.5' : 'px-3.5 py-2'
                    }`}
                >
                    <LogOut size={20} className="shrink-0 group-hover:translate-x-1 transition-transform" />
                    {showLabels && <span className="text-sm tracking-tight animate-in fade-in duration-300">Logout</span>}
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
