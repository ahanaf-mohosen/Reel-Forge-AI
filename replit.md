# Reels Forge.AI

AI-powered web application that converts long-form videos into viral short-form reels optimized for Instagram Reels, TikTok, and YouTube Shorts.

## Overview

Reels Forge.AI automatically analyzes video content, identifies the most engaging moments, and generates 3 ready-to-publish vertical reels (20-40 seconds each) in 9:16 format.

## Technology Stack

- **Frontend**: React 18 + TypeScript, Vite, TanStack Query, Wouter routing
- **Backend**: Express.js, Node.js
- **UI**: Shadcn/UI components, Tailwind CSS
- **AI**: OpenAI (GPT-4o for analysis, Whisper for transcription) via Replit AI Integrations
- **Video Processing**: FFmpeg for audio extraction, clip cutting, and vertical formatting
- **Storage**: In-memory storage (MVP)

## Project Structure

```
client/src/
├── pages/
│   ├── landing.tsx      # Hero page with upload panel
│   ├── dashboard.tsx    # Main dashboard with stats and recent projects
│   ├── create.tsx       # Create new reel page
│   ├── processing.tsx   # Processing status with step indicators
│   ├── results.tsx      # View generated reels
│   ├── library.tsx      # All projects with filters
│   └── settings.tsx     # User settings and preferences
├── components/
│   ├── upload-panel.tsx     # Video upload (file/URL)
│   ├── project-card.tsx     # Project preview card
│   ├── reel-card.tsx        # Reel preview with controls
│   ├── processing-steps.tsx # Processing progress indicator
│   ├── app-sidebar.tsx      # Navigation sidebar
│   └── theme-toggle.tsx     # Dark/light mode toggle
└── lib/
    └── queryClient.ts   # TanStack Query setup

server/
├── routes.ts           # API endpoints
├── storage.ts          # In-memory storage interface
└── services/
    └── videoProcessor.ts  # Video processing pipeline
```

## API Endpoints

- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get project by ID
- `GET /api/projects/:id/reels` - Get reels for a project
- `POST /api/upload` - Upload video file
- `DELETE /api/projects/:id` - Delete project
- `POST /api/projects/:id/cancel` - Cancel processing
- `POST /api/projects/:id/retry` - Retry failed processing
- `GET /api/reels/:projectId/:reelId/download` - Download reel

## Video Processing Pipeline

1. **Upload** - Receive and store video file
2. **Transcription** - Extract audio with FFmpeg, transcribe with Whisper
3. **Analysis** - GPT-4o identifies highlight moments
4. **Cutting** - FFmpeg extracts selected clips
5. **Formatting** - Convert to 9:16 vertical format

## Design System

- **Primary (Dark Green)**: #1B4332 - Main actions and branding
- **Secondary (Lime Green)**: #B5E550 - Success states and highlights
- **Accent (Lime Green)**: #B5E550 - Highlights and accents
- **Background**: Light mode #FAFAFA, Dark mode #0F172A
- **Logo**: Reels Forge.AI logo used in header, sidebar, and auth pages

## Running the Application

```bash
npm run dev
```

The application runs on port 5000 with both frontend and backend served together.

## Dependencies

Key packages:
- `openai` - AI integration
- `multer` - File uploads
- `ffmpeg` - Video processing
- `framer-motion` - Animations

## Authentication

The app supports dual authentication methods:

### Google Sign-In (Replit Auth / OIDC)
- **Login**: `/api/login` - Redirects to Replit OAuth for Google Sign-In
- **Callback**: `/api/callback` - Redirects to /dashboard after successful login
- **Logout**: `/api/logout` - Clears session and redirects to home

### Email/Password Authentication
- **Sign Up**: `POST /api/auth/signup` - Creates new user with bcrypt password hashing
- **Sign In**: `POST /api/auth/signin` - Authenticates existing user
- **User API**: `GET /api/auth/user` - Returns current authenticated user

Authentication is integrated with:
- **Auth page**: `/auth` with tabs for Sign In / Sign Up, supports both Google and email/password
- **Landing page**: Shows "Sign In" button when logged out, user avatar and logout when logged in
- **Download feature**: Protected route requiring authentication to download generated reels
- **Database**: PostgreSQL stores users (with password field for email auth) and sessions tables

Files:
- `server/replit_integrations/auth/` - Auth module with passport/OIDC setup
- `server/routes.ts` - Email/password auth endpoints
- `client/src/pages/auth.tsx` - Auth page with dual authentication forms
- `client/src/hooks/use-auth.ts` - React hook for auth state
- `shared/models/auth.ts` - User/session Drizzle schemas

## Recent Changes

- **Green Color Theme**: Updated to dark green primary (#1B4332) and lime green accent (#B5E550)
- **New Logo**: Reels Forge.AI logo integrated into landing, auth, and sidebar
- **Dual Authentication**: Added email/password sign-up/sign-in alongside Google OAuth
- **Auth Page**: New dedicated auth page at /auth with clean split-screen design
- **Landing Page Redesign**: Modern two-column layout with feature cards
- **OAuth Redirect**: Google sign-in now redirects to /dashboard after login
- Initial MVP implementation with complete upload → processing → results flow
- PostgreSQL database for user and session persistence
- Real-time processing status updates with polling
- All pages functional with proper navigation
