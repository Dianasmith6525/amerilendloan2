import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import ApplyLoan from "./pages/ApplyLoan";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PaymentPage from "./pages/PaymentPage";
import OTPLogin from "./pages/OTPLogin";
import EnhancedPaymentPage from "./pages/EnhancedPaymentPage";
import Prequalify from "./pages/Prequalify";
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

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/prequalify"} component={Prequalify} />
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
      <Route path={"/settings"} component={Settings} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/payment/:id"} component={PaymentPage} />
      <Route path={"/otp-login"} component={OTPLogin} />
      <Route path={"/login"} component={OTPLogin} />
      <Route path={"/careers"} component={Careers} />
      <Route path={"/payment-enhanced/:id"} component={EnhancedPaymentPage} />
      <Route path={"/legal/:document"} component={LegalDocuments} />
      <Route path={"/public/legal/:document"} component={LegalDocuments} />
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
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
