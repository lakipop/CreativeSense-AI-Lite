# 🤖 CreativeSense AI

Advanced multimodal AI application for real-time visual analysis, voice interaction, and creative content analysis. Built with React, TypeScript, and Google Gemini AI.

## ✨ Features

### 1. �️ Screen Describer (Primary Feature)
Real-time AI narration of your screen with advanced analysis
- **Live screen capture** with quality options (HD/MD/LD)
- **6 AI narration styles**: Action, Feeling, Detailed, Normal, Deep Analysis, Video Finder
- **AI voice narration** with multiple voice options
- **Draggable PiP mode** for low-quality viewing
- **Dynamic layouts**: Side-by-side (HD/MD) or PiP mode (LD)
- **1500-word context window** for coherent continuous narration
- **Session management** with export functionality
- **Auto-scroll with highlighting** for new descriptions

### 2. 🎥 Video Analyzer
Upload and analyze videos/images with AI
- Drag & drop file upload
- Frame extraction from videos
- Detailed AI analysis
- Session history with file previews

### 3. 🎙️ Voice Chat
Real-time voice conversation with AI
- Live audio streaming
- Transcript display
- Session management
- Natural conversation flow

### 4. 💬 Chat
Advanced text chat with AI
- Streaming responses
- Session management
- Full conversation history
- Modern UI with dark mode


## 🚀 Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Add API key**
   
   Create `.env.local` in the root directory:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
   Get your API key: https://ai.google.dev/

3. **Run development server**
   ```bash
   npm run dev
   ```
   Open: `http://localhost:3000`

## 📦 Build for Production

```bash
npm run build
npm run preview
```

## 🛠️ Tech Stack

- **Frontend**: React 19.2.0 + TypeScript
- **Build Tool**: Vite 6.2.0
- **AI Engine**: Google Gemini 2.5 Flash (multimodal)
- **Styling**: Tailwind CSS (CDN)
- **State Management**: React Hooks + localStorage
- **Media APIs**: MediaDevices, Canvas, Web Audio API

## 🎨 Key Features

### Screen Describer Enhancements
- **Advanced AI Styles**: 6 specialized narration modes including explicit content research support
- **Smart Context**: 1500-word sliding window for continuous narrative coherence
- **Flexible Viewing**: Draggable/resizable PiP mode with dynamic layout switching
- **Quality Control**: HD (1920x1080@30fps), MD (1280x720@24fps), LD (854x480@15fps)
- **Professional Export**: Session management with transcript export

### Session Management
- All features support session/history management
- localStorage persistence
- Import/export capabilities
- Session switching without data loss

## ⚠️ Common Issues

**Screen sharing not working?**
- Must use `localhost` or `https://` (not IP addresses)
- Browser must support `getDisplayMedia()` API
- Check browser permissions

**No audio narration?**
- Ensure voice toggle is enabled
- Check browser audio permissions
- Premium voices have daily limits (100 requests/day)

**PiP mode issues?**
- PiP only available in Low Quality mode
- Requires screen sharing to be active
- Check z-index if not visible

For more troubleshooting, see `TROUBLESHOOTING-SIMPLE.md`


## 📁 Project Structure

```
components/
  ScreenDescriber.tsx      # Real-time screen capture & AI narration
  VideoAnalyzer.tsx        # Video/image upload & analysis
  LiveConversation.tsx     # Voice-to-voice chat
  ChatBot.tsx              # Text chat interface
  DarkModeToggle.tsx       # Theme switcher
  styles/
    styleConfig.ts         # AI narration style configurations
utils/
  audio.ts                 # Audio processing utilities
  video.ts                 # Video frame extraction
App.tsx                    # Main application layout
types.ts                   # TypeScript type definitions
```

## 📝 License

Copyright © 2025 lakipop

This project is proprietary software. All rights reserved.

### Usage Terms

- ✅ **Personal use** is permitted for learning and development
- ✅ **Modifications** are allowed for personal projects
- ❌ **Commercial use** requires written permission
- ❌ **Redistribution** without permission is prohibited
- ❌ **Copying or forking** without explicit authorization is not allowed

**To request permission for commercial use or redistribution, please contact the author.**

## 💖 Support the Project

If you find this project helpful, please consider:

### ⭐ Star this Repository
Show your appreciation by starring the repo on GitHub!

### 🔔 Follow for Updates
- **GitHub**: [@lakipop](https://github.com/lakipop)
- Stay updated with new features and improvements

### 📢 Share & Review
- Share this project with others who might benefit
- Provide feedback and suggestions for improvements
- Report bugs or request features via GitHub Issues

### 💰 Sponsor Development
Your support helps maintain and improve this project:
- Contact for sponsorship opportunities
- Contributions help add new features and maintain quality

## 🚫 Copyright Notice

**All rights reserved.** This software and associated documentation files (the "Software") are the intellectual property of lakipop. Unauthorized copying, modification, distribution, or use of this Software, via any medium, is strictly prohibited without explicit written permission from the copyright holder.

**Violations may result in legal action.**

## 🤝 Contributing

Interested in contributing? Great! Please:
1. **Open an issue** first to discuss your proposed changes
2. **Wait for approval** before starting work
3. **Follow the coding standards** used in this project
4. **Submit a pull request** with a clear description

**Note**: By contributing, you agree that your contributions will be licensed under the same terms as this project.

## 👤 Author

**lakipop**
- GitHub: [@lakipop](https://github.com/lakipop)
- Project: [CreativeSense AI](https://github.com/lakipop/CreativeSense-AI)

---

<div align="center">

**CreativeSense AI** - Advanced Multimodal AI for Creative Content Analysis

*Developed with ❤️ by lakipop*

⭐ **Star this repo if you find it useful!** ⭐

</div>

