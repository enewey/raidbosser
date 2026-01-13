const WebSocket = require('ws');
const EventEmitter = require('events');
const TwitchUAT = require('./uat');

const TWITCH_EVENTSUB_WS_URL = 'wss://eventsub.wss.twitch.tv/ws';
const TWITCH_API_URL = 'https://api.twitch.tv/helix';

class TwitchEventSub extends EventEmitter {
  constructor(clientId) {
    super();
    this.clientId = clientId;
    this.sessionId = null;
    this.ws = null;
    this.keepaliveTimeout = null;
    this.reconnectUrl = null;
  }

  async connect() {
    const url = this.reconnectUrl || TWITCH_EVENTSUB_WS_URL;
    this.ws = new WebSocket(url);

    this.ws.on('open', () => {
      console.log('Connected to Twitch EventSub WebSocket');
      this.emit('connected');
    });

    this.ws.on('message', (data) => {
      this.handleMessage(JSON.parse(data.toString()));
    });

    this.ws.on('close', (code, reason) => {
      console.log(`WebSocket closed: ${code} - ${reason}`);
      this.clearKeepaliveTimeout();
      this.emit('disconnected', { code, reason: reason.toString() });
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });
  }

  handleMessage(message) {
    const { metadata, payload } = message;

    this.resetKeepaliveTimeout(metadata.message_type);

    switch (metadata.message_type) {
      case 'session_welcome':
        this.sessionId = payload.session.id;
        console.log(`EventSub session established: ${this.sessionId}`);
        this.emit('ready', { sessionId: this.sessionId });
        break;

      case 'session_keepalive':
        // Just reset timeout, already done above
        break;

      case 'session_reconnect':
        this.reconnectUrl = payload.session.reconnect_url;
        console.log('Received reconnect request, reconnecting...');
        this.ws.close();
        this.connect();
        break;

      case 'notification':
        this.emit('event', {
          type: payload.subscription.type,
          data: payload.event
        });
        break;

      case 'revocation':
        console.log(`Subscription revoked: ${payload.subscription.type}`);
        this.emit('revocation', payload.subscription);
        break;
    }
  }

  resetKeepaliveTimeout(messageType) {
    this.clearKeepaliveTimeout();
    // Twitch sends keepalive every 10 seconds, disconnect if we don't hear anything for 30
    this.keepaliveTimeout = setTimeout(() => {
      console.log('Keepalive timeout, reconnecting...');
      this.ws.close();
      this.connect();
    }, 30000);
  }

  clearKeepaliveTimeout() {
    if (this.keepaliveTimeout) {
      clearTimeout(this.keepaliveTimeout);
      this.keepaliveTimeout = null;
    }
  }

  async subscribe(type, condition, version = '1', isRetry = false) {
    if (!this.sessionId) {
      throw new Error('Not connected. Call connect() first and wait for ready event.');
    }

    const response = await fetch(`${TWITCH_API_URL}/eventsub/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TwitchUAT.getInstance().accessToken}`,
        'Client-Id': this.clientId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type,
        version,
        condition,
        transport: {
          method: 'websocket',
          session_id: this.sessionId
        }
      })
    });

    // Handle token expiration - refresh and retry once
    if (response.status === 401 && !isRetry && TwitchUAT.getInstance().canRefresh()) {
      console.log('Access token expired, refreshing...');
      await TwitchUAT.getInstance().refresh();
      return this.subscribe(type, condition, version, true);
    }

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to subscribe to ${type}: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    console.log(`Subscribed to ${type}`);
    return data;
  }

  disconnect() {
    this.clearKeepaliveTimeout();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.sessionId = null;
    this.reconnectUrl = null;
  }

  async subscribeToChannelPointRedemption(broadcasterUserId, rewardId) {
    const condition = {
      broadcaster_user_id: broadcasterUserId,
      reward_id: rewardId
    };
    return this.subscribe('channel.channel_points_custom_reward_redemption.add', condition);
  }
}

module.exports = TwitchEventSub;
