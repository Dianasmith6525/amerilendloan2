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
import SEOHead from "@/components/SEOHead";

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
  const [loginMethod, setLoginMethod] = useState<"password" | "email-code">("password"); // Toggle between password and email code
  
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Validation state
  const [accountCheckEmail, setAccountCheckEmail] = useState("");
  const [showForgotPasswordOption, setShowForgotPasswordOption] = useState(false);
  const [existingAccountInfo, setExistingAccountInfo] = useState<any>(null);

  const requestEmailCodeMutation = trpc.otp.requestCode.useMutation({
    onSuccess: (data: any) => {
      // Server returns the resolved email (in case user entered a username)
      if (data.resolvedEmail) {
        setPendingIdentifier(data.resolvedEmail);
      }
      toast.success(isResetMode ? "Reset code sent to your email" : "Verification code sent to your email");
      setStep("code");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to send code");
    },
  });

  const verifyCodeMutation = trpc.otp.verifyCode.useMutation({
    onSuccess: (data) => {
      if (isResetMode) {
        // For password reset, move to password entry step instead of directly logging in
        setResetStep("newPassword");
        toast.success("Code verified! Now enter your new password.");
      } else if (isLogin) {
        toast.success("Login successful!");
        // Navigate via server endpoint so Set-Cookie is preserved through Vercel proxy
        const code = data && 'sessionCode' in data ? (data as any).sessionCode : undefined;
        setTimeout(() => { window.location.href = code ? `/api/auth/session?code=${encodeURIComponent(code)}&redirect=/dashboard` : "/dashboard"; }, 300);
      } else {
        toast.success("Account created successfully!");
        setSignupEmail("");
        setSignupUsername("");
        setSignupPassword("");
        // Navigate via server endpoint so Set-Cookie is preserved through Vercel proxy
        const code = data && 'sessionCode' in data ? (data as any).sessionCode : undefined;
        setTimeout(() => { window.location.href = code ? `/api/auth/session?code=${encodeURIComponent(code)}&redirect=/dashboard` : "/dashboard"; }, 300);
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

  // Password login mutation - tries custom password login first, then falls back to Supabase or OTP
  const passwordLoginMutation = trpc.auth.loginWithPassword.useMutation({
    onSuccess: (data) => {
      toast.success("Login successful!");
      // Navigate via server endpoint so Set-Cookie is preserved through Vercel proxy
      const code = data?.sessionCode;
      setTimeout(() => { window.location.href = code ? `/api/auth/session?code=${encodeURIComponent(code)}&redirect=/dashboard` : "/dashboard"; }, 300);
    },
    onError: (error) => {
      const errorMsg = error.message || "Failed to sign in";
      
      // Handle specific error cases
      if (errorMsg.includes("does not have a password set")) {
        // User exists but never set a password — guide them to set one
        toast.error(errorMsg);
      } else if (errorMsg.includes("Invalid email or password")) {
        toast.error("Invalid email/username or password. Check your credentials and try again.");
      } else {
        // Network or other error - show error
        toast.error(errorMsg);
      }
    },
  });

  // Fallback password login mutation (Supabase)
  const supabaseLoginMutation = trpc.auth.supabaseSignIn.useMutation({
    onSuccess: (data) => {
      toast.success("Login successful!");
      // Navigate via server endpoint so Set-Cookie is preserved through Vercel proxy
      const code = data?.sessionCode;
      setTimeout(() => { window.location.href = code ? `/api/auth/session?code=${encodeURIComponent(code)}&redirect=/dashboard` : "/dashboard"; }, 300);
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

  // Email existence checker
  const checkEmailMutation = trpc.auth.checkEmailExists.useMutation({
    onSuccess: (data: any) => {
      if (data.exists) {
        setExistingAccountInfo(data);
        setShowForgotPasswordOption(true);
        toast.info(data.message);
      }
    },
    onError: (error: any) => {
      console.error("Error checking email:", error);
    },
  });

  // Phone existence checker
  const checkPhoneMutation = trpc.auth.checkPhoneExists.useMutation({
    onSuccess: (data: any) => {
      if (data.exists) {
        setExistingAccountInfo(data);
        toast.warning(data.message);
      }
    },
    onError: (error: any) => {
      console.error("Error checking phone:", error);
    },
  });

  // SSN existence checker
  const checkSSNMutation = trpc.auth.checkSSNExists.useMutation({
    onSuccess: (data: any) => {
      if (data.exists) {
        toast.error(data.message || "This SSN is already registered");
        return;
      }
    },
    onError: (error: any) => {
      console.error("Error checking SSN:", error);
    },
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
    
    if (!loginIdentifier) {
      toast.error("Enter your email or username");
      return;
    }

    if (loginMethod === "password") {
      if (!loginPassword) {
        toast.error("Enter your password");
        return;
      }
      passwordLoginMutation.mutate({ email: loginIdentifier.trim(), password: loginPassword });
    } else {
      setPendingIdentifier(loginIdentifier.trim());
      requestEmailCodeMutation.mutate({ email: loginIdentifier.trim(), purpose: "login" });
    }
  };

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!signupEmail || !signupUsername || !signupPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    // Block submission while email check is still in progress
    if (checkEmailMutation.isPending) {
      toast.info("Checking email availability, please wait...");
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupEmail)) {
      toast.error("Please enter a valid email address");
      return;
    }

    // Check if account already exists with this email
    if (existingAccountInfo?.exists) {
      toast.error("This email is already registered! Please log in instead.");
      setIsLogin(true);
      setLoginIdentifier(signupEmail);
      setStep("form");
      return;
    }

    // If the email hasn't been checked yet (user never blurred the field), trigger a check now
    if (!existingAccountInfo && signupEmail !== accountCheckEmail) {
      checkEmailMutation.mutate({ email: signupEmail });
      toast.info("Checking email availability, please wait...");
      return;
    }

    if (signupUsername.length < 3) {
      toast.error("Username must be at least 3 characters");
      return;
    }

    if (signupUsername.length > 50) {
      toast.error("Username must be at most 50 characters");
      return;
    }

    if (signupPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
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

    setPendingIdentifier(loginIdentifier.trim());
    requestEmailCodeMutation.mutate({
      email: loginIdentifier.trim(),
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
      toast.error("Password must be at least 8 characters");
      return;
    }

    updatePasswordMutation.mutate({
      email: pendingIdentifier || loginIdentifier.trim(),
      code: code,
      newPassword: newPassword,
    });
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (code.length !== 6) {
      toast.error("Enter the 6-digit code");
      return;
    }

    verifyCodeMutation.mutate({
      identifier: pendingIdentifier,
      code,
      purpose: isResetMode ? "reset" : isLogin ? "login" : "signup",
      password: !isLogin && !isResetMode ? signupPassword : undefined,
      username: !isLogin && !isResetMode ? signupUsername : undefined,
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#f0f7f6] to-white">
      <SEOHead
        title="Log In"
        description="Sign in to your AmeriLend account to manage your loans, make payments, and track your application status."
        path="/login"
      />
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm py-0">
        <div className="container mx-auto px-4 h-16 flex items-center">
          <Link href="/">
            <a className="flex items-center gap-2">
              <img src="/images/logo-new.jpg" alt="AmeriLend" className="h-9 w-auto rounded" />
              <span className="text-xl font-bold text-[#0A2540] hidden sm:inline">AmeriLend</span>
            </a>
          </Link>
        </div>
      </header>
      
      <div className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          {/* Logo and welcome text */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-[#0A2540]">Welcome Back</h1>
            <p className="text-slate-500 mt-2">Sign in to manage your loans</p>
          </div>

        {step === "form" ? (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden">
            <div className="flex">
              <button
                onClick={toggleLogin}
                className={`flex-1 py-4 px-6 text-sm font-semibold transition-all border-b-2 ${
                  isLogin
                    ? "border-[#0A2540] text-[#0A2540] bg-white"
                    : "border-transparent text-slate-400 bg-slate-50 hover:text-slate-600"
                }`}
              >
                Sign In
              </button>
              <button
                onClick={toggleSignup}
                className={`flex-1 py-4 px-6 text-sm font-semibold transition-all border-b-2 ${
                  !isLogin
                    ? "border-[#0A2540] text-[#0A2540] bg-white"
                    : "border-transparent text-slate-400 bg-slate-50 hover:text-slate-600"
                }`}
              >
                Create Account
              </button>
            </div>

            <div className="p-8">
              {isLogin && !isResetMode && (
                <form onSubmit={handleLogin} className="space-y-5">
                  {/* Login Method Toggle */}
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setLoginMethod("password")}
                      className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                        loginMethod === "password"
                          ? "bg-white text-[#0A2540] shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Password
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoginMethod("email-code")}
                      className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${
                        loginMethod === "email-code"
                          ? "bg-white text-[#0A2540] shadow-sm"
                          : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Email Code
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email or Username</label>
                    <Input
                      type="text"
                      placeholder="Enter your email or username"
                      value={loginIdentifier}
                      onChange={(e) => {
                        setLoginIdentifier(e.target.value);
                        setShowForgotPasswordOption(false);
                        setExistingAccountInfo(null);
                      }}
                      onBlur={(e) => {
                        // Check if email exists when user leaves the field
                        const email = e.target.value.trim();
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (emailRegex.test(email) && isLogin && !isResetMode) {
                          checkEmailMutation.mutate({ email });
                        }
                      }}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0A2540]/20 focus:border-[#0A2540] transition-all"
                      required
                    />
                    {checkEmailMutation.isPending && (
                      <p className="text-sm text-slate-400 mt-2">Checking account...</p>
                    )}
                    {showForgotPasswordOption && existingAccountInfo && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                        <p className="text-sm text-blue-800">
                          {existingAccountInfo.message}
                        </p>
                        {!existingAccountInfo.hasPassword && (
                          <button
                            type="button"
                            onClick={() => {
                              setLoginMethod("email-code");
                              setShowForgotPasswordOption(false);
                            }}
                            className="text-sm text-blue-600 hover:text-blue-800 underline font-medium mt-1"
                          >
                            Use email verification code instead
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {loginMethod === "password" ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                      <div className="relative">
                        <Input
                          type={showLoginPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0A2540]/20 focus:border-[#0A2540] transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showLoginPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                      <p className="text-sm text-slate-600">
                        We'll send a 6-digit verification code to your email.
                      </p>
                    </div>
                  )}
                  
                  {loginMethod === "password" && (
                    <div className="flex items-center justify-between">
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                          className="w-4 h-4 text-[#0A2540] border-slate-300 rounded focus:ring-[#0A2540]"
                        />
                        <span className="ml-2 text-sm text-slate-600">Remember me</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-[#0A2540] hover:underline text-sm font-medium"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isLoading || supabaseLoginMutation.isPending || passwordLoginMutation.isPending}
                    className="w-full bg-[#0A2540] hover:bg-[#0A2540]/90 text-white py-3.5 rounded-lg font-semibold transition-all shadow-sm"
                  >
                    {isLoading || supabaseLoginMutation.isPending || passwordLoginMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        {loginMethod === "password" ? "Signing in..." : "Sending code..."}
                      </>
                    ) : (
                      loginMethod === "password" ? "Sign In" : "Send Verification Code"
                    )}
                  </Button>

                  <SocialAuthButtons purpose="login" />

                  <div className="text-center">
                    <a href="mailto:support@amerilendloan.com" className="text-xs text-slate-500 hover:text-[#0A2540] transition-colors">
                      Need help? Contact Support
                    </a>
                  </div>
                </form>
              )}

              {isLogin && isResetMode && (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-sm text-blue-800">
                      Enter your email or username and we'll send you a verification code to reset your password.
                    </p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email or Username</label>
                    <Input
                      type="text"
                      placeholder="Enter your email or username"
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0A2540]/20 focus:border-[#0A2540] transition-all"
                      required
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#0A2540] hover:bg-[#0A2540]/90 text-white py-3.5 rounded-lg font-semibold transition-all shadow-sm"
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
                    className="w-full text-slate-500 hover:text-[#0A2540] text-sm font-medium transition-colors"
                  >
                    ← Back to Sign In
                  </button>
                </form>
              )}

              {!isLogin && (
                <form onSubmit={handleSignup} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={signupEmail}
                      onChange={(e) => {
                        const newEmail = e.target.value;
                        setSignupEmail(newEmail);
                        if (existingAccountInfo?.email !== newEmail) {
                          setExistingAccountInfo(null);
                        }
                      }}
                      onBlur={(e) => {
                        const email = e.target.value.trim();
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (emailRegex.test(email)) {
                          checkEmailMutation.mutate({ email });
                        }
                      }}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0A2540]/20 focus:border-[#0A2540] transition-all"
                      required
                    />
                    {checkEmailMutation.isPending && (
                      <p className="text-sm text-slate-400 mt-2">Checking availability...</p>
                    )}
                    {existingAccountInfo?.exists && !isLogin && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                        <p className="text-sm text-red-700 font-medium">
                          This email is already registered.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsLogin(true);
                            setStep("form");
                            setLoginIdentifier(signupEmail);
                            setExistingAccountInfo(null);
                          }}
                          className="text-sm text-red-600 hover:text-red-800 underline font-medium mt-1"
                        >
                          Sign in instead
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
                    <Input
                      type="text"
                      placeholder="Choose a username"
                      value={signupUsername}
                      onChange={(e) => setSignupUsername(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0A2540]/20 focus:border-[#0A2540] transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
                    <div className="relative">
                      <Input
                        type={showSignupPassword ? "text" : "password"}
                        placeholder="Create a password (8+ characters)"
                        value={signupPassword}
                        onChange={(e) => setSignupPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0A2540]/20 focus:border-[#0A2540] transition-all"
                        required
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {showSignupPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-[#C9A227] hover:bg-[#B8922A] text-white py-3.5 rounded-lg font-semibold transition-all shadow-sm"
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

                  <p className="text-xs text-slate-500 text-center">
                    By creating an account, you agree to our{" "}
                    <a href="/legal/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-[#0A2540] hover:underline">
                      Terms of Service
                    </a>{" "}and{" "}
                    <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#0A2540] hover:underline">
                      Privacy Policy
                    </a>.
                  </p>

                  <SocialAuthButtons purpose="signup" className="mt-4" />
                </form>
              )}
            </div>
          </div>
        ) : isResetMode && resetStep === "newPassword" ? (
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-[#0A2540] mb-2">Create New Password</h2>
              <p className="text-slate-500">
                Enter a new secure password for your account
              </p>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">New Password</label>
                <div className="relative">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0A2540]/20 focus:border-[#0A2540] transition-all"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Confirm Password</label>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0A2540]/20 focus:border-[#0A2540] transition-all"
                    minLength={8}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                <p className="text-xs text-slate-600">
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
                className="w-full bg-[#0A2540] hover:bg-[#0A2540]/90 text-white py-3.5 rounded-lg font-semibold transition-all shadow-sm"
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
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold text-[#0A2540] mb-2">Enter Verification Code</h2>
              <p className="text-slate-500">
                We sent a code to <strong className="text-slate-700">{pendingIdentifier}</strong>
              </p>
            </div>

            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div>
                <Input
                  type="text"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full px-4 py-4 border border-slate-200 rounded-lg text-center text-2xl tracking-widest font-mono focus:ring-2 focus:ring-[#0A2540]/20 focus:border-[#0A2540] transition-all"
                  maxLength={6}
                  required
                />
                <p className="text-sm text-slate-500 text-center mt-2">
                  Check your email for the 6-digit code. It expires in 10 minutes.
                </p>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0A2540] hover:bg-[#0A2540]/90 text-white py-3.5 rounded-lg font-semibold transition-all shadow-sm"
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

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("form")}
                  className="flex-1 border-slate-200 hover:bg-slate-50"
                >
                  ← Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendCode}
                  disabled={isLoading}
                  className="flex-1 border-slate-200 hover:bg-slate-50"
                >
                  Resend Code
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-6 text-center text-sm text-slate-500">
          <p>
            <Link href="/">
              <a className="text-[#0A2540] hover:underline font-medium">
                ← Back to Home
              </a>
            </Link>
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm font-medium text-slate-600 mb-3">Trusted by leading lending platforms</p>
          <div className="flex justify-center">
            <img src="/ssl-seal.png" alt="SSL Certificate - Secure Connection" className="h-20 w-auto opacity-80" />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="text-center text-xs text-slate-500">
            <a href="/legal/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-[#0A2540] hover:underline mx-2">
              Terms of Service
            </a>
            <span className="text-slate-300">•</span>
            <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-[#0A2540] hover:underline mx-2">
              Privacy Policy
            </a>
            <span className="text-slate-300">•</span>
            <a href="mailto:support@amerilendloan.com" className="text-[#0A2540] hover:underline mx-2">
              Support
            </a>
          </div>
          <div className="text-center text-xs text-slate-400">
            <p className="flex items-center justify-center gap-2">
              <span>🔒 Protected by 256-bit SSL encryption</span>
            </p>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
