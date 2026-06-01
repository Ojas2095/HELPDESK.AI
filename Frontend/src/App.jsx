/**
 * App.jsx — Unified React Router configuration for HELPDESK.AI
 * Consolidates all routes and fix syntax/duplication issues.
 */

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageSkeleton, MinimalSkeleton } from './components/ui/page-skeleton';
import { NotFound } from './components/ui/not-found-2';
import Toaster from './components/shared/Toaster';
import BugReportWidget from './components/shared/BugReportWidget';
import useRealtimeNotifications from './hooks/useRealtimeNotifications';
import useAuthStore from './store/authStore';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';
import ShortcutsHelp from './components/shared/ShortcutsHelp';
import BackToTop from './components/shared/BackToTop';
import ScrollToTopButton from './components/ScrollToTopButton';

// ---------------------------------------------------------------------------
// Eagerly-loaded auth pages
// ---------------------------------------------------------------------------
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Signup from './pages/Signup';
import AdminSignup from './pages/AdminSignup';
import LandingPage from './pages/LandingPage';
import NotApproved from './pages/NotApproved';
import AuthCallback from './pages/AuthCallback';

// Route guards
import AdminProtectedRoute from './components/shared/AdminProtectedRoute';
import MasterAdminProtectedRoute from './components/shared/MasterAdminProtectedRoute';
import ProtectedRoute from './components/shared/ProtectedRoute';

// ---------------------------------------------------------------------------
// Lazily-loaded layouts
// ---------------------------------------------------------------------------
const UserLayout  = lazy(() => import('./user/UserLayout'));
const AdminLayout = lazy(() => import('./admin/layout/AdminLayout'));
const MasterAdminLayout = lazy(() => import('./master-admin/layout/MasterAdminLayout'));

// ---------------------------------------------------------------------------
// Lazily-loaded pages
// ---------------------------------------------------------------------------
const AdminLobby = lazy(() => import('./pages/AdminLobby'));
const UserLobby  = lazy(() => import('./pages/UserLobby'));
const MasterAdminLogin = lazy(() => import('./pages/MasterAdminLogin'));

const Dashboard          = lazy(() => import('./user/pages/Dashboard'));
const CreateTicket       = lazy(() => import('./user/pages/CreateTicket'));
const MyTickets          = lazy(() => import('./user/pages/MyTickets'));
const TicketResult       = lazy(() => import('./user/pages/TicketResult'));
const Profile            = lazy(() => import('./user/pages/Profile'));
const TicketDetail       = lazy(() => import('./user/pages/TicketDetail'));
const AIProcessing       = lazy(() => import('./user/pages/AIProcessing'));
const AIUnderstanding    = lazy(() => import('./user/pages/AIUnderstanding'));
const Notifications      = lazy(() => import('./user/pages/Notifications'));
const Help               = lazy(() => import('./user/pages/Help'));
const DuplicateDetection = lazy(() => import('./user/pages/DuplicateDetection'));
const AutoResolveChat    = lazy(() => import('./user/pages/AutoResolveChat'));
const Resolved           = lazy(() => import('./user/pages/Resolved'));
const TicketTracking     = lazy(() => import('./user/pages/TicketTracking'));

const AdminDashboard    = lazy(() => import('./admin/pages/AdminDashboard'));
const AdminTickets      = lazy(() => import('./admin/pages/AdminTickets'));
const AdminTicketDetail = lazy(() => import('./admin/pages/AdminTicketDetail'));
const AdminUsers        = lazy(() => import('./admin/pages/AdminUsers'));
const AdminAnalytics    = lazy(() => import('./admin/pages/AdminAnalytics'));
const AdminProfile      = lazy(() => import('./admin/pages/AdminProfile'));
const AdminSettings     = lazy(() => import('./admin/pages/AdminSettings'));
const AdminScorecard    = lazy(() => import('./admin/components/AgentScorecard'));
const SLAPage           = lazy(() => import('./admin/pages/SLAPage'));

const MasterAdminDashboard = lazy(() => import('./master-admin/pages/MasterAdminDashboard'));
const AllAdmins            = lazy(() => import('./master-admin/pages/AllAdmins'));
const AllCompanies         = lazy(() => import('./master-admin/pages/AllCompanies'));
const PendingAdminRequests = lazy(() => import('./master-admin/pages/PendingAdminRequests'));
const MasterBugReports     = lazy(() => import('./master-admin/pages/MasterBugReports'));

const ContactSales    = lazy(() => import('./pages/ContactSales'));
const ApiReference    = lazy(() => import('./pages/ApiReference'));
const Changelog       = lazy(() => import('./pages/Changelog'));
const StatusPage      = lazy(() => import('./pages/StatusPage'));
const AboutUs         = lazy(() => import('./pages/AboutUs'));
const Careers         = lazy(() => import('./pages/Careers'));
const DocsPortal      = lazy(() => import('./docs/pages/DocsPortal'));

const AutoCategorizationFeature = lazy(() => import('./pages/features/AutoCategorizationFeature'));
const PriorityDetectionFeature  = lazy(() => import('./pages/features/PriorityDetectionFeature'));
const SmartResolutionFeature    = lazy(() => import('./pages/features/SmartResolutionFeature'));

const TermsOfService = lazy(() => import('./pages/legal/TermsOfService'));
const PrivacyPolicy  = lazy(() => import('./pages/legal/PrivacyPolicy'));
const Security       = lazy(() => import('./pages/legal/Security'));
const CookiePolicy   = lazy(() => import('./pages/legal/CookiePolicy'));

function TitleUpdater() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    let title = 'HELPDESK.AI';
    if (path.startsWith('/admin/')) title = 'Admin Portal';
    else if (path.startsWith('/master-admin/')) title = 'Master Admin';
    else if (path === '/login') title = 'Login';
    else if (path === '/signup') title = 'Sign Up';
    document.title = `${title} | HELPDESK.AI`;
  }, [location]);
  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error, info) { console.error(error, info); }
  render() {
    if (this.state.hasError) return (
      <div className="flex min-h-[40vh] items-center justify-center px-6 py-16">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-4 text-sm font-semibold text-red-600 shadow-sm">
          Something went wrong. Please refresh the page.
        </div>
      </div>
    );
    return this.props.children;
  }
}

function AppContent() {
  const { profile } = useAuthStore();
  const [showShortcuts, setShowShortcuts] = useState(false);
  useRealtimeNotifications();

  const { shortcuts } = useKeyboardShortcuts(
    profile?.role === 'admin'
      ? { 'g,a': '/admin/dashboard', 'g,t': '/admin/tickets' }
      : {},
    { onShortcutsHelp: () => setShowShortcuts(true) }
  );

  return (
    <>
      <ShortcutsHelp isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} shortcuts={shortcuts} />
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin-signup" element={<AdminSignup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/not-approved" element={<NotApproved />} />

        {/* Lobby Routes */}
        <Route path="/admin-lobby" element={<Suspense fallback={<MinimalSkeleton />}><AdminLobby /></Suspense>} />
        <Route path="/user-lobby"  element={<Suspense fallback={<MinimalSkeleton />}><UserLobby /></Suspense>} />

        {/* Marketing / Resources */}
        <Route path="/contact-sales" element={<Suspense fallback={<MinimalSkeleton />}><ContactSales /></Suspense>} />
        <Route path="/docs"          element={<Suspense fallback={<PageSkeleton />}><DocsPortal /></Suspense>} />
        <Route path="/api-reference" element={<Suspense fallback={<PageSkeleton />}><ApiReference /></Suspense>} />
        <Route path="/changelog"     element={<Suspense fallback={<PageSkeleton />}><Changelog /></Suspense>} />
        <Route path="/status"        element={<Suspense fallback={<MinimalSkeleton />}><StatusPage /></Suspense>} />
        <Route path="/about"         element={<Suspense fallback={<PageSkeleton />}><AboutUs /></Suspense>} />
        <Route path="/careers"       element={<Suspense fallback={<PageSkeleton />}><Careers /></Suspense>} />

        {/* Features */}
        <Route path="/features/auto-categorization" element={<Suspense fallback={<PageSkeleton />}><AutoCategorizationFeature /></Suspense>} />
        <Route path="/features/priority-detection"  element={<Suspense fallback={<PageSkeleton />}><PriorityDetectionFeature /></Suspense>} />
        <Route path="/features/smart-resolution"    element={<Suspense fallback={<PageSkeleton />}><SmartResolutionFeature /></Suspense>} />

        {/* Legal */}
        <Route path="/terms"    element={<Suspense fallback={<MinimalSkeleton />}><TermsOfService /></Suspense>} />
        <Route path="/privacy"  element={<Suspense fallback={<MinimalSkeleton />}><PrivacyPolicy /></Suspense>} />
        <Route path="/security" element={<Suspense fallback={<MinimalSkeleton />}><Security /></Suspense>} />
        <Route path="/cookies"  element={<Suspense fallback={<MinimalSkeleton />}><CookiePolicy /></Suspense>} />

        {/* Protected User Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/user" element={<Suspense fallback={<PageSkeleton />}><UserLayout /></Suspense>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"           element={<Dashboard />} />
            <Route path="create-ticket"       element={<CreateTicket />} />
            <Route path="my-tickets"          element={<MyTickets />} />
            <Route path="ticket-result"       element={<TicketResult />} />
            <Route path="ticket/:id"          element={<TicketDetail />} />
            <Route path="ai-processing"       element={<AIProcessing />} />
            <Route path="ai-understanding"    element={<AIUnderstanding />} />
            <Route path="notifications"       element={<Notifications />} />
            <Route path="help"                element={<Help />} />
            <Route path="duplicate-detection" element={<DuplicateDetection />} />
            <Route path="auto-resolve"        element={<AutoResolveChat />} />
            <Route path="resolved"            element={<Resolved />} />
            <Route path="ticket-tracking"     element={<TicketTracking />} />
            <Route path="profile"             element={<Profile />} />
          </Route>
          {/* Support legacy paths */}
          <Route path="/dashboard" element={<Navigate to="/user/dashboard" replace />} />
        </Route>

        {/* Protected Admin Routes */}
        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin" element={<Suspense fallback={<PageSkeleton />}><AdminLayout /></Suspense>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="tickets"   element={<AdminTickets />} />
            <Route path="tickets/:id" element={<AdminTicketDetail />} />
            <Route path="users"     element={<AdminUsers />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="settings"  element={<AdminSettings />} />
            <Route path="profile"   element={<AdminProfile />} />
            <Route path="scorecard" element={<AdminScorecard />} />
            <Route path="sla"       element={<SLAPage />} />
          </Route>
        </Route>

        {/* Master Admin Routes */}
        <Route path="/master-admin-login" element={<MasterAdminLogin />} />
        <Route element={<MasterAdminProtectedRoute />}>
          <Route path="/master-admin" element={<Suspense fallback={<PageSkeleton />}><MasterAdminLayout /></Suspense>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"        element={<MasterAdminDashboard />} />
            <Route path="admins"           element={<AllAdmins />} />
            <Route path="companies"        element={<AllCompanies />} />
            <Route path="pending-requests" element={<PendingAdminRequests />} />
            <Route path="bug-reports"      element={<MasterBugReports />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default function App() {
  const { initialize } = useAuthStore();
  useEffect(() => { 
    initialize().catch(err => console.error('Auth init failed:', err)); 
  }, [initialize]);

  return (
    <BrowserRouter>
      <TitleUpdater />
      <ScrollToTop />
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <AppContent />
          <Toaster />
          <BugReportWidget />
          <ScrollToTopButton />
          <BackToTop />
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
