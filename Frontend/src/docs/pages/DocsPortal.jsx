import React, { useState, useMemo } from 'react';
import {
  Rocket,
  Cpu,
  Sliders,
  AlertTriangle,
  BookOpen,
  Search,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  ArrowRight,
  ChevronRight,
  ArrowLeft,
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
  AlertTriangle: AlertTriangle,
};

const DocsPortal = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('getting-started');
  const [activeArticleId, setActiveArticleId] = useState('intro');
  const [copiedSnippet, setCopiedSnippet] = useState(null);

  // Sandbox state
  const [sandboxPayload, setSandboxPayload] = useState(
    '{\n  "text": "VPN connecting error 789 on router"\n}'
  );
  const [sandboxOutput, setSandboxOutput] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Filter articles based on category and search
  const filteredArticles = useMemo(() => {
    return DOCS_ARTICLES.filter((article) => {
      const matchesCategory = selectedCategory ? article.categoryId === selectedCategory : true;
      const matchesSearch =
        searchQuery.trim() === '' ||
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  // Active article content
  const activeArticle = useMemo(() => {
    return DOCS_ARTICLES.find((article) => article.id === activeArticleId) || DOCS_ARTICLES[0];
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
            } catch {
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

  return (
    <div className='min-h-screen bg-[#f6f8f7] pb-20'>
      {/* Sleek, Premium Standalone Docs Navbar */}
      <header className='w-full bg-white border-b border-gray-200 sticky top-0 z-50'>
        <div className='max-w-[1100px] mx-auto px-4 md:px-6 h-16 flex items-center justify-between'>
          <div className='flex items-center gap-3 cursor-pointer' onClick={() => navigate('/')}>
            <div className='flex items-center justify-center'>
              <img src='/favicon.png' alt='HELPDESK.AI Logo' className='w-7 h-7 object-contain' />
            </div>
            <div className='flex items-baseline gap-2'>
              <h1 className='text-xl font-black tracking-tighter text-gray-900 italic'>
                HELPDESK.AI
              </h1>
              <span className='px-2 py-0.5 text-[10px] font-black bg-emerald-100 text-emerald-800 rounded-md uppercase tracking-wider'>
                Docs
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className='flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-emerald-600 transition-colors bg-gray-50 hover:bg-emerald-50 px-3.5 py-2 rounded-xl border border-gray-200 hover:border-emerald-200 animate-in fade-in slide-in-from-right-2 duration-300'
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </button>
        </div>
      </header>

      <div className='max-w-[1100px] mx-auto px-4 md:px-6 flex flex-col gap-8 mt-8'>
        {/* 🌟 Docs Hero Header */}
        <div className='relative rounded-[2rem] overflow-hidden bg-slate-900 px-8 py-12 shadow-2xl text-white'>
          <div className='absolute -top-20 -left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none' />
          <div className='absolute -bottom-16 right-4 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none' />
          <div
            className='absolute inset-0 opacity-[0.03]'
            style={{
              backgroundImage: 'radial-gradient(circle,#fff 1px,transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div className='relative z-10 space-y-4 max-w-2xl'>
            <div className='inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/20 rounded-full'>
              <BookOpen size={13} className='text-emerald-400' />
              <span className='text-[10px] font-black text-emerald-400 uppercase tracking-widest'>
                Docs & Troubleshooting
              </span>
            </div>
            <h1 className='text-3xl sm:text-4xl font-black tracking-tight leading-[1.15]'>
              How can we <span className='text-emerald-400'>help you</span> today?
            </h1>
            <p className='text-slate-400 text-sm font-medium'>
              Search our comprehensive documentation, API contracts, guides, and diagnostic
              handbooks to resolve issues.
            </p>

            {/* Search Bar */}
            <div className='relative max-w-md pt-2'>
              <Search className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5' />
              <input
                type='text'
                placeholder='Search guides, categories, tags...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full bg-white/5 border border-white/10 focus:border-emerald-500 focus:bg-white focus:text-slate-900 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-semibold outline-none transition-all placeholder-slate-400 text-white'
              />
            </div>
          </div>
        </div>

        {/* 🔄 Two-Column Docs Grid */}
        <div className='grid grid-cols-1 lg:grid-cols-12 gap-8 items-start'>
          {/* LEFT COLUMN: Sidebar Navigation */}
          <div className='lg:col-span-4 flex flex-col gap-6 sticky top-24'>
            {/* Category Selectors */}
            <Card className='p-4 rounded-2xl border border-gray-100 shadow-sm bg-white'>
              <h3 className='text-xs font-black text-gray-400 uppercase tracking-widest px-3 mb-3'>
                Categories
              </h3>
              <div className='flex flex-col gap-1'>
                {DOCS_CATEGORIES.map((category) => {
                  const CategoryIcon = iconMap[category.icon] || BookOpen;
                  const isSelected = selectedCategory === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => {
                        setSelectedCategory(category.id);
                        // Pre-select first article in category
                        const first = DOCS_ARTICLES.find((a) => a.categoryId === category.id);
                        if (first) setActiveArticleId(first.id);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-all text-left
                                                ${
                                                  isSelected
                                                    ? 'bg-emerald-50 text-emerald-700'
                                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                                }`}
                    >
                      <CategoryIcon
                        size={16}
                        className={isSelected ? 'text-emerald-600' : 'text-gray-400'}
                      />
                      {category.title}
                    </button>
                  );
                })}
              </div>
            </Card>

            {/* Article Links */}
            <Card className='p-4 rounded-2xl border border-gray-100 shadow-sm bg-white max-h-[350px] overflow-y-auto custom-scrollbar'>
              <h3 className='text-xs font-black text-gray-400 uppercase tracking-widest px-3 mb-3'>
                Articles
              </h3>
              {filteredArticles.length > 0 ? (
                <div className='flex flex-col gap-1'>
                  {filteredArticles.map((article) => {
                    const isActive = activeArticleId === article.id;
                    return (
                      <button
                        key={article.id}
                        onClick={() => setActiveArticleId(article.id)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-left
                                                    ${
                                                      isActive
                                                        ? 'bg-slate-50 text-emerald-600 border-l-2 border-emerald-500'
                                                        : 'text-gray-500 hover:bg-slate-50/50 hover:text-gray-800'
                                                    }`}
                      >
                        <span className='truncate max-w-[200px]'>{article.title}</span>
                        <ChevronRight
                          size={12}
                          className={isActive ? 'text-emerald-500' : 'text-gray-300'}
                        />
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className='text-xs text-gray-400 italic px-3'>No matching articles found.</p>
              )}
            </Card>
          </div>

          {/* RIGHT COLUMN: Document Viewer & Sandbox */}
          <div className='lg:col-span-8 flex flex-col gap-8'>
            {/* Main Markdown Article Card */}
            <Card className='p-8 sm:p-10 rounded-[2rem] border border-gray-100 shadow-sm bg-white'>
              <div className='prose prose-slate max-w-none'>
                {/* Tags */}
                <div className='flex flex-wrap gap-1.5 mb-4'>
                  {activeArticle.tags?.map((tag) => (
                    <span
                      key={tag}
                      className='px-2.5 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-100 text-[10px] font-bold uppercase tracking-wider'
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Custom Premium Markdown rendering */}
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ node, ...props }) => (
                      <h2
                        className='text-2xl font-black text-gray-900 tracking-tight mt-2 mb-6 border-b border-gray-100 pb-3'
                        {...props}
                      />
                    ),
                    h2: ({ node, ...props }) => (
                      <h3
                        className='text-lg font-bold text-gray-800 tracking-tight mt-6 mb-3'
                        {...props}
                      />
                    ),
                    h3: ({ node, ...props }) => (
                      <h4
                        className='text-base font-bold text-gray-800 tracking-tight mt-4 mb-2'
                        {...props}
                      />
                    ),
                    p: ({ node, ...props }) => (
                      <p
                        className='text-sm text-gray-600 leading-relaxed my-3 font-medium'
                        {...props}
                      />
                    ),
                    ul: ({ node, ...props }) => (
                      <ul
                        className='list-disc pl-5 text-sm text-gray-600 space-y-1 my-3'
                        {...props}
                      />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol
                        className='list-decimal pl-5 text-sm text-gray-600 space-y-1 my-3'
                        {...props}
                      />
                    ),
                    li: ({ node, ...props }) => <li className='font-medium' {...props} />,
                    code: ({ node, inline, ...props }) =>
                      inline ? (
                        <code
                          className='bg-gray-100 text-emerald-700 px-1.5 py-0.5 rounded font-mono text-xs font-bold'
                          {...props}
                        />
                      ) : (
                        <pre
                          className='bg-slate-950 p-4 rounded-xl font-mono text-xs text-slate-300 overflow-x-auto border border-slate-900 my-4 select-text'
                          {...props}
                        />
                      ),
                  }}
                >
                  {activeArticle.content}
                </ReactMarkdown>
              </div>
            </Card>

            {/* Interactive Developer API Sandbox */}
            <Card className='p-8 rounded-[2rem] border border-emerald-100 shadow-sm bg-gradient-to-br from-emerald-50/20 to-white relative overflow-hidden'>
              <div className='absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10' />

              <h3 className='text-sm font-black text-gray-900 uppercase tracking-widest mb-2 flex items-center gap-2'>
                <Terminal className='w-4 h-4 text-emerald-600' /> Interactive Endpoint Sandbox
              </h3>
              <p className='text-xs text-gray-500 font-medium mb-6'>
                Test the AI Classification API payload live on-screen below. Send a simulated
                request to `/tickets/save` endpoint.
              </p>

              <div className='grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch'>
                {/* Left: Request editor */}
                <div className='flex flex-col gap-2'>
                  <div className='flex items-center justify-between'>
                    <span className='text-[10px] font-black text-gray-400 uppercase tracking-wider'>
                      Request Payload (JSON)
                    </span>
                    <button
                      onClick={() => handleCopy(sandboxPayload, 'payload')}
                      className='text-[10px] font-bold text-emerald-600 hover:underline flex items-center gap-1'
                    >
                      {copiedSnippet === 'payload' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedSnippet === 'payload' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <textarea
                    value={sandboxPayload}
                    onChange={(e) => setSandboxPayload(e.target.value)}
                    className='font-mono text-xs p-4 bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl resize-none min-h-[160px] focus:outline-none focus:ring-1 focus:ring-emerald-500'
                  />
                  <button
                    onClick={handleSimulateApi}
                    disabled={isSimulating}
                    className='h-10 mt-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50'
                  >
                    {isSimulating ? (
                      <>
                        <div className='w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin' />
                        Simulating API Response...
                      </>
                    ) : (
                      <>
                        Run Simulation <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>

                {/* Right: Output Terminal */}
                <div className='flex flex-col gap-2'>
                  <span className='text-[10px] font-black text-gray-400 uppercase tracking-wider'>
                    Terminal Output
                  </span>
                  <div className='flex-1 bg-slate-950 rounded-xl border border-slate-900 p-4 font-mono text-[10px] leading-relaxed text-slate-300 min-h-[160px] max-h-[220px] overflow-y-auto custom-scrollbar relative select-text'>
                    {sandboxOutput ? (
                      <pre className='whitespace-pre'>{sandboxOutput}</pre>
                    ) : (
                      <span className='text-slate-500 italic'>
                        // Click 'Run Simulation' to execute payloads...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocsPortal;

