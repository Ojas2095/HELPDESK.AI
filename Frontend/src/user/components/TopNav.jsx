import React, { useState } from 'react';
import { Box, MessageSquare, Menu, X, LogOut, User as UserIcon, BookOpen, ChevronRight, HelpCircle } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import ThemeToggle from '../../components/ThemeToggle';
import NotificationPopover from "./NotificationPopover";
import useAuthStore from "../../store/authStore";

const TopNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { profile, logout } = useAuthStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const initials = profile?.full_name 
        ? profile.full_name[0].toUpperCase() 
        : (profile?.email ? profile.email[0].toUpperCase() : 'U');

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const navLinks = [
        { name: 'Dashboard', path: '/dashboard', icon: Box },
        { name: 'My Tickets', path: '/my-tickets', icon: MessageSquare },
        { name: 'Help', path: '/help', icon: HelpCircle },
        { name: 'Docs', path: '/docs', icon: BookOpen },
    ];

    const isActive = (path) => location.pathname === path;

    return (
        <header className="w-full bg-slate-950 border-b border-white/[0.05] sticky top-0 z-50 backdrop-blur-xl">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                
                {/* Left: Branding Identity */}
                <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/dashboard')}>
                    <div className="relative">
                        <img src="/favicon.png" alt="H" className="w-7 h-7 object-contain relative z-10" />
                        <div className="absolute inset-0 bg-emerald-500/20 blur-lg rounded-full group-hover:bg-emerald-500/40 transition-colors" />
                    </div>
                    <h1 className="text-xl font-black tracking-tighter text-white font-syne italic uppercase">
                        HelpDesk<span className="text-emerald-500">.ai</span>
                    </h1>
                </div>

                {/* Center: Logic-driven Navigation Nodes */}
                <nav className="hidden md:flex items-center gap-1">
                    {navLinks.map((link) => (
                        <Link 
                            key={link.path}
                            to={link.path}
                            className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-all rounded-lg ${
                                isActive(link.path) 
                                    ? 'text-emerald-400 bg-emerald-500/5' 
                                    : 'text-slate-500 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {link.name}
                        </Link>
                    ))}
                </nav>

                {/* Right: Operational Telemetry & Profile */}
                <div className="flex items-center gap-2 sm:gap-4">
                    <NotificationPopover />
                    
                    <div className="h-6 w-px bg-white/[0.08] hidden sm:block" />

                    <div className="hidden md:block">
                        <Avatar
                            onClick={() => navigate('/profile')}
                            className="size-9 border border-white/10 cursor-pointer hover:border-emerald-500/50 transition-all ring-offset-slate-950 hover:ring-2 hover:ring-emerald-500/20"
                        >
                            <AvatarImage src={profile?.profile_picture} />
                            <AvatarFallback className="bg-slate-950 font-black text-emerald-400 text-[10px] uppercase">
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                    </div>

                    {/* Mobile Command Trigger */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden p-2 text-slate-400 hover:text-white transition-colors bg-transparent border-none cursor-pointer"
                    >
                        {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </div>

            {/* Mobile Interface Matrix Overlay */}
            <AnimatePresence>
                {isMenuOpen && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="md:hidden bg-slate-950 border-t border-white/[0.05] absolute w-full shadow-2xl z-50 overflow-hidden"
                    >
                        <div className="px-6 py-8 space-y-8">
                            {/* User Context Node */}
                            <div className="flex items-center gap-4 border-b border-white/[0.05] pb-8">
                                <Avatar className="size-14 border border-white/10 shadow-xl">
                                    <AvatarImage src={profile?.profile_picture} />
                                    <AvatarFallback className="bg-emerald-500/10 text-emerald-400 font-black text-xl">
                                        {initials}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-0.5">
                                    <p className="font-black text-white tracking-tight font-syne uppercase text-sm">{profile?.full_name}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{profile?.email}</p>
                                </div>
                            </div>

                            {/* Nav Matrix Map */}
                            <div className="grid grid-cols-1 gap-2">
                                {[...navLinks, { name: 'My Profile', path: '/profile', icon: UserIcon }].map((link) => (
                                    <Link
                                        key={link.path}
                                        to={link.path}
                                        onClick={() => setIsMenuOpen(false)}
                                        className={`flex items-center justify-between p-4 rounded-2xl transition-all group border ${
                                            isActive(link.path) 
                                                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                                : 'bg-white/[0.02] border-white/[0.03] text-slate-400 hover:border-white/10 hover:text-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <link.icon size={18} className={isActive(link.path) ? 'text-emerald-400' : 'text-slate-500'} />
                                            <span className="text-xs font-black uppercase tracking-[0.2em]">{link.name}</span>
                                        </div>
                                        <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Link>
                                ))}
                            </div>

                            {/* Termination Action */}
                            <div className="pt-6 border-t border-white/[0.05]">
                                <button
                                    onClick={handleLogout}
                                    className="w-full h-14 bg-rose-500/5 hover:bg-rose-500/10 border border-rose-500/10 rounded-2xl flex items-center justify-center gap-3 text-rose-500 font-black uppercase tracking-[0.3em] text-[10px] transition-all active:scale-[0.98] cursor-pointer"
                                >
                                    <LogOut size={16} /> Termination Session
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
};

export default TopNav;

