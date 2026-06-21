export type SiteContactInfo = {
  supportEmail: string;
  emergencyEmail: string;
  appName: string;
  supportHours: string;
};

const DEFAULT_EMAIL = "support@reelforge.ai";

export function resolveSiteContact(
  env: Record<string, string | undefined> = {},
): SiteContactInfo {
  const supportEmail =
    env.SUPPORT_EMAIL?.trim() ||
    env.SMTP_FROM?.trim() ||
    env.SMTP_USER?.trim() ||
    DEFAULT_EMAIL;

  const emergencyEmail = env.EMERGENCY_EMAIL?.trim() || supportEmail;

  return {
    supportEmail,
    emergencyEmail,
    appName: "ReelForge AI",
    supportHours:
      env.SUPPORT_HOURS?.trim() || "Mon–Fri, 9 AM – 6 PM (local time)",
  };
}
