import React from 'react';

import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';

const QuickActionCard = ({ icon: Icon, title, description, colorClass }) => {
  const navigate = useNavigate();

  return (
    <motion.div
      whileHover={{
        scale: 1.05,
        y: -5,
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <Card
        onClick={() => navigate('/create-ticket')}
        className='group flex flex-col items-start p-6 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-emerald-600/50 text-left w-full cursor-pointer transition-colors'
      >
        <div
          className={`size-12 rounded-lg ${colorClass} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
        >
            <Card
                onClick={() => navigate('/create-ticket')}
                className="group flex flex-col items-start p-6 bg-white dark:bg-slate-900 dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 dark:border-white/[0.08] shadow-sm dark:shadow-none hover:border-emerald-500/50 dark:hover:border-emerald-500/50 dark:hover:border-emerald-500/30 text-left w-full cursor-pointer transition-colors relative overflow-hidden"
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
