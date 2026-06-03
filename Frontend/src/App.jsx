import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation
} from "react-router-dom";
import React, { useEffect, Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { NotFound } from "./components/ui/not-found-2";
import useTicketStore from "./store/ticketStore";
import Toaster from "./components/shared/Toaster";
import BugReportWidget from "./components/shared/BugReportWidget";
import useRealtimeNotifications from "./hooks/useRealtimeNotifications";

// Auth Components
const Login = React.lazy(() => import("./pages/Login"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const Signup = React.lazy(() => import("./pages/Signup"));
const AdminSignup = React.lazy(() => import("./pages/AdminSignup"));
const AdminLobby = React.lazy(() => import("./pages/AdminLobby"));
const UserLobby = React.lazy(() => import("./pages/UserLobby"));
const LandingPage = React.lazy(() => import("./pages/LandingPage"));
const ContactSales = React.lazy(() => import("./pages/ContactSales"));

// Legacy components
const DuplicateDetection = React.lazy(() => import("./user/pages/DuplicateDetection"));
const AutoResolveChat = React.lazy(() => import("./user/pages/AutoResolveChat"));
const Resolved = React.lazy(() => import("./user/pages/Resolved"));
const TicketTracking = React.lazy(() => import("./user/pages/TicketTracking"));
// Layouts
const UserLayout = React.lazy(() => import("./user/UserLayout"));
const AdminLayout = React.lazy(() => import("./admin/layout/AdminLayout"));

// User Pages
const Dashboard = React.lazy(() => import("./user/pages/Dashboard"));
const CreateTicket = React.lazy(() => import("./user/pages/CreateTicket"));
const MyTickets = React.lazy(() => import("./user/pages/MyTickets"));
const TicketResult = React.lazy(() => import("./user/pages/TicketResult"));
const Profile = React.lazy(() => import("./user/pages/Profile"));
const TicketDetail = React.lazy(() => import("./user/pages/TicketDetail"));
import TicketProcessing from "./user/pages/AIProcessing"; // Renamed generic import just in case, but keeping AIProcessing
const AIProcessing = React.lazy(() => import("./user/pages/AIProcessing"));
const AIUnderstanding = React.lazy(() => import("./user/pages/AIUnderstanding"));
const Notifications = React.lazy(() => import("./user/pages/Notifications"));
const Help = React.lazy(() => import("./user/pages/Help"));
const DocsPortal = React.lazy(() => import("./docs/pages/DocsPortal"));

// New Showcase Pages
const ApiReference = React.lazy(() => import("./pages/ApiReference"));
const Changelog = React.lazy(() => import("./pages/Changelog"));
const StatusPage = React.lazy(() => import("./pages/StatusPage"));
const AboutUs = React.lazy(() => import("./pages/AboutUs"));
const Careers = React.lazy(() => import("./pages/Careers"));
const CookiePolicy = React.lazy(() => import("./pages/legal/CookiePolicy"));

// NEW Admin Pages (Refactored)
const AdminDashboard = React.lazy(() => import("./admin/pages/AdminDashboard"));
const AdminTickets = React.lazy(() => import("./admin/pages/AdminTickets"));
const AdminTicketDetail = React.lazy(() => import("./admin/pages/AdminTicketDetail"));
const AdminUsers = React.lazy(() => import("./admin/pages/AdminUsers"));
const AdminAnalytics = React.lazy(() => import("./admin/pages/AdminAnalytics"));
const AdminProfile = React.lazy(() => import("./admin/pages/AdminProfile"));
const AdminSettings = React.lazy(() => import("./admin/pages/AdminSettings"));
const MasterBugReports = React.lazy(() => import("./master-admin/pages/MasterBugReports"));

// Feature Pages
const AutoCategorizationFeature = React.lazy(() => import("./pages/features/AutoCategorizationFeature"));
const PriorityDetectionFeature = React.lazy(() => import("./pages/features/PriorityDetectionFeature"));
const SmartResolutionFeature = React.lazy(() => import("./pages/features/SmartResolutionFeature"));

// Legal Pages
const TermsOfService = React.lazy(() => import("./pages/legal/TermsOfService"));
const PrivacyPolicy = React.lazy(() => import("./pages/legal/PrivacyPolicy"));
const Security = React.lazy(() => import("./pages/legal/Security"));
import AdminProtectedRoute from "./components/shared/AdminProtectedRoute";
import MasterAdminProtectedRoute from "./components/shared/MasterAdminProtectedRoute";
import ProtectedRoute from "./components/shared/ProtectedRoute";
import useAuthStore from "./store/authStore";
const NotApproved = React.lazy(() => import("./pages/NotApproved"));

// Master Admin Components
const MasterAdminLogin = React.lazy(() => import("./pages/MasterAdminLogin"));
const MasterAdminLayout = React.lazy(() => import("./master-admin/layout/MasterAdminLayout"));
const MasterAdminDashboard = React.lazy(() => import("./master-admin/pages/MasterAdminDashboard"));
const PendingAdminRequests = React.lazy(() => import("./master-admin/pages/PendingAdminRequests"));
const AllCompanies = React.lazy(() => import("./master-admin/pages/AllCompanies"));
const AllAdmins = React.lazy(() => import("./master-admin/pages/AllAdmins"));


function TitleUpdater() {
  const location = useLocation();

  useEffect(() => {
    const path = location.pathname;
    let title = 'HELPDESK.AI';

    // Admin Routes
    if (path.startsWith('/admin/ticket/')) title = 'Ticket Detail | Admin';
    else if (path.startsWith('/admin/dashboard')) title = 'Admin Dashboard';
    else if (path.startsWith('/admin/tickets')) title = 'Admin Tickets';
    else if (path.startsWith('/admin/users')) title = 'Manage Users | Admin';
    else if (path.startsWith('/admin/analytics')) title = 'Analytics | Admin';
    else if (path.startsWith('/admin/profile')) title = 'Admin Profile';
    else if (path.startsWith('/admin/settings')) title = 'Settings | Admin';
    // Master Admin Routes
    else if (path.startsWith('/master-admin/dashboard')) title = 'Master Dashboard';
    else if (path.startsWith('/master-admin/admin-requests')) title = 'Pending Requests | Master Admin';
    else if (path.startsWith('/master-admin/companies')) title = 'Companies | Master Admin';
    else if (path.startsWith('/master-admin/all-admins')) title = 'All Admins | Master Admin';
    else if (path.startsWith('/master-admin/bug-reports')) title = 'System Bug Radar | Master Admin';
    // User Routes
    else if (path.startsWith('/ticket/')) title = 'Ticket Detail';
    else if (path.startsWith('/ai-understanding')) title = 'AI Understanding';
    else if (path.startsWith('/ai-processing')) title = 'AI Processing';
    else if (path === '/dashboard') title = 'User Dashboard';
    else if (path === '/create-ticket') title = 'Create Ticket';
    else if (path === '/my-tickets') title = 'My Tickets';
    else if (path === '/profile') title = 'User Profile';
    else if (path === '/notifications') title = 'Notifications';
    else if (path === '/docs') title = 'Documentation';
    else if (path === '/api-reference') title = 'API Reference';
    else if (path === '/changelog') title = 'Changelog';
    else if (path === '/status') title = 'Status';
    else if (path === '/about') title = 'About Us';
    else if (path === '/careers') title = 'Careers';
    else if (path === '/cookie-policy') title = 'Cookie Policy';
    // Public / Lobby Routes
    else if (path === '/login') title = 'Login';
    else if (path === '/signup') title = 'Create Account';
    else if (path === '/admin-signup') title = 'Admin Signup';
    else if (path === '/user-lobby') title = 'User Lobby';
    else if (path === '/admin-lobby') title = 'Admin Lobby';
    else if (path === '/') title = 'Welcome';

    document.title = title === 'HELPDESK.AI' ? title : `${title} | HELPDESK.AI`;
  }, [location]);

  return null;
}

// Scrolls to top on every route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}

function AppLayout() {
  const { user, profile } = useAuthStore();

  // Initialize Global Realtime Notifications Listener
  useRealtimeNotifications();

  useEffect(() => {
    if (!user) return;
    const handleFocus = () => {
      useTicketStore.persist.rehydrate();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user]);

  // ProtectedRoute handles the redirect to /login if user is not present
  // but we still need to handle role-based navigation here
  return (
    <>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>}>
          <Routes>
        <Route path="/knowledge-check" element={<DuplicateDetection />} />
        <Route path="/auto-resolve" element={<AutoResolveChat />} />
        <Route path="/resolved" element={<Resolved />} />

        {/* --- User Portal --- */}
        <Route element={
          profile?.role === 'master_admin' ? <Navigate to="/master-admin/dashboard" replace /> :
            (profile?.role === 'admin' || profile?.role === 'super_admin') ? <Navigate to="/admin/dashboard" replace /> :
              profile?.status === 'pending_approval' ? <Navigate to="/user-lobby" replace /> :
                profile?.status === 'rejected' ? <Navigate to="/not-approved" replace /> :
                  <UserLayout />
        }>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create-ticket" element={<CreateTicket />} />
          <Route path="/my-tickets" element={<MyTickets />} />
          <Route path="/ticket/:ticket_id" element={<TicketDetail />} />
          <Route path="/ai-processing" element={<AIProcessing />} />
          <Route path="/ai-understanding" element={<AIUnderstanding />} />
          <Route path="/ticket-tracking" element={<TicketTracking />} />
          <Route path="/ticket-result" element={<TicketResult />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/help" element={<Help />} />
          <Route path="/notifications" element={<Notifications />} />
        </Route>

        {/* --- Admin Portal (Protected) --- */}
        <Route element={<AdminProtectedRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/tickets" element={<AdminTickets />} />
            <Route path="/admin/ticket/:ticket_id" element={<AdminTicketDetail />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/profile" element={<AdminProfile />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
        </Suspense>
    </>
  );
}


function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  const isDocsSubdomain = window.location.hostname.startsWith('docs.');

  if (isDocsSubdomain) {
    return (
      <BrowserRouter>
        <TitleUpdater />
        <ScrollToTop />
        <Toaster />
        <BugReportWidget />
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>}>
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
      <TitleUpdater />
      <ScrollToTop />
      <Toaster />
      <BugReportWidget />
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>}>
          <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/admin-signup" element={<AdminSignup />} />
        <Route path="/admin-lobby" element={<AdminLobby />} />
        <Route path="/user-lobby" element={<UserLobby />} />
        <Route path="/not-approved" element={<NotApproved />} />
        <Route path="/contact-sales" element={<ContactSales />} />
        <Route path="/docs" element={<DocsPortal />} />
        <Route path="/api-reference" element={<ApiReference />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/status" element={<StatusPage />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />

        {/* Feature Pages */}
        <Route path="/features/categorization" element={<AutoCategorizationFeature />} />
        <Route path="/features/priority" element={<PriorityDetectionFeature />} />
        <Route path="/features/resolution" element={<SmartResolutionFeature />} />

        {/* Legal Pages */}
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/security" element={<Security />} />

        {/* Master Admin Portal */}
        <Route path="/master-admin-login" element={<MasterAdminLogin />} />

        <Route element={<MasterAdminProtectedRoute />}>
          <Route element={<MasterAdminLayout />}>
            <Route path="/master-admin/dashboard" element={<MasterAdminDashboard />} />
            <Route path="/master-admin/admin-requests" element={<PendingAdminRequests />} />
            <Route path="/master-admin/companies" element={<AllCompanies />} />
            <Route path="/master-admin/all-admins" element={<AllAdmins />} />
            <Route path="/master-admin/bug-reports" element={<MasterBugReports />} />
          </Route>
        </Route>

        {/* Protected */}
        <Route element={<ProtectedRoute />}>
          <Route path="/*" element={<AppLayout />} />
        </Route>
      </Routes>
        </Suspense>
    </BrowserRouter>
  );
}

export default App;

