import { Router, type Request, type Response } from 'express';
import { google } from 'googleapis';
import axios from 'axios';
import { socialMediaStorage } from './storage';

const router = Router();

// OAuth2 clients
const youtubeOAuth2Client = new google.auth.OAuth2(
  process.env.YOUTUBE_CLIENT_ID,
  process.env.YOUTUBE_CLIENT_SECRET,
  `${process.env.APP_URL || 'http://localhost:3000'}/api/social/youtube/callback`
);

// YouTube OAuth routes
router.get('/youtube/connect', (req: Request, res: Response) => {
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const authUrl = youtubeOAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly'
    ],
    state: (req.session as any).userId,
  });

  res.json({ authUrl });
});

router.get('/youtube/callback', async (req: Request, res: Response) => {
  const { code, state: userId } = req.query;

  if (!code || !userId) {
    return res.status(400).send('Missing code or state');
  }

  try {
    const { tokens } = await youtubeOAuth2Client.getToken(code as string);
    
    // Get user's YouTube channel info
    youtubeOAuth2Client.setCredentials(tokens);
    const youtube = google.youtube({ version: 'v3', auth: youtubeOAuth2Client });
    const channelResponse = await youtube.channels.list({
      part: ['snippet'],
      mine: true,
    });

    const channel = channelResponse.data.items?.[0];
    if (!channel) {
      return res.status(400).send('No YouTube channel found');
    }

    // Save to database
    await socialMediaStorage.upsertAccount({
      userId: userId as string,
      platform: 'youtube',
      platformUserId: channel.id!,
      platformUsername: channel.snippet?.title || undefined,
      accessToken: tokens.access_token!,
      refreshToken: tokens.refresh_token || undefined,
      tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      scope: tokens.scope,
    });

    res.send('<script>window.close(); window.opener.postMessage({ type: "youtube-connected" }, "*");</script>');
  } catch (error) {
    console.error('YouTube OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Facebook/Instagram OAuth routes
router.get('/facebook/connect', (req: Request, res: Response) => {
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const clientId = process.env.FACEBOOK_APP_ID;
  const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/social/facebook/callback`;
  const state = (req.session as any).userId;

  // Request permissions for Facebook Pages and Instagram
  const scopes = [
    'email',
    'public_profile',
    'pages_show_list',
    'pages_read_engagement',
    'pages_manage_posts',
    'instagram_basic',
    'instagram_content_publish'
  ].join(',');

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scopes}`;

  res.json({ authUrl });
});

router.get('/facebook/callback', async (req: Request, res: Response) => {
  const { code, state: userId } = req.query;

  if (!code || !userId) {
    return res.status(400).send('Missing code or state');
  }

  try {
    const clientId = process.env.FACEBOOK_APP_ID;
    const clientSecret = process.env.FACEBOOK_APP_SECRET;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/social/facebook/callback`;

    // Exchange code for access token
    const tokenResponse = await axios.get(`https://graph.facebook.com/v18.0/oauth/access_token`, {
      params: {
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: code,
      },
    });

    const { access_token } = tokenResponse.data;

    // Get user info
    const userResponse = await axios.get(`https://graph.facebook.com/me`, {
      params: {
        access_token,
        fields: 'id,name',
      },
    });

    const { id, name } = userResponse.data;

    // Save to database
    await socialMediaStorage.upsertAccount({
      userId: userId as string,
      platform: 'facebook',
      platformUserId: id,
      platformUsername: name,
      accessToken: access_token,
      scope: 'pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish',
    });

    res.send('<script>window.close(); window.opener.postMessage({ type: "facebook-connected" }, "*");</script>');
  } catch (error) {
    console.error('Facebook OAuth callback error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Instagram connect (uses Facebook OAuth)
router.get('/instagram/connect', (req: Request, res: Response) => {
  // Instagram uses Facebook OAuth - redirect to Facebook OAuth
  res.redirect('/api/social/facebook/connect');
});

// Get all connected accounts
router.get('/accounts', async (req: Request, res: Response) => {
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const accounts = await socialMediaStorage.getAllAccounts((req.session as any).userId);
    
    // Don't send access tokens to frontend
    const safeAccounts = accounts.map(acc => ({
      platform: acc.platform,
      platformUsername: acc.platformUsername,
      connectedAt: acc.createdAt,
    }));

    res.json(safeAccounts);
  } catch (error) {
    console.error('Error fetching accounts:', error);
    res.status(500).json({ message: 'Failed to fetch accounts' });
  }
});

// Disconnect account
router.delete('/:platform', async (req: Request, res: Response) => {
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const { platform } = req.params;

  if (!platform || typeof platform !== 'string') {
    return res.status(400).json({ message: 'Invalid platform' });
  }

  try {
    await socialMediaStorage.deleteAccount((req.session as any).userId, platform);
    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting account:', error);
    res.status(500).json({ message: 'Failed to disconnect account' });
  }
});

export default router;
