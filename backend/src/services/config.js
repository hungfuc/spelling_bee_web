const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.resolve(__dirname, '../../config.json');
const DEFAULT_CONFIG = {
  uploadToken: '',
  testToken: ''
};

function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) {
      return DEFAULT_CONFIG;
    }

    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return {
      ...DEFAULT_CONFIG,
      ...parsed
    };
  } catch (error) {
    console.error('Failed to read backend/config.json:', error.message);
    return DEFAULT_CONFIG;
  }
}

module.exports = {
  loadConfig
};
