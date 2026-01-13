const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');
const env = require('./env');
const TwitchUAT = require('./twitch/uat');
const TwitchEventSub = require('./twitch/eventsub');
const TwitchAPI = require('./twitch/api');

const app = express();

app.use(express.static(path.join(__dirname, 'public')));

// OAuth configuration
const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2';
const REDIRECT_URI = env.twitchRedirectUri || `http://localhost:${env.port}/auth/callback`;
const SCOPES = [
  'channel:read:subscriptions',
  'bits:read',
  'moderator:read:followers',
  'channel:read:redemptions'
].join(' ');

// OAuth: Start authorization flow
app.get('/auth/twitch', (req, res) => {
  const params = new URLSearchParams({
    client_id: env.twitchClientId,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES
  });
  res.redirect(`${TWITCH_AUTH_URL}/authorize?${params}`);
});

// OAuth: Handle callback
app.get('/auth/callback', async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    return res.status(400).send(`Authorization error: ${error_description || error}`);
  }

  if (!code) {
    return res.status(400).send('No authorization code received');
  }

  try {
    const params = new URLSearchParams({
      client_id: env.twitchClientId,
      client_secret: env.twitchClientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    });

    const response = await fetch(`${TWITCH_AUTH_URL}/token`, {
      method: 'POST',
      body: params
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.message || 'Token exchange failed');
    }

    const tokens = await response.json();

    env.updateTokens(tokens.access_token, tokens.refresh_token);

    res.send(`
      <h1>Authorization Successful!</h1>
      <p>Tokens have been saved to your .env file.</p>
      <p>Restart your server to apply the new tokens.</p>
    `);
  } catch (err) {
    console.error('Token exchange error:', err);
    res.status(500).send(`Token exchange failed: ${err.message}`);
  }
});

// Test endpoint to trigger a fake raid
app.get('/test/raid', (req, res) => {
  const raidEvent = JSON.stringify({
    type: 'raid',
    data: {
      raiderName: req.query.name || 'TestRaider',
      viewerCount: parseInt(req.query.viewers) || 42,
      profileImageUrl: req.query.image || 'https://static-cdn.jtvnw.net/jtv_user_pictures/8a6381c7-d0c0-4576-b179-38bd5ce1d6af-profile_image-300x300.png'
    }
  });

  overlayClients.forEach(client => {
    if (client.readyState === 1) {
      client.send(raidEvent);
    }
  });

  res.json({ success: true, message: 'Test raid sent' });
});

// Track connected overlay clients
const overlayClients = new Set();

// Initialize Twitch API
const twitchAPI = new TwitchAPI(
  env.twitchClientId,
  env.twitchClientSecret
);

// Initialize user access token manager and EventSub (if token is configured)
let eventSub = null;

if (env.twitchUserAccessToken) {
  TwitchUAT.initialize(
    env.twitchClientId,
    env.twitchClientSecret,
    {
      accessToken: env.twitchUserAccessToken,
      refreshToken: env.twitchUserRefreshToken,
      onTokenRefresh: ({ accessToken, refreshToken }) => {
        env.updateTokens(accessToken, refreshToken);
      }
    }
  );

  eventSub = new TwitchEventSub(env.twitchClientId);
}

if (eventSub) {
  eventSub.on('ready', async ({ sessionId }) => {
    console.log('EventSub ready, session:', sessionId);

    const userId = await twitchAPI.getUserId(env.twitchUsername);
    console.log(`Resolved user ID for ${env.twitchUsername}: ${userId}`);

    // Subscribe to incoming raids
    await eventSub.subscribe('channel.raid', { to_broadcaster_user_id: userId });

    // Subscribe to channel point redemptions if reward ID is configured
    if (env.twitchRewardId) {
      await eventSub.subscribeToChannelPointRedemption(userId, env.twitchRewardId);
      console.log(`Subscribed to channel point redemptions for reward: ${env.twitchRewardId}`);
    }
  });

  eventSub.on('event', async ({ type, data }) => {
    console.log(`Received event [${type}]:`, data);

    if (type === 'channel.raid') {
      const raiderName = data.from_broadcaster_user_name;
      const viewerCount = data.viewers;
      console.log(`RAID: ${raiderName} raided with ${viewerCount} viewers!`);

      // Fetch raider's profile info
      const raiderProfile = await twitchAPI.getUserById(data.from_broadcaster_user_id);
      console.log(`Raider profile:`, {
        displayName: raiderProfile.displayName,
        profileImageUrl: raiderProfile.profileImageUrl
      });

      // Broadcast to overlay clients
      const raidEvent = JSON.stringify({
        type: 'raid',
        data: {
          raiderName: raiderProfile.displayName,
          viewerCount,
          profileImageUrl: raiderProfile.profileImageUrl
        }
      });
      overlayClients.forEach(client => {
        if (client.readyState === 1) {
          client.send(raidEvent);
        }
      });
    }

    if (type === 'channel.channel_points_custom_reward_redemption.add') {
      const { user_name, reward, user_input } = data;
      console.log(`REDEMPTION: ${user_name} redeemed "${reward.title}"`);

      // Broadcast to overlay clients
      const redemptionEvent = JSON.stringify({
        type: 'redemption',
        data: {
          userName: user_name,
          rewardId: reward.id,
          rewardTitle: reward.title,
          rewardCost: reward.cost,
          userInput: user_input || null
        }
      });
      overlayClients.forEach(client => {
        if (client.readyState === 1) {
          client.send(redemptionEvent);
        }
      });
    }
  });

  eventSub.on('error', (error) => {
    console.error('EventSub error:', error);
  });
}

// Connect to Twitch EventSub
if (eventSub) {
  console.log('Connecting to Twitch EventSub...');
  eventSub.connect().catch(console.error);
} else {
  console.log(`No user access token configured. Visit http://localhost:${env.port}/auth/twitch to authorize.`);
}

const server = app.listen(env.port, () => {
  console.log(`Server running at http://localhost:${env.port}`);
});

// WebSocket server for overlay clients
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('Overlay client connected');
  overlayClients.add(ws);

  ws.on('close', () => {
    console.log('Overlay client disconnected');
    overlayClients.delete(ws);
  });
});
