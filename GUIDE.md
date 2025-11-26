# 📖 Multimodal AI Dashboard - Quick Guide

## What This App Does

A web app with 4 AI-powered features:
1. **💬 Chat** - Text conversation with Gemini AI
2. **🎙️ Voice Chat** - Talk with AI (voice-to-voice)
3. **🎥 Video Analyzer** - Upload videos/images for AI analysis
4. **🖥️ Screen Describer** - AI narrates your screen in real-time

---

## Getting Started

### Setup
1. Install: `npm install`
2. Add your Gemini API key to `.env.local`:
   ```
   GEMINI_API_KEY=your_key_here
   ```
3. Run: `npm run dev`
4. Open: `http://localhost:3000`

---

## Screen Describer - Main Features

### Controls
- **Start/Stop Sharing** - Begin/end screen capture
- **▶️ Pause/Resume** - Pause analysis without stopping
- **🔊 Voice Toggle** - Turn audio narration on/off
- **⚡ Instant / 🔄 Synced** - Text appears instantly OR with audio
- **HD/MD/LD** - Video quality (doesn't affect AI analysis)

### Voice Options
- **Free Voices** - Unlimited browser text-to-speech
- **Premium Voices** - Gemini TTS voices (Kore, Leda, Aoede, etc.) - 100 requests/day limit

### Editing Descriptions
- Click **✏️ Edit** to modify any description
- Your edits help AI understand context better
- Saves automatically and guides future descriptions

### Session History
- Last 5 sessions auto-saved
- Export transcripts (Copy or Download)
- Manage via sidebar

---

## Common Issues

### "Permission denied" error
**Problem:** Screen sharing only works on `localhost` or `https://`

**Solution:**
- Use `http://localhost:3000` (not IP address like `192.168.x.x`)
- OR set up HTTPS for network access

### Audio not playing
- Check if voice is enabled (🔊 button)
- Try switching between Free/Premium voices
- Premium voices have daily limits (100/day)

### "undefined" in descriptions
- Click ✏️ Edit and write what you see
- Your edit teaches the AI for future frames
- Use clear, descriptive language

---

## Tech Stack

- React 19.2.0 + TypeScript
- Vite 6.2.0
- Google Gemini AI
- Tailwind CSS
