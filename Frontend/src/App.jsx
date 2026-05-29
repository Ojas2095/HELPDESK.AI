/**
 * App.jsx — React Router v6 routes with lazy-loaded page components.
 *
 * All admin and user page modules are loaded dynamically via React.lazy()
 * so the initial bundle only ships auth + landing pages.  Each route group
 * is wrapped in its own Suspense boundary with an appropriate skeleton.
 */

import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { PageSkeleton, MinimalSkeleton } from './components/ui/page-skeleton';
import { NotFound } from './components/ui/not-found-2';
import useTicketStore from './store/ticketStore';
import Toaster from './components/shared/Toaster';
import BugReportWidget from './components/shared/BugReportWidget';
import useRealtimeNotifications from './hooks/useRealtimeNotifications';
import useAuthStore from './store/authStore';

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
// Inner component that consumes router context
// ---------------------------------------------------------------------------
function AppRoutes() {
  const location = useLocation();
  useRealtimeNotifications();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>

        {/* ── Public / Auth routes ─────────────────────────────────────── */}
        <Route path="/"               element={<LandingPage />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/signup"         element={<Signup />} />
        <Route path="/admin-signup"   element={<AdminSignup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />

        {/* ── Lobby routes ─────────────────────────────────────────────── */}
        <Route path="/admin-lobby" element={<Suspense fallback={<MinimalSkeleton />}><AdminLobby /></Suspense>} />
        <Route path="/user-lobby"  element={<Suspense fallback={<MinimalSkeleton />}><UserLobby /></Suspense>} />

        {/* ── Marketing routes ─────────────────────────────────────────── */}
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

        {/* ── Protected user routes ────────────────────────────────────── */}
        <Route element={<ProtectedRoute />}>
          <Route path="/user" element={<Suspense fallback={<PageSkeleton />}><UserLayout /></Suspense>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"           element={<Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>} />
            <Route path="create-ticket"       element={<Suspense fallback={<PageSkeleton />}><CreateTicket /></Suspense>} />
            <Route path="my-tickets"          element={<Suspense fallback={<PageSkeleton />}><MyTickets /></Suspense>} />
            <Route path="ticket-result"       element={<Suspense fallback={<PageSkeleton />}><TicketResult /></Suspense>} />
            <Route path="ticket/:id"          element={<Suspense fallback={<PageSkeleton />}><TicketDetail /></Suspense>} />
            <Route path="ai-processing"       element={<Suspense fallback={<PageSkeleton />}><AIProcessing /></Suspense>} />
            <Route path="ai-understanding"    element={<Suspense fallback={<PageSkeleton />}><AIUnderstanding /></Suspense>} />
            <Route path="notifications"       element={<Suspense fallback={<PageSkeleton />}><Notifications /></Suspense>} />
            <Route path="help"                element={<Suspense fallback={<PageSkeleton />}><Help /></Suspense>} />
            <Route path="duplicate-detection" element={<Suspense fallback={<PageSkeleton />}><DuplicateDetection /></Suspense>} />
            <Route path="auto-resolve"        element={<Suspense fallback={<PageSkeleton />}><AutoResolveChat /></Suspense>} />
            <Route path="resolved"            element={<Suspense fallback={<PageSkeleton />}><Resolved /></Suspense>} />
            <Route path="ticket-tracking"     element={<Suspense fallback={<PageSkeleton />}><TicketTracking /></Suspense>} />
            <Route path="profile"             element={<Suspense fallback={<PageSkeleton />}><Profile /></Suspense>} />
          </Route>
        </Route>

        {/* ── Protected admin routes ───────────────────────────────────── */}
        <Route element={<AdminProtectedRoute />}>
          <Route path="/admin" element={<Suspense fallback={<PageSkeleton />}><AdminLayout /></Suspense>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<Suspense fallback={<PageSkeleton />}><AdminDashboard /></Suspense>} />
            <Route path="tickets"   element={<Suspense fallback={<PageSkeleton />}><AdminTickets /></Suspense>} />
            <Route path="tickets/:id" element={<Suspense fallback={<PageSkeleton />}><AdminTicketDetail /></Suspense>} />
            <Route path="users"     element={<Suspense fallback={<PageSkeleton />}><AdminUsers /></Suspense>} />
            <Route path="analytics" element={<Suspense fallback={<PageSkeleton />}><AdminAnalytics /></Suspense>} />
            <Route path="settings"  element={<Suspense fallback={<PageSkeleton />}><AdminSettings /></Suspense>} />
            <Route path="profile"   element={<Suspense fallback={<PageSkeleton />}><AdminProfile /></Suspense>} />
          </Route>
        </Route>

        {/* ── Master admin routes ──────────────────────────────────────── */}
        <Route element={<MasterAdminProtectedRoute />}>
          <Route path="/master-admin" element={<Suspense fallback={<PageSkeleton />}><MasterAdminLayout /></Suspense>}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard"        element={<Suspense fallback={<PageSkeleton />}><MasterAdminDashboard /></Suspense>} />
            <Route path="admins"           element={<Suspense fallback={<PageSkeleton />}><AllAdmins /></Suspense>} />
            <Route path="companies"        element={<Suspense fallback={<PageSkeleton />}><AllCompanies /></Suspense>} />
            <Route path="pending-requests" element={<Suspense fallback={<PageSkeleton />}><PendingAdminRequests /></Suspense>} />
            <Route path="bug-reports"      element={<Suspense fallback={<PageSkeleton />}><MasterBugReports /></Suspense>} />
          </Route>
        </Route>

        {/* ── 404 ─────────────────────────────────────────────────────── */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <Toaster />
      <BugReportWidget />
    </BrowserRouter>
  );
}
