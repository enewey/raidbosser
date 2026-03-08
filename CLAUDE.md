# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Raidbosser is a Twitch stream overlay that creates interactive "raid boss" experiences. When someone raids the channel, the raider appears as a boss with HP equal to the viewer count. Chat messages damage the boss (1 HP per message), and when HP reaches 0, the boss is defeated.

### Core Flow
1. Server connects to Twitch EventSub for real-time events (raids, chat, channel points)
2. Events are broadcast to overlay clients via WebSocket
3. The canvas overlay renders raid notifications and tracks boss HP

### Testing
- `/test/raid?name=TestUser&viewers=50` - Simulates a raid without a real Twitch event

### Authentication
1. Visit `/auth/twitch` to start OAuth flow
2. Tokens are saved to `.env` automatically
3. Restart server to connect with new tokens

## Development Commands

```bash
npm install    # Install dependencies
npm test       # Run tests (not yet configured)
```

## Architecture

```
src/
├── index.js          # Express server, OAuth flow, WebSocket server
├── env.js            # Environment config and .env file management
├── public/
│   ├── index.html    # Stream overlay HTML shell
│   └── game.js       # Overlay logic (canvas rendering, WebSocket, raid notifications)
└── twitch/
    ├── api.js        # Twitch Helix API client
    ├── eventsub.js   # EventSub WebSocket client for real-time events
    └── uat.js        # User Access Token manager (singleton)
```

The server connects to Twitch EventSub to receive real-time events (raids, channel point redemptions) and broadcasts them to connected overlay clients via WebSocket.
