const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/token';

let instance = null;

class TwitchUAT {
  constructor(clientId, clientSecret, options = {}) {
    if (instance) {
      throw new Error('TwitchUAT is a singleton. Use TwitchUAT.initialize() and TwitchUAT.getInstance()');
    }
    if (!options.accessToken) {
      throw new Error('accessToken is required');
    }
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this._accessToken = options.accessToken;
    this._refreshToken = options.refreshToken || null;
    this.onTokenRefresh = options.onTokenRefresh || null;
  }

  static initialize(clientId, clientSecret, options = {}) {
    if (!instance) {
      instance = new TwitchUAT(clientId, clientSecret, options);
    }
    return instance;
  }

  static getInstance() {
    if (!instance) {
      throw new Error('TwitchUAT not initialized. Call TwitchUAT.initialize() first');
    }
    return instance;
  }

  static isInitialized() {
    return instance !== null;
  }

  get accessToken() {
    return this._accessToken;
  }

  async refresh() {
    if (!this._refreshToken) {
      throw new Error('No refresh token available');
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: this._refreshToken
    });

    const response = await fetch(`${TWITCH_AUTH_URL}?${params}`, {
      method: 'POST'
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    const data = await response.json();
    this._accessToken = data.access_token;
    this._refreshToken = data.refresh_token;

    if (this.onTokenRefresh) {
      this.onTokenRefresh({
        accessToken: data.access_token,
        refreshToken: data.refresh_token
      });
    }

    return this._accessToken;
  }

  canRefresh() {
    return !!this._refreshToken;
  }
}

module.exports = TwitchUAT;
