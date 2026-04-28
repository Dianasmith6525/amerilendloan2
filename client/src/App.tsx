// Build marker: 2026-04-28T12:45 — force Vercel cache bust
import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import LanguageSelector from "./components/LanguageSelector";
import Home from "./pages/Home";
import ChatWidget from "./components/ChatWidget";
import CookieConsent from "./components/CookieConsent";
import useRobotsNoindex from "./hooks/useRobotsNoindex";

// Lazy-loaded route components for code splitting
const ApplyLoan = lazy(() => import("./pages/ApplyLoan"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const AdminDashboardFalcon = lazy(() => import("./pages/AdminDashboardFalcon"));
const PaymentPage = lazy(() => import("./pages/PaymentPage"));
const OTPLogin = lazy(() => import("./pages/OTPLogin"));
const EnhancedPaymentPage = lazy(() => import("./pages/EnhancedPaymentPage"));
const CheckOffers = lazy(() => import("./pages/CheckOffers"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const LegalDocuments = lazy(() => import("./pages/LegalDocuments"));
const Careers = lazy(() => import("./pages/Careers"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const LoanDetail = lazy(() => import("./pages/LoanDetail"));
const NotificationCenter = lazy(() => import("./pages/NotificationCenter"));
const SupportCenter = lazy(() => import("./pages/SupportCenter"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const ReferralsAndRewards = lazy(() => import("./pages/ReferralsAndRewards"));
const BankAccountManagement = lazy(() => import("./pages/BankAccountManagement"));
const AdminUserManagement = lazy(() => import("./pages/AdminUserManagement"));
const AdminKYCManagement = lazy(() => import("./pages/AdminKYCManagement"));
const AdminSupportManagement = lazy(() => import("./pages/AdminSupportManagement"));
const AdminSettings = lazy(() => import("./pages/AdminSettings"));
const AdminApplicationDetail = lazy(() => import("./pages/AdminApplicationDetail"));
const PayFee = lazy(() => import("./pages/PayFee"));
const HardshipPrograms = lazy(() => import("./pages/HardshipPrograms"));
const TaxDocuments = lazy(() => import("./pages/TaxDocuments"));
const AccountClosure = lazy(() => import("./pages/AccountClosure"));
const PaymentPreferences = lazy(() => import("./pages/PaymentPreferences"));
const LiveChat = lazy(() => import("./pages/LiveChat"));
const AdminLiveChat = lazy(() => import("./pages/admin/AdminLiveChat"));
const FraudDetection = lazy(() => import("./pages/admin/FraudDetection"));
const CoSigners = lazy(() => import("./pages/CoSigners"));
const Collections = lazy(() => import("./pages/admin/Collections"));
const FinancialTools = lazy(() => import("./pages/FinancialTools"));
const ESignatures = lazy(() => import("./pages/ESignatures"));
const MarketingCampaigns = lazy(() => import("./pages/admin/MarketingCampaigns"));
const AdminVirtualCards = lazy(() => import("./pages/admin/AdminVirtualCards"));
const AdminHardshipManagement = lazy(() => import("./pages/admin/AdminHardshipManagement"));
const AdminAccountClosures = lazy(() => import("./pages/admin/AdminAccountClosures"));
const AdminTaxDocuments = lazy(() => import("./pages/admin/AdminTaxDocuments"));
const AdminESignatures = lazy(() => import("./pages/admin/AdminESignatures"));
const AdminAutomationRules = lazy(() => import("./pages/admin/AdminAutomationRules"));
const AdminInvitationCodes = lazy(() => import("./pages/admin/AdminInvitationCodes"));
const AdminJobApplications = lazy(() => import("./pages/admin/AdminJobApplications"));
const AdminSystemHealth = lazy(() => import("./pages/admin/AdminSystemHealth"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const About = lazy(() => import("./pages/About"));
const HowItWorksPage = lazy(() => import("./pages/HowItWorks"));
const Rates = lazy(() => import("./pages/Rates"));
const Contact = lazy(() => import("./pages/Contact"));
const Resources = lazy(() => import("./pages/Resources"));
const ArticlePage = lazy(() => import("./pages/ArticlePage"));
const VirtualDebitCard = lazy(() => import("./pages/VirtualDebitCard"));

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function Router() {
  // Auto-noindex private routes (dashboards, admin, payments, auth) so
  // search engines stop treating them as canonical landing pages.
  useRobotsNoindex();

  return (
    <Suspense fallback={<RouteLoadingFallback />}>
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/check-offers"} component={CheckOffers} />
      <Route path="/prequalify">{() => <Redirect to="/check-offers" />}</Route>
      <Route path={"/apply"} component={ApplyLoan} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/user-dashboard"} component={UserDashboard} />
      <Route path={"/profile"} component={Profile} />
      <Route path={"/user-profile"} component={UserProfile} />
      <Route path={"/loans/:id"} component={LoanDetail} />
      <Route path={"/notifications"} component={NotificationCenter} />
      <Route path={"/support"} component={SupportCenter} />
      <Route path={"/payment-history"} component={PaymentHistory} />
      <Route path={"/referrals"} component={ReferralsAndRewards} />
      <Route path={"/bank-accounts"} component={BankAccountManagement} />
      <Route path={"/hardship"} component={HardshipPrograms} />
      <Route path={"/tax-documents"} component={TaxDocuments} />
      <Route path={"/account-closure"} component={AccountClosure} />
      <Route path={"/payment-preferences"} component={PaymentPreferences} />
      <Route path={"/chat"} component={LiveChat} />
      <Route path={"/co-signers"} component={CoSigners} />
      <Route path={"/financial-tools"} component={FinancialTools} />
      <Route path={"/virtual-card"} component={VirtualDebitCard} />
      <Route path={"/e-signatures"} component={ESignatures} />
      <Route path={"/notification-settings"} component={NotificationSettings} />
      <Route path={"/settings"} component={Settings} />
      <Route path={"/admin"} component={AdminDashboardFalcon} />
      <Route path={"/admin/application/:id"} component={AdminApplicationDetail} />
      <Route path={"/admin/settings"} component={AdminSettings} />
      <Route path={"/admin/users"} component={AdminUserManagement} />
      <Route path={"/admin/kyc"} component={AdminKYCManagement} />
      <Route path={"/admin/support"} component={AdminSupportManagement} />
      <Route path={"/admin/chat"} component={AdminLiveChat} />
      <Route path={"/admin/fraud"} component={FraudDetection} />
      <Route path={"/admin/collections"} component={Collections} />
      <Route path={"/admin/marketing"} component={MarketingCampaigns} />
      <Route path={"/admin/virtual-cards"} component={AdminVirtualCards} />
      <Route path={"/admin/hardship"} component={AdminHardshipManagement} />
      <Route path={"/admin/account-closures"} component={AdminAccountClosures} />
      <Route path={"/admin/tax-documents"} component={AdminTaxDocuments} />
      <Route path={"/admin/e-signatures"} component={AdminESignatures} />
      <Route path={"/admin/automation"} component={AdminAutomationRules} />
      <Route path={"/admin/invitations"} component={AdminInvitationCodes} />
      <Route path={"/admin/job-applications"} component={AdminJobApplications} />
      <Route path={"/admin/system-health"} component={AdminSystemHealth} />
      <Route path={"/payment/:id"} component={PaymentPage} />
      <Route path={"/pay-fee"} component={PayFee} />
      <Route path={"/otp-login"} component={OTPLogin} />
      <Route path={"/login"} component={OTPLogin} />
      <Route path={"/signup"} component={OTPLogin} />
      <Route path={"/register"} component={OTPLogin} />
      {/* Password-reset entry points (linked from email notifications). All
          land on OTPLogin which auto-enters reset mode based on the path. */}
      <Route path={"/forgot-password"} component={OTPLogin} />
      <Route path={"/auth/reset-password"} component={OTPLogin} />
      <Route path={"/reset-password"} component={OTPLogin} />
      <Route path={"/account/security"} component={OTPLogin} />
      <Route path="/about" component={About} />
      <Route path="/how-it-works" component={HowItWorksPage} />
      <Route path="/rates" component={Rates} />
      <Route path="/contact" component={Contact} />
      <Route path="/resources/:slug" component={ArticlePage} />
      <Route path="/resources" component={Resources} />
      <Route path="/careers" component={Careers} />
      <Route path={"/payment-enhanced/:id"} component={EnhancedPaymentPage} />
      <Route path={"/legal/:document"} component={LegalDocuments} />
      <Route path="/public/legal/:document">{(params) => <Redirect to={`/legal/${params.document}`} />}</Route>
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
          <ChatWidget />
          <LanguageSelector />
          <CookieConsent />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
