require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');

function get(key, defaultValue = undefined) {
  return process.env[key] ?? defaultValue;
}

function updateEnvFile(updates) {
  let content = '';
  if (fs.existsSync(ENV_PATH)) {
    content = fs.readFileSync(ENV_PATH, 'utf8');
  }

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `${content.endsWith('\n') || content === '' ? '' : '\n'}${key}=${value}\n`;
    }
  }

  fs.writeFileSync(ENV_PATH, content);
}

function updateTokens(accessToken, refreshToken) {
  updateEnvFile({
    TWITCH_USER_ACCESS_TOKEN: accessToken,
    TWITCH_USER_REFRESH_TOKEN: refreshToken
  });
  console.log('Updated .env file with new tokens');
}

function updateRewardId(rewardId) {
  updateEnvFile({
    TWITCH_REWARD_ID: rewardId
  });
  console.log('Updated .env file with new reward ID');
}

module.exports = {
  get,
  updateTokens,
  updateRewardId,
  get port() { return get('PORT', 3000); },
  get twitchClientId() { return get('TWITCH_CLIENT_ID'); },
  get twitchClientSecret() { return get('TWITCH_CLIENT_SECRET'); },
  get twitchRedirectUri() { return get('TWITCH_REDIRECT_URI'); },
  get twitchUserAccessToken() { return get('TWITCH_USER_ACCESS_TOKEN'); },
  get twitchUserRefreshToken() { return get('TWITCH_USER_REFRESH_TOKEN'); },
  get twitchUsername() { return get('TWITCH_USERNAME'); },
  get twitchRewardId() { return get('TWITCH_REWARD_ID'); }
};
