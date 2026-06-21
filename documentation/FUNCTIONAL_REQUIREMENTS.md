# FUNCTIONAL REQUIREMENTS - REEL FORGE AI
## AI-Powered Video Processing Platform

**Project:** Reel Forge AI  
**Developer:** Ahanaf Mohosen  
**Document Type:** Functional Requirements Specification  
**Date:** March 5, 2026

---

## Table of Contents

1. [Authentication & User Management](#1-authentication--user-management)
2. [Video Processing & Management](#2-video-processing--management)
3. [Social Media Integration](#3-social-media-integration)
4. [Dashboard & Analytics](#4-dashboard--analytics)
5. [Admin Panel (Phase 2)](#5-admin-panel-phase-2)
6. [Requirements Matrix](#6-requirements-matrix)

---

## 1. Authentication & User Management

| FR ID | Functional Requirement | Description | Stakeholder |
|-------|----------------------|-------------|-------------|
| **FR01** | **Registration & Login** | Users can create an account using email and password and log in securely. The system also supports Google OAuth login and email verification. | End User, Admin |
| **FR02** | **Profile Management** | Users can view and update their profile information, including name, profile photo, trusted contact email, and password. | End User |
| **FR03** | **Session Management** | The system maintains user sessions for 30 days with automatic logout after inactivity. Failed login attempts are rate-limited to 5 per 15 minutes. | End User, Admin |

### Detailed Specifications

#### FR01: Registration & Login
- **Input:** Email (valid format), password (min 8 characters with special characters)
- **Output:** User account created, verification email sent, session token generated
- **Validation:** Email uniqueness check, password strength validation
- **Security:** Passwords hashed using bcrypt (10 rounds), email verification required
- **Alternative Flow:** Google OAuth login bypasses email verification

#### FR02: Profile Management
- **Input:** Name, profile photo (JPG/PNG/WebP, max 5MB), contact email, password
- **Output:** Updated profile information, confirmation message
- **Validation:** Image format and size validation, email format validation
- **Security:** Profile photos stored securely, old images deleted upon update

#### FR03: Session Management
- **Input:** Login credentials or existing session token
- **Output:** Active session (30-day expiration)
- **Validation:** Token validity check, rate limiting on failed attempts
- **Security:** Secure HTTP-only cookies, CSRF protection

---

## 2. Video Processing & Management

| FR ID | Functional Requirement | Description | Stakeholder |
|-------|----------------------|-------------|-------------|
| **FR04** | **Video Upload** | Users can upload video files (MP4, MOV, AVI, WebM) up to 500MB via file selection or drag-and-drop interface with progress tracking. | End User |
| **FR05** | **AI Transcription** | The system uses OpenAI Whisper API to generate accurate transcripts with timestamps from uploaded videos. | End User |
| **FR06** | **Intelligent Highlight Detection** | The system analyzes video transcripts using AI to automatically identify engaging segments and assigns engagement scores (0-100). | End User |
| **FR07** | **Automated Clip Generation** | The system generates optimized vertical video clips (9:16 format, 1080x1920) from detected highlights, including original audio and visual effects. | End User |
| **FR08** | **Project Management** | Users can create, view, edit, and delete video projects. Each project displays processing status, metadata, and generated clips. | End User |
| **FR09** | **Video Preview & Playback** | Users can preview generated clips with full playback controls (play, pause, seek) before downloading or uploading. | End User |
| **FR10** | **Clip Download** | Users can download generated clips in MP4 format for local storage or manual distribution. | End User |

### Detailed Specifications

#### FR04: Video Upload
- **Input:** Video file (MP4, MOV, AVI, WebM), max 500MB
- **Output:** Uploaded file stored, project created with "uploading" status
- **Validation:** File type validation, size limit check, duplicate file detection
- **Processing:** Chunked upload for large files, progress indicator (0-100%)
- **Error Handling:** Resume capability on connection failure, clear error messages

#### FR05: AI Transcription
- **Input:** Uploaded video file
- **Output:** Text transcript with timestamps (SRT/VTT format)
- **Processing:** Audio extraction → Whisper API → Transcript generation
- **Performance:** ~60 seconds for 10-minute video
- **Error Handling:** Retry on API failure (max 3 attempts), notification on persistent failure

#### FR06: Intelligent Highlight Detection
- **Input:** Video transcript with timestamps
- **Output:** 3-5 highlight segments with engagement scores (0-100)
- **Algorithm:** NLP analysis for keywords, sentiment, and pacing
- **Criteria:** 
  - Segment length: 20-60 seconds
  - High energy keywords detected
  - Emotional engagement indicators
  - Contextual relevance score
- **Customization:** User can adjust sensitivity (low/medium/high)

#### FR07: Automated Clip Generation
- **Input:** Highlight segments from FR06
- **Output:** Vertical video clips (9:16, 1080x1920, MP4)
- **Processing:** 
  - Extract segment from original video (FFmpeg)
  - Convert to vertical format with smart cropping
  - Add optional captions overlay
  - Optimize for mobile viewing
- **Performance:** ~30 seconds per clip
- **Quality:** Maintain original video bitrate, audio AAC 128kbps

#### FR08: Project Management
- **Input:** Video file (new project) or project ID (existing)
- **Output:** Project list, project details, status updates
- **Features:**
  - Create project (via upload)
  - View all projects (list with thumbnails)
  - View project details (metadata, clips, status)
  - Delete project (with confirmation)
  - Search projects by title
  - Filter by status (uploading, processing, completed, error)
  - Sort by date, title, status

#### FR09: Video Preview & Playback
- **Input:** Clip ID or file path
- **Output:** Video player with controls
- **Features:**
  - Play/Pause toggle
  - Seek bar (scrubbing)
  - Volume control
  - Fullscreen mode
  - Clip information display (duration, score, timestamp)

#### FR10: Clip Download
- **Input:** Clip ID
- **Output:** MP4 file download
- **Format:** H.264 video codec, AAC audio codec, 1080x1920 resolution
- **Features:** 
  - Single clip download
  - Batch download (ZIP archive)
  - Custom filename option

---

## 3. Social Media Integration

| FR ID | Functional Requirement | Description | Stakeholder |
|-------|----------------------|-------------|-------------|
| **FR11** | **YouTube OAuth Integration** | The system authenticates users with YouTube using OAuth 2.0, enabling secure video uploads to their YouTube channel. | End User |
| **FR12** | **Facebook OAuth Integration** | The system authenticates users with Facebook using OAuth 2.0, allowing video posts to connected Facebook pages. | End User |
| **FR13** | **Instagram OAuth Integration** | The system authenticates users with Instagram using OAuth 2.0 for direct video posting to Instagram accounts. | End User |
| **FR14** | **Multi-Platform Upload** | Users can upload generated clips to YouTube, Facebook, and Instagram simultaneously or selectively with custom titles and descriptions. | End User |
| **FR15** | **Social Account Management** | Users can connect, disconnect, and manage multiple social media accounts from different platforms within the dashboard. | End User |
| **FR16** | **Upload Status Tracking** | The system displays real-time upload progress and completion status for each social media platform. | End User |

### Detailed Specifications

#### FR11: YouTube OAuth Integration
- **Input:** User authorization click
- **Output:** Connected YouTube account with upload permissions
- **OAuth Flow:**
  1. Redirect to Google OAuth consent screen
  2. User grants YouTube upload permissions
  3. System receives authorization code
  4. Exchange code for access token + refresh token
  5. Store tokens securely (encrypted)
  6. Fetch channel info for display
- **Permissions Required:** `youtube.upload`, `youtube.readonly`
- **Token Management:** Auto-refresh on expiration, re-authentication on revocation

#### FR12: Facebook OAuth Integration
- **Input:** User authorization click
- **Output:** Connected Facebook page(s) with posting permissions
- **OAuth Flow:**
  1. Redirect to Facebook login dialog
  2. User selects page and grants permissions
  3. System receives access token
  4. Store token and page ID
  5. Fetch page details
- **Permissions Required:** `pages_manage_posts`, `pages_read_engagement`, `publish_video`
- **Multi-Account:** Support multiple Facebook pages per user

#### FR13: Instagram OAuth Integration
- **Input:** User authorization click
- **Output:** Connected Instagram account
- **OAuth Flow:**
  1. Redirect to Instagram authorization
  2. User grants media upload permissions
  3. System receives access token
  4. Store credentials
  5. Fetch profile information
- **Permissions Required:** `instagram_content_publish`, `instagram_basic`
- **Validation:** Check account eligibility (Business/Creator account required)

#### FR14: Multi-Platform Upload
- **Input:** 
  - Clip ID
  - Selected platforms (YouTube, Facebook, Instagram)
  - Title (max 100 chars)
  - Description (max 5000 chars)
  - Privacy setting (public/unlisted/private)
- **Output:** Video uploaded to selected platforms, platform-specific URLs returned
- **Process:**
  1. Validate account connections
  2. Validate video format for each platform
  3. Upload to each platform via API
  4. Track upload progress
  5. Return success/failure status per platform
- **Platform Requirements:**
  - YouTube: MP4, max 256GB, 15min+ requires verification
  - Facebook: MP4, max 10GB, 240min max duration
  - Instagram: MP4, 3-60 seconds (Reels), 9:16 aspect ratio

#### FR15: Social Account Management
- **Input:** Platform selection, action (connect/disconnect)
- **Output:** Updated account list
- **Features:**
  - View all connected accounts
  - Display account names, profile pictures, connection status
  - Connect new account (OAuth flow)
  - Disconnect account (revoke token)
  - Reconnect expired accounts
  - Set default account per platform

#### FR16: Upload Status Tracking
- **Input:** Upload job ID
- **Output:** Real-time status updates
- **Status Types:**
  - Queued: Waiting to upload
  - Uploading: Transfer in progress (0-100%)
  - Processing: Platform processing video
  - Completed: Video live on platform
  - Failed: Error occurred (with reason)
- **Features:**
  - Progress bar for each platform
  - Platform-specific video URLs on completion
  - Error messages with retry option
  - Notification on completion

---

## 4. Dashboard & Analytics

| FR ID | Functional Requirement | Description | Stakeholder |
|-------|----------------------|-------------|-------------|
| **FR17** | **Dashboard Overview** | Users can view a comprehensive dashboard displaying statistics (total projects, clips generated, uploads), recent activity, and quick actions. | End User |
| **FR18** | **Project Search & Filter** | Users can search and filter projects by title, date, status, and platform to quickly locate specific content. | End User |
| **FR19** | **Activity History** | The system maintains a log of user activities including uploads, processing, and social media posts with timestamp tracking. | End User, Admin |

### Detailed Specifications

#### FR17: Dashboard Overview
- **Display Elements:**
  - **Total Projects:** Count of all user projects
  - **Clips Generated:** Total number of clips created
  - **Total Uploads:** Number of successful social media uploads
  - **Storage Used:** Current storage consumption (MB/GB)
  - **Recent Projects:** List of 5 most recent projects with thumbnails
  - **Quick Actions:** Upload new video, view all projects, manage accounts
  - **Connected Accounts:** Status of YouTube, Facebook, Instagram connections
- **Data Refresh:** Real-time updates on project status changes

#### FR18: Project Search & Filter
- **Search Fields:**
  - Project title (partial match, case-insensitive)
  - Upload date range (from/to)
- **Filter Options:**
  - Status: All, Uploading, Processing, Completed, Error
  - Platform: All, YouTube, Facebook, Instagram, None
  - Date: Today, This Week, This Month, Custom Range
- **Sort Options:**
  - Date (newest/oldest)
  - Title (A-Z, Z-A)
  - Status (alphabetical)
  - Clips count (high to low)

#### FR19: Activity History
- **Logged Activities:**
  - User registration/login
  - Video upload initiated
  - Processing completed
  - Clip generated
  - Social media upload (success/failure)
  - Account connected/disconnected
  - Profile updated
- **Display:**
  - Chronological list (newest first)
  - Activity type icon
  - Description text
  - Timestamp (relative and absolute)
  - Filter by activity type
- **Retention:** 90 days for regular users, permanent for admins

---

## 5. Admin Panel (Phase 2 - Future Development)

| FR ID | Functional Requirement | Description | Stakeholder |
|-------|----------------------|-------------|-------------|
| **FR20** | **User Management Dashboard** | Admins can view, search, filter, suspend, or delete user accounts with detailed user information and activity logs. | Admin |
| **FR21** | **Content Moderation** | Admins can review flagged content, approve/reject uploads, and manage content policies across the platform. | Admin |
| **FR22** | **System Analytics & Monitoring** | Admins can view real-time system metrics including active users, processing queue, API usage, storage consumption, and error rates. | Admin |
| **FR23** | **Configuration Management** | Admins can modify system settings including upload limits, processing parameters, API keys, and feature toggles. | Admin |
| **FR24** | **Audit Logs & Reporting** | The system maintains comprehensive audit logs of all admin actions and generates reports on user behavior, system performance, and platform usage. | Admin |
| **FR25** | **Role-Based Access Control (RBAC)** | Admins can create and manage different user roles (Super Admin, Moderator, Support) with granular permissions. | Admin |
| **FR26** | **Alert & Notification System** | Admins receive automated alerts for critical events such as system errors, suspicious activities, high resource usage, or policy violations. | Admin |

### Detailed Specifications

#### FR20: User Management Dashboard
- **Features:**
  - **User List:** Paginated table showing username, email, join date, projects count, status
  - **Search:** By username, email, user ID
  - **Filter:** By status (active/suspended), join date, activity level
  - **User Details:** Profile info, activity history, projects, uploads, storage usage
  - **Actions:**
    - Suspend account (temporarily disable)
    - Delete account (permanent removal with data deletion)
    - Reset password (send reset email)
    - View audit log for specific user
    - Impersonate user (for support debugging)
- **Permissions:** Super Admin only

#### FR21: Content Moderation
- **Features:**
  - **Flagged Content Queue:** List of videos flagged by automated system or user reports
  - **Review Interface:** 
    - Video preview
    - Flagging reason
    - User info
    - Violation history
  - **Actions:**
    - Approve (remove flag)
    - Reject (delete content, optionally suspend user)
    - Request changes
    - Escalate to senior moderator
  - **Policy Management:**
    - Define content rules
    - Configure automated flagging keywords
    - Set violation thresholds
- **Permissions:** Admin, Moderator

#### FR22: System Analytics & Monitoring
- **Real-Time Metrics:**
  - **User Metrics:** Active users (last 24h), new registrations, total users
  - **Processing Queue:** Jobs in queue, average wait time, completion rate
  - **API Usage:** Whisper API calls, YouTube/Facebook/Instagram API quotas
  - **Storage:** Total used, available, growth rate
  - **Error Rates:** Failed uploads, processing errors, API errors
  - **Performance:** Average processing time, server response time, uptime %
- **Visualizations:**
  - Line charts for trends (7-day, 30-day)
  - Pie charts for distribution (platforms, status)
  - Real-time gauges for critical metrics
- **Alerts:** Configurable thresholds with email/SMS notifications

#### FR23: Configuration Management
- **System Settings:**
  - **Upload Limits:** Max file size, allowed formats
  - **Processing Parameters:** Highlight detection sensitivity, clip duration range
  - **API Keys:** Whisper, YouTube, Facebook, Instagram credentials
  - **Feature Toggles:** Enable/disable features (OAuth providers, AI features)
  - **Rate Limits:** Upload per user, API calls per minute
  - **Storage Quotas:** Per-user storage limits
- **Change Management:**
  - Version control for configurations
  - Rollback capability
  - Audit log of all changes
  - Require confirmation for critical changes
- **Permissions:** Super Admin only

#### FR24: Audit Logs & Reporting
- **Audit Log Entries:**
  - Admin login/logout
  - User account modifications (suspend, delete, reset)
  - Configuration changes
  - Content moderation actions
  - System setting updates
  - RBAC permission changes
- **Log Details:** Timestamp, admin user, action type, affected entity, IP address, before/after values
- **Reports:**
  - **User Activity Report:** Registrations, uploads, engagement metrics
  - **System Performance Report:** Processing times, error rates, uptime
  - **Platform Usage Report:** Distribution across YouTube/Facebook/Instagram
  - **Revenue Report:** (Future: if monetization added)
  - **Security Report:** Failed login attempts, suspicious activities
- **Export:** PDF, CSV, Excel formats
- **Scheduling:** Daily, weekly, monthly automated reports

#### FR25: Role-Based Access Control (RBAC)
- **Predefined Roles:**
  - **Super Admin:** Full system access
  - **Admin:** User management, content moderation, analytics
  - **Moderator:** Content moderation only
  - **Support:** View-only access to user data for troubleshooting
- **Custom Roles:** Create roles with specific permission combinations
- **Permissions Granularity:**
  - User management (view, suspend, delete)
  - Content moderation (view, approve, reject)
  - System settings (view, modify)
  - Analytics (view, export)
  - Audit logs (view)
  - RBAC management (create roles, assign)
- **Role Assignment:**
  - Assign roles to admin users
  - One user can have multiple roles
  - Role hierarchy (Super Admin > Admin > Moderator > Support)
- **Security:** 2FA required for Super Admin actions

#### FR26: Alert & Notification System
- **Alert Types:**
  - **Critical:** System down, database failure, security breach
  - **High:** API quota exceeded, high error rate, storage 90% full
  - **Medium:** Processing queue backup, unusual user activity
  - **Low:** Daily summary, weekly reports
- **Alert Triggers:**
  - Error rate > 10% in last hour
  - Processing queue > 100 jobs
  - Storage > 90% capacity
  - Failed login attempts > 10 from same IP
  - API quota > 80% used
  - User upload > 100 videos in 1 hour
  - System uptime < 99%
- **Notification Channels:**
  - In-app notifications (admin dashboard)
  - Email alerts
  - SMS alerts (critical only)
  - Slack/Discord webhook integration
- **Alert Management:**
  - Acknowledge alerts
  - Snooze for X hours
  - Mark as resolved
  - View alert history
  - Configure alert preferences per admin

---

## 6. Requirements Matrix

### Priority Classification

| Priority | Count | FR IDs |
|----------|-------|--------|
| **Critical (P0)** | 10 | FR01, FR02, FR04, FR05, FR06, FR07, FR08, FR09, FR11, FR14 |
| **High (P1)** | 8 | FR03, FR10, FR12, FR13, FR15, FR16, FR17, FR18 |
| **Medium (P2)** | 1 | FR19 |
| **Low (P3)** | 7 | FR20, FR21, FR22, FR23, FR24, FR25, FR26 (Admin Panel - Phase 2) |

### User Type Coverage

| User Type | Related FR IDs |
|-----------|----------------|
| **End User (Content Creator)** | FR01-FR19 |
| **Admin/System Operator** | FR20-FR26 |
| **All Users** | FR01, FR02, FR03, FR17, FR19 |

### Technology Dependencies

| Technology | Related FR IDs | Purpose |
|------------|----------------|---------|
| **OpenAI Whisper API** | FR05 | Speech-to-text transcription |
| **FFmpeg** | FR07, FR10 | Video processing and format conversion |
| **YouTube Data API v3** | FR11, FR14, FR16 | OAuth and video upload |
| **Facebook Graph API** | FR12, FR14, FR16 | OAuth and video posting |
| **Instagram Basic Display API** | FR13, FR14, FR16 | OAuth and content publishing |
| **PostgreSQL** | FR01-FR26 | Data persistence |
| **Bcrypt** | FR01, FR02 | Password hashing |
| **Passport.js** | FR01, FR11-FR13 | Authentication and OAuth |

### Use Case Mapping

| Use Case | Related FR IDs |
|----------|----------------|
| **New User Registration** | FR01, FR02 |
| **Upload and Process Video** | FR04, FR05, FR06, FR07, FR08 |
| **Preview and Download Clips** | FR09, FR10 |
| **Connect Social Media** | FR11, FR12, FR13, FR15 |
| **Upload to Social Platforms** | FR14, FR16 |
| **Manage Projects** | FR08, FR17, FR18, FR19 |
| **Admin Operations** | FR20, FR21, FR22, FR23, FR24, FR25, FR26 |

---

## Glossary

- **Clip:** Short vertical video (20-60 seconds) generated from highlight segments
- **Highlight:** Engaging segment of video identified by AI analysis
- **Engagement Score:** Numerical value (0-100) indicating content engagement potential
- **OAuth:** Open authorization protocol for secure third-party access
- **Transcription:** Text version of video audio with timestamps
- **Vertical Format:** 9:16 aspect ratio optimized for mobile viewing (1080x1920)
- **FFmpeg:** Open-source video processing framework
- **Whisper API:** OpenAI's speech recognition model
- **RBAC:** Role-Based Access Control system
- **SRT/VTT:** Subtitle file formats

---

**Document Version:** 1.0  
**Last Updated:** March 5, 2026  
**Status:** Active - Phase 2 Requirements (FR20-FR26) Pending Implementation
