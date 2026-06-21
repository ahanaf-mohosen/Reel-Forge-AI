import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, AlertCircle } from "lucide-react";
import { SiGoogle } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { resetDismissedAnnouncements } from "@/components/announcements-popup";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/hooks/use-auth";
import { getHomePath } from "@/lib/homePath";
import logoImage from "@assets/logo.png";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google sign-in is not configured on the server.",
  google_auth_cancelled: "Google sign-in was cancelled.",
  google_profile_missing: "Could not read your Google profile. Try again.",
  google_auth_failed: "Google sign-in failed. Please try again.",
};

export default function Auth() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [authView, setAuthView] = useState<'default' | 'forgot' | 'reset'>('default');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetPasswordData, setResetPasswordData] = useState({ password: '', confirmPassword: '' });
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const homePath = getHomePath(user);

  const [signInData, setSignInData] = useState({ identifier: '', password: '' });
  const [signUpData, setSignUpData] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const verifyToken = params.get("verify");
    const resetParam = params.get("reset");
    const verified = params.get("verified");

    if (resetParam) {
      setResetToken(resetParam);
      setAuthView("reset");
      window.history.replaceState({}, "", "/auth");
    }

    if (error) {
      toast({
        title: "Google sign-in failed",
        description: GOOGLE_ERROR_MESSAGES[error] || "Something went wrong. Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/auth");
    }

    if (verified === "true") {
      toast({
        title: "Email verified",
        description: "Your email has been verified. You can sign in now.",
      });
      window.history.replaceState({}, "", "/auth");
    }

    if (verifyToken) {
      setIsLoading(true);
      fetch(`/api/auth/verify-email?token=${encodeURIComponent(verifyToken)}`, {
        credentials: "include",
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) {
            resetDismissedAnnouncements();
            queryClient.clear();
            toast({
              title: "Email verified",
              description: "Your account is ready. Redirecting…",
            });
            window.location.href = data?.user?.isAdmin ? "/admin" : "/dashboard";
          } else {
            toast({
              title: "Verification failed",
              description: data.message || "Invalid or expired link.",
              variant: "destructive",
            });
            window.history.replaceState({}, "", "/auth");
          }
        })
        .catch(() => {
          toast({
            title: "Verification failed",
            description: "Something went wrong. Please try again.",
            variant: "destructive",
          });
          window.history.replaceState({}, "", "/auth");
        })
        .finally(() => setIsLoading(false));
    }
  }, [toast]);

  const handleResendVerification = async (email: string) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        if (data.verifyUrl) {
          setDevVerifyUrl(data.verifyUrl);
        }
        toast({
          title: "Verification email sent",
          description: data.emailSent
            ? `Check ${email} for the verification link.`
            : "SMTP is not configured — use the dev link shown below.",
        });
      } else {
        toast({
          title: "Could not resend",
          description: data.message || "Please try again later.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Could not resend",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setDevResetUrl(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotPasswordEmail.trim() }),
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok) {
        setForgotPasswordSent(true);
        if (data.resetUrl) {
          setDevResetUrl(data.resetUrl);
        }
        toast({
          title: "Check your email",
          description: data.emailSent
            ? `If an account exists, we sent a reset link to ${forgotPasswordEmail.trim()}.`
            : "SMTP is not configured — use the dev link shown below.",
        });
      } else {
        toast({
          title: "Request failed",
          description: data.message || "Please try again later.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Request failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (resetPasswordData.password !== resetPasswordData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }

    if (resetPasswordData.password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (!resetToken) {
      toast({
        title: "Invalid reset link",
        description: "Please request a new password reset email.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetToken,
          password: resetPasswordData.password,
        }),
        credentials: "include",
      });
      const data = await res.json();

      if (res.ok) {
        resetDismissedAnnouncements();
        queryClient.clear();
        toast({
          title: "Password updated",
          description: "Your password has been reset. Redirecting…",
        });
        window.location.href = data?.user?.isAdmin ? "/admin" : "/dashboard";
      } else {
        toast({
          title: "Reset failed",
          description: data.message || "Invalid or expired reset link.",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Reset failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setPendingVerificationEmail(null);
    setDevVerifyUrl(null);
    
    try {
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: signInData.identifier.trim(),
          password: signInData.password,
        }),
        credentials: 'include',
        cache: 'no-store',
      });
      
      if (res.ok) {
        const data = await res.json();
        resetDismissedAnnouncements();
        queryClient.clear();
        window.location.href = data?.user?.isAdmin ? '/admin' : '/dashboard';
      } else {
        const error = await res.json();
        if (error.requiresVerification && error.email) {
          setPendingVerificationEmail(error.email);
          toast({
            title: "Email not verified",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Sign in failed",
            description: error.message || "Invalid email or password",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "Sign in failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (signUpData.password !== signUpData.confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure your passwords match.",
        variant: "destructive",
      });
      return;
    }
    
    if (signUpData.password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters.",
        variant: "destructive",
      });
      return;
    }

    if (!acceptedTerms) {
      toast({
        title: "Terms required",
        description: "Please accept the Terms and Privacy to create an account.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);
    setDevVerifyUrl(null);
    
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signUpData.name,
          email: signUpData.email,
          password: signUpData.password,
        }),
        credentials: 'include',
      });
      
      const data = await res.json();

      if (res.ok && data.requiresVerification) {
        setPendingVerificationEmail(data.email);
        if (data.verifyUrl) {
          setDevVerifyUrl(data.verifyUrl);
        }
        toast({
          title: "Check your email",
          description: data.emailSent
            ? `We sent a verification link to ${data.email}.`
            : "SMTP is not configured — use the dev link shown below.",
        });
      } else if (res.ok) {
        resetDismissedAnnouncements();
        queryClient.clear();
        window.location.href = data?.user?.isAdmin ? '/admin' : '/dashboard';
      } else {
        toast({
          title: "Sign up failed",
          description: data.message || "Could not create account",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Sign up failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    window.location.href = '/api/auth/google';
  };

  if (pendingVerificationEmail) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-6 h-16 flex items-center justify-between">
            <Link href={homePath} className="flex items-center">
              <img src={logoImage} alt="Reels Forge.AI" className="h-8 w-auto" />
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md border-0 shadow-lg">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-xl font-semibold">Verify your email</h1>
              <p className="text-sm text-muted-foreground">
                We sent a verification link to{" "}
                <span className="font-medium text-foreground">{pendingVerificationEmail}</span>.
                Click the link in that email to activate your account.
              </p>

              {devVerifyUrl && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left text-sm">
                  <p className="font-medium text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Dev mode — no SMTP configured
                  </p>
                  <a
                    href={devVerifyUrl}
                    className="text-primary underline underline-offset-4 break-all"
                  >
                    {devVerifyUrl}
                  </a>
                </div>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  onClick={() => handleResendVerification(pendingVerificationEmail)}
                  disabled={isLoading}
                >
                  {isLoading ? "Sending…" : "Resend verification email"}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPendingVerificationEmail(null);
                    setDevVerifyUrl(null);
                    setActiveTab("signin");
                  }}
                >
                  Back to sign in
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (authView === "forgot") {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-6 h-16 flex items-center justify-between">
            <Link href={homePath} className="flex items-center">
              <img src={logoImage} alt="Reels Forge.AI" className="h-8 w-auto" />
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md border-0 shadow-lg">
            <CardContent className="pt-8 pb-6 space-y-4">
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-xl font-semibold">Forgot your password?</h1>
                <p className="text-sm text-muted-foreground">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>
              </div>

              {forgotPasswordSent ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    If an account exists for{" "}
                    <span className="font-medium text-foreground">{forgotPasswordEmail}</span>,
                    you&apos;ll receive a reset link shortly.
                  </p>

                  {devResetUrl && (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left text-sm">
                      <p className="font-medium text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Dev mode — no SMTP configured
                      </p>
                      <a
                        href={devResetUrl}
                        className="text-primary underline underline-offset-4 break-all"
                      >
                        {devResetUrl}
                      </a>
                    </div>
                  )}

                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setAuthView("default");
                      setForgotPasswordSent(false);
                      setDevResetUrl(null);
                      setActiveTab("signin");
                    }}
                  >
                    Back to sign in
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="forgot-email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10"
                        value={forgotPasswordEmail}
                        onChange={(e) => setForgotPasswordEmail(e.target.value)}
                        required
                        data-testid="input-forgot-email"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-forgot-password">
                    {isLoading ? "Sending…" : "Send reset link"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setAuthView("default");
                      setForgotPasswordSent(false);
                      setActiveTab("signin");
                    }}
                  >
                    Back to sign in
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  if (authView === "reset" && resetToken) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
          <div className="container mx-auto px-6 h-16 flex items-center justify-between">
            <Link href={homePath} className="flex items-center">
              <img src={logoImage} alt="Reels Forge.AI" className="h-8 w-auto" />
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <Card className="w-full max-w-md border-0 shadow-lg">
            <CardContent className="pt-8 pb-6 space-y-4">
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Lock className="w-6 h-6 text-primary" />
                </div>
                <h1 className="text-xl font-semibold">Set a new password</h1>
                <p className="text-sm text-muted-foreground">
                  Choose a new password for your account.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-password">New password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reset-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 6 characters"
                      className="pl-10 pr-10"
                      value={resetPasswordData.password}
                      onChange={(e) =>
                        setResetPasswordData({ ...resetPasswordData, password: e.target.value })
                      }
                      required
                      data-testid="input-reset-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-confirm-password">Confirm password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="reset-confirm-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      className="pl-10"
                      value={resetPasswordData.confirmPassword}
                      onChange={(e) =>
                        setResetPasswordData({ ...resetPasswordData, confirmPassword: e.target.value })
                      }
                      required
                      data-testid="input-reset-confirm-password"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-reset-password">
                  {isLoading ? "Updating…" : "Update password"}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setAuthView("default");
                    setResetToken(null);
                    setResetPasswordData({ password: "", confirmPassword: "" });
                    setActiveTab("signin");
                  }}
                >
                  Back to sign in
                </Button>
              </form>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <Link href={homePath} className="flex items-center">
            <img src={logoImage} alt="Reels Forge.AI" className="h-8 w-auto" />
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md border-0 shadow-lg">
          <CardContent className="pt-6">
            <Button 
              variant="outline" 
              className="w-full mb-6" 
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              data-testid="button-google-signin"
            >
              <SiGoogle className="w-4 h-4 mr-2" />
              Continue with Google
            </Button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'signin' | 'signup')}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin" data-testid="tab-signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup" data-testid="tab-signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email or username</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signin-email"
                        type="text"
                        placeholder="admin or you@example.com"
                        className="pl-10"
                        autoComplete="username"
                        value={signInData.identifier}
                        onChange={(e) => setSignInData({ ...signInData, identifier: e.target.value })}
                        required
                        data-testid="input-signin-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signin-password">Password</Label>
                      <button
                        type="button"
                        className="text-xs text-primary hover:underline underline-offset-4"
                        onClick={() => {
                          setAuthView("forgot");
                          setForgotPasswordEmail(signInData.identifier.includes("@") ? signInData.identifier : "");
                          setForgotPasswordSent(false);
                          setDevResetUrl(null);
                        }}
                        data-testid="link-forgot-password"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        className="pl-10 pr-10"
                        value={signInData.password}
                        onChange={(e) => setSignInData({ ...signInData, password: e.target.value })}
                        required
                        data-testid="input-signin-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-signin">
                    {isLoading ? "Signing in..." : "Sign In"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        className="pl-10"
                        value={signUpData.name}
                        onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                        required
                        data-testid="input-signup-name"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@example.com"
                        className="pl-10"
                        value={signUpData.email}
                        onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                        required
                        data-testid="input-signup-email"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="At least 6 characters"
                        className="pl-10 pr-10"
                        value={signUpData.password}
                        onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                        required
                        data-testid="input-signup-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="signup-confirm-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        className="pl-10"
                        value={signUpData.confirmPassword}
                        onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                        required
                        data-testid="input-signup-confirm-password"
                      />
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
                    <Checkbox
                      id="accept-terms"
                      checked={acceptedTerms}
                      onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                      data-testid="checkbox-accept-terms"
                    />
                    <Label htmlFor="accept-terms" className="text-sm font-normal leading-snug text-muted-foreground">
                      I agree to the{" "}
                      <Link href="/terms" className="font-medium text-foreground underline-offset-4 hover:underline">
                        Terms
                      </Link>{" "}
                      and{" "}
                      <Link href="/privacy" className="font-medium text-foreground underline-offset-4 hover:underline">
                        Privacy
                      </Link>
                    </Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading} data-testid="button-signup">
                    {isLoading ? "Creating account..." : "Create Account"}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              {activeTab === "signin" ? (
                <>
                  By signing in, you agree to our{" "}
                  <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
                    Privacy
                  </Link>
                  .
                </>
              ) : (
                <>
                  Read our{" "}
                  <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
                    Terms
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
                    Privacy
                  </Link>
                  .
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
