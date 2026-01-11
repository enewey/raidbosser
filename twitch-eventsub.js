const WebSocket = require('ws');
const EventEmitter = require('events');

const TWITCH_EVENTSUB_WS_URL = 'wss://eventsub.wss.twitch.tv/ws';
const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/token';
const TWITCH_API_URL = 'https://api.twitch.tv/helix';

class TwitchEventSub extends EventEmitter {
  constructor(clientId, clientSecret) {
    super();
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
    this.sessionId = null;
    this.ws = null;
    this.keepaliveTimeout = null;
    this.reconnectUrl = null;
  }

  async getAccessToken() {
    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'client_credentials'
    });

    const response = await fetch(`${TWITCH_AUTH_URL}?${params}`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    return this.accessToken;
  }

  async connect() {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

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

  async subscribe(type, condition, version = '1') {
    if (!this.sessionId) {
      throw new Error('Not connected. Call connect() first and wait for ready event.');
    }

    const response = await fetch(`${TWITCH_API_URL}/eventsub/subscriptions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
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

  async getUserId(username) {
    if (!this.accessToken) {
      await this.getAccessToken();
    }

    const response = await fetch(`${TWITCH_API_URL}/users?login=${encodeURIComponent(username)}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Client-Id': this.clientId
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get user ID: ${response.status}`);
    }

    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      throw new Error(`User not found: ${username}`);
    }

    return data.data[0].id;
  }
}

module.exports = TwitchEventSub;
