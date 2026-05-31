import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, Sparkles } from 'lucide-react';

const sections = [
    {
        title: '1. Information We Collect',
        content: `When you register on HelpDesk.ai, we collect: (a) Personal Information — your full name, work email, phone number, job title, and password (stored as a secure hash). (b) Company Information — company name, size, industry, website, and country. (c) Usage Data — log files, IP addresses, browser type, pages viewed, and time spent on the platform. (d) Support Ticket Content — text, images, and attachments submitted as tickets within the platform.`
    },
    {
        title: '2. How We Use Your Information',
        content: `We use the information we collect to: provide and improve the HelpDesk.ai service; authenticate users and prevent unauthorized access; process and route support tickets using our AI engine; send system notifications, account updates, and approval status emails; analyze usage patterns to improve the platform; comply with legal requirements and enforce our Terms of Service.`
    },
    {
        title: '3. Data Isolation & Multi-tenancy',
        content: `Each registered company on HelpDesk.ai has its data isolated from all other companies. Employees can only view tickets from their own organization. Admins can only manage their company's data. Master Admins can view aggregate metadata but not individual ticket content. This architecture ensures your organizational data is never visible to other tenants.`
    },
    {
        title: '4. AI Processing of Ticket Data',
        content: `Ticket content submitted to HelpDesk.ai is processed by our AI engine to perform categorization, priority detection, and duplicate checking. This processing occurs on our secure servers. We do not use your ticket content to train AI models for external customers. Processed data is used solely to deliver the service to your organization.`
    },
    {
        title: '5. Data Retention',
        content: `We retain your data for as long as your account is active. Upon account termination, your data is retained for 30 days for recovery purposes, after which it is permanently deleted from our servers. Support tickets are retained for the duration of your subscription and for 60 days after cancellation to allow for export.`
    },
    {
        title: '6. Data Security',
        content: `We implement industry-standard security measures including: 256-bit TLS encryption in transit; AES-256 encryption at rest; role-based access controls (RBAC); regular security audits and penetration testing; Supabase Row Level Security (RLS) policies isolating each tenant's data; access logging and anomaly detection.`
    },
    {
        title: '7. Third-Party Services',
        content: `HelpDesk.ai uses the following trusted third-party services: Supabase (database & authentication), Google Gemini API (AI analysis), Vercel (frontend hosting), and cloud infrastructure providers. These services are bound by their own privacy policies and are used solely to operate the HelpDesk.ai platform. We do not share personal data with any advertising or marketing platforms.`
    },
    {
        title: '8. Cookies & Tracking',
        content: `We use session cookies for authentication and local storage for user preferences. We do not use third-party advertising cookies. Analytics are limited to anonymous, aggregate usage data. You can disable cookies in your browser settings, though some features may not function correctly without them.`
    },
    {
        title: '9. Your Rights (DPDP India / GDPR)',
        content: `You have the right to: access the personal data we hold about you; request correction of inaccurate data; request deletion of your data ("right to be forgotten"); object to certain types of processing; request portability of your data in a machine-readable format. To exercise these rights, contact us at privacy@helpdesk.ai.`
    },
    {
        title: '10. Children\'s Privacy',
        content: `HelpDesk.ai is designed for use by IT professionals and enterprise organizations. We do not knowingly collect personal information from individuals under 18 years of age. If you believe a minor has provided us with personal data, please contact us immediately.`
    },
    {
        title: '11. Changes to This Policy',
        content: `We may update this Privacy Policy periodically. When we make material changes, we will notify registered admins via email and update the "Last updated" date at the top of this page. Continued use of the service after such changes constitutes acceptance of the new policy.`
    },
    {
        title: '12. Contact Us',
        content: `For privacy-related inquiries: privacy@helpdesk.ai\nFor security vulnerabilities (responsible disclosure): security@helpdesk.ai\nRegistered Office (for legal correspondence): [Bengaluru, India]`
    },
];

export default function PrivacyPolicy() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col transition-colors duration-300 w-full overflow-x-hidden">
            {/* Tightened Container */}
            <main className="flex-grow max-w-3xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8 sm:space-y-12 relative z-10">
                {/* Compact Navigation */}
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

                {/* Compact Identity Header */}
                <div className="flex items-center text-left gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center shrink-0">
                        <Shield className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div className="space-y-0.5">
                        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight font-syne">
                            Privacy Policy
                        </h1>
                        <p className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                            Updated: March 10, 2026
                        </p>
                    </div>
                </div>

                {/* Compact Compliance Banner */}
                <div className="bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 dark:border-emerald-500/20 rounded-xl p-4 flex items-start gap-3 text-slate-600 dark:text-slate-400 text-xs leading-relaxed text-left">
                    <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <p className="m-0 font-medium">
                        We comply with India's DPDP Act 2023 and maintain international GDPR standards. Your organizational data remains strictly isolated.
                    </p>
                </div>

                {/* Streamlined Body Content */}
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