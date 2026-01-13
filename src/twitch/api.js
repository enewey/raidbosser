const TwitchUAT = require('./uat');

const TWITCH_API_URL = 'https://api.twitch.tv/helix';
const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/token';

class TwitchAPI {
  constructor(clientId, clientSecret) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.accessToken = null;
  }

  async getAccessToken() {
    if (this.accessToken) {
      return this.accessToken;
    }

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

  async request(endpoint, params = {}) {
    await this.getAccessToken();

    const url = new URL(`${TWITCH_API_URL}${endpoint}`);
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Client-Id': this.clientId
      }
    });

    if (!response.ok) {
      throw new Error(`Twitch API error: ${response.status}`);
    }

    return response.json();
  }

  async getUserById(userId) {
    const data = await this.request('/users', { id: userId });
    return _formatGetUserPayload(data, `User not found: ${userId}`);
  }

  async getUserByLogin(username) {
    const data = await this.request('/users', { login: username });
    return _formatGetUserPayload(data, `User not found: ${username}`);
  }

  async getUserId(username) {
    const user = await this.getUserByLogin(username);
    return user.id;
  }

  async getAttackReward(broadcasterId) {
    const response = await fetch(
      `${TWITCH_API_URL}/channel_points/custom_rewards?broadcaster_id=${broadcasterId}`,
      {
        headers: {
          'Authorization': `Bearer ${TwitchUAT.getInstance().getAccessToken()}`,
          'Client-Id': this.clientId
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get channel point rewards: ${response.status}`);
    }

    const data = await response.json();
    const attackReward = data.data?.find(reward => reward.title.includes('<ATTACK>'));
    return attackReward || null;
  }
}

function _formatGetUserPayload(data, errorMsg) {
  if (!data.data || data.data.length === 0) {
    throw new Error(errorMsg);
  }

  const user = data.data[0];
  return {
    id: user.id,
    login: user.login,
    displayName: user.display_name,
    description: user.description,
    profileImageUrl: user.profile_image_url,
    offlineImageUrl: user.offline_image_url,
    broadcasterType: user.broadcaster_type,
    createdAt: user.created_at
  };
}

module.exports = TwitchAPI;
