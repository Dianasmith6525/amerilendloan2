import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import LanguageSelector from "./components/LanguageSelector";
import Home from "./pages/Home";
import ApplyLoan from "./pages/ApplyLoan";
import Dashboard from "./pages/Dashboard";
import AdminDashboardFalcon from "./pages/AdminDashboardFalcon";
import PaymentPage from "./pages/PaymentPage";
import OTPLogin from "./pages/OTPLogin";
import EnhancedPaymentPage from "./pages/EnhancedPaymentPage";
import CheckOffers from "./pages/CheckOffers";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import LegalDocuments from "./pages/LegalDocuments";
import Careers from "./pages/Careers";
import UserDashboard from "./pages/UserDashboard";
import UserProfile from "./pages/UserProfile";
import LoanDetail from "./pages/LoanDetail";
import NotificationCenter from "./pages/NotificationCenter";
import SupportCenter from "./pages/SupportCenter";
import PaymentHistory from "./pages/PaymentHistory";
import ReferralsAndRewards from "./pages/ReferralsAndRewards";
import BankAccountManagement from "./pages/BankAccountManagement";
import AdminUserManagement from "./pages/AdminUserManagement";
import AdminKYCManagement from "./pages/AdminKYCManagement";
import AdminSupportManagement from "./pages/AdminSupportManagement";
import AdminSettings from "./pages/AdminSettings";
import AdminApplicationDetail from "./pages/AdminApplicationDetail";
import PayFee from "./pages/PayFee";
import HardshipPrograms from "./pages/HardshipPrograms";
import TaxDocuments from "./pages/TaxDocuments";
import AccountClosure from "./pages/AccountClosure";
import PaymentPreferences from "./pages/PaymentPreferences";
import LiveChat from "./pages/LiveChat";
import AdminLiveChat from "./pages/admin/AdminLiveChat";
import FraudDetection from "./pages/admin/FraudDetection";
import CoSigners from "./pages/CoSigners";
import Collections from "./pages/admin/Collections";
import FinancialTools from "./pages/FinancialTools";
import ESignatures from "./pages/ESignatures";
import MarketingCampaigns from "./pages/admin/MarketingCampaigns";
import AdminVirtualCards from "./pages/admin/AdminVirtualCards";
import AdminHardshipManagement from "./pages/admin/AdminHardshipManagement";
import AdminAccountClosures from "./pages/admin/AdminAccountClosures";
import AdminTaxDocuments from "./pages/admin/AdminTaxDocuments";
import AdminESignatures from "./pages/admin/AdminESignatures";
import AdminAutomationRules from "./pages/admin/AdminAutomationRules";
import AdminInvitationCodes from "./pages/admin/AdminInvitationCodes";
import AdminJobApplications from "./pages/admin/AdminJobApplications";
import NotificationSettings from "./pages/NotificationSettings";
import About from "./pages/About";
import HowItWorksPage from "./pages/HowItWorks";
import Rates from "./pages/Rates";
import Contact from "./pages/Contact";
import Resources from "./pages/Resources";
import ArticlePage from "./pages/ArticlePage";
import VirtualDebitCard from "./pages/VirtualDebitCard";
import ChatWidget from "./components/ChatWidget";
import CookieConsent from "./components/CookieConsent";

function Router() {
  return (
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
      <Route path={"/payment/:id"} component={PaymentPage} />
      <Route path={"/pay-fee"} component={PayFee} />
      <Route path={"/otp-login"} component={OTPLogin} />
      <Route path={"/login"} component={OTPLogin} />
      <Route path={"/signup"} component={OTPLogin} />
      <Route path={"/register"} component={OTPLogin} />
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
