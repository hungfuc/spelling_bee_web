const axios = require('axios');
const { loadConfig } = require('./config');

const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || 'http://tts:8000';
const DEFAULT_ENGINE = String(process.env.TTS_DEFAULT_ENGINE || 'melo').toLowerCase();
const ENGINE_URLS = {
  melo: process.env.TTS_MELO_SERVICE_URL || TTS_SERVICE_URL,
  kokoro: process.env.TTS_KOKORO_SERVICE_URL || '',
  coqui: process.env.TTS_COQUI_SERVICE_URL || '',
  styletts2: process.env.TTS_STYLETTS2_SERVICE_URL || ''
};
const RETRYABLE_CODES = new Set(['EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT']);
const DEFAULT_RETRY_WINDOW_MS = 330000;
const DEFAULT_RETRY_DELAY_MS = 1500;
const DEFAULT_SHORT_RETRY_WINDOW_MS = 4000;
const DEFAULT_REQUEST_TIMEOUT_MS = 300000;

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

function getTimeoutConfig() {
  const config = loadConfig();
  return {
    requestTimeoutMs: normalizePositiveInt(config.ttsRequestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS),
    retryWindowMs: normalizePositiveInt(config.ttsRetryWindowMs, DEFAULT_RETRY_WINDOW_MS),
    retryDelayMs: normalizePositiveInt(config.ttsRetryDelayMs, DEFAULT_RETRY_DELAY_MS),
    shortRetryWindowMs: normalizePositiveInt(config.ttsShortRetryWindowMs, DEFAULT_SHORT_RETRY_WINDOW_MS)
  };
}

function isLikelyLocalhostUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1';
  } catch (error) {
    return false;
  }
}

function rewriteDockerLocalhostUrl(value) {
  try {
    const parsed = new URL(value);
    parsed.hostname = 'tts';
    return parsed.toString();
  } catch (error) {
    return value;
  }
}

function resolveEngineConfig(options = {}) {
  const requestedEngine = String(options.engine || DEFAULT_ENGINE || 'melo').toLowerCase();
  if (requestedEngine === 'browser') {
    throw new Error('Browser engine must be used client-side');
  }

  const serviceUrl = String(options.serviceUrl || '').trim();
  if (serviceUrl) {
    if (!/^https?:\/\//i.test(serviceUrl)) {
      throw new Error('serviceUrl must start with http:// or https://');
    }
    if (isLikelyLocalhostUrl(serviceUrl) && process.env.DB_HOST === 'mysql' && requestedEngine !== 'custom') {
      return { engine: requestedEngine, url: rewriteDockerLocalhostUrl(serviceUrl) };
    }
    if (isLikelyLocalhostUrl(serviceUrl) && process.env.DB_HOST === 'mysql') {
      throw new Error("serviceUrl using localhost is invalid in Docker for custom engine. Use 'http://host.docker.internal:PORT' or docker service URL");
    }
    return { engine: requestedEngine, url: serviceUrl };
  }

  if (requestedEngine === 'custom') {
    const url = String(options.customUrl || '').trim();
    if (!/^https?:\/\//i.test(url)) {
      throw new Error('customUrl is required for custom TTS engine');
    }
    return { engine: requestedEngine, url };
  }

  const url = ENGINE_URLS[requestedEngine];
  if (!url) {
    throw new Error(
      `TTS engine '${requestedEngine}' is not configured. Provide serviceUrl in frontend TTS setup or set TTS_${requestedEngine.toUpperCase()}_SERVICE_URL`
    );
  }

  return { engine: requestedEngine, url };
}

async function synthesizeSpeech(text, options = {}) {
  const cleanText = String(text || '').trim();
  if (!cleanText) {
    throw new Error('Text is required for speech synthesis');
  }
  const timeoutConfig = getTimeoutConfig();
  const { engine, url } = resolveEngineConfig(options);
  const payload = {
    text: cleanText
  };
  if (options.voice) {
    payload.voice = String(options.voice).trim();
  }
  if (Number.isFinite(Number(options.speed))) {
    payload.speed = Number(options.speed);
  }

  const deadline = Date.now() + (options.serviceUrl ? timeoutConfig.shortRetryWindowMs : timeoutConfig.retryWindowMs);
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await axios.post(
        `${url.replace(/\/$/, '')}/tts`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: timeoutConfig.requestTimeoutMs
        }
      );

      return {
        buffer: Buffer.from(response.data),
        contentType: response.headers['content-type'] || 'audio/wav',
        engine
      };
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const shouldRetry = RETRYABLE_CODES.has(error.code) || status >= 500;
      if (!shouldRetry) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, timeoutConfig.retryDelayMs));
    }
  }

  throw lastError;
}

module.exports = {
  synthesizeSpeech
};
