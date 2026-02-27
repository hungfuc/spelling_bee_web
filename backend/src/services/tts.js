const axios = require('axios');

const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || 'http://tts:8000';
const RETRYABLE_CODES = new Set(['EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']);
const RETRY_WINDOW_MS = 90000;
const RETRY_DELAY_MS = 1500;

async function synthesizeSpeech(text) {
  const cleanText = String(text || '').trim();
  if (!cleanText) {
    throw new Error('Text is required for speech synthesis');
  }

  const deadline = Date.now() + RETRY_WINDOW_MS;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await axios.post(
        `${TTS_SERVICE_URL}/tts`,
        { text: cleanText },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 120000
        }
      );

      return {
        buffer: Buffer.from(response.data),
        contentType: response.headers['content-type'] || 'audio/wav'
      };
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const shouldRetry = RETRYABLE_CODES.has(error.code) || status >= 500;
      if (!shouldRetry) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }

  throw lastError;
}

module.exports = {
  synthesizeSpeech
};
