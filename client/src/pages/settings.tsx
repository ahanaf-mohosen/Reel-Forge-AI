import { useState } from "react";
import { User, Settings2, CreditCard, Loader2, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const [profile, setProfile] = useState({
    name: 'User',
    email: 'user@example.com',
  });
  
  const [preferences, setPreferences] = useState({
    defaultClipCount: 3,
    minDuration: 20,
    maxDuration: 40,
    defaultQuality: '1080p',
    defaultFormat: 'mp4',
  });

  const handleSaveProfile = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    toast({
      title: "Profile updated",
      description: "Your profile has been saved successfully.",
    });
  };

  const handleSavePreferences = async () => {
    setIsSaving(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsSaving(false);
    toast({
      title: "Preferences saved",
      description: "Your video preferences have been updated.",
    });
  };

  return (
    <div className="p-6 max-w-3xl mx-auto" data-testid="settings-page">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted/50" data-testid="settings-tabs">
          <TabsTrigger value="profile" className="gap-2">
            <User className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="preferences" className="gap-2">
            <Settings2 className="w-4 h-4" />
            Preferences
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
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                    <User className="w-12 h-12 text-primary/60" />
                  </div>
                  <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors">
                    <Camera className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <p className="font-medium text-lg">{profile.name}</p>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
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
                    disabled
                    className="bg-muted"
                    data-testid="input-email"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email is linked to your Google account
                  </p>
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences">
          <Card className="shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border-0">
            <CardHeader>
              <CardTitle>Video Preferences</CardTitle>
              <CardDescription>
                Set your default video processing options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-3">
                  <Label>Number of Reels: {preferences.defaultClipCount}</Label>
                  <Slider
                    value={[preferences.defaultClipCount]}
                    min={1}
                    max={5}
                    step={1}
                    onValueChange={([v]) => setPreferences({ ...preferences, defaultClipCount: v })}
                    data-testid="slider-clip-count"
                  />
                  <p className="text-xs text-muted-foreground">
                    How many reels to generate from each video
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <Label>Min Duration: {preferences.minDuration}s</Label>
                    <Slider
                      value={[preferences.minDuration]}
                      min={10}
                      max={preferences.maxDuration - 5}
                      step={5}
                      onValueChange={([v]) => setPreferences({ ...preferences, minDuration: v })}
                      data-testid="slider-min-duration"
                    />
                  </div>
                  <div className="space-y-3">
                    <Label>Max Duration: {preferences.maxDuration}s</Label>
                    <Slider
                      value={[preferences.maxDuration]}
                      min={preferences.minDuration + 5}
                      max={90}
                      step={5}
                      onValueChange={([v]) => setPreferences({ ...preferences, maxDuration: v })}
                      data-testid="slider-max-duration"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Default Quality</Label>
                  <Select
                    value={preferences.defaultQuality}
                    onValueChange={(v) => setPreferences({ ...preferences, defaultQuality: v })}
                  >
                    <SelectTrigger className="bg-white dark:bg-slate-800" data-testid="select-quality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="720p">720p (Standard)</SelectItem>
                      <SelectItem value="1080p">1080p (HD)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Default Format</Label>
                  <Select
                    value={preferences.defaultFormat}
                    onValueChange={(v) => setPreferences({ ...preferences, defaultFormat: v })}
                  >
                    <SelectTrigger className="bg-white dark:bg-slate-800" data-testid="select-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mp4">MP4</SelectItem>
                      <SelectItem value="mov">MOV</SelectItem>
                      <SelectItem value="webm">WebM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <Button onClick={handleSavePreferences} disabled={isSaving} data-testid="button-save-preferences">
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Preferences'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card className="shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border-0">
            <CardContent className="p-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Billing Coming Soon</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Subscription plans and billing management will be available in a future update. 
                Currently all features are free to use.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
