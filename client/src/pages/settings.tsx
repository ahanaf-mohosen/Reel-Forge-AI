import { useState, useEffect, useRef } from "react";
import { User, CreditCard, Loader2, Camera, LogOut, Share2, ImageIcon, Trash2 } from "lucide-react";
import { SiYoutube, SiFacebook, SiInstagram } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BillingPanel } from "@/components/billing-panel";

type CurrentUser = {
  name?: string;
  firstName?: string;
  email?: string;
  profileImageUrl?: string | null;
  brandLogoUrl?: string | null;
  isAdmin?: boolean;
  hasPassword?: boolean;
  authProvider?: string;
};

type SocialAccount = {
  platform: string;
};

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPicture, setIsUploadingPicture] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const brandLogoInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    profileImageUrl: '',
    brandLogoUrl: '',
  });

  const [security, setSecurity] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Fetch current user data
  const { data: currentUser, isLoading: userLoading, refetch: refetchUser } = useQuery<CurrentUser>({
    queryKey: ["/api/auth/user"],
  });

  const isAdmin = Boolean(currentUser?.isAdmin);

  // Fetch connected social accounts
  const { data: connectedAccounts, refetch: refetchAccounts } = useQuery<SocialAccount[]>({
    queryKey: ["/api/social/accounts"],
  });

  // Update profile state when user data is loaded
  useEffect(() => {
    if (currentUser) {
      setProfile({
        name: currentUser.name || currentUser.firstName || '',
        email: currentUser.email || '',
        profileImageUrl: currentUser.profileImageUrl || '',
        brandLogoUrl: currentUser.brandLogoUrl || '',
      });
    }
  }, [currentUser]);

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPicture(true);
    try {
      const formData = new FormData();
      formData.append('profilePicture', file);

      const response = await fetch('/api/auth/profile-picture', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setProfile(prev => ({ ...prev, profileImageUrl: data.profileImageUrl }));
        refetchUser();
        toast({
          title: "Profile picture updated",
          description: "Your profile picture has been uploaded successfully.",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Upload failed",
          description: error.message || "Failed to upload profile picture",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPicture(false);
    }
  };

  const handleBrandLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file.",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('brandLogo', file);

      const response = await fetch('/api/auth/brand-logo', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setProfile((prev) => ({ ...prev, brandLogoUrl: data.brandLogoUrl }));
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        refetchUser();
        toast({
          title: "Brand logo saved",
          description: "Your logo is ready to use when creating reels.",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Upload failed",
          description: error.message || "Failed to upload brand logo",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Upload failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleRemoveBrandLogo = async () => {
    setIsUploadingLogo(true);
    try {
      const response = await fetch('/api/auth/brand-logo', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        setProfile((prev) => ({ ...prev, brandLogoUrl: '' }));
        await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        refetchUser();
        toast({
          title: "Brand logo removed",
          description: "Logo overlay will be unavailable until you upload a new one.",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Remove failed",
          description: error.message || "Failed to remove brand logo",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Remove failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile.name.trim()) {
      toast({
        title: "Name is required",
        description: "Please enter your name.",
        variant: "destructive",
      });
      return;
    }

    if (!profile.email.trim()) {
      toast({
        title: "Email is required",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    const emailChanging =
      profile.email.trim().toLowerCase() !== (currentUser?.email || '').toLowerCase();
    const passwordChanging = Boolean(security.newPassword || security.confirmPassword);
    const hasExistingPassword = currentUser?.hasPassword !== false;

    if (passwordChanging) {
      if (hasExistingPassword && !security.currentPassword) {
        toast({
          title: "Current password required",
          description: "Enter your current password to set a new one.",
          variant: "destructive",
        });
        return;
      }
      if (security.newPassword.length < 8) {
        toast({
          title: "Password too short",
          description: "New password must be at least 8 characters.",
          variant: "destructive",
        });
        return;
      }
      if (security.newPassword !== security.confirmPassword) {
        toast({
          title: "Passwords do not match",
          description: "New password and confirmation must match.",
          variant: "destructive",
        });
        return;
      }
    }

    if (emailChanging && hasExistingPassword && !security.currentPassword) {
      toast({
        title: "Current password required",
        description: "Enter your current password to change your email.",
        variant: "destructive",
      });
      return;
    }

    if (emailChanging && !hasExistingPassword) {
      toast({
        title: "Set a password first",
        description: "Create a password below before changing your email.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Record<string, string> = {
        name: profile.name.trim(),
        email: profile.email.trim().toLowerCase(),
      };

      if (security.currentPassword) {
        payload.currentPassword = security.currentPassword;
      }
      if (security.newPassword) {
        payload.newPassword = security.newPassword;
      }

      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (response.ok) {
        await refetchUser();
        queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
        setSecurity({ currentPassword: '', newPassword: '', confirmPassword: '' });
        toast({
          title: "Account updated",
          description: "Your profile and security settings have been saved.",
        });
      } else {
        const error = await response.json();
        toast({
          title: "Update failed",
          description: error.message || "Failed to update account",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConnectSocial = async (platform: 'youtube' | 'facebook' | 'instagram') => {
    try {
      const response = await fetch(`/api/social/${platform}/connect`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }

      const { authUrl } = await response.json();
      
      // Open OAuth window
      const popup = window.open(authUrl, '_blank', 'width=600,height=700');
      
      // Listen for OAuth completion
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === `${platform}-connected`) {
          toast({
            title: "Account connected!",
            description: `Your ${platform} account has been connected successfully.`,
          });
          refetchAccounts();
          window.removeEventListener('message', handleMessage);
        }
      };

      window.addEventListener('message', handleMessage);
    } catch (error) {
      toast({
        title: "Connection failed",
        description: `Failed to connect ${platform} account.`,
        variant: "destructive",
      });
    }
  };

  const handleDisconnectSocial = async (platform: string) => {
    try {
      const response = await fetch(`/api/social/${platform}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      toast({
        title: "Account disconnected",
        description: `Your ${platform} account has been disconnected.`,
      });
      
      refetchAccounts();
    } catch (error) {
      toast({
        title: "Disconnection failed",
        description: `Failed to disconnect ${platform} account.`,
        variant: "destructive",
      });
    }
  };

  const isConnected = (platform: string) => {
    return connectedAccounts?.some((acc: any) => acc.platform === platform);
  };

  return (
    <div className="p-6 max-w-3xl mx-auto" data-testid="settings-page">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          {isAdmin ? "Manage your admin profile" : "Manage your account"}
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted/50" data-testid="settings-tabs">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2">
            <Share2 className="w-4 h-4" />
            Social Accounts
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2">
            <CreditCard className="w-4 h-4" />
            Billing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border-0">
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden">
                    {profile.profileImageUrl ? (
                      <img 
                        src={profile.profileImageUrl} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-12 h-12 text-primary/60" />
                    )}
                  </div>
                  <input
                    type="file"
                    id="profile-picture-input"
                    accept="image/*"
                    onChange={handleProfilePictureChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="profile-picture-input"
                    className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors cursor-pointer"
                  >
                    {isUploadingPicture ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Camera className="w-4 h-4" />
                    )}
                  </label>
                </div>
                <div>
                  {userLoading ? (
                    <>
                      <div className="h-6 w-32 bg-muted animate-pulse rounded mb-2" />
                      <div className="h-4 w-48 bg-muted animate-pulse rounded" />
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-lg">{profile.name || 'User'}</p>
                      <p className="text-sm text-muted-foreground">{profile.email || 'No email'}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="bg-white dark:bg-slate-800"
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    disabled={!currentUser?.hasPassword}
                    className={currentUser?.hasPassword === false ? "bg-muted" : "bg-white dark:bg-slate-800"}
                    data-testid="input-email"
                  />
                  <p className="text-xs text-muted-foreground">
                    {currentUser?.hasPassword
                      ? "Changing email requires your current password below."
                      : "Set a password below to enable email sign-in and email changes."}
                  </p>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <div>
                  <h3 className="text-sm font-medium">Brand logo</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Upload a logo to optionally overlay on reels when you create them.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="w-24 h-24 rounded-xl border bg-background flex items-center justify-center overflow-hidden">
                    {profile.brandLogoUrl ? (
                      <img
                        src={profile.brandLogoUrl}
                        alt="Brand logo"
                        className="max-h-full max-w-full object-contain p-2"
                      />
                    ) : (
                      <ImageIcon className="w-10 h-10 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={brandLogoInputRef}
                      type="file"
                      id="brand-logo-input"
                      accept="image/*"
                      onChange={handleBrandLogoChange}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isUploadingLogo}
                      onClick={() => brandLogoInputRef.current?.click()}
                    >
                      {isUploadingLogo ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Camera className="w-4 h-4 mr-2" />
                          {profile.brandLogoUrl ? "Replace logo" : "Upload logo"}
                        </>
                      )}
                    </Button>
                    {profile.brandLogoUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={isUploadingLogo}
                        onClick={handleRemoveBrandLogo}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
                <div>
                  <h3 className="text-sm font-medium">
                    {currentUser?.hasPassword ? "Change password" : "Set a password"}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentUser?.hasPassword
                      ? "Leave new password blank to keep your current password."
                      : "Add a password so you can also sign in with email."}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {currentUser?.hasPassword === true && (
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="current-password">Current password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        autoComplete="current-password"
                        value={security.currentPassword}
                        onChange={(e) =>
                          setSecurity({ ...security, currentPassword: e.target.value })
                        }
                        data-testid="input-current-password"
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="new-password">
                      {currentUser?.hasPassword ? "New password" : "Password"}
                    </Label>
                    <Input
                      id="new-password"
                      type="password"
                      autoComplete="new-password"
                      value={security.newPassword}
                      onChange={(e) =>
                        setSecurity({ ...security, newPassword: e.target.value })
                      }
                      data-testid="input-new-password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={security.confirmPassword}
                      onChange={(e) =>
                        setSecurity({ ...security, confirmPassword: e.target.value })
                      }
                      data-testid="input-confirm-password"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSaving} data-testid="button-save-profile">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>

              <div className="pt-6 mt-6 border-t">
                <h3 className="text-sm font-medium text-destructive mb-4">Danger Zone</h3>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full sm:w-auto">
                      <LogOut className="w-4 h-4 mr-2" />
                      Log Out
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
                      <AlertDialogDescription>
                        You will be redirected to the login page.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction asChild>
                        <a href="/api/logout">Log Out</a>
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <Card className="shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border-0">
            <CardHeader>
              <CardTitle>Social Media Accounts</CardTitle>
              <CardDescription>
                Connect your social media accounts to share reels directly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* YouTube */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
                    <SiYoutube className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">YouTube</p>
                    <p className="text-sm text-muted-foreground">
                      {isConnected('youtube') ? 'Connected' : 'Not connected'}
                    </p>
                  </div>
                </div>
                {isConnected('youtube') ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnectSocial('youtube')}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleConnectSocial('youtube')}
                  >
                    Connect
                  </Button>
                )}
              </div>

              {/* Facebook */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                    <SiFacebook className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Facebook</p>
                    <p className="text-sm text-muted-foreground">
                      {isConnected('facebook') ? 'Connected' : 'Not connected'}
                    </p>
                  </div>
                </div>
                {isConnected('facebook') ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDisconnectSocial('facebook')}
                  >
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleConnectSocial('facebook')}
                  >
                    Connect
                  </Button>
                )}
              </div>

              {/* Instagram */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                    <SiInstagram className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium">Instagram</p>
                    <p className="text-sm text-muted-foreground">
                      Uses Facebook connection
                    </p>
                  </div>
                </div>
                {isConnected('facebook') ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                  >
                    Connected via Facebook
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleConnectSocial('facebook')}
                  >
                    Connect Facebook
                  </Button>
                )}
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> For Instagram, you need a Facebook Page with a connected Instagram Business account.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <BillingPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
