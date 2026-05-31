import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText, CheckCircle2 } from 'lucide-react';

const sections = [
    {
        title: '1. Acceptance of Terms',
        content: `By accessing or using HelpDesk.ai ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. These terms apply to all visitors, users, and administrators of the platform.`
    },
    {
        title: '2. Description of Service',
        content: `HelpDesk.ai is an AI-powered IT helpdesk automation platform that allows organizations to create, categorize, and manage support tickets. The platform uses artificial intelligence to assist in ticket routing, priority detection, and automated resolution of common issues.`
    },
    {
        title: '3. Account Registration & Company Onboarding',
        content: `Administrators must register their company and be verified by our Master Admin team before gaining access. You agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.`
    },
    {
        title: '4. Acceptable Use',
        content: `You agree not to misuse the Service. Prohibited activities include: attempting to gain unauthorized access to any part of the system, submitting false or misleading support tickets, using the platform for commercial resale or redistribution without written authorization, uploading malicious content, or attempting to reverse-engineer the AI models.`
    },
    {
        title: '5. Data Privacy & Security',
        content: `We take data security seriously. All data transmitted is encrypted using 256-bit TLS/SSL. Each company's data is isolated in a multi-tenant architecture. We do not sell your data to third parties. For detailed information, see our Privacy Policy. You retain ownership of all data you submit to the platform.`
    },
    {
        title: '6. AI-Generated Content',
        content: `HelpDesk.ai uses AI to analyze, categorize, and suggest resolutions for tickets. While we strive for accuracy, AI outputs may not always be correct. Human review is available and recommended for critical issues. We are not liable for actions taken based solely on AI-generated recommendations.`
    },
    {
        title: '7. Subscription & Billing (India)',
        content: `Paid plans are billed in Indian Rupees (₹). The Starter plan is free. The Growth plan is billed at ₹3,999/month. Enterprise pricing is custom and negotiated separately. All prices are exclusive of applicable GST. Subscriptions auto-renew unless cancelled before the next billing cycle.`
    },
    {
        title: '8. Intellectual Property',
        content: `The HelpDesk.ai platform, its AI models, codebase, and all associated intellectual property remain the exclusive property of HelpDesk.ai and its creators. You may not copy, modify, or distribute any part of the platform without express written permission.`
    },
    {
        title: '9. Limitation of Liability',
        content: `To the fullest extent permitted by applicable law, HelpDesk.ai shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly. Our total liability for any claim shall not exceed the amount paid by you in the preceding 12 months.`
    },
    {
        title: '10. Termination',
        content: `We reserve the right to suspend or terminate your account for violations of these Terms. You may terminate your account at any time by contacting our support team. Upon termination, your data will be retained for 30 days before permanent deletion, during which you may export it.`
    },
    {
        title: '11. Changes to Terms',
        content: `We may update these Terms of Service from time to time. We will notify registered administrators via email of any material changes. Continued use of the Service after changes become effective constitutes your acceptance of the new terms.`
    },
    {
        title: '12. Governing Law',
        content: `These Terms shall be governed by and construed in accordance with the laws of India, specifically the Information Technology Act, 2000 and associated rules. Any disputes shall be subject to the exclusive jurisdiction of the courts of Bengaluru, Karnataka, India.`
    },
    {
        title: '13. Contact',
        content: `For questions about these Terms, please contact us at: legal@helpdesk.ai`
    },
];

export default function TermsOfService() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
            <main className="flex-grow max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-12 relative z-10">
                {/* Back Navigation */}
                <div className="flex justify-center sm:justify-start">
                    <button 
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 font-bold text-xs text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors bg-transparent border-none cursor-pointer group"
                    >
                        <div className="p-1.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 group-hover:border-emerald-500/30">
                            <ArrowLeft size={14} />
                        </div>
                        <span>GO BACK</span>
                    </button>
                </div>

                {/* Main Header */}
                <div className="flex items-center text-left gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="space-y-0.5">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-syne">
                            Terms of Service
                        </h1>
                        <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                            Last updated: March 10, 2026
                        </p>
                    </div>
                </div>

                {/* Policy Notice */}
                <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 dark:border-emerald-500/20 rounded-xl p-4 flex items-start gap-3 text-slate-600 dark:text-slate-400 text-xs leading-relaxed text-left">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <p className="m-0 font-medium">
                        By using our platform, you confirm that you have read, understood, and agree to be bound by these terms. We operate under the legal jurisdiction of Bengaluru, India.
                    </p>
                </div>

                {/* Content Grid */}
                <div className="space-y-8 text-left">
                    {sections.map(({ title, content }) => (
                        <div key={title} className="space-y-2 group">
                            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight font-syne group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors duration-200">
                                {title}
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-medium">
                                {content}
                            </p>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}