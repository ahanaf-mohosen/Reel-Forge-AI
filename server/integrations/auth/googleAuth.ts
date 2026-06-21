import { google } from "googleapis";
import type { Express, Request, Response } from "express";
import { authStorage } from "./storage";

function getGoogleOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.YOUTUBE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (!clientId || !clientSecret) {
    return null;
  }

  return new google.auth.OAuth2(
    clientId,
    clientSecret,
    `${appUrl}/api/auth/google/callback`,
  );
}

export function isGoogleAuthConfigured(): boolean {
  return Boolean(getGoogleOAuthClient());
}

export function registerGoogleAuthRoutes(app: Express) {
  const oauth2Client = getGoogleOAuthClient();

  app.get("/api/auth/google", (_req: Request, res: Response) => {
    if (!oauth2Client) {
      return res.status(503).json({
        message:
          "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env",
      });
    }

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: "online",
      prompt: "select_account",
      scope: [
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "openid",
      ],
    });

    res.redirect(authUrl);
  });

  app.get("/api/login", (_req: Request, res: Response) => {
    res.redirect("/api/auth/google");
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    if (!oauth2Client) {
      return res.redirect("/auth?error=google_not_configured");
    }

    const code = req.query.code as string | undefined;
    if (!code) {
      return res.redirect("/auth?error=google_auth_cancelled");
    }

    try {
      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const { data: profile } = await oauth2.userinfo.get();

      if (!profile.email || !profile.id) {
        return res.redirect("/auth?error=google_profile_missing");
      }

      const email = profile.email.toLowerCase();
      let user = await authStorage.getUserByGoogleId(profile.id);

      if (!user) {
        const existingByEmail = await authStorage.getUserByEmail(email);
        if (existingByEmail) {
          user = await authStorage.updateUser(existingByEmail.id, {
            googleId: profile.id,
            emailVerified: true,
            profileImageUrl: profile.picture || existingByEmail.profileImageUrl,
            firstName: profile.given_name || existingByEmail.firstName,
            lastName: profile.family_name || existingByEmail.lastName,
          });
        } else {
          user = await authStorage.upsertUser({
            email,
            googleId: profile.id,
            authProvider: "google",
            emailVerified: true,
            profileImageUrl: profile.picture || null,
            firstName: profile.given_name || profile.name || "",
            lastName: profile.family_name || "",
          });
        }
      } else {
        user = await authStorage.updateUser(user.id, {
          emailVerified: true,
          profileImageUrl: profile.picture || user.profileImageUrl,
          firstName: profile.given_name || user.firstName,
          lastName: profile.family_name || user.lastName,
        });
      }

      if (!user) {
        return res.redirect("/auth?error=google_auth_failed");
      }

      if (req.session) {
        (req.session as any).userId = user.id;
        (req.session as any).user = user;
      }

      const redirectPath = email === "admin@reelforge.local" ? "/admin" : "/dashboard";
      res.redirect(redirectPath);
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      res.redirect("/auth?error=google_auth_failed");
    }
  });
}
