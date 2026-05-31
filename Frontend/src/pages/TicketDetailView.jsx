import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle2, User, ArrowLeft, Activity, ShieldCheck,
    FileText, Briefcase, RotateCcw, Send, MessageCircle,
    BrainCircuit, ImageIcon, Clock
} from 'lucide-react';
import useTicketStore from '../store/ticketStore';
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";

function TicketDetailView() {
    const { ticket_id } = useParams();
    const { tickets, appendMessage, updateTicket } = useTicketStore();
    const navigate = useNavigate();
    const [ticket, setTicket] = useState(null);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        const handleFocus = () => {
            useTicketStore.persist.rehydrate();
        };
        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);

    const viewedRef = useRef(null);

    useEffect(() => {
        const foundTicket = tickets.find(t => t.ticket_id.toString() === ticket_id);

        if (!foundTicket) {
            if (tickets.length > 0) {
                navigate('/my-tickets');
            }
            return;
        }

        setTicket(foundTicket);

        if (viewedRef.current !== ticket_id) {
            updateTicket(foundTicket.ticket_id, {
                last_user_viewed_at: new Date().toISOString()
            });
            viewedRef.current = ticket_id;
        }
    }, [ticket_id, tickets, navigate, updateTicket]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [ticket?.messages]);

    if (!ticket) return null;

    const isResolved = ticket.status === 'Resolved by Human Support';
    const isReopened = ticket.reopened_at && !isResolved;
    const messages = ticket.messages || [];

    const handleReopenTicket = () => {
        updateTicket(ticket.ticket_id, {
            status: 'Pending Human Support',
            reopened_at: new Date().toISOString(),
            reopened_by: ticket.owner_id
        });
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        const text = newMessage.trim();
        if (!text || isSending) return;

        setIsSending(true);
        setNewMessage('');

        appendMessage(ticket.ticket_id, {
            sender: 'user',
            message: text,
            timestamp: new Date().toISOString()
        });

        setIsSending(false);
    };

    return (
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex flex-col gap-8 bg-white dark:bg-slate-900 transition-colors duration-300">
            <div className="w-full text-left">
                {/* Back Link */}
                <button
                    onClick={() => navigate('/my-tickets')}
                    className="flex items-center gap-2 font-bold text-base text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors bg-transparent border-none cursor-pointer group mb-8"
                >
                    <div className="p-2.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-emerald-500/30 transition-colors">
                        <ArrowLeft size={18} />
                    </div>
                    <span>Back to My Tickets</span>
                </button>

                <AnimatePresence mode="wait">
                    {/* Resolved State Announcement */}
                    {isResolved && (
                        <motion.div 
                            initial={{ opacity: 0, y: -15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 dark:border-emerald-500/20 rounded-[2rem] p-6 sm:p-8 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                                    <CheckCircle2 className="text-emerald-500 w-7 h-7" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-syne">Your issue has been resolved</h2>
                                    <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium">Closed on {new Date(ticket.resolved_at).toLocaleString()}</p>
                                </div>
                            </div>
                            <button
                                onClick={handleReopenTicket}
                                className="px-6 h-12 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 shadow-sm shrink-0 cursor-pointer text-sm uppercase tracking-wider"
                            >
                                <RotateCcw size={16} /> Reopen Ticket
                            </button>
                        </motion.div>
                    )}

                    {/* Reopened Notification Banner */}
                    {isReopened && (
                        <motion.div 
                            initial={{ opacity: 0, y: -15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            className="bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/20 rounded-[2rem] p-6 sm:p-8 mb-8 flex items-center gap-4 shadow-sm"
                        >
                            <div className="w-14 h-14 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                                <RotateCcw className="text-amber-500 w-7 h-7" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight font-syne">Ticket Reopened</h2>
                                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 font-medium">Sent back to our support team. We'll respond shortly.</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Content Structural Matrix */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* LEFT DATA INTERFACE COLUMN */}
                    <div className="lg:col-span-8 space-y-8 w-full">

                        {/* Core Meta Ticket Information */}
                        <Card className="p-0 overflow-hidden rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm dark:shadow-none">
                            <CardHeader className="bg-slate-50 dark:bg-white/[0.01] px-6 sm:p-8 py-5 border-b border-slate-150 dark:border-slate-800/60">
                                <CardTitle className="font-bold text-slate-900 dark:text-white text-lg tracking-tight font-syne flex items-center gap-2.5">
                                    <FileText size={18} className="text-emerald-500" /> Ticket Information
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 sm:p-8 space-y-6">
                                <div className="space-y-1">
                                    <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block pl-0.5">Ticket Ident Matrix</span>
                                    <p className="text-2xl sm:text-3xl font-mono font-black text-emerald-600 dark:text-emerald-400 tracking-wider">#{ticket.ticket_id}</p>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block pl-0.5">Problem Summary</span>
                                    <p className="text-base sm:text-lg font-medium text-slate-800 dark:text-slate-200 leading-relaxed bg-slate-50 dark:bg-slate-950 p-5 rounded-2xl border border-slate-150 dark:border-slate-800/40 m-0">
                                        {ticket.summary}
                                    </p>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150 dark:border-slate-800/40 flex flex-col gap-1.5">
                                        <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Assigned Support Domain</span>
                                        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300 text-sm">
                                            <Briefcase size={16} className="text-emerald-500 shrink-0" />
                                            <span>{ticket.assigned_team}</span>
                                        </div>
                                    </div>
                                    <div className="p-5 bg-slate-50 dark:bg-slate-950 rounded-2xl border border-slate-150 dark:border-slate-800/40 flex flex-col gap-1.5">
                                        <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Current Node Lifecycle</span>
                                        <div className={`flex items-center gap-2 font-black uppercase text-xs tracking-tight ${isResolved ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-500'}`}>
                                            <div className={`w-2 h-2 rounded-full ${isResolved ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                                            <span>{ticket.status}</span>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Artificial Intelligence Heuristics Stream */}
                        {(ticket.reasoning || ticket.image_description) && (
                            <Card className="p-0 overflow-hidden rounded-[2.5rem] border border-emerald-500/10 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm dark:shadow-none">
                                <CardHeader className="bg-emerald-950 px-6 sm:p-8 py-5 border-b border-emerald-900/60">
                                    <CardTitle className="font-bold text-white text-lg tracking-tight font-syne flex items-center gap-2.5">
                                        <BrainCircuit size={18} className="text-emerald-400" /> Neural Classifier Insights
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-6 sm:p-8 space-y-6">
                                    {ticket.reasoning && (
                                        <div className="space-y-2">
                                            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block pl-0.5">Automated Inference Analysis</span>
                                            <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base italic border-l-4 border-emerald-500 pl-4 py-2 bg-emerald-500/[0.02] rounded-r-xl m-0 leading-relaxed font-medium">
                                                {ticket.reasoning}
                                            </p>
                                        </div>
                                    )}
                                    {ticket.image_description && (
                                        <div className="space-y-2">
                                            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block pl-0.5">Computer Vision Diagnostics Mapping</span>
                                            <div className="flex items-center gap-2 text-xs font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                                                <ImageIcon size={14} className="shrink-0" /> OCR Payload Description
                                            </div>
                                            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base bg-blue-500/[0.03] p-4 rounded-xl border border-blue-500/10 italic m-0 leading-relaxed font-medium">
                                                "{ticket.image_description}"
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* Active Communication Channel Board */}
                        <Card className="p-0 overflow-hidden rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm dark:shadow-none">
                            <CardHeader className="bg-slate-50 dark:bg-white/[0.01] px-6 sm:p-8 py-5 border-b border-slate-150 dark:border-slate-800/60 flex flex-row items-center justify-between gap-4">
                                <CardTitle className="font-bold text-slate-900 dark:text-white text-lg tracking-tight font-syne flex items-center gap-2.5">
                                    <MessageCircle size={18} className="text-emerald-500" /> Conversation
                                </CardTitle>
                                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full uppercase tracking-wider shrink-0">
                                    {messages.length} message{messages.length !== 1 ? 's' : ''}
                                </span>
                            </CardHeader>

                            <CardContent className="p-0 flex flex-col">
                                {/* Chronological Messages Stream */}
                                <div className="p-6 space-y-4 max-h-96 overflow-y-auto customize-scrollbar">
                                    {messages.length === 0 ? (
                                        <p className="text-center text-slate-400 dark:text-slate-500 text-sm py-12 italic font-medium m-0">No communication nodes exchanged yet.</p>
                                    ) : (
                                        messages.map((msg, i) => {
                                            const isUser = msg.sender === 'user';
                                            return (
                                                <div key={i} className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                                                    {!isUser && (
                                                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 dark:bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-1 shadow-sm">
                                                            <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                                                        </div>
                                                    )}
                                                    <div className={`max-w-[75%] flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                                                        <div className={`px-4 py-3 rounded-2xl text-sm sm:text-base font-medium leading-relaxed shadow-sm ${isUser
                                                            ? 'bg-emerald-600 text-white rounded-tr-sm'
                                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm border border-transparent dark:border-white/5'
                                                            }`}>
                                                            {msg.message}
                                                        </div>
                                                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-1 m-0 uppercase tracking-wider">
                                                            {isUser ? 'You' : 'Support Agent'} &bull; {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </p>
                                                    </div>
                                                    {isUser && (
                                                        <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0 mt-1 shadow-md shadow-emerald-600/10">
                                                            <User size={14} className="text-white" />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* Dynamic Pipeline Input Transmission Form */}
                                <div className="px-6 pb-6 border-t border-slate-150 dark:border-slate-800/60 pt-5">
                                    <form onSubmit={handleSendMessage} className="flex gap-3">
                                        <input
                                            id="message-input"
                                            type="text"
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder="Add more detailed environmental telemetry parameters..."
                                            disabled={isSending}
                                            className="flex-1 px-4 h-12 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950 text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-transparent transition-all disabled:opacity-50 shadow-inner"
                                        />
                                        <button
                                            id="send-message-btn"
                                            type="submit"
                                            disabled={!newMessage.trim() || isSending}
                                            className="px-6 h-12 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/10 active:scale-95 border-none cursor-pointer text-xs uppercase tracking-wider"
                                        >
                                            <Send size={14} />
                                            <span>Send</span>
                                        </button>
                                    </form>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT SYSTEM STATUS RADAR SIDEBAR */}
                    <div className="lg:col-span-4 space-y-6 w-full text-center lg:text-left">
                        
                        {/* Process Sequence Timeline */}
                        <Card className="p-0 overflow-hidden rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm dark:shadow-none">
                            <CardHeader className="bg-slate-900 dark:bg-white/[0.01] text-white px-6 py-4 border-b border-white/5">
                                <CardTitle className="font-bold text-xs flex items-center justify-center lg:justify-start gap-2.5 uppercase tracking-[0.2em]">
                                    <Activity size={16} className="text-emerald-400 animate-pulse" /> Ticket Journey
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6 sm:p-8 relative">
                                <div className="absolute left-[39px] top-10 bottom-10 w-0.5 bg-slate-100 dark:bg-slate-800/80" />
                                <div className="space-y-10">
                                    {/* Sequence Node: Reported */}
                                    <div className="flex items-start gap-5 relative text-left">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center shrink-0 z-10 shadow-sm bg-white dark:bg-slate-900">
                                            <CheckCircle2 size={12} className="text-emerald-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-tight">Reported</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Issue Logged into Cluster</p>
                                        </div>
                                    </div>
                                    
                                    {/* Sequence Node: AI Processed */}
                                    <div className="flex items-start gap-5 relative text-left">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center shrink-0 z-10 shadow-sm bg-white dark:bg-slate-900">
                                            <ShieldCheck size={12} className="text-emerald-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-tight">AI Processed</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Triage Parsing Pipeline Complete</p>
                                        </div>
                                    </div>
                                    
                                    {/* Sequence Node: Escalated */}
                                    <div className="flex items-start gap-5 relative text-left">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center shrink-0 z-10 shadow-sm bg-white dark:bg-slate-900">
                                            <User size={12} className="text-emerald-500" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-tight">Escalated</p>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Human Response Node Assigned</p>
                                        </div>
                                    </div>
                                    
                                    {/* Sequence Node: Reopened (Conditional Block) */}
                                    {ticket.reopened_at && (
                                        <div className="flex items-start gap-5 relative text-left animate-in fade-in duration-300">
                                            <div className="w-6 h-6 rounded-full bg-amber-500/10 border border-amber-500 flex items-center justify-center shrink-0 z-10 shadow-sm bg-white dark:bg-slate-900">
                                                <RotateCcw size={12} className="text-amber-500" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="font-extrabold text-sm text-slate-900 dark:text-white uppercase tracking-tight">Reopened</p>
                                                <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">Returned to Parsing Handler</p>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Sequence Node: Resolved (Conditional Block) */}
                                    {isResolved && (
                                        <div className="flex items-start gap-5 relative text-left animate-in fade-in duration-300">
                                            <div className="w-6 h-6 rounded-full bg-emerald-500 border border-emerald-600 flex items-center justify-center shrink-0 z-10 shadow-md ring-4 ring-emerald-500/10">
                                                <CheckCircle2 size={12} className="text-white" />
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 uppercase tracking-tight">Resolved</p>
                                                <p className="text-xs text-emerald-500/70 font-black uppercase tracking-wider">Closed Frame</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Static Matrix Log Timestamp Block */}
                        <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-center lg:text-left shadow-inner flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <div className="space-y-0.5">
                                <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Created At</span>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300 m-0">{new Date(ticket.created_at).toLocaleString()}</p>
                            </div>
                            <Clock size={16} className="text-slate-400 dark:text-slate-600 hidden lg:block shrink-0" />
                        </div>
                    </div>

                </div>
            </div>
            
            <style dangerouslySetInnerHTML={{
                __html: `
                .customize-scrollbar::-webkit-scrollbar { width: 6px; }
                .customize-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .customize-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.15); border-radius: 99px; }
                .dark .customize-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
                .customize-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(156, 163, 175, 0.3); }
                .dark .customize-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
            `}} />
        </main>
    );
}

export default TicketDetailView;
