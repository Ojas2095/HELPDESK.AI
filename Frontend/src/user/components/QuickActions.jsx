import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Network, Laptop, ShieldCheck, ArrowRight } from "lucide-react";

const actions = [
    {
        title: "Network Issues",
        description: "Connectivity problems, VPN access, and slow internet.",
        category: "Network",
        templateId: "vpn-connectivity",
        icon: Network,
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        hoverColor: "group-hover:border-emerald-500/40",
    },
    {
        title: "Software Problems",
        description: "Application crashes, license issues, and installations.",
        category: "Software",
        templateId: "software-installation",
        icon: Laptop,
        color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
        hoverColor: "group-hover:border-blue-500/40",
    },
    {
        title: "Access Requests",
        description: "Permission changes, new account setup, and MFA.",
        category: "Access",
        templateId: "password-reset",
        icon: ShieldCheck,
        color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
        hoverColor: "group-hover:border-purple-500/40",
    }
];

const QuickActions = () => {
  const navigate = useNavigate();
  const [hoveredIdx, setHoveredIdx] = useState(null);

    const handleActionClick = (action) => {
        navigate("/create-ticket", { state: { templateId: action.templateId, prefilledCategory: action.category } });
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

          <h3 style={{ fontSize: '17px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>
            {action.title}
          </h3>
          <p style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.6, marginBottom: '20px' }}>
            {action.description}
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              color: '#16a34a',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            Start Request →
          </div>
        </div>
      ))}
    </div>
  );
};

export default QuickActions;
