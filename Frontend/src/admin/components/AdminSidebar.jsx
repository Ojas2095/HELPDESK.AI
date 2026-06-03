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
            className={`${isMobile ? 'w-full h-full' : 'fixed left-0 top-0 h-full'} z-40 transition-all duration-300 overflow-hidden flex flex-col bg-white border-r border-green-50 shadow-[2px_0_12px_rgba(0,0,0,0.04)]`}
            style={{ width: isMobile ? '100%' : (isCollapsed ? '80px' : '260px') }}
        >
            {/* Logo Section */}
            <div className={`p-6 border-b border-gray-50 flex items-center ${showLabels ? 'justify-between' : 'justify-center'} ${isCollapsed && !isMobile ? 'py-6 px-4' : 'py-6 px-8'}`}>
                <div className="flex items-center gap-3">
                    <img 
                        src="/favicon.png" 
                        alt="HelpDesk.ai Logo" 
                        className={`h-8 object-contain ${showLabels ? 'w-auto rounded-none' : 'w-8 rounded-lg'}`}
                    />
                    {showLabels && (
                        <div className="animate-in fade-in duration-500 flex flex-col justify-center">
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Admin Console</p>
                        </div>
                    )}
                </div>
                {!isMobile && onToggleCollapse && (
                    <button
                        onClick={onToggleCollapse}
                        className={`bg-green-50 border border-green-100 rounded-lg p-1 cursor-pointer text-green-700 flex items-center justify-center transition-all duration-200 hover:bg-green-100 z-50 shadow-sm ${isCollapsed ? 'absolute -right-3 top-7' : 'relative'}`}
                    >
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    </button>
                )}
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 px-3 py-8 space-y-1.5 overflow-y-auto custom-scrollbar">
                {showLabels && (
                    <p className="text-[10px] tracking-[0.14em] text-gray-400 font-semibold pl-3.5 mb-4 uppercase">
                        CORE MODULES
                    </p>
                )}
                {navItems.map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={isMobile ? onClose : undefined}
                        className={({ isActive }) => 
                            `group relative flex items-center gap-3 rounded-xl transition-all duration-200 no-underline hover:bg-gray-50 ` +
                            `${isCollapsed && !isMobile ? 'p-2.5 justify-center' : 'py-2 px-3.5 justify-start'} ` +
                            `${isActive ? 'text-green-700 bg-green-50 font-semibold' : 'text-gray-500 bg-transparent font-medium'}`
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
            <div className="p-4 border-t border-gray-50 space-y-1.5 pb-8 flex flex-col items-stretch">
                <NavLink
                    to="/admin/settings"
                    onClick={isMobile ? onClose : undefined}
                    className={({ isActive }) => 
                        `group flex items-center gap-3 rounded-xl transition-all duration-200 no-underline hover:bg-gray-50 ` +
                        `${isCollapsed && !isMobile ? 'p-2.5 justify-center' : 'py-2 px-3.5 justify-start'} ` +
                        `${isActive ? 'text-green-700 bg-green-50 font-semibold' : 'text-gray-500 bg-transparent font-medium'}`
                    }
                >
                    <Settings size={20} className="shrink-0 group-hover:rotate-45 transition-transform duration-300" />
                    {showLabels && <span className="text-sm tracking-tight animate-in fade-in duration-300">Settings</span>}
                </NavLink>

                <button
                    onClick={handleLogout}
                    className={`group flex items-center gap-3 rounded-xl transition-all duration-200 w-full hover:bg-red-50 hover:text-red-600 text-gray-500 bg-transparent font-medium border-none cursor-pointer ` +
                               `${isCollapsed && !isMobile ? 'p-2.5 justify-center' : 'py-2 px-3.5 justify-start'}`}
                >
                    <LogOut size={20} className="shrink-0 group-hover:translate-x-1 transition-transform" />
                    {showLabels && <span className="text-sm tracking-tight animate-in fade-in duration-300">Logout</span>}
                </button>
            </div>
        </aside>
    );
};

export default AdminSidebar;
