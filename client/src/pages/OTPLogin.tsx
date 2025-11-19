import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";

export default function OTPLogin() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState<"form" | "code">("form");

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, authLoading, setLocation]);
  
  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState(""); 
  const [loginPassword, setLoginPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  
  // Signup form state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  
  // OTP verification state
  const [code, setCode] = useState("");
  const [pendingIdentifier, setPendingIdentifier] = useState("");
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<"code" | "newPassword">("code");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const requestEmailCodeMutation = trpc.otp.requestCode.useMutation({
    onSuccess: () => {
      toast.success(isResetMode ? "Reset code sent to your email" : "Verification code sent to your email");
      setStep("code");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send code");
    },
  });

  const verifyCodeMutation = trpc.otp.verifyCode.useMutation({
    onSuccess: () => {
      if (isResetMode) {
        // For password reset, move to password entry step instead of directly logging in
        setResetStep("newPassword");
        toast.success("Code verified! Now enter your new password.");
      } else if (isLogin) {
        toast.success("Login successful!");
        setTimeout(() => setLocation("/dashboard"), 300);
      } else {
        toast.success("Account created successfully!");
        setSignupEmail("");
        setSignupUsername("");
        setSignupPassword("");
        setTimeout(() => setLocation("/dashboard"), 300);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Invalid code");
    },
  });

  // Password update mutation for password reset (uses OTP verification)
  const updatePasswordMutation = trpc.otp.resetPasswordWithOTP.useMutation({
    onSuccess: () => {
      toast.success("Password updated successfully! You can now log in.");
      setIsResetMode(false);
      setResetStep("code");
      setStep("form");
      setCode("");
      setLoginIdentifier("");
      setNewPassword("");
      setConfirmNewPassword("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update password");
    },
  });

  // Password login mutation (Supabase)
  const supabaseLoginMutation = trpc.auth.supabaseSignIn.useMutation({
    onSuccess: () => {
      toast.success("Login successful!");
      setTimeout(() => setLocation("/dashboard"), 300);
    },
    onError: (error) => {
      // If password login fails (service unavailable, invalid API key, etc), 
      // fall back to OTP and show the user what's happening
      const errorMsg = error.message || "Failed to sign in";
      if (errorMsg.includes("unavailable") || errorMsg.includes("not available")) {
        toast.info("Switching to email verification...");
        // Trigger OTP fallback
        if (loginIdentifier && loginPassword) {
          setPendingIdentifier(loginIdentifier);
          requestEmailCodeMutation.mutate({
            email: loginIdentifier,
            purpose: "login",
          });
        }
      } else {
        toast.error(errorMsg);
      }
    },
  });

  // Check if Supabase is enabled
  const supabaseEnabledQuery = trpc.auth.isSupabaseAuthEnabled.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const toggleLogin = () => {
    setIsLogin(true);
    setStep("form");
    setIsResetMode(false);
  };

  const toggleSignup = () => {
    setIsLogin(false);
    setStep("form");
    setIsResetMode(false);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginIdentifier || !loginPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    // If Supabase is enabled, use password login; else fall back to OTP
    const supabaseEnabled = supabaseEnabledQuery.data?.enabled;
    if (supabaseEnabled) {
      supabaseLoginMutation.mutate({ email: loginIdentifier, password: loginPassword });
      return;
    }

    // Fallback: use OTP email code
    setPendingIdentifier(loginIdentifier);
    requestEmailCodeMutation.mutate({
      email: loginIdentifier,
      purpose: "login",
    });
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupEmail || !signupUsername || !signupPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    if (signupUsername.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    if (signupPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setPendingIdentifier(signupEmail);
    requestEmailCodeMutation.mutate({
      email: signupEmail,
      purpose: "signup",
    });
  };

  const handleForgotPassword = () => {
    setIsResetMode(true);
    setStep("form");
    setIsLogin(true);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginIdentifier) {
      toast.error("Please enter your email or username");
      return;
    }

    setPendingIdentifier(loginIdentifier);
    requestEmailCodeMutation.mutate({
      email: loginIdentifier,
      purpose: "reset",
    });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmNewPassword) {
      toast.error("Please enter and confirm your new password");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    // Call the password update mutation with email, code, and new password
    updatePasswordMutation.mutate({
      email: loginIdentifier,
      code: code,
      newPassword: newPassword,
    });
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    verifyCodeMutation.mutate({
      identifier: pendingIdentifier,
      code,
      purpose: isResetMode ? "reset" : isLogin ? "login" : "signup",
    });
  };

  const handleResendCode = () => {
    requestEmailCodeMutation.mutate({
      email: pendingIdentifier,
      purpose: isResetMode ? "reset" : isLogin ? "login" : "signup",
    });
  };

  const isLoading = requestEmailCodeMutation.isPending || verifyCodeMutation.isPending;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.jpg" alt="AmeriLend" className="h-40 w-auto mb-4" style={{ mixBlendMode: 'multiply' }} />
          <h1 className="text-3xl font-bold text-[#0033A0]">AmeriLend</h1>
          <p className="text-gray-600 mt-2">Secure Authentication</p>
        </div>

        {step === "form" ? (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex border-b border-gray-200">
              <button
                onClick={toggleLogin}
                className={`flex-1 py-4 px-6 text-lg font-semibold transition-all ${
                  isLogin
                    ? "bg-[#0033A0] text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Log In
              </button>
              <button
                onClick={toggleSignup}
                className={`flex-1 py-4 px-6 text-lg font-semibold transition-all ${
                  !isLogin
                    ? "bg-[#0033A0] text-white"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
              >
                Sign Up
              </button>
            </div>

            <div className="p-8">
              {isLogin && !isResetMode && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <Input
                      type="text"
                      placeholder="Enter email or username"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0033A0] focus:border-transparent"
                      required
                    />
                  </div>

                  {supabaseEnabledQuery.data?.enabled ? (
                    <div className="relative">
                      <Input
                        type={showLoginPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0033A0] focus:border-transparent"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPassword(!showLoginPassword)}
                        className="absolute right-3 top-3 text-gray-500 hover:text-[#0033A0]"
                      >
                        {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">We'll send a 6-digit code to your email to verify your login.</p>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 text-[#0033A0] border-gray-300 rounded focus:ring-[#0033A0]"
                      />
                      <span className="ml-2 text-sm text-gray-600">Remember me</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[#0033A0] hover:underline text-sm font-medium"
                    >
                      Forgotten account?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading || supabaseLoginMutation.isPending}
                    className="w-full bg-[#0033A0] hover:bg-[#002080] text-white py-3 rounded-lg font-semibold text-lg transition-all"
                  >
                    {isLoading || supabaseLoginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {supabaseEnabledQuery.data?.enabled ? "Logging in..." : "Processing..."}
                      </>
                    ) : (
                      supabaseEnabledQuery.data?.enabled ? "Log In" : "Send Login Code"
                    )}
                  </Button>

                  <SocialAuthButtons purpose="login" />

                  <div className="text-center">
                    <a href="mailto:support@amerilendloan.com" className="text-xs text-gray-600 hover:text-[#0033A0] underline">
                      Need help logging in? Contact Support
                    </a>
                  </div>
                </form>
              )}

              {isLogin && isResetMode && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <p className="text-sm text-blue-900">
                      <strong>Account Recovery:</strong> Enter your email or username and we'll send you a verification code to restore access.
                    </p>
                  </div>
                  
                  <div>
                    <Input
                      type="text"
                      placeholder="Enter email or username"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0033A0] focus:border-transparent"
                      required
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#0033A0] hover:bg-[#002080] text-white py-3 rounded-lg font-semibold text-lg transition-all"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      "Send Reset Code"
                    )}
                  </Button>

                  <button
                    type="button"
                    onClick={() => setIsResetMode(false)}
                    className="w-full text-[#0033A0] hover:underline text-sm font-medium"
                  >
                     Back to Login
                  </button>
                </form>
              )}

              {!isLogin && (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0033A0] focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <Input
                      type="text"
                      placeholder="Choose username"
                      value={signupUsername}
                      onChange={(e) => setSignupUsername(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0033A0] focus:border-transparent"
                      required
                    />
                  </div>
                  <div className="relative">
                    <Input
                      type={showSignupPassword ? "text" : "password"}
                      placeholder="Create password"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0033A0] focus:border-transparent"
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSignupPassword(!showSignupPassword)}
                      className="absolute right-3 top-3 text-gray-500 hover:text-[#0033A0]"
                    >
                      {showSignupPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#FFA500] hover:bg-[#FF8C00] text-white py-3 rounded-lg font-semibold text-lg transition-all"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </Button>

                  <p className="text-xs text-gray-600 text-center mt-4">
                    Clicking <strong>create account</strong> means that you agree to our{" "}
                    <a href="/legal/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-[#0033A0] hover:underline">
                      terms of services
                    </a> and{" "}
                    <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#0033A0] hover:underline">
                      privacy policy
                    </a>.
                  </p>

                  <SocialAuthButtons purpose="signup" className="mt-4" />
                </form>
              )}
            </div>
          </div>
        ) : isResetMode && resetStep === "newPassword" ? (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-[#0033A0] mb-2">Create New Password</h2>
              <p className="text-gray-600">
                Enter a new secure password for your account
              </p>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0033A0] focus:border-transparent"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-[#0033A0]"
                >
                  {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="relative">
                <Input
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0033A0] focus:border-transparent"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-[#0033A0]"
                >
                  {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-900">
                  <strong>Password Requirements:</strong>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>At least 8 characters long</li>
                    <li>Mix of uppercase and lowercase letters</li>
                  </ul>
                </p>
              </div>

              <Button
                type="submit"
                disabled={updatePasswordMutation.isPending}
                className="w-full bg-[#0033A0] hover:bg-[#002080] text-white py-3 rounded-lg font-semibold text-lg transition-all"
              >
                {updatePasswordMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>

              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsResetMode(false);
                  setResetStep("code");
                  setStep("form");
                  setCode("");
                  setLoginIdentifier("");
                }}
                className="w-full"
              >
                Cancel
              </Button>
            </form>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-[#0033A0] mb-2">Enter Verification Code</h2>
              <p className="text-gray-600">
                We sent a code to <strong>{pendingIdentifier}</strong>
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div>
                <Input
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-[#0033A0] focus:border-transparent"
                  maxLength={6}
                  required
                />
                <p className="text-sm text-gray-500 text-center mt-2">
                  Check your email for the 6-digit code. It expires in 10 minutes.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0033A0] hover:bg-[#002080] text-white py-3 rounded-lg font-semibold text-lg transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </Button>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("form")}
                  className="flex-1"
                >
                   Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendCode}
                  disabled={isLoading}
                  className="flex-1"
                >
                  Resend Code
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>
            <Link href="/">
              <a className="text-[#0033A0] hover:underline font-medium">
                ← Back to Home
              </a>
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm font-semibold text-gray-700 mb-3">Trusted by leading lending platforms</p>
          <div className="flex justify-center">
            <img src="/ssl-seal.png" alt="SSL Certificate - Secure Connection" className="h-24 w-auto" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-center text-xs text-gray-600">
            <a href="/legal/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-[#0033A0] hover:underline mx-2">
              Terms of Service
            </a>
            <span className="text-gray-400">•</span>
            <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#0033A0] hover:underline mx-2">
              Privacy Policy
            </a>
            <span className="text-gray-400">•</span>
            <a href="mailto:support@amerilendloan.com" className="text-[#0033A0] hover:underline mx-2">
              Support
            </a>
          </div>
          <div className="text-center text-xs text-gray-500">
            <p className="flex items-center justify-center gap-2">
              <span>🔒 Protected by 256-bit SSL encryption</span>
              <span className="text-gray-400">•</span>
              <span>⚠️ After 5 failed attempts, account will be temporarily locked</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
