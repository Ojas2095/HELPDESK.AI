import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, Mail, User, Phone, ArrowRight, CheckCircle2, ShieldCheck, Zap, Server, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export default function ContactSales() {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        phone: '',
        company_size: '50-200',
        message: ''
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const { error } = await supabase
                .from('enterprise_leads')
                .insert([
                    {
                        name: formData.name,
                        email: formData.email,
                        company: formData.company,
                        phone: formData.phone,
                        company_size: formData.company_size,
                        message: formData.message
                    }
                ]);

            if (error) throw error;
            setIsSuccess(true);
        } catch (error) {
            console.error('Error submitting form:', error);
            alert("There was an issue submitting your request. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-md w-full text-center space-y-6 bg-white/[0.03] border border-white/[0.08] rounded-[2.5rem] p-8 sm:p-12 shadow-2xl backdrop-blur-xl relative z-10"
                >
                    <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-inner">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tight font-syne">Request Sent!</h2>
                    <p className="text-slate-400 text-base leading-relaxed font-medium">
                        Thank you for your interest in HelpDesk.ai Enterprise. Our team will review your requirements and get back to you within 24 hours.
                    </p>
                    <button 
                        onClick={() => navigate('/')} 
                        className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 active:scale-[0.98] transition-all cursor-pointer border-none mt-4 text-sm uppercase tracking-wider"
                    >
                        Return Home
                    </button>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
            {/* Minimal Nav Area */}
            <div className="w-full py-6 px-4 md:px-8 border-b border-white/[0.05] bg-transparent relative z-20">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                        <img src="/favicon.png" alt="H" className="w-8 h-8 object-contain" />
                        <span className="font-black text-2xl tracking-tighter text-white font-syne italic uppercase">HelpDesk.ai</span>
                    </div>
                    <button 
                        onClick={() => navigate('/')} 
                        className="flex items-center gap-2 font-bold text-xs text-slate-400 hover:text-emerald-400 transition-colors bg-transparent border-none cursor-pointer group"
                    >
                        <div className="p-2 rounded-full bg-white/5 border border-white/10 group-hover:border-emerald-500/30 transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </div>
                        <span>BACK TO HOME</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row w-full max-w-7xl mx-auto relative z-10">
                {/* Left Side Section: Value Propositions Layer */}
                <div className="w-full lg:w-5/12 p-8 md:p-16 flex flex-col justify-center relative overflow-hidden text-center lg:text-left border-b lg:border-b-0 lg:border-r border-white/[0.05]">
                    <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
                    
                    <div className="relative z-10 space-y-8 flex flex-col items-center lg:items-start">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-extrabold uppercase tracking-wider mx-auto lg:mx-0">
                            Enterprise Plan
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-[1.15] font-syne text-center lg:text-left">
                            Scale Support Without <br /> <span className="text-emerald-500">Scaling Teams.</span>
                        </h1>
                        <p className="text-slate-400 text-base md:text-lg leading-relaxed font-medium text-center lg:text-left max-w-md lg:max-w-none">
                            Deploy fine-tuned AI categorization engines instantly. Eliminate helpdesk bottlenecks with our compliant, highly scalable infrastructure.
                        </p>

                        <div className="space-y-8 pt-4 w-full flex flex-col items-center lg:items-start">
                            {[
                                { icon: ShieldCheck, title: "Custom AI Fine-Tuning", desc: "Train models on your proprietary internal documentation pools safely." },
                                { icon: Server, title: "Dedicated Architecture", desc: "Keep processing parameters strictly local with custom single-tenant environments." },
                                { icon: Zap, title: "SLA Management Contracts", desc: "Guaranteed platform runtimes with round-the-clock priority technical delivery handlers." },
                            ].map((feature, i) => (
                                <div key={i} className="flex flex-col items-center text-center lg:flex-row lg:items-start lg:text-left gap-4 group max-w-sm lg:max-w-none">
                                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300">
                                        <feature.icon className="w-5 h-5 text-emerald-400" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="font-extrabold text-white text-base tracking-tight">{feature.title}</h4>
                                        <p className="text-slate-400 text-sm leading-relaxed font-medium">{feature.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Side Section: Contact Form Element Interface */}
                <div className="w-full lg:w-7/12 p-6 sm:p-12 md:p-16 flex items-center justify-center relative overflow-hidden">
                    <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
                    
                    <div className="w-full max-w-xl mx-auto space-y-10 relative z-10 text-left">
                        <div className="space-y-3 text-center lg:text-left">
                            <h2 className="text-3xl font-black text-white tracking-tight font-syne">Contact Sales</h2>
                            <p className="text-slate-400 font-medium">Fill out the form parameter inputs below to engage an architectural specialist.</p>
                        </div>
                        
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Full Name *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <User className="h-5 w-5 text-slate-500" />
                                        </div>
                                        <input 
                                            type="text" 
                                            required 
                                            name="name"
                                            className="w-full pl-12 pr-4 h-12 bg-white/[0.02] border border-white/10 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-white placeholder-slate-600 outline-none shadow-inner" 
                                            placeholder="John Doe"
                                            value={formData.name}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Work Email *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Mail className="h-5 w-5 text-slate-500" />
                                        </div>
                                        <input 
                                            type="email" 
                                            required 
                                            name="email"
                                            className="w-full pl-12 pr-4 h-12 bg-white/[0.02] border border-white/10 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-white placeholder-slate-600 outline-none shadow-inner" 
                                            placeholder="john@company.com"
                                            value={formData.email}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Company Name *</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Building2 className="h-5 w-5 text-slate-500" />
                                        </div>
                                        <input 
                                            type="text" 
                                            required 
                                            name="company"
                                            className="w-full pl-12 pr-4 h-12 bg-white/[0.02] border border-white/10 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-white placeholder-slate-600 outline-none shadow-inner" 
                                            placeholder="Acme Corp"
                                            value={formData.company}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Company Size</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Building2 className="h-5 w-5 text-slate-500" />
                                        </div>
                                        <select 
                                            name="company_size"
                                            className="w-full pl-12 pr-10 h-12 bg-slate-950 border border-white/10 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-white appearance-none cursor-pointer outline-none shadow-inner"
                                            value={formData.company_size}
                                            onChange={handleChange}
                                        >
                                            <option value="1-50">1 - 50 employees</option>
                                            <option value="50-200">50 - 200 employees</option>
                                            <option value="200-1000">200 - 1,000 employees</option>
                                            <option value="1000+">1,000+ employees</option>
                                        </select>
                                        <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                            <ArrowRight className="h-4 w-4 text-slate-500 rotate-90" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Phone Number</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Phone className="h-5 w-5 text-slate-500" />
                                    </div>
                                    <input 
                                        type="tel" 
                                        name="phone"
                                        className="w-full pl-12 pr-4 h-12 bg-white/[0.02] border border-white/10 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-white placeholder-slate-600 outline-none shadow-inner" 
                                        placeholder="+91 (555) 000-0000"
                                        value={formData.phone}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">How can we help? *</label>
                                <textarea 
                                    required 
                                    name="message"
                                    rows="4"
                                    className="w-full p-4 bg-white/[0.02] border border-white/10 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-white placeholder-slate-600 outline-none resize-none shadow-inner leading-relaxed" 
                                    placeholder="Tell us about your IT setup and support automation requirements..."
                                    value={formData.message}
                                    onChange={handleChange}
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                className={`w-full h-14 bg-emerald-600 text-white rounded-xl font-bold transition-all shadow-xl shadow-emerald-600/10 flex items-center justify-center gap-2 mt-4 text-sm uppercase tracking-wider cursor-pointer border-none active:scale-[0.99] ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-emerald-500'}`}
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Submitting Request...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Request Enterprise Access</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                            
                            <p className="text-[10px] text-center text-slate-500 uppercase tracking-widest mt-4">
                                Secure end-to-end telemetry pipeline transmission data nodes.
                            </p>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}

