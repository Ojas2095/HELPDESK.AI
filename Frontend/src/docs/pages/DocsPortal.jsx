import React, { useState, useMemo } from 'react';
import { 
    Rocket, Cpu, Sliders, AlertTriangle, BookOpen, 
    Search, Copy, Check, Terminal, ArrowRight, ChevronRight, ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { DOCS_CATEGORIES, DOCS_ARTICLES } from '../data/docsArticles';
import { Card } from '../../components/ui/card';
import Header from "../../components/landing/Header";
import Footer from "../../components/landing/Footer";

const iconMap = {
    Rocket: Rocket,
    Cpu: Cpu,
    Sliders: Sliders,
    AlertTriangle: AlertTriangle
};

const DocsPortal = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('getting-started');
    const [activeArticleId, setActiveArticleId] = useState('intro');
    const [copiedSnippet, setCopiedSnippet] = useState(null);

    const [sandboxPayload, setSandboxPayload] = useState('{\n  "text": "VPN connecting error 789 on router"\n}');
    const [sandboxOutput, setSandboxOutput] = useState(null);
    const [isSimulating, setIsSimulating] = useState(false);

    const filteredArticles = useMemo(() => {
        return DOCS_ARTICLES.filter(article => {
            const matchesCategory = selectedCategory ? article.categoryId === selectedCategory : true;
            const matchesSearch = searchQuery.trim() === '' || 
                article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                article.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                article.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
            return matchesCategory && matchesSearch;
        });
    }, [selectedCategory, searchQuery]);

    const activeArticle = useMemo(() => {
        return DOCS_ARTICLES.find(article => article.id === activeArticleId) || DOCS_ARTICLES[0];
    }, [activeArticleId]);

    const handleCopy = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedSnippet(id);
        setTimeout(() => setCopiedSnippet(null), 2000);
    };

    const handleSimulateApi = () => {
        setIsSimulating(true);
        setSandboxOutput(null);
        setTimeout(() => {
            try {
                const parsed = JSON.parse(sandboxPayload);
                setSandboxOutput(JSON.stringify({
                    status: "success",
                    ticket_id: "7cc6e8ef-b5d9-4615-a349-1d629154e7c6",
                    classification: {
                        category: "Network",
                        subcategory: "VPN Failure",
                        priority: "High",
                        assigned_team: "Network Ops",
                        confidence: 0.96
                    },
                    ocr_extracted: parsed.text ? "No OCR payload" : "Locked",
                    decision_factors: [
                        "High confidence match for VPN Failure subcategory",
                        "Routed based on neural network rule matching"
                    ]
                }, null, 2));
            } catch (e) {
                setSandboxOutput(JSON.stringify({
                    status: "error",
                    message: "Invalid JSON format in Request Payload."
                }, null, 2));
            }
            setIsSimulating(false);
        }, 1200);
    };

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
            <Header />

            <div className="max-w-[1100px] max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-8 py-10 relative z-10">
                
                {/* Navigation Back Button */}
                <div className="flex justify-center sm:justify-start">
                    <button 
                        onClick={() => navigate('/dashboard')}
                        className="flex items-center gap-2 font-bold text-base text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors bg-transparent border-none cursor-pointer group"
                    >
                        <div className="p-2.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm group-hover:border-emerald-500/30 transition-colors">
                            <ArrowLeft size={18} />
                        </div>
                        <span>Back to Dashboard</span>
                    </button>
                </div>

                {/* Hero Header Card */}
                <div className="relative rounded-[2.5rem] overflow-hidden bg-emerald-950 dark:bg-slate-900 border border-white/5 px-6 sm:px-10 py-14 shadow-2xl text-white text-center sm:text-left">
                    <div className="absolute -top-20 -left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute -bottom-16 right-4 w-72 h-72 bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none" />
                    <div className="absolute inset-0 opacity-[0.02]"
                        style={{ backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
                    
                    <div className="relative z-10 space-y-5 max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full mx-auto sm:mx-0">
                            <BookOpen size={16} className="text-emerald-400" />
                            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Docs & Troubleshooting</span>
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tight leading-[1.1] font-syne">
                            How can we <span className="text-emerald-400">help you</span> today?
                        </h1>
                        <p className="text-slate-400 dark:text-slate-400 text-base sm:text-lg font-medium max-w-2xl">
                            Search our comprehensive documentation, API contracts, guides, and diagnostic handbooks to resolve issues.
                        </p>
                        
                        {/* Search Bar */}
                        <div className="relative max-w-md pt-2 mx-auto sm:mx-0">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            <input 
                                type="text"
                                placeholder="Search guides, categories, tags..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 focus:border-emerald-500 focus:bg-white focus:text-slate-900 rounded-2xl pl-12 pr-4 h-14 text-sm font-semibold outline-none transition-all placeholder-slate-400 text-white shadow-inner"
                            />
                        </div>
                    </div>
                </div>

                {/* Two-Column Layout Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    
                    {/* Sidebar Navigation */}
                    <div className="lg:col-span-4 flex flex-col gap-6 lg:sticky lg:top-24">
                        
                        {/* Categories Box */}
                        <Card className="p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm dark:shadow-none text-left">
                            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-2 mb-4">Categories</h3>
                            <div className="flex flex-col gap-1.5">
                                {DOCS_CATEGORIES.map(category => {
                                    const CategoryIcon = iconMap[category.icon] || BookOpen;
                                    const isSelected = selectedCategory === category.id;
                                    return (
                                        <button
                                            key={category.id}
                                            onClick={() => {
                                                setSelectedCategory(category.id);
                                                const first = DOCS_ARTICLES.find(a => a.categoryId === category.id);
                                                if (first) setActiveArticleId(first.id);
                                            }}
                                            className={`w-full flex items-center gap-3.5 px-3 py-3 rounded-xl text-sm font-bold transition-all text-left border-none bg-transparent cursor-pointer
                                                ${isSelected 
                                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:text-slate-900 dark:hover:text-white'}`}
                                        >
                                            <CategoryIcon size={18} className={isSelected ? 'text-emerald-500' : 'text-slate-400 dark:text-slate-500'} />
                                            <span>{category.title}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </Card>

                        {/* Articles Links Box */}
                        <Card className="p-5 rounded-[2rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm dark:shadow-none text-left max-h-[350px] overflow-y-auto custom-scrollbar">
                            <h3 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] px-2 mb-4">Articles</h3>
                            {filteredArticles.length > 0 ? (
                                <div className="flex flex-col gap-1.5">
                                    {filteredArticles.map(article => {
                                        const isActive = activeArticleId === article.id;
                                        return (
                                            <button
                                                key={article.id}
                                                onClick={() => setActiveArticleId(article.id)}
                                                className={`w-full flex items-center justify-between px-3 py-3 rounded-xl text-xs font-bold transition-all text-left border-none bg-transparent cursor-pointer
                                                    ${isActive 
                                                        ? 'bg-slate-50 dark:bg-slate-800/40 text-emerald-600 dark:text-emerald-400 border-l-4 border-emerald-500 dark:border-emerald-400 rounded-l-none' 
                                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 hover:text-slate-800 dark:hover:text-slate-200'}`}
                                            >
                                                <span className="truncate max-w-[220px]">{article.title}</span>
                                                <ChevronRight size={14} className={isActive ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-700'} />
                                            </button>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 dark:text-slate-500 italic px-2 m-0">No matching articles found.</p>
                            )}
                        </Card>
                    </div>

                    {/* Document Viewer & Sandbox */}
                    <div className="lg:col-span-8 flex flex-col gap-8 w-full">
                        
                        {/* Markdown Article Card */}
                        <Card className="p-6 sm:p-10 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm dark:shadow-none text-left">
                            <div className="prose prose-slate max-w-none dark:prose-invert">
                                <div className="flex flex-wrap gap-1.5 mb-6">
                                    {activeArticle.tags?.map(tag => (
                                        <span key={tag} className="px-3 py-0.5 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-150 dark:border-slate-700 text-xs font-bold uppercase tracking-wider">
                                            #{tag}
                                        </span>
                                    ))}
                                </div>

                                <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                        h1: ({node, ...props}) => <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-2 mb-6 border-b border-slate-100 dark:border-slate-800 pb-4 font-syne" {...props} />,
                                        h2: ({node, ...props}) => <h3 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-200 tracking-tight mt-8 mb-4 font-syne" {...props} />,
                                        h3: ({node, ...props}) => <h4 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-200 tracking-tight mt-6 mb-3" {...props} />,
                                        p: ({node, ...props}) => <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed my-4 font-medium" {...props} />,
                                        ul: ({node, ...props}) => <ul className="list-disc pl-5 text-sm sm:text-base text-slate-600 dark:text-slate-300 space-y-2 my-4" {...props} />,
                                        ol: ({node, ...props}) => <ol className="list-decimal pl-5 text-sm sm:text-base text-slate-600 dark:text-slate-300 space-y-2 my-4" {...props} />,
                                        li: ({node, ...props}) => <li className="font-medium" {...props} />,
                                        code: ({node, inline, ...props}) => inline 
                                            ? <code className="bg-slate-50 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-mono text-xs font-bold border border-slate-100 dark:border-slate-700/60" {...props} />
                                            : <pre className="bg-slate-950 p-5 rounded-2xl font-mono text-xs sm:text-sm text-slate-300 overflow-x-auto border border-white/[0.05] my-6 select-text shadow-inner leading-relaxed" {...props} />
                                    }}
                                >
                                    {activeArticle.content}
                                </ReactMarkdown>
                            </div>
                        </Card>

                        {/* Interactive Sandbox Card */}
                        <Card className="p-6 sm:p-10 rounded-[2.5rem] border border-emerald-100 dark:border-slate-800 bg-gradient-to-br from-emerald-500/[0.02] to-white dark:to-[#111927] shadow-sm dark:shadow-none relative overflow-hidden text-left">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
                            
                            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2 flex items-center gap-2 font-syne">
                                <Terminal className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> Interactive Endpoint Sandbox
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-8">
                                Test the AI Classification API payload live on-screen below. Send a simulated request to `/tickets/save` endpoint.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                                {/* Request Section */}
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1">Request Payload (JSON)</span>
                                        <button 
                                            onClick={() => handleCopy(sandboxPayload, 'payload')}
                                            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer"
                                        >
                                            {copiedSnippet === 'payload' ? <Check size={12} /> : <Copy size={12} />}
                                            <span>{copiedSnippet === 'payload' ? 'Copied' : 'Copy'}</span>
                                        </button>
                                    </div>
                                    <textarea 
                                        value={sandboxPayload}
                                        onChange={(e) => setSandboxPayload(e.target.value)}
                                        className="font-mono text-sm p-4 bg-emerald-950 dark:bg-slate-950 text-emerald-400 border border-white/[0.05] rounded-2xl resize-none min-h-[160px] focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 shadow-inner outline-none leading-relaxed"
                                    />
                                    <button 
                                        onClick={handleSimulateApi}
                                        disabled={isSimulating}
                                        className="h-12 mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/10 active:scale-[0.99] transition-all disabled:opacity-50 border-none cursor-pointer"
                                    >
                                        {isSimulating ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                                <span>Simulating API Response...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Run Simulation</span> 
                                                <ArrowRight size={14} />
                                            </>
                                        )}
                                    </button>
                                </div>

                                {/* Terminal Output Section */}
                                <div className="flex flex-col gap-2">
                                    <span className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-1">Terminal Output</span>
                                    <div className="flex-1 bg-emerald-950 dark:bg-slate-950 rounded-2xl border border-white/[0.05] p-5 font-mono text-sm leading-relaxed text-slate-300 min-h-[160px] max-h-[220px] md:max-h-none overflow-y-auto custom-scrollbar relative select-text shadow-inner">
                                        {sandboxOutput ? (
                                            <pre className="whitespace-pre m-0 text-slate-300">{sandboxOutput}</pre>
                                        ) : (
                                            <span className="text-slate-600 dark:text-slate-500 italic font-medium">// Click 'Run Simulation' to execute payloads...</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>

                    </div>
                </div>

            </div>

            <Footer />
        </div>
    );
};

export default DocsPortal;

