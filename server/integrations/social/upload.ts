import { Router, type Request, type Response } from 'express';
import { google } from 'googleapis';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import { socialMediaStorage } from './storage';

const router = Router();

// Upload to YouTube
router.post('/youtube/upload', async (req: Request, res: Response) => {
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const { videoPath, title, description } = req.body;

  if (!videoPath || !title) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const userId = (req.session as any).userId;
    const account = await socialMediaStorage.getAccount(userId, 'youtube');

    if (!account) {
      return res.status(400).json({ message: 'YouTube account not connected' });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.YOUTUBE_CLIENT_ID,
      process.env.YOUTUBE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: account.accessToken,
      refresh_token: account.refreshToken || undefined,
    });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

    // Construct the full path to the video file in the outputs directory
    const fullVideoPath = path.join(process.cwd(), 'outputs', videoPath);
    
    if (!fs.existsSync(fullVideoPath)) {
      return res.status(404).json({ message: 'Video file not found' });
    }

    const fileSize = fs.statSync(fullVideoPath).size;
    const videoStream = fs.createReadStream(fullVideoPath);

    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: title,
          description: description || '',
          categoryId: '22', // People & Blogs
        },
        status: {
          privacyStatus: 'public',
          // Mark as Short if duration is under 60 seconds
          selfDeclaredMadeForKids: false,
        },
      },
      media: {
        body: videoStream,
      },
    });

    res.json({
      success: true,
      videoId: response.data.id,
      url: `https://www.youtube.com/watch?v=${response.data.id}`,
    });
  } catch (error: any) {
    console.error('YouTube upload error:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      response: error.response?.data
    });
    res.status(500).json({ 
      message: 'Failed to upload to YouTube',
      error: error.message,
      details: error.response?.data?.error?.message || error.message
    });
  }
});

// Upload to Facebook
router.post('/facebook/upload', async (req: Request, res: Response) => {
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const { videoPath, caption } = req.body;

  if (!videoPath) {
    return res.status(400).json({ message: 'Missing video path' });
  }

  try {
    const userId = (req.session as any).userId;
    const account = await socialMediaStorage.getAccount(userId, 'facebook');

    if (!account) {
      return res.status(400).json({ message: 'Facebook account not connected' });
    }

    const accessToken = account.accessToken;

    // Try to get user's Facebook pages dynamically
    let pageId: string;
    let pageAccessToken: string;
    
    try {
      const pagesResponse = await axios.get('https://graph.facebook.com/me/accounts', {
        params: { access_token: accessToken },
      });

      if (pagesResponse.data.data && pagesResponse.data.data.length > 0) {
        // Use the first page if available
        const page = pagesResponse.data.data[0];
        pageId = page.id;
        pageAccessToken = page.access_token;
      } else {
        // Fallback: Use hardcoded page if /me/accounts returns empty
        console.log('No pages from /me/accounts, trying fallback to animex.studio24');
        const pageResponse = await axios.get('https://graph.facebook.com/animex.studio24', {
          params: { fields: 'id,access_token', access_token: accessToken }
        });
        pageId = pageResponse.data.id;
        pageAccessToken = pageResponse.data.access_token || accessToken;
      }
    } catch (pageError: any) {
      // If /me/accounts fails, try hardcoded page as fallback
      console.log('Failed to get pages dynamically, trying fallback to animex.studio24');
      try {
        const pageResponse = await axios.get('https://graph.facebook.com/animex.studio24', {
          params: { fields: 'id,access_token', access_token: accessToken }
        });
        pageId = pageResponse.data.id;
        pageAccessToken = pageResponse.data.access_token || accessToken;
      } catch (fallbackError: any) {
        return res.status(400).json({ 
          message: 'Could not access Facebook pages. Please check page permissions.',
          error: fallbackError.response?.data?.error?.message || fallbackError.message
        });
      }
    }

    // Construct the full path to the video file in the outputs directory
    const fullVideoPath = path.join(process.cwd(), 'outputs', videoPath);
    
    if (!fs.existsSync(fullVideoPath)) {
      return res.status(404).json({ message: 'Video file not found' });
    }

    // Upload video to Facebook Page
    const formData = new FormData();
    formData.append('source', fs.createReadStream(fullVideoPath));
    formData.append('description', caption || '');
    formData.append('access_token', pageAccessToken);

    const uploadResponse = await axios.post(
      `https://graph-video.facebook.com/${pageId}/videos`,
      formData,
      {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    res.json({
      success: true,
      postId: uploadResponse.data.id,
      url: `https://www.facebook.com/${pageId}/videos/${uploadResponse.data.id}`,
    });
  } catch (error: any) {
    console.error('Facebook upload error:', error);
    res.status(500).json({ 
      message: 'Failed to upload to Facebook',
      error: error.response?.data || error.message 
    });
  }
});

// Upload to Instagram
router.post('/instagram/upload', async (req: Request, res: Response) => {
  if (!req.session || !(req.session as any).userId) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  const { videoUrl, caption } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ message: 'Missing video URL' });
  }

  try {
    const userId = (req.session as any).userId;
    const account = await socialMediaStorage.getAccount(userId, 'facebook'); // Instagram uses FB token

    if (!account) {
      return res.status(400).json({ message: 'Instagram account not connected (connect via Facebook)' });
    }

    const accessToken = account.accessToken;

    // Get user's Instagram Business Account
    const pagesResponse = await axios.get(`https://graph.facebook.com/me/accounts`, {
      params: { 
        access_token: accessToken,
        fields: 'instagram_business_account',
      },
    });

    const page = pagesResponse.data.data?.find((p: any) => p.instagram_business_account);
    if (!page || !page.instagram_business_account) {
      return res.status(400).json({ 
        message: 'No Instagram Business account found. Connect your Instagram Business account to your Facebook page.' 
      });
    }

    const igAccountId = page.instagram_business_account.id;

    // Create media container
    const createMediaResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${igAccountId}/media`,
      {
        video_url: videoUrl,
        caption: caption || '',
        media_type: 'REELS',
        access_token: accessToken,
      }
    );

    const creationId = createMediaResponse.data.id;

    // Publish the media
    const publishResponse = await axios.post(
      `https://graph.facebook.com/v18.0/${igAccountId}/media_publish`,
      {
        creation_id: creationId,
        access_token: accessToken,
      }
    );

    res.json({
      success: true,
      mediaId: publishResponse.data.id,
    });
  } catch (error: any) {
    console.error('Instagram upload error:', error);
    res.status(500).json({ 
      message: 'Failed to upload to Instagram',
      error: error.response?.data || error.message 
    });
  }
});

export default router;
