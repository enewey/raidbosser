require('dotenv').config();

const express = require('express');
const path = require('path');
const TwitchEventSub = require('./twitch-eventsub');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// Initialize Twitch EventSub
const eventSub = new TwitchEventSub(
  process.env.TWITCH_CLIENT_ID,
  process.env.TWITCH_CLIENT_SECRET
);

eventSub.on('ready', async ({ sessionId }) => {
  console.log('EventSub ready, session:', sessionId);

  const userId = await eventSub.getUserId(process.env.TWITCH_USERNAME);
  console.log(`Resolved user ID for ${process.env.TWITCH_USERNAME}: ${userId}`);

  // Subscribe to events here, example:
  // eventSub.subscribe('channel.follow', { broadcaster_user_id: userId, moderator_user_id: userId }, '2');
});

eventSub.on('event', ({ type, data }) => {
  console.log(`Received event [${type}]:`, data);
});

eventSub.on('error', (error) => {
  console.error('EventSub error:', error);
});

// Connect to Twitch EventSub
eventSub.connect().catch(console.error);

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
