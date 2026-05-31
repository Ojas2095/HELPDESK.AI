import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Shield, Cpu, Key, ArrowLeft, Check, Copy, ChevronLeft } from 'lucide-react';
import { Card } from '../components/ui/card';
import Header from "../components/landing/Header";
import Footer from "../components/landing/Footer";

export default function ApiReference() {
    const navigate = useNavigate();
    const [copied, setCopied] = React.useState(null);

    const handleCopy = (text, key) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
            {/* Header */}
            <Header />

            {/* Main Wrapper */}
            <main className="flex-grow max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12 sm:space-y-16 relative z-10">

                {/* Hero Header Area */}
                <div className="space-y-6 text-center sm:text-left">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-700 dark:text-blue-400 text-sm font-extrabold uppercase tracking-wider">
                        <Terminal size={16} /> Developer API Reference v1
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] font-syne">
                        Integrate Automation <br /> Workflows
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg md:text-xl leading-relaxed max-w-3xl font-medium">
                        Connect your existing CRM, Slack bots, or internal infrastructure pipelines directly to the HELPDESK.AI triage engine. Classify incoming tickets and extract entities securely.
                    </p>
                </div>

                {/* Authentication Card Wrapper */}
                <Card className="p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-6 shadow-sm dark:shadow-none relative text-left">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 border border-blue-500/20">
                            <Key size={22} />
                        </div>
                        <div className="space-y-0.5">
                            <h3 className="font-extrabold text-slate-900 dark:text-white text-xl tracking-tight font-syne">Authentication</h3>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Secure token validation metrics</p>
                        </div>
                    </div>
                    <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        All incoming telemetry payload calls must pass a valid organization cryptographic token inside the request header parameter values.
                    </p>
                    <div className="bg-slate-950 p-5 rounded-2xl font-mono text-sm text-slate-300 border border-white/[0.05] relative shadow-inner overflow-x-auto">
                        <span className="absolute top-3 right-4 text-[10px] uppercase font-black tracking-widest text-slate-600">Headers</span>
                        <span className="text-purple-400">Authorization:</span> Bearer hk_live_xxxxxxxxxxxxxxxxxxxxxxxx
                    </div>
                </Card>

                {/* Catalog Segment Layer */}
                <div className="space-y-6 text-left">
                    <div className="flex items-center gap-3 px-2">
                        <Cpu size={18} className="text-slate-400" />
                        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Endpoint Routing Blueprint</h2>
                    </div>

                    {/* Classify Ticket API Block */}
                    <Card className="p-6 sm:p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-8 shadow-sm dark:shadow-none">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-150 dark:border-slate-800/60 pb-5">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="bg-emerald-600 dark:bg-emerald-500 text-white font-black text-xs px-3 py-1.5 rounded-xl font-mono shadow-sm">POST</span>
                                <code className="text-sm sm:text-base font-black text-slate-800 dark:text-slate-200 font-mono bg-slate-50 dark:bg-slate-900 px-3 py-1 rounded-xl border border-slate-100 dark:border-slate-800">/api/v1/tickets/classify</code>
                            </div>
                            <span className="text-xs sm:text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Classify & Save Incident</span>
                        </div>

                        <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                            Transmits raw multi-line strings or base64 files for immediate NLP categorizing, priority evaluation, and system queue logging parameters.
                        </p>

                        {/* Code Block: JSON Request Specification */}
                        <div className="space-y-3">
                            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block pl-1">Request Body Schema (JSON)</span>
                            <div className="relative group">
                                <pre className="bg-slate-950 p-6 rounded-2xl font-mono text-sm text-emerald-400 overflow-x-auto border border-white/[0.05] shadow-inner leading-relaxed select-text m-0">
{`{
  "text": "VPN connecting error 789 on router downstairs",
  "meta": {
    "source": "Slack Integration",
    "reporter_email": "user@company.com"
  }
}`}
                                </pre>
                                <button 
                                    onClick={() => handleCopy(`{\n  "text": "VPN connecting error 789 on router downstairs",\n  "meta": {\n    "source": "Slack Integration",\n    "reporter_email": "user@company.com"\n  }\n}`, 'req')}
                                    className="absolute top-4 right-4 text-slate-500 hover:text-white p-2.5 bg-slate-900 border border-white/10 rounded-xl hover:bg-slate-800 transition-all cursor-pointer shadow-md"
                                >
                                    {copied === 'req' ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Code Block: JSON Response Specification */}
                        <div className="space-y-3">
                            <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block pl-1">Response Payload Schema (JSON)</span>
                            <div className="relative">
                                <pre className="bg-slate-950 p-6 rounded-2xl font-mono text-sm text-slate-300 overflow-x-auto border border-white/[0.05] shadow-inner leading-relaxed m-0">
{`{
  "status": "success",
  "ticket_id": "7cc6e8ef-b5d9-4615-a349-1d629154e7c6",
  "classification": {
    "category": "Network",
    "priority": "High",
    "assigned_team": "Network Ops",
    "confidence": 0.96
  }
}`}
                                </pre>
                            </div>
                        </div>
                    </Card>
                </div>

                {/* Technical Footnote Block */}
                <div className="pt-8 text-center border-t border-slate-100 dark:border-slate-800/60">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-slate-600">
                        System Framework Token Gateways &copy; 2026 HELPDESK.AI
                    </p>
                </div>
            </main>

            {/* Footer */}
            <Footer />
        </div>
    );
}

