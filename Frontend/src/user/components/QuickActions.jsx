import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Network, Laptop, ShieldCheck, ArrowRight } from "lucide-react";

const actions = [
    {
        title: "Network Issues",
        description: "Connectivity problems, VPN access, and slow internet.",
        category: "Network",
        icon: Network,
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        hoverColor: "group-hover:border-emerald-500/40",
    },
    {
        title: "Software Problems",
        description: "Application crashes, license issues, and installations.",
        category: "Software",
        icon: Laptop,
        color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        hoverColor: "group-hover:border-blue-500/40",
    },
    {
        title: "Access Requests",
        description: "Permission changes, new account setup, and MFA.",
        category: "Access",
        icon: ShieldCheck,
        color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
        hoverColor: "group-hover:border-purple-500/40",
    }
];

const QuickActions = () => {
    const navigate = useNavigate();

    const handleActionClick = (category) => {
        navigate("/create-ticket", { state: { prefilledCategory: category } });
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full text-left">
            {actions.map((action, index) => (
                <motion.div
                    key={index}
                    whileHover={{ scale: 1.04, y: -4, boxShadow: "0 25px 30px -10px rgba(0,0,0,0.5)" }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    onClick={() => handleActionClick(action.category)}
                    className="w-full"
                >
                    <div className="group flex flex-col justify-between p-8 bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-white/[0.08] shadow-sm dark:shadow-none hover:border-emerald-500/50 dark:hover:border-emerald-500/30 w-full min-h-[250px] cursor-pointer transition-colors relative overflow-hidden">
                        <div>
                            {/* Graphic Node Icon */}
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 border border-transparent transition-colors ${action.color} ${action.hoverColor}`}>
                                <action.icon size={20} />
                            </div>

                            {/* Content Block */}
                            <h3 className="text-lg font-black text-slate-900 dark:text-white mb-2 tracking-tight font-syne uppercase">
                                {action.title}
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium leading-relaxed m-0">
                                {action.description}
                            </p>
                        </div>

                        {/* Interactive Footer Navigation Trigger */}
                        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-6 pt-4 border-t border-slate-100 dark:border-white/5 w-full">
                            <span>Start Request</span>
                            <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    );
};

export default QuickActions;
