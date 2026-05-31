/**
 * App.jsx — React Router v6 routes with lazy-loaded page components.
 *
 * All admin and user page modules are loaded dynamically via React.lazy()
 * so the initial bundle only ships auth + landing pages.  Each route group
 * is wrapped in its own Suspense boundary with an appropriate skeleton.
 */

import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { PageSkeleton, MinimalSkeleton } from './components/ui/page-skeleton';
import { NotFound } from './components/ui/not-found-2';
import Toaster from './components/shared/Toaster';
import BugReportWidget from './components/shared/BugReportWidget';
import useAuthStore from './store/authStore';
import ErrorBoundary from './components/shared/ErrorBoundary';

// ---------------------------------------------------------------------------
// Eagerly-loaded auth pages — critical path, must be instant
// ---------------------------------------------------------------------------
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Signup from './pages/Signup';
import AdminSignup from './pages/AdminSignup';
import LandingPage from './pages/LandingPage';

// Route guards (tiny, keep eager)
import AdminProtectedRoute from './components/shared/AdminProtectedRoute';
import MasterAdminProtectedRoute from './components/shared/MasterAdminProtectedRoute';
import ProtectedRoute from './components/shared/ProtectedRoute';

// ---------------------------------------------------------------------------
// Lazily-loaded lobby / shell pages
// ---------------------------------------------------------------------------
const AdminLobby = lazy(() => import('./pages/AdminLobby'));
const UserLobby  = lazy(() => import('./pages/UserLobby'));

// ---------------------------------------------------------------------------
// Lazily-loaded layouts
// ---------------------------------------------------------------------------
const UserLayout  = lazy(() => import('./user/UserLayout'));
const AdminLayout = lazy(() => import('./admin/layout/AdminLayout'));

// ---------------------------------------------------------------------------
// User Pages
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Admin Pages
// ---------------------------------------------------------------------------
const AdminDashboard    = lazy(() => import('./admin/pages/AdminDashboard'));
const AdminTickets      = lazy(() => import('./admin/pages/AdminTickets'));
const AdminTicketDetail = lazy(() => import('./admin/pages/AdminTicketDetail'));
const AdminUsers        = lazy(() => import('./admin/pages/AdminUsers'));
const AdminAnalytics    = lazy(() => import('./admin/pages/AdminAnalytics'));
const AdminProfile      = lazy(() => import('./admin/pages/AdminProfile'));
const AdminSettings     = lazy(() => import('./admin/pages/AdminSettings'));
const SLAPage           = lazy(() => import('./admin/pages/SLAPage'));

// ---------------------------------------------------------------------------
// Master-admin Pages
// ---------------------------------------------------------------------------
const MasterAdminLayout    = lazy(() => import('./master-admin/layout/MasterAdminLayout'));
const MasterAdminDashboard = lazy(() => import('./master-admin/pages/MasterAdminDashboard'));
const AllAdmins            = lazy(() => import('./master-admin/pages/AllAdmins'));
const AllCompanies         = lazy(() => import('./master-admin/pages/AllCompanies'));
const PendingAdminRequests = lazy(() => import('./master-admin/pages/PendingAdminRequests'));
const MasterBugReports     = lazy(() => import('./master-admin/pages/MasterBugReports'));

// ---------------------------------------------------------------------------
// Showcase / marketing pages (defer aggressively)
// ---------------------------------------------------------------------------
const ContactSales    = lazy(() => import('./pages/ContactSales'));
const ApiReference    = lazy(() => import('./pages/ApiReference'));
const Changelog       = lazy(() => import('./pages/Changelog'));
const StatusPage      = lazy(() => import('./pages/StatusPage'));
const AboutUs         = lazy(() => import('./pages/AboutUs'));
const Careers         = lazy(() => import('./pages/Careers'));
const DocsPortal      = lazy(() => import('./docs/pages/DocsPortal'));

// Feature pages
const AutoCategorizationFeature = lazy(() => import('./pages/features/AutoCategorizationFeature'));
const PriorityDetectionFeature  = lazy(() => import('./pages/features/PriorityDetectionFeature'));
const SmartResolutionFeature    = lazy(() => import('./pages/features/SmartResolutionFeature'));

// Legal pages
const TermsOfService = lazy(() => import('./pages/legal/TermsOfService'));
const PrivacyPolicy  = lazy(() => import('./pages/legal/PrivacyPolicy'));
const Security       = lazy(() => import('./pages/legal/Security'));
const CookiePolicy   = lazy(() => import('./pages/legal/CookiePolicy'));

// ---------------------------------------------------------------------------
// Utility Components
// ---------------------------------------------------------------------------

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

// ---------------------------------------------------------------------------
// Main App Component
// ---------------------------------------------------------------------------
export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize().catch((err) => {
      console.error('Auth initialize failed:', err);
    });
  }, [initialize]);

  // Handle docs subdomain if applicable
  const isDocsSubdomain = window.location.hostname.startsWith('docs.');

  if (isDocsSubdomain) {
    return (
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<DocsPortal />} />
            <Route path="/docs" element={<Navigate to="/" replace />} />
            <Route path="/api-reference" element={<ApiReference />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="/status" element={<StatusPage />} />
            <Route path="*" element={<DocsPortal />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <ScrollToTop />
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Toaster />
          <BugReportWidget />
          <Routes>
            {/* ── Public / Auth routes ─────────────────────────────────── */}
            <Route path="/"               element={<LandingPage />} />
            <Route path="/login"          element={<Login />} />
            <Route path="/signup"         element={<Signup />} />
            <Route path="/admin-signup"   element={<AdminSignup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />

            {/* ── Lobby routes ─────────────────────────────────────────── */}
            <Route path="/admin-lobby" element={<Suspense fallback={<MinimalSkeleton />}><AdminLobby /></Suspense>} />
            <Route path="/user-lobby"  element={<Suspense fallback={<MinimalSkeleton />}><UserLobby /></Suspense>} />

            {/* ── Marketing routes ─────────────────────────────────────── */}
            <Route path="/contact-sales" element={<Suspense fallback={<MinimalSkeleton />}><ContactSales /></Suspense>} />
            <Route path="/docs"          element={<Suspense fallback={<PageSkeleton />}><DocsPortal /></Suspense>} />
            <Route path="/api-reference" element={<Suspense fallback={<PageSkeleton />}><ApiReference /></Suspense>} />
            <Route path="/changelog"     element={<Suspense fallback={<PageSkeleton />}><Changelog /></Suspense>} />
            <Route path="/status"        element={<Suspense fallback={<MinimalSkeleton />}><StatusPage /></Suspense>} />
            <Route path="/about"         element={<Suspense fallback={<PageSkeleton />}><AboutUs /></Suspense>} />
            <Route path="/careers"       element={<Suspense fallback={<PageSkeleton />}><Careers /></Suspense>} />

            {/* Feature pages */}
            <Route path="/features/auto-categorization" element={<Suspense fallback={<PageSkeleton />}><AutoCategorizationFeature /></Suspense>} />
            <Route path="/features/priority-detection"  element={<Suspense fallback={<PageSkeleton />}><PriorityDetectionFeature /></Suspense>} />
            <Route path="/features/smart-resolution"    element={<Suspense fallback={<PageSkeleton />}><SmartResolutionFeature /></Suspense>} />

            {/* Legal pages */}
            <Route path="/terms"    element={<Suspense fallback={<MinimalSkeleton />}><TermsOfService /></Suspense>} />
            <Route path="/privacy"  element={<Suspense fallback={<MinimalSkeleton />}><PrivacyPolicy /></Suspense>} />
            <Route path="/security" element={<Suspense fallback={<MinimalSkeleton />}><Security /></Suspense>} />
            <Route path="/cookies"  element={<Suspense fallback={<MinimalSkeleton />}><CookiePolicy /></Suspense>} />

            {/* ── Protected user routes ────────────────────────────────── */}
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
            </Route>

            {/* ── Protected admin routes ───────────────────────────────── */}
            <Route element={<AdminProtectedRoute />}>
              <Route path="/admin" element={<Suspense fallback={<PageSkeleton />}><AdminLayout /></Suspense>}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard"   element={<AdminDashboard />} />
                <Route path="tickets"     element={<AdminTickets />} />
                <Route path="tickets/:id" element={<AdminTicketDetail />} />
                <Route path="users"       element={<AdminUsers />} />
                <Route path="analytics"   element={<AdminAnalytics />} />
                <Route path="settings"    element={<AdminSettings />} />
                <Route path="profile"     element={<AdminProfile />} />
                <Route path="sla"         element={<SLAPage />} />
              </Route>
            </Route>

            {/* ── Protected master-admin routes ────────────────────────── */}
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

            {/* ── Fallback ─────────────────────────────────────────────── */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
