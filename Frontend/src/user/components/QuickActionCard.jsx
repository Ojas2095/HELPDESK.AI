import React from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

const QuickActionCard = ({ icon: Icon, title, description, colorClass }) => {
    const navigate = useNavigate();

    return (
        <motion.div
            whileHover={{ scale: 1.05, y: -5, boxShadow: '0 25px 30px -10px rgba(0,0,0,0.5)' }}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="w-full"
        >
            <Card
                onClick={() => navigate('/create-ticket')}
                className="group flex flex-col items-start p-6 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-none hover:border-emerald-500/50 dark:hover:border-emerald-500/30 text-left w-full cursor-pointer transition-colors relative overflow-hidden"
            >
                <div className={`size-12 rounded-xl border border-transparent flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <h4 className="text-lg font-black text-slate-900 dark:text-white mb-1 tracking-tight font-syne uppercase">
                    {title}
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed m-0">
                    {description}
                </p>
            </Card>
        </motion.div>
    );
};

export default QuickActionCard;
