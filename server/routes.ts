import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { processVideo } from "./services/videoProcessor";
import { downloadYouTubeVideo, isYouTubeUrl } from "./services/youtubeDownloader";
import { setupAuth, isAuthenticated } from "./auth";
import { authStorage } from "./integrations/auth";
import socialAuthRoutes from "./integrations/social/routes";
import socialUploadRoutes from "./integrations/social/upload";
import { socialMediaStorage } from "./integrations/social/storage";
import { adminAuditStorage, calculateEstimatedProfitMetrics } from "./integrations/admin/storage";
import { tokenUsageStorage } from "./integrations/admin/tokenUsageStorage";
import { announcementStorage } from "./integrations/admin/announcementStorage";
import { billingStorage } from "./integrations/billing/storage";
import { planStorage } from "./integrations/billing/planStorage";
import { calculateProcessingCost, isDemoBillingEnabled } from "./integrations/billing/config";
import { registerBillingRoutes, getBillingUserId } from "./integrations/billing/routes";
import { getAiGatewayMode, hasOpenAiKey } from "./services/aiGateway";
import { registerGoogleAuthRoutes } from "./integrations/auth/googleAuth";
import { sendVerificationEmail, sendPasswordResetEmail } from "./services/emailService";
import type { UploadOptions } from "@shared/schema";
import { uploadOptionsSchema, updateReelCaptionSchema, updateAccountSchema, updateAdminPlansSchema, createAnnouncementSchema, updateAnnouncementSchema, updateProjectSchema } from "@shared/schema";
import type { User } from "@shared/models/auth";
import { resolveAdminDateRange } from "@shared/adminDateRange";
import { mergeAdminFinancialSummary } from "@shared/adminFinancials";
import { resolveSiteContact } from "@shared/siteContact";

const uploadDir = path.join(process.cwd(), 'uploads');
const outputDir = path.join(process.cwd(), 'outputs');
const profilePicturesDir = path.join(process.cwd(), 'uploads', 'profiles');
const brandLogosDir = path.join(process.cwd(), 'uploads', 'logos');
const announcementImagesDir = path.join(process.cwd(), 'uploads', 'announcements');
type AdminRole = 'admin' | 'moderator' | 'user';

// Hardcoded admin login. Update these values if you want different credentials.
const HARDCODED_ADMIN_USERNAME = 'admin';
const HARDCODED_ADMIN_EMAIL = 'admin@reelforge.local';
const HARDCODED_ADMIN_PASSWORD = 'Admin@123';

const userRoleOverrides = new Map<string, AdminRole>();
const suspendedUserIds = new Set<string>();

function getConfiguredAdminEmails(): Set<string> {
  const configured =
    (process.env.ADMIN_EMAILS || "") +
    (process.env.ADMIN_EMAILS ? "," : "") +
    HARDCODED_ADMIN_EMAIL;

  return new Set(
    configured
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function isHardcodedAdminIdentifier(identifier: string): boolean {
  const normalized = identifier.trim().toLowerCase();
  return (
    normalized === HARDCODED_ADMIN_USERNAME.toLowerCase() ||
    normalized === HARDCODED_ADMIN_EMAIL.toLowerCase()
  );
}

async function isUserAdmin(user: User): Promise<boolean> {
  const overrideRole = userRoleOverrides.get(user.id);
  if (overrideRole === 'admin') return true;
  if (overrideRole) return false;

  const configuredAdmins = getConfiguredAdminEmails();
  const email = user.email?.toLowerCase() || "";

  if (configuredAdmins.size > 0) {
    return configuredAdmins.has(email);
  }

  // If ADMIN_EMAILS is not set, the earliest registered user is treated as admin.
  const allUsers = await authStorage.getAllUsers();
  return allUsers.length > 0 && allUsers[0].id === user.id;
}

async function getUserRole(user: User): Promise<AdminRole> {
  const overrideRole = userRoleOverrides.get(user.id);
  if (overrideRole) return overrideRole;
  return (await isUserAdmin(user)) ? 'admin' : 'user';
}

function getUserStatus(userId: string): 'active' | 'suspended' {
  return suspendedUserIds.has(userId) ? 'suspended' : 'active';
}

async function toSafeUser(user: User) {
  const role = await getUserRole(user);
  return {
    ...user,
    password: undefined,
    hasPassword: Boolean(user.password),
    isAdmin: role === 'admin',
    role,
    status: getUserStatus(user.id),
  };
}

async function userOwnsProject(userId: string, projectId: string): Promise<boolean> {
  const ownerId = await storage.getProjectUserId(projectId);
  return ownerId === userId;
}

async function requireOwnedProject(
  req: Request,
  res: Response,
  projectId: string,
) {
  const userId = getBillingUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }

  if (!(await userOwnsProject(userId, projectId))) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }

  const project = await storage.getProject(projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }

  return project;
}

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
if (!fs.existsSync(profilePicturesDir)) {
  fs.mkdirSync(profilePicturesDir, { recursive: true });
}
if (!fs.existsSync(brandLogosDir)) {
  fs.mkdirSync(brandLogosDir, { recursive: true });
}
if (!fs.existsSync(announcementImagesDir)) {
  fs.mkdirSync(announcementImagesDir, { recursive: true });
}

const MAX_VIDEO_UPLOAD_BYTES = 1024 * 1024 * 1024; // 1 GB

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: MAX_VIDEO_UPLOAD_BYTES,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg', 'video/3gpp', 'video/x-matroska', 'video/ogg'];
    const ext = file.originalname.toLowerCase().split('.').pop();
    const allowedExts = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'mpeg', 'mpg', '3gp', 'ogv'];
    
    if (allowedTypes.includes(file.mimetype) || (ext && allowedExts.includes(ext)) || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload a video file (MP4, MOV, AVI, WebM, etc).'));
    }
  }
});

const profilePictureUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, profilePicturesDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload an image file (JPEG, PNG, GIF, WebP).'));
    }
  }
});

const brandLogoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, brandLogosDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload an image file (JPEG, PNG, GIF, WebP).'));
    }
  }
});

const announcementImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, announcementImagesDir);
    },
    filename: (_req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, uniqueSuffix + path.extname(file.originalname));
    },
  }),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Please upload an image file (JPEG, PNG, GIF, WebP).'));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await adminAuditStorage.ensureSchema();
  await tokenUsageStorage.ensureSchema();
  await billingStorage.ensureSchema();
  await planStorage.ensureSchema();
  await announcementStorage.ensureSchema();
  await authStorage.ensureSchema();
  await storage.ensureSchema();
  
  // Setup simple session-based authentication
  await setupAuth(app);

  registerGoogleAuthRoutes(app);
  registerBillingRoutes(app);

  app.get("/api/site/contact", (_req: Request, res: Response) => {
    res.json(
      resolveSiteContact(process.env as Record<string, string | undefined>),
    );
  });

  app.get("/api/ai/mode", (_req, res) => {
    res.json({ mode: getAiGatewayMode() });
  });
  
  // Social media OAuth and upload routes
  app.use('/api/social', socialAuthRoutes);
  app.use('/api/social', socialUploadRoutes);
  
  // Email/Password Sign Up
  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      
      const existingUser = await authStorage.getUserByEmail(email.trim().toLowerCase());
      if (existingUser) {
        return res.status(400).json({ message: 'An account with this email already exists' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const nameParts = (name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      const normalizedEmail = email.trim().toLowerCase();
      const { token, expires } = authStorage.createVerificationToken();

      const user = await authStorage.upsertUser({
        email: normalizedEmail,
        password: hashedPassword,
        firstName,
        lastName,
        authProvider: 'email',
        emailVerified: false,
        emailVerificationToken: token,
        emailVerificationExpires: expires,
      });

      const { sent, verifyUrl } = await sendVerificationEmail(normalizedEmail, token);

      res.json({
        success: true,
        requiresVerification: true,
        email: normalizedEmail,
        emailSent: sent,
        verifyUrl: sent ? undefined : verifyUrl,
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(500).json({ message: 'Failed to create account' });
    }
  });
  
  // Email/Password Sign In
  app.post('/api/auth/signin', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }

      if (isHardcodedAdminIdentifier(email) && password !== HARDCODED_ADMIN_PASSWORD) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (isHardcodedAdminIdentifier(email) && password === HARDCODED_ADMIN_PASSWORD) {
        let adminUser = await authStorage.getUserByEmail(HARDCODED_ADMIN_EMAIL);

        if (!adminUser) {
          const hashedPassword = await bcrypt.hash(HARDCODED_ADMIN_PASSWORD, 10);
          adminUser = await authStorage.upsertUser({
            email: HARDCODED_ADMIN_EMAIL,
            password: hashedPassword,
            firstName: 'Admin',
            lastName: 'User',
            authProvider: 'email',
            emailVerified: true,
          });
        }

        userRoleOverrides.set(adminUser.id, 'admin');

        if (req.session) {
          (req.session as any).userId = adminUser.id;
          (req.session as any).user = adminUser;
        }

        await adminAuditStorage.logEvent({
          actorId: adminUser.id,
          actorEmail: adminUser.email,
          action: "admin_login_success",
          resourceType: "authentication",
          resourceId: adminUser.id,
          details: {
            username: email,
            method: "hardcoded_admin",
          },
        });

        return res.json({ success: true, user: await toSafeUser(adminUser) });
      }
      
      const user = await authStorage.getUserByEmail(email.trim().toLowerCase());
      if (!user || !user.password) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (suspendedUserIds.has(user.id)) {
        return res.status(403).json({ message: 'This account has been suspended. Contact an administrator.' });
      }
      
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      if (!user.emailVerified && user.authProvider === 'email') {
        return res.status(403).json({
          message: 'Please verify your email before signing in. Check your inbox for the verification link.',
          requiresVerification: true,
          email: user.email,
        });
      }
      
      // Set session
      if (req.session) {
        (req.session as any).userId = user.id;
        (req.session as any).user = user;
      }

      if (await isUserAdmin(user)) {
        await adminAuditStorage.logEvent({
          actorId: user.id,
          actorEmail: user.email,
          action: "admin_login_success",
          resourceType: "authentication",
          resourceId: user.id,
          details: {
            username: email,
            method: "password_login",
          },
        });
      }
      
      res.json({ success: true, user: await toSafeUser(user) });
    } catch (error) {
      console.error('Signin error:', error);
      res.status(500).json({ message: 'Failed to sign in' });
    }
  });

  app.get('/api/auth/verify-email', async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string | undefined;
      if (!token) {
        return res.status(400).json({ message: 'Verification token is required' });
      }

      const user = await authStorage.getUserByVerificationToken(token);
      if (!user) {
        return res.status(400).json({ message: 'Invalid or expired verification link' });
      }

      const verifiedUser = await authStorage.updateUser(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      });

      if (!verifiedUser) {
        return res.status(500).json({ message: 'Failed to verify email' });
      }

      if (req.session) {
        (req.session as any).userId = verifiedUser.id;
        (req.session as any).user = verifiedUser;
      }

      res.json({ success: true, user: await toSafeUser(verifiedUser) });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({ message: 'Failed to verify email' });
    }
  });

  app.post('/api/auth/resend-verification', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const user = await authStorage.getUserByEmail(email.trim().toLowerCase());
      if (!user) {
        return res.json({ success: true, message: 'If an account exists, a verification email has been sent.' });
      }

      if (user.emailVerified) {
        return res.status(400).json({ message: 'This email is already verified' });
      }

      const { token, expires } = authStorage.createVerificationToken();
      await authStorage.updateUser(user.id, {
        emailVerificationToken: token,
        emailVerificationExpires: expires,
      });

      const { sent, verifyUrl } = await sendVerificationEmail(user.email!, token);

      res.json({
        success: true,
        message: 'Verification email sent',
        emailSent: sent,
        verifyUrl: sent ? undefined : verifyUrl,
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ message: 'Failed to resend verification email' });
    }
  });

  app.post('/api/auth/forgot-password', async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }

      const normalizedEmail = email.trim().toLowerCase();
      const user = await authStorage.getUserByEmail(normalizedEmail);

      if (user && user.password && user.authProvider === 'email') {
        const { token, expires } = authStorage.createPasswordResetToken();
        await authStorage.updateUser(user.id, {
          passwordResetToken: token,
          passwordResetExpires: expires,
        });

        const { sent, resetUrl } = await sendPasswordResetEmail(normalizedEmail, token);

        return res.json({
          success: true,
          message: 'If an account exists with that email, a password reset link has been sent.',
          emailSent: sent,
          resetUrl: sent ? undefined : resetUrl,
        });
      }

      res.json({
        success: true,
        message: 'If an account exists with that email, a password reset link has been sent.',
      });
    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ message: 'Failed to process password reset request' });
    }
  });

  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        return res.status(400).json({ message: 'Token and new password are required' });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }

      const user = await authStorage.getUserByPasswordResetToken(token);
      if (!user) {
        return res.status(400).json({ message: 'Invalid or expired reset link' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const updatedUser = await authStorage.updateUser(user.id, {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
        emailVerified: true,
      });

      if (!updatedUser) {
        return res.status(500).json({ message: 'Failed to reset password' });
      }

      if (req.session) {
        (req.session as any).userId = updatedUser.id;
        (req.session as any).user = updatedUser;
      }

      res.json({ success: true, user: await toSafeUser(updatedUser) });
    } catch (error) {
      console.error('Reset password error:', error);
      res.status(500).json({ message: 'Failed to reset password' });
    }
  });

  // Logout route
  app.get('/api/logout', (req: Request, res: Response) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Logout error:', err);
          return res.status(500).json({ message: 'Failed to logout' });
        }
        res.clearCookie('connect.sid');
        res.redirect('/');
      });
    } else {
      res.redirect('/');
    }
  });

  app.post('/api/logout', (req: Request, res: Response) => {
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error('Logout error:', err);
          return res.status(500).json({ message: 'Failed to logout' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true });
      });
    } else {
      res.json({ success: true });
    }
  });

  // Get current user
  app.get('/api/auth/user', async (req: Request, res: Response) => {
    if (!req.session || !(req.session as any).userId) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await authStorage.getUser((req.session as any).userId);
    if (!user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    res.json(await toSafeUser(user));
  });

  // Update user profile, email, and/or password
  app.put('/api/auth/profile', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const userId = (req.session as any).userId;
      const parsed = updateAccountSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: 'Invalid account details',
          details: parsed.error.flatten(),
        });
      }

      const { name, email, currentPassword, newPassword } = parsed.data;
      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const normalizedEmail = email?.trim().toLowerCase();
      const emailChanging =
        normalizedEmail && normalizedEmail !== (user.email || '').toLowerCase();
      const passwordChanging = Boolean(newPassword);

      if (!name?.trim() && !emailChanging && !passwordChanging) {
        return res.status(400).json({ message: 'No changes to save' });
      }

      if (emailChanging || passwordChanging) {
        if (user.password) {
          if (!currentPassword) {
            return res.status(400).json({
              message: 'Current password is required to change email or password',
            });
          }
          const passwordValid = await bcrypt.compare(currentPassword, user.password);
          if (!passwordValid) {
            return res.status(401).json({ message: 'Current password is incorrect' });
          }
        } else if (emailChanging) {
          return res.status(400).json({
            message: 'Set a password first before changing your email',
          });
        }
      }

      const updates: Partial<User> = {};

      if (name?.trim()) {
        const nameParts = name.trim().split(/\s+/);
        updates.firstName = nameParts[0] || '';
        updates.lastName = nameParts.slice(1).join(' ') || '';
      }

      if (emailChanging && normalizedEmail) {
        const existing = await authStorage.getUserByEmail(normalizedEmail);
        if (existing && existing.id !== userId) {
          return res.status(400).json({ message: 'An account with this email already exists' });
        }
        updates.email = normalizedEmail;
      }

      if (passwordChanging && newPassword) {
        updates.password = await bcrypt.hash(newPassword, 10);
      }

      const updatedUser = await authStorage.updateUser(userId, updates);

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      (req.session as any).user = updatedUser;

      res.json({ success: true, user: await toSafeUser(updatedUser) });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // Upload profile picture
  app.post('/api/auth/profile-picture', profilePictureUpload.single('profilePicture'), async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const userId = (req.session as any).userId;
      const profileImageUrl = `/uploads/profiles/${req.file.filename}`;

      const updatedUser = await authStorage.updateUser(userId, { profileImageUrl });
      
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Update session with new user data
      (req.session as any).user = updatedUser;

      res.json({ success: true, profileImageUrl, user: await toSafeUser(updatedUser) });
    } catch (error) {
      console.error('Profile picture upload error:', error);
      res.status(500).json({ message: 'Failed to upload profile picture' });
    }
  });

  app.post('/api/auth/brand-logo', (req: Request, res: Response, next) => {
    brandLogoUpload.single('brandLogo')(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'Image must be 5 MB or smaller.' });
      }
      if (err) {
        return res.status(400).json({ message: err.message || 'Invalid image file' });
      }
      next();
    });
  }, async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const userId = (req.session as any).userId;
      const brandLogoUrl = `/uploads/logos/${req.file.filename}`;

      const updatedUser = await authStorage.updateUser(userId, { brandLogoUrl });

      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      (req.session as any).user = updatedUser;

      res.json({ success: true, brandLogoUrl, user: await toSafeUser(updatedUser) });
    } catch (error) {
      console.error('Brand logo upload error:', error);
      res.status(500).json({ message: 'Failed to upload brand logo' });
    }
  });

  app.delete('/api/auth/brand-logo', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const userId = (req.session as any).userId;
      const user = await authStorage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (user.brandLogoUrl?.startsWith('/uploads/logos/')) {
        const logoPath = path.join(process.cwd(), user.brandLogoUrl.replace(/^\//, ''));
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
        }
      }

      const updatedUser = await authStorage.updateUser(userId, { brandLogoUrl: null });
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      (req.session as any).user = updatedUser;

      res.json({ success: true, user: await toSafeUser(updatedUser) });
    } catch (error) {
      console.error('Brand logo delete error:', error);
      res.status(500).json({ message: 'Failed to remove brand logo' });
    }
  });

  app.get('/api/admin/summary', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      const [projects, users] = await Promise.all([
        storage.getAllProjects(),
        authStorage.getAllUsers(),
      ]);

      const trackedProfitIds = await adminAuditStorage.getTrackedProfitProjectIds();
      const missingCompletedProjects = projects.filter(
        (project) => project.status === 'completed' && !trackedProfitIds.has(project.id)
      );

      for (const project of missingCompletedProjects) {
        const durationSeconds = Math.round(project.originalVideo?.duration || 0);
        const clipsCount = Math.max(1, Math.min(5, Math.round((durationSeconds || 60) / 90)));
        const profit = calculateEstimatedProfitMetrics({
          videoDurationSeconds: durationSeconds,
          clipsCount,
        });

        await adminAuditStorage.logProfitEvent({
          projectId: project.id,
          projectName: project.name,
          revenueCents: profit.revenueCents,
          costCents: profit.costCents,
          clipsCount,
          videoDurationSeconds: durationSeconds,
          source: 'historical_backfill',
        });
      }

      const dateRange = resolveAdminDateRange(
        typeof req.query.range === 'string' ? req.query.range : undefined,
        typeof req.query.start === 'string' ? req.query.start : undefined,
        typeof req.query.end === 'string' ? req.query.end : undefined,
      );

      const profitSummary = await adminAuditStorage.getProfitSummary({
        start: dateRange.start,
        end: dateRange.end,
      });
      const [billingStats, planPurchases, currentPlans, planAdoptionOperating] = await Promise.all([
        billingStorage.getAdminBillingStats({
          start: dateRange.start,
          end: dateRange.end,
        }),
        billingStorage.getPlanPurchaseBreakdown({
          start: dateRange.start,
          end: dateRange.end,
        }),
        billingStorage.getCurrentPlanCounts(),
        billingStorage.getPlanAdoptionOperatingStats({
          start: dateRange.start,
          end: dateRange.end,
        }),
      ]);

      const planPurchasesWithOperatingCost = planPurchases.map((plan) => ({
        ...plan,
        operatingCostCents:
          planAdoptionOperating.totalCreditsGranted > 0
            ? Math.round(
                planAdoptionOperating.operatingCostCents *
                  (plan.creditsGranted / planAdoptionOperating.totalCreditsGranted),
              )
            : 0,
      }));

      const projectDaily = profitSummary.daily.map((day) => ({
        ...day,
        costCents: 0,
        profitCents: day.revenueCents,
      }));

      const financials = mergeAdminFinancialSummary(
        projectDaily,
        {
          totalRevenueCents: profitSummary.totalRevenueCents,
          totalCostCents: 0,
        },
        billingStats.daily,
        billingStats.totalRevenueCents,
        planAdoptionOperating.operatingCostCents,
        planAdoptionOperating.daily.map((day) => ({
          date: day.date,
          operatingCostCents: day.operatingCostCents,
        })),
      );

      const userSummaries = await Promise.all(users.map((u) => toSafeUser(u)));

      const totalUsers = users.length;
      const adminUsers = userSummaries.filter((u) => u.role === 'admin').length;
      const suspendedUsers = userSummaries.filter((u) => u.status === 'suspended').length;
      const totalProjects = projects.length;
      const failedProjects = projects.filter((p) => p.status === 'failed').length;
      const completedProjects = projects.filter((p) => p.status === 'completed').length;
      const processingProjects = projects.filter(
        (p) => !['completed', 'failed'].includes(p.status)
      ).length;

      res.json({
        users: {
          total: totalUsers,
          admins: adminUsers,
          suspended: suspendedUsers,
          active: totalUsers - suspendedUsers,
        },
        projects: {
          total: totalProjects,
          completed: completedProjects,
          failed: failedProjects,
          inProgress: processingProjects,
          successRate:
            totalProjects > 0
              ? Number(((completedProjects / totalProjects) * 100).toFixed(1))
              : 0,
        },
        profit: {
          totalRevenueCents: financials.grossRevenueCents,
          totalCostCents: financials.operatingCostCents,
          totalProfitCents: financials.netProfitCents,
          profitMargin:
            financials.grossRevenueCents > 0
              ? Number(financials.profitMargin.toFixed(1))
              : 0,
          trendChangePercent: Number(financials.trendChangePercent.toFixed(1)),
          daily: financials.daily,
          billingRevenueCents: financials.billingRevenueCents,
          projectRevenueCents: financials.projectRevenueCents,
          planAdoptionOperatingCostCents: financials.planAdoptionOperatingCostCents,
          planAdoptionOperating: {
            totalCreditsGranted: planAdoptionOperating.totalCreditsGranted,
            operatingCostCents: planAdoptionOperating.operatingCostCents,
            blockCount: planAdoptionOperating.blockCount,
            creditsPerBlock: planAdoptionOperating.tokensPerBlock,
            costPerBlockCents: planAdoptionOperating.costPerBlockCents,
          },
          paymentCount: billingStats.paymentCount,
        },
        billing: {
          totalRevenueCents: billingStats.totalRevenueCents,
          paymentCount: billingStats.paymentCount,
          recentPayments: billingStats.recentPayments,
        },
        dateRange: {
          preset: dateRange.preset,
          label: dateRange.label,
          start: dateRange.start.toISOString(),
          end: dateRange.end.toISOString(),
          dayCount: dateRange.dayCount,
        },
        planPurchases: planPurchasesWithOperatingCost,
        currentPlans,
      });
    } catch (error) {
      console.error('Error fetching admin summary:', error);
      res.status(500).json({ message: 'Failed to fetch admin summary' });
    }
  });

  app.get('/api/admin/users', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      const users = await authStorage.getAllUsers();
      const safeUsers = await Promise.all(users.map((user) => toSafeUser(user)));
      res.json(safeUsers);
    } catch (error) {
      console.error('Error fetching admin users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.patch('/api/admin/users/:id', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      const targetId = String(req.params.id);
      const { role, status } = req.body as {
        role?: AdminRole;
        status?: 'active' | 'suspended';
      };

      const targetUser = await authStorage.getUser(targetId);
      if (!targetUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (targetId === currentUser.id && status === 'suspended') {
        return res.status(400).json({ message: 'You cannot suspend your own account' });
      }

      if (targetId === currentUser.id && role && role !== 'admin') {
        return res.status(400).json({ message: 'You cannot remove your own admin role' });
      }

      if (role) {
        if (!['admin', 'moderator', 'user'].includes(role)) {
          return res.status(400).json({ message: 'Invalid role value' });
        }
        userRoleOverrides.set(targetId, role);

        await adminAuditStorage.logEvent({
          actorId: currentUser.id,
          actorEmail: currentUser.email,
          action: "admin_user_role_updated",
          resourceType: "user",
          resourceId: targetId,
          details: {
            targetEmail: targetUser.email,
            newRole: role,
          },
        });
      }

      if (status) {
        if (!['active', 'suspended'].includes(status)) {
          return res.status(400).json({ message: 'Invalid status value' });
        }
        if (status === 'suspended') {
          suspendedUserIds.add(targetId);
        } else {
          suspendedUserIds.delete(targetId);
        }

        await adminAuditStorage.logEvent({
          actorId: currentUser.id,
          actorEmail: currentUser.email,
          action: status === 'suspended' ? 'admin_user_suspended' : 'admin_user_reactivated',
          resourceType: "user",
          resourceId: targetId,
          details: {
            targetEmail: targetUser.email,
            newStatus: status,
          },
        });
      }

      res.json({ success: true, user: await toSafeUser(targetUser) });
    } catch (error) {
      console.error('Error updating admin user:', error);
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  app.get('/api/admin/social-accounts', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      const accounts = await socialMediaStorage.listAllForAdmin();
      const byPlatform = accounts.reduce<Record<string, number>>((acc, row) => {
        acc[row.platform] = (acc[row.platform] || 0) + 1;
        return acc;
      }, {});

      res.json({
        total: accounts.length,
        byPlatform,
        accounts,
      });
    } catch (error) {
      console.error('Error fetching admin social accounts:', error);
      res.status(500).json({ message: 'Failed to fetch social accounts' });
    }
  });

  app.get('/api/admin/billing/overview', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      const [overview, planCounts] = await Promise.all([
        billingStorage.getAdminBillingOverview(),
        billingStorage.getCurrentPlanCounts(),
      ]);

      res.json({
        ...overview,
        planCounts,
        billingMode: isDemoBillingEnabled() ? 'sandbox' : 'live',
      });
    } catch (error) {
      console.error('Error fetching admin billing overview:', error);
      res.status(500).json({ message: 'Failed to fetch billing overview' });
    }
  });

  app.get('/api/admin/payments', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      const dateRange = resolveAdminDateRange(
        typeof req.query.range === 'string' ? req.query.range : '30d',
        typeof req.query.start === 'string' ? req.query.start : undefined,
        typeof req.query.end === 'string' ? req.query.end : undefined,
      );

      const stats = await billingStorage.getAdminBillingStats({
        start: dateRange.start,
        end: dateRange.end,
      });
      res.json(stats);
    } catch (error) {
      console.error('Error fetching admin payments:', error);
      res.status(500).json({ message: 'Failed to fetch payments' });
    }
  });

  app.get('/api/admin/audit-logs', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      const logs = await adminAuditStorage.getRecentEvents(25);
      res.json(logs);
    } catch (error) {
      console.error('Error fetching admin audit logs:', error);
      res.status(500).json({ message: 'Failed to fetch audit logs' });
    }
  });

  app.get('/api/admin/system-config', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      res.json({
        aiGatewayMode: getAiGatewayMode(),
        hasOpenAiKey: hasOpenAiKey(),
        billingMode: isDemoBillingEnabled() ? 'demo' : 'live',
        maxUploadMb: MAX_VIDEO_UPLOAD_BYTES / (1024 * 1024),
        reelPromptRequiredForOpenAi: true,
        creditPackages: await planStorage.getPackages(),
      });
    } catch (error) {
      console.error('Error fetching admin system config:', error);
      res.status(500).json({ message: 'Failed to fetch system config' });
    }
  });

  app.get('/api/admin/plans', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      res.json({ packages: await planStorage.getPackages() });
    } catch (error) {
      console.error('Error fetching admin plans:', error);
      res.status(500).json({ message: 'Failed to fetch plans' });
    }
  });

  app.put('/api/admin/plans', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      const parsed = updateAdminPlansSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid plan data', errors: parsed.error.flatten() });
      }

      const packages = await planStorage.savePackages(parsed.data.packages);

      res.json({ packages });
    } catch (error) {
      console.error('Error saving admin plans:', error);
      res.status(500).json({ message: 'Failed to save plans' });
    }
  });

  app.get('/api/announcements', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const items = await announcementStorage.listActive();
      res.json({ announcements: items });
    } catch (error) {
      console.error('Error fetching announcements:', error);
      res.status(500).json({ message: 'Failed to fetch announcements' });
    }
  });

  app.get('/api/admin/announcements', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      const items = await announcementStorage.listAll();
      res.json({ announcements: items });
    } catch (error) {
      console.error('Error fetching admin announcements:', error);
      res.status(500).json({ message: 'Failed to fetch announcements' });
    }
  });

  app.post('/api/admin/announcements', (req: Request, res: Response, next) => {
    announcementImageUpload.single('image')(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ message: 'Image must be 5 MB or smaller.' });
      }
      if (err) {
        return res.status(400).json({ message: err.message || 'Invalid image upload' });
      }
      next();
    });
  }, async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      const active = req.body.active !== false && req.body.active !== 'false';

      const parsed = createAnnouncementSchema.safeParse({
        title: req.body.title,
        body: req.body.body ?? '',
        linkUrl: req.body.linkUrl?.trim() || null,
        frameRatio: req.body.frameRatio || '1:1',
        active,
        imageUrl: req.file ? `/uploads/announcements/${req.file.filename}` : null,
      });

      if (!parsed.success) {
        if (req.file) {
          fs.unlinkSync(path.join(announcementImagesDir, req.file.filename));
        }
        return res.status(400).json({ message: 'Invalid announcement', errors: parsed.error.flatten() });
      }

      const announcement = await announcementStorage.create(parsed.data);

      await adminAuditStorage.logEvent({
        actorId: currentUser.id,
        actorEmail: currentUser.email,
        action: 'announcement_created',
        resourceType: 'announcement',
        resourceId: announcement.id,
        details: { title: announcement.title, active: announcement.active, hasImage: Boolean(announcement.imageUrl) },
      });

      res.status(201).json({ announcement });
    } catch (error) {
      if (req.file) {
        try {
          fs.unlinkSync(path.join(announcementImagesDir, req.file.filename));
        } catch {
          // ignore cleanup errors
        }
      }
      console.error('Error creating announcement:', error);
      res.status(500).json({ message: 'Failed to create announcement' });
    }
  });

  app.patch('/api/admin/announcements/:id', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      const parsed = updateAnnouncementSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Invalid announcement update', errors: parsed.error.flatten() });
      }

      const announcement = await announcementStorage.update(req.params.id, parsed.data);
      if (!announcement) {
        return res.status(404).json({ message: 'Announcement not found' });
      }

      await adminAuditStorage.logEvent({
        actorId: currentUser.id,
        actorEmail: currentUser.email,
        action: parsed.data.active !== undefined ? 'announcement_status_changed' : 'announcement_updated',
        resourceType: 'announcement',
        resourceId: announcement.id,
        details: parsed.data,
      });

      res.json({ announcement });
    } catch (error) {
      console.error('Error updating announcement:', error);
      res.status(500).json({ message: 'Failed to update announcement' });
    }
  });

  app.delete('/api/admin/announcements/:id', async (req: Request, res: Response) => {
    try {
      if (!req.session || !(req.session as any).userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const currentUser = await authStorage.getUser((req.session as any).userId);
      if (!currentUser || !(await isUserAdmin(currentUser))) {
        return res.status(403).json({ message: 'Forbidden: admin access required' });
      }

      const deleted = await announcementStorage.deletePermanently(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: 'Announcement not found' });
      }

      await adminAuditStorage.logEvent({
        actorId: currentUser.id,
        actorEmail: currentUser.email,
        action: 'announcement_deleted',
        resourceType: 'announcement',
        resourceId: req.params.id,
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting announcement:', error);
      res.status(500).json({ message: 'Failed to delete announcement' });
    }
  });

  app.get('/api/projects', async (req: Request, res: Response) => {
    try {
      const userId = getBillingUserId(req);
      if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      const projects = await storage.getProjectsByUserId(userId);
      res.json(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.get('/api/projects/:id', async (req: Request, res: Response) => {
    try {
      const project = await requireOwnedProject(req, res, req.params.id);
      if (!project) return;
      res.json(project);
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  });

  app.patch('/api/projects/:id', async (req: Request, res: Response) => {
    try {
      const existing = await requireOwnedProject(req, res, req.params.id);
      if (!existing) return;

      const parsed = updateProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid project update', details: parsed.error.flatten() });
      }

      const project = await storage.updateProject(req.params.id, { name: parsed.data.name });
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json(project);
    } catch (error) {
      console.error('Error updating project:', error);
      res.status(500).json({ error: 'Failed to update project' });
    }
  });

  app.get('/api/projects/:id/reels', async (req: Request, res: Response) => {
    try {
      const project = await requireOwnedProject(req, res, req.params.id);
      if (!project) return;

      const reels = await storage.getReelsByProject(req.params.id);
      res.json(reels);
    } catch (error) {
      console.error('Error fetching reels:', error);
      res.status(500).json({ error: 'Failed to fetch reels' });
    }
  });

  app.delete('/api/projects/:id', async (req: Request, res: Response) => {
    try {
      const project = await requireOwnedProject(req, res, req.params.id);
      if (!project) return;

      const success = await storage.deleteProject(req.params.id);
      if (!success) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ success: true, deletedProjectId: req.params.id });
    } catch (error) {
      console.error('Error deleting project:', error);
      res.status(500).json({ error: 'Failed to delete project' });
    }
  });

  app.post('/api/upload', (req: Request, res: Response, next) => {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return next();
    }

    upload.single('video')(req, res, (err) => {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File too large',
          message: 'Maximum video upload size is 1 GB.',
        });
      }
      if (err) return next(err);
      next();
    });
  }, async (req: Request, res: Response) => {
    try {
      const billingUserId = getBillingUserId(req);
      let videoPath: string;
      let filename: string;
      let fileSize: number;
      let options: UploadOptions = uploadOptionsSchema.parse({});

      if (req.body.options) {
        try {
          const parsed = typeof req.body.options === "string"
            ? JSON.parse(req.body.options)
            : req.body.options;
          const result = uploadOptionsSchema.safeParse(parsed);
          if (result.success) {
            options = result.data;
          } else {
            const details = result.error.issues
              .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
              .join("; ");
            console.warn(`Invalid upload options, using defaults: ${details}`);
          }
        } catch {
          console.warn("Invalid upload options JSON, using defaults");
        }
      }

      if (billingUserId) {
        const wallet = await billingStorage.getOrCreateWallet(billingUserId);
        const estimatedCost = calculateProcessingCost(options, 60);
        if (wallet.balance < estimatedCost) {
          return res.status(402).json({
            error: 'Insufficient credits',
            message: `You need at least ${estimatedCost} credits. You have ${wallet.balance}. Add credits in Settings → Billing.`,
            creditsBalance: wallet.balance,
            estimatedCost,
          });
        }
      }

      if (req.file) {
        videoPath = req.file.path;
        filename = req.file.originalname;
        fileSize = req.file.size;
      } else if (req.body.url) {
        const url = String(req.body.url).trim();
        if (!isYouTubeUrl(url)) {
          return res.status(400).json({
            error: "Invalid YouTube URL",
            message: "Paste a valid YouTube watch, Shorts, or youtu.be link.",
          });
        }

        try {
          const downloaded = await downloadYouTubeVideo(url, uploadDir);
          videoPath = downloaded.path;
          filename = downloaded.filename;
          fileSize = fs.statSync(videoPath).size;

          if (fileSize > 1024 * 1024 * 1024) {
            fs.unlinkSync(videoPath);
            return res.status(413).json({
              error: "File too large",
              message: "Maximum video upload size is 1 GB.",
            });
          }
        } catch (error) {
          console.error("YouTube download error:", error);
          return res.status(400).json({
            error: "YouTube download failed",
            message:
              error instanceof Error
                ? error.message
                : "Could not download the YouTube video. Try another link or upload a file.",
          });
        }
      } else {
        return res.status(400).json({ error: "No video file provided" });
      }

      const project = await storage.createProject({
        name: filename.replace(/\.[^/.]+$/, ''),
        userId: billingUserId ?? undefined,
        originalVideo: {
          filename,
          duration: 0,
          size: fileSize,
          format: path.extname(filename).slice(1),
          path: videoPath,
        },
      });

      processVideo(project.id, videoPath, options, billingUserId ?? undefined).catch(error => {
        console.error('Video processing error:', error);
        storage.updateProject(project.id, {
          status: 'failed',
          error: error.message || 'Processing failed',
        });
      });

      res.json({
        success: true,
        projectId: project.id,
        videoPath,
        metadata: {
          filename,
          size: fileSize,
          format: path.extname(filename).slice(1),
        },
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Failed to upload video' });
    }
  });

  app.post('/api/projects/:id/cancel', async (req: Request, res: Response) => {
    try {
      const existing = await requireOwnedProject(req, res, req.params.id);
      if (!existing) return;

      const project = await storage.updateProject(req.params.id, {
        status: 'failed',
        error: 'Processing was cancelled by user',
      });
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Error cancelling project:', error);
      res.status(500).json({ error: 'Failed to cancel project' });
    }
  });

  app.post('/api/projects/:id/retry', async (req: Request, res: Response) => {
    try {
      const project = await requireOwnedProject(req, res, req.params.id);
      if (!project) return;

      await storage.updateProject(project.id, {
        status: 'uploading',
        progress: 0,
        error: undefined,
      });

      if (project.originalVideo?.path) {
        const billingUserId = getBillingUserId(req);
        processVideo(
          project.id,
          project.originalVideo.path,
          {
            clipCount: 3,
            minDuration: 20,
            maxDuration: 40,
          },
          billingUserId ?? undefined,
        ).catch(error => {
          console.error('Video processing error:', error);
          storage.updateProject(project.id, {
            status: 'failed',
            error: error.message || 'Processing failed',
          });
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error retrying project:', error);
      res.status(500).json({ error: 'Failed to retry project' });
    }
  });

  app.patch('/api/reels/:projectId/:reelId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const project = await requireOwnedProject(req, res, req.params.projectId);
      if (!project) return;

      const parsed = updateReelCaptionSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid caption', details: parsed.error.flatten() });
      }

      const reel = await storage.updateReel(req.params.projectId, req.params.reelId, {
        caption: parsed.data.caption.trim(),
      });

      if (!reel) {
        return res.status(404).json({ error: 'Reel not found' });
      }

      res.json(reel);
    } catch (error) {
      console.error('Error updating reel caption:', error);
      res.status(500).json({ error: 'Failed to update caption' });
    }
  });

  // Protected route - requires authentication to download
  app.get('/api/reels/:projectId/:reelId/download', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const project = await requireOwnedProject(req, res, req.params.projectId);
      if (!project) return;

      const reel = await storage.getReel(req.params.projectId, req.params.reelId);
      if (!reel) {
        return res.status(404).json({ error: 'Reel not found' });
      }

      const reelPath = path.join(outputDir, req.params.projectId, `reel_${reel.id}.mp4`);
      
      if (fs.existsSync(reelPath)) {
        res.download(reelPath, `reel_${reel.id}.mp4`);
      } else if (reel.url) {
        res.redirect(reel.url);
      } else {
        res.status(404).json({ error: 'Reel file not found' });
      }
    } catch (error) {
      console.error('Error downloading reel:', error);
      res.status(500).json({ error: 'Failed to download reel' });
    }
  });

  app.use('/uploads', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  }, express.static(uploadDir));

  app.use('/outputs', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  }, express.static(outputDir));

  return httpServer;
}
