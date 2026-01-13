# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Raidboss provides interactive stream experiences in response to events from the Twitch API.

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
