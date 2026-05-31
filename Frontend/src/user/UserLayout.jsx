import React from 'react';
import { Outlet } from 'react-router-dom';
import TopNav from './components/TopNav';
import NotificationToast from './components/NotificationToast';

const UserLayout = () => {
    return (
        <div className="bg-white dark:bg-slate-900 min-h-screen flex flex-col text-slate-900 dark:text-slate-200 transition-colors duration-300 antialiased font-sans selection:bg-emerald-500/30">
            {/* Top Navigation Bar */}
            <TopNav />
            
            {/* The routed content (Dashboard, CreateTicket, etc.) will render here */}
            <main className="flex-1 w-full relative z-0">
                <Outlet />
            </main>

            {/* Global real-time notifications system */}
            <NotificationToast />
        </div>
    );
};

export default UserLayout;