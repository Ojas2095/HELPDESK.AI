import React from 'react';
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

/**
 * Reusable StatCard for Admin Metrics
 */
const StatCard = ({ label, value, subtitle, icon: Icon, trend, color = 'indigo', customIcon }) => {
    const semanticColors = {
        indigo: 'bg-indigo-50 text-indigo-500',
        amber: 'bg-orange-50 text-orange-500',
        emerald: 'bg-green-50 text-green-600',
        red: 'bg-blue-50 text-blue-500',
        slate: 'bg-slate-50 text-slate-500'
    };
    const currentStyle = semanticColors[color] || semanticColors.slate;

    return (
        <div className="bg-white rounded-2xl border border-green-50 shadow-sm p-6 px-7 transition-all duration-300 relative overflow-hidden hover:shadow-lg hover:-translate-y-1 group">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-[11px] text-gray-400 tracking-widest font-semibold uppercase mb-2">
                        {label}
                    </p>
                    <div className="flex items-baseline gap-2">
                        <p className="text-4xl font-extrabold text-gray-900 leading-none tracking-tight mt-2 mb-1.5">
                            {value}
                        </p>
                        {trend && (
                            <span className={`text-[11px] font-bold flex items-center gap-0.5 ${trend.startsWith('+') ? 'text-emerald-500' : 'text-red-500'}`}>
                                {trend.startsWith('+') ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                {trend}
                            </span>
                        )}
                    </div>
                    {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
                </div>
                <div className={`${currentStyle} p-2.5 rounded-xl w-10 h-10 flex items-center justify-center transition-transform duration-500 group-hover:scale-110`}>
                    {customIcon || (Icon && <Icon size={20} />)}
                </div>
            </div>
        </div>
    );
};

export default StatCard;
