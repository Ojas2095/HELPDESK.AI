/**
 * App.jsx — React Router v6 routes with lazy-loaded page components.
 */

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageSkeleton, MinimalSkeleton } from './components/ui/page-skeleton';
import { NotFound } from './components/ui/not-found-2';
import useTicketStore from './store/ticketStore';
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

// Route guards
import AdminProtectedRoute from './components/shared/AdminProtectedRoute';
import MasterAdminProtectedRoute from './components/shared/MasterAdminProtectedRoute';
import ProtectedRoute from './components/shared/ProtectedRoute';

// ---------------------------------------------------------------------------
// Lazily-loaded pages
// ---------------------------------------------------------------------------
const AdminLobby = lazy(() => import('./pages/AdminLobby'));
const UserLobby  = lazy(() => import('./pages/UserLobby'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const MasterAdminLogin = lazy(() => import('./pages/MasterAdminLogin'));

const UserLayout  = lazy(() => import('./user/UserLayout'));
const AdminLayout = lazy(() => import('./admin/layout/AdminLayout'));
const MasterAdminLayout = lazy(() => import('./master-admin/layout/MasterAdminLayout'));

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
    if (this.state.hasError) return <div className="p-8 text-center">Something went wrong.</div>;
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

        {/* Marketing / Resources */}
        <Route path="/contact-sales" element={<Suspense fallback={<MinimalSkeleton />}><ContactSales /></Suspense>} />
        <Route path="/about" element={<Suspense fallback={<PageSkeleton />}><AboutUs /></Suspense>} />
        <Route path="/changelog" element={<Suspense fallback={<PageSkeleton />}><Changelog /></Suspense>} />

        {/* Protected User Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/user" element={<Suspense fallback={<PageSkeleton />}><UserLayout /></Suspense>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="create-ticket" element={<CreateTicket />} />
            <Route path="my-tickets" element={<MyTickets />} />
            <Route path="ticket/:id" element={<TicketDetail />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Route>

        {/* Protected Admin Routes */}
        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin" element={<Suspense fallback={<PageSkeleton />}><AdminLayout /></Suspense>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="tickets" element={<AdminTickets />} />
            <Route path="tickets/:id" element={<AdminTicketDetail />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>

        {/* Master Admin Routes */}
        <Route path="/master-admin-login" element={<MasterAdminLogin />} />
        <Route element={<MasterAdminProtectedRoute />}>
          <Route path="/master-admin" element={<Suspense fallback={<PageSkeleton />}><MasterAdminLayout /></Suspense>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<MasterAdminDashboard />} />
            <Route path="companies" element={<AllCompanies />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default function App() {
  const { initialize } = useAuthStore();
  useEffect(() => { initialize(); }, [initialize]);

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
