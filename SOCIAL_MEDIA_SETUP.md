# Social Media OAuth Integration Setup Guide

This guide will help you set up OAuth integration for YouTube, Facebook, and Instagram.

## Prerequisites

- Your application must be accessible via HTTPS in production (OAuth providers require HTTPS)
- For local development, update APP_URL in .env to `http://localhost:3000`

## 1. YouTube Setup (Google Cloud)

### Step 1: Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **YouTube Data API v3**:
   - Go to "APIs & Services" → "Library"
   - Search for "YouTube Data API v3"
   - Click "Enable"

### Step 2: Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Configure the OAuth consent screen:
   - User Type: External
   - App name: Reel Forge AI
   - Add your email
   - Add authorized domains
4. Create OAuth Client ID:
   - Application type: Web application
   - Name: Reel Forge AI
   - Authorized redirect URIs: `http://localhost:3000/api/social/youtube/callback` (add production URL later)
5. Copy the **Client ID** and **Client Secret**
6. Add to `.env`:
   ```
   YOUTUBE_CLIENT_ID=your-client-id-here
   YOUTUBE_CLIENT_SECRET=your-client-secret-here
   ```

### Step 3: Test YouTube Integration
- Go to Settings → Social Accounts in your app
- Click "Connect" for YouTube
- Authorize the app
- You should see "Connected" status

---

## 2. Facebook/Instagram Setup

### Step 1: Create a Facebook App
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Click "Create App"
3. Select "Business" as app type
4. Fill in app details:
   - App name: Reel Forge AI
   - Contact email: your email

### Step 2: Add Facebook Login Product
1. In your app dashboard, click "Add Product"
2. Select "Facebook Login"
3. Click "Setup" → "Web"
4. Configure OAuth redirect URIs:
   - Go to Facebook Login → Settings
   - Valid OAuth Redirect URIs: `http://localhost:3000/api/social/facebook/callback`

### Step 3: Add Required Permissions
1. Go to "App Review" → "Permissions and Features"
2. Request the following permissions:
   - `pages_manage_posts` - To post on Facebook pages
   - `pages_read_engagement` - To read page data
   - `instagram_basic` - Basic Instagram access
   - `instagram_content_publish` - To publish Instagram reels

### Step 4: Get App Credentials
1. Go to Settings → Basic
2. Copy **App ID** and **App Secret**
3. Add to `.env`:
   ```
   FACEBOOK_APP_ID=your-app-id-here
   FACEBOOK_APP_SECRET=your-app-secret-here
   ```

### Step 5: Connect Instagram Business Account
**Important:** To post to Instagram, you need:
1. A Facebook Page (create one if you don't have)
2. An Instagram Business account
3. Connect Instagram to your Facebook Page:
   - Go to Facebook Page Settings → Instagram
   - Click "Connect Account"
   - Log in to Instagram
   - Select which account to connect

---

## 3. Environment Variables

Update your `.env` file with all credentials:

```env
# Social Media OAuth Configuration
# YouTube
YOUTUBE_CLIENT_ID=your-youtube-client-id
YOUTUBE_CLIENT_SECRET=your-youtube-client-secret

# Facebook/Instagram
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Application URL (update for production)
APP_URL=http://localhost:3000
```

---

## 4. Testing the Integration

1. **Start the server:**
   ```bash
   npm run dev
   ```

2. **Connect Accounts:**
   - Navigate to Settings → Social Accounts
   - Click "Connect" for each platform
   - Authorize access in the popup window

3. **Share a Reel:**
   - Go to your library or results page
   - Click the social media icon on any reel card
   - The video will automatically upload to that platform

---

## Troubleshooting

### YouTube Issues
- **"Invalid redirect_uri"**: Make sure the callback URL matches exactly in Google Cloud Console
- **"Access not configured"**: Enable YouTube Data API v3 in Google Cloud Console

### Facebook/Instagram Issues  
- **"Invalid OAuth redirect URI"**: Add the correct callback URL in Facebook App Settings → Facebook Login
- **"No Facebook pages found"**: Create a Facebook page first
- **"No Instagram Business account"**: Connect your Instagram account to your Facebook Page
- **"Permission denied"**: Request the required permissions in App Review

### General Issues
- **"Not authenticated"**: Make sure you're logged in to the app
- **"Account not connected"**: Go to Settings → Social Accounts and connect the account first
- **HTTPS errors in production**: Use a valid SSL certificate (required by OAuth providers)

---

## Production Deployment

When deploying to production:

1. Update `.env`:
   ```env
   APP_URL=https://your-domain.com
   ```

2. Add production callback URLs to OAuth providers:
   - Google Cloud: `https://your-domain.com/api/social/youtube/callback`
   - Facebook: `https://your-domain.com/api/social/facebook/callback`

3. Submit Facebook app for review if you need permissions beyond development mode

4. Ensure HTTPS is properly configured (required for OAuth)

---

## API Endpoints

### OAuth Endpoints
- `GET /api/social/youtube/connect` - Initiate YouTube OAuth
- `GET /api/social/youtube/callback` - YouTube OAuth callback
- `GET /api/social/facebook/connect` - Initiate Facebook OAuth
- `GET /api/social/facebook/callback` - Facebook OAuth callback
- `GET /api/social/accounts` - Get connected accounts
- `DELETE /api/social/:platform` - Disconnect account

### Upload Endpoints
- `POST /api/social/youtube/upload` - Upload video to YouTube
- `POST /api/social/facebook/upload` - Upload video to Facebook
- `POST /api/social/instagram/upload` - Upload reel to Instagram

---

## Security Notes

- Never commit `.env` file to version control
- Use secure SESSION_SECRET in production
- Regularly rotate API credentials
- Monitor API usage quotas
- Implement rate limiting for upload endpoints
- Store access tokens encrypted in production

---

## Support

If you encounter issues:
1. Check the browser console for errors
2. Check server logs for API errors
3. Verify all credentials are correct in `.env`
4. Ensure callback URLs match exactly
5. Check API quotas haven't been exceeded
