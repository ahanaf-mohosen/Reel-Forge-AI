import type { Express, Request, Response } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { processVideo } from "./services/videoProcessor";
import { setupAuth, isAuthenticated } from "./auth";
import { authStorage } from "./integrations/auth";
import type { UploadOptions } from "@shared/schema";

const uploadDir = path.join(process.cwd(), 'uploads');
const outputDir = path.join(process.cwd(), 'outputs');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

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
    fileSize: 500 * 1024 * 1024,
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup simple session-based authentication
  await setupAuth(app);
  
  // Email/Password Sign Up
  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      const { name, email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      
      const existingUser = await authStorage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: 'An account with this email already exists' });
      }
      
      const hashedPassword = await bcrypt.hash(password, 10);
      const nameParts = (name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      const user = await authStorage.upsertUser({
        email,
        password: hashedPassword,
        firstName,
        lastName,
        authProvider: 'email',
      });
      
      // Set session
      if (req.session) {
        (req.session as any).userId = user.id;
        (req.session as any).user = user;
      }
      
      res.json({ success: true, user: { ...user, password: undefined } });
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
      
      const user = await authStorage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
      
      // Set session
      if (req.session) {
        (req.session as any).userId = user.id;
        (req.session as any).user = user;
      }
      
      res.json({ success: true, user: { ...user, password: undefined } });
    } catch (error) {
      console.error('Signin error:', error);
      res.status(500).json({ message: 'Failed to sign in' });
    }
  });
  
  app.get('/api/projects', async (req: Request, res: Response) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      res.status(500).json({ error: 'Failed to fetch projects' });
    }
  });

  app.get('/api/projects/:id', async (req: Request, res: Response) => {
    try {
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json(project);
    } catch (error) {
      console.error('Error fetching project:', error);
      res.status(500).json({ error: 'Failed to fetch project' });
    }
  });

  app.get('/api/projects/:id/reels', async (req: Request, res: Response) => {
    try {
      const reels = await storage.getReelsByProject(req.params.id);
      res.json(reels);
    } catch (error) {
      console.error('Error fetching reels:', error);
      res.status(500).json({ error: 'Failed to fetch reels' });
    }
  });

  app.delete('/api/projects/:id', async (req: Request, res: Response) => {
    try {
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

  app.post('/api/upload', upload.single('video'), async (req: Request, res: Response) => {
    try {
      let videoPath: string;
      let filename: string;
      let fileSize: number;
      let options: UploadOptions = { clipCount: 3, minDuration: 20, maxDuration: 40 };

      if (req.body.options) {
        try {
          options = JSON.parse(req.body.options);
        } catch (e) {
        }
      }

      if (req.file) {
        videoPath = req.file.path;
        filename = req.file.originalname;
        fileSize = req.file.size;
      } else if (req.body.url) {
        return res.status(400).json({ 
          error: 'URL uploads are not yet supported. Please upload a video file directly.' 
        });
      } else {
        return res.status(400).json({ error: 'No video file provided' });
      }

      const project = await storage.createProject({
        name: filename.replace(/\.[^/.]+$/, ''),
        originalVideo: {
          filename,
          duration: 0,
          size: fileSize,
          format: path.extname(filename).slice(1),
          path: videoPath,
        },
      });

      processVideo(project.id, videoPath, options).catch(error => {
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
      const project = await storage.getProject(req.params.id);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      await storage.updateProject(project.id, {
        status: 'uploading',
        progress: 0,
        error: undefined,
      });

      if (project.originalVideo?.path) {
        processVideo(project.id, project.originalVideo.path, {
          clipCount: 3,
          minDuration: 20,
          maxDuration: 40,
        }).catch(error => {
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

  // Protected route - requires authentication to download
  app.get('/api/reels/:projectId/:reelId/download', isAuthenticated, async (req: Request, res: Response) => {
    try {
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
