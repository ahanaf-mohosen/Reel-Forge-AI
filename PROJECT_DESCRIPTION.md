# Reel Forge AI - Project Description

## Overview
Reel Forge AI is an AI-powered web platform that helps users convert long-form videos into short, engaging clips for social media. The system automates the full workflow: upload a video, transcribe speech, detect highlight moments, generate vertical clips, and publish them to multiple platforms.

The main goal of the project is to reduce manual editing time and make short-form content creation faster, easier, and more accessible for creators, businesses, and social media teams.

## Problem Statement
Creating short clips from long videos manually is slow and repetitive. Users typically spend hours reviewing footage, selecting moments, editing clips, and uploading to different platforms. Reel Forge AI addresses this by using machine learning and automated media processing to produce ready-to-share clips in minutes.

## Objectives
- Automate highlight detection from long videos using AI.
- Generate high-quality vertical clips optimized for mobile-first platforms.
- Provide direct social media publishing through OAuth integrations.
- Offer a simple dashboard for project tracking, preview, download, and sharing.
- Improve content production efficiency while maintaining quality.

## Core Features
- Secure authentication (email/password + Google OAuth)
- Video upload with progress tracking
- AI transcription using OpenAI Whisper
- Intelligent highlight scoring and segment selection
- Automated clip generation with FFmpeg (9:16 format)
- Clip preview and download
- Multi-platform upload support (YouTube, Facebook, Instagram)
- Project and account management dashboard

## High-Level Workflow
1. User logs in and uploads a video.
2. System extracts audio and creates transcript.
3. AI analyzes transcript to identify engaging segments.
4. FFmpeg generates short vertical clips.
5. User previews clips and downloads or publishes them.

## Technology Stack
- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Node.js/TypeScript service architecture
- Database: PostgreSQL with schema-driven data models
- AI Services: OpenAI Whisper and NLP-based highlight analysis
- Media Processing: FFmpeg
- Integrations: YouTube, Facebook, and Instagram APIs

## Expected Impact
- Significant reduction in editing and publishing time
- Improved consistency in short-form content output
- Better productivity for creators and marketing teams
- Scalable foundation for future analytics and admin features

## Future Scope
- Advanced analytics dashboard
- Smarter recommendation tuning for highlight quality
- Batch processing improvements
- Expanded social platform integrations
- Team collaboration and role-based workflows
