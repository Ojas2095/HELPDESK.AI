import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronUp } from 'lucide-react';

const BackToTop = () => {
    const [isVisible, setIsVisible] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const handleScroll = () => {
            const path = location.pathname;
            let scrolled = 0;

            if (path.startsWith('/admin')) {
                const adminMain = document.getElementById('admin-main-content');
                if (adminMain) {
                    scrolled = adminMain.scrollTop;
                } else {
                    scrolled = window.scrollY;
                }
            } else if (path.startsWith('/master-admin')) {
                const masterAdminMain = document.getElementById('master-admin-content');
                if (masterAdminMain) {
                    scrolled = masterAdminMain.scrollTop;
                } else {
                    scrolled = window.scrollY;
                }
            } else {
                scrolled = window.scrollY;
            }

            setIsVisible(scrolled > 300);
        };

        // Use capture phase to listen to all scroll events in the document
        document.addEventListener('scroll', handleScroll, true);
        
        // Initial run to check position
        handleScroll();

        return () => {
            document.removeEventListener('scroll', handleScroll, true);
        };
    }, [location.pathname]);

    const scrollToTop = () => {
        const path = location.pathname;
        let scrollTarget = window;

        if (path.startsWith('/admin')) {
            const adminMain = document.getElementById('admin-main-content');
            if (adminMain) scrollTarget = adminMain;
        } else if (path.startsWith('/master-admin')) {
            const masterAdminMain = document.getElementById('master-admin-content');
            if (masterAdminMain) scrollTarget = masterAdminMain;
        }

        scrollTarget.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.5, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.5, y: 15 }}
                    whileHover={{ scale: 1.1, translateY: -2 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={scrollToTop}
                    className="fixed bottom-6 right-6 z-[9999] w-11 h-11 rounded-full
                               bg-white/85 dark:bg-gray-800/85 backdrop-blur-md
                               border border-slate-200/50 dark:border-gray-700/50
                               text-emerald-600 dark:text-emerald-400
                               shadow-lg hover:shadow-emerald-500/20 hover:border-emerald-500/30
                               flex items-center justify-center
                               focus:outline-none transition-all cursor-pointer"
                    title="Back to Top"
                    aria-label="Back to Top"
                >
                    <ChevronUp className="w-5 h-5 stroke-[2.5]" />
                </motion.button>
            )}
        </AnimatePresence>
    );
};

export default BackToTop;
