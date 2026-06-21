import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Clock, LifeBuoy, Mail } from "lucide-react";
import type { SiteContactInfo } from "@shared/siteContact";
import { LEGAL_NAV_LINKS } from "@shared/legalNav";
import logoImage from "@assets/logo.png";

const FALLBACK_CONTACT: SiteContactInfo = {
  supportEmail: "support@reelforge.ai",
  emergencyEmail: "support@reelforge.ai",
  appName: "ReelForge AI",
  supportHours: "Mon–Fri, 9 AM – 6 PM (local time)",
};

export function SiteFooter({ compact = false }: { compact?: boolean }) {
  const { data: contact = FALLBACK_CONTACT } = useQuery<SiteContactInfo>({
    queryKey: ["/api/site/contact"],
    staleTime: 1000 * 60 * 30,
  });

  if (compact) {
    return (
      <footer className="border-t border-border/60 bg-muted/20">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-4 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
          <div className="flex items-center gap-2">
            <img src={logoImage} alt={contact.appName} className="h-5 w-auto opacity-80" />
            <span>© {new Date().getFullYear()} {contact.appName}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            <a
              href={`mailto:${contact.supportEmail}`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" />
              {contact.supportEmail}
            </a>
            {LEGAL_NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr_1fr]">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <img src={logoImage} alt={contact.appName} className="h-7 w-auto" />
              <span className="font-semibold">{contact.appName}</span>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              AI-powered long-form to short-form video. Need help with billing, uploads, or exports?
              Our team is here for you.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <LifeBuoy className="h-4 w-4 text-primary" />
              Support
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href={`mailto:${contact.supportEmail}`}
                  className="inline-flex items-center gap-2 hover:text-foreground"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {contact.supportEmail}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{contact.supportHours}</span>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              Emergency contact
            </h3>
            <p className="text-sm text-muted-foreground">
              For urgent billing failures, stuck processing, or account lockouts:
            </p>
            <a
              href={`mailto:${contact.emergencyEmail}`}
              className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
            >
              <Mail className="h-4 w-4" />
              {contact.emergencyEmail}
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} {contact.appName}. All rights reserved.</span>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {LEGAL_NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
