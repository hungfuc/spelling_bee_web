import axios from 'axios';

const RAW_API_URL = import.meta.env.PUBLIC_API_URL ?? '';
const API_URL = RAW_API_URL.replace(/\/$/, '');

const api = axios.create({
  baseURL: API_URL ? `${API_URL}/api` : '/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

function tokenHeaders(token) {
  const normalized = String(token || '').trim();
  return normalized ? { 'x-access-token': normalized } : {};
}

// Words API
export const wordsAPI = {
  // Get all words
  getAll: (page = 1, limit = 50, tagIds = [], token = '') => {
    const params = { page, limit };
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      params.tagIds = tagIds.join(',');
    }
    return api.get('/words', { params, headers: tokenHeaders(token) });
  },

  // Get all tags
  getTags: (token = '') => {
    return api.get('/words/tags', { headers: tokenHeaders(token) });
  },

  // Get random word
  getRandom: (tagIds = [], token = '') => {
    const params = {};
    if (Array.isArray(tagIds) && tagIds.length > 0) {
      params.tagIds = tagIds.join(',');
    }
    return api.get('/words/random', { params, headers: tokenHeaders(token) });
  },

  // Generate speech audio via backend TTS service
  textToSpeech: (text, token = '') => {
    return api.post(
      '/words/tts',
      { text },
      {
        headers: tokenHeaders(token),
        responseType: 'blob'
      }
    );
  },

  // Get word by ID
  getById: (id) => {
    return api.get(`/words/${id}`);
  },

  // Create word
  create: (word, meaning = null, pronunciation = null) => {
    return api.post('/words', { word, meaning, pronunciation });
  },

  // Update word
  update: (id, meaning = null, pronunciation = null) => {
    return api.put(`/words/${id}`, { meaning, pronunciation });
  },

  // Delete word
  delete: (id) => {
    return api.delete(`/words/${id}`);
  }
};

// Upload API
export const uploadAPI = {
  // Upload text file
  uploadFile: (file, tags = [], token = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tags', JSON.stringify(tags));
    return api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        ...tokenHeaders(token)
      }
    });
  }
};

export default api;
