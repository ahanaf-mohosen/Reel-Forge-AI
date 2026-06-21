import { Link, useLocation } from "wouter";
import { Home, Sparkles, Library, Settings, LogOut, User, Shield } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import logoImage from "@assets/logo.png";

const menuItems = [
  {
    title: "Home",
    url: "/dashboard",
    icon: Home,
  },
  {
    title: "Create Reel",
    url: "/create",
    icon: Sparkles,
  },
  {
    title: "Library",
    url: "/library",
    icon: Library,
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
  {
    title: "Admin",
    url: "/admin",
    icon: Shield,
    adminOnly: true,
  },
];

type CurrentUser = {
  name?: string;
  firstName?: string;
  email?: string;
  profileImageUrl?: string | null;
  isAdmin?: boolean;
};

export function AppSidebar() {
  const [location] = useLocation();
  
  // Fetch current user data
  const { data: currentUser } = useQuery<CurrentUser>({
    queryKey: ["/api/auth/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const visibleMenuItems = menuItems.filter(
    (item) => !item.adminOnly || currentUser?.isAdmin,
  );

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="flex items-center group">
          <img 
            src={logoImage} 
            alt="Reels Forge.AI" 
            className="h-7 w-auto group-data-[state=collapsed]:hidden"
          />
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center group-data-[state=expanded]:hidden">
            <span className="text-sm font-bold text-primary-foreground">R</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`nav-${item.title.toLowerCase().replace(' ', '-')}`}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-2">
        {currentUser && (
          <div className="flex items-center gap-3 px-2 py-2 rounded-md bg-muted/50">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden flex-shrink-0">
              {currentUser.profileImageUrl ? (
                <img 
                  src={currentUser.profileImageUrl} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-4 h-4 text-primary/60" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {currentUser.name || currentUser.firstName || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{currentUser.email}</p>
            </div>
          </div>
        )}
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          asChild
        >
          <a href="/api/logout">
            <LogOut className="w-4 h-4 mr-2" />
            <span>Log Out</span>
          </a>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
